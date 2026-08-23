// Partner console — views (PARTNER-UI-SPEC.md). Server-rendered HTML, same
// hand-rolled approach as views.ts. All styling from the central design core
// (--citui-* tokens via citui.css / citui-console.css); icons from src/ui/icons.ts.
//
// i18n note: every label here is operator-facing (internal console) — outside
// the §B.18 customer-facing i18n scope.

import { esc, layout } from "./views.js";
import { formatPrice } from "../pricing.js";
import { MODULE_CATALOG } from "../modules.js";
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
    activity: activityTab(timeline),
    subscription: subscriptionTab(d),
    documents: docs
      ? documentsTab(d.id, docs, docQuery)
      : `<p class="mut" style="padding:12px 0">Nincs bizonylat.</p>`,
    contacts: contactsTab(contacts),
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
    ${partnerTabs(d.id, tab, d.isCustomer)}
    ${bodyByTab[tab]}
  </div>`;
  return layout(d.name, body, { active: "/partners" });
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

/** Bizonylatok tab (spec: MineREAL-minta 1:1) — filters + KPI row + aging +
 *  document table with per-row Számlakép + Excel export. */
function documentsTab(partnerId: string, docs: PartnerDocuments, q: PartnerDocQuery): string {
  const base = `/partner/${esc(partnerId)}?tab=documents`;
  const link = (dir: PartnerDocQuery["direction"], paid: PartnerDocQuery["paid"]) =>
    `${base}${dir ? `&dir=${dir}` : ""}${paid !== undefined ? `&paid=${paid ? "1" : "0"}` : ""}`;
  const filterTab = (label: string, on: boolean, href: string) =>
    `<a href="${href}"${on ? ' class="active"' : ""}>${esc(label)}</a>`;

  const dirTabs = `<nav class="con-tabs" style="margin:0">
    ${filterTab("Mind", !q.direction, link(undefined, q.paid))}
    ${filterTab("Vevői", q.direction === "outgoing", link("outgoing", q.paid))}
    ${filterTab("Szállítói", q.direction === "incoming", link("incoming", q.paid))}
  </nav>`;
  const paidTabs = `<nav class="con-tabs" style="margin:0">
    ${filterTab("Mind", q.paid === undefined, link(q.direction, undefined))}
    ${filterTab("Fizetve", q.paid === true, link(q.direction, true))}
    ${filterTab("Nem fizetve", q.paid === false, link(q.direction, false))}
  </nav>`;

  const habit = docs.habit
    ? `${docs.habit.avgDays <= 0 ? Math.abs(Math.round(docs.habit.avgDays)) + " nappal határidő előtt" : Math.round(docs.habit.avgDays) + " nap késéssel"} · ${Math.round(docs.habit.onTimeRatio * 100)}% időben (${docs.habit.sample} bizonylat)`
    : "";
  const kpis = `<div class="con-cards" style="margin:12px 0 4px">
    ${kpiTile(fmtMoney(docs.totalGross), "összes bruttó (szűrt)")}
    ${kpiTile(fmtMoney(docs.paidGross), "fizetve")}
    ${kpiTile(fmtMoney(docs.openGross), "nyitott")}
    ${docs.habit ? kpiTile(`<span style="font-size:1.02rem;line-height:1.35;display:inline-block">${esc(habit)}</span>`, "fizetési szokás") : ""}
  </div>`;

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

  const typeLabel = (t: string): string =>
    t === "invoice"
      ? "számla"
      : t === "storno"
        ? "sztornó"
        : t === "proforma"
          ? "díjbekérő"
          : t === "credit_note"
            ? "jóváíró"
            : t === "correction"
              ? "helyesbítő"
              : t;
  const num = (v: number): string =>
    String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const rows = docs.rows.length
    ? docs.rows
        .map(
          (r) => `<tr${r.docType === "storno" ? ` style="color:var(--citui-muted)"` : ""}>
      <td><code>${r.documentNumber ? esc(r.documentNumber) : "–"}</code></td>
      <td class="small">${r.direction === "outgoing" ? "vevői" : "szállítói"} ${esc(typeLabel(r.docType))}</td>
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
    : `<tr><td colspan="9" class="mut" style="padding:20px">Nincs a szűrőnek megfelelő bizonylat.</td></tr>`;

  const exportHref = `/partner/${esc(partnerId)}/documents.csv${
    q.direction || q.paid !== undefined
      ? `?${[q.direction ? `dir=${q.direction}` : "", q.paid !== undefined ? `paid=${q.paid ? "1" : "0"}` : ""].filter(Boolean).join("&")}`
      : ""
  }`;

  return `
    <div class="row" style="justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-top:10px">
      <div class="row" style="gap:18px;flex-wrap:wrap">${dirTabs}${paidTabs}</div>
      <a class="small" href="${exportHref}">Excel-export (CSV) ▾</a>
    </div>
    ${kpis}
    ${aging}
    <div class="tblwrap"><table>
      <thead><tr><th>Számla szám</th><th>Típus</th><th>Kelte</th><th>Határidő</th>
        <th class="num">Nettó</th><th class="num">Bruttó</th><th>Fizetve</th><th>Könyvelőcég</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
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
