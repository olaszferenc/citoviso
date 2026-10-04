// Riport module pages — Tölcsér (B: question-first) and Viselkedés — rendered from ONE
// ReportData object (src/console/reportData.ts). The frozen plan is the contract:
// assets/design-refs/console/riport/ (README ③–⑲). Server-rendered, no client JS: the
// filters are links, the note is a form, the charts are inline SVG / CSS bars with
// <title> tooltips — the same no-JS vocabulary the partner page's monthly chart uses.
//
// Colours: tokens only (ADR-0021). Emphasis form — one hue (link-ink) + a ghost gray —
// everywhere except the device panel (3 classes, direct-labelled). Every chart has its
// number next to it, so colour never carries meaning alone (dataviz rule + README ⑥).

import { esc, helpLink, layout } from "./views.js";
import { T } from "../i18n/mail.js";
import { consoleLang } from "./i18nCtx.js";
import { SKINS } from "../engine/skins.js";
import { EXIT_REASONS, EXPECTED_STATED, STATED_REASONS, type ExitReason, type StatedReason } from "../analytics/exitReason.js";
import {
  EXIT_SECTIONS,
  REPORT_DIMS,
  REPORT_RANGES,
  type Channel,
  type Device,
  type ExitSection,
  type Hypothesis,
  type ReportData,
  type ReportDim,
  type ReportDays,
  type StageCounts,
} from "./reportData.js";

export type ReasonMode = "inf" | "said" | "both";

// ── formatting ────────────────────────────────────────────────────────────────
const pct = (a: number, b: number): string => (b ? `${Math.round((a / b) * 100)}%` : "–");
const pct1 = (a: number, b: number): string => (b ? `${((a / b) * 100).toFixed(1).replace(".", ",")}%` : "–");
const pctV = (v: number): string => (Number.isFinite(v) ? `${v.toFixed(1).replace(".", ",")}%` : "–");
const dec1 = (v: number): string => (Number.isFinite(v) ? v.toFixed(1).replace(".", ",") : "–");
function fmtH(h: number, lang: string): string {
  if (!Number.isFinite(h)) return "–";
  if (h < 1) return T(lang, "{n} perc", { n: Math.round(h * 60) });
  if (h < 48) return T(lang, "{n} óra", { n: dec1(h) });
  return T(lang, "{n} nap", { n: dec1(h / 24) });
}
function fmtS(s: number, lang: string): string {
  if (!Number.isFinite(s)) return "–";
  const r = Math.round(s);
  return r < 60 ? T(lang, "{n} mp", { n: r }) : T(lang, "{m} p {s} mp", { m: Math.floor(r / 60), s: r % 60 });
}
/** "+3,7" / "−2" with the ok/bad TEXT token; null = no comparison (Összes). */
function delta(cur: number, prev: number | null, lang: string, lowerIsBetter = false): string {
  if (prev === null || !Number.isFinite(prev) || !Number.isFinite(cur)) return `<span class="rp-delta rp-delta--flat">—</span>`;
  const d = cur - prev;
  if (Math.abs(d) < 0.05) return `<span class="rp-delta rp-delta--flat">± 0</span>`;
  const good = lowerIsBetter ? d < 0 : d > 0;
  const unit = lowerIsBetter ? T(lang, "óra") : T(lang, "pont");
  return `<span class="rp-delta ${good ? "rp-delta--up" : "rp-delta--dn"}" title="${esc(T(lang, "változás az előző, ugyanakkora időszakhoz"))}">${d > 0 ? "+" : "−"}${dec1(Math.abs(d))} ${esc(unit)}</span>`;
}
const dayLabel = (iso: string): string => `${Number(iso.slice(5, 7))}. ${Number(iso.slice(8, 10))}.`;

// ── labels (data values → words; raw DB values never reach the screen, ADR-0141) ──
const SEG_LABEL = (lang: string): Readonly<Record<string, string>> => ({
  nincs_honlap: T(lang, "Nincs honlap"),
  "0_labnyom": T(lang, "0 lábnyom"),
  van_labnyom: T(lang, "Van lábnyom"),
  elavult: T(lang, "Elavult honlap"),
  ismeretlen: T(lang, "Ismeretlen"),
});
const CHANNEL_LABEL = (lang: string): Readonly<Record<Channel, string>> => ({
  email: T(lang, "E-mail"),
  sms: T(lang, "SMS"),
  mms: T(lang, "MMS"),
  email_sms: T(lang, "E-mail + SMS/MMS"),
  manual: T(lang, "Kézi jelölés"),
});
const DEVICE_LABEL = (lang: string): Readonly<Record<Device, string>> => ({
  mobile: T(lang, "Mobil"),
  tablet: T(lang, "Tablet"),
  desktop: T(lang, "Asztali"),
  bot: T(lang, "Robot"),
  unknown: T(lang, "Ismeretlen"),
});
export const DIM_LABEL = (lang: string): Readonly<Record<ReportDim, string>> => ({
  segment: T(lang, "Szegmens"),
  channel: T(lang, "Csatorna"),
  device: T(lang, "Eszköz"),
  style: T(lang, "Mock-stílus"),
  hour: T(lang, "Küldési óra"),
});
export const REASON_LABEL = (lang: string): Readonly<Record<ExitReason, string>> => ({
  no_hook: T(lang, "Nem fogta meg"),
  browsed: T(lang, "Nézelődött, nem lépett"),
  played: T(lang, "Konfigurált, nem vette komolyan"),
  price_shock: T(lang, "Ár-sokk"),
  billing_friction: T(lang, "Számlázási súrlódás"),
  domain_gate: T(lang, "Domain-kapu"),
  module_dependency: T(lang, "Modul-függőség"),
  payment_stall: T(lang, "Fizetés-elakadás"),
  escalation_dismissed: T(lang, "Eszkaláció elvetve"),
  technical: T(lang, "Technikai"),
});
export const STATED_LABEL = (lang: string): Readonly<Record<StatedReason, string>> => ({
  expensive: T(lang, "Drága"),
  not_now: T(lang, "Nem időszerű"),
  distrust: T(lang, "Nem bízom / nem értem"),
  have_site: T(lang, "Van honlapom"),
  other: T(lang, "Más"),
});
const SECTION_LABEL = (lang: string): Readonly<Record<ExitSection, string>> => ({
  hero: T(lang, "Hős / főcím"),
  gallery: T(lang, "Galéria"),
  rooms: T(lang, "Szobák"),
  amenities: T(lang, "Szolgáltatások"),
  reviews: T(lang, "Vélemények"),
  map: T(lang, "Térkép"),
  panel: T(lang, "Ár-panel"),
  billing: T(lang, "Számlázás"),
  payment: T(lang, "Fizetés (Barion)"),
});
function dimValueLabel(dim: ReportDim, key: string, lang: string): string {
  if (dim === "segment") return SEG_LABEL(lang)[key] ?? key;
  if (dim === "channel") return CHANNEL_LABEL(lang)[key as Channel] ?? key;
  if (dim === "device") return DEVICE_LABEL(lang)[key as Device] ?? key;
  if (dim === "style") return SKINS[key]?.label ?? (key === "ismeretlen" ? T(lang, "Ismeretlen") : key);
  return key;
}

// ── shell: tabs + filter row ──────────────────────────────────────────────────
const RANGE_LABEL = (d: ReportDays, lang: string): string => (d ? T(lang, "{n} nap", { n: d }) : T(lang, "Összes"));
const qs = (d: ReportData, extra: Record<string, string> = {}): string => {
  const p = new URLSearchParams({ days: String(d.days), dim: d.dim, ...extra });
  return `?${p.toString()}`;
};

function shell(d: ReportData, active: "/report" | "/report/behaviour", body: string, lang: string): string {
  const tabs =
    `<nav class="con-tabs">` +
    `<a href="/report${qs(d)}"${active === "/report" ? ' class="active"' : ""}>${esc(T(lang, "Tölcsér"))}</a>` +
    `<a href="/report/behaviour${qs(d)}"${active === "/report/behaviour" ? ' class="active"' : ""}>${esc(T(lang, "Viselkedés"))}</a>` +
    `<a class="rp-tab--soon" aria-disabled="true" title="${esc(T(lang, "2. kör — készül"))}">${esc(T(lang, "Pénzügy"))}</a>` +
    `<a class="rp-tab--soon" aria-disabled="true" title="${esc(T(lang, "3. kör — készül"))}">${esc(T(lang, "Tenantok"))}</a>` +
    `</nav>`;
  const base = active;
  const ranges = REPORT_RANGES.map(
    (r) => `<a href="${base}${qs(d, { days: String(r) })}"${r === d.days ? ' class="on"' : ""}>${esc(RANGE_LABEL(r, lang))}</a>`,
  ).join("");
  const dims = REPORT_DIMS.map(
    (k) => `<option value="${k}"${k === d.dim ? " selected" : ""}>${esc(T(lang, "Bontás: {dim}", { dim: DIM_LABEL(lang)[k].toLowerCase() }))}</option>`,
  ).join("");
  const filter =
    `<form class="rp-filt" method="get" action="${base}">` +
    `<input type="hidden" name="days" value="${d.days}">` +
    `<div class="rp-chips" role="group" aria-label="${esc(T(lang, "Időszak"))}">${ranges}</div>` +
    `<select name="dim" aria-label="${esc(T(lang, "Bontás"))}" onchange="this.form.submit()">${dims}</select>` +
    `<noscript><button type="submit" class="citui-btn citui-btn--ghost">${esc(T(lang, "Alkalmaz"))}</button></noscript>` +
    `<span class="rp-filt__n">${esc(T(lang, "{n} követett link az időszakban · csak KIKÜLDÖTT linkek (saját megnyitás, teszt nem számít)", { n: d.counts.sent }))}</span>` +
    `</form>`;
  return layout(
    T(lang, "Megkeresés-riport"),
    `<div class="con-ph"><h1>${esc(T(lang, "Megkeresés-riport"))} ${helpLink("console.report")}</h1></div>${tabs}${filter}${body}`,
    { active },
  );
}

// ── small chart pieces ────────────────────────────────────────────────────────
function sparkline(vals: readonly number[]): string {
  const w = 120;
  const h = 26;
  const mx = Math.max(1, ...vals);
  const n = Math.max(2, vals.length);
  const pts = vals.map((v, i) => `${((i / (n - 1)) * w).toFixed(1)},${(h - 2 - (v / mx) * (h - 4)).toFixed(1)}`).join(" ");
  return `<svg class="rp-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--citui-link-ink)" stroke-width="2" stroke-linejoin="round"/></svg>`;
}
/** Heat cell: one hue, intensity = ratio / max (sequential, dataviz rule). */
const heatCell = (ratio: number, maxRatio: number, label: string): string => {
  // The mix is capped at 40 % so --citui-ink stays ≥ 4.5:1 on the deepest cell in BOTH
  // themes (console-dark-scan 2026-10-04: a 70 % cell with inverse ink measured 2.94:1 dark).
  const a = Math.max(0, Math.min(1, maxRatio ? ratio / maxRatio : 0));
  const mix = Math.round(a * 40);
  return `<span class="rp-heat" style="background:color-mix(in srgb, var(--citui-link-ink) ${mix}%, var(--citui-panel))">${esc(label)}</span>`;
};
const bar = (widthPct: number, cls = ""): string =>
  `<i class="rp-bar__fill ${cls}" style="width:${Math.max(0, Math.min(100, widthPct)).toFixed(1)}%"></i>`;

// ── Tölcsér page (B — question-first) ─────────────────────────────────────────
const HYP_TEXT = (lang: string): Readonly<Record<Hypothesis["key"], { q: string; m: string }>> => ({
  open_rate: { q: T(lang, "Megfogja-e a levél?"), m: T(lang, "megnyitás / kiküldött") },
  return_rate: { q: T(lang, "Visszatér-e?"), m: T(lang, "visszatérő / megnyitó") },
  deep_rate: { q: T(lang, "Belenyúl-e a modulokba?"), m: T(lang, "elmélyülő / megnyitó") },
  order_rate: { q: T(lang, "Megrendeli-e?"), m: T(lang, "rendelés / kiküldött") },
  paid_rate: { q: T(lang, "Ki is fizeti?"), m: T(lang, "fizetve / rendelés") },
  first_open_hours: { q: T(lang, "Gyorsan reagál-e?"), m: T(lang, "medián küldés → 1. megnyitás") },
});
const VERDICT = (lang: string): Readonly<Record<Hypothesis["verdict"], { label: string; cls: string }>> => ({
  above: { label: T(lang, "cél felett"), cls: "ok" },
  near: { label: T(lang, "közelít"), cls: "warn" },
  below: { label: T(lang, "cél alatt"), cls: "bad" },
  none: { label: T(lang, "nincs adat"), cls: "" },
});

function hypothesisCards(d: ReportData, lang: string): string {
  const tx = HYP_TEXT(lang);
  const vd = VERDICT(lang);
  return `<div class="rp-hyp">${d.hypotheses
    .map((h) => {
      const lower = h.direction === "lower";
      const value = lower ? fmtH(h.value, lang) : pctV(h.value);
      const mx = lower ? Math.max(h.target * 2, Number.isFinite(h.value) ? h.value : 0, 1) : 100;
      const fill = Number.isFinite(h.value) ? Math.min(100, (h.value / mx) * 100) : 0;
      const mark = Math.min(100, (h.target / mx) * 100);
      const v = vd[h.verdict];
      const sub = lower
        ? T(lang, "{n} megnyitás · a kisebb a jobb", { n: h.num })
        : `${h.num} / ${h.den}`;
      const change = delta(h.value, h.prevValue, lang, lower);
      const changeNote = d.days ? T(lang, "{d} az előző {n} naphoz", { d: change, n: d.days }) : change;
      return (
        `<div class="rp-hcard"><div class="rp-hcard__q">${esc(tx[h.key].q)}</div><div class="rp-hcard__m">${esc(tx[h.key].m)}</div>` +
        `<div class="rp-hcard__v"><b>${esc(value)}</b><span class="rp-pill rp-pill--${v.cls}"><i></i>${esc(v.label)}</span></div>` +
        `<div class="rp-meter" title="${esc(T(lang, "cél: {t}", { t: lower ? fmtH(h.target, lang) : `${h.target}%` }))}">${bar(fill)}<em style="left:${mark.toFixed(1)}%" data-l="${esc(T(lang, "cél {t}", { t: lower ? fmtH(h.target, lang) : `${h.target}%` }))}"></em></div>` +
        `<div class="rp-hcard__m rp-hcard__sub">${esc(sub)} · ${changeNote}</div>${sparkline(h.weekly)}</div>`
      );
    })
    .join("")}</div>`;
}

function returnsPanel(d: ReportData, lang: string): string {
  const total = d.counts.opened;
  const rows = d.returns
    .map((r, i) => {
      const w = total ? Math.max(1.5, (r.prospects / total) * 100) : 0;
      const label = r.visits === "1" ? T(lang, "1 látogatás") : r.visits === "2" ? T(lang, "2 látogatás") : T(lang, "3+ látogatás");
      return (
        `<div class="rp-frow" title="${esc(T(lang, "{label}: {n} lead, ebből rendelt {o}", { label, n: r.prospects, o: r.ordered }))}">` +
        `<div class="rp-frow__l">${esc(label)}<small>${esc(T(lang, "{n} rendelés", { n: r.ordered }))}</small></div>` +
        `<div class="rp-bar rp-bar--tall">${bar(w, `rp-ramp-${i + 2}`)}<b class="rp-bar__n${w > 18 ? "" : " rp-bar__n--out"}"${w > 18 ? "" : ` style="left:calc(${w.toFixed(1)}% + 8px)"`}>${r.prospects}</b><span class="rp-bar__r">${esc(T(lang, "rendel: {p}", { p: pct(r.ordered, r.prospects) }))}</span></div></div>`
      );
    })
    .join("");
  const e = d.escalation;
  const note = e.shown
    ? T(lang, "Eszkalációs ajánlat (N. látogatás, kedvezménnyel): {s} leadnek jelent meg, {c} kattintott rá ({p}), {o} rendelt belőlük. Elvetette: {x}.", { s: e.shown, c: e.cta, p: pct(e.cta, e.shown), o: e.ordered, x: e.dismissed })
    : T(lang, "Eszkalációs ajánlat ebben az időszakban még nem jelent meg senkinek.");
  return `<div class="panel"><h2>${esc(T(lang, "Visszatérés"))} <span class="rp-q">${esc(T(lang, "— hányadik látogatásnál születik a rendelés"))}</span></h2><div class="rp-fun">${rows}</div><p class="mut small rp-note">${esc(note)}</p></div>`;
}

function dimPanel(d: ReportData, lang: string): string {
  const mx = Math.max(1, ...d.dims.map((r) => r.counts.sent));
  const row = (label: string, c: StageCounts, tot = false): string =>
    `<tr${tot ? ' class="rp-tot"' : ""}><td>${esc(label)}</td><td class="num"><span class="rp-mini" style="width:${((c.sent / mx) * 48).toFixed(0)}px"></span>${c.sent}</td><td class="num">${pct(c.opened, c.sent)}</td><td class="num">${pct(c.deep, c.opened)}</td><td class="num">${pct1(c.ordered, c.sent)}</td><td class="num">${pct1(c.paid, c.sent)}</td></tr>`;
  return (
    `<div class="panel"><h2>${esc(T(lang, "Bontás"))} <span class="rp-q">${esc(T(lang, "— {dim} szerint", { dim: DIM_LABEL(lang)[d.dim].toLowerCase() }))}</span></h2>` +
    `<div class="tblwrap"><table class="rp-tbl"><thead><tr><th>${esc(DIM_LABEL(lang)[d.dim])}</th><th class="num">${esc(T(lang, "Kiküldve"))}</th><th class="num">${esc(T(lang, "Megnyitva"))}</th><th class="num">${esc(T(lang, "Elmélyült"))}</th><th class="num">${esc(T(lang, "Rendelés"))}</th><th class="num">${esc(T(lang, "Fizetve"))}</th></tr></thead>` +
    `<tbody>${row(T(lang, "ÖSSZES"), d.counts, true)}${d.dims.map((r) => row(dimValueLabel(d.dim, r.key, lang), r.counts)).join("")}</tbody></table></div>` +
    `<p class="mut small rp-note">${esc(T(lang, "A tölcsér sosem lép vissza: a szám azt jelenti, hogy a lead LEGALÁBB eddig eljutott."))}</p></div>`
  );
}

function cohortPanel(d: ReportData, lang: string): string {
  const rows = d.cohorts
    .map(
      (c) =>
        `<tr><td>${esc(dayLabel(c.weekStart))} – ${esc(dayLabel(c.weekEnd))}${c.open ? ` <span class="rp-pill rp-pill--warn rp-pill--xs" title="${esc(T(lang, "A 30 napos ablak még nem telt le"))}">${esc(T(lang, "nyitott"))}</span>` : ""}</td>` +
        `<td class="num">${c.sent}</td><td class="num">${heatCell(c.opened7 / c.sent, 0.7, pct(c.opened7, c.sent))}</td><td class="num">${heatCell(c.ordered14 / c.sent, 0.12, pct(c.ordered14, c.sent))}</td><td class="num">${heatCell(c.paid30 / c.sent, 0.1, pct(c.paid30, c.sent))}</td><td>${esc(fmtH(c.firstOpenMedianHours, lang))}</td></tr>`,
    )
    .join("");
  return (
    `<div class="panel"><h2>${esc(T(lang, "Kohorsz"))} <span class="rp-q">${esc(T(lang, "— küldési hét szerint: javul-e a kör, nem csak az összeg"))}</span></h2>` +
    `<div class="tblwrap"><table class="rp-tbl"><thead><tr><th>${esc(T(lang, "Küldés hete"))}</th><th class="num">${esc(T(lang, "Kiküldve"))}</th><th class="num">${esc(T(lang, "Megnyitás 7 n."))}</th><th class="num">${esc(T(lang, "Rendelés 14 n."))}</th><th class="num">${esc(T(lang, "Fizetve 30 n."))}</th><th>${esc(T(lang, "1. megnyitás"))}</th></tr></thead><tbody>${rows || `<tr><td colspan="6" class="mut">${esc(T(lang, "Még nincs kiküldött megkeresés."))}</td></tr>`}</tbody></table></div>` +
    `<p class="mut small rp-note">${esc(T(lang, "A friss hetek ablaka még nyitott — a sor jelzi, ha a 30 nap nem telt le."))}</p></div>`
  );
}

/** Sends/opens per day + the owner's notes as markers. Two SVGs (wide / narrow), the container picks one. */
function timelineSvg(d: ReportData, lang: string, W: number): string {
  const H = 150;
  const padL = 26;
  const padB = 20;
  const iw = W - padL - 6;
  const ih = H - padB - 8;
  const days = d.timeline;
  const n = days.length;
  const mx = Math.max(2, ...days.map((p) => Math.max(p.sent, p.opened)));
  const bw = iw / n;
  const y = (v: number): number => 8 + ih - (v / mx) * ih;
  const bars = days
    .map(
      (p, i) =>
        `<g><title>${esc(T(lang, "{day} · kiküldve {s} · megnyitás {o}", { day: dayLabel(p.day), s: p.sent, o: p.opened }))}</title>` +
        `<rect x="${(padL + i * bw).toFixed(1)}" y="0" width="${bw.toFixed(1)}" height="${H}" fill="transparent"/>` +
        `<rect x="${(padL + i * bw + 1).toFixed(1)}" y="${y(p.sent).toFixed(1)}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${(ih + 8 - y(p.sent)).toFixed(1)}" rx="2" fill="color-mix(in srgb, var(--citui-muted) 22%, var(--citui-panel))"/></g>`,
    )
    .join("");
  const line = days.map((p, i) => `${(padL + i * bw + bw / 2).toFixed(1)},${y(p.opened).toFixed(1)}`).join(" ");
  const grid = [0, 0.5, 1]
    .map((f) => `<line x1="${padL}" x2="${W - 6}" y1="${y(mx * f).toFixed(1)}" y2="${y(mx * f).toFixed(1)}" stroke="color-mix(in srgb, var(--citui-muted) 18%, transparent)" stroke-width="1"/><text x="${padL - 4}" y="${(y(mx * f) + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--citui-muted)">${Math.round(mx * f)}</text>`)
    .join("");
  const step = Math.ceil(n / (W < 520 ? 4 : 7));
  const labs = days.map((p, i) => (i % step === 0 ? `<text x="${(padL + i * bw + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="9" fill="var(--citui-muted)">${esc(dayLabel(p.day))}</text>` : "")).join("");
  const notes = d.notes
    .map((nt) => {
      const i = days.findIndex((p) => p.day === nt.day);
      if (i < 0) return "";
      const x = padL + (i + 0.5) * bw;
      const txt = nt.text.length > 34 ? `${nt.text.slice(0, 33)}…` : nt.text;
      return `<g><title>${esc(`${dayLabel(nt.day)} — ${nt.text}`)}</title><line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="6" y2="${ih + 8}" stroke="var(--citui-warn)" stroke-width="2" stroke-dasharray="3 3"/><text x="${(x + 4).toFixed(1)}" y="14" font-size="9" fill="var(--citui-warn-ink)">${esc(txt)}</text></g>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(T(lang, "Kiküldés és megnyitás naponta"))}">${grid}${bars}<polyline points="${line}" fill="none" stroke="var(--citui-link-ink)" stroke-width="2" stroke-linejoin="round"/>${notes}${labs}</svg>`;
}

function timelinePanel(d: ReportData, lang: string, today: string): string {
  return (
    `<div class="panel"><h2>${esc(T(lang, "Pilot-napló"))} <span class="rp-q">${esc(T(lang, "— mi történt, és mi változott utána"))}</span></h2>` +
    `<div class="rp-chart rp-chart--wide">${timelineSvg(d, lang, 720)}</div><div class="rp-chart rp-chart--narrow">${timelineSvg(d, lang, 360)}</div>` +
    `<div class="rp-legend"><span><i style="background:color-mix(in srgb, var(--citui-muted) 22%, var(--citui-panel))"></i>${esc(T(lang, "kiküldés / nap"))}</span><span><i class="rp-legend__ln" style="background:var(--citui-link-ink)"></i>${esc(T(lang, "megnyitás / nap"))}</span><span><i class="rp-legend__ln" style="background:var(--citui-warn)"></i>${esc(T(lang, "jegyzet (a te megjegyzésed)"))}</span></div>` +
    `<form class="rp-notes" method="post" action="/report/note"><input type="hidden" name="days" value="${d.days}"><input type="hidden" name="dim" value="${esc(d.dim)}">` +
    `<input type="date" name="day" value="${esc(today)}" aria-label="${esc(T(lang, "Nap"))}" required>` +
    `<input type="text" name="text" maxlength="80" required placeholder="${esc(T(lang, "Jegyzet, pl. „Tárgymező csere: személyes megszólítás”"))}" aria-label="${esc(T(lang, "Jegyzet"))}">` +
    `<button type="submit" class="citui-btn citui-btn--ghost">${esc(T(lang, "Jegyzet hozzáadása"))}</button></form></div>`
  );
}

export function reportFunnelPage(d: ReportData, today: string): string {
  const lang = consoleLang();
  const body =
    hypothesisCards(d, lang) +
    `<div class="rp-grid2">${returnsPanel(d, lang)}${dimPanel(d, lang)}</div>` +
    cohortPanel(d, lang) +
    timelinePanel(d, lang, today);
  return shell(d, "/report", body, lang);
}

// ── Viselkedés page ───────────────────────────────────────────────────────────
const kbox = (t: string, v: string, sub: string): string =>
  `<div class="con-kbox"><div class="con-kbox__t">${esc(t)}</div><div class="con-kbox__r"><span class="con-kbox__v">${esc(v)}</span></div><div class="con-kbox__s">${esc(sub)}</div></div>`;

function behaviourKpis(d: ReportData, lang: string): string {
  const b = d.behaviour;
  const dev = DEVICE_LABEL(lang);
  const mob = b.devices.find((x) => x.device === "mobile")?.openers ?? 0;
  const tab = b.devices.find((x) => x.device === "tablet")?.openers ?? 0;
  const dsk = b.devices.find((x) => x.device === "desktop")?.openers ?? 0;
  return (
    `<div class="con-kstrip rp-kstrip">` +
    kbox(T(lang, "Medián időtöltés"), fmtS(b.dwellMedian, lang), T(lang, "p90: {v}", { v: fmtS(b.dwellP90, lang) })) +
    kbox(T(lang, "Medián görgetés"), Number.isFinite(b.scrollMedian) ? `${Math.round(b.scrollMedian)}%` : "–", T(lang, "{p} ért a lap aljáig", { p: pctV(b.scrollBottomShare) })) +
    kbox(T(lang, "Mobilról"), pct(mob, b.openers), `${dev.tablet.toLowerCase()} ${pct(tab, b.openers)} · ${dev.desktop.toLowerCase()} ${pct(dsk, b.openers)}`) +
    kbox(T(lang, "Ár-panelig jutott"), pct(b.panelReached, b.openers), T(lang, "{n} megnyitóból", { n: b.openers })) +
    kbox(T(lang, "Fizetésnél elakadt"), String(b.paymentStalled), T(lang, "rendelt, de nem fizetett · {p}", { p: pct(b.paymentStalled, d.counts.ordered) })) +
    kbox(T(lang, "Kimondott ok"), String(b.statedCount), T(lang, "kérdőív-válasz · {p} a nem vásárlókból", { p: pct(b.statedCount, b.nonBuyers) })) +
    `</div>`
  );
}

function devicePanel(d: ReportData, lang: string): string {
  const b = d.behaviour;
  const lab = DEVICE_LABEL(lang);
  const rows = b.devices
    .map((r, i) => {
      const w = b.openers ? Math.max(2, (r.openers / b.openers) * 100) : 0;
      return (
        `<div class="rp-drow" title="${esc(T(lang, "{d}: {n} megnyitó, fizetett {p}", { d: lab[r.device], n: r.openers, p: r.paid }))}"><div>${esc(lab[r.device])}</div>` +
        `<div class="rp-bar rp-bar--tall">${bar(w, `rp-cat-${i + 1}`)}<b class="rp-bar__n${w > 22 ? "" : " rp-bar__n--out"}"${w > 22 ? "" : ` style="left:calc(${w.toFixed(1)}% + 8px)"`}>${r.openers}</b><span class="rp-bar__r">${esc(T(lang, "fizet: {p}", { p: pct1(r.paid, r.openers) }))}</span></div></div>`
      );
    })
    .join("");
  const mob = b.devices.find((x) => x.device === "mobile")!;
  const dsk = b.devices.find((x) => x.device === "desktop")!;
  const note = b.openers
    ? T(lang, "A mobil hozza a megnyitások {m}-át, de a fizetésig {mp} jut el, asztalin {dp} — ha a különbség tartós, a mobil checkout a gyanús.", { m: pct(mob.openers, b.openers), mp: pct1(mob.paid, mob.openers), dp: pct1(dsk.paid, dsk.openers) })
    : T(lang, "Még nincs megnyitás az időszakban.");
  return `<div class="panel"><h2>${esc(T(lang, "Eszköz"))} <span class="rp-q">${esc(T(lang, "— mivel nézik, és melyiken vesznek"))}</span></h2><div class="rp-dev">${rows}</div><p class="mut small rp-note">${esc(note)}</p></div>`;
}

function exitMapPanel(d: ReportData, lang: string): string {
  const b = d.behaviour;
  const sl = SECTION_LABEL(lang);
  const mxExit = Math.max(1, ...b.exits.map((e) => e.exited));
  const rows = b.exits
    .map((e, i) => {
      const kind = i === 8 ? T(lang, "a Barion oldalán") : i >= 6 ? T(lang, "konfigurátor") : T(lang, "mock-szekció");
      return (
        `<div class="rp-ex${e.exited === mxExit && e.exited > 0 ? " rp-ex--hot" : ""}" title="${esc(T(lang, "{s}: ide eljutott {r} ({rp}), itt lépett ki {x}", { s: sl[e.section], r: e.reached, rp: pct(e.reached, b.openers), x: e.exited }))}">` +
        `<div class="rp-ex__s">${esc(sl[e.section])}<small>${esc(kind)}</small></div>` +
        `<div class="rp-ex__t"><div class="rp-ex__reach" style="width:${(b.openers ? (e.reached / b.openers) * 100 : 0).toFixed(1)}%"></div><div class="rp-ex__exit" style="width:${(b.openers ? (e.exited / b.openers) * 100 : 0).toFixed(1)}%"></div></div>` +
        `<div class="rp-ex__p">${pct(e.exited, b.openers)}<small>${esc(T(lang, "{n} ért ide", { n: e.reached }))}</small></div></div>`
      );
    })
    .join("");
  return (
    `<div class="panel"><h2>${esc(T(lang, "Kilépési térkép"))} <span class="rp-q">${esc(T(lang, "— a mock szekciói: ki jut el ide, ki lép itt ki"))}</span></h2><div class="rp-exitmap">${rows}</div>` +
    `<div class="rp-legend"><span><i style="background:color-mix(in srgb, var(--citui-link-ink) 22%, var(--citui-panel))"></i>${esc(T(lang, "eljutott ide"))}</span><span><i style="background:var(--citui-link-ink)"></i>${esc(T(lang, "itt lépett ki"))}</span></div></div>`
  );
}

function reasonsPanel(d: ReportData, lang: string, mode: ReasonMode): string {
  const b = d.behaviour;
  const rl = REASON_LABEL(lang);
  const sl = STATED_LABEL(lang);
  const nSaid = b.stated.reduce((s, r) => s + r.count, 0);
  const chips = (["inf", "said", "both"] as const)
    .map((m) => `<a href="/report/behaviour${qs(d, { rs: m })}"${m === mode ? ' class="on"' : ""}>${esc(m === "inf" ? T(lang, "Következtetett") : m === "said" ? T(lang, "Kimondott") : T(lang, "Egymás mellett"))}</a>`)
    .join("");
  const rowR = (label: string, v: number, base: number, said: boolean, extra = ""): string =>
    `<div class="rp-rr"><div class="rp-rr__l"><b>${esc(label)}</b><div class="rp-bar">${bar(base ? (v / base) * 100 : 0, said ? "rp-said" : "")}</div></div><div class="rp-rr__v">${v} <small>${pct(v, base)}</small>${extra}</div></div>`;
  let rows: string;
  let note: string;
  if (mode === "inf") {
    rows = b.reasons.map((r) => rowR(rl[r.reason], r.count, b.nonBuyers, false, `<div class="rp-conf">${esc(r.count && r.sure === r.count ? T(lang, "biztos jel") : r.count && r.sure === 0 ? T(lang, "közepes jel") : r.count ? T(lang, "{s} biztos · {m} közepes", { s: r.sure, m: r.count - r.sure }) : "")}</div>`)).join("");
    note = T(lang, "{n} nem vásárló megnyitó, mindegyik kap egy címkét a lapon hagyott jelekből (görgetés, idő, panel, lépés, hiba). A „biztos” jel egy konkrét eseményhez kötött, a „közepes” időzítésből következtet.", { n: b.nonBuyers });
  } else if (mode === "said") {
    rows = b.stated.map((r) => rowR(sl[r.reason], r.count, nSaid, true)).join("");
    note = T(lang, "{n} kimondott ok (eszkaláció elvetése, leiratkozó lap, emlékeztető-link). Kevés, de ez az egyetlen, amit nem mi találtunk ki.", { n: nSaid });
  } else {
    rows = STATED_REASONS.map((s) => {
      const infSum = b.reasons.filter((r) => expectedStated(r.reason) === s).reduce((x, r) => x + r.count, 0);
      const saidN = b.stated.find((r) => r.reason === s)?.count ?? 0;
      return (
        `<div class="rp-rr"><div class="rp-rr__l"><b>${esc(sl[s])}</b><div class="rp-bar rp-bar--thin">${bar(b.nonBuyers ? (infSum / b.nonBuyers) * 100 : 0)}</div></div><div class="rp-rr__v">${pct(infSum, b.nonBuyers)} <small>${esc(T(lang, "gép"))}</small></div></div>` +
        `<div class="rp-rr rp-rr--pair"><div class="rp-rr__l"><b class="rp-hidden">${esc(sl[s])}</b><div class="rp-bar rp-bar--thin">${bar(nSaid ? (saidN / nSaid) * 100 : 0, "rp-said")}</div></div><div class="rp-rr__v">${pct(saidN, nSaid)} <small>${esc(T(lang, "vendég"))}</small></div></div>`
      );
    }).join("");
    note = T(lang, "A gépi címkék a kimondott kategóriákra vetítve (ár-sokk + eszkaláció → „Drága” stb.) — ha a két oszlop széttart, a szabályok küszöbeit hangoljuk.");
  }
  return `<div class="panel"><h2>${esc(T(lang, "Miért lépett ki"))} <span class="rp-q">${esc(T(lang, "— következtetett ok (minden látogatás) és kimondott ok (kérdőív)"))}</span></h2><div class="rp-chips rp-chips--mb">${chips}</div><div class="rp-rs">${rows}</div><p class="mut small rp-note">${esc(note)}</p></div>`;
}
const expectedStated = (r: ExitReason): StatedReason => EXPECTED_STATED[r];

function calibrationPanel(d: ReportData, lang: string): string {
  const b = d.behaviour;
  const rl = REASON_LABEL(lang);
  const sl = STATED_LABEL(lang);
  const cols = EXIT_REASONS.filter((r) => b.calibration.some((c) => c.inferred === r));
  const statedRows = STATED_REASONS.filter((s) => b.calibration.some((c) => c.stated === s));
  const cell = (s: StatedReason, r: ExitReason): string => {
    const v = b.calibration.find((c) => c.stated === s && c.inferred === r)?.count ?? 0;
    const hit = v > 0 && expectedStated(r) === s;
    return `<td class="num${hit ? " rp-hit" : v ? "" : " rp-miss"}">${v || "·"}</td>`;
  };
  const table = statedRows.length
    ? `<div class="tblwrap"><table class="rp-tbl rp-calib"><thead><tr><th>${esc(T(lang, "Kimondta ↓ / gép tippje →"))}</th>${cols.map((r) => `<th class="num">${esc(rl[r])}</th>`).join("")}</tr></thead><tbody>${statedRows
        .map((s) => `<tr><td><b>${esc(sl[s])}</b> <span class="mut">(${b.calibration.filter((c) => c.stated === s).reduce((x, c) => x + c.count, 0)})</span></td>${cols.map((r) => cell(s, r)).join("")}</tr>`)
        .join("")}</tbody></table></div>`
    : "";
  const note = b.calibrationTotal
    ? T(lang, "{n} látogatásnál van kimondott ok is: a gép {h}-ban ({p}) ugyanazt tippelte (zöld cella). Ami nem egyezik, azon a szabályon kell tekerni — pl. ha a „Drága” sorban a gép „nézelődött”-et mondott, az ár-sokk küszöbe (20 mp) túl szoros.", { n: b.calibrationTotal, h: b.calibrationHits, p: pct(b.calibrationHits, b.calibrationTotal) })
    : T(lang, "Még nincs olyan látogatás, ahol kimondott ok is lenne — a kalibráció a kérdőív első válaszaival indul.");
  return `<div class="panel"><h2>${esc(T(lang, "Kalibráció"))} <span class="rp-q">${esc(T(lang, "— ahol kimondták, mit tippelt a gép"))}</span></h2>${table}<p class="mut small rp-note">${esc(note)}</p></div>`;
}

function buyersPanel(d: ReportData, lang: string): string {
  const b = d.behaviour;
  const prof = (title: string, p: typeof b.fastBuyers, sub: string): string =>
    `<div class="rp-bprof"><h3>${esc(title)} <span class="mut">· ${esc(T(lang, "{n} vevő", { n: p.n }))}</span></h3><p class="mut small">${esc(sub)}</p><dl>` +
    `<dt>${esc(T(lang, "Látogatás a fizetésig"))}</dt><dd>${esc(dec1(p.visitsAvg))}</dd>` +
    `<dt>${esc(T(lang, "Időtöltés (medián)"))}</dt><dd>${esc(fmtS(p.dwellMedian, lang))}</dd>` +
    `<dt>${esc(T(lang, "Modul-érintés"))}</dt><dd>${esc(dec1(p.modulesAvg))}</dd>` +
    `<dt>${esc(T(lang, "Preset-váltás"))}</dt><dd>${esc(dec1(p.presetsAvg))}</dd>` +
    `<dt>${esc(T(lang, "Megnyitás → fizetés"))}</dt><dd>${esc(fmtH(p.openToPaidMedianHours, lang))}</dd>` +
    `<dt>${esc(T(lang, "Mobilról"))}</dt><dd>${esc(pctV(p.mobileShare))}</dd></dl></div>`;
  return (
    `<div class="panel"><h2>${esc(T(lang, "A vevők elmélyülése"))} <span class="rp-q">${esc(T(lang, "— gyors vevő vs. mély vevő"))}</span></h2><div class="rp-buyers">` +
    prof(T(lang, "Gyors vevő"), b.fastBuyers, T(lang, "6 órán belül fizet az első megnyitástól — a levél és a mock együtt adta el.")) +
    prof(T(lang, "Mély vevő"), b.deepBuyers, T(lang, "Visszajön, végigpróbálja a modulokat — nála a konfigurátor ad el.")) +
    `</div></div>`
  );
}

function heatPanel(d: ReportData, lang: string): string {
  const b = d.behaviour;
  const DN = [T(lang, "H"), T(lang, "K"), T(lang, "Sze"), T(lang, "Cs"), T(lang, "P"), T(lang, "Szo"), T(lang, "V")];
  const HRS = Array.from({ length: 17 }, (_, i) => i + 7);
  let mx = 1;
  let best = { v: 0, d: "", h: 0 };
  b.heat.forEach((row, di) =>
    row.forEach((v, hi) => {
      mx = Math.max(mx, v);
      if (v > best.v) best = { v, d: DN[di]!, h: HRS[hi]! };
    }),
  );
  const grid =
    `<div></div>${HRS.map((h) => `<div class="rp-hm__h">${h}</div>`).join("")}` +
    b.heat
      .map(
        (row, di) =>
          `<div class="rp-hm__d">${esc(DN[di]!)}</div>` +
          row.map((v, hi) => `<div class="rp-hm__c" title="${esc(`${DN[di]} ${HRS[hi]}:00 — ${T(lang, "{n} megnyitás", { n: v })}`)}" style="background:color-mix(in srgb, var(--citui-link-ink) ${Math.round((v / mx) * 85)}%, var(--citui-panel))"></div>`).join(""),
      )
      .join("");
  const note = best.v
    ? T(lang, "Legtöbb megnyitás: {d} {h}:00 körül ({n}). A küldési ablakot ehhez igazítjuk, nem a magunk szokásához.", { d: best.d, h: best.h, n: best.v })
    : T(lang, "Még nincs megnyitás az időszakban.");
  return `<div class="panel"><h2>${esc(T(lang, "Mikor nyitják"))} <span class="rp-q">${esc(T(lang, "— nap × óra, Budapest-idő"))}</span></h2><div class="rp-hm">${grid}</div><p class="mut small rp-note">${esc(note)}</p></div>`;
}

/** The micro survey as the guest sees it on the mock page — a preview, not a form here. */
function surveyPreview(lang: string): string {
  const opts = [T(lang, "Drágának találom"), T(lang, "Most nem időszerű"), T(lang, "Nem bízom benne, vagy nem értem"), T(lang, "Van már honlapom, nem kell"), T(lang, "Más…")];
  return (
    `<div class="panel"><h2>${esc(T(lang, "A mikro-kérdőív"))} <span class="rp-q">${esc(T(lang, "— így jelenik meg a mock-oldalon, az eszkalációs ajánlat elvetése után"))}</span></h2>` +
    `<div class="rp-survey" aria-label="${esc(T(lang, "Előnézet"))}"><p>${esc(T(lang, "Mi tartotta vissza? Egy koppintás, segít jobbat kínálnunk."))}</p><div class="rp-survey__opts">${opts.map((o) => `<span>${esc(o)}</span>`).join("")}</div>` +
    `<div class="rp-survey__foot"><span class="rp-survey__btn rp-survey__btn--primary">${esc(T(lang, "Elküldöm"))}</span><span class="rp-survey__btn">${esc(T(lang, "Inkább nem"))}</span></div></div>` +
    `<p class="mut small rp-note">${esc(T(lang, "Ugyanez a kérdés a leiratkozó lapon (a visszaigazolás UTÁN, semleges) és az emlékeztető levél linkjéből megnyíló megerősítő lapon (gomb + POST dönt, levél-szkenner nem válaszol helyettünk). A válaszok a „Kimondott” nézetben és a kalibrációban jelennek meg."))}</p></div>`
  );
}

export function reportBehaviourPage(d: ReportData, mode: ReasonMode): string {
  const lang = consoleLang();
  const body =
    behaviourKpis(d, lang) +
    `<div class="rp-grid2">${devicePanel(d, lang)}${exitMapPanel(d, lang)}</div>` +
    `<div class="rp-grid2">${reasonsPanel(d, lang, mode)}${calibrationPanel(d, lang)}</div>` +
    `<div class="rp-grid2">${buyersPanel(d, lang)}${heatPanel(d, lang)}</div>` +
    surveyPreview(lang);
  return shell(d, "/report/behaviour", body, lang);
}
