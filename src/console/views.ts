// Operator console — server-rendered HTML (hand-rolled template literals, the
// same approach as the mock render.ts). No framework, no emoji icons (design
// doctrine). Every dynamic value goes through esc().

import type {
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
import { MODULE_CATALOG, GROUP_LABELS, modulesForConversion } from "../modules.js";
import type { PricingSnapshot } from "../pricing.js";
import { ic } from "../ui/icons.js";

export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

/** Persistent menu — every internal page carries it; nothing to memorize.
 *  Icons from the shared bespoke set (src/ui/icons.ts) — one icon language. */
const MENU: ReadonlyArray<{ href: string; label: string; icon: string }> = [
  { href: "/", label: "Vezérlőpult", icon: "overview" },
  { href: "/leads", label: "Leadek", icon: "leads" },
  { href: "/scrape", label: "Scrape", icon: "scrape" },
  { href: "/duplicates", label: "Duplikátumok", icon: "leads" },
  { href: "/report", label: "Riport", icon: "report" },
  { href: "/pricing", label: "Árazás", icon: "pricing" },
  { href: "/settings", label: "Beállítások", icon: "settings" },
];

export interface LayoutOpts {
  /** Menü-kiemelés: az aktív menüpont href-je. */
  readonly active?: string;
  /** false → prospect/tenant-facing page: brand only, NO internal menu. */
  readonly chrome?: boolean;
  /** Extra markup injected into <head> (e.g. a map library's stylesheet). */
  readonly head?: string;
}

export function layout(title: string, body: string, opts: LayoutOpts = {}): string {
  const chrome = opts.chrome !== false;
  const nav = chrome
    ? `<nav class="con-nav">${MENU.map(
        (m) =>
          `<a href="${m.href}"${m.href === opts.active ? ` class="active"` : ""}>${ic(m.icon, 17)}${esc(m.label)}</a>`,
      ).join("")}</nav>
       <div class="con-user"><a href="/logout">Kilépés</a></div>`
    : "";
  return `<!doctype html><html lang="hu"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — Citoviso konzol</title>
<link rel="stylesheet" href="/assets/ui/citui.css?v=${ASSET_V}">
<link rel="stylesheet" href="/assets/ui/citui-console.css?v=${ASSET_V}">${opts.head ?? ""}</head>
<body class="con"><header class="con-top">${BRAND}${nav}</header>
<main class="con-main">${body}</main></body></html>`;
}

/**
 * Sub-tabs of the Scrape workflow. The launcher, the coverage map and the area
 * editor are three views of ONE job (where do we hunt, what did we find), so they
 * share a section instead of each taking a top-level menu slot.
 */
const SCRAPE_TABS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/scrape", label: "Indítás" },
  { href: "/scrape/map", label: "Térkép" },
  { href: "/scrape/regions", label: "Területek" },
];

export function scrapeTabs(active: string): string {
  return `<nav class="con-tabs">${SCRAPE_TABS.map(
    (t) => `<a href="${t.href}"${t.href === active ? ' class="active"' : ""}>${esc(t.label)}</a>`,
  ).join("")}</nav>`;
}

/** Small inline password-visibility toggle (no dependency, no-JS safe). */
const PW_TOGGLE_JS =
  `<script>function citPwT(id,btn){var i=document.getElementById(id);` +
  `var show=i.type==='password';i.type=show?'text':'password';btn.textContent=show?'elrejt':'mutat';}</script>`;

/** Operator login page (control-plane realm — works on the public internet). */
export function operatorLoginPage(error: string | null = null, publicLoginUrl = ""): string {
  return `<!doctype html><html lang="hu"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Belépés — Citoviso konzol</title>
<link rel="stylesheet" href="/assets/ui/citui.css?v=${ASSET_V}">
<link rel="stylesheet" href="/assets/ui/citui-console.css?v=${ASSET_V}">${PW_TOGGLE_JS}</head>
<body class="con"><div class="con-login"><div class="box">
${BRAND}
<h1>Belső konzol — munkatársi belépés</h1>
<form method="post" action="/login" style="display:block">
  <label for="u">Felhasználónév</label>
  <input id="u" name="username" autocomplete="username" autocapitalize="none" autocorrect="off" autofocus required>
  <label for="p">Jelszó</label>
  <div style="display:flex;gap:8px;align-items:center">
    <input id="p" name="password" type="password" autocomplete="current-password" required style="flex:1">
    <button type="button" onclick="citPwT('p',this)" style="width:auto;margin:0;padding:8px 12px;background:var(--citui-white);border-color:var(--citui-line-strong);color:var(--citui-muted)">mutat</button>
  </div>
  <button type="submit">Belépés</button>
</form>
${error ? `<p class="err">${esc(error)}</p>` : ""}
<p style="margin:16px 0 0;font-size:0.85rem;color:var(--citui-muted)">
  <a href="/login/help">Elfelejtett jelszó?</a>
  ${publicLoginUrl ? ` · <a href="${esc(publicLoginUrl)}">Ügyfél-belépést keresel? ▸</a>` : ""}
</p>
</div></div></body></html>`;
}

/** Operator password-recovery help (no live e-mail infra yet — honest path). */
export function operatorLoginHelpPage(publicLoginUrl = ""): string {
  const body = `
    <div class="panel" style="max-width:560px;margin:40px auto">
      <h2>Elfelejtett operátor-jelszó</h2>
      <p>A belső fiókok jelszavát a szerveren lehet visszaállítani (új, megjegyezhető jelszót generál
        és kiírja):</p>
      <pre>npx tsx scripts/operator-user.ts &lt;felhasználónév&gt;</pre>
      <p class="mut small">Ugyanez a parancs hoz létre új munkatársi fiókot is. Önkiszolgáló e-mailes
        visszaállítás a küldő-domain élesítése után lesz.</p>
      <p class="mut small">Belépett állapotban a jelszó a <strong>Beállítások</strong> menüben cserélhető.</p>
      <p style="margin-top:14px"><a href="/login">← Vissza a belépéshez</a>
        ${publicLoginUrl ? ` · <a href="${esc(publicLoginUrl)}">Ügyfél-belépés ▸</a>` : ""}</p>
    </div>`;
  return layout("Elfelejtett jelszó", body, { chrome: false });
}

/** Operator settings: account info + password change. */
export function settingsPage(
  op: { username: string; displayName: string; role: string },
  notice: { ok: boolean; text: string } | null = null,
): string {
  const body = `
    <div class="panel" style="max-width:560px">
      <h2>Fiók</h2>
      <dl class="kv">
        <dt>Név</dt><dd>${esc(op.displayName)}</dd>
        <dt>Felhasználónév</dt><dd><code>${esc(op.username)}</code></dd>
        <dt>Szerepkör</dt><dd>${esc(op.role)}</dd>
      </dl>
    </div>
    <div class="panel" style="max-width:560px">
      <h2>Jelszó módosítása</h2>
      ${notice ? `<div class="row" style="margin:0 0 10px"><span class="pill ${notice.ok ? "approved" : "rejected"}">${esc(notice.text)}</span></div>` : ""}
      <form method="post" action="/settings/password" style="display:block;max-width:340px">
        <label class="small mut" for="cur">Jelenlegi jelszó</label>
        <input id="cur" name="current" type="password" autocomplete="current-password" required style="width:100%;margin:4px 0 10px">
        <label class="small mut" for="n1">Új jelszó (min. 8 karakter)</label>
        <input id="n1" name="next" type="password" autocomplete="new-password" minlength="8" required style="width:100%;margin:4px 0 10px">
        <label class="small mut" for="n2">Új jelszó még egyszer</label>
        <input id="n2" name="next2" type="password" autocomplete="new-password" minlength="8" required style="width:100%;margin:4px 0 12px">
        <button type="submit">Jelszó mentése</button>
      </form>
    </div>`;
  return layout("Beállítások", body, { active: "/settings" });
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
  // Currency unit for the selected region (module add-ons stay global HUF).
  const unit = snap.currency === "HUF" ? "Ft" : snap.currency === "EUR" ? "€" : snap.currency;
  const regionLabel = (r: string): string =>
    r === "hu" ? "Magyarország" : r === "global" ? "Globális (fallback)" : r;

  const priceInput = (name: string, value: number, suffix: string): string =>
    `<div class="row" style="gap:6px;align-items:center">
      <input name="${esc(name)}" type="number" min="0" step="1" inputmode="numeric"
        value="${esc(value)}" style="width:120px;text-align:right">
      <span class="mut small">${esc(suffix)}</span>
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

  const groupRows = (Object.keys(GROUP_LABELS) as (keyof typeof GROUP_LABELS)[])
    .map((g) => {
      const mods = MODULE_CATALOG.filter((m) => m.group === g);
      if (!mods.length) return "";
      const rows = mods
        .map((m) => {
          if (m.spine) {
            return `<tr>
              <td>${esc(m.label)} <span class="pill">gerinc</span></td>
              <td class="mut small">az alapdíjban — 0 Ft</td>
            </tr>`;
          }
          const price = snap.modulePrices.get(m.id) ?? 0;
          return `<tr>
            <td>${esc(m.label)} <code class="mut small">${esc(m.id)}</code></td>
            <td>${priceInput(`m_${m.id}`, price, "Ft / hó")}</td>
          </tr>`;
        })
        .join("");
      return `<tr><th colspan="2" class="mut small" style="padding-top:14px">${esc(GROUP_LABELS[g])}</th></tr>${rows}`;
    })
    .join("");

  const confirmNote = snap.pricingConfirmed
    ? `<span class="pill approved">az árak véglegesítve — a levelek árat hirdethetnek</span>`
    : `<span class="pill rejected">nincs véglegesítve — a §C-kapu blokkol minden árat hirdető levelet</span>`;

  // Module add-ons live in ONE global (HUF) table — editable on the HU page only,
  // to avoid the illusion of per-region module prices (a follow-up slice).
  const modulesSection =
    snap.region === "hu"
      ? `<h3 style="margin-top:18px">Modul-felárak (havi)</h3>
         <table class="kv" style="width:100%">${groupRows}</table>`
      : `<h3 style="margin-top:18px">Modul-felárak (havi)</h3>
         <p class="mut small">A modul-felárak jelenleg globálisak (HUF); a
         <a href="/pricing?region=hu">Magyarország</a> oldalon szerkeszthetők.</p>`;

  const body = `
    <div class="panel" style="max-width:720px">
      <h2>Árazás</h2>
      <p class="mut small" style="margin-top:-4px">
        Ez az árazás EGYETLEN forrása — a konfigurátor, a megrendelés-rögzítés és a levél
        ár-sora is innen olvas. Mentés után azonnal él (a nyilvános oldal ~10 mp-en belül veszi át).</p>

      <div class="row" style="margin:0 0 10px;gap:6px;flex-wrap:wrap;align-items:center">
        <span class="mut small">Piac / régió:</span> ${switcher}
      </div>
      <p class="mut small" style="margin:-4px 0 12px">A nyilvános oldal a látogató régiója
        szerinti árat mutatja; ha arra nincs, a <strong>Globális (EUR)</strong> árlistát.</p>

      ${notice ? `<div class="row" style="margin:0 0 12px"><span class="pill ${notice.ok ? "approved" : "rejected"}">${esc(notice.text)}</span></div>` : ""}
      <div class="row" style="margin:0 0 14px">${confirmNote}</div>

      <form method="post" action="/pricing">
        <input type="hidden" name="region" value="${esc(snap.region)}">
        <h3>Alap-előfizetés — ${esc(regionLabel(snap.region))} <span class="mut small">(${esc(snap.currency)})</span></h3>
        <table class="kv" style="width:100%">
          <tr><td>Alapdíj (a gerinccel együtt)</td><td>${priceInput("base_monthly", snap.baseMonthly, `${unit} / hó`)}</td></tr>
          <tr><td>Éves előrefizetés — ingyen hónapok</td><td>${priceInput("annual_free_months", snap.annualFreeMonths, "hónap (pl. 2 = „2 hónap ingyen”)")}</td></tr>
          <tr><td>Saját domain (rajtunk keresztül)</td><td>${priceInput("custom_domain_yearly", snap.customDomainYearly, `${unit} / év`)}</td></tr>
        </table>

        ${modulesSection}

        <label class="row" style="gap:8px;align-items:center;margin:16px 0 4px">
          <input type="checkbox" name="pricing_confirmed"${snap.pricingConfirmed ? " checked" : ""}>
          <span><strong>Az árak véglegesek, élesíthetők</strong>
            <span class="mut small">— enélkül a levél nem hirdethet árat, és a nyilvános oldal „Egyedi ajánlat”-ot mutat (Fttv./§C-kapu).</span></span>
        </label>

        <div class="row" style="margin-top:12px">
          <button class="ok" type="submit">Árazás mentése (${esc(regionLabel(snap.region))})</button>
        </div>
      </form>
    </div>`;
  return layout("Árazás", body, { active: "/pricing" });
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
const QUAL_META: Record<string, { label: string; cls: string; svg: string }> = {
  no_site: {
    label: "nincs honlap",
    cls: "qb-hot",
    // crossed-out globe
    svg: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.5 2.5 2.5 13 0 16M12 4c-2.5 2.5-2.5 13 0 16"/><path d="M4 20 20 4" stroke-width="2.2"/>',
  },
  outdated: {
    label: "elavult",
    cls: "qb-warn",
    svg: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>', // clock
  },
  modern: {
    label: "modern",
    cls: "qb-ok",
    svg: '<path d="M4 12.5l5 5 11-11"/>', // check
  },
  unknown: {
    label: "ismeretlen",
    cls: "qb-mut",
    svg: '<circle cx="12" cy="12" r="8"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3 3.1v1.2"/><circle cx="12" cy="16.6" r=".6" fill="currentColor"/>',
  },
};

export function qualBadge(qualification: string | null | undefined): string {
  const m = QUAL_META[qualification ?? "unknown"];
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
  return (
    `<span class="qbadge qb-off" title="diszkvalifikálva">` +
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ` +
    `stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M8 12h8"/></svg>` +
    `diszkvalifikálva</span>`
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
    <button type="button" class="cf-btn${on ? " on" : ""}" onclick="citCf(this)" aria-label="szűrés">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
        <path d="M4 6h16M7 12h10M10 18h4"/></svg>${on ? `<i>${on}</i>` : ""}
    </button>
    <span class="cf-pop" hidden>
      ${options.length > 6 ? `<input type="text" class="cf-search" placeholder="keresés…" oninput="citCfSearch(this)" onclick="event.stopPropagation()">` : ""}
      <span class="cf-list">${items}</span>
    </span>
  </span>`;
}

/** Numeric "at least" filter in a header (photos, material). */
function minFilter(name: string, value?: number): string {
  return `<span class="cf">
    <button type="button" class="cf-btn${value ? " on" : ""}" onclick="citCf(this)" aria-label="minimum">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
        <path d="M4 6h16M7 12h10M10 18h4"/></svg>${value ? `<i>${value}+</i>` : ""}
    </button>
    <span class="cf-pop" hidden>
      <label class="cf-opt" style="gap:6px">legalább
        <input type="number" name="${esc(name)}" min="0" value="${value ?? ""}" style="width:70px"
               onchange="this.form.submit()" onclick="event.stopPropagation()"></label>
    </span>
  </span>`;
}

export function leadsPage(rows: LeadListRow[], q: LeadQuery = {}): string {
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
      .map((v) => ({ value: v, label: v === "" ? "ismeretlen" : v, count: counts.get(v) }));
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
    <span class="mut small">${activeCount ? `${activeCount} aktív szűrő` : "nincs szűrő"}</span>
    <span class="row" style="gap:12px">
      ${activeCount ? `<a class="small" href="/leads${q.disqualified === "1" ? "?disqualified=1" : ""}">Szűrők törlése</a>` : ""}
      <a class="small" href="${q.disqualified === "1" ? "/leads" : "/leads?disqualified=1"}">${
        q.disqualified === "1" ? "◂ aktív leadek" : "diszkvalifikáltak ▸"
      }</a>
    </span>
  </div>`;

  const head = `<thead><tr>
    <th>${sortHead("Név", "name", q)}
      <span class="cf">
        <button type="button" class="cf-btn${q.name ? " on" : ""}" onclick="citCf(this)" aria-label="név-keresés">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <circle cx="11" cy="11" r="6"/><path d="M20 20l-4.3-4.3"/></svg>
        </button>
        <span class="cf-pop" hidden>
          <input type="text" name="name" list="leadNames" value="${esc(q.name ?? "")}"
                 placeholder="név…" onchange="this.form.submit()" onclick="event.stopPropagation()">
        </span>
      </span></th>
    <th>Régió ${colFilter("region", regionOpts, q.region ?? [])}</th>
    <th>Ország ${colFilter("country", countryOpts, q.country ?? [])}</th>
    <th>Város ${colFilter("city", cityOpts, q.city ?? [])}</th>
    <th>${sortHead("Kvalifikáció", "qualification", q)} ${colFilter(
      "qualification",
      opt(
        [["no_site", "nincs honlap"], ["outdated", "elavult"], ["modern", "modern"], ["unknown", "ismeretlen"]],
        qualCounts,
      ),
      q.qualification ?? [],
    )}</th>
    <th>${sortHead("Fotók", "photos", q)} ${minFilter("minPhotos", q.minPhotos)}</th>
    <th>${sortHead("Anyag", "material", q)} ${minFilter("minMaterial", q.minMaterial)}</th>
    <th>${sortHead("Match", "match", q)}</th>
    <th>${sortHead("Kontakt", "contact", q)} ${colFilter(
      "contact",
      opt([["email", "email"], ["sms", "sms"], ["voice", "voice"], ["none", "nincs"]], contactCounts),
      q.contact ?? [],
    )}</th>
    <th>${sortHead("Mock", "mock", q)} ${colFilter(
      "mock",
      opt(
        [["none", "nincs"], ["generated", "generated"], ["approved", "approved"], ["rejected", "rejected"]],
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
            ? `<br><span class="pill approved" style="margin-top:4px;display:inline-block" title="E-mail kiküldve ${esc(r.outreachSentAt.slice(0, 16).replace("T", " "))}">✓ kiküldve</span>`
            : ""
        }</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="10" class="mut" style="padding:24px">Nincs a szűrőnek megfelelő lead.
        <a href="/leads">Szűrők törlése</a></td></tr>`;

  // Autocomplete source for the name search (the current result set).
  const nameList = `<datalist id="leadNames">${rows
    .map((r) => `<option value="${esc(r.name)}">`)
    .join("")}</datalist>`;

  const body = `<div class="panel"><h2>Leadek (${rows.length})</h2>
    ${toolbar}
    <form method="get" id="leadFilters">${hidden}
      <div class="tblwrap"><table>${head}<tbody>${bodyRows}</tbody></table></div>
    </form>
    ${nameList}
    ${LEAD_FILTER_JS}</div>`;
  return layout("Leadek", body, { active: "/leads" });
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
  const mods = c.modules.length
    ? c.modules.map((m) => `<span class="pill">${esc(m)}</span>`).join(" ")
    : `<span class="mut small">nincs aktív modul</span>`;
  return `<div class="row" style="margin-top:10px">
      <span class="pill approved">${esc(c.siteStatus)}</span>
      <a class="small" href="${esc(c.previewUrl)}" target="_blank">privát előnézet ▸</a>
      <a class="small" href="${esc(c.adminUrl)}" target="_blank">tenant-admin ▸</a>
    </div>
    <div class="row" style="margin-top:8px">${mods}</div>
    <div class="mut small" style="margin-top:6px">Provisioned privát előnézet — a nyilvános élesítés fizetés-kapus, ház-oldali (A2).</div>`;
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
  const labelOf = (id: string) => MODULE_CATALOG.find((m) => m.id === id)?.label ?? id;
  const pills = modules.length
    ? modules.map((m) => `<span class="pill">${esc(labelOf(m))}</span>`).join(" ")
    : `<span class="mut small">nincs modul</span>`;
  const note = fromOrder
    ? "A tulaj a konfigurátorban ezeket kérte — ezekkel élesítünk:"
    : "A tulaj még nem konfigurált — a teljes (ALL-IN) oldallal konvertálunk:";
  return `<form method="post" action="/lead/${esc(leadId)}/convert" style="margin-top:10px">
      <input type="hidden" name="artifactId" value="${esc(artifactId)}">
      <div class="mut small" style="margin-bottom:6px">${note}</div>
      <div class="row" style="margin-bottom:8px">${pills}</div>
      <button class="ok" type="submit">Konvertálás privát előnézetbe ▸</button>
    </form>`;
}

/** Prospect order intents + payment state (pricing/payment slice) for the operator. */
function orderIntentsPanel(
  orders: OrderIntentView[],
  payments: PaymentView[],
  leadId: string,
): string {
  if (!orders.length) return "";
  const rows = orders
    .map((o) => {
      const when = (o.submittedAt ?? o.createdAt).slice(0, 16).replace("T", " ");
      const per = o.billingPeriod === "annual" ? "év" : "hó";
      const pays = payments.filter((p) => p.orderIntentId === o.id);
      const payHtml = pays.length
        ? pays
            .map((p) => {
              const cls = p.status === "paid" ? "approved" : p.status === "failed" ? "rejected" : "generated";
              const link =
                p.status === "pending" && p.payUrl
                  ? ` <a class="small" href="${esc(p.payUrl)}" target="_blank">fizetőoldal ▸</a>`
                  : p.status === "paid" && p.paidAt
                    ? ` <span class="mut small">${esc(p.paidAt.slice(0, 16).replace("T", " "))}</span>`
                    : "";
              const inv = p.invoiceNumber
                ? ` <span class="mut small">· számla: ${esc(p.invoiceNumber)}</span>`
                : "";
              return `<span class="pill ${cls}">fizetés: ${esc(p.status)}</span>${link}${inv}`;
            })
            .join(" ")
        : "";
      const paid = pays.some((p) => p.status === "paid");
      const hasPending = pays.some((p) => p.status === "pending");
      const payBtn =
        o.status === "submitted" && !paid && !hasPending
          ? `<form method="post" action="/lead/${esc(leadId)}/request-payment">
               <button class="ok" type="submit">Fizetési kérés küldése ▸</button></form>`
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
            ? `<b>egyedi (rajtunk keresztül)</b> — ${esc(o.domainName ?? "?")}${o.commitmentMonths ? ` · min. ${o.commitmentMonths} hó elköteleződés` : ""}`
            : o.domainType === "own"
              ? `saját meglévő — ${esc(o.domainName ?? "?")}`
              : `citoviso-aldomain${o.domainName ? ` — ${esc(o.domainName)}` : ""}`
        }</div>
        <div class="row" style="margin-top:6px">${payHtml}${payBtn}</div>
      </div>`;
    })
    .join("");
  return `<div class="panel"><h2>Csomag-igények (${orders.length})</h2>${rows}
    <div class="mut small" style="margin-top:8px">Pilot fizetés: pay-link (Barion helyén mock) → fizetéskor a site élesedik; nem-fizet → deaktiválás. Auto-terhelés (MIT) = 2. fázis.</div></div>`;
}

/** MOCK hosted pay page — stands in for the real Barion pay-link (Slice 2). */
export function payMockPage(ref: string, amount: number, period: string, status: string): string {
  const per = period === "annual" ? "év" : "hó";
  const body = `<div class="panel" style="max-width:440px;margin:48px auto;text-align:center">
    <h2>Mock fizetőoldal</h2>
    <p style="font-size:24px;margin:12px 0"><b>${fmtHuf(amount)}</b> <span class="mut">/ ${per}</span></p>
    <p class="mut small">ref: <code>${esc(ref)}</code> · státusz: ${esc(status)}</p>
    <div class="row" style="justify-content:center;margin-top:18px">
      <form method="post" action="/pay/mock/${esc(ref)}/paid"><button class="ok" type="submit">Fizetek ▸</button></form>
      <form method="post" action="/pay/mock/${esc(ref)}/failed"><button class="bad" type="submit">Elutasítom</button></form>
    </div>
    <p class="mut small" style="margin-top:16px">Ez a MOCK fizetőoldal a valós Barion pay-link helyén. A gombok ugyanazt a webhook-utat hajtják, amit az éles gateway fog.</p>
  </div>`;
  return layout("Mock fizetés", body, { chrome: false });
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
  },
): string {
  if (!paid) {
    return layout(
      "Fizetés elutasítva",
      `<div class="panel" style="max-width:520px;margin:48px auto;text-align:center">
        <h2 class="q-bad">A fizetés nem sikerült</h2>
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
      "Fizetés megérkezett",
      `<div class="panel" style="max-width:560px;margin:48px auto">
        <h2 class="q-good" style="margin-top:0">Köszönjük, a fizetés megérkezett!</h2>
        <p style="margin:0 0 12px">Az oldalát még véglegesítjük. Amint elérhető, a pontos
        címet és a belépési adatait <b>e-mailben elküldjük</b> — általában néhány órán belül.</p>
        <p class="mut small" style="margin:0">Kérdése van? Írjon:
        <a href="mailto:info@citoviso.com">info@citoviso.com</a> — segítünk.</p>
      </div>`,
      { chrome: false },
    );
  }
  const site = info?.siteUrl;
  const liveBlock = site
    ? `<p style="margin:0 0 6px">Az oldala <b>elérhető az interneten</b>:</p>
       <p style="margin:0 0 22px;font-size:18px"><a href="${esc(site)}">${esc(site)}</a></p>`
    : `<p style="margin:0 0 22px">Az oldala elkészült. Néhány percen belül elérhető lesz —
       a pontos címet e-mailben küldjük.</p>`;
  const mailNote = info?.contactEmail
    ? `Elküldtük a belépési adatait ide: <b>${esc(info.contactEmail)}</b>.`
    : `A belépési adatait e-mailben küldtük el.`;
  const userLine = info?.username
    ? `<li style="margin:0 0 6px">Felhasználónév: <b>${esc(info.username)}</b> (a jelszó az e-mailben)</li>`
    : `<li style="margin:0 0 6px">A felhasználónevet és a jelszót e-mailben küldtük.</li>`;
  const body = `<div class="panel" style="max-width:560px;margin:48px auto">
      <h2 class="q-good" style="margin-top:0">Köszönjük, kész!</h2>
      ${liveBlock}
      <h3 style="margin:0 0 8px">Mi a következő lépés?</h3>
      <p style="margin:0 0 10px">${mailNote} Ezekkel bármikor beléphet, és <b>saját maga
      szerkesztheti a szövegeket és a fotókat</b> — nem kell hozzá szakember.</p>
      <ul style="margin:0 0 18px;padding-left:20px">
        ${userLine}
        <li style="margin:0 0 6px">Belépés: <a href="/login">citoviso.com/login</a></li>
        <li>Itt cserélheti a bemutatkozó szöveget, a képeket és az elérhetőségeit.</li>
      </ul>
      <p style="margin:0 0 18px"><a class="btn" href="/login">Belépek és szerkesztem</a></p>
      <p class="mut small" style="margin:0">Kérdése van? Írjon:
      <a href="mailto:info@citoviso.com">info@citoviso.com</a> — segítünk.</p>
    </div>`;
  return layout("Kész — az oldala él", body, { chrome: false });
}

// Segment hypothesis labels (PILOT.md §2.2) for the prospect create form.
const SEGMENTS: readonly { id: string; label: string }[] = [
  { id: "nincs_honlap", label: "nincs honlap" },
  { id: "0_labnyom", label: "0 lábnyom" },
  { id: "van_labnyom", label: "van lábnyom" },
  { id: "elavult", label: "elavult oldal" },
];

/** Tracked-outreach panel: create the /p/<token> prospect + funnel status. */
function prospectsPanel(prospects: ProspectView[], d: LeadDetail): string {
  // The tracked link points at an APPROVED mock — offer creation only then.
  const approved = d.artifacts.find((a) => a.status === "approved");
  const createForm = approved
    ? `<form method="post" action="/lead/${esc(d.id)}/prospect" class="row" style="flex-wrap:wrap;gap:8px">
        <input type="hidden" name="artifactId" value="${esc(approved.id)}">
        <select name="segment">${SEGMENTS.map(
          (s) =>
            `<option value="${esc(s.id)}"${d.qualification === "no_site" && s.id === "nincs_honlap" ? " selected" : ""}${d.qualification === "outdated" && s.id === "elavult" ? " selected" : ""}${d.qualification === "modern" && s.id === "van_labnyom" ? " selected" : ""}>${esc(s.label)}</option>`,
        ).join("")}</select>
        <input type="email" name="email" placeholder="kapcsolati e-mail (opcionális)" style="min-width:220px">
        <button type="submit">Követett link készítése</button>
      </form>`
    : `<p class="mut small">Követett link jóváhagyott mockhoz készíthető (előbb kuráció).</p>`;

  const rows = prospects
    .map((p) => {
      const link = `/p/${p.token}`;
      return `<div style="padding:8px 0;border-bottom:1px solid var(--citui-line)">
        <div class="row" style="justify-content:space-between;margin-top:0">
          <span>
            <span class="pill ${p.status === "order_intent" || p.status === "converted" ? "approved" : ""}">${esc(p.status)}</span>
            ${p.segment ? `<span class="pill">${esc(p.segment)}</span>` : ""}
            ${p.sentAt ? `<span class="pill approved">✓ E-mail elküldve · ${esc(p.sentAt.slice(0, 16).replace("T", " "))}</span>` : `<span class="pill">e-mail még nem ment ki</span>`}
            ${p.unsubscribedAt ? `<span class="pill rejected">leiratkozott</span>` : ""}
          </span>
          <span class="mut small">${esc(p.createdAt.slice(0, 16).replace("T", " "))}</span>
        </div>
        <div class="small" style="margin-top:6px">
          <a href="${esc(link)}" target="_blank">${esc(link)}</a>
          <button type="button" class="small" style="margin-left:8px"
            onclick="navigator.clipboard.writeText(location.origin+'${esc(link)}');this.textContent='másolva'">link másolása</button>
        </div>
        <div class="mut small" style="margin-top:4px">
          ${p.contactEmail ? `${esc(p.contactEmail)} · ` : ""}${p.views} megnyitás · ${p.events} esemény
          ${p.sentAt ? ` · kiküldve ${esc(p.sentAt.slice(0, 16).replace("T", " "))}` : ""}
        </div>
        <div class="row" style="margin-top:6px">
          ${
            !p.unsubscribedAt
              ? `<form method="get" action="/prospect/${esc(p.id)}/draft" style="display:inline;margin:0">
                   <button type="submit">✉ E-mail / SMS megnyitása — küldés ▸</button></form>`
              : ""
          }
          <form method="get" action="/prospect/${esc(p.id)}/activity" style="display:inline;margin:0">
            <button type="submit">📊 Tevékenység — mit csinált (${p.views} megnyitás · ${p.events} esemény) ▸</button></form>
          ${
            p.status === "created" && !p.unsubscribedAt
              ? `<form method="post" action="/prospect/${esc(p.id)}/sent" style="display:inline;margin:0">
                   <input type="hidden" name="leadId" value="${esc(d.id)}">
                   <button class="ok" type="submit">Kiküldve — mérés indul</button></form>`
              : ""
          }
        </div>
      </div>`;
    })
    .join("");

  return `<div class="panel" id="prospects"><h2>Megkeresés — követett link (${prospects.length})</h2>
    ${createForm}${rows}
    <details class="mut small" style="margin-top:8px">
      <summary style="cursor:pointer">Hogyan működik a mérés?</summary>
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
  return `<form method="post" action="/lead/${esc(d.id)}/reenrich" class="con-reenrich"
        onsubmit="var b=this.querySelector('button');b.disabled=true;b.textContent='Újragyűjtés folyamatban…'">
      <button type="submit" class="ghost">${ic("scrape", 15)} Adatok újragyűjtése</button>
      <span class="mut small">Honlap-keresés, elérhetőség és kontakt újrafuttatása erre a leadre — a fenti mentett javításokkal. Nem ír felül kurátori adatot.</span>
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
    ? `<h3 class="con-facts__h">Honlap-állapot</h3>
       <div class="con-fact-grid">
         ${fact("Oldal elérhető", yesNo(a.reachable))}
         ${fact("Mobilbarát", yesNo(a.responsive))}
         ${fact("Copyright-év", String(val(a.copyrightYear)))}
         ${fact("Képek az oldalon", String(val(a.imageCount)))}
         ${fact("Elavultság-jelek", a.signals?.length ? esc(a.signals.join(", ")) : `<span class="mut">nincs</span>`, true)}
         ${fact("Talált e-mailek", a.emails?.length ? esc(a.emails.join(", ")) : `<span class="mut">–</span>`, true)}
       </div>`
    : "";

  // ADR-0029: contact/reachability fields are curator-EDITABLE (add missing OR correct
  // existing). Saved onto the lead's raw payload → the next generation uses them. The scraped
  // originals are shown when an edit has been made (audit).
  const rawAny = (d.raw ?? {}) as { scrapedContact?: Record<string, unknown>; curatorEditedAt?: string };
  const edited = rawAny.scrapedContact;
  const orig = (k: string) =>
    edited && edited[k] != null && edited[k] !== ""
      ? `<span class="mut small" style="display:block">scrape: ${esc(edited[k])}</span>`
      : "";
  const fld = (name: string, label: string, value: unknown, type = "text", ph = "", span = 1) =>
    `<div${span > 1 ? ` style="grid-column:span ${span}"` : ""}>
       <label class="small mut" for="ed-${name}" style="display:block;margin-bottom:2px">${esc(label)}</label>
       <input id="ed-${name}" name="${name}" type="${type}" value="${value ? esc(value) : ""}"
              placeholder="${esc(ph)}" style="width:100%;padding:5px 8px;font-size:12.5px;box-sizing:border-box">
       ${orig(name)}
     </div>`;

  // The website field carries an open-in-new-tab affordance: judging "is this
  // really their site?" means LOOKING at it, and retyping the URL is friction
  // that makes the operator skip the check.
  // Always present, and it opens WHAT IS IN THE FIELD — not only what was saved
  // earlier. An operator who just pasted a URL wants to check it before saving,
  // and the button vanishing whenever the lead has no stored site read as a bug.
  const openSite = `<button type="button" class="con-open" onclick="citOpenSite(this)"
        title="Beírt honlap megnyitása új lapon" aria-label="Beírt honlap megnyitása új lapon">${ic("external", 16)}</button>`;

  const sources = raw.sources?.length
    ? raw.sources
        .map((s) => sourceLink(s, raw.sourceRefs?.[s], raw.lat, raw.lon))
        .join(" ")
    : `<span class="mut">–</span>`;

  return `<div class="panel">
      <h2>Begyűjtött adatok — szerkeszthető${rawAny.curatorEditedAt ? ` <span class="pill" style="font-size:11px;color:#fff;border-color:rgba(255,255,255,.55)">szerkesztve</span>` : ""}</h2>
      <p class="small mut" style="margin:4px 0 14px">Pótolható a hiányzó ÉS javítható a meglévő; a mentett érték a következő mock-generáláskor érvényesül. Üres mező = törlés.
        A <b>város</b> egyben a honlap-ellenőrzés horgonya — javítsd, ha rossz, és az újragyűjtés pontosabban talál.</p>
      <form method="post" action="/lead/${esc(d.id)}/data"
            onsubmit="var b=this.querySelector('button[type=submit]');b.disabled=true;b.textContent='Mentés…'">
        <div class="con-edit-grid">
          ${fld("name", "Név", d.name)}
          ${fld("phone", "Telefon", raw.phone, "text", "+36 …")}
          ${fld("email", "E-mail", raw.email, "email", "pl. info@szallas.hu")}
          ${fld("country", "Ország", raw.country, "text", "HU")}
          ${fld("city", "Város", raw.city, "text", "pl. Balatonberény")}
          ${fld("address", "Cím", d.address ?? (raw as { address?: string }).address, "text", "irsz., utca, házszám")}
          <div class="con-edit-site" style="grid-column:1/-1">
            ${fld("website", "Honlap", raw.website, "url", "https://…")}
            ${openSite}
          </div>
        </div>
        <div class="row" style="margin-top:12px">
          <button type="submit">Adatok mentése</button>
        </div>
      </form>

      <h3 class="con-facts__h">Minősítés és forrás</h3>
      <div class="con-fact-grid">
        ${fact("Honlap-státusz", raw.websiteStatus ? esc(raw.websiteStatus) : `<span class="mut">–</span>`)}
        ${fact("Kontakt-csatorna", String(val(raw.contactChannel)))}
        ${fact(
          "Koordináta",
          raw.lat != null && raw.lon != null
            ? `<a href="https://www.google.com/maps?q=${raw.lat},${raw.lon}" target="_blank" rel="noopener">${raw.lat.toFixed(5)}, ${raw.lon.toFixed(5)}</a>`
            : `<span class="mut">–</span>`,
        )}
        ${fact("Források", sources)}
        ${fact(
          "Anyag",
          `${val(mat.totalImages)} kép — Places: ${val(mat.placesPhotos)} · honlap: ${val(mat.websiteImages)} · Street View: ${yesNo(mat.streetView)}`,
          true,
        )}
      </div>
      ${assessment}
      ${contactLedgerBlock(raw.contacts, raw.email, raw.phone)}
      ${listingsBlock(raw.listings)}
      ${reenrichForm(d)}
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
  if (!contacts?.length) return "";
  const order = (c: ContactCandidate): number =>
    (c.value === primaryEmail || c.value === primaryPhone ? 0 : c.accepted ? 1 : 2);
  const rows = [...contacts]
    .sort((a, b) => order(a) - order(b) || a.kind.localeCompare(b.kind))
    .map((c) => {
      const isPrimary = c.value === primaryEmail || c.value === primaryPhone;
      const mark = isPrimary
        ? `<span class="pill con-ledger__use" title="Ezt használjuk megkereséskor">használt</span>`
        : c.accepted
          ? `<span class="pill con-ledger__ok" title="Átment a minőség-ellenőrzésen, tartalék">rendben</span>`
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
  return `<h3 class="con-facts__h">Talált elérhetőségek — forrás szerint (${contacts.length})</h3>
    <p class="small mut" style="margin:0 0 8px">Minden megtalált adat itt marad, az elvetettek is —
      így látod, mit dobott el a szűrő és miért${dropped ? `; most ${dropped} ilyen van` : ""}.
      A rangsorolás szabályait a valós kiküldés-eredményekből állítjuk majd fel.</p>
    <div class="tblwrap"><table class="con-ledger">
      <thead><tr><th>Típus</th><th>Érték</th><th>Forrás</th><th>Állapot</th><th>Megjegyzés</th></tr></thead>
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
        ? `<span class="pill con-listing__ok" title="Ezt az oldalt beolvastuk és a lead adatai stimmeltek">ellenőrizve</span>`
        : "";
      return `<li class="con-listing">
        <a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(host)}${ic("external", 12)}</a>
        <span class="con-listing__t mut small">${esc(l.title)}</span>${badge}
      </li>`;
    })
    .join("");
  return `<h3 class="con-facts__h">Hol találtuk meg — portál-jelenlét (${listings.length})</h3>
    <p class="small mut" style="margin:0 0 8px">Mások oldalain szerepel, nem a sajátján — ezek a lapok
      egyben a legjobb ingyenes adatforrások, és pontosan ezt az érvet adják a megkereséshez.</p>
    <ul class="con-listings">${rows}</ul>`;
}

/** The lead's real photos, loaded on demand (a Places lookup costs money, so it
 *  happens only when an operator actually opens the lead). */
function leadPhotosPanel(leadId: string): string {
  return `<div class="panel">
      <h2>Fotók</h2>
      <div id="leadPhotos" class="lead-photos"></div>
      <p id="photoMsg" class="mut small" style="margin:10px 0 0">Fotók betöltése…</p>
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
                + ' title="' + (srcLabel[p.provenance] || 'ismeretlen forrás') + ' — nagyban megnézem, nyilakkal léphetsz">'
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
  const raw = (d.raw ?? {}) as { disqualifiedReason?: string };
  if (d.lifecycle === "disqualified") {
    return `<div class="panel">
        <h2>Diszkvalifikálva</h2>
        <p class="mut">Ez a lead ki van zárva a megkeresésből${raw.disqualifiedReason ? ` — <b>${esc(raw.disqualifiedReason)}</b>` : ""}.</p>
        <form method="post" action="/lead/${esc(d.id)}/requalify">
          <button type="submit">Visszaállítás</button>
        </form>
      </div>`;
  }
  const reasons = [
    "nem célcsoport", "bezárt / nem működik", "lánc vagy nagyvállalat",
    "hibás adat / nem valós hely", "duplikátum", "kérte, hogy ne keressük",
  ];
  return `<div class="panel">
      <h2>Diszkvalifikálás</h2>
      <p class="mut small" style="margin-top:0">A lead kikerül a megkeresésből, de megmarad —
        egy újabb scrape sem hozza vissza a munkába.</p>
      <form method="post" action="/lead/${esc(d.id)}/disqualify" class="row" style="gap:8px;flex-wrap:wrap">
        <select name="reason">${reasons.map((r) => `<option value="${esc(r)}">${esc(r)}</option>`).join("")}</select>
        <button class="bad" type="submit">Diszkvalifikálás</button>
      </form>
    </div>`;
}

/** Template picker as a CARD GRID (ADR-0027: the CURATOR picks the art direction — not the
 *  AI). Each card = a radio-selectable look with its preview thumbnail + short name. Cards
 *  come from the engine registry (single source). The full label stays as the tooltip. */
function templateCards(selected = "fullbleed"): string {
  return Object.values(TEMPLATES)
    .map((t) => {
      // Short name = the label's first segment before an em-dash/colon (the registry label is
      // "Név — hosszú leírás (referencia N)"); fall back to the id.
      const short = (t.label.split(/[—:(]/)[0] ?? t.id).trim() || t.id;
      const on = t.id === selected;
      // The WHOLE card selects (thumbnail included) — the primary act here is CHOOSING.
      // Zooming is the secondary act, so it gets its own button; a <button> inside a
      // <label> does not activate the label (interactive content), so the two never clash.
      return `<label class="tpl-card${on ? " on" : ""}" title="${esc(t.label)}">
        <input type="radio" name="template" value="${esc(t.id)}"${on ? " checked" : ""} onchange="citTplPick(this)">
        <img src="/assets/ui/tpl-${esc(t.id)}.jpg" alt="${esc(short)}" loading="lazy">
        <button type="button" class="tpl-card__zoom" title="Nagyban megnézem — nyilakkal léphetsz a többire"
                aria-label="${esc(short)} — nagyban megnézem"
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
  const prov = d.provenance.length
    ? `<div class="tblwrap"><table><thead><tr><th>Mező</th><th>Érték</th><th>Forrás</th><th>Konf.</th></tr></thead>
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

  const renderArtifact = (a: LeadDetail["artifacts"][number]): string => {
          const dec = a.decisions[0];
          const curated = a.status === "approved" || a.status === "rejected";
          // Scalar metadata only — skip the engine artifact's recipe/siteData blobs.
          const inputs = Object.entries(a.inputs)
            .filter(([, v]) => v === null || typeof v !== "object")
            .map(([k, v]) => `${esc(k)}=${esc(v)}`)
            .join(" · ");
          return `<div class="panel" id="a-${esc(a.id)}">
            <div class="row">
              <span class="pill ${esc(a.status)}">${esc(a.status)}</span>
              <span class="mut small">${esc(a.generatedAt.slice(0, 16).replace("T", " "))}</span>
              ${a.path ? `<a class="small" href="/mock/${esc(a.id)}" target="_blank">előnézet ▸</a>` : ""}
              ${a.path ? `<a class="small" href="/configure/${esc(a.id)}" target="_blank">prospect-konfigurátor ▸</a>` : ""}
            </div>
            <div class="small mut" style="margin-top:8px">${inputs}</div>
            ${
              dec
                ? `<div class="small" style="margin-top:8px">Döntés: <b>${esc(dec.decision)}</b>
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
                     <button class="ok" type="submit">Jóváhagyás</button></form>
                   <form method="post" action="/artifact/${esc(a.id)}/curate">
                     <input type="hidden" name="decision" value="reject">
                     <button class="bad" type="submit">Elutasítás</button></form>
                 </div>`
            }
            ${
              a.status === "approved"
                ? conversion && conversion.sourceArtifactId === a.id
                  ? convertedBlock(conversion)
                  : convertForm(d.id, a.id, convertModules, convertFromOrder)
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
         <summary style="cursor:pointer;font-weight:600">Elutasított mockok (${rejected.length}) — kibontás</summary>
         <div style="margin-top:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:12px">${rejected.map(renderArtifact).join("")}</div>
       </details>`
    : "";
  const artifacts = d.artifacts.length
    ? `${active.map(renderArtifact).join("")}${rejectedBlock}`
    : `<div class="panel"><p class="mut">Még nincs generált mock ehhez a leadhez.</p></div>`;

  // Identity band: name + qualification + the at-a-glance facts an operator
  // needs BEFORE deciding what to do (where is it, how sure is the match, does
  // it have a mock, did outreach go out). Replaces the old wasteful "Lead" card.
  const latestMock = active[0] ?? d.artifacts[0];
  const sentCount = prospects.filter((p) => p.sentAt).length;
  const head = (d.raw ?? {}) as {
    country?: string;
    city?: string;
    website?: string;
  };
  const heroPanel = `
    <div class="panel con-lead-head">
      <div class="con-lead-head__id">
        <h1>${esc(d.name)}</h1>
        ${d.lifecycle === "disqualified" ? disqualifiedBadge() : qualBadge(d.qualification)}
      </div>
      <dl class="con-lead-facts">
        <div><dt>Ország</dt><dd>${head.country ? esc(head.country) : `<span class="mut">–</span>`}</dd></div>
        <div><dt>Város</dt><dd>${head.city ? esc(head.city) : `<span class="mut">–</span>`}</dd></div>
        <div><dt>Régió</dt><dd>${esc(d.region)}</dd></div>
        <div><dt>Cím</dt><dd>${d.address ? esc(d.address) : `<span class="mut">–</span>`}</dd></div>
        <div><dt>Honlap</dt><dd>${
          head.website
            ? `<a href="${esc(head.website)}" target="_blank" rel="noopener" class="con-src">${esc(hostOf(head.website))}${ic("external", 13)}</a>`
            : `<span class="mut">nincs</span>`
        }</dd></div>
        <div><dt>Match-konfidencia</dt><dd>${confCell(d.matchConfidence)}</dd></div>
        <div><dt>Mock</dt><dd>${
          latestMock
            ? `<span class="pill ${esc(latestMock.status)}">${esc(latestMock.status)}</span>`
            : `<span class="mut">nincs</span>`
        }</dd></div>
        <div><dt>Megkeresés</dt><dd>${
          prospects.length
            ? `${prospects.length} link${sentCount ? ` · <span class="pill approved">kiküldve</span>` : ""}`
            : `<span class="mut">nincs</span>`
        }</dd></div>
      </dl>
    </div>`;
  // Generate form is its OWN full-width panel with the preview BESIDE the controls,
  // so it stays short/wide instead of towering over the compact meta cards.
  const generatePanel = `
    <div class="panel">
      <h2>Mock ${d.artifacts.length ? "újragenerálása" : "generálása"}</h2>
      ${
        generating
          ? `<div class="row" style="margin-top:0"><span class="pill generated">generálás folyamatban…</span>
             <span class="mut small">~1-2 perc — az oldal automatikusan frissül</span></div>
             <script>setTimeout(function(){location.reload()},6000)</script>`
          : `<form method="post" action="/lead/${esc(d.id)}/generate"
                   onsubmit="var b=this.querySelector('button.gen-go');b.disabled=true;b.textContent='Indítás…'">
               <label class="small mut" style="display:block;margin-bottom:6px">Kinézet-típus — a kurátor dönt (ADR-0027): válaszd ki, melyik elrendezésre generáljuk a mockot</label>
               <div class="tpl-cards" role="radiogroup" aria-label="Kinézet-típus">
                 ${templateCards()}
               </div>
               <div class="gen-2col" style="margin-top:12px">
                 <div>
                   <label class="small mut" for="cp-in" style="display:block;margin-bottom:4px">Kurátor-prompt (opcionális — hangvétel/hangsúly; tényt nem adhat hozzá)</label>
                   <textarea id="cp-in" name="curatorPrompt" rows="4" maxlength="600"
                     placeholder="pl. családias, meleg hang; a borkóstolót és a teraszt emeld ki"
                     style="width:100%;padding:6px 8px;margin-bottom:10px;font-family:inherit;font-size:13px"></textarea>
                   <button class="gen-go" type="submit">Mock ${d.artifacts.length ? "újragenerálása" : "generálása"}</button>
                 </div>
                 <figure id="tpl-prev" style="margin:0">
                   <img id="tpl-prev-img" src="/assets/ui/tpl-fullbleed.jpg" alt="Sablon-előnézet"
                        onclick="citTplZoom()" style="width:100%;display:block;border:1px solid var(--citui-line);border-radius:8px;cursor:zoom-in">
                   <figcaption class="small mut" style="margin-top:4px">A kijelölt kinézet mintája (valós adattal) — kattints a nagyításhoz</figcaption>
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
  const body = `
    ${heroPanel}
    ${flashBanner}
    <div class="con-lead-grid">
      <div class="con-lead-main">
        <section id="ls-data">${leadDataPanel(d)}</section>
        <section id="ls-generate">${generatePanel}</section>
        ${ordersPanel ? `<section id="ls-orders">${ordersPanel}</section>` : ""}
        <section id="ls-mocks">
          <h2 id="mock-artifacts" style="margin:4px 4px 10px">Mock-artefaktumok${d.artifacts.length ? ` (${active.length} aktív${rejected.length ? ` · ${rejected.length} elutasított` : ""})` : ""}</h2>
          ${artifacts}
        </section>
      </div>
      <div class="con-lead-side">
        <section id="ls-photos">${leadPhotosPanel(d.id)}</section>
        <section id="ls-outreach">${prospectsPanel(prospects, d)}</section>
        <section id="ls-admin">${disqualifyPanel(d)}${provPanel}</section>
      </div>
    </div>
    ${galleryScript()}`;
  return layout(d.name, body, { active: "/leads" });
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
  return `<div id="cit-lb" class="cit-lb" hidden role="dialog" aria-modal="true" aria-label="Képnézegető">
      <div class="cit-lb__bar">
        <span class="cit-lb__cap" id="cit-lb-cap"></span>
        <button type="button" class="cit-lb__btn" id="cit-lb-x" aria-label="Bezárás (Esc)">×</button>
      </div>
      <button type="button" class="cit-lb__btn cit-lb__nav cit-lb__nav--prev" id="cit-lb-prev" aria-label="Előző (←)">‹</button>
      <div class="cit-lb__stage" id="cit-lb-stage"><img id="cit-lb-img" alt=""></div>
      <button type="button" class="cit-lb__btn cit-lb__nav cit-lb__nav--next" id="cit-lb-next" aria-label="Következő (→)">›</button>
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
        var id=inp.value,i=document.getElementById('tpl-prev-img');if(i)i.src='/assets/ui/tpl-'+id+'.jpg';
        var cards=document.querySelectorAll('.tpl-cards .tpl-card');for(var k=0;k<cards.length;k++)cards[k].classList.remove('on');
        var lab=inp.closest('.tpl-card');if(lab)lab.classList.add('on');
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
  const mods = v.modules.length
    ? v.modules.map((m) => `<span class="pill">${esc(m)}</span>`).join(" ")
    : `<span class="mut small">nincs aktív modul</span>`;
  const body = `
    <div class="panel">
      <h2>${esc(v.displayName)} — oldal-kezelő</h2>
      <div class="row" style="margin-top:0">
        <span class="pill approved">${esc(v.siteStatus)}</span>
        <a class="small" href="/site/${esc(v.previewToken)}" target="_blank">privát előnézet ▸</a>
      </div>
      <h3 class="mut small" style="margin-top:18px">Megvett modulok</h3>
      <div class="row">${mods}</div>
      <p class="mut small" style="margin-top:18px">Read-only pilot-nézet. A tartalom/kép szerkesztése és a
      nyilvános élesítés (fizetés-kapus) egyelőre ház-oldali, kézi lépés (A2).</p>
    </div>`;
  return layout(`${v.displayName} — kezelő`, body, { chrome: false });
}

/** Outreach draft page: §C gate verdict + pipeline send button + copy-ready fallback. */
export function outreachDraftPage(
  prospectId: string,
  input: { leadName: string; segment: string | null },
  draft: { subject: string; body: string; link: string },
  check: { verdict: "PASS" | "FLAG"; reasons: string[] },
  contactEmail: string | null = null,
  notice: { ok: boolean; text: string } | null = null,
  // ADR-0030: SMS channel (placeholder transport until the GSM module lands).
  channel: { sms: { text: string }; phone: string | null } | null = null,
): string {
  const pass = check.verdict === "PASS";
  const verdict = pass
    ? `<span class="pill approved">§C-kapu: PASS — küldhető</span>`
    : `<span class="pill rejected">§C-kapu: FLAG — NEM küldhető</span>`;
  const reasons = check.reasons.length
    ? `<ul class="small" style="margin-top:8px;color:var(--citui-bad)">${check.reasons
        .map((r) => `<li>${esc(r)}</li>`)
        .join("")}</ul>`
    : "";
  const noticeBlock = notice
    ? `<div class="row" style="margin-top:8px"><span class="pill ${notice.ok ? "approved" : "rejected"}">${esc(notice.text)}</span></div>`
    : "";
  // Pipeline send (B szelet): the button is a convenience — every guard
  // (status / unsubscribe / §C) re-runs server-side in sendOutreachMail.
  const sendBlock = pass
    ? contactEmail
      ? `<form method="post" action="/prospect/${esc(prospectId)}/send" style="margin-top:10px"
           onsubmit="return confirm('Kiküldöd a levelet erre a címre: ${esc(contactEmail)}?')">
           <button type="submit">📤 Küldés e-mailben — ${esc(contactEmail)}</button>
           <span class="small mut">pipeline: §C-kapu újra + HTML-levél + „sent" státusz (H1-bázis)</span>
         </form>
         <p class="mut small" style="margin-top:6px">VAGY kézi küldés (A2): másold a tárgyat + szöveget a
            levelezőbe, küldés után a lead-oldalon a „Kiküldve" gomb.</p>`
      : `<p class="mut small">Pipeline-küldéshez adj meg contact e-mailt a lead-oldal Megkeresés-paneljén;
         addig kézi küldés (A2): másold a tárgyat + szöveget a levelezőbe, küldés után „Kiküldve" gomb.</p>`
    : `<p class="mut small">A FLAG-okok rendezéséig a levél nem küldhető ki (03-INVARIANTS §C).
       Tipikus ok: hiányzó PUBLIC_BASE_URL vagy OUTREACH_SENDER_* env.</p>`;
  // SMS channel (ADR-0030): PLACEHOLDER transport — the GSM module is a later slice. Gated by
  // the same §C PASS (the link/opt-out must be reachable on either channel).
  const smsBlock = !channel
    ? ""
    : pass
      ? `<label class="small mut">SMS szövege</label>
         <textarea id="smsbody" readonly rows="4" style="width:100%;font:13px/1.5 ui-monospace,monospace">${esc(channel.sms.text)}</textarea>
         <form method="post" action="/prospect/${esc(prospectId)}/send-sms" style="margin-top:8px"
           onsubmit="return confirm('SMS-re jelölöd? PLACEHOLDER — valódi SMS még nem megy ki.')">
           <button type="submit"${channel.phone ? "" : " disabled"}>Küldés SMS-ben${channel.phone ? ` — ${esc(channel.phone)}` : " (nincs szám)"}</button>
           <button type="button" class="small" style="margin-left:8px" onclick="navigator.clipboard.writeText(document.getElementById('smsbody').value);this.textContent='másolva'">szöveg másolása</button>
         </form>
         <p class="mut small" style="margin-top:6px">PLACEHOLDER: a GSM-modul még nincs bekötve — a gomb csak „sent"-re jelöl (mérés indul), valódi SMS NEM megy ki.${channel.phone ? "" : " Adj meg telefonszámot a lead Begyűjtött adatok paneljén."}</p>`
      : `<p class="mut small">A §C-FLAG rendezéséig SMS sem küldhető.</p>`;
  const channelBlock = `<div style="margin-top:10px">
      <div class="small mut" style="margin-bottom:6px">Küldési csatorna — válaszd, hogyan menjen ki:</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px">
        <div style="border:1px solid var(--citui-line);border-radius:10px;padding:14px">
          <div class="row" style="margin-top:0"><b>E-mail</b> ${contactEmail ? `<span class="pill approved">cím megvan</span>` : `<span class="pill">nincs cím</span>`}</div>
          <form method="post" action="/prospect/${esc(prospectId)}/contact-email" class="row" style="margin-top:8px;gap:8px;flex-wrap:wrap">
            <input type="email" name="email" value="${contactEmail ? esc(contactEmail) : ""}" placeholder="címzett e-mail címe" style="flex:1;min-width:220px;padding:7px 9px">
            <button type="submit">Cím mentése</button>
          </form>
          ${sendBlock}
        </div>
        <div style="border:1px solid var(--citui-line);border-radius:10px;padding:14px">
          <div class="row" style="margin-top:0"><b>SMS</b> <span class="pill">placeholder</span></div>
          ${smsBlock}
        </div>
      </div>
    </div>`;
  const body = `
    <div class="panel">
      <h2>Outreach-piszkozat — ${esc(input.leadName)}${input.segment ? ` <span class="pill">${esc(input.segment)}</span>` : ""}</h2>
      <div class="row">${verdict}</div>
      ${noticeBlock}
      ${reasons}
      ${channelBlock}
      <div style="margin-top:14px">
        <label class="small mut">Tárgy</label>
        <div class="row" style="margin-top:4px">
          <input id="subj" type="text" readonly value="${esc(draft.subject)}" style="flex:1;min-width:320px">
          <button type="button" onclick="navigator.clipboard.writeText(document.getElementById('subj').value);this.textContent='másolva'">másolás</button>
        </div>
      </div>
      <div style="margin-top:14px">
        <label class="small mut">Így néz ki a levél a címzett postafiókjában (HTML-előnézet)</label>
        <iframe src="/prospect/${esc(prospectId)}/email-preview" title="E-mail előnézet"
          style="width:100%;height:560px;border:1px solid var(--citui-line-strong);border-radius:10px;background:var(--citui-white);margin-top:4px"></iframe>
        <div class="row" style="margin-top:4px">
          <a class="small" href="/prospect/${esc(prospectId)}/email-preview" target="_blank">előnézet külön lapon ▸</a>
        </div>
      </div>
      <div style="margin-top:12px">
        <label class="small mut">Levél szövege (text-változat — kézi küldéshez másolható)</label>
        <div style="margin-top:4px">
          <textarea id="mailbody" readonly rows="22" style="width:100%;font:13px/1.5 ui-monospace,monospace">${esc(draft.body)}</textarea>
        </div>
        <div class="row" style="margin-top:6px">
          <button type="button" onclick="navigator.clipboard.writeText(document.getElementById('mailbody').value);this.textContent='másolva'">szöveg másolása</button>
          <a class="small" href="${esc(draft.link)}" target="_blank">követett link megnyitása ▸</a>
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
  const v = (s: string, ph: string) => (s ? esc(s) : `<b>[KITÖLTENDŐ: ${ph}]</b>`);
  const body = `
    <div class="panel" style="max-width:760px;margin:0 auto">
      <h2>Adatkezelési tájékoztató</h2>
      <div class="small" style="line-height:1.7">
        <p><b>1. Adatkezelő.</b> ${v(sender.company, "cégnév")} — kapcsolattartó: ${v(sender.name, "név")},
        e-mail: ${v(sender.email, "e-mail")}${sender.phone ? `, telefon: ${esc(sender.phone)}` : ""}.</p>

        <p><b>2. Milyen adatokat kezelünk és honnan?</b> Vállalkozása <b>nyilvánosan elérhető</b> üzleti
        adatait (név, cím, elérhetőség, fotók, értékelések) gyűjtöttük össze nyilvános forrásokból
        (Google Térkép, szállás-portálok, saját weboldal) — GDPR 14. cikk szerinti, nem az érintettől
        származó adatgyűjtés. Emellett a megkeresésünkben küldött előnézeti link megnyitásakor
        <b>megtekintési adatokat</b> rögzítünk: megnyitás ténye és ideje, görgetés, a kipróbált
        elemek, böngésző-azonosító (user-agent). Sütit nem használunk.</p>

        <p><b>3. Cél és jogalap.</b> Cél: személyre szabott üzleti ajánlat (honlap-látványterv) készítése
        és bemutatása, valamint az érdeklődés mérése az ajánlat igényekhez igazításához. Jogalap:
        <b>jogos érdek</b> (GDPR 6. cikk (1) f) — üzleti kapcsolat kezdeményezése vállalkozásokkal;
        Grt. 6. §). Az adatok kizárólag e célra szolgálnak, harmadik félnek nem adjuk át.</p>

        <p><b>4. Megőrzés.</b> A megkeresési kampány lezárultáig, de legfeljebb 12 hónapig; leiratkozás
        esetén a további megkeresést és mérést azonnal leállítjuk, elérhetőségét tiltólistán őrizzük
        (hogy ne keressük meg újra).</p>

        <p><b>5. Az Ön jogai.</b> Kérheti a hozzáférést, helyesbítést, törlést, az adatkezelés
        korlátozását, és <b>tiltakozhat</b> a jogos érdeken alapuló adatkezelés ellen — a fenti
        elérhetőségeken, vagy egy kattintással a levélben található leiratkozó-linken. Panaszt tehet a
        Nemzeti Adatvédelmi és Információszabadság Hatóságnál (NAIH — naih.hu, 1055 Budapest,
        Falk Miksa u. 9–11.).</p>

        <p class="mut">A megkeresésben linkelt oldal <b>előzetes látványterv</b> (nem kész, nem élő
        honlap), amely a fenti nyilvános adatokból készült, és semmilyen kötelezettséggel nem jár.</p>
      </div>
    </div>`;
  return layout("Adatkezelési tájékoztató", body, { chrome: false });
}

// ── Prospect activity timeline (what the lead actually did on the /p page) ────

import type { ProspectActivity } from "./data.js";

/** Human labels for the instrumentation event types (06-UI-CONTRACT beacons). */
const EVENT_LABEL: Readonly<Record<string, string>> = {
  open: "megnyitotta az oldalt",
  scroll: "görgetett",
  dwell: "olvasta az oldalt",
  dwell_end: "elhagyta az oldalt",
  panel_open: "megnyitotta a konfigurátort",
  module_add: "bekapcsolt egy modult",
  module_remove: "kikapcsolt egy modult",
  preset_select: "csomagot választott",
  period_select: "fizetési ciklust váltott",
  domain_select: "domain-típust választott",
  domain_pick: "domainnevet választott",
  photo_rights_declared: "elfogadta a fotó-jog nyilatkozatot",
  order_intent_submitted: "ELKÜLDTE A MEGRENDELÉST",
  checkout_redirect: "továbbment a fizetéshez",
};

/** Prospect activity page: sessions + event timeline + derived intent signals. */
export function prospectActivityPage(a: ProspectActivity): string {
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
    if (e.type === "period_select") return p.period === "annual" ? "éves" : "havi";
    if (e.type === "domain_select") return p.choice === "custom" ? "saját domain" : "citoviso.com aldomain";
    if (e.type === "domain_pick") return esc(p.domain);
    if (e.type === "order_intent_submitted")
      return `${esc(p.modules)} modul · ${p.period === "annual" ? "éves" : "havi"}`;
    return "";
  };

  const totalEvents = a.sessions.reduce((n, s) => n + s.events.length, 0);
  const bestScroll = a.sessions.reduce((m, s) => Math.max(m, s.maxScroll), 0);
  const bestDwell = a.sessions.reduce((m, s) => Math.max(m, s.maxDwell), 0);

  // Intent summary — the "mit csinált" answer at a glance.
  const on = a.moduleToggles.filter((m) => m.on).map((m) => modLabel(m.module));
  const off = a.moduleToggles.filter((m) => !m.on).map((m) => modLabel(m.module));
  const signals = [
    `<dt>Megnyitások</dt><dd>${a.sessions.length} látogatás · ${totalEvents} esemény</dd>`,
    `<dt>Legmélyebb görgetés</dt><dd>${bestScroll ? `${bestScroll}%` : `<span class="mut">–</span>`}</dd>`,
    `<dt>Leghosszabb olvasás</dt><dd>${bestDwell ? `${bestDwell} másodperc` : `<span class="mut">–</span>`}</dd>`,
    `<dt>Választott csomag</dt><dd>${a.preset ? `<b>${esc(a.preset)}</b>` : `<span class="mut">nem választott</span>`}</dd>`,
    `<dt>Fizetési ciklus</dt><dd>${a.period ? (a.period === "annual" ? "éves" : "havi") : `<span class="mut">–</span>`}</dd>`,
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
              const label = EVENT_LABEL[e.type] ?? e.type;
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
              <span class="mut small" style="font-weight:400">· ${s.events.length} esemény${s.maxScroll ? ` · ${s.maxScroll}% görgetés` : ""}${s.maxDwell ? ` · ${s.maxDwell} mp olvasás` : ""}</span>
            </summary>
            <div class="tblwrap"><table style="margin-top:10px"><tbody>${rows || `<tr><td class="mut small">nincs esemény</td></tr>`}</tbody></table></div>
            ${s.referrer ? `<p class="mut small" style="margin-top:8px">Forrás: ${esc(s.referrer)}</p>` : ""}
          </details>`;
        })
        .join("")
    : `<div class="panel"><p class="mut">Még nem nyitotta meg a linket — nincs mérési adat.</p></div>`;

  const body = `
    <div class="panel">
      <h2>Tevékenység — ${esc(a.leadName)}</h2>
      <div class="row" style="margin-top:0">
        <span class="pill ${a.status === "order_intent" || a.status === "converted" ? "approved" : ""}">${esc(a.status)}</span>
        ${a.sentAt ? `<span class="pill approved">✓ e-mail kiküldve · ${dmy(a.sentAt)}</span>` : `<span class="pill">e-mail még nem ment ki</span>`}
        <a class="small" href="/lead/${esc(a.leadId)}">◂ vissza a leadhez</a>
        <a class="small" href="/p/${esc(a.token)}" target="_blank">a látott oldal ▸</a>
      </div>
      <dl class="kv" style="margin-top:14px">${signals}</dl>
    </div>
    ${sessionBlocks}`;
  return layout(`Tevékenység — ${a.leadName}`, body, { active: "/leads" });
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
  const regionOpts = regions
    .map((r) => `<option value="${esc(r.id)}">${esc(r.label)}</option>`)
    .join("");
  const startForm = job.running
    ? `<p class="mut">Fut: <strong>${esc(job.regionId ?? "?")}</strong> (indult: ${job.startedAt?.toLocaleTimeString("hu-HU") ?? "?"}) — az oldal 3 mp-enként frissül.</p>`
    : `<form method="post" action="/scrape/start" class="row" style="gap:8px;flex-wrap:wrap">
        <label>Régió <select name="region">${regionOpts}</select></label>
        <label>Cap <input type="number" name="cap" min="1" placeholder="pl. 40" style="width:90px"></label>
        <button type="submit">Scrape indítása</button>
        <span class="small mut">A futás Google Places API-hívásokkal jár (költség) — a cap ezt korlátozza.</span>
      </form>`;
  const logBlock = job.log.length
    ? `<div style="margin-top:12px"><label class="small mut">Napló${job.running ? " (élő)" : job.exitCode === 0 ? " — ✅ sikeres futás" : ` — ⛔ exit ${job.exitCode}`}</label>
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
      <h2>Scrape indítása</h2>
      ${notice ? `<div class="row"><span class="pill rejected">${esc(notice)}</span></div>` : ""}
      ${startForm}
      ${logBlock}
    </div>
    <div class="panel">
      <h2>Korábbi futások</h2>
      <div class="tblwrap"><table><thead><tr><th>Régió</th><th>Státusz</th><th>Indult</th><th>Szereplő</th><th>Lead</th><th>Hiba</th></tr></thead>
      <tbody>${runRows || `<tr><td colspan="6" class="mut">Még nincs futás.</td></tr>`}</tbody></table></div>
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
  const t = r.total;
  const hyp = `<table style="margin-top:8px">
    <thead><tr><th>Hipotézis</th><th>Mérőszám</th><th>Küszöb (PILOT.md §4)</th><th>Most</th></tr></thead>
    <tbody>
      <tr><td>H1 — horog</td><td>megnyitás / kiküldött</td><td>érdemben magasabb a sima szövegnél</td><td>${pct(t.openedOfSent, t.sent)} (${t.openedOfSent}/${t.sent})</td></tr>
      <tr><td>H2 — engagement</td><td>visszatérő / megnyitó</td><td>&gt; ~30%</td><td>${pct(t.returned, t.opened)} (${t.returned}/${t.opened})</td></tr>
      <tr><td>H3 — konfigurátor</td><td>modul-hozzáadó / megnyitó</td><td>&gt; ~20%</td><td>${pct(t.moduleTouched, t.opened)} (${t.moduleTouched}/${t.opened})</td></tr>
      <tr><td>H4 — szegmens</td><td>order-intent arány szegmensenként</td><td>nincs_honlap/0_labnyom magasabb</td><td>lásd lenti bontás</td></tr>
      <tr><td>H5 — konverzió</td><td>order-intent / kiküldött</td><td>&gt; ~3–5%</td><td>${pct(t.orderIntentOfSent, t.sent)} (${t.orderIntentOfSent}/${t.sent})</td></tr>
    </tbody></table>`;
  const segRows = r.segments.map((s) => funnelRow(s.segment, s)).join("");
  const head = `<thead><tr><th>Szegmens</th><th>Prospect</th><th>Kiküldve</th><th>Megnyitva</th><th>Visszatért</th><th>Modul-piszkált</th><th>Order-intent</th><th>Konvertált</th><th>Leiratk.</th></tr></thead>`;
  const body = `
    <div class="panel">
      <h2>Pilot-tölcsér (H1–H5)</h2>
      <p class="mut small">Alap-készlet: ${r.leadTotals.players} felmért szereplő · ${r.leadTotals.leads} kvalifikált lead ·
        ${r.leadTotals.mocks} mock (${r.leadTotals.approved} jóváhagyott) · ${t.prospects} követett prospect.</p>
      <div class="tblwrap">${hyp}</div>
    </div>
    <div class="panel">
      <h2>Szegmens-bontás (H4)</h2>
      <div class="tblwrap"><table>${head}<tbody>${funnelRow("ÖSSZES", t)}${segRows}</tbody></table></div>
      <p class="mut small">A tölcsér sosem regresszál (0009): a szám a legalább elért állapotot jelenti.</p>
    </div>`;
  return layout("Pilot-riport", body, { active: "/report" });
}

/** Dashboard (Vezérlőpult): the console home — big numbers + where to go. */
export function dashboardPage(
  r: FunnelReport,
  scrapeRunning: boolean,
  operatorName: string,
): string {
  const t = r.total;
  const card = (href: string, n: string | number, label: string) =>
    `<a class="con-card" href="${href}"><div class="n">${n}</div><div class="l">${esc(label)}</div></a>`;
  const body = `
    <section class="con-hero">
      <p class="eyebrow">Vezérlőpult</p>
      <h1>Szia, ${esc(operatorName)}!</h1>
      <p>Itt minden elérhető a felső menüből is — semmit nem kell megjegyezni.</p>
    </section>
    <div class="con-cards" style="margin-bottom:18px">
        ${card("/leads", r.leadTotals.players, "felmért szereplő")}
        ${card("/leads?qualification=no_site", r.leadTotals.leads, "kvalifikált lead")}
        ${card("/leads?mock=approved", `${r.leadTotals.approved}/${r.leadTotals.mocks}`, "jóváhagyott / összes mock")}
        ${card("/report", t.sent, "kiküldött megkeresés")}
        ${card("/report", t.orderIntent, "order-intent")}
        ${card("/scrape", scrapeRunning ? "FUT" : "áll", "scrape állapota")}
    </div>
    <div class="panel">
      <h2>Merre tovább</h2>
      <table><tbody>
        <tr><td><a href="/leads">Leadek</a></td><td class="mut">lista, szűrés, lead-lap: mock-generálás · kuráció · megkeresés · konverzió</td></tr>
        <tr><td><a href="/scrape">Scrape</a></td><td class="mut">új régió felmérése a felületről, élő naplóval</td></tr>
        <tr><td><a href="/report">Riport</a></td><td class="mut">pilot-tölcsér (H1–H5) + szegmens-bontás</td></tr>
      </tbody></table>
    </div>`;
  return layout("Vezérlőpult", body, { active: "/" });
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
const QUAL_LABEL: Record<string, string> = {
  no_site: "nincs honlapja",
  outdated: "elavult honlap",
  modern: "modern honlap",
  unknown: "ismeretlen",
};

/**
 * Map of everything scraped so far: one dot per geo-located lead (coloured by
 * website qualification) plus the scrape areas as rectangles — so coverage and
 * blank spots are visible at a glance.
 */
export function mapPage(
  leads: ReadonlyArray<import("./data.js").MapLead>,
  regions: ReadonlyArray<import("./data.js").RegionRow>,
): string {
  const legend = Object.entries(QUAL_LABEL)
    .map(
      ([k, label]) =>
        `<span class="mut small" style="margin-right:14px"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${QUAL_COLOR[k]};margin-right:5px"></span>${esc(label)}</span>`,
    )
    .join("");
  const body = `
    ${scrapeTabs("/scrape/map")}
    <div class="panel">
      <h2>Eddig felderített leadek</h2>
      <p class="mut small" style="margin:-2px 0 10px">${leads.length} lead a térképen · ${regions.length} terület</p>
      <div>${legend}</div>
      <div id="map" style="height:70vh;min-height:420px;margin-top:12px;border-radius:10px;overflow:hidden"></div>
      ${leads.length ? "" : `<p class="mut" style="margin-top:12px">Még nincs koordinátás lead. Indíts egy scrape-et a <a href="/scrape">Scrape</a> oldalon.</p>`}
    </div>
    ${LEAFLET_JS}
    <script>
      var LEADS = ${JSON.stringify(leads)};
      var AREAS = ${JSON.stringify(regions)};
      var COLORS = ${JSON.stringify(QUAL_COLOR)};
      var LABELS = ${JSON.stringify(QUAL_LABEL)};
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
          '<br><a href="/lead/' + l.id + '">Lead megnyitása</a>'
        ).addTo(map);
        bounds.push([l.lat, l.lon]);
      });
      if (bounds.length) map.fitBounds(bounds, { padding: [30, 30] });
    </script>`;
  return layout("Térkép", body, { active: "/scrape", head: LEAFLET_HEAD });
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
  const rows = regions.length
    ? regions
        .map(
          (r) => `<tr${r.active ? "" : ' style="opacity:.5"'}>
        <td><b>${esc(r.label)}</b><div class="mut small"><code>${esc(r.id)}</code></div></td>
        <td class="mut small">${
          r.radiusKm != null && r.centerLat != null && r.centerLon != null
            ? `${r.radiusKm.toFixed(1)} km sugár<br>${r.centerLat.toFixed(4)}, ${r.centerLon.toFixed(4)}`
            : `${r.south.toFixed(3)}, ${r.west.toFixed(3)} — ${r.north.toFixed(3)}, ${r.east.toFixed(3)}`
        }</td>
        <td>${r.leadCount}</td>
        <td>${r.active ? '<span class="pill approved">aktív</span>' : '<span class="pill">inaktív</span>'}</td>
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
    : `<tr><td colspan="5" class="mut">Még nincs terület.</td></tr>`;

  const body = `
    ${scrapeTabs("/scrape/regions")}
    ${notice ? `<div class="panel" style="margin-bottom:14px"><span class="pill approved">${esc(notice)}</span></div>` : ""}
    <div class="panel">
      <h2 style="margin-top:0">Scrape-terület kijelölése</h2>
      <p class="mut small" style="margin-top:0">Írj be egy települést vagy címet, majd állítsd be,
        hány kilométeres körzetben keressünk. A térképre kattintva is áthelyezheted a középpontot.</p>

      <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <input id="q" placeholder="Település vagy cím — pl. Eger, Kossuth utca 5" style="flex:1;min-width:260px">
        <button type="button" class="btn" onclick="citSearch()">Keresés</button>
        <span id="qmsg" class="mut small" style="align-self:center"></span>
      </div>

      <div id="map" style="height:52vh;min-height:340px;border-radius:10px;overflow:hidden;margin-bottom:12px"></div>

      <form method="post" action="/scrape/regions" id="areaForm">
        <div class="row" style="gap:12px;flex-wrap:wrap;align-items:flex-end">
          <div><label class="small mut" for="label">Terület neve</label><br>
            <input id="label" name="label" required placeholder="pl. Eger és környéke" style="min-width:240px"></div>
          <div><label class="small mut" for="id">Azonosító (URL-barát)</label><br>
            <input id="id" name="id" required pattern="[a-z0-9-]+" placeholder="eger" style="min-width:160px"></div>
        </div>
        <div style="margin-top:14px">
          <label class="small mut" for="radiusKm">Keresési sugár: <b id="rval">10</b> km</label><br>
          <input id="radiusKm" name="radiusKm" type="range" min="1" max="50" step="1" value="10"
                 style="width:min(420px,100%);accent-color:var(--citui-cyan-500)">
          <div class="mut small">Nagyobb sugár = több találat, de több Google Places-hívás (költség).</div>
        </div>
        <div class="row" style="gap:10px;flex-wrap:wrap;margin-top:12px;align-items:flex-end">
          <div><label class="small mut" for="centerLat">Középpont szélesség</label><br>
            <input id="centerLat" name="centerLat" required readonly style="width:140px"></div>
          <div><label class="small mut" for="centerLon">Középpont hosszúság</label><br>
            <input id="centerLon" name="centerLon" required readonly style="width:140px"></div>
          <label class="small mut" style="align-self:flex-end"><input type="checkbox" name="active" checked> aktív</label>
        </div>
        <div style="margin-top:14px"><button type="submit">Terület mentése</button>
          <span class="mut small" style="margin-left:10px">Meglévő azonosító = felülírás.</span></div>
      </form>
    </div>
    <div class="panel">
      <h2>Területek</h2>
      <div class="tblwrap"><table class="tbl"><thead><tr>
        <th>Név</th><th>Terület</th><th>Lead</th><th>Állapot</th><th></th>
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
  return layout("Területek", body, { active: "/scrape", head: LEAFLET_HEAD });
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
export function duplicatesPage(clusters: DupClusterView[]): string {
  const SIGNAL_LABEL: Record<string, string> = {
    website: "közös honlap",
    phone: "közös telefon",
    email: "közös e-mail",
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
          ? `<p class="small" style="margin:6px 0 0;color:var(--citui-bad)">⚠️ ${(c.maxDistanceM / 1000).toFixed(1)} km választja el őket — több telephely vagy közös ügynökségi oldal lehet, nem ugyanaz az üzlet.</p>`
          : "";
      return `<div class="panel dup-card">
        <h2>${c.leads.length} összetartozónak látszó rekord</h2>
        <p class="small mut" style="margin:0 0 8px">Jelek: ${sig}${
          c.maxDistanceM != null ? ` · legtávolabbi pár: ${c.maxDistanceM} m` : ""
        }</p>
        ${far}
        <form method="post" action="/duplicates/rule">
          <input type="hidden" name="cluster" value="${esc(c.id)}">
          <input type="hidden" name="pairs" value="${esc(JSON.stringify(c.pairs))}">
          <input type="hidden" name="signal" value="${esc(c.signals.join("+"))}">
          <div class="dup-leads">${rows}</div>
          <p class="small mut" style="margin:8px 0 6px">A rádiógomb csak az „ugyanaz" döntéshez kell: azt jelöld be, amelyiket MEGTARTJUK — a többi elérhetősége átkerül hozzá.</p>
          <div class="row dup-actions">
            <button type="submit" name="verdict" value="duplicate">Ugyanaz — összevonás</button>
            <button type="submit" name="verdict" value="same_owner" class="ghost">Egy tulaj több egysége</button>
            <button type="submit" name="verdict" value="unrelated" class="ghost">Nem tartozik össze</button>
          </div>
        </form>
      </div>`;
    })
    .join("");
  const body = `
    <div class="panel">
      <h2>Duplikátum-ellenőrzés</h2>
      <p class="small mut" style="margin:0">Ugyanaz a vállalkozás többször is bekerülhet a listába — más néven,
        a tulaj neve alatt, vagy épületenként. A gép csak <b>javasol</b>; a döntést te hozod, és megjegyezzük,
        így ugyanazt a csoportot nem kérdezzük meg még egyszer.</p>
    </div>
    ${cards || `<div class="panel"><p class="mut">Nincs eldöntetlen gyanús csoport.</p></div>`}`;
  return layout("Duplikátumok", body, { active: "/duplicates" });
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
