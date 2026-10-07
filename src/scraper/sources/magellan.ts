// Magellan source (ADR-0336): the scout worksheet's closed tile as a lead source.
//
// Magellan (the digital scout) walks the Google Maps LIST by hand and records each new
// place on the `/scout` worksheet — no paid Places call is made anywhere. Closing a
// tile runs `run.ts <region> --scout <tileId>`, and this adapter hands the tile's
// complete rows (status `proc`, set by the close) to the unchanged chain as RawLeads.
//
// What a RawLead cannot carry (portal links, the website verdict, the Maps rating) is
// returned beside it, keyed by sourceId, and run.ts lays it on the qualified lead AFTER
// dedupe (applyScoutExtras) — the merge would otherwise drop it.

import { db } from "../../db/client.js";
import { foundLinks, phoneE164, rowComplete, webClass, webUrl } from "../../scout/rules.js";
import { classifyWebsite } from "../qualify.js";
import type { LeadSource } from "./LeadSource.js";
import type { PortalListing, QualifiedLead, RawLead, ScrapeQuery } from "../types.js";

export const MAGELLAN_SOURCE = "magellan";

/** What the worksheet knows about a row beyond the RawLead fields. */
export interface ScoutExtra {
  readonly placeId: string;
  readonly verdict: "none" | "own" | "unsure" | null;
  /** The found links that are portal pages → listings (enrichPortal reads them, for free). */
  readonly portalLinks: readonly string[];
  /** „van saját honlap" → the first found link (already checked to be an own site). */
  readonly ownSite: string | null;
  readonly rating: { readonly value: number; readonly count: number } | null;
}

export class MagellanSource implements LeadSource {
  readonly name = MAGELLAN_SOURCE;
  /** sourceId → extras, filled by fetch(). */
  readonly extras = new Map<string, ScoutExtra>();
  private readonly tileId: string;

  constructor(opts: { tileId: string }) {
    this.tileId = opts.tileId;
  }

  async fetch(query: ScrapeQuery): Promise<RawLead[]> {
    const rows = await db
      .selectFrom("scout_place")
      .select([
        "id",
        "name",
        "lat",
        "lon",
        "ftid",
        "status",
        "address",
        "city",
        "phone",
        "website",
        "photo_count",
        "rating",
        "rating_count",
        "found_links",
        "verdict",
      ])
      .where("tile_id", "=", this.tileId)
      .where("status", "=", "proc")
      .execute();
    const out: RawLead[] = [];
    for (const r of rows) {
      // The close gate already checked this; a row edited around it is not guessed at.
      if (!rowComplete({ ...r, status: "new" })) continue;
      const sourceId = r.ftid ?? `scout_place:${r.id}`;
      const site = webClass(r.website) === "invalid" ? undefined : webUrl(r.website) ?? undefined;
      const links = foundLinks(r.found_links)
        .map((l) => webUrl(l))
        .filter((u): u is string => !!u);
      this.extras.set(sourceId, {
        placeId: r.id,
        verdict: r.verdict,
        portalLinks: links.filter((u) => classifyWebsite(u) === "portal_only"),
        ownSite: r.verdict === "own" ? (links[0] ?? null) : null,
        rating: r.rating != null && r.rating_count != null ? { value: r.rating, count: r.rating_count } : null,
      });
      out.push({
        source: MAGELLAN_SOURCE,
        sourceId,
        name: r.name,
        lat: r.lat,
        lon: r.lon,
        address: r.address ?? undefined,
        country: query.region.country ?? "HU",
        city: r.city ?? undefined,
        phone: phoneE164(r.phone) ?? undefined,
        website: site,
        photoCount: r.photo_count ?? undefined,
      });
    }
    return out;
  }
}

/**
 * Lay the worksheet's verdicts on the qualified leads (after dedupe, before enrichment):
 *   own    → website = the first found link (has_own — the chain checks if it is outdated)
 *   unsure → websiteStatus "unknown": not a lead, never contacted (§F: proof needed)
 *   portal links → listings (unverified — the free portal pass reads them)
 *   rating → mapsRating (the link is the place's own, so the attribution is certain)
 */
export function applyScoutExtras(leads: QualifiedLead[], extras: ReadonlyMap<string, ScoutExtra>): QualifiedLead[] {
  return leads.map((l) => {
    const ex = extras.get(l.sourceRefs?.[MAGELLAN_SOURCE] ?? "");
    if (!ex) return l;
    let next: QualifiedLead = l;
    if (ex.verdict === "own" && ex.ownSite && l.websiteStatus !== "has_own") {
      next = { ...next, website: ex.ownSite, websiteStatus: "has_own", isLead: false };
    } else if (ex.verdict === "unsure" && l.websiteStatus !== "has_own") {
      next = { ...next, websiteStatus: "unknown", isLead: false };
    }
    if (ex.portalLinks.length) {
      const have = new Set((next.listings ?? []).map((x) => x.url));
      const add: PortalListing[] = ex.portalLinks
        .filter((u) => !have.has(u))
        .map((u) => ({ url: u, title: new URL(u).hostname.replace(/^www\./, ""), verified: false }));
      next = { ...next, listings: [...(next.listings ?? []), ...add] };
    }
    if (ex.rating) {
      next = { ...next, mapsRating: { value: ex.rating.value, count: ex.rating.count, source: MAGELLAN_SOURCE } };
    }
    return next;
  });
}
