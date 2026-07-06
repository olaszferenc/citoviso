import { scoreMatch, type MatchConfidence } from "./confidence.js";
import { classifyWebsite, isMvpLead } from "./qualify.js";
import { placesLookup, type PlacesMatch } from "./sources/googleMaps.js";
import type { QualifiedLead } from "./types.js";

// Per-lead Google Places lookup + A4 confidence gating. Discovery's single bbox
// search only returns the top ~20 places, so OSM-only leads carry no Places data
// — and that is exactly where contact + photos are missing. This pass looks each
// such lead up, SCORES the match, and only applies the data when confidence is
// not "low" (never attribute a weak match's phone/website — A4). Runs BEFORE the
// outdated-check so a newly-found own site is assessed correctly.
const CONCURRENCY = 5;

export async function enrichPlaces(
  leads: QualifiedLead[],
  apiKey: string,
): Promise<QualifiedLead[]> {
  if (!apiKey) return leads;

  // Look up leads that are missing contact or photos and have coordinates.
  const targets = leads.filter(
    (l) => l.lat != null && l.lon != null && (!l.phone || (l.photoCount ?? 0) === 0),
  );
  const found = new Map<QualifiedLead, { match: PlacesMatch; conf: MatchConfidence }>();

  let next = 0;
  async function worker(): Promise<void> {
    while (next < targets.length) {
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
      } catch {
        // network/timeout — skip this lead, keep the rest
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, targets.length) }, () =>
      worker(),
    ),
  );

  return leads.map((l) => {
    const entry = found.get(l);
    if (!entry) return l;
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
      websiteStatus: status,
      matchConfidence: conf.score,
      isLead: isMvpLead(status),
    };
  });
}
