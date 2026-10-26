// Regression guard for PORTAL PHOTO ATTRIBUTION (2026-08-21).
//
// WHY THIS EXISTS: wiring portal photos into the renderer immediately put junk on the
// page, because a listing page carries far more <img> tags than the property's gallery.
// On the first real harvest (607 images, Balaton north shore) two of eight leads would
// have rendered a MISATTRIBUTED hero — a village church for a campsite, a generic
// countryside banner for a guesthouse. That is a §B.17 breach: the mock tells the owner
// "this is your place" while showing the village church.
//
// Every case below is a REAL url+size from that harvest, including the ones that must
// be KEPT: the thresholds were calibrated against them, not guessed. The widest genuine
// photo (a guesthouse with its pool, 980×360) sits just inside the banner rule, so a
// tighter cutoff would silently start costing real photos.
//
// Offline and deterministic: dimensions are given, nothing is fetched.
//   npx tsx scripts/photo-quality-check.mts

import {
  dimensionsFromHeader,
  dimensionsFromUrl,
  isSiteBuilderMedia,
  judgePhoto,
} from "../src/scraper/sources/portals/photoQuality.js";
import { readFileSync } from "node:fs";
import { isCutSrcsetUrl, parseSrcset } from "../src/scraper/srcset.js";
import { ownSiteImages, photoCountMessage, twinSkipReason } from "../src/scraper/attachPhotoLinks.js";
import { distinctPortalPhotos, withoutNeighbourFolders } from "../src/scraper/portalPhotos.js";
import { ENGINE_HOME_REDIRECT } from "../src/scraper/sources/portalListing.js";
import { domImages, extractListing } from "../src/scraper/sources/portals/extract.js";

let failed = 0;
function check(label: string, ok: boolean, detail: string): void {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗ FAIL"}  ${label}\n     ${detail}\n`);
}

interface Case {
  readonly label: string;
  readonly url: string;
  readonly width?: number;
  readonly height?: number;
  /** Must this image be attributed to the property and rendered? */
  readonly keep: boolean;
  readonly why: string;
}

const CASES: Case[] = [
  // ── must be KEPT: real property photography ────────────────────────────────
  {
    label: "Aranykagyló 36 — portál OriginalPhoto",
    url: "https://aranykagylo-36.lake-balaton.com/data/Photos/OriginalPhoto/6415/641578/641578860/aranykagylo-36-szigliget-photo-2.JPEG",
    width: 1280,
    height: 853,
    keep: true,
    why: "a szállás saját galériája a portálon",
  },
  {
    label: "Lavia panzió — a LEGSZÉLESEBB valódi fotó",
    url: "https://www.szallaskereso.com/public/uploads/5000/2/h/180684609.jpg",
    width: 980,
    height: 360,
    keep: true,
    why: "épület medencével, 2,72:1 — a szalag-szabály küszöbét EZ kalibrálja",
  },
  {
    label: "Szigliget település-honlap — a szállás saját képei",
    url: "https://szigliget.hu/portal/images/stories/szallas/siposaranykagylo/main/IMG_4256.JPG",
    width: 1600,
    height: 1200,
    keep: true,
    why: "a /stories/szallas/<szállásnév>/ útvonal a szállásé, nem a falué",
  },
  // ── must be DROPPED: misattribution ────────────────────────────────────────
  {
    label: "Köveskáli Diákkemping — falusi templom cikkből",
    url: "https://www.ittjartam.hu/koveskal/koveskal-350x262.webp",
    keep: false,
    why: "utazási cikk település-fotója kempingnek tulajdonítva (§B.17)",
  },
  {
    label: "Landhaus Dörgicse — Booking VÁROS-stock",
    url: "https://q-xx.bstatic.com/xdata/images/city/608x352/787325.webp",
    keep: false,
    why: "/images/city/ = régió-stock, sosem a szállás",
  },
  {
    label: "Révfülöp település-kép",
    url: "https://www.balatoni-szallaskereso.hu/foto/telepules-kepek/revfulop_01.jpg",
    width: 980,
    height: 240,
    keep: false,
    why: "telepules-kepek mappa ÉS 4,08:1 szalag-arány",
  },
  {
    label: "Oldal-banner a szállás-oldalon",
    url: "https://www.balatoni-szallaskereso.hu/images/foto_3.jpg",
    width: 980,
    height: 240,
    keep: false,
    why: "4,08:1 — semmilyen valódi fotó nem ilyen alakú",
  },
  // ── must be DROPPED: not a property photo at all ───────────────────────────
  {
    label: "Nyelvváltó zászló-ikon",
    url: "https://szigliget.hu/portal/images/gb-32x22.png",
    keep: false,
    why: "32×22 felület-ikon",
  },
  {
    label: "Értékelés-csillag grafika",
    url: "https://www.ittjartam.hu/images/rating-overall-8.webp",
    width: 108,
    height: 19,
    keep: false,
    why: "UI-grafika; méret nélkül átcsúszott, a fejléc-mérés fogja meg",
  },
  {
    label: "Pinterest megosztó-link",
    url: "http://pinterest.com/pin/create/link/?url=https://www.szallaskereso.com/public/uploads/5000/2/o/072220ede62a947e02e9467b3.jpg",
    keep: false,
    why: "nem kép, hanem megosztó-URL (a kép-URL-t csak paraméterként tartalmazza)",
  },
  {
    label: "Erdei iskola — túraportál tájfotója (nagy felbontású!)",
    url: "https://img.oastatic.com/img2/36858270/max/variant.webp",
    width: 2048,
    height: 1365,
    keep: false,
    why: "2048×1365 tópanoráma egy természetjáró-katalógusból — a méret-szabály NEM fogja meg",
  },
  {
    label: "Szabványos hirdetés-méret",
    url: "https://balaton.hu/wp-content/uploads/2021/05/AP_300_250.png",
    keep: false,
    why: "300×250 display-banner",
  },
  {
    label: "Portál bélyegkép-változat",
    url: "https://csenge-panzio-guest-house.lake-balaton.com/data/Photos/150x150w/421/42175/42175828/csenge-panzio-balatonszarszo-photo-1.JPEG",
    keep: false,
    why: "150×150 — valódi fotó, de hero-nak használhatatlan (nagy változata külön szerepel)",
  },
  {
    label: "Booking square600 — a küszöb ALATT",
    url: "https://cf.bstatic.com/xdata/images/hotel/square600/49726272.webp",
    width: 600,
    height: 600,
    keep: false,
    why: "600px < 800px; az URL nem árulja el, csak a mérés",
  },
];

for (const c of CASES) {
  const verdict = judgePhoto({ url: c.url, width: c.width, height: c.height });
  const ok = verdict.usable === c.keep;
  check(
    `${c.keep ? "MEGTART" : "ELDOB"} · ${c.label}`,
    ok,
    `${c.why}\n     ${verdict.usable ? "megtartva" : `eldobva: ${verdict.why}`}`,
  );
}

// The URL-encoded size parser: portals name their derivatives, and that is the only
// evidence available for legacy rows that were stored before the ingest probe existed.
check(
  "URL-ből olvasott méret",
  dimensionsFromUrl("https://x/data/Photos/150x150w/a.JPEG")?.width === 150 &&
    dimensionsFromUrl("https://x/koveskal-350x262.webp")?.height === 262 &&
    dimensionsFromUrl("https://x/plain/photo.jpg") === null,
  "a származék-méret kiolvasható, és a méret nélküli URL NEM hazudik méretet",
);

// The header decoder — a wrong parse would silently drop real photos as "too small".
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from([0, 0, 0, 13]),
  Buffer.from("IHDR"),
  (() => {
    const b = Buffer.alloc(8);
    b.writeUInt32BE(1280, 0);
    b.writeUInt32BE(853, 4);
    return b;
  })(),
]);
const GIF = Buffer.concat([Buffer.from("GIF89a"), (() => {
  const b = Buffer.alloc(4);
  b.writeUInt16LE(300, 0);
  b.writeUInt16LE(250, 2);
  return b;
})()]);
check(
  "fejléc-dekóder (PNG, GIF)",
  dimensionsFromHeader(PNG)?.width === 1280 &&
    dimensionsFromHeader(PNG)?.height === 853 &&
    dimensionsFromHeader(GIF)?.width === 300 &&
    dimensionsFromHeader(Buffer.from("nem kép")) === null,
  "a méret a bájtokból jön; felismerhetetlen tartalomra null (a kép megmarad)",
);

// ── VOUCHED relaxation (2026-08-23) — real Villa Rubin data ─────────────────────
// The trust anchor is the PAGE-level match: a high-band profile means the listing is
// verified to be this property's own page, so its whole gallery is vouched (numeric
// WP filenames included — apartman.hu serves 500px photos named 3166126.jpg). The
// relaxed 400px floor lets the small-derivative gallery through, but the floor itself
// and every non-size rule (aspect, deny-list) must still bite.
const RUBIN_MAIN = "https://hovamenjek.hu/upload/places/2360_x/main/balatonfoldvar-villa-rubin-balatonfoldvar2.jpg";
const RUBIN_THUMB = "https://hovamenjek.hu/upload/places/2360_x/galleryMiddle/balatonfoldvar-villa-rubin-balatonfoldvar7.jpg";
const APARTMAN_WP = "https://apartman.hu/wp-content/uploads/2023/01/3166126.jpg";

check(
  "MEGTART · vouched 574px fotó a saját adatlapról (relaxált küszöb)",
  judgePhoto({ url: RUBIN_MAIN, width: 574, height: 323, vouched: true }).usable === true,
  "a verifikált adatlap galéria-fotója átmegy a 400px küszöbön",
);
check(
  "MEGTART · vouched 500px NUMERIKUS fájlnév (apartman.hu WP)",
  judgePhoto({ url: APARTMAN_WP, width: 500, height: 500, vouched: true }).usable === true,
  "a fájlnév nem számít — az oldal-szintű match a horgony (tulaj-rendelet)",
);
// ⚠️ EZ AZ ESET CSAK AZ IDEGEN-DOMAIN SZABÁLYT MÉRI — NEM „a Mirabella-bannert" általában.
// 2026-09-11-ig ez a sor azt a látszatot keltette, hogy a banner-eset le van fedve (a neve is
// ezt mondta), és MINDENKI elhitte — miközben a kép élesben kiment a galériába ÉS a JSON-LD-be.
// Az ok: itt `portalHost: "szalas.hu"` áll a balaton.hu-s kép mellett (idegen bannert ágyazó
// szalas.hu-s adatlap), a VALÓS leadnél viszont a profil MAGÁRÓL a balaton.hu-ról jött —
// kép-host === portál-host, tehát ez a szabály szerkezetileg nem tud tüzelni. Ez az assert
// tehát IGAZ és HASZNOS, csak egy MÁSIK forgatókönyvre.
// A valós esetet a látás fogja meg (`ad_banner` → heroPick NEVER_SHOWN, ADR-0116), és a
// kiszállított HTML-en a `scripts/ad-banner-render-check.mts` méri — ott, ahol az adat kimegy.
check(
  "ELDOB · vouched, de IDEGEN DOMAIN képe a galériában (cross-site szabály)",
  judgePhoto({
    url: "https://balaton.hu/wp-content/uploads/2021/05/MIR_640_360.png",
    width: 640,
    height: 360,
    vouched: true,
    portalHost: "szalas.hu",
  }).usable === false,
  "MÁS portál adatlapjába ágyazott idegen kreatív — a kép-host ≠ portál-host esetet méri, nem a banner-esetet általában",
);
// A HIÁNYZÓ PÁR: UGYANAZ a kép a saját portálján hosztolva. Ez a valós adat alakja, és ez az
// assert mondja ki feketén-fehéren, hogy erre NEM a méret/domain-szabály a válasz — nehogy
// legközelebb megint azt higgyük, hogy a szűrő megfogja.
check(
  "MEGTART(!) · ugyanaz a banner a SAJÁT portálján — a szerkezeti szabályok VAKOK rá",
  judgePhoto({
    url: "https://balaton.hu/wp-content/uploads/2021/05/MIR_640_360.png",
    width: 640,
    height: 360,
    vouched: true,
    portalHost: "balaton.hu",
  }).usable === true,
  "kép-host === portál-host, 640×360 nem szabványos hirdetés-méret, az arány rendben → CSAK a látás (ad_banner) fogja meg (ADR-0116)",
);
check(
  "MEGTART · saját CDN-aldomain nem idegen domain (i.szalas.hu ↔ szalas.hu)",
  judgePhoto({
    url: "https://i.szalas.hu/hotels/459385/500x500/2853990.jpg",
    width: 500,
    height: 332,
    vouched: true,
    portalHost: "szalas.hu",
  }).usable === true,
  "a regisztrálható site azonos — a cross-site szabály CDN-aldomainre nem üt",
);
check(
  "ELDOB · UGYANAZ a 574px fotó vouched NÉLKÜL (szigorú 800px)",
  judgePhoto({ url: RUBIN_MAIN, width: 574, height: 323 }).usable === false,
  "a relaxálás OPT-IN — voucher nélkül nincs változás (nincs regresszió)",
);
check(
  "ELDOB · vouched, de 242px — a relaxált 400px ALATT",
  judgePhoto({ url: RUBIN_THUMB, width: 242, height: 323, vouched: true }).usable === false,
  "a vouch a méret-padlót engedi, de nem nullázza — a pici widget-thumb kiesik",
);
check(
  "ELDOB · vouched, de szalag-arány (980×240) — nem méret-kérdés",
  judgePhoto({ url: RUBIN_MAIN, width: 980, height: 240, vouched: true }).usable === false,
  "a vouch CSAK a méret-padlót lazítja; az arány-szabály továbbra is bánt",
);
check(
  "ELDOB · vouched, de deny-listás út (város-stock) — a vouch nem ír felül mindent",
  judgePhoto({ url: "https://q-xx.bstatic.com/xdata/images/city/1200x800/787325.webp", width: 1200, height: 800, vouched: true }).usable === false,
  "a régió-stock kép a saját adatlapon is tiltott marad (§B.17)",
);

// ── largestPhotoUrl transform (2026-08-23) — the pure half of the size-upgrade ──
// (The network verify/fallback lives in portalListing.ts and is exercised live.) The
// transform must swap the size-segment to the largest derivative AND no-op on anything
// that does not fit the shape — a wrong rewrite would point the gallery at 404s.
const { PORTAL_ADAPTERS } = await import("../src/scraper/sources/portals/registry.js");
const hovamenjek = PORTAL_ADAPTERS.find((a) => a.id === "hovamenjek");
check(
  "hovamenjek.largestPhotoUrl: galleryMiddle/gallery/main → fullHd",
  hovamenjek?.largestPhotoUrl?.(
    "https://hovamenjek.hu/upload/places/2360_x/galleryMiddle/balatonfoldvar-villa-rubin-balatonfoldvar4.jpg",
  ) === "https://hovamenjek.hu/upload/places/2360_x/fullHd/balatonfoldvar-villa-rubin-balatonfoldvar4.jpg" &&
    hovamenjek?.largestPhotoUrl?.(
      "https://hovamenjek.hu/upload/places/2360_x/187x187/x.jpg",
    ) === "https://hovamenjek.hu/upload/places/2360_x/fullHd/x.jpg" &&
    // a stored `main` URL (pre-ADR-0298 reads) upgrades too — main is 404 for numbered files
    hovamenjek?.largestPhotoUrl?.(
      "https://hovamenjek.hu/upload/places/2360_x/main/balatonfoldvar-10.jpg",
    ) === "https://hovamenjek.hu/upload/places/2360_x/fullHd/balatonfoldvar-10.jpg",
  "a méret-szegmens a legnagyobb derivatívára (fullHd, ADR-0298) cserélődik",
);
check(
  "hovamenjek.largestPhotoUrl: idegen alakra NO-OP (nem gyárt 404-et)",
  hovamenjek?.largestPhotoUrl?.("https://hovamenjek.hu/logo.png") ===
    "https://hovamenjek.hu/logo.png" &&
    hovamenjek?.largestPhotoUrl?.(
      "https://hovamenjek.hu/upload/places/2360_x/fullHd/already.jpg",
    ) === "https://hovamenjek.hu/upload/places/2360_x/fullHd/already.jpg",
  "a szabályba nem illő URL változatlan; a már-fullHd is önmaga",
);

// ── Wix (2026-10-26, éles mérés) ──────────────────────────────────────────────────
// ① Platán 92b32b6c: a saját (Wix) honlap 6 képe a wixstatic.com CDN-en ül, a cross-site
//    szabály „idegen domainnek” vette, a source-pack 0 képet adott (élesen 10 lead, 211 kép).
const PLATAN = "https://static.wixstatic.com/media/760cef_4cc8cbfc08974f9f94519794af6b9e69~mv2.jpg/v1/fill/w_2500,h_1666,al_c/760cef_4cc8cbfc08974f9f94519794af6b9e69~mv2.jpg";
check(
  "MEGTART · Platán: a SAJÁT Wix-honlap képe a wixstatic.com CDN-en",
  judgePhoto({ url: PLATAN, width: 2500, height: 1666, vouched: true, portalHost: "platansiofok.com", provenance: "website" }).usable === true,
  "a honlapépítő a lap saját médiáját a saját CDN-jéről szolgálja ki — nem hirdetés",
);
check(
  "ELDOB · ugyanaz a wixstatic-kép egy PORTÁL adatlapjában továbbra is idegen",
  judgePhoto({ url: PLATAN, width: 2500, height: 1666, vouched: true, portalHost: "szalas.hu", provenance: "portal" }).usable === false,
  "a kivétel csak a saját honlapra (provenance=website) szól",
);
// ② Manduláskert e2bb6b95 / Gyógynövények Völgye / LUX: a srcset-et minden vesszőnél vágtuk,
//    a Wix URL-ben is van vessző → halott „<host>/quality_auto/<fájl>” (8 lead, 77 kép).
const WIX480 = "https://static.wixstatic.com/media/5880ad_2d1586bfccdb4e18984134ba2c38b04e~mv2.png/v1/fit/w_480,h_480,q_90,enc_avif,quality_auto/5880ad_2d1586bfccdb4e18984134ba2c38b04e~mv2.png";
const WIX960 = WIX480.replace("w_480,h_480", "w_960,h_960");
const cands = parseSrcset(`${WIX480} 1x, ${WIX960} 2x`);
check(
  "parseSrcset: a vesszős Wix-URL egyben marad",
  cands.length === 2 && cands[0]!.url === WIX480 && cands[1]!.url === WIX960 && cands[1]!.w === 2,
  JSON.stringify(cands),
);
check(
  "parseSrcset: a sima „a.jpg 480w, b.jpg 1200w” változatlan",
  JSON.stringify(parseSrcset("a.jpg 480w, b.jpg 1200w")) === JSON.stringify([{ url: "a.jpg", w: 480 }, { url: "b.jpg", w: 1200 }]),
  JSON.stringify(parseSrcset("a.jpg 480w, b.jpg 1200w")),
);
const own = ownSiteImages(`<img src="${WIX480}" srcset="${WIX480} 1x, ${WIX960} 2x" alt="kert">`, "https://www.mandulaskert.com/");
check(
  "ownSiteImages: Wix-srcset → EGY kép, a nagyobb, halott quality_auto URL nélkül",
  own.length === 1 && own[0]!.url === WIX960 && !own.some((o) => /mandulaskert\.com\/quality_auto/.test(o.url)),
  JSON.stringify(own),
);
const dom = domImages(`<img src="${WIX480}" alt="kert"><img srcset="${WIX960} 2x, ${WIX480} 1x">`, "https://www.mandulaskert.com/");
check(
  "domImages: a vesszős Wix-src egyben marad, a csak-srcset kép is ép URL",
  dom.length === 2 && dom[0]!.url === WIX480 && dom[1]!.url === WIX960,
  JSON.stringify(dom.map((d) => d.url)),
);

// ③ Webnode (Neo, 2026-10-26): Árvalányhaj 54bbfabd saját honlapjának 39 képe a Webnode
//    CDN-jén ül (`80bef5b163.clvaw-cdnwnd.com`); a kód oldalanként változik → minta.
const WEBNODE = "https://80bef5b163.clvaw-cdnwnd.com/0b2e0c8d7e4f5a6b/200000012-abc12abc13/IMG_2041.jpeg?ph=80bef5b163";
check(
  "MEGTART · Árvalányhaj: a SAJÁT Webnode-honlap képe a *-cdnwnd.com CDN-en",
  judgePhoto({ url: WEBNODE, width: 1600, height: 1200, vouched: true, portalHost: "arvalanyhaj-vendeghaz.hu", provenance: "website" }).usable === true,
  "a Webnode a lap saját feltöltéseit a <hash>.<kód>-cdnwnd.com hostról szolgálja ki",
);
check(
  "ELDOB · ugyanaz a Webnode-kép egy portál adatlapjában idegen",
  judgePhoto({ url: WEBNODE, width: 1600, height: 1200, vouched: true, portalHost: "szallas.hu", provenance: "portal" }).usable === false,
  "a kivétel csak a saját honlapra szól",
);
check(
  "isSiteBuilderMedia: Wix · Squarespace · Webnode (bármely kód) igen; hasonló nevű idegen host nem",
  isSiteBuilderMedia("static.wixstatic.com") && isSiteBuilderMedia("images.squarespace-cdn.com") &&
    isSiteBuilderMedia("80bef5b163.clvaw-cdnwnd.com") && isSiteBuilderMedia("0f5d6ecb02.cbaul-cdnwnd.com") &&
    !isSiteBuilderMedia("cdnwnd.com.example.hu") && !isSiteBuilderMedia("notwixstatic.com") && !isSiteBuilderMedia("i0.wp.com"),
  "egy lista a két kapunak",
);
check(
  "MEGTART · Squarespace saját honlapon a képszűrőn is (eddig csak a behúzó engedte)",
  judgePhoto({ url: "https://images.squarespace-cdn.com/content/v1/abc/1600.jpg", width: 1600, height: 1067, vouched: true, portalHost: "pelda-vendeghaz.hu", provenance: "website" }).usable === true,
  "a behúzó és a képszűrő ugyanazt a listát olvassa",
);
check(
  "bekötés: az attachPhotoLinks saját-oldali szűrője az isSiteBuilderMedia-t hívja (nincs külön lista)",
  /isSiteBuilderMedia\(imgHost\)/.test(readFileSync(new URL("../src/scraper/attachPhotoLinks.ts", import.meta.url), "utf8")) &&
    !/const SITE_BUILDER_CDN/.test(readFileSync(new URL("../src/scraper/attachPhotoLinks.ts", import.meta.url), "utf8")),
  "egy igazság, két kapu",
);

// Deploy-check 2026-10-26: dead comma-cut pieces stayed on OLD profiles (a homepage re-pull adds
// a new profile, the /galeria one keeps its rows) — Gyógynövények, Manduláskert, Fordan, LUX.
const DEAD = [
  "https://www.gyogynovenyekvolgye.hu/quality_auto/2f56fe_b16511f420b2406c9ff39155719cb79e~mv2.png",
  "https://www.fordanhotel.hu/quality_auto/hotel%20log%C3%B3%20fekete.png",
  "https://olajimre.wixsite.com/mysite/quality_auto/74d327d3628e4f14800301f1c61013b0.png",
  "https://www.mandulaskert.com/quality_auto/web_EGYBE-94.png",
];
const LIVE = "https://static.wixstatic.com/media/53a235_8689724f970242168c367f97311a0da3~mv2.png/v1/fit/w_1440,h_839,q_90,enc_avif,quality_auto/53a235_8689724f970242168c367f97311a0da3~mv2.png";
check("vágott srcset-darab felismerve (host-, wixsite-alak, .png)", DEAD.every(isCutSrcsetUrl) && !isCutSrcsetUrl(LIVE), DEAD.filter((u) => !isCutSrcsetUrl(u)));
check(
  "ELDOB · a régi sorok halott URL-je a képszűrőn (generátor) nem megy át, az élő Wix-URL igen",
  DEAD.every((url) => !judgePhoto({ url, width: 1600, height: 1067, vouched: true, portalHost: new URL(url).hostname, provenance: "website" }).usable) &&
    judgePhoto({ url: LIVE, width: 1440, height: 839, vouched: true, portalHost: "baladise.hu", provenance: "website" }).usable,
  "",
);
const stale = distinctPortalPhotos([{ photos: [...DEAD.map((url) => ({ url })), { url: LIVE }] }]);
check("a számláló sem látja őket (distinctPortalPhotos: 5 → 1)", stale.length === 1 && stale[0]!.url === LIVE, stale.length);

// Neo 2026-10-26: the line said „a fotószám nem változott” while the count dropped.
check(
  "üzenet: csökkenés kimondva, növekedés és változatlan a régi",
  /csökkent: 33 → 21/.test(photoCountMessage(33, 21)) && /behúzva.*0 → 12/.test(photoCountMessage(0, 12)) && /nem változott \(7 fotó/.test(photoCountMessage(7, 7)),
  photoCountMessage(33, 21),
);
// Kakas-Dombi 2895a3ef: the szallas.hu listing is alive (33 photos), only its booked.hu twin is missing.
const twinWhy = twinSkipReason("szallas.hu", "https://szallas.hu/kokas-dombi-vendeghaz-nemeshetes", "https://kokas-dombi-vendeghaz-nemeshetes.booked.hu/", ENGINE_HOME_REDIRECT);
check(
  "szallas.hu iker nélkül: nem „az adatlap nem létezik”, hanem „nincs nyílt booked.hu-ikre”",
  /nyílt booked\.hu-ikre sincs/.test(twinWhy) && !/nem létezik/.test(twinWhy) &&
    twinSkipReason("booked.hu", "https://x.booked.hu/", "https://x.booked.hu/", ENGINE_HOME_REDIRECT) === ENGINE_HOME_REDIRECT,
  twinWhy,
);
check(
  "bekötés: a link-behúzó a twinSkipReason-t és a photoCountMessage-et használja",
  /twinSkipReason\(adapter\.label, url, readUrl, r\.skipped\)/.test(readFileSync(new URL("../src/scraper/attachPhotoLinks.ts", import.meta.url), "utf8")) &&
    /photoCountMessage\(beforeCount, afterCount\)/.test(readFileSync(new URL("../src/scraper/attachPhotoLinks.ts", import.meta.url), "utf8")),
  "",
);

// -bb, MG21 Keszthely 2026-10-26: Dóra Holiday House (9926) and Miss Mici (11997) under almost
// every Keszthely lead — the „Közeli szállások” strip (div.places_nearby) of the hovamenjek
// listing, neighbours' thumbs from THEIR folders. Shape of the real Elza Apartman page.
const HM = "https://hovamenjek.hu/upload/places";
const elzaOwn = (n: number) => `${HM}/12963_0a1b2c3d/galleryMiddle/keszthely-elza-apartman${n}.jpg`;
const elzaPage =
  `<html><head><title>Elza Apartman</title></head><body>${"<p>Keszthely, a Balaton partján.</p>".repeat(20)}` +
  `<div id="place_picture">${[1, 2, 3, 4, 5, 6].map((n) => `<a href="${elzaOwn(n).replace("galleryMiddle", "fullHd")}"><img src="${elzaOwn(n)}" alt="Elza Apartman"></a>`).join("")}</div>` +
  `<h3 class="callback-text">Közeli helyek</h3><ul class="services-ul"><li>Városi Strand, távolság: 1 000 m</li></ul>` +
  `<div class="places_nearby"><h3>Közeli szállások – <a href="https://hovamenjek.hu/keszthely/szallas">Keszthely</a></h3>` +
  `<a class="nearby" href="https://hovamenjek.hu/keszthely/miss-mici"><figure><img srcset="${HM}/11997_e33d974a/187x187/keszthely-miss-mici9.jpg 187w,${HM}/11997_e33d974a/250x250/keszthely-miss-mici9.jpg 250w" src="${HM}/11997_e33d974a/187x187/keszthely-miss-mici9.jpg" width="187" height="187" alt="Miss Mici – Keszthely"></figure><h4>Miss Mici</h4></a>` +
  `<a class="nearby" href="https://hovamenjek.hu/keszthely/dora-holiday-house"><figure><img src="${HM}/9926_cb757ef4/187x187/keszthely-2.jpg" width="187" height="187" alt="Dóra Holiday House – Keszthely"></figure><h4>Dóra Holiday House</h4></a>` +
  `</div></body></html>`;
const elzaImgs = extractListing(elzaPage, "https://hovamenjek.hu/keszthely/elza-apartman").images.map((i) => i.url);
check(
  "hovamenjek „Közeli szállások”: a szomszédok bélyegképe nem kerül a lead képei közé",
  elzaImgs.length > 0 && elzaImgs.every((u) => u.includes("/12963_")) && !elzaImgs.some((u) => /miss-mici|keszthely-2\.jpg/.test(u)),
  elzaImgs.join(" "),
);
const src = "https://hovamenjek.hu/keszthely/elza-apartman";
const stored = [
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ url: elzaOwn(n).replace("galleryMiddle", "fullHd"), sourceUrl: src })),
  { url: `${HM}/11997_e33d974a/fullHd/keszthely-miss-mici9.jpg`, sourceUrl: src },
  { url: `${HM}/9926_cb757ef4/fullHd/keszthely-2.jpg`, sourceUrl: src },
];
const kept = withoutNeighbourFolders(stored);
check("már TÁROLT profil (Elza: 10 saját + 2 szomszéd) → a szomszédok kiesnek újragyűjtés nélkül", kept.length === 10 && kept.every((p) => p.url.includes("/12963_")), kept.length);
check("a számláló is a tisztát látja (distinctPortalPhotos 12 → 10)", distinctPortalPhotos([{ photos: stored }]).length === 10, distinctPortalPhotos([{ photos: stored }]).length);
const ks = "https://hovamenjek.hu/balatonalmadi/krisztina-panzio-puszta-etterem";
const krisztina = [
  `${HM}/3671_54ebdfbb/main/balatonalmadi-krisztina-panzio-puszta-etterem2.jpg`,
  `${HM}/3681_9426c311/fullHd/balatonalmadi-porcio-vendeglo1.jpg`,
  `${HM}/3685_55a0df4b/fullHd/balatonalmadi-virag-etterem1.jpg`,
  `${HM}/698_99bcfcd7/fullHd/balatonalmadi-hatar-etterem2.jpg`,
].map((url) => ({ url, sourceUrl: ks }));
const kk = withoutNeighbourFolders(krisztina);
check("döntetlen (Krisztina 5b577422: négy 1-képes mappa) → a lead slugját viselő fájl mappája marad", kk.length === 1 && /krisztina-panzio/.test(kk[0]!.url), kk.map((p) => p.url));
const blind = krisztina.slice(1);
check("⛔ döntetlen név nélkül → semmi nem dől el, minden marad", withoutNeighbourFolders(blind).length === 3, "");
const mixed = [{ url: "https://x.booked.hu/photo1.jpg" }, { url: elzaOwn(1) }, { url: "https://www.elza.hu/kep.jpg" }];
check("⛔ egy mappa / nem-hovamenjek kép érintetlen", withoutNeighbourFolders(mixed).length === 3, "");
check(
  "bekötés: a generátor galériája is a szűrt listát olvassa",
  /for \(const p of withoutNeighbourFolders\(profile\.photos\)\)/.test(readFileSync(new URL("../src/generator/generate.ts", import.meta.url), "utf8")),
  "",
);

if (failed) {
  console.error(`⛔ ${failed} eset megbukott — a fotó-tulajdonítás visszaesett.`);
  process.exit(1);
}
console.log(`✅ ${CASES.length} valós fotó-eset + vouch-relaxálás + parszolók rendben (méret, arány, URL-alak, név-egyezés).`);
