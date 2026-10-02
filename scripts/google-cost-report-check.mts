// ŐR — a napi Google-költség riport (ADR-XXXX) számolása. Hermetikus: fetch-csonk,
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
//
//   npx tsx scripts/google-cost-report-check.mts

import {
  METHOD_PRICES,
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

if (failures.length) {
  console.log(`\n⛔ google-cost-report-check: ${failures.length} bukás`);
  process.exit(1);
}
console.log("\n✅ google-cost-report-check: minden mérés zöld");
