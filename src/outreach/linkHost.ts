// WHO owns the host the cold letter's links point at? (Elek FK-004 ④.)
//
// Every link in the outreach mail — the tracked preview, the unsubscribe, the privacy
// notice — is built from ONE value: `PUBLIC_BASE_URL` (src/outreach/draft.ts). On this
// dev box that is the Tailscale host, so Elek measured a letter signed "Citoviso" whose
// every link pointed at `mineral.tail3a89f.ts.net:8443`. That instance is a local
// artefact — but the finding underneath is not: nothing in the system connects the
// letter's link host to the identity the letter claims, so a production .env typo
// (a staging host, an old domain, a partner's URL) would produce exactly the same
// letter and every existing gate would pass it. `isUnreachableForRecipient` only asks
// "can the recipient load this", not "is this us".
//
// Measured 2026-09-11 on the live VPS: PUBLIC_BASE_URL=https://citoviso.com — prod is
// configured correctly today. This module exists so that stays TRUE BY MEASUREMENT
// rather than by memory.
//
// Deliberately NOT a §C FLAG rule: on a dev box the mismatch is normal and expected,
// and a gate that everyone learns to ignore locally is worse than no gate. Instead it
// feeds (1) a visible warning on the draft screen, where the operator decides, and
// (2) scripts/outreach-link-host-check.mts, which measures the PRODUCTION env.

import { config } from "../config.js";

export interface LinkHostVerdict {
  /** Host of the links the letter carries (no port). */
  readonly linkHost: string;
  /** Registrable domain we compared (last two labels). */
  readonly linkDomain: string;
  /** Registrable domain of the sender identity we compared against. */
  readonly senderDomain: string;
  /** True when the letter would claim one identity and link to another. */
  readonly mismatch: boolean;
}

/**
 * Naive registrable domain: the last two labels. Correct for the single-level TLDs we
 * operate under (.com, .hu) and honest about what it compares — a public-suffix list
 * would be the right tool the day we sign from a `.co.uk`, and this returns the whole
 * host for anything with fewer than two labels rather than guessing.
 */
function registrableDomain(host: string): string {
  const parts = host.toLowerCase().replace(/\.$/, "").split(".").filter(Boolean);
  if (parts.length < 2) return parts.join(".");
  return parts.slice(-2).join(".");
}

function hostOfUrl(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function domainOfEmail(addr: string): string {
  // Accepts both "user@host" and 'Name <user@host>'.
  const m = /<([^>]+)>/.exec(addr);
  const bare = (m ? m[1]! : addr).trim();
  const at = bare.lastIndexOf("@");
  return at < 0 ? "" : registrableDomain(bare.slice(at + 1));
}

/**
 * Compare the host the letter LINKS to with the domain it is SIGNED from.
 *
 * Returns null when either side is unknown (no base URL, no sender address): absence
 * of data is not a mismatch, and both gaps already have their own loud gates —
 * `[HIÁNYZÓ PUBLIC_BASE_URL]` fails §C.1/LINK, an empty sender fails §C.2.
 */
export function checkOutreachLinkHost(baseUrl?: string): LinkHostVerdict | null {
  const base = (baseUrl ?? config.publicBaseUrl ?? "").trim();
  const sender = (config.outreachSender.email || config.outreachFrom || "").trim();
  const linkHost = hostOfUrl(base);
  const senderDomain = domainOfEmail(sender);
  if (!linkHost || !senderDomain) return null;
  const linkDomain = registrableDomain(linkHost);
  return { linkHost, linkDomain, senderDomain, mismatch: linkDomain !== senderDomain };
}
