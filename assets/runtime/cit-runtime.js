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
      "</p></div></div>";

    slot.textContent = "";
    slot.appendChild(form);

    var note = form.querySelector(".cit-book__note");
    var baseNote = note.innerHTML;
    var submit = form.querySelector(".cit-book__submit");
    var countEl = form.querySelector("[data-guests]");
    var guests = 2;
    var blocked = {};

    form.querySelectorAll(".cit-book__step").forEach(function (btn) {
      btn.addEventListener("click", function () {
        guests = Math.min(20, Math.max(1, guests + Number(btn.getAttribute("data-step"))));
        countEl.textContent = String(guests);
      });
    });

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
      fetch("/api/foglaltsag/" + encodeURIComponent(currentUnit()), { credentials: "omit" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j || !j.blocked) return;
          j.blocked.forEach(function (d) { blocked[d] = true; });
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
      fetch("/api/foglalas", {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: body.toString(),
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (out) {
          if (out.ok && out.j && out.j.ok) {
            // Replace the form: the guest is done, and a lingering form invites a
            // second identical request.
            slot.innerHTML =
              '<div class="cit-book cit-book--done"><p class="cit-book__title">' + SVG_CAL +
              "<span>" + tr("Elküldtük a kérését") + "</span></p>" +
              '<p class="cit-book__note">' +
              tr("A szállásadó hamarosan visszaigazolja. Az értesítést e-mailben küldjük.") +
              "</p></div>";
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
    var name = slot.getAttribute("data-cit-name") || "";
    var email = slot.getAttribute("data-cit-email") || "";
    var variant = slot.getAttribute("data-cit-variant") === "bar" ? "bar" : "card";
    var title = slot.getAttribute("data-cit-title") || tr("Foglalási igény");

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
      '<button class="cit-book__submit" type="submit">' + tr("Érdeklődés küldése") + "</button>" +
      '<p class="cit-book__note">' + tr("Előzetes érdeklődés — nem végleges foglalás. A szállás visszaigazol.") + "</p>";

    // keep any author-provided fallback markup out; replace slot contents
    slot.textContent = "";
    slot.appendChild(form);

    var countEl = form.querySelector("[data-guests]");
    var note = form.querySelector(".cit-book__note");
    var guests = 2;

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
      note.classList.remove("cit-book__note--err");
      if (ci && co && co <= ci) {
        note.textContent = tr("A távozás legyen későbbi az érkezésnél.");
        note.classList.add("cit-book__note--err");
        return;
      }
      var lines = [
        tr("Érdeklődés") + (name ? " — " + name : ""),
        ci ? tr("Érkezés") + ": " + ci : null,
        co ? tr("Távozás") + ": " + co : null,
        tr("Vendégek") + ": " + guests,
      ].filter(Boolean);
      var detail = { name: name, checkin: ci, checkout: co, guests: guests };

      // Prefer a host-provided handler; else mailto; else a preview note.
      var handled = !slot.dispatchEvent(
        new CustomEvent("cit:enquiry", { bubbles: true, cancelable: true, detail: detail })
      );
      if (handled) return;
      if (email) {
        window.location.href =
          "mailto:" + encodeURIComponent(email) +
          "?subject=" + encodeURIComponent(tr("Érdeklődés") + (name ? " — " + name : "")) +
          "&body=" + encodeURIComponent(lines.join("\n"));
      } else {
        note.textContent = tr("Köszönjük! (Előnézet — az éles oldalon ez elküldi az érdeklődést.)");
      }
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
      document.documentElement.style.overflow = "hidden";
      root.querySelector(".cit-lb__btn--close").focus();
    }
    function close() {
      root.removeAttribute("data-open");
      root.setAttribute("aria-hidden", "true");
      document.documentElement.style.overflow = "";
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

  // ── map / location module ───────────────────────────────────────────────────
  // Progressive enhancement + privacy: the in-skin location block (address +
  // directions link) is authored by the generator and stays as-is (visible,
  // functional without JS — no empty band). If the slot carries a real
  // data-cit-query (address or "lat,lng"), the runtime APPENDS a click-to-load
  // facade; the Google embed iframe is only fetched after the user opts in
  // (GDPR-aware). The query is the lead's REAL location — nothing fabricated.
  register("map", function mountMap(slot) {
    var q = slot.getAttribute("data-cit-query");
    if (!q || slot.querySelector(".cit-map")) return; // no query / already mounted

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

  function boot() { hydrate(); initReveal(); initDemoForms(); }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
