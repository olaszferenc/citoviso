// Report data layer — the ONE object the Riport pages (Tölcsér, Viselkedés) render
// from (ADR „Riport-modul", frozen plan: assets/design-refs/console/riport/README.md).
//
// Shape of the computation: the pilot is hundreds of tracked links and a few thousand
// events, so we load the sent prospects + their visits/events/orders ONCE and fold in
// TypeScript — every panel (funnel, times, cohorts, device, exit map, reasons) reads the
// same per-prospect facts, so two panels can never disagree about who "opened" or
// "paid". When the volume outgrows this (tens of thousands of links) the fold moves to
// SQL; the facts and their definitions stay as written here.
//
// Definitions (README ③) — the lap shows them under the stage names:
//   sent     = prospect.sent_at (first touch on ANY channel, ADR-0082/0122)
//   opened   = at least one mock_view (a HUMAN signal: POST /p/:token/view, ADR-0291)
//   deep     = module/preset touched OR scroll ≥ 50 % in any visit
//   ordered  = first order_intent.submitted_at
//   paid     = first payment.status='paid' — from the PAYMENT table, never prospect.status
// Only SENT links count (ADR-0139): own opens / tests on an unsent link are not interest.

import { db } from "../db/client.js";
import { partsIn, APP_TZ } from "../text/zoneTime.js";
import {
  EXIT_REASONS,
  EXPECTED_STATED,
  STATED_REASONS,
  inferExitReason,
  signalsFromEvents,
  type ExitReason,
  type RawEvent,
  type StatedReason,
} from "../analytics/exitReason.js";

export type ReportDays = 0 | 7 | 30 | 90;
export type ReportDim = "segment" | "channel" | "device" | "style" | "hour";
export const REPORT_DIMS: readonly ReportDim[] = ["segment", "channel", "device", "style", "hour"];
export const REPORT_RANGES: readonly ReportDays[] = [7, 30, 90, 0];

export type Device = "mobile" | "tablet" | "desktop" | "bot" | "unknown";
export type Channel = "email" | "sms" | "mms" | "email_sms" | "manual";

/** The mock page's sections in reading order — the exit map's rows (README ⑭). */
export const EXIT_SECTIONS = [
  "hero",
  "gallery",
  "rooms",
  "amenities",
  "reviews",
  "map",
  "panel",
  "billing",
  "payment",
] as const;
export type ExitSection = (typeof EXIT_SECTIONS)[number];

export interface Visit {
  readonly id: string;
  readonly startedAt: Date;
  readonly device: Device;
  readonly dwellSeconds: number;
  readonly maxScroll: number;
  readonly moduleTouched: boolean;
  readonly presetChanges: number;
  readonly moduleChanges: number;
  readonly panelOpened: boolean;
  /** Deepest section reached (index into EXIT_SECTIONS), -1 = none reported. */
  readonly lastSection: number;
  readonly events: readonly RawEvent[];
}

export interface ProspectFacts {
  readonly id: string;
  readonly leadName: string;
  readonly segment: string;
  readonly channel: Channel;
  readonly style: string;
  readonly sentAt: Date;
  /** Hour of the send in Budapest time (ADR-0288). */
  readonly sentHour: number;
  readonly visits: readonly Visit[];
  readonly openedAt: Date | null;
  readonly deepAt: Date | null;
  readonly orderedAt: Date | null;
  readonly paidAt: Date | null;
  readonly unsubscribedAt: Date | null;
  readonly escalationShown: boolean;
  readonly escalationCta: boolean;
  readonly escalationDismiss: boolean;
  /** The device of the FIRST visit (the one the mail/SMS was opened on). */
  readonly device: Device;
  /** The exit verdict of the LAST non-paid visit, null when paid or never opened. */
  readonly exitReason: ExitReason | null;
  readonly exitConfidence: "sure" | "medium" | null;
  readonly stated: StatedReason | null;
}

export interface StageCounts {
  readonly sent: number;
  readonly opened: number;
  readonly deep: number;
  readonly ordered: number;
  readonly paid: number;
  readonly returned: number;
  readonly unsubscribed: number;
}

export interface TimeStats {
  readonly n: number;
  /** Hours; NaN when n = 0. */
  readonly median: number;
  readonly p90: number;
}

export interface Hypothesis {
  readonly key: "open_rate" | "return_rate" | "deep_rate" | "order_rate" | "paid_rate" | "first_open_hours";
  /** Percent (0–100) or hours for first_open_hours; NaN = no data. */
  readonly value: number;
  /** The same measure over the previous, equally long window; null for "Összes". */
  readonly prevValue: number | null;
  readonly target: number;
  /** "lower" = smaller is better (hours). */
  readonly direction: "higher" | "lower";
  readonly verdict: "above" | "near" | "below" | "none";
  readonly num: number;
  readonly den: number;
  /** Six weekly values, oldest first (the sparkline). */
  readonly weekly: readonly number[];
}

export interface DimRow {
  readonly key: string;
  readonly counts: StageCounts;
}

export interface CohortRow {
  readonly weekStart: string; // ISO day (Budapest)
  readonly weekEnd: string;
  readonly sent: number;
  readonly opened7: number;
  readonly ordered14: number;
  readonly paid30: number;
  readonly firstOpenMedianHours: number;
  /** The 30-day window has not closed yet. */
  readonly open: boolean;
}

export interface DayPoint {
  readonly day: string; // ISO day (Budapest)
  readonly sent: number;
  readonly opened: number;
}

export interface ReportNote {
  readonly id: string;
  readonly day: string;
  readonly text: string;
}

export interface ReturnRow {
  readonly visits: "1" | "2" | "3+";
  readonly prospects: number;
  readonly ordered: number;
}

export interface ExitRow {
  readonly section: ExitSection;
  readonly reached: number;
  readonly exited: number;
}

export interface ReasonRow {
  readonly reason: ExitReason;
  readonly count: number;
  readonly sure: number;
}

export interface BuyerProfile {
  readonly n: number;
  readonly visitsAvg: number;
  readonly dwellMedian: number;
  readonly modulesAvg: number;
  readonly presetsAvg: number;
  readonly openToPaidMedianHours: number;
  readonly mobileShare: number;
}

export interface ReportData {
  readonly days: ReportDays;
  readonly dim: ReportDim;
  readonly now: Date;
  readonly prospects: readonly ProspectFacts[];
  readonly counts: StageCounts;
  readonly prevCounts: StageCounts | null;
  readonly times: {
    readonly sentToOpen: TimeStats;
    readonly openToDeep: TimeStats;
    readonly openToOrder: TimeStats;
    readonly orderToPaid: TimeStats;
    readonly sentToPaid: TimeStats;
    readonly prevSentToOpen: TimeStats | null;
  };
  readonly hypotheses: readonly Hypothesis[];
  readonly returns: readonly ReturnRow[];
  readonly escalation: { shown: number; cta: number; ordered: number; dismissed: number };
  readonly dims: readonly DimRow[];
  readonly cohorts: readonly CohortRow[];
  readonly timeline: readonly DayPoint[];
  readonly notes: readonly ReportNote[];
  readonly behaviour: {
    readonly openers: number;
    readonly nonBuyers: number;
    readonly dwellMedian: number;
    readonly dwellP90: number;
    readonly scrollMedian: number;
    readonly scrollBottomShare: number;
    readonly devices: readonly { device: Device; openers: number; paid: number }[];
    readonly panelReached: number;
    readonly paymentStalled: number;
    readonly statedCount: number;
    readonly exits: readonly ExitRow[];
    readonly reasons: readonly ReasonRow[];
    readonly stated: readonly { reason: StatedReason; count: number }[];
    /** stated × inferred counts for the calibration table. */
    readonly calibration: readonly { stated: StatedReason; inferred: ExitReason; count: number }[];
    readonly calibrationHits: number;
    readonly calibrationTotal: number;
    readonly fastBuyers: BuyerProfile;
    readonly deepBuyers: BuyerProfile;
    /** 7 × 17 (Mon…Sun × 07…23 h) open counts, Budapest time. */
    readonly heat: readonly (readonly number[])[];
  };
  readonly targets: Readonly<Record<Hypothesis["key"], number>>;
}

const HOUR = 3_600_000;
const DAY = 86_400_000;
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const toDate = (v: unknown): Date | null => (v == null ? null : v instanceof Date ? v : new Date(String(v)));

export function median(values: readonly number[], q = 0.5): number {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]!;
}
const timeStats = (hours: readonly number[]): TimeStats => ({ n: hours.length, median: median(hours), p90: median(hours, 0.9) });

/** Default targets (README ⑦) — overridden by report_target rows when present. */
export const DEFAULT_TARGETS: Readonly<Record<Hypothesis["key"], number>> = {
  open_rate: 40,
  return_rate: 30,
  deep_rate: 20,
  order_rate: 4,
  paid_rate: 75,
  first_open_hours: 24,
};

/** Which channel the first touch went out on (the stamps are per channel, ADR-0082). */
function channelOf(p: { email_sent_at: unknown; sms_sent_at: unknown; mms_sent_at: unknown }): Channel {
  const e = p.email_sent_at != null;
  const s = p.sms_sent_at != null;
  const m = p.mms_sent_at != null;
  if (e && (s || m)) return "email_sms";
  if (e) return "email";
  if (m) return "mms";
  if (s) return "sms";
  return "manual";
}

/** The mock's style = its skin id (`inputs.skin`, src/engine/skins.ts) — the label is the skin's. */
function styleOf(inputs: Record<string, unknown> | null | undefined): string {
  const t = inputs?.skin;
  return typeof t === "string" && t ? t : "ismeretlen";
}

const sectionIndex = (id: unknown): number => {
  const i = EXIT_SECTIONS.indexOf(String(id ?? "") as ExitSection);
  return i;
};

/** Fold one view's events into a Visit. */
function foldVisit(id: string, startedAt: Date, device: Device, events: readonly RawEvent[]): Visit {
  let dwell = 0;
  let scroll = 0;
  let presets = 0;
  let modules = 0;
  let panel = false;
  let last = -1;
  for (const e of events) {
    const pl = (e.payload ?? {}) as Record<string, unknown>;
    switch (e.type) {
      case "scroll":
        scroll = Math.max(scroll, num(pl.pct));
        break;
      case "dwell":
      case "dwell_end":
        dwell = Math.max(dwell, num(pl.seconds));
        if (e.type === "dwell_end") last = Math.max(last, sectionIndex(pl.last_section));
        break;
      case "section_seen":
        last = Math.max(last, sectionIndex(pl.id));
        break;
      case "preset_select":
        presets++;
        break;
      case "module_add":
      case "module_remove":
        modules++;
        break;
      case "panel_open":
        panel = true;
        last = Math.max(last, sectionIndex("panel"));
        break;
      case "billing_step_open":
        last = Math.max(last, sectionIndex("billing"));
        break;
      case "checkout_redirect":
        last = Math.max(last, sectionIndex("payment"));
        break;
      default:
        break;
    }
  }
  // Without section events (pre-measurement visits) the scroll depth stands in for the
  // section reached: 25 % ≈ gallery, 50 % ≈ rooms/amenities, 75 % ≈ reviews, 100 % ≈ map.
  if (last < 0 && scroll > 0) last = scroll >= 100 ? 5 : scroll >= 75 ? 4 : scroll >= 50 ? 3 : 1;
  if (last < 0 && events.length) last = 0;
  return {
    id,
    startedAt,
    device,
    dwellSeconds: dwell,
    maxScroll: scroll,
    moduleTouched: presets + modules > 0,
    presetChanges: presets,
    moduleChanges: modules,
    panelOpened: panel,
    lastSection: last,
    events,
  };
}

/** Load the facts of every SENT prospect (the whole pilot; the range filter is applied in the fold). */
export async function loadProspectFacts(): Promise<ProspectFacts[]> {
  const rows = await db
    .selectFrom("prospect")
    .innerJoin("lead", "lead.id", "prospect.lead_id")
    .leftJoin("mock_artifact", "mock_artifact.id", "prospect.mock_artifact_id")
    .select([
      "prospect.id as id",
      "prospect.segment as segment",
      "prospect.sent_at as sent_at",
      "prospect.email_sent_at as email_sent_at",
      "prospect.sms_sent_at as sms_sent_at",
      "prospect.mms_sent_at as mms_sent_at",
      "prospect.unsubscribed_at as unsubscribed_at",
      "lead.name as lead_name",
      "mock_artifact.inputs as inputs",
    ])
    .where("prospect.sent_at", "is not", null)
    .execute();
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);

  const views = await db
    .selectFrom("mock_view")
    .select(["id", "prospect_id", "started_at", "user_agent"])
    .where("prospect_id", "in", ids)
    .orderBy("started_at", "asc")
    .execute();
  const viewIds = views.map((v) => v.id);
  const events = viewIds.length
    ? await db
        .selectFrom("mock_event")
        .select(["mock_view_id", "type", "payload", "occurred_at"])
        .where("mock_view_id", "in", viewIds)
        .orderBy("occurred_at", "asc")
        .execute()
    : [];
  const orders = await db
    .selectFrom("order_intent")
    .leftJoin("payment", "payment.order_intent_id", "order_intent.id")
    .select(["order_intent.prospect_id as prospect_id", "order_intent.submitted_at as submitted_at", "payment.status as pay_status", "payment.paid_at as paid_at"])
    .where("order_intent.prospect_id", "in", ids)
    .where("order_intent.kind", "=", "initial")
    .execute();
  const feedback = await loadFeedback(ids);

  const eventsByView = new Map<string, RawEvent[]>();
  for (const e of events) {
    const list = eventsByView.get(e.mock_view_id) ?? [];
    list.push({ type: e.type, payload: e.payload, occurredAt: toDate(e.occurred_at)! });
    eventsByView.set(e.mock_view_id, list);
  }
  const viewsByProspect = new Map<string, Visit[]>();
  for (const v of views) {
    const evs = eventsByView.get(v.id) ?? [];
    const visit = foldVisit(v.id, toDate(v.started_at)!, deviceOf(v), evs);
    const list = viewsByProspect.get(v.prospect_id) ?? [];
    list.push(visit);
    viewsByProspect.set(v.prospect_id, list);
  }
  const firstOrder = new Map<string, Date>();
  const firstPaid = new Map<string, Date>();
  for (const o of orders) {
    const s = toDate(o.submitted_at);
    if (s && (!firstOrder.has(o.prospect_id) || s < firstOrder.get(o.prospect_id)!)) firstOrder.set(o.prospect_id, s);
    const p = o.pay_status === "paid" ? toDate(o.paid_at) : null;
    if (p && (!firstPaid.has(o.prospect_id) || p < firstPaid.get(o.prospect_id)!)) firstPaid.set(o.prospect_id, p);
  }

  return rows.map((r) => {
    const visits = viewsByProspect.get(r.id) ?? [];
    const sentAt = toDate(r.sent_at)!;
    const openedAt = visits[0]?.startedAt ?? null;
    let deepAt: Date | null = null;
    let escShown = false;
    let escCta = false;
    let escDismiss = false;
    for (const v of visits) {
      if (!deepAt && (v.moduleTouched || v.maxScroll >= 50)) deepAt = v.startedAt;
      for (const e of v.events) {
        if (e.type === "escalation_shown") escShown = true;
        if (e.type === "escalation_cta") escCta = true;
        if (e.type === "escalation_dismiss") escDismiss = true;
      }
    }
    const paidAt = firstPaid.get(r.id) ?? null;
    const lastVisit = visits[visits.length - 1];
    const verdict = paidAt || !lastVisit ? null : inferExitReason(signalsFromEvents(lastVisit.events, false));
    return {
      id: r.id,
      leadName: r.lead_name,
      segment: r.segment ?? "ismeretlen",
      channel: channelOf(r),
      style: styleOf(r.inputs as Record<string, unknown> | null),
      sentAt,
      sentHour: partsIn(sentAt, APP_TZ).hour,
      visits,
      openedAt,
      deepAt,
      orderedAt: firstOrder.get(r.id) ?? null,
      paidAt,
      unsubscribedAt: toDate(r.unsubscribed_at),
      escalationShown: escShown,
      escalationCta: escCta,
      escalationDismiss: escDismiss,
      device: visits[0]?.device ?? "unknown",
      exitReason: verdict?.reason ?? null,
      exitConfidence: verdict?.confidence ?? null,
      stated: feedback.get(r.id) ?? null,
    };
  });
}

/**
 * Device of a view. Until the measurement migration lands (`mock_view.device`, SUB
 * „Riport mérés") the raw user agent is classified here; after it the column wins and
 * this fallback only serves rows the backfill has not reached.
 */
function deviceOf(v: { user_agent: string | null } & Record<string, unknown>): Device {
  const col = v["device"];
  if (typeof col === "string" && col) return col as Device;
  const ua = v.user_agent ?? "";
  if (!ua) return "unknown";
  if (/bot|crawl|spider|slurp|preview|scanner|monitor/i.test(ua)) return "bot";
  if (/ipad|tablet|android(?!.*mobile)/i.test(ua)) return "tablet";
  if (/iphone|ipod|android.*mobile|windows phone|mobile/i.test(ua)) return "mobile";
  return "desktop";
}

/** Stated reasons (prospect_feedback) — the table arrives with the measurement migration. */
async function loadFeedback(ids: readonly string[]): Promise<Map<string, StatedReason>> {
  const out = new Map<string, StatedReason>();
  if (!(await tableExists("prospect_feedback"))) return out;
  const rows = await db
    .selectFrom("prospect_feedback" as never)
    .select(["prospect_id", "reason", "created_at"] as never)
    .where("prospect_id" as never, "in", ids as never)
    .orderBy("created_at" as never, "asc")
    .execute();
  for (const r of rows as unknown as { prospect_id: string; reason: string }[]) {
    if ((STATED_REASONS as readonly string[]).includes(r.reason)) out.set(r.prospect_id, r.reason as StatedReason);
  }
  return out;
}

const tableCache = new Map<string, boolean>();
async function tableExists(name: string): Promise<boolean> {
  const hit = tableCache.get(name);
  if (hit !== undefined) return hit;
  const r = await db
    .selectFrom("information_schema.tables" as never)
    .select("table_name" as never)
    .where("table_schema" as never, "=", "public" as never)
    .where("table_name" as never, "=", name as never)
    .executeTakeFirst();
  const ok = Boolean(r);
  tableCache.set(name, ok);
  return ok;
}

export async function loadTargets(): Promise<Record<Hypothesis["key"], number>> {
  const t = { ...DEFAULT_TARGETS };
  if (!(await tableExists("report_target"))) return t;
  const rows = (await db
    .selectFrom("report_target" as never)
    .select(["metric", "target"] as never)
    .execute()) as unknown as { metric: string; target: unknown }[];
  for (const r of rows) if (r.metric in t) t[r.metric as Hypothesis["key"]] = Number(r.target);
  return t;
}

export async function loadNotes(): Promise<ReportNote[]> {
  if (!(await tableExists("report_note"))) return [];
  const rows = (await db
    .selectFrom("report_note" as never)
    .select(["id", "day", "text"] as never)
    .orderBy("day" as never, "asc")
    .execute()) as unknown as { id: string; day: string; text: string }[];
  return rows.map((r) => ({ id: r.id, day: String(r.day).slice(0, 10), text: r.text }));
}

export async function addNote(day: string, text: string, createdBy: string): Promise<boolean> {
  if (!(await tableExists("report_note"))) return false;
  await db
    .insertInto("report_note" as never)
    .values({ day, text: text.slice(0, 80), created_by: createdBy } as never)
    .execute();
  return true;
}

// ── the fold ────────────────────────────────────────────────────────────────

function stageCounts(ps: readonly ProspectFacts[]): StageCounts {
  let opened = 0;
  let deep = 0;
  let ordered = 0;
  let paid = 0;
  let returned = 0;
  let unsub = 0;
  for (const p of ps) {
    if (p.openedAt) opened++;
    if (p.deepAt) deep++;
    if (p.orderedAt) ordered++;
    if (p.paidAt) paid++;
    if (p.visits.length > 1) returned++;
    if (p.unsubscribedAt) unsub++;
  }
  return { sent: ps.length, opened, deep, ordered, paid, returned, unsubscribed: unsub };
}

const hours = (a: Date | null, b: Date | null): number | null => (a && b ? (b.getTime() - a.getTime()) / HOUR : null);
const collect = (ps: readonly ProspectFacts[], f: (p: ProspectFacts) => number | null): number[] =>
  ps.map(f).filter((x): x is number => x !== null && Number.isFinite(x));
const rate = (a: number, b: number): number => (b ? (a / b) * 100 : NaN);

export function dimKey(p: ProspectFacts, dim: ReportDim): string {
  switch (dim) {
    case "segment":
      return p.segment;
    case "channel":
      return p.channel;
    case "device":
      return p.device;
    case "style":
      return p.style;
    case "hour":
      return String(p.sentHour).padStart(2, "0") + ":00";
  }
}

function isoDay(d: Date): string {
  const z = partsIn(d, APP_TZ);
  return `${z.year}-${String(z.month).padStart(2, "0")}-${String(z.day).padStart(2, "0")}`;
}

function verdictOf(value: number, target: number, direction: "higher" | "lower"): Hypothesis["verdict"] {
  if (!Number.isFinite(value)) return "none";
  if (direction === "higher") return value >= target ? "above" : value >= target * 0.7 ? "near" : "below";
  return value <= target ? "above" : value <= target * 1.3 ? "near" : "below";
}

function buyerProfile(ps: readonly ProspectFacts[]): BuyerProfile {
  const n = ps.length;
  const avg = (f: (p: ProspectFacts) => number): number => (n ? ps.reduce((s, p) => s + f(p), 0) / n : NaN);
  return {
    n,
    visitsAvg: avg((p) => p.visits.length),
    dwellMedian: median(ps.map((p) => Math.max(0, ...p.visits.map((v) => v.dwellSeconds)))),
    modulesAvg: avg((p) => p.visits.reduce((s, v) => s + v.moduleChanges, 0)),
    presetsAvg: avg((p) => p.visits.reduce((s, v) => s + v.presetChanges, 0)),
    openToPaidMedianHours: median(collect(ps, (p) => hours(p.openedAt, p.paidAt))),
    mobileShare: rate(ps.filter((p) => p.device === "mobile").length, n),
  };
}

/** Everything both pages render from, for one range + one breakdown dimension. */
export async function getReportData(days: ReportDays, dim: ReportDim, now = new Date()): Promise<ReportData> {
  const [all, targets, notes] = await Promise.all([loadProspectFacts(), loadTargets(), loadNotes()]);
  return foldReport(all, targets, notes, days, dim, now);
}

/** The pure fold — the pages' fixtures (kb-shot) feed it synthetic facts. */
export function foldReport(
  all: readonly ProspectFacts[],
  targets: Readonly<Record<Hypothesis["key"], number>>,
  notes: readonly ReportNote[],
  days: ReportDays,
  dim: ReportDim,
  now: Date,
): ReportData {
  const from = days ? now.getTime() - days * DAY : -Infinity;
  const prevFrom = days ? now.getTime() - 2 * days * DAY : -Infinity;
  const inRange = all.filter((p) => p.sentAt.getTime() >= from);
  const prev = days ? all.filter((p) => p.sentAt.getTime() >= prevFrom && p.sentAt.getTime() < from) : [];

  const counts = stageCounts(inRange);
  const prevCounts = days ? stageCounts(prev) : null;

  const sentToOpen = collect(inRange, (p) => hours(p.sentAt, p.openedAt));
  const times = {
    sentToOpen: timeStats(sentToOpen),
    openToDeep: timeStats(collect(inRange, (p) => hours(p.openedAt, p.deepAt))),
    openToOrder: timeStats(collect(inRange, (p) => hours(p.openedAt, p.orderedAt))),
    orderToPaid: timeStats(collect(inRange, (p) => hours(p.orderedAt, p.paidAt))),
    sentToPaid: timeStats(collect(inRange, (p) => hours(p.sentAt, p.paidAt))),
    prevSentToOpen: days ? timeStats(collect(prev, (p) => hours(p.sentAt, p.openedAt))) : null,
  };

  // Six weekly buckets (oldest first) for the sparklines — always the last 6 weeks.
  const weekly = (f: (ps: readonly ProspectFacts[]) => number): number[] => {
    const out: number[] = [];
    for (let w = 5; w >= 0; w--) {
      const a = now.getTime() - (w + 1) * 7 * DAY;
      const b = now.getTime() - w * 7 * DAY;
      const v = f(all.filter((p) => p.sentAt.getTime() >= a && p.sentAt.getTime() < b));
      out.push(Number.isFinite(v) ? v : 0);
    }
    return out;
  };
  const hyp = (
    key: Hypothesis["key"],
    numV: number,
    denV: number,
    direction: "higher" | "lower",
    weeklyF: (ps: readonly ProspectFacts[]) => number,
    valueOverride?: number,
  ): Hypothesis => {
    const value = valueOverride ?? rate(numV, denV);
    // The previous window through the SAME measure (README ⑤: every KPI shows its change).
    const prevValue = days ? weeklyF(prev) : null;
    return { key, value, prevValue, target: targets[key], direction, verdict: verdictOf(value, targets[key], direction), num: numV, den: denV, weekly: weekly(weeklyF) };
  };
  const hypotheses: Hypothesis[] = [
    hyp("open_rate", counts.opened, counts.sent, "higher", (ps) => rate(stageCounts(ps).opened, ps.length)),
    hyp("return_rate", counts.returned, counts.opened, "higher", (ps) => { const c = stageCounts(ps); return rate(c.returned, c.opened); }),
    hyp("deep_rate", counts.deep, counts.opened, "higher", (ps) => { const c = stageCounts(ps); return rate(c.deep, c.opened); }),
    hyp("order_rate", counts.ordered, counts.sent, "higher", (ps) => rate(stageCounts(ps).ordered, ps.length)),
    hyp("paid_rate", counts.paid, counts.ordered, "higher", (ps) => { const c = stageCounts(ps); return rate(c.paid, c.ordered); }),
    hyp("first_open_hours", sentToOpen.length, counts.opened, "lower", (ps) => median(collect(ps, (p) => hours(p.sentAt, p.openedAt))), median(sentToOpen)),
  ];

  const openers = inRange.filter((p) => p.openedAt);
  const returns: ReturnRow[] = (["1", "2", "3+"] as const).map((k) => {
    const g = openers.filter((p) => (k === "1" ? p.visits.length === 1 : k === "2" ? p.visits.length === 2 : p.visits.length >= 3));
    return { visits: k, prospects: g.length, ordered: g.filter((p) => p.orderedAt).length };
  });
  const shown = inRange.filter((p) => p.escalationShown);
  const escalation = {
    shown: shown.length,
    cta: shown.filter((p) => p.escalationCta).length,
    ordered: shown.filter((p) => p.escalationCta && p.orderedAt).length,
    dismissed: shown.filter((p) => p.escalationDismiss).length,
  };

  const groups = new Map<string, ProspectFacts[]>();
  for (const p of inRange) {
    const k = dimKey(p, dim);
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }
  const dims: DimRow[] = [...groups.entries()]
    .map(([key, ps]) => ({ key, counts: stageCounts(ps) }))
    .sort((a, b) => (dim === "hour" ? a.key.localeCompare(b.key) : b.counts.sent - a.counts.sent));

  // Cohorts: the last 7 send-weeks of the whole pilot (not range-filtered — a cohort IS a range).
  const cohorts: CohortRow[] = [];
  for (let w = 6; w >= 0; w--) {
    const a = now.getTime() - (w + 1) * 7 * DAY;
    const b = now.getTime() - w * 7 * DAY;
    const ps = all.filter((p) => p.sentAt.getTime() >= a && p.sentAt.getTime() < b);
    if (!ps.length) continue;
    cohorts.push({
      weekStart: isoDay(new Date(a)),
      weekEnd: isoDay(new Date(b - DAY)),
      sent: ps.length,
      opened7: ps.filter((p) => p.openedAt && p.openedAt.getTime() - p.sentAt.getTime() <= 7 * DAY).length,
      ordered14: ps.filter((p) => p.orderedAt && p.orderedAt.getTime() - p.sentAt.getTime() <= 14 * DAY).length,
      paid30: ps.filter((p) => p.paidAt && p.paidAt.getTime() - p.sentAt.getTime() <= 30 * DAY).length,
      firstOpenMedianHours: median(collect(ps, (p) => hours(p.sentAt, p.openedAt))),
      open: now.getTime() - b < 30 * DAY,
    });
  }

  // Timeline: sends and opens per Budapest day over the range (49 days for "all").
  const span = days || 49;
  const byDay = new Map<string, { sent: number; opened: number }>();
  for (let i = span - 1; i >= 0; i--) byDay.set(isoDay(new Date(now.getTime() - i * DAY)), { sent: 0, opened: 0 });
  for (const p of all) {
    const ds = isoDay(p.sentAt);
    const s = byDay.get(ds);
    if (s) s.sent++;
    for (const v of p.visits) {
      const o = byDay.get(isoDay(v.startedAt));
      if (o) o.opened++;
    }
  }
  const timeline: DayPoint[] = [...byDay.entries()].map(([day, c]) => ({ day, ...c }));

  // ── behaviour ─────────────────────────────────────────────────────────────
  const nonBuyers = openers.filter((p) => !p.paidAt);
  const bestVisit = (p: ProspectFacts, f: (v: Visit) => number): number => Math.max(0, ...p.visits.map(f));
  const dwells = openers.map((p) => bestVisit(p, (v) => v.dwellSeconds));
  const scrolls = openers.map((p) => bestVisit(p, (v) => v.maxScroll));
  const devices = (["mobile", "tablet", "desktop"] as const).map((device) => {
    const g = openers.filter((p) => p.device === device);
    return { device, openers: g.length, paid: g.filter((p) => p.paidAt).length };
  });
  const exits: ExitRow[] = EXIT_SECTIONS.map((section, i) => ({
    section,
    reached: openers.filter((p) => bestVisit(p, (v) => v.lastSection) >= i).length,
    exited: nonBuyers.filter((p) => (p.visits[p.visits.length - 1]?.lastSection ?? -1) === i).length,
  }));
  const reasons: ReasonRow[] = EXIT_REASONS.map((reason) => {
    const g = nonBuyers.filter((p) => p.exitReason === reason);
    return { reason, count: g.length, sure: g.filter((p) => p.exitConfidence === "sure").length };
  });
  const statedAll = inRange.filter((p) => p.stated);
  const stated = STATED_REASONS.map((reason) => ({ reason, count: statedAll.filter((p) => p.stated === reason).length }));
  const both = nonBuyers.filter((p) => p.stated && p.exitReason);
  const calibMap = new Map<string, number>();
  let hits = 0;
  for (const p of both) {
    const k = `${p.stated}|${p.exitReason}`;
    calibMap.set(k, (calibMap.get(k) ?? 0) + 1);
    if (EXPECTED_STATED[p.exitReason!] === p.stated) hits++;
  }
  const calibration = [...calibMap.entries()].map(([k, count]) => {
    const [s, r] = k.split("|") as [StatedReason, ExitReason];
    return { stated: s, inferred: r, count };
  });
  const buyers = inRange.filter((p) => p.paidAt && p.openedAt);
  const fast = buyers.filter((p) => hours(p.openedAt, p.paidAt)! <= 6);
  const deep = buyers.filter((p) => hours(p.openedAt, p.paidAt)! > 6);
  const heat: number[][] = Array.from({ length: 7 }, () => Array<number>(17).fill(0));
  for (const p of openers)
    for (const v of p.visits) {
      const z = partsIn(v.startedAt, APP_TZ);
      // Weekday of the BUDAPEST calendar day (UTC noon of that day is safe from DST shifts);
      // getUTCDay gives 0 = Sunday, the grid is Monday-first.
      const dow = (new Date(`${isoDay(v.startedAt)}T12:00:00Z`).getUTCDay() + 6) % 7;
      if (z.hour >= 7 && z.hour <= 23) heat[dow]![z.hour - 7]!++;
    }

  return {
    days,
    dim,
    now,
    prospects: inRange,
    counts,
    prevCounts,
    times,
    hypotheses,
    returns,
    escalation,
    dims,
    cohorts,
    timeline,
    notes,
    behaviour: {
      openers: openers.length,
      nonBuyers: nonBuyers.length,
      dwellMedian: median(dwells),
      dwellP90: median(dwells, 0.9),
      scrollMedian: median(scrolls),
      scrollBottomShare: rate(scrolls.filter((s) => s >= 75).length, scrolls.length),
      devices,
      panelReached: openers.filter((p) => bestVisit(p, (v) => v.lastSection) >= sectionIndex("panel")).length,
      paymentStalled: inRange.filter((p) => p.orderedAt && !p.paidAt).length,
      statedCount: statedAll.length,
      exits,
      reasons,
      stated,
      calibration,
      calibrationHits: hits,
      calibrationTotal: both.length,
      fastBuyers: buyerProfile(fast),
      deepBuyers: buyerProfile(deep),
      heat,
    },
    targets,
  };
}
