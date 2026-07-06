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
    photos?: unknown[];
  }>;
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
