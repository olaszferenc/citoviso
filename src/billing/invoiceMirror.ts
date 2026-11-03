// SYSTEM INVOICE → ACCOUNTING DOCUMENT MIRROR (ADR-0414).
//
// Why this exists: measured on prod 2026-11-03, the first real paying customer's invoice
// (CITO-2026-7) was issued fine — and the console showed NOTHING. Every document surface
// (the /documents list, its CSV, the nav counter, the partner page, the partner timeline)
// reads `accounting_document` only; the payment path still writes the legacy `invoice`
// table (0031 left it there). Mirroring was chosen over a UNION in the readers: the
// readers are many (list, KPI band, aging, CSV, partner list aggregates, partner KPIs,
// timeline, nav, finance hub) and each would need the second source — one would be missed.
// The AAM cap reader (getAamYearNet) already excludes source='system' for exactly this
// mirror, so the cap cannot double-count.
//
// THE RULES (one mirror row per invoice row, keyed by accounting_document.invoice_id):
//   - issued  → active outgoing invoice, paid (the buyer paid by card before issuance);
//   - storno  → the row stays VISIBLE but as status 'draft' — not a live document, so the
//               money aggregates leave it out (a cancelled invoice is not revenue);
//   - failed  → one per payment at most: only the LATEST failed attempt is mirrored, and
//               only while the payment has no issued invoice — a 'draft' without a number
//               that tells the owner "money in, no bizonylat". Once an invoice is issued,
//               every failed mirror of the payment turns 'void' (hidden);
//   - cancelled → void.
// Idempotent: run it again and it converges on the same rows (the backfill script and
// the live path share mirrorInvoicesForPayment).
//
// Internal accounting rows — no buyer-facing text (outside the §B.18 i18n scope).

import { sql } from "kysely";
import { config } from "../config.js";
import { db } from "../db/client.js";

/** The legal entity system invoices are booked under: code MAIN (the one the console's
 *  one-click bootstrap creates from LEGAL_ENTITY_*). Created here the same way when the
 *  table has none (prod had 0 entities on 2026-11-03). Null = no entity and no config. */
export async function systemLegalEntityId(): Promise<string | null> {
  const main = await db.selectFrom("legal_entity").select("id").where("code", "=", "MAIN").executeTakeFirst();
  if (main) return main.id;
  const le = config.legalEntity;
  if (!le.name) return null;
  await db
    .insertInto("legal_entity")
    .values({
      code: "MAIN",
      name: le.name,
      address: le.address || null,
      registration_no: le.regNumber || null,
      tax_number: le.taxNumber || null,
      country: "HU",
      default_vat_key: "AAM",
    })
    .onConflict((oc) => oc.column("code").doNothing())
    .execute();
  const row = await db.selectFrom("legal_entity").select("id").where("code", "=", "MAIN").executeTakeFirst();
  return row?.id ?? null;
}

/** What one invoice row becomes. Pure — the guard tests it without a database. */
export interface MirrorPlanInput {
  readonly status: "issued" | "failed" | "storno" | "cancelled";
  /** This is the payment's newest failed attempt. */
  readonly latestFailed: boolean;
  /** The payment already has an issued (or storno-ed) invoice. */
  readonly paymentHasDocument: boolean;
}

export function mirrorStatusFor(i: MirrorPlanInput): "active" | "draft" | "void" {
  if (i.status === "issued") return "active";
  if (i.status === "storno") return "draft";
  if (i.status === "failed") return i.latestFailed && !i.paymentHasDocument ? "draft" : "void";
  return "void";
}

/** The note a mirrored row carries — the owner reads it on the document. */
export function mirrorNoteFor(status: MirrorPlanInput["status"], error: string | null): string {
  if (status === "storno") return "Rendszer-számla (Számlázz.hu) — SZTORNÓZVA, nem bevétel.";
  if (status === "failed")
    return `Rendszer-számlázás SIKERTELEN — a vevő fizetett, a számla nem készült el. Ok: ${error ?? "ismeretlen"}`;
  if (status === "cancelled") return "Rendszer-számla — visszavonva.";
  return "Rendszer-számla (Számlázz.hu), a fizetés után automatikusan kiállítva.";
}

/** Budapest calendar day of a timestamp as a UTC-midnight Date (the column is `date`). */
function budapestDay(at: Date): Date {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Budapest" }).format(at);
  return new Date(`${day}T00:00:00Z`);
}

/** The partner of the payment's buyer: the partner row of the order's tenant. */
async function partnerForPayment(paymentId: string): Promise<string | null> {
  const row = await db
    .selectFrom("payment")
    .innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
    .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .leftJoin("tenant", "tenant.lead_id", "prospect.lead_id")
    .select(["order_intent.tenant_id as oiTenant", "tenant.id as leadTenant"])
    .where("payment.id", "=", paymentId)
    .executeTakeFirst();
  const tenantId = row?.oiTenant ?? row?.leadTenant ?? null;
  if (!tenantId) return null;
  const p = await db
    .selectFrom("partner")
    .select("id")
    .where("tenant_id", "=", tenantId)
    .orderBy("created_at", "asc")
    .executeTakeFirst();
  return p?.id ?? null;
}

export interface MirrorResult {
  readonly inserted: number;
  readonly updated: number;
  readonly skipped: string | null;
}

/**
 * Bring the mirror rows of ONE payment in line with its invoice rows. It may throw: the
 * payment path wraps it (a mirror failure must never fail a payment, but it is logged
 * loudly there), and the backfill script reports it per payment.
 */
export async function mirrorInvoicesForPayment(paymentId: string): Promise<MirrorResult> {
  const invoices = await db
    .selectFrom("invoice")
    .select([
      "id",
      "invoice_number",
      "status",
      "net",
      "gross",
      "currency",
      "issued_at",
      "fulfillment_date",
      "due_date",
      "vat_treatment",
      "vat_key",
      "provider",
      "error",
    ])
    .where("payment_id", "=", paymentId)
    .orderBy("issued_at", "asc")
    .orderBy("id", "asc")
    .execute();
  if (!invoices.length) return { inserted: 0, updated: 0, skipped: null };
  const entityId = await systemLegalEntityId();
  if (!entityId) {
    const why =
      "nincs MAIN jogi entitás és a LEGAL_ENTITY_NAME sincs beállítva — a rendszer-számla NEM került a Bizonylatok közé";
    console.error(`[invoice-mirror] ⛔ ${paymentId}: ${why}`);
    return { inserted: 0, updated: 0, skipped: why };
  }
  const partnerId = await partnerForPayment(paymentId);
  const pay = await db.selectFrom("payment").select(["paid_at"]).where("id", "=", paymentId).executeTakeFirst();
  const paymentHasDocument = invoices.some((i) => i.status === "issued" || i.status === "storno");
  const failed = invoices.filter((i) => i.status === "failed");
  const latestFailedId = failed.length ? failed[failed.length - 1]!.id : null;

  let inserted = 0;
  let updated = 0;
  for (const inv of invoices) {
    const status = mirrorStatusFor({
      status: inv.status,
      latestFailed: inv.id === latestFailedId,
      paymentHasDocument,
    });
    const issuedAt = new Date(inv.issued_at as unknown as string);
    const paidAt = pay?.paid_at ? new Date(pay.paid_at as unknown as string) : issuedAt;
    const fields = {
      partner_id: partnerId,
      document_number: inv.status === "failed" ? null : inv.invoice_number,
      issue_date: budapestDay(issuedAt),
      fulfillment_date: inv.fulfillment_date ? new Date(inv.fulfillment_date as unknown as string) : null,
      due_date: inv.due_date ? new Date(inv.due_date as unknown as string) : null,
      net: String(inv.net),
      vat: String(Number(inv.gross) - Number(inv.net)),
      gross: String(inv.gross),
      currency: inv.currency,
      vat_treatment: inv.vat_treatment === "reverse_charge" ? "TAM" : inv.vat_key,
      paid: true,
      paid_at: paidAt,
      provider: inv.provider,
      provider_ref: inv.invoice_number,
      payment_id: paymentId,
      status,
      note: mirrorNoteFor(inv.status, inv.error),
    } as const;

    const existing = await db
      .selectFrom("accounting_document")
      .select("id")
      .where("invoice_id", "=", inv.id)
      .executeTakeFirst();
    if (existing) {
      await db
        .updateTable("accounting_document")
        .set({ ...fields, updated_at: sql`now()` as never })
        .where("id", "=", existing.id)
        .execute();
      updated++;
      continue;
    }
    // A void-to-be row that never had a mirror needs none (older failed attempts).
    if (status === "void") continue;
    for (let attempt = 0; ; attempt++) {
      try {
        await db
          .insertInto("accounting_document")
          .values({
            ...fields,
            legal_entity_id: entityId,
            internal_no: sql<number>`(select coalesce(max(internal_no), 0) + 1 from accounting_document where legal_entity_id = ${entityId})`,
            direction: "outgoing",
            doc_type: "invoice",
            source: "system",
            invoice_id: inv.id,
          })
          .execute();
        inserted++;
        break;
      } catch (err) {
        const code = (err as { code?: string; constraint?: string }).code;
        const constraint = (err as { constraint?: string }).constraint;
        // A concurrent mirror of the SAME invoice won the race — it is there now.
        if (code === "23505" && constraint === "accdoc_invoice_uniq") break;
        // internal_no race with another writer → take the next number.
        if (code === "23505" && attempt < 4) continue;
        throw err;
      }
    }
  }
  return { inserted, updated, skipped: null };
}

/** Every payment that has an invoice row — the backfill walks these. */
export async function paymentsWithInvoices(): Promise<string[]> {
  const rows = await db.selectFrom("invoice").select("payment_id").distinct().execute();
  return rows.map((r) => r.payment_id);
}
