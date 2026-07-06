import { config } from "../../config.js";
import type { Industry, RawLead, ScrapeQuery } from "../types.js";
import type { LeadSource } from "./LeadSource.js";

// Google Maps via the official Places API (New) — legally clean route. Requires
// GOOGLE_MAPS_API_KEY. Without a key the source skips itself so OSM still runs.
// A Playwright-based Maps-scrape adapter can be added later behind the same interface.
const PLACES_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

// Field mask: request exactly the fields we map to RawLead (keeps cost/response small).
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.photos", // enrichment material — photo count for the mock
].join(",");

const TEXT_QUERY: Record<Industry, string> = {
  accommodation: "szállás",
};

interface PlacesResponse {
  places?: Array<{
    id: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
    websiteUri?: string;
    nationalPhoneNumber?: string;
    photos?: Array<{ name?: string }>;
    rating?: number;
    userRatingCount?: number;
  }>;
}

/** A verified per-lead Places match with the signals A4 confidence scoring needs. */
export interface PlacesMatch {
  placeName: string;
  distanceMeters: number;
  nameSimilarity: number;
  rating?: number;
  userRatingCount?: number;
  phone?: string;
  website?: string;
  photoRefs: string[];
}

// ~half-degree box side used to hard-restrict the per-lead lookup to the lead's
// immediate area (≈±550m lat / ≈±420m lng at 47°N). A soft locationBias would let
// Places return a same-name place in another town — a catastrophic photo mismatch.
// Within the box, the match is SCORED (A4 confidence), not hard-accepted.
const LOOKUP_BOX_DEG = 0.005;

function metersBetween(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Jaccard token overlap between two names (0..1) — a name-similarity signal. */
function nameSimilarity(a: string, b: string): number {
  const ta = new Set(normName(a).split(" ").filter(Boolean));
  const tb = new Set(normName(b).split(" ").filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / new Set([...ta, ...tb]).size;
}

/**
 * Per-lead Places lookup. Hard-restricts to the lead's area (box), then returns
 * the CLOSEST in-box candidate whose name plausibly overlaps the lead name,
 * WITH the signals A4 confidence scoring needs (distance, name similarity,
 * rating/count). The caller scores and gates — so a weak match is dropped, not
 * blindly used. Returns null when nothing in the area even plausibly matches.
 */
export async function placesLookup(
  name: string,
  lat: number,
  lon: number,
  apiKey: string,
): Promise<PlacesMatch | null> {
  const res = await fetch(PLACES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.displayName,places.location,places.websiteUri,places.nationalPhoneNumber,places.photos,places.rating,places.userRatingCount",
    },
    body: JSON.stringify({
      textQuery: name,
      // HARD restriction (not a soft bias) — only places inside this box qualify.
      locationRestriction: {
        rectangle: {
          low: { latitude: lat - LOOKUP_BOX_DEG, longitude: lon - LOOKUP_BOX_DEG },
          high: { latitude: lat + LOOKUP_BOX_DEG, longitude: lon + LOOKUP_BOX_DEG },
        },
      },
      maxResultCount: 5,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as PlacesResponse;
  const places = data.places ?? [];
  if (!places.length) return null;

  // Pick the closest in-box candidate with at least a plausible name overlap.
  const targetTokens = normName(name)
    .split(" ")
    .filter((t) => t.length > 3);
  let best: NonNullable<PlacesResponse["places"]>[number] | undefined;
  let bestDist = Infinity;
  for (const p of places) {
    const loc = p.location;
    if (!loc) continue;
    const d = metersBetween(lat, lon, loc.latitude, loc.longitude);
    if (d >= bestDist) continue;
    const cand = normName(p.displayName?.text ?? "");
    const nameOk =
      targetTokens.length === 0 || targetTokens.some((t) => cand.includes(t));
    if (!nameOk) continue;
    best = p;
    bestDist = d;
  }
  if (!best) return null;

  const photoRefs = (best.photos ?? [])
    .map((ph) => ph.name)
    .filter((n): n is string => Boolean(n));
  return {
    placeName: best.displayName?.text ?? name,
    distanceMeters: bestDist,
    nameSimilarity: nameSimilarity(name, best.displayName?.text ?? ""),
    rating: best.rating,
    userRatingCount: best.userRatingCount,
    phone: best.nationalPhoneNumber,
    website: best.websiteUri,
    photoRefs,
  };
}

export class GoogleMapsSource implements LeadSource {
  readonly name = "google_places";

  async fetch(query: ScrapeQuery): Promise<RawLead[]> {
    const key = config.googleMapsApiKey;
    if (!key) {
      console.warn(
        "[google_places] GOOGLE_MAPS_API_KEY not set — skipping this source.",
      );
      return [];
    }
    const [s, w, n, e] = query.region.bbox;
    const res = await fetch(PLACES_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: TEXT_QUERY[query.industry],
        locationRestriction: {
          rectangle: {
            low: { latitude: s, longitude: w },
            high: { latitude: n, longitude: e },
          },
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      throw new Error(`Places request failed: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as PlacesResponse;
    const leads: RawLead[] = [];
    for (const p of data.places ?? []) {
      const name = p.displayName?.text;
      if (!name) continue;
      leads.push({
        source: this.name,
        sourceId: p.id,
        name,
        lat: p.location?.latitude,
        lon: p.location?.longitude,
        address: p.formattedAddress,
        phone: p.nationalPhoneNumber,
        website: p.websiteUri,
        photoCount: p.photos?.length ?? 0,
      });
    }
    return leads;
  }
}
