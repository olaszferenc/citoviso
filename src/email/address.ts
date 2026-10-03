import { sql, type RawBuilder } from "kysely";

// ONE canonical form for an e-mail address — the mirror of `normalizePhone()`.
//
// Why this file exists (measured 2026-09-12). The opt-out is PERSON-level by design
// (ADR-0053, ADR-0122): whoever said stop must not be contacted again, on any prospect
// row. The MOBILE channel has always compared NORMALISED numbers, with a comment
// spelling out why ("a string equality would silently miss the match"). The E-MAIL
// channel compared raw strings.
//
// That held only by accident: every scraper path lowercases what it extracts
// (`enrichWebSearch.ts`, `extract.ts`, `contactLedger.ts`), so all 397 lead addresses
// and all prospect rows are already lowercase — the data could not express the bug.
// But the OPERATOR-TYPED path could: `setProspectContactEmail` only trimmed, so an
// address typed as `Info@Panzio.hu` on a second tracked link would NOT match an opt-out
// recorded as `info@panzio.hu`, and we would mail someone who said stop. That is the
// field FK-004 itself types into.
//
// ⛔ SCOPE — what `normalizeEmail` deliberately does NOT do: no plus-subaddress folding,
// no Gmail dot-folding. It is the STORED form, and an address is stored as typed.
// Dot-folding is false outside Gmail (it would block a different human) and stays out.
//
// PLUS-SUBADDRESS — decided with the case in hand (Elek round 3, owner ruling 2026-10-03):
// `olasz.ferenc+erika@citoviso.com` was mailed a second cold letter, because the one-shot
// lock read it as a new address. `name+tag@domain` is the same person as `name@domain` at
// every provider that supports subaddressing, and over-matching costs one unsent cold mail
// while under-matching mails a person twice (or after an opt-out). So the RECIPIENT key —
// what the one-cold-mail lock and the opt-out compare — folds the tag: `recipientKey()` and
// its SQL twin `recipientKeySql()`. The stored address keeps its tag.

/**
 * Canonical comparison form: trimmed and lowercased.
 *
 * Lowercasing the local part is technically beyond the RFC (only the DOMAIN is
 * case-insensitive by spec), and that is the intended trade: the asymmetry of the two
 * mistakes is not close. Over-matching costs one unsent cold mail; under-matching mails
 * a person who opted out — a Grt./GDPR violation. No mail provider we can reach
 * delivers `Info@` and `info@` to different humans.
 */
export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/** Two addresses reach the same mailbox (by the rule above). Empty never matches. */
export function sameMailbox(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = normalizeEmail(a);
  return x.length > 0 && x === normalizeEmail(b);
}

/**
 * The PERSON a cold mail reaches: the canonical form with the plus-subaddress tag dropped
 * (`Name+Erika@X.com` → `name@x.com`). Used by the one-cold-mail lock and the opt-out —
 * never to rewrite the stored address. Empty in, empty out.
 */
export function recipientKey(email: string | null | undefined): string {
  return normalizeEmail(email).replace(/\+[^@]*(?=@)/u, "");
}

/** `recipientKey()` in SQL, for a column — the two must fold exactly the same way. */
export function recipientKeySql(column: string): RawBuilder<string> {
  return sql<string>`regexp_replace(lower(trim(${sql.ref(column)})), '\\+[^@]*@', '@')`;
}
