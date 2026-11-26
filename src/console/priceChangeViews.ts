// „Országok / Árazás” 5. fázis (0156; terv assets/design-refs/console/orszagok-arazas/ README ⑩): the summary
// BEFORE a price save — server-rendered (POST /pricing/preview), shown in the save dialog of the „Árazás” tab:
//   · affected subscriptions / all (of which frozen);
//   · the monthly revenue change once everybody pays the new price;
//   · when the notice goes; from when the new buyer and the existing subscriber pay;
//   · per subscription: cycle, next charge, first charge at the new price, now, new, difference.
// The numbers are payment/priceChange.ts priceChangeImpact — the renewal's own arithmetic.
import type { ChangeImpact } from "../payment/priceChange.js";
import { pendingPriceChanges, type PriceDelta } from "../pricing.js";
import { MODULE_CATALOG } from "../modules.js";
import { T } from "../i18n/mail.js";
import { formatMinor } from "../text/money.js";
import { consoleLang } from "./i18nCtx.js";
import { esc } from "./views.js";

export function priceChangeSummary(im: ChangeImpact, o: { readonly raise: boolean; readonly cut: boolean; readonly earliest: string }): string {
  const lang = consoleLang();
  if (!o.raise && !o.cut) return `<p class="pr2-lead">${esc(T(lang, "Az árak nem változnak — a mentés a többi beállítást írja."))}</p>`;
  const cur = im.subs[0]?.currency;
  const money = (n: number, c = cur ?? "HUF"): string => formatMinor(n, c, lang);
  const sign = (n: number, c?: string): string => (n > 0 ? `+${money(n, c)}` : n < 0 ? `−${money(-n, c)}` : money(0, c));
  const kpi = (v: string, l: string): string => `<div class="pcs-kpi"><b>${v}</b><span>${esc(l)}</span></div>`;
  const touched = im.subs.filter((s) => s.diff !== 0);
  const rows = touched
    .map(
      (s) => `<tr><td class="pcs-name">${esc(s.siteName)}${s.frozen ? ` <span class="pill outdated">${esc(T(lang, "szünetel"))}</span>` : ""}</td>
        <td data-l="${esc(T(lang, "Ciklus"))}">${esc(s.cycle === "annual" ? T(lang, "éves") : T(lang, "havi"))}</td><td data-l="${esc(T(lang, "Következő terhelés"))}">${esc(s.nextCharge)}</td><td data-l="${esc(T(lang, "Első új áras terhelés"))}"><b>${esc(s.firstNewCharge ?? "—")}</b></td>
        <td class="pcs-num" data-l="${esc(T(lang, "Most"))}">${esc(money(s.now, s.currency))}</td><td class="pcs-num" data-l="${esc(T(lang, "Új"))}"><b>${esc(money(s.next, s.currency))}</b></td><td class="pcs-num" data-l="${esc(T(lang, "Különbség"))}">${esc(sign(s.diff, s.currency))}</td></tr>`,
    )
    .join("");
  const when: string[] = [];
  if (o.raise && im.raiseFrom) {
    when.push(T(lang, "Áremelés: az új vevő {date}-tól fizet, a meglévő előfizető a {date} utáni első megújulásától.", { date: im.raiseFrom }));
    when.push(T(lang, "Az értesítő levél a mentés napján ({today}) megy ki minden érintett előfizetőnek, a szüneteltetetteknek is.", { today: im.today }));
  }
  if (o.cut) when.push(T(lang, "Árcsökkenés: mától érvényes, a következő terheléstől mindenkinek, levél nélkül."));
  return `<div class="pcs">
    <div class="pcs-kpis">
      ${kpi(`${im.affected} / ${im.total}`, im.frozenAffected ? T(lang, "érintett előfizető (ebből {n} szünetel)", { n: im.frozenAffected }) : T(lang, "érintett előfizető"))}
      ${kpi(esc(sign(im.monthlyDelta)), T(lang, "havi bevétel-változás a teljes átállás után"))}
      ${kpi(esc(o.raise && im.raiseFrom ? im.raiseFrom : im.today), o.raise ? T(lang, "az új ár kezdő napja") : T(lang, "érvényes mától"))}
    </div>
    <ul class="pcs-when">${when.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>
    ${touched.length
      ? `<div class="pcs-tw"><table class="pcs-t"><thead><tr><th>${esc(T(lang, "Előfizető"))}</th><th>${esc(T(lang, "Ciklus"))}</th><th>${esc(T(lang, "Következő terhelés"))}</th><th>${esc(T(lang, "Első új áras terhelés"))}</th><th>${esc(T(lang, "Most"))}</th><th>${esc(T(lang, "Új"))}</th><th>${esc(T(lang, "Különbség"))}</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<p class="pr2-lead">${esc(im.total === 0
          ? T(lang, "A régiónak nincs élő előfizetése — a változás csak az új vevőket érinti.")
          : T(lang, "Egyik élő előfizetés díja sem változik (a módosított tétel nincs az előfizetéseikben)."))}</p>`}
  </div>`;
}

/**
 * The save dialog of the „Árazás” tab (inside the pricing form: the start-date field travels with the POST).
 * The first submit opens it with the server's preview; its „Mentés” submits for real.
 */
export function priceChangeDialog(): string {
  const lang = consoleLang();
  return `<dialog class="pcs-dlg" id="pcs-dlg" aria-labelledby="pcs-dlg-h">
    <h3 id="pcs-dlg-h">${esc(T(lang, "Mentés előtt — mit változtat az árakon"))}</h3>
    <div id="pcs-body"></div>
    <div class="pcs-from" id="pcs-from" hidden>
      <label for="pcs-date"><b>${esc(T(lang, "Az áremelés kezdő napja"))}</b></label>
      <input type="date" id="pcs-date" name="effective_from">
      <p class="pr2-lead" id="pcs-from-hint"></p>
    </div>
    <p class="pr2-notice is-bad" id="pcs-err" role="alert" hidden></p>
    <div class="pcs-f"><button type="button" class="pr2-btn" id="pcs-back">${esc(T(lang, "Vissza"))}</button>
      <button type="button" class="pr2-btn pr2-btn--pri" id="pcs-save">${esc(T(lang, "Mentés"))}</button></div>
  </dialog>
  <style>
  .pcs-dlg{max-width:min(860px,96vw);width:100%;border:1px solid var(--citui-line);border-radius:var(--citui-radius);padding:18px 20px;background:var(--citui-panel);color:var(--citui-ink)}
  .pcs-dlg::backdrop{background:color-mix(in srgb,var(--citui-navy-950) 45%,transparent)}
  .pcs-dlg h3{margin:0 0 10px;font:600 17px var(--citui-font-display)}
  .pcs-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0 0 10px}
  .pcs-kpi{border:1px solid var(--citui-line);border-radius:var(--citui-radius-sm);padding:8px 10px;background:var(--citui-surface-2)}
  .pcs-kpi b{display:block;font:700 18px var(--citui-font-display)} .pcs-kpi span{font-size:12px;color:var(--citui-muted)}
  .pcs-when{margin:0 0 10px;padding-left:18px;font-size:13.5px;line-height:1.6}
  .pcs-tw{overflow-x:auto;max-height:46vh}
  .pcs-t{width:100%;border-collapse:collapse;font-size:13px}
  .pcs-t th,.pcs-t td{text-align:left;padding:5px 8px;border-bottom:1px solid var(--citui-line);white-space:nowrap}
  .pcs-num{text-align:right;font-variant-numeric:tabular-nums}
  .pcs-from{margin:12px 0 0;display:grid;gap:4px;max-width:320px}
  .pcs-from input{padding:6px 8px;border:1px solid var(--citui-line-strong);border-radius:var(--citui-radius-sm);background:var(--citui-field);color:var(--citui-ink)}
  .pcs-f{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
  @media (max-width:640px){
    .pcs-kpis{grid-template-columns:1fr}
    .pcs-tw{max-height:none}
    .pcs-t thead{display:none}
    .pcs-t tr{display:block;border-bottom:1px solid var(--citui-line);padding:6px 0}
    .pcs-t td{display:flex;justify-content:space-between;gap:12px;border:0;padding:2px 0;white-space:normal}
    .pcs-t td.pcs-name{font-weight:600}
    .pcs-t td[data-l]::before{content:attr(data-l);color:var(--citui-muted);font-weight:400}
  }
  </style>
  <script type="application/json" id="pcs-cfg">${JSON.stringify({
    earliest: T(lang, "Legkorábban {date} (a mentés napja + 30 nap). A levél a mentés napján megy ki."),
  }).replace(/</g, "\\u003c")}</script>
  <script>${PRICE_CHANGE_JS}</script>`;
}

const PRICE_CHANGE_JS = `(function(){
"use strict";
var form=document.getElementById("pr2-form"),dlg=document.getElementById("pcs-dlg");if(!form||!dlg)return;
var cfg=JSON.parse(document.getElementById("pcs-cfg").textContent||"{}");
var date=document.getElementById("pcs-date"),fromBox=document.getElementById("pcs-from"),err=document.getElementById("pcs-err");
var ok=false,seq=0;
function preview(open){
  var my=++seq;
  fetch("/pricing/preview",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams(new FormData(form)).toString(),credentials:"same-origin"})
   .then(function(r){return r.ok?r.json():null;}).then(function(j){
    if(!j||my!==seq)return;
    document.getElementById("pcs-body").innerHTML=j.summaryHtml||"";
    fromBox.hidden=!j.raise;
    if(j.raise){date.min=j.earliest;document.getElementById("pcs-from-hint").textContent=cfg.earliest.replace("{date}",j.earliest);if(!date.value){date.value=j.raiseFrom;preview(open);return;}}
    else date.value="";
    err.hidden=!j.fromError;err.textContent=j.fromError||"";
    document.getElementById("pcs-save").disabled=!!j.fromError;
    if(open){if(dlg.showModal)dlg.showModal();else dlg.setAttribute("open","");}
  }).catch(function(){});
}
form.addEventListener("submit",function(ev){
  if(ok)return;
  ev.preventDefault();delete form.dataset.pr2Submitting;
  preview(true);
});
date.addEventListener("change",function(){preview(false);});
document.getElementById("pcs-back").addEventListener("click",function(){if(dlg.close)dlg.close();else dlg.removeAttribute("open");});
document.getElementById("pcs-save").addEventListener("click",function(){ok=true;form.dataset.pr2Submitting="1";if(form.requestSubmit)form.requestSubmit();else form.submit();});
})();`;


/** The scheduled (pending) raises of a region — shown on top of the „Árazás” tab (null = none). */
export function pendingRaisesNote(region: string, currency: string): string {
  const lang = consoleLang();
  const list = pendingPriceChanges(region);
  if (!list.length) return "";
  const name = (id: string): string => MODULE_CATALOG.find((m) => m.id === id)?.label ?? id;
  const items = (d: PriceDelta): string[] => [
    ...(d.base !== undefined ? [T(lang, "alapdíj: {v} / hó", { v: formatMinor(d.base, currency, lang) })] : []),
    ...(d.freeMonths !== undefined ? [T(lang, "éves fizetésnél ingyenes hónap: {n}", { n: d.freeMonths })] : []),
    ...Object.entries(d.modules ?? {}).map(([id, v]) => T(lang, "{m}: {v} / hó", { m: name(id), v: formatMinor(v, currency, lang) })),
  ];
  return `<div class="pr2-notice" id="pcs-pending" role="status"><b>${esc(T(lang, "Ütemezett áremelés"))}</b><ul>${list
    .map((c) => `<li>${esc(T(lang, "{date} napjától: {items}", { date: c.effectiveFrom, items: items(c.next).join(" · ") }))}</li>`)
    .join("")}</ul>${esc(T(lang, "Addig a lap és minden ár a mostanit mutatja, a kezdő napon a rendszer magától írja át. Az értesítő levelet az előfizetők már megkapták. Ugyanezt az árat nem kell újra beírni: a mentés felismeri, és nem ütemezi kétszer."))}</div>`;
}
