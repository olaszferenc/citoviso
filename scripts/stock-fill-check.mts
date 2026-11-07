// stock-fill-check — the mock's stock illustrations (owner rulings 2026-11-07, plan
// assets/design-refs/tenant-site/stock-fill/, engine/stock.ts) keep every hard rule:
//
//   ① stock ONLY in the gallery and on room cards — never the hero, about, band or contact picture;
//   ② MOCK ONLY — the live render, the live photo policy, the tenant asset store and the uploader's
//      md5/dHash bar all refuse it;
//   ③ nothing on the page claims anything about it (alt „Illusztráció”, no subject/bedroom);
//   ④ it never enters the stored photo list (the counts stay the lodging's own);
//   ⑤ deterministic per lead, no picture twice; the gallery's own photos come first;
//   ⑥ a lead with NO own photo gets the typographic hero over a regional landscape, no empty
//      „about” frame — and no stock interior as its cover.
//
//   npx tsx scripts/stock-fill-check.mts        (exit 1 on any failure)

import { readFileSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";

import type { Photo, Recipe, SiteData } from "../src/engine/recipe.js";
import { isLiveSafePhoto, applyLivePhotoPolicy } from "../src/engine/photoPolicy.js";
import { renderSite } from "../src/engine/render.js";
import {
  STOCK_GALLERY_MIN,
  isStockBytes,
  isStockDhash,
  isStockPhoto,
  landscapeCategory,
  stockGallery,
  stockGalleryCategories,
  stockLibrary,
  stockStyle,
} from "../src/engine/stock.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { dHashFromBuffer } from "../src/generator/photoHash.js";
import { StockAssetRefused, getAssetStore } from "../src/tenant/assetStore.js";

let failed = 0;
function check(name: string, ok: boolean, detail?: unknown): void {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failed++;
    console.log(`  ✗ ${name}${detail === undefined ? "" : ` — ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 400)}`}`);
  }
}

const own = (i: number, extra: Partial<Photo> = {}): Photo => ({
  url: `https://stock-check.test/own-${i}.jpg`,
  alt: `Saját fotó ${i}`,
  provenance: "portal",
  subject: i === 0 ? "exterior" : "interior",
  bedroom: false,
  ...extra,
});

function lead(n: number, over: Partial<SiteData> = {}): SiteData {
  return {
    name: "Nyugalom Vendégház",
    tagline: "Csend a domb alatt",
    intro: "Csendes utca végén álló vendégház, saját udvarral és árnyas kerttel.",
    highlights: ["Saját parkoló az udvarban", "Kutyabarát szállás"],
    photos: Array.from({ length: n }, (_, i) => own(i)),
    contact: { email: "a@b.hu", phone: "+36 30 111 2222", address: "Fő utca 12." },
    place: { city: "Köveskál", country: "HU" },
    stockSeed: "0f8b1c2e-0000-4000-8000-000000000001",
    ...over,
  } as SiteData;
}
const recipe = (t: string): Recipe => ({ template: t, skin: "", archetype: "stacked", sections: [] });

const STOCK_RE = /\/assets\/stock\/[a-z-]+\/[a-z0-9-]+\.jpg/g;
/** The page without the gallery modules, the room cards and the lightbox list — where stock may NOT be. */
function outsideAllowed(html: string): string {
  let out = html.replace(/<script type="application\/json" data-cit-photos>[\s\S]*?<\/script>/g, "");
  // Room cards (roomShell) and their details; the gallery module containers.
  for (const marker of ['data-cit-module="gallery"', 'data-cit-module="rooms"', "cit-room__open", "cit-rmore"]) {
    let i = out.indexOf(marker);
    while (i >= 0) {
      const open = out.lastIndexOf("<", i);
      const tag = /^<([a-z0-9]+)/i.exec(out.slice(open))?.[1] ?? "div";
      // Cut to the matching close tag (depth-counted).
      let depth = 0;
      const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
      re.lastIndex = open;
      let end = out.length;
      for (let m = re.exec(out); m; m = re.exec(out)) {
        depth += m[1] ? -1 : 1;
        if (depth === 0) {
          end = m.index + m[0].length;
          break;
        }
      }
      out = out.slice(0, open) + out.slice(end);
      i = out.indexOf(marker);
    }
  }
  return out;
}
/** The page's opening picture: the first image in the body (an <img> or a background-image). */
const heroSrc = (html: string): string | null => {
  const body = html.slice(Math.max(0, html.indexOf("<body")));
  const tagged = /data-cit-hero-img[^>]*\bsrc="([^"]+)"/.exec(body)?.[1];
  if (tagged) return tagged;
  const m = /<img[^>]*\bsrc="([^"]+)"|background-image:\s*url\(['"]?([^'")]+)/.exec(body);
  return m ? (m[1] ?? m[2] ?? null) : null;
};
const jsonLdImages = (html: string): string[] => {
  const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  if (!m) return [];
  const imgs = (m[1]!.match(/"image":\s*\[[^\]]*\]|"image":\s*"[^"]*"/g) ?? []).join(" ");
  return imgs.match(/https?:[^"]+|\/assets\/[^"]+/g) ?? [];
};

console.log("① library + manifest");
const lib = stockLibrary();
check("a manifest legalább 70 képet sorol", lib.length >= 70, lib.length);
const cats = new Set(lib.map((e) => e.category));
for (const c of ["bedroom-rustic", "bedroom-modern", "bathroom", "kitchen", "living", "terrace", "breakfast", "landscape-balaton", "landscape-hills", "landscape-plain", "landscape-village"])
  check(`kategória megvan: ${c}`, cats.has(c as never));
const manifest = JSON.parse(readFileSync("public/assets/stock/manifest.json", "utf8")).images as { file: string; author: string | null; license: string; sourceUrl: string; bytes: number }[];
check("minden képnek van szerzője, licence és forrás-URL-je", manifest.every((e) => e.author && e.license && e.sourceUrl.startsWith("https://images.pexels.com/")));
check("minden kép ≤ 260 KB", manifest.every((e) => e.bytes <= 260_000), manifest.filter((e) => e.bytes > 260_000).map((e) => e.file));

console.log("② style / categories / region");
check("vendégház → rusztikus", stockStyle(lead(2)) === "rustic");
check("„Strand Apartman Keszthely” → modern", stockStyle(lead(2, { name: "Strand Apartman Keszthely" })) === "modern");
check("név nélküli típus, apartman-kiadás → modern", stockStyle(lead(2, { name: "Napfény", sampleUnitKind: "apartments" })) === "modern");
check("reggeli-kép CSAK forrás-jelre", !stockGalleryCategories(lead(1), true).includes("breakfast"));
check("„házi reggeli” → reggeli-kép jöhet", stockGalleryCategories(lead(1, { highlights: ["Házi reggeli a tornácon"] }), true).includes("breakfast"));
check("saját hálókép van → a galéria nem kér stock hálót", !stockGalleryCategories(lead(1), false).some((c) => c.startsWith("bedroom")));
check("Köveskál → hegyvidék", landscapeCategory(lead(0)) === "landscape-hills");
check("Balatonfüred → Balaton", landscapeCategory(lead(0, { place: { city: "Balatonfüred" } })) === "landscape-balaton");
check("Hortobágy → alföld", landscapeCategory(lead(0, { place: { city: "Hortobágy" } })) === "landscape-plain");
check("ismeretlen falu → általános vidék", landscapeCategory(lead(0, { place: { city: "Kisapáti" } })) === "landscape-village");

console.log("③ gallery fill rules");
const g2 = stockGallery(lead(2), true, "Illusztráció");
check(`2 saját kép → ${STOCK_GALLERY_MIN - 2} illusztráció`, g2.length === STOCK_GALLERY_MIN - 2, g2.length);
check("az illusztráció jelölt: stock + generated + alt „Illusztráció”, subject/bedroom nélkül", g2.every((p) => p.stock && p.provenance === "generated" && p.alt === "Illusztráció" && p.subject === undefined && p.bedroom === undefined));
check("0 saját kép → nincs galéria-illusztráció (a stock nem lehet borító)", stockGallery(lead(0), true, "x").length === 0);
check(`${STOCK_GALLERY_MIN} saját kép → nincs illusztráció`, stockGallery(lead(STOCK_GALLERY_MIN), true, "x").length === 0);
check("determinisztikus (ugyanaz a lead → ugyanazok a képek)", JSON.stringify(stockGallery(lead(2), true, "x")) === JSON.stringify(stockGallery(lead(2), true, "x")));
check("másik lead → más sorrend", JSON.stringify(stockGallery(lead(2), true, "x")) !== JSON.stringify(stockGallery(lead(2, { stockSeed: "another-lead" }), true, "x")));

console.log("④ rendered mock, every template — stock only in the gallery and on room cards");
for (const t of Object.keys(TEMPLATES)) {
  const d = lead(2);
  const html = renderSite(recipe(t), d, { phase: "mock" });
  const all = html.match(STOCK_RE) ?? [];
  const leak = outsideAllowed(html).match(STOCK_RE) ?? [];
  const hero = heroSrc(html);
  check(`${t}: van illusztráció a lapon`, all.length > 0, all.length);
  check(`${t}: illusztráció CSAK galériában / szobakártyán`, leak.length === 0, leak);
  check(`${t}: a hero a saját kép`, !hero || !hero.includes("/assets/stock/"), hero);
  check(`${t}: a JSON-LD image-ben nincs illusztráció`, !jsonLdImages(html).some((u) => u.includes("/assets/stock/")));
  check(`${t}: a tárolt photos érintetlen (2 saját)`, d.photos.length === 2 && !d.photos.some((p) => isStockPhoto(p)));
  // Each picture once on the page (the lightbox list repeats the gallery by design).
  const visible = html.replace(/<script type="application\/json" data-cit-photos>[\s\S]*?<\/script>/g, "");
  const imgSrcs = [...visible.matchAll(/<img[^>]*\bsrc="(\/assets\/stock\/[^"]+)"/g)].map((m) => m[1]!);
  const counts = new Map<string, number>();
  for (const u of imgSrcs) counts.set(u, (counts.get(u) ?? 0) + 1);
  const dup = [...counts].filter(([, n]) => n > 1);
  // Templates that repeat their own gallery (a marquee/loop) double every picture alike; a
  // DIFFERENT picture appearing twice in one place would be the defect — so the rule is: no stock
  // picture more often than the lodging's own first gallery photo.
  const ownRepeat = (visible.match(/https:\/\/stock-check\.test\/own-1\.jpg/g) ?? []).length || 1;
  check(`${t}: nincs ismétlődő illusztráció`, dup.every(([, n]) => n <= ownRepeat), dup);
}

console.log("⑤ own photos lead the gallery (galleryOrder templates)");
{
  // 3 own photos: #0 is the hero, #1 the about picture, #2 is seen nowhere else → it opens the gallery.
  const html = renderSite(recipe("wordmark-grow"), lead(3), { phase: "mock" });
  const gal = /data-cit-module="gallery"[\s\S]*?<\/section>/.exec(html)?.[0] ?? "";
  const firstStock = gal.search(/\/assets\/stock\//);
  const unseen = gal.indexOf("stock-check.test/own-2");
  check("wordmark-grow: a még nem látott saját kép a galéria elején, előbb mint az illusztráció", unseen >= 0 && firstStock > unseen, { unseen, firstStock });
}

console.log("⑥ no own photo → typographic hero, no empty about frame");
{
  const html = renderSite(recipe("wordmark-grow"), lead(0), { phase: "mock" });
  check("betűs hero (w-hero--type)", html.includes("w-hero--type"));
  check("mögötte hegyvidéki táj (Köveskál)", /w-hero-back" src="\/assets\/stock\/landscape-hills\//.test(html));
  check("a táj vízjeles könyvtári kép, nem belső tér", !/w-hero-back" src="\/assets\/stock\/(?:bedroom|bathroom|kitchen|living|terrace|breakfast)/.test(html));
  check("a név a heróban", /<header class="w-hero w-hero--type">[\s\S]*?<h1>Nyugalom Vendégház<\/h1>/.test(html));
  check("nincs üres „rólunk” képkeret", /w-row w-row--solo/.test(html) && !/<section id="cit-about">[\s\S]*?class="w-fig"/.test(html.split("</section>")[0] + "</section>"));
  check("a szobakártya hálószoba-illusztrációt visel", /alt="Illusztráció — [^"]+"[^>]*>|src="\/assets\/stock\/bedroom-/.test(html));
  check("nincs galéria-illusztráció 0 saját képnél", !(/data-cit-module="gallery"[\s\S]*?\/assets\/stock\//.test(html)));
  check("egyetlen üres ikonos képkeret sincs a lapon (cit-fill)", !html.includes('class="cit-fill"'), (html.match(/class="cit-fill" role="img" aria-label="[^"]*"/g) ?? []).slice(0, 3));
}

console.log("⑦ never live");
{
  const stockPhoto: Photo = { url: "/assets/stock/bathroom/bathroom-7005268.jpg", alt: "x", provenance: "generated", stock: true };
  const flagless: Photo = { url: "https://citoviso.com/assets/stock/bathroom/bathroom-7005268.jpg", alt: "x", provenance: "owner" };
  check("isLiveSafePhoto: stock → NEM, nyilatkozattal sem", !isLiveSafePhoto(stockPhoto, true));
  check("isLiveSafePhoto: jelző nélkül, URL alapján is NEM", !isLiveSafePhoto(flagless, true));
  const d = lead(2, { photos: [own(0), stockPhoto, own(1)], rooms: [{ name: "1. szoba", photo: stockPhoto }] });
  const pol = applyLivePhotoPolicy(d, true);
  check("applyLivePhotoPolicy: a stock kikerül a galériából és a szobáról", !pol.photos.some(isStockPhoto) && !pol.rooms?.[0]?.photo);
  for (const t of ["parallax", "gate-opening", "wordmark-grow"]) {
    const live = renderSite(recipe(t), lead(2, { photos: [own(0), stockPhoto, own(1)] }), { phase: "live" });
    check(`${t} LIVE: egyetlen illusztráció sincs a lapon`, !STOCK_RE.test(live) && !live.includes("/assets/stock/"));
    STOCK_RE.lastIndex = 0;
  }
  const mockWithStored = renderSite(recipe("parallax"), lead(2, { photos: [stockPhoto, own(0), own(1)] }), { phase: "mock" });
  check("egy tárolt stock-kép a MOCKON sem lehet hero", !(heroSrc(mockWithStored) ?? "").includes("/assets/stock/"));
}

console.log("⑧ uploader / asset store bar");
{
  const file = path.join("public/assets/stock", lib[0]!.file);
  const buf = readFileSync(file);
  check("a könyvtári fájl bájtra → tiltott (md5)", isStockBytes(buf));
  const reenc = await sharp(buf).resize(1200).jpeg({ quality: 70 }).toBuffer();
  check("átméretezett, újrakódolt másolat → tiltott (dHash)", isStockDhash(await dHashFromBuffer(reenc)));
  const other = await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 30, g: 120, b: 60 } } })
    .composite([{ input: Buffer.from('<svg width="800" height="600"><circle cx="300" cy="260" r="180" fill="white"/></svg>') }])
    .jpeg()
    .toBuffer();
  check("egy saját (nem könyvtári) kép → átmegy", !isStockBytes(other) && !isStockDhash(await dHashFromBuffer(other)));
  let refused = false;
  try {
    await getAssetStore().save("stock-fill-check", "jpg", buf);
  } catch (e) {
    refused = e instanceof StockAssetRefused;
  }
  check("assetStore.save: a könyvtári fájlt NEM menti (StockAssetRefused)", refused);
  // Every library file, not just the first: md5 + own dHash.
  const misses: string[] = [];
  for (const e of lib) {
    const b = readFileSync(path.join("public/assets/stock", e.file));
    if (!isStockBytes(b) || !isStockDhash(await dHashFromBuffer(b))) misses.push(e.file);
  }
  check("a könyvtár MINDEN fájlja a tiltólistán", misses.length === 0, misses);
}

console.log(failed ? `\n✗ ${failed} hiba` : "\n✓ stock-fill-check: minden rendben");
process.exit(failed ? 1 : 0);
