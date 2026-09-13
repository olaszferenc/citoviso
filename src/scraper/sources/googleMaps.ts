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
const callTimes: number[] = [];

async function throttle(): Promise<void> {
  for (;;) {
    const now = Date.now();
    while (callTimes.length && now - callTimes[0] > 60_000) callTimes.shift();
    if (callTimes.length < MAX_RPM) {
      callTimes.push(now);
      return;
    }
    await sleep(500);
  }
}

/**
 * One Text Search request with pacing and self-healing. A per-minute 429 heals by
 * itself in 60 s: wait and retry (bounded), because aborting a whole run on it
 * threw away the enrichment of 924 leads over one minute of patience (measured
 * 2026-09-13, live). A daily quota or auth failure escapes immediately — waiting
 * cannot fix those, and pretending otherwise would just burn the rate budget.
 */
export async function placesSearchText(
  body: Record<string, unknown>,
  apiKey: string,
  fieldMask: string,
): Promise<PlacesResponse> {
  for (let attempt = 0; ; attempt++) {
    await throttle();
    let res: Response;
    try {
      res = await fetch(PLACES_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": fieldMask,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (e) {
      throw new PlacesUnavailableError("network", undefined, (e as Error).message);
    }
    if (res.ok) return (await res.json()) as PlacesResponse;
    const errBody = await res.text().catch(() => "");
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
    "places.id,places.displayName,places.location,places.addressComponents,places.websiteUri,places.nationalPhoneNumber,places.photos,places.rating,places.userRatingCount",
  );
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
 */
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
    const keywords = TEXT_QUERIES[query.industry];
    const byId = new Map<string, RawLead>();
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
          // nextPageToken is outside the places.* namespace — ask for it explicitly.
          `${FIELD_MASK},nextPageToken`,
        );
        returned += (data.places ?? []).length;
        for (const p of data.places ?? []) {
          const name = p.displayName?.text;
          if (!name || byId.has(p.id)) continue;
          const { country, city } = localityFromComponents(p.addressComponents);
          byId.set(p.id, {
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
    console.log(
      `  [google_places] ${byId.size} hely · ${calls} hívás · ${keywords.length} kulcsszó` +
        (saturatedFloor ? ` · ${saturatedFloor} telített mini-csempe` : ""),
    );
    return [...byId.values()];
  }
}
