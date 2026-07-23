// lead → SiteData mapping (ADR-0016). The pure, deterministic bridge from a scraped
// QualifiedLead (the scraper's output) to the engine's SiteData (the renderer's input).
//
// Structured facts (name, contact) come straight off the lead — never invented. The
// AI-written copy (tagline/intro/highlights) is passed in as an optional brief; without
// one, the fallbacks are FACT-SAFE (empty / region-only), honouring §B.17 (never fabricate
// a hard fact). Photos are passed in — their URLs live in the generation pipeline, not on
// the lead. This function makes NO network/AI/DB call: it is a plain transform, so the same
// inputs always yield the same SiteData — a precondition of the mock=live guarantee.

import type { QualifiedLead } from "../scraper/types.js";
import type { Photo, SiteData } from "./recipe.js";

/** AI-written copy for the property. A decoupled subset of the generator's brief so the
 *  engine does not depend on the old generation pipeline. */
export interface SiteCopy {
  readonly tagline: string;
  readonly intro: string;
  readonly highlights: readonly string[];
}

export interface LeadToSiteDataOptions {
  /** AI-written copy (from the brief generator). Omitted → fact-safe fallbacks. */
  readonly copy?: SiteCopy | null;
  /** Photo URLs for the gallery (from the generation pipeline; not stored on the lead). */
  readonly photos?: readonly Photo[];
  /** Region tagline used as an honest fallback hero subtitle when there is no AI copy. */
  readonly regionTagline?: string;
}

function clean(s: string | undefined | null): string {
  return (s ?? "").trim();
}

export function leadToSiteData(
  lead: QualifiedLead,
  opts: LeadToSiteDataOptions = {},
): SiteData {
  const copy = opts.copy ?? null;

  // Contact — structured facts off the lead; only include what actually exists.
  const contact: { email?: string; phone?: string; address?: string } = {};
  if (clean(lead.email)) contact.email = clean(lead.email);
  if (clean(lead.phone)) contact.phone = clean(lead.phone);
  if (clean(lead.address)) contact.address = clean(lead.address);

  return {
    name: clean(lead.name),
    // Copy from the brief when present; fact-safe fallbacks otherwise (no invented facts).
    tagline: copy ? clean(copy.tagline) : clean(opts.regionTagline),
    intro: copy ? clean(copy.intro) : "",
    highlights: copy ? copy.highlights.map(clean).filter(Boolean) : [],
    photos: (opts.photos ?? []).filter((p) => clean(p.url)),
    contact,
  };
}
