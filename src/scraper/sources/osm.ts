import type { Industry, RawLead, ScrapeQuery } from "../types.js";
import type { LeadSource } from "./LeadSource.js";
import { isValidEmail, splitEmailList } from "../../email/leadEmails.js";

// OpenStreetMap via the Overpass API. Free, open data, legally clean — and it
// carries the `website` tag, which is exactly our qualification signal.
// The $0 lead source (Magellan project, 2026-10-07): it runs with SCRAPE_PAID_APIS=off
// too (scripts/scrape-zero-paid-check.mts ⑤). Data © OpenStreetMap contributors, ODbL 1.0
// — the console names it wherever the lead's sources are shown.
// Public Overpass instances are often overloaded (429/504); try mirrors in order.
export const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

// Industry → OSM tag values. Accommodation maps to the tourism=* lodging values.
// ⛔ Queried as a UNION of equality filters, never one `"tourism"~"^(…)$"` regex: on
// 2026-10-07 the regex form got a dispatcher timeout (504) from overpass-api.de on a
// 15 km box while the equality union answered the whole country in 32 s.
export const OSM_TOURISM_VALUES: Record<Industry, readonly string[]> = {
  accommodation: ["hotel", "guest_house", "apartment", "hostel", "chalet", "motel", "camp_site", "caravan_site"],
};

/** Public Overpass is shared and free: one request per region, a readable UA, and a
 *  pause between retry rounds — never a hammering loop (operator usage policy). */
const OVERPASS_UA = "citoviso-scraper/0.2 (+https://citoviso.com; lead discovery, 1 request per region)";
/** Retry rounds over the whole mirror list, and the pause before each repeat. */
const RETRY_PAUSES_MS = [0, 15_000, 45_000];

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
  /** Overpass reports a server-side timeout/memory abort here with HTTP 200. */
  remark?: string;
}

/** The OSM object's own page — the openable proof of where a lead came from. */
export function osmObjectUrl(ref: string): string | null {
  return /^(node|way|relation)\/\d+$/.test(ref) ? `https://www.openstreetmap.org/${ref}` : null;
}

/** Server-side budget (s): a country/county is one big request, a region a small one. */
function serverTimeoutS(query: ScrapeQuery): number {
  return query.region.osmArea ? 180 : 60;
}

/**
 * The boundary an area run is clipped to: "HU" → the country (ISO 3166-1, admin_level=2),
 * "HU-TO" → a subdivision (ISO 3166-2, e.g. a Hungarian county — a county is no
 * rectangle, its bbox would take in the neighbours' places).
 */
function osmAreaStatement(code: string): string {
  const c = code.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  return /^[A-Z]{2}$/.test(c)
    ? `area["ISO3166-1"="${c}"][admin_level=2]->.a;`
    : `area["ISO3166-2"="${c}"]->.a;`;
}

/**
 * The Overpass QL for one region (bbox) or one whole country (`region.osmArea`, the
 * ISO 3166-1 code of an admin_level=2 boundary — the bbox of a country also takes in
 * strips of its neighbours).
 */
export function buildQuery(query: ScrapeQuery): string {
  const values = OSM_TOURISM_VALUES[query.industry];
  const area = query.region.osmArea;
  const [s, w, n, e] = query.region.bbox;
  const scope = area ? "(area.a)" : `(${s},${w},${n},${e})`;
  return [
    `[out:json][timeout:${serverTimeoutS(query)}];`,
    ...(area ? [osmAreaStatement(area)] : []),
    "(",
    ...values.map((v) => `  nwr["tourism"="${v}"]${scope};`),
    ");",
    "out center tags;",
  ].join("\n");
}

/**
 * OSM joins several values of one key with `;` ("info@a.hu;foglalas@a.hu"). Taken raw,
 * that string became ONE "address" on 2 live leads (2026-10-04): a broken mailto on the
 * mock, and a key no single address matches in the duplicate/shared-contact checks. Split:
 * the first valid address is the primary, the rest are further addresses; junk (a JS
 * fragment was measured in one tag) is dropped.
 */
function osmEmails(tag: string | undefined): { email?: string; otherEmails?: string[] } {
  const all = splitEmailList(tag).filter(isValidEmail);
  const [email, ...rest] = all;
  return { ...(email ? { email } : {}), ...(rest.length ? { otherEmails: rest } : {}) };
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

/** Country (ISO-2, uppercased) + city/locality from the OSM addr:* tags, if present.
 *  OSM's addr:country is by convention the ISO 3166-1 alpha-2 code — same shape as
 *  the Places country code, so the two sources merge cleanly on the filter. */
function localityFromTags(tags: Record<string, string>): {
  country?: string;
  city?: string;
} {
  const raw = firstTag(tags, ["addr:country", "is_in:country_code", "country_code"]);
  const country = raw && /^[a-z]{2}$/i.test(raw.trim()) ? raw.trim().toUpperCase() : undefined;
  const city = firstTag(tags, [
    "addr:city",
    "addr:town",
    "addr:village",
    "addr:municipality",
    "addr:suburb",
  ]);
  return { country, city };
}

export class OsmSource implements LeadSource {
  readonly name = "osm";
  private lastWarnings: string[] = [];
  /** What the last fetch saw, before and after the named-only filter (dry-run numbers). */
  lastCounts = { elements: 0, unnamed: 0 };

  warnings(): string[] {
    return [...this.lastWarnings];
  }

  /**
   * POST the query to each mirror in turn; return the first COMPLETE answer. A round
   * that fails on every mirror is repeated after a pause (RETRY_PAUSES_MS) — public
   * Overpass is often busy for a minute, rarely for long. An answer carrying a
   * `remark` (server-side timeout/out of memory) is partial, so it counts as a failure:
   * a half list would silently look like "these are all the places".
   */
  private async queryOverpass(
    ql: string,
    timeoutS: number,
    /** Boundary (country/county) query: an EMPTY answer is a mirror fault, never the truth
     *  (2026-10-07: Baranya came back with 0 elements, HTTP 200, no remark — 412 a minute later). */
    emptyIsFailure: boolean,
  ): Promise<OverpassResponse & { endpoint: string }> {
    const body = "data=" + encodeURIComponent(ql);
    const errors: string[] = [];
    for (const pause of RETRY_PAUSES_MS) {
      if (pause) await new Promise((r) => setTimeout(r, pause));
      for (const endpoint of OVERPASS_ENDPOINTS) {
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              // Public Overpass (behind Cloudflare) rejects header-less requests.
              Accept: "application/json",
              "User-Agent": OVERPASS_UA,
            },
            body,
            // The server's own budget plus transfer time — don't hang on a dead mirror.
            signal: AbortSignal.timeout((timeoutS + 30) * 1000),
          });
          if (!res.ok) {
            errors.push(`${res.status} ${res.statusText} @ ${endpoint}`);
            continue; // try next mirror
          }
          const data = (await res.json()) as OverpassResponse;
          if (data.remark && /error|timed out|out of memory/i.test(data.remark)) {
            errors.push(`részleges válasz (${data.remark.slice(0, 120)}) @ ${endpoint}`);
            continue;
          }
          if (emptyIsFailure && data.elements.length === 0) {
            errors.push(`üres válasz egy határ-lekérdezésre @ ${endpoint}`);
            continue;
          }
          return { ...data, endpoint };
        } catch (err) {
          errors.push(`${(err as Error).message} @ ${endpoint}`);
        }
      }
    }
    throw new Error(`Overpass request failed on all mirrors: ${errors.slice(-OVERPASS_ENDPOINTS.length).join(" · ")}`);
  }

  async fetch(query: ScrapeQuery): Promise<RawLead[]> {
    this.lastWarnings = [];
    const data = await this.queryOverpass(buildQuery(query), serverTimeoutS(query), !!query.region.osmArea);
    const leads: RawLead[] = [];
    let unnamed = 0;
    for (const el of data.elements) {
      const tags = el.tags ?? {};
      const name = tags.name ?? tags["name:hu"];
      if (!name) {
        unnamed++; // unnamed POIs are useless as leads
        continue;
      }
      const { country, city } = localityFromTags(tags);
      leads.push({
        source: this.name,
        sourceId: `${el.type}/${el.id}`,
        name,
        lat: el.lat ?? el.center?.lat,
        lon: el.lon ?? el.center?.lon,
        address: buildAddress(tags),
        country,
        city,
        phone: firstTag(tags, ["phone", "contact:phone"]),
        ...osmEmails(firstTag(tags, ["email", "contact:email"])),
        website: firstTag(tags, ["website", "contact:website", "url"]),
      });
    }
    this.lastCounts = { elements: data.elements.length, unnamed };
    console.log(`  [osm] ${data.elements.length} objektum · ${new URL(data.endpoint).host}`);
    if (unnamed) {
      this.lastWarnings.push(`OpenStreetMap: ${unnamed} név nélküli szállás-objektum kihagyva (${data.elements.length}-ből).`);
    }
    return leads;
  }
}
