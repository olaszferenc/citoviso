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
  body: unknown,
  headers: Record<string, string | string[] | undefined>,
): Promise<{ ok: boolean; activated?: boolean }> {
  const res = getGateway().parseWebhook(body, headers);
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
  return { ok: true, activated };
}

/** Paid → provision (convertLead) + flip the site to public 'live' + advance lead. */
async function activate(orderIntentId: string): Promise<boolean> {
  const oi = await db
    .selectFrom("order_intent")
    .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .select([
      "order_intent.modules as modules",
      "prospect.lead_id as leadId",
      "prospect.mock_artifact_id as artifactId",
    ])
    .where("order_intent.id", "=", orderIntentId)
    .executeTakeFirst();
  if (!oi || !oi.artifactId) return false;
  const modules = (oi.modules as unknown as string[]) ?? [];
  try {
    // convertLead requires an APPROVED artifact — activation implies the operator
    // approved the mock. It provisions tenant + entitlements + private snapshot.
    const conv = await convertLead(oi.leadId, oi.artifactId, modules);
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
    return true;
  } catch (e) {
    console.error(`[payment] activate ${orderIntentId} hiba: ${(e as Error).message}`);
    return false;
  }
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
