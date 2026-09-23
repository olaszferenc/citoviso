// Pixel-level PNG comparison for the KB screenshot gates (kb-shot --determinism,
// deploy GATE 1c). ⛔ A byte diff is worthless here: two PNGs of the same pixels
// differ in bytes (encoder metadata), and antialiasing noise differs by a few levels
// per channel between runs (measured 2026-09-23: admin-modules/arak.png, 0 px above
// the threshold). So a pixel counts as CHANGED only when some channel moves by more
// than `threshold`, and the result names HOW MANY pixels moved and WHERE (bbox) —
// a failure must point at the region to look at, not just say "different".

import sharp from "sharp";

export interface PixelDiff {
  /** Dimensions differ — no per-pixel comparison was possible. */
  readonly sizeMismatch: boolean;
  readonly a: { w: number; h: number };
  readonly b: { w: number; h: number };
  /** Pixels where some channel differs by more than the threshold. */
  readonly changed: number;
  /** Bounding box of the changed pixels (inclusive), null when none changed. */
  readonly bbox: { x0: number; y0: number; x1: number; y1: number } | null;
}

/** Per-channel tolerance: above antialiasing noise, far below any real content change. */
export const DEFAULT_THRESHOLD = 24;

async function rgba(input: string | Buffer): Promise<{ data: Buffer; w: number; h: number }> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

export async function pixelDiff(
  a: string | Buffer,
  b: string | Buffer,
  threshold: number = DEFAULT_THRESHOLD,
): Promise<PixelDiff> {
  const [ia, ib] = await Promise.all([rgba(a), rgba(b)]);
  const sa = { w: ia.w, h: ia.h };
  const sb = { w: ib.w, h: ib.h };
  if (ia.w !== ib.w || ia.h !== ib.h) {
    return { sizeMismatch: true, a: sa, b: sb, changed: ia.w * ia.h, bbox: null };
  }
  let changed = 0;
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  const { w, h } = ia;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (
        Math.abs(ia.data[i] - ib.data[i]) > threshold ||
        Math.abs(ia.data[i + 1] - ib.data[i + 1]) > threshold ||
        Math.abs(ia.data[i + 2] - ib.data[i + 2]) > threshold ||
        Math.abs(ia.data[i + 3] - ib.data[i + 3]) > threshold
      ) {
        changed++;
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    }
  }
  return { sizeMismatch: false, a: sa, b: sb, changed, bbox: changed ? { x0, y0, x1, y1 } : null };
}

export function identical(d: PixelDiff): boolean {
  return !d.sizeMismatch && d.changed === 0;
}

export function describeDiff(d: PixelDiff): string {
  if (d.sizeMismatch) return `méret eltér: ${d.a.w}×${d.a.h} → ${d.b.w}×${d.b.h}`;
  if (!d.bbox) return "azonos";
  const { x0, y0, x1, y1 } = d.bbox;
  return `${d.changed} px eltér, bbox (${x0},${y0})-(${x1},${y1})`;
}
