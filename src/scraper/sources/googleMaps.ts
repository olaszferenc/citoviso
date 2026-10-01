import { config } from "../../config.js";
import type { Industry, RawLead, ScrapeQuery } from "../types.js";
import type { LeadSource } from "./LeadSource.js";
import { GENERIC_NAME_WORD, PLACES_TRADE_WORD } from "../genericWords.js";

// Google Maps via the official Places API (New) — legally clean route. Requires
// GOOGLE_MAPS_API_KEY. Without a key the source skips itself so OSM still runs.
// A Playwright-based Maps-scrape adapter can be added later behind the same interface.
const PLACES_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

// ── Discovery is TWO-STEP (2026-10-01, ADR-XXXX) ─────────────────────────────
// Google bills a Text Search by the HIGHEST field tier in its mask, per request
// (≤20 places). Asking for phone + website made every discovery page "Text Search
// Enterprise" ($35/1000 requests, checked on the official price list 2026-10-01),
// although most of those places were already in our DB from an earlier run and
// were thrown away at the store-dedup. Now:
//   1. the traversal asks for IDs ONLY — "Text Search Essentials (IDs Only)",
//      unlimited free usage; pagination and locationRestriction work the same;
//   2. a place id already stored on a lead (raw.sourceRefs.google_places) is
//      rebuilt from the DB for free — it flows on exactly as before (OSM merge,
//      store-dedup), it just no longer costs anything;
//   3. only a place id NEW to us gets one Place Details call with the fields we
//      map to RawLead ("Place Details Enterprise", $20/1000).
const DISCOVERY_ID_MASK = "places.id,nextPageToken";

// Field mask of the per-new-place Details call: exactly the fields we map to
// RawLead. addressComponents carries the structured country/city (the filter
// facets); formattedAddress alone is a human string we cannot reliably split.
// websiteUri + nationalPhoneNumber make this the Enterprise tier — they decide the
// lead's website status and contact channel, so they are worth the price.
const DETAILS_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "addressComponents",
  "location",
  "websiteUri",
  "nationalPhoneNumber",
  "photos", // enrichment material — photo count for the mock
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

// Discovery keywords — PLURAL, deliberately. Text Search ranks by RELEVANCE to the
// query: a single "szállás" query never surfaces places whose name and profile say
// "hotel" or "kemping" strongly enough, no matter how many pages we read. Measured
// 2026-09-13 (owner report): Balaton-Kelet returned 20 Google players against 1009
// from OSM — one keyword, one page, over a 64×46 km box. The keyword set is part
// of the industry parameter, same as the OSM tag filter.
const TEXT_QUERIES: Record<Industry, string[]> = {
  accommodation: ["szállás", "hotel", "panzió", "apartman", "vendégház", "kemping"],
};

// ── Discovery traversal knobs (env-tunable; defaults sized for a 32 km circle) ──
// Text Search pages are 20 items, at most 3 pages (60) per query. A query that
// returns the full 60 is SATURATED: the area holds more than the API will ever
// show for one query, so the tile must be split and asked again in quarters.
const PAGE_SIZE = 20;
const QUERY_RESULT_CEILING = 60;
/** Hard per-run call budget — cost discipline. Hitting it is LOUD, never silent.
 *  Sizing (measured 2026-09-13, real API): the small Badacsony box took 160 calls
 *  to full, saturation-free coverage; a 32 km circle is ~16× the area but far
 *  sparser outside the town cores. */
const DISCOVERY_MAX_CALLS = Number(process.env.PLACES_DISCOVERY_MAX_CALLS ?? 600);
/** Hard per-run cap on the PAID step: Place Details for ids new to our DB. Sized
 *  above the largest measured run (2026-09-27/28: 2 589 new leads over two runs);
 *  at $20/1000 the cap bounds one run at ~$80. Hitting it is LOUD. */
const DETAILS_MAX_CALLS = Number(process.env.PLACES_DETAILS_MAX_CALLS ?? 4000);
/** Parallel Details requests — the throttle still bounds the rate. */
const DETAILS_CONCURRENCY = 8;

/** place ids → RawLead rebuilt from our own store, for the ids we already know. */
export type KnownPlacesResolver = (placeIds: string[]) => Promise<Map<string, RawLead>>;

// Lazy: the DB module is loaded only when a discovery actually runs, so importing
// this file (console, generator, guards) never opens a pool.
const defaultKnownPlaces: KnownPlacesResolver = async (placeIds) =>
  (await import("../knownPlaces.js")).knownPlacesFromDb(placeIds);
/** Tiles are not split below this side (~550 m lat). Measured on Badacsony (real
 *  API): at 0.02° two tiles were still saturated (>60 apartman-hits in 2.2 km) and
 *  the source found 258; at 0.005° zero saturation and 310. Resort villages pack
 *  more than 60 listings per keyword into a couple of streets — the floor must be
 *  below the block size, or the densest (= most valuable) cores stay half-seen. */
const MIN_TILE_DEG = Number(process.env.PLACES_MIN_TILE_DEG ?? 0.005);

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
    types?: string[];
  }>;
  /** Present when the query has more pages (up to 60 results per query). */
  nextPageToken?: string;
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
  /** What kind of place it is by its Places types; undefined = types not returned. */
  kind?: PlaceKind;
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
    /** Which quota window is spent. A PER-MINUTE limit heals in 60 s and must be
     *  WAITED OUT, not treated as the end of the run — measured 2026-09-13: the
     *  first per-minute 429 aborted enrichment for all 924 remaining leads. */
    readonly quotaScope?: "minute" | "day",
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

/** Which quota window the body names. Google's message spells it out:
 *  "… limit 'SearchTextRequest per minute' …" vs "… per day …". Unknown wording
 *  defaults to "day" — the FINAL reading — so a new message shape can only make us
 *  more careful, never spin on a spent daily quota. */
function quotaScopeOf(body: string): "minute" | "day" {
  return /per minute|PerMinute/i.test(body) ? "minute" : "day";
}

// ── Shared Text Search transport: rate limit + per-minute-quota retry ─────────
// Every searchText call in the pipeline goes through here (discovery tiles AND the
// per-lead lookup), so the pacing and the healing live in ONE place.
/** Calls per minute we allow ourselves — below the project quota so the 429 path is
 *  the exception, not the pacing mechanism. */
const MAX_RPM = Number(process.env.PLACES_MAX_RPM ?? 150);
/** First retry wait after a per-minute 429; doubles per attempt. Env-tunable so the
 *  guard can exercise the retry path in milliseconds instead of minutes. */
const RETRY_BASE_MS = Number(process.env.PLACES_RETRY_BASE_MS ?? 20_000);
const RETRY_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A sliding one-minute call window. Text Search and Place Details have SEPARATE
 *  project quotas, so each gets its own window. */
function makeThrottle(maxRpm: number): () => Promise<void> {
  const callTimes: number[] = [];
  return async () => {
    for (;;) {
      const now = Date.now();
      while (callTimes.length && now - callTimes[0] > 60_000) callTimes.shift();
      if (callTimes.length < maxRpm) {
        callTimes.push(now);
        return;
      }
      await sleep(500);
    }
  };
}
const searchThrottle = makeThrottle(MAX_RPM);
/** Place Details calls per minute (the discovery's new-place details fetch). */
const DETAILS_MAX_RPM = Number(process.env.PLACES_DETAILS_MAX_RPM ?? 300);
const detailsThrottle = makeThrottle(DETAILS_MAX_RPM);

/**
 * One Places request with pacing and self-healing. A per-minute 429 heals by
 * itself in 60 s: wait and retry (bounded), because aborting a whole run on it
 * threw away the enrichment of 924 leads over one minute of patience (measured
 * 2026-09-13, live). A daily quota or auth failure escapes immediately — waiting
 * cannot fix those, and pretending otherwise would just burn the rate budget.
 * `null` = HTTP 404 when `notFoundIsNull` (a place id that no longer exists).
 */
async function placesRequest<T>(
  url: string,
  init: RequestInit,
  throttle: () => Promise<void>,
  notFoundIsNull = false,
): Promise<T | null> {
  for (let attempt = 0; ; attempt++) {
    await throttle();
    let res: Response;
    try {
      res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
    } catch (e) {
      throw new PlacesUnavailableError("network", undefined, (e as Error).message);
    }
    if (res.ok) return (await res.json()) as T;
    const errBody = await res.text().catch(() => "");
    if (notFoundIsNull && res.status === 404) return null;
    const failure = classifyFailure(res.status, errBody);
    const scope = failure === "quota" ? quotaScopeOf(errBody) : undefined;
    if (failure === "quota" && scope === "minute" && attempt < RETRY_ATTEMPTS) {
      const wait = RETRY_BASE_MS * 2 ** attempt;
      console.warn(
        `[places] perc-kvóta betelt (429) — várok ${Math.round(wait / 1000)} mp-et, majd újrapróbálom (${attempt + 1}/${RETRY_ATTEMPTS})`,
      );
      await sleep(wait);
      continue;
    }
    throw new PlacesUnavailableError(failure, res.status, errBody.slice(0, 300), scope);
  }
}

/** One Text Search request through the shared paced, self-healing transport. */
export async function placesSearchText(
  body: Record<string, unknown>,
  apiKey: string,
  fieldMask: string,
): Promise<PlacesResponse> {
  const data = await placesRequest<PlacesResponse>(
    PLACES_ENDPOINT,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify(body),
    },
    searchThrottle,
  );
  return data ?? {};
}

type PlaceRecord = NonNullable<PlacesResponse["places"]>[number];

/** One Place Details (GET /v1/places/{id}) request through the same transport.
 *  `null` = the id no longer exists (404). The mask has NO `places.` prefix here. */
export async function placesGetPlace(
  placeId: string,
  apiKey: string,
  fieldMask: string,
): Promise<PlaceRecord | null> {
  return placesRequest<PlaceRecord>(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": fieldMask },
    },
    detailsThrottle,
    true,
  );
}

// ~half-degree box side used to hard-restrict the per-lead lookup to the lead's
// immediate area (≈±550m lat / ≈±420m lng at 47°N). A soft locationBias would let
// Places return a same-name place in another town — a catastrophic photo mismatch.
// Within the box, the match is SCORED (A4 confidence), not hard-accepted.
export const LOOKUP_BOX_DEG = 0.005;

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

/**
 * Brand words of a name: significant tokens minus every trade word — and minus the
 * lead's own town, which names the village, not the business ("Köveskál Vendégház"
 * and "Köveskál Panzió" share only the village).
 */
export function brandTokens(name: string, city?: string): string[] {
  const town = new Set(city ? normName(city).split(" ") : []);
  return normName(name)
    .split(" ")
    .filter(
      (t) => t.length > 3 && !GENERIC_NAME_WORD.has(t) && !PLACES_TRADE_WORD.has(t) && !town.has(t),
    );
}

/** a and b differ by at most one insertion, deletion or substitution. */
function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** Does one brand word of the lead appear in the place name (spelling variants allowed)? */
function brandWordFound(t: string, candTokens: readonly string[], candJoined: string): boolean {
  if (candJoined.includes(t)) return true; // "mandulakert" ↔ "Mandula Kert"
  return candTokens.some(
    (u) =>
      (u.length >= 4 && t.startsWith(u)) || // "elisabeth" ↔ "Elisabet"
      (t.length >= 5 && u.length >= 5 && withinOneEdit(t, u)), // "szinbad" ↔ "Szindbad"
  );
}

/**
 * How much of the LEAD's brand the place name carries (0..1).
 *
 * ⛔ Until 2026-09-28 this was a Jaccard over ALL words, so "Aranymandula
 * Apartmanház" ↔ "Aranymandula Apartmanok" scored 0.33 — the trade word counted as
 * a mismatch — and 70 of 118 medium-band matches turned out to be the right place
 * in different wording. Trade words now carry no weight either way; the question is
 * only whether the lead's own name is in the place's. A name made only of trade
 * words has nothing to carry, so it scores 1 on an exact match and 0 otherwise.
 */
export function nameSimilarity(leadName: string, placeName: string, leadCity?: string): number {
  const lead = brandTokens(leadName, leadCity);
  const cand = normName(placeName);
  if (!lead.length) return cand === normName(leadName) ? 1 : 0;
  const candTokens = cand.split(" ").filter(Boolean);
  const joined = candTokens.join("");
  return lead.filter((t) => brandWordFound(t, candTokens, joined)).length / lead.length;
}

/**
 * Places types that mean "you can sleep here". A name match on a café or a shop in
 * the same building is the classic wrong match (Green Wood Vendégház ↔ Green Café,
 * Kővirág panzió ↔ Kővirág X Pan'ni); the type is what tells them apart when the
 * names cannot. Any type in the list counts, not just the primary one — a winery
 * that also rents rooms (Liszkay, Villa Tolnay) carries "lodging" among its types.
 * A LARGE site (campground, children's camp) is a lodging whose pin can sit far from
 * the lead's pin: Mirabella and Balatontourist Füred matched right at 156–160 m.
 */
const LARGE_SITE_TYPE = new Set(["campground", "childrens_camp", "rv_park", "mobile_home_park"]);
const LODGING_TYPE = new Set([
  "lodging", "hotel", "guest_house", "bed_and_breakfast", "hostel", "resort_hotel", "motel",
  "cottage", "private_guest_room", "inn", "extended_stay_hotel", "farmstay", "camping_cabin",
]);
export type PlaceKind = "large_site" | "lodging" | "other";
export function placeKindOf(types: readonly string[] | undefined): PlaceKind | undefined {
  if (!types?.length) return undefined;
  if (types.some((t) => LARGE_SITE_TYPE.has(t))) return "large_site";
  if (types.some((t) => LODGING_TYPE.has(t))) return "lodging";
  return "other";
}

/**
 * Pick the closest in-box candidate whose name plausibly belongs to the lead.
 *
 * ⛔ The overlap must be on a BRAND word: until 2026-09-28 any shared word longer
 * than three letters counted, so "apartman" or "hotel" was enough and the closest
 * neighbour won — measured on the dev stock as eight neighbour pairs where one lead
 * carried the other business's phone (Anita Apartman ← Judit Apartmanház, 109 m).
 * A name made only of trade words has no brand to check, so it must match whole.
 * Pure (no network) so scripts/places-match-check.mts can pin it.
 */
export function pickPlacesCandidate<P extends { location?: { latitude: number; longitude: number }; displayName?: { text?: string } }>(
  name: string,
  lat: number,
  lon: number,
  places: readonly P[],
  city?: string,
): { place: P; distanceMeters: number } | null {
  const wholeName = normName(name);
  let best: P | undefined;
  let bestDist = Infinity;
  for (const p of places) {
    const loc = p.location;
    if (!loc) continue;
    const d = metersBetween(lat, lon, loc.latitude, loc.longitude);
    if (d >= bestDist) continue;
    const cand = p.displayName?.text ?? "";
    const nameOk =
      brandTokens(name, city).length === 0 ? normName(cand) === wholeName : nameSimilarity(name, cand, city) > 0;
    if (!nameOk) continue;
    best = p;
    bestDist = d;
  }
  return best ? { place: best, distanceMeters: bestDist } : null;
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
  leadCity?: string,
): Promise<PlacesMatch | null> {
  // Shared transport: rate-limited, and a per-minute 429 is waited out instead of
  // failing the lead (the caller still learns about day-quota/auth via the throw).
  const data = await placesSearchText(
    {
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
    },
    apiKey,
    // places.id is Essentials-tier — free alongside the Pro fields already
    // requested here, and it is what makes the match linkable on Maps.
    "places.id,places.displayName,places.location,places.addressComponents,places.websiteUri,places.nationalPhoneNumber,places.photos,places.rating,places.userRatingCount,places.types",
  );
  const places = data.places ?? [];
  if (!places.length) return null;

  const picked = pickPlacesCandidate(name, lat, lon, places, leadCity);
  if (!picked) return null;
  const { place: best, distanceMeters: bestDist } = picked;

  const photoRefs = (best.photos ?? [])
    .map((ph) => ph.name)
    .filter((n): n is string => Boolean(n));
  const { country, city } = localityFromComponents(best.addressComponents);
  return {
    placeId: best.id,
    placeName: best.displayName?.text ?? name,
    distanceMeters: bestDist,
    nameSimilarity: nameSimilarity(name, best.displayName?.text ?? "", leadCity),
    rating: best.rating,
    userRatingCount: best.userRatingCount,
    phone: best.nationalPhoneNumber,
    website: best.websiteUri,
    photoRefs,
    country,
    city,
    kind: placeKindOf(best.types),
  };
}

/** Place Details field mask for a known place id — the same signals `placesLookup`
 *  reads, minus website/phone (the photo gate never used them). */
const DETAILS_FIELD_MASK =
  "id,displayName,location,addressComponents,photos,rating,userRatingCount,types";

/**
 * The lead's match by its STORED place id (`sourceRefs.google_places`) — one Place
 * Details call instead of a Text Search (owner ruling, 2026-10-01: "ne keress újra, ha
 * már van"). Scored on the same signals as `placesLookup`, so the A4 gate decides
 * exactly as it would on a fresh search; the id only saves the SEARCH, not the judgement.
 *
 * null = the id no longer resolves (404/400: the place was removed or merged) — the
 * caller falls back to a Text Search. Quota/key/network THROW, as in `placesLookup`.
 */
export async function placesDetailsMatch(
  placeId: string,
  name: string,
  lat: number,
  lon: number,
  apiKey: string,
  leadCity?: string,
): Promise<PlacesMatch | null> {
  for (let attempt = 0; ; attempt++) {
    await detailsThrottle();
    let res: Response;
    try {
      res = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
        {
          headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": DETAILS_FIELD_MASK },
          signal: AbortSignal.timeout(15_000),
        },
      );
    } catch (e) {
      throw new PlacesUnavailableError("network", undefined, (e as Error).message);
    }
    if (res.status === 404 || res.status === 400) return null;
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      const failure = classifyFailure(res.status, errBody);
      const scope = failure === "quota" ? quotaScopeOf(errBody) : undefined;
      if (failure === "quota" && scope === "minute" && attempt < RETRY_ATTEMPTS) {
        await sleep(RETRY_BASE_MS * 2 ** attempt);
        continue;
      }
      throw new PlacesUnavailableError(failure, res.status, errBody.slice(0, 300), scope);
    }
    const p = (await res.json()) as NonNullable<PlacesResponse["places"]>[number];
    if (!p.location) return null;
    const placeName = p.displayName?.text ?? name;
    const { country, city } = localityFromComponents(p.addressComponents);
    return {
      placeId: p.id ?? placeId,
      placeName,
      distanceMeters: metersBetween(lat, lon, p.location.latitude, p.location.longitude),
      nameSimilarity: nameSimilarity(name, placeName, leadCity),
      rating: p.rating,
      userRatingCount: p.userRatingCount,
      photoRefs: (p.photos ?? []).map((ph) => ph.name).filter((n): n is string => Boolean(n)),
      country,
      city,
      kind: placeKindOf(p.types),
    };
  }
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

type Bbox = readonly [number, number, number, number]; // [S, W, N, E]

/**
 * Google Places discovery — tiled and paged, because the API shows at most 60
 * results PER QUERY (20 per page, 3 pages), ranked by relevance.
 *
 * ⛔ The first version made ONE call with ONE keyword and read ONE page: 20 players
 * for the whole Balaton-Kelet region, next to 1009 from OSM (measured 2026-09-13,
 * owner report). This source is the discovery engine of the business — a silent
 * first-page ceiling here means most Google-only accommodations are never seen
 * at all, in every region, forever.
 *
 * Traversal: every keyword runs against the region box; any (tile × keyword) query
 * that returns the 60-result ceiling is SATURATED — the area holds more than the
 * API will show for one query — so the tile is quartered and asked again, down to
 * ~2 km tiles. Results merge on place id. The call budget is hard-capped and
 * hitting the cap is LOUD (a silent cap would be this same bug in a new suit).
 *
 * Cost: the traversal itself is free (IDs only); see DISCOVERY_ID_MASK for the
 * two-step design. Known place ids come back from the DB, new ones cost one Place
 * Details call each, hard-capped by DETAILS_MAX_CALLS (loud when hit).
 */
export class GoogleMapsSource implements LeadSource {
  readonly name = "google_places";

  /** place ids → the RawLead rebuilt from our DB, for ids we already store.
   *  Injectable so the guard runs without a database; the default reads `lead`. */
  constructor(private readonly knownPlaces: KnownPlacesResolver = defaultKnownPlaces) {}

  async fetch(query: ScrapeQuery): Promise<RawLead[]> {
    const key = config.googleMapsApiKey;
    if (!key) {
      console.warn(
        "[google_places] GOOGLE_MAPS_API_KEY not set — skipping this source.",
      );
      return [];
    }
    const keywords = TEXT_QUERIES[query.industry];
    const ids = new Set<string>();
    let calls = 0;
    let budgetHit = false;
    let saturatedFloor = 0;

    /** All pages of one (tile × keyword) query. Returns how many results the API
     *  RETURNED — not how many were new to us. Saturation is a fact about the
     *  QUERY (did it hit the 60 ceiling?); measuring only-new would make a tile
     *  already covered by an earlier keyword look empty and skip the split. */
    const runQuery = async (tile: Bbox, keyword: string): Promise<number> => {
      const [s, w, n, e] = tile;
      let pageToken: string | undefined;
      let returned = 0;
      do {
        if (calls >= DISCOVERY_MAX_CALLS) {
          budgetHit = true;
          return returned;
        }
        calls++;
        const data = await placesSearchText(
          {
            textQuery: keyword,
            locationRestriction: {
              rectangle: {
                low: { latitude: s, longitude: w },
                high: { latitude: n, longitude: e },
              },
            },
            pageSize: PAGE_SIZE,
            ...(pageToken ? { pageToken } : {}),
          },
          key,
          // IDs only = the free SKU. nextPageToken is outside the places.*
          // namespace, so the mask names it explicitly.
          DISCOVERY_ID_MASK,
        );
        returned += (data.places ?? []).length;
        for (const p of data.places ?? []) if (p.id) ids.add(p.id);
        pageToken = data.nextPageToken;
      } while (pageToken);
      return returned;
    };

    /** Depth-first: query the tile with every keyword; split if any hits the ceiling. */
    const walk = async (tile: Bbox): Promise<void> => {
      if (budgetHit) return;
      let saturated = false;
      for (const kw of keywords) {
        const got = await runQuery(tile, kw);
        if (got >= QUERY_RESULT_CEILING) saturated = true;
        if (budgetHit) return;
      }
      const [s, w, n, e] = tile;
      const sideDeg = Math.min(n - s, e - w);
      if (!saturated) return;
      if (sideDeg / 2 < MIN_TILE_DEG) {
        saturatedFloor++;
        console.warn(
          `[google_places] telített MIN-méretű csempe (${s.toFixed(3)},${w.toFixed(3)}) — ennél mélyebbre az API nem enged, a városmag egy része kimaradhat.`,
        );
        return;
      }
      const midLat = (s + n) / 2;
      const midLon = (w + e) / 2;
      await walk([s, w, midLat, midLon]);
      await walk([s, midLon, midLat, e]);
      await walk([midLat, w, n, midLon]);
      await walk([midLat, midLon, n, e]);
    };

    await walk(query.region.bbox);

    if (budgetHit) {
      console.warn(
        `[google_places] ⚠️ HÍVÁS-KERET ELFOGYOTT (${DISCOVERY_MAX_CALLS}) — a lefedettség RÉSZLEGES. Emeld a PLACES_DISCOVERY_MAX_CALLS-t, vagy szűkítsd a területet.`,
      );
    }

    // Step 2: what we already know costs nothing; only new ids get Details.
    const known = await this.knownPlaces([...ids]);
    const byId = new Map<string, RawLead>();
    const fresh: string[] = [];
    for (const id of ids) {
      const k = known.get(id);
      if (k) byId.set(id, k);
      else fresh.push(id);
    }
    const detailIds = fresh.slice(0, DETAILS_MAX_CALLS);
    if (fresh.length > detailIds.length) {
      console.warn(
        `[google_places] ⚠️ ADATLAP-KERET ELFOGYOTT (${DETAILS_MAX_CALLS}) — ${fresh.length - detailIds.length} új hely adatlap nélkül KIMARADT. Emeld a PLACES_DETAILS_MAX_CALLS-t, vagy szűkítsd a területet.`,
      );
    }
    let detailCalls = 0;
    let gone = 0;
    let next = 0;
    const worker = async (): Promise<void> => {
      while (next < detailIds.length) {
        const id = detailIds[next++];
        detailCalls++;
        const p = await placesGetPlace(id, key, DETAILS_MASK);
        const name = p?.displayName?.text;
        if (!p || !name) {
          gone++;
          continue;
        }
        const { country, city } = localityFromComponents(p.addressComponents);
        byId.set(id, {
          source: this.name,
          sourceId: id,
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
    };
    await Promise.all(
      Array.from({ length: Math.min(DETAILS_CONCURRENCY, detailIds.length) }, () => worker()),
    );

    console.log(
      `  [google_places] ${byId.size} hely · ${calls} ingyenes ID-keresés · ${keywords.length} kulcsszó` +
        ` · ${known.size} már ismert (DB, 0 Ft) · ${detailCalls} fizetős adatlap az új helyekre` +
        (gone ? ` · ${gone} megszűnt/név nélküli` : "") +
        (saturatedFloor ? ` · ${saturatedFloor} telített mini-csempe` : ""),
    );
    return [...byId.values()];
  }
}
