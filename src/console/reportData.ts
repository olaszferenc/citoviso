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
  readonly leadId: string;
  readonly leadName: string;
  readonly segment: string;
  readonly channel: Channel;
  readonly style: string;
  /** The mock's art template id (`inputs.template`, src/engine/templates.ts), "ismeretlen" when absent. */
  readonly template: string;
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
  /** The lead answered the outreach (an `outreach_reply` row for this send). */
  readonly replied: boolean;
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

/** Where the order panel was opened from (`panel_open.via`; legacy, via-less opens = "pill").
 *  "trial" = the order link under the free-trial form (ADR-0342, proba-gomb README Mérés). */
export type PanelVia = "pill" | "esc" | "tab" | "trial";
export const PANEL_VIAS: readonly PanelVia[] = ["pill", "esc", "tab", "trial"];
/** The Rendelés-panel chip filter (`pv` query param). */
export type PanelFilter = "all" | PanelVia;
export const PANEL_FILTERS: readonly PanelFilter[] = ["all", "pill", "esc", "tab", "trial"];
/** What the visitor did inside the panel — the „Mit csinált közben” rows, in display order. */
export const PANEL_ACTS = ["preset", "module", "period", "info", "domain", "own_domain", "collapse", "billing_invalid", "order_send_failed"] as const;
export type PanelAct = (typeof PANEL_ACTS)[number];
/** Error events inside the panel (an error after the last submit means the order did not go out). */
export const PANEL_ERROR_EVENTS: readonly string[] = ["billing_invalid", "order_send_failed", "module_dependency_unmet"];

/**
 * One panel session = one human visit (mock_view) of a SENT prospect in range in which the
 * order panel was opened at least once (README ⑨). A lead who came back gives several rows.
 */
export interface PanelSession {
  readonly visitId: string;
  readonly prospectId: string;
  readonly leadName: string;
  /** The visit's start. */
  readonly startedAt: Date;
  /** The first `panel_open` of the visit. */
  readonly openedAt: Date;
  readonly device: Device;
  readonly vias: readonly PanelVia[];
  /** Seconds spent with the panel open (sum of the stints). */
  readonly seconds: number;
  /** Highest step reached: 1 opened · 2 Tovább · 3 Számlázás · 4 Elküldte · 5 Fizetésre ment · 6 Fizetett. */
  readonly step: 1 | 2 | 3 | 4 | 5 | 6;
  /** The order went out in this session (redirect, or a submit not followed by an error). */
  readonly ordered: boolean;
  readonly paid: boolean;
  readonly paidAt: Date | null;
  /** Any error event (billing_invalid · order_send_failed · module_dependency_unmet). */
  readonly error: boolean;
  readonly acts: readonly PanelAct[];
  /** The visit's events from the first `panel_open` on (the expanded timeline). */
  readonly events: readonly RawEvent[];
}

/** Every number of the Rendelés-panel, for one chip filter. */
export interface PanelSummary {
  readonly sessions: readonly PanelSession[];
  readonly n: number;
  /** Sessions per opening route (a session can count under more than one). */
  readonly byVia: Readonly<Record<PanelVia, number>>;
  readonly secondsMedian: number;
  readonly secondsP90: number;
  /** Closed without an order and without paying. */
  readonly leftWithout: number;
  readonly leftWithError: number;
  /** reach[k-1] = sessions that reached step k (k = 1…6). */
  readonly reach: readonly number[];
  /** stopped[k-1] = sessions whose highest step is k (k < 6; stopped[5] is always 0). */
  readonly stopped: readonly number[];
  /** Index of the step losing the most sessions; -1 when nobody stopped. */
  readonly hottest: number;
  readonly acts: Readonly<Record<PanelAct, number>>;
  readonly submitted: number;
  readonly paid: number;
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
    /** The Rendelés-panel (README rendeles-panel ④–⑨): sessions newest first + the pill KPI. */
    readonly panel: {
      readonly sessions: readonly PanelSession[];
      /** Openers with at least one `panel_open` via the „Itt rendelheti meg” pill — never chip-filtered. */
      readonly pressedPill: number;
    };
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

/** The mock's art template = `inputs.template` (src/engine/templates.ts). */
function templateOf(inputs: Record<string, unknown> | null | undefined): string {
  const t = inputs?.template;
  return typeof t === "string" && t ? t : "ismeretlen";
}

/**
 * Template section ids → the exit map's rows. The templates name their sections freely
 * (`t-services`, `t-features`, `t-about`, `t-showcase`, `data-cit-module="map"`…; the
 * beacon strips the `t-`), so every id is folded onto one of the nine canonical rows.
 * An unknown id counts as nothing (-1), never as a wrong row.
 */
const SECTION_ALIAS: Readonly<Record<string, ExitSection>> = {
  hero: "hero",
  gallery: "gallery",
  showcase: "gallery",
  rooms: "rooms",
  about: "rooms",
  amenities: "amenities",
  services: "amenities",
  features: "amenities",
  fun: "amenities",
  usp: "amenities",
  hours: "amenities",
  poi: "amenities",
  pricing: "amenities",
  reviews: "reviews",
  map: "map",
  location: "map",
  contact: "map",
  book: "map",
  booking: "map",
  enquiry: "map",
  panel: "panel",
  billing: "billing",
  payment: "payment",
};
const sectionIndex = (id: unknown): number => {
  const canon = SECTION_ALIAS[String(id ?? "").replace(/^t-/, "")];
  return canon ? EXIT_SECTIONS.indexOf(canon) : -1;
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
      "prospect.lead_id as lead_id",
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
    .select(["id", "prospect_id", "started_at", "user_agent", "device"])
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
  const replied = await loadReplied(rows.map((r) => ({ id: r.id, leadId: r.lead_id, sentAt: toDate(r.sent_at)! })));

  const eventsByView = new Map<string, RawEvent[]>();
  for (const e of events) {
    const list = eventsByView.get(e.mock_view_id) ?? [];
    list.push({ type: e.type, payload: e.payload, occurredAt: toDate(e.occurred_at)! });
    eventsByView.set(e.mock_view_id, list);
  }
  const viewsByProspect = new Map<string, Visit[]>();
  for (const v of views) {
    // A bot-classified view (headless test, link scanner that passed the human gate) is
    // kept in the table but never counted — ADR-0108's rule, applied to the mock side too.
    const device = deviceOf(v);
    if (device === "bot") continue;
    const evs = eventsByView.get(v.id) ?? [];
    const visit = foldVisit(v.id, toDate(v.started_at)!, device, evs);
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
      leadId: r.lead_id,
      leadName: r.lead_name,
      segment: r.segment ?? "ismeretlen",
      channel: channelOf(r),
      style: styleOf(r.inputs as Record<string, unknown> | null),
      template: templateOf(r.inputs as Record<string, unknown> | null),
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
      replied: replied.has(r.id),
    };
  });
}

/**
 * Device of a view: the extracted `mock_view.device` column (migration 0087). Rows the
 * backfill has not reached yet still carry a raw user agent — those are classified here
 * with the same coarse rule, so the report never shows "unknown" for a measurable visit.
 */
function deviceOf(v: { user_agent: string | null; device: string | null }): Device {
  if (v.device) return v.device as Device;
  const ua = v.user_agent ?? "";
  if (!ua) return "unknown";
  if (/bot|crawl|spider|slurp|preview|scanner|monitor/i.test(ua)) return "bot";
  if (/ipad|tablet|android(?!.*mobile)/i.test(ua)) return "tablet";
  if (/iphone|ipod|android.*mobile|windows phone|mobile/i.test(ua)) return "mobile";
  return "desktop";
}

/** Stated reasons (prospect_feedback): the FIRST answer per prospect counts. */
async function loadFeedback(ids: readonly string[]): Promise<Map<string, StatedReason>> {
  const out = new Map<string, StatedReason>();
  const rows = await db
    .selectFrom("prospect_feedback")
    .select(["prospect_id", "reason"])
    .where("prospect_id", "in", ids)
    .orderBy("created_at", "asc")
    .execute();
  for (const r of rows) {
    if (!out.has(r.prospect_id) && (STATED_REASONS as readonly string[]).includes(r.reason)) out.set(r.prospect_id, r.reason as StatedReason);
  }
  return out;
}

/**
 * Which sends got an answer (outreach_reply, ADR-0339): the reply names the prospect, or —
 * when the collector could only match the lead — it arrived after this send.
 */
async function loadReplied(ps: readonly { id: string; leadId: string; sentAt: Date }[]): Promise<Set<string>> {
  const out = new Set<string>();
  const rows = await db
    .selectFrom("outreach_reply")
    .select(["prospect_id", "lead_id", "received_at"])
    .where("lead_id", "in", [...new Set(ps.map((p) => p.leadId))])
    .execute();
  for (const r of rows) {
    if (r.prospect_id) {
      out.add(r.prospect_id);
      continue;
    }
    const at = toDate(r.received_at)!;
    for (const p of ps) if (p.leadId === r.lead_id && p.sentAt.getTime() <= at.getTime()) out.add(p.id);
  }
  return out;
}

/** Operator-set targets (report_target); the defaults fill any missing metric. */
export async function loadTargets(): Promise<Record<Hypothesis["key"], number>> {
  const t = { ...DEFAULT_TARGETS };
  const rows = await db.selectFrom("report_target").select(["metric", "target"]).execute();
  for (const r of rows) if (r.metric in t) t[r.metric as Hypothesis["key"]] = Number(r.target);
  return t;
}

export async function loadNotes(): Promise<ReportNote[]> {
  const rows = await db.selectFrom("report_note").select(["id", "day", "text"]).orderBy("day", "asc").execute();
  return rows.map((r) => ({ id: r.id, day: String(r.day).slice(0, 10), text: r.text }));
}

export async function addNote(day: string, text: string, createdBy: string): Promise<void> {
  await db.insertInto("report_note").values({ day, text: text.slice(0, 80), created_by: createdBy }).execute();
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

// ── the Rendelés-panel (assets/design-refs/console/rendeles-panel/README.md) ────

const ms = (v: string | Date): number => (v instanceof Date ? v.getTime() : new Date(v).getTime());
const viaOf = (payload: unknown): PanelVia => {
  const v = (payload as Record<string, unknown> | null | undefined)?.via;
  return v === "esc" || v === "tab" || v === "trial" ? v : "pill";
};
const ACT_OF: Readonly<Record<string, PanelAct>> = {
  preset_select: "preset",
  module_add: "module",
  module_remove: "module",
  period_select: "period",
  module_info: "info",
  domain_pick: "domain",
  domain_select: "domain",
  own_domain_check: "own_domain",
  own_domain_pick: "own_domain",
  panel_collapse: "collapse",
  billing_invalid: "billing_invalid",
  order_send_failed: "order_send_failed",
};
const STEP_OF: Readonly<Record<string, 2 | 3 | 4 | 5>> = {
  checkout_step: 2,
  billing_step_open: 3,
  order_intent_submitted: 4,
  checkout_redirect: 5,
};

/** Fold one visit into a panel session; null when the panel was never opened in it. */
export function panelSessionOf(p: Pick<ProspectFacts, "id" | "leadName" | "paidAt">, v: Visit): PanelSession | null {
  // Stable sort by time — the DB already orders, synthetic fixtures may not.
  const evs = v.events.map((e, i) => ({ e, t: ms(e.occurredAt), i })).sort((a, b) => a.t - b.t || a.i - b.i);
  const first = evs.findIndex((x) => x.e.type === "panel_open");
  if (first < 0) return null;
  const vias = new Set<PanelVia>();
  const acts = new Set<PanelAct>();
  let step = 1;
  let seconds = 0;
  let openAt: number | null = null;
  let error = false;
  let redirected = false;
  let lastSubmit = -1;
  let lastError = -1;
  const close = (t: number, reported: unknown): void => {
    if (openAt === null) return;
    seconds += typeof reported === "number" && Number.isFinite(reported) ? Math.max(0, reported) : Math.max(0, (t - openAt) / 1000);
    openAt = null;
  };
  for (let k = first; k < evs.length; k++) {
    const { e, t } = evs[k]!;
    const pl = (e.payload ?? {}) as Record<string, unknown>;
    if (e.type === "panel_open") {
      vias.add(viaOf(e.payload));
      if (openAt === null) openAt = t;
    } else if (e.type === "panel_collapse" || e.type === "panel_close") {
      close(t, pl.seconds);
    } else if (e.type === "dwell_end") {
      close(t, pl.panel_seconds);
    }
    const s = STEP_OF[e.type];
    if (s && s > step) step = s;
    if (e.type === "checkout_redirect") redirected = true;
    if (e.type === "order_intent_submitted") lastSubmit = k;
    if (PANEL_ERROR_EVENTS.includes(e.type)) {
      error = true;
      lastError = k;
    }
    const a = ACT_OF[e.type];
    if (a) acts.add(a);
  }
  close(evs[evs.length - 1]!.t, undefined);
  const ordered = redirected || (lastSubmit >= 0 && lastError < lastSubmit);
  return {
    visitId: v.id,
    prospectId: p.id,
    leadName: p.leadName,
    startedAt: v.startedAt,
    openedAt: new Date(evs[first]!.t),
    device: v.device,
    vias: PANEL_VIAS.filter((x) => vias.has(x)),
    seconds: Math.round(seconds),
    step: step as PanelSession["step"],
    ordered,
    paid: false,
    paidAt: null,
    error,
    acts: PANEL_ACTS.filter((x) => acts.has(x)),
    events: evs.slice(first).map((x) => x.e),
  };
}

/**
 * Every panel session of the given prospects, newest first. „Fizetett” (step 6) comes from
 * the PAYMENT table (ProspectFacts.paidAt): the lead paid at/after the visit started, and
 * that visit reached at least „Elküldte” — the latest such visit before the payment owns it,
 * so one payment never counts twice when a lead submitted in two visits.
 */
export function panelSessions(ps: readonly ProspectFacts[]): PanelSession[] {
  const out: PanelSession[] = [];
  for (const p of ps) {
    const own = p.visits.map((v) => panelSessionOf(p, v)).filter((s): s is PanelSession => s !== null);
    const paidAt = p.paidAt;
    const payer = paidAt
      ? own.filter((s) => s.step >= 4 && s.startedAt.getTime() <= paidAt.getTime()).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0]
      : undefined;
    for (const s of own) out.push(s === payer ? { ...s, step: 6, paid: true, paidAt } : s);
  }
  return out.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
}

/** The panel's numbers for one chip filter — pure, the view computes nothing itself. */
export function summarizePanel(all: readonly PanelSession[], via: PanelFilter): PanelSummary {
  const sessions = via === "all" ? all : all.filter((s) => s.vias.includes(via));
  const n = sessions.length;
  const secs = sessions.map((s) => s.seconds);
  const left = sessions.filter((s) => !s.ordered && !s.paid);
  const reach = [1, 2, 3, 4, 5, 6].map((k) => sessions.filter((s) => s.step >= k).length);
  const stopped = [1, 2, 3, 4, 5, 6].map((k) => (k < 6 ? sessions.filter((s) => s.step === k).length : 0));
  const mx = Math.max(0, ...stopped);
  const acts = Object.fromEntries(PANEL_ACTS.map((a) => [a, sessions.filter((s) => s.acts.includes(a)).length])) as Record<PanelAct, number>;
  return {
    sessions,
    n,
    byVia: {
      pill: all.filter((s) => s.vias.includes("pill")).length,
      esc: all.filter((s) => s.vias.includes("esc")).length,
      tab: all.filter((s) => s.vias.includes("tab")).length,
      trial: all.filter((s) => s.vias.includes("trial")).length,
    },
    secondsMedian: median(secs),
    secondsP90: median(secs, 0.9),
    leftWithout: left.length,
    leftWithError: left.filter((s) => s.error).length,
    reach,
    stopped,
    hottest: mx > 0 ? stopped.indexOf(mx) : -1,
    acts,
    submitted: sessions.filter((s) => s.step >= 4).length,
    paid: sessions.filter((s) => s.paid).length,
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
      panel: {
        sessions: panelSessions(inRange),
        pressedPill: openers.filter((p) => p.visits.some((v) => v.events.some((e) => e.type === "panel_open" && viaOf(e.payload) === "pill"))).length,
      },
    },
    targets,
  };
}

// ── the Mock tab (frozen plan: assets/design-refs/console/mock-tab/README.md) ────

/** README ②: channel chip — „E-mail” = any mail touch, „MMS / SMS” = any mobile touch. */
export type MockChannelFilter = "all" | "email" | "mobile";
export const MOCK_CHANNELS: readonly MockChannelFilter[] = ["all", "email", "mobile"];
/** README ⑧: Legvonzóbb · Legutóbbi · Leghosszabb idő. */
export type MockSort = "score" | "sent" | "dwell";
export const MOCK_SORTS: readonly MockSort[] = ["score", "sent", "dwell"];
/** README ④/⑤: below this many sends a template is „kevés adat” and never named in the verdict. */
export const MOCK_MIN_SENDS = 10;
/** README ⑧: the list grows 25 at a time. */
export const MOCK_PAGE = 25;
/** README ⑦: the attractiveness weights (sum = 100). */
export const MOCK_WEIGHTS = { opened: 20, returned: 15, min1: 15, full: 15, panel: 15, replied: 10, ordered: 10 } as const;
/** README ⑤: the ladder, in the card's order. */
export const MOCK_STEPS = ["opened", "min1", "full", "returned", "engaged"] as const;
export type MockStep = (typeof MOCK_STEPS)[number];

/** The signals of ONE sent mock — everything the score and the ladder read. */
export interface MockSignals {
  readonly opened: boolean;
  /** ≥ 2 human visits. */
  readonly returned: boolean;
  /** ≥ 60 s summed over the visits. */
  readonly min1: boolean;
  /** ≥ 75 % scroll in any visit. */
  readonly full: boolean;
  readonly panel: boolean;
  readonly replied: boolean;
  readonly ordered: boolean;
  readonly unsubscribed: boolean;
}

export interface MockRow extends MockSignals {
  readonly prospectId: string;
  readonly leadId: string;
  readonly name: string;
  readonly template: string;
  readonly templateLabel: string;
  readonly skin: string;
  readonly channel: Channel;
  readonly sentAt: Date;
  readonly views: number;
  /** Seconds: the SUM of the visits' dwellSeconds (README: „Az idő = … ÖSSZEGE”). */
  readonly dwellSeconds: number;
  readonly maxScroll: number;
  /** Hours from the send to the first human visit; null = never opened. */
  readonly firstOpenHours: number | null;
  readonly score: number;
}

export interface MockCard {
  /** Template id; "" = the „Minden sablon” card. */
  readonly key: string;
  readonly label: string;
  readonly sent: number;
  readonly opened: number;
  /** README ⑤: fewer than MOCK_MIN_SENDS sends (never on the „Minden sablon” card). */
  readonly few: boolean;
  /** Whole percents of the SENT, in MOCK_STEPS order; NaN when sent = 0. */
  readonly steps: readonly number[];
  /** Open % minus the all-mock open % (whole points); NaN without data. */
  readonly openDelta: number;
  readonly avgScore: number;
  /** Wilson 95 % interval of the open rate, whole percents; null when sent = 0. */
  readonly ci: readonly [number, number] | null;
}

export type MockVerdict =
  | { readonly kind: "none" }
  | {
      readonly kind: "compare";
      readonly top: MockCard;
      readonly bottom: MockCard;
      readonly avgOpen: number;
      /** The two 95 % intervals overlap → the gap may still be chance. */
      readonly overlap: boolean;
    };

export interface MockReport {
  readonly days: ReportDays;
  readonly ch: MockChannelFilter;
  /** Every sent mock of the range + channel, in „Legvonzóbb” order. */
  readonly rows: readonly MockRow[];
  readonly all: MockCard;
  /** One card per template, most sends first. */
  readonly cards: readonly MockCard[];
  readonly verdict: MockVerdict;
}

/** README ⑦: 0–100; an unsubscribe zeroes it. */
export function mockScore(s: MockSignals): number {
  if (s.unsubscribed) return 0;
  const w = MOCK_WEIGHTS;
  return (
    (s.opened ? w.opened : 0) +
    (s.returned ? w.returned : 0) +
    (s.min1 ? w.min1 : 0) +
    (s.full ? w.full : 0) +
    (s.panel ? w.panel : 0) +
    (s.replied ? w.replied : 0) +
    (s.ordered ? w.ordered : 0)
  );
}

export function mockStepHit(s: MockSignals, step: MockStep): boolean {
  return step === "engaged" ? s.panel || s.replied || s.ordered : s[step];
}

/** Wilson score interval (95 %, z = 1.96) of k successes in n, as fractions; null when n = 0. */
export function wilson(k: number, n: number): readonly [number, number] | null {
  if (!n) return null;
  const z = 1.96;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const w = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - w) / d), Math.min(1, (c + w) / d)];
}

/** The template's console label: the part before „ — ” (src/engine/templates/*.ts `label`). */
export function templateLabelOf(id: string, labels: Readonly<Record<string, string>>): string {
  const l = labels[id];
  return l ? l.split(" — ")[0]!.trim() : id;
}

export function mockRowOf(p: ProspectFacts, labels: Readonly<Record<string, string>>): MockRow {
  const dwell = p.visits.reduce((s, v) => s + v.dwellSeconds, 0);
  const scroll = Math.max(0, ...p.visits.map((v) => v.maxScroll));
  const sig: MockSignals = {
    opened: p.visits.length > 0,
    returned: p.visits.length >= 2,
    min1: dwell >= 60,
    full: scroll >= 75,
    panel: p.visits.some((v) => v.panelOpened),
    replied: p.replied,
    ordered: p.orderedAt !== null,
    unsubscribed: p.unsubscribedAt !== null,
  };
  return {
    ...sig,
    prospectId: p.id,
    leadId: p.leadId,
    name: p.leadName,
    template: p.template,
    templateLabel: templateLabelOf(p.template, labels),
    skin: p.style,
    channel: p.channel,
    sentAt: p.sentAt,
    views: p.visits.length,
    dwellSeconds: dwell,
    maxScroll: scroll,
    firstOpenHours: p.openedAt ? (p.openedAt.getTime() - p.sentAt.getTime()) / HOUR : null,
    score: mockScore(sig),
  };
}

const pctWhole = (a: number, b: number): number => (b ? Math.round((a / b) * 100) : NaN);

function mockCard(key: string, label: string, rows: readonly MockRow[], avgOpen: number, isAll: boolean): MockCard {
  const n = rows.length;
  const opened = rows.filter((r) => r.opened).length;
  const steps = MOCK_STEPS.map((s) => pctWhole(rows.filter((r) => mockStepHit(r, s)).length, n));
  const ci = wilson(opened, n);
  return {
    key,
    label,
    sent: n,
    opened,
    few: !isAll && n < MOCK_MIN_SENDS,
    steps,
    openDelta: Number.isFinite(steps[0]!) && Number.isFinite(avgOpen) ? steps[0]! - avgOpen : NaN,
    avgScore: n ? Math.round(rows.reduce((s, r) => s + r.score, 0) / n) : 0,
    ci: ci ? [Math.round(ci[0] * 100), Math.round(ci[1] * 100)] : null,
  };
}

/** README ④: name the most- and least-opened template among those with ≥ 10 sends. */
export function mockVerdict(cards: readonly MockCard[], avgOpen: number): MockVerdict {
  const big = cards.filter((c) => c.sent >= MOCK_MIN_SENDS).sort((a, b) => b.opened / b.sent - a.opened / a.sent);
  if (big.length < 2) return { kind: "none" };
  const top = big[0]!;
  const bottom = big[big.length - 1]!;
  const a = wilson(top.opened, top.sent)!;
  const b = wilson(bottom.opened, bottom.sent)!;
  return { kind: "compare", top, bottom, avgOpen, overlap: a[0] <= b[1] };
}

export function inMockChannel(c: Channel, ch: MockChannelFilter): boolean {
  if (ch === "email") return c === "email" || c === "email_sms";
  if (ch === "mobile") return c === "sms" || c === "mms" || c === "email_sms";
  return true;
}

/** README ⑧ ordering — the view and the client script sort by the same keys. */
export function sortMockRows(rows: readonly MockRow[], sort: MockSort): MockRow[] {
  const by =
    sort === "sent"
      ? (a: MockRow, b: MockRow) => b.sentAt.getTime() - a.sentAt.getTime()
      : sort === "dwell"
        ? (a: MockRow, b: MockRow) => b.dwellSeconds - a.dwellSeconds || b.sentAt.getTime() - a.sentAt.getTime()
        : (a: MockRow, b: MockRow) => b.score - a.score || b.dwellSeconds - a.dwellSeconds || b.sentAt.getTime() - a.sentAt.getTime();
  return [...rows].sort(by);
}

/** README ⑥/⑧: the list filter — template card + name search (case-insensitive substring). */
export function mockRowMatches(r: MockRow, tpl: string | null, q: string): boolean {
  return (!tpl || r.template === tpl) && (!q || r.name.toLowerCase().includes(q.toLowerCase()));
}

/** The pure fold of the Mock tab — the kb-shot fixtures and the check feed it synthetic facts. */
export function foldMockReport(
  all: readonly ProspectFacts[],
  labels: Readonly<Record<string, string>>,
  days: ReportDays,
  ch: MockChannelFilter,
  now: Date,
): MockReport {
  const from = days ? now.getTime() - days * DAY : -Infinity;
  const rows = sortMockRows(
    all.filter((p) => p.sentAt.getTime() >= from && inMockChannel(p.channel, ch)).map((p) => mockRowOf(p, labels)),
    "score",
  );
  const allCard = mockCard("", "", rows, NaN, true);
  const avgOpen = allCard.steps[0]!;
  const groups = new Map<string, MockRow[]>();
  for (const r of rows) groups.set(r.template, [...(groups.get(r.template) ?? []), r]);
  const cards = [...groups.entries()]
    .map(([k, rs]) => mockCard(k, rs[0]!.templateLabel, rs, avgOpen, false))
    .sort((a, b) => b.sent - a.sent || a.label.localeCompare(b.label, "hu"));
  return { days, ch, rows, all: allCard, cards, verdict: mockVerdict(cards, avgOpen) };
}

export async function getMockReport(days: ReportDays, ch: MockChannelFilter, labels: Readonly<Record<string, string>>, now = new Date()): Promise<MockReport> {
  return foldMockReport(await loadProspectFacts(), labels, days, ch, now);
}
