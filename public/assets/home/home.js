/*
 * Citoviso public homepage — page-specific behaviours.
 * ADR-0021 ②. Shared chrome (header/menu/reveal) lives in ../ui/citui.js.
 * FAQ works without JS too: the answer markup is in the DOM; JS only adds the
 * accordion collapse. (With no JS the browser shows all answers — no dead content.)
 */
(function () {
  "use strict";

  // FAQ accordion (single-open)
  var questions = document.querySelectorAll(".faq-question");
  questions.forEach(function (button) {
    button.addEventListener("click", function () {
      var item = button.closest(".faq-item");
      var wasOpen = item.classList.contains("open");
      document.querySelectorAll(".faq-item").forEach(function (faq) { faq.classList.remove("open"); });
      if (!wasOpen) item.classList.add("open");
    });
  });

  // Dynamic copyright year
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // ── Mock request: map picker + real POST to the intake API (ADR-0022) ──
  var form = document.getElementById("mock-form");
  var note = document.getElementById("mock-form-note");
  var mapEl = document.getElementById("mock-map");
  var latEl = document.getElementById("f-lat");
  var lonEl = document.getElementById("f-lon");
  var townEl = document.getElementById("f-town");
  var searchEl = document.getElementById("f-search");
  var readout = document.getElementById("map-readout");

  // Leaflet map: click to drop the pin → exact coordinates → precise, high-confidence resolve.
  var marker = null;
  if (mapEl && window.L) {
    var map = L.map(mapEl).setView([47.16, 19.5], 7); // Hungary
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap"
    }).addTo(map);

    var setPin = function (lat, lon, zoom) {
      latEl.value = lat.toFixed(6);
      lonEl.value = lon.toFixed(6);
      if (marker) marker.setLatLng([lat, lon]);
      else marker = L.marker([lat, lon]).addTo(map);
      if (zoom) map.setView([lat, lon], zoom);
      if (readout) { readout.textContent = "Kiválasztott helyszín rögzítve. Ha nem pontos, kattints máshova."; readout.style.color = "var(--citui-ok)"; }
      reverseGeocode(lat, lon);
    };

    map.on("click", function (e) { setPin(e.latlng.lat, e.latlng.lng); });

    // Reverse geocode (Nominatim) to auto-fill the town — a helper, not required.
    var reverseGeocode = function (lat, lon) {
      fetch("https://nominatim.openstreetmap.org/reverse?format=json&zoom=14&lat=" + lat + "&lon=" + lon, { headers: { "Accept": "application/json" } })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var a = (d && d.address) || {};
          var town = a.city || a.town || a.village || a.municipality || a.county || "";
          if (town && townEl) townEl.value = town;
        })
        .catch(function () {});
    };

    // Address/town search (Nominatim) → recenter + drop pin.
    var doSearch = function () {
      var q = (searchEl.value || "").trim();
      if (!q) return;
      fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=hu&q=" + encodeURIComponent(q), { headers: { "Accept": "application/json" } })
        .then(function (r) { return r.json(); })
        .then(function (list) {
          if (list && list[0]) setPin(parseFloat(list[0].lat), parseFloat(list[0].lon), 16);
          else if (readout) { readout.textContent = "Nem találtam ilyen helyet — próbáld pontosabban, vagy kattints a térképre."; readout.style.color = "var(--citui-warn)"; }
        })
        .catch(function () {});
    };
    if (searchEl) {
      searchEl.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); doSearch(); } });
      searchEl.addEventListener("blur", function () { if (!latEl.value) doSearch(); });
    }

    // Leaflet needs a size recalc once the section is laid out.
    setTimeout(function () { map.invalidateSize(); }, 300);
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var get = function (n) { var el = form.elements[n]; return el ? String(el.value).trim() : ""; };
      if (!get("business") || !get("contact")) {
        if (note) { note.textContent = "Kérlek add meg a vállalkozás nevét és az elérhetőséget."; note.style.color = "var(--citui-bad)"; }
        return;
      }
      if (!get("lat") || !get("lon")) {
        if (note) { note.textContent = "Jelöld meg a helyszínt a térképen (keress rá, vagy kattints a pontos helyre)."; note.style.color = "var(--citui-bad)"; }
        return;
      }
      var payload = {
        business: get("business"), contact: get("contact"), type: get("type"),
        town: get("town"), lat: get("lat"), lon: get("lon")
      };
      var btn = form.querySelector("button[type=submit]");
      if (btn) btn.disabled = true;
      if (note) { note.textContent = "Küldés…"; note.style.color = "var(--citui-muted)"; }
      fetch("/api/mock-request", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.ok) {
            form.innerHTML = '<div style="text-align:center;padding:24px 8px">' +
              '<h3 style="color:var(--citui-navy-900)">Köszönjük! Már készítjük a mintádat.</h3>' +
              '<p style="color:var(--citui-muted)">Hamarosan e-mailben küldjük az előnézet linkjét a megadott elérhetőségre.</p></div>';
          } else {
            if (note) { note.textContent = "Hiba történt a küldés során. Kérlek próbáld újra."; note.style.color = "var(--citui-bad)"; }
            if (btn) btn.disabled = false;
          }
        })
        .catch(function () {
          if (note) { note.textContent = "Hiba történt a küldés során. Kérlek próbáld újra."; note.style.color = "var(--citui-bad)"; }
          if (btn) btn.disabled = false;
        });
    });
  }
})();
