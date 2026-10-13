// The ONE amount rule for an owner-typed price (offer page, meal surcharges — ADR-XXXX).

/**
 * The amount rule of the offer page — the mock's `parseAmount`, byte for byte in
 * behaviour: thousand separators (space, dot, NBSP) and a trailing "Ft" are dropped,
 * only a positive whole number up to 10 000 000 passes.
 */
export function parseOfferAmount(raw: string): {
  value?: number;
  error?: "num" | "pos" | "big";
  empty?: boolean;
} {
  const s = String(raw ?? "").replace(/[\s.\u00a0]/g, "").replace(/ft$/i, "");
  if (s === "") return { empty: true };
  if (!/^\d+$/.test(s)) return { error: "num" };
  const n = parseInt(s, 10);
  if (!(n > 0)) return { error: "pos" };
  if (n > 10_000_000) return { error: "big" };
  return { value: n };
}
