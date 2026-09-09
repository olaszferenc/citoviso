import { scoreMatch, type MatchConfidence } from "./confidence.js";
import { classifyWebsite, isMvpLead } from "./qualify.js";
import {
  placesLookup,
  PlacesUnavailableError,
  type PlacesFailure,
  type PlacesMatch,
} from "./sources/googleMaps.js";
import type { QualifiedLead } from "./types.js";

// Per-lead Google Places lookup + A4 confidence gating. Discovery's single bbox
// search only returns the top ~20 places, so OSM-only leads carry no Places data
// — and that is exactly where contact + photos are missing. This pass looks each
// such lead up, SCORES the match, and only applies the data when confidence is
// not "low" (never attribute a weak match's phone/website — A4). Runs BEFORE the
// outdated-check so a newly-found own site is assessed correctly.
//
// It also guarantees EVERY lead leaves this pass carrying a matchConfidence so the
// §F.17b fact-check gate can act on it: a lead discovered directly from Google
// Places IS the authoritative record for its location, so it is scored as a
// self-match (distance 0, name identical) rather than left unscored.
const CONCURRENCY = 5;

export async function enrichPlaces(
  leads: QualifiedLead[],
  apiKey: string,
  /**
   * Called once if the Places API could not be REACHED during this pass (quota, key,
   * network). The chain deliberately survives an outage — but the caller must be able
   * to say so: a re-enrich that reported "nem változott semmi" while every lookup was
   * bouncing off a spent quota is a lie by omission (measured 2026-09-09).
   */
  onUnavailable?: (failure: PlacesFailure) => void,
): Promise<QualifiedLead[]> {
  if (!apiKey) return leads;

  // Look up leads that are missing contact or photos and have coordinates.
  const targets = leads.filter(
    (l) => l.lat != null && l.lon != null && (!l.phone || (l.photoCount ?? 0) === 0),
  );
  const found = new Map<QualifiedLead, { match: PlacesMatch; conf: MatchConfidence }>();
  let outage: PlacesFailure | undefined;

  let next = 0;
  async function worker(): Promise<void> {
    while (next < targets.length) {
      // A spent quota does not heal within one pass: once we know the API is closed,
      // firing the remaining leads at it only burns time and rate-limit budget.
      if (outage === "quota" || outage === "auth") return;
      const lead = targets[next++];
      try {
        const match = await placesLookup(
          lead.name,
          lead.lat as number,
          lead.lon as number,
          apiKey,
        );
        if (match) {
          const conf = scoreMatch({
            distanceMeters: match.distanceMeters,
            nameSimilarity: match.nameSimilarity,
            corroboratedByOsm: lead.sources.includes("osm"),
          });
          found.set(lead, { match, conf });
        }
      } catch (e) {
        // Skip this lead, keep the rest — but REMEMBER an infrastructure failure so the
        // caller can report it instead of presenting a hollow pass as a clean one.
        if (e instanceof PlacesUnavailableError) {
          outage ??= e.failure;
          console.warn(`[places] ${lead.name}: ${e.message}`);
        }
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, targets.length) }, () =>
      worker(),
    ),
  );
  if (outage) onUnavailable?.(outage);

  return leads.map((l) => {
    const entry = found.get(l);
    if (!entry) {
      // No per-lead lookup applied (lead already had contact + photos, or none
      // matched). A Places-native lead is its own authoritative record — score it
      // as a self-match so no lead reaches §F.17b without a confidence.
      if (l.matchConfidence == null && l.sources.includes("google_places")) {
        const conf = scoreMatch({
          distanceMeters: 0,
          nameSimilarity: 1,
          corroboratedByOsm: l.sources.includes("osm"),
        });
        return { ...l, matchConfidence: conf.score };
      }
      return l;
    }
    const { match, conf } = entry;
    // A4 gate: never attribute a LOW-confidence match's data to the lead.
    if (conf.band === "low") {
      return { ...l, matchConfidence: conf.score };
    }
    const phone = l.phone ?? match.phone;
    const website = l.website ?? match.website;
    const photoCount = Math.max(l.photoCount ?? 0, match.photoRefs.length);
    const status = classifyWebsite(website);
    return {
      ...l,
      phone,
      website,
      photoCount,
      // The lookup that just supplied phone/photos/rating IS a source of this
      // lead's data, so it must say so. Until now only the DISCOVERY adapters
      // were listed, and an OSM-discovered lead showed "Források: osm" while
      // every photo on screen had come from Places — the label contradicted
      // what the operator was looking at.
      sources: l.sources.includes("google_places")
        ? l.sources
        : [...l.sources, "google_places"],
      sourceRefs: match.placeId
        ? { ...l.sourceRefs, google_places: match.placeId }
        : l.sourceRefs,
      // Geo facets from the verified match — the lead's own tags win when present.
      country: l.country ?? match.country,
      city: l.city ?? match.city,
      websiteStatus: status,
      matchConfidence: conf.score,
      isLead: isMvpLead(status),
    };
  });
}
