// The reference number the BUYER quotes — ours, and shaped for a human.
//
// WHY THIS FILE EXISTS (Elek FK-006b HIBA-3, measured 2026-09-13): on the receipt
// of a paid 14 900 Ft module the customer read
//   „Hivatkozási azonosító: mock_837a03b6-5940-4da3-a470-34dd7f6258d3"
// — a 41-character gateway id whose visible prefix says „mock" to the person who
// just paid real money. That string is the PAYMENT PROVIDER's internal handle
// (Barion would print an equally unreadable GUID), and a developer identifier is
// not user-facing text (ADR-0126 ①).
//
// ── THE RULE ────────────────────────────────────────────────────────────────
// The reference is derived from OUR OWN `payment.id`, not from the gateway's:
//   • it exists before the gateway answers, and survives a gateway swap;
//   • it never leaks a vendor name or the word „mock";
//   • it is FINDABLE — `scripts/find-payment.mts CIT-837A03B6` resolves it back,
//     so „ha ír nekünk, kérjük idézze" is a promise we can actually keep.
// ⛔ It is NOT a new stored column: an id we print but cannot look up would be the
// same defect wearing nicer clothes.

/** Prefix of every customer-facing payment reference. */
export const PUBLIC_REF_PREFIX = "CIT-";

/** How many hex characters of the payment id the reference carries. */
const REF_HEX = 8;

/**
 * The reference for a payment, or null when there is no payment to reference.
 * `CIT-` + the first 8 hex characters of the uuid, upper-cased: short enough to
 * read over the phone, wide enough (16^8) that a prefix lookup lands on one row.
 */
export function publicPaymentRef(paymentId: string | null | undefined): string | null {
  if (!paymentId) return null;
  const hex = paymentId.replace(/-/g, "").slice(0, REF_HEX);
  // Anything that is not a uuid is not ours to dress up — better no reference
  // than a made-up one (§B.17).
  if (!/^[0-9a-f]{8}$/i.test(hex)) return null;
  return `${PUBLIC_REF_PREFIX}${hex.toUpperCase()}`;
}

/**
 * The `payment.id` prefix a quoted reference points at, or null when the string is
 * not one of ours. This is the inverse the lookup script uses — exported so the
 * round trip is testable rather than re-implemented at the query site.
 */
export function paymentIdPrefixOf(ref: string): string | null {
  const m = new RegExp(`^${PUBLIC_REF_PREFIX}([0-9a-f]{${REF_HEX}})$`, "i").exec(ref.trim());
  return m ? m[1]!.toLowerCase() : null;
}
