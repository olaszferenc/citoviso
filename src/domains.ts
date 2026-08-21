// Domain offering (ADR-0020) — single source of truth for the domain choice the
// prospect makes at order time.
//
// Default = platform subdomain (<slug>.citoviso.com): zero friction, DNS/TLS ours.
// Upsell = a custom domain registered THROUGH US: minimum 24-month subscription
// commitment (owner decision, 2026-07-27). The configurator proactively offers
// 3–5 free-sounding candidates built from the business name (HU-first: .hu
// primary, .com/.eu fallback) with a REAL-TIME preliminary availability check.
//
// Availability is layered (BACKLOG research note): this module implements only
// the CHEAP layer — DNS-over-HTTPS + RDAP, no API key. Its verdict is explicitly
// preliminary ("elérhetőnek tűnik"); the authoritative check + registration is
// the registrar-API layer (post-pilot; manual house step during the pilot, A2).

export const PLATFORM_DOMAIN = "citoviso.com";

/** Minimum subscription commitment (months) for a domain registered through us. */
export const CUSTOM_DOMAIN_MIN_COMMITMENT_MONTHS = 24;

/** ⚠️ PLACEHOLDER yearly price (HUF) of a custom domain through us — owner sets it. */
export const CUSTOM_DOMAIN_YEARLY = 6900;

export type DomainAvailability = "taken" | "probably_free" | "unknown";

export interface DomainSuggestion {
  readonly domain: string;
  readonly availability: DomainAvailability;
}

/** ASCII slug from a business name: accents stripped, non-alnum → hyphen. */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The tenant's default platform host: <slug>.citoviso.com. */
export function subdomainHost(name: string): string {
  const slug = slugify(name) || "oldalam";
  return `${slug}.${PLATFORM_DOMAIN}`;
}

/**
 * True when this process serves the real platform (PUBLIC_SITE_URL is
 * citoviso.com). Locally it is a Tailscale IP / localhost, where wildcard
 * subdomains do not resolve and a browser cannot set a Host header — so the
 * dev-only /t/<slug> path is the ONLY way to open a tenant site.
 */
export function isPlatformHosting(publicSiteUrl: string): boolean {
  try {
    const h = new URL(publicSiteUrl).hostname.toLowerCase();
    return h === PLATFORM_DOMAIN || h.endsWith(`.${PLATFORM_DOMAIN}`);
  } catch {
    return false;
  }
}

/**
 * The URL we SHOW the owner for their live site. On the platform this is the
 * canonical public host; locally it falls back to the dev-only slug path, so a
 * local end-to-end test yields a link that actually opens (previously every
 * local run advertised a production URL that resolves to prod, where the tenant
 * does not exist — the owner landed on our marketing page).
 */
export function tenantSiteUrl(
  publicSiteUrl: string,
  slug: string | null,
  customDomain?: string | null,
): string | null {
  if (customDomain) return `https://${customDomain}`;
  if (!slug) return null;
  if (isPlatformHosting(publicSiteUrl)) return `https://${slug}.${PLATFORM_DOMAIN}`;
  return `${publicSiteUrl.replace(/\/+$/, "")}/t/${slug}`;
}

// Generic type words that often lead the name ("Panzió Sissi") or trail it — the
// hyphenless join and a "-szallas" variant tend to sound better without them.
const TYPE_WORDS = new Set([
  "panzio",
  "vendeghaz",
  "apartman",
  "apartmanhaz",
  "szallas",
  "szallashely",
  "villa",
  "haz",
  "fogado",
  "vendeglo",
]);

/**
 * 3–5 candidate custom domains from the business name (owner: "három-négy-öt").
 * HU-first: .hu primary, .com/.eu fallback (multi-country ccTLDs = global phase).
 * Deterministic — no AI, no network; availability is checked separately.
 */
export function suggestDomains(name: string): string[] {
  const slug = slugify(name);
  if (!slug) return [];
  const joined = slug.replace(/-/g, "");
  const words = slug.split("-").filter(Boolean);
  const core = words.filter((w) => !TYPE_WORDS.has(w)).join("") || joined;

  const out: string[] = [];
  const push = (d: string) => {
    if (d.length >= 7 && d.length <= 40 && !out.includes(d)) out.push(d);
  };
  push(`${joined}.hu`);
  push(`${slug}.hu`);
  if (core !== joined) push(`${core}.hu`);
  push(`${core}szallas.hu`);
  push(`${joined}.com`);
  push(`${joined}.eu`);
  return out.slice(0, 5);
}

/** Fetch with a hard timeout; null on any failure (network is best-effort here). */
async function tryFetch(url: string, ms: number, headers?: Record<string, string>): Promise<Response | null> {
  try {
    return await fetch(url, { signal: AbortSignal.timeout(ms), headers });
  } catch {
    return null;
  }
}

/** DNS layer: an NS answer means the domain is delegated → taken. */
async function dnsTaken(domain: string): Promise<boolean | null> {
  const res = await tryFetch(
    `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=NS`,
    2500,
  );
  if (!res || !res.ok) return null;
  try {
    const j = (await res.json()) as { Status?: number; Answer?: unknown[] };
    if (j.Status === 3) return false; // NXDOMAIN — not delegated
    if (j.Status === 0) return Array.isArray(j.Answer) && j.Answer.length > 0;
    return null;
  } catch {
    return null;
  }
}

/** RDAP layer: 404 = not registered; 200 = registered. rdap.org bootstraps TLDs. */
async function rdapTaken(domain: string): Promise<boolean | null> {
  const res = await tryFetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, 3500, {
    accept: "application/rdap+json",
  });
  if (!res) return null;
  if (res.status === 404) return false;
  if (res.ok) return true;
  return null;
}

/** Verdict of normalising a buyer-typed domain name. */
export interface CustomDomainInput {
  readonly ok: boolean;
  /** The cleaned, checkable domain — only when ok. */
  readonly domain?: string;
  /** Plain, buyer-facing reason when the input cannot be used. */
  readonly reason?: string;
}

// Buyers type domains the way they see them in a browser: with https://, a www.,
// a trailing slash, capitals or a stray space. All of that is fixable — rejecting
// it would only look broken. What is NOT fixable is a missing TLD or characters a
// domain cannot contain, and those get a plain-language reason.
export function normalizeCustomDomain(input: string): CustomDomainInput {
  const raw = String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/?#].*$/, "")
    .replace(/\.$/, "");
  if (!raw) return { ok: false, reason: "Adjon meg egy domain nevet" };
  if (raw.length > 253) return { ok: false, reason: "Túl hosszú domain név" };
  const labels = raw.split(".");
  if (labels.length < 2) return { ok: false, reason: "Végződés is kell, például: pelda.hu" };
  for (const label of labels) {
    if (!label) return { ok: false, reason: "Hibás domain név (üres rész a pontok között)" };
    if (label.length > 63) return { ok: false, reason: "Túl hosszú rész a domain névben" };
    // IDN (ékezetes) domains exist, but we register through a registrar API that
    // takes punycode — accepting "ékezetes.hu" here would promise more than we can
    // deliver at order time, so it is refused with a usable instruction.
    if (!/^[a-z0-9-]+$/.test(label) || label.startsWith("-") || label.endsWith("-")) {
      return { ok: false, reason: "Csak angol betű, szám és kötőjel használható" };
    }
  }
  const tld = labels[labels.length - 1]!;
  if (!/^[a-z]{2,}$/.test(tld)) return { ok: false, reason: "Hibás végződés (például: .hu, .com)" };
  return { ok: true, domain: raw };
}

/**
 * Preliminary availability: DNS first (cheap, decisive when delegated), RDAP to
 * confirm the free-looking ones. Never authoritative — the UI must say so.
 */
export async function checkAvailability(domain: string): Promise<DomainAvailability> {
  const dns = await dnsTaken(domain);
  if (dns === true) return "taken";
  const rdap = await rdapTaken(domain);
  if (rdap === true) return "taken";
  if (rdap === false) return "probably_free";
  // RDAP unreachable/unbootstrapped (e.g. some ccTLDs): NXDOMAIN alone is a weak
  // free signal (registered-but-undelegated domains exist) → stay honest.
  return "unknown";
}

/** Suggestions with availability, checked concurrently (order preserved). */
export async function suggestWithAvailability(name: string): Promise<DomainSuggestion[]> {
  const candidates = suggestDomains(name);
  const checks = await Promise.all(candidates.map((d) => checkAvailability(d)));
  return candidates.map((domain, i) => ({ domain, availability: checks[i]! }));
}
