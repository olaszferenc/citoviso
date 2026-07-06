// Google Street View Image Metadata API — metadata requests are FREE (not billed).
// Tells us whether street-level imagery exists at the lead's coordinates: a
// guaranteed baseline photo (the building/street) even when nothing else exists.
// Needs GOOGLE_MAPS_API_KEY with "Street View Static API" enabled on the key.

const METADATA_ENDPOINT =
  "https://maps.googleapis.com/maps/api/streetview/metadata";

export async function hasStreetView(
  lat: number,
  lon: number,
  apiKey: string,
): Promise<boolean> {
  const url = `${METADATA_ENDPOINT}?location=${lat},${lon}&key=${apiKey}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return false;
    const data = (await res.json()) as { status?: string };
    return data.status === "OK";
  } catch {
    return false;
  }
}
