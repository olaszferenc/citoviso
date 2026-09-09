import { config } from "../../config.js";
import type { Industry, RawLead, ScrapeQuery } from "../types.js";
import type { LeadSource } from "./LeadSource.js";

// Google Maps via the official Places API (New) — legally clean route. Requires
// GOOGLE_MAPS_API_KEY. Without a key the source skips itself so OSM still runs.
// A Playwright-based Maps-scrape adapter can be added later behind the same interface.
const PLACES_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

// Field mask: request exactly the fields we map to RawLead (keeps cost/response small).
// addressComponents is what carries the structured country/city (the filter facets);
// formattedAddress alone is a human string we cannot reliably split.
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.location",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.photos", // enrichment material — photo count for the mock
].join(",");

/** One Google Places address component (as returned under `addressComponents`). */
export interface AddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

/**
 * Country (ISO-2 code) + city/locality from Places `addressComponents`. Country uses
 * the shortText (already an ISO 3166-1 alpha-2 code); city falls back through the
 * locality hierarchy so smaller places still resolve to a town name.
 */
export function localityFromComponents(components?: AddressComponent[]): {
  country?: string;
  city?: string;
} {
  if (!components?.length) return {};
  const byType = (t: string) => components.find((c) => c.types?.includes(t));
  const cc = byType("country")?.shortText?.trim().toUpperCase();
  const cityComp =
    byType("locality") ??
    byType("postal_town") ??
    byType("administrative_area_level_2") ??
    byType("administrative_area_level_3") ??
    byType("administrative_area_level_1");
  const city = cityComp?.longText?.trim();
  return { country: cc || undefined, city: city || undefined };
}

const TEXT_QUERY: Record<Industry, string> = {
  accommodation: "szállás",
};

interface PlacesResponse {
  places?: Array<{
    id: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    addressComponents?: AddressComponent[];
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
  /** Place ID — the stable handle that makes the match openable on Maps. */
  placeId?: string;
  placeName: string;
  distanceMeters: number;
  nameSimilarity: number;
  rating?: number;
  userRatingCount?: number;
  phone?: string;
  website?: string;
  photoRefs: string[];
  /** ISO-2 country + city from the match's addressComponents (geo facets). */
  country?: string;
  city?: string;
}

/**
 * Why a Places call could not be MADE. Machine code, never a caption — the caller
 * words it for its own audience (the console wraps it in T(), a log prints it raw).
 */
export type PlacesFailure =
  /** Our own daily/per-minute quota is spent (HTTP 429, RESOURCE_EXHAUSTED). */
  | "quota"
  /** The key is rejected, restricted, or the project has no billing (401/403). */
  | "auth"
  /** The request never completed: DNS, TLS, timeout. */
  | "network"
  /** Google answered, but with an error we did not cause (5xx) or cannot classify. */
  | "upstream";

/**
 * The lookup could not be PERFORMED — as opposed to "nothing matches here", which
 * stays a plain `null`. Collapsing the two into one silent null is what made the
 * console print "this lead has no photos" on 2026-09-09, when the truth was that our
 * own SearchText day-quota had run out (HTTP 429, measured). A missing answer and a
 * negative answer are different facts and must reach the operator as different words.
 */
export class PlacesUnavailableError extends Error {
  constructor(
    readonly failure: PlacesFailure,
    readonly status?: number,
    readonly detail?: string,
  ) {
    super(
      `Places unavailable [${failure}]` +
        (status ? ` HTTP ${status}` : "") +
        (detail ? `: ${detail}` : ""),
    );
    this.name = "PlacesUnavailableError";
  }
}

/** HTTP status + error body → failure class. The body decides where the status is ambiguous:
 *  Google answers a spent quota with 429 OR with 403 + RESOURCE_EXHAUSTED. */
function classifyFailure(status: number, body: string): PlacesFailure {
  if (/RESOURCE_EXHAUSTED|quota/i.test(body)) return "quota";
  if (status === 429) return "quota";
  if (status === 401 || status === 403) return "auth";
  return "upstream";
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
 *
 * ⛔ null means "asked, nothing matches". When the question could not be ASKED at all
 * (quota, key, network) this THROWS PlacesUnavailableError — the caller must be able to
 * tell the two apart, because only one of them is a fact about the lead.
 */
export async function placesLookup(
  name: string,
  lat: number,
  lon: number,
  apiKey: string,
): Promise<PlacesMatch | null> {
  let res: Response;
  try {
    res = await fetch(PLACES_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        // places.id is Essentials-tier — free alongside the Pro fields already
        // requested here, and it is what makes the match linkable on Maps.
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.location,places.addressComponents,places.websiteUri,places.nationalPhoneNumber,places.photos,places.rating,places.userRatingCount",
      },
      body: JSON.stringify({
        textQuery: name,
        // HARD restriction (not a soft bias) — only places inside this box qualify.
        locationRestriction: {
          rectangle: {
            low: {
              latitude: lat - LOOKUP_BOX_DEG,
              longitude: lon - LOOKUP_BOX_DEG,
            },
            high: {
              latitude: lat + LOOKUP_BOX_DEG,
              longitude: lon + LOOKUP_BOX_DEG,
            },
          },
        },
        maxResultCount: 5,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    throw new PlacesUnavailableError(
      "network",
      undefined,
      (e as Error).message,
    );
  }
  if (!res.ok) {
    // The body carries Google's own reason ("Quota exceeded for … per day") — keep a
    // slice of it so the operator log names the limit, not just the status code.
    const body = await res.text().catch(() => "");
    throw new PlacesUnavailableError(
      classifyFailure(res.status, body),
      res.status,
      body.slice(0, 300),
    );
  }
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
  const { country, city } = localityFromComponents(best.addressComponents);
  return {
    placeId: best.id,
    placeName: best.displayName?.text ?? name,
    distanceMeters: bestDist,
    nameSimilarity: nameSimilarity(name, best.displayName?.text ?? ""),
    rating: best.rating,
    userRatingCount: best.userRatingCount,
    phone: best.nationalPhoneNumber,
    website: best.websiteUri,
    photoRefs,
    country,
    city,
  };
}

/** One Google Places review, verbatim (ADR-0106 guest-voice source). */
export interface PlaceReview {
  readonly text: string;
  readonly rating?: number;
  readonly author?: string;
  readonly publishedAt?: string;
}

interface PlaceDetailsReviews {
  reviews?: Array<{
    rating?: number;
    text?: { text?: string; languageCode?: string };
    originalText?: { text?: string; languageCode?: string };
    authorAttribution?: { displayName?: string };
    publishTime?: string;
  }>;
}

/**
 * The up-to-5 "most relevant" reviews of one place (Places Details, `reviews`
 * field only). ADR-0106: this is a ONE-OFF per-lead call on the generation
 * path (~$0.025), not a per-view display fetch — which is why the old
 * "review text is too expensive" ruling (site_place_rating) does not apply.
 * The caller stamps fetchedAt and honours the 30-day re-fetch rule.
 */
export async function fetchPlaceReviews(
  placeId: string,
  apiKey: string,
): Promise<PlaceReview[]> {
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "reviews",
      },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as PlaceDetailsReviews;
  const out: PlaceReview[] = [];
  for (const r of data.reviews ?? []) {
    // Prefer the reviewer's original words over Google's machine translation —
    // the translation is a paraphrase, and §B.17 evidence must be verbatim.
    const text = (r.originalText?.text ?? r.text?.text ?? "").trim();
    if (text.length < 30) continue; // a bare star or "Szuper!" grounds nothing
    out.push({
      text: text.slice(0, 1_000),
      rating: typeof r.rating === "number" ? r.rating : undefined,
      author: r.authorAttribution?.displayName?.trim() || undefined,
      publishedAt: r.publishTime,
    });
  }
  return out;
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
      const { country, city } = localityFromComponents(p.addressComponents);
      leads.push({
        source: this.name,
        sourceId: p.id,
        name,
        lat: p.location?.latitude,
        lon: p.location?.longitude,
        address: p.formattedAddress,
        country,
        city,
        phone: p.nationalPhoneNumber,
        website: p.websiteUri,
        photoCount: p.photos?.length ?? 0,
      });
    }
    return leads;
  }
}
