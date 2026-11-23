// DEPTH MAPS for the depth hero (ADR-XXXX) — make once per photo, cache, serve.
//
// One entry point, `ensureDepthMap(source, bytes)`: the photo URL is the key (photoKey(), the same
// normalisation as photo_hero_score), the PNG lands in sites/_depth/<sha24>.png and a
// photo_depth_map row says whether it is usable. A second call for the same photo (re-generation,
// curator round, a tenant putting an old cover back) costs one SELECT.
//
// The heavy part runs in depthWorker.ts, a CHILD process, strictly one at a time (a promise chain):
// ~2 s and ~300 MB per photo on the 2-vCPU / 4 GB production box (measured 2026-11-23 on the dev
// box: 2.1 s, 336 MB RSS) — two at once would only double the memory for no gain.
//
// SKIP RULES (a skipped photo keeps its static cover; the row records why, so it is not retried):
//   · 'small'  — shorter edge < 700 px or longer edge < 1000 px: the page shows the cover full
//                screen; a 511 px wide photo (Vénusz Apartman, 2026-11-23) is already soft there,
//                and moving it only makes that more visible.
//   · 'paid'   — Places media: never fetched for this, never stored as a derivative.
//   · 'fetch'  / 'compute' — the bytes could not be had / the worker failed.
//   ⚠️ NOT a skip rule: "flat picture". The map's spread is stored for later analysis, but it does
//   not separate flat from deep reliably — a synthetic striped wall measured 0.21 against 0.24–0.29
//   for five real covers (min-max normalisation lifts noise). A bad-looking cover is switched off by
//   a person (curator per mock, owner in the tenant admin), not guessed by a threshold.
//   ⚠️ No model file (config.depthModelPath) → nothing is made, nothing is recorded: the feature
//   is inert until the model is fetched (scripts/depth-model-fetch.mts).

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import sharp from "sharp";

import { config } from "../config.js";
import { photoKey } from "../console/photoProxy.js";
import { db } from "../db/client.js";
import { isPaidPhotoHost } from "../generator/photoTransport.js";

/** Bump when the model or the map maths change: old rows are then recomputed. */
export const DEPTH_MODEL_ID = "da2-small-int8/v1";
export const DEPTH_DIR = path.resolve(process.cwd(), "sites/_depth");
/** The public route the PNGs are served at (console; routed on every host, see depthMapUrl). */
export const DEPTH_ROUTE = /^\/configure\/depth\/([0-9a-f]{24})\.png$/i;

const MIN_SHORT_EDGE = 700;
const MIN_LONG_EDGE = 1000;
const WORKER_TIMEOUT_MS = 90_000;

export type DepthSkip = "small" | "paid" | "fetch" | "compute";

export interface DepthMap {
  /** File name under DEPTH_DIR, e.g. "3f…a1.png". */
  readonly file: string;
  readonly width: number;
  readonly height: number;
  readonly spread: number;
}

export type DepthResult = { readonly ok: true; readonly map: DepthMap } | { readonly ok: false; readonly skip: DepthSkip };

/** The file name for a photo: sha256 of its key, 24 hex. Not a secret — the map is a grayscale shape. */
export function depthFileOf(source: string): string {
  return `${createHash("sha256").update(photoKey(source)).digest("hex").slice(0, 24)}.png`;
}

/**
 * The URL a page loads the map from. RELATIVE on purpose: `/configure/` is routed to the console on
 * every host a page is viewed on (cold-lane host, preview host, tenant subdomain, tenant custom
 * domain — deploy/nginx), so the map is always SAME-ORIGIN and WebGL may read it without CORS.
 */
export function depthMapUrl(file: string): string {
  return `/configure/depth/${file}`;
}

/** Is the shape big enough to be moved full screen? */
export function bigEnough(width: number, height: number): boolean {
  return Math.min(width, height) >= MIN_SHORT_EDGE && Math.max(width, height) >= MIN_LONG_EDGE;
}

/** True when the model file is present (the feature is inert without it). */
export async function depthModelReady(): Promise<boolean> {
  try {
    await access(path.resolve(process.cwd(), config.depthModelPath));
    return true;
  } catch {
    return false;
  }
}

// ---- the one-at-a-time child process ------------------------------------------------------

let chain: Promise<unknown> = Promise.resolve();

interface WorkerOut {
  readonly ok: boolean;
  readonly width?: number;
  readonly height?: number;
  readonly spread?: number;
  readonly error?: string;
}

function runWorker(input: string, output: string): Promise<WorkerOut> {
  const worker = path.resolve(path.dirname(new URL(import.meta.url).pathname), "depthWorker.ts");
  const model = path.resolve(process.cwd(), config.depthModelPath);
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["--import", "tsx", worker, model, input, output], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (b: Buffer) => (out += b.toString()));
    child.stderr.on("data", (b: Buffer) => (err += b.toString()));
    const timer = setTimeout(() => child.kill("SIGKILL"), WORKER_TIMEOUT_MS);
    child.on("close", () => {
      clearTimeout(timer);
      const line = out.trim().split("\n").pop() ?? "";
      try {
        resolve(JSON.parse(line) as WorkerOut);
      } catch {
        resolve({ ok: false, error: (err || out || "no output").slice(0, 300) });
      }
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ ok: false, error: e.message });
    });
  });
}

/** Compute a map from photo bytes into DEPTH_DIR/<file>. Serialised: one worker at a time. */
export function computeDepthMap(bytes: Buffer, file: string): Promise<WorkerOut> {
  const job = chain.then(async () => {
    await mkdir(DEPTH_DIR, { recursive: true });
    const tmp = path.join(tmpdir(), `cit-depth-${process.pid}-${Date.now()}`);
    await writeFile(tmp, bytes);
    try {
      return await runWorker(tmp, path.join(DEPTH_DIR, file));
    } finally {
      await rm(tmp, { force: true });
    }
  });
  chain = job.catch(() => undefined);
  return job;
}

// ---- cache ---------------------------------------------------------------------------------

/** The cached row for a photo under the current model, if any. */
export async function cachedDepthMap(source: string): Promise<DepthResult | null> {
  const row = await db
    .selectFrom("photo_depth_map")
    .selectAll()
    .where("url_key", "=", photoKey(source))
    .where("model", "=", DEPTH_MODEL_ID)
    .executeTakeFirst();
  if (!row) return null;
  if (row.skip_reason || !row.file) return { ok: false, skip: (row.skip_reason ?? "compute") as DepthSkip };
  return { ok: true, map: { file: row.file, width: row.src_width ?? 0, height: row.src_height ?? 0, spread: row.spread ?? 0 } };
}

async function record(source: string, r: { file?: string; width?: number; height?: number; spread?: number; skip?: DepthSkip }): Promise<void> {
  const values = {
    url_key: photoKey(source),
    file: r.file ?? null,
    src_width: r.width ?? null,
    src_height: r.height ?? null,
    spread: r.spread ?? null,
    skip_reason: r.skip ?? null,
    model: DEPTH_MODEL_ID,
    computed_at: new Date(),
  };
  await db
    .insertInto("photo_depth_map")
    .values(values)
    .onConflict((oc) => oc.column("url_key").doUpdateSet(values))
    .execute();
}

/**
 * The depth map for a photo — from the cache, or made now. `bytes` is asked for only on a cache
 * miss (the caller fetches through its own transport: the mock's photo proxy with the curators'
 * rotation, or the tenant's upload on disk). Returns null when the model is not installed.
 */
export async function ensureDepthMap(
  source: string,
  bytes: () => Promise<Buffer | null>,
): Promise<DepthResult | null> {
  if (isPaidPhotoHost(source)) return { ok: false, skip: "paid" };
  const hit = await cachedDepthMap(source);
  if (hit) return hit;
  if (!(await depthModelReady())) return null;
  const body = await bytes().catch(() => null);
  if (!body) {
    await record(source, { skip: "fetch" });
    return { ok: false, skip: "fetch" };
  }
  // Size first, from the header (cheap): a too-small cover never reaches the worker.
  const meta = await sharp(body).metadata().catch(() => null);
  const turned = (meta?.orientation ?? 1) >= 5;
  const w = (turned ? meta?.height : meta?.width) ?? 0;
  const h = (turned ? meta?.width : meta?.height) ?? 0;
  if (w && h && !bigEnough(w, h)) {
    await record(source, { width: w, height: h, skip: "small" });
    return { ok: false, skip: "small" };
  }
  const file = depthFileOf(source);
  const out = await computeDepthMap(body, file);
  if (!out.ok || !out.width || !out.height) {
    console.warn(`  ⚠️ mélységkép: a számolás nem sikerült (${source}): ${out.error ?? "?"}`); // i18n-exempt: operator log
    await record(source, { skip: "compute" });
    return { ok: false, skip: "compute" };
  }
  if (!bigEnough(out.width, out.height)) {
    await rm(path.join(DEPTH_DIR, file), { force: true });
    await record(source, { width: out.width, height: out.height, spread: out.spread, skip: "small" });
    return { ok: false, skip: "small" };
  }
  await record(source, { file, width: out.width, height: out.height, spread: out.spread });
  return { ok: true, map: { file, width: out.width, height: out.height, spread: out.spread ?? 0 } };
}
