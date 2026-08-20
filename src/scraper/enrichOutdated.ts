import { fetchHtml, geoTerms, verify } from "./enrichPresence.js";
import { findOwnSiteForLead } from "./enrichSiteSearch.js";
import { classifyWebsite, isMvpLead } from "./qualify.js";
import { assessWebsite } from "./website.js";
import type { QualifiedLead, Region } from "./types.js";

// Second qualification layer: for leads that have an own site, fetch and assess
// it. An outdated own site flips the player into a lead (modernization case).
// Bounded concurrency keeps us polite to the target sites.
const CONCURRENCY = 6;

/**
 * BROKEN-LINK REPAIR (2026-08-20, the Tekergő case).
 *
 * A source's `website` tag is a snapshot that rots. OSM held
 * "tekergobalaton.hu/Satorozas" for Tekergő — a 404 — while the site's ROOT
 * answered 200 and was perfectly fine. That one stale path did real damage:
 *   · the lead counted as has_own, so enrichSiteSearch (which only targets
 *     none/portal_only) never even looked at it;
 *   · the assessment came back unreachable → "elavult", and the console showed
 *     the operator a dead URL as the business's website.
 *
 * So a site that fails to respond is not a verdict yet, it is a question. We ask
 * it twice, cheapest first:
 *   1. the ROOT of the same domain (free — one HTTP request, no API);
 *   2. the open web, via the same confirmed-only search the discovery pass uses.
 *
 * Both answers are geo-verified before adoption. That matters most for step 1:
 * an expired domain that somebody else re-registered would otherwise be adopted
 * as the lead's own site purely because it now responds.
 */
function rootOf(url: string): string | null {
  try {
    const u = new URL(url);
    const bare = u.pathname.replace(/\/+$/, "") === "" && !u.search && !u.hash;
    return bare ? null : `${u.origin}/`;
  } catch {
    return null; // unparseable URL — nothing to fall back to
  }
}

/** Try the domain root, then the open web. Returns a CONFIRMED url, or null. */
async function repairBrokenSite(
  lead: QualifiedLead,
  region: Region,
): Promise<string | null> {
  const terms = geoTerms(lead, region);

  const root = lead.website ? rootOf(lead.website) : null;
  if (root) {
    const page = await fetchHtml(root);
    if (page && verify(lead.name, terms, page.html)) {
      if (classifyWebsite(page.finalUrl) === "has_own") return page.finalUrl;
    }
  }

  // The domain itself is gone (or now belongs to someone else) — ask the web.
  try {
    return await findOwnSiteForLead(lead, region);
  } catch {
    return null; // search/network failure — keep the unreachable verdict
  }
}

export async function enrichOutdated(
  leads: QualifiedLead[],
  region?: Region,
): Promise<QualifiedLead[]> {
  const targets = leads.filter(
    (l) => l.websiteStatus === "has_own" && l.website,
  );
  const updated = new Map<QualifiedLead, QualifiedLead>();
  let repaired = 0;
  let next = 0;

  async function worker(): Promise<void> {
    while (next < targets.length) {
      const lead = targets[next++];
      let website = lead.website as string;
      let assessment = await assessWebsite(website);

      // Only a dead site is worth a second question, and only when we know the
      // region (the geo-anchor's fallback) — otherwise the verdict stands.
      if (!assessment.reachable && region) {
        const fixed = await repairBrokenSite(lead, region);
        if (fixed && fixed !== website) {
          website = fixed;
          assessment = await assessWebsite(website);
          repaired++;
        }
      }

      updated.set(lead, {
        ...lead,
        website,
        websiteStatus: classifyWebsite(website),
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
  if (repaired) {
    console.log(
      `  → ${repaired} lead törött honlap-linkje javítva (gyökér-visszalépés vagy webes keresés)`,
    );
  }
  return leads.map((l) => updated.get(l) ?? l);
}
