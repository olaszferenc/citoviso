// LEAD-LIST LABEL GUARD — "does the filter's sentence name the column the filter
// actually reads?"
//
// THE BUG IT CLOSES (Elek FK-003, 2026-09-11): the default filter advertised itself
// as "min. 1 kép" while its predicate ran on the MATERIAL column. The operator read a
// promise about FOTÓK and saw a red 0 there on 100 of the 260 listed rows. Nothing was
// broken in a way any existing gate could see: the filter worked, the label was a
// sentence, the tests were green. Only a check that reads the SHIPPED SENTENCE and
// then measures the CELLS OF THE COLUMN IT NAMES can catch that class.
//
// How it measures: renders the real `leadsPage()` over a fixture, opens it in a real
// DOM, reads `[data-filter-summary]`, resolves each "«Oszlop»: feltétel" segment to a
// `data-col` key, and asserts every rendered cell of THAT column satisfies THAT
// condition. Plus: the control of every registered filter must sit in its own
// column's <th>, the printed counts must match the rendered rows, and the
// active/disqualified switch must carry the operator's query both ways.
//
//   npx tsx scripts/lead-filter-label-check.mts             # green run
//   npx tsx scripts/lead-filter-label-check.mts --self-test # RED control

import { once } from "node:events";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";

import { chromium } from "playwright-core";

import { buildLeadListResult, type LeadListRow, type LeadQuery } from "../src/console/data.js";
import { runWithConsoleLang } from "../src/console/i18nCtx.js";
import {
  columnLabel,

  columnMeaning,
  effectiveLeadSort,
  LEAD_COLUMNS,
  LEAD_FILTERS,
  SORTABLE_COLUMNS,
  unknownRegionLabel,
  type LeadColumnKey,
} from "../src/console/leadFilters.js";
import { leadsPage } from "../src/console/views.js";

const SELF_TEST = process.argv.includes("--self-test");

const fails: string[] = [];
const oks: string[] = [];
const ok = (m: string) => oks.push(m);
const bad = (m: string) => fails.push(m);
const check = (cond: boolean, m: string) => (cond ? ok(m) : bad(m));

// ── Fixture ─────────────────────────────────────────────────────────────────
// Deliberately shaped like the real corpus at the moment of the finding: leads whose
// photos are 0 but whose MATERIAL is not, because THAT is the row the drifted label
// lied about. `proveFixture()` below refuses to run if the fixture stops producing
// them (feedback_fixture_must_prove_its_own_path).
function row(i: number, over: Partial<LeadListRow> = {}): LeadListRow {
  return {
    id: `lead-${i}`,
    name: `Teszt Szállás ${i}`,
    qualification: "no_site",
    matchConfidence: 0.9,
    region: "balaton-north",
    regionLabel: "Balaton",
    regionKnown: true,
    // Distinct days, NOT one constant: the default order is "legutóbb felmért elöl",
    // and a fixture where every row shares a timestamp would let a broken sort look
    // monotonic. `i` spreads them over ~2 months.
    surveyedAt: new Date(Date.UTC(2026, 6, 1 + (i % 60), 6, (i * 7) % 60)).toISOString(),
    country: "HU",
    city: "Siófok",
    photos: 4,
    streetView: false,
    material: 7,
    contact: "email",
    lifecycle: "new",
    latestArtifact: null,
    outreachSentAt: null,
    ...over,
  };
}

const FIXTURE: LeadListRow[] = [
  // Portal-only material: 0 Places photos, plenty of gathered images — the exact row
  // the "min. 1 kép" label mis-described.
  ...Array.from({ length: 30 }, (_, i) => row(i, { photos: 0, material: 5 + i })),
  ...Array.from({ length: 30 }, (_, i) => row(100 + i, { photos: 2 + i, material: 2 + i })),
  // No material at all → must fall OUT of the default filter.
  ...Array.from({ length: 8 }, (_, i) => row(200 + i, { photos: 0, material: 0 })),
  // Modern site → out of the default filter for a different reason.
  ...Array.from({ length: 5 }, (_, i) => row(300 + i, { qualification: "modern", material: 9 })),
  // Ruled out → lives in the other view only.
  ...Array.from({ length: 3 }, (_, i) => row(400 + i, { lifecycle: "disqualified" })),
  // A SECOND registered area, so the Terület column is not single-valued: a column
  // where every cell says the same thing carries no information, and the filter/sort
  // assertions below would be measuring one bucket.
  ...Array.from({ length: 6 }, (_, i) =>
    row(900 + i, {
      region: "badacsony",
      regionLabel: "Badacsony (Badacsonytomaj környéke)",
      material: 4,
      city: "Badacsonytomaj",
    }),
  ),
  // UNREGISTERED scrape areas — the exact keys the live corpus carried (Elek FK-003 H1):
  // `bs` and `_test` are scrape-definition identifiers, `Balaton` is a hand-typed one.
  // The column must say "nincs besorolás" for all three, never the key itself. Their
  // sort key is the empty string, which is also what proves the Terület sort follows
  // the DISPLAYED label and not the hidden area id (`bs` would sort between `badacsony`
  // and `balaton-north`, the empty bucket does not).
  ...["bs", "_test", "Balaton"].map((id, i) =>
    row(500 + i, {
      region: id,
      regionLabel: id,
      regionKnown: false,
      material: 3,
      city: i === 0 ? "Ábrahámhegy" : null,
    }),
  ),
  // ACCENT-INITIAL values. Code-point order files these after "Z" — on the live
  // corpus exactly that happened to Ábrahámhegy / Óbudavár / Örvényes and to four
  // lead names. If the comparator regresses, the order assertions below go red.
  ...["Ábrahámhegy", "Óbudavár", "Örvényes", "Üröm", "Zánka", "Vállus"].map((c, i) =>
    row(800 + i, { city: c, name: `${c} Vendégház`, material: 4 }),
  ),
  // NO portal match at all. These print "–" in the Match column and must fall OUT of
  // any "Match: legalább N" filter — a row with no match cannot satisfy a threshold.
  ...Array.from({ length: 9 }, (_, i) => row(600 + i, { matchConfidence: null, material: 4 })),
  // Low-confidence matches: the reason the filter exists at all.
  ...Array.from({ length: 7 }, (_, i) => row(700 + i, { matchConfidence: 0.3 + i * 0.05, material: 4 })),
];

const render = (q: LeadQuery): string =>
  runWithConsoleLang(() => leadsPage(buildLeadListResult(FIXTURE, q), q));

/** Column label → data-col key, so a printed sentence can be resolved to a column. */
const LABEL_TO_KEY = new Map<string, LeadColumnKey>(
  (Object.keys(LEAD_COLUMNS) as LeadColumnKey[]).map((k) => [columnLabel(k, "hu"), k]),
);

// The default query, exactly as the server injects it.
const DEFAULT_Q: LeadQuery = {
  qualification: ["no_site", "outdated"],
  minMaterial: 1,
  defaulted: true,
};

const browser = await chromium.launch();
const page = await browser.newPage();

/** Load an HTML string into the real DOM. */
async function open(html: string): Promise<void> {
  await page.setContent(html, { waitUntil: "domcontentloaded" });
}

// ── A page that is actually DRESSED ──────────────────────────────────────────
// `setContent` resolves no relative URL, so every assertion above this line reads an
// UNSTYLED table. That is fine for "what does the sentence say" — and blind to "is the
// control the sentence belongs to even visible". The clipped MOCK funnel (Elek FK-003
// H3) lived exactly in that blind spot: the DOM was perfect, the pixels were not.
// So the layout assertions get a real server, the real stylesheets and a real viewport.
const ROOT = path.resolve(import.meta.dirname, "..");
const MIME: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".js": "text/javascript; charset=utf-8",
  ".woff2": "font/woff2",
};
let served = "<!doctype html><title>üres</title>";
const assetServer = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(served);
    return;
  }
  // Only under public/, and only a plain file — no traversal out of the tree.
  const rel = path.normalize(url.pathname).replace(/^([/\\])+/, "");
  const abs = path.join(ROOT, "public", rel);
  if (!abs.startsWith(path.join(ROOT, "public")) || !existsSync(abs) || !statSync(abs).isFile()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "content-type": MIME[path.extname(abs)] ?? "application/octet-stream" });
  res.end(readFileSync(abs));
});
assetServer.listen(0);
await once(assetServer, "listening");
const assetPort = (assetServer.address() as AddressInfo).port;

/** Load the rendered page WITH its stylesheets, at a real viewport width. */
async function openDressed(html: string, width: number): Promise<void> {
  served = html;
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`http://localhost:${assetPort}/`, { waitUntil: "load" });
}

// ── 1. Structure: a filter control lives in the header of the column it reads ──
await open(render(DEFAULT_Q));
for (const f of LEAD_FILTERS) {
  const inTh = await page.evaluate((param) => {
    const el = document.querySelector(`#leadFilters [name="${param}"]`);
    const th = el?.closest("th");
    return th ? (th.getAttribute("data-col") ?? "") : null;
  }, f.param);
  check(
    inTh === f.column,
    `szűrő-vezérlő „${f.param}” a(z) «${columnLabel(f.column, "hu")}» oszlop fejlécében (mért: ${inTh ?? "NINCS a lapon"})`,
  );
}

// ── 2. The fixture must actually exercise the failure shape ──────────────────
{
  const zeroPhotoRows = await page.$$eval('tbody td[data-col="photos"]', (tds) =>
    tds.filter((td) => td.getAttribute("data-v") === "0").length,
  );
  check(
    zeroPhotoRows > 0,
    `a fixture TÉNYLEG termel 0-fotós sort az alapszűrőben (${zeroPhotoRows} db) — enélkül az őr semmit nem mérne`,
  );
}

/**
 * A szűrő MONDATA (ADR-0188 után): a cím alatti összefoglaló sor megszűnt, a mondat az
 * ADOTT OSZLOP tölcsér-gombjára költözött `data-filter-summary` attribútumként. A kötés
 * (felirat ↔ predikátum) ugyanaz — csak ott van, ahol a szűrő dolgozik.
 *
 * ⛔ A visszaadott alak SZÁNDÉKOSAN a régi, „ · "-tal fűzött mondat: az alatta futó
 * szegmens-bontó és a piros önteszt így változatlanul azt méri, amit eddig.
 */
async function filterSummaryText(): Promise<string> {
  const parts = await page.$$eval("thead [data-filter-summary]", (els) =>
    els.map((e) => (e.getAttribute("data-filter-summary") ?? "").trim()).filter(Boolean),
  );
  return parts.join(" · ");
}

// ── 3. The sentence and the cells of the column it NAMES ─────────────────────
/**
 * Read `[data-filter-summary]` and verify each claim against the cells of the column
 * the claim names. This is the assertion the shipped bug would have failed.
 */
async function assertSummaryMatchesCells(label: string): Promise<void> {
  let summary = await filterSummaryText();
  if (SELF_TEST) {
    // RED CONTROL — reproduce the shipped drift: the sentence names FOTÓK while the
    // predicate (unchanged) still runs on ANYAG. Nothing else about the page moves.
    summary = summary.replace(
      `${columnLabel("material", "hu")}: legalább`,
      `${columnLabel("photos", "hu")}: legalább`,
    );
  }
  if (!summary) {
    check(false, `${label}: egyetlen fejléc-szűrő sem hordozza a saját mondatát, pedig szűrés van`);
    return;
  }
  const cells = await page.$$eval("tbody td[data-col]", (tds) =>
    tds.map((td) => ({ col: td.getAttribute("data-col") ?? "", v: td.getAttribute("data-v") ?? "" })),
  );
  if (!cells.length) {
    check(false, `${label}: nincs mérhető sor a lapon`);
    return;
  }

  for (const seg of summary.split("·").map((s) => s.trim()).filter(Boolean)) {
    const m = /^(.+?):\s*(.+)$/.exec(seg);
    if (!m) {
      check(false, `${label}: a „${seg}” állítás nem nevez meg oszlopot (alak: «Oszlop»: feltétel)`);
      continue;
    }
    const [, colName, cond] = m;
    const key = LABEL_TO_KEY.get(colName!.trim());
    if (!key) {
      check(false, `${label}: a „${colName}” nevű oszlop nem létezik a listában`);
      continue;
    }
    const colCells = cells.filter((c) => c.col === key);
    check(colCells.length > 0, `${label}: a megnevezett «${colName}» oszlop meg is jelenik a táblázatban`);

    const min = /legalább\s+(-?\d+(?:[.,]\d+)?)/.exec(cond!);
    if (min) {
      const n = Number(min[1]!.replace(",", "."));
      const violating = colCells.filter((c) => !(Number(c.v) >= n));
      check(
        violating.length === 0,
        `${label}: „${seg}” — a «${colName}» oszlop MINDEN cellája ≥ ${n} (sértő: ${violating.length}${
          violating.length ? `, pl. ${violating[0]!.v}` : ""
        })`,
      );
      continue;
    }
    // Categorical claim: "A vagy B" — every cell must be one of the named options.
    const wanted = cond!.split(" vagy ").map((s) => s.trim().replace(/^„|”$/g, ""));
    const codeOf = new Map<string, string>();
    for (const c of colCells) codeOf.set(c.v, c.v);
    const violating = colCells.filter((c) => !wanted.some((w) => optionMatches(key, c.v, w)));
    check(
      violating.length === 0,
      `${label}: „${seg}” — a «${colName}» oszlop minden cellája a felsorolt értékek egyike (sértő: ${violating.length}${
        violating.length ? `, pl. „${violating[0]!.v}”` : ""
      })`,
    );
  }
}

/** Does a raw cell value correspond to the option wording printed in the summary? */
function optionMatches(key: LeadColumnKey, raw: string, wording: string): boolean {
  const map: Record<string, Record<string, string>> = {
    qualification: { no_site: "nincs honlap", outdated: "elavult", modern: "modern", unknown: "ismeretlen" },
    contact: { email: "e-mail", sms: "SMS", voice: "telefon", none: "nincs" },
    mock: { none: "nincs" },
  };
  const printed = map[key]?.[raw] ?? raw;
  return printed.toLowerCase() === wording.toLowerCase();
}

await assertSummaryMatchesCells("alapértelmezett szűrő");

// A hand-set filter on the OTHER numeric column must be described just as truthfully.
await open(render({ minPhotos: 3 }));
await assertSummaryMatchesCells("kézi szűrő: Fotók ≥ 3");

await open(render({ qualification: ["no_site"] }));
await assertSummaryMatchesCells("kézi szűrő: Kvalifikáció");

// Match is a SCORE, not a count, and the column prints "–" where there is no portal
// hit — the one column where "does the promise hold for every cell" is not obvious.
await open(render({ minMatch: 0.8 }));
await assertSummaryMatchesCells("kézi szűrő: Match ≥ 0.8");
{
  // ⚠️ A „portál-találat nélküli" cella 2026-09-14 óta NEM „–", hanem szöveg („nincs
  // találat") — a jóváhagyott terv ⑥ pontja (`assets/design-refs/console/lead-list/`).
  // A tű a `data-v`-ből jön, nem a feliratból: a MATCH oszlop cella-értéke -1, ha nincs
  // találat (LEAD_COLUMNS.match), tehát a következő átfogalmazás sem üríti ki ezt a mérést.
  const dashes = await page.$$eval('tbody td[data-col="match"]', (tds) =>
    tds.filter((td) => Number(td.getAttribute("data-v")) < 0).length,
  );
  check(
    dashes === 0,
    `Match-szűrőnél a portál-találat nélküli sorok KIESNEK (maradt: ${dashes})`,
  );
  // …and they are genuinely there when nothing filters them out, or the assertion
  // above would be measuring an empty set. (ADR-0188 óta nincs lapozás, tehát a
  // fixture VÉGÉN ülő találat-nélküli sorok mindig kirenderelődnek — korábban ehhez
  // külön `pageSize: 0` kellett, különben egy lapozott nézet úgy „bizonyította” a
  // hiányukat, hogy soha nem ért el odáig.)
  await open(render({ all: true }));
  const dashesUnfiltered = await page.$$eval('tbody td[data-col="match"]', (tds) =>
    tds.filter((td) => Number(td.getAttribute("data-v")) < 0).length,
  );
  check(
    dashesUnfiltered > 0,
    `a fixture TÉNYLEG tartalmaz portál-találat NÉLKÜLI Match-sorokat (${dashesUnfiltered} db) — enélkül a fenti állítás üres halmazt mérne`,
  );
}

// ── 4. The printed counts describe the rendered page ─────────────────────────
{
  await open(render(DEFAULT_Q));
  const rendered = await page.$$eval("tbody tr", (trs) => trs.length);
  const counts = (await page.textContent("[data-lead-counts]"))?.replace(/\s+/g, " ").trim() ?? "";
  const expected = buildLeadListResult(FIXTURE, DEFAULT_Q);
  check(
    rendered === expected.rows.length,
    `a kirajzolt sorok száma = a lap ablaka (${rendered} vs ${expected.rows.length})`,
  );
  // ADR-0188: a öt tételes számláló-blokk EGY mondatra fogyott a tábla ALATT, és a
  // szűrt szám mellett a MEDENCE méretét is kimondja — enélkül a leszűkített lista a
  // teljes készletnek látszana.
  check(
    counts.includes(String(expected.counts.matching)),
    `a számláló-sor kiírja a találati halmaz méretét (${expected.counts.matching}) — „${counts}”`,
  );
  check(
    counts.includes(`${expected.counts.active} aktív lead`),
    `…és a medencét is, amiből szűrt (${expected.counts.active}) — „${counts}”`,
  );
  check(
    /nincs lapozás/.test(counts),
    `…és kimondja, hogy nincs lapozás — „${counts}”`,
  );
}

// ── 5. The view switch carries the operator's state ──────────────────────────
// "Szűrők törlése" → 593 rows, then "diszkvalifikáltak ▸" and back used to land on
// the default 260 with no word said. Measured on the real hrefs, both directions.
{
  const hrefOf = (sel: string) => page.getAttribute(sel, "href");
  await open(render({ all: true }));
  const toDisq = (await hrefOf('a:text-matches("diszkvalifikáltak")')) ?? "";
  check(
    toDisq.includes("disqualified=1") && toDisq.includes("all=1"),
    `kiürített szűrőből a diszkvalifikált nézetbe VISZI az „all=1” állapotot (${toDisq})`,
  );

  await open(render({ all: true, disqualified: "1" }));
  const back = (await hrefOf('a:text-matches("aktív leadek")')) ?? "";
  check(
    back.includes("all=1") && !back.includes("disqualified=1"),
    `a diszkvalifikált nézetből VISSZAHOZZA az „all=1” állapotot (${back})`,
  );

  await open(render({ contact: ["email"], minPhotos: 2 }));
  const carried = (await hrefOf('a:text-matches("diszkvalifikáltak")')) ?? "";
  check(
    carried.includes("contact=email") && carried.includes("minPhotos=2"),
    `kézi szűrők átmennek a nézetváltáson (${carried})`,
  );

  // The FORM must carry it too. Without this, setting a header filter from a cleared
  // list drops `all=1`, and clearing that filter again leaves an empty query — so the
  // default silently returns. Same loss as the toolbar case, through the other door.
  await open(render({ all: true }));
  const formAll = await page.$eval('#leadFilters input[name="all"]', (el) =>
    (el as HTMLInputElement).value,
  ).catch(() => null);
  check(formAll === "1", `a fejléc-szűrő ŰRLAPJA is viszi az „all=1” állapotot (mért: ${formAll ?? "NINCS mező"})`);

  // The injected default must NOT travel as if it were a hand-picked filter.
  await open(render(DEFAULT_Q));
  const defaultFormAll = await page.$('#leadFilters input[name="all"]');
  check(defaultFormAll === null, "alapértelmezett nézetben NINCS „all” mező az űrlapon (nem hazudja kézi szándéknak)");
  const fromDefault = (await hrefOf('a:text-matches("diszkvalifikáltak")')) ?? "";
  check(
    !fromDefault.includes("minMaterial") && !fromDefault.includes("qualification"),
    `az ALAPÉRTELMEZETT szűrő nem szivárog át a diszkvalifikált nézetbe (${fromDefault})`,
  );
}

// ── 6. Marks and column meanings are explained where they appear ─────────────
{
  await open(render(DEFAULT_Q));
  const legend = (await page.textContent(".con-legend__list"))?.replace(/\s+/g, " ") ?? "";
  for (const k of ["photos", "material", "match"] as LeadColumnKey[]) {
    check(legend.includes(columnLabel(k, "hu")), `a jelmagyarázat megnevezi a «${columnLabel(k, "hu")}» oszlopot`);
  }
  check(legend.includes("SV"), "a jelmagyarázat megmagyarázza az SV bélyeget");
  check(
    (await page.textContent('thead th[data-col="photos"]')) !== null &&
      (await page.getAttribute('thead th[data-col="photos"]', "title"))!.length > 10,
    "a FOTÓK fejléc tooltipje kimondja, mit számol",
  );
  const photosMeaning = await page.getAttribute('thead th[data-col="photos"]', "title");
  const materialMeaning = await page.getAttribute('thead th[data-col="material"]', "title");
  check(
    photosMeaning !== materialMeaning,
    "a két fotó-oszlop NEM ugyanazzal a mondattal van leírva (ez volt a kézikönyv hibája is)",
  );
}

// ── 7. NO DEVELOPER IDENTIFIER IN A HUMAN COLUMN ─────────────────────────────
// The shipped bug (Elek FK-003 H1): rows whose scrape area had no `region` record
// printed the raw key — `bs`, `_test`, `Balaton` — in a column otherwise full of place
// names, so three lines read as if those were places. A lookup that MISSES must say it
// missed; it must never hand the lookup KEY to the reader as if it were the answer.
//
// Measured against the fixture's own ids, so the assertion cannot be satisfied by a
// hard-coded word list: whatever raw area key a row carries, that string may not be
// what its cell prints.
{
  await open(render({ all: true }));
  const cells = await page.$$eval("tbody tr", (trs) =>
    trs.map((tr) => ({
      text: (tr.querySelector('td[data-col="region"]')?.textContent ?? "").replace(/\s+/g, " ").trim(),
      v: tr.querySelector('td[data-col="region"]')?.getAttribute("data-v") ?? "",
      name: (tr.querySelector('td[data-col="name"]')?.textContent ?? "").trim(),
    })),
  );
  check(cells.length > 0, `a «${columnLabel("region", "hu")}» oszlopnak van mérhető sora (${cells.length})`);

  // The keys that may NEVER appear as text. A raw key is excluded only when it is ALSO
  // the legitimate name of a registered area — which is not hypothetical: in the live
  // corpus an unregistered scrape definition carries the key `Balaton` while the
  // registered lake area is now NAMED "Balaton". Printing that word is therefore not
  // proof of a leak; the exact-count assertion below covers that row instead.
  const knownLabels = new Set(FIXTURE.filter((r) => r.regionKnown).map((r) => r.regionLabel));
  const rawIds = new Set(
    FIXTURE.filter((r) => !r.regionKnown).map((r) => r.region).filter((id) => !knownLabels.has(id)),
  );
  const unknownRows = FIXTURE.filter((r) => !r.regionKnown);
  check(
    unknownRows.length >= 3,
    `a fixture TÉNYLEG termel besorolatlan területű sort (${unknownRows.length} db) — enélkül az őr üres halmazt mérne`,
  );

  if (SELF_TEST) {
    // RED CONTROL — put the shipped bug back on the page and nothing else: the raw
    // area key printed as the cell's text, the way it shipped. The fixture's own row
    // order gives the keys, so the control cannot drift from the data.
    const keys = FIXTURE.filter((r) => !r.regionKnown).map((r) => r.region);
    await page.evaluate((ids) => {
      let i = 0;
      for (const td of document.querySelectorAll('tbody td[data-col="region"]')) {
        if ((td.textContent ?? "").includes("nincs besorolás")) td.textContent = ids[i++ % ids.length]!;
      }
    }, keys);
  }
  const after = await page.$$eval("tbody td[data-col='region']", (tds) =>
    tds.map((td) => (td.textContent ?? "").replace(/\s+/g, " ").trim()),
  );
  const leaked = after.filter((t) => rawIds.has(t));
  check(
    leaked.length === 0,
    `a «${columnLabel("region", "hu")}» oszlop EGYETLEN cellája sem nyers gyűjtési-azonosító (sértő: ${leaked.length}${
      leaked.length ? `, pl. „${leaked[0]}”` : ""
    })`,
  );

  // …and what it prints instead actually SAYS that there is no classification.
  const unclassified = after.filter((t) => t === unknownRegionLabel("hu"));
  check(
    unclassified.length === unknownRows.length,
    `minden besorolatlan sor a „${unknownRegionLabel("hu")}” állapotot írja ki (${unclassified.length}/${unknownRows.length})`,
  );

  // The registered areas still show their human name, and MORE THAN ONE of them —
  // a column whose every cell says the same word carries no information at all, which
  // is the other half of the live finding (529 of 595 rows said "Balaton északi part").
  const known = after.filter((t) => t !== unknownRegionLabel("hu"));
  const shapes = [...new Set(known)];
  check(
    shapes.length > 1,
    `a «${columnLabel("region", "hu")}» oszlop TÖBB értéket is meg tud különböztetni (mért alakok: ${shapes.join(" | ")})`,
  );

  // The HEADER must not promise the lead's own geography. The value is the scrape
  // area; the lead's place is the Ország/Város column, and the meaning says so.
  const meaning = columnMeaning("region", "hu");
  check(
    meaning.includes(columnLabel("city", "hu")) && meaning.includes(columnLabel("country", "hu")),
    `a «${columnLabel("region", "hu")}» oszlop jelentése ELKÜLDI a földrajzi kérdést a valóban azt hordozó oszlopokhoz („${meaning.slice(0, 60)}…”)`,
  );
}

/**
 * INDEPENDENT order reference — deliberately NOT the app's `compareSortKeys`.
 *
 * ⛔ Measured while writing this guard: with the monotonicity check calling the very
 * function it verifies, breaking the comparator kept the order assertions GREEN (the
 * check and the bug agreed with each other) and only the one hand-written accent
 * assertion went red. A checker that borrows the implementation under test measures
 * nothing. Same lesson as the template-diversity guard that was blind to its own input.
 */
const HU = new Intl.Collator("hu", { sensitivity: "base", numeric: true });
function refCompare(a: number | string, b: number | string): number {
  if (typeof a === "number" || typeof b === "number") {
    return Number(a) < Number(b) ? -1 : Number(a) > Number(b) ? 1 : 0;
  }
  return HU.compare(String(a), String(b));
}

// ── 8. Sorting orders by what the cell SHOWS, in Hungarian ───────────────────
// Two failure modes, both measured on the rendered page rather than on the data:
//   · sorting by a hidden value (Régió filters on the area id, shows the area NAME —
//     ordering by the id would be the same class of lie as a mislabelled filter);
//   · code-point order, which files every accent-initial value after "Z" (live
//     corpus: Ábrahámhegy / Óbudavár / Örvényes past Zánka, and four lead names).
for (const key of SORTABLE_COLUMNS) {
  for (const dir of ["asc", "desc"] as const) {
    await open(render({ all: true, sort: key, dir }));
    const shown = await page.$$eval(`tbody td[data-col="${key}"]`, (tds) =>
      tds.map((td) => ({
        text: (td.textContent ?? "").replace(/\s+/g, " ").trim(),
        v: td.getAttribute("data-v") ?? "",
      })),
    );
    check(shown.length > 1, `«${columnLabel(key, "hu")}» ${dir}: van mit rendezni (${shown.length} sor)`);
    const numeric = LEAD_COLUMNS[key].numeric === true;
    // For a numeric column the cell prints "–" for the empty value, so the RAW value
    // is the honest order key; for text columns the visible text IS the order key.
    const keys = shown.map((c) => (numeric ? Number(c.v) : c.text));
    const sign = dir === "asc" ? 1 : -1;
    const firstBreak = keys.findIndex((v, i) => i > 0 && sign * refCompare(keys[i - 1]!, v) > 0);
    check(
      firstBreak === -1,
      `«${columnLabel(key, "hu")}» ${dir}: a KIRAJZOLT sorrend monoton${
        firstBreak === -1 ? "" : ` — törés a(z) ${firstBreak}. sornál: „${keys[firstBreak - 1]}” után „${keys[firstBreak]}”`
      }`,
    );
  }
}

// Every sortable column must actually offer the link — a column that sorts by URL but
// has no clickable header is a feature only the guard knows about. And the link must
// LOOK sortable on an UNSORTED list: before this, the arrow appeared only on the
// already-sorted column, so nothing said the other nine headers were clickable, with
// `cursor:pointer` the sole hint — and a phone has no cursor (Elek, 2026-09-12).
await open(render(DEFAULT_Q));
{
  // An untouched list is NOT unordered: it arrives newest-survey-first. So exactly one
  // header carries a live direction (the default sort column) and every other carries
  // the "sortable" mark. Before this, all ten stood neutral while the page claimed an
  // order and no column showed a date to check it against (Elek FK-003 Z1).
  const eff = effectiveLeadSort(DEFAULT_Q);
  for (const key of SORTABLE_COLUMNS) {
    const href = await page
      .getAttribute(`thead th[data-col="${key}"] a.con-sorth`, "href")
      .catch(() => null);
    check(
      !!href && href.includes(`sort=${key}`),
      `«${columnLabel(key, "hu")}»: a fejléc-felirat rendező link (${href ?? "NINCS"})`,
    );
    const mark = (
      await page.textContent(`thead th[data-col="${key}"] a.con-sorth .con-sorth__m`).catch(() => null)
    )?.trim();
    const want = key === eff.key ? (eff.dir === "asc" ? "↑" : "↓") : "↕";
    check(
      mark === want,
      `«${columnLabel(key, "hu")}»: érintetlen lapon a helyes jelölés „${want}” (mért: „${mark ?? "NINCS"}”)`,
    );
  }
  const active = await page.getAttribute("thead th:has(.con-sorth.on)", "data-col").catch(() => null);
  check(
    active === eff.key,
    `érintetlen lapon a KIEMELT fejléc a tényleges alap-rendezés oszlopa (mért: ${active}, várt: ${eff.key})`,
  );
  // ⛔ A SORREND-MONDAT MEGSZŰNT (ADR-0188), az állítás NEM: a kiemelés magában kevés,
  // mert egy oszlop lehet kiemelve a NEVE nélkül is. Ezért a kiemelt fejléc FELIRATÁT
  // olvassuk vissza, és az a tényleges rendező oszlop neve kell legyen.
  const activeLabel = (await page.textContent("thead th:has(.con-sorth.on) .con-sorth"))
    ?.replace(/[↕↑↓]/g, "")
    .trim();
  check(
    activeLabel === columnLabel(eff.key, "hu"),
    `a kiemelt fejléc FELIRATA a tényleg rendező oszlopot nevezi meg (mért: „${activeLabel}”, várt: „${columnLabel(eff.key, "hu")}”)`,
  );
}
// …and on a sorted list exactly one header shows the live direction.
{
  await open(render({ all: true, sort: "city", dir: "asc" }));
  const live = await page.$$eval("thead .con-sorth__m", (els) =>
    els.map((e) => (e.textContent ?? "").trim()).filter((t) => t === "↑" || t === "↓"),
  );
  check(live.length === 1 && live[0] === "↑", `rendezett lapon PONTOSAN egy irány-nyíl (mért: ${JSON.stringify(live)})`);
  const activeCol = await page.getAttribute("thead th:has(.con-sorth.on)", "data-col");
  check(activeCol === "city", `a kiemelt fejléc a TÉNYLEG rendezett oszlop (mért: ${activeCol})`);
}

// ── 9. The counts line must not contradict the filter state ─────────────────
// "593 felel meg a szűrőnek" stood 25px under "nincs szűrő" — one page, two claims,
// opposite meanings. ADR-0188 után a szűrő ÁLLAPOTÁT nem mondat hordozza, hanem a
// fejléc jelvénye és a „Szűrők törlése" kiút léte — az ellentmondás lehetősége viszont
// megmaradt, ezért az állítás is.
for (const [label, q] of [
  ["szűretlen aktív lista", { all: true } as LeadQuery],
  ["szűretlen diszkvalifikált lista", { all: true, disqualified: "1" } as LeadQuery],
]) {
  await open(render(q as LeadQuery));
  const summary = await filterSummaryText();
  const clear = await page.$$eval("[data-clear-filters]", (els) => els.length);
  const counts = (await page.textContent("[data-lead-counts]"))?.replace(/\s+/g, " ") ?? "";
  check(
    summary === "" && clear === 0 && !/a \d+ aktív leadből|a \d+ diszkvalifikáltból/.test(counts),
    `${label}: szűrő nélkül SEM jelvény, SEM kiút, SEM „ebből szűrtem” állítás (mondat: „${summary}”, kiút: ${clear}, sor: „${counts}”)`,
  );
}
{
  // …és szűrővel MINDHÁROM ott van — különben a fenti ág egy olyan lapon is átmenne,
  // ami sosem mond semmit a szűrésről (ez a NEGATÍV KONTROLL párja).
  await open(render(DEFAULT_Q));
  const summary = await filterSummaryText();
  const clear = await page.$$eval("[data-clear-filters]", (els) => els.length);
  const counts = (await page.textContent("[data-lead-counts]"))?.replace(/\s+/g, " ") ?? "";
  check(
    summary !== "" && clear === 1 && /a \d+ aktív leadből/.test(counts),
    `szűrt lapon VISZONT ott a jelvény-mondat, a kiút és a medence-szám (mondat: „${summary}”, kiút: ${clear}, sor: „${counts}”)`,
  );
}

// ── 10. The list names the order it arrived in ───────────────────────────────
// An untouched list came back newest-first with nothing saying so. ADR-0188 után ezt
// NEM egy mondat mondja a cím alatt, hanem a rendező oszlop KIEMELT neve és a nyila —
// ezért itt azt mérjük, és mindkét esetben (érintetlen ÉS rendezett lapon).
{
  for (const [label, q, wantKey, wantArrow] of [
    ["érintetlen lap", { all: true } as LeadQuery, effectiveLeadSort({}).key, "↓"],
    ["rendezett lap", { all: true, sort: "material", dir: "desc" } as LeadQuery, "material", "↓"],
    ["rendezett lap (növekvő)", { all: true, sort: "material", dir: "asc" } as LeadQuery, "material", "↑"],
  ] as [string, LeadQuery, LeadColumnKey, string][]) {
    await open(render(q));
    const col = await page.getAttribute("thead th:has(.con-sorth.on)", "data-col").catch(() => null);
    const arrow = (await page.textContent("thead .con-sorth.on .con-sorth__m"))?.trim() ?? "";
    check(
      col === wantKey && arrow === wantArrow,
      `${label}: a kiemelt fejléc a rendező oszlop és a nyila az irányt mutatja ` +
        `(mért: ${col}/${arrow}, várt: ${wantKey}/${wantArrow})`,
    );
  }
}

// The accent case, stated as its own assertion so a regression names itself.
{
  await open(render({ all: true, sort: "city", dir: "asc" }));
  const cities = await page.$$eval('tbody td[data-col="city"]', (tds) =>
    tds.map((td) => (td.textContent ?? "").trim()),
  );
  const abra = cities.indexOf("Ábrahámhegy");
  const zanka = cities.indexOf("Zánka");
  check(
    abra >= 0 && zanka >= 0 && abra < zanka,
    `magyar ábécé: „Ábrahámhegy” a „Zánka” ELŐTT áll (mért: ${abra} < ${zanka})`,
  );
}

// ── 11. NOTHING IN THE TABLE IS CUT OFF BY ITS OWN SCROLL BOX ────────────────
// The shipped bug (Elek FK-003 H3): the table's smallest possible width was 1210px in
// a 1186px scroll container, so 24px of content sat BEHIND the visible edge — the MOCK
// column's filter funnel lost ~40% of itself and the `approved` pill had its right end
// sheared off. And it happened in the DEFAULT view, the one the operator lands on,
// because two active filter badges are squeezed into that header row.
//
// ⛔ Only a DRESSED page can see this: with `setContent` the stylesheets never load,
// every cell is 0-padding plain text, and the whole class is invisible. So this section
// runs against a real server, the real citui stylesheets and a real 1280px viewport.
// The default view is checked FIRST and separately, because "the view the operator
// enters" is exactly where the shipped defect lived.
{
  const VIEWS: [string, LeadQuery][] = [
    ["ALAPÉRTELMEZETT nézet", DEFAULT_Q],
    ["szűrő nélküli lista", { all: true }],
    ["rendezett lista", { all: true, sort: "city", dir: "asc" }],
    ["diszkvalifikáltak", { all: true, disqualified: "1" }],
  ];
  for (const [label, q] of VIEWS) {
    await openDressed(render(q), 1280);
    if (SELF_TEST) {
      // RED CONTROL — a levágás VALÓDI oka: a 11 oszlopos táblán a vízszintes hely a
      // legszűkösebb erőforrás, és a belső margó tolja.
      // ⛔ A KORÁBBI kontroll (`th { white-space: nowrap }`) ADR-0188 óta a MAI
      // ALAPÁLLAPOT, tehát nem rontott vissza semmit: némán zöldet adott volna, és az
      // őr „képes pirosra menni" állítása üres halmazon állt volna.
      await page.addStyleTag({
        content: ".con .con-leadtbl td, .con .con-leadtbl th { padding-left: 14px; padding-right: 14px; }",
      });
    }
    const m = await page.evaluate(() => {
      const wrap = document.querySelector(".tblwrap") as HTMLElement | null;
      if (!wrap) return null;
      // ⛔ `clientLeft` KELL: a `getBoundingClientRect().left` a SZEGÉLLYEL EGYÜTT mér, a
      // `clientWidth` viszont szegély nélkül. Amióta a lead-táblázat görgető-doboza 1 px
      // kerettel jön (ADR-0188), a kettő összege 1 px-szel a valódi látható él ELŐTT állt,
      // és az őr NÉGY nézetben jelentett „levágást" ott, ahol a túllógás mérve 0 px volt.
      const visibleRight = wrap.getBoundingClientRect().left + wrap.clientLeft + wrap.clientWidth;
      // Every cell AND every interactive control inside it: a cell can end inside the
      // box while the button it contains sticks out.
      const probes: { el: Element; what: string }[] = [];
      for (const th of wrap.querySelectorAll("thead th")) {
        const col = th.getAttribute("data-col") ?? "?";
        probes.push({ el: th, what: `«${col}» fejléc-cella` });
        for (const c of th.querySelectorAll("button, a")) probes.push({ el: c, what: `«${col}» fejléc-vezérlő` });
      }
      for (const td of wrap.querySelectorAll("tbody td")) {
        const col = td.getAttribute("data-col") ?? "?";
        probes.push({ el: td, what: `«${col}» cella` });
        for (const pill of td.querySelectorAll(".pill, a")) probes.push({ el: pill, what: `«${col}» jelölés` });
      }
      const cut: { what: string; by: number }[] = [];
      for (const p of probes) {
        const r = p.el.getBoundingClientRect();
        if (r.width > 0 && r.right > visibleRight + 0.5) {
          cut.push({ what: p.what, by: Math.round(r.right - visibleRight) });
        }
      }
      return {
        overflow: wrap.scrollWidth - wrap.clientWidth,
        cut: cut.slice(0, 4),
        cutCount: cut.length,
      };
    });
    check(m !== null, `${label}: a táblázat egyáltalán kirenderelődött`);
    if (!m) continue;
    check(
      m.cutCount === 0,
      `${label} @1280px: EGYETLEN oszlop-tartalom sincs levágva a görgető-doboz szélénél (sértő: ${m.cutCount}${
        m.cutCount ? `, pl. ${m.cut.map((c) => `${c.what} +${c.by}px`).join(", ")}` : ""
      })`,
    );
    // …and the same statement said on the container, so a regression names the cause.
    check(
      m.overflow <= 0,
      `${label} @1280px: a táblázat BEFÉR a saját görgető-dobozába (túllógás: ${m.overflow}px)`,
    );
  }

  // The guard must be able to SEE a cut — otherwise the five greens above could mean
  // "the measurement never fires". A deliberately over-wide column has to go red.
  {
    await openDressed(render(DEFAULT_Q), 1280);
    await page.addStyleTag({
      content: '.con .con-leadtbl td[data-col="contact"] { min-width: 420px; }',
    });
    const cut = await page.evaluate(() => {
      const wrap = document.querySelector(".tblwrap") as HTMLElement;
      const visibleRight = wrap.getBoundingClientRect().left + wrap.clientWidth;
      return [...wrap.querySelectorAll("thead th, tbody td")].filter(
        (el) => el.getBoundingClientRect().right > visibleRight + 0.5,
      ).length;
    });
    check(
      cut > 0,
      `a levágás-mérés TÉNYLEG kiszúrja a levágást, ha van (mesterségesen kiszélesített oszlop: ${cut} sértés)`,
    );
  }
}

assetServer.close();
await browser.close();

for (const o of oks) console.log(`  ✅ ${o}`);
for (const f of fails) console.log(`  ❌ ${f}`);

if (SELF_TEST) {
  if (fails.length) {
    console.log(
      `\n✅ ÖNTESZT (piros kontroll): a felirat-eltolódást, a nyers terület-azonosítót ÉS a\n` +
        `   levágott fejléc-vezérlőt is ELKAPTA az őr — ${fails.length} bukás.`,
    );
    process.exit(0);
  }
  console.error(
    "\n⛔ ÖNTESZT BUKOTT: a szándékosan visszarontott állapotok (felirat-eltolódás ·\n" +
      "   nyers terület-azonosító a cellában · nowrap-os fejléc → levágott MOCK-tölcsér)\n" +
      "   ZÖLDET kaptak — az őr ilyen állapotban NEM mér semmit.",
  );
  process.exit(1);
}

if (fails.length) {
  console.error(`\n⛔ lead-filter-label-check: ${fails.length} bukás / ${oks.length + fails.length} állítás.`);
  process.exit(1);
}
console.log(`\n✅ lead-filter-label-check: ${oks.length}/${oks.length} állítás — a szűrő felirata arra az oszlopra vonatkozik, amit tényleg olvas.`);
