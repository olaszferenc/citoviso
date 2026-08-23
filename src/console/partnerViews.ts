// Partner console — views (PARTNER-UI-SPEC.md). Server-rendered HTML, same
// hand-rolled approach as views.ts. All styling from the central design core
// (--citui-* tokens via citui.css / citui-console.css); icons from src/ui/icons.ts.
//
// i18n note: every label here is operator-facing (internal console) — outside
// the §B.18 customer-facing i18n scope.

import { esc, layout } from "./views.js";
import { formatPrice } from "../pricing.js";
import { MODULE_CATALOG } from "../modules.js";
import { DOC_TYPE_OPTIONS, docTypeLabelOf } from "./partnerData.js";
import type {
  MoneyByCurrency,
  PartnerContactRow,
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
    .map(([cur, v]) => {
      const n = Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
      return cur === "HUF" ? `${n} Ft` : `${n} ${esc(cur)}`;
    });
  return parts.length ? parts.join(" + ") : `<span class="mut">–</span>`;
}

/** KPI-tile money: HUF leads big, other currencies stack UNDER it in a smaller
 *  line (MineREAL header proportions) — never a "+"-chained mush in one line. */
function fmtMoneyTile(m: MoneyByCurrency): string {
  const entries = Object.entries(m).filter(([, v]) => v !== 0);
  if (!entries.length) return `<span class="mut">–</span>`;
  entries.sort(([a], [b]) => (a === "HUF" ? -1 : b === "HUF" ? 1 : a.localeCompare(b)));
  const fmt = ([cur, v]: [string, number]) => {
    const n = Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return cur === "HUF" ? `${n} Ft` : `${n} ${esc(cur)}`;
  };
  const [first, ...rest] = entries;
  return (
    fmt(first!) +
    (rest.length
      ? `<span class="mut" style="display:block;font-size:0.58em;line-height:1.5;-webkit-text-fill-color:var(--citui-muted)">${rest.map(fmt).join(" · ")}</span>`
      : "")
  );
}

/** Role badges: a partner can be customer AND supplier at once (MineREAL model). */
function roleBadges(r: { isCustomer: boolean; isSupplier: boolean }): string {
  const b: string[] = [];
  if (r.isCustomer) b.push(`<span class="pill approved">vevő</span>`);
  if (r.isSupplier) b.push(`<span class="pill sent">szállító</span>`);
  return b.length ? b.join(" ") : `<span class="mut small">–</span>`;
}

/** Partner list (/partners): search + role filter + document aggregates. */
export function partnersPage(rows: PartnerListRow[], q: PartnerListQuery = {}): string {
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
              ? `<br><span class="mut small">költés: ${fmtMoney(r.spend)}</span>`
              : "";
          const supplierOpenExtra =
            r.isCustomer && r.isSupplier
              ? `<br><span class="mut small">tartozásunk: ${fmtMoney(r.payable)}</span>`
              : "";
          return `<tr>
        <td><a href="/partner/${esc(r.id)}">${esc(r.name)}</a>${r.active ? "" : ` <span class="pill rejected">inaktív</span>`}</td>
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
          ? `Nincs a szűrőnek megfelelő partner. <a href="/partners">Szűrők törlése</a>`
          : "Még nincs partner. A vevő-partner az első fizetéskor születik automatikusan (a számlázási nyilatkozatból)."
      }</td></tr>`;

  const body = `<div class="panel" data-kb-anchor="console.partners">
    <div class="row" style="justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <h2 style="margin:0">Partnerek (${rows.length})</h2>
      <a href="/partners/new" class="small" style="font-weight:600">+ Új partner</a>
    </div>
    <div class="row" style="justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px">
      <nav class="con-tabs" style="margin:0">
        ${typeTab("", "Mind")}
        ${typeTab("customer", "Vevők")}
        ${typeTab("supplier", "Szállítók")}
      </nav>
      <form method="get" class="row" style="gap:8px;align-items:center;margin:0">
        ${q.type ? `<input type="hidden" name="type" value="${esc(q.type)}">` : ""}
        <input type="search" name="q" value="${esc(q.q ?? "")}" placeholder="Név, adószám, város…"
               style="min-width:200px">
        <button type="submit" style="width:auto;margin:0;padding:8px 14px">Keresés</button>
        ${q.q ? `<a class="small" href="/partners${q.type ? `?type=${esc(q.type)}` : ""}">törlés</a>` : ""}
      </form>
    </div>
    <div class="tblwrap"><table>
      <thead><tr>
        <th>Név</th><th>Város</th><th>Adószám</th><th>Típus</th>
        <th class="num">Bizonylat (db)</th><th class="num">Forgalom</th><th class="num">Kintlévőség</th>
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

  const body = `<div class="panel" data-kb-anchor="console.partner_new" style="max-width:640px">
    <h2>Új partner rögzítése</h2>
    <p class="mut small" style="margin-top:4px">A vevő-partner az első fizetéskor magától születik —
      ez az űrlap a kézi felvitelre való: jellemzően SZÁLLÍTÓ (Hetzner, domain-szolgáltató, könyvelő),
      vagy előre rögzített vevő.</p>
    ${
      error
        ? `<div class="row" style="margin:10px 0"><span class="pill rejected">${esc(error.message)}</span>
           ${error.existingId ? `<a href="/partner/${esc(error.existingId)}">a meglévő partner-lap ▸</a>` : ""}</div>`
        : ""
    }
    <form method="post" action="/partners/new" style="display:block">
      ${field("name", "Jogi név (cégnév)", { required: true, placeholder: "Hetzner Online GmbH" })}
      <div class="row" style="gap:18px;margin-top:12px">
        <label class="small" style="display:flex;gap:7px;align-items:center">
          <input type="checkbox" name="is_supplier"${checked("is_supplier") || (Object.keys(values).length ? "" : " checked")}> szállító</label>
        <label class="small" style="display:flex;gap:7px;align-items:center">
          <input type="checkbox" name="is_customer"${checked("is_customer")}> vevő</label>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 14px">
        <div>${field("tax_number", "Adószám (HU: 8-1-2)", { placeholder: "12345678-2-41", hint: "Magyar partnernél kötelező alak; ez az azonosság kulcsa." })}</div>
        <div>${field("eu_vat_number", "Közösségi adószám", { placeholder: "DE812871812" })}</div>
        <div>${field("registration_no", "Cégjegyzékszám / nyilvántartási szám")}</div>
        <div>${field("country", "Ország (ISO-2)", { placeholder: "HU" })}</div>
        <div>${field("zip", "Irányítószám")}</div>
        <div>${field("city", "Város")}</div>
      </div>
      ${field("address", "Cím (utca, házszám)")}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 14px">
        <div>${field("email", "E-mail")}</div>
        <div>${field("phone", "Telefon")}</div>
        <div>${field("bank_account_no", "Bankszámla / IBAN", { hint: "Ha megadod, alapértelmezett számlaként rögzül." })}</div>
        <div>${field("bank_name", "Bank neve")}</div>
      </div>
      ${field("note", "Megjegyzés")}
      <div class="row" style="margin-top:16px;gap:12px;align-items:center">
        <button type="submit" style="width:auto;margin:0;padding:10px 18px">Partner mentése</button>
        <a class="small" href="/partners">mégse</a>
      </div>
    </form>
  </div>`;
  return layout("Új partner", body, { active: "/partners" });
}

// ── Partner page (/partner/:id) ─────────────────────────────────────────────

/** Tab ids grow slice by slice (spec: Áttekintés → Előzmények → Előfizetés →
 *  Bizonylatok → Kontaktok); only implemented tabs are offered. */
export type PartnerTab = "overview" | "activity" | "subscription" | "documents" | "contacts";

/** The Előfizetés tab only exists on the customer face (spec: „csak vevőnél”). */
function partnerTabs(partnerId: string, active: PartnerTab, isCustomer: boolean): string {
  const tabs: ReadonlyArray<{ id: PartnerTab; label: string }> = [
    { id: "overview", label: "Áttekintés" },
    { id: "activity", label: "Előzmények / Aktivitás" },
    ...(isCustomer ? [{ id: "subscription", label: "Előfizetés" } as const] : []),
    { id: "documents", label: "Bizonylatok" },
    { id: "contacts", label: "Kontaktok" },
  ];
  return `<nav class="con-tabs">${tabs
    .map(
      (t) =>
        `<a href="/partner/${esc(partnerId)}?tab=${t.id}"${t.id === active ? ' class="active"' : ""}>${esc(t.label)}</a>`,
    )
    .join("")}</nav>`;
}

/** Site state → operator wording (mirrors the lead page's conversion block). */
function siteStatusLabel(s: string | null): string {
  switch (s) {
    case "live":
      return "élő (publikus)";
    case "provisioned":
      return "előnézet (privát)";
    case "suspended":
      return "felfüggesztve";
    case "deactivated":
      return "leállítva";
    case "draft":
      return "piszkozat";
    default:
      return "nincs oldal";
  }
}

/** Partner page: header + role-dependent KPI tiles + tabbed body (spec §3). */
export function partnerPage(
  d: PartnerDetail,
  tab: PartnerTab = "overview",
  timeline: TimelineEvent[] = [],
  docs: PartnerDocuments | null = null,
  docQuery: PartnerDocQuery = {},
  contacts: PartnerContactRow[] = [],
): string {
  const addressLine = [d.zip, d.city, d.address].filter(Boolean).join(" ");
  const badges = [
    d.isCustomer ? `<span class="pill approved">vevő</span>` : "",
    d.isSupplier ? `<span class="pill sent">szállító</span>` : "",
    d.active ? "" : `<span class="pill rejected">inaktív</span>`,
    d.taxNumber ? `<span class="pill" title="Adószám"><code>${esc(d.taxNumber)}</code></span>` : "",
    d.euVatNumber
      ? `<span class="pill" title="Közösségi adószám"><code>${esc(d.euVatNumber)}</code></span>`
      : "",
    d.registrationNo
      ? `<span class="pill" title="Cégjegyzékszám / nyilvántartási szám"><code>${esc(d.registrationNo)}</code></span>`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  // The two surfaces reference each other (owner decree #1): the marketing face
  // of a CUSTOMER partner lives on the lead page.
  const leadLink = d.tenant
    ? `<a href="/lead/${esc(d.tenant.leadId)}">Lead-lap (marketing) ▸</a>`
    : "";

  // Band KPI boxes (MineREAL header): compact value boxes on the RIGHT of the
  // identity band; the set differs by role. A dual-role partner gets both.
  const pkpi = (v: string, l: string) =>
    `<div class="con-pkpi"><div class="con-pkpi__v">${v}</div><div class="con-pkpi__l">${esc(l)}</div></div>`;
  const kpis: string[] = [];
  if (d.isCustomer) {
    const t = d.tenant;
    kpis.push(
      pkpi(t ? esc(formatPrice(t.monthlyFee, t.feeCurrency)) : "–", "havi díj"),
      pkpi(t ? esc(formatPrice(t.annualFee, t.feeCurrency)) : "–", "éves érték"),
      pkpi(fmtMoneyTile(d.receivable), "kintlévőség"),
      pkpi(t ? String(t.modules.length) : "–", "aktív modul"),
    );
  }
  if (d.isSupplier) {
    kpis.push(
      pkpi(fmtMoneyTile(d.yearSpend), "éves költség"),
      pkpi(fmtMoneyTile(d.payable), "tartozásunk"),
    );
  }

  const bodyByTab: Record<PartnerTab, string> = {
    overview: overviewTab(d, docs),
    activity: activityTab(timeline),
    subscription: subscriptionTab(d),
    documents: docs
      ? documentsTab(d.id, docs, docQuery)
      : `<p class="mut" style="padding:12px 0">Nincs bizonylat.</p>`,
    contacts: contactsTab(contacts),
  };

  // MineREAL partner header: identity band (left) + KPI boxes (right), the tab
  // row riding directly under the band, content in the same card.
  const body = `<div class="con-phead" data-kb-anchor="console.partner">
    <div class="con-phead__band">
      <div class="con-phead__id">
        <h1>${esc(d.name)}</h1>
        ${addressLine ? `<div class="con-phead__sub">${esc(addressLine)}${d.country !== "HU" ? ` · ${esc(d.country)}` : ""}</div>` : ""}
        <div class="con-phead__badges">${badges}</div>
      </div>
      <div class="con-phead__kpis">${kpis.join("")}</div>
    </div>
    ${partnerTabs(d.id, tab, d.isCustomer)}
    <div class="con-phead__body">
      <div class="row" style="justify-content:flex-end;gap:12px;margin:0 0 4px">
        ${leadLink}
        <a class="small" href="/partners">◂ partner-lista</a>
      </div>
      ${bodyByTab[tab]}
    </div>
  </div>`;
  return layout(d.name, body, { active: "/partners" });
}

/** Monthly breakdown chart (MineREAL "Havi bontás"): pure-SVG bars from the
 *  partner's documents — outgoing (revenue) vs incoming (cost), HUF only, the
 *  running year. No client JS, renders everywhere. */
function monthlyChart(docs: PartnerDocuments): string {
  const year = new Date().getFullYear();
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
      `<rect x="${(x + bw * 0.18).toFixed(1)}" y="${H - 14 - ho}" width="${(bw * 0.28).toFixed(1)}" height="${ho}" rx="2" fill="var(--citui-cyan-500)"><title>${MONTHS[m]}: kimenő ${Math.round(out[m]!).toLocaleString("hu-HU")} Ft</title></rect>` +
      `<rect x="${(x + bw * 0.54).toFixed(1)}" y="${H - 14 - hi}" width="${(bw * 0.28).toFixed(1)}" height="${hi}" rx="2" fill="var(--citui-navy-700)"><title>${MONTHS[m]}: bejövő ${Math.round(inc[m]!).toLocaleString("hu-HU")} Ft</title></rect>` +
      `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 2}" text-anchor="middle" font-size="9" fill="var(--citui-muted)">${MONTHS[m]}</text>`
    );
  }).join("");
  return `<div class="con-chart">
    <div class="con-chart__t">Havi bontás — ${year} (Ft) · <span style="color:var(--citui-cyan-500)">■</span> kimenő · <span style="color:var(--citui-navy-700)">■</span> bejövő</div>
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="Havi forgalom-bontás">${bars}</svg>
  </div>`;
}

const MONTHS = ["Jan", "Feb", "Már", "Ápr", "Máj", "Jún", "Júl", "Aug", "Szep", "Okt", "Nov", "Dec"] as const;

/** MineREAL KPI strip on the overview: db · érték boxes computed from the
 *  partner's documents (open items, overdue with average delay, habit). */
function kpiStrip(docs: PartnerDocuments): string {
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
    ? `${docs.habit.avgDays <= 0 ? Math.abs(Math.round(docs.habit.avgDays)) + " nappal korábban" : Math.round(docs.habit.avgDays) + " nap késés"} · ${docs.habit.sample} db`
    : "nincs adat";
  return `<div class="con-kstrip">
    ${box("Bizonylat", String(docs.rows.length), "db összesen")}
    ${box("Nyitott tételek", fmtMoney(docs.openGross), `${openRows.length} db`)}
    ${box("Lejárt számlák", fmtMoney(overdueRows.length ? sumBy(overdueRows) : {}), overdueRows.length ? `${overdueRows.length} db · átl. ${avgDelay} nap késés` : "nincs", overdueRows.length > 0)}
    ${box("Időben fizet", habit, habitSub)}
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
  if (!timeline.length)
    return `<p class="mut" style="padding:12px 0">Még nincs előzmény ehhez a partnerhez.</p>`;
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

/** Bizonylatok block — ONE table (owner decree: the TYPE is a filter, never a
 *  separate section): search + Típus/Fizetve selects + aging (partner scope) +
 *  per-row Számlakép + Excel. Shared by the partner tab and /documents. */
function documentsBlock(docs: PartnerDocuments, q: PartnerDocQuery, opts: DocsBlockOpts): string {
  const params = (type: string | undefined, paid: PartnerDocQuery["paid"], search: string | undefined) =>
    [
      type ? `type=${type}` : "",
      paid !== undefined ? `paid=${paid ? "1" : "0"}` : "",
      search ? `q=${encodeURIComponent(search)}` : "",
    ]
      .filter(Boolean)
      .join("&");

  // Filters live in ONE GET form. Partner tab: a slim toolbar (type + paid).
  // Global list: MineREAL column-filter row directly under the table header —
  // every column filters in place (selects submit on change, texts on Enter).
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
  const action = opts.base.split("?")[0]!;
  const typeSelect = `<select name="type" onchange="this.form.submit()" style="width:auto;margin:0">
      <option value="">Típus: mind</option>
      ${DOC_TYPE_OPTIONS.map(
        (o) => `<option value="${o.id}"${q.type === o.id ? " selected" : ""}>${esc(o.label)}</option>`,
      ).join("")}
    </select>`;
  const paidSelect = `<select name="paid" onchange="this.form.submit()" style="width:auto;margin:0">
      <option value="">Fizetve: mind</option>
      <option value="1"${q.paid === true ? " selected" : ""}>Fizetve</option>
      <option value="0"${q.paid === false ? " selected" : ""}>Nem fizetve</option>
    </select>`;
  const filterForm = opts.global
    ? ""
    : `<form method="get" action="${action}" class="row" style="gap:8px;align-items:center;margin:0;flex-wrap:wrap">
        ${hiddenTab}${typeSelect}${paidSelect}
      </form>`;

  // Column-filter row (global): the controls sit in the SAME form, each under
  // its own column — the MineREAL "Bizonylat keresés" workspace pattern.
  const anyColFilter = Boolean(q.no || q.partner || q.type || q.from || q.to || q.paid !== undefined || q.currency);
  const currencies = ["HUF", "EUR", "USD"];
  const colfRow = opts.global
    ? `<tr class="colf">
        <th><input form="docf" name="no" value="${esc(q.no ?? "")}" placeholder="Szám…"></th>
        <th><input form="docf" name="partner" value="${esc(q.partner ?? "")}" placeholder="Partner…"></th>
        <th><select form="docf" name="type" onchange="this.form.submit()">
          <option value="">mind</option>
          ${DOC_TYPE_OPTIONS.map((o) => `<option value="${o.id}"${q.type === o.id ? " selected" : ""}>${esc(o.label)}</option>`).join("")}
        </select></th>
        <th><div class="colf-stack"><input form="docf" type="date" name="from" value="${esc(q.from ?? "")}" onchange="this.form.submit()" title="Kelte-tól"><input form="docf" type="date" name="to" value="${esc(q.to ?? "")}" onchange="this.form.submit()" title="Kelte-ig"></div></th>
        <th></th>
        <th></th>
        <th><select form="docf" name="currency" onchange="this.form.submit()">
          <option value="">mind</option>
          ${currencies.map((c) => `<option value="${c}"${q.currency === c ? " selected" : ""}>${c}</option>`).join("")}
        </select></th>
        <th><select form="docf" name="paid" onchange="this.form.submit()">
          <option value="">mind</option>
          <option value="1"${q.paid === true ? " selected" : ""}>fizetve</option>
          <option value="0"${q.paid === false ? " selected" : ""}>nyitott</option>
        </select></th>
        <th></th>
        <th style="white-space:nowrap"><button form="docf" type="submit" style="padding:5px 12px;min-height:0">Szűrés</button>${
          anyColFilter ? ` <a class="small" href="${action}">✕</a>` : ""
        }</th>
      </tr>`
    : "";
  const colfForm = opts.global ? `<form id="docf" method="get" action="${action}"></form>` : "";

  const agingCells = (
    [
      ["Nem lejárt", docs.aging.notDue],
      ["1–30 nap", docs.aging.d1to30],
      ["31–60 nap", docs.aging.d31to60],
      ["61–90 nap", docs.aging.d61to90],
      ["90+ nap", docs.aging.d90plus],
    ] as const
  )
    .map(
      ([label, m], i) =>
        `<td class="num"${i >= 3 && Object.keys(m).length ? ` style="color:var(--citui-bad);font-weight:600"` : ""}>${fmtMoney(m)}</td>`,
    )
    .join("");
  const aging = `<div class="tblwrap" style="margin:10px 0"><table>
    <thead><tr><th>Korosítás (nyitott)</th><th class="num">Nem lejárt</th><th class="num">1–30 nap</th>
      <th class="num">31–60 nap</th><th class="num">61–90 nap</th><th class="num">90+ nap</th></tr></thead>
    <tbody><tr><td class="mut small">lejárat óta eltelt idő</td>${agingCells}</tr></tbody>
  </table></div>`;

  const num = (v: number): string =>
    String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const colCount = opts.global ? 10 : 9;
  const rows = docs.rows.length
    ? docs.rows
        .map(
          (r) => `<tr${r.docType === "storno" ? ` style="color:var(--citui-muted)"` : ""}>
      <td><code>${r.documentNumber ? esc(r.documentNumber) : "–"}</code></td>
      ${
        opts.global
          ? `<td>${
              r.partnerId
                ? `<a href="/partner/${esc(r.partnerId)}">${esc(r.partnerName ?? "?")}</a>`
                : `<span class="mut">–</span>`
            }</td>`
          : ""
      }
      <td class="small">${esc(docTypeLabelOf(r.direction, r.docType))}</td>
      <td class="small" style="white-space:nowrap">${esc(r.issueDate.slice(0, 10))}</td>
      <td class="small" style="white-space:nowrap">${r.dueDate ? esc(r.dueDate.slice(0, 10)) : "–"}</td>
      <td class="num">${num(r.net)}</td>
      <td class="num">${num(r.gross)} <span class="mut small">${r.currency === "HUF" ? "Ft" : esc(r.currency)}</span></td>
      <td>${
        r.paid
          ? `<span class="pill approved" title="${r.paidAt ? esc(r.paidAt.slice(0, 10)) : ""}">fizetve</span>`
          : `<span class="pill rejected">nyitott</span>`
      }</td>
      <td class="small mut">${esc(r.entityName)}</td>
      <td>${
        r.hasFile
          ? `<a class="small" href="/accounting-document/${esc(r.id)}/file" target="_blank">Számlakép ▸</a>`
          : `<span class="mut small">–</span>`
      }</td>
    </tr>`,
        )
        .join("")
    : `<tr><td colspan="${colCount}" class="mut" style="padding:20px">Nincs a szűrőnek megfelelő bizonylat.</td></tr>`;

  const csvParams = [
    params(q.type, q.paid, q.q),
    q.no ? `no=${encodeURIComponent(q.no)}` : "",
    q.partner ? `partner=${encodeURIComponent(q.partner)}` : "",
    q.from ? `from=${q.from}` : "",
    q.to ? `to=${q.to}` : "",
    q.currency ? `currency=${q.currency}` : "",
  ]
    .filter(Boolean)
    .join("&");
  const exportHref = `${opts.csvBase}${csvParams ? `?${csvParams}` : ""}`;

  return `
    ${colfForm}
    <div class="row" style="justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-top:10px">
      ${filterForm || `<span class="mut small">${docs.rows.length} találat — a szűrők az oszlopok alatt</span>`}
      <a class="small" href="${exportHref}">Excel-export (CSV) ▾</a>
    </div>
    ${opts.global ? "" : aging}
    <div class="tblwrap"><table>
      <thead><tr><th>Számla szám</th>${opts.global ? "<th>Partner</th>" : ""}<th>Típus</th><th>Kelte</th><th>Határidő</th>
        <th class="num">Nettó</th><th class="num">Bruttó</th><th>Fizetve</th><th>Könyvelőcég</th><th></th></tr>${colfRow}</thead>
      <tbody>${rows}</tbody>
    </table></div>`;
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
  const body = `<div class="panel" data-kb-anchor="console.documents">
    <div class="row" style="justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <h2 style="margin:0">Bizonylatok (${docs.rows.length})</h2>
      <a href="/documents/new" class="small" style="font-weight:600">+ Új bizonylat rögzítése</a>
    </div>
    ${documentsBlock(docs, q, { base: "/documents", csvBase: "/documents.csv", global: true })}
  </div>`;
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
  const v = (k: string) => esc(values[k] ?? "");
  const sel = (k: string, val: string) => (values[k] === val ? " selected" : "");
  if (!opts.entities.length) {
    const body = `<div class="panel" data-kb-anchor="console.document_new" style="max-width:640px">
      <h2>Új bizonylat rögzítése</h2>
      <p style="margin-top:10px">Bizonylatot csak jogi entitás (a könyvek gazdája) alá lehet rögzíteni,
        és még egy sincs felvéve.</p>
      ${
        opts.canBootstrapEntity
          ? `<form method="post" action="/entities/bootstrap" style="display:block;margin-top:8px">
              <p class="mut small">A konfigurációban (LEGAL_ENTITY_*) megvannak a cégadatok — egy
                kattintással létrehozható belőlük az entitás:</p>
              <button type="submit" style="width:auto;margin-top:8px;padding:10px 18px">Entitás létrehozása a konfigurációból</button>
            </form>`
          : `<p class="mut small">A LEGAL_ENTITY_* beállítások sincsenek kitöltve a környezetben —
              előbb azokat kell rögzíteni (.env), utána itt egy kattintás az entitás.</p>`
      }
    </div>`;
    return layout("Új bizonylat", body, { active: "/documents" });
  }

  const partnerOpts = opts.partners
    .map(
      (p) =>
        `<option value="${esc(p.id)}"${sel("partner_id", p.id)}>${esc(p.name)}${
          p.taxNumber ? ` · ${esc(p.taxNumber)}` : ""
        }${p.isSupplier ? " (szállító)" : ""}</option>`,
    )
    .join("");
  const entityOpts = opts.entities
    .map((e) => `<option value="${esc(e.id)}"${sel("legal_entity_id", e.id)}>${esc(e.name)}</option>`)
    .join("");

  const lbl = (id: string, text: string, required = false) =>
    `<label class="small mut" for="${id}" style="display:block;margin-top:10px">${esc(text)}${required ? " *" : ""}</label>`;

  const body = `<div class="panel" data-kb-anchor="console.document_new" style="max-width:680px">
    <h2>Új bizonylat rögzítése</h2>
    <p class="mut small" style="margin-top:4px">Jellemzően bejövő (szállítói) számla — a saját kimenő
      számláink a fizetési útból maguktól születnek. A rögzített tétel azonnal látszik a Bizonylatok
      listában és a partner lapján.</p>
    ${error ? `<div class="row" style="margin:10px 0"><span class="pill rejected">${esc(error)}</span></div>` : ""}
    <form method="post" action="/documents/new" style="display:block">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 14px">
        <div>
          ${lbl("dn-type", "Számlatípus", true)}
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
            <option value="">— válassz —</option>${partnerOpts}
          </select>
          <div class="mut small" style="margin-top:3px">Nincs a listában? <a href="/partners/new">Új partner rögzítése ▸</a></div>
        </div>
        <div>
          ${lbl("dn-entity", "Könyvelőcég (jogi entitás)", true)}
          <select id="dn-entity" name="legal_entity_id" required style="width:100%;margin-top:4px">${entityOpts}</select>
        </div>
        <div>
          ${lbl("dn-no", "Bizonylatszám (ami a számlán áll)", true)}
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
          ${lbl("dn-fulfil", "Teljesítés")}
          <input id="dn-fulfil" name="fulfillment_date" type="date" value="${v("fulfillment_date")}" style="width:100%;margin-top:4px">
        </div>
        <div>
          ${lbl("dn-due", "Fizetési határidő")}
          <input id="dn-due" name="due_date" type="date" value="${v("due_date")}" style="width:100%;margin-top:4px">
        </div>
        <div>
          ${lbl("dn-net", "Nettó")}
          <input id="dn-net" name="net" inputmode="decimal" value="${v("net")}" placeholder="ha üres: a bruttóval egyezik" style="width:100%;margin-top:4px">
        </div>
        <div>
          ${lbl("dn-gross", "Bruttó", true)}
          <input id="dn-gross" name="gross" inputmode="decimal" value="${v("gross")}" required style="width:100%;margin-top:4px">
        </div>
        <div>
          ${lbl("dn-vatt", "Áfa-kezelés")}
          <input id="dn-vatt" name="vat_treatment" value="${v("vat_treatment")}" placeholder="pl. AAM / 27 / RC" style="width:100%;margin-top:4px">
        </div>
      </div>
      <div class="row" style="gap:14px;margin-top:12px;align-items:center;flex-wrap:wrap">
        <label class="small" style="display:flex;gap:7px;align-items:center">
          <input type="checkbox" name="paid"${values.paid === "on" ? " checked" : ""}> fizetve</label>
        <input name="paid_at" type="date" value="${v("paid_at")}" title="Fizetés dátuma" style="width:auto;margin:0">
      </div>
      ${lbl("dn-file", "Számlakép (PDF vagy fotó, max 8 MB)")}
      <input id="dn-file" type="file" accept="application/pdf,image/jpeg,image/png" onchange="citDocFile(this)" style="margin-top:4px">
      <span id="dn-file-name" class="mut small"></span>
      <input type="hidden" id="dn-file-data" name="file_data" value="">
      ${lbl("dn-note", "Megjegyzés")}
      <input id="dn-note" name="note" value="${v("note")}" style="width:100%;margin-top:4px">
      <div class="row" style="margin-top:16px;gap:12px;align-items:center">
        <button type="submit" style="width:auto;margin:0;padding:10px 18px">Bizonylat mentése</button>
        <a class="small" href="/documents">mégse</a>
      </div>
    </form>
    ${DOC_FILE_JS}
  </div>`;
  return layout("Új bizonylat", body, { active: "/documents" });
}

/** Előfizetés tab (customer face only): what they subscribe to and where the
 *  live site is — with the crossover to the marketing side (lead page). */
function subscriptionTab(d: PartnerDetail): string {
  const t = d.tenant;
  if (!t)
    return `<p class="mut" style="padding:12px 0">Ehhez a partnerhez nem tartozik platform-előfizetés
      (nincs tenant-kapcsolat).</p>`;
  const modLabel = (id: string): string => MODULE_CATALOG.find((m) => m.id === id)?.label ?? id;
  const mods = t.modules.length
    ? t.modules.map((m) => `<span class="pill approved">${esc(modLabel(m))}</span>`).join(" ")
    : `<span class="mut">nincs aktív modul</span>`;
  const liveHost = t.customDomain ?? (t.slug ? `${t.slug}.citoviso.com` : null);
  const siteLink =
    t.siteStatus === "live" && liveHost
      ? `<a href="https://${esc(liveHost)}" target="_blank">${esc(liveHost)} ▸</a>`
      : t.previewToken
        ? `<a href="/site/${esc(t.previewToken)}" target="_blank">privát előnézet ▸</a> <span class="mut small">(${esc(siteStatusLabel(t.siteStatus))})</span>`
        : `<span class="mut">${esc(siteStatusLabel(t.siteStatus))}</span>`;
  return `<div style="max-width:640px">
    <dl class="kv">
      <dt>Havi díj</dt><dd>${esc(formatPrice(t.monthlyFee, t.feeCurrency))} <span class="mut small">az aktív modulokból számítva</span></dd>
      <dt>Éves érték</dt><dd>${esc(formatPrice(t.annualFee, t.feeCurrency))}</dd>
      <dt>Fizetési ciklus</dt><dd>${
        t.billingPeriod ? (t.billingPeriod === "annual" ? "éves" : "havi") : `<span class="mut">még nincs fizetés</span>`
      }</dd>
      <dt>Domain</dt><dd>${liveHost ? `<code>${esc(liveHost)}</code>` : `<span class="mut">–</span>`}</dd>
      <dt>Élő oldal</dt><dd>${siteLink}</dd>
      ${t.liveAt ? `<dt>Élesítve</dt><dd>${esc(t.liveAt.slice(0, 10))}</dd>` : ""}
    </dl>
    <div style="margin-top:12px">
      <div class="mut small" style="margin-bottom:6px">Aktív modulok (${t.modules.length}):</div>
      <div class="row" style="flex-wrap:wrap;gap:6px">${mods}</div>
    </div>
    <p style="margin-top:14px"><a href="/lead/${esc(t.leadId)}">A marketing-oldal (mock, megkeresés,
      konverzió) a lead-lapon ▸</a></p>
  </div>`;
}

/** Kontaktok tab: partner_contact grouped by role, primary first (spec §3). */
function contactsTab(contacts: PartnerContactRow[]): string {
  if (!contacts.length)
    return `<p class="mut" style="padding:12px 0">Ehhez a partnerhez még nincs rögzített kapcsolattartó.
      A vevő a megrendeléskor megadott számlázási címekkel érkezik ide automatikusan.</p>`;
  const KIND_LABEL: Readonly<Record<PartnerContactRow["kind"], string>> = {
    billing: "Számlázás",
    technical: "Műszaki",
    general: "Általános",
    legal: "Jogi",
  };
  const groups = new Map<string, PartnerContactRow[]>();
  for (const c of contacts) {
    const list = groups.get(c.kind) ?? [];
    list.push(c);
    groups.set(c.kind, list);
  }
  const blocks = [...groups.entries()]
    .map(([kind, list]) => {
      const rows = list
        .map(
          (c) => `<tr${c.active ? "" : ` style="color:var(--citui-muted)"`}>
        <td>${c.name ? esc(c.name) : `<span class="mut">–</span>`}</td>
        <td>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : `<span class="mut">–</span>`}</td>
        <td class="small">${c.phone ? esc(c.phone) : `<span class="mut">–</span>`}</td>
        <td>${c.isPrimary ? `<span class="pill approved">elsődleges</span>` : ""}${c.active ? "" : ` <span class="pill rejected">inaktív</span>`}</td>
        <td class="small mut">${c.note ? esc(c.note) : ""}</td>
      </tr>`,
        )
        .join("");
      return `<h3 style="margin:16px 0 6px">${esc(KIND_LABEL[kind as PartnerContactRow["kind"]] ?? kind)}</h3>
      <div class="tblwrap"><table>
        <thead><tr><th>Név</th><th>E-mail</th><th>Telefon</th><th></th><th>Megjegyzés</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
    })
    .join("");
  return `<div>${blocks}
    <p class="mut small" style="margin-top:12px">A „Számlázás” csoport elsődleges címére megy a számla;
      a többi billing-cím másolatot kap. A címeket a vevő a megrendeléskor adja meg.</p>
  </div>`;
}

/** Áttekintés tab (MineREAL): KPI strip + havi bontás chart + master data. */
function overviewTab(d: PartnerDetail, docs: PartnerDocuments | null): string {
  const banks = d.bankAccounts.length
    ? d.bankAccounts
        .map(
          (b) =>
            `<code>${esc(b.accountNo)}</code>${b.bankName ? ` <span class="mut small">(${esc(b.bankName)}${b.currency ? `, ${esc(b.currency)}` : ""})</span>` : ""}${b.isDefault && d.bankAccounts.length > 1 ? ` <span class="pill approved">alapértelmezett</span>` : ""}`,
        )
        .join("<br>")
    : `<span class="mut">–</span>`;
  const dash = `<span class="mut">–</span>`;
  const site = d.tenant
    ? `${siteStatusLabel(d.tenant.siteStatus)}${
        d.tenant.slug ? ` · <code>${esc(d.tenant.slug)}.citoviso.com</code>` : ""
      }${d.tenant.customDomain ? ` · <code>${esc(d.tenant.customDomain)}</code>` : ""}`
    : "";
  return `<div>
    ${docs ? kpiStrip(docs) : ""}
    ${docs ? monthlyChart(docs) : ""}
    <div class="con-kbox__t" style="margin:0 0 8px">Partner adatai</div>
    <dl class="kv" style="max-width:640px">
      <dt>Cégnév</dt><dd>${esc(d.name)}</dd>
      <dt>Ország</dt><dd>${esc(d.country)}</dd>
      <dt>Irsz.</dt><dd>${d.zip ? esc(d.zip) : dash}</dd>
      <dt>Város</dt><dd>${d.city ? esc(d.city) : dash}</dd>
      <dt>Cím</dt><dd>${d.address ? esc(d.address) : dash}</dd>
      <dt>Adószám</dt><dd>${d.taxNumber ? `<code>${esc(d.taxNumber)}</code>` : dash}</dd>
      ${d.euVatNumber ? `<dt>EU adószám</dt><dd><code>${esc(d.euVatNumber)}</code></dd>` : ""}
      <dt>Cégjegyzékszám</dt><dd>${d.registrationNo ? `<code>${esc(d.registrationNo)}</code>` : dash}</dd>
      <dt>E-mail</dt><dd>${d.email ? esc(d.email) : dash}</dd>
      <dt>Telefon</dt><dd>${d.phone ? esc(d.phone) : dash}</dd>
      <dt>Bankszámla</dt><dd>${banks}</dd>
      ${d.tenant ? `<dt>Élő oldal</dt><dd>${site}</dd>` : ""}
      <dt>Partner azóta</dt><dd>${esc(d.createdAt.slice(0, 10))}</dd>
    </dl>
  </div>`;
}
