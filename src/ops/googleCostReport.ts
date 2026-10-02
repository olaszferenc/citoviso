// Daily Google API cost report (ADR-0297) — the owner's morning view of what the
// Google Cloud project spent YESTERDAY (Budapest day), per service × method.
//
// Why it exists: the Places bill ran at ~600 $/week (2026-09-23 … 10-01) and nobody
// noticed for a week. The report makes a spike visible the next morning. It NEVER
// limits or stops anything ("saját magunkat nem korlátozzuk") — it only tells.
//
// Source: Cloud Monitoring `serviceruntime.googleapis.com/api/request_count`
// (resource.type="consumed_api") — request COUNTS, not money. The cost is a
// LIST-PRICE ESTIMATE: Monitoring does not see the field mask, so a method maps to
// one assumed SKU (the most expensive one our code uses for it), and the monthly
// free allowances are NOT subtracted.
//
// The REAL figure (ADR-0301) comes from the Cloud Billing export in BigQuery: the
// day's cost + credits per project × service × SKU, in the account's currency. The
// export lags (hours, sometimes >24 h); until the day is complete the estimate stays
// the headline and the report says why. When both exist the real one leads and the
// estimate stands next to it — the gap between them is information too.
//
// Pure except for `runDailyReport`'s injected token/fetch: the gate
// (scripts/google-cost-report-check.mts) drives it with a fetch stub.

import { addIsoDays, budapestIsoDay, budapestMidnight } from "../text/budapestTime.js";
import { currencySign, formatMoney, formatNumber } from "../text/money.js";

// ---------------------------------------------------------------------------
// Price list — the ONE copy. Google Maps Platform list prices, 0–100k tier,
// USD per 1 000 billable events (developers.google.com/maps/billing-and-pricing/
// pricing, checked 2026-10-01 for ADR-0295 and 2026-10-02 for this report).
// ---------------------------------------------------------------------------

export interface MethodPrice {
  /** The SKU this method is assumed to bill as. */
  readonly sku: string;
  readonly usdPer1000: number;
  /** Monthly free allowance of the SKU (null = unlimited free). */
  readonly freePerMonth: number | null;
  /** Why the SKU is an assumption (shown in the report). */
  readonly note?: string;
}

export const METHOD_PRICES: Readonly<Record<string, MethodPrice>> = {
  "google.maps.places.v1.Places.SearchText": {
    sku: "Text Search Enterprise",
    usdPer1000: 35,
    freePerMonth: 1000,
    note: "felső becslés: a felderítés ID-only keresése (ADR-0295) ingyenes, de ugyanígy számolódik",
  },
  "google.maps.places.v1.Places.GetPlace": {
    sku: "Place Details Enterprise",
    usdPer1000: 20,
    freePerMonth: 1000,
    note: "a vélemény-lekérés (reviews) Enterprise + Atmosphere = 25 $; az ID-only lekérés ingyenes",
  },
  "google.maps.places.v1.Places.GetPhotoMedia": {
    sku: "Place Details Photos",
    usdPer1000: 7,
    freePerMonth: 1000,
  },
  "google.maps.StreetViewMetadata.Http": {
    sku: "Street View Metadata",
    usdPer1000: 0,
    freePerMonth: null,
  },
  "google.maps.StreetView.Http": {
    sku: "Street View Static",
    usdPer1000: 7,
    freePerMonth: 10000,
  },
  "google.maps.BaseMap.Javascript": {
    sku: "Dynamic Maps",
    usdPer1000: 7,
    freePerMonth: 10000,
  },
  "google.maps.BaseMap.Http": {
    sku: "Static Maps",
    usdPer1000: 2,
    freePerMonth: 10000,
  },
  "google.places.Geocoding.Javascript": {
    sku: "Geocoding",
    usdPer1000: 5,
    freePerMonth: 10000,
  },
  "google.places.Geocoding.Http": {
    sku: "Geocoding",
    usdPer1000: 5,
    freePerMonth: 10000,
  },
  "google.places.Autocomplete.Javascript": {
    sku: "Autocomplete Requests",
    usdPer1000: 2.83,
    freePerMonth: 10000,
  },
  "google.places.Details.Javascript": {
    sku: "Places Legacy – Place Details",
    usdPer1000: 17,
    freePerMonth: 5000,
  },
};

/** Services that belong to Google Maps Platform (billable). Anything else
 *  (Drive, Sheets, Monitoring …) is listed only as a call count. */
const MAPS_SERVICE_RE =
  /(^|[.-])(places|maps|geocoding|street-view|streetview|directions|distance-matrix|routes|roads|elevation|timezone|geolocation|aerialview|tile|static-maps|addressvalidation)/;

export function isMapsService(service: string): boolean {
  return MAPS_SERVICE_RE.test(service);
}

// ---------------------------------------------------------------------------
// Monitoring fetch
// ---------------------------------------------------------------------------

/** One hourly bucket of one service × method × credential series. */
export interface UsagePoint {
  readonly service: string;
  readonly method: string;
  readonly credential: string;
  /** End of the hourly bucket (the bucket covers [end − 1 h, end)). */
  readonly end: Date;
  readonly count: number;
}

export type FetchLike = (
  url: string,
  init: { headers: Record<string, string>; method?: string; body?: string },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

export interface MonitoringQuery {
  readonly project: string;
  readonly token: string;
  readonly start: Date;
  readonly end: Date;
  readonly fetchImpl: FetchLike;
}

/**
 * Hourly request counts between `start` and `end`, all pages. Hourly (not daily)
 * alignment so a Budapest day — 23 or 25 hours on a DST switch — is summed here,
 * not guessed by a 86 400 s bucket. Throws with the HTTP status + body on failure.
 */
export async function fetchUsage(q: MonitoringQuery): Promise<UsagePoint[]> {
  const out: UsagePoint[] = [];
  let pageToken = "";
  for (let page = 0; page < 100; page++) {
    const p = new URLSearchParams();
    p.set(
      "filter",
      'metric.type="serviceruntime.googleapis.com/api/request_count" AND resource.type="consumed_api"',
    );
    p.set("interval.startTime", q.start.toISOString());
    p.set("interval.endTime", q.end.toISOString());
    p.set("aggregation.alignmentPeriod", "3600s");
    p.set("aggregation.perSeriesAligner", "ALIGN_SUM");
    p.set("aggregation.crossSeriesReducer", "REDUCE_SUM");
    p.append("aggregation.groupByFields", "resource.label.service");
    p.append("aggregation.groupByFields", "resource.label.method");
    p.append("aggregation.groupByFields", "resource.label.credential_id");
    if (pageToken) p.set("pageToken", pageToken);
    const url =
      `https://monitoring.googleapis.com/v3/projects/${encodeURIComponent(q.project)}/timeSeries?` +
      p.toString();
    const res = await q.fetchImpl(url, {
      headers: { Authorization: `Bearer ${q.token}`, "x-goog-user-project": q.project },
    });
    const body = await res.text();
    if (!res.ok) {
      throw new Error(`Cloud Monitoring HTTP ${res.status}: ${body.slice(0, 300)}`);
    }
    const json = JSON.parse(body) as {
      timeSeries?: Array<{
        resource?: { labels?: Record<string, string> };
        points?: Array<{
          interval?: { endTime?: string };
          value?: { int64Value?: string; doubleValue?: number };
        }>;
      }>;
      nextPageToken?: string;
    };
    for (const s of json.timeSeries ?? []) {
      const l = s.resource?.labels ?? {};
      for (const pt of s.points ?? []) {
        const endIso = pt.interval?.endTime;
        if (!endIso) continue;
        const count = Number(pt.value?.int64Value ?? pt.value?.doubleValue ?? 0);
        if (!Number.isFinite(count) || count === 0) continue;
        out.push({
          service: l.service ?? "?",
          method: l.method ?? "?",
          credential: l.credential_id ?? "",
          end: new Date(endIso),
          count,
        });
      }
    }
    pageToken = json.nextPageToken ?? "";
    if (!pageToken) return out;
  }
  throw new Error("Cloud Monitoring: több mint 100 lap — a lekérés leállítva");
}

// ---------------------------------------------------------------------------
// Billing export (BigQuery) — the real cost
// ---------------------------------------------------------------------------

/** One project × service × SKU line of the reported day, in the export's currency. */
export interface BillingLine {
  readonly projectId: string;
  readonly service: string;
  readonly sku: string;
  readonly currency: string;
  /** Gross cost (list price after tiers), before credits. */
  readonly cost: number;
  /** Sum of the credits (free tier, promotions …) — normally ≤ 0. */
  readonly credits: number;
}

/**
 * What the export says about the day.
 *  ok      — the export has moved past the day's end: `lines` is the day (may be empty = 0 spend)
 *  late    — the table has data, but not yet up to the day's end: `lines` is partial
 *  missing — no table / empty table / the export starts after the day
 *  error   — the query itself failed (HTTP, network, timeout)
 *  off     — no table configured
 */
export interface BillingDay {
  readonly status: "ok" | "late" | "missing" | "error" | "off";
  /** Human-readable why, for every status but "ok". */
  readonly reason: string;
  readonly lines: readonly BillingLine[];
  /** End of the newest usage row in the whole table (null = none). */
  readonly latestUsageEnd: Date | null;
  readonly lastExport: Date | null;
}

export interface BillingQuery {
  /** Job project (quota + x-goog-user-project). */
  readonly project: string;
  /** `project.dataset.table` of the standard usage cost export. */
  readonly table: string;
  readonly location: string;
  readonly token: string;
  readonly day: string;
  readonly fetchImpl: FetchLike;
}

/**
 * The ONE query: whole-table freshness (row count, first usage start, newest usage
 * end, newest export) LEFT JOINed to the day's lines, so an empty day still returns
 * the freshness row. The day is [Budapest midnight, next Budapest midnight) on
 * usage_start_time — export rows are hourly, so the DST day (23/25 h) splits cleanly.
 */
export function billingSql(table: string): string {
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/.test(table)) {
    throw new Error(`hibás számla-export tábla név: ${table}`);
  }
  const t = `\`${table}\``;
  return [
    "WITH s AS (",
    "  SELECT COUNT(*) AS n, UNIX_MILLIS(MIN(usage_start_time)) AS first_ms,",
    "    UNIX_MILLIS(MAX(usage_end_time)) AS latest_ms, UNIX_MILLIS(MAX(export_time)) AS export_ms",
    `  FROM ${t}`,
    "), d AS (",
    "  SELECT project.id AS project_id, service.description AS service, sku.description AS sku, currency,",
    "    SUM(cost) AS cost, SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) AS c), 0)) AS credits",
    `  FROM ${t}`,
    "  WHERE usage_start_time >= @start AND usage_start_time < @end",
    "  GROUP BY 1, 2, 3, 4",
    ")",
    "SELECT s.n, s.first_ms, s.latest_ms, s.export_ms, d.project_id, d.service, d.sku, d.currency, d.cost, d.credits",
    "FROM s LEFT JOIN d ON TRUE",
    "ORDER BY d.project_id, d.service, d.sku",
  ].join("\n");
}

type BqCell = { v: string | null };
interface BqResponse {
  jobComplete?: boolean;
  jobReference?: { jobId?: string; location?: string };
  rows?: Array<{ f: BqCell[] }>;
  pageToken?: string;
  error?: { code?: number; message?: string; errors?: Array<{ reason?: string }> };
}

const msDate = (v: string | null): Date | null => (v === null || v === "" ? null : new Date(Number(v)));

/** Reads the day from the billing export. Never throws: a failure is status "error". */
export async function fetchBillingDay(q: BillingQuery): Promise<BillingDay> {
  const base = `https://bigquery.googleapis.com/bigquery/v2/projects/${encodeURIComponent(q.project)}/queries`;
  const headers = {
    Authorization: `Bearer ${q.token}`,
    "x-goog-user-project": q.project,
    "Content-Type": "application/json",
  };
  const start = budapestMidnight(q.day);
  const end = budapestMidnight(addIsoDays(q.day, 1));
  const none = (status: BillingDay["status"], reason: string): BillingDay => ({
    status,
    reason,
    lines: [],
    latestUsageEnd: null,
    lastExport: null,
  });
  try {
    const rows: BqCell[][] = [];
    const ts = (name: string, d: Date) => ({
      name,
      parameterType: { type: "TIMESTAMP" },
      parameterValue: { value: d.toISOString() },
    });
    let res = await q.fetchImpl(base, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: billingSql(q.table),
        useLegacySql: false,
        location: q.location,
        parameterMode: "NAMED",
        queryParameters: [ts("start", start), ts("end", end)],
        timeoutMs: 60_000,
        maxResults: 10_000,
      }),
    });
    for (let page = 0; page < 50; page++) {
      const body = await res.text();
      let json: BqResponse = {};
      try {
        json = JSON.parse(body) as BqResponse;
      } catch {
        // a non-JSON body is reported with its status below
      }
      if (!res.ok) {
        const notFound =
          res.status === 404 || (json.error?.errors ?? []).some((e) => e.reason === "notFound");
        if (notFound) {
          return none(
            "missing",
            `a számla-export táblája (${q.table}) még nem létezik — az exportot a Google Cloud Console → Billing → ` +
              "Billing export oldalon kell bekapcsolni, az első adat órák–1 nap múlva érkezik",
          );
        }
        return none("error", `BigQuery HTTP ${res.status}: ${(json.error?.message ?? body).slice(0, 300)}`);
      }
      if (json.jobComplete === false) {
        return none("error", "a BigQuery lekérdezés 60 mp alatt nem fejeződött be");
      }
      for (const r of json.rows ?? []) rows.push(r.f);
      if (!json.pageToken) break;
      const jobId = json.jobReference?.jobId ?? "";
      const p = new URLSearchParams({ pageToken: json.pageToken, location: q.location, maxResults: "10000" });
      res = await q.fetchImpl(`${base}/${encodeURIComponent(jobId)}?${p.toString()}`, { headers });
    }
    const head = rows[0];
    if (!head) return none("error", "a BigQuery válasz egyetlen sort sem tartalmazott (a frissességi sor is hiányzik)");
    const n = Number(head[0]?.v ?? 0);
    const firstUsage = msDate(head[1]?.v ?? null);
    const latestUsageEnd = msDate(head[2]?.v ?? null);
    const lastExport = msDate(head[3]?.v ?? null);
    const lines: BillingLine[] = [];
    for (const f of rows) {
      // The LEFT JOIN's empty-day row. (A null project alone is a real line: account-level charges have none.)
      if (f[5]?.v == null && f[8]?.v == null) continue;
      lines.push({
        projectId: f[4]?.v ?? "(nincs projekt)",
        service: f[5]?.v ?? "?",
        sku: f[6]?.v ?? "?",
        currency: f[7]?.v ?? "",
        cost: Number(f[8]?.v ?? 0),
        credits: Number(f[9]?.v ?? 0),
      });
    }
    const fresh = { lines, latestUsageEnd, lastExport };
    if (n === 0) {
      return { ...fresh, status: "missing", reason: "a számla-export táblája üres — az első adat még nem érkezett meg" };
    }
    if (firstUsage && firstUsage.getTime() > start.getTime()) {
      return {
        ...fresh,
        status: "missing",
        reason: `a számla-export csak ${budapestStamp(firstUsage)}-tól tartalmaz használatot — erről a napról nincs (teljes) számla-adat`,
      };
    }
    if (!latestUsageEnd || latestUsageEnd.getTime() < end.getTime()) {
      return {
        ...fresh,
        status: "late",
        reason:
          "a nap számla-adata még nem érkezett meg teljesen (a Google exportja órákat, néha >24 órát késik) — " +
          `a legutolsó beérkezett használat vége: ${latestUsageEnd ? budapestStamp(latestUsageEnd) : "nincs"}`,
      };
    }
    return { ...fresh, status: "ok", reason: "" };
  } catch (e) {
    return none("error", `a BigQuery lekérdezés elbukott (${errText(e)})`);
  }
}

/** "2026-10-02 07:10" in Budapest time. */
function budapestStamp(d: Date): string {
  const hm = new Intl.DateTimeFormat("hu-HU", {
    timeZone: "Europe/Budapest",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${budapestIsoDay(d)} ${hm}`;
}

/**
 * An amount in the export's currency, through the shared money rule (ADR-0162):
 * forint as whole forints ("1 234 Ft"); any other currency with cents, the integer
 * part grouped by the shared formatter and the sign from `currencySign`.
 */
export function fmtCost(amount: number, currency: string): string {
  const huf = currencySign(currency) === currencySign("HUF");
  const abs = Math.abs(amount);
  // A credit is negative; the minus sign is ours (U+2212), never a lost "-0".
  const minus = amount < 0 && Math.round(abs * (huf ? 1 : 100)) > 0 ? "−" : "";
  if (huf) return `${minus}${formatMoney(abs, "HUF")}`;
  const cents = Math.round(abs * 100);
  const whole = formatNumber(Math.floor(cents / 100));
  const frac = String(cents % 100).padStart(2, "0");
  const sign = currencySign(currency);
  return `${minus}${whole},${frac}${sign ? ` ${sign}` : ""}`;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export interface ReportOptions {
  /** The reported Budapest day, "YYYY-MM-DD". */
  readonly day: string;
  readonly project: string;
  /** Flag the day when its estimated total exceeds this (USD). */
  readonly thresholdUsd: number;
  /** A ≥2× item is flagged only from this estimated daily cost (USD) — no noise from cents. */
  readonly itemMinUsd: number;
  /**
   * Daily threshold for the REAL cost, per export currency ("HUF" → 7000). USD falls
   * back to `thresholdUsd`. A currency without an entry is never compared to the USD
   * threshold (no silent exchange rate) — the report says so, and the day threshold
   * then runs on the estimate.
   */
  readonly realThresholds?: Readonly<Record<string, number>>;
}

export interface ReportRow {
  readonly service: string;
  readonly method: string;
  readonly price: MethodPrice | null;
  readonly calls: number;
  readonly avg7: number;
  readonly monthToDate: number;
  readonly usd: number;
  readonly avg7Usd: number;
  readonly flagged: boolean;
}

export interface Report {
  readonly subject: string;
  readonly text: string;
  /** True = there was data (the no-data branch is false). */
  readonly hasData: boolean;
  /** The real (billing export) day, when it was asked for. */
  readonly billing?: BillingDay;
  /** Net real cost per currency — only when the export's day is complete ("ok"). */
  readonly realTotals?: Readonly<Record<string, number>>;
  readonly totalUsd: number;
  readonly avg7Usd: number;
  /** Human-readable reasons the day is highlighted (empty = quiet day). */
  readonly flags: readonly string[];
  readonly rows: readonly ReportRow[];
}

/** The window one report needs: from min(month start, day − 7) to the end of `day`. */
export function reportWindow(day: string): { start: Date; end: Date } {
  const weekStart = addIsoDays(day, -7);
  const monthStart = `${day.slice(0, 8)}01`;
  const from = monthStart < weekStart ? monthStart : weekStart;
  return { start: budapestMidnight(from), end: budapestMidnight(addIsoDays(day, 1)) };
}

/** Budapest day of an hourly bucket (bucket end − 1 ms lies inside the bucket). */
function bucketDay(end: Date): string {
  return budapestIsoDay(new Date(end.getTime() - 1));
}

function usd(calls: number, price: MethodPrice | null): number {
  return price ? (calls * price.usdPer1000) / 1000 : 0;
}

const fmtUsd = (n: number): string => `${n.toFixed(2).replace(".", ",")} $`;
// One grouping rule for every number we print (ADR-0162): the shared formatter.
const fmtInt = (n: number): string => formatNumber(n);
const shortMethod = (m: string): string => m.replace(/^google\.(maps\.)?(places\.v1\.)?/, "");

/** Net (cost + credits) per currency. */
function totalsByCurrency(lines: readonly BillingLine[]): Map<string, { net: number; cost: number; credits: number }> {
  const m = new Map<string, { net: number; cost: number; credits: number }>();
  for (const l of lines) {
    const t = m.get(l.currency) ?? { net: 0, cost: 0, credits: 0 };
    t.net += l.cost + l.credits;
    t.cost += l.cost;
    t.credits += l.credits;
    m.set(l.currency, t);
  }
  return m;
}

const joinCosts = (m: Map<string, { net: number }>): string =>
  [...m.entries()].map(([c, t]) => fmtCost(t.net, c)).join(" + ") || "0";

/** The per-project × service × SKU block of the real cost. */
function billingLinesText(lines: readonly BillingLine[], project: string): string[] {
  const L: string[] = [];
  const byProject = new Map<string, BillingLine[]>();
  for (const l of lines) byProject.set(l.projectId, [...(byProject.get(l.projectId) ?? []), l]);
  const projects = [...byProject.entries()]
    .map(([id, ls]) => ({ id, ls, net: ls.reduce((s, l) => s + l.cost + l.credits, 0) }))
    .sort((a, b) => b.net - a.net);
  L.push(
    `Valós költség projektenként (a számlázási fiók ${projects.length} projektje — a fiók alatt az MR projektjei is lehetnek):`,
  );
  for (const p of projects) {
    const mark = p.id === project ? `  ← a Citoviso projektje (az MR is használja)` : "";
    L.push(`  ${p.id}: ${joinCosts(totalsByCurrency(p.ls))}${mark}`);
    const paid = p.ls.filter((l) => l.cost !== 0 || l.credits !== 0);
    paid.sort((a, b) => b.cost + b.credits - (a.cost + a.credits));
    for (const l of paid) {
      const credit = l.credits !== 0 ? ` (bruttó ${fmtCost(l.cost, l.currency)}, jóváírás ${fmtCost(l.credits, l.currency)})` : "";
      L.push(`      ${l.service} · ${l.sku}: ${fmtCost(l.cost + l.credits, l.currency)}${credit}`);
    }
    const free = p.ls.length - paid.length;
    if (free > 0) L.push(`      + ${fmtInt(free)} díjmentes tétel (0 költség)`);
  }
  return L;
}

/**
 * The report. `billing` is the real day from the export (omitted = not asked);
 * `estimateMissing` is set when Monitoring failed but the export answered — the
 * report then stands on the real figure alone and says why the estimate is absent.
 */
export function buildReport(
  points: readonly UsagePoint[],
  o: ReportOptions,
  billing?: BillingDay,
  estimateMissing?: string,
): Report {
  const weekDays = new Set(Array.from({ length: 7 }, (_, i) => addIsoDays(o.day, -7 + i)));
  const monthPrefix = o.day.slice(0, 8);

  interface Acc {
    service: string;
    method: string;
    day: number;
    week: number;
    month: number;
  }
  const byMethod = new Map<string, Acc>();
  const byCredential = new Map<string, number>();
  for (const pt of points) {
    const d = bucketDay(pt.end);
    const key = `${pt.service}\u0000${pt.method}`;
    let a = byMethod.get(key);
    if (!a) {
      a = { service: pt.service, method: pt.method, day: 0, week: 0, month: 0 };
      byMethod.set(key, a);
    }
    if (d === o.day) {
      a.day += pt.count;
      if (isMapsService(pt.service)) {
        const c = pt.credential || "(nincs azonosító)";
        byCredential.set(c, (byCredential.get(c) ?? 0) + pt.count);
      }
    }
    if (weekDays.has(d)) a.week += pt.count;
    if (d.startsWith(monthPrefix) && d <= o.day) a.month += pt.count;
  }

  const rows: ReportRow[] = [];
  const others: Acc[] = [];
  for (const a of byMethod.values()) {
    if (!isMapsService(a.service)) {
      others.push(a);
      continue;
    }
    const price = METHOD_PRICES[a.method] ?? null;
    const avg7 = a.week / 7;
    const dayUsd = usd(a.day, price);
    const flagged =
      price !== null && dayUsd >= o.itemMinUsd && a.day >= 2 * avg7 && a.day > 0;
    rows.push({
      service: a.service,
      method: a.method,
      price,
      calls: a.day,
      avg7,
      monthToDate: a.month,
      usd: dayUsd,
      avg7Usd: usd(avg7, price),
      flagged,
    });
  }
  rows.sort((x, y) => y.usd - x.usd || y.calls - x.calls);

  const totalUsd = rows.reduce((s, r) => s + r.usd, 0);
  const avg7Usd = rows.reduce((s, r) => s + r.avg7Usd, 0);

  // The real figure leads only when the export has the WHOLE day.
  const realOk = billing?.status === "ok";
  const real = realOk ? totalsByCurrency(billing.lines) : null;
  const realTotals = real ? Object.fromEntries([...real.entries()].map(([c, t]) => [c, t.net])) : undefined;
  const thresholds: Record<string, number> = { USD: o.thresholdUsd, ...(o.realThresholds ?? {}) };
  // Real currencies that cannot be compared (no threshold in that currency).
  const unthresholded = real ? [...real.keys()].filter((c) => !Number.isFinite(thresholds[c.toUpperCase()])) : [];
  const realDecides = real !== null && real.size > 0 && unthresholded.length === 0;

  const flags: string[] = [];
  if (realDecides && real) {
    for (const [c, t] of real) {
      const lim = thresholds[c.toUpperCase()];
      if (t.net > lim) flags.push(`a napi VALÓS költség ${fmtCost(t.net, c)} — a küszöb ${fmtCost(lim, c)}`);
    }
  } else if (!estimateMissing && totalUsd > o.thresholdUsd) {
    flags.push(`a napi becsült költség ${fmtUsd(totalUsd)} — a küszöb ${fmtUsd(o.thresholdUsd)}`);
  }
  for (const r of rows.filter((x) => x.flagged)) {
    const ratio = r.avg7 > 0 ? `${(r.calls / r.avg7).toFixed(1).replace(".", ",")}×` : "új";
    flags.push(
      `${shortMethod(r.method)}: ${fmtInt(r.calls)} hívás (${fmtUsd(r.usd)}) — ${ratio} a 7 napos átlagnak (${fmtInt(r.avg7)})`,
    );
  }
  const unpriced = rows.filter((r) => r.price === null && r.calls > 0);

  const L: string[] = [];
  L.push(`Google API napi riport — ${o.day} (budapesti nap), projekt: ${o.project}`);
  L.push("");
  const estimateLine = estimateMissing
    ? `Becsült költség (listaár): NINCS — ${estimateMissing}`
    : `Becsült költség (listaár): ${fmtUsd(totalUsd)}   ·   előző 7 nap átlaga: ${fmtUsd(avg7Usd)}/nap`;
  if (real && billing) {
    const gross = [...real.entries()].map(([c, t]) => fmtCost(t.cost, c)).join(" + ");
    const cred = [...real.entries()].map(([c, t]) => fmtCost(t.credits, c)).join(" + ");
    L.push(`VALÓS költség (Cloud Billing export, a fiók minden projektje): ${joinCosts(real)}`);
    L.push(`  bruttó ${gross}, jóváírás ${cred} · az export frissessége: ${billing.lastExport ? budapestStamp(billing.lastExport) : "?"}`);
    L.push(estimateLine);
    if (unthresholded.length) {
      L.push(
        `A valós összegre nincs küszöb ${unthresholded.join(", ")} pénznemben ` +
          `(GOOGLE_COST_DAILY_THRESHOLD_${unthresholded[0]!.toUpperCase()}) — árfolyam nélkül nem hasonlítom a USD-küszöbhöz, ` +
          "a napi küszöb ezért a becslésen fut.",
      );
    }
  } else {
    L.push(estimateLine);
    if (billing) {
      L.push(`Valós költség: ${billing.status === "off" ? "nincs bekötve" : "NINCS MÉG"} — ${billing.reason}. A fő szám ezért a becslés.`);
      if (billing.status === "late" && billing.lines.length) {
        L.push(`  eddig beérkezett (RÉSZLEGES, nem a nap egésze): ${joinCosts(totalsByCurrency(billing.lines))}`);
      }
    }
  }
  L.push("");
  if (flags.length) {
    L.push("FIGYELEM:");
    for (const f of flags) L.push(`  - ${f}`);
  } else {
    L.push(
      `Nincs kiugrás (egy tétel sem ≥2× az átlagnak, a napi ${realDecides ? "valós" : "becsült"} összeg a küszöb alatt).`,
    );
  }
  if (real && billing) {
    L.push("");
    L.push(...billingLinesText(billing.lines, o.project));
  }
  if (!estimateMissing) {
    L.push("");
    L.push("Tételek (Maps Platform), tegnapi becsült költség szerint:");
  }
  for (const r of rows.filter((x) => x.calls > 0 || x.avg7 > 0)) {
    const mark = r.flagged ? "  <<< KIUGRÁS" : "";
    const sku = r.price ? `${r.price.sku}, ${String(r.price.usdPer1000).replace(".", ",")} $/1000` : "NINCS ÁR";
    const free =
      r.price === null
        ? ""
        : r.price.freePerMonth === null
          ? " · korlátlan ingyenes"
          : ` · hónap eddig ${fmtInt(r.monthToDate)} / ingyenes keret ${fmtInt(r.price.freePerMonth)}`;
    L.push(
      `  ${shortMethod(r.method)}: ${fmtInt(r.calls)} hívás = ${fmtUsd(r.usd)}  (7 napos átlag ${fmtInt(r.avg7)}/nap)${mark}`,
    );
    L.push(`      [${sku}${free}]`);
    if (r.price?.note) L.push(`      ${r.price.note}`);
  }
  if (unpriced.length) {
    L.push("");
    L.push("Ár nélküli Maps-hívások (a riport nem tudja beárazni — vedd fel az ártáblába, ha tartósan jelen van):");
    for (const r of unpriced) L.push(`  ${r.service} ${r.method}: ${fmtInt(r.calls)} hívás`);
  }
  if (byCredential.size) {
    L.push("");
    L.push("Maps-hívások kulcsonként (tegnap):");
    for (const [c, n] of [...byCredential.entries()].sort((x, y) => y[1] - x[1])) {
      L.push(`  ${c}: ${fmtInt(n)}`);
    }
  }
  const otherByService = new Map<string, number>();
  for (const a of others) {
    if (a.day > 0) otherByService.set(a.service, (otherByService.get(a.service) ?? 0) + a.day);
  }
  if (otherByService.size) {
    L.push("");
    L.push(
      `Egyéb (nem Maps, díjmentes) API-k tegnap: ${[...otherByService.entries()]
        .map(([s, n]) => `${s.replace(/\.googleapis\.com$/, "")} ${fmtInt(n)}`)
        .join(", ")}`,
    );
  }
  L.push("");
  L.push(...disclaimer(o.project, realOk));

  const why =
    billing === undefined || billing.status === "off"
      ? "(becslés)"
      : billing.status === "error"
        ? "(becslés; a számla-lekérdezés hibás)"
        : "(becslés; a számla-adat még nincs meg)";
  const headline = real
    ? `${joinCosts(real)} (számla)${estimateMissing ? "" : ` · becslés ~${fmtUsd(totalUsd)}`}`
    : `~${fmtUsd(totalUsd)} ${why}`;
  const subject = `${flags.length ? "[FIGYELEM] " : ""}Google API napi riport ${o.day} — ${headline}`;
  return { subject, text: L.join("\n"), hasData: true, billing, realTotals, totalUsd, avg7Usd, flags, rows };
}

function disclaimer(project: string, realOk = false): string[] {
  return [
    "---",
    ...(realOk
      ? [
          "A VALÓS szám a Cloud Billing exportból (BigQuery) jön: a számlázási fiók minden projektjének a budapesti",
          "napra eső költsége + jóváírása, a fiók pénznemében. A Google napokig utólag is pontosíthat.",
        ]
      : []),
    "A becslés listaáras BECSLÉS, nem számla: a Monitoring a hívások SZÁMÁT adja, a mező-maszkot nem látja,",
    "ezért metódusonként egy feltételezett SKU-val számol (a kódunk legdrágább használatával), és a havi",
    "ingyenes kereteket NEM vonja le. A valós költség: Google Cloud Console → Billing → Reports.",
    `A projektet (${project}) a Minereal (MR) is használja ugyanazzal a kulccsal — a számok a projekt EGÉSZÉT mutatják.`,
    "A riport semmit nem korlátoz és nem állít le.",
  ];
}

/** The mail that goes out when there is NO data — a silent failure is not an option. */
export function buildNoDataReport(day: string, project: string, reason: string, billing?: BillingDay): Report {
  const text = [
    `Google API napi riport — ${day} (budapesti nap), projekt: ${project}`,
    "",
    "NINCS ADAT — a mai riport nem készült el.",
    "",
    `Ok: ${reason}`,
    ...(billing ? [`Valós költség (számla-export): nincs — ${billing.reason || "a nap adata nem teljes"}`] : []),
    "",
    "Teendő: a dev gépen `~/google-cloud-sdk/bin/gcloud auth login` (ha a token járt le), majd kézzel:",
    "  npx tsx scripts/google-cost-report.mts --day " + day,
    "Addig a költség a Google Cloud Console → Billing → Reports oldalon látszik.",
    "",
    ...disclaimer(project),
  ].join("\n");
  return {
    subject: `[NINCS ADAT] Google API napi riport ${day}`,
    text,
    hasData: false,
    billing,
    totalUsd: 0,
    avg7Usd: 0,
    flags: [`nincs adat: ${reason}`],
    rows: [],
  };
}

export interface RunOptions extends ReportOptions {
  /** Returns a Bearer token; throws on failure (the reason goes into the mail). */
  readonly getToken: () => Promise<string>;
  readonly fetchImpl: FetchLike;
  /** `project.dataset.table` of the billing export; empty/omitted = the real branch is off (and said so). */
  readonly billingTable?: string;
  /** BigQuery location of the export dataset (e.g. "EU"). */
  readonly billingLocation?: string;
}

/**
 * Token → Monitoring + billing export → report. Never throws: when NEITHER source
 * answers, the no-data report goes out with both reasons.
 */
export async function runDailyReport(o: RunOptions): Promise<Report> {
  let token: string;
  try {
    token = (await o.getToken()).trim();
    if (!token) throw new Error("üres token");
  } catch (e) {
    return buildNoDataReport(o.day, o.project, `a Google hozzáférési token nem kérhető le (${errText(e)})`);
  }
  const table = (o.billingTable ?? "").trim();
  const billing: BillingDay = table
    ? await fetchBillingDay({
        project: o.project,
        table,
        location: o.billingLocation || "EU",
        token,
        day: o.day,
        fetchImpl: o.fetchImpl,
      })
    : {
        status: "off",
        reason: "a számla-export tábla nincs megadva (GOOGLE_BILLING_EXPORT_TABLE üres)",
        lines: [],
        latestUsageEnd: null,
        lastExport: null,
      };
  let monitoringFailure: string;
  try {
    const { start, end } = reportWindow(o.day);
    const points = await fetchUsage({ project: o.project, token, start, end, fetchImpl: o.fetchImpl });
    // Not one call in 8+ days (Drive/Sheets included) is not a quiet week — it is a
    // wrong project, a wrong filter or a broken metric. Say so instead of reporting 0 $.
    if (points.length > 0) return buildReport(points, o, billing);
    monitoringFailure =
      "a Cloud Monitoring a teljes időablakra (hónap eleje / előző 7 nap → tegnap) üres választ adott";
  } catch (e) {
    monitoringFailure = `a Cloud Monitoring lekérdezés elbukott (${errText(e)})`;
  }
  if (billing.status === "ok") return buildReport([], o, billing, monitoringFailure);
  return buildNoDataReport(o.day, o.project, monitoringFailure, billing);
}

function errText(e: unknown): string {
  const s = e instanceof Error ? e.message : String(e);
  return s.replace(/\s+/g, " ").slice(0, 400);
}
