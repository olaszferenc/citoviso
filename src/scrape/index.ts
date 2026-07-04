// Ingest step: turn a public listing (Google Maps place + booking portals) into
// a partial Property record. Implementations live per source; this file defines
// the contract the pipeline depends on.

import type { Property } from "../generate/types.js";

export interface ScrapeInput {
  /** Free-text query or a Maps place URL. */
  query: string;
  /** Optional town to disambiguate (many "Napsugár Vendégház" exist). */
  town?: string;
}

/** A source that can contribute data about one accommodation. */
export interface Source {
  readonly name: string;
  /** Returns a partial Property; the pipeline merges across sources. */
  fetch(input: ScrapeInput): Promise<Partial<Property>>;
}

/**
 * Merge partials from several sources into one record. First non-empty wins per
 * field; images accumulate. Real merge logic + conflict rules land with the
 * first concrete Source implementation.
 */
export async function ingest(
  _input: ScrapeInput,
  _sources: Source[],
): Promise<Partial<Property>> {
  throw new Error("ingest(): not implemented yet — no Source wired up");
}
