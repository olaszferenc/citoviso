import { recipientKey } from "./address.js";

// A LEAD'S E-MAIL ADDRESSES — one primary plus further ones (ADR-0321, owner 2026-10-04:
// „lehessen több emailcímet menteni!”).
//
// Storage (lead.raw jsonb, no schema change):
//   · `raw.email`        — the PRIMARY, unchanged meaning. Every existing reader (generator,
//                          templates, gates, scripts) keeps reading it and keeps being right:
//                          the public site shows ONE contact, the cold mail goes to ONE address.
//   · `raw.otherEmails`  — the further addresses, in the curator's order. NOT recipients: no
//                          cold mail is ever sent to them; they are the lead's data (and the
//                          duplicate / shared-contact checks look at them).
// The primary lives ONLY in `raw.email` and never repeats in `raw.otherEmails` — two fields,
// not two copies.
//
// Format rule = TODAY'S rule, unchanged (owner 2026-10-04: no stricter format): the WHATWG
// "valid e-mail address" that the form's type=email field has always enforced in the browser.
// What is new is that the SERVER checks it too, per address, because a list no longer fits
// one browser-validated field.

/** The WHATWG "valid e-mail address" (HTML Living Standard, input type=email). */
const WHATWG_EMAIL =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/u;

export function isValidEmail(s: string): boolean {
  return WHATWG_EMAIL.test(s.trim());
}

/**
 * The address inside a raw `mailto:` target: percent-decoded (a malformed escape is
 * read as-is), then reduced to the first address-shaped run, so a label glued in
 * front ("email:", "e-mail:") or after it never reaches the lead. No address → none.
 */
export function mailtoAddress(target: string): string | undefined {
  let decoded = target;
  try {
    decoded = decodeURIComponent(target);
  } catch {
    // keep the raw target
  }
  return /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.exec(decoded)?.[0].toLowerCase();
}

/**
 * The FULL form of a truncated address, when another source carries it. A source can
 * lose the front of the local part and still look valid: the OSM tag of Família
 * Pizzéria Panzió reads "amiliapizzeria@familiapizzeria.hu", its own site
 * "familiapizzeria@…" (way/373597860, 2026-10-08); Illaberek: "llaberek…@gmail.com".
 * Mailing the stump bounces.
 *
 * "Ends with" alone is NOT proof — measured on the live leads the same day: the longer
 * one is just as often the junk ("nligetapartments@" from a page's "\n", "%20hello@") or
 * another real mailbox ("info.atriumagard@" beside "atriumagard@",
 * "reservations.budapest@" beside "budapest@"). So a candidate wins only when
 *   · it is a valid address of the SAME domain whose local part ends with the stump's,
 *     starts with a letter/digit, and the candidates do not carry the stump itself; AND
 *   · the stump is visibly cut (its local part starts with a dot), or the candidate's
 *     local part IS the name of the lead's own site ("familiapizzeria" ↔
 *     familiapizzeria.hu) while the stump's is not.
 * Otherwise the address stays as it is.
 */
export function fullerEmail(email: string, candidates: readonly string[], website?: string): string {
  const [local, domain] = splitAddress(email);
  if (!local || !domain) return email;
  const pool = candidates.map((c) => c.trim().toLowerCase());
  if (pool.includes(`${local}@${domain}`)) return email;
  const site = siteCore(website);
  for (const c of pool) {
    const [cl, cd] = splitAddress(c);
    if (cd !== domain || cl.length <= local.length || !cl.endsWith(local)) continue;
    if (!/^[a-z0-9]/u.test(cl) || !isValidEmail(c)) continue;
    if (local.startsWith(".") || (site !== "" && cl === site && local !== site)) return c;
  }
  return email;
}

function splitAddress(s: string): [string, string] {
  const t = s.trim().toLowerCase();
  const at = t.lastIndexOf("@");
  return at > 0 ? [t.slice(0, at), t.slice(at + 1)] : ["", ""];
}

/** "https://www.familiapizzeria.hu/x" → "familiapizzeria". */
function siteCore(website: string | undefined): string {
  if (!website) return "";
  try {
    return new URL(website).hostname.toLowerCase().replace(/^www\./u, "").split(".")[0] ?? "";
  } catch {
    return "";
  }
}

/**
 * A pasted/typed list → address tokens. Separators: `;` `,` whitespace (the OSM `email` tag
 * joins multiple values with `;`; a copied mail header uses `,`). `mailto:` and the brackets
 * of "Név <cím>" are unwrapped; an HTML entity scraped along (`…hu&quot;`) is decoded first,
 * or its `;` would split the address. Mirrored once in migrations/0086 — keep them alike.
 */
export function splitEmailList(s: string | null | undefined): string[] {
  return String(s ?? "")
    .replace(/&quot;/gu, '"')
    .replace(/&amp;/gu, "&")
    .replace(/mailto:/giu, " ")
    .split(/[;,\s]+/u)
    .map((t) => t.replace(/^[<("']+|[>)"'.]+$/gu, "").trim())
    .filter(Boolean);
}

interface EmailRaw {
  readonly email?: string | null;
  readonly otherEmails?: readonly string[] | null;
}

/** All addresses of a lead, primary first. Empty-safe; never repeats a mailbox. */
export function leadEmails(raw: EmailRaw | null | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of [raw?.email, ...(raw?.otherEmails ?? [])]) {
    const t = typeof v === "string" ? v.trim() : "";
    const k = recipientKey(t);
    if (!t || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

/** One refused address. Structured, not prose: this module is imported by the scrapers and
 *  reaches the mail adapters, so the operator-facing wording lives with the console rule
 *  (leadContactRules.ts), not here (i18n-scope, ADR-0070). */
export type EmailProblem =
  | { readonly kind: "invalid"; readonly addr: string }
  | { readonly kind: "duplicate"; readonly addr: string; readonly sameAs: string };

export interface EmailListVerdict {
  readonly ok: boolean;
  /** One per refused address. */
  readonly problems: readonly EmailProblem[];
  /** The list as it must be stored: trimmed, as typed, primary first, empties dropped. */
  readonly emails: readonly string[];
}

/**
 * Judge a curator-entered address list. Pure. Each entry may itself be a pasted list
 * ("a; b") — it is split first, so a no-JS submit of the old single field still works.
 * A repeated MAILBOX (same `recipientKey`: case and +tag folded, the opt-out's own key)
 * is refused rather than silently dropped: the operator typed it twice for a reason
 * (usually a typo in one of them), and a save that quietly writes less than was on the
 * screen reads as data loss.
 */
export function checkEmailList(entries: readonly string[]): EmailListVerdict {
  const problems: EmailProblem[] = [];
  const emails: string[] = [];
  const firstOf = new Map<string, string>();
  for (const addr of entries.flatMap((e) => splitEmailList(e))) {
    if (!isValidEmail(addr)) {
      problems.push({ kind: "invalid", addr });
      continue;
    }
    const k = recipientKey(addr);
    const prev = firstOf.get(k);
    if (prev !== undefined) {
      problems.push({ kind: "duplicate", addr, sameAs: prev });
      continue;
    }
    firstOf.set(k, addr);
    emails.push(addr);
  }
  return { ok: problems.length === 0, problems, emails };
}

/**
 * What the „Követett link készítése” recipient field starts with (owner 2026-10-04: „igen töltse
 * elő”, with decision 4 „Nem autofill ha van több email”): the lead's ONLY address, or nothing.
 * With several addresses the operator chooses — a prefilled pick would be the system choosing
 * whom a cold mail reaches. Only a starting value: the field stays editable and is still sent
 * through the same create path (trimmed there, opt-out/one-shot checked at send).
 */
export function outreachPrefill(raw: EmailRaw | null | undefined): string {
  const all = leadEmails(raw);
  return all.length === 1 ? all[0]! : "";
}
