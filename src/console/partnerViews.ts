// Partner console — views (PARTNER-UI-SPEC.md). Server-rendered HTML, same
// hand-rolled approach as views.ts. All styling from the central design core
// (--citui-* tokens via citui.css / citui-console.css); icons from src/ui/icons.ts.
//
// i18n note: every label here is operator-facing (internal console) — outside
// the §B.18 customer-facing i18n scope.

import { esc, layout } from "./views.js";
import type { MoneyByCurrency, PartnerListQuery, PartnerListRow } from "./partnerData.js";

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
