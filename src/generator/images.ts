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

// Street View Static image URL — guaranteed baseline building shot.
// NOTE: this URL embeds the API key; for production, proxy/download. Fine for
// local mocks. (Restrict the key to referrers/IPs.)
export function streetViewUrl(lat: number, lon: number, w = 1600, h = 700): string {
  return (
    `https://maps.googleapis.com/maps/api/streetview` +
    `?size=${w}x${h}&location=${lat},${lon}&fov=80&pitch=0&key=${config.googleMapsApiKey}`
  );
}
