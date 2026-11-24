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

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import ort from "onnxruntime-node";
import sharp from "sharp";
import { config } from "../config.js";
import LABELS from "./photoKindLabels.json" with { type: "json" };

/** "ok" = the lodging; "sight" = a sight of the area; "never" = a document, plan, ad, toilet, map, logo, person. */
export type PhotoKindClass = "ok" | "sight" | "never";

export interface PhotoKind {
  readonly kind: PhotoKindClass;
  /** Best label and its probability (for the operator log). */
  readonly label: string;
  readonly score: number;
  /** Probability mass per class. */
  readonly sight: number;
  readonly never: number;
  /** Probability per label (photoKindLabels.json order-independent, keyed by label). */
  readonly probs: Readonly<Record<string, number>>;
}

/** A class at or above this mass takes the photo off the page. */
export const PHOTO_KIND_THRESHOLD = 0.6;
/** Bump when the labels or the threshold change: cached verdicts of an older version are re-scored. */
const VERSION = 2;

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

/** Classify image bytes. Null when the model is missing or the bytes are not an image. */
export async function classifyPhotoBuffer(buf: Buffer): Promise<PhotoKind | null> {
  if (!photoKindAvailable()) return null;
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
  const kind: PhotoKindClass = never >= PHOTO_KIND_THRESHOLD ? "never" : sight >= PHOTO_KIND_THRESHOLD ? "sight" : "ok";
  const byLabel: Record<string, number> = {};
  LABELS.labels.forEach((l, i) => {
    byLabel[l.label] = +probs[i]!.toFixed(4);
  });
  return { kind, label: LABELS.labels[best]!.label, score: probs[best]!, sight, never, probs: byLabel };
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
 * Does this photo stay off a lodging page? "never" always; "sight" unless it is the hero (the
 * lodging's own yard with the church behind it was the one false alarm of the measurement).
 */
export function isOffPagePhoto(v: PhotoKind | null, isHero: boolean): boolean {
  if (!v) return false;
  return v.kind === "never" || (v.kind === "sight" && !isHero);
}

/** What a hero shows at its best: the place from outside, its garden, pool, view (full weight). */
const HERO_OUTSIDE = ["the outside of a house", "a guesthouse building", "a garden with a terrace", "a swimming pool", "a balcony with a view", "a lake shore", "a courtyard"];
/** Inside rooms a guest would sleep or sit in (part weight): a hero only when nothing outside is. */
const HERO_INSIDE = ["a living room", "a bedroom with a bed", "a hotel room interior", "a sauna or jacuzzi"];
/** Never the first screen (11-24: a bathroom mirror, a stove, a Booking award banner). */
const NOT_HERO_TOP = new Set(["a kitchen", "a bathroom with a shower", "a dining table", "a toilet"]);

/** How well a photo opens the page: outside views count fully, rooms partly. */
export function heroScore(v: PhotoKind): number {
  const p = v.probs ?? {};
  return HERO_OUTSIDE.reduce((a, l) => a + (p[l] ?? 0), 0) + 0.4 * HERO_INSIDE.reduce((a, l) => a + (p[l] ?? 0), 0);
}

/** May this photo be the hero? Not a kitchen/bathroom/dining/toilet shot, not a non-lodging picture. */
export function isHeroWorthy(v: PhotoKind): boolean {
  if (v.never >= 0.3 || v.sight >= PHOTO_KIND_THRESHOLD) return false;
  if (NOT_HERO_TOP.has(v.label)) return false;
  return heroScore(v) >= 0.25;
}

/**
 * May this photo stand in the opening sequence (the wordmark-grow intro cycle, the gate leaf, the
 * gallery's first cards)? Anything but a kitchen/bathroom/dining/toilet shot or a non-lodging
 * picture. Looser than isHeroWorthy: a bedroom is fine here, a bathtub is not (11-24: Pirkadat and
 * Mia opened their wordmark-grow intro on a toilet and a bathtub).
 */
export function isShowcase(v: PhotoKind): boolean {
  if (v.never >= 0.3 || v.sight >= PHOTO_KIND_THRESHOLD) return false;
  return !NOT_HERO_TOP.has(v.label);
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
