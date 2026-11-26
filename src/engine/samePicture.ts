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

/**
 * One file under several SIZE folders is one picture (Vörösmarty tér, 2026-11-24: booked.hu served
 * the same photo as …/500x500w/… and …/OriginalPhoto/…; the square crop's dHash differs, so the
 * fingerprint alone let the gate leaf open onto the hero). Host + path without size segments.
 */
// 2026-11-26 (Peresi paradicsom): booked.hu served the hero as …/OriginalPhoto/… on one subdomain and the band as
// …/Big/… on another — same photo id, two crops, two keys. The key is the REGISTRABLE domain (no subdomain) and the
// path without any size word, „big / huge / xl / hd” included.
const SIZE_SEGMENT = /^(?:\d+x\d*\w*|\d*x\d+\w*|original\w*|orig|fullhd|full|large|big|huge|xl|xxl|hd|medium|small|thumbs?|thumbnail\w*|w\d+|h\d+)$/i;
function registrableHost(host: string): string {
  const parts = host.toLowerCase().split(".").filter(Boolean);
  // co.uk-style public suffixes keep three labels; everything else two.
  const keep = parts.length >= 3 && /^(?:co|com|org|net|gov|ac)$/.test(parts[parts.length - 2]!) && parts[parts.length - 1]!.length === 2 ? 3 : 2;
  return parts.slice(-keep).join(".");
}
export function sizelessPhotoKey(url: string): string {
  try {
    const u = new URL(url);
    const segs = u.pathname.split("/").filter((x) => x && !SIZE_SEGMENT.test(x));
    return `${registrableHost(u.host)}/${segs.join("/").toLowerCase()}`;
  } catch {
    return url.toLowerCase();
  }
}
