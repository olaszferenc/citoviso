import { hasStreetView } from "./streetview.js";
import type { LeadMaterial, QualifiedLead } from "./types.js";

// The enrichment measurement pass: for each lead, tally how much visual material
// we can gather (Places photos carried from discovery, own-site images from the
// assessment, and a Street View baseline). This answers the core risk: is there
// enough to build a magical mock — especially for the "no own site" segment.
const CONCURRENCY = 6;

function buildMaterial(lead: QualifiedLead, streetView: boolean): LeadMaterial {
  const placesPhotos = lead.photoCount ?? 0;
  const websiteImages = lead.assessment?.imageCount ?? 0;
  const totalImages = placesPhotos + websiteImages + (streetView ? 1 : 0);
  return {
    placesPhotos,
    websiteImages,
    streetView,
    totalImages,
    hasAnyImage: totalImages > 0,
  };
}

export async function enrichMaterial(
  leads: QualifiedLead[],
  apiKey: string,
): Promise<QualifiedLead[]> {
  const streetViewByLead = new Map<QualifiedLead, boolean>();
  const targets = apiKey
    ? leads.filter((l) => l.lat != null && l.lon != null)
    : [];

  let next = 0;
  async function worker(): Promise<void> {
    while (next < targets.length) {
      const lead = targets[next++];
      const sv = await hasStreetView(
        lead.lat as number,
        lead.lon as number,
        apiKey,
      );
      streetViewByLead.set(lead, sv);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, targets.length) }, () =>
      worker(),
    ),
  );

  return leads.map((l) => ({
    ...l,
    material: buildMaterial(l, streetViewByLead.get(l) ?? false),
  }));
}
