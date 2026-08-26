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
import { tenantSiteUrl } from "../domains.js";
import { config } from "../config.js";
import { getInvoiceProvider } from "../invoicing/index.js";
import { upsertPartnerFromOrder } from "../billing/partner.js";
import { activateUpsell } from "../tenant/moduleUpsell.js";
import { syncEntitlementsToPaid } from "../tenant/paidEntitlements.js";
import { deliverInvoiceEmail } from "../billing/invoiceDelivery.js";
import { markMultilangPaid } from "../tenant/multilangOrder.js";
import { runMultilangGeneration } from "../tenant/multilangGenerate.js";
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
    .select(["id", "price", "billing_period", "kind"])
    .where("id", "=", orderIntentId)
    .executeTakeFirst();
  if (!oi || oi.price == null) return null;

  // FULFILLMENT GATE (2026-08-14): only mint a pay-link once the mock is APPROVED.
  // activate() → convertLead() hard-requires an 'approved' artifact; without this
  // guard a buyer could pay (and be invoiced) on a still-'generated' mock, then
  // activation fails silently and they get nothing. No approved mock ⇒ no pay-link:
  // the order stays recorded, the buyer sees "we'll e-mail the pay-link", and the
  // operator re-issues it after approving (idempotent via the pending-reuse path).
  const artifact = await db
    .selectFrom("order_intent")
    .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .leftJoin("mock_artifact", "mock_artifact.id", "prospect.mock_artifact_id")
    .select("mock_artifact.status as status")
    .where("order_intent.id", "=", orderIntentId)
    .executeTakeFirst();
  if (artifact?.status !== "approved") {
    console.warn(
      `[payment] requestPayment ${orderIntentId} HALASZTVA: a mock artifact nem 'approved' ` +
        `(jelenlegi: ${artifact?.status ?? "nincs"}) — pay-link nem adható ki jóváhagyásig`,
    );
    return null;
  }

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
    // ADR-0063: a one-time purchase must not read "előfizetés" on the pay screen.
    description:
      oi.kind === "multilang"
        ? "Citoviso többnyelvű honlap — egyszeri generálási díj"
        : `Citoviso előfizetés (${oi.billing_period === "annual" ? "éves" : "havi"})`,
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
  // An UPSELL (0033) extends a tenant that is already live: no provisioning, no
  // go-live — just switch on what was bought, then re-render so the new section
  // actually appears on the page. Routing it through activate() would try to
  // convert the lead a second time.
  const kindRow = await db
    .selectFrom("order_intent")
    .select(["kind", "tenant_id"])
    .where("id", "=", payment.order_intent_id)
    .executeTakeFirst();
  if (kindRow?.kind === "upsell") {
    const bought = await activateUpsell(payment.order_intent_id);
    if (kindRow.tenant_id) {
      // Same billing truth as the initial activation, and for the same reason:
      // activateUpsell also writes `active: true` only, so anything the tenant was
      // holding unpaid would ride along untouched. Runs BEFORE the re-render, so
      // the published page matches what was actually bought.
      await syncEntitlementsToPaid(kindRow.tenant_id);
    }
    if (bought.length && kindRow.tenant_id) {
      // The live page renders from the snapshot, so an entitlement alone would
      // change the bill without changing the site the buyer just paid for.
      await rerenderTenantSnapshot(kindRow.tenant_id, { as: "live" });
    }
    console.log(`[upsell] fizetve → bekapcsolt modulok: ${bought.join(", ") || "nincs"}`);
    await issueInvoiceFor(payment.id);
    return { ok: true, activated: bought.length > 0 };
  }
  // ADR-0063 MULTILANG: a one-time generation purchase. The webhook must answer
  // fast, and the generation translates + renders 3 languages (minutes of LLM
  // work) — so it runs detached; its lifecycle lives in multilang_generation
  // (a crash leaves 'paid'/'failed', never a silent loss, and it can be re-run).
  if (kindRow?.kind === "multilang") {
    const genId = await markMultilangPaid(payment.order_intent_id);
    if (genId) {
      runMultilangGeneration(genId)
        .then((r) =>
          r.ok
            ? console.log(`[multilang] fizetve → legenerálva: ${(r.languages ?? []).join(", ")}`)
            : console.error(`[multilang] fizetve, de a generálás HIBÁZOTT: ${r.error}`),
        )
        .catch((e) => console.error(`[multilang] generálás-futtatás HIBA:`, e));
    } else {
      console.error(
        `[multilang] fizetett order (${payment.order_intent_id}) generálási rekord nélkül — kézi beavatkozás kell`,
      );
    }
    await issueInvoiceFor(payment.id);
    return { ok: true, activated: Boolean(genId) };
  }

  const activated = await activate(payment.order_intent_id);
  await issueInvoiceFor(payment.id); // best-effort (records a 'failed' row on error)
  return { ok: true, activated };
}

/**
 * Issue an invoice for a paid payment via the invoice provider (mock now,
 * Számlázz.hu Számla Agent once validated). Idempotent (skips if already issued).
 *
 * ⛔ HISTORY, so this never regresses (0029): the buyer used to be FABRICATED —
 * name = lead.name (the Google Maps marketing name), address = a regex split of
 * that Maps address string, taxNumber = hardcoded null. Every company customer
 * therefore received an invoice with no adószám: unbookable as a cost, absent
 * from their NAV Online Számla account, and a guaranteed storno request. The
 * mock provider validated none of it, so the chain stayed green.
 *
 * The buyer now comes from the DECLARATION captured at checkout. If an order has
 * no declaration (a pre-0029 row) we do NOT guess: we record a 'failed' invoice
 * with a clear reason so the operator issues it by hand. A wrong invoice is
 * worse than a missing one.
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
    .select([
      "payment.amount as amount",
      "payment.currency as currency",
      "payment.period as period",
      // ADR-0063/0065: a one-time purchase must not be billed to the buyer as a
      // "havi"/"éves" subscription in the mail (billing_period is N/A there).
      "order_intent.kind as kind",
      "order_intent.modules as modules",
      "order_intent.buyer_type as buyerType",
      "order_intent.buyer_name as buyerName",
      "order_intent.buyer_tax_number as taxNumber",
      "order_intent.buyer_eu_vat_number as euVatNumber",
      "order_intent.buyer_country as country",
      "order_intent.buyer_zip as zip",
      "order_intent.buyer_city as city",
      "order_intent.buyer_address as address",
      "order_intent.buyer_email as buyerEmail",
      "order_intent.vat_treatment as vatTreatment",
      "prospect.contact_email as email",
    ])
    .where("payment.id", "=", paymentId)
    .executeTakeFirst();
  if (!p) return;

  const provider = getInvoiceProvider();

  // NO DECLARATION ⇒ NO GUESS. Pre-0029 orders (and any path that skipped the
  // checkout gate) get a recorded failure the operator can act on, never an
  // invoice built from marketing data.
  if (!p.buyerType || !p.buyerName) {
    const reason =
      "Nincs számlázási nyilatkozat az orderen (0029 előtti rendelés) — a számlát kézzel kell kiállítani; " +
      "vevő-adatot a lead marketing-nevéből SOSEM fabrikálunk.";
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
        error: reason,
      })
      .execute();
    console.error(`[invoice] KIHAGYVA (${paymentId}): ${reason}`);
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  // Cadence for the buyer-facing mail; 'multilang' is a one-time fee, not a period.
  const cadence: "monthly" | "annual" | "once" =
    p.kind === "multilang" ? "once" : p.period === "annual" ? "annual" : "monthly";
  // ⚠️ The INVOICE LINE below stays Hungarian on purpose: it is the text of a
  // LEGAL document issued by a Hungarian provider (Számlázz.hu). Legal wording is
  // a per-country LEGAL pack question (§B.18), not UI translation — the buyer's
  // covering E-MAIL is what ADR-0067 localizes.
  const periodLabel = cadence === "once" ? "egyszeri" : cadence === "annual" ? "éves" : "havi";
  const modCount = ((p.modules as unknown as string[]) ?? []).length;
  // Reverse charge (Áfa tv. 37. §) is decided at order time against a VIES-verified
  // VAT number; everything else is AAM. The DB constraint guarantees the pairing.
  const reverse = p.vatTreatment === "reverse_charge";
  const vatKey = reverse ? "TAM" : "AAM";
  const input = {
    buyer: {
      name: p.buyerName,
      // Billing address wins over the outreach contact — that is the whole point.
      email: p.buyerEmail ?? p.email,
      zip: p.zip,
      city: p.city,
      address: p.address,
      taxNumber: p.taxNumber,
      euVatNumber: p.euVatNumber,
      country: p.country,
    },
    items: [
      {
        name:
          cadence === "once"
            ? `Citoviso többnyelvű honlap (egyszeri generálási díj)`
            : `Citoviso előfizetés (${periodLabel}, ${modCount} modul)`,
        quantity: 1,
        unitNet: p.amount,
        vatKey,
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
    comment: reverse
      ? "A szolgáltatás teljesítési helye a megrendelő tagállama — fordított adózás (Áfa tv. 37. §). Reverse charge."
      : "Alanyi adómentes (AAM).",
  };

  try {
    const res = await provider.issueInvoice(input);
    await db
      .insertInto("invoice")
      .values({
        payment_id: paymentId,
        provider: provider.name,
        invoice_number: res.invoiceNumber,
        vat_key: vatKey,
        vat_rate: 0,
        net: res.net || p.amount,
        gross: res.gross || p.amount,
        currency: p.currency,
        status: "issued",
        // 0030: keep the document itself, so there is a bizonylat to show the
        // buyer, hand to the accountant and attach to a bank reconciliation.
        pdf_base64: res.pdfBase64 ?? null,
        fulfillment_date: today,
        due_date: today,
        vat_treatment: reverse ? "reverse_charge" : "aam",
      })
      .execute();
    console.log(
      `[invoice] kiállítva ${res.invoiceNumber} (${provider.name}) · ${p.amount} ${p.currency}`,
    );
    // DELIVERY. Separate from issuance and deliberately AFTER the insert: the
    // bizonylat is the thing that must survive, so a mail outage may never lose
    // it. Runs once per payment because this whole function returns early when
    // an 'issued' invoice already exists.
    await deliverInvoiceEmail({
      paymentId,
      invoiceNumber: res.invoiceNumber,
      gross: res.gross || p.amount,
      currency: p.currency,
      period: cadence,
      pdfBase64: res.pdfBase64 ?? null,
      buyerName: p.buyerName,
      buyerEmail: p.buyerEmail ?? p.email,
    });
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
  // The ONLY refusal here that used to be silent. Every other `return false`
  // below logs; this one just vanished — the buyer paid, saw "we are finalising
  // your site", and nobody knew. A paid activation that stops must always say so.
  if (!oi || !oi.artifactId) {
    console.error(
      `[payment] activate ${orderIntentId} MEGTAGADVA: ` +
        (oi
          ? "a prospecthez nincs mock artifact kötve — kurátori rendezés kell"
          : "nincs ilyen order_intent (vagy nincs prospectje)") +
        " — a vevő FIZETETT, de nem lesz élő oldala",
    );
    return false;
  }
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
    // BILLING TRUTH, and it must run BEFORE the live render. convertLead only ever
    // turns entitlements ON, so an operator's pre-payment ALL-IN preview (ADR-0014)
    // survived this paid activation and the snapshot below would publish modules
    // nobody bought — measured 2026-08-26: ten of them on one live tenant. The
    // order matters because moduleContentFor() reads entitlements when rendering.
    await syncEntitlementsToPaid(conv.tenantId);
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

    // PARTNER REGISTRY (0032): the paid order becomes an accounting counterparty
    // here, because this is the first point where a LEGAL name + tax number exist
    // (the 0029 declaration). The buyer's billing e-mail addresses land as
    // partner_contact rows, which is where invoices and notices are addressed
    // from. Best-effort and idempotent: a registry hiccup must not un-do a paid
    // activation, and a re-delivered webhook must not mint a second partner.
    try {
      const p = await upsertPartnerFromOrder(orderIntentId, conv.tenantId);
      if (p) {
        console.log(
          `[payment] partner ${p.created ? "létrehozva" : "frissítve"} · ${p.partnerId} · ` +
            `számlázási címzettek: ${p.billingEmails.join(", ") || "nincs"}`,
        );
      } else {
        console.warn(
          `[payment] activate ${orderIntentId}: nincs jogi név az orderen (pre-0029?) — partner NEM jött létre, operátori rendezés kell`,
        );
      }
    } catch (err) {
      console.error(`[payment] partner-rögzítés hiba (${orderIntentId}):`, err);
    }

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
  return {
    businessName: row.businessName,
    siteUrl:
      row.siteStatus === "live"
        ? tenantSiteUrl(config.publicSiteUrl, row.slug, row.customDomain)
        : null,
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
