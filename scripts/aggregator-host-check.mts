// GUARD: an aggregator / portal host is NEVER an "own modern website" (A1, 2026-10-02).
// Run: npx tsx scripts/aggregator-host-check.mts
//
// WHY: Google Places hands out a booking aggregator's link as the "website" of a
// lodging that has none. classifyWebsite() did not know those hosts, so on prod
// ~640 leads (bluepillow.com alone 361, freecancellations 43, vio 41,
// hotels-in-hungary.net 35 …) sat in the `modern` segment: the console showed
// them as "not a target", the outreach letter would have said "you have a modern
// site" — while they are exactly the businesses with NO site of their own.
// Elek's H-3 finding (muschel-panzio.hotels-in-hungary.net) was the first one seen.
//
// What it asserts:
//   1. every MEASURED aggregator URL (real prod values, one per host) classifies
//      as portal_only — never has_own;
//   2. negative controls: real own sites (incl. look-alikes such as
//      danubiushotels.com ⊃ "hotels.com", kolping.hotel.hu, webnode/wix sites)
//      stay has_own — the fix must not invert the credibility bug;
//   3. rules A+B (coordinator, 2026-10-02): file links are "none", short links are
//      decided by their target, and rule A only NAMES candidates — it never flips
//      a chain's own site (measured: ~25 of ~70 rule-A hosts were own sites);
//   4. ONE source of truth: no other src/ file carries a host list of its own
//      (≥3 of these hosts in one file = a second catalogue that will drift), and
//      every host the portal-adapter registry reads is classified as a portal by
//      qualify.ts (the registry deliberately does not re-answer that question).
//
// Mutation-verified (2026-10-02), each RED, restored → GREEN:
//   · qualify.ts reverted to the pre-A1 list → 48 aggregator fixtures reported has_own;
//   · a second host list dropped into src/scraper/ → "második portál-lista";
//   · "vio.com" loosened to the brand word "vio" → violavendeghaz.hu misfiled as portal.
//   · danubiushotels.com listed (rule A auto-applied to a chain) → 3 failures;
//   · drive.google.com dropped from the file-link hosts → "fájl-link nem „nincs saját oldal”";
//   · visty.site dropped from the catalogue → its measured fixture reported has_own.
// Round 2 (same day): marcali.hu listed host-wide instead of path-scoped → the mayor's
// office reported as a portal; honvedudulo.hu added to the catalogue → "ellentmondó
// mérés" + own-site control red.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  classifyWebsite,
  isShortLink,
  MEASURED_OWN_HOSTS,
  sharedHostCandidates,
} from "../src/scraper/qualify.js";
import { PORTAL_ADAPTERS } from "../src/scraper/sources/portals/registry.js";

const ROOT = new URL("..", import.meta.url).pathname;

// Real `website` values stored on prod leads (read-only measurement, 2026-10-02).
const AGGREGATOR_URLS: readonly string[] = [
  "https://www.bluepillow.com/search/59437e337c00cb0e6430033e/107122802?dest=bkng&cat=House&lat=46.755&lng=17.35188&language=en",
  "https://www.freecancellations.com/search/F21xEQMHHXYFCFcDWFUAElANXR1gTVJL?lat=46.7015&lng=17.38808&language=en",
  "https://deals.vio.com/?sig=73aca13c7f952d2641c156f3e69125e1&turl=https%3A%2F%2Fwww.vio.com%2FHotel%2FSearch",
  "https://muschel-panzio.hotels-in-hungary.net/hu/",
  "https://www.vrbo.com/pdp/lo/112107167?MDPCID=VRBO-META.HPA.WEB-ORGANIC.VR",
  "https://www.holidu.com/d/54350648?ref_source=google_vr&utm_source=google_vr_eb",
  "https://www.hometogo.de/search/5460aea2cf47c?id=b6f13a304a874335@f@s",
  "https://www.e-domizil.de/search/5460aea2cf47c?id=09a3350c166403a35388f1adf4b3d3b5@f@s",
  "https://www.fewo-direkt.de/ferienwohnung-ferienhaus/p753696",
  "https://buchung.fewobird.de/expose/23772354",
  "https://www.ferienhausmiete.de/112886.htm",
  "https://www.traum-ferienwohnungen.de/490759/",
  "https://www.kleinanzeigen.de/s-anzeige/urlaub-in-ungarn-naehe-plattensee/2551610065-233-5681",
  "https://www.balaton24.de/angebot-626.shtml",
  "https://perla-balaton-csopak.hotel-mix.de/",
  "https://new.rentalsunited.com/Property/3217845?sc=554691",
  "https://www.bookhungaryhotels.com/hu/hotel/orchidea-premium-apartment.html",
  "https://hotelmania.net/hotel/veszprem/boroka-apartman-belvaros/",
  "https://hotelsmart.hu/szallas/keszthely/napsugar-vendeghaz/246180",
  "https://checkinstay.eu/guest-house-moritz-keszthely",
  "https://availabilitycheck.eu/szente-vendeghaz-keszthely",
  "https://travellone.eu/limo-apartman-fonyod/",
  "https://house4u-balatonszemes.ibooked.at/",
  "https://www.happycamp.com/hu/szerkezet/balatontourist-fured-camping-andamp-bungalows",
  "https://stays.dogfriendlyretreats.com/hotel/balatongyorok/andre--moni",
  "https://incitytravel.eu/borostyan-vendeghaz-balatonkeresztur/",
  "https://pelsowellnesshotel.bedsandhotels.com/",
  "https://kertes.worhot.com/",
  "https://aptbalatinusapartmanhazsiofok.hu-hotels.com/hu/",
  "https://sziklavendeghaz.okhotel.top/",
  "https://kenesebaygarden.com-resort.com/hu/",
  "http://bellvarosi-panzio-siofok.com.es/",
  "http://z-nka-v-zparti-d-l-h-zak.org.es/",
  "https://www.szallasinfo.hu/tarr_apartmanok_keszthely",
  "https://www.nyaralo24.hu/balatonbereny/",
  "https://kiadonyaralok.hu/gyuszi-nyaralo-fonyod/",
  "https://360szallasok.hu/szallasok/teniszhaz-foldszinti-terasszal/",
  "https://www.balatonszallasok.hu/nanica-vendeghaz-buzsak/",
  "https://balatonlelleiszallasok.hu/balatonlelle-apartman-meiszter/",
  "https://www.balcsi-apartman.hu/luca-apartman-keszthely/",
  "https://foglalas.appartman.hu/beachfront-haven",
  "https://balaton.info/keszthely",
  "https://keszthely.hu/szallas/apartman/eva-apartman/",
  "https://orvenyes.hu/turizmus/szallashelyek/",
  "https://www.kerteszetturul.eu/profile-18393-gardener-s-cottage-farm",
  "https://www.ceginformacio.hu/cr9317293996",
  "https://www.197.eu/ceg/forras-panzio-14046",
  // Measured under the coordinator's rules A+B (2026-10-02).
  "https://siofokszallas.info/",
  "https://visty.site/wandavend",
  "https://www.balatonhost.com/golden-relax/",
  // Round 2 — municipal / tourism-body lodging lists (rule B).
  "https://vonyarcvashegy.hu/laszlo-apartmanhaz",
  "https://www.marcali.hu/index.php/elet-a-varosban/turizmus-m/szallashelyek",
  "http://zenefalu.hu/facebook_pages/szallasok.html",
  "https://www.balatonakali.hu/Turizmus/Szallashelyek/Myrna-haza",
  // Pre-existing catalogue entries — they must keep working too.
  "https://www.booking.com/hotel/hu/example.html",
  "https://kali.hu/szallas/egyed/",
  "https://www.zimmerinfo.hu/orvenyes/papplak/hu.htm",
];

// Own sites — must stay has_own (incl. the look-alikes the label matcher must not catch).
const OWN_SITE_URLS: readonly string[] = [
  "https://www.danubiushotels.com/",
  "https://piroshotel.hu/",
  "https://kolping.hotel.hu/",
  "https://kaliresort.hotelizator.com/",
  "https://www.balatontourist.hu/hu/balatoni-kempingek-szallashelyek/fured",
  "http://csonakos-haz.webnode.hu/",
  "https://emiapartmankeszthely.wixsite.com/emiapartmankeszthely",
  "https://holidayhotel.hu/",
  "http://www.violavendeghaz.hu/",
  "https://www.annaapartmankeszthely.hu/",
  "https://balatonszemes.otphotel.hu/",
  // Measured OWN under rules A+B (2026-10-02).
  "https://marcaliszallas.hu/",
  "https://aracsafarm.humtour.com/",
  "https://sites.google.com/view/jutasi-apartman/f%C5%91oldal",
  // Round 2: the town's OWN pages beside its lodging list, and chains' own units.
  "https://www.marcali.hu/index.php/hivatal-m/elerhetosegek",
  "https://www.balatonakali.hu/Turizmus/Strand",
  "https://honvedudulo.hu/szallas/hotel-aranyhid/",
  "https://www.hunguesthotels.hu/hu/hotel/heviz/hunguest_hotel_panorama/",
  "http://www.siofokpanzio.hu/",
];

const failures: string[] = [];

for (const url of AGGREGATOR_URLS) {
  const st = classifyWebsite(url);
  if (st === "has_own") failures.push(`aggregátor „saját honlapnak” sorolva: ${url}`);
}
for (const url of OWN_SITE_URLS) {
  const st = classifyWebsite(url);
  if (st !== "has_own") failures.push(`valódi saját oldal portálnak sorolva (${st}): ${url}`);
}

// A file link is not a website at all: "none", not has_own (and not a portal).
for (const url of [
  "https://drive.google.com/file/d/1_5fpNy5bBC71Yp6FlahK2H0JTZ2gWIih/view?usp=drivesdk",
  "https://docs.google.com/document/d/x/edit",
]) {
  const st = classifyWebsite(url);
  if (st !== "none") failures.push(`fájl-link nem „nincs saját oldal” (${st}): ${url}`);
}

// Short links are decided by their redirect TARGET, which only a fetching caller knows.
if (!isShortLink("https://tinyurl.com/3fzd2tet")) failures.push("a tinyurl.com nem rövid link a qualify.ts szerint");
if (isShortLink("https://piroshotel.hu/")) failures.push("saját oldal rövid linknek sorolva");

// Rule A names CANDIDATES only — a chain's own site must never be auto-flipped.
const stock = [
  ...["Fehér", "Kék", "Zöld"].map((c) => ({ name: `Abbázia Club Hotel ${c}`, website: "https://abbazia-clubhotel.hu/" })),
  { name: "Ensana Thermal Aqua", website: "https://www.danubiushotels.com/" },
  { name: "All Inclusive Hotel Marina", website: "https://www.danubiushotels.com/" },
  { name: "Hotel Aranyfény", website: "https://example-chain.hu/" },
  { name: "Hotel Ezüstpart", website: "https://example-chain.hu/" },
  { name: "Sissi Panzió", website: "https://example-farm.site/sissipanzi" },
  { name: "Rozmaring Apartman", website: "https://example-farm.site/rozmarinapar" },
];
stock.push(
  { name: "Family", website: "http://example-family.hu/" },
  { name: "Hotel Family", website: "http://example-family.hu/" },
);
const cand = sharedHostCandidates(stock);
if (cand.has("example-family.hu")) failures.push("A-szabály: két csak-általános nevű rekord két különböző szállásnak számít");
if (cand.has("abbazia-clubhotel.hu")) failures.push("A-szabály: a név a hostban van (Abbázia), mégis jelölt");
if (!cand.has("example-farm.site")) failures.push("A-szabály: 2 különböző szállás egy idegen hoston, mégsem jelölt");
if (!cand.has("example-chain.hu")) failures.push("A-szabály: a még nem mért lánc-host nem jelölt (a mérés szerint annak kell lennie)");
if (cand.has("danubiushotels.com")) failures.push("A-szabály: a mért saját host (danubiushotels.com) újra jelölt");

// Measured-own hosts stay has_own, and no host is measured both ways.
for (const h of MEASURED_OWN_HOSTS) {
  if (classifyWebsite(`https://${h}/`) !== "has_own")
    failures.push(`mért SAJÁT host a katalógus szerint portál (ellentmondó mérés): ${h}`);
}
if (classifyWebsite("https://www.danubiushotels.com/") !== "has_own")
  failures.push("A-szabály automatikusan döntött: a lánc saját oldala nem has_own");

// The registry's hosts must be portals in qualify.ts too — two lists, one verdict.
for (const a of PORTAL_ADAPTERS) {
  for (const h of a.hosts) {
    const url = `https://${h.replace(/^\*\./, "property.")}/listing`;
    if (classifyWebsite(url) === "has_own") {
      failures.push(`a portál-regiszter olvassa (${a.id}), de a qualify.ts saját oldalnak veszi: ${h}`);
    }
  }
}

// Single source: a second host catalogue anywhere in src/ is a drift waiting to happen.
// Hosts the adapter registry READS are named there by design (checked above), so
// they do not count as a second classification list.
const adapterHosts = new Set(PORTAL_ADAPTERS.flatMap((a) => a.hosts.map((h) => h.replace(/^\*\./, ""))));
const aggregatorHosts = [
  ...new Set(
    AGGREGATOR_URLS.map((u) => new URL(u).hostname.replace(/^www\./, "").split(".").slice(-2).join(".")),
  ),
].filter((h) => !adapterHosts.has(h));
function walk(dir: string, out: string[]): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|mts|js|mjs)$/.test(name)) out.push(p);
  }
  return out;
}
for (const file of walk(join(ROOT, "src"), [])) {
  const rel = relative(ROOT, file);
  if (rel === "src/scraper/qualify.ts") continue;
  const text = readFileSync(file, "utf8");
  const hits = aggregatorHosts.filter((h) => text.includes(`"${h}"`) || text.includes(`'${h}'`));
  if (hits.length >= 3) {
    failures.push(
      `második portál-lista: ${rel} (${hits.slice(0, 5).join(", ")}…) — a besorolás egyetlen forrása a qualify.ts`,
    );
  }
}

if (failures.length) {
  console.error(`❌ aggregator-host-check: ${failures.length} hiba`);
  for (const f of failures) console.error(`  · ${f}`);
  process.exit(1);
}
console.log(
  `✅ aggregator-host-check: ${AGGREGATOR_URLS.length} aggregátor/portál-URL → portal_only · ` +
    `${OWN_SITE_URLS.length} saját oldal → has_own · regiszter ⊂ qualify.ts · nincs második lista`,
);
