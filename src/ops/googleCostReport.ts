// Daily Google API cost report (ADR-XXXX) — the owner's morning view of what the
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
// free allowances are NOT subtracted. The real figure is Billing → Reports.
//
// Pure except for `runDailyReport`'s injected token/fetch: the gate
// (scripts/google-cost-report-check.mts) drives it with a fetch stub.

import { addIsoDays, budapestIsoDay, budapestMidnight } from "../text/budapestTime.js";

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

export type FetchLike = (url: string, init: { headers: Record<string, string> }) => Promise<{
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
const fmtInt = (n: number): string =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const shortMethod = (m: string): string => m.replace(/^google\.(maps\.)?(places\.v1\.)?/, "");

export function buildReport(points: readonly UsagePoint[], o: ReportOptions): Report {
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
  const flags: string[] = [];
  if (totalUsd > o.thresholdUsd) {
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
  L.push(`Becsült költség (listaár): ${fmtUsd(totalUsd)}   ·   előző 7 nap átlaga: ${fmtUsd(avg7Usd)}/nap`);
  L.push("");
  if (flags.length) {
    L.push("FIGYELEM:");
    for (const f of flags) L.push(`  - ${f}`);
  } else {
    L.push("Nincs kiugrás (egy tétel sem ≥2× az átlagnak, a napi összeg a küszöb alatt).");
  }
  L.push("");
  L.push("Tételek (Maps Platform), tegnapi becsült költség szerint:");
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
  L.push(...disclaimer(o.project));

  const subject =
    `${flags.length ? "[FIGYELEM] " : ""}Google API napi riport ${o.day} — ~${fmtUsd(totalUsd)} (becslés)`;
  return { subject, text: L.join("\n"), hasData: true, totalUsd, avg7Usd, flags, rows };
}

function disclaimer(project: string): string[] {
  return [
    "---",
    "Ez listaáras BECSLÉS, nem számla: a Monitoring a hívások SZÁMÁT adja, a mező-maszkot nem látja,",
    "ezért metódusonként egy feltételezett SKU-val számol (a kódunk legdrágább használatával), és a havi",
    "ingyenes kereteket NEM vonja le. A valós költség: Google Cloud Console → Billing → Reports.",
    `A projektet (${project}) a Minereal (MR) is használja ugyanazzal a kulccsal — a számok a projekt EGÉSZÉT mutatják.`,
    "A riport semmit nem korlátoz és nem állít le.",
  ];
}

/** The mail that goes out when there is NO data — a silent failure is not an option. */
export function buildNoDataReport(day: string, project: string, reason: string): Report {
  const text = [
    `Google API napi riport — ${day} (budapesti nap), projekt: ${project}`,
    "",
    "NINCS ADAT — a mai riport nem készült el.",
    "",
    `Ok: ${reason}`,
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
}

/** Token → Monitoring → report. Never throws: every failure becomes the no-data report. */
export async function runDailyReport(o: RunOptions): Promise<Report> {
  let token: string;
  try {
    token = (await o.getToken()).trim();
    if (!token) throw new Error("üres token");
  } catch (e) {
    return buildNoDataReport(o.day, o.project, `a Google hozzáférési token nem kérhető le (${errText(e)})`);
  }
  try {
    const { start, end } = reportWindow(o.day);
    const points = await fetchUsage({ project: o.project, token, start, end, fetchImpl: o.fetchImpl });
    // Not one call in 8+ days (Drive/Sheets included) is not a quiet week — it is a
    // wrong project, a wrong filter or a broken metric. Say so instead of reporting 0 $.
    if (points.length === 0) {
      return buildNoDataReport(
        o.day,
        o.project,
        "a Cloud Monitoring a teljes időablakra (hónap eleje / előző 7 nap → tegnap) üres választ adott",
      );
    }
    return buildReport(points, o);
  } catch (e) {
    return buildNoDataReport(o.day, o.project, `a Cloud Monitoring lekérdezés elbukott (${errText(e)})`);
  }
}

function errText(e: unknown): string {
  const s = e instanceof Error ? e.message : String(e);
  return s.replace(/\s+/g, " ").slice(0, 400);
}
