// IS THIS IMAGE ACTUALLY A PHOTO OF THIS PROPERTY? (2026-08-21)
//
// A portal listing page carries far more <img> tags than the property's gallery:
// language-switcher flags, ad banners, article thumbnails, map graphics, social
// share links. Measured on the first real harvest (607 scraped images, Balaton
// north shore) the junk was not marginal — two of eight leads would have rendered a
// MISATTRIBUTED hero: a village church for a campsite (350×262, from a travel
// article) and a generic countryside shot for a guesthouse (608×352, off Booking's
// /images/city/ path). That is a §B.17 breach, not a cosmetic flaw: the mock tells
// the owner "this is your place" while showing the village church.
//
// The rule the owner chose (2026-08-21): keep every SOURCE, but filter by SIZE and
// by URL shape. A real property photo is big — 800 px on the long edge is the floor
// for something that has to work as a hero. That single threshold also removes the
// icons (32×22), the thumbnails (150×150, 320×320) and the standard ad formats
// (300×250), and it happens to remove both misattribution cases above.
//
// Deliberately NOT a source allowlist: airbnb, booking and szallaskereso all serve
// genuine property galleries while sitting on the generic adapter (ADR-0037 curator
// promotion is a separate, slower track).

/** Long-edge floor in pixels — below this an image cannot carry a hero (owner ruling). */
export const MIN_LONG_EDGE = 800;

/**
 * URL shapes that are never a photo OF the property, whatever their size.
 * Each entry is a real case from the first harvest, not a hypothetical.
 */
const URL_DENY: ReadonlyArray<{ re: RegExp; why: string }> = [
  // A share widget's target, not an image at all (szallaskereso.com).
  { re: /pinterest\.[a-z.]+\/pin\/create/i, why: "megosztó-link, nem kép" },
  { re: /(facebook|twitter|x)\.com\/(sharer|share|intent)/i, why: "megosztó-link, nem kép" },
  // Generic place imagery offered beside a listing: Booking's /images/city/ stock, and
  // the "telepules-kepek" (settlement photos) folders town portals keep. Both attach a
  // village view to a property — the exact §B.17 misattribution this file exists for.
  { re: /\/xdata\/images\/(city|region|landmark)\//i, why: "város/régió stock-kép, nem a szállás" },
  { re: /telepules-?kepek|varos-?kepek|town-?photos/i, why: "település-kép, nem a szállás" },
  // Editorial thumbnails from travel articles (ittjartam.hu: "10 izgalmas étterme…").
  { re: /\/(cikkek|articles|blog|news|hirek)\//i, why: "cikk-illusztráció, nem a szállás" },
  // Site chrome that lives under obvious UI paths.
  { re: /\/(icons?|flags?|logos?|banners?|ads?|hirdetes)\//i, why: "felület-elem vagy hirdetés" },
  { re: /\/(gb|hu|de|en|ru)-\d{1,3}x\d{1,3}\.(png|gif|svg)$/i, why: "nyelvváltó zászló-ikon" },
  // Map graphics offered as "the area" (balatoni-szallaskereso.hu).
  { re: /terkep|\bmap\b/i, why: "térkép-grafika, nem fotó" },
  { re: /\.svg(\?|$)/i, why: "vektorgrafika — felület-elem, nem fotó" },
];

/**
 * Widest shape a real photo takes. Calibrated on the first harvest rather than guessed:
 * the page banners were all 980×240 (4.08:1) while the widest genuine property shot — a
 * guesthouse with its pool — was 980×360 (2.72:1). A 2.5 cutoff would have thrown that
 * one away, so the line sits at 3.0, between the evidence.
 */
const MAX_ASPECT = 3.0;

/**
 * Standard display-ad formats. Real photos land on these numbers only by accident.
 * Kept as pairs because the size shows up in the FILENAME too, and not always with an
 * "x" between the numbers — balaton.hu ships its banner as `AP_300_250.png`.
 */
const AD_SIZES: ReadonlyArray<readonly [number, number]> = [
  [300, 250], [336, 280], [728, 90], [970, 250], [160, 600], [300, 600], [320, 50], [468, 60],
];

function isAdSize(width: number, height: number): boolean {
  return AD_SIZES.some(([w, h]) => w === width && h === height);
}

/** Does the file NAME itself advertise a standard banner format (`AP_300_250.png`)? */
function urlNamesAdSize(url: string): boolean {
  const name = url.split("?")[0]!.split("/").pop() ?? "";
  return AD_SIZES.some(([w, h]) =>
    new RegExp(`(^|[^0-9])${w}[^0-9]{1,2}${h}([^0-9]|$)`).test(name),
  );
}

/**
 * Dimensions encoded in the URL path, as most portals do for their derivatives
 * (`/150x150w/`, `/320x320r/`, `/281x175/`, `-350x262.webp`). Returns null when the
 * URL says nothing — absence of evidence, never evidence of a big image.
 */
export function dimensionsFromUrl(url: string): { width: number; height: number } | null {
  const m = /[/_-](\d{2,4})x(\d{2,4})[a-z]?(?=[/._-]|$)/i.exec(url);
  if (!m) return null;
  const width = Number(m[1]);
  const height = Number(m[2]);
  return width > 0 && height > 0 ? { width, height } : null;
}

export interface PhotoLike {
  readonly url: string;
  readonly width?: number | undefined;
  readonly height?: number | undefined;
}

export type PhotoVerdict = { usable: true } | { usable: false; why: string };

/**
 * May this image be attributed to the property and rendered?
 *
 * Known dimensions decide; where none are known the URL is the only evidence, and a
 * URL that ADVERTISES a small derivative is taken at its word. An image of genuinely
 * unknown size passes — the ingest probe is what supplies certainty (probeImageSize),
 * and being silently dropped for lack of metadata would cost real photos.
 */
export function judgePhoto(p: PhotoLike): PhotoVerdict {
  for (const { re, why } of URL_DENY) {
    if (re.test(p.url)) return { usable: false, why };
  }
  if (urlNamesAdSize(p.url)) {
    return { usable: false, why: "a fájlnév szabványos hirdetés-méretet hirdet" };
  }
  const known =
    p.width && p.height ? { width: p.width, height: p.height } : dimensionsFromUrl(p.url);
  if (!known) return { usable: true };
  if (isAdSize(known.width, known.height)) {
    return { usable: false, why: `szabványos hirdetés-méret (${known.width}×${known.height})` };
  }
  const longEdge = Math.max(known.width, known.height);
  if (longEdge < MIN_LONG_EDGE) {
    return { usable: false, why: `túl kicsi (${known.width}×${known.height}, min. ${MIN_LONG_EDGE}px)` };
  }
  const aspect = longEdge / Math.min(known.width, known.height);
  if (aspect >= MAX_ASPECT) {
    return { usable: false, why: `szalag-arány (${known.width}×${known.height}) — oldal-banner, nem fotó` };
  }
  return { usable: true };
}

/** Convenience wrapper for the common "filter a set" call. */
export function isUsablePropertyPhoto(p: PhotoLike): boolean {
  return judgePhoto(p).usable;
}

// ─────────────────────────── measuring (ingest only) ────────────────────────────
// Only 8 of the first 607 scraped images carried dimensions, and only 213 encoded
// them in the URL — so the size rule is worthless without measuring. We read the
// image HEADER instead of the file: a Range request for the first 64 KB is enough
// for every format below, which keeps a 60-image listing cheap and polite.

/** How much of the file we ask for — JPEG needs the most, its SOF can sit deep. */
const PROBE_BYTES = 65_536;

/** Pixel dimensions from the leading bytes of an encoded image; null if undecidable. */
export function dimensionsFromHeader(b: Buffer): { width: number; height: number } | null {
  // PNG: 8-byte signature, then the IHDR chunk carries width/height big-endian.
  if (b.length >= 24 && b.readUInt32BE(0) === 0x89504e47) {
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  }
  // GIF: logical screen descriptor, little-endian, right after "GIF87a"/"GIF89a".
  if (b.length >= 10 && b.toString("ascii", 0, 3) === "GIF") {
    return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
  }
  // WebP: RIFF container; VP8X and VP8 (lossy) cover what portals actually serve.
  if (b.length >= 30 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const chunk = b.toString("ascii", 12, 16);
    if (chunk === "VP8X") {
      return {
        width: (b.readUIntLE(24, 3) & 0xffffff) + 1,
        height: (b.readUIntLE(27, 3) & 0xffffff) + 1,
      };
    }
    if (chunk === "VP8 ") {
      const start = b.indexOf(Buffer.from([0x9d, 0x01, 0x2a]));
      if (start > 0 && b.length >= start + 7) {
        return {
          width: b.readUInt16LE(start + 3) & 0x3fff,
          height: b.readUInt16LE(start + 5) & 0x3fff,
        };
      }
    }
    if (chunk === "VP8L" && b.length >= 25) {
      const bits = b.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    return null;
  }
  // JPEG: walk the marker segments to the frame header (SOF0..SOFF, minus the
  // non-frame markers), which is the only place the real dimensions live.
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = b[i + 1]!;
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      const len = b.readUInt16BE(i + 2);
      const isFrame =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isFrame) return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
      if (len < 2) return null;
      i += 2 + len;
    }
  }
  return null;
}

/** Measure one image over the network. Best-effort: null when it cannot be decided. */
export async function probeImageSize(url: string): Promise<{ width: number; height: number } | null> {
  try {
    const res = await fetch(url, {
      headers: { Range: `bytes=0-${PROBE_BYTES - 1}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok && res.status !== 206) return null;
    if (!(res.headers.get("content-type") ?? "").startsWith("image/")) return null;
    return dimensionsFromHeader(Buffer.from(await res.arrayBuffer()));
  } catch {
    return null;
  }
}

/**
 * Ingest filter: drop what is obviously not a property photo, MEASURE the rest, and
 * return the survivors with their true dimensions recorded.
 *
 * Measuring happens after the cheap rules so an ad banner or a share link never costs
 * a request. An image we still cannot measure is KEPT — the alternative is silently
 * discarding real photos because a host is stingy with headers.
 */
export async function keepUsablePhotos<T extends PhotoLike>(
  photos: readonly T[],
  onDrop?: (photo: T, why: string) => void,
): Promise<T[]> {
  const out: T[] = [];
  for (const p of photos) {
    const cheap = judgePhoto(p);
    if (!cheap.usable) {
      onDrop?.(p, cheap.why);
      continue;
    }
    if (p.width && p.height) {
      out.push(p);
      continue;
    }
    const size = (await probeImageSize(p.url)) ?? dimensionsFromUrl(p.url);
    if (!size) {
      out.push(p); // unmeasurable — keep rather than lose a real photo
      continue;
    }
    const measured = { ...p, width: size.width, height: size.height };
    const verdict = judgePhoto(measured);
    if (verdict.usable) out.push(measured);
    else onDrop?.(p, verdict.why);
  }
  return out;
}
