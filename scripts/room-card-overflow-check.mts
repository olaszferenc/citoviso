// ⭐⭐ ŐR: a szoba-kártya KÉPE maradjon a kártyán belül, és NE takarja a szöveget.
//
// A BEJELENTÉS (Elek FK-004b H-2 a lead szemével, FK-005a H-3 a vásárló szemével,
// 2026-09-13): „a »Szobák, apartmanok« kártyákon a képek kilógnak a kártyából és
// RÁTAKARJÁK a szöveget" — a középső kártyán a mondatból csak az „M" és a „k."
// látszott. Nem csak a mockon: a FIZETŐ ügyfél élő oldalán is.
//
// AMIT A MÉRÉS TALÁLT: a törött-kép kitöltő (render.ts IMG_FALLBACK_JS) a halott
// `<img>`-t egy `position:absolute;inset:0;min-height:150px` panelre CSERÉLTE, és a
// panelt az IMG SZÜLŐJÉBE tette. A megosztott szoba-kártyán (`li.cit-modsec__item`)
// a szülő maga A KÁRTYA, nem egy kép-keret: a panel ezért ráült a szoba nevére és a
// leírására, a 150px-es padló pedig kilógatta a 110px-es kártyából. (Ugyanaz a
// hibaosztály, amit a MINTAKÉP-szalagnál a `.cit-wmwrap` szoros burok már egyszer
// megoldott — a kitöltő nem tanult belőle.) A portál-fotó URL-ek RENDSZERESEN
// elrohadnak, tehát ez nem szélső eset.
//
// MIÉRT A RENDERELT LAPON MÉR: a CSS-forrásból nézve minden szabály helyesnek
// látszott — a hiba futásidőben, JS-ből keletkezett. A ház mért szabálya:
// a DOM zöld lehet, miközben a pixel nulla → `elementFromPoint` a döntőbíró.
//
// MIT MÉR (kártyánként, 390px-en ÉS asztali szélességen, MIND a 19 sablonon):
//   ① TAKARÁS — a kártya minden szöveg-SORÁT (Range-rect, nem elem-doboz) pontonként
//      hit-teszteli; ha a legfelső festett elem a kártya KÉPE (img / kitöltő panel /
//      MINTAKÉP-szalag), az bukás.
//   ② KILÓGÁS — a kártya doboza KÖRÜL mintavételez; ha odakint a kártya SAJÁT képe
//      a legfelső festett elem, akkor a kép kilóg (a mérés a levágást — overflow
//      hidden, clip — tiszteletben tartja, mert azt méri, ami LÁTSZIK).
//   ③ ÜRES SZÖVEG — a szoba nevének kell hogy legyen kiterített sora; ha egy
//      szöveg-csomópontnak nulla sor-doboza van, az is bukás (a takarás szélső esete).
//
// ⚠️ `pointer-events:none` vakfolt: a MINTAKÉP-szalag nem hit-tesztelhető, tehát
// takarhatna észrevétlenül. A mérés ezért a méréshez BEKAPCSOLJA a hit-tesztelést
// (`pointer-events:auto`) — ez a festési sorrenden nem változtat, csak láthatóvá
// teszi az `elementFromPoint` számára, ami a felhasználó szemének amúgy is takar.
//
//   npx tsx scripts/room-card-overflow-check.mts             — a kapu
//   npx tsx scripts/room-card-overflow-check.mts --selftest  — NEGATÍV önteszt
//   npx tsx scripts/room-card-overflow-check.mts --keep      — a renderelt HTML marad
//
// A NEGATÍV önteszt visszarontja a kitöltőt a bejelentett (abszolút-panel)
// viselkedésre, és ELVÁRJA, hogy a kapu pirosra menjen. Egy őr, ami nem tud
// pirosra menni, nem őr.

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { chromium, type Page } from "playwright-core";

import { config } from "../src/config.js";
import { injectRuntime } from "../src/generator/runtime.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import type { Recipe, RenderPhase, SiteData } from "../src/engine/recipe.js";

const KEEP = process.argv.includes("--keep");
const SELFTEST = process.argv.includes("--selftest");
const ONLY = process.argv.filter((a) => !a.startsWith("--")).slice(2);

/**
 * A NEGATÍV önteszt visszarontása: a törött-kép kitöltő HISTORIKUS változata, betűre
 * úgy, ahogy a bejelentett hibát okozta (abszolút panel az IMG SZÜLŐJÉBE, 150px-es
 * padlóval). A `--selftest` ezt írja vissza a renderelt lapokba, és ELVÁRJA, hogy a
 * kapu pirosra menjen. Ha ez a kód zöldet kapna, a kapu nem mérné azt, amiről szól.
 */
const BROKEN_FALLBACK_JS = `<script data-cit-imgfallback>(function(){
function f(img){if(img.getAttribute('data-cit-filled'))return;img.setAttribute('data-cit-filled','1');
var d=document.createElement('div');d.setAttribute('role','img');d.setAttribute('aria-label',img.alt||'');
d.style.cssText="position:absolute;inset:0;width:100%;height:100%;min-height:150px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:var(--cit-surface);color:var(--cit-ink)";
d.innerHTML='<svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="2"/></svg>';
var p=img.parentElement;if(p){if(getComputedStyle(p).position==='static')p.style.position='relative';p.replaceChild(d,img);}}
window.addEventListener('error',function(e){var t=e.target;if(t&&t.tagName==='IMG')f(t);},true);
document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('img').forEach(function(i){if(i.complete&&i.naturalWidth===0)f(i);});});
})();</script>`;

/** Az ÉLES kitöltő-szkript cseréje a visszarontott változatra. A horgony a
 *  `data-cit-imgfallback` jelölő — a mérés így pontosan azt az egy blokkot cseréli,
 *  nem „valami scriptet". Ha a jelölő eltűnik a termékből, ez hangosan bukik. */
function breakFallback(html: string, id: string): string {
  const re = /<script data-cit-imgfallback>[\s\S]*?<\/script>/;
  if (!re.test(html)) {
    throw new Error(
      `${id}: nincs <script data-cit-imgfallback> a renderelt lapon — az önteszt nem tudja ` +
        `visszarontani a kitöltőt, tehát a negatív ág NEM bizonyít semmit.`,
    );
  }
  return html.replace(re, BROKEN_FALLBACK_JS);
}

/**
 * A MÁSIK visszarontás: a MINTA-jelölés három javítása előtti állapot, mindhárom
 * egyszerre (mindegyik ÖNMAGÁBAN is elég volna a pirosra):
 *   ① a burok minden képnél `height:100%`-ot követelt → a szoba-kártyára feszült;
 *   ② a jelölés FIX sarokra ült, mérés nélkül → a sablon saját, képre írt címkéjére;
 *   ③ a burok a KÉPET a sablon címkéi fölé emelte (a kép takarta a fejezet-számot).
 * Felülíró stíluslapként megy vissza, nem szöveg-illesztéssel — így nem attól függ,
 * hogy a CSS forrásában éppen hol van egy szóköz.
 */
function breakWatermark(html: string): string {
  const css =
    `<style data-cit-selftest>` +
    `.cit-wmwrap{height:100%!important;z-index:5!important}` +
    `.cit-wm{top:8px!important;left:8px!important;right:auto!important;bottom:auto!important}` +
    `</style>`;
  return html.includes("</body>") ? html.replace("</body>", `${css}</body>`) : html + css;
}

/** A két negatív ág. Mindegyik SAJÁT kontrollt visz: az a forgatókönyv, amelyikben az
 *  adott hiba szerkezetileg nem jöhet elő, MARADJON zöld — különben nem azt mérnénk,
 *  hogy a kapu a HIBÁT fogja meg, csak azt, hogy valamitől pirosra ment. */
const REVERTS = [
  {
    key: "törött-kép kitöltő",
    apply: (html: string, id: string) => breakFallback(html, id),
    // A kitöltő csak halott fotónál fut.
    expectRed: (sc: (typeof SCENARIOS)[number]) => sc.photo === DEAD_PHOTO,
    why: "a kitöltő csak halott fotó mellett fut",
  },
  {
    key: "MINTA-jelölés",
    apply: (html: string) => breakWatermark(html),
    // A jelölés csak a MOCK-on létezik (az élő lapon nincs minta-fotó) — és ott a
    // működő fotónál is elrontja a kártyát, nem csak a halottnál.
    expectRed: (sc: (typeof SCENARIOS)[number]) => sc.phase === "mock",
    why: "a jelölés csak a mockon van",
  },
];

/** A 3:2 arányú, VALÓBAN betöltődő minta-kép (data URI — hálózat nélkül is él, így a
 *  mérés determinisztikus és a párhuzamos szálakat nem zavarja). */
const LIVE_PHOTO =
  "data:image/svg+xml;base64," +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="#8fa98c"/></svg>`,
  ).toString("base64");

/** Halott URL — a portál-fotók elrohadását utánozza (a böngészőben blokkolva is
 *  ugyanaz az `error` esemény keletkezik, mint egy 404-nél). */
const DEAD_PHOTO = "https://dead.invalid.citoviso.test/photo.jpg";

const ROOMS = [
  {
    name: "Kertre néző apartman",
    capacity: "2 fő · 26 m²",
    note: "Franciaágyas szoba, saját terasszal a kertre.",
    price: "24 000 Ft / éj",
  },
  {
    name: "Tetőtéri családi szoba",
    capacity: "4 fő · 34 m²",
    note: "Két hálótér, zuhanyzó, gyerekágy kérhető.",
    price: "32 000 Ft / éj",
  },
  {
    name: "Kisház a kert végében",
    capacity: "2 fő · 18 m²",
    note: "Külön bejárat, teakonyha, csendes sarok.",
    price: "21 000 Ft / éj",
  },
];

function siteData(photoUrl: string, withRooms: boolean): SiteData {
  const photos = Array.from({ length: 6 }, (_, i) => ({
    url: photoUrl,
    alt: `ELEK-TESZT Vendégház — ${i + 1}. kép`,
    provenance: "owner" as const,
  }));
  return {
    name: "ELEK-TESZT Vendégház",
    tagline: "Csend a Balatonnál",
    intro: "Kétszáz méterre a strandtól, saját kerttel és árnyas terasszal.",
    highlights: ["Saját parkoló", "Kutyabarát", "Kert"],
    photos,
    contact: { email: "info@example.invalid", phone: "+36 30 000 0000", address: "Fő utca 1." },
    place: { city: "Balatonboglár", country: "HU" },
    ...(withRooms
      ? { rooms: ROOMS.map((r) => ({ ...r, photo: { url: photoUrl, alt: r.name } })) }
      : {}),
  } as unknown as SiteData;
}

/**
 * A mért forgatókönyvek. A HALOTT fotó a bejelentett eset (a kitöltő fut), az ÉLŐ a
 * kontroll (a kitöltő nem fut) — utóbbi nélkül nem derülne ki, hogy a hiba a
 * kitöltőből jön-e vagy a kártya alap-elrendezéséből.
 */
const SCENARIOS = [
  { key: "mock-halott-fotó", phase: "mock" as RenderPhase, photo: DEAD_PHOTO, rooms: false },
  { key: "mock-élő-fotó", phase: "mock" as RenderPhase, photo: LIVE_PHOTO, rooms: false },
  { key: "élő-lap-halott-fotó", phase: "live" as RenderPhase, photo: DEAD_PHOTO, rooms: true },
];

const WIDTHS = [
  { w: 390, h: 1000, label: "mobil 390px" },
  { w: 1280, h: 1000, label: "asztali 1280px" },
];

/**
 * A mérés a lapon fut. STRING, mert a tsx/esbuild `keepNames`-e `__name(...)` hívást
 * injektálna a nyilazott függvényekbe, ami `page.evaluate`-ben `ReferenceError`.
 *
 * Bemenet: a szoba-nevek listája (a kártya azonosításához). Kimenet: leletek listája.
 */
const PROBE = `(function (roomNames) {
  var PHOTO_SEL = "img, picture, [data-cit-filled], [role='img'], .cit-fill, .cit-wm, .cit-wmclip, .cit-wmwrap";
  var findings = [];
  var washed = 0;
  var sec = document.querySelector('[data-cit-module="rooms"]');
  if (!sec) return { fatal: "nincs [data-cit-module=rooms] horgony a lapon", findings: findings, cards: 0 };

  // A MINTAKÉP-szalag pointer-events:none — a hit-teszt számára láthatatlan volna,
  // pedig a szemnek takar. A méréshez bekapcsoljuk; a festési sorrend nem változik.
  // ⛔ A sima görgetés (scroll-behavior:smooth — 13 sablon állítja) miatt a
  // scrollIntoView ANIMÁLT:
  // az első változatom emiatt a képernyőn KÍVÜL mért, a kívüli pontokat kihagyta, és
  // a kihagyást zöldnek olvasta — pontosan a bejelentett hibán mondott PASS-t.
  var st = document.createElement("style");
  st.textContent = "*{pointer-events:auto!important;scroll-behavior:auto!important}";
  document.head.appendChild(st);

  // ⚠️ A bekapcsolt hit-tesztelés ÖNMAGÁBAN hamis leletet gyárt: egy ÁTLÁTSZÓ, csak
  // vágásra való réteg (a jelölés levágó burka) így a legfelső „találat" lesz, pedig
  // egyetlen pixelt sem fest. A szabály nem az elem NEVÉHEZ kötődik, hanem ahhoz, hogy
  // mérhetően ÁTLÁTSZÓ-e: nincs saját háttere, háttérképe, kerete és saját szövege.
  // Ezeket visszakapcsoljuk átlátszóra, hogy a hit-teszt azt adja vissza, ami FEST.
  var seeThrough = 0;
  var all = sec.querySelectorAll("*");
  for (var ai = 0; ai < all.length; ai++) {
    var e2 = all[ai];
    var c2 = getComputedStyle(e2);
    var ownText = false;
    for (var ci = 0; ci < e2.childNodes.length; ci++) {
      var cn = e2.childNodes[ci];
      if (cn.nodeType === 3 && (cn.nodeValue || "").trim().length) ownText = true;
    }
    var bg = c2.backgroundColor || "";
    var transparentBg = bg === "transparent" || /rgba\\(\\s*0,\\s*0,\\s*0,\\s*0\\s*\\)/.test(bg);
    var noBorder = parseFloat(c2.borderTopWidth || "0") === 0 && parseFloat(c2.borderBottomWidth || "0") === 0 &&
      parseFloat(c2.borderLeftWidth || "0") === 0 && parseFloat(c2.borderRightWidth || "0") === 0;
    if (!ownText && transparentBg && c2.backgroundImage === "none" && noBorder && e2.tagName !== "IMG") {
      e2.style.setProperty("pointer-events", "none", "important");
      seeThrough++;
    }
  }

  function rect(e) { var r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }
  function box(e) { var r = rect(e); return [Math.round(r.l), Math.round(r.t), Math.round(r.w), Math.round(r.h)]; }

  // A KÁRTYA: a kép legszűkebb őse, ami a szoba szövegét is tartalmazza. Sablon-
  // agnosztikus — a táblázat-cellás és a rácsos kártyára egyaránt igaz.
  // ⚠️ KISBETŰSÍTVE hasonlítunk: az innerText a MEGJELENÍTETT szöveget adja, és több
  // sablon csupa nagybetűre állítja (text-transform) a szoba-nevet — a nyers illesztés
  // a transit sablonon NULLA kártyát talált (a sablon mérés nélkül maradt volna).
  var lcNames = [];
  for (var ni = 0; ni < roomNames.length; ni++) lcNames.push(roomNames[ni].toLowerCase());
  function cardOf(photo) {
    var el = photo.parentElement;
    while (el && el !== document.body) {
      var txt = (el.innerText || "").replace(/\\s+/g, " ").trim().toLowerCase();
      for (var i = 0; i < lcNames.length; i++) if (txt.indexOf(lcNames[i]) >= 0) return el;
      el = el.parentElement;
    }
    return null;
  }

  // A találat "kép"-e? A kép-őst a szekció gyökeréig keressük vissza — NEM a kártyáig.
  // ⛔ Az első változatom a kártyájára szűkített, és ezért ZÖLDEN VÉDTE a bejelentett
  // hibát: a kilógó panel a SZOMSZÉD kártya szövegére ült rá, tehát a takaró kép nem
  // annak a kártyának a gyereke volt, amelyiknek a szövegét elvette.
  function photoAncestor(hit, root) {
    var e = hit;
    while (e && e !== root && e !== document.body) {
      if (e.matches && e.matches(PHOTO_SEL)) return e;
      e = e.parentElement;
    }
    return null;
  }
  function isPhotoOf(hit, card) {
    if (!hit || !card.contains(hit)) return false;
    return !!photoAncestor(hit, card);
  }

  // Szöveg-SOROK: a Range client-rectjei a tényleges sor-dobozok (az elem doboza
  // ennél jóval nagyobb lehet, és üres területre is mutatna).
  function lineRects(node) {
    var rg = document.createRange();
    rg.selectNodeContents(node);
    var out = [];
    var rs = rg.getClientRects();
    for (var i = 0; i < rs.length; i++) if (rs[i].width > 2 && rs[i].height > 2) out.push(rs[i]);
    return out;
  }

  var photos = sec.querySelectorAll(PHOTO_SEL);
  var cards = [];
  for (var i = 0; i < photos.length; i++) {
    var p = photos[i];
    if (p.closest(".cit-wm")) continue;            // a szalag SZÖVEGE nem önálló kép
    var c = cardOf(p);
    if (c && cards.indexOf(c) < 0) cards.push(c);
  }

  for (var ci = 0; ci < cards.length; ci++) {
    var card = cards[ci];
    // Kézi, AZONNALI görgetés — a scrollIntoView animációja miatt a mért doboz a
    // görgetés BEFEJEZÉSE előtti állapotot adná vissza.
    // ⚠️ Két sablon (horizontal, tilted-gallery) VÍZSZINTESEN görgethető sávba teszi
    // a szoba-kártyákat: a lap görgetése önmagában nem hozza őket a képernyőre, és
    // az első változatom emiatt „nem mérhető"-t jelentett rájuk. A belső görgethető
    // ősöket is beállítjuk — ez ugyanaz a nézet, amit a látogató ujja előállít.
    var sc = card.parentElement;
    while (sc && sc !== document.body) {
      var scr = sc.getBoundingClientRect(), cb0 = card.getBoundingClientRect();
      if (sc.scrollWidth > sc.clientWidth + 4) sc.scrollLeft += (cb0.left + cb0.width / 2) - (scr.left + scr.width / 2);
      if (sc.scrollHeight > sc.clientHeight + 4) sc.scrollTop += (cb0.top + cb0.height / 2) - (scr.top + scr.height / 2);
      sc = sc.parentElement;
    }
    var abs = card.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, Math.max(0, Math.round(abs - window.innerHeight / 2 + card.getBoundingClientRect().height / 2)));
    var vw = window.innerWidth, vh = window.innerHeight;
    var cr = rect(card);
    var label = (card.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 40);

    // ── ① TAKARÁS + ③ ÜRES SZÖVEG ────────────────────────────────────────────
    var walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT, null);
    var tn;
    while ((tn = walker.nextNode())) {
      var raw = (tn.nodeValue || "").replace(/\\s+/g, " ").trim();
      if (raw.length < 2) continue;
      var owner = tn.parentElement;
      if (!owner || owner.closest(".cit-wm")) continue;   // a szalag saját felirata
      var cs = getComputedStyle(owner);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      var lines = lineRects(tn);
      if (!lines.length) {
        findings.push({ kind: "nincs-sor", card: label, box: box(card), text: raw.slice(0, 40) });
        continue;
      }
      for (var li = 0; li < lines.length; li++) {
        var ln = lines[li];
        for (var s = 0; s <= 4; s++) {
          var x = Math.round(ln.left + (ln.width * (s + 0.5)) / 5);
          var y = Math.round(ln.top + ln.height / 2);
          // ⛔ A képernyőn kívüli pont NEM „rendben" — a kihagyás bukás, különben a
          // mérés a saját vakfoltját olvasná zöldnek (ez már egyszer megtörtént).
          if (x < 1 || y < 1 || x > vw - 2 || y > vh - 2) {
            findings.push({ kind: "nem-mérhető-pont", card: label, text: raw.slice(0, 40), at: [x, y], cardBox: box(card) });
            s = 99; li = lines.length;
            continue;
          }
          var hit = document.elementFromPoint(x, y);
          var ph = hit ? photoAncestor(hit, sec) : null;
          // ⭐ NINCS TÖBBÉ KIVÉTEL A JELÖLÉSRE. Amíg a jelölés az EGÉSZ képre boruló
          // ÁTTETSZŐ fátyol volt, a rajta átlátszó felirat nem számított takarásnak — azt
          // a kaput egy kimondott, darabszámmal kiírt kivétel engedte át (60 eset). A
          // tulaj által jóváhagyott „C" terv viszont ÁTLÁTSZATLAN sarok-pirula: ami alatta
          // van, az eltűnik. A kivétel tehát megszűnt, és a jelölés ugyanolyan bukás, mint
          // bármelyik kép — a runtime ezért MÉRI, melyik sarok szabad.
          // A vizsgálat a TALÁLATRA megy, nem a kép-ősre: a kép-ős a burok (.cit-wmwrap)
          // volna, és a JELÖLÉS az, ami fölül van.
          var wmHit = hit && hit.closest ? hit.closest(".cit-wm") : null;
          if (wmHit) {
            findings.push({
              kind: "a-jelölés-takarja-a-szöveget", card: label, text: raw.slice(0, 40),
              at: [x, y], hit: "SPAN." + String(wmHit.className || ""), cardBox: box(card),
            });
            s = 99; li = lines.length;
            continue;
          }
          // Szándékos képre-írt felirat (kapacitás-jelvény a fotón) NEM takarás:
          // ott a szöveg a képen BELÜL van. Bukás az, ha a kép a szöveg FÖLÉ kerül.
          if (ph && !ph.contains(owner)) {
            findings.push({
              kind: "takarja-a-szöveget", card: label, text: raw.slice(0, 40),
              at: [x, y], hit: hit.tagName + "." + String(hit.className || "").slice(0, 24),
              cardBox: box(card),
            });
            s = 99; li = lines.length;                     // soronként egy lelet elég
          }
        }
      }
    }

    // ── ② KILÓGÁS ────────────────────────────────────────────────────────────
    var M = 60, STEP = 12, out = null, skipped = 0, probed = 0;
    for (var d = 2; d <= M && !out; d += STEP) {
      var probes = [];
      for (var t = 0; t <= 6; t++) {
        var px = Math.round(cr.l + (cr.w * t) / 6);
        probes.push([px, Math.round(cr.t - d)], [px, Math.round(cr.b + d)]);
      }
      for (var t2 = 0; t2 <= 6; t2++) {
        var py = Math.round(cr.t + (cr.h * t2) / 6);
        probes.push([Math.round(cr.l - d), py], [Math.round(cr.r + d), py]);
      }
      for (var pi = 0; pi < probes.length; pi++) {
        var qx = probes[pi][0], qy = probes[pi][1];
        // A kártyán KÍVÜLI mintavétel a képernyő szélén elfogyhat — ez itt nem
        // vakfolt, hanem a kártya-doboz széle; a mérést a szemközti oldal és a
        // többi távolság viszi tovább. Számoljuk, és a végén kimondjuk.
        if (qx < 1 || qy < 1 || qx > vw - 2 || qy > vh - 2) { skipped++; continue; }
        probed++;
        var h2 = document.elementFromPoint(qx, qy);
        if (isPhotoOf(h2, card)) {
          out = { kind: "kilóg-a-kártyából", card: label, at: [qx, qy], dist: d,
                  hit: h2.tagName + "." + String(h2.className || "").slice(0, 24),
                  cardBox: box(card), photoBox: box(h2) };
          break;
        }
      }
    }
    if (out) findings.push(out);
    // Ha a kártya körül EGYETLEN pontot sem tudtunk megmérni, a „nem lóg ki" állítás
    // fedezet nélküli — a kapu ezt sem nyelheti le.
    if (!out && probed === 0) {
      findings.push({ kind: "kilógás-nem-mérhető", card: label, cardBox: box(card), dist: skipped });
    }
  }

  st.remove();
  return { fatal: null, findings: findings, cards: cards.length, washed: washed };
})`;

interface Finding {
  kind: string;
  card?: string;
  text?: string;
  at?: number[];
  hit?: string;
  cardBox?: number[];
  photoBox?: number[];
  dist?: number;
}

async function measure(page: Page, url: string, roomNames: string[]) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  // A törött-kép kitöltő `error` eseményre és DOMContentLoaded-re is fut; a
  // MINTAKÉP-szalagot a modul-runtime rajzolja. Hagyunk időt MINDKETTŐNEK —
  // különben a mérés a hiba KELETKEZÉSE ELŐTT zárulna, és zöldet hazudna.
  await page.waitForTimeout(700);
  return (await page.evaluate(PROBE + `(${JSON.stringify(roomNames)})`)) as {
    fatal: string | null;
    findings: Finding[];
    cards: number;
    washed: number;
  };
}

interface RunStats {
  failures: number;
  total: number;
  measured: number;
  washed: number;
  perScenario: Map<string, { fail: number; total: number }>;
}

/** Egy teljes mátrix-kör: minden sablon × forgatókönyv × szélesség. A `wreck` a
 *  negatív ág visszarontása (null = az ÉLES kód mérése). */
async function runMatrix(
  ids: string[],
  wreck: ((html: string, id: string) => string) | null,
  verbose: boolean,
): Promise<RunStats> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "cit-roomcard-"));

  // Render: minden sablon × minden forgatókönyv. (A lapok önhordók — a runtime és a
  // CSS beágyazva —, ezért file://-ról mérhetők, és a KÖZÖS `sites/` érintetlen
  // marad: párhuzamos szálak nem írják egymás fixture-jét.)
  const pages: { file: string; id: string; scenario: string; roomNames: string[] }[] = [];
  for (const id of ids) {
    const tpl = TEMPLATES[id]!;
    for (const sc of SCENARIOS) {
      const d = siteData(sc.photo, sc.rooms);
      const recipe: Recipe = {
        template: id,
        skin: tpl.skins[0] ?? "editorial-warm",
        archetype: "stacked",
        sections: [],
      };
      // ⚠️ A KISZÁLLÍTOTT lapot mérjük, nem a nyers rendert: a MINTAKÉP-jelölést a
      // modul-runtime rajzolja (injectRuntime), és a bejelentett képen ÉPPEN az a
      // szalag fajult el vékony, ferde csíkká. Runtime nélkül a mérés a hiba felét
      // nem is látta volna.
      const rendered = await injectRuntime(renderSite(recipe, d, { phase: sc.phase }));
      const html = wreck ? wreck(rendered, id) : rendered;
      const file = path.join(dir, `${id}__${sc.key}.html`);
      await writeFile(file, html, "utf8");
      pages.push({
        file,
        id,
        scenario: sc.key,
        // A mock számozott MINTA-szobákat rendel; az élő lap a valódiakat.
        roomNames: sc.rooms ? ROOMS.map((r) => r.name) : ["1. szoba", "2. szoba", "3. szoba"],
      });
    }
  }

  const browser = await chromium.launch({ executablePath: config.chromiumPath });
  const stats: RunStats = {
    failures: 0,
    total: pages.length * WIDTHS.length,
    measured: 0,
    washed: 0,
    perScenario: new Map(SCENARIOS.map((sc) => [sc.key, { fail: 0, total: 0 }])),
  };
  const bump = (key: string, failed: boolean) => {
    const e = stats.perScenario.get(key)!;
    e.total++;
    if (failed) e.fail++;
  };

  for (const vp of WIDTHS) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
    // Külső hálózat KIZÁRVA: a betűkészlet-kérés nem lassíthatja a mérést, a
    // "halott fotó" pedig determinisztikusan halott (nem DNS-szerencse kérdése).
    await page.route("**/*", (route) => {
      const u = route.request().url();
      if (u.startsWith("file:") || u.startsWith("data:")) return route.continue();
      return route.abort();
    });
    for (const p of pages) {
      const res = await measure(page, `file://${p.file}`, p.roomNames);
      const head = `${p.id.padEnd(15)} ${p.scenario.padEnd(20)} ${vp.label.padEnd(15)}`;
      if (res.fatal || !res.cards) {
        stats.failures++;
        bump(p.scenario, true);
        const why = res.fatal ?? "nulla szoba-kártya — a szekció horgonya megvan, a kártya nincs";
        console.error(`  ✗ ${head} ⛔ ${why}`);
        continue;
      }
      stats.measured += res.cards;
      bump(p.scenario, res.findings.length > 0);
      if (res.findings.length) {
        stats.failures++;
        const f = res.findings[0]!;
        const detail =
          f.kind === "kilóg-a-kártyából"
            ? `kártya=${JSON.stringify(f.cardBox)} kép=${JSON.stringify(f.photoBox)} ${f.dist}px-re kívül (${f.hit})`
            : `„${f.text}" @${JSON.stringify(f.at)} takarja: ${f.hit}`;
        console.error(`  ✗ ${head} ${res.findings.length} lelet · ${f.kind}: ${detail}`);
      } else {
        stats.washed += res.washed;
        if (verbose) {
          console.log(
            `  ✓ ${head} ${res.cards} kártya rendben` +
              (res.washed ? ` (${res.washed} képre-írt felirat a vízjel fátyla alatt)` : ""),
          );
        }
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
    // ── NEGATÍV ÖNTESZT ──────────────────────────────────────────────────────
    // Mindkét javítást KÜLÖN rontjuk vissza, és mindegyiktől azt várjuk, hogy a
    // kapu pirosra megy OTT, ahol az adott hiba előjöhet — és zöld marad ott, ahol
    // szerkezetileg nem. A kontroll nélkül a piros önmagában semmit nem bizonyít.
    let bad = 0;
    for (const rv of REVERTS) {
      console.log(`\n── negatív önteszt: visszarontva a(z) ${rv.key} ──`);
      const st = await runMatrix(ids, rv.apply, false);
      for (const sc of SCENARIOS) {
        const e = st.perScenario.get(sc.key)!;
        const red = rv.expectRed(sc);
        const ok = red ? e.fail > 0 : e.fail === 0;
        if (!ok) bad++;
        console.log(
          `  ${ok ? "✓" : "✗"} ${sc.key.padEnd(20)} ${e.fail}/${e.total} piros — elvárás: ` +
            (red ? "legalább 1 piros (a hiba visszatér)" : `nulla piros (kontroll: ${rv.why})`),
        );
      }
    }
    if (bad) {
      console.error(
        `\n⛔ ÖNTESZT BUKOTT (${bad} elvárás nem teljesült): a kapu nem a HIBÁT méri. ` +
          `Egy őr, ami a saját hibáján nem megy pirosra, nem őr.`,
      );
      process.exit(1);
    }
    console.log(
      `\n✅ önteszt: mindkét visszarontás pirosra viszi a kaput ott, ahol a hiba előjöhet, ` +
        `és a saját kontroll-forgatókönyve közben végig zöld.`,
    );
    return;
  }

  const st = await runMatrix(ids, null, true);
  if (st.failures) {
    console.error(
      `\n⛔ room-card-overflow-check: ${st.failures}/${st.total} mérés bukott (${ids.length} sablon × ` +
        `${SCENARIOS.length} forgatókönyv × ${WIDTHS.length} szélesség).\n` +
        `   A szoba-kártya képe kilóg vagy takarja a szöveget — ez a leadnek ÉS a fizető ` +
        `ügyfélnek kiszállított felület.`,
    );
    process.exit(1);
  }
  console.log(
    `\n✅ room-card-overflow-check: ${st.total} mérés · ${st.measured} kártya — ` +
      `a kép sehol nem lóg ki a kártyájából és sehol nem takarja a szöveget.` +
      (st.washed
        ? `\n   (kimondott kivétel: ${st.washed} esetben a MINTAKÉP-vízjel fátyla a KÉPEN álló ` +
          `felirat fölött van — a vízjel az egész képet jelöli, és a képen kívülre már nem juthat.)`
        : ""),
  );
}

await main();
