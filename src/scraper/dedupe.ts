import { classifyWebsite, isMvpLead } from "./qualify.js";
import type { Industry, QualifiedLead, RawLead } from "./types.js";

// Deduplicate raw leads across sources and qualify them. Two raw leads are the
// same player when their normalized names match AND they are within ~250 m (or
// coordinates are missing on either side). Merged fields prefer non-empty values,
// and an own-domain website wins over a portal/none.

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function distanceMeters(
  a: { lat?: number; lon?: number },
  b: { lat?: number; lon?: number },
): number {
  if (a.lat == null || a.lon == null || b.lat == null || b.lon == null) {
    return Infinity;
  }
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function firstDefined<T>(...vals: (T | undefined)[]): T | undefined {
  for (const v of vals) {
    if (v !== undefined && v !== "") return v;
  }
  return undefined;
}

function merge(
  leads: RawLead[],
  industry: Industry,
  region: string,
): QualifiedLead {
  // Prefer an own-domain website if any source has one (strongest signal).
  const websites = leads
    .map((l) => l.website)
    .filter((w): w is string => Boolean(w));
  const website =
    websites.find((w) => classifyWebsite(w) === "has_own") ?? websites[0];
  const status = classifyWebsite(website);
  const photoCount = Math.max(0, ...leads.map((l) => l.photoCount ?? 0));
  return {
    name: leads[0].name,
    industry,
    region,
    lat: firstDefined(...leads.map((l) => l.lat)),
    lon: firstDefined(...leads.map((l) => l.lon)),
    address: firstDefined(...leads.map((l) => l.address)),
    phone: firstDefined(...leads.map((l) => l.phone)),
    email: firstDefined(...leads.map((l) => l.email)),
    website,
    websiteStatus: status,
    sources: [...new Set(leads.map((l) => l.source))],
    photoCount,
    isLead: isMvpLead(status),
  };
}

export function dedupeAndQualify(
  raw: RawLead[],
  industry: Industry,
  region: string,
): QualifiedLead[] {
  const clusters: RawLead[][] = [];
  for (const lead of raw) {
    const norm = normalizeName(lead.name);
    let placed = false;
    for (const cluster of clusters) {
      const head = cluster[0];
      const d = distanceMeters(head, lead);
      if (normalizeName(head.name) === norm && (d <= 250 || d === Infinity)) {
        cluster.push(lead);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push([lead]);
  }
  return clusters.map((c) => merge(c, industry, region));
}
