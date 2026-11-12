// Lead-állomány — the dashboard card (full-width row in place of the CRM card) and the
// Riport „Lead-állomány” tab. Frozen plan: assets/design-refs/console/lead-allomany/
// (owner, 2026-11-12: „B”). The numbers come from leadStock.ts; every number links to the
// lead list filtered to exactly the leads it counted (`/leads?stock=<cat>.<col>&stockDays=`).

import { T } from "../i18n/mail.js";
import { consoleLang } from "./i18nCtx.js";
import type { LeadStock, StockCat, StockCol, StockCounts } from "./leadStock.js";
import { STOCK_CATS } from "./leadStock.js";

/** The period chips of the card and the tab: the owner's four (2026-11-12). */
export const STOCK_PRESETS = ["today", "7", "30", "0"] as const;
export type StockPreset = (typeof STOCK_PRESETS)[number];
export const isStockPreset = (v: string | null | undefined): v is StockPreset =>
  (STOCK_PRESETS as readonly string[]).includes(v ?? "");

export function stockPresetLabel(k: StockPreset, lang: string): string {
  return k === "today" ? T(lang, "Ma") : k === "7" ? T(lang, "7 nap") : k === "30" ? T(lang, "1 hónap") : T(lang, "Összes");
}
/** The lower-case phrase the card header and the Megkeresések card print. */
export function stockPeriodPhrase(k: StockPreset, lang: string): string {
  return k === "today" ? T(lang, "ma") : k === "7" ? T(lang, "elmúlt 7 nap") : k === "30" ? T(lang, "elmúlt 30 nap") : T(lang, "összes");
}

/** `<div class="rp-chips">` links — `hrefFor` builds each chip's URL. */
export function stockChips(active: StockPreset, hrefFor: (k: StockPreset) => string, lang: string): string {
  return (
    `<div class="rp-chips" role="group" aria-label="${esc(T(lang, "Időszak"))}">` +
    STOCK_PRESETS.map((k) => `<a href="${esc(hrefFor(k))}"${k === active ? ' class="on" aria-current="true"' : ""}>${esc(stockPresetLabel(k, lang))}</a>`).join("") +
    `</div>`
  );
}

// Local escaper: views.ts imports this module, so importing its `esc` back would be a cycle.
const esc = (v: unknown): string =>
  String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const CAT_LABEL = (lang: string): Record<StockCat, string> => ({
  own: T(lang, "saját kép"),
  town: T(lang, "település / stock"),
  none: T(lang, "semmilyen kép"),
});

const fmt = (n: number): string => n.toLocaleString("hu-HU");

/** Long label for the wide layout, short one for the phone (CSS swaps them). */
const ls = (long: string, short: string): string =>
  long === short ? esc(long) : `<span class="ls-lg">${esc(long)}</span><span class="ls-sh">${esc(short)}</span>`;

interface Ctx {
  readonly s: LeadStock;
  readonly days: StockPreset;
  readonly lang: string;
  /** Riport: the share of the row under each state cell. */
  readonly pct: boolean;
}

function cell(c: Ctx, cat: StockCat | "all", col: StockCol, n: number, base?: number): string {
  const v = n === 0 ? `<span>0</span>` : `<a href="/leads?stock=${cat}.${col}&amp;stockDays=${c.days}">${fmt(n)}</a>`;
  const p = c.pct && base ? `<span class="ls-pc">${Math.round((n * 100) / base)}%</span>` : "";
  return `<td class="num${n === 0 ? " ls-z" : ""}">${v}${p}</td>`;
}
function catTd(cat: StockCat, lang: string): string {
  return `<td><span class="ls-cat"><i class="ls-dot ls-dot--${cat}"></i><span>${esc(CAT_LABEL(lang)[cat])}</span></span></td>`;
}
function rowsOf(c: Ctx, cols: readonly StockCol[], withPct = false): string {
  const r = c.s.rows;
  const body = STOCK_CATS.map(
    (cat) => `<tr>${catTd(cat, c.lang)}${cols.map((col) => cell(withPct && col !== "all" ? c : { ...c, pct: false }, cat, col, r[cat][col], r[cat].all)).join("")}</tr>`,
  ).join("");
  return body;
}
const sumRow = (c: Ctx, label: string, cols: readonly StockCol[], sum: StockCounts): string =>
  `<tr class="ls-sum"><td>${esc(label)}</td>${cols.map((col) => cell({ ...c, pct: false }, "all", col, sum[col])).join("")}</tr>`;

function stateTable(c: Ctx): string {
  const L = c.lang;
  const cols: StockCol[] = ["all", "sent", "wait", "ready"];
  const head =
    `<tr><th>${esc(T(L, "Kvalifikált"))}</th><th class="num">${esc(T(L, "Darab"))}</th>` +
    `<th class="num">${ls(T(L, "Ebből kiküldött"), T(L, "Kiküldve"))}</th>` +
    `<th class="num">${ls(T(L, "Generálásra vár"), T(L, "Vár"))}</th>` +
    `<th class="num">${esc(T(L, "Kiküldhető"))}</th></tr>`;
  const plain = (label: string, n: number, cls: string): string =>
    `<tr class="${cls}"><td>${esc(label)}</td><td class="num">${fmt(n)}</td><td></td><td></td><td></td></tr>`;
  return (
    `<table class="ls-t"><thead>${head}</thead><tbody>${rowsOf(c, cols, true)}` +
    sumRow(c, T(L, "Összes kvalifikált"), cols, c.s.sum) +
    plain(T(L, "Nem kvalifikált"), c.s.notQualified, "ls-dim") +
    plain(T(L, "Összes lead"), c.s.total, "ls-sum") +
    `</tbody></table>`
  );
}

function channelTable(c: Ctx, compact = false): string {
  const L = c.lang;
  const cols: StockCol[] = ["email", "messenger", "mms", "both"];
  // The card's column is a third of the row: there „Mind” stays short, its meaning in the title.
  const both = compact
    ? `<th class="num ls-nw" title="${esc(T(L, "Mind (e-mail + messenger)"))}">${esc(T(L, "Mind"))}</th>`
    : `<th class="num">${ls(T(L, "Mind (e-mail + messenger)"), T(L, "Mind"))}</th>`;
  const head =
    `<tr><th>${esc(T(L, "Kiküldhető"))}</th><th class="num ls-nw">${esc(T(L, "E-mail"))}</th><th class="num">${esc(T(L, "Messenger"))}</th>` +
    `<th class="num">${esc(T(L, "MMS"))}</th>${both}</tr>`;
  return `<table class="ls-t"><thead>${head}</thead><tbody>${rowsOf({ ...c, pct: false }, cols)}${sumRow(c, T(L, "Összesen"), cols, c.s.sum)}</tbody></table>`;
}

function waitTable(c: Ctx, detail: boolean): string {
  const L = c.lang;
  const cols: StockCol[] = detail ? ["nomock", "unreviewed", "refused", "wcontact"] : ["wmock", "wcontact"];
  const heads = detail
    ? [
        esc(T(L, "Nincs mock")),
        ls(T(L, "Generált, átnézésre vár"), T(L, "Átnézésre vár")),
        ls(T(L, "Elutasítva / nem mehet ki"), T(L, "Elutasítva")),
        ls(T(L, "Nincs kontakt-ellenőrzés"), T(L, "Nincs kontakt")),
      ]
    : [esc(T(L, "Nincs mock generálás / ellenőrzés")), esc(T(L, "Nincs kontakt-ellenőrzés"))];
  const head = `<tr><th>${esc(T(L, "Generálásra vár"))}</th>${heads.map((h) => `<th class="num">${h}</th>`).join("")}</tr>`;
  return `<table class="ls-t"><thead>${head}</thead><tbody>${rowsOf({ ...c, pct: false }, cols)}${sumRow(c, T(L, "Összesen"), cols, c.s.sum)}</tbody></table>`;
}

const sec = (title: string, note = ""): string =>
  `<div class="ls-sec">${esc(title)}${note ? ` <span>${esc(note)}</span>` : ""}</div>`;

/** The dashboard card — a full row of the widget grid (plan „B”). */
export function leadStockCard(s: LeadStock, days: StockPreset, icon: string, lang = consoleLang()): string {
  const c: Ctx = { s, days, lang, pct: false };
  return (
    `<div class="con-w con-w--full ls-card" data-widget="crm" id="lead-stock">` +
    `<div class="con-w__h">${icon}${esc(T(lang, "Lead-állomány"))}<span class="ls-per">${esc(stockPeriodPhrase(days, lang))}</span></div>` +
    `<div class="con-w__v">${s.sum.all === 0 ? "0" : `<a href="/leads?stock=all.all&amp;stockDays=${days}">${fmt(s.sum.all)}</a>`}</div>` +
    `<div class="con-w__s">${esc(T(lang, "kvalifikált lead · ebből {n} kiküldhető most", { n: fmt(s.sum.ready) }))}</div>` +
    `<div class="ls-cols">` +
    `<div>${sec(T(lang, "Állapot"))}<div class="ls-scroll">${stateTable(c)}</div></div>` +
    `<div>${sec(T(lang, "Csatorna szerint"), T(lang, "kiküldhetők"))}<div class="ls-scroll">${channelTable(c, true)}</div></div>` +
    `<div>${sec(T(lang, "Generálásra vár"), T(lang, "miért"))}<div class="ls-scroll">${waitTable(c, false)}</div></div>` +
    `</div></div>`
  );
}

/** The Riport tab body (below the tabs and the chips). */
export function leadStockReportBody(s: LeadStock, days: StockPreset, lang = consoleLang()): string {
  const c: Ctx = { s, days, lang, pct: true };
  const kpi = (n: number, label: string): string => `<div class="ls-kpi"><b>${fmt(n)}</b><span>${esc(label)}</span></div>`;
  const bars = STOCK_CATS.map((cat) => {
    const r = s.rows[cat];
    const t = r.all || 1;
    const seg = (col: StockCol, cls: string, label: string): string =>
      r[col] ? `<i class="${cls}" style="width:${((r[col] * 100) / t).toFixed(2)}%" title="${esc(`${label}: ${fmt(r[col])}`)}"></i>` : "";
    return (
      `<tr>${catTd(cat, lang)}<td class="ls-bar"><div class="ls-stack">` +
      seg("sent", "ls-s-sent", T(lang, "kiküldött")) +
      seg("ready", "ls-s-ready", T(lang, "kiküldhető")) +
      seg("wmock", "ls-s-wm", T(lang, "nincs mock / ellenőrzés")) +
      seg("wcontact", "ls-s-wc", T(lang, "nincs kontakt-ellenőrzés")) +
      `</div></td><td class="num">${fmt(r.all)}</td></tr>`
    );
  }).join("");
  const legend =
    `<div class="ls-legend"><span><i class="ls-s-sent"></i>${esc(T(lang, "kiküldött"))}</span><span><i class="ls-s-ready"></i>${esc(T(lang, "kiküldhető"))}</span>` +
    `<span><i class="ls-s-wm"></i>${esc(T(lang, "nincs mock / ellenőrzés"))}</span><span><i class="ls-s-wc"></i>${esc(T(lang, "nincs kontakt-ellenőrzés"))}</span></div>`;
  const dl = (dt: string, dd: string): string => `<dt>${esc(dt)}</dt><dd>${esc(dd)}</dd>`;
  return (
    `<div class="ls-kpis">${kpi(s.total, T(lang, "összes lead"))}${kpi(s.sum.all, T(lang, "kvalifikált"))}${kpi(s.sum.sent, T(lang, "kiküldött"))}` +
    `${kpi(s.sum.ready, T(lang, "kiküldhető most"))}${kpi(s.sum.wait, T(lang, "generálásra vár"))}</div>` +
    `<div class="panel ls-card">${sec(T(lang, "Állapot"), T(lang, "a cellában a sor százaléka"))}<div class="ls-scroll">${stateTable(c)}</div>` +
    `<table class="ls-t ls-bars"><tbody>${bars}</tbody></table>${legend}</div>` +
    `<div class="ls-rgrid">` +
    `<div class="panel ls-card">${sec(T(lang, "Generálásra vár"), T(lang, "részletezve"))}<div class="ls-scroll">${waitTable(c, true)}</div></div>` +
    `<div class="panel ls-card">${sec(T(lang, "Csatorna szerint"), T(lang, "kiküldhetők, egy lead több oszlopban is lehet"))}<div class="ls-scroll">${channelTable(c)}</div></div>` +
    `</div>` +
    `<details class="ls-def"><summary>${esc(T(lang, "Mit jelentenek az oszlopok?"))}</summary><dl>` +
    dl(T(lang, "Időszak"), T(lang, "Az időszakban felmért leadek, a mai állapotukban.")) +
    dl(T(lang, "Kvalifikált"), T(lang, "Nincs vagy elavult honlapja, nem diszkvalifikált, és nincs letiltva a megkeresésből. (A CRM-lista alapszűrője ehhez legalább 1 képet is kér; itt a kép nélküliek a saját soraikban látszanak.)")) +
    dl(T(lang, "saját kép"), T(lang, "Van legalább 1 saját fotója (portál, Google, saját honlap). A Street View nem számít.")) +
    dl(T(lang, "település / stock"), T(lang, "Nincs saját fotó: a mock a település fotóját vagy stockképet kap. Ide számít az is, akinek még nincs mockja.")) +
    dl(T(lang, "semmilyen kép"), T(lang, "A mock elkészült, de településfotót sem kapott (betűs hős), ezért a képőr nem engedi ki.")) +
    dl(T(lang, "Ebből kiküldött"), T(lang, "Bármelyik csatornán megkapta a linket.")) +
    dl(T(lang, "Kiküldhető"), T(lang, "Az átnéző MEHET-et adott a mockra, a jóváhagyó lapon nem lett „Nem mehet ki”, és van ellenőrzött elérhetősége, de még nem ment ki.")) +
    dl(T(lang, "Generálásra vár"), T(lang, "Nincs még kész, átnézett mockja, vagy a mock kész, de nincs ellenőrzött elérhetősége. Egy lead csak egy oszlopban szerepel, a mock-ok áll előrébb.")) +
    dl(T(lang, "Kontakt-ellenőrzés"), T(lang, "Van e-mail, vagy a magyar mobilszámon a Viber/WhatsApp-ellenőrzés lefutott.")) +
    dl(T(lang, "Mind"), T(lang, "E-mailen és messengeren is elérhető (a messenger mobilszámot jelent, így MMS-en is).")) +
    `</dl></details>`
  );
}

/** The lead-list banner of an active `?stock=` filter: what it is and how to drop it. */
export function stockFilterLabel(stock: string, days: string | null, lang = consoleLang()): string {
  const [cat, col] = stock.split(".");
  const catL = cat === "all" ? T(lang, "minden képtípus") : (CAT_LABEL(lang)[cat as StockCat] ?? cat ?? "");
  const colL: Record<StockCol, string> = {
    all: T(lang, "kvalifikált"),
    sent: T(lang, "kiküldött"),
    wait: T(lang, "generálásra vár"),
    ready: T(lang, "kiküldhető"),
    wmock: T(lang, "nincs mock generálás / ellenőrzés"),
    wcontact: T(lang, "nincs kontakt-ellenőrzés"),
    nomock: T(lang, "nincs mock"),
    unreviewed: T(lang, "generált, átnézésre vár"),
    refused: T(lang, "elutasítva / nem mehet ki"),
    email: T(lang, "kiküldhető e-mailen"),
    messenger: T(lang, "kiküldhető messengeren"),
    mms: T(lang, "kiküldhető MMS-en"),
    both: T(lang, "kiküldhető e-mailen és messengeren"),
  };
  const per = isStockPreset(days) ? stockPeriodPhrase(days, lang) : stockPeriodPhrase("0", lang);
  return T(lang, "Lead-állomány: {cat} · {col} · {per}", { cat: catL, col: colL[col as StockCol] ?? col ?? "", per });
}
