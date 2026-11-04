// Tenant activity + site visits — the DATA behind the partner sheet's „Aktivitás” block and
// the Riport › Tenantok tab. Frozen plan: assets/design-refs/console/tenant-aktivitas/ (1A + 2A,
// owner decision 2026-11-04).
//
// ⛔ ONLY WHAT IS ALREADY MEASURED (owner decision 2026-11-04: no click beacon, no new data
// handling, no migration in this round). Sources:
//   - tenant_activity (0117, ADR-0407): login / admin_open / save / site_view / order_open / checkout
//   - tenant_user.last_login_at — the only trace of a login before the log existed (and of a
//     password login, which the log also records)
//   - site_visit (ADR-0108): one row per served front page, bot-flagged, daily fingerprint
//   - booking_request: enquiries + booking requests (one table, no discriminator)
//   - free_trial / subscription / tenant_message(credentials): the frame (what kind of tenant, since when)
//
// ⛔ THE NUMBERS MUST BE TRUE (§B.17):
//   1. Bots never count (is_bot).
//   2. The owner's / operator's own look is not a guest: a fingerprint that arrived from the
//      tenant admin (citoviso.com) or the console (admin.citoviso.com) on a day is OURS for that
//      whole day — every view of it that day is excluded. Derived from stored data, no new
//      measurement. What this cannot see (the owner typing the address) stays in, and the block
//      says so in its footnote.
//   3. No retroactive invention: a window with no rows is 0, not an estimate.

import { sql } from "kysely";
import { db } from "../db/client.js";
import { ELEK_LEAD_NAME } from "../elek/park.js";
import { isTestLeadName } from "../outreach/ownerTestPhone.js";
import { APP_TZ, addIsoDays, isoDayIn, todayIn } from "../text/zoneTime.js";
import { sourceGroupOf, type SourceGroup } from "../analytics/referrerGroup.js";

const DAY = 86_400_000;
/** Days of the daily visitor chart in the block. */
export const CHART_DAYS = 30;

export type TenantKind = "paying" | "trial" | "lapsed" | "other";
export type TenantVerdict = "sleeping" | "not_logged_in" | "new" | "active" | "ended" | "test";

export type OwnerEventKind =
  | "login"
  | "admin_open"
  | "save"
  | "site_view"
  | "order_open"
  | "checkout"
  | "credentials"
  | "trial_start"
  | "trial_converted"
  | "trial_lapsed"
  | "subscribed";

export interface OwnerEvent {
  readonly at: Date;
  readonly kind: OwnerEventKind;
  /** login: via · save: area · checkout: step · order_open: from. */
  readonly detail: string | null;
}

export interface SourceCount {
  readonly group: SourceGroup;
  readonly views: number;
}

export interface TenantActivity {
  readonly tenantId: string;
  readonly partnerId: string | null;
  readonly name: string;
  readonly isTest: boolean;
  readonly kind: TenantKind;
  readonly createdAt: Date;
  /** Trial: its start and last day; null otherwise. */
  readonly trialStartedAt: Date | null;
  readonly trialUntil: Date | null;
  /** Whole days since the tenant's frame started (trial start / tenant creation). */
  readonly ageDays: number;
  readonly hosts: readonly string[];
  readonly owner: {
    readonly logins7: number;
    readonly logins30: number;
    readonly lastLoginAt: Date | null;
    readonly lastSave: { readonly at: Date; readonly area: string | null } | null;
    readonly siteViews30: number;
    /** Latest life sign: login or save. */
    readonly lastLifeAt: Date | null;
    /** Newest first, at most EVENT_LIMIT. */
    readonly events: readonly OwnerEvent[];
  };
  readonly visitors: {
    /** Distinct (fingerprint, day) pairs, bots and own looks excluded. */
    readonly v7: number;
    readonly v30: number;
    readonly views30: number;
    /** Front-page views excluded as the owner's / operator's own look (30 days). */
    readonly ownViews30: number;
    /** Visitors per Budapest day, oldest first, CHART_DAYS long, ending today. */
    readonly daily: readonly { readonly day: string; readonly n: number }[];
    /** 30-day views by source group, biggest first. */
    readonly sources: readonly SourceCount[];
    readonly mainSource: SourceGroup | null;
    /** Share of mobile views (0–100), null without views. */
    readonly mobilePct: number | null;
  };
  readonly enquiries30: number;
  readonly verdict: TenantVerdict;
}

const EVENT_LIMIT = 6;
/** An admin_open within this long after a login is the same visit — not listed twice. */
const ADMIN_OPEN_AFTER_LOGIN_MS = 10 * 60_000;
const SLEEP_PAYING_DAYS = 14;
const SLEEP_TRIAL_DAYS = 5;
const FRESH_DAYS = 3;

const toDate = (v: unknown): Date => (v instanceof Date ? v : new Date(String(v)));
const maxDate = (...ds: (Date | null | undefined)[]): Date | null =>
  ds.reduce<Date | null>((m, d) => (d && (!m || d > m) ? d : m), null);

export const isTestTenant = (name: string, leadName: string | null): boolean =>
  isTestLeadName(name) || isTestLeadName(leadName) || leadName === ELEK_LEAD_NAME;

/** The verdict rule (frozen plan README, „Alvó”). Pure — the self-check pins it. */
export function verdictOf(input: {
  readonly isTest: boolean;
  readonly kind: TenantKind;
  readonly ageDays: number;
  readonly everLoggedIn: boolean;
  readonly lastLifeAt: Date | null;
  readonly now: Date;
}): TenantVerdict {
  if (input.isTest) return "test";
  if (input.kind === "lapsed" || input.kind === "other") return "ended";
  if (!input.everLoggedIn) return input.ageDays < FRESH_DAYS ? "not_logged_in" : "sleeping";
  if (input.ageDays < FRESH_DAYS) return "new";
  const quietDays = input.lastLifeAt ? (input.now.getTime() - input.lastLifeAt.getTime()) / DAY : Infinity;
  const limit = input.kind === "trial" ? SLEEP_TRIAL_DAYS : SLEEP_PAYING_DAYS;
  return quietDays > limit ? "sleeping" : "active";
}

export interface VisitRow {
  readonly occurred_at: Date | string;
  readonly host: string;
  readonly referrer: string | null;
  readonly device: string;
  readonly visitor_hash: string;
}

/**
 * The guest figures from a tenant's NON-BOT site_visit rows (pure — the check pins it with
 * the measured Duna / Sáma rows). A fingerprint referred from the tenant admin or the console
 * on a day is the owner / us for that whole day: none of its views that day counts.
 */
export function summarizeVisits(rows: readonly VisitRow[], hosts: readonly string[], now: Date): TenantActivity["visitors"] {
  const since30 = new Date(now.getTime() - 30 * DAY);
  const since7 = new Date(now.getTime() - 7 * DAY);
  const chartFirstDay = addIsoDays(todayIn(APP_TZ, now), -(CHART_DAYS - 1));
  const keyOf = (x: VisitRow): string => `${x.visitor_hash}|${isoDayIn(toDate(x.occurred_at), APP_TZ)}`;
  const own = new Set(rows.filter((x) => sourceGroupOf(x.referrer) === "ours").map(keyOf));
  const guest = rows.filter((x) => !own.has(keyOf(x)));
  const inWin = (x: VisitRow, since: Date): boolean => toDate(x.occurred_at) >= since;
  const uniq = (xs: readonly VisitRow[]): number => new Set(xs.map(keyOf)).size;
  const g30 = guest.filter((x) => inWin(x, since30));
  const perDay = new Map<string, Set<string>>();
  for (const x of guest) {
    const day = isoDayIn(toDate(x.occurred_at), APP_TZ);
    perDay.set(day, (perDay.get(day) ?? new Set()).add(x.visitor_hash));
  }
  const daily = Array.from({ length: CHART_DAYS }, (_, i) => {
    const day = addIsoDays(chartFirstDay, i);
    return { day, n: perDay.get(day)?.size ?? 0 };
  });
  const srcCount = new Map<SourceGroup, number>();
  for (const x of g30) {
    const g = sourceGroupOf(x.referrer, hosts.concat(x.host));
    srcCount.set(g, (srcCount.get(g) ?? 0) + 1);
  }
  const sources = [...srcCount.entries()].map(([group, views]) => ({ group, views })).sort((a, b) => b.views - a.views);
  return {
    v7: uniq(guest.filter((x) => inWin(x, since7))),
    v30: uniq(g30),
    views30: g30.length,
    ownViews30: rows.filter((x) => inWin(x, since30)).length - g30.length,
    daily,
    sources,
    // The main source is where guests come FROM — navigation inside the site is not a source.
    mainSource: sources.find((s) => s.group !== "self")?.group ?? null,
    mobilePct: g30.length ? Math.round((g30.filter((x) => x.device === "mobile").length / g30.length) * 100) : null,
  };
}

/**
 * The activity of the given tenants (all tenants when `only` is omitted). One pass of a
 * handful of set queries — the report lists every tenant in one row, so this must not be N+1.
 */
export async function getTenantActivities(only?: readonly string[], now = new Date()): Promise<TenantActivity[]> {
  if (only && only.length === 0) return [];
  const since30 = new Date(now.getTime() - 30 * DAY);
  const since7 = new Date(now.getTime() - 7 * DAY);
  // The chart's first Budapest day — the visit window must reach back to its midnight.
  const today = todayIn(APP_TZ, now);
  const chartFirstDay = addIsoDays(today, -(CHART_DAYS - 1));
  const visitSince = new Date(Math.min(since30.getTime(), new Date(`${chartFirstDay}T00:00:00Z`).getTime() - DAY));

  let tq = db
    .selectFrom("tenant")
    .innerJoin("lead", "lead.id", "tenant.lead_id")
    .select(["tenant.id as id", "tenant.display_name as name", "tenant.created_at as createdAt", "lead.name as leadName"]);
  if (only) tq = tq.where("tenant.id", "in", only);
  const tenants = await tq.execute();
  if (!tenants.length) return [];
  const ids = tenants.map((t) => t.id);

  const [partners, sites, trials, subs, users, acts, creds, visits, enquiries] = await Promise.all([
    db.selectFrom("partner").select(["id", "tenant_id"]).where("tenant_id", "in", ids).execute(),
    db.selectFrom("site").select(["id", "tenant_id", "slug", "custom_domain"]).where("tenant_id", "in", ids).execute(),
    db
      .selectFrom("free_trial")
      .select(["tenant_id", "status", "started_at", "trial_until", "converted_at", "lapsed_at"])
      .where("tenant_id", "in", ids)
      .orderBy("started_at", "desc")
      .execute(),
    db
      .selectFrom("subscription")
      .select(["tenant_id", "status", "created_at"])
      .where("tenant_id", "in", ids)
      .orderBy("created_at", "desc")
      .execute(),
    db.selectFrom("tenant_user").select(["tenant_id", "last_login_at"]).where("tenant_id", "in", ids).execute(),
    db
      .selectFrom("tenant_activity")
      .select(["tenant_id", "kind", "detail", "occurred_at"])
      .where("tenant_id", "in", ids)
      .orderBy("occurred_at", "desc")
      .execute(),
    db
      .selectFrom("tenant_message")
      .select(["tenant_id", "sent_at"])
      .where("tenant_id", "in", ids)
      .where("kind", "=", "credentials")
      .execute(),
    db
      .selectFrom("site_visit")
      // occurred_at is Generated<Timestamp> in the schema (a nested ColumnType Kysely does not unwrap).
      .select(["tenant_id", sql<Date>`site_visit.occurred_at`.as("occurred_at"), "host", "referrer", "device", "visitor_hash"])
      .where("tenant_id", "in", ids)
      .where("is_bot", "=", false)
      .where(sql<boolean>`site_visit.occurred_at >= ${visitSince}`)
      .execute(),
    db
      .selectFrom("booking_request")
      .innerJoin("site", "site.id", "booking_request.site_id")
      .select(["site.tenant_id as tenantId"])
      .where("site.tenant_id", "in", ids)
      .where(sql<boolean>`booking_request.created_at >= ${since30}`)
      .execute(),
  ]);

  const group = <T, K>(rows: readonly T[], key: (r: T) => K): Map<K, T[]> => {
    const m = new Map<K, T[]>();
    for (const r of rows) m.set(key(r), [...(m.get(key(r)) ?? []), r]);
    return m;
  };
  const sitesBy = group(sites, (s) => s.tenant_id);
  const trialsBy = group(trials, (t) => t.tenant_id);
  const subsBy = group(subs, (s) => s.tenant_id);
  const usersBy = group(users, (u) => u.tenant_id);
  const actsBy = group(acts, (a) => a.tenant_id);
  const credsBy = group(creds, (c) => c.tenant_id);
  const visitsBy = group(visits, (v) => v.tenant_id);
  const enqBy = group(enquiries, (e) => e.tenantId);
  const partnerOf = new Map(partners.map((p) => [p.tenant_id, p.id]));

  return tenants.map((t): TenantActivity => {
    const isTest = isTestTenant(t.name, t.leadName);
    const createdAt = toDate(t.createdAt);
    const trial = trialsBy.get(t.id)?.[0] ?? null;
    const sub = subsBy.get(t.id)?.[0] ?? null;
    const paying = !!sub && sub.status !== "cancelled";
    const kind: TenantKind = paying
      ? "paying"
      : trial?.status === "active"
        ? "trial"
        : trial || sub
          ? "lapsed"
          : "other";
    const frameStart = kind === "trial" && trial ? toDate(trial.started_at) : createdAt;
    const ageDays = Math.max(0, Math.floor((now.getTime() - frameStart.getTime()) / DAY));
    const hosts = (sitesBy.get(t.id) ?? []).flatMap((s) => [s.slug ? `${s.slug}.citoviso.com` : null, s.custom_domain]).filter((h): h is string => !!h);

    // ── owner side ──
    const a = actsBy.get(t.id) ?? [];
    const logins = a.filter((x) => x.kind === "login").map((x) => toDate(x.occurred_at));
    const saves = a.filter((x) => x.kind === "save");
    const userLast = maxDate(...(usersBy.get(t.id) ?? []).map((u) => (u.last_login_at ? toDate(u.last_login_at) : null)));
    const lastLoginAt = maxDate(logins[0], userLast);
    const lastSaveRow = saves[0] ?? null;
    const lastSave = lastSaveRow
      ? { at: toDate(lastSaveRow.occurred_at), area: typeof lastSaveRow.detail?.area === "string" ? lastSaveRow.detail.area : null }
      : null;
    const events: OwnerEvent[] = [];
    for (const x of a) {
      const at = toDate(x.occurred_at);
      if (x.kind === "admin_open" && logins.some((l) => at.getTime() - l.getTime() >= 0 && at.getTime() - l.getTime() < ADMIN_OPEN_AFTER_LOGIN_MS)) continue;
      const d = x.detail ?? {};
      const detail = [d.via, d.area, d.step, d.from].find((v): v is string => typeof v === "string") ?? null;
      events.push({ at, kind: x.kind as OwnerEventKind, detail });
    }
    if (userLast && !logins.some((l) => Math.abs(l.getTime() - userLast.getTime()) < 60_000))
      events.push({ at: userLast, kind: "login", detail: null });
    for (const c of credsBy.get(t.id) ?? []) events.push({ at: toDate(c.sent_at), kind: "credentials", detail: null });
    if (trial) {
      events.push({ at: toDate(trial.started_at), kind: "trial_start", detail: null });
      if (trial.converted_at) events.push({ at: toDate(trial.converted_at), kind: "trial_converted", detail: null });
      if (trial.lapsed_at) events.push({ at: toDate(trial.lapsed_at), kind: "trial_lapsed", detail: null });
    }
    if (sub && !trial?.converted_at) events.push({ at: toDate(sub.created_at), kind: "subscribed", detail: null });
    events.sort((x, y) => y.at.getTime() - x.at.getTime());

    // ── visitor side ──
    const visitors = summarizeVisits(visitsBy.get(t.id) ?? [], hosts, now);

    return {
      tenantId: t.id,
      partnerId: partnerOf.get(t.id) ?? null,
      name: t.name,
      isTest,
      kind,
      createdAt,
      trialStartedAt: trial ? toDate(trial.started_at) : null,
      trialUntil: trial ? toDate(trial.trial_until) : null,
      ageDays,
      hosts,
      owner: {
        logins7: logins.filter((l) => l >= since7).length,
        logins30: logins.filter((l) => l >= since30).length,
        lastLoginAt,
        lastSave,
        siteViews30: a.filter((x) => x.kind === "site_view" && toDate(x.occurred_at) >= since30).length,
        lastLifeAt: maxDate(lastLoginAt, lastSave?.at),
        events: events.slice(0, EVENT_LIMIT),
      },
      visitors,
      enquiries30: enqBy.get(t.id)?.length ?? 0,
      verdict: verdictOf({ isTest, kind, ageDays, everLoggedIn: !!lastLoginAt, lastLifeAt: maxDate(lastLoginAt, lastSave?.at), now }),
    };
  });
}

/** One tenant's activity (the partner sheet's block), or null for an unknown tenant. */
export async function getTenantActivity(tenantId: string, now = new Date()): Promise<TenantActivity | null> {
  return (await getTenantActivities([tenantId], now))[0] ?? null;
}
