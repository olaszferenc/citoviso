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

  // ADR-0036: buyer-facing strings resolve through the manifest-carried pack
  // (CFG.i18n, injected server-side). Hungarian → empty map → tr() is identity.
  var I18N = (CFG && CFG.i18n) || {};
  function tr(s) { return I18N[s] || s; }

  // ── instrumentation (PILOT.md §3) — only on the tracked /p/<token> route ────
  // Fire-and-forget beacons; measurement must never break the page. No cookies:
  // the identity is the outreach token, the session is the server-issued viewId.
  var TRACK = CFG.track || null;
  function track(type, payload) {
    if (!TRACK) return;
    try {
      var body = JSON.stringify({ viewId: TRACK.viewId, type: type, payload: payload || {} });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(TRACK.url, new Blob([body], { type: "application/json" }));
      } else {
        fetch(TRACK.url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: body,
          keepalive: true,
        }).catch(function () {});
      }
    } catch (e) {
      /* measurement must never break the page */
    }
  }
  if (TRACK) {
    // Scroll-depth milestones (each fired once) — the engagement signal.
    var fired = {};
    window.addEventListener(
      "scroll",
      function () {
        var doc = document.documentElement;
        var max = doc.scrollHeight - window.innerHeight;
        if (max <= 0) return;
        var pct = Math.round((window.scrollY / max) * 100);
        [25, 50, 75, 100].forEach(function (m) {
          if (pct >= m && !fired[m]) {
            fired[m] = true;
            track("scroll", { pct: m });
          }
        });
      },
      { passive: true },
    );
    // Dwell heartbeat every 15s while the tab is visible (capped at 10 min).
    var dwell = 0;
    var beat = setInterval(function () {
      if (document.visibilityState !== "visible") return;
      dwell += 15;
      track("dwell", { seconds: dwell });
      if (dwell >= 600) clearInterval(beat);
    }, 15000);
    // Final dwell on leave (sendBeacon survives unload).
    window.addEventListener("pagehide", function () {
      track("dwell_end", { seconds: dwell });
    });
  }

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
    spark:
      '<svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6zM18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/></svg>',
    x: '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    chev:
      '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    chevR:
      '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
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
    info:
      '<svg viewBox="0 0 24 24" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5h.01"/></svg>',
    eye:
      '<svg viewBox="0 0 24 24" stroke-width="1.6"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/></svg>',
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
      title: tr("Galéria"),
      caption: tr("Így jelennének meg a valódi fotóid — a te képeiddel töltjük fel."),
      body: tiles(6, I.image),
    },
    rooms: {
      title: tr("Szobák / apartmanok"),
      caption: tr("Minta-szobakártyák — a saját szobáid, áraid és fotóid kerülnek ide."),
      body:
        '<div class="cit-cfg-grid">' +
        [1, 2, 3]
          .map(function () {
            return (
              '<div class="cit-cfg-card"><div class="cit-cfg-tile" style="aspect-ratio:3/2;margin-bottom:.6rem">' +
              I.bed +
              "</div><p><b>" + tr("Szoba neve") + "</b></p><p class=\"cit-cfg-muted\">" + tr("2 fő · minta leírás") + "</p></div>"
            );
          })
          .join("") +
        "</div>",
    },
    amenities: {
      title: tr("Felszereltség"),
      caption: tr("Minta-lista — a tényleges szolgáltatásaidat jelöljük be."),
      body:
        '<div class="cit-cfg-grid" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr))">' +
        [
          [I.wifi, tr("Ingyen Wi‑Fi")],
          [I.check, tr("Parkolás")],
          [I.check, tr("Reggeli")],
          [I.check, tr("Klíma")],
          [I.check, tr("Kisállat")],
          [I.check, tr("Terasz")],
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
      title: tr("Árak / szezonok"),
      caption: tr("Minta-ártábla — a saját szezonáraidat állítjuk be (nem valós árak)."),
      body:
        '<div class="cit-cfg-rows">' +
        [
          [tr("Főszezon"), tr("— Ft / éj")],
          [tr("Elő- és utószezon"), tr("— Ft / éj")],
          [tr("Téli időszak"), tr("— Ft / éj")],
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
      title: tr("Térkép / megközelítés"),
      caption: tr("Interaktív térkép a pontos címeddel — kattintásra tölt (adatvédelem)."),
      body:
        '<div class="cit-cfg-tile" style="aspect-ratio:16/6">' +
        I.pin +
        "</div>",
    },
    booking: {
      title: tr("Foglalás"),
      caption: tr("Élő foglalási naptár — élesítés utáni felár-modul (közvetlen foglalás, jutalék nélkül)."),
      body:
        '<div class="cit-cfg-card" style="display:flex;align-items:center;gap:.7rem">' +
        '<span style="width:24px;height:24px;display:inline-block;color:var(--cit-accent,#b5122e)">' +
        I.cal +
        "</span><span>" + tr("Dátumválasztó + azonnali visszaigazolás (minta)") + "</span></div>",
    },
    hours: {
      title: tr("Nyitvatartás / be-kijelentkezés"),
      caption: tr("Minta-időpontok — a saját be- és kijelentkezési rended kerül ide."),
      body:
        '<div class="cit-cfg-rows">' +
        [
          [tr("Bejelentkezés"), tr("14:00-től")],
          [tr("Kijelentkezés"), tr("10:00-ig")],
          [tr("Recepció"), tr("minta időpont")],
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
      title: tr("„Miért mi” — előnyök"),
      caption: tr("Minta-előnyök — a valódi megkülönböztető erősségeidet emeljük ki."),
      body:
        '<div class="cit-cfg-grid">' +
        [tr("Csendes, mégis központi"), tr("Saját parkoló"), tr("Személyes vendéglátás")]
          .map(function (t) {
            return (
              '<div class="cit-cfg-card"><span style="width:24px;height:24px;display:inline-block;color:var(--cit-accent,#b5122e)">' +
              I.check +
              "</span><p><b>" +
              t +
              "</b></p><p class=\"cit-cfg-muted\">" + tr("Minta indoklás — a te szavaiddal.") + "</p></div>"
            );
          })
          .join("") +
        "</div>",
    },
    reviews: {
      title: tr("Vélemények"),
      caption: tr("Ide kerülnek a valódi vendégértékeléseid — most minta-szöveg."),
      body:
        '<div class="cit-cfg-grid">' +
        [
          [tr("Kiváló hely, visszatérünk!"), tr("Vendég · minta")],
          [tr("Tiszta, csendes, kedves fogadtatás."), tr("Vendég · minta")],
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
      title: tr("Környék / látnivalók"),
      caption: tr("Minta-lista — a közeli látnivalókat, távolságokat mi állítjuk össze."),
      body:
        '<div class="cit-cfg-rows">' +
        [
          [tr("Látnivaló a közelben"), tr("— perc")],
          [tr("Strand / túraútvonal"), tr("— km")],
          [tr("Étterem / borászat"), tr("— perc")],
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
      title: tr("Hírlevél"),
      caption: tr("Visszatérő vendégek elérése — minta feliratkozó-mező."),
      body:
        '<div class="cit-cfg-card" style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:center">' +
        '<span style="width:22px;height:22px;display:inline-block;color:var(--cit-accent,#b5122e)">' +
        I.mail +
        '</span><span class="cit-cfg-muted">' + tr("e-mail cím…") + "</span>" +
        '<span style="margin-left:auto;padding:.4rem .9rem;border-radius:var(--cit-radius,10px);background:var(--cit-accent,#b5122e);color:var(--cit-on-accent,#fff);font-size:.85rem">' + tr("Feliratkozom") + "</span></div>",
    },
    enquiry: {
      title: tr("Érdeklődés"),
      caption: tr("Közvetlen érdeklődés-űrlap — a vendég dátumot, létszámot, üzenetet küld."),
      body:
        '<div class="cit-cfg-card" style="display:flex;align-items:center;gap:.7rem">' +
        '<span style="width:24px;height:24px;display:inline-block;color:var(--cit-accent,#b5122e)">' +
        I.mail +
        "</span><span>" + tr("Érdeklődés-űrlap (minta) — nincs közvetítői jutalék.") + "</span></div>",
    },
  };

  function sampleBlock(mod) {
    var s = SAMPLES[mod.id];
    if (!s) {
      s = { title: mod.label, caption: tr("Minta-előnézet — a saját adataiddal töltjük fel."), body: "" };
    }
    var node = el(
      '<section class="cit-cfg-sample" data-cit-sample="' +
        esc(mod.id) +
        '">' +
        '<span class="cit-cfg-sample__ribbon">' +
        I.check +
        tr("MINTA") +
        "</span>" +
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
  // Every anchor a module owns: a module can have several page states (reviews
  // renders as real quotes, as the pending block, or as the collection form).
  function anchorsOf(mod) {
    var a = [];
    if (mod.domType) a.push(mod.domType);
    (mod.domTypesAlso || []).forEach(function (t) { a.push(t); });
    return a;
  }
  // ALL matching sections, not just the first: booking has a slim jump-band AND the
  // full closing section (ADR-0062) — the toggle must move both together.
  function presentSectionsAll(mod) {
    var out = [];
    anchorsOf(mod).forEach(function (t) {
      document.querySelectorAll('[data-cit-module="' + t + '"]').forEach(function (a) {
        var sec = a.closest("section") || a;
        if (out.indexOf(sec) < 0) out.push(sec);
      });
    });
    return out;
  }
  /**
   * A section can be the surface of SEVERAL modules (ADR-0059 weaves amenities + usp
   * into the same native selling-points section). It stays visible while ANY selected
   * module points at it — otherwise switching one off would hide content the prospect
   * still pays for. This is what makes every toggle VISIBLY do something (§I): the
   * owner switched packages and the page did not move, which reads as a con.
   */
  function anchorWanted(anchor) {
    for (var i = 0; i < MODULES.length; i++) {
      var m = MODULES[i];
      if (selected[m.id] && anchorsOf(m).indexOf(anchor) >= 0) return true;
    }
    return false;
  }
  /**
   * ⛔ The CALLING surfaces must follow the booking module (owner 2026-08-25).
   *
   * Hiding the booking section was not enough: the hero band and every nav button
   * still read "Foglalás / Szabad időpontok megtekintése" in a package WITHOUT
   * booking, and pointed at a section that no longer existed. Offering what the
   * buyer is not paying for is a con, so the band's title, the button label and
   * every link that targets the booking section switch with the module. Without
   * booking the page falls back to the enquiry wording — the backbone that is
   * always included (ADR-0048: one process per page).
   */
  var CTA = CFG.cta || null;
  function applyBookingCta(on) {
    if (!CTA) return; // old artifact: leave the server-rendered wording alone
    var want = on ? CTA.booking : CTA.enquiry;
    var other = on ? CTA.enquiry : CTA.booking;
    var bar = document.getElementById("cit-enquiry");
    if (bar) {
      var t = bar.querySelector(".cit-enquiry-bar-title");
      if (t) t.textContent = want.title;
      var btn = bar.querySelector("a.cit-btn, .cit-btn");
      if (btn) {
        btn.textContent = want.button;
        if (btn.tagName === "A") btn.setAttribute("href", want.href);
      }
    }
    // Nav / hero / sticky links that point at the booking section.
    var sel = 'a[href="' + other.href + '"], a[href="' + want.href + '"]';
    document.querySelectorAll(sel).forEach(function (a) {
      if (bar && bar.contains(a)) return; // handled above
      a.setAttribute("href", want.href);
      var txt = (a.textContent || "").trim();
      if (/foglal|érdeklőd/i.test(txt)) a.textContent = want.title;
    });
  }

  function refreshSections(mod) {
    anchorsOf(mod).forEach(function (t) {
      var want = anchorWanted(t);
      document.querySelectorAll('[data-cit-module="' + t + '"]').forEach(function (a) {
        var sec = a.closest("section") || a;
        sec.style.display = want ? "" : "none";
      });
    });
  }

  // ── where a sample belongs (ADR-0047) ───────────────────────────────────────
  // Same four groups the engine uses server-side (moduleSections.ts). A sample must
  // appear WHERE the real module will appear after purchase — otherwise the mock is
  // not the thing we are selling.
  var SLOT_OF = {
    rooms: "showcase",
    pricing: "showcase",
    amenities: "showcase",
    usp: "showcase",
    gallery: "showcase",
    reviews: "trust",
    hours: "practical",
    location: "practical",
    poi: "practical",
    newsletter: "closing",
    booking: "closing",
    enquiry: "closing",
    email: "closing",
  };

  /** The template's named place for this module, if it has one. */
  function slotFor(mod) {
    var name = SLOT_OF[mod.id];
    return name ? document.querySelector('[data-cit-slot="' + name + '"]') : null;
  }

  // ── one content type ONCE (ADR-0059) ────────────────────────────────────────
  // The renderer stamps <body data-cit-native="…"> with the content types the
  // template's OWN sections already demonstrate (measured, not assumed). A generic
  // sample card next to a native section of the same type is exactly the
  // "duplikáció, oda vannak baszva a végére" the owner rejected twice — the native
  // section IS the demo, so no second block is injected for these. Old artifacts
  // without the stamp keep the previous behaviour.
  var NATIVE_TYPE_OF = {
    amenities: "selling-points",
    usp: "selling-points",
    rooms: "rooms",
    gallery: "gallery",
    reviews: "reviews",
    // ADR-0061 mock all-in: these render server-side as native-styled (marked-
    // sample) sections, so the stamp lists them and no generic card is injected.
    hours: "hours",
    pricing: "pricing",
    poi: "poi",
    newsletter: "newsletter",
    location: "map",
    booking: "booking",
  };
  // Modules with no page surface at all (mailbox service): a sample card would be
  // an empty ribbon — the panel row and its price do the selling.
  var NO_SAMPLE = { email: true };
  function nativelyDemoed(mod) {
    if (NO_SAMPLE[mod.id]) return true;
    var t = NATIVE_TYPE_OF[mod.id];
    if (!t) return false;
    var stamp = document.body.getAttribute("data-cit-native") || "";
    return (" " + stamp + " ").indexOf(" " + t + " ") >= 0;
  }

  // THE PAGE footer — not the first <footer> in the document.
  //
  // 12 of the 16 templates mark a review's author line with <footer> inside a
  // <blockquote>, so `querySelector("footer")` returned a quote's byline and the
  // entire module offer was injected INSIDE a review card: measured 295–530px wide
  // instead of full width. That is the "one strip on the left" the owner saw.
  // Walk backwards and skip any footer nested in quote/figure/article markup.
  function pageFooter() {
    var all = document.querySelectorAll("footer");
    for (var i = all.length - 1; i >= 0; i--) {
      if (!all[i].closest("blockquote, figure, article, .cit-cfg-sample")) return all[i];
    }
    return null;
  }

  // Fallback zone for artifacts generated BEFORE slot markers existed (already-sent
  // mocks still have to work) and for any module whose slot the template omits.
  function ensureSampleZone() {
    var z = document.getElementById("cit-cfg-samplezone");
    if (z) return z;
    z = el(
      '<div id="cit-cfg-samplezone"><p class="cit-cfg-samplezone-head">' +
        tr("Bővíthető modulok — élő előnézet (minta). Vétellel a te adataiddal töltjük fel; a nyilvános oldalra minta-tartalom soha nem kerül.") +
        "</p></div>"
    );
    var footer = pageFooter();
    if (footer && footer.parentNode) footer.parentNode.insertBefore(z, footer);
    else document.body.appendChild(z);
    return z;
  }

  // ── state ───────────────────────────────────────────────────────────────────
  // ALL-IN anchoring (2026-07-16): every module starts ON — the prospect first
  // sees the FULL, rich version ("Íme az új oldala"), then trims DOWN to the
  // package they'll pay for (losing what they saw drives the upsell).
  //
  // FIXED (ADR-0047): the samples used to be withheld until the first panel open,
  // so "we show everything up front" simply did not happen — the lead opened the
  // link and saw a page with two of the twelve modules on it. Only fiddling with a
  // toggle brought the rest in. Now they are placed on first paint, which is what
  // ALL-IN was supposed to mean.
  var selected = {};
  MODULES.forEach(function (m) {
    selected[m.id] = true;
  });
  var samplesRevealed = false;
  function revealSamples() {
    if (samplesRevealed) return;
    samplesRevealed = true;
    MODULES.forEach(function (m) {
      if (!m.present && selected[m.id]) applyModule(m, true);
    });
  }

  function applyModule(mod, on) {
    if (mod.id === "booking") applyBookingCta(on);
    if (mod.present) {
      // Shared-surface aware: the section follows the OR of every module that owns
      // its anchor, not just this one (amenities + usp share one native section).
      refreshSections(mod);
      return;
    }
    var existing = document.querySelector('[data-cit-sample="' + mod.id + '"]');
    if (!on) {
      if (existing) existing.remove();
      return;
    }
    if (existing) return;
    // ADR-0059: the page's native section already demonstrates this content type —
    // a second, generic block of the same type is forbidden, so nothing to inject.
    if (nativelyDemoed(mod)) return;
    // Preferred: the template's own named place, so the sample sits where the real
    // module will sit after purchase. Fallback: the collector zone (old artifacts).
    var slot = slotFor(mod);
    if (slot) slot.appendChild(sampleBlock(mod));
    else ensureSampleZone().appendChild(sampleBlock(mod));
  }

  // ── panel UI (preset-first, plain owner language) ───────────────────────────
  // A non-tech owner picks ONE package in one click; the detailed 12-toggle view
  // hides behind "Testre szabom". No jargon (publicLabel only), formal "Ön" tone.
  var GROUPS = CFG.groups || {};
  var PRESETS = CFG.presets || [];
  var GROUP_ORDER = ["offer", "reach", "extra"];
  var rowsById = {};

  // ── pricing (base + Σ selected module; annual = 12 − freeMonths) ─────────────
  var PRICING = CFG.pricing || { base: 0, annualFreeMonths: 0, currency: "Ft" };
  // ADR-0088: the prospect's single best ACTIVE offer (server-resolved, never
  // stacked). Display-only here — the server recomputes and stamps the charged
  // amount; but what we SHOW must equal what will be charged (§B.17).
  var OFFER = PRICING.offer || null;
  // Mirrors src/payment/offers.ts applyOffer(): floor, never overcharge.
  function offerPrice(n) {
    return OFFER ? Math.floor((n * (100 - OFFER.percent)) / 100) : n;
  }
  function offerDeadline() {
    return OFFER && OFFER.expiresAt ? new Date(OFFER.expiresAt) : null;
  }
  function offerDeadlineText() {
    var d = offerDeadline();
    if (!d) return "";
    try {
      return (
        d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
        " " +
        d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      );
    } catch (e) {
      return d.toISOString().slice(0, 16).replace("T", " ");
    }
  }
  // ANNUAL is the default (owner decree 2026-08-23): it is the better deal for the
  // buyer (two months free) and the healthier commitment for us — the monthly option
  // stays one tap away.
  var period = "annual"; // "monthly" | "annual"
  var priceById = {};
  MODULES.forEach(function (m) {
    priceById[m.id] = m.price || 0;
  });
  function fmt(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " " + PRICING.currency;
  }
  // Shared-slot rule (tulaj, 2026-08-21): a selected module can REPLACE another
  // ("ha van foglalás, akkor nincs érdeklődés"). The replaced one does not render
  // and must not be charged — billing for a section the page cannot show would be
  // selling nothing. `set` maps id → truthy for the selection being priced.
  function supersededIn(id, set) {
    for (var i = 0; i < MODULES.length; i++) {
      var m = MODULES[i];
      if (!m.supersedes || m.supersedes.indexOf(id) < 0) continue;
      if (set[m.id] || (m.spine && m.present)) return m.id;
    }
    return null;
  }
  function countsToward(m, set) {
    return !!set[m.id] && !supersededIn(m.id, set);
  }
  function monthlyTotal() {
    var t = PRICING.base;
    MODULES.forEach(function (m) {
      if (countsToward(m, selected)) t += priceById[m.id];
    });
    return t;
  }
  function annualTotal() {
    return monthlyTotal() * (12 - PRICING.annualFreeMonths);
  }
  function presetMonthly(p) {
    var set = {};
    (p.modules || []).forEach(function (id) {
      set[id] = true;
    });
    var t = PRICING.base;
    MODULES.forEach(function (m) {
      if (countsToward(m, set)) t += priceById[m.id];
    });
    return t;
  }

  // See-the-change feedback: after ANY toggle-on (present OR sample) the page
  // scrolls to the affected section and flashes an accent outline on it — the
  // prospect must SEE what their choice did (the whole sell is the live preview).
  function targetSection(mod) {
    if (mod.present) return presentSection(mod);
    var zone = document.getElementById("cit-cfg-samplezone");
    return zone ? zone.querySelector('[data-cit-sample="' + mod.id + '"]') : null;
  }
  var flashTimer = null;
  function revealChange(mod) {
    var sec = targetSection(mod);
    if (!sec) return;
    // Keep the section clear of the mobile bottom sheet / panel edge.
    sec.style.scrollMarginTop = "12vh";
    if (sec.scrollIntoView) sec.scrollIntoView({ behavior: "smooth", block: "start" });
    document.querySelectorAll(".cit-cfg-flash").forEach(function (n) {
      n.classList.remove("cit-cfg-flash");
    });
    void sec.offsetWidth; // restart the outline animation
    sec.classList.add("cit-cfg-flash");
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(function () {
      sec.classList.remove("cit-cfg-flash");
    }, 2600);
  }
  function setRow(mod, on) {
    var r = rowsById[mod.id];
    if (!r) return;
    if (!(mod.spine && mod.present)) r.setAttribute("aria-pressed", on ? "true" : "false");
    // ⛔ The tag must follow the STATE, not just the manifest (owner 2026-08-25):
    // The "on the page" label sat next to a switched-OFF booking module, flatly
    // contradicting both the switch and the page itself. That label means the module
    // IS on the page — so when it is not, the tag has to say so.
    var tagEl = r.querySelector(".cit-cfg-tag");
    if (!tagEl || supersededIn(mod.id, selected)) return; // the replaced-state label is owned by refreshSuperseded
    if (mod.spine && mod.present) return; // backbone keeps its included-in-price label
    if (on) {
      tagEl.className = mod.present ? "cit-cfg-tag on" : "cit-cfg-tag sample";
      tagEl.textContent = mod.present ? tr("megvan") : tr("minta");
    } else {
      tagEl.className = "cit-cfg-tag off";
      tagEl.textContent = tr("nincs az oldalon");
    }
  }
  function setActivePreset(id) {
    panel.querySelectorAll(".cit-cfg-preset").forEach(function (b) {
      b.classList.toggle("cit-cfg-preset--on", b.getAttribute("data-preset") === id);
    });
  }
  function markCustom() {
    setActivePreset("__custom__");
  }

  // Repaint rows whose replaced-state just changed, so "kiváltva" appears/disappears
  // the moment the replacing module is switched. The row itself stays in place —
  // the prospect must still SEE the module they know about, just visibly inactive.
  function refreshSuperseded(ids) {
    (ids || []).forEach(function (id) {
      var r = rowsById[id];
      if (!r) return;
      var replaced = !!supersededIn(id, selected);
      r.classList.toggle("cit-cfg-replaced", replaced);
      r.classList.toggle("cit-cfg-locked", replaced);
      r.setAttribute("tabindex", replaced ? "-1" : "0");
      // BOTH directions. Only the "replaced" branch existed, so a row that STOPPED
      // being replaced kept the replaced-label and its off state — the owner saw the
      // enquiry row marked as replaced in a package with no booking at all
      // (2026-08-25). A label that survives its own reason is a lie about the offer.
      r.setAttribute("aria-pressed", replaced ? "false" : selected[id] ? "true" : "false");
      var tagEl = r.querySelector(".cit-cfg-tag");
      var def = MODULES.filter(function (m) { return m.id === id; })[0];
      if (tagEl) {
        if (replaced) {
          tagEl.className = "cit-cfg-tag off";
          tagEl.textContent = tr("kiváltva");
        } else if (!selected[id]) {
          tagEl.className = "cit-cfg-tag off";
          tagEl.textContent = tr("nincs az oldalon");
        } else if (def && def.present) {
          tagEl.className = "cit-cfg-tag on";
          tagEl.textContent = tr("megvan");
        } else {
          tagEl.className = "cit-cfg-tag sample";
          tagEl.textContent = tr("minta");
        }
      }
      var priceEl = r.querySelector(".cit-cfg-price");
      if (priceEl) priceEl.textContent = replaced ? "" : tr("az árban");
    });
  }

  function row(mod) {
    var on = selected[mod.id];
    // Replaced by another selected module (they share a slot): locked off, unpriced,
    // and the reason is shown — silently dropping it would look like a glitch.
    var replacer = supersededIn(mod.id, selected);
    var locked = (mod.spine && mod.present) || !!replacer;
    var tag = replacer
      ? '<span class="cit-cfg-tag off">' + tr("kiváltva") + "</span>"
      : mod.present
        ? '<span class="cit-cfg-tag on">' + tr("megvan") + "</span>"
        : '<span class="cit-cfg-tag sample">' + tr("minta") + "</span>";
    var r = el(
      '<div class="cit-cfg-row' +
        (locked ? " cit-cfg-locked" : "") +
        (replacer ? " cit-cfg-replaced" : "") +
        '" role="button" tabindex="' +
        (locked ? "-1" : "0") +
        '" aria-pressed="' +
        (on && !replacer ? "true" : "false") +
        '" data-id="' +
        esc(mod.id) +
        '">' +
        '<span class="cit-cfg-label">' +
        esc(mod.label) +
        "</span>" +
        tag +
        '<span class="cit-cfg-price">' +
        (replacer ? "" : mod.price ? "+" + fmt(mod.price) : mod.spine ? tr("az árban") : "") +
        "</span>" +
        '<span class="cit-cfg-sw" aria-hidden="true"></span>' +
        "</div>"
    );
    rowsById[mod.id] = r;
    var wrap = el('<div class="cit-cfg-rowbox"></div>');
    wrap.appendChild(r);
    // Info disclosure: a plain one-liner about what the module DOES + a
    // "show me on the page" jump — the ask behind the icon (2026-08-19).
    if (mod.desc) {
      var infoBtn = el(
        '<button class="cit-cfg-inf" type="button" aria-expanded="false" aria-label="' +
          tr("Mi ez?") +
          '">' +
          I.info +
          "</button>"
      );
      r.insertBefore(infoBtn, r.querySelector(".cit-cfg-tag"));
      var descEl = el(
        '<div class="cit-cfg-desc" hidden><p>' +
          esc(tr(mod.desc)) +
          "</p>" +
          '<button class="cit-cfg-see" type="button">' +
          I.eye +
          "<span>" + tr("Megnézem az oldalon") + "</span></button></div>"
      );
      wrap.appendChild(descEl);
      infoBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        var opening = descEl.hasAttribute("hidden");
        if (opening) {
          descEl.removeAttribute("hidden");
          infoBtn.setAttribute("aria-expanded", "true");
          track("module_info", { module: mod.id });
        } else {
          descEl.setAttribute("hidden", "");
          infoBtn.setAttribute("aria-expanded", "false");
        }
      });
      descEl.querySelector(".cit-cfg-see").addEventListener("click", function (e) {
        e.stopPropagation();
        // If the module is off, seeing it means turning it on first.
        if (!selected[mod.id] && !locked) {
          toggle();
        } else {
          // Phone bottom-sheet covers most of the page — slide it away for the
          // full view; the edge tab brings the panel (and the state) back.
          if (window.matchMedia && window.matchMedia("(max-width: 560px)").matches) collapse();
          revealChange(mod);
        }
        track("module_see", { module: mod.id });
      });
    }
    if (locked) return wrap;
    function toggle() {
      var next = !selected[mod.id];
      selected[mod.id] = next;
      r.setAttribute("aria-pressed", next ? "true" : "false");
      applyModule(mod, next);
      setRow(mod, next); // the tag follows the state (see setRow)
      // Toggling a module that REPLACES another (booking → enquiry) changes the
      // other row too, so refresh the affected rows rather than only this one.
      if (mod.supersedes) refreshSuperseded(mod.supersedes);
      if (next) revealChange(mod); // see-the-change feedback (present + sample)
      markCustom();
      updateSummary();
      track(next ? "module_add" : "module_remove", { module: mod.id });
    }
    r.addEventListener("click", function (e) {
      // Inner buttons (info) handle themselves.
      if (e.target && e.target.closest && e.target.closest(".cit-cfg-inf")) return;
      toggle();
    });
    r.addEventListener("keydown", function (e) {
      if (e.target !== r) return; // Enter on the inner info button stays there
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
    return wrap;
  }

  /**
   * Switch packages — in TWO PHASES, and that ordering is the whole point.
   *
   * The bug it fixes (owner report, twice): switching between the three packages
   * changed the price but not the page — "mintha egymást kioltanák". Cause: this
   * used to PAINT each module (applyModule) and only THEN record its new state, so
   * every paint read a half-updated `selected` map. Since a section follows the OR
   * of every module that owns its anchor, a stale map keeps sections the new package
   * dropped and withholds the ones it adds.
   *
   * So: settle the entire selection first, then paint from the settled state.
   */
  function applyPreset(p) {
    var set = {};
    p.modules.forEach(function (id) {
      set[id] = true;
    });
    // PHASE 1 — the whole selection, no DOM touched yet.
    MODULES.forEach(function (m) {
      selected[m.id] = !!set[m.id] || !!(m.spine && m.present); // backbone always on
    });
    // PHASE 2 — paint every module from the settled state.
    MODULES.forEach(function (m) {
      applyModule(m, selected[m.id]);
      setRow(m, selected[m.id]);
    });
    // Replacement rows (booking → enquiry) repaint last: their label depends on
    // what else ended up selected.
    MODULES.forEach(function (m) {
      if (m.supersedes) refreshSuperseded(m.supersedes);
    });
    setActivePreset(p.id);
    updateSummary();
  }

  // ── domain step (ADR-0020) ──────────────────────────────────────────────────
  // Default = platform subdomain (in the price, zero friction). Custom domain
  // through us = yearly fee + minimum 24-month subscription commitment; we offer
  // free-sounding candidates with a PRELIMINARY availability check (server-side).
  var DOM = CFG.domain || null;
  var domainType = "citoviso_sub"; // "citoviso_sub" | "citoviso_registered"
  var domainName = DOM ? DOM.sub : null;
  var domainListLoaded = false;
  // ADR-0032: buyer-chosen platform subdomain state.
  var subHost = DOM ? DOM.sub : null; // last VALID chosen host (label + base)
  var subOk = true; // is the current subdomain label available?
  function refreshSubmit() {
    var btn = panel.querySelector(".cit-cfg-submit");
    var rb = panel.querySelector(".cit-cfg-rights");
    if (!btn) return;
    btn.disabled = !(rb && rb.checked) || (domainType === "citoviso_sub" && !subOk);
  }

  function domainSectionHtml() {
    if (!DOM) return "";
    var years = Math.round(DOM.minCommitmentMonths / 12);
    return (
      '<div class="cit-cfg-dsec">' +
      '<div class="cit-cfg-q">' + tr("Címe az interneten") + "</div>" +
      '<p class="cit-cfg-dsec__sub">' + tr("Ezen a webcímen lesz elérhető az elkészült oldala.") + "</p>" +
      '<div class="cit-cfg-domain">' +
      '<div class="cit-cfg-dopt cit-cfg-dopt--on" role="button" tabindex="0" data-dom="sub" aria-pressed="true">' +
      '<span class="cit-cfg-dopt__dot" aria-hidden="true"></span>' +
      '<span class="cit-cfg-dopt__txt"><b>' + tr("Ingyenes cím a citoviso.com-on") + "</b>" +
      "<span>" + tr("Az árban — azonnal működik. Válassza meg szabadon:") + "</span></span></div>" +
      // ADR-0032: free-choice subdomain label + live availability check.
      '<div class="cit-cfg-sub">' +
      '<span class="cit-cfg-sub__in"><input class="cit-cfg-sub__label" type="text" spellcheck="false" ' +
      'autocapitalize="off" value="' + esc(DOM.subLabel) + '" aria-label="' + tr("Aldomain neve") + '">' +
      '<span class="cit-cfg-sub__base">' + esc(DOM.subBase) + "</span></span>" +
      '<span class="cit-cfg-sub__status" aria-live="polite"></span></div>' +
      '<div class="cit-cfg-dopt" role="button" tabindex="0" data-dom="custom" aria-pressed="false">' +
      '<span class="cit-cfg-dopt__dot" aria-hidden="true"></span>' +
      '<span class="cit-cfg-dopt__txt"><b>' + tr("Saját domainnév") + "</b><span>" +
      tr("+{price}/év · minimum {years} éves előfizetéssel")
        .replace("{price}", fmt(DOM.customYearly))
        .replace("{years}", String(years)) +
      "</span></span></div>" +
      '<div class="cit-cfg-dlist" hidden><p class="cit-cfg-dlist__load">' + tr("Szabad nevek keresése…") + "</p></div>" +
      // Own name (tulaj, 2026-08-21): our 3–5 candidates are guesses from the business
      // name — the owner may already have a name in mind, and being offered only our
      // list would read as "you can have any name, as long as it is one of these".
      //
      // Only where the server can actually answer (DOM.checkUrl). This overlay is
      // served by whatever backend hosts the mock, and an older one has no check
      // endpoint — an "Ellenőrzés" button that can never say yes or no is worse than
      // no button at all.
      (DOM.checkUrl
        ? '<div class="cit-cfg-own" hidden>' +
          '<div class="cit-cfg-own__q">' + tr("Egyik sem tetszik? Adja meg a sajátját:") + "</div>" +
          '<div class="cit-cfg-own__row">' +
          '<input class="cit-cfg-own__in" type="text" spellcheck="false" autocapitalize="off" ' +
          'autocorrect="off" inputmode="url" placeholder="pelda.hu" aria-label="' + tr("Saját domain név") + '">' +
          '<button class="cit-cfg-own__btn" type="button">' + tr("Ellenőrzés") + "</button>" +
          "</div>" +
          '<p class="cit-cfg-own__status" aria-live="polite"></p>' +
          "</div>"
        : "") +
      "</div>" +
      "</div>"
    );
  }

  var scrim = el('<div class="cit-cfg-scrim"></div>');
  var launch = el(
    '<button class="cit-cfg-launch" type="button" aria-label="' + tr("Állítsa össze a saját oldalát") + '">' +
      I.spark +
      "<span>" + tr("Ez lehet az Öné — állítsa össze") + "</span></button>"
  );
  var panel = el(
    '<aside class="cit-cfg-panel" role="dialog" aria-label="' + tr("Az Ön oldala") + '">' +
      // Protruding edge tab: collapse/expand without losing the configuration.
      '<button class="cit-cfg-handle" type="button" aria-label="' + tr("Panel elrejtése / megnyitása") + '">' +
      I.chevR +
      "</button>" +
      '<div class="cit-cfg-head"><h2>' + tr("Ez az Ön leendő weboldala") + "</h2>" +
      "<p>" + tr("Válassza ki, mit mutasson — azonnal látja. Most nem fizet semmit.") + "</p>" +
      '<button class="cit-cfg-close" type="button" aria-label="' + tr("Bezárás") + '">' +
      I.x +
      "</button></div>" +
      '<div class="cit-cfg-body">' +
      '<div class="cit-cfg-q">' + tr("Milyen legyen az oldala?") + "</div>" +
      '<div class="cit-cfg-presets"></div>' +
      // Open by DEFAULT (tulaj, 2026-08-21): the prospect must see the itemised
      // switches and the price moving with them without hunting for a disclosure.
      // The button stays as the collapse control for anyone who wants it out of
      // the way; the preset cards above remain the one-click path.
      // Its own surface (tulaj, 2026-08-21): the itemised area is a DIFFERENT kind of
      // choice from the package cards above it (one-click package vs. switch-by-switch),
      // so it reads as its own workbench instead of a run-on list.
      '<div class="cit-cfg-custombox">' +
      '<button class="cit-cfg-customize" type="button" aria-expanded="true">' +
      '<span class="cit-cfg-customize__txt"><b>' + tr("Testre szabom") + "</b>" +
      "<span>" + tr("Egyedi csomag — tételesen kiválasztom, mely szekciók jelenjenek meg") + "</span></span>" +
      '<span class="cit-cfg-chev" aria-hidden="true">' +
      I.chev +
      "</span></button>" +
      '<div class="cit-cfg-detail"></div>' +
      "</div>" +
      domainSectionHtml() +
      "</div>" +
      // Three-step footer: step 1 = running total + "Tovább"; step 2 = billing
      // period + §A declaration; step 3 = WHO is buying (0029) + pay button.
      '<div class="cit-cfg-foot">' +
      // billing-period toggle lives on STEP 1, right above the total it controls
      // (owner decree 2026-09-01, contract: design-refs/console/period-toggle-step1):
      // a step-2 toggle was undiscoverable on mobile — the price showed "/ év" with no
      // switch in sight. Variant B (two option cards) makes the annual discount explicit.
      '<div class="cit-cfg-permat" role="group" aria-label="' + tr("Fizetési gyakoriság") + '">' +
      '<button class="cit-cfg-popt" type="button" data-period="monthly">' +
      '<span class="cit-cfg-popt__t">' + tr("Havi") + "</span>" +
      '<span class="cit-cfg-popt__s">' + tr("rugalmas, bármikor") + "</span></button>" +
      '<button class="cit-cfg-popt cit-cfg-popt--on" type="button" data-period="annual">' +
      '<span class="cit-cfg-popt__badge">' +
      tr("{n} hó ingyen").replace("{n}", String(PRICING.annualFreeMonths)) + "</span>" +
      '<span class="cit-cfg-popt__t">' + tr("Éves") + "</span>" +
      '<span class="cit-cfg-popt__s">' + tr("a legjobb ár") + "</span></button>" +
      "</div>" +
      '<p class="cit-cfg-sum"></p>' +
      '<button class="cit-cfg-next" type="button">' + tr("Tovább a megrendeléshez") +
      I.chevR +
      "</button>" +
      '<div class="cit-cfg-step2" hidden>' +
      '<button class="cit-cfg-back" type="button">' +
      I.chevR +
      "<span>" + tr("Vissza a modulokhoz") + "</span></button>" +
      // (the billing-period toggle moved to step 1's footer — see above)
      '<label class="cit-cfg-note" style="display:flex;gap:8px;align-items:flex-start;text-align:left;cursor:pointer">' +
      '<input class="cit-cfg-rights" type="checkbox" style="margin-top:3px;flex:0 0 auto">' +
      // §A: the label is the EXACT server-stamped wording (single source via manifest).
      '<span class="cit-cfg-rights-text"></span></label>' +
      '<button class="cit-cfg-submit" type="button" disabled>' + tr("Tovább a számlázási adatokhoz") + I.chevR + "</button>" +
      '<p class="cit-cfg-note">' + tr("Nem kötelező. A következő lépésben megadja a számlázási adatokat, majd a biztonságos fizetéshez visszük; a fizetés után az oldalt automatikusan élesítjük, és e-mailben elküldjük a belépőt.") + "</p>" +
      "</div>" +
      billingStepHtml() +
      "</div>" +
      "</aside>"
  );

  // ── step 3: WHO is buying (0029) ────────────────────────────────────────────
  // A mandatory checkout step is a conversion risk, so it is built to be a
  // CONFIRMATION, not a form-fill: everything we can infer from the lead is
  // pre-filled, and for an EU company VIES supplies the legal name. It sits
  // AFTER the buy decision so browsing stays frictionless.
  function bField(key, label, opts) {
    opts = opts || {};
    return (
      '<label class="cit-cfg-f' + (opts.cls ? " " + opts.cls : "") + '"' +
      (opts.hidden ? " hidden" : "") +
      ' data-fw="' + key + '">' +
      "<span>" + esc(label) + "</span>" +
      '<input class="cit-cfg-i" data-f="' + key + '" type="' + (opts.type || "text") + '"' +
      ' value="' + esc(opts.value || "") + '"' +
      (opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : "") +
      (opts.mode ? ' inputmode="' + opts.mode + '"' : "") +
      ' autocomplete="' + (opts.auto || "off") + '">' +
      '<em class="cit-cfg-err" data-e="' + key + '"></em>' +
      "</label>"
    );
  }

  function billingStepHtml() {
    var B = CFG.billing || {};
    var pf = B.prefill || {};
    var list = B.countries && B.countries.length ? B.countries : [{ code: "HU", label: tr("Magyarország") }];
    var home = pf.country || "HU";
    var opts = list
      .map(function (c) {
        return (
          '<option value="' + esc(c.code) + '"' + (c.code === home ? " selected" : "") + ">" +
          esc(c.label) + "</option>"
        );
      })
      .join("");
    return (
      '<div class="cit-cfg-step3" hidden>' +
      '<button class="cit-cfg-back3" type="button">' + I.chevR + "<span>" + tr("Vissza") + "</span></button>" +
      '<p class="cit-cfg-bill-lead">' + tr("Kinek állítsuk ki a számlát?") + "</p>" +
      // The primary choice gets the full surface (two large tap targets), not a
      // pair of small radios — it drives which fields are even legal below.
      '<div class="cit-cfg-btype" role="radiogroup">' +
      '<button class="cit-cfg-bt cit-cfg-bt--on" type="button" data-btype="individual" role="radio" aria-checked="true">' +
      tr("Magánszemélyként") + "</button>" +
      '<button class="cit-cfg-bt" type="button" data-btype="business" role="radio" aria-checked="false">' +
      tr("Cégként, vállalkozásként") + "</button>" +
      "</div>" +
      '<em class="cit-cfg-err" data-e="buyer_type"></em>' +
      '<div class="cit-cfg-bgrid">' +
      bField("buyer_name", tr("Teljes név"), { auto: "name", cls: "cit-cfg-f--wide" }) +
      '<label class="cit-cfg-f cit-cfg-f--wide" data-fw="buyer_country"><span>' + tr("Ország") + "</span>" +
      '<select class="cit-cfg-i" data-f="buyer_country">' + opts + "</select>" +
      '<em class="cit-cfg-err" data-e="buyer_country"></em></label>' +
      bField("buyer_tax_number", tr("Adószám"), {
        hidden: true, mode: "numeric", placeholder: "12345678-2-41", cls: "cit-cfg-f--wide",
      }) +
      bField("buyer_eu_vat_number", tr("Közösségi adószám"), {
        hidden: true, placeholder: "DE123456789", cls: "cit-cfg-f--wide",
      }) +
      bField("buyer_zip", tr("Irányítószám"), { value: pf.zip, mode: "numeric", auto: "postal-code" }) +
      bField("buyer_city", tr("Település"), { value: pf.city, auto: "address-level2" }) +
      bField("buyer_address", tr("Utca, házszám"), {
        value: pf.address, auto: "street-address", cls: "cit-cfg-f--wide",
      }) +
      bField("buyer_email", tr("Számlázási e-mail"), {
        value: pf.email, type: "email", auto: "email", cls: "cit-cfg-f--wide",
      }) +
      // Further billing recipients (0032). Optional and free-form on purpose: the
      // buyer typically wants their accountant copied, and typing one field with
      // commas beats an add-another-row widget on a 390px screen. The server
      // splits and validates; a bad address is reported, never dropped.
      bField("billing_emails", tr("További számlázási címek (nem kötelező)"), {
        type: "text", auto: "off", cls: "cit-cfg-f--wide",
        placeholder: tr("könyvelő@pelda.hu, iroda@pelda.hu"),
      }) +
      "</div>" +
      // Consumer waiver — shown ONLY for the individual branch, because only a
      // consumer has a withdrawal right to waive.
      '<label class="cit-cfg-note cit-cfg-consent" data-c="withdrawal">' +
      '<input class="cit-cfg-waiver" type="checkbox">' +
      '<span class="cit-cfg-waiver-text"></span></label>' +
      '<em class="cit-cfg-err" data-e="withdrawal_waiver"></em>' +
      // ÁSZF row appears only when a real document exists to accept.
      (B.termsUrl
        ? '<label class="cit-cfg-note cit-cfg-consent">' +
          '<input class="cit-cfg-terms" type="checkbox">' +
          '<span>' + esc(B.termsText || "") +
          ' <a href="' + esc(B.termsUrl) + '" target="_blank" rel="noopener">' + tr("Megnyitom") + "</a></span></label>" +
          '<em class="cit-cfg-err" data-e="terms_accepted"></em>'
        : "") +
      '<button class="cit-cfg-pay" type="button">' + tr("Fizetéshez") + I.chevR + "</button>" +
      '<p class="cit-cfg-note cit-cfg-billnote"></p>' +
      "</div>"
    );
  }

  // step 1 ⇄ step 2 wiring (the choice itself is kept across steps)
  var nextBtn = panel.querySelector(".cit-cfg-next");
  var step2El = panel.querySelector(".cit-cfg-step2");
  nextBtn.addEventListener("click", function () {
    nextBtn.setAttribute("hidden", "");
    step2El.removeAttribute("hidden");
    track("checkout_step", {});
  });
  panel.querySelector(".cit-cfg-back").addEventListener("click", function () {
    step2El.setAttribute("hidden", "");
    nextBtn.removeAttribute("hidden");
  });

  // ── step 3 state + wiring (0029) ────────────────────────────────────────────
  var step3El = panel.querySelector(".cit-cfg-step3");
  var buyerType = "individual";
  var waiverBox = panel.querySelector(".cit-cfg-waiver");
  var termsBox = panel.querySelector(".cit-cfg-terms");
  var payBtn = panel.querySelector(".cit-cfg-pay");
  var billNote = panel.querySelector(".cit-cfg-billnote");

  // §H.22 single-source: the consumer reads the EXACT wording we stamp on the order.
  panel.querySelector(".cit-cfg-waiver-text").textContent =
    (CFG.billing && CFG.billing.withdrawalText) || "";

  function bInput(key) {
    return panel.querySelector('.cit-cfg-i[data-f="' + key + '"]');
  }
  function showField(key, on) {
    var el = panel.querySelector('[data-fw="' + key + '"]');
    if (!el) return;
    if (on) el.removeAttribute("hidden");
    else el.setAttribute("hidden", "");
  }
  function clearErrors() {
    panel.querySelectorAll(".cit-cfg-err").forEach(function (e) {
      e.textContent = "";
    });
    panel.querySelectorAll(".cit-cfg-f--bad").forEach(function (e) {
      e.classList.remove("cit-cfg-f--bad");
    });
  }
  function showErrors(fields) {
    var first = null;
    Object.keys(fields || {}).forEach(function (k) {
      var e = panel.querySelector('.cit-cfg-err[data-e="' + k + '"]');
      if (e) {
        e.textContent = fields[k];
        var wrap = panel.querySelector('[data-fw="' + k + '"]');
        if (wrap) wrap.classList.add("cit-cfg-f--bad");
        if (!first) first = wrap || e;
      }
    });
    if (first && first.scrollIntoView) first.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  /** Which fields are legal depends on buyer type AND country (HU vs other EU). */
  function syncBillingFields() {
    var country = (bInput("buyer_country") || {}).value || "HU";
    var isBusiness = buyerType === "business";
    showField("buyer_tax_number", isBusiness && country === "HU");
    showField("buyer_eu_vat_number", isBusiness && country !== "HU");
    var nameLabel = panel.querySelector('[data-fw="buyer_name"] span');
    if (nameLabel) {
      nameLabel.textContent = isBusiness ? tr("Cég teljes, hivatalos neve") : tr("Teljes név");
    }
    // Only a consumer has a withdrawal right to waive.
    var consent = panel.querySelector('[data-c="withdrawal"]');
    if (consent) {
      if (isBusiness) consent.setAttribute("hidden", "");
      else consent.removeAttribute("hidden");
    }
    billNote.textContent = isBusiness && country !== "HU"
      ? tr("A közösségi adószámot a beküldéskor a VIES-ben ellenőrizzük.")
      : "";
  }

  panel.querySelectorAll(".cit-cfg-bt").forEach(function (b) {
    b.addEventListener("click", function () {
      buyerType = b.getAttribute("data-btype") || "individual";
      panel.querySelectorAll(".cit-cfg-bt").forEach(function (x) {
        var on = x === b;
        x.classList.toggle("cit-cfg-bt--on", on);
        x.setAttribute("aria-checked", on ? "true" : "false");
      });
      clearErrors();
      syncBillingFields();
      track("buyer_type_select", { buyer_type: buyerType });
    });
  });
  var countrySel = bInput("buyer_country");
  if (countrySel) countrySel.addEventListener("change", syncBillingFields);
  syncBillingFields();

  panel.querySelector(".cit-cfg-back3").addEventListener("click", function () {
    step3El.setAttribute("hidden", "");
    step2El.removeAttribute("hidden");
    panel.classList.remove("cit-cfg-panel--billing");
  });

  // billing-period toggle (monthly | annual)
  panel.querySelectorAll(".cit-cfg-popt").forEach(function (b) {
    b.addEventListener("click", function () {
      period = b.getAttribute("data-period") || "monthly";
      panel.querySelectorAll(".cit-cfg-popt").forEach(function (x) {
        x.classList.toggle("cit-cfg-popt--on", x === b);
      });
      updateSummary();
      track("period_select", { period: period });
    });
  });

  // preset cards (div+role so the contents-disclosure button can nest validly)
  var presetsEl = panel.querySelector(".cit-cfg-presets");
  // What a package contains was invisible (owner report, 2026-08-19): every
  // card now discloses its full module checklist — included vs not included.
  function presetListHtml(p) {
    var set = {};
    (p.modules || []).forEach(function (id) {
      set[id] = true;
    });
    return MODULES.map(function (m) {
      var inc = !!set[m.id] || !!(m.spine && m.present);
      return (
        '<span class="cit-cfg-pli' +
        (inc ? "" : " cit-cfg-pli--off") +
        '">' +
        (inc ? I.check : I.x) +
        "<span>" +
        esc(m.label) +
        "</span></span>"
      );
    }).join("");
  }
  PRESETS.forEach(function (p) {
    var count = (p.modules || []).length;
    var b = el(
      '<div class="cit-cfg-preset" role="button" tabindex="0" data-preset="' +
        esc(p.id) +
        '"><span class="cit-cfg-preset__dot" aria-hidden="true"></span>' +
        '<span class="cit-cfg-preset__txt"><b>' +
        esc(p.label) +
        '</b><span class="cit-cfg-preset__note">' +
        esc(p.note) +
        "</span>" +
        '<button class="cit-cfg-preset__more" type="button" aria-expanded="false">' +
        tr("Mit tartalmaz? ({n} szekció)").replace("{n}", String(count)) +
        '<span class="cit-cfg-chev" aria-hidden="true">' +
        I.chev +
        "</span></button></span>" +
        '<span class="cit-cfg-preset__price">' +
        fmt(presetMonthly(p)) +
        "<small>" + tr("/hó") + "</small></span>" +
        '<span class="cit-cfg-preset__list" hidden>' +
        presetListHtml(p) +
        "</span></div>"
    );
    function choose() {
      applyPreset(p);
      track("preset_select", { preset: p.id });
    }
    b.addEventListener("click", function (e) {
      if (e.target && e.target.closest && e.target.closest(".cit-cfg-preset__more")) return;
      choose();
    });
    b.addEventListener("keydown", function (e) {
      if (e.target !== b) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        choose();
      }
    });
    var moreBtn = b.querySelector(".cit-cfg-preset__more");
    var listEl = b.querySelector(".cit-cfg-preset__list");
    moreBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      var opening = listEl.hasAttribute("hidden");
      if (opening) {
        listEl.removeAttribute("hidden");
        moreBtn.setAttribute("aria-expanded", "true");
        track("preset_info", { preset: p.id });
      } else {
        listEl.setAttribute("hidden", "");
        moreBtn.setAttribute("aria-expanded", "false");
      }
    });
    presetsEl.appendChild(b);
  });

  // detailed (grouped) toggles, hidden behind "Testre szabom"
  var detail = panel.querySelector(".cit-cfg-detail");
  GROUP_ORDER.forEach(function (g) {
    var mods = MODULES.filter(function (m) {
      return m.group === g;
    });
    if (!mods.length) return;
    detail.appendChild(el('<div class="cit-cfg-group">' + esc(GROUPS[g] || g) + "</div>"));
    mods.forEach(function (m) {
      detail.appendChild(row(m));
    });
  });

  var customizeBtn = panel.querySelector(".cit-cfg-customize");
  customizeBtn.addEventListener("click", function () {
    var opening = detail.hasAttribute("hidden");
    if (opening) {
      detail.removeAttribute("hidden");
      customizeBtn.setAttribute("aria-expanded", "true");
    } else {
      detail.setAttribute("hidden", "");
      customizeBtn.setAttribute("aria-expanded", "false");
    }
  });

  // domain choice wiring (only when the manifest carries the domain step)
  if (DOM) {
    var dlist = panel.querySelector(".cit-cfg-dlist");
    var AVAIL_LABEL = {
      probably_free: [tr("szabadnak tűnik"), "free"],
      taken: [tr("foglalt"), "taken"],
      unknown: [tr("ellenőrizzük"), "unknown"],
    };

    function setDomainOpt(which) {
      panel.querySelectorAll(".cit-cfg-dopt").forEach(function (o) {
        var on = o.getAttribute("data-dom") === which;
        o.classList.toggle("cit-cfg-dopt--on", on);
        o.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }

    var ownBox = panel.querySelector(".cit-cfg-own");
    var ownIn = panel.querySelector(".cit-cfg-own__in");
    var ownBtn = panel.querySelector(".cit-cfg-own__btn");
    var ownStatus = panel.querySelector(".cit-cfg-own__status");
    /** The buyer's own name is chosen — clear the suggestion highlight (one wins). */
    function clearSuggestionPick() {
      dlist.querySelectorAll(".cit-cfg-dsug").forEach(function (s) {
        s.classList.remove("cit-cfg-dsug--on");
      });
    }

    function pickSuggestion(node, domain) {
      dlist.querySelectorAll(".cit-cfg-dsug").forEach(function (s) {
        s.classList.toggle("cit-cfg-dsug--on", s === node);
      });
      if (ownBox) ownBox.classList.remove("cit-cfg-own--on");
      domainName = domain;
      updateSummary();
    }

    function renderSuggestions(suggestions) {
      dlist.innerHTML = "";
      if (!suggestions.length) {
        dlist.appendChild(
          el('<p class="cit-cfg-dlist__load">' + tr("Most nem találtunk javaslatot — a megrendeléskor beállíthatja.") + "</p>"),
        );
        return;
      }
      var firstFree = null;
      suggestions.forEach(function (s) {
        var a = AVAIL_LABEL[s.availability] || AVAIL_LABEL.unknown;
        var taken = s.availability === "taken";
        var node = el(
          '<div class="cit-cfg-dsug' +
            (taken ? " cit-cfg-dsug--taken" : "") +
            '" role="button" tabindex="' +
            (taken ? "-1" : "0") +
            '"><span class="cit-cfg-dsug__name">' +
            esc(s.domain) +
            '</span><span class="cit-cfg-dsug__tag cit-cfg-dsug__tag--' +
            a[1] +
            '">' +
            a[0] +
            "</span></div>",
        );
        if (!taken) {
          if (!firstFree && s.availability === "probably_free") firstFree = { node: node, domain: s.domain };
          node.addEventListener("click", function () {
            pickSuggestion(node, s.domain);
            track("domain_pick", { domain: s.domain });
          });
          node.addEventListener("keydown", function (e) {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              pickSuggestion(node, s.domain);
              track("domain_pick", { domain: s.domain });
            }
          });
        }
        dlist.appendChild(node);
      });
      dlist.appendChild(
        el(
          '<p class="cit-cfg-dlist__note">' +
            tr("Előzetes ellenőrzés — a végleges elérhetőséget a megrendeléskor erősítjük meg. Más nevet is választhat a megrendeléskor.") +
            "</p>",
        ),
      );
      if (firstFree) pickSuggestion(firstFree.node, firstFree.domain);
    }

    function loadSuggestions() {
      if (domainListLoaded) return;
      domainListLoaded = true;
      fetch(DOM.suggestUrl)
        .then(function (r) {
          return r.json();
        })
        .then(function (j) {
          renderSuggestions((j && j.suggestions) || []);
        })
        .catch(function () {
          renderSuggestions([]);
        });
    }

    panel.querySelectorAll(".cit-cfg-dopt").forEach(function (o) {
      function choose() {
        var which = o.getAttribute("data-dom");
        setDomainOpt(which);
        track("domain_select", { choice: which });
        if (which === "custom") {
          domainType = "citoviso_registered";
          domainName = null; // set by pickSuggestion / the own-name check
          dlist.removeAttribute("hidden");
          if (ownBox) ownBox.removeAttribute("hidden");
          loadSuggestions();
        } else {
          domainType = "citoviso_sub";
          domainName = subHost;
          dlist.setAttribute("hidden", "");
          if (ownBox) ownBox.setAttribute("hidden", "");
        }
        refreshSubmit();
        updateSummary();
      }
      o.addEventListener("click", choose);
      o.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          choose();
        }
      });
    });

    // Own domain name + explicit "Ellenőrzés" (tulaj, 2026-08-21). Deliberately a
    // BUTTON, not the subdomain field's debounced auto-check: each verdict costs a
    // DNS + RDAP round trip, and a half-typed "pel", "pelda", "pelda.h" would burn
    // three of them and flash "foglalt" at a name the buyer had not finished writing.
    if (ownBox && ownIn && ownBtn && DOM.checkUrl) {
      var ownBusy = false;
      function setOwnStatus(cls, text) {
        ownStatus.className = "cit-cfg-own__status" + (cls ? " cit-cfg-own__status--" + cls : "");
        ownStatus.textContent = text;
      }
      function checkOwn() {
        var name = ownIn.value.trim();
        if (!name || ownBusy) {
          if (!name) setOwnStatus("bad", tr("Adjon meg egy domain nevet"));
          return;
        }
        ownBusy = true;
        ownBtn.disabled = true;
        setOwnStatus("wait", tr("Ellenőrzés…"));
        track("own_domain_check", {});
        fetch(DOM.checkUrl + "?name=" + encodeURIComponent(name))
          .then(function (r) {
            return r.json();
          })
          .then(function (j) {
            if (!j || !j.ok) {
              setOwnStatus("bad", (j && j.reason) || tr("Nem használható domain név"));
              return;
            }
            ownIn.value = j.domain; // show the cleaned form we actually checked
            if (j.availability === "taken") {
              // Taken = we cannot register it, so it must not become the selection.
              setOwnStatus("bad", j.domain + " — " + tr("foglalt"));
              return;
            }
            clearSuggestionPick();
            ownBox.classList.add("cit-cfg-own--on");
            domainName = j.domain;
            setOwnStatus(
              "ok",
              j.domain +
                " — " +
                (j.availability === "probably_free" ? tr("szabadnak tűnik") : tr("ellenőrizzük")),
            );
            updateSummary();
            track("own_domain_pick", { domain: j.domain });
          })
          .catch(function () {
            // Network hiccup: don't block the sale — the name is kept and re-checked
            // at order time (the same honesty as the suggestion list's caveat).
            clearSuggestionPick();
            ownBox.classList.add("cit-cfg-own--on");
            domainName = ownIn.value.trim();
            setOwnStatus("wait", tr("Most nem sikerült ellenőrizni — a megrendeléskor visszaigazoljuk."));
            updateSummary();
          })
          .then(function () {
            ownBusy = false;
            ownBtn.disabled = false;
          });
      }
      ownBtn.addEventListener("click", checkOwn);
      ownIn.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          checkOwn();
        }
      });
      // Editing after a verdict invalidates it — a stale "szabadnak tűnik" standing
      // under a name it was not about is worse than no verdict at all. If the checked
      // name was the current selection, the selection goes with it (the order would
      // otherwise carry a domain nobody checked).
      ownIn.addEventListener("input", function () {
        var wasChosen = ownBox.classList.contains("cit-cfg-own--on");
        if (!wasChosen && !ownStatus.textContent) return;
        ownBox.classList.remove("cit-cfg-own--on");
        setOwnStatus("", "");
        if (wasChosen) {
          domainName = null; // nothing selected until re-checked (or a suggestion is picked)
          updateSummary();
        }
      });
    }

    // ADR-0032: free-choice subdomain label with a debounced availability check.
    var subInput = panel.querySelector(".cit-cfg-sub__label");
    var subStatus = panel.querySelector(".cit-cfg-sub__status");
    if (subInput && DOM.subCheckUrl) {
      var subTimer = null;
      function setSubStatus(cls, text) {
        subStatus.className = "cit-cfg-sub__status" + (cls ? " cit-cfg-sub__status--" + cls : "");
        subStatus.textContent = text;
      }
      function checkSub() {
        var label = subInput.value.trim();
        if (!label) {
          subOk = false;
          setSubStatus("bad", tr("Adjon meg egy nevet"));
          refreshSubmit();
          return;
        }
        setSubStatus("wait", tr("Ellenőrzés…"));
        fetch(DOM.subCheckUrl + "?label=" + encodeURIComponent(label))
          .then(function (r) {
            return r.json();
          })
          .then(function (j) {
            if (j && j.ok) {
              subOk = true;
              subHost = j.host;
              if (domainType === "citoviso_sub") domainName = subHost;
              setSubStatus("ok", tr("Szabad:") + " " + j.host);
            } else {
              subOk = false;
              setSubStatus("bad", (j && j.reason) || tr("Nem választható"));
            }
            refreshSubmit();
          })
          .catch(function () {
            // Network hiccup: don't block the sale — treat as usable, re-checked at provision.
            subOk = true;
            setSubStatus("", "");
            refreshSubmit();
          });
      }
      subInput.addEventListener("input", function () {
        if (subTimer) clearTimeout(subTimer);
        subOk = false; // pending until the check returns
        refreshSubmit();
        subTimer = setTimeout(checkSub, 450);
      });
    }
  }

  var sumEl = panel.querySelector(".cit-cfg-sum");
  // Price-change feedback: the running total is always on screen, but a silent
  // number swap is easy to miss while the eye is on the switch. Every change
  // pulses the total and names the difference for a beat ("+490 Ft/hó"), so the
  // prospect connects THIS switch to THAT amount.
  var lastMonthly = null;
  var deltaTimer = null;
  function deltaHtml(diff) {
    var sign = diff > 0 ? "+" : "−";
    return (
      '<span class="cit-cfg-delta cit-cfg-delta--' +
      (diff > 0 ? "up" : "down") +
      '">' +
      sign +
      fmt(Math.abs(diff)) +
      tr("/hó") +
      "</span>"
    );
  }
  // ADR-0088 price card (approved plan: assets/design-refs/console/offer-ui):
  // struck list total on top, the PAYABLE amount big, then the offer line and
  // the always-stated validity — single transaction, renewal at list price.
  function offerCardHtml(listAmount, perLabel, permoHtml) {
    var l3;
    if (OFFER.kind === "escalation") {
      l3 =
        tr("Döntés-segítő ajánlat: −{p}% az első díjból").replace("{p}", String(OFFER.percent)) +
        (offerDeadline() ? " · " + tr("érvényes {d}-ig").replace("{d}", offerDeadlineText()) : "");
    } else {
      l3 = tr("Bemutatkozó ajánlat a levélből: −{p}% az első díjból").replace("{p}", String(OFFER.percent));
    }
    return (
      '<span class="cit-cfg-off-l1">' + tr("Összesen") +
      ' <s class="cit-cfg-off-list">' + fmt(listAmount) + "</s></span>" +
      '<b>' + fmt(offerPrice(listAmount)) + "</b> " + perLabel + " " + permoHtml +
      '<span class="cit-cfg-off-l3' + (OFFER.kind === "escalation" ? " cit-cfg-off-l3--hot" : "") + '">' + l3 + "</span>" +
      '<span class="cit-cfg-off-l4">' + tr("Egyszeri kedvezmény — a hosszabbítás listaáron megy.") + "</span>"
    );
  }
  function updateSummary() {
    var n = 0;
    MODULES.forEach(function (m) {
      if (selected[m.id]) n++;
    });
    var nowMonthly = offerPrice(monthlyTotal());
    var diff = lastMonthly === null ? 0 : nowMonthly - lastMonthly;
    lastMonthly = nowMonthly;
    sumEl.classList.toggle("cit-cfg-sum--offer", !!OFFER);
    if (period === "annual") {
      var a = annualTotal();
      var permoA =
        '<span class="cit-cfg-permo">(' + fmt(offerPrice(a) / 12) + tr("/hó") + " · " +
        tr("{n} hónap ingyen").replace("{n}", String(PRICING.annualFreeMonths)) + ")</span>";
      sumEl.innerHTML = OFFER
        ? offerCardHtml(a, tr("/ év"), permoA)
        : '<b>' + fmt(a) + "</b> " + tr("/ év") + " " + permoA;
    } else {
      var m0 = monthlyTotal();
      var permoM =
        '<span class="cit-cfg-permo">· ' + tr("{n} szekció").replace("{n}", String(n)) + "</span>";
      sumEl.innerHTML = OFFER
        ? offerCardHtml(m0, tr("/ hó"), permoM)
        : '<b>' + fmt(m0) + "</b> " + tr("/ hó") + " " + permoM;
    }
    if (diff) {
      sumEl.innerHTML += deltaHtml(diff);
      sumEl.classList.remove("cit-cfg-sum--bump");
      void sumEl.offsetWidth; // restart the pulse
      sumEl.classList.add("cit-cfg-sum--bump");
      if (deltaTimer) clearTimeout(deltaTimer);
      deltaTimer = setTimeout(function () {
        var d = sumEl.querySelector(".cit-cfg-delta");
        if (d) d.classList.add("cit-cfg-delta--out");
        sumEl.classList.remove("cit-cfg-sum--bump");
      }, 2200);
    }
    // custom domain = separate yearly fee + minimum commitment (ADR-0020)
    if (DOM && domainType === "citoviso_registered") {
      sumEl.innerHTML +=
        '<span class="cit-cfg-domfee">' +
        tr("+ saját domain") + " " +
        fmt(DOM.customYearly) +
        tr("/év") +
        (domainName ? " (" + esc(domainName) + ")" : "") +
        " · " +
        tr("min. {years} éves előfizetés").replace("{years}", String(Math.round(DOM.minCommitmentMonths / 12))) +
        "</span>";
    }
  }

  // default = the ALL-IN preset ("Teljes"): everything on (matches anchoring).
  setActivePreset(PRESETS.length ? PRESETS[0].id : "teljes");
  updateSummary();

  function open() {
    revealSamples(); // first open = the "all-in" reveal (full package visible)
    panel.classList.add("cit-cfg-open");
    panel.classList.add("cit-cfg-seen"); // the edge tab lives from now on
    panel.classList.remove("cit-cfg-collapsed");
    scrim.classList.add("cit-cfg-open");
    launch.hidden = true;
    track("panel_open", {});
  }
  // Collapse = slide away but keep the edge tab peeking (state survives);
  // close (X) = fully gone, the invite pill returns.
  function collapse() {
    panel.classList.remove("cit-cfg-open");
    panel.classList.add("cit-cfg-collapsed");
    scrim.classList.remove("cit-cfg-open");
    launch.hidden = true;
    track("panel_collapse", {});
  }
  function close() {
    panel.classList.remove("cit-cfg-open");
    panel.classList.remove("cit-cfg-seen");
    panel.classList.remove("cit-cfg-collapsed");
    scrim.classList.remove("cit-cfg-open");
    launch.hidden = false;
  }
  launch.addEventListener("click", open);
  scrim.addEventListener("click", collapse);
  panel.querySelector(".cit-cfg-close").addEventListener("click", close);
  panel.querySelector(".cit-cfg-handle").addEventListener("click", function () {
    if (panel.classList.contains("cit-cfg-open")) collapse();
    else open();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && panel.classList.contains("cit-cfg-open")) collapse();
  });

  // ── submit ──────────────────────────────────────────────────────────────────
  var submitBtn = panel.querySelector(".cit-cfg-submit");
  // §A photo-rights declaration gates the submit (server re-checks the flag).
  var rightsBox = panel.querySelector(".cit-cfg-rights");
  panel.querySelector(".cit-cfg-rights-text").textContent =
    CFG.photoRightsText ||
    "Kijelentem, hogy a honlapomon megjelenítendő képekre felhasználási joggal rendelkezem; szavatosságot és kártalanítást vállalok."; // i18n-exempt: §A legal wording — country LEGAL pack scope
  rightsBox.addEventListener("change", function () {
    // Submit needs the §A declaration AND (for the platform subdomain) a free label (ADR-0032).
    submitBtn.disabled = !rightsBox.checked || (domainType === "citoviso_sub" && !subOk);
    if (rightsBox.checked) track("photo_rights_declared", {});
  });
  // Step 2 → step 3: the order is NOT sent yet. We must know who is buying
  // before a pay-link exists, because the invoice is due the moment they pay.
  submitBtn.addEventListener("click", function () {
    step2El.setAttribute("hidden", "");
    step3El.removeAttribute("hidden");
    // The module list is done with by now; give the billing form the whole panel
    // so its pay button cannot land below an unscrollable fold (the foot is
    // deliberately flex:0 0 auto and a full form does not fit there).
    panel.classList.add("cit-cfg-panel--billing");
    track("billing_step_open", {});
    var firstEmpty = ["buyer_name", "buyer_zip", "buyer_city", "buyer_address", "buyer_email"]
      .map(bInput)
      .filter(function (i) {
        return i && !i.value;
      })[0];
    if (firstEmpty && firstEmpty.focus) firstEmpty.focus();
  });

  payBtn.addEventListener("click", function () {
    var chosen = MODULES.filter(function (m) {
      return selected[m.id];
    }).map(function (m) {
      return m.id;
    });
    clearErrors();
    payBtn.disabled = true;
    payBtn.textContent = tr("Ellenőrzés…");
    track("order_intent_submitted", {
      modules: chosen.length,
      period: period,
      domain_type: domainType,
      buyer_type: buyerType,
    });
    var url = CFG.requestUrl;
    if (!url) {
      showThanks(chosen);
      return;
    }
    function val(k) {
      var i = bInput(k);
      return i ? i.value.trim() : "";
    }
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        modules: chosen,
        billing_period: period,
        // Display-only figure for the tamper check; with an offer the payable
        // (discounted) amount is what the buyer saw (ADR-0088).
        price: offerPrice(period === "annual" ? annualTotal() : monthlyTotal()),
        domain_type: domainType,
        domain_name: domainName,
        photo_rights_declared: rightsBox.checked === true,
        // 0029 billing identity — the server re-validates all of it.
        buyer_type: buyerType,
        buyer_name: val("buyer_name"),
        buyer_country: val("buyer_country"),
        buyer_tax_number: val("buyer_tax_number"),
        buyer_eu_vat_number: val("buyer_eu_vat_number"),
        buyer_zip: val("buyer_zip"),
        buyer_city: val("buyer_city"),
        buyer_address: val("buyer_address"),
        buyer_email: val("buyer_email"),
        billing_emails: val("billing_emails"),
        withdrawal_waiver: !!(waiverBox && waiverBox.checked),
        terms_accepted: !!(termsBox && termsBox.checked),
      }),
    })
      .then(function (r) {
        return r.json().catch(function () {
          return {};
        });
      })
      .then(function (data) {
        // Automatic hand-off to checkout: the server issues the pay-link with the
        // order, so the buyer goes straight to payment (pay → webhook → go-live).
        if (data && data.payUrl) {
          track("checkout_redirect", { period: period });
          window.location.href = data.payUrl;
          return;
        }
        // Per-field validation failure: show WHICH field is wrong and let them
        // fix it in place — never a dead end, never a silent "thanks".
        if (data && data.error === "billing_details_invalid") {
          payBtn.disabled = false;
          payBtn.innerHTML = tr("Fizetéshez") + I.chevR;
          showErrors(data.fields);
          track("billing_invalid", { fields: Object.keys(data.fields || {}).join(",") });
          return;
        }
        showThanks(chosen);
      })
      .catch(function () {
        showThanks(chosen);
      });
  });

  function showThanks(chosen) {
    var foot = panel.querySelector(".cit-cfg-foot");
    foot.innerHTML =
      '<p class="cit-cfg-sum"><b>' + tr("Köszönjük!") + "</b> " +
      tr("Rögzítettük a választását ({n} szekció). A fizetési linket e-mailben elküldjük; a fizetés után az oldalt automatikusan élesítjük.")
        .replace("{n}", String(chosen.length)) +
      "</p>" +
      '<p class="cit-cfg-note">' +
      tr("Semmire nem kötelezi. A megmutatott mintákat az Ön valódi adataival töltjük fel — a kész oldalra minta-tartalom soha nem kerül.") +
      "</p>";
  }

  // ── ADR-0088 escalation decision card (approved plan: design-refs/console/
  // offer-ui). Centered on desktop, bottom-anchored on mobile; live countdown;
  // the CTA opens the panel, the dismiss only hides the card — the offer itself
  // stays alive (the server row governs) and keeps showing in the price card.
  function mountEscalationCard() {
    if (!OFFER || OFFER.kind !== "escalation") return;
    var dl = offerDeadline();
    if (!dl || dl.getTime() <= Date.now()) return;
    var veil = el('<div class="cit-cfg-escveil"></div>');
    var card = el(
      '<div class="cit-cfg-esccard" role="dialog" aria-label="' + tr("Döntés-segítő ajánlat") + '">' +
        "<h4>" + tr("Szeretnénk segíteni a döntésben") + "</h4>" +
        "<p>" + tr("Látjuk, hogy már többször megnézte a honlap-tervét. Ha most rendeli meg, az első díjból a bemutatkozó kedvezmény helyett ennyit engedünk:") + "</p>" +
        '<div class="cit-cfg-escpct"><b>−' + OFFER.percent + "%</b><span>" +
        tr("az első havi vagy éves díjból · a megújulás listaáron") + "</span></div>" +
        '<div class="cit-cfg-esccd"></div>' +
        '<button class="cit-cfg-escgo" type="button">' + tr("Megrendelem a kedvezménnyel") + "</button>" +
        '<button class="cit-cfg-esclater" type="button">' + tr("Most még gondolkodom") + "</button>" +
      "</div>",
    );
    var cdEl = card.querySelector(".cit-cfg-esccd");
    var cdTimer = null;
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function cdTick() {
      var s = Math.floor((dl.getTime() - Date.now()) / 1000);
      if (s <= 0) {
        // Expired mid-session: the deal is over — drop it EVERYWHERE at once,
        // or the price card would promise what the server no longer charges.
        if (cdTimer) clearInterval(cdTimer);
        hide();
        OFFER = null;
        updateSummary();
        return;
      }
      cdEl.innerHTML =
        "<i>" + pad(Math.floor(s / 3600)) + "<small>" + tr("óra") + "</small></i>" +
        "<i>" + pad(Math.floor((s % 3600) / 60)) + "<small>" + tr("perc") + "</small></i>" +
        "<i>" + pad(s % 60) + "<small>" + tr("mp") + "</small></i>";
    }
    function hide() {
      veil.classList.remove("cit-cfg-on");
      card.classList.remove("cit-cfg-on");
    }
    card.querySelector(".cit-cfg-esclater").addEventListener("click", function () {
      track("escalation_dismiss", {});
      hide();
    });
    card.querySelector(".cit-cfg-escgo").addEventListener("click", function () {
      track("escalation_cta", {});
      hide();
      open();
    });
    veil.addEventListener("click", hide);
    document.body.appendChild(veil);
    document.body.appendChild(card);
    cdTick();
    cdTimer = setInterval(cdTick, 1000);
    // After a short beat — the wow (the page itself) lands first.
    setTimeout(function () {
      veil.classList.add("cit-cfg-on");
      card.classList.add("cit-cfg-on");
      track("escalation_shown", {});
    }, 1400);
  }

  // ── mount ───────────────────────────────────────────────────────────────────
  function mount() {
    // ALL-IN on first paint (ADR-0047): the lead must SEE the full package in the
    // very first screenful — that is the whole premise of "here is your new site,
    // now trim it". Withholding the samples until a panel open meant the offer was
    // invisible to anyone who did not start fiddling.
    revealSamples();
    document.body.appendChild(scrim);
    document.body.appendChild(panel);
    document.body.appendChild(launch);
    mountEscalationCard();
    // The invite pill enters AFTER the wow lands: a short beat, or on first scroll.
    var pillShown = false;
    function showPill() {
      if (pillShown) return;
      pillShown = true;
      launch.classList.add("cit-cfg-in");
    }
    setTimeout(showPill, 2600);
    window.addEventListener(
      "scroll",
      function () {
        if (window.scrollY > window.innerHeight * 0.28) showPill();
      },
      { passive: true },
    );
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
