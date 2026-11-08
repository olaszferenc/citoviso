// The partner sheet's „Üzenetváltások” tab — the approved M1 chat thread
// (assets/design-refs/console/partner-adatlap/JOVAHAGYOTT-M1-uzenetvaltasok.html, ADR-0421).
// Ours on the right, the partner's on the left, the system mails as collapsible cards; the
// composer under the thread. Works without JS (plain POST + redirect); with JS the send is a
// fetch, the new bubble appears at once and a queued SMS follows its state.

import { esc } from "./views.js";
import { icAdmin as ic } from "../ui/icons.js";
import { T } from "../i18n/mail.js";
import { consoleLang } from "./i18nCtx.js";
import { prettyPhone } from "../text/phone.js";
import { budapestIsoDay } from "../text/budapestTime.js";
import { GSM7_BASIC } from "../sms/encoding.js";
import { SMS_MAX_PARTS, SMS_SIGNATURE } from "../replies/answerRules.js";
import { fmtTime } from "./partnerProfileViews.js";
import type { PartnerThread, ThreadMessage } from "./partnerMessages.js";

export type MessageFilter = "all" | "email" | "sms" | "mine" | "sys";
export const MESSAGE_FILTERS: readonly MessageFilter[] = ["all", "email", "sms", "mine", "sys"];

export interface ComposeState {
  readonly values?: Readonly<Record<string, string>>;
  readonly problems?: Readonly<Record<string, string>>;
  /** After a no-JS send: the outcome line under the button. */
  readonly flash?: { readonly ok: boolean; readonly text: string } | null;
}

const addr = (a: string) => (a.startsWith("+") ? prettyPhone(a) : a);

function passes(m: ThreadMessage, f: MessageFilter): boolean {
  return (
    f === "all" ||
    (f === "email" && m.channel === "email") ||
    (f === "sms" && m.channel !== "email") ||
    (f === "mine" && m.source === "manual") ||
    (f === "sys" && m.source === "system")
  );
}

/** ADR-0430: a Viber / WhatsApp message names its app (product names, not translated). */
function viaApp(m: ThreadMessage): string {
  return m.channel === "viber" ? " · Viber" : m.channel === "whatsapp" ? " · WhatsApp" : "";
}

function sourceLabel(m: ThreadMessage, lang: string): string {
  switch (m.source) {
    case "outreach":
      return `${T(lang, "Megkeresés")}${viaApp(m)}`;
    case "reply":
      return `${T(lang, "Válasz a megkeresésre")}${viaApp(m)}`;
    case "answer":
      return `${T(lang, "Válasz a válaszra")}${viaApp(m)}`;
    case "manual":
      return T(lang, "Kézi üzenet");
    case "system":
      return `${T(lang, "Rendszerlevél")}${m.kind ? ` · ${m.kind}` : ""}`;
    case "inbound":
      return m.channel === "email" ? T(lang, "Bejövő levél") : T(lang, "Bejövő SMS");
  }
}

function chip(m: ThreadMessage, lang: string): string {
  if (m.dir !== "out" || !m.status) return "";
  const txt =
    m.status === "sent"
      ? T(lang, "elküldve")
      : m.status === "queued"
        ? m.channel === "viber" || m.channel === "whatsapp"
          ? T(lang, "sorban — a telefon beírja a csevegésbe")
          : T(lang, "sorban — a modem-sáv viszi ki")
        : m.status === "scheduled"
          ? `${T(lang, "ütemezve")}${m.scheduledFor ? ` ${fmtTime(m.scheduledFor).slice(5)}` : ""}`
          : T(lang, "nem ment ki");
  return `<span class="mx-chip mx-chip--${m.status}" data-mx-status="${m.status}">${esc(txt)}</span>`;
}

/** One bubble — also returned on its own to the JS send / status poll. */
export function messageBubble(m: ThreadMessage, partnerId: string, partnerName: string, fresh = false): string {
  const lang = consoleLang();
  const icon = ic(m.channel === "email" ? "mail" : m.channel === "mms" ? "photos" : "sms", 14);
  const sys = m.source === "system";
  const who =
    m.dir === "in"
      ? `${partnerName} · ${addr(m.address)}`
      : `${sourceLabel(m, lang)}${m.source === "manual" && m.by ? ` · ${m.by}` : ""} → ${addr(m.address)}`;
  // Theirs: who + where from (the mock's „Rebeka Szego · +36 …”); a non-reply inbound says so.
  const label = m.source === "inbound" ? `${sourceLabel(m, lang)} · ` : "";
  const subject = m.subject ? `<b class="mx-subj">${esc(m.subject)}</b>` : "";
  const inner = sys
    ? `<details><summary>${esc(m.subject ?? m.body.split("\n")[0] ?? "")}</summary>${esc(m.body)}</details>`
    : `${subject}${m.placeholder ? `<span class="mx-ph">${esc(m.body)}</span>` : esc(m.body)}`;
  const notes: string[] = [];
  if (m.source === "reply" && m.answeredAt)
    notes.push(`<div class="mx-note">${esc(T(lang, "megválaszoltnak jelölve {at} · {who}", { at: fmtTime(m.answeredAt).slice(5), who: m.by ?? "—" }))}</div>`);
  if (m.dir === "out" && m.status === "failed" && m.error) notes.push(`<div class="mx-note is-bad">${esc(m.error)}</div>`);
  const retry = m.retryId
    ? `<form method="post" action="/partner/${esc(partnerId)}/message/${esc(m.retryId)}/retry" class="mx-retryf" data-mx-retry><button type="submit" class="mx-retry">${esc(T(lang, "újra"))}</button></form>`
    : "";
  return (
    `<li class="mx-msg mx-msg--${m.dir}${sys ? " mx-msg--sys" : ""}${fresh ? " mx-new" : ""}" id="m-${esc(m.key.replace(":", "-"))}" data-mx-key="${esc(m.key)}">` +
    `<div class="mx-meta">${icon}<span>${esc(label)}${esc(who)} · ${esc(fmtTime(m.at).slice(11))}</span>${chip(m, lang)}${retry}</div>` +
    `<div class="mx-bub">${inner}${m.attachment ? `<div class="mx-att">${ic("docs", 13)} ${esc(m.attachment)}</div>` : ""}</div>` +
    notes.join("") +
    `</li>`
  );
}

const DAYS = ["vasárnap", "hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat"];
const MONTHS = ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember", "október", "november", "december"];
function dayHeading(isoDay: string): string {
  const [y, mo, d] = isoDay.split("-").map(Number) as [number, number, number];
  const wd = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  return `${y}. ${MONTHS[mo - 1]} ${d}., ${DAYS[wd]}`;
}

function threadList(t: PartnerThread, partnerId: string, f: MessageFilter, lang: string): string {
  const shown = t.messages.filter((m) => passes(m, f));
  if (!shown.length)
    return `<ul class="mx-thread" data-mx-thread><li class="mx-empty">${esc(
      t.messages.length ? T(lang, "Ebben a szűrésben nincs üzenet.") : T(lang, "Még nem volt üzenetváltás ezzel a partnerrel."),
    )}</li></ul>`;
  let day = "";
  const items: string[] = [];
  for (const m of shown) {
    const d = budapestIsoDay(new Date(m.at));
    if (d !== day) {
      day = d;
      items.push(`<li class="mx-day">${esc(dayHeading(d))}</li>`);
    }
    items.push(messageBubble(m, partnerId, t.partnerName));
  }
  return `<ul class="mx-thread" data-mx-thread data-mx-lastday="${esc(day)}">${items.join("")}</ul>`;
}

function composer(partnerId: string, t: PartnerThread, st: ComposeState, lang: string): string {
  const v = st.values ?? {};
  const p = st.problems ?? {};
  const ch = v.channel === "sms" ? "sms" : "email";
  const err = (k: string) => `<em class="mx-err" data-mx-err="${k}">${esc(p[k] ?? "")}</em>`;
  const opts = (c: "email" | "sms") =>
    t.recipients
      .filter((r) => r.channel === c)
      .map(
        (r) =>
          `<option value="${esc(r.address)}"${r.blocked ? " disabled" : ""}${v.to === r.address ? " selected" : ""}>${esc(r.label)}${
            r.blocked ? ` — ${esc(T(lang, "leiratkozott"))}` : ""
          }</option>`,
      )
      .join("");
  const emailOpts = opts("email");
  const smsOpts = opts("sms");
  const guard = t.block
    ? `<div class="mx-guard" role="alert">${ic("lock", 16)}<div><b>${esc(T(lang, "Ennek a partnernek nem küldhető üzenet."))}</b><span>${esc(t.block.why)}</span></div></div>`
    : "";
  const seg = (c: "email" | "sms", label: string, icon: string) =>
    `<label class="mx-seg__o"><input type="radio" name="channel" value="${c}"${ch === c ? " checked" : ""}>${ic(icon, 14)} ${esc(label)}</label>`;
  const flash = st.flash ? `<span class="mx-state ${st.flash.ok ? "is-ok" : "is-bad"}" data-mx-state>${esc(st.flash.text)}</span>` : `<span class="mx-state" data-mx-state></span>`;
  return `<form class="mx-comp${t.block ? " is-guarded" : ""}" method="post" action="/partner/${esc(partnerId)}/message" data-mx-comp novalidate>
  ${guard}<fieldset class="mx-fs"${t.block ? " disabled" : ""}>
  <div class="mx-comp__row">
    <div class="mx-seg" role="radiogroup" aria-label="${esc(T(lang, "Csatorna"))}">${seg("email", T(lang, "E-mail"), "mail")}${seg("sms", T(lang, "SMS"), "sms")}</div>
    <label class="mx-to"><span>${esc(T(lang, "Címzett"))}</span><select name="to" data-mx-to>${
      emailOpts ? `<optgroup label="${esc(T(lang, "E-mail"))}" data-mx-og="email">${emailOpts}</optgroup>` : ""
    }${smsOpts ? `<optgroup label="${esc(T(lang, "SMS"))}" data-mx-og="sms">${smsOpts}</optgroup>` : ""}</select>${err("to")}</label>
  </div>
  <label class="mx-f" data-mx-subj><span>${esc(T(lang, "Tárgy"))} <small>(${esc(T(lang, "csak e-mailnél"))})</small></span><input name="subject" maxlength="300" autocomplete="off" value="${esc(v.subject ?? "")}" placeholder="${esc(T(lang, "pl. A honlapja és a saját webcíme"))}">${err("subject")}</label>
  <label class="mx-f"><span>${esc(T(lang, "Üzenet"))}</span><textarea name="body" rows="4" placeholder="${esc(T(lang, "Írja ide az üzenetet…"))}">${esc(v.body ?? "")}</textarea>${err("body")}</label>
  <div class="mx-smsinfo" data-mx-smsinfo>
    <span data-mx-count></span>
    <button type="button" class="mx-link" data-mx-gsm hidden>${esc(T(lang, "Ékezet nélkül küldöm (kevesebb SMS-rész)"))}</button>
    <label class="mx-chk"><input type="checkbox" name="sign" value="1"${v.sign === "0" ? "" : " checked"}> ${esc(T(lang, "aláírás (SMS): „{sig}”", { sig: SMS_SIGNATURE }))}</label>
  </div>
  <div class="mx-when" data-mx-when></div>
  ${p.form ? `<div class="mx-err mx-err--form">${esc(p.form)}</div>` : ""}
  <div class="mx-acts">
    <button type="submit" class="citui-btn citui-btn--primary mx-btn" data-mx-send>${ic("send", 15)} <span data-mx-send-l>${esc(ch === "sms" ? T(lang, "SMS küldése") : T(lang, "Levél küldése"))}</span></button>
    ${flash}
  </div>
  </fieldset>
</form>`;
}

/** The whole tab body. */
export function messagesTab(partnerId: string, t: PartnerThread, filter: MessageFilter, st: ComposeState): string {
  const lang = consoleLang();
  const labels: Record<MessageFilter, string> = {
    all: T(lang, "Mind"),
    email: T(lang, "E-mail"),
    sms: T(lang, "SMS / MMS"),
    mine: T(lang, "Kézi"),
    sys: T(lang, "Rendszerlevél"),
  };
  const filters = `<nav class="mx-filters" aria-label="${esc(T(lang, "Szűrés"))}">${MESSAGE_FILTERS.map(
    (f) =>
      `<a href="/partner/${esc(partnerId)}?tab=messages${f === "all" ? "" : `&f=${f}`}"${f === filter ? ' aria-current="true"' : ""}>${esc(labels[f])}</a>`,
  ).join("")}</nav>`;
  return `<section class="pa-card mx">
  <h2 class="pa-h">${esc(T(lang, "Üzenetváltások"))} <span class="pa-mut pa-small">${esc(T(lang, "e-mail · SMS · MMS, mindkét irány"))}</span></h2>
  ${filters}
  <p class="mx-gap">${esc(
    T(
      lang,
      "Bejövő: a megkeresésre adott válaszok, és minden levél és SMS, ami a partner vagy egy kapcsolattartója címéről jön. Az innen írt levélre adott válasz is ide érkezik.",
    ),
  )}</p>
  ${threadList(t, partnerId, filter, lang)}
  ${composer(partnerId, t, st, lang)}
</section><script>${COMPOSER_JS.replace("__GSM7__", JSON.stringify(GSM7_BASIC)).replace("__SIG__", JSON.stringify(`\n${SMS_SIGNATURE}`)).replace("__MAXP__", String(SMS_MAX_PARTS))}</script>`;
}

// The client mirror: the same encoding rule as src/sms/encoding.ts, the same limits as
// composeProblems(); the server re-checks everything.
const COMPOSER_JS = `(function(){
const form=document.querySelector('form[data-mx-comp]');if(!form)return;
const th=document.querySelector('[data-mx-thread]');
const GSM=new Set([...__GSM7__]),SIG=__SIG__,MAXP=__MAXP__;
const isG=t=>{for(const c of t)if(!GSM.has(c))return false;return true};
function enc(t){const g=isG(t),n=[...t].length,one=g?160:70,part=g?153:67;return{g,n,seg:n===0?0:n<=one?1:Math.ceil(n/part)}}
const PUNCT={"„":'"',"“":'"',"”":'"',"«":'"',"»":'"',"‘":"'","’":"'","‚":"'","–":"-","—":"-","‑":"-","…":"..."};
const toG=t=>[...[...t.normalize("NFD").replace(/[\\u0300-\\u036f]/g,"")].map(c=>PUNCT[c]??c).join("")].filter(c=>GSM.has(c)).join("").replace(/ {2,}/g," ");
const sel=form.querySelector('[data-mx-to]'),body=form.elements.body,subj=form.elements.subject,sign=form.elements.sign;
const st=form.querySelector('[data-mx-state]'),btn=form.querySelector('[data-mx-send]');
const ch=()=>(form.querySelector('input[name=channel]:checked')||{}).value||"email";
function quiet(){const h=Number(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Budapest",hour:"2-digit",hourCycle:"h23"}).format(new Date()));return h>=22||h<7}
function full(){return ch()==="sms"&&sign.checked?body.value.trimEnd()+SIG:body.value}
function setErr(k,m){const e=form.querySelector('[data-mx-err="'+k+'"]');if(e)e.textContent=m||"";const f=form.elements[k];if(f&&f.classList)f.classList.toggle('is-bad',!!m)}
function upd(){const c=ch();
 form.querySelectorAll('[data-mx-og]').forEach(g=>{const on=g.dataset.mxOg===c;g.hidden=!on;g.disabled=!on});
 const cur=sel.selectedOptions[0];if(!cur||cur.parentElement.dataset.mxOg!==c){const o=sel.querySelector('[data-mx-og="'+c+'"] option:not([disabled])');if(o)o.selected=true}
 form.querySelector('[data-mx-subj]').hidden=c!=="email";form.querySelector('[data-mx-smsinfo]').hidden=c!=="sms";
 form.querySelector('[data-mx-send-l]').textContent=c==="email"?"Levél küldése":"SMS küldése";
 if(c==="sms"){const e=enc(full()),n=form.querySelector('[data-mx-count]');
  n.textContent=e.n+" karakter · "+e.seg+" SMS-rész · "+(e.g?"GSM-7 (160 / rész)":"UCS-2 — ékezet miatt (70 / rész)")+(e.seg>MAXP?" — legfeljebb "+MAXP+" rész!":"");
  n.classList.toggle('is-bad',e.seg>MAXP);form.querySelector('[data-mx-gsm]').hidden=e.g||!body.value}
 const w=form.querySelector('[data-mx-when]'),q=c==="sms"&&quiet();w.classList.toggle('is-night',q);
 w.textContent=c==="sms"?(q?"Most csendes óra van (22:00–07:00): az SMS reggel 7-kor megy ki.":"Az SMS a modem-sávon megy ki, általában 1 percen belül."):"A levél azonnal megy, a citoviso.com feladóval; a válasz a postafiókba érkezik, és ebben a szálban is megjelenik."}
form.addEventListener('change',upd);
form.addEventListener('input',e=>{if(e.target.name)setErr(e.target.name,"");upd()});
form.querySelector('[data-mx-gsm]').onclick=()=>{body.value=toG(body.value);upd()};
function place(html,key){const tmp=document.createElement('ul');tmp.innerHTML=html;const li=tmp.firstElementChild;if(!li)return;
 const old=th.querySelector('[data-mx-key="'+key+'"]');if(old){old.replaceWith(li);return li}
 th.querySelector('.mx-empty')?.remove();th.appendChild(li);li.scrollIntoView({block:"nearest"});return li}
function follow(id,key,n){if(n>40)return;setTimeout(async()=>{try{const r=await fetch(form.action+"/"+id,{headers:{accept:"application/json"}});const j=await r.json();
 if(j.html)place(j.html,key);if(j.status==="queued")follow(id,key,n+1)}catch(e){}},n<6?3000:15000)}
async function post(url,fd){btn.disabled=true;st.className="mx-state";st.textContent="Küldés…";
 try{const r=await fetch(url,{method:"POST",body:new URLSearchParams(fd),headers:{accept:"application/json"}});const j=await r.json();
  if(!j.ok){const p=j.problems||{};Object.keys(p).forEach(k=>setErr(k,p[k]));st.className="mx-state is-bad";st.textContent=p.form||"Javítsa a jelölt mezőt.";return}
  place(j.html,j.key)?.classList.add('mx-new');st.className="mx-state "+(j.status==="failed"?"is-bad":"is-ok");st.textContent=j.message;
  if(url===form.action){body.value="";subj.value="";upd()}
  if(j.status==="queued")follow(j.id,j.key,0)}
 catch(e){st.className="mx-state is-bad";st.textContent="A küldés nem jutott el a szerverig — próbálja újra."}
 finally{btn.disabled=false}}
form.addEventListener('submit',e=>{e.preventDefault();if(form.classList.contains('is-guarded'))return;
 let bad=false;const c=ch();
 if(!sel.value||sel.selectedOptions[0]?.parentElement.dataset.mxOg!==c){setErr("to","Válasszon címzettet a listából.");bad=true}
 if(!body.value.trim()){setErr("body","Üres üzenet nem küldhető.");bad=true}
 if(c==="email"&&!subj.value.trim()){setErr("subject","A levélnek tárgy kell.");bad=true}
 if(c==="sms"&&enc(full()).seg>MAXP){setErr("body",MAXP+" SMS-résznél hosszabb szöveg nem küldhető — rövidítsen.");bad=true}
 if(bad)return;const fd=new FormData(form);if(!sign.checked)fd.set("sign","0");post(form.action,fd)});
th.addEventListener('submit',e=>{const f=e.target.closest('[data-mx-retry]');if(!f)return;e.preventDefault();post(f.action,new FormData(f))});
upd()})();`;
