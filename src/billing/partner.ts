// Partner registry writes (0032) — turning a paid order into an accounting
// counterparty.
//
// WHEN THE PARTNER IS BORN (handed-over constraint from the 0031 slice, owner
// decision 2026-08-22): AT PAYMENT, from the 0029 billing declaration. That is
// the first moment a LEGAL name and tax number exist. Building partners from
// leads instead would fill the registry with unverified, tax-number-less rows
// and inherit every lead duplicate — 592 leads have produced 2 payers.
//
// The registry is SHARED across the company group (no legal_entity_id), so the
// same supplier/customer is one row no matter which entity books against it.

import { db } from "../db/client.js";

export interface PartnerFromOrder {
  readonly partnerId: string;
  /** Billing recipients now on file (primary first). */
  readonly billingEmails: readonly string[];
  readonly created: boolean;
}

/**
 * Create (or refresh) the partner for a paid order and store its billing
 * recipients as `partner_contact` rows.
 *
 * IDEMPOTENT: safe to call again for the same order. A gateway may deliver its
 * webhook more than once, and `/pay/done` deliberately re-drives the same path
 * when the callback is late — a second run must not mint a second partner or
 * duplicate a recipient.
 *
 * Returns null when the order carries no legal name, i.e. a pre-0029 row: a
 * partner fabricated from a marketing name is exactly the defect ADR-0055 was
 * written to stop, so we would rather have no partner than a wrong one.
 */
export async function upsertPartnerFromOrder(
  orderIntentId: string,
  tenantId: string,
): Promise<PartnerFromOrder | null> {
  const oi = await db
    .selectFrom("order_intent")
    .select([
      "buyer_name",
      "buyer_type",
      "buyer_tax_number",
      "buyer_eu_vat_number",
      "buyer_country",
      "buyer_zip",
      "buyer_city",
      "buyer_address",
      "buyer_email",
      "billing_emails",
    ])
    .where("id", "=", orderIntentId)
    .executeTakeFirst();
  if (!oi?.buyer_name) return null;

  // Match an existing row before inserting. Tenant first (this is our own
  // customer), then tax number (the same company may already be on file as a
  // supplier — one partner, both roles, rather than two half-records).
  const byTenant = await db
    .selectFrom("partner")
    .select("id")
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  const byTax = byTenant
    ? undefined
    : oi.buyer_tax_number
      ? await db
          .selectFrom("partner")
          .select("id")
          .where("tax_number", "=", oi.buyer_tax_number)
          .executeTakeFirst()
      : undefined;
  const existingId = byTenant?.id ?? byTax?.id ?? null;

  const fields = {
    name: oi.buyer_name,
    is_customer: true,
    tax_number: oi.buyer_tax_number,
    eu_vat_number: oi.buyer_eu_vat_number,
    country: oi.buyer_country ?? "HU",
    zip: oi.buyer_zip,
    city: oi.buyer_city,
    address: oi.buyer_address,
    email: oi.buyer_email,
    tenant_id: tenantId,
  };

  let partnerId: string;
  if (existingId) {
    // Refresh from the newest declaration, but never blank a field the buyer
    // left empty this time — the older value is still the better record.
    await db
      .updateTable("partner")
      .set({
        ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== null && v !== "")),
        updated_at: new Date() as unknown as never,
      })
      .where("id", "=", existingId)
      .execute();
    partnerId = existingId;
  } else {
    const row = await db
      .insertInto("partner")
      .values(fields)
      .returning("id")
      .executeTakeFirstOrThrow();
    partnerId = row.id;
  }

  // BILLING RECIPIENTS. The order's buyer_email is the primary; billing_emails
  // are the accountant/office copies. Insert-if-absent: the unique indexes on
  // (partner, kind, email) and one-primary-per-kind are the real guard, so a
  // repeat call is a no-op rather than an error.
  const extras = (oi.billing_emails ?? []) as string[];
  const recipients: { email: string; primary: boolean }[] = [];
  if (oi.buyer_email) recipients.push({ email: oi.buyer_email, primary: true });
  for (const e of extras) recipients.push({ email: e, primary: false });

  for (const r of recipients) {
    await db
      .insertInto("partner_contact")
      .values({
        partner_id: partnerId,
        kind: "billing",
        email: r.email,
        // Only claim primary if this partner has none yet; the partial unique
        // index would otherwise reject the whole insert on a re-run.
        is_primary: r.primary && !(await hasPrimaryBilling(partnerId)),
      })
      .onConflict((oc) => oc.doNothing())
      .execute();
  }

  return {
    partnerId,
    billingEmails: recipients.map((r) => r.email),
    created: !existingId,
  };
}

/** Does this partner already have a primary billing contact? */
async function hasPrimaryBilling(partnerId: string): Promise<boolean> {
  const row = await db
    .selectFrom("partner_contact")
    .select("id")
    .where("partner_id", "=", partnerId)
    .where("kind", "=", "billing")
    .where("is_primary", "=", true)
    .where("active", "=", true)
    .executeTakeFirst();
  return Boolean(row);
}

/**
 * Every address an invoice must go to for a TENANT, primary first.
 *
 * Falls back to the order's declared `buyer_email` when the partner or its
 * contacts are missing (a pre-0032 payment, or an activation that stopped
 * before the partner was written). That declared address is a required checkout
 * field, so this practically cannot return empty — which is the point: an
 * invoice with nowhere to go is the failure this whole slice exists to prevent.
 */
export async function invoiceRecipientsForTenant(
  tenantId: string,
  fallbackEmail?: string | null,
): Promise<string[]> {
  const partner = await db
    .selectFrom("partner")
    .select("id")
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  const fromPartner = partner ? await billingRecipients(partner.id) : [];
  if (fromPartner.length) return fromPartner;
  return fallbackEmail ? [fallbackEmail] : [];
}

/**
 * The addresses an invoice / invoice notice / proforma must go to, primary
 * first. Falls back to an empty list — the caller decides what to do with that
 * (an invoice with nowhere to go is an operator problem, not a silent drop).
 */
export async function billingRecipients(partnerId: string): Promise<string[]> {
  const rows = await db
    .selectFrom("partner_contact")
    .select(["email", "is_primary"])
    .where("partner_id", "=", partnerId)
    .where("kind", "=", "billing")
    .where("active", "=", true)
    .orderBy("is_primary", "desc")
    .execute();
  return rows.map((r) => r.email).filter((e): e is string => Boolean(e));
}
