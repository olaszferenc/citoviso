// Riport → Tölcsér: the conversion tree section (ADR-0510) — B · Folyam, NO animation.
// Frozen plan (the contract): assets/design-refs/console/konverzios-fa/ (README ①–⑥, B-asztali.png /
// B-mobil.png). Numbers: ReportData.tree (the page's own fold, src/console/reportData.ts); words:
// src/console/conversionTree.ts (mirrors 07-CONVERSION-TREE.md, scripts/conversion-tree-check.mts).
//
// Server-rendered: every filter, branch and view switch is a LINK (works without JS); a small inline
// script only makes the branch / view switch instant (no reload). Desktop and phone are two layouts
// chosen by @container (horizontal flow ≥ 640 px of the section, vertical below) — two SVGs, one shown.
// Colours: tokens only (ADR-0021); icons: src/ui/icons.ts.

import { esc, helpLink } from "./views.js";
import { T } from "../i18n/mail.js";
import { icAdmin } from "../ui/icons.js";
import { APP_TZ, todayIn } from "../text/zoneTime.js";
import {
  BLIND_TRANSITIONS,
  EMAIL_PILOT_FROM,
  FLOW_NODES,
  FLOW_PARTS,
  FLOW_TRANSITIONS,
  TREE_STATES,
  TREE_TRANSITIONS,
  flowKeyOf,
  leverOf,
  transitionOf,
  type TreeCause,
  type TreeMeasure,
} from "./conversionTree.js";
import {
  treeStateCount,
  treeTransitionCounts,
  type ReportData,
  type TreeCounts,
  type TreeData,
  type TreeMailbox,
  type TreeTaskRow,
} from "./reportData.js";

export interface TreeViewOpts {
  /** The selected branch (`fa` param): a flow key (1-5 … 8-9) or 0-1 / 9-10; null = the biggest drop. */
  readonly sel: string | null;
  readonly view: "tree" | "tasks";
}

/** Builds a /report href from the page's current query with `set` applied (null = remove the param). */
export type TreeHref = (set: Readonly<Record<string, string | null>>) => string;

const PANEL_KEYS: readonly string[] = ["0-1", ...FLOW_TRANSITIONS, "9-10"];

// ── formatting ───────────────────────────────────────────────────────────────
function fmtPct(r: number | null): string {
  if (r === null || !Number.isFinite(r)) return "—";
  const p = r * 100;
  return `${p > 0 && p < 10 ? p.toFixed(1).replace(".", ",") : String(Math.round(p))}%`;
}
const ratio = (a: number, b: number): number | null => (b ? a / b : null);
const arrow = (key: string): string => key.replace("-", "→");
const arrowSp = (key: string): string => key.replace("-", " → ");
const mmdd = (d: Date): string => `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The biggest MEASURED drop (5→6 … 8→9, by leads lost); null = nothing lost. */
export function biggestDrop(c: TreeCounts): string | null {
  let best: string | null = null;
  let lost = 0;
  for (const k of ["5-6", "6-7", "7-8", "8-9"]) {
    const tc = treeTransitionCounts(c, k)!;
    if (tc.from - tc.to > lost) { lost = tc.from - tc.to; best = k; }
  }
  return best;
}

// ── small pieces ─────────────────────────────────────────────────────────────
function mchip(m: TreeMeasure, lang: string): string {
  if (m === "merve") return `<span class="kf-mchip kf-mchip--merve">${icAdmin("check", 11)}${esc(T(lang, "mérve"))}</span>`;
  if (m === "reszben") return `<span class="kf-mchip kf-mchip--reszben">${icAdmin("halfc", 11)}${esc(T(lang, "részben"))}</span>`;
  return `<span class="kf-mchip kf-mchip--vakfolt">${icAdmin("eyeoff", 11)}${esc(T(lang, "vakfolt"))}</span>`;
}
function kindBadge(k: "igazolt" | "felteves" | "kar", lang: string): string {
  const label = k === "igazolt" ? T(lang, "ok · igazolt") : k === "felteves" ? T(lang, "ok · feltevés") : T(lang, "kar");
  return `<span class="kf-kb kf-kb--${k}">${esc(label)}</span>`;
}
const tasksOn = (t: TreeData, node: string): TreeTaskRow[] => t.tasks.filter((x) => x.node === node);
function taskCount(t: TreeData, nodes: readonly string[], lang: string): string {
  const n = nodes.reduce((a, k) => a + tasksOn(t, k).length, 0);
  return n ? `<span class="kf-tcount"><i></i>${esc(T(lang, "{n} feladat", { n }))}</span>` : "";
}
function beforeText(x: TreeTaskRow, lang: string): string {
  if (x.beforeRate === null) return BLIND_TRANSITIONS.includes(x.node) ? T(lang, "vakfolt") : T(lang, "nincs mért szám");
  return `${String(Math.round(x.beforeRate * 10) / 10).replace(".", ",")}%`;
}
function afterText(x: TreeTaskRow, lang: string): string {
  if (x.after === "blind") return T(lang, "vakfolt — előbb mérni kell");
  if (x.after === "wait") return T(lang, "fut, még nincs");
  return `${fmtPct(x.after.rate / 100)} (${x.after.to} / ${x.after.from})`;
}
function taskPill(x: TreeTaskRow, lang: string): string {
  return (
    `<span class="kf-task">${icAdmin("user", 12)}<span>${esc(x.owner)} · ${esc(T(lang, "{d} óta", { d: mmdd(x.startedAt) }))} · ` +
    `${esc(T(lang, "előtte {r}", { r: beforeText(x, lang) }))}</span></span>`
  );
}
function rateWhere(node: string, lang: string): string {
  const [a, b] = node.split("-");
  if (BLIND_TRANSITIONS.includes(node)) return T(lang, "hatása a {a}→{b} arányon látszana — ma vakfolt, előbb mérés kell", { a: a!, b: b! });
  if (node === "4-5") return T(lang, "hatása a 4→5 arányon látszik (ma az 1→5 összesítve mérhető)");
  return T(lang, "hatása a {a}→{b} arányon látszik", { a: a!, b: b! });
}

function causeCard(c: TreeCause, node: string, t: TreeData, lang: string): string {
  const levers = c.levers.length
    ? `<ul class="kf-levers">${c.levers
        .map((l) => {
          const tasks = t.tasks.filter((x) => x.node === node && x.leverId === l.id);
          return (
            `<li class="kf-lever" data-kf-lever="${esc(l.id)}"><div class="kf-lever__t">${kindBadge("kar", lang)} ${esc(T(lang, l.name))}</div>` +
            `<div class="kf-lever__d">${esc(T(lang, l.desc))}</div><div class="kf-lever__h">${esc(rateWhere(node, lang))}</div>` +
            tasks.map((x) => taskPill(x, lang)).join("") +
            `</li>`
          );
        })
        .join("")}</ul>`
    : `<div class="kf-nolever">${esc(T(lang, "Még nincs kar ehhez az okhoz."))}</div>`;
  const ret = c.showsReturners ? ` · ${esc(T(lang, "visszatérő másik napon:"))} <b>${t.counts.returned}</b>` : "";
  const ev = c.evidence || ret ? `<div class="kf-cause__ev">${esc(T(lang, c.evidence))}${ret}</div>` : "";
  return (
    `<div class="kf-cause kf-cause--${c.kind}"><div class="kf-cause__h">${kindBadge(c.kind, lang)} ${mchip(c.measure, lang)}</div>` +
    `<div class="kf-cause__t">${esc(T(lang, c.title))}</div>${ev}${levers}</div>`
  );
}
function causesOf(node: string, t: TreeData, lang: string): string {
  const tr = transitionOf(node)!;
  return tr.causes.length
    ? `<div class="kf-causes">${tr.causes.map((c) => causeCard(c, node, t, lang)).join("")}</div>`
    : `<div class="kf-nolever">${esc(T(lang, "Ide még nem tartozik ok: nincs adat."))}</div>`;
}

const BLIND_TEXT = (lang: string): Readonly<Record<string, string>> => ({
  "0-1": T(lang, "A kiválasztás minőségét csak a válaszokból és a leiratkozási okokból látjuk — arány nincs."),
  "1-2": T(lang, "Hány levél érkezett meg, ma nem mérjük: a visszapattanót eldobjuk. Ez a lépés vakfolt, nem nulla."),
  "2-3": T(lang, "Az észrevétel közvetlenül nem mérhető; közvetett jel a tervnyitás időzítése."),
  "3-4": T(lang, "Az észrevétel és a nyitás közti esés nem mérhető, mert a 3-as állapot vakfolt."),
  "9-10": T(lang, "Nincs még vevő, ezért a megmaradás még nem mérhető."),
});
const blindNote = (text: string, icon = "eyeoff"): string => `<div class="kf-blind">${icAdmin(icon, 15)}<span>${text}</span></div>`;

function partialFour(d: ReportData, t: TreeData, lang: string): string {
  const c = t.counts;
  const since = d.mailSince ? d.mailSince.slice(5) : "—";
  return blindNote(
    esc(T(lang, "A 4-es (levélnyitás) csak részben mért: {o} / {n} követett levél = {p} — {since} óta mérve; a Gmailen kívül alulszámol. Ezért a 4→5 arányt nem számoljuk ki.", {
      o: c.mailOpened, n: c.mailTracked, p: fmtPct(ratio(c.mailOpened, c.mailTracked)), since,
    })),
    "halfc",
  );
}

function trSummary(key: string, t: TreeData, lang: string): string {
  const tc = treeTransitionCounts(t.counts, key);
  if (!tc) return "";
  if (key === "1-5")
    return `<div class="kf-tsum"><span>${esc(T(lang, "1→5 összesítve:"))} <b>${tc.from}</b> → <b>${tc.to}</b> · <b>${fmtPct(ratio(tc.to, tc.from))}</b> ${esc(T(lang, "nyitotta meg a tervet"))}</span></div>`;
  return (
    `<div class="kf-tsum"><span><b>${tc.from}</b> → <b>${tc.to}</b></span>` +
    `<span>${esc(T(lang, "továbblép:"))} <b>${fmtPct(ratio(tc.to, tc.from))}</b></span>` +
    `<span class="kf-bad">${esc(T(lang, "elvész:"))} <b>${tc.from - tc.to}</b></span></div>`
  );
}

function branchPanel(key: string, d: ReportData, t: TreeData, lang: string, on: boolean): string {
  const hidden = on ? "" : " hidden";
  if (key === "1-5") {
    const parts = FLOW_PARTS["1-5"]!
      .map((p) => `<div class="kf-subhd">${esc(arrowSp(p))} · ${esc(T(lang, transitionOf(p)!.label))} ${taskCount(t, [p], lang)}</div>` +
        (p === "4-5" ? "" : blindNote(esc(BLIND_TEXT(lang)[p]!))) + causesOf(p, t, lang))
      .join("");
    return (
      `<div class="panel kf-bpanel" data-kf-panel="1-5" id="kf-p-1-5"${hidden}><h3>${esc(T(lang, "1 → 5 · nem nyitotta meg a tervet"))} ${mchip("vakfolt", lang)}</h3>` +
      trSummary("1-5", t, lang) + partialFour(d, t, lang) + parts + `</div>`
    );
  }
  const tr = transitionOf(key)!;
  const body = BLIND_TRANSITIONS.includes(key) ? blindNote(esc(BLIND_TEXT(lang)[key]!)) : trSummary(key, t, lang);
  return (
    `<div class="panel kf-bpanel" data-kf-panel="${key}" id="kf-p-${key}"${hidden}><h3>${esc(arrowSp(key))} · ${esc(T(lang, tr.label))} ${taskCount(t, [key], lang)}</h3>` +
    body + causesOf(key, t, lang) + `</div>`
  );
}

// ── the flow (B) ─────────────────────────────────────────────────────────────
const FLOW_UNITS: readonly number[] = [0, 2, 3, 4, 5, 6];

function flowSvg(t: TreeData, sel: string, vert: boolean, href: TreeHref, lang: string): string {
  const c = t.counts;
  const W = vert ? 360 : 1000;
  const nt = 8;
  let v0: number, H: number, dropV: number, uStep: number, u0: number, total: number;
  if (vert) { v0 = 138; H = Math.min(110, (W - v0 - 22) / 2); dropV = v0 + H + 16; u0 = 28; uStep = 74; total = u0 + 6 * uStep + 34; }
  else { v0 = 58; H = 150; dropV = v0 + H + 30; u0 = 16; uStep = (W - u0 - 110) / 6; total = dropV + H + 30; }
  const P = (u: number, v: number): [number, number] => (vert ? [v, u] : [u, v]);
  const pt = (u: number, v: number): string => P(u, v).map((n) => n.toFixed(1)).join(",");
  const hh = (n: number): number => (c.sent ? H * (n / c.sent) : 0);
  const nu = (i: number): number => u0 + FLOW_UNITS[i]! * uStep;
  const ribbon = (u1: number, a1: number, a2: number, u2: number, b1: number, b2: number): string => {
    const um = (u1 + u2) / 2;
    return `M${pt(u1, a1)} C${pt(um, a1)} ${pt(um, b1)} ${pt(u2, b1)} L${pt(u2, b2)} C${pt(um, b2)} ${pt(um, a2)} ${pt(u1, a2)} Z`;
  };
  const id = vert ? "V" : "H";
  const vals = FLOW_NODES.map((n) => treeStateCount(c, n)!);
  let s =
    `<svg class="kf-sk kf-sk--${vert ? "v" : "h"}" viewBox="0 0 ${W} ${total.toFixed(0)}" role="img" aria-label="${esc(T(lang, "Lemorzsolódási folyam 1-től 9-ig"))}"><defs>` +
    `<pattern id="kfHatch${id}" patternUnits="userSpaceOnUse" width="9" height="9" patternTransform="rotate(45)"><rect width="9" height="9" class="kf-hatchbg"/><rect width="3.5" height="9" class="kf-hatchln"/></pattern>` +
    `<pattern id="kfHatchSel${id}" patternUnits="userSpaceOnUse" width="9" height="9" patternTransform="rotate(45)"><rect width="9" height="9" class="kf-hatchsel"/><rect width="3.5" height="9" class="kf-hatchln"/></pattern></defs>`;
  // drops (under the band so its edge stays crisp) — each a link to its panel
  FLOW_TRANSITIONS.forEach((k, i) => {
    const from = vals[i]!, to = vals[i + 1]!;
    const u1 = nu(i) + nt, u2 = nu(i + 1);
    const dh = Math.max(1.5, hh(from) - hh(to));
    const a1 = v0 + hh(to), a2 = Math.max(a1 + 1.5, v0 + hh(from));
    const blind = k === "1-5";
    const fill = blind ? ` fill="url(#kfHatch${sel === k ? "Sel" : ""}${id})"` : "";
    const lost = from - to;
    const pc = from ? fmtPct(1 - to / from) : "—";
    const title = T(lang, "{k}: {n} lead esett ki", { k: arrow(k), n: lost });
    let label: string;
    if (vert) {
      const [x, y] = P(u2 + 13, dropV + 2);
      label = `<text class="kf-t kf-t--d${blind ? " kf-t--blind" : ""}" x="${x.toFixed(1)}" y="${y.toFixed(1)}">−${lost}</text>` +
        `<text class="kf-t kf-t--m" x="${x.toFixed(1)}" y="${(y + 13).toFixed(1)}">${esc(T(lang, "{p} esés", { p: pc }))}${blind ? esc(T(lang, " · vakfolt")) : ""}</text>`;
    } else {
      const [x, y] = P(u2 - 4, dropV + dh + 15);
      label = `<text class="kf-t kf-t--d${blind ? " kf-t--blind" : ""}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="end">−${lost}</text>` +
        `<text class="kf-t kf-t--m" x="${x.toFixed(1)}" y="${(y + 13).toFixed(1)}" text-anchor="end">${esc(T(lang, "{p} esés", { p: pc }))}${blind ? esc(T(lang, " · 2–4 vakfolt")) : ""}</text>`;
    }
    s +=
      `<a href="${esc(href({ fa: k, nezet: null }))}#kf" data-kf-sel="${k}" aria-label="${esc(title)}">` +
      `<path class="kf-drop${blind ? " kf-drop--hole" : ""}${sel === k ? " sel" : ""}" data-kf-hatch="${blind ? id : ""}"${fill} d="${ribbon(u1, a1, a2, u2 - 2, dropV, dropV + dh)}"><title>${esc(title)}</title></path>${label}</a>`;
  });
  // the band
  FLOW_TRANSITIONS.forEach((_k, i) => {
    const to = vals[i + 1]!, u1 = nu(i) + nt, u2 = nu(i + 1), hTo = Math.max(0, hh(to));
    if (hTo <= 0) return;
    const [x, y] = P(u1, v0), [x2, y2] = P(u2, v0 + hTo);
    s += `<rect class="kf-band" x="${Math.min(x, x2).toFixed(1)}" y="${Math.min(y, y2).toFixed(1)}" width="${Math.abs(x2 - x).toFixed(1)}" height="${Math.abs(y2 - y).toFixed(1)}"/>`;
  });
  // 2 · 3 · 4 markers on the shared 1→5 branch
  [2, 3, 4].forEach((n, j) => {
    const u = nu(0) + nt + (nu(1) - nu(0) - nt) * (j + 1) / 4;
    const [cx, cy] = P(u, v0 + hh(vals[1]!) + 13);
    s += `<circle class="kf-hm" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="8.5"/><text class="kf-t kf-t--h" x="${cx.toFixed(1)}" y="${(cy + 3.5).toFixed(1)}" text-anchor="middle">${n}</text>`;
  });
  // nodes + labels
  FLOW_NODES.forEach((n, i) => {
    const v = vals[i]!, hN = hh(v);
    const [x, y] = P(nu(i), v0);
    if (hN > 0.4) {
      const [w, h] = vert ? [hN, nt] : [nt, hN];
      s += `<rect class="kf-node" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5"/>`;
    } else {
      const [w, h] = vert ? [14, nt] : [nt, 14];
      s += `<rect class="kf-node0" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w}" height="${h}" rx="1.5"/>`;
    }
    const st = TREE_STATES.find((x) => x.n === n)!;
    const rate = i === 0 ? "" : i === 1 ? ` · ${fmtPct(ratio(v, c.sent))}` : ` · ${fmtPct(ratio(v, vals[i - 1]!))}`;
    const name = `${n} · ${esc(T(lang, st.short))}`;
    if (vert) s += `<text class="kf-t" x="4" y="${(nu(i) + 9).toFixed(1)}">${name}</text><text class="kf-t kf-t--v" x="4" y="${(nu(i) + 26).toFixed(1)}">${v}<tspan class="kf-t kf-t--m" dx="4">${rate}</tspan></text>`;
    else s += `<text class="kf-t" x="${nu(i).toFixed(1)}" y="${v0 - 26}">${name}</text><text class="kf-t kf-t--v" x="${nu(i).toFixed(1)}" y="${v0 - 9}">${v}<tspan class="kf-t kf-t--m" dx="5">${rate}</tspan></text>`;
  });
  // the partial 4 on the blind zone
  {
    const u = nu(0) + nt + (nu(1) - nu(0) - nt) * 3 / 4;
    const [x, y] = P(u, v0 + hh(vals[1]!) + 34);
    const op = fmtPct(ratio(c.mailOpened, c.mailTracked));
    const txt = esc(T(lang, "4: levélnyitás {p}*", { p: op }));
    s += vert
      ? `<text class="kf-t kf-t--m kf-t--halo" x="${(x - 8).toFixed(1)}" y="${(y + 4).toFixed(1)}">${txt}</text>`
      : `<text class="kf-t kf-t--m kf-t--halo" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle">${txt}</text>`;
  }
  return s + `</svg>`;
}

function exitsPanel(t: TreeData, lang: string): string {
  const c = t.counts;
  const row = (icon: string, label: string, n: number, r: string): string =>
    `<div class="kf-exit">${icAdmin(icon, 14)} ${esc(label)}<b>${n}</b><span class="kf-exit__r">${esc(r)}</span></div>`;
  return (
    `<div class="panel kf-exits"><h3>${esc(T(lang, "Oldalkijárat"))} <span class="rp-q">${esc(T(lang, "— bármely szintről, nem része a folyamnak"))}</span></h3>` +
    row("reply", T(lang, "Válaszolt"), c.replied, fmtPct(ratio(c.replied, c.sent))) +
    row("logout", T(lang, "Leiratkozott"), c.unsubscribed, fmtPct(ratio(c.unsubscribed, c.sent))) +
    row("revisit", T(lang, "Visszatért másik napon"), c.returned, T(lang, "{p} a tervnyitókból", { p: fmtPct(ratio(c.returned, c.s5)) })) +
    `<div class="kf-exit__n">${esc(T(lang, "arány: a kiküldöttekből; visszatérő: a tervnyitókból"))} ${mchip("merve", lang)}</div></div>`
  );
}

function treeView(d: ReportData, t: TreeData, sel: string, href: TreeHref, lang: string): string {
  const chips = FLOW_TRANSITIONS.map((k) => {
    const tc = treeTransitionCounts(t.counts, k)!;
    const blind = k === "1-5";
    const hasTask = FLOW_PARTS[k]!.some((x) => tasksOn(t, x).length);
    return (
      `<a href="${esc(href({ fa: k, nezet: null }))}#kf" class="kf-dchip${blind ? " kf-dchip--blind" : ""}${sel === k ? " on" : ""}" data-kf-sel="${k}" aria-pressed="${sel === k}">` +
      `${esc(arrow(k))}<span class="kf-dchip__v">−${tc.from - tc.to}</span>${blind ? icAdmin("eyeoff", 11) : ""}${hasTask ? `<span class="kf-tcount"><i></i></span>` : ""}</a>`
    );
  }).join("");
  const legend =
    `<div class="kf-legend"><span><span class="kf-sw kf-sw--band"></span>${esc(T(lang, "továbbjutók (szélesség ∝ lead)"))}</span>` +
    `<span><span class="kf-sw kf-sw--drop"></span>${esc(T(lang, "lemorzsolódás — koppints rá"))}</span>` +
    `<span><span class="kf-sw kf-sw--hole"></span>${esc(T(lang, "2·3·4 vakfolt: itt vész el, de nem tudjuk, melyik lépésben"))}</span>` +
    `<span>${esc(T(lang, "0 és 10 vakfolt, a folyam 1–9:"))} ` +
    `<a href="${esc(href({ fa: "0-1", nezet: null }))}#kf" data-kf-sel="0-1" class="kf-leglink">${esc(T(lang, "0 → 1 · rossz kiválasztás"))}</a> · ` +
    `<a href="${esc(href({ fa: "9-10", nezet: null }))}#kf" data-kf-sel="9-10" class="kf-leglink">${esc(T(lang, "9 → 10 · megmaradás"))}</a></span></div>`;
  return (
    `<div class="kf-flow"><div class="kf-skwrap">${flowSvg(t, sel, false, href, lang)}${flowSvg(t, sel, true, href, lang)}</div>` +
    legend +
    `<div class="kf-dchips" role="group" aria-label="${esc(T(lang, "Esések"))}">${chips}</div>` +
    PANEL_KEYS.map((k) => branchPanel(k, d, t, lang, k === sel)).join("") +
    exitsPanel(t, lang) +
    `</div>`
  );
}

// ── Feladatok ────────────────────────────────────────────────────────────────
function tasksView(t: TreeData, href: TreeHref, lang: string): string {
  const head =
    `<h3>${esc(T(lang, "Aktív feladatok"))} <span class="rp-q">${esc(T(lang, "— mi melyik csomóponton dolgozik"))}</span></h3>` +
    `<div class="kf-rule">${esc(T(lang, "Szabály: kar csak ok alá kerülhet, és a hatását a szülő-állapot arányán mérjük, előtte–utána számmal. Az „utána” csak mért kohorsz után mutat számot."))}</div>`;
  if (t.tasksUnavailable)
    return `<div class="panel kf-tasks">${head}<div class="kf-empty kf-empty--sm"><p>${esc(T(lang, "A feladat-tábla még nincs felvéve ezen a gépen (0163-as migráció). Amint felkerül, itt jelennek meg a karokon futó feladatok."))}</p></div></div>`;
  if (!t.tasks.length)
    return `<div class="panel kf-tasks">${head}<div class="kf-empty kf-empty--sm"><p>${esc(T(lang, "Még egyik karon sem fut feladat. A koordinátor veszi fel a karokat egyenként (scripts/conversion-task.mts add)."))}</p></div></div>`;
  const rows = t.tasks.map((x) => {
    const tr = transitionOf(x.node);
    const lv = leverOf(x.node, x.leverId);
    return {
      x,
      node: `<b>${esc(arrowSp(x.node))}</b><div class="kf-tiny">${esc(tr ? T(lang, tr.label) : "")}</div>`,
      cause: lv ? esc(T(lang, lv.cause.title)) : `<span class="kf-muted">—</span>`,
      lever: lv ? `${kindBadge("kar", lang)} ${esc(T(lang, lv.lever.name))}` : `${kindBadge("kar", lang)} <span class="kf-muted">${esc(T(lang, "ismeretlen kar: {id}", { id: x.leverId }))}</span>`,
      goto: `<a href="${esc(href({ fa: flowKeyOf(x.node), nezet: null }))}#kf-p-${esc(flowKeyOf(x.node))}" class="kf-linkbtn" data-kf-goto="${esc(flowKeyOf(x.node))}">`,
    };
  });
  const desk =
    `<table class="rp-tbl kf-ttable"><thead><tr><th>${esc(T(lang, "Csomópont"))}</th><th>${esc(T(lang, "Ok"))}</th><th>${esc(T(lang, "Kar"))}</th><th>${esc(T(lang, "Ki"))}</th><th>${esc(T(lang, "Mióta"))}</th><th>${esc(T(lang, "Szülő-arány előtte"))}</th><th>${esc(T(lang, "Utána"))}</th><th></th></tr></thead><tbody>` +
    rows.map((r) =>
      `<tr><td>${r.node}</td><td>${r.cause}</td><td>${r.lever}</td><td>${icAdmin("user", 12)} ${esc(r.x.owner)}</td><td>${esc(T(lang, "{d} óta", { d: mmdd(r.x.startedAt) }))}</td>` +
      `<td><b>${esc(beforeText(r.x, lang))}</b> <span class="kf-tiny">(${esc(arrow(r.x.node))})</span></td><td class="${typeof r.x.after === "object" ? "" : "kf-muted"}">${esc(afterText(r.x, lang))}</td>` +
      `<td>${r.goto}${esc(T(lang, "a fában"))}</a></td></tr>`).join("") +
    `</tbody></table>`;
  const mob =
    `<div class="kf-tcards">` +
    rows.map((r) =>
      `<div class="kf-tcard"><div>${r.node}</div><div class="kf-tcard__l">${r.lever}</div>${taskPill(r.x, lang)}` +
      `<dl><dt>${esc(T(lang, "Ok"))}</dt><dd>${r.cause}</dd><dt>${esc(T(lang, "Előtte"))}</dt><dd>${esc(beforeText(r.x, lang))}</dd><dt>${esc(T(lang, "Utána"))}</dt><dd>${esc(afterText(r.x, lang))}</dd></dl>` +
      `<div class="kf-tcard__go">${r.goto}${esc(T(lang, "megnyitom a fában"))}</a></div></div>`).join("") +
    `</div>`;
  return `<div class="panel kf-tasks">${head}<div class="kf-tasks__desk">${desk}</div><div class="kf-tasks__mob">${mob}</div></div>`;
}

// ── Mérési napló ─────────────────────────────────────────────────────────────
function measureLog(d: ReportData, t: TreeData, scope: string, lang: string): string {
  const c = t.counts;
  const max = Math.max(1, ...t.weekly.map((w) => (w.sent ? w.opened / w.sent : 0)));
  const bars = t.weekly
    .map((w) => {
      const r = w.sent ? w.opened / w.sent : null;
      const h = r === null ? 0 : Math.max(2, (r / max) * 100);
      const label = r === null ? "—" : fmtPct(r);
      return (
        `<div class="kf-tb${w.open ? " kf-tb--open" : ""}" title="${esc(T(lang, "{w}: {o} tervnyitás / {s} kiküldés", { w: w.week, o: w.opened, s: w.sent }))}">` +
        `<b>${esc(label)}</b><i style="height:${h.toFixed(1)}%"></i><span>${esc(w.week.slice(5))}</span>${w.open ? `<em>${esc(T(lang, "folyamatban"))}</em>` : ""}</div>`
      );
    })
    .join("");
  return (
    `<details class="kf-log"><summary>${icAdmin("notes", 15)} <b>${esc(T(lang, "Mérési napló"))}</b> <span class="kf-muted">· ${esc(T(lang, "élőben a riport adataiból"))}</span>${icAdmin("chevron-down", 16)}</summary>` +
    `<div class="kf-logwrap"><div class="kf-logentry"><div class="kf-logentry__d">${esc(scope)}</div><ul>` +
    `<li>${esc(T(lang, "1 kiküldve {a} · 5 tervnyitás {b} ({p})", { a: c.sent, b: c.s5, p: fmtPct(ratio(c.s5, c.sent)) }))}</li>` +
    `<li>${esc(T(lang, "4 levélnyitás: {o} / {n} követett levél ({p}) — {since} óta mérve; a Gmailen kívül alulszámol", { o: c.mailOpened, n: c.mailTracked, p: fmtPct(ratio(c.mailOpened, c.mailTracked)), since: d.mailSince ? d.mailSince.slice(5) : "—" }))}</li>` +
    `<li>${esc(T(lang, "6 végignézte {a} · 7 ajánlathoz nyúlt {b} · 8 próba {tr}, rendelés {od} · 9 fizetett {pd}", { a: c.s6, b: c.s7, tr: c.trialed, od: c.ordered, pd: c.s9 }))}</li>` +
    `<li>${esc(T(lang, "oldalkijárat: válasz {r}, leiratkozás {u} · visszatérő másik napon {ret}", { r: c.replied, u: c.unsubscribed, ret: c.returned }))}</li>` +
    `</ul></div>` +
    `<div><div class="kf-small"><b>${esc(T(lang, "Heti tervnyitás / kiküldés"))}</b> <span class="kf-muted">${esc(T(lang, "(küldési hét; a postafiók- és országszűrőre, az időszaktól függetlenül)"))}</span></div>` +
    `<div class="kf-trend">${bars}</div></div></div></details>`
  );
}

// ── the section ──────────────────────────────────────────────────────────────
const MB_LABEL = (lang: string): Readonly<Record<TreeMailbox, string>> => ({ all: T(lang, "Mind"), gmail: T(lang, "Gmail"), other: T(lang, "Egyéb") });

function filters(d: ReportData, t: TreeData, view: "tree" | "tasks", href: TreeHref, lang: string): string {
  const today = d.period.key === "custom" ? d.period.to : null;
  const pilotOn = d.period.key === "custom" && d.period.from === EMAIL_PILOT_FROM;
  const chip = (h: string, label: string, on: boolean, extra = ""): string =>
    `<a href="${esc(h)}#kf"${on ? ' class="on" aria-current="true"' : ""}${extra}>${esc(label)}</a>`;
  const period = [
    chip(href({ days: "7", from: null, to: null }), T(lang, "7 nap"), d.period.key === "7"),
    chip(href({ days: "30", from: null, to: null }), T(lang, "30 nap"), d.period.key === "30"),
    chip(href({ days: null, from: EMAIL_PILOT_FROM, to: today && pilotOn ? today : todayIn(APP_TZ, d.now) }), T(lang, "Pilot · {d} óta", { d: EMAIL_PILOT_FROM.slice(5) }), pilotOn),
    chip(href({ days: "0", from: null, to: null }), T(lang, "Összes"), d.period.key === "0"),
  ].join("");
  const otherPeriod = !["7", "30", "0"].includes(d.period.key) && !pilotOn;
  const mb = (["all", "gmail", "other"] as const).map((k) => chip(href({ mb: k === "all" ? null : k }), MB_LABEL(lang)[k], t.mailbox === k)).join("");
  const sel = d.country ?? "all";
  const isoList = (d.countries ?? []).map((c) => c.iso).filter((iso) => iso !== "").slice(0, 3);
  if (sel !== "all" && !isoList.includes(sel)) isoList.push(sel);
  const ctry =
    chip(href({ ctry: null }), T(lang, "Mind"), sel === "all") +
    isoList.map((iso) => chip(href({ ctry: iso === "" ? "-" : iso }), iso || "?", sel === iso)).join("");
  const n = t.tasks.length;
  const views =
    `<a href="${esc(href({ nezet: null }))}#kf" data-kf-view="tree"${view === "tree" ? ' class="on" aria-current="true"' : ""}>${esc(T(lang, "Fa"))}</a>` +
    `<a href="${esc(href({ nezet: "feladatok" }))}#kf" data-kf-view="tasks"${view === "tasks" ? ' class="on" aria-current="true"' : ""}>${icAdmin("list", 13)} ${esc(T(lang, "Feladatok ({n})", { n }))}</a>`;
  const grp = (label: string, chips: string, cls = ""): string =>
    `<div class="kf-fg${cls}"><span>${esc(label)}</span><div class="rp-chips">${chips}</div></div>`;
  return (
    `<div class="kf-filt">` +
    grp(T(lang, "Időszak"), period) +
    grp(T(lang, "Postafiók"), mb) +
    grp(T(lang, "Ország"), ctry) +
    grp(T(lang, "Nézet"), views, " kf-fg--view") +
    `</div>` +
    (otherPeriod ? `<p class="kf-note">${esc(T(lang, "Az időszak a lap tetején választott ({p}) — a fa ugyanarra számol.", { p: d.period.key === "today" ? T(lang, "ma") : d.period.key === "custom" ? `${d.period.from} – ${d.period.to}` : T(lang, "{n} nap", { n: d.period.key }) }))}</p>` : "")
  );
}

/** The tree section — placed at the top of the Tölcsér page; absent when the fold has no tree. */
export function conversionTreeSection(d: ReportData, opts: TreeViewOpts, href: TreeHref, lang: string): string {
  const t = d.tree;
  if (!t) return "";
  const c = t.counts;
  const big = biggestDrop(c);
  const sel = opts.sel && PANEL_KEYS.includes(opts.sel) ? opts.sel : big ?? "1-5";
  const empty = c.sent === 0;
  const sum = empty
    ? T(lang, "Ebben a szűrésben nem ment ki levél.")
    : T(lang, "{a} kiküldve → {b} tervet nyitott → {c} ajánlathoz nyúlt → {d} {dl} → {e} fizetett · legnagyobb mért esés: {big}", {
        a: c.sent, b: c.s5, c: c.s7, d: c.s8, dl: c.ordered ? T(lang, "próba / rendelés") : T(lang, "próba"), e: c.s9, big: big ? arrow(big) : "—",
      });
  const mbName = MB_LABEL(lang)[t.mailbox];
  const scope = T(lang, "{n} kiküldött e-mail az időszakban", { n: c.sent });
  const facts =
    `<div class="kf-facts"><span><b>${c.sent}</b> ${esc(T(lang, "kiküldött e-mail az időszakban"))}</span>` +
    `<span>${esc(T(lang, "csak e-mail · első megkeresés · [TESZT] nélkül · postafiók: {m}", { m: mbName }))}</span>` +
    `<span>${esc(T(lang, "levélnyitás-követés {since} óta:", { since: d.mailSince ? d.mailSince.slice(5) : "—" }))} <b>${c.mailTracked}</b> ${esc(T(lang, "levél"))}</span></div>`;
  const emptyBox =
    `<div class="kf-empty">${icAdmin("inbox", 22)}<h4>${esc(T(lang, "Ebben a szűrésben nem ment ki levél"))}</h4>` +
    `<p>${esc(T(lang, "A fa az első kiküldés után telik meg — addig nincs mit mérni, ezért nullát sem mutatunk."))}</p>` +
    `<a class="citui-btn citui-btn--dark" href="${esc(href({ ctry: null, mb: null }))}#kf">${esc(T(lang, "Ország és postafiók: Mind"))}</a>` +
    `<a class="citui-btn citui-btn--ghost" href="${esc(href({ days: "0", from: null, to: null }))}#kf">${esc(T(lang, "Időszak: Összes"))}</a>` +
    `<div class="kf-ghost">${TREE_STATES.map((s) => `<span>${s.n}</span>`).join("")}</div></div>`;
  const body = empty
    ? emptyBox
    : `<div data-kf-pane="tree"${opts.view === "tree" ? "" : " hidden"}>${treeView(d, t, sel, href, lang)}</div>` +
      `<div data-kf-pane="tasks"${opts.view === "tasks" ? "" : " hidden"}>${tasksView(t, href, lang)}</div>`;
  return (
    `<details class="panel kf" id="kf" open data-kf-sel="${esc(sel)}"><summary class="kf-head"><div class="kf-head__in">` +
    `<div class="kf-head__ttl">${esc(T(lang, "Konverziós mechanizmusfa"))} <span class="rp-q">${esc(T(lang, "— hol vész el a lead, miért, és mivel javítjuk"))}</span> ${helpLink("console.report_tree")}</div>` +
    `<div class="kf-head__sum">${esc(sum)}</div></div>${icAdmin("chevron-down", 18)}</summary>` +
    `<div class="kf-body">${filters(d, t, opts.view, href, lang)}${empty ? "" : facts}${body}${empty ? "" : measureLog(d, t, scope, lang)}</div>` +
    `<script>${TREE_JS}</script></details>`
  );
}

/**
 * Instant branch / view switch (the links work without it). No animation: the panel is swapped, the
 * selection re-marked, the URL updated in place; on a narrow section the opened panel is scrolled into
 * view without smooth scrolling.
 */
const TREE_JS =
  `(function(){var s=document.getElementById('kf');if(!s)return;` +
  `function setQ(k,v){var u=new URL(location.href);if(v===null)u.searchParams.delete(k);else u.searchParams.set(k,v);history.replaceState(null,'',u.pathname+'?'+u.searchParams.toString()+'#kf')}` +
  `function sel(k,scroll){s.dataset.kfSel=k;s.querySelectorAll('[data-kf-panel]').forEach(function(p){p.hidden=p.dataset.kfPanel!==k});` +
  `s.querySelectorAll('.kf-dchip').forEach(function(c){var on=c.dataset.kfSel===k;c.classList.toggle('on',on);c.setAttribute('aria-pressed',String(on))});` +
  `s.querySelectorAll('.kf-drop').forEach(function(p){var on=p.parentNode.getAttribute('data-kf-sel')===k;p.classList.toggle('sel',on);var h=p.getAttribute('data-kf-hatch');if(h)p.setAttribute('fill','url(#kfHatch'+(on?'Sel':'')+h+')')});` +
  `setQ('fa',k);var p=s.querySelector('[data-kf-panel="'+k+'"]');if(p&&scroll)p.scrollIntoView({block:'nearest'})}` +
  `function view(v){s.querySelectorAll('[data-kf-pane]').forEach(function(p){p.hidden=p.dataset.kfPane!==v});` +
  `s.querySelectorAll('[data-kf-view]').forEach(function(a){var on=a.dataset.kfView===v;a.classList.toggle('on',on);if(on)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current')});setQ('nezet',v==='tasks'?'feladatok':null)}` +
  `s.addEventListener('click',function(e){var a=e.target.closest('[data-kf-goto]');if(a){e.preventDefault();view('tree');sel(a.dataset.kfGoto,true);return}` +
  `a=e.target.closest('[data-kf-view]');if(a){e.preventDefault();view(a.dataset.kfView);return}` +
  `a=e.target.closest('[data-kf-sel]');if(a&&a!==s){e.preventDefault();sel(a.getAttribute('data-kf-sel'),s.querySelector('.kf-body').clientWidth<720)}})})()`;
