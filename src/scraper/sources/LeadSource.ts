import type { RawLead, ScrapeQuery } from "../types.js";

/**
 * A lead source is one adapter over one platform (OSM, Google Places, a portal…).
 * New source = new adapter behind this interface; the core stays unchanged.
 * This is the seed of the per-country/industry "platform registry" (Phase 4c-i).
 */
export interface LeadSource {
  readonly name: string;
  /**
   * Return raw market players in the query's region+industry. Should not throw
   * for "no results" (return []); may throw on hard failures (network/auth).
   */
  fetch(query: ScrapeQuery): Promise<RawLead[]>;
  /**
   * Loud, operator-facing warnings from the LAST fetch (a coverage limit hit, a
   * paid-call volume over the warning line…). The run copies them into its stats,
   * so they survive the live log. Optional: a source with nothing to say omits it.
   */
  warnings?(): string[];
}
