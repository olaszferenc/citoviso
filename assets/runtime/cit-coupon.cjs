/* A KUPON-KEREKÍTÉS SZABÁLYA — EGY példányban, mindkét oldalnak.
 *
 * WHY THIS FILE EXISTS AT ALL. The rule lived twice: the browser discounted MODULE BY
 * MODULE (`Math.floor(p*FCM*(100-CPCT)/100)` per checkbox, then summed) while the server
 * discounted the TOTAL (`applyOffer(monthly*months)`). Same inputs, two results — measured
 * 2026-09-21 on live data: 1 626 Ft on the screen, 1 627 Ft on the card. `sum(floor(x_i))`
 * and `floor(sum(x_i))` are simply not the same function. It stayed hidden because the
 * park's only upsell is ANNUAL, where the two happen to coincide.
 *
 * ⛔ AND THAT IS WHY THERE IS NO TYPESCRIPT TWIN HERE. cit-money.js is a deliberate second
 * copy kept honest by a parity guard, because a FORMATTER that disagrees prints an ugly
 * string. A PRICE that disagrees charges a different amount than it promised — so this one
 * is loaded by both sides (Node: require; browser: inlined into the admin script), and the
 * predicate cannot drift because there is only one of it.
 *
 * `.cjs` on purpose: package.json says "type": "module", so a `.js` here could not be
 * require()d from the server at all. The browser gets the text spliced into a <script>,
 * where the trailing module.exports line is inert.
 */
var CitCoupon = (function () {
  "use strict";

  function int(v) {
    var n = Math.round(Number(v));
    return isFinite(n) ? n : 0;
  }

  /**
   * The discounted amount for a list price. FLOOR, so a rounding step never
   * overcharges the buyer — the house eats the fraction, not the customer.
   */
  function discount(listPrice, percent) {
    var p = Math.min(100, Math.max(0, int(percent)));
    return Math.floor((int(listPrice) * (100 - p)) / 100);
  }

  /**
   * The prorated first charge for a basket of monthly module prices.
   *
   * `total` is THE number that gets charged and THE number the screen may show: it is
   * discount() over the whole basket, so the browser's bar, the confirmation card and
   * the server's order_intent.price are the same arithmetic, not three approximations.
   *
   * `lines[i]` is what the buyer sees next to module i. They are allocated by largest
   * remainder, so THEY ADD UP TO `total` EXACTLY — otherwise the confirmation card would
   * list amounts that do not sum to its own bottom line, which is the "two divisors on
   * one row" failure in a different costume.
   */
  function splitFirstCharge(monthlyPrices, months, percent) {
    var m = Math.max(1, int(months));
    var p = Math.min(100, Math.max(0, int(percent)));
    var k = 100 - p;
    var prices = [];
    var i;
    for (i = 0; i < (monthlyPrices || []).length; i++) {
      prices.push(Math.max(0, int(monthlyPrices[i])));
    }

    var list = 0;
    for (i = 0; i < prices.length; i++) list += prices[i];
    var total = discount(list * m, p);

    var lines = [];
    var rema = [];
    var allocated = 0;
    for (i = 0; i < prices.length; i++) {
      var raw = prices[i] * m * k; // integers throughout: no float drift
      var whole = Math.floor(raw / 100);
      lines.push(whole);
      rema.push({ i: i, r: raw % 100 });
      allocated += whole;
    }
    // sum(floor) <= floor(sum) always, so the gap is non-negative and < lines.length.
    var gap = total - allocated;
    rema.sort(function (a, b) {
      return b.r - a.r || a.i - b.i; // ties go to the earlier line: deterministic
    });
    for (i = 0; i < gap && i < rema.length; i++) lines[rema[i].i] += 1;

    return { lines: lines, total: total };
  }

  return { discount: discount, splitFirstCharge: splitFirstCharge };
})();

/* Node (server + guard) requires this file; a browser gets the same binding from the var. */
if (typeof module !== "undefined" && module.exports) module.exports = CitCoupon;
