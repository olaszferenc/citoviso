import { classifyWebsite } from "./qualify.js";
import type { QualifiedLead, Region } from "./types.js";

// Presence layer (§F invariants): the "no own site" verdict must be PROVEN, not
// assumed from a missing Maps websiteUri. For every none/portal_only lead we
// guess candidate domains from the business name and probe them over HTTP. A hit
// only counts as the lead's own site when the page corroborates BOTH the brand
// core AND the region — a brand-only match is a name collision with an unrelated
// business elsewhere (Rózsakő ház/Badacsony ↔ Rózsakő Étterem/Kisvárda) and is
// rejected. Zero external API cost. Runs BEFORE enrichOutdated so a newly-found
// own site is assessed for outdatedness in the same run.

const TLDS = ["hu", "com"];
const TIMEOUT_MS = 5000;
const MAX_BYTES = 120_000;
const CONCURRENCY = 10;

// Accommodation "type" words — stripped to derive a brand core, but candidates
// are generated BOTH with and without them (a brand may include one, e.g. Villa).
export const TYPE_WORDS = new Set([
  "vendeghaz", "haz", "panzio", "szallashely", "szallas", "guest", "guesthouse",
  "guesthaus", "house", "apartman", "apartment", "camping", "hostel", "fogado",
  "cottage", "birtok", "pinceszet", "szolobirtok", "villa", "hotel",
]);

// Parked / for-sale / placeholder markers → NOT a real own site (§F.15).
const PARKED = [
  "domain for sale", "this domain is for sale", "buy this domain",
  "under construction", "website coming soon", "domain parking",
  "ez a honlap elado", "a honlap elado", "ez a domain elado",
  "az oldal elado", "parkolo oldal", "foglalt domain",
];

export function deaccent(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function tokens(s: string): string[] {
  return deaccent(s.toLowerCase())
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// Region terms a page must contain to confirm geo-match: the region id/label
// tokens (>=4 chars). "badacsony" matches "Badacsonytomaj", "Badacsonyörs" too.
export function regionTerms(region: Region): string[] {
  const set = new Set<string>();
  for (const t of [...tokens(region.id), ...tokens(region.label)]) {
    if (t.length >= 4) set.add(t);
  }
  return [...set];
}

// Filler words inside a region LABEL that name no place ("Keszthely és környéke"
// → "kornyeke"). Left in, they would demand a word no business site ever writes.
const REGION_FILLER = new Set([
  "kornyek", "kornyeke", "korul", "korzet", "terseg", "tersege", "videk",
  "videke", "mellett", "menten", "regio", "regioja", "es",
]);

/**
 * The lead's own place words. ONLY the `city` facet (ADR-0040) — deliberately
 * NOT the free-text address. Measured on the Badacsony stock: the address
 * tokenizes to "hungary" (40/56 leads), "utca" (15), "romai" (13) — and a term
 * every Hungarian page carries would switch the geo-check OFF rather than
 * tighten it. City coverage is 63/63, so there is nothing to gain by guessing.
 */
export function cityTerms(lead: { city?: string }): string[] {
  return tokens(lead.city ?? "").filter(
    (t) => t.length >= 4 && !/^\d+$/.test(t),
  );
}

/**
 * GEO-ANCHOR for verification. Two failures, one root cause — a radius region
 * spans many towns, so the REGION label is the wrong anchor for a single lead:
 *
 *  · false NEGATIVE (Tekergő, 2026-08-20): the lead sits in Balatonberény inside
 *    the region "Keszthely és környéke"; its real site never writes "Keszthely",
 *    so the correct site was rejected → a false "no own site", the §F
 *    credibility bug (we would mail "you have no website" to someone who has one).
 *  · false POSITIVE (the reverted backfill, same day): 4 of 6 discovered sites
 *    were Keszthely businesses bound to leads in Révfülöp / Badacsonytomaj /
 *    Balatonboglár — the page said "Keszthely", the region said "Keszthely",
 *    verify() went green on a different company.
 *
 * So the lead's own city REPLACES the region terms; it must never be unioned
 * with them, or the false positives above would still pass on the region word.
 * The region stays as the fallback only for a lead whose town we do not know.
 */
export function geoTerms(lead: { city?: string }, region: Region): string[] {
  const own = cityTerms(lead);
  if (own.length) return own;
  return regionTerms(region).filter((t) => !REGION_FILLER.has(t));
}

/**
 * The place word to put in a SEARCH QUERY. The lead's town beats the region
 * label: "Tekergő Balatonberény" returns the official site as hit #1, while
 * "Tekergő keszthely és környéke" returns only booking portals.
 */
export function searchPlace(lead: { city?: string }, region: Region): string {
  return lead.city ?? region.label;
}

function candidateHosts(name: string): string[] {
  const t = tokens(name);
  const core = t.filter((w) => !TYPE_WORDS.has(w));
  const sets = new Set<string>();
  const add = (arr: string[]): void => {
    if (!arr.length) return;
    sets.add(arr.join(""));
    sets.add(arr.join("-"));
  };
  add(t); // full name, natural order (Sissi Panzió → sissipanzio)
  add([...t].reverse()); // reversed — HU names flip freely (Panzió Sissi → panziosissi)
  add(core); // brand only
  // brand/name + region hosts are added by urlCandidates (needs the region).
  return [...sets].filter((h) => h.replace(/-/g, "").length >= 5);
}

function urlCandidates(name: string, region: Region): string[] {
  const hosts = new Set(candidateHosts(name));
  // Also try brand+region and name+region hosts (common for local businesses).
  const t = tokens(name);
  const core = t.filter((w) => !TYPE_WORDS.has(w));
  for (const term of regionTerms(region)) {
    for (const base of [core, t, [...t].reverse()]) {
      if (!base.length) continue;
      hosts.add([...base, term].join(""));
      hosts.add([...base, term].join("-"));
    }
  }
  const urls: string[] = [];
  for (const host of hosts) {
    if (host.replace(/-/g, "").length < 5) continue;
    for (const tld of TLDS) {
      urls.push(`https://${host}.${tld}`);
      urls.push(`https://www.${host}.${tld}`);
    }
  }
  return urls;
}

export async function fetchHtml(
  url: string,
): Promise<{ finalUrl: string; html: string } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": "citoviso-scraper/0.1" },
    });
    if (!res.ok || !res.body) return null;
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
    }
    await reader.cancel().catch(() => {});
    return { finalUrl: res.url, html: Buffer.concat(chunks).toString("utf8") };
  } catch {
    return null; // DNS/TLS/timeout → treat as not existing at this candidate
  } finally {
    clearTimeout(timer);
  }
}

// Geo-strict verification: brand core AND a place we know the lead sits in must
// both appear; parked pages are rejected. `terms` comes from geoTerms(lead, region).
export function verify(name: string, terms: string[], html: string): boolean {
  const text = deaccent(html.toLowerCase());
  if (PARKED.some((p) => text.includes(deaccent(p)))) return false;
  const core = tokens(name).filter((w) => !TYPE_WORDS.has(w));
  const brandHit = core.some((w) => w.length >= 4 && text.includes(w));
  const geoHit = terms.some((term) => text.includes(term));
  return brandHit && geoHit; // §F.14 — brand-only is a collision, not a hit
}

async function probeLead(
  lead: QualifiedLead,
  region: Region,
): Promise<string | null> {
  const terms = geoTerms(lead, region);
  for (const url of urlCandidates(lead.name, region)) {
    const r = await fetchHtml(url);
    if (r && verify(lead.name, terms, r.html)) return r.finalUrl;
  }
  return null;
}

export async function enrichPresence(
  leads: QualifiedLead[],
  region: Region,
): Promise<QualifiedLead[]> {
  // Only leads currently believed to have no own site are worth verifying.
  const targets = leads.filter(
    (l) => l.websiteStatus === "none" || l.websiteStatus === "portal_only",
  );
  const found = new Map<QualifiedLead, string>();

  let next = 0;
  async function worker(): Promise<void> {
    while (next < targets.length) {
      const lead = targets[next++];
      try {
        const url = await probeLead(lead, region);
        if (url) found.set(lead, url);
      } catch {
        // network noise — leave the lead as-is (still "no site")
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, targets.length) }, () =>
      worker(),
    ),
  );

  return leads.map((l) => {
    const url = found.get(l);
    if (!url) return l;
    // Confirmed own site the Maps profile didn't link. Reclassify; isLead is
    // re-decided by enrichOutdated (a found-but-outdated site stays a lead).
    return { ...l, website: url, websiteStatus: classifyWebsite(url) };
  });
}
