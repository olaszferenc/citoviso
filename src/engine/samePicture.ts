// "Same picture?" on two stored dHashes — pure, no image library (the hashing itself is
// src/generator/photoHash.ts, which explains the measurement behind the threshold).

/** Hamming distance at or below which two hashes are the same picture. */
export const NEAR_DUP_BITS = 12;

/** Number of differing bits between two hex dHashes; null if either is malformed. */
export function hashDistance(a: string, b: string): number | null {
  if (!/^[0-9a-f]{16}$/.test(a) || !/^[0-9a-f]{16}$/.test(b)) return null;
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let n = 0;
  while (x) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}

/** Are these the same picture? Unknown (a missing hash) is NOT a match. */
export function isSamePicture(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const d = hashDistance(a, b);
  return d !== null && d <= NEAR_DUP_BITS;
}
