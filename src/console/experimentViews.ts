// Riport › Kísérletek — the page (frozen plan: assets/design-refs/console/kiserletek/, „C”, owner
// 2026-11-22; ADR-0462). The Monday line on top (README ①), four KPIs (②), one collapsible verdict
// row per dimension (③) with the full table inside (④), the footnote (⑤).

import { esc, helpLink, layout } from "./views.js";
import { T } from "../i18n/mail.js";
import { consoleLang } from "./i18nCtx.js";
import { reportTabs } from "./reportViews.js";
import { type DimensionReport, type ExperimentReport, type VariantRow, type WeeklyLine } from "./experimentReport.js";
import type { ExperimentDimension } from "../db/schema.js";

const DIM_LABEL = (lang: string): Record<ExperimentDimension, string> => ({
  subject: T(lang, "Tárgy"),
  first_line: T(lang, "Első sor"),
  sender: T(lang, "Feladó"),
  body_style: T(lang, "Törzs"),
  image: T(lang, "Kép"),
  price_line: T(lang, "Ár-sor"),
});

/** One decimal with a comma; no denominator → „—”. */
function pct(a: number, b: number): string {
  if (!b) return "—";
  return `${(Math.round((a / b) * 1000) / 10).toFixed(1).replace(".", ",")}%`;
}
const pctOf = (x: number): string => `${(Math.round(x * 1000) / 10).toFixed(1).replace(".", ",")}%`;
const num = (n: number): string => n.toLocaleString("hu-HU").replace(/ /g, " ");

function pill(r: VariantRow, lang: string): string {
  if (!r.enabled && r.disabledReason) return `<span class="rp-pill rp-pill--bad"><i></i>${esc(T(lang, "kikapcsolta az őr"))}</span>`;
  if (!r.enabled) return `<span class="rp-pill"><i></i>${esc(T(lang, "jóváhagyásra vár"))}</span>`;
  return r.isControl
    ? `<span class="rp-pill xp-pill--ctl"><i></i>${esc(T(lang, "kontroll · fut"))}</span>`
    : `<span class="rp-pill rp-pill--ok"><i></i>${esc(T(lang, "fut"))}</span>`;
}

/** What the row says the variant IS: its wording, else the operator label. */
function variantText(r: VariantRow): string {
  return r.template ?? "";
}

function verdictText(d: DimensionReport, lang: string): { text: string; cls: string } {
  const v = d.verdict;
  if (v.kind === "idle") return { text: T(lang, "Csak a mai levél fut — nincs mit összevetni."), cls: "idle" };
  if (v.kind === "win") {
    const L = v.leader.stats!;
    const C = v.control.stats;
    return {
      text: T(lang, "„{label}” vezet: {a} vs. mai {b}", { label: v.leader.label, a: pct(L.link72, L.mature72), b: C ? pct(C.link72, C.mature72) : "—" }),
      cls: "win",
    };
  }
  const C = v.control?.stats;
  return { text: T(lang, "A mai levél tartja magát ({b})", { b: C ? pct(C.link72, C.mature72) : "—" }), cls: "hold" };
}

function dimRow(d: DimensionReport, lang: string): string {
  const v = verdictText(d, lang);
  const rows = d.rows
    .map((r) => {
      const s = r.stats;
      const text = variantText(r);
      return (
        `<tr class="${r.enabled ? "" : "off"}">` +
        `<td><b>${esc(r.label)}</b>${text ? `<small>„${esc(text)}”</small>` : ""}${r.disabledReason ? `<small>${esc(r.disabledReason)}</small>` : ""}</td>` +
        `<td>${pill(r, lang)}</td>` +
        `<td>${r.shareToday !== null ? `${Math.round(r.shareToday * 100)}%` : "—"}</td>` +
        `<td>${num(s?.sends ?? 0)}</td>` +
        `<td>${pct(s?.mail24 ?? 0, s?.mature24 ?? 0)}</td>` +
        `<td>${pct(s?.link24 ?? 0, s?.mature24 ?? 0)}</td>` +
        `<td><b>${pct(s?.link72 ?? 0, s?.mature72 ?? 0)}</b></td>` +
        `<td>${pct(s?.replies ?? 0, s?.sends ?? 0)}</td>` +
        `<td>${pct(s?.unsubs ?? 0, s?.sends ?? 0)}</td>` +
        `</tr>`
      );
    })
    .join("");
  const th = [
    T(lang, "Változat"),
    T(lang, "Állapot"),
    T(lang, "Ma"),
    T(lang, "Küldés"),
    T(lang, "Levélnyitás 24 ó"),
    T(lang, "Link 24 ó"),
    T(lang, "Link 72 ó"),
    T(lang, "Válasz"),
    T(lang, "Leiratkozás"),
  ]
    .map((h) => `<th>${esc(h)}</th>`)
    .join("");
  return (
    `<details class="xp-lc xp-lc--${v.cls}" data-dim="${d.dimension}"><summary>` +
    `<span class="xp-lc__d">${esc(DIM_LABEL(lang)[d.dimension])}</span>` +
    `<span class="xp-lc__v">${esc(v.text)}</span>` +
    `<span class="xp-lc__n">${esc(T(lang, "{n} fut", { n: d.running }))}</span>` +
    `<span class="xp-lc__ar" aria-hidden="true">›</span></summary>` +
    `<div class="xp-lc__t"><table class="xp-tbl"><thead><tr>${th}</tr></thead><tbody>${rows}</tbody></table></div></details>`
  );
}

/** The week's last day (the stored `to` is the next Monday, exclusive). */
export function weekEndDay(w: WeeklyLine): string {
  const d = new Date(`${w.to}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** README ①: the Monday line — the last completed week. */
export function weeklyText(w: WeeklyLine, lang: string): string {
  if (!w.variants) return T(lang, "A múlt héten ({from} – {to}) nem ment ki címkézett kísérleti levél.", { from: w.from, to: weekEndDay(w) });
  const head = T(lang, "{n} változat futott ({d} dimenzió).", { n: w.variants, d: w.dimensions });
  const best = w.best
    ? T(lang, "A legjobb: „{label}” ({dim}) — 72 órás link-nyitás {a} (a mai levél {b}), {p} eséllyel jobb.", {
        label: w.best.label,
        dim: DIM_LABEL(lang)[w.best.dimension].toLowerCase(),
        a: pctOf(w.best.rate),
        b: pctOf(w.best.controlRate),
        p: `${Math.round(w.best.pBetter * 100)}%`,
      })
    : T(lang, "Még egyik változat sem előzte meg a mai levelet (vagy kevés hozzá az érett levél).");
  const off = w.disabled ? ` ${T(lang, "Kikapcsolva: {n}.", { n: w.disabled })}` : "";
  return `${head} ${best}${off}`;
}

export function reportExperimentsPage(r: ExperimentReport): string {
  const lang = consoleLang();
  const tabs = reportTabs("/report/experiments", "", "", lang);
  const kbox = (t: string, v: string, sub: string): string =>
    `<div class="con-kbox"><div class="con-kbox__t">${esc(t)}</div><div class="con-kbox__r"><span class="con-kbox__v">${esc(v)}</span></div><div class="con-kbox__s">${esc(sub)}</div></div>`;
  const k = r.kpi;
  const kpis =
    `<div class="con-kstrip xp-kstrip">` +
    kbox(T(lang, "Futó változat"), String(k.running), T(lang, "bekapcsolva, minden dimenzióban")) +
    kbox(T(lang, "Kísérleti levél"), num(k.letters), T(lang, "címkézve kiment, összesen")) +
    kbox(T(lang, "Levélnyitás 24 ó"), pct(k.mail24, k.mature24), T(lang, "minden címkézett levél, ≥24 órás")) +
    kbox(T(lang, "Mai keret"), k.capToday !== null ? num(k.capToday) : "—", T(lang, "levél, ennyit oszt szét a gép ma")) +
    `</div>`;
  const week =
    `<div class="xp-week"><b>${esc(T(lang, "A héten"))}</b><span>${esc(weeklyText(r.weekly, lang))}</span>` +
    `<small>${esc(T(lang, "{from} – {to}, hétfőnként frissül", { from: r.weekly.from, to: weekEndDay(r.weekly) }))}</small></div>`;
  const foot = T(
    lang,
    "Levélnyitás = a levél képét a levelezőprogram letöltötte (a Gmail képproxyja is); az Apple Mail előtöltése NEM nyitás, ezért nincs benne ebben a számban. Link-nyitás = a levél linkjére kattintott (gépek nélkül). Vezet = a legalább 30 érett levéllel futó változatok közül a legmagasabb 72 órás link-nyitás. A gép a 72 órás link-nyitás szerint osztja a napi keretet, minden futó változat legalább 10%-ot kap. Őr: egy változat kikapcsol az első panaszos válaszra, vagy ha 100 levél után a leiratkozása több, mint a mai levélé + 0,5 százalékpont (ehhez a mai levélnek is kell 100 levél); a mai levelet nem kapcsolja ki, csak panasznál vagy 2% fölötti leiratkozásnál riaszt. A százalékok nevezője a 24, illetve 72 óránál régebbi levél.",
  );
  const panel =
    `<div class="panel"><h2>${esc(T(lang, "Kísérletek"))} <span class="rp-q">— ${esc(T(lang, "melyik levél-változat hoz több nyitást"))}</span></h2>` +
    week +
    kpis +
    r.dims.map((d) => dimRow(d, lang)).join("") +
    `<p class="mut small rp-note">${esc(foot)}</p></div>`;
  return layout(
    T(lang, "Megkeresés-riport"),
    `<div class="con-ph"><h1>${esc(T(lang, "Megkeresés-riport"))} ${helpLink("console.report_experiments")}</h1></div>${tabs}${panel}`,
    { active: "/report/experiments" },
  );
}
