// Core scraper types. The scraper is a standalone, reusable component:
// input = region × industry × sources, output = qualified market players.
// It is industry-agnostic by design (see _planning/BACKLOG.md — scraper-as-product);
// the accommodation MVP only fixes the Industry union and the OSM tag mapping.

export type Industry = "accommodation";

export interface Region {
  readonly id: string;
  readonly label: string;
  /** ISO-2 country the area belongs to (region table column) — the last-resort
   *  country fallback for leads the sources/reverse-geocode could not locate. */
  readonly country?: string;
  /** Bounding box in WGS84 degrees: [south, west, north, east]. Always present —
   *  the source queries take a rectangle. For a circular area it is the enclosing box. */
  readonly bbox: readonly [number, number, number, number];
  /** Circular area (0019): results outside this circle are dropped, so the effective
   *  search area is round rather than the enclosing rectangle. */
  readonly circle?: {
    readonly lat: number;
    readonly lon: number;
    readonly radiusKm: number;
  };
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
  /** ISO 3166-1 alpha-2 country code (e.g. "HU", "HR"), parsed from the source. */
  readonly country?: string;
  /** City/locality/town, parsed from the source's structured address. */
  readonly city?: string;
  readonly phone?: string;
  readonly email?: string;
  readonly website?: string;
  /** Photos available on this source (e.g. Google Places photo count). */
  readonly photoCount?: number;
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
  /** Number of <img> tags on the page (enrichment material from an own site). */
  readonly imageCount: number;
  /** Email addresses found on the page (mailto: + patterns) — contact material. */
  readonly emails: string[];
  /** Verdict: does the own site look outdated (→ modernization lead)? */
  readonly outdated: boolean;
}

/**
 * Best reachable outreach channel, ranked by fit for our automated, clickable-link
 * model: email (rich, cheap, mass-automatable, GDPR-unsubscribable) > sms (mobile,
 * link works) > voice (landline/phone only — hard to automate) > none (worthless).
 */
export type ContactChannel = "email" | "sms" | "voice" | "none";

/**
 * How much raw material we can gather for this lead (the enrichment measurement).
 * The core question: is there enough to build a magical mock — especially for the
 * "no own site" segment (the most valuable, and the material-poorest).
 */
export interface LeadMaterial {
  /** Photos on Google Places. */
  readonly placesPhotos: number;
  /** Images scraped from an own website (has_own only). */
  readonly websiteImages: number;
  /** Is there Street View imagery at the coordinates (a guaranteed baseline photo)? */
  readonly streetView: boolean;
  /** placesPhotos + websiteImages + (streetView ? 1 : 0). */
  readonly totalImages: number;
  /** Do we have at least one image from any source? */
  readonly hasAnyImage: boolean;
}

/** A deduped, qualified lead — the scraper's output unit. */
export interface QualifiedLead {
  readonly name: string;
  readonly industry: Industry;
  readonly region: string;
  readonly lat?: number;
  readonly lon?: number;
  readonly address?: string;
  /** ISO 3166-1 alpha-2 country code (e.g. "HU", "HR"), from OSM/Places. Filter facet. */
  readonly country?: string;
  /** City/locality/town, from OSM/Places structured address. Filter facet. */
  readonly city?: string;
  readonly phone?: string;
  readonly email?: string;
  readonly website?: string;
  readonly websiteStatus: WebsiteStatus;
  /** Which adapters found this player — the seed of the digital-footprint profile. */
  readonly sources: string[];
  /**
   * Stable id per source, so a source can be OPENED, not just named:
   * `{ osm: "node/123456", google_places: "ChIJ…" }`. Before this, `sourceId`
   * was dropped at merge, which left the console printing "Források: osm" with
   * nothing behind it — the operator had to trust an unverifiable label.
   */
  readonly sourceRefs?: Readonly<Record<string, string>>;
  /** Photos available on Google Places (carried from discovery). */
  readonly photoCount?: number;
  /** A4 match-confidence (0..1) of the per-lead Places match, if one was scored. */
  readonly matchConfidence?: number;
  /** Assessment of the own site (only set for has_own leads after enrichment). */
  readonly assessment?: WebsiteAssessment;
  /** Gathered enrichment material (set after the material measurement pass). */
  readonly material?: LeadMaterial;
  /** Best reachable outreach channel (set after the contact pass). */
  readonly contactChannel?: ContactChannel;
  /**
   * DIGITAL FOOTPRINT: portal/catalogue pages that describe THIS business.
   * Deliberately not "websites" — the lead does not control these, which is
   * exactly why it stays a target. They matter for three jobs: the curator can
   * verify at a glance that we found the right business, they are the richest
   * free source of facts and contact details, and the sales pitch is literally
   * "you are scattered across other people's pages, own your presence".
   */
  readonly listings?: readonly PortalListing[];
  /**
   * Full contact ledger: every address/number seen, with source and verdict.
   * `email`/`phone` above remain the CHOSEN ones; this is the evidence behind
   * the choice and the raw material for later, measured ranking rules.
   */
  readonly contacts?: readonly ContactCandidate[];
  /** Qualifies as a Citoviso lead? (no own site, OR own site is outdated.) */
  readonly isLead: boolean;
}

/**
 * EVERY contact detail we ever saw for a lead, with WHERE it came from and what
 * we decided about it — kept even when rejected.
 *
 * Why keep the rejects: the accept/reject rules (corroboration, office-address
 * and template filters, the shared-number guard) are judgement calls made from
 * a handful of cases. Throwing away what they dropped makes them unauditable —
 * the operator sees "no e-mail found" and cannot tell whether nothing existed
 * or whether we discarded the right one. It also destroys the evidence needed
 * to set ranking rules later, EMPIRICALLY, once outreach results exist
 * (does a portal-listed address answer better than one off the own site?).
 *
 * The single `email`/`phone` fields stay as the chosen primary — this is the
 * full record behind that choice, not a replacement for it.
 */
export interface ContactCandidate {
  readonly kind: "email" | "phone";
  readonly value: string;
  /** Where it came from: "places" | "osm" | "own_site" | "web_snippet" | host of the page read. */
  readonly source: string;
  /** The exact page it was read from, when there was one (openable by the curator). */
  readonly sourceUrl?: string;
  /** Did it pass the quality bar (business address, tied to THIS lead)? */
  readonly accepted: boolean;
  /** Why it was dropped — plain Hungarian, shown to the operator. */
  readonly rejectedReason?: string;
  /** ISO date of the first sighting; a later run does not overwrite it. */
  readonly firstSeen?: string;
}

/** One portal/catalogue page found for a lead (see QualifiedLead.listings). */
export interface PortalListing {
  readonly url: string;
  /** Result title, trimmed — what the operator recognises the page by. */
  readonly title: string;
  /** True when we actually READ this page and took contact details from it —
   *  a corroborated find, not just a search hit that mentioned the name. */
  readonly verified?: boolean;
}
