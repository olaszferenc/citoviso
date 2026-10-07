// ⛔ KIKAPCSOLT FIZETŐS API-K MELLETT A SCRAPE 0 FT (ADR-0336, Q7 — tulaj: „SCRAPE_PAID_APIS=off
// élesen alapból”).
//
// A HÁTTÉR. A scrape dúsító-lánca leadenként fizet (Places Text Search / Details / Photos,
// Street View, Google-vélemények, Brave / Google CSE webes keresés), a Google Maps forrás pedig
// a felderítésben. A Magellan-felderítő (a Térkép kézi olvasása) ezt kiváltja, ezért a fizetős
// hívásokat egy kapcsoló (config.scrapePaidApis, env SCRAPE_PAID_APIS) zárja: CSAK a szó szerinti
// „on” nyit, minden más (üres is) = 0 Ft.
//
// Amit kimond — HÁLÓZAT NÉLKÜL (globális fetch-csonk; a kapu soha nem fizet, DB-t nem ír).
// A config importkor olvassa a környezetet, ezért a két állást KÉT GYEREKFOLYAMAT méri
// (ugyanez a fájl `--child`-dal, más env-vel), mindkettőben ugyanazokkal a csonk-kulcsokkal:
//   ① OFF: a VALÓDI enrichLeads egy fixture-ön (honlap nélküli leadek + egy törött linkű
//      saját honlap) EGYETLEN hívást sem indít a googleapis.com / maps.googleapis.com /
//      api.search.brave.com / www.googleapis.com/customsearch felé;
//   ② ON (piros kontroll): ugyanaz a lánc ugyanazon a fixture-ön IGENIS fizetne — ha itt nincs
//      fizetős hívás, az őr vak (a fixture nem éri el a fizetős lépéseket), és a kapu bukik;
//   ③ a run.ts a Google Maps forrást csak `config.scrapePaidApis` mellett veszi a források közé;
//   ④ a konzol három fizetős gombja (újragyűjtés, portál-fotók, Places-fotók) a kapcsolóval
//      kapuzott a szerveren (409), mielőtt a fizetős kódot meghívná.
//
// Futtatás: npx tsx scripts/scrape-zero-paid-check.mts

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const PAID = [
  "https://places.googleapis.com/",
  "https://maps.googleapis.com/",
  "https://www.googleapis.com/customsearch/",
  "https://api.search.brave.com/",
];
const MARK = "__ZERO_PAID_RESULT__";

if (process.argv.includes("--child")) {
  await child();
} else {
  await parent();
}

/** One measurement in THIS process: the env was set by the parent before any import. */
async function child(): Promise<void> {
  const paid: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    if (PAID.some((p) => url.startsWith(p)) || /googleapis\.com|api\.search\.brave\.com/.test(url)) {
      paid.push(`${url.split("?")[0]}`);
      if (url.startsWith("https://api.search.brave.com/")) return json({ web: { results: [] } });
      if (url.startsWith("https://www.googleapis.com/customsearch/")) return json({ items: [] });
      if (url.includes("streetview/metadata")) return json({ status: "ZERO_RESULTS" });
      if (url.includes("geocode")) return json({ status: "ZERO_RESULTS", results: [] });
      const q = typeof init?.body === "string" ? (JSON.parse(init.body).textQuery as string | undefined) : undefined;
      const lead = q ? FIXTURE.find((f) => q.includes(f.name)) : undefined;
      const place = lead && {
        id: `ChIJ-${lead.sourceId}`,
        displayName: { text: lead.name },
        location: { latitude: lead.lat, longitude: lead.lon },
        photos: [{ name: `places/ChIJ-${lead.sourceId}/photos/p0` }],
        reviews: [],
      };
      if (url.includes(":searchText")) return json({ places: place ? [place] : [] });
      if (url.includes("/media")) return json({ photoUri: "https://lh3.googleusercontent.com/stub=s1200" });
      return json({ reviews: [] });
    }
    // Every free fetch (domain guess, own site, portal, Nominatim) answers "not found".
    return new Response("", { status: 404 });
  }) as typeof fetch;

  const { config } = await import("../src/config.js");
  const { dedupeAndQualify } = await import("../src/scraper/dedupe.js");
  const { enrichLeads } = await import("../src/scraper/enrichChain.js");
  type Region = Parameters<typeof enrichLeads>[1];
  type Raw = Parameters<typeof dedupeAndQualify>[0][number];

  const region = {
    id: "badacsony",
    label: "Badacsony",
    country: "HU",
    bbox: { south: 46.7, west: 17.4, north: 46.9, east: 17.6 },
  } as unknown as Region;

  // Six no-website players (Places, site search, portal search, reviews, Street View,
  // web-search contact) and one own site behind a dead deep link (the broken-site repair).
  const FIXTURE: { name: string; sourceId: string; lat: number; lon: number; website?: string }[] = [];
  const raw = Array.from({ length: 7 }, (_, i) => ({
    industry: "accommodation",
    source: "osm",
    sourceId: `node/${910000 + i}`,
    name: `Nullforint Vendégház ${String.fromCharCode(65 + i)}`,
    lat: 46.78 + i * 0.01,
    lon: 17.5,
    phone: `+36 30 555 01${String(i).padStart(2, "0")}`,
    ...(i === 6 ? { website: "https://nullforint-vendeghaz-g.hu/szobak/regi-oldal" } : {}),
  })) as unknown as Raw[];
  FIXTURE.push(...(raw as unknown as typeof FIXTURE));
  const base = dedupeAndQualify(raw, "accommodation", region.id);

  const marks: string[] = [];
  const quiet = (): void => {};
  const [log, warn] = [console.log, console.warn];
  console.log = console.warn = quiet;
  let error: string | null = null;
  try {
    await enrichLeads(base, region, (line) => void marks.push(line));
  } catch (e) {
    error = (e as Error).message;
  } finally {
    [console.log, console.warn] = [log, warn];
  }
  const { db } = await import("../src/db/client.js");
  await db.destroy().catch(() => {});
  process.stdout.write(
    `${MARK}${JSON.stringify({ switch: config.scrapePaidApis, leads: base.length, paid, marks, error })}\n`,
  );
  process.exit(0);
}

type ChildResult = { switch: boolean; leads: number; paid: string[]; marks: string[]; error: string | null };

/** Run one measurement in a child process (the config reads the env at import time). */
function runChild(value: string | undefined): Promise<ChildResult | string> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    // Stub keys: the paid steps WOULD run if the switch let them (the fetch stub answers).
    GOOGLE_MAPS_API_KEY: "stub-key-no-network",
    GOOGLE_MAPS_GENERATOR_KEY: "stub-gen-key-no-network",
    GOOGLE_CSE_ID: "stub-cse-no-network",
    BRAVE_API_KEY: "stub-brave-no-network",
    ANTHROPIC_API_KEY: "",
    PLACES_MAX_RPM: "100000",
    PLACES_RETRY_BASE_MS: "10",
  };
  // An explicit "" (not deleted): the .env loader must not slip a machine value in.
  env.SCRAPE_PAID_APIS = value ?? "";
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url), "--child"], {
      env,
      timeout: 240_000,
    });
    let out = "";
    let err = "";
    p.stdout.setEncoding("utf8").on("data", (c: string) => (out += c));
    p.stderr.setEncoding("utf8").on("data", (c: string) => (err += c));
    p.on("close", (code) => {
      const line = out.split("\n").find((l) => l.startsWith(MARK));
      resolve(
        line
          ? (JSON.parse(line.slice(MARK.length)) as ChildResult)
          : `a gyerekfolyamat nem adott eredményt (kód ${code}): ${err.slice(-800)}`,
      );
    });
  });
}

async function parent(): Promise<void> {
  let failures = 0;
  const check = (label: string, ok: boolean, detail?: unknown): void => {
    console.log(`${ok ? "✓" : "✗"}  ${label}${detail !== undefined ? `\n     ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
    if (!ok) failures++;
  };
  const hosts = (urls: string[]) => [...new Set(urls.map((u) => new URL(u).host))];

  // The four measurements run side by side (each one is its own process).
  const OFF_VALUES = [undefined, "off", "ON "] as const;
  const [onRun, ...offRuns] = await Promise.all([runChild("on"), ...OFF_VALUES.map((v) => runChild(v))]);

  // ① OFF — both the unset default and an explicit non-"on" value.
  for (const [k, value] of OFF_VALUES.entries()) {
    const off = offRuns[k]!;
    const label = value === undefined ? "nincs megadva" : JSON.stringify(value);
    if (typeof off === "string") {
      check(`① OFF (${label}): a mérés lefutott`, false, off);
      continue;
    }
    check(`① OFF (${label}): a kapcsoló zárva`, off.switch === false, `config.scrapePaidApis = ${off.switch}`);
    check(`① OFF (${label}): a lánc hiba nélkül lefutott (${off.leads} lead)`, off.error === null, off.error ?? undefined);
    check(
      `① OFF (${label}): 0 fizetős hívás a googleapis / Brave felé`,
      off.paid.length === 0,
      off.paid.length ? `${off.paid.length} hívás, az első: ${off.paid[0]}` : undefined,
    );
    check(
      `① OFF (${label}): a futás-napló kimondja, hogy a fizetős lépések ki vannak kapcsolva`,
      off.marks.some((m) => /KIKAPCSOLVA/.test(m)),
    );
  }

  // ② ON — the red control: the same chain on the same fixture must want to pay.
  const on = onRun!;
  if (typeof on === "string") {
    check("② ON (piros kontroll): a mérés lefutott", false, on);
  } else {
    check("② ON: a kapcsoló nyitva", on.switch === true, `config.scrapePaidApis = ${on.switch}`);
    const seen = hosts(on.paid);
    check(
      "② ON (piros kontroll): ugyanaz a lánc FIZETNE — különben az őr vak",
      on.paid.length > 0,
      `${on.paid.length} fizetős hívás · ${seen.join(", ")}`,
    );
    check(
      "② ON: a Places ÉS a webes keresés is fizetne (a fixture mindkét ágat eléri)",
      on.paid.some((u) => u.startsWith("https://places.googleapis.com/")) &&
        on.paid.some((u) => u.startsWith("https://api.search.brave.com/")),
      seen,
    );
  }

  // ③ run.ts: the Google Maps source only behind the switch.
  const run = await readFile(new URL("../src/scraper/run.ts", import.meta.url), "utf8");
  const stmt = /const sources\b[^;]*;/.exec(run)?.[0] ?? "";
  const q = stmt.indexOf("config.scrapePaidApis ?");
  const colon = q >= 0 ? stmt.indexOf(":", q) : -1;
  const gmAll = [...stmt.matchAll(/new GoogleMapsSource\(/g)].map((m) => m.index ?? -1);
  check(
    "③ run.ts: a GoogleMapsSource csak `config.scrapePaidApis` mellett kerül a források közé",
    stmt !== "" && q >= 0 && colon > q && gmAll.length > 0 && gmAll.every((i) => i > q && i < colon),
    stmt.replace(/\s+/g, " ").slice(0, 200),
  );

  // ④ the console's paid buttons are gated on the server before the paid code runs.
  const server = await readFile(new URL("../src/console/server.ts", import.meta.url), "utf8");
  for (const [name, re, call] of [
    ["reenrich", /if \(method === "POST" && reenrichMatch\) \{([\s\S]*?)reenrichOne\(/, "reenrichOne"],
    ["rescrape-photos", /if \(method === "POST" && rescrapeMatch\) \{([\s\S]*?)rescrapePhotos\(/, "rescrapePhotos"],
    ["places-photos", /if \(method === "POST" && placesAskMatch\) \{([\s\S]*?)resolveGatedPhotos\(/, "resolveGatedPhotos"],
  ] as const) {
    const pre = re.exec(server)?.[1] ?? "";
    check(
      `④ POST ${name}: a kapcsoló 409-cel zár, mielőtt a ${call} lefutna`,
      /if \(!config\.scrapePaidApis\)[\s\S]*?send\(res, 409/.test(pre),
      pre ? undefined : "a route nem található",
    );
  }

  if (failures) {
    console.error(`\n⛔ scrape-zero-paid-check: ${failures} állítás piros — kikapcsolt kapcsolóval is fizetne a scrape (vagy az őr vak).`);
    process.exit(1);
  }
  console.log("\n✅ scrape-zero-paid-check: SCRAPE_PAID_APIS≠on mellett a scrape 0 Ft; „on” mellett a lánc fizetne (az őr lát).");
}
