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
  var SVG_X =
    '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
    '<path d="M6 6l12 12M18 6L6 18"/></svg>';
  var SVG_CHEV =
    '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M15 5l-7 7 7 7"/></svg>';
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
      '<button class="cit-lb__btn cit-lb__btn--close" type="button" data-lb="close" aria-label="Bezárás">' + SVG_X + "</button>" +
      '<button class="cit-lb__btn cit-lb__btn--prev" type="button" data-lb="prev" aria-label="Előző kép">' + SVG_CHEV + "</button>" +
      '<button class="cit-lb__btn cit-lb__btn--next" type="button" data-lb="next" aria-label="Következő kép">' + SVG_CHEV + "</button>" +
      '<figure class="cit-lb__stage" role="dialog" aria-modal="true" aria-label="Galéria — nagyított kép">' +
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
      if (!im.getAttribute("aria-label")) im.setAttribute("aria-label", (im.alt || "Kép") + " — nagyítás");
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
    facade.innerHTML = SVG_PIN + "<span>Térkép betöltése</span>";
    box.appendChild(facade);
    slot.appendChild(box);

    facade.addEventListener("click", function () {
      var frame = document.createElement("iframe");
      frame.className = "cit-map__frame";
      frame.setAttribute("loading", "lazy");
      frame.setAttribute("title", "Térkép — megközelítés");
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
    prev.setAttribute("aria-label", "Előző vélemény"); prev.innerHTML = SVG_CHEV;
    var next = document.createElement("button");
    next.type = "button"; next.className = "cit-rev__btn cit-rev__btn--next";
    next.setAttribute("aria-label", "Következő vélemény"); next.innerHTML = SVG_CHEV;
    var dots = document.createElement("div");
    dots.className = "cit-rev__dots";
    var dotEls = slides.map(function (_, idx) {
      var d = document.createElement("button");
      d.type = "button"; d.className = "cit-rev__dot";
      d.setAttribute("aria-label", idx + 1 + ". vélemény");
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
