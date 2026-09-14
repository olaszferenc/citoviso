// A CALENDAR DAY, written the way the reader writes it (ADR-0036 §B.18).
//
// WHY THIS FILE EXISTS. `YYYY-MM-DD` is a storage format. It leaked into the
// buyer's own sentences: measured 2026-09-13 (Elek FK-001 H1, FK-006a HIBA-2)
// a renewal notice read "Honlap-előfizetése 2035-09-10 napon újul meg", and the
// tenant admin printed the same ISO stamp in a dozen more places — next to a
// checkout that says "2027. 09. 13.". One product, two date languages, and the
// machine's one is the one that reached the customer.
//
// ⛔ NEVER ROUTE A CALENDAR DAY THROUGH `Date`. `new Date("2027-09-10")` is UTC
// midnight; formatting that instant in a negative-offset zone prints the 9th.
// The same trap is documented at db/client.ts (the DATE type parser), where a
// Sept 18 arrival rendered as Sept 17 in guest-facing mail. A day is a label,
// not an instant — so the Hungarian form here is a pure string transform, and
// the Intl branch for other packs is pinned to UTC.

/** Matches the storage form these helpers accept; anything else passes through. */
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * `2027-09-10` → `2027. 09. 10.` (hu), or the reader's locale for other packs.
 *
 * Pass-through on anything that is not an ISO day (empty string, already
 * formatted, null): a formatter that throws or prints "Invalid Date" on the
 * unhappy path would turn a cosmetic defect into a blank screen.
 */
export function formatDay(iso: string | null | undefined, lang = "hu"): string {
  if (!iso) return "";
  const m = ISO_DAY.exec(iso);
  if (!m) return iso;
  if (!lang || lang === "hu") return `${m[1]}. ${m[2]}. ${m[3]}.`;
  return new Intl.DateTimeFormat(lang, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

/**
 * The same day WITHOUT the closing dot, for sentences that append their own
 * suffix: `{date}-ig`, `{date}-án`, `A {date}-i számla`. Hungarian writes
 * "2027. 09. 10-ig", never "2027. 09. 10.-ig" — the suffix replaces the dot.
 *
 * The wording (which suffix) belongs to the sentence and stays in the catalog;
 * this only decides where the date stops.
 */
export function formatDayStem(iso: string | null | undefined, lang = "hu"): string {
  return formatDay(iso, lang).replace(/\.$/, "");
}
