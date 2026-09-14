import { D, huf, page } from "./shared.mjs";
import { writeFileSync } from "node:fs";

// ── B: RENDEZÉS-KÉPERNYŐ ────────────────────────────────────────────────────
// Fagyás alatt a lap egyetlen dologról szól. Az árcimkék és a be/ki kapcsolók
// ELTŰNNEK (nem vásárolható, nem hangolható állapot), a modulok read-only
// listává válnak: „ez kapcsol vissza a befizetéssel”. A kijárat (lemondás)
// NYITVA MARAD (ADR-0119 ⑥), de a lap alján, halkan.
const hero = (compact) => `
<section class="fz-hero${compact ? " fz-hero--compact" : ""}" data-hero>
  <div class="fz-hero__top"><span class="fz-dot"></span><h2>A honlapja jelenleg NEM elérhető</h2></div>
  <div class="fz-hero__grid">
    <div class="fz-amt">
      <span class="fz-amt__l">Rendezendő tartozás</span>
      <b class="fz-amt__v">${huf(D.owed)}</b>
      <span class="fz-amt__s">a ${D.periodStart} – ${D.periodEnd} időszak díja</span>
      <a class="citui-btn fz-pay" href="#" data-pay>Befizetem — ${huf(D.owed)}</a>
      <span class="fz-amt__note">Bankkártyával, a Barion oldalán. A befizetés után a honlap azonnal visszakapcsol.</span>
    </div>
    <div class="fz-dl">
      <span class="fz-dl__l">Hátralévő idő</span>
      <b class="fz-dl__v" data-days>20 nap</b>
      <span class="fz-dl__s"><b>${D.closesOn}</b>-ig rendezhető. Utána az előfizetés lezárul, és a honlap lekerül.</span>
      <div class="fz-bar"><i style="width:33%"></i></div>
      <span class="fz-dl__s">${D.frozenOn} óta felfüggesztve · a tartalom megvan, nem veszett el.</span>
    </div>
  </div>
</section>`;

const modList = D.modules.map(m => `<li>${m.label}</li>`).join("");

const attekintes = `
${hero(false)}
<div class="adm-card"><div class="adm-card__head"><h2>Áttekintés</h2></div>
<div class="adm-stats">
  <div class="adm-stat"><b><span class="citui-pill" style="background:color-mix(in srgb,var(--citui-bad) 14%,var(--citui-white));border-color:var(--citui-bad);color:var(--citui-bad)">Felfüggesztve</span></b><span>Állapot</span></div>
  <div class="adm-stat"><b style="font-size:1rem">${D.site}</b><span>Az oldal címe</span></div>
  <div class="adm-stat"><b>${D.modules.length} db</b><span>Modul · mind szünetel</span></div></div>
<p class="adm-lead" style="margin-top:18px">A szerkesztés (fotók, szövegek) a felfüggesztés alatt is megy — a változtatásai megmaradnak, és a visszakapcsoláskor azonnal kikerülnek.</p>
</div>`;

const modulok = `
${hero(false)}
<div class="adm-card"><div class="adm-card__head"><h2>Mi kapcsol vissza a befizetéssel</h2></div>
<p class="adm-lead">Ez a ${huf(D.owed)} fedezi. Semmit nem kell újra beállítani — a moduljai ugyanúgy jönnek vissza, ahogy hagyta őket.</p>
<div class="fz-back"><div><b>A honlap</b><span>${D.site} · alapdíj ${huf(D.base)}</span></div></div>
<ul class="fz-mods">${modList}</ul>
<p class="citui-hint">A ${D.modules.length} modul együtt ${huf(D.modTotal)}/hó — ezek a tartozás tételei, nem új vásárlás.</p>
</div>

<div class="adm-card"><div class="adm-card__head"><span class="adm-sub__dot adm-sub__dot--bad"></span><h2>Miért állt le a terhelés</h2></div>
<div class="adm-mand"><div class="adm-mand__ico">▣</div><div class="adm-mand__txt">
  <span class="adm-mand__pill adm-mand__pill--off">NEM SIKERÜLT</span>
  <h3>Az automatikus kártyaterhelés elakadt</h3>
  <p>A mentett kártyáról (•••• 4242) nem sikerült levonni a díjat, ezért a terhelés leállt.</p>
  <div class="adm-mand__acts">
    <button class="citui-btn citui-btn--primary adm-mand__btn" type="button" data-retry>Újrapróbálom ezzel a kártyával</button>
    <button class="citui-btn citui-btn--ghost adm-mand__btn" type="button" data-newcard>Másik kártyát adok meg</button>
  </div>
  <p class="adm-mand__hint" data-retrymsg hidden></p>
  <p class="adm-mand__hint"><a href="#" data-revoke>Megbízás visszavonása…</a></p>
</div></div>
<!-- ⛔ Fagyás alatt NINCS „Következő számla" cella: nincs következő számla, amíg
     ez nincs rendezve. A fordulónap a rendezés UTÁN indul újra. -->
<p class="citui-hint">A rendezés után a számlázás a ${D.nextAfterPay}-i fordulónaptól folytatódik.</p>
</div>

<div class="adm-card fz-shut"><div class="adm-card__head"><h2>Bolt</h2></div>
<p class="adm-lead">A felfüggesztés alatt új modul nem vehető fel. <b>Rendezés után vehető fel.</b></p></div>

<details class="adm-quietcancel"><summary>Mégis lemondanám az előfizetést…</summary>
  <div class="adm-danger"><h3>Előfizetés lemondása</h3>
  <p class="citui-hint" style="margin:0">A honlap jelenleg fel van függesztve. A lemondás nem kapcsolja vissza:
     az oldal felfüggesztve marad, az előfizetés pedig lezárul. Visszakapcsolni a rendezetlen díj befizetésével tud.</p>
  <button class="citui-btn adm-btn-bad" type="button" data-cancelsub style="margin-top:10px">Igen, lemondom</button>
  <p class="citui-hint" data-cancelmsg hidden style="margin-top:8px"></p></div>
</details>`;

const uzenetek = `
${hero(true)}
<div class="adm-card"><div class="adm-card__head"><h2>Üzenetek</h2></div>
<div class="adm-msg"><b>Honlapja felfüggesztve — rendezetlen díj</b><span>2026. 08. 20. · e-mail</span></div>
<div class="adm-msg"><b>Fizetési emlékeztető (3.)</b><span>2026. 08. 17. · e-mail</span></div>
<div class="adm-msg"><b>Az automatikus kártyaterhelés nem sikerült</b><span>2026. 08. 10. · e-mail</span></div>
</div>`;

const css = `
.fz-hero{background:linear-gradient(160deg,var(--citui-bad),color-mix(in srgb,var(--citui-bad) 72%,var(--citui-navy-900)));
  color:var(--citui-white);border-radius:var(--citui-radius);padding:22px;margin-bottom:18px;box-shadow:var(--citui-shadow-md)}
.fz-hero__top{display:flex;align-items:center;gap:10px;margin-bottom:16px}
.fz-hero__top h2{font:700 1.2rem var(--citui-font-display);margin:0}
.fz-dot{width:11px;height:11px;border-radius:50%;background:var(--citui-white);flex:0 0 auto;
  box-shadow:0 0 0 4px rgba(255,255,255,.28)}
.fz-hero__grid{display:grid;gap:18px}
.fz-amt{display:flex;flex-direction:column}
.fz-amt__l{font-size:.78rem;opacity:.9;text-transform:uppercase;letter-spacing:.04em}
.fz-amt__v{font:700 3rem/1 var(--citui-font-display);margin:4px 0 2px}
.fz-amt__s{font-size:.82rem;opacity:.9}
.fz-pay{margin-top:14px;background:var(--citui-white);color:var(--citui-bad);border-color:var(--citui-white);
  font:700 1.05rem var(--citui-font-text);padding:14px 22px;justify-content:center;display:flex}
.fz-pay:hover{background:var(--citui-surface);color:var(--citui-bad)}
.fz-amt__note{font-size:.76rem;opacity:.85;margin-top:8px;line-height:1.5}
.fz-dl{background:rgba(255,255,255,.14);border-radius:var(--citui-radius-sm);padding:16px;display:flex;flex-direction:column;gap:6px}
.fz-dl__l{font-size:.75rem;opacity:.9;text-transform:uppercase;letter-spacing:.04em}
.fz-dl__v{font:700 1.7rem var(--citui-font-display)}
.fz-dl__s{font-size:.8rem;opacity:.92;line-height:1.5}
.fz-bar{height:7px;border-radius:99px;background:rgba(255,255,255,.28);overflow:hidden;margin:4px 0}
.fz-bar i{display:block;height:100%;background:var(--citui-white)}
.fz-hero--compact .fz-dl{display:none}
.fz-hero--compact .fz-amt__v{font-size:2.1rem}
@container adm (min-width:760px){
  .fz-hero{padding:28px 30px}
  .fz-hero__grid{grid-template-columns:1.1fr .9fr;gap:26px;align-items:start}
  .fz-amt__v{font-size:3.6rem}
  .fz-pay{align-self:flex-start;display:inline-flex}
}
/* A modul-lista fagyás alatt READ-ONLY: nincs ár-cimke, nincs kapcsoló. */
.fz-mods{list-style:none;padding:0;margin:12px 0;display:grid;gap:6px}
@container adm (min-width:760px){ .fz-mods{grid-template-columns:1fr 1fr} }
.fz-mods li{background:var(--citui-surface-2);border-radius:10px;padding:10px 12px;font-size:.88rem}
.fz-mods li::before{content:"↻ ";color:var(--citui-ok);font-weight:700}
.fz-back{background:var(--citui-surface-2);border-radius:var(--citui-radius-sm);padding:14px;margin-top:8px}
.fz-back b{display:block;font-family:var(--citui-font-display)}
.fz-back span{font-size:.82rem;color:var(--citui-muted)}
.fz-shut{opacity:.6}
.adm-mand__acts{display:flex;flex-direction:column;gap:8px;margin-top:10px}
@container adm (min-width:760px){ .adm-mand__acts{flex-direction:row} }
.adm-mand__hint a{color:var(--citui-muted);font-size:.82rem}
.adm-quietcancel{margin:18px 0 0}
.adm-quietcancel>summary{cursor:pointer;color:var(--citui-muted);font-size:.85rem;padding:8px 0}
.adm-msg{display:flex;flex-direction:column;gap:2px;padding:12px 0;border-bottom:1px solid var(--citui-line)}
.adm-msg span{font-size:.8rem;color:var(--citui-muted)}
.adm-paid{background:var(--citui-ok-soft);border:1px solid var(--citui-ok);border-radius:var(--citui-radius);
  padding:20px;margin-bottom:18px}
.adm-paid h2{font:700 1.2rem var(--citui-font-display);margin:0 0 6px;color:var(--citui-ok)}
`;

const behaviour = `
(function(){
  document.addEventListener("click",function(e){
    if(e.target.closest("[data-pay]")){ e.preventDefault();
      if(!confirm("Barion — 9670 Ft terhelése.\\n\\nA befizetés után a honlap azonnal visszakapcsol. Rendben?")) return;
      document.querySelectorAll("[data-hero]").forEach(function(h){
        h.outerHTML='<div class="adm-paid"><h2>A honlapja újra elérhető</h2>'+
        '<p>A díj rendezve — a látogatói ismét elérik az oldalát, változatlan tartalommal. A számlát elküldtük e-mailben.</p></div>'; });
      document.querySelectorAll(".fz-shut").forEach(function(s){ s.style.opacity="1";
        s.querySelector(".adm-lead").innerHTML="A bolt nyitva — bármikor vehet fel új modult."; });
      return; }
    if(e.target.closest("[data-retry]")){ e.preventDefault();
      var m=document.querySelector("[data-retrymsg]"); m.hidden=false;
      m.textContent="Újrapróbáltuk… a bank elutasította (lejárt kártya). Adjon meg másik kártyát, vagy fizessen a fenti gombbal.";
      m.style.color="var(--citui-bad)"; return; }
    if(e.target.closest("[data-newcard]")){ e.preventDefault();
      var m2=document.querySelector("[data-retrymsg]"); m2.hidden=false;
      m2.textContent="A kártyát a fizetéskor tudja megadni — a „Befizetem” gomb a Barion oldalára visz, és az ott megadott kártya lesz az új megbízás.";
      m2.style.color="var(--citui-muted)"; return; }
    if(e.target.closest("[data-revoke]")){ e.preventDefault();
      alert("Megbízás visszavonása\\n\\nEzután fizetési linket küldünk e-mailben.\\nA rendezetlen 9670 Ft ettől nem szűnik meg."); return; }
    if(e.target.closest("[data-cancelsub]")){ e.preventDefault();
      var c=document.querySelector("[data-cancelmsg]"); c.hidden=false;
      c.innerHTML="<b>Ez a mock itt megáll.</b> Élesben ez lezárná az előfizetést, és a honlap véglegesen lekerülne."; }
  });
})();`;

writeFileSync("assets/design-refs/console/freeze-state-v2/freeze-state-B.regen.html",
  page({ slug:"B", title:"B változat — Rendezés-képernyő",
    blurb:"<strong>Mit dönt el:</strong> fagyás alatt a lap EGY dologról szól. A tartozás egy nagy, saját blokkot kap a <strong>határidővel együtt</strong>, a modul-lista pedig <strong>read-only</strong> lesz: nincs árcimke, nincs be/ki kapcsoló — helyette azt mondja meg, mi kapcsol vissza a befizetéssel. A kijárat (lemondás) nyitva marad, de a lap alján, halkan. <em>Kattintson: méret-váltó, fül-váltó, „Befizetem”, „Újrapróbálom”, lemondás.</em>",
    css, tabs:[
      { id:"attekintes", label:"Áttekintés", html: attekintes },
      { id:"modulok",    label:"Modulok",    html: modulok },
      { id:"uzenetek",   label:"Üzenetek",   html: uzenetek },
    ]}).replace("/*BEHAVIOUR*/", behaviour));
console.log("assets/design-refs/console/freeze-state-v2/freeze-state-B.regen.html");
