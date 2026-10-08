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
//   ⑤ a label inside a mailto: href ("mailto:email%3Aharmonia…@gmail.com", balatonalmadi.hu,
//      2026-10-08) never reaches the lead: both extractors keep only the address
//   ⑥ a TRUNCATED address never becomes the lead's e-mail (4 live leads, 2026-10-08):
//      · Brave's `<strong>` query mark split the name word off ("írj a hajas</strong>.bela@
//        gmail.com") → braveText() keeps the word whole, and a dot-led local part is no
//        business address;
//      · a broken OSM tag ("amiliapizzeria@familiapizzeria.hu") loses to the own site's full
//        form, and the stump stays in the ledger as rejected
//
// --self-test: the OLD unbounded pattern must find the artifacts in the same fixtures
// (otherwise ④ would be green on fixtures that never triggered the defect).

import { readFileSync } from "node:fs";
import { normalizePhone, splitPhones, PHONE_NORM_JS } from "../src/text/phone.js";
import { extractContacts, isBusinessEmail } from "../src/scraper/enrichWebSearch.js";
import { enrichContact } from "../src/scraper/enrichContact.js";
import { braveText } from "../src/scraper/sources/webSearch.js";
import { fullerEmail } from "../src/email/leadEmails.js";
import type { QualifiedLead } from "../src/scraper/types.js";
import { domEmail, domPhone } from "../src/scraper/sources/portals/extract.js";

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

if (!selfTest) {
  const labelled = `<p><a href="mailto:email%3Aharmonia.vendeghaz2020@gmail.com">email:harmonia.vendeghaz2020@gmail.com</a></p>`;
  const want = "harmonia.vendeghaz2020@gmail.com";
  const got = extractContacts(labelled).emails;
  check(
    got.length > 0 && got.every((e) => e === want),
    `⑤ enrichWebSearch címkés mailto: → ${JSON.stringify(got)}, várt: ["${want}"]`,
  );
  const dom = domEmail(labelled, "email:harmonia.vendeghaz2020@gmail.com");
  check(dom === want, `⑤ portál domEmail címkés mailto: → ${dom}, várt: ${want}`);
  const plain = `<a href="mailto:Info%40Pelda.hu">info</a>`;
  check(extractContacts(plain).emails.includes("info@pelda.hu"), "⑤ a kódolt @-os sima mailto: elveszett");
}

// ── ⑥ truncated addresses ────────────────────────────────────────────────────
// The real Brave descriptions (queried 2026-10-08 for the two affected leads).
const BRAVE_SNIPPETS: readonly (readonly [string, string])[] = [
  [
    "Amennyiben kérdésed lenne <strong>kiadó szobáinkkal vagy különálló apartmanunkkal kapcsolatban, kérlek töltsd ki az alábbi űrlapot, vagy írj a hajas</strong>.bela@gmail.com címre",
    "hajas.bela@gmail.com",
  ],
  ["E-mail: <strong>vasutas</strong>.segelyezo@gmail.com &amp; tel", "vasutas.segelyezo@gmail.com"],
];
const SNIPPET_EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
for (const [desc, want] of BRAVE_SNIPPETS) {
  if (selfTest) {
    const old = desc.match(SNIPPET_EMAIL_RE)?.[0];
    check(old !== undefined && old !== want, `self-test: a nyers Brave-kivonatból ép cím jön (${old}) — a fixtúra semmit nem bizonyít`);
    continue;
  }
  const got = braveText(desc).match(SNIPPET_EMAIL_RE)?.[0];
  check(got === want, `⑥ Brave-kivonat → ${got}, várt: ${want}`);
}
if (!selfTest) {
  for (const cut of [".bela@gmail.com", ".segelyezo@gmail.com", "hajas.@gmail.com", "a..b@gmail.com"]) {
    check(!isBusinessEmail(cut), `⑥ a csonka cím üzleti címnek számít: ${cut}`);
  }
  check(isBusinessEmail("hajas.bela@gmail.com"), "⑥ az ép pontos cím elveszett");
  const FULLER: readonly (readonly [string, string[], string | undefined, string])[] = [
    // the live stumps (2026-10-08) → their full form
    ["amiliapizzeria@familiapizzeria.hu", ["familiapizzeria@familiapizzeria.hu"], "https://www.familiapizzeria.hu/", "familiapizzeria@familiapizzeria.hu"],
    ["llaberekturistahaz@gmail.com", ["illaberekturistahaz@gmail.com"], "https://illaberekturistahaz.hu/", "illaberekturistahaz@gmail.com"],
    [".bela@gmail.com", ["hajas.bela@gmail.com"], "http://www.hajasfamilia.hu/", "hajas.bela@gmail.com"],
    // the live FALSE suffixes of the same day → untouched: junk or another real mailbox
    ["ligetapartments@gmail.com", ["nligetapartments@gmail.com"], "https://www.ligetapartments.hu/", "ligetapartments@gmail.com"],
    ["hello@royal27.hu", ["%20hello@royal27.hu"], undefined, "hello@royal27.hu"],
    ["atriumagard@gmail.com", ["atriumagard@gmail.com", "info.atriumagard@gmail.com"], "http://www.atriumagard.hu/", "atriumagard@gmail.com"],
    ["budapest@intercityhotel.com", ["reservations.budapest@intercityhotel.com"], "https://www.intercityhotel.com/", "budapest@intercityhotel.com"],
    ["etterem@ilkacsardapanzio.hu", ["etterem@ilkacsardapanzio.hu", "setterem@ilkacsardapanzio.hu"], "https://ilkacsarda.hu/", "etterem@ilkacsardapanzio.hu"],
    // another domain → untouched
    ["info@a.hu", ["szallas.info@b.hu"], "https://a.hu/", "info@a.hu"],
  ];
  for (const [stored, cands, site, want] of FULLER) {
    const got = fullerEmail(stored, cands, site);
    check(got === want, `⑥ fullerEmail(${stored}) → ${got}, várt: ${want}`);
  }
  const osmLead = {
    name: "Família Pizzéria Panzió",
    sources: ["osm"],
    website: "https://www.familiapizzeria.hu/",
    email: "amiliapizzeria@familiapizzeria.hu",
    assessment: { emails: ["familiapizzeria@familiapizzeria.hu"] },
  } as unknown as QualifiedLead;
  const [out] = enrichContact([osmLead]);
  check(out?.email === "familiapizzeria@familiapizzeria.hu", `⑥ OSM-csonk maradt a lead e-mailje: ${out?.email}`);
  const stump = out?.contacts?.find((c) => c.kind === "email" && c.value === "amiliapizzeria@familiapizzeria.hu");
  check(stump !== undefined && stump.accepted === false, "⑥ a csonk nincs elutasítva a kontaktnaplóban");
  const intact = enrichContact([{ ...osmLead, email: "info@familiapizzeria.hu" } as QualifiedLead])[0];
  check(intact?.email === "info@familiapizzeria.hu", `⑥ ép OSM-cím felülíródott: ${intact?.email}`);
}

if (fails.length) {
  console.error(`phone-normalize-check: PIROS (${fails.length})`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(
  selfTest
    ? "phone-normalize-check --self-test: a régi minta minden fixtúrán talál — a fixtúrák élnek"
    : `phone-normalize-check: zöld (${VECTORS.length} vektor, ${SPLITS.length} bontás, kliens-tükör, ${ARTIFACT_PAGES.length} lelet-oldal, címkés mailto:, csonka cím)`,
);
