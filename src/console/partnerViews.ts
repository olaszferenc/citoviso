// Partner console — views (PARTNER-UI-SPEC.md). Server-rendered HTML, same
// hand-rolled approach as views.ts. All styling from the central design core
// (--citui-* tokens via citui.css / citui-console.css); icons from src/ui/icons.ts.
//
// i18n note: every label here is operator-facing (internal console) — outside
// the §B.18 customer-facing i18n scope.

import { esc, layout } from "./views.js";
import { formatPrice } from "../pricing.js";
import type {
  MoneyByCurrency,
  PartnerDetail,
  PartnerListQuery,
  PartnerListRow,
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
    <h2>Partnerek (${rows.length})</h2>
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

// ── Partner page (/partner/:id) ─────────────────────────────────────────────

/** Tab ids grow slice by slice (spec: Áttekintés → Előzmények → Előfizetés →
 *  Bizonylatok → Kontaktok); only implemented tabs are offered. */
export type PartnerTab = "overview";

function partnerTabs(partnerId: string, active: PartnerTab): string {
  const tabs: ReadonlyArray<{ id: PartnerTab; label: string }> = [
    { id: "overview", label: "Áttekintés" },
  ];
  return `<nav class="con-tabs">${tabs
    .map(
      (t) =>
        `<a href="/partner/${esc(partnerId)}?tab=${t.id}"${t.id === active ? ' class="active"' : ""}>${esc(t.label)}</a>`,
    )
    .join("")}</nav>`;
}

/** KPI tile (same visual vocabulary as the dashboard's con-card, non-link). */
function kpiTile(value: string, label: string): string {
  return `<div class="con-card"><div class="n">${value}</div><div class="l">${esc(label)}</div></div>`;
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
export function partnerPage(d: PartnerDetail, tab: PartnerTab = "overview"): string {
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

  // KPI tiles differ by role (spec): customer = subscription value + open debt
  // + active modules; supplier = yearly spend + our open debt. A dual-role
  // partner gets both rows.
  const tiles: string[] = [];
  if (d.isCustomer) {
    const t = d.tenant;
    tiles.push(
      kpiTile(t ? formatPrice(t.monthlyFee, t.feeCurrency) : "–", "havi díj"),
      kpiTile(t ? formatPrice(t.annualFee, t.feeCurrency) : "–", "éves érték"),
      kpiTile(fmtMoney(d.receivable), "kintlévőség"),
      kpiTile(t ? String(t.modules.length) : "–", "aktív modul"),
    );
  }
  if (d.isSupplier) {
    tiles.push(
      kpiTile(fmtMoney(d.yearSpend), "éves költség (365 nap)"),
      kpiTile(fmtMoney(d.payable), "nyitott tartozásunk"),
    );
  }

  const bodyByTab: Record<PartnerTab, string> = {
    overview: overviewTab(d),
  };

  const body = `<div class="panel" data-kb-anchor="console.partner">
    <div class="row" style="justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
      <div>
        <h2 style="margin-bottom:2px">${esc(d.name)}</h2>
        ${addressLine ? `<p class="mut small" style="margin:0 0 8px">${esc(addressLine)}${d.country !== "HU" ? ` · ${esc(d.country)}` : ""}</p>` : ""}
        <div class="row" style="gap:6px;flex-wrap:wrap">${badges}</div>
      </div>
      <div class="row" style="gap:12px;align-items:center">
        ${leadLink}
        <a class="small" href="/partners">◂ partner-lista</a>
      </div>
    </div>
    ${tiles.length ? `<div class="con-cards" style="margin:14px 0 4px">${tiles.join("")}</div>` : ""}
    ${partnerTabs(d.id, tab)}
    ${bodyByTab[tab]}
  </div>`;
  return layout(d.name, body, { active: "/partners" });
}

/** Áttekintés tab: the partner master-data block (spec: MineREAL kv layout). */
function overviewTab(d: PartnerDetail): string {
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
  return `<div style="max-width:640px">
    <dl class="kv">
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
