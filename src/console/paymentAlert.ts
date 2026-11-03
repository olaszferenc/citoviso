// PAYMENT-ARRIVED ALERT — the owner hears about EVERY successful payment (ADR-XXXX).
//
// Why this exists: measured on prod 2026-11-03, the first real paying customer (Duna Vibe
// House) went through the whole path — payment, activation, invoice CITO-2026-7, domain
// order — and the owner heard NOTHING. Every alert of the house fires on a failure
// (payLinkAlert, houseAlert, registryConfirmWatch, trial/watch); a success was silent.
//
// WHAT GOES OUT: one mail + one SMS per paid payment, on the existing alert channel
// (alertHouse → getAlertRecipients: app_setting alert_email / alert_phone). The SMS
// therefore rides the house SMS filter: live host only, quiet hours (ADR-0374/0376: at
// night it waits for the morning digest), hourly cap. The first purchase of a customer
// (order kind 'initial') is marked „ÚJ VEVŐ”.
//
// ONCE PER PAYMENT: a payment_alert row is the claim — whoever inserts it sends. The
// gateway callback repeats and /pay/done re-drives the same path; the second run stops
// at the INSERT, not on the owner's phone.
//
// RENEWALS GO IN A DAILY DIGEST (decision, ADR-XXXX): every subscriber renews monthly, so
// with N customers the per-payment alert would be N texts a month landing in bursts on
// the anchor days — routine money the owner cannot act on. The FIRST purchase, an
// upsell, a domain or a one-time purchase is news and goes at once; renewals are listed
// in ONE mail + ONE SMS a day (flushRenewalPaymentDigest, hourly tick, after 18:00
// Budapest). A failed renewal invoice still alerts at once — that is houseAlert's
// invoice-failure path, untouched.
//
// NEVER FAILS THE PAYMENT: everything here is caught and logged loudly (the
// orderMail.ts / payLinkAlert.ts pattern). The caller awaits it only for ordering.
//
// Internal operator text — outside the §B.18 customer-facing i18n scope.

import { sql } from "kysely";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { budapestIsoDay, budapestMinutes } from "../text/budapestTime.js";
import { formatMoney } from "../text/money.js";
import { alertHouse, asciiFold } from "./houseAlert.js";
import { isLiveHost } from "../invoicing/keyGuard.js";

/** What the invoice step answered — passed in (no import of payment/service: no cycle). */
export type PaymentAlertInvoice =
  | { readonly status: "issued" | "already-issued"; readonly invoiceNumber: string | null }
  | { readonly status: "failed"; readonly error: string }
  | { readonly status: "none" };

/** The facts the alert is built from — loaded from the DB, or handed in by the guard. */
export interface PaymentAlertFacts {
  readonly paymentId: string;
  readonly kind: string;
  readonly amount: number;
  readonly currency: string;
  readonly period: "monthly" | "annual";
  readonly siteName: string | null;
  readonly buyerName: string | null;
  readonly buyerEmail: string | null;
  /** Billing period covered, YYYY-MM-DD (Budapest days); null when one-time. */
  readonly periodStart: string | null;
  readonly periodEnd: string | null;
  readonly domainType: string | null;
  readonly domainName: string | null;
  /** domain_provisioning.status of the order (or the tenant's latest), if any. */
  readonly domainStatus: string | null;
  readonly leadId: string | null;
  readonly partnerId: string | null;
}

const KIND_LABEL: Record<string, string> = {
  initial: "első rendelés",
  upsell: "bővítés (modul)",
  renewal: "megújítás",
  multilang: "többnyelvű oldal (egyszeri)",
  domain_upgrade: "saját domain utólag",
  domain_settlement: "lemondás-elszámolás",
};

const DOMAIN_STATUS_LABEL: Record<string, string> = {
  pending: "beszerzés vár",
  registering: "regisztrálás folyamatban",
  registered: "regisztrálva, beállítás folyamatban",
  dns_pending: "DNS-re vár (.hu-nál a nyilvántartó jóváhagyása)",
  tls_pending: "tanúsítványra vár",
  setup_retry: "megvéve, a beállítás újrapróbálva",
  live: "ÉL",
  failed: "HIBA — kézi rendezés kell",
};

/** One-time purchases carry no subscription period. */
function isOneTime(kind: string): boolean {
  return kind === "multilang" || kind === "domain_settlement" || kind === "domain_upgrade";
}

/** The house money format (src/text/money.ts), with plain spaces: the SMS must stay GSM-7. */
function money(amount: number, currency: string): string {
  return formatMoney(amount, currency).replace(/[\u00a0\u202f]/g, " ");
}

/** The console's absolute base for the mail links. CONSOLE_URL wins; prod had none on
 *  2026-11-03 (measured), where the console is the admin. subdomain of the public host
 *  (nginx: admin.citoviso.com → :4600) — a relative link in a mail opens nothing. */
export function consoleBase(consoleUrl = config.consoleUrl, publicBaseUrl = config.publicBaseUrl): string {
  if (consoleUrl) return consoleUrl.replace(/\/+$/, "");
  if (publicBaseUrl && isLiveHost(publicBaseUrl)) {
    try {
      return `https://admin.${new URL(publicBaseUrl).host.replace(/^www\./, "")}`;
    } catch {
      return "";
    }
  }
  return "";
}

/** „milyen időszakra” — the readout both the mail and the SMS use. */
export function periodText(f: PaymentAlertFacts): string {
  if (isOneTime(f.kind)) return "egyszeri díj";
  const cadence = f.period === "annual" ? "éves" : "havi";
  return f.periodStart && f.periodEnd ? `${cadence}, ${f.periodStart} – ${f.periodEnd}` : cadence;
}

export function invoiceText(inv: PaymentAlertInvoice): string {
  if (inv.status === "issued" || inv.status === "already-issued")
    return inv.invoiceNumber ? `${inv.invoiceNumber} (kiállítva, a vevő megkapta)` : "kiállítva";
  if (inv.status === "failed")
    return `NEM készült el — ${inv.error} (erről külön riasztás is ment; az automatikus újrapróba fut)`;
  return "nincs (ehhez a fizetéshez nem jár számla)";
}

export function domainText(f: PaymentAlertFacts): string | null {
  if (!f.domainName || f.domainType === "citoviso_sub") return null;
  if (f.domainType === "own") return `${f.domainName} — a vevő saját domainje (ő köti be)`;
  const st = f.domainStatus ? DOMAIN_STATUS_LABEL[f.domainStatus] ?? f.domainStatus : "a beszerzés most indul";
  return `${f.domainName} — ${st}`;
}

/** Mail + SMS of ONE payment. Pure — the guard checks the wording without a DB. */
export function paymentAlertMessage(
  f: PaymentAlertFacts,
  inv: PaymentAlertInvoice,
): { subject: string; text: string; sms: string } {
  const isNew = f.kind === "initial";
  const who = f.siteName ?? "ismeretlen oldal";
  const amount = money(f.amount, f.currency);
  const subject = isNew
    ? `Citoviso: ÚJ VEVŐ — ${who} fizetett (${amount})`
    : `Citoviso: fizetés beérkezett — ${who}, ${KIND_LABEL[f.kind] ?? f.kind} (${amount})`;
  const base = consoleBase();
  const links = [
    f.leadId ? `Lead-lap: ${base}/lead/${f.leadId}#ls-orders` : null,
    f.partnerId ? `Partner-adatlap: ${base}/partner/${f.partnerId}` : null,
  ].filter(Boolean);
  const dom = domainText(f);
  const text =
    (isNew ? `ÚJ VEVŐ! Megérkezett ${who} első fizetése.\n\n` : `Sikeres fizetés érkezett.\n\n`) +
    `Oldal: ${who}\n` +
    `Vevő: ${f.buyerName ?? "—"}${f.buyerEmail ? ` <${f.buyerEmail}>` : ""}\n` +
    `Fizetés: ${KIND_LABEL[f.kind] ?? f.kind}\n` +
    `Összeg: ${amount}\n` +
    `Időszak: ${periodText(f)}\n` +
    `Számla: ${invoiceText(inv)}\n` +
    (dom ? `Domain: ${dom}\n` : "") +
    `\n${links.length ? links.join("\n") : "Konzol: (nincs lead-hivatkozás)"}\n\n` +
    `Fizetés azonosító: ${f.paymentId}`;
  const invShort =
    inv.status === "failed"
      ? "Szamla NEM keszult el"
      : inv.status === "none"
        ? ""
        : `Szamla: ${inv.invoiceNumber ?? "kiallitva"}`;
  const domShort = dom ? `Domain: ${f.domainName} (${f.domainStatus ?? "indul"})` : "";
  const sms = asciiFold(
    [
      `Citoviso: ${isNew ? "UJ VEVO! " : "Fizetes: "}${who}${f.buyerName ? ` (${f.buyerName})` : ""} ${amount}, ${periodText(f)}.`,
      invShort ? `${invShort}.` : "",
      domShort ? `${domShort}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
  ).slice(0, 300);
  return { subject, text, sms };
}

/** Load the facts of one paid payment. Null when the payment is unknown. */
export async function loadPaymentAlertFacts(paymentId: string): Promise<PaymentAlertFacts | null> {
  const r = await db
    .selectFrom("payment")
    .innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
    .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .leftJoin("lead", "lead.id", "prospect.lead_id")
    .leftJoin("tenant", "tenant.lead_id", "prospect.lead_id")
    .select([
      "payment.amount as amount",
      "payment.currency as currency",
      "payment.period as period",
      "order_intent.id as orderId",
      "order_intent.kind as kind",
      "order_intent.buyer_name as buyerName",
      "order_intent.buyer_email as buyerEmail",
      "order_intent.domain_type as domainType",
      "order_intent.domain_name as domainName",
      "order_intent.renewal_period_start as rStart",
      "order_intent.renewal_period_end as rEnd",
      "order_intent.tenant_id as oiTenant",
      "tenant.id as leadTenant",
      "tenant.display_name as tenantName",
      "lead.name as leadName",
      "prospect.lead_id as leadId",
      "prospect.contact_email as contactEmail",
    ])
    .where("payment.id", "=", paymentId)
    .executeTakeFirst();
  if (!r) return null;
  const tenantId = r.oiTenant ?? r.leadTenant ?? null;
  const day = (v: unknown): string | null => (v ? budapestIsoDay(new Date(v as string)) : null);

  let periodStart = day(r.rStart);
  let periodEnd = day(r.rEnd);
  if ((!periodStart || !periodEnd) && tenantId && !isOneTime(r.kind)) {
    const sub = await db
      .selectFrom("subscription")
      .select(["current_period_start", "current_period_end"])
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    if (sub) {
      periodStart = day(sub.current_period_start);
      periodEnd = day(sub.current_period_end);
    }
  }
  const dp = await db
    .selectFrom("domain_provisioning")
    .select("status")
    .where((eb) =>
      tenantId
        ? eb.or([eb("order_intent_id", "=", r.orderId), eb("tenant_id", "=", tenantId)])
        : eb("order_intent_id", "=", r.orderId),
    )
    .orderBy(sql`order_intent_id = ${r.orderId}`, "desc")
    .orderBy("created_at", "desc")
    .executeTakeFirst();
  const partner = tenantId
    ? await db.selectFrom("partner").select("id").where("tenant_id", "=", tenantId).orderBy("created_at", "asc").executeTakeFirst()
    : undefined;
  return {
    paymentId,
    kind: r.kind,
    amount: r.amount,
    currency: r.currency,
    period: r.period,
    siteName: r.tenantName ?? r.leadName ?? null,
    buyerName: r.buyerName,
    buyerEmail: r.buyerEmail ?? r.contactEmail ?? null,
    periodStart,
    periodEnd,
    domainType: r.domainType,
    domainName: r.domainName,
    domainStatus: dp?.status ?? null,
    leadId: r.leadId,
    partnerId: partner?.id ?? null,
  };
}

/** The claim: true only for the ONE caller that inserted the payment's row. */
async function claim(paymentId: string, kind: string): Promise<boolean> {
  const row = await db
    .insertInto("payment_alert")
    .values({ payment_id: paymentId, kind })
    .onConflict((oc) => oc.column("payment_id").doNothing())
    .returning("payment_id")
    .executeTakeFirst();
  return Boolean(row);
}

export type PaymentAlertOutcome = "sent" | "digest" | "duplicate" | "unsent" | "no-payment" | "error";

/**
 * Tell the owner a payment arrived — once per payment. Never throws.
 * Renewals are only claimed here; flushRenewalPaymentDigest reports them.
 */
export async function alertPaymentSucceeded(
  paymentId: string,
  invoice: PaymentAlertInvoice,
): Promise<PaymentAlertOutcome> {
  try {
    const facts = await loadPaymentAlertFacts(paymentId);
    if (!facts) {
      console.error(`[payment-alert] ⛔ ismeretlen fizetés ${paymentId} — riasztás nem ment`);
      return "no-payment";
    }
    if (!(await claim(paymentId, facts.kind))) return "duplicate";
    if (facts.kind === "renewal") {
      console.log(`[payment-alert] megújítás ${paymentId} (${facts.siteName ?? "?"}) → a napi összesítőben megy`);
      return "digest";
    }
    const m = paymentAlertMessage(facts, invoice);
    const ok = await alertHouse({
      tag: "payment",
      sms: true,
      smsKey: `payment:${paymentId}`,
      smsText: m.sms,
      subject: m.subject,
      text: m.text,
    });
    if (!ok) {
      // alertHouse already logged why; this line names the payment that went unannounced.
      console.error(
        `[payment-alert] ⛔ a fizetés-riasztás SEM levélben, SEM SMS-ben nem ment ki — ${paymentId} ` +
          `(${facts.siteName ?? "?"}, ${money(facts.amount, facts.currency)}). A fizetés rendben van.`,
      );
      return "unsent";
    }
    await db.updateTable("payment_alert").set({ sent_at: sql<Date>`now()` }).where("payment_id", "=", paymentId).execute();
    return "sent";
  } catch (e) {
    console.error(`[payment-alert] ⛔ a fizetés-riasztás elhasalt (${paymentId}) — a fizetés rendben van:`, e);
    return "error";
  }
}

/** The digest goes at/after this Budapest hour, once a day. */
export const RENEWAL_DIGEST_HOUR = 18;

/**
 * ONE mail + ONE SMS about the renewals paid up to today's RENEWAL_DIGEST_HOUR
 * (Budapest). Called from the hourly tick; before the hour, or with nothing to
 * report, it does nothing. A renewal paid after the hour rolls into tomorrow's.
 */
export async function flushRenewalPaymentDigest(now: Date = new Date()): Promise<{ sent: boolean; count: number }> {
  const mins = budapestMinutes(now);
  if (mins < RENEWAL_DIGEST_HOUR * 60) return { sent: false, count: 0 };
  // Today's RENEWAL_DIGEST_HOUR:00 on the Budapest wall clock (DST-proof: counted back from now).
  const cutoff = new Date(now.getTime() - (mins - RENEWAL_DIGEST_HOUR * 60) * 60_000 - (now.getTime() % 60_000));
  // Claim first (atomic UPDATE … RETURNING): two ticks racing cannot both report a row.
  const claimed = await db
    .updateTable("payment_alert")
    .set({ digest_at: sql<Date>`now()` })
    .where("kind", "=", "renewal")
    .where("digest_at", "is", null)
    .where(sql<boolean>`created_at < ${cutoff}`)
    .returning("payment_id")
    .execute();
  if (!claimed.length) return { sent: false, count: 0 };
  const facts = (await Promise.all(claimed.map((c) => loadPaymentAlertFacts(c.payment_id)))).filter(
    (f): f is PaymentAlertFacts => f !== null,
  );
  const byCur = new Map<string, number>();
  for (const f of facts) byCur.set(f.currency, (byCur.get(f.currency) ?? 0) + f.amount);
  const total = [...byCur].map(([c, v]) => money(v, c)).join(" + ") || "0";
  const base = consoleBase();
  const lines = facts.map(
    (f) =>
      `- ${f.siteName ?? "?"} (${f.buyerName ?? "—"}): ${money(f.amount, f.currency)}, ${periodText(f)}` +
      (f.partnerId ? ` — ${base}/partner/${f.partnerId}` : f.leadId ? ` — ${base}/lead/${f.leadId}` : ""),
  );
  const subject = `Citoviso: napi megújítások — ${facts.length} db, ${total}`;
  const ok = await alertHouse({
    tag: "payment-digest",
    sms: true,
    smsKey: `payment-digest:${budapestIsoDay(now)}`,
    smsText: asciiFold(`Citoviso: ma ${facts.length} megujitas fizetve, osszesen ${total}. Reszletek e-mailben.`),
    subject,
    text:
      `A ma ${RENEWAL_DIGEST_HOUR}:00-ig sikeresen megújult előfizetések:\n\n${lines.join("\n")}\n\n` +
      `Összesen: ${total}\n\n` +
      `A számlák a Bizonylatok listában láthatók (forrás: rendszer-számla). Ha egy megújítás számlája ` +
      `nem készült el, arról külön riasztás ment.`,
  });
  if (!ok) {
    console.error(`[payment-alert] ⛔ a napi megújítás-összesítő NEM ment ki (${facts.length} fizetés).`);
  }
  return { sent: ok, count: facts.length };
}
