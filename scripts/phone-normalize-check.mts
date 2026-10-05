// Gate: one phone rule, server and client alike, and no phone fished out of a photo path.
//
//   npx tsx scripts/phone-normalize-check.mts [--self-test]
//
// The measured defect (2026-10-05, 11 live leads, brief phone-normalize-slash):
//   · "06/30 123 4567" was REFUSED by normalizePhone() — the slash was not a known
//     separator, so a perfectly good mobile was unusable for SMS/MMS/outreach;
//   · the web enricher's PHONE_RE matched INSIDE longer digit runs and stored photo ids
//     ("…/6590/659069/659069814/…" → "069/6590698"), upload folders
//     ("uploads/2023/06/37961736.jpg" → "06/37961736") and GPS coordinates
//     ("46.780604614546" → "0604614546") as lead phones;
//   · a portal's broken tel: link glued three numbers into one field
//     ("00368734269100363028317760036705331658").
//
// What it pins:
//   ① normalizePhone(): every vector below → its expected E.164 (or null)
//   ② splitPhones(): multi-number fields → every number, in order
//   ③ the CLIENT MIRROR (PHONE_NORM_JS, embedded by contactViews) gives the SAME answer
//      on every vector, and contactViews really embeds it
//   ④ extraction: enrichWebSearch.extractContacts() and the portal domPhone() find no
//      phone in the artifact pages, and still find the real one in plain text
//
// --self-test: the OLD unbounded pattern must find the artifacts in the same fixtures
// (otherwise ④ would be green on fixtures that never triggered the defect).

import { readFileSync } from "node:fs";
import { normalizePhone, splitPhones, PHONE_NORM_JS } from "../src/text/phone.js";
import { extractContacts } from "../src/scraper/enrichWebSearch.js";
import { domPhone } from "../src/scraper/sources/portals/extract.js";

const selfTest = process.argv.includes("--self-test");
const fails: string[] = [];
const check = (ok: boolean, what: string): void => {
  if (!ok) fails.push(what);
};

// ── ① normalizePhone ─────────────────────────────────────────────────────────
const VECTORS: readonly (readonly [string, string | null])[] = [
  // the slash, as people write it
  ["06/30 123 4567", "+36301234567"],
  ["06-70/622-5975", "+36706225975"],
  ["+36 30/955-2342", "+36309552342"],
  ["+36/88/204-104", "+3688204104"],
  ["+36 87 / 655-014", "+3687655014"],
  ["06/85-376-065", "+3685376065"],
  ["//+36 70 455 4833", "+36704554833"],
  // prefixes
  ["06 30 123 4567", "+36301234567"],
  ["+36301234567", "+36301234567"],
  ["36301234567", "+36301234567"],
  ["0036 85 562 045", "+3685562045"],
  ["003685-353-537", "+3685353537"],
  ["+36 1 234 5678", "+3612345678"],
  ["+36 21 262 0026", "+36212620026"],
  // international stays international
  ["+48 579 456 706", "+48579456706"],
  ["0049 171 1234567", "+491711234567"],
  // several numbers: the first MOBILE
  ["+36 83 348 924;+36 20 452 7652", "+36204527652"],
  ["+36 84 349 010; +36 84 349-020", "+3684349010"],
  ["+36 87 535 200 / +36 30 685 3148", "+36306853148"],
  ["Tel: 06 87 342-691, Mobil: +36 30 283-17-76", "+36302831776"],
  ["00368734269100363028317760036705331658", "+36302831776"],
  // Neo's raw values, 2026-10-05 — wrong length or no such prefix → refused
  ["06/129390641", null],
  ["069/1806970", null],
  ["068/1142068", null],
  ["060/9360608", null],
  ["06238591805", null],
  ["0604614546", null],
  ["06/38568629", null],
  ["0671948336", null],
  // shape-valid artifacts the normalizer CANNOT tell apart (caught at extraction, ④)
  ["06/37961736", "+3637961736"],
  ["06/37921541", "+3637921541"],
  // not a phone
  ["+3620766669", null],
  ["301234567", null],
  ["", null],
  ["hello", null],
];
for (const [raw, want] of VECTORS) {
  const got = normalizePhone(raw);
  check(got === want, `① normalizePhone(${JSON.stringify(raw)}) = ${got}, várt: ${want}`);
}

// ── ② splitPhones ────────────────────────────────────────────────────────────
const SPLITS: readonly (readonly [string, readonly string[]])[] = [
  ["00368734269100363028317760036705331658", ["+3687342691", "+36302831776", "+36705331658"]],
  ["+36 83 330 215;+36 20 435 0174;+48 579 456 706", ["+3683330215", "+36204350174", "+48579456706"]],
  ["06 30 123 4567", ["+36301234567"]],
  ["069/1806970", []],
  // a wrong-length run is NOT trimmed into a plausible number
  ["0036873426910036302831776003670533165", []],
];
for (const [raw, want] of SPLITS) {
  const got = splitPhones(raw);
  check(
    JSON.stringify(got) === JSON.stringify(want),
    `② splitPhones(${JSON.stringify(raw)}) = ${JSON.stringify(got)}, várt: ${JSON.stringify(want)}`,
  );
}

// ── ③ client mirror ──────────────────────────────────────────────────────────
const norm = new Function(`${PHONE_NORM_JS};return norm;`)() as (raw: string) => string | null;
for (const [raw] of VECTORS) {
  const server = normalizePhone(raw);
  const client = norm(raw);
  check(server === client, `③ kliens-tükör eltér: ${JSON.stringify(raw)} → szerver ${server}, kliens ${client}`);
}
const views = readFileSync(new URL("../src/server/contactViews.ts", import.meta.url), "utf8");
check(/PHONE_NORM_JS \+/.test(views), "③ contactViews nem ágyazza be a PHONE_NORM_JS-t");
check(!/function norm\(raw\)\{var c=/.test(views), "③ contactViews-ban saját norm() maradt");

// ── ④ extraction ─────────────────────────────────────────────────────────────
const ARTIFACT_PAGES: readonly (readonly [string, string])[] = [
  [
    "lake-balaton.com JSON-LD fotó-útvonal",
    `<script type="application/ld+json">{"@type":"ImageObject","contentUrl":"/data/Photos/OriginalPhoto/18069/1806970/1806970657/avas-photo-4.JPEG"}</script><p>Avas Apartman</p>`,
  ],
  [
    "balaton.hu upload-mappa",
    `<script type="application/ld+json">{"url":"https://balaton.hu/wp-content/uploads/2023/06/37961736.jpg"}</script><h1>Bonita</h1>`,
  ],
  [
    "booked.hu galéria-lista a szövegben",
    `<p>Room.JPEG:12939/1293906/1293906412/Pacsirta-Room.JPEG:11420/1142068/1142068549/x.JPEG</p>`,
  ],
  ["koordináta", `<p>Útvonal: 46.780604614546, 17.65791746627</p>`],
];
const OLD_RE = /(?:\+36|0036|06)[\s/().-]*\d{1,2}[\s/().-]*\d{3}[\s/().-]*\d{3,4}/;
for (const [label, html] of ARTIFACT_PAGES) {
  if (selfTest) {
    check(OLD_RE.test(html), `self-test: a régi minta NEM talál számot itt: ${label} — a fixtúra semmit nem bizonyít`);
    continue;
  }
  const { phones } = extractContacts(html);
  check(phones.length === 0, `④ enrichWebSearch számot „talált”: ${label} → ${JSON.stringify(phones)}`);
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ");
  const dom = domPhone(html, text);
  check(dom === undefined, `④ portál domPhone számot „talált”: ${label} → ${dom}`);
}
if (!selfTest) {
  const real = `<p>Telefon: 06/30 123 4567</p><p>Cím: 8261 Badacsony</p>`;
  check(
    extractContacts(real).phones.includes("06/30 123 4567"),
    `④ a valódi szám elveszett: ${JSON.stringify(extractContacts(real).phones)}`,
  );
  check(domPhone(real, "Telefon: 06/30 123 4567") === "06/30 123 4567", "④ portál domPhone a valódi számot nem találja");
  const glued = `<a href="tel:00368734269100363028317760036705331658">00 36 87 342 691</a>`;
  check(
    extractContacts(glued).phones.some((p) => splitPhones(p).length === 3),
    "④ az összefűzött tel: link nem bontható három számra",
  );
}

if (fails.length) {
  console.error(`phone-normalize-check: PIROS (${fails.length})`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(
  selfTest
    ? "phone-normalize-check --self-test: a régi minta minden fixtúrán talál — a fixtúrák élnek"
    : `phone-normalize-check: zöld (${VECTORS.length} vektor, ${SPLITS.length} bontás, kliens-tükör, ${ARTIFACT_PAGES.length} lelet-oldal)`,
);
