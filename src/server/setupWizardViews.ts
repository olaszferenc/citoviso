// ADR-0429 — the setup surfaces: the first-login wizard (full screen), the module tiles on the
// Modulok tab, the overview strip, the step panel embedded in a module page, and the bar that
// leads back to the walk from a page the walk opened.
// Approved plan (the contract): assets/design-refs/tenant-admin/modul-statusz/ (README = what binds).
//
// Colours, fonts and radii come only from the --citui-* tokens (ADR-0021 ①).

import { icAdmin as ic } from "../ui/icons.js";
import { T } from "../i18n/mail.js";
import { SHRINK_JS } from "../tenant/photoUpload.js";
import type { SetupState, TopicLock } from "../tenant/moduleSetup.js";

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** One topic as every surface shows it. */
export interface WalkItem {
  readonly id: string;
  readonly title: string;
  readonly icon: string;
  readonly group: "booking" | "page";
  readonly st: SetupState;
  readonly line: string;
  readonly lock: TopicLock | null;
  /** Kész / Ön döntött így, or an optional topic the owner skipped. */
  readonly passed: boolean;
  readonly skipped: boolean;
  /** Where the topic's own page lives (tile click). */
  readonly href: string;
  /** Part of the walk with embedded steps (else: a page that returns). */
  readonly steps: boolean;
}

export function stateLabel(st: SetupState, lang: string): string {
  return st === "done"
    ? T(lang, "Kész")
    : st === "part"
      ? T(lang, "Félkész")
      : st === "miss"
        ? T(lang, "Hiányzik")
        : st === "decl"
          ? T(lang, "Ön döntött így")
          : T(lang, "Nem kötelező");
}
const chip = (st: SetupState, lang: string): string => `<span class="sw-chip sw-chip--${st}"><i></i>${stateLabel(st, lang)}</span>`;
const sic = (st: SetupState): string => `<span class="sw-sic sw-sic--${st}">${st === "done" || st === "decl" ? ic("check", 12) : ""}</span>`;

export const SW_STYLE = `<style>
.sw{--sw-gap:16px;container-type:inline-size;padding-bottom:var(--citui-consent-h,0px);font:14px/1.45 var(--citui-font-text);color:var(--citui-ink)}
.sw a:not([class]),.sw .sw-help{color:var(--citui-link-ink)}
.sw a svg,.sw summary svg,.sw .sw-btn svg{display:inline-block;vertical-align:-3px}
.sw-top{display:flex;align-items:center;gap:8px;min-height:56px;padding:0 16px;border-bottom:1px solid var(--citui-line);background:var(--citui-panel)}
.sw-top b{font-weight:600}.sw-sp{flex:1}
.sw-muted{color:var(--citui-muted)}
.sw .sw-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;padding:8px 14px;border:1px solid var(--citui-line-strong);border-radius:8px;background:var(--citui-panel);color:var(--citui-ink);font:inherit;font-weight:500;cursor:pointer;text-decoration:none}
.sw .sw-btn:hover{background:var(--citui-hover)}
.sw .sw-btn--p{background:var(--citui-cyan-500);border-color:var(--citui-cyan-500);color:var(--citui-accent-ink);font-weight:600}
.sw .sw-btn--p:hover{background:var(--citui-cyan-400)}
.sw .sw-btn--ghost{border-color:transparent;background:transparent}
.sw-btn--lg{min-height:48px;padding:10px 20px;font-size:15px}
.sw-prog{padding:10px 16px 0}
.sw-prog summary{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:var(--citui-muted);cursor:pointer;list-style:none}
.sw-prog summary::-webkit-details-marker{display:none}
.sw-down{display:inline-block;transform:rotate(90deg)}
.sw-prog details[open] .sw-down{transform:rotate(-90deg)}
.sw-prog summary b{color:var(--citui-link-ink);font-weight:600;white-space:nowrap}
.sw-bar{height:6px;border-radius:999px;background:var(--citui-hover);overflow:hidden;margin-top:6px}
.sw-bar>i{display:block;height:100%;background:var(--citui-ok);border-radius:999px}
.sw-grid3{display:grid;gap:var(--sw-gap);padding:12px 16px 32px}
.sw-rail ol{list-style:none;margin:0;padding:0}
.sw-rail li{margin:2px 0}
.sw-rail a,.sw-rail .sw-rl{display:flex;gap:10px;align-items:flex-start;padding:7px 6px;border-radius:6px;color:var(--citui-muted);text-decoration:none}
.sw-rail a:hover{background:var(--citui-hover)}
.sw-rail .on,.sw-rail .on .sw-rl{color:var(--citui-ink);font-weight:600}
.sw-rail .ok,.sw-rail .ok a,.sw-rail .ok .sw-rl{color:var(--citui-ok-ink)}
.sw-rail b{flex:none;width:22px;height:22px;border-radius:50%;border:1.5px solid currentColor;display:inline-flex;align-items:center;justify-content:center;font-size:11px}
.sw-rail .on b{border-color:var(--citui-cyan-500);background:var(--citui-accent-soft)}
.sw-rail .ok b{background:var(--citui-ok);border-color:var(--citui-ok);color:var(--citui-on-ok)}
.sw-rail .lk b,.sw-rail .op b{border-style:dashed}
.sw-rail small{display:block;font-weight:400;font-size:12px;color:var(--citui-muted)}
.sw-rail--m{margin-top:8px;border:1px solid var(--citui-line);border-radius:8px;padding:6px 8px;background:var(--citui-panel)}
.sw-h{margin:0 0 6px;font:600 20px/1.3 var(--citui-font-display)}
.sw-kick{font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--citui-muted)}
.sw-q h1{font:600 22px/1.25 var(--citui-font-display);margin:6px 0}
.sw-lead{font-size:15px;color:var(--citui-muted);margin:0 0 14px}
.sw-opt{display:flex;gap:10px;align-items:flex-start;padding:12px;border:1px solid var(--citui-line-strong);border-radius:8px;margin:8px 0;cursor:pointer;background:var(--citui-panel)}
.sw-opt:hover{background:var(--citui-hover)}
.sw-opt:has(input:checked),.sw-opt.on{border-color:var(--citui-cyan-500);background:var(--citui-accent-soft)}
.sw-opt--fixed{cursor:default}
.sw-opt input{margin-top:3px}
.sw-opt b{display:block;font-weight:600}
.sw-opt small{display:block;color:var(--citui-muted);font-size:12px}
.sw-grid{display:grid;gap:0 10px}
@container (min-width:700px){.sw-grid{grid-template-columns:1fr 1fr}}
.sw-field{display:block;margin:10px 0}
.sw-field>span{display:block;font-weight:600;margin-bottom:4px}
.sw-field :is(input,select,textarea):focus,.sw-opt:has(input:focus-visible){outline:none;border-color:var(--citui-cyan-500);box-shadow:0 0 0 3px color-mix(in srgb,var(--citui-cyan-500) 22%,transparent)}
.sw-field input,.sw-field select,.sw-field textarea{width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid var(--citui-line-strong);border-radius:8px;background:var(--citui-field);color:var(--citui-ink);font:inherit;font-size:15px}
.sw-hint{font-size:12px;color:var(--citui-muted);margin:6px 0}
.sw-ok{color:var(--citui-ok-ink)}.sw-err{color:var(--citui-bad-ink)}
.sw-msg{border-radius:8px;padding:10px 12px;margin:0 0 12px}
.sw-msg--err{border:1px solid color-mix(in srgb,var(--citui-bad) 40%,transparent);background:color-mix(in srgb,var(--citui-bad) 8%,transparent);color:var(--citui-bad-ink)}
.sw-msg--ok{border:1px solid color-mix(in srgb,var(--citui-ok) 40%,transparent);background:var(--citui-ok-soft);color:var(--citui-ok-ink)}
.sw-box{border:1px solid var(--citui-line);border-radius:8px;padding:12px;background:var(--citui-surface);margin:8px 0}
.sw-box--ok{border-color:color-mix(in srgb,var(--citui-ok) 45%,transparent);background:var(--citui-ok-soft)}
.sw-box--warn{border-color:color-mix(in srgb,var(--citui-warn) 45%,transparent);background:color-mix(in srgb,var(--citui-warn) 10%,transparent)}
.sw-foot{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:18px;padding-top:14px;border-top:1px solid var(--citui-line)}
.sw-foot .sw-next{order:9;margin-left:auto}
@container (max-width:899px){.sw-foot .sw-next{order:-1;width:100%;margin-left:0}}
.sw-chip{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;border-radius:999px;padding:2px 8px;white-space:nowrap}
.sw-chip i{width:7px;height:7px;border-radius:50%;background:currentColor}
.sw-chip--done,.sw-chip--decl{color:var(--citui-ok-ink);background:var(--citui-ok-soft)}
.sw-chip--part{color:var(--citui-warn-ink);background:color-mix(in srgb,var(--citui-warn) 16%,transparent)}
.sw-chip--miss{color:var(--citui-bad-ink);background:color-mix(in srgb,var(--citui-bad) 12%,transparent)}
.sw-chip--opt{color:var(--citui-muted);background:var(--citui-hover)}
.sw-sic{flex:none;width:18px;height:18px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center}
.sw-sic--done,.sw-sic--decl{background:var(--citui-ok);color:var(--citui-on-ok)}
.sw-sic--part{border:2px solid var(--citui-warn);background:linear-gradient(90deg,var(--citui-warn) 50%,transparent 50%)}
.sw-sic--miss{border:2px dashed var(--citui-bad)}
.sw-sic--opt{border:2px solid var(--citui-line-strong)}
.sw-pv{border:1px solid var(--citui-line);border-radius:10px;padding:14px;background:var(--citui-panel)}
.sw-pv__u{display:grid;grid-template-columns:1fr auto;gap:2px 8px;padding:6px 0;border-bottom:1px solid var(--citui-line);font-size:13px}
.sw-pv__u span{color:var(--citui-muted);text-align:right}
.sw-pv .sw-miss{color:var(--citui-bad-ink)}
.sw-pvm{margin-top:12px}
.sw-pvm summary{cursor:pointer;color:var(--citui-link-ink);font-weight:600;list-style:none;text-align:center}
.sw-desk{display:none}
@container (min-width:900px){
  .sw-mob{display:none}
  .sw-desk{display:block}
  .sw-grid3{grid-template-columns:230px minmax(0,1fr) 300px;gap:28px;padding:28px 32px}
  .sw-top{padding:0 32px}
}
/* ── tiles (Modulok tab) ── */
.sw-tiles{display:grid;gap:8px;margin:8px 0 18px}
@container (min-width:900px){.sw-tiles{grid-template-columns:repeat(3,1fr);gap:12px}}
.sw-gh{font-size:12px;font-weight:600;color:var(--citui-muted);text-transform:uppercase;letter-spacing:.04em;margin:16px 0 4px}
.sw .sw-tile{display:flex;gap:12px;padding:14px;border:1px solid var(--citui-line);border-left-width:4px;border-radius:8px;background:var(--citui-panel);color:var(--citui-ink);text-decoration:none}
.sw .sw-tile:hover{background:var(--citui-hover)}
.sw-tile,.sw-tile *,.sw-band,.sw-band *,.sw-pill{text-decoration:none!important}
.sw-tile--miss{border-left-color:var(--citui-bad)}
.sw-tile--part{border-left-color:var(--citui-warn)}
.sw-tile--done,.sw-tile--decl{border-left-color:var(--citui-ok)}
.sw-tile--opt{border-left-color:var(--citui-line-strong)}
.sw-tile--lock{border-left-style:dashed;border-left-color:var(--citui-line-strong);background:var(--citui-surface)}
.sw-tile__ic{flex:none;width:36px;height:36px;border-radius:8px;background:var(--citui-hover);display:flex;align-items:center;justify-content:center}
.sw-tile__b{display:flex;flex-direction:column;gap:4px;align-items:flex-start;min-width:0}
.sw-tile__t{font-weight:600}
.sw-tile__l{color:var(--citui-muted);font-size:12px}
.sw-tile__c{color:var(--citui-link-ink);font-weight:600;font-size:13px}
/* ── overview strip ── */
.sw .sw-band{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:12px 16px;border:1px solid var(--citui-cyan-500);border-radius:8px;background:var(--citui-accent-soft);margin:0 0 14px;color:var(--citui-ink);text-decoration:none}
.sw .sw-band--quiet{border-color:var(--citui-line);background:var(--citui-panel)}
.sw-band>div{flex:1 1 240px}
.sw-strip{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:14px 16px;border:1px solid var(--citui-line);border-radius:8px;background:var(--citui-panel);margin:0 0 14px}
.sw-strip>div{flex:1 1 260px}
.sw-chips{display:flex;flex-wrap:wrap;gap:6px;flex:1 1 100%}
.sw .sw-pill{display:inline-flex;gap:6px;align-items:center;border:1px solid var(--citui-line-strong);border-radius:999px;padding:4px 10px 4px 5px;color:var(--citui-ink);text-decoration:none;font-size:13px;background:var(--citui-panel)}
/* ── embedded panel + return bar ── */
.sw-panel{border:1px solid var(--citui-cyan-500);border-radius:8px;padding:12px 14px;margin:0 0 14px;background:var(--citui-panel);box-shadow:0 0 0 3px var(--citui-accent-soft)}
.sw-panel h2{font:600 17px/1.3 var(--citui-font-display);margin:6px 0}
.sw-panel__h{display:flex;align-items:center;gap:8px}
.sw-resume{display:flex;gap:10px;align-items:center;padding:10px 14px;border:1px solid var(--citui-line);border-radius:8px;margin:0 0 14px;background:var(--citui-panel)}
.sw-return{position:sticky;top:0;z-index:20;display:flex;gap:10px;align-items:center;padding:10px 14px;margin:0 0 14px;border-radius:8px;background:var(--citui-navy-900);color:var(--citui-ink-inverse)}
.sw-return .sw-btn{margin-left:auto}
</style>`;

// ── shared bits ─────────────────────────────────────────────────────────────────────
export function helpHref(kb: string): string {
  return `/admin?tab=sugo&amp;topic=${encodeURIComponent(kb)}`;
}

function railHtml(items: readonly WalkItem[], currentId: string | null, lang: string): string {
  return `<ol>${items
    .map((x, i) => {
      const cls = x.id === currentId ? "on" : x.passed && x.st !== "opt" ? "ok" : x.lock ? "lk" : x.st === "opt" ? "op" : "";
      const sub =
        x.id === currentId ? "" : x.lock ? esc(x.lock.why) : x.passed && x.st !== "opt" ? T(lang, "Kész — szerkeszthető") : x.st === "opt" ? (x.skipped ? T(lang, "Kihagyva — nem kötelező") : T(lang, "Nem kötelező")) : "";
      const mark = x.passed && x.st !== "opt" && x.id !== currentId ? ic("check", 12) : x.lock ? ic("lock", 11) : String(i + 1);
      const inner = `<b>${mark}</b><span>${esc(x.title)}${sub ? `<small>${sub}</small>` : ""}</span>`;
      return `<li class="${cls}">${x.lock || x.id === currentId ? `<span class="sw-rl">${inner}</span>` : `<a href="/admin/beallitas?t=${encodeURIComponent(x.id)}">${inner}</a>`}</li>`;
    })
    .join("")}</ol>`;
}

export interface PreviewUnit {
  readonly name: string;
  readonly cap: number | null;
  /** null = the price is not asked on this site (no pricing module). */
  readonly price: string | null;
  readonly priceMissing: boolean;
}
export interface PreviewData {
  readonly siteName: string;
  readonly host: string;
  readonly lettingKnown: boolean;
  readonly roomsHidden: boolean;
  readonly units: readonly PreviewUnit[];
  readonly withHouse: boolean;
  readonly askCap: boolean;
  readonly hours: string | null;
  readonly hoursMissing: boolean;
  readonly calendarLine: string | null;
  readonly cta: string;
}
export function previewHtml(p: PreviewData, lang: string): string {
  const units = !p.lettingKnown
    ? `<p class="sw-miss sw-hint">${T(lang, "Még nem tudni: a házat vagy egy szobát foglal?")}</p>`
    : p.roomsHidden
      ? `<p class="sw-miss sw-hint">${T(lang, "A szobák a Szobák modul nélkül nem látszanak — a vendég az egész szállásra kér időpontot.")}</p>`
      : p.units
          .map(
            (u) =>
              `<div class="sw-pv__u"><b>${esc(u.name)}</b><span>${
                p.askCap ? (u.cap ? T(lang, "max. {n} fő", { n: u.cap }) : `<span class="sw-miss">${T(lang, "férőhely: —")}</span>`) : ""
              }</span>${u.price !== null ? `<span></span><span${u.priceMissing ? ' class="sw-miss"' : ""}>${esc(u.price)}</span>` : ""}</div>`,
          )
          .join("") + (p.withHouse ? `<p class="sw-hint">${T(lang, "+ az egész ház egyben (árajánlat)")}</p>` : "");
  return (
    `<div class="sw-kick">${T(lang, "Így látja a vendég")} · ${esc(p.host)}</div><div class="sw-pv"><b>${esc(p.siteName)}</b>${units}` +
    (p.calendarLine ? `<p class="sw-hint">${esc(p.calendarLine)}</p>` : "") +
    (p.hours !== null ? `<p class="sw-hint${p.hoursMissing ? " sw-miss" : ""}">${esc(p.hours)}</p>` : "") +
    `<span class="sw-btn sw-btn--p" style="width:100%;margin-top:8px">${esc(p.cta)}</span></div>`
  );
}

// ── the wizard ──────────────────────────────────────────────────────────────────────
export interface WizardStepView {
  readonly topicId: string;
  readonly topicTitle: string;
  readonly index: number;
  readonly count: number;
  readonly question: string;
  readonly lead: string;
  readonly fieldsHtml: string;
  readonly kb: string;
  readonly st: SetupState;
  /** "Vissza: <previous topic>" on the first question, or plain "Vissza". null = no back. */
  readonly backLabel: string | null;
  /** A page topic: the walk opens this href and comes back. */
  readonly pageHref: string | null;
  readonly pageLabel: string | null;
  readonly last: boolean;
  /** The step uploads photos in the browser (client script). */
  readonly upload: boolean;
}

export function setupWizardPage(o: {
  readonly lang: string;
  readonly items: readonly WalkItem[];
  readonly step: WizardStepView | null;
  readonly error: string | null;
  readonly notice: string | null;
  readonly preview: string;
  readonly guestLine: string;
}): string {
  const { lang, items, step } = o;
  const passed = items.filter((x) => x.passed).length;
  const pos = step ? items.findIndex((x) => x.id === step.topicId) : -1;
  const pct = items.length ? Math.round(((passed + (step ? (step.index + 1) / step.count : 0)) / items.length) * 100) : 100;
  const top =
    `<div class="sw-top"><b>${T(lang, "Állítsuk be együtt")}</b><span class="sw-muted sw-desk">&nbsp;· ${T(lang, "{n} téma — az összes megvett modul", { n: items.length })}</span><span class="sw-sp"></span>` +
    `<a class="sw-help" data-kb-anchor="admin.setup.wizard" href="/admin?tab=sugo&amp;topic=admin.setup.wizard" title="${T(lang, "Súgó")}">${ic("help", 18)}</a>` +
    `<form method="POST" action="/admin/beallitas"><input type="hidden" name="act" value="later"><button class="sw-btn sw-btn--ghost" type="submit">${T(lang, "Később folytatom")}</button></form></div>`;
  const msg =
    (o.error ? `<div class="sw-msg sw-msg--err" role="alert">${esc(o.error)}</div>` : "") +
    (o.notice ? `<div class="sw-msg sw-msg--ok" role="status">${esc(o.notice)}</div>` : "");
  if (!step) {
    const waiting = items.filter((x) => !x.passed && x.lock);
    const body = waiting.length
      ? `<div class="sw-box sw-box--warn"><h1 class="sw-h">${T(lang, "Ezek még várnak")}</h1>${waiting.map((x) => `<div><b>${esc(x.title)}</b> — ${esc(x.lock!.why)}</div>`).join("")}</div>`
      : `<div class="sw-box sw-box--ok"><h1 class="sw-h">${T(lang, "Kész — minden témán végigment.")}</h1>${esc(o.guestLine)}</div>`;
    return (
      SW_STYLE +
      `<div class="sw">${top}<div class="sw-grid3"><nav class="sw-rail sw-desk" aria-label="${T(lang, "Témák")}">${railHtml(items, null, lang)}</nav>` +
      `<main class="sw-q">${msg}${body}<p class="sw-hint">${T(lang, "Bármelyik témára kattintva újra szerkesztheti.")}</p>` +
      `<div class="sw-mob sw-rail sw-rail--m">${railHtml(items, null, lang)}</div>` +
      `<p><a class="sw-btn sw-btn--p sw-btn--lg" href="/admin">${T(lang, "Tovább a honlapom adminjába")}</a></p></main>` +
      `<aside class="sw-desk">${o.preview}</aside></div></div>`
    );
  }
  const prog =
    `<div class="sw-prog sw-mob"><details><summary><span>${T(lang, "{i}. téma / {n} · {t} · {s}/{c}", { i: pos + 1, n: items.length, t: step.topicTitle, s: step.index + 1, c: step.count })}</span><b>${T(lang, "Témák")} <span class="sw-down">${ic("fwd", 12)}</span></b></summary>` +
    `<div class="sw-rail sw-rail--m">${railHtml(items, step.topicId, lang)}</div></details><div class="sw-bar"><i style="width:${pct}%"></i></div></div>`;
  const opt = step.st === "opt";
  const fields = step.pageHref
    ? `<div class="sw-box">${T(lang, "Ezt a meglévő „{p}” lapon állítja be — megnyitjuk, és onnan ide tér vissza a következő témához.", { p: step.pageLabel ?? "" })}</div>` +
      `<p><a class="sw-btn sw-btn--p" href="${esc(step.pageHref)}">${T(lang, "Megnyitom: {p}", { p: step.pageLabel ?? "" })}</a></p>`
    : step.fieldsHtml;
  const form =
    `<form method="POST" action="/admin/beallitas" class="sw-form"${step.upload ? " data-sw-up" : ""}>` +
    `<input type="hidden" name="t" value="${esc(step.topicId)}"><input type="hidden" name="s" value="${step.index}">` +
    (opt ? chip("opt", lang) : "") +
    `<div class="sw-kick">${esc(step.topicTitle)} · ${T(lang, "{i}. kérdés / {n}", { i: step.index + 1, n: step.count })}</div>` +
    `<h1>${esc(step.question)}</h1><p class="sw-lead">${esc(step.lead)}</p>${msg}${fields}` +
    `<p class="sw-hint"><a href="${helpHref(step.kb)}">${ic("help", 14)} ${T(lang, "Részletesen a súgóban")}</a></p>` +
    `<div class="sw-foot">` +
    `<button class="sw-btn sw-btn--p sw-btn--lg sw-next" type="submit" name="act" value="next">${step.pageHref ? T(lang, "Tovább") : step.last ? T(lang, "Mentés, tovább") : T(lang, "Tovább")}</button>` +
    (step.backLabel ? `<button class="sw-btn sw-btn--ghost" type="submit" name="act" value="back" formnovalidate>${ic("back", 16)}${esc(step.backLabel)}</button>` : "") +
    `<button class="sw-btn sw-btn--ghost" type="submit" name="act" value="skip" formnovalidate>${opt ? T(lang, "Most kihagyom") : T(lang, "Kihagyom")}</button>` +
    `</div></form>`;
  return (
    SW_STYLE +
    `<div class="sw">${top}${prog}<div class="sw-grid3">` +
    `<nav class="sw-rail sw-desk" aria-label="${T(lang, "Témák")}">${railHtml(items, step.topicId, lang)}</nav>` +
    `<main class="sw-q">${form}<details class="sw-pvm sw-mob"><summary>${ic("preview", 16)} ${T(lang, "Így látja a vendég")}</summary><div style="margin-top:8px">${o.preview}</div></details></main>` +
    `<aside class="sw-desk">${o.preview}</aside></div></div>` +
    (step.upload ? uploadScript(lang) : "")
  );
}

/** The photo step uploads in the browser through the existing /admin/photos (ADR-0198 rules). */
function uploadScript(lang: string): string {
  const j = (s: string): string => JSON.stringify(s);
  return (
    `<script>${SHRINK_JS}(function(){var box=document.querySelector("[data-sw-upload]");if(!box)return;` +
    `var msg=box.querySelector("[data-sw-upmsg]");` +
    `box.addEventListener("click",function(e){var b=e.target.closest("[data-sw-pick]");if(!b)return;` +
    `box.querySelector(b.getAttribute("data-sw-pick")==="cam"?"[data-sw-cam]":"[data-sw-file]").click()});` +
    `function read(f){return new Promise(function(res,rej){var r=new FileReader();r.onload=function(){res(r.result)};r.onerror=rej;r.readAsDataURL(f)})}` +
    `box.addEventListener("change",async function(e){var files=[].slice.call(e.target.files||[]).slice(0,12);if(!files.length)return;` +
    `msg.textContent=${j(T(lang, "Feltöltés…"))};var ok=0,bad=[];` +
    `for(var i=0;i<files.length;i++){var f=files[i];if(["image/jpeg","image/png","image/webp"].indexOf(f.type)<0){bad.push(f.name+" — "+${j(T(lang, "nem kép (JPEG, PNG vagy WEBP kell)"))});continue}` +
    `try{var b=await citShrink(f);if(b.size>6000000){bad.push(f.name+" — "+${j(T(lang, "a legnagyobb feltölthető méret 6 MB"))});continue}` +
    `var r=await (await fetch("/admin/photos",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({images:[{dataUrl:await read(b),name:f.name,alt:""}]})})).json();` +
    `ok+=(r&&r.count)||0;(r&&r.errors||[]).forEach(function(x){bad.push((x.file?x.file+" — ":"")+x.reason)})}catch(err){bad.push(f.name+" — "+${j(T(lang, "a feltöltés nem sikerült"))})}}` +
    `if(ok){location.href="/admin/beallitas?t=gallery&ok="+ok}else{msg.textContent=bad.join(" · ")}});})();</script>`
  );
}

// ── tiles ───────────────────────────────────────────────────────────────────────────
export function setupTilesSection(o: { readonly lang: string; readonly items: readonly WalkItem[]; readonly guestLine: string }): string {
  const { lang } = o;
  const counted = o.items.filter((x) => x.st !== "opt");
  const done = counted.filter((x) => x.st === "done" || x.st === "decl").length;
  const tile = (x: WalkItem): string => {
    if (x.lock && (x.st === "miss" || x.st === "part")) {
      const to = x.lock.need ? x.href : `/admin/beallitas?t=${encodeURIComponent(x.lock.first ?? "letting")}`;
      return (
        `<a class="sw-tile sw-tile--lock" href="${esc(to)}" data-setup-tile="${esc(x.id)}"><span class="sw-tile__ic">${ic("lock", 18)}</span><span class="sw-tile__b">` +
        `<span class="sw-tile__t">${esc(x.title)}</span><span class="sw-chip sw-chip--opt"><i></i>${T(lang, "Vár")}</span><span class="sw-tile__l">${esc(x.line)}</span><span class="sw-tile__c">${esc(x.lock.why)} ›</span></span></a>`
      );
    }
    const open = x.st === "miss" || x.st === "part";
    const cta = open ? (x.steps ? T(lang, "Beállítom lépésenként") : T(lang, "Megnyitom")) : "";
    const href = x.steps ? `/admin/beallitas?t=${encodeURIComponent(x.id)}` : x.href;
    return (
      `<a class="sw-tile sw-tile--${x.st}" href="${esc(href)}" data-setup-tile="${esc(x.id)}"><span class="sw-tile__ic">${ic(x.icon, 18)}</span><span class="sw-tile__b">` +
      `<span class="sw-tile__t">${esc(x.title)}</span>${chip(x.st, lang)}<span class="sw-tile__l">${esc(x.line)}</span>${cta ? `<span class="sw-tile__c">${cta} ›</span>` : ""}</span></a>`
    );
  };
  const g = (k: "booking" | "page"): WalkItem[] => o.items.filter((x) => x.group === k);
  return (
    SW_STYLE +
    `<section class="sw" data-setup-tiles><h2 class="sw-gh">${T(lang, "Beállítás")} · ${T(lang, "{d} / {n} kész", { d: done, n: counted.length })}</h2>` +
    `<p class="sw-hint">${esc(o.guestLine)} <a href="/admin/beallitas">${T(lang, "Végigmegyek lépésenként")}</a></p>` +
    (g("booking").length ? `<h3 class="sw-gh">${T(lang, "Ami a foglaláshoz kell")}</h3><div class="sw-tiles">${g("booking").map(tile).join("")}</div>` : "") +
    (g("page").length ? `<h3 class="sw-gh">${T(lang, "Az oldal többi része")}</h3><div class="sw-tiles">${g("page").map(tile).join("")}</div>` : "") +
    `</section>`
  );
}

// ── overview strip ──────────────────────────────────────────────────────────────────
export function overviewSetupStrip(o: {
  readonly lang: string;
  readonly items: readonly WalkItem[];
  readonly next: WalkItem | null;
  readonly guestLine: string;
}): string {
  const { lang, items } = o;
  const passed = items.filter((x) => x.passed).length;
  const open = items.filter((x) => x.st === "miss" || x.st === "part");
  const left = passed < items.length;
  const band = left
    ? `<a class="sw-band" href="/admin/beallitas" data-setup-band><div><b>${T(lang, "Beállítás: {d} / {n} téma kész", { d: passed, n: items.length })}</b><div class="sw-muted">${o.next ? `${T(lang, "Következő:")} ${esc(o.next.title)} — ` : ""}${esc(o.guestLine)}</div></div><span class="sw-btn sw-btn--p">${T(lang, "Folytatom")}</span></a>`
    : `<a class="sw-band sw-band--quiet" href="/admin/beallitas?t=${encodeURIComponent(items[0]?.id ?? "")}" data-setup-band><div><b>${T(lang, "Beállítás: mind a {n} téma kész", { n: items.length })}</b><div class="sw-muted">${T(lang, "Bármelyiket lépésenként átnézheti vagy módosíthatja.")}</div></div><span class="sw-btn">${T(lang, "Beállítás átnézése")}</span></a>`;
  const strip = open.length
    ? `<section class="sw-strip" data-setup-strip><div><b>${T(lang, "{n} modul vár beállításra", { n: open.length })}</b><div class="sw-muted">${esc(o.guestLine)}</div></div>` +
      `<div class="sw-chips">${open.map((x) => `<a class="sw-pill" href="/admin/beallitas?t=${encodeURIComponent(x.id)}">${sic(x.st)}${esc(x.title)}</a>`).join("")}</div>` +
      `<a class="sw-btn" href="/admin?tab=modulok">${T(lang, "Modulok")} ›</a></section>`
    : "";
  return SW_STYLE + `<div class="sw">${band}${strip}</div>`;
}

// ── module page: embedded steps + the way back to the walk ─────────────────────────────
export function moduleStepPanel(o: {
  readonly lang: string;
  readonly item: WalkItem;
  readonly step: WizardStepView | null;
  readonly hidden: boolean;
  readonly moduleId: string;
  readonly error: string | null;
  readonly notice: string | null;
}): string {
  const { lang, item, step } = o;
  if (o.hidden || !step) {
    const label = item.passed ? T(lang, "Lépésenként is átnézheti.") : step ? T(lang, "{i}. kérdésnél tart.", { i: step.index + 1 }) : "";
    return (
      SW_STYLE +
      `<div class="sw"><form method="POST" action="/admin/beallitas" class="sw-resume" data-setup-panel="${esc(item.id)}"><input type="hidden" name="t" value="${esc(item.id)}"><input type="hidden" name="act" value="unhide"><input type="hidden" name="from" value="${esc(o.moduleId)}">` +
      `${sic(item.st)}<span><b>${esc(item.title)}</b> · ${stateLabel(item.st, lang)}. ${label}</span><span class="sw-sp"></span><button class="sw-btn" type="submit">${item.passed ? T(lang, "Átnézem") : T(lang, "Folytatom")}</button></form></div>`
    );
  }
  return (
    SW_STYLE +
    `<div class="sw"><section class="sw-panel" data-setup-panel="${esc(item.id)}"><form method="POST" action="/admin/beallitas">` +
    `<input type="hidden" name="t" value="${esc(step.topicId)}"><input type="hidden" name="s" value="${step.index}"><input type="hidden" name="from" value="${esc(o.moduleId)}">` +
    `<div class="sw-panel__h"><span class="sw-kick">${T(lang, "Lépésenként")} · ${esc(item.title)} · ${step.index + 1}/${step.count}</span><span class="sw-sp"></span>` +
    `<button class="sw-btn sw-btn--ghost" type="submit" name="act" value="hide" formnovalidate>${T(lang, "Elrejtem")}</button></div>` +
    `<h2>${esc(step.question)}</h2><p class="sw-lead">${esc(step.lead)}</p>` +
    (o.error ? `<div class="sw-msg sw-msg--err" role="alert">${esc(o.error)}</div>` : "") +
    (o.notice ? `<div class="sw-msg sw-msg--ok" role="status">${esc(o.notice)}</div>` : "") +
    step.fieldsHtml +
    `<div class="sw-foot"><button class="sw-btn sw-btn--p sw-next" type="submit" name="act" value="next">${step.last ? T(lang, "Mentés") : T(lang, "Tovább")}</button>` +
    (step.index > 0 ? `<button class="sw-btn sw-btn--ghost" type="submit" name="act" value="back" formnovalidate>${ic("back", 16)}${T(lang, "Vissza")}</button>` : "") +
    `</div></form></section></div>` +
    (step.upload ? uploadScript(lang) : "")
  );
}

/** A page the walk opened (`?vissza=varazslo`): the way back to the next topic. */
export function returnToWalkBar(lang: string, topicId: string): string {
  return (
    SW_STYLE +
    `<div class="sw"><form method="POST" action="/admin/beallitas" class="sw-return" data-setup-return><input type="hidden" name="t" value="${esc(topicId)}"><input type="hidden" name="act" value="returned">` +
    `<span>${T(lang, "Ezt a lapot a beállításból nyitotta meg.")}</span><button class="sw-btn sw-btn--p" type="submit">${T(lang, "Kész — vissza a beállításhoz")}</button></form></div>`
  );
}

/** The cart hand-off: the EXISTING module cart (/admin/modules) gets the full wanted set. */
export function cartHandoffPage(o: { readonly lang: string; readonly keep: readonly string[]; readonly add: readonly { id: string; name: string; price: string }[] }): string {
  const { lang } = o;
  return (
    SW_STYLE +
    `<div class="sw"><div class="sw-top"><b>${T(lang, "Kosár")}</b></div><div class="sw-grid3"><main class="sw-q">` +
    `<h1>${T(lang, "A kosárba tesszük")}</h1><p class="sw-lead">${T(lang, "A havi díjához adódik. Fizetés után a beállítás ott folytatódik, ahol abbahagyta.")}</p>` +
    o.add.map((m) => `<div class="sw-pv__u"><b>${esc(m.name)}</b><span>${esc(m.price)}</span></div>`).join("") +
    `<form method="POST" action="/admin/modules" data-sw-cart>` +
    [...o.keep, ...o.add.map((m) => m.id)].map((id) => `<input type="hidden" name="module" value="${esc(id)}">`).join("") +
    `<div class="sw-foot"><button class="sw-btn sw-btn--p sw-btn--lg sw-next" type="submit">${T(lang, "Tovább a fizetéshez")}</button>` +
    `<a class="sw-btn sw-btn--ghost" href="/admin/beallitas">${T(lang, "Mégse")}</a></div></form></main></div></div>`
  );
}
