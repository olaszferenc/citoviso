import { classifyWebsite, isMvpLead } from "./qualify.js";
import type { Industry, QualifiedLead, RawLead } from "./types.js";
import { leadEmails } from "../email/leadEmails.js";

// Deduplicate raw leads across sources and qualify them. Two raw leads are the
// same player when their normalized names match AND they are within ~250 m (or
// coordinates are missing on either side). Merged fields prefer non-empty values,
// and an own-domain website wins over a portal/none.
//
// ADR-XXXX (ország-réteg 3/4): the name key keeps EVERY script's letters. It used to keep
// only [a-z0-9], so a Cyrillic or Greek name became "" — and every such lead within 250 m
// (or without coordinates) melted into ONE lead. Now: NFKD + combining marks stripped
// (Hungarian/Czech accents fold exactly as before: "Rózsa" = "rozsa"), Cyrillic/Greek/…
// letters stay, and an EMPTY key never matches anything (a name of only punctuation is
// not evidence of sameness). A Latin and a Cyrillic spelling of one name are two keys:
// they are NOT merged silently — `sameNameOtherScript` lets the caller flag the pair.

export function normalizeName(name: string): string {
  return name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/\p{M}+/gu, "") // strip accents (combining marks of any script)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Same name key, and the key is not empty — the only way two names "match". */
function sameName(a: string, b: string): boolean {
  const na = normalizeName(a);
  return na !== "" && na === normalizeName(b);
}

// Cyrillic → Latin (the common BG/RS/MK/UA/RU readings) and Greek → Latin, ONLY to notice that
// two spellings may be one name. Never used as a merge key.
const TRANSLIT: Readonly<Record<string, string>> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", ђ: "dj", е: "e", ё: "e", є: "e", ж: "zh", з: "z", и: "i", і: "i", ї: "i",
  й: "j", ј: "j", к: "k", л: "l", љ: "lj", м: "m", н: "n", њ: "nj", о: "o", п: "p", р: "r", с: "s", т: "t", ћ: "c",
  у: "u", ф: "f", х: "h", ц: "c", ч: "ch", џ: "dz", ш: "sh", щ: "sht", ъ: "a", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  ѓ: "gj", ќ: "kj", ѕ: "dz",
  α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x",
  ο: "o", π: "p", ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o",
};

/** A rough Latin reading of a name key, for spotting a cross-script pair (never a merge key). */
export function latinReading(name: string): string {
  return [...normalizeName(name)]
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join("")
    .replace(/(sh|ch|zh)/g, (m) => m[0]!) // "Šumava"/"Шумава" both fold to s-…
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Two names that are NOT the same key but read the same once transliterated ("Vila Marija" /
 * "Вила Марија") — the caller keeps them as two leads and flags the pair for a look.
 */
export function sameNameOtherScript(a: string, b: string): boolean {
  if (sameName(a, b)) return false;
  const la = latinReading(a);
  return la.length >= 3 && la === latinReading(b);
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

function otherEmailsOf(leads: RawLead[]): { otherEmails?: string[] } {
  const src = leads.find((l) => l.email);
  if (!src?.otherEmails?.length) return {};
  const rest = leadEmails(src).slice(1);
  return rest.length ? { otherEmails: rest } : {};
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
    country: firstDefined(...leads.map((l) => l.country)),
    city: firstDefined(...leads.map((l) => l.city)),
    phone: firstDefined(...leads.map((l) => l.phone)),
    email: firstDefined(...leads.map((l) => l.email)),
    // The further addresses travel WITH their primary: the same source's list.
    ...otherEmailsOf(leads),
    website,
    websiteStatus: status,
    sources: [...new Set(leads.map((l) => l.source))],
    // Keep each source's own id so the console can link straight to the record
    // the data came from. First writer per source wins (same order as sources).
    sourceRefs: leads.reduce<Record<string, string>>((acc, l) => {
      if (l.sourceId && !acc[l.source]) acc[l.source] = l.sourceId;
      return acc;
    }, {}),
    photoCount,
    isLead: isMvpLead(status),
  };
}

/** Minimal identity of an already-stored lead, for cross-run/cross-region dedup. */
export interface LeadIdentity {
  readonly name: string;
  readonly lat?: number | null;
  readonly lon?: number | null;
}

/**
 * Same physical player? Normalized name equal AND within ~250 m. Coordinates are
 * REQUIRED here (unlike the within-run merge, which also matches on name alone when
 * coords are missing): the persistent store spans regions AND countries, so a
 * name-only match would wrongly merge distinct same-name businesses far apart.
 */
export function isSamePlayer(a: LeadIdentity, b: LeadIdentity): boolean {
  if (!sameName(a.name, b.name)) return false;
  const d = distanceMeters(
    { lat: a.lat ?? undefined, lon: a.lon ?? undefined },
    { lat: b.lat ?? undefined, lon: b.lon ?? undefined },
  );
  return d <= 250; // Infinity (missing coords on either side) does NOT match here
}

/** Within ~250 m — both coordinates required (the persistent-store rule). */
function near(a: LeadIdentity, b: LeadIdentity): boolean {
  return (
    distanceMeters({ lat: a.lat ?? undefined, lon: a.lon ?? undefined }, { lat: b.lat ?? undefined, lon: b.lon ?? undefined }) <= 250
  );
}

/**
 * Split freshly-scraped leads into the ones NOT already in the store (`fresh`) and
 * the ones that duplicate an existing lead (`duplicates`). This is what stops a
 * re-scrape — or two OVERLAPPING scrape areas (circles legitimately overlap) — from
 * inserting the same business twice. Matching against ALL existing leads (any
 * lifecycle) also means a disqualified player is not silently resurrected by a
 * re-scrape. O(n·m); fine at pilot volume, a spatial index is a later optimization.
 */
export function partitionNewLeads(
  incoming: QualifiedLead[],
  existing: LeadIdentity[],
): { fresh: QualifiedLead[]; duplicates: QualifiedLead[] } {
  const store = [...existing];
  const fresh: QualifiedLead[] = [];
  const duplicates: QualifiedLead[] = [];
  for (const lead of incoming) {
    const id: LeadIdentity = { name: lead.name, lat: lead.lat, lon: lead.lon };
    if (store.some((e) => isSamePlayer(id, e))) {
      duplicates.push(lead);
    } else {
      // Same name in another script, nearby: still a new lead, but flagged (ADR-XXXX).
      const twin = store.find((e) => sameNameOtherScript(id.name, e.name) && near(id, e));
      fresh.push(twin ? { ...lead, scriptTwinOf: twin.name } : lead);
      // A just-accepted lead joins the store so a second incoming row for the same
      // new player (should not happen post within-run dedup, but be safe) is caught.
      store.push(id);
    }
  }
  return { fresh, duplicates };
}

export function dedupeAndQualify(
  raw: RawLead[],
  industry: Industry,
  region: string,
): QualifiedLead[] {
  const clusters: RawLead[][] = [];
  for (const lead of raw) {
    let placed = false;
    for (const cluster of clusters) {
      const head = cluster[0];
      const d = distanceMeters(head, lead);
      if (sameName(head.name, lead.name) && (d <= 250 || d === Infinity)) {
        cluster.push(lead);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push([lead]);
  }
  return clusters.map((c) => merge(c, industry, region));
}
