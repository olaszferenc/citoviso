// LOCAL OBJECT DETECTION on a photo (YOLOX-tiny, COCO 80 classes, Apache-2.0 — Megvii-BaseDetection/YOLOX
// release 0.1.1rc0, sha256 427cc366…70b0f7). No API, no cost: onnxruntime on this machine.
//
// Why (11-26, quality colleague, a day of 0 approvals): the whole-image CLIP classifier (photoKind.ts) does not
// see a DETAIL — a car at the edge of a garden shot, a WC behind the bedroom door, a woman in a bikini by the
// pool, a corridor it called „a hotel room interior”. An object detector answers exactly that: is there a car /
// person / dog / toilet / sink / bed in the picture, and how big is it.
//
// Cached on disk per URL. null = model missing or photo unreadable — callers then keep the CLIP verdict alone.

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import ort from "onnxruntime-node";
import sharp from "sharp";
import { config } from "../config.js";

const VERSION = 1;
const SIZE = 416;
const CACHE_DIR = path.resolve(process.cwd(), "sites/_photo-objects-cache");
const MIN_SCORE = 0.3;

const COCO = ["person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat", "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket", "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch", "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse", "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink", "refrigerator", "book", "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush"];

export interface DetectedObject {
  readonly label: string;
  readonly score: number;
  /** Box as fractions of the photo (0–1). */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

let session: Promise<ort.InferenceSession> | null = null;
function modelPath(): string {
  return path.resolve(process.cwd(), config.photoObjectsModelPath);
}
export function photoObjectsAvailable(): boolean {
  return existsSync(modelPath());
}
function getSession(): Promise<ort.InferenceSession> {
  session ??= ort.InferenceSession.create(modelPath());
  return session;
}

/** Objects in the photo at `url` (score ≥ 0.3, after NMS), cached per URL. */
export async function detectPhotoObjects(url: string, bytes?: Buffer): Promise<DetectedObject[] | null> {
  if (!photoObjectsAvailable()) return null;
  const key = createHash("sha1").update(`${VERSION}|${url}`).digest("hex");
  const file = path.join(CACHE_DIR, `${key}.json`);
  try {
    return JSON.parse(await readFile(file, "utf8")) as DetectedObject[];
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
  const out = await detectBuffer(buf).catch(() => null);
  if (out) {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(file, JSON.stringify(out)).catch(() => undefined);
  }
  return out;
}

export async function detectBuffer(buf: Buffer): Promise<DetectedObject[]> {
  const img = sharp(buf).rotate();
  const meta = await img.metadata();
  // EXIF-rotated dimensions
  const rot = (meta.orientation ?? 1) >= 5;
  const W = (rot ? meta.height : meta.width) ?? 1;
  const H = (rot ? meta.width : meta.height) ?? 1;
  const r = Math.min(SIZE / W, SIZE / H);
  const nw = Math.max(1, Math.round(W * r));
  const nh = Math.max(1, Math.round(H * r));
  // YOLOX preprocessing: letterbox to the TOP-LEFT, pad 114, BGR, raw 0–255 (no mean/std)
  const raw = await sharp(buf).rotate().resize(nw, nh, { fit: "fill" }).removeAlpha()
    .extend({ right: SIZE - nw, bottom: SIZE - nh, background: { r: 114, g: 114, b: 114 } })
    .raw().toBuffer();
  const plane = SIZE * SIZE;
  const t = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    t[i] = raw[i * 3 + 2]!; // B
    t[plane + i] = raw[i * 3 + 1]!; // G
    t[2 * plane + i] = raw[i * 3]!; // R
  }
  const s = await getSession();
  const res = await s.run({ [s.inputNames[0]!]: new ort.Tensor("float32", t, [1, 3, SIZE, SIZE]) });
  const o = res[s.outputNames[0]!]!.data as Float32Array;
  const C = 85;
  const cands: DetectedObject[] = [];
  let k = 0;
  for (const stride of [8, 16, 32]) {
    const g = SIZE / stride;
    for (let gy = 0; gy < g; gy++) {
      for (let gx = 0; gx < g; gx++, k++) {
        const b = k * C;
        const obj = o[b + 4]!;
        if (obj < MIN_SCORE) continue;
        let best = 0;
        let cls = 0;
        for (let c = 0; c < 80; c++) {
          const v = o[b + 5 + c]!;
          if (v > best) {
            best = v;
            cls = c;
          }
        }
        const score = obj * best;
        if (score < MIN_SCORE) continue;
        const cx = (o[b]! + gx) * stride;
        const cy = (o[b + 1]! + gy) * stride;
        const bw = Math.exp(o[b + 2]!) * stride;
        const bh = Math.exp(o[b + 3]!) * stride;
        const x0 = Math.max(0, (cx - bw / 2) / r);
        const y0 = Math.max(0, (cy - bh / 2) / r);
        const x1 = Math.min(W, (cx + bw / 2) / r);
        const y1 = Math.min(H, (cy + bh / 2) / r);
        if (x1 <= x0 || y1 <= y0) continue;
        cands.push({ label: COCO[cls]!, score: +score.toFixed(3), x: +(x0 / W).toFixed(4), y: +(y0 / H).toFixed(4), w: +((x1 - x0) / W).toFixed(4), h: +((y1 - y0) / H).toFixed(4) });
      }
    }
  }
  // per-class NMS
  cands.sort((a, b) => b.score - a.score);
  const keep: DetectedObject[] = [];
  for (const c of cands) {
    if (keep.some((q) => q.label === c.label && iou(q, c) > 0.45)) continue;
    keep.push(c);
  }
  return keep;
}

function iou(a: DetectedObject, b: DetectedObject): number {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  return inter / (a.w * a.h + b.w * b.h - inter || 1);
}

const area = (o: DetectedObject): number => o.w * o.h;
const has = (objs: readonly DetectedObject[], labels: readonly string[], minScore: number, minArea = 0): boolean =>
  objs.some((o) => labels.includes(o.label) && o.score >= minScore && area(o) >= minArea);

/** A toilet, or a washbasin with no kitchen around it: never on a lodging page (gallery included). */
// `clipBath` / `clipKitchen`: the whole-image classifier's bathroom+toilet and kitchen mass — a hot tub was
// detected as a „toilet” (0.37, Jaja), a kitchen sink as a washbasin; the two verdicts together decide.
export function showsBathroomFixture(objs: readonly DetectedObject[], clipBath = 0, clipKitchen = 0): boolean {
  if (has(objs, ["toilet"], 0.55) || (has(objs, ["toilet"], 0.35) && clipBath >= 0.1)) return true;
  const kitchen = clipKitchen >= 0.2 || has(objs, ["oven", "refrigerator", "microwave", "toaster"], 0.3);
  return !kitchen && has(objs, ["sink"], 0.45, 0.004) && clipBath >= 0.05;
}
/** A person who is part of the picture (not a speck far away): never on a lodging page. */
export function showsPerson(objs: readonly DetectedObject[]): boolean {
  return has(objs, ["person"], 0.45, 0.006);
}
/** A vehicle or an animal anywhere in the photo: never a feature card, out of the gallery when there is choice. */
export function showsVehicleOrAnimal(objs: readonly DetectedObject[]): boolean {
  return has(objs, ["car", "truck", "bus", "motorcycle", "bicycle", "dog", "cat", "horse"], 0.4, 0.003) || has(objs, ["person"], 0.4, 0.001);
}
/** A real bed in the photo (a room card may show it). */
export function showsBed(objs: readonly DetectedObject[]): boolean {
  return has(objs, ["bed"], 0.45, 0.06);
}
/** A sofa / armchairs: a sitting room (the lone card may show it when there is no bed). */
export function showsSittingArea(objs: readonly DetectedObject[]): boolean {
  return has(objs, ["couch"], 0.45, 0.04);
}
