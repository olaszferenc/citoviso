/* Citoviso module runtime (UI-CONTRACT §B, ADR-0011). Framework-free.
 *
 * Hydrates module slots regardless of the archetype's markup:
 *   <section data-cit-module="booking" data-cit-variant="bar|card"
 *            data-cit-name="Villa Salve" data-cit-email="info@...">…</section>
 *
 * One runtime, one behaviour per module type (registry). The slot markup is
 * authored per-archetype (LLM, in-skin); the runtime attaches behaviour + (for
 * complex modules like booking) renders a token-themed widget into the slot.
 * Behaviour is written ONCE and works in every archetype — the O(modul), not
 * O(archetípus × modul) principle. See _planning/DOMAIN/06-UI-CONTRACT.md.
 *
 * Honesty (mock stage): the booking widget composes an ENQUIRY / booking-request
 * (dates + guests + message) — it never claims live availability, price, or
 * payment. Live booking = post-conversion (Level 4).
 */
(function () {
  "use strict";

  /* DEV slug-path base (/t/<slug>, public.ts DEV_SLUG_PATH): the live widget's
   * absolute /api calls miss the tenant context there — measured 2026-09-06, the
   * guest booking flow was untestable locally (the demo path masked it). On the
   * real tenant host the match is empty and NOTHING changes. */
  var API_BASE = (location.pathname.match(/^\/t\/[^/]+/) || [""])[0];

  /* ADR-0036: buyer-facing strings resolve through the server-injected pack
   * (window.CIT_I18N). Hungarian pages carry no map → tr() is identity. */
  function tr(s) { var m = window.CIT_I18N; return (m && m[s]) || s; }

  var SVG_CAL =
    '<svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/></svg>';
  var SVG_X =
    '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
    '<path d="M6 6l12 12M18 6L6 18"/></svg>';
  var SVG_CHEV =
    '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M15 5l-7 7 7 7"/></svg>';
  var SVG_CHECK =
    '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
    'aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7"/></svg>';
  var SVG_PIN =
    '<svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/></svg>';

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function todayISO() {
    var d = new Date();
    return d.toISOString().slice(0, 10);
  }

  /**
   * Page scroll lock, shared by every overlay.
   *
   * Overlays STACK: the room popover opens the full-size viewer on top of itself. Each
   * one clearing the lock on its own way out handed scrolling back to a page the guest
   * still could not reach — so the lock asks the DOM who is up, not who just left.
   */
  function syncScrollLock() {
    var up = document.querySelector(".cit-lb[data-open], .cit-rd[data-open]");
    document.documentElement.style.overflow = up ? "hidden" : "";
  }

  var registry = {};

  /** Register a module handler: fn(slot) mounts behaviour/UI into the slot. */
  function register(type, fn) {
    registry[type] = fn;
  }

  // ── real BOOKING request (ADR-0044) ─────────────────────────────────────────
  // Mounted only when the owner bought the booking module; the same slot otherwise
  // carries the enquiry CTA ("ha van foglalás, akkor nincs érdeklődés").
  //
  // Free days are FETCHED, never baked into the page: the live site is a static
  // snapshot, so an inlined calendar would keep offering nights already gone.
  // We deliberately do NOT ship a custom date-picker: native <input type="date">
  // gives every phone its own familiar picker, and the taken-night check runs on
  // change with a plain sentence. A bespoke calendar would be more to learn and
  // more to break, for no gain to a guest who just wants two dates.
  function mountRequest(slot) {
    var units = [];
    try {
      units = JSON.parse(slot.getAttribute("data-cit-units") || "[]");
    } catch (e) {
      units = [];
    }
    if (!units.length) return;
    // ADR-0059 ④ — DEMO mode on the mock: the SAME widget, clickable end to end,
    // but it never fetches availability and never submits anywhere. A module the
    // lead cannot try is a module we cannot sell (ADR-0015); a demo that quietly
    // POSTs is worse (§B.17) — so the sample state is explicit (MINTA ribbon).
    var demo = slot.hasAttribute("data-cit-demo");
    var minN = Number(slot.getAttribute("data-cit-min-nights") || 1);
    var maxN = Number(slot.getAttribute("data-cit-max-nights") || 30);
    var horizon = Number(slot.getAttribute("data-cit-horizon") || 12);
    var leadDays = Number(slot.getAttribute("data-cit-lead-days") || 0);
    var ownerNote = slot.getAttribute("data-cit-note") || "";
    /* ⛔ KONTRAKTUS ④ (design-refs/tenant-site/booking-price-clarity, tulaj 2026-09-14):
     * az idegenforgalmi adót és azt, hogy mi van az árban, a SZÁLLÁSADÓ adja meg.
     * Hiányzó attribútum → 0 / üres → a lap NEM SZÁMOL összeget, csak kimondja, hogy a
     * helyszínen IFA fizetendő. Kitalált szám sehol (§B.17). */
    /* ⛔ HÁROM ÁLLAPOT (KB-őr FLAG, 2026-09-14): az attribútum HIÁNYA azt jelenti,
     * hogy nem tudjuk; a "0" azt, hogy a szállásadó KIMONDTA, hogy nincs IFA. A kettő
     * összemosása azt eredményezte, hogy egy IFA-mentes szállás lapja is azt állította
     * — kikapcsolhatatlanul —, hogy a helyszínen idegenforgalmi adó fizetendő. */
    var ifaRaw = slot.getAttribute("data-cit-ifa");
    var ifaDeclared = ifaRaw !== null && ifaRaw !== "";
    var ifaPerPersonNight = ifaDeclared ? Number(ifaRaw) || 0 : 0;
    var priceIncludes = slot.getAttribute("data-cit-includes") || "";
    var hostEmail = slot.getAttribute("data-cit-email") || "";
    var hostPhone = slot.getAttribute("data-cit-phone") || "";

    function shift(iso, days) {
      var d = new Date(iso + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0, 10);
    }
    var earliest = shift(todayISO(), leadDays);
    var latest = (function () {
      var d = new Date(todayISO() + "T00:00:00Z");
      d.setUTCMonth(d.getUTCMonth() + horizon);
      return d.toISOString().slice(0, 10);
    })();

    var unitPicker = units.length > 1
      ? '<div class="cit-book__field"><label class="cit-book__label" for="cit-unit">' +
        tr("Melyiket foglalná?") + "</label>" +
        '<select class="cit-book__input" id="cit-unit" name="unit">' +
        units.map(function (u) {
          return '<option value="' + esc(u.id) + '">' + esc(u.name) +
            (u.capacity ? " · " + u.capacity + " " + tr("fő") : "") + "</option>";
        }).join("") +
        "</select></div>"
      : '<input type="hidden" name="unit" value="' + esc(units[0].id) + '">';

    // ── LAYOUT (owner decree 2026-08-23: "milyen gagyi az elrendezése") ────────
    // Two columns where there is room: the CALENDAR leads on the left (it is the
    // reason this module sells — the guest sees free nights at a glance), and a
    // compact request panel sits on the right. The date inputs are no longer two
    // fat native fields fighting the calendar for attention: they are a slim
    // summary strip UNDER the calendar (still real <input type=date>, so the
    // keyboard/screen-reader path and the OS picker survive), and the picked range
    // is what the strip shows. Everything is one card, no floating islands.
    var form = document.createElement("form");
    form.className = "cit-book cit-book--request";
    form.setAttribute("novalidate", "");
    form.innerHTML =
      '<p class="cit-book__title">' + SVG_CAL + "<span>" + tr("Foglalás") + "</span>" +
      (demo ? '<span class="cit-book__demo">' + tr("MINTA — kipróbálható") + "</span>" : "") +
      "</p>" +
      '<div class="cit-book__cols">' +
      '<div class="cit-book__calcol">' +
      '<div class="cit-book__cal"></div>' +
      '<div class="cit-book__dates">' +
      '<label class="cit-book__date"><span class="cit-book__label">' + tr("Érkezés") + "</span>" +
      '<input class="cit-book__dinput" type="date" id="cit-from" name="from" min="' +
      earliest + '" max="' + latest + '"></label>' +
      '<span class="cit-book__arrow" aria-hidden="true">→</span>' +
      '<label class="cit-book__date"><span class="cit-book__label">' + tr("Távozás") + "</span>" +
      '<input class="cit-book__dinput" type="date" id="cit-to" name="to" min="' +
      earliest + '" max="' + latest + '"></label>' +
      '<span class="cit-book__nights" data-nights></span>' +
      '<div class="cit-book__quote" data-quote></div>' +
      "</div>" +
      // Three facts about the PROCESS (never a claim about the property, §B.17):
      // they answer the guest's real hesitation at the decision point, and they are
      // the module's own sales argument — direct booking, no platform commission.
      '<ul class="cit-book__trust">' +
      [
        tr("Közvetlenül a szállásadónál — nincs közvetítői jutalék"),
        tr("A szállásadó személyesen igazolja vissza"),
        tr("Fizetés a helyszínen"),
      ]
        .map(function (t) { return "<li>" + SVG_CHECK + "<span>" + t + "</span></li>"; })
        .join("") +
      "</ul></div>" +
      '<div class="cit-book__formcol"><div class="cit-book__fields">' +
      unitPicker +
      '<div class="cit-book__field"><label class="cit-book__label">' + tr("Vendégek") + "</label>" +
      '<div class="cit-book__stepper" role="group" aria-label="' + tr("Vendégek száma") + '">' +
      '<button class="cit-book__step" type="button" data-step="-1" aria-label="' + tr("kevesebb") + '">−</button>' +
      '<span class="cit-book__count" data-guests>2</span>' +
      '<button class="cit-book__step" type="button" data-step="1" aria-label="' + tr("több") + '">+</button>' +
      "</div></div>" +
      '<div class="cit-book__field"><label class="cit-book__label" for="cit-name">' + tr("Az Ön neve") +
      '</label><input class="cit-book__input" id="cit-name" name="name" autocomplete="name"></div>' +
      '<div class="cit-book__field"><label class="cit-book__label" for="cit-email">' + tr("E-mail cím") +
      '</label><input class="cit-book__input" id="cit-email" name="email" type="email" autocomplete="email"></div>' +
      '<div class="cit-book__field"><label class="cit-book__label" for="cit-phone">' + tr("Telefon") +
      '</label><input class="cit-book__input" id="cit-phone" name="phone" type="tel" autocomplete="tel"></div>' +
      '<div class="cit-book__field"><label class="cit-book__label" for="cit-msg">' +
      tr("Üzenet (nem kötelező)") + '</label><textarea class="cit-book__input" id="cit-msg" name="message" rows="2"></textarea></div>' +
      "</div>" +
      '<button class="cit-book__submit" type="submit">' + tr("Foglalási kérés elküldése") + "</button>" +
      '<p class="cit-book__note">' +
      (demo
        ? tr("Minta — nyugodtan próbálja ki, innen semmi nem kerül elküldésre. Az éles oldalon a kérés közvetlenül a szállásadóhoz érkezik.")
        : tr("A foglalás akkor válik véglegessé, ha a szállásadó visszaigazolja. A fizetés a helyszínen történik.") +
          (ownerNote ? " " + esc(ownerNote) : "")) +
      "</p>" +
      // ADR-0110 ⑤: a SENTENCE, not a tick-box. The legal basis of a booking enquiry
      // is preparing a contract (GDPR 6(1)(b)); an "I accept" box would state consent,
      // which is the wrong basis and cannot be withdrawn without killing the booking.
      // Omitted on the mock: a cold lead has no legal pages to link to (ADR-0110 ⑦).
      (demo
        ? ""
        : '<p class="cit-book__note cit-book__note--legal">' +
          tr("A megadott adatait a kérés megválaszolására használjuk.") +
          ' <a href="/adatvedelem">' + tr("Adatkezelési tájékoztató") + "</a></p>") +
      "</div></div>";

    slot.textContent = "";
    slot.appendChild(form);

    var note = form.querySelector(".cit-book__note");
    var baseNote = note.innerHTML;
    var submit = form.querySelector(".cit-book__submit");
    var countEl = form.querySelector("[data-guests]");
    var guests = 2;
    var blocked = {};
    var pricing = null; // {currency, unit, rows} — live price list from the availability API

    form.querySelectorAll(".cit-book__step").forEach(function (btn) {
      btn.addEventListener("click", function () {
        guests = Math.min(20, Math.max(1, guests + Number(btn.getAttribute("data-step"))));
        countEl.textContent = String(guests);
        // per_person_night pricing: the total follows the guest count live
        var qa = form.from.value, qb = form.to.value;
        renderQuote(qa, qb, qa && qb ? nights(qa, qb) : 0);
      });
    });

    /* Stay price at booking time (owner decree 2026-09-06): seasonal row wins per
     * night, else base; ANY unpriced night → no quote at all (§B.17: better no
     * number than a wrong one). Mirrors the server's quoteStayFrom — the server
     * recomputes and FREEZES the quote at submit; this is the guest's preview. */
    /* ⛔ `seasonCovers` used to live here as a SECOND implementation of the rule that
     * decides which price row a night falls under — the server had its own, and
     * nothing compared them. It is now cit-season.cjs, require()d by the server and
     * inlined above for the browser, so what the guest READS and what gets FROZEN
     * onto the request are the same bytes. The local wrapper is gone rather than
     * kept as a one-line forwarder: a function nobody calls reads as a live path.
     */
    /* ⛔ This used to group with a NON-BREAKING space and print "Ft" for anything
     * that was not EUR — while the SERVER rendered the very same quote through
     * src/tenant/prices.ts with a plain space (measured 2026-09-14). One rule now,
     * and scripts/money-format-check.mts proves this copy equals the TS one. */
    function money(amount, currency) {
      return CitMoney.formatMoney(amount, currency, document.documentElement.lang || "hu");
    }
    function quoteFor(a, b) {
      if (!pricing || !pricing.rows || !pricing.rows.length) return null;
      var lines = [], d = new Date(a + "T00:00:00Z"), end = Date.parse(b + "T00:00:00Z");
      var guests = pricing.unit === "per_person_night"
        ? Math.max(1, Number((form.querySelector("[data-guests]") || {}).textContent || form.guests && form.guests.value || 1))
        : 1;
      while (d.getTime() < end) {
        /* Row selection is shared too, not just the range test: "which row wins
         * tonight" is the question that would let the screen and the invoice
         * disagree. The endpoint ships `base`; the server calls the same helper
         * with its own `isBase`. */
        var md = CitSeason.monthDayOf(d.toISOString());
        var hit = CitSeason.rowFor(pricing.rows, md, function (r) { return !!r.base; });
        if (!hit) return null;
        var last = lines[lines.length - 1];
        var label = hit.base ? tr("Alapár") : hit.label;
        if (last && last.label === label && last.per === hit.amount) last.n++;
        else lines.push({ label: label, per: hit.amount, n: 1 });
        d.setUTCDate(d.getUTCDate() + 1);
      }
      if (pricing.unit === "per_stay") {
        return { total: lines[0].per, lines: [], perStay: true };
      }
      var total = 0;
      lines.forEach(function (l) { l.sum = l.per * l.n * guests; l.guests = guests; total += l.sum; });
      return { total: total, lines: lines, perStay: false };
    }
    function renderQuote(a, b, n) {
      var el = form.querySelector("[data-quote]");
      if (!el) return;
      if (!(n > 0)) { el.innerHTML = ""; return; }
      var q = quoteFor(a, b);
      if (!q) { el.innerHTML = ""; return; }
      var cur = pricing.currency;
      var rows = q.lines.map(function (l) {
        return '<span class="cit-book__qline">' + esc(l.label) + ": " +
          tr("{n} éj").replace("{n}", l.n) + " × " + money(l.per, cur) +
          (l.guests > 1 ? " × " + tr("{n} fő").replace("{n}", l.guests) : "") +
          " = " + money(l.sum, cur) + "</span>";
      }).join("");
      /* ⛔ KONTRAKTUS ①–④ (booking-price-clarity, tulaj 2026-09-14: „A — nyitott
       * bontás"). Mérve a régi lapon: az ár EGYETLEN szám volt magyarázat nélkül
       * („Összesen: 96 000 Ft"), és sehol nem derült ki, hogy az IFA vagy a takarítás
       * benne van-e. Az ALAP („a létszám nem befolyásolja") pedig CSAK a beadás UTÁNI
       * nyugtán jelent meg — vagyis a vendég azután tudta meg, hogy már elküldte.
       *
       * Amit itt kötünk: a bontás mindig nyitva · az alap a beadás ELŐTT kimondva ·
       * a helyszínen fizetendő KÜLÖN dobozban · és kitalált szám SEHOL. */
      var basis = q.perStay
        ? tr("Az ár a TELJES TARTÓZKODÁSRA szól — a létszám nem befolyásolja (jelenleg {n} fő).")
        : pricing.unit === "per_person_night"
          ? tr("Az ár SZEMÉLYENKÉNT és éjszakánként értendő — {n} fővel számolva.")
          : tr("Az ár a TELJES SZÁLLÁSRA szól éjszakánként — a létszám nem befolyásolja (jelenleg {n} fő).");
      var included = priceIncludes
        ? '<span class="cit-book__qrow"><span>' + esc(priceIncludes) + "</span><b>" +
          tr("benne van") + "</b></span>"
        : "";
      // A helyszíni tétel: ÖSSZEG csak akkor, ha a szállásadó megadta.
      // Nyilatkozott ÉS nulla → a lap nem is említi az IFA-t: az IFA-mentes szállásról
      // állítani, hogy adót szed, ugyanolyan valótlanság, mint kitalált összeget írni.
      var onSite = ifaDeclared && !ifaPerPersonNight
        ? ""
        : ifaPerPersonNight
        ? '<div class="cit-book__later"><b>' + tr("A helyszínen fizetendő ezen felül:") + "</b><br>" +
          esc(
            tr("Idegenforgalmi adó — {per} / fő / éj × {g} fő × {n} éj = {sum}")
              .replace("{per}", money(ifaPerPersonNight, cur))
              .replace("{g}", String(guests))
              .replace("{n}", String(n))
              .replace("{sum}", money(ifaPerPersonNight * guests * n, cur)),
          ) +
          "<br>" + tr("Ezt a szállásadó szedi be, nem része a szállásdíjnak.") + "</div>"
        : '<div class="cit-book__later">' +
          tr("A szállásdíjon felül a helyszínen idegenforgalmi adó fizetendő — az összegéről a szállásadó tájékoztatja.") +
          "</div>";
      el.innerHTML =
        '<span class="cit-book__qh">' + tr("Az ár") + " — " + esc(huDay(a)) + " → " + esc(huDay(b)) + "</span>" +
        rows +
        '<span class="cit-book__qbasis">' + esc(basis.replace("{n}", String(guests))) + "</span>" +
        included +
        '<span class="cit-book__qtotal">' + tr("Összesen a szállásért") + " <b>" + money(q.total, cur) + "</b></span>" +
        onSite;
    }
    /* The guest's RECEIPT after sending (Elek FK-007, 2026-09-11): the old reply was
     * one sentence — "Elküldtük a kérését. A szállásadó hamarosan visszaigazolja." —
     * for a 64 000 Ft request. No dates, no nights, no headcount, no price, no
     * reference, no word about the 48-hour clock already running on the owner's
     * side, and no mention of WHERE the answer goes. Every figure below comes from
     * the server's frozen quote (`summary`), never from a second client-side
     * computation: the receipt must show the number that is ON the request. */
    function huDay(iso) {
      return iso.slice(0, 4) + ". " + iso.slice(5, 7) + ". " + iso.slice(8, 10) + ".";
    }
    function receiptHtml(s) {
      var cur = s.currency || "HUF";
      var rows = (s.lines || []).map(function (l) {
        return '<span class="cit-book__qline">' + esc(l.label) + ": " +
          tr("{n} éj").replace("{n}", l.nights) + " × " + money(l.perNight, cur) +
          (l.guests > 1 ? " × " + tr("{n} fő").replace("{n}", l.guests) : "") +
          " = " + money(l.sum, cur) + "</span>";
      }).join("");
      var facts =
        '<span class="cit-book__rrow"><span>' + tr("Időszak") + "</span><b>" +
          esc(huDay(s.dateFrom)) + " — " + esc(huDay(s.dateTo)) + "</b></span>" +
        '<span class="cit-book__rrow"><span>' + tr("Éjszakák") + "</span><b>" +
          esc(tr("{n} éj").replace("{n}", s.nights)) + "</b></span>" +
        '<span class="cit-book__rrow"><span>' + tr("Létszám") + "</span><b>" +
          esc(tr("{n} fő").replace("{n}", s.guests)) + "</b></span>" +
        (s.unitName
          ? '<span class="cit-book__rrow"><span>' + tr("Egység") + "</span><b>" + esc(s.unitName) + "</b></span>"
          : "") +
        '<span class="cit-book__rrow"><span>' + tr("Hivatkozás") + "</span><b>" + esc(s.ref) + "</b></span>";
      // §B.17: an unpriced stay prints NO total — silence beats a confident zero.
      var total = s.total
        ? rows + '<span class="cit-book__qtotal">' + tr("Összesen:") + " <b>" + money(s.total, cur) + "</b></span>"
        : "";
      // The deadline is the module's real setting, not a hard-coded 48.
      var when = s.expireHours
        ? tr("A szállásadó legkésőbb {n} órán belül válaszol. Ha addig nem dönt, a kérés lejár, és erről is e-mailt küldünk Önnek.")
            .replace("{n}", s.expireHours)
        : tr("A szállásadó személyesen igazolja vissza. Amint döntött, azonnal e-mailt küldünk.");
      /* ⛔ KONTRAKTUS ⑤: a nyugta TEENDŐT ad, nem csak kódot — de CSAK azt ígérheti,
       * ami LÉTEZIK. Mérve a kódban (2026-09-14): állapot-lap NINCS, és a
       * `/foglalas/<token>/lemondom` link CSAK visszaigazolt foglalást mond le
       * (`cancelRequest`: status !== "accepted" → elutasít). Ezért a lemondó linket a
       * VISSZAIGAZOLÁSHOZ kötve említjük, a függő kérés visszavonására pedig a
       * szállásadó elérhetőségét adjuk — az tényleg működik. */
      var reach = hostEmail
        ? tr("írjon a szállásadónak: {email}").replace("{email}", hostEmail)
        : hostPhone
          ? tr("hívja a szállásadót: {phone}").replace("{phone}", hostPhone)
          : tr("keresse a szállásadót a honlapon megadott elérhetőségen");
      var steps =
        "<li>" + esc(when) + "</li>" +
        "<li>" +
        esc(tr("A választ erre a címre küldjük: {email}").replace("{email}", s.guestEmail)) +
        " " + tr("Ha nem érkezik meg, nézze meg a levélszemét mappát is.") + "</li>" +
        "<li>" + tr("Ha visszaigazolja, a levélben kap egy lemondó linket is — azzal bármikor lemondhatja.") + "</li>" +
        "<li>" + esc(tr("Meggondolta magát addig? Nem baj — {reach}, és visszavonja a kérést.").replace("{reach}", reach)) + "</li>";
      return '<div class="cit-book cit-book--done"><p class="cit-book__title">' + SVG_CAL +
        "<span>" + tr("Elküldtük a kérését") + "</span></p>" +
        '<p class="cit-book__note">' +
        tr("A foglalás még nem végleges — ez egy kérés, amit a szállásadónak vissza kell igazolnia.") +
        "</p>" +
        '<div class="cit-book__receipt">' + facts + total + "</div>" +
        '<p class="cit-book__steph">' + tr("Mi a következő lépés?") + "</p>" +
        '<ol class="cit-book__steps">' + steps + "</ol></div>";
    }
    /* Bring the reply the guest just earned onto the screen. Called by BOTH the live
     * and the demo branch — the demo replaces the same tall form with the same short
     * card, so it loses the guest in exactly the same way. `block:"start"` (not
     * "center"): the card's headline is the sentence that matters, and centring a
     * short card on a tall phone can still push the headline off the top. */
    function showReceipt() {
      var done = slot.querySelector(".cit-book--done");
      if (!done || !done.scrollIntoView) return;
      var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      done.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" });
      // Screen readers get the same jump: the form they were in no longer exists.
      done.setAttribute("tabindex", "-1");
      if (done.focus) done.focus({ preventScroll: true });
    }
    function currentUnit() {
      var sel = form.querySelector('[name="unit"]');
      return sel ? sel.value : units[0].id;
    }
    /** Deterministic, clearly-marked SAMPLE availability for the demo widget: a few
     *  taken ranges relative to today, different per unit so switching units visibly
     *  changes the calendar. Never a claim about the real property (the whole widget
     *  is MINTA-labelled and the legend says "minta-foglaltság"). */
    function demoBlocked(unitId) {
      var idx = 0;
      units.forEach(function (u, i) { if (u.id === unitId) idx = i; });
      var b = {};
      [[6 + idx * 3, 3], [16 + idx * 2, 2], [26, 2]].forEach(function (r) {
        for (var i = 0; i < r[1]; i++) b[shift(todayISO(), r[0] + i)] = true;
      });
      return b;
    }
    function loadAvailability() {
      blocked = {};
      if (demo) {
        blocked = demoBlocked(currentUnit());
        validate();
        renderCal();
        return;
      }
      fetch(API_BASE + "/api/foglaltsag/" + encodeURIComponent(currentUnit()), { credentials: "omit" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j || !j.blocked) return;
          j.blocked.forEach(function (d) { blocked[d] = true; });
          pricing = j.pricing || null;
          validate();
          renderCal();
        })
        .catch(function () {
          // Availability unreachable: do NOT block the guest. The owner's decision
          // is the real gate, and acceptance re-checks the nights anyway.
        });
    }
    var unitSel = form.querySelector("select[name='unit']");
    if (unitSel) unitSel.addEventListener("change", loadAvailability);

    function say(msg, bad) {
      note.innerHTML = msg ? esc(msg) : baseNote;
      note.classList.toggle("cit-book__note--err", !!bad);
    }
    function nights(a, b) {
      return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
    }
    /** Returns an owner-language problem, or "" when the range is bookable. */
    function problem() {
      var a = form.from.value, b = form.to.value;
      if (!a || !b) return "";
      var n = nights(a, b);
      if (n < 1) return tr("A távozás legyen későbbi az érkezésnél.");
      if (n < minN) return tr("Legalább {n} éjszakára lehet foglalni.").replace("{n}", minN);
      if (n > maxN) return tr("Legfeljebb {n} éjszakára lehet foglalni.").replace("{n}", maxN);
      for (var i = 0; i < n; i++) {
        if (blocked[shift(a, i)]) return tr("Sajnos ezek a napok már foglaltak. Válasszon másik időpontot.");
      }
      return "";
    }
    function validate() {
      var p = problem();
      say(p, !!p);
      submit.disabled = !!p;
      return !p;
    }
    form.from.addEventListener("change", validate);
    form.to.addEventListener("change", validate);

    // ── visible availability calendar (owner decree 2026-08-23) ───────────────
    // The guest must SEE which nights are taken per unit, not learn it from an
    // error sentence after picking. The calendar shows only the owner-managed
    // busy DATES (the endpoint sends nothing personal), and tapping two free
    // days fills the same date inputs — which stay as the accessible fallback.
    // Model unchanged: this is a REQUEST; the owner confirms every booking.
    var LANG = document.documentElement.lang || "hu";
    var calWrap = form.querySelector(".cit-book__cal");
    var nightsEl = form.querySelector("[data-nights]");
    var calBase = 0; // month offset of the left month
    var maxBase = Math.max(0, horizon - 2);

    function dowHeads() {
      // Monday-first narrow weekday letters in the page language (2026-01-05 is a Monday).
      var h = "";
      for (var i = 0; i < 7; i++) {
        var d = new Date(Date.UTC(2026, 0, 5 + i));
        h += '<span class="cit-book__dow">' +
          esc(d.toLocaleDateString(LANG, { weekday: "narrow", timeZone: "UTC" })) + "</span>";
      }
      return h;
    }
    function monthHtml(mOffset) {
      var now = new Date(todayISO() + "T00:00:00Z");
      var first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + mOffset, 1));
      var y = first.getUTCFullYear(), m = first.getUTCMonth();
      var label = first.toLocaleDateString(LANG, { year: "numeric", month: "long", timeZone: "UTC" });
      var daysIn = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      var lead = (first.getUTCDay() + 6) % 7;
      var a = form.from.value, b = form.to.value;
      var cells = "";
      for (var i = 0; i < lead; i++) cells += "<span></span>";
      for (var day = 1; day <= daysIn; day++) {
        var isoDay = y + "-" + String(m + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
        var busy = !!blocked[isoDay];
        var off = isoDay < earliest || isoDay > latest;
        var cls = "cit-book__day" +
          (busy ? " cit-book__day--busy" : "") +
          (a && isoDay === a ? " cit-book__day--sel" : "") +
          (b && isoDay === b ? " cit-book__day--sel" : "") +
          (a && b && isoDay > a && isoDay < b ? " cit-book__day--range" : "");
        cells += '<button type="button" class="' + cls + '" data-day="' + isoDay + '"' +
          (busy || off ? " disabled" : "") +
          ' aria-label="' + isoDay + (busy ? " — " + tr("foglalt") : "") + '">' + day + "</button>";
      }
      return '<div class="cit-book__month"><p class="cit-book__mlabel">' + esc(label) + "</p>" +
        '<div class="cit-book__mgrid">' + dowHeads() + cells + "</div></div>";
    }
    function renderCal() {
      calWrap.innerHTML =
        '<div class="cit-book__calhead">' +
        '<button type="button" class="cit-book__calnav" data-calnav="-1" aria-label="' + tr("Előző hónap") + '"' +
        (calBase <= 0 ? " disabled" : "") + ">" + SVG_CHEV + "</button>" +
        '<span class="cit-book__callabel">' + tr("Válassza ki az érkezés és a távozás napját") + "</span>" +
        '<button type="button" class="cit-book__calnav cit-book__calnav--next" data-calnav="1" aria-label="' + tr("Következő hónap") + '"' +
        (calBase >= maxBase ? " disabled" : "") + ">" + SVG_CHEV + "</button>" +
        "</div>" +
        '<div class="cit-book__months">' + monthHtml(calBase) + monthHtml(calBase + 1) + "</div>" +
        '<div class="cit-book__legend">' +
        '<span class="cit-book__lg cit-book__lg--free"></span>' + tr("szabad") +
        '<span class="cit-book__lg cit-book__lg--busy"></span>' + tr("foglalt") +
        (demo ? " · " + tr("minta-foglaltság") : "") +
        "</div>";
      // The nights counter turns two dates into the thing the guest actually
      // pictures ("3 éjszaka"), right where the range is shown.
      if (nightsEl) {
        var a = form.from.value, b = form.to.value;
        var n = a && b ? nights(a, b) : 0;
        nightsEl.textContent = n > 0 ? tr("{n} éjszaka").replace("{n}", n) : "";
        renderQuote(a, b, n);
      }
    }
    calWrap.addEventListener("click", function (e) {
      var nav = e.target.closest("[data-calnav]");
      if (nav && !nav.disabled) {
        calBase = Math.min(maxBase, Math.max(0, calBase + Number(nav.getAttribute("data-calnav"))));
        renderCal();
        return;
      }
      var btn = e.target.closest("[data-day]");
      if (!btn || btn.disabled) return;
      var day = btn.getAttribute("data-day");
      var a = form.from.value, b = form.to.value;
      if (!a || (a && b) || day <= a) {
        form.from.value = day;
        form.to.value = "";
      } else {
        form.to.value = day;
      }
      validate();
      renderCal();
    });
    form.from.addEventListener("change", renderCal);
    form.to.addEventListener("change", renderCal);
    renderCal();
    loadAvailability();

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!validate()) return;
      if (!form.from.value || !form.to.value) return say(tr("Adja meg az érkezés és a távozás napját."), true);
      if (demo) {
        // The full experience minus the send: the lead sees exactly what their guest
        // would see, and nothing leaves the page (no endpoint exists for it anyway).
        slot.innerHTML =
          '<div class="cit-book cit-book--done"><p class="cit-book__title">' + SVG_CAL +
          "<span>" + tr("Így néz ki, amikor a vendége foglal") + "</span></p>" +
          '<p class="cit-book__note">' +
          tr("Ez kipróbálás volt — nem küldtünk el semmit. Az éles oldalon a kérés e-mailben Önhöz érkezik, és Ön igazolja vissza.") +
          "</p></div>";
        showReceipt();
        return;
      }
      if (!form.name.value.trim()) return say(tr("Kérjük, adja meg a nevét."), true);
      if (!form.email.value.trim()) return say(tr("Kérjük, adja meg az e-mail címét."), true);
      // Phone is required (owner decree): the owner often needs to ask something
      // before confirming, and an unanswered e-mail kills the booking. The server
      // enforces the same rule — this only spares the guest a round-trip.
      if (form.phone.value.replace(/\D/g, "").length < 6) {
        return say(tr("Kérjük, adja meg a telefonszámát — a visszaigazoláshoz szükség lehet rá."), true);
      }

      submit.disabled = true;
      say(tr("Küldés…"), false);
      var body = new URLSearchParams({
        unit: currentUnit(),
        from: form.from.value,
        to: form.to.value,
        guests: String(guests),
        name: form.name.value,
        email: form.email.value,
        phone: form.phone.value,
        message: form.message.value,
      });
      fetch(API_BASE + "/api/foglalas", {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: body.toString(),
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (out) {
          if (out.ok && out.j && out.j.ok) {
            // Replace the form: the guest is done, and a lingering form invites a
            // second identical request. An older server that sends no `summary`
            // still gets a working (if terse) reply — never a blank slot.
            slot.innerHTML = out.j.summary
              ? receiptHtml(out.j.summary)
              : '<div class="cit-book cit-book--done"><p class="cit-book__title">' + SVG_CAL +
                "<span>" + tr("Elküldtük a kérését") + "</span></p>" +
                '<p class="cit-book__note">' +
                tr("A szállásadó személyesen igazolja vissza. Amint döntött, azonnal e-mailt küldünk.") +
                "</p></div>";
            // ⛔ MÉRVE (B8, 2026-09-14): the receipt REPLACES a tall form with a short
            // card, so everything above it moves up while the scroll position stays —
            // on a page that has anything under the booking card (every real site has a
            // footer) the receipt landed 678 px ABOVE the viewport at 390 px, 35 px at
            // 1280 px. The guest paid attention, pressed send, and saw the next section:
            // no confirmation, no error, nothing. A short test page hides this, because
            // the document shrinks and the browser CLAMPS the scroll back into view.
            showReceipt();
            return;
          }
          submit.disabled = false;
          var errs = out.j && out.j.errors && out.j.errors.length ? out.j.errors[0] : tr("Nem sikerült elküldeni. Kérjük, próbálja újra.");
          say(errs, true);
        })
        .catch(function () {
          submit.disabled = false;
          say(tr("Nem sikerült elküldeni. Kérjük, próbálja újra."), true);
        });
    });
  }

  // ── booking / enquiry module ────────────────────────────────────────────────
  register("booking", function mountBooking(slot) {
    // ADR-0062: the slim jump-band stays static — the full widget lives in #cit-booking.
    if (slot.getAttribute("data-cit-variant") === "cta") return;
    if (slot.getAttribute("data-cit-variant") === "request") return mountRequest(slot);
    // Approved contract (owner "B", 2026-09-08 — design-refs/tenant-site/enquiry-card):
    // compact start (dates + guests), the contact block opens after a valid date
    // pair, submit is a REAL server call (POST /api/erdeklodes) — never mailto
    // (measured dead end: no mail client, no contact data collected).
    var variant = slot.getAttribute("data-cit-variant") === "bar" ? "bar" : "card";
    var title = slot.getAttribute("data-cit-title") || tr("Foglalási igény");
    var demo = slot.getAttribute("data-cit-demo") === "1";

    var form = document.createElement("form");
    form.className = "cit-book cit-book--" + variant;
    form.setAttribute("novalidate", "");
    form.innerHTML =
      '<p class="cit-book__title">' + SVG_CAL + "<span>" + esc(title) + "</span></p>" +
      '<div class="cit-book__fields">' +
      '<div class="cit-book__field"><label class="cit-book__label">' + tr("Érkezés") + "</label>" +
      '<input class="cit-book__input" type="date" name="checkin" min="' + todayISO() + '"></div>' +
      '<div class="cit-book__field"><label class="cit-book__label">' + tr("Távozás") + "</label>" +
      '<input class="cit-book__input" type="date" name="checkout" min="' + todayISO() + '"></div>' +
      '<div class="cit-book__field"><label class="cit-book__label">' + tr("Vendégek") + "</label>" +
      '<div class="cit-book__stepper" role="group" aria-label="' + tr("Vendégek száma") + '">' +
      '<button class="cit-book__step" type="button" data-step="-1" aria-label="' + tr("kevesebb") + '">−</button>' +
      '<span class="cit-book__count" data-guests>2</span>' +
      '<button class="cit-book__step" type="button" data-step="1" aria-label="' + tr("több") + '">+</button>' +
      "</div></div></div>" +
      '<div class="cit-book__fields" data-contact hidden>' +
      '<div class="cit-book__field"><label class="cit-book__label">' + tr("Az Ön neve") + "</label>" +
      '<input class="cit-book__input" type="text" name="name" autocomplete="name"></div>' +
      '<div class="cit-book__field"><label class="cit-book__label">' + tr("E-mail cím") + "</label>" +
      '<input class="cit-book__input" type="email" name="email" autocomplete="email"></div>' +
      '<div class="cit-book__field"><label class="cit-book__label">' + tr("Telefon (e-mail helyett is jó)") + "</label>" +
      '<input class="cit-book__input" type="tel" name="phone" autocomplete="tel"></div>' +
      "</div>" +
      '<button class="cit-book__submit" type="submit">' + tr("Érdeklődés küldése") + "</button>" +
      '<p class="cit-book__note">' + tr("Előzetes érdeklődés — nem végleges foglalás. A szállásadó hamarosan válaszol Önnek.") + "</p>" +
      // The legal line lives OUTSIDE the status note: the status text replaces the
      // note on every step, and the data-use sentence must not vanish exactly when
      // the guest is asked for personal data (ADR-0110).
      '<p class="cit-book__note cit-book__note--legal">' + tr("A megadott adatait a kérés megválaszolására használjuk.") +
      ' <a href="' + API_BASE + '/adatvedelem">' + tr("Adatkezelési tájékoztató") + "</a></p>";

    // keep any author-provided fallback markup out; replace slot contents
    slot.textContent = "";
    slot.appendChild(form);

    var countEl = form.querySelector("[data-guests]");
    var note = form.querySelector(".cit-book__note");
    var noteHome = note.innerHTML;
    var contact = form.querySelector("[data-contact]");
    var submit = form.querySelector(".cit-book__submit");
    var guests = 2;

    function say(msg, isErr) {
      note.classList.toggle("cit-book__note--err", !!isErr);
      if (msg === null) note.innerHTML = noteHome;
      else note.textContent = msg;
    }

    form.querySelectorAll(".cit-book__step").forEach(function (btn) {
      btn.addEventListener("click", function () {
        guests = Math.min(20, Math.max(1, guests + Number(btn.getAttribute("data-step"))));
        countEl.textContent = String(guests);
      });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ci = form.checkin.value;
      var co = form.checkout.value;
      if (!ci) return say(tr("Adja meg az érkezés napját."), true);
      if (!co) return say(tr("Adja meg a távozás napját."), true);
      if (co <= ci) return say(tr("A távozás legyen későbbi az érkezésnél."), true);
      if (contact.hidden) {
        // Contract step 1: valid dates first, then the card asks who to answer.
        contact.hidden = false;
        say(tr("Már csak az elérhetősége hiányzik, hogy a szállásadó válaszolni tudjon."), false);
        form.name.focus();
        return;
      }
      if (!form.name.value.trim()) return say(tr("Kérjük, adja meg a nevét."), true);
      var em = form.email.value.trim();
      var ph = form.phone.value.replace(/\D/g, "");
      if (!em && !ph) {
        return say(tr("Adjon meg e-mail címet vagy telefonszámot — enélkül a szállásadó nem tud válaszolni."), true);
      }
      if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) {
        return say(tr("Kérjük, adjon meg egy érvényes e-mail címet."), true);
      }
      if (!em && ph.length < 8) return say(tr("A telefonszám túl rövid."), true);

      function done(titleText, noteText) {
        slot.innerHTML =
          '<div class="cit-book cit-book--' + variant + ' cit-book--done"><p class="cit-book__title">' + SVG_CAL +
          "<span>" + titleText + "</span></p>" +
          '<p class="cit-book__note">' + noteText + "</p></div>";
      }
      if (demo) {
        // Mock / tenant preview: the full experience minus the send.
        done(
          tr("Így néz ki, amikor a vendége érdeklődik"),
          tr("Ez kipróbálás volt — nem küldtünk el semmit. Az éles oldalon az érdeklődés e-mailben Önhöz érkezik, és Ön válaszol a vendégnek.")
        );
        return;
      }
      submit.disabled = true;
      say(tr("Küldés…"), false);
      var body = new URLSearchParams({
        from: ci,
        to: co,
        guests: String(guests),
        name: form.name.value,
        email: form.email.value,
        phone: form.phone.value,
      });
      fetch(API_BASE + "/api/erdeklodes", {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: body.toString(),
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (out) {
          if (out.ok && out.j && out.j.ok) {
            done(
              tr("Köszönjük! Az érdeklődését elküldtük a szállásadónak"),
              tr("A szállásadó a megadott elérhetőségén jelentkezik — jellemzően még aznap.")
            );
            return;
          }
          submit.disabled = false;
          var errs = out.j && out.j.errors && out.j.errors.length ? out.j.errors[0] : tr("Nem sikerült elküldeni. Kérjük, próbálja újra.");
          say(errs, true);
        })
        .catch(function () {
          submit.disabled = false;
          say(tr("Nem sikerült elküldeni. Kérjük, próbálja újra."), true);
        });
    });
  });

  // ── per-room price switcher (owner decree 2026-08-23) ───────────────────────
  // With several rooms a stacked list of price tables asks the guest to hunt for
  // the one they care about. The runtime turns the room names into tabs and shows
  // one table at a time. Progressive enhancement: without JS every block stays
  // visible under its heading, so no price is ever hidden behind a script.
  register("pricing", function mountPricing(slot) {
    var wrap = slot.querySelector(".cit-price");
    if (!wrap || wrap.querySelector(".cit-price__tabs")) return;
    var units = [].slice.call(wrap.querySelectorAll(".cit-price__unit"));
    if (units.length < 2) return; // one room needs no switcher

    var tabs = document.createElement("div");
    tabs.className = "cit-price__tabs";
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", tr("Válasszon szobát"));

    function select(i) {
      units.forEach(function (u, idx) { u.hidden = idx !== i; });
      [].slice.call(tabs.children).forEach(function (b, idx) {
        b.setAttribute("aria-selected", idx === i ? "true" : "false");
        b.tabIndex = idx === i ? 0 : -1;
      });
    }

    units.forEach(function (u, i) {
      var name = u.getAttribute("data-cit-unit") ||
        (u.querySelector(".cit-price__name") || {}).textContent || String(i + 1);
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cit-price__tab";
      b.setAttribute("role", "tab");
      b.textContent = name;
      b.addEventListener("click", function () { select(i); });
      b.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        var next = (i + (e.key === "ArrowRight" ? 1 : units.length - 1)) % units.length;
        select(next);
        tabs.children[next].focus();
      });
      tabs.appendChild(b);
    });

    wrap.classList.add("cit-price--tabbed");
    wrap.insertBefore(tabs, wrap.firstChild);
    select(0);
  });

  // ── gallery lightbox module ─────────────────────────────────────────────────
  // Progressive enhancement (UI-CONTRACT §B): the gallery markup is authored
  // in-skin by the generator (real photos in a mosaic/bento/carousel). The slot
  // carries data-cit-module="gallery"; this handler ATTACHES a lightbox on top of
  // the existing <img>s — it never replaces content, so the photos stay visible
  // without JS (no empty band). One shared overlay serves every gallery on the
  // page. Honesty: it only magnifies the real photos already present.
  var lb = null; // singleton overlay, lazily built on first open

  function ensureLightbox() {
    if (lb) return lb;
    var root = document.createElement("div");
    root.className = "cit-lb";
    root.setAttribute("aria-hidden", "true");
    root.innerHTML =
      '<div class="cit-lb__scrim" data-lb="close"></div>' +
      '<button class="cit-lb__btn cit-lb__btn--close" type="button" data-lb="close" aria-label="' + tr("Bezárás") + '">' + SVG_X + "</button>" +
      '<button class="cit-lb__btn cit-lb__btn--prev" type="button" data-lb="prev" aria-label="' + tr("Előző kép") + '">' + SVG_CHEV + "</button>" +
      '<button class="cit-lb__btn cit-lb__btn--next" type="button" data-lb="next" aria-label="' + tr("Következő kép") + '">' + SVG_CHEV + "</button>" +
      '<figure class="cit-lb__stage" role="dialog" aria-modal="true" aria-label="' + tr("Galéria — nagyított kép") + '">' +
      '<img class="cit-lb__img" alt="">' +
      '<figcaption class="cit-lb__cap"></figcaption>' +
      "</figure>" +
      '<span class="cit-lb__count" aria-hidden="true"></span>';
    document.body.appendChild(root);

    var imgEl = root.querySelector(".cit-lb__img");
    var capEl = root.querySelector(".cit-lb__cap");
    var countEl = root.querySelector(".cit-lb__count");
    var state = { items: [], i: 0, opener: null };

    function show() {
      var it = state.items[state.i];
      if (!it) return;
      imgEl.src = it.src;
      imgEl.alt = it.alt;
      capEl.textContent = it.alt;
      capEl.style.display = it.alt ? "" : "none";
      countEl.textContent = state.i + 1 + " / " + state.items.length;
      var many = state.items.length > 1;
      root.querySelector(".cit-lb__btn--prev").style.display = many ? "" : "none";
      root.querySelector(".cit-lb__btn--next").style.display = many ? "" : "none";
      countEl.style.display = many ? "" : "none";
    }
    function open(items, i, opener) {
      state.items = items;
      state.i = i;
      state.opener = opener || null;
      show();
      root.setAttribute("data-open", "");
      root.setAttribute("aria-hidden", "false");
      syncScrollLock();
      root.querySelector(".cit-lb__btn--close").focus();
    }
    function close() {
      root.removeAttribute("data-open");
      root.setAttribute("aria-hidden", "true");
      syncScrollLock();
      imgEl.src = "";
      if (state.opener && state.opener.focus) state.opener.focus();
    }
    function step(d) {
      if (state.items.length < 2) return;
      state.i = (state.i + d + state.items.length) % state.items.length;
      show();
    }

    root.addEventListener("click", function (e) {
      var t = e.target.closest("[data-lb]");
      if (!t) return;
      var a = t.getAttribute("data-lb");
      if (a === "close") close();
      else if (a === "prev") step(-1);
      else if (a === "next") step(1);
    });
    document.addEventListener("keydown", function (e) {
      if (!root.hasAttribute("data-open")) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    });

    lb = { open: open };
    return lb;
  }

  register("gallery", function mountGallery(slot) {
    var imgs = [].slice.call(slot.querySelectorAll("img"));
    if (!imgs.length) return; // nothing to enhance — leave the in-skin markup as is
    var items = imgs.map(function (im) {
      return { src: im.getAttribute("data-cit-full") || im.currentSrc || im.src, alt: im.getAttribute("alt") || "" };
    });
    imgs.forEach(function (im, idx) {
      im.setAttribute("tabindex", "0");
      im.setAttribute("role", "button");
      if (!im.getAttribute("aria-label")) im.setAttribute("aria-label", (im.alt || tr("Kép")) + " — " + tr("nagyítás"));
      im.style.cursor = "zoom-in";
      im.addEventListener("click", function () { ensureLightbox().open(items, idx, im); });
      im.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ensureLightbox().open(items, idx, im); }
      });
    });
  });

  // ── room details popover (module: rooms) ────────────────────────────────────
  // APPROVED PLAN, variant B (owner, 2026-09-21). Contract + reference implementation:
  // assets/design-refs/tenant-site/rooms-card/{README.md,plan.html}.
  //
  // Progressive enhancement, the mountGallery way: the card markup is authored in-skin
  // by each template and is NEVER replaced. Every card carries a <details> with the
  // same content the popover shows, so without JS the guest opens it ON the card and
  // loses nothing; the card itself stays a real <a> to /apartman/<slug>, which is the
  // SEO entry point the popover must not cost us.
  //
  // ONE popover for the whole page, themed only from --cit-* → in-skin everywhere.
  var rd = null; // singleton, lazily built on first open

  /** Lift a card's <details> into a plain object, then take it out of the card.
   *  REMOVING it is deliberate: a collapsed <details> leaves text nodes with zero line
   *  boxes on the card, which the room-card overflow guard calls a defect — rightly. */
  function readRoomData(slot, shell, idx) {
    var det = slot.querySelector('[data-cit-roomdata="' + idx + '"]');
    var cover = shell.querySelector("img");
    var photos = [];
    if (cover) photos.push({ src: cover.getAttribute("data-cit-full") || cover.currentSrc || cover.src, alt: cover.alt || "" });
    var desc = "", empty = "", amHtml = "", amCount = 0, heading = "", priceNote = "";
    if (det) {
      det.querySelectorAll(".cit-rmore__ph img").forEach(function (im) {
        photos.push({ src: im.getAttribute("data-cit-full") || im.getAttribute("src"), alt: im.alt || "" });
      });
      var dEl = det.querySelector(".cit-rmore__desc");
      if (dEl) desc = dEl.textContent || "";
      var eEl = det.querySelector(".cit-rmore__empty");
      if (eEl) empty = eEl.textContent || "";
      var pnEl = det.querySelector(".cit-rmore__pricenote");
      if (pnEl) priceNote = pnEl.textContent || "";
      var hEl = det.querySelector(".cit-rmore__h");
      if (hEl) heading = hEl.textContent || "";
      var amEl = det.querySelector(".cit-rmore__am");
      if (amEl) { amHtml = amEl.innerHTML; amCount = amEl.children.length; }
      det.remove();
    }
    return {
      name: shell.getAttribute("data-cit-room-name") || "",
      cap: shell.getAttribute("data-cit-room-cap") || "",
      price: shell.getAttribute("data-cit-room-price") || "",
      whole: shell.getAttribute("data-cit-room-whole") === "1",
      unitId: shell.getAttribute("data-cit-room-unit") || "",
      photos: photos,
      desc: desc,
      empty: empty,
      heading: heading,
      priceNote: priceNote,
      amHtml: amHtml,
      amCount: amCount,
      href: shell.getAttribute("href") || "",
    };
  }

  function ensureRoomPopover() {
    if (rd) return rd;
    var root = document.createElement("div");
    root.className = "cit-rd";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-hidden", "true");
    root.innerHTML =
      '<div class="cit-rd__veil" data-rd="close"></div>' +
      '<div class="cit-rd__panel">' +
      '<button class="cit-rd__x" type="button" data-rd="close" aria-label="' + tr("Bezárás") + '">&times;</button>' +
      '<div class="cit-rd__body">' +
      '<div class="cit-rd__gal">' +
      '<div class="cit-rd__stage">' +
      '<img class="cit-rd__img" alt="">' +
      '<button class="cit-rd__nav cit-rd__nav--prev" type="button" data-rd="prev" aria-label="' + tr("Előző kép") + '">&#8249;</button>' +
      '<button class="cit-rd__nav cit-rd__nav--next" type="button" data-rd="next" aria-label="' + tr("Következő kép") + '">&#8250;</button>' +
      '<span class="cit-rd__count"></span>' +
      "</div>" +
      '<div class="cit-rd__thumbs"></div>' +
      "</div>" +
      '<div class="cit-rd__txt">' +
      '<div class="cit-rd__brow"></div>' +
      "<h3></h3>" +
      '<p class="cit-rd__cap"></p>' +
      '<p class="cit-rd__price"></p>' +
      '<p class="cit-rd__pricenote"></p>' +
      '<p class="cit-rd__desc"></p>' +
      '<div class="cit-rd__amwrap"></div>' +
      '<p class="cit-rd__empty"></p>' +
      "</div>" +
      "</div>" +
      '<div class="cit-rd__cta"></div>' +
      "</div>";
    document.body.appendChild(root);

    var q = function (s) { return root.querySelector(s); };
    var img = q(".cit-rd__img"), thumbs = q(".cit-rd__thumbs"), count = q(".cit-rd__count");
    var state = { room: null, i: 0, opener: null };

    /** ⛔ Paint the step, and hide EVERY dead control when there is a single photo.
     *  Measured: 3 of 4 units have exactly one photo, so this is the base case; and
     *  `hidden` alone is not enough because display:flex beats it (CSS repeats it). */
    function show(i) {
      var ph = state.room ? state.room.photos : [];
      if (!ph.length) return;
      state.i = (i + ph.length) % ph.length;
      img.src = ph[state.i].src;
      img.alt = ph[state.i].alt;
      count.textContent = state.i + 1 + " / " + ph.length;
      var many = ph.length > 1;
      count.hidden = !many;                 // "1 / 1" is noise, not information
      thumbs.hidden = !many;
      q(".cit-rd__nav--prev").hidden = !many;
      q(".cit-rd__nav--next").hidden = !many;
      Array.prototype.forEach.call(thumbs.children, function (b, n) {
        b.setAttribute("aria-current", n === state.i ? "true" : "false");
      });
    }

    function open(room, opener) {
      state.room = room;
      state.opener = opener || null;
      q(".cit-rd__brow").textContent = room.whole ? tr("A szállás egésze") : tr("Apartman");
      q("h3").textContent = room.name;
      var cap = q(".cit-rd__cap");
      cap.textContent = room.cap; cap.hidden = !room.cap;
      var pr = q(".cit-rd__price");
      pr.textContent = room.price; pr.hidden = !room.price;
      // ⛔ Csak PADLÓ-árnál („24 000 Ft-tól"), és csak ha a lap tud is ajánlatot adni —
      // a szerver dönti el, itt már csak átvesszük. Egy árnál a mondat hazugság volna.
      var pn = q(".cit-rd__pricenote");
      pn.textContent = room.priceNote; pn.hidden = !room.priceNote;
      var de = q(".cit-rd__desc");
      de.textContent = room.desc; de.hidden = !room.desc;
      // ⛔ ADR-0181: no heading without items — an empty amenity box is a claim.
      var wrap = q(".cit-rd__amwrap");
      wrap.innerHTML = room.amCount
        ? '<p class="cit-rd__h4">' + esc(room.heading || tr("Amit ez az egység kínál")) + "</p>" +
          '<ul class="cit-rd__am">' + room.amHtml + "</ul>"
        : "";
      var em = q(".cit-rd__empty");
      em.textContent = room.empty; em.hidden = !room.empty;
      // The CTA is the page's own enquiry/booking anchor — the popover never invents a
      // second process (ADR-0048: one word, one slot for the whole page).
      // ⛔ WHICHEVER ANCHOR ACTUALLY EXISTS. The server rewrites #cit-enquiry to
      // #cit-booking when the booking module is on, but that rewrite only touches
      // SERVER-rendered HTML — this CTA is built here, so a hard-coded #cit-enquiry
      // would have pointed at nothing on exactly the pages that sell booking.
      var target = document.querySelector("#cit-booking") ? "#cit-booking" : "#cit-enquiry";
      q(".cit-rd__cta").innerHTML =
        '<a href="' + target + '"' +
        (room.unitId ? ' data-cit-room-unit="' + esc(room.unitId) + '"' : "") +
        ' data-rd-cta>' + esc(tr("Foglalás")) + "</a>";
      thumbs.innerHTML = "";
      room.photos.forEach(function (p, n) {
        var b = document.createElement("button");
        b.type = "button";
        var im = document.createElement("img");
        im.src = p.src; im.alt = "";
        b.appendChild(im);
        b.addEventListener("click", function () { show(n); });
        thumbs.appendChild(b);
      });
      show(0);
      root.setAttribute("data-open", "");
      root.setAttribute("aria-hidden", "false");
      syncScrollLock();
      q(".cit-rd__x").focus();
    }

    function close() {
      root.removeAttribute("data-open");
      root.setAttribute("aria-hidden", "true");
      syncScrollLock();
      img.src = "";
      if (state.opener && state.opener.focus) state.opener.focus(); // back to its card
      state.opener = null;
    }

    root.addEventListener("click", function (e) {
      // ⛔ A CTA ZÁRJA A FELUGRÓT. Nélküle a vendég leugrik a foglalás-szekcióra, de a
      // fátyol és a görgetés-zár fent marad — a lap halottnak látszik.
      if (e.target.closest("[data-rd-cta]")) { close(); return; }
      var t = e.target.closest("[data-rd]");
      if (t) {
        var a = t.getAttribute("data-rd");
        if (a === "close") close();
        else if (a === "prev") show(state.i - 1);
        else if (a === "next") show(state.i + 1);
        return;
      }
      // The big photo opens FULL SIZE, in the shared lightbox — one layer above.
      if (e.target.closest(".cit-rd__stage") && state.room && state.room.photos.length) {
        ensureLightbox().open(state.room.photos, state.i, img);
      }
    });

    document.addEventListener("keydown", function (e) {
      if (!root.hasAttribute("data-open")) return;
      // ⛔ ESC PEELS ONE LAYER. While the full-size viewer is up it owns the key: it
      // closes, and the popover stays open. Only the second ESC closes the popover.
      // (The lightbox is built lazily, so its own listener may be registered after
      // this one — the check is on the DOM, not on listener order.)
      if (document.querySelector(".cit-lb[data-open]")) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") show(state.i - 1);
      else if (e.key === "ArrowRight") show(state.i + 1);
    });

    rd = { open: open };
    return rd;
  }

  register("rooms", function mountRoomDetails(slot) {
    // ⚠️ ONLY the card shells carry the DATA. A room can have SEVERAL openers (the card
    // itself, plus a "Részletek" button next to Foglalás), so treating every
    // [data-cit-room] as a card would build two entries for one room and hand the next
    // room's photos to the wrong unit. The INDEX in the attribute is the key; position
    // in the DOM is not.
    var shells = [].slice.call(slot.querySelectorAll(".cit-room__open[data-cit-room]"));
    if (!shells.length) return; // nothing anchored — leave the in-skin markup as is
    // Tell the page JS is on, so the no-JS <details> stands down even for the brief
    // moment before we take them out.
    document.documentElement.classList.add("cit-rooms-js");
    var rooms = {};
    shells.forEach(function (sh) {
      var idx = sh.getAttribute("data-cit-room");
      rooms[idx] = readRoomData(slot, sh, idx);
    });

    function fire(trigger) {
      var room = rooms[trigger.getAttribute("data-cit-room")];
      if (room) ensureRoomPopover().open(room, trigger);
    }

    /**
     * ⛔⛔ THE JUMP MUST CARRY WHICH ROOM.
     *
     * Measured 2026-09-22: clicking "Foglalás" on the SECOND room card DID jump to the
     * booking section — and left the unit selector on the FIRST unit. The guest then set
     * dates against the wrong unit's calendar, read the wrong unit's quote, and
     * `unit: currentUnit()` would submit the wrong unit: the owner receives a booking
     * request for a room nobody asked for. The anchor carried no room at all.
     *
     * We set the SELECT, because that is what everything else already reads — the
     * availability refetch, the price rows and the submit all follow it. (Without JS
     * there is no booking widget at all, so this is inherently a JS-side step.)
     */
    function carryUnitToBooking(anchor) {
      var card = anchor.closest("article, li, tr, figure, .cit-whole, .cit-modsec__item");
      var holder = anchor.getAttribute("data-cit-room-unit")
        ? anchor
        : card
          ? card.querySelector("[data-cit-room-unit]")
          : null;
      var unitId = holder && holder.getAttribute("data-cit-room-unit");
      if (!unitId) return;
      var sel = document.querySelector('[name="unit"]');
      if (!sel || sel.value === unitId) return;
      // ⚠️ Csak akkor állítunk, ha a választóban TÉNYLEG van ilyen érték — különben némán
      // egy nem létező egységre váltanánk, és a naptár üresen maradna.
      for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === unitId) {
          sel.value = unitId;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
          return;
        }
      }
    }
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a[href="#cit-booking"], a[href="#cit-enquiry"]');
      if (a) carryUnitToBooking(a);
    });

    slot.addEventListener("click", function (e) {
      var t = e.target.closest("[data-cit-room]");
      if (!t || !slot.contains(t)) return;
      // ⛔ The anchor stays a REAL link: only our interception stops the navigation, and
      // only for a plain left click. Ctrl/⌘/shift/middle-click must still open the
      // unit's own page — that page is the reason the <a> exists at all (ADR-0041).
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      fire(t);
    });
    slot.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var t = e.target.closest('[data-cit-room][role="button"]');
      if (!t || !slot.contains(t)) return;
      e.preventDefault();
      fire(t);
    });
  });

  // ── map / location module ───────────────────────────────────────────────────
  // Progressive enhancement + privacy: the in-skin location block (address +
  // directions link) is authored by the generator and stays as-is (visible,
  // functional without JS — no empty band). If the slot carries a real
  // data-cit-query (address or "lat,lng"), the runtime APPENDS a click-to-load
  // facade; the Google embed iframe is only fetched after the user opts in
  // (GDPR-aware). The query is the lead's REAL location — nothing fabricated.
  register("map", function mountMap(slot) {
    var q = slot.getAttribute("data-cit-query");
    // The generator now renders the embed itself (server-side, works without JS —
    // owner ruling 2026-09-01). Nothing to mount when the frame is already there;
    // this branch only remains for older snapshots that carry the facade markup.
    if (!q || slot.querySelector(".cit-map") || slot.querySelector(".cit-map__frame")) return;

    var box = document.createElement("div");
    box.className = "cit-map";
    var facade = document.createElement("button");
    facade.type = "button";
    facade.className = "cit-map__load";
    facade.innerHTML = SVG_PIN + "<span>" + tr("Térkép betöltése") + "</span>";
    box.appendChild(facade);
    // Inside the section's measured column when there is one (the shared module
    // block), so the map aligns with the heading instead of going full-bleed.
    (slot.querySelector(".cit-modsec__in") || slot).appendChild(box);

    facade.addEventListener("click", function () {
      var frame = document.createElement("iframe");
      frame.className = "cit-map__frame";
      frame.setAttribute("loading", "lazy");
      frame.setAttribute("title", tr("Térkép — megközelítés"));
      frame.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
      frame.setAttribute("allowfullscreen", "");
      frame.src = "https://maps.google.com/maps?q=" + encodeURIComponent(q) + "&output=embed";
      box.textContent = "";
      box.appendChild(frame);
    });
  });

  // ── reviews carousel module ─────────────────────────────────────────────────
  // Honesty: shows ONLY the real review cards the generator authored in-skin (no
  // fabrication). Enhancement: a [data-cit-track] of ≥2 cards becomes a snap
  // carousel with prev/next + dots. Without JS the track is a scrollable/stacked
  // list of the same cards (no empty band). No track or <2 cards → no-op.
  register("reviews", function mountReviews(slot) {
    var track = slot.querySelector("[data-cit-track]");
    if (!track) return;
    var slides = [].slice.call(track.children);
    if (slides.length < 2 || slot.querySelector(".cit-rev__nav")) return;

    track.classList.add("cit-rev__track");
    slides.forEach(function (s) { s.classList.add("cit-rev__slide"); });

    function slideStep() {
      var r = slides[0].getBoundingClientRect();
      var gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || "0") || 0;
      return r.width + gap;
    }
    function activeIndex() {
      return Math.round(track.scrollLeft / slideStep());
    }

    var nav = document.createElement("div");
    nav.className = "cit-rev__nav";
    var prev = document.createElement("button");
    prev.type = "button"; prev.className = "cit-rev__btn cit-rev__btn--prev";
    prev.setAttribute("aria-label", tr("Előző vélemény")); prev.innerHTML = SVG_CHEV;
    var next = document.createElement("button");
    next.type = "button"; next.className = "cit-rev__btn cit-rev__btn--next";
    next.setAttribute("aria-label", tr("Következő vélemény")); next.innerHTML = SVG_CHEV;
    var dots = document.createElement("div");
    dots.className = "cit-rev__dots";
    var dotEls = slides.map(function (_, idx) {
      var d = document.createElement("button");
      d.type = "button"; d.className = "cit-rev__dot";
      d.setAttribute("aria-label", idx + 1 + ". " + tr("vélemény"));
      d.addEventListener("click", function () { track.scrollTo({ left: idx * slideStep(), behavior: "smooth" }); });
      dots.appendChild(d);
      return d;
    });
    nav.appendChild(prev); nav.appendChild(dots); nav.appendChild(next);
    track.parentNode.insertBefore(nav, track.nextSibling);

    function go(d) { track.scrollBy({ left: d * slideStep(), behavior: "smooth" }); }
    prev.addEventListener("click", function () { go(-1); });
    next.addEventListener("click", function () { go(1); });

    function sync() {
      var i = Math.max(0, Math.min(slides.length - 1, activeIndex()));
      dotEls.forEach(function (d, idx) { d.setAttribute("aria-current", idx === i ? "true" : "false"); });
    }
    track.addEventListener("scroll", function () {
      window.requestAnimationFrame(sync);
    });
    sync();
  });

  // ── scroll-reveal (standard behaviour, not per-archetype) ───────────────────
  // Archetypes gate their entrance-hidden state behind `html.cit-anim` and mark
  // elements `.reveal` (revealed by adding `.in`). The RUNTIME owns the reveal so
  // no archetype ships its own observer — otherwise a design that forgets the
  // IntersectionObserver leaves .reveal content permanently opacity:0 when JS is
  // on. Without JS, `cit-anim` is never added → content is visible (no empty band).
  // Auto-tag engine primitives as reveal targets so the whole page comes alive without each
  // primitive shipping its own hook (ADR-0018 motion layer). Grid children are staggered via
  // --cit-i (CSS turns it into a transition-delay); standalone blocks reveal on their own.
  function autoReveal() {
    var CONTAINERS =
      ".cit-stat-row,.cit-amenity-grid,.cit-feature-grid,.cit-room-grid," +
      ".cit-review-grid,.cit-gallery-grid,.cit-gallery-cols,.cit-show-list";
    document.querySelectorAll(CONTAINERS).forEach(function (c) {
      var i = 0;
      Array.prototype.forEach.call(c.children, function (child) {
        if (child.classList.contains("cit-reveal")) return;
        child.classList.add("cit-reveal");
        child.style.setProperty("--cit-i", i++);
      });
    });
    document
      .querySelectorAll(".cit-hero-inner,.cit-section-title,.cit-intro,.cit-enquiry-inner")
      .forEach(function (el) { el.classList.add("cit-reveal"); });
  }

  function initReveal() {
    autoReveal();
    var els = document.querySelectorAll(".reveal,[data-cit-reveal],.cit-reveal");
    if (!els.length) return;
    document.documentElement.classList.add("cit-anim"); // defensive: also set here
    if (!("IntersectionObserver" in window)) {
      // no IO → just show (add both the legacy and the engine "revealed" classes)
      els.forEach(function (el) { el.classList.add("in"); el.classList.add("cit-in"); });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            e.target.classList.add("cit-in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" }
    );
    els.forEach(function (el) { io.observe(el); });
  }

  function hydrate(root) {
    var scope = root || document;
    scope.querySelectorAll("[data-cit-module]").forEach(function (slot) {
      if (slot.hasAttribute("data-cit-ready")) return;
      var type = slot.getAttribute("data-cit-module");
      var fn = registry[type];
      if (!fn) return;
      slot.setAttribute("data-cit-ready", "");
      try {
        fn(slot);
      } catch (err) {
        if (window.console) console.warn("[cit] module hydrate failed:", type, err);
      }
    });
  }

  window.CitModules = { register: register, hydrate: hydrate };

  // ── review popup (owner request 2026-08-23) ─────────────────────────────────
  // Google forbids embedding its pages in an iframe, so a true in-page modal is not
  // possible: the honest "minipopup" is a small BROWSER window on desktop, opened
  // next to the site so the visitor never loses the page. On a phone (or if the
  // popup is blocked) the plain target="_blank" link does its job untouched.
  function initReviewPopup() {
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('[data-cit-popup="reviews"]');
      if (!a || !a.href) return;
      if (window.innerWidth < 760) return; // phone: let the normal new tab happen
      var w = 520, h = Math.min(760, Math.round(window.innerHeight * 0.86));
      var left = Math.max(0, (window.screenX || 0) + window.outerWidth - w - 40);
      var top = Math.max(0, (window.screenY || 0) + 60);
      var win = window.open(
        a.href, "cit-reviews",
        "width=" + w + ",height=" + h + ",left=" + left + ",top=" + top +
        ",noopener,noreferrer,scrollbars=yes,resizable=yes"
      );
      if (win) e.preventDefault(); // blocked? then the link's own behaviour stands
    });
  }

  // ── SAMPLE-photo watermark (owner decree 2026-08-23) ────────────────────────
  // A room card whose photo stands for a room we do not know about must SAY SO on
  // the picture. Without it the lead reads the invented room as a claim ("nálam
  // nincs is apartman — ez nem az én szállásom") and writes the whole mock off.
  // Drawn once here for all 16 templates: the renderer only flags the <img>.
  function markSamplePhotos() {
    document.querySelectorAll("img[data-cit-sample-photo]").forEach(function (img) {
      if (img.getAttribute("data-cit-wm")) return;
      img.setAttribute("data-cit-wm", "1");
      // WRAP the image rather than marking its parent: in a table row the parent is
      // the whole cell, and the band spread across it, covering the room name
      // (measured on `transit`, 2026-08-24). A tight wrapper puts the mark exactly
      // on the picture in every template.
      var parent = img.parentElement;
      if (!parent) return;
      // Did the picture FILL its frame's height before we touched it? ONLY then may the
      // wrapper claim height:100%. Claiming it blind is what made the band swallow the
      // card again: in a column-flex room card the parent's height is the whole card,
      // so the rotated band spilled over the room name (measured on 19 templates,
      // 2026-09-13 — the very thing the tight wrapper existed to prevent).
      // The measurement must happen BEFORE the wrap: the wrap is what changes it.
      var pb = parent.getBoundingClientRect(), ib = img.getBoundingClientRect();
      var filled = ib.height > 0 && Math.abs(ib.height - pb.height) < 1.5;
      var wrap = document.createElement("span");
      wrap.className = "cit-wmwrap";
      if (filled) wrap.setAttribute("data-cit-wmfill", "1");
      parent.insertBefore(wrap, img);
      wrap.appendChild(img);
      // The mark goes inside a clip layer that ends exactly where the photo ends — so it
      // can never reach past the picture and onto the room name, whatever corner it takes.
      // The clip wraps the MARK, never the image, so a template that rotates its own photo
      // is not cropped by us.
      var clip = document.createElement("span");
      clip.className = "cit-wmclip";
      clip.setAttribute("aria-hidden", "true");
      // A tiny picture (the transit row thumbnail is 50×36 on a phone) cannot hold a
      // padded pill — it would be clipped to a stub, which is a defect, not a mark.
      var narrow = ib.width > 0 && ib.width < 120;
      var band = document.createElement("span");
      band.setAttribute("aria-hidden", "true");
      band.textContent = tr("MINTA");
      clip.appendChild(band);
      wrap.appendChild(clip);
      // WHICH CORNER: measured, not assumed. The approved pill is OPAQUE — unlike the old
      // translucent wash it does not let anything through — and templates draw their own
      // labels on the picture (horizontal's chapter number sits at top-left, watercolor's
      // capacity tag over the photo). Dropping the pill on a fixed corner would bury one.
      //
      // ⚠️ GEOMETRY, NOT elementFromPoint: the rooms section is far below the fold when this
      // runs, and a hit test off-screen returns null — it would answer "free" for every
      // corner and we would never know. (That exact blind spot is what made the FIRST
      // version of the room-card guard report green on the reported bug.)
      var obstacles = [];
      var kids = parent.querySelectorAll("*");
      for (var k = 0; k < kids.length; k++) {
        var el = kids[k];
        if (el === img || el === wrap || wrap.contains(el)) continue;
        var kr = el.getBoundingClientRect();
        if (!kr.width || !kr.height) continue;
        // Only what actually lies OVER the picture can be buried by the pill.
        if (kr.right > ib.left && kr.left < ib.right && kr.bottom > ib.top && kr.top < ib.bottom) {
          obstacles.push(kr);
          // ⛔ AND IT MUST STAY ON TOP. The wrapper is position:relative, and it comes
          // AFTER these labels in the DOM — so merely wrapping the image promoted the
          // PHOTO above them in paint order. Measured on `horizontal`: the chapter number
          // ("1. fejezet"), drawn by the template onto the picture, vanished under it.
          // Our mark never outranks what the template drew on the picture, so we lift
          // them back above our layer (the clip sits at z-index 3).
          var ec = getComputedStyle(el);
          if (ec.position === "static") el.style.position = "relative";
          var z = parseInt(ec.zIndex, 10);
          if (!(z > 3)) el.style.zIndex = "4";
        }
      }
      var corners = ["", "cit-wm--right", "cit-wm--bottom", "cit-wm--bottom cit-wm--right"];
      for (var c = 0; c < corners.length; c++) {
        band.className = "cit-wm" + (narrow ? " cit-wm--sm" : "") + (corners[c] ? " " + corners[c] : "");
        var r = band.getBoundingClientRect();
        var clash = false;
        for (var o = 0; o < obstacles.length; o++) {
          var ob = obstacles[o];
          if (r.right > ob.left && r.left < ob.right && r.bottom > ob.top && r.top < ob.bottom) {
            clash = true;
            break;
          }
        }
        // Free corner → keep it. Every corner taken → the last one stands, and the guard
        // reports the collision; a silent overlap would be the worse outcome.
        if (!clash) break;
      }
    });
  }

  // ── ADR-0061: mock demo forms (newsletter, review) — try-able, never submitted ─
  // A form stamped data-cit-demo carries its own honest confirmation message; the
  // submit is swallowed and the message replaces the form. Nothing leaves the page,
  // and no endpoint is hit (on a mock there is nothing real behind it anyway).
  function initDemoForms() {
    document.addEventListener("submit", function (e) {
      var f = e.target;
      if (!f || !f.getAttribute || f.getAttribute("data-cit-demo") == null) return;
      e.preventDefault();
      var msg = f.getAttribute("data-cit-demo") ||
        tr("Ez kipróbálás volt — az éles oldalon innen elindulna a folyamat.");
      var p = document.createElement("p");
      p.className = "cit-modsec__note";
      p.style.margin = "0";
      p.textContent = msg;
      f.replaceWith(p);
    });
  }

  function boot() { hydrate(); initReveal(); initDemoForms(); markSamplePhotos(); initReviewPopup(); }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
