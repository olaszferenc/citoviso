// AN AMOUNT OF MONEY, written the way the reader writes it (ADR-0036 §B.18).
// The sibling of text/day.ts, and it exists for the same measured reason.
//
// WHY THIS FILE EXISTS. `HUF` is a storage code, `Ft` is what a Hungarian reads.
// Measured 2026-09-14 on 4535965: one buyer got BOTH. The six dunning letters
// interpolated a raw `{amount} {currency}` pair ("99 900 HUF"); the invoice mail
// for the same charge said "99 900 Ft". Sixteen places formatted money, and the
// same 99 900 HUF came out in FIVE different shapes — the code, the sign, with a
// plain space, with a non-breaking one, and with no unit at all.
//
// The wider defect was not the sign but the CURRENCY: five of those places wrote
// "Ft" whatever they were handed, so an amount in the EUR pricelist (pricing_config
// has a live 'global' row at 10 EUR) printed as "10 Ft" — on the checkout page the
// buyer pays from, and on the guest's booking quote. A formatter that cannot be
// wrong about the currency is the only way that stops coming back.
//
// ⛔ NEVER `Intl.NumberFormat(…, {style:"currency"})` FOR HUNGARIAN. Two traps,
// both measured: (1) hu-HU renders EUR as "99 900 EUR", losing the € sign we
// actually want; (2) it THROWS `RangeError: Invalid currency code` on anything
// that is not ISO-4217 — and we do hand it non-ISO values (scraper/types.ts:323
// keeps the currency "as published": "HUF", "EUR", "Ft", "€"; generator/
// configurator.ts sent the literal "Ft" to the browser). A formatter that throws
// on the unhappy path turns a cosmetic defect into a blank screen, so every
// branch here falls back rather than raises — the same contract formatDay keeps.
//
// ⛔ NO NON-BREAKING SPACE, in any language (owner's decision, 2026-09-14, from
// the measurement): all 28 money literals in the guards and the Elek scenarios
// expect U+0020; payment/billing.ts already stripped NBSP by hand for plain mail;
// and in an SMS a NBSP falls outside GSM-7, cutting the segment from 160 chars to
// 70. Keeping a number from breaking across lines is the stylesheet's job
// (`white-space:nowrap`), not the string's.
//
// ⚠️ THE MIRROR. The browser needs the same rule and cannot import TypeScript, so
// assets/runtime/cit-money.js carries a second copy. That is a deliberate second
// copy of ONE rule, and scripts/money-format-check.mts proves the two agree
// byte-for-byte over every supported language — a copy nobody measures is how the
// split above happened in the first place.

/** The domestic sign for the currencies we price in; anything else prints its own code. */
const CURRENCY_SIGN: Readonly<Record<string, string>> = { HUF: "Ft", EUR: "€" };

/**
 * Every space Intl may put inside a number, none of which may survive into our
 * output: NBSP, NARROW NBSP (what modern ICU emits for fr/ru grouping) and THIN
 * SPACE. Written as escapes on purpose — as literals they are invisible in a diff,
 * and one careless editor pass would silently turn this rule into a no-op.
 */
const NON_BREAKING = /[\u00a0\u202f\u2009]/g;

/**
 * `"HUF"` → `"Ft"`, `"EUR"` → `"€"`, anything else → itself.
 *
 * Pass-through is not laziness: a value that is ALREADY a sign ("Ft", "€") or an
 * unknown ISO code ("RON") must print as given. Writing "Ft" on a RON amount —
 * which five call sites did before this — is worse than printing the code.
 */
export function currencySign(currency: string | null | undefined): string {
  const c = String(currency ?? "").trim();
  if (!c) return "";
  return CURRENCY_SIGN[c.toUpperCase()] ?? c;
}

/** Hungarian grouping, done as a string transform so no locale data can change it. */
function groupHu(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * The grouped number ALONE: `99900` → `"99 900"`.
 *
 * For sentences that carry their own unit ("{price} Ft/hó" in the cold letter,
 * "…·  4 880 Ft" in an operator log). Those are not a loophole — the unit is part
 * of the sentence there, not of the amount — but the GROUPING still has to come
 * from one place, or the same number reads differently one line apart.
 */
export function formatNumber(amount: number | null | undefined, lang = "hu"): string {
  if (amount == null || typeof amount !== "number" || !Number.isFinite(amount)) return "";
  const n = Math.round(amount);
  if (!lang || lang === "hu") return groupHu(n);
  try {
    return new Intl.NumberFormat(lang, { maximumFractionDigits: 0 })
      .format(n)
      .replace(NON_BREAKING, " ");
  } catch {
    return groupHu(n);
  }
}

/**
 * The amount as its reader writes it: `formatMoney(99900, "HUF")` → `"99 900 Ft"`,
 * `formatMoney(10, "EUR")` → `"10 €"`, `formatMoney(50, "RON")` → `"50 RON"`.
 *
 * ⭐ Only the HUNGARIAN reader gets "Ft". For any other language pack the amount
 * goes through Intl, so a German reads "99.900 HUF" and an Englishman "HUF 99,900"
 * — that is not the defect this file fixes coming back, it is the opposite one:
 * "Ft" is the Hungarian DOMESTIC sign, and printing it to a reader who has never
 * seen it would be the machine's form all over again, just in the other direction.
 *
 * Empty amount → empty string, never "NaN Ft": a missing number must not be able
 * to render as a price the customer could believe.
 */
export function formatMoney(
  amount: number | null | undefined,
  currency: string | null | undefined,
  lang = "hu",
): string {
  if (amount == null || typeof amount !== "number" || !Number.isFinite(amount)) return "";
  const n = Math.round(amount);
  if (lang && lang !== "hu") {
    try {
      return new Intl.NumberFormat(lang, {
        style: "currency",
        currency: String(currency ?? "").trim().toUpperCase(),
        maximumFractionDigits: 0,
      })
        .format(n)
        .replace(NON_BREAKING, " ");
    } catch {
      // Not an ISO code (or no locale data) — the Hungarian branch below still
      // prints something true, which is the whole point of falling through.
    }
  }
  const sign = currencySign(currency);
  const num = groupHu(n);
  return sign ? `${num} ${sign}` : num;
}
