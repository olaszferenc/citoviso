// Core scraper types. The scraper is a standalone, reusable component:
// input = region × industry × sources, output = qualified market players.
// It is industry-agnostic by design (see _planning/BACKLOG.md — scraper-as-product);
// the accommodation MVP only fixes the Industry union and the OSM tag mapping.

export type Industry = "accommodation";

export interface Region {
  readonly id: string;
  readonly label: string;
  /** Bounding box in WGS84 degrees: [south, west, north, east]. */
  readonly bbox: readonly [number, number, number, number];
}

export interface ScrapeQuery {
  readonly region: Region;
  readonly industry: Industry;
}

/**
 * Website presence — the core qualification signal (Phase 4c-i).
 * - none:        no website at all (prime lead: build from scratch)
 * - portal_only: only a portal/social profile (booking/airbnb/szallas.hu/…), no own domain (prime lead)
 * - has_own:     an own domain (MVP: not a lead yet; the "outdated" check is a later slice)
 * - unknown:     could not determine
 */
export type WebsiteStatus = "none" | "portal_only" | "has_own" | "unknown";

/** A market player as returned by a single source, before dedupe/qualification. */
export interface RawLead {
  readonly source: string; // adapter name, e.g. "osm" | "google_places"
  readonly sourceId: string; // stable id within the source (provenance)
  readonly name: string;
  readonly lat?: number;
  readonly lon?: number;
  readonly address?: string;
  readonly phone?: string;
  readonly email?: string;
  readonly website?: string;
}

/**
 * Assessment of an existing own website — the second qualification layer.
 * An outdated own site makes the player a lead (modernization), not an exclusion.
 */
export interface WebsiteAssessment {
  /** Did the site respond at all? (A dead domain is a strong lead signal.) */
  readonly reachable: boolean;
  /** Has a viewport meta tag (mobile-responsive)? The strongest modern signal. */
  readonly responsive: boolean;
  /** Latest copyright year found in the page text, if any. */
  readonly copyrightYear?: number;
  /** Outdated markers found (no-viewport, old-copyright, legacy tags, flash, unreachable). */
  readonly signals: string[];
  /** Verdict: does the own site look outdated (→ modernization lead)? */
  readonly outdated: boolean;
}

/** A deduped, qualified lead — the scraper's output unit. */
export interface QualifiedLead {
  readonly name: string;
  readonly industry: Industry;
  readonly region: string;
  readonly lat?: number;
  readonly lon?: number;
  readonly address?: string;
  readonly phone?: string;
  readonly email?: string;
  readonly website?: string;
  readonly websiteStatus: WebsiteStatus;
  /** Which adapters found this player — the seed of the digital-footprint profile. */
  readonly sources: string[];
  /** Assessment of the own site (only set for has_own leads after enrichment). */
  readonly assessment?: WebsiteAssessment;
  /** Qualifies as a Citoviso lead? (no own site, OR own site is outdated.) */
  readonly isLead: boolean;
}
