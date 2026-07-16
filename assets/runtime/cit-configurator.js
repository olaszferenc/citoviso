/* Citoviso PROSPECT CONFIGURATOR runtime (ADR-0015) — framework-free.
 *
 * The visible sell: the prospect opens their pre-payment preview, assembles the
 * module package on a live overlay, and sees it immediately — BEFORE paying.
 *
 * Two kinds of module toggle:
 *   - PRESENT (a real module already in the mock, anchored by data-cit-module):
 *     toggling shows/hides the real section live.
 *   - SAMPLE (a catalog module NOT in the mock): toggling injects a clearly-marked
 *     "MINTA" block into #cit-cfg-samplezone (§B.17 phase boundary). Sample state
 *     is representative, never real data, and NEVER copied to the public live site.
 *
 * Config is read from <script type="application/json" data-cit-configurator>,
 * injected server-side by src/generator/configurator.ts. The backbone (enquiry)
 * is locked on — we never let a prospect remove their own contact path.
 */
(function () {
  "use strict";

  var cfgEl = document.querySelector("script[data-cit-configurator]");
  if (!cfgEl) return;
  var CFG;
  try {
    CFG = JSON.parse(cfgEl.textContent || "{}");
  } catch (e) {
    return;
  }
  var MODULES = CFG.modules || [];
  if (!MODULES.length) return;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function el(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  // ── icons (no emoji — design doctrine) ──────────────────────────────────────
  var I = {
    gear:
      '<svg viewBox="0 0 24 24" stroke-width="1.6"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M4.5 12h-2M21.5 12h-2M6 6l1.5 1.5M16.5 16.5 18 18M18 6l-1.5 1.5M7.5 16.5 6 18"/></svg>',
    x: '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    image:
      '<svg viewBox="0 0 24 24" stroke-width="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M4 17l5-5 4 4 3-3 4 4"/></svg>',
    star:
      '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 18.9 6.1 21.5l1.2-6.5L2.5 9.4l6.6-.9z"/></svg>',
    bed:
      '<svg viewBox="0 0 24 24" stroke-width="1.5"><path d="M3 18v-8h12a4 4 0 0 1 4 4v4M3 14h18M3 18v2M21 18v2M6 10V7h5v3"/></svg>',
    wifi:
      '<svg viewBox="0 0 24 24" stroke-width="1.5" stroke-linecap="round"><path d="M5 12.5a10 10 0 0 1 14 0M8 15.5a6 6 0 0 1 8 0"/><circle cx="12" cy="18.5" r="1"/></svg>',
    tag:
      '<svg viewBox="0 0 24 24" stroke-width="1.5"><path d="M3 12V4h8l9 9-8 8z"/><circle cx="7.5" cy="7.5" r="1.4"/></svg>',
    pin:
      '<svg viewBox="0 0 24 24" stroke-width="1.5"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/></svg>',
    clock:
      '<svg viewBox="0 0 24 24" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    check:
      '<svg viewBox="0 0 24 24" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5 11-11"/></svg>',
    mail:
      '<svg viewBox="0 0 24 24" stroke-width="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    cal:
      '<svg viewBox="0 0 24 24" stroke-width="1.5"><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/></svg>',
    mountain:
      '<svg viewBox="0 0 24 24" stroke-width="1.5"><path d="M3 19l6-10 4 6 2-3 6 7z"/><circle cx="8" cy="6.5" r="1.4"/></svg>',
  };

  function stars(n) {
    var s = "";
    for (var i = 0; i < 5; i++) s += I.star;
    return '<span class="cit-cfg-stars" aria-label="' + n + " / 5" + '">' + s + "</span>";
  }
  function tiles(n, icon) {
    var s = "";
    for (var i = 0; i < n; i++) s += '<div class="cit-cfg-tile">' + icon + "</div>";
    return '<div class="cit-cfg-grid">' + s + "</div>";
  }

  // ── SAMPLE library — honest, clearly representative, no real data (§B.17) ────
  // Each entry: { title, caption, body }. `caption` states plainly it's a sample.
  var SAMPLES = {
    gallery: {
      title: "Galéria",
      caption: "Így jelennének meg a valódi fotóid — a te képeiddel töltjük fel.",
      body: tiles(6, I.image),
    },
    rooms: {
      title: "Szobák / apartmanok",
      caption: "Minta-szobakártyák — a saját szobáid, áraid és fotóid kerülnek ide.",
      body:
        '<div class="cit-cfg-grid">' +
        [1, 2, 3]
          .map(function () {
            return (
              '<div class="cit-cfg-card"><div class="cit-cfg-tile" style="aspect-ratio:3/2;margin-bottom:.6rem">' +
              I.bed +
              "</div><p><b>Szoba neve</b></p><p class=\"cit-cfg-muted\">2 fő · minta leírás</p></div>"
            );
          })
          .join("") +
        "</div>",
    },
    amenities: {
      title: "Felszereltség",
      caption: "Minta-lista — a tényleges szolgáltatásaidat jelöljük be.",
      body:
        '<div class="cit-cfg-grid" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr))">' +
        [
          [I.wifi, "Ingyen Wi‑Fi"],
          [I.check, "Parkolás"],
          [I.check, "Reggeli"],
          [I.check, "Klíma"],
          [I.check, "Kisállat"],
          [I.check, "Terasz"],
        ]
          .map(function (a) {
            return (
              '<div class="cit-cfg-card" style="display:flex;align-items:center;gap:.6rem">' +
              '<span style="width:22px;height:22px;display:inline-block;color:var(--cit-accent,#b5122e)">' +
              a[0] +
              "</span><span>" +
              a[1] +
              "</span></div>"
            );
          })
          .join("") +
        "</div>",
    },
    pricing: {
      title: "Árak / szezonok",
      caption: "Minta-ártábla — a saját szezonáraidat állítjuk be (nem valós árak).",
      body:
        '<div class="cit-cfg-rows">' +
        [
          ["Főszezon", "— Ft / éj"],
          ["Elő- és utószezon", "— Ft / éj"],
          ["Téli időszak", "— Ft / éj"],
        ]
          .map(function (r) {
            return (
              '<div class="cit-cfg-lineitem"><span>' +
              r[0] +
              '</span><span class="cit-cfg-muted">' +
              r[1] +
              "</span></div>"
            );
          })
          .join("") +
        "</div>",
    },
    location: {
      title: "Térkép / megközelítés",
      caption: "Interaktív térkép a pontos címeddel — kattintásra tölt (adatvédelem).",
      body:
        '<div class="cit-cfg-tile" style="aspect-ratio:16/6">' +
        I.pin +
        "</div>",
    },
    booking: {
      title: "Foglalás",
      caption: "Élő foglalási naptár — élesítés utáni felár-modul (közvetlen foglalás, jutalék nélkül).",
      body:
        '<div class="cit-cfg-card" style="display:flex;align-items:center;gap:.7rem">' +
        '<span style="width:24px;height:24px;display:inline-block;color:var(--cit-accent,#b5122e)">' +
        I.cal +
        "</span><span>Dátumválasztó + azonnali visszaigazolás (minta)</span></div>",
    },
    hours: {
      title: "Nyitvatartás / be-kijelentkezés",
      caption: "Minta-időpontok — a saját be- és kijelentkezési rended kerül ide.",
      body:
        '<div class="cit-cfg-rows">' +
        [
          ["Bejelentkezés", "14:00-től"],
          ["Kijelentkezés", "10:00-ig"],
          ["Recepció", "minta időpont"],
        ]
          .map(function (r) {
            return (
              '<div class="cit-cfg-lineitem"><span style="display:flex;align-items:center;gap:.5rem">' +
              '<span style="width:18px;height:18px;display:inline-block;color:var(--cit-accent,#b5122e)">' +
              I.clock +
              "</span>" +
              r[0] +
              '</span><span class="cit-cfg-muted">' +
              r[1] +
              "</span></div>"
            );
          })
          .join("") +
        "</div>",
    },
    usp: {
      title: "„Miért mi” — előnyök",
      caption: "Minta-előnyök — a valódi megkülönböztető erősségeidet emeljük ki.",
      body:
        '<div class="cit-cfg-grid">' +
        ["Csendes, mégis központi", "Saját parkoló", "Személyes vendéglátás"]
          .map(function (t) {
            return (
              '<div class="cit-cfg-card"><span style="width:24px;height:24px;display:inline-block;color:var(--cit-accent,#b5122e)">' +
              I.check +
              "</span><p><b>" +
              t +
              "</b></p><p class=\"cit-cfg-muted\">Minta indoklás — a te szavaiddal.</p></div>"
            );
          })
          .join("") +
        "</div>",
    },
    reviews: {
      title: "Vélemények",
      caption: "Ide kerülnek a valódi vendégértékeléseid — most minta-szöveg.",
      body:
        '<div class="cit-cfg-grid">' +
        [
          ["Kiváló hely, visszatérünk!", "Vendég · minta"],
          ["Tiszta, csendes, kedves fogadtatás.", "Vendég · minta"],
        ]
          .map(function (r) {
            return (
              '<div class="cit-cfg-card">' +
              stars(5) +
              "<p>„" +
              r[0] +
              '"</p><p class="cit-cfg-muted">' +
              r[1] +
              "</p></div>"
            );
          })
          .join("") +
        "</div>",
    },
    poi: {
      title: "Környék / látnivalók",
      caption: "Minta-lista — a közeli látnivalókat, távolságokat mi állítjuk össze.",
      body:
        '<div class="cit-cfg-rows">' +
        [
          ["Látnivaló a közelben", "— perc"],
          ["Strand / túraútvonal", "— km"],
          ["Étterem / borászat", "— perc"],
        ]
          .map(function (r) {
            return (
              '<div class="cit-cfg-lineitem"><span style="display:flex;align-items:center;gap:.5rem">' +
              '<span style="width:18px;height:18px;display:inline-block;color:var(--cit-accent,#b5122e)">' +
              I.mountain +
              "</span>" +
              r[0] +
              '</span><span class="cit-cfg-muted">' +
              r[1] +
              "</span></div>"
            );
          })
          .join("") +
        "</div>",
    },
    newsletter: {
      title: "Hírlevél",
      caption: "Visszatérő vendégek elérése — minta feliratkozó-mező.",
      body:
        '<div class="cit-cfg-card" style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:center">' +
        '<span style="width:22px;height:22px;display:inline-block;color:var(--cit-accent,#b5122e)">' +
        I.mail +
        '</span><span class="cit-cfg-muted">e-mail cím…</span>' +
        '<span style="margin-left:auto;padding:.4rem .9rem;border-radius:var(--cit-radius,10px);background:var(--cit-accent,#b5122e);color:var(--cit-on-accent,#fff);font-size:.85rem">Feliratkozom</span></div>',
    },
    enquiry: {
      title: "Érdeklődés",
      caption: "Közvetlen érdeklődés-űrlap — a vendég dátumot, létszámot, üzenetet küld.",
      body:
        '<div class="cit-cfg-card" style="display:flex;align-items:center;gap:.7rem">' +
        '<span style="width:24px;height:24px;display:inline-block;color:var(--cit-accent,#b5122e)">' +
        I.mail +
        "</span><span>Érdeklődés-űrlap (minta) — nincs közvetítői jutalék.</span></div>",
    },
  };

  function sampleBlock(mod) {
    var s = SAMPLES[mod.id];
    if (!s) {
      s = { title: mod.label, caption: "Minta-előnézet — a saját adataiddal töltjük fel.", body: "" };
    }
    var node = el(
      '<section class="cit-cfg-sample" data-cit-sample="' +
        esc(mod.id) +
        '">' +
        '<span class="cit-cfg-sample__ribbon">' +
        I.check +
        "MINTA</span>" +
        "<h3>" +
        esc(s.title) +
        '</h3><p class="cit-cfg-sample__cap">' +
        esc(s.caption) +
        "</p>" +
        s.body +
        "</section>"
    );
    return node;
  }

  // ── DOM anchors ─────────────────────────────────────────────────────────────
  function presentSection(mod) {
    if (!mod.domType) return null;
    var anchor = document.querySelector('[data-cit-module="' + mod.domType + '"]');
    if (!anchor) return null;
    return anchor.closest("section") || anchor;
  }

  // sample zone appended before the footer / at the end of content
  function ensureSampleZone() {
    var z = document.getElementById("cit-cfg-samplezone");
    if (z) return z;
    z = el(
      '<div id="cit-cfg-samplezone"><p class="cit-cfg-samplezone-head">Bővíthető modulok — élő előnézet (minta). Vétellel a te adataiddal töltjük fel; a nyilvános oldalra minta-tartalom soha nem kerül.</p></div>'
    );
    var footer = document.querySelector("footer");
    if (footer && footer.parentNode) footer.parentNode.insertBefore(z, footer);
    else document.body.appendChild(z);
    return z;
  }

  // ── state ───────────────────────────────────────────────────────────────────
  // selected: id -> bool. present modules default ON; samples default OFF; spine locked ON.
  var selected = {};
  MODULES.forEach(function (m) {
    selected[m.id] = !!m.present;
  });

  function applyModule(mod, on) {
    if (mod.present) {
      var sec = presentSection(mod);
      if (sec) sec.style.display = on ? "" : "none";
    } else {
      var zone = ensureSampleZone();
      var existing = zone.querySelector('[data-cit-sample="' + mod.id + '"]');
      if (on && !existing) zone.appendChild(sampleBlock(mod));
      else if (!on && existing) existing.remove();
    }
  }

  // ── panel UI ────────────────────────────────────────────────────────────────
  var present = MODULES.filter(function (m) {
    return m.present;
  });
  var extra = MODULES.filter(function (m) {
    return !m.present;
  });

  function row(mod) {
    var on = selected[mod.id];
    var locked = mod.spine && mod.present;
    var tag = mod.present
      ? '<span class="cit-cfg-tag on">az oldaladon</span>'
      : '<span class="cit-cfg-tag sample">minta</span>';
    var r = el(
      '<div class="cit-cfg-row' +
        (locked ? " cit-cfg-locked" : "") +
        '" role="button" tabindex="' +
        (locked ? "-1" : "0") +
        '" aria-pressed="' +
        (on ? "true" : "false") +
        '" data-id="' +
        esc(mod.id) +
        '">' +
        '<span class="cit-cfg-label">' +
        esc(mod.label) +
        "</span>" +
        tag +
        '<span class="cit-cfg-sw" aria-hidden="true"></span>' +
        "</div>"
    );
    if (locked) return r;
    function toggle() {
      var next = !selected[mod.id];
      selected[mod.id] = next;
      r.setAttribute("aria-pressed", next ? "true" : "false");
      applyModule(mod, next);
      updateSummary();
    }
    r.addEventListener("click", toggle);
    r.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
    return r;
  }

  var scrim = el('<div class="cit-cfg-scrim"></div>');
  var launch = el(
    '<button class="cit-cfg-launch" type="button" aria-label="Csomag összeállítása">' +
      I.gear +
      "<span>Csomag összeállítása</span></button>"
  );
  var panel = el(
    '<aside class="cit-cfg-panel" role="dialog" aria-label="Modul-konfigurátor">' +
      '<div class="cit-cfg-head"><h2>Állítsd össze az oldalad</h2>' +
      "<p>Kapcsold be, mit szeretnél — azonnal látod. Fizetni csak utána kell.</p>" +
      '<button class="cit-cfg-close" type="button" aria-label="Bezárás">' +
      I.x +
      "</button></div>" +
      '<div class="cit-cfg-list"></div>' +
      '<div class="cit-cfg-foot"><p class="cit-cfg-sum"></p>' +
      '<button class="cit-cfg-submit" type="button">Ezt a csomagot kérem</button>' +
      '<p class="cit-cfg-note">Nem kötelezettség — jelezzük, mit szeretnél, és felvesszük veled a kapcsolatot.</p></div>' +
      "</aside>"
  );

  var list = panel.querySelector(".cit-cfg-list");
  if (present.length) {
    list.appendChild(el('<div class="cit-cfg-group">Az oldaladon</div>'));
    present.forEach(function (m) {
      list.appendChild(row(m));
    });
  }
  if (extra.length) {
    list.appendChild(el('<div class="cit-cfg-group">Bővíthető modulok</div>'));
    extra.forEach(function (m) {
      list.appendChild(row(m));
    });
  }

  var sumEl = panel.querySelector(".cit-cfg-sum");
  function updateSummary() {
    var n = 0;
    MODULES.forEach(function (m) {
      if (selected[m.id]) n++;
    });
    sumEl.innerHTML = "Választott modulok: <b>" + n + "</b>";
  }
  updateSummary();

  function open() {
    panel.classList.add("cit-cfg-open");
    scrim.classList.add("cit-cfg-open");
    launch.hidden = true;
  }
  function close() {
    panel.classList.remove("cit-cfg-open");
    scrim.classList.remove("cit-cfg-open");
    launch.hidden = false;
  }
  launch.addEventListener("click", open);
  scrim.addEventListener("click", close);
  panel.querySelector(".cit-cfg-close").addEventListener("click", close);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && panel.classList.contains("cit-cfg-open")) close();
  });

  // ── submit ──────────────────────────────────────────────────────────────────
  var submitBtn = panel.querySelector(".cit-cfg-submit");
  submitBtn.addEventListener("click", function () {
    var chosen = MODULES.filter(function (m) {
      return selected[m.id];
    }).map(function (m) {
      return m.id;
    });
    submitBtn.disabled = true;
    submitBtn.textContent = "Küldés…";
    var url = CFG.requestUrl;
    if (!url) {
      showThanks(chosen);
      return;
    }
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ modules: chosen }),
    })
      .then(function () {
        showThanks(chosen);
      })
      .catch(function () {
        showThanks(chosen);
      });
  });

  function showThanks(chosen) {
    var foot = panel.querySelector(".cit-cfg-foot");
    foot.innerHTML =
      '<p class="cit-cfg-sum"><b>Köszönjük!</b> Rögzítettük a választott csomagod (' +
      chosen.length +
      " modul). Hamarosan jelentkezünk az élesítés részleteivel.</p>" +
      '<p class="cit-cfg-note">A nyilvános oldalra minta-tartalom soha nem kerül — a modulokat a te valódi adataiddal töltjük fel.</p>';
  }

  // ── mount ───────────────────────────────────────────────────────────────────
  function mount() {
    // Apply initial state (present modules already visible; samples off → no-op).
    document.body.appendChild(scrim);
    document.body.appendChild(panel);
    document.body.appendChild(launch);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
