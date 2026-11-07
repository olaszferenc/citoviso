// Builds the local stock-photo library the MOCK uses to fill missing image slots
// (owner ruling 2026-11-07: „ha már hero kép van, stock fotókkal töltsük fel a hiányzókat”).
//
//   npx tsx scripts/stock-build.mts [--authors <file.json>] [--only <category>]
//
// Source: Pexels (Pexels License — free for commercial use, no attribution required), fetched
// straight from the images.pexels.com CDN, NO API key. Every file is:
//   ① cropped to 3:2 and scaled to 1600 px wide,
//   ② WATERMARKED IN THE PIXELS (owner, 2026-11-07): a diagonal, repeating
//      „MINTAKÉP · ILLUSZTRÁCIÓ” pattern over the whole picture and a large „MINTA” stamp in
//      the middle — strong on purpose, so a downloaded copy is never a clean stock photo and
//      nobody mistakes it for the lodging's own picture. A CSS layer would vanish on download.
//   ③ JPEG-encoded to ~200 KB.
// The manifest (public/assets/stock/manifest.json) records per file: source URL, page URL,
// author, licence, md5 of the published file and dHashes of the published AND the clean
// source picture. The md5/dHash list is the tenant uploader's blocklist (src/engine/stock.ts):
// a stock picture can never become a tenant asset, watermarked or not.
//
// The selection below was reviewed by eye (no person, no text, no watermark, no brand, fits a
// Hungarian countryside lodging) on 2026-11-07. Re-running is idempotent per file.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";

import { dHashFromBuffer } from "../src/generator/photoHash.js";

const ROOT = path.resolve(process.cwd(), "public/assets/stock");
const MANIFEST = path.join(ROOT, "manifest.json");
const WIDTH = 1600;
const HEIGHT = 1067;
const TARGET_BYTES = 210_000;

/** Reviewed Pexels photo ids per category. */
const SELECTION: Record<string, readonly number[]> = {
  "bedroom-rustic": [14465274, 15692775, 262048, 5002329, 7765002, 1743229, 6510425, 6752295, 30708776, 5825584],
  "bedroom-modern": [19836844, 5998132, 19899089, 4177628, 5461582, 6186819, 6289053, 7031207, 12289356, 7055757, 8186507, 37192232],
  bathroom: [7005268, 7614405, 6316060, 7005460, 8089093, 30767882, 30708774, 3620234, 6957082, 35527001, 19776463, 10099090],
  kitchen: [10153052, 7167993, 4713242, 26571201, 19857237, 19345426, 7535076, 7031214],
  living: [5825398, 4846106, 12285892, 5998040, 6636320, 7746949, 7746106, 7174392, 17181934, 28345539],
  terrace: [17418139, 18023659, 32573453, 7487005, 5967865, 8559656, 26894082],
  breakfast: [38166921, 18762746, 25781659, 2930966, 18535645, 2662875, 6666647],
  "landscape-balaton": [15227988, 2091351, 29202983, 29006673, 15872275],
  "landscape-hills": [168066, 32578076, 25225795, 18312864],
  "landscape-plain": [1095831, 64102],
  "landscape-village": [20597613, 33943997],
};

export interface StockManifestEntry {
  readonly file: string;
  readonly category: string;
  readonly sourceUrl: string;
  readonly pageUrl: string;
  readonly author: string | null;
  readonly authorUrl: string | null;
  readonly license: string;
  readonly licenseUrl: string;
  readonly md5: string;
  readonly dhash: string;
  readonly sourceDhash: string;
  readonly bytes: number;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

type AuthorRow = { photographer?: string | null; username?: string | null; pageUrl?: string | null };
const authorsFile = arg("--authors");
const authors: Record<string, AuthorRow> = authorsFile ? JSON.parse(readFileSync(authorsFile, "utf8")) : {};
const only = arg("--only");

const previous: StockManifestEntry[] = existsSync(MANIFEST)
  ? (JSON.parse(readFileSync(MANIFEST, "utf8")).images as StockManifestEntry[])
  : [];
const prevByFile = new Map(previous.map((e) => [e.file, e]));

/** The burned-in watermark: a diagonal repeating pattern + a centred stamp. */
function watermarkSvg(): Buffer {
  const line = "MINTAKÉP · ILLUSZTRÁCIÓ · MINTAKÉP · ILLUSZTRÁCIÓ · MINTAKÉP · ILLUSZTRÁCIÓ";
  const rows: string[] = [];
  // Rows are drawn in a rotated group larger than the frame, so the corners are covered too.
  for (let i = -14; i <= 14; i++) {
    const y = i * 118;
    const x = (i % 2) * -260 - 900;
    rows.push(`<text x="${x}" y="${y}">${line}</text>`);
  }
  const font = `font-family="DejaVu Sans, Arial, sans-serif" font-weight="bold"`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">` +
      `<g transform="translate(${WIDTH / 2} ${HEIGHT / 2}) rotate(-28)" ${font} font-size="44" ` +
      `fill="white" fill-opacity="0.5" stroke="black" stroke-opacity="0.55" stroke-width="1.6" letter-spacing="3">` +
      rows.join("") +
      `</g>` +
      `<g transform="translate(${WIDTH / 2} ${HEIGHT / 2}) rotate(-12)">` +
      `<rect x="-470" y="-165" width="940" height="330" rx="34" fill="black" fill-opacity="0.28" ` +
      `stroke="white" stroke-opacity="0.92" stroke-width="16"/>` +
      `<rect x="-440" y="-135" width="880" height="270" rx="22" fill="none" stroke="white" stroke-opacity="0.7" stroke-width="5"/>` +
      `<text x="0" y="86" text-anchor="middle" ${font} font-size="250" letter-spacing="24" ` +
      `fill="white" fill-opacity="0.9" stroke="black" stroke-opacity="0.65" stroke-width="5">MINTA</text>` +
      `</g></svg>`,
  );
}

async function encode(img: sharp.Sharp): Promise<Buffer> {
  let out = Buffer.alloc(0);
  for (const q of [80, 74, 68, 62, 56, 50, 44]) {
    out = await img.clone().jpeg({ quality: q, mozjpeg: true, progressive: true }).toBuffer();
    if (out.length <= TARGET_BYTES) break;
  }
  return out;
}

const mark = watermarkSvg();
const entries: StockManifestEntry[] = [];
for (const [category, ids] of Object.entries(SELECTION)) {
  if (only && only !== category) {
    entries.push(...previous.filter((e) => e.category === category));
    continue;
  }
  mkdirSync(path.join(ROOT, category), { recursive: true });
  for (const id of ids) {
    const file = `${category}/${category}-${id}.jpg`;
    const sourceUrl = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=2400`;
    const res = await fetch(sourceUrl);
    if (!res.ok) throw new Error(`${file}: ${res.status} ${sourceUrl}`);
    const src = Buffer.from(await res.arrayBuffer());
    const framed = await sharp(src)
      .rotate()
      .resize(WIDTH, HEIGHT, { fit: "cover", position: sharp.strategy.attention })
      .toBuffer();
    const out = await encode(sharp(framed).composite([{ input: mark }]));
    writeFileSync(path.join(ROOT, file), out);
    const prev = prevByFile.get(file);
    const a = authors[String(id)] ?? {};
    const author = a.photographer ?? prev?.author ?? null;
    const username = a.username ?? null;
    entries.push({
      file,
      category,
      sourceUrl,
      pageUrl: a.pageUrl ?? prev?.pageUrl ?? `https://www.pexels.com/photo/${id}/`,
      author,
      authorUrl: username ? `https://www.pexels.com/@${username.replace(/^@/, "")}/` : (prev?.authorUrl ?? null),
      license: "Pexels License (free for commercial use, no attribution required)",
      licenseUrl: "https://www.pexels.com/license/",
      md5: createHash("md5").update(out).digest("hex"),
      dhash: await dHashFromBuffer(out),
      sourceDhash: await dHashFromBuffer(framed),
      bytes: out.length,
    });
    console.log(`${file}  ${(out.length / 1024).toFixed(0)} KB  ${author ?? "—"}`);
  }
}

writeFileSync(
  MANIFEST,
  JSON.stringify(
    {
      note:
        "Mock-only illustration photos, watermarked in the pixels. NEVER a hero, NEVER on a live/tenant site " +
        "(src/engine/stock.ts gates). Built by scripts/stock-build.mts.",
      builtAt: new Date().toISOString().slice(0, 10),
      images: entries,
    },
    null,
    2,
  ) + "\n",
);
console.log(`${entries.length} kép → ${path.relative(process.cwd(), MANIFEST)}`);
