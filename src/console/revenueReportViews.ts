// Riport · Előfizetők fül — the page. Frozen plan: assets/design-refs/console/elofizetok-riport/
// (variant A, „Pénz felül”). Top to bottom: five numbers → the expected income (chart + month
// table + "who, how much, when" for the chosen month) → actual income and the subscriber
// movement side by side → discount and package split → one row per subscriber.
// Links only (filters, month choice) — the page works without JS; charts are inline SVG whose
// colours are console tokens, the hover text is the SVG <title>.

import { esc, helpLink, layout } from "./views.js";
import { T } from "../i18n/mail.js";
import { consoleLang } from "./i18nCtx.js";
import { formatMoney } from "../text/money.js";
import { budapestIsoDay } from "../text/budapestTime.js";
import { MODULE_CATALOG } from "../modules.js";
import { reportTabs } from "./reportViews.js";
import {
  REVENUE_HORIZONS,
  cardValidOn,
  isLive,
  type FactMonth,
  type ForecastMonth,
  type RevenueHorizon,
  type RevenueReport,
  type RevenueSub,
} from "./revenueReport.js";

const ft = (n: number, lang: string): string => formatMoney(Math.round(n), "HUF", lang);
const day = (d: Date): string => budapestIsoDay(d).replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1. $2. $3.");
const expOf = (s: RevenueSub): string => (s.card ? `${s.card.expYear}/${String(s.card.expMonth).padStart(2, "0")}` : "");

function monthName(m: number, lang: string): string {
  return [
    T(lang, "jan."), T(lang, "febr."), T(lang, "márc."), T(lang, "ápr."), T(lang, "máj."), T(lang, "jún."),
    T(lang, "júl."), T(lang, "aug."), T(lang, "szept."), T(lang, "okt."), T(lang, "nov."), T(lang, "dec."),
  ][m - 1]!;
}
/** `2026-12` → "dec." in the current year, "2027. jan." otherwise. */
function monthLabel(ym: string, today: string, lang: string): string {
  const y = ym.slice(0, 4);
  const name = monthName(Number(ym.slice(5, 7)), lang);
  return y === today.slice(0, 4) ? name : `${y}. ${name}`;
}

export const REVENUE_LIST_FILTERS = ["all", "attn", "ok"] as const;
export type RevenueListFilter = (typeof REVENUE_LIST_FILTERS)[number];
export const REVENUE_SORTS = ["next", "fee", "name"] as const;
export type RevenueSort = (typeof REVENUE_SORTS)[number];
export interface RevenueUi {
  readonly st: RevenueListFilter;
  readonly sort: RevenueSort;
}

// The page's UI state rides along every link (no JS), set once per render.
let UI: RevenueUi = { st: "all", sort: "next" };

function href(
  r: RevenueReport,
  over: { h?: RevenueHorizon; t?: boolean; m?: string | null; st?: RevenueListFilter; sort?: RevenueSort } = {},
): string {
  const p = new URLSearchParams({ h: String(over.h ?? r.horizon) });
  if (over.t ?? r.tests) p.set("t", "1");
  const m = over.m === undefined ? r.month : over.m;
  if (m) p.set("m", m);
  const st = over.st ?? UI.st;
  const sort = over.sort ?? UI.sort;
  if (st !== "all") p.set("st", st);
  if (sort !== "next") p.set("sort", sort);
  return `/report/revenue?${p.toString()}`;
}

const PRESET = (lang: string): Record<string, string> => ({
  alap: T(lang, "Alap"),
  ajanlott: T(lang, "Ajánlott"),
  teljes: T(lang, "Teljes"),
  egyedi: T(lang, "Egyedi összeállítás"),
});

type Health = { cls: "ok" | "warn" | "bad" | ""; text: string };
function health(s: RevenueSub, lang: string): Health {
  if (s.status === "frozen") return { cls: "bad", text: T(lang, "Befagyott — nem fizetett") };
  if (s.status === "past_due") return { cls: "bad", text: T(lang, "Sikertelen terhelés ({n}×)", { n: s.failedCharges }) };
  if (s.status === "cancelled") return { cls: "", text: T(lang, "Megszűnt") };
  if (s.cancelAtEnd) return { cls: "warn", text: T(lang, "Lemondta — {d} megszűnik", { d: day(s.next) }) };
  // A pre-0076 token has no mask until its next charge reports the card (ADR-0226) — unknown, not expired.
  if (s.method === "token" && !s.card) return { cls: "warn", text: T(lang, "Nincs kártya-adat") };
  if (s.method === "token" && !cardValidOn(s, s.next)) return { cls: "warn", text: T(lang, "Kártya lejár a terhelés előtt") };
  return { cls: "ok", text: T(lang, "Rendben") };
}

function kpis(r: RevenueReport, lang: string): string {
  const k = r.kpi;
  const box = (t: string, v: string, sub: string, none = false): string =>
    `<div class="con-kbox"><div class="con-kbox__t">${esc(t)}</div><div class="con-kbox__r"><span class="con-kbox__v${none ? " rv-none" : ""}">${esc(v)}</span></div><div class="con-kbox__s">${esc(sub)}</div></div>`;
  const parts = [T(lang, "havi {a} · éves {b}", { a: k.monthlyN, b: k.annualN })];
  if (k.frozen) parts.push(T(lang, "befagyott {n}", { n: k.frozen }));
  if (k.leaving) parts.push(T(lang, "lemondta {n}", { n: k.leaving }));
  const has = k.renewing > 0;
  return (
    `<div class="con-kstrip rp-kstrip rp-kstrip--5">` +
    box(T(lang, "Aktív előfizető"), String(k.active), parts.join(" · ")) +
    box(T(lang, "MRR — havi ismétlődő"), has ? ft(k.mrr, lang) : T(lang, "nincs előfizető"), T(lang, "listaáron, az éves díj 1/12-e"), !has) +
    box(T(lang, "ARR — éves"), has ? ft(k.mrr * 12, lang) : "–", T(lang, "MRR × 12"), !has) +
    box(T(lang, "Átlagos díj / hó"), has ? ft(k.mrr / k.renewing, lang) : "–", T(lang, "{n} megújuló előfizetés", { n: k.renewing }), !has) +
    (k.churn
      ? box(
          T(lang, "Lemorzsolódás · 3 hó"),
          `${((k.churn.ended / k.churn.atStart) * 100).toFixed(1).replace(".", ",")} %`,
          T(lang, "{a} megszűnt / {b} induló", { a: k.churn.ended, b: k.churn.atStart }),
        )
      : box(T(lang, "Lemorzsolódás · 3 hó"), T(lang, "nincs adat"), T(lang, "3 hónapja még nem volt előfizető"), true)) +
    `</div>`
  );
}

function niceMax(v: number): number {
  const raw = Math.max(1, v) / 4;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10]) if (m * p >= raw) return 4 * m * p;
  return 40 * p;
}
function short(v: number, lang: string): string {
  if (v >= 1e6) return T(lang, "{n} M", { n: (v / 1e6).toFixed(v % 1e6 ? 1 : 0).replace(".", ",") });
  if (v >= 1e3) return T(lang, "{n} e", { n: Math.round(v / 1e3) });
  return String(Math.round(v));
}
function barPath(x: number, y: number, w: number, h: number, round: boolean): string {
  const r = Math.min(4, h, w / 2);
  if (!round || h <= 0) return `M${x} ${y}h${w}v${h}h${-w}z`;
  return `M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h}z`;
}

/** Stacked bars (sure solid + estimated hatched) per month; each bar links to its month. */
function forecastSvg(r: RevenueReport, W: number, H: number, lang: string, id: string): string {
  const fc = r.forecast;
  const pad = { l: 52, r: 8, t: 14, b: 34 };
  const nice = niceMax(Math.max(...fc.map((b) => b.sure + b.est)));
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const slot = iw / fc.length;
  const bw = Math.min(46, slot * 0.62);
  const y0 = pad.t + ih;
  let g =
    `<defs><pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
    `<rect width="6" height="6" class="rv-est"/><path d="M0 0v6" class="rv-hatch"/></pattern></defs>`;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + ih - (ih * i) / 4;
    g += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y}" y2="${y}" class="rv-grid"/><text x="${pad.l - 6}" y="${y + 4}" text-anchor="end" class="rv-ax">${esc(short((nice * i) / 4, lang))}</text>`;
  }
  fc.forEach((b, i) => {
    const cx = pad.l + slot * (i + 0.5);
    const x = cx - bw / 2;
    const hs = (ih * b.sure) / nice;
    const he = (ih * b.est) / nice;
    const sel = r.month === b.month;
    const mo = Number(b.month.slice(5, 7));
    const tip = T(lang, "{m}: biztos {s}, becsült {e}", {
      m: monthLabel(b.month, r.today, lang),
      s: ft(b.sure, lang),
      e: ft(b.est, lang),
    }) + (b.out ? " · " + T(lang, "domain-kiadás −{o}", { o: ft(b.out, lang) }) : "");
    g += `<a href="${esc(href(r, { m: b.month }))}#rv-month"><title>${esc(tip)}</title>`;
    g += `<rect x="${cx - slot / 2}" y="${pad.t}" width="${slot}" height="${ih + pad.b}" class="rv-hit"/>`;
    if (hs > 0) g += `<path d="${barPath(x, y0 - hs, bw, hs, he <= 0)}" class="rv-sure"/>`;
    if (he > 0) g += `<path d="${barPath(x, y0 - hs - he - (hs > 0 ? 2 : 0), bw, he, true)}" fill="url(#${id})" class="rv-est-edge"/>`;
    if (hs + he === 0) g += `<line x1="${x}" x2="${x + bw}" y1="${y0 - 1}" y2="${y0 - 1}" class="rv-ghost"/>`;
    if (sel) g += `<rect x="${x - 4}" y="${pad.t - 4}" width="${bw + 8}" height="${ih + 8}" rx="6" class="rv-selbox"/>`;
    g += `<text x="${cx}" y="${y0 + 15}" text-anchor="middle" class="rv-ax${sel ? " rv-ax--on" : ""}">${esc(monthName(mo, lang))}</text>`;
    if (i === 0 || mo === 1) g += `<text x="${cx}" y="${y0 + 28}" text-anchor="middle" class="rv-ax rv-ax--y">${b.month.slice(0, 4)}</text>`;
    g += `</a>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="rv-svg" role="img" aria-label="${esc(T(lang, "Várható bevétel havonta"))}">${g}</svg>`;
}

function forecastPanel(r: RevenueReport, lang: string): string {
  const fc = r.forecast;
  const tot = fc.reduce((a, b) => ({ sure: a.sure + b.sure, est: a.est + b.est, out: a.out + b.out }), { sure: 0, est: 0, out: 0 });
  const dash = "—";
  const rows = fc
    .map(
      (b) =>
        `<tr${r.month === b.month ? ' class="rv-sel"' : ""}><td><a href="${esc(href(r, { m: b.month }))}#rv-month">${esc(monthLabel(b.month, r.today, lang))}</a></td>` +
        `<td class="num">${b.sure ? esc(ft(b.sure, lang)) : dash}</td><td class="num">${b.est ? esc(ft(b.est, lang)) : dash}</td>` +
        `<td class="num rv-hide-n">${b.out ? "−" + esc(ft(b.out, lang)) : dash}</td><td class="num"><b>${esc(ft(b.sure + b.est - b.out, lang))}</b></td></tr>`,
    )
    .join("");
  const table =
    `<div class="tblwrap"><table class="rp-tbl"><thead><tr><th>${esc(T(lang, "Hónap"))}</th><th class="num">${esc(T(lang, "Biztos"))}</th><th class="num">${esc(T(lang, "Becsült"))}</th><th class="num rv-hide-n">${esc(T(lang, "Domain-kiadás"))}</th><th class="num">${esc(T(lang, "Összesen"))}</th></tr></thead><tbody>` +
    rows +
    `<tr class="rv-tot"><td>${esc(T(lang, "{n} hónap", { n: r.horizon }))}</td><td class="num">${esc(ft(tot.sure, lang))}</td><td class="num">${esc(ft(tot.est, lang))}</td><td class="num rv-hide-n">${tot.out ? "−" + esc(ft(tot.out, lang)) : dash}</td><td class="num">${esc(ft(tot.sure + tot.est - tot.out, lang))}</td></tr>` +
    `</tbody></table></div>`;
  const legend =
    `<div class="rv-legend"><span><i class="rv-sw rv-sw--sure"></i>${esc(T(lang, "Biztos — tárolt kártya, nem lemondott"))}</span>` +
    `<span><i class="rv-sw rv-sw--est"></i>${esc(T(lang, "Becsült — díjbekérő, lejáró vagy ismeretlen kártya, tartozás"))}</span></div>`;
  const trials = r.trials.length
    ? `<p class="rp-q rp-note">${esc(
        T(lang, "Nincs benne: {n} futó próba ({list}). Hogy hányan rendelnek meg egy próbát, arra még nincs adat, ezért nem becsüljük.", {
          n: r.trials.length,
          list: r.trials.map((t) => T(lang, "{name} — {d}-ig", { name: t.name, d: day(t.until) })).join(", "),
        }),
      )}</p>`
    : "";
  return (
    `<div class="panel"><h2>${esc(T(lang, "Várható bevétel"))} <span class="rp-q">— ${esc(T(lang, "a tényleges fordulónapokból, listaáron"))}</span></h2>` +
    `<div class="rp-chart--wide">${forecastSvg(r, 640, 220, lang, "rv-hw")}</div><div class="rp-chart--narrow">${forecastSvg(r, 360, 230, lang, "rv-hn")}</div>` +
    legend +
    table +
    monthDetail(r, lang) +
    trials +
    `</div>`
  );
}

function monthDetail(r: RevenueReport, lang: string): string {
  const b: ForecastMonth | undefined = r.forecast.find((f) => f.month === r.month);
  if (!b) return "";
  const why = (it: ForecastMonth["items"][number]): string => {
    if (it.kind === "out") return T(lang, "{d} megújítása a regisztrátornál (nettó kiadás)", { d: it.sub.domain?.name ?? "" });
    if (it.kind === "end") return T(lang, "lemondta — a periódus végén megszűnik, nem terhelünk");
    if (it.reason === "invoice") return T(lang, "díjbekérő — a vevő maga fizeti");
    if (it.reason === "debt") return T(lang, "tartozása van — sikertelen terhelés");
    if (it.reason === "nocard") return T(lang, "tárolt kártya, de a lejáratát nem ismerjük");
    if (it.reason === "card") return T(lang, "a kártya {e} hónapban lejár — terhelés előtt", { e: expOf(it.sub) });
    return T(lang, "tárolt kártya, nem lemondott");
  };
  const rows = b.items
    .map((it) => {
      const amount =
        it.kind === "end"
          ? `<span class="rp-pill rp-pill--warn rp-pill--xs">${esc(T(lang, "megszűnik"))}</span>`
          : it.kind === "out"
            ? "−" + esc(ft(-it.amount, lang))
            : esc(ft(it.amount, lang)) + (it.kind === "est" ? ` <span class="rp-pill rp-pill--warn rp-pill--xs">${esc(T(lang, "becsült"))}</span>` : "");
      return (
        `<tr><td class="rv-d">${esc(day(it.at))}</td><td><a href="/lead/${esc(it.sub.leadId)}">${esc(it.sub.name)}</a>${it.sub.test ? ` <span class="rp-pill rp-pill--xs rv-test">${esc(T(lang, "teszt"))}</span>` : ""}` +
        `<div class="rp-q rv-show-n">${esc(why(it))}</div></td><td class="rp-q rv-hide-n">${esc(why(it))}</td><td class="num">${amount}</td></tr>`
      );
    })
    .join("");
  return (
    `<div class="rv-detail" id="rv-month"><h3>${esc(T(lang, "{m} — ki mennyit, mikor", { m: monthLabel(b.month, r.today, lang) }))} <span class="rp-q">${esc(T(lang, "(koppints egy hónapra a grafikonon vagy a táblában)"))}</span></h3>` +
    (b.items.length
      ? `<div class="tblwrap"><table class="rp-tbl"><tbody>${rows}</tbody></table></div>`
      : `<p class="rp-q">${esc(T(lang, "Ebben a hónapban nincs terhelés."))}</p>`) +
    `</div>`
  );
}

function factSvg(facts: readonly FactMonth[], r: RevenueReport, W: number, lang: string): string {
  const H = 190;
  const pad = { l: 52, r: 8, t: 16, b: 30 };
  const nice = niceMax(Math.max(...facts.map((f) => f.paid)));
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const slot = iw / Math.max(facts.length, 1);
  const bw = Math.min(46, slot * 0.62);
  const y0 = pad.t + ih;
  let g = "";
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + ih - (ih * i) / 4;
    g += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y}" y2="${y}" class="rv-grid"/><text x="${pad.l - 6}" y="${y + 4}" text-anchor="end" class="rv-ax">${esc(short((nice * i) / 4, lang))}</text>`;
  }
  facts.forEach((f, i) => {
    const cx = pad.l + slot * (i + 0.5);
    const h = (ih * f.paid) / nice;
    g += `<g><title>${esc(T(lang, "{m}: {v} beérkezett, {n} fizetés", { m: monthLabel(f.month, r.today, lang), v: ft(f.paid, lang), n: f.payments }))}</title>`;
    g += h > 0
      ? `<path d="${barPath(cx - bw / 2, y0 - h, bw, h, true)}" class="rv-sure"/><text x="${cx}" y="${y0 - h - 5}" text-anchor="middle" class="rv-ax rv-ax--v">${esc(short(f.paid, lang))}</text>`
      : `<line x1="${cx - bw / 2}" x2="${cx + bw / 2}" y1="${y0 - 1}" y2="${y0 - 1}" class="rv-ghost"/>`;
    g += `<text x="${cx}" y="${y0 + 16}" text-anchor="middle" class="rv-ax">${esc(monthLabel(f.month, r.today, lang))}</text></g>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="rv-svg" role="img" aria-label="${esc(T(lang, "Beérkezett fizetések havonta"))}">${g}</svg>`;
}

function factsPanel(r: RevenueReport, lang: string): string {
  const head = `<h2>${esc(T(lang, "Tény-bevétel"))} <span class="rp-q">— ${esc(T(lang, "beérkezett fizetés havonta"))}</span></h2>`;
  if (!r.facts.length) return `<div class="panel">${head}<p class="rp-q">${esc(T(lang, "Még nem érkezett fizetés."))}</p></div>`;
  const rows = r.facts
    .map(
      (f) =>
        `<tr><td>${esc(monthLabel(f.month, r.today, lang))}</td><td class="num">${esc(ft(f.paid, lang))}</td><td class="num">${esc(T(lang, "{n} db", { n: f.invoices }))}</td>` +
        `<td class="num">${f.chargeFailures ? `<span class="rp-pill rp-pill--bad rp-pill--xs">${f.chargeFailures}×</span>` : "0"}</td>` +
        `<td class="num rv-hide-n">${f.invoiceFailures ? esc(T(lang, "{n}×", { n: f.invoiceFailures })) : "0"}</td></tr>`,
    )
    .join("");
  const k = r.kpi;
  return (
    `<div class="panel">${head}` +
    `<div class="rp-chart--wide">${factSvg(r.facts, r, 640, lang)}</div><div class="rp-chart--narrow">${factSvg(r.facts, r, 360, lang)}</div>` +
    `<div class="tblwrap"><table class="rp-tbl"><thead><tr><th>${esc(T(lang, "Hónap"))}</th><th class="num">${esc(T(lang, "Beérkezett"))}</th><th class="num">${esc(T(lang, "Számla"))}</th><th class="num">${esc(T(lang, "Sikertelen terhelés"))}</th><th class="num rv-hide-n">${esc(T(lang, "Számla-hiba"))}</th></tr></thead><tbody>${rows}</tbody></table></div>` +
    `<p class="rp-q rp-note">${esc(T(lang, "Kintlévőség ma: {o}", { o: ft(k.owed, lang) }))}${k.failed ? " · " + esc(T(lang, "{n} sikertelen terhelés vár újrapróbára", { n: k.failed })) : ""}. ${esc(T(lang, "A számla-hiba a kiállítás sikertelen próbája (később újra kiállítható)."))}</p>` +
    `</div>`
  );
}

function movesPanel(r: RevenueReport, lang: string): string {
  const head = `<h2>${esc(T(lang, "Előfizetők mozgása"))}</h2>`;
  if (!r.moves.length) return `<div class="panel">${head}<p class="rp-q">${esc(T(lang, "Nincs előfizető."))}</p></div>`;
  const rows = r.moves
    .map(
      (m) =>
        `<tr><td>${esc(monthLabel(m.month, r.today, lang))}</td><td class="num">${m.started}</td><td class="num">${m.cancelRequested}</td><td class="num rv-hide-n">${m.frozen}</td><td class="num">${m.ended}</td><td class="num"><b>${m.activeAtEnd}</b></td></tr>`,
    )
    .join("");
  return (
    `<div class="panel">${head}<div class="tblwrap"><table class="rp-tbl"><thead><tr><th>${esc(T(lang, "Hónap"))}</th><th class="num">${esc(T(lang, "Új"))}</th><th class="num">${esc(T(lang, "Lemondta"))}</th><th class="num rv-hide-n">${esc(T(lang, "Befagyott"))}</th><th class="num">${esc(T(lang, "Megszűnt"))}</th><th class="num">${esc(T(lang, "Aktív a hó végén"))}</th></tr></thead><tbody>${rows}</tbody></table></div>` +
    `<p class="rp-q rp-note">${esc(T(lang, "Lemondta = a periódus végén megszűnik, addig még fut. Megszűnt = lezárult."))}</p></div>`
  );
}

function discountPanel(r: RevenueReport, lang: string): string {
  const k = r.kpi;
  const label = (id: string): string =>
    id === "base" ? T(lang, "Alapdíj") : id === "domain" ? T(lang, "Saját domain díja") : (MODULE_CATALOG.find((m) => m.id === id)?.label ?? id);
  const total = r.modules.reduce((a, m) => a + m.monthly, 0);
  const kinds = [...new Set(r.subs.filter((s) => s.firstDiscount).map((s) => (s.firstDiscount!.percent != null ? `${Math.round(s.firstDiscount!.percent)}%` : "")))]
    .filter(Boolean)
    .join(", ");
  const disc = k.discountSubs
    ? T(lang, "Kedvezmény az első fizetésekben: −{v} ({n} vevő; {k}).", { v: ft(k.discountGiven, lang), n: k.discountSubs, k: kinds || "–" })
    : T(lang, "Kedvezmény az első fizetésekben: nincs.");
  const renew = T(lang, "Megújuláskor mindenki listaáron fizet: a legutóbbi díjak havi összege {a}, a következő ciklusé {b}.", {
    a: ft(k.lastPaidMonthly, lang),
    b: ft(k.mrr, lang),
  });
  const presets = new Map<string, { n: number; mrr: number }>();
  for (const s of r.subs.filter((x) => isLive(x) && !x.cancelAtEnd)) {
    const key = s.preset ?? "";
    const p = presets.get(key) ?? { n: 0, mrr: 0 };
    p.n++;
    p.mrr += s.monthly;
    presets.set(key, p);
  }
  const pl = PRESET(lang);
  const presetRows = [...presets.entries()]
    .sort((a, b) => b[1].mrr - a[1].mrr)
    .map(
      ([p, v]) =>
        `<tr><td>${esc(pl[p] ?? T(lang, "nincs rögzítve"))}</td><td class="num">${v.n}</td><td class="num">${esc(ft(v.mrr, lang))}</td><td class="num">${k.mrr ? Math.round((v.mrr / k.mrr) * 100) : 0} %</td></tr>`,
    )
    .join("");
  const modRows = r.modules
    .map(
      (m) =>
        `<tr><td>${esc(label(m.id))}</td><td class="num">${m.subs}</td><td class="num">${esc(ft(m.monthly, lang))}</td><td class="num">${total ? Math.round((m.monthly / total) * 100) : 0} %</td></tr>`,
    )
    .join("");
  const th = (a: string) =>
    `<thead><tr><th>${esc(a)}</th><th class="num">${esc(T(lang, "Előfizető"))}</th><th class="num">${esc(T(lang, "MRR"))}</th><th class="num">${esc(T(lang, "Arány"))}</th></tr></thead>`;
  return (
    `<div class="panel"><h2>${esc(T(lang, "Kedvezmény és csomagok"))}</h2>` +
    `<p class="rv-p">${esc(disc)} ${esc(renew)}</p>` +
    (presetRows
      ? `<div class="rp-grid2"><div><div class="tblwrap"><table class="rp-tbl">${th(T(lang, "Csomag"))}<tbody>${presetRows}</tbody></table></div></div>` +
        `<div><div class="tblwrap"><table class="rp-tbl">${th(T(lang, "Modul / díjtétel"))}<tbody>${modRows}</tbody></table></div></div></div>` +
        `<p class="rp-q rp-note">${esc(T(lang, "Listaáron, havi összegben (az éves díj ingyenes hónapjaival); a próba-ajándék modul nem számít."))}</p>`
      : `<p class="rp-q">${esc(T(lang, "Nincs megújuló előfizetés."))}</p>`) +
    `</div>`
  );
}

function tenantsPanel(r: RevenueReport, lang: string): string {
  const order = (s: RevenueSub): number => (isLive(s) && !s.cancelAtEnd ? s.next.getTime() : Number.MAX_SAFE_INTEGER);
  const attn = (s: RevenueSub): boolean => health(s, lang).cls !== "ok";
  const byName = (a: RevenueSub, b: RevenueSub) => a.name.localeCompare(b.name, "hu");
  const list = r.subs
    .filter((s) => (UI.st === "attn" ? attn(s) : UI.st === "ok" ? !attn(s) : true))
    .sort((a, b) =>
      UI.sort === "name" ? byName(a, b) : UI.sort === "fee" ? b.monthly - a.monthly || byName(a, b) : order(a) - order(b) || byName(a, b),
    );
  const nAttn = r.subs.filter(attn).length;
  const chip = (st: RevenueListFilter, label: string) =>
    `<a href="${esc(href(r, { st }))}#rv-subs"${UI.st === st ? ' class="on"' : ""}>${esc(label)}</a>`;
  const sortLink = (sort: RevenueSort, label: string) =>
    UI.sort === sort ? `<b>${esc(label)}</b>` : `<a href="${esc(href(r, { sort }))}#rv-subs">${esc(label)}</a>`;
  const tools =
    `<div class="rp-filt"><div class="rp-chips" role="group" aria-label="${esc(T(lang, "Állapot"))}">` +
    chip("all", T(lang, "Mind {n}", { n: r.subs.length })) +
    chip("attn", T(lang, "Figyelmet kér {n}", { n: nAttn })) +
    chip("ok", T(lang, "Rendben {n}", { n: r.subs.length - nAttn })) +
    `</div><span class="rp-filt__n">${esc(T(lang, "rendezés:"))} ${sortLink("next", T(lang, "következő terhelés"))} · ${sortLink("fee", T(lang, "díj"))} · ${sortLink("name", T(lang, "név"))}</span></div>`;
  const pl = PRESET(lang);
  const pill = (h: Health) => `<span class="rp-pill${h.cls ? ` rp-pill--${h.cls}` : ""}">${esc(h.text)}</span>`;
  const testPill = (s: RevenueSub) => (s.test ? ` <span class="rp-pill rp-pill--xs rv-test">${esc(T(lang, "teszt"))}</span>` : "");
  const first = (s: RevenueSub) =>
    s.firstDiscount
      ? T(lang, "első: {v}", { v: ft(s.firstDiscount.paid, lang) }) + (s.firstDiscount.percent != null ? ` (−${Math.round(s.firstDiscount.percent)}%)` : "")
      : "";
  const nextCell = (s: RevenueSub) => (isLive(s) && !s.cancelAtEnd ? `${esc(day(s.next))}<div class="rp-q">${esc(ft(s.cycleAmount, lang))}</div>` : "—");
  const card = (s: RevenueSub) =>
    s.card
      ? `${esc([s.card.brand, s.card.last4 ? "·" + s.card.last4 : ""].filter(Boolean).join(" "))}<div class="rp-q">${esc(T(lang, "lejár {e}", { e: expOf(s) }))}</div>`
      : `<span class="rp-q">—</span>`;
  const sub = (s: RevenueSub) => [s.city, s.domain?.name].filter(Boolean).join(" · ");
  const rows = list
    .map(
      (s) =>
        `<tr><td><a href="/lead/${esc(s.leadId)}">${esc(s.name)}</a>${testPill(s)}<div class="rp-q">${esc(sub(s))}</div></td>` +
        `<td>${esc(s.preset ? pl[s.preset]! : "—")}<div class="rp-q">${esc(T(lang, "{n} modul", { n: s.moduleIds.length }))}</div></td>` +
        `<td class="num">${esc(ft(s.monthly, lang))}${first(s) ? `<div class="rp-q">${esc(first(s))}</div>` : ""}</td>` +
        `<td>${esc(s.period === "annual" ? T(lang, "éves") : T(lang, "havi"))}<div class="rp-q">${esc(s.method === "token" ? T(lang, "kártya") : T(lang, "díjbekérő"))}</div></td>` +
        `<td class="num">${nextCell(s)}</td><td>${card(s)}</td><td>${pill(health(s, lang))}</td></tr>`,
    )
    .join("");
  const cards = list
    .map((s) => {
      const row = (a: string, b: string) => `<div class="rv-card__row"><span>${esc(a)}</span><span>${b}</span></div>`;
      return (
        `<div class="rv-card"><div class="rv-card__t"><b><a href="/lead/${esc(s.leadId)}">${esc(s.name)}</a></b>${pill(health(s, lang))}</div>` +
        `<div class="rp-q">${esc([s.city, s.preset ? pl[s.preset] : null, s.period === "annual" ? T(lang, "éves") : T(lang, "havi"), s.test ? T(lang, "teszt") : null].filter(Boolean).join(" · "))}</div>` +
        row(T(lang, "Díj / hó"), esc(ft(s.monthly, lang)) + (first(s) ? ` · ${esc(first(s))}` : "")) +
        row(T(lang, "Következő terhelés"), isLive(s) && !s.cancelAtEnd ? `${esc(day(s.next))} · ${esc(ft(s.cycleAmount, lang))}` : "—") +
        row(
          T(lang, "Fizetés"),
          s.card
            ? esc(`${s.card.brand ?? ""} ·${s.card.last4 ?? ""} · ${T(lang, "lejár {e}", { e: expOf(s) })}`)
            : esc(s.method === "token" ? T(lang, "kártya — nincs adat") : T(lang, "díjbekérő")),
        ) +
        `</div>`
      );
    })
    .join("");
  const empty = `<p class="rp-q">${esc(r.subs.length ? T(lang, "Nincs ilyen előfizető.") : T(lang, "Nincs előfizető."))}</p>`;
  return (
    `<div class="panel" id="rv-subs"><h2>${esc(T(lang, "Előfizetők"))} <span class="rp-q">— ${esc(T(lang, "a névre koppintva a lead-lap"))}</span></h2>` +
    tools +
    `<div class="rp-chart--wide">${list.length ? `<div class="tblwrap"><table class="rp-tbl"><thead><tr><th>${esc(T(lang, "Szállás"))}</th><th>${esc(T(lang, "Csomag"))}</th><th class="num">${esc(T(lang, "Díj / hó"))}</th><th>${esc(T(lang, "Időszak"))}</th><th class="num">${esc(T(lang, "Következő terhelés"))}</th><th>${esc(T(lang, "Kártya"))}</th><th>${esc(T(lang, "Állapot"))}</th></tr></thead><tbody>${rows}</tbody></table></div>` : empty}</div>` +
    `<div class="rp-chart--narrow">${list.length ? cards : empty}</div></div>`
  );
}

export function reportRevenuePage(r: RevenueReport, ui: RevenueUi = { st: "all", sort: "next" }): string {
  UI = ui;
  const lang = consoleLang();
  const tabs = reportTabs("/report/revenue", "", "", lang);
  const hz = REVENUE_HORIZONS.map(
    (h) => `<a href="${esc(href(r, { h, m: null }))}"${h === r.horizon ? ' class="on"' : ""}>${esc(T(lang, "{n} hó", { n: h }))}</a>`,
  ).join("");
  const ts =
    `<a href="${esc(href(r, { t: false }))}"${!r.tests ? ' class="on"' : ""}>${esc(T(lang, "Kizárva"))}</a>` +
    `<a href="${esc(href(r, { t: true }))}"${r.tests ? ' class="on"' : ""}>${esc(T(lang, "Beszámítva"))}</a>`;
  const filter =
    `<div class="rp-filt"><span class="rv-fl">${esc(T(lang, "Előrejelzés"))}</span><div class="rp-chips" role="group" aria-label="${esc(T(lang, "Előrejelzés"))}">${hz}</div>` +
    `<span class="rv-fl">${esc(T(lang, "Tesztek"))}</span><div class="rp-chips" role="group" aria-label="${esc(T(lang, "Tesztek"))}">${ts}</div>` +
    `<span class="rp-filt__n">${esc(r.tests ? T(lang, "{n} előfizetés", { n: r.subs.length }) : T(lang, "{n} előfizetés · tesztek nélkül", { n: r.subs.length }))}</span></div>`;
  const body =
    kpis(r, lang) +
    forecastPanel(r, lang) +
    `<div class="rp-grid2">${factsPanel(r, lang)}${movesPanel(r, lang)}</div>` +
    discountPanel(r, lang) +
    tenantsPanel(r, lang);
  return layout(
    T(lang, "Megkeresés-riport"),
    `<div class="con-ph"><h1>${esc(T(lang, "Megkeresés-riport"))} ${helpLink("console.report_revenue")}</h1></div>${tabs}${filter}<div class="rv">${body}</div>`,
    { active: "/report/revenue" },
  );
}
