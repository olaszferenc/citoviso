// What may stand in a lead's PUBLIC contact fields (ADR-0316).
//
// The lead's `raw.address` / `raw.country` / `raw.phone` / `raw.email` are the
// PROPERTY's facts: the generator prints them on every mock and tenant site (hero,
// header, footer, map card). Measured 2026-10-03 on the dev park: 7 leads carried a
// BUYER's billing data instead — "Ráckevei út 083/2 hrsz., 24393470213" (a billing
// street plus an 11-digit tax-number-shaped id) and country "MAGYARORSZÁG". The path
// was the console "Adatok" form (saveLeadEdits): plain `name="address|country|phone|
// email"` inputs, which the browser's address-autofill fills from the operator's OWN
// profile — the very profile that also filled the checkout's buyer form (the same
// string sits in order_intent.buyer_address). Nobody types "Magyarország" into a field
// whose placeholder says "HU".
//
// ⛔ Only rules with NO legitimate counterexample refuse here:
//   · an address never contains a Hungarian tax number (checksum-valid, found by the
//     billing module's finder) — and a phone number in the address field is just as wrong;
//   · the country is an ISO-2 code; the national names the scrapers and the autofill
//     produce are folded to it, anything else is refused.
// A "same as some buyer's billing data" rule was considered and NOT made a refusal:
// an owner with two properties, or living in the house they rent out, legitimately
// shares e-mail/address between the lead and an order.

import { findHuTaxNumberInText } from "../billing/taxId.js";
import { normalizeCountryCode } from "../markets.js";
import { checkEmailList } from "../email/leadEmails.js";

/** Country names that mean an ISO-2 code (scrape output, browser autofill, typed). */
const COUNTRY_ALIASES: Readonly<Record<string, string>> = {
  HU: "HU",
  "MAGYARORSZÁG": "HU",
  MAGYARORSZAG: "HU",
  HUNGARY: "HU",
};

/**
 * Scrape-time country values arrive in mixed shapes ("HU", "MAGYARORSZÁG",
 * "Hungary") — one lead list showed all of them side by side (Elek lelet,
 * FK-003). Normalized HERE, in the data layer, so the column, the filter
 * buckets and the identity band all agree; the stored raw stays untouched.
 */
export function normalizeCountry(c: string | undefined | null): string | null {
  if (!c) return null;
  const up = c.trim().toUpperCase();
  if (!up) return null;
  return COUNTRY_ALIASES[up] ?? c.trim();
}

/**
 * A digit run that cannot be part of a postal address besides a tax number: a phone
 * number (10–12 digits). Measured after joining digit groups split by spaces/dashes,
 * so "06 20 375 9440" counts as one run. House numbers, postcodes and parcel numbers
 * ("24", "8274", "083/2", "3512 hrsz") are short, and a letter breaks the run.
 * The TAX NUMBER is found by the billing module's own finder (checksum-valid only) —
 * the same rule that keeps it out of the invoice address (Elek F-1), not a second copy.
 */
const PHONE_IN_ADDRESS = /(?<![\d/])\+?\d{10,12}(?![\d/])/u;

function joinDigitGroups(s: string): string {
  return s.replace(/(\d)[\s-]+(?=\d)/gu, "$1");
}

export interface LeadContactInput {
  readonly address?: string;
  readonly country?: string;
  /** The lead's e-mail addresses, primary first (ADR-XXXX). Omitted = not edited. */
  readonly emails?: readonly string[];
}

export interface LeadContactVerdict {
  readonly ok: boolean;
  /** Operator-facing reasons, one per refused field (Hungarian, console-only). */
  readonly problems: readonly string[];
  /** The country as it must be stored (ISO-2), when one was given and is valid. */
  readonly country?: string;
  /** The e-mail list as it must be stored (primary first), when one was given. */
  readonly emails?: readonly string[];
}

/** Judge a curator edit of the lead's public contact fields. Pure. */
export function checkLeadContact(input: LeadContactInput): LeadContactVerdict {
  const problems: string[] = [];
  const address = input.address?.trim() ?? "";
  if (address) {
    const tax = findHuTaxNumberInText(address);
    const phone = tax ? null : PHONE_IN_ADDRESS.exec(joinDigitGroups(address))?.[0];
    if (tax || phone) {
      problems.push(
        `A cím mezőben ${tax ? `adószám áll (${tax})` : `telefonszám-formájú szám áll (${phone})`}. ` +
          `A szállás címe csak irányítószám, település, utca, házszám vagy hrsz.; ` +
          `vevő- vagy számlázási adat nem kerülhet ide (a böngésző automatikus kitöltése is ilyet ír be).`,
      );
    }
  }
  let country: string | undefined;
  const rawCountry = input.country?.trim() ?? "";
  if (rawCountry) {
    // Aliases folded first, then the ONE ISO-2 shape test the market gates use.
    const iso = normalizeCountryCode(normalizeCountry(rawCountry));
    if (iso) country = iso;
    else problems.push(`Az ország kétbetűs kód legyen (pl. HU), nem „${rawCountry}”.`);
  }
  // E-mail: today's format rule (the browser's type=email, now also checked here because a
  // list no longer fits one browser-validated field) + one mailbox once. ADR-XXXX.
  let emails: readonly string[] | undefined;
  if (input.emails !== undefined) {
    const v = checkEmailList(input.emails);
    for (const pr of v.problems) {
      problems.push(
        pr.kind === "invalid"
          ? `„${pr.addr}” nem érvényes e-mail-cím.`
          : `„${pr.addr}” ugyanaz a postafiók, mint „${pr.sameAs}” — egy cím csak egyszer szerepelhet.`,
      );
    }
    emails = v.emails;
  }
  return { ok: problems.length === 0, problems, ...(country ? { country } : {}), ...(emails ? { emails } : {}) };
}
