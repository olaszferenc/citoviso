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
const VERSION = 4;

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
  let input: Float32Array;
  try {
    input = await pixels(buf);
  } catch {
    return null;
  }
  const sess = await getSession();
  const res = await sess.run({ pixel_values: new ort.Tensor("float32", input, [1, 3, SIZE, SIZE]) });
  const emb = res.image_embeds!.data as Float32Array;
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
  return { long, luma: +(sum / Math.max(1, d.length)).toFixed(1), lap: +lap.toFixed(1) };
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
  return v.kind === "never" || v.kind === "junk" || (v.kind === "sight" && !isHero);
}

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

/** How well a photo opens the page: outside views count fully, rooms partly. */
export function heroScore(v: PhotoKind): number {
  const p = v.probs ?? {};
  return HERO_OUTSIDE.reduce((a, l) => a + (p[l] ?? 0), 0) + 0.4 * HERO_INSIDE.reduce((a, l) => a + (p[l] ?? 0), 0);
}

/** May this photo be the hero? Not a kitchen/bathroom/dining/toilet shot, not a non-lodging picture. */
export function isHeroWorthy(v: PhotoKind): boolean {
  if (v.kind !== "ok" || v.never >= 0.3 || v.sight >= PHOTO_KIND_THRESHOLD) return false;
  if (NOT_HERO_TOP.has(v.label) || backstageMass(v) >= BACKSTAGE_MAX) return false;
  return heroScore(v) >= 0.25;
}

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
/** A band darker than this (mean luma) reads as a black screen on a phone. */
export const BAND_MIN_LUMA = 70;
export function isBandWorthy(v: PhotoKind): boolean {
  if (!isShowcase(v) || !BAND_TOP.has(v.label)) return false;
  const detail = Object.entries(v.probs).reduce((a, [l, p]) => a + (LABELS.labels.find((x) => x.label === l)?.kind === "detail" ? p : 0), 0);
  if (detail >= BAND_DETAIL_MAX) return false;
  return !v.quality || v.quality.luma >= BAND_MIN_LUMA;
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
export function withBestHeroFirst<T>(photos: readonly T[], kinds: readonly (PhotoKind | null)[]): T[] {
  if (photos.length < 2) return [...photos];
  let best = -1;
  let bestScore = -1;
  kinds.forEach((v, i) => {
    if (v && isHeroWorthy(v) && heroScore(v) > bestScore) {
      best = i;
      bestScore = heroScore(v);
    }
  });
  if (best <= 0) return [...photos];
  const first = kinds[0];
  if (first && isHeroWorthy(first) && heroScore(first) >= bestScore - 0.15) return [...photos];
  return [photos[best]!, ...photos.filter((_, i) => i !== best)];
}
