/*
 * Citoviso public homepage — behaviours (approved design: assets/design-refs/public-site/landing/,
 * "C · Szem", 2026-11-07).
 *
 *  1. Hyperspace starfield on a canvas: stars stream past, streaking gently with scroll
 *     speed (capped and eased — the owner found a fast warp distracting).
 *  2. Intro timeline (scroll-driven, pinned): the hero copy fades, the C mark glides to the
 *     centre and grows, opens into an eye (the two arcs become the lids, the dot the iris),
 *     winks (time-based, the upper lid really closes over the iris), and the iris swells
 *     into the light next section.
 *  3. Page parts: billing toggle, commission calculator, mobile menu, FAQ (native
 *     <details>), the sample-request form (map pin + POST /api/mock-request).
 *
 * Motion only runs with html.anim (set in <head>: JS on and no reduced-motion). Without
 * it the page is a static layout and everything here except the animation still works.
 */
(function () {
  "use strict";
  var root = document.documentElement;
  var ANIM = root.classList.contains("anim");
  var $ = function (id) { return document.getElementById(id); };

  var canvas = $("sky"), ctx = canvas ? canvas.getContext("2d") : null;
  var intro = $("intro"), pin = $("pin"), heroCopy = $("hero-copy");
  var mark = $("mark"), markSlot = $("mark-slot");
  var irisLayer = $("iris"), reveal = $("reveal"), cue = $("scroll-cue");
  var brandSlot = $("brand-slot");
  var tilt = $("mark-tilt"), lidUp = $("lid-up"), lidLo = $("lid-lo");
  var eyeClip = $("eye-clip"), iris = $("eye-iris"), hl = $("eye-hl");
  var lashes = $("lashes"), tri = $("mark-tri");

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function smooth(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // ── nav: light once the light section owns the screen ─────────────────────
  function setNavLight(on) {
    root.classList.toggle("nav-light", on);
    if (brandSlot) {
      if (on) brandSlot.removeAttribute("data-citui-theme");
      else brandSlot.setAttribute("data-citui-theme", "dark");
    }
  }

  // ── viewport ──────────────────────────────────────────────────────────────
  // H only follows real resizes: a phone's URL bar showing/hiding changes innerHeight
  // by ~60–120px on every scroll direction change, which would make the pin jump.
  var W = 0, H = 0, DPR = 1;
  function measure(force) {
    var w = root.clientWidth, h = window.innerHeight;
    if (!force && w === W && Math.abs(h - H) < 150) return false;
    W = w; H = h;
    root.style.setProperty("--vh", H + "px");
    return true;
  }

  // ── starfield ─────────────────────────────────────────────────────────────
  var stars = [], N = 0;
  function makeStar() {
    return { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random(), c: Math.random() < 0.18 ? 1 : 0 };
  }
  function sizeCanvas() {
    if (!ctx) return;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    var want = W < 600 ? 260 : 520;
    if (want !== N) { N = want; stars = []; for (var i = 0; i < N; i++) stars.push(makeStar()); }
  }

  var lastY = window.scrollY, lastT = performance.now(), vel = 0, warp = 0, introP = 0;
  function frameDraw(now) {
    var dt = Math.min(48, now - lastT); lastT = now;
    var y = window.scrollY, dy = Math.abs(y - lastY); lastY = y;
    vel = vel * 0.92 + (dy / Math.max(dt, 1)) * 0.08;                     // px per ms, smoothed
    var introBoost = Math.sin(Math.min(1, introP / 0.62) * Math.PI) * 2.2;   // the "jump" peaks mid-growth
    var target = Math.min(4, vel * 1.6 + introBoost);                      // calm cap: streaks, never a blur
    warp += (target - warp) * 0.035;                                       // slow ease in and out
    var speed = 0.00007 + warp * 0.00016;
    var skyFade = 1 - smooth(0.62, 0.95, introP);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (skyFade > 0.01 && introP < 1) {
      var cx = W / 2, cy = H * 0.46, f = Math.max(W, H) * 0.55;
      ctx.lineCap = "round";
      for (var i = 0; i < N; i++) {
        var s = stars[i], pz = s.z;
        s.z -= speed * dt;
        if (s.z <= 0.02) { stars[i] = makeStar(); stars[i].z = 1; continue; }
        var sx = cx + (s.x / s.z) * f, sy = cy + (s.y / s.z) * f;
        if (sx < -50 || sx > W + 50 || sy < -50 || sy > H + 50) { stars[i] = makeStar(); stars[i].z = 1; continue; }
        var tz = Math.min(1, pz + 0.0005 + warp * 0.006);
        var tx = cx + (s.x / tz) * f, ty = cy + (s.y / tz) * f;
        var a = Math.min(1, (1 - s.z) * 1.4) * skyFade;
        ctx.strokeStyle = s.c ? "rgba(111,216,235," + a + ")" : "rgba(234,243,248," + a + ")";
        ctx.lineWidth = Math.max(0.6, (1 - s.z) * 2.2);
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(sx + 0.01, sy); ctx.stroke();
      }
    }
    requestAnimationFrame(frameDraw);
  }

  // ── the C ⇄ eye morph ────────────────────────────────────────────────────
  // The C is drawn as two cubic halves (upper / lower arc of the E4 mark: r 42 around
  // 60/60, open on the right at 84.6/29.3 – 84.6/90.7). For the eye the same two curves
  // become an almond, the upper and the lower lid; the dot slides to the centre and grows
  // into an iris, clipped by the lids, so the closing upper lid really covers it.
  function arc(a0, a1) {
    var r = 42, k = 4 / 3 * Math.tan((a1 - a0) / 4);
    var p0 = [60 + r * Math.cos(a0), 60 + r * Math.sin(a0)], p3 = [60 + r * Math.cos(a1), 60 + r * Math.sin(a1)];
    return [p0, [p0[0] - k * r * Math.sin(a0), p0[1] + k * r * Math.cos(a0)], [p3[0] + k * r * Math.sin(a1), p3[1] - k * r * Math.cos(a1)], p3];
  }
  var A0 = Math.atan2(-30.7, 24.6);
  var C_UP = arc(A0, -Math.PI), C_LO = arc(Math.PI, -A0);
  var E_UP = [[108, 60], [84, 22], [36, 22], [12, 60]], E_LO = [[12, 60], [36, 98], [84, 98], [108, 60]];
  var S_UP = [[108, 60], [84, 88], [36, 88], [12, 60]], S_LO = [[12, 60], [36, 92], [84, 92], [108, 60]]; // shut
  function mix(A, B, t) { return A.map(function (p, i) { return [lerp(p[0], B[i][0], t), lerp(p[1], B[i][1], t)]; }); }
  function pathD(P, move) {
    var q = function (pt) { return pt[0].toFixed(2) + " " + pt[1].toFixed(2); };
    return (move ? "M" : "L") + q(P[0]) + " C" + q(P[1]) + " " + q(P[2]) + " " + q(P[3]);
  }
  var scrollE = 0, idleE = 0, lidT = 0;
  function drawMark() {
    if (!lidUp) return;
    var e = Math.max(scrollE, idleE), l = lidT * e;
    var up = mix(C_UP, mix(E_UP, S_UP, l), e), lo = mix(C_LO, mix(E_LO, S_LO, l), e);
    lidUp.setAttribute("d", pathD(up, true)); lidLo.setAttribute("d", pathD(lo, true));
    eyeClip.setAttribute("d", pathD(up, true) + " " + pathD(lo, false) + " Z");
    var sw = lerp(12, 8.5, e).toFixed(2);
    lidUp.setAttribute("stroke-width", sw); lidLo.setAttribute("stroke-width", sw);
    var icx = lerp(48, 60, e), icy = lerp(60, 62, e), ir = lerp(12.5, 19, e);
    iris.setAttribute("cx", icx.toFixed(2)); iris.setAttribute("cy", icy.toFixed(2)); iris.setAttribute("r", ir.toFixed(2));
    hl.setAttribute("cx", (icx - lerp(5.5, 7, e)).toFixed(2)); hl.setAttribute("cy", (icy - lerp(6, 7.5, e)).toFixed(2)); hl.setAttribute("r", lerp(3.5, 5, e).toFixed(2));
    tri.setAttribute("opacity", String(1 - smooth(0, 0.5, e)));
    lashes.setAttribute("opacity", String(smooth(0.75, 1, l)));
    tilt.setAttribute("transform", "rotate(" + (-7 * l).toFixed(2) + " 60 60)");
  }
  // time-based tweens: a fixed tempo whatever the scroll speed
  function tween(ms, step, done) {
    var t0 = performance.now();
    (function f(now) { var t = Math.min(1, (now - t0) / ms); step(t); drawMark(); if (t < 1) requestAnimationFrame(f); else if (done) done(); })(t0);
  }
  var winking = false, winked = false;
  function wink(done) {                        // close · hold · open, ~1.4 s
    if (winking) return;
    winking = true;
    tween(1400, function (t) { lidT = smooth(0.05, 0.3, t) - smooth(0.6, 0.85, t); }, function () { winking = false; lidT = 0; if (done) done(); });
  }
  function idleWink() {                        // hero: the C opens into an eye, winks, becomes a C again
    if (winking || introP > 0.02 || document.hidden) return;
    tween(650, function (t) { idleE = smooth(0, 1, t); }, function () {
      wink(function () { setTimeout(function () { tween(650, function (t) { idleE = 1 - smooth(0, 1, t); }); }, 350); });
    });
  }

  // ── intro timeline ────────────────────────────────────────────────────────
  function onScroll() {
    if (!ANIM) { setNavLight(window.scrollY > (reveal ? reveal.offsetTop - 68 : H)); return; }
    var total = intro.offsetHeight - H;
    var p = total > 0 ? clamp(window.scrollY / total, 0, 1) : 1;
    introP = p;
    root.style.setProperty("--p", p.toFixed(4));

    // hero copy fades and lifts
    var hc = smooth(0, 0.16, p);
    heroCopy.style.opacity = String(1 - hc);
    heroCopy.style.transform = "translateY(" + (-40 * hc) + "px)";
    heroCopy.style.pointerEvents = hc > 0.5 ? "none" : "";
    if (cue) cue.style.opacity = String(1 - smooth(0, 0.05, p));

    // the mark: from its hero slot to the centre, growing (positions are pin-relative)
    var slot = markSlot.getBoundingClientRect(), pr = pin.getBoundingClientRect();
    var sx0 = slot.left - pr.left + slot.width / 2, sy0 = slot.top - pr.top + slot.height / 2;
    var size0 = slot.width || 84;
    var big = Math.min(W * 0.78, H * 0.62);
    var g = smooth(0.06, 0.34, p);
    var cx = lerp(sx0, W / 2, g), cy = lerp(sy0, H * 0.46, g);
    var scale = lerp(1, big / size0, g);

    // the C opens into an eye, then the wink fires once (scrolling back re-arms it)
    scrollE = smooth(0.34, 0.45, p);
    if (p > 0.46 && !winked) { winked = true; idleE = 0; wink(); }
    if (p < 0.3) winked = false;
    drawMark();

    // the iris swells into the screen and pales into the next section
    var ir = lerp(0, Math.hypot(W, H) * 1.05, smooth(0.58, 0.82, p));
    var eyeCy = cy + 2 / 120 * size0 * scale;    // the iris sits at the eye's centre
    irisLayer.style.clipPath = "circle(" + ir.toFixed(1) + "px at " + cx.toFixed(1) + "px " + eyeCy.toFixed(1) + "px)";
    reveal.style.opacity = String(smooth(0.8, 0.96, p));
    reveal.style.pointerEvents = p > 0.95 ? "auto" : "none";

    mark.style.opacity = String(1 - smooth(0.6, 0.7, p));
    mark.style.width = mark.style.height = size0 + "px";
    mark.style.transform = "translate(" + (cx - size0 / 2).toFixed(1) + "px," + (cy - size0 / 2).toFixed(1) + "px) scale(" + scale.toFixed(3) + ")";
    setNavLight(p > 0.7);
  }

  function onResize() {
    if (!measure(false)) return;
    if (ANIM) sizeCanvas();
    onScroll();
  }

  measure(true);
  if (ANIM && ctx) {
    sizeCanvas();
    drawMark();
    requestAnimationFrame(frameDraw);
    setInterval(idleWink, 7000);
    setTimeout(idleWink, 1500);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
  onScroll();

  // ── reveal-on-scroll for the content sections ─────────────────────────────
  var rvs = document.querySelectorAll(".rv");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    rvs.forEach(function (el) { io.observe(el); });
  } else {
    rvs.forEach(function (el) { el.classList.add("in"); });
  }

  // ── in-page anchors (the pinned intro makes the native jump land mid-animation) ──
  var menu = $("menu"), burger = $("burger");
  function closeMenu() { if (menu) menu.removeAttribute("data-open"); if (burger) burger.setAttribute("aria-expanded", "false"); }
  document.querySelectorAll("a[href^='#']").forEach(function (a) {
    a.addEventListener("click", function (ev) {
      var id = a.getAttribute("href").slice(1);
      var t = id === "top" ? document.body : $(id);
      if (!t) return;
      ev.preventDefault();
      var top = id === "top" ? 0 : t.getBoundingClientRect().top + window.scrollY - 64;
      // the example heading lives inside the pin: jump to where the intro has finished
      if (id === "pelda" && ANIM) top = intro.offsetHeight - H;
      window.scrollTo({ top: top, behavior: ANIM ? "smooth" : "auto" });
      closeMenu();
    });
  });
  if (burger && menu) burger.addEventListener("click", function () {
    var open = !menu.hasAttribute("data-open");
    if (open) menu.setAttribute("data-open", ""); else menu.removeAttribute("data-open");
    burger.setAttribute("aria-expanded", String(open));
  });

  var yearEl = $("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // ── billing toggle (the server renders both prices; this only switches) ───
  var arak = $("arak");
  document.querySelectorAll("[data-bill]").forEach(function (b) {
    b.addEventListener("click", function () {
      var y = b.getAttribute("data-bill") === "y";
      document.querySelectorAll("[data-bill]").forEach(function (o) { o.setAttribute("aria-pressed", String(o === b)); });
      if (arak) arak.classList.toggle("bill-y", y);
    });
  });

  // ── commission calculator ─────────────────────────────────────────────────
  var fmt = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " Ft"; };
  var rev = $("rev"), pct = $("pct");
  var plans = document.querySelector(".plans[data-full-year]");
  var fullYear = plans ? plans.getAttribute("data-full-year") : "";
  function calc() {
    var r = Number(rev.value), p = Number(pct.value), fee = r * p / 100;
    $("rev-out").textContent = fmt(r);
    $("pct-out").textContent = p + "%";
    $("fee-out").textContent = fmt(fee);
    $("quarter-out").textContent = "Ha minden negyedik foglalás közvetlenül jönne, évente " + fmt(fee / 4) + " maradna nálad." +
      (fullYear ? " A Teljes csomag egy évre " + fullYear + "." : "");
  }
  if (rev && pct) { rev.addEventListener("input", calc); pct.addEventListener("input", calc); calc(); }

  // ── sample request: name + map pin + e-mail → POST /api/mock-request ──────
  // The intake mails the preview link, so the contact is an e-mail address.
  var form = $("mock-form");
  if (!form) return;
  var nameEl = $("name"), mailEl = $("contact"), searchEl = $("f-search"), pinOut = $("pin-out");
  var mapEl = $("map"), note = $("form-note");
  var lat = null, lon = null, town = "", marker = null, map = null;

  function reverseGeocode(la, lo) {
    fetch("https://nominatim.openstreetmap.org/reverse?format=json&zoom=14&lat=" + la + "&lon=" + lo, { headers: { "Accept": "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var a = (d && d.address) || {};
        town = a.city || a.town || a.village || a.municipality || a.county || "";
        if (town && pinOut) pinOut.textContent = "Hely rögzítve: " + town + ". Ha nem pontos, kattints máshova.";
      })
      .catch(function () {});
  }
  function setPin(la, lo, zoom) {
    lat = la; lon = lo; town = "";
    if (marker) marker.setLatLng([la, lo]); else marker = L.marker([la, lo]).addTo(map);
    if (zoom) map.setView([la, lo], zoom);
    if (pinOut) pinOut.textContent = "Hely rögzítve. Ha nem pontos, kattints máshova.";
    $("f-pin").classList.remove("bad");
    reverseGeocode(la, lo);
  }
  if (mapEl && window.L) {
    map = L.map(mapEl, { scrollWheelZoom: false }).setView([47.16, 19.5], 7);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(map);
    map.on("click", function (e) { setPin(e.latlng.lat, e.latlng.lng); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) { if (es[0].isIntersecting) map.invalidateSize(); }).observe(mapEl);
    }
    var doSearch = function () {
      var q = (searchEl.value || "").trim();
      if (!q) return;
      fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=hu&q=" + encodeURIComponent(q), { headers: { "Accept": "application/json" } })
        .then(function (r) { return r.json(); })
        .then(function (list) {
          if (list && list[0]) setPin(parseFloat(list[0].lat), parseFloat(list[0].lon), 16);
          else if (pinOut) pinOut.textContent = "Nem találtam ilyen helyet. Írd pontosabban, vagy kattints a térképre.";
        })
        .catch(function () {});
    };
    searchEl.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); doSearch(); } });
  }

  mailEl.addEventListener("blur", function () { mailEl.value = mailEl.value.trim().toLowerCase(); });
  var EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  var esc = function (s) { return s.replace(/[<>&"]/g, ""); };
  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var business = nameEl.value.trim(), mail = mailEl.value.trim().toLowerCase();
    var okName = business.length >= 2, okPin = lat !== null, okMail = EMAIL.test(mail);
    $("f-name").classList.toggle("bad", !okName);
    $("f-pin").classList.toggle("bad", !okPin);
    $("f-contact").classList.toggle("bad", !okMail);
    if (!(okName && okPin && okMail)) {
      (okName ? (okPin ? mailEl : mapEl) : nameEl).scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    var btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    note.classList.remove("form-bad");
    note.textContent = "Küldés…";
    var fail = function () {
      btn.disabled = false;
      note.classList.add("form-bad");
      note.textContent = "Nem sikerült elküldeni. Kérlek, próbáld újra egy perc múlva.";
    };
    fetch("/api/mock-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ business: business, contact: mail, type: "Szálláshely", town: town, lat: lat.toFixed(6), lon: lon.toFixed(6) })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.ok) return fail();
        $("sent").innerHTML = "<b>Megkaptuk: „" + esc(business) + "”.</b><br>Elkészítjük a mintát, és a linkjét elküldjük ide: <b>" + esc(mail) + "</b>.";
        form.classList.add("done");
      })
      .catch(fail);
  });
})();
