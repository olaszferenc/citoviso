// PORTAL ADAPTER REGISTRY — which non-own hosts we can READ a listing out of,
// and how to treat each one.
//
// ADR-0037 alignment: the portal catalogue belongs in the DB with curator
// extension, and the code lists are its SEED. This file is written to be that
// seed and nothing more — entries are DATA (a plain array of descriptors), the
// behaviour they select is generic, and `resolvePortal()` is the single lookup
// both the reader and any future DB-backed loader go through. Adding a portal is
// a row, not a code path. The classification question ("is this host an own
// site?") is NOT re-answered here: that stays in qualify.ts/classifyWebsite,
// so the two consumers cannot drift (ADR-0037 point 3).
//
// What an entry adds on top of "this host is a portal":
//   · whether the listing body needs a browser (default: no — static HTML)
//   · a politeness gap override for slow/old hosts
//   · an `access` verdict for hosts that refuse automated reading outright
//   · a listing-URL shape, so a search hit can be told from a category page

/** How a portal responds to automated reading. */
export type PortalAccess =
  /** Serves the listing to an identified client — we read it. */
  | "open"
  /**
   * Answers with an anti-bot challenge (Cloudflare interstitial). That is an
   * explicit "no": we do not solve challenges, we skip the host and record why.
   * The legitimate route to this content is a partner/affiliate agreement — an
   * owner decision, not something the scraper may take unilaterally.
   */
  | "challenge_protected";

export interface PortalAdapter {
  /** Stable registry id — the value stored in PortalProfile.portal. */
  readonly id: string;
  /** Operator-facing label. */
  readonly label: string;
  /**
   * Registrable host(s) this adapter serves. Matched on host LABELS, never as a
   * substring of the URL (the danubiushotels.com ⊃ hotels.com trap, qualify.ts).
   * A leading "*." marks a white-label subdomain farm where the property name
   * sits in the subdomain (<property>.booked.hu).
   */
  readonly hosts: readonly string[];
  readonly access: PortalAccess;
  /** Listing bodies are JS-built → needs a headless render (costly; default false). */
  readonly render?: boolean;
  /** Minimum ms between two requests to this host (default 1500). */
  readonly gapMs?: number;
  /**
   * Path shape of a LISTING page. A search hit that fails it is a category or
   * search page ("Badacsonytomaji szállások"), which describes no single lead.
   * Omitted when the whole host is per-property (white-label subdomains).
   */
  readonly listingPath?: RegExp;
  /**
   * Rewrite a gallery image URL to the LARGEST derivative this portal serves, when
   * it exposes the size in the URL path. Portals publish the same photo at several
   * sizes (a thumbnail in the grid, a bigger one in the lightbox); the scraper often
   * reads the small one, which the 800px floor then drops. Swapping to the largest
   * derivative of the SAME image recovers the real gallery without touching any other
   * rule. Must be a pure, no-op-on-mismatch string transform. Omitted → no rewrite.
   */
  readonly largestPhotoUrl?: (url: string) => string;
  /** Why this entry exists / what it is known to yield — operator note. */
  readonly note: string;
}

/**
 * The seed. Ordered roughly by how much structure they publish; the generic
 * adapter (below) covers everything else, so this list does not have to be
 * complete to be useful.
 */
export const PORTAL_ADAPTERS: readonly PortalAdapter[] = [
  {
    id: "booked_hu",
    label: "booked.hu (szallas.hu foglalómotor)",
    hosts: ["*.booked.hu", "booked.hu"],
    access: "open",
    note:
      "A leggazdagabb forrás: teljes schema.org Hotel JSON-LD — leírás, 30+ fotó, " +
      "amenityFeature, containsPlace/HotelRoom, priceRange, checkin/checkout, geo. " +
      "Ugyanaz az adat, amit a szallas.hu mutat, de olvasható.",
  },
  {
    id: "lake_balaton_com",
    label: "lake-balaton.com (white-label)",
    hosts: ["*.lake-balaton.com", "lake-balaton.com"],
    access: "open",
    note: "Ugyanaz a foglalómotor-család, mint a booked.hu — schema.org Hotel JSON-LD.",
  },
  {
    id: "hungaryhotel_net",
    label: "hungaryhotel.net (white-label)",
    hosts: ["*.hungaryhotel.net", "hungaryhotel.net"],
    access: "open",
    note: "White-label aldomain-farm, szálláshelyenként külön aldomainnel; schema.org adat várható.",
  },
  {
    id: "hovamenjek",
    label: "hovamenjek.hu",
    hosts: ["hovamenjek.hu"],
    access: "open",
    listingPath: /^\/[a-z0-9-]+\/[a-z0-9-]+\/?$/i,
    // /upload/places/<placeId>/<SIZE>/<file> — the grid serves galleryMiddle (≤483px)
    // and gallery (80px), the largest derivative is `main` (~574px on the long edge).
    // Swap the size segment to `main`; a URL that does not fit the shape is returned
    // untouched. (No `original` exists here — probed 2026-08-23.)
    largestPhotoUrl: (url) =>
      url.replace(
        /(\/upload\/places\/[^/]+\/)[^/]+(\/[^/?#]+\.(?:jpe?g|png|webp))/i,
        "$1main$2",
      ),
    note:
      "LocalBusiness JSON-LD (cím, geo, telefon) + galéria. FIGYELEM: a robots.txt " +
      "tiltja a /upload/places/ útvonalat, DE külön Allow-t ad a *.jpg/*.png fájlokra — " +
      "a galéria olvasható, ezt a longest-match szabály adja ki.",
  },
  {
    id: "szallas24",
    label: "szallas24.hu",
    hosts: ["szallas24.hu"],
    access: "open",
    listingPath: /^\/[a-z0-9-]+\/[a-z0-9-]+\/?$|^\/szallas\//i,
    note:
      "Vékony Accommodation JSON-LD (csonkolt leírás, 1 kép) — a TELJES leírás a " +
      "DOM-ban van (.full-description), ezért a DOM-kiegészítés itt kötelező.",
  },
  {
    id: "zimmerinfo",
    label: "zimmerinfo.hu",
    hosts: ["zimmerinfo.hu"],
    access: "open",
    gapMs: 2_500,
    listingPath: /^\/[a-z0-9-]+\/[a-z0-9-]+\/(hu|de|en)\.html?$/i,
    note:
      "Régi, statikus oldalak strukturált adat NÉLKÜL — tiszta DOM-kinyerés " +
      "(leírás, galéria, szolgáltatás-lista, távolságok). Lassabb ütem illik hozzá.",
  },
  {
    id: "szallas_hu",
    label: "szallas.hu",
    hosts: ["szallas.hu", "www.szallas.hu"],
    access: "challenge_protected",
    note:
      "Cloudflare-kihívás fogadja a gépi klienst (HTTP 403 'Just a moment…') — ez " +
      "kifejezett elutasítás, NEM kerüljük meg. Ugyanaz a tartalom a booked.hu " +
      "white-label aldomainen nyíltan elérhető; a szallas.hu-hoz partner/affiliate " +
      "megállapodás a jogtiszta út (tulaj-döntés).",
  },
  {
    id: "kali_hu",
    label: "kali.hu (Káli-medence turisztikai portál)",
    hosts: ["kali.hu"],
    access: "open",
    listingPath: /^\/szallas\/[^/]+/i,
    note: "Város/kistérségi portál — sok leadnek ez az EGYETLEN online adatlapja.",
  },
  {
    id: "badacsony_hu",
    label: "badacsony.hu (települési portál)",
    hosts: ["badacsony.hu", "badacsony.com"],
    access: "open",
    note: "Települési turisztikai portál, strukturált adat nélkül — DOM-kinyerés.",
  },
];

/** The fallback adapter for any other host that qualify.ts calls a portal. */
export const GENERIC_PORTAL: PortalAdapter = {
  id: "generic_portal",
  label: "általános portál-adatlap",
  hosts: [],
  access: "open",
  note:
    "Nincs dedikált bejegyzés: schema.org / OpenGraph / DOM sorrendben próbálunk " +
    "kinyerni. Ha rendszeresen ad jó adatot, vegye fel a kurátor a registrybe (ADR-0037).",
};

/** Registrable host of a URL, lowercased and www-stripped. */
export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function hostMatches(host: string, pattern: string): boolean {
  const p = pattern.toLowerCase();
  if (p.startsWith("*.")) {
    const base = p.slice(2);
    return host === base || host.endsWith(`.${base}`);
  }
  return host === p || host.endsWith(`.${p}`);
}

/**
 * Which adapter serves this URL? Never null: an unknown portal host gets the
 * generic adapter, so a new portal yields data on the day it appears instead of
 * waiting for a code change (the whack-a-mole ADR-0037 calls out).
 */
export function resolvePortal(url: string): PortalAdapter {
  const host = hostOf(url);
  if (!host) return GENERIC_PORTAL;
  for (const a of PORTAL_ADAPTERS) {
    if (a.hosts.some((h) => hostMatches(host, h))) return a;
  }
  return GENERIC_PORTAL;
}

/**
 * Is this URL shaped like a LISTING (one business) rather than a category or
 * search page? Only enforced for adapters that declared a shape — for everything
 * else the entity-match gate downstream does the filtering.
 */
export function looksLikeListingUrl(url: string): boolean {
  const adapter = resolvePortal(url);
  if (!adapter.listingPath) return true;
  try {
    return adapter.listingPath.test(new URL(url).pathname);
  } catch {
    return false;
  }
}
