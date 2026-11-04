// Portal-calendar tutorial in the booking module's „Hirdeti máshol is?” card: per portal a
// narrated video (Hungarian voice + captions) and the same steps as numbered screenshots with
// highlight boxes. Approved plan: assets/design-refs/console/portal-bemutato/ (owner, 2026-11-04).
// Assets: public/assets/help/portal-naptar/ — videos <portal>-<m|d>.webm, the tenant-admin shots
// <portal>-<m|d>-<shot>.webp (recorded from the real admin), portal shots <portal>-<name>.webp.
// The recorder that produces them: scripts/portal-guide/ (README there).

import { T } from "../i18n/mail.js";

/** Bump when any file under public/assets/help/portal-naptar/ changes (the CDN caches /assets). */
const GUIDE_V = "20261104";
const BASE = "/assets/help/portal-naptar/";

type GuideStep =
  | { side: "c"; img: string; text: string }
  | { side: "p"; img: string; src: string; text: string; foci: { box: number[]; text: string }[] };

interface GuidePortal {
  key: string;
  provider: string;
  steps: GuideStep[];
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function guidePortals(lang: string): GuidePortal[] {
  return [
    {
      key: "booking",
      provider: "Booking.com", // i18n-exempt: brand name
      steps: [
        { side: "c", img: "01-kartya", text: T(lang, "A Citoviso-adminban: Modulok › Online foglalás › „Hirdeti máshol is?” — itt a Booking.com kártyája. Minden szobát külön kell összekötni.") },
        { side: "c", img: "02-masolas", text: T(lang, "Először másolja ki a SAJÁT naptár-linkjét: a 2. lépésnél nyomja meg a „Másolás” gombot.") },
        {
          side: "p",
          img: "booking-01-menu-rates-availability-sync-calendars-appartman",
          src: T(lang, "appartman.hu súgó"),
          text: T(lang, "Most lépjen be a Booking.com extranetre (admin.booking.com)."),
          foci: [
            { box: [19.6, 10.5, 27.6, 13.5], text: T(lang, "Felül a menüsorban: „Árak és elérhetőség” (angolul: Rates & Availability). Kattintson rá.") },
            { box: [29.4, 48.6, 33.8, 5.8], text: T(lang, "A lenyíló listában: „naptár-szinkronizálás” (Sync calendars).") },
          ],
        },
        {
          side: "p",
          img: "booking-07-attekintes-add-calendar-connection-plum",
          src: T(lang, "Plum Guide súgó"),
          text: T(lang, "Megnyílik a naptár-szinkronizálás oldala. Itt minden szobának külön sora van."),
          foci: [
            { box: [17, 47.5, 16.1, 4.6], text: T(lang, "A szoba neve alatt: „Add calendar connection” (új naptárkapcsolat). Kattintson rá.") },
          ],
        },
        {
          side: "p",
          img: "booking-10-import-kitoltve-appartman",
          src: T(lang, "appartman.hu súgó"),
          text: T(lang, "1. lépés a Bookingon: Import calendar — ide jön a Citovisóból másolt link."),
          foci: [
            { box: [11, 47.2, 81.1, 6.2], text: T(lang, "Ebbe a mezőbe illessze be a Citovisóból másolt linket (jobb klikk › Beillesztés, vagy Ctrl+V).") },
            { box: [11, 60.9, 81.1, 6.5], text: T(lang, "Calendar name: adjon neki nevet, például „honlap”.") },
            { box: [11, 71.4, 12, 6.4], text: T(lang, "Majd „Next step” (következő lépés).") },
          ],
        },
        {
          side: "p",
          img: "booking-16-export-link-copy-link-plum",
          src: T(lang, "Plum Guide súgó"),
          text: T(lang, "2. lépés a Bookingon: Export calendar — a Booking megmutatja a SAJÁT naptár-linkjét."),
          foci: [
            { box: [19.6, 61, 51.8, 11.1], text: T(lang, "Nyomja meg a „Copy link” gombot — ezt a linket viszi át a Citovisóba.") },
            { box: [19.6, 81.6, 5.6, 4.7], text: T(lang, "Végül „Done” (kész).") },
          ],
        },
        { side: "c", img: "03-beillesztve", text: T(lang, "Vissza a Citovisóba: illessze be a Booking linkjét az 1. lépés mezőjébe, és nyomja meg az „Összekötés” gombot.") },
        { side: "c", img: "04-osszekotve", text: T(lang, "Kész: „Összekötve”. Látszik, mikor frissült, és hány foglalt napot hoztunk át. A Booking kétóránként néz ránk; az „Import now” gombbal azonnal is frissítheti.") },
      ],
    },
    {
      key: "szallas",
      provider: "Szállás.hu", // i18n-exempt: brand name
      steps: [
        {
          side: "p",
          img: "szallas-01-naptar-szinkron-oldal-naptar-exportalasa-gomb-szallaskeres",
          src: T(lang, "szallaskeres.hu blog (Appartman-felvétel)"),
          text: T(lang, "Lépjen be a Szállás.hu adminba."),
          foci: [
            { box: [0, 30.9, 26.3, 6.4], text: T(lang, "Bal oldali menü: „Árak és kapacitás”.") },
            { box: [0, 92.6, 26.3, 6.1], text: T(lang, "Alatta, a lista alján: „Naptár szinkron (iCal)”.") },
            { box: [28.7, 19.9, 40.7, 6.6], text: T(lang, "Felül a szoba neve. Ha több szobája van, itt válassza ki, melyiket köti össze — minden szobának saját linkje van.") },
            { box: [71.3, 30.1, 22.2, 7.9], text: T(lang, "Kattintson a „Naptár exportálása” gombra.") },
          ],
        },
        {
          side: "p",
          img: "szallas-02-naptar-exportalasa-popup-link-appartman",
          src: T(lang, "appartman.hu súgó"),
          text: T(lang, "Felugrik a Szállás.hu naptár-linkje."),
          foci: [
            { box: [9.6, 28.7, 80.4, 6.9], text: T(lang, "Jelölje ki az egész linket, és másolja ki (jobb klikk › Másolás, vagy Ctrl+C).") },
          ],
        },
        { side: "c", img: "03-beillesztve", text: T(lang, "A Citoviso-adminban, a Szállás.hu kártyáján: illessze be az 1. lépés mezőjébe, és nyomja meg az „Összekötés” gombot.") },
        { side: "c", img: "02-masolas", text: T(lang, "Ugyanott, a 2. lépésnél: „Másolás” — ezt a linket kapja meg a Szállás.hu.") },
        {
          side: "p",
          img: "szallas-03-naptar-szinkron-oldal-naptar-importalasa-gomb-appartman",
          src: T(lang, "appartman.hu súgó"),
          text: T(lang, "Vissza a Szállás.hu-ra, ugyanarra az oldalra (Naptár szinkron)."),
          foci: [
            { box: [50.1, 31.3, 20.4, 5.5], text: T(lang, "Most a „Naptár importálása” gombra kattintson.") },
          ],
        },
        {
          side: "p",
          img: "szallas-04-uj-naptar-importalasa-popup-siker-appartman",
          src: T(lang, "appartman.hu súgó"),
          text: T(lang, "Felugrik az „Új naptár importálása” ablak."),
          foci: [
            { box: [12.9, 50.3, 75, 6.2], text: T(lang, "„Naptár linkje”: ide illessze be a Citovisóból másolt linket.") },
            { box: [12.9, 65.5, 75, 6.1], text: T(lang, "„Nevezd el a naptárat”: például „honlap”.") },
            { box: [12.9, 75.8, 12.7, 5.9], text: T(lang, "Végül „Importálás”. A zöld sáv jelzi, hogy sikerült.") },
          ],
        },
        { side: "c", img: "04-osszekotve", text: T(lang, "Kész: a Citoviso-kártyán „Összekötve”, és látszik, hány foglalt napot hoztunk át. Ha másik szobája is van, azt is ugyanígy, külön kösse össze.") },
      ],
    },
    {
      key: "airbnb",
      provider: "Airbnb", // i18n-exempt: brand name
      steps: [
        { side: "c", img: "01-kartya", text: T(lang, "A Citoviso-adminban: Modulok › Online foglalás › „Hirdeti máshol is?” — itt az Airbnb kártyája.") },
        { side: "c", img: "02-masolas", text: T(lang, "Először másolja ki a SAJÁT naptár-linkjét: a 2. lépésnél nyomja meg a „Másolás” gombot.") },
        {
          side: "p",
          img: "airbnb-01-naptar-foglalhatosag-panel-rentalninja",
          src: T(lang, "Rental Ninja súgó"),
          text: T(lang, "Lépjen be az Airbnb-re, vendéglátó (host) módban."),
          foci: [
            { box: [43.8, 0.8, 4.4, 5.7], text: T(lang, "Felül: „Naptár” (Calendar). Ha több hirdetése van, válassza ki a megfelelőt.") },
            { box: [86.6, 10.4, 4.8, 4.7], text: T(lang, "Jobb oldalt: „Foglalhatóság” (Availability) fül.") },
            { box: [83.4, 96.4, 16.6, 3.6], text: T(lang, "A panel aljára görgetve: „Naptárak bekötése” (Connect calendars).") },
          ],
        },
        {
          side: "p",
          img: "airbnb-02-connect-calendars-rentalninja",
          src: T(lang, "Rental Ninja súgó"),
          text: T(lang, "Naptárak bekötése:"),
          foci: [
            { box: [2.6, 42.5, 93.2, 20.2], text: T(lang, "Válassza: „Csatlakozás egy másik webhelyhez” (Connect to another website).") },
          ],
        },
        {
          side: "p",
          img: "airbnb-03-connect-to-another-website-step1-link-rentalninja",
          src: T(lang, "Rental Ninja súgó"),
          text: T(lang, "Két lépés jelenik meg: az Airbnb linkje ki, a Citovisóé be."),
          foci: [
            { box: [5.7, 42, 90.6, 9.6], text: T(lang, "1. lépés: „Másolás” (Copy) — ez az Airbnb naptár-linkje, ezt viszi át a Citovisóba.") },
            { box: [5.7, 70.5, 90.6, 16], text: T(lang, "2. lépés: ide illessze be a Citovisóból másolt linket, és adjon nevet (pl. „honlap”).") },
            { box: [5.7, 90.1, 90.6, 6.9], text: T(lang, "Végül „Naptár hozzáadása” (Add calendar).") },
          ],
        },
        { side: "c", img: "03-beillesztve", text: T(lang, "Vissza a Citovisóba: illessze be az Airbnb linkjét az 1. lépés mezőjébe, és nyomja meg az „Összekötés” gombot.") },
        { side: "c", img: "04-osszekotve", text: T(lang, "Kész: „Összekötve”. Látszik, mikor frissült, és hány foglalt napot hoztunk át.") },
      ],
    },
  ];
}

const url = (file: string): string => `${BASE}${file}?v=${GUIDE_V}`;

/** The narrated videos are Hungarian (voice and burned-in captions): other languages get the steps only. */
export function portalGuide(lang: string): string {
  const portals = guidePortals(lang);
  const withVideo = (lang || "hu") === "hu";
  const tabs = portals
    .map((p, i) => `<button class="pguide__tab" type="button" data-k="${p.key}" aria-pressed="${i === 0}">${esc(p.provider)}</button>`)
    .join("");
  const modes = withVideo
    ? `<div class="pguide__modes" role="group" aria-label="${esc(T(lang, "Nézet"))}">` +
      `<button class="pguide__mode" type="button" data-m="video" aria-pressed="true">${T(lang, "Videó")}</button>` +
      `<button class="pguide__mode" type="button" data-m="text" aria-pressed="false">${T(lang, "Leírás képekkel")}</button></div>`
    : "";
  const panels = portals
    .map((p, i) => {
      const video = withVideo
        ? `<div class="pguide__vid" data-mode="video"><video controls playsinline preload="none" ` +
          `data-m="${url(`${p.key}-m.webm`)}" data-d="${url(`${p.key}-d.webm`)}"></video></div>` +
          `<p class="pguide__note" data-mode="video">${esc(T(lang, "{portal} összekötése, magyar hanggal és felirattal. Bármikor megállíthatja, és közben a lenti kártyán maga is csinálhatja.", { portal: p.provider }))}</p>`
        : "";
      const steps = p.steps
        .map((st, j) => {
          const alt = esc(T(lang, "{n}. lépés képe", { n: j + 1 }));
          let fig: string;
          let list = "";
          if (st.side === "c") {
            fig =
              `<figure class="pguide__img"><picture><source media="(max-width: 699px)" srcset="${url(`${p.key}-m-${st.img}.webp`)}">` +
              `<img src="${url(`${p.key}-d-${st.img}.webp`)}" alt="${alt}" loading="lazy"></picture></figure>`;
          } else {
            const boxes = st.foci
              .map((f, n) => `<span class="pguide__box" style="left:${f.box[0]}%;top:${f.box[1]}%;width:${f.box[2]}%;height:${f.box[3]}%"><b>${n + 1}</b></span>`)
              .join("");
            fig =
              `<figure class="pguide__img"><span class="pguide__fw"><img src="${url(`${st.img}.webp`)}" alt="${alt}" loading="lazy">${boxes}</span>` +
              `<figcaption>${esc(T(lang, "kép: {source}", { source: st.src }))}</figcaption></figure>`;
            list = `<ol class="pguide__foci">${st.foci.map((f) => `<li>${esc(f.text)}</li>`).join("")}</ol>`;
          }
          const where =
            st.side === "c"
              ? `<span class="pguide__where pguide__where--c">${T(lang, "Citoviso-admin")}</span>`
              : `<span class="pguide__where">${esc(T(lang, "{portal} oldalán", { portal: p.provider }))}</span>`;
          return (
            `<li class="pguide__st">${fig}<div class="pguide__h"><span class="pguide__n">${j + 1}</span>` +
            `<div>${where}<p class="pguide__t">${esc(st.text)}</p>${list}</div></div></li>`
          );
        })
        .join("");
      return (
        `<div class="pguide__p" data-k="${p.key}"${i === 0 ? "" : " hidden"}>` +
        video +
        `<ol class="pguide__steps" data-mode="text"${withVideo ? " hidden" : ""}>${steps}</ol></div>`
      );
    })
    .join("");
  return (
    `<section class="pguide" id="portal-bemutato" data-pguide>` +
    `<h3>${T(lang, "Így köti össze — videó és leírás")}</h3>` +
    `<p>${T(lang, "Két linket kell kicserélni: a portálét ide, az Önét a portálra. Válassza ki a portált.")}</p>` +
    `<div class="pguide__tabs">${tabs}</div>` +
    modes +
    panels +
    `<div class="pguide__zoom" role="dialog" aria-label="${esc(T(lang, "Nagyítás"))}" hidden><img alt=""></div>` +
    `</section>` +
    PGUIDE_JS
  );
}

export const PGUIDE_CSS = `
.pguide{container-type:inline-size;margin:0 0 14px;border:1px solid color-mix(in srgb,var(--citui-cyan-500) 45%,transparent);background:var(--citui-accent-soft);border-radius:var(--citui-radius-sm);padding:14px}
.pguide [hidden]{display:none!important}
.pguide h3{margin:0 0 4px;font:600 1rem/1.3 var(--citui-font-display)}
.pguide>p{margin:0 0 10px;font-size:.9rem}
.pguide__tabs{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}
.pguide__tab{border:1px solid var(--citui-line-strong);background:var(--citui-panel);color:var(--citui-ink);border-radius:var(--citui-radius-pill);padding:6px 14px;font:600 .9rem/1.2 inherit;cursor:pointer}
.pguide__tab[aria-pressed="true"]{background:var(--citui-navy-900);color:var(--citui-ink-inverse);border-color:var(--citui-navy-900)}
.pguide__modes{display:flex;border:1px solid var(--citui-line-strong);border-radius:12px;overflow:hidden;width:max-content;max-width:100%;margin:0 0 12px;background:var(--citui-panel)}
.pguide__mode{border:0;background:transparent;padding:8px 16px;font:600 .9rem/1.2 inherit;color:var(--citui-ink);cursor:pointer}
.pguide__mode[aria-pressed="true"]{background:var(--citui-cyan-500);color:var(--citui-accent-ink)}
.pguide__vid{background:var(--citui-navy-950);border-radius:12px;overflow:hidden}
.pguide__vid video{display:block;width:100%;height:auto;max-height:72vh;background:var(--citui-navy-950)}
.pguide__note{font-size:.8rem;color:var(--citui-muted);margin:8px 0 0}
.pguide__steps{list-style:none;margin:0;padding:0;display:grid;gap:14px}
.pguide__st{background:var(--citui-panel);border:1px solid var(--citui-line);border-radius:12px;padding:12px;display:grid;gap:10px}
@container (min-width:760px){.pguide__st{grid-template-columns:420px 1fr;align-items:start}}
.pguide__h{display:flex;gap:10px;align-items:flex-start}
.pguide__n{flex:none;width:26px;height:26px;border-radius:50%;background:var(--citui-navy-900);color:var(--citui-ink-inverse);display:grid;place-items:center;font-size:.8rem;font-weight:700}
.pguide__where{display:inline-block;font-size:.72rem;font-weight:700;letter-spacing:.03em;border-radius:var(--citui-radius-pill);padding:2px 9px;margin:0 0 4px;background:var(--citui-surface-2);color:var(--citui-ink);border:1px solid var(--citui-line-strong)}
.pguide__where--c{background:var(--citui-navy-900);color:var(--citui-ink-inverse);border-color:var(--citui-navy-900)}
.pguide__t{margin:0;font-size:.9rem}
.pguide__img{margin:0}
.pguide__img img{display:block;width:100%;height:auto;border:1px solid var(--citui-line);border-radius:10px;background:var(--citui-white);cursor:zoom-in}
.pguide__img figcaption{font-size:.72rem;color:var(--citui-muted);margin-top:4px}
.pguide__fw{position:relative;display:block}
.pguide__box{position:absolute;border:3px solid var(--citui-cyan-500);border-radius:6px;box-shadow:0 0 0 2px var(--citui-white);pointer-events:none}
.pguide__box b{position:absolute;left:-12px;top:-12px;width:22px;height:22px;border-radius:50%;background:var(--citui-cyan-500);color:var(--citui-accent-ink);font-size:.75rem;display:grid;place-items:center;box-shadow:0 0 0 2px var(--citui-white)}
.pguide__foci{margin:8px 0 0;padding:0;list-style:none;counter-reset:f;display:grid;gap:6px;font-size:.9rem}
.pguide__foci li{counter-increment:f;display:flex;gap:8px;align-items:flex-start}
.pguide__foci li::before{content:counter(f);flex:none;width:22px;height:22px;border-radius:50%;background:var(--citui-cyan-500);color:var(--citui-accent-ink);font-size:.75rem;font-weight:700;display:grid;place-items:center}
.pguide__zoom{position:fixed;inset:0;background:color-mix(in srgb,var(--citui-navy-950) 88%,transparent);display:flex;align-items:center;justify-content:center;padding:16px;z-index:60;cursor:zoom-out}
.pguide__zoom[hidden]{display:none}
.pguide__zoom img{max-width:100%;max-height:100%;border-radius:10px;background:var(--citui-white)}
`;

// Tabs (portal), modes (video / steps), the video file for the screen size, tap-to-zoom.
const PGUIDE_JS = `<script>(function(){
var g=document.querySelector("[data-pguide]");if(!g)return;
var mode=g.querySelector(".pguide__mode")?"video":"text";
function cur(){return g.querySelector(".pguide__p:not([hidden])");}
function vid(){var p=cur(),v=p&&p.querySelector("video");if(!v)return;if(!v.getAttribute("src")){v.src=window.innerWidth<700?v.dataset.m:v.dataset.d;v.preload="metadata";}}
function show(){g.querySelectorAll(".pguide__p").forEach(function(p){p.querySelectorAll("[data-mode]").forEach(function(e){e.hidden=e.dataset.mode!==mode;});});if(mode==="video")vid();}
g.addEventListener("click",function(e){
var t=e.target.closest(".pguide__tab");
if(t){g.querySelectorAll(".pguide__tab").forEach(function(b){b.setAttribute("aria-pressed",String(b===t));});g.querySelectorAll(".pguide__p").forEach(function(p){var on=p.dataset.k===t.dataset.k;p.hidden=!on;if(!on){var v=p.querySelector("video");if(v)v.pause();}});show();return;}
var m=e.target.closest(".pguide__mode");
if(m){mode=m.dataset.m;g.querySelectorAll(".pguide__mode").forEach(function(b){b.setAttribute("aria-pressed",String(b===m));});if(mode!=="video")g.querySelectorAll("video").forEach(function(v){v.pause();});show();return;}
var im=e.target.closest(".pguide__img img");var z=g.querySelector(".pguide__zoom");
if(im){z.querySelector("img").src=im.currentSrc||im.src;z.hidden=false;return;}
if(e.target.closest(".pguide__zoom")){z.hidden=true;}
});
document.addEventListener("keydown",function(e){if(e.key==="Escape")g.querySelector(".pguide__zoom").hidden=true;});
show();
})();</script>`;
