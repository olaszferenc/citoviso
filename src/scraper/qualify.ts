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
  // BOOKING AGGREGATORS / META-SEARCH (measured on prod, 2026-10-02, A1): Google
  // Places hands these out as the "website" of a lodging that has none, and every
  // one of them was stored as a MODERN own site — ~600 leads (bluepillow alone
  // 361) hidden from the funnel as "not a target", although they are the best
  // targets we have. Search/redirect links (bluepillow/freecancellations/vio) and
  // per-property listing pages alike: none of them is a page the business controls.
  "bluepillow.com",
  "freecancellations.com",
  "vio.com",
  "vrbo.com",
  "holidu.",
  "hometogo.",
  "e-domizil.",
  "fewo-direkt.de",
  "fewobird.de",
  "ferienhausmiete.de",
  "traum-ferienwohnungen.de",
  "kleinanzeigen.de",
  "balaton24.de",
  "hotel-mix.de",
  "rentalsunited.com",
  "bookhungaryhotels.com",
  "hotelmania.net",
  "hotelsmart.hu",
  "checkinstay.eu",
  "availabilitycheck.eu",
  "travellone.eu",
  "ibooked.at",
  "happycamp.com",
  "dogfriendlyretreats.com",
  "incitytravel.eu",
  // Per-property SUBDOMAIN FARMS (the hungaryhotel.net pattern above): the
  // property name in the subdomain makes the URL look like an own site —
  // muschel-panzio.hotels-in-hungary.net was Elek's H-3 finding. The .com.es /
  // .org.es hosts are a generated farm of the same kind (garbled slugs such as
  // z-nka-v-zparti-d-l-h-zak.org.es); these second-level zones are matched as a
  // whole, which is safe for a Hungarian lead stock. hotel.hu / hotelizator.com
  // are NOT listed — measured under rules A+B, see the RULE B block below.
  "hotels-in-hungary.net",
  "bedsandhotels.com",
  "worhot.com",
  "hu-hotels.com",
  "okhotel.top",
  "com-resort.com",
  "com.es",
  "org.es",
  // Hungarian listing portals and town/regional directories with a per-property
  // path (nyaralo24.hu/balatonbereny/, keszthely.hu/szallas/apartman/<name>/).
  "szallasinfo.hu",
  "nyaralo24.hu",
  "kiadonyaralok.hu",
  "360szallasok.hu",
  "balatonszallasok.hu",
  "balatonlelleiszallasok.hu",
  "balcsi-apartman.hu",
  "appartman.hu",
  "balaton.info",
  "keszthely.hu",
  "orvenyes.hu",
  "kerteszetturul.eu",
  // RULE B, measured 2026-10-02 (front page lists several lodgings / runs them as
  // an intermediary): balatonhost.com — a property manager, "Kiadó szállások",
  // 25 lodgings; siofokszallas.info — 7 lodgings under one roof (also rule A).
  // Measured and kept OWN: hotelizator.com (builds and runs the hotel's OWN site),
  // marcaliszallas.hu (one property's own site), humtour.com (the farm's own
  // booking site on a subdomain), hotel.hu (unreachable; only Kolping, by name).
  "balatonhost.com",
  "siofokszallas.info",
  // RULE A without a usable rule B (front page unreachable from dev AND prod):
  // 13 DIFFERENT lodgings with no common owner or brand, each on a garbled path
  // slug (visty.site/kagylkkk, /balatonapar3) — no chain explains that sharing.
  "visty.site",
  // RULE B, round 2 (2026-10-02, the remaining rule-A candidates): a MUNICIPAL or
  // tourism-body page that lists other people's lodgings is a portal —
  // balatonakali.hu (Turizmus › Szálláshelyek), marcali.hu (turizmus › szálláshelyek),
  // vonyarcvashegy.hu (inquiry form "a választott szállásnak küldjük"), zenefalu.hu
  // (the tourism association's szallasok.html; unreachable, measured by its path).
  // PATH-SCOPED where the town's own institutions live on the same host: the
  // mayor's office (marcali.hu/…/hivatal-m) and the municipal beach
  // (balatonakali.hu/Turizmus/Strand) ARE the town's own pages — only the lodging
  // list is someone else's roof. vonyarcvashegy.hu carries only lodgings here.
  "balatonakali.hu/turizmus/szallashelyek",
  "marcali.hu/index.php/elet-a-varosban/turizmus-m",
  "zenefalu.hu/facebook_pages/szallasok",
  "vonyarcvashegy.hu",
  // Company registries: a firm-data page is not a website either.
  "ceginformacio.hu",
  "197.eu",
];

/**
 * Does this URL live on a known portal? Matched on HOST LABELS, never as a naive
 * substring of the whole URL — "danubiushotels.com" contains "hotels.com" but is
 * the hotel chain's OWN site, and misfiling it as a portal turns a real customer
 * into a "no website" lead (a credibility bug, see §F).
 *
 * List entries are read four ways:
 *   "booking.com"   exact domain → host is it, or a subdomain of it
 *   "airbnb."       any TLD      → the label "airbnb" followed by a dot
 *   "zimmerinfo"    brand word   → appears inside a host LABEL (not the whole URL)
 *   "marcali.hu/…"  host + path  → only that listing branch of the host
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
    // "host/path" → a listing BRANCH of a site whose other pages are someone's own.
    const slash = d.indexOf("/");
    if (slash > 0) {
      const h = d.slice(0, slash);
      return (host === h || host.endsWith(`.${h}`)) && pathname.startsWith(d.slice(slash));
    }
    if (d.endsWith(".")) {
      const brand = d.slice(0, -1);
      return labels.includes(brand);
    }
    if (d.includes(".")) return host === d || host.endsWith(`.${d}`);
    return labels.some((l) => l.includes(d));
  });
}

// FILE LINKS (A1, 2026-10-02): a shared document is not a website at all — the
// lead has no site of its own ("none", not a portal). sites.google.com is a real
// site builder and stays out of this list.
const FILE_LINK_HOSTS = ["drive.google.com", "docs.google.com", "dropbox.com", "onedrive.live.com"];

// URL SHORTENERS / redirectors: the host says nothing about whose page it is — the
// redirect TARGET does. classifyWebsite cannot fetch (it is pure), so callers that
// can follow redirects do so first (resolveShortLink in requalify-websites.mts);
// unresolved, a short link stays a has_own candidate (the safe direction, see above).
const SHORTENER_HOSTS = ["tinyurl.com", "bit.ly", "goo.gl", "t.ly", "rb.gy", "is.gd", "cutt.ly", "redirect.viglink.com"];

function hostMatches(host: string, list: readonly string[]): boolean {
  return list.some((d) => host === d || host.endsWith(`.${d}`));
}

function hostOfUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Is this a link shortener / redirector whose target decides the verdict? */
export function isShortLink(website: string): boolean {
  const host = hostOfUrl(website);
  return host !== null && hostMatches(host, SHORTENER_HOSTS);
}

/**
 * RULE A — SHARED HOST, a CANDIDATE detector (A1, measured on prod 2026-10-02; owner
 * rule via the coordinator: "a host is a portal if several DIFFERENT leads point at
 * it, or its front page lists several lodgings / is a booking intermediary").
 *
 * Measured, rule A cannot DECIDE on its own: over the 2 360 prod leads it flagged ~70
 * hosts, and about 25 of them are one owner's or one chain's OWN site with several
 * units (danubiushotels.com, hunguesthotels.hu, balatontourist.hu, honvedudulo.hu,
 * lschotel.hu = "Luxury Spa Conference", tihanyiapatsag.hu, two "Princess" records on
 * szallassiofokon.hu …). Auto-flipping them would tell a chain hotel "we found no
 * site of yours" — the credibility bug in the other direction. So rule A only names
 * the CANDIDATES (requalify-websites.mts lists them); rule B — the front page,
 * measured — decides, and its verdict is recorded in PORTAL_DOMAINS with evidence.
 *
 * Name test: a lead's link is FOREIGN when no distinctive word of its name appears
 * in the host (abbazia-clubhotel.hu carries 7 buildings, all named "Abbázia" → not
 * foreign); a host is a candidate when ≥2 different businesses reach it that way.
 */
const GENERIC_NAME_WORDS = new Set([
  "hotel", "hotels", "szallo", "szalloda", "apartman", "apartmanok", "apartmanhaz", "apartment",
  "apartments", "panzio", "pension", "vendeghaz", "vendeghazak", "guest", "house", "guesthouse",
  "haz", "hazak", "villa", "nyaralo", "nyaralohaz", "szallas", "szallasok", "resort", "camping",
  "kemping", "spa", "wellness", "etterem", "restaurant", "and", "es", "the", "family", "club",
  "boutique", "lake", "balaton", "room", "rooms", "studio", "holiday", "home", "bed", "breakfast",
]);

function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !GENERIC_NAME_WORDS.has(t));
}

/** Does a distinctive word of the business name appear in the host? */
export function nameInHost(name: string, website: string): boolean {
  const host = hostOfUrl(website);
  if (!host) return false;
  const labels = host.split(".");
  const flat = labels.join("").replace(/-/g, "");
  return nameTokens(name).some((t) =>
    t.length >= 3 ? flat.includes(t) : labels.some((l) => l.startsWith(t)),
  );
}

/**
 * MEASURED OWN under rule B (2026-10-02): rule-A candidates whose front page is the
 * business's OWN — a single lodging, or one operator's / chain's / institution's own
 * units (Hunguest, Danubius, Balatontourist, the Honvéd resort, an abbey, a national
 * park, a forestry, "Családias panzióink" …). Rule B's measured line: a page that lists
 * OTHER PEOPLE's lodgings (a town, a tourism body, an agency "Szállást ad ki? Legyen a
 * partnerünk!") is a portal; a page listing the owner's own units is not. Recorded so
 * the candidate detector stops re-raising a settled host; NOT a classification input
 * (classifyWebsite already says has_own for them — the guard checks that stays so).
 */
export const MEASURED_OWN_HOSTS: readonly string[] = [
  "bakonyerdo.hu", "balatonbereny.hu", "balatonfoldvariszallas.hu", "balatonhotelsiofok.hu",
  "balatontourist.hu", "bfnp.hu", "danubiushotels.com", "danubiushotels.hu", "famkovacs1.hu",
  "furedikiadohazak.hu", "h-r-camping-balaton.de", "honvedudulo.hu", "hunguesthotels.hu",
  "kksz.hu", "kristalyfurdo.hu", "lambert.hu", "linktr.ee", "lschotel.hu", "mgapartmanok.hu",
  "olcsoszallasbalatonzamardi.com", "panzioheviz.hu", "siofokpanzio.hu", "sites.google.com",
  "szallassiofokon.hu", "tengerdi.hu", "tihanyiapatsag.hu", "tutelakft.hu", "vadoctanya.hu",
  "wellnesskastely.hu",
  // Unreachable from dev AND prod — no rule-B evidence, so the safe verdict (has_own):
  // a false "no site" insults a real customer, a missed portal only delays a target.
  "balatonlelleapartment.com",
  // Round 1 (see the RULE B block in PORTAL_DOMAINS).
  "hotelizator.com", "marcaliszallas.hu", "humtour.com", "hotel.hu",
];

/**
 * Rule-A CANDIDATES of a lead stock: hosts that ≥2 different businesses reach through a
 * foreign link and that the catalogue does not already call a portal. To be verified by
 * rule B (front page), never auto-applied — see the measurement above.
 */
export function sharedHostCandidates(
  stock: readonly { readonly name: string; readonly website?: string | null }[],
  minBusinesses = 2,
): Set<string> {
  const byHost = new Map<string, Set<string>>();
  for (const l of stock) {
    if (!l.website || nameInHost(l.name, l.website)) continue;
    const host = hostOfUrl(l.website);
    if (!host) continue;
    // A name made only of generic words ("Family" / "Hotel Family") carries no
    // identity, so such records cannot prove two DIFFERENT businesses — one key.
    const business = nameTokens(l.name).join(" ") || "(generic name)";
    if (!byHost.has(host)) byHost.set(host, new Set());
    byHost.get(host)!.add(business);
  }
  return new Set(
    [...byHost]
      .filter(
        ([h, b]) =>
          b.size >= minBusinesses &&
          !isPortalHost(`https://${h}/`) &&
          // a host with a measured listing BRANCH is settled too (its other pages are own)
          !PORTAL_DOMAINS.some((d) => d.includes("/") && hostMatches(h, [d.slice(0, d.indexOf("/"))])) &&
          !hostMatches(h, MEASURED_OWN_HOSTS) &&
          !hostMatches(h, SHORTENER_HOSTS) &&
          !hostMatches(h, FILE_LINK_HOSTS),
      )
      .map(([h]) => h),
  );
}

export function classifyWebsite(website?: string): WebsiteStatus {
  if (!website) return "none";
  const url = website.toLowerCase();
  const host = hostOfUrl(url);
  if (host && hostMatches(host, FILE_LINK_HOSTS)) return "none";
  if (isPortalHost(url)) return "portal_only";
  return "has_own";
}

// MVP lead rule: focus on players with no own site (none | portal_only).
// "Outdated own site" qualification is a later slice (HTTP fetch + heuristics).
export function isMvpLead(status: WebsiteStatus): boolean {
  return status === "none" || status === "portal_only";
}
