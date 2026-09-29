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
import { missingRuns, type GuestOfferView, type OfferView, type SendOfferResult } from "../booking/requests.js";
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
.of-total{display:flex;justify-content:space-between;align-items:baseline;border-top:2px solid var(--citui-ink);padding-top:10px;margin-top:4px}
.of-total b{font-size:1.4rem} .of-total b.of-empty{color:var(--citui-muted);font-size:.95rem;font-weight:600}
.of-save{margin-top:14px;border:1px solid var(--citui-line-strong);border-radius:10px;padding:12px}
.of-chk{display:flex;gap:10px;align-items:flex-start;font-size:.92rem;line-height:1.45;cursor:pointer}
.of-chk input{width:20px;height:20px;margin:1px 0 0;flex:none;accent-color:var(--citui-navy-800)}
.of-chk small{display:block;color:var(--citui-muted);font-size:.8rem}
.of-sub{margin:10px 0 0 30px;display:grid;gap:8px}
.of-sub[hidden]{display:none}
.of-cons{margin-top:12px;border-left:4px solid var(--citui-cyan-500);background:color-mix(in srgb,var(--citui-cyan-500) 10%,var(--citui-white));padding:10px 12px;border-radius:6px;font-size:.9rem;line-height:1.55}
.of-cons--warn{border-left-color:var(--citui-warn);background:color-mix(in srgb,var(--citui-warn) 12%,var(--citui-white))}
.of-cons b{display:block;margin-bottom:2px}
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

/** What follows an amount in a sentence ("90 000 Ft" + " / éj") — perLabel without the sign. */
function perSuffix(lang: string, mode: string | undefined): string {
  if (mode === "per_person_night") return ` / ${T(lang, "fő / éj")}`;
  if (mode === "per_stay") return ` ${T(lang, "a teljes tartózkodásra")}`;
  return ` / ${T(lang, "éj")}`;
}

/** GET (and POST-with-errors) of the owner's offer page — contract ②–⑧. */
export function ownerOfferPage(
  v: OfferView,
  opts: { errors?: string[]; amount?: string; into?: boolean; save?: string; note?: string } = {},
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
      `</div></li>`
    : "";

  // ── ADR-XXXX (approved plan booking-offer-scope „A"): where the price goes ──────────
  // Default: THIS request only. A ticked „Mentsem az árlistába is?" offers the asked nights
  // or the timeless base, and the sentence under it says what each does to the guest's page.
  const runs = missingRuns(missing);
  const range = runs
    .map((r) => `${huDate(r.from, lang)} – ${huDate(addDays(r.to, 1), lang)}`)
    .join(", ");
  const whole = v.unitKind === "whole";
  const Unit = whole ? T(lang, "Az egész szállás") : T(lang, "Ez a szoba");
  const unit = whole ? T(lang, "az egész szállás") : T(lang, "ez a szoba");
  const cons = {
    request: {
      head: T(lang, "Csak erre a kérésre."),
      body: T(
        lang,
        "Az árlistája nem változik: ahol nincs ára, ott a vendégek a honlapon továbbra is árajánlatot kérnek, és a következő kérésre újra Ön ad árat. Az ajánlat nyoma a Foglalások fül „Kiküldött ajánlatok” részében marad.",
      ),
    },
    dates: {
      head: T(lang, "A kért napokra az árlistába kerül ({range}).", { range }),
      body: T(
        lang,
        "Ezekre az éjszakákra {unit} a honlapon {price} áron, árajánlat-kérés nélkül is foglalható; más napokra továbbra is árajánlatot kérnek. A tartózkodás utolsó éjszakája után az ár lekerül az árlistáról.",
        { unit },
      ),
    },
    base: {
      head: T(lang, "Alapárként az árlistába kerül — dátum nélkül, a következő módosításig."),
      body:
        T(lang, "{unit} ettől foglalhatóvá válik: a vendég a honlapon {price} áron, árajánlat-kérés nélkül küldhet foglalási kérést.", {
          unit: Unit,
        }) +
        (v.opensWidget ? " " + T(lang, "A foglalási doboz is ezzel nyílik.") : "") +
        " " +
        (seasonNames
          ? T(lang, "Minden éjszakára érvényes, amelyre nincs szezonár — a szezonárak ({seasons}) a saját árukon maradnak —, és a honlap „Árak” részében is megjelenik.", {
              seasons: seasonNames,
            })
          : T(lang, "Minden éjszakára érvényes, amelyre nincs szezonár, és a honlap „Árak” részében is megjelenik.")),
    },
    pick: {
      head: T(lang, "Válassza ki, hogyan kerüljön az árlistába."),
      body: "",
    },
  };
  const into = !!opts.into;
  const picked = into ? (opts.save === "dates" || opts.save === "base" ? opts.save : "pick") : "request";
  const yourPrice = T(lang, "az Ön által megadott");
  const consHtml = (k: keyof typeof cons): string =>
    `<b>${esc(cons[k].head)}</b>${cons[k].body ? " " + esc(cons[k].body.split("{price}").join(yourPrice)) : ""}`;
  const saveBlock = missing.length
    ? `<div class="of-save">` +
      `<label class="of-chk"><input type="checkbox" name="into" value="1" data-into${into ? " checked" : ""}>` +
      `<span><b>${T(lang, "Mentsem az árlistába is?")}</b><small>${T(lang, "Alapból nem: az ár csak ennek a kérésnek szól.")}</small></span></label>` +
      // Visible without JS (a no-JS owner must be able to choose); the script hides it
      // while the box is unticked.
      `<div class="of-sub" data-sub>` +
      `<label class="of-chk"><input type="radio" name="save" value="dates"${opts.save === "dates" ? " checked" : ""}>` +
      `<span>${T(lang, "Csak a kért napokra")}<small>${esc(range)}</small></span></label>` +
      `<label class="of-chk"><input type="radio" name="save" value="base"${opts.save === "base" ? " checked" : ""}>` +
      `<span>${T(lang, "Alapárként")}<small>${T(lang, "dátum nélkül, a következő módosításig")}</small></span></label>` +
      `</div></div>` +
      `<div class="of-cons${picked === "request" ? "" : " of-cons--warn"}" data-cons aria-live="polite">${consHtml(picked)}</div>`
    : "";

  // Client strings are translated HERE, on the server — the script only picks them.
  const msg = {
    num: T(lang, "Csak számot írjon, pl. 26 000."),
    pos: T(lang, "Az ár legyen nagyobb nullánál."),
    big: T(lang, "Ez túl nagy összeg — ellenőrizze a nullákat."),
    empty: T(lang, "írja be az árat"),
    yourPrice,
    cons,
  };
  const cfg = {
    missing: missing.length,
    arrivalMissing: missing[0] === v.dateFrom,
    known: knownSum,
    mul: guestsMul,
    mode,
    lang,
    currency: v.currency ?? "HUF",
    per: perSuffix(lang, mode),
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
    `<dt>${T(lang, "Amit kér")}</dt><dd>${esc(v.unitName ?? "")}</dd>` +
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
    `<label class="of-lbl" for="of-note">${T(lang, "Üzenet a vendégnek (nem kötelező)")}</label>` +
    `<textarea id="of-note" name="note" maxlength="1000" placeholder="${esc(T(lang, "pl. A kiságyat szívesen odakészítjük, díjmentesen."))}">${esc(opts.note ?? "")}</textarea>` +
    saveBlock +
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
if(!f)return;var A=f.querySelector("[data-amount]"),S=f.querySelector("[data-send]"),I=f.querySelector("[data-into]"),B=f.querySelector("[data-sub]"),K=f.querySelector("[data-cons]");
function grp(n){return CitMoney.formatNumber(n,"hu");}
function money(n){return CitMoney.formatMoney(n,C.currency,C.lang);}
function parse(raw){var s=String(raw||"").replace(/[\\s.\\u00a0]/g,"").replace(/ft$/i,"");if(s==="")return{empty:1};if(!/^\\d+$/.test(s))return{error:C.msg.num};var n=parseInt(s,10);if(!(n>0))return{error:C.msg.pos};if(n>10000000)return{error:C.msg.big};return{value:n};}
function pick(){if(!I||!I.checked)return"request";var r=f.querySelector("input[name=save]:checked");return r?r.value:"pick";}
function run(){
 if(!C.missing){S.disabled=false;return;}
 var r=parse(A.value),ae=f.querySelector("[data-amount-err]");ae.textContent=r.error||"";A.setAttribute("aria-invalid",r.error?"true":"false");
 B.hidden=!I.checked;
 var k=pick(),m=C.msg.cons[k],price=r.value?money(r.value)+C.per:C.msg.yourPrice;
 K.textContent="";var b=document.createElement("b");b.textContent=m.head;K.appendChild(b);
 if(m.body)K.appendChild(document.createTextNode(" "+m.body.split("{price}").join(price)));
 K.className="of-cons"+(k==="request"?"":" of-cons--warn");
 var add=0;if(r.value){add=C.mode==="per_stay"?(C.arrivalMissing?r.value:0):r.value*C.missing*C.mul;}
 var total=r.value?(C.mode==="per_stay"?(C.arrivalMissing?r.value:C.known):C.known+add):null;
 f.querySelector("[data-sum]").textContent=r.value?money(C.mode==="per_stay"?(C.arrivalMissing?r.value:0):add):"\\u2014";
 var t=f.querySelector("[data-total]");t.textContent=total?money(total):C.msg.empty;t.classList.toggle("of-empty",!total);
 S.disabled=!total||k==="pick";
}
if(C.missing){A.addEventListener("input",run);A.addEventListener("blur",function(){var r=parse(A.value);if(r.value)A.value=grp(r.value);});
I.addEventListener("change",function(){if(I.checked&&!f.querySelector("input[name=save]:checked"))f.querySelector("input[name=save][value=dates]").checked=true;run();});
f.querySelectorAll("input[name=save]").forEach(function(x){x.addEventListener("change",run);});}
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
      `<p style="margin-top:20px"><a class="citui-btn citui-btn--ghost" href="/admin?tab=foglalasok">${T(lang, "Foglalások megnyitása")}</a></p></div>`,
  );
}

/** POST success — contract step 3 (the owner's own card). Its button opens the Foglalások tab
 *  at „Kiküldött ajánlatok" (ADR-XXXX) — it used to open the booking MODULE settings, a page
 *  with no request on it (tudásbázis-őr, 2026-09-29). */
export function ownerOfferSentPage(r: SendOfferResult, hostName: string): string {
  const lang = r.lang;
  const money = (n: number): string => formatMoney(n, r.currency, lang);
  // ADR-XXXX: say where the price went — the list is untouched unless the owner chose so.
  const price = r.amount ? money(r.amount) + perSuffix(lang, r.unitMode) : "";
  const range = (r.runs ?? []).map((w) => `${huDate(w.from, lang)} – ${huDate(addDays(w.to, 1), lang)}`).join(", ");
  const intoLine = !r.amount
    ? ""
    : r.savedAs === "dates"
      ? T(lang, "A kért napokra ({range}) bekerült az árlistába: {price}.", { range, price })
      : r.savedAs === "base"
        ? T(lang, "Alapárként bekerült az árlistába: {price}.", { price })
        : T(lang, "Az árlistája nem változott — ahol nincs ára, ott továbbra is árajánlatot kérnek.");
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
      `<p style="margin-top:20px"><a class="citui-btn citui-btn--ghost" href="/admin?tab=foglalasok#kikuldott-ajanlatok">${T(lang, "Foglalások megnyitása")}</a></p></div>`,
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
