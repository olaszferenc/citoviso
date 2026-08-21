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
  judgePhoto,
} from "../src/scraper/sources/portals/photoQuality.js";

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

if (failed) {
  console.error(`⛔ ${failed} eset megbukott — a fotó-tulajdonítás visszaesett.`);
  process.exit(1);
}
console.log(`✅ ${CASES.length} valós fotó-eset + parszolók rendben (méret, arány, URL-alak).`);
