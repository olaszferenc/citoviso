// Regression guard for the GEO-ANCHOR of website verification (2026-08-20).
//
// WHY THIS EXISTS: on 2026-08-20 a Keszthely backfill wrote 6 discovered
// websites, 4 of them wrong — and every in-pipeline guard (brand+region
// verify(), portal catalogue, shallow-path rule, corroboration) went GREEN on
// them. The error was caught only by a human spot-check afterwards, and had to
// be rolled back from the live DB. The root cause was that verify() anchored on
// the REGION LABEL, which a radius region shares across many towns.
//
// The cases below are the real ones from that incident plus the false negative
// that started it. They are pinned as fixtures so the anchor can never silently
// regress to region-level matching again. Offline and deterministic: no network,
// no API key, no DB.
//
// Run: npx tsx scripts/geo-verify-check.mts

import { geoTerms, searchPlace, verify } from "../src/scraper/enrichPresence.js";
import { domainCarriesBrand } from "../src/scraper/enrichSiteSearch.js";
import { brandTokens, nameCoverage } from "../src/scraper/sources/portalListing.js";
import type { Region } from "../src/scraper/types.js";

/** The radius region every case below belongs to — one label, many towns. */
const KESZTHELY: Region = {
  id: "keszthely-es-kornyeke",
  label: "Keszthely és környéke",
  country: "HU",
  bbox: [46.6, 17.1, 46.9, 17.4],
};

interface Case {
  readonly label: string;
  readonly name: string;
  /** The lead's own town (ADR-0040 facet). */
  readonly city?: string;
  /** Representative text of the page the search returned. */
  readonly page: string;
  /** Must verify() accept this page as the lead's own site? */
  readonly expect: boolean;
  readonly why: string;
}

const CASES: Case[] = [
  {
    label: "Tekergő → tekergobalaton.hu",
    name: "Tekergő",
    city: "Balatonberény",
    page: "<h1>Tekergő Kerékpáros Pihenő- és Sátorozóhely</h1><p>Balatonberény, Halász utca</p>",
    expect: true,
    why: "the real site; it never writes 'Keszthely', so region-anchoring rejected it (false negative)",
  },
  {
    label: "Sport Üdülő → Hotel Ovit Keszthely listing",
    name: "Sport Üdülő",
    city: "Révfülöp",
    page: "<h1>Hotel Ovit Keszthely</h1><p>Keszthely, sport és wellness üdülő a Balatonnál</p>",
    expect: false,
    why: "a Keszthely business bound to a Révfülöp lead (false positive, rolled back)",
  },
  {
    label: "Piroska Ház → Piroska Apartman Keszthely",
    name: "Piroska Ház",
    city: "Badacsonytomaj",
    page: "<h1>Piroska Apartman</h1><p>Keszthely belvárosában, a Balaton partján</p>",
    expect: false,
    why: "same brand word, different town (false positive, rolled back)",
  },
  {
    label: "Szieszta Apartmanház → Silatti Panzió Keszthely",
    name: "Szieszta Apartmanház",
    city: "Balatonboglár",
    page: "<h1>Silatti Panzió Keszthely</h1><p>szieszta és pihenés Keszthelyen</p>",
    expect: false,
    why: "different company entirely (false positive, rolled back)",
  },
  {
    label: "Boglárka Apartman → Apartman Boglárka Gyenesdiás",
    name: "Boglárka Apartman",
    city: "Balatonboglár",
    page: "<h1>Apartman Boglárka</h1><p>Gyenesdiás, csendes utcában</p>",
    expect: false,
    why: "same brand, neighbouring town (false positive, rolled back)",
  },
  {
    label: "Tulipán kemping → tulipancamping.hu",
    name: "Tulipán kemping",
    city: "Gyenesdiás",
    page: "<h1>Tulipán Camping</h1><p>Gyenesdiás, Balaton</p>",
    expect: true,
    why: "a CORRECT hit from the same backfill — the fix must not break it",
  },
  {
    label: "no city known → region fallback still works",
    name: "Hóvirág Panzió",
    page: "<h1>Hóvirág Panzió</h1><p>Keszthely, Fő tér</p>",
    expect: true,
    why: "without a city facet the region label is the only anchor left",
  },
];

let failed = 0;
console.log("GEO-ANCHOR regression check — verify() must anchor on the lead's CITY\n");

for (const c of CASES) {
  const lead = { city: c.city };
  const terms = geoTerms(lead, KESZTHELY);
  const got = verify(c.name, terms, c.page);
  const ok = got === c.expect;
  if (!ok) failed++;
  console.log(
    `${ok ? "✓" : "✗ FAIL"}  ${c.label}\n` +
      `     horgony: [${terms.join(", ")}] · query-hely: "${searchPlace(lead, KESZTHELY)}"\n` +
      `     várt: ${c.expect} · kapott: ${got} — ${c.why}\n`,
  );
}

// The union bug this check was written against: if geoTerms ever returns the
// region terms ALONGSIDE the city, every false positive above passes again.
const unioned = geoTerms({ city: "Révfülöp" }, KESZTHELY);
if (unioned.includes("keszthely")) {
  failed++;
  console.log(
    "✗ FAIL  geoTerms UNIONED the region label into a lead that has its own city —\n" +
      "        this is exactly what let the 4 rolled-back false positives through.\n",
  );
}

// ── BRAND-IN-DOMAIN (2026-08-20, második hullám) ────────────────────────────
// Fixing the geo anchor removed the false negatives but OPENED the false
// positive gate: a town portal or a themed site carries the lead's own town by
// construction, so the city anchor confirms it. The next backfill dry-run
// produced 40 "own sites", including a GP-surgery page for "Ajka Város
// üdülője" and a church-ruin page for "Sarvalyi vadászház". The structural
// answer is that an OWN site is NAMED after the business. These fixtures are
// the real hits from that dry-run, classified by hand.
const BRAND_CASES: {
  name: string;
  url: string;
  geo: string[];
  expect: boolean;
  why: string;
}[] = [
  { name: "Stefi vendégház", url: "https://stefivendeghaz.hu/", geo: ["kisapati"], expect: true, why: "valódi saját oldal, márka a domainben" },
  { name: "Ágnes almái présház", url: "https://agnesalmai.hu/", geo: ["koveskal"], expect: true, why: "valódi saját oldal" },
  { name: "Kapri Vendeghaz Guesthaus", url: "https://kapri.hu/", geo: ["heviz"], expect: true, why: "rövid márka-domain" },
  { name: "Bötös Villa", url: "http://botosvillaheviz.hupont.hu/", geo: ["heviz"], expect: true, why: "site-builder aldomain, de a márka benne van" },
  { name: "Cser Vendégház", url: "https://cservendeghaz.freewb.hu/", geo: ["kisapati"], expect: true, why: "site-builder aldomain" },
  { name: "Tulipán kemping", url: "https://tulipancamping.hu/en/", geo: ["gyenesdias"], expect: true, why: "a visszavont körből a HELYES találat" },
  { name: "Ajka Város üdülője", url: "https://balatonszepezd.hu/haziorvos-es-ugyelet/", geo: ["balatonszepezd"], expect: false, why: "háziorvosi ügyelet a város portálján" },
  { name: "Sarvalyi vadászház", url: "https://kozepkoritemplom.hu/sumeg-sarvalyi-templomrom/", geo: ["sumeg"], expect: false, why: "templomrom-ismertető" },
  { name: "Átrium - Malom Panzió", url: "https://megyerikerekpar.hu/atrium-malom-panzio", geo: ["nemesvita"], expect: false, why: "kerékpáros tematikus oldal" },
  { name: "Mária Hotel", url: "https://www.balatonmariafurdo.hu/hotelek-panziok/", geo: ["balatonmariafurdo"], expect: false, why: "a névben TELEPÜLÉS van (Mária ⊂ Balatonmáriafürdő) — nem márka" },
  { name: "Balatonederics újhegyi vendégház", url: "https://balatonederics.hu/vendeglatas-gyujtooldal/", geo: ["balatonederics"], expect: false, why: "a lead neve maga a településnév" },
  { name: "Melanie Appartman", url: "http://melindavilla.weebly.com/unsere-appartman", geo: ["keszthely"], expect: false, why: "Melinda ≠ Melanie" },
  { name: "Hajni Vendégház", url: "https://kiadovendeghaz.hu/hajni-vendeghaz-kisapati/", geo: ["kisapati"], expect: false, why: "portál — a 'vendeghaz' köznév nem korroborál" },
  { name: "Takács Panzió", url: "https://www.gyenesdias.info.hu/takacs-haz/", geo: ["gyenesdias"], expect: false, why: "város-portál adatlap" },
  { name: "Lila és Limetta apartmanok", url: "http://apartmentheviz.com/hu/", geo: ["heviz"], expect: false, why: "általános + földrajzi domain, semmi márka" },
  { name: "Révfülöp Panoráma Kúria", url: "https://funiq.hu/160-kovagoors", geo: ["kovagoors"], expect: false, why: "látnivaló-katalógus" },
];

for (const c of BRAND_CASES) {
  const got = domainCarriesBrand(c.url, c.name, c.geo);
  const ok = got === c.expect;
  if (!ok) failed++;
  console.log(
    `${ok ? "✓" : "✗ FAIL"}  [márka-domain] ${c.name} → ${c.url}\n` +
      `     várt: ${c.expect ? "MEGTART" : "ELDOB"} · kapott: ${got ? "MEGTART" : "ELDOB"} — ${c.why}\n`,
  );
}

// ── Hyphenated short-part brand names (2026-10-27) ───────────────────────────────
// The portal link-attach answered 422 "a lead neve csupa általános szó" for
// "Abi-Lo Vendégház" (9a5834c9, Nagypeterd) and "Li-di Apartman" (77207ad0, Kalocsa):
// tokens() split at the dash and every part fell under the 4-letter brand floor.
// The compound is ONE brand word, found on the page with a dash, a space or as one
// word — but not across a word boundary inside other text.
const COMPOUND_CASES: { name: string; text: string; geo: string[]; expect: boolean; why: string }[] = [
  { name: "Abi-Lo Vendégház", text: "<h1>Abi-Lo Vendégház</h1><p>7980 Nagypeterd, Szőlőhegy 343</p>", geo: ["nagypeterd"], expect: true, why: "kötőjellel, ahogy a lead" },
  { name: "Abi-Lo Vendégház", text: "<h1>AbiLo vendégház</h1><p>Nagypeterd</p>", geo: ["nagypeterd"], expect: true, why: "egybeírva" },
  { name: "Li-di Apartman", text: "<h1>Li Di Apartman</h1><p>6300 Kalocsa, Kossuth Lajos u. 12</p>", geo: ["kalocsa"], expect: true, why: "szóközzel" },
  { name: "Li-di Apartman", text: "<h1>Kalocsai apartman</h1><p>Kalocsa, falidísz a szobában</p>", geo: ["kalocsa"], expect: false, why: "„falidísz” nem a „Li-di”" },
  { name: "Abi-Lo Vendégház", text: "<h1>Vendégház</h1><p>Nagypeterd</p>", geo: ["nagypeterd"], expect: false, why: "márka nélkül csak a köznév" },
  // Same 422, two more leads (2026-10-27): KI-AD-LAK 71a7b957 (Bóly), Ide-odu Apartman d573b0af (Baja).
  { name: "KI-AD-LAK", text: "<h1>Ki-Ad-Lak vendégház</h1><p>7754 Bóly</p>", geo: ["boly"], expect: true, why: "három rövid tag, kötőjellel" },
  { name: "KI-AD-LAK", text: "<h1>Kiadó lakás</h1><p>Bóly, ki ad lakást?</p>", geo: ["boly"], expect: false, why: "„kiadó lakás” nem a „KI-AD-LAK”" },
  { name: "Ide-odu Apartman", text: "<h1>Ide-Odú Apartman</h1><p>6500 Baja</p>", geo: ["baja"], expect: true, why: "ékezettel a lapon" },
  { name: "Ide-odu Apartman", text: "<h1>IdeOdu apartman</h1><p>Baja</p>", geo: ["baja"], expect: true, why: "egybeírva" },
  // Letter+digit token (2026-10-27): A16 Panzió d29e5e74 (Harkány) — "a16" is 3 characters.
  { name: "A16 Panzió", text: "<h1>A16 Panzió</h1><p>7815 Harkány, Bajcsy-Zs. u. 16.</p>", geo: ["harkany"], expect: true, why: "betű+szám token, egész szóként" },
  { name: "A16 Panzió", text: "<h1>KA160 Panzió</h1><p>Harkány</p>", geo: ["harkany"], expect: false, why: "„ka160” belsejében nem a név" },
  // Capitalised acronym (2026-10-27): BBB Apartman c9d21708 (Balatonboglár) — "bbb" is 3 letters.
  { name: "BBB Apartman", text: "<h1>BBB Apartman I. és II.</h1><p>8630 Balatonboglár, Balaton u. 2.</p>", geo: ["balatonboglar"], expect: true, why: "nagybetűs rövidítés, egész szóként" },
  { name: "BBB Apartman", text: "<h1>Abbba Apartman</h1><p>Balatonboglár</p>", geo: ["balatonboglar"], expect: false, why: "„abbba” belsejében nem a név" },
  { name: "KJB Vendégház ***", text: "<title>KJB Vendégház - Hajdúszoboszló</title>", geo: ["hajduszoboszlo"], expect: true, why: "rövidítés + csillag" },
];
for (const c of COMPOUND_CASES) {
  const brand = brandTokens(c.name);
  const got = brand.length > 0 && verify(c.name, c.geo, c.text) && nameCoverage(c.name, c.text) === 1;
  const ok = brand.length > 0 && got === c.expect;
  if (!ok) failed++;
  console.log(
    `${ok ? "✓" : "✗ FAIL"}  [kötőjeles márka] ${c.name} · márkaszó: ${JSON.stringify(brand)}\n` +
      `     várt: ${c.expect ? "EGYEZIK" : "NEM EGYEZIK"} · kapott: ${got ? "EGYEZIK" : "NEM EGYEZIK"} — ${c.why}\n`,
  );
}
// Not brands: an ordinal ("11-es"), roman unit numbers, a feature word (Wi-Fi).
// …and a number with a unit or a motorway is no letter+digit brand.
for (const n of ["Apartman Vendégház", "B-B Apartman", "11-es és 12-es számú kisház", "TópART Apartman I-II-III.", "Holiday home with Wi-Fi", "Vendégház Balatontól 6km-re 4fő", "M0 Motel", "VIP Apartman", "LUX Apartman", "MÁV szállás", "Apartman II", "BB Panzió"]) {
  const expectEmpty = ["Apartman Vendégház", "B-B Apartman", "VIP Apartman", "LUX Apartman", "MÁV szállás", "Apartman II", "BB Panzió"].includes(n);
  const brand = brandTokens(n);
  const ok = expectEmpty ? brand.length === 0 : !brand.some((t) => t.includes("-") || t === "wifi" || /\d/.test(t));
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗ FAIL"}  [kötőjeles márka] ${n} → nem márkaszó a kötőjeles/jellemző szó (${JSON.stringify(brand)})\n`);
}

if (failed) {
  console.error(
    `⛔ ${failed} eset megbukott — a geo-horgony vagy a márka-korroboráció visszaesett.`,
  );
  process.exit(1);
}
console.log(
  `✅ ${CASES.length} geo-eset + ${BRAND_CASES.length} márka-domain eset + ${COMPOUND_CASES.length + 12} kötőjeles/betű+szám/rövidítés márka eset rendben.`,
);
