// LOCAL PHOTO CLASSIFIER — "is this a picture of the lodging?" (owner 2026-11-24: „mehet”).
//
// WHY: a portal listing's gallery is the landlord's own upload, and it holds more than the lodging:
// the village church, the castle on the hill, the house rules, the floor plan, a spa's discount
// card, the toilet. On the 78 new mocks of 11-24, 15 showed such a picture as the lodging's own.
// The paid vision verdict (heroPick.ts) covered 32 of their 539 photos; the hovamenjek file name
// does not tell them apart either (measured: "<town>-N.jpg" was the lodging's own bedroom).
//
// HOW: CLIP ViT-B/32 (vision encoder, int8 ONNX) runs here on the CPU through onnxruntime-node —
// the depth hero's runtime, no new package, no API, no cost. The label prompts were embedded once
// with the matching text encoder (photoKindLabels.json); a photo is scored against all of them
// (cosine × 100, softmax — the zero-shot recipe) and the probability mass of each kind decides.
// Measured on 51 photos of 8 of those mocks (11-24, ~0.6 s/photo on this box): every floor plan,
// house-rules scan, discount card, toilet and the castle view crossed 0.6; the one false alarm was
// a lodging's own yard with the church tower behind it ("sight", hero) — hence the hero exception.
//
// No model file → null (no claim). The CALLER decides what absence means: the generator goes on,
// the send gate refuses (an unchecked page does not go out).

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ort from "onnxruntime-node";
import sharp from "sharp";
import { config } from "../config.js";
import { readPhotoText } from "./photoText.js";
import LABELS from "./photoKindLabels.json" with { type: "json" };

/**
 * "ok" = the lodging; "sight" = a sight of the area; "never" = a document, plan, ad, toilet, map, logo,
 * person; "junk" = anything else that is not surely the lodging (a locomotive, a car, a dog, a plate of
 * food, a cushion close-up, a fridge) or a photo too small, too dark or too blurred to show it.
 */
export type PhotoKindClass = "ok" | "sight" | "never" | "junk";

/** Pixel measurements behind the quality rule (long edge px, mean luma 0–255, Laplacian variance). */
export interface PhotoQuality {
  readonly long: number;
  readonly luma: number;
  readonly lap: number;
  /** Shorter edge in px (EXIF-rotated). */
  readonly short?: number;
  /** Mean luma of the TOP fifth (the sky outdoors): a night shot has a dark sky. */
  readonly top?: number;
}

export interface PhotoKind {
  readonly kind: PhotoKindClass;
  /** Best label and its probability (for the operator log). */
  readonly label: string;
  readonly score: number;
  /** Probability mass per class. */
  readonly sight: number;
  readonly never: number;
  /** Probability mass of the lodging labels (kind "ok"). */
  readonly ok?: number;
  readonly quality?: PhotoQuality;
  /** Operator-facing Hungarian reason when kind is "junk". */
  readonly why?: string;
  /** Probability per label (photoKindLabels.json order-independent, keyed by label). */
  readonly probs: Readonly<Record<string, number>>;
}

/** A class at or above this mass takes the photo off the page. */
export const PHOTO_KIND_THRESHOLD = 0.6;
/**
 * ALLOW-LIST, NOT A BLOCK-LIST (owner 2026-11-25: „Ugyanúgy kimenne a piros mozdony”). The 8 "never"
 * labels let everything else through — a locomotive, a car, a dog, a plate of food, a cushion close-up.
 * A photo now stays only when its best label is a lodging label AND the lodging labels together hold
 * at least this mass. Measured 11-25 on 309 hand-labelled photos (the 18 sample mocks' 270 + 39 junk
 * pictures): the block-list caught 15 of 60 junk photos; this rule catches 55 and drops 12 of 219
 * good ones, half of them weak anyway (the house from the street behind bins, a house hidden by trees).
 */
export const PHOTO_OK_MIN = 0.4;
/** Quality floor (same measurement): smaller, darker or blurrier photos are junk even when they show the lodging. */
export const PHOTO_MIN_LONG_EDGE = 400;
export const PHOTO_MIN_LUMA = 50;
/** Laplacian variance at 512 px: sharp photos ≥ 230 (a smooth sunset 48), a 3 px Gaussian blur ~32. */
export const PHOTO_MIN_SHARPNESS = 35;
/** Bump when the labels or the threshold change: cached verdicts of an older version are re-scored. */
const VERSION = 10;

const SIZE = 224;
const MEAN = [0.48145466, 0.4578275, 0.40821073] as const;
const STD = [0.26862954, 0.26130258, 0.27577711] as const;
const CACHE_DIR = path.resolve(process.cwd(), "sites/_outreach-shots/_photokind");

let session: Promise<ort.InferenceSession> | null = null;

/** Is the local model present (the send gate refuses without it)? */
export function photoKindAvailable(): boolean {
  return existsSync(path.resolve(process.cwd(), config.photoKindModelPath));
}

function getSession(): Promise<ort.InferenceSession> {
  session ??= ort.InferenceSession.create(path.resolve(process.cwd(), config.photoKindModelPath), {
    intraOpNumThreads: 2,
    interOpNumThreads: 1,
    graphOptimizationLevel: "all",
  });
  return session;
}

/** CLIP preprocessing: shortest edge → 224 (bicubic), centre crop 224, rescale, normalise, CHW. */
async function pixels(buf: Buffer): Promise<Float32Array> {
  const raw = await sharp(buf)
    .rotate()
    .removeAlpha()
    .toColourspace("srgb")
    .resize(SIZE, SIZE, { fit: "cover", position: "centre", kernel: "cubic" })
    .raw()
    .toBuffer();
  const out = new Float32Array(3 * SIZE * SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    for (let c = 0; c < 3; c++) out[c * SIZE * SIZE + i] = ((raw[i * 3 + c] ?? 0) / 255 - MEAN[c]!) / STD[c]!;
  }
  return out;
}

// VERDICT CACHE BY BYTES (2026-11-25). The send gate and the 18-mock fixture gate classify the same
// portal photos on every run (~30 s per mock, measured), and the fixture gate runs on every commit,
// land and deploy. A verdict is a pure function of: the image bytes, this file and photoText.ts (the
// rules and thresholds — hashed, so a rule change can never be served a stale verdict even without a
// VERSION bump), the label embeddings, the model file, the Tesseract data and the versions of the
// three native/wasm packages. All of them are in the key; if any of them cannot be read, nothing is
// cached (classified fresh, as before). Only non-null verdicts are stored.
let codeKeyMemo: string | null | undefined;
function codeKey(): string | null {
  if (codeKeyMemo !== undefined) return codeKeyMemo;
  try {
    const h = createHash("sha256");
    h.update(`v${VERSION}\0`);
    const here = fileURLToPath(import.meta.url);
    for (const f of [here, path.join(path.dirname(here), "photoText.ts")]) h.update(readFileSync(f)).update("\0");
    h.update(JSON.stringify(LABELS)).update("\0");
    h.update(readFileSync(path.resolve(process.cwd(), config.photoKindModelPath))).update("\0");
    const tess = path.resolve(process.cwd(), path.dirname(config.photoKindModelPath), "tessdata");
    if (existsSync(tess)) {
      for (const f of readdirSync(tess).sort()) h.update(`${f}:${readFileSync(path.join(tess, f)).length}:${statSync(path.join(tess, f)).mtimeMs}\0`);
    }
    for (const pkg of ["onnxruntime-node", "sharp", "tesseract.js"]) {
      h.update(`${pkg}@${JSON.parse(readFileSync(path.resolve(process.cwd(), "node_modules", pkg, "package.json"), "utf8")).version}\0`);
    }
    codeKeyMemo = h.digest("hex");
  } catch {
    codeKeyMemo = null;
  }
  return codeKeyMemo;
}

/**
 * The CLIP image embedding of image bytes (unnormalised, as the model gives it) — shared with the
 * town-photo picker (media/townPick.ts), which scores the same embedding against its own labels.
 * Null when the model is missing or the bytes are not an image.
 */
export async function clipImageEmbedding(buf: Buffer): Promise<Float32Array | null> {
  if (!photoKindAvailable()) return null;
  let input: Float32Array;
  try {
    input = await pixels(buf);
  } catch {
    return null;
  }
  const sess = await getSession();
  const res = await sess.run({ pixel_values: new ort.Tensor("float32", input, [1, 3, SIZE, SIZE]) });
  return res.image_embeds!.data as Float32Array;
}

/** Classify image bytes. Null when the model is missing or the bytes are not an image. */
export async function classifyPhotoBuffer(buf: Buffer): Promise<PhotoKind | null> {
  if (!photoKindAvailable()) return null;
  const ck = codeKey();
  const file = ck ? path.join(CACHE_DIR, `buf-${createHash("sha256").update(ck).update(buf).digest("hex")}.json`) : null;
  if (file) {
    try {
      return JSON.parse(await readFile(file, "utf8")) as PhotoKind;
    } catch {
      // not cached yet
    }
  }
  const v = await classifyPhotoBufferFresh(buf);
  if (v && file) {
    await mkdir(CACHE_DIR, { recursive: true }).catch(() => undefined);
    await writeFile(file, JSON.stringify(v)).catch(() => undefined);
  }
  return v;
}

async function classifyPhotoBufferFresh(buf: Buffer): Promise<PhotoKind | null> {
  const emb = await clipImageEmbedding(buf);
  if (!emb) return null;
  const norm = Math.hypot(...emb);
  const logits = LABELS.labels.map((l) => (100 * l.embed.reduce((a, x, i) => a + x * (emb[i] ?? 0), 0)) / norm);
  const max = Math.max(...logits);
  const exps = logits.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  const probs = exps.map((e) => e / sum);
  let best = 0;
  probs.forEach((p, i) => {
    if (p > probs[best]!) best = i;
  });
  const mass = (k: string): number => probs.reduce((a, p, i) => a + (LABELS.labels[i]!.kind === k ? p : 0), 0);
  const sight = mass("sight");
  const never = mass("never");
  const ok = mass("ok");
  const top = LABELS.labels[best]!;
  const quality = await measureQuality(buf).catch(() => null);
  let kind: PhotoKindClass = never >= PHOTO_KIND_THRESHOLD ? "never" : sight >= PHOTO_KIND_THRESHOLD ? "sight" : "ok";
  let why: string | undefined;
  if (kind === "ok" && (ok < PHOTO_OK_MIN || top.kind !== "ok")) {
    if (top.kind === "sight") kind = "sight";
    else if (top.kind === "never") kind = "never";
    else {
      kind = "junk";
      why = `nem biztosan szállás-kép (${top.label})`;
    }
  }
  if (kind === "ok" && quality) {
    if (quality.long < PHOTO_MIN_LONG_EDGE) why = `túl kicsi kép (${quality.long} px)`;
    else if (quality.luma < PHOTO_MIN_LUMA) why = `túl sötét kép (fényerő ${Math.round(quality.luma)})`;
    else if (quality.lap < PHOTO_MIN_SHARPNESS) why = `elmosódott kép (élesség ${Math.round(quality.lap)})`;
    if (why) kind = "junk";
  }
  // A date stamp burned into the photo (Virágeső „2011/08/26”, quality colleague 11-25): junk, read
  // only for photos that would otherwise stay (Tesseract, local — media/photoText.ts).
  if (kind === "ok") {
    const t = await readPhotoText(buf).catch(() => null);
    if (t?.dateStamp) {
      kind = "junk";
      why = `dátumbélyegző a fotón (${t.dateStamp})`;
    } else if (t && signWords(t.words).length) {
      // A sign / lettering in the picture — „SI VILLA” on the wall, a Schwarzkopf board, „WELLNESS HOTEL”, a portal
      // ad with a logo (quality colleagues 11-26: it went to the letter's edge, the contact block, the gallery):
      // off every slot, not only the hero.
      kind = "junk";
      why = `felirat a fotón (${signWords(t.words).slice(0, 3).join(" ")})`;
    }
  }
  const byLabel: Record<string, number> = {};
  LABELS.labels.forEach((l, i) => {
    byLabel[l.label] = +probs[i]!.toFixed(4);
  });
  return {
    kind,
    label: top.label,
    score: probs[best]!,
    sight,
    never,
    ok: +ok.toFixed(4),
    ...(quality ? { quality } : {}),
    ...(why ? { why } : {}),
    probs: byLabel,
  };
}

/** Long edge, mean luma and sharpness (Laplacian variance of the greyscale image at 512 px). */
export async function measureQuality(buf: Buffer): Promise<PhotoQuality> {
  const meta = await sharp(buf).metadata();
  const rotated = (meta.orientation ?? 1) >= 5;
  const long = Math.max((rotated ? meta.height : meta.width) ?? 0, (rotated ? meta.width : meta.height) ?? 0);
  const short = Math.min((rotated ? meta.height : meta.width) ?? 0, (rotated ? meta.width : meta.height) ?? 0);
  const g = await sharp(buf).rotate().greyscale().resize(512, 512, { fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = g.info;
  const d = g.data;
  let sum = 0;
  for (let i = 0; i < d.length; i++) sum += d[i]!;
  let ls = 0;
  let ls2 = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const l = 4 * d[i]! - d[i - 1]! - d[i + 1]! - d[i - w]! - d[i + w]!;
      ls += l;
      ls2 += l * l;
      n++;
    }
  }
  const lap = n ? ls2 / n - (ls / n) ** 2 : 0;
  const topRows = Math.max(1, Math.round(h * 0.2));
  let ts = 0;
  for (let i = 0; i < topRows * w; i++) ts += d[i]!;
  return { long, short, luma: +(sum / Math.max(1, d.length)).toFixed(1), lap: +lap.toFixed(1), top: +(ts / (topRows * w)).toFixed(1) };
}

/** Classify a photo URL; the verdict is cached on disk per URL (a portal photo does not change). */
export async function classifyPhotoUrl(url: string, bytes?: Buffer): Promise<PhotoKind | null> {
  if (!photoKindAvailable()) return null;
  const key = createHash("sha1").update(`${VERSION}|${url}`).digest("hex");
  const file = path.join(CACHE_DIR, `${key}.json`);
  try {
    return JSON.parse(await readFile(file, "utf8")) as PhotoKind;
  } catch {
    // not cached yet
  }
  let buf = bytes;
  if (!buf) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) return null;
      buf = Buffer.from(await res.arrayBuffer());
    } catch {
      return null;
    }
  }
  const v = await classifyPhotoBuffer(buf);
  if (v) {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(file, JSON.stringify(v)).catch(() => undefined);
  }
  return v;
}

/**
 * Does this photo stay off a lodging page? "never" and "junk" always; "sight" unless it is the hero
 * (the lodging's own yard with the church behind it was the one false alarm of the measurement).
 */
export function isOffPagePhoto(v: PhotoKind | null, isHero: boolean): boolean {
  if (!v) return false;
  if (v.kind === "never" || v.kind === "junk" || (v.kind === "sight" && !isHero)) return true;
  // A bathroom or a toilet is never on the page, gallery included (quality colleague, 11-25: Lili's WC
  // with the washing machine, Zalabéri's shower curtain and sink — failed every time).
  const p = v.probs ?? {};
  if (v.label === "a bathroom with a shower" || v.label === "a toilet" || (p["a bathroom with a shower"] ?? 0) + (p["a toilet"] ?? 0) >= BATHROOM_OFF_PAGE) return true;
  // A WC in the BACKGROUND of a bedroom shot (11-26: Zalabéri, b5c60799) — even a little toilet is too much.
  if ((p["a toilet"] ?? 0) >= TOILET_OFF_PAGE) return true;
  // People on the page: a stranger in a bikini by the pool, a group of guests (quality colleague, 11-26:
  // Meszesvölgy's highlighted pool photo and gallery opener) — off the page, hero or not.
  // 11-26 (quality colleague, Stéghouse): ONE person sitting on the jetty slipped through — the labels named
  // only bikinis and groups. A single person, an angler and children count too.
  if (seasonMass(v) >= SEASON_OFF_PAGE || isNightShot(v)) return true;
  // A photo-wallpaper beach (palms, bungalow) cropped as a band reads as a real beach at a Siófok flat (11-26,
  // quality colleague, Vandus) — and a palm beach is no Central-European lodging's own view: off the page.
  if ((p["a photo wallpaper mural on a wall"] ?? 0) + (p["palm trees on a tropical beach"] ?? 0) >= MURAL_OFF_PAGE) return true;
  return peopleMass(v) >= PEOPLE_OFF_PAGE;
}
/** Snow, night, Christmas: the page shows the place as a guest books it, not one evening / one winter
 *  (quality colleague, 11-25 and 11-26: Kőmosó's band snowy, a gallery photo at night). */
export const SEASON_LABELS = ["a snowy landscape", "a house covered in snow", "a building at night", "christmas decorations"];
export const SEASON_OFF_PAGE = 0.25;
/** Wall-mural / tropical-palm-beach mass from which a photo leaves the page. */
export const MURAL_OFF_PAGE = 0.2;
/** An OUTDOOR shot whose sky (top fifth) is this dark is a night shot (11-26: Borfa's lamp-lit courtyard and lit
 *  pool, Kőmosó's night yard measured 17–41; 64 fresh daytime photos: none under 55). Indoors the top is a ceiling. */
export const NIGHT_TOP_LUMA = 45;
const INDOOR_LABELS = new Set(["a living room", "a hotel room interior", "a bedroom with a bed", "a kitchen", "a small kitchenette", "a bathroom with a shower", "a toilet", "a dining table", "a hallway"]);
export function isNightShot(v: PhotoKind): boolean {
  return v.quality?.top != null && v.quality.top < NIGHT_TOP_LUMA && !INDOOR_LABELS.has(v.label);
}
export function seasonMass(v: PhotoKind): number {
  const p = v.probs ?? {};
  return SEASON_LABELS.reduce((a, l) => a + (p[l] ?? 0), 0);
}
/** A vehicle, a person or an animal: never a feature card, never leads the gallery (photoCurate notCard). */
export const NOT_CARD_LABELS = ["a car", "a parking lot", "a street with parked cars", "a group of people", "a woman in a bikini", "a person", "a person sitting on a pier", "a man fishing", "children playing", "a dog", "a cat"];
export const NOT_CARD_MASS = 0.08;
export const PEOPLE_LABELS = ["a woman in a bikini", "a group of people", "a person", "a person sitting on a pier", "a man fishing", "children playing"];
export function peopleMass(v: PhotoKind): number {
  const p = v.probs ?? {};
  return PEOPLE_LABELS.reduce((a, l) => a + (p[l] ?? 0), 0);
}
/** People mass from which a photo leaves the page. */
export const PEOPLE_OFF_PAGE = 0.15;
/** Bathroom + toilet mass from which a photo leaves the page. */
export const BATHROOM_OFF_PAGE = 0.35;
/** Toilet mass alone from which a photo leaves the page (a WC behind the bed). */
export const TOILET_OFF_PAGE = 0.06;

/** What a hero shows at its best: the place from outside, its garden, pool, view (full weight). */
const HERO_OUTSIDE = ["the outside of a house", "a guesthouse building", "a garden with a terrace", "a swimming pool", "a balcony with a view", "a lake shore", "a courtyard"];
/** Inside rooms a guest would sleep or sit in (part weight): a hero only when nothing outside is. */
const HERO_INSIDE = ["a living room", "a bedroom with a bed", "a hotel room interior", "a sauna or jacuzzi"];
/** Never the first screen (11-24: a bathroom mirror, a stove, a Booking award banner). */
// 11-25: "a small kitchenette" joined the labels with the allow-list — it is a kitchen, never the opening
// (Vörösmarty tér: the gate leaf was the kitchenette the moment the label existed).
const NOT_HERO_TOP = new Set(["a kitchen", "a small kitchenette", "a bathroom with a shower", "a dining table", "a toilet"]);

/** Kitchen/bathroom probability mass: a kitchen corner whose best label is "a museum exhibit" (Mia, 11-25) still opens on a kitchen. */
const BACKSTAGE_MAX = 0.4;
function backstageMass(v: PhotoKind): number {
  const p = v.probs ?? {};
  return [...NOT_HERO_TOP].reduce((a, l) => a + (p[l] ?? 0), 0);
}

/**
 * The lodging from OUTSIDE or its view (house, garden, pool, balcony view, shore, courtyard) — the
 * probability mass of those labels. A few-photo lead keeps its own hero only when this is high
 * (plan kepnelkuli-hero ⑨, ADR-0479); else its town's picture opens the page.
 */
export function outsideScore(v: PhotoKind): number {
  const p = v.probs ?? {};
  return HERO_OUTSIDE.reduce((a, l) => a + (p[l] ?? 0), 0);
}

/** How well a photo opens the page: outside views count fully, rooms partly. */
export function heroScore(v: PhotoKind): number {
  const p = v.probs ?? {};
  return HERO_OUTSIDE.reduce((a, l) => a + (p[l] ?? 0), 0) + 0.4 * HERO_INSIDE.reduce((a, l) => a + (p[l] ?? 0), 0);
}

/** May this photo be the hero? Not a kitchen/bathroom/dining/toilet shot, not a non-lodging picture. */
/** The machine pick's place-score floor (withBestHeroFirst); the colleague's pick needs only fitsHero. */
export const HERO_MACHINE_MIN_SCORE = 0.25;
// 11-27: the machine pick INHERITS every hard no-go of the gate's hero rule (fitsHero: person, vehicle, dark,
// small, kitchen, bathroom, non-lodging) — until then it lacked the person/vehicle rule, so the generator could
// open a page the render gate then refused („a nyitókép nem való nyitóképnek”).
export function isHeroWorthy(v: PhotoKind): boolean {
  // (No „the house must show” rule — owner 2026-11-25: the hero is the wow shot, a sunset over the lake
  // included; the quality colleague picks it from a contact sheet, qa-review.mts heroes.)
  return fitsHero(v) && heroScore(v) >= HERO_MACHINE_MIN_SCORE;
}

/**
 * May the quality colleague SEE this photo among the hero candidates (qa-review.mts heroes)? The same hard
 * no-gos as isHeroWorthy (kitchen, bathroom, non-lodging, dark), but no heroScore floor: the colleague judges
 * the wow (11-26, BaBo: its flowered terrace and garden steps scored 0.21–0.24 and the sheet showed only a
 * dark corridor). The machine pick (withBestHeroFirst) keeps isHeroWorthy.
 */
export function isHeroCandidate(v: PhotoKind): boolean {
  if (v.kind !== "ok" || v.never >= 0.3 || v.sight >= PHOTO_KIND_THRESHOLD) return false;
  if (NOT_HERO_TOP.has(v.label) || backstageMass(v) >= BACKSTAGE_MAX) return false;
  if (peopleMass(v) >= PEOPLE_OFF_PAGE) return false;
  // a car or a dog in front of the house (11-26, Pince): the colleague skipped it — never offer it
  if (notCardMass(v) >= NOT_CARD_MASS) return false;
  if (v.quality && v.quality.luma < HERO_MIN_LUMA) return false;
  if (!heroSized(v)) return false;
  return heroScore(v) >= 0.1;
}
/**
 * Big enough for the MOVING cover (owner 2026-11-26, Badacsony: „MÉG A HEROJA SINCSEN ANIMÁLVA”): the depth layer
 * skips a cover under 1000 × 700 px (media/depthMap.ts bigEnough — soft at full screen), so such a photo is no hero.
 * No measured size (older verdict) → not judged here.
 */
export const HERO_MIN_LONG = 1000;
export const HERO_MIN_SHORT = 700;
export function heroSized(v: PhotoKind): boolean {
  const q = v.quality;
  if (!q || !q.long) return true;
  return q.long >= HERO_MIN_LONG && (q.short == null || q.short >= HERO_MIN_SHORT);
}
/** Confidently read words that are real lettering: ≥ 4 letters (digits alone — a house number — do not count). */
export function signWords(words: readonly string[]): string[] {
  return words.filter((w) => (w.match(/\p{L}/gu)?.length ?? 0) >= 4);
}
/** Mean luma below this is too dark for the first screen. */
export const HERO_MIN_LUMA = 80;

/**
 * How good a photo is as a full-bleed band (0 = not fit): the place itself, bright, wide. The bands take
 * the best scorers, not the next photo in line (11-25 evening: bedding, a lamp, a dark sofa, an empty
 * car park still filled bands).
 */
export function bandScore(v: PhotoKind): number {
  if (!isBandWorthy(v)) return 0;
  const p = v.probs ?? {};
  if ((p["a parking lot"] ?? 0) + (p["a car"] ?? 0) + (p["a street with parked cars"] ?? 0) + (p["a street"] ?? 0) >= 0.08) return 0;
  const s = heroScore(v);
  return s >= BAND_MIN_SCORE ? +s.toFixed(4) : 0;
}
/** A band below this place-score stays empty (the template drops or flattens it). */
export const BAND_MIN_SCORE = 0.3;

/**
 * May this photo stand in the opening sequence (the wordmark-grow intro cycle, the gate leaf, the
 * gallery's first cards)? Anything but a kitchen/bathroom/dining/toilet shot or a non-lodging
 * picture. Looser than isHeroWorthy: a bedroom is fine here, a bathtub is not (11-24: Pirkadat and
 * Mia opened their wordmark-grow intro on a toilet and a bathtub).
 */
export function isShowcase(v: PhotoKind): boolean {
  if (v.kind !== "ok" || v.never >= 0.3 || v.sight >= PHOTO_KIND_THRESHOLD) return false;
  return !NOT_HERO_TOP.has(v.label) && backstageMass(v) < BACKSTAGE_MAX;
}

/**
 * A FULL-BLEED BAND is a screen of its own: it must show the place, not a thing in it (quality
 * colleague, 2026-11-25 — five of ten mocks failed on a band of a pillow, a shutter, a lamp, a dark
 * sofa, a flower box or a chimney dish). Showcase-fit, its best label one of the wide scenes, little
 * mass on the close-up labels, and not dark.
 */
const BAND_TOP = new Set([
  "the outside of a house", "a guesthouse building", "a garden with a terrace", "a swimming pool", "a balcony with a view",
  "a lake shore", "a courtyard", "a living room", "a bedroom with a bed", "a hotel room interior", "an outdoor hot tub",
  "a wooden barrel sauna", "a balcony with a table and chairs",
]);
/** Close-up label mass above which a photo is a detail shot, not a band. */
export const BAND_DETAIL_MAX = 0.2;
/** A band darker than this (mean luma) reads as a black screen on a phone. ONE value since 11-27: until then
 *  isBandWorthy said 70 and bandScore 85, so a 70–85 photo was „band-worthy” to one rule and unfit to the other. */
export const BAND_MIN_LUMA = 85;
export function isBandWorthy(v: PhotoKind): boolean {
  if (!isShowcase(v) || !BAND_TOP.has(v.label)) return false;
  const detail = Object.entries(v.probs).reduce((a, [l, p]) => a + (LABELS.labels.find((x) => x.label === l)?.kind === "detail" ? p : 0), 0);
  if (detail >= BAND_DETAIL_MAX) return false;
  return !v.quality || v.quality.luma >= BAND_MIN_LUMA;
}

/**
 * ONE PREDICATE PER SLOT (2026-11-27) — the generator fills a slot (photoCurate's okOpening / okBand / okContact,
 * the hero pick) and the render gate (outreach/mockRenderGate.ts) judges it with THE SAME function. Until then the
 * two used different rules (blind sample 11-27: Parallax 0/20 — a hotel-room close-up in the band, a kitchenette
 * in the opening, a church on the contact picture, all filled by the generator and refused by the gate).
 * No verdict (null: no model, unreadable image) = NOT fit: an unjudged photo fills no slot.
 */
/** The first screen: the hard no-gos of the colleague's hero choice (isHeroCandidate), and a picture that may stay
 *  on the page as the hero (isOffPagePhoto: snow, night, people — the gate's page-wide rule judges the hero too). */
export function fitsHero(v: PhotoKind | null): boolean {
  return v != null && isHeroCandidate(v) && !isOffPagePhoto(v, true);
}
/** The opening sequence (wordmark-grow frame, gate leaf): showcase-fit and a picture that stays on the page. */
export function fitsOpening(v: PhotoKind | null): boolean {
  return v != null && isShowcase(v) && !isOffPagePhoto(v, false);
}
/** A full-bleed band: opening-fit and a wide, bright view of the place itself (bandScore > 0). */
export function fitsBand(v: PhotoKind | null): boolean {
  return v != null && fitsOpening(v) && bandScore(v) > 0;
}
/** The contact picture: opening-fit and no vehicle / person / animal mass (the feature cards' rule). */
export function fitsContact(v: PhotoKind | null): boolean {
  return v != null && fitsOpening(v) && notCardMass(v) < NOT_CARD_MASS;
}
export function notCardMass(v: PhotoKind): number {
  const p = v.probs ?? {};
  return NOT_CARD_LABELS.reduce((a, l) => a + (p[l] ?? 0), 0);
}

/**
 * After the hero, the showcase photos first and the kitchen/bathroom ones last — each group in its
 * own order. The first photo is never moved here (withBestHeroFirst chose it). Unknown verdicts
 * count as showcase (no model → nothing moves).
 */
export function withShowcaseFirst<T>(photos: readonly T[], kinds: readonly (PhotoKind | null)[]): T[] {
  if (photos.length < 3) return [...photos];
  const idx = photos.map((_, i) => i).slice(1);
  const ok = (i: number): boolean => { const v = kinds[i]; return !v || isShowcase(v); };
  return [photos[0]!, ...idx.filter(ok).map((i) => photos[i]!), ...idx.filter((i) => !ok(i)).map((i) => photos[i]!)];
}

/**
 * Put the best hero first (generation and the photo-fix rerender): the photo with the highest
 * heroScore among the hero-worthy ones, unless the current first photo is already hero-worthy and
 * within 0.15 of it (the vision/portal order keeps its say when it is good). Order otherwise kept.
 * Unknown verdicts (no model, unreadable image) never move anything.
 */
/**
 * A ROOM INSIDE opens the page only when nothing outside can (ADR-0503 ⑫, Nyerges 6f9ac931: a bed close-up under „a view
 * onto the garden”). Measured 11-27 on 60 live heroes: 10 were rooms (bed ≥ 0.35 or room mass ≥ 0.55), 5 of them had
 * an outdoor / view photo the hero rule accepts. A preference, not a ban: a lead with rooms only keeps its best room.
 */
export const HERO_BED_MAX = 0.35;
export const HERO_ROOM_MASS_MAX = 0.55;
export function isRoomHero(v: PhotoKind | null): boolean {
  const p = v?.probs ?? {};
  const bed = p["a bedroom with a bed"] ?? 0;
  return bed >= HERO_BED_MAX || bed + (p["a hotel room interior"] ?? 0) + (p["a living room"] ?? 0) >= HERO_ROOM_MASS_MAX;
}
/** Index of the best photo the hero rule accepts that is NOT a room inside, or -1. */
export function bestOutsideHero(kinds: readonly (PhotoKind | null)[]): number {
  let at = -1;
  kinds.forEach((v, i) => {
    if (fitsHero(v) && !isRoomHero(v) && (at < 0 || heroScore(v!) > heroScore(kinds[at]!))) at = i;
  });
  return at;
}

export function withBestHeroFirst<T>(photos: readonly T[], kinds: readonly (PhotoKind | null)[]): T[] {
  if (photos.length < 2) return [...photos];
  // a room would open the page while an outside / view photo could: the outside one opens it
  const chosen = withBestHeroFirstByScore(photos, kinds);
  const firstKind = kinds[photos.indexOf(chosen[0]!)] ?? null;
  if (isRoomHero(firstKind)) {
    const out = bestOutsideHero(kinds);
    if (out >= 0) return [photos[out]!, ...photos.filter((_, i) => i !== out)];
  }
  return chosen;
}

function withBestHeroFirstByScore<T>(photos: readonly T[], kinds: readonly (PhotoKind | null)[]): T[] {
  let best = -1;
  let bestScore = -1;
  kinds.forEach((v, i) => {
    if (v && isHeroWorthy(v) && heroScore(v) > bestScore) {
      best = i;
      bestScore = heroScore(v);
    }
  });
  if (best < 0) {
    // NO photo clears the machine's wow floor (11-27, ADR-0500 ⑤ blind sample: 3 of 21 failed plans): the first photo
    // stayed the hero even when the gate's own hero rule (fitsHero) refuses it — an „outside of a house” the gate
    // fails every time, whatever was taken off. Then the best photo the gate WOULD accept opens the page; none → as is.
    if (fitsHero(kinds[0] ?? null)) return [...photos];
    let alt = -1;
    kinds.forEach((v, i) => {
      if (fitsHero(v) && (alt < 0 || heroScore(v!) > heroScore(kinds[alt]!))) alt = i;
    });
    return alt > 0 ? [photos[alt]!, ...photos.filter((_, i) => i !== alt)] : [...photos];
  }
  if (best === 0) return [...photos];
  const first = kinds[0];
  if (first && isHeroWorthy(first) && heroScore(first) >= bestScore - 0.15) return [...photos];
  return [photos[best]!, ...photos.filter((_, i) => i !== best)];
}

/**
 * Where a PORTRAIT crop of this photo should sit (0–100, CSS background-position x %), for the
 * full-bleed hero on a phone (11-26, quality colleague: the parallax hero cut the chosen wow photo
 * to a shed wall / a dark corner on mobile). Local and deterministic: the column window of a
 * 390×844 crop with the most edge detail (gradient energy), lightly pulled to the centre.
 * Cached on disk per URL. null = not measurable (then the template keeps `center`).
 */
export async function photoFocusX(url: string): Promise<number | null> {
  const key = createHash("sha1").update(`focus-v1|${url}`).digest("hex");
  const file = path.join(CACHE_DIR, `${key}.json`);
  try {
    return (JSON.parse(await readFile(file, "utf8")) as { x: number | null }).x;
  } catch {
    // not cached yet
  }
  let x: number | null = null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (res.ok) x = await focusXOfBuffer(Buffer.from(await res.arrayBuffer()));
  } catch {
    x = null;
  }
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(file, JSON.stringify({ x })).catch(() => undefined);
  return x;
}

export async function focusXOfBuffer(buf: Buffer): Promise<number | null> {
  const g = await sharp(buf).rotate().greyscale().resize(128, 128, { fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = g.info;
  const d = g.data;
  const winW = Math.round(w * Math.min(1, (390 / 844) / (w / h)));
  if (winW >= w - 1) return null;
  const col = new Array<number>(w).fill(0);
  for (let y = 1; y < h - 1; y++) {
    for (let xx = 1; xx < w - 1; xx++) {
      const i = y * w + xx;
      col[xx]! += Math.abs(d[i + 1]! - d[i - 1]!) + Math.abs(d[i + w]! - d[i - w]!);
    }
  }
  const total = col.reduce((a, v) => a + v, 0) || 1;
  const span = w - winW;
  let best = Math.round(span / 2);
  let bestScore = -Infinity;
  for (let s = 0; s <= span; s++) {
    let e = 0;
    for (let k = s; k < s + winW; k++) e += col[k]!;
    // centre pull: a 10 % energy handicap at the far edge — a busy edge must clearly win
    const score = e / total - 0.1 * Math.abs(s - span / 2) / (span / 2);
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return Math.round(((best / span) * 100) / 5) * 5;
}
