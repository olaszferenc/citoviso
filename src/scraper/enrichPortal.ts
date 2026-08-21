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
// Targeting: the leads we would actually contact (isLead) with a distinctive
// name, poorest-material-first, under an explicit budget. Portals are somebody
// else's servers; there is no version of this that hammers them.

import { isBusinessEmail, isCorroboratedEmail } from "./enrichWebSearch.js";
import { portalLookup } from "./sources/portalListing.js";
import { webSearchAvailable } from "./sources/webSearch.js";
import type { PortalListing, PortalProfile, QualifiedLead, Region } from "./types.js";

/** Different HOSTS in parallel; the same host stays serialised in politeness.ts. */
const CONCURRENCY = 2;
/** Default per-run ceiling on how many leads get a portal lookup. */
const DEFAULT_MAX_LEADS = 60;

export interface PortalEnrichOptions {
  /** Max leads to look up in this run (cost + politeness budget). */
  readonly maxLeads?: number;
  /** Max accepted listings per lead. */
  readonly maxProfilesPerLead?: number;
  /** Log every dropped candidate with its reason (manual runs / debugging). */
  readonly verbose?: boolean;
}

/** How much material a lead currently has — the "who needs it most" ordering. */
function materialScore(l: QualifiedLead): number {
  return (l.material?.totalImages ?? l.photoCount ?? 0) + (l.portalProfiles?.length ?? 0) * 10;
}

/** Merge the newly read profiles into whatever the lead already carried, by URL. */
function mergeProfiles(
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
function mergeListings(
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
  const maxLeads = opts.maxLeads ?? DEFAULT_MAX_LEADS;

  // Candidates: the leads we would contact. A lead with an own site already has
  // a page of its own to work from, and is not the segment this pass serves.
  const candidates = leads
    .filter((l) => l.isLead)
    .filter((l) => (l.listings?.length ?? 0) > 0 || webSearchAvailable())
    .sort((a, b) => materialScore(a) - materialScore(b))
    .slice(0, maxLeads);

  if (!candidates.length) return leads;

  const found = new Map<QualifiedLead, PortalProfile[]>();
  let accepted = 0;
  let photos = 0;

  let next = 0;
  async function worker(): Promise<void> {
    while (next < candidates.length) {
      const lead = candidates[next++]!;
      const { profiles, attempts } = await portalLookup(lead, region, {
        maxProfiles: opts.maxProfilesPerLead ?? 2,
      });
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
      photos += profiles.reduce((s, p) => s + p.photos.length, 0);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, candidates.length) }, () => worker()),
  );

  console.log(
    `  → ${found.size}/${candidates.length} leadhez találtunk portál-adatlapot · ` +
      `${accepted} adatlap · ${photos} portál-fotó (jogállás: portal)`,
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

  return leads.map((l) => {
    const profiles = found.get(l);
    if (!profiles?.length) return l;
    const merged = mergeProfiles(l.portalProfiles, profiles);
    const email = contactFrom(profiles, (p) => p.email, emailUses);
    const phone = contactFrom(profiles, (p) => p.phone, phoneUses);
    return {
      ...l,
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

/** All photos from accepted profiles — every one of them provenance "portal". */
export function portalPhotosOf(lead: QualifiedLead): readonly { url: string; provenance: "portal" }[] {
  return (lead.portalProfiles ?? []).flatMap((p) => p.photos);
}
