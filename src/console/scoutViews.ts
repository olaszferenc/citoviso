// „Felderítés" — the scout worksheet (`/scout`, ADR-0336). Frozen plan B:
// assets/design-refs/console/scout-worksheet/ (README = the CONTRACT, plan-B.html = the
// working mock this page is measured against).
//
// Magellan (the digital scout) walks the Google Maps list tile by tile and records what
// he sees here: per tile the six keyword hit counts, per place the facts off its Maps
// profile. Every field is saved the moment it changes (ADR-0331). The server decides
// everything that has a rule (link parsing, known-lead match, completeness, close gate);
// the page only mirrors the phone normalisation live (PHONE_NORM_JS, the official client
// mirror of normalizePhone) and asks the server for the website verdict as one types.

import { T } from "../i18n/mail.js";
import { PHONE_NORM_JS } from "../text/phone.js";
import { ic } from "../ui/icons.js";
import { SCOUT_KEYWORDS, SCOUT_SAT_THRESHOLD } from "../scout/rules.js";
import type { PlaceView, ScoutRegion, ScoutStats, TileView } from "../scout/store.js";
import { consoleLang } from "./i18nCtx.js";
import { esc, helpLink, layout } from "./views.js";

export interface ScoutPageData {
  readonly regions: readonly ScoutRegion[];
  readonly region: ScoutRegion;
  readonly tiles: readonly TileView[];
  readonly stats: ScoutStats;
  readonly sel: string | null;
  readonly places: readonly PlaceView[];
}

/** JSON inside a <script>: never let a value close the tag. */
function scriptJson(v: unknown): string {
  return JSON.stringify(v).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

const SCOUT_CSS = `<style>
.con .sc-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 6px}
.con .sc-head h1{font-family:var(--citui-font-display);font-size:22px;margin:0;color:var(--citui-ink-brand)}
.con .sc-head select{margin-left:auto;min-width:0;max-width:100%}
.con .sc-saved{font-size:12px;color:var(--citui-muted);display:flex;align-items:center;gap:6px}
.con .sc-saved i{width:8px;height:8px;border-radius:50%;background:var(--citui-ok)}
.con .sc-saved.busy i{background:var(--citui-warn)}
.con .sc-saved.fail i{background:var(--citui-bad)}
.con .sc-saved.fail{color:var(--citui-bad-ink)}
.con .sc-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:12px 0 16px}
.con .sc-stat{background:var(--citui-panel);border:1px solid var(--citui-line);border-radius:10px;padding:10px 12px;min-width:0}
.con .sc-stat b{display:block;font:700 20px/1.1 var(--citui-font-display);color:var(--citui-ink-brand);font-variant-numeric:tabular-nums}
.con .sc-stat span{font-size:12px;color:var(--citui-muted)}
.con .sc-stat.cov b{color:var(--citui-ok-ink)}
.con .sc-bar{height:6px;border-radius:3px;background:var(--citui-surface-2);margin-top:6px;overflow:hidden}
.con .sc-bar i{display:block;height:100%;background:var(--citui-cyan-500);width:0}
.con .sc-cols{display:grid;grid-template-columns:340px minmax(0,1fr);gap:16px;align-items:start}
.con .sc-card{background:var(--citui-panel);border:1px solid var(--citui-line);border-radius:12px;padding:14px;min-width:0}
.con .sc-card h2{font:700 15px/1.2 var(--citui-font-display);margin:0 0 10px;color:var(--citui-ink-brand);display:flex;gap:8px;align-items:center}
.con .sc-card h2 small{font:500 12px var(--citui-font-text);color:var(--citui-muted);margin-left:auto}
.con .sc-map{display:grid;gap:3px}
.con button.sc-tile,.con .sc-tile{border:0;border-radius:4px;cursor:pointer;font:700 10px/1 var(--citui-font-text);color:var(--citui-ink-brand);
  background:var(--citui-surface-2);min-height:0;min-width:0;padding:0;position:relative;overflow:hidden;display:grid;place-items:center}
.con .sc-tile.out{background:color-mix(in srgb,var(--citui-cyan-300) 35%,var(--citui-panel));color:var(--citui-muted);cursor:default}
.con button.sc-tile.work{background:color-mix(in srgb,var(--citui-cyan-400) 55%,var(--citui-panel))}
.con button.sc-tile.sat{background:color-mix(in srgb,var(--citui-warn) 40%,var(--citui-panel))}
.con button.sc-tile.done{background:color-mix(in srgb,var(--citui-ok) 45%,var(--citui-panel));color:var(--citui-ok-ink)}
.con button.sc-tile.sel{outline:3px solid var(--citui-ink-brand);outline-offset:-1px;z-index:1}
.con .sc-legend{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;font-size:11px;color:var(--citui-muted)}
.con .sc-legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px}
.con .sc-legend .l-todo{background:var(--citui-surface-2)}
.con .sc-legend .l-work{background:color-mix(in srgb,var(--citui-cyan-400) 55%,var(--citui-panel))}
.con .sc-legend .l-sat{background:color-mix(in srgb,var(--citui-warn) 40%,var(--citui-panel))}
.con .sc-legend .l-done{background:color-mix(in srgb,var(--citui-ok) 45%,var(--citui-panel))}
.con .sc-geo{margin-top:12px;padding:8px 10px;border-radius:8px;background:var(--citui-surface);border:1px solid var(--citui-line);font-size:12px;color:var(--citui-ink);font-variant-numeric:tabular-nums}
.con .sc-geo div{overflow-wrap:anywhere}
.con .sc-geo span{color:var(--citui-muted)}
.con .sc-geo p{margin:6px 0 0;color:var(--citui-muted)}
.con .sc-kw{display:grid;grid-template-columns:1fr 64px auto auto;gap:6px 8px;align-items:center;margin-top:12px;font-size:13px}
.con .sc-kw a{font-size:12px;font-weight:700;color:var(--citui-link-ink);white-space:nowrap}
.con .sc-kw input{width:64px;padding:6px 8px;text-align:right}
.con .sc-st{font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;background:var(--citui-surface-2);color:var(--citui-muted);white-space:nowrap;text-align:center}
.con .sc-st.ok{background:var(--citui-ok-soft);color:var(--citui-ok-ink)}
.con .sc-st.sat{background:color-mix(in srgb,var(--citui-warn) 18%,var(--citui-panel));color:var(--citui-warn-ink)}
.con button.sc-btn{font-size:13px;font-weight:700;border-radius:8px;padding:8px 12px;min-height:0}
.con button.sc-btn.pri{background:var(--citui-navy-900);color:var(--citui-ink-inverse);border-color:transparent}
.con button.sc-btn:disabled{opacity:.45}
.con button.sc-btn.sm{padding:5px 10px;font-size:12px}
.con .sc-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.con .sc-hint{font-size:12px;color:var(--citui-muted);margin:8px 0 0}
.con .sc-err{font-size:12px;color:var(--citui-bad-ink);margin:6px 0 0}
.con .sc-err:empty{display:none}
.con .sc-err{white-space:pre-line}
.con .sc-add{display:flex;gap:8px}
.con .sc-add textarea{flex:1;min-height:42px;resize:vertical;min-width:0}
.con .sc-rows{margin-top:12px;display:flex;flex-direction:column;gap:8px}
.con .sc-row{border:1px solid var(--citui-line);border-radius:10px;padding:10px 12px;background:var(--citui-surface);min-width:0}
.con .sc-row .top{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.con .sc-row .nm{font-weight:700;overflow-wrap:anywhere}
.con .sc-row .co{font-size:11px;color:var(--citui-muted);font-variant-numeric:tabular-nums}
.con .sc-row .top .sp{margin-left:auto;display:flex;gap:6px;align-items:center}
.con .sc-chip{font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;white-space:nowrap}
.con .sc-chip.new{background:color-mix(in srgb,var(--citui-cyan-400) 22%,var(--citui-panel));color:var(--citui-link-ink)}
.con .sc-chip.known{background:var(--citui-surface-2);color:var(--citui-muted)}
.con .sc-chip.ok{background:var(--citui-ok-soft);color:var(--citui-ok-ink)}
.con .sc-chip.warn{background:color-mix(in srgb,var(--citui-warn) 18%,var(--citui-panel));color:var(--citui-warn-ink)}
.con .sc-form{display:grid;grid-template-columns:1fr 1fr;gap:8px 10px;margin-top:10px}
.con .sc-form label{font-size:12px;color:var(--citui-muted);display:flex;flex-direction:column;gap:3px;min-width:0}
.con .sc-form .full{grid-column:1/-1}
.con .sc-form .out{font-size:11px;color:var(--citui-link-ink);min-height:14px}
.con .sc-form .out.bad{color:var(--citui-bad-ink)}
.con .sc-verdict{display:flex;gap:12px;flex-wrap:wrap;font-size:13px;color:var(--citui-ink);margin-top:4px}
.con .sc-verdict label{flex-direction:row;align-items:center;color:var(--citui-ink);font-size:13px;gap:5px}
.con .sc-note{font-size:12px;color:var(--citui-muted);margin-top:4px}
.con .sc-note a{color:var(--citui-link-ink)}
@media (max-width:760px){
  .con .sc-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
  .con .sc-cols{grid-template-columns:minmax(0,1fr)}
  .con .sc-form{grid-template-columns:minmax(0,1fr)}
  .con .sc-head h1{font-size:20px}
}
</style>`;

/** Every sentence the page script shows — translated here, never in the script. */
function scoutStrings(lang: string): Record<string, string> {
  return {
    pick: T(lang, "válassz csempét"),
    pickHint: T(lang, "Válassz egy csempét a térképen."),
    tile: T(lang, "Csempe {label}"),
    geoCenter: T(lang, "Közép"),
    geoZoom: T(lang, "nagyítás"),
    geoEdges: T(lang, "Határ"),
    geoN: T(lang, "É"),
    geoS: T(lang, "D"),
    geoW: T(lang, "Ny"),
    geoE: T(lang, "K"),
    geoStep: T(lang, "A Térkép-link a csempe nézetére nyit, de a találati lista NEM szorul rá. Kicsinyíts egyet, nagyíts vissza, és kattints a „Keresés ezen a területen” gombra — a lista csak ezután a csempéé."),
    mapLink: T(lang, "Térkép"),
    mapLinkTitle: T(lang, "„{kw}” keresés a Térképen, a csempe nézetén"),
    addOut: T(lang, "„{name}” a csempén kívül esik — a {tile} csempébe tartozik"),
    addOutRegion: T(lang, "„{name}” a csempén kívül esik — a régión is kívül"),
    stTodo: T(lang, "hátravan"),
    stOk: T(lang, "kész"),
    stSat: T(lang, "telített"),
    kwHits: T(lang, "{kw} találat"),
    kwInt: T(lang, "Csak egész szám: hány találatot mutatott a lista."),
    split: T(lang, "Felosztás négy csempére"),
    close: T(lang, "Csempe lezárása"),
    places: T(lang, "{n} hely"),
    saving: T(lang, "Mentés…"),
    saved: T(lang, "Mentve {time}"),
    saveFail: T(lang, "Mentés sikertelen — próbáld újra"),
    addOpen: T(lang, "Válassz egy nyitott csempét."),
    addBad: T(lang, "{n} sor nem Google Térkép-hely link"),
    addDup: T(lang, "{n} hely már szerepel a munkalapon"),
    addEmpty: T(lang, "Illessz be legalább egy Térkép-hely linket."),
    chipKnown: T(lang, "már ismert lead"),
    chipProc: T(lang, "feldolgozás…"),
    chipLead: T(lang, "lead lett"),
    chipNoOwn: T(lang, "nem lead: saját honlap"),
    chipNoUnsure: T(lang, "nem lead: bizonytalan honlap"),
    chipOk: T(lang, "adatok rendben"),
    chipNew: T(lang, "új hely · adat kell"),
    open: T(lang, "Adatok"),
    shut: T(lang, "Becsuk"),
    knownNote: T(lang, "Azonos név 250 m-en belül:"),
    knownTail: T(lang, "Nem kell kinyitni."),
    leadNote: T(lang, "A lead lapja:"),
    fAddress: T(lang, "Cím"),
    fAddressPh: T(lang, "utca, házszám"),
    fCity: T(lang, "Település"),
    fPhone: T(lang, "Telefon (a Térkép-profilról)"),
    fWeb: T(lang, "Honlap (a Térkép-profilról)"),
    fPhotos: T(lang, "Fotók száma a profilon"),
    fRating: T(lang, "Értékelés · db"),
    fRatingPh: T(lang, "pl. 4,6 · 21"),
    fFound: T(lang, "Google-keresés: „név + település” — talált linkek (szóközzel)"),
    verdict: T(lang, "Ítélet:"),
    vNone: T(lang, "nincs saját honlap"),
    vOwn: T(lang, "van saját honlap (első link)"),
    vUnsure: T(lang, "bizonytalan"),
    vOwnBad: T(lang, "Az első link nem saját honlap (portál vagy hibás cím)."),
    phoneBad: T(lang, "Nem érvényes magyar szám"),
    webOwn: T(lang, "saját honlap — nem lead lesz belőle"),
    webPortal: T(lang, "portál, nem saját honlap"),
    webBad: T(lang, "Nem értelmezhető cím"),
    photosBad: T(lang, "Csak egész szám: hány fotó van a profilon."),
    ratingBad: T(lang, "Értékelés és darabszám, pl. 4,6 · 21"),
    covTitle: T(lang, "{seen} / {all} korábbi lead a régió területén"),
    busyJob: T(lang, "Már fut egy scrape — a lezárás most nem indítható, próbáld újra pár perc múlva."),
  };
}

export function scoutPage(d: ScoutPageData): string {
  const lang = consoleLang();
  const title = T(lang, "Felderítés");
  const regionOpts = d.regions
    .map((r) => `<option value="${esc(r.id)}"${r.id === d.region.id ? " selected" : ""}>${esc(r.label)}</option>`)
    .join("");
  const state = {
    region: d.region.id,
    tiles: d.tiles,
    stats: d.stats,
    sel: d.sel,
    places: d.places,
    kw: SCOUT_KEYWORDS,
    sat: SCOUT_SAT_THRESHOLD,
  };
  const body = `<div class="sc" id="scout">
  <div class="sc-head">
    <h1>${esc(title)}</h1>
    <button type="button" class="con-helpq" id="scHelpBtn" aria-haspopup="dialog" aria-controls="scHelp" aria-expanded="false"
            aria-label="${esc(T(lang, "Jelmagyarázat"))}" title="${esc(T(lang, "Jelmagyarázat"))}">?</button>
    <select id="scRegion" aria-label="${esc(T(lang, "Régió"))}">${regionOpts}</select>
    <span class="sc-saved" id="scSaved" role="status"><i></i><span>${T(lang, "Minden mentve")}</span></span>
  </div>
  <div class="sc-stats">
    <div class="sc-stat"><b id="sTiles">0 / 0</b><span>${T(lang, "csempe kész")}</span><div class="sc-bar"><i id="sBar"></i></div></div>
    <div class="sc-stat"><b id="sRows">0</b><span>${T(lang, "rögzített hely")}</span></div>
    <div class="sc-stat"><b id="sNew">0</b><span>${T(lang, "új a rendszerben")}</span></div>
    <div class="sc-stat"><b id="sKnown">0</b><span>${T(lang, "már ismert lead")}</span></div>
    <div class="sc-stat cov"><b id="sCov">–</b><span>${T(lang, "a korábbi leadek közül újra látott")}</span></div>
  </div>
  <div class="sc-cols">
    <div class="sc-card" id="scTileCard">
      <h2>${T(lang, "Csempék")} <small id="scTileName"></small></h2>
      <div class="sc-map" id="scMap"></div>
      <div class="sc-legend"><span><i class="l-todo"></i>${T(lang, "hátravan")}</span>
        <span><i class="l-work"></i>${T(lang, "folyamatban")}</span>
        <span><i class="l-sat"></i>${T(lang, "telített: felosztandó")}</span>
        <span><i class="l-done"></i>${T(lang, "kész")}</span></div>
      <div id="scKw"></div>
    </div>
    <div class="sc-card">
      <h2>${T(lang, "Helyek ebben a csempében")} <small id="scRowCount"></small></h2>
      <div class="sc-add">
        <textarea id="scLinks" placeholder="${esc(T(lang, "Térkép-hely linkek — soronként egy"))}" aria-label="${esc(T(lang, "Térkép-hely linkek"))}"></textarea>
        <button class="sc-btn pri" type="button" id="scAdd">${T(lang, "Felvétel")}</button>
      </div>
      <p class="sc-err" id="scAddErr"></p>
      <p class="sc-hint">${T(lang, "A rendszer a linkből veszi a nevet és a koordinátát, és azonnal megmondja, ismert-e már. Ismert helyet nem kell kinyitni.")}</p>
      <div class="sc-rows" id="scRows"></div>
    </div>
  </div>
  <div class="con-legend" id="scHelp" hidden>
    <div class="con-legend__box" role="dialog" aria-modal="true" aria-labelledby="scHelpTitle">
      <div class="con-legend__head">
        <h3 id="scHelpTitle">${T(lang, "Hogyan működik a munkalap?")}</h3>
        <button type="button" class="con-legend__x" id="scHelpX" aria-label="${esc(T(lang, "Bezárás"))}">${ic("close", 18)}</button>
      </div>
      <dl class="con-legend__list">
        <div class="con-legend__row"><dt>${T(lang, "Csempe")}</dt><dd>${T(lang, "A régió egy darabja, amit a Térképen egy nézetben átnézel. Minden csempében mind a hat kulcsszóra keresel, és beírod, hány találatot adott a lista.")}</dd></div>
        <div class="con-legend__row"><dt>${T(lang, "Csempe-azonosító")}</dt><dd>${T(lang, "A betű az oszlop nyugatról keletre (A a legnyugatibb), a szám a sor északról délre (1 a legészakibb). A negyedek: .1 északnyugat, .2 északkelet, .3 délnyugat, .4 délkelet.")}</dd></div>
        <div class="con-legend__row"><dt>${T(lang, "Telített")}</dt><dd>${T(lang, "Ha a lista egy kulcsszóra {n}-nál több találatot ad, a Térkép nem mutat meg mindent — a csempét négy kisebbre bontod, és azokat nézed át.", { n: SCOUT_SAT_THRESHOLD })}</dd></div>
        <div class="con-legend__row"><dt>${T(lang, "Ismert lead")}</dt><dd>${T(lang, "Azonos név 250 méteren belül. Ezt a rendszer dönti el a felvételkor; ismert helyet nem nyitsz ki.")}</dd></div>
        <div class="con-legend__row"><dt>${T(lang, "Mentés")}</dt><dd>${T(lang, "Minden mező a kitöltéskor mentődik. Ha a munkád megszakad, innen folytatod.")}</dd></div>
        <div class="con-legend__row"><dt>${T(lang, "Feldolgozás")}</dt><dd>${T(lang, "A csempe lezárásakor az új helyek a szokásos ingyenes lépéseken mennek át (honlap-ellenőrzés domain alapján, portál-olvasás), és lead lesz belőlük.")}</dd></div>
      </dl>
      <p class="con-legend__foot">${helpLink("console.scout", T(lang, "Részletes súgó a tudásbázisban"))}</p>
    </div>
  </div>
</div>
<script>
${PHONE_NORM_JS}
var SC=${scriptJson(state)};
var L=${scriptJson(scoutStrings(lang))};
${SCOUT_JS}
</script>`;
  return layout(title, body, { active: "/scout", head: SCOUT_CSS });
}

/** The page behaviour — mirrors plan-B.html; every rule decision comes from the server. */
const SCOUT_JS = String.raw`(function(){"use strict";
function $(id){return document.getElementById(id)}
function fmt(s,v){return String(s).replace(/\{(\w+)\}/g,function(m,k){return v&&v[k]!=null?v[k]:m})}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
var openRows={};
// ── save indicator: busy (yellow) while a write is in flight, then green + time ──
var savedEl=$("scSaved"),inflight=0,lastText=savedEl.lastChild.textContent;
function busy(){inflight++;savedEl.className="sc-saved busy";savedEl.lastChild.textContent=L.saving}
// soft = refused input (nothing was written): the indicator goes back to its last true state.
function done(ok,soft){inflight=Math.max(0,inflight-1);if(!ok&&!soft){savedEl.className="sc-saved fail";savedEl.lastChild.textContent=L.saveFail;return}
  if(inflight)return;savedEl.className="sc-saved";if(ok)lastText=fmt(L.saved,{time:new Date().toTimeString().slice(0,8)});savedEl.lastChild.textContent=lastText}
function api(method,url,body,quiet){if(!quiet)busy();
  return fetch(url,{method:method,headers:body?{"content-type":"application/json"}:{},body:body?JSON.stringify(body):undefined,credentials:"same-origin"})
    .then(function(r){return r.json().catch(function(){return{error:"http"}}).then(function(j){if(!r.ok&&!j.error)j.error="http";return j})})
    .then(function(j){if(!quiet)done(!j.error,!!j.soft);return j},function(){if(!quiet)done(false);return{error:"net"}})}
function absorb(j){if(j.tiles)SC.tiles=j.tiles;if(j.stats)SC.stats=j.stats;if(j.places)SC.places=j.places;if(j.sel!==undefined)SC.sel=j.sel}
function tileById(id){for(var i=0;i<SC.tiles.length;i++)if(SC.tiles[i].id===id)return SC.tiles[i];return null}
function selTile(){return SC.sel?tileById(SC.sel):null}
function syncUrl(){try{var u=new URL(location.href);u.searchParams.set("region",SC.region);if(SC.sel)u.searchParams.set("tile",SC.sel);else u.searchParams.delete("tile");history.replaceState(null,"",u)}catch(e){}}
// ── tile map: ONE flat grid — a split tile's quarters take over its cells, so every tile has
// its own grid area (nested grids gave a quarter the same area as a root tile, 2026-10-07) ──
function kids(id){return SC.tiles.filter(function(t){return t.parent===id}).sort(function(a,b){return a.idx-b.idx})}
function depthOf(t){var d=0;while(t&&t.parent){t=tileById(t.parent);d++}return d}
function layoutTiles(){var roots=SC.tiles.filter(function(t){return!t.parent}),D=0,cells=[],rows=0,cols=0;
  SC.tiles.forEach(function(t){D=Math.max(D,depthOf(t))});var u=Math.pow(2,D);
  function walk(t,r,c,n){if(t.state==="split"){var h=n/2;kids(t.id).forEach(function(k){walk(k,r+k.row*h,c+k.col*h,h)});return}cells.push({t:t,r:r,c:c,n:n})}
  roots.forEach(function(t){rows=Math.max(rows,t.row+1);cols=Math.max(cols,t.col+1);walk(t,t.row*u,t.col*u,u)});
  return{cells:cells,u:u,rows:rows,cols:cols}}
function tileClass(t){return"sc-tile "+t.state+(SC.sel===t.id?" sel":"")}
var mapSig="";
// Same tiles as drawn → only the state classes change; the buttons keep their DOM.
function renderMap(){var m=$("scMap"),g=layoutTiles(),sig=g.cells.map(function(x){return x.t.id+(x.t.state==="out"?"o":"")}).join(",");
  if(sig===mapSig){g.cells.forEach(function(x){var b=m.querySelector('button[data-tile="'+x.t.id+'"]');if(b)b.className=tileClass(x.t)});return}
  mapSig=sig;m.innerHTML="";
  m.style.gridTemplateColumns="repeat("+(g.cols*g.u)+",minmax(0,1fr))";m.style.gridTemplateRows="repeat("+(g.rows*g.u)+",minmax(0,1fr))";
  m.style.aspectRatio=(g.cols*1.1)+" / "+g.rows;
  g.cells.forEach(function(x){var t=x.t,b;
    if(t.state==="out"){b=document.createElement("span");b.className="sc-tile out";b.setAttribute("aria-hidden","true")}
    else{b=document.createElement("button");b.type="button";b.className=tileClass(t);b.textContent=t.label;b.onclick=function(){select(t.id)}}
    b.title=t.label;b.setAttribute("data-tile",t.id);
    b.style.gridRow=(x.r+1)+" / span "+x.n;b.style.gridColumn=(x.c+1)+" / span "+x.n;m.appendChild(b)})}
// ── keyword panel + split / close ──
function kwChip(el,st){el.className="sc-st"+(st==="ok"?" ok":st==="sat"?" sat":"");el.textContent=st==="ok"?L.stOk:st==="sat"?L.stSat:L.stTodo}
function c5(n){return Number(n).toFixed(5)}
function geoHtml(t){var g=t.geo,b=t.box;
  return'<div class="sc-geo" id="scGeo"><div><span>'+esc(L.geoCenter)+':</span> '+c5(g.lat)+', '+c5(g.lon)+' · <span>'+esc(L.geoZoom)+':</span> '+g.zoom+'z</div>'+
    '<div><span>'+esc(L.geoEdges)+':</span> '+esc(L.geoN)+' '+c5(b.north)+' · '+esc(L.geoS)+' '+c5(b.south)+' · '+esc(L.geoW)+' '+c5(b.west)+' · '+esc(L.geoE)+' '+c5(b.east)+'</div>'+
    '<p>'+esc(L.geoStep)+'</p></div>'}
function renderKw(){var t=selTile(),box=$("scKw");$("scTileName").textContent=t?fmt(L.tile,{label:t.label}):L.pick;
  if(!t){box.removeAttribute("data-for");box.innerHTML='<p class="sc-hint">'+esc(L.pickHint)+'</p>';return}
  var closed=t.state==="done",key=t.id+(closed?":done":"");
  // Same tile, same editability → refresh the status marks only; the inputs keep their DOM.
  if(box.getAttribute("data-for")===key){
    box.querySelectorAll("[data-kwst]").forEach(function(c){kwChip(c,t.kwStates[c.getAttribute("data-kwst")])});
    $("scSplit").disabled=t.state!=="sat";$("scClose").disabled=!t.canClose;$("scCloseHint").textContent=t.hint;return}
  box.setAttribute("data-for",key);
  var h=geoHtml(t)+'<div class="sc-kw">';
  SC.kw.forEach(function(k){var v=t.kw[k];
    h+='<span>'+esc(k)+'</span><input inputmode="numeric" data-kw="'+esc(k)+'" value="'+(v==null?"":v)+'" aria-label="'+esc(fmt(L.kwHits,{kw:k}))+'"'+(closed?" disabled":"")+'>'+
      '<span class="sc-st" data-kwst="'+esc(k)+'"></span>'+
      '<a href="'+esc(t.maps[k])+'" target="_blank" rel="noopener" data-map="'+esc(k)+'" title="'+esc(fmt(L.mapLinkTitle,{kw:k}))+'">'+esc(L.mapLink)+'</a>'});
  h+='</div><p class="sc-err" id="scKwErr"></p><div class="sc-actions">'+
    '<button class="sc-btn" type="button" id="scSplit"'+(t.state==="sat"?"":" disabled")+'>'+esc(L.split)+'</button>'+
    '<button class="sc-btn pri" type="button" id="scClose"'+(t.canClose?"":" disabled")+'>'+esc(L.close)+'</button></div>'+
    '<p class="sc-hint" id="scCloseHint">'+esc(t.hint)+'</p>';
  box.innerHTML=h;
  box.querySelectorAll("[data-kwst]").forEach(function(c){kwChip(c,t.kwStates[c.getAttribute("data-kwst")])});
  var id=t.id;
  box.querySelectorAll("input[data-kw]").forEach(function(inp){inp.onchange=function(){var v=inp.value.trim(),e=$("scKwErr");
    if(v!==""&&!/^\d+$/.test(v)){e.textContent=L.kwInt;return}e.textContent="";
    api("POST","/scout/tile/"+id+"/kw",{kw:inp.getAttribute("data-kw"),value:v}).then(function(j){
      if(j.error){e.textContent=j.message||L.kwInt;return}absorb(j);renderMap();renderKw();renderStats()})}});
  $("scSplit").onclick=function(){api("POST","/scout/tile/"+id+"/split",{}).then(function(j){if(j.error){$("scKwErr").textContent=j.message||"";return}absorb(j);syncUrl();render()})};
  $("scClose").onclick=function(){$("scClose").disabled=true;api("POST","/scout/tile/"+id+"/close",{}).then(function(j){
    if(j.error){$("scKwErr").textContent=j.message||"";absorb(j);render();return}absorb(j);render();poll()})}}
// ── rows ──
function chipFor(r){if(r.status==="known")return'<span class="sc-chip known">'+esc(L.chipKnown)+'</span>';
  if(r.status==="proc")return'<span class="sc-chip warn">'+esc(L.chipProc)+'</span>';
  if(r.status==="lead")return'<span class="sc-chip ok">'+esc(L.chipLead)+'</span>';
  if(r.status==="nolead")return'<span class="sc-chip known">'+esc(r.leadQual==="unknown"?L.chipNoUnsure:L.chipNoOwn)+'</span>';
  return r.complete?'<span class="sc-chip ok">'+esc(L.chipOk)+'</span>':'<span class="sc-chip new">'+esc(L.chipNew)+'</span>'}
function webOut(c){return c==="has_own"?L.webOwn:c==="portal_only"?L.webPortal:c==="invalid"?L.webBad:""}
function isOpen(r){return openRows[r.id]!=null?openRows[r.id]:!r.complete}
function verdictBox(r){if(r.webC==="has_own")return"";
  return'<label>'+esc(L.fFound)+'<textarea data-f="found" rows="2">'+esc(r.found)+'</textarea></label>'+
    '<div class="sc-verdict" role="radiogroup" aria-label="'+esc(L.verdict)+'"><span>'+esc(L.verdict)+'</span>'+
    [["none",L.vNone],["own",L.vOwn],["unsure",L.vUnsure]].map(function(o){return'<label><input type="radio" name="v'+r.id+'" value="'+o[0]+'"'+(r.verdict===o[0]?" checked":"")+'> '+esc(o[1])+'</label>'}).join("")+
    '</div><span class="out bad" data-o="verdict">'+(r.verdictBad?esc(L.vOwnBad):"")+'</span>'}
function rowHtml(r,t){var closed=t.state==="done";
  var h='<div class="top"><span class="nm">'+esc(r.name)+'</span><span class="co">'+r.lat.toFixed(4)+", "+r.lon.toFixed(4)+'</span><span class="sp">'+chipFor(r);
  if(r.status==="new"&&!closed)h+='<button class="sc-btn sm" type="button" data-tog>'+esc(isOpen(r)?L.shut:L.open)+'</button>';
  h+='</span></div>';
  if(r.status==="known"&&r.known)h+='<div class="sc-note">'+esc(L.knownNote)+' <a href="/lead/'+esc(r.known.id)+'">'+esc(r.known.name)+' · #'+esc(r.known.id.slice(0,8))+'</a>. '+esc(L.knownTail)+'</div>';
  if((r.status==="lead"||r.status==="nolead")&&r.leadId)h+='<div class="sc-note">'+esc(L.leadNote)+' <a href="/lead/'+esc(r.leadId)+'">#'+esc(r.leadId.slice(0,8))+'</a></div>';
  if(r.status==="new"&&!closed&&isOpen(r)){
    h+='<div class="sc-form">'+
    '<label>'+esc(L.fAddress)+'<input data-f="address" value="'+esc(r.address)+'" placeholder="'+esc(L.fAddressPh)+'"></label>'+
    '<label>'+esc(L.fCity)+'<input data-f="city" value="'+esc(r.city)+'"></label>'+
    '<label>'+esc(L.fPhone)+'<input data-f="phone" value="'+esc(r.phone)+'" inputmode="tel"><span class="out" data-o="phone"></span></label>'+
    '<label>'+esc(L.fWeb)+'<input data-f="website" value="'+esc(r.website)+'" inputmode="url"><span class="out" data-o="web"></span></label>'+
    '<label>'+esc(L.fPhotos)+'<input data-f="photos" value="'+esc(r.photos)+'" inputmode="numeric"><span class="out" data-o="photos"></span></label>'+
    '<label>'+esc(L.fRating)+'<input data-f="rating" value="'+esc(r.rating)+'" placeholder="'+esc(L.fRatingPh)+'"><span class="out" data-o="rating"></span></label>'+
    '<div class="full sc-vbox">'+verdictBox(r)+'</div></div>'}
  return h}
function setOut(d,key,text,bad){var o=d.querySelector('[data-o="'+key+'"]');if(o){o.textContent=text;o.className="out"+(bad?" bad":"")}}
function phoneOut(d,v){var n=v.trim()?norm(v):null;setOut(d,"phone",v.trim()?(n?"→ "+n:L.phoneBad):"",!!v.trim()&&!n)}
var webT=null;
function liveWeb(d,v){clearTimeout(webT);webT=setTimeout(function(){api("GET","/scout/check?web="+encodeURIComponent(v),null,true).then(function(j){if(j.webC)setOut(d,"web",webOut(j.webC),j.webC==="invalid")})},250)}
function wireRow(d,r,t){var tog=d.querySelector("[data-tog]");if(tog)tog.onclick=function(){openRows[r.id]=!isOpen(r);d.innerHTML=rowHtml(r,t);wireRow(d,r,t)};
  if(d.querySelector('[data-o="phone"]'))phoneOut(d,r.phone);
  setOut(d,"web",webOut(r.webC),r.webC==="invalid");
  d.querySelectorAll("[data-f]").forEach(function(inp){var f=inp.getAttribute("data-f");
    inp.oninput=function(){if(f==="phone")phoneOut(d,inp.value);if(f==="website")liveWeb(d,inp.value.trim())};
    inp.onchange=function(){saveField(d,r,t,f,inp.value)}});
  d.querySelectorAll('input[type=radio]').forEach(function(rb){rb.onchange=function(){saveField(d,r,t,"verdict",rb.value)}})}
function saveField(d,r,t,f,v){api("POST","/scout/place/"+r.id,{field:f,value:v}).then(function(j){
  if(j.error){if(f==="photos")setOut(d,"photos",L.photosBad,true);else if(f==="rating")setOut(d,"rating",L.ratingBad,true);return}
  if(f==="photos")setOut(d,"photos","",false);if(f==="rating")setOut(d,"rating","",false);
  absorb(j);var nr=null;SC.places.forEach(function(p){if(p.id===r.id)nr=p});if(!nr)return;
  var hadBox=r.webC!=="has_own",hasBox=nr.webC!=="has_own";
  for(var k in nr)r[k]=nr[k];
  d.querySelector(".top .sp").firstChild.outerHTML=chipFor(r);
  if(hadBox!==hasBox){var vb=d.querySelector(".sc-vbox");if(vb){vb.innerHTML=verdictBox(r);wireRow(d,r,t)}}
  else setOut(d,"verdict",r.verdictBad?L.vOwnBad:"",true);
  if(f==="website")setOut(d,"web",webOut(r.webC),r.webC==="invalid");
  if(f==="phone")phoneOut(d,r.phone);
  renderMap();renderKw();renderStats()})}
// Rows are keyed by place: a row is rebuilt only when its kind changes (status, closed, lead);
// otherwise only its label chip is refreshed and its fields keep their DOM.
function rowSig(r,t){return r.status+"|"+(t.state==="done"?1:0)+"|"+(r.leadId||"")+"|"+(r.known?r.known.id:"")}
function renderRows(){var t=selTile(),box=$("scRows");$("scRowCount").textContent=t?fmt(L.places,{n:SC.places.length}):"";
  var closed=!t||t.state==="done"||t.state==="out";$("scAdd").disabled=closed;$("scLinks").disabled=closed;
  if(!t){box.innerHTML="";box.removeAttribute("data-for");return}
  if(box.getAttribute("data-for")!==t.id){box.innerHTML="";box.setAttribute("data-for",t.id)}
  var seen={};
  SC.places.forEach(function(r){seen[r.id]=1;var d=box.querySelector('[data-place="'+r.id+'"]'),sig=rowSig(r,t);
    if(d&&d.getAttribute("data-sig")===sig&&d._r){for(var k in r)d._r[k]=r[k];var c=d.querySelector(".top .sp").firstChild;if(c)c.outerHTML=chipFor(d._r);return}
    var nd=document.createElement("div");nd.className="sc-row";nd.setAttribute("data-place",r.id);nd.setAttribute("data-sig",sig);nd._r=r;
    nd.innerHTML=rowHtml(r,t);wireRow(nd,r,t);if(d)box.replaceChild(nd,d);else box.appendChild(nd)});
  box.querySelectorAll("[data-place]").forEach(function(d){if(!seen[d.getAttribute("data-place")])d.remove()})}
$("scAdd").onclick=function(){var t=selTile(),e=$("scAddErr");e.textContent="";if(!t||t.state==="done"){e.textContent=L.addOpen;return}
  var v=$("scLinks").value;if(!v.trim()){e.textContent=L.addEmpty;return}
  api("POST","/scout/tile/"+t.id+"/links",{links:v}).then(function(j){if(j.error){e.textContent=j.message||L.addOpen;return}
    var msg=[];if(j.bad)msg.push(fmt(L.addBad,{n:j.bad}));if(j.dup)msg.push(fmt(L.addDup,{n:j.dup}));
    (j.outside||[]).forEach(function(o){msg.push(fmt(o.tile?L.addOut:L.addOutRegion,{name:o.name,tile:o.tile}))});e.textContent=msg.join("\n");
    $("scLinks").value="";absorb(j);render()})};
// ── stats ──
function renderStats(){var s=SC.stats;$("sTiles").textContent=s.tilesDone+" / "+s.tilesAll;$("sBar").style.width=(s.tilesAll?100*s.tilesDone/s.tilesAll:0)+"%";
  $("sRows").textContent=s.rows;$("sNew").textContent=s.fresh;$("sKnown").textContent=s.known;
  var c=$("sCov");c.textContent=s.coverage==null?"–":s.coverage+"%";
  c.parentNode.title=fmt(L.covTitle,{seen:s.coverage==null?0:Math.round(s.coverage*s.coverageOf/100),all:s.coverageOf})}
function render(){renderMap();renderKw();renderRows();renderStats()}
function select(id){SC.sel=id;openRows={};$("scAddErr").textContent="";syncUrl();renderMap();renderKw();
  api("GET","/scout/tile/"+id,null,true).then(function(j){if(!j.error){absorb(j);render();if(anyProc())poll()}})}
// ── processing: poll while a row of the tile is „feldolgozás…" ──
var pollT=null;
function anyProc(){return SC.places.some(function(p){return p.status==="proc"})}
function poll(){clearTimeout(pollT);if(!SC.sel||!anyProc())return;var id=SC.sel;
  pollT=setTimeout(function(){api("GET","/scout/tile/"+id,null,true).then(function(j){if(j.error||SC.sel!==id)return;absorb(j);render();poll()})},2000)}
$("scRegion").onchange=function(){location.href="/scout?region="+encodeURIComponent(this.value)};
// ── help popup: one „?" — Esc / backdrop close, focus returns to the button ──
(function(){var lg=$("scHelp"),btn=$("scHelpBtn"),x=$("scHelpX");
  function open(){lg.hidden=false;btn.setAttribute("aria-expanded","true");x.focus()}
  function close(){if(lg.hidden)return;lg.hidden=true;btn.setAttribute("aria-expanded","false");btn.focus()}
  btn.addEventListener("click",function(e){e.preventDefault();open()});x.addEventListener("click",close);
  lg.addEventListener("click",function(e){if(e.target===lg)close()});
  document.addEventListener("keydown",function(e){if(e.key==="Escape")close()})})();
syncUrl();render();if(anyProc())poll();
})();`;
