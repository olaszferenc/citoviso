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
// ⛔ SCOPE — what this deliberately does NOT do. No plus-subaddress folding
// (`a+tag@x.com` → `a@x.com`), no Gmail dot-folding. Both are claims about THIRD-PARTY
// mailbox semantics that we have not measured, and dot-folding is simply false outside
// Gmail — it would block a different human. Measured on our data: 0 of 397 lead
// addresses and 0 of 4 prospect rows use plus-addressing, so the rule would be
// untestable complexity today. If a plus-address ever appears, decide it THEN, with the
// case in hand.

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
