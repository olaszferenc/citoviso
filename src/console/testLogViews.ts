// Test-log screens (Elek-rend, approved contract: assets/design-refs/console/
// elek-test-log/ — B variant). Renders ONLY the human-truth checklist rows of an
// FK scenario; the machine fields (út/tedd/várd) never reach this surface.
//
// Two-track doctrine: the shared save list NEVER contains the `elek` user; that
// run is only reachable read-only via the explicit ?user=elek link.

import type { FkScenario } from "../elek/fkParse.js";
import { stepCount } from "../elek/fkParse.js";
import type { TestLogSave, TestLogHistoryRow } from "../elek/testLogStore.js";
import { esc, layout, helpLink } from "./views.js";
import { T } from "../i18n/mail.js";
import { consoleLang } from "./i18nCtx.js";

const CSS = `<style>
.tlog-wrap{display:block}
.tlog-sect{margin:0 0 22px}
.tlog-sect h2{font-size:1rem;margin:0 0 2px;display:flex;align-items:center;gap:8px}
.tlog-sect h2 .tlog-cnt{margin-left:auto;font-size:.72rem;font-weight:600;color:var(--citui-muted);
  background:var(--citui-surface-2);border-radius:var(--citui-radius-pill);padding:3px 10px}
.tlog-sect h2 .tlog-cnt.done{background:var(--citui-ok-soft);color:var(--citui-ok)}
.tlog-card{background:var(--citui-white);border:1px solid var(--citui-line);border-radius:var(--citui-radius-sm);padding:4px 14px 12px;margin-top:8px}
.tlog-step{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px dashed var(--citui-line)}
.tlog-step:last-of-type{border-bottom:0}
.tlog-step input[type=checkbox]{width:19px;height:19px;margin:1px 0 0;accent-color:var(--citui-cyan-500);flex:none}
.tlog-step label{font-size:.9rem;line-height:1.45;cursor:pointer}
.tlog-kezi{display:inline-block;margin-left:6px;font-size:.68rem;font-weight:700;color:var(--citui-warn);
  border:1px solid currentColor;border-radius:var(--citui-radius-pill);padding:1px 8px;vertical-align:2px}
.tlog-cl{font-size:.72rem;font-weight:600;color:var(--citui-muted);margin-top:10px;text-transform:uppercase;letter-spacing:.04em}
.tlog-cmt{width:100%;margin-top:6px;border:1px solid var(--citui-line-strong);border-radius:var(--citui-radius-sm);
  padding:9px 11px;font:inherit;font-size:.85rem;min-height:50px;resize:vertical;background:var(--citui-surface)}
.tlog-cmt:focus{outline:2px solid var(--citui-cyan-400);outline-offset:1px}
.tlog-cmtview{margin-top:8px;padding:9px 11px;border-radius:var(--citui-radius-sm);background:var(--citui-surface-2);
  font-size:.85rem;line-height:1.5;white-space:pre-wrap}
.tlog-cmtview:empty{display:none}
.tlog-railbox{background:var(--citui-white);border:1px solid var(--citui-line);border-radius:var(--citui-radius-sm);padding:14px}
.tlog-railbox h3{font-size:.92rem;margin:0 0 10px}
.tlog-pbar{height:8px;border-radius:var(--citui-radius-pill);background:var(--citui-surface-2);overflow:hidden;margin:8px 0 4px}
.tlog-pbar i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--citui-cyan-500),var(--citui-cyan-300));transition:width 220ms ease}
.tlog-pnum{font-weight:700;font-size:1.05rem}
.tlog-seclinks{list-style:none;margin:10px 0 0;padding:0;border-top:1px solid var(--citui-line)}
.tlog-seclinks li{display:flex;align-items:center;gap:8px;padding:7px 0;font-size:.82rem;border-bottom:1px dashed var(--citui-line)}
.tlog-seclinks a{color:var(--citui-ink);text-decoration:none;font-weight:500}
.tlog-seclinks .tlog-mini{margin-left:auto;font-size:.72rem;color:var(--citui-muted)}
.tlog-seclinks .tlog-mini.done{color:var(--citui-ok);font-weight:700}
.tlog-save{font:inherit;font-weight:700;font-size:.9rem;cursor:pointer;border:0;border-radius:var(--citui-radius-pill);
  padding:12px 20px;background:var(--citui-cyan-500);color:var(--citui-navy-950);width:100%;margin-top:12px}
.tlog-save:hover{background:var(--citui-cyan-400)}
.tlog-savestate{font-size:.74rem;color:var(--citui-muted);margin-top:8px;text-align:center}
.tlog-savestate b.ok{color:var(--citui-ok)}
.tlog-others{margin-top:14px;border-top:1px solid var(--citui-line);padding-top:10px}
.tlog-others h4{font-size:.78rem;margin:0 0 6px;color:var(--citui-muted)}
.tlog-others ul{list-style:none;margin:0;padding:0;font-size:.78rem}
.tlog-others li{display:flex;gap:8px;padding:5px 0;border-bottom:1px dashed var(--citui-line)}
.tlog-others .tlog-who{font-weight:600}
.tlog-others .tlog-when{margin-left:auto;color:var(--citui-muted)}
.tlog-viewer{margin:0 0 14px;padding:10px 14px;border-radius:var(--citui-radius-sm);
  background:var(--citui-navy-900);color:var(--citui-ink-inverse);font-size:.85rem}
.tlog-mfoot{position:sticky;bottom:0;display:flex;align-items:center;gap:10px;background:var(--citui-navy-950);
  color:var(--citui-ink-inverse);padding:10px 14px;font-size:.82rem;margin:18px -14px -14px;border-radius:0}
.tlog-mfoot .tlog-pbar{flex:1;margin:0;background:color-mix(in srgb,var(--citui-white) 15%,transparent)}
@media(min-width:900px){
  .tlog-wrap{display:grid;grid-template-columns:1fr 290px;gap:26px;align-items:start}
  .tlog-railbox{position:sticky;top:14px}
  .tlog-mfoot{display:none}
}
.tlog-index{list-style:none;margin:0;padding:0}
.tlog-index li{padding:10px 0;border-bottom:1px dashed var(--citui-line);font-size:.9rem}
.tlog-index a{font-weight:600;text-decoration:none;color:var(--citui-ink)}
.tlog-index .tlog-mut{color:var(--citui-muted);font-size:.82rem}
</style>`;

export function testLogIndexPage(scenarios: FkScenario[]): string {
  const lang = consoleLang();
  const items = scenarios.length
    ? scenarios
        .map(
          (s) =>
            `<li><a href="/test-log/${esc(s.id)}">${esc(s.id)} — ${esc(s.title)}</a><br>
             <span class="tlog-mut">${esc(s.cel)}</span></li>`,
        )
        .join("")
    : `<li><span class="tlog-mut">${T(lang, "Még nincs forgatókönyv.")}</span></li>`;
  const body = `
    <div class="panel">
      <h2>${T(lang, "Teszt-napló")} ${helpLink("console.test_log")}</h2>
      <ul class="tlog-index">${items}</ul>
    </div>${CSS}`;
  return layout(T(lang, "Teszt-napló"), body, { active: "/test-log" });
}

export interface TestLogPageOpts {
  /** Signed-in operator's username (the save identity). */
  currentUser: string;
  /** Non-null → read-only viewer mode for THIS user's saved run. */
  viewUser: string | null;
  /** The rendered user's saved state (own save, or the viewed user's). */
  save: TestLogSave | null;
  /** Shared save list (already elek-filtered by the store). */
  saves: TestLogHistoryRow[];
}

export function testLogPage(fk: FkScenario, opts: TestLogPageOpts): string {
  const lang = consoleLang();
  const viewer = opts.viewUser !== null;
  const total = stepCount(fk);
  const checks = opts.save?.checks ?? [];
  const comments = opts.save?.comments ?? [];
  const done = checks.filter(Boolean).length;

  let gi = 0;
  const sectionsHtml = fk.sections
    .map((sec, si) => {
      const stepsHtml = sec.steps
        .map((st) => {
          const i = gi++;
          return `
        <div class="tlog-step">
          <input type="checkbox" id="st${i}" data-i="${i}" ${checks[i] ? "checked" : ""} ${viewer ? "disabled" : ""}>
          <label for="st${i}">${esc(st.text)}${st.kezi ? `<span class="tlog-kezi">${T(lang, "kézi")}</span>` : ""}</label>
        </div>`;
        })
        .join("");
      const cmt = viewer
        ? `<div class="tlog-cmtview">${esc(comments[si] ?? "")}</div>`
        : `<textarea class="tlog-cmt" data-si="${si}" placeholder="${esc(T(lang, "Mit találtál ebben a szakaszban?"))}">${esc(comments[si] ?? "")}</textarea>`;
      return `
      <div class="tlog-sect" id="tlsec${si}">
        <h2>${esc(sec.title)}<span class="tlog-cnt" data-si="${si}"></span></h2>
        <div class="tlog-card">${stepsHtml}
          <div class="tlog-cl">${T(lang, "Komment / lelet")}</div>${cmt}
        </div>
      </div>`;
    })
    .join("");

  const secLinks = fk.sections
    .map(
      (sec, si) =>
        `<li><a href="#tlsec${si}">${esc(sec.title)}</a><span class="tlog-mini" data-si="${si}"></span></li>`,
    )
    .join("");

  const savesHtml = opts.saves
    .map(
      (r) => `
      <li><span class="tlog-who"><a href="/test-log/${esc(fk.id)}?user=${encodeURIComponent(r.user)}">${esc(r.user)}</a></span>
      <span>${r.done}/${r.total} ${T(lang, "lépés")}</span>
      <span class="tlog-when">${esc(r.ts.slice(0, 16).replace("T", " "))}</span></li>`,
    )
    .join("");

  const viewerBar = viewer
    ? `<div class="tlog-viewer">${T(lang, "Megtekintő mód")} — <b>${esc(opts.viewUser ?? "")}</b> ${T(lang, "mentett futása, csak olvasásra.")}</div>`
    : "";

  const summaryBlock = viewer
    ? `<div class="tlog-cl">${T(lang, "Végső összegzés")}</div>
       <div class="tlog-cmtview">${esc(opts.save?.summary ?? "")}</div>`
    : `<div class="tlog-cl">${T(lang, "Végső összegzés")}</div>
       <textarea class="tlog-cmt" id="tlsum" placeholder="${esc(T(lang, "Összbenyomás, bent maradt teszt-adatok…"))}">${esc(opts.save?.summary ?? "")}</textarea>
       <button class="tlog-save" id="tlsave" type="button">${T(lang, "Mentés a szerverre")}</button>
       <div class="tlog-savestate">${T(lang, "Helyi mentés automatikus · szerver:")} <b id="tlsrv">${opts.save ? esc(opts.save.ts.slice(11, 16)) : T(lang, "még nem")}</b></div>`;

  const body = `
    <h2 style="margin:0 0 2px">${T(lang, "Teszt-napló")} · ${esc(fk.id)} ${helpLink("console.test_log")}</h2>
    <p class="small mut" style="margin:0 0 16px">${esc(fk.title)} · ${T(lang, "bejelentkezve:")} <b>${esc(viewer ? `${opts.viewUser} (${T(lang, "megtekintés")})` : opts.currentUser)}</b></p>
    ${viewerBar}
    <div class="tlog-wrap">
      <div>${sectionsHtml}</div>
      <div class="tlog-railbox">
        <h3>${T(lang, "Állapot")}</h3>
        <span class="tlog-pnum"><span id="tldone">${done}</span>/${total} ${T(lang, "lépés kész")}</span>
        <div class="tlog-pbar"><i id="tlfill"></i></div>
        <ul class="tlog-seclinks">${secLinks}</ul>
        ${summaryBlock}
        <div class="tlog-others">
          <h4>${T(lang, "Korábbi mentések")}</h4>
          <ul id="tlothers">${savesHtml || `<li><span class="tlog-mut">${T(lang, "Még nincs mentés.")}</span></li>`}</ul>
        </div>
      </div>
    </div>
    <div class="tlog-mfoot">
      <span style="font-weight:700"><span id="tlmdone">${done}</span>/${total}</span>
      <div class="tlog-pbar"><i id="tlmfill"></i></div>
      <span id="tlmsave"></span>
    </div>
    ${CSS}
    <script>${clientJs(fk, opts, total)}</script>`;
  return layout(`${T(lang, "Teszt-napló")} · ${fk.id}`, body, { active: "/test-log" });
}

/** Client behavior: local draft in localStorage (reload-safe), explicit server
 *  save via POST. In viewer mode only the progress numbers are computed. */
function clientJs(fk: FkScenario, opts: TestLogPageOpts, total: number): string {
  const secSizes = fk.sections.map((s) => s.steps.length);
  const cfg = {
    fkId: fk.id,
    total,
    secSizes,
    viewer: opts.viewUser !== null,
    key: `tlog-${fk.id}-${opts.currentUser}`,
    msgFail: T(consoleLang(), "A mentés nem sikerült:"),
  };
  return `
(function(){
var CFG=${JSON.stringify(cfg)};
function boxes(){return Array.prototype.slice.call(document.querySelectorAll('.tlog-step input[type=checkbox]'));}
function cmts(){return Array.prototype.slice.call(document.querySelectorAll('textarea.tlog-cmt[data-si]'));}
function state(){
  return {checks:boxes().map(function(b){return b.checked;}),
    comments:cmts().map(function(t){return t.value;}),
    summary:(document.getElementById('tlsum')||{value:''}).value};
}
function refresh(){
  var chk=boxes(),done=0,gi=0;
  CFG.secSizes.forEach(function(n,si){
    var k=0;for(var j=0;j<n;j++){if(chk[gi+j]&&chk[gi+j].checked)k++;}
    gi+=n;done+=k;
    document.querySelectorAll('.tlog-cnt[data-si="'+si+'"],.tlog-mini[data-si="'+si+'"]').forEach(function(el){
      el.textContent=k+'/'+n;el.classList.toggle('done',k===n);});
  });
  ['tldone','tlmdone'].forEach(function(id){var el=document.getElementById(id);if(el)el.textContent=done;});
  ['tlfill','tlmfill'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.width=(100*done/CFG.total)+'%';});
}
if(CFG.viewer){refresh();return;}
try{
  var draft=JSON.parse(localStorage.getItem(CFG.key)||'null');
  if(draft){
    boxes().forEach(function(b,i){b.checked=!!draft.checks[i];});
    cmts().forEach(function(t,si){if(draft.comments[si]!=null)t.value=draft.comments[si];});
    var s=document.getElementById('tlsum');if(s&&draft.summary!=null)s.value=draft.summary;
  }
}catch(e){}
function persist(){try{localStorage.setItem(CFG.key,JSON.stringify(state()));}catch(e){}}
document.addEventListener('change',function(e){if(e.target.matches&&e.target.matches('.tlog-step input'))
  {persist();refresh();}});
document.addEventListener('input',function(e){if(e.target.matches&&e.target.matches('textarea.tlog-cmt'))persist();});
document.getElementById('tlsave').addEventListener('click',function(){
  var btn=this;btn.disabled=true;
  fetch('/test-log/'+encodeURIComponent(CFG.fkId)+'/save',{method:'POST',
    headers:{'content-type':'application/json'},body:JSON.stringify(state())})
  .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
  .then(function(j){
    var t=j.ts.slice(11,16);
    var srv=document.getElementById('tlsrv');srv.textContent=t;srv.className='ok';
    var ms=document.getElementById('tlmsave');if(ms)ms.textContent=t;
  })
  .catch(function(err){alert(CFG.msgFail+' '+err.message);})
  .finally(function(){btn.disabled=false;});
});
refresh();
})();`;
}
