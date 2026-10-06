// Known Google places → RawLead, rebuilt from our own store (ADR-0295).
//
// The Places discovery traversal asks Google for place IDs only (free). An id that
// a stored lead already carries (raw.sourceRefs.google_places) is rebuilt here
// from that lead instead of paying a Place Details call for it. The rebuilt lead
// flows on exactly like a freshly fetched one (OSM merge, store-dedup), so the
// scrape's behaviour does not change — only its bill does.

import { sql } from "kysely";
import { db } from "../db/client.js";
import type { RawLead } from "./types.js";

interface KnownRow {
  place_id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  address: string | null;
  country: string | null;
  city: string | null;
  phone: string | null;
  website: string | null;
  photo_count: string | null;
}

export async function knownPlacesFromDb(placeIds: string[]): Promise<Map<string, RawLead>> {
  const out = new Map<string, RawLead>();
  if (!placeIds.length) return out;
  // One lead per place id (a few ids sit on two leads after a merge); the oldest
  // row wins so the choice is stable between runs.
  const { rows } = await sql<KnownRow>`
    SELECT DISTINCT ON (raw->'sourceRefs'->>'google_places')
           raw->'sourceRefs'->>'google_places' AS place_id,
           name, lat, lng, address,
           raw->>'country' AS country, raw->>'city' AS city,
           raw->>'phone' AS phone, raw->>'website' AS website,
           raw->>'photoCount' AS photo_count
      FROM lead
     WHERE raw->'sourceRefs'->>'google_places' = ANY(${placeIds}::text[])
     ORDER BY raw->'sourceRefs'->>'google_places', created_at
  `.execute(db);
  for (const r of rows) {
    const photoCount = r.photo_count == null ? undefined : Number(r.photo_count);
    out.set(r.place_id, {
      source: "google_places",
      sourceId: r.place_id,
      name: r.name,
      lat: r.lat ?? undefined,
      lon: r.lng ?? undefined,
      address: r.address ?? undefined,
      country: r.country ?? undefined,
      city: r.city ?? undefined,
      phone: r.phone ?? undefined,
      website: r.website ?? undefined,
      photoCount: Number.isFinite(photoCount) ? photoCount : undefined,
    });
  }
  return out;
}

// ── Place Details store (0091, ADR-XXXX) ─────────────────────────────────────────
// Every paid Details answer lands here the moment it arrives, keyed by place id. A run
// that dies before its leads are saved (2026-10-05: OOM in the enrichment, ~16 000
// Details calls lost) leaves the answers behind, and the next run reads them instead of
// paying again. NULL = the place is gone (404) — also an answer we paid for.

export async function placeDetailsFromDb(
  placeIds: string[],
): Promise<Map<string, Record<string, unknown> | null>> {
  const out = new Map<string, Record<string, unknown> | null>();
  if (!placeIds.length) return out;
  const rows = await db
    .selectFrom("places_detail_cache")
    .select(["place_id", "raw"])
    // One array parameter, not one bind per id: a big run asks for 10 000+ ids at once.
    .where(sql<boolean>`place_id = ANY(${placeIds}::text[])`)
    .execute();
  for (const r of rows) out.set(r.place_id, r.raw ?? null);
  return out;
}

export async function savePlaceDetails(
  placeId: string,
  raw: Record<string, unknown> | null,
): Promise<void> {
  const value = raw == null ? null : JSON.stringify(raw);
  await db
    .insertInto("places_detail_cache")
    .values({ place_id: placeId, raw: value })
    .onConflict((oc) => oc.column("place_id").doUpdateSet({ raw: value, fetched_at: new Date() }))
    .execute();
}
