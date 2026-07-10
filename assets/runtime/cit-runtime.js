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

  var SVG_CAL =
    '<svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/></svg>';

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

  // ── booking / enquiry module ────────────────────────────────────────────────
  register("booking", function mountBooking(slot) {
    var name = slot.getAttribute("data-cit-name") || "";
    var email = slot.getAttribute("data-cit-email") || "";
    var variant = slot.getAttribute("data-cit-variant") === "bar" ? "bar" : "card";
    var title = slot.getAttribute("data-cit-title") || "Foglalási igény";

    var form = document.createElement("form");
    form.className = "cit-book cit-book--" + variant;
    form.setAttribute("novalidate", "");
    form.innerHTML =
      '<p class="cit-book__title">' + SVG_CAL + "<span>" + esc(title) + "</span></p>" +
      '<div class="cit-book__fields">' +
      '<div class="cit-book__field"><label class="cit-book__label">Érkezés</label>' +
      '<input class="cit-book__input" type="date" name="checkin" min="' + todayISO() + '"></div>' +
      '<div class="cit-book__field"><label class="cit-book__label">Távozás</label>' +
      '<input class="cit-book__input" type="date" name="checkout" min="' + todayISO() + '"></div>' +
      '<div class="cit-book__field"><label class="cit-book__label">Vendégek</label>' +
      '<div class="cit-book__stepper" role="group" aria-label="Vendégek száma">' +
      '<button class="cit-book__step" type="button" data-step="-1" aria-label="kevesebb">−</button>' +
      '<span class="cit-book__count" data-guests>2</span>' +
      '<button class="cit-book__step" type="button" data-step="1" aria-label="több">+</button>' +
      "</div></div></div>" +
      '<button class="cit-book__submit" type="submit">Érdeklődés küldése</button>' +
      '<p class="cit-book__note">Előzetes érdeklődés — nem végleges foglalás. A szállás visszaigazol.</p>';

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
        note.textContent = "A távozás legyen későbbi az érkezésnél.";
        note.classList.add("cit-book__note--err");
        return;
      }
      var lines = [
        "Érdeklődés" + (name ? " — " + name : ""),
        ci ? "Érkezés: " + ci : null,
        co ? "Távozás: " + co : null,
        "Vendégek: " + guests,
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
          "?subject=" + encodeURIComponent("Érdeklődés" + (name ? " — " + name : "")) +
          "&body=" + encodeURIComponent(lines.join("\n"));
      } else {
        note.textContent = "Köszönjük! (Előnézet — az éles oldalon ez elküldi az érdeklődést.)";
      }
    });
  });

  // ── generic passive markers (no interactive behaviour yet) ──────────────────
  // gallery/reviews/map slots are authored in-skin by the generator; they get a
  // marker hook now so future handlers (lightbox, carousel) attach without any
  // per-archetype work. Registering a no-op keeps hydrate() uniform.
  ["gallery", "reviews", "map"].forEach(function (t) {
    register(t, function () {});
  });

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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { hydrate(); });
  } else {
    hydrate();
  }
})();
