// Operator console — server-rendered HTML (hand-rolled template literals, the
// same approach as the mock render.ts). No framework, no emoji icons (design
// doctrine). Every dynamic value goes through esc().

import type {
  ArtifactView,
  ConversionView,
  LeadDetail,
  LeadListResult,
  LeadListRow,
  LeadQuery,
  OrderIntentView,
  PaymentView,
  ProspectView,
  TenantAdminView,
} from "./data.js";
import { normalizeCountry } from "./data.js";
import type { LeadColumnKey, LeadFilterDef } from "./leadFilters.js";
import {
  cellMarkMeanings,
  columnLabel,
  columnMeaning,
  decimalText,
  effectiveLeadSort,
  filterSummary,
  filterValue,
  isMatchBaseValue,
  LEAD_COLUMNS,
  LEAD_FILTERS,
  MOCK_STATUSES,
  mockStatusLabel,
  PLACES_PHOTO_CAP,
  unknownRegionLabel,
} from "./leadFilters.js";
import type { ContactCandidate, PortalListing } from "../scraper/types.js";
import { formatMoney } from "../text/money.js";

/** Cache-busting asset version: stamped at module load, so every deploy+restart
 *  serves fresh CSS/JS through the CDN without needing a cache purge. */
const ASSET_V = String(Date.now());

/** HUF formatter (thin-space grouping) for the operator views. */
function fmtHuf(n: number): string {
  return formatMoney(n, "HUF");
}

// Module catalog (05-MODULES.md) offered at conversion. Single-sourced in
// ../modules.js so the operator convert form and the prospect configurator
// never drift on module ids (they feed module_entitlement).
export { MODULE_CATALOG } from "../modules.js";
import { TEMPLATES } from "../engine/templates.js";
import { copyNames, groupAmenities, normForCopyMatch } from "../generator/marketCheck.js";
import { patternSummary, type PatternInputs } from "../generator/patternBadge.js";
import {
  MODULE_CATALOG,
  MULTILANG_TIERS,
  GROUP_LABELS,
  modulesForConversion,
  presetsAscending,
  presetAddedModules,
  presetNestingViolations,
} from "../modules.js";
import type { PricingSnapshot } from "../pricing.js";
import { huArticleLower } from "../hu.js";
import { formatDay } from "../text/day.js";
import { computeMonthly, computeAnnual, getModulePrice } from "../pricing.js";
import { ic } from "../ui/icons.js";
// ADR-0067 ③: the internal console is a HUMAN surface too — prepared for a
// non-Hungarian colleague. `lang` comes from the request context (i18nCtx).
import { T } from "../i18n/mail.js";
import { isNeverShownSubject } from "../generator/heroPick.js";
import type { GenStageKey } from "../generator/generateEngine.js";
import { proxiedPhotoUrl } from "./photoProxy.js";
import { uiLangs } from "../i18n/lang.js";
import { consoleLang } from "./i18nCtx.js";
import { PRIVACY_CUSTOMER_V1 } from "../legal.js";
import { checkOutreachLinkHost } from "../outreach/linkHost.js";
import { identityReason, type IdentityProblem } from "../outreach/outreachCheck.js";
import type { HeroShotState } from "../outreach/heroShot.js";
import type { MailSendability } from "../outreach/sendBatch.js";
import type { BlockingVerdict } from "../outreach/mockVerdictGate.js";
import { kbCategoriesFor } from "../kb/kbCategories.js";
import { pixelQueueScript } from "../server/consent.js";

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
): ReadonlyArray<{
  href: string;
  label: string;
  icon: string;
  match: string[];
  /** Dropdown entries under the top item (CSS hover/focus, no JS). */
  sub?: ReadonlyArray<{ href: string; label: string; sep?: boolean }>;
}> => [
  { href: "/", label: T(lang, "Irányítópult"), icon: "overview", match: ["/"] },
  {
    href: "/leads",
    label: T(lang, "CRM"),
    icon: "leads",
    match: ["/leads", "/lead/", "/scrape", "/duplicates", "/pricing"],
    // Frozen plan (assets/design-refs/console/pricing-sales): the CRM top item
    // opens a dropdown; pricing+sales lives INSIDE the CRM (owner, 2026-09-06).
    sub: [
      { href: "/leads", label: T(lang, "Lead-sor") },
      { href: "/leads?mock=approved", label: T(lang, "Jóváhagyott mockok") },
      { href: "/duplicates", label: T(lang, "Duplikátumok") },
      { href: "/scrape", label: T(lang, "Adatgyűjtés indítása") },
      { href: "/scrape/map", label: T(lang, "Térkép (lefedettség)") },
      { href: "/pricing", label: T(lang, "Árazás és értékesítés"), sep: true },
    ],
  },
  { href: "/documents", label: T(lang, "Pénzügy"), icon: "pricing", match: ["/documents", "/partner", "/accounting-document"] },
  { href: "/report", label: T(lang, "Riport"), icon: "report", match: ["/report"] },
  { href: "/settings", label: T(lang, "Beállítások"), icon: "settings", match: ["/settings"] },
  // ⛔ A központi súgó eddig CSAK URL-ből vagy egy képernyő ⓘ-ikonjából nyílt: a menüben nem
  // szerepelt, és a /help egyetlen menüpontot sem emelt ki — az operátor olyan lapon állt,
  // ami a navigációban nem létezik. Pont az a felület volt rejtve, ami az első mentőöv.
  // A helye a sor VÉGE (tulaj-döntés, 2026-09-13): a napi munka-menüpontok maradnak elöl.
  { href: "/help", label: T(lang, "Súgó"), icon: "help", match: ["/help"] },
];

/** ADR-0045/e §J: contextual help on a screen header. The data-kb-anchor is the
 *  coverage hook (kb-check --coverage, operator group): a screen carrying it MUST
 *  have an audience:operator KB entry.
 *
 *  `label` (ADR-0188): a lead-listán a horgony NEM a cím mellett ül ikonként, hanem a
 *  jelmagyarázat-felugró lábazatában, feliratos linkként — egy mondat végén egy néma
 *  ikon nem mondja meg, hova visz (`feedback_directions_should_be_names`). Az alapeset
 *  (címke nélkül, ikon) VÁLTOZATLAN: a többi képernyő ugyanazt kapja, mint eddig. */
export function helpLink(anchor: string, label = ""): string {
  const lang = consoleLang();
  return (
    `<a class="con-help${label ? " con-help--text" : ""}" data-kb-anchor="${anchor}" ` +
    `href="/help?topic=${encodeURIComponent(anchor)}" ` +
    `title="${esc(T(lang, "Súgó ehhez a képernyőhöz"))}">${ic("help", 16)}` +
    `${label ? `<span>${esc(label)}</span>` : ""}</a>`
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
  // ⛔ uiLangs(), NOT siteLangs() (ADR-0128): the sellable set is 29 languages, but this
  // picker may only offer what the console is actually written in. Offering more would let
  // an operator land on a language where every string silently falls back to Hungarian.
  const options = uiLangs()
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
        .map((m) => {
          const top = `<a href="${m.href}"${m.href === mod ? ` class="active"` : ""}>${ic(m.icon, 17)}${esc(m.label)}</a>`;
          if (!m.sub) return top;
          const dd = m.sub
            .map(
              (x) =>
                `${x.sep ? `<div class="con-dd__sep"></div>` : ""}<a href="${x.href}">${esc(x.label)}</a>`,
            )
            .join("");
          return `<span class="con-nav__it">${top}<div class="con-dd">${dd}</div></span>`;
        })
        .join("")}</nav>
       <div class="con-user">${langSwitcher(lang)}<a href="/logout">${T(lang, "Kilépés")}</a></div>`
    : "";
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — ${T(lang, "Citoviso konzol")}</title>
<link rel="icon" href="/assets/ui/mark-gradient.svg" type="image/svg+xml">
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
<link rel="icon" href="/assets/ui/mark-gradient.svg" type="image/svg+xml">
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
/** Alert-recipient state for the settings page (ADR-0098/c). */
export interface AlertSettingsView {
  /** Stored DB values ('' = not set → fallback applies). */
  readonly phone: string;
  readonly email: string;
  /** Machine-level env fallback for the phone (shown as inherited value). */
  readonly envPhone: string;
}


/** ADR-0111: one market row — status, who opened it, and the way to change that. */
export interface MarketView {
  readonly country: string;
  readonly approved: boolean;
  readonly approvedBy: string | null;
  readonly approvedAt: Date | null;
  readonly note: string | null;
  /** True for the home market: its pack is the product's foundation, not a decision here. */
  readonly home: boolean;
  readonly log: readonly { action: string; actor: string; reason: string; at: Date }[];
}

/**
 * ADR-0111 — the markets panel.
 *
 * Follows the APPROVED opt-out-revocation pattern exactly: the action sits behind a
 * closed <details> (opening a market is not a stray click), the reason is mandatory
 * and server-enforced, and the decision log stays visible on the row — otherwise
 * "why is Poland open?" is unanswerable without the database.
 */
function marketsPanel(markets: readonly MarketView[], notice: { ok: boolean; text: string } | null): string {
  const lang = consoleLang();
  const fmt = (d: Date | null): string =>
    d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") : "—";

  const rows = markets
    .map((m) => {
      const log = m.log.length
        ? `<ul class="mkt-log">${m.log
            .map(
              (l) =>
                `<li><span class="mut small">${esc(fmt(l.at))} · ${esc(l.actor)} · ` +
                `${esc(l.action === "approve" ? T(lang, "megnyitva") : T(lang, "lezárva"))}</span> — ${esc(l.reason)}</li>`,
            )
            .join("")}</ul>`
        : "";
      const action = m.home
        ? `<p class="mut small" style="margin:6px 0 0">${T(lang, "Hazai piac — a teljes jogi csomag erre készült; innen nem zárható le.")}</p>`
        : m.approved
          ? `<details class="mkt-act">
              <summary>${T(lang, "Piac lezárása ▸")}</summary>
              <p class="mut small" style="margin:6px 0">${T(lang, "A lezárás a JÖVŐRE hat: új megkeresés, új rendelés és élesítés nem indul. A már futó előfizetések megújulását nem érinti.")}</p>
              <form method="post" action="/settings/markets" class="mkt-form">
                <input type="hidden" name="country" value="${esc(m.country)}">
                <input type="hidden" name="action" value="revoke">
                ${/* ⛔⛔ MÉRVE 2026-09-15: ez a három indoklás-placeholder `esc()` NÉLKÜL ment
                      az attribútumba. A MAGYAR forrásban nincs `"`, A FORDÍTÁSBAN VAN — az
                      `en`/`it` csomag idézőjellel adja vissza a PÉLDÁT, az pedig lezárja az
                      attribútumot: mérve `placeholder` → „On what basis? (e.g. " (a példa
                      ELTŰNIK), plusz 6 szemét-attribútum. A `name`/`required`/`minlength`
                      csak azért él, mert MEGELŐZI. Mindhárom hely KÖTELEZŐ, NAPLÓZOTT
                      indoklás jogilag érzékeny műveletnél (piac-kapu, opt-out visszavonás),
                      tehát épp az az útmutatás vész el, ami megmondja, mit írjon a kezelő.
                      Őr: scripts/dialog-fires-check.mts (a placeholder csonkolatlansága). */ ""}
                <input type="text" name="reason" required minlength="3"
                  placeholder="${esc(T(lang, "Miért zárjuk le? (pl. „a lengyel opt-in szabályozás felülvizsgálat alatt”)"))}">
                <button type="submit">${T(lang, "Lezárás")}</button>
              </form>
            </details>`
          : `<details class="mkt-act">
              <summary>${T(lang, "Piac megnyitása ▸")}</summary>
              <p class="ob-law">${T(lang, "A megnyitás felelősségvállalás: kijelented, hogy ennek az országnak a jogi csomagja (ÁSZF, elállás, adatkezelés, megkeresési szabályok) kész és felülvizsgált. Amíg zárva van, erre az országra nem megy hideg megkeresés, nem adható ki fizetési link és nem élesíthető oldal.")}</p>
              <form method="post" action="/settings/markets" class="mkt-form">
                <input type="hidden" name="country" value="${esc(m.country)}">
                <input type="hidden" name="action" value="approve">
                <input type="text" name="reason" required minlength="3"
                  placeholder="${esc(T(lang, "Mire hivatkozva? (pl. „lengyel jogi csomag 1.0, ügyvédi felülvizsgálat 2026-10-01”)"))}">
                <button type="submit">${T(lang, "Megnyitás")}</button>
              </form>
            </details>`;
      return `<div class="mkt-row">
        <div class="row" style="justify-content:space-between;align-items:baseline;gap:10px">
          <strong>${esc(m.country)}</strong>
          <span class="pill ${m.approved ? "approved" : "rejected"}">${
            m.approved ? T(lang, "nyitva") : T(lang, "zárva")
          }</span>
        </div>
        ${
          m.approved
            ? `<p class="mut small" style="margin:4px 0 0">${T(lang, "Megnyitotta: {who} · {when}", {
                who: m.approvedBy ?? "—",
                when: fmt(m.approvedAt),
              })}${m.note ? ` — ${esc(m.note)}` : ""}</p>`
            : ""
        }
        ${action}
        ${log}
      </div>`;
    })
    .join("");

  return `<div class="panel" style="max-width:560px">
      <h2>${T(lang, "Piacok — jogi csomag")} ${helpLink("console.markets")}</h2>
      <p class="mut small" style="margin:0 0 10px">${T(lang, "Egy ország akkor nyitott, ha a jogi csomagja kész. Zárt piacra nem megy hideg megkeresés, nem adható ki fizetési link, és nem élesíthető oldal — a mock és a mintaoldal viszont szabadon készül. A lista azokat az országokat mutatja, amelyekkel már találkoztunk (scrape-terület vagy vevő).")}</p>
      ${notice ? `<div class="row" style="margin:0 0 10px"><span class="pill ${notice.ok ? "approved" : "rejected"}">${esc(notice.text)}</span></div>` : ""}
      ${rows}
    </div>`;
}

export function settingsPage(
  op: { username: string; displayName: string; role: string },
  notice: { ok: boolean; text: string } | null = null,
  alerts: AlertSettingsView = { phone: "", email: "", envPhone: "" },
  alertNotice: { ok: boolean; text: string } | null = null,
  /** ADR-0111: markets + the flash of the last decision. */
  markets: readonly MarketView[] = [],
  marketNotice: { ok: boolean; text: string } | null = null,
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
      <h2>${T(lang, "Üzemi riasztások — ide szól a rendszer")}</h2>
      <p class="mut small" style="margin:0 0 10px">${T(lang, "Ide megy MINDEN üzemi riasztás: az AAM-keret (18 M Ft/év) 80%/100%-a, a törött MMS+SMS pár, a .hu megerősítő link, a kifizetett, de többszöri próbálkozás után sem elkészült modul-generálás, és a megrekedt rendelés (a vevő megrendelt, de fizetési linket nem kapott). Üres e-mail = e-mail csatorna ki; üres SMS-szám = a gép-szintű alap érvényes (ha van).")}</p>
      ${alertNotice ? `<div class="row" style="margin:0 0 10px"><span class="pill ${alertNotice.ok ? "approved" : "rejected"}">${esc(alertNotice.text)}</span></div>` : ""}
      <form method="post" action="/settings/alerts" style="display:block;max-width:340px">
        <label class="small mut" for="al-phone">${T(lang, "SMS-szám")}</label>
        <input id="al-phone" name="phone" type="tel" inputmode="tel" value="${esc(alerts.phone)}"
          placeholder="${esc(alerts.envPhone ? T(lang, "{n} (gép-szintű alap)", { n: alerts.envPhone }) : "+36 30 123 4567")}"
          style="width:100%;margin:4px 0 10px">
        <label class="small mut" for="al-email">${T(lang, "E-mail címek")}</label>
        <input id="al-email" name="email" type="email" multiple value="${esc(alerts.email)}"
          placeholder="pl. tulaj@citoviso.com, sajat@gmail.com" style="width:100%;margin:4px 0 4px">
        <p class="mut small" style="margin:0 0 12px">${T(lang, "Több cím is megadható, vesszővel elválasztva — mindegyikre elmegy a riasztás.")}</p>
        <button type="submit">${T(lang, "Riasztási címzettek mentése")}</button>
      </form>
    </div>
    ${markets.length ? marketsPanel(markets, marketNotice) : ""}
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
/**
 * ADR-0128 — a Többnyelvű modul SÁV-árai az Árazás lapon. A sávok nem katalógus-
 * modulok (egy modul csomagméretei), ezért a fenti `MODULE_CATALOG`-ciklus nem
 * látja őket — enélkül a kártya azt ígérné, hogy az árak szerkeszthetők, miközben
 * kettőnek nincs is mezője (a másik szál tudasbazis-őre mérte ki, 2026-09-13).
 * Az Alap sor NEM ismétlődik: az a katalógus `multilang` sora.
 */
function multilangTierRows(
  snap: { modulePrices: ReadonlyMap<string, number> },
  lang: string,
): string {
  return MULTILANG_TIERS.filter((t) => t.priceId !== "multilang")
    .map((t) => {
      const price = snap.modulePrices.get(t.priceId) ?? t.priceDefault;
      return `<div class="pr-mod pr-mod--sub">
            <span></span>
            <span class="pr-mod__name"><span class="pr-mod__n mut">↳ ${esc(t.name)} — ${esc(
              t.cap === null ? T(lang, "mind a nyelv") : T(lang, "legfeljebb {n} nyelv", { n: t.cap }),
            )}</span></span>
            <span class="pr-mod__price"><input name="m_${esc(t.priceId)}" type="number" min="0" step="1" inputmode="numeric" value="${esc(price)}"><span class="pr-mod__u">${T(lang, "Ft / alkalom")}</span></span>
          </div>`;
    })
    .join("");
}

export function pricingPage(
  snap: PricingSnapshot,
  regions: PricingSnapshot[],
  notice: { ok: boolean; text: string } | null = null,
  /** Module-sales switch (frozen plan pricing-sales): ids not sellable now. */
  disabledSales: ReadonlySet<string> = new Set(),
  /** Active module_entitlement counts per module id — context for switching off. */
  liveCounts: ReadonlyMap<string, number> = new Map(),
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
          if (m.spine)
            return `<div class="pr-mod"><span class="pr-mod__n mut">${esc(m.label)}</span>
              <span class="mut small">${T(lang, "gerinc — az alapdíjban")}</span></div>`;
          const price = snap.modulePrices.get(m.id) ?? 0;
          const live = liveCounts.get(m.id) ?? 0;
          const off = disabledSales.has(m.id);
          // Frozen plan: switch · name · live chip · SHORT price input · unit; an
          // OFF row strikes the name and says what the switch means. The :has()
          // twin in the CSS mirrors .off live, before the save round-trips.
          return `<div class="pr-mod${off ? " off" : ""}">
            <label class="con-sell"><input type="checkbox" name="sell_${esc(m.id)}"${off ? "" : " checked"}><span class="con-sell__track"></span></label>
            <span class="pr-mod__name"><span class="pr-mod__n">${esc(m.label)}</span>${
              live ? `<span class="pill approved">${live} ${T(lang, "élő")}</span>` : ""
            }<span class="pr-mod__why">${T(lang, "Leállítva — új előfizetés nem köthető rá; a meglévők futnak tovább.")}</span></span>
            <span class="pr-mod__price"><input name="m_${esc(m.id)}" type="number" min="0" step="1" inputmode="numeric" value="${esc(price)}"><span class="pr-mod__u">${m.billing === "once" ? T(lang, "Ft / alkalom") : T(lang, "Ft / hó")}</span></span>
          </div>${m.id === "multilang" ? multilangTierRows(snap, lang) : ""}`;
        })
        .join("");
      return `<div class="pr-group">${esc(GROUP_LABELS[g])}</div>
              <div class="pr-modgrid">${cells}</div>`;
    })
    .join("");

  const confirmNote = snap.pricingConfirmed
    ? `<span class="pill approved">${T(lang, "az árak véglegesítve — a levelek árat hirdethetnek")}</span>`
    : `<span class="pill rejected">${T(lang, "nincs véglegesítve — a jogszerűségi kapu blokkol minden árat hirdető levelet")}</span>`;

  // Module add-ons live in ONE global (HUF) table — editable on the HU page only,
  // to avoid the illusion of per-region module prices (a follow-up slice).
  const modulesSection =
    snap.region === "hu"
      ? `<h3 style="margin-top:22px">${T(lang, "Modul-felárak és értékesítés")}</h3>
         <p class="mut small" style="margin:2px 0 6px">${T(lang, "A kikapcsolt modult új ügyfél nem kapja meg (konfigurátor, kiküldött mock, konverzió) — a meglévő előfizetéseket nem érinti.")}</p>${groupBlocks}`
      : `<h3 style="margin-top:18px">${T(lang, "Modul-felárak és értékesítés")}</h3>
         <p class="mut small">A modul-felárak jelenleg globálisak (HUF); a
         <a href="/pricing?region=hu">${T(lang, "Magyarország")}</a> ${T(lang, "oldalon szerkeszthetők.")}</p>`;

  /**
   * Díjcsomagok — mit tartalmaz és mennyibe kerül (owner request 2026-09-07).
   *
   * ⛔ OWNER RULE: "ami az alacsonyabb csomagban benne van, az benne van a
   * magasabb csomagban is." The tiers are DERIVED from each other in modules.ts,
   * so the rule cannot drift; here we RENDER it — each tier shows what it
   * inherits and what it adds, which is the rule made visible rather than
   * asserted in prose. If it were ever violated, the guard line below says so
   * out loud instead of drawing a tidy lie.
   */
  const tierBlock = ((): string => {
    // Module prices are the GLOBAL HUF list; on other region pages the tier
    // prices would be a different currency's numbers with HUF add-ons mixed in,
    // so we only draw the breakdown where it is honest.
    if (snap.region !== "hu") return "";
    const violations = presetNestingViolations();
    const nameOf = (id: string): string =>
      MODULE_CATALOG.find((m) => m.id === id)?.label ?? id;
    const cards = presetsAscending()
      .map((p, idx) => {
        // ⛔ Price what the buyer can ACTUALLY get: a module switched off for
        // sale is not in the package, so counting it would show a figure nobody
        // can be charged (the configurator already excludes it — the two screens
        // must not disagree about the same package).
        const sellable = p.modules.filter((id) => !disabledSales.has(id));
        const monthly = computeMonthly(sellable, snap.region);
        const annual = computeAnnual(sellable, snap.region);
        const added = presetAddedModules(p.id);
        const inherited = p.modules.filter((id) => !added.includes(id));
        const chip = (id: string, faded: boolean): string => {
          const off = disabledSales.has(id);
          const price = getModulePrice(id, snap.region);
          return (
            `<span class="pr-tier__chip${faded ? " pr-tier__chip--inh" : ""}"` +
            (off ? ` title="${esc(T(lang, "jelenleg nem eladó"))}"` : "") +
            `>${esc(nameOf(id))}` +
            (price > 0 ? `<i>+${esc(String(price))}</i>` : `<i>${esc(T(lang, "az árban"))}</i>`) +
            (off ? `<b>${esc(T(lang, "nem eladó — nincs az árban"))}</b>` : "") +
            `</span>`
          );
        };
        return (
          `<div class="pr-tier">` +
          `<div class="pr-tier__head"><b>${esc(p.label)}</b>` +
          `<span class="pr-tier__price">${esc(fmtHuf(monthly))}<i> / ${esc(T(lang, "hó"))}</i></span></div>` +
          `<div class="pr-tier__note">${esc(p.note)}</div>` +
          `<div class="pr-tier__sub">${T(lang, "Éves előrefizetéssel {price} / év", { price: esc(fmtHuf(annual)) })} · ` +
          `${T(lang, "{n} modul", { n: String(sellable.length) })}</div>` +
          (idx > 0
            ? // ⛔ ADR-0101 ①: "a(z)" tilos — a névelőt a huArticle dönti el.
              `<div class="pr-tier__inh">${T(lang, "Minden {art} {prev} csomagból:", { art: huArticleLower(presetsAscending()[idx - 1]!.label), prev: esc(presetsAscending()[idx - 1]!.label) })}</div>` +
              `<div class="pr-tier__chips">${inherited.map((id) => chip(id, true)).join("")}</div>` +
              `<div class="pr-tier__plus">${T(lang, "Ebben jön még:")}</div>`
            : `<div class="pr-tier__plus">${T(lang, "Tartalma:")}</div>`) +
          `<div class="pr-tier__chips">${added.map((id) => chip(id, false)).join("")}</div>` +
          `</div>`
        );
      })
      .join("");
    const warn = violations.length
      ? `<p class="mut small" style="color:var(--citui-bad-ink);margin:8px 0 0">` +
        `${T(lang, "⛔ A csomag-szabály SÉRÜL:")} ` +
        esc(
          violations
            .map((v) => `${v.tier} ← ${v.from}: ${v.missing.map(nameOf).join(", ")}`)
            .join(" · "),
        ) +
        `</p>`
      : "";
    return (
      `<h3 style="margin-top:22px">${T(lang, "Díjcsomagok")}</h3>` +
      `<p class="mut small" style="margin:2px 0 8px">${T(lang, "Amit az alacsonyabb csomag tartalmaz, azt a magasabb is tartalmazza. Az árak az alapdíjból és a bekapcsolt modulok felárából állnak össze — a lenti mezők módosításával azonnal változnak.")}</p>` +
      `<div class="pr-tiers">${cards}</div>${warn}`
    );
  })();

  const body = `
    <a class="con-back" href="/"><span aria-hidden="true">←</span> ${T(lang, "Vissza a vezérlőpultra")}</a>
    <div class="panel" style="max-width:980px;margin:0 auto">
      <h2>${T(lang, "Árazás és értékesítés")} ${helpLink("console.pricing")}</h2>
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
          ${priceField("custom_domain_monthly", T(lang, "Saját domain (rajtunk keresztül)"), snap.customDomainMonthly, `${unit} ${T(lang, "/ hó")}`)}
        </div>
        <p class="mut small" style="margin:6px 0 0">Az „ingyen hónapok” az éves előrefizetés
          kedvezménye — pl. <strong>2</strong> ${T(lang, "= két hónap ingyen, azaz 10 hónap árát fizeti.")}</p>

        <h3 style="margin-top:22px">${T(lang, "Egyedi domain — feltételek")}</h3>
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
          ${priceField("domain_min_package_monthly", T(lang, "Saját domain ekkora csomagtól választható"), snap.domainMinPackageMonthly, `${unit} ${T(lang, "/ hó")}`)}
          ${priceField("domain_buyout_price", T(lang, "Domain vételára (korai kilépéskor)"), snap.domainBuyoutPrice, unit)}
        </div>
        <p class="mut small" style="margin:6px 0 0">${T(lang, "A saját domain HAVI díjas, és csak a megadott csomagmérettől választható — a küszöböt a LISTAÁR dönti el, kedvezmény nem számít bele. A plafon a regisztrátori vételt védi (prémium domaint nem veszünk). A hűségidő alatt nincs szabad lemondás: korai kilépés = a hátralévő hónapok díja (kötbér), plusz a domain vételára, HA a kilépő a domaint el is viszi. A hűségidő letelte után nincs kötbér és nincs csomag-padló — csak a havidíj fut tovább.")}</p>

        ${tierBlock}
        ${modulesSection}

        <label class="row" style="gap:12px;align-items:flex-start;margin:20px 0 4px;
               padding:14px 16px;border:1px solid var(--citui-line-strong);border-radius:10px;
               background:var(--citui-surface-2);cursor:pointer;flex-wrap:nowrap">
          <input type="checkbox" name="pricing_confirmed"${snap.pricingConfirmed ? " checked" : ""}
            style="width:22px;height:22px;flex:0 0 auto;margin-top:1px;cursor:pointer">
          <span style="min-width:0"><strong>${T(lang, "Az árak véglegesek, élesíthetők")}</strong>
            <span class="mut small" style="display:block;margin-top:2px">${T(lang, "Enélkül a levél nem hirdethet árat, és a nyilvános oldal „Egyedi ajánlat”-ot mutat (Fttv. / jogszerűségi kapu).")}</span></span>
        </label>

        <div class="row" style="margin-top:12px">
          <button class="ok" type="submit">${T(lang, "Árazás mentése ({region})", { region: esc(regionLabel(snap.region)) })}</button>
        </div>
      </form>
    </div>`;
  return layout(T(lang, "Árazás és értékesítés"), body, { active: "/pricing" });
}

/**
 * MATCH cella — jóváhagyott terv ④ + ⑥ (`assets/design-refs/console/lead-list/`).
 *
 * ⛔ Három mért hiba egy cellában: (1) `toFixed` mindig PONTOT ad, magyar felületen hibás
 * alak; (2) a néma „–" nem mondta meg, MIÉRT nincs érték (109 lead); (3) a 0,85 a képlet
 * ALAPÉRTÉKE — 54 lead áll pontosan itt —, de a felület mért egyezésként mutatta.
 */
function confCell(c: number | null): string {
  const lang = consoleLang();
  if (c == null)
    return (
      `<span class="con-nomatch" title="${T(lang, "A gyűjtés nem talált portál-profilt ehhez a szálláshoz, ezért nincs mit összevetni.")}">` +
      `${T(lang, "nincs találat")}</span>`
    );
  const txt = esc(decimalText(c, lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  if (!isMatchBaseValue(c)) return txt;
  return (
    `<span class="con-basev" title="${T(lang, "A képlet ALAPÉRTÉKE: nincs mért egyezés, a pontszám a kiinduló súlyból jött.")}">` +
    `${txt}</span>`
  );
}

/** Build a query string from the current query with overrides applied. */
function qs(q: LeadQuery, over: Record<string, string | number | boolean | undefined>): string {
  // `defaulted` is a RENDER flag, not a filter — echoing it back would let a reload
  // claim "default filter" over a hand-picked query. `all` IS carried: that is what
  // keeps a cleared list cleared across a view switch.
  const { defaulted: _defaulted, ...rest } = q;
  const merged: Record<string, unknown> = { ...rest, ...over };
  if (merged.all === true) merged.all = "1";
  if (merged.all === false || merged.all == null) delete merged.all;
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

/**
 * Sortable header link (toggles asc/desc).
 *
 * ⛔ Elek, 2026-09-12: the arrow only appeared on the ALREADY sorted column, so on an
 * unsorted list nothing said the header was clickable at all — measured, the link had
 * the same colour as the plain header text and no underline, leaving `cursor:pointer`
 * as the sole hint, and a phone has no cursor. A ten-column sort feature nobody can
 * see is not a feature. Every sortable header now carries a faint ↕ that turns into
 * the live ↑/↓ when it is the active sort.
 *
 * Sorting also resets to page 1: re-ordering 593 rows while staying on page 6 lands
 * the operator in the middle of a list they have not seen the start of.
 */
function sortHead(label: string, key: string, q: LeadQuery): string {
  const lang = consoleLang();
  // The EFFECTIVE sort, not just the one in the query: an untouched list is ordered
  // too ("legutóbb felmért elöl"), and while that lived only in a DB `order by`, all
  // ten arrows stood neutral on a page that claimed an order (Elek FK-003 Z1).
  const eff = effectiveLeadSort(q);
  const active = eff.key === key;
  const nextDir = active && eff.dir !== "asc" ? "asc" : "desc";
  const mark = active ? (eff.dir === "asc" ? "↑" : "↓") : "↕";
  return (
    `<a class="con-sorth${active ? " on" : ""}" href="${qs(q, { sort: key, dir: nextDir, page: undefined })}"` +
    ` title="${esc(T(lang, "Rendezés e szerint az oszlop szerint"))}">${esc(label)}` +
    `<span class="con-sorth__m" aria-hidden="true">${mark}</span></a>`
  );
}

/**
 * When the scrape recorded this player. DATE only in the cell (the column has to fit
 * next to ten others), the exact moment in the tooltip — the list is ordered by this
 * value, so the operator has to be able to check the order down to the minute when
 * two rows share a day.
 */
function surveyedCell(iso: string, lang: string): string {
  const d = iso.slice(0, 10);
  const exact = iso.slice(0, 16).replace("T", " ");
  return `<span title="${T(lang, "Felmérve: {when} (UTC)", { when: esc(exact) })}">${esc(d)}</span>`;
}

/**
 * The Terület VALUE as the operator may read it — ONE implementation, shared by the lead
 * list cell and the lead page's facts row.
 *
 * ⛔ WHY IT IS A FUNCTION AND NOT TWO COPIES: ADR-0143 taught this column to say the
 * STATE ("nincs besorolás") instead of the scrape key, and put the key in the tooltip —
 * but it taught only the LIST. The lead page kept its own one-liner, `esc(d.region)`, so
 * the same rule had two implementations and therefore two truths on two screens (Elek
 * FK-003b L15). A rule that lives in one place cannot drift out of the other.
 *
 * ⛔ NOT the raw key. `bs` / `_test` / `Balaton` are scrape-definition identifiers;
 * printed as a value they read as place names — and `Balaton` reads as a perfectly
 * ordinary one (Elek FK-003 H1). A missing classification is a STATE, so the surface
 * names the state; the id stays reachable as diagnostics, never as the label (ADR-0126).
 */
function areaValueHtml(
  r: { region: string; regionLabel: string; regionKnown: boolean },
  lang: string,
): string {
  return r.regionKnown
    ? esc(r.regionLabel)
    : `<span class="q-bad" title="${T(lang, "Ehhez a gyűjtési körhöz nincs felvett terület-rekord, ezért a területnek nincs neve. Belső azonosító: {id}", { id: esc(r.region) })}">${esc(unknownRegionLabel(lang))}</span>`;
}

/**
 * FOTÓK cella — jóváhagyott terv ⑤ (`assets/design-refs/console/lead-list/`).
 *
 * ⛔ A Google Places legfeljebb {@link PLACES_PHOTO_CAP} fotót ad vissza, tehát a 10 PLAFON,
 * nem darabszám — mérve 2026-09-14: 595 leadből **365-nek** pontosan 10, 168-nak 0, vagyis a
 * készlet 90 %-a a két szélsőértéken ül. A cella eddig darabszámként mutatta: „10" és „10
 * vagy több" két KÜLÖNBÖZŐ állítás, és a lista az elsőt mondta, miközben a másodikat tudta.
 */
function photoCell(n: number, sv: boolean): string {
  const lang = consoleLang();
  const cls = n >= 3 ? "q-good" : n >= 1 ? "q-mid" : "q-bad";
  const atCap = n >= PLACES_PHOTO_CAP;
  const cap = atCap
    ? `<span class="con-cap" title="${T(lang, "A Google Places legfeljebb {cap} fotót ad vissza — ez a felső korlát, nem a szállás fotóinak száma.", { cap: String(PLACES_PHOTO_CAP) })}">${T(lang, "plafon")}</span>`
    : "";
  return (
    `<span class="${cls}">${n}${atCap ? "+" : ""}</span>${cap}` +
    `${sv ? `<span class="sv">SV</span>` : ""}`
  );
}

function contactCell(c: string): string {
  const lang = consoleLang();
  const cls = c === "email" ? "q-good" : c === "none" ? "q-bad" : "q-mid";
  // The raw channel id is DATA, not copy — printed as-is it leaked English
  // ("none", "voice") into the Hungarian column (Elek lelet, 2026-09-04).
  const label =
    c === "email"
      ? T(lang, "e-mail")
      : c === "sms"
        ? "SMS"
        : c === "voice"
          ? T(lang, "telefon")
          : c === "none"
            ? T(lang, "nincs")
            : c;
  return `<span class="${cls}">${esc(label)}</span>`;
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
  /** The active filter's own sentence (`<Oszlop>: <feltétel>`), empty when idle. */
  summary = "",
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
  // ⛔ KÉT JELENTÉS = KÉT ALAK (jóváhagyott terv ⑦). Ez a jelvény azt mondja, HÁNY értéket
  // pipált ki az operátor — kerek, kitöltött cián pötty. A `minFilter` küszöb-jelvénye
  // szögletes és `≥` jelet visel; eddig a kettő pixelre ugyanúgy nézett ki, vagyis az
  // „1+" (küszöb) és az „1" (egy kipipált érték) megkülönböztethetetlen volt.
  return `<span class="cf">
    <button type="button" class="cf-btn${on ? " on" : ""}" onclick="citCf(this)"
            aria-label="${on ? esc(summary) : T(lang, "szűrés")}"
            title="${on ? esc(summary) : T(lang, "Szűrés: hány értéket pipáltál ki")}"
            ${on ? `data-filter-summary="${esc(summary)}"` : ""}>
      ${ic("filter", 14)}${on ? `<i class="cf-count">${on}</i>` : ""}
    </button>
    <span class="cf-pop" hidden>
      ${options.length > 6 ? `<input type="text" class="cf-search" placeholder="${T(lang, "keresés…")}" oninput="citCfSearch(this)" onclick="event.stopPropagation()">` : ""}
      <span class="cf-list">${items}</span>
      <span class="cf-hint mut small">${T(lang, "A kerek, cián jelvény azt mutatja, hány értéket pipáltál ki.")}</span>
    </span>
  </span>`;
}

/**
 * Numeric "at least" filter in a header (photos, material, match).
 *
 * `step`/`max` exist because Match is a 0–1 score, not a count: an integer stepper
 * there would offer 1 and 2 as the only settings above zero, i.e. "perfect match" or
 * "impossible" — a control that cannot express the question the operator has.
 * `hint` names what the number means, inside the popup where the number is typed.
 */
function minFilter(
  name: string,
  value?: number,
  opts: { step?: string; max?: string; hint?: string; summary?: string } = {},
): string {
  const lang = consoleLang();
  // ⛔ KÜSZÖB-jelvény: SZÖGLETES, körvonalas, `≥` jellel — hogy egy pillantásra elváljon a
  // colFilter kerek DARABSZÁM-pöttyétől (jóváhagyott terv ⑦). A régi `1+` alak ugyanabban a
  // cián körben ült, mint a „egy értéket kipipáltam" jelzés: két jelentés, egy kép.
  // A szám a felület nyelvén (`0,05`-ös lépésű Match-küszöb magyarul vesszővel).
  const badge = value
    ? `<i class="cf-thresh">≥${esc(decimalText(value, lang))}</i>`
    : "";
  const summary = opts.summary ?? "";
  return `<span class="cf">
    <button type="button" class="cf-btn${value ? " on" : ""}" onclick="citCf(this)"
            aria-label="${value ? esc(summary) : "minimum"}"
            title="${value ? esc(summary) : T(lang, "Küszöb: legalább ennyi")}"
            ${value ? `data-filter-summary="${esc(summary)}"` : ""}>
      ${ic("filter", 14)}${badge}
    </button>
    <span class="cf-pop" hidden>
      <label class="cf-opt" style="gap:6px">${T(lang, "legalább")}
        <input type="number" name="${esc(name)}" min="0"${opts.max ? ` max="${esc(opts.max)}"` : ""}${
          opts.step ? ` step="${esc(opts.step)}"` : ""
        } value="${value ?? ""}" style="width:70px"
               onchange="this.form.submit()" onclick="event.stopPropagation()"></label>
      ${opts.hint ? `<span class="cf-hint mut small">${esc(opts.hint)}</span>` : ""}
      <span class="cf-hint mut small">${T(lang, "A szögletes, „≥” jeles jelvény alsó határt jelent, nem darabszámot.")}</span>
    </span>
  </span>`;
}

/**
 * Display text for one filter option code, per column — the same wording the CELL
 * of that column prints. Fed to `filterSummary()` so the summary sentence and the
 * cells speak one language.
 */
function leadOptionLabel(
  column: LeadColumnKey,
  code: string,
  regionLabels: Map<string, string>,
  lang: string,
): string {
  // The empty bucket = leads whose scrape area has no `region` record. It is ONE
  // option, not one per raw key: `bs` and `_test` are not two places, they are two
  // unregistered scrape definitions, and the operator's question is the same for both.
  if (column === "region") return code === "" ? unknownRegionLabel(lang) : (regionLabels.get(code) ?? code);
  if (column === "country" || column === "city") {
    return code === "" ? T(lang, "ismeretlen") : code;
  }
  if (column === "qualification") {
    return (
      { no_site: T(lang, "nincs honlap"), outdated: T(lang, "elavult"), modern: T(lang, "modern") }[
        code
      ] ?? T(lang, "ismeretlen")
    );
  }
  if (column === "contact") {
    return (
      { email: T(lang, "e-mail"), sms: "SMS", voice: T(lang, "telefon"), none: T(lang, "nincs") }[
        code
      ] ?? code
    );
  }
  // A MOCK oszlop szava a REGISZTERBŐL — se a cella, se a szűrő-opció, se a szűrő-mondat
  // nem írhat nyers adatbázis-értéket (jóváhagyott terv ③).
  if (column === "mock") return mockStatusLabel(code, lang);
  return code;
}

export function leadsPage(result: LeadListResult, q: LeadQuery = {}): string {
  const lang = consoleLang();
  const { rows: listRows, matched, counts } = result;
  const disqView = q.disqualified === "1";
  // Since ADR-0188 the two are the same set (there is no page window any more), but the
  // option counts keep reading `matched` on purpose: they describe what the FILTER would
  // match, which is a different question from what the table happens to render.
  const rows = matched;
  // Keyed by the column's OWN cell value (not the row field): an unregistered area's
  // cell is the empty bucket, so an entry under its raw key would be unreachable —
  // and the guard reads the same `cell()` when it checks the summary against the rows.
  const regionLabels = new Map(
    matched
      .filter((r) => r.regionKnown)
      .map((r) => [String(LEAD_COLUMNS.region.cell(r)), r.regionLabel]),
  );
  // Options come from the DATA where the set is open (regions), from the domain
  // where it is closed (qualification/contact/mock) — with live counts either way.
  const countBy = (pick: (r: LeadListRow) => string) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(pick(r), (m.get(pick(r)) ?? 0) + 1);
    return m;
  };
  const regionCounts = countBy((r) => String(LEAD_COLUMNS.region.cell(r)));
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

  // Area OPTIONS carry the human area name, the VALUE stays the id (that is what the
  // filter and the guard compare) — the column used to print four shapes of the same
  // thing because the id was the label. The unclassified bucket sorts last, like the
  // "ismeretlen" option of country/city.
  const regionOpts = [...regionCounts.keys()]
    .sort((a, b) =>
      a === "" ? 1 : b === "" ? -1 : (regionLabels.get(a) ?? a).localeCompare(regionLabels.get(b) ?? b, "hu"),
    )
    .map((v) => ({
      value: v,
      label: leadOptionLabel("region", v, regionLabels, lang),
      count: regionCounts.get(v),
    }));

  // country/city option sets are OPEN (they grow with every scrape) → build from data.
  // The empty-string bucket = leads whose scrape carried no country/city yet.
  const facetOpts = (counts: Map<string, number>) =>
    [...counts.keys()]
      .sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)))
      .map((v) => ({ value: v, label: v === "" ? T(lang, "ismeretlen") : v, count: counts.get(v) }));
  const countryOpts = facetOpts(countryCounts);
  const cityOpts = facetOpts(cityCounts);

  // The whole table lives in ONE GET form: every header control submits it, so
  // filters combine instead of replacing each other. There is nothing paging-shaped
  // left to carry (ADR-0188): the form travels sort, `all` and the view switch only.
  const hidden =
    (q.sort ? `<input type="hidden" name="sort" value="${esc(q.sort)}">` : "") +
    (q.dir ? `<input type="hidden" name="dir" value="${esc(q.dir)}">` : "") +
    // `all` travels with the FORM too, not just with the toolbar links. Measured
    // 2026-09-12: from a cleared list (593), setting a header filter dropped `all=1`
    // — harmless while the filter was set, but CLEARING that number then had nothing
    // left in the query, so the default filter silently came back. Same silent loss
    // as Elek FK-003 ①, through the other door.
    (q.all ? `<input type="hidden" name="all" value="1">` : "") +
    (disqView ? `<input type="hidden" name="disqualified" value="1">` : "");

  // ── What is filtering, said in the filtered column's own words ──────────────
  // The sentence is BUILT from the registry entry that also runs the predicate, so
  // it cannot promise "min. 1 kép" while the filter sits on another column.
  const activeFilters = LEAD_FILTERS.map((f) => ({ f, v: filterValue(q, f) })).filter(
    (x): x is { f: LeadFilterDef; v: string | string[] | number } => x.v !== undefined,
  );
  // ⛔ A SZŰRŐ MONDATA NEM TŰNT EL A TERVVEL — ÁTKÖLTÖZÖTT ODA, AHOL A SZŰRŐ VAN.
  // A cím alatti összefoglaló sort a tulaj kivetette (ADR-0188), de a mondat MAGA a
  // kötés a felirat és a predikátum között: ugyanabból a regiszterből születik, amelyik
  // a szűrést futtatja, ezért nem tud olyan oszlopot ígérni, amit nem olvas
  // (`feedback_label_must_derive_from_predicate`). Most az ADOTT OSZLOP tölcsér-gombján
  // ül — elemleírásként és `data-filter-summary` horogként —, tehát ott olvasható, ahol
  // a kérdés felmerül, és ott mérhető, ahol a szűrő dolgozik.
  const summaryByColumn = new Map<LeadColumnKey, string>(
    activeFilters.map(({ f, v }) => [
      f.column,
      filterSummary(f, v, (col, code) => leadOptionLabel(col, code, regionLabels, lang), lang),
    ]),
  );

  // ── View switch that CARRIES the operator's state ───────────────────────────
  // Going "diszkvalifikáltak ▸" and back used to drop the query, so a cleared list
  // (593 rows) silently snapped back to the default 260 with no word said. The
  // explicit query travels both ways; the injected default does not travel (it is
  // re-derived on arrival, which is the same state, not a lost one).
  const carried: LeadQuery = q.defaulted
    ? { sort: q.sort, dir: q.dir, all: q.all }
    : { ...q };
  const switchHref = qs(carried, { disqualified: disqView ? undefined : "1" });
  const clearHref = qs(
    { sort: q.sort, dir: q.dir },
    { disqualified: disqView ? "1" : undefined, all: disqView ? undefined : "1" },
  );

  // ── A cím sora viszi a két kiutat ───────────────────────────────────────────
  // ⛔ A cím ALATTI két szöveg-blokk (számláló-sor + szűrő/sorrend-mondat) KIKERÜLT
  // (tulajdonosi döntés 2026-09-19, ADR-0188). A linkek megmaradnak — a „Szűrők törlése"
  // maga is ÁLLÍTÁS: csak akkor van ott, ha fut szűrő, és el is tudja vinni onnan.
  const headLinks = `<span class="con-leadhead__sp">
    ${activeFilters.length ? `<a class="small" href="${clearHref}" data-clear-filters>${T(lang, "Szűrők törlése")}</a>` : ""}
    <a class="small" href="${switchHref}">${
      disqView ? T(lang, "◂ aktív leadek") : T(lang, "diszkvalifikáltak ▸")
    }</a>
  </span>`;

  // ── Hány sorból hány, EGY sorban, a tábla ALATT ─────────────────────────────
  // ⛔ A leszűkített lista nem látszhat a teljes készletnek: a `/leads` alapból SZŰR
  // (260 a 596-ból), és ha semmi nem mondja ki, az operátor 260-at hisz összesnek. Ez a
  // sor tehát nem díszítés — ez az egyetlen hely, ahol a MEDENCE mérete elhangzik, és
  // ezért a szűrt számmal EGYÜTT áll, nem külön mondatban (`feedback_two_divisors…`).
  const poolSize = disqView ? counts.disqualified : counts.active;
  const countsLine = `<p class="mut small con-leadcount" data-lead-counts>${
    activeFilters.length
      ? disqView
        ? T(lang, "{n} sor a {total} diszkvalifikáltból — nincs lapozás, mind itt van.", {
            n: counts.matching,
            total: poolSize,
          })
        : T(lang, "{n} sor a {total} aktív leadből — nincs lapozás, mind itt van.", {
            n: counts.matching,
            total: poolSize,
          })
      : T(lang, "{n} sor — nincs lapozás, mind itt van.", { n: counts.matching })
  }</p>`;

  // ── EGYSOROS FEJLÉC (ADR-0188) ──────────────────────────────────────────────
  // ⛔ A 11 fejléc-„?" gomb MEGSZŰNT (tulajdonosi döntés 2026-09-19: „minek ennyi
  // kérdőjel"). A jelentés nem veszett el: a `title` marad az egérnek, és a jelmagyarázat
  // a cím melletti EGYETLEN „?"-ből nyílik felugró ablakként — érintőképernyőn is, ami az
  // eredeti indok volt a fejléc-gombokra. A fejléc így EGY sor, nem kettő.
  //
  // `data-col` a guard horga: ezen köti össze a szűrő mondatát azokkal a cellákkal,
  // amelyekről állít valamit. A numerikus oszlopok `num` osztályt kapnak, hogy a fejléc
  // a számokkal EGY oldalra igazodjon (eddig a felirat balra, az érték jobbra állt).
  const sum = (key: LeadColumnKey) => summaryByColumn.get(key) ?? "";
  const th = (key: LeadColumnKey, inner: string) =>
    `<th data-col="${key}"${LEAD_COLUMNS[key].numeric ? ` class="num"` : ""} title="${esc(columnMeaning(key, lang))}">` +
    `<span class="con-th">${inner}</span></th>`;

  const head = `<thead><tr>
    ${th(
      "name",
      `${sortHead(columnLabel("name", lang), "name", q)}
      <span class="cf">
        <button type="button" class="cf-btn${q.name ? " on" : ""}" onclick="citCf(this)"
                aria-label="${q.name ? esc(sum("name")) : T(lang, "név-keresés")}"
                title="${q.name ? esc(sum("name")) : T(lang, "név-keresés")}"
                ${q.name ? `data-filter-summary="${esc(sum("name"))}"` : ""}>
          ${ic("zoom", 14)}${q.name ? `<i class="cf-count">1</i>` : ""}
        </button>
        <span class="cf-pop" hidden>
          <input type="text" name="name" list="leadNames" value="${esc(q.name ?? "")}"
                 placeholder="${T(lang, "név…")}" onchange="this.form.submit()" onclick="event.stopPropagation()">
        </span>
      </span>`,
    )}
    ${th("surveyed", sortHead(columnLabel("surveyed", lang), "surveyed", q))}
    ${th("region", `${sortHead(columnLabel("region", lang), "region", q)} ${colFilter("region", regionOpts, q.region ?? [], sum("region"))}`)}
    ${th("country", `${sortHead(columnLabel("country", lang), "country", q)} ${colFilter("country", countryOpts, q.country ?? [], sum("country"))}`)}
    ${th("city", `${sortHead(columnLabel("city", lang), "city", q)} ${colFilter("city", cityOpts, q.city ?? [], sum("city"))}`)}
    ${th(
      "qualification",
      `${sortHead(columnLabel("qualification", lang), "qualification", q)} ${colFilter(
        "qualification",
        opt(
          [["no_site", T(lang, "nincs honlap")], ["outdated", T(lang, "elavult")], ["modern", T(lang, "modern")], ["unknown", T(lang, "ismeretlen")]],
          qualCounts,
        ),
        q.qualification ?? [],
        sum("qualification"),
      )}`,
    )}
    ${th("photos", `${sortHead(columnLabel("photos", lang), "photos", q)} ${minFilter("minPhotos", q.minPhotos, { summary: sum("photos") })}`)}
    ${th("material", `${sortHead(columnLabel("material", lang), "material", q)} ${minFilter("minMaterial", q.minMaterial, { summary: sum("material") })}`)}
    ${th(
      "match",
      `${sortHead(columnLabel("match", lang), "match", q)} ${minFilter("minMatch", q.minMatch, {
        step: "0.05",
        max: "1",
        // ⛔ A SZÓ, AMIT A CELLA ÍR — nem egy másik jelölés. A Match-cella „nincs találat”-ot
        // ír (`confCell`), a szűrő súgója viszont „(–)”-t mondott: két név ugyanarra az
        // állapotra, egy képernyőn. A kézikönyv a súgóból vette át, és vele együtt tévedett.
        hint: T(lang, "0 és 1 között; a „nincs találat” sorok kiesnek"),
        summary: sum("match"),
      })}`,
    )}
    ${th(
      "contact",
      `${sortHead(columnLabel("contact", lang), "contact", q)} ${colFilter(
        "contact",
        opt([["email", T(lang, "e-mail")], ["sms", "SMS"], ["voice", T(lang, "telefon")], ["none", T(lang, "nincs")]], contactCounts),
        q.contact ?? [],
        sum("contact"),
      )}`,
    )}
    ${th(
      "mock",
      `${sortHead(columnLabel("mock", lang), "mock", q)} ${colFilter(
        "mock",
        // ⛔ A felirat a REGISZTERBŐL jön, nem kézzel újraírt listából: a szűrő így
        // szerkezetileg nem tud olyan állapotot megnevezni, amit a cella másképp ír.
        opt(
          MOCK_STATUSES.map((s) => [s, mockStatusLabel(s, lang)] as [string, string]),
          mockCounts,
        ),
        q.mock ?? [],
        sum("mock"),
      )}`,
    )}
  </tr></thead>`;

  // Cells carry `data-col` and the RAW comparable value they stand for, so "does the
  // filter's promise hold for the column it names" is measurable on the real page.
  const td = (key: LeadColumnKey, r: LeadListRow, cls: string, inner: string) =>
    `<td data-col="${key}" data-v="${esc(String(LEAD_COLUMNS[key].cell(r)))}"${cls ? ` class="${cls}"` : ""}>${inner}</td>`;

  const bodyRows = listRows.length
    ? listRows
        .map(
          (r) => `<tr>
        ${td("name", r, "", `<a href="/lead/${esc(r.id)}">${esc(r.name)}</a>`)}
        ${td("surveyed", r, "small mut", surveyedCell(r.surveyedAt, lang))}
        ${td("region", r, "small mut", areaValueHtml(r, lang))}
        ${td("country", r, "small", r.country ? esc(r.country) : `<span class="mut" title="${T(lang, "A gyűjtés nem hozott országot.")}">–</span>`)}
        ${td("city", r, "small", r.city ? esc(r.city) : `<span class="mut" title="${T(lang, "A gyűjtés nem hozott települést.")}">–</span>`)}
        ${td("qualification", r, "", r.lifecycle === "disqualified" ? disqualifiedBadge() : qualBadge(r.qualification))}
        ${td("photos", r, "num", photoCell(r.photos, r.streetView))}
        ${td("material", r, "num mut", String(r.material || "–"))}
        ${td("match", r, "num", confCell(r.matchConfidence))}
        ${td("contact", r, "small", contactCell(r.contact))}
        ${td(
          "mock",
          r,
          "",
          `${
            r.latestArtifact
              ? // A SZÍN az adatbázis-értékből (osztálynév), a SZÖVEG a regiszterből —
                // a gépi horog megmarad, az operátor magyarul olvas (jóváhagyott terv ③).
                `<span class="pill ${esc(r.latestArtifact.status)}">${esc(mockStatusLabel(r.latestArtifact.status, lang))}</span>`
              : `<span class="mut small">${esc(mockStatusLabel("none", lang))}</span>`
          }${
            r.outreachSentAt
              ? `<br><span class="pill approved" style="margin-top:4px;display:inline-block" title="${T(lang, "E-mail kiküldve {date}", { date: esc(r.outreachSentAt.slice(0, 16).replace("T", " ")) })}">${T(lang, "✓ kiküldve")}</span>`
              : ""
          }`,
        )}</tr>`,
        )
        .join("")
    : `<tr><td colspan="${Object.keys(LEAD_COLUMNS).length}" class="mut" style="padding:24px">${T(lang, "Nincs a szűrőnek megfelelő lead.")}
        <a href="${clearHref}">${T(lang, "Szűrők törlése")}</a></td></tr>`;

  // Autocomplete source for the name search (the whole match set, not just this page).
  const nameList = `<datalist id="leadNames">${matched
    .map((r) => `<option value="${esc(r.name)}">`)
    .join("")}</datalist>`;

  const title = disqView ? T(lang, "Diszkvalifikált leadek") : T(lang, "Aktív leadek");

  // ⛔ TELEFONON A TÁBLA OLDALRA GÖRGET, és ezt KI KELL MONDANI (jóváhagyott terv ⑩).
  // Mérve 390 px-en: a 11 oszlopból 3 látszott, 750 px lógott túl, és SEMMI nem jelezte,
  // hogy a többi oszlop ott van. A NÉV oszlop tapad, hogy minden érték mellett látszódjon,
  // MELYIK leadről szól — ezt a mondat is kimondja.
  const scrollHint = `<p class="con-scrollhint"><span aria-hidden="true">⇄</span>
    ${T(lang, "Oldalra görgetve jön a többi oszlop — a Név oszlop közben a helyén marad.")}</p>`;

  // ── A LAP (ADR-0188) ────────────────────────────────────────────────────────
  // Cím + EGYETLEN „?" + a két kiút-link, aztán AZONNAL a tábla. Se lapozó (se fent, se
  // lent), se jelmagyarázat-sáv, se számláló-blokk, se szűrő/sorrend-mondat: a szűrő
  // tényét a fejléc cián jelvénye és a „Szűrők törlése" link viszi, a sorrendet a
  // rendező oszlop nyila, a darabszámot EGY sor a tábla alatt.
  const body = `<div class="panel">
    <div class="con-leadhead">
      <h2>${esc(title)}</h2>
      <button type="button" class="con-helpq" id="leadLegendBtn" aria-haspopup="dialog"
              aria-controls="leadLegend" aria-expanded="false"
              aria-label="${T(lang, "Mit jelentenek az oszlopok és a jelölések?")}"
              title="${T(lang, "Mit jelentenek az oszlopok és a jelölések?")}">?</button>
      ${headLinks}
    </div>
    ${scrollHint}
    <form method="get" id="leadFilters">${hidden}
      <div class="tblwrap tblwrap--leads"><table class="con-leadtbl">${head}<tbody>${bodyRows}</tbody></table></div>
    </form>
    ${countsLine}
    ${nameList}
    ${leadLegend(lang)}
    ${LEAD_FILTER_JS}</div>`;
  return layout(title, body, { active: "/leads" });
}

/**
 * Jelmagyarázat — ADR-0188 (tulajdonosi döntés, 2026-09-19).
 *
 * ⛔ SÁV VOLT, FELUGRÓ LETT. A 2026-09-14-i kontraktus ① pontja a tábla FÖLÉ tette,
 * nyitott `<details>` sávként, és minden oszlopfejlécre tett egy „?" gombot. A tulaj
 * szava: „a segítség nem kell egy ilyen sávba, max egy kattintható kérdőjel és onnan
 * popup… minek ennyi kérdőjel". A sáv 11 sornyi szöveget tolt a döntés elé MINDEN
 * betöltéskor, akkor is, amikor senki nem kérdezett.
 *
 * ⚠️ AMI NEM VÁLTOZOTT, ÉS NEM IS SZABAD: az EREDETI indok a fejléc-gombokra az volt,
 * hogy a `title` elemleírás ÉRINTŐKÉPERNYŐN ELÉRHETETLEN, a tulaj pedig telefonról
 * dolgozik. A felugró ezt jobban oldja meg, mint a 11 gomb: EGY gomb nyitja, ujjal is,
 * és MINDEN oszlopot felsorol. A jelentés tehát nem veszett el — kevesebb kattintásnyira
 * került.
 *
 * A `data-legend` horgok maradnak: az őr ezeken méri, hogy a felugró tényleg mind a 11
 * oszlopot megnevezi, és hogy a felirat a REGISZTERBŐL jön, nem kézzel újraírt listából.
 */
function leadLegend(lang: string): string {
  // EVERY column, not a hand-picked few: a meaning that lives only in the header
  // `title` is unreachable on a phone (tudásbázis-őr, 2026-09-11) — and the owner
  // works from a phone. Order follows the table, so the legend can be read along it.
  const cols = Object.keys(LEAD_COLUMNS) as LeadColumnKey[];
  const items = cols
    .map(
      (k) =>
        `<div class="con-legend__row" data-legend="${k}"><dt>${esc(columnLabel(k, lang))}</dt>` +
        `<dd>${esc(columnMeaning(k, lang))}</dd></div>`,
    )
    .join("");
  const marks = cellMarkMeanings(lang)
    .map(
      (m) =>
        `<div class="con-legend__row"><dt><span class="sv">${esc(m.mark)}</span></dt>` +
        `<dd>${esc(m.meaning)}</dd></div>`,
    )
    .join("");
  // ⛔ A TUDÁSBÁZIS-HORGONY ITT ÉL (`console.leads`). A cím mellől kikerült az ikonos
  // súgó-link — a tulaj EGYETLEN „?"-t kért —, de a horgony nem tűnhet el: a kb-check
  // lefedettség-kapuja pont azt méri, hogy a képernyőn KINT van-e az az út, amit a
  // kézikönyv ígér. Itt, a felugró lábazatában van a helye: aki a jelmagyarázatot
  // kinyitotta, az pont most keres bővebb leírást.
  return `<div class="con-legend" id="leadLegend" hidden>
    <div class="con-legend__box" role="dialog" aria-modal="true" aria-labelledby="leadLegendTitle">
      <div class="con-legend__head">
        <h3 id="leadLegendTitle">${T(lang, "Mit jelentenek az oszlopok és a jelölések?")}</h3>
        <button type="button" class="con-legend__x" id="leadLegendX" aria-label="${T(lang, "Bezárás")}">${ic("close", 18)}</button>
      </div>
      <dl class="con-legend__list">${items}
        <div class="con-legend__sec">${T(lang, "Jelölések a cellákban")}</div>${marks}
      </dl>
      <p class="con-legend__foot">${helpLink("console.leads", T(lang, "Részletes súgó a tudásbázisban"))}</p>
    </div>
  </div>`;
}

/** Header-filter behaviour: open one popup at a time, close on outside click,
 *  and narrow long option lists as the operator types. */
const LEAD_FILTER_JS = `<script>
  var citCfOpen = null;
  // A felugró position:fixed (a görgető-doboz levágta volna 390 px-en), ezért a
  // helyét ITT kell kiszámolni: a gomb alá kerül, és a KÉPERNYŐRE szorítjuk. Ha alul
  // nem fér el, fölé ugrik — a lista aljáról nyitott szűrő különben a kép alá lógna.
  function citCfPlace(pop, btn) {
    var r = btn.getBoundingClientRect();
    var w = pop.offsetWidth, h = pop.offsetHeight;
    var left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
    // ⛔ A RAGADÓ FEJLÉC ALJA A FELSŐ HATÁR, nem a nézetablak teteje. A „fölé ugrik" ág
    // fekvő telefonon (844x390) a lapfejléc MÖGÉ tette a dobozt: a 4 élő darabszámból 3
    // takarva volt — épp az a kettő, amit a kézikönyv példaként ígér.
    var topbar = document.querySelector('.con-top');
    var minTop = (topbar ? topbar.getBoundingClientRect().bottom : 0) + 6;
    var top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = r.top - h - 6;
    if (top < minTop) top = minTop;
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
    // ⛔ Ha a doboz így sem fér a fejléc alja és a képernyő alja közé, ne LÓGJON KI:
    // kapjon görgethető magasságot. Egy félig látható lista némán hazudna a darabszámról.
    var room = window.innerHeight - 8 - top;
    pop.style.maxHeight = h > room ? room + 'px' : '';
    pop.style.overflowY = h > room ? 'auto' : '';
  }
  function citCf(btn) {
    var pop = btn.parentNode.querySelector('.cf-pop');
    var open = !pop.hidden;
    document.querySelectorAll('.cf-pop').forEach(function (p) { p.hidden = true; });
    pop.hidden = open;
    citCfOpen = open ? null : { pop: pop, btn: btn };
    if (!open) {
      citCfPlace(pop, btn);
      var s = pop.querySelector('input');
      if (s) s.focus();
    }
    event.stopPropagation();
  }
  function citCfSearch(input) {
    var q = input.value.trim().toLowerCase();
    input.parentNode.querySelectorAll('.cf-opt').forEach(function (o) {
      o.style.display = !q || (o.dataset.label || '').indexOf(q) !== -1 ? '' : 'none';
    });
  }
  function citCfCloseAll() {
    citCfOpen = null;
    document.querySelectorAll('.cf-pop').forEach(function (p) { p.hidden = true; });
  }
  document.addEventListener('click', citCfCloseAll);
  // ⛔ A fixed doboz NEM görög a táblázattal, tehát görgetéskor KÖVETNIE kell a gombját —
  // különben egy MÁSIK oszlop fölött állítana valamit.
  // ⛔ ÉS NEM ZÁRHATJUK görgetésre: mérve 2026-09-20 — a koppintás MAGA vált ki görgetést
  // (a böngésző a gombot a képbe húzza), így a felugró abban a pillanatban csukódott be,
  // amikor megnyílt. A zárás a kattintás/ESC dolga; a görgetés csak ÁTHELYEZ.
  (function () {
    function follow() {
      if (!citCfOpen || citCfOpen.pop.hidden) return;
      citCfPlace(citCfOpen.pop, citCfOpen.btn);
    }
    var box = document.querySelector('.tblwrap--leads');
    if (box) box.addEventListener('scroll', follow, { passive: true });
    window.addEventListener('scroll', follow, { passive: true });
    window.addEventListener('resize', follow);
  })();
  document.querySelectorAll('.cf-pop').forEach(function (p) {
    p.addEventListener('click', function (e) { e.stopPropagation(); });
  });

  // ── Jelmagyarázat: EGY gomb, EGY felugró ──────────────────────────────────────────
  // Az ujjal is elérhető út: a „?" nyit, az × / ESC / a háttérre kattintás zár. A
  // fókusz a felugróba megy és a záráskor VISSZATÉR a gombra — különben a billentyűvel
  // dolgozó operátor a lap tetején találná magát.
  (function () {
    var lg = document.getElementById('leadLegend');
    var btn = document.getElementById('leadLegendBtn');
    if (!lg || !btn) return;
    function open() {
      lg.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      var x = document.getElementById('leadLegendX');
      if (x) x.focus();
    }
    function close() {
      if (lg.hidden) return;
      lg.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      btn.focus();
    }
    btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); open(); });
    var x = document.getElementById('leadLegendX');
    if (x) x.addEventListener('click', close);
    // A HÁTTÉRRE kattintás zár, a DOBOZRA nem — különben a szövegben kijelölni sem lehet.
    lg.addEventListener('click', function (e) { if (e.target === lg) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  })();

  // ── A görgethetőség MÉRT tény, nem töréspont ─────────────────────────────────────
  // Ha a 11 oszlop nem fér ki, a NÉV tapad és a lap KI IS MONDJA; ha kifér, egyik sem
  // történik. A kiszolgáló ezt nem tudhatja (nem ismeri a képernyőt, a nagyítást, sem a
  // leghosszabb településnevet a mai találati halmazban) — a böngésző viszont megméri.
  (function () {
    var box = document.querySelector('.tblwrap--leads');
    var hint = document.querySelector('.con-scrollhint');
    if (!box) return;
    function sync() {
      var over = box.scrollWidth - box.clientWidth > 1;
      box.classList.toggle('is-scrollx', over);
      if (hint) hint.classList.toggle('is-on', over);
    }
    sync();
    window.addEventListener('resize', sync);
  })();
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
    <div class="mut small" style="margin-top:6px">${T(lang, "Privát előnézet — a nyilvános élesítés fizetés után, nálunk indul.")}</div>`;
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
/**
 * The item line shared by the payment screens (approved contract:
 * assets/design-refs/console/pay-gateway-exit/, point ②).
 *
 * ⛔ Measured 2026-09-15: NONE of the four gateway states, and not the failure
 * page either, said WHAT was being paid for — only an amount stood on screen.
 * ⛔ With no name we do NOT invent one: the line narrows to the product, it does
 * not fill in something plausible (§B.17).
 */
function payItemLine(lang: string, productName: string | null | undefined, sub: string): string {
  const name = (productName ?? "").trim();
  return `<div class="pay-item">${name ? `<b>${esc(name)}</b>` : ""}<span>${sub}</span></div>`;
}

/**
 * The reference id, with a copy button (contract ③).
 *
 * ⛔ A code a buyer has to retype off a screen is not a control — and they read it
 * at the worst possible moment, right after a decline. The `<code>` itself stays
 * in the markup, so the reference survives with JavaScript off; only the button
 * needs JS, and it says so by simply not reacting.
 */
function payRefRow(lang: string, ref: string, lead: string): string {
  return `<p class="pay-ref">${lead} <code id="payRef">${esc(ref)}</code>
    <button type="button" id="payRefCopy" data-copy-target="payRef">${T(lang, "Másolom")}</button></p>`;
}

/** Clipboard wiring for payRefRow — inlined so the page stays standalone. */
function payCopyScript(lang: string): string {
  // ⛔ Deferred: this goes into <head>, so the elements do not exist yet when it
  // parses. `layout()` has no tail slot, and adding one would touch every console
  // page — a wider blast radius than this needs.
  return `<script>(function(){function w(){
  var b=document.getElementById("payRefCopy"),c=document.getElementById("payRef");
  if(!b||!c)return;
  b.addEventListener("click",function(){
    var t=(c.textContent||"").trim();
    var done=function(){b.textContent=${jsStr(T(lang, "✓ Kimásolva"))};b.classList.add("is-done");
      setTimeout(function(){b.textContent=${jsStr(T(lang, "Másolom"))};b.classList.remove("is-done");},1800);};
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(done,done);
    else{var a=document.createElement("textarea");a.value=t;document.body.appendChild(a);a.select();
      try{document.execCommand("copy");}catch(e){}document.body.removeChild(a);done();}
  });
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",w);else w();
})();</script>`;
}

export function payMockPage(
  ref: string,
  amount: number,
  period: string,
  status: string,
  productName?: string | null,
): string {
  const lang = consoleLang();
  // "oneoff" = one-time purchase: no per-period suffix (an "/ hó" on an egyszeri
  // díj was a price-truth defect — Elek FK-005b H3).
  const perLabel =
    period === "oneoff"
      ? `<span class="mut">${T(lang, "egyszeri díj")}</span>`
      : `<span class="mut">/ ${period === "annual" ? T(lang, "év") : T(lang, "hó")}</span>`;
  // A settled payment offers NO buttons — replaying "Fizetek" on a paid ref only
  // manufactured a fake "terhelés megtörtént" page (Elek FK-005b H1).
  // ⭐ Contract ①: ONE loud way forward, and a quieter way back.
  // ⛔ Measured 2026-09-15 with the stylesheet loaded: "Fizetek ▸" (.ok) and
  // "Elutasítom" (.bad) rendered BYTE-IDENTICALLY — both 35px tall, weight 600,
  // 12.5px, white background, 999px radius. Only the text colour differed, so
  // nothing on the screen said which one was the action and which the way back.
  // The hierarchy is carried by SIZE and WEIGHT, not by hue alone.
  const actions =
    status === "pending"
      ? `<div class="pay-act">
      <form method="post" action="/pay/mock/${esc(ref)}/paid"><button type="submit">${T(lang, "Fizetek")} — ${fmtHuf(amount)}</button></form>
      <form class="pay-act__quiet" method="post" action="/pay/mock/${esc(ref)}/failed"><button type="submit">${T(lang, "Mégsem fizetek most")}</button></form>
    </div>`
      : status === "paid"
        ? // ⚠️ YES, this repeats the `banner` below it — and the repetition is
          // LOAD-BEARING, which is only visible if you look at who quotes it.
          // Measured 2026-09-14, after trying to remove it: TWO different gates
          // pin the two halves, with two DIFFERENT literals on the same screen:
          //   • scripts/module-purchase-state-check.mts:370 requires
          //     "Ez a fizetés MÁR rendezve van" (the double-charge protection);
          //   • elek/scenarios/FK-005b-payment-failure-matrix.md:74 requires
          //     "Ez a fizetés rendezve van" (no "már") — the banner.
          // Neither string contains the other, so collapsing them to one sentence
          // breaks one consumer whichever way it is written. De-duplicating this
          // is therefore a COPY DECISION that has to move both gates with it, not
          // a small fix — it is written up for the plan round instead.
          `<p class="q-good" style="margin-top:18px"><b>${T(lang, "Ez a fizetés már rendezve van")}</b> — ${T(lang, "új terhelés nem indítható rajta.")}</p>`
        : `<div class="pay-act">
      <form method="post" action="/pay/mock/${esc(ref)}/paid"><button type="submit">${T(lang, "Újra próbálom — Fizetek")} ${fmtHuf(amount)}</button></form>
    </div>`;
  // ⛔ THE STATE MUST BE VISIBLE, not spelled in a raw DB token (Elek FK-005b H4,
  // 2026-09-11): stepping BACK after a decline gave a screen byte-identical to the
  // one before it — "pending" in 11px grey. A buyer cannot tell from that whether
  // their card was refused. (The other half of that defect was caching: the GET
  // handler now sends no-store so "back" re-reads the real state.)
  const banner =
    status === "failed"
      ? `<p class="q-bad" style="margin:12px 0"><b>${T(lang, "A fizetés elutasítva")}</b> — ${T(lang, "terhelés nem történt.")}</p>`
      : status === "paid"
        ? `<p class="q-good" style="margin:12px 0"><b>${T(lang, "Ez a fizetés rendezve van.")}</b></p>`
        : `<p class="mut" style="margin:12px 0">${T(lang, "Ez a fizetés még nem indult el.")}</p>`;
  const statusWord =
    status === "failed"
      ? T(lang, "elutasítva")
      : status === "paid"
        ? T(lang, "rendezve")
        : T(lang, "fizetésre vár");
  // Contract ②: the screen names WHAT is being paid for. The cycle rides in the
  // same sentence, so the amount above it cannot be read against the wrong unit.
  const cycleWord =
    period === "oneoff"
      ? T(lang, "egyszeri díj")
      : period === "annual"
        ? T(lang, "éves előfizetés")
        : T(lang, "havi előfizetés");
  const body = `<div class="panel" style="max-width:440px;margin:48px auto;text-align:center">
    <h2>${T(lang, "Mock fizetőoldal")}</h2>
    ${payItemLine(lang, productName, T(lang, "Citoviso honlap — {cycle}", { cycle: esc(cycleWord) }))}
    <p style="font-size:24px;margin:12px 0"><b>${fmtHuf(amount)}</b> ${perLabel}</p>
    ${banner}
    <p class="mut small" data-pay-status="${esc(status)}">${T(lang, "státusz: {status}", { status: esc(statusWord) })}</p>
    ${actions}
    ${payRefRow(lang, ref, T(lang, "Hivatkozás:"))}
    <p class="mut small" style="margin-top:16px">${T(lang, "Ez a MOCK fizetőoldal a valós Barion pay-link helyén. A gombok ugyanazt a webhook-utat hajtják, amit az éles gateway fog.")}</p>
  </div>`;
  return layout(T(lang, "Mock fizetés"), body, { chrome: false, head: payCopyScript(lang) });
}

/**
 * ISMERETLEN VAGY ELAVULT FIZETÉS-HIVATKOZÁS (ADR: a /pay/done nem adhat 500-at).
 *
 * ⛔ Mérve 2026-09-15: a `/pay/done?paymentId=…` egy olyan hivatkozásra, amit nem
 * ismerünk (vagy amelyre az átjáró HTML hibalapot ad), NYERS HTTP 500-zal válaszolt —
 * a fizetés UTÁNI visszatérő lapon, vagyis a lehető legrosszabb helyen, ahol a vevő
 * landolhat. A 404-es „Nincs ilyen fizetés." szintén zsákutca volt: se azt nem mondta
 * meg, mi történt, se azt, hova menjen tovább.
 *
 * ⛔ AMIT EZ A LAP NEM MOND: semmit a fizetés kimeneteléről. Nem ismerjük ezt a
 * hivatkozást, tehát nem tudjuk, történt-e terhelés — és egy megnyugtató („nem
 * terheltük meg") vagy ijesztő („sikertelen") mondat egyaránt találgatás lenne
 * (§B.17). A lap pontosan annyit állít, amennyit tudunk: NEM TALÁLJUK.
 */
export function payUnknownRefPage(ref: string, supportEmail: string | null): string {
  const lang = consoleLang();
  const body = `<div class="panel" style="max-width:560px;margin:48px auto">
    <h2 style="margin-top:0">${T(lang, "Ezt a fizetést nem találjuk")}</h2>
    <p style="margin:0">${T(lang, "A megnyitott hivatkozáshoz nálunk nincs fizetés. Ez akkor fordul elő, ha a link elavult, félbemaradt, vagy nem tőlünk származik.")}</p>
    <p class="mut small" style="margin:12px 0 0">${T(lang, "Fontos: erről a hivatkozásról NEM tudjuk megmondani, történt-e terhelés — épp azért, mert nem ismerjük. A kártyaterhelést a bankja kivonatán tudja ellenőrizni.")}</p>
    ${ref ? `<p class="mut small" style="margin:10px 0 0;word-break:break-all">${T(lang, "A megnyitott hivatkozás:")} <code>${esc(ref.slice(0, 64))}</code></p>` : ""}
    <div class="row" style="margin-top:18px">
      <a class="con-linkact" href="/">${T(lang, "Vissza a kezdőlapra")}</a>
      ${
        // ⛔ Cím nélkül a felajánlás ELMARAD, nem helyettesítjük egy hihetőre (§B.17).
        supportEmail
          ? `<a class="con-linkact" href="mailto:${esc(supportEmail)}">${T(lang, "Írjon nekünk: {email}", { email: esc(supportEmail) })}</a>`
          : ""
      }
    </div>
  </div>`;
  return layout(T(lang, "Ismeretlen fizetés"), body, { chrome: false });
}

/**
 * Buyer returned from the gateway before the final payment state landed (Barion
 * may still report InProgress for a few seconds). Auto-refresh until /pay/done
 * can render the real outcome — never leave the buyer on a dead screen.
 */
export function payPendingPage(gatewayRefreshFailed = false): string {
  const lang = consoleLang();
  const body = `<div class="panel" style="max-width:560px;margin:48px auto;text-align:center">
    <h2 style="margin-top:0">${T(lang, "A fizetés feldolgozás alatt…")}</h2>
    <p class="mut" style="margin:0">Köszönjük a türelmét — az oldal néhány másodpercen
    belül automatikusan frissül. Kérjük, ne zárja be az ablakot.</p>
    ${
      // ⛔ HA NEM TUDTUK MEGKÉRDEZNI AZ ÁTJÁRÓT, AZT KIMONDJUK. A frissülő képernyő
      // magától azt sugallná, hogy „dolgozunk rajta, mindjárt megjön" — holott épp
      // az a csatorna néma, amiből a válasz jönne. A vevő ne a semmiben várjon.
      gatewayRefreshFailed
        ? `<p class="mut small" style="margin:14px 0 0">${T(lang, "A fizetési szolgáltatót az imént nem értük el, ezért a képernyő a saját nyilvántartásunkat mutatja. A terhelésről ez semmit nem mond — amint a szolgáltató válaszol, a lap frissül.")}</p>`
        : ""
    }
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
        : // ⛔ The old tail promised NO e-mail, and the VERY NEXT sentence on this
          // page promises the invoice BY e-mail. Two adjacent sentences, one
          // screen, opposite claims. What was missing is the subject: we send no
          // separate notice about THE TRANSLATION FINISHING — the invoice mail is
          // a different message and still goes out.
          // ⚠️ The opening clause is quoted verbatim by an Elek scenario
          // (elek/scenarios/FK-005b-payment-failure-matrix.md) — kept unchanged.
          T(lang, "A fordítás elindult — néhány percet vesz igénybe. Amint kész, a nyelvi változatok maguktól megjelennek az oldalán; az elkészültéről nem küldünk külön értesítőt.")
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
/**
 * "AZ ELŐFIZETÉSE" — the standing obligation, spelled out on the confirmation
 * (approved contract: design-refs/configurator/checkout-fullscreen, point ⑪).
 *
 * MEASURED DEFECT this closes (Elek FK-005a, 2026-09-11): the screen acknowledged
 * the 74 925 Ft charge and then went silent — no next-charge date, no next-charge
 * amount (99 900 Ft, +33%, because the discount was one-off), no word that it
 * renews automatically, no mention of where to cancel, no invoice timing, and no
 * VAT status anywhere on the whole purchase path.
 *
 * ⛔ Every row here must be a FACT WE HOLD. The renewal date and amount come from
 * the subscription + the same pricing call billing.ts mints renewals with; when
 * there is no subscription row yet we say what we honestly know instead of
 * inventing a date (§B.17: uncertainty → less, never false).
 *
 * The owner approved all six rows (2026-09-11), including the VAT and invoice
 * lines, over the shorter four-row alternative.
 */
function subscriptionBox(
  lang: string,
  info?: {
    contactEmail?: string | null;
    amount?: number | null;
    renewal?: { readonly date: string; readonly amount: number; readonly period: "monthly" | "annual" } | null;
  },
): string {
  const r = info?.renewal ?? null;
  const per = r?.period === "monthly" ? T(lang, "/ hó") : T(lang, "/ év");
  const row = (term: string, value: string): string =>
    `<div style="display:flex;gap:10px;margin:0 0 6px;flex-wrap:wrap">
       <span class="mut" style="flex:0 0 132px;font-size:12.5px">${term}</span>
       <span style="flex:1 1 180px;font-weight:600;font-size:13px">${value}</span>
     </div>`;
  const nextCharge = r
    ? row(
        T(lang, "Következő terhelés"),
        `${esc(formatDay(r.date, lang))} — ${fmtHuf(r.amount)} ${per}`,
      )
    : row(
        T(lang, "Következő terhelés"),
        T(lang, "A pontos dátumot és összeget e-mailben küldjük el."),
      );
  return `<div style="margin:0 0 18px;padding:13px 14px;border:1px solid var(--citui-line-strong);border-radius:var(--citui-radius);background:var(--citui-surface-2)">
      <h3 style="margin:0 0 9px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--citui-link-ink)">${T(lang, "Az előfizetése")}</h3>
      ${info?.amount ? row(T(lang, "Most fizetett"), fmtHuf(info.amount)) : ""}
      ${nextCharge}
      ${row(T(lang, "Megújulás"), T(lang, "Automatikus, a megadott kártyáról"))}
      ${row(T(lang, "ÁFA"), T(lang, "Alanyi adómentes — az ár ÁFÁ-t nem tartalmaz"))}
      ${row(
        T(lang, "Számla"),
        info?.contactEmail
          ? T(lang, "E-mailben, néhány percen belül: {email}", { email: esc(info.contactEmail) })
          : T(lang, "E-mailben, néhány percen belül."),
      )}
      ${row(
        T(lang, "Lemondás"),
        T(lang, "Bármikor: Belépés → Modulok fül → „Előfizetés lemondása”. A fordulónapon lép érvénybe."),
      )}
    </div>`;
}

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
    /**
     * Gateway reference of THIS payment. The failure screen used to name only an
     * e-mail address, so a buyer writing in could not say WHICH attempt failed
     * and we could not find it either (Elek FK-005b H3, 2026-09-11).
     */
    ref?: string | null;
    /**
     * The pay-link to try again with. ⛔ A "Próbálja meg újra" that carries NO
     * button is not an instruction, it is a shrug — the same measured defect.
     */
    retryUrl?: string | null;
    /**
     * OUR address for a buyer who needs a human — one source, the same one the
     * tenant admin prints (`config.outreachSender.email`).
     *
     * ⛔ NOT hardcoded, and NOT invented when missing. Measured on these three
     * screens (2026-09-14): they printed `info@citoviso.com`, a literal that
     * exists nowhere in the configuration — everything else in the product says
     * `olasz.ferenc@citoviso.com` (OUTREACH_SENDER_EMAIL / LEGAL_ENTITY_EMAIL).
     * So the customer whose card had just been DECLINED was sent to an address
     * we do not send from. With no configured address the sentence is omitted
     * rather than filled with a plausible one (§B.17: less, never false).
     */
    supportEmail?: string | null;
    /**
     * The buyer's OWN admin (approved contract: pay-gateway-exit ④). An existing
     * tenant buying an upsell had no route back from a declined payment — the page
     * offered a retry and a mailto and nothing else. Absent = no such tenant yet
     * (a first purchase), and then the link is simply not drawn.
     */
    adminUrl?: string | null;
    /**
     * What was being bought (contract ②). Measured 2026-09-15: neither this page
     * nor any gateway state said WHAT the money was for — only an amount stood on
     * screen. Empty = we do not know, and then we do not invent it (§B.17).
     */
    productName?: string | null;
    /** The standing obligation (checkout-fullscreen ⑪) — null = no subscription. */
    renewal?: {
      readonly date: string;
      readonly amount: number;
      readonly period: "monthly" | "annual";
    } | null;
    /** Currency of the charge — the Barion `purchase` event requires it, and it
     *  comes from the PAYMENT row, never from a default (ADR-0186). */
    currency?: string | null;
  },
): string {
  const lang = consoleLang();
  // The buyer must SEE that the charge went through — an explicit confirmation
  // line, not just an implied "thank you" (owner feedback, 2026-08-21).
  const paidLine = `<p class="q-good" style="margin:0 0 14px;font-size:15px"><b>${T(lang, "✓ Sikeres fizetés")}</b>${
    info?.amount ? T(lang, " — a {amount} összegű terhelés megtörtént.", { amount: fmtHuf(info.amount) }) : T(lang, " — a terhelés megtörtént.")
  }</p>`;
  // ONE source for "write to us", on all three branches of this page. Empty
  // config → the offer is dropped, never replaced by a plausible-looking address.
  // Barion Pixel (Full, ADR-0186): a MEGTÖRTÉNT vásárlás — a tölcsér utolsó
  // eseménye. A lap nem hívja közvetlenül a Pixelt (a hozzájárulás a futtatóban
  // dől el), csak deklarálja; a sor „Elfogadom" után ürül.
  //
  // ⚠️ EGY TÉTEL, nem tételes kosár — és ez SZÁNDÉKOS. A tételes bontás a
  // konfigurátorból már kiment (initiateCheckout + addPaymentInfo, valós
  // modul-árakkal); itt csak a TERHELT összeg ismert biztosan. Modulonkénti árat
  // visszafejteni ebből annyit tenne, hogy kitalált számokat küldünk a
  // csalásmegelőzésnek — egy igaz sor többet ér, mint négy kikövetkeztetett.
  const pixelPurchase =
    paid && typeof info?.amount === "number" && info.currency
      ? pixelQueueScript("purchase", {
          contents: [
            {
              id: "order",
              contentType: "Product",
              name: info.productName || "Citoviso",
              unit: "db",
              unitPrice: info.amount,
              totalItemPrice: info.amount,
              currency: info.currency,
              quantity: 1,
            },
          ],
          currency: info.currency,
          step: 3,
          revenue: info.amount,
          ...(info.ref ? { orderNumber: info.ref } : {}),
        })
      : "";
  const support = (info?.supportEmail ?? "").trim();
  const helpLine = (leadIn: string): string =>
    support
      ? `<p class="mut small" style="margin:0">${leadIn}
        <a href="mailto:${esc(support)}">${esc(support)}</a> ${T(lang, "— segítünk.")}</p>`
      : "";
  if (!paid) {
    // ⛔ "Próbálja meg újra" WITH A BUTTON, and a reference to quote. The screen
    // that only named an e-mail address left the buyer with nothing to click and
    // nothing to cite (Elek FK-005b H3, 2026-09-11). "Nem történt terhelés" stays
    // first and unchanged: it answers the one question that actually scares them.
    const retry = info?.retryUrl
      ? // citui-btn, not the bare `btn` class this page used elsewhere: `.btn` has
        // NO rule in the console stylesheet, so it renders as a plain text link —
        // which is exactly the "no button at all" the buyer reported.
        `<p style="margin:0 0 14px"><a class="citui-btn citui-btn--primary" href="${esc(info.retryUrl)}">${T(lang, "Újra próbálom a fizetést")}</a></p>`
      : "";
    // Contract ③: the reference is COPYABLE. They read it at the worst possible
    // moment — right after a decline — and retyping a code off a screen is not a
    // control. The `<code>` stays in the markup, so it survives with JS off.
    const refLine = info?.ref
      ? payRefRow(lang, info.ref, T(lang, "Hivatkozási azonosító:")) +
        `<p class="mut small" style="margin:6px 0 0">${T(lang, "Ha ír nekünk, kérjük idézze ezt az azonosítót.")}</p>`
      : "";
    // ⭐ Contract ④: EVERY screen offers a named way onward. Measured 2026-09-15:
    // this page had the retry and a mailto and nothing else — an existing tenant
    // buying an upsell had no route back to their own admin at all (ADR-0129 ③:
    // néma zsákutca nincs).
    const exits: string[] = [];
    if (info?.adminUrl) exits.push(`<a href="${esc(info.adminUrl)}">${T(lang, "Vissza a kezelőfelületre")}</a>`);
    if (info?.retryUrl) exits.push(`<a href="${esc(info.retryUrl)}">${T(lang, "Másik kártyát adok meg")}</a>`);
    const support = (info?.supportEmail ?? "").trim();
    if (support) exits.push(`<a href="mailto:${esc(support)}">${T(lang, "Írok egy munkatársnak")}</a>`);
    // ⛔ No empty rail: with nothing to offer we do not draw a divider under a void.
    const exitRow = exits.length ? `<div class="pay-exits">${exits.join("")}</div>` : "";
    return layout(
      T(lang, "Fizetés elutasítva"),
      `<div class="panel" style="max-width:520px;margin:48px auto;text-align:center">
        <h2 class="q-bad">${T(lang, "A fizetés nem sikerült")}</h2>
        <p style="margin:0 0 14px"><b>${T(lang, "Nem történt terhelés.")}</b> ${T(lang, "A megrendelése megmaradt — ugyanezen a linken újrapróbálhatja.")}</p>
        ${payItemLine(lang, info?.productName, T(lang, "Citoviso honlap{amount}", { amount: info?.amount ? ` — ${esc(fmtHuf(info.amount))}` : "" }))}
        ${retry}
        ${refLine}
        ${exitRow}</div>`,
      { chrome: false, head: payCopyScript(lang) },
    );
  }
  // Payment captured but activation did NOT complete (e.g. mock not approved yet,
  // render/photo-policy failure). Never claim the site is live or that credentials
  // were e-mailed — tell the buyer the truth: payment received, site under final
  // check, we'll e-mail when it's ready. The operator resolves it from the console.
  //
  // ⛔ The subscription box belongs here TOO. The card has already been charged and
  // ensureSubscriptionForOrder has already anchored the renewal, so the standing
  // obligation exists whether or not the site finished building — a buyer who only
  // sees this screen would otherwise learn about the next charge from their bank
  // statement. (Own gap, caught reviewing FK-005b: contract ⑪ says "the
  // confirmation", and this is one.) With no subscription row yet `renewal` is null
  // and the box says what we actually know instead of inventing a date.
  if (!activated) {
    return layout(
      T(lang, "Sikeres fizetés"),
      `<div class="panel" style="max-width:560px;margin:48px auto">
        <h2 class="q-good" style="margin-top:0">${T(lang, "Sikeres fizetés — köszönjük!")}</h2>
        ${paidLine}${pixelPurchase}
        <p style="margin:0 0 12px">Az oldalát még véglegesítjük. Amint elérhető, a pontos
        címet és a belépési adatait <b>${T(lang, "e-mailben elküldjük")}</b> ${T(lang, "— általában néhány órán belül.")}</p>
        ${subscriptionBox(lang, info)}
        ${helpLine(T(lang, "Kérdése van? Írjon:"))}
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
  //
  // ⛔ NO bare "/login" fallback any more. Measured on the confirmation screen:
  // with publicSiteUrl unset the page printed "Belépés: /login" — half a path,
  // which tells a paying customer nothing and cannot be clicked anywhere useful.
  // Without an absolute URL we say what IS true: the credentials mail carries it.
  const loginHref = /^https?:\/\//.test(info?.loginUrl ?? "") ? info!.loginUrl! : null;
  const loginLabel = loginHref ? loginHref.replace(/^https?:\/\//, "") : null;
  const loginLine = loginHref
    ? `<li style="margin:0 0 6px">${T(lang, "Belépés:")} <a href="${esc(loginHref)}">${esc(loginLabel!)}</a></li>`
    : `<li style="margin:0 0 6px">${T(lang, "A belépés pontos címét az e-mailben küldjük el.")}</li>`;
  const body = `<div class="panel" style="max-width:560px;margin:48px auto">
      <h2 class="q-good" style="margin-top:0">${T(lang, "Sikeres fizetés — köszönjük!")}</h2>
      ${paidLine}${pixelPurchase}
      ${liveBlock}
      ${subscriptionBox(lang, info)}
      <h3 style="margin:0 0 8px">${T(lang, "Mi a következő lépés?")}</h3>
      <p style="margin:0 0 10px">${mailNote} ${T(lang, "Ezekkel bármikor beléphet, és {b} — nem kell hozzá szakember.", { b: `<b>${T(lang, "saját maga szerkesztheti a szövegeket és a fotókat")}</b>` })}</p>
      <ul style="margin:0 0 18px;padding-left:20px">
        ${userLine}
        ${loginLine}
        <li>${T(lang, "Itt cserélheti a bemutatkozó szöveget, a képeket és az elérhetőségeit.")}</li>
      </ul>
      ${loginHref ? `<p style="margin:0 0 18px"><a class="citui-btn citui-btn--primary" href="${esc(loginHref)}">${T(lang, "Belépek és szerkesztem")}</a></p>` : ""}
      ${helpLine(T(lang, "Kérdése van? Írjon:"))}
    </div>`;
  return layout(T(lang, "Sikeres fizetés — az oldala él"), body, { chrome: false });
}

/**
 * A provenance-tábla MEZŐ-nevének emberi alakja (Elek FK-004 Z5). A tábla eddig a nyers
 * adatbázis-mezőt írta ki (`places_match`, `portal_profile`). ⚠️ Az ismeretlen mezőt itt
 * sem találgatjuk: alsó vonás → szóköz, tehát egy ÚJ mező olvashatóan jelenik meg, nem
 * tűnik el és nem lesz hazug.
 */
function provFieldLabel(field: string, lang: string): string {
  const known: Record<string, string> = {
    discovery: T(lang, "felfedezés"),
    email: T(lang, "e-mail"),
    phone: T(lang, "telefon"),
    website: T(lang, "honlap"),
    places_match: T(lang, "Maps-párosítás"),
    portal_profile: T(lang, "portál-profil"),
  };
  return known[field] ?? field.replace(/_/g, " ");
}

/**
 * Az ADAT FORRÁSÁNAK emberi neve (Elek FK-004 Z5). A nyers értékek (`google_places`,
 * `presence_check`, `places_match`, `portal:zimmerinfo`) adatbázis-azonosítók: az
 * operátornak semmit nem mondanak, és a lapon alsó vonással jelentek meg. ⛔ EGY
 * regiszter, mert ugyanez az érték két helyen renderelődik (forrás-link és a
 * „Honnan jött az adat" tábla) — két másolat garantáltan elcsúszna.
 * Ismeretlen értéket nem találgatunk: olvashatóvá tesszük.
 */
export function sourceLabel(source: string, lang = consoleLang()): string {
  const known: Record<string, string> = {
    osm: "OpenStreetMap", // i18n-exempt: márkanév
    google_places: "Google Maps", // i18n-exempt: márkanév
    presence_check: T(lang, "honlap-ellenőrzés"),
    places_match: T(lang, "Maps-párosítás"),
    web_search_backfill: T(lang, "webes keresés"),
    contact_scrub: T(lang, "elérhetőség-tisztítás"),
    owner_intro: T(lang, "a tulaj bemutatkozása"),
  };
  if (known[source]) return known[source]!;
  const portal = /^portal:(.+)$/.exec(source);
  if (portal) return T(lang, "portál — {name}", { name: portal[1]!.replace(/_/g, " ") });
  return source.replace(/_/g, " ");
}

// Segment hypothesis labels for the prospect create form.
const SEGMENTS = (lang = "hu"): readonly { id: string; label: string }[] => [
  { id: "nincs_honlap", label: T(lang, "nincs honlap") },
  { id: "0_labnyom", label: T(lang, "0 lábnyom") },
  { id: "van_labnyom", label: T(lang, "van lábnyom") },
  { id: "elavult", label: T(lang, "elavult oldal") },
];

/**
 * A szegmens EMBERI neve — ugyanabból a regiszterből, amiből a legördülő épül
 * (Elek FK-004 Z5). A piszkozat-lap címe a NYERS adatbázis-értéket írta ki
 * (`nincs_honlap`, alsó vonással), miközben ugyanazon a képernyőn a választó már
 * helyesen „nincs honlap"-ot mutatott: EGY érték, két alak, ugyanazon a lapon.
 * Ismeretlen id-t nem találgatunk — olvashatóvá tesszük (alsó vonás → szóköz).
 */
function segmentLabel(id: string | null | undefined, lang: string): string {
  if (!id) return "";
  return SEGMENTS(lang).find((s) => s.id === id)?.label ?? id.replace(/_/g, " ");
}

/**
 * A követett link állapotának EMBERI neve. A sor eddig a nyers, angol adatbázis-
 * értéket viselte (`sent`, `order_intent`) magyar szöveg mellett — az operátornak
 * a `created` és a `sent` közti különbség így semmit nem mondott.
 * ⛔ A sorrend a `data.ts` STATUS_ORDER-jét tükrözi; új állapotnál ITT is név kell,
 * különben az olvashatóvá tett nyers érték marad (nem hazudik, csak csúnya).
 */
function prospectStatusLabel(status: string, lang: string): string {
  const map: Record<string, string> = {
    created: T(lang, "elkészült"),
    sent: T(lang, "kiküldve"),
    opened: T(lang, "megnyitotta"),
    engaged: T(lang, "nézelődött"),
    order_intent: T(lang, "rendelni kezdett"),
    converted: T(lang, "megrendelte"),
  };
  return map[status] ?? status.replace(/_/g, " ");
}

/**
 * Opt-out block of one prospect row — approved plan B (owner, 2026-09-06):
 * the revocation stays CLOSED behind a <details>, because lifting an opt-out is
 * only lawful on the recipient's own request (GDPR/Grt.) and must not fire from a
 * stray click. The reason field is mandatory and the history is always shown, so
 * "why is everyone unsubscribed?" is answerable from the page itself.
 *
 * Renders nothing when there is neither an active opt-out nor any history — an
 * untouched prospect row stays as quiet as it is today.
 */
function optoutBox(p: ProspectView, leadId: string, lang: string): string {
  if (!p.unsubscribedAt && !p.optoutLog.length) return "";
  const log = p.optoutLog.length
    ? `<ul class="ob-log">${p.optoutLog
        .map(
          (e) =>
            `<li><b>${esc(e.createdAt.slice(0, 16).replace("T", " "))}</b> · ${
              e.action === "resubscribe"
                ? T(lang, "visszavonva — {actor}", { actor: esc(e.actor) })
                : T(lang, "leiratkozott — a címzett kattintott")
            }${e.reason ? ` · ${esc(e.reason)}` : ""}</li>`,
        )
        .join("")}</ul>`
    : // Honest empty state: the log starts on the day it was switched on (0053),
      // so an older opt-out has no entry — and we do not invent one (§B.17).
      `<p class="ob-log mut small" style="margin:8px 0 0">${T(lang, "Naplóbejegyzés nincs — ez a leiratkozás a napló bekapcsolása előtti.")}</p>`;
  if (!p.unsubscribedAt) {
    // Revoked earlier: the trail stays visible, the form is gone (nothing to revoke).
    return `<div class="optout-box optout-box--past">${log}</div>`;
  }
  return `<div class="optout-box">
    <details>
      <summary>${T(lang, "Leiratkozás visszavonása ▸")}</summary>
      <p class="ob-law">${T(lang, "A leiratkozás a CÍMZETTÉ — visszavonni csak akkor szabad, ha ő maga kérte. Az indoklás kötelező, és naplóba kerül a nevedhez.")}</p>
      <form method="post" action="/prospect/${esc(p.id)}/resubscribe" class="ob-form">
        <input type="hidden" name="leadId" value="${esc(leadId)}">
        <input type="text" name="reason" required minlength="3"
          placeholder="${esc(T(lang, "Mire hivatkozva? (pl. „telefonon visszakérte a megkeresést”)"))}">
        <button type="submit">${T(lang, "Visszavonás")}</button>
      </form>
    </details>
    ${log}
  </div>`;
}

/**
 * A KÉP-KAPU KIÍRT ÁLLAPOTA (ADR-0131) — amit a szerver megtagadott, és miért.
 * A `where` mondja meg, melyik úton történt: a jóváhagyáson vagy a követett link
 * készítésén. Ugyanaz a kapu, két belépési pont.
 */
export interface PhotoGateView {
  readonly artifactId: string;
  readonly verdict: "broken" | "unknown" | "nophoto";
  readonly sentence: string;
  readonly broken: readonly { url: string; reason: string; refs: number }[];
  readonly where: "artifact" | "prospect";
  /** A kép nélküli kiküldést vállalta, de INDOKLÁS nélkül (ADR-0150). */
  readonly reasonMissing?: boolean;
}

/**
 * A KÉP NÉLKÜLI KIKÜLDÉS kivétel-űrlapja (ADR-0150, jóváhagyott terv: „B" változat,
 * `assets/design-refs/console/nophoto-gate/`).
 *
 * ⛔ KÉT LÉPÉS, SZÁNDÉKOSAN: a doboz először csak a rendes kiutat kínálja, a kivétel
 * egy külön, kimondott kattintás mögött nyílik — a `<details>` miatt JS NÉLKÜL is.
 * ⛔ AZ INDOKLÁS KÖTELEZŐ: a `required minlength` a natív fék, a számláló a kényelem,
 * a GARANCIA viszont a szerver (`isUsableAckReason`) — ami JS nélkül is áll.
 */
function noPhotoAckForm(artifactId: string, reasonMissing: boolean): string {
  const lang = consoleLang();
  const id = `npr-${artifactId}`;
  return `<details class="pg-exc"${reasonMissing ? " open" : ""}>
      <summary>${T(lang, "Mégis kiküldöm fotó nélkül…")}</summary>
      <form method="post" action="/artifact/${esc(artifactId)}/curate" class="pg-form">
        <input type="hidden" name="decision" value="approve">
        <input type="hidden" name="ackNoPhoto" value="1">
        <label for="${esc(id)}">${T(lang, "Miért megy ki fotó nélkül?")} <span class="pg-req">${T(lang, "(kötelező)")}</span></label>
        <div class="pg-fields">
          <textarea id="${esc(id)}" name="noPhotoReason" rows="2" required minlength="10"
            data-np-reason="${esc(artifactId)}"
            placeholder="${T(lang, "Pl.: a tulaj telefonon azt kérte, a saját képeit ő tölti majd fel; a portálon sincs egyetlen fotója sem.")}"></textarea>
          <button class="bad small" type="submit" data-np-submit="${esc(artifactId)}">${T(lang, "Vállalom — fotó nélkül hagyom jóvá")}</button>
        </div>
        <p class="pg-count short" data-np-count="${esc(artifactId)}">${T(lang, "Még {n} karakter kell az indokláshoz.", { n: "10" })}</p>
        ${
          reasonMissing
            ? `<p class="pg-err">${T(lang, "Az indoklás kötelező — a kivétel a naplóba kerül, hogy utólag is látszódjon, ki és miért vállalta.")}</p>`
            : ""
        }
      </form>
    </details>`;
}

/**
 * A MEGTAGADÁS KÉPERNYŐJE. Nem néma blokk és nem is egy „biztos?" felugró: kiírja,
 * MELYIK kép, MIÉRT nem érhető el, és MI a következménye a leadnél — majd felkínálja
 * a két valódi kiutat (friss adat + újragenerálás, vagy kimondott tudomásulvétel).
 *
 * ⛔ Az `unknown` ágon NINCS tudomásulvétel: ott nem törött kép van, hanem nincs
 * renderelt lap — azt nem lehet lenyugtázni, azt újra kell generálni.
 * ⛔ A `nophoto` ágon (ADR-0150) a tudomásulvétel INDOKLÁST kér, és a kivétel egy
 * külön kattintás mögött van: a kép nélküli kiküldés nem lehet az alapút.
 */
function photoGateBox(g: PhotoGateView, artifactId: string): string {
  const lang = consoleLang();
  const list = g.broken.length
    ? `<ul class="pg-list">${g.broken
        .slice(0, 12)
        .map(
          (b) =>
            `<li><span class="pg-why">${esc(b.reason)}</span><br><span class="mut small">${esc(b.url)}</span>${
              b.refs > 1 ? ` <span class="mut small">${T(lang, "({n} helyen a lapon)", { n: String(b.refs) })}</span>` : ""
            }</li>`,
        )
        .join("")}${
        g.broken.length > 12
          ? `<li class="mut small">${T(lang, "…és további {n} kép", { n: String(g.broken.length - 12) })}</li>`
          : ""
      }</ul>`
    : "";
  const ack =
    g.verdict === "broken"
      ? `<form method="post" action="/artifact/${esc(artifactId)}/curate" class="pg-ack">
           <input type="hidden" name="decision" value="approve">
           <input type="hidden" name="ackBrokenPhotos" value="1">
           <button class="bad small" type="submit">${T(lang, "Tudomásul veszem — törött képekkel hagyom jóvá")}</button>
         </form>`
      : g.verdict === "nophoto"
        ? noPhotoAckForm(artifactId, g.reasonMissing === true)
        : "";
  // A FEJLÉC arra a kérdésre válaszoljon, ami a baj: a „képei törötten mennének ki"
  // egy KÉP NÉLKÜLI lapról hamis állítás lenne (§B.17).
  const head =
    g.verdict === "nophoto"
      ? g.where === "prospect"
        ? T(lang, "A követett link NEM készült el — a lap FOTÓ NÉLKÜL menne ki")
        : T(lang, "A jóváhagyás NEM történt meg — a lap FOTÓ NÉLKÜL menne ki")
      : g.where === "prospect"
        ? T(lang, "A követett link NEM készült el — a mock képei törötten mennének ki")
        : T(lang, "A jóváhagyás NEM történt meg — a mock képei törötten mennének ki");
  const next =
    g.verdict === "unknown"
      ? T(lang, "Ehhez a mockhoz nincs megnézhető renderelt lap — generáld újra, a tudomásulvétel itt nem segít.")
      : g.verdict === "nophoto"
        ? T(
            lang,
            "A rendes kiút: „Adatok újragyűjtése” a lead lapján (a portál-adatlapok gyakran élnek, csak a tárolt kép-URL avult el), majd új mock.",
          )
        : T(lang, "A rendes kiút: „Adatok újragyűjtése” a lead lapján, majd új mock. Ha mégis ezt küldöd ki, mondd ki külön — a döntés az artefaktumra kerül.");
  return `<div class="pg-box" id="photo-gate-${esc(artifactId)}" role="alert">
      <div class="pg-head">${ic("alert", 16)} ${head}</div>
      <p class="pg-lead">${esc(g.sentence)}</p>
      ${list}
      <p class="pg-next">${next}</p>
      ${ack}
      ${g.verdict === "nophoto" ? `<script>${noPhotoReasonScript(artifactId)}</script>` : ""}
    </div>`;
}

/**
 * A SZÁMLÁLÓ — kényelem, nem garancia. A gombot addig tiltja, amíg az indoklás rövid,
 * és KIMONDJA, hány karakter hiányzik. ⛔ JS nélkül a gomb aktív marad, a beküldést a
 * natív `required minlength` fogja meg, és ha az is kimarad, a SZERVER — a kivétel
 * soha nem múlhat azon, fut-e a szkript.
 */
function noPhotoReasonScript(artifactId: string): string {
  const lang = consoleLang();
  return `(function(){
    var ta=document.querySelector('[data-np-reason="${jsStr(artifactId)}"]');
    var btn=document.querySelector('[data-np-submit="${jsStr(artifactId)}"]');
    var cnt=document.querySelector('[data-np-count="${jsStr(artifactId)}"]');
    if(!ta||!btn||!cnt) return;
    var MIN=10;
    function sync(){
      var n=ta.value.trim().length, ok=n>=MIN;
      btn.disabled=!ok;
      cnt.className='pg-count'+(ok?'':' short');
      cnt.textContent=ok
        ? ${JSON.stringify(T(lang, "Indoklás rendben — {n} karakter."))}.replace('{n}',n)
        : ${JSON.stringify(T(lang, "Még {n} karakter kell az indokláshoz."))}.replace('{n}',MIN-n);
    }
    ta.addEventListener('input',sync); sync();
  })();`;
}

/**
 * What ACTUALLY went out on this tracked link, per channel (Elek FK-004 Z3).
 *
 * ⛔ The row used to print „✓ E-mail elküldve" from `sentAt` — the CHANNEL-AGNOSTIC
 * first-touch stamp, which `sendOutreachPair` also sets. A mobile-only outreach
 * would therefore have claimed a letter that never left. (Measured 2026-09-13: 0
 * such rows in the park today — the defect is latent, not visible, and it is fixed
 * here because the label must derive from what it MEASURES, not from a column that
 * happens to correlate.)
 */
function channelPills(p: ProspectView, lang: string): string {
  const when = (iso: string): string => esc(iso.slice(0, 16).replace("T", " "));
  const pills: string[] = [];
  if (p.emailSentAt) {
    pills.push(`<span class="pill approved">✓ ${T(lang, "E-mail elküldve · {date}", { date: when(p.emailSentAt) })}</span>`);
  }
  // ADR-0083: the pair IS the mobile act — the MMS stamp is the claim, the SMS is its
  // companion, so a half-pair must not read as a completed mobile outreach.
  if (p.mmsSentAt && p.smsSentAt) {
    pills.push(`<span class="pill approved">✓ ${T(lang, "Mobil (MMS+SMS) elküldve · {date}", { date: when(p.mmsSentAt) })}</span>`);
  } else if (p.mmsSentAt || p.smsSentAt) {
    pills.push(`<span class="pill rejected">${T(lang, "Mobil: FÉLBEMARADT páros · {date}", { date: when((p.mmsSentAt ?? p.smsSentAt)!) })}</span>`);
  }
  if (pills.length) return pills.join("\n            ");
  return `<span class="pill">${T(lang, "még egyik csatornán sem ment ki")}</span>`;
}

/** Tracked-outreach panel: create the /p/<token> prospect + funnel status. */
function prospectsPanel(
  prospects: ProspectView[],
  d: LeadDetail,
  photoGate: PhotoGateView | null = null,
): string {
  const lang = consoleLang();
  // The tracked link points at an APPROVED mock — offer creation only then.
  const approved = d.artifacts.find((a) => a.status === "approved");
  // With SEVERAL approved mocks the operator could not tell WHICH one the link
  // would carry (Elek GY, 2026-09-05) — name it on the form itself.
  const approvedCount = d.artifacts.filter((a) => a.status === "approved").length;
  const whichMock = approved
    ? `<p class="mut small" style="margin:0 0 6px">${T(lang, "A link ehhez a mockhoz készül: {skin} · {date}{more}", {
        skin: esc(String((approved.inputs as Record<string, unknown>).skin ?? approved.id.slice(0, 8))),
        date: esc(approved.generatedAt.slice(0, 16).replace("T", " ")),
        more: approvedCount > 1 ? T(lang, " (a legutóbb jóváhagyott — összesen {n} jóváhagyott él)", { n: approvedCount }) : "",
      })}</p>`
    : "";
  // ⛔ AZ ÉLŐ LINK LEVEZETETT, NEM TÁROLT (jóváhagyott terv „A",
  // assets/design-refs/console/outreach-link-live-archive/ — tulajdonosi döntés 2026-09-14).
  // A `getProspects` a legutóbb létrehozott, NEM archivált sort jelöli meg; itt csak
  // olvassuk. Ha minden link archivált, NINCS élő — ez legitim állapot, és ki is mondjuk.
  const live = prospects.find((p) => p.isLive) ?? null;
  const earlier = prospects.filter((p) => !p.isLive);
  // ③ A KATTINTÁS ELŐTT mondjuk ki, mi lesz a mostanival — nem visszautasító sávban.
  // A sáv ÁLLANDÓAN látszik (JS nélkül is), a gomb megerősítése csak ráadás.
  const liveWarning = live
    ? `<div class="con-livewarn">${T(lang, "⚠ Már van ÉLŐ link ehhez a leadhez. Ha újat készítesz, AZ lesz az élő, a mostani a korábbiak közé kerül — a leadhez korábban kiküldött cím ettől még a RÉGI linkre mutat, és az meg is nyílik.")}</div>`
    : "";
  // A megtagadás ITT jelenik meg, ahol a kattintás történt — nem egy másik fülön.
  const gateBox =
    photoGate && photoGate.where === "prospect" ? photoGateBox(photoGate, photoGate.artifactId) : "";
  const createForm = approved
    ? gateBox +
      whichMock +
      `<form method="post" action="/lead/${esc(d.id)}/prospect" class="row" style="flex-wrap:wrap;gap:8px"${
        live
          ? ` onsubmit="return confirm('${esc(jsStr(T(lang, "Már van ÉLŐ link ehhez a leadhez. Ha újat készítesz, az lesz az élő, a mostani a korábbiak közé kerül. A leadhez korábban kiküldött cím ettől még a RÉGI linkre mutat. Folytatod?")))}')"`
          : ""
      }>
        <input type="hidden" name="artifactId" value="${esc(approved.id)}">
        <select name="segment">${SEGMENTS(lang).map(
          (s) =>
            `<option value="${esc(s.id)}"${d.qualification === "no_site" && s.id === "nincs_honlap" ? " selected" : ""}${d.qualification === "outdated" && s.id === "elavult" ? " selected" : ""}${d.qualification === "modern" && s.id === "van_labnyom" ? " selected" : ""}>${esc(s.label)}</option>`,
        ).join("")}</select>
        <input type="email" name="email" placeholder="${T(lang, "címzett e-mail címe")}" style="min-width:220px">
        <button type="submit">${T(lang, "Követett link készítése")}</button>
      </form>
      ${
        // ⑤ A MEZŐ A KÖVETKEZMÉNYT MONDJA, nem azt, hogy „(opcionális)" (jóváhagyott
        // terv „A"). Az „opcionális" igaz volt, de félrevezető: a link tényleg elkészül
        // cím nélkül — csak épp a rendszer NEM tud levelet küldeni vele, és ezt az
        // operátor csak a piszkozat-lapon tudta meg. JS nélkül is itt áll.
        `<p class="mut small" style="margin:6px 0 0">${T(lang, "Cím nélkül is elkészül a link (kézzel elküldhető) — de a rendszer nem tud levelet küldeni, amíg nincs cím.")}</p>`
      }
      ${liveWarning}`
    : `<p class="mut small">${T(lang, "Követett link jóváhagyott mockhoz készíthető (előbb kuráció).")}</p>`;

  // ① EGY ÉLŐ KÁRTYA KIEMELVE, a többi a „Korábbi linkek" alatt. ⚠️ A jóváhagyott mock
  // „Archív linkek"-et írt; a valódi adatban viszont a régebbi linkek TÖBBSÉGE sosem lett
  // archiválva — csak újabb készült utánuk. Őket „archív"-nak nevezni valótlan állítás
  // lenne a képernyőn (§B.17 magunkra is áll), ezért a szekció „Korábbi linkek", és az
  // „archiválva" pirula CSAK azon ül, amit az operátor tényleg archivált. A szerkezet
  // (egy kiemelt élő + összecsukott többi) a terv szerinti.
  const card = (p: ProspectView): string => {
      const link = `/p/${p.token}`;
      return `<div class="con-linkcard${p.isLive ? " con-linkcard--live" : " con-linkcard--old"}" data-cit-link="${p.isLive ? "live" : "old"}">
        <div class="row" style="justify-content:space-between;margin-top:0">
          <span>
            ${
              p.isLive
                ? `<span class="pill con-pill-live">${T(lang, "ÉLŐ — ez megy a leadhez")}</span>`
                : `<span class="pill">${p.archivedAt ? T(lang, "archiválva · {date}", { date: esc(p.archivedAt.slice(0, 16).replace("T", " ")) }) : T(lang, "korábbi")}</span>`
            }
            <span class="pill ${p.status === "order_intent" || p.status === "converted" ? "approved" : ""}">${esc(prospectStatusLabel(p.status, lang))}</span>
            ${p.segment ? `<span class="pill">${esc(segmentLabel(p.segment, lang))}</span>` : ""}
            ${channelPills(p, lang)}
            ${p.unsubscribedAt ? `<span class="pill rejected">${T(lang, "leiratkozott · {date}", { date: esc(p.unsubscribedAt.slice(0, 16).replace("T", " ")) })}</span>` : ""}
          </span>
          <span class="mut small">${esc(p.createdAt.slice(0, 16).replace("T", " "))}</span>
        </div>
        <div class="small" style="margin-top:6px">
          <a href="${esc(link)}" target="_blank">${esc(link)}</a>
          ${
            // ⛔ KÉT HIBA EGY SORBAN, mindkettőt javítva (2026-09-15):
            // ① A link alapértelmezett navigációja ELVISZI A LAPOT, ha a vágólap-hívás
            //    dob (engedély, nem-biztonságos kontextus) — a `return false` a végén
            //    ilyenkor sosem fut le. A `preventDefault()` ezért ELSŐ.
            // ② A régi gomb HAZUDOTT: a feliratot szinkronban „másolva"-ra írta, holott a
            //    `writeText` PROMISE-t ad — elutasításkor is „másolva" maradt. Most a
            //    felirat a TÉNYLEGES eredményt mondja, és bukásnál megmondja a kiutat
            //    (a `/p/…` cím ott áll mellette, kézzel másolható).
            `<a class="con-linkact" href="${esc(link)}" style="margin-left:10px"
              onclick="${esc(
                // A felirat AZONNAL vált — de csak a folyamatra, nem az eredményre: a
                // `writeText` promise-t ad, és az eredményt csak a rendezés után tudjuk.
                // Így a kezelő kap rögtön visszajelzést, és a lap egyetlen pillanatban
                // sem állít sikert, ami esetleg nem történt meg (§B.17).
                `event.preventDefault();var b=this;b.textContent='${jsStr(T(lang, "másolás…"))}';` +
                  `navigator.clipboard.writeText(location.origin+'${jsStr(link)}')` +
                  `.then(function(){b.textContent='${jsStr(T(lang, "másolva"))}'})` +
                  `.catch(function(){b.textContent='${jsStr(T(lang, "nem sikerült — másold a fenti címet"))}'})`,
              )}">${T(lang, "link másolása")}</a>`
          }
        </div>
        <div class="mut small" style="margin-top:4px">
          ${p.contactEmail ? `${esc(p.contactEmail)} · ` : ""}${p.views} megnyitás · ${p.events} esemény
          ${p.sentAt ? T(lang, " · kiküldve {date}", { date: esc(p.sentAt.slice(0, 16).replace("T", " ")) }) : ""}
        </div>
        ${
          // ⛔ FORGALOM EGY SOSEM KÜLDÖTT LINKEN (Elek FK-004 Z3). A lap egyszerre
          // állította, hogy „még nem ment ki" és hogy 119 esemény történt rajta — mindkettő
          // IGAZ, de együtt olvasva a szám lead-érdeklődésnek látszik. Mérve 2026-09-13:
          // 5 sosem-küldött linkből 3-on volt forgalom, és minden nézet ugyanarról a
          // Linux-desktop böngészőről jött, azaz SAJÁT megnyitás. A szám marad (adat),
          // csak megmondjuk, mi NEM lehet: a megkeresés címzettje.
          !p.sentAt && p.views > 0
            ? `<div class="small" style="margin-top:4px;color:var(--citui-bad-ink)">${T(
                lang,
                "⚠ Ez a link még egyik csatornán sem ment ki, tehát ez a forgalom NEM a megkeresés címzettjétől van — saját megnyitás, előnézet vagy teszt.",
              )}</div>`
            : ""
        }
        <div class="row con-linkacts" style="margin-top:6px">
          ${
            // ④ EGY ELSŐDLEGES GOMB KÁRTYÁNKÉNT. A régi lapon a navigáció, a navigáció és
            // az ÁLLAPOT-ÁTÍRÓ művelet ugyanazt a navy gradienst viselte — a felület nem
            // mondta meg, melyik kattintás ír. A küldés marad gomb; a Tevékenység és a
            // link-másolás LINK lett. (Küldeni csak az ÉLŐ linkről van értelme: a korábbi
            // sorok küldés-útja amúgy is elhal a cím-szintű egyszer-küldésen, ADR-0122.)
            !p.unsubscribedAt && p.isLive
              ? `<form method="get" action="/prospect/${esc(p.id)}/draft" style="display:inline;margin:0">
                   <button type="submit" class="con-ib">${ic("mail", 15)}${T(lang, "E-mail / SMS megnyitása — küldés ▸")}</button></form>`
              : ""
          }
          <a class="con-linkact" href="/prospect/${esc(p.id)}/activity">${T(lang, "Tevékenység — mit csinált ({v} megnyitás · {e} esemény) ▸", { v: p.views, e: p.events })}</a>
          ${
            // ⛔ THIS IS AN ACTION, NOT A STATE (Elek FK-004 ②). Labelled "Kiküldve —
            // mérés indul" and painted green (class "ok"), it read as a SENT badge —
            // and it only ever appears on the row that has NOT been sent, while the row
            // that actually went out has no button at all. The screen was therefore
            // inverted: the green "sent" mark sat on the unsent row. Imperative label,
            // no success colour; the real state is the "✓ E-mail elküldve" pill above.
            // ⛔ …AND IT IS IRREVERSIBLE, WITHOUT ASKING (B6, 2026-09-14). `markProspectSent`
            // stamps `email_sent_at`/`sent_at` with `WHERE … IS NULL` and the UI has no
            // un-mark: one stray click closes the e-mail channel for this outreach FOREVER,
            // and (ADR-0122, address-level one-shot) for the address on every other tracked
            // link too. The two real sends on the draft page both confirm first; this one —
            // the only one that changes state straight from the list — did not. Same
            // pattern, same page, stated BEFORE the click, never in a rejection banner.
            p.status === "created" && !p.unsubscribedAt
              ? `<form method="post" action="/prospect/${esc(p.id)}/sent" style="display:inline;margin:0"
                   onsubmit="return confirm('${esc(
                     jsStr(
                       T(
                         lang,
                         "Megjelölöd kiküldöttként? Ezzel LEZÁRUL az e-mail csatorna ezen a megkeresésen — a rendszerből utána már nem küldhető ki a levél, és a felületről ez nem vonható vissza. Csak akkor nyomd meg, ha tényleg elküldted.",
                       ),
                     ),
                   )}')">
                   <input type="hidden" name="leadId" value="${esc(d.id)}">
                   <button type="submit" class="ghost">${T(lang, "Megjelölöm kiküldöttként")}</button></form>`
              : ""
          }
          ${
            // ② AZ ARCHIVÁLÁS NEM TÖRLÉS — és a kérdés ezt ki is mondja. A `/p/<token>` cím
            // továbbra is megnyílik (a leadnek már kiküldhettük), csak nem ez lesz az ÉLŐ.
            // VISSZAVONHATÓ: egy téves kattintás nem zsákutca (a ház mintája az opt-out
            // `resubscribe`-ja — csak itt nincs jogi állapot, ezért indoklás sem kell).
            p.archivedAt
              ? `<form method="post" action="/prospect/${esc(p.id)}/unarchive" style="display:inline;margin:0;margin-left:auto">
                   <input type="hidden" name="leadId" value="${esc(d.id)}">
                   <button type="submit" class="ghost">${T(lang, "Visszaállítás")}</button></form>`
              : `<form method="post" action="/prospect/${esc(p.id)}/archive" style="display:inline;margin:0;margin-left:auto"
                   onsubmit="return confirm('${esc(jsStr(T(lang, "Archiválod ezt a linket? A /p/… cím továbbra is megnyílik (a leadnek már kiküldhettük), de nem ez lesz az ÉLŐ, és megkeresés nem indul róla. Bármikor visszaállítható.")))}')">
                   <input type="hidden" name="leadId" value="${esc(d.id)}">
                   <button type="submit" class="bad">${T(lang, "Archiválás")}</button></form>`
          }
        </div>
        ${
          // ⛔ A GOMB A SAJÁT TETTÉT MONDJA (jóváhagyott terv ⑨). A régi felirat
          // („…— mérés indul") olyat állított, ami MÁR MEGTÖRTÉNT: a mérés a link
          // létrehozása óta fut, és ezen a linken mérve 119 esemény van. A mondat most a
          // gomb MELLETT mondja el, mit jelent a megjelölés — nem a gomb hazudik helyette.
          p.status === "created" && !p.unsubscribedAt
            ? `<p class="mut small" style="margin:6px 0 0">${T(
                lang,
                "A mérés a link létrehozása óta fut; a megjelölés azt rögzíti, hogy INNENTŐL a forgalom a címzetté.",
              )}</p>`
            : ""
        }
        ${optoutBox(p, d.id, lang)}
      </div>`;
  };

  const earlierBlock = earlier.length
    ? `<details class="con-oldlinks"${earlier.some((p) => !p.archivedAt) ? "" : ""}>
         <summary>${T(lang, "Korábbi linkek ({n}) — nem ezek mennek a leadhez", { n: earlier.length })}</summary>
         ${earlier.map(card).join("")}
       </details>`
    : "";
  // Legitim állapot, és kimondjuk: mindent archiváltak, tehát NINCS mit kiküldeni.
  const noLive =
    prospects.length && !live
      ? `<p class="mut small" style="margin-top:10px">${T(lang, "Most nincs ÉLŐ link ehhez a leadhez — minden korábbit archiváltak. Készíts újat, ha meg akarod keresni.")}</p>`
      : "";

  return `<div class="panel" id="prospects"><h2>${T(lang, "Megkeresés — követett link ({n})", { n: prospects.length })}</h2>
    ${createForm}${live ? card(live) : ""}${noLive}${earlierBlock}
    <details class="mut small" style="margin-top:8px">
      <summary style="cursor:pointer">${T(lang, "Hogyan működik a mérés?")}</summary>
      <p style="margin:6px 0 0">A /p/&lt;token&gt; link minden megnyitása külön
      mérési session (open/scroll/dwell/modul-események). A „Megjelölöm kiküldöttként" gomb
      innen indítja a mérést: ettől a ponttól számít a megnyitás, az érdeklődés és a
      megrendelés — a rendszerből küldött levél magától bejelöli.
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
  const label = sourceLabel(source);
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
      ? `<span class="con-fld__src">${T(lang, "adatgyűjtésből")}: ${esc(edited[k])}</span>`
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
          <div class="con-fld" style="grid-column:1/-1">
            <label class="con-fld__l" for="ed-ownerIntro">${T(lang, "Tulaj-bemutatkozás")}</label>
            <textarea id="ed-ownerIntro" name="ownerIntro" rows="4" maxlength="2000"
              placeholder="${esc(T(lang, "A tulaj saját, nyilvános bemutatkozó szövege — pl. a Facebook-oldal Névjegyéből kimásolva. A generátor forrásolt leírásként használja: a benne megnevezett szolgáltatások (dézsa, szauna…) a főcímbe kerülhetnek."))}"
              style="width:100%;padding:8px 10px;font-family:inherit;font-size:13px">${esc((raw as { ownerIntro?: string }).ownerIntro ?? "")}</textarea>
          </div>
        </div>
        <div class="row" style="margin-top:12px">
          <button type="submit">${T(lang, "Adatok mentése")}</button>
        </div>
      </form>

      <h3 class="con-facts__h">${T(lang, "Minősítés és forrás")}</h3>
      <div class="con-fact-grid">
        ${fact(
          T(lang, "Honlap-státusz"),
          raw.websiteStatus
            ? esc(
                raw.websiteStatus === "has_own"
                  ? T(lang, "saját honlap")
                  : raw.websiteStatus === "portal_only"
                    ? T(lang, "csak portál-jelenlét")
                    : raw.websiteStatus === "none"
                      ? T(lang, "nincs honlap")
                      : raw.websiteStatus,
              )
            : `<span class="mut">–</span>`,
        )}
        ${fact(
          "Kontakt-csatorna",
          raw.contactChannel
            ? esc(
                raw.contactChannel === "email"
                  ? T(lang, "e-mail")
                  : raw.contactChannel === "sms"
                    ? "SMS"
                    : raw.contactChannel === "voice"
                      ? T(lang, "telefon")
                      : raw.contactChannel === "none"
                        ? T(lang, "nincs")
                        : raw.contactChannel,
              )
            : `<span class="mut">–</span>`,
        )}
        ${fact(
          T(lang, "Koordináta"),
          raw.lat != null && raw.lon != null
            ? `<a href="https://www.google.com/maps?q=${raw.lat},${raw.lon}" target="_blank" rel="noopener">${raw.lat.toFixed(5)}, ${raw.lon.toFixed(5)}</a>`
            : `<span class="mut">–</span>`,
        )}
        ${fact(T(lang, "Források"), sources)}
        ${fact("Anyag", imageBreakdown(d, mat, lang), true)}
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
        ? `<a href="${esc(c.sourceUrl)}" target="_blank" rel="noopener">${esc(sourceLabel(c.source))}${ic("external", 11)}</a>`
        : esc(sourceLabel(c.source));
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

/**
 * Why the Places half of the strip is missing, in words — keyed by the machine code the
 * route returns. ⛔ These replace a sentence that made a claim about the LEAD ("nem
 * találtunk fotót") when the failure was OURS: on 2026-09-09 our SearchText day-quota was
 * spent (HTTP 429) while the list beside it still showed "10 kép", and the operator was
 * left to conclude the record was broken. An outage must name itself.
 */
function placesOutageText(lang: string): {
  cause: Record<string, string>;
  none: string;
  partial: string;
} {
  return {
    // The CAUSE alone — the two frames below decide what it means for this strip.
    cause: {
      quota: T(lang, "a napi kvótánk kimerült"),
      auth: T(lang, "elutasította a kulcsunkat (kulcs vagy számlázás)"),
      network: T(lang, "nem válaszolt (hálózati hiba)"),
      upstream: T(lang, "hibát adott"),
    },
    /** Nothing at all came back. */
    none: T(
      lang,
      "A Google Places {cause} — a fotók emiatt nem tölthetők be. Ez a mi korlátunk, nem a lead hibája.",
    ),
    /**
     * Portal photos DID arrive. ⛔ The single-sentence version claimed "a fotók nem
     * tölthetők be" under a visible strip of 14 of them — true about Places, false about
     * the screen. A partial outage has to say which half is missing.
     */
    partial: T(
      lang,
      "A Google Places {cause} — csak a portál-adatlap fotói látszanak, a Places-képek hiányoznak.",
    ),
  };
}

/** Ugyanazok a feliratok a kliensnek — egy szótár, két oldal (nem két igazság). */
function heroSubjectLabels(lang: string): Record<string, string> {
  const keys = ["exterior","view","interior","pool_garden","dining","bathroom","toilet",
    "detail","parking","sign_map","people_doc","ad_banner","other"];
  return Object.fromEntries(keys.map((k) => [k, heroSubjectLabel(k, lang)]));
}

/** Tárgy-kategória → operátor-felirat. A kód angolul tárol, a konzol magyarul beszél. */
function heroSubjectLabel(subject: string, lang: string): string {
  switch (subject) {
    case "exterior": return T(lang, "épület kívülről");
    case "view": return T(lang, "kilátás");
    case "interior": return T(lang, "belső tér");
    case "pool_garden": return T(lang, "kert / terasz");
    case "dining": return T(lang, "étkező");
    case "bathroom": return T(lang, "fürdőszoba");
    case "toilet": return T(lang, "WC");
    case "detail": return T(lang, "részlet");
    case "parking": return T(lang, "parkoló");
    case "sign_map": return T(lang, "tábla / térkép");
    case "people_doc": return T(lang, "portré / dokumentum");
    case "ad_banner": return T(lang, "reklámbanner");
    default: return T(lang, "egyéb");
  }
}

/** The lead's real photos, loaded on demand (a Places lookup costs money, so it
 *  happens only when an operator actually opens the lead). */
function leadPhotosPanel(leadId: string, latestArtifactId?: string, currentHeroUrl?: string): string {
  const lang = consoleLang();
  // ⚠️ A rács az ÉLŐ fotólistát kéri le, a mock viszont egy PILLANATKÉP: a kettő sorrendje
  // eltérhet (időközben új pontszám született, más Places-URL jött vissza). Ezért a
  // nyitóképet nem a "0. elem" jelöli, hanem a mock TÉNYLEGES nyitóképe — különben a
  // Fotók fül mást állítana, mint a mock-panel. Egy igazság, két felület.
  const heroKey = (currentHeroUrl ?? "").split("?")[0]!.toLowerCase();
  const outage = placesOutageText(lang);
  return `<div class="panel">
      <h2>${T(lang, "Fotók")}</h2>
      <div id="leadPhotos" class="lead-photos"></div>
      <p id="photoMsg" class="mut small" style="margin:10px 0 0">${T(lang, "Fotók betöltése…")}</p>
      <div id="hpWarnB"></div>
      <form method="post" action="/lead/${esc(leadId)}/hero" id="hpFormB" style="display:none">
        <input type="hidden" name="url" value="">
        <input type="hidden" name="artifactId" value="${esc(latestArtifactId ?? "")}">
      </form>
      <form method="post" action="/lead/${esc(leadId)}/rescrape-photos" class="con-reenrich"
        style="margin-top:12px"
        onsubmit="${esc(`var b=this.querySelector('button');b.disabled=true;b.textContent='${jsStr(T(lang, "Fotók újra-scrapelése folyamatban…"))}'`)}">
        <button type="submit" class="ghost">${ic("scrape", 15)} ${T(lang, "Portál-fotók újragyűjtése")}</button>
        <p class="mut small" style="margin:6px 0 0">${T(lang, "Újra beolvassa a portál-adatlap fotóit; a már kiküldött mockot nem írja felül.")}</p>
      </form>
      <script>
        fetch('/lead/${esc(leadId)}/photos')
          .then(function (r) { return r.json(); })
          .then(function (d) {
            var box = document.getElementById('leadPhotos');
            var msg = document.getElementById('photoMsg');
            // An OUTAGE is not a finding about the lead — say which one happened, and
            // whether it took the WHOLE strip or only the Places half of it.
            var OUTAGE = ${JSON.stringify(outage)};
            var cause = d.unavailable ? (OUTAGE.cause[d.unavailable] || OUTAGE.cause.upstream) : '';
            function outageText(frame) { return frame.replace('{cause}', cause); }
            if (!d.photos || !d.photos.length) {
              msg.textContent = cause
                ? outageText(OUTAGE.none)
                : '${jsStr(T(lang, "Ehhez a leadhez nem találtunk fotót."))}';
              if (cause) msg.className = 'small con-warn';
              return;
            }
            // The photos are a SET the operator compares (is this really their
            // place? is there a usable hero shot?) — so they open as a gallery,
            // not as separate tabs that lose the set.
            // The source is part of what the operator judges (a portal listing image is
            // the owner's own marketing shot; a Places one is usually a guest snapshot),
            // so the rights class rides along into the caption.
            var srcLabel = { portal: 'portál-adatlap', places: 'Google Places', streetview: 'Street View', owner: 'tulaj', guest: 'vendég', generated: 'generált' };
            // A nagyítás is a proxyn át tölt: ha a forrás halott, a lightbox is a
            // MAGYARÁZATOT mutatja, nem egy üres fekete dobozt (FK-003b ①).
            window.citLeadPhotos = d.photos.map(function (p, k) {
              return { src: p.proxy || p.url, cap: 'Fotó ' + (k + 1) + ' · ' + (srcLabel[p.provenance] || p.provenance || 'ismeretlen forrás') };
            });
            // Nyitókép-választó (jóváhagyott terv "B" változata): a pontszám ÉS az
            // indoklás a képen, alatta a gomb. Az első fotó a mock nyitóképe — a
            // motor sorrendje már ezt hozza —, ezért az kiemelt kerettel áll.
            var SUBJ = ${JSON.stringify(heroSubjectLabels(lang))};
            var NEVER = ['toilet','bathroom','parking','sign_map','people_doc','ad_banner'];
            var HERO_KEY = ${JSON.stringify(heroKey)};
            var keyOf = function (u) { return String(u).split('?')[0].toLowerCase(); };
            box.innerHTML = d.photos.map(function (p, k) {
              var isHero = HERO_KEY ? keyOf(p.url) === HERO_KEY : k === 0;
              var sc = (p.score === null || p.score === undefined) ? null : p.score;
              return '<figure class="hp-cell" style="margin:0">'
                + '<a href="' + p.url + '" onclick="event.preventDefault();citLb.open(window.citLeadPhotos,' + k + ')"'
                + ' title="${T(lang, "' + (srcLabel[p.provenance] || 'ismeretlen forrás') + ' — nagyban megnézem, nyilakkal léphetsz")}">'
                + '<img src="' + (p.proxy || p.url) + '" loading="lazy" alt=""'
                + (isHero ? ' style="outline:2px solid var(--citui-cyan-500);outline-offset:-2px"' : '') + '></a>'
                + (sc === null ? '' : '<span class="hp-sc' + (sc < 55 ? ' low' : '') + '">' + sc + '</span>')
                + '<figcaption class="hp-meta">' + (sc === null
                    ? '${jsStr(T(lang, "erről a képről nincs ítéletünk"))}'
                    : (SUBJ[p.subject] || p.subject) + ' — ' + (p.reason || ''))
                + '</figcaption>'
                + '<button class="hp-pick" data-url="' + encodeURIComponent(p.url) + '"'
                + ' data-subject="' + (p.subject || '') + '" data-score="' + (sc === null ? '' : sc) + '"'
                + ' data-reason="' + String(p.reason || '').replace(/"/g, '&quot;') + '"'
                + (isHero ? ' disabled' : '') + '>'
                + (isHero ? '${jsStr(T(lang, "ez a nyitókép"))}' : '${jsStr(T(lang, "Legyen ez a nyitókép"))}')
                + '</button></figure>';
            }).join('');
            // Ugyanaz a szabály, mint az A változatban: kizárt tárgyú vagy gyenge képnél
            // megerősítést kérünk — de nem tiltunk. Az ember dönt, csak tudja, mit választ.
            box.querySelectorAll('.hp-pick').forEach(function (b) {
              if (b.disabled) return;
              b.addEventListener('click', function () {
                var sc = parseInt(b.dataset.score, 10);
                var risky = NEVER.indexOf(b.dataset.subject) >= 0 || (isFinite(sc) && sc < 55);
                if (risky && !confirmBox(b)) return;
                submitHero(decodeURIComponent(b.dataset.url));
              });
            });
            function confirmBox(b) {
              var box2 = document.getElementById('hpWarnB');
              box2.innerHTML = '<div class="hp-warnbox"><b>${jsStr(T(lang, "Biztos ez legyen a lap teteje?"))}</b><br>'
                + (SUBJ[b.dataset.subject] || b.dataset.subject) + ' · ' + (b.dataset.score || '?') + '/100 — ' + b.dataset.reason
                + '<div class="hp-warnrow"><button type="button" class="btn" id="hpYesB">${jsStr(T(lang, "Igen, ez legyen"))}</button>'
                + '<button type="button" class="ghost" id="hpNoB">${jsStr(T(lang, "Mégsem"))}</button></div></div>';
              document.getElementById('hpYesB').onclick = function () {
                box2.innerHTML = ''; submitHero(decodeURIComponent(b.dataset.url));
              };
              document.getElementById('hpNoB').onclick = function () { box2.innerHTML = ''; };
              return false;
            }
            // A mentés nem publikálás: a szerver a választás után ÚJRARENDERELI a mockot,
            // és amíg fut, ezt a felület kimondja.
            function submitHero(url) {
              document.getElementById('hpWarnB').innerHTML =
                '<p class="small mut">${jsStr(T(lang, "Újrarenderelem a mockot az új nyitóképpel…"))}</p>';
              var f = document.getElementById('hpFormB');
              f.querySelector('input[name=url]').value = url;
              f.submit();
            }
            var nPortal = d.photos.filter(function (p) { return p.provenance === 'portal'; }).length;
            msg.textContent = d.photos.length + ' fotó'
              + (nPortal ? ' (' + nPortal + ' portál-adatlapról)' : '')
              + (d.rating ? ' · Google-értékelés: ' + d.rating + '★' + (d.ratingCount ? ' (' + d.ratingCount + ')' : '') : '') +
              (d.band ? ' · match: ' + d.band : '');
            // PARTIAL answer: the portal photos arrived, the Places ones could not.
            // Saying only "N fotó" would present an incomplete set as the complete one.
            if (cause) {
              var warn = document.createElement('p');
              warn.className = 'small con-warn';
              warn.style.margin = '6px 0 0';
              warn.textContent = outageText(OUTAGE.partial);
              msg.parentNode.insertBefore(warn, msg.nextSibling);
            }
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
/**
 * A KIJELÖLT KINÉZET ELŐNÉZETE — ENNEK a leadnek az adatával (FK-003b ④).
 *
 * ⛔ MÉRT HIBA (2026-09-11): a panel egy statikus sablon-képet mutatott „A kijelölt
 * kinézet mintája (VALÓS ADATTAL)" felirattal, a képen viszont egy MÁSIK szállás mockja
 * állt („Csend és kilátás a hegy tetején"). A felirat önmagára igaz volt (valós adat —
 * csak nem ezé a leadé), és pont ettől olvasódott a saját lead előnézeteként.
 *
 * Ha van eltárolt pillanatkép (recipe + siteData), a keretben a lead SAJÁT lapja fut át
 * a kijelölt sablonon — AI nélkül, a `/lead/:id/tpl-preview` route-on. Ha nincs, marad a
 * minta-kép, de a felirat KIMONDJA, hogy idegen szállás mintája.
 */
function tplPreview(d: LeadDetail, lang: string): string {
  const hasSnapshot = d.artifacts.some((a) => {
    const i = a.inputs as { recipe?: unknown; siteData?: unknown };
    return Boolean(i?.recipe && i?.siteData);
  });
  if (!hasSnapshot) {
    return `<figure id="tpl-prev">
        <img id="tpl-prev-img" src="/assets/ui/tpl-fullbleed-prev.jpg" alt="${T(lang, "Sablon-előnézet")}" onclick="citTplZoom()">
        <figcaption class="small mut" style="margin-top:4px">${T(
          lang,
          "MÁSIK szállás mintája ezen a kinézeten — ehhez a leadhez még nincs generált adat. Az első mock után itt a saját lapja lesz.",
        )}</figcaption>
      </figure>`;
  }
  return `<figure id="tpl-prev" class="tpl-prev--live">
      <iframe id="tpl-prev-frame" title="${T(lang, "A kijelölt kinézet ennek a leadnek az adatával")}"
        loading="lazy" src="/lead/${esc(d.id)}/tpl-preview?tpl=fullbleed"></iframe>
      <figcaption class="small mut" style="margin-top:4px">${T(
        lang,
        "{name} SAJÁT adata a kijelölt kinézeten — a szöveg a legutóbbi mockból való, nem újragenerált.",
        { name: esc(d.name) },
      )}</figcaption>
    </figure>`;
}

function templateCards(selected = ""): string {
  // ⛔ NOTHING is pre-checked. These are checkboxes (one mock per ticked template);
  // a pre-checked default silently added a second, unwanted mock to every run and
  // made the picker look broken ("kiválasztom X-et, ugyanazt gyártja le").
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

/**
 * A MOCK-GENERÁLÁS ÁLLAPOTA, ahogy a lead-lap teteje látja (FK-003b ②, jóváhagyott
 * „A" változat: `assets/design-refs/console/gen-running/`).
 *
 * Három állapot, mert a háttérmunka HÁROM dolgot tartozik: hogy ELINDULT (`running`),
 * hogy MENNYI IDEJE fut (`startedAt` — eltelt idő nélkül nem lehet tudni, most indult-e
 * vagy beragadt), és hogy MIÉRT bukott (`outcome`).
 */
export interface GenerateState {
  readonly running: boolean;
  /** epoch ms; `running` mellett kötelező, különben nincs mit visszaszámolni */
  readonly startedAt?: number | null;
  /** A MOTOR által jelentett, most futó szakasz (FK-003b L03) — valós jel, nem animáció. */
  readonly stage?: GenStageKey | null;
  /** Elkészült / összes sablon. Több sablonnál EZ a becsületes haladás-jel. */
  readonly done?: number;
  readonly total?: number;
  readonly outcome?: {
    ok: boolean;
    message: string;
    /** Meddig tartott — a lezáró sor kimondja (FK-003b L06). */
    durationMs?: number;
    /** Hova vezet az eredmény (pontosan egy elkészült mock esetén). */
    artifactId?: string | null;
  } | null;
}

/** Szakasz-kulcs → a kurátornak mutatott felirat (a KULCS utazik, a szöveg itt születik). */
function stageLabel(stage: GenStageKey, lang: string): string {
  const L: Record<GenStageKey, string> = {
    load: T(lang, "adatok betöltése"),
    photos: T(lang, "fotók gyűjtése és szűrése"),
    copy: T(lang, "szöveg generálása"),
    render: T(lang, "oldal renderelése"),
  };
  return L[stage];
}

/** m:ss — az eltelt és a teljes futásidő egységes alakja. */
function mmss(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * A mock „receptjének" mezői EMBERI néven — jóváhagyott terv ⑧
 * (`assets/design-refs/console/lead-page/`).
 *
 * ⛔ Ismeretlen kulcsot NEM találunk ki: olvashatóvá tesszük (alsó vonás → szóköz), tehát
 * egy ÚJ mező csúnyán, de IGAZUL jelenik meg — nem tűnik el, és nem kap hamis magyar nevet
 * (ADR-0141 ① mintája, ugyanaz a szabály, mint a lista állapot-regiszterében).
 */
function mockInputLabel(key: string, lang = "hu"): string {
  switch (key) {
    case "template": return T(lang, "Sablon");
    case "skin": return T(lang, "Arculat");
    case "archetype": return T(lang, "Elrendezés");
    case "photos": return T(lang, "Képek a lapon");
    case "heroSubject": return T(lang, "Nyitókép témája");
    case "heroScore": return T(lang, "Nyitókép pontszáma");
    case "heroReason": return T(lang, "Nyitókép indoklása");
    case "factVerdict": return T(lang, "Tényhűség-kapu");
    case "marketVerdict": return T(lang, "Piac-kapu");
    case "designVerdict": return T(lang, "Dizájn-kapu");
    case "heroVerdict": return T(lang, "Nyitókép-kapu");
    case "engine": return T(lang, "Motor");
    case "region": return T(lang, "Gyűjtési terület");
    case "recipeSource": return T(lang, "Recept forrása");
    case "marketAmenityTotal": return T(lang, "Ismert tételek száma");
    case "factCandidates": return T(lang, "Vizsgált tény-jelöltek");
    case "guestReviewCount": return T(lang, "Felhasznált vendég-vélemény");
    case "marketReason": return T(lang, "Piac-kapu indoklása");
    default: return key.replace(/_/g, " ");
  }
}

/**
 * A négy kapu RÖVID neve a mock-kártya jelvény-sorára (mock-cards kontraktus ④).
 *
 * ⛔ Nem új szótár egy meglévő helyett: a jelvények fölött a `Kapuk` felirat áll, tehát a
 * `Tényhűség-kapu` alak ott „kapuk / tényhűség-kapu"-t mondana — és a teljes nevekkel a
 * négy jelvény KÉT sorba tört, szemben a tulaj által jóváhagyott képpel (a jóváhagyott
 * vázlat a kontraktus, a rendszer szokása nem írhatja felül). A TELJES név nem vész el:
 * a jelvény `title`-je a `mockInputLabel` nevét és a verdikt szavát viseli.
 */
function gateShortLabel(key: string, lang = "hu"): string {
  switch (key) {
    case "factVerdict": return T(lang, "Tényhűség");
    case "marketVerdict": return T(lang, "Piac");
    case "designVerdict": return T(lang, "Dizájn");
    case "heroVerdict": return T(lang, "Nyitókép");
    default: return mockInputLabel(key, lang);
  }
}

/** A kapu-verdiktek értéke is szöveg, nem `pass`/`flag` enum. */
function mockInputValue(key: string, v: unknown, lang = "hu"): string {
  if (key.endsWith("Verdict")) {
    if (v === "pass") return T(lang, "átment");
    if (v === "flag") return T(lang, "megjelölve");
    if (v === "fail") return T(lang, "elbukott");
  }
  if (key === "template" && typeof v === "string") {
    return (TEMPLATES[v]?.label.split(/[—:(]/)[0] ?? v).trim() || v;
  }
  // ⛔ Raw enum leaked: the named meta row said „Nyitókép témája: pool_garden" — the
  // label was translated, its VALUE was not. Same dictionary as the photo panel and
  // the compare table (one word per meaning, not two truths on one screen).
  if (key === "heroSubject" && typeof v === "string") {
    return heroSubjectLabel(v, lang);
  }
  return String(v);
}

/**
 * MIÉRT nincs pillanatkép — EGY szótár, két felület.
 *
 * ⛔ Ez a mondat-készlet korábban a megkeresés-vázlat lapjába volt beágyazva. A
 * mock-kártya (mock-cards kontraktus ③) ugyanezeket az okokat mutatja, és ha a
 * második helyen újraírtam volna, két igazság állna két képernyőn ugyanarról a
 * hibáról (`feedback_one_rule_two_copies`). Egy szabály, egy példány.
 */
export function heroShotFailReason(fail: HeroShotState & { kind: "failed" }, lang: string): string {
  const f = fail.fail;
  if (f.code === "no-artifact") {
    return T(lang, "ehhez a megkereséshez nincs látványterv, amiből kép készülhetne");
  }
  if (f.code === "no-mock-file") {
    return T(lang, "a látványterv fájlja nincs meg a lemezen ({file}) — újragenerálás kell", {
      file: esc(f.detail),
    });
  }
  if (f.code === "broken-images") {
    return T(lang, "a látványterv NYITÓKÉPE nem töltődik be, a kép üresen menne ki ({urls})", {
      urls: esc(f.detail),
    });
  }
  return T(lang, "a kép előállítása hibára futott ({error})", { error: esc(f.detail) });
}

/**
 * A MOCK NYITÓOLDALÁNAK PILLANATKÉPE a kurátor-kártyán (mock-cards kontraktus ③).
 *
 * Ugyanaz a kép, ami a megkeresésbe megy (`heroShot.ts` gyorstára) — tehát a kurátor
 * azt látja, amit a lead fog, nem egy másik renderelést.
 *
 * ⛔ A doboz NÉGY állapota mind KIMONDJA magát, és `<img>` CSAK `ready` esetén születik.
 * Egy feltétel nélkül kitett `<img>` a hiányzó képet néma törött-kép ikonná változtatja,
 * a kurátor pedig vakon dönt — ezt az Elek FK-004 H1 már egyszer megmérte az
 * MMS-előnézeten. ⛔ És a doboz nem INDÍT renderelést: a Chromium-futás ~40 s, ezért
 * kimondott kérésre indul (`POST /artifact/:id/shot`).
 */
function mockShotBox(
  artifactId: string,
  state: HeroShotState,
  status: string,
  lang: string,
  links: string,
): string {
  const badge = `<span class="pill ${esc(status)} con-mk__badge">${esc(mockStatusLabel(status, lang))}</span>`;
  if (state.kind === "ready") {
    return `<div class="con-mk__shot" data-mk-shot="${esc(artifactId)}" data-shot-state="ready">
      ${badge}
      <img src="/artifact/${esc(artifactId)}/shot.jpg" alt="${T(lang, "A mock nyitóképernyője")}" loading="lazy">
      ${links}</div>`;
  }
  if (state.kind === "running") {
    return `<div class="con-mk__shot is-empty" data-mk-shot="${esc(artifactId)}" data-shot-state="running">
      ${badge}
      <span class="con-mk__why">${T(lang, "Pillanatkép készül…")}</span>
      ${links}</div>`;
  }
  // Se kép, se futás: a kártya megmondja, MIÉRT, és felkínálja a kimondott kérést.
  const ask = `<form method="post" action="/artifact/${esc(artifactId)}/shot">
      <button class="con-mk__ask" type="submit">${
        state.kind === "failed" ? T(lang, "Újra") : T(lang, "Kép kérése")
      }</button></form>`;
  const why =
    state.kind === "failed"
      ? `<b>${T(lang, "Nincs pillanatkép")}</b> ${heroShotFailReason(state, lang)}`
      : `<b>${T(lang, "Még nem készült pillanatkép")}</b> ${T(
          lang,
          "a kép legyártása ~40 másodperc, ezért külön kérésre indul",
        )}`;
  return `<div class="con-mk__shot is-empty" data-mk-shot="${esc(artifactId)}" data-shot-state="${
    state.kind === "failed" ? "failed" : "none"
  }">
    ${badge}
    <span class="con-mk__why">${why}${ask}</span>
    ${links}</div>`;
}

/** A kurátori döntés szava magyarul (eddig a nyers `approve`/`reject` enum állt a lapon). */
function decisionLabel(decision: string, lang = "hu"): string {
  if (decision === "approve") return T(lang, "Jóváhagyva");
  if (decision === "reject") return T(lang, "Elutasítva");
  return decision.replace(/_/g, " ");
}

/**
 * A döntés-jegyzet olvashatóan — jóváhagyott terv ⑧.
 *
 * ⛔ A fölérendelés eddig `superseded_by:<uuid>` alakban állt a kurátor szeme előtt. Egy
 * uuid nem mond semmit; a felülíró mockot a saját AZONOSÍTHATÓ jegyeivel nevezzük meg
 * (mikor készült, milyen sablonnal) — ha megtaláljuk. Ha nem, a nyers jegyzet marad,
 * mert egy kitalált mondat rosszabb lenne, mint egy csúnya igaz.
 */
function decisionNote(note: string, artifacts: readonly ArtifactView[], lang = "hu"): string {
  // ⚠️ NEM uuid-alakra kötve: az azonosító formája a tároló dolga, nem a feliraté. Az
  // őr fixture-je rövid idővel dolgozik, és egy uuid-hez kötött minta ott NEM illeszkedett
  // — vagyis a nyers `superseded_by:…` jegyzet átment volna a lapra. A minta most az
  // ELŐTAGRA köt, az azonosítót pedig kikeresi.
  const m = /^superseded_by:(\S+)$/i.exec(note.trim());
  if (!m) return note;
  const by = artifacts.find((x) => x.id === m[1]);
  if (!by) return T(lang, "Felülírta egy újabb jóváhagyott mock.");
  const tpl = typeof by.inputs.template === "string" ? by.inputs.template : "";
  const tplName = tpl ? (TEMPLATES[tpl]?.label.split(/[—:(]/)[0] ?? tpl).trim() : "";
  // ⛔ ITT „a(z)” ÁLLT, és a `hu-machine-form-check` fogta meg (ADR-0101 ①): a zárójeles
  // névelő félkész sablonszövegnek olvasódik, és a ragozást a FELHASZNÁLÓRA bízza. A szabály
  // a `hu.ts` EGY példányából jön — beégetni („a”) azért nem szabad, mert a `{when}` alakja
  // a formázó dolga: ha az egyszer „este 6-i”-t ad, a névelő magától vált „az”-ra.
  const when = exactOf(by.generatedAt);
  const art = huArticleLower(when);
  return tplName
    ? T(lang, "Felülírta: {art} {when}-i {tpl} mock.", { art, when, tpl: tplName })
    : T(lang, "Felülírta: {art} {when}-i mock.", { art, when });
}

/**
 * KÉPANYAG — EGY SZÁM, LEVEZETVE (jóváhagyott terv ⑤,
 * `assets/design-refs/console/lead-page/`).
 *
 * ⛔ MÉRT HIBA (Elek FK-003b, ELEK-TESZT lead): HÁROM különböző képszám szólt ugyanarról a
 * leadről, három helyen — **12** (Adatok fül összege), **11** (a portál-bontás), **10** (ami
 * a mockba ment). Ráadásul a bontás nem adta ki az összeget: `0 + 11 + 0 = 11`, mert a
 * Street View „igen”-ként szerepelt, de darabként beleszámított.
 *
 * Most: egy mondat mondja meg, mennyit gyűjtöttünk és mennyi ment a mockba, a bontás pedig
 * KINYITVA áll — és ⛔ ha a részek NEM adják ki az összeget, azt a lap KIMONDJA, nem
 * elsimítja. Egy néma eltérés pont az a hiba, amit ez a pont lezár.
 */
function imageBreakdown(
  d: LeadDetail,
  mat: { totalImages?: number; placesPhotos?: number; websiteImages?: number; streetView?: boolean },
  lang: string,
): string {
  const portal = (mat as { portalPhotos?: number }).portalPhotos ?? 0;
  const places = mat.placesPhotos ?? 0;
  const web = mat.websiteImages ?? 0;
  const sv = mat.streetView ? 1 : 0;
  const total = mat.totalImages ?? places + portal + web + sv;
  const parts = places + portal + web + sv;
  const latest = d.artifacts[0];
  const inMock = typeof latest?.inputs?.photos === "number" ? latest.inputs.photos : null;

  const head =
    inMock != null
      ? `<b>${T(lang, "{n} kép", { n: String(total) })}</b> — ${T(lang, "ebből {m} ment a legutóbbi mockba.", { m: String(inMock) })}`
      : `<b>${T(lang, "{n} kép", { n: String(total) })}</b> — ${T(lang, "még nincs mock, ami felhasználná.")}`;

  const rows = [
    portal ? T(lang, "{n} a portál-adatlapról", { n: String(portal) }) : "",
    places ? T(lang, "{n} a Google Places-ből", { n: String(places) }) : "",
    web ? T(lang, "{n} a talált honlapról", { n: String(web) }) : "",
    sv ? T(lang, "1 Street View-felvétel a címről") : "",
  ].filter(Boolean);

  // ⛔ A RÉSZEK ÉS AZ ÖSSZEG ELTÉRÉSE NEM SIMÍTHATÓ EL — pont ez volt a lelet.
  const mismatch =
    parts !== total
      ? `<div class="con-imgwarn">${ic("alert", 13)} ${T(
          lang,
          "A bontás ({p}) és a tárolt összeg ({t}) nem egyezik — a gyűjtés óta változhatott a forrás. A bontás a megbízhatóbb.",
          { p: String(parts), t: String(total) },
        )}</div>`
      : "";
  const dropped =
    inMock != null && inMock < total
      ? `<div class="con-imgwarn">${ic("alert", 13)} ${T(
          lang,
          "{n} kép nem került a mockba — a fotó-kapu ejtette (méret vagy jogállás). A Fotók fülön látod, melyik.",
          { n: String(total - inMock) },
        )}</div>`
      : "";

  return `<span data-cit-images="${total}/${inMock ?? ""}">${head}</span>
    <details class="con-imgdet"><summary>${T(lang, "Honnan jön ez a szám?")}</summary>
      <ul>${rows.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
      ${mismatch}${dropped}
    </details>`;
}

/** Nap-pontos dátum a sávra (az óra-perc az elemleírásba megy). */
function dayOf(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}
function exactOf(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 16).replace("T", " ") : "";
}

/**
 * MUNKAMENET-SÁV — jóváhagyott terv ① (`assets/design-refs/console/lead-page/`,
 * tulajdonosi döntés 2026-09-14, „B" változat).
 *
 * ⛔ MIÉRT (Elek FK-003b): a lap első kérdése eddig egy 40 px-es MATCH-KONFIDENCIA szám
 * volt — érték nélkül egy alig látható szürke gondolatjel navy alapon (595 leadből 109-nek
 * nincs értéke), a magyarázata pedig egy MÁSIK fülön, a lap közepén. A kurátor kérdése nem
 * ez: az, hogy HOL TART ez a lead, és MI A KÖVETKEZŐ LÉPÉS.
 *
 * A sáv KÖT:
 * · minden állomás vagy DÁTUMOT mond, vagy azt, hogy „még nem” — néma gondolatjel sehol
 *   (a `–` eddig egyszerre jelentett „nem mértük”-et és „nulla”-t);
 * · a soron következő állomás MEGJELÖLI MAGÁT, hogy a kurátor ne keresse;
 * · ⭐ FUTÁS KÖZBEN a Mock állomás vált futás-állapotra, a JÓVÁHAGYVA állomás viszont A
 *   HELYÉN MARAD a saját dátumával (terv ⑦) — ezen múlik, hogy a megkeresés kiküldhető-e,
 *   és a tény nem tűnhet el csak azért, mert épp készül egy újabb mock.
 *
 * A `data-station` horgok GÉPIEK: a felirat fordítható, az állapot nem.
 */
function workflowBand(
  d: LeadDetail,
  latestMock: ArtifactView | undefined,
  approvedMock: ArtifactView | undefined,
  prospects: ProspectView[],
  orders: OrderIntentView[],
  payments: PaymentView[],
  gen: GenerateState,
  lang: string,
): string {
  const approvedAt = approvedMock?.decisions.find((x) => x.decision === "approve")?.decidedAt ?? null;
  const sent = prospects.map((p) => p.sentAt).filter(Boolean).sort()[0] ?? null;
  const ordered = orders.map((o) => o.submittedAt).filter(Boolean).sort()[0] ?? null;
  const paid = payments.map((p) => p.paidAt).filter(Boolean).sort()[0] ?? null;

  type Station = { key: string; label: string; at: string | null; running?: boolean };
  const stations: Station[] = [
    { key: "collected", label: T(lang, "Begyűjtve"), at: d.surveyedAt },
    { key: "mock", label: T(lang, "Mock"), at: latestMock?.generatedAt ?? null, running: gen.running },
    { key: "approved", label: T(lang, "Jóváhagyva"), at: approvedAt },
    { key: "sent", label: T(lang, "Kiküldve"), at: sent },
    { key: "ordered", label: T(lang, "Rendelés"), at: ordered },
    { key: "paid", label: T(lang, "Fizetve"), at: paid },
  ];
  // A SORON KÖVETKEZŐ = az első állomás, ami még nem történt meg. Ha minden megvan,
  // egyik sem jelöli magát „következő”-nek (nincs mit sürgetni).
  const nextIdx = stations.findIndex((st) => !st.at && !st.running);

  const cells = stations
    .map((st, i) => {
      if (st.running) {
        return (
          `<div class="con-wf__st run" data-station="${st.key}" data-state="running">` +
          `<div class="con-wf__k">${esc(st.label)}</div>` +
          `<div class="con-wf__v"><span class="dot"></span>${T(lang, "generálás fut")} ` +
          `<b class="con-run-t" data-cit-elapsed="${esc(gen.startedAt ?? "")}">0:00</b></div></div>`
        );
      }
      if (st.at) {
        return (
          `<div class="con-wf__st done" data-station="${st.key}" data-state="done">` +
          `<div class="con-wf__k">${esc(st.label)}</div>` +
          `<div class="con-wf__v" title="${esc(exactOf(st.at))}">${esc(dayOf(st.at))}</div></div>`
        );
      }
      const isNext = i === nextIdx;
      return (
        `<div class="con-wf__st ${isNext ? "now" : "todo"}" data-station="${st.key}" data-state="${isNext ? "next" : "todo"}">` +
        `<div class="con-wf__k">${esc(st.label)}</div>` +
        `<div class="con-wf__v">${T(lang, "még nem")}${isNext ? ` — <b>${T(lang, "ez a következő")}</b>` : ""}</div></div>`
      );
    })
    .join("");
  return `<div class="con-wf" data-cit-workflow="1">${cells}</div>`;
}

/**
 * ADAT-MEGBÍZHATÓSÁG — jóváhagyott terv ② (`assets/design-refs/console/lead-page/`).
 *
 * Egy SOR a sáv alatt, ami mindig KIMONDJA, MI KÖVETKEZIK BELŐLE — nem egy nagy szám a
 * fejlécben, amiről az operátornak kellene kitalálnia, mit kezdjen vele. A szabály
 * ugyanaz, mint a listán (ADR-0161 ⑥): a {@link MATCH_BASE_VALUE} a képlet ALAPÉRTÉKE,
 * nem mért egyezés.
 */
function trustLine(d: LeadDetail, lang: string): string {
  const v = d.matchConfidence;
  if (v == null) {
    return (
      `<p class="con-trust bad" data-cit-trust="none">${ic("alert", 15)}<span>` +
      `<b>${T(lang, "Adat-megbízhatóság: nem mért.")}</b> ` +
      T(
        lang,
        "A gyűjtés nem talált portál-profilt ehhez a szálláshoz, ezért nincs mihez hasonlítani a begyűjtött adatokat. Kiküldés előtt nézd át az Adatok fület.",
      ) +
      `</span></p>`
    );
  }
  const num = esc(decimalText(v, lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  if (isMatchBaseValue(v)) {
    return (
      `<p class="con-trust base" data-cit-trust="base">${ic("alert", 15)}<span>` +
      `<b>${T(lang, "Adat-megbízhatóság: {n} — a képlet ALAPÉRTÉKE.", { n: num })}</b> ` +
      T(lang, "Ez nem mért egyezés, hanem a kiinduló súly. Kiküldés előtt nézd át az Adatok fület.") +
      `</span></p>`
    );
  }
  return (
    `<p class="con-trust ok" data-cit-trust="measured">${ic("check", 15)}<span>` +
    `<b>${T(lang, "Adat-megbízhatóság: {n} — mért egyezés.", { n: num })}</b> ` +
    T(lang, "Ennyire biztos, hogy a megtalált portál-profil tényleg EHHEZ a szálláshoz tartozik.") +
    `</span></p>`
  );
}

export function leadPage(
  d: LeadDetail,
  gen: GenerateState = { running: false },
  conversion: ConversionView | null = null,
  orders: OrderIntentView[] = [],
  payments: PaymentView[] = [],
  prospects: ProspectView[] = [],
  flash: LeadFlash | null = null,
  /** Module-sales switch: ids not sellable now — the ALL-IN preview must match
   *  what convertLead would actually provision (single source, see server). */
  disabledSales: ReadonlySet<string> = new Set(),
  /** Artifact ids whose text is being rewritten right now (server.recopying) —
   *  the copy panel shows a live "készül…" state instead of looking idle. */
  recopying: ReadonlySet<string> = new Set(),
  /** Outcome of the last FINISHED rewrite of the newest artifact: success, or the
   *  reason it failed. A fire-and-forget job has no other way to reach the user. */
  recopyResult: { ok: boolean; message: string } | null = null,
  /** ADR-0131: a kép-kapu KIÍRT állapota — mit tagadott meg a szerver, és miért. */
  photoGate: PhotoGateView | null = null,
  /**
   * mock-cards kontraktus ③: artefaktumonként a NYITÓOLDAL-PILLANATKÉP állapota.
   *
   * ⛔ Azért PARAMÉTER és nem itt mért érték: a nézet szinkron, a mérés pedig I/O.
   * A lényeg viszont nem a függvény alakja, hanem hogy a kártya csak akkor emit
   * `<img>`-et, ha ELŐBB megkérdeztük, megvan-e a kép — különben a hiányzó kép
   * néma törött-kép ikonná válik (Elek FK-004 H1). Hiányzó bejegyzés = „még nem
   * kérte senki", nem „nincs".
   */
  shots: ReadonlyMap<string, HeroShotState> = new Map(),
): string {
  const lang = consoleLang();
  const prov = d.provenance.length
    ? `<div class="tblwrap"><table><thead><tr><th>${T(lang, "Mező")}</th><th>${T(lang, "Érték")}</th><th>${T(lang, "Forrás")}</th><th>Konf.</th></tr></thead>
       <tbody>${d.provenance
         .map(
           (p) => `<tr><td>${esc(provFieldLabel(p.field, lang))}</td><td class="small">${esc(p.value)}</td>
           <td class="small mut">${esc(sourceLabel(p.source))}</td><td>${confCell(p.confidence)}</td></tr>`,
         )
         .join("")}</tbody></table></div>`
    : `<p class="mut small">Nincs provenance-rekord.</p>`;

  // Conversion modules come from the OWNER's configurator choice (order intent),
  // not an operator pick; ALL-IN when they haven't configured yet. Same resolution
  // as the server-side convert handler (single source: modulesForConversion).
  const convertModules = modulesForConversion(orders, disabledSales);
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
          // ⛔ `regionId` is the RAW scrape-area key, and its human twin is already on
          // this very line: measured on the dev corpus, 2 of 3 artifacts render
          // "… · region=Balaton · regionId=balaton-north · …" — the same
          // `balaton-north` the lead page above was just taught not to print, three
          // rows lower, asserting a north shore for a Balatonlelle lead. Printing both
          // adds no information for the operator and re-opens the class ADR-0143 closed.
          // It STAYS in the stored `inputs` (the machine needs it: `persist.ts` resolves
          // the area by this key, and `rerender-mock.mts` re-renders from this object) —
          // it is simply not a label, so it is not shown as one (ADR-0126).
          const META_HIDDEN_KEYS = new Set(["regionId"]);
          // ⛔ GÉPI SZÖVEG AZ OPERÁTOR SZEME ELŐTT (jóváhagyott terv ⑧). Eddig nyers
          // `kulcs=érték` felsorolás állt a kártyán — ÜRES mezőkkel is (`heroScore=`,
          // `heroSubject=`), amik semmit nem mondanak, csak zajt adnak. Most: megnevezett
          // sorok, az ÜRES mező pedig meg sem jelenik; a nyers alak kinyitva marad elérhető
          // (a fejlesztőnek kell, az operátornak nem).
          const scalars = Object.entries(a.inputs)
            .filter(([, v]) => v === null || typeof v !== "object")
            .filter(([k]) => !META_HIDDEN_KEYS.has(k))
            .filter(([, v]) => v !== null && v !== "" && v !== undefined);
          const rawMeta = scalars.map(([k, v]) => `${esc(k)}=${esc(v)}`).join(" · ");
          // mock-cards ④: ami a CSUKOTT kártyán már ott áll, az a kinyitott recept-rácsból
          // kimarad — különben ugyanaz az adat kétszer szerepel egy kártyán. A NYERS blokk
          // viszont teljes marad: az a fejlesztőé, és ott a hiánytalanság a hasznos.
          const FRONT_KEYS = new Set([
            "template", "photos", "heroScore", "heroSubject",
            "factVerdict", "marketVerdict", "designVerdict", "heroVerdict",
          ]);
          const namedMeta = scalars
            .filter(([k]) => !FRONT_KEYS.has(k))
            .map(([k, v]) => `<div><dt>${esc(mockInputLabel(k, lang))}</dt><dd>${esc(mockInputValue(k, v, lang))}</dd></div>`)
            .join("");
          // mock-cards ④: a négy kapu egyetlen jelvény-sorban. ⛔ Ha a verdikt NEM
          // „átment", a szó ki is van írva — egy piros pötty önmagában nem mondja meg,
          // hogy megjelölve vagy elbukott, és pont ott számít a különbség.
          const gateChips = (["factVerdict", "marketVerdict", "designVerdict", "heroVerdict"] as const)
            .filter((k) => typeof a.inputs[k] === "string")
            .map((k) => {
              const word = mockInputValue(k, a.inputs[k], lang);
              const pass = a.inputs[k] === "pass";
              return `<span class="con-mk__gate" data-verdict="${esc(String(a.inputs[k]))}" title="${esc(
                `${mockInputLabel(k, lang)}: ${word}`,
              )}">${esc(gateShortLabel(k, lang))}${pass ? ` ${ic("check", 11)}` : `: ${esc(word)}`}</span>`;
            })
            .join("");
          // photos=0 used to pass in silence — a mock built on ZERO usable photos
          // (the gate dropped them all) is exactly the missing-data branch that
          // must fail LOUDLY on the surface, not in a meta field (Elek GY2).
          const noPhotos =
            a.inputs.photos === 0
              ? `<div class="small" style="margin-top:8px">${ic("alert", 14)} ${T(
                  lang,
                  "Ez a mock használható fotó NÉLKÜL készült — a fotó-kapu minden képet ejtett (méret/jogállás). Kiküldés előtt gyűjts friss adatot, és generálj újat.",
                )}</div>`
              : "";
          // WHICH template produced this mock, in the header — it used to hide in the
          // small "template=…" meta line, so a multi-select run looked like it had
          // ignored the pick (owner: "kiválasztom X-et, ugyanazt gyártja le").
          const tplId = typeof a.inputs.template === "string" ? a.inputs.template : "";
          const tplName = tplId
            ? ((TEMPLATES[tplId]?.label.split(/[—:(]/)[0] ?? tplId).trim() || tplId)
            : "";
          const photos = typeof a.inputs.photos === "number" ? a.inputs.photos : null;
          const heroScore = typeof a.inputs.heroScore === "number" ? a.inputs.heroScore : null;
          const heroSubject =
            typeof a.inputs.heroSubject === "string" ? heroSubjectLabel(a.inputs.heroSubject, lang) : "";
          const links = a.path
            ? `<span class="con-mk__links">
                 <a href="/mock/${esc(a.id)}" target="_blank">${T(lang, "előnézet ▸")}</a>
                 <a href="/configure/${esc(a.id)}" target="_blank">${T(lang, "prospect-konfigurátor ▸")}</a>
               </span>`
            : "";
          // ⛔ AZ AKTÍV KÉP-KAPU TELJES SORT KAP. A megtagadás doboza megnevezi a hibás
          // képeket ÉS indoklást kér — mérve, egy harmad-szélességű kártyában 1280 px-en is
          // egymás alá esett a mező és a gomb (a `mock-photo-gate-check` fogta meg, helyesen).
          // Nem stílus-részlet: a kártya, ami DÖNTÉST kér, kapja a legtöbb helyet.
          const gateOpen = !!photoGate && photoGate.artifactId === a.id;
          return `<article class="con-mk" id="a-${esc(a.id)}" data-mk-state="${esc(a.status)}"${
            gateOpen ? ' data-mk-gate="1"' : ""
          }>
            ${mockShotBox(a.id, shots.get(a.id) ?? { kind: "none" }, a.status, lang, links)}
            <div class="con-mk__hd">
              ${tplName ? `<b title="${esc(tplId)}">${esc(tplName)}</b>` : ""}
              <span class="con-mk__sub">${
                patternSummary(a.inputs as PatternInputs)
                  ? `${esc(patternSummary(a.inputs as PatternInputs))} · `
                  : ""
              }${esc(a.generatedAt.slice(0, 16).replace("T", " "))}</span>
            </div>
            <dl class="con-mk__facts">
              ${
                photos !== null
                  ? `<div><dt>${esc(mockInputLabel("photos", lang))}</dt><dd>${photos}</dd></div>`
                  : ""
              }
              ${
                heroScore !== null
                  ? `<div><dt>${esc(mockInputLabel("heroScore", lang))}</dt><dd>${heroScore}${
                      heroSubject ? `<span class="con-mk__u">${esc(heroSubject)}</span>` : ""
                    }</dd></div>`
                  : ""
              }
              ${
                gateChips
                  ? `<div class="con-mk__wide"><dt>${T(lang, "Kapuk")}</dt><dd>${gateChips}</dd></div>`
                  : ""
              }
            </dl>
            ${noPhotos}
            ${gateOpen ? photoGateBox(photoGate!, a.id) : ""}
            <div class="con-mk__act">
              ${
                curated
                  ? dec
                    ? // ⛔ A DÖNTÉS SZAVA MAGYARUL (lead-page terv ⑧): eddig a nyers `reject`
                      // enum állt itt. A jegyzetben a `superseded_by:<uuid>` helyett a
                      // felülíró mock MEGNEVEZÉSE áll — egy uuid nem mond semmit a kurátornak.
                      `<span class="con-decision">${T(lang, "Döntés:")} <b>${esc(decisionLabel(dec.decision, lang))}</b>
                       ${dec.notes ? `— ${esc(decisionNote(dec.notes, d.artifacts, lang))}` : ""}
                       <span class="mut">(${esc(dec.decidedBy)}, ${esc(exactOf(dec.decidedAt))})</span></span>`
                    : ""
                  : `<span class="con-mk__decide" data-photo-gate-row="${esc(a.id)}">
                       <form method="post" action="/artifact/${esc(a.id)}/curate">
                         <input type="hidden" name="decision" value="approve">
                         <button class="ok" type="submit">${T(lang, "Jóváhagyás")}</button></form>
                       <form method="post" action="/artifact/${esc(a.id)}/curate">
                         <input type="hidden" name="decision" value="reject">
                         <button class="bad" type="submit">${T(lang, "Elutasítás")}</button></form>
                       <span class="pg-pre" data-photo-gate-pre="${esc(a.id)}" hidden></span>
                     </span>`
              }
              <button type="button" class="con-mk__more" data-mk-more="${esc(a.id)}"
                      aria-expanded="false" aria-controls="det-${esc(a.id)}">${T(lang, "Részletek ▾")}</button>
            </div>
            ${curated ? "" : `<script>${photoGatePreScript(d.id, a.id)}</script>`}
            <div class="con-mk__det" id="det-${esc(a.id)}" hidden>
              ${namedMeta ? `<dl class="con-recipe">${namedMeta}</dl>` : ""}
              ${renderAiCost(a.inputs.aiUsage)}
              ${
                rawMeta
                  ? `<details class="con-rawmeta"><summary>${T(lang, "Fejlesztői adatok (nyers)")}</summary><pre>${esc(rawMeta)}</pre></details>`
                  : ""
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
                  ? // ⛔⛔ MÉRVE 2026-09-14: ez a szöveg `jsStr()` NÉLKÜL ment az egyszeres
                    // idézőjelbe. A magyar forrásban nincs aposztróf — A FORDÍTÁSBAN VAN:
                    // `en` „It hasn't been sent yet" · `it` „l'operazione". Mindkét nyelven a
                    // kezelő SyntaxError lett, tehát a `confirm()` SOHA nem futott le, és a
                    // jóváhagyott mock törlése MEGERŐSÍTÉS NÉLKÜL ment a szerverre (valódi
                    // böngészőben mérve: dialógus=0, JS-hiba=1, `defaultPrevented`=false).
                    // Pontosan az a hibaosztály, amiről a `jsStr()` docstringje és a
                    // `bookingViews.ts` kommentje is szól. Őr: scripts/dialog-fires-check.mts.
                    `<form method="post" action="/artifact/${esc(a.id)}/delete" style="margin-top:10px"
                           onsubmit="return confirm('${esc(
                             jsStr(
                               removesPreview
                                 ? T(lang, "Biztosan törlöd ezt a jóváhagyott mockot? Még nem küldtük ki. A privát ELŐNÉZET is megszűnik (oldal + hozzáférés). A művelet nem vonható vissza.")
                                 : T(lang, "Biztosan törlöd ezt a jóváhagyott mockot? Még nem küldtük ki, a művelet nem vonható vissza."),
                             ),
                           )}')">
                       <button class="bad small" type="submit">${T(lang, "Mock törlése")}</button>
                       <span class="mut small" style="margin-left:8px">${
                         removesPreview
                           ? T(lang, "a privát előnézet is törlődik")
                           : T(lang, "csak ki nem küldött mock törölhető")
                       }</span>
                     </form>`
                  : ""
              }
            </div>
          </article>`;
  };

  // mock-cards ⑥: az elutasított mock a RÁCSBAN marad (halványan, hátul), nem külön
  // kinyitható csoportban. ⛔ Három 403 px-es kártyánál egy külön blokk több helyet vinne,
  // mint amennyit spórol — a korábbi `<details>` a teljes szélességű paneleknek szólt.
  const rejected = d.artifacts.filter((a) => a.status === "rejected");
  const active = d.artifacts.filter((a) => a.status !== "rejected");
  // ⚠️ ITT születnek, nem lentebb: az összehasonlító tábla (terv ④) és a munkamenet-sáv
  // (terv ①) is olvassa őket. A deklaráció korábban a fejléc-blokknál állt, és a tábla
  // ELŐTTE hivatkozott rá — a fordító ezt átengedte, a lap viszont futásidőben elszállt
  // („Cannot access 'latestMock' before initialization"). A KÉPERNYŐKÉP fogta meg, nem a tsc.
  const latestMock = active[0] ?? d.artifacts[0];
  /** A leadhez tartozó JÓVÁHAGYOTT mock (0064 óta legfeljebb egy) — ez dönti el, hogy a
   *  megkeresés kimehet-e, ezért a sáv akkor is kimondja, ha nem ez a legutóbbi. */
  const approvedMock = d.artifacts.find((a) => a.status === "approved");
  /**
   * ÖSSZEHASONLÍTÓ MOCK-TÁBLA — jóváhagyott terv ④
   * (`assets/design-refs/console/lead-page/`, tulajdonosi döntés 2026-09-14).
   *
   * ⛔ MIÉRT (Elek FK-003b): öt artefaktum-kártya viselhette UGYANAZT a címet, ha azonos
   * sablon/skin készítette — a kártyák nem mondták meg, miben KÜLÖNBÖZNEK, pedig a
   * kurátor pont azt választja. A táblában ami közös, az egy oszlopban ismétlődik; ami
   * különbözik (készült · sablon/arculat · képszám · nyitókép · állapot), az egymás alatt
   * áll és összevethető. „Öt egyforma sor" így SZERKEZETILEG lehetetlen.
   *
   * ⚠️ A táblázat a DÖNTÉST szolgálja, nem váltja ki a műveleteket: a jóváhagyás /
   * elutasítás / konvertálás / törlés a kártyákon marad, változatlan űrlapokkal — egy
   * táblába tömörítve a megerősítő párbeszédek és a fotó-kapu doboza elveszne.
   */
  const compareRows = d.artifacts
    .map((a) => {
      const tpl = typeof a.inputs.template === "string" ? a.inputs.template : "";
      const tplName = tpl ? (TEMPLATES[tpl]?.label.split(/[—:(]/)[0] ?? tpl).trim() : "—";
      const skin = typeof a.inputs.skin === "string" ? a.inputs.skin.replace(/-/g, " ") : "";
      const photos = typeof a.inputs.photos === "number" ? String(a.inputs.photos) : "—";
      const subject = typeof a.inputs.heroSubject === "string" ? a.inputs.heroSubject : "";
      const score = typeof a.inputs.heroScore === "number" ? a.inputs.heroScore : null;
      const dec = a.decisions[0];
      return `<tr${a.id === latestMock?.id ? ' class="cur"' : ""}>
        <td data-l="${T(lang, "Készült")}"><a href="#a-${esc(a.id)}">${esc(dayOf(a.generatedAt))}</a>
          <span class="why">${esc(exactOf(a.generatedAt).slice(11))}</span></td>
        <td data-l="${T(lang, "Sablon / arculat")}">${esc(tplName)}${skin ? `<span class="why">${esc(skin)}</span>` : ""}</td>
        <td data-l="${T(lang, "Kép")}" class="num">${esc(photos)}</td>
        <td data-l="${T(lang, "Nyitókép")}">${
          // ⛔ Raw enum leaked to the operator: this cell printed `pool_garden` while
          // the card three rows below already said „kert / terasz" — the dictionary
          // (heroSubjectLabel) existed, this table just did not use it. Caught by
          // outreach-row-truth-check Z5 on the live corpus (2026-09-16).
          subject ? esc(heroSubjectLabel(subject, lang)) : `<span class="mut">—</span>`
        }${
          score != null ? `<span class="why">${T(lang, "{n} pont", { n: String(score) })}</span>` : ""
        }</td>
        <td data-l="${T(lang, "Állapot")}"><span class="pill ${esc(a.status)}">${esc(mockStatusLabel(a.status, lang))}</span>${
          a.id === latestMock?.id ? `<span class="why">${T(lang, "ez a legfrissebb")}</span>` : ""
        }</td>
        <td data-l="${T(lang, "Döntés")}">${
          dec
            ? `${esc(dec.notes ? decisionNote(dec.notes, d.artifacts, lang) : decisionLabel(dec.decision, lang))}
               <span class="why">${esc(dec.decidedBy ?? "")} · ${esc(exactOf(dec.decidedAt))}</span>`
            : `<span class="mut">${T(lang, "még nincs döntés")}</span>`
        }</td>
      </tr>`;
    })
    .join("");
  const compareTable = d.artifacts.length > 1
    ? `<div class="panel" data-cit-mockcompare="1">
         <h2>${T(lang, "Mock-artefaktumok — mi a különbség köztük?")}</h2>
         <div class="tblwrap"><table class="con-arttbl">
           <thead><tr>
             <th>${T(lang, "Készült")}</th><th>${T(lang, "Sablon / arculat")}</th>
             <th class="num">${T(lang, "Kép")}</th><th>${T(lang, "Nyitókép")}</th>
             <th>${T(lang, "Állapot")}</th><th>${T(lang, "Döntés")}</th>
           </tr></thead>
           <tbody>${compareRows}</tbody>
         </table></div>
         <p class="small mut" style="margin:10px 0 0">${T(
           lang,
           "A sorok a KÜLÖNBSÉGET mutatják (készült · sablon · képszám · nyitókép) — azonos sablonból készült mockok így sem olvadnak össze. A dátumra koppintva a mock saját kártyájához ugrasz, ahol a műveletek vannak.",
         )}</p>
       </div>`
    : "";
  /**
   * A KÁRTYA-RÁCS — jóváhagyott terv (`assets/design-refs/console/mock-cards/`, 2026-09-20).
   *
   * ⑤ Egy sorban annyi kártya, amennyi fér (asztalin három, 390 px-en egy); ⑥ az elutasított
   * kártyák halványan, a sor végén. A rendezés az `active` (dátum szerint csökkenő) után
   * fűzi az elutasítottakat — így a kurátor elé az kerül, amiről dönteni kell.
   *
   * A kinyitó-szkript EGY példányban ül a rács mellett (nem kártyánként): eseményt a
   * dokumentumon fog, így az egyszerre tíz kártyás lead sem kap tíz kezelőt.
   */
  const mockGridScript = `(function(){
    document.addEventListener('click',function(e){
      var b=e.target.closest('[data-mk-more]'); if(!b) return;
      var card=b.closest('.con-mk'); if(!card) return;
      var det=card.querySelector('.con-mk__det'); if(!det) return;
      var open=card.getAttribute('data-mk-open')==='1';
      card.setAttribute('data-mk-open',open?'0':'1');
      det.hidden=open;
      b.setAttribute('aria-expanded',String(!open));
      b.textContent=open?'${jsStr(T(lang, "Részletek ▾"))}':'${jsStr(T(lang, "Bezárom ▴"))}';
    });
  })();`;
  const artifacts = d.artifacts.length
    ? `${compareTable}
       <div class="con-mkgrid" data-cit-mockcards="1">${[...active, ...rejected]
         .map(renderArtifact)
         .join("")}</div>
       <script>${mockGridScript}</script>`
    : `<div class="panel"><p class="mut">${T(lang, "Még nincs generált mock ehhez a leadhez.")}</p></div>`;

  // IDENTITY BAND — everything the operator must know BEFORE choosing a tab: who is this,
  // where does the lead stand (a munkamenet-sáv), mennyire megbízható az adat, milyen
  // állapotban a mock/megkeresés, és a sima elérhetőségi tények.
  // A mock TÉNYLEGES nyitóképe (a pillanatkép első fotója) — a Fotók fül ezt jelöli meg,
  // nem az élő lista első elemét (lásd leadPhotosPanel).
  const latestMockHeroUrl = ((latestMock?.inputs ?? {}) as { siteData?: { photos?: { url?: string }[] } })
    .siteData?.photos?.[0]?.url;
  const sentCount = prospects.filter((p) => p.sentAt).length;
  const head = (d.raw ?? {}) as {
    country?: string;
    city?: string;
    website?: string;
    phone?: string;
    email?: string;
  };
  /**
   * The identity line under the name: WHERE the place is, then WHICH scrape area brought
   * it in — and the second one NAMES ITSELF.
   *
   * ⛔ It used to be `[head.city, d.region].join(" · ")`, i.e. two unlabelled values with
   * a separator between them, which reads as a geographic hierarchy: "Balatonlelle ·
   * balaton-north" states that a SOUTH-shore town is on the north shore. The area is not
   * geography (ADR-0143 ②) — 529 of 595 leads share one area name — so it may not sit in
   * the line that answers "where is this place" without saying what it is. The word comes
   * from `columnLabel("region")`, so the header and the list column cannot be renamed apart.
   *
   * ⚠️ HTML, not `esc()`-ed as a whole: the unclassified state carries its own tooltip
   * (the scrape key, as diagnostics). Each part is escaped where it is built.
   */
  const subtitleHtml = [
    head.city ? esc(head.city) : "",
    `<span data-cit-area="${d.regionKnown ? "1" : "0"}" title="${esc(columnMeaning("region", lang))}">${esc(columnLabel("region", lang))}: ${areaValueHtml(d, lang)}</span>`,
  ]
    .filter(Boolean)
    .join(" · ");
  /**
   * ÉLŐ SÁV A FEJLÉC ALATT — jóváhagyott „A" változat (2026-09-11, tulaj):
   * `assets/design-refs/console/gen-running/`.
   *
   * A hely a lényeg: a futás-jelzés eddig a 3014 px-es lap alsó ötödében ült, ahol a
   * kurátor nem néz. Ugyanez a sáv viszi a bukást is — egy helyen mondja el, hogy
   * ELINDULT, hogy MENNYI IDEJE fut, és hogy MIÉRT állt le.
   *
   * ⛔⛔ A HALADÓ CSÍK KIVEZETVE (FK-003b L03, mérve 2026-09-13, jóváhagyott „A" terv).
   * A régi `.con-runbar__track/__fill` fix **34%**-os kitöltést animált végtelenítve —
   * SEMMILYEN adathoz nem kötve. Mérve: a csík mindkét felvételen teljesen üres,
   * egyenletes szürke volt, és a 0:00→0:01 teljes pixeldiff KIZÁRÓLAG az eltelt-idő
   * szövegére szorítkozott. Vagyis egy „haladást" mutató elem, ami sosem haladt.
   * Helyette VALÓS jel áll ott: a motor által jelentett szakasz neve (`onStage`), több
   * sablonnál pedig az elkészültek száma. ⚠️ Százalékot szándékosan NEM írunk: a
   * szakaszok hossza erősen egyenetlen (az AI-hívás a futásidő zöme), tehát egy arányos
   * csík a hátralévő időről hazudna — az eltelt idő önmagában őszintébb.
   */
  const multi = (gen.total ?? 0) > 1;
  const progress = multi
    ? T(lang, "{done}/{total} mock kész", { done: String(gen.done ?? 0), total: String(gen.total ?? 0) })
    : gen.stage
      ? `${stageLabel(gen.stage, lang)}…`
      : "";
  /**
   * ⭐ A LEZÁRÓ SOR (FK-003b L06). Eddig a futás VÉGÉT semmi nem mondta ki: a sáv
   * egyszerűen eltűnt — se „kész", se időtartam, se link az eredményhez. A háttérmunka
   * NEGYEDIK tartozása ez. A sor MEGMARAD (az outcome TTL-jéig), tehát a kurátor akkor
   * is megtudja, hogy kész, ha közben máshol járt.
   */
  const runBand = gen.running
    ? `<div class="con-runbar">
         <span class="con-run-pill"><span class="dot"></span><b>${T(lang, "Mock generálása fut")}</b></span>
         <span class="con-run-t" data-cit-elapsed="${gen.startedAt ?? ""}">0:00</span>
         ${progress ? `<span class="con-run-stage">${esc(progress)}</span>` : ""}
         <span class="con-runbar__mut">${T(lang, "~1-2 perc — a lap magától frissül")}</span>
       </div>`
    : gen.outcome && !gen.outcome.ok
      ? `<div class="con-runbar bad">${ic("alert", 15)}<span>${esc(gen.outcome.message)}</span>${
          gen.outcome.durationMs
            ? `<span class="con-runbar__mut">${T(lang, "{d} után", { d: mmss(gen.outcome.durationMs) })}</span>`
            : ""
        }</div>`
      : gen.outcome && gen.outcome.ok
        ? `<div class="con-runbar done" data-gen-done>${ic("check", 16)}<b>${esc(gen.outcome.message)}</b>${
            gen.outcome.durationMs
              ? `<span class="con-done__dur">${T(lang, "{d} alatt", { d: mmss(gen.outcome.durationMs) })}</span>`
              : ""
          }${
            gen.outcome.artifactId
              ? `<a href="/mock/${esc(gen.outcome.artifactId)}" target="_blank" rel="noopener">${T(lang, "Megnézem a mockot")}</a>`
              : `<a href="#mockok">${T(lang, "A lead mockjai")}</a>`
          }<button type="button" class="con-done__x" data-gen-dismiss aria-label="${T(lang, "Elrejtem")}">×</button></div>`
        : "";
  const heroPanel = `
    <div class="con-lhead">
      <div class="con-lhead__band">
        <div class="con-lhead__mark" aria-hidden="true">${esc(initials(d.name))}</div>
        <div class="con-lhead__id">
          <h1>${esc(d.name)}</h1>
          ${subtitleHtml ? `<div class="con-lhead__sub">${subtitleHtml}</div>` : ""}
        </div>
      </div>
      ${runBand}
      ${workflowBand(d, latestMock, approvedMock, prospects, orders, payments, gen, lang)}
      ${trustLine(d, lang)}
      <!-- ⛔ GÉPI TÉNY-HORGONY: VAN-E jóváhagyott mock. A látható felirat az ÁLLAPOTOT
           mondja (mock: generated/approved), és csak eltéréskor teszi hozzá külön
           jelöléssel, hogy van jóváhagyott — egy szövegre mérő forgatókönyv ezért hol
           ezt, hol azt találná. A TÉNY viszont mindig ugyanitt áll, 1/0-val: erre lehet
           mérni park-zajtól függetlenül (Elek FK-004, 2026-09-12). -->
      <div class="con-lhead__pills" data-cit-approved="${approvedMock ? "1" : "0"}">
        ${d.lifecycle === "disqualified" ? disqualifiedBadge() : qualBadge(d.qualification)}
        ${
          // ⛔ A futó újragenerálás alatt a pirula NEM mondhat „approved"-ot: az a mock
          // épp készül, és a fejléc egy két perce meghaladott állapotot állítana (§B.17).
          //
          // A `data-cit-mockstate` GÉPI horog: a felirat fordítható és átfogalmazható, az
          // ÁLLAPOT nem. Az Elek-forgatókönyv ezen méri, hogy futás közben tényleg nincs
          // „approved" a fejlécben — szövegre mérve az állítás az első átfogalmazásnál
          // elcsúszna, és a zöld semmit nem bizonyítana.
          gen.running
            ? `<span class="pill generated con-run-pill" data-cit-mockstate="running"><span class="dot"></span>${T(lang, "mock: generálás fut")}
                 <b class="con-run-t" data-cit-elapsed="${gen.startedAt ?? ""}">0:00</b></span>`
            : latestMock
              ? // ⛔ A SZÓ a közös regiszterből (`mockStatusLabel`), nem a nyers enumból:
                // a lista „jóváhagyva"-t ír, a fejléc nem mondhat „approved"-ot ugyanarról
                // az állapotról (tulajdonosi döntés, 2026-09-14). A GÉPI horog
                // (`data-cit-mockstate`) változatlanul a nyers érték — arra mérnek a
                // forgatókönyvek, és azt egy átfogalmazás nem mozdítja.
                `<span class="pill ${esc(latestMock.status)}" data-cit-mockstate="${esc(latestMock.status)}">mock: ${esc(mockStatusLabel(latestMock.status, lang))}</span>`
              : `<span class="pill" data-cit-mockstate="none">${T(lang, "nincs mock")}</span>`
        }
        ${
          // ⛔ A JELÖLÉS A LEGUTÓBBI mock állapotát mondja — az operátor kérdése viszont az,
          // hogy VAN-E JÓVÁHAGYOTT mock (a megkeresés ugyanis AZ alapján mehet ki). A kettő
          // szétválik, amint egy újabb generálás születik a jóváhagyott mellé: 2026-09-12-én
          // az Elek FK-004 emiatt bukott el, miközben a leadnek VOLT jóváhagyott mockja és a
          // levél kiküldhető lett volna. Ezért a sáv MINDKETTŐT kimondja.
          // ⚠️ A felirat szándékosan NEM tartalmazza a „mock: approved" alakot: arra a
          // generálás-közbeni forgatókönyv NEM-látható állítást mér.
          approvedMock && latestMock && latestMock.status !== "approved"
            ? `<span class="pill approved" data-cit-approved-shown="1">${T(lang, "van jóváhagyott mock")}</span>`
            : ""
        }
        ${
          // ⛔ THE HEADER MUST COUNT WHAT HAPPENED (Elek FK-004 ②). It used to go green
          // and say "· kiküldve" as soon as ONE prospect row carried a sent stamp, so a
          // lead with 2 rows and 1 sent mail read as "2 megkeresés · kiküldve" — the
          // screen claimed twice the outreach that actually left the building (§B.17).
          // A partial state is now named with its numbers and stays NEUTRAL: green is
          // reserved for "every one of them went out".
          // ⛔ ÉS MONDJA MEG, MIT SZÁMOL (Elek FK-004 Z3). A „4 megkeresés · ebből 1 ment
          // ki" két ki nem mondott dolgot rejtett: hogy a 4 nem négy megkeresés, hanem
          // négy KÖVETETT LINK ugyanahhoz a leadhez (a hideg levél cím-szintű egy-lövés,
          // ADR-0122), és hogy a „ment ki" BÁRMELY csatornát jelenti, nem az e-mailt.
          prospects.length
            ? `<span class="pill${sentCount === prospects.length ? " approved" : ""}">${
                sentCount === 0
                  ? T(lang, "{n} követett link · még egyik sem ment ki", { n: prospects.length })
                  : sentCount === prospects.length
                    ? T(lang, "{n} követett link · mind kiküldve (valamelyik csatornán)", { n: prospects.length })
                    : T(lang, "{n} követett link · ebből {s} ment ki (bármely csatornán)", { n: prospects.length, s: sentCount })
              }</span>`
            : `<span class="pill">${T(lang, "nincs megkeresés")}</span>`
        }
        ${helpLink("console.lead")}
      </div>
      <dl class="con-lead-facts">
        <div><dt>${T(lang, "Ország")}</dt><dd>${normalizeCountry(head.country) ? esc(normalizeCountry(head.country)!) : `<span class="mut">–</span>`}</dd></div>
        <div><dt>${T(lang, "Város")}</dt><dd>${head.city ? esc(head.city) : `<span class="mut">–</span>`}</dd></div>
        ${
          // ⛔ NOT "Régió", and NOT the raw key — the label, the meaning and the
          // unclassified state all come from the SAME source as the list column
          // (`columnLabel`/`columnMeaning`/`areaValueHtml`), so the two screens cannot
          // disagree about what this value is. Under "Régió" the operator read it as the
          // lead's own geography: a Balatonlelle lead (SOUTH shore) had "balaton-north"
          // on its page — the exact claim ADR-0143 ① retired at the source, which never
          // reached here because the page never looked at `region.label` (Elek FK-003b L15).
          // `data-fact="region"` + `data-area-known` are MACHINE anchors (like the list's
          // `data-col`): the guard must not have to match on the Hungarian label, or a
          // rename would silently take the assertion with it.
          `<div data-fact="region" data-area-known="${d.regionKnown ? "1" : "0"}"><dt title="${esc(columnMeaning("region", lang))}">${esc(columnLabel("region", lang))}</dt><dd>${areaValueHtml(d, lang)}</dd></div>`
        }
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

/**
 * NYITÓKÉP-VÁLASZTÓ SÁV — jóváhagyott terv "A" változata
 * (assets/design-refs/console/hero-override/README.md).
 *
 * A motor ítélete javaslat; a döntés az emberé. A sáv ott ül, ahol a kurátor a mockot
 * bírálja: nagy aktuális nyitókép + a többi kép alkalmasság szerint, mindegyiken a
 * PONTSZÁM — mert a puszta sorrend nem mondja meg, MIÉRT az lett a nyitókép.
 */
function heroPickStrip(
  a: ArtifactView,
  ctx: { leadId: string; scores: LeadDetail["heroScores"]; pin: LeadDetail["heroPin"] },
  lang: string,
): string {
  const inputs = a.inputs as { siteData?: { photos?: { url?: string }[] } };
  const photos = (inputs.siteData?.photos ?? []).map((p) => p.url ?? "").filter(Boolean).slice(0, 16);
  if (photos.length < 2) return "";
  const key = (u: string): string => {
    const q = u.indexOf("?");
    return (q === -1 ? u : u.slice(0, q)).toLowerCase();
  };
  const sc = (u: string): { subject: string; score: number; reason: string } | undefined => ctx.scores[key(u)];
  const heroUrl = photos[0]!;
  const heroSc = sc(heroUrl);
  const pinned = Boolean(ctx.pin && key(ctx.pin.url) === key(heroUrl));
  // Alkalmasság szerint, de az EREDETI sorrend a holtverseny-döntő — ugyanaz a szabály,
  // mint a motorban (heroPick.orderPhotosForHero), hogy a panel ne más világot mutasson.
  const rest = photos
    .slice(1)
    .map((u, i) => ({ u, i, s: sc(u)?.score ?? 50 }))
    .sort((x, y) => y.s - x.s || x.i - y.i);

  const thumb = (u: string): string => {
    const v = sc(u);
    const low = v ? v.score < 55 : false;
    // ⛔ Amit a renderelő ELDOB (ADR-0116: más cég reklámbannere), azt a választó sem
    // kínálhatja fel. A bélyeg LÁTSZIK — a néma eltüntetés „nem is volt ott"-nak
    // olvasódna —, de a gombja tiltott, és a csempe kimondja, miért. Eddig a kattintás
    // egy hazug hibába futott: „ez a kép nincs benne ebben a mockban".
    if (isNeverShownSubject(v?.subject)) {
      return `<span class="hp-alt is-excluded" data-key="${esc(key(u))}"
          title="${esc(v ? `${v.subject} · ${v.reason}` : "")}">
          <img src="${esc(proxiedPhotoUrl(u))}" alt="" loading="lazy">
          <span class="hp-sc low">${v ? v.score : "?"}</span>
          <span class="hp-subj">${T(lang, "kizárva: {subject} — nem kerül a lapra", {
            subject: esc(heroSubjectLabel(v!.subject, lang)),
          })}</span>
          <span class="hp-dead" hidden></span>
        </span>`;
    }
    return `<button type="submit" name="url" value="${esc(u)}" class="hp-alt" data-key="${esc(key(u))}"
        data-score="${v ? v.score : ""}" data-subject="${esc(v?.subject ?? "")}" data-reason="${esc(v?.reason ?? "")}"
        title="${esc(v ? `${v.subject} · ${v.score}/100 — ${v.reason}` : T(lang, "Erről a képről nincs ítéletünk."))}">
        <img src="${esc(proxiedPhotoUrl(u))}" alt="" loading="lazy">
        <span class="hp-sc${low ? " low" : ""}">${v ? v.score : "?"}</span>
        <span class="hp-subj">${esc(v ? heroSubjectLabel(v.subject, lang) : T(lang, "nem ítélt"))}</span>
        <span class="hp-dead" hidden></span>
      </button>`;
  };

  return `<div class="hp-wrap">
      ${
        pinned
          ? `<div class="hp-note">
               <span>${T(lang, "Kézi nyitókép — {who} választotta. A mock már ezzel van renderelve.", { who: esc(ctx.pin?.actor ?? "") })}</span>
               <form method="post" action="/lead/${esc(ctx.leadId)}/hero" style="margin:0">
                 <input type="hidden" name="artifactId" value="${esc(a.id)}">
                 <button type="submit" name="url" value="" class="hp-undo"
                   onsubmit-guard="1">${T(lang, "Vissza a gépi választásra")}</button>
               </form>
             </div>`
          : ""
      }
      <form method="post" action="/lead/${esc(ctx.leadId)}/hero" class="hp-form" id="hp-form"
        onsubmit="${esc(`this.classList.add('busy');var s=document.getElementById('hp-busy');if(s)s.hidden=false`)}">
        <input type="hidden" name="artifactId" value="${esc(a.id)}">
        <div class="hp-row">
          <figure class="hp-cur" data-key="${esc(key(heroUrl))}">
            <span class="hp-tag">${T(lang, "NYITÓKÉP")}</span>
            <img src="${esc(proxiedPhotoUrl(heroUrl))}" alt="" loading="lazy">
            <figcaption>${
              heroSc
                ? `${esc(heroSubjectLabel(heroSc.subject, lang))} · ${heroSc.score}/100 — ${esc(heroSc.reason)}`
                : T(lang, "Erről a képről nincs ítéletünk — a mock kurátor-sorban marad.")
            }</figcaption>
            <p class="hp-dead" hidden></p>
          </figure>
          <div>
            <div class="hp-alts">${rest.map((r) => thumb(r.u)).join("")}</div>
            <p class="cp-hint" id="hp-hint">${T(lang, "A képek nyitókép-alkalmasság szerint. Kattints, ha mást akarsz a lap tetejére — a mock azonnal újrarenderelődik.")}</p>
            <p class="cp-hint" id="hp-busy" hidden>${T(lang, "Újrarenderelem a mockot az új nyitóképpel…")}</p>
          </div>
        </div>
      </form>
      <div id="hp-dead-sum" class="hp-deadsum" hidden></div>
      <div id="hp-warn"></div>
      <script>${heroPickScript(lang)}</script>
      <script>${photoHealthScript(ctx.leadId, a.id, lang)}</script>
    </div>`;
}

/**
 * A CSEMPÉK ALÁ ÍRJA, MIÉRT NEM TÖLTHETŐ BE A KÉP — és összegzi, mit jelent ez a
 * kiszállított lapra nézve (FK-003b ①).
 *
 * ⛔ A „nem ítélt" nem magyarázat: az a VERDIKT hiányáról szól. A kurátor viszont azt
 * látta, hogy a csempe üres, és semmi nem mondta meg neki, hogy a portál letörölte a
 * fotót — azt sem, hogy emiatt a LEADNEK kiküldött lapon is törött lesz. Ez a szkript
 * a két állítást szétválasztva teszi ki: a verdikt marad a helyén, a betöltési hiba
 * saját sort kap.
 *
 * Aszinkron, mert a lap-render nem várhat 16 hálózati kérésre; a proxy ugyanabból a
 * cache-ből dolgozik, tehát mire a bélyegek betöltenek, a válasz általában már kész.
 */
function photoHealthScript(leadId: string, artifactId: string, lang: string): string {
  const sum1 = jsStr(
    T(lang, "1 kép forrása nem érhető el — ez a kép a LEADNEK kiküldött lapon is törött lesz."),
  );
  const sumN = jsStr(
    T(lang, "{n} kép forrása nem érhető el — ezek a képek a LEADNEK kiküldött lapon is törötten jelennek meg."),
  );
  return `(function () {
    fetch('/lead/${jsStr(leadId)}/photo-health?a=${jsStr(artifactId)}')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        (d.photos || []).forEach(function (p) {
          if (p.ok) return;
          document.querySelectorAll('[data-key="' + p.key.replace(/"/g, '\\\\"') + '"] .hp-dead')
            .forEach(function (el) { el.hidden = false; el.textContent = p.reason; });
        });
        // ⛔ AZ ÖSSZEGZŐ MONDAT a KISZÁLLÍTOTT lapról állít valamit, ezért a RENDERELT
        // mock mérését írja ki — nem a csempék (bemeneti) listáját. A kettő eddig
        // csak véletlenül esett egybe.
        var r = d.rendered || {};
        var dead = (r.broken || []).length;
        var box = document.getElementById('hp-dead-sum');
        if (box && dead) {
          box.hidden = false;
          box.textContent = dead === 1 ? '${sum1}' : '${sumN}'.replace('{n}', String(dead));
        }
        // A KÉPERNYŐ KATTINTÁS ELŐTT MONDJA KI: a Jóváhagyás gomb mellé kerül, hogy
        // ez a mock a kapuba fog futni. (A garancia a szerver-oldali kapu; ez azért
        // van, hogy a kurátor ne egy visszautasításból tudja meg.)
        var pre = document.querySelector('[data-photo-gate-pre="${jsStr(artifactId)}"]');
        if (pre && r.blocks) {
          pre.hidden = false;
          pre.textContent = r.sentence || '';
        }
      })
      .catch(function () { /* a hiányzó egészség-adat nem tehet tönkre egy működő panelt */ });
  })();`;
}

/**
 * A KURÁTOR A KATTINTÁS ELŐTT TUDJA MEG, hogy ez a mock a kép-kapuba fog futni
 * (ADR-0131). Ugyanaz a végpont, tehát ugyanaz a mérés, mint amit a kapu használ —
 * egy felirat, ami MÁS forrásból dolgozna, mint a döntés, előbb-utóbb mást mondana.
 *
 * ⚠️ Ez kényelem, NEM garancia: a garancia a szerver-oldali kapu, ami JS nélkül is
 * áll. Ha ez a kérés elhasal, a kurátor a megtagadás képernyőjén tudja meg.
 */
function photoGatePreScript(leadId: string, artifactId: string): string {
  return `(function(){
    fetch('/lead/${jsStr(leadId)}/photo-health?a=${jsStr(artifactId)}')
      .then(function(r){return r.json();})
      .then(function(d){
        var r=(d||{}).rendered||{};
        var el=document.querySelector('[data-photo-gate-pre="${jsStr(artifactId)}"]');
        if(!el||!r.blocks) return;
        el.hidden=false;
        el.textContent=r.sentence||'';
      })
      .catch(function(){});
  })();`;
}

/**
 * A kizárt tárgyú (vagy gyenge) képnél megerősítést kérünk — de NEM tiltunk.
 * A kurátor néha többet tud a leadről, mint ami a képen látszik; a dolgunk az, hogy
 * tudja, mit választ. JS nélkül a beküldés simán átmegy: a választás joga nem függhet
 * attól, fut-e a szkript.
 */
function heroPickScript(lang: string): string {
  return `document.addEventListener('DOMContentLoaded',function(){
    var form=document.getElementById('hp-form'); if(!form) return;
    var box=document.getElementById('hp-warn');
    var NEVER=['toilet','bathroom','parking','sign_map','people_doc','ad_banner'];
    form.querySelectorAll('.hp-alt').forEach(function(b){
      b.addEventListener('click',function(ev){
        var sc=parseInt(b.dataset.score,10);
        var risky=NEVER.indexOf(b.dataset.subject)>=0||(isFinite(sc)&&sc<55);
        if(!risky||b.dataset.ok==='1') return;
        ev.preventDefault();
        box.innerHTML='<div class="hp-warnbox"><b>${jsStr(T(lang, "Biztos ez legyen a lap teteje?"))}</b><br>'
          +b.dataset.subject+' · '+(isFinite(sc)?sc:'?')+'/100 — '+b.dataset.reason
          +'<div class="hp-warnrow"><button type="button" class="btn" id="hp-yes">${jsStr(T(lang, "Igen, ez legyen"))}</button>'
          +'<button type="button" class="ghost" id="hp-no">${jsStr(T(lang, "Mégsem"))}</button></div></div>';
        document.getElementById('hp-yes').onclick=function(){b.dataset.ok='1';box.innerHTML='';b.click();};
        document.getElementById('hp-no').onclick=function(){box.innerHTML='';};
      });
    });
  });`;
}

/**
 * AMI A SZÖVEGBŐL KIMARADT — EGY lista, EGY helyen számolva.
 *
 * ⛔ MÉRT HIBA (2026-09-11, Elek FK-003b): ugyanaz a lap KÉT különböző listát adott
 * ugyanarra a kérdésre. Fent „3 dolgot nem említ" (Wifi · Akadálymentes ·
 * Kerthelyiség), lent „4 igazolt tény kimaradt a szövegből" (Wifi · Akadálymentes ·
 * Babafelszerelés · Kert és grill) — más szám ÉS részben más tételek. Mindkettő
 * ugyanabból az `inputs.marketMissed`-ből dolgozott, csak a szöveg-panel leszűrte
 * (amit a próza már megnevez, az nem hiányzik), a forrás-panel pedig nyersen írta ki.
 * A kurátornak nem volt honnan tudnia, melyik igaz — §B.17: egy lapon egy igazság.
 *
 * A SZŰRT lista a helyes válasz (a nyers azt kérné, tegyünk bele valamit, ami már
 * benne van), ezért az lett a közös igazság. Aki ezt a listát mutatja, INNEN kéri —
 * új hívóhely nem számolhatja újra. Őr: `scripts/missed-list-check.mts`.
 */
function missedAmenityGroups(inputs: Record<string, unknown>): { label: string; items: string[] }[] {
  const site = (inputs.siteData ?? {}) as Record<string, unknown>;
  const recipe = (inputs.recipe ?? {}) as { sections?: { kind?: string; copy?: Record<string, string> }[] };
  const hero = recipe.sections?.find((x) => x.kind === "hero")?.copy ?? {};
  const highlights = Array.isArray(site.highlights) ? (site.highlights as string[]) : [];
  const tagline = typeof site.tagline === "string" ? site.tagline : "";
  const intro = typeof site.intro === "string" ? site.intro : "";
  const named = Array.isArray(inputs.marketFactsNamed) ? (inputs.marketFactsNamed as string[]) : [];
  const missedRaw = Array.isArray(inputs.marketMissed) ? (inputs.marketMissed as string[]) : [];
  // The raw lists are redundant ("WIFI" / "Wifi a közösségi terekben" / "Internetkapcsolat"),
  // so both the chips AND the counts run on grouped items — otherwise the number lies.
  //
  // A raw item can land in a group that ANOTHER raw item already put on the
  // "used" side — showing the same group on both sides read as a contradiction
  // ("Kerékpár eladja ÉS nem említi", Elek GY1). The miss list is what the copy
  // does NOT touch at all, so groups already used are dropped from it.
  const usedLabels = new Set(groupAmenities(named).map((g) => g.label));
  // ...and a group the COPY ITSELF already names is not missing either, however the
  // guard's fact list happened to label it. MEASURED 2026-09-07 across the 8 latest
  // mocks: 5 chips asked the curator to add something the text already said (e.g.
  // "Kert és grill" offered under an intro that describes the garden). Asking for
  // what is there wastes a regeneration AND undermines the panel's credibility —
  // so the copy surface itself is the final word, checked with the SAME matcher the
  // marketing gate judges by (copyNames), never a second heuristic.
  //
  // ⛔ The check runs on the group's ITEMS, never on its label. Measured while
  // building this: filtering by label alone deleted a genuinely missing "Szauna",
  // because its bucket is "Medence és wellness" and the copy mentioned the pool.
  // A group survives while ANY member is still unsaid — and if the label itself is
  // already in the copy, the chip renames itself to the member that is missing, so
  // the curator asks for the sauna rather than for the pool he already has.
  const copySurface = normForCopyMatch([hero.lead, tagline, intro, ...highlights].filter(Boolean).join(" · "));
  return groupAmenities(missedRaw)
    .filter((g) => !usedLabels.has(g.label))
    .map((g) => ({ ...g, items: g.items.filter((it) => !copyNames(it, copySurface)) }))
    .filter((g) => g.items.length > 0)
    .map((g) => (copyNames(g.label, copySurface) ? { ...g, label: g.items[0]! } : g));
}

function mockCopyPanel(
  a: ArtifactView | undefined,
  lang: string,
  rewriting = false,
  result: { ok: boolean; message: string } | null = null,
  /** Nyitókép-választó (jóváhagyott terv: assets/design-refs/console/hero-override/).
   *  Enélkül a panel csak MEGÍTÉLI a nyitóképet, de nem enged javítani rajta. */
  heroPick?: { leadId: string; scores: LeadDetail["heroScores"]; pin: LeadDetail["heroPin"] },
): string {
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
  // The raw lists are redundant ("WIFI" / "Wifi a közösségi terekben" / "Internetkapcsolat"),
  // so both the chips AND the counts run on grouped items — otherwise the number lies.
  const usedGroups = groupAmenities(named);
  // A hiányzó tételek EGY közös helyről jönnek (missedAmenityGroups) — a forrás-panel
  // ugyanezt a listát írja ki, nem a nyers `marketMissed`-et.
  const missGroups = missedAmenityGroups(inputs);
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
  // What the vision pass saw on the picture that BECAME the hero (heroPick.ts). Until
  // 2026-09-09 nothing on this panel described the hero at all — it was simply the
  // largest file, and a bathroom shot reached one owner as the top of his page.
  const vHero = verdict(
    "heroVerdict",
    T(lang, "Nyitókép"),
    typeof inputs.heroScore === "number" && typeof inputs.heroReason === "string"
      ? T(lang, "{score}/100 — {why}", { score: inputs.heroScore, why: inputs.heroReason })
      : inputs.heroReason,
  );
  // The reason blocks must sit AFTER all pills, not between them.
  const verdicts = [vMarket, vFact, vHero];
  const pills = verdicts.map((h) => h.split("</button>")[0] + "</button>").filter((h) => h !== "</button>");
  const whys = verdicts.map((h) => h.split("</button>")[1] ?? "").join("");

  const chip = (g: { label: string; items: string[] }, kind: "used" | "miss"): string =>
    kind === "used"
      ? `<span class="cp-chip used" title="${esc(g.items.join(" · "))}">${esc(g.label)}</span>`
      : `<button type="button" class="cp-chip miss" aria-pressed="false"
           data-t="${esc(g.label.toLowerCase())}" title="${esc(g.items.join(" · "))}"><span class="cp-pl">+</span>${esc(g.label)}</button>`;

  /**
   * „MIT HASZNÁL FEL A SZÖVEG" — jóváhagyott terv ⑥
   * (`assets/design-refs/console/lead-page/`, tulajdonosi döntés 2026-09-14).
   *
   * ⛔ MIÉRT (Elek FK-003b): a kártya két főszáma NEM JÖTT KI EGYMÁSBÓL. „9 szolgáltatást
   * … a hirdetés 18-ból" és „3 dolgot … nem említ" — a maradék 6 tétel sorsáról egy szó
   * sem esett, tehát a nevező megmagyarázatlan maradt. Most a HARMADIK szakasz is ott
   * van (ismétlés / általános tétel), és a lap KIÍRJA AZ ÖSSZEADÁST.
   *
   * ⚠️ És kimondja, hogy a nevező nem csak a gyűjtésből jön: a `marketAmenityTotal` az
   * LLM által a prózából kinyert tényeket is tartalmazza (`generateEngine.ts`), ezért
   * generálásonként változhat — egy állandónak látszó „18-ból" erről hallgatna.
   */
  const usedN = usedGroups.length;
  const missN = missGroups.length;
  const restN = total ? Math.max(0, total - usedN - missN) : 0;
  const scale = usedN || missN
    ? `<div class="cp-sum" data-cit-scale="${usedN}/${missN}/${restN}/${total || 0}">
         <div class="cp-bar">
           ${usedN ? `<span class="b1" style="flex:${usedN}">${usedN}</span>` : ""}
           ${missN ? `<span class="b2" style="flex:${missN}">${missN}</span>` : ""}
           ${restN ? `<span class="b3" style="flex:${restN}">${restN}</span>` : ""}
         </div>
         <p class="cp-leg">${
           total
             ? T(
                 lang,
                 "{u} tételt a lap FELHASZNÁL, {m} igazolt tény KIMARADT, {r} pedig ismétlés vagy általános — együtt {u}+{m}+{r} = {n}, ennyi külön tételt ismerünk erről a szállásról.",
                 { u: String(usedN), m: String(missN), r: String(restN), n: String(total) },
               )
             : T(lang, "{u} tételt a lap felhasznál, {m} igazolt tény kimaradt.", { u: String(usedN), m: String(missN) })
         }</p>
         ${
           total
             ? `<p class="cp-leg mut">${ic("alert", 13)} ${T(
                 lang,
                 "A nevező nem csak a gyűjtésből jön (a szövegből kinyert, idézettel igazolt tényeket is tartalmazza), ezért generálásonként változhat.",
               )}</p>`
             : ""
         }
       </div>`
    : "";

  const tick = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 5"/></svg>`;

  const heroStrip = heroPick ? heroPickStrip(a, heroPick, lang) : "";

  return `
    <div class="panel cp-panel">
      <h2>${T(lang, "A mock szövege")}</h2>
      <p class="small mut" style="margin:0 0 12px">${T(lang, "Ezt olvassa a szálláshely tulajdonosa, amikor megnyitja a mockot.")}</p>
      ${scale}
      ${pills.length ? `<div class="cp-verdicts">${pills.join("")}</div>${whys}` : ""}
      ${heroStrip}
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
      ${
        // OUTCOME OF THE LAST RUN — right above the button that started it. A
        // failure that only reaches the log is a failure the operator debugs by
        // pressing the button again (measured 2026-09-07: three dead requests on
        // an empty API credit balance, with a silent screen).
        result && !rewriting
          ? `<div class="cp-doc cp-outcome ${result.ok ? "ok" : "bad"}" style="margin-top:12px">
               ${ic(result.ok ? "check" : "alert", 15)}<span>${esc(result.message)}</span>
             </div>`
          : ""
      }
      <form method="post" action="/artifact/${esc(a.id)}/recopy" class="cp-doc" style="margin-top:12px"
            onsubmit="${esc(`var b=this.querySelector('button');b.disabled=true;b.textContent='${jsStr(T(lang, "Szöveg készül… (~1 perc)"))}'`)}">
        <p class="small mut" style="margin:0 0 8px;font-weight:700;text-transform:uppercase;letter-spacing:.08em">${T(lang, "Csak a szöveg újragenerálása")}</p>
        <textarea id="cp-in" name="recopyPrompt" rows="3" maxlength="600"
          placeholder="${T(lang, "Mit csináljon másképp? (elhagyható — vagy koppintson a fenti pontokra)")}"
          style="width:100%;padding:8px 10px;font-family:inherit;font-size:13px"></textarea>
        <p class="small mut" id="cp-count" style="text-align:right;margin:4px 0 8px">0 / 600</p>
        ${
          // IN-FLIGHT STATE — only the BUTTON is replaced, never the form.
          // MEASURED REGRESSION (2026-09-07): the first version swapped the whole
          // form for the status pill, but left the "not mentioned" chips on screen.
          // The chips write into #cp-in — which no longer existed — so cpScript
          // bailed out and every chip became a dead button that swallowed the click
          // in silence. Exactly the symptom the fix was meant to end. The input and
          // the chips therefore STAY LIVE while a rewrite runs: the operator can
          // prepare the next instruction instead of poking a frozen panel.
          rewriting
            ? `<div class="row" style="margin-top:0"><span class="pill generated">${T(lang, "szöveg készül…")}</span>
                 <span class="mut small">${T(lang, "~1 perc — az oldal automatikusan frissül, és a szöveg magától cserélődik")}</span></div>
               <script>setTimeout(function(){location.reload()},8000)</script>`
            : `<button class="gen-go" type="submit">${T(lang, "Szöveg újragenerálása")}</button>`
        }
        <p class="cp-hint">${T(lang, "A kinézet, a fotók és az elrendezés VÁLTOZATLAN marad — csak a szöveg születik újra, és az őrök arra is lefutnak. Már kiküldött mockot nem ír át.")}</p>
      </form>
    </div>
    <script>${cpScript(T(lang, "Emeld be a szövegbe: "))}</script>`;
}

/**
 * "HONNAN TUDJUK?" — the SOURCE PANEL (ADR-0106 ⑥; approved contract:
 * assets/design-refs/console/source-panel/README.md).
 *
 * WHY: the curator saw WHAT the engine wrote (copy panel) but never WHERE it
 * came from — the owner's words: "nem látok egy ilyen információ-behúzást se".
 * This panel is that missing eye, and the audit trail the post-pilot human-free
 * run will be judged by. It renders ONLY from the generation-time snapshot
 * (inputs.sourcePanel) — never from the lead's current state, which may have
 * been re-enriched since — and every quote it opens is the machine-verified
 * verbatim evidence, not a paraphrase (§B.17).
 */
function mockSourcePanel(a: ArtifactView | undefined, leadName: string, lang: string): string {
  if (!a) return "";
  const inputs = a.inputs as Record<string, unknown>;
  const sp = inputs.sourcePanel as
    | {
        portals?: { host: string; band: string; amenities: number; photos: number; descChars: number }[];
        guestReviews?: { count: number; sources: string[] };
        ownerIntro?: boolean;
        photosByProvenance?: Record<string, number>;
        facts?: { label: string; source: string; quote?: string }[];
      }
    | undefined;
  // Pre-ADR-0106 artifacts carry no snapshot — no panel, never an empty lie.
  if (!sp) return "";

  const site = (inputs.siteData ?? {}) as Record<string, unknown>;
  const recipe = (inputs.recipe ?? {}) as { sections?: { kind?: string; copy?: Record<string, string> }[] };
  const hero = recipe.sections?.find((x) => x.kind === "hero")?.copy ?? {};
  const highlights = Array.isArray(site.highlights) ? (site.highlights as string[]) : [];
  const tagline = typeof site.tagline === "string" ? site.tagline : "";
  const intro = typeof site.intro === "string" ? site.intro : "";
  const facts = sp.facts ?? [];
  const fUnsourced = Array.isArray(inputs.factUnsourced) ? (inputs.factUnsourced as string[]) : [];
  // UGYANAZ a lista, mint a szöveg-panelen — nem a nyers `marketMissed`. Amíg ez itt
  // külön számolt, a lap két különböző választ adott ugyanarra a kérdésre (FK-003b ③).
  const missed = missedAmenityGroups(inputs);

  // Source key → operator-facing name + dot class. A portal host passes through.
  const srcName = (s: string): string =>
    s === "owner_intro"
      ? T(lang, "tulaj-bemutatkozás")
      : s === "google_places"
        ? T(lang, "Google-vélemény")
        : s === "description"
          ? T(lang, "a szállás leírása")
          : s === "unknown"
            ? T(lang, "ismeretlen forrás")
            : s;
  const srcKind = (s: string): string =>
    s === "google_places" ? "guest" : s === "owner_intro" ? "owner" : "portal";

  // One text element = one block; its chips are the facts whose label the SAME
  // matcher the marketing gate uses (copyNames) finds in the element's text.
  let qSeq = 0;
  const elemBlock = (label: string, text: string): string => {
    if (!text.trim()) return "";
    const normed = normForCopyMatch(text);
    const inElem = facts.filter((f) => copyNames(f.label, normed));
    const badInElem = fUnsourced.filter((f) => copyNames(f, normed));
    if (!inElem.length && !badInElem.length) return "";
    const rows = inElem.map((f) => {
      const id = `sp-q${++qSeq}`;
      // No-quote body must say WHERE the fact actually lives — a description-
      // derived fact captioned "szolgáltatás-lista" would be our own §B.17 slip.
      const body = f.quote
        ? `<b>${esc(srcName(f.source))}</b>„${esc(f.quote)}"`
        : f.source === "description"
          ? `<b>${esc(srcName(f.source))}</b>${T(lang, "A leírás-elemző nyerte ki a szövegből (ehhez nem készül szó szerinti idézet).")}`
          : `<b>${esc(srcName(f.source))}</b>${T(lang, "A szolgáltatás-listájában szerepel (nincs külön szöveg-idézet).")}`;
      return {
        chip: `<button type="button" class="sp-chip" data-src="${srcKind(f.source)}" data-q="${id}"><span class="sp-dot"></span>${esc(f.label)}</button>`,
        quote: `<div class="sp-quote" id="${id}">${body}</div>`,
      };
    });
    const badRows = badInElem.map((f) => {
      const id = `sp-q${++qSeq}`;
      return {
        chip: `<button type="button" class="sp-chip" data-src="none" data-q="${id}"><span class="sp-dot"></span>${esc(f)}</button>`,
        quote: `<div class="sp-quote" id="${id}"><b>${T(lang, "FORRÁSTALAN")}</b>${T(lang, "Ezt az állítást egyik forrás sem támasztja alá — a tényhűség-őr jelölte. Újragenerálás vagy kézi javítás javasolt.")}</div>`,
      };
    });
    return `<div class="sp-elem${badRows.length ? " has-problem" : ""}">
        <div class="sp-elem-h"><span class="sp-lbl">${esc(label)}</span><span class="sp-txt">„${esc(text.length > 160 ? `${text.slice(0, 160)}…` : text)}"</span></div>
        <div class="sp-chips">${[...rows, ...badRows].map((r) => r.chip).join("")}</div>
        ${[...rows, ...badRows].map((r) => r.quote).join("")}
      </div>`;
  };

  const portalCard = sp.portals?.length
    ? `<div class="sp-src"><h3>${ic("docs", 14)} ${T(lang, "Portál-adatlapok")}</h3>
        <div class="sp-v">${T(lang, "{n} beolvasva", { n: sp.portals.length })}</div>
        <div class="sp-d">${sp.portals
          .map((p) =>
            T(lang, "{host} ({band} egyezés, {a} szolgáltatás, {p} fotó, {c} kar leírás)", {
              host: esc(p.host),
              band: p.band === "high" ? T(lang, "magas") : T(lang, "közepes"),
              a: p.amenities,
              p: p.photos,
              c: p.descChars,
            }),
          )
          .join("<br>")}</div></div>`
    : `<div class="sp-src missing"><h3>${ic("docs", 14)} ${T(lang, "Portál-adatlapok")}</h3>
        <div class="sp-v">${T(lang, "nincs beolvasva")}</div>
        <div class="sp-d">${T(lang, "A generátor csak fotóból és régió-adatból dolgozott — az Adatok fülön indíts újragyűjtést.")}</div></div>`;
  const reviewCard = sp.guestReviews?.count
    ? `<div class="sp-src"><h3>${ic("star", 14)} ${T(lang, "Vendég-vélemények")}</h3>
        <div class="sp-v">${T(lang, "{n} szöveg", { n: sp.guestReviews.count })}</div>
        <div class="sp-d">${esc((sp.guestReviews.sources ?? []).map((s) => srcName(s)).join(", "))} · ${T(lang, "30 napos frissesség-szabály")}</div></div>`
    : `<div class="sp-src missing"><h3>${ic("star", 14)} ${T(lang, "Vendég-vélemények")}</h3>
        <div class="sp-v">${T(lang, "nem jött be")}</div>
        <div class="sp-d">${T(lang, "Nincs Google-egyezés vagy nincs használható szöveges vélemény.")}</div></div>`;
  const ownerCard = sp.ownerIntro
    ? `<div class="sp-src"><h3>${ic("partners", 14)} ${T(lang, "Tulaj-bemutatkozás")}</h3>
        <div class="sp-v">${T(lang, "megadva")}</div>
        <div class="sp-d">${T(lang, "A kurátor által beillesztett nyilvános önleírás — a legerősebb forrás.")}</div></div>`
    : `<div class="sp-src missing"><h3>${ic("partners", 14)} ${T(lang, "Tulaj-bemutatkozás")}</h3>
        <div class="sp-v">${T(lang, "nincs megadva")}</div>
        <div class="sp-d">${T(lang, "Nem kötelező — a portál-próza és a vendég-hang fedi. Kézzel pótolható a lead-oldalon.")}</div></div>`;
  const photoKinds = Object.entries(sp.photosByProvenance ?? {});
  const photoTotal = photoKinds.reduce((s, [, n]) => s + n, 0);
  const photoCard = `<div class="sp-src"><h3>${ic("photos", 14)} ${T(lang, "Képek")}</h3>
      <div class="sp-v">${T(lang, "{n} kép", { n: photoTotal })}</div>
      <div class="sp-d">${esc(photoKinds.map(([k, n]) => `${n} ${k}`).join(" + "))} · ${T(lang, "csak hangulat és paletta — tényt a kép nem ad")}</div></div>`;

  const warnOk = fUnsourced.length
    ? `<div class="sp-warn bad">${ic("alert", 14)} ${T(lang, "Forrás nélküli állítás: {n} — {list}", { n: fUnsourced.length, list: fUnsourced.join(", ") })}</div>`
    : `<div class="sp-warn ok">${ic("check", 14)} ${T(lang, "Forrás nélküli állítás: 0 — minden hard tény idézettel igazolt.")}</div>`;
  const warnMiss = missed.length
    ? `<div class="sp-miss"><b>${T(lang, "{n} igazolt tény kimaradt a szövegből:", { n: missed.length })}</b>
        <span>${esc(missed.map((g) => g.label).join(" · "))} — ${T(lang, "a fenti szöveg-panelen egy koppintással visszaadhatók az újragenerálásnak.")}</span></div>`
    : "";

  return `
    <div class="panel sp-panel" id="sp-panel">
      <div class="sp-head">
        <h2>${T(lang, "Honnan tudjuk? — a szöveg forrásai")}</h2>
        <label class="sp-probl"><input type="checkbox" id="sp-po"> ${T(lang, "csak a problémák")}</label>
        <span class="small mut">${esc(leadName)} · ${T(lang, "minden idézet gépileg ellenőrzött")}</span>
      </div>
      <div class="sp-srcgrid">${portalCard}${reviewCard}${ownerCard}${photoCard}</div>
      <p class="small mut sp-sect-t">${T(lang, "Mit honnan állít a szöveg? (kattints a tényre az idézetért)")}</p>
      ${elemBlock(T(lang, "Főcím"), hero.lead ?? "")}
      ${elemBlock(T(lang, "Alcím"), tagline)}
      ${elemBlock(T(lang, "Bemutatkozó"), intro)}
      ${elemBlock(T(lang, "Kiemelések"), highlights.join(" · "))}
      ${warnOk}
      ${warnMiss}
      <div class="sp-legend">
        <i><span class="sp-dot" data-src="portal"></span>${T(lang, "portál-adatlap")}</i>
        <i><span class="sp-dot" data-src="guest"></span>${T(lang, "vendég-vélemény")}</i>
        <i><span class="sp-dot" data-src="owner"></span>${T(lang, "tulaj-bemutatkozás")}</i>
        <i><span class="sp-dot" data-src="none"></span>${T(lang, "forrástalan")}</i>
      </div>
      <script>document.addEventListener('DOMContentLoaded',function(){
        document.querySelectorAll('#sp-panel .sp-chip').forEach(function(ch){
          ch.addEventListener('click',function(){
            var q=document.getElementById(ch.dataset.q); if(!q) return;
            var was=q.classList.contains('show');
            var el=ch.closest('.sp-elem');
            el.querySelectorAll('.sp-quote').forEach(function(x){x.classList.remove('show')});
            el.querySelectorAll('.sp-chip').forEach(function(x){x.classList.remove('open')});
            if(!was){q.classList.add('show');ch.classList.add('open');}
          });
        });
        var po=document.getElementById('sp-po');
        if(po) po.addEventListener('change',function(){
          document.getElementById('sp-panel').classList.toggle('problems-only',po.checked);
        });
      });</script>
    </div>`;
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
  const copyPanel = mockCopyPanel(latestMock, lang, latestMock ? recopying.has(latestMock.id) : false, recopyResult, {
    leadId: d.id,
    scores: d.heroScores,
    pin: d.heroPin,
  });
  // "Honnan tudjuk?" — the generation-time source map (ADR-0106 ⑥, approved plan).
  const sourcePanel = mockSourcePanel(latestMock, d.name, lang);
  // Generate form is its OWN full-width panel with the preview BESIDE the controls,
  // so it stays short/wide instead of towering over the compact meta cards.
  // The manual says "decide from the confidence number" — with NO number that
  // rule is silently unusable, and generation ran without a word (Elek K1).
  // Not a hard gate (hand-entered/cloned leads legitimately carry no score),
  // but the operator must SEE that the safety number is missing.
  const confWarn =
    d.matchConfidence == null
      ? `<p class="small" style="margin:0 0 10px">${ic("alert", 14)} ${T(
          lang,
          "Ehhez a leadhez nincs match-konfidencia érték — az adat-egyezés nem mért. Generálás előtt az Adatok fülön ellenőrizd, hogy a begyűjtött adatok tényleg erről az üzletről szólnak.",
        )}</p>`
      : "";
  const generatePanel = `
    <div class="panel">
      <h2>Mock ${d.artifacts.length ? T(lang, "újragenerálása") : T(lang, "generálása")}</h2>
      ${confWarn}
      ${
        gen.running
          ? `<div class="row" style="margin-top:0"><span class="con-run-pill"><span class="dot"></span>
               <b>${T(lang, "Mock generálása fut")}</b></span>
             <span class="con-run-t" data-cit-elapsed="${gen.startedAt ?? ""}">0:00</span>
             ${progress ? `<span class="con-run-stage">${esc(progress)}</span>` : ""}
             <span class="mut small">${T(lang, "~1-2 perc — az oldal automatikusan frissül")}</span></div>
             <script>setTimeout(function(){location.reload()},6000)</script>`
          : `${
              // A BEFEJEZETT futás kimenete a gomb FÖLÖTT, ahol az operátor épp állna, hogy
              // újra megnyomja. A hallgató bukás megkülönböztethetetlen a törött gombtól.
              // FK-003b L06: a SIKER is kimondja, meddig tartott és hova vezet — eddig
              // csak egy „Kész" mondat állt itt, időtartam és link nélkül.
              gen.outcome
                ? `<div class="cp-doc cp-outcome ${gen.outcome.ok ? "ok" : "bad"}" style="margin:0 0 12px">
                     ${ic(gen.outcome.ok ? "check" : "alert", 15)}<span>${esc(gen.outcome.message)}</span>${
                       // ⚠️ KÉT külön T() literállal: a katalógus-kigyűjtő a T() ELSŐ
                       // argumentumát statikusan olvassa — egy ternary kulcs némán
                       // kimaradna a nyelvi csomagból.
                       gen.outcome.durationMs
                         ? gen.outcome.ok
                           ? ` <span class="con-done__dur">${T(lang, "{d} alatt", { d: mmss(gen.outcome.durationMs) })}</span>`
                           : ` <span class="con-done__dur">${T(lang, "{d} után", { d: mmss(gen.outcome.durationMs) })}</span>`
                         : ""
                     }${
                       gen.outcome.ok && gen.outcome.artifactId
                         ? ` <a href="/mock/${esc(gen.outcome.artifactId)}" target="_blank" rel="noopener">${T(lang, "Megnézem a mockot")}</a>`
                         : ""
                     }
                   </div>`
                : ""
            }
             <form method="post" action="/lead/${esc(d.id)}/generate"
                   onsubmit="${esc(`var b=this.querySelector('button.gen-go');b.disabled=true;b.textContent='${jsStr(T(lang, "Indítás…"))}'`)}">
               <div class="gen-2col">
                 <div class="gen-controls">
                   <label class="small mut" style="display:block;margin-bottom:6px">${T(lang, "Kinézet-típus — a kurátor dönt: válaszd ki, melyik elrendezésekre generáljuk a mockot — többet is jelölhetsz, mindegyikre külön mock készül")}</label>
                   <div class="tpl-cards" role="group" aria-label="${T(lang, "Kinézet-típus")}">
                     ${templateCards()}
                   </div>
                   <label class="small mut" for="gen-cp-in" style="display:block;margin:12px 0 4px">${T(lang, "Kurátor-prompt (opcionális — hangvétel/hangsúly; tényt nem adhat hozzá)")}</label>
                   <textarea id="gen-cp-in" name="curatorPrompt" rows="4" maxlength="600"
                     placeholder="${T(lang, "pl. családias, meleg hang; a borkóstolót és a teraszt emeld ki")}"
                     style="width:100%;padding:6px 8px;margin-bottom:10px;font-family:inherit;font-size:13px"></textarea>
                   <button class="gen-go" type="submit">Mock ${d.artifacts.length ? T(lang, "újragenerálása") : T(lang, "generálása")}</button>
                 </div>
                 ${tplPreview(d, lang)}
               </div>
             </form>`
      }
    </div>`;
  // Audit material folds away by default — it must be reachable, not in the way.
  const provPanel = `
    <details class="panel">
      <summary style="cursor:pointer;font-weight:600">${T(lang, "Honnan jött az adat")} — ${d.provenance.length} rekord</summary>
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
  // ⛔ SZÁMLÁLÓ HELYETT MONDAT (jóváhagyott terv ③): minden fül KIMONDJA, mit talál rajta a
  // kurátor — a „Fotók" is, aminek eddig egyetlen száma sem volt, és ezért „üres"-nek
  // olvasódott. A mondat a fül-váltást követi (lásd `leadTabs` szkriptje).
  const photoCount = ((d.raw ?? {}) as { material?: { totalImages?: number } }).material?.totalImages ?? 0;
  const mockPhotoCount = typeof latestMock?.inputs?.photos === "number" ? latestMock.inputs.photos : null;
  const tabs: LeadTab[] = [
    {
      id: "ls-data",
      label: "Adatok",
      say: T(lang, "A begyűjtött adatok — itt javíthatod, amit a gyűjtés rosszul hozott."),
      body: leadDataPanel(d),
    },
    {
      id: "ls-mocks",
      label: T(lang, "Mock és generálás"),
      count: active.length,
      busy: gen.running,
      say: d.artifacts.length
        ? T(lang, "{n} aktív és {r} elutasított mock.", { n: active.length, r: rejected.length })
        : T(lang, "Még nincs mock ezen a leaden — innen indíthatod a generálást."),
      // mock-cards ①: HA VAN MOCK, AZ A FÜL ELSŐ ELEME — a másoló/forrás/generáló panel
      // alá csúszik, csukottan. ⛔ Mock NÉLKÜLI leaden fordítva: ott a generáló-panel nyitva
      // áll és ő van elöl, mert egy üres rács nem lehet a lap első mondata.
      body: d.artifacts.length
        ? `<h2 id="mock-artifacts" data-cit-mocksfirst="1" style="margin:2px 4px 10px">${T(lang, "Mock-artefaktumok")} (${T(lang, "{n} aktív", { n: active.length })}${rejected.length ? ` · ${T(lang, "{n} elutasított", { n: rejected.length })}` : ""})</h2>
           ${artifacts}
           <details class="panel con-mkgen" style="margin-top:14px">
             <summary style="cursor:pointer;font-weight:600">${T(lang, "Új mock generálása, forrás és szöveg-újraírás")}</summary>
             <div style="margin-top:12px">${copyPanel}${sourcePanel}${generatePanel}</div>
           </details>`
        : `<div class="con-mkgen">${copyPanel}${sourcePanel}${generatePanel}</div>
           <h2 id="mock-artifacts" data-cit-mocksfirst="0" style="margin:14px 4px 10px">${T(lang, "Mock-artefaktumok")}</h2>
           ${artifacts}`,
    },
    {
      id: "ls-outreach",
      label: T(lang, "Megkeresés"),
      count: prospects.length,
      say: prospects.length
        ? T(lang, "{n} követett megkeresés-link · ebből {s} ment ki.", { n: prospects.length, s: sentCount })
        : T(lang, "Még nincs követett megkeresés-link ehhez a leadhez."),
      body: prospectsPanel(prospects, d, photoGate),
    },
    {
      id: "ls-orders",
      label: T(lang, "Csomag és fizetés"),
      count: orders.length,
      say: orders.length
        ? T(lang, "{n} csomag-igény, amit a tulaj a konfigurátorban adott le.", { n: orders.length })
        : T(lang, "Nincs csomag-igény — a tulaj még nem konfigurált a megkeresés-linken."),
      body:
        ordersPanel ||
        `<div class="panel"><h2>${T(lang, "Csomag-igények")}</h2>
           <p class="mut">A tulaj még nem konfigurált csomagot. Az igény a prospect-konfigurátorban
           (a megkeresés-linken) születik meg, és itt jelenik meg — fizetési kéréssel együtt.</p></div>`,
    },
    {
      id: "ls-photos",
      label: T(lang, "Fotók"),
      // ⛔ EZ A FÜL EDDIG SEMMIT NEM MONDOTT MAGÁRÓL (se szám, se szöveg).
      say: mockPhotoCount != null
        ? T(lang, "{n} összegyűjtött kép · ebből {m} van a legutóbbi mockban.", { n: photoCount, m: mockPhotoCount })
        : T(lang, "{n} összegyűjtött kép erről a szállásról.", { n: photoCount }),
      body: leadPhotosPanel(d.id, latestMock?.id, latestMockHeroUrl),
    },
    {
      id: "ls-contacts",
      label: T(lang, "Elérhetőségek"),
      count: contactCount,
      say: T(lang, "{n} elérhetőség-jelölt, amit a gyűjtés talált.", { n: contactCount }),
      body: leadContactsPanel(d),
    },
    {
      id: "ls-admin",
      label: "Audit",
      say: T(lang, "Diszkvalifikálás és adat-eredet — {n} provenance-rekord.", { n: d.provenance.length }),
      body: `${disqualifyPanel(d)}${provPanel}`,
    },
  ];
  const body = `
    <a class="con-back" href="/leads"><span aria-hidden="true">←</span> Vissza a leadekhez</a>
    ${heroPanel}
    ${flashBanner}
    ${leadTabs(tabs)}
    ${galleryScript()}
    ${elapsedScript()}`;
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

/**
 * ELTELT IDŐ, ami tényleg ketyeg. Minden `[data-cit-elapsed="<epoch ms>"]` elem
 * másodpercenként frissül — a szerver csak az INDULÁS pillanatát küldi le, a lap
 * számol. Egy befagyott „0:00" ugyanolyan néma, mint a semmi: az operátornak azt
 * kell látnia, hogy telik az idő, különben nem tudja eldönteni, beragadt-e (FK-003b ②).
 *
 * A szerver-óra és a böngésző-óra eltérhet; a negatív/hibás értéket ezért 0-ra
 * vágjuk, nem írunk ki „-3:12"-t.
 */
function elapsedScript(): string {
  return `<script>
    (function () {
      var els = document.querySelectorAll('[data-cit-elapsed]');
      if (!els.length) return;
      function tick() {
        var now = Date.now();
        els.forEach(function (el) {
          var t0 = parseInt(el.getAttribute('data-cit-elapsed'), 10);
          if (!isFinite(t0)) { el.textContent = ''; return; }
          var s = Math.max(0, Math.floor((now - t0) / 1000));
          el.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
        });
      }
      tick();
      setInterval(tick, 1000);
    })();
    // FK-003b L06: a lezáró sor MEGMARAD, de a kurátor elteheti, ha elolvasta.
    // Csak a képernyőről tünteti el — a kimenet a szerveren a TTL-jéig él tovább,
    // tehát a „kész" tény nem vész el, csak ez a sáv.
    (function () {
      var x = document.querySelector('[data-gen-dismiss]');
      if (!x) return;
      x.addEventListener('click', function () {
        var bar = x.closest('[data-gen-done]');
        if (bar) bar.remove();
      });
    })();
  </script>`;
}

interface LeadTab {
  readonly id: string;
  readonly label: string;
  /** Shown as a badge on the tab; 0 renders as a muted zero (present ≠ hidden). */
  readonly count?: number;
  /** Fut valami ezen a fülön? Lüktető pötty — a futás ott is látszik, ahol a kurátor
   *  éppen NEM áll (FK-003b ②: a generálás egy másik fülön némán zajlott). */
  readonly busy?: boolean;
  /**
   * MIT TALÁL a kurátor ezen a fülön — jóváhagyott terv ③
   * (`assets/design-refs/console/lead-page/`).
   *
   * ⛔ MIÉRT: hét fülből hat viselt magyarázat nélküli SZÁMOT, a „Fotók" egyet sem — így a
   * hiányzó szám „üres"-nek olvasódott, pedig nem az volt. Egy szám önmagában nem mondja
   * meg, MIT számol; a mondat igen, és a „Fotók" sem lóg ki tőle.
   */
  readonly say: string;
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
        // ⛔ A SZÁM KIVEZETVE a fülsorról (jóváhagyott terv ③): magyarázat nélkül nem
        // mondta meg, MIT számol, a „Fotók" fül pedig egyet sem viselt, és ezért
        // „üres"-nek olvasódott. A helyét a fülsor alatti MONDAT vette át.
        `${t.busy ? `<span class="tabdot" title="${T(lang, "fut valami ezen a fülön")}"></span>` : ""}</a>`,
    )
    .join("");
  const panes = tabs
    .map(
      (t, i) =>
        `<section class="con-tabp${i === 0 ? " on" : ""}" id="${esc(t.id)}" role="tabpanel">${t.body}</section>`,
    )
    .join("");
  // A mondatok GÉPI szótára: a szkript innen veszi a szöveget fül-váltáskor, tehát a
  // felirat és a fül nem tud szétcsúszni (egy kézzel karbantartott JS-objektum igen).
  const says = tabs.map((t) => `<span data-say-for="${esc(t.id)}" hidden>${esc(t.say)}</span>`).join("");
  return `<div class="con-ltabs">
      <div class="con-ltabs__head">
        <nav class="con-ltabs__bar" role="tablist" aria-label="${T(lang, "Lead-szekciók")}">${bar}</nav>
        <p class="con-ltabs__say" data-cit-tabsay>${esc(tabs[0]?.say ?? "")}</p>
      </div>
      <span hidden data-say-store>${says}</span>
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
        // A ragadás a fülsort ÉS az alatta álló mondatot EGYÜTT viszi (jóváhagyott terv 3).
        // MÉRVE: amíg csak a sáv ragadt, a pinnelt sáv (top=60, bottom=111) TELJESEN
        // rátakart a mondatra (top=59, bottom=78) — a lap kiírta, de az operátor nem látta.
        // Teljes-lapos képen ez sosem látszott volna, csak geometriával.
        var bar = root.querySelector('.con-ltabs__head') || root.querySelector('.con-ltabs__bar');
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
          // A FÜLSOR ALATTI MONDAT KÖVETI A VÁLTÁST (jóváhagyott terv 3). A szöveget a
          // kiszolgáló írta le fülönként (data-say-for attribútum), nem a szkript tartja
          // karban — így a mondat és a fül tartalma nem tud szétcsúszni.
          // FIGYELEM: ez a blokk egy template literal BELSEJÉBEN él, ezért itt visszapipa
          // (backtick) nem szerepelhet — az lezárná a sztringet.
          var say = root.querySelector('[data-cit-tabsay]');
          var src = root.querySelector('[data-say-for="' + id + '"]');
          if (say && src) say.textContent = src.textContent;
          return true;
        }
        function fromHash() {
          var h = location.hash.replace(/^#/, '');
          if (!h) return false;
          if (show(ALIAS[h] || h)) return true;
          // ⛔ A horgony egy PANELEN BELÜLI elemre is mutathat (pl. egy mock-kártya:
          // "#a-<artifactId>"). Eddig az ilyen hash-re a show() egyszerűen hamisat
          // adott, és a fül NEM váltott — vagyis a szerver odaküldte a kurátort egy
          // kártyához, ami egy REJTETT fülön ült. A kép-kapu megtagadás-képernyője
          // pontosan így lett volna láthatatlan.
          var el = document.getElementById(h);
          if (!el) return false;
          var pane = el.closest('.con-tabp');
          if (!pane || !show(pane.id)) return false;
          // A két RAGADÓS sáv (felső menü + fülsor) rátakarna a célelem tetejére —
          // és a legfontosabb sor pont a fejléce. Mérve tesszük odébb, nem tippelt
          // pixellel: a menü magassága telefonon a tördeléstől függ.
          var off = (topBar ? topBar.offsetHeight : 0) + (bar ? bar.offsetHeight : 0) + 10;
          var y = el.getBoundingClientRect().top + window.pageYOffset - off;
          window.scrollTo({ top: y < 0 ? 0 : y });
          return true;
        }
        for (var k = 0; k < tabs.length; k++) {
          tabs[k].addEventListener('click', function (e) {
            e.preventDefault();
            var id = this.getAttribute('data-tab');
            if (!show(id)) return;
            history.replaceState(null, '', '#' + id);
            // Bring the strip into view: after a long panel the tabs are off-screen.
            // Reduced-motion honored — and the smooth scroll also poisoned the test
            // runner's screenshots (stale sticky-bar layer captured mid-scroll).
            var motion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
            root.scrollIntoView({ block: 'start', behavior: motion });
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
        if(inp.checked){
          // Élő keret: a lead SAJÁT adata fut át a kijelölt sablonon (FK-003b ④).
          // Pillanatkép nélkül marad a minta-kép — és a felirat is azt mondja.
          var f=document.getElementById('tpl-prev-frame');
          if(f){f.src=f.src.replace(/tpl=[^&]*/,'tpl='+encodeURIComponent(inp.value));}
          else{var i=document.getElementById('tpl-prev-img');if(i)i.src='/assets/ui/tpl-'+inp.value+'-prev.jpg';}
        }
        citTplCount();
      }
      /** The button says how many mocks the run will produce — the picker is
       *  multi-select, and a silent second mock is exactly what confused the curator. */
      function citTplCount(){
        var n=document.querySelectorAll('.tpl-cards input[name=template]:checked').length;
        var b=document.querySelector('button.gen-go');if(!b)return;
        var base=b.getAttribute('data-base')||b.textContent.trim();
        b.setAttribute('data-base',base);
        b.textContent = n>1 ? base+' ('+n+' típus)' : (n===1 ? base+' (1 típus)' : base);
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
      <p class="mut small" style="margin-top:18px">${T(lang, "Ez a nézet csak olvasható. A tartalom és a képek szerkesztését, valamint a nyilvános élesítést (ami fizetéshez kötött) egyelőre nálunk, kézzel végezzük.")}</p>
    </div>`;
  return layout(`${v.displayName} ${T(lang, "— kezelő")}`, body, { chrome: false });
}

/** Melyik küldő-gombot erősíti meg a felugró — ugyanazt indítja, amit a kurátor megnyomott. */
export interface VerdictConfirmView {
  readonly action: "send" | "send-all" | "send-pair";
  readonly blocking: readonly BlockingVerdict[];
  /**
   * A KÉP-lelet — ugyanebben a felugróban (tulajdonosi rendelet, 2026-09-19). Eddig a
   * kurátort egy másik képernyőre küldte, kötelező indoklásért; a kiküldési szándék útjába
   * a rendszer nem állhat így. Null = a lap képeivel nincs baj (vagy nincs mit vállalni).
   */
  readonly photo?: { kind: "broken" | "nophoto"; sentence: string; urls: readonly string[] } | null;
}

/**
 * A KÜLDÉS MEGERŐSÍTÉSE — felugró a generáláskori őr-lelettel (tulajdonosi rendelet,
 * 2026-09-17: „max figyelmeztessen, de ha utána is továbbkattint, menjen ki").
 *
 * ⛔ A GARANCIA A SZERVER, NEM EZ AZ ABLAK. A `<dialog>` `open` attribútummal jön, tehát
 * JS nélkül is LÁTSZIK és működik (csak nem modális); a `showModal()` csak a sötétített
 * háttérért fut. Ez azért így van, mert ebben a házban egy `confirm()` már elszállt egy
 * fordítás aposztrófján, és a visszafordíthatatlan művelet kérdés nélkül futott le — a
 * küldő útvonal ezért a `confirmVerdicts` mező NÉLKÜL nem küld, akkor sem, ha a
 * felugrót bárhogy megkerülik.
 * ⚠️ Az indoklás itt SZÁNDÉKOSAN opcionális (a fotó-kapunál kötelező): a tulaj gyors
 * utat kért. A napló így is rögzíti, ki, mikor és MELYIK leletet vállalta.
 */
function verdictConfirmDialog(prospectId: string, v: VerdictConfirmView): string {
  const lang = consoleLang();
  const items = v.blocking
    .map(
      (b) =>
        `<li><span class="pg-why">${esc(b.label)} — ${
          b.value === "flag" ? T(lang, "az őr sértést talált") : T(lang, "az őr NEM tudta ellenőrizni")
        }</span>${b.reason ? `<br><span class="mut small">${esc(b.reason)}</span>` : ""}</li>`,
    )
    .join("");
  // A kép-lelet ugyanezen a listán, a SAJÁT mondatával — a kurátor egy helyen látja,
  // mit vállal, és egy kattintással vállalja.
  const photoItem = v.photo
    ? `<li><span class="pg-why">${
        v.photo.kind === "nophoto"
          ? T(lang, "A kiszállított lapon egyetlen szállás-fotó sincs")
          : T(lang, "{n} kép forrása nem érhető el a kiszállított lapon", { n: String(v.photo.urls.length) })
      }</span><br><span class="mut small">${esc(v.photo.sentence)}</span>${
        v.photo.urls.length
          ? `<ul class="mut small" style="margin:4px 0 0">${v.photo.urls
              .slice(0, 6)
              .map((u) => `<li>${esc(u)}</li>`)
              .join("")}</ul>`
          : ""
      }</li>`
    : "";
  return `<dialog class="vg-dlg" id="cit-verdict-confirm" open>
      <div class="pg-head">${ic("alert", 16)} ${
        // A cím arra válaszoljon, ami a leletben van: egy fotó-hiányra „az őr megjelölte"
        // más kérdésre felelne, és a kurátor a rossz dolgot keresné a mockon.
        v.blocking.length
          ? T(lang, "Az őr megjelölte ezt a mockot — kiküldöd mégis?")
          : T(lang, "A kiszállított lap képeivel baj van — kiküldöd mégis?")
      }</div>
      <p class="pg-lead">${T(lang, "Ez nem tiltás: a kiküldés a te döntésed. De a levél ezzel a tartalommal megy ki egy idegennek, és nem vonható vissza.")}</p>
      <ul class="pg-list">${items}${photoItem}</ul>
      <form method="post" action="/prospect/${esc(prospectId)}/${esc(v.action)}" class="vg-dlg__form">
        <input type="hidden" name="confirmVerdicts" value="1">
        <label class="small mut" for="cit-vc-reason">${T(lang, "Megjegyzés a naplóba (nem kötelező)")}</label>
        <input id="cit-vc-reason" type="text" name="verdictReason" style="width:100%;padding:7px 9px;margin-top:4px"
          placeholder="${T(lang, "Pl.: a megjelölt tételek a „Minta” jelölésű modul-előnézetben vannak.")}">
        <div class="vg-dlg__acts">
          <a class="vg-dlg__cancel" href="/prospect/${esc(prospectId)}/draft">${T(lang, "Mégsem")}</a>
          <button class="bad" type="submit">${T(lang, "Kiküldöm mégis")}</button>
        </div>
      </form>
    </dialog>
    <script>
      (function () {
        var d = document.getElementById("cit-verdict-confirm");
        /* Fail-safe: az ablak már nyitva (open attribútum), tehát JS nélkül is látszik.
           Ez csak a sötétített háttérért fut, és előbb bezárja, különben a showModal()
           "already open" hibát dobna. */
        if (d && typeof d.showModal === "function") { try { d.close(); d.showModal(); } catch (e) {} }
      })();
    </script>`;
}

/** Outreach draft page: §C gate verdict + pipeline send button + copy-ready fallback. */
export function outreachDraftPage(
  prospectId: string,
  input: { leadName: string; segment: string | null },
  draft: { subject: string; body: string; link: string },
  check: { verdict: "PASS" | "FLAG"; reasons: string[]; identity?: readonly IdentityProblem[] },
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
    /** ADR-0122: this ADDRESS already got a cold mail — possibly on ANOTHER row. */
    emailAddressMailed?: boolean;
    smsSentAt?: string | null;
    /** ADR-0083: the MMS act's stamp = the pair's claim. */
    mmsSentAt?: string | null;
    /** Live pair job (in-process registry) — null when nothing is running. */
    pairJob?: { phase: "mms" | "sms" | "done" | "failed"; error?: string; mmsMessageId?: string } | null;
    /** Non-null = the cold-outreach allowlist would refuse this number (ADR-0082). */
    smsBlockedReason?: string | null;
    /** State of the EXACT image the MMS would carry (Elek FK-004 H1): without it
     * there is no pair, so the button is dead and the reason is on the screen. */
    mmsPreview?: HeroShotState | null;
  } | null = null,
  /** Parent lead — the draft is a SUB-page and must offer a way back to it. */
  leadId: string | null = null,
  /**
   * „Mehet ki most?" straight from the send path (describeMailSendability) — the
   * question the operator is actually asking when looking at this screen. Undefined
   * means the caller could not probe; the line is then omitted rather than guessed.
   */
  sendable?: MailSendability,
  /**
   * A KÜLDÉS MEGERŐSÍTÉSE (tulajdonosi rendelet, 2026-09-17): a generáláskori őr-lelet
   * nem tiltja a kiküldést, csak figyelmeztet — a kurátor a második kattintással küld.
   * Non-null = a küldő útvonal visszafordult ide, mert van megerősítetlen lelet.
   */
  verdictConfirm?: VerdictConfirmView | null,
): string {
  const lang = consoleLang();
  const pass = check.verdict === "PASS";
  // ⛔ THE BADGE NO LONGER CLAIMS „küldhető" (Elek FK-004 Z1/Z2). It never owned that
  // claim: §C is ONE of NINE gates in sendOutreachMail, so the green pill sat above a
  // red warning with nothing saying which one decides — and it kept saying „küldhető"
  // AFTER the letter had gone out. It now states exactly what it judges; the question
  // the operator actually asks is answered by `sendable` below, which comes from the
  // send path itself.
  // ⚠️ A „(§C)" jelölést az ADR-0126 őre (jogosan) kidobta: a doktrína-szakasz FEJLESZTŐI
  // azonosító, nem felhasználói szöveg. A jelvény attól lett igaz, hogy nem ígér
  // küldhetőséget — nem attól, hogy megnevezi a saját paragrafusát.
  const verdict = pass
    ? `<span class="pill approved">${T(lang, "Jogszerűségi kapu: PASS")}</span>`
    : `<span class="pill rejected">${T(lang, "Jogszerűségi kapu: FLAG — ez tiltja a küldést")}</span>`;
  // „Mehet ki most?" — ONE predicate with the button (describeMailSendability). Absent
  // (undefined) only for callers that cannot probe; then the line is simply not shown,
  // because a screen that GUESSES this is the bug being fixed.
  // ⛔⛔ A SÁV HÁROM MONDATA — és miért nem kettő (tulajdonosi rendelet, 2026-09-19:
  // „megtiltom, hogy a kurátor kiküldeni szándékát bármi meggátolja").
  //
  // MÉRVE ezen a képernyőn: a sáv „E-mail: most NEM küldhető — a jogszerűségi kapu tiltja
  // (az okok lent)"-et írt, miközben (a) a §C-jelvény közvetlenül alatta ZÖLD PASS volt,
  // (b) „az okok" NEM voltak lent — a §C-nek nem volt mondanivalója, tehát üres lista,
  // és (c) ez nem is tiltás volt: a dizájn-őr lelete figyelmeztet, a küldés gomb felugrója
  // a kurátor megerősítésére KIKÜLDI a levelet. A kurátor egy hamis tiltást olvasott egy
  // ártatlan kapu nevével, ezért meg sem nyomta a gombot, ami küldött volna.
  //
  // Ezért: ami a kurátor EGY kattintásával kimegy, az nem „nem küldhető" — az KÉRDÉS.
  // A sáv megnevezi a VALÓDI kaput, kiírja a lelet SAJÁT mondatait, és megmondja a
  // következő mozdulatot.
  const sendableClass = sendable === undefined ? "" : sendable.sendable ? "approved" : sendable.needsConfirm ? "warn" : "rejected";
  const sendableClaim =
    sendable === undefined
      ? ""
      : sendable.sendable
        ? T(lang, "E-mail: most kiküldhető — a küldő-út minden kapuja zöld")
        : sendable.needsConfirm
          ? T(lang, "E-mail: kiküldhető — a küldés gomb előbb megmutatja az őr leletét, és a megerősítéssel kimegy")
          : T(lang, "E-mail: most NEM küldhető — {ok}", {
              ok: esc(
                sendable.gateBlocked
                  ? T(lang, "a jogszerűségi kapu tiltja (lent felsorolva)")
                  : (sendable.reason ?? T(lang, "ismeretlen ok"))),
            });
  // A lelet SAJÁT sorai. ⛔ A §C okait NEM ismételjük: azokat a `reasons` blokk rendereli
  // lejjebb — egy szabály két példányban két igazság egy képernyőn.
  // ⚠️ DEFENZÍV OLVASÁS, és nem a kényelemért: a `scripts/` NINCS típus-ellenőrizve (a
  // tsconfig include-ja csak `src/**`), ezért a kézzel írt őr-fixture-ök a MailSendability
  // régi alakját adják át — a `sendable.reasons.length` rajtuk futásidőben dobott, és ezzel
  // az ÉN változtatásom omlasztott össze egy IDEGEN őrt (outreach-row-truth-check) a
  // commit-kapuban. Egy renderelő függvény ne dőljön el egy hiányzó kiegészítő mezőn.
  const whyLines = sendable?.reasons ?? [];
  const sendableWhy =
    sendable === undefined || sendable.gate == null || sendable.gate === "legal" || !whyLines.length
      ? ""
      : `<ul class="small" style="margin:6px 0 0;color:var(--citui-warn-ink)">${whyLines
          .map((r) => `<li>${esc(r)}</li>`)
          .join("")}</ul>`;
  const sendableBlock =
    sendable === undefined
      ? ""
      : `<div class="row" style="margin-top:8px"><span class="pill pill--claim ${sendableClass}">${sendableClaim}</span></div>${sendableWhy}`;
  // ⚖️ §C.2 FELADÓ-AZONOSÍTÁS — PER FIELD, on the screen where the irreversible
  // button is (Elek FK-004 H2). The letter that went out named "TESZT Szolgáltató
  // e.v. (nem valódi)" in its footer under a green PASS badge; a flat sentence in
  // the reason list would leave the operator with eight env values to guess
  // between, so each fault says WHICH value, what the letter would PRINT, and what
  // the measurement found.
  const identity = check.identity ?? [];
  // ⛔ ONE source for both renderings: the excluded lines are the ones this very
  // list produced (identityReason), not a second regex over the sentences — a
  // predicate in two copies is two truths on one screen.
  const identityLines = new Set(identity.map(identityReason));
  const otherReasons = check.reasons.filter((r) => !identityLines.has(r));
  const reasons = otherReasons.length
    ? `<ul class="small" style="margin-top:8px;color:var(--citui-bad-ink)">${otherReasons
        .map((r) => `<li>${esc(r)}</li>`)
        .join("")}</ul>`
    : "";
  const identityBlock = identity.length
    ? // The page's own box pattern (inline border + radius), because the console
      // stylesheet has no `.card` rule — a class that does not exist renders the
      // most legally consequential block on this screen as loose text.
      `<div style="margin-top:10px;border:1px solid var(--citui-bad);border-radius:10px;padding:14px">
        <div class="row" style="margin-top:0"><b>${T(lang, "A feladó azonosítása nem szállítható")}</b> <span class="pill rejected">${T(lang, "{n} mező", { n: String(identity.length) })}</span></div>
        <p class="mut small" style="margin:6px 0 0">${T(lang, "Ezeket az értékeket a levél KINYOMTATJA (aláírás + a lábazat „A megkeresés küldője:” sora). A kapu a beállítást méri, nem a szöveget — hideg kereskedelmi levél nem mehet ki olyan azonosítással, amit a címzett nem tud visszakeresni (Grt. 6. § / Eker.tv. 4. §).")}</p>
        <ul class="small" style="margin:8px 0 0">${identity
          .map(
            (p) =>
              `<li style="margin-bottom:6px"><b>${esc(p.label)}</b> — <code>${esc(p.env)}</code>${
                p.shown
                  ? `<br>${T(lang, "a kiküldött érték:")} <span style="color:var(--citui-bad-ink)">${esc(p.shown)}</span>`
                  : `<br><span style="color:var(--citui-bad-ink)">${T(lang, "nincs beállítva")}</span>`
              }<br><span class="mut">${esc(p.detail)}</span></li>`,
          )
          .join("")}</ul>
      </div>`
    : "";
  const noticeBlock = notice
    ? `<div class="row" style="margin-top:8px"><span class="pill pill--claim ${notice.ok ? "approved" : "rejected"}">${esc(notice.text)}</span></div>`
    : "";
  // ⚠️ WHERE DO THE LETTER'S LINKS POINT? (Elek FK-004 ④.) Every link in the mail is
  // built from PUBLIC_BASE_URL, and nothing tied that host to the identity the letter
  // signs with — so a letter from "Citoviso" linking to a dev host (or, in prod, to a
  // mistyped one) looked entirely normal on this screen. The host is now stated where
  // the send decision is made, and flagged when it is not our own domain.
  const linkHost = checkOutreachLinkHost();
  const linkHostBlock = linkHost
    ? `<div class="row" style="margin-top:8px"><span class="pill pill--claim${linkHost.mismatch ? " rejected" : ""}">${
        linkHost.mismatch
          ? // ⛔ It says FIGYELMEZTETÉS because it does NOT block (Elek FK-004 Z1): a red
            // pill that reads like a verdict, directly under a green one, left the operator
            // guessing whether the irreversible button was allowed — and it WAS: the letter
            // went out with this warning on screen. A warning must say that it is one.
            T(lang, "⚠ Figyelmeztetés (nem blokkol): a levél linkjei ide mutatnak: {host} — nem a feladó domainje ({domain})", {
              host: esc(linkHost.linkHost),
              domain: esc(linkHost.senderDomain),
            })
          : T(lang, "A levél linkjei ide mutatnak: {host}", { host: esc(linkHost.linkHost) })
      }</span></div>`
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
  // ⛔ A VISSZAFORDÍTHATATLAN KÜLDÉS A LEVÉL UTÁN ÁLL (jóváhagyott terv „B",
  // assets/design-refs/console/outreach-sticky-send/ — tulajdonosi döntés 2026-09-14).
  // Mérve a régi lapon: a küldés-gomb 670 px (1280) és 1 641 px ≈ két telefon-képernyő
  // (390) távolságra állt a levél KEZDETE előtt, vagyis a kezelő azelőtt nyomta meg,
  // hogy elolvasta volna, amit kiküld. A KÁRTYA mostantól az ÁLLAPOTOT mondja; a gomb
  // a lap alján ragadó sávban él (`sendBar`), a levél alatt.
  // Pipeline send (B szelet): the button is a convenience — every guard
  // (opt-out / channel one-shot / §C) re-runs server-side in sendOutreachMail.
  const emailSendForm =
    !emailSentAt && !channel?.emailAddressMailed && pass && contactEmail
      ? `<form method="post" action="/prospect/${esc(prospectId)}/send" style="margin:0"
           onsubmit="return confirm('${esc(jsStr(T(lang, "Kiküldöd a levelet erre a címre: {email}?", { email: contactEmail })))}')">
           <button type="submit" class="con-ib">${ic("mail", 15)}${T(lang, "Küldés e-mailben — {email}", { email: esc(contactEmail) })}</button>
         </form>`
      : "";
  const sendBlock = emailSentAt
    ? doneNote(emailSentAt, T(lang, "Az e-mail már kiment:"))
    : // ADR-0122: the one-shot is ADDRESS-level. THIS ROW was never mailed, but the
      // ADDRESS was — on another tracked link of the same lead. Without this branch the
      // card shows "még nem ment ki" and a live send button the server will refuse, so
      // the operator confirms an irreversible-looking action and learns from the
      // rejection banner that it was dead — the very failure the mobile card's
      // `smsBlockedReason` exists to prevent.
      channel?.emailAddressMailed
      ? `<p class="mut small" style="margin-top:10px">${T(lang, "Erre a CÍMRE már ment hideg megkeresés egy MÁSIK követett linken — nincs újraküldés. A címzett egy ember akkor is, ha nálunk két sorban szerepel.")}</p>`
      : pass
      ? contactEmail
        ? `<p class="mut small" style="margin-top:10px">${T(lang, "A küldés gombja a lap alján ragadó sávban van, a levél ALATT — előbb olvasd el, amit kiküldesz. A gomb megnyomásakor a jogszerűségi kapu újra lefut, a rendszer elküldi a HTML-levelet, és a link „kiküldve” állapotba kerül.")}</p>
         <p class="mut small" style="margin-top:6px">${T(lang, "VAGY kézzel: másold a tárgyat és a szöveget a saját levelezőprogramodba, küldés után pedig a lead-oldalon nyomd meg a „Megjelölöm kiküldöttként” gombot — enélkül a rendszer nem tud róla, és nem is mér.")}</p>`
        : `<p class="mut small">${T(lang, "A rendszerből küldéshez előbb add meg a címzett e-mail címét a lead-oldal Megkeresés-paneljén. Addig kézzel is mehet: másold a tárgyat és a szöveget a levelezőprogramodba, küldés után pedig a „Megjelölöm kiküldöttként” gomb.")}</p>`
      : `<p class="mut small">${T(lang, "Amíg a jogszerűségi kapu fenn tartja a levelet, nem küldhető ki. A leggyakoribb ok egy hiányzó beállítás: a levél linkjeinek címe, a feladó adatai, vagy a hirdető cégazonosítása — ezeket rendszergazda tudja pótolni.")}</p>`;
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
  // `overflow-wrap:anywhere` — these boxes carry raw machine strings (a failing
  // portal URL, a transport error), and on a 390px phone an unbreakable URL ran
  // off the card: the operator saw half the reason (measured 2026-09-13).
  const failNote = (msg: string): string =>
    `<div style="margin-top:10px;background:color-mix(in srgb, var(--citui-bad) 10%, transparent);color:var(--citui-bad-ink);border-radius:8px;padding:8px 10px;overflow-wrap:anywhere" class="small">${esc(msg)}</div>`;
  // ⛔ Elek FK-004 H1 (2026-09-13): the picture the MMS carries was linked
  // unconditionally, so when it could not be produced the operator got a
  // broken-image icon — with a LIVE "Páros indítása" button right under it. The
  // send itself already refuses without the image (sendOutreachPair), so the only
  // thing missing was saying it BEFORE the click. No image → no pair, stated.
  const preview: HeroShotState = channel?.mmsPreview ?? { kind: "none" };
  const previewReady = preview.kind === "ready";
  // Ugyanaz a szótár, amit a mock-kártya is használ (heroShotFailReason) — a hiba
  // oka nem lehet két különböző mondat két képernyőn.
  const previewReason = preview.kind === "failed" ? heroShotFailReason(preview, lang) : "";
  /** Why the pair cannot start — stated on the button itself, not in a banner. */
  const pairBlocked = !channel?.phone
    ? T(lang, " (nincs szám)")
    : !previewReady
      ? T(lang, " (nincs kép)")
      : null;
  const mobileCardBody = !channel
    ? ""
    : pairDone
      ? doneNote(smsSentAt!, T(lang, "A mobil-páros kiment:"))
      : channel.smsBlockedReason
        ? `<p class="mut small" style="margin-top:10px">${esc(channel.smsBlockedReason)}</p>`
        : !pass
          ? `<p class="mut small">${T(lang, "A jogszerűségi kapu FLAG-jének rendezéséig a mobil-páros sem küldhető.")}</p>`
          : pairRunning
            ? `<p class="mut small" style="margin-top:10px">${T(lang, "Küldés folyamatban — az idővonal lent mutatja, hol tart. A lap magától frissül.")}</p>`
            : pairBroken
              ? failNote(pairJob?.error ?? T(lang, "A kísérő SMS nem ment ki — a lead LÁTTA a képet, a pár claimje marad."))
              : `${pairJob?.phase === "failed" && pairJob.error ? failNote(pairJob.error) : ""}
                 ${
                   previewReady
                     ? ""
                     : preview.kind === "running"
                       ? `<p class="mut small" style="margin-top:10px">${T(lang, "A kimenő kép még készül — amíg nem látod, a párost nem indítjuk.")}</p>`
                       : failNote(
                           T(lang, "A kimenő MMS képe nem áll elő, ezért a páros nem indítható: {reason}", {
                             reason: previewReason,
                           }),
                         )
                 }
                 ${
                   // ⛔ A TILTOTT GOMB MONDJA MEG A KIUTAT IS (Elek FK-004 Z6). A felirat
                   // „(nincs szám)"-ot írt, a gomb tiltott volt — de sehol nem derült ki,
                   // HOL lehet számot pótolni, és a kártyán nincs mező hozzá (a szám a lead
                   // adata, nem a linké). A kiút oda kerül, ahol a hiány látszik.
                   !channel.phone && leadId
                     ? `<p class="mut small" style="margin-top:10px">${T(lang, "Telefonszám nélkül a páros nem indítható. A számot a lead adatlapján, a „Begyűjtött adatok — szerkeszthető” panelen tudod megadni:")} <a href="/lead/${esc(leadId)}">${T(lang, "ugrás a lead adataihoz ▸")}</a></p>`
                     : ""
                 }
                 <p class="mut small" style="margin-top:10px">${T(lang, "A páros indítása a lap alján ragadó sávban van, a levél ALATT.")}</p>`;
  /** The mobile pair's IRREVERSIBLE action — lives in the bottom bar, never on the card. */
  const pairSendForm = !channel
    ? ""
    : pairDone || channel.smsBlockedReason || !pass || pairRunning
      ? ""
      : pairBroken
        ? `<form method="post" action="/prospect/${esc(prospectId)}/send-pair-sms" style="margin:0">
             <button type="submit">${T(lang, "SMS újra")}</button>
           </form>`
        : `<form method="post" action="/prospect/${esc(prospectId)}/send-pair" style="margin:0"
             onsubmit="return confirm('${esc(jsStr(T(lang, "Kiküldöd a párost? VALÓDI MMS (kép) + SMS (link) megy ki a címzett telefonjára, és nem vonható vissza.")))}')">
             <button type="submit"${pairBlocked ? " disabled" : ""}>${T(lang, "Páros indítása")}${pairBlocked ?? ` — ${esc(channel.phone!)}`}</button>
           </form>`;
  // Timeline states, derived from stamps + the live job (plan B contract §2/§4).
  const step1 = mmsSentAt ? "done" : pairJob?.phase === "mms" ? "run" : pairJob?.phase === "failed" && !mmsSentAt ? "fail" : "";
  const step2 = smsSentAt ? "done" : pairJob?.phase === "sms" ? "run" : pairBroken ? "fail" : "";
  const stepStyle = (s: string): string =>
    s === "done"
      ? "background:var(--citui-ok-soft);border-color:transparent;color:var(--citui-ok-ink)"
      : s === "run"
        ? "border-color:var(--citui-info);color:var(--citui-link-ink)"
        : s === "fail"
          ? "background:color-mix(in srgb, var(--citui-bad) 12%, transparent);border-color:transparent;color:var(--citui-bad-ink)"
          : "color:var(--citui-muted)";
  const badge = (label: string, s: string): string =>
    `<div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1px solid var(--citui-line-strong);font-size:13px;font-weight:600;${stepStyle(s)}">${label}</div>`;
  const timelineBlock = !channel
    ? ""
    : `<div style="border:1px solid var(--citui-line);border-radius:10px;padding:14px;margin-top:14px">
      <div style="display:grid;grid-template-columns:34px 1fr;gap:10px;padding:6px 0;border-bottom:1px dashed var(--citui-line)">
        ${badge("1", step1)}
        <div><b class="small">${T(lang, "MMS — a látványterv képe")}</b>
          <p class="mut small" style="margin:3px 0 0">${T(lang, "~60–90 másodperc a modemen; közben az SMS-küldés szünetel, a várakozó üzenetek sorban maradnak (nem vesznek el). A feladó a gép fő SIM-kártyája.")}</p>
          ${
            previewReady
              ? `<img src="/prospect/${esc(prospectId)}/mms-preview.jpg" alt="${T(lang, "a kimenő MMS képe")}" style="max-width:190px;border-radius:8px;border:1px solid var(--citui-line);margin-top:6px;display:block">`
              : preview.kind === "running"
                ? `<p class="small" id="cit-mms-prev-run" style="margin:6px 0 0;color:var(--citui-link-ink)">${T(lang, "A kimenő kép készül a látványtervből — a lap magától megmutatja, amint megvan.")}</p>`
                : `<div id="cit-mms-prev-fail" style="margin-top:6px;background:color-mix(in srgb, var(--citui-bad) 10%, transparent);color:var(--citui-bad-ink);border-radius:8px;padding:8px 10px;overflow-wrap:anywhere" class="small">
                     ${T(lang, "⛔ NINCS KIMENŐ KÉP — {reason}. Amíg nem látod a képet, a páros nem indítható (MMS kép nélkül nincs értelme).", { reason: previewReason })}
                   </div>
                   <form method="post" action="/prospect/${esc(prospectId)}/mms-preview" style="margin-top:8px">
                     <button type="submit">${T(lang, "Kép előállítása újra")}</button>
                   </form>`
          }
          ${step1 === "done" ? `<p class="small" style="margin:4px 0 0;color:var(--citui-ok-ink)">✓ ${T(lang, "az MMSC befogadta")}${pairJob?.mmsMessageId ? ` — message-id: ${esc(pairJob.mmsMessageId.slice(0, 8))}…` : ""}</p>` : ""}
          ${step1 === "run" ? `<p class="small" style="margin:4px 0 0;color:var(--citui-link-ink)">⏳ ${T(lang, "feltöltés a modemen…")}</p>` : ""}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:34px 1fr;gap:10px;padding:10px 0;border-bottom:1px dashed var(--citui-line)">
        ${badge("2", step2)}
        <div><b class="small">${T(lang, "Kísérő SMS — az élő link (a jogi kötelezők a linkelt oldalon)")}</b>
          <div id="smsbody" style="font:12.5px/1.5 ui-monospace,monospace;border:1px solid var(--citui-line);border-radius:8px;padding:8px;margin-top:6px;word-break:break-word;white-space:pre-wrap">${esc(smsText)}</div>
          <p class="mut small" style="margin:4px 0 0">${T(lang, "A szöveg meghívás; a jogalap-tájékoztatás és a leiratkozás a megnyitott előnézet-oldal lábában van.")}</p>
          ${step2 === "done" ? `<p class="small" style="margin:4px 0 0;color:var(--citui-ok-ink)">✓ ${T(lang, "az SMS elment — a pár teljes.")}</p>` : ""}
          ${step2 === "fail" ? `<p class="small" style="margin:4px 0 0;color:var(--citui-bad-ink)">⛔ ${T(lang, "a lépés hangosan bukott — fent az „SMS újra” gomb.")}</p>` : ""}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:34px 1fr;gap:10px;padding:10px 0 4px">
        ${badge("✓", pairDone ? "done" : "")}
        <div><b class="small">${T(lang, "A pár = EGY megkeresés")}</b>
          <p class="mut small" style="margin:3px 0 0">${T(lang, "Egy foglalás, egy ellenőrzés-sor: leiratkozás, jogszerűségi kapu, a mock ellenőrzései, a 8–20 óra közti küldési ablak és az engedélyezett számok listája. Újraküldés nincs.")}</p>
        </div>
      </div>
    </div>
    ${pairRunning ? `<script>setTimeout(function(){location.replace(location.pathname)},4000)</script>` : ""}
    ${
      // The image render is followed by POLLING a state endpoint, not by a periodic
      // reload: the draft page carries the post-send notice in its query string
      // (?kuldes=…), and a timed reload of `location.pathname` would erase the very
      // confirmation the operator just earned. One reload, when the state changes.
      preview.kind === "running"
        ? `<script>
        (function(){
          var u = "/prospect/${esc(prospectId)}/mms-preview-state";
          var t = setInterval(function(){
            fetch(u, { credentials: "same-origin" })
              .then(function(r){ return r.json(); })
              .then(function(s){ if (s && s.kind !== "running") { clearInterval(t); location.replace(location.href); } })
              .catch(function(){});
          }, 3000);
        })();
      </script>`
        : ""
    }`;
  const statePill = (sentAt: string | null, addressMailed = false): string =>
    sentAt
      ? `<span class="pill approved">${T(lang, "kiküldve")}</span>`
      : // ADR-0122: THIS row was never mailed, but the ADDRESS was. A bare "még nem ment
        // ki" next to the explanation below would be the same half-truth the lead
        // header carried — technically about the row, read as "this can still go out".
        addressMailed
        ? `<span class="pill approved">${T(lang, "a CÍMRE már ment ki")}</span>`
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
    !channel?.smsBlockedReason &&
    // …and the MMS actually HAS a picture. This button starts the pair too, so
    // without the image it would promise exactly what the server then refuses.
    previewReady;
  const allBlock = bothStartable
    ? `<form method="post" action="/prospect/${esc(prospectId)}/send-all" style="margin:0"
         onsubmit="${esc(`if(!confirm('${jsStr(T(lang, "Kiküldöd MINDKÉT csatornán? VALÓDI e-mail + MMS (kép) + SMS (link) megy ki, és nem vonható vissza."))}'))return false;var b=this.querySelector('button');b.disabled=true;b.textContent='${jsStr(T(lang, "Küldés folyamatban…"))}'`)}">
         <button type="submit">${T(lang, "Indítás MINDKÉT csatornán — e-mail + MMS+SMS páros")}</button>
       </form>`
    : "";
  const channelBlock = `<div style="margin-top:10px">
      <div class="small mut" style="margin-bottom:6px">${T(lang, "Küldési csatorna — állapot és címzett (a két csatorna külön-külön egyszer küldhető); a KÜLDÉS a lap alján, a levél alatt:")}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px">
        <div style="border:1px solid var(--citui-line);border-radius:10px;padding:14px">
          <div class="row" style="margin-top:0"><b>E-mail</b> ${statePill(emailSentAt, Boolean(channel?.emailAddressMailed))} ${contactEmail ? `<span class="pill approved">${T(lang, "cím megvan")}</span>` : `<span class="pill">${T(lang, "nincs cím")}</span>`}</div>
          ${
            // ⛔ KÜLDÉS UTÁN A CÍM NEM SZERKESZTHETŐ (Elek FK-004 Z7). A mező és a „Cím
            // mentése" gomb a „kiküldve" jelvény ALATT is aktív maradt, ami azt sugallta,
            // hogy a levél célja még módosítható — holott a levél már elment, és ezen a
            // csatornán nincs újraküldés. A cím olvashatóan MEGMARAD (tudni kell, hova
            // ment), de űrlapként nem kínáljuk fel.
            emailSentAt
              ? `<p class="mut small" style="margin-top:8px">${T(lang, "A levél erre a címre ment ki: {email} — a cím módosítása ezen már nem változtat.", { email: esc(contactEmail ?? "—") })}</p>`
              : `<form method="post" action="/prospect/${esc(prospectId)}/contact-email" class="row" style="margin-top:8px;gap:8px;flex-wrap:wrap">
            <input type="email" name="email" value="${contactEmail ? esc(contactEmail) : ""}" placeholder="${T(lang, "címzett e-mail címe")}" style="flex:1;min-width:220px;padding:7px 9px">
            <button type="submit">${T(lang, "Cím mentése")}</button>
          </form>`
          }
          ${sendBlock}
        </div>
        <div style="border:1px solid var(--citui-line);border-radius:10px;padding:14px">
          <div class="row" style="margin-top:0"><b>${T(lang, "Mobil-megkeresés")}</b> ${mobilePill} ${channel?.phone ? `<span class="pill approved">${esc(channel.phone)}</span>` : `<span class="pill">${T(lang, "nincs szám")}</span>`}</div>
          <p class="mut small" style="margin:6px 0 0">${T(lang, "MMS+SMS páros — a lépések lent, indítás után élőben követhető. Önálló hideg SMS nincs többé: link kép nélkül = phishing-gyanú.")}</p>
          ${mobileCardBody}
        </div>
      </div>
    </div>`;
  // ── THE STICKY SEND BAR (approved plan "B", 2026-09-14) ───────────────────
  // Every state-writing send lives HERE, below the letter, and follows the operator
  // down the page. ⛔ It is rendered OUTSIDE the `.panel`: the console stylesheet has
  // `.con .panel { overflow-x: hidden }`, which makes the panel a scroll container —
  // a `position: sticky` inside it would stick to the PANEL's box, not the screen, and
  // be silent scenery. (Same trap as the tenant-admin card measured 2026-09-11.)
  const sendActions = `${allBlock}${emailSendForm}${pairSendForm}`;
  const sendBar = sendActions
    ? // ⛔ FAIL-SAFE DIRECTION: the server renders the buttons ENABLED and the SCRIPT
      // locks them. A dead script then costs the gate, never the operator's ability to
      // work — and the real guarantee is the server-side §C gate that re-runs on POST.
      // Rendering `disabled` here would mean a broken script permanently claims
      // "not sendable", which is the more expensive lie.
      `<div class="con-sendbar" data-cit-sendbar="open">
        ${sendActions}
        <span class="con-sendbar__why" id="cit-sendbar-why">${T(lang, "A küldés nem vonható vissza, és ezen a csatornán csak egyszer megy ki.")}</span>
      </div>
      <script>
        (function () {
          var bar = document.querySelector("[data-cit-sendbar]");
          var end = document.getElementById("cit-letter-end");
          var why = document.getElementById("cit-sendbar-why");
          if (!bar || !end || typeof IntersectionObserver !== "function") return;
          var btns = bar.querySelectorAll("button[type=submit]");
          if (!btns.length) return;
          /* Buttons the server itself disabled (no phone / no picture) must STAY
             disabled — the gate may only ADD a lock, never grant one. */
          var lockable = [];
          for (var i = 0; i < btns.length; i++) if (!btns[i].disabled) lockable.push(btns[i]);
          if (!lockable.length) return;
          var LOCKED = ${JSON.stringify(T(lang, "Zárva: a levél végét (leiratkozás + jogalap) még nem láttad — görgess végig a levélen."))};
          var OPEN = ${JSON.stringify(T(lang, "A levél végét láttad — a küldés nyitva. Nem vonható vissza, és ezen a csatornán csak egyszer megy ki."))};
          var set = function (on) {
            for (var j = 0; j < lockable.length; j++) lockable[j].disabled = !on;
            bar.setAttribute("data-cit-sendbar", on ? "open" : "locked");
            if (why) why.textContent = on ? OPEN : LOCKED;
          };
          set(false);
          new IntersectionObserver(function (es) {
            for (var k = 0; k < es.length; k++) if (es[k].isIntersecting) set(true);
          }, { threshold: 0 }).observe(end);
        })();
      </script>`
    : "";
  const body = `
    ${verdictConfirm ? verdictConfirmDialog(prospectId, verdictConfirm) : ""}
    ${leadId ? `<a class="con-back" href="/lead/${esc(leadId)}"><span aria-hidden="true">←</span> Vissza a leadhez</a>` : ""}
    <div class="panel">
      <h2>${T(lang, "Megkeresés-piszkozat")} — ${esc(input.leadName)}${input.segment ? ` <span class="pill">${esc(segmentLabel(input.segment, lang))}</span>` : ""} ${helpLink("console.outreach_draft")}</h2>
      ${sendableBlock}
      <div class="row">${verdict}</div>
      ${noticeBlock}
      ${linkHostBlock}
      ${reasons}
      ${identityBlock}
      ${channelBlock}
      <div style="margin-top:14px">
        <label class="small mut">${T(lang, "Tárgy")}</label>
        <div class="row" style="margin-top:4px">
          <input id="subj" type="text" readonly value="${esc(draft.subject)}" style="flex:1;min-width:320px">
          <button type="button" onclick="${esc(`navigator.clipboard.writeText(document.getElementById('subj').value);this.textContent='${jsStr(T(lang, "másolva"))}'`)}">${emailSentAt ? T(lang, "másolás (már kiment)") : T(lang, "másolás")}</button>
        </div>
      </div>
      <div style="margin-top:14px">
        <label class="small mut">${T(lang, "Így néz ki a levél a címzett postafiókjában (HTML-előnézet)")}</label>
        <iframe id="cit-mailprev" src="/prospect/${esc(prospectId)}/email-preview" title="${T(lang, "E-mail előnézet")}"
          scrolling="no" onload="citFitMailPreview(this)" data-cit-mailprev="1"
          style="width:100%;height:1500px;border:1px solid var(--citui-line-strong);border-radius:10px;background:var(--citui-white);margin-top:4px"></iframe>
        <script>
          /* ⛔ THE PREVIEW MUST SHOW THE WHOLE LETTER (Elek FK-004 ①). It used to be a
             fixed 560px frame, which cut the letter off at the sign-off line — the
             signature, the small print, THE UNSUBSCRIBE LINK and the legal-basis footer
             were all below the fold, with no visible scrollbar. The operator was
             therefore approving an irreversible cold message to a stranger without ever
             reading the part that makes it lawful (§C.1/§C.2).

             Fail-safe direction: the inline height is a generous FLOOR that shows the
             whole letter even with no JS at all, and this handler then fits the frame
             exactly to its content (same-origin, so scrollHeight is readable). A dead
             script costs whitespace, never a truncated letter.
             Guard: scripts/outreach-preview-check.mts */
          function citFitMailPreview(f) {
            try {
              var d = f.contentDocument;
              if (!d || !d.documentElement) return;
              var fit = function () {
                /* ⚠️ Measure the CONTENT, never documentElement.scrollHeight: that one
                   is floored at the frame's own viewport height, so growing the frame
                   grows the number and the fitter chases its own tail. The letter's
                   ink extent is the bottom of the last child of <body>. */
                var h = 0;
                if (d.body) {
                  h = d.body.scrollHeight || 0;
                  var kids = d.body.children;
                  for (var k = 0; k < kids.length; k++) {
                    h = Math.max(h, Math.ceil(kids[k].getBoundingClientRect().bottom));
                  }
                }
                if (h > 0) f.style.height = h + 2 + "px";
              };
              fit();
              /* the hero screenshot arrives after onload and changes the height */
              if (typeof ResizeObserver === "function" && d.body) new ResizeObserver(fit).observe(d.body);
              var imgs = d.images || [];
              for (var i = 0; i < imgs.length; i++) imgs[i].addEventListener("load", fit);
            } catch (e) {
              /* blocked: the inline floor already shows the whole letter */
            }
          }
        </script>
        <div class="row" style="margin-top:4px">
          <a class="small" href="/prospect/${esc(prospectId)}/email-preview" target="_blank">${T(lang, "előnézet külön lapon ▸")}</a>
        </div>
      </div>
      <div style="margin-top:12px">
        ${
          // ⛔ A KÉZI ÚT KÜLDÉS UTÁN IS KÍNÁLVA MARADT (Elek FK-004 Z4). A gomb tiltása
          // önmagában féligazság: ugyanezen a lapon lejjebb ott a teljes levél-szöveg és a
          // „szöveg másolása" gomb, tehát a felület a MEGISMÉTLÉST ugyanúgy felkínálja, mint
          // küldés előtt — semmi nem mondta, hogy az a levél MÁSODIK példánya lenne. A szöveg
          // MARAD (az operátornak joga van elolvasni, mi ment ki), de a keret megmondja, mit
          // jelent most a másolás. A figyelmeztetés a KATTINTÁS ELŐTT áll, nem utólagos
          // visszautasításként (ADR-0122 tanulsága: az ígéret alanya az EMBER, nem a rekord).
          emailSentAt
            ? `<div class="row" style="margin-top:0"><span class="pill rejected">${T(
                lang,
                "⚠ Ez a levél már kiment — a másolás a MÁSODIK példányt jelentené a címzettnek",
              )}</span></div>
            <label class="small mut">${T(lang, "A KIKÜLDÖTT levél szövege (olvasásra; kézi újraküldés nélkül)")}</label>`
            : `<label class="small mut">${T(lang, "Levél szövege (text-változat — kézi küldéshez másolható)")}</label>`
        }
        <div style="margin-top:4px">
          ${
            // ⛔ NINCS GÖRGETŐ DOBOZ, EZÉRT NINCS MIT LEVÁGNI (jóváhagyott terv „B" ①).
            // A régi `rows="22"` textarea 445 px-et mutatott: 390 px-en a levél 61 %-a
            // (702/1147 px) esett alá — az aláírás, a leiratkozó mondat, a leiratkozó URL
            // és a HIRDETŐ-AZONOSÍTÁS (§C.2) —, 1280 px-en pedig az azonosítás. Ez nem
            // „nagyobb doboz": egy `<pre>`-nek nincs scrollportja, tehát a hibaosztály
            // JS-sel és JS NÉLKÜL is megszűnik. A vágott előnézet mindig a VÉGÉT veszi el,
            // és a jogi rész ott van.
            `<pre id="mailbody" class="con-mailtext">${esc(draft.body)}</pre>`
          }
        </div>
        <div class="row" style="margin-top:6px">
          <button type="button" onclick="${esc(
            emailSentAt
              ? `if(!confirm('${jsStr(T(lang, "Ez a levél már kiment erre a címre. A másolás a MÁSODIK példányhoz vezethet. Biztosan másolod?"))}'))return;navigator.clipboard.writeText(document.getElementById('mailbody').textContent);this.textContent='${jsStr(T(lang, "másolva"))}'`
              : `navigator.clipboard.writeText(document.getElementById('mailbody').textContent);this.textContent='${jsStr(T(lang, "másolva"))}'`,
          )}">${emailSentAt ? T(lang, "szöveg másolása (már kiment)") : T(lang, "szöveg másolása")}</button>
          <a class="small" href="${esc(draft.link)}" target="_blank">${T(lang, "követett link megnyitása ▸")}</a>
        </div>
      </div>
      <!-- A levél VÉGE. Az alsó sáv kapuja erre az elemre néz: amíg ez nem járt a
           képernyőn, a visszafordíthatatlan küldés zárva marad. -->
      <div id="cit-letter-end" style="height:1px"></div>
      ${timelineBlock}
      ${
        // ⑤ A lap alján is van visszaút — a régi lapon a `con-back` CSAK a tetején állt,
        // és 390 px-en a lap 4 021 px hosszú volt.
        leadId
          ? `<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--citui-line)">
               <a class="con-back" href="/lead/${esc(leadId)}" style="margin:0"><span aria-hidden="true">←</span> ${T(lang, "Vissza a leadhez")}</a>
             </div>`
          : ""
      }
    </div>
    ${sendBar}`;
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
  // ⛔ TWO fixes here (Elek FK-004b, 2026-09-13):
  //
  //  · A LABEL MUST NAME WHAT IT COUNTS. "Megnyitások" stood over "{v} látogatás ·
  //    {e} esemény": three nouns for two numbers, so the operator could not tell
  //    which number the heading referred to, and the row carried two different
  //    units at once. One row, one unit, and the word in the value is the word in
  //    the label.
  //
  //  · "–" DID NOT DECIDE BETWEEN "NOTHING HAPPENED" AND "WE NEVER MEASURED". A
  //    prospect who never opened the link and one who opened it and did not scroll
  //    rendered the SAME dash — opposite facts on the operator's screen. The two
  //    are distinguishable in the data (no session at all vs. a session with a zero
  //    maximum), so they are stated apart: 0 % is a measurement, "nem mértünk" is
  //    the absence of one. A choice that was never made is neither — it says so.
  const opened = a.sessions.length > 0;
  const unmeasured = `<span class="mut">${T(lang, "nem mértünk")}</span>`;
  const unchosen = `<span class="mut">${T(lang, "nem választott")}</span>`;
  const signals = [
    `<dt>${T(lang, "Megnyitások")}</dt><dd>${T(lang, "{v} megnyitás", { v: a.sessions.length })}</dd>`,
    `<dt>${T(lang, "Rögzített események")}</dt><dd>${T(lang, "{e} esemény", { e: totalEvents })}</dd>`,
    `<dt>${T(lang, "Legmélyebb görgetés")}</dt><dd>${opened ? `${bestScroll}%` : unmeasured}</dd>`,
    `<dt>${T(lang, "Leghosszabb olvasás")}</dt><dd>${opened ? T(lang, "{s} másodperc", { s: bestDwell }) : unmeasured}</dd>`,
    `<dt>${T(lang, "Választott csomag")}</dt><dd>${a.preset ? `<b>${esc(a.preset)}</b>` : unchosen}</dd>`,
    `<dt>${T(lang, "Fizetési ciklus")}</dt><dd>${a.period ? (a.period === "annual" ? T(lang, "éves") : T(lang, "havi")) : unchosen}</dd>`,
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

/** The operator's wall clock. The PRODUCTION machine runs on UTC (timedatectl:
 *  "Local time: … UTC"), so a bare toLocaleString() printed 6:49:59 for a scrape
 *  the operator started at 8:49:59 — the column headed "Indult" was two hours off
 *  on every row, and the owner read it to reason about what happened when. The
 *  zone belongs to the READER, so it is named here, not inherited from whichever
 *  machine happens to render. */
const CONSOLE_TZ = "Europe/Budapest";

function consoleDateTime(d: Date | string, lang: string): string {
  return new Intl.DateTimeFormat(lang === "hu" ? "hu-HU" : lang, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: CONSOLE_TZ,
  }).format(typeof d === "string" ? new Date(d) : d);
}

function consoleTime(d: Date | string, lang: string): string {
  return new Intl.DateTimeFormat(lang === "hu" ? "hu-HU" : lang, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: CONSOLE_TZ,
  }).format(typeof d === "string" ? new Date(d) : d);
}

/** What the status column SAYS, derived from what the row IS. 'failed' covers two
 *  different stories — a run that broke on its own, and a run that was killed from
 *  the outside — and the operator's next move differs (investigate vs. simply start
 *  it again), so `stats.interrupted` (data, not prose) decides which is shown. */
function scrapeStatusLabel(
  r: ScrapeRunView,
  lang: string,
): { text: string; cls: string } {
  const interrupted = (r.stats as { interrupted?: boolean }).interrupted === true;
  if (r.status === "running") return { text: T(lang, "fut"), cls: "" };
  if (r.status === "completed") return { text: T(lang, "lefutott"), cls: "approved" };
  if (r.status === "failed")
    return interrupted
      ? { text: T(lang, "megszakadt"), cls: "rejected" }
      : { text: T(lang, "hibára futott"), cls: "rejected" };
  return { text: T(lang, "várakozik"), cls: "" };
}

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
    ? `<p class="mut">${T(lang, "Fut: {region} (indult: {time}) — az oldal 3 mp-enként frissül.", { region: `<strong>${esc(job.regionId ?? "?")}</strong>`, time: job.startedAt ? consoleTime(job.startedAt, lang) : "?" })}</p>`
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
      const s = r.stats as { players?: number; leads?: number; phase?: string };
      const st = scrapeStatusLabel(r, lang);
      // The sentence the row owes the operator — WHERE a running scrape stands, or
      // WHY a stopped one stopped. It lives in a full-width line UNDER the row, not
      // in a last column: on a 390px screen the table scrolls sideways, so the old
      // "Hiba" column was off-screen — the phone showed "megszakadt" and a tall empty
      // gap where the explanation was (measured 2026-09-13). The owner reads this on
      // his phone; an explanation he must scroll sideways for is not an explanation.
      const note =
        r.status === "running"
          ? `${s.phase ?? T(lang, "indulás")}${
              r.heartbeatAt
                ? ` · ${T(lang, "életjel: {time}", { time: consoleTime(r.heartbeatAt, lang) })}`
                : ""
            }`
          : (r.error ?? "");
      const noteRow = note
        ? `<tr><td colspan="5" class="small mut rownote"><span>${esc(note)}</span></td></tr>`
        : "";
      return `<tr><td>${esc(r.regionLabel)}</td>
        <td><span class="pill ${st.cls}">${esc(st.text)}</span></td>
        <td>${r.startedAt ? consoleDateTime(r.startedAt, lang) : "–"}</td>
        <td>${s.players ?? "–"}</td><td>${s.leads ?? "–"}</td></tr>${noteRow}`;
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
      <div class="tblwrap"><table><thead><tr><th>${T(lang, "Régió")}</th><th>${T(lang, "Státusz")}</th><th>Indult</th><th>${T(lang, "Szereplő")}</th><th>Lead</th></tr></thead>
      <tbody>${runRows || `<tr><td colspan="5" class="mut">${T(lang, "Még nincs futás.")}</td></tr>`}</tbody></table></div>
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
    <thead><tr><th>${T(lang, "Kérdés")}</th><th>${T(lang, "Mérőszám")}</th><th>${T(lang, "Cél")}</th><th>${T(lang, "Most")}</th></tr></thead>
    <tbody>
      <tr><td>${T(lang, "Megfogja-e a levél")}</td><td>${T(lang, "megnyitás / kiküldött")}</td><td>${T(lang, "érdemben magasabb a sima szövegnél")}</td><td>${pct(t.openedOfSent, t.sent)} (${t.openedOfSent}/${t.sent})</td></tr>
      <tr><td>${T(lang, "Visszatér-e")}</td><td>${T(lang, "visszatérő / megnyitó")}</td><td>${T(lang, "> ~30%")}</td><td>${pct(t.returned, t.opened)} (${t.returned}/${t.opened})</td></tr>
      <tr><td>${T(lang, "Belenyúl-e a modulokba")}</td><td>${T(lang, "modul-hozzáadó / megnyitó")}</td><td>${T(lang, "> ~20%")}</td><td>${pct(t.moduleTouched, t.opened)} (${t.moduleTouched}/${t.opened})</td></tr>
      <tr><td>${T(lang, "Melyik körnél működik")}</td><td>${T(lang, "rendelni kezdők aránya szegmensenként")}</td><td>${T(lang, "a „nincs honlap” és a „0 lábnyom” körnek magasabb")}</td><td>${T(lang, "lásd lenti bontás")}</td></tr>
      <tr><td>${T(lang, "Megrendeli-e")}</td><td>${T(lang, "rendelni kezdők / kiküldött")}</td><td>${T(lang, "> ~3–5%")}</td><td>${pct(t.orderIntentOfSent, t.sent)} (${t.orderIntentOfSent}/${t.sent})</td></tr>
    </tbody></table>`;
  const segRows = r.segments.map((s) => funnelRow(s.segment, s)).join("");
  const head = `<thead><tr><th>${T(lang, "Szegmens")}</th><th>${T(lang, "Követett link")}</th><th>${T(lang, "Kiküldve")}</th><th>${T(lang, "Megnyitva")}</th><th>${T(lang, "Visszatért")}</th><th>${T(lang, "Modult próbált")}</th><th>${T(lang, "Rendelni kezdett")}</th><th>${T(lang, "Konvertált")}</th><th>${T(lang, "Leiratk.")}</th></tr></thead>`;
  const body = `
    <div class="panel">
      <h2>${T(lang, "Megkeresés-tölcsér — hol akadnak el")} ${helpLink("console.report")}</h2>
      <p class="mut small">${T(lang, "Alap-készlet: {players} felmért szereplő · {leads} kvalifikált lead · {mocks} mock ({approved} jóváhagyott) · {prospects} követett link.", { players: r.leadTotals.players, leads: r.leadTotals.leads, mocks: r.leadTotals.mocks, approved: r.leadTotals.approved, prospects: t.prospects })}</p>
      <div class="tblwrap">${hyp}</div>
    </div>
    <div class="panel">
      <h2>${T(lang, "Szegmens-bontás — melyik körnél működik")}</h2>
      <div class="tblwrap"><table>${head}<tbody>${funnelRow(T(lang, "ÖSSZES"), t)}${segRows}</tbody></table></div>
      <p class="mut small">${T(lang, "A tölcsér sosem lép vissza: a szám azt jelenti, hogy a lead LEGALÁBB eddig eljutott.")}</p>
    </div>`;
  return layout(T(lang, "Megkeresés-riport"), body, { active: "/report" });
}

/** Live counts for the hub's finance card + attention chips. */
export interface FinanceCounts {
  readonly docs: number;
  readonly open: number;
  readonly overdue: number;
  readonly partners: number;
  /** Current-year HUF net revenue counting toward the AAM cap + the cap. */
  readonly aamYearNetHuf: number;
  readonly aamLimitHuf: number;
  /** Non-HUF outgoing docs excluded from the sum (no FX rate stored). */
  readonly aamFxDocs: number;
}

/** One submenu entry on a hub module card. */
interface HubSub {
  readonly n: string;
  readonly href: string;
  readonly b?: string;
  readonly bClass?: string;
  /** What the badge NUMBER counts — a bare total next to a link that opens a
   *  differently-filtered list reads as a contradiction (Elek FK-003). */
  readonly bTitle?: string;
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
  /** Module-sales badge: sellable / total catalogue count (frozen plan). */
  sales: { on: number; all: number } = { on: 0, all: 0 },
  /** Test surface lagging behind origin/main, with the files blocking the sync
   *  (2026-09-08: it lagged 19 commits for two days and only a log file knew). */
  stale: { behind: number; dirtyFiles: readonly string[] } | null = null,
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
        {
          n: "Lead-sor",
          href: "/leads?all=1",
          b: String(r.leadTotals.players),
          // The badge and the list it opens must not contradict each other: this is
          // the WHOLE scraped stock, while a bare /leads is pre-filtered (Elek FK-003).
          bTitle: T(lang, "{n} felmért szereplő összesen, a diszkvalifikáltakkal együtt — a link a szűretlen AKTÍV listát nyitja, a diszkvalifikáltak külön nézetben vannak", { n: r.leadTotals.players }),
        },
        { n: T(lang, "Jóváhagyott mockok"), href: "/leads?mock=approved", b: `${r.leadTotals.approved}` },
        { n: T(lang, "Duplikátumok"), href: "/duplicates" },
        { n: T(lang, "Adatgyűjtés indítása"), href: "/scrape", b: scrapeRunning ? "FUT" : undefined, bClass: "approved" },
        { n: T(lang, "Térkép (lefedettség)"), href: "/scrape/map" },
        { n: T(lang, "Területek"), href: "/scrape/regions" },
        {
          n: T(lang, "Árazás és értékesítés"),
          href: "/pricing",
          b: T(lang, "{on}/{all} eladó", { on: String(sales.on), all: String(sales.all) }),
          bClass: sales.on < sales.all ? "rejected" : "approved",
        },
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
      ],
    },
    {
      icon: "report",
      title: "Riport",
      role: T(lang, "Mi termel és mi szivárog — a döntéshez elég szám."),
      open: "/report",
      subs: [
        { n: T(lang, "Megkeresés-tölcsér — hol akadnak el"), href: "/report" },
        { n: T(lang, "Kiküldött megkeresések"), href: "/report", b: String(r.total.sent) },
        { n: T(lang, "Megkezdett rendelések"), href: "/report", b: String(r.total.orderIntent) },
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

  // AAM cap meter (owner, 2026-09-06): silent below 80% — from there a warn
  // chip, from 100% red. Crossing means the crossing invoice is FULLY taxable
  // + a 15-day NAV report, so the operator must see it coming.
  const aamPct = Math.round((fin.aamYearNetHuf / fin.aamLimitHuf) * 100);
  const aamMillions = (n: number) => (n / 1e6).toFixed(1).replace(".", ",");
  const aamChip =
    aamPct >= 80
      ? `<a class="con-chip ${aamPct >= 100 ? "con-chip--bad" : "con-chip--warn"}" href="/documents"` +
        (fin.aamFxDocs
          ? ` title="${esc(T(lang, "+{n} nem-HUF bizonylat nincs beszámítva (nincs árfolyam)", { n: fin.aamFxDocs }))}"`
          : "") +
        `><span class="led"></span>${T(lang, "AAM-limit")}: <b>${aamPct}%</b> (${aamMillions(fin.aamYearNetHuf)} / ${aamMillions(fin.aamLimitHuf)} M Ft)</a>`
      : "";

  // TEST-SURFACE STALENESS — the loudest chip on the page, because every other
  // number here describes a system the operator may not actually be looking at.
  // Silent when current; when blocked it names the file to clear, so the fix is
  // one step away instead of a log-file expedition.
  const staleChip = stale
    ? `<a class="con-chip con-chip--bad" href="/help?topic=console.dashboard"` +
      ` title="${esc(
        stale.dirtyFiles.length
          ? T(lang, "A frissítést blokkolja: {list}", { list: stale.dirtyFiles.join(", ") })
          : T(lang, "A frissítés nem futott le."),
      )}"><span class="led"></span>${T(lang, "⚠ A tesztfelület {n} committal elmarad", { n: stale.behind })}${
        stale.dirtyFiles.length ? ` — ${esc(stale.dirtyFiles[0]!)}` : ""
      }</a>`
    : "";

  const chips = [
    staleChip,
    aamChip,
    fin.overdue
      ? `<a class="con-chip con-chip--bad" href="/documents?paid=0"><span class="led"></span><b>${fin.overdue}</b> ${T(lang, "lejárt számla")}</a>`
      : "",
    fin.open
      ? `<a class="con-chip con-chip--warn" href="/documents?paid=0"><span class="led"></span><b>${fin.open}</b> nyitott bizonylat</a>`
      : "",
    // Counts EXACTLY what /leads shows when clicked — same predicate, one source
    // (defaultLeadQuery). The old chip counted qualification alone and said 267 next
    // to a list that said 260, with nothing explaining the gap (Elek FK-003).
    `<a class="con-chip" href="/leads" title="${esc(T(lang, "Nincs vagy elavult honlapja van, és legalább 1 összegyűjtött képe (Anyag) — pontosan az a lista, ami a linkre kattintva nyílik."))}"><span class="led"></span><b>${r.leadTotals.leads}</b> ${T(lang, "kvalifikált lead")}</a>`,
    `<a class="con-chip${scrapeRunning ? " con-chip--ok" : ""}" href="/scrape"><span class="led"></span>${T(lang, "adatgyűjtés")}: ${scrapeRunning ? T(lang, "fut") : T(lang, "áll")}</a>`,
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
            (s) => `<li><a class="con-sub" href="${s.href}" data-n="${esc(s.n)}"${s.bTitle ? ` title="${esc(s.bTitle)}"` : ""}>
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
  /** Súgó-kategória (kbCategories.ts) — a lista EBBŐL csoportosít. */
  readonly category: string;
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
  // A lista MUNKAFOLYAMAT szerint csoportosul (tulajdonosi döntés, 2026-09-12) — 35
  // cikk egyetlen falban olvashatatlan volt. A csoport a cikk `category` ADATÁBÓL jön
  // és a kategória-regiszter SORRENDJÉBEN áll, nem a nézetbe írt slug-listából: egy új
  // cikk így nem tud némán kicsúszni a szerkezetből (a kb-check kötelezi a mezőt).
  // A tenant-csoportok megtartják a jelölést, hogy az operátor lássa: ezt az ügyfél is olvassa.
  const sections: ReadonlyArray<{ label: string; tag: string | null; topics: KbTopicView[] }> = [
    ...kbCategoriesFor("operator").map((c) => ({
      label: T(lang, c.label),
      tag: null,
      topics: help.operatorTopics.filter((t) => t.category === c.id),
    })),
    ...kbCategoriesFor("tenant").map((c) => ({
      label: T(lang, c.label),
      tag: T(lang, "ügyfél is látja"),
      topics: help.tenantTopics.filter((t) => t.category === c.id),
    })),
  ].filter((s) => s.topics.length > 0);
  const articleCount = sections.reduce((n, s) => n + s.topics.length, 0);
  // ÖSSZECSUKHATÓ csoport — JÓVÁHAGYOTT terv (assets/design-refs/console/help-start/).
  // ⛔ `<details>`, nem kattintás-kezelő div: a súgó JS NÉLKÜL is működik (a keresése is
  // sima GET), és egy összecsukott lista, amit csak JS tud kinyitni, no-JS-en HASZNÁLHATATLAN
  // súgót adna. A nyitás/csukás így natív, a „Mindet kinyitom/becsukom" a JS-es ráadás.
  // ⛔ AZ ELSŐ CSOPORT NYITVA ÉRKEZIK (2026-09-13 tulaj-döntés, felülírja a 09-12-i „mind
  // csukva" pontot): mind a kilenc csukva NULLA cikkcímet mutatott, miközben a jobb hasáb
  // „Válassz témát a listából"-t kért — a felület olyat kért, amit maga nem kínált.
  // KERESÉSKOR MIND NYITVA: a találatos csoport `open`-nel renderel — különben a lap „N
  // találatot" állítana, és közben csukott fejléceket mutatna. Mindkettő SZERVER-oldalon
  // dől el, ezért JS nélkül is igaz.
  const searching = help.query.trim() !== "";
  const group = (
    s: { label: string; tag: string | null; topics: readonly KbTopicView[] },
    i: number,
  ): string =>
    `<details class="con-kb-g"${searching || i === 0 ? " open" : ""}>` +
    `<summary class="con-kb-ghead">${esc(s.label)} <span class="n">${s.topics.length}</span>` +
    `${s.tag ? ` <span class="tag">${esc(s.tag)}</span>` : ""}` +
    `<svg class="cv" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>` +
    `</summary>${s.topics.map(topicLink).join("")}</details>`;
  // ⛔ ÜRES LISTA: a „Nincs találat a keresésre" mondat csak akkor igaz, ha tényleg KERESTÜNK.
  // Keresés nélküli üres tudástárnál (fixture, friss telepítés) a felület olyan műveletre
  // hivatkozott, amit a felhasználó nem végzett el.
  const emptyMsg = searching
    ? T(lang, "Nincs találat a keresésre — próbáld más szóval körülírni.")
    : T(lang, "Még nincs egyetlen útmutató sem a tudástárban.");
  const toc =
    sections.map(group).join("") || `<p class="mut small" style="padding:8px 12px">${emptyMsg}</p>`;
  // INDULÓLAP a jobb hasábban (jóváhagyott terv „C"): a képernyő nagyobbik fele addig egyetlen
  // felszólítást tartalmazott („Válassz témát…"), 500 px üresség fölött. Most témakör-kártyák
  // állnak ott MINDEN cikkcímmel — így a felszólítás végrehajtható, és nem kell találgatni,
  // melyik csoport mögött lehet a keresett cikk. Szerver-oldalon renderel → JS nélkül is áll.
  // ⚠️ TELEFONON a kártyák nem jelennek meg (CSS): ott a lista MAGA az indulólap, a kártya
  // ugyanazoknak a címeknek a második példánya lenne egy képernyőn.
  // ⛔ AZ ELIGAZÍTÓ MONDAT VISSZAKERÜLT. A kártyákkal együtt kidobtam a régi doboz szövegét is
  // („…a cikk itt nyílik meg, a lista közben kéznél marad"), és ezzel a lapról ELTŰNT az
  // egyetlen mondat, ami megmondta, hova nyílik a kattintott cikk (Elek FK-000, 2026-09-13).
  // Most már IGAZ is: a bal lista tényleg kínál választható témát, a kártyák pedig kattinthatók.
  const startMap =
    `<p class="mut small con-kb-startlead">${T(lang, "Válassz témát — a cikk itt, ezen a helyen nyílik meg, a bal oldali lista közben kéznél marad.")}</p>` +
    `<div class="con-kb-start">` +
    sections
      .map(
        (s) =>
          `<div class="con-kb-sc"><h3>${esc(s.label)}` +
          `${s.tag ? ` <span class="tag">${esc(s.tag)}</span>` : ""}</h3><ul>` +
          s.topics
            .map(
              (t) =>
                `<li><a href="/help?topic=${encodeURIComponent(t.id)}${qParam}#kb-art">${esc(t.title)}</a></li>`,
            )
            .join("") +
          `</ul></div>`,
      )
      .join("") +
    `</div>`;
  const art = help.open
    ? `<article class="con-kb-article">
         <h1 style="font-size:1.25rem;margin:8px 0 4px">${esc(help.open.title)}</h1>
         ${help.open.html}
         ${help.open.updated ? `<p class="mut small">${T(lang, "Frissítve:")} ${esc(help.open.updated)}</p>` : ""}
       </article>`
    : // ⛔ Üres listánál a jobb hasáb HALLGAT: a bal oszlop már kimondta ugyanazt, és két
      // példányban ugyanaz a mondat egy képernyőn nem több információ, csak zaj.
      sections.length
      ? startMap
      : "";
  const body = `
    <div class="panel">
      <h2>${T(lang, "Súgó")}</h2>
      <p class="mut small con-inline-ic" style="margin:0 0 12px">${T(lang, "Lépésről lépésre útmutatók a konzol minden képernyőjéhez és az ügyfél-admin felülethez. Ugyanide jutsz a képernyőkön látható")} ${ic("help", 14)} ${T(lang, "ikonokkal is.")}</p>
      <form method="get" action="/help" class="con-kb-search">
        <input type="search" name="q" value="${esc(help.query)}"
          placeholder="${esc(T(lang, "Mit keresel? (pl. mock, kuráció, fotó)"))}" aria-label="${esc(T(lang, "Keresés a súgóban"))}">
        <button type="submit">${T(lang, "Keresés")}</button>
      </form>
      <div class="con-kb-cols">
        <div class="con-kb-side">
          <!-- ⛔ A gombpár A LISTA FÖLÉ tartozik, mert arra hat: korábban a jobb (üres)
               hasáb fölé volt igazítva, vagyis vizuálisan nem ahhoz az oszlophoz, amit vezérel.
               A darabszám KÍVÜL van a rejtett dobozon: az JS nélkül is igaz információ. -->
          <div class="con-kb-bar">
            <span class="mut small">${T(lang, "{n} útmutató, {m} csoportban", { n: articleCount, m: sections.length })}</span>
            <!-- A gombpárt a JS teszi ki: JS nélkül nem működne, és a halott gomb rosszabb,
                 mint a hiányzó (a natív nyitás/csukás enélkül is megvan). -->
            <div class="con-kb-tools" hidden id="kb-tools">
              <button type="button" data-kb-all="1">${T(lang, "Mindet kinyitom")}</button> ·
              <button type="button" data-kb-all="0">${T(lang, "Mindet becsukom")}</button>
            </div>
          </div>
          <nav class="con-kb-toc" id="kb-toc">${toc}</nav>
        </div>
        <div class="con-kb-art" id="kb-art">${art}</div>
      </div>
      <!-- ⛔ A LISTA UTÁN: a script korábban a nav ELŐTT futott, így a kb-toc elem még nem
           létezett, a gombpár néma maradt — és ezt semmilyen képernyőkép nem mutatta volna. -->
      <script>
        (function () {
          var tools = document.getElementById("kb-tools");
          var toc = document.getElementById("kb-toc");
          if (!tools || !toc || !toc.querySelector("details")) return;
          tools.hidden = false;
          tools.addEventListener("click", function (e) {
            var b = e.target.closest("[data-kb-all]");
            if (!b) return;
            var open = b.getAttribute("data-kb-all") === "1";
            toc.querySelectorAll("details").forEach(function (d) { d.open = open; });
          });
          // ⛔ KETTŐZÉS-BONTÁS (tulaj-döntés, Elek FK-000: ugyanaz a 9 csoport és 35 cikk
          // KÉTSZER szerepelt egy képernyőn). Ha az indulólap-rács LÁTSZIK, ő a tartalom-
          // jegyzék — a bal oszlop ilyenkor a kilenc csoportfejre zár.
          //
          // ⚠️ MIÉRT ÍGY, ÉS MIÉRT NEM SZERVER-OLDALON: a details-open a HTML-ben dől el,
          // a képernyő szélességét viszont a szerver nem ismeri. Ha alapból CSUKVA rendernénk
          // és JS nyitná ki telefonon, akkor a JS nélküli telefonos olvasó NULLA cikkcímet
          // kapna — pontosan a bejelentett hiba. Ezért az alapállapot marad a NYITOTT (mindig
          // van látható tartalom), és a JS csak ELVESZ egy redundanciát ott, ahol a rács amúgy
          // is mindent kiír. A degradáció iránya a lényeg: JS nélkül fölösleg, nem hiány.
          //
          // ⚠️ A FELTÉTEL A RÁCS TÉNYLEGES LÁTHATÓSÁGA, nem egy ide másolt töréspont-szám:
          // a display-érték egyszerre hordozza az „elég széles" és a „nincs megnyitott cikk"
          // feltételt. Egy 720px-es másolat itt a CSS-től függetlenül tudna elcsúszni.
          var start = document.querySelector(".con-kb-start");
          var searching = new URLSearchParams(location.search).get("q");
          if (start && !searching && getComputedStyle(start).display !== "none") {
            toc.querySelectorAll("details[open]").forEach(function (d) { d.open = false; });
          }
        })();
      </script>
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
          ? `<p class="small" style="margin:6px 0 0;color:var(--citui-bad-ink)">⚠️ ${T(lang, "{km} km választja el őket — több telephely vagy közös ügynökségi oldal lehet, nem ugyanaz az üzlet.", { km: (c.maxDistanceM / 1000).toFixed(1) })}</p>`
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
