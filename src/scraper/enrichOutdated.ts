import { isMvpLead } from "./qualify.js";
import { assessWebsite } from "./website.js";
import type { QualifiedLead } from "./types.js";

// Second qualification layer: for leads that have an own site, fetch and assess
// it. An outdated own site flips the player into a lead (modernization case).
// Bounded concurrency keeps us polite to the target sites.
const CONCURRENCY = 6;

export async function enrichOutdated(
  leads: QualifiedLead[],
): Promise<QualifiedLead[]> {
  const targets = leads.filter(
    (l) => l.websiteStatus === "has_own" && l.website,
  );
  const updated = new Map<QualifiedLead, QualifiedLead>();
  let next = 0;

  async function worker(): Promise<void> {
    while (next < targets.length) {
      const lead = targets[next++];
      const assessment = await assessWebsite(lead.website as string);
      updated.set(lead, {
        ...lead,
        assessment,
        isLead: isMvpLead(lead.websiteStatus) || assessment.outdated,
      });
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, targets.length) }, () =>
      worker(),
    ),
  );
  return leads.map((l) => updated.get(l) ?? l);
}
