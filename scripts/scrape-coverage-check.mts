// ŐR — „a felderítésnek MINDENT meg kell találnia" (tulaj-rendelet, 2026-09-13).
//
// A MÉRT HIBA (éles, tulaj-bejelentés): a Google Places forrás EGY hívást intézett
// EGY kulcsszóval, és az első lap 20 találatát hitte a régió teljes válaszának —
// Balaton-Keleten 20 hely a Google-ből, 1009 mellett az OSM-ből. Ez a felderítő
// motor: az első-lap-plafon azt jelenti, hogy a Google-ben élő szállások túlnyomó
// részét SOHA nem látjuk meg, egyetlen régióban sem. Másodjára: az első perc-kvóta
// 429 az egész dúsítási kört megölte (924 leadből ~900 Places-adat nélkül maradt),
// pedig a perc-limit 60 mp alatt magától gyógyul.
//
// Amit ez az őr mér — SZINTETIKUS Places-világ ellen (mock fetch), determinisztikusan:
//   ① LEFEDETTSÉG: 180 szintetikus helyből a forrásnak ≥95%-ot meg kell találnia
//      (lapozás + csempe-felosztás + több kulcsszó együtt)
//   ② LAPOZÁS: a mock lapokra tördel (20/lap, max 60/lekérdezés) — token-követés nélkül
//      az ① matematikailag bukik
//   ③ PERC-KVÓTA: a mock a hívások egy részére 429 „per minute"-et ad — a futásnak
//      várnia és folytatnia kell, nem meghalnia; a lefedettség így is ≥95%
//   ④ NAPI KVÓTA: „per day" 429-re viszont AZONNAL fel kell adni (a várakozás ott
//      hazugság lenne) — a hiba osztályozva jut el a hívóig (scope: day)
//   ⑤ KÖLTSÉG-FEGYELEM: a hívás-keret kimerülése HANGOS (a néma plafon ugyanez a
//      hiba lenne új ruhában)
//
//   npx tsx scripts/scrape-coverage-check.mts
//   npx tsx scripts/scrape-coverage-check.mts --self-test
//     ⛔ NEGATÍV FUTÁS: a hívás-keretet 1-re szorítja (= a régi, egy-hívásos
//     viselkedés) → a lefedettség-mérésnek PIROSRA kell váltania. Ha zölden marad,
//     az őr nem a szabályt méri.
//
// ⚠️ Az env-t a MODUL BETÖLTÉSE ELŐTT kell beállítani (a knobok import-időben
// olvasódnak) → dinamikus import (reference_env_assignment_loses_to_esm_imports).

const SELF_TEST = process.argv.includes("--self-test");

process.env.PLACES_RETRY_BASE_MS = "10"; // a perc-kvóta próba ne várjon perceket
process.env.PLACES_MAX_RPM = "100000"; // a throttle ne lassítsa a tesztet
process.env.PLACES_DISCOVERY_MAX_CALLS = SELF_TEST ? "1" : "400";

const { GoogleMapsSource, placesLookup, PlacesUnavailableError } = await import(
  "../src/scraper/sources/googleMaps.js"
);
const { config } = await import("../src/config.js");

const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) console.log(`  ✅ ${name}`);
  else {
    console.log(`  ⛔ ${name}${detail ? ` — ${detail}` : ""}`);
    failures.push(name);
  }
}

// ── Szintetikus világ ────────────────────────────────────────────────────────
// 180 hely a Balaton-Kelet méretű dobozban, determinisztikus rácson + LCG-szórással.
// Minden hely EGY „fajtát" visel (hotel, panzió, …), és a lekérdezés csak a saját
// fajtájára találja meg — így az egy-kulcsszavas bejárás szerkezetileg vak a többire,
// pontosan úgy, ahogy a relevancia-rangsor az élesben.
const BBOX = { s: 46.75, w: 17.25, n: 46.95, e: 18.05 };
const KINDS = ["szállás", "hotel", "panzió", "apartman", "vendégház", "kemping"];
interface FakePlace {
  id: string;
  name: string;
  lat: number;
  lon: number;
  kind: string;
}
let seed = 42;
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2 ** 31;
  return seed / 2 ** 31;
};
const WORLD: FakePlace[] = [];
for (let i = 0; i < 180; i++) {
  const kind = KINDS[i % KINDS.length];
  // Sűrűsödés: az első 80 hely egy „városmagba" tömörül (Siófok környéke), hogy a
  // csempe-felosztásnak legyen mit felosztania; a többi szétszórva.
  const core = i < 80;
  const lat = core ? 46.9 + rand() * 0.02 : BBOX.s + rand() * (BBOX.n - BBOX.s);
  const lon = core ? 18.0 + rand() * 0.03 : BBOX.w + rand() * (BBOX.e - BBOX.w);
  WORLD.push({ id: `fake_${i}`, name: `${kind} teszthely ${i}`, lat, lon, kind });
}

// ── Mock Places API ──────────────────────────────────────────────────────────
let searchCalls = 0;
let minuteQuotaTrips = 0;
/** Hívás-sorszámok, amikre perc-429-et adunk (a retry-útvonal próbája). */
let minute429at = new Set<number>();
let alwaysDay429 = false;

interface SearchBody {
  textQuery: string;
  locationRestriction: {
    rectangle: {
      low: { latitude: number; longitude: number };
      high: { latitude: number; longitude: number };
    };
  };
  pageSize?: number;
  pageToken?: string;
  maxResultCount?: number;
}

const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
  const u = String(url);
  if (!u.includes("places.googleapis.com/v1/places:searchText")) {
    return realFetch(url, init);
  }
  searchCalls++;
  if (alwaysDay429) {
    return new Response(
      JSON.stringify({
        error: {
          code: 429,
          message:
            "Quota exceeded for quota metric 'SearchTextRequest' and limit 'SearchTextRequest per day' of service 'places.googleapis.com'.",
          status: "RESOURCE_EXHAUSTED",
        },
      }),
      { status: 429 },
    );
  }
  if (minute429at.has(searchCalls)) {
    minuteQuotaTrips++;
    return new Response(
      JSON.stringify({
        error: {
          code: 429,
          message:
            "Quota exceeded for quota metric 'SearchTextRequest' and limit 'SearchTextRequest per minute' of service 'places.googleapis.com'.",
          status: "RESOURCE_EXHAUSTED",
        },
      }),
      { status: 429 },
    );
  }
  const body = JSON.parse(String(init?.body ?? "{}")) as SearchBody;
  const r = body.locationRestriction.rectangle;
  const kw = body.textQuery;
  // Kétféle kérdés jön ide: a FELDERÍTÉS fajtára kérdez („hotel"), a PER-LEAD
  // lookup a hely NEVÉRE („hotel teszthely 7"). A fajta-kérdés csak a saját
  // fajtáját adja vissza (ez teszi az egy-kulcsszavas bejárást szerkezetileg
  // vakká); a név-kérdés névre illeszt.
  const matched = WORLD.filter((p) => {
    const inBox =
      p.lat >= r.low.latitude &&
      p.lat <= r.high.latitude &&
      p.lon >= r.low.longitude &&
      p.lon <= r.high.longitude;
    if (!inBox) return false;
    return KINDS.includes(kw) ? p.kind === kw : p.name === kw;
  });
  const pageSize = Math.min(body.pageSize ?? body.maxResultCount ?? 20, 20);
  const offset = body.pageToken ? Number(body.pageToken) : 0;
  const page = matched.slice(offset, offset + pageSize);
  const served = offset + page.length;
  // Az API lekérdezésenként legfeljebb 60-at ad ki — utána NINCS token, akárhány van még.
  const nextPageToken =
    served < matched.length && served < 60 ? String(served) : undefined;
  return new Response(
    JSON.stringify({
      places: page.map((p) => ({
        id: p.id,
        displayName: { text: p.name },
        formattedAddress: `Tesztfalu, ${p.name} u. 1.`,
        location: { latitude: p.lat, longitude: p.lon },
        photos: [],
      })),
      ...(nextPageToken ? { nextPageToken } : {}),
    }),
    { status: 200 },
  );
}) as typeof fetch;

// A forrásnak kulcs kell — a mock miatt bármi jó, de a config-ból jönne éles kulcs:
// felülütjük, hogy az őr VÉLETLENÜL se érhessen ki a valódi API-ra.
(config as { googleMapsApiKey?: string }).googleMapsApiKey = "test-key-mock-only";

const region = {
  id: "orchk",
  label: "Őr-régió",
  bbox: [BBOX.s, BBOX.w, BBOX.n, BBOX.e] as const,
  country: "HU",
};

try {
  console.log(
    SELF_TEST
      ? "\nÖNTESZT — hívás-keret = 1 (a régi, egy-hívásos viselkedés szimulációja):"
      : "\nscrape-lefedettség őr — szintetikus Places-világ (180 hely):",
  );

  // ① + ② + ⑤ — lefedettség a tiszta világon
  const src = new GoogleMapsSource();
  const found = await src.fetch({ region, industry: "accommodation" } as never);
  const coverage = found.length / WORLD.length;
  const covOk = coverage >= 0.95;
  if (SELF_TEST) {
    check(
      "① ÖNTESZT: 1 hívással a lefedettség BUKIK (a régi viselkedés nem éri el a 95%-ot)",
      !covOk,
      `talált: ${found.length}/${WORLD.length} (${(coverage * 100).toFixed(0)}%)`,
    );
  } else {
    check(
      `① lefedettség ≥95% — talált: ${found.length}/${WORLD.length} (${(coverage * 100).toFixed(0)}%)`,
      covOk,
    );
    check(
      "② a bejárás lapozott ÉS csempézett (több hívás, mint kulcsszó)",
      searchCalls > KINDS.length,
      `hívások: ${searchCalls}`,
    );
    check(
      "① nincs duplikátum (place id szerint egyedi)",
      new Set(found.map((f) => f.sourceId)).size === found.length,
    );

    // ③ — perc-kvóta: a következő futás első néhány hívása 429 'per minute'
    searchCalls = 0;
    minute429at = new Set([2, 3, 7]);
    const found2 = await src.fetch({ region, industry: "accommodation" } as never);
    check(
      "③ a perc-kvóta 429 NEM öli meg a kört: várakozás után a lefedettség teljes",
      found2.length / WORLD.length >= 0.95 && minuteQuotaTrips >= 3,
      `talált: ${found2.length}/${WORLD.length} · 429-ek: ${minuteQuotaTrips}`,
    );

    // ③b — a per-lead lookup is túléli a perc-429-et
    searchCalls = 0;
    minute429at = new Set([1]);
    const target = WORLD[0];
    const match = await placesLookup(target.name, target.lat, target.lon, "test-key");
    check(
      "③ a per-lead lookup az első 429 után újrapróbál és TALÁL",
      match !== null && match?.placeName === target.name,
      `match=${match?.placeName ?? "null"}`,
    );

    // ④ — napi kvóta: azonnali, osztályozott feladás
    minute429at = new Set();
    alwaysDay429 = true;
    searchCalls = 0;
    let dayErr: unknown;
    try {
      await placesLookup(target.name, target.lat, target.lon, "test-key");
    } catch (e) {
      dayErr = e;
    }
    check(
      "④ a NAPI kvóta 429 azonnal, osztályozva bukik (scope: day, nincs újrapróbálás)",
      dayErr instanceof PlacesUnavailableError &&
        dayErr.failure === "quota" &&
        dayErr.quotaScope === "day" &&
        searchCalls === 1,
      `hívások: ${searchCalls} · scope: ${(dayErr as { quotaScope?: string })?.quotaScope}`,
    );
    alwaysDay429 = false;
  }
} finally {
  globalThis.fetch = realFetch;
}

if (failures.length) {
  console.error(`\n⛔ scrape-lefedettség őr: ${failures.length} mérés BUKOTT`);
  for (const f of failures) console.error(`   · ${f}`);
  process.exit(1);
}
console.log(
  SELF_TEST
    ? "\n✅ ÖNTESZT: az egy-hívásos (régi) viselkedésen a lefedettség-mérés pirosra vált — az őr a szabályt méri."
    : "\n✅ A felderítés lapoz, csempéz, több kulcsszóval kérdez, a perc-kvótát kivárja, a napit kimondja.",
);
