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

  /**
   * A hozzájárulásra VÁRÓ események. A gazdalap ide tolja be deklaratívan, amit
   * küldene (`window.citPixelQueue.push([név, adat])`) — a szerver által tudott
   * eseményeket (pl. a megtörtént `purchase`-t) a lap már a HTML-ben így adja be.
   *
   * ⛔ A sor a lap memóriájában él: hozzájárulás nélkül SEMMI nem jut a Barionhoz,
   * és elutasításkor soha nem is ürül (a `loadPixel()` meg sem hívódik). A sáv így
   * nem díszlet, hanem valódi kapu (ADR-0110/0151).
   */
  window.citPixelQueue = window.citPixelQueue || [];

  /**
   * A gazdalap egyetlen belépési pontja: `window.citPixel("addToCart", {...})`.
   *
   * ⛔ HOZZÁJÁRULÁS ELŐTT NEM KÜLD — de nem is dob el. A sáv a lap tetején
   * jelenik meg, a vevő viszont AZONNAL kapcsolgat: a konfigurátor `contentView`-ja
   * és az első modul-kattintások mérten a döntés ELŐTT történnek. Ha ezeket
   * eldobnánk, a Full Pixel pont a kosár-eseményeket veszítené el — azt, amiért
   * az egész bekötés készült.
   *
   * Amit teszünk: a lap memóriájában várakoznak (nem sütiben, nem tárolóban, a
   * Barionhoz semmi nem jut el), és KIZÁRÓLAG az „Elfogadom" után mennek ki.
   * Elutasításkor a sor soha nem ürül — a `loadPixel()` meg sem hívódik.
   */
  window.citPixel = function (eventName, data) {
    if (!window.__citPixelLoaded || !window.bp) {
      window.citPixelQueue.push([eventName, data || {}]);
      return;
    }
    try {
      // ⛔ NEM MINDEN ESEMÉNY „track" (Barion-elutasítás, 2026-09-18: a Full Pixel
      // emiatt bukott Starterre — a két kötelező esemény MÁS bp-csatornán megy, és
      // nálunk fel sem merült, mert az őrünk a SAJÁT listánkat mérte, nem a Barionét):
      //   · grantConsent      → bp('consent', …) — paraméter nélkül;
      //   · setEncryptedEmail → bp('identity', …, <email>) — kisbetűs plaintext,
      //     a SHA-1 hash-t a bp.js maga számolja (docs.barion.com/SetEncryptedEmail).
      if (eventName === "grantConsent") window.bp("consent", "grantConsent");
      else if (eventName === "setEncryptedEmail") window.bp("identity", "setEncryptedEmail", data);
      else window.bp("track", eventName, data || {});
    } catch (e) {
      /* a mérés soha nem törheti el a lapot */
    }
  };

  function loadPixel() {
    if (window.__citPixelLoaded) return;
    window.bp =
      window.bp ||
      function () {
        (window.bp.q = window.bp.q || []).push(arguments);
      };
    // ⛔⛔ EZ NÉLKÜL A PIXEL NÉMA — ÉLESEN MÉRVE (2026-09-16, citoviso.com).
    // A `bp.js` a saját azonosítóját KÉT helyről tudja kiolvasni: `window.barion_pixel_id`,
    // vagy egy INLINE szkript szövegéből (`/.*BP-.{10}-.*/` minta). Mi az azonosítót a
    // betöltő szkript `data-pixel-id` ATTRIBÚTUMÁBAN adjuk át — ami egyiknek sem felel
    // meg —, ezért a Barion saját kódja „Base code implementaion not found" hibát adott,
    // a küldő iframe (`barion_receiver`) fel sem épült, és az események feldolgozatlanul
    // álltak a sorban. Élesen mérve: `bp.js` + `barion.html` letöltve, küldő iframe
    // HIÁNYZIK, 2 üzenet a sorban. A kapunk tehát rendben volt, a CSATORNA nem.
    window.barion_pixel_id = pixelId;
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://pixel.barion.com/bp.js";
    // ⛔⛔ A BETÖLTÉS SORRENDJE ITT NEM STÍLUS-KÉRDÉS — ezen múlik, elmegy-e bármi.
    // A `bp.js` (0.4.0) a kimenő üzenetet egy IFRAME-nek posztolja, és a kézfogás
    // ÍGY indul: `window.addEventListener('load', create_iframe)` → `barion.html`
    // → `pixelStatusBase` → `barionbase.html` (id=`barion_receiver`) →
    // `pixelStatus` → `load_tracker()` → csak EKKOR kezdi feldolgozni a sort.
    // Mi viszont a HOZZÁJÁRULÁS után töltünk be, ami rendszerint a `load` után van
    // — az esemény tehát nem jön el újra, iframe nem születik, és a `send_message`
    // a saját naplójába ír („iframe is undefined now").
    //
    // ⭐ A/B-VEL MÉRVE, és az eredmény ÁRNYALTABB, mint ahogy először leírtam:
    //   · ha a látogató GYORSAN dönt (a lap `load`-ja előtt): a szintetikus esemény
    //     NÉLKÜL 6 állítás bukik — egyetlen esemény sem jut ki;
    //   · ha KÉSŐBB dönt (readyState=complete): nélküle is kiment minden.
    // Vagyis az első „ez élesben is néma" állításom TÚLZÓ volt, a második
    // („fölösleges a javítás") pedig HIBÁS: a hiba időzítés-függő. A dispatch marad,
    // mert a rossz ág néma adatvesztés, a jó ágon pedig nem ront.
    // ⚠️ A szintetikus esemény a gazdalap `load`-figyelőit is megszólítja; a
    // sajátunkból egy van (a hívó pirula pozicionálása), és az ismételhető.
    s.onload = function () {
      try {
        if (document.readyState === "complete") window.dispatchEvent(new Event("load"));
      } catch (e) {
        /* régi böngésző: marad a szkript saját kézfogása */
      }
      window.__citPixelLoaded = true;
      window.bp("init", "addBarionPixelId", pixelId);
      drain();
    };
    document.head.appendChild(s);
    // ⛔ A `bp.js` MAGÁTÓL NEM KÜLD lap-megtekintést (mérve a 0.4.0 forrásán: az
    // `addBarionPixelId` ág csak egy bejelentkező üzenetet posztol, `contentView`
    // sehol nem sül el automatikusan). Emiatt a JS-es látogatóink után eddig
    // EGYETLEN contentView sem jutott ki, miközben a `<noscript>` képünk a JS
    // nélkülieknek küldött egyet — a Base implementáció így a látogatók 99%-ára
    // néma volt. A `contentView` a Base KÖTELEZŐ eleme (Barion díjszabás:
    // „Base Barion Pixel elhelyezése", mindkét díjcsomag feltétele).
  }

  /**
   * A hozzájárulás megvan, az iframe áll — mehet, ami eddig várt.
   * Elsőként a LAP-MEGTEKINTÉS (kötelező mezők nem-Product tartalomnál: id,
   * contentType, name), utána a sorban álló események, beérkezési sorrendben.
   */
  function drain() {
    // ⭐ ELSŐKÉNT a hozzájárulás ténye (Full Pixel kötelező #1, docs.barion.com/GrantConsent):
    // a Barion minden további eseményt CSAK érvényes grantConsent mellett dolgoz fel,
    // ezért a sor élén megy — és minden lap-betöltésen újra (a CMP-k is így jelzik;
    // a hozzájárulás visszavonásig vagy 2 évig érvényes). Ide CSAK „Elfogadom" után
    // jut el a futás, tehát az esemény sosem hazudik hozzájárulást.
    window.citPixel("grantConsent");
    window.citPixel("contentView", {
      contentType: "Page",
      id: location.pathname,
      name: document.title || location.pathname,
    });
    var q = window.citPixelQueue;
    // Innentől a `push` AZONNAL küld — így a lap későbbi eseményei nem gyűlnek
    // egy sorban, amit senki nem ürít.
    window.citPixelQueue = { push: function (a) { window.citPixel(a[0], a[1]); } };
    for (var i = 0; i < q.length; i++) window.citPixel(q[i][0], q[i][1]);
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
    // A sáv elment — a helyfoglalást is visszaadjuk (lásd publishHeight).
    document.documentElement.style.removeProperty("--citui-consent-h");
    if (value === "all") loadPixel();
  }

  /**
   * Kipublikáljuk a sáv MÉRT magasságát a gyökérre (`--citui-consent-h`), hogy a
   * gazdalap fenn tudja tartani magának a helyet, amíg a sáv kinn van.
   *
   * ⛔ MIÉRT KELL: a sáv a lap aljára rögzített, teljes szélességű réteg, és MÉRTEN
   * eltakarta a tenant-admin navigációját — mobilon a fül-sáv alsó sorát (11 fülből
   * 6-ot), asztalin az oldalsáv „Kilépés" gombját. A tulaj döntése: a
   * hozzájárulás-kérdés NEM teheti elérhetetlenné a navigációt. A sáv nem tud a
   * gazdalap bútorzatáról (és nem is kell tudnia) — csak magáról közöl tényt; hogy
   * ezzel mit tesz, azt a felület dönti el a saját CSS-ében.
   */
  function publishHeight(bar) {
    var h = Math.round(bar.getBoundingClientRect().height);
    if (h > 0) document.documentElement.style.setProperty("--citui-consent-h", h + "px");
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
    publishHeight(bar);
    // A magasság a sáv szélességétől függ (a próza tördel, és ≤560px-en a gombok
    // külön sorba kerülnek) — átméretezéskor tehát újra kell mérni, különben a
    // gazdalap elavult helyet tartana fenn.
    window.addEventListener("resize", function () {
      if (document.getElementById("cit-consent")) publishHeight(bar);
    });
    // ⛔ ÉS ÚJRA, AMIKOR A BETŰ MEGJÖN. Az Inter Google-webfont `display=swap`-pal:
    // a sáv először tartalék betűvel rendereldik, a csere után a próza ÚJRA TÖRDEL,
    // tehát az első mérés elavul — a gazdalap pedig rossz méretű helyet tartana fenn.
    // Egy mérés, ami „egyszer igaz volt", itt pont annyit ér, mint egy találgatás.
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(function () {
        if (document.getElementById("cit-consent")) publishHeight(bar);
      });
    }
    bar.addEventListener("click", function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest("button[data-c]") : null;
      if (b) decide(b.getAttribute("data-c"));
    });
  }

  /**
   * A KIKÜLDÖTT LAPON (data-cit-consent-defer a <html>-en) a kérdés az ELSŐ görgetésig,
   * érintésig vagy billentyűig vár (2026-09-26, first-screen-compact B): a lead előbb a
   * tervet lássa, ne a sávot — követés addig sincs, a Pixel csak az „Elfogadom" után tölt.
   * Minden más lapon azonnal kérdezünk, mint eddig.
   */
  function renderWhenEngaged() {
    if (!document.documentElement.hasAttribute("data-cit-consent-defer")) return render();
    var done = false;
    function go() {
      if (done) return;
      done = true;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointerdown", go, true);
      window.removeEventListener("keydown", go, true);
      render();
    }
    function onScroll() {
      if (window.scrollY > 40) go();
    }
    // ⛔ A vásárlói réteg (pirula, panel) érintése NEM „érintés": ha a pirula koppintása
    // hozná be a sávot, a pirula az ujj alól csúszna feljebb (mérve: a koppintás 3 mp-ig
    // instabil célpontra várt, a konfigurátor nem nyílt ki). A kérdés a LAP érintésére
    // vagy görgetésre jön; a fizetés-lapon (nem halasztott) mindenképp megjelenik.
    function onPointer(ev) {
      var t = ev.target;
      if (t && t.closest && t.closest('[class*="cit-cfg"]')) return;
      go();
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", go, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderWhenEngaged);
  } else {
    renderWhenEngaged();
  }
})();
