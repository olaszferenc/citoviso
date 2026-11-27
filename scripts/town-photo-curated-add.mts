// Adds hand-picked, freely licensed Wikimedia Commons pictures to the curated town library (src/media/townCurated.json,
// ADR-0508). Reads each file's author, licence, size and a 1920/1280 px thumbnail from the Commons API, computes the
// near-duplicate hash, refuses a non-free licence (NC / ND / none) and a hero under 1600 px or narrower than 1.3:1,
// and judges every picture with the render gate's own town rule (media/townPick.judgeTownPicture on the 330 px
// thumbnail the gate re-judges): a hero at its tier as a hero, a gallery picture as the gate judges a local picture.
// A picture the gate would fail never enters the library.
//
//   npx tsx scripts/town-photo-curated-add.mts <spec.json> [--check]
//
// spec.json: { "towns": [ { "country": "HU", "city": "Szarvas", "style": "rural", "note": "…",
//                           "heroes":  [ { "title": "File:….jpg", "tier": "town", "bucket": "landscape" } ],
//                           "gallery": [ { "title": "File:….jpg", "tier": "region", "bucket": "sight" } ] } ] }
// A town already in the library is replaced as a whole (the spec is the town's full curated list).
// --check prints what it would write and writes nothing.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dHashFromBuffer } from "../src/generator/photoHash.js";
import { judgeTownPicture } from "../src/media/townPick.js";
import { townKey, townName } from "../src/media/townPhotoSet.js";
import type { CuratedTown } from "../src/media/townCurated.js";
import type { GalleryBucket, TownPick, TownStyle, TownTier } from "../src/media/townPick.js";

interface SpecPic {
  readonly title: string;
  readonly tier: TownTier;
  readonly bucket: GalleryBucket;
}
interface SpecTown {
  readonly country: string;
  readonly city: string;
  readonly style: TownStyle;
  readonly note: string;
  readonly heroes: readonly SpecPic[];
  readonly gallery: readonly SpecPic[];
}

const LIB = fileURLToPath(new URL("../src/media/townCurated.json", import.meta.url));
const UA = { "user-agent": "citoviso-town-library/1.0 (curated picture metadata)" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchRetry(url: string): Promise<Response> {
  for (let i = 0; ; i++) {
    await sleep(1200);
    const r = await fetch(url, { headers: UA });
    if (r.status !== 429 || i >= 5) return r;
    await sleep(10000 * (i + 1));
  }
}

const strip = (html: string): string => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

async function pickOf(p: SpecPic, hero: boolean): Promise<TownPick> {
  const width = hero ? 1920 : 1280;
  const q = new URLSearchParams({ action: "query", titles: p.title, prop: "imageinfo", iiprop: "url|size|extmetadata|mime", iiurlwidth: String(width), format: "json" });
  const r = await fetchRetry(`https://commons.wikimedia.org/w/api.php?${q}`);
  if (!r.ok) throw new Error(`${p.title}: Commons ${r.status}`);
  const page = Object.values(((await r.json()) as { query: { pages: Record<string, { imageinfo?: Record<string, unknown>[] }> } }).query.pages)[0];
  const ii = page?.imageinfo?.[0] as { width: number; height: number; thumburl?: string; url: string; descriptionurl: string; extmetadata?: Record<string, { value?: string }> } | undefined;
  if (!ii) throw new Error(`${p.title}: nincs ilyen fájl`);
  const md = ii.extmetadata ?? {};
  const license = strip(md.LicenseShortName?.value ?? "");
  if (!/CC BY|CC0|public domain|^PD/i.test(license) || /\bNC\b|\bND\b/.test(license)) throw new Error(`${p.title}: nem szabad licenc („${license}”)`);
  const heroOk = ii.width >= 1600 && ii.width / ii.height >= 1.3;
  if (hero && !heroOk) throw new Error(`${p.title}: nyitóképnek kicsi vagy nem fekvő (${ii.width}×${ii.height})`);
  const url = ii.width > width && ii.thumburl ? ii.thumburl : ii.url;
  const img = await fetchRetry(url);
  if (!img.ok) throw new Error(`${p.title}: a kép nem tölthető le (${img.status})`);
  const dhash = await dHashFromBuffer(Buffer.from(await img.arrayBuffer())).catch(() => undefined);
  const small = url.replace(/\/(?:960|1280|1920)px-/, "/330px-");
  const sm = small === url ? img : await fetchRetry(small);
  const judged = sm.ok ? await judgeTownPicture(Buffer.from(await (small === url ? (await fetchRetry(url)) : sm).arrayBuffer()), hero ? p.tier : "town", hero) : null;
  if (!judged) throw new Error(`${p.title}: a településkép-szabály nem futtatható (nincs modell / nincs kép)`);
  if (!judged.ok) throw new Error(`${p.title}: a render-kapu településkép-szabálya megfogná (${judged.reason})`);
  return {
    url,
    title: p.title.replace(/^File:/, ""),
    pageUrl: ii.descriptionurl,
    author: strip(md.Artist?.value ?? "") || "ismeretlen", // i18n-exempt: data, the credit line's own value
    license,
    ...(md.LicenseUrl?.value ? { licenseUrl: md.LicenseUrl.value } : {}),
    tier: p.tier,
    score: 1,
    bucket: p.bucket,
    ...(dhash ? { dhash } : {}),
    heroOk,
    judge: { verdict: "jó", reason: "kézi válogatás a kurált tárba (tulaj 2026-11-27)" },
  };
}

const args = process.argv.slice(2);
const specPath = args.find((a) => !a.startsWith("--"));
if (!specPath) {
  console.error("használat: town-photo-curated-add.mts <spec.json> [--check]"); // i18n-exempt: operator log
  process.exit(2);
}
const spec = JSON.parse(readFileSync(specPath, "utf8")) as { towns: SpecTown[] };
let lib: { towns: CuratedTown[] } = { towns: [] };
try {
  lib = JSON.parse(readFileSync(LIB, "utf8")) as { towns: CuratedTown[] };
} catch {
  /* a new library */
}
for (const t of spec.towns) {
  const heroes: TownPick[] = [];
  const gallery: TownPick[] = [];
  for (const p of t.heroes) heroes.push(await pickOf(p, true));
  for (const p of t.gallery) gallery.push(await pickOf(p, false));
  const name = townName(t.city);
  const entry: CuratedTown = { country: t.country.toUpperCase(), cityKey: townKey(name), city: name, style: t.style, heroes, gallery, note: t.note };
  lib.towns = [...lib.towns.filter((x) => !(x.country === entry.country && x.cityKey === entry.cityKey)), entry];
  console.log(`✓ ${entry.country} ${entry.city}: ${heroes.length} nyitókép · ${gallery.length} galériakép`); // i18n-exempt: operator log
}
lib.towns.sort((a, b) => a.country.localeCompare(b.country) || a.cityKey.localeCompare(b.cityKey));
if (args.includes("--check")) console.log(JSON.stringify(lib, null, 1).slice(0, 4000));
else writeFileSync(LIB, `${JSON.stringify(lib, null, 1)}\n`);
