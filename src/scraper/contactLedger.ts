// The contact LEDGER: every e-mail/phone we ever saw for a lead, with its source
// and our verdict — accepted or rejected, and why.
//
// WHY THIS EXISTS (owner request, 2026-08-20): the pipeline used to keep exactly
// one address and silently drop everything else. Two costs followed. First, the
// operator could not tell "nothing was found" from "we found three and threw the
// right one away" — and on the day this was written, the filters HAD thrown away
// good ones. Second, the question "which source answers best?" can only be
// settled by measurement, and measurement needs the discarded rows too.
//
// So: never delete a sighting, record the judgement next to it. Ranking rules
// come LATER, from outreach results, not from a guess made today.

import type { ContactCandidate } from "./types.js";
import { countryLexicon, lexList, allCountryLexicons } from "../countryLexicon.js";
import { phoneKeyIn, type PhoneRules } from "../text/phoneCountry.js";

/** What a ledger key needs of the lead's country row (ADR-0437): its dial code and trunk prefix. */
export type PhoneKeyRules = Pick<PhoneRules, "dialCode" | "trunkPrefix">;

/**
 * The key of a caller that passes NO country — the ledger's historic arithmetic (a number
 * written +36…, 0036…, 06… → its national part). Kept only for the callers outside the
 * collection chain that first read the number in its lead's country themselves
 * (outreach/sharedContactGate normalises a non-HU number to E.164 before it asks); every
 * collection caller passes its lead's row. Not a country fallback: it is the same digits.
 */
const LEGACY_KEY_RULES: PhoneKeyRules = { dialCode: "36", trunkPrefix: "06" };

/** Same phone written differently is the same phone: compare on its national digits, in the
 *  lead's country (`rules` = its row; nemzetközi A). The HU row's key is the historic one. */
export function phoneKey(v: string, rules: PhoneKeyRules | null = LEGACY_KEY_RULES): string {
  return phoneKeyIn(v, rules);
}

/**
 * Freemail and ISP mailbox providers carry no brand signal — a guesthouse run by one person
 * legitimately uses gmail, so these pass on the operator's judgement. Lives here (a pure
 * module) so the guest-facing contact filter re-applies the SAME rule the enricher used.
 *
 * axelero / t-email / gmx / web.de added 2026-10-04: measured on prod, four leads' only
 * e-mail (Kerekerdő `kuci01@axelero.hu`, the former Matáv ISP mailbox that became t-online)
 * was ledgered "idegen domain" although `t-online`/`invitel`/`upcmail` already passed —
 * a personal mailbox is not a foreign business.
 */
// Nemzetközi A: the providers are DATA of each country (lexicon `freemailLabels` — a mailbox
// host label under ANY tld, "gmail." — and `freemailExact` — one whole domain, "web.de"); the HU
// lists are the former regex verbatim, so the HU pattern matches exactly what it matched.
const escRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function freemailPattern(labels: readonly string[], exact: readonly string[]): RegExp {
  const alts = [
    ...(labels.length ? [`(${labels.map(escRe).join("|")})\\.`] : []),
    ...(exact.length ? [`(${exact.map(escRe).join("|")})$`] : []),
  ];
  return alts.length ? new RegExp(`@(${alts.join("|")})`, "i") : /(?!)/;
}
const freemailCache = new Map<string, RegExp>();
/**
 * The freemail test of a lead's COUNTRY (its own providers); a country without a lexicon, or a
 * caller that knows none, gets every country's providers (FREEMAIL).
 */
export function freemailRe(country?: string | null): RegExp {
  const iso = countryLexicon(country)?.iso2 ?? "*";
  let re = freemailCache.get(iso);
  if (!re) {
    const isos = iso === "*" ? allCountryLexicons().map((l) => l.iso2) : [iso];
    const uniq = (key: string): string[] => [...new Set(isos.flatMap((c) => lexList(c, key)))];
    re = freemailPattern(uniq("freemailLabels"), uniq("freemailExact"));
    freemailCache.set(iso, re);
  }
  return re;
}
/** Every country's freemail providers (for a reader that has no lead country). */
export const FREEMAIL = freemailRe(null);

/** The verdict the corroboration rule writes for a domain not tied to the lead. */
export const FOREIGN_DOMAIN_REASON = "nem köthető ehhez a vállalkozáshoz (idegen domain)";

function key(c: { kind: string; value: string }, rules?: PhoneKeyRules | null): string {
  return c.kind === "phone"
    ? `phone:${phoneKey(c.value, rules)}`
    : `email:${c.value.trim().toLowerCase()}`;
}

/**
 * Merge sightings into an existing ledger.
 *
 * Rules that matter:
 *  - `firstSeen` is never overwritten — it dates the discovery, not the run.
 *  - A later ACCEPT beats an earlier reject (the filters improved, or a better
 *    corroboration turned up); a later REJECT does not erase an earlier accept,
 *    it only records the reason, so a tightened filter cannot quietly wipe a
 *    contact the operator may already have used.
 *  - The first source seen for a value is kept, later ones are not appended:
 *    the ledger answers "where did we first learn this", and a value found on
 *    three portals is not three facts.
 */
export function mergeContacts(
  existing: readonly ContactCandidate[] | undefined,
  found: readonly Omit<ContactCandidate, "firstSeen">[],
  today = new Date().toISOString().slice(0, 10),
  /** The lead's country row — two spellings of one number are one key in ITS plan. */
  rules?: PhoneKeyRules | null,
): ContactCandidate[] {
  const out = new Map<string, ContactCandidate>();
  for (const c of existing ?? []) out.set(key(c, rules), c);
  for (const c of found) {
    if (!c.value?.trim()) continue;
    const k = key(c, rules);
    const prev = out.get(k);
    if (!prev) {
      out.set(k, { ...c, firstSeen: today });
      continue;
    }
    out.set(k, {
      ...prev,
      accepted: prev.accepted || c.accepted,
      // Keep a reason only while the value is still rejected.
      rejectedReason:
        prev.accepted || c.accepted
          ? undefined
          : (prev.rejectedReason ?? c.rejectedReason),
    });
  }
  return [...out.values()];
}

/**
 * May this contact be shown to GUESTS (mock / site)? The ledger's verdict decides: a value
 * the ledger rejected is not this business's contact — measured 2026-10-04 on prod, 17 leads
 * carried a rejected address as their current e-mail, among them a town mayor
 * (`mpolgarmester@keszthely.hu` on Rozé Fogadó) and a tourinform office. The pipeline keeps
 * such a value as the lead's best guess for the CURATOR; the guest page must not print it.
 *
 * One re-evaluation: a "foreign domain" verdict on a freemail/ISP mailbox is re-judged with
 * today's FREEMAIL list, so widening the list fixes stored verdicts without a re-scrape.
 * A value with no ledger row (older leads, Places phone) is shown — the ledger only rules
 * where it has spoken.
 */
export function guestVisibleContact(
  contacts: readonly ContactCandidate[] | undefined,
  kind: "email" | "phone",
  value: string,
  /** The lead's country (ISO-2): its phone key and its freemail providers. */
  country?: string | null,
  rules?: PhoneKeyRules | null,
): boolean {
  const row = (contacts ?? []).find((c) => key(c, rules) === key({ kind, value }, rules));
  if (!row || row.accepted) return true;
  return kind === "email" && row.rejectedReason === FOREIGN_DOMAIN_REASON && freemailRe(country).test(value);
}
