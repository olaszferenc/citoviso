// The PRICE OFFER pages — approved plan booking-offer (tulaj, 2026-09-23).
// Contract: assets/design-refs/tenant-admin/booking-offer/README.md + plan.html.
//
//   ownerOfferPage     GET/POST /foglalas/<action_token>/ajanlat   (the owner's key)
//   guestOfferPage     GET      /ajanlat/<offer_token>             (the guest's key)
//   guestOfferResult   POST     /ajanlat/<offer_token>/elfogadom | /nem-kerem
//
// Both are Citoviso surfaces on the tenant's host (like the verdict and cancel pages):
// citui tokens only, no skin.

import { T } from "../i18n/mail.js";
import { formatDay } from "../text/day.js";
import { currencySign, formatMoney } from "../text/money.js";
import type { GuestOfferView, OfferView, SendOfferResult } from "../booking/requests.js";
import { readFileSync } from "node:fs";
import { guestPageShell } from "./moduleConfigViews.js";

// The BROWSER half of the money rule — the page's live total must spell "142 000 Ft"
// exactly as the server and the mails do. It travels with the script (adminViews.ts
// explains why), and scripts/money-format-check.mts forbids a formatter of our own.
const MONEY_JS = readFileSync(new URL("../../assets/runtime/cit-money.js", import.meta.url), "utf8");

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** The day in the page's language — the same formatter the Foglalások tab uses. */
function huDate(iso: string, lang: string): string {
  return formatDay(iso, lang);
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function huDateTime(d: Date, lang: string): string {
  const parts = new Intl.DateTimeFormat("hu-HU", {
    timeZone: "Europe/Budapest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? "";
  return `${huDate(`${get("year")}-${get("month")}-${get("day")}`, lang)} ${get("hour")}:${get("minute")}`;
}

const INFO_ICON =
  `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style="flex:none;margin-top:2px">` +
  `<circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/>` +
  `<path d="M8 4.5v4.2M8 11v.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;

/* Shared page CSS — tokens only (ADR-0021 ①). Two layouts, not one scaled (⑮):
 * side by side from 760px, stacked below; the missing-price fields span full width. */
const OFFER_CSS = `
.of-wrap{max-width:1100px;margin:0 auto;padding:28px 16px 48px}
.of-host{font-weight:800;color:var(--citui-navy-900);padding-bottom:10px;border-bottom:1px solid var(--citui-line);margin:0 0 16px}
.of-grid{display:grid;gap:14px}
@media (min-width:760px){.of-grid{grid-template-columns:5fr 7fr;align-items:start}}
.of-card{background:var(--citui-white);border:1px solid var(--citui-line);border-radius:12px;padding:16px}
.of-card h2{margin:0 0 10px;font-size:1.05rem}
.of-kv{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:.92rem;line-height:1.5;margin:0}
.of-kv dt{color:var(--citui-muted)} .of-kv dd{margin:0;font-weight:600}
.of-quote{margin-top:12px;border-left:4px solid var(--citui-cyan-500);background:var(--citui-surface-2);padding:9px 11px;border-radius:6px;font-size:.92rem;line-height:1.5}
.of-quote b{display:block;font-size:.7rem;letter-spacing:.07em;text-transform:uppercase;color:var(--citui-muted);margin-bottom:2px}
.of-saw{margin:12px 0 0;font-size:.88rem;color:var(--citui-warn-ink);display:flex;gap:7px;line-height:1.45}
.of-lines{list-style:none;margin:0 0 10px;padding:0}
.of-lines>li{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:start;padding:9px 0;border-bottom:1px dashed var(--citui-line-strong);font-size:.95rem}
.of-lines small{display:block;color:var(--citui-muted);font-size:.8rem}
.of-lines>li.of-miss{background:color-mix(in srgb,var(--citui-warn) 12%,var(--citui-white));margin:0 -8px;padding:10px 8px;border-radius:8px;border-bottom:0}
.of-full{grid-column:1/-1}
.of-sum{font-weight:700;white-space:nowrap}
.of-fld{margin-top:9px}
.of-fld>span{display:block;font-size:.8rem;font-weight:600;margin-bottom:4px}
.of-inp{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.of-inp input{font:inherit;font-size:16px;width:160px;padding:9px 10px;border:1px solid var(--citui-line-strong);border-radius:8px;background:var(--citui-white)}
.of-inp input[aria-invalid=true]{border-color:var(--citui-bad)}
.of-inp em{font-style:normal;color:var(--citui-muted);font-size:.9rem}
.of-err{color:var(--citui-bad-ink);font-size:.85rem;margin-top:4px}
.of-valid{margin-top:8px;font-size:.85rem;line-height:1.5;border-radius:6px;padding:8px 10px}
.of-valid--warn{background:var(--citui-white);border:1px solid var(--citui-warn);color:var(--citui-warn-ink)}
.of-valid--ok{background:var(--citui-ok-soft);color:var(--citui-ok-ink)}
.of-total{display:flex;justify-content:space-between;align-items:baseline;border-top:2px solid var(--citui-ink);padding-top:10px;margin-top:4px}
.of-total b{font-size:1.4rem} .of-total b.of-empty{color:var(--citui-muted);font-size:.95rem;font-weight:600}
.of-into{font-size:.85rem;color:var(--citui-muted);margin:10px 0 0;line-height:1.5}
.of-lbl{display:block;font-size:.85rem;font-weight:600;margin:14px 0 5px}
.of-card textarea{width:100%;box-sizing:border-box;font:inherit;font-size:15px;padding:9px 10px;border:1px solid var(--citui-line-strong);border-radius:8px;min-height:70px}
.of-acts{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
.of-acts .citui-btn--primary{flex:1 1 220px}
.of-fine{font-size:.85rem;color:var(--citui-muted);line-height:1.5;margin:10px 0 0}
.of-errs{border-left:4px solid var(--citui-bad);background:color-mix(in srgb,var(--citui-bad) 8%,var(--citui-white));padding:10px 12px;border-radius:8px;margin:0 0 14px;color:var(--citui-bad-ink)}
.of-done{border-left:4px solid var(--citui-ok);background:var(--citui-ok-soft);padding:12px 14px;border-radius:8px;line-height:1.55}
.of-done b{display:block;color:var(--citui-ok-ink);font-size:1.05rem;margin-bottom:3px}
.of-price{border:1px solid var(--citui-line);border-radius:8px;padding:10px 12px;margin:12px 0;font-size:.92rem;line-height:1.6;text-align:left}
.of-price .of-tot{font-weight:800;border-top:1px solid var(--citui-line);margin-top:6px;padding-top:6px}
`;

function pageShell(title: string, inner: string): string {
  return (
    `<!doctype html><html lang="hu"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="robots" content="noindex">` +
    `<link rel="stylesheet" href="/assets/ui/citui.css">` +
    `<style>${OFFER_CSS}</style>` +
    `<title>${esc(title)}</title></head><body style="background:var(--citui-surface)">` +
    `<div class="of-wrap">${inner}</div></body></html>`
  );
}

/** "Ft / éj" etc. — what ONE amount in the field means under the pricing mode. */
function perLabel(lang: string, cur: string, mode: string | undefined): string {
  if (mode === "per_person_night") return `${cur} / ${T(lang, "fő / éj")}`;
  if (mode === "per_stay") return `${cur} ${T(lang, "a teljes tartózkodásra")}`;
  return `${cur} / ${T(lang, "éj")}`;
}

/** GET (and POST-with-errors) of the owner's offer page — contract ②–⑧. */
export function ownerOfferPage(
  v: OfferView,
  opts: { errors?: string[]; amount?: string; until?: string; note?: string } = {},
): string {
  const lang = v.lang;
  if (v.outcome !== "open") return ownerOfferClosedPage(v);
  const cur = currencySign(v.currency ?? "HUF");
  const money = (n: number): string => formatMoney(n, v.currency, lang);
  const missing = v.missing ?? [];
  const known = v.known ?? [];
  const mode = v.unitMode ?? "per_night";
  const guestsMul = mode === "per_person_night" ? Math.max(1, v.guests ?? 1) : 1;
  const knownSum =
    mode === "per_stay"
      ? (known[0]?.from === v.dateFrom ? known[0]!.perNight : 0)
      : known.reduce((s, l) => s + l.nights * l.perNight * guestsMul, 0);
  const lastMissing = missing[missing.length - 1] ?? null;
  const seasonNames = (v.seasons ?? []).map((s) => s.label).filter(Boolean).join(", ");

  const knownRows = known
    .map(
      (l) =>
        `<li><div>${esc(l.label)} · ${esc(T(lang, "{n} éj", { n: l.nights }))} × ${esc(money(l.perNight))}` +
        `<small>${esc(huDate(l.from, lang))} – ${esc(huDate(l.to, lang))} — ${T(lang, "ez már az árlistájában van")}</small></div>` +
        `<span class="of-sum">${esc(money(mode === "per_stay" ? l.perNight : l.nights * l.perNight * guestsMul))}</span></li>`,
    )
    .join("");

  const missRow = missing.length
    ? `<li class="of-miss"><div>${T(lang, "Új ár")} · ${esc(T(lang, "{n} éj", { n: missing.length }))}` +
      `<small>${esc(huDate(missing[0]!, lang))} – ${esc(huDate(addDays(lastMissing!, 1), lang))} — ${T(lang, "erre nincs ára")}</small></div>` +
      `<span class="of-sum" data-sum>—</span>` +
      `<div class="of-full">` +
      `<label class="of-fld"><span>${T(lang, "Ár éjszakánként")}</span>` +
      `<span class="of-inp"><input name="amount" type="text" inputmode="numeric" autocomplete="off" ` +
      `placeholder="${esc(T(lang, "pl. 26 000"))}" value="${esc(opts.amount ?? "")}" data-amount>` +
      `<em>${esc(perLabel(lang, cur, mode))}</em></span></label>` +
      `<div class="of-err" data-amount-err></div>` +
      `<label class="of-fld"><span>${T(lang, "Érvényes eddig (nem kötelező)")}</span>` +
      `<span class="of-inp"><input name="until" type="date" min="${esc(v.today ?? "")}" value="${esc(opts.until ?? "")}" data-until>` +
      `<button class="citui-btn citui-btn--ghost" type="button" data-clear-until>${T(lang, "Nincs vége")}</button></span></label>` +
      `<div class="of-err" data-until-err></div>` +
      // The no-JS text is the WARNING: an empty date is the default state, and the
      // consequence has to be readable before any script runs.
      `<div class="of-valid of-valid--warn" data-validity>` +
      `<strong>${T(lang, "Nincs lejárati dátum.")}</strong> ` +
      (seasonNames
        ? T(
            lang,
            "Ez lesz a szoba alapára: minden olyan éjszakára érvényes, amelyre nincs szezonár — a következő módosításig. A szezonárak ({seasons}) a saját árukon maradnak.",
            { seasons: seasonNames },
          )
        : T(
            lang,
            "Ez lesz a szoba alapára: minden olyan éjszakára érvényes, amelyre nincs szezonár — a következő módosításig.",
          )) +
      `</div></div></li>`
    : "";

  // Client strings are translated HERE, on the server — the script only picks them.
  const msg = {
    num: T(lang, "Csak számot írjon, pl. 26 000."),
    pos: T(lang, "Az ár legyen nagyobb nullánál."),
    big: T(lang, "Ez túl nagy összeg — ellenőrizze a nullákat."),
    early: lastMissing
      ? T(lang, "Legalább {date} legyen — különben az ár erre a kérésre sem vonatkozik.", { date: huDate(lastMissing, lang) })
      : "",
    okUntil: T(lang, "Mától {date}-ig érvényes. Utána erre a szobára — ahol nincs szezonár — újra nem lesz ár; a lejárat előtt emlékeztetjük."),
    intoBase: T(lang, "Az ár alapárként kerül be a szoba árlistájába, és a honlapon is megjelenik."),
    intoDated: T(lang, "Az ár {from} – {to} között kerül be a szoba árlistájába, és a honlapon is megjelenik."),
    empty: T(lang, "írja be az árat"),
  };
  const cfg = {
    missing: missing.length,
    arrivalMissing: missing[0] === v.dateFrom,
    known: knownSum,
    mul: guestsMul,
    mode,
    lastMissing,
    today: v.today,
    lang,
    currency: v.currency ?? "HUF",
    msg,
  };

  const expireLine = v.expireHours
    ? T(
        lang,
        "Az ajánlat még nem foglalás: a napok addig szabadok maradnak, amíg {guest} el nem fogadja. Ha {n} órán belül nem felel, az ajánlat lejár, és erről mindketten értesítést kapnak.",
        { guest: v.guestName ?? "", n: v.expireHours },
      )
    : T(lang, "Az ajánlat még nem foglalás: a napok addig szabadok maradnak, amíg {guest} el nem fogadja.", {
        guest: v.guestName ?? "",
      });

  const inner =
    `<p class="of-host">${esc(v.hostName ?? "")}</p>` +
    (opts.errors?.length
      ? `<div class="of-errs" role="alert">${opts.errors.map((e) => esc(e)).join("<br>")}</div>`
      : "") +
    `<div class="of-grid">` +
    `<section class="of-card"><h2>${esc(T(lang, "{guest} kérése", { guest: v.guestName ?? "" }))}</h2>` +
    `<dl class="of-kv">` +
    `<dt>${T(lang, "Szoba")}</dt><dd>${esc(v.unitName ?? "")}</dd>` +
    `<dt>${T(lang, "Érkezés")}</dt><dd>${esc(huDate(v.dateFrom!, lang))}</dd>` +
    `<dt>${T(lang, "Távozás")}</dt><dd>${esc(huDate(v.dateTo!, lang))} (${esc(T(lang, "{n} éj", { n: v.nights ?? 0 }))})</dd>` +
    `<dt>${T(lang, "Létszám")}</dt><dd>${esc(T(lang, "{n} fő", { n: v.guests ?? 1 }))}</dd>` +
    (v.guestPhone ? `<dt>${T(lang, "Telefon")}</dt><dd>${esc(v.guestPhone)}</dd>` : "") +
    `<dt>${T(lang, "E-mail")}</dt><dd>${esc(v.guestEmail ?? "")}</dd>` +
    `</dl>` +
    (v.message ? `<div class="of-quote"><b>${T(lang, "Vendég")}</b>„${esc(v.message)}”</div>` : "") +
    `<p class="of-saw">${INFO_ICON}<span>${T(lang, "A vendég az oldalon nem látott összeget — amit itt beír, az lesz az első ár, amit megtud.")}</span></p>` +
    `</section>` +
    `<form class="of-card" method="POST" data-offer-form novalidate>` +
    `<h2>${T(lang, "Az ár")}</h2>` +
    `<ul class="of-lines">${missRow}${knownRows}</ul>` +
    `<div class="of-total"><span>${T(lang, "Összesen")}</span>` +
    `<b class="${missing.length ? "of-empty" : ""}" data-total>${missing.length ? esc(msg.empty) : esc(money(knownSum))}</b></div>` +
    `<p class="of-into" data-into></p>` +
    `<label class="of-lbl" for="of-note">${T(lang, "Üzenet a vendégnek (nem kötelező)")}</label>` +
    `<textarea id="of-note" name="note" maxlength="1000" placeholder="${esc(T(lang, "pl. A kiságyat szívesen odakészítjük, díjmentesen."))}">${esc(opts.note ?? "")}</textarea>` +
    `<div class="of-acts">` +
    `<button class="citui-btn citui-btn--primary" type="submit" data-send>${T(lang, "Ajánlat küldése")}</button>` +
    `<a class="citui-btn citui-btn--ghost" href="/foglalas/${esc(v.token ?? "")}/elutasitom">${T(lang, "Nem szabad")}</a>` +
    `</div>` +
    `<p class="of-fine">${esc(expireLine)}</p>` +
    `</form></div>` +
    `<script type="application/json" id="of-cfg">${JSON.stringify(cfg).replace(/</g, "\\u003c")}</script>` +
    `<script>${MONEY_JS}</script>` +
    `<script>${OFFER_JS}</script>`;
  return pageShell(T(lang, "Árajánlat küldése"), inner);
}

/* The page's behaviour — the SAME amount rule as parseOfferAmount (requests.ts) and
 * the SAME money shape as formatMoney (text/money.ts). The server re-validates
 * everything; this only makes the consequence visible before the tap. */
const OFFER_JS = `(function(){
var C=JSON.parse(document.getElementById("of-cfg").textContent),f=document.querySelector("[data-offer-form]");
if(!f)return;var A=f.querySelector("[data-amount]"),U=f.querySelector("[data-until]"),S=f.querySelector("[data-send]");
function grp(n){return CitMoney.formatNumber(n,"hu");}
function money(n){return CitMoney.formatMoney(n,C.currency,C.lang);}
function nice(iso){var p=iso.split("-");return p[0]+". "+p[1]+". "+p[2]+".";}
function parse(raw){var s=String(raw||"").replace(/[\\s.\\u00a0]/g,"").replace(/ft$/i,"");if(s==="")return{empty:1};if(!/^\\d+$/.test(s))return{error:C.msg.num};var n=parseInt(s,10);if(!(n>0))return{error:C.msg.pos};if(n>10000000)return{error:C.msg.big};return{value:n};}
function run(){
 if(!C.missing){S.disabled=false;return;}
 var r=parse(A.value),ae=f.querySelector("[data-amount-err]");ae.textContent=r.error||"";A.setAttribute("aria-invalid",r.error?"true":"false");
 var u=U.value,ue="";if(u&&(u<C.lastMissing||u<C.today))ue=C.msg.early;f.querySelector("[data-until-err]").textContent=ue;U.setAttribute("aria-invalid",ue?"true":"false");
 var v=f.querySelector("[data-validity]");
 if(!u){v.className="of-valid of-valid--warn";v.hidden=false;v.dataset.shown="warn";}
 else if(!ue){v.className="of-valid of-valid--ok";v.hidden=false;v.textContent=C.msg.okUntil.replace("{date}",nice(u).replace(/\\.$/,""));}
 else{v.hidden=true;}
 var add=0;if(r.value){add=C.mode==="per_stay"?(C.arrivalMissing?r.value:0):r.value*C.missing*C.mul;}
 var total=r.value&&!ue?(C.mode==="per_stay"?(C.arrivalMissing?r.value:C.known):C.known+add):null;
 f.querySelector("[data-sum]").textContent=r.value?money(C.mode==="per_stay"?(C.arrivalMissing?r.value:0):add):"\\u2014";
 var t=f.querySelector("[data-total]");t.textContent=total?money(total):C.msg.empty;t.classList.toggle("of-empty",!total);
 f.querySelector("[data-into]").textContent=r.value?(u&&!ue?C.msg.intoDated.replace("{from}",nice(C.today)).replace("{to}",nice(u)):C.msg.intoBase):"";
 S.disabled=!total;
}
var warnHtml=f.querySelector("[data-validity]")?f.querySelector("[data-validity]").innerHTML:"";
if(C.missing){A.addEventListener("input",run);A.addEventListener("blur",function(){var r=parse(A.value);if(r.value)A.value=grp(r.value);});
U.addEventListener("input",function(){if(!U.value)f.querySelector("[data-validity]").innerHTML=warnHtml;run();});U.addEventListener("change",function(){if(!U.value)f.querySelector("[data-validity]").innerHTML=warnHtml;run();});
f.querySelector("[data-clear-until]").addEventListener("click",function(){U.value="";f.querySelector("[data-validity]").innerHTML=warnHtml;run();});}
f.addEventListener("submit",function(e){if(S.disabled){e.preventDefault();return;}S.disabled=true;});
run();
})();`;

/** The request is no longer open for an offer (already offered/decided, or priced). */
function ownerOfferClosedPage(v: OfferView): string {
  const lang = v.lang;
  const who = esc(v.guestName ?? "");
  const text =
    v.outcome === "unknown"
      ? T(lang, "Ez a link már nem él. A foglalási kéréseit az admin felületen is megtalálja.")
      : v.status === "offered"
        ? T(lang, "Erre a kérésre már elküldte az ajánlatot — most {guest} válaszára várunk.", { guest: who })
        : v.status === "priced"
          ? T(lang, "Ennek a kérésnek már van ára — az admin felület Foglalások részén dönthet róla.")
          : T(lang, "Erről a kérésről már döntés született, nem történt újabb változás.");
  return pageShell(
    T(lang, "Árajánlat"),
    `<div class="of-card" style="max-width:520px;margin:40px auto"><p class="of-host">${esc(v.hostName ?? "")}</p>` +
      `<p style="line-height:1.6">${text}</p>` +
      `<p style="margin-top:20px"><a class="citui-btn citui-btn--ghost" href="/admin?tab=modulok&m=booking">${T(lang, "Foglalások megnyitása")}</a></p></div>`,
  );
}

/** POST success — contract step 3 (the owner's own card). */
export function ownerOfferSentPage(r: SendOfferResult, hostName: string): string {
  const lang = r.lang;
  const money = (n: number): string => formatMoney(n, r.currency, lang);
  const intoLine = r.amount
    ? r.until
      ? T(lang, "A szoba árlistájába bekerült: {amount}/éj ({from} – {to}).", {
          amount: money(r.amount),
          from: huDate(new Date().toISOString().slice(0, 10), lang),
          to: huDate(r.until, lang),
        })
      : T(lang, "A szoba árlistájába bekerült: {amount}/éj alapárként.", { amount: money(r.amount) })
    : "";
  const expires = r.expiresAt ? ` ${T(lang, "Az ajánlat {when}-ig érvényes.", { when: huDateTime(r.expiresAt, lang) })}` : "";
  return pageShell(
    T(lang, "Ajánlat elküldve"),
    `<div class="of-card" style="max-width:560px;margin:40px auto"><p class="of-host">${esc(hostName)}</p>` +
      `<div class="of-done" data-offer-sent><b>${esc(T(lang, "Ajánlat elküldve, {total}", { total: money(r.total ?? 0) }))}</b>` +
      esc(
        T(lang, "{guest} e-mailben megkapta. A napok még szabadok — ha elfogadja, értesítjük, és akkor válnak foglalttá.", {
          guest: r.guestName ?? "",
        }),
      ) +
      esc(expires) +
      (intoLine ? ` ${esc(intoLine)}` : "") +
      `</div>` +
      `<p style="margin-top:20px"><a class="citui-btn citui-btn--ghost" href="/admin?tab=modulok&m=booking">${T(lang, "Foglalások megnyitása")}</a></p></div>`,
  );
}

function priceBox(v: GuestOfferView): string {
  const lang = v.lang;
  // An amount must never break inside itself ("78 / 000 Ft" on a phone, seen on the
  // first shot) — each one is kept on one line.
  const money = (n: number): string =>
    `<span style="white-space:nowrap">${esc(formatMoney(n, v.currency, lang))}</span>`;
  const lines = (v.lines ?? [])
    .map(
      (l) =>
        `${esc(l.label)}: ${esc(T(lang, "{n} éj", { n: l.nights }))} × ${money(l.per_night)}` +
        (l.guests > 1 ? ` × ${esc(T(lang, "{n} fő", { n: l.guests }))}` : "") +
        ` = ${money(l.sum)}`,
    )
    .join("<br>");
  return (
    `<div class="of-price">${lines}` +
    `<div class="of-tot">${T(lang, "Összesen:")} ${money(v.total ?? 0)}</div></div>`
  );
}

/** GET /ajanlat/<offer_token> — ⑪: shows first; only the buttons decide. */
export function guestOfferPage(v: GuestOfferView, offerToken: string): string {
  const lang = v.lang;
  if (v.outcome !== "open") return guestOfferResultPage(v);
  const stay =
    `${esc(v.unitName ?? "")} · ${esc(huDate(v.dateFrom!, lang))} — ${esc(huDate(v.dateTo!, lang))} · ` +
    esc(T(lang, "{n} fő", { n: v.guests ?? 1 }));
  const inner =
    `<h1 style="font-size:1.35rem;margin:4px 0 8px;text-align:center">${T(lang, "Az ajánlat")}</h1>` +
    `<p style="text-align:center;line-height:1.6;margin:0">${stay}</p>` +
    priceBox(v) +
    (v.note ? `<div class="of-quote" style="text-align:left"><b>${T(lang, "A szállásadó üzenete")}</b>„${esc(v.note)}”</div>` : "") +
    `<p style="font-size:.88rem;color:var(--citui-muted);line-height:1.5;margin:14px 0">` +
    (v.expiresAt ? esc(T(lang, "Az ajánlat {when}-ig érvényes.", { when: huDateTime(v.expiresAt, lang) })) + " " : "") +
    T(lang, "Az elfogadással a foglalás végleges. A lemondás módját a visszaigazoló levélben találja.") +
    `</p>` +
    `<form method="POST" action="/ajanlat/${esc(offerToken)}/elfogadom" style="margin:0 0 10px">` +
    `<button class="citui-btn citui-btn--primary" type="submit" style="width:100%">${T(lang, "Elfogadom az ajánlatot")}</button></form>` +
    `<form method="POST" action="/ajanlat/${esc(offerToken)}/nem-kerem" style="margin:0">` +
    `<button class="citui-btn citui-btn--ghost" type="submit" style="width:100%">${T(lang, "Nem kérem")}</button></form>`;
  return withCss(
    guestPageShell(T(lang, "Az ajánlat"), inner, {
      host: v.hostName ?? null,
      back: v.siteUrl ?? null,
      backLabel: T(lang, "Vissza a szállás oldalára"),
    }),
  );
}

/** Every closing state of the guest's page (⑫), each saying what happened. */
export function guestOfferResultPage(v: GuestOfferView): string {
  const lang = v.lang;
  const M: Record<string, { title: string; body: string; tone: "ok" | "bad" | "muted" }> = {
    accepted_now: {
      title: T(lang, "Foglalása végleges"),
      body: T(lang, "Köszönjük! Hamarosan megkapja a visszaigazoló levelet az árral és a lemondás módjával."),
      tone: "ok",
    },
    accepted: {
      title: T(lang, "Ezt az ajánlatot már elfogadta"),
      body: T(lang, "A foglalása végleges, a visszaigazolást e-mailben elküldtük."),
      tone: "ok",
    },
    declined_now: {
      title: T(lang, "Rendben, jeleztük a szállásadónak"),
      body: T(lang, "Az ajánlatot nem kérte, a foglalás nem jött létre."),
      tone: "muted",
    },
    declined: {
      title: T(lang, "Ez az ajánlat már lezárult"),
      body: T(lang, "Ha még szeretne jönni, kérjen új ajánlatot a szállás oldalán."),
      tone: "muted",
    },
    conflict: {
      title: T(lang, "Ezek a napok közben elkeltek"),
      body: T(lang, "A foglalás nem jött létre, pénz nem mozdult. A szállásadót értesítettük — ha tud másik időpontot, jelentkezik."),
      tone: "bad",
    },
    expired: {
      title: T(lang, "Ez az ajánlat lejárt"),
      body: T(lang, "A napokat nem tartottuk tovább. Kérjen új ajánlatot a szállás oldalán, vagy válaszoljon az ajánlat levelére."),
      tone: "muted",
    },
    cancelled: {
      title: T(lang, "Ez a foglalás lemondva"),
      body: T(lang, "Ha még szeretne jönni, kérjen új ajánlatot a szállás oldalán."),
      tone: "muted",
    },
    unknown: {
      title: T(lang, "Ez a link már nem él"),
      body: T(lang, "Lehet, hogy régi levélből nyitotta meg."),
      tone: "bad",
    },
  };
  const m = M[v.outcome] ?? M.unknown!;
  const color =
    m.tone === "ok" ? "var(--citui-ok-ink)" : m.tone === "bad" ? "var(--citui-bad-ink)" : "var(--citui-ink)";
  return withCss(
    guestPageShell(
      m.title,
      `<h1 data-offer-outcome="${esc(v.outcome)}" style="font-size:1.3rem;color:${color};margin:4px 0 10px">${esc(m.title)}</h1>` +
        `<p style="line-height:1.6;margin:0">${esc(m.body)}</p>`,
      { host: v.hostName ?? null, back: v.siteUrl ?? null, backLabel: T(lang, "Vissza a szállás oldalára") },
    ),
  );
}

function withCss(html: string): string {
  return html.replace("</head>", `<style>${OFFER_CSS}</style></head>`);
}
