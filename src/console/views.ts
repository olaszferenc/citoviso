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

/** HUF formatter (thin-space grouping) for the operator views. */
function fmtHuf(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " Ft";
}

// Module catalog (05-MODULES.md) offered at conversion. Single-sourced in
// ../modules.js so the operator convert form and the prospect configurator
// never drift on module ids (they feed module_entitlement).
export { MODULE_CATALOG } from "../modules.js";
import { MODULE_CATALOG, GROUP_LABELS } from "../modules.js";
import type { PricingSnapshot } from "../pricing.js";

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

/** Persistent menu — every internal page carries it; nothing to memorize. */
const MENU: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/", label: "Vezérlőpult" },
  { href: "/leads", label: "Leadek" },
  { href: "/scrape", label: "Scrape" },
  { href: "/report", label: "Riport" },
  { href: "/pricing", label: "Árazás" },
  { href: "/settings", label: "Beállítások" },
];

export interface LayoutOpts {
  /** Menü-kiemelés: az aktív menüpont href-je. */
  readonly active?: string;
  /** false → prospect/tenant-facing page: brand only, NO internal menu. */
  readonly chrome?: boolean;
}

export function layout(title: string, body: string, opts: LayoutOpts = {}): string {
  const chrome = opts.chrome !== false;
  const nav = chrome
    ? `<nav class="con-nav">${MENU.map(
        (m) =>
          `<a href="${m.href}"${m.href === opts.active ? ` class="active"` : ""}>${esc(m.label)}</a>`,
      ).join("")}</nav>
       <div class="con-user"><a href="/logout">Kilépés</a></div>`
    : "";
  return `<!doctype html><html lang="hu"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — Citoviso konzol</title>
<link rel="stylesheet" href="/assets/ui/citui.css">
<link rel="stylesheet" href="/assets/ui/citui-console.css"></head>
<body class="con"><header class="con-top">${BRAND}${nav}</header>
<main class="con-main">${body}</main></body></html>`;
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
<link rel="stylesheet" href="/assets/ui/citui.css">
<link rel="stylesheet" href="/assets/ui/citui-console.css">${PW_TOGGLE_JS}</head>
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
 *  HUF prices here and flips the "confirmed" gate that unlocks price-advertising
 *  outreach (§C). Grouped by the same prospect-facing groups as the configurator. */
export function pricingPage(
  snap: PricingSnapshot,
  notice: { ok: boolean; text: string } | null = null,
): string {
  const priceInput = (name: string, value: number, suffix: string): string =>
    `<div class="row" style="gap:6px;align-items:center">
      <input name="${esc(name)}" type="number" min="0" step="1" inputmode="numeric"
        value="${esc(value)}" style="width:120px;text-align:right">
      <span class="mut small">${esc(suffix)}</span>
    </div>`;

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

  const body = `
    <div class="panel" style="max-width:720px">
      <h2>Árazás</h2>
      <p class="mut small" style="margin-top:-4px">
        Ez az árazás EGYETLEN forrása — a konfigurátor, a megrendelés-rögzítés és a levél
        ár-sora is innen olvas. Mentés után azonnal él (a nyilvános oldal ~10 mp-en belül veszi át).</p>
      ${notice ? `<div class="row" style="margin:0 0 12px"><span class="pill ${notice.ok ? "approved" : "rejected"}">${esc(notice.text)}</span></div>` : ""}
      <div class="row" style="margin:0 0 14px">${confirmNote}</div>

      <form method="post" action="/pricing">
        <h3>Alap-előfizetés</h3>
        <table class="kv" style="width:100%">
          <tr><td>Alapdíj (a gerinccel együtt)</td><td>${priceInput("base_monthly", snap.baseMonthly, "Ft / hó")}</td></tr>
          <tr><td>Éves előrefizetés — ingyen hónapok</td><td>${priceInput("annual_free_months", snap.annualFreeMonths, "hónap (pl. 2 = „2 hónap ingyen”)")}</td></tr>
          <tr><td>Saját domain (rajtunk keresztül)</td><td>${priceInput("custom_domain_yearly", snap.customDomainYearly, "Ft / év")}</td></tr>
        </table>

        <h3 style="margin-top:18px">Modul-felárak (havi)</h3>
        <table class="kv" style="width:100%">${groupRows}</table>

        <label class="row" style="gap:8px;align-items:center;margin:16px 0 4px">
          <input type="checkbox" name="pricing_confirmed"${snap.pricingConfirmed ? " checked" : ""}>
          <span><strong>Az árak véglegesek, élesíthetők</strong>
            <span class="mut small">— enélkül a levél nem hirdethet árat (Fttv./§C-kapu).</span></span>
        </label>

        <div class="row" style="margin-top:12px">
          <button class="ok" type="submit">Árazás mentése</button>
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
    if (v != null && v !== "") p.set(k, String(v));
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
  return `<select name="${name}">${opts
    .map(
      ([v, l]) =>
        `<option value="${esc(v)}"${(current ?? "") === v ? " selected" : ""}>${esc(l)}</option>`,
    )
    .join("")}</select>`;
}

export function leadsPage(rows: LeadListRow[], q: LeadQuery = {}): string {
  const filters = `<form method="get" class="filters">
    ${q.sort ? `<input type="hidden" name="sort" value="${esc(q.sort)}">` : ""}
    ${q.dir ? `<input type="hidden" name="dir" value="${esc(q.dir)}">` : ""}
    <label>Kvalifikáció ${sel("qualification", q.qualification, [["", "mind"], ["no_site", "no_site"], ["outdated", "outdated"], ["modern", "modern"], ["unknown", "unknown"]])}</label>
    <label>Kontakt ${sel("contact", q.contact, [["", "mind"], ["email", "email"], ["sms", "sms"], ["voice", "voice"], ["none", "none"]])}</label>
    <label>Mock ${sel("mock", q.mock, [["", "mind"], ["none", "nincs"], ["generated", "generated"], ["approved", "approved"], ["rejected", "rejected"]])}</label>
    <label>Min. fotó <input type="number" name="minPhotos" min="0" style="width:74px" value="${q.minPhotos ?? ""}"></label>
    <label>&nbsp;<button type="submit">Szűrés</button></label>
    <label>&nbsp;<a class="small" href="/leads">Törlés</a></label>
  </form>`;

  const head = `<thead><tr>
    <th>${sortHead("Név", "name", q)}</th>
    <th>Régió</th>
    <th>${sortHead("Kvalifikáció", "qualification", q)}</th>
    <th>${sortHead("Fotók", "photos", q)}</th>
    <th>${sortHead("Anyag", "material", q)}</th>
    <th>${sortHead("Match", "match", q)}</th>
    <th>${sortHead("Kontakt", "contact", q)}</th>
    <th>${sortHead("Mock", "mock", q)}</th>
  </tr></thead>`;

  const bodyRows = rows.length
    ? rows
        .map(
          (r) => `<tr>
        <td><a href="/lead/${esc(r.id)}">${esc(r.name)}</a></td>
        <td class="small mut">${esc(r.region)}</td>
        <td>${r.qualification ? `<span class="pill ${esc(r.qualification)}">${esc(r.qualification)}</span>` : `<span class="mut">–</span>`}</td>
        <td class="num">${photoCell(r.photos, r.streetView)}</td>
        <td class="num mut">${r.material || "–"}</td>
        <td class="num">${confCell(r.matchConfidence)}</td>
        <td class="small">${contactCell(r.contact)}</td>
        <td>${
          r.latestArtifact
            ? `<span class="pill ${esc(r.latestArtifact.status)}">${esc(r.latestArtifact.status)}</span>`
            : `<span class="mut small">nincs</span>`
        }</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="8" class="mut" style="padding:24px">Nincs a szűrőnek megfelelő lead. <a href="/">Szűrők törlése</a></td></tr>`;

  const body = `<div class="panel"><h2>Leadek (${rows.length})</h2>
    ${filters}
    <table>${head}<tbody>${bodyRows}</tbody></table></div>`;
  return layout("Leadek", body, { active: "/leads" });
}

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

/** Convert form (module checkboxes) for an approved, not-yet-converted artifact. */
function convertForm(leadId: string, artifactId: string): string {
  const boxes = MODULE_CATALOG.map(
    (m) =>
      `<label class="small" style="display:inline-flex;gap:6px;align-items:center;margin:2px 10px 2px 0">
        <input type="checkbox" name="module" value="${esc(m.id)}"${m.spine ? " checked" : ""}>
        ${esc(m.label)}</label>`,
  ).join("");
  return `<form method="post" action="/lead/${esc(leadId)}/convert" style="margin-top:10px">
      <input type="hidden" name="artifactId" value="${esc(artifactId)}">
      <div class="mut small" style="margin-bottom:6px">Megrendelt modulok:</div>
      <div style="margin-bottom:8px">${boxes}</div>
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
      return `<div style="padding:8px 0;border-bottom:1px solid var(--line)">
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

/** Result page after the mock pay page (paid → activation happened). */
export function payResultPage(paid: boolean, activated: boolean): string {
  const body = paid
    ? `<div class="panel" style="max-width:440px;margin:48px auto;text-align:center">
        <h2 class="q-good">Sikeres fizetés</h2>
        <p>${
          activated
            ? "Az oldala <b>éles</b> állapotba került (a publikus hoszting külön szelet)."
            : "A fizetés rögzült. Aktiválás nem futott le — jóváhagyott mock-artefaktum kell hozzá."
        }</p></div>`
    : `<div class="panel" style="max-width:440px;margin:48px auto;text-align:center">
        <h2 class="q-bad">Fizetés elutasítva</h2>
        <p class="mut">Nem történt terhelés. A fizetési kérés újraküldhető.</p></div>`;
  return layout(paid ? "Fizetés kész" : "Fizetés elutasítva", body, { chrome: false });
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
      return `<div style="padding:8px 0;border-bottom:1px solid var(--line)">
        <div class="row" style="justify-content:space-between;margin-top:0">
          <span>
            <span class="pill ${p.status === "order_intent" || p.status === "converted" ? "approved" : ""}">${esc(p.status)}</span>
            ${p.segment ? `<span class="pill">${esc(p.segment)}</span>` : ""}
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
          ${!p.unsubscribedAt ? `<a class="small" href="/prospect/${esc(p.id)}/draft">email-piszkozat (§C-kapu) ▸</a>` : ""}
          ${
            p.status === "created" && !p.unsubscribedAt
              ? `<form method="post" action="/prospect/${esc(p.id)}/sent">
                   <input type="hidden" name="leadId" value="${esc(d.id)}">
                   <button class="ok" type="submit">Kiküldve — mérés indul</button></form>`
              : ""
          }
        </div>
      </div>`;
    })
    .join("");

  return `<div class="panel"><h2>Megkeresés — követett link (${prospects.length})</h2>
    ${createForm}${rows}
    <div class="mut small" style="margin-top:8px">A /p/&lt;token&gt; link minden megnyitása külön
    mérési session (open/scroll/dwell/modul-események). A „Kiküldve" gomb a H1-tölcsér bázisa.
    Az oldal alján GDPR-tájékoztató + leiratkozás.</div></div>`;
}

export function leadPage(
  d: LeadDetail,
  generating = false,
  conversion: ConversionView | null = null,
  orders: OrderIntentView[] = [],
  payments: PaymentView[] = [],
  prospects: ProspectView[] = [],
): string {
  const prov = d.provenance.length
    ? `<table><thead><tr><th>Mező</th><th>Érték</th><th>Forrás</th><th>Konf.</th></tr></thead>
       <tbody>${d.provenance
         .map(
           (p) => `<tr><td>${esc(p.field)}</td><td class="small">${esc(p.value)}</td>
           <td class="small mut">${esc(p.source)}</td><td>${confCell(p.confidence)}</td></tr>`,
         )
         .join("")}</tbody></table>`
    : `<p class="mut small">Nincs provenance-rekord.</p>`;

  const artifacts = d.artifacts.length
    ? d.artifacts
        .map((a) => {
          const dec = a.decisions[0];
          const curated = a.status === "approved" || a.status === "rejected";
          // Scalar metadata only — skip the engine artifact's recipe/siteData blobs.
          const inputs = Object.entries(a.inputs)
            .filter(([, v]) => v === null || typeof v !== "object")
            .map(([k, v]) => `${esc(k)}=${esc(v)}`)
            .join(" · ");
          return `<div class="panel">
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
                  : convertForm(d.id, a.id)
                : ""
            }
          </div>`;
        })
        .join("")
    : `<div class="panel"><p class="mut">Még nincs generált mock ehhez a leadhez.</p></div>`;

  const body = `
    <div class="panel">
      <h2>Lead</h2>
      <div class="row" style="margin-top:0">
        <b style="font-size:18px">${esc(d.name)}</b>
        ${d.qualification ? `<span class="pill ${esc(d.qualification)}">${esc(d.qualification)}</span>` : ""}
      </div>
      <dl class="kv" style="margin-top:12px">
        <dt>Régió</dt><dd>${esc(d.region)}</dd>
        <dt>Cím</dt><dd>${esc(d.address) || `<span class="mut">–</span>`}</dd>
        <dt>Match-konfidencia</dt><dd>${confCell(d.matchConfidence)}</dd>
      </dl>
      ${
        generating
          ? `<div class="row"><span class="pill generated">generálás folyamatban…</span>
             <span class="mut small">~1-2 perc — az oldal automatikusan frissül</span></div>
             <script>setTimeout(function(){location.reload()},6000)</script>`
          : `<div class="row">
             <form method="post" action="/lead/${esc(d.id)}/generate"
                   onsubmit="var b=this.querySelector('button');b.disabled=true;b.textContent='Indítás…'">
               <button type="submit">Mock ${d.artifacts.length ? "újragenerálása" : "generálása"}</button>
             </form>
           </div>`
      }
    </div>
    ${prospectsPanel(prospects, d)}
    ${orderIntentsPanel(orders, payments, d.id)}
    <div class="panel"><h2>Mock-artefaktumok</h2></div>
    ${artifacts}
    <div class="panel"><h2>Provenance (A4)</h2>${prov}</div>`;
  return layout(d.name, body, { active: "/leads" });
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
): string {
  const pass = check.verdict === "PASS";
  const verdict = pass
    ? `<span class="pill approved">§C-kapu: PASS — küldhető</span>`
    : `<span class="pill rejected">§C-kapu: FLAG — NEM küldhető</span>`;
  const reasons = check.reasons.length
    ? `<ul class="small" style="margin-top:8px;color:var(--bad,#f87171)">${check.reasons
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
  const body = `
    <div class="panel">
      <h2>Outreach-piszkozat — ${esc(input.leadName)}${input.segment ? ` <span class="pill">${esc(input.segment)}</span>` : ""}</h2>
      <div class="row">${verdict}</div>
      ${noticeBlock}
      ${reasons}
      ${sendBlock}
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
          style="width:100%;height:560px;border:1px solid #2a3542;border-radius:10px;background:#fff;margin-top:4px"></iframe>
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
       <pre style="margin-top:4px;max-height:420px;overflow:auto;background:#0b1118;border:1px solid #2a3542;border-radius:8px;padding:10px;font:12px/1.5 ui-monospace,monospace;white-space:pre-wrap">${esc(job.log.join("\n"))}</pre></div>`
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
    <div class="panel">
      <h2>Scrape indítása</h2>
      ${notice ? `<div class="row"><span class="pill rejected">${esc(notice)}</span></div>` : ""}
      ${startForm}
      ${logBlock}
    </div>
    <div class="panel">
      <h2>Korábbi futások</h2>
      <table><thead><tr><th>Régió</th><th>Státusz</th><th>Indult</th><th>Szereplő</th><th>Lead</th><th>Hiba</th></tr></thead>
      <tbody>${runRows || `<tr><td colspan="6" class="mut">Még nincs futás.</td></tr>`}</tbody></table>
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
      ${hyp}
    </div>
    <div class="panel">
      <h2>Szegmens-bontás (H4)</h2>
      <table>${head}<tbody>${funnelRow("ÖSSZES", t)}${segRows}</tbody></table>
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
    <div class="panel">
      <h2>Vezérlőpult</h2>
      <p class="mut small" style="margin:0 0 12px">Szia, ${esc(operatorName)}! Itt minden elérhető a felső menüből is — semmit nem kell megjegyezni.</p>
      <div class="con-cards">
        ${card("/leads", r.leadTotals.players, "felmért szereplő")}
        ${card("/leads?qualification=no_site", r.leadTotals.leads, "kvalifikált lead")}
        ${card("/leads?mock=approved", `${r.leadTotals.approved}/${r.leadTotals.mocks}`, "jóváhagyott / összes mock")}
        ${card("/report", t.sent, "kiküldött megkeresés")}
        ${card("/report", t.orderIntent, "order-intent")}
        ${card("/scrape", scrapeRunning ? "FUT" : "áll", "scrape állapota")}
      </div>
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
