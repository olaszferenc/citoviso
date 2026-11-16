// The ONE amount rule for an owner-typed price (offer page, meal surcharges — ADR-0378).
import { currencySign, minorDigits } from "../text/money.js";

/**
 * The amount rule of the offer page — the mock's `parseAmount`, byte for byte in
 * behaviour: thousand separators (space, dot, NBSP) and a trailing "Ft" are dropped,
 * only a positive whole number up to 10 000 000 passes.
 */
export function parseOfferAmount(
  raw: string,
  /** ADR-0452: the site's currency. Absent or one without a minor unit (HUF) = the rule
   *  above, unchanged. A currency with one (EUR, RON, CZK …) also takes its decimals. */
  currency?: string | null,
): {
  value?: number;
  error?: "num" | "pos" | "big";
  empty?: boolean;
} {
  const digits = currency ? (minorDigits(currency) ?? 0) : 0;
  if (digits > 0) return parseDecimalAmount(raw, currency!, digits);
  const s = String(raw ?? "").replace(/[\s.\u00a0]/g, "").replace(/ft$/i, "");
  if (s === "") return { empty: true };
  if (!/^\d+$/.test(s)) return { error: "num" };
  const n = parseInt(s, 10);
  if (!(n > 0)) return { error: "pos" };
  if (n > 10_000_000) return { error: "big" };
  return { value: n };
}


/**
 * ADR-0452 (tulaj 2026-11-16: tizedes szobaár): an owner-typed amount in a currency WITH a
 * minor unit — "45,50", "45.50 €", "1 890 Kč", "1.890,5". A trailing ",d"/".d" of up to the
 * currency's digits is the fraction; any other dot/comma/space is a group separator; the
 * currency's code and sign are dropped. More decimals than the currency has = "num".
 */
function parseDecimalAmount(raw: string, currency: string, digits: number): { value?: number; error?: "num" | "pos" | "big"; empty?: boolean } {
  const marks = [currency, currencySign(currency), "€", "Kč", "zł", "lei"]
    .filter(Boolean)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  let s = String(raw ?? "").replace(new RegExp(marks.join("|"), "gi"), "").replace(/[\s  ']/g, "");
  if (s === "") return { empty: true };
  let frac = "";
  const m = new RegExp(`[.,](\\d{1,${digits}})$`).exec(s);
  if (m) {
    frac = m[1]!;
    s = s.slice(0, m.index);
  }
  s = s.replace(/[.,](?=\d{3}(?:[.,]|$))/g, "");
  if (!/^\d+$/.test(s)) return { error: "num" };
  const n = Number(frac ? `${s}.${frac}` : s);
  if (!(n > 0)) return { error: "pos" };
  if (n > 10_000_000) return { error: "big" };
  return { value: n };
}

/**
 * The `*_exact` column value for an amount (0138): the amount itself when it has a fraction,
 * else NULL — so a whole amount (every forint) writes exactly the row it always did.
 * Rounded to 4 places (the column's scale) so a float sum (0.1 + 0.2) never leaks noise.
 */
export function exactCol(amount: number | null | undefined): string | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  const r = Math.round(amount * 10_000) / 10_000;
  return Number.isInteger(r) ? null : String(r);
}

/** An amount read back: the exact twin when present, else the integer column. */
export function readExact(whole: number, exact: string | number | null | undefined): number;
export function readExact(whole: number | null, exact: string | number | null | undefined): number | null;
export function readExact(whole: number | null, exact: string | number | null | undefined): number | null {
  if (exact != null && exact !== "" && Number.isFinite(Number(exact))) return Number(exact);
  return whole;
}

/** The integer column value for an amount: half away from zero (the old Math.round for positives). */
export function wholeCol(amount: number): number {
  return Math.round(amount);
}
