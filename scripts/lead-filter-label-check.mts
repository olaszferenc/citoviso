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

import { chromium } from "playwright-core";

import { buildLeadListResult, type LeadListRow, type LeadQuery } from "../src/console/data.js";
import { runWithConsoleLang } from "../src/console/i18nCtx.js";
import {
  columnLabel,

  LEAD_COLUMNS,
  LEAD_FILTERS,
  SORTABLE_COLUMNS,
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
    regionLabel: "Balaton északi part",
    regionKnown: true,
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
  // Unknown scrape area → the region column must mark it, not pass the id off as a name.
  // Its LABEL also sorts before every real area name, which is what proves that the
  // Régió sort follows the displayed label and not the hidden area id (`bs-2` would
  // sort between the two Balaton ids, its label does not).
  row(500, {
    region: "bs-2",
    regionLabel: "_ismeretlen terület",
    regionKnown: false,
    material: 3,
    city: "Ábrahámhegy",
  }),
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

// ── 3. The sentence and the cells of the column it NAMES ─────────────────────
/**
 * Read `[data-filter-summary]` and verify each claim against the cells of the column
 * the claim names. This is the assertion the shipped bug would have failed.
 */
async function assertSummaryMatchesCells(label: string): Promise<void> {
  let summary = (await page.textContent("[data-filter-summary]"))?.trim() ?? "";
  if (SELF_TEST) {
    // RED CONTROL — reproduce the shipped drift: the sentence names FOTÓK while the
    // predicate (unchanged) still runs on ANYAG. Nothing else about the page moves.
    summary = summary.replace(
      `${columnLabel("material", "hu")}: legalább`,
      `${columnLabel("photos", "hu")}: legalább`,
    );
  }
  if (!summary || summary === "nincs szűrő") {
    check(false, `${label}: a szűrő-összefoglaló üres, pedig szűrés van`);
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
  const dashes = await page.$$eval('tbody td[data-col="match"]', (tds) =>
    tds.filter((td) => (td.textContent ?? "").includes("–")).length,
  );
  check(
    dashes === 0,
    `Match-szűrőnél a portál-találat nélküli („–”) sorok KIESNEK (maradt: ${dashes})`,
  );
  // …and they are genuinely there when nothing filters them out, or the assertion
  // above would be measuring an empty set. `pageSize: 0` on purpose: the no-match
  // rows sit at the end of the fixture, so a paged render would "prove" their
  // absence by never reaching them.
  await open(render({ all: true, pageSize: 0 }));
  const dashesUnfiltered = await page.$$eval('tbody td[data-col="match"]', (tds) =>
    tds.filter((td) => (td.textContent ?? "").includes("–")).length,
  );
  check(
    dashesUnfiltered > 0,
    `a fixture TÉNYLEG tartalmaz „–” Match-sorokat (${dashesUnfiltered} db) — enélkül a fenti állítás üres halmazt mérne`,
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
  check(
    counts.includes(`${expected.counts.matching} felel meg a szűrőnek`),
    `a fejléc kiírja a találati halmaz méretét (${expected.counts.matching})`,
  );
  check(
    counts.includes(`${expected.counts.active} aktív lead`),
    `a fejléc kiírja a szűretlen aktív állományt (${expected.counts.active})`,
  );
  check(
    counts.includes(`${expected.counts.disqualified} diszkvalifikált`),
    `a fejléc kiírja a diszkvalifikáltak számát (${expected.counts.disqualified})`,
  );
  check(
    counts.includes(`${expected.counts.all} felmért szereplő összesen`),
    `a fejléc kiírja a teljes állományt (${expected.counts.all})`,
  );
  const window = `1–${expected.rows.length} / ${expected.counts.matching} sor megjelenítve`;
  check(
    expected.counts.matching <= expected.rows.length || counts.includes(window),
    `részhalmaznál ki van írva, mennyi látszik („${window}”)`,
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
  const legend = (await page.textContent(".con-legend"))?.replace(/\s+/g, " ") ?? "";
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

// ── 7. Region column shows one shape ─────────────────────────────────────────
{
  await open(render({ all: true }));
  const regions = await page.$$eval("tbody td[data-col='region']", (tds) =>
    tds.map((td) => (td.textContent ?? "").replace(/\s+/g, " ").trim()),
  );
  const unknownMarked = regions.filter((t) => t.includes("_ismeretlen terület"));
  check(
    unknownMarked.every((t) => t.includes("?")),
    "ismeretlen gyűjtési terület MEG VAN JELÖLVE, nem helynévként megy át",
  );
  const known = regions.filter((t) => !t.includes("?"));
  check(
    known.every((t) => t === "Balaton északi part"),
    `a RÉGIÓ oszlop egyetlen alakot mutat (mért alakok: ${[...new Set(known)].join(" | ")})`,
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
    await open(render({ all: true, pageSize: 0, sort: key, dir }));
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
  check(
    mark === "↕",
    `«${columnLabel(key, "hu")}»: RENDEZETLEN lapon is látszik a rendezhetőség-jelölés (mért: „${mark ?? "NINCS"}”)`,
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

// ── 9. The counts line must not contradict the filter line ───────────────────
// "593 felel meg a szűrőnek" stood 25px under "nincs szűrő" — one page, two claims,
// opposite meanings.
for (const [label, q] of [
  ["szűretlen aktív lista", { all: true } as LeadQuery],
  ["szűretlen diszkvalifikált lista", { all: true, disqualified: "1" } as LeadQuery],
]) {
  await open(render(q as LeadQuery));
  const filterText = (await page.textContent("[data-filter-summary]"))?.trim() ?? "";
  const counts = (await page.textContent("[data-lead-counts]"))?.replace(/\s+/g, " ") ?? "";
  check(
    filterText === "nincs szűrő" && !counts.includes("felel meg a szűrőnek"),
    `${label}: „nincs szűrő” mellett NEM állítja, hogy bármi „megfelel a szűrőnek” (szűrő: „${filterText}”)`,
  );
}
{
  // …and with a filter running, the segment IS there — otherwise the check above
  // would pass on a page that simply never prints the match count.
  await open(render(DEFAULT_Q));
  const counts = (await page.textContent("[data-lead-counts]"))?.replace(/\s+/g, " ") ?? "";
  check(
    counts.includes("felel meg a szűrőnek"),
    "szűrt lapon VISZONT ott a találat-szám („felel meg a szűrőnek”)",
  );
}

// ── 10. The list names the order it arrived in ───────────────────────────────
// An untouched list came back newest-first with nothing saying so.
{
  await open(render({ all: true }));
  const s = (await page.textContent("[data-sort-summary]"))?.trim() ?? "";
  check(s.length > 0 && !s.includes("undefined"), `rendezetlen lapon is meg van nevezve a sorrend („${s}”)`);
  await open(render({ all: true, sort: "material", dir: "desc" }));
  const s2 = (await page.textContent("[data-sort-summary]"))?.trim() ?? "";
  check(
    s2.includes(columnLabel("material", "hu")) && s2.includes("csökkenő"),
    `rendezett lapon az OSZLOPOT és az IRÁNYT is megnevezi („${s2}”)`,
  );
}

// The accent case, stated as its own assertion so a regression names itself.
{
  await open(render({ all: true, pageSize: 0, sort: "city", dir: "asc" }));
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

await browser.close();

for (const o of oks) console.log(`  ✅ ${o}`);
for (const f of fails) console.log(`  ❌ ${f}`);

if (SELF_TEST) {
  if (fails.length) {
    console.log(`\n✅ ÖNTESZT (piros kontroll): a felirat-eltolódást az őr ELKAPTA — ${fails.length} bukás.`);
    process.exit(0);
  }
  console.error(
    "\n⛔ ÖNTESZT BUKOTT: a szándékosan elrontott felirat (Fotók ≥ 1, miközben az Anyagon szűr)\n" +
      "   ZÖLDET kapott — az őr ilyen állapotban NEM mér semmit.",
  );
  process.exit(1);
}

if (fails.length) {
  console.error(`\n⛔ lead-filter-label-check: ${fails.length} bukás / ${oks.length + fails.length} állítás.`);
  process.exit(1);
}
console.log(`\n✅ lead-filter-label-check: ${oks.length}/${oks.length} állítás — a szűrő felirata arra az oszlopra vonatkozik, amit tényleg olvas.`);
