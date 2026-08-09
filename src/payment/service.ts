// Payment service (Slice 2) — orchestrates the pilot pay-link loop, gateway-agnostic:
//   requestPayment  → create a 'pending' payment + a gateway pay-link
//   handleWebhook   → gateway confirms → 'paid' → ACTIVATE (site live), or 'failed'
//   deactivate      → non-pay / cancel → site 'suspended'
//
// Activation reuses convertLead (tenant + entitlements + provisioned site snapshot)
// then flips the site to 'live'. NB: 'live' is the state-machine go-live; the actual
// public hosting (custom domain + TLS) is the deferred hosting slice — here it means
// the DB state + the existing /site/<token> snapshot. Idempotent on the gateway ref.

import { db } from "../db/client.js";
import { convertLead } from "../conversion/provision.js";
import { rerenderTenantSnapshot } from "../tenant/editor.js";
import { issueAndSendTenantLogin } from "../tenant/credentials.js";
import { PLATFORM_DOMAIN } from "../domains.js";
import { getInvoiceProvider } from "../invoicing/index.js";
import { getGateway } from "./index.js";

export interface RequestPaymentResult {
  readonly paymentId: string;
  readonly payUrl: string;
  readonly gatewayRef: string;
}

/** Create (or reuse a still-pending) pay-link for a submitted order intent. */
export async function requestPayment(
  orderIntentId: string,
): Promise<RequestPaymentResult | null> {
  const oi = await db
    .selectFrom("order_intent")
    .select(["id", "price", "billing_period"])
    .where("id", "=", orderIntentId)
    .executeTakeFirst();
  if (!oi || oi.price == null) return null;

  const gw = getGateway();

  // Reuse an outstanding pending pay-link (idempotent re-request).
  const existing = await db
    .selectFrom("payment")
    .select(["id", "pay_url", "gateway_ref"])
    .where("order_intent_id", "=", orderIntentId)
    .where("status", "=", "pending")
    .orderBy("created_at", "desc")
    .executeTakeFirst();
  if (existing?.pay_url && existing.gateway_ref) {
    return { paymentId: existing.id, payUrl: existing.pay_url, gatewayRef: existing.gateway_ref };
  }

  const payment = await db
    .insertInto("payment")
    .values({
      order_intent_id: orderIntentId,
      amount: oi.price,
      currency: "HUF",
      period: oi.billing_period,
      gateway: gw.name,
      status: "pending",
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  const base = process.env.PUBLIC_BASE_URL ?? "";
  const link = await gw.createPayLink({
    paymentId: payment.id,
    amount: oi.price,
    currency: "HUF",
    period: oi.billing_period,
    description: `Citoviso előfizetés (${oi.billing_period === "annual" ? "éves" : "havi"})`,
    callbackUrl: `${base}/pay/webhook/${gw.name}`,
    returnUrl: `${base}/pay/done`,
  });

  await db
    .updateTable("payment")
    .set({ gateway_ref: link.gatewayRef, pay_url: link.payUrl })
    .where("id", "=", payment.id)
    .execute();

  return { paymentId: payment.id, payUrl: link.payUrl, gatewayRef: link.gatewayRef };
}

/** Handle a gateway webhook: mark paid/failed, and on paid activate the site. */
export async function handleWebhook(
  params: Record<string, unknown>,
  headers: Record<string, string | string[] | undefined>,
): Promise<{ ok: boolean; activated?: boolean }> {
  const res = await getGateway().parseWebhook(params, headers);
  if (!res) return { ok: false };

  const payment = await db
    .selectFrom("payment")
    .select(["id", "order_intent_id", "status"])
    .where("gateway_ref", "=", res.gatewayRef)
    .executeTakeFirst();
  if (!payment) return { ok: false };
  if (payment.status === "paid") return { ok: true, activated: false }; // idempotent

  if (res.status === "failed") {
    await db.updateTable("payment").set({ status: "failed" }).where("id", "=", payment.id).execute();
    return { ok: true, activated: false };
  }

  await db
    .updateTable("payment")
    .set({ status: "paid", paid_at: new Date() })
    .where("id", "=", payment.id)
    .execute();
  const activated = await activate(payment.order_intent_id);
  await issueInvoiceFor(payment.id); // best-effort (records a 'failed' row on error)
  return { ok: true, activated };
}

/**
 * Best-effort split of a single-string address into HU invoice parts (irsz /
 * telepules / cim). Handles the Google "Város, Utca hsz, IRSZ Hungary" format.
 * The proper fix is a structured address collected at checkout — this fills the
 * gap so Számlázz has valid buyer fields for the pilot.
 */
function parseHuAddress(raw: string | null): {
  zip: string | null;
  city: string | null;
  street: string | null;
} {
  if (!raw) return { zip: null, city: null, street: null };
  const zip = raw.match(/\b(\d{4})\b/)?.[1] ?? null;
  const rest = raw.replace(/\b\d{4}\b/, "").replace(/\bHungary\b|\bMagyarország\b/gi, "");
  const parts = rest
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const city = parts[0] ?? null;
  const street = parts.slice(1).join(", ") || null;
  return { zip, city, street };
}

/**
 * Issue an AAM (VAT-exempt) invoice for a paid payment via the invoice provider
 * (mock now, Számlázz.hu Számla Agent later). Idempotent (skips if already
 * issued). Buyer name/address come from the lead; email from the prospect. NB:
 * a complete buyer address (zip/city) is a later checkout step — the pilot
 * passes what it has; the mock provider doesn't validate.
 */
async function issueInvoiceFor(paymentId: string): Promise<void> {
  const already = await db
    .selectFrom("invoice")
    .select("id")
    .where("payment_id", "=", paymentId)
    .where("status", "=", "issued")
    .executeTakeFirst();
  if (already) return;

  const p = await db
    .selectFrom("payment")
    .innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
    .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .innerJoin("lead", "lead.id", "prospect.lead_id")
    .select([
      "payment.amount as amount",
      "payment.currency as currency",
      "payment.period as period",
      "order_intent.modules as modules",
      "lead.name as leadName",
      "lead.address as leadAddress",
      "prospect.contact_email as email",
    ])
    .where("payment.id", "=", paymentId)
    .executeTakeFirst();
  if (!p) return;

  const today = new Date().toISOString().slice(0, 10);
  const periodLabel = p.period === "annual" ? "éves" : "havi";
  const modCount = ((p.modules as unknown as string[]) ?? []).length;
  const provider = getInvoiceProvider();
  const addr = parseHuAddress(p.leadAddress);
  const input = {
    buyer: {
      name: p.leadName,
      email: p.email,
      zip: addr.zip,
      city: addr.city,
      address: addr.street ?? p.leadAddress,
      taxNumber: null,
    },
    items: [
      {
        name: `Citoviso előfizetés (${periodLabel}, ${modCount} modul)`,
        quantity: 1,
        unitNet: p.amount,
        vatKey: "AAM",
        net: p.amount,
        vat: 0,
        gross: p.amount,
      },
    ],
    currency: p.currency,
    issueDate: today,
    fulfillmentDate: today,
    dueDate: today,
    paymentMethod: "Bankkártya",
    paid: true,
    comment: "Alanyi adómentes (AAM).",
  };

  try {
    const res = await provider.issueInvoice(input);
    await db
      .insertInto("invoice")
      .values({
        payment_id: paymentId,
        provider: provider.name,
        invoice_number: res.invoiceNumber,
        vat_key: "AAM",
        vat_rate: 0,
        net: res.net || p.amount,
        gross: res.gross || p.amount,
        currency: p.currency,
        status: "issued",
      })
      .execute();
    console.log(
      `[invoice] kiállítva ${res.invoiceNumber} (${provider.name}) · ${p.amount} ${p.currency}`,
    );
  } catch (e) {
    await db
      .insertInto("invoice")
      .values({
        payment_id: paymentId,
        provider: provider.name,
        vat_key: "AAM",
        vat_rate: 0,
        net: p.amount,
        gross: p.amount,
        currency: p.currency,
        status: "failed",
        error: (e as Error).message,
      })
      .execute();
    console.error(`[invoice] hiba: ${(e as Error).message}`);
  }
}

/** Paid → provision (convertLead) + flip the site to public 'live' + advance lead. */
async function activate(orderIntentId: string): Promise<boolean> {
  const oi = await db
    .selectFrom("order_intent")
    .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .select([
      "order_intent.modules as modules",
      "order_intent.photo_rights_declared_at as photoRightsAt",
      "order_intent.domain_type as domainType",
      "order_intent.domain_name as domainName",
      "prospect.lead_id as leadId",
      "prospect.mock_artifact_id as artifactId",
      "prospect.contact_email as contactEmail",
    ])
    .where("order_intent.id", "=", orderIntentId)
    .executeTakeFirst();
  if (!oi || !oi.artifactId) return false;
  // §A recheck at the go-live edge (guard finding, 2026-08-01): an order without
  // the stamped photo-rights declaration (e.g. a pre-0015 row) must NOT
  // auto-activate — it stays paid+provisioned for the operator to resolve.
  if (!oi.photoRightsAt) {
    console.error(
      `[payment] activate ${orderIntentId} MEGTAGADVA: nincs §A fotó-jog nyilatkozat az orderen — kurátori rendezésig nem élesíthető`,
    );
    return false;
  }
  const modules = (oi.modules as unknown as string[]) ?? [];
  // ADR-0032: honor the buyer's freely-chosen platform subdomain (only for the platform-sub
  // option; a custom domain is handled by the domain fields). The label part before the first
  // dot is the slug; uniqueSiteSlug re-checks it's clean+free at provision time.
  const preferredSlug =
    oi.domainType === "citoviso_sub" && oi.domainName ? String(oi.domainName).split(".")[0] : null;
  try {
    // convertLead requires an APPROVED artifact — activation implies the operator
    // approved the mock. It provisions tenant + entitlements + private snapshot.
    const conv = await convertLead(oi.leadId, oi.artifactId, modules, preferredSlug);
    // §A go-live edge: a legacy HTML-copy artifact cannot pass the per-photo live
    // policy (no structured photos to filter) — it stays paid+provisioned for the
    // operator to resolve, same as a missing declaration.
    if (conv.renderSource === "copy") {
      console.error(
        `[payment] activate ${orderIntentId} MEGTAGADVA: legacy (HTML-másolat) artifact — a §A fotó-policy nem alkalmazható, kurátori élesítés kell`,
      );
      return false;
    }
    // §A go-live edge, in this order: render the PUBLIC snapshot FIRST (photo policy
    // drops places/streetview/watermarked imagery; the preview noindex is replaced),
    // and flip the site live only if that render succeeded — a failed render must
    // never leave a live site serving the demo-photo snapshot.
    const rendered = await rerenderTenantSnapshot(conv.tenantId, { as: "live" });
    if (!rendered) {
      console.error(
        `[payment] activate ${orderIntentId} MEGTAGADVA: a §A-policys live render nem sikerült — a site provisioned marad, kurátori rendezés kell`,
      );
      return false;
    }
    await db
      .updateTable("site")
      .set({ status: "live", live_at: new Date() })
      .where("tenant_id", "=", conv.tenantId)
      .execute();
    await db
      .updateTable("lead")
      .set({ lifecycle_status: "activation" })
      .where("id", "=", oi.leadId)
      .where("lifecycle_status", "in", [
        "qualified",
        "mock_curation",
        "outreach",
        "conversion",
        "subscription",
      ])
      .execute();

    // OWNER ACCESS (the last A–Z step): issue the tenant login and e-mail the
    // credentials, so the buyer can sign in and edit their text/photos right after
    // paying. Idempotent per tenant (issueTenantLogin keeps one owner user).
    // Best-effort: a mail/credential failure must never un-do a paid activation —
    // the operator can re-issue from the console.
    try {
      const existingLogin = await db
        .selectFrom("tenant_user")
        .select("id")
        .where("tenant_id", "=", conv.tenantId)
        .executeTakeFirst();
      if (!existingLogin && oi.contactEmail) {
        const tenantRow = await db
          .selectFrom("tenant")
          .select("display_name")
          .where("id", "=", conv.tenantId)
          .executeTakeFirst();
        const login = await issueAndSendTenantLogin(
          conv.tenantId,
          tenantRow?.display_name ?? "oldalam",
          oi.contactEmail,
        );
        console.log(
          `[payment] tenant-belépés kiadva · ${login.username} → ${login.contactEmail}`,
        );
      } else if (!existingLogin) {
        console.warn(
          `[payment] activate ${orderIntentId}: nincs contact_email a prospecten — a tenant-belépést az operátornak kell kiadnia`,
        );
      }
    } catch (e) {
      console.error(
        `[payment] tenant-belépés kiadása SIKERTELEN (a site él, kézzel pótolandó): ${(e as Error).message}`,
      );
    }
    return true;
  } catch (e) {
    console.error(`[payment] activate ${orderIntentId} hiba: ${(e as Error).message}`);
    return false;
  }
}

/** What the buyer needs right after paying: where their site lives and how to get in. */
export interface ActivationSummary {
  readonly businessName: string;
  /** Public URL of the live site (<slug>.citoviso.com), or null if not live yet. */
  readonly siteUrl: string | null;
  /** Login username (the credentials mail carries the password). */
  readonly username: string | null;
  /** Where the credentials were sent. */
  readonly contactEmail: string | null;
}

/**
 * Post-payment summary for the buyer's confirmation screen, resolved from the
 * gateway reference. Read-only; returns nulls rather than throwing, so the
 * confirmation page always renders.
 */
export async function getActivationSummary(gatewayRef: string): Promise<ActivationSummary | null> {
  const row = await db
    .selectFrom("payment")
    .innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
    .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .innerJoin("lead", "lead.id", "prospect.lead_id")
    .leftJoin("tenant", "tenant.lead_id", "lead.id")
    .leftJoin("site", "site.tenant_id", "tenant.id")
    .leftJoin("tenant_user", "tenant_user.tenant_id", "tenant.id")
    .select([
      "lead.name as businessName",
      "site.slug as slug",
      "site.status as siteStatus",
      "site.custom_domain as customDomain",
      "tenant_user.username as username",
      "tenant_user.contact_email as tenantEmail",
      "prospect.contact_email as prospectEmail",
    ])
    .where("payment.gateway_ref", "=", gatewayRef)
    .executeTakeFirst();
  if (!row) return null;
  const host = row.customDomain ?? (row.slug ? `${row.slug}.${PLATFORM_DOMAIN}` : null);
  return {
    businessName: row.businessName,
    siteUrl: row.siteStatus === "live" && host ? `https://${host}` : null,
    username: row.username ?? null,
    contactEmail: row.tenantEmail ?? row.prospectEmail ?? null,
  };
}

/** Non-pay / cancel → suspend the tenant's site (the deactivation path). */
export async function deactivate(leadId: string): Promise<void> {
  const tenant = await db
    .selectFrom("tenant")
    .select("id")
    .where("lead_id", "=", leadId)
    .executeTakeFirst();
  if (!tenant) return;
  await db
    .updateTable("site")
    .set({ status: "suspended" })
    .where("tenant_id", "=", tenant.id)
    .execute();
}
