#!/usr/bin/env npx tsx
/**
 * Fetch the depth-hero model (ADR-XXXX) — Depth Anything V2 Small, int8 ONNX, 27 MB.
 *
 *   npx tsx scripts/depth-model-fetch.mts
 *
 * Not in git (models/ is ignored): this downloads it once to config.depthModelPath and checks
 * the pinned sha256, so every machine runs the exact model the owner approved the look on
 * (2026-11-23). Idempotent: a present file with the right hash is left alone. Measured on the
 * dev box: the int8 map is visually identical to the fp32 (99 MB) one, 2.1 s / photo, 336 MB RSS.
 * Licence: Depth Anything V2 Small is Apache-2.0 (the Base/Large models are NOT — never swap
 * this URL for them).
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { config } from "../src/config.js";

export const DEPTH_MODEL_URL =
  "https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model_quantized.onnx";
export const DEPTH_MODEL_SHA256 = "fcf51f1b230362b28690bb9d1809bf0431f29cad20534e3f589bd7285547f20d";

const target = path.resolve(process.cwd(), config.depthModelPath);
const sha = (b: Buffer): string => createHash("sha256").update(b).digest("hex");

const have = await readFile(target).catch(() => null);
if (have && sha(have) === DEPTH_MODEL_SHA256) {
  console.log(`✅ a mélységmodell megvan: ${target}`);
  process.exit(0);
}
console.log(`⬇️  mélységmodell letöltése → ${target}`);
const res = await fetch(DEPTH_MODEL_URL);
if (!res.ok) {
  console.error(`⛔ letöltés sikertelen: HTTP ${res.status}`);
  process.exit(1);
}
const body = Buffer.from(await res.arrayBuffer());
if (sha(body) !== DEPTH_MODEL_SHA256) {
  console.error(`⛔ a letöltött fájl ellenőrzőösszege nem egyezik (${sha(body)}) — nem mentem el.`);
  process.exit(1);
}
await mkdir(path.dirname(target), { recursive: true });
await writeFile(`${target}.part`, body);
await rename(`${target}.part`, target);
console.log(`✅ kész (${(body.length / 1048576).toFixed(1)} MB)`);
