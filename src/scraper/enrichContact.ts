import { mergeContacts } from "./contactLedger.js";
import { isBusinessEmail } from "./enrichWebSearch.js";
import type { ContactCandidate, ContactChannel, QualifiedLead } from "./types.js";

// Contact qualification. Our outreach is an automated, clickable-link model, so
// the channel matters more than mere presence: email > sms(mobile) > voice > none.
// This pass pulls an email off the own-site HTML (already fetched) when the lead
// has none, and classifies the best channel.

// Hungarian mobile operator prefixes (after country/trunk code): 20,30,31,50,70.
const MOBILE_PREFIXES = ["20", "30", "31", "50", "70"];

export function isMobile(phone: string): boolean {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("0036")) d = d.slice(4);
  else if (d.startsWith("36")) d = d.slice(2);
  else if (d.startsWith("06")) d = d.slice(2);
  else if (d.startsWith("6") && d.length >= 9) d = d.slice(1);
  return MOBILE_PREFIXES.includes(d.slice(0, 2));
}

export function resolveChannel(email?: string, phone?: string): ContactChannel {
  if (email) return "email";
  if (phone && isMobile(phone)) return "sms";
  if (phone) return "voice";
  return "none";
}

export function enrichContact(leads: QualifiedLead[]): QualifiedLead[] {
  return leads.map((l) => {
    // Fill email from the own-site HTML if discovery didn't provide one — but
    // apply the SAME quality bar as the web-search path. A site's boilerplate
    // can carry a theme placeholder (the 2026-08-20 run pulled info@domainem.hu
    // off a webnode template) or an office address; mailing those is a bounce
    // or spam to a stranger. Until now this path was unfiltered.
    const fromSite = l.assessment?.emails?.find((e) => isBusinessEmail(e));
    const email = l.email ?? fromSite;
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
      contactChannel: resolveChannel(email, l.phone),
      contacts: sightings.length ? mergeContacts(l.contacts, sightings) : l.contacts,
    };
  });
}
