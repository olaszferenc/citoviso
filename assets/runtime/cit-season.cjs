/* A SZEZON-ILLESZTÉS SZABÁLYA — EGY példányban, mindkét oldalnak.
 *
 * WHY THIS FILE EXISTS. "Which price row applies to this night?" lived TWICE, and the
 * two copies were never compared: src/tenant/prices.ts (seasonCovers + priceOn, the
 * number that is FROZEN onto the booking request and mailed to the guest) and
 * assets/runtime/cit-runtime.js (the same two functions, the number the guest READS
 * before submitting). The money FORMATTER is also duplicated (cit-money.js), but that
 * one is deliberate and held by a parity guard — an unequal formatter prints an ugly
 * string. An unequal PRICE SELECTOR quotes a different amount than it charges, which is
 * the ADR-0193 ② harm class. So this predicate is loaded by both sides and cannot drift,
 * because there is only one of it.
 *
 * ⛔ THE GUARD IS NOT A THIRD CONSUMER. scripts/booking-price-coherence-check.mts keeps
 * its OWN re-implementation on purpose, and must keep it: an oracle that imports the
 * code under test cannot disagree with it. When this rule changes, that oracle is
 * updated INDEPENDENTLY — that separation is the whole point of it.
 *
 * ⚠️ WHAT IS DELIBERATELY ENCODED HERE, in one place, so the next change has one site:
 * a season is a RECURRING MONTH-DAY ("06-15"), with no year, so it holds every year
 * (moduleConfigViews.ts: "making them re-enter it each January would guarantee stale
 * prices"). Measured 2026-09-22: a stay in July 2027 — inside the 12-month booking
 * horizon — is quoted the SAME amount as July 2026, and that amount is frozen onto the
 * request. Year-bound rows (migration 0072: valid_from/valid_to) landed HERE, once —
 * see rowFor's precedence — instead of in two places that would silently disagree.
 *
 * `.cjs` on purpose: package.json says "type": "module", so a `.js` here could not be
 * require()d from the server at all. The browser gets the text spliced into the runtime
 * <script>, where the trailing module.exports line is inert.
 */
var CitSeason = (function () {
  /* Does a recurring 'MM-DD' range cover this month-day? Handles the year-end wrap
   * (a "Téli szünet 12-20 – 01-05" range runs December → January). */
  function covers(from, to, monthDay) {
    if (!from || !to || !monthDay) return false;
    return from <= to
      ? monthDay >= from && monthDay <= to
      : monthDay >= from || monthDay <= to;
  }

  /* 'YYYY-MM-DD' (or a full ISO stamp) → 'MM-DD'. The `slice(5, 10)` assumption lived
   * in three files; it lives here now, so a year-aware rule has ONE place to change. */
  function monthDayOf(isoDate) {
    return String(isoDate).slice(5, 10);
  }

  /* Is a 'YYYY-MM-DD' date inside a row's YEAR-BOUND window (inclusive)? A row with
   * no window (both ends null) is timeless and always "inside". Plain string compare
   * is exact for zero-padded ISO dates. (migration 0072) */
  function inWindow(row, isoDay) {
    var a = row.validFrom, b = row.validTo;
    if (!a || !b) return true;
    return isoDay >= a && isoDay <= b;
  }

  function hasWindow(row) {
    return !!(row.validFrom && row.validTo);
  }

  /* The row in effect on a given NIGHT ('YYYY-MM-DD'), or null for an unpriced night,
   * which every caller must turn into "no quote at all" (§B.17).
   *
   * Precedence, most specific first (approved plan booking-offer, 2026-09-23):
   *   1. a YEAR-BOUND season covering the night ("Főszezon 2027" beats the recurring one)
   *   2. a recurring season covering the night
   *   3. a DATED base whose window holds the night (the offer page writes these: a price
   *      for the nights no season covers, until the owner's chosen day)
   *   4. the timeless base
   * Rows whose window does not hold the night do not exist for it. Inside each tier the
   * owner's own order decides (first wins), so an overlap resolves the way the list
   * reads top-down instead of by some hidden rule.
   *
   * `rows` is shape-agnostic on purpose — the server calls it with UnitPrice objects
   * (`isBase`/`from`/`to`/`validFrom`/`validTo`) and the browser with the JSON the
   * endpoint ships (`base`/…). `isBaseRow` tells the two apart without a second copy of
   * the selection logic.
   *
   * ⛔ The second argument used to be a MONTH-DAY. It is a full date now, because a
   * year-bound row cannot be judged from 'MM-DD' — a caller still passing '07-10' would
   * silently skip every dated row, so a short argument is refused loudly. */
  function rowFor(rows, isoDay, isBaseRow) {
    if (!rows || !rows.length) return null;
    if (String(isoDay).length < 10) throw new Error("CitSeason.rowFor: full YYYY-MM-DD date required, got " + isoDay);
    var day = String(isoDay).slice(0, 10);
    var md = monthDayOf(day);
    var yearSeason = null, season = null, datedBase = null, base = null;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!inWindow(r, day)) continue;
      if (isBaseRow(r)) {
        if (hasWindow(r)) { if (!datedBase) datedBase = r; }
        else if (!base) base = r;
        continue;
      }
      if (!covers(r.from, r.to, md)) continue;
      if (hasWindow(r)) { if (!yearSeason) yearSeason = r; }
      else if (!season) season = r;
    }
    return yearSeason || season || datedBase || base;
  }

  return { covers: covers, monthDayOf: monthDayOf, inWindow: inWindow, rowFor: rowFor };
})();

/* Node (server) requires this file; a browser gets the same binding from the var. */
if (typeof module !== "undefined" && module.exports) module.exports = CitSeason;
