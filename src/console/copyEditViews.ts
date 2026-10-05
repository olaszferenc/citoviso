// MOCK COPY — HAND EDIT (owner request 2026-10-04, ADR-0323). Approved plan, the contract:
// assets/design-refs/console/mock-copy-edit/ (A + B together, one save path).
//
//   A — the field form on the mock card ("A mock szövege — kézi átírás"): EVERY field,
//       the ones this template does not draw included (marked as such).
//   B — the curator preview (/artifact/:id/edit): the mock itself with an editor bar;
//       click a text, rewrite it in place. Only what the template SHOWS is editable there.
//
// Both post to /artifact/:id/copy → saveManualCopy (src/generator/copyManual.ts).
// The field model and the limits come from ONE place: src/engine/copyFields.ts.

import {
  COPY_LIMITS,
  COPY_SECTION_KINDS,
  copyFieldSpec,
  copyKeysFor,
  currentCopy,
  manualCopyOf,
  visibleCopyKeys,
  type CopyKey,
  type CopyValue,
} from "../engine/copyFields.js";
import type { Recipe, SiteData } from "../engine/recipe.js";
import { renderSite } from "../engine/render.js";
import { T } from "../i18n/mail.js";
import { ic } from "../ui/icons.js";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** JSON for an inline <script>: "</" must never close the script element. */
function scriptJson(v: unknown): string {
  return JSON.stringify(v).replace(/</g, "\\u003c");
}

function sectionName(kind: string, lang: string): string {
  switch (kind) {
    case "features":
      return T(lang, "Jellemzők");
    case "rooms":
      return T(lang, "Szobák");
    case "gallery":
      return T(lang, "Galéria");
    case "reviews":
      return T(lang, "Vélemények");
    case "faq":
      return T(lang, "Gyakori kérdések");
    default:
      return T(lang, "Elhelyezkedés");
  }
}

/** The operator's name for a field — used by the form, the preview bar and the pills. */
export function copyFieldLabel(key: CopyKey, lang: string): string {
  switch (key) {
    case "hero.lead":
      return T(lang, "Főcím");
    case "hero.accent":
      return T(lang, "Dőlt kiemelés a főcímben");
    case "hero.eyebrow":
      return T(lang, "Felső sor");
    case "tagline":
      return T(lang, "Alcím");
    case "intro":
      return T(lang, "Bemutatkozó bekezdés");
    case "highlights":
      return T(lang, "Kiemelések");
    default: {
      const [kind, field] = key.split(".") as [string, string];
      return field === "eyebrow"
        ? T(lang, "{s} — felső sor", { s: sectionName(kind, lang) })
        : T(lang, "{s} — cím", { s: sectionName(kind, lang) });
    }
  }
}

export function fieldWhere(key: CopyKey, lang: string): string {
  switch (key) {
    case "hero.lead":
      return T(lang, "a nyitóképen, a lap legolvasottabb sora");
    case "hero.accent":
      return T(lang, "a főcím egy szó szerinti része; üresen hagyva nincs dőlt rész");
    case "hero.eyebrow":
      return T(lang, "kis betűs sor a nyitó rész tetején");
    case "tagline":
      return T(lang, "a főcím alatt + a láblécben + a Google-találat leírásában");
    case "intro":
      return T(lang, "a bemutatkozó szakasz; egyes sablonok csak az első mondatát mutatják");
    case "highlights":
      return T(lang, "soronként egy; az üres sor kimarad");
    default:
      return key.endsWith(".title")
        ? T(lang, "a szakasz címe · az Enter sortörés (legfeljebb két sor)")
        : T(lang, "kis betűs sor a szakasz-cím fölött");
  }
}

export interface CopyEditModel {
  readonly recipe: Recipe;
  readonly siteData: SiteData;
  readonly keys: CopyKey[];
  /** null = could not be measured (render failed) → no "nem látszik" claim is made. */
  readonly visible: Set<CopyKey> | null;
  readonly manual: ReturnType<typeof manualCopyOf>;
}

/** The editable model of an artifact — null for an old artifact without a stored recipe. */
export function copyEditModel(inputs: Record<string, unknown>): CopyEditModel | null {
  const recipe = inputs.recipe as Recipe | undefined;
  const siteData = inputs.siteData as SiteData | undefined;
  if (!recipe || !siteData || !Array.isArray(recipe.sections)) return null;
  let visible: Set<CopyKey> | null = null;
  try {
    // MEASURED, not assumed: the hooks of a fresh render say what this template draws.
    visible = visibleCopyKeys(renderSite(recipe, siteData, { phase: "mock" }));
    if (visible.has("hero.lead")) visible.add("hero.accent");
  } catch {
    visible = null;
  }
  return { recipe, siteData, keys: copyKeysFor(recipe), visible, manual: manualCopyOf(inputs) };
}

/** "kézzel átírva · N mező" — the card header pill (④). Empty when nothing is hand-written. */
export function copyEditPill(inputs: Record<string, unknown>, lang: string): string {
  const n = Object.keys(manualCopyOf(inputs)).length;
  if (!n) return "";
  return `<span class="con-mkcopy__pill" data-cit-manual="${n}">${ic("texts", 12)}${esc(
    T(lang, "kézzel átírva · {n} mező", { n: String(n) }),
  )}</span>`;
}

const asText = (v: CopyValue): string => (Array.isArray(v) ? v.join("\n") : String(v));

/**
 * A — the field form (①). Server-rendered and complete without JS (a plain POST); the
 * script adds the live counters, the accent preview, the per-field revert and the
 * highlight rows.
 */
export function mockCopyEditBlock(
  artifactId: string,
  inputs: Record<string, unknown>,
  frozen: boolean,
  lang: string,
): string {
  const m = copyEditModel(inputs);
  if (!m) return "";
  const groups: { title: string; keys: CopyKey[] }[] = [
    { title: T(lang, "Nyitó rész"), keys: ["hero.lead", "hero.accent", "tagline", "hero.eyebrow"] },
    { title: T(lang, "Bemutatkozás"), keys: ["intro"] },
    { title: T(lang, "Kiemelések"), keys: ["highlights"] },
    {
      title: T(lang, "Szakasz-címek"),
      keys: m.keys.filter((k) => COPY_SECTION_KINDS.some((s) => k.startsWith(`${s}.`))),
    },
  ];
  const notShown = T(lang, "ezen a sablonon NEM látszik");
  const field = (key: CopyKey): string => {
    const spec = copyFieldSpec(key);
    const cur = currentCopy(m.recipe, m.siteData, key);
    const entry = m.manual[key];
    const orig = entry ? entry.orig : cur;
    const hidden = m.visible !== null && !m.visible.has(key);
    const id = `cmc-${artifactId.slice(0, 8)}-${key.replace(/\./g, "-")}`;
    const head = `<div class="con-mkcopy__top"><label for="${id}">${esc(copyFieldLabel(key, lang))}</label>
        <span class="con-mkcopy__hand" ${entry ? "" : "hidden"}>${ic("texts", 12)}${T(lang, "kézzel átírva")}</span></div>
      <div class="con-mkcopy__where">${esc(fieldWhere(key, lang))}${
        hidden ? ` · <b data-cit-notshown>${esc(notShown)}</b>` : ""
      }</div>`;
    const tail = `<div class="con-mkcopy__orig" ${entry ? "" : "hidden"}>${T(lang, "Eredeti (AI):")} „${esc(
      Array.isArray(orig) ? orig.join(" · ") : orig,
    )}”</div>
      <div class="con-mkcopy__msg" role="status"></div>
      <div class="con-mkcopy__foot">
        <button type="button" class="con-mkcopy__lnk" data-revert>${T(lang, "Eredeti visszaállítása")}</button>
        <span class="con-mkcopy__n"></span>
      </div>`;
    const common = `data-key="${esc(key)}" data-max="${spec.max}" data-req="${spec.required ? 1 : 0}" data-orig="${esc(
      JSON.stringify(orig),
    )}" data-saved="${esc(JSON.stringify(cur))}"`;
    if (key === "highlights") {
      const list = cur as readonly string[];
      return `<div class="con-mkcopy__f${hidden ? " is-hidden" : ""}" ${common} data-list="1" data-maxn="${COPY_LIMITS.highlightsMax}">
        ${head}
        <div class="con-mkcopy__hl" id="${id}">${list
          .map(
            (h, i) => `<div class="con-mkcopy__hlrow"><input name="c.highlights" value="${esc(h)}" aria-label="${esc(
              T(lang, "Kiemelés {n}", { n: String(i + 1) }),
            )}"><button type="button" class="con-mkcopy__x" data-hldel aria-label="${esc(T(lang, "Kiemelés törlése"))}">${ic(
              "close",
              14,
            )}</button></div>`,
          )
          .join("")}</div>
        <button type="button" class="con-mkcopy__add" data-hladd>${T(lang, "+ Új kiemelés")}</button>
        ${tail}</div>`;
    }
    const value = asText(cur);
    const control = spec.multiline || key === "hero.lead" || key === "tagline"
      ? `<textarea id="${id}" name="c.${esc(key)}" rows="${key === "intro" ? 5 : 2}">${esc(value)}</textarea>`
      : `<input id="${id}" name="c.${esc(key)}" value="${esc(value)}">`;
    return `<div class="con-mkcopy__f${hidden ? " is-hidden" : ""}" ${common}>${head}${control}${
      key === "hero.lead" ? `<div class="con-mkcopy__live" aria-live="polite"></div>` : ""
    }${tail}</div>`;
  };
  const body = groups
    .filter((g) => g.keys.length)
    .map(
      (g, gi) => `<details class="con-mkcopy__grp"${gi < 3 ? " open" : ""}><summary>${esc(g.title)}<span class="con-mkcopy__cnt" hidden></span></summary>
        <div class="con-mkcopy__grid${g.keys.length > 2 ? " two" : ""}">${g.keys.map(field).join("")}</div></details>`,
    )
    .join("");
  const n = Object.keys(m.manual).length;
  const verdictRow = n ? copyVerdictRow(inputs, lang) : "";
  const labels = {
    empty: T(lang, "Ez a mező nem lehet üres."),
    tooLong: T(lang, "Túl hosszú: legfeljebb {n} karakter fér el ezen a helyen."),
    hlEmpty: T(lang, "Legalább egy kiemelés kell."),
    hlOne: T(lang, "Egy kiemelés legfeljebb {n} karakter."),
    hlBlank: T(lang, "{n} üres sor mentéskor kimarad."),
    hlCount: T(lang, "{n} / {m} kiemelés"),
    accentMiss: T(lang, "Nincs benne szó szerint a főcímben — így dőlt rész nélkül jelenik meg."),
    shows: T(lang, "Így jelenik meg:"),
    none: T(lang, "Nincs változás — minden mező a mentett szöveg."),
    allOrig: T(lang, "Minden mező az eredeti AI-szöveg · mentés kell, hogy a mockon is visszaálljon."),
    changed: T(lang, "{n} mező változott, nincs mentve"),
    errors: T(lang, "{n} hiba — így nem menthető"),
    confirmAll: T(lang, "Minden kézzel átírt mező visszaáll az eredeti AI-szövegre (a mentéssel). Folytatja?"),
    saving: T(lang, "Mentés… az őrök futnak (~1 perc)"),
    rowLabel: T(lang, "Kiemelés {n}"),
    rowDel: T(lang, "Kiemelés törlése"),
    changedN: T(lang, "{n} átírva"),
  };
  return `<details class="con-mkcopy" id="copy-${esc(artifactId)}" data-cit-copyedit="${esc(artifactId)}">
    <summary>${ic("texts", 15)}${T(lang, "A mock szövege — kézi átírás")}${
      n ? `<span class="con-mkcopy__pill">${esc(T(lang, "kézzel átírva · {n} mező", { n: String(n) }))}</span>` : ""
    }</summary>
    <p class="con-mkcopy__lede">${T(
      lang,
      "Írja át, ami nem tetszik; a többi marad. A mentés csak a szöveget cseréli — kinézet, fotók, elrendezés változatlan. Amit kézzel ír, azért Ön felel: a tényhűség-kapu arra is lefut.",
    )}</p>
    ${
      frozen
        ? `<div class="con-mkcopy__frozen">${ic("lock", 16)}<span>${T(
            lang,
            "Ez a mock már ki lett ajánlva a leadnek — a szövege befagyott, nem írjuk át alatta. Generáljon új mockot, ha más szöveggel ajánlaná.",
          )}</span></div>`
        : ""
    }
    ${verdictRow}
    <form method="post" action="/artifact/${esc(artifactId)}/copy" class="con-mkcopy__form">
      <fieldset ${frozen ? "disabled" : ""}>${body}
      <div class="con-mkcopy__bar">
        <div class="con-mkcopy__sum" role="status">${T(lang, "Nincs változás — minden mező a mentett szöveg.")}</div>
        <button type="button" data-discard disabled>${T(lang, "Elvetem a változásokat")}</button>
        <button type="button" data-revert-all ${n ? "" : "disabled"}>${T(lang, "Minden mező vissza az eredetire")}</button>
        <button type="submit" class="ok" data-save disabled>${T(lang, "Mentés")}</button>
      </div></fieldset>
    </form>
    <p class="con-mkcopy__note">${T(
      lang,
      "A „Szöveg újragenerálása” (AI) a kézzel átírt mezőket nem írja felül — azok rögzítve maradnak, az AI csak a többit írja újra. Új mock generálásakor a kézi szöveg nem vándorol át.",
    )} <a href="/artifact/${esc(artifactId)}/edit" target="_blank">${T(lang, "szöveg szerkesztése ▸")}</a></p>
    <script type="application/json" data-cit-copy-labels>${scriptJson(labels)}</script>
  </details>`;
}

/** The guards' word on the SAVED hand-written text (⑦) — what the send gate will read. */
function copyVerdictRow(inputs: Record<string, unknown>, lang: string): string {
  const pill = (label: string, v: unknown): string => {
    if (typeof v !== "string") return "";
    const ok = v === "pass";
    const word = ok ? T(lang, "átment") : v === "flag" ? T(lang, "fennakadt") : T(lang, "nem ítélhető");
    return `<span class="con-mk__gate" data-verdict="${esc(v)}">${esc(label)}: ${esc(word)}</span>`;
  };
  const unsourced = Array.isArray(inputs.factUnsourced)
    ? (inputs.factUnsourced as unknown[]).filter((x): x is string => typeof x === "string" && x !== "")
    : [];
  const pills = [
    pill(T(lang, "Tényhűség"), inputs.factVerdict),
    pill(T(lang, "Marketing-őr"), inputs.marketVerdict),
    pill(T(lang, "Vendég-kritikus"), inputs.guestCriticVerdict),
  ].join("");
  return `<div class="con-mkcopy__gates"><span class="con-mkcopy__gl">${T(lang, "Az őrök a mentett szövegen:")}</span>${pills}${
    inputs.factVerdict !== "pass" && unsourced.length
      ? `<div class="con-mkcopy__why">${esc(T(lang, "Forrás nélküli állítás: {list}", { list: unsourced.join(", ") }))}</div>`
      : ""
  }</div>`;
}

/** One inline handler set for every copy block on the lead page (event delegation). */
export function mockCopyEditScript(): string {
  return `(function(){
  function norm(v){return String(v).replace(/[ \\t]+/g,' ').replace(/ *\\n */g,'\\n').trim();}
  function one(v){return String(v).replace(/\\s+/g,' ').trim();}
  function fmt(s,o){return String(s).replace(/\\{(\\w+)\\}/g,function(_,k){return o[k]!=null?o[k]:'';});}
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function L(box){try{return JSON.parse(box.querySelector('[data-cit-copy-labels]').textContent);}catch(_){return {};}}
  function valOf(f){
    if(f.getAttribute('data-list')){return [].map.call(f.querySelectorAll('input'),function(i){return one(i.value);}).filter(Boolean);}
    var c=f.querySelector('textarea,input'); var k=f.getAttribute('data-key');
    return /\\.title$/.test(k)||k==='intro'?norm(c.value):one(c.value);
  }
  function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
  function check(box){
    var lb=L(box), errors=0, dirty=0, changed=0;
    var fs=box.querySelectorAll('.con-mkcopy__f');
    var lead=box.querySelector('[data-key="hero.lead"]'), accent=box.querySelector('[data-key="hero.accent"]');
    fs.forEach(function(f){
      var v=valOf(f), orig=JSON.parse(f.getAttribute('data-orig')), saved=JSON.parse(f.getAttribute('data-saved'));
      var max=+f.getAttribute('data-max'), req=f.getAttribute('data-req')==='1', msg='', kind='', n=f.querySelector('.con-mkcopy__n');
      var isDirty=!same(v,saved);
      if(f.getAttribute('data-list')){
        var raw=[].map.call(f.querySelectorAll('input'),function(i){return one(i.value);});
        var blanks=raw.filter(function(x){return !x;}).length, maxn=+f.getAttribute('data-maxn');
        n.textContent=fmt(lb.hlCount,{n:v.length,m:maxn});
        if(isDirty){
          if(!v.length){msg=lb.hlEmpty;kind='bad';}
          else if(v.some(function(x){return x.length>max;})){msg=fmt(lb.hlOne,{n:max});kind='bad';}
          else if(blanks){msg=fmt(lb.hlBlank,{n:blanks});kind='warn';}
        }
        var add=f.querySelector('[data-hladd]'); if(add) add.disabled=raw.length>=maxn;
      } else {
        n.textContent=v.length+' / '+max; n.classList.toggle('over',v.length>max);
        if(isDirty){
          if(req&&!v){msg=lb.empty;kind='bad';}
          else if(v.length>max){msg=fmt(lb.tooLong,{n:max});kind='bad';}
        }
        if(f===accent&&v&&lead&&valOf(lead).indexOf(v)<0&&!kind){msg=lb.accentMiss;kind='warn';}
      }
      if(f===lead){var lv=f.querySelector('.con-mkcopy__live'), a=accent?valOf(accent):'', i=a?v.indexOf(a):-1;
        lv.innerHTML=esc(lb.shows)+' '+(i>=0?esc(v.slice(0,i))+'<em>'+esc(a)+'</em>'+esc(v.slice(i+a.length)):esc(v));}
      var m=f.querySelector('.con-mkcopy__msg'); m.textContent=msg; m.className='con-mkcopy__msg '+kind;
      f.classList.toggle('is-err',kind==='bad'); f.classList.toggle('is-dirty',isDirty);
      var ch=!same(v,orig); f.classList.toggle('is-changed',ch);
      f.querySelector('.con-mkcopy__hand').hidden=!ch; f.querySelector('.con-mkcopy__orig').hidden=!ch;
      f.querySelector('[data-revert]').disabled=!ch;
      if(kind==='bad')errors++; if(isDirty)dirty++; if(ch)changed++;
    });
    box.querySelectorAll('.con-mkcopy__grp').forEach(function(g){
      var c=g.querySelectorAll('.con-mkcopy__f.is-changed').length, p=g.querySelector('.con-mkcopy__cnt');
      p.hidden=!c; p.textContent=fmt(lb.changedN,{n:c});
    });
    var sum=box.querySelector('.con-mkcopy__sum');
    sum.textContent=!dirty?lb.none:(!changed?lb.allOrig:fmt(lb.changed,{n:dirty}))+(errors?' · '+fmt(lb.errors,{n:errors}):'');
    var fsd=box.querySelector('fieldset').disabled;
    box.querySelector('[data-save]').disabled=fsd||!dirty||errors>0;
    box.querySelector('[data-discard]').disabled=fsd||!dirty;
    box.querySelector('[data-revert-all]').disabled=fsd||!box.querySelector('.con-mkcopy__f.is-changed');
  }
  function setVal(f,v){
    if(f.getAttribute('data-list')){
      var lb=L(f.closest('.con-mkcopy')), box=f.querySelector('.con-mkcopy__hl'), tpl=box.querySelector('.con-mkcopy__hlrow');
      var x=tpl?tpl.querySelector('[data-hldel]').innerHTML:'';
      box.innerHTML=v.map(function(h,i){return '<div class="con-mkcopy__hlrow"><input name="c.highlights" value="'+esc(h)+'" aria-label="'+esc(fmt(lb.rowLabel,{n:i+1}))+'"><button type="button" class="con-mkcopy__x" data-hldel aria-label="'+esc(lb.rowDel)+'">'+x+'</button></div>';}).join('');
    } else { f.querySelector('textarea,input').value=Array.isArray(v)?v.join('\\n'):v; }
  }
  document.addEventListener('input',function(e){var b=e.target.closest('.con-mkcopy');if(b)check(b);});
  document.addEventListener('click',function(e){
    var b=e.target.closest('.con-mkcopy'); if(!b) return;
    var t=e.target.closest('button'); if(!t) return;
    var f=t.closest('.con-mkcopy__f');
    if(t.hasAttribute('data-revert')){setVal(f,JSON.parse(f.getAttribute('data-orig')));check(b);}
    else if(t.hasAttribute('data-hldel')){t.closest('.con-mkcopy__hlrow').remove();check(b);}
    else if(t.hasAttribute('data-hladd')){var cur=[].map.call(f.querySelectorAll('input'),function(i){return i.value;});cur.push('');setVal(f,cur);check(b);var ins=f.querySelectorAll('input');ins[ins.length-1].focus();}
    else if(t.hasAttribute('data-discard')){b.querySelectorAll('.con-mkcopy__f').forEach(function(x){setVal(x,JSON.parse(x.getAttribute('data-saved')));});check(b);}
    else if(t.hasAttribute('data-revert-all')){if(!confirm(L(b).confirmAll))return;b.querySelectorAll('.con-mkcopy__f').forEach(function(x){setVal(x,JSON.parse(x.getAttribute('data-orig')));});check(b);}
  });
  document.addEventListener('submit',function(e){
    var form=e.target.closest('.con-mkcopy__form'); if(!form) return;
    var b=form.closest('.con-mkcopy'); var s=b.querySelector('[data-save]');
    // A list that was emptied still has to reach the server as "empty" — not as "absent".
    if(!form.querySelector('input[name="c.highlights"]')){var h=document.createElement('input');h.type='hidden';h.name='c.highlights';h.value='';form.appendChild(h);}
    setTimeout(function(){s.disabled=true;s.textContent=L(b).saving;},0);
  });
  document.querySelectorAll('.con-mkcopy').forEach(function(b){
    check(b);
    // Back from a save (#copy-<id>): open the card and the block where the result is shown.
    if(location.hash==='#'+b.id){
      b.open=true; var card=b.closest('.con-mk'); var det=card&&card.querySelector('.con-mk__det');
      if(det&&det.hidden){var mb=card.querySelector('[data-mk-more]'); if(mb) mb.click();}
      b.scrollIntoView({block:'start'});
    }
  });
})();`;
}

// ── B — the preview editor ─────────────────────────────────────────────────────────────

/**
 * The editor bar + logic injected into a FRESH render of the artifact (the stored file
 * stays pure, and the /mock/ link — which the lead may receive — never carries it). The
 * bar re-declares the few design-core tokens it uses on ITS OWN root (the mock's :root
 * belongs to the skin), the same scoped mirror the operator pattern badge uses.
 */
export function copyEditorOverlay(
  artifactId: string,
  inputs: Record<string, unknown>,
  ctx: { frozen: boolean; leadName: string; templateLabel: string; backHref: string },
  lang: string,
): string {
  const m = copyEditModel(inputs);
  if (!m) return "";
  const fields: Record<string, unknown> = {};
  for (const k of m.keys) {
    const spec = copyFieldSpec(k);
    const entry = m.manual[k];
    const cur = currentCopy(m.recipe, m.siteData, k);
    fields[k] = {
      label: copyFieldLabel(k, lang),
      max: spec.max,
      required: spec.required,
      value: cur,
      orig: entry ? entry.orig : cur,
      manual: Boolean(entry),
    };
  }
  const hidden =
    m.visible === null
      ? []
      : m.keys
          .filter((k) => k !== "hero.accent" && !m.visible!.has(k) && asText(currentCopy(m.recipe, m.siteData, k)).trim())
          .map((k) => copyFieldLabel(k, lang));
  const cfg = {
    endpoint: `/artifact/${artifactId}/copy`,
    frozen: ctx.frozen,
    fields,
    highlightMax: COPY_LIMITS.highlightsMax,
    t: {
      on: T(lang, "Szöveg szerkesztése"),
      off: T(lang, "Szerkesztés befejezése"),
      frozen: T(lang, "Kiajánlva — a szöveg befagyott"),
      tapHint: T(lang, "Koppintson egy keretes szövegre"),
      keys: T(lang, "Enter = kész, Esc = elveti az adott mezőt."),
      changedN: T(lang, "{n} átírva"),
      unsaved: T(lang, "{n} nem mentett"),
      saved: T(lang, "mentve"),
      listHead: T(lang, "Kézzel átírva:"),
      details: T(lang, "Részletek"),
      close: T(lang, "Bezárom"),
      save: T(lang, "Mentés"),
      saving: T(lang, "Mentés… az őrök futnak (~1 perc)"),
      discard: T(lang, "Elvetem a változásokat"),
      revertAll: T(lang, "Minden mező vissza az eredetire"),
      confirmAll: T(lang, "Minden kézzel átírt mező visszaáll az eredeti AI-szövegre. Folytatja?"),
      revert: T(lang, "Eredeti visszaállítása"),
      done: T(lang, "Kész"),
      italic: T(lang, "Dőlt"),
      orig: T(lang, "Eredeti (AI):"),
      accentNow: T(lang, "Dőlt kiemelés:"),
      accentNone: T(lang, "nincs"),
      accentHint: T(lang, "jelöljön ki egy részt, és nyomja meg a „Dőlt” gombot."),
      selectFirst: T(lang, "Előbb jelöljön ki egy részt a főcímben."),
      contiguous: T(lang, "A kiemelés csak a főcím egy összefüggő része lehet."),
      empty: T(lang, "Ez a mező nem lehet üres — írjon be szöveget, vagy állítsa vissza az eredetit."),
      tooLong: T(lang, "Túl hosszú: legfeljebb {n} karakter fér el ezen a helyen."),
      firstSentence: T(
        lang,
        "Ez a sablon a bemutatkozónak csak az ELSŐ mondatát mutatja. Amit itt ír, az első mondatot cseréli; a többi megmarad.",
      ),
      tagline: T(lang, "Ez a szöveg a láblécben és a Google-találat leírásában is megjelenik."),
      hlRemoved: T(lang, "Az üres kiemelés mentéskor kimarad."),
      hand: T(lang, "kézzel átírva"),
      gatesRun: T(lang, "Őrök: fut…"),
      gatesOk: T(lang, "Őrök: átment"),
      gatesBad: T(lang, "{n} őr fennakadt"),
      fact: T(lang, "Tényhűség"),
      market: T(lang, "Marketing-őr"),
      critic: T(lang, "Vendég-kritikus"),
      pass: T(lang, "átment"),
      flag: T(lang, "fennakadt"),
      error: T(lang, "nem ítélhető"),
      unsourced: T(lang, "Forrás nélküli állítás: {list} — így nem küldhető ki; javítsa, vagy nyugtázza a kiküldésnél."),
      failed: T(lang, "A mentés nem sikerült:"),
      hidden: hidden.length
        ? T(lang, "Ezen a sablonon NEM látszik, ezért itt nem írható át: {list}. Ezek a kártya „A mock szövege — kézi átírás” blokkjában szerkeszthetők.", {
            list: hidden.join(", "),
          })
        : "",
      none: T(lang, "Ezen a mockon nincs horgolt szöveg — a kártya „A mock szövege — kézi átírás” blokkjában írható át."),
    },
  };
  const pen = ic("texts", 14);
  return `
<style data-cit-copyedit>${EDITOR_CSS}</style>
<div class="cit-ced cit-ced-bar" id="cit-ced-bar" data-cit-ced>
  <div class="cit-ced-ttl">${esc(T(lang, "Mock-előnézet · {name}", { name: ctx.leadName }))}<small>${esc(
    T(lang, "{tpl} · a kurátor nézete, a lead nem látja a sávot", { tpl: ctx.templateLabel }),
  )}</small></div>
  <a class="cit-ced-btn" href="${esc(ctx.backHref)}">${esc(T(lang, "Vissza a leadhez"))}</a>
  <button class="cit-ced-btn" id="cit-ced-toggle" type="button" aria-pressed="false">${pen}<span>${esc(
    T(lang, "Szöveg szerkesztése"),
  )}</span></button>
</div>
<div class="cit-ced cit-ced-foot" id="cit-ced-foot" role="region" aria-label="${esc(T(lang, "Kézi szöveg-átírás"))}" data-cit-ced>
  <div class="cit-ced-row cit-ced-main">
    <div class="cit-ced-sum" id="cit-ced-sum"></div>
    <span class="cit-ced-g" id="cit-ced-gsum" hidden></span>
    <button class="cit-ced-btn ghost cit-ced-more-t" id="cit-ced-more-t" type="button" aria-expanded="false" aria-controls="cit-ced-more">${esc(
      T(lang, "Részletek"),
    )}</button>
    <button class="cit-ced-btn solid" id="cit-ced-save" type="button" disabled>${esc(T(lang, "Mentés"))}</button>
  </div>
  <div class="cit-ced-more" id="cit-ced-more">
    <div class="cit-ced-list" id="cit-ced-list"></div>
    <div class="cit-ced-gates" id="cit-ced-gates"></div>
    <div class="cit-ced-row cit-ced-acts">
      <button class="cit-ced-btn ghost" id="cit-ced-discard" type="button" disabled>${esc(T(lang, "Elvetem a változásokat"))}</button>
      <button class="cit-ced-btn ghost" id="cit-ced-revert-all" type="button">${esc(T(lang, "Minden mező vissza az eredetire"))}</button>
    </div>
    <div class="cit-ced-hid" id="cit-ced-hid"></div>
  </div>
</div>
<script type="application/json" id="cit-ced-cfg">${scriptJson(cfg)}</script>
<script data-cit-copyedit>${EDITOR_JS}</script>`;
}

/** Scoped token mirror — values from public/assets/ui/citui.css (design-token-lint ALLOW). */
const EDITOR_CSS = `
.cit-ced{
  --citui-navy-950:#0a1f36; --citui-navy-900:#0e2a47; --citui-cyan-500:#1fb6d6; --citui-ink:#10243a;
  --citui-muted:#60748b; --citui-warn:#d29922; --citui-warn-ink:#7d5a12; --citui-bad:#e5484d; --citui-bad-ink:#b3262b;
  --citui-ok-ink:#19733f; --citui-ok-soft:#e7f8ef; --citui-surface-2:#eef7fa; --citui-link-ink:#10697a;
  --citui-radius-pill:999px; --citui-radius-sm:14px;
  --citui-font-text:"Inter",system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  font-family:var(--citui-font-text); line-height:1.35; -webkit-font-smoothing:antialiased;
  box-sizing:border-box; margin:0 !important; float:none !important; transform:none !important;}
.cit-ced-bar,.cit-ced-foot{left:0 !important; right:0 !important; z-index:2147483000 !important;}
.cit-ced *{box-sizing:border-box; font-family:inherit;}
.cit-ced-bar{position:fixed !important; top:0 !important; bottom:auto !important; display:flex; gap:10px; align-items:center;
  flex-wrap:wrap; padding:8px 12px; color:#fff; font-size:13px; font-weight:600;
  background:linear-gradient(90deg, var(--citui-navy-900), var(--citui-navy-950));
  box-shadow:0 6px 18px rgba(0,0,0,.25);}
.cit-ced-ttl{flex:1 1 160px; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
.cit-ced-ttl small{display:block; font-weight:400; font-size:11px; opacity:.72;}
.cit-ced-btn{font:600 13px/1 var(--citui-font-text); padding:9px 13px; border-radius:var(--citui-radius-pill);
  border:1px solid rgba(255,255,255,.35); background:transparent; color:#fff; cursor:pointer; display:inline-flex;
  gap:6px; align-items:center; text-decoration:none; white-space:nowrap;}
.cit-ced-btn[aria-pressed="true"]{background:var(--citui-cyan-500); border-color:var(--citui-cyan-500); color:var(--citui-navy-950);}
.cit-ced-btn.ghost{color:var(--citui-navy-900); border-color:color-mix(in srgb, var(--citui-navy-900) 25%, transparent); background:#fff;}
.cit-ced-btn.solid{background:var(--citui-navy-900); color:#fff; border-color:var(--citui-navy-900);}
.cit-ced-btn[disabled]{opacity:.5; cursor:not-allowed;}
html.cit-ced-on body{margin-top:54px !important;}
html.cit-ced-edit [data-cit-copy]{outline:2px dashed color-mix(in srgb, var(--citui-cyan-500) 85%, transparent) !important;
  outline-offset:4px; cursor:text; border-radius:3px; opacity:1 !important; transform:none !important; visibility:visible !important;}
html.cit-ced-edit [data-cit-copy]:hover{outline-style:solid !important;}
[data-cit-copy].cit-ced-changed{outline:2px solid var(--citui-warn) !important; outline-offset:4px;}
[data-cit-copy].cit-ced-active{outline:3px solid var(--citui-cyan-500) !important;}
[data-cit-copy].cit-ced-err{outline:3px solid var(--citui-bad) !important;}
.cit-ced-tag{position:absolute !important; z-index:2147482999 !important; font:700 10px/1 var(--citui-font-text, sans-serif);
  letter-spacing:.04em; text-transform:uppercase; padding:3px 6px; border-radius:999px; pointer-events:none; white-space:nowrap;
  background:#d29922; color:#2b1d00;}
.cit-ced-pop{position:absolute !important; z-index:2147483001 !important; background:#fff; color:var(--citui-ink);
  border-radius:var(--citui-radius-sm); box-shadow:0 12px 30px rgba(14,42,71,.28); padding:10px 12px; font-size:13px;
  line-height:1.45; width:min(340px, calc(100vw - 24px)); border:1px solid color-mix(in srgb, var(--citui-navy-900) 14%, transparent);}
.cit-ced-pop .cit-ced-row{display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:8px;}
.cit-ced-pop .cit-ced-cnt{margin-left:auto; color:var(--citui-muted); font-size:12px;}
.cit-ced-pop .cit-ced-cnt.over{color:var(--citui-bad-ink); font-weight:700;}
.cit-ced-pop .cit-ced-orig{margin-top:6px; font-size:12px; color:var(--citui-muted); background:var(--citui-surface-2); border-radius:8px; padding:6px 8px;}
.cit-ced-pop .cit-ced-msg{margin-top:6px; font-size:12px; font-weight:600;}
.cit-ced-pop .cit-ced-msg.bad{color:var(--citui-bad-ink);}
.cit-ced-pop .cit-ced-msg.warn{color:var(--citui-warn-ink);}
.cit-ced-pop .cit-ced-btn{padding:7px 11px; font-size:12px;}
.cit-ced-foot{position:fixed !important; bottom:0 !important; top:auto !important; background:#fff; color:var(--citui-ink);
  border-top:1px solid color-mix(in srgb, var(--citui-navy-900) 15%, transparent); box-shadow:0 -8px 24px rgba(14,42,71,.14);
  padding:8px 12px; font-size:13px; line-height:1.4; display:none;}
html.cit-ced-edit .cit-ced-foot, html.cit-ced-saved .cit-ced-foot{display:block;}
html.cit-ced-edit body, html.cit-ced-saved body{padding-bottom:72px !important;}
.cit-ced-row{display:flex; gap:8px; align-items:center; flex-wrap:wrap;}
.cit-ced-main{flex-wrap:nowrap;}
.cit-ced-sum{flex:1 1 auto; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
.cit-ced-more{display:none; max-height:45vh; overflow:auto; border-top:1px solid color-mix(in srgb, var(--citui-navy-900) 10%, transparent);
  margin-top:8px; padding-top:6px;}
.cit-ced-foot.open .cit-ced-more{display:block;}
.cit-ced-list,.cit-ced-hid{font-size:12px; color:var(--citui-muted); margin-top:6px;}
.cit-ced-acts{margin-top:8px;}
.cit-ced-gates{display:flex; gap:6px; flex-wrap:wrap; margin-top:6px;}
.cit-ced-g{font:700 11px/1 var(--citui-font-text); padding:4px 8px; border-radius:999px; background:var(--citui-surface-2);
  color:var(--citui-ink); display:inline-flex; gap:5px; align-items:center; white-space:nowrap;}
.cit-ced-g[hidden]{display:none !important;}
.cit-ced-g::before{content:""; width:7px; height:7px; border-radius:50%; background:currentColor;}
.cit-ced-g.ok{background:var(--citui-ok-soft); color:var(--citui-ok-ink);}
.cit-ced-g.bad{background:color-mix(in srgb, var(--citui-bad) 12%, #fff); color:var(--citui-bad-ink);}
.cit-ced-g.run{background:color-mix(in srgb, var(--citui-cyan-500) 14%, #fff); color:var(--citui-link-ink);}
.cit-ced-why{flex-basis:100%; font-size:12px; color:var(--citui-bad-ink);}
@media (min-width:760px){
  .cit-ced-more-t{display:none !important;}
  #cit-ced-gsum{display:none !important;}
  .cit-ced-foot .cit-ced-more{display:block; border-top:0; margin-top:2px; padding-top:0; max-height:none;}
  html.cit-ced-edit body, html.cit-ced-saved body{padding-bottom:140px !important;}
}`;

/** The editor itself. All words come from the JSON config (rendered through T()). */
const EDITOR_JS = `(function(){
  var cfg; try{cfg=JSON.parse(document.getElementById('cit-ced-cfg').textContent);}catch(_){return;}
  var t=cfg.t, root=document.documentElement;
  root.classList.add('cit-ced-on');
  function $(id){return document.getElementById(id);}
  // The bar wraps to two rows on a phone — push the page by its MEASURED height, not a constant.
  function pushDown(){var h=$('cit-ced-bar').offsetHeight; document.body.style.setProperty('margin-top',h+'px','important');}
  pushDown(); window.addEventListener('resize',pushDown);
  function fmt(s,o){return String(s).replace(/\\{(\\w+)\\}/g,function(_,k){return o[k]!=null?o[k]:'';});}
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function one(s){return String(s).replace(/\\s+/g,' ').trim();}
  // Same rule as templateKit.firstSentence (the template's derived view).
  function firstOf(s){var m=/^[^.!?]*[.!?]/.exec(String(s).trim());return (m?m[0]:String(s)).trim();}
  var toggle=$('cit-ced-toggle'), foot=$('cit-ced-foot'), moreT=$('cit-ced-more-t');
  $('cit-ced-hid').textContent=t.hidden||'';
  var items=[].map.call(document.querySelectorAll('[data-cit-copy]'),function(el){
    var key=el.getAttribute('data-cit-copy'), f=cfg.fields[key]; if(!f) return null;
    var it={el:el,key:key,f:f,i:el.hasAttribute('data-cit-copy-i')?+el.getAttribute('data-cit-copy-i'):null,
      part:el.getAttribute('data-cit-copy-part'),title:/\\.title$/.test(key)};
    it.savedHTML=el.innerHTML; it.saved=read(it); it.orig=origOf(it); return it;
  }).filter(Boolean);
  if(!items.length){$('cit-ced-hid').textContent=t.none; toggle.disabled=true;}
  if(cfg.frozen){toggle.disabled=true; toggle.querySelector('span').textContent=t.frozen;}
  function read(it){
    // NOT innerText: it returns the RENDERED text, CSS text-transform included — an
    // uppercase kicker would be saved in capitals (measured on the first e2e run). The
    // DOM text, with <br> as a line break and a gap between block children, instead.
    var c=it.el.cloneNode(true);
    c.querySelectorAll('br').forEach(function(b){b.replaceWith('\\n');});
    c.querySelectorAll('p,div,li').forEach(function(b){b.append(' ');});
    var raw=c.textContent;
    if(it.title) return raw.split('\\n').map(one).filter(Boolean).slice(0,2).join('\\n');
    return one(raw);
  }
  function origOf(it){
    var o=it.f.orig;
    if(it.key==='highlights') return Array.isArray(o)&&o[it.i]!=null?o[it.i]:'';
    if(it.part==='first-sentence') return firstOf(o);
    return Array.isArray(o)?o.join(' '):String(o);
  }
  function accentOf(it){var e=it.el.querySelector('em');return e?one(e.textContent):'';}
  function isChanged(it){
    if(one(read(it))!==one(it.orig)) return true;
    return it.key==='hero.lead'&&accentOf(it)!==one((cfg.fields['hero.accent']||{}).orig||'');
  }
  function isDirty(it){return it.el.innerHTML!==it.savedHTML;}
  var editing=false, active=null, pop=null, savedOnce=false;
  function tagOf(it){if(!it.tag){it.tag=document.createElement('span');it.tag.className='cit-ced cit-ced-tag';it.tag.textContent=t.hand;document.body.appendChild(it.tag);}return it.tag;}
  function marked(it){return isChanged(it);}
  function placeTags(){
    items.forEach(function(it){
      var ch=marked(it); it.el.classList.toggle('cit-ced-changed',!!ch);
      if(ch&&(editing||savedOnce)&&it.el.offsetParent!==null){var r=it.el.getBoundingClientRect(),g=tagOf(it);g.style.display='block';
        g.style.top=(r.top+window.scrollY-14)+'px';g.style.left=Math.max(4,Math.min(r.left+window.scrollX,document.documentElement.clientWidth-110))+'px';}
      else if(it.tag) it.tag.style.display='none';
    });
  }
  function summary(){
    var ch=items.filter(marked), dirty=items.filter(isDirty);
    $('cit-ced-sum').innerHTML=!ch.length&&!dirty.length?'<b>'+esc(t.tapHint)+'</b>':
      '<b>'+esc(fmt(t.changedN,{n:ch.length}))+'</b> · '+esc(dirty.length?fmt(t.unsaved,{n:dirty.length}):t.saved);
    var names=[]; ch.forEach(function(it){var n=it.f.label+(it.i!=null?' '+(it.i+1):''); if(names.indexOf(n)<0) names.push(n);});
    $('cit-ced-list').textContent=ch.length?t.listHead+' '+names.join(', '):t.keys;
    $('cit-ced-save').disabled=!dirty.length||!!active;
    $('cit-ced-discard').disabled=!dirty.length;
    $('cit-ced-revert-all').disabled=!Object.keys(cfg.fields).some(function(k){return cfg.fields[k].manual;})&&!items.some(isChanged);
    placeTags();
  }
  function setEdit(on){
    editing=on; root.classList.toggle('cit-ced-edit',on); toggle.setAttribute('aria-pressed',on?'true':'false');
    toggle.querySelector('span').textContent=on?t.off:t.on;
    if(!on&&active) finish(true);
    summary();
  }
  toggle.addEventListener('click',function(){setEdit(!editing);});
  moreT.addEventListener('click',function(){var o=!foot.classList.contains('open');foot.classList.toggle('open',o);moreT.setAttribute('aria-expanded',o?'true':'false');moreT.textContent=o?t.close:t.details;});
  function closePop(){if(pop){pop.remove();pop=null;}}
  function showPop(it,msg,kind){
    closePop(); pop=document.createElement('div'); pop.className='cit-ced cit-ced-pop'; pop.setAttribute('role','dialog');
    var len=read(it).length, max=it.f.max, over=len>max;
    var orig=one(it.orig)!==one(read(it))?'<div class="cit-ced-orig">'+esc(t.orig)+' „'+esc(it.orig)+'”</div>':'';
    var acc=it.key==='hero.lead'?'<div class="cit-ced-orig">'+esc(t.accentNow)+' '+(accentOf(it)?'„'+esc(accentOf(it))+'”':'<i>'+esc(t.accentNone)+'</i>')+' — '+esc(t.accentHint)+'</div>':'';
    pop.innerHTML='<b>'+esc(it.f.label+(it.i!=null?' '+(it.i+1):''))+'</b>'+orig+acc+(msg?'<div class="cit-ced-msg '+(kind||'')+'">'+esc(msg)+'</div>':'')+
      '<div class="cit-ced-row">'+(it.key==='hero.lead'?'<button type="button" class="cit-ced-btn ghost" data-a="em"><i>'+esc(t.italic)+'</i></button>':'')+
      '<button type="button" class="cit-ced-btn ghost" data-a="orig"'+(one(it.orig)!==one(read(it))?'':' disabled')+'>'+esc(t.revert)+'</button>'+
      '<button type="button" class="cit-ced-btn solid" data-a="done">'+esc(t.done)+'</button><span class="cit-ced-cnt'+(over?' over':'')+'">'+len+' / '+max+'</span></div>';
    document.body.appendChild(pop);
    var r=it.el.getBoundingClientRect(), w=pop.offsetWidth, vw=document.documentElement.clientWidth;
    pop.style.left=Math.max(12,Math.min(r.left+window.scrollX,vw-w-12))+'px';
    pop.style.top=(r.bottom+window.scrollY+10)+'px';
    pop.addEventListener('mousedown',function(e){e.preventDefault();});
    pop.addEventListener('click',function(e){
      var b=e.target.closest('button'); if(!b) return; var a=b.getAttribute('data-a');
      if(a==='done') finish(false);
      else if(a==='orig'){setText(it,it.orig,it.key==='hero.lead'?(cfg.fields['hero.accent']||{}).orig:'');showPop(it,'','');summary();}
      else if(a==='em') makeEm(it);
    });
  }
  function setText(it,text,accent){
    if(accent&&text.indexOf(accent)>=0){var i=text.indexOf(accent);it.el.innerHTML=esc(text.slice(0,i))+'<em>'+esc(accent)+'</em>'+esc(text.slice(i+accent.length));}
    else if(it.title) it.el.innerHTML=String(text).split('\\n').map(esc).join('<br>');
    else it.el.textContent=text;
  }
  function makeEm(it){
    var sel=window.getSelection(); if(!sel.rangeCount||sel.isCollapsed){showPop(it,t.selectFirst,'warn');return;}
    var txt=one(sel.toString()), plain=read(it);
    if(!txt||plain.indexOf(txt)<0){showPop(it,t.contiguous,'warn');return;}
    setText(it,plain,txt); showPop(it,'',''); summary();
  }
  function start(it){
    if(active===it) return; if(active&&!finish(false)) return;
    active=it; it.before=it.el.innerHTML; it.el.classList.add('cit-ced-active');
    it.el.setAttribute('contenteditable',it.key==='hero.lead'?'true':'plaintext-only');
    if(it.el.contentEditable!=='plaintext-only'&&it.key!=='hero.lead') it.el.setAttribute('contenteditable','true');
    it.el.focus();
    showPop(it,it.part==='first-sentence'?t.firstSentence:(it.key==='tagline'?t.tagline:''),it.part?'warn':'');
    $('cit-ced-save').disabled=true;
  }
  function finish(force){
    var it=active; if(!it) return true;
    var v=read(it);
    if(!force&&!v&&it.f.required&&it.key!=='highlights'){it.el.classList.add('cit-ced-err');showPop(it,t.empty,'bad');return false;}
    if(!force&&v.length>it.f.max){it.el.classList.add('cit-ced-err');showPop(it,fmt(t.tooLong,{n:it.f.max}),'bad');return false;}
    if(force&&((!v&&it.f.required&&it.key!=='highlights')||v.length>it.f.max)) it.el.innerHTML=it.before;
    // Normalise to plain text (+ the one <em> accent of the hero lead). Retyping the whole
    // headline drops the <em>: the saved accent is carried over while it is still a verbatim
    // part of the new words — the same rule as the critic's rewrite (guestCritic carryAccent).
    var acc=it.key==='hero.lead'?accentOf(it):'';
    if(it.key==='hero.lead'&&!acc){var prev=one((cfg.fields['hero.accent']||{}).value||'');if(prev&&read(it).indexOf(prev)>=0)acc=prev;}
    setText(it,read(it),acc);
    it.el.removeAttribute('contenteditable'); it.el.classList.remove('cit-ced-active','cit-ced-err');
    // Same field shown twice (tagline in the hero AND the footer): mirror the words.
    items.forEach(function(o){if(o!==it&&o.key===it.key&&o.i===it.i&&o.part===it.part){o.el.innerHTML=it.el.innerHTML;}});
    active=null; closePop(); summary(); return true;
  }
  items.forEach(function(it){
    it.el.addEventListener('click',function(e){if(!editing) return; e.preventDefault(); e.stopPropagation(); start(it);},true);
    it.el.addEventListener('keydown',function(e){
      if(e.key==='Enter'&&!(it.title&&e.shiftKey)){e.preventDefault();finish(false);}
      else if(e.key==='Escape'){e.preventDefault();it.el.innerHTML=it.before;finish(true);}
    });
    it.el.addEventListener('input',function(){it.el.classList.remove('cit-ced-err');
      if(pop){var c=pop.querySelector('.cit-ced-cnt'),n=read(it).length;c.textContent=n+' / '+it.f.max;c.classList.toggle('over',n>it.f.max);}
      placeTags();});
    it.el.addEventListener('paste',function(e){e.preventDefault();var s=(e.clipboardData||window.clipboardData).getData('text/plain').replace(/\\s+/g,' ');document.execCommand('insertText',false,s);});
  });
  document.addEventListener('click',function(e){if(!active) return; if(e.target.closest('.cit-ced-pop')||e.target.closest('[data-cit-copy]')) return; finish(false);},true);
  // Links inside the mock must not navigate while editing.
  document.addEventListener('click',function(e){if(editing&&e.target.closest('a')&&!e.target.closest('[data-cit-ced]')) e.preventDefault();},true);
  window.addEventListener('resize',placeTags); window.addEventListener('scroll',placeTags,{passive:true});
  /** The fields to post: every key with a dirty element, rebuilt to its FULL value. */
  function collect(all){
    var out={}, hl=null;
    items.forEach(function(it){
      if(!all&&!isDirty(it)) return;
      var v=read(it);
      if(it.key==='highlights'){
        if(!hl) hl=(cfg.fields.highlights.value||[]).slice();
        hl[it.i]=v; return;
      }
      if(it.part==='first-sentence'){
        var full=String(cfg.fields.intro.value||''), first=firstOf(full);
        out.intro=one(v+' '+full.trim().slice(first.length)); return;
      }
      out[it.key]=v;
      if(it.key==='hero.lead') out['hero.accent']=accentOf(it);
    });
    if(hl) out.highlights=hl.filter(function(x){return one(x);});
    return out;
  }
  function post(values){
    var body=new URLSearchParams();
    Object.keys(values).forEach(function(k){
      var v=values[k];
      if(Array.isArray(v)){ if(!v.length) body.append('c.'+k,''); v.forEach(function(x){body.append('c.'+k,x);}); }
      else body.append('c.'+k,v);
    });
    return fetch(cfg.endpoint,{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/x-www-form-urlencoded'},body:body.toString(),credentials:'same-origin'})
      .then(function(r){return r.json();});
  }
  function gates(res){
    var g=$('cit-ced-gates'), gs=$('cit-ced-gsum'), v=res.verdicts||{};
    function p(label,x){if(!x) return ''; return '<span class="cit-ced-g '+(x==='pass'?'ok':'bad')+'">'+esc(label)+': '+esc(t[x]||x)+'</span>';}
    var bad=['fact','market','critic'].filter(function(k){return v[k]&&v[k]!=='pass';}).length;
    g.innerHTML=p(t.fact,v.fact)+p(t.market,v.market)+p(t.critic,v.critic)+
      (res.factUnsourced&&res.factUnsourced.length&&v.fact!=='pass'?'<div class="cit-ced-why">'+esc(fmt(t.unsourced,{list:res.factUnsourced.join(', ')}))+'</div>':'');
    gs.hidden=false; gs.className='cit-ced-g '+(bad?'bad':'ok'); gs.textContent=bad?fmt(t.gatesBad,{n:bad}):t.gatesOk;
  }
  $('cit-ced-save').addEventListener('click',function(){
    if(active&&!finish(false)) return;
    var values=collect(false); if(!Object.keys(values).length) return;
    var b=$('cit-ced-save'); b.disabled=true; b.textContent=t.saving;
    var gs=$('cit-ced-gsum'); gs.hidden=false; gs.className='cit-ced-g run'; gs.textContent=t.gatesRun;
    post(values).then(function(res){
      b.textContent=t.save;
      if(!res.ok){gs.className='cit-ced-g bad'; gs.textContent=t.failed; $('cit-ced-gates').innerHTML='<div class="cit-ced-why">'+esc(res.message||'')+'</div>';summary();return;}
      // The server's word is the truth now: saved = what is on screen, manual = its list.
      Object.keys(values).forEach(function(k){if(cfg.fields[k]) cfg.fields[k].value=values[k];});
      (res.manualKeys||[]).forEach(function(k){if(cfg.fields[k]) cfg.fields[k].manual=true;});
      Object.keys(cfg.fields).forEach(function(k){if(res.manualKeys&&res.manualKeys.indexOf(k)<0) cfg.fields[k].manual=false;});
      items.forEach(function(it){it.savedHTML=it.el.innerHTML;});
      savedOnce=true; root.classList.add('cit-ced-saved'); gates(res); summary();
    }).catch(function(err){b.textContent=t.save;gs.className='cit-ced-g bad';gs.textContent=t.failed;summary();});
  });
  $('cit-ced-discard').addEventListener('click',function(){if(active) finish(true); items.forEach(function(it){it.el.innerHTML=it.savedHTML;}); summary();});
  $('cit-ced-revert-all').addEventListener('click',function(){
    if(!confirm(t.confirmAll)) return;
    if(active) finish(true);
    var values={}; Object.keys(cfg.fields).forEach(function(k){var f=cfg.fields[k]; if(f.manual) values[k]=f.orig;});
    var b=$('cit-ced-save'); b.disabled=true; b.textContent=t.saving;
    post(values).then(function(){location.reload();}).catch(function(){location.reload();});
  });
  summary();
})();`;
