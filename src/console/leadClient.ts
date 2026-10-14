// LEAD → CLIENT STATE — the operator sees that a lead is TRYING the product, PAYS for it,
// or let the trial lapse, and what bookings its live site received (ADR-XXXX; approved plan
// `assets/design-refs/console/proba-foglalas-lathato/`, owner 2026-10-14: lead page B card,
// list C badge + B filter row).
//
// Why (Elek live test 2026-10-13, O-2): a lead in a running trial read "jóváhagyva" on its
// page and in the list, the dashboard said nothing, and a booking on its live site was
// visible nowhere in the console — only /pricing printed "Most 1 próba fut".
//
// ONE vocabulary for the list and the page: the state comes from `clientKind()`, the pill
// texts from `clientPillText()` / `bookingPillText()`, so the badge under the name and the
// card on the page cannot disagree.
//
// Operator surface (console) — texts go through T() like the rest of the console.

import { sql } from "kysely";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { tenantSiteUrl } from "../domains.js";
import { bookingRef, bookingRules } from "../booking/requests.js";
import { trialDaysLeft } from "../trial/notices.js";
import { budapestIsoDay } from "../text/budapestTime.js";

export type ClientKind = "trial" | "paid" | "lapsed";
/** The list filter values (`/leads?client=…`) — the B filter row. */
export const CLIENT_FILTERS = ["trial", "booking", "paid", "lapsed"] as const;
export type ClientFilter = (typeof CLIENT_FILTERS)[number];

export type BookingStatus = "pending" | "offered" | "accepted" | "declined" | "expired" | "cancelled";

/** A pending request this old gets the "Érdemes felhívni" line (page) and the house letter (tick). */
export const BOOKING_SILENT_HOURS = 24;
/** The lapsed trial's data is deleted this many days after its end (ADR-0345). */
export const TRIAL_RETENTION_DAYS = 90;

export interface LeadBookingRow {
  readonly id: string;
  readonly ref: string;
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly nights: number;
  readonly guestName: string;
  readonly guests: number;
  readonly children: number | null;
  readonly mealPlan: string | null;
  readonly total: number | null;
  readonly currency: string | null;
  readonly status: BookingStatus;
  readonly createdAt: string;
  /** Whole hours since the request arrived (pending ones are what the operator acts on). */
  readonly ageHours: number;
}

export interface LeadClientTrial {
  readonly id: string;
  readonly status: "active" | "converted" | "lapsed" | "purged";
  readonly startedAt: string;
  /** The last trial day (Budapest), ISO yyyy-mm-dd. */
  readonly untilDay: string;
  /** Calendar days from today to the last day (0 = it ends today) — `trialDaysLeft`. */
  readonly daysLeft: number;
  /** Trial length in calendar days (start day → last day). */
  readonly lengthDays: number;
  readonly contactName: string;
  readonly contactEmail: string;
  readonly contactPhone: string | null;
  /** The continuation discount pinned at start (ADR-0354), while it is still valid. */
  readonly discountPercent: number | null;
  /** First outreach to the lead before the trial (ISO), null = the trial came without one. */
  readonly outreachAt: string | null;
}

export interface LeadClientView {
  readonly leadId: string;
  readonly kind: ClientKind | null;
  readonly trial: LeadClientTrial | null;
  readonly siteUrl: string | null;
  /** Subscription start (ISO day) for a paying tenant. */
  readonly paidSince: string | null;
  readonly billingPeriod: string | null;
  /** Newest first, at most BOOKING_LIST_MAX. */
  readonly bookings: readonly LeadBookingRow[];
  readonly bookingTotal: number;
  readonly bookingPending: number;
  /** Hours the oldest pending request is waiting, null when none is pending. */
  readonly oldestPendingHours: number | null;
  /** The site's booking expiry window (autoDeclineHours; 0 = never), null without a site. */
  readonly autoDeclineHours: number | null;
}

export const BOOKING_LIST_MAX = 10;

/**
 * The client state from its facts — ONE rule. A running trial wins (the operator's most
 * time-bound fact), then a live subscription, then a trial that ended without one.
 */
export function clientKind(trialStatus: string | null, subscriptionStatus: string | null): ClientKind | null {
  if (trialStatus === "active") return "trial";
  if (subscriptionStatus === "active" || subscriptionStatus === "past_due") return "paid";
  if (trialStatus === "lapsed" || trialStatus === "purged") return "lapsed";
  return null;
}

/** Does a lead pass a filter-row value? Pure — the list and the guard read the same rule. */
export function passesClientFilter(c: Pick<LeadClientView, "kind" | "bookingTotal"> | null | undefined, f: ClientFilter): boolean {
  if (f === "booking") return (c?.bookingTotal ?? 0) > 0;
  return c?.kind === f;
}

export function isClientFilter(v: unknown): v is ClientFilter {
  return typeof v === "string" && (CLIENT_FILTERS as readonly string[]).includes(v);
}

const hoursSince = (now: Date, t: unknown): number =>
  Math.max(0, Math.floor((now.getTime() - new Date(t as string).getTime()) / 3_600_000));
const isoDay = (t: unknown): string => budapestIsoDay(new Date(t as string));
const asDay = (v: unknown): string => (v instanceof Date ? isoDay(v) : String(v).slice(0, 10));
const dayDiff = (a: string, b: string): number => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/**
 * Client state for the given leads (all leads with a trial / tenant when `leadIds` is
 * omitted). Leads with neither a trial nor a tenant are absent from the map.
 * `withBookingList` loads the booking rows (the page); the list needs only the counts.
 */
export async function loadLeadClients(
  opts: { leadIds?: readonly string[]; withBookingList?: boolean; now?: Date } = {},
): Promise<Map<string, LeadClientView>> {
  const now = opts.now ?? new Date();
  const ids = opts.leadIds;
  if (ids && ids.length === 0) return new Map();

  let trialsQ = db
    .selectFrom("free_trial")
    .select([
      "id", "lead_id", "status", "started_at", "trial_until",
      "contact_name", "contact_email", "contact_phone", "offer_id", "coupon_offer_id",
    ]);
  if (ids) trialsQ = trialsQ.where("lead_id", "in", ids);
  let tenantsQ = db
    .selectFrom("tenant")
    .leftJoin("site", "site.tenant_id", "tenant.id")
    .leftJoin("subscription", "subscription.tenant_id", "tenant.id")
    .select([
      "tenant.id as tenantId", "tenant.lead_id as leadId",
      "site.id as siteId", "site.slug as slug", "site.custom_domain as customDomain",
      "subscription.status as subStatus", "subscription.anchor_date as anchor", "subscription.billing_period as period",
    ]);
  if (ids) tenantsQ = tenantsQ.where("tenant.lead_id", "in", ids);
  const [trials, tenants] = await Promise.all([trialsQ.execute(), tenantsQ.execute()]);

  const siteIds = tenants.map((t) => t.siteId).filter((s): s is string => !!s);
  const counts = siteIds.length
    ? await db
        .selectFrom("booking_request")
        .select([
          "site_id",
          sql<number>`count(*)::int`.as("total"),
          sql<number>`count(*) filter (where status = 'pending')::int`.as("pending"),
          sql<Date | null>`min(created_at) filter (where status = 'pending')`.as("oldestPending"),
        ])
        .where("site_id", "in", siteIds)
        .groupBy("site_id")
        .execute()
    : [];
  const countBySite = new Map(counts.map((c) => [c.site_id, c]));

  const rowsBySite = new Map<string, LeadBookingRow[]>();
  if (opts.withBookingList && siteIds.length) {
    const rows = await db
      .selectFrom("booking_request")
      .select([
        "id", "site_id", "date_from", "date_to", "guest_name", "guests", "children",
        "meal_plan", "quoted_total", "quoted_currency", "status", "created_at",
      ])
      .where("site_id", "in", siteIds)
      .orderBy("created_at", "desc")
      .execute();
    for (const r of rows) {
      const list = rowsBySite.get(r.site_id) ?? [];
      if (list.length >= BOOKING_LIST_MAX) continue;
      const from = asDay(r.date_from);
      const to = asDay(r.date_to);
      list.push({
        id: r.id,
        ref: bookingRef(r.id),
        dateFrom: from,
        dateTo: to,
        nights: dayDiff(from, to),
        guestName: r.guest_name,
        guests: Number(r.guests),
        children: r.children == null ? null : Number(r.children),
        mealPlan: r.meal_plan ?? null,
        total: r.quoted_total == null ? null : Number(r.quoted_total),
        currency: r.quoted_currency ?? null,
        status: r.status as BookingStatus,
        createdAt: new Date(r.created_at as unknown as string).toISOString(),
        ageHours: hoursSince(now, r.created_at),
      });
      rowsBySite.set(r.site_id, list);
    }
  }

  // The continuation discount: the pinned offer while valid (the same reading as trialDiscount).
  const offerIds = trials.flatMap((t) => [t.offer_id, t.coupon_offer_id]).filter((x): x is string => !!x);
  const offers = offerIds.length
    ? await db.selectFrom("offer").select(["id", "percent", "expires_at", "used_count", "max_uses"]).where("id", "in", offerIds).execute()
    : [];
  const liveOffer = new Map<string, number>();
  for (const o of offers) {
    const until = o.expires_at ? new Date(o.expires_at as unknown as string) : null;
    if (o.percent > 0 && until && until > now && Number(o.used_count ?? 0) < Number(o.max_uses ?? 1)) liveOffer.set(o.id, o.percent);
  }
  const leadIdsAll = [...new Set([...trials.map((t) => t.lead_id), ...tenants.map((t) => t.leadId)])];
  const sentRows = leadIdsAll.length
    ? await db
        .selectFrom("prospect")
        .select(["lead_id", sql<Date>`min(sent_at)`.as("first")])
        .where("lead_id", "in", leadIdsAll)
        .where("sent_at", "is not", null)
        .groupBy("lead_id")
        .execute()
    : [];
  const sentByLead = new Map(sentRows.map((s) => [s.lead_id, new Date(s.first as unknown as string).toISOString()]));

  const rulesBySite = new Map<string, number>();
  if (opts.withBookingList) {
    for (const sid of siteIds) rulesBySite.set(sid, Number((await bookingRules(sid)).autoDeclineHours ?? 48));
  }

  const out = new Map<string, LeadClientView>();
  const trialByLead = new Map(trials.map((t) => [t.lead_id, t]));
  const tenantByLead = new Map(tenants.filter((t) => t.leadId).map((t) => [t.leadId as string, t]));
  for (const leadId of leadIdsAll) {
    const t = trialByLead.get(leadId) ?? null;
    const ten = tenantByLead.get(leadId) ?? null;
    const kind = clientKind(t?.status ?? null, ten?.subStatus ?? null);
    const c = ten?.siteId ? countBySite.get(ten.siteId) : undefined;
    const startDay = t ? isoDay(t.started_at) : null;
    const untilDay = t ? isoDay(t.trial_until) : null;
    out.set(leadId, {
      leadId,
      kind,
      trial: t
        ? {
            id: t.id,
            status: t.status,
            startedAt: new Date(t.started_at as unknown as string).toISOString(),
            untilDay: untilDay!,
            daysLeft: trialDaysLeft(now, new Date(t.trial_until as unknown as string)),
            lengthDays: dayDiff(startDay!, untilDay!),
            contactName: t.contact_name,
            contactEmail: t.contact_email,
            contactPhone: t.contact_phone,
            discountPercent: (t.offer_id && liveOffer.get(t.offer_id)) || (t.coupon_offer_id && liveOffer.get(t.coupon_offer_id)) || null,
            outreachAt: sentByLead.get(leadId) ?? null,
          }
        : null,
      siteUrl: ten?.slug || ten?.customDomain ? tenantSiteUrl(config.publicSiteUrl, ten.slug ?? null, ten.customDomain ?? null) : null,
      paidSince: ten?.anchor ? asDay(ten.anchor) : null,
      billingPeriod: ten?.period ?? null,
      bookings: ten?.siteId ? rowsBySite.get(ten.siteId) ?? [] : [],
      bookingTotal: c ? Number(c.total) : 0,
      bookingPending: c ? Number(c.pending) : 0,
      oldestPendingHours: c?.oldestPending ? hoursSince(now, c.oldestPending) : null,
      autoDeclineHours: ten?.siteId ? rulesBySite.get(ten.siteId) ?? null : null,
    });
  }
  return out;
}

/** The lapsed trial's deletion day (trial end + 90 days, ADR-0345). */
export function retentionDay(untilDay: string): string {
  const d = new Date(`${untilDay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + TRIAL_RETENTION_DAYS);
  return d.toISOString().slice(0, 10);
}
