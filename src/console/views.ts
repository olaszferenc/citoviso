// Operator console — server-rendered HTML (hand-rolled template literals, the
// same approach as the mock render.ts). No framework, no emoji icons (design
// doctrine). Every dynamic value goes through esc().

import type {
  ArtifactView,
  ConversionView,
  LeadDetail,
  LeadListRow,
  LeadQuery,
  OrderIntentView,
  PaymentView,
  ProspectView,
  TenantAdminView,
} from "./data.js";
import type { ContactCandidate, PortalListing } from "../scraper/types.js";

/** Cache-busting asset version: stamped at module load, so every deploy+restart
 *  serves fresh CSS/JS through the CDN without needing a cache purge. */
const ASSET_V = String(Date.now());

/** HUF formatter (thin-space grouping) for the operator views. */
function fmtHuf(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " Ft";
}

// Module catalog (05-MODULES.md) offered at conversion. Single-sourced in
// ../modules.js so the operator convert form and the prospect configurator
// never drift on module ids (they feed module_entitlement).
export { MODULE_CATALOG } from "../modules.js";
import { TEMPLATES } from "../engine/templates.js";
import { groupAmenities } from "../generator/marketCheck.js";
import { MODULE_CATALOG, GROUP_LABELS, modulesForConversion } from "../modules.js";
import type { PricingSnapshot } from "../pricing.js";
import { ic } from "../ui/icons.js";
// ADR-0067 ③: the internal console is a HUMAN surface too — prepared for a
// non-Hungarian colleague. `lang` comes from the request context (i18nCtx).
import { T } from "../i18n/mail.js";
import { supportedLangs } from "../i18n/lang.js";
import { consoleLang } from "./i18nCtx.js";
import { PRIVACY_CUSTOMER_V1 } from "../legal.js";

export function esc(s: unknown): string {
  const lang = consoleLang();
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Text → body of a single-quoted JS string literal for an inline handler. The
 * attribute itself still goes through esc(); the browser decodes the entities
 * before the JS is parsed, so only the JS-level metacharacters matter here.
 * Needed because translated labels may contain an apostrophe, which would
 * silently end the literal and kill the handler.
 */
export function jsStr(s: string): string {
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, "\\n");
}

// ALL console styling comes from the central design core (ADR-0021 ①):
// citui.css (tokens + components) + citui-console.css (the internal-app layer,
// token-driven). NO inline stylesheet here — change the core, the console follows.

/** Brand block (same mark as the tenant admin / public site — one identity). */
const BRAND =
  `<a class="citui-brand citui-brand--ink" href="/">` +
  `<svg class="citui-brand__mark" viewBox="0 0 48 48" aria-hidden="true">` +
  `<path d="M34.5 10.5A17 17 0 1 0 34.5 37.5" fill="none" stroke="#1fb6d6" stroke-width="6" stroke-linecap="round"/>` +
  `<circle cx="22.5" cy="24" r="4.5" fill="#16283f"/><path d="M34 18.5 42 24l-8 5.5z" fill="#1fb6d6"/></svg>` +
  `<span>Citoviso</span></a>`;

/** Slim MODULE-level top bar (owner decree, 2026-08-23: never a flat list of
 *  every function — the hub's cards carry the submenus). `match` maps a page's
 *  legacy `active` href onto its module for highlighting. */
// A FUNCTION of the reader's language (ADR-0067 ③): the labels are translated at
// RENDER time, and the T() calls keep LITERAL source strings so the catalog
// extractor can still see them. `match` is routing, not text — never translated.
const MENU = (
  lang = "hu",
): ReadonlyArray<{ href: string; label: string; icon: string; match: string[] }> => [
  { href: "/", label: T(lang, "Irányítópult"), icon: "overview", match: ["/"] },
  { href: "/leads", label: T(lang, "CRM"), icon: "leads", match: ["/leads", "/lead/", "/scrape", "/duplicates"] },
  { href: "/documents", label: T(lang, "Pénzügy"), icon: "pricing", match: ["/documents", "/partner", "/pricing", "/accounting-document"] },
  { href: "/report", label: T(lang, "Riport"), icon: "report", match: ["/report"] },
  { href: "/settings", label: T(lang, "Beállítások"), icon: "settings", match: ["/settings"] },
];

/** ADR-0045/e §J: contextual help on a screen header. The data-kb-anchor is the
 *  coverage hook (kb-check --coverage, operator group): a screen carrying it MUST
 *  have an audience:operator KB entry. */
function helpLink(anchor: string): string {
  const lang = consoleLang();
  return (
    `<a class="con-help" data-kb-anchor="${anchor}" href="/help?topic=${encodeURIComponent(anchor)}" ` +
    `title="${esc(T(lang, "Súgó ehhez a képernyőhöz"))}">${ic("help", 16)}</a>`
  );
}

/** Which module a page's `active` href belongs to (prefix match; "/" exact). */
function activeModule(active: string | undefined): string | null {
  if (!active) return null;
  if (active === "/") return "/";
  for (const m of MENU()) {
    if (m.href === "/") continue;
    if (m.match.some((p) => active === p || active.startsWith(p))) return m.href;
  }
  return null;
}

export interface LayoutOpts {
  /** Menü-kiemelés: az aktív menüpont href-je. */
  readonly active?: string;
  /** false → prospect/tenant-facing page: brand only, NO internal menu. */
  readonly chrome?: boolean;
  /** Extra markup injected into <head> (e.g. a map library's stylesheet). */
  readonly head?: string;
}

/**
 * ADR-0067 ③ — the operator's OWN language switcher, in the header beside
 * "Kilépés". A plain form with an auto-submitting select; the no-JS path keeps a
 * visible button, because an operator on a locked-down machine must not be stuck
 * in a language they cannot read. The choice is stored on the ACCOUNT (0037), so
 * it follows the person to any browser.
 */
function langSwitcher(lang: string): string {
  const options = supportedLangs()
    .map(
      (l) => `<option value="${l}"${l === lang ? " selected" : ""}>${esc(l.toUpperCase())}</option>`,
    )
    .join("");
  return (
    `<form class="con-lang" method="POST" action="/operator/lang" style="display:inline-flex;gap:4px;align-items:center">` +
    // Tokens only (ADR-0021 ①). The header is dark, so the control takes the
    // inverse ink and a hairline of the same colour — legible without shouting,
    // and it never competes with "Kilépés" beside it.
    `<select name="lang" aria-label="${esc(T(lang, "A konzol nyelve"))}" onchange="this.form.submit()" ` +
    `style="background:color-mix(in srgb, var(--citui-ink-inverse) 12%, transparent);` +
    `color:var(--citui-ink-inverse);border:1px solid color-mix(in srgb, var(--citui-ink-inverse) 35%, transparent);` +
    `border-radius:var(--citui-radius-sm);font:inherit;font-size:.82rem;padding:3px 6px">${options}</select>` +
    `<noscript><button type="submit">${esc(T(lang, "Vált"))}</button></noscript>` +
    `</form>`
  );
}

export function layout(title: string, body: string, opts: LayoutOpts = {}): string {
  // ADR-0067 ③: the request's language, from the operator's account. One line per
  // view function instead of a parameter threaded through ~53 signatures.
  const lang = consoleLang();
  const chrome = opts.chrome !== false;
  const mod = activeModule(opts.active);
  const nav = chrome
    ? `<nav class="con-nav">${MENU(lang)
        .map(
          (m) =>
            `<a href="${m.href}"${m.href === mod ? ` class="active"` : ""}>${ic(m.icon, 17)}${esc(m.label)}</a>`,
        )
        .join("")}</nav>
       <div class="con-user">${langSwitcher(lang)}<a href="/logout">${T(lang, "Kilépés")}</a></div>`
    : "";
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — ${T(lang, "Citoviso konzol")}</title>
<link rel="stylesheet" href="/assets/ui/citui.css?v=${ASSET_V}">
<link rel="stylesheet" href="/assets/ui/citui-console.css?v=${ASSET_V}">
<link rel="stylesheet" href="/assets/ui/citui-console-table.css?v=${ASSET_V}">${opts.head ?? ""}</head>
<body class="con"><header class="con-top">${BRAND}${nav}</header>
<main class="con-main">${body}</main></body></html>`;
}

/**
 * Sub-tabs of the Scrape workflow. The launcher, the coverage map and the area
 * editor are three views of ONE job (where do we hunt, what did we find), so they
 * share a section instead of each taking a top-level menu slot.
 */
// A FUNCTION of the language (ADR-0067 ③): labels translate at RENDER time while
// the T() literals stay visible to the catalog extractor.
const SCRAPE_TABS = (lang = "hu"): ReadonlyArray<{ href: string; label: string }> => [
  { href: "/scrape", label: T(lang, "Indítás") },
  { href: "/scrape/map", label: T(lang, "Térkép") },
  { href: "/scrape/regions", label: T(lang, "Területek") },
];

export function scrapeTabs(active: string): string {
  const lang = consoleLang();
  return `<nav class="con-tabs">${SCRAPE_TABS(lang).map(
    (t) => `<a href="${t.href}"${t.href === active ? ' class="active"' : ""}>${esc(t.label)}</a>`,
  ).join("")}</nav>`;
}

/** Small inline password-visibility toggle (no dependency, no-JS safe). */
const PW_TOGGLE_JS = (lang = "hu"): string =>
  `<script>function citPwT(id,btn){var i=document.getElementById(id);` +
  `var show=i.type==='password';i.type=show?'text':'password';btn.textContent=show?'${T(lang, "elrejt")}':'${T(lang, "mutat")}';}</script>`;

/** Operator login page (control-plane realm — works on the public internet). */
export function operatorLoginPage(error: string | null = null, publicLoginUrl = ""): string {
  const lang = consoleLang();
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${T(lang, "Belépés — Citoviso konzol")}</title>
<link rel="stylesheet" href="/assets/ui/citui.css?v=${ASSET_V}">
<link rel="stylesheet" href="/assets/ui/citui-console.css?v=${ASSET_V}">${PW_TOGGLE_JS(lang)}</head>
<body class="con"><div class="con-login"><div class="box">
${BRAND}
<h1>${T(lang, "Belső konzol — munkatársi belépés")}</h1>
<form method="post" action="/login" style="display:block">
  <label for="u">${T(lang, "Felhasználónév")}</label>
  <input id="u" name="username" autocomplete="username" autocapitalize="none" autocorrect="off" autofocus required>
  <label for="p">${T(lang, "Jelszó")}</label>
  <div style="display:flex;gap:8px;align-items:center">
    <input id="p" name="password" type="password" autocomplete="current-password" required style="flex:1">
    <button type="button" onclick="citPwT('p',this)" style="width:auto;margin:0;padding:8px 12px;background:var(--citui-white);border-color:var(--citui-line-strong);color:var(--citui-muted)">${T(lang, "mutat")}</button>
  </div>
  <button type="submit">${T(lang, "Belépés")}</button>
</form>
${error ? `<p class="err">${esc(error)}</p>` : ""}
<p style="margin:16px 0 0;font-size:0.85rem;color:var(--citui-muted)">
  <a href="/login/help">${T(lang, "Elfelejtett jelszó?")}</a>
  ${publicLoginUrl ? ` · <a href="${esc(publicLoginUrl)}">${T(lang, "Ügyfél-belépést keresel? ▸")}</a>` : ""}
</p>
</div></div></body></html>`;
}

/** Operator password-recovery help (no live e-mail infra yet — honest path). */
export function operatorLoginHelpPage(publicLoginUrl = ""): string {
  const lang = consoleLang();
  const body = `
    <div class="panel" style="max-width:560px;margin:40px auto">
      <h2>${T(lang, "Elfelejtett operátor-jelszó")}</h2>
      <p>${T(lang, "A belső fiókok jelszavát a szerveren lehet visszaállítani (új, megjegyezhető jelszót generál és kiírja):")}</p>
      <pre>${T(lang, "npx tsx scripts/operator-user.ts &lt;felhasználónév&gt;")}</pre>
      <p class="mut small">${T(lang, "Ugyanez a parancs hoz létre új munkatársi fiókot is. Önkiszolgáló e-mailes visszaállítás a küldő-domain élesítése után lesz.")}</p>
      <p class="mut small">${T(lang, "Belépett állapotban a jelszó a")} <strong>${T(lang, "Beállítások")}</strong> ${T(lang, "menüben cserélhető.")}</p>
      <p style="margin-top:14px"><a href="/login">${T(lang, "← Vissza a belépéshez")}</a>
        ${publicLoginUrl ? ` · <a href="${esc(publicLoginUrl)}">${T(lang, "Ügyfél-belépés ▸")}</a>` : ""}</p>
    </div>`;
  return layout(T(lang, "Elfelejtett jelszó"), body, { chrome: false });
}

/** Operator settings: account info + password change. */
export function settingsPage(
  op: { username: string; displayName: string; role: string },
  notice: { ok: boolean; text: string } | null = null,
): string {
  const lang = consoleLang();
  const body = `
    <div class="panel" style="max-width:560px">
      <h2>${T(lang, "Fiók")} ${helpLink("console.settings")}</h2>
      <dl class="kv">
        <dt>${T(lang, "Név")}</dt><dd>${esc(op.displayName)}</dd>
        <dt>${T(lang, "Felhasználónév")}</dt><dd><code>${esc(op.username)}</code></dd>
        <dt>${T(lang, "Szerepkör")}</dt><dd>${esc(op.role)}</dd>
      </dl>
    </div>
    <div class="panel" style="max-width:560px">
      <h2>${T(lang, "Jelszó módosítása")}</h2>
      ${notice ? `<div class="row" style="margin:0 0 10px"><span class="pill ${notice.ok ? "approved" : "rejected"}">${esc(notice.text)}</span></div>` : ""}
      <form method="post" action="/settings/password" style="display:block;max-width:340px">
        <label class="small mut" for="cur">${T(lang, "Jelenlegi jelszó")}</label>
        <input id="cur" name="current" type="password" autocomplete="current-password" required style="width:100%;margin:4px 0 10px">
        <label class="small mut" for="n1">${T(lang, "Új jelszó (min. 8 karakter)")}</label>
        <input id="n1" name="next" type="password" autocomplete="new-password" minlength="8" required style="width:100%;margin:4px 0 10px">
        <label class="small mut" for="n2">${T(lang, "Új jelszó még egyszer")}</label>
        <input id="n2" name="next2" type="password" autocomplete="new-password" minlength="8" required style="width:100%;margin:4px 0 12px">
        <button type="submit">${T(lang, "Jelszó mentése")}</button>
      </form>
    </div>`;
  return layout(T(lang, "Beállítások"), body, { active: "/settings" });
}

/** Operator-editable pricing admin (PILOT.md §7d ②). The owner sets the real
 *  prices here and flips the "confirmed" gate that unlocks price-advertising
 *  outreach (§C). Region-keyed (0020): a switcher picks the market (HU=HUF,
 *  Globális=EUR); the homepage shows the visitor's region price, else 'global'.
 *  Grouped by the same prospect-facing groups as the configurator. */
export function pricingPage(
  snap: PricingSnapshot,
  regions: PricingSnapshot[],
  notice: { ok: boolean; text: string } | null = null,
): string {
  const lang = consoleLang();
  // Currency unit for the selected region (module add-ons stay global HUF).
  const unit = snap.currency === "HUF" ? "Ft" : snap.currency === "EUR" ? "€" : snap.currency;
  const regionLabel = (r: string): string =>
    r === "hu" ? T(lang, "Magyarország") : r === "global" ? T(lang, "Globális (fallback)") : r;

  /**
   * One priced field: label ABOVE, unit inside the field row. The page used to
   * be a two-column `table.kv`, whose narrow first column broke every label
   * across three lines ("Alapdíj (a gerinccel együtt)") while the right half of
   * the card stayed empty — the same defect the lead page already fixed with
   * `.con-edit-grid` (see the CSS note next to it).
   */
  const priceField = (name: string, label: string, value: number, suffix: string): string =>
    `<div class="pr-field">
      <label class="pr-field__l" for="pr-${esc(name)}">${esc(label)}</label>
      <div class="pr-input">
        <input id="pr-${esc(name)}" name="${esc(name)}" type="number" min="0" step="1"
          inputmode="numeric" value="${esc(value)}">
        <span class="pr-input__u">${esc(suffix)}</span>
      </div>
    </div>`;

  /** A priced-looking cell with no price — keeps the grid rhythm (see .pr-static). */
  const staticField = (label: string, text: string): string =>
    `<div class="pr-field">
      <span class="pr-field__l">${esc(label)}</span>
      <div class="pr-static">${esc(text)}</div>
    </div>`;

  // Region switcher — each links to /pricing?region=<id>; the active one is a pill.
  const switcher = regions
    .map((r) => {
      const active = r.region === snap.region;
      const label = `${esc(regionLabel(r.region))} <span class="mut small">(${esc(r.currency)})</span>`;
      return active
        ? `<span class="pill approved">${label}</span>`
        : `<a href="/pricing?region=${encodeURIComponent(r.region)}" class="pill">${label}</a>`;
    })
    .join(" ");

  // Grouped grid instead of a 13-row single-column table: the module list is the
  // bulk of this page, and stacked one per row it ran off the screen while two
  // thirds of the card stayed blank.
  const groupBlocks = (Object.keys(GROUP_LABELS) as (keyof typeof GROUP_LABELS)[])
    .map((g) => {
      const mods = MODULE_CATALOG.filter((m) => m.group === g);
      if (!mods.length) return "";
      const cells = mods
        .map((m) => {
          if (m.spine) return staticField(m.label, T(lang, "gerinc — az alapdíjban"));
          const price = snap.modulePrices.get(m.id) ?? 0;
          // ADR-0063: a 'once'-billed module's price is a per-purchase fee, not monthly.
          return priceField(`m_${m.id}`, m.label, price, m.billing === "once" ? "Ft / alkalom" : T(lang, "Ft / hó"));
        })
        .join("");
      return `<div class="pr-group">${esc(GROUP_LABELS[g])}</div>
              <div class="con-edit-grid">${cells}</div>`;
    })
    .join("");

  const confirmNote = snap.pricingConfirmed
    ? `<span class="pill approved">${T(lang, "az árak véglegesítve — a levelek árat hirdethetnek")}</span>`
    : `<span class="pill rejected">${T(lang, "nincs véglegesítve — a §C-kapu blokkol minden árat hirdető levelet")}</span>`;

  // Module add-ons live in ONE global (HUF) table — editable on the HU page only,
  // to avoid the illusion of per-region module prices (a follow-up slice).
  const modulesSection =
    snap.region === "hu"
      ? `<h3 style="margin-top:22px">${T(lang, "Modul-felárak (havi)")}</h3>${groupBlocks}`
      : `<h3 style="margin-top:18px">${T(lang, "Modul-felárak (havi)")}</h3>
         <p class="mut small">A modul-felárak jelenleg globálisak (HUF); a
         <a href="/pricing?region=hu">${T(lang, "Magyarország")}</a> ${T(lang, "oldalon szerkeszthetők.")}</p>`;

  const body = `
    <a class="con-back" href="/"><span aria-hidden="true">←</span> ${T(lang, "Vissza a vezérlőpultra")}</a>
    <div class="panel" style="max-width:980px;margin:0 auto">
      <h2>${T(lang, "Árazás")} ${helpLink("console.pricing")}</h2>
      <p class="mut small" style="margin-top:-4px">
        Ez az árazás EGYETLEN forrása — a konfigurátor, a megrendelés-rögzítés és a levél
        ár-sora is innen olvas. Mentés után azonnal él (a nyilvános oldal ~10 mp-en belül veszi át).</p>

      <div class="row" style="margin:0 0 10px;gap:6px;flex-wrap:wrap;align-items:center">
        <span class="mut small">${T(lang, "Piac / régió:")}</span> ${switcher}
      </div>
      <p class="mut small" style="margin:-4px 0 12px">A nyilvános oldal a látogató régiója
        szerinti árat mutatja; ha arra nincs, a <strong>${T(lang, "Globális (EUR)")}</strong> ${T(lang, "árlistát.")}</p>

      <div class="row" style="margin:10px 0 16px;gap:8px;flex-wrap:wrap;align-items:center">
        ${notice ? `<span class="pill ${notice.ok ? "approved" : "rejected"}">${esc(notice.text)}</span>` : ""}
        ${confirmNote}
      </div>

      <form method="post" action="/pricing">
        <input type="hidden" name="region" value="${esc(snap.region)}">
        <h3>${T(lang, "Alap-előfizetés —")} ${esc(regionLabel(snap.region))} <span class="mut small">(${esc(snap.currency)})</span></h3>
        <div class="con-edit-grid">
          ${priceField("base_monthly", T(lang, "Alapdíj (a gerinccel együtt)"), snap.baseMonthly, `${unit} ${T(lang, "/ hó")}`)}
          ${priceField("annual_free_months", T(lang, "Éves előrefizetés — ingyen hónapok"), snap.annualFreeMonths, T(lang, "hónap"))}
          ${priceField("custom_domain_yearly", T(lang, "Saját domain (rajtunk keresztül)"), snap.customDomainYearly, `${unit} ${T(lang, "/ év")}`)}
        </div>
        <p class="mut small" style="margin:6px 0 0">Az „ingyen hónapok” az éves előrefizetés
          kedvezménye — pl. <strong>2</strong> ${T(lang, "= két hónap ingyen, azaz 10 hónap árát fizeti.")}</p>

        <h3 style="margin-top:22px">${T(lang, "Egyedi domain — feltételek (ADR-0093)")}</h3>
        <div class="con-edit-grid">
          ${
            // The cap guards OUR registrar cost — ONE knob (the default region's
            // value), every guard call site reads that; other region pages only
            // point at it instead of offering a field nothing reads.
            snap.region === "hu"
              ? priceField("domain_max_price_eur", T(lang, "Vételi ár-plafon (a mi költségünk)"), snap.domainMaxPriceEur, `€ ${T(lang, "/ év")}`)
              : staticField(T(lang, "Vételi ár-plafon (a mi költségünk)"), T(lang, "a Magyarország lapon állítható"))
          }
          ${priceField("domain_min_commitment_months", T(lang, "Minimum elköteleződés"), snap.domainMinCommitmentMonths, T(lang, "hónap"))}
          ${priceField("domain_free_min_monthly", T(lang, "Ingyen domain ekkora csomagtól"), snap.domainFreeMinMonthly, `${unit} ${T(lang, "/ hó")}`)}
          ${priceField("domain_buyout_price", T(lang, "Kivásárlási fix ár (korai kilépés)"), snap.domainBuyoutPrice, unit)}
          ${priceField("domain_loyalty_months", T(lang, "Hűség-kivásárlás hossza"), snap.domainLoyaltyMonths, T(lang, "hónap"))}
        </div>
        <p class="mut small" style="margin:6px 0 0">A plafon a regisztrátori vételt védi (prémium
          domaint nem veszünk); a kivásárlás a korai kilépő két útja: fix ár VAGY további
          hűség-hónapok változatlan csomagon — utána a domain díjmentesen az övé.</p>

        ${modulesSection}

        <label class="row" style="gap:12px;align-items:flex-start;margin:20px 0 4px;
               padding:14px 16px;border:1px solid var(--citui-line-strong);border-radius:10px;
               background:var(--citui-surface-2);cursor:pointer;flex-wrap:nowrap">
          <input type="checkbox" name="pricing_confirmed"${snap.pricingConfirmed ? " checked" : ""}
            style="width:22px;height:22px;flex:0 0 auto;margin-top:1px;cursor:pointer">
          <span style="min-width:0"><strong>${T(lang, "Az árak véglegesek, élesíthetők")}</strong>
            <span class="mut small" style="display:block;margin-top:2px">${T(lang, "Enélkül a levél nem hirdethet árat, és a nyilvános oldal „Egyedi ajánlat”-ot mutat (Fttv./§C-kapu).")}</span></span>
        </label>

        <div class="row" style="margin-top:12px">
          <button class="ok" type="submit">${T(lang, "Árazás mentése ({region})", { region: esc(regionLabel(snap.region)) })}</button>
        </div>
      </form>
    </div>`;
  return layout(T(lang, "Árazás"), body, { active: "/pricing" });
}

function confCell(c: number | null): string {
  if (c == null) return `<span class="mut">–</span>`;
  return c.toFixed(2);
}

/** Build a query string from the current query with overrides applied. */
function qs(q: LeadQuery, over: Record<string, string | number | undefined>): string {
  const merged: Record<string, unknown> = { ...q, ...over };
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    // Multi-select columns are arrays → REPEAT the param, never stringify it
    // (a "a,b" value would silently filter to nothing when sorting).
    if (Array.isArray(v)) {
      for (const item of v) if (item) p.append(k, String(item));
    } else if (v != null && v !== "") {
      p.set(k, String(v));
    }
  }
  const s = p.toString();
  return s ? `?${s}` : "/leads";
}

/** Sortable header link (toggles asc/desc; arrow shows current sort). */
function sortHead(label: string, key: string, q: LeadQuery): string {
  const active = q.sort === key;
  const nextDir = active && q.dir !== "asc" ? "asc" : "desc";
  const arrow = active ? (q.dir === "asc" ? " ↑" : " ↓") : "";
  return `<a href="${qs(q, { sort: key, dir: nextDir })}">${esc(label)}${arrow}</a>`;
}

function photoCell(n: number, sv: boolean): string {
  const cls = n >= 3 ? "q-good" : n >= 1 ? "q-mid" : "q-bad";
  return `<span class="${cls}">${n}</span>${sv ? `<span class="sv">SV</span>` : ""}`;
}

function contactCell(c: string): string {
  const cls = c === "email" ? "q-good" : c === "none" ? "q-bad" : "q-mid";
  return `<span class="${cls}">${esc(c)}</span>`;
}

function sel(
  name: string,
  current: string | undefined,
  opts: [string, string][],
): string {
  // Auto-apply: choosing a value filters immediately (an operator should not have
  // to remember a second click — the missing click read as "the filter is broken").
  return `<select name="${name}" onchange="this.form.submit()">${opts
    .map(
      ([v, l]) =>
        `<option value="${esc(v)}"${(current ?? "") === v ? " selected" : ""}>${esc(l)}</option>`,
    )
    .join("")}</select>`;
}

/**
 * Qualification badge: icon + label. The icon carries the meaning at a glance in a
 * long list (no_site = the prime target). Inline SVG, never an emoji (§B).
 */
// A FUNCTION of the language (ADR-0067 ③): `label` is UI text, `cls`/`svg` are not.
const QUAL_META = (lang = "hu"): Record<string, { label: string; cls: string; svg: string }> => ({
  no_site: {
    label: T(lang, "nincs honlap"),
    cls: "qb-hot",
    // crossed-out globe
    svg: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.5 2.5 2.5 13 0 16M12 4c-2.5 2.5-2.5 13 0 16"/><path d="M4 20 20 4" stroke-width="2.2"/>',
  },
  outdated: {
    label: T(lang, "elavult"),
    cls: "qb-warn",
    svg: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>', // clock
  },
  modern: {
    label: T(lang, "modern"),
    cls: "qb-ok",
    svg: '<path d="M4 12.5l5 5 11-11"/>', // check
  },
  unknown: {
    label: T(lang, "ismeretlen"),
    cls: "qb-mut",
    svg: '<circle cx="12" cy="12" r="8"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3 3.1v1.2"/><circle cx="12" cy="16.6" r=".6" fill="currentColor"/>',
  },
});

export function qualBadge(qualification: string | null | undefined): string {
  const m = QUAL_META(consoleLang())[qualification ?? "unknown"];
  if (!m) return `<span class="mut">–</span>`;
  return (
    `<span class="qbadge ${m.cls}" title="${esc(m.label)}">` +
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${m.svg}</svg>` +
    `${esc(m.label)}</span>`
  );
}

/** Badge for a disqualified lead (lifecycle, not website qualification). */
export function disqualifiedBadge(): string {
  const lang = consoleLang();
  return (
    `<span class="qbadge qb-off" title="${T(lang, "diszkvalifikálva")}">` +
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ` +
    `stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M8 12h8"/></svg>` +
    `${T(lang, "diszkvalifikálva")}</span>`
  );
}

/**
 * Column filter: a searchable MULTI-select in the table header. Ticking values
 * filters immediately (the popup submits the surrounding form), and the search box
 * narrows long option lists (regions grow with every new scrape area).
 * Hand-rolled, no dependency — same doctrine as the rest of the console.
 */
function colFilter(
  name: string,
  options: { value: string; label: string; count?: number }[],
  selected: string[] = [],
): string {
  const lang = consoleLang();
  const on = selected.length;
  const items = options
    .map((o) => {
      const checked = selected.includes(o.value) ? " checked" : "";
      return (
        `<label class="cf-opt" data-label="${esc(o.label.toLowerCase())}">` +
        `<input type="checkbox" name="${esc(name)}" value="${esc(o.value)}"${checked} ` +
        `onchange="this.form.submit()">` +
        `<span>${esc(o.label)}</span>` +
        (o.count !== undefined ? `<span class="cf-count">${o.count}</span>` : "") +
        `</label>`
      );
    })
    .join("");
  return `<span class="cf">
    <button type="button" class="cf-btn${on ? " on" : ""}" onclick="citCf(this)" aria-label="${T(lang, "szűrés")}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
        <path d="M4 6h16M7 12h10M10 18h4"/></svg>${on ? `<i>${on}</i>` : ""}
    </button>
    <span class="cf-pop" hidden>
      ${options.length > 6 ? `<input type="text" class="cf-search" placeholder="${T(lang, "keresés…")}" oninput="citCfSearch(this)" onclick="event.stopPropagation()">` : ""}
      <span class="cf-list">${items}</span>
    </span>
  </span>`;
}

/** Numeric "at least" filter in a header (photos, material). */
function minFilter(name: string, value?: number): string {
  const lang = consoleLang();
  return `<span class="cf">
    <button type="button" class="cf-btn${value ? " on" : ""}" onclick="citCf(this)" aria-label="minimum">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
        <path d="M4 6h16M7 12h10M10 18h4"/></svg>${value ? `<i>${value}+</i>` : ""}
    </button>
    <span class="cf-pop" hidden>
      <label class="cf-opt" style="gap:6px">${T(lang, "legalább")}
        <input type="number" name="${esc(name)}" min="0" value="${value ?? ""}" style="width:70px"
               onchange="this.form.submit()" onclick="event.stopPropagation()"></label>
    </span>
  </span>`;
}

export function leadsPage(rows: LeadListRow[], q: LeadQuery = {}): string {
  const lang = consoleLang();
  // Options come from the DATA where the set is open (regions), from the domain
  // where it is closed (qualification/contact/mock) — with live counts either way.
  const countBy = (pick: (r: LeadListRow) => string) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(pick(r), (m.get(pick(r)) ?? 0) + 1);
    return m;
  };
  const regionCounts = countBy((r) => r.region);
  const countryCounts = countBy((r) => r.country ?? "");
  const cityCounts = countBy((r) => r.city ?? "");
  const qualCounts = countBy((r) => r.qualification ?? "unknown");
  const contactCounts = countBy((r) => r.contact);
  const mockCounts = countBy((r) => (r.latestArtifact ? r.latestArtifact.status : "none"));
  const opt = (
    values: [string, string][],
    counts: Map<string, number>,
  ): { value: string; label: string; count?: number }[] =>
    values.map(([value, label]) => ({ value, label, count: counts.get(value) ?? 0 }));

  const regionOpts = [...regionCounts.keys()]
    .sort()
    .map((v) => ({ value: v, label: v, count: regionCounts.get(v) }));

  // country/city option sets are OPEN (they grow with every scrape) → build from data.
  // The empty-string bucket = leads whose scrape carried no country/city yet.
  const facetOpts = (counts: Map<string, number>) =>
    [...counts.keys()]
      .sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)))
      .map((v) => ({ value: v, label: v === "" ? T(lang, "ismeretlen") : v, count: counts.get(v) }));
  const countryOpts = facetOpts(countryCounts);
  const cityOpts = facetOpts(cityCounts);

  // The whole table lives in ONE GET form: every header control submits it, so
  // filters combine instead of replacing each other.
  const hidden =
    (q.sort ? `<input type="hidden" name="sort" value="${esc(q.sort)}">` : "") +
    (q.dir ? `<input type="hidden" name="dir" value="${esc(q.dir)}">` : "") +
    (q.disqualified === "1" ? `<input type="hidden" name="disqualified" value="1">` : "");

  const activeCount =
    (q.name ? 1 : 0) +
    (q.region?.length ?? 0) +
    (q.country?.length ?? 0) +
    (q.city?.length ?? 0) +
    (q.qualification?.length ?? 0) +
    (q.contact?.length ?? 0) +
    (q.mock?.length ?? 0) +
    (q.minPhotos ? 1 : 0) +
    (q.minMaterial ? 1 : 0);

  const toolbar = `<div class="row" style="justify-content:space-between;align-items:center;margin-bottom:10px">
    <span class="mut small">${
      q.defaulted
        ? T(lang, "Alapértelmezett szűrő: nincs / elavult honlap, min. 1 kép")
        : activeCount
          ? T(lang, "{n} aktív szűrő", { n: activeCount })
          : T(lang, "nincs szűrő")
    }</span>
    <span class="row" style="gap:12px">
      ${activeCount ? `<a class="small" href="/leads?${q.disqualified === "1" ? "disqualified=1" : "all=1"}">${T(lang, "Szűrők törlése")}</a>` : ""}
      <a class="small" href="${q.disqualified === "1" ? "/leads" : "/leads?disqualified=1"}">${
        q.disqualified === "1" ? T(lang, "◂ aktív leadek") : T(lang, "diszkvalifikáltak ▸")
      }</a>
    </span>
  </div>`;

  const head = `<thead><tr>
    <th>${sortHead(T(lang, "Név"), "name", q)}
      <span class="cf">
        <button type="button" class="cf-btn${q.name ? " on" : ""}" onclick="citCf(this)" aria-label="${T(lang, "név-keresés")}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <circle cx="11" cy="11" r="6"/><path d="M20 20l-4.3-4.3"/></svg>
        </button>
        <span class="cf-pop" hidden>
          <input type="text" name="name" list="leadNames" value="${esc(q.name ?? "")}"
                 placeholder="${T(lang, "név…")}" onchange="this.form.submit()" onclick="event.stopPropagation()">
        </span>
      </span></th>
    <th>${T(lang, "Régió")} ${colFilter("region", regionOpts, q.region ?? [])}</th>
    <th>${T(lang, "Ország")} ${colFilter("country", countryOpts, q.country ?? [])}</th>
    <th>${T(lang, "Város")} ${colFilter("city", cityOpts, q.city ?? [])}</th>
    <th>${sortHead(T(lang, "Kvalifikáció"), "qualification", q)} ${colFilter(
      "qualification",
      opt(
        [["no_site", T(lang, "nincs honlap")], ["outdated", T(lang, "elavult")], ["modern", T(lang, "modern")], ["unknown", T(lang, "ismeretlen")]],
        qualCounts,
      ),
      q.qualification ?? [],
    )}</th>
    <th>${sortHead(T(lang, "Fotók"), "photos", q)} ${minFilter("minPhotos", q.minPhotos)}</th>
    <th>${sortHead(T(lang, "Anyag"), "material", q)} ${minFilter("minMaterial", q.minMaterial)}</th>
    <th>${sortHead(T(lang, "Match"), "match", q)}</th>
    <th>${sortHead(T(lang, "Kontakt"), "contact", q)} ${colFilter(
      "contact",
      opt([["email", T(lang, "email")], ["sms", T(lang, "sms")], ["voice", T(lang, "voice")], ["none", T(lang, "nincs")]], contactCounts),
      q.contact ?? [],
    )}</th>
    <th>${sortHead(T(lang, "Mock"), "mock", q)} ${colFilter(
      "mock",
      opt(
        [["none", T(lang, "nincs")], ["generated", T(lang, "generated")], ["approved", T(lang, "approved")], ["rejected", T(lang, "rejected")]],
        mockCounts,
      ),
      q.mock ?? [],
    )}</th>
  </tr></thead>`;

  const bodyRows = rows.length
    ? rows
        .map(
          (r) => `<tr>
        <td><a href="/lead/${esc(r.id)}">${esc(r.name)}</a></td>
        <td class="small mut">${esc(r.region)}</td>
        <td class="small">${r.country ? esc(r.country) : `<span class="mut">–</span>`}</td>
        <td class="small">${r.city ? esc(r.city) : `<span class="mut">–</span>`}</td>
        <td>${r.lifecycle === "disqualified" ? disqualifiedBadge() : qualBadge(r.qualification)}</td>
        <td class="num">${photoCell(r.photos, r.streetView)}</td>
        <td class="num mut">${r.material || "–"}</td>
        <td class="num">${confCell(r.matchConfidence)}</td>
        <td class="small">${contactCell(r.contact)}</td>
        <td>${
          r.latestArtifact
            ? `<span class="pill ${esc(r.latestArtifact.status)}">${esc(r.latestArtifact.status)}</span>`
            : `<span class="mut small">nincs</span>`
        }${
          r.outreachSentAt
            ? `<br><span class="pill approved" style="margin-top:4px;display:inline-block" title="${T(lang, "E-mail kiküldve {date}", { date: esc(r.outreachSentAt.slice(0, 16).replace("T", " ")) })}">${T(lang, "✓ kiküldve")}</span>`
            : ""
        }</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="10" class="mut" style="padding:24px">${T(lang, "Nincs a szűrőnek megfelelő lead.")}
        <a href="/leads">${T(lang, "Szűrők törlése")}</a></td></tr>`;

  // Autocomplete source for the name search (the current result set).
  const nameList = `<datalist id="leadNames">${rows
    .map((r) => `<option value="${esc(r.name)}">`)
    .join("")}</datalist>`;

  const body = `<div class="panel"><h2>${T(lang, "Leadek ({n})", { n: rows.length })} ${helpLink("console.leads")}</h2>
    ${toolbar}
    <form method="get" id="leadFilters">${hidden}
      <div class="tblwrap"><table>${head}<tbody>${bodyRows}</tbody></table></div>
    </form>
    ${nameList}
    ${LEAD_FILTER_JS}</div>`;
  return layout(T(lang, "Leadek"), body, { active: "/leads" });
}

/** Header-filter behaviour: open one popup at a time, close on outside click,
 *  and narrow long option lists as the operator types. */
const LEAD_FILTER_JS = `<script>
  function citCf(btn) {
    var pop = btn.parentNode.querySelector('.cf-pop');
    var open = !pop.hidden;
    document.querySelectorAll('.cf-pop').forEach(function (p) { p.hidden = true; });
    pop.hidden = open;
    if (!open) { var s = pop.querySelector('input'); if (s) s.focus(); }
    event.stopPropagation();
  }
  function citCfSearch(input) {
    var q = input.value.trim().toLowerCase();
    input.parentNode.querySelectorAll('.cf-opt').forEach(function (o) {
      o.style.display = !q || (o.dataset.label || '').indexOf(q) !== -1 ? '' : 'none';
    });
  }
  document.addEventListener('click', function () {
    document.querySelectorAll('.cf-pop').forEach(function (p) { p.hidden = true; });
  });
  document.querySelectorAll('.cf-pop').forEach(function (p) {
    p.addEventListener('click', function (e) { e.stopPropagation(); });
  });
</script>`;

/** Converted-state block for the approved artifact this site came from. */
function convertedBlock(c: ConversionView): string {
  const lang = consoleLang();
  const mods = c.modules.length
    ? c.modules.map((m) => `<span class="pill">${esc(m)}</span>`).join(" ")
    : `<span class="mut small">${T(lang, "nincs aktív modul")}</span>`;
  return `<div class="row" style="margin-top:10px">
      <span class="pill approved">${esc(c.siteStatus)}</span>
      <a class="small" href="${esc(c.previewUrl)}" target="_blank">${T(lang, "privát előnézet ▸")}</a>
      <a class="small" href="${esc(c.adminUrl)}" target="_blank">tenant-admin ▸</a>
      ${c.partnerId ? `<a class="small" href="/partner/${esc(c.partnerId)}">${T(lang, "Partner-lap (pénzügy) ▸")}</a>` : ""}
    </div>
    <div class="row" style="margin-top:8px">${mods}</div>
    <div class="mut small" style="margin-top:6px">${T(lang, "Provisioned privát előnézet — a nyilvános élesítés fizetés-kapus, ház-oldali (A2).")}</div>`;
}

/**
 * Convert action for an approved, not-yet-converted artifact. The modules are the
 * OWNER's own choice from the prospect configurator (their order intent), shown
 * READ-ONLY — the operator approves + converts, they do not re-pick modules. When
 * the owner hasn't configured yet, we provision ALL-IN (see modulesForConversion).
 */
function convertForm(
  leadId: string,
  artifactId: string,
  modules: string[],
  fromOrder: boolean,
): string {
  const lang = consoleLang();
  const labelOf = (id: string) => MODULE_CATALOG.find((m) => m.id === id)?.label ?? id;
  const pills = modules.length
    ? modules.map((m) => `<span class="pill">${esc(labelOf(m))}</span>`).join(" ")
    : `<span class="mut small">nincs modul</span>`;
  const note = fromOrder
    ? T(lang, "A tulaj a konfigurátorban ezeket kérte — ezekkel élesítünk:")
    : T(lang, "A tulaj még nem konfigurált — a teljes (ALL-IN) oldallal konvertálunk:");
  return `<form method="post" action="/lead/${esc(leadId)}/convert" style="margin-top:10px">
      <input type="hidden" name="artifactId" value="${esc(artifactId)}">
      <div class="mut small" style="margin-bottom:6px">${note}</div>
      <div class="row" style="margin-bottom:8px">${pills}</div>
      <button class="ok" type="submit">${T(lang, "Konvertálás privát előnézetbe ▸")}</button>
    </form>`;
}

/** Prospect order intents + payment state (pricing/payment slice) for the operator. */
function orderIntentsPanel(
  orders: OrderIntentView[],
  payments: PaymentView[],
  leadId: string,
): string {
  const lang = consoleLang();
  if (!orders.length) return "";
  const rows = orders
    .map((o) => {
      const when = (o.submittedAt ?? o.createdAt).slice(0, 16).replace("T", " ");
      const per = o.billingPeriod === "annual" ? T(lang, "év") : T(lang, "hó");
      const pays = payments.filter((p) => p.orderIntentId === o.id);
      const payHtml = pays.length
        ? pays
            .map((p) => {
              const cls = p.status === "paid" ? "approved" : p.status === "failed" ? "rejected" : "generated";
              const link =
                p.status === "pending" && p.payUrl
                  ? ` <a class="small" href="${esc(p.payUrl)}" target="_blank">${T(lang, "fizetőoldal ▸")}</a>`
                  : p.status === "paid" && p.paidAt
                    ? ` <span class="mut small">${esc(p.paidAt.slice(0, 16).replace("T", " "))}</span>`
                    : "";
              const inv = p.invoiceNumber
                ? ` <span class="mut small">${T(lang, "· számla: {number}", { number: esc(p.invoiceNumber) })}</span>`
                : "";
              return `<span class="pill ${cls}">${T(lang, "fizetés: {status}", { status: esc(p.status) })}</span>${link}${inv}`;
            })
            .join(" ")
        : "";
      const paid = pays.some((p) => p.status === "paid");
      const hasPending = pays.some((p) => p.status === "pending");
      const payBtn =
        o.status === "submitted" && !paid && !hasPending
          ? `<form method="post" action="/lead/${esc(leadId)}/request-payment">
               <button class="ok" type="submit">${T(lang, "Fizetési kérés küldése ▸")}</button></form>`
          : "";
      return `<div style="padding:8px 0;border-bottom:1px solid var(--citui-line)">
        <div class="row" style="justify-content:space-between;margin-top:0">
          <span><b style="font-size:16px">${o.price != null ? fmtHuf(o.price) : "?"}</b>
            <span class="mut">/ ${per}</span>
            <span class="pill ${o.status === "submitted" ? "approved" : ""}" style="margin-left:6px">${esc(o.status)}</span></span>
          <span class="mut small">${esc(when)}</span>
        </div>
        <div class="mut small" style="margin-top:4px">${o.modules.length} modul: ${o.modules.map((m) => esc(m)).join(", ") || "–"}</div>
        <div class="mut small" style="margin-top:4px">Domain: ${
          o.domainType === "citoviso_registered"
            ? `<b>${T(lang, "egyedi (rajtunk keresztül)")}</b> — ${esc(o.domainName ?? "?")}${o.commitmentMonths ? ` · min. ${o.commitmentMonths} hó elköteleződés` : ""}`
            : o.domainType === "own"
              ? T(lang, "saját meglévő — {domain}", { domain: esc(o.domainName ?? "?") })
              : `citoviso-aldomain${o.domainName ? ` — ${esc(o.domainName)}` : ""}`
        }</div>
        <div class="row" style="margin-top:6px">${payHtml}${payBtn}</div>
      </div>`;
    })
    .join("");
  return `<div class="panel"><h2>${T(lang, "Csomag-igények ({n})", { n: orders.length })}</h2>${rows}
    <div class="mut small" style="margin-top:8px">${T(lang, "Pilot fizetés: pay-link (Barion helyén mock) → fizetéskor a site élesedik; nem-fizet → deaktiválás. Auto-terhelés (MIT) = 2. fázis.")}</div></div>`;
}

/** MOCK hosted pay page — stands in for the real Barion pay-link (Slice 2). */
export function payMockPage(ref: string, amount: number, period: string, status: string): string {
  const lang = consoleLang();
  const per = period === "annual" ? T(lang, "év") : T(lang, "hó");
  const body = `<div class="panel" style="max-width:440px;margin:48px auto;text-align:center">
    <h2>${T(lang, "Mock fizetőoldal")}</h2>
    <p style="font-size:24px;margin:12px 0"><b>${fmtHuf(amount)}</b> <span class="mut">/ ${per}</span></p>
    <p class="mut small">${T(lang, "ref: {ref} · státusz: {status}", { ref: `<code>${esc(ref)}</code>`, status: esc(status) })}</p>
    <div class="row" style="justify-content:center;margin-top:18px">
      <form method="post" action="/pay/mock/${esc(ref)}/paid"><button class="ok" type="submit">Fizetek ▸</button></form>
      <form method="post" action="/pay/mock/${esc(ref)}/failed"><button class="bad" type="submit">${T(lang, "Elutasítom")}</button></form>
    </div>
    <p class="mut small" style="margin-top:16px">${T(lang, "Ez a MOCK fizetőoldal a valós Barion pay-link helyén. A gombok ugyanazt a webhook-utat hajtják, amit az éles gateway fog.")}</p>
  </div>`;
  return layout(T(lang, "Mock fizetés"), body, { chrome: false });
}

/**
 * Buyer returned from the gateway before the final payment state landed (Barion
 * may still report InProgress for a few seconds). Auto-refresh until /pay/done
 * can render the real outcome — never leave the buyer on a dead screen.
 */
export function payPendingPage(): string {
  const lang = consoleLang();
  const body = `<div class="panel" style="max-width:560px;margin:48px auto;text-align:center">
    <h2 style="margin-top:0">${T(lang, "A fizetés feldolgozás alatt…")}</h2>
    <p class="mut" style="margin:0">Köszönjük a türelmét — az oldal néhány másodpercen
    belül automatikusan frissül. Kérjük, ne zárja be az ablakot.</p>
  </div>`;
  return layout(T(lang, "Fizetés feldolgozása"), body, {
    chrome: false,
    head: `<meta http-equiv="refresh" content="3">`,
  });
}

/**
 * ADR-0063 — the post-payment screen for a MULTILANG purchase.
 *
 * ⛔ WHY SEPARATE (measured defect, 2026-08-28): the generic result page tells the
 * buyer "your site is live, here are your login credentials" — which for a
 * translation purchase is both false-sounding and useless: this tenant already has
 * a live site and a login, and the ONE thing they want to know is that the
 * translation is running and where it will show up. A payment screen that answers
 * the wrong question reads as a mis-charge.
 */
export async function multilangPayResultPage(
  tenantId: string,
  amount: number | null,
): Promise<string> {
  const lang = consoleLang();
  const { db } = await import("../db/client.js");
  const { tenantSiteUrl } = await import("../domains.js");
  const { config } = await import("../config.js");
  const site = await db
    .selectFrom("site")
    .select(["id", "slug", "status", "custom_domain as customDomain"])
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  const ml = site
    ? await db
        .selectFrom("site_multilang")
        .select(["languages", "status"])
        .where("site_id", "=", site.id)
        .executeTakeFirst()
    : undefined;
  const siteUrl =
    site?.status === "live" ? tenantSiteUrl(config.publicSiteUrl, site.slug, site.customDomain) : null;
  const adminUrl = `${config.publicSiteUrl.replace(/\/+$/, "")}/admin?tab=modulok#tobbnyelvu`;
  // The generation runs in the background (minutes of translation), so the page
  // states honestly where it stands instead of implying it is already finished.
  const done = ml?.status === "active" && (ml.languages?.length ?? 0) > 0;
  const langLinks =
    done && siteUrl
      ? `<p style="margin:0 0 18px">${(ml!.languages as string[])
          .map(
            (l) =>
              `<a href="${esc(siteUrl)}/${esc(l)}/" target="_blank" rel="noopener" ` +
              `style="margin-right:10px">${esc(l.toUpperCase())}</a>`,
          )
          .join("")}</p>`
      : "";
  const body = `<div class="panel" style="max-width:560px;margin:48px auto">
    <h2 style="margin-top:0">${T(lang, "Sikeres fizetés — köszönjük!")}</h2>
    <p class="q-good" style="margin:0 0 14px;font-size:15px"><b>${T(lang, "✓ Sikeres fizetés")}</b>${
      amount ? T(lang, " — a {amount} összegű terhelés megtörtént.", { amount: fmtHuf(amount) }) : ""
    }</p>
    <p style="margin:0 0 10px">${
      done
        ? T(lang, "A honlapja idegen nyelvű változatai elkészültek:")
        : T(lang, "A fordítás elindult — néhány percet vesz igénybe. Amint kész, a nyelvi változatok maguktól megjelennek az oldalán; e-mailt nem küldünk róla külön.")
    }</p>
    ${langLinks}
    <p style="margin:0 0 10px">${T(lang, "A számláját e-mailben küldjük a számlázási címére.")}</p>
    <p style="margin:18px 0 0"><a href="${esc(adminUrl)}">${T(lang, "Vissza a kezelőfelületre")}</a></p>
  </div>`;
  return layout(T(lang, "Sikeres fizetés"), body, { chrome: false });
}

/**
 * The buyer's post-payment screen — the ONLY place that tells a paying customer
 * what just happened and what to do next: (1) is my site live and where, (2) how
 * do I get in, (3) what can I change. Owner language, no internal jargon.
 */
export function payResultPage(
  paid: boolean,
  activated: boolean,
  info?: {
    siteUrl?: string | null;
    username?: string | null;
    contactEmail?: string | null;
    /** Charged amount in HUF — renders the explicit "payment succeeded" line. */
    amount?: number | null;
    /**
     * Absolute URL of the TENANT login. Required, because this page is served by
     * the OPERATOR console: a relative "/login" here sent the paying customer to
     * the internal operator sign-in, where their credentials do not work. The
     * printed label used to be a hardcoded "citoviso.com/login" on top of that,
     * so the text and the link disagreed and neither was right in dev.
     */
    loginUrl?: string | null;
  },
): string {
  const lang = consoleLang();
  // The buyer must SEE that the charge went through — an explicit confirmation
  // line, not just an implied "thank you" (owner feedback, 2026-08-21).
  const paidLine = `<p class="q-good" style="margin:0 0 14px;font-size:15px"><b>${T(lang, "✓ Sikeres fizetés")}</b>${
    info?.amount ? T(lang, " — a {amount} összegű terhelés megtörtént.", { amount: fmtHuf(info.amount) }) : T(lang, " — a terhelés megtörtént.")
  }</p>`;
  if (!paid) {
    return layout(
      T(lang, "Fizetés elutasítva"),
      `<div class="panel" style="max-width:520px;margin:48px auto;text-align:center">
        <h2 class="q-bad">${T(lang, "A fizetés nem sikerült")}</h2>
        <p class="mut">Nem történt terhelés. Próbálja meg újra, vagy írjon nekünk:
        <a href="mailto:info@citoviso.com">info@citoviso.com</a>.</p></div>`,
      { chrome: false },
    );
  }
  // Payment captured but activation did NOT complete (e.g. mock not approved yet,
  // render/photo-policy failure). Never claim the site is live or that credentials
  // were e-mailed — tell the buyer the truth: payment received, site under final
  // check, we'll e-mail when it's ready. The operator resolves it from the console.
  if (!activated) {
    return layout(
      T(lang, "Sikeres fizetés"),
      `<div class="panel" style="max-width:560px;margin:48px auto">
        <h2 class="q-good" style="margin-top:0">${T(lang, "Sikeres fizetés — köszönjük!")}</h2>
        ${paidLine}
        <p style="margin:0 0 12px">Az oldalát még véglegesítjük. Amint elérhető, a pontos
        címet és a belépési adatait <b>${T(lang, "e-mailben elküldjük")}</b> ${T(lang, "— általában néhány órán belül.")}</p>
        <p class="mut small" style="margin:0">Kérdése van? Írjon:
        <a href="mailto:info@citoviso.com">info@citoviso.com</a> ${T(lang, "— segítünk.")}</p>
      </div>`,
      { chrome: false },
    );
  }
  const site = info?.siteUrl;
  const liveBlock = site
    ? `<p style="margin:0 0 6px">Az oldala <b>${T(lang, "elérhető az interneten")}</b>:</p>
       <p style="margin:0 0 22px;font-size:18px"><a href="${esc(site)}">${esc(site)}</a></p>`
    : `<p style="margin:0 0 22px">Az oldala elkészült. Néhány percen belül elérhető lesz —
       a pontos címet e-mailben küldjük.</p>`;
  const mailNote = info?.contactEmail
    ? T(lang, "Elküldtük a belépési adatait ide: {email}.", { email: `<b>${esc(info.contactEmail)}</b>` })
    : T(lang, "A belépési adatait e-mailben küldtük el.");
  const userLine = info?.username
    ? `<li style="margin:0 0 6px">${T(lang, "Felhasználónév:")} <b>${esc(info.username)}</b> ${T(lang, "(a jelszó az e-mailben)")}</li>`
    : `<li style="margin:0 0 6px">${T(lang, "A felhasználónevet és a jelszót e-mailben küldtük.")}</li>`;
  // The link the buyer must be able to click: their OWN admin, never ours.
  const loginHref = info?.loginUrl || "/login";
  const loginLabel = loginHref.replace(/^https?:\/\//, "");
  const body = `<div class="panel" style="max-width:560px;margin:48px auto">
      <h2 class="q-good" style="margin-top:0">${T(lang, "Sikeres fizetés — köszönjük!")}</h2>
      ${paidLine}
      ${liveBlock}
      <h3 style="margin:0 0 8px">${T(lang, "Mi a következő lépés?")}</h3>
      <p style="margin:0 0 10px">${mailNote} ${T(lang, "Ezekkel bármikor beléphet, és {b} — nem kell hozzá szakember.", { b: `<b>${T(lang, "saját maga szerkesztheti a szövegeket és a fotókat")}</b>` })}</p>
      <ul style="margin:0 0 18px;padding-left:20px">
        ${userLine}
        <li style="margin:0 0 6px">${T(lang, "Belépés:")} <a href="${esc(loginHref)}">${esc(loginLabel)}</a></li>
        <li>${T(lang, "Itt cserélheti a bemutatkozó szöveget, a képeket és az elérhetőségeit.")}</li>
      </ul>
      <p style="margin:0 0 18px"><a class="btn" href="${esc(loginHref)}">${T(lang, "Belépek és szerkesztem")}</a></p>
      <p class="mut small" style="margin:0">Kérdése van? Írjon:
      <a href="mailto:info@citoviso.com">info@citoviso.com</a> ${T(lang, "— segítünk.")}</p>
    </div>`;
  return layout(T(lang, "Sikeres fizetés — az oldala él"), body, { chrome: false });
}

// Segment hypothesis labels (PILOT.md §2.2) for the prospect create form.
const SEGMENTS = (lang = "hu"): readonly { id: string; label: string }[] => [
  { id: "nincs_honlap", label: T(lang, "nincs honlap") },
  { id: "0_labnyom", label: T(lang, "0 lábnyom") },
  { id: "van_labnyom", label: T(lang, "van lábnyom") },
  { id: "elavult", label: T(lang, "elavult oldal") },
];

/** Tracked-outreach panel: create the /p/<token> prospect + funnel status. */
function prospectsPanel(prospects: ProspectView[], d: LeadDetail): string {
  const lang = consoleLang();
  // The tracked link points at an APPROVED mock — offer creation only then.
  const approved = d.artifacts.find((a) => a.status === "approved");
  const createForm = approved
    ? `<form method="post" action="/lead/${esc(d.id)}/prospect" class="row" style="flex-wrap:wrap;gap:8px">
        <input type="hidden" name="artifactId" value="${esc(approved.id)}">
        <select name="segment">${SEGMENTS(lang).map(
          (s) =>
            `<option value="${esc(s.id)}"${d.qualification === "no_site" && s.id === "nincs_honlap" ? " selected" : ""}${d.qualification === "outdated" && s.id === "elavult" ? " selected" : ""}${d.qualification === "modern" && s.id === "van_labnyom" ? " selected" : ""}>${esc(s.label)}</option>`,
        ).join("")}</select>
        <input type="email" name="email" placeholder="${T(lang, "kapcsolati e-mail (opcionális)")}" style="min-width:220px">
        <button type="submit">${T(lang, "Követett link készítése")}</button>
      </form>`
    : `<p class="mut small">${T(lang, "Követett link jóváhagyott mockhoz készíthető (előbb kuráció).")}</p>`;

  const rows = prospects
    .map((p) => {
      const link = `/p/${p.token}`;
      return `<div style="padding:8px 0;border-bottom:1px solid var(--citui-line)">
        <div class="row" style="justify-content:space-between;margin-top:0">
          <span>
            <span class="pill ${p.status === "order_intent" || p.status === "converted" ? "approved" : ""}">${esc(p.status)}</span>
            ${p.segment ? `<span class="pill">${esc(p.segment)}</span>` : ""}
            ${p.sentAt ? `<span class="pill approved">✓ ${T(lang, "E-mail elküldve · {date}", { date: esc(p.sentAt.slice(0, 16).replace("T", " ")) })}</span>` : `<span class="pill">${T(lang, "e-mail még nem ment ki")}</span>`}
            ${p.unsubscribedAt ? `<span class="pill rejected">leiratkozott</span>` : ""}
          </span>
          <span class="mut small">${esc(p.createdAt.slice(0, 16).replace("T", " "))}</span>
        </div>
        <div class="small" style="margin-top:6px">
          <a href="${esc(link)}" target="_blank">${esc(link)}</a>
          <button type="button" class="small" style="margin-left:8px"
            onclick="navigator.clipboard.writeText(location.origin+'${esc(link)}');this.textContent='${T(lang, "másolva")}'">${T(lang, "link másolása")}</button>
        </div>
        <div class="mut small" style="margin-top:4px">
          ${p.contactEmail ? `${esc(p.contactEmail)} · ` : ""}${p.views} megnyitás · ${p.events} esemény
          ${p.sentAt ? T(lang, " · kiküldve {date}", { date: esc(p.sentAt.slice(0, 16).replace("T", " ")) }) : ""}
        </div>
        <div class="row" style="margin-top:6px">
          ${
            !p.unsubscribedAt
              ? `<form method="get" action="/prospect/${esc(p.id)}/draft" style="display:inline;margin:0">
                   <button type="submit" class="con-ib">${ic("mail", 15)}${T(lang, "E-mail / SMS megnyitása — küldés ▸")}</button></form>`
              : ""
          }
          <form method="get" action="/prospect/${esc(p.id)}/activity" style="display:inline;margin:0">
            <button type="submit" class="con-ib">${ic("report", 15)}${T(lang, "Tevékenység — mit csinált ({v} megnyitás · {e} esemény) ▸", { v: p.views, e: p.events })}</button></form>
          ${
            p.status === "created" && !p.unsubscribedAt
              ? `<form method="post" action="/prospect/${esc(p.id)}/sent" style="display:inline;margin:0">
                   <input type="hidden" name="leadId" value="${esc(d.id)}">
                   <button class="ok" type="submit">${T(lang, "Kiküldve — mérés indul")}</button></form>`
              : ""
          }
        </div>
      </div>`;
    })
    .join("");

  return `<div class="panel" id="prospects"><h2>${T(lang, "Megkeresés — követett link ({n})", { n: prospects.length })}</h2>
    ${createForm}${rows}
    <details class="mut small" style="margin-top:8px">
      <summary style="cursor:pointer">${T(lang, "Hogyan működik a mérés?")}</summary>
      <p style="margin:6px 0 0">A /p/&lt;token&gt; link minden megnyitása külön
      mérési session (open/scroll/dwell/modul-események). A „Kiküldve" gomb a H1-tölcsér bázisa.
      Az oldal alján GDPR-tájékoztató + leiratkozás.</p>
    </details></div>`;
}

/** Hostname only — a full URL would blow the identity band's line width. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Re-run the enrichment chain for THIS lead (ADR-0029 follow-up).
 *
 * Until now enrichment only ever happened during a scrape, and the CLI backfill
 * only targeted `qualification = no_site` — so a lead that looked wrong for any
 * other reason (a rotted website tag, a corrected city) could not be refreshed
 * at all without a full re-scrape. That is exactly the case an operator hits
 * while looking at a single bad record.
 */
function reenrichForm(d: LeadDetail): string {
  const lang = consoleLang();
  return `<form method="post" action="/lead/${esc(d.id)}/reenrich" class="con-reenrich"
        onsubmit="${esc(`var b=this.querySelector('button');b.disabled=true;b.textContent='${jsStr(T(lang, "Újragyűjtés folyamatban…"))}'`)}">
      <button type="submit" class="ghost">${ic("scrape", 15)} ${T(lang, "Adatok újragyűjtése")}</button>
      <span class="mut small">${T(lang, "Honlap-keresés, elérhetőség és kontakt újrafuttatása erre a leadre — a fenti mentett javításokkal. Nem ír felül kurátori adatot.")}</span>
    </form>`;
}

/** Human label + a deep link for one data source, so "Források" names something
 *  the operator can actually OPEN and check rather than a bare adapter string. */
function sourceLink(
  source: string,
  ref: string | undefined,
  lat?: number,
  lon?: number,
): string {
  const labels: Record<string, string> = {
    osm: "OpenStreetMap",
    google_places: "Google Maps",
  };
  const label = labels[source] ?? source;
  let href: string | undefined;
  if (source === "osm" && ref && /^(node|way|relation)\/\d+$/.test(ref)) {
    href = `https://www.openstreetmap.org/${ref}`;
  } else if (source === "google_places" && ref) {
    href = `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(ref)}`;
  } else if (source === "google_places" && lat != null && lon != null) {
    // Older leads carry no place id — the coordinate still lands on the spot.
    href = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
  }
  return href
    ? `<a href="${esc(href)}" target="_blank" rel="noopener" class="con-src">${esc(label)}${ic("external", 13)}</a>`
    : `<span class="con-src con-src--flat">${esc(label)}</span>`;
}

/** Everything the scrape actually gathered about this lead — the operator should
 *  not have to open the DB to see why a lead looks the way it does. */
function leadDataPanel(d: LeadDetail): string {
  const lang = consoleLang();
  const raw = (d.raw ?? {}) as {
    phone?: string; email?: string; website?: string; websiteStatus?: string;
    lat?: number; lon?: number; sources?: string[]; contactChannel?: string;
    sourceRefs?: Record<string, string>; country?: string; city?: string;
    photoCount?: number; isLead?: boolean; disqualifiedReason?: string;
    listings?: PortalListing[];
    contacts?: ContactCandidate[];
    material?: { placesPhotos?: number; websiteImages?: number; totalImages?: number; streetView?: boolean };
    assessment?: {
      reachable?: boolean; responsive?: boolean; copyrightYear?: number;
      signals?: string[]; imageCount?: number; emails?: string[]; outdated?: boolean;
    };
  };
  const mat = raw.material ?? {};
  const a = raw.assessment;
  const val = (v: unknown) => (v === undefined || v === null || v === "" ? `<span class="mut">–</span>` : esc(v));
  const yesNo = (b?: boolean) => (b === undefined ? `<span class="mut">–</span>` : b ? "igen" : "nem");

  /** One labelled fact in the multi-column grid (replaces the 130px dl that left
   *  the right half of the card empty). */
  const fact = (label: string, value: string, wide = false) =>
    `<div class="con-fact${wide ? " con-fact--wide" : ""}">
       <span class="con-fact__k">${esc(label)}</span>
       <span class="con-fact__v">${value}</span>
     </div>`;

  const assessment = a
    ? `<h3 class="con-facts__h">${T(lang, "Honlap-állapot")}</h3>
       <div class="con-fact-grid">
         ${fact(T(lang, "Oldal elérhető"), yesNo(a.reachable))}
         ${fact(T(lang, "Mobilbarát"), yesNo(a.responsive))}
         ${fact(T(lang, "Copyright-év"), String(val(a.copyrightYear)))}
         ${fact(T(lang, "Képek az oldalon"), String(val(a.imageCount)))}
         ${fact(T(lang, "Elavultság-jelek"), a.signals?.length ? esc(a.signals.join(", ")) : `<span class="mut">nincs</span>`, true)}
         ${fact(T(lang, "Talált e-mailek"), a.emails?.length ? esc(a.emails.join(", ")) : `<span class="mut">–</span>`, true)}
       </div>`
    : "";

  // ADR-0029: contact/reachability fields are curator-EDITABLE (add missing OR correct
  // existing). Saved onto the lead's raw payload → the next generation uses them. The scraped
  // originals are shown when an edit has been made (audit).
  const rawAny = (d.raw ?? {}) as { scrapedContact?: Record<string, unknown>; curatorEditedAt?: string };
  const edited = rawAny.scrapedContact;
  const orig = (k: string) =>
    edited && edited[k] != null && edited[k] !== ""
      ? `<span class="con-fld__src">scrape: ${esc(edited[k])}</span>`
      : "";
  const fld = (name: string, label: string, value: unknown, type = "text", ph = "", span = 1) =>
    `<div class="con-fld"${span > 1 ? ` style="grid-column:span ${span}"` : ""}>
       <label class="con-fld__l" for="ed-${name}">${esc(label)}</label>
       <input id="ed-${name}" name="${name}" type="${type}" value="${value ? esc(value) : ""}"
              placeholder="${esc(ph)}">
       ${orig(name)}
     </div>`;

  // The website field carries an open-in-new-tab affordance: judging "is this
  // really their site?" means LOOKING at it, and retyping the URL is friction
  // that makes the operator skip the check.
  // Always present, and it opens WHAT IS IN THE FIELD — not only what was saved
  // earlier. An operator who just pasted a URL wants to check it before saving,
  // and the button vanishing whenever the lead has no stored site read as a bug.
  const openSite = `<button type="button" class="con-open" onclick="citOpenSite(this)"
        title="${T(lang, "Beírt honlap megnyitása új lapon")}" aria-label="${T(lang, "Beírt honlap megnyitása új lapon")}">${ic("external", 16)}</button>`;

  const sources = raw.sources?.length
    ? raw.sources
        .map((s) => sourceLink(s, raw.sourceRefs?.[s], raw.lat, raw.lon))
        .join(" ")
    : `<span class="mut">–</span>`;

  return `<div class="panel">
      <h2>${T(lang, "Begyűjtött adatok — szerkeszthető")}${rawAny.curatorEditedAt ? ` <span class="pill">${T(lang, "szerkesztve")}</span>` : ""}</h2>
      <p class="small mut" style="margin:4px 0 14px">Pótolható a hiányzó ÉS javítható a meglévő; a mentett érték a következő mock-generáláskor érvényesül. Üres mező = törlés.
        A <b>${T(lang, "város")}</b> ${T(lang, "egyben a honlap-ellenőrzés horgonya — javítsd, ha rossz, és az újragyűjtés pontosabban talál.")}</p>
      <form method="post" action="/lead/${esc(d.id)}/data"
            onsubmit="${esc(`var b=this.querySelector('button[type=submit]');b.disabled=true;b.textContent='${jsStr(T(lang, "Mentés…"))}'`)}">
        <div class="con-edit-grid">
          ${fld("name", T(lang, "Név"), d.name)}
          ${fld("phone", "Telefon", raw.phone, "text", "+36 …")}
          ${fld("email", "E-mail", raw.email, "email", "pl. info@szallas.hu")}
          ${fld("country", T(lang, "Ország"), raw.country, "text", "HU")}
          ${fld("city", T(lang, "Város"), raw.city, "text", T(lang, "pl. Balatonberény"))}
          ${fld("address", T(lang, "Cím"), d.address ?? (raw as { address?: string }).address, "text", T(lang, "irsz., utca, házszám"))}
          <div class="con-edit-site" style="grid-column:1/-1">
            ${fld("website", "Honlap", raw.website, "url", "https://…")}
            ${openSite}
          </div>
        </div>
        <div class="row" style="margin-top:12px">
          <button type="submit">${T(lang, "Adatok mentése")}</button>
        </div>
      </form>

      <h3 class="con-facts__h">${T(lang, "Minősítés és forrás")}</h3>
      <div class="con-fact-grid">
        ${fact(T(lang, "Honlap-státusz"), raw.websiteStatus ? esc(raw.websiteStatus) : `<span class="mut">–</span>`)}
        ${fact("Kontakt-csatorna", String(val(raw.contactChannel)))}
        ${fact(
          T(lang, "Koordináta"),
          raw.lat != null && raw.lon != null
            ? `<a href="https://www.google.com/maps?q=${raw.lat},${raw.lon}" target="_blank" rel="noopener">${raw.lat.toFixed(5)}, ${raw.lon.toFixed(5)}</a>`
            : `<span class="mut">–</span>`,
        )}
        ${fact(T(lang, "Források"), sources)}
        ${fact(
          "Anyag",
          T(lang, "{total} kép — Places: {places} · honlap: {web} · Street View: {sv}", { total: val(mat.totalImages), places: val(mat.placesPhotos), web: val(mat.websiteImages), sv: yesNo(mat.streetView) }),
          true,
        )}
      </div>
      ${assessment}
      ${reenrichForm(d)}
    </div>`;
}

/**
 * WHERE THE DATA CAME FROM — the contact ledger + the portal pages that describe
 * this lead. Its own panel (and its own tab) because it answers a DIFFERENT
 * question than the editable data card: not "what do we hold", but "where did it
 * come from and what did the filter throw away". Both blocks stay empty-safe.
 */
function leadContactsPanel(d: LeadDetail): string {
  const lang = consoleLang();
  const raw = (d.raw ?? {}) as {
    email?: string;
    phone?: string;
    contacts?: ContactCandidate[];
    listings?: PortalListing[];
  };
  const ledger = contactLedgerBlock(raw.contacts, raw.email, raw.phone);
  const listings = listingsBlock(raw.listings);
  return `<div class="panel">
      <h2>${T(lang, "Elérhetőségek és források")}</h2>
      ${
        ledger || listings
          ? `${ledger}${listings}`
          : `<p class="mut">Ehhez a leadhez még nincs rögzített elérhetőség-jelölt vagy portál-találat.
             Futtasd az <b>${T(lang, "Adatok újragyűjtése")}</b> ${T(lang, "gombot az Adatok fülön.")}</p>`
      }
    </div>`;
}

/**
 * CONTACT LEDGER — every address/number ever seen, with source and verdict.
 *
 * Shows the DROPS too, with the reason. The accept/reject rules are judgement
 * calls (corroboration, office-address and template filters, the shared-number
 * guard) and they have been wrong in both directions; hiding what they discard
 * leaves the operator unable to tell "nothing exists" from "we threw the right
 * one away". It is also the raw material for ranking rules later — which are to
 * be set from outreach RESULTS, not guessed now.
 */
function contactLedgerBlock(
  contacts: readonly ContactCandidate[] | undefined,
  primaryEmail?: string,
  primaryPhone?: string,
): string {
  const lang = consoleLang();
  if (!contacts?.length) return "";
  const order = (c: ContactCandidate): number =>
    (c.value === primaryEmail || c.value === primaryPhone ? 0 : c.accepted ? 1 : 2);
  const rows = [...contacts]
    .sort((a, b) => order(a) - order(b) || a.kind.localeCompare(b.kind))
    .map((c) => {
      const isPrimary = c.value === primaryEmail || c.value === primaryPhone;
      const mark = isPrimary
        ? `<span class="pill con-ledger__use" title="${T(lang, "Ezt használjuk megkereséskor")}">${T(lang, "használt")}</span>`
        : c.accepted
          ? `<span class="pill con-ledger__ok" title="${T(lang, "Átment a minőség-ellenőrzésen, tartalék")}">rendben</span>`
          : `<span class="pill con-ledger__no" title="${esc(c.rejectedReason ?? "elvetve")}">elvetve</span>`;
      const href =
        c.kind === "email" ? `mailto:${encodeURIComponent(c.value)}` : `tel:${c.value.replace(/\s/g, "")}`;
      const src = c.sourceUrl
        ? `<a href="${esc(c.sourceUrl)}" target="_blank" rel="noopener">${esc(c.source)}${ic("external", 11)}</a>`
        : esc(c.source);
      return `<tr class="${c.accepted ? "" : "con-ledger__row--out"}">
        <td>${c.kind === "email" ? "e-mail" : "telefon"}</td>
        <td><a href="${esc(href)}">${esc(c.value)}</a></td>
        <td class="small">${src}</td>
        <td>${mark}</td>
        <td class="small mut">${esc(c.rejectedReason ?? "")}</td>
      </tr>`;
    })
    .join("");
  const dropped = contacts.filter((c) => !c.accepted).length;
  return `<h3 class="con-facts__h">${T(lang, "Talált elérhetőségek — forrás szerint ({n})", { n: contacts.length })}</h3>
    <p class="small mut" style="margin:0 0 8px">Minden megtalált adat itt marad, az elvetettek is —
      így látod, mit dobott el a szűrő és miért${dropped ? `; most ${dropped} ilyen van` : ""}.
      A rangsorolás szabályait a valós kiküldés-eredményekből állítjuk majd fel.</p>
    <div class="tblwrap"><table class="con-ledger">
      <thead><tr><th>${T(lang, "Típus")}</th><th>${T(lang, "Érték")}</th><th>${T(lang, "Forrás")}</th><th>${T(lang, "Állapot")}</th><th>${T(lang, "Megjegyzés")}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

/**
 * DIGITAL FOOTPRINT — the portal/catalogue pages that describe this business.
 *
 * Three jobs at once: the curator confirms at a glance that we found the RIGHT
 * business (open the page, compare), these pages are the richest free source of
 * facts and contact details, and the sales case is written on them — the owner
 * is scattered across other people's pages instead of owning their presence.
 *
 * Deliberately NOT presented as "websites": the lead does not control these,
 * which is exactly why it stays a target (§F).
 */
function listingsBlock(listings?: readonly PortalListing[]): string {
  const lang = consoleLang();
  if (!listings?.length) return "";
  const rows = listings
    .map((l) => {
      let host = l.url;
      try {
        host = new URL(l.url).hostname.replace(/^www\./, "");
      } catch {
        /* keep the raw string — still openable */
      }
      const badge = l.verified
        ? `<span class="pill con-listing__ok" title="${T(lang, "Ezt az oldalt beolvastuk és a lead adatai stimmeltek")}">${T(lang, "ellenőrizve")}</span>`
        : "";
      return `<li class="con-listing">
        <a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(host)}${ic("external", 12)}</a>
        <span class="con-listing__t mut small">${esc(l.title)}</span>${badge}
      </li>`;
    })
    .join("");
  return `<h3 class="con-facts__h">${T(lang, "Hol találtuk meg — portál-jelenlét ({n})", { n: listings.length })}</h3>
    <p class="small mut" style="margin:0 0 8px">Mások oldalain szerepel, nem a sajátján — ezek a lapok
      egyben a legjobb ingyenes adatforrások, és pontosan ezt az érvet adják a megkereséshez.</p>
    <ul class="con-listings">${rows}</ul>`;
}

/** The lead's real photos, loaded on demand (a Places lookup costs money, so it
 *  happens only when an operator actually opens the lead). */
function leadPhotosPanel(leadId: string): string {
  const lang = consoleLang();
  return `<div class="panel">
      <h2>${T(lang, "Fotók")}</h2>
      <div id="leadPhotos" class="lead-photos"></div>
      <p id="photoMsg" class="mut small" style="margin:10px 0 0">${T(lang, "Fotók betöltése…")}</p>
      <form method="post" action="/lead/${esc(leadId)}/rescrape-photos" class="con-reenrich"
        style="margin-top:12px"
        onsubmit="${esc(`var b=this.querySelector('button');b.disabled=true;b.textContent='${jsStr(T(lang, "Fotók újra-scrapelése folyamatban…"))}'`)}">
        <button type="submit" class="ghost">${ic("scrape", 15)} ${T(lang, "Portál-fotók újra-scrapelése")}</button>
        <p class="mut small" style="margin:6px 0 0">${T(lang, "Újra beolvassa a portál-adatlap fotóit; a már kiküldött mockot nem írja felül.")}</p>
      </form>
      <script>
        fetch('/lead/${esc(leadId)}/photos')
          .then(function (r) { return r.json(); })
          .then(function (d) {
            var box = document.getElementById('leadPhotos');
            var msg = document.getElementById('photoMsg');
            if (!d.photos || !d.photos.length) { msg.textContent = 'Ehhez a leadhez nem találtunk fotót.'; return; }
            // The photos are a SET the operator compares (is this really their
            // place? is there a usable hero shot?) — so they open as a gallery,
            // not as separate tabs that lose the set.
            // The source is part of what the operator judges (a portal listing image is
            // the owner's own marketing shot; a Places one is usually a guest snapshot),
            // so the rights class rides along into the caption.
            var srcLabel = { portal: 'portál-adatlap', places: 'Google Places', streetview: 'Street View', owner: 'tulaj', guest: 'vendég', generated: 'generált' };
            window.citLeadPhotos = d.photos.map(function (p, k) {
              return { src: p.url, cap: 'Fotó ' + (k + 1) + ' · ' + (srcLabel[p.provenance] || p.provenance || 'ismeretlen forrás') };
            });
            box.innerHTML = d.photos.map(function (p, k) {
              return '<a href="' + p.url + '" onclick="event.preventDefault();citLb.open(window.citLeadPhotos,' + k + ')"'
                + ' title="${T(lang, "' + (srcLabel[p.provenance] || 'ismeretlen forrás') + ' — nagyban megnézem, nyilakkal léphetsz")}">'
                + '<img src="' + p.url + '" loading="lazy" alt=""></a>';
            }).join('');
            var nPortal = d.photos.filter(function (p) { return p.provenance === 'portal'; }).length;
            msg.textContent = d.photos.length + ' fotó'
              + (nPortal ? ' (' + nPortal + ' portál-adatlapról)' : '')
              + (d.rating ? ' · Google-értékelés: ' + d.rating + '★' + (d.ratingCount ? ' (' + d.ratingCount + ')' : '') : '') +
              (d.band ? ' · match: ' + d.band : '');
          })
          .catch(function () { document.getElementById('photoMsg').textContent = 'A fotók betöltése nem sikerült.'; });
      </script>
    </div>`;
}

/** Operator ruling: rule the lead out (or undo it). Lead page only. */
function disqualifyPanel(d: LeadDetail): string {
  const lang = consoleLang();
  const raw = (d.raw ?? {}) as { disqualifiedReason?: string };
  if (d.lifecycle === "disqualified") {
    return `<div class="panel">
        <h2>${T(lang, "Diszkvalifikálva")}</h2>
        <p class="mut">${T(lang, "Ez a lead ki van zárva a megkeresésből")}${raw.disqualifiedReason ? ` — <b>${esc(raw.disqualifiedReason)}</b>` : ""}.</p>
        <form method="post" action="/lead/${esc(d.id)}/requalify">
          <button type="submit">${T(lang, "Visszaállítás")}</button>
        </form>
      </div>`;
  }
  const reasons = [
    T(lang, "nem célcsoport"), T(lang, "bezárt / nem működik"), T(lang, "lánc vagy nagyvállalat"),
    T(lang, "hibás adat / nem valós hely"), T(lang, "duplikátum"), T(lang, "kérte, hogy ne keressük"),
  ];
  return `<div class="panel">
      <h2>${T(lang, "Diszkvalifikálás")}</h2>
      <p class="mut small" style="margin-top:0">A lead kikerül a megkeresésből, de megmarad —
        egy újabb scrape sem hozza vissza a munkába.</p>
      <form method="post" action="/lead/${esc(d.id)}/disqualify" class="row" style="gap:8px;flex-wrap:wrap">
        <select name="reason">${reasons.map((r) => `<option value="${esc(r)}">${esc(r)}</option>`).join("")}</select>
        <button class="bad" type="submit">${T(lang, "Diszkvalifikálás")}</button>
      </form>
    </div>`;
}

/** Template picker as a CARD GRID (ADR-0027: the CURATOR picks the art direction — not the
 *  AI). MULTI-SELECT (checkbox): the curator can pick SEVERAL looks at once and each gets its
 *  own generated mock. Each card = a selectable look with its preview thumbnail + short name.
 *  Cards come from the engine registry (single source). The full label stays as the tooltip. */
function templateCards(selected = "fullbleed"): string {
  const lang = consoleLang();
  return Object.values(TEMPLATES)
    .map((t) => {
      // Short name = the label's first segment before an em-dash/colon (the registry label is
      // "Név — hosszú leírás (referencia N)"); fall back to the id.
      const short = (t.label.split(/[—:(]/)[0] ?? t.id).trim() || t.id;
      const on = t.id === selected;
      // The WHOLE card toggles (thumbnail included) — the primary act here is CHOOSING.
      // Zooming is the secondary act, so it gets its own button; a <button> inside a
      // <label> does not activate the label (interactive content), so the two never clash.
      return `<label class="tpl-card${on ? " on" : ""}" title="${esc(t.label)}">
        <input type="checkbox" name="template" value="${esc(t.id)}"${on ? " checked" : ""} onchange="citTplPick(this)">
        <img src="/assets/ui/tpl-${esc(t.id)}.jpg" alt="${esc(short)}" loading="lazy">
        <button type="button" class="tpl-card__zoom" title="${T(lang, "Nagyban megnézem — nyilakkal léphetsz a többire")}"
                aria-label="${esc(short)} ${T(lang, "— nagyban megnézem")}"
                onclick="event.preventDefault();event.stopPropagation();citTplGallery('${esc(t.id)}')">${ic("zoom", 15)}</button>
        <span class="tpl-card__name">${esc(short)}</span>
      </label>`;
    })
    .join("");
}

/** Post/Redirect/Get outcome banner (re-enrich result). */
export interface LeadFlash {
  readonly message: string;
  readonly ok: boolean;
}

export function leadPage(
  d: LeadDetail,
  generating = false,
  conversion: ConversionView | null = null,
  orders: OrderIntentView[] = [],
  payments: PaymentView[] = [],
  prospects: ProspectView[] = [],
  flash: LeadFlash | null = null,
): string {
  const lang = consoleLang();
  const prov = d.provenance.length
    ? `<div class="tblwrap"><table><thead><tr><th>${T(lang, "Mező")}</th><th>${T(lang, "Érték")}</th><th>${T(lang, "Forrás")}</th><th>Konf.</th></tr></thead>
       <tbody>${d.provenance
         .map(
           (p) => `<tr><td>${esc(p.field)}</td><td class="small">${esc(p.value)}</td>
           <td class="small mut">${esc(p.source)}</td><td>${confCell(p.confidence)}</td></tr>`,
         )
         .join("")}</tbody></table></div>`
    : `<p class="mut small">Nincs provenance-rekord.</p>`;

  // Conversion modules come from the OWNER's configurator choice (order intent),
  // not an operator pick; ALL-IN when they haven't configured yet. Same resolution
  // as the server-side convert handler (single source: modulesForConversion).
  const convertModules = modulesForConversion(orders);
  const chosenOrder = orders.find((o) => o.status === "submitted") ?? orders[0];
  const convertFromOrder = !!(chosenOrder && chosenOrder.modules.length);

  // A mock is house-side (safe to delete) while approved, NOT sent to the lead, and
  // not backing a PUBLICLY LIVE (payment-gated) site — mirrors isArtifactDeletable.
  // A provisioned/draft site is only a private preview: it does NOT protect the mock,
  // and gets torn down together with it (owner decree 2026-08-29).
  const sentArtifactIds = new Set(prospects.filter((p) => p.sentAt).map((p) => p.artifactId));
  const LIVE_SITE_STATES = ["live", "suspended", "deactivated"];
  /**
   * The measured AI spend of one generation (src/ai/usage.ts writes it into inputs.aiUsage).
   * Rendered EXPLICITLY because the scalar meta line below drops every object value — the
   * number would sit in the database and stay invisible on screen, which is how "measured"
   * silently turns back into "still can't see it". Amounts are USD: that is what Anthropic
   * bills, and a forint figure would need an invented rate (owner ruling, 2026-08-29).
   */
  const renderAiCost = (raw: unknown): string => {
    if (typeof raw !== "object" || raw === null) return "";
    const u = raw as {
      calls?: number;
      inputTokens?: number;
      outputTokens?: number;
      cacheReadTokens?: number;
      cacheWriteTokens?: number;
      costUsd?: number;
      unpricedCalls?: number;
      byStep?: Record<string, { calls: number; costUsd: number }>;
    };
    if (typeof u.costUsd !== "number" || !u.calls) return "";
    const inTok = (u.inputTokens ?? 0) + (u.cacheReadTokens ?? 0) + (u.cacheWriteTokens ?? 0);
    // Hover detail: which step cost what — so an expensive generation is explainable
    // without opening a terminal.
    const steps = Object.entries(u.byStep ?? {})
      .sort((x, y) => y[1].costUsd - x[1].costUsd)
      .map(([name, s]) => `${name}: $${s.costUsd.toFixed(4)} (${s.calls}×)`)
      .join(" · ");
    const warn = u.unpricedCalls
      ? ` · ${T(lang, "⚠️ {n} árazatlan hívás", { n: u.unpricedCalls })}`
      : "";
    return `<div class="small mut" style="margin-top:4px" title="${esc(steps)}">${T(
      lang,
      "AI-költség: {calls} hívás · {in} be / {out} ki token · ${usd}",
      {
        calls: u.calls,
        in: inTok.toLocaleString("hu-HU"),
        out: (u.outputTokens ?? 0).toLocaleString("hu-HU"),
        usd: u.costUsd.toFixed(4),
      },
    )}${warn}</div>`;
  };
  const renderArtifact = (a: LeadDetail["artifacts"][number]): string => {
          const dec = a.decisions[0];
          const curated = a.status === "approved" || a.status === "rejected";
          const ownPreview = !!conversion && conversion.sourceArtifactId === a.id;
          const publiclyLive = ownPreview && LIVE_SITE_STATES.includes(conversion.siteStatus);
          const deletable =
            a.status === "approved" && !sentArtifactIds.has(a.id) && !publiclyLive;
          // A private (provisioned/draft) preview of THIS mock will be removed with it.
          const removesPreview = ownPreview && !publiclyLive;
          // Scalar metadata only — skip the engine artifact's recipe/siteData blobs.
          const inputs = Object.entries(a.inputs)
            .filter(([, v]) => v === null || typeof v !== "object")
            .map(([k, v]) => `${esc(k)}=${esc(v)}`)
            .join(" · ");
          return `<div class="panel" id="a-${esc(a.id)}">
            <div class="row">
              <span class="pill ${esc(a.status)}">${esc(a.status)}</span>
              <span class="mut small">${esc(a.generatedAt.slice(0, 16).replace("T", " "))}</span>
              ${a.path ? `<a class="small" href="/mock/${esc(a.id)}" target="_blank">${T(lang, "előnézet ▸")}</a>` : ""}
              ${a.path ? `<a class="small" href="/configure/${esc(a.id)}" target="_blank">${T(lang, "prospect-konfigurátor ▸")}</a>` : ""}
            </div>
            <div class="small mut" style="margin-top:8px">${inputs}</div>
            ${renderAiCost(a.inputs.aiUsage)}
            ${
              dec
                ? `<div class="small" style="margin-top:8px">${T(lang, "Döntés:")} <b>${esc(dec.decision)}</b>
                   ${dec.notes ? `— ${esc(dec.notes)}` : ""}
                   <span class="mut">(${esc(dec.decidedBy)}, ${esc(dec.decidedAt.slice(0, 16).replace("T", " "))})</span></div>`
                : ""
            }
            ${
              curated
                ? ""
                : `<div class="row">
                   <form method="post" action="/artifact/${esc(a.id)}/curate">
                     <input type="hidden" name="decision" value="approve">
                     <button class="ok" type="submit">${T(lang, "Jóváhagyás")}</button></form>
                   <form method="post" action="/artifact/${esc(a.id)}/curate">
                     <input type="hidden" name="decision" value="reject">
                     <button class="bad" type="submit">${T(lang, "Elutasítás")}</button></form>
                 </div>`
            }
            ${
              a.status === "approved"
                ? conversion && conversion.sourceArtifactId === a.id
                  ? convertedBlock(conversion)
                  : convertForm(d.id, a.id, convertModules, convertFromOrder)
                : ""
            }
            ${
              deletable
                ? `<form method="post" action="/artifact/${esc(a.id)}/delete" style="margin-top:10px"
                         onsubmit="return confirm('${
                           removesPreview
                             ? T(lang, "Biztosan törlöd ezt a jóváhagyott mockot? Még nem küldtük ki. A privát ELŐNÉZET is megszűnik (oldal + hozzáférés). A művelet nem vonható vissza.")
                             : T(lang, "Biztosan törlöd ezt a jóváhagyott mockot? Még nem küldtük ki, a művelet nem vonható vissza.")
                         }')">
                     <button class="bad small" type="submit">${T(lang, "Mock törlése")}</button>
                     <span class="mut small" style="margin-left:8px">${
                       removesPreview
                         ? T(lang, "a privát előnézet is törlődik")
                         : T(lang, "csak ki nem küldött mock törölhető")
                     }</span>
                   </form>`
                : ""
            }
          </div>`;
  };

  // Split rejected mocks out of the main flow: the active/pending ones stay expanded, the
  // rejected ones collapse into a single foldable group (keeps the working list clean).
  const rejected = d.artifacts.filter((a) => a.status === "rejected");
  const active = d.artifacts.filter((a) => a.status !== "rejected");
  const rejectedBlock = rejected.length
    ? `<details class="panel" style="margin-top:0">
         <summary style="cursor:pointer;font-weight:600">${T(lang, "Elutasított mockok ({n}) — kibontás", { n: rejected.length })}</summary>
         <div style="margin-top:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:12px">${rejected.map(renderArtifact).join("")}</div>
       </details>`
    : "";
  const artifacts = d.artifacts.length
    ? `${active.map(renderArtifact).join("")}${rejectedBlock}`
    : `<div class="panel"><p class="mut">${T(lang, "Még nincs generált mock ehhez a leadhez.")}</p></div>`;

  // IDENTITY BAND — everything the operator must know BEFORE choosing a tab, on
  // one dark band: who is this, how sure is the match (the single number that
  // gates every downstream action, so it gets the big-metric slot), what state
  // are the mock/outreach in, and the plain contact facts.
  const latestMock = active[0] ?? d.artifacts[0];
  const sentCount = prospects.filter((p) => p.sentAt).length;
  const head = (d.raw ?? {}) as {
    country?: string;
    city?: string;
    website?: string;
    phone?: string;
    email?: string;
  };
  const conf =
    d.matchConfidence == null
      ? `<span class="mut">–</span>`
      : `${Math.round(d.matchConfidence * 100)}%`;
  const subtitle = [head.city, d.region].filter(Boolean).join(" · ");
  const heroPanel = `
    <div class="con-lhead">
      <div class="con-lhead__band">
        <div class="con-lhead__mark" aria-hidden="true">${esc(initials(d.name))}</div>
        <div class="con-lhead__id">
          <h1>${esc(d.name)}</h1>
          ${subtitle ? `<div class="con-lhead__sub">${esc(subtitle)}</div>` : ""}
        </div>
        <div class="con-lhead__metric">
          <div class="con-lhead__big">${conf}</div>
          <div class="con-lhead__lbl">Match-konfidencia</div>
        </div>
      </div>
      <div class="con-lhead__pills">
        ${d.lifecycle === "disqualified" ? disqualifiedBadge() : qualBadge(d.qualification)}
        ${
          latestMock
            ? `<span class="pill ${esc(latestMock.status)}">mock: ${esc(latestMock.status)}</span>`
            : `<span class="pill">nincs mock</span>`
        }
        ${
          prospects.length
            ? `<span class="pill${sentCount ? " approved" : ""}">${T(lang, "{n} megkeresés", { n: prospects.length })}${sentCount ? T(lang, " · kiküldve") : T(lang, " · még nem ment ki")}</span>`
            : `<span class="pill">${T(lang, "nincs megkeresés")}</span>`
        }
        ${helpLink("console.lead")}
      </div>
      <dl class="con-lead-facts">
        <div><dt>${T(lang, "Ország")}</dt><dd>${head.country ? esc(head.country) : `<span class="mut">–</span>`}</dd></div>
        <div><dt>${T(lang, "Város")}</dt><dd>${head.city ? esc(head.city) : `<span class="mut">–</span>`}</dd></div>
        <div><dt>${T(lang, "Régió")}</dt><dd>${esc(d.region)}</dd></div>
        <div><dt>${T(lang, "Cím")}</dt><dd>${d.address ? esc(d.address) : `<span class="mut">–</span>`}</dd></div>
        <div><dt>Honlap</dt><dd>${
          head.website
            ? `<a href="${esc(head.website)}" target="_blank" rel="noopener" class="con-src">${esc(hostOf(head.website))}${ic("external", 13)}</a>`
            : `<span class="mut">nincs</span>`
        }</dd></div>
        <div><dt>Telefon</dt><dd>${
          head.phone ? `<a href="tel:${esc(head.phone.replace(/\s/g, ""))}">${esc(head.phone)}</a>` : `<span class="mut">–</span>`
        }</dd></div>
        <div><dt>E-mail</dt><dd>${
          head.email ? `<a href="mailto:${esc(head.email)}">${esc(head.email)}</a>` : `<span class="mut">–</span>`
        }</dd></div>
      </dl>
    </div>`;
/**
 * THE GENERATED SELLING COPY, READABLE IN THE CONSOLE (approved plan 2026-08-31 —
 * assets/design-refs/console/copy-panel.html + README.md).
 *
 * WHY: until now the copy existed only inside the rendered mock file, so the only way to
 * see what the engine had written was to open the page. That is how "Fenyőillatú csend a
 * tető alatt" could go out as a cold acquisition asset for a property whose own listing
 * advertises a playground, a garden and a private car park: there was nowhere to notice it.
 *
 * The panel therefore does not just PRINT the copy — it sets it against what the property's
 * own verified listing says it offers, because the failure was never what the copy said,
 * it was what the copy left out. The "not mentioned" chips write into the existing
 * curator-prompt box below, so noticing and acting are one gesture.
 */
function mockCopyPanel(a: ArtifactView | undefined, lang: string): string {
  if (!a) return "";
  const inputs = a.inputs as Record<string, unknown>;
  const site = (inputs.siteData ?? {}) as Record<string, unknown>;
  const recipe = (inputs.recipe ?? {}) as { sections?: { kind?: string; copy?: Record<string, string> }[] };
  const hero = recipe.sections?.find((x) => x.kind === "hero")?.copy ?? {};
  const highlights = Array.isArray(site.highlights) ? (site.highlights as string[]) : [];
  const tagline = typeof site.tagline === "string" ? site.tagline : "";
  const intro = typeof site.intro === "string" ? site.intro : "";
  // Nothing to show for pre-2026-08-31 artifacts (the copy predates the panel).
  if (!hero.lead && !tagline && !highlights.length) return "";

  const named = Array.isArray(inputs.marketFactsNamed) ? (inputs.marketFactsNamed as string[]) : [];
  const missedRaw = Array.isArray(inputs.marketMissed) ? (inputs.marketMissed as string[]) : [];
  // The raw lists are redundant ("WIFI" / "Wifi a közösségi terekben" / "Internetkapcsolat"),
  // so both the chips AND the counts run on grouped items — otherwise the number lies.
  const usedGroups = groupAmenities(named);
  const missGroups = groupAmenities(missedRaw);
  const total = typeof inputs.marketAmenityTotal === "number" ? inputs.marketAmenityTotal : null;

  // The hero lead renders its italic accent exactly as the page does.
  const leadHtml = ((): string => {
    const lead = hero.lead ?? "";
    const acc = hero.accent ?? "";
    if (!acc || !lead.includes(acc)) return esc(lead);
    const i = lead.indexOf(acc);
    return `${esc(lead.slice(0, i))}<em>${esc(acc)}</em>${esc(lead.slice(i + acc.length))}`;
  })();

  const verdict = (key: string, label: string, why: unknown): string => {
    const v = inputs[key];
    if (v !== "pass" && v !== "flag" && v !== "error") return "";
    const ok = v === "pass";
    const txt = typeof why === "string" && why ? why : "";
    const id = `cpw-${key}`;
    return `<button type="button" class="cp-v ${ok ? "ok" : "bad"}" data-why="${id}">
        <span class="cp-dot"></span>${esc(label)}: ${ok ? T(lang, "átment") : v === "flag" ? T(lang, "fennakadt") : T(lang, "nem ítélhető")}
      </button>${txt ? `<div class="cp-why" id="${id}">${esc(txt)}</div>` : ""}`;
  };
  const fUnsourced = Array.isArray(inputs.factUnsourced) ? (inputs.factUnsourced as string[]) : [];
  const vMarket = verdict("marketVerdict", T(lang, "Marketing-őr"), inputs.marketReason);
  const vFact = verdict(
    "factVerdict",
    T(lang, "Tényhűség"),
    fUnsourced.length ? T(lang, "Forrás nélküli állítás: {list}", { list: fUnsourced.join(", ") }) : "",
  );
  // The reason blocks must sit AFTER both pills, not between them.
  const pills = [vMarket, vFact].map((h) => h.split("</button>")[0] + "</button>").filter((h) => h !== "</button>");
  const whys = [vMarket, vFact].map((h) => h.split("</button>")[1] ?? "").join("");

  const chip = (g: { label: string; items: string[] }, kind: "used" | "miss"): string =>
    kind === "used"
      ? `<span class="cp-chip used" title="${esc(g.items.join(" · "))}">${esc(g.label)}</span>`
      : `<button type="button" class="cp-chip miss" aria-pressed="false"
           data-t="${esc(g.label.toLowerCase())}" title="${esc(g.items.join(" · "))}"><span class="cp-pl">+</span>${esc(g.label)}</button>`;

  const scale = usedGroups.length || missGroups.length
    ? `<div class="cp-scale">
         <div class="cp-cell"><span class="cp-n good">${usedGroups.length}</span><span class="cp-t">${
           total
             ? T(lang, "szolgáltatást használ fel<br>a hirdetés {n}-ból", { n: total })
             : T(lang, "szolgáltatást nevez meg<br>a hirdetéséből")
         }</span></div>
         ${
           missGroups.length
             ? `<div class="cp-sep"></div>
                <div class="cp-cell"><span class="cp-n miss">${missGroups.length}</span><span class="cp-t">${T(lang, "dolgot a hirdetéséből<br>nem említ")}</span></div>`
             : ""
         }
       </div>`
    : "";

  const tick = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 5"/></svg>`;

  return `
    <div class="panel cp-panel">
      <h2>${T(lang, "A mock szövege")}</h2>
      <p class="small mut" style="margin:0 0 12px">${T(lang, "Ezt olvassa a szálláshely tulajdonosa, amikor megnyitja a mockot.")}</p>
      ${scale}
      ${pills.length ? `<div class="cp-verdicts">${pills.join("")}</div>${whys}` : ""}
      <div class="cp-cols">
        <div>
          <div class="cp-doc">
            ${hero.eyebrow ? `<p class="cp-eyebrow">${esc(hero.eyebrow)}</p>` : ""}
            ${leadHtml ? `<p class="cp-lead">${leadHtml}</p>` : ""}
            ${tagline ? `<p class="cp-tag">${esc(tagline)}</p>` : ""}
            ${intro ? `<p class="cp-intro">${esc(intro)}</p>` : ""}
            ${
              highlights.length
                ? `<ul class="cp-hl">${highlights.map((h) => `<li>${tick}${esc(h)}</li>`).join("")}</ul>`
                : ""
            }
          </div>
          ${
            usedGroups.length
              ? `<div class="cp-doc" style="margin-top:10px">
                   <p class="small mut" style="margin:0 0 8px;font-weight:700;text-transform:uppercase;letter-spacing:.08em">${T(lang, "Ezeket a hirdetésből eladja")}</p>
                   <div class="cp-chips">${usedGroups.map((g) => chip(g, "used")).join("")}</div>
                 </div>`
              : ""
          }
        </div>
        ${
          missGroups.length
            ? `<div class="cp-doc">
                 <p class="small mut" style="margin:0 0 8px;font-weight:700;text-transform:uppercase;letter-spacing:.08em">${T(lang, "Ezeket nem említi — koppintson, hogy bekerüljön")}</p>
                 <div class="cp-chips" id="cp-miss">${missGroups.map((g) => chip(g, "miss")).join("")}</div>
                 <p class="cp-hint">${T(lang, "Ezek benne vannak a szállás hirdetésében, de a szövegből kimaradtak. A koppintás beírja őket az alábbi utasításba — nem cseréli le a szöveget magától.")}</p>
               </div>`
            : ""
        }
      </div>
      <form method="post" action="/artifact/${esc(a.id)}/recopy" class="cp-doc" style="margin-top:12px"
            onsubmit="${esc(`var b=this.querySelector('button');b.disabled=true;b.textContent='${jsStr(T(lang, "Szöveg készül… (~1 perc)"))}'`)}">
        <p class="small mut" style="margin:0 0 8px;font-weight:700;text-transform:uppercase;letter-spacing:.08em">${T(lang, "Csak a szöveg újragenerálása")}</p>
        <textarea id="cp-in" name="recopyPrompt" rows="3" maxlength="600"
          placeholder="${T(lang, "Mit csináljon másképp? (elhagyható — vagy koppintson a fenti pontokra)")}"
          style="width:100%;padding:8px 10px;font-family:inherit;font-size:13px"></textarea>
        <p class="small mut" id="cp-count" style="text-align:right;margin:4px 0 8px">0 / 600</p>
        <button class="gen-go" type="submit">${T(lang, "Szöveg újragenerálása")}</button>
        <p class="cp-hint">${T(lang, "A kinézet, a fotók és az elrendezés VÁLTOZATLAN marad — csak a szöveg születik újra, és az őrök arra is lefutnak. Már kiküldött mockot nem ír át.")}</p>
      </form>
    </div>
    <script>${cpScript(T(lang, "Emeld be a szövegbe: "))}</script>`;
}

/** Chip → curator-prompt wiring. Contract: hand-typed text survives, several chips join
 *  ONE instruction line, and un-tapping removes only that item. */
function cpScript(prefix: string): string {
  // The panel is emitted ABOVE the generate form, so #cp-in does not exist yet when this
  // script is parsed — wire up after the document is built, or every chip is a dead button.
  return `document.addEventListener('DOMContentLoaded',function(){
    var P=${JSON.stringify(prefix)};
    var box=document.getElementById('cp-in');
    document.querySelectorAll('.cp-v').forEach(function(b){
      b.addEventListener('click',function(){
        var w=document.getElementById(b.dataset.why); if(w) w.classList.toggle('open');
      });
    });
    var chips=[].slice.call(document.querySelectorAll('#cp-miss .cp-chip.miss'));
    if(!box||!chips.length) return;
    function rebuild(){
      var on=chips.filter(function(c){return c.getAttribute('aria-pressed')==='true'})
                  .map(function(c){return c.dataset.t});
      var manual=box.value.split('\\n').filter(function(l){return l.indexOf(P)!==0}).join('\\n').trim();
      var line=on.length?P+on.join(', ')+'.':'';
      box.value=[manual,line].filter(Boolean).join('\\n');
      var c=document.getElementById('cp-count');
      if(c){c.textContent=box.value.length+' / 600';}
    }
    chips.forEach(function(c){
      c.addEventListener('click',function(){
        c.setAttribute('aria-pressed',c.getAttribute('aria-pressed')==='true'?'false':'true');
        rebuild(); box.scrollIntoView({behavior:'smooth',block:'center'});
      });
    });
    box.addEventListener('input',function(){
      var c=document.getElementById('cp-count');
      if(c){c.textContent=box.value.length+' / 600';}
    });
  });`;
}

  // The generated selling copy, readable WITHOUT opening the mock (approved plan:
  // assets/design-refs/console/). Sits directly above the generate form so the
  // "not mentioned" chips and the instruction box they write into stay together.
  const copyPanel = mockCopyPanel(latestMock, lang);
  // Generate form is its OWN full-width panel with the preview BESIDE the controls,
  // so it stays short/wide instead of towering over the compact meta cards.
  const generatePanel = `
    <div class="panel">
      <h2>Mock ${d.artifacts.length ? T(lang, "újragenerálása") : T(lang, "generálása")}</h2>
      ${
        generating
          ? `<div class="row" style="margin-top:0"><span class="pill generated">${T(lang, "generálás folyamatban…")}</span>
             <span class="mut small">${T(lang, "~1-2 perc — az oldal automatikusan frissül")}</span></div>
             <script>setTimeout(function(){location.reload()},6000)</script>`
          : `<form method="post" action="/lead/${esc(d.id)}/generate"
                   onsubmit="${esc(`var b=this.querySelector('button.gen-go');b.disabled=true;b.textContent='${jsStr(T(lang, "Indítás…"))}'`)}">
               <div class="gen-2col">
                 <div class="gen-controls">
                   <label class="small mut" style="display:block;margin-bottom:6px">${T(lang, "Kinézet-típus — a kurátor dönt (ADR-0027): válaszd ki, melyik elrendezés(ek)re generáljuk a mockot — többet is jelölhetsz, mindegyikre külön mock készül")}</label>
                   <div class="tpl-cards" role="group" aria-label="${T(lang, "Kinézet-típus")}">
                     ${templateCards()}
                   </div>
                   <label class="small mut" for="gen-cp-in" style="display:block;margin:12px 0 4px">${T(lang, "Kurátor-prompt (opcionális — hangvétel/hangsúly; tényt nem adhat hozzá)")}</label>
                   <textarea id="gen-cp-in" name="curatorPrompt" rows="4" maxlength="600"
                     placeholder="${T(lang, "pl. családias, meleg hang; a borkóstolót és a teraszt emeld ki")}"
                     style="width:100%;padding:6px 8px;margin-bottom:10px;font-family:inherit;font-size:13px"></textarea>
                   <button class="gen-go" type="submit">Mock ${d.artifacts.length ? T(lang, "újragenerálása") : T(lang, "generálása")}</button>
                 </div>
                 <figure id="tpl-prev">
                   <img id="tpl-prev-img" src="/assets/ui/tpl-fullbleed-prev.jpg" alt="${T(lang, "Sablon-előnézet")}" onclick="citTplZoom()">
                   <figcaption class="small mut" style="margin-top:4px">${T(lang, "A kijelölt kinézet mintája (valós adattal) — kattints a nagyításhoz")}</figcaption>
                 </figure>
               </div>
             </form>`
      }
    </div>`;
  // Audit material folds away by default — it must be reachable, not in the way.
  const provPanel = `
    <details class="panel">
      <summary style="cursor:pointer;font-weight:600">Provenance (A4) — ${d.provenance.length} rekord</summary>
      <div style="margin-top:10px">${prov}</div>
    </details>`;

  const ordersPanel = orderIntentsPanel(orders, payments, d.id);
  const flashBanner = flash
    ? `<div class="con-flash ${flash.ok ? "ok" : "bad"}">${ic(flash.ok ? "check" : "alert", 16)}<span>${esc(flash.message)}</span></div>`
    : "";
  // DOSSIER TABS: the lead page carries seven unrelated jobs (fix the data,
  // generate, reach out, take money, look at photos, check sources, audit). As
  // one scroll they buried each other; as tabs each job gets the full width and
  // the operator sees at a glance WHICH ones have anything in them (the counts).
  const contactCount = ((d.raw ?? {}) as { contacts?: ContactCandidate[] }).contacts?.length ?? 0;
  const tabs: LeadTab[] = [
    { id: "ls-data", label: "Adatok", body: leadDataPanel(d) },
    {
      id: "ls-mocks",
      label: T(lang, "Mock és generálás"),
      count: active.length,
      body: `${copyPanel}${generatePanel}
        <h2 id="mock-artifacts" style="margin:14px 4px 10px">${T(lang, "Mock-artefaktumok")}${d.artifacts.length ? ` (${T(lang, "{n} aktív", { n: active.length })}${rejected.length ? ` · ${T(lang, "{n} elutasított", { n: rejected.length })}` : ""})` : ""}</h2>
        ${artifacts}`,
    },
    { id: "ls-outreach", label: T(lang, "Megkeresés"), count: prospects.length, body: prospectsPanel(prospects, d) },
    {
      id: "ls-orders",
      label: T(lang, "Csomag és fizetés"),
      count: orders.length,
      body:
        ordersPanel ||
        `<div class="panel"><h2>${T(lang, "Csomag-igények")}</h2>
           <p class="mut">A tulaj még nem konfigurált csomagot. Az igény a prospect-konfigurátorban
           (a megkeresés-linken) születik meg, és itt jelenik meg — fizetési kéréssel együtt.</p></div>`,
    },
    { id: "ls-photos", label: T(lang, "Fotók"), body: leadPhotosPanel(d.id) },
    { id: "ls-contacts", label: T(lang, "Elérhetőségek"), count: contactCount, body: leadContactsPanel(d) },
    { id: "ls-admin", label: "Audit", body: `${disqualifyPanel(d)}${provPanel}` },
  ];
  const body = `
    <a class="con-back" href="/leads"><span aria-hidden="true">←</span> Vissza a leadekhez</a>
    ${heroPanel}
    ${flashBanner}
    ${leadTabs(tabs)}
    ${galleryScript()}`;
  // The tab-hiding class goes on <html> from the HEAD, before the body paints —
  // otherwise every panel flashes on screen for a frame before the script hides them.
  return layout(d.name, body, {
    active: "/leads",
    head: `<script>document.documentElement.className+=" con-tabs-js"</script>`,
  });
}

/** Initials for the identity band's mark (max 2 words, letters only). */
function initials(name: string): string {
  const parts = name
    .split(/[\s-]+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0]![0]! + (parts[1]?.[0] ?? "")).toUpperCase();
}

interface LeadTab {
  readonly id: string;
  readonly label: string;
  /** Shown as a badge on the tab; 0 renders as a muted zero (present ≠ hidden). */
  readonly count?: number;
  readonly body: string;
}

/**
 * Dossier tab strip + sheet.
 *
 * The tabs are real anchors, so the page still works with JavaScript off (every
 * panel visible, the anchor jumps to it) and so the server's existing
 * redirect-with-hash routes keep landing on the right section. The script turns
 * them into a switcher and syncs the hash both ways.
 */
function leadTabs(tabs: readonly LeadTab[]): string {
  const lang = consoleLang();
  const bar = tabs
    .map(
      (t, i) =>
        `<a class="con-ltab${i === 0 ? " on" : ""}" href="#${esc(t.id)}" data-tab="${esc(t.id)}"
            role="tab" aria-selected="${i === 0}" aria-controls="${esc(t.id)}">${esc(t.label)}` +
        `${t.count === undefined ? "" : `<span class="con-ltab__n">${t.count}</span>`}</a>`,
    )
    .join("");
  const panes = tabs
    .map(
      (t, i) =>
        `<section class="con-tabp${i === 0 ? " on" : ""}" id="${esc(t.id)}" role="tabpanel">${t.body}</section>`,
    )
    .join("");
  return `<div class="con-ltabs">
      <nav class="con-ltabs__bar" role="tablist" aria-label="${T(lang, "Lead-szekciók")}">${bar}</nav>
      <div class="con-ltabs__sheet">${panes}</div>
    </div>
    <script>
      (function () {
        var root = document.querySelector('.con-ltabs');
        if (!root) return;
        var tabs = root.querySelectorAll('.con-ltab');
        var panes = root.querySelectorAll('.con-tabp');
        // Pin the sticky tab strip just below the sticky top menu, whose height
        // changes when it wraps on a phone — measure it live rather than guess.
        var topBar = document.querySelector('.con-top');
        var bar = root.querySelector('.con-ltabs__bar');
        function syncStickyTop() { if (topBar && bar) bar.style.top = topBar.offsetHeight + 'px'; }
        syncStickyTop();
        window.addEventListener('resize', syncStickyTop);
        // Legacy anchors the server already redirects to — they must keep working.
        var ALIAS = { 'mock-artifacts': 'ls-mocks', 'prospects': 'ls-outreach', 'ls-generate': 'ls-mocks' };
        function show(id) {
          var found = false;
          for (var i = 0; i < panes.length; i++) {
            var on = panes[i].id === id;
            panes[i].classList.toggle('on', on);
            if (on) found = true;
          }
          if (!found) return false;
          for (var j = 0; j < tabs.length; j++) {
            var sel = tabs[j].getAttribute('data-tab') === id;
            tabs[j].classList.toggle('on', sel);
            tabs[j].setAttribute('aria-selected', sel ? 'true' : 'false');
          }
          return true;
        }
        function fromHash() {
          var h = location.hash.replace(/^#/, '');
          if (!h) return false;
          return show(ALIAS[h] || h);
        }
        for (var k = 0; k < tabs.length; k++) {
          tabs[k].addEventListener('click', function (e) {
            e.preventDefault();
            var id = this.getAttribute('data-tab');
            if (!show(id)) return;
            history.replaceState(null, '', '#' + id);
            // Bring the strip into view: after a long panel the tabs are off-screen.
            root.scrollIntoView({ block: 'start', behavior: 'smooth' });
          });
        }
        window.addEventListener('hashchange', fromHash);
        fromHash();
      })();
    </script>`;
}

/**
 * One lightbox gallery for the whole lead page: the lead's real photos AND the
 * full-page template samples. Both are "look closely and compare" jobs, so both
 * need the same three things — open large, STEP between items without closing,
 * and scroll (a template sample is a whole page, far taller than the viewport).
 *
 * Opening a photo in a new tab, as this did before, loses the set: the operator
 * lands on a bare image with no way back to the next one.
 *
 * Pure DOM, no dependencies. `citLb.open(items, i)` takes [{src, cap}].
 */
function galleryScript(): string {
  const lang = consoleLang();
  return `<div id="cit-lb" class="cit-lb" hidden role="dialog" aria-modal="true" aria-label="${T(lang, "Képnézegető")}">
      <div class="cit-lb__bar">
        <span class="cit-lb__cap" id="cit-lb-cap"></span>
        <button type="button" class="cit-lb__btn" id="cit-lb-x" aria-label="${T(lang, "Bezárás (Esc)")}">×</button>
      </div>
      <button type="button" class="cit-lb__btn cit-lb__nav cit-lb__nav--prev" id="cit-lb-prev" aria-label="${T(lang, "Előző (←)")}">‹</button>
      <div class="cit-lb__stage" id="cit-lb-stage"><img id="cit-lb-img" alt=""></div>
      <button type="button" class="cit-lb__btn cit-lb__nav cit-lb__nav--next" id="cit-lb-next" aria-label="${T(lang, "Következő (→)")}">›</button>
    </div>
    <script>
      var citLb = (function () {
        var items = [], i = 0;
        var box, img, cap, prev, next, stage;
        function els() {
          box = box || document.getElementById('cit-lb');
          img = img || document.getElementById('cit-lb-img');
          cap = cap || document.getElementById('cit-lb-cap');
          prev = prev || document.getElementById('cit-lb-prev');
          next = next || document.getElementById('cit-lb-next');
          stage = stage || document.getElementById('cit-lb-stage');
        }
        function show() {
          els();
          var it = items[i]; if (!it) return;
          img.src = it.src; img.alt = it.cap || '';
          cap.textContent = (items.length > 1 ? (i + 1) + '/' + items.length + ' · ' : '') + (it.cap || '');
          prev.disabled = i <= 0; next.disabled = i >= items.length - 1;
          prev.hidden = next.hidden = items.length < 2;
          stage.scrollTop = 0; // a new image always starts at ITS top, not the last scroll position
        }
        function open(list, start) {
          els();
          items = list || []; i = Math.max(0, Math.min(start || 0, items.length - 1));
          if (!items.length) return;
          box.hidden = false; document.body.style.overflow = 'hidden'; show();
        }
        function close() { els(); box.hidden = true; document.body.style.overflow = ''; }
        function step(d) { if (i + d >= 0 && i + d < items.length) { i += d; show(); } }
        document.addEventListener('DOMContentLoaded', function () {
          els();
          document.getElementById('cit-lb-x').onclick = close;
          prev.onclick = function (e) { e.stopPropagation(); step(-1); };
          next.onclick = function (e) { e.stopPropagation(); step(1); };
          // Click the backdrop to close, but never a click on the image itself.
          stage.onclick = function (e) { if (e.target === stage) close(); };
        });
        document.addEventListener('keydown', function (e) {
          els(); if (box.hidden) return;
          if (e.key === 'Escape') close();
          else if (e.key === 'ArrowLeft') step(-1);
          else if (e.key === 'ArrowRight') step(1);
        });
        return { open: open, close: close };
      })();

      /** Open whatever the website field currently holds (typed or saved). */
      function citOpenSite(btn){
        var f = btn.closest('.con-edit-site');
        var inp = f && f.querySelector('input[name=website]');
        var v = inp && inp.value.trim();
        if (!v) { if (inp) inp.focus(); return; }
        if (!/^https?:\\/\\//i.test(v)) v = 'https://' + v;
        window.open(v, '_blank', 'noopener');
      }
      function citTplPick(inp){
        // Multi-select: toggle ONLY this card; the preview follows the last one turned on.
        var lab=inp.closest('.tpl-card');if(lab)lab.classList.toggle('on',inp.checked);
        if(inp.checked){var i=document.getElementById('tpl-prev-img');if(i)i.src='/assets/ui/tpl-'+inp.value+'-prev.jpg';}
      }
      /** Every template opens as one gallery, starting on the clicked one — the
       *  curator is CHOOSING between layouts, so stepping beats reopening. */
      function citTplGallery(startId){
        var cards = document.querySelectorAll('.tpl-cards input[name=template]');
        var list = [], start = 0;
        for (var k = 0; k < cards.length; k++) {
          var lab = cards[k].closest('.tpl-card');
          list.push({ src: '/assets/ui/tpl-' + cards[k].value + '-full.jpg',
                      cap: (lab && lab.title) || cards[k].value });
          if (cards[k].value === startId) start = k;
        }
        citLb.open(list, start);
      }
      function citTplZoom(){
        var c=document.querySelector('input[name=template]:checked');
        if(c) citTplGallery(c.value);
      }
    </script>`;
}

/** Read-only tenant self-service view (pilot: content edit stays house-side, A2). */
export function tenantAdminPage(v: TenantAdminView): string {
  const lang = consoleLang();
  const mods = v.modules.length
    ? v.modules.map((m) => `<span class="pill">${esc(m)}</span>`).join(" ")
    : `<span class="mut small">${T(lang, "nincs aktív modul")}</span>`;
  const body = `
    <div class="panel">
      <h2>${esc(v.displayName)} ${T(lang, "— oldal-kezelő")}</h2>
      <div class="row" style="margin-top:0">
        <span class="pill approved">${esc(v.siteStatus)}</span>
        <a class="small" href="/site/${esc(v.previewToken)}" target="_blank">${T(lang, "privát előnézet ▸")}</a>
      </div>
      <h3 class="mut small" style="margin-top:18px">Megvett modulok</h3>
      <div class="row">${mods}</div>
      <p class="mut small" style="margin-top:18px">Read-only pilot-nézet. A tartalom/kép szerkesztése és a
      nyilvános élesítés (fizetés-kapus) egyelőre ház-oldali, kézi lépés (A2).</p>
    </div>`;
  return layout(`${v.displayName} ${T(lang, "— kezelő")}`, body, { chrome: false });
}

/** Outreach draft page: §C gate verdict + pipeline send button + copy-ready fallback. */
export function outreachDraftPage(
  prospectId: string,
  input: { leadName: string; segment: string | null },
  draft: { subject: string; body: string; link: string },
  check: { verdict: "PASS" | "FLAG"; reasons: string[] },
  contactEmail: string | null = null,
  notice: { ok: boolean; text: string } | null = null,
  // Mobile channel = the ADR-0083 MMS+SMS pair + per-channel send state (ADR-0082):
  // independent one-shots, and the surface must say the state BEFORE the operator
  // clicks — the block used to surface only as a rejection afterwards.
  channel: {
    /** The PAIR's companion SMS (the exact outgoing text). */
    sms: { text: string };
    phone: string | null;
    emailSentAt?: string | null;
    smsSentAt?: string | null;
    /** ADR-0083: the MMS act's stamp = the pair's claim. */
    mmsSentAt?: string | null;
    /** Live pair job (in-process registry) — null when nothing is running. */
    pairJob?: { phase: "mms" | "sms" | "done" | "failed"; error?: string; mmsMessageId?: string } | null;
    /** Non-null = the cold-outreach allowlist would refuse this number (ADR-0082). */
    smsBlockedReason?: string | null;
  } | null = null,
  /** Parent lead — the draft is a SUB-page and must offer a way back to it. */
  leadId: string | null = null,
): string {
  const lang = consoleLang();
  const pass = check.verdict === "PASS";
  const verdict = pass
    ? `<span class="pill approved">${T(lang, "§C-kapu: PASS — küldhető")}</span>`
    : `<span class="pill rejected">${T(lang, "§C-kapu: FLAG — NEM küldhető")}</span>`;
  const reasons = check.reasons.length
    ? `<ul class="small" style="margin-top:8px;color:var(--citui-bad)">${check.reasons
        .map((r) => `<li>${esc(r)}</li>`)
        .join("")}</ul>`
    : "";
  const noticeBlock = notice
    ? `<div class="row" style="margin-top:8px"><span class="pill ${notice.ok ? "approved" : "rejected"}">${esc(notice.text)}</span></div>`
    : "";
  // Per-channel one-shot state (ADR-0082/0083). A used channel is stated up front —
  // the operator must not learn from a rejection banner that the button was dead.
  const emailSentAt = channel?.emailSentAt ?? null;
  const smsSentAt = channel?.smsSentAt ?? null;
  const mmsSentAt = channel?.mmsSentAt ?? null;
  const pairJob = channel?.pairJob ?? null;
  const pairRunning = pairJob?.phase === "mms" || pairJob?.phase === "sms";
  /** MMS out, companion SMS not — a broken pair (retry only the SMS half). */
  const pairBroken = Boolean(mmsSentAt && !smsSentAt && !pairRunning);
  const pairDone = Boolean(mmsSentAt && smsSentAt);
  const doneNote = (whenIso: string, what: string): string =>
    `<p class="mut small" style="margin-top:10px">${what} <b>${esc(whenIso.replace("T", " ").slice(0, 16))}</b>. ${T(lang, "Egy csatornán csak egyszer megy ki hideg megkeresés — a MÁSIK csatorna ettől szabad marad.")}</p>`;
  // Pipeline send (B szelet): the button is a convenience — every guard
  // (opt-out / channel one-shot / §C) re-runs server-side in sendOutreachMail.
  const sendBlock = emailSentAt
    ? doneNote(emailSentAt, T(lang, "Az e-mail már kiment:"))
    : pass
      ? contactEmail
        ? `<form method="post" action="/prospect/${esc(prospectId)}/send" style="margin-top:10px"
           onsubmit="return confirm('${esc(jsStr(T(lang, "Kiküldöd a levelet erre a címre: {email}?", { email: contactEmail })))}')">
           <button type="submit" class="con-ib">${ic("mail", 15)}${T(lang, "Küldés e-mailben — {email}", { email: esc(contactEmail) })}</button>
           <span class="small mut">${T(lang, "pipeline: §C-kapu újra + HTML-levél + „sent” státusz (H1-bázis)")}</span>
         </form>
         <p class="mut small" style="margin-top:6px">VAGY kézi küldés (A2): másold a tárgyat + szöveget a
            levelezőbe, küldés után a lead-oldalon a „Kiküldve" gomb.</p>`
        : `<p class="mut small">Pipeline-küldéshez adj meg contact e-mailt a lead-oldal Megkeresés-paneljén;
         addig kézi küldés (A2): másold a tárgyat + szöveget a levelezőbe, küldés után „Kiküldve" gomb.</p>`
      : `<p class="mut small">A FLAG-okok rendezéséig a levél nem küldhető ki (03-INVARIANTS §C).
       Tipikus ok: hiányzó PUBLIC_BASE_URL vagy OUTREACH_SENDER_* env.</p>`;
  // MOBILE channel — the ADR-0083 MMS+SMS pair, laid out per the approved plan B
  // (assets/design-refs/console/mobile-pair-outreach/): card + full-width timeline.
  const smsText = channel ? channel.sms.text : "";
  const mobilePill = pairDone
    ? `<span class="pill approved">${T(lang, "kiküldve")}</span>`
    : pairBroken
      ? `<span class="pill rejected">${T(lang, "MMS kint, SMS hibázott")}</span>`
      : pairRunning
        ? `<span class="pill">${T(lang, "küldés folyamatban…")}</span>`
        : `<span class="pill">${T(lang, "még nem ment ki")}</span>`;
  const failNote = (msg: string): string =>
    `<div style="margin-top:10px;background:color-mix(in srgb, var(--citui-bad) 10%, transparent);color:var(--citui-bad);border-radius:8px;padding:8px 10px" class="small">${esc(msg)}</div>`;
  const mobileCardBody = !channel
    ? ""
    : pairDone
      ? doneNote(smsSentAt!, T(lang, "A mobil-páros kiment:"))
      : channel.smsBlockedReason
        ? `<p class="mut small" style="margin-top:10px">${esc(channel.smsBlockedReason)}</p>`
        : !pass
          ? `<p class="mut small">${T(lang, "A §C-FLAG rendezéséig a mobil-páros sem küldhető.")}</p>`
          : pairRunning
            ? `<p class="mut small" style="margin-top:10px">${T(lang, "Küldés folyamatban — az idővonal lent mutatja, hol tart. A lap magától frissül.")}</p>`
            : pairBroken
              ? `${failNote(pairJob?.error ?? T(lang, "A kísérő SMS nem ment ki — a lead LÁTTA a képet, a pár claimje marad."))}
                 <form method="post" action="/prospect/${esc(prospectId)}/send-pair-sms" style="margin-top:8px">
                   <button type="submit">${T(lang, "SMS újra")}</button>
                 </form>`
              : `${pairJob?.phase === "failed" && pairJob.error ? failNote(pairJob.error) : ""}
                 <form method="post" action="/prospect/${esc(prospectId)}/send-pair" style="margin-top:10px"
                   onsubmit="return confirm('${esc(jsStr(T(lang, "Kiküldöd a párost? VALÓDI MMS (kép) + SMS (link) megy ki a címzett telefonjára, és nem vonható vissza.")))}')">
                   <button type="submit"${channel.phone ? "" : " disabled"}>${T(lang, "Páros indítása")}${channel.phone ? ` — ${esc(channel.phone)}` : T(lang, " (nincs szám)")}</button>
                 </form>`;
  // Timeline states, derived from stamps + the live job (plan B contract §2/§4).
  const step1 = mmsSentAt ? "done" : pairJob?.phase === "mms" ? "run" : pairJob?.phase === "failed" && !mmsSentAt ? "fail" : "";
  const step2 = smsSentAt ? "done" : pairJob?.phase === "sms" ? "run" : pairBroken ? "fail" : "";
  const stepStyle = (s: string): string =>
    s === "done"
      ? "background:var(--citui-ok-soft);border-color:transparent;color:var(--citui-ok)"
      : s === "run"
        ? "border-color:var(--citui-info);color:var(--citui-info)"
        : s === "fail"
          ? "background:color-mix(in srgb, var(--citui-bad) 12%, transparent);border-color:transparent;color:var(--citui-bad)"
          : "color:var(--citui-muted)";
  const badge = (label: string, s: string): string =>
    `<div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1px solid var(--citui-line-strong);font-size:13px;font-weight:600;${stepStyle(s)}">${label}</div>`;
  const timelineBlock = !channel
    ? ""
    : `<div style="border:1px solid var(--citui-line);border-radius:10px;padding:14px;margin-top:14px">
      <div style="display:grid;grid-template-columns:34px 1fr;gap:10px;padding:6px 0;border-bottom:1px dashed var(--citui-line)">
        ${badge("1", step1)}
        <div><b class="small">${T(lang, "MMS — a látványterv képe")}</b>
          <p class="mut small" style="margin:3px 0 0">${T(lang, "~60–90 mp a 2G-modemen; közben a gammu-smsd áll, a sorban lévő SMS-ek várnak (nem vesznek el). Feladó: a gépi fő SIM.")}</p>
          <img src="/prospect/${esc(prospectId)}/mms-preview.jpg" alt="${T(lang, "a kimenő MMS képe")}" style="max-width:190px;border-radius:8px;border:1px solid var(--citui-line);margin-top:6px;display:block">
          ${step1 === "done" ? `<p class="small" style="margin:4px 0 0;color:var(--citui-ok)">✓ ${T(lang, "az MMSC befogadta")}${pairJob?.mmsMessageId ? ` — message-id: ${esc(pairJob.mmsMessageId.slice(0, 8))}…` : ""}</p>` : ""}
          ${step1 === "run" ? `<p class="small" style="margin:4px 0 0;color:var(--citui-info)">⏳ ${T(lang, "feltöltés a modemen…")}</p>` : ""}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:34px 1fr;gap:10px;padding:10px 0;border-bottom:1px dashed var(--citui-line)">
        ${badge("2", step2)}
        <div><b class="small">${T(lang, "Kísérő SMS — élő link + leiratkozás (a jogi kötelezők hordozója)")}</b>
          <div id="smsbody" style="font:12.5px/1.5 ui-monospace,monospace;border:1px solid var(--citui-line);border-radius:8px;padding:8px;margin-top:6px;word-break:break-word">${esc(smsText)}</div>
          ${step2 === "done" ? `<p class="small" style="margin:4px 0 0;color:var(--citui-ok)">✓ ${T(lang, "az SMS elment — a pár teljes.")}</p>` : ""}
          ${step2 === "fail" ? `<p class="small" style="margin:4px 0 0;color:var(--citui-bad)">⛔ ${T(lang, "a lépés hangosan bukott — fent az „SMS újra” gomb.")}</p>` : ""}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:34px 1fr;gap:10px;padding:10px 0 4px">
        ${badge("✓", pairDone ? "done" : "")}
        <div><b class="small">${T(lang, "A pár = EGY megkeresés")}</b>
          <p class="mut small" style="margin:3px 0 0">${T(lang, "Egy claim, egy kapu-sor (opt-out, §C, artifact-verdikt, 8–20 időablak, engedélyezési lista). Újraküldés nincs.")}</p>
        </div>
      </div>
    </div>
    ${pairRunning ? `<script>setTimeout(function(){location.replace(location.pathname)},4000)</script>` : ""}`;
  const statePill = (sentAt: string | null): string =>
    sentAt
      ? `<span class="pill approved">${T(lang, "kiküldve")}</span>`
      : `<span class="pill">${T(lang, "még nem ment ki")}</span>`;
  // ONE-CLICK combined send (owner request, 2026-08-30): offered ONLY while BOTH
  // channels are actually startable — a combined button over a half-dead pair
  // would promise what the server then refuses (the ADR-0082 lesson: state up
  // front, not in a rejection banner). Otherwise the per-channel buttons stand.
  const bothStartable =
    pass &&
    Boolean(contactEmail) &&
    !emailSentAt &&
    Boolean(channel?.phone) &&
    !mmsSentAt &&
    !pairRunning &&
    !pairBroken &&
    !channel?.smsBlockedReason;
  const allBlock = bothStartable
    ? `<form method="post" action="/prospect/${esc(prospectId)}/send-all"
         style="border:1px solid var(--citui-line-strong);border-radius:10px;padding:12px 14px;margin-bottom:14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap"
         onsubmit="${esc(`if(!confirm('${jsStr(T(lang, "Kiküldöd MINDKÉT csatornán? VALÓDI e-mail + MMS (kép) + SMS (link) megy ki, és nem vonható vissza."))}'))return false;var b=this.querySelector('button');b.disabled=true;b.textContent='${jsStr(T(lang, "Küldés folyamatban…"))}'`)}">
         <button type="submit">${T(lang, "Indítás MINDKÉT csatornán — e-mail + MMS+SMS páros")}</button>
         <span class="small mut">${T(lang, "egy kattintás, két csatorna: a levél azonnal, a mobil-páros háttérben (idővonal lent) — külön-külön is indíthatók")}</span>
       </form>`
    : "";
  const channelBlock = `<div style="margin-top:10px">
      <div class="small mut" style="margin-bottom:6px">${T(lang, "Küldési csatorna — válaszd, hogyan menjen ki (a két csatorna külön-külön egyszer küldhető):")}</div>
      ${allBlock}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px">
        <div style="border:1px solid var(--citui-line);border-radius:10px;padding:14px">
          <div class="row" style="margin-top:0"><b>E-mail</b> ${statePill(emailSentAt)} ${contactEmail ? `<span class="pill approved">${T(lang, "cím megvan")}</span>` : `<span class="pill">${T(lang, "nincs cím")}</span>`}</div>
          <form method="post" action="/prospect/${esc(prospectId)}/contact-email" class="row" style="margin-top:8px;gap:8px;flex-wrap:wrap">
            <input type="email" name="email" value="${contactEmail ? esc(contactEmail) : ""}" placeholder="${T(lang, "címzett e-mail címe")}" style="flex:1;min-width:220px;padding:7px 9px">
            <button type="submit">${T(lang, "Cím mentése")}</button>
          </form>
          ${sendBlock}
        </div>
        <div style="border:1px solid var(--citui-line);border-radius:10px;padding:14px">
          <div class="row" style="margin-top:0"><b>${T(lang, "Mobil-megkeresés")}</b> ${mobilePill} ${channel?.phone ? `<span class="pill approved">${esc(channel.phone)}</span>` : `<span class="pill">${T(lang, "nincs szám")}</span>`}</div>
          <p class="mut small" style="margin:6px 0 0">${T(lang, "MMS+SMS páros — a lépések lent, indítás után élőben követhető. Önálló hideg SMS nincs többé: link kép nélkül = phishing-gyanú (ADR-0083).")}</p>
          ${mobileCardBody}
        </div>
      </div>
      ${timelineBlock}
    </div>`;
  const body = `
    ${leadId ? `<a class="con-back" href="/lead/${esc(leadId)}"><span aria-hidden="true">←</span> Vissza a leadhez</a>` : ""}
    <div class="panel">
      <h2>Outreach-piszkozat — ${esc(input.leadName)}${input.segment ? ` <span class="pill">${esc(input.segment)}</span>` : ""} ${helpLink("console.outreach_draft")}</h2>
      <div class="row">${verdict}</div>
      ${noticeBlock}
      ${reasons}
      ${channelBlock}
      <div style="margin-top:14px">
        <label class="small mut">${T(lang, "Tárgy")}</label>
        <div class="row" style="margin-top:4px">
          <input id="subj" type="text" readonly value="${esc(draft.subject)}" style="flex:1;min-width:320px">
          <button type="button" onclick="${esc(`navigator.clipboard.writeText(document.getElementById('subj').value);this.textContent='${jsStr(T(lang, "másolva"))}'`)}">${T(lang, "másolás")}</button>
        </div>
      </div>
      <div style="margin-top:14px">
        <label class="small mut">${T(lang, "Így néz ki a levél a címzett postafiókjában (HTML-előnézet)")}</label>
        <iframe src="/prospect/${esc(prospectId)}/email-preview" title="${T(lang, "E-mail előnézet")}"
          style="width:100%;height:560px;border:1px solid var(--citui-line-strong);border-radius:10px;background:var(--citui-white);margin-top:4px"></iframe>
        <div class="row" style="margin-top:4px">
          <a class="small" href="/prospect/${esc(prospectId)}/email-preview" target="_blank">${T(lang, "előnézet külön lapon ▸")}</a>
        </div>
      </div>
      <div style="margin-top:12px">
        <label class="small mut">${T(lang, "Levél szövege (text-változat — kézi küldéshez másolható)")}</label>
        <div style="margin-top:4px">
          <textarea id="mailbody" readonly rows="22" style="width:100%;font:13px/1.5 ui-monospace,monospace">${esc(draft.body)}</textarea>
        </div>
        <div class="row" style="margin-top:6px">
          <button type="button" onclick="${esc(`navigator.clipboard.writeText(document.getElementById('mailbody').value);this.textContent='${jsStr(T(lang, "másolva"))}'`)}">${T(lang, "szöveg másolása")}</button>
          <a class="small" href="${esc(draft.link)}" target="_blank">${T(lang, "követett link megnyitása ▸")}</a>
        </div>
      </div>
    </div>`;
  return layout(`Piszkozat — ${input.leadName}`, body, { active: "/leads" });
}

/**
 * GDPR Art. 13/14 privacy notice for the outreach + tracked-preview surface
 * (§C.2 + §H.22: legal text is DETERMINISTIC, never AI-written). The data
 * controller block comes from config (OUTREACH_SENDER_*); unfilled values are
 * visibly marked so the pre-send copy gate cannot miss them. Reviewed by the
 * owner at the pre-send gate.
 */
export function privacyPage(sender: {
  name: string;
  company: string;
  email: string;
  phone: string;
}): string {
  const lang = consoleLang();
  const v = (s: string, ph: string) => (s ? esc(s) : `<b>${T(lang, "[KITÖLTENDŐ: {field}]", { field: ph })}</b>`);
  const body = `
    <div class="panel" style="max-width:760px;margin:0 auto">
      <h2>${T(lang, "Adatkezelési tájékoztató")}</h2>
      <div class="small" style="line-height:1.7">
        <p><b>${T(lang, "1. Adatkezelő.")}</b> ${v(sender.company, T(lang, "cégnév"))} — kapcsolattartó: ${v(sender.name, T(lang, "név"))},
        e-mail: ${v(sender.email, "e-mail")}${sender.phone ? `, telefon: ${esc(sender.phone)}` : ""}.</p>

        <p><b>${T(lang, "2. Milyen adatokat kezelünk és honnan?")}</b> ${T(lang, "Vállalkozása")} <b>${T(lang, "nyilvánosan elérhető")}</b> üzleti
        adatait (név, cím, elérhetőség, fotók, értékelések) gyűjtöttük össze nyilvános forrásokból
        (Google Térkép, szállás-portálok, saját weboldal) — GDPR 14. cikk szerinti, nem az érintettől
        származó adatgyűjtés. Emellett a megkeresésünkben küldött előnézeti link megnyitásakor
        <b>${T(lang, "megtekintési adatokat")}</b> rögzítünk: megnyitás ténye és ideje, görgetés, a kipróbált
        elemek, böngésző-azonosító (user-agent). Sütit nem használunk.</p>

        <p><b>${T(lang, "3. Cél és jogalap.")}</b> Cél: személyre szabott üzleti ajánlat (honlap-látványterv) készítése
        és bemutatása, valamint az érdeklődés mérése az ajánlat igényekhez igazításához. Jogalap:
        <b>${T(lang, "jogos érdek")}</b> (GDPR 6. cikk (1) f) — üzleti kapcsolat kezdeményezése vállalkozásokkal;
        Grt. 6. §). Az adatok kizárólag e célra szolgálnak, harmadik félnek nem adjuk át.</p>

        <p><b>${T(lang, "4. Megőrzés.")}</b> A megkeresési kampány lezárultáig, de legfeljebb 12 hónapig; leiratkozás
        esetén a további megkeresést és mérést azonnal leállítjuk, elérhetőségét tiltólistán őrizzük
        (hogy ne keressük meg újra).</p>

        <p><b>${T(lang, "5. Az Ön jogai.")}</b> Kérheti a hozzáférést, helyesbítést, törlést, az adatkezelés
        korlátozását, és <b>tiltakozhat</b> a jogos érdeken alapuló adatkezelés ellen — a fenti
        elérhetőségeken, vagy egy kattintással a levélben található leiratkozó-linken. Panaszt tehet a
        Nemzeti Adatvédelmi és Információszabadság Hatóságnál (NAIH — naih.hu, 1055 Budapest,
        Falk Miksa u. 9–11.).</p>

        <p class="mut">${T(lang, "A megkeresésben linkelt oldal")} <b>${T(lang, "előzetes látványterv")}</b> (nem kész, nem élő
        honlap), amely a fenti nyilvános adatokból készült, és semmilyen kötelezettséggel nem jár.</p>

        <h3 style="margin-top:1.6em">${T(lang, "Ha Ön a megrendelőnk")}</h3>
        <p>A fenti fejezetek a megkeresésre vonatkoznak. Ha szerződést kötött velünk, az alábbi
        adatkezelések is érvényesek — egy adatkezelő egy tájékoztatót ad, ezért szerepelnek itt.</p>
        ${PRIVACY_CUSTOMER_V1.map(
          (s, i) =>
            `<p><b>${i + 6}. ${esc(s.heading)}.</b> ${s.body.map(esc).join(" ")}</p>`,
        ).join("")}

        <p class="mut" style="margin-top:1.6em">Kapcsolódó dokumentumok:
        <a href="/impresszum">Impresszum</a> ·
        <a href="/aszf">${T(lang, "ÁSZF")}</a> ·
        <a href="/elallas">${T(lang, "Elállási tájékoztató")}</a> ·
        <a href="/adatfeldolgozas">${T(lang, "Adatfeldolgozási feltételek")}</a></p>
      </div>
    </div>`;
  return layout(T(lang, "Adatkezelési tájékoztató"), body, { chrome: false });
}

// ── Prospect activity timeline (what the lead actually did on the /p page) ────

import type { ProspectActivity } from "./data.js";

/** Human labels for the instrumentation event types (06-UI-CONTRACT beacons). */
export const EVENT_LABEL = (lang = "hu"): Readonly<Record<string, string>> => ({
  open: T(lang, "megnyitotta az oldalt"),
  scroll: T(lang, "görgetett"),
  dwell: T(lang, "olvasta az oldalt"),
  dwell_end: T(lang, "elhagyta az oldalt"),
  panel_open: T(lang, "megnyitotta a konfigurátort"),
  module_add: T(lang, "bekapcsolt egy modult"),
  module_remove: T(lang, "kikapcsolt egy modult"),
  preset_select: T(lang, "csomagot választott"),
  period_select: T(lang, "fizetési ciklust váltott"),
  domain_select: T(lang, "domain-típust választott"),
  domain_pick: T(lang, "domainnevet választott"),
  photo_rights_declared: T(lang, "elfogadta a fotó-jog nyilatkozatot"),
  order_intent_submitted: T(lang, "ELKÜLDTE A MEGRENDELÉST"),
  checkout_redirect: T(lang, "továbbment a fizetéshez"),
});

/** Prospect activity page: sessions + event timeline + derived intent signals. */
export function prospectActivityPage(a: ProspectActivity): string {
  const lang = consoleLang();
  const modLabel = (id: string): string =>
    MODULE_CATALOG.find((m) => m.id === id)?.publicLabel ?? id;
  const hhmm = (iso: string) => esc(iso.slice(11, 19));
  const dmy = (iso: string) => esc(iso.slice(0, 16).replace("T", " "));

  const detail = (e: { type: string; payload: Record<string, unknown> }): string => {
    const p = e.payload ?? {};
    if (e.type === "scroll") return `${esc(p.pct)}%`;
    if (e.type === "dwell" || e.type === "dwell_end") return `${esc(p.seconds)} mp`;
    if (e.type === "module_add" || e.type === "module_remove")
      return typeof p.module === "string" ? esc(modLabel(p.module)) : "";
    if (e.type === "preset_select") return esc(p.preset);
    if (e.type === "period_select") return p.period === "annual" ? T(lang, "éves") : "havi";
    if (e.type === "domain_select") return p.choice === "custom" ? T(lang, "saját domain") : "citoviso.com aldomain";
    if (e.type === "domain_pick") return esc(p.domain);
    if (e.type === "order_intent_submitted")
      return `${esc(p.modules)} modul · ${p.period === "annual" ? T(lang, "éves") : "havi"}`;
    return "";
  };

  const totalEvents = a.sessions.reduce((n, s) => n + s.events.length, 0);
  const bestScroll = a.sessions.reduce((m, s) => Math.max(m, s.maxScroll), 0);
  const bestDwell = a.sessions.reduce((m, s) => Math.max(m, s.maxDwell), 0);

  // Intent summary — the "mit csinált" answer at a glance.
  const on = a.moduleToggles.filter((m) => m.on).map((m) => modLabel(m.module));
  const off = a.moduleToggles.filter((m) => !m.on).map((m) => modLabel(m.module));
  const signals = [
    `<dt>${T(lang, "Megnyitások")}</dt><dd>${T(lang, "{v} látogatás · {e} esemény", { v: a.sessions.length, e: totalEvents })}</dd>`,
    `<dt>${T(lang, "Legmélyebb görgetés")}</dt><dd>${bestScroll ? `${bestScroll}%` : `<span class="mut">–</span>`}</dd>`,
    `<dt>${T(lang, "Leghosszabb olvasás")}</dt><dd>${bestDwell ? `${bestDwell} másodperc` : `<span class="mut">–</span>`}</dd>`,
    `<dt>${T(lang, "Választott csomag")}</dt><dd>${a.preset ? `<b>${esc(a.preset)}</b>` : `<span class="mut">${T(lang, "nem választott")}</span>`}</dd>`,
    `<dt>${T(lang, "Fizetési ciklus")}</dt><dd>${a.period ? (a.period === "annual" ? T(lang, "éves") : "havi") : `<span class="mut">–</span>`}</dd>`,
    on.length ? `<dt>Bekapcsolt modulok</dt><dd>${on.map((m) => `<span class="pill approved">${esc(m)}</span>`).join(" ")}</dd>` : "",
    off.length ? `<dt>Kikapcsolt modulok</dt><dd>${off.map((m) => `<span class="pill">${esc(m)}</span>`).join(" ")}</dd>` : "",
  ]
    .filter(Boolean)
    .join("");

  const sessionBlocks = a.sessions.length
    ? a.sessions
        .map((s, i) => {
          const rows = s.events
            .map((e) => {
              const label = EVENT_LABEL(lang)[e.type] ?? e.type;
              const d = detail(e);
              const strong = e.type === "order_intent_submitted" || e.type === "checkout_redirect";
              return `<tr${strong ? ` style="font-weight:600"` : ""}>
                <td class="mut small" style="white-space:nowrap">${hhmm(e.at)}</td>
                <td>${esc(label)}</td>
                <td class="small mut">${d}</td></tr>`;
            })
            .join("");
          return `<details class="panel"${i === a.sessions.length - 1 ? " open" : ""}>
            <summary style="cursor:pointer;font-weight:600">${i + 1}. látogatás — ${dmy(s.startedAt)}
              <span class="mut small" style="font-weight:400">· ${T(lang, "{n} esemény", { n: s.events.length })}${s.maxScroll ? ` · ${T(lang, "{n}% görgetés", { n: s.maxScroll })}` : ""}${s.maxDwell ? ` · ${T(lang, "{n} mp olvasás", { n: s.maxDwell })}` : ""}</span>
            </summary>
            <div class="tblwrap"><table style="margin-top:10px"><tbody>${rows || `<tr><td class="mut small">${T(lang, "nincs esemény")}</td></tr>`}</tbody></table></div>
            ${s.referrer ? `<p class="mut small" style="margin-top:8px">${T(lang, "Forrás: {src}", { src: esc(s.referrer) })}</p>` : ""}
          </details>`;
        })
        .join("")
    : `<div class="panel"><p class="mut">${T(lang, "Még nem nyitotta meg a linket — nincs mérési adat.")}</p></div>`;

  const body = `
    <div class="panel">
      <h2>${T(lang, "Tevékenység —")} ${esc(a.leadName)} ${helpLink("console.outreach_draft")}</h2>
      <div class="row" style="margin-top:0">
        <span class="pill ${a.status === "order_intent" || a.status === "converted" ? "approved" : ""}">${esc(a.status)}</span>
        ${a.sentAt ? `<span class="pill approved">✓ ${T(lang, "e-mail kiküldve · {date}", { date: dmy(a.sentAt) })}</span>` : `<span class="pill">${T(lang, "e-mail még nem ment ki")}</span>`}
        <a class="small" href="/lead/${esc(a.leadId)}">◂ vissza a leadhez</a>
        <a class="small" href="/p/${esc(a.token)}" target="_blank">${T(lang, "a látott oldal ▸")}</a>
      </div>
      <dl class="kv" style="margin-top:14px">${signals}</dl>
    </div>
    ${sessionBlocks}`;
  return layout(`${T(lang, "Tevékenység —")} ${a.leadName}`, body, { active: "/leads" });
}

// ── Scrape launcher + pilot funnel report pages (PILOT.md §7d ①) ──────────────

import type { ScrapeJobState } from "./scrapeJob.js";
import type { FunnelReport, FunnelCounts, ScrapeRunView } from "./data.js";

/** Scrape page: region picker + live log of the running job + run history. */
export function scrapePage(
  job: ScrapeJobState,
  runs: ScrapeRunView[],
  regions: { id: string; label: string }[],
  notice: string | null = null,
): string {
  const lang = consoleLang();
  const regionOpts = regions
    .map((r) => `<option value="${esc(r.id)}">${esc(r.label)}</option>`)
    .join("");
  const startForm = job.running
    ? `<p class="mut">${T(lang, "Fut: {region} (indult: {time}) — az oldal 3 mp-enként frissül.", { region: `<strong>${esc(job.regionId ?? "?")}</strong>`, time: job.startedAt?.toLocaleTimeString("hu-HU") ?? "?" })}</p>`
    : `<form method="post" action="/scrape/start" class="row" style="gap:8px;flex-wrap:wrap">
        <label>${T(lang, "Régió")} <select name="region">${regionOpts}</select></label>
        <label>Cap <input type="number" name="cap" min="1" placeholder="pl. 40" style="width:90px"></label>
        <button type="submit">${T(lang, "Scrape indítása")}</button>
        <span class="small mut">${T(lang, "A futás Google Places API-hívásokkal jár (költség) — a cap ezt korlátozza.")}</span>
      </form>`;
  const logBlock = job.log.length
    ? `<div style="margin-top:12px"><label class="small mut">${T(lang, "Napló")}${job.running ? T(lang, " (élő)") : job.exitCode === 0 ? T(lang, " — ✅ sikeres futás") : T(lang, " — ⛔ exit {code}", { code: job.exitCode ?? "?" })}</label>
       <pre style="margin-top:4px;max-height:420px;overflow:auto;background:var(--citui-navy-950);color:var(--citui-ink-inverse);border:1px solid var(--citui-line-strong);border-radius:8px;padding:10px;font:12px/1.5 ui-monospace,monospace;white-space:pre-wrap">${esc(job.log.join("\n"))}</pre></div>`
    : "";
  const runRows = runs
    .map((r) => {
      const s = r.stats as { players?: number; leads?: number };
      return `<tr><td>${esc(r.regionLabel)}</td>
        <td><span class="pill ${r.status === "completed" ? "approved" : r.status === "failed" ? "rejected" : ""}">${esc(r.status)}</span></td>
        <td>${r.startedAt ? new Date(r.startedAt).toLocaleString("hu-HU") : "–"}</td>
        <td>${s.players ?? "–"}</td><td>${s.leads ?? "–"}</td>
        <td class="small mut">${esc(r.error ?? "")}</td></tr>`;
    })
    .join("");
  const body = `
    ${scrapeTabs("/scrape")}
    <div class="panel">
      <h2>${T(lang, "Scrape indítása")} ${helpLink("console.scrape")}</h2>
      ${notice ? `<div class="row"><span class="pill rejected">${esc(notice)}</span></div>` : ""}
      ${startForm}
      ${logBlock}
    </div>
    <div class="panel">
      <h2>${T(lang, "Korábbi futások")}</h2>
      <div class="tblwrap"><table><thead><tr><th>${T(lang, "Régió")}</th><th>${T(lang, "Státusz")}</th><th>Indult</th><th>${T(lang, "Szereplő")}</th><th>Lead</th><th>Hiba</th></tr></thead>
      <tbody>${runRows || `<tr><td colspan="6" class="mut">${T(lang, "Még nincs futás.")}</td></tr>`}</tbody></table></div>
    </div>`;
  const refresh = job.running ? `<meta http-equiv="refresh" content="3">` : "";
  return layout("Scrape", body, { active: "/scrape" }).replace("</head>", `${refresh}</head>`);
}

function pct(num: number, den: number): string {
  if (!den) return `<span class="mut">–</span>`;
  return `${((num / den) * 100).toFixed(1)}%`;
}

function funnelRow(label: string, c: FunnelCounts): string {
  return `<tr><td>${esc(label)}</td>
    <td>${c.prospects}</td><td>${c.sent}</td>
    <td>${c.opened} <span class="small mut">(${pct(c.openedOfSent, c.sent)})</span></td>
    <td>${c.returned} <span class="small mut">(${pct(c.returned, c.opened)})</span></td>
    <td>${c.moduleTouched} <span class="small mut">(${pct(c.moduleTouched, c.opened)})</span></td>
    <td>${c.orderIntent} <span class="small mut">(${pct(c.orderIntentOfSent, c.sent)})</span></td>
    <td>${c.converted}</td><td>${c.unsubscribed}</td></tr>`;
}

/** Pilot funnel report: H1–H5 with thresholds + segment breakdown. */
export function reportPage(r: FunnelReport): string {
  const lang = consoleLang();
  const t = r.total;
  const hyp = `<table style="margin-top:8px">
    <thead><tr><th>${T(lang, "Hipotézis")}</th><th>${T(lang, "Mérőszám")}</th><th>${T(lang, "Küszöb (PILOT.md §4)")}</th><th>${T(lang, "Most")}</th></tr></thead>
    <tbody>
      <tr><td>${T(lang, "H1 — horog")}</td><td>${T(lang, "megnyitás / kiküldött")}</td><td>${T(lang, "érdemben magasabb a sima szövegnél")}</td><td>${pct(t.openedOfSent, t.sent)} (${t.openedOfSent}/${t.sent})</td></tr>
      <tr><td>${T(lang, "H2 — engagement")}</td><td>${T(lang, "visszatérő / megnyitó")}</td><td>${T(lang, "> ~30%")}</td><td>${pct(t.returned, t.opened)} (${t.returned}/${t.opened})</td></tr>
      <tr><td>${T(lang, "H3 — konfigurátor")}</td><td>${T(lang, "modul-hozzáadó / megnyitó")}</td><td>${T(lang, "> ~20%")}</td><td>${pct(t.moduleTouched, t.opened)} (${t.moduleTouched}/${t.opened})</td></tr>
      <tr><td>${T(lang, "H4 — szegmens")}</td><td>${T(lang, "order-intent arány szegmensenként")}</td><td>${T(lang, "nincs_honlap/0_labnyom magasabb")}</td><td>${T(lang, "lásd lenti bontás")}</td></tr>
      <tr><td>${T(lang, "H5 — konverzió")}</td><td>${T(lang, "order-intent / kiküldött")}</td><td>${T(lang, "> ~3–5%")}</td><td>${pct(t.orderIntentOfSent, t.sent)} (${t.orderIntentOfSent}/${t.sent})</td></tr>
    </tbody></table>`;
  const segRows = r.segments.map((s) => funnelRow(s.segment, s)).join("");
  const head = `<thead><tr><th>${T(lang, "Szegmens")}</th><th>${T(lang, "Prospect")}</th><th>${T(lang, "Kiküldve")}</th><th>${T(lang, "Megnyitva")}</th><th>${T(lang, "Visszatért")}</th><th>${T(lang, "Modul-piszkált")}</th><th>${T(lang, "Order-intent")}</th><th>${T(lang, "Konvertált")}</th><th>${T(lang, "Leiratk.")}</th></tr></thead>`;
  const body = `
    <div class="panel">
      <h2>${T(lang, "Pilot-tölcsér (H1–H5)")} ${helpLink("console.report")}</h2>
      <p class="mut small">${T(lang, "Alap-készlet: {players} felmért szereplő · {leads} kvalifikált lead · {mocks} mock ({approved} jóváhagyott) · {prospects} követett prospect.", { players: r.leadTotals.players, leads: r.leadTotals.leads, mocks: r.leadTotals.mocks, approved: r.leadTotals.approved, prospects: t.prospects })}</p>
      <div class="tblwrap">${hyp}</div>
    </div>
    <div class="panel">
      <h2>${T(lang, "Szegmens-bontás (H4)")}</h2>
      <div class="tblwrap"><table>${head}<tbody>${funnelRow(T(lang, "ÖSSZES"), t)}${segRows}</tbody></table></div>
      <p class="mut small">${T(lang, "A tölcsér sosem regresszál (0009): a szám a legalább elért állapotot jelenti.")}</p>
    </div>`;
  return layout(T(lang, "Pilot-riport"), body, { active: "/report" });
}

/** Live counts for the hub's finance card + attention chips. */
export interface FinanceCounts {
  readonly docs: number;
  readonly open: number;
  readonly overdue: number;
  readonly partners: number;
}

/** One submenu entry on a hub module card. */
interface HubSub {
  readonly n: string;
  readonly href: string;
  readonly b?: string;
  readonly bClass?: string;
}

/** Hub search: filters the cards' submenu items, hint shows the hit count. */
const HUB_JS = `<script>
(function(){
  var q = document.getElementById('hubq'), hint = document.getElementById('hubqhint');
  if (!q) return;
  var total = document.querySelectorAll('.con-subs .con-sub').length;
  q.addEventListener('input', function(){
    var t = q.value.trim().toLowerCase(), hits = 0;
    document.querySelectorAll('.con-mod').forEach(function(card){
      var any = !t || (card.dataset.title || '').indexOf(t) !== -1;
      card.querySelectorAll('.con-sub').forEach(function(a){
        var name = a.dataset.n || '';
        var hit = !t || name.toLowerCase().indexOf(t) !== -1 || (card.dataset.title || '').indexOf(t) !== -1;
        a.parentElement.style.display = hit ? '' : 'none';
        if (hit){ any = true; hits++; }
        var label = a.querySelector('.con-sub__n');
        if (t && name.toLowerCase().indexOf(t) !== -1){
          var i = name.toLowerCase().indexOf(t);
          label.innerHTML = name.slice(0,i) + '<em>' + name.slice(i, i+t.length) + '</em>' + name.slice(i+t.length);
        } else { label.textContent = name; }
      });
      card.style.display = any ? '' : 'none';
    });
    hint.textContent = t ? hits + ' találat' : total + ' funkció';
  });
})();
</script>`;

/** The console home — the MODULE HUB (owner's admin-hub mock, 2026-08-23):
 *  hero + attention chips with live numbers + function search + module cards,
 *  each carrying its own submenu list and a "Modul megnyitása" foot. */
export function dashboardPage(
  r: FunnelReport,
  scrapeRunning: boolean,
  operatorName: string,
  fin: FinanceCounts,
): string {
  const lang = consoleLang();
  const modules: ReadonlyArray<{
    icon: string;
    title: string;
    role: string;
    open: string;
    subs: HubSub[];
  }> = [
    {
      icon: "leads",
      title: "CRM",
      role: T(lang, "Lead-től a megrendelésig — akit megszólítunk, és ahol tart."),
      open: "/leads",
      subs: [
        { n: "Lead-sor", href: "/leads", b: String(r.leadTotals.players) },
        { n: T(lang, "Jóváhagyott mockok"), href: "/leads?mock=approved", b: `${r.leadTotals.approved}` },
        { n: T(lang, "Duplikátumok"), href: "/duplicates" },
        { n: T(lang, "Scrape indítása"), href: "/scrape", b: scrapeRunning ? "FUT" : undefined, bClass: "approved" },
        { n: T(lang, "Térkép (lefedettség)"), href: "/scrape/map" },
        { n: T(lang, "Területek"), href: "/scrape/regions" },
      ],
    },
    {
      icon: "pricing",
      title: T(lang, "Pénzügy / Admin"),
      role: T(lang, "Bizonylatok, partnerek, árazás — a pénz papír-oldala."),
      open: "/documents",
      subs: [
        { n: T(lang, "Bizonylat keresése"), href: "/documents", b: String(fin.docs) },
        { n: T(lang, "Új bizonylat rögzítése"), href: "/documents/new" },
        { n: T(lang, "Nyitott tételek"), href: "/documents?paid=0", b: fin.open ? String(fin.open) : undefined, bClass: fin.overdue ? "rejected" : "" },
        { n: "Partnerek", href: "/partners", b: String(fin.partners) },
        { n: T(lang, "Új partner rögzítése"), href: "/partners/new" },
        { n: T(lang, "Árazás"), href: "/pricing" },
      ],
    },
    {
      icon: "report",
      title: "Riport",
      role: T(lang, "Mi termel és mi szivárog — a döntéshez elég szám."),
      open: "/report",
      subs: [
        { n: T(lang, "Pilot-tölcsér (H1–H5)"), href: "/report" },
        { n: T(lang, "Kiküldött megkeresések"), href: "/report", b: String(r.total.sent) },
        { n: T(lang, "Order-intentek"), href: "/report", b: String(r.total.orderIntent) },
      ],
    },
    {
      icon: "settings",
      title: "Rendszer",
      role: T(lang, "Fiók, jelszó, működési beállítások."),
      open: "/settings",
      subs: [{ n: T(lang, "Beállítások"), href: "/settings" }],
    },
  ];

  const chips = [
    fin.overdue
      ? `<a class="con-chip con-chip--bad" href="/documents?paid=0"><span class="led"></span><b>${fin.overdue}</b> ${T(lang, "lejárt számla")}</a>`
      : "",
    fin.open
      ? `<a class="con-chip con-chip--warn" href="/documents?paid=0"><span class="led"></span><b>${fin.open}</b> nyitott bizonylat</a>`
      : "",
    `<a class="con-chip" href="/leads"><span class="led"></span><b>${r.leadTotals.leads}</b> ${T(lang, "kvalifikált lead")}</a>`,
    `<a class="con-chip${scrapeRunning ? " con-chip--ok" : ""}" href="/scrape"><span class="led"></span>scrape: ${scrapeRunning ? "fut" : T(lang, "áll")}</a>`,
  ]
    .filter(Boolean)
    .join("");

  const totalSubs = modules.reduce((n, m) => n + m.subs.length, 0);
  const cards = modules
    .map(
      (m) => `<article class="con-mod" data-title="${esc(m.title.toLowerCase())}">
      <a class="con-mod__head" href="${m.open}">
        <span class="con-mod__ico">${ic(m.icon, 22)}</span>
        <span style="min-width:0">
          <span class="con-mod__t">${esc(m.title)}</span>
          <span class="con-mod__role">${esc(m.role)}</span>
        </span>
      </a>
      <ul class="con-subs">
        ${m.subs
          .map(
            (s) => `<li><a class="con-sub" href="${s.href}" data-n="${esc(s.n)}">
            <span class="con-sub__dot"></span>
            <span class="con-sub__n">${esc(s.n)}</span>
            ${s.b ? `<span class="pill ${s.bClass ?? ""}">${esc(s.b)}</span>` : ""}
          </a></li>`,
          )
          .join("")}
      </ul>
      <div class="con-mod__foot">
        <a class="con-mod__open" href="${m.open}">${T(lang, "Modul megnyitása ▸")}</a>
      </div>
    </article>`,
    )
    .join("");

  const body = `
    <section class="con-hero">
      <p class="eyebrow">${T(lang, "Irányítópult")}</p>
      <h1>Szia, ${esc(operatorName)}! ${helpLink("console.dashboard")}</h1>
      <p>${T(lang, "Modulok egy belépési ponttal. Ami ma figyelmet kér:")}</p>
      <div class="con-chips">${chips}</div>
    </section>
    <div class="con-hubsearch">
      ${ic("zoom", 18)}
      <input id="hubq" type="search" placeholder="${T(lang, "Ugrás funkcióra — pl. „bizonylat”, „partner”, „lead”")}" autocomplete="off">
      <span class="hint" id="hubqhint">${T(lang, "{n} funkció", { n: totalSubs })}</span>
    </div>
    <div class="con-modgrid">${cards}</div>
    ${HUB_JS}`;
  return layout(T(lang, "Irányítópult"), body, { active: "/" });
}

// ── Scrape areas + map (0018) ───────────────────────────────────────────────

/** Leaflet from CDN — same version the public site's map picker already uses. */
const LEAFLET_HEAD =
  `<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">`;
const LEAFLET_JS = `<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>`;

/** Marker colour per website qualification — what makes a lead worth contacting.
 *  Literal mirrors of the citui semantic tokens (bad/warn/ok/muted): Leaflet writes
 *  these into SVG presentation attributes, where var() does not resolve. Keep in
 *  sync with public/assets/ui/citui.css. */
const QUAL_COLOR: Record<string, string> = {
  no_site: "#e5484d", // --citui-bad — no website at all = the prime target
  outdated: "#d29922", // --citui-warn
  modern: "#2fa96b", // --citui-ok
  unknown: "#60748b", // --citui-muted
};
const QUAL_LABEL = (lang = "hu"): Record<string, string> => ({
  no_site: T(lang, "nincs honlapja"),
  outdated: T(lang, "elavult honlap"),
  modern: T(lang, "modern honlap"),
  unknown: T(lang, "ismeretlen"),
});

/**
 * Map of everything scraped so far: one dot per geo-located lead (coloured by
 * website qualification) plus the scrape areas as rectangles — so coverage and
 * blank spots are visible at a glance.
 */
export function mapPage(
  leads: ReadonlyArray<import("./data.js").MapLead>,
  regions: ReadonlyArray<import("./data.js").RegionRow>,
): string {
  const lang = consoleLang();
  const legend = Object.entries(QUAL_LABEL(lang))
    .map(
      ([k, label]) =>
        `<span class="mut small" style="margin-right:14px"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${QUAL_COLOR[k]};margin-right:5px"></span>${esc(label)}</span>`,
    )
    .join("");
  const body = `
    ${scrapeTabs("/scrape/map")}
    <div class="panel">
      <h2>${T(lang, "Eddig felderített leadek")} ${helpLink("console.scrape")}</h2>
      <p class="mut small" style="margin:-2px 0 10px">${T(lang, "{l} lead a térképen · {r} terület", { l: leads.length, r: regions.length })}</p>
      <div>${legend}</div>
      <div id="map" style="height:70vh;min-height:420px;margin-top:12px;border-radius:10px;overflow:hidden"></div>
      ${leads.length ? "" : `<p class="mut" style="margin-top:12px">${T(lang, "Még nincs koordinátás lead. Indíts egy scrape-et a")} <a href="/scrape">Scrape</a> oldalon.</p>`}
    </div>
    ${LEAFLET_JS}
    <script>
      var LEADS = ${JSON.stringify(leads)};
      var AREAS = ${JSON.stringify(regions)};
      var COLORS = ${JSON.stringify(QUAL_COLOR)};
      var LABELS = ${JSON.stringify(QUAL_LABEL(lang))};
      var map = L.map('map').setView([47.16, 19.5], 7);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
      var bounds = [];
      AREAS.forEach(function (a) {
        // Circular areas (0019); legacy rows fall back to their bbox centre.
        var lat = a.centerLat != null ? a.centerLat : (a.south + a.north) / 2;
        var lon = a.centerLon != null ? a.centerLon : (a.west + a.east) / 2;
        var km = a.radiusKm != null ? a.radiusKm : 5;
        var c = L.circle([lat, lon], {
          radius: km * 1000, color: '#1fb6d6', weight: 1.5, fillOpacity: 0.05,
        }).bindTooltip(a.label + ' — ' + km.toFixed(1) + ' km · ' + a.leadCount + ' lead').addTo(map);
        var b = c.getBounds();
        bounds.push([b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]);
      });
      LEADS.forEach(function (l) {
        var c = COLORS[l.qualification] || COLORS.unknown;
        L.circleMarker([l.lat, l.lon], {
          radius: 6, color: '#fff', weight: 1.5, fillColor: c, fillOpacity: 0.95,
        }).bindPopup(
          '<b>' + l.name + '</b><br>' + (LABELS[l.qualification] || '') +
          '<br><span style="color:var(--citui-muted)">' + (l.address || '') + '</span>' +
          '<br><a href="/lead/' + l.id + '">${T(lang, "Lead megnyitása")}</a>'
        ).addTo(map);
        bounds.push([l.lat, l.lon]);
      });
      if (bounds.length) map.fitBounds(bounds, { padding: [30, 30] });
    </script>`;
  return layout(T(lang, "Térkép"), body, { active: "/scrape", head: LEAFLET_HEAD });
}

/**
 * Scrape-area admin: define WHERE we hunt, the way an operator thinks about it —
 * search for a town/address, then set how many kilometres around it to sweep.
 * The area is a CIRCLE (0019); the enclosing bbox is derived server-side.
 */
export function regionsPage(
  regions: ReadonlyArray<import("./data.js").RegionRow>,
  notice?: string,
): string {
  const lang = consoleLang();
  const rows = regions.length
    ? regions
        .map(
          (r) => `<tr${r.active ? "" : ' style="opacity:.5"'}>
        <td><b>${esc(r.label)}</b><div class="mut small"><code>${esc(r.id)}</code></div></td>
        <td class="mut small">${
          r.radiusKm != null && r.centerLat != null && r.centerLon != null
            ? `${T(lang, "{km} km sugár", { km: r.radiusKm.toFixed(1) })}<br>${r.centerLat.toFixed(4)}, ${r.centerLon.toFixed(4)}`
            : `${r.south.toFixed(3)}, ${r.west.toFixed(3)} — ${r.north.toFixed(3)}, ${r.east.toFixed(3)}`
        }</td>
        <td>${r.leadCount}</td>
        <td>${r.active ? '<span class="pill approved">${T(lang, "aktív")}</span>' : '<span class="pill">${T(lang, "inaktív")}</span>'}</td>
        <td class="small">
          <button type="button" class="btn-link" onclick='citEditArea(${JSON.stringify(r)})'>Szerkeszt</button>
          ${
            r.active
              ? `<form method="post" action="/scrape/regions/${esc(r.id)}/deactivate" style="display:inline">
                   <button type="submit" class="btn-link">Kivon</button></form>`
              : ""
          }
        </td></tr>`,
        )
        .join("")
    : `<tr><td colspan="5" class="mut">${T(lang, "Még nincs terület.")}</td></tr>`;

  const body = `
    ${scrapeTabs("/scrape/regions")}
    ${notice ? `<div class="panel" style="margin-bottom:14px"><span class="pill approved">${esc(notice)}</span></div>` : ""}
    <div class="panel">
      <h2 style="margin-top:0">${T(lang, "Scrape-terület kijelölése")}</h2>
      <p class="mut small" style="margin-top:0">Írj be egy települést vagy címet, majd állítsd be,
        hány kilométeres körzetben keressünk. A térképre kattintva is áthelyezheted a középpontot.</p>

      <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <input id="q" placeholder="${T(lang, "Település vagy cím — pl. Eger, Kossuth utca 5")}" style="flex:1;min-width:260px">
        <button type="button" class="btn" onclick="citSearch()">${T(lang, "Keresés")}</button>
        <span id="qmsg" class="mut small" style="align-self:center"></span>
      </div>

      <div id="map" style="height:52vh;min-height:340px;border-radius:10px;overflow:hidden;margin-bottom:12px"></div>

      <form method="post" action="/scrape/regions" id="areaForm">
        <div class="row" style="gap:12px;flex-wrap:wrap;align-items:flex-end">
          <div><label class="small mut" for="label">${T(lang, "Terület neve")}</label><br>
            <input id="label" name="label" required placeholder="${T(lang, "pl. Eger és környéke")}" style="min-width:240px"></div>
          <div><label class="small mut" for="id">${T(lang, "Azonosító (URL-barát)")}</label><br>
            <input id="id" name="id" required pattern="[a-z0-9-]+" placeholder="eger" style="min-width:160px"></div>
        </div>
        <div style="margin-top:14px">
          <label class="small mut" for="radiusKm">${T(lang, "Keresési sugár:")} <b id="rval">10</b> km</label><br>
          <input id="radiusKm" name="radiusKm" type="range" min="1" max="50" step="1" value="10"
                 style="width:min(420px,100%);accent-color:var(--citui-cyan-500)">
          <div class="mut small">${T(lang, "Nagyobb sugár = több találat, de több Google Places-hívás (költség).")}</div>
        </div>
        <div class="row" style="gap:10px;flex-wrap:wrap;margin-top:12px;align-items:flex-end">
          <div><label class="small mut" for="centerLat">${T(lang, "Középpont szélesség")}</label><br>
            <input id="centerLat" name="centerLat" required readonly style="width:140px"></div>
          <div><label class="small mut" for="centerLon">${T(lang, "Középpont hosszúság")}</label><br>
            <input id="centerLon" name="centerLon" required readonly style="width:140px"></div>
          <label class="small mut" style="align-self:flex-end"><input type="checkbox" name="active" checked> ${T(lang, "aktív")}</label>
        </div>
        <div style="margin-top:14px"><button type="submit">${T(lang, "Terület mentése")}</button>
          <span class="mut small" style="margin-left:10px">${T(lang, "Meglévő azonosító = felülírás.")}</span></div>
      </form>
    </div>
    <div class="panel">
      <h2>${T(lang, "Területek")} ${helpLink("console.scrape")}</h2>
      <div class="tblwrap"><table class="tbl"><thead><tr>
        <th>${T(lang, "Név")}</th><th>${T(lang, "Terület")}</th><th>Lead</th><th>${T(lang, "Állapot")}</th><th></th>
      </tr></thead><tbody>${rows}</tbody></table></div>
    </div>
    ${LEAFLET_JS}
    <script>
      var AREAS = ${JSON.stringify(regions)};
      var map = L.map('map').setView([47.16, 19.5], 7);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);

      // Saved areas as circles (fall back to the bbox centre for legacy rows).
      var bounds = [];
      AREAS.forEach(function (a) {
        var lat = a.centerLat != null ? a.centerLat : (a.south + a.north) / 2;
        var lon = a.centerLon != null ? a.centerLon : (a.west + a.east) / 2;
        var km = a.radiusKm != null ? a.radiusKm : 5;
        var c = L.circle([lat, lon], {
          radius: km * 1000, color: a.active ? '#1fb6d6' : '#60748b',
          weight: 1.5, fillOpacity: 0.06,
        }).bindTooltip(a.label + ' — ' + km.toFixed(1) + ' km · ' + a.leadCount + ' lead').addTo(map);
        bounds.push(c.getBounds());
      });
      if (bounds.length) map.fitBounds(bounds.reduce(function (a, b) { return a.extend(b); }), { padding: [30, 30] });

      // The area being edited: a solid circle + concentric guide rings at 1/3 and 2/3
      // of the radius, so the scale is readable at a glance.
      var center = null, ring = null, guides = [], marker = null;
      function radius() { return Number(document.getElementById('radiusKm').value); }
      function draw() {
        if (!center) return;
        [ring].concat(guides).forEach(function (l) { if (l) map.removeLayer(l); });
        guides = [];
        var km = radius();
        ring = L.circle(center, { radius: km * 1000, color: '#e5484d', weight: 2, fillOpacity: 0.08 }).addTo(map);
        [1 / 3, 2 / 3].forEach(function (f) {
          guides.push(L.circle(center, {
            radius: km * 1000 * f, color: '#e5484d', weight: 1, opacity: 0.45,
            dashArray: '4,6', fill: false,
          }).addTo(map));
        });
        if (marker) map.removeLayer(marker);
        marker = L.circleMarker(center, { radius: 4, color: '#e5484d', fillColor: '#e5484d', fillOpacity: 1 }).addTo(map);
        document.getElementById('centerLat').value = center[0].toFixed(5);
        document.getElementById('centerLon').value = center[1].toFixed(5);
        document.getElementById('rval').textContent = km;
      }
      function setCenter(lat, lon, zoom) {
        center = [lat, lon];
        draw();
        map.setView(center, zoom || Math.max(map.getZoom(), 11));
        map.fitBounds(ring.getBounds(), { padding: [30, 30] });
      }
      map.on('click', function (e) { setCenter(e.latlng.lat, e.latlng.lng); });
      document.getElementById('radiusKm').addEventListener('input', draw);

      // Address/town search — Nominatim (same free geocoder as the public site).
      window.citSearch = function () {
        var q = (document.getElementById('q').value || '').trim();
        var msg = document.getElementById('qmsg');
        if (!q) return;
        msg.textContent = 'Keresés…';
        fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q),
              { headers: { 'Accept': 'application/json' } })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (!d || !d.length) { msg.textContent = 'Nincs találat.'; return; }
            msg.textContent = d[0].display_name.slice(0, 70);
            setCenter(parseFloat(d[0].lat), parseFloat(d[0].lon), 12);
            var labelEl = document.getElementById('label');
            if (!labelEl.value) {
              labelEl.value = d[0].display_name.split(',')[0] + ' és környéke';
              labelEl.dispatchEvent(new Event('input'));
            }
          })
          .catch(function () { msg.textContent = 'A keresés nem sikerült.'; });
      };
      document.getElementById('q').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); citSearch(); }
      });

      window.citEditArea = function (a) {
        document.getElementById('id').value = a.id;
        document.getElementById('label').value = a.label;
        document.getElementById('id').dataset.touched = '1';
        document.getElementById('radiusKm').value = a.radiusKm != null ? Math.round(a.radiusKm) : 10;
        setCenter(
          a.centerLat != null ? a.centerLat : (a.south + a.north) / 2,
          a.centerLon != null ? a.centerLon : (a.west + a.east) / 2
        );
        document.getElementById('areaForm').scrollIntoView({ behavior: 'smooth' });
      };

      // Auto-suggest the slug from the name (until the operator types their own).
      document.getElementById('label').addEventListener('input', function (ev) {
        var idEl = document.getElementById('id');
        if (idEl.dataset.touched) return;
        idEl.value = ev.target.value.normalize('NFD').replace(/[̀-ͯ]/g, '')
          .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
      });
      document.getElementById('id').addEventListener('input', function (ev) { ev.target.dataset.touched = '1'; });
    </script>`;
  return layout(T(lang, "Területek"), body, { active: "/scrape", head: LEAFLET_HEAD });
}

/**
 * DUPLICATE REVIEW — the machine proposes groups, the operator rules once per
 * group.
 *
 * Ruling, not merging-on-sight: the same signals cover a real duplicate, one
 * hotel's six buildings, one owner's two businesses and a chain sharing a
 * website. Only a human separates those, and the wrong automatic call either
 * fuses two hotels or mails the same owner twice.
 *
 * The three verdicts map to what actually happens next:
 *   · duplicate  → one record kept (it absorbs the others' contacts), rest out
 *   · same_owner → all kept, flagged as one owner: ONE outreach, several sites
 *   · unrelated  → coincidence, never raise this group again
 */
// ── Súgó (ADR-0045/e): searchable knowledge base, help-center layout ────────
// Approved plan: design-refs/console/help-center (owner pick "B", 2026-09-02).
// TWO-TIER model (owner decree): the internal user sees EVERYTHING — operator
// guides AND the tenant guides (labeled), because support means seeing what the
// customer sees. The tenant admin help stays tenant-only on its own surface.

export interface KbTopicView {
  readonly id: string;
  readonly title: string;
  readonly snippet: string;
}

/** View model for helpPage — entries are loaded/filtered by the caller (server.ts). */
export interface ConsoleHelpView {
  readonly operatorTopics: ReadonlyArray<KbTopicView>;
  readonly tenantTopics: ReadonlyArray<KbTopicView>;
  readonly open: { id: string; title: string; html: string; updated: string } | null;
  readonly query: string;
}

/** Help-center page: no-JS GET search + grouped topic list ALWAYS beside the
 *  open article on desktop (the approved contract), single column on phone. */
export function helpPage(help: ConsoleHelpView): string {
  const lang = consoleLang();
  const activeId = help.open?.id ?? null;
  const qParam = help.query ? `&q=${encodeURIComponent(help.query)}` : "";
  const topicLink = (t: KbTopicView): string =>
    `<a href="/help?topic=${encodeURIComponent(t.id)}${qParam}#kb-art"${t.id === activeId ? ` class="act"` : ""}>` +
    `${esc(t.title)}<small>${esc(t.snippet)}…</small></a>`;
  const group = (label: string, tag: string | null, topics: readonly KbTopicView[]): string =>
    topics.length
      ? `<div class="con-kb-ghead">${esc(label)} (${topics.length})${tag ? ` <span class="tag">${esc(tag)}</span>` : ""}</div>` +
        topics.map(topicLink).join("")
      : "";
  const toc =
    group(T(lang, "Konzol-útmutatók"), null, help.operatorTopics) +
      group(
        T(lang, "Tenant-súgó — amit az ügyfél a saját adminján lát"),
        T(lang, "ügyfél is látja"),
        help.tenantTopics,
      ) ||
    `<p class="mut small" style="padding:8px 12px">${T(lang, "Nincs találat a keresésre — próbáld más szóval körülírni.")}</p>`;
  const art = help.open
    ? `<article class="con-kb-article">
         <h1 style="font-size:1.25rem;margin:8px 0 4px">${esc(help.open.title)}</h1>
         ${help.open.html}
         ${help.open.updated ? `<p class="mut small">${T(lang, "Frissítve:")} ${esc(help.open.updated)}</p>` : ""}
       </article>`
    : `<p class="con-kb-empty">${T(lang, "Válassz témát a listából — a cikk itt nyílik meg, a lista közben kéznél marad.")}</p>`;
  const body = `
    <div class="panel">
      <h2>${T(lang, "Súgó")}</h2>
      <p class="mut small" style="margin:0 0 12px">${T(lang, "Lépésről lépésre útmutatók a konzol minden képernyőjéhez és az ügyfél-admin felülethez. Ugyanide jutsz a képernyőkön látható")} ${ic("help", 14)} ${T(lang, "ikonokkal is.")}</p>
      <form method="get" action="/help" class="con-kb-search">
        <input type="search" name="q" value="${esc(help.query)}"
          placeholder="${esc(T(lang, "Mit keresel? (pl. mock, kuráció, fotó)"))}" aria-label="${esc(T(lang, "Keresés a súgóban"))}">
        <button type="submit">${T(lang, "Keresés")}</button>
      </form>
      <div class="con-kb-cols">
        <nav class="con-kb-toc">${toc}</nav>
        <div class="con-kb-art" id="kb-art">${art}</div>
      </div>
    </div>`;
  return layout(T(lang, "Súgó"), body, { active: "/help" });
}

export function duplicatesPage(clusters: DupClusterView[]): string {
  const lang = consoleLang();
  const SIGNAL_LABEL: Record<string, string> = {
    website: T(lang, "közös honlap"),
    phone: T(lang, "közös telefon"),
    email: T(lang, "közös e-mail"),
    proximity: "egy helyen",
  };
  const cards = clusters
    .map((c) => {
      const rows = c.leads
        .map(
          (l, i) => `<label class="dup-lead">
            <input type="radio" name="kept" value="${esc(l.id)}"${i === 0 ? " checked" : ""}>
            <span class="dup-lead__b">
              <a href="/lead/${esc(l.id)}" target="_blank" rel="noopener">${esc(l.name)}</a>
              <span class="mut small">${esc(l.city ?? "—")} · ${esc(l.qualification)}</span>
              <span class="mut small">${esc(l.email ?? "nincs e-mail")} · ${esc(l.phone ?? "nincs telefon")}</span>
              ${l.website ? `<a class="mut small" href="${esc(l.website)}" target="_blank" rel="noopener">${esc(l.website.slice(0, 46))}</a>` : ""}
            </span>
          </label>`,
        )
        .join("");
      const sig = c.signals.map((s) => `<span class="pill">${esc(SIGNAL_LABEL[s] ?? s)}</span>`).join(" ");
      // A geographically scattered group is the shape a shared agency website
      // produces — worth flagging, because it is usually NOT one business.
      const far =
        c.maxDistanceM != null && c.maxDistanceM > 1000
          ? `<p class="small" style="margin:6px 0 0;color:var(--citui-bad)">⚠️ ${T(lang, "{km} km választja el őket — több telephely vagy közös ügynökségi oldal lehet, nem ugyanaz az üzlet.", { km: (c.maxDistanceM / 1000).toFixed(1) })}</p>`
          : "";
      return `<div class="panel dup-card">
        <h2>${T(lang, "{n} összetartozónak látszó rekord", { n: c.leads.length })}</h2>
        <p class="small mut" style="margin:0 0 8px">Jelek: ${sig}${
          c.maxDistanceM != null ? ` · ${T(lang, "legtávolabbi pár: {m} m", { m: c.maxDistanceM })}` : ""
        }</p>
        ${far}
        <form method="post" action="/duplicates/rule">
          <input type="hidden" name="cluster" value="${esc(c.id)}">
          <input type="hidden" name="pairs" value="${esc(JSON.stringify(c.pairs))}">
          <input type="hidden" name="signal" value="${esc(c.signals.join("+"))}">
          <div class="dup-leads">${rows}</div>
          <p class="small mut" style="margin:8px 0 6px">${T(lang, "A rádiógomb csak az „ugyanaz” döntéshez kell: azt jelöld be, amelyiket MEGTARTJUK — a többi elérhetősége átkerül hozzá.")}</p>
          <div class="row dup-actions">
            <button type="submit" name="verdict" value="duplicate">${T(lang, "Ugyanaz — összevonás")}</button>
            <button type="submit" name="verdict" value="same_owner" class="ghost">${T(lang, "Egy tulaj több egysége")}</button>
            <button type="submit" name="verdict" value="unrelated" class="ghost">${T(lang, "Nem tartozik össze")}</button>
          </div>
        </form>
      </div>`;
    })
    .join("");
  const body = `
    <div class="panel">
      <h2>${T(lang, "Duplikátum-ellenőrzés")} ${helpLink("console.duplicates")}</h2>
      <p class="small mut" style="margin:0">Ugyanaz a vállalkozás többször is bekerülhet a listába — más néven,
        a tulaj neve alatt, vagy épületenként. A gép csak <b>javasol</b>; a döntést te hozod, és megjegyezzük,
        így ugyanazt a csoportot nem kérdezzük meg még egyszer.</p>
    </div>
    ${cards || `<div class="panel"><p class="mut">${T(lang, "Nincs eldöntetlen gyanús csoport.")}</p></div>`}`;
  return layout(T(lang, "Duplikátumok"), body, { active: "/duplicates" });
}

/** View model for duplicatesPage (mirrors DupCluster, decoupled from the DB layer). */
export interface DupClusterView {
  readonly id: string;
  readonly signals: string[];
  readonly maxDistanceM?: number;
  readonly pairs: { a: string; b: string }[];
  readonly leads: ReadonlyArray<{
    id: string;
    name: string;
    city?: string;
    website?: string;
    email?: string;
    phone?: string;
    qualification: string;
  }>;
}
