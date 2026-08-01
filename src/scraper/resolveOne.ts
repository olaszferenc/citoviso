// Resolve ONE business from a self-serve request (ADR-0022) into a QualifiedLead.
// PRIMARY path: the visitor drops a pin on the map → exact lat/lon → the existing
// coordinate-boxed placesLookup finds the business precisely (high A4 confidence,
// or, if it isn't on Maps at all, a coordinate-only lead for the zero-footprint
// segment). FALLBACK: name + town via Places Text Search, scored for confidence.
// The caller (intake) gates the auto-send on that confidence.

import { config } from "../config.js";
import type { QualifiedLead } from "./types.js";

const PLACES_TEXT_SEARCH = "https://places.googleapis.com/v1/places:searchText";

interface TextSearchPlace {
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  websiteUri?: string;
  nationalPhoneNumber?: string;
  photos?: { name?: string }[];
  rating?: number;
  userRatingCount?: number;
}

export interface ResolvedBusiness {
  readonly lead: QualifiedLead;
  /** 0..1 A4 confidence that this resolve IS the requested business. */
  readonly confidence: number;
  /** The canonical name Google returned (for the operator to sanity-check). */
  readonly resolvedName: string;
  readonly resolvedAddress: string | null;
  /** Was the business found on Google Maps at all? (false = zero-footprint segment.) */
  readonly onMap: boolean;
}

function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return normName(s).split(" ").filter((t) => t.length > 2);
}

function jaccard(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / new Set([...ta, ...tb]).size;
}

function containment(query: string, candidate: string): number {
  const q = tokens(query);
  if (!q.length) return 0;
  const c = new Set(tokens(candidate));
  let hit = 0;
  for (const t of q) if (c.has(t)) hit++;
  return hit / q.length;
}

function metersBetween(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Places Text Search biased to a circle (for the human-dropped pin, which is approximate). */
async function textSearchNear(
  name: string,
  lat: number,
  lon: number,
  apiKey: string,
  radius = 3000,
): Promise<TextSearchPlace[]> {
  const res = await fetch(PLACES_TEXT_SEARCH, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.displayName,places.formattedAddress,places.location," +
        "places.websiteUri,places.nationalPhoneNumber,places.photos," +
        "places.rating,places.userRatingCount",
    },
    body: JSON.stringify({
      textQuery: name,
      languageCode: "hu",
      regionCode: "HU",
      maxResultCount: 8,
      locationBias: { circle: { center: { latitude: lat, longitude: lon }, radius } },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { places?: TextSearchPlace[] };
  return data.places ?? [];
}

/**
 * Coordinate path (map pin). Uses the coordinate-boxed placesLookup, which hard-
 * restricts to ±~550m of the pin — so a same-name place in another town cannot
 * leak in. A found match ⇒ high confidence (the visitor pointed at it). No match
 * ⇒ a coordinate-only lead (Street View baseline) for the zero-footprint segment.
 */
async function resolveByPin(input: {
  name: string;
  town?: string;
  lat: number;
  lon: number;
}): Promise<ResolvedBusiness | null> {
  const apiKey = config.googleMapsApiKey;
  // A human-dropped pin is approximate → search a ~3km circle around it and pick
  // the candidate that best combines name match with proximity to the pin.
  const candidates = apiKey
    ? await textSearchNear(input.name, input.lat, input.lon, apiKey).catch(() => [])
    : [];

  let best: TextSearchPlace | undefined;
  let bestNameScore = 0;
  let bestDist = Infinity;
  let bestCombined = -1;
  for (const p of candidates) {
    const cand = p.displayName?.text ?? "";
    const nameScore = Math.max(jaccard(input.name, cand), containment(input.name, cand));
    const loc = p.location;
    const dist = loc ? metersBetween(input.lat, input.lon, loc.latitude, loc.longitude) : 9999;
    // Proximity factor: 1 at the pin, ~0 at 3km.
    const proximity = Math.max(0, 1 - dist / 3000);
    const combined = nameScore * 0.7 + proximity * 0.3;
    if (combined > bestCombined) {
      best = p;
      bestCombined = combined;
      bestNameScore = nameScore;
      bestDist = dist;
    }
  }

  // Accept as an on-map match only if the name plausibly overlaps (guards against
  // "closest random place"); otherwise treat as zero-footprint.
  if (best && bestNameScore >= 0.34) {
    const website = best.websiteUri;
    const distFactor = bestDist < 400 ? 0.3 : bestDist < 1200 ? 0.2 : 0.1;
    const confidence = Math.min(1, bestNameScore * 0.7 + distFactor);
    const lead: QualifiedLead = {
      name: input.name,
      industry: "accommodation",
      region: input.town ?? "",
      lat: best.location?.latitude ?? input.lat,
      lon: best.location?.longitude ?? input.lon,
      address: best.formattedAddress ?? undefined,
      phone: best.nationalPhoneNumber,
      website,
      websiteStatus: website ? "has_own" : "none",
      sources: ["google_places", "inbound_request", "map_pin"],
      photoCount: (best.photos ?? []).filter((ph) => ph.name).length,
      matchConfidence: Number(confidence.toFixed(2)),
      isLead: true,
    };
    return {
      lead,
      confidence,
      resolvedName: best.displayName?.text ?? input.name,
      resolvedAddress: best.formattedAddress ?? null,
      onMap: true,
    };
  }

  // Not on Maps — the zero-footprint segment. We still have the exact pin, so we
  // can generate from a Street View baseline. Medium confidence (no corroboration)
  // → the gate routes this to needs_review, not blind auto-send.
  const lead: QualifiedLead = {
    name: input.name,
    industry: "accommodation",
    region: input.town ?? "",
    lat: input.lat,
    lon: input.lon,
    sources: ["inbound_request", "map_pin"],
    photoCount: 0,
    websiteStatus: "none",
    matchConfidence: 0.5,
    isLead: true,
  };
  return { lead, confidence: 0.5, resolvedName: input.name, resolvedAddress: null, onMap: false };
}

/** Fallback path: name + town via Places Text Search, scored for A4 confidence. */
async function resolveByText(input: {
  name: string;
  town: string;
  mapsLink?: string | null;
}): Promise<ResolvedBusiness | null> {
  const apiKey = config.googleMapsApiKey;
  if (!apiKey) return null;

  const res = await fetch(PLACES_TEXT_SEARCH, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.displayName,places.formattedAddress,places.location," +
        "places.websiteUri,places.nationalPhoneNumber,places.photos," +
        "places.rating,places.userRatingCount",
    },
    body: JSON.stringify({
      textQuery: `${input.name}, ${input.town}`,
      languageCode: "hu",
      regionCode: "HU",
      maxResultCount: 5,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { places?: TextSearchPlace[] };
  const places = data.places ?? [];
  if (!places.length) return null;

  let best: TextSearchPlace | undefined;
  let bestScore = -1;
  for (const p of places) {
    const cand = p.displayName?.text ?? "";
    const score = Math.max(jaccard(input.name, cand), containment(input.name, cand));
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  }
  if (!best) return null;

  const resolvedName = best.displayName?.text ?? input.name;
  const address = best.formattedAddress ?? null;
  const townHit = address ? normName(address).includes(normName(input.town)) : false;
  const linkGiven = Boolean(input.mapsLink && input.mapsLink.trim());
  const confidence = Math.max(
    0,
    Math.min(1, bestScore * 0.8 + (townHit ? 0.2 : 0) + (linkGiven ? 0.05 : 0)),
  );

  const website = best.websiteUri;
  const lead: QualifiedLead = {
    name: input.name,
    industry: "accommodation",
    region: input.town,
    lat: best.location?.latitude,
    lon: best.location?.longitude,
    address: address ?? undefined,
    phone: best.nationalPhoneNumber,
    website,
    websiteStatus: website ? "has_own" : "none",
    sources: ["google_places", "inbound_request"],
    photoCount: (best.photos ?? []).filter((ph) => ph.name).length,
    matchConfidence: Number(confidence.toFixed(2)),
    isLead: true,
  };
  return { lead, confidence, resolvedName, resolvedAddress: address, onMap: true };
}

/**
 * Resolve a business from a self-serve request. Prefers the exact map pin; falls
 * back to name + town text search. Returns null only when nothing can be resolved.
 */
export async function resolveBusiness(input: {
  name: string;
  town?: string;
  lat?: number | null;
  lon?: number | null;
  mapsLink?: string | null;
}): Promise<ResolvedBusiness | null> {
  if (input.lat != null && input.lon != null) {
    return resolveByPin({
      name: input.name,
      town: input.town,
      lat: input.lat,
      lon: input.lon,
    });
  }
  if (input.town) {
    return resolveByText({ name: input.name, town: input.town, mapsLink: input.mapsLink });
  }
  return null;
}
