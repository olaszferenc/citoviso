// Tenant admin views (ADR-0023) — styled with the design core (citui.css).
// Server-rendered HTML; Post/Redirect/Get for mutations. No framework (node:http).

import type { TenantSession } from "../auth/tenantAuth.js";
import { GROUP_LABELS, type ModuleGroup } from "../modules.js";
import type { PhotoEdit, TenantContentEdits } from "../tenant/editor.js";
import type { TenantModuleView } from "../tenant/modules.js";
import { MODCFG_STYLE, hasSettingsScreen } from "./moduleConfigViews.js";
import { bookingsSection } from "./bookingViews.js";
import type { BookingsTabData } from "./bookingViews.js";
import { domAnchorsOf } from "./modulePreview.js";
import type { TrafficReport } from "../analytics/trafficReport.js";
import type { DomainAdminData, DomainCheckResult } from "../domains/domainAdmin.js";
import type { SubscriptionAdminData } from "../tenant/subscriptionAdmin.js";
import { proratedFirstChargeMonths } from "../tenant/moduleUpsell.js";
import type { TenantLegalIdentity } from "../legal.js";
import { ic } from "../ui/icons.js";
// ADR-0067: the tenant admin is a CUSTOMER surface — every label reads from the
// language pack. `lang` is the site's own language, threaded from the content.
import { T } from "../i18n/mail.js";
import { foldIncludes } from "../text/fold.js";

/** Cache-busting asset version: stamped at module load so each deploy serves
 *  fresh CSS through the CDN without a cache purge. */
const ASSET_V = String(Date.now());

type AdminContent =
  | (TenantContentEdits & {
      photos: PhotoEdit[];
      usingOwnPhotos: boolean;
      status: string;
      previewPath: string | null;
      /** ADR-0067: the site's own language — the whole admin renders in it. */
      lang?: string;
    })
  | null;

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function shell(title: string, body: string, lang = "hu"): string {
  return (
    `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="robots" content="noindex">` +
    `<link rel="preconnect" href="https://fonts.googleapis.com">` +
    `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">` +
    `<link rel="icon" href="/assets/ui/mark-gradient.svg" type="image/svg+xml">` +
    `<link rel="stylesheet" href="/assets/ui/citui.css?v=${ASSET_V}"><title>${esc(title)}</title></head>` +
    `<body style="background:var(--citui-surface)">${body}</body></html>`
  );
}

const LOGO =
  `<a class="citui-brand citui-brand--ink" href="/" style="justify-content:center">` +
  `<svg class="citui-brand__mark" viewBox="0 0 48 48" aria-hidden="true">` +
  `<path d="M34.5 10.5A17 17 0 1 0 34.5 37.5" fill="none" stroke="#1fb6d6" stroke-width="6" stroke-linecap="round"/>` +
  `<circle cx="22.5" cy="24" r="4.5" fill="#16283f"/><path d="M34 18.5 42 24l-8 5.5z" fill="#1fb6d6"/></svg>` +
  `<span>Citoviso</span></a>`;

// Icons come from the shared bespoke set (src/ui/icons.ts) — one icon language
// across every first-party surface.

/** Admin design system lives in the central design core (ADR-0021 ①):
 *  /assets/ui/citui-admin.css (scoped .adm-*, token-driven on citui.css).
 *  No embedded stylesheet here — change the core, the admin follows. */
const ADM_STYLE = `<link rel="stylesheet" href="/assets/ui/citui-admin.css?v=${ASSET_V}">`;

/** ADR-0045 §J: contextual help on a card head. The data-kb-anchor is the coverage
 *  hook (kb-check --coverage): a section carrying it MUST have a KB entry. */
function helpLink(anchor: string, lang = "hu"): string {
  return (
    `<a class="adm-help" data-kb-anchor="${anchor}" href="/admin?tab=sugo&topic=${encodeURIComponent(anchor)}" ` +
    `title="${T(lang, "Súgó ehhez a részhez")}">${ic("help", 18)}</a>`
  );
}


/** Photos card — current gallery (with remove when own) + upload. */
function photosCard(
  content: NonNullable<AdminContent>,
  units: readonly { id: string; name: string }[] = [],
  lang = "hu",
): string {
  const photos = content.photos ?? [];
  const notice = content.usingOwnPhotos
    ? `<p class="citui-hint">${T(lang, "A saját fotóid láthatók az oldaladon.")}</p>`
    : `<p class="citui-hint" style="color:var(--citui-warn)">${T(lang, "Jelenleg bemutató (demó) képek láthatók. Tölts fel saját fotókat — az élesítéshez a saját, jogtiszta képeid szükségesek.")}</p>`;
  // ADR-0044: order + caption. Every template uses photos[0] as the cover, so
  // "legyen ez a főkép" is the most valuable control here — and the gallery module's
  // help text has been promising ordering while this tab offered none.
  const items = photos
    .map((p, i) => {
      const move = (to: string, label: string, title: string) =>
        `<form method="POST" action="/admin/photos/order" style="margin:0">` +
        `<input type="hidden" name="url" value="${esc(p.url)}">` +
        `<input type="hidden" name="to" value="${to}">` +
        `<button class="adm-photo-btn" title="${esc(title)}">${label}</button></form>`;
      return (
        `<figure class="adm-photo${i === 0 ? " is-cover" : ""}" style="margin:0">` +
        `<img src="${esc(p.url)}" alt="${esc(p.alt)}" loading="lazy">` +
        (i === 0 ? `<span class="adm-photo__badge">${T(lang, "Nyitókép")}</span>` : "") +
        (content.usingOwnPhotos
          ? `<form method="POST" action="/admin/photos/delete" class="adm-photo__del">` +
            `<input type="hidden" name="url" value="${esc(p.url)}">` +
            `<button title="${T(lang, "Törlés")}" class="adm-photo-del">×</button></form>`
          : "") +
        `<div class="adm-photo__bar">` +
        (i > 0 ? move("cover", "★", T(lang, "Legyen ez a nyitókép")) : "") +
        (i > 0 ? move("up", "‹", T(lang, "Előrébb")) : "") +
        (i < photos.length - 1 ? move("down", "›", T(lang, "Hátrébb")) : "") +
        `</div>` +
        `<form method="POST" action="/admin/photos/caption" class="adm-photo__cap">` +
        `<input type="hidden" name="url" value="${esc(p.url)}">` +
        `<input class="citui-input" name="alt" value="${esc(p.alt)}" placeholder="${T(lang, "Mi látszik a képen?")}" ` +
        `aria-label="${T(lang, "Képaláírás")}">` +
        `<button class="citui-btn citui-btn--ghost" type="submit">${T(lang, "Mentés")}</button>` +
        `</form>` +
        // ADR-0044/d — ONE shared photo library: the owner uploads a picture once and
        // ticks where it belongs. Only shown with several units; a single-unit owner
        // must never meet the concept.
        (units.length > 1
          ? `<form method="POST" action="/admin/photos/units" class="adm-photo__units">` +
            `<input type="hidden" name="url" value="${esc(p.url)}">` +
            `<span class="adm-photo__units-lbl">${T(lang, "Melyik egységhez?")}</span>` +
            units
              .map(
                (u) =>
                  `<label><input type="checkbox" name="unit" value="${esc(u.id)}"` +
                  `${(p.units ?? []).includes(u.id) ? " checked" : ""}> ${esc(u.name)}</label>`,
              )
              .join("") +
            `<button class="citui-btn citui-btn--ghost" type="submit">${T(lang, "Mentés")}</button></form>`
          : "") +
        `</figure>`
      );
    })
    .join("");
  const grid = photos.length
    ? `<p class="citui-hint">${T(lang, "Az {b} — az jelenik meg legnagyobban az oldalán. A ★ gombbal bármelyiket előre hozhatja.", { b: `<strong>${T(lang, "első kép a nyitókép")}</strong>` })}</p><div class="adm-gallery">${items}</div>`
    : `<p class="citui-hint">${T(lang, "Még nincs kép.")}</p>`;
  return (
    `<div class="adm-card"><div class="adm-card__head"><span class="adm-ico">${ic("photos")}</span><h2>${T(lang, "Fotók")}</h2>${helpLink("admin.photos", lang)}</div>${notice}${grid}` +
    `<div class="citui-field" style="margin-top:16px"><input type="file" id="photo-input" accept="image/jpeg,image/png,image/webp" multiple></div>` +
    `<button class="citui-btn citui-btn--primary" id="photo-upload" type="button">${T(lang, "Kiválasztott fotók feltöltése")}</button>` +
    `<p class="citui-hint" id="photo-note"></p></div>`
  );
}

// A FUNCTION of the reader's language (ADR-0067): the inline script's own
// user-visible messages are localized SERVER-side and interpolated in, so the
// browser never has to carry a second translation mechanism.
const UPLOAD_SCRIPT = (lang = "hu"): string =>
  `<script>(function(){` +
  `var inp=document.getElementById('photo-input'),btn=document.getElementById('photo-upload'),note=document.getElementById('photo-note');` +
  `if(!inp||!btn)return;` +
  `function read(f){return new Promise(function(res,rej){var r=new FileReader();r.onload=function(){res(r.result)};r.onerror=rej;r.readAsDataURL(f)})}` +
  `btn.addEventListener('click',async function(){var files=[].slice.call(inp.files||[]);` +
  `if(!files.length){note.textContent='${T(lang, "Válassz ki képeket.")}';return;}` +
  `btn.disabled=true;note.textContent='${T(lang, "Feltöltés…")}';` +
  `try{var images=[];for(var i=0;i<files.length;i++){if(files[i].size>6000000){continue;}var d=await read(files[i]);images.push({dataUrl:d,alt:''});}` +
  `if(!images.length){note.textContent='${T(lang, "A képek túl nagyok (max 6 MB).")}';btn.disabled=false;return;}` +
  `var r=await fetch('/admin/photos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({images:images})});` +
  `var j=await r.json();if(j&&j.ok){location.href='/admin?saved=1';}else{note.textContent='${T(lang, "Hiba a feltöltéskor.")}';btn.disabled=false;}}` +
  `catch(e){note.textContent='${T(lang, "Hiba a feltöltéskor.")}';btn.disabled=false;}});})();</script>`;

/** Login page — enter username + password. */
export function loginPage(
  msg?: { text: string; kind: "info" | "bad" },
  consoleLoginUrl = "",
  lang = "hu",
): string {
  const note = msg
    ? `<p class="citui-hint" style="text-align:center;color:${msg.kind === "bad" ? "var(--citui-bad)" : "var(--citui-ok)"}">${esc(msg.text)}</p>`
    : "";
  const pwToggle =
    `<script>function citPwT(id,btn){var i=document.getElementById(id);` +
    `var show=i.type==='password';i.type=show?'text':'password';btn.textContent=show?'elrejt':'mutat';}</script>`;
  return shell(
    T(lang, "Ügyfél-belépés"),
    `${pwToggle}<div class="citui-container" style="max-width:420px;padding:64px 0">` +
      `<div style="text-align:center;margin-bottom:24px">${LOGO}</div>` +
      `<div class="citui-card">` +
      `<h1 style="font-size:1.5rem;text-align:center">${T(lang, "Ügyfél-belépés")}</h1>` +
      `<p class="citui-hint" style="text-align:center;margin-bottom:18px">${T(lang, "A honlapod kezeléséhez add meg a felhasználóneved és a kapott jelszót.")}</p>` +
      `<form method="POST" action="/login">` +
      `<div class="citui-field"><label class="citui-label" for="username">${T(lang, "Felhasználónév")}</label>` +
      `<input class="citui-input" id="username" name="username" required autocapitalize="none" autocorrect="off" autofocus placeholder="pl. napfeny-panzio"></div>` +
      `<div class="citui-field"><label class="citui-label" for="password">${T(lang, "Jelszó")}</label>` +
      `<div style="display:flex;gap:8px;align-items:center">` +
      `<input class="citui-input" id="password" name="password" type="password" required placeholder="${T(lang, "a kapott jelszó")}" style="flex:1">` +
      `<button type="button" class="citui-btn citui-btn--ghost citui-btn--sm" onclick="citPwT('password',this)">mutat</button></div></div>` +
      `<button class="citui-btn citui-btn--primary" type="submit" style="width:100%">${T(lang, "Belépés")}</button>` +
      `</form>${note}` +
      `<p class="citui-hint" style="text-align:center;margin-top:16px"><a href="/login/help">${T(lang, "Elfelejtett jelszó?")}</a> · <a href="/">${T(lang, "Vissza a főoldalra")}</a></p>` +
      `</div>` +
      (consoleLoginUrl
        ? `<p class="citui-hint" style="text-align:center;margin-top:14px">${T(lang, "Citoviso-munkatárs vagy?")} <a href="${esc(consoleLoginUrl)}">${T(lang, "Belépés a belső konzolba ▸")}</a></p>`
        : "") +
      `</div>`,
    lang,
  );
}

/** Tenant password-recovery help — honest path until the sending domain is live. */
export function loginHelpPage(contactEmail: string, lang = "hu"): string {
  return shell(
    T(lang, "Elfelejtett jelszó"),
    `<div class="citui-container" style="max-width:480px;padding:64px 0">` +
      `<div style="text-align:center;margin-bottom:24px">${LOGO}</div>` +
      `<div class="citui-card"><h1 style="font-size:1.4rem">${T(lang, "Elfelejtett jelszó")}</h1>` +
      `<p class="citui-hint">A belépési adataidat az aktiváláskor e-mailben küldtük el — érdemes először
       ott keresni („Citoviso belépési adatok").</p>` +
      `<p class="citui-hint">${T(lang, "Ha nincs meg, írj nekünk a(z)")} <strong>${esc(contactEmail)}</strong> címre a
       vállalkozásod nevével, és új jelszót adunk ki. Az önkiszolgáló visszaállítás hamarosan elérhető lesz.</p>` +
      `<p class="citui-hint">${T(lang, "Belépés után a jelszavadat a Kezelőfelület „Fiók” részében bármikor megváltoztathatod.")}</p>` +
      `<p style="margin-top:14px"><a class="citui-btn citui-btn--primary" href="/login">${T(lang, "← Vissza a belépéshez")}</a></p>` +
      `</div></div>`,
    lang,
  );
}

/** After requesting a link. */
export function linkSentPage(lang = "hu"): string {
  return shell(
    T(lang, "Link elküldve"),
    `<div class="citui-container" style="max-width:420px;padding:64px 0;text-align:center">` +
      `<div style="margin-bottom:24px">${LOGO}</div>` +
      `<div class="citui-card"><h1 style="font-size:1.4rem">${T(lang, "Elküldtük a belépő linket")}</h1>` +
      `<p class="citui-hint">${T(lang, "Ha van fiók ezzel az e-mail-címmel, perceken belül megérkezik a belépő link. A link 30 percig érvényes.")}</p></div></div>`,
    lang,
  );
}

export function verifyErrorPage(lang = "hu"): string {
  return shell(
    T(lang, "Érvénytelen link"),
    `<div class="citui-container" style="max-width:420px;padding:64px 0;text-align:center">` +
      `<div class="citui-card"><h1 style="font-size:1.4rem">${T(lang, "A link érvénytelen vagy lejárt")}</h1>` +
      `<p class="citui-hint">${T(lang, "Kérj egy új belépő linket.")}</p>` +
      `<p><a class="citui-btn citui-btn--primary" href="/login">${T(lang, "Új link kérése")}</a></p></div></div>`,
    lang,
  );
}

/** ADR-0080: what POST /admin/modules just applied (flash from redirect params). */
export interface ModuleAppliedFlash {
  readonly added: string[];
  readonly cancelled: string[];
  readonly other: string[];
  /** ADR-0113: modules the instant MIT charge just paid for and switched on. */
  readonly charged?: string[];
  /** The amount that charge took (HUF), for the banner's honesty. */
  readonly chargedAmount?: number;
  /** ADR-0113: the MIT charge is in flight — the callback will activate. */
  readonly chargePending?: boolean;
  /** ADR-0094 ④: the change was refused — it would sink below the domain
   *  commitment's package floor (monthly, HUF). */
  readonly floorBlockedAt?: number | null;
  /** ADR-0119 ⑥: a NEW module could not be added because the site is suspended
   *  for non-payment. Cancellations in the same submit DID go through. */
  readonly frozenBlocked?: boolean;
}

/** ADR-0094 ② (approved plan B): how the danger zone must behave under a domain
 *  commitment — cancel routes through the interposed settlement page. */
export interface DomainSettleState {
  /** A commitment is running: the cancel button LINKS to the settlement page. */
  readonly commitmentActive: boolean;
  /** A recorded settlement is already PAID: resume is no longer offered. */
  readonly settlementPaid: boolean;
}

/**
 * Modules + subscription (ADR-0080, the approved B plan — the contract lives at
 * assets/design-refs/console/modules-billing/README.md):
 *   • subscription card on top: renewal day, current fee, NEXT invoice (live);
 *   • switches only PROPOSE — a sticky plan bar collects the diffs, states each
 *     consequence, shows the new total AND the delta, and applies on ONE button;
 *   • cancelled module: stays live until the paid period end, rejoin is free;
 *   • payment-state banners (past_due/frozen) with the pay-link;
 *   • whole-subscription cancel in a two-step danger zone (<details> = no-JS safe).
 */
export function modulesSection(
  mv: TenantModuleView,
  sub: SubscriptionAdminData | null,
  applied: ModuleAppliedFlash | null,
  contactEmail: string,
  domainSettle: DomainSettleState | null = null,
  lang = "hu",
): string {
  // Thousand-separated HUF; toLocaleString is unreliable without full ICU on the server.
  const huf = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} Ft`;
  const renewDate = sub?.periodEnd ?? "";
  // ADR-0113 ②: months the first charge covers — the SAME rule the order is
  // priced with (moduleUpsell), so the bar can never promise a different amount.
  const fcMonths = sub ? proratedFirstChargeMonths(sub.billingPeriod, new Date(sub.periodEnd)) : 1;
  const labelOf = (id: string) => mv.modules.find((m) => m.id === id)?.label ?? id;

  // ── ADR-0080 ⑥ · approved plan "A — Teendő-kártya"
  //    (assets/design-refs/console/freeze-state/) ──
  //
  // The freeze used to be a thin banner INSIDE the subscription card, where the
  // card head's negative top margin (full-bleed navy band) overlapped its bottom
  // edge, and where the amount owed never appeared at all. It is now its own
  // card ABOVE everything: the debt is the biggest figure on the screen and the
  // settle button sits directly under it — not 3 000 pixels away next to a
  // different purchase.
  const frozen = sub?.status === "frozen";
  let stateCard = "";
  if (sub && frozen) {
    const owed = sub.arrears ? huf(sub.arrears.amount) : null;
    const money =
      `<div class="adm-owe">` +
      `<div class="adm-owe__l">${T(lang, "Rendezendő tartozás")}</div>` +
      // No arrears row can only mean the ladder has not minted the order yet —
      // say that instead of printing a confident zero (§B.17).
      `<div class="adm-owe__v">${owed ? esc(owed) : T(lang, "összesítés alatt")}</div>` +
      (sub.arrears
        ? `<div class="adm-owe__sub">${T(lang, "a {from} – {to} időszak díja", { from: esc(sub.arrears.periodStart), to: esc(sub.arrears.periodEnd) })}</div>`
        : "") +
      `</div>` +
      (sub.payUrl
        ? `<a class="citui-btn citui-btn--primary adm-owe__pay" href="${esc(sub.payUrl)}">` +
          (owed ? T(lang, "Befizetem — {amount}", { amount: esc(owed) }) : T(lang, "Díj rendezése")) +
          `</a>`
        : "") +
      `<p class="adm-owe__note">${T(lang, "Bankkártyával, a Barion biztonságos oldalán. A befizetés után a honlap magától, azonnal visszakapcsol.")}</p>`;
    const facts =
      `<li>${T(lang, "A vendégek most egy udvarias, „átmenetileg nem elérhető” lapot látnak az Ön nevével és elérhetőségével — nem hibaüzenetet.")}</li>` +
      `<li>${T(lang, "<b>{date}</b>-ig rendezhető. Utána az előfizetés lezárul és a honlap lekerül.", { date: esc(sub.closesOn) })}</li>` +
      `<li>${T(lang, "A moduljai megmaradnak, csak szünetelnek — semmi nem vész el.")}</li>`;
    stateCard =
      `<section class="adm-card adm-state adm-state--bad">` +
      `<div class="adm-card__head adm-state__head"><span class="adm-sub__dot adm-state__dot"></span>` +
      `<h2>${T(lang, "A honlapja jelenleg NEM elérhető")}</h2></div>` +
      `<div class="adm-state__grid">` +
      `<div class="adm-state__money">${money}</div>` +
      `<div class="adm-state__text">` +
      `<p>${T(lang, "{date} óta a látogatói nem érik el az oldalát. A tartalom nem veszett el.", { date: esc(sub.frozenOn ?? sub.periodEnd) })}</p>` +
      `<ul>${facts}</ul>` +
      `</div></div></section>`;
  } else if (sub?.restoredOn) {
    // The return is as loud as the freeze was (ADR-0080 ⑥) — same slot, same
    // weight, green. Until now the only positive signal was an absence.
    stateCard =
      `<section class="adm-card adm-state adm-state--ok">` +
      `<div class="adm-card__head adm-state__head"><span class="adm-sub__dot adm-state__dot"></span>` +
      `<h2>${T(lang, "A honlapja újra elérhető")}</h2></div>` +
      `<div class="adm-state__grid"><div class="adm-state__text">` +
      `<p>${T(lang, "A díj rendezve — {date} óta a látogatói ismét elérik az oldalát, változatlan tartalommal.", { date: esc(sub.restoredOn) })}</p>` +
      `<p class="citui-hint">${T(lang, "A számlát elküldtük e-mailben; az automatikus kártyaterhelés a következő fordulónaptól újra él.")}</p>` +
      `</div></div></section>`;
  }
  // The past_due warning stays a banner — but OUTSIDE the card, because the card
  // head's negative top margin was eating its bottom border (measured 2026-09-11).
  const banner =
    sub?.status === "past_due"
      ? `<div class="adm-banner adm-banner--warn"><b>${T(lang, "Rendezetlen díj.")}</b> ` +
        `${T(lang, "A {date}-i számla még nincs kifizetve. Kérjük, rendezze, különben a honlapot fel kell függesztenünk.", { date: esc(renewDate) })}` +
        (sub.payUrl
          ? `<br><a class="citui-btn citui-btn--primary" href="${esc(sub.payUrl)}">${T(lang, "Díj rendezése")}</a>`
          : "") +
        `</div>`
      : "";

  // ── subscription card ──
  let subCard = "";
  if (sub) {
    const dotCls =
      sub.status === "frozen" ? " adm-sub__dot--bad" : sub.status === "past_due" ? " adm-sub__dot--warn" : "";
    const itemRows =
      `<div class="adm-sub__row"><span>${T(lang, "Alapdíj (honlap + időpontkérés)")}</span><b>${esc(huf(mv.baseMonthly))}</b></div>` +
      sub.nextInvoiceItems
        .map(
          (i) =>
            `<div class="adm-sub__row"><span>${esc(T(lang, i.label))}${i.isNew ? ` <span class="adm-sub__new">· ${T(lang, "új")}</span>` : ""}</span><b>${esc(huf(i.price))}</b></div>`,
        )
        .join("");
    // ── ADR-0088 §8 (approved B plan: design-refs/console/period-switch) ──
    // monthly + not armed → savings box with the switch CTA; armed → green
    // confirmation with the HONEST effective date, the finality sentence and
    // the revert button; annual → a quiet cadence line, no revert (the paid
    // year is final — owner ruling 2026-09-01).
    const annual = sub.billingPeriod === "annual";
    const effDate = sub.pendingEffectiveDate ?? renewDate;
    const nextCell = sub.pendingAnnual
      ? `${esc(huf(sub.annualTotal))} <span class="adm-sub__evchip">${T(lang, "éves")}</span>`
      : esc(huf(annual ? sub.annualTotal : sub.nextInvoiceTotal));
    const feeCell = annual
      ? T(lang, "{price}/év", { price: esc(huf(sub.annualTotal)) })
      : T(lang, "{price}/hó", { price: esc(huf(mv.totalMonthly)) });
    let periodBlock = "";
    if (!annual && !sub.pendingAnnual && sub.status !== "cancelled" && !sub.cancelAtPeriodEnd) {
      periodBlock =
        `<div class="adm-annual">` +
        `<h3>${T(lang, "{n} hónap ajándék évente", { n: String(sub.annualFreeMonths) })}</h3>` +
        `<p>${T(lang, "Éves fizetésre váltva 12 hónapot kap {paid} havi díj áráért — a mostani modul-készletével ez {save} megtakarítás évente.", { paid: String(12 - sub.annualFreeMonths), save: esc(huf(sub.annualSavings)) })}</p>` +
        `<div class="adm-annual__nums"><b>${esc(huf(sub.annualTotal))}</b><span>${T(lang, "/ év · {eq}/hó-nak felel meg", { eq: esc(huf(Math.round(sub.annualTotal / 12))) })}</span></div>` +
        `<form method="POST" action="/admin/subscription/period-annual">` +
        `<button class="adm-annual__cta" type="submit">${T(lang, "Váltok éves fizetésre a következő fordulónaptól")}</button>` +
        `</form>` +
        `</div>`;
    } else if (sub.pendingAnnual) {
      periodBlock =
        `<div class="adm-applied" role="status"><b>${T(lang, "Kész.")}</b> ` +
        T(lang, "A váltás a következő fordulónaptól ({date}) él — a következő éves számla {price} lesz (12 hónap, ebből {n} ajándék). Most nem fizet semmit.", {
          date: esc(effDate),
          price: esc(huf(sub.annualTotal)),
          n: String(sub.annualFreeMonths),
        }) +
        ` <b>${T(lang, "A fordulónapig meggondolhatja magát; az éves számla kifizetése után a váltás végleges, az éves díj a teljes évre szól.")}</b>` +
        `<form method="POST" action="/admin/subscription/period-monthly">` +
        `<button class="adm-annual__undo" type="submit">${T(lang, "Mégsem — maradok a havi fizetésnél")}</button>` +
        `</form>` +
        `</div>`;
    } else if (annual) {
      periodBlock = `<p class="adm-annual__now">${T(lang, "Fizetés üteme: éves ({n} hónap ajándékkal) · a következő megújulás: {date}.", { n: String(sub.annualFreeMonths), date: esc(renewDate) })}</p>`;
    }
    // ── ADR-0088 ⑨ (approved B plan: design-refs/console/mandate-coupon) ──
    // The stored-card mandate has been charging since ADR-0080 ④ while being
    // invisible here. It is now stated, and revoking it is TWO steps: the button
    // opens a confirm dialog that spells out the consequences (owner ruling
    // 2026-09-01) — a one-click revoke would drop the tenant into the dunning
    // ladder without them realising what they gave up.
    const mandateBlock = sub.autoCharge
      ? frozen
        ? // An "enabled, nothing to do" mandate under a suspension notice is the
          // exact contradiction the owner caught (2026-09-11). Under a freeze the
          // mandate is the reason the ladder ran at all: the charge FAILED. Say so.
          `<div class="adm-mand">` +
          `<div class="adm-mand__ico">${ic("card")}</div>` +
          `<div class="adm-mand__txt">` +
          `<span class="adm-mand__pill adm-mand__pill--off">${T(lang, "NEM SIKERÜLT")}</span>` +
          `<h3>${T(lang, "Az automatikus kártyaterhelés elakadt")}</h3>` +
          `<p>${T(lang, "A mentett kártyáról nem sikerült levonni a díjat, ezért a terhelés leállt. A fenti befizetéssel a megbízás újra él — addig a díjat Önnek kell rendeznie.")}</p>` +
          `<button class="adm-mand__btn" type="button" data-mand-revoke>${T(lang, "Megbízás visszavonása")}</button>` +
          `</div></div>`
        : `<div class="adm-mand">` +
          `<div class="adm-mand__ico">${ic("card")}</div>` +
          `<div class="adm-mand__txt">` +
          `<span class="adm-mand__pill adm-mand__pill--on">${T(lang, "BEKAPCSOLVA")}</span>` +
          `<h3>${T(lang, "Automatikus kártyaterhelés")}</h3>` +
          `<p>${T(lang, "A fordulónapon magától levonjuk a díjat a mentett kártyáról — nincs teendője. A terhelés előtt 3 nappal e-mailt küldünk.")}</p>` +
          `<button class="adm-mand__btn" type="button" data-mand-revoke>${T(lang, "Megbízás visszavonása")}</button>` +
          `</div></div>`
      : `<div class="adm-mand">` +
        `<div class="adm-mand__ico">${ic("card")}</div>` +
        `<div class="adm-mand__txt">` +
        `<span class="adm-mand__pill">${T(lang, "KIKAPCSOLVA")}</span>` +
        `<h3>${T(lang, "Fizetés díjbekérővel")}</h3>` +
        `<p>${T(lang, "A fordulónapon fizetési linket küldünk e-mailben, amit Önnek kell kiegyenlítenie. A díjfizetési kötelezettség változatlan.")}</p>` +
        // HONEST re-grant: a stored credential is bound by the card scheme to a
        // 3DS-challenged, customer-initiated payment, so there is no button that
        // can switch this back on by itself. The next pay-link payment re-grants
        // it — which is exactly what we say, instead of offering a fake switch.
        `<p class="adm-mand__hint">${T(lang, "Újra bekapcsolni a következő fizetési link kiegyenlítésekor tud: az a fizetés adja meg újra a megbízást (a bankkártyás megerősítés miatt).")}</p>` +
        (sub.payUrl
          ? `<a class="adm-mand__btn" href="${esc(sub.payUrl)}">${T(lang, "Díj rendezése és megbízás megadása")}</a>`
          : "") +
        `</div></div>`;

    subCard =
      stateCard +
      banner +
      `<div class="adm-card">` +
      `<div class="adm-card__head"><span class="adm-sub__dot${dotCls}"></span><h2>${T(lang, "Előfizetés")}</h2>${helpLink("admin.subscription", lang)}</div>` +
      `<div class="adm-sub">` +
      `<div class="adm-sub__cell"><div class="adm-sub__l">${T(lang, "Fordulónap")}</div><div class="adm-sub__v">${annual ? T(lang, "évente, {day}-a/-e", { day: String(sub.renewDay) }) : T(lang, "minden hónap {day}-a/-e", { day: String(sub.renewDay) })}</div></div>` +
      `<div class="adm-sub__cell"><div class="adm-sub__l">${T(lang, "Jelenlegi díj")}</div><div class="adm-sub__v">${feeCell}</div></div>` +
      // data-base/-mult: the live module-toggle sync recomputes THIS cell — with
      // the annual switch armed (or an annual sub) the base is the annual total
      // and every module delta counts 10× (ADR-0088 §8; a +490 Ft chip on a
      // 10-month invoice would understate the change — §B.17).
      `<div class="adm-sub__cell"><div class="adm-sub__l">${T(lang, "Következő számla ({date})", { date: esc(renewDate) })}</div><div class="adm-sub__v" id="adm-next-total" data-base="${sub.pendingAnnual || annual ? sub.annualTotal : sub.nextInvoiceTotal}" data-mult="${sub.pendingAnnual || annual ? 12 - sub.annualFreeMonths : 1}">${nextCell}</div></div>` +
      `</div>` +
      periodBlock +
      mandateBlock +
      `<details class="adm-sub__items"><summary>${annual || sub.pendingAnnual ? T(lang, "A következő számla tételei (éves díj = 10 havi díj)") : T(lang, "A következő számla tételei")}</summary>${itemRows}</details>` +
      `</div>`;
  }

  // ── applied-changes confirmation (after POST, from the redirect params) ──
  let appliedBox = "";
  if (
    applied &&
    (applied.added.length ||
      applied.cancelled.length ||
      applied.other.length ||
      applied.charged?.length ||
      applied.chargePending)
  ) {
    const parts = [
      // ADR-0113: the instant MIT charge — the banner owes the exact amount.
      applied.charged?.length
        ? T(lang, "A kártyáját megterheltük ({sum}) — mostantól él: {list}. A következő számlán már normál tételként szerepel.", {
            sum: esc(huf(applied.chargedAmount ?? 0)),
            list: applied.charged.map((id) => esc(T(lang, labelOf(id)))).join(", "),
          })
        : "",
      applied.chargePending
        ? T(lang, "A kártya-terhelés folyamatban van — az új modul a jóváíráskor magától élesedik.")
        : "",
      // ADR-0113: `added` now only ever carries FREE modules (a paid one rides
      // the charged/payment path) — no fee to promise.
      applied.added.length
        ? T(lang, "Mostantól él: {list} — díjmentes.", {
            list: applied.added.map((id) => esc(T(lang, labelOf(id)))).join(", "),
          })
        : "",
      applied.cancelled.length
        ? T(lang, "{date}-ig még aktív: {list} — utána lekerül az oldalról és a számláról.", {
            list: applied.cancelled.map((id) => esc(T(lang, labelOf(id)))).join(", "),
            date: esc(renewDate),
          })
        : "",
      applied.other.length
        ? T(lang, "Frissítve: {list}.", {
            list: applied.other.map((id) => esc(T(lang, labelOf(id)))).join(", "),
          })
        : "",
    ].filter(Boolean);
    appliedBox = `<div class="adm-applied" role="status"><b>${T(lang, "Kész.")}</b> ${parts.join(" ")}</div>`;
  }
  // ADR-0094 ④: refusal notice — the webcím commitment froze a package floor.
  if (applied?.floorBlockedAt) {
    appliedBox =
      `<div class="adm-applied" role="alert" style="background:color-mix(in srgb, var(--citui-bad) 10%, transparent);color:var(--citui-bad)">` +
      `<b>${T(lang, "A módosítás nem ment át.")}</b> ` +
      T(lang, "A saját webcíméhez vállalt hűségidő alatt a csomagja nem csökkenhet {floor}/hó alá. Bővíteni bármikor lehet; a csökkentés a hűségidő letelte után nyílik meg.", {
        floor: esc(huf(applied.floorBlockedAt)),
      }) +
      `</div>`;
  }
  // ADR-0119 ⑥: refusal notice — the shop is closed while the site is suspended.
  if (applied?.frozenBlocked) {
    appliedBox =
      `<div class="adm-applied" role="alert" style="background:color-mix(in srgb, var(--citui-bad) 10%, transparent);color:var(--citui-bad)">` +
      `<b>${T(lang, "Az új modult nem kapcsoltuk be.")}</b> ` +
      T(lang, "A honlapja felfüggesztése alatt nem tud új modult felvenni — előbb a rendezetlen díjat kell rendezni a lap tetején. A lemondásai viszont érvényesültek.") +
      `</div>`;
  }

  // ── ① AZ ÉN MODULJAIM / ② BŐVÍTÉS (ADR-0089) ─────────────────────────────
  // The old single list mixed what the tenant OWNS with what they could buy: the
  // first is a work surface (configure it, switch it off), the second is a shop —
  // and a bare switch plus a price chip never told the owner WHAT they would get.
  // A module is only sold if it can be SEEN (ADR-0015), hence the section
  // thumbnails and the full-page preview.
  // The focused module is always ADDED to the previewed set: "show me how it would
  // look" is asked about modules the tenant does not own yet, and a preview
  // rendered without it would answer with the page they already have.
  const previewHref = (focus: string, ids: readonly string[]): string => {
    const on = ids.includes(focus) ? ids : [...ids, focus];
    return `/admin/modules/preview?on=${encodeURIComponent(on.join(","))}#focus=${encodeURIComponent(focus)}`;
  };
  const committedIds = mv.modules.filter((m) => m.active && !m.supersededBy).map((m) => m.id);
  const eyeIcon = ic("preview", 16);

  /** The hidden-but-submitting checkbox every switchable module carries. The
   *  visible controls are <label>s bound to it, so the tab still works with no JS. */
  const cb = (m: TenantModuleView["modules"][number], checkedOn: boolean): string =>
    `<input type="checkbox" class="adm-mod__cb" name="module" value="${esc(m.id)}"${
      checkedOn ? " checked" : ""
    } data-committed="${checkedOn ? "1" : "0"}" data-price="${m.spine ? 0 : m.priceMonthly}"` +
    // ADR-0113: re-ticking a cancelled-but-still-active module is a FREE rejoin
    // (paid through the period) — the plan bar must not price it as a purchase.
    (m.active && m.cancelAtPeriodEnd ? ` data-rejoin="1"` : "") +
    ` data-label="${esc(T(lang, m.label))}" aria-label="${esc(T(lang, m.label))}">`;

  // ── approved contract: design-refs/console/modules-annual-pricing/ ──
  // An annual account was priced in "+490 Ft/hó" chips with no conversion and no
  // total (Elek FK-002 Z1/Z2, 2026-09-12): the owner of a 99 900 Ft/év plan could
  // not tell what switching a module on would cost him. The plan bar already spoke
  // the invoice's period (data-mult, ADR-0088 §8) — the STATIC chip did not. Same
  // multiplier, one source: a monthly fee lands (12 − free months) times on an
  // annual invoice.
  const annualMult = sub && sub.billingPeriod === "annual" ? 12 - sub.annualFreeMonths : 0;
  /** The price as the account is actually billed. Monthly accounts keep today's
   *  wording — an annual figure would be noise there, not honesty. */
  const priceForm = (monthly: number): string =>
    annualMult > 0
      ? T(lang, "+{price}/hó", { price: esc(huf(monthly)) }) +
        ` <em>${T(lang, "= {yearly}/év", { yearly: esc(huf(monthly * annualMult)) })}</em>`
      : T(lang, "+{price}/hó", { price: esc(huf(monthly)) });

  const priceChip = (m: TenantModuleView["modules"][number], replacedBy: string | null): string =>
    replacedBy
      ? `<span class="adm-chip adm-chip--off">${T(lang, "nem számítjuk")}</span>`
      : m.spine
        ? `<span class="adm-chip adm-chip--free">${T(lang, "az árban")}</span>`
        : `<span class="adm-chip">${priceForm(m.priceMonthly)}</span>`;

  // ADR-0088 ⑨: in the SHOP the tenant's live coupon must be VISIBLE and priced
  // in — until now it applied silently at checkout, so the discount could not
  // sell anything. Same floor math as the server (applyOffer); owned modules
  // keep the plain chip (their fee is already committed at list price).
  const coupon = sub?.coupon ?? null;
  const shopPriceChip = (m: TenantModuleView["modules"][number]): string => {
    if (m.spine) return `<span class="adm-chip adm-chip--free">${T(lang, "az árban")}</span>`;
    if (!coupon || m.priceMonthly <= 0) return priceChip(m, null);
    const discounted = Math.floor((m.priceMonthly * (100 - coupon.percent)) / 100);
    return (
      `<span class="adm-chip adm-chip--coupon">` +
      `<s>${esc(huf(m.priceMonthly))}</s> ` +
      // The coupon price rides the SAME period form — a discounted monthly figure
      // with no annual conversion would re-open the very gap this closes.
      priceForm(discounted) +
      `</span>`
    );
  };

  // ① Owned modules — the work surface.
  const mineRows = mv.modules
    .filter((m) => m.active)
    .map((m) => {
      const replacedBy = m.supersededBy
        ? mv.modules.find((x) => x.id === m.supersededBy)?.label
        : null;
      const state = replacedBy
        ? T(lang, "Ezt most a(z) „{other}” váltja ki — a kettő ugyanazon a helyen jelenne meg.", {
            other: esc(T(lang, replacedBy)),
          })
        : m.spine
          ? T(lang, "Mindig aktív — ezen keresztül keresik meg a vendégek.")
          : m.cancelAtPeriodEnd
            ? T(lang, "Lemondva — {date}-ig aktív marad (a kifizetett időszak végéig).", {
                date: esc(renewDate),
              })
            : // A module cannot claim to be live on the site while the site answers
              // 503 — measured: 11 rows said exactly that under the suspension
              // notice. The entitlement survives; only its visibility is paused.
              frozen
              ? T(lang, "Szünetel — a felfüggesztés alatt a vendégek nem látják.")
              : m.awaitingFirstCharge
                ? T(lang, "Él az oldalán — első díja a {date}-i számlán jelenik meg.", {
                    date: esc(renewDate),
                  })
                : T(lang, "Aktív az oldalán.");
      // A superseded ACTIVE module must survive the batch apply — it has no visible
      // control, and "absent" would read as a cancellation.
      const keep =
        replacedBy && !m.spine ? `<input type="hidden" name="module" value="${esc(m.id)}">` : "";
      const off =
        m.spine || replacedBy
          ? ""
          : `<label class="citui-btn citui-btn--ghost adm-mine__off">${cb(m, !m.cancelAtPeriodEnd)}` +
            `<span class="adm-when-on">${T(lang, "Kikapcsolom")}</span>` +
            `<span class="adm-when-off">${T(lang, "Mégis megtartom")}</span></label>`;
      const cfg =
        !replacedBy && hasSettingsScreen(m.id)
          ? `<a class="citui-btn citui-btn--ghost" href="/admin?tab=modulok&m=${encodeURIComponent(m.id)}">` +
            `${ic("settings", 16)}<span>${T(lang, "Beállítás")}</span></a>`
          : "";
      return (
        `<div class="adm-mine__row" data-modrow="${esc(m.id)}">${keep}` +
        `<span class="adm-mine__t"><strong>${esc(T(lang, m.label))}</strong><span>${state}</span></span>` +
        priceChip(m, replacedBy ?? null) +
        // Under a freeze the link still works — it is an INTERNAL preview route,
        // not the suspended public host. Renaming it keeps that honest: what it
        // opens is a preview, not the page a guest can reach right now.
        `<a class="citui-btn citui-btn--ghost" data-pv="${esc(m.id)}" target="_blank" rel="noopener"` +
        ` href="${previewHref(m.id, committedIds)}">${eyeIcon}<span>${frozen ? T(lang, "Előnézet") : T(lang, "Megnézem")}</span></a>` +
        cfg +
        off +
        `</div>`
      );
    })
    .join("");

  // ── owned-modules SUMMARY (approved contract: modules-annual-pricing) ────────
  // The tab is where the owner looks at his money, and it ended without a total:
  // ~12 priced rows and no answer to "what do these cost me together?" (Elek
  // FK-002 Z2). Three cells in the subscription card's own language, and the
  // biggest number is the one he actually pays.
  //
  // The count is DERIVED from the same predicate the sum adds up — a label that
  // promises one set while the figure measures another is the failure mode of
  // feedback_label_must_derive_from_predicate.
  const billedModules = mv.modules.filter((m) => m.active && !m.spine && !m.supersededBy);
  const billedCount = billedModules.length;
  const modulesMonthly = billedModules.reduce((s, m) => s + m.priceMonthly, 0);
  const totalMonthly = mv.baseMonthly + modulesMonthly;
  const annualCell = annualMult > 0;
  /** value + the same figure in the OTHER period, so neither reading is missing. */
  const sumCell = (label: string, monthly: number, tone = ""): string =>
    `<div class="adm-sumbar__c${tone}">` +
    `<div class="adm-sumbar__l">${label}</div>` +
    `<div class="adm-sumbar__v">${esc(huf(annualCell ? monthly * annualMult : monthly))}</div>` +
    `<div class="adm-sumbar__s">${
      annualCell
        ? T(lang, "{price}/hó", { price: esc(huf(monthly)) })
        : T(lang, "{price}/év", { price: esc(huf(monthly * 12)) })
    }</div></div>`;
  const sumBar =
    `<div class="adm-sumbar" data-modsum>` +
    sumCell(T(lang, "Modulok együtt ({n} db)", { n: String(billedCount) }), modulesMonthly) +
    sumCell(T(lang, "Alapdíj (honlap + időpontkérés)"), mv.baseMonthly) +
    `<div class="adm-sumbar__c adm-sumbar__c--tot">` +
    `<div class="adm-sumbar__l">${annualCell ? T(lang, "Éves díja összesen") : T(lang, "Havi díja összesen")}</div>` +
    // data-base/-mult mirror the "Következő számla" cell so the live toggle sync
    // recomputes BOTH from one rule — the bar and the summary can never disagree.
    `<div class="adm-sumbar__v" id="adm-sum-total" data-base="${annualCell ? totalMonthly * annualMult : totalMonthly}" data-mult="${annualCell ? annualMult : 1}">${esc(huf(annualCell ? totalMonthly * annualMult : totalMonthly))}</div>` +
    `<div class="adm-sumbar__s" id="adm-sum-eq">${
      annualCell
        ? T(lang, "{eq}/hó-nak felel meg · {n} hónap ajándék", {
            eq: esc(huf(Math.round((totalMonthly * annualMult) / 12))),
            n: String(sub!.annualFreeMonths),
          })
        : T(lang, "a következő fordulónapon: {date}", { date: esc(renewDate) })
    }</div></div>` +
    `</div>`;

  const mineCard =
    `<section class="adm-card">` +
    `<div class="adm-card__head"><span class="adm-ico">${ic("check")}</span>` +
    `<h2>${T(lang, "Az én moduljaim")}</h2>${helpLink("admin.modules", lang)}</div>` +
    (frozen
      ? `<p class="adm-lead">${T(lang, "A honlap fel van függesztve, ezért egyik modul sem jelenik meg a vendégeknek. Az előnézet csak Önnek mutatja meg őket.")}</p>`
      : "") +
    `<div class="adm-mine">${mineRows}</div>` +
    // No subscription ⇒ no billing period and no invoice to total up: an "összesen"
    // built on a guessed cadence would be a confident lie (§B.17).
    (sub ? sumBar : "") +
    `</section>`;

  // ② The shop — what they could still add, as product cards with a REAL mini
  // render of the section (an icon would sell nothing; ADR-0015).
  const groups: ModuleGroup[] = ["offer", "reach", "extra"];
  const shopBlocks = groups
    .map((g) => {
      const items = mv.modules.filter((m) => m.group === g && !m.active && !m.spine);
      if (!items.length) return "";
      const cards = items
        .map((m) => {
          const desc = m.publicDesc ? `<p>${esc(T(lang, m.publicDesc))}</p>` : "";
          // A module with no page surface (the custom e-mail address is a mailbox,
          // not a section) gets no thumbnail and no preview link — an empty frame
          // and a button that shows nothing would both be lies.
          const hasSurface = domAnchorsOf(m.id).length > 0;
          const thumb = hasSurface
            ? `<div class="adm-shop__thumb" data-thumb="${esc(m.id)}">` +
              `<iframe title="${esc(T(lang, m.label))}" tabindex="-1" aria-hidden="true" scrolling="no"` +
              ` data-src="/admin/modules/preview?on=*#only=${encodeURIComponent(m.id)}"></iframe></div>`
            : "";
          const look = hasSurface
            ? `<a class="citui-btn citui-btn--ghost" data-pv="${esc(m.id)}" target="_blank" rel="noopener"` +
              ` href="${previewHref(m.id, committedIds)}">${eyeIcon}<span>${T(lang, "Megnézem az oldalamon")}</span></a>`
            : "";
          return (
            `<article class="adm-shop__card${hasSurface ? "" : " adm-shop__card--plain"}" data-modrow="${esc(m.id)}">` +
            (coupon && !m.spine && m.priceMonthly > 0
              ? `<span class="adm-shop__coupon">−${coupon.percent}%</span>`
              : "") +
            thumb +
            `<div class="adm-shop__body"><h3>${esc(T(lang, m.label))}</h3>${desc}` +
            `<div class="adm-shop__foot">${shopPriceChip(m)}` +
            look +
            // ADR-0119 ⑥: the shop is CLOSED while the site is suspended for
            // non-payment — selling a new module to someone whose page we just
            // switched off is asking for more money for something they cannot
            // see. The card stays (so they know what exists), the buying does
            // not. The real gate is on the write, in applyModuleChange.
            (frozen
              ? `<span class="adm-shop__shut">${T(lang, "Rendezés után vehető fel")}</span>`
              : `<label class="citui-btn citui-btn--primary adm-shop__add">${cb(m, false)}` +
                `<span class="adm-when-off">${T(lang, "Hozzáadom")}</span>` +
                `<span class="adm-when-on">${T(lang, "Visszaveszem")}</span></label>`) +
            `</div></div></article>`
          );
        })
        .join("");
      return `<div class="adm-modgroup">${esc(T(lang, GROUP_LABELS[g]))}</div><div class="adm-shop">${cards}</div>`;
    })
    .join("");

  // The section NEVER vanishes: the page intro promises it ("amit még hozzáadhat,
  // azt alább"), and after an ALL-IN purchase it disappeared without a trace
  // (Elek FK-002 H1). No stock left → honest empty state.
  const shopCard =
    `<section class="adm-card">` +
    `<div class="adm-card__head"><span class="adm-ico">${ic("plus")}</span>` +
    `<h2>${T(lang, "Bővítés — amit még hozzáadhat")}</h2>${helpLink("admin.modules", lang)}</div>` +
    (shopBlocks
      ? // ADR-0119 ⑥: under a freeze the shop stays VISIBLE (so the owner keeps
        // seeing what exists) but states plainly that it is closed, and why. A
        // silently dead button would read as a broken page.
        (frozen
          ? `<p class="adm-lead">${T(lang, "A honlapja felfüggesztése alatt új modult nem tud felvenni — előbb a rendezetlen díjat kell rendezni a lap tetején. Addig is megnézheti, mit kínálunk, és a meglévő moduljait le tudja mondani.")}</p>`
          : `<p class="adm-lead">${T(lang, "Mindegyiket megnézheti a saját oldalán, mielőtt dönt — a kapcsolók itt még nem élesítenek.")}</p>`) +
        (coupon && !frozen
          ? `<div class="adm-coupon"><b>${T(lang, "−{p}% kupon", { p: String(coupon.percent) })}</b>` +
            `<span>` +
            T(lang, "Az induló előfizetéséért kapta. A következő vásárlásánál magától levonjuk{until}. Kedvezmények nem adódnak össze; mindig a nagyobb érvényesül.", {
              until: coupon.expiresAt ? T(lang, " — érvényes {date}-ig", { date: esc(coupon.expiresAt) }) : "",
            }) +
            `</span></div>`
          : "") +
        shopBlocks
      : `<p class="adm-lead">${T(lang, "Minden elérhető modult megvett — jelenleg nincs több bővíthető elem. Az egyszeri szolgáltatásokat (például a többnyelvű honlapot) lentebb találja.")}</p>`) +
    `</section>`;

  // ADR-0088 ⑨ confirm dialog for revoking the mandate (approved B plan). A
  // <dialog>-free implementation on purpose: the panel must work with the same
  // no-JS honesty as the rest of the admin — without JS the button is a plain
  // link to the same POST form, so the mandate is still revocable.
  const mandateDialog =
    sub?.autoCharge
      ? `<div class="adm-mdlveil" data-mand-veil hidden></div>` +
        `<div class="adm-mdl" role="dialog" aria-modal="true" aria-labelledby="adm-mand-t" data-mand-modal hidden>` +
        `<h3 id="adm-mand-t">${T(lang, "Biztosan visszavonja az automatikus terhelést?")}</h3>` +
        `<ul>` +
        `<li>${T(lang, "Ezután Önnek kell fizetnie minden fordulónapon, a kiküldött fizetési linkkel.")}</li>` +
        `<li>${T(lang, "Ha a díj nem érkezik be, emlékeztetőket küldünk, és a fordulónap után 10 nappal a honlapot átmenetileg felfüggesztjük.")}</li>` +
        `<li>${T(lang, "A visszavonás nem szünteti meg a fizetési kötelezettséget, és nem mondja le az előfizetést.")}</li>` +
        `<li>${T(lang, "A visszakapcsolás nem egy kattintás: a bankkártyás megerősítés miatt egy új fizetéssel adhat újra megbízást.")}</li>` +
        `</ul>` +
        `<button class="adm-mdl__keep" type="button" data-mand-keep>${T(lang, "Mégsem — marad az automatikus fizetés")}</button>` +
        // The dialog lives INSIDE the module <form>, so its own <form> would be
        // nested — invalid HTML, silently dropped by the browser, and the button
        // would submit the module form instead (measured: the revoke did nothing).
        // Same fix as the cancel/resume pair: an empty form OUTSIDE, referenced
        // by id — which also keeps the no-JS path working.
        `<button class="adm-mdl__go" type="submit" form="adm-mand-off">${T(lang, "Igen, visszavonom a megbízást")}</button>` +
        `</div>`
      : "";

  const blocks = mineCard + shopCard + mandateDialog;

  // ── plan bar: collected diffs + live totals + delta; JS-driven, with a no-JS
  //    fallback submit so the form never becomes a dead end. ──
  const planBar =
    `<div class="adm-planbar" id="adm-planbar">` +
    `<div id="adm-planrows"></div>` +
    `<div class="adm-planbar__foot">` +
    `<span class="adm-planbar__sum">` +
    `<span class="adm-planbar__paynow" id="adm-plan-paynow" hidden>${T(lang, "Fizetendő most:")} <b id="adm-plan-paysum"></b><br></span>` +
    `${T(lang, "Következő számla így:")} <b id="adm-plan-total"></b> <span id="adm-plan-delta"></span></span>` +
    `<span><button type="button" class="citui-btn citui-btn--ghost" id="adm-plan-reset">${T(lang, "Elvetem")}</button> ` +
    `<button class="citui-btn citui-btn--primary" type="submit" id="adm-plan-apply">${T(lang, "Alkalmazom a módosításokat")}</button></span>` +
    `</div></div>` +
    `<noscript><div class="adm-total"><span></span><button class="citui-btn citui-btn--primary" type="submit">${T(lang, "Alkalmazom a módosításokat")}</button></div></noscript>` +
    // ADR-0113 approved "B" contract: paid additions confirm on an itemised card
    // BEFORE any money moves. Lives INSIDE the module form on purpose — its pay
    // button submits that form (no nested <form>, the measured silent-drop trap).
    // No-JS path: the card never opens, the form posts directly, and the payment
    // page itself is the confirmation — nothing is charged silently either way.
    `<div class="adm-mdlveil" data-fc-veil hidden></div>` +
    `<div class="adm-mdl" role="dialog" aria-modal="true" aria-labelledby="adm-fc-t" data-fc-modal hidden>` +
    `<h3 id="adm-fc-t">${T(lang, "Fizetés és élesítés")}</h3>` +
    `<div data-fc-lines></div>` +
    `<p class="adm-fc__note" data-fc-note></p>` +
    `<button class="adm-mdl__keep" type="button" data-fc-keep>${T(lang, "Mégsem")}</button>` +
    `<button class="adm-mdl__go" type="submit" data-fc-go></button>` +
    `</div>`;

  // ── ③ full-page preview overlay (ADR-0089) ────────────────────────────────
  // Lives OUTSIDE the module form (its controls must never submit it) and shows
  // the tenant's own page rendered with the CURRENT cart — the same experience the
  // lead gets in the cold mock. Mobile/desktop switch + fullscreen: the owner
  // decides on both layouts, and most of them read this on a phone.
  const previewOverlay =
    `<div class="adm-pv" id="adm-pv" hidden>` +
    `<div class="adm-pv__bar">` +
    `<span class="adm-pv__warn">${T(lang, "Előnézet — még nincs élesítve")}</span>` +
    `<span class="adm-pv__ttl" id="adm-pv-ttl"></span>` +
    `<span class="adm-pv__tools">` +
    `<button type="button" class="adm-pv__b" data-pvw="phone" aria-pressed="false">${T(lang, "Mobil")}</button>` +
    `<button type="button" class="adm-pv__b" data-pvw="desktop" aria-pressed="true">${T(lang, "Asztali")}</button>` +
    `<button type="button" class="adm-pv__b" id="adm-pv-fs">${T(lang, "Teljes képernyő")}</button>` +
    `</span>` +
    `<button type="button" class="adm-pv__x" id="adm-pv-x" aria-label="${esc(T(lang, "Bezárom"))}">${ic("close", 16)}</button>` +
    `</div>` +
    `<div class="adm-pv__body" id="adm-pv-body" data-vw="desktop">` +
    `<iframe id="adm-pv-frame" title="${esc(T(lang, "Így nézne ki az oldalán"))}"></iframe></div>` +
    `<div class="adm-pv__foot" id="adm-pv-foot"></div></div>`;

  // Inline behaviour — a FUNCTION of the reader's language (ADR-0067 pattern).
  const js =
    `<script>(function(){var f=document.getElementById("adm-modform");if(!f)return;` +
    `var bar=document.getElementById("adm-planbar"),rows=document.getElementById("adm-planrows");` +
    `var tot=document.getElementById("adm-plan-total"),del=document.getElementById("adm-plan-delta");` +
    // mult: with the annual switch armed / an annual sub, a monthly module price
    // lands 10× on the (12−free)-month invoice (ADR-0088 §8) — the delta and the
    // cell must speak in the invoice's own period. next0: the server-rendered
    // cell (incl. the "éves" chip) returns whenever the plan is clean.
    `var next=document.getElementById("adm-next-total");var base=next?+next.dataset.base:0;` +
    // The owned-modules summary reads its own base/mult from the SAME contract the
    // invoice cell uses, so the tab can never show two different totals.
    `var sumT=document.getElementById("adm-sum-total");` +
    `var sumBase=sumT?+sumT.dataset.base:0,sumMult=sumT?(+sumT.dataset.mult||1):1;` +
    `var sumEq=document.getElementById("adm-sum-eq"),sumEq0=sumEq?sumEq.textContent:"";` +
    `var sumN=document.querySelector("[data-modsum] .adm-sumbar__l"),sumN0=sumN?sumN.textContent:"";` +
    `var sumMod=document.querySelector("[data-modsum] .adm-sumbar__v"),sumMod0=sumMod?sumMod.textContent:"";` +
    `var sumModS=document.querySelector("[data-modsum] .adm-sumbar__s"),sumModS0=sumModS?sumModS.textContent:"";` +
    // Sentinel-substituted templates (the  idiom used by the apply button):
    // the label must stay TRANSLATABLE, so the text comes from T() and only the
    // number is patched in at runtime.
    `var SUMN=${billedCount},SUMMOD=${modulesMonthly};` +
    `var SUMLBL=${JSON.stringify(T(lang, "Modulok együtt ({n} db)", { n: "\u0002" }))};` +
    `var SUMSUB=${JSON.stringify(
      annualCell ? T(lang, "{price}/hó", { price: "\u0003" }) : T(lang, "{price}/év", { price: "\u0003" }),
    )};` +
    `var SUMEQ=${JSON.stringify(
      sub
        ? T(lang, "{eq}/hó-nak felel meg · {n} hónap ajándék", {
            eq: "\u0001",
            n: String(sub.annualFreeMonths),
          })
        : "",
    )};` +
    `var mult=next?(+next.dataset.mult||1):1;var next0=next?next.innerHTML:"";` +
    `var HUF=function(n){return String(Math.round(n)).replace(/\\B(?=(\\d{3})+(?!\\d))/g,"\\u00a0")+"\\u00a0Ft"};` +
    `var cbs=[].slice.call(f.querySelectorAll('input[name="module"][data-committed]'));` +
    // ADR-0113 server-injected constants: the SAME proration and coupon rounding
    // the order is priced with (moduleUpsell.createFirstChargeOrder ↔ applyOffer),
    // so the bar and the confirm card can never promise a different amount.
    `var FCM=${fcMonths},CPCT=${coupon ? coupon.percent : 0},AUTOC=${sub?.autoCharge ? "true" : "false"};` +
    `var payNow=0,payAdds=[];` +
    `var fcPrice=function(p){return Math.floor((p*FCM*(100-CPCT))/100)};` +
    `var apply=document.getElementById("adm-plan-apply");` +
    `var paybox=document.getElementById("adm-plan-paynow"),paysum=document.getElementById("adm-plan-paysum");` +
    `function sync(){var add=[],rem=[],delta=0;payNow=0;payAdds=[];cbs.forEach(function(c){` +
    `var was=c.dataset.committed==="1",is=c.checked,p=+c.dataset.price;` +
    `var row=c.closest("[data-modrow]");if(row)row.classList.toggle("is-dirty",was!==is);` +
    `if(is&&!was){add.push(c);delta+=p;if(p>0&&!c.dataset.rejoin){payNow+=fcPrice(p);payAdds.push(c)}}` +
    `if(!is&&was){rem.push(c);delta-=p}});` +
    `bar.classList.toggle("show",add.length+rem.length>0);` +
    `rows.innerHTML=add.map(function(c){var p=+c.dataset.price;` +
    `var what=c.dataset.rejoin?"${T(lang, "visszakapcsolás — ki van fizetve {date}-ig", { date: esc(renewDate) })}"` +
    `:p>0?"${T(lang, "fizetés most:")} <b>"+HUF(fcPrice(p))+"</b> ("+FCM+" ${T(lang, "hónap a fordulónapig")})"` +
    `:"${T(lang, "azonnal él — díjmentes")}";` +
    `return '<div class="adm-planbar__row"><span><span class="adm-planbar__tag adm-planbar__tag--add">+ ${T(lang, "bekapcsol")}</span> · '+c.dataset.label+'</span><span>'+what+'</span></div>'}).join("")+` +
    `rem.map(function(c){return '<div class="adm-planbar__row"><span><span class="adm-planbar__tag adm-planbar__tag--del">− ${T(lang, "lemond")}</span> · '+c.dataset.label+'</span><span>${T(lang, "{date}-ig aktív maradna", { date: esc(renewDate) })}</span></div>'}).join("");` +
    `if(paybox){paybox.hidden=payNow<=0;if(paysum)paysum.textContent=HUF(payNow)}` +
    `if(apply)apply.textContent=payNow>0?(AUTOC?"${T(lang, "Alkalmazom — a kártyáját {sum} terheljük", { sum: "\u007f" })}".replace("\\u007f",HUF(payNow)+"-tal"):"${T(lang, "Fizetés és alkalmazás")}"):"${T(lang, "Alkalmazom a módosításokat")}";` +
    `if(tot)tot.textContent=HUF(base+delta*mult);` +
    `if(del){del.textContent=delta?"("+(delta>0?"+":"−")+HUF(Math.abs(delta*mult))+" ${T(lang, "a mostanihoz képest")}"+")":"";` +
    `del.className=delta>0?"adm-planbar__delta--up":"adm-planbar__delta--down"}` +
    `if(next)next.innerHTML=delta?HUF(base+delta*mult):next0;` +
    // ── owned-modules summary moves WITH the switches (approved contract) ──
    // A static server-rendered total that the toggles then contradict is worse
    // than no total: the owner would read a number the page no longer means.
    `if(sumT){var n2=SUMN+add.length-rem.length,m2=SUMMOD+delta;` +
    `sumT.textContent=HUF(sumBase+delta*sumMult);` +
    `if(sumN)sumN.textContent=delta?SUMLBL.replace("\\u0002",String(n2)):sumN0;` +
    `if(sumMod)sumMod.textContent=delta?HUF(m2*sumMult):sumMod0;` +
    `if(sumModS)sumModS.textContent=delta?SUMSUB.replace("\\u0003",HUF(sumMult>1?m2:m2*12)):sumModS0;` +
    // Only the ANNUAL cell carries a recomputable equivalent; the monthly one
    // states the renewal date, which no toggle can change.
    `if(sumEq&&sumMult>1)sumEq.textContent=delta` +
    `?SUMEQ.replace("\\u0001",HUF(Math.round((sumBase+delta*sumMult)/12))):sumEq0;}` +
    `if(window.__citPvSync)window.__citPvSync();}` +
    `cbs.forEach(function(c){c.addEventListener("change",sync)});` +
    `var rst=document.getElementById("adm-plan-reset");if(rst)rst.addEventListener("click",function(){` +
    `cbs.forEach(function(c){c.checked=c.dataset.committed==="1"});sync()});` +
    // ── ADR-0113 confirm card: a submit that would charge stops here first ──
    `var fcm=document.querySelector("[data-fc-modal]"),fcv=document.querySelector("[data-fc-veil]");` +
    `var fcOk=false;` +
    `function fcOpen(){var lines=fcm.querySelector("[data-fc-lines]");` +
    `lines.innerHTML=payAdds.map(function(c){var p=+c.dataset.price;` +
    `return '<div class="adm-fc__line"><span>'+c.dataset.label+' · '+FCM+' ${T(lang, "hó")} × '+HUF(p)+(CPCT?' − '+CPCT+'%':'')+'</span><b>'+HUF(fcPrice(p))+'</b></div>'}).join("")+` +
    `'<div class="adm-fc__line adm-fc__line--total"><span>${T(lang, "Fizetendő most")}</span><b>'+HUF(payNow)+'</b></div>';` +
    `fcm.querySelector("[data-fc-note]").textContent=AUTOC` +
    `?"${T(lang, "A tárolt kártya-megbízását terheljük. A modul a sikeres terheléskor azonnal élesedik; a következő ({date}) számlán már normál tételként szerepel.", { date: esc(renewDate) })}"` +
    `:"${T(lang, "A fizetőoldalra irányítjuk. A modul CSAK a fizetés beérkezése után jelenik meg az oldalán; a következő ({date}) számlán már normál tételként szerepel.", { date: esc(renewDate) })}";` +
    `fcm.querySelector("[data-fc-go]").textContent=AUTOC?"${T(lang, "Terhelés és élesítés")}":"${T(lang, "Tovább a fizetéshez")}";` +
    `fcm.hidden=false;fcv.hidden=false;fcm.querySelector("[data-fc-keep]").focus();}` +
    `function fcClose(){fcm.hidden=true;fcv.hidden=true;}` +
    `if(fcm){f.addEventListener("submit",function(e){if(payNow>0&&!fcOk){e.preventDefault();fcOpen();}});` +
    `fcm.querySelector("[data-fc-keep]").addEventListener("click",fcClose);` +
    `fcv.addEventListener("click",fcClose);` +
    `fcm.querySelector("[data-fc-go]").addEventListener("click",function(){fcOk=true;});` +
    `document.addEventListener("keydown",function(e){if(e.key==="Escape"&&!fcm.hidden)fcClose();});}` +
    `sync();})();</script>` +
    // ADR-0088 ⑨: the revoke button opens the confirm dialog instead of posting.
    // No JS ⇒ no dialog, and the button is inert — so the no-JS path shows the
    // form inside the (then always-visible) dialog rather than silently failing.
    `<script>(function(){var m=document.querySelector("[data-mand-modal]"),v=document.querySelector("[data-mand-veil]");` +
    `if(!m)return;var b=document.querySelector("[data-mand-revoke]");if(!b)return;` +
    `function open(){m.hidden=false;v.hidden=false;var k=m.querySelector("[data-mand-keep]");if(k)k.focus();}` +
    `function close(){m.hidden=true;v.hidden=true;b.focus();}` +
    `b.addEventListener("click",open);v.addEventListener("click",close);` +
    `m.querySelector("[data-mand-keep]").addEventListener("click",close);` +
    `document.addEventListener("keydown",function(e){if(e.key==="Escape"&&!m.hidden)close();});})();</script>` +
    // ── preview: overlay + shop-card thumbnails ──
    `<script>(function(){var f=document.getElementById("adm-modform"),ov=document.getElementById("adm-pv");` +
    `if(!f||!ov)return;` +
    `var body=document.getElementById("adm-pv-body"),frame=document.getElementById("adm-pv-frame");` +
    `var foot=document.getElementById("adm-pv-foot"),ttl=document.getElementById("adm-pv-ttl");` +
    `var base=${mv.baseMonthly},focus=null;` +
    `var HUF=function(n){return String(Math.round(n)).replace(/\\B(?=(\\d{3})+(?!\\d))/g,"\\u00a0")+"\\u00a0Ft"};` +
    `var cbs=[].slice.call(f.querySelectorAll('input[name="module"][data-committed]'));` +
    `var OWNED=${JSON.stringify(Object.fromEntries(mv.modules.map((m) => [m.id, m.active])))};` +
    `var LABEL=${JSON.stringify(Object.fromEntries(mv.modules.map((m) => [m.id, T(lang, m.label)])))};` +
    `var PRICE=${JSON.stringify(Object.fromEntries(mv.modules.map((m) => [m.id, m.spine ? 0 : m.priceMonthly])))};` +
    `function cbOf(id){return f.querySelector('input[name="module"][value="'+id+'"][data-committed]')}` +
    `function wanted(){var ids=[];cbs.forEach(function(c){if(c.checked)ids.push(c.value)});return ids}` +
    `function total(){var s=base;cbs.forEach(function(c){if(c.checked)s+=+c.dataset.price});return s}` +
    // The site is laid out against the iframe's OWN width, then scaled to fit: the
    // desktop layout stays a real desktop layout even on a 390px phone.
    `function fit(){var w=body.clientWidth||390,h=body.clientHeight||600;` +
    `var nat=body.dataset.vw==="phone"?390:1200;var k=Math.min(1,(w-2)/nat);` +
    `frame.style.zoom=String(k);frame.style.height=Math.round(h/k)+"px"}` +
    `function setVw(v){body.dataset.vw=v;` +
    `[].slice.call(ov.querySelectorAll("[data-pvw]")).forEach(function(b){b.setAttribute("aria-pressed",String(b.dataset.pvw===v))});fit()}` +
    // ADR-0119 ⑥: the preview overlay is a SECOND buying path — its footer offers
    // the same add button. The shop card alone would have left this one open
    // (the guard found it: one "Hozzáadom" survived in this inline script).
    //
    // Under a freeze the add branch is not emitted AT ALL, rather than emitted
    // and skipped at runtime: an unreachable label is still shipped text, and a
    // guard reading the page cannot tell the difference between a button that is
    // there and one that merely could be. Don't ship what must not happen.
    `function paint(){var t=total();` +
    `if(focus&&!OWNED[focus]){var c=cbOf(focus),on=c&&c.checked;` +
    `foot.innerHTML='<span class="adm-chip">+'+HUF(PRICE[focus])+'/${T(lang, "hó")}</span>'+` +
    `'<button type="button" class="citui-btn citui-btn--ghost" data-pvx="1">${T(lang, "Bezárom")}</button>'+` +
    (frozen
      ? `'<span class="adm-shop__shut">${T(lang, "Rendezés után vehető fel")}</span>'}`
      : `'<button type="button" class="citui-btn '+(on?"citui-btn--ghost":"citui-btn--primary")+'" data-pvadd="'+focus+'">'+` +
        `(on?'${T(lang, "Visszaveszem")}':'${T(lang, "Hozzáadom")}')+'</button>'}`) +
    `else{foot.innerHTML='<span class="adm-chip">${T(lang, "Havi díj így:")} '+HUF(t)+'</span>'+` +
    `'<button type="button" class="citui-btn citui-btn--ghost" data-pvx="1">${T(lang, "Bezárom")}</button>'}` +
    `ttl.textContent=focus?LABEL[focus]+" — ${T(lang, "így nézne ki az oldalán")}":"${T(lang, "Így nézne ki az oldalán")}"}` +
    `function load(){var ids=wanted();if(focus&&ids.indexOf(focus)<0)ids.push(focus);` +
    `frame.src="/admin/modules/preview?on="+encodeURIComponent(ids.join(","))+` +
    `(focus?"#focus="+encodeURIComponent(focus):"")}` +
    `window.__citPvSync=function(){if(ov.hidden)return;paint();load()};` +
    `function open(id){focus=id||null;ov.hidden=false;` +
    `setVw(window.matchMedia("(max-width:820px)").matches?"phone":"desktop");paint();load()}` +
    `function close(){ov.hidden=true;if(document.fullscreenElement)document.exitFullscreen()}` +
    `document.addEventListener("click",function(e){var t=e.target.closest("[data-pv],[data-pvw],[data-pvx],[data-pvadd]");` +
    `if(!t)return;` +
    `if(t.dataset.pv!=null&&t.dataset.pv!==""){e.preventDefault();open(t.dataset.pv);return}` +
    `if(t.dataset.pvw){setVw(t.dataset.pvw);return}` +
    `if(t.dataset.pvx){close();return}` +
    `if(t.dataset.pvadd){var c=cbOf(t.dataset.pvadd);if(c){c.checked=!c.checked;` +
    `c.dispatchEvent(new Event("change",{bubbles:true}))}}});` +
    `document.getElementById("adm-pv-x").addEventListener("click",close);` +
    `var fs=document.getElementById("adm-pv-fs");` +
    `fs.addEventListener("click",function(){if(document.fullscreenElement)document.exitFullscreen();` +
    `else if(ov.requestFullscreen)ov.requestFullscreen()});` +
    `document.addEventListener("fullscreenchange",function(){` +
    `fs.textContent=document.fullscreenElement?"${T(lang, "Kilépek")}":"${T(lang, "Teljes képernyő")}";setTimeout(fit,60)});` +
    `window.addEventListener("resize",fit);` +
    `document.addEventListener("keydown",function(e){if(e.key==="Escape"&&!ov.hidden)close()});` +
    // Shop-card thumbnails: ONE all-in render, clipped per card through the hash.
    // The first frame is primed alone so the rest hit the browser cache instead of
    // firing a dozen parallel renders at the server.
    `var th=[].slice.call(document.querySelectorAll(".adm-shop__thumb iframe[data-src]"));` +
    `function fitTh(){th.forEach(function(i){var w=i.parentElement.clientWidth||300;` +
    `i.style.transform="scale("+(w/620)+")"})}` +
    `fitTh();window.addEventListener("resize",fitTh);` +
    `function go(i){if(!i.dataset.src)return;i.src=i.dataset.src;delete i.dataset.src}` +
    `if(th.length){var rest=th.slice(1);var first=th[0];` +
    `var after=function(){if(!("IntersectionObserver"in window)){rest.forEach(go);return}` +
    `var io=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){go(en.target);io.unobserve(en.target)}})},{rootMargin:"300px"});` +
    `rest.forEach(function(i){io.observe(i)})};` +
    `first.addEventListener("load",after,{once:true});first.addEventListener("error",after,{once:true});go(first)}` +
    `})();</script>`;

  // ── danger zone: whole-subscription cancel (two-step via <details>, no-JS safe) ──
  // ADR-0094 ② (approved plan B): under a RUNNING domain commitment the cancel
  // button does NOT open the two-step confirm — it links to the interposed
  // settlement page, and the cancellation can only be closed from there.
  let danger = "";
  if (sub) {
    danger = sub.cancelAtPeriodEnd
      ? `<div class="adm-danger"><h3>${T(lang, "Előfizetés lemondása")}</h3>` +
        `<div class="adm-danger__done">${T(lang, "Előfizetése {date}-án zárul. Addig minden változatlanul él.", { date: esc(renewDate) })} ` +
        (domainSettle?.settlementPaid
          ? // The kötbér moved: undoing that is a support act, not a button.
            T(lang, "A hűségidő-elszámolás rendezve — ha mégis folytatná, írjon nekünk.")
          : `<button class="citui-btn citui-btn--ghost" form="adm-sub-resume" type="submit">${T(lang, "Meggondoltam magam — folytatom")}</button>`) +
        `</div></div>`
      : domainSettle?.commitmentActive
        ? `<div class="adm-danger"><h3>${T(lang, "Előfizetés lemondása")}</h3>` +
          `<p class="citui-hint" style="margin:0 0 8px">${T(lang, "A webcíméhez futó hűségidő tartozik, ezért a lemondás elszámolással jár. A tételes elszámolást a következő oldalon mutatjuk meg — dönteni és lemondani is ott tud.")}</p>` +
          `<a class="citui-btn citui-btn--ghost" href="/admin/subscription/settlement">${T(lang, "Előfizetés lemondása…")}</a></div>`
        : `<div class="adm-danger"><h3>${T(lang, "Előfizetés lemondása")}</h3>` +
          // Under a freeze the paid period is already OVER — that is why the site
          // is down. Promising it "stays reachable until then" on the same screen
          // as the suspension notice is the second half of the contradiction the
          // owner caught (2026-09-11).
          `<p class="citui-hint" style="margin:0">${
            frozen
              ? T(lang, "A honlap jelenleg fel van függesztve. Lemondás esetén a rendezetlen díj kiegyenlítése nélkül sem kapcsol vissza, és az előfizetés lezárul.")
              : T(lang, "A honlap a már kifizetett időszak végéig ({date}) elérhető marad, utána lekerül.", { date: esc(renewDate) })
          }</p>` +
          `<details><summary>${T(lang, "Előfizetés lemondása…")}</summary>` +
          `<p style="font-size:.85rem;margin:8px 0"><b>${T(lang, "Biztos benne?")}</b> ${T(lang, "{date} után a honlapja nem lesz elérhető a vendégeknek.", { date: esc(renewDate) })}</p>` +
          `<button class="citui-btn adm-btn-bad" form="adm-sub-cancel" type="submit">${T(lang, "Igen, lemondom")}</button>` +
          `</details></div>`;
  }
  // The cancel/resume forms live OUTSIDE the module form (nested forms are invalid).
  const dangerForms =
    `<form id="adm-sub-cancel" method="POST" action="/admin/subscription/cancel"></form>` +
    `<form id="adm-sub-resume" method="POST" action="/admin/subscription/resume"></form>` +
    (sub?.autoCharge
      ? `<form id="adm-mand-off" method="POST" action="/admin/subscription/auto-charge-off"></form>`
      : "");

  return (
    subCard +
    `<form method="POST" action="/admin/modules" id="adm-modform">` +
    // ADR-0113 (approved "B" contract, design-refs/console/modules-pay-gate): say
    // what the switches DO before the click — a paid module appears AFTER its
    // prorated first fee is paid; cancels honour the paid period. §I: the button
    // must never surprise.
    `<p class="adm-lead">${T(lang, "Ami már az Öné, azt fent találja; amit még hozzáadhat, azt alább — és mindegyiket meg is nézheti a saját oldalán, mielőtt dönt. A kapcsolók itt még nem élesítenek: a lap alján összegyűjtjük, mi változna és mennyibe kerül. Fizetős modul a díj kifizetése után jelenik meg az oldalán — az első díj időarányos, a fordulónapig szól, utána a modul a normál számláján szerepel. Amit lemond, a már kifizetett időszak végéig aktív marad.")}</p>` +
    appliedBox +
    blocks +
    planBar +
    `<p class="citui-hint" style="margin-top:14px">${T(lang, "Kérdése van a csomagról? Írjon:")} <a href="mailto:${esc(contactEmail)}">${esc(contactEmail)}</a></p>` +
    `</form>` +
    danger +
    dangerForms +
    previewOverlay +
    js
  );
}

/** ADR-0094 ② — the interposed settlement page's view data (public.ts assembles
 *  from settlementQuote/openSettlement; the contract lives at
 *  assets/design-refs/console/domain-settlement/README.md). */
export interface DomainSettlementView {
  readonly domainName: string;
  readonly monthsTotal: number;
  readonly monthsElapsed: number;
  readonly monthsRemaining: number;
  /** Monthly base of the kötbér (the committed minimum), HUF. */
  readonly penaltyBase: number;
  readonly penaltyTotal: number;
  readonly buyoutPrice: number;
  /** ISO date the site stays reachable until; null = not known yet. */
  readonly accessEndDate: string | null;
  /** A recorded settlement — the done screen renders this DB truth. */
  readonly done: { readonly takeDomain: boolean; readonly total: number } | null;
  readonly error: string | null;
}

/**
 * The settlement page (approved plan B, ADR-0094 ②). What the plan BINDS:
 * loyalty bar with real months + meter; itemised bill (kötbér always, buyout
 * only when the domain is taken); the checkbox flips the bill line, the total,
 * the red button's label AND the consequence text together; "Mégsem" goes back
 * writing nothing; the done screen states payment path, end date, domain fate
 * and the §9 transfer rule. Money truth is server-side (settlementQuote) — the
 * JS only mirrors it live.
 */
export function domainSettlementSection(view: DomainSettlementView, lang = "hu"): string {
  const huf = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} Ft`;
  const dom = esc(view.domainName);
  const back = `<a class="citui-btn citui-btn--ghost" style="width:100%" href="/admin?tab=modulok">${T(lang, "Vissza")}</a>`;
  const head = (title: string) =>
    `<div class="adm-card__head"><span class="adm-ico">${ic("domain", 20)}</span>` +
    `<h2>${title}</h2>${helpLink("admin.settlement", lang)}</div>`;

  if (view.done) {
    const fate = view.done.takeDomain
      ? T(lang, "A(z) {domain} tulajdonjog-átadását előkészítettük — a lépéseket a fizetés rendezése után e-mailben küldjük.", { domain: dom })
      : T(lang, "A(z) {domain} webcím nálunk maradt.", { domain: dom });
    return (
      `<div class="adm-card">` +
      head(T(lang, "Elszámolás rögzítve")) +
      `<div class="adm-settle__done">${ic("check", 18)}<span>` +
      T(lang, "Az elszámolást rögzítettük ({total}), a fizetéshez e-mailben küldtük a linket.", { total: esc(huf(view.done.total)) }) +
      ` ` +
      (view.accessEndDate
        ? T(lang, "A honlap {date} napig elérhető marad.", { date: esc(view.accessEndDate) }) + ` `
        : "") +
      `<b>${fate}</b></span></div>` +
      `<p class="citui-hint" style="margin:0 0 14px">${T(lang, "A webcím tulajdonjoga minden esetben csak a teljes elszámolás (kötbér és díjak) maradéktalan rendezése után száll át (ÁSZF 9. pont).")}</p>` +
      back +
      `</div>`
    );
  }

  const pct = Math.max(
    0,
    Math.min(100, Math.round((view.monthsElapsed / Math.max(1, view.monthsTotal)) * 100)),
  );
  const totalNoDomain = huf(view.penaltyTotal);
  const err = view.error
    ? `<div class="adm-saved" role="alert">${ic("alert", 18)} ${esc(view.error)}</div>`
    : "";
  const accessSentence = view.accessEndDate
    ? ` ${T(lang, "A honlap {date} után nem lesz elérhető a vendégeknek.", { date: esc(view.accessEndDate) })}`
    : "";

  return (
    `<div class="adm-card">` +
    head(T(lang, "Lemondás — elszámolás a hűségidőről")) +
    `<p class="adm-lead">${T(lang, "Az „Előfizetés lemondása” gombra kattintva érkezett ide.")}</p>` +
    err +
    `<div class="adm-settle__dombar"><span class="adm-settle__ico">${ic("domain", 20)}</span>` +
    `<div style="flex:1;min-width:0"><b>${dom}</b>` +
    `<span>${T(lang, "saját webcím tőlünk — a vállalt {n} hónapból {m} telt el, {k} van hátra", { n: String(view.monthsTotal), m: String(view.monthsElapsed), k: String(view.monthsRemaining) })}</span>` +
    `<div class="adm-settle__meter"><i style="width:${pct}%"></i></div></div></div>` +
    `<p style="font-size:.88rem;margin:0 0 4px"><b>${T(lang, "A hűségidő alatt a lemondás elszámolással jár.")}</b> ` +
    T(lang, "A hátralévő {k} hónap díja a vállalt minimum tarifán mindenképp fizetendő; a webcímet választása szerint viheti vagy hagyja.", { k: String(view.monthsRemaining) }) +
    `</p>` +
    `<form method="POST" action="/admin/subscription/settlement" id="adm-settle">` +
    `<label class="adm-settle__row" data-domtoggle><input type="checkbox" name="takedomain" value="1">` +
    `<span style="flex:1;min-width:0"><span class="adm-settle__rt">${T(lang, "A webcímet is elviszem")}</span>` +
    `<span class="adm-settle__rd">${T(lang, "A(z) {domain} tulajdonjoga a fizetés után az Öné, és bárhová elviheti. Enélkül a webcím nálunk marad.", { domain: `<b>${dom}</b>` })}</span></span>` +
    `<span class="adm-settle__rp">+ ${esc(huf(view.buyoutPrice))}</span></label>` +
    `<div class="adm-settle__bill"><dl>` +
    `<dt>${T(lang, "Hátralévő hűségidő")}<small>${T(lang, "{k} hónap × {base} (vállalt minimum)", { k: String(view.monthsRemaining), base: esc(huf(view.penaltyBase)) })}</small></dt>` +
    `<dd>${esc(totalNoDomain)}</dd>` +
    `<dt>${T(lang, "Webcím vételára")}<small>${T(lang, "csak ha elviszi")}</small></dt><dd data-domline>—</dd>` +
    `<dt class="adm-settle__total"><strong>${T(lang, "Összesen fizetendő")}</strong></dt>` +
    `<dd class="adm-settle__total" data-total>${esc(totalNoDomain)}</dd>` +
    `</dl></div>` +
    `<div class="adm-settle__conseq"><span data-domfate>${T(lang, "A webcímet nem viszi el: a(z) {domain} nálunk marad.", { domain: dom })}</span>${accessSentence}</div>` +
    `<button class="citui-btn adm-btn-bad" style="width:100%;margin-top:12px" type="submit" data-settle>` +
    `${T(lang, "Elszámolás és lemondás — {total}", { total: esc(totalNoDomain) })}</button>` +
    `</form>` +
    `<a class="citui-btn citui-btn--ghost" style="width:100%;margin-top:9px" href="/admin?tab=modulok">${T(lang, "Mégsem mondom le — vissza")}</a>` +
    `</div>` +
    `<script>(function(){` +
    `var row=document.querySelector('[data-domtoggle]');if(!row)return;` +
    `var box=row.querySelector('input');` +
    `var PEN=${view.penaltyTotal},BUY=${view.buyoutPrice};` +
    `function huf(n){return String(Math.round(n)).replace(/\\B(?=(\\d{3})+(?!\\d))/g,"\\u00a0")+" Ft"}` +
    `var FATE_ON=${JSON.stringify(T(lang, "A webcímet elviszi: a(z) {domain} tulajdonjoga a fizetés után az Öné.", { domain: view.domainName }))};` +
    `var FATE_OFF=${JSON.stringify(T(lang, "A webcímet nem viszi el: a(z) {domain} nálunk marad.", { domain: view.domainName }))};` +
    `var BTN=${JSON.stringify(T(lang, "Elszámolás és lemondás — {total}", { total: "@@" }))};` +
    // The row is a <label>: the native click toggles the box itself — only the
    // change event recomputes (a manual toggle here would flip it back; measured
    // double-toggle in the plan mock, 2026-09-03).
    `function sync(){var on=box.checked;row.classList.toggle('is-on',on);` +
    `var total=PEN+(on?BUY:0);` +
    `document.querySelectorAll('[data-domline]').forEach(function(el){el.textContent=on?huf(BUY):'\\u2014'});` +
    `document.querySelectorAll('[data-total]').forEach(function(el){el.textContent=huf(total)});` +
    `document.querySelectorAll('[data-settle]').forEach(function(el){el.textContent=BTN.replace('@@',huf(total))});` +
    `document.querySelectorAll('[data-domfate]').forEach(function(el){el.textContent=on?FATE_ON:FATE_OFF});}` +
    `box.addEventListener('change',sync);sync();` +
    `})();</script>`
  );
}

/**
 * The receipt state of a purchase whose generation has not been delivered yet.
 *
 * ⛔ WHY IT EXISTS (Elek FK-005b, 2026-09-11): the card used to show only the
 * GENERATION's progress, which (a) looked identical to a zombie row left by an
 * earlier run and (b) said nothing about the money. The buyer paid 14 900 Ft and
 * got back the exact screen they started from, pay button included.
 */
export interface MultilangPaidState {
  /**
   * running = reporting in · stalled = silent, the watcher will restart it ·
   * failed = errored but attempts remain · gave_up = the series ran out and a HUMAN
   * now owns it (ADR-0118). ⛔ The last one is a separate phase because the screen
   * must not keep promising an automatic restart once we have actually stopped.
   */
  readonly phase: "running" | "stalled" | "failed" | "gave_up";
  /** Automatic attempts already spent — the card says which one we are on. */
  readonly attempts: number;
  /** Language CODES that were bought (the picker freezes on exactly these). */
  readonly langs: readonly string[];
  readonly langNames: readonly string[];
  readonly amount: number | null;
  /** The reference the buyer can quote to support (gateway ref). */
  readonly ref: string | null;
  readonly paidAt: string;
}

/** ADR-0063 „Többnyelvű honlap" — the multilang card's view data (multilangCard.ts assembles). */
export interface MultilangAdminData {
  /** One-time fee (HUF) — the SAME for first generation, regeneration and swap. */
  readonly price: number;
  /** Fixed package size (3). */
  readonly count: number;
  readonly primaryLangName: string;
  /** Pickable target languages (supported set minus the site's own language). */
  readonly options: readonly { code: string; name: string }[];
  /** The paid state; null = never purchased. */
  readonly state: {
    readonly languages: readonly string[];
    readonly langNames: readonly string[];
    readonly status: "active" | "stale";
    readonly generatedAt: string;
  } | null;
  /**
   * The purchase is PAID but not delivered yet. Non-null ⇒ the card states the
   * receipt and the pay button is dead: the same item must not be buyable twice.
   */
  readonly paid: MultilangPaidState | null;
  /** The latest generation failed with this error (operator-fixable). */
  readonly failedError: string | null;
  /** Live links of the served language versions (only when the site is live). */
  readonly langUrls: readonly { lang: string; url: string }[];
  /**
   * ADR-0088 §6 welcome coupon that WILL redeem on this purchase. It used to
   * apply silently at charge time while the card kept the list price — the card
   * must show the real amount (owner decision, 2026-09-05, Elek FK-005b).
   */
  readonly couponPercent?: number | null;
  readonly couponPrice?: number | null;
  /** Language codes to pre-check (restored after a failed pay redirect). */
  readonly preselect?: readonly string[];
  /** ADR-0119 ⑥: the site is suspended for non-payment — the shop is closed, so
   *  this card may not sell either (the write is gated in createMultilangOrder). */
  readonly frozen?: boolean;
}

/**
 * ADR-0063: one-time paid module — NOT a toggle in the module list (toggling is
 * free there); its own card owns the whole lifecycle: pick 3 languages → pay →
 * generated; content change → stale banner → pay again; swap = new set + pay.
 */
export function multilangSection(ml: MultilangAdminData, lang = "hu"): string {
  const huf = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} Ft`;
  // A PAID, undelivered purchase owns the picker: it shows WHAT WAS BOUGHT and
  // is frozen — re-picking languages here could only lead to a second charge for
  // something already paid for.
  const paidLangs = ml.paid ? new Set(ml.paid.langs) : null;
  const checked = paidLangs ?? new Set(ml.preselect?.length ? ml.preselect : (ml.state?.languages ?? []));
  const picker = ml.options
    .map(
      (o) =>
        `<label class="adm-mlang"><input type="checkbox" name="lang" value="${esc(o.code)}"` +
        `${checked.has(o.code) ? " checked" : ""}${ml.paid ? " disabled" : ""}> <span>${esc(o.name)}</span></label>`,
    )
    .join("");
  // A warning must not wear the success-green "saved" coat — warn tone, token-only.
  const warnBox =
    `style="background:color-mix(in srgb, var(--citui-warn) 12%, transparent);` +
    `color:var(--citui-warn)"`;
  // Vevő-oldali hangnem: egységesen MAGÁZÓ (Elek FK-002 H2 — a kártya tegezett,
  // miközben a lap többi része magáz).
  // ⛔ THE RECEIPT COMES FIRST (Elek FK-005b, 2026-09-11). The buyer must read the
  // payment off the card — amount, time, reference, what it bought — because the
  // generation's progress alone was indistinguishable from a leftover row and said
  // nothing about the 14 900 Ft that just left their account.
  // ⚠️ .adm-saved is an inline-FLEX row: loose text nodes separated by <br> broke
  // into four ragged columns and wrapped "14 900 Ft" three lines high (measured on
  // the first pass). The receipt therefore lives in ONE block child next to the icon.
  const paidBlock = ml.paid
    ? // .adm-saved is a PILL (radius 999px) sized for one short line; a four-line
      // receipt turned it into an ellipse on 390px. Block radius + block padding.
      `<div class="adm-saved" data-mlang-paid="${esc(ml.paid.phase)}" ` +
      `style="display:flex;align-items:flex-start;border-radius:var(--citui-radius-sm);padding:12px 16px">` +
      `${ic("check", 18)}<div style="text-align:left">` +
      `<div><strong>${T(lang, "Kifizetve")}</strong>${
        ml.paid.amount ? ` — <strong>${esc(huf(ml.paid.amount))}</strong>` : ""
      } · ${esc(ml.paid.paidAt)}</div>` +
      `<div style="margin-top:2px">${T(lang, "Megvásárolt nyelvek: {langs}", { langs: esc(ml.paid.langNames.join(", ")) })}</div>` +
      (ml.paid.ref
        ? `<div class="citui-hint" style="margin:2px 0 0">${T(lang, "Hivatkozási azonosító: {ref}", { ref: `<code>${esc(ml.paid.ref)}</code>` })}</div>`
        : "") +
      // ⛔ MINDEN MONDAT IGAZ LEGYEN (ADR-0118): amíg van hátra próbálkozás, a
      // rendszer TÉNYLEG újraindítja magától (figyelő + életjel). Amikor a sorozat
      // elfogy, EMBER kapja meg — és a felület abbahagyja az automatika ígéretét.
      // Korábban a „csapatunk újraindítja" üres mondat volt: semmi nem indította újra.
      `<div style="margin-top:6px">${
        ml.paid.phase === "gave_up"
          ? T(lang, "A generálás többszöri próbálkozás után sem sikerült. Munkatársunk már tud róla, és felveszi Önnel a kapcsolatot — újra fizetnie NEM kell.")
          : ml.paid.phase === "running"
            ? ml.paid.attempts > 0
              ? T(lang, "A fordítás újraindult ({n}. próbálkozás), és készül — amint kész, a nyelvi változatok maguktól megjelennek.", { n: ml.paid.attempts })
              : T(lang, "A fordítás készül — pár percen belül elkészül, és az oldal nyelvi változatai maguktól megjelennek.")
            : ml.paid.phase === "stalled"
              ? T(lang, "A generálás a vártnál tovább tart — a rendszer néhány percen belül automatikusan újraindítja. Újra fizetnie NEM kell.")
              : T(lang, "A generálás hibára futott — a rendszer automatikusan újrapróbálja. A díjat nem veszítette el, újra fizetnie NEM kell.")
      }</div></div></div>`
    : "";
  const statusBlock =
    paidBlock ||
    (ml.failedError
      ? `<div class="adm-saved" role="alert" ${warnBox}>${ic("alert", 18)} ${T(lang, "A legutóbbi generálás nem sikerült — a díjat nem veszítette el, csapatunk újraindítja. Ha sürgős, írjon nekünk.")}</div>`
      : ml.state
        ? ml.state.status === "stale"
          ? `<div class="adm-saved" role="alert" ${warnBox}>${ic("alert", 18)} <strong>${T(lang, "A fordítások elavultak.")}</strong> ${T(lang, "Módosította az oldala szövegeit, ezért a nyelvi változatok ({langs}) még a korábbi tartalmat mutatják. Az újrageneráláshoz újra ki kell fizetni a generálás díját.", { langs: esc(ml.state.langNames.join(", ")) })}</div>`
          : `<div class="adm-saved">${ic("check", 18)} ${T(lang, "A nyelvi változatok naprakészek: {langs} (generálva: {date}).", { langs: esc(ml.state.langNames.join(", ")), date: esc(ml.state.generatedAt) })}</div>`
        : "");
  const links = ml.langUrls.length
    ? `<p class="citui-hint">${T(lang, "Nyelvi változatok:")} ` +
      ml.langUrls
        .map((u) => `<a href="${esc(u.url)}" target="_blank" rel="noopener">${esc(u.lang.toUpperCase())}</a>`)
        .join(" · ") +
      `</p>`
    : "";
  // The price the buyer will ACTUALLY pay — coupon shown, never silent.
  const effPrice = ml.couponPrice ?? ml.price;
  const priceCell = ml.couponPrice
    ? `<s class="citui-hint" style="margin:0">${esc(huf(ml.price))}</s> <b>${esc(huf(effPrice))}</b> ` +
      `<span class="citui-hint" style="margin:0">${T(lang, "/ generálás · bemutatkozó kedvezmény −{p}%", { p: ml.couponPercent ?? 0 })}</span>`
    : `<b>${esc(huf(effPrice))}</b> <span class="citui-hint" style="margin:0">${T(lang, "/ generálás")}</span>`;
  const btnLabel = ml.state
    ? T(lang, "Újragenerálás fizetéssel ({price})", { price: esc(huf(effPrice)) })
    : T(lang, "Fizetés és generálás ({price})", { price: esc(huf(effPrice)) });
  // ⛔ A PAID item is not buyable again from this card (the write is gated too —
  // multilangPurchaseBlockedReason). The button stays VISIBLE but dead, so the
  // buyer sees that their click landed and nothing new will be charged.
  const payBtn = ml.paid
    ? `<button class="citui-btn citui-btn--ghost" type="submit" disabled aria-disabled="true">` +
      `${T(lang, "Kifizetve — nem kell újra fizetnie")}</button>`
    : // ADR-0119 ⑥: a suspended site may not be sold a new module. Dead button
      // with the REASON on it, not a hidden one — the owner has to be able to see
      // that the purchase exists and what stands between them and it.
      ml.frozen
      ? `<button class="citui-btn citui-btn--ghost" type="submit" disabled aria-disabled="true">` +
        `${T(lang, "Előbb a rendezetlen díjat kell rendezni")}</button>`
      : `<button class="citui-btn citui-btn--primary" type="submit">${btnLabel}</button>`;
  // The money line must state what was ALREADY charged, not re-advertise a price
  // (feedback_screen_must_not_shrink_or_decide: the biggest number is what they pay).
  const totalCell = ml.paid
    ? `<span class="citui-hint" style="margin:0">${T(lang, "Kifizetett egyszeri díj")}</span><br>` +
      `<b>${esc(huf(ml.paid.amount ?? effPrice))}</b>`
    : `<span class="citui-hint" style="margin:0">${T(lang, "Egyszeri díj")}</span><br>${priceCell}`;
  const pickerHead = ml.paid
    ? `<p style="margin:8px 0 4px"><strong>${T(lang, "A megvásárolt nyelvek")}</strong> ` +
      `<span class="citui-hint">${T(lang, "(a választás a fizetéssel véglegessé vált):")}</span></p>`
    : `<p style="margin:8px 0 4px"><strong>${T(lang, "Válasszon pontosan {count} nyelvet", { count: ml.count })}</strong> ` +
      `<span class="citui-hint">${T(lang, "(az oldal saját nyelve — {name} — nem számít bele):", { name: esc(ml.primaryLangName) })}</span></p>`;
  // "Save your texts before you pay" is advice for a purchase that is still ahead.
  const beforePayNote = ml.paid
    ? ""
    : `<p class="citui-hint" style="color:var(--citui-warn)"><strong>${T(lang, "Fontos:")}</strong> ${T(lang, "a fordítás a most elmentett tartalomból készül. Mielőtt fizet, nézze át és mentse el a szövegeit (Szövegek, Modulok) — azt fordítjuk le, ami el van mentve.")}</p>`;
  return (
    `<form method="POST" action="/admin/multilang" class="adm-card" id="tobbnyelvu">` +
    `<div class="adm-card__head"><span class="adm-ico">${ic("modules")}</span><h2>${T(lang, "Többnyelvű honlap")}</h2>${helpLink("admin.multilang", lang)}</div>` +
    `<p class="adm-lead">${T(lang, "Az oldala {count} választott nyelven is elérhető lesz — a beírt szövegei és a teljes felület lefordítva, egyszeri díjért. Ha később módosítja a szövegeit, a fordítások nem frissülnek maguktól: az újragenerálás újra ennyibe kerül. A nyelveket ilyenkor cserélheti is.", { count: ml.count })}</p>` +
    statusBlock +
    links +
    beforePayNote +
    pickerHead +
    `<div class="adm-mlang-grid">${picker}</div>` +
    `<div class="adm-total"><span>` +
    totalCell +
    `</span>` +
    payBtn +
    `</div>` +
    `</form>` +
    // Progressive enhancement: cap the picker at `count` — the server validates anyway.
    // ⛔ Skipped on a PAID card: its sync() would re-enable the frozen ticks.
    (ml.paid
      ? ""
      : `<script>(function(){var f=document.getElementById("tobbnyelvu");if(!f)return;` +
        `var cbs=[].slice.call(f.querySelectorAll('input[name="lang"]'));function sync(){` +
        `var n=cbs.filter(function(c){return c.checked}).length;` +
        `cbs.forEach(function(c){c.disabled=!c.checked&&n>=${ml.count}});}` +
        `cbs.forEach(function(c){c.addEventListener("change",sync)});sync();})();</script>`) +
    `<style>.adm-mlang-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;margin:8px 0 4px}` +
    `.adm-mlang{display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid var(--citui-line);` +
    `border-radius:var(--citui-radius-sm);cursor:pointer}` +
    `.adm-mlang input{width:18px;height:18px;accent-color:var(--citui-cyan-500)}</style>`
  );
}

// ── ADR-0078 „Webcím" fül — a JÓVÁHAGYOTT B VÁLTOZAT (3 lépés) megvalósítása.
// A kontraktus: assets/design-refs/console/domain/ (HTML + README). Ha ez a szekció
// eltér a befagyasztott képtől, a KÉP a mérce, nem ez a kód.

/** Pénz-formátum a tenant pénznemében (a multilang-kártya mintája). */
function money(n: number, currency: string): string {
  const num = String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return currency === "HUF" ? `${num} Ft` : `${num} ${currency}`;
}

/** Elérhetőség-jelölő. A három állapot a VALÓS `DomainAvailability`-t tükrözi: az
 *  előzetes csekk (DNS+RDAP) sosem hiteles, ezért a „nem tudjuk előre" külön eset —
 *  nem hazudunk zöldet olyanra, amit nem tudunk (§B.17). */
function availChip(a: "taken" | "probably_free" | "unknown", lang: string): string {
  if (a === "taken")
    return `<span class="adm-dchip adm-dchip--taken">${T(lang, "foglalt")}</span>`;
  if (a === "unknown")
    return `<span class="adm-dchip adm-dchip--unknown">${T(lang, "nem tudjuk előre")}</span>`;
  return `<span class="adm-dchip adm-dchip--free">${ic("check", 14)} ${T(lang, "szabadnak tűnik")}</span>`;
}

/**
 * ADR-0108 „Forgalom" fül — jóváhagyott terv: assets/design-refs/tenant-admin/traffic/
 * („A: mondat először", tulaj 2026-09-07).
 *
 * A kontraktus lényege: ez NEM műszerfal. A képernyő egyetlen kérdésre válaszol —
 * „megérte-e?" —, ezért MONDATTAL kezd, és a bontás csak alatta jön. Minden mondat
 * elmarad, amit nem tudunk igazul kimondani (arány minta nélkül, hoszt-bontás saját
 * domain nélkül) — a hiányzó adat itt KIHAGYÁS, sosem „0".
 */
function trafficSection(r: TrafficReport, lang: string): string {
  const head =
    `<div class="adm-card__head"><span class="adm-ico">${ic("report")}</span>` +
    `<h2>${T(lang, "Forgalom")}</h2>${helpLink("admin.traffic", lang)}</div>`;

  // Üres állapot: a bontás, a mondat és minden szám ELTŰNIK — nem 0-kkal töltjük ki a
  // felületet. Ezt látja minden új ügyfél az első hetekben, tehát ez a fő állapot.
  if (r.isEmpty) {
    return (
      `<div class="adm-card">${head}` +
      `<div class="adm-tempty"><b>${T(lang, "Még nincs mit mutatni")}</b>` +
      `<span>${T(lang, "Az oldala nemrég indult. Amint az első vendég megnyitja, itt megjelennek a számok — és havonta levélben is elküldjük.")}</span>` +
      `</div></div>`
    );
  }

  const per = (days: number, label: string): string =>
    `<a class="adm-per${r.days === days ? " on" : ""}" href="/admin?tab=forgalom&amp;nap=${days}">${esc(label)}</a>`;
  const row = (label: string, value: string): string =>
    `<div class="adm-trow"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;

  const rows =
    row(T(lang, "Megnyitások"), String(r.views)) +
    row(T(lang, "Megkeresés (foglalás, érdeklődés)"), String(r.contacts)) +
    (r.fromGooglePct !== null ? row(T(lang, "Google-ből érkezett"), `${r.fromGooglePct}%`) : "") +
    (r.mobilePct !== null ? row(T(lang, "Telefonon nézte"), `${r.mobilePct}%`) : "");

  // A megújításkor ez az egyetlen mondat, ami tényleg érvel — de csak mintával.
  const ratio =
    r.visitorsPerContact !== null
      ? `<b>${T(lang, "Minden {n}. látogatóból lesz megkeresés.", { n: String(r.visitorsPerContact) })}</b><br>`
      : "";
  // Saját domain nélkül ez a mondat KIMARAD — nem írunk ki 0-t olyasmiről, amije nincs.
  const hosts = r.hostSplit
    ? T(lang, "A saját címén ({domain}) {a}, a citoviso-címen {b} megnyitás.", {
        domain: `<b>${esc(r.hostSplit.domain)}</b>`,
        a: String(r.hostSplit.custom),
        b: String(r.hostSplit.slug),
      }) + " "
    : "";

  return (
    `<div class="adm-card">${head}` +
    `<p class="citui-hint">${T(lang, "Hányan találták meg az oldalát, és hányan kerestek meg rajta keresztül.")}</p>` +
    `<div class="adm-pers">${per(30, T(lang, "Elmúlt 30 nap"))}${per(7, T(lang, "Elmúlt 7 nap"))}</div>` +
    `<p class="adm-tbig">${T(lang, "{v} nézte meg az oldalát, és {c} kereste meg Önt.", {
      v: `<em>${T(lang, "{n} vendég", { n: String(r.visitors) })}</em>`,
      c: `<em>${r.contacts}</em>`,
    })}</p>` +
    `<div class="adm-trows">${rows}</div>` +
    `<p class="adm-thint">${ratio}${hosts}${T(lang, "A keresőrobotokat nem számoljuk bele.")}</p>` +
    `</div>`
  );
}

/** A beszerzés négy lépése, ahogy a tulaj látja (kontraktus: allapot-1-folyamatban). */
function domainProgress(done: number, lang: string): string {
  const steps: readonly [string, string][] = [
    [T(lang, "Megvásároljuk a nevet"), T(lang, "A regisztrátornál lefoglaljuk Önnek")],
    [T(lang, "Beállítjuk a címet"), T(lang, "A név a honlapjára mutat")],
    [T(lang, "Biztonsági tanúsítvány"), T(lang, "Hogy a böngésző lakatot mutasson")],
    [T(lang, "Átköltöztetés"), T(lang, "A honlapja az új néven érhető el")],
  ];
  return (
    `<div class="adm-dprog">` +
    steps
      .map(([t, s], i) => {
        const cls = i < done ? " is-done" : i === done ? " is-now" : "";
        return (
          `<div class="adm-dprog__row${cls}"><span class="adm-dprog__dot">${i < done ? ic("check", 14) : ""}</span>` +
          `<span><strong>${esc(t)}</strong><span>${esc(s)}</span></span></div>`
        );
      })
      .join("") +
    `</div>`
  );
}

/** Hány lépés kész az állapotgépből (a site.custom_domain_status-ból). */
function progressDone(status: string): number {
  switch (status) {
    case "pending":
    case "registering":
      return 0;
    case "registered":
      return 1;
    case "dns_pending":
      return 2;
    case "tls_pending":
      return 3;
    case "live":
      return 4;
    default:
      return 0;
  }
}

export interface DomainViewState {
  /** A 2. lépésre kiválasztott név (query-ből), ha ott tartunk. */
  readonly picked?: string | null;
  /** A „saját ötlet" mező ellenőrzésének eredménye, ha volt. */
  readonly check?: DomainCheckResult | null;
  /** Fizetési hiba a visszatéréskor. */
  readonly payError?: boolean;
}

export function domainSection(d: DomainAdminData, st: DomainViewState, lang = "hu"): string {
  const head = (title: string) =>
    `<div class="adm-card__head"><span class="adm-ico">${ic("domain")}</span>` +
    `<h2>${esc(title)}</h2>${helpLink("admin.domain", lang)}</div>`;

  // Mock (lokál) mód: KIMONDJUK, hogy a régi cím marad élő — különben a tesztelő azt
  // hinné, elromlott valami, amikor az új név nem nyílik meg (ADR-0071 lokál-kapu).
  const mockNote = d.mockMode
    ? `<p class="citui-hint" style="color:var(--citui-warn)"><strong>${T(lang, "Teszt mód:")}</strong> ` +
      `${T(lang, "a domaint nem vásároljuk meg élesben, és a honlap a régi címén marad elérhető. A folyamat minden lépése kipróbálható.")}</p>`
    : "";

  // ── ÁLLAPOT-KÉPERNYŐK (kontraktus: allapot-1/2/3) ──
  if (d.status === "live" && d.customDomain) {
    return (
      `<div class="adm-card">${head(T(lang, "Saját webcím"))}` +
      `<p class="adm-lead">${T(lang, "Készen vagyunk.")}</p>` +
      domainProgress(4, lang) +
      `<div class="adm-dlive">${ic("check", 18)}<span>${T(lang, "A honlapja mostantól itt érhető el:")} ` +
      `<b>${esc(d.customDomain)}</b></span></div>` +
      (d.currentHost
        ? `<p class="citui-hint" style="margin-top:12px">${T(lang, "A régi cím ({host}) automatikusan ide irányít, így a korábban kiadott névjegyek és hivatkozások is működnek.", { host: esc(d.currentHost) })}</p>`
        : "") +
      mockNote +
      `</div>`
    );
  }

  if (d.status !== "none" && d.status !== "failed") {
    return (
      `<div class="adm-card">${head(T(lang, "Saját webcím"))}` +
      `<p class="adm-lead">${T(lang, "Már intézzük — Önnek nincs teendője.")}</p>` +
      domainProgress(progressDone(d.status), lang) +
      `<p class="citui-hint" style="margin-top:12px">${T(lang, "Ez általában néhány percet vesz igénybe. E-mailben jelezzük, amint kész.")}</p>` +
      mockNote +
      `</div>`
    );
  }

  // ── LÉPÉS 2 — ÁTTEKINTÉS (a fizetési döntés önálló képernyője) ──
  // ⛔ ADR-0109 ②/§I: below the entry threshold we do not sell the name — so we
  // must not SHOW an order form for it either. Two versions were wrong before
  // this one: (1) the picker stayed up with a grey footnote underneath — the same
  // bait-and-switch the invariant bans; (2) the gate sat BELOW the `st.picked`
  // branch, so `?d=valami.hu` walked an ineligible tenant straight to a
  // "Fizetés és megrendelés" button for an order the server refuses. The gate
  // therefore stands ABOVE the review step — but BELOW the status branches, so a
  // tenant who already HAS a domain keeps seeing its state if the package drops.
  if (!d.eligible) {
    return (
      `<div class="adm-card">${head(T(lang, "Saját webcím"))}` +
      `<p class="adm-lead">${T(lang, "A saját név (pl. sajatnev.hu) {min}/hó feletti csomag mellé választható, kedvezmények nélkül számítva.", { min: esc(money(d.minPackageMonthly, d.currency)) })}</p>` +
      (d.currentHost
        ? `<div class="adm-dcurrent"><b>${esc(d.currentHost)}</b>` +
          `<span>${T(lang, "most ez a címe")}</span></div>`
        : "") +
      `<p class="citui-hint" style="margin-top:12px">${T(lang, "A név díja {price}/hó, és {n} hónapos előfizetés vállalásával jár. A hűségidő letelte után a név díjmentesen az Öné, a havidíj a fenntartásért fut tovább.", { price: esc(money(d.priceMonthly, d.currency)), n: d.commitmentMonths })}</p>` +
      `<a class="citui-btn citui-btn--primary" href="/admin?tab=modulok" style="margin-top:12px;display:inline-block">` +
      `${T(lang, "Csomag bővítése")}</a>` +
      mockNote +
      `</div>`
    );
  }

  if (st.picked) {
    return (
      `<div class="adm-dsteps"><span class="adm-dstep is-done">${T(lang, "1. Név")}</span>` +
      `<span class="adm-dstep is-now">${T(lang, "2. Áttekintés")}</span>` +
      `<span class="adm-dstep">${T(lang, "3. Kész")}</span></div>` +
      `<form method="POST" action="/admin/domain/order" class="adm-card">${head(T(lang, "Áttekintés"))}` +
      `<p class="adm-lead">${T(lang, "A választott név:")} <strong>${esc(st.picked)}</strong></p>` +
      (st.payError
        ? `<div class="adm-saved" role="alert" style="background:color-mix(in srgb, var(--citui-bad) 10%, transparent);color:var(--citui-bad)">` +
          `${ic("alert", 18)} ${T(lang, "A fizetést nem sikerült elindítani. Kérjük, próbálja újra.")}</div>`
        : "") +
      `<input type="hidden" name="domain" value="${esc(st.picked)}">` +
      `<div class="adm-dterms"><dl>` +
      `<dt>${T(lang, "A választott cím")}</dt><dd>${esc(st.picked)}</dd>` +
      // ADR-0109 ①: the fee is MONTHLY and flat — there is no waived (0 Ft) state
      // any more, so the branch that explained one is gone with it.
      `<dt>${T(lang, "A cím díja")}</dt><dd>${esc(money(d.priceMonthly, d.currency))} ${T(lang, "/ hó")}</dd>` +
      `<dt>${T(lang, "Előfizetés vállalása")}</dt><dd>${T(lang, "{n} hónap", { n: d.commitmentMonths })}</dd>` +
      `<dt class="adm-dtotal"><strong>${T(lang, "Most fizetendő")}</strong></dt>` +
      `<dd class="adm-dtotal">${esc(money(d.priceMonthly, d.currency))}</dd></dl>` +
      (d.currentHost
        ? `<p class="citui-hint" style="margin:11px 0 0">${T(lang, "A saját nevet mi vásároljuk meg és tartjuk karban. A régi cím ({host}) nem szűnik meg: automatikusan az újra irányít, így a korábbi hivatkozások is működnek tovább.", { host: esc(d.currentHost) })}</p>`
        : "") +
      `</div>` +
      mockNote +
      `<button class="citui-btn citui-btn--primary" type="submit" style="width:100%">` +
      // ADR-0109: every custom-domain order now carries a fee, so the payment step
      // always happens — no "free order" wording that would not match reality.
      `${T(lang, "Fizetés és megrendelés")}</button>` +
      `<a class="citui-btn citui-btn--ghost" href="/admin?tab=webcim" style="width:100%;margin-top:9px;display:block;text-align:center">` +
      `${T(lang, "Vissza")}</a>` +
      `</form>`
    );
  }

  // ── LÉPÉS 1 — NÉV VÁLASZTÁSA ──
  const failedBox =
    d.status === "failed"
      ? `<div class="adm-saved" role="alert" style="background:color-mix(in srgb, var(--citui-bad) 10%, transparent);color:var(--citui-bad)">` +
        `${ic("alert", 18)} ` +
        (d.failedDomain
          ? T(lang, "A(z) {domain} nevet időközben más lefoglalta.", { domain: `<b>${esc(d.failedDomain)}</b>` })
          : T(lang, "A választott nevet időközben más lefoglalta.")) +
        `</div>` +
        // ⛔ Visszautalást NEM ígérünk: a Barion Refund API létezik, de nálunk nincs
        // megírva (ADR-0078) — §B.17: magunkról sem állítunk valótlant.
        `<p class="citui-hint">${T(lang, "A befizetett összeg nem vész el: egy másik névre fordítjuk. Válassza ki, melyiket kéri helyette:")}</p>`
      : "";

  // A JÓVÁHAGYOTT B terv szerint: rádiógombos lista + EGY „Tovább" gomb — nem soronkénti
  // gomb. (Az első megvalósításom soronkénti gombot adott; a kontraktus-kép a mérce, §2b 5.)
  // A foglalt nevek kikapcsolva jelennek meg — látszik, hogy léteznek, de nem kérhetők.
  const firstFree = d.suggestions.findIndex((s) => s.availability !== "taken");
  const list = d.suggestions.length
    ? `<div class="adm-dlist">` +
      d.suggestions
        .map((s, i) => {
          const off = s.availability === "taken";
          return (
            `<label class="adm-dopt${off ? " is-off" : ""}${i === firstFree ? " is-sel" : ""}">` +
            `<input type="radio" name="d" value="${esc(s.domain)}"` +
            `${i === firstFree ? " checked" : ""}${off ? " disabled" : ""}>` +
            `<span class="adm-dopt__name">${esc(s.domain)}</span>` +
            `<span class="adm-dopt__meta">${availChip(s.availability, lang)}</span>` +
            `</label>`
          );
        })
        .join("") +
      `</div>` +
      `<button class="citui-btn citui-btn--primary" type="submit" style="width:100%">${T(lang, "Tovább")}</button>`
    : "";

  // A beírt név eredménye: normalizált alak + elérhetőség, vagy sima magyar indoklás.
  const checkBox = st.check
    ? st.check.reason
      ? `<p class="adm-dmsg adm-dmsg--bad">${esc(st.check.reason)}</p>`
      : st.check.domain
        ? st.check.tooExpensive
          ? // ADR-0093: over the operator-set purchase cap (premium domain) — not offerable.
            `<p class="adm-dmsg adm-dmsg--bad">${T(lang, "A(z) {domain} prémium (emelt díjas) domain, ezért nálunk nem igényelhető — próbáljon másik nevet.", { domain: `<b>${esc(st.check.domain)}</b>` })}</p>`
          : st.check.availability === "taken"
          ? `<p class="adm-dmsg adm-dmsg--bad">${T(lang, "A(z) {domain} már foglalt — próbáljon másikat.", { domain: `<b>${esc(st.check.domain)}</b>` })}</p>`
          : `<div class="adm-dopt" style="margin-top:10px">` +
            `<span class="adm-dopt__name">${esc(st.check.domain)}</span>` +
            `<span class="adm-dopt__meta">${availChip(st.check.availability ?? "unknown", lang)}</span>` +
            `<a class="citui-btn citui-btn--primary citui-btn--sm adm-dopt__pick" ` +
            `href="/admin?tab=webcim&d=${encodeURIComponent(st.check.domain)}">${T(lang, "Ezt kérem")}</a></div>`
        : ""
    : "";

  return (
    `<div class="adm-dsteps"><span class="adm-dstep is-now">${T(lang, "1. Név")}</span>` +
    `<span class="adm-dstep">${T(lang, "2. Áttekintés")}</span>` +
    `<span class="adm-dstep">${T(lang, "3. Kész")}</span></div>` +
    `<div class="adm-card">${head(T(lang, "Válasszon nevet"))}` +
    `<p class="adm-lead">${T(lang, "A vendégei ezt a címet fogják beírni és látni a Google-ban.")}</p>` +
    failedBox +
    (d.currentHost
      ? `<div class="adm-dcurrent"><b>${esc(d.currentHost)}</b>` +
        `<span>${T(lang, "most ez a címe")}</span></div>`
      : "") +
    // A választás GET-tel megy a 2. lépésre (?d=<név>) — így a lépés megosztható,
    // frissíthető, és JS nélkül is működik (a rádió+submit natív viselkedés).
    `<form method="GET" action="/admin">` +
    `<input type="hidden" name="tab" value="webcim">` +
    list +
    `</form>` +
    `<form method="GET" action="/admin" class="adm-down">` +
    `<input type="hidden" name="tab" value="webcim">` +
    `<div class="citui-field"><label class="citui-label" for="dcheck">${T(lang, "Vagy írja be a saját ötletét")}</label>` +
    `<div class="adm-down__row">` +
    `<input class="citui-input" id="dcheck" name="check" value="${esc(st.check?.input ?? "")}" ` +
    `placeholder="${esc(T(lang, "pl. sajatnev.hu"))}" autocapitalize="none" autocorrect="off">` +
    `<button class="citui-btn citui-btn--ghost" type="submit">${T(lang, "Ellenőrzés")}</button>` +
    `</div></div>${checkBox}</form>` +
    `<p class="citui-hint" style="margin-top:14px">` +
    `${
      // ADR-0109 ②/⑧: below the entry threshold we do not sell the name at all —
      // the honest line is the CONDITION, not a price the tenant cannot act on.
      d.eligible
        ? T(lang, "A név díja {price}/hó, és {n} hónapos előfizetés vállalásával jár. A hűségidő letelte után a név díjmentesen az Öné, a havidíj a fenntartásért fut tovább.", { price: esc(money(d.priceMonthly, d.currency)), n: d.commitmentMonths })
        : T(lang, "Saját cím {min}/hó feletti csomag mellé választható (kedvezmények nélkül számítva). Bővítse a csomagját, és a saját név is elérhetővé válik.", { min: esc(money(d.minPackageMonthly, d.currency)) })
    }</p>` +
    mockNote +
    `</div>`
  );
}

/** A „Webcím" fül saját stílusa — minden szín a dizájn-magból (ADR-0021 ①). */
/**
 * ADR-0108 „Forgalom" fül stílusa (kontraktus: design-refs/tenant-admin/traffic/).
 * A mondat a hangsúly, nem a számok — ezért a nagy kijelző-betű a mondaton ül, és a
 * bontás visszafogott sorokban jön. ⛔ Asztalin a bontás NEM rendeződik több oszlopba:
 * a méret-növelés nem terv (feedback_size_inflation_is_not_design).
 */
const TRAFFIC_STYLE =
  `<style>` +
  `.adm-pers{display:flex;gap:6px;margin:0 0 16px;flex-wrap:wrap}` +
  `.adm-per{font-size:.8rem;padding:7px 13px;border-radius:999px;text-decoration:none;` +
  `border:1px solid var(--citui-line-strong);color:var(--citui-ink)}` +
  `.adm-per.on{background:var(--citui-navy-900);border-color:var(--citui-navy-900);color:var(--citui-white);font-weight:600}` +
  `.adm-tbig{font-family:var(--citui-font-display);font-size:1.65rem;line-height:1.25;margin:0 0 12px}` +
  `.adm-tbig em{font-style:normal;color:var(--citui-cyan-500)}` +
  `.adm-trows{display:grid;gap:9px}` +
  `.adm-trow{display:flex;justify-content:space-between;align-items:baseline;gap:12px;` +
  `padding:11px 13px;border:1px solid var(--citui-line);border-radius:var(--citui-radius-sm)}` +
  `.adm-trow b{font-family:var(--citui-font-display);font-size:1.05rem}` +
  `.adm-thint{margin-top:14px;font-size:.8rem;color:var(--citui-muted);line-height:1.55}` +
  `.adm-tempty{border:1px dashed var(--citui-line-strong);border-radius:var(--citui-radius-sm);` +
  `padding:22px 16px;text-align:center}` +
  `.adm-tempty b{display:block;font-family:var(--citui-font-display);font-size:1.05rem;margin-bottom:6px}` +
  `.adm-tempty span{font-size:.85rem;color:var(--citui-muted);line-height:1.55}` +
  `</style>`;

const DOMAIN_STYLE =
  `<style>` +
  `.adm-dsteps{display:flex;gap:6px;margin:0 0 16px}` +
  `.adm-dstep{flex:1;text-align:center;font-size:.76rem;padding:8px 4px;border-radius:var(--citui-radius-sm);` +
  `background:var(--citui-surface-2);color:var(--citui-muted);border:1px solid var(--citui-line)}` +
  `.adm-dstep.is-now{background:var(--citui-navy-900);color:var(--citui-white);border-color:var(--citui-navy-900)}` +
  `.adm-dstep.is-done{color:var(--citui-ok);border-color:var(--citui-ok)}` +
  `.adm-dcurrent{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:var(--citui-surface-2);` +
  `border:1px solid var(--citui-line);border-radius:var(--citui-radius);padding:12px 14px;margin:0 0 16px}` +
  `.adm-dcurrent b{font-family:var(--citui-font-display);overflow-wrap:anywhere}` +
  `.adm-dcurrent span{font-size:.85rem;color:var(--citui-muted)}` +
  `.adm-dlist{display:flex;flex-direction:column;gap:9px;margin:0 0 16px}` +
  `.adm-dopt{display:flex;align-items:center;gap:11px;padding:13px 14px;border:1.5px solid var(--citui-line);` +
  `border-radius:var(--citui-radius);background:var(--citui-white);min-height:56px;flex-wrap:wrap;cursor:pointer;` +
  `transition:var(--citui-transition)}` +
  `.adm-dopt:hover{border-color:var(--citui-cyan-500)}` +
  `.adm-dopt:has(input:checked){border-color:var(--citui-cyan-500);` +
  `background:color-mix(in srgb, var(--citui-cyan-500) 7%, var(--citui-white))}` +
  `.adm-dopt.is-off{opacity:.55;cursor:not-allowed}` +
  `.adm-dopt.is-off:hover{border-color:var(--citui-line)}` +
  `.adm-dopt input{width:20px;height:20px;flex:none;accent-color:var(--citui-cyan-500)}` +
  `.adm-dopt__name{font-family:var(--citui-font-display);font-size:1.02rem;flex:1;min-width:0;overflow-wrap:anywhere}` +
  `.adm-dopt__pick{margin-left:auto;flex:none}` +
  `.adm-dchip{font-size:.74rem;padding:3px 9px;border-radius:var(--citui-radius-pill);white-space:nowrap;` +
  `display:inline-flex;align-items:center;gap:4px;flex:none}` +
  `.adm-dchip--free{background:var(--citui-ok-soft);color:var(--citui-ok)}` +
  `.adm-dchip--taken{background:color-mix(in srgb, var(--citui-bad) 12%, transparent);color:var(--citui-bad)}` +
  `.adm-dchip--unknown{background:color-mix(in srgb, var(--citui-warn) 15%, transparent);color:var(--citui-warn)}` +
  `.adm-down{border-top:1px solid var(--citui-line);padding-top:15px;margin-top:4px}` +
  `.adm-down__row{display:flex;gap:8px}.adm-down__row .citui-input{flex:1;min-width:0}` +
  `.adm-dmsg{margin-top:9px;font-size:.86rem;padding:9px 11px;border-radius:var(--citui-radius-sm)}` +
  `.adm-dmsg--bad{background:color-mix(in srgb, var(--citui-bad) 10%, transparent);color:var(--citui-bad)}` +
  `.adm-dterms{background:var(--citui-surface-2);border:1px solid var(--citui-line);` +
  `border-radius:var(--citui-radius);padding:14px 15px;margin:16px 0}` +
  `.adm-dterms dl{margin:0;display:grid;grid-template-columns:1fr auto;gap:9px 12px;font-size:.9rem}` +
  `.adm-dterms dt{color:var(--citui-muted)}` +
  `.adm-dterms dd{margin:0;text-align:right;font-family:var(--citui-font-display)}` +
  `.adm-dterms .adm-dtotal{border-top:1px solid var(--citui-line-strong);padding-top:9px;font-size:1.05rem}` +
  `.adm-dprog{display:flex;flex-direction:column;margin:6px 0 0}` +
  `.adm-dprog__row{display:flex;align-items:flex-start;gap:11px;padding:11px 0}` +
  `.adm-dprog__row+.adm-dprog__row{border-top:1px solid var(--citui-line)}` +
  `.adm-dprog__dot{width:22px;height:22px;border-radius:50%;flex:none;display:grid;place-items:center;` +
  `border:2px solid var(--citui-line-strong);background:var(--citui-white);margin-top:1px}` +
  `.adm-dprog__row.is-done .adm-dprog__dot{background:var(--citui-ok);border-color:var(--citui-ok);color:var(--citui-white)}` +
  `.adm-dprog__row.is-now .adm-dprog__dot{border-color:var(--citui-cyan-500);` +
  `background:color-mix(in srgb, var(--citui-cyan-500) 20%, var(--citui-white))}` +
  `.adm-dprog__row strong{display:block;font-size:.95rem}` +
  `.adm-dprog__row span span{display:block;font-size:.82rem;color:var(--citui-muted);margin-top:2px}` +
  `.adm-dlive{display:flex;align-items:center;gap:9px;padding:13px 15px;border-radius:var(--citui-radius);` +
  `background:var(--citui-ok-soft);color:var(--citui-ok);font-size:.92rem;margin-top:14px}` +
  `.adm-dlive b{font-family:var(--citui-font-display);overflow-wrap:anywhere}` +
  // Keskeny nézet: a domain-név NE törjön szó közepén — a jelölő és a gomb csúszik a név alá.
  // A jelölő SAJÁT szélességét tartja; a full-width csak a burkolóra vonatkozik, különben
  // a chip háttere végignyúlna a soron (390px-en mérve).
  `.adm-dopt__meta{flex:none;display:flex}` +
  `@media (max-width:430px){.adm-dopt__name{flex:1 1 auto}` +
  `.adm-dopt__meta{flex-basis:100%;margin-left:31px}.adm-dopt__pick{margin-left:31px}}` +
  `</style>`;

/** Admin sections — a real sidebar menu instead of one endless scroll (ADR-0034/0035). */
// A FUNCTION, not a const: the labels must be translated at RENDER time (the
// reader's language is only known then), and the T() calls must keep LITERAL
// source strings so the catalog extractor can see them (ADR-0067).
const TABS = (lang = "hu"): readonly { id: string; label: string; icon: string }[] => [
  { id: "attekintes", label: T(lang, "Áttekintés"), icon: "overview" },
  { id: "szovegek", label: T(lang, "Szövegek"), icon: "texts" },
  { id: "fotok", label: T(lang, "Fotók"), icon: "photos" },
  { id: "modulok", label: T(lang, "Modulok"), icon: "modules" },
  // Jóváhagyott terv 2026-09-06: a foglalási kérések SAJÁT felületet kapnak badge-dzsel —
  // a Modulok → Foglalás alá temetve nem látszottak (booking-luka triázs).
  { id: "foglalasok", label: T(lang, "Foglalások"), icon: "bookings" },
  // ADR-0078: a saját webcím önálló fül — a fizetési döntés külön képernyőt kap.
  { id: "webcim", label: T(lang, "Webcím"), icon: "domain" },
  // ADR-0108: a forgalom az ALAPCSOMAG része — saját fül, nem modul mögé rejtve.
  { id: "forgalom", label: T(lang, "Forgalom"), icon: "report" },
  // ADR-0084 (jóváhagyott terv): a bizonylatok és a kommunikáció két külön fül.
  // ⛔ A felirat „Dokumentumok" — tulajdonosi javítás: magyarul nem „Iratok".
  { id: "dokumentumok", label: T(lang, "Dokumentumok"), icon: "docs" },
  { id: "uzenetek", label: T(lang, "Üzenetek"), icon: "mail" },
  { id: "fiok", label: T(lang, "Fiók"), icon: "account" },
  // ADR-0045: the searchable knowledge base is its own surface, not only per-section icons.
  { id: "sugo", label: T(lang, "Súgó"), icon: "help" },
];

/**
 * The page H1 for a tab. Usually the tab label, but the Dokumentumok tab carries
 * a longer heading than fits the nav (approved plan: nav "Dokumentumok", page
 * "Számlák és dokumentumok").
 */
function tabHeading(tab: string, lang: string): string {
  if (tab === "dokumentumok") return T(lang, "Számlák és dokumentumok");
  return TABS(lang).find((t) => t.id === tab)?.label ?? T(lang, "Áttekintés");
}

/** Sidebar / bottom-bar navigation links (icon + label), with the active item highlighted.
 *  `unread` paints the Üzenetek badge — the whole point of a mailbox is to be told
 *  there is something in it without opening it. */
function navItems(active: string, lang = "hu", unread = 0, unseenBookings = 0): string {
  return TABS(lang)
    .map((t) => {
      const badge =
        t.id === "uzenetek" && unread > 0
          ? `<span class="adm-nav__bdg" aria-label="${esc(T(lang, "{n} olvasatlan üzenet", { n: unread }))}">${unread > 99 ? "99+" : unread}</span>`
          : t.id === "foglalasok" && unseenBookings > 0
            ? `<span class="adm-nav__bdg" aria-label="${esc(T(lang, "{n} új foglalási kérés", { n: unseenBookings }))}">${unseenBookings > 99 ? "99+" : unseenBookings}</span>`
            : "";
      return `<a href="/admin?tab=${t.id}"${t.id === active ? ' class="is-active"' : ""}>${ic(t.icon)}<span>${esc(t.label)}</span>${badge}</a>`;
    })
    .join("");
}

/** Overview: status tiles + an honest next-step checklist. */
function overviewSection(
  content: NonNullable<AdminContent>,
  statusText: string,
  siteUrl: string | null,
  previewUrl: string | null,
  mv: TenantModuleView | null,
  lang = "hu",
): string {
  const live = content.status === "live";
  // The two tabs count DIFFERENT things and neither said so: the overview counts
  // every live module (12), while the Modulok tab bills 11 of them — the twelfth
  // is the spine "Időpontkérés", superseded by "Online foglalás", hence 0 Ft
  // (Elek FK-002 GY1). Both numbers are true; the label now NAMES which is which
  // instead of one of them quietly disappearing.
  const activeCount = mv ? mv.modules.filter((m) => m.active).length : 0;
  const billedActiveCount = mv
    ? mv.modules.filter((m) => m.active && !m.spine && !m.supersededBy).length
    : 0;
  const addr = siteUrl
    ? `<a href="${esc(siteUrl)}" target="_blank" rel="noopener">${esc(siteUrl.replace(/^https?:\/\//, ""))}</a>`
    : previewUrl
      ? `<a href="${esc(previewUrl)}" target="_blank" rel="noopener">${T(lang, "privát előnézet")}</a>`
      : `<span class="citui-hint">–</span>`;
  const todoItem = (done: boolean, html: string) =>
    `<li class="${done ? "done" : "pending"}"><span class="adm-tico">${ic(done ? "check" : "alert", 18)}</span><span>${html}</span></li>`;
  const todo =
    todoItem(
      content.usingOwnPhotos,
      content.usingOwnPhotos
        ? T(lang, "Saját fotóid vannak fent")
        : `<strong>${T(lang, "Tölts fel saját fotókat")}</strong> ${T(lang, "— jelenleg bemutató képek láthatók (")}<a href="/admin?tab=fotok">${T(lang, "Fotók")}</a>)`,
    ) +
    todoItem(
      Boolean(content.intro && content.intro.length > 40),
      content.intro && content.intro.length > 40
        ? T(lang, "Bemutatkozó szöveged kész")
        : `<strong>${T(lang, "Írd meg a bemutatkozó szöveget")}</strong> (<a href="/admin?tab=szovegek">${T(lang, "Szövegek")}</a>)`,
    ) +
    todoItem(
      live,
      live
        ? T(lang, "Az oldalad élő és nyilvános")
        : T(lang, "Az oldal még nem publikus — a Citoviso élesíti, amint minden készen áll"),
    );
  return (
    `<div class="adm-card">` +
    `<div class="adm-card__head"><span class="adm-ico">${ic("overview")}</span><h2>${T(lang, "Áttekintés")}</h2>${helpLink("admin.overview", lang)}</div>` +
    `<div class="adm-stats">` +
    `<div class="adm-stat"><b><span class="citui-pill ${live ? "citui-pill--ok" : "citui-pill--info"}">${esc(statusText)}</span></b><span>${T(lang, "Állapot")}</span></div>` +
    `<div class="adm-stat"><b style="font-size:1rem">${addr}</b><span>${T(lang, "Az oldal címe")}</span></div>` +
    `<div class="adm-stat"><b>${T(lang, "{n} db", { n: activeCount })}</b><span>${
      billedActiveCount === activeCount
        ? T(lang, "Aktív modul ·")
        : T(lang, "Aktív modul · ebből {n} számlázott ·", { n: String(billedActiveCount) })
    } <a href="/admin?tab=modulok">${T(lang, "kezelés")}</a></span></div>` +
    `</div>` +
    `<h3 style="font-size:1rem;margin:24px 0 0;font-family:var(--citui-font-display)">${T(lang, "Teendők")}</h3>` +
    `<ul class="adm-todo">${todo}</ul>` +
    `</div>`
  );
}

function textsSection(content: NonNullable<AdminContent>, lang = "hu"): string {
  const highlights = (content.highlights ?? []).join("\n");
  return (
    `<form method="POST" action="/admin/text" class="adm-card">` +
    `<div class="adm-card__head"><span class="adm-ico">${ic("texts")}</span><h2>${T(lang, "Szövegek")}</h2>${helpLink("admin.texts", lang)}</div>` +
    `<p class="adm-lead">${T(lang, "Ezek a szövegek jelennek meg az oldaladon.")}</p>` +
    `<div class="citui-field"><label class="citui-label" for="name">${T(lang, "Vállalkozás neve")}</label>` +
    `<input class="citui-input" id="name" name="name" value="${esc(content.name)}"></div>` +
    `<div class="citui-field"><label class="citui-label" for="tagline">${T(lang, "Szlogen (rövid mondat a fejlécben)")}</label>` +
    `<input class="citui-input" id="tagline" name="tagline" value="${esc(content.tagline)}"></div>` +
    `<div class="citui-field"><label class="citui-label" for="intro">${T(lang, "Bemutatkozó szöveg")}</label>` +
    `<textarea class="citui-textarea" id="intro" name="intro" style="min-height:140px">${esc(content.intro)}</textarea></div>` +
    `<div class="citui-field"><label class="citui-label" for="highlights">${T(lang, "Kiemelések (soronként egy)")}</label>` +
    `<textarea class="citui-textarea" id="highlights" name="highlights" style="min-height:110px">${esc(highlights)}</textarea></div>` +
    `<button class="citui-btn citui-btn--primary" type="submit">${T(lang, "Mentés és frissítés")}</button>` +
    `</form>`
  );
}

/* ══ ADR-0084 — „Dokumentumok" fül ════════════════════════════════════════════
   Kontraktus: assets/design-refs/tenant-admin/dokumentumok-uzenetek-a-README.md.
   Szerver-oldali render, ZÉRÓ JavaScript: a szűrő és a kereső GET-paraméter, mint
   a Súgó fülé — így a no-JS ág is teljes, és a tulaj megoszthatja/könyvjelzőzheti
   a szűrt nézetet. */

/** A hónap/nap formátum a felhasználó nyelvén — sosem beégetett magyar alak. */
function fmtDate(d: Date, lang: string): string {
  return new Intl.DateTimeFormat(lang === "hu" ? "hu-HU" : lang, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Date WITH time — same-day system messages were indistinguishable without it
 *  (Elek FK-001 G2: two mails, one date, no order visible). */
function fmtDateTime(d: Date, lang: string): string {
  return new Intl.DateTimeFormat(lang === "hu" ? "hu-HU" : lang, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function fmtMoney(amount: number, currency: string, lang: string): string {
  return new Intl.NumberFormat(lang === "hu" ? "hu-HU" : lang, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Kereső + szűrő-chipek sávja. `chips` = [érték, felirat]; az aktív az `active`. */
function filterBar(
  baseUrl: string,
  searchPlaceholder: string,
  q: string,
  chips: readonly (readonly [string, string])[],
  active: string,
  extraParams: Record<string, string>,
  lang: string,
): string {
  const p = (over: Record<string, string>): string => {
    const sp = new URLSearchParams({ ...extraParams, ...over });
    for (const [k, v] of [...sp.entries()]) if (!v) sp.delete(k);
    const s = sp.toString();
    return `${baseUrl}${s ? `&${s}` : ""}`;
  };
  const hidden = Object.entries(extraParams)
    .filter(([, v]) => v)
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
    .join("");
  const dirty = Boolean(q) || active !== "mind";
  return (
    `<form class="adm-tools" method="GET" action="/admin">` +
    `<input type="hidden" name="tab" value="${esc(extraParams.tab ?? "")}">` +
    hidden +
    // aria-label, nem külön <span>: a látható duplikált felirat pont az, amit a
    // képernyőolvasó-címke elkerülni hivatott (a KB-screenshoton kétszer állt ott).
    `<span class="adm-search">${ic("zoom", 17)}` +
    `<input name="q" value="${esc(q)}" placeholder="${esc(searchPlaceholder)}" aria-label="${esc(searchPlaceholder)}"></span>` +
    chips
      .map(
        ([val, label]) =>
          `<a class="adm-fchip${val === active ? " is-active" : ""}" href="${esc(p({ f: val === "mind" ? "" : val, q }))}">${esc(label)}</a>`,
      )
      .join("") +
    (dirty
      ? `<a class="adm-clearf" href="${esc(p({ f: "", q: "" }))}">${T(lang, "Szűrés törlése")}</a>`
      : "") +
    `</form>`
  );
}

/** ADR-0110: what the „Jogi adatok" panel shows and edits. `missing` lists the
 *  statutory imprint fields we still do not hold — the panel says so out loud. */
export interface LegalAdminData {
  readonly who: TenantLegalIdentity;
  readonly missing: readonly string[];
  /** Links to the tenant's own published pages, when the site is public. */
  readonly privacyUrl?: string | null;
  readonly imprintUrl?: string | null;
}

export interface DocumentsAdminData {
  readonly invoices: readonly {
    readonly id: string;
    readonly invoiceNumber: string | null;
    readonly issuedAt: Date;
    readonly gross: number;
    readonly currency: string;
    readonly status: string;
    readonly vatTreatment: string | null;
    readonly hasPdf: boolean;
    readonly periodStart: Date | null;
    readonly periodEnd: Date | null;
    readonly year: string;
  }[];
  readonly agreements: readonly {
    readonly key: string;
    readonly acceptedAt: Date;
    readonly year: string;
    readonly text: string | null;
    readonly facts: readonly { readonly key: string; readonly value: string }[];
  }[];
  /** Which sub-list is open: 'szamlak' | 'szerzodesek'. */
  readonly sub: string;
  /** Year filter ('mind' = all) and the free-text query. */
  readonly year: string;
  readonly q: string;
  /** Next renewal day, when there is a subscription — shown in the summary strip. */
  readonly nextRenewal: Date | null;
}

/** Címke egy szerződés-fajtához. A kulcs stabil, a felirat fordul (ADR-0036). */
function agreementTitle(key: string, lang: string): string {
  return key === "order"
    ? T(lang, "Megrendelés")
    : key === "terms"
      ? T(lang, "Általános Szerződési Feltételek")
      : key === "photo_rights"
        ? T(lang, "Fotó-jogi önnyilatkozat")
        : T(lang, "Elállási jog lemondása");
}

function agreementFactLabel(key: string, lang: string): string {
  return key === "billingPeriod"
    ? T(lang, "Fizetési ütem")
    : key === "price"
      ? T(lang, "Díj")
      : key === "domain"
        ? T(lang, "Webcím")
        : T(lang, "Hűségidő");
}

function documentsSection(d: DocumentsAdminData, lang = "hu"): string {
  const base = "/admin?tab=dokumentumok";
  const subUrl = (s: string): string => `${base}&sub=${s}`;
  // Az évek AZ ADATBÓL jönnek — üres évre nem kínálunk gombot (a terv köti).
  const years = [...new Set([...d.invoices.map((i) => i.year), ...d.agreements.map((a) => a.year)])]
    .sort()
    .reverse();
  const chips: (readonly [string, string])[] = [
    ["mind", T(lang, "Mind")],
    ...years.map((y) => [y, y] as const),
  ];
  // Ékezet- és kisbetű-érzéketlen keresés a KÖZÖS fold-szabállyal: a DB kollációja
  // `C`, ezért az SQL-oldali ILIKE az ékezetes nagybetűt NEM hajtaná kisbetűre
  // (mérve). Így a „szamla" is megtalálja a „számlá"-t — telefonon ékezet nélkül gépelnek.
  const term = d.q.trim();
  const matchInv = (i: DocumentsAdminData["invoices"][number]): boolean =>
    (d.year === "mind" || i.year === d.year) &&
    foldIncludes(
      [
        i.invoiceNumber ?? "",
        String(i.gross),
        i.vatTreatment ?? "",
        fmtDate(i.issuedAt, lang),
        i.periodStart ? fmtDate(i.periodStart, lang) : "",
      ].join(" "),
      term,
    );
  const matchAgr = (a: DocumentsAdminData["agreements"][number]): boolean =>
    (d.year === "mind" || a.year === d.year) &&
    foldIncludes(
      [agreementTitle(a.key, lang), a.text ?? "", fmtDate(a.acceptedAt, lang)].join(" "),
      term,
    );

  const invHits = d.invoices.filter(matchInv);
  const agrHits = d.agreements.filter(matchAgr);
  const onInvoices = d.sub !== "szerzodesek";
  const hits = onInvoices ? invHits.length : agrHits.length;
  const otherHits = onInvoices ? agrHits.length : invHits.length;

  // Az összegző EGYÜTT MOZOG a szűrővel: szűrt nézetben a teljes összeg félrevezet.
  const issued = invHits.filter((i) => i.status === "issued");
  const total = issued.reduce((s, i) => s + i.gross, 0);
  const currency = issued[0]?.currency ?? "HUF";
  const summary =
    `<div class="adm-docsum">` +
    `<div><div class="l">${d.year === "mind" ? T(lang, "Kiállított számla") : T(lang, "{year}-ben", { year: d.year })}</div>` +
    `<div class="v">${T(lang, "{n} db", { n: issued.length })}</div></div>` +
    `<div><div class="l">${T(lang, "Összesen")}</div><div class="v">${esc(fmtMoney(total, currency, lang))}</div></div>` +
    (d.nextRenewal
      ? `<div><div class="l">${T(lang, "Következő fordulónap")}</div><div class="v">${esc(fmtDate(d.nextRenewal, lang))}</div></div>`
      : "") +
    `</div>`;

  const tools = filterBar(
    base,
    T(lang, "Keresés: számlaszám, összeg, időszak…"),
    d.q,
    chips,
    d.year,
    { tab: "dokumentumok", sub: d.sub },
    lang,
  );

  const dirty = Boolean(term) || d.year !== "mind";
  const countLine = dirty
    ? `<p class="adm-cnt">${T(lang, "{n} találat", { n: hits })}` +
      (otherHits
        ? ` · ` +
          T(lang, "a {other} között további {n} találat", {
            other: `<a href="${esc(`${subUrl(onInvoices ? "szerzodesek" : "szamlak")}&q=${encodeURIComponent(d.q)}&f=${d.year === "mind" ? "" : d.year}`)}">${onInvoices ? T(lang, "Szerződések") : T(lang, "Számlák")}`,
            n: `${otherHits}</a>`,
          })
        : "") +
      `</p>`
    : "";

  const invoiceRows = invHits
    .map((i) => {
      // A kiállítás napja ÉS az időszak kezdete rendszerint ugyanaz — kiírva
      // kétszer ott áll ugyanaz a dátum. Ilyenkor az IDŐSZAK a beszédesebb.
      const period =
        i.periodStart && i.periodEnd
          ? `${fmtDate(i.periodStart, lang)} – ${fmtDate(i.periodEnd, lang)}`
          : "";
      const issued =
        period && i.periodStart && fmtDate(i.periodStart, lang) === fmtDate(i.issuedAt, lang)
          ? ""
          : fmtDate(i.issuedAt, lang);
      const when = [issued, period].filter(Boolean).join(" · ");
      // A sikertelen számlázás NEM hiba a tenantnak: nincs bizonylat, tehát nincs
      // letöltés sem — de az összeg és a „folyamatban" állapot őszintén látszik.
      // ⚠️ CSAK a számmal NEM rendelkező sor „folyamatban": a sztornó ATTÓL MÉG
      // létező bizonylat (száma és PDF-je van), és a tenantnak látnia kell.
      if (i.status === "failed" || !i.invoiceNumber) {
        return (
          `<div class="adm-inv adm-inv--pending">` +
          `<span class="adm-inv__ico">${ic("clock", 20)}</span>` +
          `<div class="adm-inv__t"><strong>${T(lang, "Számlázás folyamatban")}</strong>` +
          `<span class="sub">${esc(when)}</span>` +
          `<span class="adm-chip2 adm-chip2--warn">${T(lang, "Még nincs bizonylat")}</span></div>` +
          `<div class="adm-inv__r"><div class="adm-inv__amt">${esc(fmtMoney(i.gross, i.currency, lang))}</div></div>` +
          `</div>`
        );
      }
      return (
        `<div class="adm-inv">` +
        `<span class="adm-inv__ico">${ic("docs", 20)}</span>` +
        `<div class="adm-inv__t"><strong>${esc(i.invoiceNumber)}</strong>` +
        `<span class="sub">${esc(when)}</span>` +
        `<span class="adm-chip2 adm-chip2--ok">${i.status === "storno" ? T(lang, "Sztornózva") : T(lang, "Kifizetve")}${i.vatTreatment === "aam" ? " · AAM" : ""}</span></div>` +
        `<div class="adm-inv__r"><div class="adm-inv__amt">${esc(fmtMoney(i.gross, i.currency, lang))}</div>` +
        // A PDF az ELSŐDLEGES művelet: a soron, egy koppintásra (a terv köti).
        (i.hasPdf
          ? `<a class="adm-dl" href="/admin/szamla/${esc(i.id)}.pdf">${ic("docs", 14)} ${T(lang, "PDF")}</a>`
          : "") +
        `</div></div>`
      );
    })
    .join("");

  const agreementCards = agrHits
    .map(
      (a) =>
        `<div class="adm-doc"><h3>${esc(agreementTitle(a.key, lang))}</h3>` +
        `<div class="meta">${T(lang, "{date}-án elfogadva", { date: esc(fmtDate(a.acceptedAt, lang)) })}</div>` +
        (a.facts.length
          ? `<dl>` +
            a.facts
              .map(
                (f) =>
                  `<dt>${esc(agreementFactLabel(f.key, lang))}</dt><dd>${esc(f.value)}</dd>`,
              )
              .join("") +
            `</dl>`
          : "") +
        (a.text ? `<div class="quote">„${esc(a.text)}"</div>` : "") +
        `</div>`,
    )
    .join("");

  // ⚠️ KÉT KÜLÖN üres állapot. A „Nincs a keresésnek megfelelő…" csak akkor IGAZ,
  // ha tényleg keresett. Ha egyáltalán nincs bizonylata, ez a mondat félrevezeti
  // („rosszul kerestem?"), holott nincs mit találni — az egyik a szűrőhöz küldi
  // vissza, a másik megnyugtatja. Az élő screenshoton bukott ki: számla nélküli
  // tenantnál keresés nélkül állt ott a „keresésnek megfelelő" szöveg.
  const nothingAtAll = onInvoices ? d.invoices.length === 0 : d.agreements.length === 0;
  const emptyMsg = onInvoices
    ? nothingAtAll
      ? `<div class="adm-empty">${T(lang, "Még nincs számlája.")}<br>${T(lang, "Az első számla az előfizetés megkezdésekor készül el, és itt jelenik meg — e-mailben is megküldjük.")}</div>`
      : `<div class="adm-empty">${T(lang, "Nincs a keresésnek megfelelő számla.")}<br>${T(lang, "Próbáljon más szót vagy másik évet.")}</div>`
    : nothingAtAll
      ? `<div class="adm-empty">${T(lang, "Még nincs elfogadott nyilatkozata.")}<br>${T(lang, "Itt jelennek meg, amint megrendeli a szolgáltatást.")}</div>`
      : `<div class="adm-empty">${T(lang, "Nincs a keresésnek megfelelő szerződés.")}<br>${T(lang, "Próbáljon más szót vagy másik évet.")}</div>`;
  // Üres listán a kereső és az összegző csak zaj — nincs mit szűrni, nincs mit összegezni.
  const maybeTools = nothingAtAll && !dirty ? "" : tools + countLine;

  const body = onInvoices
    ? (d.invoices.length ? summary : "") + maybeTools + (invoiceRows || emptyMsg)
    : `<p class="adm-lead">${T(lang, "Itt gyűjtjük össze, mihez járult hozzá és mikor. Ezeket nem tudja módosítani — a saját nyilvántartása és egy esetleges vita esetére őrizzük meg.")}</p>` +
      maybeTools +
      (agreementCards || emptyMsg);

  return (
    `<div class="adm-card">` +
    `<div class="adm-card__head"><span class="adm-ico">${ic("docs")}</span>` +
    `<h2>${T(lang, "Számlák és dokumentumok")}</h2>${helpLink("admin.documents", lang)}</div>` +
    `<div class="adm-subtabs">` +
    `<a class="${onInvoices ? "is-active" : ""}" href="${esc(subUrl("szamlak"))}">${T(lang, "Számlák")}</a>` +
    `<a class="${onInvoices ? "" : "is-active"}" href="${esc(subUrl("szerzodesek"))}">${T(lang, "Szerződések")}</a>` +
    `</div>` +
    body +
    `</div>`
  );
}

/* ══ ADR-0084 — „Üzenetek" fül ═══════════════════════════════════════════════ */

export interface MessagesAdminData {
  readonly messages: readonly {
    readonly id: string;
    readonly channel: "email" | "sms";
    readonly subject: string | null;
    readonly bodyText: string;
    readonly recipient: string;
    readonly attachmentName: string | null;
    readonly relatedKind: string | null;
    readonly relatedId: string | null;
    readonly sentAt: Date;
    readonly readAt: Date | null;
  }[];
  readonly unread: number;
  readonly filter: string;
  readonly q: string;
  /** Which message is open (?open=<id>) — opening it also marks it read. */
  readonly openId: string | null;
}

function messagesSection(m: MessagesAdminData, lang = "hu"): string {
  const base = "/admin?tab=uzenetek";
  const chips: (readonly [string, string])[] = [
    ["mind", T(lang, "Mind")],
    ["email", T(lang, "E-mail")],
    ["sms", T(lang, "SMS")],
    ["olvasatlan", m.unread ? T(lang, "Olvasatlan ({n})", { n: m.unread }) : T(lang, "Olvasatlan")],
  ];
  const tools = filterBar(
    base,
    T(lang, "Keresés az üzenetek között…"),
    m.q,
    chips,
    m.filter,
    { tab: "uzenetek" },
    lang,
  );

  const rows = m.messages
    .map((x) => {
      const open = x.id === m.openId;
      // SMS-nek nincs tárgya — ilyenkor a törzs első sora a cím (nem hazudunk üres tárgyat).
      const title = x.subject ?? x.bodyText.split("\n")[0]!.slice(0, 90);
      const preview = x.bodyText.split("\n").find((l) => l.trim()) ?? "";
      const unread = !x.readAt;
      const href = open
        ? `${base}&f=${m.filter === "mind" ? "" : m.filter}&q=${encodeURIComponent(m.q)}`
        : `${base}&f=${m.filter === "mind" ? "" : m.filter}&q=${encodeURIComponent(m.q)}&open=${encodeURIComponent(x.id)}`;
      return (
        `<div class="adm-msg${unread ? " is-unread" : ""}" id="uz-${esc(x.id)}">` +
        `<a class="adm-msg__hd" href="${esc(href)}#uz-${esc(x.id)}">` +
        `<span class="adm-msg__ch${x.channel === "sms" ? " adm-msg__ch--sms" : ""}">${ic(x.channel === "sms" ? "sms" : "mail", 19)}</span>` +
        `<span class="adm-msg__t"><strong>${esc(title)}</strong>` +
        `<span class="pv">${esc(preview.slice(0, 90))}</span></span>` +
        `<span class="adm-msg__d">${esc(fmtDateTime(x.sentAt, lang))}</span>` +
        `</a>` +
        (open
          ? `<div class="adm-msg__body"><p>${esc(x.bodyText)}</p>` +
            `<div class="adm-msg__meta">` +
            (x.channel === "sms" ? T(lang, "SMS") : T(lang, "E-mail")) +
            ` · ${esc(x.recipient)} · ${esc(fmtDateTime(x.sentAt, lang))}` +
            (x.attachmentName
              ? `<br>${T(lang, "Melléklet:")} <b>${esc(x.attachmentName)}</b>`
              : "") +
            `</div>` +
            // A melléklet a Dokumentumok fülről tölthető le — egy bizonylat egy helyen.
            (x.attachmentName && x.relatedKind === "invoice" && x.relatedId
              ? `<a class="adm-dl" href="/admin/szamla/${esc(x.relatedId)}.pdf">${ic("docs", 14)} ${T(lang, "Melléklet letöltése")}</a>`
              : "") +
            `</div>`
          : "") +
        `</div>`
      );
    })
    .join("");

  const empty = m.q || m.filter !== "mind"
    ? `<div class="adm-empty">${T(lang, "Nincs a szűrésnek megfelelő üzenet.")}<br>${T(lang, "Próbáljon más szűrőt vagy keresőszót.")}</div>`
    : // ADR-0084 ③: a napló a bekapcsolás napjától él — ezt kimondjuk, nem úgy
      // teszünk, mintha sosem írtunk volna a tulajnak.
      `<div class="adm-empty">${T(lang, "Itt jelennek meg az értesítéseink — számla, fizetési emlékeztető, a honlapját érintő hírek.")}<br>` +
      `${T(lang, "Egyelőre nincs egy sem: a levelek gyűjtését most kapcsoltuk be, a korábbiak nem szerepelnek itt.")}</div>`;

  return (
    `<div class="adm-card">` +
    `<div class="adm-card__head"><span class="adm-ico">${ic("mail")}</span>` +
    `<h2>${T(lang, "Üzenetek")}</h2>${helpLink("admin.messages", lang)}</div>` +
    `<p class="adm-lead">${T(lang, "Minden értesítés, amit Önnek küldtünk — e-mailben és SMS-ben. Így akkor is megtalálja, ha a levél a levélszemétbe került.")}</p>` +
    // Üres postaládán a kereső csak zaj — ugyanaz a szabály, mint a Dokumentumoknál.
    (m.messages.length === 0 && !m.q && m.filter === "mind" ? "" : tools) +
    (m.unread
      ? `<form method="POST" action="/admin/uzenetek/olvasott" style="margin:-4px 0 12px">` +
        `<button class="citui-btn citui-btn--ghost" type="submit">${T(lang, "Mind olvasott")}</button></form>`
      : "") +
    (rows || empty) +
    `</div>`
  );
}

/**
 * ADR-0110 — the legal data the accommodation PUBLISHES on its own imprint and
 * privacy notice.
 *
 * Seeded from the checkout buyer record, so an owner who never opens this panel
 * still publishes a correct imprint. What we cannot know (registry number, NTAK id)
 * is asked for here, and while a statutory field is missing the panel says so —
 * on the page itself the row reads "— nincs megadva —" instead of quietly
 * disappearing, so the gap is visible on both sides (ADR-0110 ⑥).
 */
function legalSection(legal: LegalAdminData, lang = "hu"): string {
  const field = (
    id: string,
    label: string,
    value: string | null,
    hint?: string,
  ): string =>
    `<div class="citui-field"><label class="citui-label" for="lg_${id}">${esc(label)}</label>` +
    `<input class="citui-input" id="lg_${id}" name="${id}" value="${esc(value ?? "")}" maxlength="200">` +
    (hint ? `<p class="citui-hint" style="margin:4px 0 0">${esc(hint)}</p>` : "") +
    `</div>`;

  const warning = legal.missing.length
    ? // adm-banner--warn is the admin's OWN warning banner. A first pass invented a
      // `citui-note--warn` that exists in no stylesheet, so the warning rendered as
      // plain text — caught by looking at the generated KB screenshot, not by tsc.
      `<div class="adm-banner adm-banner--warn" style="margin-bottom:14px">` +
      `<strong>${T(lang, "Hiányzó kötelező adat")}:</strong> ${esc(legal.missing.join(", "))}. ` +
      T(
        lang,
        "Ezek a sorok addig „— nincs megadva —” felirattal jelennek meg a honlapja impresszumában. Az elektronikus kereskedelemről szóló törvény kötelezővé teszi őket.",
      ) +
      `</div>`
    : "";

  return (
    `<div class="adm-card" id="jogi-adatok">` +
    `<div class="adm-card__head"><span class="adm-ico">${ic("doc")}</span>` +
    `<h2>${T(lang, "Jogi adatok")}</h2>${helpLink("admin.legal", lang)}</div>` +
    `<p class="adm-lead">${T(lang, "Ezek az adatok jelennek meg a honlapja Impresszum és Adatkezelési tájékoztató oldalán. A megrendeléskor megadott adatokból töltöttük ki előre — ha eltér, itt javíthatja.")}</p>` +
    warning +
    `<form method="POST" action="/admin/legal">` +
    field("legal_name", T(lang, "Név vagy cégnév"), legal.who.legalName) +
    field("address", T(lang, "Székhely (irányítószám, település, utca, házszám)"), legal.who.address) +
    field("tax_number", T(lang, "Adószám"), legal.who.taxNumber) +
    field(
      "reg_number",
      T(lang, "Nyilvántartási szám"),
      legal.who.regNumber,
      T(lang, "Cégjegyzékszám, vagy egyéni vállalkozói nyilvántartási szám."),
    ) +
    field(
      "ntak_id",
      T(lang, "Szálláshely-azonosító (NTAK)"),
      legal.who.ntakId,
      T(lang, "Nem kötelező az impresszumhoz, de a vendégek bizalmát erősíti."),
    ) +
    field("email", T(lang, "Közzétett e-mail cím"), legal.who.email) +
    field("phone", T(lang, "Közzétett telefonszám"), legal.who.phone) +
    // citui-btn WITHOUT a variant paints nothing (no background, no border): the
    // panel's save button rendered as bold text until the KB screenshot showed it.
    `<button class="citui-btn citui-btn--primary" type="submit">${T(lang, "Jogi adatok mentése")}</button>` +
    `</form>` +
    (legal.privacyUrl
      ? `<p class="citui-hint" style="margin-top:12px">` +
        `<a href="${esc(legal.privacyUrl)}" target="_blank" rel="noopener">${T(lang, "Adatkezelési tájékoztató megtekintése")}</a> · ` +
        `<a href="${esc(legal.imprintUrl ?? "")}" target="_blank" rel="noopener">${T(lang, "Impresszum megtekintése")}</a></p>`
      : "") +
    `</div>`
  );
}

function accountSection(session: TenantSession, lang = "hu"): string {
  return (
    `<div class="adm-card">` +
    `<div class="adm-card__head"><span class="adm-ico">${ic("account")}</span><h2>${T(lang, "Fiók")}</h2>${helpLink("admin.account", lang)}</div>` +
    `<div class="citui-field"><label class="citui-label">${T(lang, "Felhasználónév (belépéshez)")}</label>` +
    `<input class="citui-input" value="${esc(session.username)}" readonly style="background:var(--citui-surface-2)"></div>` +
    `<form method="POST" action="/admin/contact">` +
    `<div class="citui-field"><label class="citui-label" for="contact_email">${T(lang, "Kommunikációs e-mail (ide küldünk értesítést)")}</label>` +
    `<input class="citui-input" id="contact_email" name="contact_email" type="email" value="${esc(session.contactEmail)}" required></div>` +
    `<button class="citui-btn citui-btn--ghost" type="submit">${T(lang, "E-mail mentése")}</button>` +
    `</form>` +
    `<form method="POST" action="/admin/password" style="margin-top:18px;padding-top:18px;border-top:1px solid var(--citui-line)">` +
    `<h3 style="font-size:1rem;margin:0 0 10px;font-family:var(--citui-font-display)">${T(lang, "Jelszó módosítása")}</h3>` +
    `<div class="citui-field"><label class="citui-label" for="pw_current">${T(lang, "Jelenlegi jelszó")}</label>` +
    `<input class="citui-input" id="pw_current" name="current" type="password" autocomplete="current-password" required></div>` +
    `<div class="citui-field"><label class="citui-label" for="pw_next">${T(lang, "Új jelszó (min. 8 karakter)")}</label>` +
    `<input class="citui-input" id="pw_next" name="next" type="password" autocomplete="new-password" minlength="8" required></div>` +
    `<div class="citui-field"><label class="citui-label" for="pw_next2">${T(lang, "Új jelszó még egyszer")}</label>` +
    `<input class="citui-input" id="pw_next2" name="next2" type="password" autocomplete="new-password" minlength="8" required></div>` +
    `<button class="citui-btn citui-btn--ghost" type="submit">${T(lang, "Jelszó módosítása")}</button>` +
    `</form></div>`
  );
}

/** Searchable knowledge base surface (ADR-0045): topic list + one open guide.
 *  Pure view — the entries are loaded and filtered by the caller (public.ts). */
function helpSection(help: NonNullable<AdminOpts["help"]>, lang = "hu"): string {
  const search =
    `<form method="GET" action="/admin" class="adm-kb-search">` +
    `<input type="hidden" name="tab" value="sugo">` +
    `<input class="citui-input" type="search" name="q" value="${esc(help.query)}" ` +
    `placeholder="${T(lang, "Miben segíthetünk? (pl. fotó, jelszó)")}" aria-label="${T(lang, "Keresés a súgóban")}">` +
    `<button class="citui-btn citui-btn--primary" type="submit">${T(lang, "Keresés")}</button></form>`;
  const inner = help.open
    ? `<a class="adm-kb-back" href="/admin?tab=sugo">${T(lang, "← Minden téma")}</a>` +
      `<article class="adm-kb-article">` +
      `<h2 style="font-size:1.2rem;font-family:var(--citui-font-display);margin:10px 0 4px">${esc(help.open.title)}</h2>` +
      help.open.html +
      (help.open.updated ? `<p class="citui-hint">${T(lang, "Frissítve: {date}", { date: esc(help.open.updated) })}</p>` : "") +
      `</article>`
    : help.topics.length
      ? `<div class="adm-kb-list">` +
        help.topics
          .map(
            (t) =>
              `<a class="adm-kb-item" href="/admin?tab=sugo&topic=${encodeURIComponent(t.id)}">` +
              `<strong>${esc(t.title)}</strong><span class="citui-hint">${esc(t.snippet)}…</span></a>`,
          )
          .join("") +
        `</div>`
      : `<p class="citui-hint">${T(lang, "Nincs találat a keresésre. Próbálja meg más szóval körülírni, vagy írjon nekünk — a Fiók fülön megadott e-mailről válaszolunk a leggyorsabban.")}</p>`;
  return (
    `<div class="adm-card"><div class="adm-card__head"><span class="adm-ico">${ic("help")}</span><h2>${T(lang, "Súgó")}</h2></div>` +
    `<p class="adm-lead">${T(lang, "Lépésről lépésre útmutatók a kezelőfelület minden részéhez. Ugyanide jut a lapokon látható {icon} ikonokkal is.", { icon: ic("help", 14) })}</p>` +
    search +
    inner +
    `</div>`
  );
}

export interface AdminOpts {
  readonly saved?: boolean;
  /**
   * The pay-link for a module upsell could not be issued (0033). Shown because
   * the alternative is a silent no-op: the owner ticks a module, gets bounced
   * back, and sees it switched off with no explanation.
   */
  readonly payError?: boolean;
  readonly previewToken?: string | null;
  readonly modules?: TenantModuleView | null;
  /** ADR-0080: subscription card data for the Modulok tab (null → no card). */
  readonly subscription?: SubscriptionAdminData | null;
  /** ADR-0080: the applied-changes confirmation after POST /admin/modules. */
  readonly moduleApplied?: ModuleAppliedFlash | null;
  /** ADR-0094 ②: domain-commitment state for the danger zone (Modulok tab). */
  readonly domainSettle?: DomainSettleState | null;
  readonly supportEmail?: string;
  /** Active section id (TABS). */
  readonly tab?: string;
  /** Public URL of the live site, when published. */
  readonly siteUrl?: string | null;
  /** ADR-0044: pre-rendered settings screen for ONE module (?m=<id>), when open. */
  readonly moduleSettingsHtml?: string | null;
  /** ADR-0044/d: bookable units, so photos can be assigned to them on the Fotók tab. */
  readonly units?: readonly { id: string; name: string }[];
  /** ADR-0045: Súgó tab data — filtered topic list, the open entry (rendered), the query. */
  readonly help?: {
    readonly topics: readonly { id: string; title: string; snippet: string }[];
    readonly open: { title: string; html: string; updated: string } | null;
    readonly query: string;
  } | null;
  /** ADR-0063: the one-time multilang module's card data (Modulok tab). */
  readonly multilang?: MultilangAdminData | null;
  /** POST /admin/multilang validation error to show on the card. */
  readonly multilangError?: string | null;
  /** ADR-0078: a „Webcím" fül adata (jelenlegi cím, javaslatok, beszerzés-állapot). */
  readonly domain?: DomainAdminData | null;
  /** ADR-0078: melyik lépésnél tartunk a Webcím fülön (választott név / csekk-eredmény). */
  readonly domainView?: DomainViewState;
  /** ADR-0108: a „Forgalom" fül adata (látogatók, megkeresés, forrás-bontás). */
  readonly traffic?: TrafficReport | null;
  /** ADR-0084: a „Dokumentumok" fül adata (számlák + elfogadott nyilatkozatok). */
  readonly documents?: DocumentsAdminData | null;
  /** ADR-0110: a „Jogi adatok" panel adata (Fiók fül). */
  readonly legal?: LegalAdminData | null;
  /** ADR-0084: az „Üzenetek" fül adata (postaláda + szűrés). */
  readonly messages?: MessagesAdminData | null;
  /** ADR-0084: olvasatlan üzenetek száma — a fülsor jelvénye. */
  readonly unreadMessages?: number;
  /** Jóváhagyott terv 2026-09-06: a „Foglalások" fül adata. */
  readonly bookings?: BookingsTabData | null;
  /** Még nem látott foglalási kérések — a fülsor jelvénye. */
  readonly unseenBookings?: number;
}

export function adminDashboard(
  session: TenantSession,
  content: AdminContent,
  opts: AdminOpts = {},
): string {
  const {
    saved = false,
    payError = false,
    previewToken = null,
    modules: mv = null,
    supportEmail = "hello@citoviso.com",
    siteUrl = null,
  } = opts;
  // ADR-0067: the owner's own site language drives the WHOLE admin. Falls back to
  // Hungarian only when there is no site yet (nothing to derive it from).
  const lang = content?.lang ?? "hu";
  const tab = TABS().some((t) => t.id === opts.tab) ? opts.tab! : "attekintes";
  // ADR-0084: a Dokumentumok fül fejléce hosszabb, mint ami a navba fér.
  const tabLabel = tabHeading(tab, lang);
  const unread = opts.unreadMessages ?? 0;
  const statusLabel: Record<string, string> = {
    provisioned: T(lang, "Előnézet (még nem publikus)"),
    live: T(lang, "Élő (publikus)"),
    draft: T(lang, "Vázlat"),
    suspended: T(lang, "Felfüggesztve"),
    deactivated: T(lang, "Deaktiválva"),
  };
  const previewUrl = previewToken ? `/site/${previewToken}` : null;
  const sideBrand = LOGO.replace("citui-brand--ink", "").replace('fill="#16283f"', 'fill="#fff"');

  if (!content) {
    return shell(
      T(lang, "Admin"),
      ADM_STYLE +
        `<div class="adm-shell"><aside class="adm-side"><div class="adm-side__brand">${sideBrand}</div>` +
        `<nav class="adm-nav">${navItems(tab, lang, unread, opts.unseenBookings ?? 0)}</nav>` +
        `<div class="adm-side__foot"><span class="adm-side__user">${esc(session.username)}</span>` +
        `<a class="adm-side__out" href="/logout">${T(lang, "Kilépés")}</a></div></aside>` +
        `<main class="adm-main"><div class="adm-main__inner"><div class="adm-card">` +
        `<h1>${T(lang, "Üdv, {name}!", { name: esc(session.displayName) })}</h1>` +
        `<p class="citui-hint">${T(lang, "Ehhez a fiókhoz még nincs szerkeszthető oldal. Amint elkészül az oldalad, itt tudod majd szerkeszteni.")}</p>` +
        `</div></div></main></div>`,
      lang,
    );
  }

  // An ERROR must look like one — this used to ride the success-green .adm-saved
  // pill with a check icon (Elek FK-005b H4: "vásárlási zsákutca siker-zöldben").
  const savedNote = payError
    ? `<div class="adm-banner adm-banner--bad" role="alert">${ic("alert", 18)} ${T(lang, "A fizetési oldalt nem sikerült megnyitni, ezért az új modult NEM kapcsoltuk be — és nem is számoltunk fel érte semmit. Próbálja újra, vagy írjon nekünk.")}</div>`
    : saved
    ? `<div class="adm-saved">${ic("check", 18)} ${T(lang, "Mentve — az oldalad frissült.")}</div>`
    : "";
  const viewBtn = previewUrl
    ? `<a class="adm-viewbtn" href="${esc(siteUrl ?? previewUrl)}" target="_blank" rel="noopener">${ic("external", 16)} ${T(lang, "Oldal megtekintése")}</a>`
    : "";

  const section =
    tab === "sugo"
      ? helpSection(opts.help ?? { topics: [], open: null, query: "" }, lang)
      : tab === "szovegek"
      ? textsSection(content, lang)
      : tab === "fotok"
        ? photosCard(content, opts.units ?? [], lang)
        : tab === "modulok"
          ? // ADR-0044: ?m=<id> opens that module's own settings screen; without it
            // the tab is the on/off list. One screen = one decision.
            (opts.moduleSettingsHtml ??
              (mv
                ? modulesSection(
                    mv,
                    opts.subscription ?? null,
                    opts.moduleApplied ?? null,
                    supportEmail,
                    opts.domainSettle ?? null,
                    lang,
                  ) +
                  // ADR-0063: the one-time multilang module has its own card — it is
                  // NOT a free toggle, so it lives outside the toggle form.
                  (opts.multilang
                    ? (opts.multilangError
                        ? `<div class="adm-saved" role="alert">${ic("alert", 18)} ${esc(opts.multilangError)}</div>`
                        : "") + multilangSection(opts.multilang, lang)
                    : "")
                : `<div class="adm-card"><p class="citui-hint">${T(lang, "A modulok jelenleg nem érhetők el.")}</p></div>`))
          : tab === "webcim"
            ? // ADR-0078: a saját webcím fül. Adat nélkül (nincs site) őszinte üzenet —
              // sosem mutatunk félig működő vásárlási felületet.
              (opts.domain
                ? domainSection(opts.domain, opts.domainView ?? {}, lang)
                : `<div class="adm-card"><p class="citui-hint">${T(lang, "A saját webcím akkor rendelhető, ha a honlapja már elkészült.")}</p></div>`)
          : tab === "forgalom"
            ? // ADR-0108: adat nélkül is ÉRTELMES képernyő — a trafficSection maga
              // dönt az üres állapotról; itt csak a hiányzó lekérdezést fogjuk el.
              (opts.traffic
                ? trafficSection(opts.traffic, lang)
                : `<div class="adm-card"><p class="citui-hint">${T(lang, "A forgalmi adatok akkor jelennek meg, ha a honlapja már él.")}</p></div>`)
          : tab === "dokumentumok"
            ? // ADR-0084: számlák + elfogadott nyilatkozatok. Adat nélkül (nincs még
              // fizetés) őszinte üres állapot, nem félig működő lista.
              documentsSection(
                opts.documents ?? {
                  invoices: [],
                  agreements: [],
                  sub: "szamlak",
                  year: "mind",
                  q: "",
                  nextRenewal: null,
                },
                lang,
              )
          : tab === "foglalasok"
            ? // Jóváhagyott terv 2026-09-06: kérések + naptár + csempék egy felületen.
              (opts.bookings
                ? bookingsSection(opts.bookings, lang)
                : `<div class="adm-card"><p class="citui-hint">${T(lang, "A foglalások akkor jelennek meg itt, ha a Foglalás modul be van kapcsolva.")}</p></div>`)
          : tab === "uzenetek"
            ? messagesSection(
                opts.messages ?? {
                  messages: [],
                  unread: 0,
                  filter: "mind",
                  q: "",
                  openId: null,
                },
                lang,
              )
          : tab === "fiok"
            ? accountSection(session, lang) +
              (opts.legal ? legalSection(opts.legal, lang) : "")
            : overviewSection(
                content,
                statusLabel[content.status] ?? content.status,
                siteUrl,
                previewUrl,
                mv,
                lang,
              );

  return shell(
    T(lang, "Admin"),
    ADM_STYLE +
      `<div class="adm-shell">` +
      // Desktop sidebar
      `<aside class="adm-side"><div class="adm-side__brand">${sideBrand}</div>` +
      `<nav class="adm-nav">${navItems(tab, lang, unread, opts.unseenBookings ?? 0)}</nav>` +
      `<div class="adm-side__foot"><span class="adm-side__user">${esc(session.username)}</span>` +
      `<a class="adm-side__out" href="/logout">${T(lang, "Kilépés")}</a></div></aside>` +
      `<main class="adm-main">` +
      // Mobile top bar (brand + logout); the nav lives in the bottom bar on mobile
      `<div class="adm-topbar"><span class="adm-tb-brand">${sideBrand}</span><a href="/logout">${T(lang, "Kilépés")}</a></div>` +
      `<div class="adm-main__inner">` +
      `<div class="adm-pagehead"><h1>${esc(tabLabel)}</h1>${viewBtn}</div>` +
      `<p class="adm-sub">${esc(session.displayName)}</p>` +
      savedNote +
      section +
      `</div></main></div>` +
      (tab === "fotok" ? UPLOAD_SCRIPT(lang) : "") +
      // The photo cards (order/caption) and the module screens share one stylesheet.
      (tab === "modulok" || tab === "fotok" ? MODCFG_STYLE : "") +
      (tab === "webcim" ? DOMAIN_STYLE : "") +
      (tab === "forgalom" ? TRAFFIC_STYLE : ""),
    lang,
  );
}
