// PERCEPTUAL FINGERPRINT — "is this the SAME picture under another URL?" (2026-10-04).
//
// WHY: portals republish each other's photos. The Lovász apartman's hero (szallaskeres.hu)
// and its "second outdoor photo" (hovamenjek.hu) are one picture, re-encoded at another
// size — two URLs, so every URL-based comparison called them different, and the
// gate-opening template opened the hero onto ITSELF (owner, 2026-10-03: „ugyanaz a
// szétnyíló kép, mint ami mögötte van”).
//
// A 64-bit difference hash (dHash, 9×8 greyscale, left>right per row) survives re-encoding
// and resizing. Measured on that lead (hamming distance to the hero): the republished copy
// 4, a square crop of it 18, the place's other photos 27–40. NEAR_DUP_BITS (12) catches the
// copy with margin on both sides; a crop is NOT claimed to be the same picture.
//
// Deterministic, no AI. A failed download is OUR gap, not a finding: no hash, no claim.

import sharp from "sharp";

// The comparison itself (threshold included) lives in the engine, so a template can ask
// "same picture?" without importing an image library: ../engine/samePicture.ts.

/** 64-bit dHash of an image buffer as 16 hex digits. Throws if the buffer is not an image. */
export async function dHashFromBuffer(buf: Buffer): Promise<string> {
  const { data } = await sharp(buf)
    .greyscale()
    .resize(9, 8, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let bits = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      bits = (bits << 1n) | ((data[y * 9 + x] ?? 0) > (data[y * 9 + x + 1] ?? 0) ? 1n : 0n);
    }
  }
  return bits.toString(16).padStart(16, "0");
}

/** URL → dHash, or null when it cannot be downloaded / is not an image. */
export async function dHashUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "image/*,*/*;q=0.8",
      },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return null;
    return await dHashFromBuffer(buf);
  } catch {
    return null;
  }
}

/** How many outdoor candidates after the hero get fingerprinted (each is one download). */
const FINGERPRINT_CAP = 6;

/**
 * Attach `dhash` to the hero (photos[0]) and to the first FINGERPRINT_CAP photos whose
 * vision subject is in `subjects` — the only ones a "which other photo?" choice reads.
 * Order and set are unchanged; a photo that cannot be downloaded simply gets no hash.
 */
export async function fingerprintCandidates<T extends { url: string; subject?: string }>(
  photos: readonly T[],
  subjects: ReadonlySet<string>,
): Promise<(T & { dhash?: string })[]> {
  const picked = new Set<number>(photos.length ? [0] : []);
  for (let i = 1; i < photos.length && picked.size <= FINGERPRINT_CAP; i++) {
    const s = photos[i]!.subject;
    if (s && subjects.has(s)) picked.add(i);
  }
  const hashes = await Promise.all(
    photos.map((p, i) => (picked.has(i) ? dHashUrl(p.url) : Promise.resolve(null))),
  );
  return photos.map((p, i) => (hashes[i] ? { ...p, dhash: hashes[i]! } : p));
}
