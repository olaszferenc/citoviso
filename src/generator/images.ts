import { config } from "../config.js";
import { PlacesUnavailableError } from "../scraper/sources/googleMaps.js";
import { noteDeadKey } from "../console/keyDeath.js";

// Resolve a Google Places photo resource name to a key-less image URL via the
// Photo Media endpoint (skipHttpRedirect=true → the googleusercontent URL).
// This keeps the API key out of the generated mock HTML.
//
// ⛔ Same rule as placesLookup: a photo we could not FETCH throws, a photo Google
// has no URL for returns null. Swallowing the first one turned a spent quota into
// "this lead has no photos" on the console (measured 2026-09-09).
export async function resolvePlacesPhoto(
  name: string,
  maxWidth = 1200,
): Promise<string | null> {
  const url =
    `https://places.googleapis.com/v1/${name}/media` +
    `?maxWidthPx=${maxWidth}&skipHttpRedirect=true&key=${config.googleMapsGeneratorKey}`;
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  } catch (e) {
    throw new PlacesUnavailableError(
      "network",
      undefined,
      (e as Error).message,
    );
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new PlacesUnavailableError(
      /RESOURCE_EXHAUSTED|quota/i.test(body) || res.status === 429
        ? "quota"
        : res.status === 401 || res.status === 403
          ? (noteDeadKey("places", `photo media HTTP ${res.status}: ${body.slice(0, 200)}`), "auth")
          : "upstream",
      res.status,
      body.slice(0, 300),
    );
  }
  const data = (await res.json()) as { photoUri?: string };
  return data.photoUri ?? null;
}

/**
 * Resolve up to `limit` photo refs. A PARTIAL failure is tolerated (one dead ref must
 * not cost the whole strip), but if every attempt failed for an infrastructure reason
 * the error PROPAGATES — an empty array would be indistinguishable from "no photos".
 */
export async function resolvePhotos(
  refs: string[],
  limit = 6,
): Promise<string[]> {
  const wanted = refs.slice(0, limit);
  const settled = await Promise.allSettled(
    wanted.map((r) => resolvePlacesPhoto(r)),
  );
  const urls = settled
    .filter(
      (s): s is PromiseFulfilledResult<string | null> =>
        s.status === "fulfilled",
    )
    .map((s) => s.value)
    .filter((u): u is string => Boolean(u));
  if (!urls.length && wanted.length) {
    const failure = settled.find(
      (s): s is PromiseRejectedResult =>
        s.status === "rejected" && s.reason instanceof PlacesUnavailableError,
    );
    if (failure) throw failure.reason;
  }
  return urls;
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
      .resize({
        width: VISION_MAX_EDGE,
        height: VISION_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: VISION_JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
    return { buf: out, mediaType: "image/jpeg" };
  } catch {
    return { buf, mediaType };
  }
}

/**
 * The API's many-image rule: a request with MORE than 20 images accepts none over 2000 px on
 * its long edge — the whole call is refused (Sárgarózsa 3419993e, 2026-10-27: 22 photos, one of
 * 2048 × 1536 → no hero verdict at all, „Nyitókép: error”, the room card on the bathroom).
 */
export const MANY_IMAGES = 20;
export const MANY_IMAGES_MAX_EDGE = 2000;

/** Inlined blocks of a > MANY_IMAGES request, each brought within MANY_IMAGES_MAX_EDGE. */
export async function fitManyImageRequest(blocks: readonly ImageBlock[]): Promise<ImageBlock[]> {
  if (blocks.length <= MANY_IMAGES) return [...blocks];
  const { default: sharp } = await import("sharp");
  return Promise.all(
    blocks.map(async (b) => {
      if (b.source.type !== "base64") return b;
      try {
        const buf = Buffer.from(b.source.data, "base64");
        const meta = await sharp(buf, { failOn: "none" }).metadata();
        if (Math.max(meta.width ?? 0, meta.height ?? 0) <= MANY_IMAGES_MAX_EDGE) return b;
        const out = await sharp(buf, { failOn: "none" })
          .resize({ width: MANY_IMAGES_MAX_EDGE, height: MANY_IMAGES_MAX_EDGE, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: VISION_JPEG_QUALITY, mozjpeg: true })
          .toBuffer();
        return { type: "image", source: { type: "base64", media_type: "image/jpeg", data: out.toString("base64") } } as ImageBlock;
      } catch {
        return b;
      }
    }),
  );
}

/** The image types the API accepts in a block (anything else fails the whole request). */
export const API_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

/** Re-encode an image the API does not read (AVIF, HEIC, TIFF …) as JPEG; the input on failure. */
export async function asJpeg(buf: Buffer, mediaType: string): Promise<{ raw: Buffer; mediaType: string }> {
  try {
    const { default: sharp } = await import("sharp");
    const out = await sharp(buf, { failOn: "none" }).rotate().jpeg({ quality: VISION_JPEG_QUALITY, mozjpeg: true }).toBuffer();
    return { raw: out, mediaType: "image/jpeg" };
  } catch {
    return { raw: buf, mediaType };
  }
}

/** Image content block as the Anthropic SDK expects it (remote url, or inlined bytes). */
export type ImageBlock =
  | { type: "image"; source: { type: "url"; url: string } }
  | {
      type: "image";
      source: { type: "base64"; media_type: string; data: string };
    };

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
 * Best-effort per image — but a failure DROPS the image instead of falling back
 * to the plain URL. The URL fallback was a poison pill: what OUR fetch cannot
 * reach (hotlink guard, Cloudflare), Anthropic's fetcher cannot either, and one
 * such block fails the WHOLE call with "Unable to download the file" — the brief
 * then silently degrades to generic copy (measured 2026-09-05, szalas.hu set).
 * Losing one photo's grounding beats losing the entire generation.
 */
export async function toImageBlocks(
  urls: readonly string[],
): Promise<ImageBlock[]> {
  const blocks = await Promise.all(urls.map((url) => toImageBlock(url)));
  return blocks.filter((b): b is ImageBlock => b !== null);
}

/**
 * One URL → one vision block, or null when it cannot be fetched/inlined.
 *
 * Split out of toImageBlocks because a caller sometimes needs to know WHICH photo a
 * block belongs to: toImageBlocks drops failures, so its output indexes no longer line
 * up with the input list. The hero picker (heroPick.ts) scores photos one by one and
 * must keep each verdict attached to its own URL — an index shift there would attribute
 * "outdoor toilet" to the neighbouring photo.
 */
export async function toImageBlock(url: string): Promise<ImageBlock | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      // Portal image hosts serve browsers and block bare clients.
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "image/*,*/*;q=0.8",
      },
    });
    if (!res.ok) return null;
    const mediaTypeIn =
      (res.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
    if (!mediaTypeIn.startsWith("image/")) return null;
    const fetched = Buffer.from(await res.arrayBuffer());
    if (!fetched.length) return null;
    // The API reads JPEG, PNG, GIF and WebP only: an AVIF (or any other) block refuses the
    // WHOLE call, every photo's verdict with it (Ametiszt ce2f06ec, 2026-10-27: an all-.avif
    // own site, no verdict at all, the room card on a garden shot) → re-encode as JPEG.
    const { raw, mediaType } = API_IMAGE_TYPES.has(mediaTypeIn)
      ? { raw: fetched, mediaType: mediaTypeIn }
      : await asJpeg(fetched, mediaTypeIn);
    if (!API_IMAGE_TYPES.has(mediaType)) return null;
    // Full resolution by default — the model reads real features off these photos, and
    // shrinking them measurably costs facts (see VISION_MAX_EDGE). Shrink ONLY when the
    // image would otherwise be dropped for size, where the alternative is no grounding.
    const sized =
      raw.length > MAX_INLINE_BYTES
        ? await shrinkForVision(raw, mediaType)
        : { buf: raw, mediaType };
    if (sized.buf.length > MAX_INLINE_BYTES) return null;
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: sized.mediaType,
        data: sized.buf.toString("base64"),
      },
    };
  } catch {
    return null;
  }
}

// Street View Static image URL — guaranteed baseline building shot.
// NOTE: this URL embeds the API key; for production, proxy/download. Fine for
// local mocks. (Restrict the key to referrers/IPs.)
export function streetViewUrl(
  lat: number,
  lon: number,
  w = 1600,
  h = 700,
): string {
  return (
    `https://maps.googleapis.com/maps/api/streetview` +
    `?size=${w}x${h}&location=${lat},${lon}&fov=80&pitch=0&key=${config.googleMapsGeneratorKey}`
  );
}
