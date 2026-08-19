// Coordinate → country/city enrichment (ADR-0040). A lead's coordinates ALWAYS
// determine its country — so no lead may leave the pipeline without one. Layered:
// the source's own tags win (addr:* / addressComponents, applied upstream), this
// pass reverse-geocodes the still-missing ones via Nominatim (OSM's own service,
// 1 req/s policy), and whatever remains (no coordinates at all) falls back to the
// scrape region's country. City is filled the same way but never invented: a
// coordinate outside any settlement stays city-less.

import type { QualifiedLead } from "./types.js";

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/reverse";
/** Nominatim usage policy: max 1 request/second, identifying User-Agent. */
const THROTTLE_MS = 1100;
const USER_AGENT = "citoviso-scraper/0.1 (+https://github.com/olaszferenc/citoviso)";

interface NominatimAddress {
  country_code?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
}

export interface GeoFacets {
  country?: string;
  city?: string;
}

/** One reverse-geocode: WGS84 point → ISO-2 country + settlement name.
 *  zoom=10 = city level (we don't need street precision here). */
export async function reverseGeocode(lat: number, lon: number): Promise<GeoFacets> {
  const url =
    `${NOMINATIM_ENDPOINT}?format=jsonv2&zoom=10` +
    `&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return {};
  const data = (await res.json()) as { address?: NominatimAddress };
  const a = data.address ?? {};
  const cc = a.country_code?.trim();
  const city = (a.city ?? a.town ?? a.village ?? a.municipality)?.trim();
  return {
    country: cc && /^[a-z]{2}$/i.test(cc) ? cc.toUpperCase() : undefined,
    city: city || undefined,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fill missing country/city on every lead. Sequential + throttled (Nominatim is a
 * shared community service, 1 req/s is the hard policy). Only leads still missing
 * a facet AND having coordinates are queried; `regionCountry` closes the last gap
 * (a coordinate-less lead is still inside the scraped area's country).
 */
export async function enrichGeo(
  leads: QualifiedLead[],
  regionCountry?: string,
  log: (msg: string) => void = console.log,
): Promise<QualifiedLead[]> {
  const targets = leads.filter(
    (l) => (!l.country || !l.city) && l.lat != null && l.lon != null,
  );
  if (targets.length) {
    log(
      `Geo-enrich (Nominatim): ${targets.length} lead ország/város kikövetkeztetése koordinátából (~${Math.ceil((targets.length * THROTTLE_MS) / 60000)} perc)…`,
    );
  }
  const resolved = new Map<QualifiedLead, GeoFacets>();
  for (const lead of targets) {
    try {
      resolved.set(lead, await reverseGeocode(lead.lat as number, lead.lon as number));
    } catch {
      // network/timeout — the region fallback still covers the country below
    }
    await sleep(THROTTLE_MS);
  }
  return leads.map((l) => {
    const geo = resolved.get(l) ?? {};
    const country = l.country ?? geo.country ?? regionCountry;
    const city = l.city ?? geo.city;
    if (country === l.country && city === l.city) return l;
    return { ...l, country, city };
  });
}
