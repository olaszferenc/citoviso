// ŐR — a napi Google-költség riport (ADR-0297) számolása. Hermetikus: fetch-csonk,
// a globális fetch dob (egy hálózati hívás = piros), DB és levél nincs.
//
// Amit mér:
//   ① ár × darab: a tegnapi hívások a METHOD_PRICES listaárával szorzódnak (és az ingyenes = 0)
//   ② napi küszöb: a küszöb fölötti becslés kiemelés, alatta nincs
//   ③ ≥2× tétel: a 7 napos átlag kétszerese kiemelés; az átlag körüli tétel nem
//   ④ apró tétel (a tételminimum alatt) ≥2× esetén sem zajong
//   ⑤ adat-nincs ág: token-hiba / Monitoring-HTTP-hiba / üres válasz → a levél „NINCS ADAT”,
//      az okkal együtt (néma bukás tilos), és a runDailyReport nem dob
//   ⑥ budapesti nap: a 25 órás DST-nap (10-25) mind a 25 órája oda számol, a határ-vödör nem csúszik át
//   ⑦ lapozás: a nextPageToken mentén minden lap összeadódik
//   ⑧ ár nélküli Maps-metódus megjelenik („NINCS ÁR”), a nem-Maps API nem kerül a költségbe
//   ⑨ a lekérés órás igazítással, a hónap eleje / előző 7 nap kezdetétől kér
//   ⑩ a szöveg kimondja: listaáras BECSLÉS, Billing → Reports, MR is használja
//   ⑪ VALÓS ág (BigQuery billing export, ADR-XXXX): költség + jóváírás projektenként × szolgáltatás × SKU,
//      a valós a fő szám, a becslés mellette; a lekérés paraméterei (budapesti nap, location, tábla)
//   ⑫ valós küszöb: a valós összeg a SAJÁT pénznemű küszöbbel; ilyenkor a becslés-küszöb nem dönt
//   ⑬ pénznem: HUF egész forint, EUR/USD centtel a közös formázóból; küszöb nélküli pénznem nem
//      hasonlítódik a USD-hez (kimondja, és a becslés-küszöb fut)
//   ⑭ nincs-tábla / üres tábla / export a nap után indul / HTTP-hiba / kivétel → becslés + kimondott ok
//   ⑮ késő adat: a nap még nem teljes → becslés a fő szám, a részleges valós csak tájékoztat
//   ⑯ Monitoring-hiba + kész számla → valós riport; mindkettő hiányzik → NINCS ADAT mindkét okkal
//   ⑰ BigQuery-lapozás, DST-nap (25 óra) a lekérésben
//
//   npx tsx scripts/google-cost-report-check.mts

import {
  METHOD_PRICES,
  billingSql,
  fmtCost,
  runDailyReport,
  type FetchLike,
  type Report,
} from "../src/ops/googleCostReport.js";
import { addIsoDays, budapestMidnight } from "../src/text/budapestTime.js";

globalThis.fetch = (() => {
  throw new Error("google-cost-report-check: váratlan HÁLÓZATI hívás — az őr hermetikus");
}) as typeof fetch;

const failures: string[] = [];
function inv(name: string, ok: boolean, detail = ""): void {
  if (ok) console.log(`  ✅ ${name}`);
  else {
    console.log(`  ⛔ ${name}${detail ? ` — ${detail}` : ""}`);
    failures.push(name);
  }
}

const ST = "google.maps.places.v1.Places.SearchText";
const PH = "google.maps.places.v1.Places.GetPhotoMedia";
const SVM = "google.maps.StreetViewMetadata.Http";
const GEO = "google.places.Geocoding.Javascript";
const P = "places.googleapis.com";

interface Pt {
  service: string;
  method: string;
  credential?: string;
  end: Date;
  count: number;
}

/** A point at Budapest noon of `day` (an hourly bucket ending 13:00 local). */
function noon(day: string, service: string, method: string, count: number): Pt {
  return { service, method, end: new Date(budapestMidnight(day).getTime() + 13 * 3600_000), count };
}

/** Monitoring-shaped pages; one series per point (the reducer output shape is the same). */
function stub(pages: Pt[][], seen: string[] = []): FetchLike {
  return async (url) => {
    seen.push(url);
    const tok = new URL(url).searchParams.get("pageToken");
    const i = tok ? Number(tok) : 0;
    const body = {
      timeSeries: (pages[i] ?? []).map((p) => ({
        resource: {
          labels: { service: p.service, method: p.method, credential_id: p.credential ?? "apikey:test" },
        },
        points: [
          {
            interval: { endTime: p.end.toISOString(), startTime: new Date(p.end.getTime() - 3600_000).toISOString() },
            value: { int64Value: String(p.count) },
          },
        ],
      })),
      ...(i + 1 < pages.length ? { nextPageToken: String(i + 1) } : {}),
    };
    return { ok: true, status: 200, text: async () => JSON.stringify(body) };
  };
}

const DAY = "2026-10-01";
const base = { day: DAY, project: "testproj", itemMinUsd: 1, getToken: async () => "tok" };

function prior7(method: string, perDay: number, service = P): Pt[] {
  return Array.from({ length: 7 }, (_, k) => noon(addIsoDays(DAY, -7 + k), service, method, perDay));
}

const scenario: Pt[] = [
  ...prior7(ST, 100),
  ...prior7(PH, 2000),
  ...prior7(GEO, 10, "geocoding-backend.googleapis.com"),
  noon(DAY, P, ST, 1000),
  noon(DAY, P, PH, 2000),
  noon(DAY, "street-view-image-backend.googleapis.com", SVM, 5000),
  noon(DAY, "geocoding-backend.googleapis.com", GEO, 100),
  noon(DAY, "routes.googleapis.com", "google.maps.routing.v2.Routes.ComputeRoutes", 7),
  noon(DAY, "drive.googleapis.com", "google.apps.drive.v3.DriveFiles.List", 999),
];

const row = (r: Report, m: string) => r.rows.find((x) => x.method === m);
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

console.log("① ár × darab");
const seen: string[] = [];
const r1 = await runDailyReport({ ...base, thresholdUsd: 1000, fetchImpl: stub([scenario], seen) });
inv("SearchText 1 000 × 35 $/1000 = 35 $", near(row(r1, ST)?.usd ?? -1, 35), String(row(r1, ST)?.usd));
inv("GetPhotoMedia 2 000 × 7 $/1000 = 14 $", near(row(r1, PH)?.usd ?? -1, 14), String(row(r1, PH)?.usd));
inv("Street View Metadata ingyenes = 0 $", near(row(r1, SVM)?.usd ?? -1, 0));
inv("Geocoding 100 × 5 $/1000 = 0,5 $", near(row(r1, GEO)?.usd ?? -1, 0.5));
inv("napi összeg = 49,5 $", near(r1.totalUsd, 49.5), String(r1.totalUsd));
inv(
  "7 napos átlag-költség = 100×35 + 2000×7 + 10×5 /1000 = 17,55 $",
  near(r1.avg7Usd, 17.55),
  String(r1.avg7Usd),
);
inv("az ártábla a forrás (SearchText ára a METHOD_PRICES-ből)", METHOD_PRICES[ST]?.usdPer1000 === 35);

console.log("② napi küszöb");
const r2hi = await runDailyReport({ ...base, thresholdUsd: 40, fetchImpl: stub([scenario]) });
const r2lo = await runDailyReport({ ...base, thresholdUsd: 60, fetchImpl: stub([scenario]) });
inv("49,5 $ > 40 $ küszöb → kiemelés", r2hi.flags.some((f) => f.includes("küszöb")));
inv("a tárgy [FIGYELEM]-mel kezdődik", r2hi.subject.startsWith("[FIGYELEM]"), r2hi.subject);
inv("49,5 $ < 60 $ küszöb → nincs küszöb-kiemelés", !r2lo.flags.some((f) => f.includes("küszöb")));

console.log("③ ≥2× tétel");
inv("SearchText 1 000 vs átlag 100 → KIUGRÁS", row(r2lo, ST)?.flagged === true);
inv("GetPhotoMedia 2 000 vs átlag 2 000 → nincs", row(r2lo, PH)?.flagged === false);
inv("a kiemelés-lista a SearchText-et nevezi meg", r2lo.flags.some((f) => f.startsWith("Places.SearchText")));
inv("a szövegben a sor jelölve", /Places\.SearchText:.*<<< KIUGRÁS/.test(r2lo.text));

console.log("④ apró tétel nem zajong");
inv("Geocoding 0,5 $ (10× az átlagnak) < 1 $ tételminimum → nincs kiemelés", row(r2lo, GEO)?.flagged === false);
const quiet = await runDailyReport({
  ...base,
  thresholdUsd: 1000,
  fetchImpl: stub([[...prior7(PH, 2000), noon(DAY, P, PH, 2100)]]),
});
inv("csendes nap → nincs kiemelés, a tárgyban sincs [FIGYELEM]", quiet.flags.length === 0 && !quiet.subject.startsWith("["));

console.log("⑤ adat-nincs ág");
const noTok = await runDailyReport({
  ...base,
  thresholdUsd: 20,
  getToken: async () => {
    throw new Error("Reauthentication required");
  },
  fetchImpl: stub([scenario]),
});
inv("token-hiba → hasData=false", noTok.hasData === false);
inv("token-hiba → tárgy [NINCS ADAT]", noTok.subject.startsWith("[NINCS ADAT]"), noTok.subject);
inv("token-hiba → az ok a levélben", noTok.text.includes("Reauthentication required"));
const http403: FetchLike = async () => ({ ok: false, status: 403, text: async () => '{"error":"PERMISSION_DENIED"}' });
const no403 = await runDailyReport({ ...base, thresholdUsd: 20, fetchImpl: http403 });
inv("Monitoring 403 → NINCS ADAT, HTTP-kóddal", !no403.hasData && no403.text.includes("HTTP 403"), no403.text.slice(0, 200));
const empty = await runDailyReport({ ...base, thresholdUsd: 20, fetchImpl: stub([[]]) });
inv("üres Monitoring-válasz → NINCS ADAT (nem „0 $”)", !empty.hasData && empty.text.includes("üres"));
const threw = await runDailyReport({
  ...base,
  thresholdUsd: 20,
  fetchImpl: async () => {
    throw new Error("ECONNRESET");
  },
});
inv("hálózati kivétel → NINCS ADAT, nem dob", !threw.hasData && threw.text.includes("ECONNRESET"));
inv("a NINCS ADAT levél is kimondja a becslés-jelleget és a teendőt", noTok.text.includes("Billing → Reports") && noTok.text.includes("gcloud auth login"));

console.log("⑥ budapesti nap (DST)");
const DST = "2026-10-25";
const m0 = budapestMidnight(DST).getTime();
const m1 = budapestMidnight(addIsoDays(DST, 1)).getTime();
inv("a 10-25 budapesti nap 25 óra", m1 - m0 === 25 * 3600_000, String((m1 - m0) / 3600_000));
const dstPts: Pt[] = [];
for (let t = m0 + 3600_000; t <= m1; t += 3600_000) dstPts.push({ service: P, method: PH, end: new Date(t), count: 1 });
dstPts.push({ service: P, method: PH, end: new Date(m0), count: 1000 }); // the last hour of 10-24
dstPts.push({ service: P, method: PH, end: new Date(m1 + 3600_000), count: 1000 }); // the first hour of 10-26
const rDst = await runDailyReport({ ...base, day: DST, thresholdUsd: 1000, fetchImpl: stub([dstPts]) });
inv("mind a 25 óra a napra számol, a szomszéd napok határ-vödre nem", row(rDst, PH)?.calls === 25, String(row(rDst, PH)?.calls));

console.log("⑦ lapozás");
const rPg = await runDailyReport({
  ...base,
  thresholdUsd: 1000,
  fetchImpl: stub([[noon(DAY, P, ST, 10)], [noon(DAY, P, ST, 20)], [noon(DAY, P, ST, 30)]]),
});
inv("három lap összeadódik (60)", row(rPg, ST)?.calls === 60, String(row(rPg, ST)?.calls));

console.log("⑧ ár nélküli Maps / nem-Maps");
const routes = r1.rows.find((x) => x.service === "routes.googleapis.com");
inv("a Routes (nincs az ártáblában) sorként megjelenik, ár nélkül", routes !== undefined && routes.price === null);
inv("a szöveg „NINCS ÁR”-ként és az ár nélküliek között listázza", r1.text.includes("NINCS ÁR") && r1.text.includes("ComputeRoutes"));
inv("a Drive nem kerül a Maps-sorok közé", !r1.rows.some((x) => x.service.startsWith("drive")));
inv("a Drive az egyéb API-k között szerepel", /Egyéb .*drive 999/.test(r1.text));

console.log("⑨ a lekérés");
const q = new URL(seen[0] ?? "http://x/");
inv("órás igazítás (3600s)", q.searchParams.get("aggregation.alignmentPeriod") === "3600s");
inv(
  "kezdet = min(hónap eleje, nap − 7) budapesti éjfél",
  q.searchParams.get("interval.startTime") === budapestMidnight("2026-09-24").toISOString(),
  String(q.searchParams.get("interval.startTime")),
);
inv("vég = a nap utáni budapesti éjfél", q.searchParams.get("interval.endTime") === budapestMidnight("2026-10-02").toISOString());
inv(
  "credential szerint is csoportosít",
  q.searchParams.getAll("aggregation.groupByFields").includes("resource.label.credential_id"),
);

console.log("⑩ a szöveg őszinte");
inv("„BECSLÉS” + Billing → Reports", r1.text.includes("BECSLÉS") && r1.text.includes("Billing → Reports"));
inv("kimondja, hogy MR is használja a projektet", r1.text.includes("Minereal (MR)"));
inv("kimondja, hogy semmit nem korlátoz", r1.text.includes("semmit nem korlátoz"));

// ─────────────────────────────────────────────────────────────────────────────
// VALÓS ág — BigQuery billing export (ADR-XXXX)
// ─────────────────────────────────────────────────────────────────────────────
const TABLE = "testproj.billing_export.gcp_billing_export_v1_X";
type Line = [project: string | null, service: string, sku: string, currency: string, cost: number, credits: number];
interface Bq {
  n?: number;
  firstMs?: number;
  latestMs?: number;
  exportMs?: number;
  lines?: Line[];
  status?: number;
  error?: unknown;
  throws?: string;
  /** Split the rows over this many pages (pageToken). */
  pages?: number;
}
interface Seen {
  url: string;
  method?: string;
  body?: string;
  headers: Record<string, string>;
}

const dayStart = budapestMidnight(DAY).getTime();
const dayEnd = budapestMidnight(addIsoDays(DAY, 1)).getTime();

/** Monitoring (scenario) + BigQuery (bq) behind one fetch. */
function both(bq: Bq, monitoring: FetchLike = stub([scenario]), seenBq: Seen[] = []): FetchLike {
  return async (url, init) => {
    if (!url.startsWith("https://bigquery.googleapis.com/")) return monitoring(url, init);
    seenBq.push({ url, method: init.method, body: init.body, headers: init.headers });
    if (bq.throws) throw new Error(bq.throws);
    if (bq.status && bq.status !== 200) {
      return { ok: false, status: bq.status, text: async () => JSON.stringify(bq.error ?? {}) };
    }
    const head = [bq.n ?? 10, bq.firstMs ?? dayStart - 86_400_000, bq.latestMs ?? dayEnd + 3_600_000, bq.exportMs ?? dayEnd + 7_200_000];
    const cell = (v: unknown) => ({ v: v === null || v === undefined ? null : String(v) });
    const lines = bq.lines ?? [];
    const rows = (lines.length ? lines : [null]).map((l) =>
      ({ f: [...head, ...(l ?? [null, null, null, null, null, null])].map(cell) }),
    );
    const pages = bq.pages ?? 1;
    const tok = new URL(url).searchParams.get("pageToken");
    const i = tok ? Number(tok) : 0;
    const per = Math.ceil(rows.length / pages);
    const body = {
      jobComplete: true,
      jobReference: { jobId: "job_1", location: "EU" },
      rows: rows.slice(i * per, (i + 1) * per),
      ...(i + 1 < pages ? { pageToken: String(i + 1) } : {}),
    };
    return { ok: true, status: 200, text: async () => JSON.stringify(body) };
  };
}

const realBase = { ...base, billingTable: TABLE, billingLocation: "EU", realThresholds: { HUF: 7000, EUR: 18 } };
const HUF_LINES: Line[] = [
  ["testproj", "Places API", "Text Search Enterprise", "HUF", 4000, -500],
  ["testproj", "Places API", "Place Details Photos", "HUF", 1500, 0],
  ["testproj", "Maps JavaScript API", "Dynamic Maps", "HUF", 0, 0],
  ["mr-proj", "Cloud Run", "CPU Allocation Time", "HUF", 300, -300],
  [null, "Support", "Basic", "HUF", 50, 0],
];

console.log("⑪ VALÓS ág");
const seenBq: Seen[] = [];
const r11 = await runDailyReport({ ...realBase, thresholdUsd: 1000, fetchImpl: both({ lines: HUF_LINES }, stub([scenario]), seenBq) });
inv("a nap teljes → billing.status = ok", r11.billing?.status === "ok", String(r11.billing?.status) + " " + r11.billing?.reason);
inv("valós nettó = (4000−500)+1500+0+(300−300)+50 = 5 050 Ft", near(r11.realTotals?.HUF ?? -1, 5050), JSON.stringify(r11.realTotals));
inv("a tárgy a valós számot vezeti, a becslés mellette", /— 5 050 Ft \(számla\) · becslés ~49,50 \$$/.test(r11.subject), r11.subject);
inv("a szöveg: VALÓS költség … 5 050 Ft, bruttó és jóváírás", /VALÓS költség .*: 5 050 Ft\n  bruttó 5 850 Ft, jóváírás −800 Ft/.test(r11.text), r11.text.slice(0, 400));
inv("a becslés is ott van mellette", r11.text.includes("Becsült költség (listaár): 49,50 $"));
inv("projektenként bont, és kimondja (3 projekt: testproj, mr-proj, nincs projekt)", /a számlázási fiók 3 projektje/.test(r11.text) && /\n  testproj: 5 000 Ft  ← a Citoviso projektje/.test(r11.text) && /\n  mr-proj: 0 Ft/.test(r11.text) && /\n  \(nincs projekt\): 50 Ft/.test(r11.text));
inv("service × SKU sor bruttóval és jóváírással", r11.text.includes("Places API · Text Search Enterprise: 3 500 Ft (bruttó 4 000 Ft, jóváírás −500 Ft)"));
inv("a 0 költségű tétel nem sor, hanem darabszám", r11.text.includes("+ 1 díjmentes tétel") && !r11.text.includes("Dynamic Maps: 0 Ft"));
const call = seenBq[0];
const req = JSON.parse(call?.body ?? "{}") as { query?: string; location?: string; queryParameters?: Array<{ name: string; parameterValue: { value: string } }> };
const param = (n: string) => req.queryParameters?.find((x) => x.name === n)?.parameterValue.value;
inv("POST a jobs.query-re, a job-projekt x-goog-user-project-tel", call?.method === "POST" && call.url.endsWith("/projects/testproj/queries") && call.headers["x-goog-user-project"] === "testproj");
inv("a lekérés a megadott táblát kérdezi, location = EU", (req.query ?? "").includes(`\`${TABLE}\``) && req.location === "EU");
inv("@start/@end = a budapesti nap határai", param("start") === new Date(dayStart).toISOString() && param("end") === new Date(dayEnd).toISOString(), `${param("start")} ${param("end")}`);
inv("a SQL csak olvas (SELECT, nincs DDL/DML)", /^WITH /.test(req.query ?? "") && !/\b(INSERT|UPDATE|DELETE|MERGE|CREATE|DROP|ALTER|TRUNCATE)\b/i.test(req.query ?? ""));
inv("a SQL költség + jóváírás (UNNEST(credits)) összegét kéri", /SUM\(cost\)/.test(req.query ?? "") && /UNNEST\(credits\)/.test(req.query ?? ""));
let badName = false;
try {
  billingSql("x`; DROP TABLE y; --");
} catch {
  badName = true;
}
inv("hibás táblanév → dob (nem fűz SQL-be)", badName);
inv("a szöveg kimondja: a valós a Billing exportból, utólag pontosulhat", r11.text.includes("Cloud Billing exportból") && r11.text.includes("utólag is pontosíthat"));

console.log("⑫ valós küszöb");
const big: Line[] = [["testproj", "Places API", "Text Search Enterprise", "HUF", 8000, 0]];
const r12hi = await runDailyReport({ ...realBase, thresholdUsd: 1000, fetchImpl: both({ lines: big }) });
inv("8 000 Ft > 7 000 Ft valós küszöb → [FIGYELEM], VALÓS", r12hi.subject.startsWith("[FIGYELEM]") && r12hi.flags.some((f) => f.includes("VALÓS költség 8 000 Ft — a küszöb 7 000 Ft")), r12hi.flags.join(" | "));
// estimate 49,5 $ > 20 $, but the real 5 050 Ft < 7 000 Ft decides
const r12lo = await runDailyReport({ ...realBase, thresholdUsd: 20, fetchImpl: both({ lines: HUF_LINES }) });
inv("valós 5 050 Ft < 7 000 Ft → nincs küszöb-kiemelés, bár a becslés 49,5 $ > 20 $", !r12lo.flags.some((f) => f.includes("küszöb")), r12lo.flags.join(" | "));
inv("a ≥2× tétel-kiemelés (Monitoring) a valós ág mellett is él", r12lo.flags.some((f) => f.startsWith("Places.SearchText")));
inv("csendes napon a szöveg a VALÓS összegre hivatkozik", r11.text.includes("a napi valós összeg a küszöb alatt") || r11.flags.length > 0);

console.log("⑬ pénznem");
inv("HUF egész forint, csoportosítva", fmtCost(1234.6, "HUF") === "1 235 Ft", fmtCost(1234.6, "HUF"));
inv("EUR centtel", fmtCost(1234.5, "EUR") === "1 234,50 €", fmtCost(1234.5, "EUR"));
inv("USD centtel, kód-jellel", fmtCost(12.345, "USD") === "12,35 USD" || fmtCost(12.345, "USD") === "12,34 USD", fmtCost(12.345, "USD"));
inv("negatív (jóváírás) mínuszjellel", fmtCost(-0.5, "EUR") === "−0,50 €", fmtCost(-0.5, "EUR"));
inv("negatív forint is mínuszjellel, csoportosítva", fmtCost(-1234, "HUF") === "−1 234 Ft", fmtCost(-1234, "HUF"));
inv("a −0,2 Ft nem „−0 Ft”", fmtCost(-0.2, "HUF") === "0 Ft", fmtCost(-0.2, "HUF"));
const eur = await runDailyReport({ ...realBase, thresholdUsd: 1000, fetchImpl: both({ lines: [["testproj", "Places API", "X", "EUR", 20.25, -1] as Line] }) });
inv("EUR-számla: 19,25 € > 18 € küszöb → kiemelés EUR-ban", eur.flags.some((f) => f.includes("19,25 € — a küszöb 18,00 €")), eur.flags.join(" | "));
const usdReal = await runDailyReport({ ...realBase, thresholdUsd: 10, fetchImpl: both({ lines: [["testproj", "Places API", "X", "USD", 12, 0] as Line] }) });
inv("USD-számla: a USD-küszöb (10) dönt a valós 12-re", usdReal.flags.some((f) => f.includes("VALÓS költség 12,00 USD")), usdReal.flags.join(" | "));
const ron = await runDailyReport({ ...realBase, thresholdUsd: 20, fetchImpl: both({ lines: [["testproj", "Places API", "X", "RON", 999999, 0] as Line] }) });
inv("RON (nincs küszöb): NEM hasonlítja a USD-hez — nincs VALÓS kiemelés", !ron.flags.some((f) => f.includes("VALÓS")), ron.flags.join(" | "));
inv("RON: kimondja, hogy nincs küszöb ebben a pénznemben, és a becslés-küszöb fut", ron.text.includes("nincs küszöb RON pénznemben") && ron.flags.some((f) => f.includes("becsült költség 49,50 $")));

console.log("⑭ nincs-tábla / üres / korai nap / hiba");
const nf = await runDailyReport({
  ...realBase,
  thresholdUsd: 1000,
  fetchImpl: both({ status: 404, error: { error: { code: 404, message: "Not found: Table x", errors: [{ reason: "notFound" }] } } }),
});
inv("404 notFound → missing, a becslés a fő szám", nf.hasData && nf.billing?.status === "missing" && nf.realTotals === undefined);
inv("404: kimondja, hogy a tábla még nem létezik", nf.text.includes("Valós költség: NINCS MÉG") && nf.text.includes("még nem létezik") && nf.text.includes("A fő szám ezért a becslés"));
inv("404: a tárgy jelzi, hogy becslés és a számla még nincs", nf.subject.endsWith("~49,50 $ (becslés; a számla-adat még nincs meg)"), nf.subject);
const emptyT = await runDailyReport({ ...realBase, thresholdUsd: 1000, fetchImpl: both({ n: 0, firstMs: undefined, lines: [] }) });
inv("üres tábla → missing, „üres”", emptyT.billing?.status === "missing" && emptyT.text.includes("táblája üres"), emptyT.billing?.reason);
const early = await runDailyReport({ ...realBase, thresholdUsd: 1000, fetchImpl: both({ firstMs: dayStart + 3_600_000 }) });
inv("az export a nap UTÁN indul → missing, nem részleges számla", early.billing?.status === "missing" && early.text.includes("csak 2026-10-01"), early.billing?.reason);
const e403 = await runDailyReport({ ...realBase, thresholdUsd: 1000, fetchImpl: both({ status: 403, error: { error: { message: "Access Denied" } } }) });
inv("403 → error, HTTP-kóddal és üzenettel; a tárgy: számla-lekérdezés hibás", e403.billing?.status === "error" && e403.text.includes("BigQuery HTTP 403: Access Denied") && e403.subject.includes("számla-lekérdezés hibás"));
const ex = await runDailyReport({ ...realBase, thresholdUsd: 1000, fetchImpl: both({ throws: "ETIMEDOUT" }) });
inv("hálózati kivétel → error, nem dob, a becslés kimegy", ex.hasData && ex.billing?.status === "error" && ex.text.includes("ETIMEDOUT"));
const off = await runDailyReport({ ...base, thresholdUsd: 1000, fetchImpl: both({}) });
inv("nincs tábla megadva → off, kimondja (nem néma)", off.billing?.status === "off" && off.text.includes("GOOGLE_BILLING_EXPORT_TABLE üres"));

console.log("⑮ késő adat");
const late = await runDailyReport({
  ...realBase,
  thresholdUsd: 1000,
  fetchImpl: both({ latestMs: dayEnd - 5 * 3_600_000, lines: big }),
});
inv("a nap még nem teljes → late, a becslés a fő szám", late.billing?.status === "late" && late.realTotals === undefined && late.subject.includes("(becslés; a számla-adat még nincs meg)"), late.subject);
inv("kimondja a késést és az utolsó beérkezett használatot", late.text.includes("még nem érkezett meg teljesen") && late.text.includes("2026-10-01 19:00"), late.billing?.reason);
inv("a részleges összeg tájékoztat, de RÉSZLEGES-ként", late.text.includes("eddig beérkezett (RÉSZLEGES, nem a nap egésze): 8 000 Ft"));
inv("a részleges 8 000 Ft nem vált ki valós küszöb-kiemelést", !late.flags.some((f) => f.includes("VALÓS")));

console.log("⑯ egyik vagy másik forrás hiányzik");
const monFail: FetchLike = async () => ({ ok: false, status: 500, text: async () => "boom" });
const onlyReal = await runDailyReport({ ...realBase, thresholdUsd: 1000, fetchImpl: both({ lines: HUF_LINES }, monFail) });
inv("Monitoring-hiba + kész számla → riport a valós számmal", onlyReal.hasData && near(onlyReal.realTotals?.HUF ?? -1, 5050) && onlyReal.subject.endsWith("5 050 Ft (számla)"), onlyReal.subject);
inv("… és kimondja, miért nincs becslés", onlyReal.text.includes("Becsült költség (listaár): NINCS — a Cloud Monitoring lekérdezés elbukott (Cloud Monitoring HTTP 500"));
const neither = await runDailyReport({ ...realBase, thresholdUsd: 1000, fetchImpl: both({ latestMs: dayStart }, monFail) });
inv("Monitoring-hiba + késő számla → NINCS ADAT, mindkét okkal", !neither.hasData && neither.text.includes("HTTP 500") && neither.text.includes("Valós költség (számla-export): nincs — a nap számla-adata még nem érkezett meg"));

console.log("⑰ BigQuery-lapozás, DST");
const seenPg: Seen[] = [];
const pg = await runDailyReport({ ...realBase, thresholdUsd: 1000, fetchImpl: both({ lines: HUF_LINES, pages: 3 }, stub([scenario]), seenPg) });
inv("három lap összeadódik (5 050 Ft)", near(pg.realTotals?.HUF ?? -1, 5050), JSON.stringify(pg.realTotals));
inv("a további lapok a job getQueryResults-ával, location-nel jönnek", seenPg.length === 3 && seenPg[1]!.url.includes("/queries/job_1?") && seenPg[1]!.url.includes("location=EU"));
const seenDst: Seen[] = [];
await runDailyReport({ ...realBase, day: DST, thresholdUsd: 1000, fetchImpl: both({}, stub([dstPts]), seenDst) });
const dq = JSON.parse(seenDst[0]?.body ?? "{}") as typeof req;
const dStart = Date.parse(dq.queryParameters?.find((x) => x.name === "start")?.parameterValue.value ?? "");
const dEnd = Date.parse(dq.queryParameters?.find((x) => x.name === "end")?.parameterValue.value ?? "");
inv("a 10-25 számla-lekérése 25 órát fog át", dEnd - dStart === 25 * 3600_000, String((dEnd - dStart) / 3600_000));

if (failures.length) {
  console.log(`\n⛔ google-cost-report-check: ${failures.length} bukás`);
  process.exit(1);
}
console.log("\n✅ google-cost-report-check: minden mérés zöld");
