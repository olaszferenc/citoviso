// Website DISCOVERY via web search (§F presence layer, 2nd pass).
//
// Gap this closes: enrichPresence only GUESSES domains from the business name
// (brand-core + .hu/.com) and probes them. A real site living at a name we cannot
// derive — "szepkilato-balaton.hu" for "Kilátó Vendégház", a .eu/.net, a personal
// name, a rebrand — stayed invisible, so the lead was wrongly qualified as
// "no own site". Contacting an owner who HAS a good website with "you have no
// website" destroys credibility, so this is a trust bug, not just a miss.
//
// Here we ASK THE OPEN WEB (sources/webSearch.ts dispatcher — Brave primary per
// ADR-0026) for the business, then apply the SAME strict corroboration as
// enrichPresence: the page must confirm brand core AND region, and must not be a
// portal or a parked page. A brand-only match is a name collision (§F.14).
//
// Cost: one search query per still-siteless lead. Runs AFTER enrichPresence (the
// zero-cost domain guess wins first) and BEFORE enrichOutdated (a discovered site
// is assessed for outdatedness in the same run). Without a search backend this is
// a no-op, so the pipeline still works on the guess alone.

import { fetchHtml, geoTerms, searchPlace, verify } from "./enrichPresence.js";
import { classifyWebsite } from "./qualify.js";
import { webSearch, webSearchAvailable } from "./sources/webSearch.js";
import { config } from "../config.js";
import type { QualifiedLead, Region } from "./types.js";

const CONCURRENCY = 3;
/** Max search hits inspected per lead — the official site ranks high or not at all. */
const MAX_RESULTS = 5;

/**
 * Hosts that can never be a business's OWN site. Portals are already handled by
 * classifyWebsite (portal_only), but we must not even fetch them as candidates;
 * the rest are directories/social/maps that would produce false positives
 * (they mention both the brand and the region by construction).
 */
const NON_OWN_HOST = [
  "booking.com", "szallas.hu", "szallashelyek", "airbnb.", "tripadvisor.",
  "facebook.com", "instagram.com", "youtube.com", "google.", "maps.",
  "hovamenjek", "zimmerinfo", "programturizmus", "utazzitthon", "szallasinfo",
  "cegjegyzek", "nemzeticegtar", "ceginformacio", "yelp.", "foursquare",
  "wikipedia.org", "port.hu", "hotels.com", "expedia.", "trivago.",
  "hundidak", "nyaralas", "apartmanok", "szallas.net", "olcsoszallas",
  // Brave trial run (2026-08-18): these smaller portals' listing pages passed
  // verify() and got misfiled as own sites — never fetch them as candidates.
  "szallaskeres", "kiadoapartman", "szallashirdeto",
  "szallas24", "iranymagyarorszag", "booked.hu", "tourinform",
  // Town tourism portals list local businesses under their own roof — the
  // reenrich dry-run caught badacsony.COM too (2026-08-19), so exact domains,
  // not one TLD. Region-specific seeds; the scalable fix is ADR-0037.
  "badacsony.hu", "badacsony.com",
  // Keszthely reenrich dry-run (2026-08-19): a new region = ~15 new listing
  // hosts in one shot (the ADR-0037 thesis, live). Seeds until the registry:
  "szallasotletek", "hellomiskolc", "rendezvenyhelyszinek", "termeszetjaro.hu",
  "ittjartam.hu", "lap.hu", "apartman.hu", "balaton.hu", "szepkartyat",
  "balatoniszallas", "camping.info", "szallas-kereso", "myszallas",
  "lake-balaton.com", "gyertekvelem", "portadora",
];

/**
 * Entries are matched on the HOSTNAME, mirroring qualify.ts semantics — never
 * as a naive substring of the whole URL: "badacsony.hu" must exclude the town
 * portal but NOT "neptunbadacsony.hu" (a real own site — the danubiushotels
 * lesson). Three entry forms:
 *   "booking.com"  exact domain → the host is it, or a subdomain of it
 *   "airbnb."      any TLD      → the label "airbnb" followed by anything
 *   "szallas24"    brand word   → appears anywhere in the host
 */
function isCandidateHost(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  const labels = host.split(".");
  return !NON_OWN_HOST.some((h) => {
    if (h.endsWith(".")) return labels.includes(h.slice(0, -1));
    if (h.includes(".")) return host === h || host.endsWith(`.${h}`);
    return host.includes(h);
  });
}

/**
 * STRUCTURAL defense on top of the host list (which is whack-a-mole, ADR-0037):
 * a business's OWN site ranks with its ROOT (or a language root like /en/) —
 * a DEEP path on an unknown host (/lista/x, /category/y, /latnivalok/z,
 * /p/2154/…) is a listing/blog page about the business, not its site. The
 * Keszthely dry-run's residual false positives were all deep paths.
 */
function isShallowUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const segments = u.pathname.split("/").filter(Boolean);
    return segments.length <= 1 && !u.search;
  } catch {
    return false;
  }
}

/**
 * Ask the open web for ONE lead's official site and return it only if confirmed.
 * Shared by the bulk pass below and by the broken-site repair in enrichOutdated.
 *
 * QUERY SHAPE (2026-08-20, measured against Brave): the place word is the lead's
 * OWN town, not the region label, and the industry filler is gone. Measured on
 * "Tekergő" / Balatonberény:
 *   "Tekergő Balatonberény hivatalos oldal"          → tekergobalaton.hu at #1
 *   "Tekergő Balatonberény szállás hivatalos oldal"  → 3 portals first, then a deep path
 *   "Tekergő keszthely és környéke szállás …"        → portals only, the lead is gone
 * The word "szállás" is what booking portals optimize for, so it hands them the
 * top slots; the multi-word region label buries the business name entirely.
 */
export async function findOwnSite(
  lead: QualifiedLead,
  region: Region,
  apiKey: string,
  cseId: string,
): Promise<string | null> {
  const query = `${lead.name} ${searchPlace(lead, region)} hivatalos oldal`;
  const terms = geoTerms(lead, region);
  const results = await webSearch(query, apiKey, cseId, MAX_RESULTS);
  for (const r of results) {
    if (!r.link || !isCandidateHost(r.link) || !isShallowUrl(r.link)) continue;
    const page = await fetchHtml(r.link);
    // Same geo-strict rule as the domain-guess pass: brand AND locality.
    // The redirect target must be shallow too (a root URL bouncing to a
    // deep listing page is the same portal noise in disguise).
    if (!page || !isShallowUrl(page.finalUrl)) continue;
    if (!verify(lead.name, terms, page.html)) continue;
    // A search hit that resolves to a portal is not an own site.
    if (classifyWebsite(page.finalUrl) === "has_own") return page.finalUrl;
  }
  return null;
}

/** Convenience wrapper for callers that have no API keys at hand (repair pass). */
export async function findOwnSiteForLead(
  lead: QualifiedLead,
  region: Region,
): Promise<string | null> {
  if (!webSearchAvailable()) return null;
  return findOwnSite(lead, region, config.googleMapsApiKey, config.googleCseId);
}

/**
 * Find the official website of leads that still look siteless. Returns the leads
 * with `website`/`websiteStatus` filled in where a site was CONFIRMED.
 */
export async function enrichSiteSearch(
  leads: QualifiedLead[],
  apiKey: string,
  cseId: string,
  region: Region,
): Promise<QualifiedLead[]> {
  // Any configured backend will do (Brave primary, CSE legacy) — the dispatcher decides.
  if (!webSearchAvailable()) return leads;

  const targets = leads.filter(
    (l) => l.websiteStatus === "none" || l.websiteStatus === "portal_only",
  );
  if (!targets.length) return leads;

  const found = new Map<QualifiedLead, string>();
  let next = 0;

  async function worker(): Promise<void> {
    while (next < targets.length) {
      const lead = targets[next++]!;
      try {
        const url = await findOwnSite(lead, region, apiKey, cseId);
        if (url) found.set(lead, url);
      } catch {
        // A failed lookup must never break the run — the lead just stays siteless.
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker),
  );

  if (found.size) {
    console.log(
      `  → ${found.size} lead-nek MÉGIS van saját honlapja (webes keresés találta meg)`,
    );
  }
  return leads.map((l) => {
    const url = found.get(l);
    return url ? { ...l, website: url, websiteStatus: classifyWebsite(url) } : l;
  });
}
