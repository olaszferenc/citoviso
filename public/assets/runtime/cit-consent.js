/* Süti-hozzájárulás + Barion Pixel — CSAK a saját oldalunkon (citoviso.com).
 *
 * MIÉRT LÉTEZIK EGYÁLTALÁN: 2026-09-11-ig az oldalunk MÉRTEN 0 sütit tett le, és
 * pont ezért NEM volt süti-sávunk (ADR-0110: a kérdés akkor átfordult, mert a
 * mérés 0 sütit talált, és hazugság lett volna tájékoztatni valamiről, ami nem
 * történik). A Barion Pixel viszont KÖVETŐ szkript, a kártyás elfogadóhely
 * jóváhagyásának feltétele — vele a "0 süti" állapot megszűnik, tehát a sáv innentől
 * nem dísz, hanem kötelezettség.
 *
 * A SORREND A LÉNYEG: a Pixel CSAK a kifejezett "Elfogadom" után tölt be. Egy
 * hozzájárulás ELŐTT betöltő követő szkript pont azt a jogszabályt sértené, ami
 * miatt a sávot bevezetjük — a sáv ilyenkor díszlet volna, nem védelem.
 *
 * A döntést localStorage-ban tartjuk, nem sütiben: az elutasítás így NEM ír le
 * sütit. (A saját döntés tárolása a "feltétlenül szükséges" kivétel alá esik.)
 */
(function () {
  "use strict";
  var KEY = "cit-consent-v1";
  var el = document.currentScript;
  var pixelId = (el && el.getAttribute("data-pixel-id")) || "";
  // ⛔ Azonosító nélkül NINCS sáv és NINCS Pixel: egy üresben megjelenő sáv
  // hozzájárulást kérne olyan követésre, ami meg sem történik (§B.17).
  if (!pixelId) return;

  function loadPixel() {
    if (window.__citPixelLoaded) return;
    window.__citPixelLoaded = true;
    window.bp =
      window.bp ||
      function () {
        (window.bp.q = window.bp.q || []).push(arguments);
      };
    window.bp("init", "addBarionPixelId", pixelId);
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://pixel.barion.com/bp.js";
    document.head.appendChild(s);
  }

  var saved = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch (e) {
    /* privát mód: nincs tárolás — ilyenkor minden betöltéskor kérdezünk */
  }
  if (saved === "all") {
    loadPixel();
    return;
  }
  if (saved === "necessary") return;

  function decide(value) {
    try {
      localStorage.setItem(KEY, value);
    } catch (e) {
      /* ha nem tudjuk eltárolni, akkor is tiszteljük a mostani döntést */
    }
    var bar = document.getElementById("cit-consent");
    if (bar) bar.parentNode.removeChild(bar);
    if (value === "all") loadPixel();
  }

  function render() {
    var bar = document.createElement("div");
    bar.id = "cit-consent";
    bar.setAttribute("role", "dialog");
    bar.setAttribute("aria-live", "polite");
    bar.setAttribute("aria-label", "Süti-hozzájárulás");
    bar.innerHTML =
      '<div class="cit-consent__in">' +
      '<p class="cit-consent__t">A biztonságos kártyás fizetéshez a fizetési szolgáltatónk ' +
      "(Barion) csalásmegelőző sütiket használna. Enélkül az oldal ugyanúgy működik.  " +
      '<a href="/adatvedelem">Adatkezelési tájékoztató</a></p>' +
      '<div class="cit-consent__b">' +
      '<button type="button" data-c="necessary" class="cit-consent__no">Csak a szükségeseket</button>' +
      '<button type="button" data-c="all" class="cit-consent__yes">Elfogadom</button>' +
      "</div></div>";
    document.body.appendChild(bar);
    bar.addEventListener("click", function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest("button[data-c]") : null;
      if (b) decide(b.getAttribute("data-c"));
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
