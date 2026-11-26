// Riport › Kísérletek — the numbers (frozen plan: assets/design-refs/console/kiserletek/, „C”,
// owner 2026-11-22; ADR-0462).
//
// Everything comes from loadVariantStats() — the same numbers the dispatcher splits the cap by —
// so the panel and the machine cannot say different things. Pure folds are exported for the
// self-test (scripts/experiment-selftest.mts).

import { sql } from "kysely";
import { db } from "../db/client.js";
import {
  CONTROL_KEY,
  DIMENSIONS,
  getExperimentSettings,
  loadCatalog,
  loadVariantStats,
  rngOf,
  sampleBeta,
  seedOf,
  type CatalogRow,
  type VariantStats,
} from "../outreach/experiment.js";
import { budapestIsoDay, budapestMidnight, budapestWeekday } from "../text/budapestTime.js";
import type { ExperimentDimension } from "../db/schema.js";
import { countryConfig, countryOf } from "../country.js";
import { countCountries, inReportCountry, type CountryCount, type ReportCountry } from "./reportData.js";

/** A leader needs at least this many ≥72-hour letters (README ③). */
export const LEADER_MIN_MATURE = 30;

export interface VariantRow extends CatalogRow {
  readonly stats: VariantStats | null;
  /** Today's share of the cap (0–1); null = not in today's split. */
  readonly shareToday: number | null;
}

export type Verdict =
  | { readonly kind: "idle" }
  | { readonly kind: "win"; readonly leader: VariantRow; readonly control: VariantRow }
  | { readonly kind: "hold"; readonly control: VariantRow | null };

export interface DimensionReport {
  readonly dimension: ExperimentDimension;
  readonly rows: readonly VariantRow[];
  readonly running: number;
  readonly verdict: Verdict;
}

export interface WeeklyLine {
  /** Budapest day the week started (Monday) and ended (the next Monday, exclusive). */
  readonly from: string;
  readonly to: string;
  readonly variants: number;
  readonly dimensions: number;
  readonly best: { readonly dimension: ExperimentDimension; readonly label: string; readonly rate: number; readonly controlRate: number; readonly pBetter: number } | null;
  readonly disabled: number;
}

export interface ExperimentReport {
  readonly dims: readonly DimensionReport[];
  readonly kpi: { readonly running: number; readonly letters: number; readonly mail24: number; readonly mature24: number; readonly capToday: number | null };
  readonly weekly: WeeklyLine;
  /** The shared country strip: the lead-country filter and the experiment letters per country. */
  readonly country?: ReportCountry;
  readonly countries?: readonly CountryCount[];
}

export const rate = (a: number, b: number): number => (b > 0 ? a / b : 0);

/** README ③: the verdict of one dimension. */
export function verdictOf(rows: readonly VariantRow[]): Verdict {
  const live = rows.filter((r) => r.enabled);
  const control = rows.find((r) => r.isControl) ?? null;
  if (live.length < 2) return { kind: "idle" };
  const judged = live.filter((r) => (r.stats?.mature72 ?? 0) >= LEADER_MIN_MATURE);
  const best = judged.reduce<VariantRow | null>(
    (a, b) => (!a || rate(b.stats!.link72, b.stats!.mature72) > rate(a.stats!.link72, a.stats!.mature72) ? b : a),
    null,
  );
  if (best && control && !best.isControl) return { kind: "win", leader: best, control };
  return { kind: "hold", control };
}

/** P(a's true rate > b's) by seeded Monte-Carlo Beta draws. */
export function pBetter(a: { s: number; n: number }, b: { s: number; n: number }, seed: string, draws = 4000): number {
  const rng = rngOf(seedOf(seed));
  let wins = 0;
  for (let i = 0; i < draws; i++) {
    const x = sampleBeta(a.s + 1, Math.max(0, a.n - a.s) + 1, rng);
    const y = sampleBeta(b.s + 1, Math.max(0, b.n - b.s) + 1, rng);
    if (x > y) wins++;
  }
  return wins / draws;
}

/** The last COMPLETED Budapest week (Mon 00:00 → Mon 00:00) before `now`. */
export function lastWeek(now: Date): { from: string; to: string } {
  const today = budapestIsoDay(now);
  const back = (budapestWeekday(now) + 6) % 7; // days since this week's Monday
  const shift = (iso: string, d: number): string => {
    const x = new Date(`${iso}T12:00:00Z`);
    x.setUTCDate(x.getUTCDate() + d);
    return x.toISOString().slice(0, 10);
  };
  const to = shift(today, -back);
  return { from: shift(to, -7), to };
}

function assemble(catalog: readonly CatalogRow[], stats: readonly VariantStats[], shares: Readonly<Record<string, Readonly<Record<string, number>>>> | null): DimensionReport[] {
  return DIMENSIONS.map((dimension) => {
    const rows: VariantRow[] = catalog
      .filter((c) => c.dimension === dimension)
      .map((c) => ({
        ...c,
        stats: stats.find((s) => s.dimension === dimension && s.key === c.key) ?? null,
        shareToday: c.enabled && shares?.[dimension]?.[c.key] !== undefined ? shares[dimension][c.key] : null,
      }));
    return { dimension, rows, running: rows.filter((r) => r.enabled).length, verdict: verdictOf(rows) };
  });
}

/** Every experiment letter (one prospect = one letter) with its lead's country (countryOf). */
async function letterCountries(): Promise<{ prospectId: string; country: string }[]> {
  const r = await sql<{ prospect_id: string; raw_country: string | null; area_country: string | null }>`
    select distinct sv.prospect_id, l.raw->>'country' as raw_country, sd.country as area_country
      from outreach_send_variant sv
      join prospect p on p.id = sv.prospect_id
      join lead l on l.id = p.lead_id
      left join scrape_run sr on sr.id = l.scrape_run_id
      left join scraper_definition sd on sd.id = sr.scraper_definition_id
  `.execute(db);
  await countryConfig(null); // refresh the layer snapshot once; the per-row lookups are sync
  return r.rows.map((x) => ({ prospectId: x.prospect_id, country: countryOf({ country: x.raw_country }, x.area_country) ?? "" }));
}

export async function getExperimentReport(now = new Date(), country: ReportCountry = "all"): Promise<ExperimentReport> {
  // The shared country strip: letters per lead country; a chosen country narrows every number.
  const letters = await letterCountries();
  const countries = countCountries(letters, (l) => l.country);
  const only = country === "all" ? undefined : letters.filter((l) => inReportCountry(country, l.country)).map((l) => l.prospectId);
  const [catalog, stats, cfg] = await Promise.all([loadCatalog(), loadVariantStats(now, only), getExperimentSettings()]);
  const today = budapestIsoDay(now);
  const plan = cfg.plan?.day === today ? cfg.plan : null;
  const dims = assemble(catalog, stats, plan?.shares ?? null);

  // Every labelled letter carries one row per dimension: the subject rows count the letters.
  const subj = stats.filter((s) => s.dimension === "subject");
  const kpi = {
    running: catalog.filter((c) => c.enabled).length,
    letters: subj.reduce((n, s) => n + s.sends, 0),
    mail24: subj.reduce((n, s) => n + s.mail24, 0),
    mature24: subj.reduce((n, s) => n + s.mature24, 0),
    capToday: plan?.cap ?? null,
  };

  // README ①: the last completed week, as the numbers stood at its end.
  const wk = lastWeek(now);
  const wFrom = budapestMidnight(wk.from);
  const wTo = budapestMidnight(wk.to);
  const ran = await sql<{ dimension: ExperimentDimension; variant_key: string }>`
    select distinct dimension, variant_key from outreach_send_variant where sent_at >= ${wFrom} and sent_at < ${wTo}
    ${only ? sql`and prospect_id = any(${only})` : sql``}
  `.execute(db);
  const weekStats = await loadVariantStats(new Date(wTo.getTime() - 1), only);
  const weekDims = assemble(catalog, weekStats, null);
  let best: WeeklyLine["best"] = null;
  for (const d of weekDims) {
    if (d.verdict.kind !== "win") continue;
    const L = d.verdict.leader.stats!;
    const C = d.verdict.control.stats;
    const r = rate(L.link72, L.mature72);
    const c = C ? rate(C.link72, C.mature72) : 0;
    if (!best || r - c > best.rate - best.controlRate) {
      best = {
        dimension: d.dimension,
        label: d.verdict.leader.label,
        rate: r,
        controlRate: c,
        pBetter: pBetter({ s: L.link72, n: L.mature72 }, { s: C?.link72 ?? 0, n: C?.mature72 ?? 0 }, `${wk.from}:${d.dimension}`),
      };
    }
  }
  const disabledInWeek = await db
    .selectFrom("outreach_variant")
    .select((eb) => eb.fn.countAll<string>().as("n"))
    .where("disabled_at", ">=", wFrom)
    .where("disabled_at", "<", wTo)
    .executeTakeFirst();
  const weekly: WeeklyLine = {
    from: wk.from,
    to: wk.to,
    variants: ran.rows.length,
    dimensions: new Set(ran.rows.map((r) => r.dimension)).size,
    best,
    disabled: Number(disabledInWeek?.n ?? 0),
  };
  return { dims, kpi, weekly, country, countries };
}

export { CONTROL_KEY };
