import { fullerEmail } from "../email/leadEmails.js";
import { leadCountryConfig, type CountryConfig } from "../country.js";
import { isMobileRawIn, type PhoneRules } from "../text/phoneCountry.js";
import { mergeContacts } from "./contactLedger.js";
import { isBusinessEmail } from "./enrichWebSearch.js";
import type { ContactCandidate, ContactChannel, QualifiedLead, Region } from "./types.js";

// Contact qualification. Our outreach is an automated, clickable-link model, so
// the channel matters more than mere presence: email > sms(mobile) > voice > none.
// This pass pulls an email off the own-site HTML (already fetched) when the lead
// has none, and classifies the best channel.

/** Is this number (as written) a mobile of the lead's country? `rules` = its country row
 *  (ADR-0437: mobile ranges, dial code, trunk prefix); no row → not known to be one. The HU
 *  row answers exactly the former Hungarian test (20/30/31/50/70 after +36/0036/36/06/6). */
export function isMobile(phone: string, rules: PhoneRules | null): boolean {
  return isMobileRawIn(phone, rules);
}

export function resolveChannel(email: string | undefined, phone: string | undefined, rules: PhoneRules | null): ContactChannel {
  if (email) return "email";
  if (phone && isMobile(phone, rules)) return "sms";
  if (phone) return "voice";
  return "none";
}

/** `region` = the scrape area — the country fallback of a lead whose own country is unknown. */
export function enrichContact(leads: QualifiedLead[], region?: Pick<Region, "country"> | null): QualifiedLead[] {
  return leads.map((l) => {
    const cfg: CountryConfig | null = leadCountryConfig(l, region);
    // Fill email from the own-site HTML if discovery didn't provide one — but
    // apply the SAME quality bar as the web-search path. A site's boilerplate
    // can carry a theme placeholder (the 2026-08-20 run pulled info@domainem.hu
    // off a webnode template) or an office address; mailing those is a bounce
    // or spam to a stranger. Until now this path was unfiltered.
    const fromSite = l.assessment?.emails?.find((e) => isBusinessEmail(e));
    // A discovery address the own site shows in FULL is a truncated copy (a broken
    // OSM tag, 2026-10-08) — the site's form replaces it.
    const siteBusiness = (l.assessment?.emails ?? []).filter((e) => isBusinessEmail(e));
    const repaired = l.email ? fullerEmail(l.email, siteBusiness, l.website) : undefined;
    const email = repaired ?? fromSite;
    // Ledger: every address the own site carried, with the verdict. The ones we
    // skip here are exactly the interesting ones (template placeholders, office
    // addresses) — dropping them silently is what made the filters unauditable.
    const seen = (l.assessment?.emails ?? []).map((e) => ({
      kind: "email" as const,
      value: e,
      source: "own_site",
      sourceUrl: l.website,
      accepted: isBusinessEmail(e),
      rejectedReason: isBusinessEmail(e)
        ? undefined
        : "nem üzleti cím (iroda / sablon / gépi)",
    }));
    const sightings: Omit<ContactCandidate, "firstSeen">[] = [...seen];
    // The discovery address belongs in the ledger as well — a replaced stump most of
    // all, or the panel shows the full address while the lead mails another one.
    if (l.email) {
      const truncated = repaired !== l.email;
      sightings.push({
        kind: "email",
        value: l.email,
        source: l.sources.includes("osm") ? "osm" : (l.sources[0] ?? "korábbi adat"),
        accepted: !truncated,
        rejectedReason: truncated ? `csonka — teljes alakja: ${repaired}` : undefined,
      });
    }
    // The discovery phone (Places/OSM) belongs in the ledger too, otherwise the
    // panel would list web finds only and look like the number came from nowhere.
    if (l.phone) {
      sightings.push({
        kind: "phone",
        value: l.phone,
        source: l.sources.includes("google_places") ? "places" : "osm",
        accepted: true,
      });
    }
    return {
      ...l,
      email,
      contactChannel: resolveChannel(email, l.phone, cfg),
      contacts: sightings.length ? mergeContacts(l.contacts, sightings, undefined, cfg) : l.contacts,
    };
  });
}
