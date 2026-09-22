// ⭐⭐ ŐR: a publikus szoba-kártya és a részletek-felugró KONTRAKTUSA.
//
// A KONTRAKTUS: assets/design-refs/tenant-site/rooms-card/README.md (B változat, a tulaj
// 2026-09-21-én hagyta jóvá). Az itteni állítások MIND a README „KÖT" pontjaiból
// származnak — ez az őr a szerződés gépi olvasata, nem stílus-ízlés.
//
// ⛔ A HÁROM CSAPDA, amit ez a kör MÁR MEGFIZETETT — mindhármat a KÉP fogta meg,
// miközben a gépi mérés ZÖLDEN átengedte. Ezért mér így:
//   ① `display:flex` ÜTI a `[hidden]` attribútumot. Egyetlen fotónál is kifestődött az
//      indexkép-sáv, miközben `el.hidden === true` volt. → a KIFESTETT dobozt mérjük
//      (getBoundingClientRect + getComputedStyle().display), soha a DOM-tulajdonságot.
//   ② A DOM NEM A KÉPERNYŐ. A felugrón a 9 felszereltségből NULLA látszott, az őr mégis
//      9-et jelentett — `<li>`-t számolt. → a kérdés az, hogy a VENDÉG ELŐTT van-e:
//      a panel látható sávján belül, és `elementFromPoint` őt adja vissza.
//   ③ A magasság a STAGE-en ül, nem a galéria burkolóján. Burkolón `height+overflow:hidden`
//      → a 68px-es indexkép-sáv teljesen levágódott. → a sáv ALJÁT a panel aljához mérjük.
//
//   npx tsx scripts/room-details-check.mts            — a kapu (MIND a 19 sablon)
//   npx tsx scripts/room-details-check.mts --selftest — NEGATÍV önteszt
//   npx tsx scripts/room-details-check.mts artdeco    — egy sablonra szűkítve
//   npx tsx scripts/room-details-check.mts --keep     — a renderelt lapok maradnak
//
// ⚠️ A `--selftest` minden visszarontáshoz KONTROLLT is visz: ahol a hiba szerkezetileg
// nem jöhet elő, ott ZÖLDNEK kell maradnia. Egy piros önmagában nem bizonyít semmit —
// attól is pirosra mehetne, hogy a visszarontás bármit eltört.

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { chromium, type Page } from "playwright-core";

import { config } from "../src/config.js";
import { injectRuntime } from "../src/generator/runtime.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { amenityByLabel, amenitySvg } from "../src/tenant/amenityCatalog.js";
import type { Recipe, Room, SiteData } from "../src/engine/recipe.js";

const KEEP = process.argv.includes("--keep");
const SELFTEST = process.argv.includes("--selftest");
const ONLY = process.argv.filter((a) => !a.startsWith("--")).slice(2);

// ── fixture: a TERMÉK forrásából, nem kézzel ────────────────────────────────────
// Az ikonok a 70 tételes ÉLES katalógusból jönnek a VALÓDI resolverrel — egy kézzel
// írt ikon-fixture azt mérné, hogy le tudtam-e másolni egy SVG-t.
function am(label: string) {
  const item = amenityByLabel(label);
  if (!item) throw new Error(`a fixture „${label}" címkéje NINCS a katalógusban — a mérés ` +
    `ikon nélküli ágat mérne, és azt hinné, hogy az a normális`);
  return { label, icon: amenitySvg(item) };
}

const NINE = [
  "Ingyenes Wi‑Fi", "Síkképernyős TV", "Netflix, streaming", "Játékkonzol",
  "Hangfal, zenelejátszó", "Mosógép", "Mikrohullámú sütő", "Mosogatógép", "Saját fürdőszoba",
].map(am);

/** Betöltődő, determinisztikus kép (data URI — hálózat nélkül is él). */
function photo(n: number, fill: string) {
  return {
    url: "data:image/svg+xml;base64," + Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600">` +
      `<rect width="900" height="600" fill="${fill}"/></svg>`).toString("base64"),
    alt: `Fixture kép ${n}`,
    provenance: "owner" as const,
  };
}
const P = [photo(1, "#2f6b57"), photo(2, "#3a5f7d"), photo(3, "#7d5f3a"), photo(4, "#5f3a7d")];

const DESC_MANY = "A teljes ház a kertre nyíló nappalival és tágas konyhával.";
const DESC_ONE = "Külön bejárat, teakonyha, csendes sarok a kert végében.";

/** A három forgatókönyv EGY lapon: a mérés így ugyanazon a renderen látja mindet. */
const UNITS = [
  { id: "u-teljes", name: "Teljes Szállás", capacity: 12 },
  { id: "u-kerti", name: "Kerti Appartman", capacity: 4 },
  { id: "u-teto", name: "Tetőtéri Appartman", capacity: 6 },
];

const ROOMS: Room[] = [
  {
    // ⭐ A SOK-fotós, SOK-felszereltséges eset: a galéria-vezérlők ÉS a 6-tétel szabály.
    // ⭐ ÉS a TÖBB-ÁRÚ eset: a kártyán PADLÓ-ár („-tól"), a felugróban a dátum-mondat.
    name: "Teljes Szállás", unitId: "u-teljes", capacity: "12 fő",
    price: "24 000 Ft-tól / éj", priceFrom: true,
    description: DESC_MANY, amenities: NINE, wholeProperty: true,
    photo: P[0], photos: P, slug: "teljes-szallas",
  },
  {
    // ⭐ AZ ALAPESET: EGY fotó, EGY ár. Mérve: 4 egységből 3-nak egy képe van — tehát a
    // „halott vezérlő" tilalmat ITT kell bizonyítani, nem a széleken. Egy árnál NINCS
    // „-tól" és NINCS dátum-mondat: az a padló-jelzés ott hazugság volna.
    name: "Kerti Appartman", unitId: "u-kerti", capacity: "4 fő", price: "18 000 Ft / éj",
    description: DESC_ONE, amenities: [am("Ingyenes Wi‑Fi"), am("Saját fürdőszoba")],
    photo: P[1], slug: "kerti-appartman",
  },
  {
    // ⭐ AZ ÜRES egység: se leírás, se felszereltség → őszinte mondat, alcím NÉLKÜL.
    name: "Tetőtéri Appartman", unitId: "u-teto", capacity: "6 fő", photo: P[2],
  },
];

const DATE_NOTE = "A pontos ár a dátumoktól függ.";

const EMPTY_SENTENCE = "Ehhez az egységhez még nincs leírás és felszereltség megadva.";
const AM_HEADING = "Amit ez az egység kínál";

function siteData(): SiteData {
  return {
    name: "ELEK-TESZT Vendégház",
    tagline: "Csend a Balatonnál",
    intro: "Kétszáz méterre a strandtól, saját kerttel és árnyas terasszal.",
    highlights: ["Saját parkoló", "Kutyabarát", "Kert"],
    photos: P,
    contact: { email: "info@example.invalid", phone: "+36 30 000 0000", address: "Fő utca 1." },
    place: { city: "Balatonboglár", country: "HU" },
    rooms: ROOMS,
    // ⚠️ A foglalás-modul NÉLKÜL a „melyik szobáról ugrottam le" állítás nem mérhető:
    // nincs egység-választó, amit meg lehetne nézni. A hiba pont ott él, ahol pénz van.
    booking: { units: UNITS, minNights: 1, maxNights: 14, horizonMonths: 6, leadTimeDays: 0 },
  } as unknown as SiteData;
}

const WIDTHS = [
  { w: 390, h: 780, label: "mobil 390px" },
  { w: 1280, h: 820, label: "asztali 1280px" },
];

// ── a lapon futó mérés ──────────────────────────────────────────────────────────
// STRING, mert a tsx/esbuild `keepNames`-e `__name(...)` hívást injektálna a nyilazott
// függvényekbe, ami `page.evaluate`-ben ReferenceError.
const PROBE = `(function (cfg) {
  var out = { fatal: null, findings: [], shells: 0, cards: 0, cardCtas: 0 };
  function bad(kind, detail) { out.findings.push({ kind: kind, detail: detail }); }

  var sec = document.querySelector('[data-cit-module="rooms"]');
  if (!sec) return { fatal: "nincs [data-cit-module=rooms] horgony a lapon", findings: [], shells: 0, cards: 0 };

  // A KIFESTETT doboz. ⛔ Soha a DOM-tulajdonság: display:flex üti a [hidden]-t, és a
  // mérés egyszer már zölden átengedett egy kifestett, halott vezérlőt.
  function painted(el) {
    if (!el) return null;
    var cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) return null;
    var r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return null;
    return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, op: parseFloat(cs.opacity) };
  }
  function box(el) { var p = painted(el); return p ? [Math.round(p.l), Math.round(p.t), Math.round(p.w), Math.round(p.h)] : null; }

  // ⛔ „A vendég előtt van-e?" — nem az, hogy létezik-e <li>. A pont a képernyőn belül
  // legyen, ÉS a legfelső festett elem az adott elem (vagy a leszármazottja) legyen.
  function reallyVisible(el, host) {
    var p = painted(el);
    if (!p) return false;
    if (p.t < 0 || p.b > window.innerHeight || p.l < 0 || p.r > window.innerWidth) return false;
    if (host) {
      var hb = host.getBoundingClientRect();
      if (p.t < hb.top - 0.5 || p.b > hb.bottom + 0.5) return false;   // a doboz alá esett
    }
    var x = Math.round(p.l + p.w / 2), y = Math.round(p.t + p.h / 2);
    var hit = document.elementFromPoint(x, y);
    return !!(hit && (el === hit || el.contains(hit) || hit.contains(el)));
  }

  // ── ① A HORGONY ÉS A KÁRTYA ────────────────────────────────────────────────
  var shells = sec.querySelectorAll(".cit-room__open[data-cit-room]");
  out.shells = shells.length;
  // Hány szoba-kártyát rajzolt a sablon? A NÉV a horgony: minden kirajzolt szoba-név
  // legyen egy shellen BELÜL. Így egy jövőbeli sablon, ami a kártyát megrajzolja de a
  // horgonyt kihagyja, PIROSRA megy — nem „nulla kártya, tehát rendben"-re.
  var secText = (sec.innerText || "").toLowerCase();
  var named = 0, unanchored = [];
  for (var ni = 0; ni < cfg.names.length; ni++) {
    var nm = cfg.names[ni];
    if (secText.indexOf(nm.toLowerCase()) < 0) continue;   // ezt a szobát nem rajzolta ki
    named++;
    var inShell = false;
    for (var si = 0; si < shells.length; si++) {
      if ((shells[si].innerText || "").toLowerCase().indexOf(nm.toLowerCase()) >= 0) { inShell = true; break; }
    }
    if (!inShell) unanchored.push(nm);
  }
  out.cards = named;
  if (!named) bad("nincs-kirajzolt-szoba", "a rooms horgony megvan, de egyetlen szoba-név sincs a szekcióban");
  if (unanchored.length) bad("horgony-nelkuli-kartya", unanchored.join(", "));

  // ⛔ A kártyán NINCS leírás és NINCS felszereltség (kontraktus §1).
  var leaked = [];
  for (var li = 0; li < cfg.forbiddenOnCard.length; li++) {
    if (secText.indexOf(cfg.forbiddenOnCard[li].toLowerCase()) >= 0) leaked.push(cfg.forbiddenOnCard[li]);
  }
  if (leaked.length) bad("a-kartyan-van-a-leiras-vagy-felszereltseg", leaked.join(" | ").slice(0, 120));

  // A jelvény: HOVER NÉLKÜL kifestve, a képen BELÜL, és nem ígér többet, mint ami van.
  for (var s2 = 0; s2 < shells.length; s2++) {
    var sh = shells[s2];
    sh.scrollIntoView({ block: "center", behavior: "instant" });
    var idx = sh.getAttribute("data-cit-room");
    var want = cfg.hintByIndex[idx];
    var hint = sh.querySelector(".cit-rmhint");
    if (!want) continue;                       // ehhez a szobához nincs fotó → nincs jelvény
    var hp = painted(hint);
    if (!hp) { bad("nincs-kifestett-jelveny", "szoba #" + idx); continue; }
    if (hp.op < 1) bad("a-jelveny-nem-teljesen-lathato", "szoba #" + idx + " opacity=" + hp.op);
    var txt = (hint.textContent || "").replace(/\\s+/g, " ").trim();
    // ⛔ SOHA nem „1 kép": az galériát ígérne, amit a felugró nem tud megtartani.
    if (txt !== want) bad("rossz-jelveny-felirat", "szoba #" + idx + " várt=„" + want + "\\" kapott=„" + txt + "\\"");
    var im = sh.querySelector("img");
    var ib = im ? im.getBoundingClientRect() : null;
    if (ib && ib.width > 1) {
      if (hp.r > ib.right + 1.5 || hp.b > ib.bottom + 1.5 || hp.l < ib.left - 1.5 || hp.t < ib.top - 1.5) {
        bad("a-jelveny-kilog-a-kepbol", "szoba #" + idx + " jelveny=" + JSON.stringify(box(hint)) +
          " kep=[" + [Math.round(ib.left), Math.round(ib.top), Math.round(ib.width), Math.round(ib.height)] + "]");
      }
    }
    // ⛔⛔ A BURKOLÓ NEM ZSUGORÍTHATJA A KÁRTYÁT. A kattintható héj egyetlen flex-elemmé
    // fogta össze a kártya tartalmát, és egy align-items:flex-start rácsban a szoba
    // fotója teljes szélességűről 75×50 px-re esett össze — a jelvény majdnem az egész
    // képet betakarta. A héj HÉJ, nem új elrendezés: annyi helyet foglal, amennyit a
    // kicserélt markup foglalt. (Ezt egy IDEGEN őr fogta meg, nem ez — most már ez is.)
    var host = sh.parentElement;
    if (host) {
      var hw = host.getBoundingClientRect().width, sw = sh.getBoundingClientRect().width;
      if (hw > 40 && sw < hw * 0.6) {
        bad("a-burkolo-osszezsugoritotta-a-kartyat",
          "szoba #" + idx + " héj=" + Math.round(sw) + "px szülő=" + Math.round(hw) + "px");
      }
    }

    // A kártya valódi link, ahol van aloldal (SEO, ADR-0041).
    var expectHref = cfg.hrefByIndex[idx];
    var href = sh.getAttribute("href");
    if (expectHref && href !== expectHref) bad("a-kartya-nem-az-aloldalra-mutat", "szoba #" + idx + " href=" + href);
    if (!expectHref && sh.tagName === "A") bad("link-aloldal-nelkul", "szoba #" + idx + " <a> van, de nincs aloldala");
  }

  // ── ①b A LEUGRÁS VISZI-E A SZOBÁT? ────────────────────────────────────────
  // ⛔ Mérve 2026-09-22: a 2. szoba „Foglalás"-a leugrott a foglalás-szekcióra, és a
  // választót az 1. egységen hagyta — rossz naptár, rossz ár, és a beküldés a ROSSZ
  // egységre ment volna. A kérdés nem az, hogy odaugrik-e, hanem hogy MIT VISZ MAGÁVAL.
  var sel = document.querySelector('[name="unit"]');
  var ctas = sec.querySelectorAll('a[href="#cit-booking"], a[href="#cit-enquiry"]');
  // ⚠️ A KÉRDÉS NEM A GOMB, HANEM AZ ÚT. Három sablon (arch-frames, tilted-gallery,
  // wordmark-grow) kártyája szándékosan szikár: fotó + név + férőhely + ár, CTA nélkül —
  // ott a felugró „Foglalás"-a az út, és azt a felugró-szonda méri (ott KÖT, mind a 19-en).
  // Itt csak azt kötjük ki: AHOL VAN kártya-gomb, ott vinnie KELL a szobát.
  out.cardCtas = ctas.length;
  if (cfg.expectCta && ctas.length) {
    if (!sel) bad("nincs-egyseg-valaszto", "van foglalás-gomb, de nincs mihez vinni a szobát");
    else {
      // a MÁSODIK szoba gombja — az elsőn a hiba szerkezetileg láthatatlan volna
      var want = cfg.unitByIndex["1"];
      var target = null;
      for (var ci = 0; ci < ctas.length; ci++) {
        var card = ctas[ci].closest("article, li, tr, figure, .cit-whole, .cit-modsec__item");
        var h = card ? card.querySelector('[data-cit-room-unit="' + want + '"]') : null;
        if (h || ctas[ci].getAttribute("data-cit-room-unit") === want) { target = ctas[ci]; break; }
      }
      if (!target) bad("a-foglalas-gomb-nem-tudja-melyik-szoba", "szoba #1 (" + want + ")");
      else {
        var before = sel.value;
        target.click();
        if (sel.value !== want) {
          bad("a-leugras-nem-vitte-at-a-szobat",
            "kattintás a 2. szoba gombján: választó " + before + " → " + sel.value + " (várt: " + want + ")");
        }
        sel.value = before;
      }
    }
  }

  // ── ①c AZ ÁR-SOR ALAKJA ────────────────────────────────────────────────────
  // ⛔ Több ár → PADLÓ, kimondott „-tól"-lal. Enélkül a kártya olyan számot állít, ami
  // alatta van annak, amit a vendég fizetni fog — pont az Elek FK-007 hiba.
  for (var pi = 0; pi < cfg.priceByIndex.length; pi++) {
    var want2 = cfg.priceByIndex[pi];
    if (!want2) continue;
    if (secText.indexOf(want2.toLowerCase()) < 0) {
      // ⚠️ Idézőjel NÉLKÜL: a beágyazott template-literálban az escape-elt " kétszer is
      // szintaxis-hibát okozott ebben a fájlban. A lelet így is egyértelmű.
      bad("hianyzo-vagy-mas-ar-sor", "szoba #" + pi + " várt ár-sor: " + want2);
    }
  }
  if (cfg.forbiddenPrice && secText.indexOf(cfg.forbiddenPrice.toLowerCase()) >= 0) {
    bad("sav-alaku-ar-a-kartyan", cfg.forbiddenPrice);
  }

  // ── ② A FELUGRÓ ────────────────────────────────────────────────────────────
  window.__citOpen = function (i) {
    var t = sec.querySelector('.cit-room__open[data-cit-room="' + i + '"]');
    if (!t) return false;
    t.scrollIntoView({ block: "center", behavior: "instant" });
    t.click();
    return true;
  };
  return out;
})`;

/** A megnyitott felugró mérése — külön lépés, mert a kattintás után kell futnia. */
const PROBE_RD = `(function (want) {
  var out = { findings: [] };
  function bad(k, d) { out.findings.push({ kind: k, detail: d }); }
  function painted(el) {
    if (!el) return null;
    var cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) return null;
    var r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return null;
    return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
  }
  function box(el) { var p = painted(el); return p ? [Math.round(p.l), Math.round(p.t), Math.round(p.w), Math.round(p.h)] : null; }
  function seen(el, host) {
    var p = painted(el);
    if (!p) return false;
    if (p.t < 0 || p.b > window.innerHeight) return false;
    if (host) { var hb = host.getBoundingClientRect(); if (p.t < hb.top - 0.5 || p.b > hb.bottom + 0.5) return false; }
    var hit = document.elementFromPoint(Math.round(p.l + p.w / 2), Math.round(p.t + p.h / 2));
    return !!(hit && (el === hit || el.contains(hit) || hit.contains(el)));
  }

  var rd = document.querySelector(".cit-rd[data-open]");
  if (!rd) return { findings: [{ kind: "a-felugro-nem-nyilt-meg", detail: want.name }] };
  var panel = rd.querySelector(".cit-rd__panel");
  if (!painted(panel)) return { findings: [{ kind: "a-panel-nincs-kifestve", detail: want.name }] };

  // ⛔ A FELUGRÓ A KÉPERNYŐT FEDI. Mérve az aurora sablonon: a glass-trükkje
  // (body>* {position:relative}) leütötte a fixed pozíciót, és a „felugró" 4029px-re
  // lent, a dokumentum közepén nyílt ki — a vendég kattintott, és nem történt semmi.
  // A dobozt a NÉZŐABLAKHOZ mérjük, nem ahhoz, hogy létezik-e.
  var rb = rd.getBoundingClientRect();
  if (rb.top > 1 || rb.left > 1 || rb.height < window.innerHeight - 1 || rb.width < window.innerWidth - 1) {
    bad("a-felugro-nem-fedi-a-kepernyot",
      "doboz=" + JSON.stringify([Math.round(rb.left), Math.round(rb.top), Math.round(rb.width), Math.round(rb.height)]) +
      " nézőablak=[" + window.innerWidth + "," + window.innerHeight + "]");
  }

  // ⚠️ KISBETŰSÍTVE hasonlítunk: az innerText a MEGJELENÍTETT szöveget adja, és több
  // sablon csupa nagybetűre állítja a szoba-nevet (text-transform). A nyers illesztés a
  // brutalism és a parallax lapján HÁROM hamis leletet gyártott egy hibátlan felugróra.
  var txt = (panel.innerText || "").replace(/\\s+/g, " ").toLowerCase();
  function has(s) { return txt.indexOf(String(s).toLowerCase()) >= 0; }
  if (!has(want.name)) bad("nincs-benne-a-szoba-neve", want.name);
  if (want.cap && !has(want.cap)) bad("nincs-benne-a-ferohely", want.cap);
  if (want.desc && !has(want.desc.slice(0, 24))) bad("nincs-benne-a-leiras", want.name);

  // ⛔ EGY képnél NINCS halott vezérlő. Mérve KIFESTVE — a [hidden] önmagában kevés.
  var nav = panel.querySelectorAll(".cit-rd__nav");
  var thumbs = panel.querySelector(".cit-rd__thumbs");
  var count = panel.querySelector(".cit-rd__count");
  var live = 0;
  for (var i = 0; i < nav.length; i++) if (painted(nav[i])) live++;
  if (want.photos < 2) {
    if (live) bad("halott-lepteto-nyil-egy-kepnel", live + " nyíl kifestve");
    if (painted(thumbs)) bad("halott-indexkep-sav-egy-kepnel", "kifestett doboz=" + JSON.stringify(box(thumbs)));
    if (painted(count)) bad("halott-kepszamlalo-egy-kepnel", (count.textContent || "").trim());
  } else {
    if (live < 2) bad("hianyzo-lepteto-nyil", live + " nyíl kifestve " + want.photos + " képnél");
    var tp = painted(thumbs);
    if (!tp) bad("nincs-indexkep-sav", want.photos + " kép van");
    else {
      // ⛔ ③ A magasság a STAGE-en ül. Ha a burkolón ülne, a sáv a panel ALÁ esne — a
      // kért galéria ilyenkor NEM LÉTEZIK, hiába van a DOM-ban.
      var pb = panel.getBoundingClientRect();
      if (tp.b > pb.bottom + 1) bad("az-indexkep-sav-levagodott", "sáv alja=" + Math.round(tp.b) + " panel alja=" + Math.round(pb.bottom));
      // ⛔ ÉS a SAJÁT burkolóján belül is: ha a magasság a burkolóra kerül, a sáv a
      // gal-dobozon LÓG TÚL és levágódik — a panelhez képest még bőven „belül" lehet.
      // Az első változatom emiatt asztalin ZÖLD maradt a visszarontott kódon.
      var gb = panel.querySelector(".cit-rd__gal").getBoundingClientRect();
      if (tp.b > gb.bottom + 1) bad("az-indexkep-sav-kilog-a-galeriabol", "sáv alja=" + Math.round(tp.b) + " galéria alja=" + Math.round(gb.bottom));
      var btns = thumbs.querySelectorAll("button");
      if (btns.length !== want.photos) bad("rossz-indexkep-darabszam", btns.length + " / " + want.photos);
      if (!seen(btns[0], thumbs)) bad("az-indexkep-nem-lathato", "az első indexkép nincs a vendég előtt");
    }
    if (!painted(count)) bad("nincs-kepszamlalo", want.photos + " kép van");
  }

  // ⛔ ADR-0181: nincs alcím tétel nélkül; üres egységnél ŐSZINTE mondat.
  var head = panel.querySelector(".cit-rd__h4");
  var list = panel.querySelector(".cit-rd__am");
  var empty = panel.querySelector(".cit-rd__empty");
  if (want.amenities === 0) {
    if (painted(head) || painted(list)) bad("alcim-tetel-nelkul", "üres egységnél kifestett felszereltség-blokk");
    if (!want.desc && !painted(empty)) bad("nincs-oszinte-mondat", "se leírás, se felszereltség, és nincs mondat sem");
    if (!want.desc && painted(empty) && (empty.textContent || "").indexOf(want.emptySentence) < 0) {
      bad("mas-az-oszinte-mondat", (empty.textContent || "").trim().slice(0, 60));
    }
  } else {
    if (!painted(head)) bad("nincs-felszereltseg-alcim", want.amenities + " tétel van");
    if ((head.textContent || "").indexOf(want.heading) < 0) bad("mas-a-felszereltseg-alcim", (head.textContent || "").trim());
    var lis = list ? list.querySelectorAll("li") : [];
    if (lis.length !== want.amenities) bad("rossz-felszereltseg-darabszam", lis.length + " / " + want.amenities);
    if (lis.length && !lis[0].querySelector("svg")) bad("nincs-ikon-a-felszereltsegen", "a katalógus-resolver nem adott ikont");
    // ⛔⛔ A DOM NEM A KÉPERNYŐ. Egyszer 9-et jelentett a mérés, miközben a vendég
    // NULLÁT látott: a lista a hajtás alá esett. Itt KIFESTVE, a panel látható sávján
    // belül, hit-teszttel számolunk.
    var visible = 0;
    for (var k = 0; k < lis.length; k++) if (seen(lis[k], panel)) visible++;
    var need = Math.min(want.amenities, want.minVisible);
    if (visible < need) {
      bad("gorgetes-nelkul-keves-felszereltseg-latszik", visible + " / " + lis.length +
        " (elvárt legalább " + need + ") — a lista a hajtás alá esik");
    }
    out.visibleAmenities = visible;
  }

  // ⛔ A DÁTUM-MONDAT CSAK PADLÓ-ÁRNÁL. Egy árnál ott hazugság volna („a pontos ár a
  // dátumoktól függ", miközben egyetlen ár van), üres egységnél pedig semmire nem mutat.
  var noteShown = txt.indexOf(want.dateNote.toLowerCase()) >= 0;
  if (want.priceFrom && !noteShown) bad("nincs-datum-mondat-padlo-arnal", want.name);
  if (!want.priceFrom && noteShown) bad("datum-mondat-egy-arnal", want.name);

  // A „Foglalás" mindig ott van, és a vendég előtt.
  var cta = panel.querySelector(".cit-rd__cta a");
  if (!seen(cta, panel)) bad("nincs-lathato-foglalas-gomb", box(cta) ? "kifestve, de nem látható" : "nincs kifestve");
  // ⛔⛔ ÉS VISZI A SZOBÁT. Ez az OUTCOME-állítás: a vendég ezen az úton is eljut a
  // foglaláshoz, és a foglalás arról az egységről fog szólni, amelyiket megnyitotta.
  // A szikár sablonokon ez az EGYETLEN út, tehát itt nem lehet kivétel.
  if (cta && want.unitId && cta.getAttribute("data-cit-room-unit") !== want.unitId) {
    bad("a-felugro-foglalasa-nem-viszi-a-szobat",
      want.name + ": " + (cta.getAttribute("data-cit-room-unit") || "semmit"));
  }
  // ⛔ ÉS LÉTEZŐ horgonyra mutat: a szerver #cit-enquiry→#cit-booking átírása csak a
  // SZERVER-oldali markupot éri el, ez a gomb viszont itt születik.
  var href = cta ? cta.getAttribute("href") : null;
  if (href && !document.querySelector(href)) bad("a-felugro-foglalasa-a-semmibe-mutat", href);
  out.ok = true;
  return out;
})`;

interface Finding { kind: string; detail: string }

interface Expect {
  idx: number; name: string; cap: string; desc: string; photos: number; amenities: number;
  minVisible: number; priceFrom: boolean; unitId: string;
}

function expectations(minVisible: number): Expect[] {
  return [
    { idx: 0, name: "Teljes Szállás", cap: "12 fő", desc: DESC_MANY, photos: 4, amenities: 9, minVisible, priceFrom: true, unitId: "u-teljes" },
    { idx: 1, name: "Kerti Appartman", cap: "4 fő", desc: DESC_ONE, photos: 1, amenities: 2, minVisible, priceFrom: false, unitId: "u-kerti" },
    { idx: 2, name: "Tetőtéri Appartman", cap: "6 fő", desc: "", photos: 1, amenities: 0, minVisible, priceFrom: false, unitId: "u-teto" },
  ];
}

/** A kontraktus §2: görgetés nélkül legalább 6 tétel; asztalin MIND a 9. */
function minVisibleFor(width: number): number {
  return width >= 900 ? 9 : 6;
}

async function measure(page: Page, url: string, width: number) {
  const errs: string[] = [];
  const onErr = (e: Error) => errs.push(String(e));
  const onConsole = (m: { type: () => string; text: () => string }) => {
    if (m.type() !== "error") return;
    // ⛔ NE a SAJÁT mérőeszközöm gyártson bukást: a lenti page.route MINDEN külső kérést
    // megszakít (betűkészlet), és a böngésző ezt console-hibaként naplózza. Az első
    // futáson pontosan ez adott 2 „js-hiba" leletet egy hibátlan lapon — a beszámoló
    // fele a mérés mellékterméke lett volna. A VALÓDI kivételeket a pageerror hozza.
    if (/net::ERR_FAILED|Failed to load resource/i.test(m.text())) return;
    // ⚠️ A foglaltság-lekérés `file://`-ról CORS-hibát ad — a MÉRÉS környezete okozza,
    // nem a termék. A runtime ezt szándékosan lenyeli („Availability unreachable: do NOT
    // block the guest"), tehát a vendég ebből semmit nem lát. A szűrés SZŰK: csak a
    // foglaltság-végpontra szól, hogy egy valódi CORS-hiba máshol ne csússzon át.
    if (/foglaltsag/.test(m.text()) && /CORS|Cross origin/i.test(m.text())) return;
    errs.push(m.text());
  };
  page.on("pageerror", onErr);
  page.on("console", onConsole);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  // A runtime a DOMContentLoaded-en hidratál, a MINTA-jelölést utána rajzolja. Ha a
  // mérés előbb zárulna, a hiba KELETKEZÉSE ELŐTT mérnénk és zöldet hazudnánk.
  await page.waitForTimeout(650);

  const hintByIndex: Record<string, string> = {};
  const hrefByIndex: Record<string, string> = {};
  ROOMS.forEach((r, i) => {
    const n = r.photos?.length ?? (r.photo ? 1 : 0);
    if (n) hintByIndex[String(i)] = n > 1 ? `${n} kép` : "Részletek";
    if (r.slug) hrefByIndex[String(i)] = `/apartman/${r.slug}`;
  });
  const forbiddenOnCard = [DESC_MANY, DESC_ONE, ...NINE.map((a) => a.label)];
  const unitByIndex: Record<string, string> = {};
  ROOMS.forEach((r, i) => { if (r.unitId) unitByIndex[String(i)] = r.unitId; });
  const priceByIndex = ROOMS.map((r) => r.price ?? "");

  const card = (await page.evaluate(
    `${PROBE}(${JSON.stringify({
      names: ROOMS.map((r) => r.name), hintByIndex, hrefByIndex, forbiddenOnCard,
      unitByIndex, priceByIndex,
      // ⛔ A SÁV-alak tilos: ez az a forma, amit a „-tól" leváltott.
      forbiddenPrice: "24 000–32 000",
      // Minden sablon szoba-kártyáján KELL lennie foglalás-gombnak — a hét tartalékos
      // sablonon 2026-09-22-ig NULLA volt, vagyis ott a folyamat nem is létezett.
      expectCta: true,
    })})`,
  )) as { fatal: string | null; findings: Finding[]; shells: number; cards: number };

  const findings: Finding[] = [...card.findings];
  if (!card.fatal) {
    for (const want of expectations(minVisibleFor(width))) {
      const opened = await page.evaluate(`window.__citOpen(${want.idx})`);
      if (!opened) { findings.push({ kind: "nincs-nyito-vezerlo", detail: want.name }); continue; }
      await page.waitForTimeout(220);
      const res = (await page.evaluate(
        `${PROBE_RD}(${JSON.stringify({ ...want, emptySentence: EMPTY_SENTENCE, heading: AM_HEADING, dateNote: DATE_NOTE })})`,
      )) as { findings: Finding[] };
      findings.push(...res.findings);

      // ── A RÉTEGZETT ESC (kontraktus §2) — csak a több-fotós egységen értelmes ──
      if (want.photos > 1) {
        await page.evaluate(`document.querySelector(".cit-rd__stage").click()`);
        await page.waitForTimeout(200);
        const lbUp = await page.evaluate(`!!document.querySelector(".cit-lb[data-open]")`);
        if (!lbUp) findings.push({ kind: "a-teljes-meretu-nezet-nem-nyilt-meg", detail: want.name });
        else {
          await page.keyboard.press("Escape");
          await page.waitForTimeout(180);
          const st = (await page.evaluate(
            `({lb: !!document.querySelector(".cit-lb[data-open]"), rd: !!document.querySelector(".cit-rd[data-open]")})`,
          )) as { lb: boolean; rd: boolean };
          // ⛔ AZ ESC EGY RÉTEGET HÁMOZ: előbb a nagykép, a felugró NYITVA MARAD.
          if (st.lb) findings.push({ kind: "az-esc-nem-zarta-a-nagykepet", detail: want.name });
          if (!st.rd) findings.push({ kind: "az-esc-ket-reteget-hamozott", detail: want.name });
        }
      }
      await page.keyboard.press("Escape");
      await page.waitForTimeout(180);
      const closed = (await page.evaluate(
        `({rd: !!document.querySelector(".cit-rd[data-open]"),` +
        ` focus: document.activeElement && document.activeElement.getAttribute("data-cit-room")})`,
      )) as { rd: boolean; focus: string | null };
      if (closed.rd) findings.push({ kind: "az-esc-nem-zarta-a-felugrot", detail: want.name });
      // ⛔ A fókusz arra a kártyára tér vissza, amelyikről nyílt.
      if (closed.focus !== String(want.idx)) {
        findings.push({ kind: "a-fokusz-nem-tert-vissza", detail: `${want.name}: ${closed.focus ?? "sehova"}` });
      }
    }
  }

  page.off("pageerror", onErr);
  page.off("console", onConsole);
  // ⛔ KÖT: nulla JS-hiba. Egy néma kivétel pont a felugró felét ölné meg.
  for (const e of errs.slice(0, 2)) findings.push({ kind: "js-hiba", detail: e.slice(0, 140) });
  return { fatal: card.fatal, findings, shells: card.shells, cards: card.cards };
}

// ── visszarontások a negatív öntesztre ──────────────────────────────────────────
// Mindegyik EGY kimondott állítást céloz meg, és mindegyikhez tartozik kontroll:
// az a szélesség/ág, ahol a hiba szerkezetileg nem jöhet elő, MARADJON zöld.
const REVERTS = [
  {
    key: "a horgony eltüntetése",
    why: "a kártya megvan, csak a data-cit-room nincs rajta — egy új sablon pontosan így nézne ki",
    apply: (html: string) =>
      html.replace(/ data-cit-room="\d+"/g, "").replace(/cit-room__open/g, "cit-room__WAS"),
  },
  {
    key: "display:flex a [hidden] indexkép-sávon",
    why: "a bejelentett ① csapda: a sáv kifestődik, miközben el.hidden === true",
    apply: (html: string) =>
      html.replace(
        "</head>",
        `<style data-cit-selftest>.cit-rd__thumbs[hidden],.cit-rd__nav[hidden],` +
        `.cit-rd__count[hidden]{display:flex!important}</style></head>`,
      ),
  },
  {
    key: "magasság a galéria BURKOLÓJÁN",
    why: "a bejelentett ③ csapda: a 68px-es indexkép-sáv teljesen levágódik",
    // 120px, nem 260: asztalin a galéria amúgy is ~265px, tehát a 260-as visszarontás
    // csak 5px-et vágott le, és a kapu jogosan maradt zöld. A visszarontásnak a HIBÁT
    // kell előállítania, nem egy határesetet.
    apply: (html: string) =>
      html.replace(
        "</head>",
        `<style data-cit-selftest>.cit-rd__gal{height:120px!important;overflow:hidden!important}` +
        `</style></head>`,
      ),
  },
  {
    key: "a felszereltség a hajtás alá tolva",
    why: "a bejelentett ② csapda: a <li>-k megvannak, a vendég nullát lát",
    apply: (html: string) =>
      html.replace(
        "</head>",
        `<style data-cit-selftest>.cit-rd__desc{margin-top:900px!important}</style></head>`,
      ),
  },
  {
    key: "a leírás visszatolva a kártyára",
    why: "a kontraktus §1 tiltása: a kártyán nincs leírás és felszereltség",
    // ⚠️ AZ ELSŐ VÁLTOZATOM NEM MÉRT SEMMIT: `.cit-rmore{display:block}`-kal próbálta
    // visszahozni a szöveget, de a runtime a <details>-t KIVESZI a DOM-ból — a CSS-nek
    // már nincs mit megmutatnia, tehát a kapu zölden állt egy „visszarontott" lapon.
    // A hibát ott kell előállítani, ahol a valóságban keletkezne: a kártya SZÖVEGÉBEN,
    // pontosan abban az összefűzött alakban, amit a kontraktus kivált.
    apply: (html: string) =>
      html.replace(
        "</body>",
        `<script data-cit-selftest>window.addEventListener("load",function(){` +
        `var m=${JSON.stringify(Object.fromEntries(
          ROOMS.map((r) => [
            r.name,
            [r.description, (r.amenities ?? []).map((a) => a.label).join(" · ")]
              .filter(Boolean).join(" · "),
          ]).filter(([, v]) => v),
        ))};` +
        `document.querySelectorAll(".cit-room__open[data-cit-room]").forEach(function(sh){` +
        `var n=sh.getAttribute("data-cit-room-name");if(!m[n])return;` +
        `var p=document.createElement("p");p.textContent=m[n];` +
        `(sh.parentElement||sh).appendChild(p);});});</script></body>`,
      ),
  },
  {
    key: "a leugrás elfelejti a szobát",
    why: "a 2026-09-22-i bejelentett hiba: a gomb odaugrik, de a választót az 1. egységen hagyja",
    apply: (html: string) =>
      html.replace(
        "</body>",
        `<script data-cit-selftest>window.addEventListener("load",function(){` +
        `document.querySelectorAll("[data-cit-room-unit]").forEach(function(e){` +
        `e.removeAttribute("data-cit-room-unit");});});</script></body>`,
      ),
  },
  {
    key: "a sáv-alakú ár visszatérése",
    why: "a kártya megint két számot ír oda, ahol a vendég egyet keres, padló-jelzés nélkül",
    apply: (html: string) =>
      html.replaceAll("24 000 Ft-tól / éj", "24 000–32 000 Ft / éj"),
  },
  {
    key: "a dátum-mondat egy árnál is megjelenik",
    why: "a mondat ott hazugság: egyetlen ár van, nincs mit a dátumtól függővé tenni",
    // ⚠️ A HTML-BE írjuk, nem futásidőben. Az első változatom `load`-ra futó szkript volt,
    // de a runtime a `<details>`-t MÁR a DOMContentLoaded-en kiveszi — mire a szkript
    // elindult, nem volt mit elrontania, és a kapu 0/4 pirossal „bizonyított". Ez már a
    // MÁSODIK visszarontásom, ami egy megszűnt mechanizmusra célzott.
    apply: (html: string) =>
      html.replace(
        /(data-cit-roomdata="1">[\s\S]*?<div class="cit-rmore__in">)/,
        `$1<p class="cit-rmore__pricenote">${DATE_NOTE}</p>`,
      ),
  },
  {
    key: "a felugró fixed pozíciójának leütése",
    why: "az aurora-osztályú hiba: a sablon body>* szabálya a dokumentumba ejti az overlayt",
    // ⚠️ `body>*` ÖNMAGÁBAN NEM ELÉG: a javítás `!important`, és (0,1,0)-val veri a
    // (0,0,1)-es `body>*`-ot — az első visszarontásom ezért ZÖLDEN hagyta a kaput, és
    // az állítás bizonyítatlan maradt volna. A `:not()` egy osztállyal (0,1,1) fölé
    // viszi: pontosan az a fegyverkezési verseny, ami miatt a javítás !important lett.
    apply: (html: string) =>
      html.replace(
        "</head>",
        `<style data-cit-selftest>body>*:not(#nincsilyen){position:relative!important;` +
        `inset:auto!important}</style></head>`,
      ),
  },
  {
    key: "az ESC két réteget hámoz",
    why: "a kontraktus §2: az első ESC csak a nagyképet zárja",
    apply: (html: string) =>
      html.replace(
        "</body>",
        `<script data-cit-selftest>document.addEventListener("keydown",function(e){` +
        `if(e.key==="Escape"){var r=document.querySelector(".cit-rd[data-open]");` +
        `if(r)r.removeAttribute("data-open");}},true);</script></body>`,
      ),
  },
];

interface Stats { failures: number; total: number; shells: number; cards: number; perWidth: Map<string, number> }

async function runMatrix(
  ids: string[],
  wreck: ((html: string) => string) | null,
  verbose: boolean,
): Promise<Stats> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "cit-roomdet-"));
  const d = siteData();
  const pages: { file: string; id: string }[] = [];
  for (const id of ids) {
    const tpl = TEMPLATES[id]!;
    const recipe: Recipe = {
      template: id, skin: tpl.skins[0] ?? "editorial-warm", archetype: "stacked", sections: [],
    };
    // ⚠️ A KISZÁLLÍTOTT lapot mérjük: a felugró a runtime-ból születik, ezért
    // injectRuntime nélkül a mérés a termék felét nem is látná.
    const rendered = await injectRuntime(renderSite(recipe, d, { phase: "live" }));
    const file = path.join(dir, `${id}.html`);
    await writeFile(file, wreck ? wreck(rendered) : rendered, "utf8");
    pages.push({ file, id });
  }

  const browser = await chromium.launch({ executablePath: config.chromiumPath });
  const stats: Stats = { failures: 0, total: pages.length * WIDTHS.length, shells: 0, cards: 0, perWidth: new Map() };
  for (const vp of WIDTHS) {
    stats.perWidth.set(vp.label, 0);
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
    // Külső hálózat kizárva: a betűkészlet-kérés nem lassíthatja a mérést, és a
    // párhuzamos szálak DNS-szerencséje nem befolyásolhatja az eredményt.
    await page.route("**/*", (route) => {
      const u = route.request().url();
      return u.startsWith("file:") || u.startsWith("data:") ? route.continue() : route.abort();
    });
    for (const p of pages) {
      const res = await measure(page, `file://${p.file}`, vp.w);
      const head = `${p.id.padEnd(15)} ${vp.label.padEnd(15)}`;
      if (res.fatal) {
        stats.failures++;
        stats.perWidth.set(vp.label, stats.perWidth.get(vp.label)! + 1);
        console.error(`  ✗ ${head} ⛔ ${res.fatal}`);
        continue;
      }
      stats.shells += res.shells;
      stats.cards += res.cards;
      if (res.findings.length) {
        stats.failures++;
        stats.perWidth.set(vp.label, stats.perWidth.get(vp.label)! + 1);
        const shown = res.findings.slice(0, 3).map((f) => `${f.kind}: ${f.detail}`).join(" · ");
        console.error(`  ✗ ${head} ${res.findings.length} lelet · ${shown}`);
      } else if (verbose) {
        console.log(`  ✓ ${head} ${res.cards} kártya · ${res.shells} horgony — a kontraktus áll`);
      }
    }
    await page.close();
  }
  await browser.close();
  if (KEEP) console.log(`\n  (a renderelt lapok maradtak: ${dir})`);
  else await rm(dir, { recursive: true, force: true });
  return stats;
}

async function main(): Promise<void> {
  const ids = ONLY.length ? ONLY : Object.keys(TEMPLATES);
  const unknown = ids.filter((id) => !TEMPLATES[id]);
  if (unknown.length) {
    console.error(`❌ ismeretlen sablon: ${unknown.join(", ")}`);
    process.exit(1);
  }

  if (SELFTEST) {
    // A kontroll: a visszarontás NÉLKÜLI futásnak zöldnek kell lennie. Enélkül a piros
    // semmit nem bizonyít — attól is pirosra mehetne, hogy a fixture maga rossz.
    console.log("\n── kontroll: visszarontás nélkül ──");
    const base = await runMatrix(ids, null, false);
    if (base.failures) {
      console.error(
        `\n⛔ ÖNTESZT BUKOTT a kontrollon: ${base.failures}/${base.total} mérés piros MÁR a ` +
        `visszarontás előtt. Amíg ez nem zöld, a negatív ág nem bizonyít semmit.`,
      );
      process.exit(1);
    }
    console.log(`  ✓ ${base.total} mérés zöld (${base.cards} kártya, ${base.shells} horgony)`);

    let bad = 0;
    for (const rv of REVERTS) {
      const st = await runMatrix(ids, rv.apply, false);
      const ok = st.failures === st.total; // MINDEN mérésnek pirosra kell mennie
      if (!ok) bad++;
      console.log(
        `  ${ok ? "✓" : "✗"} ${rv.key.padEnd(38)} ${st.failures}/${st.total} piros — ${rv.why}`,
      );
    }
    if (bad) {
      console.error(
        `\n⛔ ÖNTESZT BUKOTT: ${bad} visszarontás NEM vitte pirosra a kaput. Az az állítás ` +
        `nincs megmérve — egy őr, amit sosem láttunk pirosnak, nem őr.`,
      );
      process.exit(1);
    }
    console.log(
      `\n✅ önteszt: a kontroll zöld, és mind a ${REVERTS.length} visszarontás pirosra viszi a kaput.`,
    );
    return;
  }

  const st = await runMatrix(ids, null, true);
  if (st.failures) {
    console.error(
      `\n⛔ room-details-check: ${st.failures}/${st.total} mérés bukott (${ids.length} sablon × ` +
      `${WIDTHS.length} szélesség).\n` +
      `   A kontraktus: assets/design-refs/tenant-site/rooms-card/README.md — ez a felület ` +
      `megy a leadnek ÉS a fizető ügyfélnek.`,
    );
    process.exit(1);
  }
  console.log(
    `\n✅ room-details-check: ${st.total} mérés · ${st.cards} kártya · ${st.shells} horgony — ` +
    `a szoba-kártya és a részletek-felugró teljesíti a jóváhagyott B terv KÖT pontjait.`,
  );
}

await main();
