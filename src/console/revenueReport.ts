// Riport · Előfizetők fül — the data (frozen plan: assets/design-refs/console/elofizetok-riport/,
// variant A). Who pays, how much, when the next money comes, and what already came in.
//
// ⛔ The renewal amount is NOT re-implemented here. It is the minted renewal order of the next
// cycle when one exists (the truth for that cycle), otherwise the same pieces the billing tick
// prices it from: computeMonthly/computeAnnual over renewableModuleIds() + domainFeeForRenewal().
// One rule for "what will be charged" — the forecast must show the number the card will see.
//
// §B.17: nothing is estimated that is not measured. A trial's conversion rate is not known yet,
// so trials are LISTED next to the forecast, never added into it; a churn rate with no subscriber
// at the window start is "no data", not 0 %.

import { db } from "../db/client.js";
import { isTestLeadName } from "../outreach/ownerTestPhone.js";
import { ELEK_LEAD_NAME } from "../elek/park.js";
import {
  HU_PRICING_REGION,
  computeAnnual,
  computeMonthly,
  getAnnualFreeMonths,
  getCurrency,
  getModulePrice,
  loadPricing,
  pricingSnapshot,
} from "../pricing.js";
import { domainFeeForRenewal, renewableModuleIds } from "../payment/billing.js";
import { addMonths } from "../payment/subscription.js";
import { isHouseDomain, wantAutoRenew } from "../domains/domainRenewal.js";
import { budapestIsoDay } from "../text/budapestTime.js";

export const REVENUE_HORIZONS = [3, 6, 12] as const;
export type RevenueHorizon = (typeof REVENUE_HORIZONS)[number];

type SubStatus = "active" | "past_due" | "frozen" | "cancelled";

export interface RevenueSub {
  readonly tenantId: string;
  /** ADR-XXXX: the region/currency the customer pays in — every amount below is in it. */
  readonly pricingRegion: string;
  readonly currency: string;
  readonly leadId: string;
  readonly name: string;
  readonly city: string | null;
  readonly test: boolean;
  /** Preset chosen at the last configurator order; null = not recorded (pre-0087 order). */
  readonly preset: "alap" | "ajanlott" | "teljes" | "egyedi" | null;
  /** Modules the next cycle bills (renewableModuleIds — trial grants and leavers excluded). */
  readonly moduleIds: readonly string[];
  readonly period: "monthly" | "annual";
  /** What the NEXT cycle charges, domain fee included. */
  readonly cycleAmount: number;
  /** cycleAmount normalised to one month (annual ÷ 12) — the MRR share. */
  readonly monthly: number;
  /** The custom-domain fee inside cycleAmount (0 = none / package content). */
  readonly domainFee: number;
  /** The initial order's list price vs. paid price, when an offer discounted it. */
  readonly firstDiscount: { readonly list: number; readonly paid: number; readonly percent: number | null; readonly kind: string | null } | null;
  readonly lastPaid: { readonly amount: number; readonly at: Date } | null;
  readonly method: "invoice" | "token";
  readonly card: { readonly brand: string | null; readonly last4: string | null; readonly expMonth: number; readonly expYear: number } | null;
  /** current_period_end — the next renewal due date. */
  readonly next: Date;
  readonly status: SubStatus;
  readonly cancelAtEnd: boolean;
  readonly startedAt: Date;
  /** The cancellation request (cancel_at_period_end) or, once closed, the closing moment. */
  readonly cancelledAt: Date | null;
  readonly frozenAt: Date | null;
  /** Failed charge attempts on the open (unpaid) renewal order. */
  readonly failedCharges: number;
  /** Unpaid renewal orders whose cycle already started. */
  readonly owed: number;
  readonly domain: { readonly name: string; readonly expiresAt: Date | null; readonly renews: boolean; readonly cost: number | null } | null;
}

export type ChargeKind = "sure" | "est" | "end" | "out";
export type EstReason = "invoice" | "card" | "nocard" | "debt";

export interface ForecastItem {
  readonly sub: RevenueSub;
  readonly at: Date;
  /** Positive = income, negative = domain outflow, 0 = the subscription ends here. */
  readonly amount: number;
  readonly kind: ChargeKind;
  readonly reason: EstReason | null;
}

export interface ForecastMonth {
  /** `YYYY-MM` (Budapest). */
  readonly month: string;
  readonly sure: number;
  readonly est: number;
  readonly out: number;
  readonly items: readonly ForecastItem[];
}

export interface FactMonth {
  readonly month: string;
  readonly paid: number;
  readonly payments: number;
  readonly invoices: number;
  readonly invoiceFailures: number;
  readonly chargeFailures: number;
}

export interface MoveMonth {
  readonly month: string;
  readonly started: number;
  readonly cancelRequested: number;
  readonly frozen: number;
  readonly ended: number;
  readonly activeAtEnd: number;
}

export interface ModuleLine {
  /** Module id, or "base" for the base fee, or "domain" for the custom-domain fee. */
  readonly id: string;
  readonly subs: number;
  readonly monthly: number;
}

export interface RevenueReport {
  readonly horizon: RevenueHorizon;
  readonly tests: boolean;
  readonly month: string | null;
  readonly today: string;
  readonly subs: readonly RevenueSub[];
  readonly forecast: readonly ForecastMonth[];
  readonly facts: readonly FactMonth[];
  readonly moves: readonly MoveMonth[];
  readonly modules: readonly ModuleLine[];
  readonly trials: readonly { readonly name: string; readonly until: Date }[];
  readonly kpi: {
    readonly active: number;
    readonly monthlyN: number;
    readonly annualN: number;
    readonly frozen: number;
    readonly leaving: number;
    readonly renewing: number;
    readonly mrr: number;
    readonly churn: { readonly ended: number; readonly atStart: number } | null;
    readonly owed: number;
    readonly failed: number;
    /** Discount given on first payments (list − paid), over the shown subscriptions. */
    readonly discountGiven: number;
    readonly discountSubs: number;
    /** Sum of the last paid cycles, normalised to a month — against `mrr` (list). */
    readonly lastPaidMonthly: number;
  };
}

const toDate = (v: unknown): Date => (v instanceof Date ? v : new Date(String(v)));
const toDateOrNull = (v: unknown): Date | null => (v == null ? null : toDate(v));
const isTest = (name: string | null | undefined): boolean => isTestLeadName(name) || name === ELEK_LEAD_NAME;
const monthOf = (d: Date): string => budapestIsoDay(d).slice(0, 7);
export const isLive = (s: RevenueSub): boolean => s.status === "active" || s.status === "past_due";

/** The card is usable through the last day of its expiry month. */
export function cardValidOn(s: RevenueSub, d: Date): boolean {
  if (!s.card) return false;
  const m = budapestIsoDay(d).slice(0, 7);
  const exp = `${s.card.expYear}-${String(s.card.expMonth).padStart(2, "0")}`;
  return exp >= m;
}

function monthsFrom(startMonth: string, n: number): string[] {
  const out: string[] = [];
  let y = Number(startMonth.slice(0, 4));
  let m = Number(startMonth.slice(5, 7));
  for (let i = 0; i < n; i++) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

/**
 * The charges of the next `horizon` calendar months (this month first). Pure — exported for the
 * guard. Sure = stored card, valid on the charge day, subscription active and not cancelled;
 * everything else that will be asked for is an estimate, with the reason. A due date already
 * behind `now` is not forecast: that money is the outstanding debt (`owed`), not future income.
 */
export function buildForecast(subs: readonly RevenueSub[], horizon: number, now: Date): ForecastMonth[] {
  const months = monthsFrom(monthOf(now), horizon);
  const last = months[months.length - 1]!;
  const by = new Map(months.map((m) => [m, { sure: 0, est: 0, out: 0, items: [] as ForecastItem[] }]));
  const today = budapestIsoDay(now);
  for (const s of subs) {
    if (!isLive(s)) continue;
    const step = s.period === "annual" ? 12 : 1;
    for (let d = s.next; monthOf(d) <= last; d = addMonths(d, step)) {
      if (budapestIsoDay(d) < today) continue;
      const b = by.get(monthOf(d));
      if (s.cancelAtEnd) {
        b?.items.push({ sub: s, at: d, amount: 0, kind: "end", reason: null });
        break;
      }
      let kind: ChargeKind = "sure";
      let reason: EstReason | null = null;
      if (s.status === "past_due") { kind = "est"; reason = "debt"; }
      else if (s.method === "invoice") { kind = "est"; reason = "invoice"; }
      else if (!s.card) { kind = "est"; reason = "nocard"; }
      else if (!cardValidOn(s, d)) { kind = "est"; reason = "card"; }
      if (b) {
        b[kind === "sure" ? "sure" : "est"] += s.cycleAmount;
        b.items.push({ sub: s, at: d, amount: s.cycleAmount, kind, reason });
      }
    }
    // Domain renewal at the registrar: OUR cost, on the measured expiry, while we still renew it.
    if (s.domain?.renews && s.domain.expiresAt && s.domain.cost !== null) {
      for (let d = s.domain.expiresAt; monthOf(d) <= last; d = addMonths(d, 12)) {
        if (budapestIsoDay(d) < today) continue;
        const b = by.get(monthOf(d));
        if (!b) continue;
        b.out += s.domain.cost;
        b.items.push({ sub: s, at: d, amount: -s.domain.cost, kind: "out", reason: null });
      }
    }
  }
  return months.map((m) => {
    const b = by.get(m)!;
    return { month: m, sure: b.sure, est: b.est, out: b.out, items: b.items.sort((a, c) => a.at.getTime() - c.at.getTime()) };
  });
}

/** New / cancel-requested / frozen / ended per month, the last six months with any event. Pure. */
export function buildMoves(subs: readonly RevenueSub[], now: Date): MoveMonth[] {
  const keys = new Set<string>();
  for (const s of subs) {
    keys.add(monthOf(s.startedAt));
    if (s.cancelledAt) keys.add(monthOf(s.cancelledAt));
    if (s.frozenAt) keys.add(monthOf(s.frozenAt));
  }
  const cur = monthOf(now);
  const months = [...keys].filter((k) => k <= cur).sort().slice(-6);
  const nextMonthStart = (m: string): string => monthsFrom(m, 2)[1]! + "-01";
  return months.map((m) => {
    const endIso = nextMonthStart(m);
    const ended = (s: RevenueSub): boolean => s.status === "cancelled" && s.cancelledAt !== null;
    return {
      month: m,
      started: subs.filter((s) => monthOf(s.startedAt) === m).length,
      cancelRequested: subs.filter((s) => !ended(s) && s.cancelAtEnd && s.cancelledAt && monthOf(s.cancelledAt) === m).length,
      frozen: subs.filter((s) => s.frozenAt && monthOf(s.frozenAt) === m).length,
      ended: subs.filter((s) => ended(s) && monthOf(s.cancelledAt!) === m).length,
      activeAtEnd: subs.filter(
        (s) => budapestIsoDay(s.startedAt) < endIso && !(ended(s) && budapestIsoDay(s.cancelledAt!) < endIso),
      ).length,
    };
  });
}

/** Ended in the last 3 months / subscribed at its start; null = nobody at the start (no data). Pure. */
export function churn3m(subs: readonly RevenueSub[], now: Date): { ended: number; atStart: number } | null {
  const from = addMonths(now, -3);
  const endedAt = (s: RevenueSub): Date | null => (s.status === "cancelled" ? s.cancelledAt : null);
  const atStart = subs.filter((s) => s.startedAt <= from && !((endedAt(s)?.getTime() ?? Infinity) <= from.getTime())).length;
  if (!atStart) return null;
  const ended = subs.filter((s) => {
    const e = endedAt(s);
    return e !== null && e > from && e <= now && s.startedAt <= from;
  }).length;
  return { ended, atStart };
}

async function loadSubs(): Promise<{ subs: RevenueSub[]; failedPayments: { at: Date; test: boolean }[] }> {
  await loadPricing();
  const rows = await db
    .selectFrom("subscription as s")
    .innerJoin("tenant as t", "t.id", "s.tenant_id")
    .innerJoin("lead as l", "l.id", "t.lead_id")
    .select([
      "s.tenant_id as tenantId",
      "t.lead_id as leadId",
      "t.display_name as name",
      "l.name as leadName",
      "s.billing_period as period",
      "s.pending_period as pendingPeriod",
      "s.current_period_end as periodEnd",
      "s.status as status",
      "s.payment_method as method",
      "s.card_brand as cardBrand",
      "s.card_last4 as cardLast4",
      "s.card_exp_month as cardExpMonth",
      "s.card_exp_year as cardExpYear",
      "s.cancel_at_period_end as cancelAtEnd",
      "s.cancelled_at as cancelledAt",
      "s.frozen_at as frozenAt",
      "s.created_at as createdAt",
      "s.pricing_region as pricingRegion",
      "s.currency as currency",
    ])
    .execute();
  if (!rows.length) return { subs: [], failedPayments: [] };
  const tenantIds = rows.map((r) => r.tenantId);
  const leadIds = rows.map((r) => r.leadId);

  const partners = await db
    .selectFrom("partner")
    .select(["tenant_id as tenantId", "city"])
    .where("tenant_id", "in", tenantIds)
    .where("active", "=", true)
    .execute();
  const sites = await db
    .selectFrom("site")
    .select(["tenant_id as tenantId", "custom_domain as domain", "domain_expires_at as expiresAt", "domain_renew_end as renewEnd"])
    .where("tenant_id", "in", tenantIds)
    .where("custom_domain", "is not", null)
    .execute();
  const tlds = await db.selectFrom("domain_tld").select(["tld", "cost_net as cost", "cost_currency as currency"]).execute();

  // Every order of these tenants: renewals/upsells carry tenant_id, the conversion checkout only
  // its prospect (the tenant is born from its payment) — reached through the lead.
  const orders = await db
    .selectFrom("order_intent as oi")
    .leftJoin("prospect as p", "p.id", "oi.prospect_id")
    .leftJoin("offer as o", "o.id", "oi.offer_id")
    .select([
      "oi.id as id",
      "oi.kind as kind",
      "oi.tenant_id as tenantId",
      "p.lead_id as leadId",
      "oi.price as price",
      "oi.list_price as listPrice",
      "oi.preset as preset",
      "oi.renewal_period_start as renewalStart",
      "oi.created_at as createdAt",
      "o.percent as offerPercent",
      "o.kind as offerKind",
    ])
    .where("oi.status", "=", "submitted")
    .where((eb) => eb.or([eb("oi.tenant_id", "in", tenantIds), eb("p.lead_id", "in", leadIds)]))
    .orderBy("oi.created_at", "asc")
    .execute();
  const tenantOfLead = new Map(rows.map((r) => [r.leadId, r.tenantId]));
  const orderTenant = new Map(orders.map((o) => [o.id, o.tenantId ?? (o.leadId ? tenantOfLead.get(o.leadId) : undefined) ?? null]));
  const payments = orders.length
    ? await db
        .selectFrom("payment")
        .select(["order_intent_id as orderId", "amount", "status", "paid_at as paidAt", "created_at as createdAt"])
        .where("order_intent_id", "in", orders.map((o) => o.id))
        .execute()
    : [];

  const testOfTenant = new Map(rows.map((r) => [r.tenantId, isTest(r.name) || isTest(r.leadName)]));
  // A failed RENEWAL charge (token auto-charge or a manual retryCharge) — a declined card at the
  // conversion checkout is a lost sale, not a subscriber's failed payment.
  const renewalOrders = new Set(orders.filter((o) => o.kind === "renewal").map((o) => o.id));
  const failedPayments = payments
    .filter((p) => p.status === "failed" && renewalOrders.has(p.orderId))
    .map((p) => ({ at: toDate(p.createdAt), test: testOfTenant.get(orderTenant.get(p.orderId) ?? "") ?? false }));

  const now = new Date();
  const subs: RevenueSub[] = [];
  for (const r of rows) {
    const mine = orders.filter((o) => orderTenant.get(o.id) === r.tenantId);
    const paidOf = (oid: string) => payments.filter((p) => p.orderId === oid && p.status === "paid");
    const periodEnd = toDate(r.periodEnd);
    const moduleIds = await renewableModuleIds(r.tenantId);
    const period = (r.pendingPeriod ?? r.period) as "monthly" | "annual";
    const minted = mine.find((o) => o.kind === "renewal" && o.renewalStart && toDate(o.renewalStart).getTime() === periodEnd.getTime());
    const months = period === "annual" ? 12 : 1;
    const domainDue = await domainFeeForRenewal(r.tenantId, months, r.pricingRegion);
    const computed =
      (period === "annual" ? computeAnnual(moduleIds, r.pricingRegion) : computeMonthly(moduleIds, r.pricingRegion)) +
      (domainDue?.fee ?? 0);
    const cycleAmount = minted?.price ?? computed;

    const initial = mine.find((o) => o.kind === "initial");
    const firstDiscount =
      initial && initial.listPrice != null && initial.price != null && initial.listPrice > initial.price
        ? { list: initial.listPrice, paid: initial.price, percent: initial.offerPercent ?? null, kind: initial.offerKind ?? null }
        : null;
    const feePaid = mine
      .filter((o) => o.kind === "initial" || o.kind === "renewal")
      .flatMap((o) => paidOf(o.id))
      .filter((p) => p.paidAt)
      .sort((a, b) => toDate(b.paidAt).getTime() - toDate(a.paidAt).getTime())[0];
    const presetOrder = [...mine].reverse().find((o) => o.preset);

    // Unpaid renewal orders whose cycle has started = the debt; their failed attempts = the retry count.
    const open = mine.filter(
      (o) => o.kind === "renewal" && o.renewalStart && toDate(o.renewalStart) <= now && paidOf(o.id).length === 0,
    );
    const owed = r.status === "cancelled" ? 0 : open.reduce((a, o) => a + (o.price ?? 0), 0);
    const failedCharges = open.reduce((a, o) => a + payments.filter((p) => p.orderId === o.id && p.status === "failed").length, 0);

    const site = sites.find((s) => s.tenantId === r.tenantId && s.domain && !isHouseDomain(s.domain));
    let domain: RevenueSub["domain"] = null;
    if (site?.domain) {
      const tld = site.domain.slice(site.domain.lastIndexOf(".")).toLowerCase();
      const costs = tlds.filter((t) => t.tld === tld && t.cost != null && t.currency === "HUF").map((t) => t.cost!);
      const expiresAt = toDateOrNull(site.expiresAt);
      domain = {
        name: site.domain,
        expiresAt,
        renews: r.status !== "cancelled" && wantAutoRenew(expiresAt, toDateOrNull(site.renewEnd)),
        cost: costs.length ? Math.min(...costs) : null,
      };
    }

    subs.push({
      tenantId: r.tenantId,
      pricingRegion: r.pricingRegion,
      currency: r.currency,
      leadId: r.leadId,
      name: r.name,
      city: partners.find((p) => p.tenantId === r.tenantId)?.city ?? null,
      test: testOfTenant.get(r.tenantId) ?? false,
      preset: (presetOrder?.preset ?? null) as RevenueSub["preset"],
      moduleIds,
      period,
      cycleAmount,
      monthly: period === "annual" ? cycleAmount / 12 : cycleAmount,
      domainFee: minted ? 0 : (domainDue?.fee ?? 0),
      firstDiscount,
      lastPaid: feePaid ? { amount: feePaid.amount, at: toDate(feePaid.paidAt) } : null,
      method: r.method,
      card:
        r.cardExpMonth != null && r.cardExpYear != null
          ? { brand: r.cardBrand, last4: r.cardLast4, expMonth: r.cardExpMonth, expYear: r.cardExpYear }
          : null,
      next: periodEnd,
      status: r.status,
      cancelAtEnd: r.cancelAtEnd,
      startedAt: toDate(r.createdAt),
      cancelledAt: toDateOrNull(r.cancelledAt),
      frozenAt: toDateOrNull(r.frozenAt),
      failedCharges,
      owed,
      domain,
    });
  }
  return { subs, failedPayments };
}

export interface RawFacts {
  readonly paid: readonly { readonly amount: number; readonly at: Date; readonly test: boolean }[];
  readonly invoices: readonly { readonly status: string; readonly at: Date; readonly test: boolean }[];
  readonly failedCharges: readonly { readonly at: Date; readonly test: boolean }[];
}

/** Paid payments and issued / failed invoices — every kind of order counts. */
async function loadFacts(failedCharges: RawFacts["failedCharges"]): Promise<RawFacts> {
  const paid = await db
    .selectFrom("payment as pay")
    .innerJoin("order_intent as oi", "oi.id", "pay.order_intent_id")
    .leftJoin("prospect as p", "p.id", "oi.prospect_id")
    .leftJoin("lead as l", "l.id", "p.lead_id")
    .select(["pay.amount as amount", "pay.paid_at as paidAt", "l.name as leadName"])
    .where("pay.status", "=", "paid")
    .where("pay.paid_at", "is not", null)
    .execute();
  const inv = await db
    .selectFrom("invoice as i")
    .innerJoin("payment as pay", "pay.id", "i.payment_id")
    .innerJoin("order_intent as oi", "oi.id", "pay.order_intent_id")
    .leftJoin("prospect as p", "p.id", "oi.prospect_id")
    .leftJoin("lead as l", "l.id", "p.lead_id")
    .select(["i.status as status", "i.issued_at as issuedAt", "l.name as leadName"])
    .execute();
  return {
    paid: paid.map((p) => ({ amount: p.amount, at: toDate(p.paidAt), test: isTest(p.leadName) })),
    invoices: inv.map((i) => ({ status: i.status, at: toDate(i.issuedAt), test: isTest(i.leadName) })),
    failedCharges,
  };
}

/** Per Budapest month, the last six months with any money event. Pure. */
export function foldFacts(raw: RawFacts, includeTests: boolean): FactMonth[] {
  const by = new Map<string, { paid: number; payments: number; invoices: number; invoiceFailures: number; chargeFailures: number }>();
  const at = (m: string) => {
    if (!by.has(m)) by.set(m, { paid: 0, payments: 0, invoices: 0, invoiceFailures: 0, chargeFailures: 0 });
    return by.get(m)!;
  };
  const keep = (x: { test: boolean }) => includeTests || !x.test;
  for (const p of raw.paid.filter(keep)) {
    const b = at(monthOf(p.at));
    b.paid += p.amount;
    b.payments++;
  }
  for (const i of raw.invoices.filter(keep)) {
    const b = at(monthOf(i.at));
    if (i.status === "issued") b.invoices++;
    else if (i.status === "failed") b.invoiceFailures++;
  }
  for (const f of raw.failedCharges.filter(keep)) at(monthOf(f.at)).chargeFailures++;
  return [...by.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([month, v]) => ({ month, ...v }));
}

/**
 * Base fee + every billed module + the domain fee, over the renewing subscriptions (monthly).
 * ADR-XXXX: each subscription is priced in ITS OWN region; the lines sum ONE currency —
 * `currency` (the report's) — and a subscription in another currency is not added into it
 * (the per-currency report is the riport-kör's job, ADR-0437 ⑤ sorrend).
 */
function buildModules(subs: readonly RevenueSub[], currency: string): ModuleLine[] {
  const renewing = subs.filter((s) => isLive(s) && !s.cancelAtEnd && s.currency === currency);
  const f = (s: RevenueSub) => (s.period === "annual" ? (12 - getAnnualFreeMonths(s.pricingRegion)) / 12 : 1);
  const lines = new Map<string, { subs: number; monthly: number }>();
  const add = (id: string, v: number) => {
    const l = lines.get(id) ?? { subs: 0, monthly: 0 };
    l.subs++;
    l.monthly += v;
    lines.set(id, l);
  };
  for (const s of renewing) {
    const base = pricingSnapshot(s.pricingRegion).baseMonthly;
    if (base > 0) add("base", base * f(s));
    for (const id of s.moduleIds) add(id, getModulePrice(id, s.pricingRegion) * f(s));
    if (s.domainFee > 0) add("domain", s.domainFee / (s.period === "annual" ? 12 : 1));
  }
  return [...lines.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.monthly - a.monthly);
}

export interface RawTrial {
  readonly name: string;
  readonly until: Date;
}

/**
 * Everything the page shows, from loaded rows — no DB. Exported so the KB screenshot can fold a
 * sample the same way the live page folds the database (the Próba tab's foldTrialReport pattern).
 */
export function foldRevenueReport(
  all: readonly RevenueSub[],
  facts: RawFacts,
  trials: readonly RawTrial[],
  horizon: RevenueHorizon,
  includeTests: boolean,
  month: string | null,
  now: Date,
): RevenueReport {
  const subs = all.filter((s) => includeTests || !s.test);
  const forecast = buildForecast(subs, horizon, now);
  const live = subs.filter(isLive);
  const renewing = live.filter((s) => !s.cancelAtEnd);
  const withDiscount = subs.filter((s) => s.firstDiscount);
  return {
    horizon,
    tests: includeTests,
    month: month && forecast.some((f) => f.month === month) ? month : (forecast.find((f) => f.items.length)?.month ?? null),
    today: budapestIsoDay(now),
    subs,
    forecast,
    facts: foldFacts(facts, includeTests),
    moves: buildMoves(subs, now),
    // The report reads in the home market's currency until the riport-kör (ADR-0437 ⑤).
    modules: buildModules(subs, getCurrency(HU_PRICING_REGION)),
    trials: trials.filter((t) => includeTests || !isTest(t.name)),
    kpi: {
      active: live.length,
      monthlyN: live.filter((s) => s.period === "monthly").length,
      annualN: live.filter((s) => s.period === "annual").length,
      frozen: subs.filter((s) => s.status === "frozen").length,
      leaving: live.filter((s) => s.cancelAtEnd).length,
      renewing: renewing.length,
      mrr: renewing.reduce((a, s) => a + s.monthly, 0),
      churn: churn3m(subs, now),
      owed: subs.reduce((a, s) => a + s.owed, 0),
      failed: subs.reduce((a, s) => a + s.failedCharges, 0),
      discountGiven: withDiscount.reduce((a, s) => a + (s.firstDiscount!.list - s.firstDiscount!.paid), 0),
      discountSubs: withDiscount.length,
      lastPaidMonthly: renewing.reduce((a, s) => a + (s.lastPaid ? (s.period === "annual" ? s.lastPaid.amount / 12 : s.lastPaid.amount) : 0), 0),
    },
  };
}

export async function getRevenueReport(horizon: RevenueHorizon, includeTests: boolean, month: string | null): Promise<RevenueReport> {
  const { subs, failedPayments } = await loadSubs();
  const facts = await loadFacts(failedPayments);
  const trialRows = await db
    .selectFrom("free_trial as ft")
    .innerJoin("lead as l", "l.id", "ft.lead_id")
    .select(["l.name as name", "ft.trial_until as until"])
    .where("ft.status", "=", "active")
    .orderBy("ft.trial_until", "asc")
    .execute();
  const trials = trialRows.map((t) => ({ name: t.name, until: toDate(t.until) }));
  return foldRevenueReport(subs, facts, trials, horizon, includeTests, month, new Date());
}
