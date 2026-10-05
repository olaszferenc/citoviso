// Elérhetőség — the site's public address, map pin, phone and e-mail (ADR-0241).
//
// Approved plan: assets/design-refs/tenant-admin/elerhetoseg/ (variant „B"). Two
// screens share ONE place card and ONE data source:
//   · the „Elérhetőség" tab (address + pin + phone + e-mail), independent of any module;
//   · the Térkép module screen (address + pin above the approach/parking fields).
//
// The map is a progressive layer: without the browser key or without JavaScript the
// address field and the stored pin still post, and the pin simply stays where it is.

import { T } from "../i18n/mail.js";
import { icAdmin as ic } from "../ui/icons.js";
import { CONTACT_ERRORS, type ContactErrorKey, type ContactFacts } from "../tenant/contact.js";
import { PHONE_NORM_JS } from "../text/phone.js";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface ContactView {
  readonly facts: ContactFacts;
  /** Browser Maps key; empty → no map, the fields still work. */
  readonly mapsKey: string;
  readonly errors?: readonly ContactErrorKey[];
  /** The save failed for a reason no field explains (no site yet, render error). */
  readonly failed?: boolean;
  readonly lang?: string;
}

export const CONTACT_CSS =
  `<style>` +
  `.pl-row{display:flex;gap:8px;align-items:stretch}` +
  `.pl-row .citui-input{flex:1;min-width:0}` +
  `.pl-row .citui-btn{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}` +
  `.pl-map{height:380px;border-radius:12px;overflow:hidden;border:1px solid var(--citui-line);margin-top:14px;background:var(--citui-surface-2)}` +
  `@media (max-width:700px){.pl-row{flex-direction:column}.pl-map{height:300px}}` +
  `.pl-status{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin-top:10px;font-size:13px;color:var(--citui-muted)}` +
  `.pl-dot{width:8px;height:8px;border-radius:50%;background:var(--citui-ok);display:inline-block;margin-right:6px}` +
  `.pl-status[data-s="moved"] .pl-dot,.pl-status[data-s="found"] .pl-dot{background:var(--citui-warn)}` +
  `.pl-status[data-s="err"] .pl-dot{background:var(--citui-bad)}` +
  `.pl-status b{color:var(--citui-ink)}` +
  `.pl-coords{font-variant-numeric:tabular-nums}` +
  `.pl-link{background:none;border:0;padding:0;color:var(--citui-link-ink);font:inherit;font-size:13px;cursor:pointer;text-decoration:underline}` +
  `.pl-tip{margin:8px 0 0}` +
  `.pl-err{color:var(--citui-bad);font-size:13px;margin:6px 0 0}` +
  `.pl-ok{color:var(--citui-muted);font-size:12.5px;margin:6px 0 0}` +
  `.pl-where{font-size:12.5px;margin:6px 0 0}` +
  `.pl-save{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:20px}` +
  `.pl-dirty{font-size:13px;color:var(--citui-muted)}` +
  `.pl-dirty[data-s="dirty"]{color:var(--citui-warn-ink)}` +
  `.pl-2{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}` +
  `@media (max-width:700px){.pl-2{grid-template-columns:1fr}}` +
  `.pl-crumb{font-size:13px;color:var(--citui-muted);margin:-4px 0 14px}` +
  `.pl-errs{margin:0 0 14px}` +
  `</style>`;

function errLine(id: string, errors: readonly ContactErrorKey[] | undefined, key: ContactErrorKey, lang: string): string {
  const on = errors?.includes(key);
  return `<p class="pl-err" id="${id}"${on ? "" : " hidden"}>${on ? esc(T(lang, CONTACT_ERRORS[key])) : ""}</p>`;
}

/** ADR-0045 §J: the card-head help icon for this surface (kb anchor admin.contact). Sits on
 *  the place card, so the Térkép module screen reaches the same guide. */
function contactHelp(lang: string): string {
  return (
    `<a class="adm-help" data-kb-anchor="admin.contact" href="/admin?tab=sugo&topic=admin.contact" ` +
    `title="${T(lang, "Súgó ehhez a részhez")}">${ic("help", 18)}</a>`
  );
}

/** The shared place card: address + (optionally) the draggable pin. Posts
 *  `address`, `lat`, `lon` — inside whichever form wraps it. */
export function placeCard(v: ContactView, lead: string): string {
  const lang = v.lang ?? "hu";
  const g = v.facts.geo;
  const map = v.mapsKey
    ? `<div class="pl-map" id="pl_map" role="application" aria-label="${esc(T(lang, "Térkép — húzza a tűt a szállás bejáratához"))}"></div>` +
      `<div class="pl-status" id="pl_status" data-s="saved"><span><span class="pl-dot"></span><b id="pl_state">${T(lang, "A mentett helyen áll a tű")}</b></span>` +
      `<span class="pl-coords" id="pl_coords">${g ? `${g.lat.toFixed(5)}, ${g.lon.toFixed(5)}` : ""}</span>` +
      `<button class="pl-link" type="button" id="pl_undo" hidden>${T(lang, "Vissza a mentett helyre")}</button></div>` +
      `<p class="citui-hint pl-tip">${T(lang, "Koppintson a térképre, vagy húzza a tűt oda, ahol a vendég megáll: a bejárathoz, a kapuhoz. Ha a ház nem látszik, váltson {sat} nézetre.", { sat: `<b>${T(lang, "Műhold")}</b>` })}</p>`
    : `<p class="citui-hint pl-tip">${T(lang, "A térképes pontosítás most nem érhető el. A címet ettől még átírhatja.")}</p>`;
  return (
    `<section class="adm-card" data-place>` +
    `<div class="adm-card__head"><span class="adm-ico">${ic("pin")}</span><h2>${T(lang, "A szállás helye")}</h2>${contactHelp(lang)}</div>` +
    `<p class="adm-lead">${lead}</p>` +
    `<div class="citui-field"><label class="citui-label" for="pl_addr">${T(lang, "Cím")}</label>` +
    `<div class="pl-row"><input class="citui-input" id="pl_addr" name="address" value="${esc(v.facts.address)}" autocomplete="street-address" maxlength="200" required>` +
    (v.mapsKey
      ? `<button class="citui-btn citui-btn--ghost" type="button" id="pl_find">${ic("search", 16)}<span>${T(lang, "Megkeresem a térképen")}</span></button>`
      : "") +
    `</div>` +
    errLine("pl_addr_err", v.errors, "address", lang) +
    `<p class="citui-hint pl-where">${T(lang, "Így jelenik meg az oldal tetején, a kapcsolat részben és a Google-nak szóló adatokban.")}</p></div>` +
    `<input type="hidden" name="lat" id="pl_lat" value="${g ? g.lat : ""}"><input type="hidden" name="lon" id="pl_lon" value="${g ? g.lon : ""}">` +
    map +
    errLine("pl_geo_err", v.errors, "geo", lang) +
    `</section>`
  );
}

function contactFields(v: ContactView): string {
  const lang = v.lang ?? "hu";
  return (
    `<div class="pl-2">` +
    `<div class="citui-field"><label class="citui-label" for="ct_phone">${T(lang, "Telefon")}</label>` +
    `<input class="citui-input" id="ct_phone" name="phone" type="tel" inputmode="tel" value="${esc(v.facts.phone)}" autocomplete="tel" maxlength="40">` +
    errLine("ct_phone_err", v.errors, "phone", lang) +
    `<p class="pl-ok" id="ct_phone_ok" hidden></p></div>` +
    `<div class="citui-field"><label class="citui-label" for="ct_email">${T(lang, "E-mail")}</label>` +
    `<input class="citui-input" id="ct_email" name="email" type="email" inputmode="email" value="${esc(v.facts.email)}" autocomplete="email" maxlength="160">` +
    errLine("ct_email_err", v.errors, "email", lang) +
    `</div></div>` +
    `<p class="citui-hint" style="margin:0">${T(lang, "Mindkettő {pub}: a honlap kapcsolat részében és a gombokon jelenik meg. Az értesítéseinket nem ide, hanem a {acct} címre küldjük.", { pub: `<b>${T(lang, "nyilvános")}</b>`, acct: `<b>${T(lang, "Fiók › Kommunikációs e-mail")}</b>` })}</p>`
  );
}

export function saveBar(lang: string, extra = ""): string {
  return (
    `<div class="pl-save"><button class="citui-btn citui-btn--primary" type="submit" id="pl_save">${T(lang, "Mentés és frissítés")}</button>` +
    extra +
    `<span class="pl-dirty" id="pl_dirty" data-s="clean">${T(lang, "Nincs mentetlen változás")}</span></div>`
  );
}

/** The „Elérhetőség" tab. */
export function contactSection(v: ContactView): string {
  const lang = v.lang ?? "hu";
  return (
    CONTACT_CSS +
    `<p class="pl-crumb">${T(lang, "Ahol a vendég megtalálja és eléri — egy helyen.")}</p>` +
    (v.failed
      ? `<div class="adm-banner adm-banner--bad" role="alert">${ic("alert", 18)} ${T(lang, "A mentés nem sikerült, semmi nem változott. Próbálja újra, vagy írjon nekünk.")}</div>`
      : "") +
    `<form method="POST" action="/admin/elerhetoseg" id="pl_form" novalidate>` +
    placeCard(v, T(lang, "A honlap tetején, a kapcsolat részben és a térképen ez a cím és ez a pont látszik.")) +
    `<section class="adm-card" id="ct_card"><div class="adm-card__head"><span class="adm-ico">${ic("contact")}</span><h2>${T(lang, "Telefon és e-mail")}</h2></div>` +
    contactFields(v) +
    `</section>` +
    saveBar(lang) +
    `</form>` +
    placeScript(v)
  );
}

/**
 * The client layer: pin drag/tap, address search, phone/e-mail feedback, and the
 * "what is unsaved" line. The phone rule is src/text/phone.ts PHONE_NORM_JS — the
 * client mirror of normalizePhone(), kept next to it
 * + contact.ts prettyPhone() — the server re-checks, this only answers early.
 */
export function placeScript(v: ContactView): string {
  const lang = v.lang ?? "hu";
  const g = v.facts.geo;
  const L = {
    saved: T(lang, "A mentett helyen áll a tű"),
    moved: T(lang, "Kézzel pontosítva — mentésre vár"),
    found: T(lang, "A cím alapján áll — ellenőrizze, és húzza pontosra"),
    notFound: T(lang, "Ezt a címet a térkép nem ismeri — húzza a tűt a helyére kézzel"),
    loading: T(lang, "A térkép még töltődik"),
    searching: T(lang, "Keresem…"),
    search: T(lang, "Megkeresem a térképen"),
    noPin: T(lang, "Még nincs tű — keresse meg a címet, vagy koppintson a térképre"),
    phoneBad: T(lang, CONTACT_ERRORS.phone),
    phoneEmpty: T(lang, "Üresen hagyva a honlapon nem lesz telefonszám."),
    phoneAs: T(lang, "A honlapon így: {p}"),
    emailBad: T(lang, CONTACT_ERRORS.email),
    addrBad: T(lang, CONTACT_ERRORS.address),
    clean: T(lang, "Nincs mentetlen változás"),
    dirty: T(lang, "Mentetlen: {list}"),
    fix: T(lang, "Javítsa a pirossal jelölt mezőt, utána mentünk."),
    fAddr: T(lang, "cím"),
    fPin: T(lang, "térkép-tű"),
    fPhone: T(lang, "telefon"),
    fEmail: T(lang, "e-mail"),
    pinTitle: T(lang, "A szállás bejárata"),
  };
  // The stored pin, or null: the map then opens on Hungary, and nothing is saved
  // until the owner places a pin.
  const start = g ? { lat: g.lat, lng: g.lon } : null;
  const js =
    `(function(){var L=${JSON.stringify(L)},S=${JSON.stringify(start)};` +
    `var $=function(i){return document.getElementById(i)};` +
    `var form=$('pl_addr')&&$('pl_addr').form;if(!form)return;` +
    `var saved={lat:S?S.lat:null,lng:S?S.lng:null,addr:$('pl_addr').value,phone:$('ct_phone')?$('ct_phone').value:'',email:$('ct_email')?$('ct_email').value:''};` +
    `var cur=S?{lat:S.lat,lng:S.lng}:null,map,marker,geocoder;` +
    `function fmt(p){return p?p.lat.toFixed(5)+', '+p.lng.toFixed(5):''}` +
    `function setStatus(s,t){var st=$('pl_status');if(!st)return;st.dataset.s=s;$('pl_state').textContent=t;$('pl_coords').textContent=fmt(cur);$('pl_undo').hidden=(s==='saved'||saved.lat===null)}` +
    PHONE_NORM_JS +
    `function pretty(e){if(!e||e.indexOf('+36')!==0)return e;var n=e.slice(3);if(n[0]==='1')return '+36 1 '+n.slice(1,4)+' '+n.slice(4);var r=n.slice(2);return '+36 '+n.slice(0,2)+' '+r.slice(0,3)+' '+r.slice(3)}` +
    `function watched(){return [].slice.call(form.querySelectorAll('[data-watch]'))}` +
    `function val(el){return el.type==='checkbox'?String(el.checked):el.value}` +
    `function dirty(){var d=$('pl_dirty');if(!d)return;var ch=[];` +
    `if($('pl_addr').value.replace(/\\s+/g,' ').trim()!==saved.addr.replace(/\\s+/g,' ').trim())ch.push(L.fAddr);` +
    `if(cur&&(saved.lat===null||Math.abs(cur.lat-saved.lat)>1e-7||Math.abs(cur.lng-saved.lng)>1e-7))ch.push(L.fPin);` +
    `if($('ct_phone')&&norm($('ct_phone').value)!==norm(saved.phone))ch.push(L.fPhone);` +
    `if($('ct_email')&&$('ct_email').value.trim()!==saved.email.trim())ch.push(L.fEmail);` +
    `watched().forEach(function(el){if(el.dataset.v!==val(el))ch.push(el.dataset.watch)});` +
    `d.dataset.s=ch.length?'dirty':'clean';d.textContent=ch.length?L.dirty.replace('{list}',ch.join(', ')):L.clean}` +
    `function checkPhone(commit){var i=$('ct_phone');if(!i)return true;var v=i.value.trim(),er=$('ct_phone_err'),ok=$('ct_phone_ok');` +
    `if(!v){er.hidden=true;i.removeAttribute('aria-invalid');ok.hidden=false;ok.textContent=L.phoneEmpty;return true}` +
    `var n=norm(v);if(!n){er.hidden=false;er.textContent=L.phoneBad;ok.hidden=true;i.setAttribute('aria-invalid','true');return false}` +
    `i.removeAttribute('aria-invalid');er.hidden=true;if(commit)i.value=pretty(n);ok.hidden=false;ok.textContent=L.phoneAs.replace('{p}',pretty(n));return true}` +
    `function checkEmail(){var i=$('ct_email');if(!i)return true;var v=i.value.trim(),er=$('ct_email_err');` +
    `if(v&&!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(v)){er.hidden=false;er.textContent=L.emailBad;i.setAttribute('aria-invalid','true');return false}` +
    `er.hidden=true;i.removeAttribute('aria-invalid');return true}` +
    `function checkAddr(){var i=$('pl_addr'),er=$('pl_addr_err');if(i.value.replace(/\\s+/g,' ').trim().length<5){er.hidden=false;er.textContent=L.addrBad;i.setAttribute('aria-invalid','true');return false}` +
    `er.hidden=true;i.removeAttribute('aria-invalid');return true}` +
    `function place(p,how){cur={lat:p.lat,lng:p.lng};$('pl_lat').value=String(cur.lat);$('pl_lon').value=String(cur.lng);` +
    `if(marker)marker.setPosition(cur);else if(map){marker=mk(cur)}` +
    `setStatus(how,how==='moved'?L.moved:how==='found'?L.found:L.saved);dirty()}` +
    `function mk(p){var m=new google.maps.Marker({position:p,map:map,draggable:true,title:L.pinTitle});` +
    `m.addListener('dragend',function(e){place({lat:e.latLng.lat(),lng:e.latLng.lng()},'moved')});return m}` +
    `window.plInit=function(){if(!$('pl_map'))return;` +
    `map=new google.maps.Map($('pl_map'),{center:cur||{lat:47.1,lng:19.4},zoom:cur?16:7,mapTypeControl:true,streetViewControl:false,fullscreenControl:true,gestureHandling:'cooperative',clickableIcons:false});` +
    `if(cur)marker=mk(cur);` +
    `map.addListener('click',function(e){place({lat:e.latLng.lat(),lng:e.latLng.lng()},'moved')});` +
    `geocoder=new google.maps.Geocoder();if(cur)setStatus('saved',L.saved);else{$('pl_status').dataset.s='err';$('pl_state').textContent=L.noPin}` +
    `window.PL_READY=1};` +
    `var f=$('pl_find');if(f)f.addEventListener('click',function(){if(!checkAddr())return;` +
    `if(!geocoder){setStatus('err',L.loading);return}var lab=f.querySelector('span');f.disabled=true;lab.textContent=L.searching;` +
    `geocoder.geocode({address:$('pl_addr').value,region:'hu'},function(res,st){f.disabled=false;lab.textContent=L.search;` +
    `if(st==='OK'&&res[0]){var l=res[0].geometry.location;map.panTo(l);map.setZoom(17);place({lat:l.lat(),lng:l.lng()},'found')}` +
    `else{$('pl_status').dataset.s='err';$('pl_state').textContent=L.notFound}})});` +
    `var u=$('pl_undo');if(u)u.addEventListener('click',function(){if(saved.lat===null)return;place({lat:saved.lat,lng:saved.lng},'saved');if(map)map.panTo(cur)});` +
    `['pl_addr','ct_phone','ct_email'].forEach(function(id){var i=$(id);if(!i)return;` +
    `i.addEventListener('input',function(){dirty();if(id==='ct_phone')checkPhone(false)});` +
    `i.addEventListener('blur',function(){if(id==='ct_phone')checkPhone(true);if(id==='ct_email')checkEmail();if(id==='pl_addr')checkAddr();dirty()})});` +
    `watched().forEach(function(el){el.dataset.v=val(el);el.addEventListener('input',dirty);el.addEventListener('change',dirty)});` +
    `if($('ct_phone')&&$('ct_phone').value)checkPhone(false);` +
    // A submit through ANY button of the form (e.g. „Vissza az előzőre") skips the
    // contact check only when that button does not save the contact.
    `form.addEventListener('submit',function(e){var b=e.submitter;if(b&&b.getAttribute('formaction'))return;` +
    `var ok=[checkAddr(),checkPhone(true),checkEmail()].every(Boolean);` +
    `if(!ok){e.preventDefault();var d=$('pl_dirty');if(d){d.dataset.s='dirty';d.textContent=L.fix}}});` +
    `})();`;
  return (
    `<script>${js}</script>` +
    (v.mapsKey
      ? `<script async src="https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(v.mapsKey)}&loading=async&callback=plInit&language=${encodeURIComponent(lang)}&region=HU"></script>`
      : "")
  );
}
