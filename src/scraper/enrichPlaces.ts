import { classifyWebsite, isMvpLead } from "./qualify.js";
import { placesLookup } from "./sources/googleMaps.js";
import type { QualifiedLead } from "./types.js";

// Per-lead Google Places lookup. Discovery's single bbox search only returns the
// top ~20 places, so OSM-only leads carry no Places data — and that is exactly
// where contact + photos are missing. This pass looks each such lead up by
// name+location and fills phone, website, and photo count. Runs BEFORE the
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
  const found = new Map<
    QualifiedLead,
    { phone?: string; website?: string; photoCount: number }
  >();

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
        if (match) found.set(lead, match);
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
    const m = found.get(l);
    if (!m) return l;
    const phone = l.phone ?? m.phone;
    const website = l.website ?? m.website;
    const photoCount = Math.max(l.photoCount ?? 0, m.photoCount);
    const status = classifyWebsite(website);
    return {
      ...l,
      phone,
      website,
      photoCount,
      websiteStatus: status,
      isLead: isMvpLead(status),
    };
  });
}
