import { config } from "../config.js";

// Resolve a Google Places photo resource name to a key-less image URL via the
// Photo Media endpoint (skipHttpRedirect=true → the googleusercontent URL).
// This keeps the API key out of the generated mock HTML.
export async function resolvePlacesPhoto(
  name: string,
  maxWidth = 1200,
): Promise<string | null> {
  const url =
    `https://places.googleapis.com/v1/${name}/media` +
    `?maxWidthPx=${maxWidth}&skipHttpRedirect=true&key=${config.googleMapsApiKey}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { photoUri?: string };
    return data.photoUri ?? null;
  } catch {
    return null;
  }
}

export async function resolvePhotos(
  refs: string[],
  limit = 6,
): Promise<string[]> {
  const urls = await Promise.all(
    refs.slice(0, limit).map((r) => resolvePlacesPhoto(r)),
  );
  return urls.filter((u): u is string => Boolean(u));
}

/** Anthropic's per-image ceiling is 5 MB; stay clear of it after base64 inflation (~33%). */
const MAX_INLINE_BYTES = 3_000_000;

/**
 * Long edge (px) used ONLY to rescue an image too large to inline. NOT a cost lever —
 * MEASURED AND REJECTED as one (2026-08-29).
 *
 * The idea was sound on price: a full-resolution portal photo (2000×1423) costs 3 680 vision
 * tokens vs 1 007 at 1024px, and a generation sends 8 photos — a 57% cheaper mock ($0.197 →
 * $0.085). It failed on TRUTH. Same lead, same prompt, the claim "légkondicionált" (which the
 * source data states outright, and an AC unit is visible in a photo):
 *
 *   full resolution   3/3 correct   0/3 fabricated   0/3 omitted   $0.1972
 *   1568px            1/3 correct   1/3 fabricated   1/3 omitted   $0.1374
 *   1024px            0/3 correct   1/3 fabricated   2/3 omitted   $0.0853
 *
 * Shrunk, the model stops seeing the unit — and once wrote "ventilátoros szobák", a fact
 * that appears nowhere in the data. §B.17 is not negotiable, so the pixels stay.
 *
 * What downscaling IS good for: an image over MAX_INLINE_BYTES used to fall back to its plain
 * URL, which Cloudflare then blocks — losing the grounding for that photo entirely. Shrinking
 * it is strictly better than dropping it. Override with VISION_MAX_EDGE to re-measure.
 */
const VISION_MAX_EDGE = Number(process.env.VISION_MAX_EDGE ?? "1568");

/** JPEG quality for the downscaled grounding copy — visually ample for palette/mood. */
const VISION_JPEG_QUALITY = 82;

/**
 * Shrink to VISION_MAX_EDGE for the model. Best-effort: any failure returns the original
 * bytes, so a broken native binary costs money, never a generation.
 */
async function shrinkForVision(
  buf: Buffer,
  mediaType: string,
): Promise<{ buf: Buffer; mediaType: string }> {
  if (!(VISION_MAX_EDGE > 0)) return { buf, mediaType };
  try {
    const { default: sharp } = await import("sharp");
    const img = sharp(buf, { failOn: "none" });
    const meta = await img.metadata();
    const longEdge = Math.max(meta.width ?? 0, meta.height ?? 0);
    if (!longEdge || longEdge <= VISION_MAX_EDGE) return { buf, mediaType };
    const out = await img
      .resize({ width: VISION_MAX_EDGE, height: VISION_MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: VISION_JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
    return { buf: out, mediaType: "image/jpeg" };
  } catch {
    return { buf, mediaType };
  }
}

/** Image content block as the Anthropic SDK expects it (remote url, or inlined bytes). */
export type ImageBlock =
  | { type: "image"; source: { type: "url"; url: string } }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

/**
 * URLs → vision content blocks, fetching the bytes OURSELVES and inlining them.
 *
 * Why not just hand the API the URL: portal listings sit behind Cloudflare, which
 * serves US fine but blocks Anthropic's fetcher — the call then fails with "Unable to
 * download the file" and the brief silently falls back to generic copy with no palette.
 * That surfaced the moment portal photos became the grounding set (2026-08-21). We can
 * always fetch what we scraped, so we do, and the model grounds on the SAME photos the
 * page will show.
 *
 * Best-effort per image: anything that fails to download, is not an image, or is too
 * large falls back to the plain URL — this never throws at the caller.
 */
export async function toImageBlocks(urls: readonly string[]): Promise<ImageBlock[]> {
  return Promise.all(
    urls.map(async (url): Promise<ImageBlock> => {
      const urlBlock: ImageBlock = { type: "image", source: { type: "url", url } };
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
        if (!res.ok) return urlBlock;
        const mediaType = (res.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";
        if (!mediaType.startsWith("image/")) return urlBlock;
        const raw = Buffer.from(await res.arrayBuffer());
        if (!raw.length) return urlBlock;
        // Full resolution by default — the model reads real features off these photos, and
        // shrinking them measurably costs facts (see VISION_MAX_EDGE). Shrink ONLY when the
        // image would otherwise be dropped for size, where the alternative is no grounding.
        const sized =
          raw.length > MAX_INLINE_BYTES ? await shrinkForVision(raw, mediaType) : { buf: raw, mediaType };
        if (sized.buf.length > MAX_INLINE_BYTES) return urlBlock;
        return {
          type: "image",
          source: {
            type: "base64",
            media_type: sized.mediaType,
            data: sized.buf.toString("base64"),
          },
        };
      } catch {
        return urlBlock;
      }
    }),
  );
}

// Street View Static image URL — guaranteed baseline building shot.
// NOTE: this URL embeds the API key; for production, proxy/download. Fine for
// local mocks. (Restrict the key to referrers/IPs.)
export function streetViewUrl(lat: number, lon: number, w = 1600, h = 700): string {
  return (
    `https://maps.googleapis.com/maps/api/streetview` +
    `?size=${w}x${h}&location=${lat},${lon}&fov=80&pitch=0&key=${config.googleMapsApiKey}`
  );
}
