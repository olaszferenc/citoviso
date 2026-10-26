// Riport · Próba fül — the page (ADR-XXXX). Frozen plan: assets/design-refs/console/proba-riport/
// (A+B hybrid). Top to bottom: KPIs → the ladder (B) with timings → the trial rows (A), narrowed
// to the stage tapped on the ladder → on which trial day people work → the mock side's device
// split → what is measured. Links and <details> only — the page works without JS.

import { esc, helpLink, layout } from "./views.js";
import { T } from "../i18n/mail.js";
import { consoleLang } from "./i18nCtx.js";
import { APP_TZ, partsIn } from "../text/zoneTime.js";
import { REPORT_RANGES, type ReportDays } from "./reportData.js";
import { reportTabs } from "./reportViews.js";
import {
  TRIAL_DAYS,
  TRIAL_STAGES,
  TRIAL_STATUS_FILTERS,
  type TrialEvent,
  type TrialReport,
  type TrialRow,
  type TrialStatusFilter,
  type TrialTiming,
  type TrialVerdict,
  type VisitorSplit,
} from "./trialReport.js";

const dec1 = (v: number): string => v.toFixed(1).replace(".", ",");
const pct = (a: number, b: number): string => (b ? `${Math.round((a / b) * 100)}%` : "–");

function dur(ms: number | null, lang: string): string {
  if (ms === null) return "–";
  const h = ms / 3_600_000;
  if (h < 1) return T(lang, "{n} perc", { n: Math.max(1, Math.round(h * 60)) });
  if (h < 48) return T(lang, "{n} óra", { n: dec1(h) });
  return T(lang, "{n} nap", { n: dec1(h / 24) });
}

function fmtAt(d: Date): string {
  const p = partsIn(d, APP_TZ);
  return `${p.month}. ${p.day}. ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}
function fmtDay(d: Date): string {
  const p = partsIn(d, APP_TZ);
  return `${p.month}. ${p.day}.`;
}

const RANGE_LABEL = (d: ReportDays, lang: string): string => (d ? T(lang, "{n} nap", { n: d }) : T(lang, "Összes"));
const STATUS_LABEL = (lang: string): Record<TrialStatusFilter, string> => ({
  all: T(lang, "Mind"),
  active: T(lang, "Fut"),
  converted: T(lang, "Megrendelte"),
  lapsed: T(lang, "Lejárt"),
});

function href(r: TrialReport, over: { days?: ReportDays; st?: TrialStatusFilter; stage?: number | null } = {}): string {
  const days = over.days ?? r.days;
  const st = over.st ?? r.st;
  const stage = over.stage === undefined ? r.stage : over.stage;
  const p = new URLSearchParams({ days: String(days) });
  if (st !== "all") p.set("st", st);
  if (stage !== null) p.set("stage", String(stage));
  return `/report/trial?${p.toString()}`;
}

const AREA_LABEL = (lang: string): Record<string, string> => ({
  szovegek: T(lang, "Szövegek"),
  fotok: T(lang, "Fotók"),
  elerhetoseg: T(lang, "Elérhetőség"),
  modulok: T(lang, "Modulok"),
  foglalasok: T(lang, "Foglalások"),
  webcim: T(lang, "Webcím"),
  penztarca: T(lang, "Pénztárca"),
  fiok: T(lang, "Fiók"),
});

const STALL_LABEL = (lang: string): Record<string, string> => ({
  package: T(lang, "a csomagválasztásnál"),
  billing: T(lang, "a számlázási adatoknál"),
  invalid: T(lang, "hibás számlázási adatnál"),
  failed: T(lang, "a küldés nem sikerült"),
});

function eventText(e: TrialEvent, lang: string): string {
  switch (e.kind) {
    case "start":
      return T(lang, "Próba indult");
    case "login":
      return e.detail === "password"
        ? T(lang, "Belépés (jelszóval)")
        : e.detail === "link"
          ? T(lang, "Belépés (egyszeri linkkel)")
          : T(lang, "Belépés az adminba");
    case "save":
      return T(lang, "Mentés: {area}", { area: AREA_LABEL(lang)[e.detail ?? ""] ?? e.detail ?? "–" });
    case "site":
      return T(lang, "Megnézte a saját oldalát");
    case "order":
      return e.detail === "admin"
        ? T(lang, "Megrendelem (adminból)")
        : e.detail === "level"
          ? T(lang, "Megrendelem (levélből)")
          : T(lang, "Megnyitotta a rendelést");
    case "checkout":
      return e.detail === "billing"
        ? T(lang, "Rendelés: számlázási adatok")
        : e.detail === "invalid"
          ? T(lang, "Rendelés: hibás számlázási adat")
          : T(lang, "Rendelés: a küldés nem sikerült");
    case "stall":
      return T(lang, "Elakadt: {step}", { step: STALL_LABEL(lang)[e.detail ?? "package"] ?? "–" });
    case "sent":
      return T(lang, "Rendelés elküldve");
    case "paid":
      return T(lang, "Fizetve");
    case "notice":
      return e.detail === "t3"
        ? T(lang, "Levél: 3 nap van hátra")
        : e.detail === "t1"
          ? T(lang, "Levél: holnap lejár")
          : T(lang, "Levél: adattörlés előtt");
    case "lapse":
      return T(lang, "A próba lejárt");
  }
}

/** The marker class of an event on the strip and in the timeline. */
function mk(e: TrialEvent): string {
  if (e.kind === "order" || e.kind === "checkout" || e.kind === "sent" || e.kind === "paid") return "order";
  if (e.kind === "start" || e.kind === "lapse") return "notice";
  return e.kind;
}

function verdictOf(v: TrialVerdict, lang: string, measured = true): { pill: string; cls: string; sub: string } {
  switch (v.k) {
    case "paid":
      return { pill: T(lang, "Megrendelte"), cls: "rp-pill--ok", sub: T(lang, "a próba {n}. napján", { n: v.day + 1 }) };
    case "lapsed":
      return {
        pill: T(lang, "Lejárt, nem rendelt"),
        cls: "",
        // Before the log existed nothing is known about the inside — not „no sign of life".
        sub: !measured
          ? T(lang, "a belseje nem mért")
          : v.lastDay === null
            ? T(lang, "életjel nélkül")
            : T(lang, "utolsó életjel a {n}. napon", { n: v.lastDay + 1 }),
      };
    case "stuck":
      return v.step === "package"
        ? { pill: T(lang, "Megrendelem után megállt"), cls: "rp-pill--warn", sub: STALL_LABEL(lang).package! }
        : { pill: T(lang, "Rendelésben elakadt"), cls: "rp-pill--warn", sub: STALL_LABEL(lang)[v.step] ?? "–" };
    case "ordered":
      return { pill: T(lang, "Rendelés folyamatban"), cls: "", sub: T(lang, "most nyitotta meg a rendelést") };
    case "no_login":
      return { pill: T(lang, "Nem lépett be"), cls: "rp-pill--bad", sub: T(lang, "{n}. nap", { n: v.day }) };
    case "quiet":
      return {
        pill: v.saved ? T(lang, "Dolgozott rajta, aztán csend") : T(lang, "Belépett, nem szerkesztett"),
        cls: "rp-pill--bad",
        sub: T(lang, "{n} napja nincs életjel", { n: v.days }),
      };
    case "active":
      return {
        pill: T(lang, "Dolgozik rajta"),
        cls: "",
        sub: v.days === 0 ? T(lang, "utolsó életjel ma") : T(lang, "utolsó életjel {n} napja", { n: v.days }),
      };
    case "unmeasured":
      return { pill: T(lang, "A belseje nem mért"), cls: "", sub: T(lang, "a mérés indulása előtt kezdődött") };
  }
}

const LEGEND = (lang: string): string =>
  `<div class="rp-tr__lgd">` +
  [
    ["login", T(lang, "belépés")],
    ["save", T(lang, "mentés")],
    ["site", T(lang, "saját oldal")],
    ["order", T(lang, "Megrendelem / rendelés")],
    ["stall", T(lang, "elakadt")],
    ["notice", T(lang, "levél")],
  ]
    .map(([k, l]) => `<span><i class="rp-mk rp-mk--${k}"></i>${esc(l!)}</span>`)
    .join("") +
  `</div>`;

function strip(t: TrialRow, lang: string): string {
  const paidDay = t.events.find((e) => e.kind === "paid")?.day ?? null;
  let cells = "";
  for (let d = 0; d < TRIAL_DAYS; d++) {
    const evs = t.events.filter((e) => e.day === d && e.kind !== "start" && e.kind !== "lapse");
    const kinds = [...new Set(evs.map(mk))];
    const cls =
      t.status === "active" && d >= t.dayNow
        ? " rp-strip__c--fut"
        : t.status === "converted" && paidDay !== null && d > paidDay
          ? " rp-strip__c--after"
          : "";
    const today = t.status === "active" && d === t.dayNow - 1 ? " rp-strip__c--today" : "";
    const title = `${T(lang, "{n}. nap", { n: d + 1 })}${evs.length ? `: ${evs.map((e) => eventText(e, lang)).join(" · ")}` : ""}`;
    cells += `<span class="rp-strip__c${cls}${today}" title="${esc(title)}">${kinds.map((k) => `<i class="rp-mk rp-mk--${k}"></i>`).join("")}</span>`;
  }
  const ax = Array.from({ length: TRIAL_DAYS }, (_, i) => `<span>${i === 0 || i === 6 || i === TRIAL_DAYS - 1 ? `${i + 1}.` : ""}</span>`).join("");
  return `<span class="rp-strip" aria-hidden="true">${cells}</span><span class="rp-strip__ax" aria-hidden="true">${ax}</span>`;
}

function timeline(t: TrialRow, lang: string): string {
  let li = "";
  let prev: Date | null = null;
  for (const e of t.events) {
    if (prev && e.at.getTime() - prev.getTime() > 2 * 86_400_000)
      li += `<li class="rp-tl__gap"><span></span><span></span><span>${esc(T(lang, "{n} nap csend", { n: Math.floor((e.at.getTime() - prev.getTime()) / 86_400_000) }))}</span></li>`;
    li += `<li><time>${esc(fmtAt(e.at))}</time><i class="rp-mk rp-mk--${mk(e)}"></i><span>${esc(T(lang, "{n}. nap", { n: e.day + 1 }))} · ${esc(eventText(e, lang))}</span></li>`;
    prev = e.at;
  }
  const v = verdictOf(t.verdict, lang, t.measured);
  const summary = t.measured
    ? T(lang, "{v} — {sub}. {l} belépés, {s} mentés.", { v: v.pill, sub: v.sub, l: t.logins, s: t.saves })
    : T(lang, "A próba a mérés indulása előtt kezdődött: a belépések és a mentések nem látszanak, csak az indulás, a levelek és a vége.");
  return (
    `<div class="rp-tl"><p class="rp-tl__sum">${esc(summary)}</p><ul>${li}</ul>` +
    `<div class="rp-tl__acts"><a class="citui-btn citui-btn--ghost" href="/lead/${esc(t.leadId)}">${esc(T(lang, "Lead-lap"))}</a></div></div>`
  );
}

function trialRow(t: TrialRow, lang: string): string {
  const v = verdictOf(t.verdict, lang, t.measured);
  const when =
    t.status === "active"
      ? T(lang, "{n}. nap", { n: t.dayNow })
      : t.status === "converted"
        ? T(lang, "megrendelte")
        : T(lang, "lejárt");
  return (
    `<details class="rp-tr"><summary>` +
    `<span class="rp-tr__who"><b>${esc(t.name)}</b><small>${esc([t.town, T(lang, "indult {d}", { d: fmtDay(t.startedAt) }), when].filter(Boolean).join(" · "))}</small></span>` +
    `<span class="rp-tr__strip">${strip(t, lang)}</span>` +
    `<span class="rp-tr__where"><span class="rp-pill ${v.cls}"><i></i>${esc(v.pill)}</span><small>${esc(v.sub)}</small></span>` +
    `</summary>${timeline(t, lang)}</details>`
  );
}

const STAGE_LABEL = (lang: string): readonly [string, string][] => [
  [T(lang, "Próba indult"), T(lang, "az űrlap elküldve")],
  [T(lang, "Belépett"), T(lang, "legalább egyszer")],
  [T(lang, "Szerkesztett"), T(lang, "legalább egy mentés")],
  [T(lang, "Megnézte az oldalát"), T(lang, "a saját élő oldalát")],
  [T(lang, "Megrendelem"), T(lang, "megnyitotta a rendelést")],
  [T(lang, "Rendelés elküldve"), T(lang, "a rendelő végén")],
  [T(lang, "Fizetett"), T(lang, "sikeres fizetés")],
];

function ladder(r: TrialReport, lang: string): string {
  const n = Math.max(1, r.ladder[0]?.reached ?? 0);
  const stops = r.ladder.slice(0, TRIAL_STAGES.length - 1).map((s) => s.stopped);
  const hot = Math.max(...stops) > 0 ? stops.indexOf(Math.max(...stops)) : -1;
  const labels = STAGE_LABEL(lang);
  const rows = r.ladder
    .map((s, i) => {
      const w = (s.reached / n) * 100;
      const out = w < 18;
      const badge =
        i < TRIAL_STAGES.length - 1 && s.stopped
          ? `<span class="rp-bar__r${i === hot ? " rp-tr__hot" : ""}">${esc(T(lang, "{n} itt állt meg", { n: s.stopped }))}</span>`
          : "";
      const inner =
        `<span class="rp-frow__l">${esc(labels[i]![0])}<small>${esc(labels[i]![1])}</small></span>` +
        `<span class="rp-bar rp-bar--tall"><i class="rp-bar__fill" style="width:${w.toFixed(1)}%"></i>` +
        `<b class="rp-bar__n${out ? " rp-bar__n--out" : ""}"${out ? ` style="left:calc(${w.toFixed(1)}% + 8px)"` : ""}>${s.reached}</b>${badge}</span>`;
      if (i === TRIAL_STAGES.length - 1) return `<div class="rp-frow rp-lad__row">${inner}</div>`;
      const on = r.stage === i;
      return `<a class="rp-frow rp-lad__row${on ? " rp-lad__row--on" : ""}" href="${esc(href(r, { stage: on ? null : i }))}#rp-trials">${inner}</a>`;
    })
    .join("");
  const unmeasured = r.trials.filter((t) => !t.measured).length;
  const note =
    (unmeasured
      ? `<p class="rp-q rp-note">${esc(T(lang, "{n} próba a mérés indulása előtt kezdődött — a lépcső nélkülük számol.", { n: unmeasured }))}</p>`
      : "") +
    `<p class="rp-q rp-note">${esc(r.stage === null ? T(lang, "Koppints egy lépcsőre: az alábbi lista csak azokat mutatja, akik ott álltak meg.") : T(lang, "A lista szűrve. Koppints újra a lépcsőre a teljes listához."))}</p>`;
  return `<div class="rp-fun">${rows}</div>${note}`;
}

const TIMING_LABEL = (lang: string): Record<TrialTiming["key"], string> => ({
  first_login: T(lang, "Indulás → 1. belépés"),
  first_save: T(lang, "Indulás → 1. mentés"),
  first_order: T(lang, "Indulás → Megrendelem"),
  order_to_paid: T(lang, "Megrendelem → fizetés"),
});

function timings(r: TrialReport, lang: string): string {
  const rows = r.timings
    .map(
      (t) =>
        `<tr><td>${esc(TIMING_LABEL(lang)[t.key])}<br><small class="rp-q">${esc(T(lang, "{n} próbából", { n: t.n }))}</small></td>` +
        `<td class="num"><b>${esc(dur(t.median, lang))}</b></td><td class="num">${esc(dur(t.max, lang))}</td></tr>`,
    )
    .join("");
  return (
    `<table class="rp-tbl"><thead><tr><th>${esc(T(lang, "Mennyi idő alatt"))}</th><th class="num">${esc(T(lang, "Medián"))}</th><th class="num">${esc(T(lang, "Leglassabb"))}</th></tr></thead><tbody>${rows}</tbody></table>` +
    `<p class="rp-q rp-note">${esc(T(lang, "A próba indulásától számolva. Mediánt nézünk: egy kivétel az átlagot elvinné."))}</p>`
  );
}

function dayChart(r: TrialReport, lang: string): string {
  const mx = Math.max(1, ...r.perDay);
  const cols = r.perDay
    .map(
      (v, d) =>
        `<span class="rp-cols__c" title="${esc(T(lang, "{d}. nap: {n} próbázó", { d: d + 1, n: v }))}"><b>${v}</b><i style="height:${((v / mx) * 100).toFixed(1)}%"></i></span>`,
    )
    .join("");
  const ax = r.perDay.map((_, d) => `<span>${d + 1}.</span>`).join("");
  const early = r.perDay.slice(0, 3).reduce((a, b) => a + b, 0);
  const mid = r.perDay.slice(3, 10).reduce((a, b) => a + b, 0);
  const measured = r.trials.some((t) => t.measured);
  const note = measured
    ? T(lang, "Az első 3 napon {a} életjel, a 4–10. napon összesen {b}.", { a: early, b: mid })
    : T(lang, "Még nincs mért próba ebben az időszakban.");
  return `<div class="rp-cols">${cols}</div><div class="rp-cols__ax">${ax}</div><p class="rp-q rp-note">${esc(note)}</p>`;
}

const SPLIT_LABEL = (lang: string): Record<VisitorSplit["key"], [string, string]> => ({
  once: [T(lang, "1 látogatás"), T(lang, "egyszer nyitotta meg")],
  same: [T(lang, "Visszatért, ugyanarról az eszközről"), T(lang, "ugyanaz az eszköz, rendszer és böngésző")],
  other: [T(lang, "Más eszközről is"), T(lang, "2+ különböző eszköz a linken")],
});

function visitors(r: TrialReport, lang: string): string {
  const mx = Math.max(1, ...r.visitors.map((v) => v.prospects));
  const L = SPLIT_LABEL(lang);
  const rows = r.visitors
    .map((v) => {
      const w = (v.prospects / mx) * 100;
      const out = w < 18;
      return (
        `<div class="rp-frow rp-vis__row"><span class="rp-frow__l">${esc(L[v.key][0])}<small>${esc(L[v.key][1])}</small></span>` +
        `<span class="rp-bar rp-bar--tall"><i class="rp-bar__fill${v.key === "other" ? " rp-cat-2" : ""}" style="width:${w.toFixed(1)}%"></i>` +
        `<b class="rp-bar__n${out ? " rp-bar__n--out" : ""}"${out ? ` style="left:calc(${w.toFixed(1)}% + 8px)"` : ""}>${v.prospects}</b>` +
        `<span class="rp-bar__r">${esc(T(lang, "próba: {p}", { p: pct(v.trialed, v.prospects) }))}</span></span></div>`
      );
    })
    .join("");
  const other = r.visitors.find((v) => v.key === "other")?.prospects ?? 0;
  return (
    `<div class="rp-fun">${rows}</div>` +
    `<p class="rp-note">${esc(T(lang, "A „Visszatér-e?” kártya ebben az időszakban {r} visszatérőt számol — ebből {o} más eszközről is megnyitotta (továbbküldött link vagy a tulaj másik eszköze).", { r: r.returned, o: other }))}</p>` +
    `<p class="rp-q rp-note">${esc(T(lang, "Új azonosító nélkül: a látogatás eszköz-típusa, rendszere és böngészője dönt, sütit vagy a böngészőben tárolt jelet nem használunk. Két egyforma telefon egynek látszik, ezért ez inkább alulbecsül."))}</p>`
  );
}

function measuresTable(r: TrialReport, lang: string): string {
  const rows: [string, string, string][] = [
    ["login", T(lang, "Belépés"), T(lang, "az admin megnyitása (fél óránként legfeljebb egy), a belépés módjával")],
    ["save", T(lang, "Mentés"), T(lang, "melyik fülön mentett (Szövegek, Fotók, Elérhetőség, Modulok, Foglalások…)")],
    ["site", T(lang, "Saját oldal"), T(lang, "az adminból megnyitotta az élő oldalát")],
    ["order", T(lang, "Megrendelem"), T(lang, "megnyitotta a rendelést (adminból vagy levélből), a rendelő lépései, elküldés, fizetés")],
    ["stall", T(lang, "Elakadt"), T(lang, "a rendelést megnyitotta, de 1 órán belül nem küldte el: az utolsó lépés neve")],
    ["notice", T(lang, "Levél"), T(lang, "a lejárat előtti értesítők kimentek")],
  ];
  const since = r.measuredFrom
    ? T(lang, "A próba belsejét {d} óta mérjük.", { d: fmtDay(r.measuredFrom) })
    : T(lang, "A próba belsejének mérése az első belépéssel indul.");
  return (
    `<table class="rp-tbl"><thead><tr><th>${esc(T(lang, "Jel"))}</th><th>${esc(T(lang, "Mikor rögzül"))}</th></tr></thead><tbody>` +
    rows.map(([k, a, b]) => `<tr><td><i class="rp-mk rp-mk--${k}"></i> ${esc(a)}</td><td>${esc(b)}</td></tr>`).join("") +
    `</tbody></table><p class="rp-q rp-note">${esc(since)}</p>`
  );
}

export function reportTrialPage(r: TrialReport): string {
  const lang = consoleLang();
  const tabs = reportTabs("/report/trial", `?days=${r.days}`, `?days=${r.days}`, lang);
  const ranges = REPORT_RANGES.map(
    (d) => `<a href="${esc(href(r, { days: d, stage: null }))}"${d === r.days ? ' class="on"' : ""}>${esc(RANGE_LABEL(d, lang))}</a>`,
  ).join("");
  const sts = TRIAL_STATUS_FILTERS.map(
    (s) => `<a href="${esc(href(r, { st: s, stage: null }))}"${s === r.st ? ' class="on"' : ""}>${esc(STATUS_LABEL(lang)[s])}</a>`,
  ).join("");
  const filter =
    `<div class="rp-filt">` +
    `<div class="rp-chips" role="group" aria-label="${esc(T(lang, "Időszak"))}">${ranges}</div>` +
    `<div class="rp-chips" role="group" aria-label="${esc(T(lang, "Állapot"))}">${sts}</div>` +
    `<span class="rp-filt__n">${esc(T(lang, "{n} próba · csak kiküldött megkeresésből indult próba (teszt nem számít)", { n: r.trials.length }))}</span>` +
    `</div>`;

  const n = r.trials.length;
  const m = r.trials.filter((t) => t.measured);
  const firstLogin = r.timings.find((t) => t.key === "first_login")?.median ?? null;
  const kbox = (t: string, v: string, sub: string): string =>
    `<div class="con-kbox"><div class="con-kbox__t">${esc(t)}</div><div class="con-kbox__r"><span class="con-kbox__v">${esc(v)}</span></div><div class="con-kbox__s">${esc(sub)}</div></div>`;
  const kpis =
    `<div class="con-kstrip rp-kstrip rp-kstrip--5">` +
    kbox(T(lang, "Próba indult"), String(n), T(lang, "a kiválasztott időszakban")) +
    kbox(T(lang, "Belépett"), `${m.filter((t) => t.logins > 0).length} / ${m.length}`, T(lang, "legalább egyszer (mért próbák)")) +
    kbox(T(lang, "Átlag belépés"), m.length ? dec1(m.reduce((a, t) => a + t.logins, 0) / m.length) : "–", T(lang, "próbánként")) +
    kbox(T(lang, "Megrendelemig jutott"), `${m.filter((t) => t.reached >= 4).length} / ${m.length}`, T(lang, "megnyitotta a rendelést")) +
    kbox(T(lang, "Megrendelte"), `${r.trials.filter((t) => t.status === "converted").length} / ${n}`, T(lang, "1. belépés medián: {v}", { v: dur(firstLogin, lang) })) +
    `</div>`;

  const stageName = r.stage !== null ? STAGE_LABEL(lang)[r.stage]![0] : null;
  const chip = stageName
    ? ` <a class="rp-pill rp-pill--warn rp-pill--xs" href="${esc(href(r, { stage: null }))}#rp-trials">${esc(T(lang, "Itt álltak meg: {s}", { s: stageName }))} ×</a>`
    : "";
  const list = r.listed.length
    ? r.listed.map((t) => trialRow(t, lang)).join("")
    : `<p class="rp-q rp-tr__empty">${esc(r.stage !== null ? T(lang, "Ezen a lépcsőn senki nem állt meg.") : T(lang, "Ebben az időszakban nem indult próba."))}</p>`;

  const body =
    kpis +
    `<div class="panel"><h2>${esc(T(lang, "Meddig jut el a próbázó?"))} <span class="rp-q">— ${esc(T(lang, "a szám: legalább eddig eljutott; koppints egy lépcsőre, és alatta látod, ki állt meg ott"))}</span></h2>` +
    `<div class="rp-lad">${`<div>${ladder(r, lang)}</div>`}<div>${timings(r, lang)}</div></div></div>` +
    `<div class="panel" id="rp-trials"><h2>${esc(T(lang, "Próbák napról napra"))}${chip} <span class="rp-q">— ${esc(T(lang, "mit csinált a próba 14 napja alatt; koppints egy sorra az idővonalért"))}</span></h2>` +
    LEGEND(lang) +
    `<div class="rp-trs">${list}</div></div>` +
    `<div class="panel"><h2>${esc(T(lang, "A próba melyik napján dolgoznak?"))} <span class="rp-q">— ${esc(T(lang, "hány próbázó lépett be vagy mentett az adott napon"))}</span></h2>${dayChart(r, lang)}</div>` +
    `<div class="panel"><h2>${esc(T(lang, "Mock: ugyanaz tér vissza, vagy továbbküldték?"))} <span class="rp-q">— ${esc(T(lang, "a kiküldött linkek látogatói eszköz szerint"))}</span></h2>${visitors(r, lang)}</div>` +
    `<div class="panel"><h2>${esc(T(lang, "Mit mér a próba alatt"))} <span class="rp-q">— ${esc(T(lang, "a lap ezekből számol"))}</span></h2>${measuresTable(r, lang)}</div>`;

  return layout(
    T(lang, "Megkeresés-riport"),
    `<div class="con-ph"><h1>${esc(T(lang, "Megkeresés-riport"))} ${helpLink("console.report_trial")}</h1></div>${tabs}${filter}${body}`,
    { active: "/report/trial" },
  );
}
