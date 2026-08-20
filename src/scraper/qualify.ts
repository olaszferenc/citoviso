import type { WebsiteStatus } from "./types.js";

// Known booking/listing/social portals: a website on one of these is NOT an own
// site — the player is still a prime lead (portal_only). Extend per country
// (this list is the Hungarian/accommodation seed of the platform registry).
const PORTAL_DOMAINS = [
  "booking.com",
  "airbnb.",
  "szallas.hu",
  "szallashely",
  "hovamenjek",
  "zimmerinfo",
  "tripadvisor.",
  "expedia.",
  "hotels.com",
  "agoda.",
  "balatonnyaralas",
  "turistautak.hu",
  "facebook.com",
  "instagram.com",
  // Found live by the Brave trial run (2026-08-18, Badacsony): listing pages on
  // these portals corroborate brand+region by construction, so verify() passes
  // them — the host list is the only defense against the inverse credibility
  // bug (a real no-site lead misfiled as has_own drops out of the funnel).
  "szallaskeres",
  "kiadoapartman",
  "szallashirdeto",
  // Round 2 of the same trial (OSM pool included): more listing hosts.
  "szallas24",
  "iranymagyarorszag",
  // szallas.hu's white-label booking-engine subdomains (<property>.booked.hu) —
  // a booking page on their domain, not a site the business controls.
  "booked.hu",
  // Town tourism portals list local businesses under their own roof
  // (badacsony.hu/fortuna_szallashely). Region-specific seeds for now; the
  // scalable fix is the platform registry. The .com twin surfaced in the
  // reenrich dry-run (2026-08-19, badacsony.com/services/accomodation — note
  // the single-m typo, so the listing-path regex cannot catch it either).
  "badacsony.hu",
  "badacsony.com",
  // Káli-medence tourism portal — kali.hu/szallas/<name> lists local lodgings
  // (owner test, Ferenc Ház). Its entries are the only "website" some of these
  // businesses have, which is exactly what makes them targets.
  "kali.hu",
  // Keszthely reenrich dry-run (2026-08-19): a NEW region surfaced ~15 more
  // listing hosts in one shot — the hardcoded list is whack-a-mole and ADR-0037
  // (platform registry) is the structural fix. Seeds until then:
  "szallasotletek",
  "hellomiskolc",
  "rendezvenyhelyszinek",
  "termeszetjaro.hu",
  "ittjartam.hu",
  "lap.hu",
  "apartman.hu",
  "balaton.hu",
  "szepkartyat",
  "balatoniszallas",
  "camping.info",
  "szallas-kereso",
  "myszallas",
  // white-label per-property subdomains (<property>.lake-balaton.com)
  "lake-balaton.com",
  // WHITE-LABEL SUBDOMAIN FARMS (2026-08-20 dry-run): the property name sits in
  // the SUBDOMAIN (3-barat-apartman.hungaryhotel.net, bella-ciao.hungaryhotel.net,
  // hunguesthelios.com-hotel.website), so brand-in-domain corroboration passes
  // by construction. Only the registrable domain identifies these as portals.
  "hungaryhotel.net",
  "com-hotel.website",
];

/**
 * Does this URL live on a known portal? Matched on HOST LABELS, never as a naive
 * substring of the whole URL — "danubiushotels.com" contains "hotels.com" but is
 * the hotel chain's OWN site, and misfiling it as a portal turns a real customer
 * into a "no website" lead (a credibility bug, see §F).
 *
 * List entries are read three ways:
 *   "booking.com"   exact domain → host is it, or a subdomain of it
 *   "airbnb."       any TLD      → the label "airbnb" followed by a dot
 *   "zimmerinfo"    brand word   → appears inside a host LABEL (not the whole URL)
 */
/**
 * Listing PATHS: a directory entry on someone else's site (typically a town's
 * tourism portal, e.g. keszthely.hu/szallashelyek/gizella_haz) is not an own
 * website either — the business does not control that page.
 */
// SAFE DIRECTION: if this rule ever misfires on a business's OWN deep page, the
// lead lands in none/portal_only — exactly the set enrichPresence + enrichSiteSearch
// re-examine, and they reclassify it to has_own once the page corroborates the
// brand + region. A false "no site" therefore self-heals within the same run.
//
// Only DIRECTORY FOLDERS, and only when a concrete entry follows them
// (/szallashelyek/gizella_haz). A business's own site may well have a /szallas/
// page — that is its own content, not a listing under someone else's roof.
const LISTING_ENTRY_RE =
  /\/(szallashelyek|szallashely|accommodation|apartmanok|panziok|hotelek|vendeghazak|latnivalok)\/[^/]+/;

function isPortalHost(url: string): boolean {
  let host: string;
  let pathname: string;
  try {
    const u = new URL(url);
    host = u.hostname.toLowerCase().replace(/^www\./, "");
    pathname = u.pathname.toLowerCase();
  } catch {
    return false; // unparsable → let the caller treat it as an own site candidate
  }
  // A directory ENTRY under someone else's domain is a portal entry, not an own site.
  if (LISTING_ENTRY_RE.test(pathname)) return true;
  const labels = host.split(".");
  return PORTAL_DOMAINS.some((entry) => {
    const d = entry.toLowerCase();
    if (d.endsWith(".")) {
      const brand = d.slice(0, -1);
      return labels.includes(brand);
    }
    if (d.includes(".")) return host === d || host.endsWith(`.${d}`);
    return labels.some((l) => l.includes(d));
  });
}

export function classifyWebsite(website?: string): WebsiteStatus {
  if (!website) return "none";
  const url = website.toLowerCase();
  if (isPortalHost(url)) return "portal_only";
  return "has_own";
}

// MVP lead rule: focus on players with no own site (none | portal_only).
// "Outdated own site" qualification is a later slice (HTTP fetch + heuristics).
export function isMvpLead(status: WebsiteStatus): boolean {
  return status === "none" || status === "portal_only";
}
