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
        const buf = Buffer.from(await res.arrayBuffer());
        if (!buf.length || buf.length > MAX_INLINE_BYTES) return urlBlock;
        return {
          type: "image",
          source: { type: "base64", media_type: mediaType, data: buf.toString("base64") },
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
