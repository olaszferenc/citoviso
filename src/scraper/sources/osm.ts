import type { Industry, RawLead, ScrapeQuery } from "../types.js";
import type { LeadSource } from "./LeadSource.js";

// OpenStreetMap via the Overpass API. Free, open data, legally clean — and it
// carries the `website` tag, which is exactly our qualification signal.
// Public Overpass instances are often overloaded (429/504); try mirrors in order.
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

// Industry → OSM tag filter. Accommodation maps to the tourism=* lodging values.
const OSM_FILTERS: Record<Industry, string> = {
  accommodation:
    '"tourism"~"^(hotel|guest_house|apartment|hostel|chalet|motel|camp_site|caravan_site)$"',
};

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

function buildQuery(query: ScrapeQuery): string {
  const [s, w, n, e] = query.region.bbox;
  const filter = OSM_FILTERS[query.industry];
  const bbox = `(${s},${w},${n},${e})`;
  return [
    "[out:json][timeout:25];",
    "(",
    `  node[${filter}]${bbox};`,
    `  way[${filter}]${bbox};`,
    `  relation[${filter}]${bbox};`,
    ");",
    "out center tags;",
  ].join("\n");
}

function firstTag(
  tags: Record<string, string>,
  keys: string[],
): string | undefined {
  for (const k of keys) {
    if (tags[k]) return tags[k];
  }
  return undefined;
}

function buildAddress(tags: Record<string, string>): string | undefined {
  if (tags["addr:full"]) return tags["addr:full"];
  const line = [tags["addr:street"], tags["addr:housenumber"]]
    .filter(Boolean)
    .join(" ");
  const parts = [
    line,
    tags["addr:city"] ?? tags["addr:village"],
    tags["addr:postcode"],
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}

export class OsmSource implements LeadSource {
  readonly name = "osm";

  /** POST the query to each mirror in turn; return the first success. */
  private async queryOverpass(ql: string): Promise<OverpassResponse> {
    const body = "data=" + encodeURIComponent(ql);
    let lastErr = "";
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            // Public Overpass (behind Cloudflare) rejects header-less requests.
            Accept: "application/json",
            "User-Agent":
              "citoviso-scraper/0.1 (+https://github.com/olaszferenc/citoviso)",
          },
          body,
          signal: AbortSignal.timeout(30_000), // don't hang on a slow mirror
        });
        if (!res.ok) {
          lastErr = `${res.status} ${res.statusText} @ ${endpoint}`;
          continue; // try next mirror
        }
        return (await res.json()) as OverpassResponse;
      } catch (err) {
        lastErr = `${(err as Error).message} @ ${endpoint}`;
      }
    }
    throw new Error(`Overpass request failed on all mirrors: ${lastErr}`);
  }

  async fetch(query: ScrapeQuery): Promise<RawLead[]> {
    const data = await this.queryOverpass(buildQuery(query));
    const leads: RawLead[] = [];
    for (const el of data.elements) {
      const tags = el.tags ?? {};
      const name = tags.name ?? tags["name:hu"];
      if (!name) continue; // unnamed POIs are useless as leads
      leads.push({
        source: this.name,
        sourceId: `${el.type}/${el.id}`,
        name,
        lat: el.lat ?? el.center?.lat,
        lon: el.lon ?? el.center?.lon,
        address: buildAddress(tags),
        phone: firstTag(tags, ["phone", "contact:phone"]),
        email: firstTag(tags, ["email", "contact:email"]),
        website: firstTag(tags, ["website", "contact:website", "url"]),
      });
    }
    return leads;
  }
}
