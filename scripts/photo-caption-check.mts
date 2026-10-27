// A photo caption says something, and never sits ON the photo (ADR-0300, L-3).
//
// Measured on the live Muschel mock (Elek, 2026-10-01): "[TESZT] Muschel Panzió — 1. kép"
// covered the bottom quarter of the cover photo on a phone, and the same generated alt was
// printed under all six gallery shots. Portal captions are no better: "Suzy 3*",
// "Három Huszár Köveskal Vendégház Köveskál" only repeat the name, the town and the stars.
// Owner's decision (2026-10-02): the alt stays on the <img>; a VISIBLE caption appears only
// when it says something (src/engine/photoCaption.ts), and then BELOW the photo.
//
// ① every art template + every primitive gallery variant, rendered: no generated and no
//    name-echo caption in the visible text; a meaningful caption still shows (negative
//    control — the rule is "say something", not "never caption").
// ② every art template in Chromium at 390 px and 1280 px: a shown caption's box does not
//    overlap its photo's box.
// Each detector has a red twin on the OLD markup.
//
//   npx tsx scripts/photo-caption-check.mts

import { chromium } from "playwright-core";
import { config } from "../src/config.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { PRIMITIVES } from "../src/engine/primitives.js";
import { isEchoCaption, isFilenameCaption, isKeywordListCaption, isNonCaption, isQuoteCutName, photoCaption, withoutFilenameAlts } from "../src/engine/photoCaption.js";
import { domImages, tagAttr } from "../src/scraper/sources/portals/extract.js";
import { toSitePhotos } from "../src/engine/siteData.js";
import { ownSiteImages } from "../src/scraper/attachPhotoLinks.js";
import type { SiteData } from "../src/engine/recipe.js";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${detail}`}`);
  }
}

// A sized image (the layout needs real boxes); the fragment keeps the URLs distinct.
const IMG = (n: number) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#8aa"/></svg>`,
  )}#p${n}`;

const MEANINGFUL = "Kerti terasz a diófa alatt";
const BAD = [
  "Három Huszár Apartments — 1. kép",
  "Három Huszár Köveskal Vendégház Köveskál",
  "Három Huszár Köveskal 3*",
  "Vendégház Három Huszár Köveskal 3*",
];
const D = {
  name: "Három Huszár Apartments",
  tagline: "Csend a Káli-medencében",
  intro: "Lombos fák alatt, kovácsoltvas bútorokkal berendezett kert.",
  highlights: ["Kert", "Saját parkoló"],
  place: { city: "Köveskál" },
  photos: [
    { url: IMG(1), alt: BAD[0], provenance: "owner" },
    { url: IMG(2), alt: BAD[1], provenance: "owner" },
    { url: IMG(3), alt: MEANINGFUL, provenance: "owner" },
    { url: IMG(4), alt: BAD[2], provenance: "owner" },
    { url: IMG(5), alt: "Három Huszár Apartments — 5. kép", provenance: "owner" },
    { url: IMG(6), alt: BAD[3], provenance: "owner" },
  ],
  contact: { email: "info@example.com", phone: "+36 30 123 4567", address: "Fő utca 5, Köveskál" },
} as unknown as SiteData;

/** Visible text only: no attributes (the alt STAYS), no CSS/JS/JSON-LD. */
function visible(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}
const leaked = (html: string) => {
  const v = visible(html);
  return [/—\s*\d+\.\s*kép/.exec(v)?.[0], ...BAD.slice(1).filter((b) => v.includes(b))].filter(Boolean) as string[];
};

// ── red twins ─────────────────────────────────────────────────────────────────────────────
console.log("Önteszt (a régi jelölésnek tüzelnie kell):");
check("piros iker: gépi felirat a látható szövegben", leaked(`<figcaption>${BAD[0]}</figcaption>`).length > 0);
check("piros iker: visszhang-felirat a látható szövegben", leaked(`<figcaption>${BAD[2]}</figcaption>`).length > 0);
check("az alt-ATTRIBÚTUM nem számít feliratnak", leaked(`<img alt="${BAD[0]}">`).length === 0);
check("a szabály: gépi alt → nincs felirat", photoCaption(D, D.photos[0]!) === "");
check("a szabály: név+hely+típus+csillag → nincs felirat", BAD.slice(1).every((b) => isEchoCaption(D, b)));
check("a szabály: valódi felirat megmarad", photoCaption(D, D.photos[2]!) === MEANINGFUL);

// ── ① rendered text ──────────────────────────────────────────────────────────────────────
const ids = Object.keys(TEMPLATES);
console.log(`\n① Renderelt szöveg (${ids.length} sablon + primitív galériák):`);
const leaks: string[] = [];
const pages: Record<string, string> = {};
for (const t of ids) {
  for (const phase of ["mock", "live"] as const) {
    const html = renderSite({ template: t, skin: "", archetype: "", sections: [] }, D, { phase });
    if (phase === "mock") pages[t] = html;
    const l = leaked(html);
    if (l.length) leaks.push(`${t}/${phase}: ${l[0]}`);
  }
}
for (const [v, variant] of Object.entries(PRIMITIVES.gallery.variants)) {
  const l = leaked(variant.render(D));
  if (l.length) leaks.push(`primitív gallery/${v}: ${l[0]}`);
}
check("⭐⭐ sehol nem látszik gépi („— N. kép”) vagy név-visszhang felirat", leaks.length === 0, leaks.slice(0, 5).join(" · "));
// Negative control: the templates that DO caption still print a caption that says something.
const CAPTIONING = ["editorial", "brutalism", "artdeco"];
const silent = CAPTIONING.filter((t) => pages[t] && !visible(pages[t]!).includes(MEANINGFUL));
check("a valódi felirat megjelenik ott, ahol a sablon feliratoz (negatív kontroll)", silent.length === 0, silent);

// ── ② in the browser: a caption never covers its photo ─────────────────────────────────────
console.log("\n② Böngészőben: a felirat nem takarja a képet (390 px + 1280 px):");
const browser = await chromium.launch({ executablePath: config.chromiumPath });
const OVERLAP = `(() => {
  const out = [];
  for (const el of document.querySelectorAll("figcaption, .t-card figcaption p")) {
    const box = el.closest("figure, .e-shot, .b-tp, .t-card, .cit-shot") || el.parentElement;
    const img = box && box.querySelector("img");
    if (!img || !el.textContent.trim()) continue;
    // The VISIBLE photo: the img box clipped by every overflow-hiding ancestor (an
    // object-fit image is often taller than its frame, and the frame cuts it).
    let r = img.getBoundingClientRect();
    let b = { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    for (let p = img.parentElement; p && p !== box.parentElement; p = p.parentElement) {
      if (getComputedStyle(p).overflow === "visible") continue;
      const c = p.getBoundingClientRect();
      b = { left: Math.max(b.left, c.left), top: Math.max(b.top, c.top), right: Math.min(b.right, c.right), bottom: Math.min(b.bottom, c.bottom) };
      b.width = b.right - b.left; b.height = b.bottom - b.top;
    }
    const a = el.getBoundingClientRect();
    if (!a.width || !a.height || !b.width || !b.height) continue;
    const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    // > 8 px: a frame's border/rounding touch (3 px measured on the editorial polaroid) is
    // not a caption laid over the photo — the old cover caption overlapped by its full height.
    if (ix > 8 && iy > 8) out.push(el.textContent.trim().slice(0, 40));
  }
  return out;
})()`;
// ── A fájlnév nem alt (Dobos Apartman 97e61003, hupont, 2026-10-26: „kep_128.jpg”) ──
console.log("fájlnév-alt");
check("isFilenameCaption: kep_128.jpg · hirdeteshez_008.jpg · IMG_1182 · 4-2-1000007130.jpg · DSC_0012",
  ["kep_128.jpg", "hirdeteshez_008.jpg", "IMG_1182", "4-2-1000007130.jpg", "DSC_0012", "P1010045.JPG"].every(isFilenameCaption));
check("⛔ valódi felirat nem fájlnév („Kerti terasz a diófa alatt”, „Szoba 2.”, „Nappali — 3. kép”)",
  ![MEANINGFUL, "Szoba 2.", "Nappali — 3. kép", "Panoráma 2024"].some(isFilenameCaption));
const sp = toSitePhotos([{ url: "https://x.hupont.hu/kep_128.jpg", caption: "kep_128.jpg" }, { url: "https://x.hupont.hu/b.jpg", caption: "Terasz" }] as never, "Dobos Apartman");
check("toSitePhotos: fájlnév-caption → „<név> — N. kép”, a valódi marad", sp[0]?.alt === "Dobos Apartman — 1. kép" && sp[1]?.alt === "Terasz", JSON.stringify(sp.map((p) => p.alt)));
const own = ownSiteImages(`<img src="https://balatonszarszo-nyaralas.hupont.hu/felhasznalok_uj/kepfeltoltes/kep_128.jpg" alt="kep_128.jpg">`, "https://balatonszarszo-nyaralas.hupont.hu/");
check("ownSiteImages: a fájlnév-altot nem veszi fel captionnek", own.length === 1 && own[0]!.caption === undefined, JSON.stringify(own));
const dobos = { ...D, name: "Dobos Apartman", photos: D.photos.map((p, i) => ({ ...p, alt: i === 2 ? MEANINGFUL : `hirdeteshez_00${i}.jpg` })) } as unknown as SiteData;
for (const id of Object.keys(TEMPLATES)) {
  const tpl = TEMPLATES[id as keyof typeof TEMPLATES]!;
  const html = renderSite({ template: id, skin: tpl.skins[0] ?? "editorial-warm", archetype: "stacked", sections: [] }, dobos, { phase: "mock" });
  const bad = [...html.matchAll(/\balt="([^"]*)"/g)].map((m) => m[1]!).filter((a) => /hirdeteshez_\d+\.jpg/.test(a));
  if (bad.length) check(`${id}: render — nincs fájlnév az altban`, false, bad.slice(0, 3).join(" · "));
}
check("render: egyik sablon altjában sincs fájlnév (a meglévő mock rerenderrel javul)", true);
// ── A kép saját fájltöve sem alt (Erzsike Apartman 0dbda045, 2026-10-27: WordPress alt="erzsike-25"
//    a …/uploads/2018/02/erzsike-25.jpg-n; mock b1675651, 18664b64) ──
console.log("fájltő-alt (az URL fájlneve kiterjesztés nélkül)");
const WP = "https://varvolgyszallas.hu/wp-content/uploads/2018/02/";
const STEMS: Array<[string, string]> = [
  ["erzsike-25", `${WP}erzsike-25.jpg`],
  ["erzsike-5", `${WP}erzsike-5.jpg`],
  ["erzsike-apartman-szoba-6", "https://varvolgyszallas.hu/wp-content/uploads/2022/02/erzsike-apartman-szoba-6.jpg"],
  ["Varvolgyszallas_Galeria_Udvar_Telen-1", `${WP}Varvolgyszallas_Galeria_Udvar_Telen-1.jpg`],
  ["erzsike-25", `${WP}erzsike-25-1024x683.jpg`],
  ["erzsike-25-1024x683", `${WP}erzsike-25-1024x683.jpg?ver=2`],
  ["terasz-2-scaled", `${WP}terasz-2-scaled.jpeg`],
  ["kertkapu_01", "https://x.hu/k%C3%A9pek/kertkapu_01.webp"],
  ["fürdő-1", "https://x.hu/furdo-1.jpg"],
];
for (const [alt, url] of STEMS) check(`fájltő: „${alt}” ← ${url.split("/").pop()}`, isFilenameCaption(alt, url));
check("⛔ valódi felirat a fájltő mellett is marad („Terasz” a terasz.jpg-n, „Szoba 2” a szoba-2.jpg-n, más fájl)",
  !isFilenameCaption("Terasz", `${WP}terasz.jpg`) && !isFilenameCaption("Szoba 2", `${WP}szoba-2.jpg`) &&
  !isFilenameCaption("erzsike-25", `${WP}erzsike-26.jpg`) && !isFilenameCaption("Erzsike Apartman – Várvölgy fotó 5", "https://hovamenjek.hu/upload/x/varvolgy-erzsike-apartman11.jpg"));
const wsp = toSitePhotos([{ url: `${WP}erzsike-25.jpg`, caption: "erzsike-25" }] as never, "Erzsike Apartman");
check("toSitePhotos: fájltő-caption → „<név> — N. kép”", wsp[0]?.alt === "Erzsike Apartman — 1. kép", JSON.stringify(wsp.map((p) => p.alt)));
const wown = ownSiteImages(`<img src="${WP}erzsike-5.jpg" alt="erzsike-5">`, "https://varvolgyszallas.hu/");
check("ownSiteImages: a fájltő-altot nem veszi fel captionnek", wown.length === 1 && wown[0]!.caption === undefined, JSON.stringify(wown));
const erzsike = { ...D, name: "Erzsike Apartman", photos: D.photos.map((p, i) => (i === 2 ? { ...p, alt: MEANINGFUL } : { ...p, url: `${WP}erzsike-${20 + i}.jpg`, alt: `erzsike-${20 + i}` })) } as unknown as SiteData;
for (const id of Object.keys(TEMPLATES)) {
  const tpl = TEMPLATES[id as keyof typeof TEMPLATES]!;
  const html = renderSite({ template: id, skin: tpl.skins[0] ?? "editorial-warm", archetype: "stacked", sections: [] }, erzsike, { phase: "mock" });
  const bad = [...html.matchAll(/\balt="([^"]*)"/g)].map((m) => m[1]!).filter((a) => /^erzsike-\d+$/.test(a));
  const shown = [...html.matchAll(/>\s*(erzsike-\d+)\s*</g)].map((m) => m[1]!);
  if (bad.length || shown.length) check(`${id}: render — nincs fájltő az altban/feliratban`, false, [...bad, ...shown].slice(0, 3).join(" · "));
}
check("render: egyik sablonban sincs fájltő-alt (a meglévő mock sima rerenderrel javul)", true);
// ── SEO-kulcsszósor sem alt (Apartman Bella bbdc9da9, 2026-10-27, mock 60a06fa5, 2244d7d0) ──
console.log("SEO-kulcsszósor-alt");
const BELLA_SEO = "Szállás, Siófok, Apartman Bella, szállásfoglalás, booking, szobafoglalás";
const SEO_LINES = [
  BELLA_SEO,
  "Matildhotel, szállás, balaton, kertes apartman",
  "Fészek Villa romantikus wellness szállás elvonulásra kikapcsolódásra, enteriőr, hálószoba, franciaágy, erdei szállás, wellness szállás, romantikus szállás",
  "Online Foglalás",
  "Siófok apartman booking",
];
for (const a of SEO_LINES) check(`kulcsszósor: „${a.slice(0, 50)}”`, isKeywordListCaption(a) && isNonCaption(a));
const REAL = [MEANINGFUL, "Hálószoba — ágy, csipke függöny, kilátás a kertre", "Vica Apartman Kertibútor, pavilon, grill",
  "Sümegi Varázskuckó Apartman – hangulatos vidéki ház, a sümegi vár tövében, virágos kerttel és terasszal",
  "Hotel Fortuna, szállás, étterem, hotel, családbarát szálloda, wellness — 3. kép"];
check("⛔ valódi (vesszős) felirat és a generált „— N. kép” marad", !REAL.some(isKeywordListCaption), REAL.filter(isKeywordListCaption).join(" · "));
const bsp = toSitePhotos([{ url: "https://bella.hu/a.jpg", caption: BELLA_SEO }] as never, "Apartman Bella Panzió");
check("toSitePhotos: kulcsszósor → „<név> — N. kép”", bsp[0]?.alt === "Apartman Bella Panzió — 1. kép", JSON.stringify(bsp.map((p) => p.alt)));
const bown = ownSiteImages(`<img src="https://bella.hu/a.jpg" alt="${BELLA_SEO}">`, "https://bella.hu/");
check("ownSiteImages: a kulcsszósort nem veszi fel captionnek", bown.length === 1 && bown[0]!.caption === undefined, JSON.stringify(bown));
const bella = { ...D, name: "Apartman Bella Panzió", photos: D.photos.map((p, i) => (i === 2 ? { ...p, alt: MEANINGFUL } : { ...p, alt: BELLA_SEO })) } as unknown as SiteData;
for (const id of Object.keys(TEMPLATES)) {
  const tpl = TEMPLATES[id as keyof typeof TEMPLATES]!;
  const html = renderSite({ template: id, skin: tpl.skins[0] ?? "editorial-warm", archetype: "stacked", sections: [] }, bella, { phase: "mock" });
  if (/szobafoglalás/.test(html)) check(`${id}: render — nincs kulcsszósor az altban/feliratban`, false);
}
check("render: egyik sablonban sincs kulcsszósor-alt (a meglévő mock sima rerenderrel javul)", true);



try {
  const page = await browser.newPage();
  // red twin: the old editorial cover — caption absolutely positioned over the photo
  await page.setViewportSize({ width: 390, height: 800 });
  await page.setContent(
    `<figure style="position:relative;margin:0"><img src="${IMG(9)}" style="width:100%;display:block">` +
      `<figcaption style="position:absolute;left:0;bottom:0">${BAD[0]}</figcaption></figure>`,
  );
  check("piros iker: a képre ültetett felirat fennakad", ((await page.evaluate(OVERLAP)) as string[]).length === 1);
  const over: string[] = [];
  for (const w of [390, 1280]) {
    await page.setViewportSize({ width: w, height: 900 });
    for (const t of ids) {
      await page.setContent(pages[t]!, { waitUntil: "load" });
      // A tilted polaroid's bounding rect grows a few px into its caption's — decoration,
      // not a caption laid over the photo. Measure the boxes untilted.
      await page.addStyleTag({ content: "*{transform:none!important;rotate:none!important}" });
      const hits = (await page.evaluate(OVERLAP)) as string[];
      if (hits.length) over.push(`${t}@${w}: ${hits[0]}`);
    }
  }
  check("⭐⭐ egyetlen sablonban sem ül felirat a fotón", over.length === 0, over.slice(0, 5).join(" · "));
} finally {
  await browser.close();
}

// ── Quotes in the name survive every attribute (Andy's House ccbea845, 2026-10-27) ──────
// hovamenjek's alt="Andy's House – Geresdlak fotó 11" was read with `["']([^"']*)["']`, which
// stops at the first quote of either kind: all 6 gallery alts of both mocks were "Andy".
console.log("\nidézőjel a névben: forrás-alt → tárolt caption → alt / title / JSON-LD");
{
  const ANDY = "Andy's House";
  const QUOTED = `Kovács "Öreg" & <b>Fiai</b> Vendégház`;
  check("tagAttr: aposztróf dupla idézőjelben", tagAttr(`<img alt="${ANDY} – Geresdlak fotó 11" src="a.jpg">`, "alt") === `${ANDY} – Geresdlak fotó 11`);
  check("tagAttr: idézőjel szimpla idézőjelben", tagAttr(`<img alt='Az "új" terasz' src=a.jpg>`, "alt") === `Az "új" terasz`);
  check("tagAttr: entitások dekódolva (&#39; &quot; &amp; &lt;)", tagAttr(`<img alt="Andy&#39;s &quot;Ház&quot; &amp; &lt;kert&gt;">`, "alt") === `Andy's "Ház" & <kert>`);
  check("tagAttr: idézőjel nélküli érték, és a data-alt nem alt", tagAttr(`<img data-alt="x" src=kep.jpg>`, "src") === "kep.jpg" && tagAttr(`<img data-alt="x">`, "alt") === undefined);
  const page = `<div><img alt="${ANDY} – Geresdlak fotó 11" src="/upload/places/1/fullHd/geresdlak-andys-house12.jpg"><img alt='Az "új" terasz &amp; a kert' data-src="/upload/b.jpg"></div>`;
  const dom = domImages(page, "https://hovamenjek.hu/geresdlak/andys-house");
  check("portál-kinyerő (domImages): a teljes alt a caption", dom[0]?.caption === `${ANDY} – Geresdlak fotó 11` && dom[1]?.caption === `Az "új" terasz & a kert`, dom.map((x) => x.caption));
  const own = ownSiteImages(page, "https://andyshouse.hu/");
  check("saját-oldal kinyerő (ownSiteImages): a teljes alt a caption", own.some((x) => x.caption === `${ANDY} – Geresdlak fotó 11`) && own.some((x) => x.caption === `Az "új" terasz & a kert`), own.map((x) => x.caption));
  // Captions stored before the fix stay "Andy" until a re-scrape: the render replaces them.
  check("tárolt csonk („Andy”) → semleges alt rerendernél", isQuoteCutName("Andy", ANDY) && withoutFilenameAlts([{ alt: "Andy", url: "u" }], ANDY)[0]!.alt === `${ANDY} — 1. kép`);
  check("PIROS IKER: a teljes név és egy valódi caption marad", !isQuoteCutName(ANDY, ANDY) && !isQuoteCutName("Andy kertje", ANDY) && !isQuoteCutName("Kovács", "Kovács Vendégház"));
  check("idézőjeles névnél is felismeri a csonkot", isQuoteCutName("Kovács", QUOTED));
  const bad: string[] = [];
  let seen = 0;
  for (const name of [ANDY, QUOTED]) {
    const caps = [`${name} – Geresdlak fotó 11`, `Az „új" terasz & a kert`];
    const d = {
      ...D,
      name,
      photos: [0, 1, 2, 3, 4, 5].map((i) => ({ url: IMG(i), alt: caps[i % 2]!, provenance: "portal" as const })),
    } as SiteData;
    const first = name.split(/[\s'"]/)[0]!;
    for (const [id, tpl] of Object.entries(TEMPLATES)) {
      const sections = ["hero", "features", "gallery", "rooms", "reviews", "location", "enquiry"].map((kind) => ({ kind }));
      const html = renderSite({ template: id, skin: tpl.skins[0], archetype: "stacked", sections } as never, d, { phase: "mock" });
      for (const m of html.matchAll(/<[a-z][a-z0-9-]*\b[^>]*>/gi)) {
        for (const a of ["alt", "title", "aria-label", "content"]) {
          const v = tagAttr(m[0], a);
          if (!v) continue;
          if (v.includes(name) || caps.some((c) => v.includes(c))) seen++;
          else if (v.startsWith(first)) bad.push(`${id}: ${a}=${JSON.stringify(v)}`);
        }
      }
      if (html.replace(/<script[\s\S]*?<\/script>/gi, "").includes("<b>Fiai")) bad.push(`${id}: nyers <b> a markupban`);
      for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
        try {
          if (!JSON.stringify(JSON.parse(m[1]!)).includes(JSON.stringify(name).slice(1, -1))) bad.push(`${id}: JSON-LD név hiányzik`);
        } catch (e) {
          bad.push(`${id}: JSON-LD nem JSON (${String(e).slice(0, 60)})`);
        }
      }
    }
  }
  check(`minden sablon: alt / title / aria-label / content / JSON-LD épen viszi a nevet (${seen} attribútum mérve)`, bad.length === 0 && seen > 100, bad.slice(0, 5));
}

if (failures) {
  console.error(`\n⛔ photo-caption-check: ${failures} hiba — a fotó-felirat semmit nem mond, vagy a képre ül.`);
  process.exit(1);
}
console.log("\n✅ photo-caption-check: a felirat mond valamit, és a kép alatt áll.");
