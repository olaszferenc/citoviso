// Known Google places → RawLead, rebuilt from our own store (ADR-XXXX).
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
