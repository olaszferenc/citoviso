// Nemzetközi A (2026-11-22, ADR-0467) — the LEAD-COLLECTION regression: "every process can run
// country-specifically, and Hungarian behaviour stays byte/behaviour-identical".
//
//   ① HU IDENTITY — every collection function that moved its language-/country-bound words to
//      the country layer (scout grid + keywords, subdivision areas, OSM name tag, the ~11 trade-word
//      copies, portal exclusions, listing paths, phone keys / patterns / mobile test, freemail,
//      registrable domain, page-text patterns) is run on a FROZEN input set and compared with the
//      output the OLD code gave on it (scripts/fixtures/country-collect-hu.json.gz, captured from
//      the pre-change code: 740 pseudonymised dev-DB leads, the region table, synthetic pages).
//      Every vector must be identical; the only listed differences are the NEW non-HU answers.
//   ② HR POSITIVE — the same functions answer Croatian inputs the Croatian way (names, phones,
//      /kontakt, net.hr, ISO HR-17, name:hr, tile width at 43° N, generic portal reading).
//
//   npx tsx scripts/country-collect-regress.mts            (read-only: no DB write, no network)
//   npx tsx scripts/country-collect-regress.mts --full <inputs.json> <regions.json> <old.json>
//        (the one-off proof on the WHOLE dev-DB lead table, files kept outside the repo)
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { countryConfigSync, type CountryConfig } from "../src/country.js";
import * as rules from "../src/scout/rules.js";
import * as regionsMod from "../src/scraper/regions.js";
import { osmName } from "../src/scraper/sources/osm.js";
import { genericNameWords, placesTradeWords } from "../src/scraper/genericWords.js";
import * as pres from "../src/scraper/enrichPresence.js";
import * as ss from "../src/scraper/enrichSiteSearch.js";
import * as q from "../src/scraper/qualify.js";
import * as pl from "../src/scraper/sources/portalListing.js";
import * as ex from "../src/scraper/sources/portals/extract.js";
import * as pp from "../src/scraper/portalPhotos.js";
import * as cl from "../src/scraper/contactLedger.js";
import * as ews from "../src/scraper/enrichWebSearch.js";
import * as ec from "../src/scraper/enrichContact.js";
import * as apl from "../src/scraper/attachPhotoLinks.js";
import * as reg from "../src/scraper/sources/portals/registry.js";
import { lexList, lexString, wordSet } from "../src/countryLexicon.js";
import { normalizePhoneIn, phoneKeyIn, splitPhonesIn, isMobileRawIn, phoneTextRegexIn } from "../src/text/phoneCountry.js";
import { acceptLanguage } from "../src/scraper/sources/webSearchBrowser.js";
import { db } from "../src/db/client.js";

let fails = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}

type Lead = {
  id: string; name: string; city: string | null; website: string | null; phone: string | null; email: string | null;
  country: string | null; sources: string[]; contacts: any[]; assessmentEmails: string[];
  listings: { url: string; title: string | null }[];
  profiles: { url: string; title: string | null; description: string | null; amenities: string[]; phone: string | null }[];
};
type Fixture = { synthetic: any; regions: any[]; leads: Lead[]; expected: Record<string, unknown[]> };

const HU = "HU";
const HU_ROW = countryConfigSync(HU);
if (!HU_ROW) throw new Error("nincs HU ország-sor a DB-ben");

/** The NEW code, called exactly as the collection callers call it for a Hungarian lead / area. */
function computeHu(leads: Lead[], regions: any[], S: any): Record<string, unknown[]> {
  const region = regionsMod.DEFAULT_REGIONS["balaton-north"]!;
  const out: Record<string, unknown[]> = {};
  const put = (k: string, v: unknown): void => void (out[k] ??= []).push(v === undefined ? null : v);
  const kws = rules.scoutKeywords(HU);

  for (const r of regions) {
    const box = { south: r.bbox[0], west: r.bbox[1], north: r.bbox[2], east: r.bbox[3] };
    put("regionGrid", rules.regionGrid(box, r.circle));
  }
  put("SCOUT_KEYWORDS", [...kws]);
  const kwSamples = [{}, { "szállás": 3 }, Object.fromEntries(kws.map((k) => [k, 5])),
    Object.fromEntries(kws.map((k) => [k, 120])), { hotel: 120, kemping: null }];
  for (const kw of kwSamples) for (const n of [0, 3, 100, 150]) {
    const rows = Array.from({ length: Math.min(n, 3) }, (_, i) => ({ status: (i ? "new" : "known") as "new" | "known", name: i === 2 ? "" : "X", lat: 47, lon: 19 }));
    put("tileStateOf", rules.tileStateOf("work", kw as any, n, kws));
    put("canClose", rules.canClose({ state: "work", kw: kw as any, rows, keywords: kws }));
    put("closeHint", rules.closeHint({ state: "work", kw: kw as any, rows, keywords: kws }));
  }
  for (const id of [...regions.map((r) => r.id), "megye-xx", "megye-hu", "terulet-hr-17", "country-hr", "megye-TO"]) {
    put("osmAreaForRegion", regionsMod.osmAreaForRegion(id) ?? null);
  }
  const nameTag = lexString(HU, "osmNameTag") ?? undefined;
  for (const t of S.OSM_TAGS) put("osmName", osmName(t, nameTag) ?? null);
  put("GENERIC_NAME_WORD", [...genericNameWords(HU)]);
  put("PLACES_TRADE_WORD", [...placesTradeWords(HU)]);
  put("TYPE_WORDS", [...pres.typeWords(HU)]);

  const pairs: Array<[Lead, Lead["profiles"][number]]> = [];
  for (const l of leads) for (const p of l.profiles) pairs.push([l, p]);
  const huRegion = { country: HU };
  for (const l of leads) {
    const name = l.name;
    put("brandTokens", pl.brandTokens(name, HU));
    put("twinBrands", pl.twinBrands(name, l.city ?? undefined, HU));
    put("candidateHosts", pres.candidateHosts(name, HU));
    const uc = pres.urlCandidates(name, region, HU_ROW!.ownSiteTlds, HU);
    put("urlCandidates", uc.length + ":" + uc.slice(0, 6).join(","));
    const terms = pres.geoTerms({ city: l.city ?? undefined }, region);
    if (l.website) {
      put("domainCarriesBrand", ss.domainCarriesBrand(l.website, name, terms, HU));
      put("nameInHost", q.nameInHost(name, l.website));
    }
    put("isCorroboratedEmail", l.email ? ews.isCorroboratedEmail(l.email, { name, website: l.website ?? undefined }, HU) : null);
    put("leadPhoneKey", l.phone ? pl.phoneKey(l.phone, HU_ROW) : null);
    put("ledgerPhoneKey", l.phone ? cl.phoneKey(l.phone, HU_ROW) : null);
    put("isMobile", l.phone ? ec.isMobile(l.phone, HU_ROW) : null);
    put("resolveChannel", ec.resolveChannel(l.email ?? undefined, l.phone ?? undefined, HU_ROW));
    put("freemail", l.email ? cl.freemailRe(HU).test(l.email) : null);
    put("guestVisibleEmail", l.email ? cl.guestVisibleContact(l.contacts, "email", l.email, HU, HU_ROW) : null);
    put("guestVisiblePhone", l.phone ? cl.guestVisibleContact(l.contacts, "phone", l.phone, HU, HU_ROW) : null);
    put("mergeContacts", cl.mergeContacts(l.contacts, [
      ...(l.phone ? [{ kind: "phone" as const, value: l.phone, source: "t", accepted: true }] : []),
      ...(l.phone ? [{ kind: "phone" as const, value: "06" + l.phone.replace(/\D/g, "").slice(-9), source: "t2", accepted: true }] : []),
    ], "2026-01-01", HU_ROW).map((c) => `${c.kind}:${c.value}:${c.accepted}`));
    const lead = { name, email: l.email ?? undefined, phone: l.phone ?? undefined, website: l.website ?? undefined,
      assessment: { emails: l.assessmentEmails }, sources: l.sources, contacts: l.contacts, country: l.country ?? undefined };
    const [r] = ec.enrichContact([lead as any], huRegion);
    put("enrichContact", { email: r!.email ?? null, ch: r!.contactChannel, c: (r!.contacts ?? []).map((c: any) => `${c.kind}:${c.value}:${c.accepted}:${c.rejectedReason ?? ""}`) });
    for (const u of [l.website, ...l.listings.map((x) => x.url), ...l.profiles.map((x) => x.url)].filter((x): x is string => !!x)) {
      put("classifyWebsite", q.classifyWebsite(u));
      put("isCandidateHost", ss.isCandidateHost(u, HU));
      put("resolvePortal", reg.resolvePortal(u).id + ":" + reg.looksLikeListingUrl(u));
    }
    const page = [...l.profiles.map((p) => `${p.title ?? ""} ${p.description ?? ""}`), ...l.listings.map((x) => x.title ?? "")].join(" ") + " " + (l.city ?? "");
    put("verify", pres.verify(name, terms, page, HU));
    put("verifyNoGeo", pres.verify(name, ["zzzz"], page, HU));
    for (const p of l.profiles) {
      put("multiPropertyPage", pp.multiPropertyPage({ title: p.title ?? undefined, amenities: p.amenities }));
      if (p.description) put("domCapacity", ex.domCapacity(p.description) ?? null);
    }
  }
  for (const [l, p] of pairs) {
    const t = `${p.title ?? ""} ${p.description ?? ""}`;
    put("captionBelongsToOther", pl.captionBelongsToOther(p.title ?? undefined, l.name, [], HU));
    put("typeWordConflict", pl.typeWordConflict(l.name, p.title ?? undefined, HU));
    put("nameCoverage", pl.nameCoverage(l.name, t, [], HU));
    put("typoBrandTokens", pl.typoBrandTokens(l.name, pres.deaccent(t.toLowerCase()), HU));
  }
  for (let i = 0; i + 1 < leads.length; i += 7) {
    put("captionCross", pl.captionBelongsToOther(leads[i + 1]!.name, leads[i]!.name, [], HU));
    put("typeConflictCross", pl.typeWordConflict(leads[i]!.name, leads[i + 1]!.name, HU));
  }
  put("sharedHostCandidates", [...q.sharedHostCandidates(leads.map((l) => ({ name: l.name, website: l.website })))].sort());

  for (const h of S.HTML as string[]) {
    const text = ex.textOf(h);
    put("domPhone", ex.domPhone(h, text, HU_ROW) ?? null);
    put("ownContentOnly", ex.ownContentOnly(h).length);
    put("domDescription", ex.domDescription(h, "Dencs Apartmanház", HU) ?? null);
    put("domDescriptionNoHint", ex.domDescription(h, undefined, HU) ?? null);
    put("domAmenities", ex.domAmenities(h));
    put("domCapacity", ex.domCapacity(text) ?? null);
    put("extractContacts", ews.extractContacts(h, HU_ROW));
    put("extractListing", JSON.stringify(ex.extractListing(h, "https://example.hu/x", "Dencs Apartmanház", HU_ROW)));
  }
  for (const ph of [...S.PHONES_EXTRA, ...leads.filter((l) => l.phone).slice(0, 400).map((l) => l.phone!)]) {
    put("x.ledgerPhoneKey", cl.phoneKey(ph, HU_ROW));
    put("x.leadPhoneKey", pl.phoneKey(ph, HU_ROW) ?? null);
    put("x.isMobile", ec.isMobile(ph, HU_ROW));
    put("x.domPhoneText", ex.domPhone("", `Telefon: ${ph}`, HU_ROW) ?? null);
    put("x.extractContactsTel", ews.extractContacts(`<p>Tel.: ${ph}</p>`, HU_ROW).phones);
  }
  for (const e of S.EMAILS_EXTRA as string[]) put("x.freemail", cl.freemailRe(HU).test(e));
  for (const [a, b] of S.HOSTS_EXTRA as [string, string][]) put("x.site2", [apl.site2(a), apl.site2(b), apl.site2(a) === apl.site2(b)]);
  for (const u of S.URLS_EXTRA as string[]) {
    put("x.classifyWebsite", q.classifyWebsite(u));
    put("x.isCandidateHost", ss.isCandidateHost(u, HU));
    put("x.resolvePortal", reg.resolvePortal(u).id + ":" + reg.looksLikeListingUrl(u));
  }
  return out;
}

/**
 * The differences the change MEANS to make — each a non-Hungarian input that the old code read
 * the Hungarian way (or not at all). Keyed by function + the exact old → new values; anything else
 * that differs is a regression.
 */
const INTENDED: ReadonlyArray<{ fn: string; old: unknown; neu: unknown; why: string }> = [
  { fn: "osmAreaForRegion", old: null, neu: "HR", why: "country-hr: az országos terület ISO-határa (run.ts --country élesben)" },
  { fn: "osmAreaForRegion", old: null, neu: "HR-17", why: "terulet-hr-17: horvát megye (Splitsko-dalmatinska)" },
  { fn: "x.site2", old: ["com.hr", "com.hr", true], neu: ["apartmani.com.hr", "apartmani.com.hr", true], why: "com.hr második szintű public suffix" },
  { fn: "x.site2", old: ["com.hr", "com.hr", true], neu: ["a.com.hr", "b.com.hr", false], why: "két külön .com.hr oldal nem ugyanaz" },
  { fn: "x.site2", old: ["co.uk", "co.uk", true], neu: ["x.co.uk", "y.co.uk", false], why: "co.uk public suffix" },
  { fn: "x.site2", old: ["com.au", "com.au", true], neu: ["foo.com.au", "bar.com.au", false], why: "com.au public suffix" },
  { fn: "x.site2", old: ["webnode.hr", "webnode.hr", true], neu: ["a.webnode.hr", "b.webnode.hr", false], why: "a horvát Webnode is közös platform" },
  // The page-text patterns are every country's (the page is in the PORTAL's language): the
  // synthetic CROATIAN pages of the fixture now read the Croatian way.
  { fn: "domAmenities", old: [], neu: ["Klima", "Parking"], why: "horvát „Sadržaj” felszereltség-lista (szintetikus HR oldal)" },
  { fn: "ownContentOnly", old: 668, neu: 610, why: "horvát „Slični smještaji” blokk levágva (szintetikus HR oldal)" },
  { fn: "extractListing", old: '{"rooms":[],"amenities":[],"prices":[],"reviews":[],"images":[],"usedJsonLd":false,"usedDom":true}',
    neu: '{"rooms":[],"amenities":["Klima","Parking"],"prices":[],"reviews":[],"images":[],"usedJsonLd":false,"usedDom":true}', why: "ugyanaz a horvát lista az adatlapban" },
  { fn: "extractListing", old: '{"rooms":[],"amenities":[],"prices":[],"reviews":[],"images":[{"url":"https://x.hr/d.jpg"}],"usedJsonLd":false,"usedDom":true}',
    neu: '{"rooms":[],"amenities":[],"prices":[],"reviews":[],"images":[],"usedJsonLd":false,"usedDom":true}', why: "a horvát szomszéd-blokk képe nem a leadé" },
  { fn: "x.classifyWebsite", old: "has_own", neu: "portal_only", why: "x.hr/smjestaj/<bejegyzés>: horvát listázó-út" },
];
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

function compare(label: string, got: Record<string, unknown[]>, want: Record<string, unknown[]>): void {
  let vectors = 0;
  let identical = 0;
  const intended: string[] = [];
  const bad: string[] = [];
  for (const [fn, exp] of Object.entries(want)) {
    const g = got[fn] ?? [];
    if (g.length !== exp.length) bad.push(`${fn}: ${g.length} kimenet ≠ ${exp.length}`);
    for (let i = 0; i < exp.length; i++) {
      vectors++;
      if (same(g[i], exp[i])) {
        identical++;
        continue;
      }
      const ok = INTENDED.find((d) => d.fn === fn && same(d.old, exp[i]) && same(d.neu, g[i]));
      if (ok) intended.push(`${fn}[${i}]: ${ok.why}`);
      else if (bad.length < 25) bad.push(`${fn}[${i}]: régi ${JSON.stringify(exp[i]).slice(0, 160)} · új ${JSON.stringify(g[i]).slice(0, 160)}`);
      else bad.push("…");
    }
  }
  console.log(`  ${label}: ${vectors} vektor, ${identical} azonos, ${intended.length} szándékos eltérés (nem-HU bemenet), ${bad.length ? "HIBA" : "0 regresszió"}`);
  for (const x of intended) console.log(`      · ${x}`);
  check(`${label}: a magyar kimenet bájtra azonos a régi kódéval`, bad.length === 0, `\n      ${bad.slice(0, 25).join("\n      ")}`);
}

const args = process.argv.slice(2);
if (args[0] === "--full") {
  const [inF, regF, oldF] = args.slice(1) as [string, string, string];
  const fx = await import("node:fs").then((fs) => ({
    leads: JSON.parse(fs.readFileSync(inF, "utf8")), regions: JSON.parse(fs.readFileSync(regF, "utf8")), expected: JSON.parse(fs.readFileSync(oldF, "utf8")),
  }));
  const fixture = JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/country-collect-hu.json.gz", import.meta.url))).toString("utf8")) as Fixture;
  console.log("① HU-azonosság — a TELJES dev-DB lead-tábla (egyszeri bizonyítás)");
  compare("teljes DB", computeHu(fx.leads, fx.regions, fixture.synthetic), fx.expected);
} else {
  const fx = JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/country-collect-hu.json.gz", import.meta.url))).toString("utf8")) as Fixture;
  console.log("① HU-azonosság — rögzített bemenet, a régi kód kimenetéhez mérve");
  compare("fixtúra", computeHu(fx.leads, fx.regions, fx.synthetic), fx.expected);
}

// ── ② HR positive cases ─────────────────────────────────────────────────────────────────────
console.log("② HR — a horvát bemenetre horvát válasz");
// The shared dev DB has no HR row (migrations/0142_country_hr.sql seeds it; the dev copy holds
// HU only) — these are 0142's values (dial 385, trunk 0, mobile 9x, generic plan, NSN 8–9).
const HR_ROW: CountryConfig = {
  ...HU_ROW,
  iso2: "HR", name: "Horvátország", aliases: ["HRVATSKA", "CROATIA"], defaultLang: "hr", timeZone: "Europe/Zagreb",
  currency: "EUR", pricingRegion: "hr", areaBbox: [42.38, 13.48, 46.56, 19.45],
  searchKeywords: { accommodation: ["smještaj", "privatni smještaj", "apartmani", "sobe", "hotel", "pansion", "kuća za odmor", "kamp"] },
  portalDomains: ["apartmanija.hr", "direct-croatia.com", "adriagate.com", "adriatic.hr", "smjestaj.com.hr", "croatia.hr"],
  ownSiteTlds: ["hr", "com"], searchLang: "hr", searchRegion: "HR", browserLocale: "hr-HR", acceptLanguage: "hr,en;q=0.6",
  dialCode: "385", trunkPrefix: "0", mobilePrefixes: ["91", "92", "95", "97", "98", "99"], phonePlan: "generic",
  phoneNsnMin: 8, phoneNsnMax: 9,
};
const HR = "HR";
check("HR név: „Apartmani Ivana” márkaszava „ivana”", same(pl.brandTokens("Apartmani Ivana", HR), ["ivana"]), JSON.stringify(pl.brandTokens("Apartmani Ivana", HR)));
check("HR név: „Villa Marija – Makarska” (város nélkül) → „marija”", same(pl.twinBrands("Villa Marija – Makarska", "Makarska", HR), ["marija"]),
  JSON.stringify(pl.twinBrands("Villa Marija – Makarska", "Makarska", HR)));
check("HR típusszó-ütközés: Apartmani Ivana ≠ Kuća Ivana", pl.typeWordConflict("Apartmani Ivana", "Kuća za odmor Ivana", HR));
check("HR Places-név: „Apartments Ivana Makarska” ≈ „Apartmani Ivana”", (await import("../src/scraper/sources/googleMaps.js")).nameSimilarity("Apartmani Ivana", "Apartments Ivana Makarska", "Makarska", HR) === 1);
check("HR domain-tipp: apartmaniivana.hr a jelöltek közt",
  pres.urlCandidates("Apartmani Ivana", { id: "terulet-hr-17", label: "Splitsko-dalmatinska", country: HR, bbox: [43, 16, 44, 17] }, HR_ROW.ownSiteTlds, HR)
    .some((u) => u === "https://ivana.hr" || u === "https://apartmaniivana.hr"));
for (const [raw, want] of [["021 612 345", "+38521612345"], ["+385 (0)91 234 5678", "+385912345678"], ["098/765-432", "+38598765432"]] as const) {
  check(`HR szám: „${raw}” → ${want}`, normalizePhoneIn(raw, HR_ROW) === want, String(normalizePhoneIn(raw, HR_ROW)));
}
check("HR mobil: 098/765-432 mobil, 021 612 345 vezetékes", ec.isMobile("098/765-432", HR_ROW) && !ec.isMobile("021 612 345", HR_ROW));
check("HR csatorna: e-mail nélkül mobil → sms-képes jelölés", ec.resolveChannel(undefined, "091 234 5678", HR_ROW) === "sms");
check("HR kulcs: +385 21 612 345 ≡ 021 612 345 (napló + portál)",
  cl.phoneKey("+385 21 612 345", HR_ROW) === cl.phoneKey("021 612 345", HR_ROW) && pl.phoneKey("+385 21 612 345", HR_ROW) === pl.phoneKey("021 612 345", HR_ROW) && pl.phoneKey("021 612 345", HR_ROW) === "21612345");
check("HR napló: a két írásmód EGY sor", cl.mergeContacts([], [
  { kind: "phone", value: "+385 21 612 345", source: "a", accepted: true }, { kind: "phone", value: "021 612 345", source: "b", accepted: true }], "2026-01-01", HR_ROW).length === 1);
const hrPage = `<p>Kontakt: +385 (0)91 234 5678 ili 098/765-432, fiksni 021 612 345</p>`;
check("HR oldal-szöveg: a +385-ös szám megtalálva (extractContacts)", ews.extractContacts(hrPage, HR_ROW).phones.length === 1 && normalizePhoneIn(ews.extractContacts(hrPage, HR_ROW).phones[0]!, HR_ROW) === "+385912345678",
  JSON.stringify(ews.extractContacts(hrPage, HR_ROW).phones));
check("HR portál-DOM: domPhone a horvát mintával", normalizePhoneIn(ex.domPhone("", "Tel: 021 612 345", HR_ROW) ?? "", HR_ROW) === "+38521612345");
check("HR: a magyar minta horvát számot NEM talál (a régi hiba)", ex.domPhone("", "Tel: 021 612 345", HU_ROW) === undefined);
check("HR splitPhones: két szám egy mezőben", same(splitPhonesIn("021 612 345; 091 234 5678", HR_ROW), ["+38521612345", "+385912345678"]));
check("HR kulcs (phoneKeyIn): 00385… ≡ 0…", phoneKeyIn("00385 21 612 345", HR_ROW) === phoneKeyIn("021 612 345", HR_ROW));
check("HR mobil (isMobileRawIn): +385 91…", isMobileRawIn("+385 91 234 5678", HR_ROW));
check("ismeretlen ország: nemzeti szám nincs kitalálva", phoneTextRegexIn(null).exec("Tel 021 612 345") === null && phoneTextRegexIn(null).test("Tel +385 21 612 345"));
check("HR kapcsolat-út /kontakt, keresőszó „kontakt”", lexList(HR, "contactPaths").includes("/kontakt") && lexList(HR, "contactWords")[0] === "kontakt");
check("HR „hivatalos oldal” = „službena stranica”", lexString(HR, "officialSiteQuery") === "službena stranica");
check("HR freemail: net.hr, st.t-com.hr igen; ivana.hr nem", cl.freemailRe(HR).test("a@net.hr") && cl.freemailRe(HR).test("a@st.t-com.hr") && !cl.freemailRe(HR).test("info@ivana.hr"));
check("HR freemail a corroborációban: net.hr cím elfogadva", ews.isCorroboratedEmail("ivana@net.hr", { name: "Apartmani Ivana" }, HR));
check("HU freemail: a .hr postafiók NEM magyar freemail (a HU lista változatlan)", !cl.freemailRe(HU).test("a@net.hr"));
check("ISO HR-17 terület", regionsMod.osmAreaForRegion("terulet-hr-17") === "HR-17" && regionsMod.subdivisionRegionId("HR", "17") === "terulet-hr-17");
check("OSM név: name:hr a horvát területen", osmName({ "name:hr": "Vila Marija" }, lexString(HR, "osmNameTag") ?? undefined) === "Vila Marija");
check("OSM név: a HU területen a name:hr nem név", osmName({ "name:hr": "Vila Marija" }, lexString(HU, "osmNameTag") ?? undefined) === undefined);
const lonHr = rules.scoutTileLonDeg(43.3);
check(`csempe: Makarska 43,3° É → ${lonHr}° ≈ 11 km`, Math.abs(lonHr * 111.32 * Math.cos((43.3 * Math.PI) / 180) - 11.0) < 0.2);
if (countryConfigSync(HR)) {
  check("HR portál-kizárás: a HR sor portáljai nem saját-honlap jelöltek", !ss.isCandidateHost("https://www.adriagate.com/x", HR));
} else {
  // No HR row in this DB yet: the exclusion is the cross-border list only (no guessed host),
  // and the HR portals arrive with the row's portal_domains (nonOwnHosts reads them).
  check("HR portál-kizárás sor nélkül: csak a határokon átívelő lista (booking.com ki, semmi kitalált)",
    !ss.isCandidateHost("https://www.booking.com/x", HR) && ss.nonOwnHosts(HR).length === ss.nonOwnHosts("XQ").length);
  console.log("    (INFO) a dev-DB-ben nincs HR ország-sor — a HR portál-hostok a sor portal_domains mezőjéből jönnek, amint létrejön)");
}
check("HR listázó-út: /smjestaj/<bejegyzés> portál-bejegyzés", q.classifyWebsite("https://makarska.hr/smjestaj/vila-marija") === "portal_only");
check("HR lista-oldal cím: „Makarska: 120 smještaja”", pp.multiPropertyPage({ title: "Makarska: 120 smještaja" }) !== null);
check("HR kapacitás: „za 4 osobe … smještaj” → 4", ex.domCapacity("Apartman je pogodan za 4 osobe, smještaj uz more.")?.value === 4);
check("HR „hasonló szállások” blokk levágva", ex.ownContentOnly("<main>" + "w".repeat(600) + "<h2>Slični smještaji</h2>x</main>").length < 620);
check("HR böngésző-nyelv: hr;q=0.9,en;q=0.5 (nincs magyar alapérték)", acceptLanguage("hr") === "hr;q=0.9,en;q=0.5" && acceptLanguage("") === "en;q=0.9");
check("HR szótár: típusszó-lista horvát", wordSet(HR, "typeWords").has("apartmani") && !wordSet(HR, "typeWords").has("vendeghaz"));
check("registry: minden adapterben ország-mező", reg.PORTAL_ADAPTERS.every((a) => a.country === null || /^[A-Z]{2}$/.test(a.country)) && reg.GENERIC_PORTAL.country === null);
check("registry: HR portál → generikus olvasó", reg.resolvePortal("https://www.apartmanija.hr/apartmani/makarska/123").id === "generic_portal");

await db.destroy();
console.log(fails ? `\n⛔ country-collect-regress: ${fails} hiba` : "\n✅ country-collect-regress: HU azonos, HR rendben");
process.exit(fails ? 1 : 0);
