import { readFileSync } from "node:fs";
export const CITUI = ["public/assets/ui/citui.css","public/assets/ui/citui-admin.css"]
  .map(p => readFileSync(p,"utf8")).join("\n");

// Valós adat-minta: a fixtúra ugyanaz, amit a frozen-entry-check mér.
export const D = {
  name: "Nyugalom Vendégház", email: "elek@citoviso.com",
  site: "nyugalom.citoviso.com",
  base: 4880, renewDay: 10,
  frozenOn: "2026. 08. 20.", periodStart: "2026. 08. 10.", periodEnd: "2026. 09. 10.",
  closesOn: "2026. 09. 09.", nextAfterPay: "2026. 10. 10.",
  modules: [
    { id:"gallery", label:"Képek a szállásról", price:490 },
    { id:"rooms",   label:"Szobák, apartmanok", price:490 },
    { id:"booking", label:"Online foglalás",    price:690 },
    { id:"reviews", label:"Vendégek véleménye", price:390 },
    { id:"map",     label:"Térkép és útvonal",  price:290 },
    { id:"faq",     label:"Gyakori kérdések",   price:290 },
    { id:"prices",  label:"Árak és szezonok",   price:490 },
    { id:"events",  label:"Programok a környéken", price:390 },
    { id:"blog",    label:"Hírek, ajánlatok",   price:390 },
    { id:"nearby",  label:"Látnivalók",         price:290 },
    { id:"newsl",   label:"Hírlevél",           price:590 },
  ],
};
D.modTotal = D.modules.reduce((s,m)=>s+m.price,0);
// ⛔ A tartozás LEVEZETETT, nem beírt szám. Az első vágásban 10 270-et írtam ide
// kézzel, miközben a tételek 9 670-re jöttek ki — vagyis a mock a saját tervezői
// tábláján mutatta volna azt, hogy nem tudunk összeadni (feedback_two_divisors_on_one_row,
// feedback_one_rule_two_copies). Egy szabály, egy példány.
D.owed = D.base + D.modTotal;
if (D.owed !== D.base + D.modules.reduce((s,m)=>s+m.price,0)) throw new Error("a végösszeg nem a sorokból jön");
export const huf = (n) => new Intl.NumberFormat("hu-HU").format(n) + " Ft";

/** A közös váz: méret-váltó (@container!), fül-sáv, és a mock őszinte fejléce. */
export function page({ slug, title, blurb, css, tabs }) {
  return `<!DOCTYPE html><html lang="hu"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<style>${CITUI}
/* ── mock-keret (nem a termék része) ───────────────────────────────── */
body{margin:0;background:var(--citui-surface-2);font-family:var(--citui-font-text);color:var(--citui-ink)}
.mk-bar{position:sticky;top:0;z-index:200;background:var(--citui-navy-950);color:var(--citui-ink-inverse);
  padding:10px 14px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;font-size:.85rem}
.mk-bar b{font-family:var(--citui-font-display);font-size:.95rem}
.mk-sw{display:flex;gap:4px;margin-left:auto;background:rgba(255,255,255,.1);border-radius:var(--citui-radius-pill);padding:3px}
.mk-sw button{border:0;background:transparent;color:var(--citui-ink-inverse);font:600 .8rem var(--citui-font-text);
  padding:6px 14px;border-radius:var(--citui-radius-pill);cursor:pointer}
.mk-sw button[aria-pressed=true]{background:var(--citui-cyan-500);color:var(--citui-navy-950)}
.mk-note{padding:12px 16px;background:var(--citui-white);border-bottom:1px solid var(--citui-line);
  font-size:.85rem;line-height:1.55;color:var(--citui-muted)}
.mk-note strong{color:var(--citui-ink)}
/* ⚠️ @container, NEM @media: a @media az ABLAKHOZ kötődik, egy szűkített div-ben
   nem sülne el, tehát a váltó csak keskenyítene, de nem RENDEZNE ÁT. */
.mk-stage{container-type:inline-size;container-name:adm;margin:0 auto;background:var(--citui-surface);
  transition:max-width .18s ease;min-height:70vh;box-shadow:var(--citui-shadow-md)}
body[data-size=mobil] .mk-stage{max-width:390px}
body[data-size=asztali] .mk-stage{max-width:100%}
.adm-shell{display:block}
.adm-side{display:none}
.mk-tabs{display:flex;gap:2px;background:var(--citui-navy-900);padding:6px;overflow-x:auto}
.mk-tabs button{flex:1;min-width:90px;border:0;background:transparent;color:color-mix(in srgb,var(--citui-ink-inverse) 70%,transparent);
  font:600 .74rem var(--citui-font-text);padding:9px 6px;border-radius:10px;cursor:pointer;white-space:nowrap}
.mk-tabs button[aria-pressed=true]{background:color-mix(in srgb,var(--citui-cyan-500) 22%,transparent);color:var(--citui-white)}
.mk-body{padding:16px}
@container adm (min-width:760px){ .mk-body{padding:26px 30px} }
.mk-pane[hidden]{display:none}
.mk-h{font:700 1.5rem/1.2 var(--citui-font-display);margin:0 0 2px}
.mk-sub{color:var(--citui-muted);font-size:.9rem;margin:0 0 16px}
${css}
</style></head>
<body data-size="mobil">
<div class="mk-bar"><b>${title}</b>
  <span class="mk-sw" role="group" aria-label="Méret">
    <button type="button" data-size="mobil" aria-pressed="true">Mobil 390px</button>
    <button type="button" data-size="asztali" aria-pressed="false">Asztali</button>
  </span></div>
<div class="mk-note">${blurb}</div>
<div class="mk-stage"><div class="adm-shell"><main class="adm-main"><div class="mk-tabs" role="group" aria-label="Fül">
${tabs.map((t,i)=>`<button type="button" data-tab="${t.id}" aria-pressed="${i===0?"true":"false"}">${t.label}</button>`).join("")}
</div><div class="mk-body">
${tabs.map((t,i)=>`<section class="mk-pane" data-pane="${t.id}"${i===0?"":" hidden"}>
  <h1 class="mk-h">${t.label}</h1><p class="mk-sub">${D.name}</p>${t.html}</section>`).join("")}
</div></main></div></div>
<script>
(function(){
  var b=document.body;
  document.querySelectorAll(".mk-sw button").forEach(function(btn){
    btn.addEventListener("click",function(){
      b.dataset.size=btn.dataset.size;
      document.querySelectorAll(".mk-sw button").forEach(function(o){o.setAttribute("aria-pressed",String(o===btn))});
    });
  });
  document.querySelectorAll(".mk-tabs button").forEach(function(btn){
    btn.addEventListener("click",function(){
      document.querySelectorAll(".mk-tabs button").forEach(function(o){o.setAttribute("aria-pressed",String(o===btn))});
      document.querySelectorAll(".mk-pane").forEach(function(p){p.hidden = p.dataset.pane!==btn.dataset.tab});
      window.scrollTo(0,0);
    });
  });
})();
</script>
<script>${"/*BEHAVIOUR*/"}</script>
</body></html>`;
}
