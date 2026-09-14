/* AN AMOUNT OF MONEY, in the browser — the mirror of src/text/money.ts.
 *
 * WHY A SECOND COPY. The buyer's checkout reprices on every checkbox click, so the
 * server cannot hand down a finished string; the browser has to format. It cannot
 * import TypeScript, so the rule exists twice ON PURPOSE. What makes that safe is
 * not discipline — it is scripts/money-format-check.mts, which runs this file and
 * the TS module over the same matrix and fails on the first byte that differs.
 * An unmeasured second copy is exactly how the split this file closes was born:
 * measured 2026-09-14, cit-runtime.js printed the guest's quote with a NON-BREAKING
 * space while src/tenant/prices.ts printed the SAME quote with a plain one, and
 * cit-configurator.js wrote "Ft" onto every amount because the server sent it the
 * literal string "Ft" as the currency.
 *
 * Loaded by INLINING (generator/runtime.ts, generator/configurator.ts and the
 * tenant-admin views all splice their scripts into the document), so this defines
 * one global: `CitMoney`. No module system, no external fetch — a generated mock
 * is opened from file:// and out of an e-mail client too.
 */
var CitMoney = (function () {
  "use strict";

  /** The domestic sign for the currencies we price in; anything else prints its code. */
  var SIGN = { HUF: "Ft", EUR: "€" };

  /** NBSP, NARROW NBSP, THIN SPACE — none may survive into our output (see the TS twin). */
  var NON_BREAKING = /[\u00a0\u202f\u2009]/g;

  function group(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

  /** "HUF" → "Ft", "EUR" → "€", anything else (a sign already, or "RON") → itself. */
  function currencySign(currency) {
    var c = String(currency == null ? "" : currency).trim();
    if (!c) return "";
    return Object.prototype.hasOwnProperty.call(SIGN, c.toUpperCase()) ? SIGN[c.toUpperCase()] : c;
  }

  function finite(amount) {
    return typeof amount === "number" && isFinite(amount);
  }

  /** The grouped number alone: 99900 → "99 900". For sentences carrying their own unit. */
  function formatNumber(amount, lang) {
    if (!finite(amount)) return "";
    var n = Math.round(amount);
    if (!lang || lang === "hu") return group(n);
    try {
      return new Intl.NumberFormat(lang, { maximumFractionDigits: 0 })
        .format(n)
        .replace(NON_BREAKING, " ");
    } catch (e) {
      return group(n);
    }
  }

  /**
   * 99900,"HUF" → "99 900 Ft" · 10,"EUR" → "10 €" · 50,"RON" → "50 RON".
   *
   * Only the Hungarian reader gets "Ft"; other packs go through Intl, so a German
   * reads "99.900 HUF". Never throws: Intl's currency style raises on a non-ISO
   * code, and we are handed those ("Ft", "€", ""), so the Hungarian branch catches.
   */
  function formatMoney(amount, currency, lang) {
    if (!finite(amount)) return "";
    var n = Math.round(amount);
    if (lang && lang !== "hu") {
      try {
        return new Intl.NumberFormat(lang, {
          style: "currency",
          currency: String(currency == null ? "" : currency).trim().toUpperCase(),
          maximumFractionDigits: 0,
        })
          .format(n)
          .replace(NON_BREAKING, " ");
      } catch (e) {
        /* Not an ISO code — fall through to the Hungarian branch, which prints something true. */
      }
    }
    var sign = currencySign(currency);
    var num = group(n);
    return sign ? num + " " + sign : num;
  }

  return { formatMoney: formatMoney, formatNumber: formatNumber, currencySign: currencySign };
})();

/* Node (the parity guard) loads this file as a script and reads CitMoney off the
 * sandbox global; a browser gets the same binding from the var above. */
if (typeof module !== "undefined" && module.exports) module.exports = CitMoney;
