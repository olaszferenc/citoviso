// REFUND + STORNO (ADR-XXXX, owner 2026-11-26 „Végpróba”: „a visszautalás Barion refund kódból … majd sztornó
// számla. Ha erre nincs kód, az HIÁNY: megírod, nem kézzel kattintod.”).
//
// One paid payment is given back in full: the gateway refunds it to the payer's card (gateway.refund), the
// payment row says so (status 'refunded', refunded_at / refund_amount / refund_ref — migration 0159), and
// every invoice issued for it gets its storno document at the invoice provider (InvoiceProvider.stornoInvoice):
// the original row becomes 'storno' (not revenue — invoiceMirror), the storno document is its own row
// (status 'cancelled', cancels_invoice_id = the original, the negated amounts).
//
// Idempotent and resumable: an already refunded payment is not refunded again (only its missing stornos are
// made), an already reversed invoice is skipped. Every step that fails stops with the provider's reason — no
// half-written success, and never a manual click instead.
import { db } from "../db/client.js";
import { getGateway } from "./index.js";
import { getInvoiceProvider } from "../invoicing/index.js";
import { budapestIsoDay } from "../text/budapestTime.js";

export interface RefundOutcome {
  readonly paymentId: string;
  readonly refunded: "now" | "already" | "failed";
  readonly refundRef: string | null;
  readonly error: string | null;
  /** The stornos made now (original number → storno number), and the ones that failed. */
  readonly stornos: readonly { readonly original: string; readonly storno: string | null; readonly error: string | null }[];
}

/** Refund one PAID payment in full and reverse its invoices. */
export async function refundPaymentAndStorno(paymentId: string, opts: { readonly comment: string }): Promise<RefundOutcome> {
  const p = await db
    .selectFrom("payment")
    .select(["id", "status", "amount", "currency", "gateway", "gateway_ref", "refund_ref"])
    .where("id", "=", paymentId)
    .executeTakeFirst();
  if (!p) return { paymentId, refunded: "failed", refundRef: null, error: "nincs ilyen fizetés", stornos: [] };

  let refunded: RefundOutcome["refunded"] = "already";
  let refundRef = p.refund_ref;
  if (p.status !== "refunded") {
    if (p.status !== "paid") return { paymentId, refunded: "failed", refundRef: null, error: `a fizetés nem fizetett (${p.status})`, stornos: [] };
    const gw = getGateway();
    if (gw.name !== p.gateway) {
      return { paymentId, refunded: "failed", refundRef: null, error: `a fizetés a(z) ${p.gateway} kapun ment, a beállított kapu: ${gw.name}`, stornos: [] };
    }
    if (!gw.refund) return { paymentId, refunded: "failed", refundRef: null, error: `a(z) ${gw.name} kapu nem tud visszautalni`, stornos: [] };
    if (!p.gateway_ref) return { paymentId, refunded: "failed", refundRef: null, error: "a fizetésnek nincs szolgáltatói azonosítója", stornos: [] };
    const r = await gw.refund(p.gateway_ref, p.amount, p.currency, opts.comment);
    if (!r.ok) return { paymentId, refunded: "failed", refundRef: null, error: r.error, stornos: [] };
    await db
      .updateTable("payment")
      .set({ status: "refunded", refunded_at: new Date(), refund_amount: p.amount, refund_ref: r.ref } as never)
      .where("id", "=", p.id)
      .where("status", "=", "paid")
      .execute();
    refunded = "now";
    refundRef = r.ref;
  }

  const provider = getInvoiceProvider();
  const issued = await db
    .selectFrom("invoice")
    .selectAll()
    .where("payment_id", "=", p.id)
    .where("status", "=", "issued")
    .where("cancels_invoice_id", "is", null)
    .execute();
  const stornos: { original: string; storno: string | null; error: string | null }[] = [];
  for (const inv of issued) {
    const number = inv.invoice_number ?? "";
    if (!number) {
      stornos.push({ original: inv.id, storno: null, error: "a számlának nincs száma" });
      continue;
    }
    if (inv.provider !== provider.name) {
      stornos.push({ original: number, storno: null, error: `a számla a(z) ${inv.provider} számlázóban készült, a beállított: ${provider.name}` });
      continue;
    }
    if (!provider.stornoInvoice) {
      stornos.push({ original: number, storno: null, error: `a(z) ${provider.name} számlázó nem tud sztornózni` });
      continue;
    }
    try {
      const today = budapestIsoDay(new Date());
      const s = await provider.stornoInvoice(number, inv.currency, today);
      await db.transaction().execute(async (trx) => {
        await trx.updateTable("invoice").set({ status: "storno" }).where("id", "=", inv.id).execute();
        await trx
          .insertInto("invoice")
          .values({
            payment_id: inv.payment_id,
            provider: inv.provider,
            invoice_number: s.invoiceNumber,
            vat_key: inv.vat_key,
            vat_rate: inv.vat_rate,
            // The storno document negates the original; the provider's own figures when it gave them.
            net: s.net < 0 ? s.net : -inv.net,
            gross: s.gross < 0 ? s.gross : -inv.gross,
            currency: inv.currency,
            status: "cancelled",
            cancels_invoice_id: inv.id,
            pdf_base64: s.pdfBase64 ?? null,
            fulfillment_date: today,
            vat_treatment: inv.vat_treatment,
            fx_rate: inv.fx_rate,
            fx_date: inv.fx_date,
            buyer_country: inv.buyer_country,
            buyer_type: inv.buyer_type,
            buyer_eu_vat_number: inv.buyer_eu_vat_number,
          } as never)
          .execute();
      });
      stornos.push({ original: number, storno: s.invoiceNumber, error: null });
    } catch (e) {
      stornos.push({ original: number, storno: null, error: (e as Error).message });
    }
  }
  return { paymentId, refunded, refundRef, error: null, stornos };
}
