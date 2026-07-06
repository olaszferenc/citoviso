import type { ContactChannel, QualifiedLead } from "./types.js";

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
    // Fill email from the own-site HTML if discovery didn't provide one.
    const email = l.email ?? l.assessment?.emails?.[0];
    return {
      ...l,
      email,
      contactChannel: resolveChannel(email, l.phone),
    };
  });
}
