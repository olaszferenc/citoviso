// KÍSÉRLET-MOTOR — the cold letter's variants, chosen by Thompson sampling
// (ADR-0462 kiserlet-motor-hideg-megkereses, brief kiserlet-motor-20261121 ①③).
//
// Every cold letter carries ONE variant of each dimension (subject · first_line · sender ·
// body_style · image), recorded per prospect in `outreach_send_variant`. The catalog is
// `outreach_variant`; the control of each dimension is TODAY'S letter and carries no text, so
// with only the controls enabled (the state this lands in) every letter is byte for byte what
// it was — the engine only starts LABELLING and MEASURING.
//
// The day's cap is split among the ENABLED variants of a dimension once per Budapest day:
//   P(best) under Beta(opens72 + 1, mature − opens72 + 1)  — 72-hour link open (mock_view, no
//   bots, the e-mail's own `?e` letter) is the primary goal; the 24-hour mail open (email_open)
//   is reported apart, it does not steer;
//   floor: every enabled variant gets ≥ floorPct of the cap (exploration never stops);
//   each send then takes the variant furthest below its share of today's cap.
// Guard (once a day, before the split): ≥ minSends letters and an unsubscribe rate above the
// CONTROL's own rate + unsubMargin (coordinator 2026-11-21: relative, because the measured baseline
// is 1.2% — an absolute 0.5% would drop every candidate), or a complaint-worded reply → the variant
// is DISABLED, logged and the house is alerted. Until the control itself has minSends letters the
// unsubscribe rule does not judge (no baseline). The control is never disabled by the machine — it
// is the letter the owner already runs; it alerts only (complaint, or above controlAlertMax).
//
// ⛔ No variant bypasses a gate: the send path judges the FINISHED letter (subject + the visible
// first line + the body) with the §C gate after the variant is applied, and falls back to the
// control on a FLAG (sendBatch.ts). The tényhűség gate (Vera's verdict) is on the mock and the
// body, which no variant changes.
//
// Only Hungarian letters take part: the variant wording lives in the catalog in Hungarian, and a
// foreign letter goes out wholly in its own language (ADR-0456) — it always gets the control and
// is not recorded.

import { sql } from "kysely";
import { db } from "../db/client.js";
import { getSetting, setSetting } from "../console/appSettings.js";
import { alertHouse } from "../console/houseAlert.js";
import { config } from "../config.js";
import { budapestIsoDay, budapestMidnight } from "../text/budapestTime.js";
import type { ExperimentDimension } from "../db/schema.js";
import { personalSenderName, priceSentence, subjectIsThisYours } from "./experimentCopy.js";
import { T } from "../i18n/mail.js";
import { collectFallbacks } from "../i18n/packs.js";

export const DIMENSIONS: readonly ExperimentDimension[] = ["subject", "first_line", "sender", "body_style", "image", "price_line"];
export const CONTROL_KEY = "control";
/** The order assignVariants decides the dimensions in (body_style first — the others depend on it). */
const ASSIGN_ORDER: readonly ExperimentDimension[] = ["body_style", "subject", "first_line", "sender", "image", "price_line"];
export const EXPERIMENT_SETTING_KEY = "outreach_experiment";

export interface ExperimentSettings {
  /** Exploration floor: every enabled variant gets at least this share of the day's cap. */
  readonly floorPct: number;
  /** The guard judges a variant only after this many letters. */
  readonly minSends: number;
  /** A variant is disabled when its unsubscribe rate exceeds the control's by more than this (0.005 = 0.5 point). */
  readonly unsubMargin: number;
  /** The control alerts (never disabled) above this absolute unsubscribe rate (0.02 = 2 %; measured baseline 1.2 %). */
  readonly controlAlertMax: number;
}

export const DEFAULT_EXPERIMENT: ExperimentSettings = { floorPct: 10, minSends: 100, unsubMargin: 0.005, controlAlertMax: 0.02 };

/** The day's split, stored once per Budapest day. */
export interface DailyPlan {
  readonly day: string;
  readonly cap: number;
  readonly shares: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

interface StoredExperiment extends Partial<ExperimentSettings> {
  plan?: DailyPlan;
  /** "dimension:key:day" of control alerts already sent (one per day). */
  alerted?: string[];
}

// ── pure core (scripts/experiment-selftest.mts fixes these) ───────────────────────────────

/** Deterministic 32-bit seed from a string (FNV-1a). */
export function seedOf(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32 — a small seeded PRNG in [0, 1). */
export function rngOf(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(rng: () => number): number {
  // Box–Muller; 1 − u keeps log away from 0.
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Gamma(shape, 1) by Marsaglia–Tsang (shape ≥ 1; Beta parameters here are always ≥ 1). */
function gamma(shape: number, rng: () => number): number {
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = normal(rng);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * x ** 4) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

export function sampleBeta(a: number, b: number, rng: () => number): number {
  const x = gamma(a, rng);
  const y = gamma(b, rng);
  return x / (x + y);
}

export interface ArmStat {
  readonly key: string;
  /** Letters old enough to be judged (≥ 72 h). */
  readonly trials: number;
  /** Of those, opened by link within 72 h. */
  readonly successes: number;
}

/** P(best) per arm by Monte-Carlo Thompson draws. */
export function thompsonShares(arms: readonly ArmStat[], rng: () => number, draws = 4000): Record<string, number> {
  const wins: Record<string, number> = Object.fromEntries(arms.map((a) => [a.key, 0]));
  if (arms.length === 0) return wins;
  if (arms.length === 1) return { [arms[0].key]: 1 };
  for (let i = 0; i < draws; i++) {
    let best = "";
    let bestV = -1;
    for (const a of arms) {
      const s = Math.max(0, Math.min(a.successes, a.trials));
      const v = sampleBeta(s + 1, a.trials - s + 1, rng);
      if (v > bestV) {
        bestV = v;
        best = a.key;
      }
    }
    wins[best]++;
  }
  for (const k of Object.keys(wins)) wins[k] /= draws;
  return wins;
}

/**
 * Lift every share to ≥ floor and rescale the rest (water-filling). When n × floor ≥ 1 the
 * floor cannot hold for all → equal split.
 */
export function applyFloor(shares: Readonly<Record<string, number>>, floor: number): Record<string, number> {
  const keys = Object.keys(shares);
  if (keys.length === 0) return {};
  if (keys.length * floor >= 1) return Object.fromEntries(keys.map((k) => [k, 1 / keys.length]));
  const fixed = new Set<string>();
  let out: Record<string, number> = { ...shares };
  for (let guard = 0; guard <= keys.length; guard++) {
    const free = keys.filter((k) => !fixed.has(k));
    const room = 1 - fixed.size * floor;
    const freeSum = free.reduce((s, k) => s + Math.max(0, shares[k]), 0);
    out = Object.fromEntries(
      keys.map((k) => [k, fixed.has(k) ? floor : freeSum > 0 ? (Math.max(0, shares[k]) / freeSum) * room : room / free.length]),
    );
    const low = free.filter((k) => out[k] < floor - 1e-12);
    if (low.length === 0) break;
    for (const k of low) fixed.add(k);
  }
  return out;
}

/** The day's split of ONE dimension: Thompson P(best), then the floor. */
export function allocateDimension(arms: readonly ArmStat[], floorPct: number, seed: string): Record<string, number> {
  return applyFloor(thompsonShares(arms, rngOf(seedOf(seed))), floorPct / 100);
}

/**
 * The variant for the next letter: among the APPLICABLE enabled keys, the one furthest below its
 * share of today's cap. Ties → the larger share, then the key (deterministic).
 */
export function pickVariant(
  shares: Readonly<Record<string, number>>,
  sentToday: Readonly<Record<string, number>>,
  cap: number,
  applicable: readonly string[],
): string | null {
  const keys = applicable.filter((k) => k in shares);
  if (keys.length === 0) return null;
  let best: string | null = null;
  let bestDef = -Infinity;
  for (const k of [...keys].sort()) {
    const def = shares[k] * Math.max(1, cap) - (sentToday[k] ?? 0);
    if (def > bestDef + 1e-9 || (Math.abs(def - bestDef) <= 1e-9 && best !== null && shares[k] > shares[best])) {
      best = k;
      bestDef = def;
    }
  }
  return best;
}

export interface GuardInput {
  readonly sends: number;
  readonly unsubs: number;
  readonly complaints: number;
}

const pct2 = (x: number): string => `${(x * 100).toFixed(2)}%`;

/**
 * The guard's verdict on one NON-control variant: the reason to disable it, or null.
 * `control` = the same dimension's control numbers (the baseline); without ≥ minSends control
 * letters the unsubscribe rule does not judge.
 */
export function guardVerdict(s: GuardInput, cfg: ExperimentSettings, control: GuardInput | null): string | null {
  if (s.complaints > 0) return `panasz-jel a válaszokban (${s.complaints})`;
  if (s.sends < cfg.minSends || !control || control.sends < cfg.minSends) return null;
  const base = control.unsubs / control.sends;
  const limit = base + cfg.unsubMargin;
  const rate = s.unsubs / s.sends;
  if (rate > limit + 1e-12) {
    return `leiratkozás ${pct2(rate)} > kontroll ${pct2(base)} + ${(cfg.unsubMargin * 100).toFixed(2)} pont (${s.unsubs}/${s.sends})`;
  }
  return null;
}

/** The control's alert (it is never disabled): a complaint, or an absolute rate above controlAlertMax. */
export function controlAlertVerdict(s: GuardInput, cfg: ExperimentSettings): string | null {
  if (s.complaints > 0) return `panasz-jel a válaszokban (${s.complaints})`;
  if (s.sends >= cfg.minSends && s.unsubs / s.sends > cfg.controlAlertMax) {
    return `leiratkozás ${pct2(s.unsubs / s.sends)} > ${pct2(cfg.controlAlertMax)} (${s.unsubs}/${s.sends})`;
  }
  return null;
}

/** A complaint-worded reply (no feedback loop exists; the reply text is the signal we have). */
export const COMPLAINT_PATTERN = /\bspam|zaklat|feljelent|panasz|NAIH|adatvédelmi hatóság|jogi lépés/i;

/** Fill {name} / {city} / {price} / {offerPrice}; null when a placeholder has no value (the variant does not apply to this lead). */
export function renderTemplate(
  template: string,
  vars: { name: string; city?: string | null; price?: string | null; offerPrice?: string | null },
): string | null {
  let missing = false;
  const out = template.replace(/\{(name|city|price|offerPrice)\}/g, (_m, k: "name" | "city" | "price" | "offerPrice") => {
    const v = (k === "name" ? vars.name : vars[k] ?? "").trim();
    if (!v) missing = true;
    return v;
  });
  return missing || /\{[a-z]+\}/.test(out) ? null : out;
}

/** The From display name a sender variant asks for; undefined = the control (no override); null = not applicable. */
export function senderNameOf(key: string): string | undefined | null {
  if (key === CONTROL_KEY) return undefined;
  // „szemelyes” (coordinator 2026-11-22): the personal sender of the follow-up letter — config, never hardcoded.
  if (key === "szemelyes") return personalSenderName() || null;
  const person = (config.outreachSender.name || "").trim();
  if (!person) return null;
  if (key === "person") return person;
  if (key === "person_brand") return `${person} – Citoviso`;
  return null;
}

// ── settings + plan ─────────────────────────────────────────────────────────────────────────

async function readStored(): Promise<StoredExperiment> {
  const raw = await getSetting(EXPERIMENT_SETTING_KEY);
  try {
    return raw ? (JSON.parse(raw) as StoredExperiment) : {};
  } catch {
    return {};
  }
}

export async function getExperimentSettings(): Promise<ExperimentSettings & { plan?: DailyPlan }> {
  const s = await readStored();
  const num = (v: unknown, d: number, ok: (n: number) => boolean): number => (typeof v === "number" && ok(v) ? v : d);
  return {
    floorPct: num(s.floorPct, DEFAULT_EXPERIMENT.floorPct, (n) => n >= 0 && n <= 50),
    minSends: num(s.minSends, DEFAULT_EXPERIMENT.minSends, (n) => Number.isInteger(n) && n >= 1),
    unsubMargin: num(s.unsubMargin, DEFAULT_EXPERIMENT.unsubMargin, (n) => n >= 0 && n < 1),
    controlAlertMax: num(s.controlAlertMax, DEFAULT_EXPERIMENT.controlAlertMax, (n) => n > 0 && n < 1),
    ...(s.plan ? { plan: s.plan } : {}),
  };
}

export interface CatalogRow {
  readonly dimension: ExperimentDimension;
  readonly key: string;
  readonly label: string;
  readonly template: string | null;
  readonly isControl: boolean;
  readonly enabled: boolean;
  readonly disabledReason: string | null;
}

export async function loadCatalog(): Promise<CatalogRow[]> {
  const rows = await db.selectFrom("outreach_variant").selectAll().orderBy("dimension").orderBy("is_control", "desc").orderBy("key").execute();
  return rows.map((r) => ({
    dimension: r.dimension,
    key: r.key,
    label: r.label,
    template: r.template,
    isControl: r.is_control,
    enabled: r.enabled,
    disabledReason: r.disabled_reason,
  }));
}

export interface VariantStats {
  readonly dimension: ExperimentDimension;
  readonly key: string;
  readonly sends: number;
  readonly sentToday: number;
  /** Letters ≥ 72 h old (Thompson's trials). */
  readonly mature72: number;
  /** Of those, link-opened from the letter within 72 h (Thompson's successes). */
  readonly link72: number;
  /** Letters ≥ 24 h old and, of those, link-opened / mail-opened within 24 h. */
  readonly mature24: number;
  readonly link24: number;
  readonly mail24: number;
  /** Letters whose hero only Apple's proxy fetched (no open known). */
  readonly prefetchOnly: number;
  readonly replies: number;
  readonly unsubs: number;
  readonly complaints: number;
}

/** Per variant, every number the allocation, the guard and the report use. One query.
 *  `onlyProspects` narrows to those letters (the report's country strip); absent = every letter. */
export async function loadVariantStats(now = new Date(), onlyProspects?: readonly string[]): Promise<VariantStats[]> {
  const today = budapestMidnight(budapestIsoDay(now));
  const r = await sql<{
    dimension: ExperimentDimension;
    variant_key: string;
    sends: string;
    sent_today: string;
    mature72: string;
    link72: string;
    mature24: string;
    link24: string;
    mail24: string;
    prefetch_only: string;
    replies: string;
    unsubs: string;
    complaints: string;
  }>`
    select sv.dimension, sv.variant_key,
      count(*) as sends,
      count(*) filter (where sv.sent_at >= ${today}) as sent_today,
      count(*) filter (where sv.sent_at <= ${now}::timestamptz - interval '72 hours') as mature72,
      count(*) filter (where sv.sent_at <= ${now}::timestamptz - interval '72 hours' and f.link72) as link72,
      count(*) filter (where sv.sent_at <= ${now}::timestamptz - interval '24 hours') as mature24,
      count(*) filter (where sv.sent_at <= ${now}::timestamptz - interval '24 hours' and f.link24) as link24,
      count(*) filter (where sv.sent_at <= ${now}::timestamptz - interval '24 hours' and f.mail24) as mail24,
      count(*) filter (where f.prefetch and not f.mail_any) as prefetch_only,
      count(*) filter (where f.replied) as replies,
      count(*) filter (where f.unsub) as unsubs,
      count(*) filter (where f.complaint) as complaints
    from outreach_send_variant sv
    join prospect p on p.id = sv.prospect_id
    cross join lateral (
      select
        exists (select 1 from mock_view v where v.prospect_id = sv.prospect_id and coalesce(v.device, '') <> 'bot'
                  and v.open_via = 'email' and v.started_at between sv.sent_at and sv.sent_at + interval '72 hours') as link72,
        exists (select 1 from mock_view v where v.prospect_id = sv.prospect_id and coalesce(v.device, '') <> 'bot'
                  and v.open_via = 'email' and v.started_at between sv.sent_at and sv.sent_at + interval '24 hours') as link24,
        exists (select 1 from email_open o where o.prospect_id = sv.prospect_id and o.kind = 'open' and not o.own
                  and o.at between sv.sent_at and sv.sent_at + interval '24 hours') as mail24,
        exists (select 1 from email_open o where o.prospect_id = sv.prospect_id and o.kind = 'open' and not o.own) as mail_any,
        exists (select 1 from email_open o where o.prospect_id = sv.prospect_id and o.kind = 'proxy_prefetch') as prefetch,
        exists (select 1 from outreach_reply r where r.prospect_id = sv.prospect_id and r.received_at >= sv.sent_at) as replied,
        p.unsubscribed_at is not null as unsub,
        exists (select 1 from outreach_reply r where r.prospect_id = sv.prospect_id and r.received_at >= sv.sent_at
                  and r.body ~* ${COMPLAINT_PATTERN.source.replace("\\b", "")}) as complaint
    ) f
    -- As of the given now (the weekly line reads the stats as they stood at the week's end).
    where sv.sent_at <= ${now}
    ${onlyProspects ? sql`and sv.prospect_id = any(${[...onlyProspects]})` : sql``}
    group by sv.dimension, sv.variant_key
  `.execute(db);
  return r.rows.map((x) => ({
    dimension: x.dimension,
    key: x.variant_key,
    sends: Number(x.sends),
    sentToday: Number(x.sent_today),
    mature72: Number(x.mature72),
    link72: Number(x.link72),
    mature24: Number(x.mature24),
    link24: Number(x.link24),
    mail24: Number(x.mail24),
    prefetchOnly: Number(x.prefetch_only),
    replies: Number(x.replies),
    unsubs: Number(x.unsubs),
    complaints: Number(x.complaints),
  }));
}

/** Disable what the guard rejects (non-control only; a control alerts once a day). */
async function runGuard(catalog: readonly CatalogRow[], stats: readonly VariantStats[], cfg: ExperimentSettings, day: string): Promise<Set<string>> {
  const disabled = new Set<string>();
  const stored = await readStored();
  const alerted = new Set(stored.alerted ?? []);
  let alertedChanged = false;
  for (const v of catalog) {
    if (!v.enabled) continue;
    const s = stats.find((x) => x.dimension === v.dimension && x.key === v.key);
    if (!s) continue;
    const ctl = catalog.find((x) => x.dimension === v.dimension && x.isControl);
    const ctlStats = ctl ? stats.find((x) => x.dimension === v.dimension && x.key === ctl.key) ?? null : null;
    const reason = v.isControl ? controlAlertVerdict(s, cfg) : guardVerdict(s, cfg, ctlStats);
    if (!reason) continue;
    if (v.isControl) {
      const tag = `${v.dimension}:${v.key}:${day}`;
      if (alerted.has(tag)) continue;
      alerted.add(tag);
      alertedChanged = true;
      console.warn(`[experiment] őr: a KONTROLL (${v.dimension}) is átlépte a küszöböt — ${reason}; a kontrollt a gép nem kapcsolja ki`);
      await alertHouse({
        tag: "experiment-guard",
        subject: `Kísérlet-őr: a mai levél (${v.dimension}) átlépte a küszöböt — ${reason}`,
        text: `A kísérlet-motor őre a KONTROLL változatnál (a ma kimenő levél, dimenzió: ${v.dimension}) jelez: ${reason}. A kontrollt a gép nem kapcsolja ki, ez döntés a tulajnak/koordinátornak (küszöb: app_setting outreach_experiment.controlAlertMax).`,
        sms: false,
      });
      continue;
    }
    await db
      .updateTable("outreach_variant")
      .set({ enabled: false, disabled_reason: `őr: ${reason}`.slice(0, 500), disabled_at: new Date() })
      .where("dimension", "=", v.dimension)
      .where("key", "=", v.key)
      .execute();
    disabled.add(`${v.dimension}:${v.key}`);
    console.warn(`[experiment] őr: ${v.dimension}/${v.key} KIKAPCSOLVA — ${reason}`);
    await alertHouse({
      tag: "experiment-guard",
      subject: `Kísérlet-változat kikapcsolva: ${v.dimension}/${v.key} — ${reason}`,
      text: `A kísérlet-motor őre kikapcsolta a(z) „${v.label}” változatot (${v.dimension}/${v.key}): ${reason}. A levelek a többi engedélyezett változattal mennek tovább. Visszakapcsolás csak kézzel (outreach_variant.enabled).`,
      sms: false,
    });
  }
  if (alertedChanged) {
    await setSetting(EXPERIMENT_SETTING_KEY, JSON.stringify({ ...(await readStored()), alerted: [...alerted].slice(-200) }));
  }
  return disabled;
}

/**
 * Today's plan: on the first call of a Budapest day the guard runs and the split is computed and
 * stored; later calls reuse it (only the cap is refreshed when the caller knows a new one).
 * `cap` absent → today's stored cap, else the dispatcher's default.
 */
export async function ensureDailyPlan(now: Date, cap?: number): Promise<DailyPlan> {
  const day = budapestIsoDay(now);
  const cfg = await getExperimentSettings();
  if (cfg.plan?.day === day) {
    if (cap !== undefined && cap !== cfg.plan.cap) {
      const plan = { ...cfg.plan, cap };
      await setSetting(EXPERIMENT_SETTING_KEY, JSON.stringify({ ...(await readStored()), plan }));
      return plan;
    }
    return cfg.plan;
  }
  const [catalog0, stats] = await Promise.all([loadCatalog(), loadVariantStats(now)]);
  const off = await runGuard(catalog0, stats, cfg, day);
  const catalog = catalog0.map((v) => (off.has(`${v.dimension}:${v.key}`) ? { ...v, enabled: false } : v));
  const shares: Record<string, Record<string, number>> = {};
  for (const dim of DIMENSIONS) {
    const arms: ArmStat[] = catalog
      .filter((v) => v.dimension === dim && v.enabled)
      .map((v) => {
        const s = stats.find((x) => x.dimension === dim && x.key === v.key);
        return { key: v.key, trials: s?.mature72 ?? 0, successes: s?.link72 ?? 0 };
      });
    // No enabled row at all (all switched off by hand) → the control carries the dimension.
    shares[dim] = arms.length ? allocateDimension(arms, cfg.floorPct, `${day}:${dim}`) : { [CONTROL_KEY]: 1 };
  }
  const plan: DailyPlan = { day, cap: cap ?? cfg.plan?.cap ?? 40, shares };
  await setSetting(EXPERIMENT_SETTING_KEY, JSON.stringify({ ...(await readStored()), plan }));
  console.log(`[experiment] ${day}: napi osztás (keret ${plan.cap}) ${JSON.stringify(shares)}`);
  return plan;
}

// ── assignment ──────────────────────────────────────────────────────────────────────────────

export interface LetterVariants {
  /** Recorded after the send; empty = not part of the experiment (foreign letter, test lead). */
  readonly keys: Readonly<Partial<Record<ExperimentDimension, string>>>;
  /** Subject text to use; undefined = the draft's own (control). */
  readonly subject?: string;
  /** The visible first line; undefined = the letter's own. */
  readonly firstLine?: string;
  /** From display name; undefined = the lane's own. */
  readonly fromName?: string;
  /** "personal" = the first-person letter (experimentCopy.ts personalParts). */
  readonly bodyStyle: "boxed" | "plain" | "personal";
  readonly image: boolean;
  /**
   * `price_line` (0144): undefined = today's price (navy box + the p3 sentence); "" = no price in the
   * letter; a string = that plain sentence replaces the box and p3 (no discount, no box).
   */
  readonly priceLine?: string;
}

export const CONTROL_LETTER: LetterVariants = { keys: {}, bodyStyle: "boxed", image: true };

/**
 * Choose the variants of one cold letter. Read-only (the probe may call it); the choice is
 * written by recordSendVariants only after the letter left. Any failure → the control letter,
 * unrecorded: the experiment must never stop a send.
 */
export async function assignVariants(input: {
  readonly lang: string;
  readonly leadName: string;
  readonly city?: string | null;
  /** The letter's list / offer price as printed (draft parts) — for a `price_line` sentence template. */
  readonly price?: string | null;
  readonly offerPrice?: string | null;
  /** The lead's ISO-2 — the personal price line names the „.hu” domain only for HU. */
  readonly country?: string | null;
  readonly participate: boolean;
  readonly now?: Date;
}): Promise<LetterVariants> {
  if (!input.participate) return CONTROL_LETTER;
  // NEMZETKÖZI B (brief 2026-11-22): the experiment runs in EVERY language whose wording of the
  // variant exists. A foreign letter takes a variant only when its text is translated in full
  // (Bábel's pack — no AI, no Hungarian fallback); a missing translation → that dimension's
  // control. The Hungarian letter is untouched (`foreign` false → every text as before).
  const foreign = input.lang !== "hu";
  /** The variant's own text in the letter's language, or null when any part of it is untranslated. */
  const inLang = (fn: () => string): string | null => {
    if (!foreign) return fn();
    const m = collectFallbacks(fn);
    return m.fallbacks.length ? null : m.value;
  };
  /** A catalog template (Hungarian source) in the letter's language, or null when not translated. */
  const templateIn = (t: string | null | undefined): string | null => (t ? inLang(() => (foreign ? T(input.lang, t) : t)) : null);
  try {
    const now = input.now ?? new Date();
    const plan = await ensureDailyPlan(now);
    const [catalog, stats] = await Promise.all([loadCatalog(), loadVariantStats(now)]);
    const keys: Partial<Record<ExperimentDimension, string>> = {};
    let subject: string | undefined;
    let firstLine: string | undefined;
    let fromName: string | undefined;
    let bodyStyle: "boxed" | "plain" | "personal" = "boxed";
    let image = true;
    let priceLine: string | undefined;
    const vars = { name: input.leadName, city: input.city, price: input.price, offerPrice: input.offerPrice };
    // body_style is chosen FIRST: the first line exists only on the boxed letter, and the price
    // sentence only in the personal one (coordinator 2026-11-22).
    for (const dim of ASSIGN_ORDER) {
      // The visible first line belongs to the boxed letter only: the plain letter keeps today's line
      // unexperimented, the personal letter has none (its first text is the greeting). Not recorded.
      if (dim === "first_line" && bodyStyle !== "boxed") continue;
      const rows = catalog.filter((v) => v.dimension === dim && v.enabled);
      const applicable = rows
        .filter((v) => {
          if (v.isControl) return true;
          // Code-defined wording (experimentCopy.ts, T()) — the catalog row carries no template.
          if (dim === "subject" && v.key === "ez_az_on_szallasa") return Boolean(input.leadName.trim()) && inLang(() => subjectIsThisYours(input.lang, input.leadName, input.city)) !== null;
          if (dim === "body_style" && v.key === "szemelyes") return Boolean(personalSenderName());
          // „mondat” is the base package's from-price: ONLY in the personal letter, never beside the
          // boxed letter's booking/commission promise (coordinator 2026-11-22). body_style is chosen first.
          if (dim === "price_line" && v.key === "mondat") {
            return bodyStyle === "personal" && Boolean((input.offerPrice ?? "").trim()) && inLang(() => priceSentence(input.lang, input.offerPrice ?? "", input.country)) !== null;
          }
          if (dim === "subject" || dim === "first_line") { const t = templateIn(v.template); return t ? renderTemplate(t, vars) !== null : false; }
          if (dim === "sender") return Boolean(senderNameOf(v.key));
          // price_line: "none" is structural; any other key needs its sentence template to render.
          if (dim === "price_line") { if (v.key === "none") return true; const t = templateIn(v.template); return t ? renderTemplate(t, vars) !== null : false; }
          return true;
        })
        .map((v) => v.key);
      const today = Object.fromEntries(stats.filter((s) => s.dimension === dim).map((s) => [s.key, s.sentToday]));
      const key = pickVariant(plan.shares[dim] ?? {}, today, plan.cap, applicable) ?? CONTROL_KEY;
      keys[dim] = key;
      if (key === CONTROL_KEY) continue;
      const row = rows.find((v) => v.key === key);
      if (dim === "subject" && key === "ez_az_on_szallasa") subject = subjectIsThisYours(input.lang, input.leadName, input.city);
      else if (dim === "subject" && row?.template) subject = renderTemplate(templateIn(row.template) ?? "{missing}", vars) ?? undefined;
      if (dim === "first_line" && row?.template) firstLine = renderTemplate(templateIn(row.template) ?? "{missing}", vars) ?? undefined;
      if (dim === "sender") fromName = senderNameOf(key) ?? undefined;
      if (dim === "body_style" && key === "plain") bodyStyle = "plain";
      if (dim === "body_style" && key === "szemelyes") bodyStyle = "personal";
      if (dim === "image" && key === "none") image = false;
      if (dim === "price_line")
        priceLine =
          key === "none" ? "" : key === "mondat" ? priceSentence(input.lang, input.offerPrice ?? "", input.country) : row?.template ? renderTemplate(templateIn(row.template) ?? "{missing}", vars) ?? undefined : undefined;
    }
    return {
      keys,
      ...(subject ? { subject } : {}),
      ...(firstLine ? { firstLine } : {}),
      ...(fromName ? { fromName } : {}),
      bodyStyle,
      image,
      ...(priceLine !== undefined ? { priceLine } : {}),
    };
  } catch (e) {
    console.error(`[experiment] hozzárendelés hiba → kontroll-levél, nem rögzítve: ${(e as Error).message}`);
    return CONTROL_LETTER;
  }
}

/** The control letter with the same participation — used when a variant fails the §C gate. */
export function controlOf(v: LetterVariants): LetterVariants {
  if (!Object.keys(v.keys).length) return CONTROL_LETTER;
  return { ...CONTROL_LETTER, keys: Object.fromEntries(DIMENSIONS.map((d) => [d, CONTROL_KEY])) };
}

/** Write the letter's variants once it left. Never throws (the letter is already out). */
export async function recordSendVariants(prospectId: string, v: LetterVariants, at: Date): Promise<void> {
  const rows = Object.entries(v.keys).map(([dimension, variant_key]) => ({
    prospect_id: prospectId,
    dimension: dimension as ExperimentDimension,
    variant_key: variant_key as string,
    sent_at: at,
  }));
  if (!rows.length) return;
  try {
    await db.insertInto("outreach_send_variant").values(rows).onConflict((oc) => oc.columns(["prospect_id", "dimension"]).doNothing()).execute();
  } catch (e) {
    console.error(`[experiment] a változat-címke nem rögzült (${prospectId}): ${(e as Error).message}`);
  }
}
