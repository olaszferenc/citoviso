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
];

export function classifyWebsite(website?: string): WebsiteStatus {
  if (!website) return "none";
  const url = website.toLowerCase();
  if (PORTAL_DOMAINS.some((d) => url.includes(d))) return "portal_only";
  return "has_own";
}

// MVP lead rule: focus on players with no own site (none | portal_only).
// "Outdated own site" qualification is a later slice (HTTP fetch + heuristics).
export function isMvpLead(status: WebsiteStatus): boolean {
  return status === "none" || status === "portal_only";
}
