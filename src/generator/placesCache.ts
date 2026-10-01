// THE LEAD'S PLACES ANSWER, PAID FOR ONCE (ADR-0293; owner ruling 2026-10-01).
//
// Until now every open of a console lead page bought a fresh Places answer (1 Text
// Search with Enterprise fields + up to 6 Photo Media calls), with no cache — and a
// running generation reloads that page every 6–8 s. Measured over 9 days: 7 007 Text
// Search and 16 469 Photo Media calls, one lead looked up 126 times in the dev log.
//
// The rules this file serves (owner, verbatim decisions of 2026-10-01):
//   · every Places result is paid for ONCE per lead, stored, and kept WITHOUT expiry
//     ("Eredmény tárolásának idejét nem korlátozzuk");
//   · only the RESULT is stored (match, band, place id, rating, photo URLs) — never
//     the image file;
//   · a re-ask happens only when the lead's name / position / town changed (the stored
//     identity no longer matches), or when a stored photo link is MEASURED dead.
//
// Who may pay at all is decided by the caller's policy in resolveGatedPhotos
// (generate.ts); this file only stores, reads and judges freshness.

import { db } from "../db/client.js";

/** What we asked Places about. A changed identity makes the stored answer someone else's. */
export interface PlacesIdentity {
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
  readonly city: string | null;
}

/** The gated match as it was judged when paid for. */
export interface CachedPlacesMatch {
  readonly placeId?: string;
  readonly placeName: string;
  readonly distanceMeters: number;
  readonly nameSimilarity: number;
  readonly score: number;
  readonly band: "high" | "medium" | "low";
  readonly reasons: readonly string[];
  /** Only for a non-low band — a low match's rating is never attributed (A4). */
  readonly rating?: number;
  readonly userRatingCount?: number;
  /** Photo Media answers (key-less googleusercontent URLs). Empty for a low band:
   *  photos we would not use are not paid for. */
  readonly photoUrls: readonly string[];
}

export interface CachedPlaces {
  readonly v: 1;
  readonly identity: PlacesIdentity;
  /** How the match was found: by the stored place id, or by a Text Search. */
  readonly via: "details" | "text_search";
  /** null = asked and nothing in the area matches — a paid answer too. */
  readonly match: CachedPlacesMatch | null;
}

export interface StoredPlaces extends CachedPlaces {
  readonly fetchedAt: Date;
}

/** The identity a Places question is asked for; null without coordinates (no lookup then). */
export function placesIdentityOf(lead: {
  name: string;
  lat?: number | null;
  lon?: number | null;
  city?: string | null;
}): PlacesIdentity | null {
  if (lead.lat == null || lead.lon == null) return null;
  return {
    name: lead.name.trim(),
    lat: lead.lat,
    lon: lead.lon,
    city: lead.city?.trim() || null,
  };
}

/** ~1 m at 47°N: a re-geocode that moves the pin by float noise is not a new place. */
const COORD_DECIMALS = 5;

export function sameIdentity(a: PlacesIdentity, b: PlacesIdentity): boolean {
  const r = (n: number) => n.toFixed(COORD_DECIMALS);
  return (
    a.name === b.name &&
    (a.city ?? null) === (b.city ?? null) &&
    r(a.lat) === r(b.lat) &&
    r(a.lon) === r(b.lon)
  );
}

function parseStored(raw: unknown): CachedPlaces | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<CachedPlaces>;
  if (r.v !== 1 || !r.identity || (r.via !== "details" && r.via !== "text_search")) return null;
  if (r.match !== null && (typeof r.match !== "object" || !Array.isArray(r.match.photoUrls))) {
    return null;
  }
  return r as CachedPlaces;
}

export async function readPlacesCache(leadId: string): Promise<StoredPlaces | null> {
  const row = await db
    .selectFrom("lead_places_cache")
    .select(["result", "fetched_at"])
    .where("lead_id", "=", leadId)
    .executeTakeFirst();
  if (!row) return null;
  const parsed = parseStored(row.result);
  return parsed ? { ...parsed, fetchedAt: row.fetched_at } : null;
}

export async function writePlacesCache(leadId: string, entry: CachedPlaces): Promise<Date> {
  const json = JSON.stringify(entry);
  const now = new Date();
  await db
    .insertInto("lead_places_cache")
    .values({ lead_id: leadId, result: json, fetched_at: now })
    .onConflict((oc) => oc.column("lead_id").doUpdateSet({ result: json, fetched_at: now }))
    .execute();
  return now;
}
