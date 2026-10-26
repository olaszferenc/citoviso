// Riport · Próba fül — what happens INSIDE a free trial (ADR-0407).
//
// Frozen plan: assets/design-refs/console/proba-riport/ (A+B hybrid, owner „mehet” 2026-10-26).
// The page answers „hol bukik el vagy nem egy rendelés a próba alatt": a ladder (how far the
// trialists get: login → save → own site → Megrendelem → order sent → paid, and where they
// stop), one row per trial with its 14 days on a strip, and on which day of the trial people
// actually work. Below it, the mock side's „same device or another one" split.
//
// SOURCES — one fact, one place (the 0117 migration header):
//   start      free_trial.started_at
//   inside     tenant_activity (admin_open, login, save, site_view, order_open, checkout)
//   sent       order_intent.submitted_at (the lead's order after the trial started)
//   paid       free_trial.converted_at
//   notices    free_trial_notice (status 'sent'; one marker per step, whatever the channel)
//   lapse      free_trial.lapsed_at
// A trial that started before tenant_activity existed has no measured inside: it is counted
// in the trial totals, but kept OUT of the ladder and the day chart, and its row says so —
// an empty strip would otherwise read as „did nothing" (§B.17: nothing invented).

import { sql } from "kysely";
import { db } from "../db/client.js";
import { isTestLeadName } from "../outreach/ownerTestPhone.js";
import { ELEK_LEAD_NAME } from "../elek/park.js";
import { budapestIsoDay } from "../text/budapestTime.js";
import { isoDayDiff } from "../text/zoneTime.js";
import { median, type ReportDays } from "./reportData.js";

export const TRIAL_DAYS = 14;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** An order opened (or a checkout step) with no sent order within this long = it stopped. */
export const STALL_AFTER_MS = HOUR;
/** No admin visit or save for this many days during a running trial = „csend". */
export const QUIET_DAYS = 3;

export type TrialStatusFilter = "all" | "active" | "converted" | "lapsed";
export const TRIAL_STATUS_FILTERS: readonly TrialStatusFilter[] = ["all", "active", "converted", "lapsed"];

/** The ladder, in order. A trial „reached" a stage when it has that stage's signal or any later one. */
export const TRIAL_STAGES = ["start", "login", "save", "site", "order", "sent", "paid"] as const;
export type TrialStage = (typeof TRIAL_STAGES)[number];

export type TrialEventKind =
  | "start"
  | "login"
  | "save"
  | "site"
  | "order"
  | "checkout"
  | "stall"
  | "sent"
  | "paid"
  | "notice"
  | "lapse";

export interface TrialEvent {
  readonly at: Date;
  /** 0-based day of the trial, Budapest calendar days (0 = the start day). */
  readonly day: number;
  readonly kind: TrialEventKind;
  /** login: via (password|link|null) · save: area · order: from · checkout/stall: step · notice: step. */
  readonly detail: string | null;
}

export type TrialVerdict =
  | { readonly k: "paid"; readonly day: number }
  | { readonly k: "lapsed"; readonly lastDay: number | null }
  | { readonly k: "stuck"; readonly step: string }
  | { readonly k: "ordered" }
  | { readonly k: "no_login"; readonly day: number }
  | { readonly k: "quiet"; readonly saved: boolean; readonly days: number }
  | { readonly k: "active"; readonly days: number }
  | { readonly k: "unmeasured" };

export interface TrialRow {
  readonly trialId: string;
  readonly leadId: string;
  readonly name: string;
  readonly town: string | null;
  readonly startedAt: Date;
  readonly status: "active" | "converted" | "lapsed";
  /** 1-based day of the trial today (active), capped at TRIAL_DAYS. */
  readonly dayNow: number;
  /** False when the trial started before tenant_activity was recorded. */
  readonly measured: boolean;
  readonly events: readonly TrialEvent[];
  /** Index into TRIAL_STAGES of the furthest stage reached. */
  readonly reached: number;
  readonly verdict: TrialVerdict;
  readonly logins: number;
  readonly saves: number;
}

export interface TrialTiming {
  readonly key: "first_login" | "first_save" | "first_order" | "order_to_paid";
  readonly n: number;
  readonly median: number | null;
  readonly max: number | null;
}

export interface VisitorSplit {
  readonly key: "once" | "same" | "other";
  readonly prospects: number;
  readonly trialed: number;
}

export interface TrialReport {
  readonly days: ReportDays;
  readonly st: TrialStatusFilter;
  /** The selected ladder stage (only trials that stopped there are listed), or null. */
  readonly stage: number | null;
  /** Every trial in the range + status filter (the KPIs and the ladder count these). */
  readonly trials: readonly TrialRow[];
  /** The list under the ladder: `trials`, narrowed to `stage` when one is selected. */
  readonly listed: readonly TrialRow[];
  /** When tenant_activity started recording (the 0117 migration's applied_at). */
  readonly measuredFrom: Date | null;
  /** Per stage: measured trials that reached it / stopped there (not converted). */
  readonly ladder: readonly { readonly reached: number; readonly stopped: number }[];
  readonly timings: readonly TrialTiming[];
  /** Per trial day (0..13): measured trials with an admin visit or a save that day. */
  readonly perDay: readonly number[];
  readonly visitors: readonly VisitorSplit[];
  /** Prospects that came back at all (the Tölcsér „Visszatér-e?" numerator) in the range. */
  readonly returned: number;
}

// ── pure derivation ───────────────────────────────────────────────────────────

export interface RawTrial {
  readonly trialId: string;
  readonly leadId: string;
  readonly name: string;
  readonly address: string | null;
  readonly startedAt: Date;
  readonly status: "active" | "converted" | "lapsed" | "purged";
  readonly convertedAt: Date | null;
  readonly lapsedAt: Date | null;
  readonly activity: readonly { readonly at: Date; readonly kind: string; readonly detail: Record<string, unknown> }[];
  readonly orderSentAt: readonly Date[];
  readonly notices: readonly { readonly at: Date; readonly step: string }[];
}

/** „8600 Siófok, Fő u. 1." → „Siófok"; anything else → its first comma part. */
export function townOf(address: string | null): string | null {
  if (!address) return null;
  const m = /\b\d{4}\s+([^,\d][^,]*)/.exec(address);
  const t = (m ? m[1] : address.split(",")[0])!.trim();
  return t || null;
}

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/** One trial's timeline, ladder position and verdict (`now` decides „csend" and the stall). */
export function deriveTrial(r: RawTrial, measuredFrom: Date | null, now: Date): TrialRow {
  const day0 = budapestIsoDay(r.startedAt);
  const dayOf = (at: Date): number => Math.max(0, isoDayDiff(day0, budapestIsoDay(at)));
  const status = r.status === "purged" ? "lapsed" : r.status;
  const ev: TrialEvent[] = [{ at: r.startedAt, day: 0, kind: "start", detail: null }];

  // admin_open is the visit; a login row just before it only names HOW they came in.
  const logins = r.activity.filter((a) => a.kind === "login");
  for (const a of r.activity) {
    if (a.kind === "admin_open") {
      const l = logins.find((x) => x.at.getTime() <= a.at.getTime() + 60_000 && a.at.getTime() - x.at.getTime() <= 5 * 60_000);
      ev.push({ at: a.at, day: dayOf(a.at), kind: "login", detail: l ? str(l.detail.via) : null });
    } else if (a.kind === "save") ev.push({ at: a.at, day: dayOf(a.at), kind: "save", detail: str(a.detail.area) });
    else if (a.kind === "site_view") ev.push({ at: a.at, day: dayOf(a.at), kind: "site", detail: null });
    else if (a.kind === "order_open") ev.push({ at: a.at, day: dayOf(a.at), kind: "order", detail: str(a.detail.from) });
    else if (a.kind === "checkout" && a.detail.step !== "submitted")
      ev.push({ at: a.at, day: dayOf(a.at), kind: "checkout", detail: str(a.detail.step) });
  }
  // A login with no admin_open next to it (the admin never answered 200) still is a login.
  for (const l of logins) {
    if (!ev.some((e) => e.kind === "login" && Math.abs(e.at.getTime() - l.at.getTime()) <= 5 * 60_000))
      ev.push({ at: l.at, day: dayOf(l.at), kind: "login", detail: str(l.detail.via) });
  }
  for (const at of r.orderSentAt) ev.push({ at, day: dayOf(at), kind: "sent", detail: null });
  const seenStep = new Set<string>();
  for (const n of r.notices) {
    if (seenStep.has(n.step)) continue;
    seenStep.add(n.step);
    ev.push({ at: n.at, day: dayOf(n.at), kind: "notice", detail: n.step });
  }
  if (r.convertedAt) ev.push({ at: r.convertedAt, day: dayOf(r.convertedAt), kind: "paid", detail: null });
  if (status === "lapsed" && r.lapsedAt) ev.push({ at: r.lapsedAt, day: dayOf(r.lapsedAt), kind: "lapse", detail: null });

  // The stall: the last order step with no sent order after it, older than STALL_AFTER_MS.
  if (!r.convertedAt) {
    const steps = ev.filter((e) => e.kind === "order" || e.kind === "checkout").sort((a, b) => a.at.getTime() - b.at.getTime());
    const last = steps[steps.length - 1];
    if (last && !r.orderSentAt.some((s) => s.getTime() >= last.at.getTime())) {
      const at = new Date(last.at.getTime() + STALL_AFTER_MS);
      if (at.getTime() <= now.getTime())
        ev.push({ at, day: dayOf(at), kind: "stall", detail: last.kind === "order" ? "package" : last.detail });
    }
  }
  ev.sort((a, b) => a.at.getTime() - b.at.getTime());

  const measured = !!measuredFrom && r.startedAt.getTime() >= measuredFrom.getTime();
  const has = (k: TrialEventKind): boolean => ev.some((e) => e.kind === k);
  const sig: Record<TrialStage, boolean> = {
    start: true,
    login: has("login"),
    save: has("save"),
    site: has("site"),
    order: has("order") || has("checkout"),
    sent: has("sent"),
    paid: has("paid"),
  };
  let reached = 0;
  TRIAL_STAGES.forEach((s, i) => {
    if (sig[s]) reached = i;
  });

  const dayNow = Math.min(TRIAL_DAYS, dayOf(now) + 1);
  const life = ev.filter((e) => e.kind === "login" || e.kind === "save" || e.kind === "site" || e.kind === "order" || e.kind === "checkout");
  const lastLife = life[life.length - 1];
  const quietDays = Math.floor((now.getTime() - (lastLife ? lastLife.at : r.startedAt).getTime()) / DAY);
  const stall = ev.find((e) => e.kind === "stall");
  let verdict: TrialVerdict;
  if (status === "converted") verdict = { k: "paid", day: r.convertedAt ? dayOf(r.convertedAt) : dayNow - 1 };
  else if (status === "lapsed") verdict = { k: "lapsed", lastDay: lastLife ? lastLife.day : null };
  else if (!measured) verdict = { k: "unmeasured" };
  else if (stall) verdict = { k: "stuck", step: stall.detail ?? "package" };
  else if (sig.order) verdict = { k: "ordered" };
  else if (!sig.login) verdict = { k: "no_login", day: dayNow };
  else if (quietDays >= QUIET_DAYS) verdict = { k: "quiet", saved: sig.save, days: quietDays };
  else verdict = { k: "active", days: quietDays };

  return {
    trialId: r.trialId,
    leadId: r.leadId,
    name: r.name,
    town: townOf(r.address),
    startedAt: r.startedAt,
    status,
    dayNow,
    measured,
    events: ev,
    reached,
    verdict,
    logins: ev.filter((e) => e.kind === "login").length,
    saves: ev.filter((e) => e.kind === "save").length,
  };
}

/** The ladder over the MEASURED trials: reached ≥ stage / stopped exactly there (not converted). */
export function ladderOf(trials: readonly TrialRow[]): { reached: number; stopped: number }[] {
  const m = trials.filter((t) => t.measured);
  return TRIAL_STAGES.map((_, i) => ({
    reached: m.filter((t) => t.reached >= i).length,
    stopped: m.filter((t) => t.reached === i && t.status !== "converted").length,
  }));
}

export function timingsOf(trials: readonly TrialRow[]): TrialTiming[] {
  const first = (t: TrialRow, k: TrialEventKind): Date | null => t.events.find((e) => e.kind === k)?.at ?? null;
  const span = (key: TrialTiming["key"], from: (t: TrialRow) => Date | null, to: (t: TrialRow) => Date | null): TrialTiming => {
    const v = trials
      .filter((t) => t.measured)
      .map((t) => {
        const a = from(t);
        const b = to(t);
        return a && b ? b.getTime() - a.getTime() : null;
      })
      .filter((x): x is number => x !== null && x >= 0);
    return { key, n: v.length, median: v.length ? median(v) : null, max: v.length ? Math.max(...v) : null };
  };
  return [
    span("first_login", (t) => t.startedAt, (t) => first(t, "login")),
    span("first_save", (t) => t.startedAt, (t) => first(t, "save")),
    span("first_order", (t) => t.startedAt, (t) => first(t, "order")),
    span("order_to_paid", (t) => first(t, "order"), (t) => first(t, "paid")),
  ];
}

export function perDayOf(trials: readonly TrialRow[]): number[] {
  return Array.from({ length: TRIAL_DAYS }, (_, d) =>
    trials.filter((t) => t.measured && t.events.some((e) => e.day === d && (e.kind === "login" || e.kind === "save"))).length,
  );
}

/**
 * The mock side (plan: „ugyanaz tér vissza, vagy továbbküldték?”). No new identifier (ADR-0108:
 * no cookie, nothing stored in the browser): a visit's device class + OS + browser, already on
 * mock_view, tells one device from another. Two identical phones look the same — the split
 * under-counts „other device", it never invents one.
 */
export function visitorSplitOf(
  views: readonly { readonly prospectId: string; readonly device: string | null; readonly os: string | null; readonly browser: string | null }[],
  trialedProspects: ReadonlySet<string>,
): { splits: VisitorSplit[]; returned: number } {
  const by = new Map<string, { n: number; devs: Set<string> }>();
  for (const v of views) {
    const e = by.get(v.prospectId) ?? { n: 0, devs: new Set<string>() };
    e.n++;
    e.devs.add(`${v.device ?? "?"}|${v.os ?? "?"}|${v.browser ?? "?"}`);
    by.set(v.prospectId, e);
  }
  const acc: Record<VisitorSplit["key"], { prospects: number; trialed: number }> = {
    once: { prospects: 0, trialed: 0 },
    same: { prospects: 0, trialed: 0 },
    other: { prospects: 0, trialed: 0 },
  };
  for (const [pid, e] of by) {
    const k: VisitorSplit["key"] = e.n < 2 ? "once" : e.devs.size > 1 ? "other" : "same";
    acc[k].prospects++;
    if (trialedProspects.has(pid)) acc[k].trialed++;
  }
  return {
    splits: (["once", "same", "other"] as const).map((key) => ({ key, ...acc[key] })),
    returned: acc.same.prospects + acc.other.prospects,
  };
}

// ── loading ───────────────────────────────────────────────────────────────────

const isTest = (name: string): boolean => isTestLeadName(name) || name === ELEK_LEAD_NAME;
const toDate = (v: unknown): Date => (v instanceof Date ? v : new Date(String(v)));

export async function getTrialReport(
  days: ReportDays,
  st: TrialStatusFilter,
  stage: number | null,
  now = new Date(),
): Promise<TrialReport> {
  const since = days ? new Date(now.getTime() - days * DAY) : null;
  // The inside is measured from the moment the 0117 table existed (its migration's applied_at) —
  // not from the first row: days without a login would push that later and wrongly mark the
  // trials started in between as unmeasured.
  const mig = await sql<{ at: Date | null }>`select applied_at as at from schema_migrations where name = '0117_tenant_activity.sql'`.execute(db);
  const measuredFrom = mig.rows[0]?.at ? toDate(mig.rows[0].at) : null;

  // Only trials whose lead was actually reached (a SENT outreach), test leads out — the same
  // population as the Tölcsér's „Próba" step.
  let q = db
    .selectFrom("free_trial")
    .innerJoin("lead", "lead.id", "free_trial.lead_id")
    .select([
      "free_trial.id as trialId",
      "free_trial.lead_id as leadId",
      "free_trial.tenant_id as tenantId",
      "free_trial.started_at as startedAt",
      "free_trial.status as status",
      "free_trial.converted_at as convertedAt",
      "free_trial.lapsed_at as lapsedAt",
      "lead.name as name",
      "lead.address as address",
    ])
    .where(({ exists, selectFrom }) =>
      exists(selectFrom("prospect").select("prospect.id").whereRef("prospect.lead_id", "=", "free_trial.lead_id").where("prospect.sent_at", "is not", null)),
    );
  if (since) q = q.where("free_trial.started_at", ">=", since);
  const base = (await q.orderBy("free_trial.started_at", "desc").execute()).filter((r) => !isTest(r.name));

  const tenantIds = base.map((r) => r.tenantId).filter((x): x is string => !!x);
  const leadIds = base.map((r) => r.leadId);
  const trialIds = base.map((r) => r.trialId);
  const [acts, orders, notices] = await Promise.all([
    tenantIds.length
      ? db
          .selectFrom("tenant_activity")
          .select(["tenant_id", "kind", "detail", "occurred_at"])
          .where("tenant_id", "in", tenantIds)
          .orderBy("occurred_at")
          .execute()
      : Promise.resolve([]),
    leadIds.length
      ? db
          .selectFrom("order_intent")
          .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
          .select(["prospect.lead_id as leadId", "order_intent.submitted_at as submittedAt"])
          .where("prospect.lead_id", "in", leadIds)
          .where("order_intent.submitted_at", "is not", null)
          .execute()
      : Promise.resolve([]),
    trialIds.length
      ? db
          .selectFrom("free_trial_notice")
          .select(["free_trial_id", "step", "created_at"])
          .where("free_trial_id", "in", trialIds)
          .where("status", "=", "sent")
          .orderBy("created_at")
          .execute()
      : Promise.resolve([]),
  ]);

  const raws: RawTrial[] = base.map((r) => {
    const startedAt = toDate(r.startedAt);
    const end = r.convertedAt ? toDate(r.convertedAt) : r.lapsedAt ? toDate(r.lapsedAt) : now;
    const inWindow = (at: Date): boolean => at.getTime() >= startedAt.getTime() && at.getTime() <= end.getTime() + HOUR;
    return {
      trialId: r.trialId,
      leadId: r.leadId,
      name: r.name,
      address: r.address,
      startedAt,
      status: r.status,
      convertedAt: r.convertedAt ? toDate(r.convertedAt) : null,
      lapsedAt: r.lapsedAt ? toDate(r.lapsedAt) : null,
      activity: acts
        .filter((a) => a.tenant_id === r.tenantId)
        .map((a) => ({ at: toDate(a.occurred_at), kind: a.kind, detail: (a.detail ?? {}) as Record<string, unknown> }))
        .filter((a) => inWindow(a.at)),
      orderSentAt: orders.filter((o) => o.leadId === r.leadId).map((o) => toDate(o.submittedAt)).filter(inWindow),
      notices: notices.filter((n) => n.free_trial_id === r.trialId).map((n) => ({ at: toDate(n.created_at), step: n.step })),
    };
  });

  // The mock side: every SENT prospect in the range (by send time), test leads out.
  let vq = db
    .selectFrom("mock_view")
    .innerJoin("prospect", "prospect.id", "mock_view.prospect_id")
    .innerJoin("lead", "lead.id", "prospect.lead_id")
    .select(["mock_view.prospect_id as prospectId", "mock_view.device", "mock_view.os", "mock_view.browser", "lead.name as name"])
    .where("prospect.sent_at", "is not", null)
    .where((eb) => eb.or([eb("mock_view.device", "is", null), eb("mock_view.device", "!=", "bot")]));
  if (since) vq = vq.where("prospect.sent_at", ">=", since);
  const views = (await vq.execute()).filter((v) => !isTest(v.name));
  const trialed = new Set(
    (
      await db
        .selectFrom("free_trial")
        .select("prospect_id")
        .where("prospect_id", "is not", null)
        .execute()
    ).map((r) => r.prospect_id as string),
  );
  return foldTrialReport(raws, measuredFrom, days, st, stage, now, views, trialed);
}

/** The page's numbers from already-loaded rows — no DB (the KB screenshots fold sample rows). */
export function foldTrialReport(
  raws: readonly RawTrial[],
  measuredFrom: Date | null,
  days: ReportDays,
  st: TrialStatusFilter,
  stage: number | null,
  now: Date,
  views: readonly { readonly prospectId: string; readonly device: string | null; readonly os: string | null; readonly browser: string | null }[],
  trialedProspects: ReadonlySet<string>,
): TrialReport {
  const all = raws.map((r) => deriveTrial(r, measuredFrom, now));
  const trials = st === "all" ? all : all.filter((t) => t.status === st);
  const sel = stage !== null && stage >= 0 && stage < TRIAL_STAGES.length - 1 ? stage : null;
  const listed = sel === null ? trials : trials.filter((t) => t.measured && t.reached === sel && t.status !== "converted");
  const { splits, returned } = visitorSplitOf(views, trialedProspects);
  return {
    days,
    st,
    stage: sel,
    trials,
    listed,
    measuredFrom,
    ladder: ladderOf(trials),
    timings: timingsOf(trials),
    perDay: perDayOf(trials),
    visitors: splits,
    returned,
  };
}
