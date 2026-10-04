// The SOURCED-FACT SET an existing mock's copy is judged against — one assembly for both
// paths that change the words of a mock after generation: the AI rewrite (recopy.ts) and
// the curator's hand edit (copyManual.ts). Two assemblies would let the same sentence pass
// one gate and fail the other (feedback_one_rule_two_copies); this was lifted out of
// recopy.ts verbatim.

import type { SiteData } from "../engine/recipe.js";
import { DEFAULT_LANG } from "../i18n/lang.js";
import type { PortalProfile } from "../scraper/types.js";
import { getRegionContext, resolveRegion } from "./generate.js";
import { decisionWeightDesc, descriptionSellingPoints } from "./marketCheck.js";
import { loadLead } from "./persist.js";

export type LoadedLead = Awaited<ReturnType<typeof loadLead>>["lead"];

export interface CopySources {
  readonly lead: LoadedLead;
  readonly region: ReturnType<typeof resolveRegion>;
  readonly ctx: ReturnType<typeof getRegionContext>;
  readonly lang: string;
  /** The listing prose (owner self-introduction first, when pasted). */
  readonly descriptions: string[];
  /** Amenities from high-band listings + strong claims lifted from the prose, strongest
   *  first. Mutable on purpose: recopy appends the quote-verified facts of its rewrite. */
  readonly amenities: string[];
  readonly photoUrls: string[];
}

export async function loadCopySources(
  leadId: string,
  inputs: Record<string, unknown>,
  siteData: SiteData,
): Promise<CopySources> {
  const { lead } = await loadLead(leadId);
  const region = resolveRegion(inputs.regionId as string | undefined, lead.lat, lead.lon);
  const ctx = getRegionContext(region.id, region.label);
  const lang = siteData.lang ?? DEFAULT_LANG;

  // The SAME sourced-fact set the first generation used (amenities from high-band
  // listings + the strong claims lifted out of the listing prose).
  const profiles =
    (lead as unknown as { portalProfiles?: readonly PortalProfile[] }).portalProfiles ?? [];
  const high = profiles.filter((p) => p.matchBand === "high");
  const descriptions = high
    .map((p) => p.description?.trim())
    .filter((d): d is string => Boolean(d && d.length >= 120))
    .map((d) => d.slice(0, 1500));
  // Same source set as generateEngine (guard-scope twin): the curator-pasted
  // owner self-introduction leads, when present — see generateEngine.ts.
  const ownerIntro = (lead as unknown as { ownerIntro?: string }).ownerIntro?.trim();
  if (ownerIntro && ownerIntro.length >= 40) descriptions.unshift(ownerIntro.slice(0, 1500));
  const amenities = [...new Set(high.flatMap((p) => p.amenities))].filter((a) => a.trim().length > 1);
  for (const f of descriptionSellingPoints(descriptions)) {
    if (!amenities.some((a) => a.toLowerCase() === f.toLowerCase())) amenities.push(f);
  }
  // Strongest first — the ranked-list contract the prompt states (see generateEngine).
  amenities.sort(decisionWeightDesc);

  const photoUrls = siteData.photos.slice(0, 4).map((p) => p.url);
  return { lead, region, ctx, lang, descriptions, amenities, photoUrls };
}

/** The market guard's source block (same shape for both paths). */
export function marketSourceOf(s: CopySources, siteData: SiteData) {
  return {
    name: s.lead.name,
    town: s.lead.city ?? null,
    amenities: s.amenities,
    ...(s.descriptions.length ? { descriptions: s.descriptions } : {}),
    ...(siteData.rating ? { rating: { value: siteData.rating.value, count: siteData.rating.count ?? null } } : {}),
  };
}

/** The first generation's review-backed facts (the source panel snapshot). */
export function reviewFactsOf(inputs: Record<string, unknown>): { label: string; source: string; quote?: string }[] {
  return ((inputs.sourcePanel as { facts?: { label: string; source: string; quote?: string }[] } | undefined)?.facts ?? [])
    .filter((f) => f.source === "google_places");
}

/** The fact gate's lead block — the review quotes ground the copy as they did for the critic. */
export function factLeadOf(s: CopySources, siteData: SiteData, inputs: Record<string, unknown>) {
  const reviewQuotes = reviewFactsOf(inputs)
    .filter((f) => f.quote)
    .map((f) => f.quote!);
  const descriptions = s.descriptions;
  return {
    name: s.lead.name,
    ...(s.region.known ? { region: s.region.label } : {}),
    address: s.lead.address,
    phone: s.lead.phone,
    email: s.lead.email,
    ...(siteData.rating ? { rating: { value: siteData.rating.value, count: siteData.rating.count ?? null } } : {}),
    ...(s.amenities.length ? { amenities: s.amenities } : {}),
    // The placed-claim rule must weigh the same evidence the critic did (placed-claim-check ④).
    ...(descriptions.length || reviewQuotes.length ? { descriptions: [...descriptions, ...reviewQuotes] } : {}),
  };
}
