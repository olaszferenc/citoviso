// Tenant documents (ADR-0084) — the data behind the admin's "Dokumentumok" tab:
// the tenant's own invoices, and the declarations they accepted when ordering.
//
// ⚠️ THE INVOICE HAS NO tenant_id. The only route from a bizonylat to its owner is
//   invoice.payment_id → payment.order_intent_id → order_intent.prospect_id
//   → prospect.lead_id = tenant.lead_id
// Every query here goes through that chain and filters on the SESSION's tenant id.
// A tenant must never be able to reach another tenant's document — which is why
// `invoicePdf()` takes the tenant id too and does not trust the invoice id alone.

import { db } from "../db/client.js";

export interface TenantInvoiceView {
  readonly id: string;
  readonly invoiceNumber: string | null;
  readonly issuedAt: Date;
  readonly gross: number;
  readonly currency: string;
  /** 'issued' | 'failed' | 'storno' | 'cancelled'. */
  readonly status: string;
  readonly vatTreatment: string | null;
  readonly hasPdf: boolean;
  /** What the invoice covers — the renewal period when known, else null. */
  readonly periodStart: Date | null;
  readonly periodEnd: Date | null;
  readonly year: string;
}

/** Every invoice that belongs to this tenant, newest first. */
export async function listTenantInvoices(tenantId: string): Promise<TenantInvoiceView[]> {
  const rows = await db
    .selectFrom("invoice")
    .innerJoin("payment", "payment.id", "invoice.payment_id")
    .innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
    .leftJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .leftJoin("tenant", "tenant.lead_id", "prospect.lead_id")
    .select([
      "invoice.id as id",
      "invoice.invoice_number as invoiceNumber",
      "invoice.issued_at as issuedAt",
      "invoice.gross as gross",
      "invoice.currency as currency",
      "invoice.status as status",
      "invoice.vat_treatment as vatTreatment",
      "order_intent.renewal_period_start as periodStart",
      "order_intent.renewal_period_end as periodEnd",
      (eb) => eb("invoice.pdf_base64", "is not", null).as("hasPdf"),
    ])
    // Both legs of the chain: orders bound straight to the tenant, and the initial
    // checkout that only reaches it over the prospect→lead bridge.
    .where((eb) =>
      eb.or([eb("order_intent.tenant_id", "=", tenantId), eb("tenant.id", "=", tenantId)]),
    )
    // 'cancelled' rows are bookkeeping leftovers, not documents the tenant should read.
    .where("invoice.status", "!=", "cancelled")
    .orderBy("invoice.issued_at", "desc")
    .execute();

  return rows.map((r) => {
    const issuedAt = new Date(r.issuedAt as unknown as string);
    return {
      id: r.id,
      invoiceNumber: r.invoiceNumber,
      issuedAt,
      gross: r.gross,
      currency: r.currency,
      status: r.status,
      vatTreatment: r.vatTreatment,
      hasPdf: Boolean(r.hasPdf),
      periodStart: r.periodStart ? new Date(r.periodStart as unknown as string) : null,
      periodEnd: r.periodEnd ? new Date(r.periodEnd as unknown as string) : null,
      year: String(issuedAt.getFullYear()),
    };
  });
}

/**
 * The PDF of ONE invoice, scoped to the tenant. Returns null when the invoice does
 * not exist, is not this tenant's, or carries no document (mock provider / failure)
 * — the caller answers 404 for all three, so an id probe reveals nothing.
 */
export async function tenantInvoicePdf(
  tenantId: string,
  invoiceId: string,
): Promise<{ pdfBase64: string; invoiceNumber: string | null } | null> {
  const row = await db
    .selectFrom("invoice")
    .innerJoin("payment", "payment.id", "invoice.payment_id")
    .innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
    .leftJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .leftJoin("tenant", "tenant.lead_id", "prospect.lead_id")
    .select(["invoice.pdf_base64 as pdf", "invoice.invoice_number as invoiceNumber"])
    .where("invoice.id", "=", invoiceId)
    .where((eb) =>
      eb.or([eb("order_intent.tenant_id", "=", tenantId), eb("tenant.id", "=", tenantId)]),
    )
    .executeTakeFirst();
  if (!row?.pdf) return null;
  return { pdfBase64: row.pdf, invoiceNumber: row.invoiceNumber };
}

/** One accepted declaration / contractual record, as shown on the Szerződések list. */
export interface TenantAgreementView {
  /** Stable key so the view can pick its localized title (never a stored Hungarian label). */
  readonly key: "order" | "terms" | "photo_rights" | "withdrawal_waiver";
  readonly acceptedAt: Date;
  readonly year: string;
  /** The exact wording the tenant accepted, when we stored it. */
  readonly text: string | null;
  /** key/value rows; the keys are stable, the view localizes them. */
  readonly facts: readonly { readonly key: string; readonly value: string }[];
}

/**
 * What this tenant agreed to, and when. Read from the order intents behind their
 * payments — we store the accepted WORDING at order time precisely so it can be
 * shown back later without reconstructing it from today's texts.
 */
export async function listTenantAgreements(tenantId: string): Promise<TenantAgreementView[]> {
  const orders = await db
    .selectFrom("order_intent")
    .leftJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .leftJoin("tenant", "tenant.lead_id", "prospect.lead_id")
    .select([
      "order_intent.id as id",
      "order_intent.created_at as createdAt",
      "order_intent.submitted_at as submittedAt",
      "order_intent.price as price",
      "order_intent.billing_period as billingPeriod",
      "order_intent.domain_name as domainName",
      "order_intent.commitment_months as commitmentMonths",
      "order_intent.photo_rights_declared_at as photoAt",
      "order_intent.photo_rights_text as photoText",
      "order_intent.terms_accepted_at as termsAt",
      "order_intent.terms_text as termsText",
      "order_intent.withdrawal_waiver_at as waiverAt",
      "order_intent.withdrawal_waiver_text as waiverText",
      "order_intent.kind as kind",
    ])
    .where((eb) =>
      eb.or([eb("order_intent.tenant_id", "=", tenantId), eb("tenant.id", "=", tenantId)]),
    )
    .where("order_intent.status", "=", "submitted")
    .orderBy("order_intent.created_at", "desc")
    .execute();

  const out: TenantAgreementView[] = [];
  const seen = new Set<string>();
  const push = (v: TenantAgreementView): void => {
    // One declaration per kind: the tenant accepted the same ÁSZF on every upsell,
    // and a list repeating it five times is noise, not a record. The NEWEST wins
    // (the orders are already sorted desc).
    if (seen.has(v.key)) return;
    seen.add(v.key);
    out.push(v);
  };

  for (const o of orders) {
    const stamp = o.submittedAt ?? o.createdAt;
    if (o.kind === "initial" || !seen.has("order")) {
      const at = new Date(stamp as unknown as string);
      push({
        key: "order",
        acceptedAt: at,
        year: String(at.getFullYear()),
        text: null,
        facts: [
          { key: "billingPeriod", value: o.billingPeriod },
          { key: "price", value: o.price === null ? "" : String(o.price) },
          { key: "domain", value: o.domainName ?? "" },
          { key: "commitment", value: o.commitmentMonths === null ? "" : String(o.commitmentMonths) },
        ].filter((f) => f.value !== ""),
      });
    }
    if (o.termsAt) {
      const at = new Date(o.termsAt as unknown as string);
      push({ key: "terms", acceptedAt: at, year: String(at.getFullYear()), text: o.termsText, facts: [] });
    }
    if (o.photoAt) {
      const at = new Date(o.photoAt as unknown as string);
      push({
        key: "photo_rights",
        acceptedAt: at,
        year: String(at.getFullYear()),
        text: o.photoText,
        facts: [],
      });
    }
    if (o.waiverAt) {
      const at = new Date(o.waiverAt as unknown as string);
      push({
        key: "withdrawal_waiver",
        acceptedAt: at,
        year: String(at.getFullYear()),
        text: o.waiverText,
        facts: [],
      });
    }
  }
  return out.sort((a, b) => b.acceptedAt.getTime() - a.acceptedAt.getTime());
}
