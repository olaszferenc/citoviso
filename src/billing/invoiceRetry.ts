// FAILED INVOICE → RE-ISSUE (ADR-0283).
//
// Measured on prod 2026-09-30: the 100 Ft test purchase was paid, the Számlázz call
// answered „error 378: … össze kell kötnöd fiókodat a NAV Online Számla rendszerével”,
// and issueInvoiceFor wrote a 'failed' row. Nothing ever looked at that row again: once
// the owner fixed the Számlázz account, the paid buyer would STILL never get the
// bizonylat. The lesson of feedback_gate_must_not_refuse_the_paying_customer: the buyer
// who paid must not be left without what they paid for because of OUR side's state.
//
// Two ways back, both through issueInvoiceFor (one issuance path, one lock, one
// provider-side idempotency key — never a second implementation):
//   ① retryFailedInvoices — the daily billing tick re-issues each failed invoice once a
//      day, at most INVOICE_AUTO_RETRY_LIMIT times; the last failure mails the house;
//   ② retryInvoice — the operator's manual re-issue (scripts/invoice-retry.mts today; the
//      console button waits for its §2b design approval).
//
// The attempt count is the number of 'failed' rows for the payment (0007 keeps one row
// per attempt) — no new column, no counter that could drift from the rows.

import { INVOICE_AUTO_RETRY_LIMIT } from "../console/houseAlert.js";
import { db } from "../db/client.js";
import { issueInvoiceFor, type InvoiceOutcome, type InvoiceTrigger } from "../payment/service.js";

/** A retry waits this long after the previous attempt — „once a day” for a daily tick. */
const RETRY_SPACING_HOURS = 20;

/**
 * Narrows a run to named payments — the guard (scripts/invoice-retry-check.mts) runs on
 * the SHARED dev DB and must never re-issue another thread's rows.
 */
export interface RetryScope {
  readonly paymentIds?: readonly string[];
}

/** Paid payments that have a failed invoice, no issued one, and a checkout declaration. */
export async function failedInvoicePayments(scope: RetryScope = {}): Promise<
  { paymentId: string; attempts: number; lastAttemptAt: Date }[]
> {
  let q = db
    .selectFrom("invoice")
    .innerJoin("payment", "payment.id", "invoice.payment_id")
    .innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
    .select(({ fn }) => [
      "invoice.payment_id as paymentId",
      fn.countAll<string>().as("attempts"),
      fn.max("invoice.issued_at").as("lastAttemptAt"),
    ])
    .where("invoice.status", "=", "failed")
    .where("payment.status", "=", "paid")
    // No declaration ⇒ a retry cannot help (the invoice is issued by hand, 0029) —
    // re-trying it daily would only add identical failed rows.
    .where("order_intent.buyer_type", "is not", null)
    .where("order_intent.buyer_name", "is not", null)
    .where(({ not, exists, selectFrom }) =>
      not(
        exists(
          selectFrom("invoice as ok")
            .select("ok.id")
            .whereRef("ok.payment_id", "=", "invoice.payment_id")
            .where("ok.status", "=", "issued"),
        ),
      ),
    )
    .groupBy("invoice.payment_id");
  if (scope.paymentIds) {
    if (!scope.paymentIds.length) return [];
    q = q.where("invoice.payment_id", "in", scope.paymentIds);
  }
  const rows = await q.execute();
  return rows.map((r) => ({
    paymentId: r.paymentId,
    attempts: Number(r.attempts),
    lastAttemptAt: new Date(r.lastAttemptAt as unknown as string | Date),
  }));
}

export interface InvoiceRetryReport {
  readonly retried: number;
  readonly issued: number;
  readonly failed: number;
  /** Failed invoices whose automatic retries are used up (the manual re-issue still works). */
  readonly exhausted: number;
}

/**
 * ① The daily tick: re-issue every failed invoice that still has automatic retries left
 * and whose last attempt is at least RETRY_SPACING_HOURS old. Sequential on purpose —
 * a handful of rows a day, and the provider is one external account.
 */
export async function retryFailedInvoices(
  now: Date = new Date(),
  scope: RetryScope = {},
): Promise<InvoiceRetryReport> {
  const cutoff = now.getTime() - RETRY_SPACING_HOURS * 3600_000;
  let retried = 0;
  let issued = 0;
  let failed = 0;
  let exhausted = 0;
  const crashed: string[] = [];
  for (const f of await failedInvoicePayments(scope)) {
    // attempts = 1 original + the automatic retries done so far.
    if (f.attempts > INVOICE_AUTO_RETRY_LIMIT) {
      exhausted++;
      continue;
    }
    if (f.lastAttemptAt.getTime() > cutoff) continue;
    retried++;
    try {
      const r = await issueInvoiceFor(f.paymentId, { trigger: "auto-retry" });
      if (r.status === "issued" || r.status === "already-issued") issued++;
      else if (r.status === "failed") failed++;
      console.log(`[invoice-retry] ${f.paymentId}: ${r.status}`);
    } catch (e) {
      // One payment's crash (e.g. the key guard refusing the provider) must not
      // starve the others — but the run must still end red (thrown below), so the
      // unit's OnFailure= mails the house (ADR-0276).
      failed++;
      crashed.push(`${f.paymentId}: ${(e as Error).message}`);
      console.error(`[invoice-retry] ${f.paymentId}: HIBA`, e);
    }
  }
  if (crashed.length) {
    throw new Error(`számla-újrapróba: ${crashed.length} fizetésnél kivétel — ${crashed.join(" | ")}`);
  }
  return { retried, issued, failed, exhausted };
}

/**
 * ② The operator re-issues one payment's invoice now. Refuses anything but a paid
 * payment — a pending or cancelled payment must never be invoiced by hand.
 */
export async function retryInvoice(
  paymentId: string,
  trigger: InvoiceTrigger = "console",
): Promise<InvoiceOutcome | { readonly status: "not-paid"; readonly paymentStatus: string }> {
  const p = await db
    .selectFrom("payment")
    .select("status")
    .where("id", "=", paymentId)
    .executeTakeFirst();
  if (!p) return { status: "no-payment" };
  if (p.status !== "paid") return { status: "not-paid", paymentStatus: p.status };
  return issueInvoiceFor(paymentId, { trigger });
}

/** The lead a payment belongs to — the console redirects back to its page. */
export async function leadIdOfPayment(paymentId: string): Promise<string | null> {
  const r = await db
    .selectFrom("payment")
    .innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
    .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .select("prospect.lead_id as leadId")
    .where("payment.id", "=", paymentId)
    .executeTakeFirst();
  return r?.leadId ?? null;
}

// Kept for the guard: the same spacing the tick uses, so a check can step past it.
export const INVOICE_RETRY_SPACING_HOURS = RETRY_SPACING_HOURS;
