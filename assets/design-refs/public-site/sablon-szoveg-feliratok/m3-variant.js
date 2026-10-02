// M3 plan-round variant layer — applied INSIDE a real generated mock (editorial template).
// URL params: e=0|A|B (editorial wording), p=0|1|2 (sample programmes), g=0|1|2 (photo captions).
// Every variant is the rule the engine would implement, run on the real DOM — not a redraw.
(function () {
  var q = new URLSearchParams(location.search);
  var E = q.get("e") || "0", P = q.get("p") || "0", G = q.get("g") || "0";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var css = "";
  var name = ($(".e-mast-mid h1") || {}).textContent || "";
  function mark(el) { if (el) el.setAttribute("data-m3", "changed"); }

  // ---------------- SZ-3 · editorial wording ----------------
  if (E !== "0") {
    var swap = { "Képes krónika": "Képek", "Ami jár": "Szolgáltatások", "Rovatok": "Az oldalon", "Szerkesztőség": "Elérhetőség", "Vendégkönyv": "Vélemények" };
    $$(".e-nav a, .e-colo a, .e-colo h4").forEach(function (a) {
      var t = a.textContent.trim();
      if (swap[t]) { a.textContent = swap[t]; mark(a); }
    });
    // "Nyomtatva a világhálón" — dropped
    $$(".e-colo-legal span").forEach(function (s) { if (/világhálón/.test(s.textContent)) s.remove(); });
    // "No. N" section numbers — dropped (the rule stays as a plain divider)
    $$(".e-sech .e-no").forEach(function (n) { n.remove(); });
    // pull-quote headline: no quotation marks — nobody said it
    var qh = $(".e-quote");
    if (qh) {
      var f = qh.firstChild; if (f && f.nodeType === 3) f.nodeValue = f.nodeValue.replace(/^„/, "");
      var l = qh.lastChild; if (l && l.nodeType === 3) l.nodeValue = l.nodeValue.replace(/”$/, "");
      mark(qh);
    }
    // kicker fallback "Vezércikk" → "A házról"
    var k = $(".e-kicker"); if (k && /vezércikk/i.test(k.textContent)) k.textContent = "A házról";
    // coupon: "Foglalási szelvény" → plain booking head, no triple "Foglalás"
    var ch = $(".e-coupon h3");
    if (ch) { ch.textContent = "Szabad szoba kérése"; mark(ch); }
    var cs = $(".e-coupon .e-sub");
    if (cs) cs.textContent = "Válasszon időpontot — a szállás hamarosan visszajelez";
    $$(".e-coupon .cit-enquiry-bar-title").forEach(function (t) { if (/^\s*Foglalás\s*$/.test(t.textContent)) t.remove(); });
    // contact copy that still talks about the "coupon"
    var intro = $(".e-dest .e-intro");
    if (intro) intro.textContent = intro.textContent.replace("A foglalási szelvényen", "A foglalási űrlapon");
    $$(".e-dest .cit-btn").forEach(function (b) { if (/szelvény/i.test(b.textContent)) { b.textContent = "Szabad szobát kérek"; mark(b); } });
    // "A ház számokban" over ONE number → the number stands alone, no promise of a table
    var facts = $(".e-facts");
    if (facts && $$(".e-fact", facts).length < 2) {
      var h = $("h3", facts); if (h) h.remove();
      facts.classList.add("m3-onefact"); mark(facts);
    }
    // drop-cap: ::first-letter + float merges "A Muschel" into "AMuschel" in innerText/readers.
    var dc = $(".e-dropcap");
    if (dc) {
      var first = (dc.textContent.trim().split(/\s+/)[0] || "");
      if (E === "B" || first.length < 2) { dc.classList.remove("e-dropcap"); mark(dc); }
    }
    css += ".m3-onefact{border-top:1px solid var(--cit-line)!important}.m3-onefact .e-fact{border-bottom:0}";
    if (E === "B") {
      // quieter ornament: polaroids straight, solid booking frame
      css += ".e-shot{transform:none!important}.e-coupon{border-style:solid!important;border-width:1px!important}";
    }
  }

  // ---------------- SZ-4 · sample programmes ----------------
  var ev = $(".cit-ev");
  if (ev && P !== "0") {
    var h2 = $("h2", ev);
    if (h2 && !$(".cit-modsec__minta", h2)) {
      var pill = document.createElement("span"); pill.className = "cit-modsec__minta"; pill.textContent = "Minta";
      h2.appendChild(pill);
    }
    var lead = $(".cit-ev__lead", ev);
    var city = (lead && (lead.textContent.match(/állnak, (.+?) 30 km/) || [])[1]) || "";
    if (P === "1") {
      // no dates at all: programme TYPES, nothing a guest could turn up to
      $$(".cit-ev__date", ev).forEach(function (d) { d.remove(); });
      $$(".cit-ev__when", ev).forEach(function (w) { w.remove(); });
      $$(".cit-ev__row", ev).forEach(function (r) { r.style.gridTemplateColumns = "1fr"; });
      if (lead) lead.innerHTML = "Ilyen programokat mutat itt az éles oldal: a következő két hét valós eseményeit" +
        (city ? " " + city + " 30 km-es körzetéből" : " a környékről") + ", dátummal és forrással.";
      css += ".cit-ev__row{padding:10px 0}";
    } else if (P === "2") {
      // dates kept (ADR-0218 look), every row says it is a sample
      $$(".cit-ev__where", ev).forEach(function (w) {
        var t = document.createElement("span"); t.className = "m3-rowminta"; t.textContent = "minta";
        w.parentNode.insertBefore(t, w);
      });
      if (lead) lead.innerHTML = "<b class=\"cit-ev__minta\">Minta-napirend, kitalált programokkal.</b> Élesben itt a következő két hét valós programjai állnak" +
        (city ? ", " + city + " 30 km-es körzetéből" : " a környékről") + ", forrással.";
      css += ".m3-rowminta{display:inline-block;padding:1px 7px;border:1px dashed var(--cit-muted);border-radius:999px;font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:var(--cit-muted)}" +
        ".cit-ev__date{opacity:.55;border-style:dashed!important}";
    }
    mark(ev);
  }

  // ---------------- L-3 · photo captions ----------------
  if (G !== "0") {
    var fold = function (s) { return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); };
    var words = function (s) { return fold(s).replace(/\[teszt\]/g, " ").split(/[^a-z0-9]+/).filter(Boolean); };
    // what a caption may contain and still say nothing: the name, the place, the type, the stars
    var known = {};
    words(name + " " + (($(".e-mast-top span") || {}).textContent || "") + " " +
      $$(".e-conline b").map(function (b) { return b.textContent; }).join(" ") +
      " vendeghaz panzio apartman apartmanok apartments villa szallas hotel haz udulohaz").forEach(function (w) { known[w] = 1; });
    var generated = function (s) { return /—\s*\d+\.\s*kép\s*$/.test(s); };
    // G2: a source caption that only echoes name/place/type/stars ("Suzy 3*", "Három Huszár Köveskal Köveskál")
    var echoes = function (s) { return words(s).every(function (w) { return known[w] || /^\d$/.test(w); }); };
    var empty = function (s) { return generated(s) || (G === "2" && echoes(s)); };
    $$(".e-leadfig figcaption, .e-aside figcaption, .e-shot figcaption").forEach(function (c) {
      if (empty(c.textContent)) { c.remove(); }
    });
    // the polaroid keeps its paper bottom without a caption line
    css += ".e-shot{padding-bottom:22px}";
    if (G === "2") {
      // a REAL caption never covers the photo: below it, not over its bottom quarter
      css += ".e-leadfig figcaption{position:static!important;background:none!important;color:var(--cit-muted)!important;padding:8px 2px 0!important;font-style:italic}";
    }
  }

  if (css) { var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st); }
  if (q.get("hl") === "1") {
    var s2 = document.createElement("style");
    s2.textContent = "[data-m3=changed]{outline:2px dashed color-mix(in srgb, var(--cit-accent) 70%, transparent);outline-offset:3px}";
    document.head.appendChild(s2);
  }
  // jump to the asked section after layout (hash is consumed by the hub)
  var to = q.get("to");
  // window.scrollTo, not scrollIntoView: the latter also scrolls the PARENT (the hub) page.
  if (to) { var t = document.querySelector(to); if (t) setTimeout(function () { var nav = $(".e-nav"); window.scrollTo(0, t.getBoundingClientRect().top + scrollY - (nav ? nav.offsetHeight : 0) - 8); }, 60); }
})();
