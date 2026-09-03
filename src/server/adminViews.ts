// Tenant admin views (ADR-0023) — styled with the design core (citui.css).
// Server-rendered HTML; Post/Redirect/Get for mutations. No framework (node:http).

import type { TenantSession } from "../auth/tenantAuth.js";
import { GROUP_LABELS, type ModuleGroup } from "../modules.js";
import type { PhotoEdit, TenantContentEdits } from "../tenant/editor.js";
import type { TenantModuleView } from "../tenant/modules.js";
import { MODCFG_STYLE, hasSettingsScreen } from "./moduleConfigViews.js";
import { domAnchorsOf } from "./modulePreview.js";
import type { DomainAdminData, DomainCheckResult } from "../domains/domainAdmin.js";
import type { SubscriptionAdminData } from "../tenant/subscriptionAdmin.js";
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
  lang = "hu",
): string {
  // Thousand-separated HUF; toLocaleString is unreliable without full ICU on the server.
  const huf = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} Ft`;
  const renewDate = sub?.periodEnd ?? "";
  const labelOf = (id: string) => mv.modules.find((m) => m.id === id)?.label ?? id;

  // ── subscription card ──
  let subCard = "";
  if (sub) {
    const banner =
      sub.status === "frozen"
        ? `<div class="adm-banner adm-banner--bad"><b>${T(lang, "A honlap fel van függesztve.")}</b> ` +
          `${T(lang, "Látogatói most egy „átmenetileg nem elérhető” oldalt látnak. A tartalom nem veszett el — fizetés után azonnal, automatikusan visszakapcsol.")}` +
          (sub.payUrl
            ? `<br><a class="citui-btn citui-btn--primary" href="${esc(sub.payUrl)}">${T(lang, "Díj rendezése és visszakapcsolás")}</a>`
            : "") +
          `</div>`
        : sub.status === "past_due"
          ? `<div class="adm-banner adm-banner--warn"><b>${T(lang, "Rendezetlen díj.")}</b> ` +
            `${T(lang, "A {date}-i számla még nincs kifizetve. Kérjük, rendezze, különben a honlapot fel kell függesztenünk.", { date: esc(renewDate) })}` +
            (sub.payUrl
              ? `<br><a class="citui-btn citui-btn--primary" href="${esc(sub.payUrl)}">${T(lang, "Díj rendezése")}</a>`
              : "") +
            `</div>`
          : "";
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
      ? `<div class="adm-mand">` +
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
      `<div class="adm-card">` +
      banner +
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
  if (applied && (applied.added.length || applied.cancelled.length || applied.other.length)) {
    const parts = [
      applied.added.length
        ? T(lang, "Mostantól él: {list} — első díjuk a {date}-i számlán jelenik meg.", {
            list: applied.added.map((id) => esc(T(lang, labelOf(id)))).join(", "),
            date: esc(renewDate),
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
    ` data-label="${esc(T(lang, m.label))}" aria-label="${esc(T(lang, m.label))}">`;

  const priceChip = (m: TenantModuleView["modules"][number], replacedBy: string | null): string =>
    replacedBy
      ? `<span class="adm-chip adm-chip--off">${T(lang, "nem számítjuk")}</span>`
      : m.spine
        ? `<span class="adm-chip adm-chip--free">${T(lang, "az árban")}</span>`
        : `<span class="adm-chip">${T(lang, "+{price}/hó", { price: esc(huf(m.priceMonthly)) })}</span>`;

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
      T(lang, "+{price}/hó", { price: esc(huf(discounted)) }) +
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
        `<a class="citui-btn citui-btn--ghost" data-pv="${esc(m.id)}" target="_blank" rel="noopener"` +
        ` href="${previewHref(m.id, committedIds)}">${eyeIcon}<span>${T(lang, "Megnézem")}</span></a>` +
        cfg +
        off +
        `</div>`
      );
    })
    .join("");

  const mineCard =
    `<section class="adm-card">` +
    `<div class="adm-card__head"><span class="adm-ico">${ic("check")}</span>` +
    `<h2>${T(lang, "Az én moduljaim")}</h2>${helpLink("admin.modules", lang)}</div>` +
    `<div class="adm-mine">${mineRows}</div></section>`;

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
            `<label class="citui-btn citui-btn--primary adm-shop__add">${cb(m, false)}` +
            `<span class="adm-when-off">${T(lang, "Hozzáadom")}</span>` +
            `<span class="adm-when-on">${T(lang, "Visszaveszem")}</span></label>` +
            `</div></div></article>`
          );
        })
        .join("");
      return `<div class="adm-modgroup">${esc(T(lang, GROUP_LABELS[g]))}</div><div class="adm-shop">${cards}</div>`;
    })
    .join("");

  const shopCard = shopBlocks
    ? `<section class="adm-card">` +
      `<div class="adm-card__head"><span class="adm-ico">${ic("plus")}</span>` +
      `<h2>${T(lang, "Bővítés — amit még hozzáadhat")}</h2>${helpLink("admin.modules", lang)}</div>` +
      `<p class="adm-lead">${T(lang, "Mindegyiket megnézheti a saját oldalán, mielőtt dönt — a kapcsolók itt még nem élesítenek.")}</p>` +
      (coupon
        ? `<div class="adm-coupon"><b>${T(lang, "−{p}% kupon", { p: String(coupon.percent) })}</b>` +
          `<span>` +
          T(lang, "Az induló előfizetéséért kapta. A következő vásárlásánál magától levonjuk{until}. Kedvezmények nem adódnak össze; mindig a nagyobb érvényesül.", {
            until: coupon.expiresAt ? T(lang, " — érvényes {date}-ig", { date: esc(coupon.expiresAt) }) : "",
          }) +
          `</span></div>`
        : "") +
      shopBlocks +
      `</section>`
    : "";

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
    `<span class="adm-planbar__sum">${T(lang, "Következő számla így:")} <b id="adm-plan-total"></b> <span id="adm-plan-delta"></span></span>` +
    `<span><button type="button" class="citui-btn citui-btn--ghost" id="adm-plan-reset">${T(lang, "Elvetem")}</button> ` +
    `<button class="citui-btn citui-btn--primary" type="submit">${T(lang, "Alkalmazom a módosításokat")}</button></span>` +
    `</div></div>` +
    `<noscript><div class="adm-total"><span></span><button class="citui-btn citui-btn--primary" type="submit">${T(lang, "Alkalmazom a módosításokat")}</button></div></noscript>`;

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
    `var mult=next?(+next.dataset.mult||1):1;var next0=next?next.innerHTML:"";` +
    `var HUF=function(n){return String(Math.round(n)).replace(/\\B(?=(\\d{3})+(?!\\d))/g,"\\u00a0")+"\\u00a0Ft"};` +
    `var cbs=[].slice.call(f.querySelectorAll('input[name="module"][data-committed]'));` +
    `function sync(){var add=[],rem=[],delta=0;cbs.forEach(function(c){` +
    `var was=c.dataset.committed==="1",is=c.checked,p=+c.dataset.price;` +
    `var row=c.closest("[data-modrow]");if(row)row.classList.toggle("is-dirty",was!==is);` +
    `if(is&&!was){add.push(c);delta+=p}if(!is&&was){rem.push(c);delta-=p}});` +
    `bar.classList.toggle("show",add.length+rem.length>0);` +
    `rows.innerHTML=add.map(function(c){return '<div class="adm-planbar__row"><span><span class="adm-planbar__tag adm-planbar__tag--add">+ ${T(lang, "bekapcsol")}</span> · '+c.dataset.label+'</span><span>${T(lang, "azonnal élne — első díj: {date}", { date: esc(renewDate) })}</span></div>'}).join("")+` +
    `rem.map(function(c){return '<div class="adm-planbar__row"><span><span class="adm-planbar__tag adm-planbar__tag--del">− ${T(lang, "lemond")}</span> · '+c.dataset.label+'</span><span>${T(lang, "{date}-ig aktív maradna", { date: esc(renewDate) })}</span></div>'}).join("");` +
    `if(tot)tot.textContent=HUF(base+delta*mult);` +
    `if(del){del.textContent=delta?"("+(delta>0?"+":"−")+HUF(Math.abs(delta*mult))+" ${T(lang, "a mostanihoz képest")}"+")":"";` +
    `del.className=delta>0?"adm-planbar__delta--up":"adm-planbar__delta--down"}` +
    `if(next)next.innerHTML=delta?HUF(base+delta*mult):next0;` +
    `if(window.__citPvSync)window.__citPvSync();}` +
    `cbs.forEach(function(c){c.addEventListener("change",sync)});` +
    `var rst=document.getElementById("adm-plan-reset");if(rst)rst.addEventListener("click",function(){` +
    `cbs.forEach(function(c){c.checked=c.dataset.committed==="1"});sync()});` +
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
    `function paint(){var t=total();` +
    `if(focus&&!OWNED[focus]){var c=cbOf(focus),on=c&&c.checked;` +
    `foot.innerHTML='<span class="adm-chip">+'+HUF(PRICE[focus])+'/${T(lang, "hó")}</span>'+` +
    `'<button type="button" class="citui-btn citui-btn--ghost" data-pvx="1">${T(lang, "Bezárom")}</button>'+` +
    `'<button type="button" class="citui-btn '+(on?"citui-btn--ghost":"citui-btn--primary")+'" data-pvadd="'+focus+'">'+` +
    `(on?'${T(lang, "Visszaveszem")}':'${T(lang, "Hozzáadom")}')+'</button>'}` +
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
  let danger = "";
  if (sub) {
    danger = sub.cancelAtPeriodEnd
      ? `<div class="adm-danger"><h3>${T(lang, "Előfizetés lemondása")}</h3>` +
        `<div class="adm-danger__done">${T(lang, "Előfizetése {date}-án zárul. Addig minden változatlanul él.", { date: esc(renewDate) })} ` +
        `<button class="citui-btn citui-btn--ghost" form="adm-sub-resume" type="submit">${T(lang, "Meggondoltam magam — folytatom")}</button></div></div>`
      : `<div class="adm-danger"><h3>${T(lang, "Előfizetés lemondása")}</h3>` +
        `<p class="citui-hint" style="margin:0">${T(lang, "A honlap a már kifizetett időszak végéig ({date}) elérhető marad, utána lekerül.", { date: esc(renewDate) })}</p>` +
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
    // ADR-0080 ② (B-opció): say what the switches DO before the click — no payment
    // redirect, live at once, first fee on the next invoice; cancels honour the
    // paid period. §I: the button must never surprise.
    `<p class="adm-lead">${T(lang, "Ami már az Öné, azt fent találja; amit még hozzáadhat, azt alább — és mindegyiket meg is nézheti a saját oldalán, mielőtt dönt. A kapcsolók itt még nem élesítenek: a lap alján összegyűjtjük, mi változna és mennyivel módosul a díja, és az „Alkalmazom a módosításokat” gombbal egyszerre érvényesíti. Amit bekapcsol, azonnal megjelenik az oldalán — első díja a következő számlán lesz. Amit lemond, a már kifizetett időszak végéig aktív marad.")}</p>` +
    appliedBox +
    blocks +
    planBar +
    `<p class="citui-hint" style="margin-top:14px">${T(lang, "Kérdésed van a csomagról? Írj:")} <a href="mailto:${esc(contactEmail)}">${esc(contactEmail)}</a></p>` +
    `</form>` +
    danger +
    dangerForms +
    previewOverlay +
    js
  );
}

/** ADR-0063 „Többnyelvű honlap" — the multilang card's view data (public.ts assembles). */
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
  /** A paid generation is currently running (webhook fired, work in progress). */
  readonly generating: boolean;
  /** The latest generation failed with this error (operator-fixable). */
  readonly failedError: string | null;
  /** Live links of the served language versions (only when the site is live). */
  readonly langUrls: readonly { lang: string; url: string }[];
}

/**
 * ADR-0063: one-time paid module — NOT a toggle in the module list (toggling is
 * free there); its own card owns the whole lifecycle: pick 3 languages → pay →
 * generated; content change → stale banner → pay again; swap = new set + pay.
 */
function multilangSection(ml: MultilangAdminData, lang = "hu"): string {
  const huf = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} Ft`;
  const checked = new Set(ml.state?.languages ?? []);
  const picker = ml.options
    .map(
      (o) =>
        `<label class="adm-mlang"><input type="checkbox" name="lang" value="${esc(o.code)}"` +
        `${checked.has(o.code) ? " checked" : ""}> <span>${esc(o.name)}</span></label>`,
    )
    .join("");
  // A warning must not wear the success-green "saved" coat — warn tone, token-only.
  const warnBox =
    `style="background:color-mix(in srgb, var(--citui-warn) 12%, transparent);` +
    `color:var(--citui-warn)"`;
  const statusBlock = ml.generating
    ? `<div class="adm-saved">${ic("check", 18)} ${T(lang, "A fordítás készül — pár percen belül elkészül, és az oldalad nyelvi változatai maguktól megjelennek.")}</div>`
    : ml.failedError
      ? `<div class="adm-saved" role="alert" ${warnBox}>${ic("alert", 18)} ${T(lang, "A legutóbbi generálás nem sikerült — a díjat nem veszítetted el, csapatunk újraindítja. Ha sürgős, írj nekünk.")}</div>`
      : ml.state
        ? ml.state.status === "stale"
          ? `<div class="adm-saved" role="alert" ${warnBox}>${ic("alert", 18)} <strong>${T(lang, "A fordítások elavultak.")}</strong> ${T(lang, "Módosítottad az oldalad szövegeit, ezért a nyelvi változatok ({langs}) még a korábbi tartalmat mutatják. Az újrageneráláshoz újra ki kell fizetni a generálás díját.", { langs: esc(ml.state.langNames.join(", ")) })}</div>`
          : `<div class="adm-saved">${ic("check", 18)} ${T(lang, "A nyelvi változatok naprakészek: {langs} (generálva: {date}).", { langs: esc(ml.state.langNames.join(", ")), date: esc(ml.state.generatedAt) })}</div>`
        : "";
  const links = ml.langUrls.length
    ? `<p class="citui-hint">${T(lang, "Nyelvi változatok:")} ` +
      ml.langUrls
        .map((u) => `<a href="${esc(u.url)}" target="_blank" rel="noopener">${esc(u.lang.toUpperCase())}</a>`)
        .join(" · ") +
      `</p>`
    : "";
  const btnLabel = ml.state
    ? T(lang, "Újragenerálás fizetéssel ({price})", { price: esc(huf(ml.price)) })
    : T(lang, "Fizetés és generálás ({price})", { price: esc(huf(ml.price)) });
  return (
    `<form method="POST" action="/admin/multilang" class="adm-card" id="tobbnyelvu">` +
    `<div class="adm-card__head"><span class="adm-ico">${ic("modules")}</span><h2>${T(lang, "Többnyelvű honlap")}</h2>${helpLink("admin.multilang", lang)}</div>` +
    `<p class="adm-lead">${T(lang, "Az oldalad {count} választott nyelven is elérhető lesz — a beírt szövegeid és a teljes felület lefordítva, egyszeri díjért. Ha később módosítod a szövegeidet, a fordítások nem frissülnek maguktól: az újragenerálás újra ennyibe kerül. A nyelveket ilyenkor cserélheted is.", { count: ml.count })}</p>` +
    statusBlock +
    links +
    `<p class="citui-hint" style="color:var(--citui-warn)"><strong>${T(lang, "Fontos:")}</strong> ${T(lang, "a fordítás a most elmentett tartalmadból készül. Mielőtt fizetsz, nézd át és mentsd el a szövegeidet (Szövegek, Modulok) — azt fordítjuk le, ami el van mentve.")}</p>` +
    `<p style="margin:8px 0 4px"><strong>${T(lang, "Válassz pontosan {count} nyelvet", { count: ml.count })}</strong> ` +
    `<span class="citui-hint">${T(lang, "(az oldalad saját nyelve — {name} — nem számít bele):", { name: esc(ml.primaryLangName) })}</span></p>` +
    `<div class="adm-mlang-grid">${picker}</div>` +
    `<div class="adm-total"><span><span class="citui-hint" style="margin:0">${T(lang, "Egyszeri díj")}</span><br>` +
    `<b>${esc(huf(ml.price))}</b> <span class="citui-hint" style="margin:0">${T(lang, "/ generálás")}</span></span>` +
    `<button class="citui-btn citui-btn--primary" type="submit">${btnLabel}</button></div>` +
    `</form>` +
    // Progressive enhancement: cap the picker at `count` — the server validates anyway.
    `<script>(function(){var f=document.getElementById("tobbnyelvu");if(!f)return;` +
    `var cbs=[].slice.call(f.querySelectorAll('input[name="lang"]'));function sync(){` +
    `var n=cbs.filter(function(c){return c.checked}).length;` +
    `cbs.forEach(function(c){c.disabled=!c.checked&&n>=${ml.count}});}` +
    `cbs.forEach(function(c){c.addEventListener("change",sync)});sync();})();</script>` +
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

function domainSection(d: DomainAdminData, st: DomainViewState, lang = "hu"): string {
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
      `<dt>${T(lang, "Domain díja (1 év)")}</dt><dd>${
        d.priceYearly === 0
          ? // ADR-0093: waived from the operator-set package threshold.
            `${esc(money(0, d.currency))} — ${T(lang, "a csomagjában benne van")}`
          : esc(money(d.priceYearly, d.currency))
      }</dd>` +
      `<dt>${T(lang, "Előfizetés vállalása")}</dt><dd>${T(lang, "{n} hónap", { n: d.commitmentMonths })}</dd>` +
      `<dt class="adm-dtotal"><strong>${T(lang, "Most fizetendő")}</strong></dt>` +
      `<dd class="adm-dtotal">${esc(money(d.priceYearly, d.currency))}</dd></dl>` +
      (d.currentHost
        ? `<p class="citui-hint" style="margin:11px 0 0">${T(lang, "A saját nevet mi vásároljuk meg és tartjuk karban. A régi cím ({host}) nem szűnik meg: automatikusan az újra irányít, így a korábbi hivatkozások is működnek tovább.", { host: esc(d.currentHost) })}</p>`
        : "") +
      `</div>` +
      mockNote +
      `<button class="citui-btn citui-btn--primary" type="submit" style="width:100%">` +
      // ADR-0093: a waived (0 Ft) order skips the gateway — the button must not
      // promise a payment step that will not happen (§B.17 on ourselves).
      `${d.priceYearly === 0 ? T(lang, "Megrendelés") : T(lang, "Fizetés és megrendelés")}</button>` +
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
      d.priceYearly === 0
        ? // ADR-0093: waived fee — say so instead of a confusing "0 Ft yearly fee".
          T(lang, "A név éves díja az Ön csomagjában benne van (külön díj nincs); a megrendelés {n} hónapos előfizetés vállalásával jár.", { n: d.commitmentMonths })
        : T(lang, "A név éves díja {price}, és {n} hónapos előfizetés vállalásával jár.", { price: esc(money(d.priceYearly, d.currency)), n: d.commitmentMonths })
    }</p>` +
    mockNote +
    `</div>`
  );
}

/** A „Webcím" fül saját stílusa — minden szín a dizájn-magból (ADR-0021 ①). */
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
  // ADR-0078: a saját webcím önálló fül — a fizetési döntés külön képernyőt kap.
  { id: "webcim", label: T(lang, "Webcím"), icon: "domain" },
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
function navItems(active: string, lang = "hu", unread = 0): string {
  return TABS(lang)
    .map((t) => {
      const badge =
        t.id === "uzenetek" && unread > 0
          ? `<span class="adm-nav__bdg" aria-label="${esc(T(lang, "{n} olvasatlan üzenet", { n: unread }))}">${unread > 99 ? "99+" : unread}</span>`
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
  const activeCount = mv ? mv.modules.filter((m) => m.active).length : 0;
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
    `<div class="adm-stat"><b>${T(lang, "{n} db", { n: activeCount })}</b><span>${T(lang, "Aktív modul ·")} <a href="/admin?tab=modulok">${T(lang, "kezelés")}</a></span></div>` +
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
        `<span class="adm-msg__d">${esc(fmtDate(x.sentAt, lang))}</span>` +
        `</a>` +
        (open
          ? `<div class="adm-msg__body"><p>${esc(x.bodyText)}</p>` +
            `<div class="adm-msg__meta">` +
            (x.channel === "sms" ? T(lang, "SMS") : T(lang, "E-mail")) +
            ` · ${esc(x.recipient)} · ${esc(fmtDate(x.sentAt, lang))}` +
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
  /** ADR-0084: a „Dokumentumok" fül adata (számlák + elfogadott nyilatkozatok). */
  readonly documents?: DocumentsAdminData | null;
  /** ADR-0084: az „Üzenetek" fül adata (postaláda + szűrés). */
  readonly messages?: MessagesAdminData | null;
  /** ADR-0084: olvasatlan üzenetek száma — a fülsor jelvénye. */
  readonly unreadMessages?: number;
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
        `<nav class="adm-nav">${navItems(tab, lang, unread)}</nav>` +
        `<div class="adm-side__foot"><span class="adm-side__user">${esc(session.username)}</span>` +
        `<a class="adm-side__out" href="/logout">${T(lang, "Kilépés")}</a></div></aside>` +
        `<main class="adm-main"><div class="adm-main__inner"><div class="adm-card">` +
        `<h1>${T(lang, "Üdv, {name}!", { name: esc(session.displayName) })}</h1>` +
        `<p class="citui-hint">${T(lang, "Ehhez a fiókhoz még nincs szerkeszthető oldal. Amint elkészül az oldalad, itt tudod majd szerkeszteni.")}</p>` +
        `</div></div></main></div>`,
      lang,
    );
  }

  const savedNote = payError
    ? `<div class="adm-saved" role="alert">${ic("check", 18)} ${T(lang, "A fizetési oldalt nem sikerült megnyitni, ezért az új modult NEM kapcsoltuk be — és nem is számoltunk fel érte semmit. Próbáld újra, vagy írj nekünk.")}</div>`
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
            ? accountSection(session, lang)
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
      `<nav class="adm-nav">${navItems(tab, lang, unread)}</nav>` +
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
      (tab === "webcim" ? DOMAIN_STYLE : ""),
    lang,
  );
}
