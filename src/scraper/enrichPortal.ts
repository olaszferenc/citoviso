// PORTAL ENRICHMENT PASS — attach structured portal content to the leads that
// need it most.
//
// Why this pass exists: everything downstream (the mock engine, the fact-check
// gate, the outreach copy) is limited by what the scraper knows, and until now
// that was a name, a pin, a phone number and a Places photo COUNT. No rooms, no
// capacity, no prices, no amenities, no real description — so the generated page
// could only ever be a shell with a photo strip. The material is public and the
// business itself published it, on the very portals whose commission we are
// selling against.
//
// Targeting (owner ruling 2026-10-01, "portál előbb, mindenkinek"): EVERY lead we
// would contact (isLead) gets its already-known listings read — those reads are
// free, and they are what keeps the mock off paid Places photos. Only the
// DISCOVERY of new listings costs money (one web search per lead), so that part
// alone stays under a per-run budget, poorest-material-first. Portals are
// somebody else's servers; politeness.ts keeps every host strictly serial with a
// gap, so more leads means a longer run, never a faster hammer.

import { isBusinessEmail, isCorroboratedEmail } from "./enrichWebSearch.js";
import { findPortalCandidates, portalLookup } from "./sources/portalListing.js";
import { distinctPortalPhotos } from "./portalPhotos.js";
import { webSearchAvailable } from "./sources/webSearch.js";
import type { PortalListing, PortalProfile, QualifiedLead, Region } from "./types.js";

/**
 * Different HOSTS in parallel; the same host stays serialised in politeness.ts.
 * Measured 2026-10-01 on the 1 057 prod leads with a known listing: 2 → ~100 min,
 * 4 → ~78 min, beyond that nothing (the floor is one host read serially).
 */
const CONCURRENCY = 4;
/** Per-run budget of leads that may run a PAID web search for new listings. */
const DEFAULT_MAX_SEARCH_LEADS = 60;
/** Progress line cadence for the (now hour-long) full pass. */
const PROGRESS_EVERY = 100;

export interface PortalEnrichOptions {
  /** Optional hard cap on looked-up leads in this run (default: no cap). */
  readonly maxLeads?: number;
  /** Leads that may run a paid web search for NEW listings (default 60; 0 = never). */
  readonly maxSearchLeads?: number;
  /** Max accepted listings per lead. */
  readonly maxProfilesPerLead?: number;
  /** Log every dropped candidate with its reason (manual runs / debugging). */
  readonly verbose?: boolean;
  /**
   * FRISSÍTÉS, NEM FELFEDEZÉS (ADR-0136, fotó-rothadás sweep): csak a leadhez MÁR
   * hozzákötött adatlap-URL-eket olvassuk újra. A tárolt fotó-URL elrohad (a portál
   * átírja a fájlneveket), de maga az ADATLAP ugyanott él — ilyenkor keresni fölösleges
   * és FIZETŐS (Brave/CSE kvóta), miközben pontosan tudjuk, mit kell újraolvasni.
   * Profil nélküli leadnél ez semmit nem tesz: nincs mit frissíteni.
   */
  readonly knownUrlsOnly?: boolean;
}

/** How much material a lead currently has — the "who needs it most" ordering. */
function materialScore(l: QualifiedLead): number {
  return (l.material?.totalImages ?? l.photoCount ?? 0) + (l.portalProfiles?.length ?? 0) * 10;
}

/** Merge the newly read profiles into whatever the lead already carried, by URL. */
export function mergeProfiles(
  existing: readonly PortalProfile[] | undefined,
  found: readonly PortalProfile[],
): PortalProfile[] {
  const byUrl = new Map<string, PortalProfile>();
  for (const p of existing ?? []) byUrl.set(p.url, p);
  for (const p of found) byUrl.set(p.url, p); // a fresh read wins over a stale one
  return [...byUrl.values()];
}

/**
 * A read listing is also a digital-footprint entry — the console's "hol találtuk
 * meg" panel should show it as verified, since we did not merely see it in a
 * search snippet, we read the page and matched the entity.
 */
export function mergeListings(
  existing: readonly PortalListing[] | undefined,
  profiles: readonly PortalProfile[],
): PortalListing[] {
  const byUrl = new Map<string, PortalListing>();
  for (const l of existing ?? []) byUrl.set(l.url, l);
  for (const p of profiles) {
    byUrl.set(p.url, {
      url: p.url,
      title: (p.title ?? byUrl.get(p.url)?.title ?? p.portalHost).slice(0, 120),
      verified: true,
    });
  }
  return [...byUrl.values()];
}

export async function enrichPortal(
  leads: QualifiedLead[],
  region: Region,
  opts: PortalEnrichOptions = {},
): Promise<QualifiedLead[]> {
  const ordered = leads
    .filter((l) => l.isLead)
    .sort((a, b) => materialScore(a) - materialScore(b))
    .slice(0, opts.maxLeads ?? Number.POSITIVE_INFINITY);

  // What each lead can be read from WITHOUT paying: the listings already tied to
  // it. Refresh mode reads exactly the profiles it holds; otherwise the stored
  // listings (and a portal_only lead's own listing URL), no search.
  const plan: { lead: QualifiedLead; urls: string[]; search: boolean }[] = [];
  let searchLeft = opts.knownUrlsOnly || !webSearchAvailable()
    ? 0
    : (opts.maxSearchLeads ?? DEFAULT_MAX_SEARCH_LEADS);
  for (const lead of ordered) {
    const urls = opts.knownUrlsOnly
      ? [...new Set((lead.portalProfiles ?? []).map((p) => p.url))]
      : await findPortalCandidates(lead, region, 6, false);
    // A paid search only where it can still add a candidate (portalLookup reads
    // at most 6), poorest-material-first until the budget is spent.
    const search = searchLeft > 0 && urls.length < 6;
    if (search) searchLeft--;
    if (!urls.length && !search) continue; // nothing to read, and no budget to look
    plan.push({ lead, urls, search });
  }
  const candidates = plan.map((p) => p.lead);
  if (!plan.length) return leads;

  const found = new Map<QualifiedLead, PortalProfile[]>();
  let accepted = 0;
  let photos = 0;
  let done = 0;
  const lookedUpAt = new Date().toISOString();

  let next = 0;
  async function worker(): Promise<void> {
    while (next < plan.length) {
      const { lead, urls, search } = plan[next++]!;
      // ADR-0106 ④: default follows portalLookup's own ceiling (the full
      // host-deduped candidate list) instead of stopping at 2 accepted reads.
      const { profiles, attempts } = await portalLookup(lead, region, {
        ...(opts.maxProfilesPerLead ? { maxProfiles: opts.maxProfilesPerLead } : {}),
        ...(search ? { search: true } : { urls }),
      });
      if (++done % PROGRESS_EVERY === 0) {
        console.log(`  … portál-olvasás: ${done}/${plan.length} lead, eddig ${found.size} találat`);
      }
      if (opts.verbose) {
        for (const a of attempts) {
          if (a.profile) {
            console.log(
              `  ✔ ${lead.name} ← ${a.url} (${a.profile.matchBand} ${a.profile.matchConfidence.toFixed(2)}) · ` +
                `${a.profile.photos.length} fotó · ${a.profile.rooms.length} egység · ${a.profile.amenities.length} szolgáltatás`,
            );
          } else {
            console.log(`  – ${lead.name} ✗ ${a.url}: ${a.skipped}`);
          }
        }
      }
      if (!profiles.length) continue;
      found.set(lead, profiles);
      accepted += profiles.length;
      photos += distinctPortalPhotos(profiles).length;
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, plan.length) }, () => worker()),
  );

  console.log(
    `  → ${found.size}/${candidates.length} leadhez találtunk portál-adatlapot · ` +
      `${accepted} adatlap · ${photos} portál-fotó (jogállás: portal) · ` +
      `${plan.filter((p) => p.search).length} fizetős webes keresés`,
  );

  // SHARED-CONTACT GUARD (the tourinform lesson, enrichWebSearch): one phone
  // number belongs to one business. A number that turns up on several leads'
  // listings is the PORTAL's own — a booking hotline or a call centre — and
  // cold-calling it is spam to the wrong door. We cannot tell which lead it
  // might legitimately belong to, so none of them gets it.
  const phoneUses = new Map<string, number>();
  const emailUses = new Map<string, number>();
  for (const profiles of found.values()) {
    for (const p of profiles) {
      if (p.phone) phoneUses.set(p.phone, (phoneUses.get(p.phone) ?? 0) + 1);
      if (p.email) emailUses.set(p.email, (emailUses.get(p.email) ?? 0) + 1);
    }
  }
  /** A contact is usable only from an un-flagged profile, and only if unshared. */
  const contactFrom = (
    profiles: readonly PortalProfile[],
    pick: (p: PortalProfile) => string | undefined,
    uses: Map<string, number>,
  ): string | undefined => {
    for (const p of profiles) {
      if (p.needsReview) continue;
      const value = pick(p);
      if (!value || (uses.get(value) ?? 0) > 1) continue;
      return value;
    }
    return undefined;
  };

  /**
   * A booking engine puts ITS OWN support desk in the listing's schema.org
   * `telephone` (live: +441135199515 / support@booked.net on a Badacsonytomaj
   * apartment). The shared-contact count catches it across a batch, but a small
   * run has nothing to compare against — so a number from a different country
   * than the lead is rejected outright. Only the countries we actually scrape
   * are listed; an unknown country skips the check rather than guessing.
   */
  const COUNTRY_DIAL: Record<string, string> = {
    HU: "36", HR: "385", AT: "43", SK: "421", SI: "386", RO: "40", RS: "381", DE: "49",
  };
  const plausibleLocalPhone = (phone: string | undefined, country: string | undefined): boolean => {
    if (!phone) return false;
    const expected = country ? COUNTRY_DIAL[country.toUpperCase()] : undefined;
    if (!expected) return true; // unknown country — no basis to reject
    const digits = phone.replace(/\D/g, "");
    // A national-format number (06 30 …, 030 …) carries no country code at all.
    if (!/^(\+|00)/.test(phone.trim()) && !digits.startsWith(expected)) return true;
    return digits.startsWith(expected) || digits.startsWith(`00${expected}`);
  };

  const lookedUp = new Set(candidates);
  return leads.map((l) => {
    const profiles = found.get(l);
    if (!profiles?.length) return lookedUp.has(l) ? { ...l, portalLookupAt: lookedUpAt } : l;
    const merged = mergeProfiles(l.portalProfiles, profiles);
    const email = contactFrom(profiles, (p) => p.email, emailUses);
    const phone = contactFrom(profiles, (p) => p.phone, phoneUses);
    return {
      ...l,
      portalLookupAt: lookedUpAt,
      portalProfiles: merged,
      listings: mergeListings(l.listings, profiles),
      // A portal listing is a legitimate contact source (the business put its
      // own details there) — but only from a listing that passed the gate, and
      // only to FILL a gap, never to overwrite what we already trust.
      phone: l.phone ?? (plausibleLocalPhone(phone, l.country) ? phone : undefined),
      // The same two bars every other contact path applies: a business address
      // (not an office/template/machine one) that is tied to THIS business.
      email:
        l.email ??
        (email && isBusinessEmail(email) && isCorroboratedEmail(email, l) ? email : undefined),
    };
  });
}

/** All DISTINCT photos from accepted profiles — every one of them provenance "portal".
 *  Distinct across hosts: a portal network repeats the same file (scraper/portalPhotos.ts). */
export function portalPhotosOf(lead: QualifiedLead): readonly { url: string; provenance: "portal" | "website" }[] {
  return distinctPortalPhotos(lead.portalProfiles ?? []);
}
