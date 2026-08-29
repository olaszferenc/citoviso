// Recurring billing (ADR-0080) — the tenant-anchored renewal loop + dunning ladder.
//
// REPLACES the order-level Slice-3 skeleton: renewals now hang off the tenant's
// ONE subscription (anchor day), every monthly module folds into one invoice, and
// non-payment walks a fixed, notified ladder instead of a silent deactivate:
//
//   T−3  pre_notice     e-mail: "megújul, ennyi lesz"
//   T    charge         renewal order + pay-link e-mail (auto-terhelés: slice ⑤)
//   T+3  reminder       e-mail + ugyanaz a pay-link
//   T+7  final_warning  e-mail + SMS: "T+10-kor felfüggesztjük"
//   T+10 freeze         site → suspended (vendégnek 503-lap), admin él, fizetés = azonnali thaw
//   T+30 cancel         subscription lezárva, site → deactivated
//
// Idempotent by dunning_event (unique per cycle+step+channel): the daily timer
// may re-run, crash and resume — a step fires once. When the timer missed days,
// only the HIGHEST due step is sent (no 4-mail burst after an outage), but the
// STATE transitions (past_due → frozen → cancelled) always catch up.
//
// `now` is injected so the whole ladder is testable (scripts/billing-cycle.ts --now=…).

import { db } from "../db/client.js";
import { getEmailSender } from "../email/sender.js";
import {
  buildFinalWarningSmsText,
  buildRenewalChargeEmail,
  buildRenewalFinalWarningEmail,
  buildRenewalPreNoticeEmail,
  buildRenewalReminderEmail,
  buildSiteFrozenEmail,
  buildSubscriptionCancelledEmail,
} from "../email/billingEmail.js";
import { langForTenant, prepareMailLang } from "../i18n/mail.js";
import { MODULE_CATALOG } from "../modules.js";
import { computeAnnual, computeMonthly, getCurrency, loadPricing } from "../pricing.js";
import { sendSms } from "../sms/sender.js";
import { invoiceRecipientsForTenant } from "../billing/partner.js";
import { chargeRenewalWithToken, requestPayment } from "./service.js";
import { addMonths, cancelSubscription } from "./subscription.js";

type DunningStep = "pre_notice" | "charge" | "reminder" | "final_warning" | "freeze" | "cancel";

/** Day offsets relative to T = current_period_end (ADR-0080 ⑤). */
const LADDER: ReadonlyArray<{ step: DunningStep; offset: number }> = [
  { step: "pre_notice", offset: -3 },
  { step: "charge", offset: 0 },
  { step: "reminder", offset: 3 },
  { step: "final_warning", offset: 7 },
  { step: "freeze", offset: 10 },
  { step: "cancel", offset: 30 },
];

const FREEZE_OFFSET = 10;
const CANCEL_OFFSET = 30;

export interface BillingCycleResult {
  readonly renewalOrders: number;
  readonly notified: number;
  readonly frozen: number;
  readonly cancelled: number;
}

/** Whole calendar days from `from` to `to` (LOCAL midnights; negative = before).
 *  Local on purpose: a Postgres `date` arrives as local midnight (UTC 22:00 the
 *  day before) — UTC floors would shift every ladder day and every printed date
 *  by one. */
function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}

/** YYYY-MM-DD from LOCAL components (see daysBetween). */
function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function toDate(v: unknown): Date {
  return new Date(v as string | number | Date);
}

/** "4 880" — thin-space grouping is locale noise in a plain mail; a space does. */
function formatAmount(n: number): string {
  return n.toLocaleString("hu-HU").replace(/ /g, " ");
}

interface SubRow {
  readonly id: string;
  readonly tenantId: string;
  readonly displayName: string;
  readonly billingPeriod: "monthly" | "annual";
  readonly periodEnd: Date;
  readonly status: "active" | "past_due" | "frozen" | "cancelled";
  readonly cancelAtPeriodEnd: boolean;
  /** ADR-0080 ④: 'token' = auto-charge first; 'invoice' = pay-link + dunning. */
  readonly paymentMethod: "invoice" | "token";
  readonly recurrenceToken: string | null;
  readonly recurrenceTraceId: string | null;
}

/**
 * The modules the NEXT period bills: active, monthly-billed, not leaving at the
 * period end. 'once' modules (ADR-0063) never renew; spine rides in the base fee.
 */
async function renewableModuleIds(tenantId: string): Promise<string[]> {
  const rows = await db
    .selectFrom("module_entitlement")
    .select(["module"])
    .where("tenant_id", "=", tenantId)
    .where("active", "=", true)
    .where("cancel_at_period_end", "=", false)
    .execute();
  return rows
    .map((r) => r.module)
    .filter((id) =>
      MODULE_CATALOG.some((m) => m.id === id && !m.spine && m.billing !== "once"),
    )
    .sort();
}

/**
 * The buyer identity a renewal order carries (0029: no invoice without a
 * declared buyer — and a renewal has no checkout form to declare on). Source of
 * truth: the last order that HAS a declaration (type, VAT treatment, VIES trail),
 * overlaid with the PARTNER record's legal name/tax/address where one exists —
 * the partner is operator-maintained and survives address changes, the order is
 * frozen at its purchase. No declaration anywhere → null, and the caller leaves
 * the invoice to manual issuing (loudly), never fabricates a buyer (ADR-0055).
 */
async function renewalBuyerBlock(
  tenantId: string,
): Promise<Record<string, unknown> | null> {
  const tpl = await db
    .selectFrom("order_intent")
    .leftJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .leftJoin("tenant", "tenant.lead_id", "prospect.lead_id")
    .select([
      "order_intent.buyer_type as buyer_type",
      "order_intent.buyer_name as buyer_name",
      "order_intent.buyer_tax_number as buyer_tax_number",
      "order_intent.buyer_eu_vat_number as buyer_eu_vat_number",
      "order_intent.buyer_country as buyer_country",
      "order_intent.buyer_zip as buyer_zip",
      "order_intent.buyer_city as buyer_city",
      "order_intent.buyer_address as buyer_address",
      "order_intent.buyer_email as buyer_email",
      "order_intent.vat_treatment as vat_treatment",
      "order_intent.buyer_vies_status as buyer_vies_status",
      "order_intent.buyer_vies_checked_at as buyer_vies_checked_at",
      "order_intent.buyer_vies_name as buyer_vies_name",
    ])
    .where((eb) =>
      eb.or([eb("order_intent.tenant_id", "=", tenantId), eb("tenant.id", "=", tenantId)]),
    )
    .where("order_intent.buyer_name", "is not", null)
    .orderBy("order_intent.created_at", "desc")
    .executeTakeFirst();
  if (!tpl) return null;

  const partner = await db
    .selectFrom("partner")
    .select(["name", "tax_number", "eu_vat_number", "country", "zip", "city", "address", "email"])
    .where("tenant_id", "=", tenantId)
    .where("active", "=", true)
    .executeTakeFirst();

  return {
    buyer_type: tpl.buyer_type,
    buyer_name: partner?.name ?? tpl.buyer_name,
    buyer_tax_number: partner?.tax_number ?? tpl.buyer_tax_number,
    buyer_eu_vat_number: partner?.eu_vat_number ?? tpl.buyer_eu_vat_number,
    buyer_country: partner?.country ?? tpl.buyer_country,
    buyer_zip: partner?.zip ?? tpl.buyer_zip,
    buyer_city: partner?.city ?? tpl.buyer_city,
    buyer_address: partner?.address ?? tpl.buyer_address,
    buyer_email: partner?.email ?? tpl.buyer_email,
    vat_treatment: tpl.vat_treatment,
    buyer_vies_status: tpl.buyer_vies_status,
    buyer_vies_checked_at: tpl.buyer_vies_checked_at,
    buyer_vies_name: tpl.buyer_vies_name,
  };
}

/**
 * Find (or create) the renewal order covering the period that starts at T.
 * Identity = (tenant, renewal_period_start): the timer may tick many times
 * within one cycle and must keep talking about the same invoice.
 *
 * Returns null when the period bills 0 — then the period simply advances
 * (a free tenant is never dunned).
 */
async function findOrCreateRenewalOrder(
  sub: SubRow,
): Promise<{ id: string; price: number } | null> {
  const periodStart = sub.periodEnd;
  const existing = await db
    .selectFrom("order_intent")
    .select(["id", "price"])
    .where("kind", "=", "renewal")
    .where("tenant_id", "=", sub.tenantId)
    .where("renewal_period_start", "=", periodStart)
    .executeTakeFirst();
  if (existing) return { id: existing.id, price: existing.price ?? 0 };

  const moduleIds = await renewableModuleIds(sub.tenantId);
  // Default region on purpose — the same convention every other price call site
  // uses today (moduleUpsell, configurator); region-scoped renewals follow the
  // pricing module when IT becomes region-complete.
  const months = sub.billingPeriod === "annual" ? 12 : 1;
  const price =
    sub.billingPeriod === "annual" ? computeAnnual(moduleIds) : computeMonthly(moduleIds);

  if (price <= 0) {
    await db
      .updateTable("subscription")
      .set({
        current_period_start: periodStart,
        current_period_end: addMonths(periodStart, months),
        updated_at: new Date() as unknown as never,
      })
      .where("id", "=", sub.id)
      .execute();
    return null;
  }

  const prospect = await db
    .selectFrom("prospect")
    .innerJoin("tenant", "tenant.lead_id", "prospect.lead_id")
    .select("prospect.id as id")
    .where("tenant.id", "=", sub.tenantId)
    .executeTakeFirst();
  if (!prospect) {
    console.error(`[billing] tenant ${sub.tenantId}: nincs prospect — renewal order nem hozható létre`);
    return null;
  }

  const buyer = await renewalBuyerBlock(sub.tenantId);
  if (!buyer) {
    console.error(
      `[billing] ${sub.displayName}: nincs vevő-nyilatkozat egyetlen orderen sem — ` +
        `a megújulási számla KÉZI kiállítást igényel (0029/ADR-0055: vevőt nem fabrikálunk)`,
    );
  }

  const row = await db
    .insertInto("order_intent")
    .values({
      prospect_id: prospect.id,
      kind: "renewal",
      tenant_id: sub.tenantId,
      modules: JSON.stringify(moduleIds),
      price,
      billing_period: sub.billingPeriod,
      status: "submitted",
      submitted_at: new Date(),
      renewal_period_start: periodStart,
      renewal_period_end: addMonths(periodStart, months),
      ...(buyer ?? {}),
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  console.log(
    `[billing] renewal order · ${sub.displayName} · ${formatAmount(price)} Ft · ${isoDate(periodStart)} →`,
  );
  return { id: row.id, price };
}

/** Has this (cycle, step, channel) already fired? */
async function stepDone(
  orderIntentId: string,
  step: DunningStep,
  channel: "email" | "sms" | "system",
): Promise<boolean> {
  const row = await db
    .selectFrom("dunning_event")
    .select("id")
    .where("order_intent_id", "=", orderIntentId)
    .where("step", "=", step)
    .where("channel", "=", channel)
    .executeTakeFirst();
  return !!row;
}

async function recordStep(
  subscriptionId: string,
  orderIntentId: string,
  step: DunningStep,
  channel: "email" | "sms" | "system",
): Promise<void> {
  await db
    .insertInto("dunning_event")
    .values({ subscription_id: subscriptionId, order_intent_id: orderIntentId, step, channel })
    .onConflict((oc) => oc.columns(["order_intent_id", "step", "channel"]).doNothing())
    .execute();
}

/** Billing-contact addresses; falls back to the tenant login contact. */
async function billingEmails(tenantId: string): Promise<string[]> {
  const fromPartner = await invoiceRecipientsForTenant(tenantId);
  if (fromPartner.length) return fromPartner;
  const user = await db
    .selectFrom("tenant_user")
    .select("contact_email")
    .where("tenant_id", "=", tenantId)
    .where("contact_email", "is not", null)
    .executeTakeFirst();
  return user?.contact_email ? [user.contact_email] : [];
}

/** Billing-contact phone for the SMS leg (partner_contact → partner). */
async function billingPhone(tenantId: string): Promise<string | null> {
  const contact = await db
    .selectFrom("partner_contact")
    .innerJoin("partner", "partner.id", "partner_contact.partner_id")
    .select("partner_contact.phone as phone")
    .where("partner.tenant_id", "=", tenantId)
    .where("partner_contact.kind", "=", "billing")
    .where("partner_contact.active", "=", true)
    .where("partner_contact.phone", "is not", null)
    .orderBy("partner_contact.is_primary", "desc")
    .executeTakeFirst();
  if (contact?.phone) return contact.phone;
  const partner = await db
    .selectFrom("partner")
    .select("phone")
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  return partner?.phone ?? null;
}

/**
 * Advance every subscription as of `now`: create due renewal orders, walk the
 * dunning ladder, freeze/cancel what ran out. Safe to re-run any number of times.
 */
export async function runBillingCycle(now: Date): Promise<BillingCycleResult> {
  await loadPricing();
  const result = { renewalOrders: 0, notified: 0, frozen: 0, cancelled: 0 };

  const subs = await db
    .selectFrom("subscription")
    .innerJoin("tenant", "tenant.id", "subscription.tenant_id")
    .select([
      "subscription.id as id",
      "subscription.tenant_id as tenantId",
      "tenant.display_name as displayName",
      "subscription.billing_period as billingPeriod",
      "subscription.current_period_end as periodEnd",
      "subscription.status as status",
      "subscription.cancel_at_period_end as cancelAtPeriodEnd",
      "subscription.payment_method as paymentMethod",
      "subscription.recurrence_token as recurrenceToken",
      "subscription.recurrence_trace_id as recurrenceTraceId",
    ])
    .where("subscription.status", "!=", "cancelled")
    .execute();

  for (const raw of subs) {
    const sub: SubRow = { ...raw, periodEnd: toDate(raw.periodEnd) } as SubRow;
    try {
      const changed = await advanceOne(sub, now, result);
      if (changed) result.notified += changed;
    } catch (err) {
      // One broken tenant must not stall everyone else's ladder.
      console.error(`[billing] ${sub.displayName} (${sub.tenantId}) HIBA:`, err);
    }
  }
  return result;
}

/** Returns how many notifications went out for this subscription (0 or 1). */
async function advanceOne(
  sub: SubRow,
  now: Date,
  result: { renewalOrders: number; frozen: number; cancelled: number },
): Promise<number> {
  const offset = daysBetween(sub.periodEnd, now);

  // The tenant asked to stop: at the period end the subscription closes without
  // any dunning — there is nothing to collect (ADR-0080 ③).
  if (sub.cancelAtPeriodEnd && offset >= 0) {
    await cancelSubscription(sub.tenantId, "tenant_cancelled");
    result.cancelled++;
    return 0;
  }

  const dueSteps = LADDER.filter((l) => offset >= l.offset);
  if (!dueSteps.length) return 0;

  const order = await findOrCreateRenewalOrder(sub);
  if (!order) return 0; // free period — advanced silently
  result.renewalOrders++;

  // ── ADR-0080 ④: token-first. At T the stored token is charged, payer absent;
  //    success advances the period (settled inside), so the ladder never starts.
  //    Failure falls through LOUDLY to the pay-link + dunning path — the token
  //    stays for the next cycle, this cycle collects by hand. One attempt per
  //    tick, and only while a charge attempt is meaningful (before freeze).
  if (
    offset >= 0 &&
    offset < FREEZE_OFFSET &&
    sub.paymentMethod === "token" &&
    sub.recurrenceToken &&
    !(await stepDone(order.id, "charge", "system"))
  ) {
    const outcome = await chargeRenewalWithToken(order.id, sub.recurrenceToken, sub.recurrenceTraceId);
    if (outcome === "paid") {
      await recordStep(sub.id, order.id, "charge", "system");
      console.log(`[billing] auto-terhelés OK · ${sub.displayName} · ${formatAmount(order.price)} Ft`);
      return 0; // the invoice e-mail is the confirmation; no dunning mail
    }
    if (outcome === "pending") {
      console.log(`[billing] auto-terhelés folyamatban (callback rendezi) · ${sub.displayName}`);
      return 0;
    }
    console.error(
      `[billing] auto-terhelés SIKERTELEN → fizetőlink + dunning erre a ciklusra · ${sub.displayName}`,
    );
  }

  // ── state transitions always catch up (independent of notifications) ──
  if (offset >= CANCEL_OFFSET) {
    if (!(await stepDone(order.id, "cancel", "system"))) {
      await cancelSubscription(sub.tenantId, "non_payment");
      await recordStep(sub.id, order.id, "cancel", "system");
      result.cancelled++;
      await notify(sub, order, "cancel", null);
    }
    return 1;
  }
  if (offset >= 0 && sub.status === "active") {
    await db
      .updateTable("subscription")
      .set({ status: "past_due", updated_at: new Date() as unknown as never })
      .where("id", "=", sub.id)
      .execute();
  }
  let frozeNow = false;
  if (offset >= FREEZE_OFFSET && sub.status !== "frozen") {
    if (!(await stepDone(order.id, "freeze", "system"))) {
      await db
        .updateTable("site")
        .set({ status: "suspended" })
        .where("tenant_id", "=", sub.tenantId)
        .where("status", "=", "live")
        .execute();
      await db
        .updateTable("subscription")
        .set({ status: "frozen", frozen_at: now, updated_at: new Date() as unknown as never })
        .where("id", "=", sub.id)
        .execute();
      await recordStep(sub.id, order.id, "freeze", "system");
      result.frozen++;
      frozeNow = true;
      console.warn(`[billing] FAGYASZTVA (T+${offset}) · ${sub.displayName}`);
    }
  }

  // ── notification: only the HIGHEST due, not-yet-sent step ──
  const highest = [...dueSteps].reverse().find((l) => l.step !== "cancel");
  if (!highest) return 0;
  // freeze already notified as part of the transition tick? No: the freeze mail
  // goes out with the transition; later ticks stay silent until 'cancel'.
  if (highest.step === "freeze" && !frozeNow) return 0;
  if (await stepDone(order.id, highest.step, "email")) return 0;

  return await notify(sub, order, highest.step, offset);
}

/** Build + send the step's e-mail (and the T+7 SMS twin); record what fired. */
async function notify(
  sub: SubRow,
  order: { id: string; price: number },
  step: DunningStep,
  offset: number | null,
): Promise<number> {
  const recipients = await billingEmails(sub.tenantId);
  if (!recipients.length) {
    console.error(
      `[billing] ${sub.displayName}: nincs értesítési cím — a(z) ${step} lépcső CSAK naplózva`,
    );
    await recordStep(sub.id, order.id, step, "system");
    return 0;
  }

  const lang = await prepareMailLang(await langForTenant(sub.tenantId));
  const amount = formatAmount(order.price);
  const currency = getCurrency();
  const months = sub.billingPeriod === "annual" ? 12 : 1;
  const dueDate = isoDate(sub.periodEnd);
  const freezeDate = isoDate(addDays(sub.periodEnd, FREEZE_OFFSET));
  const periodStart = dueDate;
  const periodEnd = isoDate(addMonths(sub.periodEnd, months));

  // Every step from 'charge' on carries the SAME pay-link (pending-reuse makes
  // requestPayment idempotent). The fulfillment gate inside requestPayment is
  // satisfied by construction: a subscription exists only for activated tenants.
  let payUrl: string | null = null;
  if (step !== "pre_notice") {
    const pay = await requestPayment(order.id);
    if (!pay) {
      console.error(`[billing] ${sub.displayName}: pay-link nem jött létre a(z) ${step} lépcsőhöz`);
      return 0;
    }
    payUrl = pay.payUrl;
  }

  const base = { siteName: sub.displayName, amount, currency, dueDate, lang };
  let sent = 0;
  for (const to of recipients) {
    const msg =
      step === "pre_notice"
        ? buildRenewalPreNoticeEmail({
            ...base,
            to,
            autoCharge: sub.paymentMethod === "token" && !!sub.recurrenceToken,
          })
        : step === "charge"
          ? buildRenewalChargeEmail({ ...base, to, payUrl: payUrl!, periodStart, periodEnd })
          : step === "reminder"
            ? buildRenewalReminderEmail({ ...base, to, payUrl: payUrl!, periodStart, periodEnd, freezeDate })
            : step === "final_warning"
              ? buildRenewalFinalWarningEmail({ ...base, to, payUrl: payUrl!, periodStart, periodEnd, freezeDate })
              : step === "freeze"
                ? buildSiteFrozenEmail({ ...base, to, payUrl: payUrl!, periodStart, periodEnd })
                : buildSubscriptionCancelledEmail({ to, siteName: sub.displayName, lang });
    await getEmailSender().send(msg);
    sent = 1;
  }
  await recordStep(sub.id, order.id, step, "email");
  console.log(
    `[billing] ${step}${offset === null ? "" : ` (T${offset >= 0 ? "+" : ""}${offset})`} → ${sub.displayName} · ${recipients.join(", ")}`,
  );

  // The T+7 warning gets the SMS twin (ADR-0080 ⑤/⑦) — a mailbox left unread is
  // exactly the case the freeze warning must survive.
  if (step === "final_warning" && payUrl && !(await stepDone(order.id, step, "sms"))) {
    const phone = await billingPhone(sub.tenantId);
    if (phone) {
      const r = await sendSms({
        to: phone,
        text: buildFinalWarningSmsText({ siteName: sub.displayName, freezeDate, payUrl, lang }),
      });
      if (r.provider !== "blocked") await recordStep(sub.id, order.id, step, "sms");
    } else {
      console.warn(`[billing] ${sub.displayName}: nincs telefonszám — az SMS-láb kimarad`);
    }
  }
  return sent;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}
