// Partner console — views (PARTNER-UI-SPEC.md). Server-rendered HTML, same
// hand-rolled approach as views.ts. All styling from the central design core
// (--citui-* tokens via citui.css / citui-console.css); icons from src/ui/icons.ts.
//
// i18n note: every label here is operator-facing (internal console) — outside
// the §B.18 customer-facing i18n scope.

import { esc, helpLink, layout } from "./views.js";
import { ic } from "../ui/icons.js";
import { formatMoney, formatNumber } from "../text/money.js";
import { DOC_TYPE_OPTIONS, docTypeLabelOf, dueReadout } from "./partnerData.js";
// ADR-0067 ③: operator surface, prepared for a non-Hungarian colleague.
import { T } from "../i18n/mail.js";
import { budapestYear } from "../text/budapestTime.js";
import { consoleLang } from "./i18nCtx.js";
import {
  attentionBlock,
  dataTab,
  domainBlock,
  overviewCards,
  partnerHeader,
  partnerTabNav,
  subscriptionBlock,
  usageBlock,
} from "./partnerProfileViews.js";
import type { PartnerEditState, PartnerTabId } from "./partnerProfileViews.js";
import type { PartnerContactInput, PartnerProfile } from "./partnerProfile.js";
import type {
  MoneyByCurrency,
  PartnerDetail,
  PartnerDocQuery,
  PartnerDocuments,
  PartnerListQuery,
  PartnerListRow,
  TimelineEvent,
} from "./partnerData.js";


/** One amount per currency ("1 234 567 Ft", "40 EUR"); "–" when empty. */
export function fmtMoney(m: MoneyByCurrency): string {
  const parts = Object.entries(m)
    .filter(([, v]) => v !== 0)
    // esc() AFTER formatting: the currency can be an operator-entered code, and
    // it lands in HTML either way.
    .map(([cur, v]) => esc(formatMoney(v, cur)));
  return parts.length ? parts.join(" + ") : `<span class="mut">–</span>`;
}

/** Role badges: a partner can be customer AND supplier at once (MineREAL model). */
function roleBadges(r: { isCustomer: boolean; isSupplier: boolean }): string {
  const lang = consoleLang();
  const b: string[] = [];
  if (r.isCustomer) b.push(`<span class="pill approved">${T(lang, "vevő")}</span>`);
  if (r.isSupplier) b.push(`<span class="pill sent">${T(lang, "szállító")}</span>`);
  return b.length ? b.join(" ") : `<span class="mut small">–</span>`;
}

/** Partner list (/partners): search + role filter + document aggregates. */
export function partnersPage(rows: PartnerListRow[], q: PartnerListQuery = {}): string {
  const lang = consoleLang();
  const typeTab = (value: "" | "customer" | "supplier", label: string): string => {
    const on = (q.type ?? "") === value;
    const params = new URLSearchParams();
    if (q.q) params.set("q", q.q);
    if (value) params.set("type", value);
    const qs = params.toString();
    return `<a href="/partners${qs ? `?${qs}` : ""}"${on ? ` class="active"` : ""}>${esc(label)}</a>`;
  };

  const bodyRows = rows.length
    ? rows
        .map((r) => {
          // The list shows the partner's DOMINANT money face: customer → our
          // revenue + their open debt; supplier-only → our spend + our open debt.
          // A dual-role partner gets its supplier side as a second, muted line.
          const turnover = r.isCustomer || !r.isSupplier ? r.revenue : r.spend;
          const open = r.isCustomer || !r.isSupplier ? r.receivable : r.payable;
          const supplierExtra =
            r.isCustomer && r.isSupplier
              ? `<br><span class="mut small">${T(lang, "költés: {amount}", { amount: fmtMoney(r.spend) })}</span>`
              : "";
          const supplierOpenExtra =
            r.isCustomer && r.isSupplier
              ? `<br><span class="mut small">${T(lang, "tartozásunk: {amount}", { amount: fmtMoney(r.payable) })}</span>`
              : "";
          return `<tr>
        <td><a href="/partner/${esc(r.id)}">${esc(r.name)}</a>${r.active ? "" : ` <span class="pill rejected">${T(lang, "inaktív")}</span>`}</td>
        <td class="small">${r.city ? esc(r.city) : `<span class="mut">–</span>`}</td>
        <td class="small">${r.taxNumber ? `<code>${esc(r.taxNumber)}</code>` : `<span class="mut">–</span>`}</td>
        <td>${roleBadges(r)}</td>
        <td class="num">${r.docCount || `<span class="mut">–</span>`}</td>
        <td class="num">${fmtMoney(turnover)}${supplierExtra}</td>
        <td class="num">${fmtMoney(open)}${supplierOpenExtra}</td>
      </tr>`;
        })
        .join("")
    : `<tr><td colspan="7" class="mut" style="padding:24px">${
        q.q || q.type
          ? `${T(lang, "Nincs a szűrőnek megfelelő partner.")} <a href="/partners">${T(lang, "Szűrők törlése")}</a>`
          : T(lang, "Még nincs partner. A vevő-partner az első fizetéskor születik automatikusan (a számlázási nyilatkozatból).")
      }</td></tr>`;

  // ⛔ A horgony a SÚGÓ-IKONON ül, nem a konténer néma attribútumaként (ADR-0132 nyitott
  // tétele): a lefedettség-kapu a `data-kb-anchor`-t nézi, az pedig LÁTHATATLAN — így ez az
  // öt Pénzügy-képernyő zölden állt évekig súgó-ikon NÉLKÜL, miközben az ADR-0045 B) minden
  // szekcióra ígéri. A kb-check --coverage mostantól megköveteli, hogy a horgony <a>-n legyen.
  const body = `<div class="panel">
    <div class="row" style="justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <h2 style="margin:0">Partnerek (${rows.length}) ${helpLink("console.partners")}</h2>
      <a href="/partners/new" class="small" style="font-weight:600">${T(lang, "+ Új partner")}</a>
    </div>
    <div class="row" style="justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px">
      <nav class="con-tabs" style="margin:0">
        ${typeTab("", "Mind")}
        ${typeTab("customer", T(lang, "Vevők"))}
        ${typeTab("supplier", T(lang, "Szállítók"))}
      </nav>
      <form method="get" class="row" style="gap:8px;align-items:center;margin:0">
        ${q.type ? `<input type="hidden" name="type" value="${esc(q.type)}">` : ""}
        <input type="search" name="q" value="${esc(q.q ?? "")}" placeholder="${T(lang, "Név, adószám, város…")}"
               style="min-width:200px">
        <button type="submit" style="width:auto;margin:0;padding:8px 14px">${T(lang, "Keresés")}</button>
        ${q.q ? `<a class="small" href="/partners${q.type ? `?type=${esc(q.type)}` : ""}">${T(lang, "törlés")}</a>` : ""}
      </form>
    </div>
    <div class="tblwrap"><table>
      <thead><tr>
        <th>${T(lang, "Név")}</th><th>${T(lang, "Város")}</th><th>${T(lang, "Adószám")}</th><th>${T(lang, "Típus")}</th>
        <th class="num">Bizonylat (db)</th><th class="num">Forgalom</th><th class="num">${T(lang, "Kintlévőség")}</th>
      </tr></thead>
      <tbody>${bodyRows}</tbody>
    </table></div>
  </div>`;
  return layout("Partnerek", body, { active: "/partners" });
}

// ── Manual partner registration (/partners/new) ─────────────────────────────

/** Prior form values echoed back on a validation error (never lose typing). */
export type PartnerFormValues = Readonly<Record<string, string>>;

/** New-partner form. A supplier never arrives via a payment, so this is the
 *  only door for them; a customer partner normally auto-births at payment. */
export function partnerNewPage(
  values: PartnerFormValues = {},
  error: { message: string; existingId?: string } | null = null,
): string {
  const lang = consoleLang();
  const v = (k: string) => esc(values[k] ?? "");
  const checked = (k: string) => (values[k] === "on" ? " checked" : "");
  const field = (
    name: string,
    label: string,
    opts: { required?: boolean; placeholder?: string; hint?: string; width?: string } = {},
  ) => `<label class="small mut" for="pn-${name}" style="display:block;margin-top:10px">${esc(label)}${
    opts.required ? " *" : ""
  }</label>
    <input id="pn-${name}" name="${name}" value="${v(name)}"${opts.required ? " required" : ""}
           ${opts.placeholder ? `placeholder="${esc(opts.placeholder)}"` : ""}
           style="width:${opts.width ?? "100%"};margin-top:4px">
    ${opts.hint ? `<div class="mut small" style="margin-top:3px">${esc(opts.hint)}</div>` : ""}`;

  const body = `<div class="panel" style="max-width:640px">
    <h2>${T(lang, "Új partner rögzítése")} ${helpLink("console.partner_new")}</h2>
    <p class="mut small" style="margin-top:4px">A vevő-partner az első fizetéskor magától születik —
      ez az űrlap a kézi felvitelre való: jellemzően SZÁLLÍTÓ (Hetzner, domain-szolgáltató, könyvelő),
      vagy előre rögzített vevő.</p>
    ${
      error
        ? `<div class="row" style="margin:10px 0"><span class="pill rejected">${esc(error.message)}</span>
           ${error.existingId ? `<a href="/partner/${esc(error.existingId)}">${T(lang, "a meglévő partner-lap ▸")}</a>` : ""}</div>`
        : ""
    }
    <form method="post" action="/partners/new" style="display:block">
      ${field("name", T(lang, "Jogi név (cégnév)"), { required: true, placeholder: "Hetzner Online GmbH" })}
      <div class="row" style="gap:18px;margin-top:12px">
        <label class="small" style="display:flex;gap:7px;align-items:center">
          <input type="checkbox" name="is_supplier"${checked("is_supplier") || (Object.keys(values).length ? "" : " checked")}> ${T(lang, "szállító")}</label>
        <label class="small" style="display:flex;gap:7px;align-items:center">
          <input type="checkbox" name="is_customer"${checked("is_customer")}> ${T(lang, "vevő")}</label>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 14px">
        <div>${field("tax_number", T(lang, "Adószám (HU: 8-1-2)"), { placeholder: "12345678-2-41", hint: T(lang, "Magyar partnernél kötelező alak; ez az azonosság kulcsa.") })}</div>
        <div>${field("eu_vat_number", T(lang, "Közösségi adószám"), { placeholder: "DE812871812" })}</div>
        <div>${field("registration_no", T(lang, "Cégjegyzékszám / nyilvántartási szám"))}</div>
        <div>${field("country", T(lang, "Ország (ISO-2)"), { placeholder: "HU" })}</div>
        <div>${field("zip", T(lang, "Irányítószám"))}</div>
        <div>${field("city", T(lang, "Város"))}</div>
      </div>
      ${field("address", T(lang, "Cím (utca, házszám)"))}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 14px">
        <div>${field("email", "E-mail")}</div>
        <div>${field("phone", "Telefon")}</div>
        <div>${field("bank_account_no", T(lang, "Bankszámla / IBAN"), { hint: T(lang, "Ha megadod, alapértelmezett számlaként rögzül.") })}</div>
        <div>${field("bank_name", "Bank neve")}</div>
      </div>
      ${field("note", T(lang, "Megjegyzés"))}
      <div class="row" style="margin-top:16px;gap:12px;align-items:center">
        <button type="submit" style="width:auto;margin:0;padding:10px 18px">${T(lang, "Partner mentése")}</button>
        <a class="small" href="/partners">${T(lang, "mégse")}</a>
      </div>
    </form>
  </div>`;
  return layout(T(lang, "Új partner"), body, { active: "/partners/new" });
}

// ── Partner page (/partner/:id) ─────────────────────────────────────────────

/** Tab ids grow slice by slice (spec: Áttekintés → Előzmények → Előfizetés →
 *  Bizonylatok → Kontaktok); only implemented tabs are offered. */
export type PartnerTab = PartnerTabId;

/** A partner with no tenant behind it (supplier, fixtures): nothing to relate. */
const EMPTY_PROFILE: PartnerProfile = {
  relations: { tenant: null, lead: null, site: null, users: [] },
  subscription: null,
  payments: [],
  domains: [],
  attention: [],
};

/** Partner page — the approved A — Fülek sheet (assets/design-refs/console/partner-adatlap/):
 *  header + KPI, „Figyelendő”, tabs. The money ledger (Számlák/Bizonylatok) and the
 *  timeline (Előzmények) render here; the rest comes from partnerProfileViews.ts. */
export function partnerPage(
  d: PartnerDetail,
  tab: PartnerTab = "overview",
  timeline: TimelineEvent[] = [],
  docs: PartnerDocuments | null = null,
  docQuery: PartnerDocQuery = {},
  contacts: readonly PartnerContactInput[] = [],
  extra: {
    readonly profile?: PartnerProfile;
    readonly edit?: PartnerEditState;
    readonly usageHtml?: string | null;
    /** The „Üzenetváltások” tab body (partnerMessageViews.messagesTab) and its badge. */
    readonly messagesHtml?: string;
    readonly waiting?: number;
  } = {},
): string {
  const lang = consoleLang();
  const prof: PartnerProfile = extra.profile ?? EMPTY_PROFILE;
  const edit: PartnerEditState = extra.edit ?? { open: false };
  const usageHtml = extra.usageHtml ?? null;
  const card = (h: string, inner: string) => `<section class="pa-card"><h2 class="pa-h">${esc(h)}</h2>${inner}</section>`;
  let body: string;
  switch (tab) {
    case "overview":
      body = `${attentionBlock(d, prof.attention)}${overviewCards(d, prof)}${
        docs && docs.rows.length ? `<section class="pa-card">${kpiStrip(docs)}${monthlyChart(docs)}</section>` : ""
      }`;
      break;
    case "messages":
      body = extra.messagesHtml ?? "";
      break;
    case "data":
      body = dataTab(d, contacts, edit);
      break;
    case "subscription":
      body = card(T(lang, "Előfizetés"), subscriptionBlock(d, prof));
      break;
    case "domain":
      body = card(T(lang, "Domain"), domainBlock(prof));
      break;
    case "documents":
      body = `<section class="pa-card">${docs ? documentsTab(d.id, docs, docQuery) : `<p class="mut">Nincs bizonylat.</p>`}</section>`;
      break;
    case "usage":
      body = card(T(lang, "Aktivitás és látogatottság"), usageBlock(usageHtml));
      break;
    case "activity":
      body = card(T(lang, "Előzmények"), activityTab(timeline));
      break;
  }
  const page = `<div class="pa-page">
    ${partnerHeader(d, prof)}
    <div class="pa-help">${helpLink("console.partner")}</div>
    ${partnerTabNav(d, prof, tab, extra.waiting ?? 0)}
    ${body}
  </div>`;
  return layout(d.name, page, { active: `/partner/${d.id}` });
}

/** Monthly breakdown chart (MineREAL "Havi bontás"): pure-SVG bars from the
 *  partner's documents — outgoing (revenue) vs incoming (cost), HUF only, the
 *  running year. No client JS, renders everywhere. */
function monthlyChart(docs: PartnerDocuments): string {
  const lang = consoleLang();
  const year = budapestYear(new Date());
  const out = Array(12).fill(0) as number[];
  const inc = Array(12).fill(0) as number[];
  for (const r of docs.rows) {
    if (r.currency !== "HUF" || !r.issueDate.startsWith(String(year))) continue;
    const m = Number(r.issueDate.slice(5, 7)) - 1;
    if (r.direction === "outgoing") out[m] += r.gross;
    else inc[m] += r.gross;
  }
  const max = Math.max(...out, ...inc, 1);
  const W = 720;
  const H = 120;
  const bw = W / 12;
  const bars = Array.from({ length: 12 }, (_, m) => {
    const ho = Math.round((out[m]! / max) * (H - 24));
    const hi = Math.round((inc[m]! / max) * (H - 24));
    const x = m * bw;
    return (
      `<rect x="${(x + bw * 0.18).toFixed(1)}" y="${H - 14 - ho}" width="${(bw * 0.28).toFixed(1)}" height="${ho}" rx="2" fill="var(--citui-cyan-500)"><title>${T(lang, "{month}: kimenő {amount}", { month: MONTHS(lang)[m]!, amount: Math.round(out[m]!).toLocaleString("hu-HU") })} Ft</title></rect>` +
      `<rect x="${(x + bw * 0.54).toFixed(1)}" y="${H - 14 - hi}" width="${(bw * 0.28).toFixed(1)}" height="${hi}" rx="2" fill="var(--citui-navy-700)"><title>${T(lang, "{month}: bejövő {amount}", { month: MONTHS(lang)[m]!, amount: Math.round(inc[m]!).toLocaleString("hu-HU") })} Ft</title></rect>` +
      `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 2}" text-anchor="middle" font-size="9" fill="var(--citui-muted)">${MONTHS(lang)[m]}</text>`
    );
  }).join("");
  return `<div class="con-chart">
    <div class="con-chart__t">${T(lang, "Havi bontás — {year} (Ft)", { year })} · <span style="color:var(--citui-link-ink)">■</span> ${T(lang, "kimenő ·")} <span style="color:var(--citui-navy-700)">■</span> ${T(lang, "bejövő")}</div>
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="${T(lang, "Havi forgalom-bontás")}">${bars}</svg>
  </div>`;
}

// Month abbreviations are LABELS, not data — a Polish operator reads "Sty", not "Jan".
const MONTHS = (lang = "hu"): readonly string[] => [
  T(lang, "Jan"), T(lang, "Feb"), T(lang, "Már"), T(lang, "Ápr"), T(lang, "Máj"), T(lang, "Jún"),
  T(lang, "Júl"), T(lang, "Aug"), T(lang, "Szep"), T(lang, "Okt"), T(lang, "Nov"), T(lang, "Dec"),
];

/** MineREAL KPI strip on the overview: db · érték boxes computed from the
 *  partner's documents (open items, overdue with average delay, habit). */
function kpiStrip(docs: PartnerDocuments): string {
  const lang = consoleLang();
  const now = Date.now();
  const openRows = docs.rows.filter((r) => !r.paid);
  const overdueRows = openRows.filter((r) => r.dueDate && new Date(r.dueDate).getTime() < now);
  const avgDelay = overdueRows.length
    ? Math.round(
        overdueRows.reduce((s, r) => s + (now - new Date(r.dueDate!).getTime()) / 86_400_000, 0) /
          overdueRows.length,
      )
    : 0;
  const box = (t: string, v: string, sub: string, bad = false) =>
    `<div class="con-kbox${bad ? " con-kbox--bad" : ""}"><div class="con-kbox__t">${esc(t)}</div>
      <div class="con-kbox__r"><span class="con-kbox__v">${v}</span><span class="con-kbox__s">${sub}</span></div></div>`;
  const habit = docs.habit
    ? `${Math.round(docs.habit.onTimeRatio * 100)}%`
    : "–";
  const habitSub = docs.habit
    ? `${docs.habit.avgDays <= 0 ? Math.abs(Math.round(docs.habit.avgDays)) + T(lang, " nappal korábban") : Math.round(docs.habit.avgDays) + T(lang, " nap késés")} · ${docs.habit.sample} db`
    : "nincs adat";
  return `<div class="con-kstrip">
    ${box("Bizonylat", String(docs.rows.length), T(lang, "db összesen"))}
    ${box(T(lang, "Nyitott tételek"), fmtMoney(docs.openGross), `${openRows.length} db`)}
    ${box(T(lang, "Lejárt számlák"), fmtMoney(overdueRows.length ? sumBy(overdueRows) : {}), overdueRows.length ? T(lang, "{n} db · átl. {days} nap késés", { n: overdueRows.length, days: avgDelay }) : T(lang, "nincs"), overdueRows.length > 0)}
    ${box(T(lang, "Időben fizet"), habit, habitSub)}
  </div>`;
}

function sumBy(rows: { gross: number; currency: string }[]): MoneyByCurrency {
  const m: Record<string, number> = {};
  for (const r of rows) m[r.currency] = (m[r.currency] ?? 0) + r.gross;
  return m;
}

/** Badge tint per timeline source bucket — the pill vocabulary the console
 *  already speaks (approved=green, sent=blue, rejected=red, default=neutral). */
const TL_PILL: Readonly<Record<string, string>> = {
  fizetés: "approved",
  rendelés: "approved",
  oldal: "sent",
  megkeresés: "sent",
  aktivitás: "sent",
  számla: "",
  mock: "",
  lead: "",
  admin: "",
  partner: "",
};

/** Előzmények / Aktivitás tab — the single merged timeline (the CRM heart). */
function activityTab(timeline: TimelineEvent[]): string {
  const lang = consoleLang();
  if (!timeline.length)
    return `<p class="mut" style="padding:12px 0">${T(lang, "Még nincs előzmény ehhez a partnerhez.")}</p>`;
  let lastDay = "";
  const rows = timeline
    .map((e) => {
      const day = e.at.slice(0, 10);
      const dayRow =
        day !== lastDay
          ? `<tr><td colspan="3" style="padding-top:14px;font-weight:600;border-bottom:1px solid var(--citui-line)">${esc(day)}</td></tr>`
          : "";
      lastDay = day;
      const pill = TL_PILL[e.kind] ?? "";
      return `${dayRow}<tr>
        <td class="mut small" style="white-space:nowrap">${esc(e.at.slice(11, 16))}</td>
        <td style="white-space:nowrap"><span class="pill ${pill}">${esc(e.kind)}</span></td>
        <td>${e.href ? `<a href="${esc(e.href)}">${esc(e.title)}</a>` : esc(e.title)}${
          e.detail ? ` <span class="mut small">· ${esc(e.detail)}</span>` : ""
        }</td>
      </tr>`;
    })
    .join("");
  return `<p class="mut small" style="margin:10px 0 4px">${timeline.length} esemény, legfrissebb elöl —
    a teljes út a megtalálástól a fizetésig egy idővonalon.</p>
    <div class="tblwrap"><table><tbody>${rows}</tbody></table></div>`;
}

/** Options that differ between the partner tab and the global /documents list. */
interface DocsBlockOpts {
  /** Filter-link base; query params are appended with & (base already has ? or not). */
  readonly base: string;
  readonly csvBase: string;
  /** Show the partner column + search box (the global list). */
  readonly global: boolean;
}

/** Money split per currency for the dark KPI band — HUF leads big, other
 *  currencies drop to a smaller line UNDER it (never a "+"-chained mush). */
function bandMoney(m: MoneyByCurrency, signed = false): string {
  const entries = Object.entries(m).filter(([, v]) => Math.round(v) !== 0);
  if (!entries.length) return signed ? "0" : "0";
  entries.sort(([a], [b]) => (a === "HUF" ? -1 : b === "HUF" ? 1 : a.localeCompare(b)));
  const fmt = ([cur, v]: [string, number]) => {
    const sign = signed ? (v > 0 ? "+ " : "− ") : "";
    return sign + esc(formatMoney(Math.abs(v), cur));
  };
  const [first, ...rest] = entries;
  return (
    fmt(first!) + (rest.length ? `<span class="sub">${rest.map(fmt).join(" · ")}</span>` : "")
  );
}

/** The per-currency headline band (global /documents only, ADR-0064): what
 *  others owe us, what we owe, what is overdue, and the net position. */
function documentsKpiBand(docs: PartnerDocuments): string {
  const lang = consoleLang();
  const k = docs.kpi;
  const net: MoneyByCurrency = {};
  for (const c of new Set([...Object.keys(k.receivable), ...Object.keys(k.payable)]))
    net[c] = (k.receivable[c] ?? 0) - (k.payable[c] ?? 0);
  const tile = (m: string, v: string, fx: string) =>
    `<div><div class="dkpi__m">${m}</div><div class="dkpi__v">${v}</div>${
      fx ? `<div class="dkpi__fx">${fx}</div>` : ""
    }</div>`;
  const sep = `<div class="dkpi__sep"></div>`;
  return `<div class="dkpi">
    ${tile(T(lang, "Nekem jár"), bandMoney(k.receivable), T(lang, "{n} nyitott vevői", { n: k.receivableCount }))}${sep}
    ${tile(T(lang, "Én fizetek"), bandMoney(k.payable), T(lang, "{n} nyitott szállítói", { n: k.payableCount }))}${sep}
    ${tile(T(lang, "Lejárt"), bandMoney(k.overdue), `${k.overdueCount} bizonylat`)}${sep}
    ${tile(T(lang, "Nettó pozíció"), bandMoney(net, true), "")}
  </div>`;
}

/** Bizonylatok block — ONE dense table (ADR-0064/0066, "C" irány): the TYPE is a
 *  filter, never a separate section, and direction is NOT on the surface (the
 *  Típus column carries it). Global list: per-currency KPI band + column filters
 *  in a server-side GET form (scales in SQL) + active-filter chips. Partner tab:
 *  a slim Típus/Fizetve toolbar + korosítás. Shared row/column shape. */
function documentsBlock(docs: PartnerDocuments, q: PartnerDocQuery, opts: DocsBlockOpts): string {
  const lang = consoleLang();
  const now = Date.now();
  const action = opts.base.split("?")[0]!;
  const num = (v: number): string => formatNumber(v);

  // ── Global column-filter GET form (server-side; the JS enhancement only
  //    auto-submits the text fields — it never hides rows client-side). ──
  const textF = (name: string, ph: string, val: string | undefined) =>
    `<div class="ctbl-f${val ? " on" : ""}"><input form="docf" type="text" name="${name}" value="${esc(val ?? "")}" placeholder="${esc(ph)}" aria-label="${esc(ph)}"></div>`;
  const dateF = (n1: string, n2: string, v1?: string, v2?: string) =>
    `<div class="ctbl-f${v1 || v2 ? " on" : ""}"><div class="range">
       <input form="docf" type="date" name="${n1}" value="${esc(v1 ?? "")}" onchange="this.form.submit()" title="${T(lang, "tól")}" aria-label="${T(lang, "tól")}">
       <input form="docf" type="date" name="${n2}" value="${esc(v2 ?? "")}" onchange="this.form.submit()" title="ig" aria-label="ig"></div></div>`;
  const typeF = `<div class="ctbl-f${q.type ? " on" : ""}"><select form="docf" name="type" onchange="this.form.submit()" aria-label="${T(lang, "Típus")}">
      <option value="">mind</option>
      ${DOC_TYPE_OPTIONS.map((o) => `<option value="${o.id}"${q.type === o.id ? " selected" : ""}>${esc(o.label)}</option>`).join("")}
    </select></div>`;
  // ADR-0414: origin filter — the system invoices (payment path) vs. the hand-registered ones.
  const srcF = `<div class="ctbl-f${q.src ? " on" : ""}" style="margin-top:4px"><select form="docf" name="src" onchange="this.form.submit()" aria-label="${T(lang, "Forrás")}">
      <option value="">${T(lang, "minden forrás")}</option>
      <option value="system"${q.src === "system" ? " selected" : ""}>${T(lang, "rendszer-számla")}</option>
      <option value="manual"${q.src === "manual" ? " selected" : ""}>${T(lang, "kézi / importált")}</option>
    </select></div>`;
  const currencies = ["HUF", "EUR", "USD"];
  const currencyF = `<div class="ctbl-f${q.currency ? " on" : ""}"><select form="docf" name="currency" onchange="this.form.submit()" aria-label="${T(lang, "Pénznem")}">
      <option value="">mind</option>
      ${currencies.map((c) => `<option value="${c}"${q.currency === c ? " selected" : ""}>${c}</option>`).join("")}
    </select></div>`;
  const paidF = `<div class="ctbl-f${q.paid !== undefined ? " on" : ""}"><select form="docf" name="paid" onchange="this.form.submit()" aria-label="${T(lang, "Állapot")}">
      <option value="">mind</option>
      <option value="1"${q.paid === true ? " selected" : ""}>fizetve</option>
      <option value="0"${q.paid === false ? " selected" : ""}>nyitott</option>
    </select></div>`;

  // Header: label + (global) its column filter. Partner tab shows labels only.
  const th = (label: string, filter: string, extra = "") =>
    `<th${extra}><span class="lbl"${opts.global ? "" : ' style="margin-bottom:0"'}>${label}</span>${opts.global ? filter : ""}</th>`;
  const head = `<tr>
    ${th("Bizonylat", textF("no", T(lang, "Szám…"), q.no), ' style="min-width:132px"')}
    ${opts.global ? th("Partner", textF("partner", "Partner…", q.partner), ' style="min-width:180px"') : ""}
    ${th(T(lang, "Típus"), typeF + srcF, ' style="min-width:140px"')}
    ${th("Kelte", dateF("from", "to", q.from, q.to), ' style="min-width:150px"')}
    ${th(T(lang, "Fiz. határidő"), dateF("dueFrom", "dueTo", q.dueFrom, q.dueTo), ' style="min-width:150px"')}
    ${th(T(lang, "Esedékesség"), "", ' style="min-width:120px"')}
    ${th(T(lang, "Nettó"), "", ' class="num" style="min-width:90px"')}
    ${th(T(lang, "Bruttó"), "", ' class="num" style="min-width:100px"')}
    ${th(T(lang, "Pénznem"), currencyF, ' style="min-width:88px"')}
    ${th(T(lang, "Állapot"), paidF, ' style="min-width:110px"')}
    ${th(T(lang, "Számlakép"), "", ' style="min-width:104px"')}
  </tr>`;

  // ── Rows (shared shape) ──
  const colCount = opts.global ? 11 : 10;
  const rows = docs.rows.length
    ? docs.rows
        .map((r) => {
          const dr = dueReadout(r.dueDate, r.paid, now);
          const dueCell =
            dr.urgency === "none"
              ? `<span class="mut">–</span>`
              : `<span class="du du--${dr.urgency}">${
                  dr.urgency === "late" ? ic("alert", 13) : dr.urgency === "soon" ? ic("clock", 13) : ""
                }${esc(dr.text)}</span>`;
          // ADR-0414: a mirrored system invoice says so; a storno-ed / failed one says WHY
          // its amount is not in the totals (it is listed, it is no money).
          const srcBadge =
            r.source !== "system"
              ? ""
              : r.systemState === "storno"
                ? `<span class="pill warn">${T(lang, "sztornózva")}</span>`
                : r.systemState === "failed"
                  ? `<span class="pill rejected" title="${esc(r.note ?? "")}">${T(lang, "számla nem készült")}</span>`
                  : `<span class="pill sent">${T(lang, "rendszer")}</span>`;
          const inert = r.source === "system" && (r.systemState === "storno" || r.systemState === "failed");
          return `<tr${r.docType === "storno" || inert ? ` class="storno"` : ""}>
      <td><code>${r.documentNumber ? esc(r.documentNumber) : "–"}</code>${srcBadge ? `<div style="margin-top:3px">${srcBadge}</div>` : ""}</td>
      ${
        opts.global
          ? `<td>${
              r.partnerId
                ? `<a href="/partner/${esc(r.partnerId)}">${esc(r.partnerName ?? "?")}</a>`
                : `<span class="mut">–</span>`
            }</td>`
          : ""
      }
      <td>${esc(docTypeLabelOf(r.direction, r.docType))}</td>
      <td class="mut" style="white-space:nowrap">${esc(r.issueDate.slice(0, 10))}</td>
      <td style="white-space:nowrap">${r.dueDate ? esc(r.dueDate.slice(0, 10)) : `<span class="mut">–</span>`}</td>
      <td>${dueCell}</td>
      <td class="num mut">${num(r.net)}</td>
      <td class="num"><b>${num(r.gross)}</b></td>
      <td><span class="cur">${r.currency === "HUF" ? "HUF" : esc(r.currency)}</span></td>
      <td>${
        r.paid
          ? `<span class="pill approved" title="${r.paidAt ? esc(r.paidAt.slice(0, 10)) : ""}">fizetve</span>`
          : `<span class="pill rejected">nyitott</span>`
      }</td>
      <td>${
        r.hasFile
          ? `<a class="small" href="/accounting-document/${esc(r.id)}/file" target="_blank">${T(lang, "Számlakép ▸")}</a>`
          : `<span class="mut small">–</span>`
      }</td>
    </tr>`;
        })
        .join("")
    : "";
  const emptyRow = docs.rows.length
    ? ""
    : `<tr><td colspan="${colCount}"><div class="ctbl-empty">${T(lang, "Nincs a szűrőnek megfelelő bizonylat.")}</div></td></tr>`;

  // ── Active-filter chips + clear (global) ──
  const active: [string, string][] = [
    ...(q.no ? ([["no", q.no]] as [string, string][]) : []),
    ...(q.partner ? ([["partner", q.partner]] as [string, string][]) : []),
    ...(q.type ? ([["type", q.type]] as [string, string][]) : []),
    ...(q.from ? ([["from", q.from]] as [string, string][]) : []),
    ...(q.to ? ([["to", q.to]] as [string, string][]) : []),
    ...(q.dueFrom ? ([["dueFrom", q.dueFrom]] as [string, string][]) : []),
    ...(q.dueTo ? ([["dueTo", q.dueTo]] as [string, string][]) : []),
    ...(q.currency ? ([["currency", q.currency]] as [string, string][]) : []),
    ...(q.src ? ([["src", q.src]] as [string, string][]) : []),
    ...(q.paid !== undefined ? ([["paid", q.paid ? "1" : "0"]] as [string, string][]) : []),
    ...(q.q ? ([["q", q.q]] as [string, string][]) : []),
  ];
  const linkWithout = (drop: string) => {
    const s = active
      .filter(([k]) => k !== drop)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    return s ? `${action}?${s}` : action;
  };
  const chipLabel: Record<string, string> = {
    no: T(lang, "Szám"), partner: "Partner", type: T(lang, "Típus"), from: T(lang, "Kelte-tól"), to: "Kelte-ig",
    dueFrom: T(lang, "Határidő-tól"), dueTo: T(lang, "Határidő-ig"), currency: T(lang, "Pénznem"), paid: T(lang, "Állapot"), q: T(lang, "Keresés"),
    src: T(lang, "Forrás"),
  };
  const chipValue = (k: string, v: string) =>
    k === "type" ? DOC_TYPE_OPTIONS.find((o) => o.id === v)?.label ?? v : k === "paid" ? (v === "1" ? "fizetve" : "nyitott") : k === "src" ? (v === "system" ? T(lang, "rendszer-számla") : T(lang, "kézi / importált")) : v;
  const chips = active
    .map(
      ([k, v]) =>
        `<span class="ctbl-chip"><span>${T(lang, chipLabel[k] ?? k)}: <b>${esc(chipValue(k, v))}</b></span><a href="${linkWithout(k)}" aria-label="${esc(T(lang, "{label} szűrő törlése", { label: T(lang, chipLabel[k] ?? k) }))}" title="${T(lang, "törlés")}">✕</a></span>`,
    )
    .join("");
  // ── Pager (both surfaces). Links carry the base params + every active filter,
  //    so paging never silently drops the filter you are looking at. The filter
  //    FORMS deliberately carry no page field → changing a filter returns to
  //    page 1, instead of landing on an out-of-range page of a new result set. ──
  const baseParams: [string, string][] = opts.base.includes("?")
    ? opts.base
        .split("?")[1]!
        .split("&")
        .map((kv) => {
          const [k, v] = kv.split("=");
          return [k ?? "", v ?? ""] as [string, string];
        })
    : [];
  const pageHref = (n: number): string => {
    const s = [...baseParams, ...active]
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .concat(n > 1 ? [`page=${n}`] : [])
      .join("&");
    return s ? `${action}?${s}` : action;
  };
  const firstShown = docs.total === 0 ? 0 : (docs.page - 1) * docs.pageSize + 1;
  const lastShown = Math.min(docs.page * docs.pageSize, docs.total);
  // Page-number window: always the first and last page, plus a run around the
  // current one — an ERP list can run to hundreds of pages.
  const nums: (number | "…")[] = [];
  if (docs.pageCount <= 9) {
    for (let i = 1; i <= docs.pageCount; i++) nums.push(i);
  } else {
    const lo = Math.max(2, docs.page - 2);
    const hi = Math.min(docs.pageCount - 1, docs.page + 2);
    nums.push(1);
    if (lo > 2) nums.push("…");
    for (let i = lo; i <= hi; i++) nums.push(i);
    if (hi < docs.pageCount - 1) nums.push("…");
    nums.push(docs.pageCount);
  }
  const pager =
    docs.pageCount <= 1
      ? ""
      : `<nav class="ctbl-pager" aria-label="${T(lang, "Lapozás")}">
      <span class="ctbl-pager__cnt">${firstShown}–${lastShown} / ${docs.total} ${T(lang, "tétel")}</span>
      <span class="ctbl-pager__nav">
        ${
          docs.page > 1
            ? `<a href="${pageHref(docs.page - 1)}" rel="prev">◀ ${T(lang, "Előző")}</a>`
            : `<span class="off">◀ ${T(lang, "Előző")}</span>`
        }
        ${nums
          .map((n) =>
            n === "…"
              ? `<span class="gap">…</span>`
              : n === docs.page
                ? `<span class="cur" aria-current="page">${n}</span>`
                : `<a href="${pageHref(n)}">${n}</a>`,
          )
          .join("")}
        ${
          docs.page < docs.pageCount
            ? `<a href="${pageHref(docs.page + 1)}" rel="next">${T(lang, "Következő")} ▶</a>`
            : `<span class="off">${T(lang, "Következő")} ▶</span>`
        }
      </span>
    </nav>`;

  const bar = `<div class="ctbl-bar">
    <span class="cnt">${T(lang, "Bizonylat")}: <b>${
      docs.total > docs.rows.length ? `${firstShown}–${lastShown} / ${docs.total}` : String(docs.total)
    }</b></span>
    <div class="ctbl-chips">${chips}</div>
    ${
      active.length
        ? `<a class="ctbl-clear" href="${action}">${T(lang, "✕ Szűrők törlése")}</a>`
        : `<span class="ctbl-clear" style="opacity:.42;pointer-events:none">${T(lang, "✕ Szűrők törlése")}</span>`
    }
  </div>`;

  // ── Partner-tab slim toolbar (type + paid) + korosítás ──
  const hiddenTab = opts.base.includes("?")
    ? opts.base
        .split("?")[1]!
        .split("&")
        .map((kv) => {
          const [k, v] = kv.split("=");
          return `<input type="hidden" name="${esc(k ?? "")}" value="${esc(v ?? "")}">`;
        })
        .join("")
    : "";
  const tabToolbar = opts.global
    ? ""
    : `<form method="get" action="${action}" class="row" style="gap:8px;align-items:center;margin:0;flex-wrap:wrap">
        ${hiddenTab}
        <select name="type" onchange="this.form.submit()" style="width:auto;margin:0">
          <option value="">${T(lang, "Típus: mind")}</option>
          ${DOC_TYPE_OPTIONS.map((o) => `<option value="${o.id}"${q.type === o.id ? " selected" : ""}>${esc(o.label)}</option>`).join("")}
        </select>
        <select name="paid" onchange="this.form.submit()" style="width:auto;margin:0">
          <option value="">Fizetve: mind</option>
          <option value="1"${q.paid === true ? " selected" : ""}>Fizetve</option>
          <option value="0"${q.paid === false ? " selected" : ""}>Nem fizetve</option>
        </select>
      </form>`;
  const agingCells = (
    [
      [T(lang, "Nem lejárt"), docs.aging.notDue],
      ["1–30 nap", docs.aging.d1to30],
      ["31–60 nap", docs.aging.d31to60],
      ["61–90 nap", docs.aging.d61to90],
      ["90+ nap", docs.aging.d90plus],
    ] as const
  )
    .map(
      ([, m], i) =>
        `<td class="num"${i >= 3 && Object.keys(m).length ? ` style="color:var(--citui-bad-ink);font-weight:600"` : ""}>${fmtMoney(m)}</td>`,
    )
    .join("");
  const aging = `<div class="tblwrap" style="margin:10px 0"><table>
    <thead><tr><th>${T(lang, "Korosítás (nyitott)")}</th><th class="num">${T(lang, "Nem lejárt")}</th><th class="num">1–30 nap</th>
      <th class="num">31–60 nap</th><th class="num">61–90 nap</th><th class="num">90+ nap</th></tr></thead>
    <tbody><tr><td class="mut small">${T(lang, "lejárat óta eltelt idő")}</td>${agingCells}</tr></tbody>
  </table></div>`;

  // ── CSV export link (carries the full filter) ──
  const csvParams = [
    q.type ? `type=${q.type}` : "",
    q.paid !== undefined ? `paid=${q.paid ? "1" : "0"}` : "",
    q.q ? `q=${encodeURIComponent(q.q)}` : "",
    q.no ? `no=${encodeURIComponent(q.no)}` : "",
    q.partner ? `partner=${encodeURIComponent(q.partner)}` : "",
    q.from ? `from=${q.from}` : "",
    q.to ? `to=${q.to}` : "",
    q.dueFrom ? `dueFrom=${q.dueFrom}` : "",
    q.dueTo ? `dueTo=${q.dueTo}` : "",
    q.currency ? `currency=${q.currency}` : "",
  ]
    .filter(Boolean)
    .join("&");
  const exportHref = `${opts.csvBase}${csvParams ? `?${csvParams}` : ""}`;

  const colfForm = opts.global
    ? `<form id="docf" data-ctbl-filter method="get" action="${action}">${q.q ? `<input type="hidden" name="q" value="${esc(q.q)}">` : ""}</form>`
    : "";

  return `
    ${colfForm}
    ${opts.global ? documentsKpiBand(docs) : ""}
    <div class="row" style="justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-top:10px">
      ${tabToolbar || `<span class="mut small">${T(lang, "{n} találat — a szűrők az oszlopok alatt", { n: docs.total })}</span>`}
      <a class="small" href="${exportHref}" title="${T(lang, "a teljes szűrt lista, nem csak ez az oldal")}">Excel-export (CSV) ▾</a>
    </div>
    ${opts.global ? "" : aging}
    <div class="ctbl-wrap">
      ${opts.global ? bar : ""}
      <div class="ctbl-scroll"><table class="ctbl">
        <thead>${head}</thead>
        <tbody>${rows}${emptyRow}</tbody>
      </table></div>
      ${pager}
    </div>`;
}

/** The partner page's Bizonylatok tab — the shared block scoped to one partner. */
function documentsTab(partnerId: string, docs: PartnerDocuments, q: PartnerDocQuery): string {
  return documentsBlock(docs, q, {
    base: `/partner/${esc(partnerId)}?tab=documents`,
    csvBase: `/partner/${esc(partnerId)}/documents.csv`,
    global: false,
  });
}

/** The global document list (/documents): ONE searchable table over every
 *  partner's documents — direction and payment state are filters (owner decree). */
export function documentsPage(docs: PartnerDocuments, q: PartnerDocQuery): string {
  const lang = consoleLang();
  const body = `<div class="panel">
    <div class="row" style="justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <h2 style="margin:0">Bizonylatok (${docs.total}) ${helpLink("console.documents")}</h2>
      <a href="/documents/new" class="small" style="font-weight:600">${T(lang, "+ Új bizonylat rögzítése")}</a>
    </div>
    ${documentsBlock(docs, q, { base: "/documents", csvBase: "/documents.csv", global: true })}
  </div>
  <script src="/assets/ui/citui-console-table.js"></script>`;
  return layout("Bizonylatok", body, { active: "/documents" });
}

// ── Manual document registration (/documents/new) ───────────────────────────

/** File → base64 dataURL into the hidden field before submit (the same pattern
 *  the tenant admin photo upload uses — no multipart parser in the console). */
const DOC_FILE_JS = `<script>
function citDocFile(input){
  var out = document.getElementById('dn-file-data');
  var nameOut = document.getElementById('dn-file-name');
  var f = input.files && input.files[0];
  if (!f){ out.value=''; nameOut.textContent=''; return; }
  if (f.size > 8*1024*1024){ input.value=''; out.value=''; nameOut.textContent='Túl nagy (max 8 MB)'; return; }
  var r = new FileReader();
  r.onload = function(){ out.value = r.result; nameOut.textContent = f.name; };
  r.readAsDataURL(f);
}
</script>`;

export interface DocumentFormOptions {
  readonly partners: { id: string; name: string; taxNumber: string | null; isSupplier: boolean }[];
  readonly entities: { id: string; code: string; name: string }[];
  /** LEGAL_ENTITY_* config is filled → offer one-click entity bootstrap. */
  readonly canBootstrapEntity: boolean;
}

/** New-document form: the door a supplier invoice arrives through. */
export function documentNewPage(
  opts: DocumentFormOptions,
  values: PartnerFormValues = {},
  error: string | null = null,
): string {
  const lang = consoleLang();
  const v = (k: string) => esc(values[k] ?? "");
  const sel = (k: string, val: string) => (values[k] === val ? " selected" : "");
  if (!opts.entities.length) {
    const body = `<div class="panel" style="max-width:640px">
      <h2>${T(lang, "Új bizonylat rögzítése")} ${helpLink("console.document_new")}</h2>
      <p style="margin-top:10px">Bizonylatot csak jogi entitás (a könyvek gazdája) alá lehet rögzíteni,
        és még egy sincs felvéve.</p>
      ${
        opts.canBootstrapEntity
          ? `<form method="post" action="/entities/bootstrap" style="display:block;margin-top:8px">
              <p class="mut small">A konfigurációban (LEGAL_ENTITY_*) megvannak a cégadatok — egy
                kattintással létrehozható belőlük az entitás:</p>
              <button type="submit" style="width:auto;margin-top:8px;padding:10px 18px">${T(lang, "Entitás létrehozása a konfigurációból")}</button>
            </form>`
          : `<p class="mut small">A LEGAL_ENTITY_* beállítások sincsenek kitöltve a környezetben —
              előbb azokat kell rögzíteni (.env), utána itt egy kattintás az entitás.</p>`
      }
    </div>`;
    return layout(T(lang, "Új bizonylat"), body, { active: "/documents/new" });
  }

  const partnerOpts = opts.partners
    .map(
      (p) =>
        `<option value="${esc(p.id)}"${sel("partner_id", p.id)}>${esc(p.name)}${
          p.taxNumber ? ` · ${esc(p.taxNumber)}` : ""
        }${p.isSupplier ? T(lang, " (szállító)") : ""}</option>`,
    )
    .join("");
  const entityOpts = opts.entities
    .map((e) => `<option value="${esc(e.id)}"${sel("legal_entity_id", e.id)}>${esc(e.name)}</option>`)
    .join("");

  const lbl = (id: string, text: string, required = false) =>
    `<label class="small mut" for="${id}" style="display:block;margin-top:10px">${esc(text)}${required ? " *" : ""}</label>`;

  const body = `<div class="panel" style="max-width:680px">
    <h2>${T(lang, "Új bizonylat rögzítése")} ${helpLink("console.document_new")}</h2>
    <p class="mut small" style="margin-top:4px">Jellemzően bejövő (szállítói) számla — a saját kimenő
      számláink a fizetési útból maguktól születnek. A rögzített tétel azonnal látszik a Bizonylatok
      listában és a partner lapján.</p>
    ${error ? `<div class="row" style="margin:10px 0"><span class="pill rejected">${esc(error)}</span></div>` : ""}
    <form method="post" action="/documents/new" style="display:block">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 14px">
        <div>
          ${lbl("dn-type", T(lang, "Számlatípus"), true)}
          <select id="dn-type" name="type" style="width:100%;margin-top:4px">
            ${DOC_TYPE_OPTIONS.map(
              (o) =>
                `<option value="${o.id}"${
                  sel("type", o.id) || (!values.type && o.id === "szallitoi_szamla" ? " selected" : "")
                }>${esc(o.label)}</option>`,
            ).join("")}
          </select>
        </div>
        <div>
          ${lbl("dn-partner", "Partner", true)}
          <select id="dn-partner" name="partner_id" required style="width:100%;margin-top:4px">
            <option value="">${T(lang, "— válassz —")}</option>${partnerOpts}
          </select>
          <div class="mut small" style="margin-top:3px">${T(lang, "Nincs a listában?")} <a href="/partners/new">${T(lang, "Új partner rögzítése ▸")}</a></div>
        </div>
        <div>
          ${lbl("dn-entity", T(lang, "Könyvelőcég (jogi entitás)"), true)}
          <select id="dn-entity" name="legal_entity_id" required style="width:100%;margin-top:4px">${entityOpts}</select>
        </div>
        <div>
          ${lbl("dn-no", T(lang, "Bizonylatszám (ami a számlán áll)"), true)}
          <input id="dn-no" name="document_number" value="${v("document_number")}" required style="width:100%;margin-top:4px">
        </div>
        <div>
          ${lbl("dn-cur", "Deviza", true)}
          <select id="dn-cur" name="currency" style="width:100%;margin-top:4px">
            <option value="HUF"${sel("currency", "HUF")}>HUF</option>
            <option value="EUR"${sel("currency", "EUR")}>EUR</option>
            <option value="USD"${sel("currency", "USD")}>USD</option>
          </select>
        </div>
        <div>
          ${lbl("dn-issue", "Kelte", true)}
          <input id="dn-issue" name="issue_date" type="date" value="${v("issue_date")}" required style="width:100%;margin-top:4px">
        </div>
        <div>
          ${lbl("dn-fulfil", T(lang, "Teljesítés"))}
          <input id="dn-fulfil" name="fulfillment_date" type="date" value="${v("fulfillment_date")}" style="width:100%;margin-top:4px">
        </div>
        <div>
          ${lbl("dn-due", T(lang, "Fizetési határidő"))}
          <input id="dn-due" name="due_date" type="date" value="${v("due_date")}" style="width:100%;margin-top:4px">
        </div>
        <div>
          ${lbl("dn-net", T(lang, "Nettó"))}
          <input id="dn-net" name="net" inputmode="decimal" value="${v("net")}" placeholder="${T(lang, "ha üres: a bruttóval egyezik")}" style="width:100%;margin-top:4px">
        </div>
        <div>
          ${lbl("dn-gross", T(lang, "Bruttó"), true)}
          <input id="dn-gross" name="gross" inputmode="decimal" value="${v("gross")}" required style="width:100%;margin-top:4px">
        </div>
        <div>
          ${lbl("dn-vatt", T(lang, "Áfa-kezelés"))}
          <input id="dn-vatt" name="vat_treatment" value="${v("vat_treatment")}" placeholder="pl. AAM / 27 / RC" style="width:100%;margin-top:4px">
        </div>
      </div>
      <div class="row" style="gap:14px;margin-top:12px;align-items:center;flex-wrap:wrap">
        <label class="small" style="display:flex;gap:7px;align-items:center">
          <input type="checkbox" name="paid"${values.paid === "on" ? " checked" : ""}> fizetve</label>
        <input name="paid_at" type="date" value="${v("paid_at")}" title="${T(lang, "Fizetés dátuma")}" style="width:auto;margin:0">
      </div>
      ${lbl("dn-file", T(lang, "Számlakép (PDF vagy fotó, max 8 MB)"))}
      <input id="dn-file" type="file" accept="application/pdf,image/jpeg,image/png" onchange="citDocFile(this)" style="margin-top:4px">
      <span id="dn-file-name" class="mut small"></span>
      <input type="hidden" id="dn-file-data" name="file_data" value="">
      ${lbl("dn-note", T(lang, "Megjegyzés"))}
      <input id="dn-note" name="note" value="${v("note")}" style="width:100%;margin-top:4px">
      <div class="row" style="margin-top:16px;gap:12px;align-items:center">
        <button type="submit" style="width:auto;margin:0;padding:10px 18px">${T(lang, "Bizonylat mentése")}</button>
        <a class="small" href="/documents">${T(lang, "mégse")}</a>
      </div>
    </form>
    ${DOC_FILE_JS}
  </div>`;
  return layout(T(lang, "Új bizonylat"), body, { active: "/documents/new" });
}

/** Előfizetés tab (customer face only): what they subscribe to and where the
 *  live site is — with the crossover to the marketing side (lead page). */


