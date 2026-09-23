// SEVERAL PLANS ON ONE TRACKED LINK — what the console layers onto the served
// prospect page when the curator released 2–3 plans (approved contract, 2026-09-23:
// assets/design-refs/prospect-page/plan-tabs/README.md — the numbers below, §N,
// refer to it).
//
// Three pieces, all IN FLOW (never sticky, never floating — §B.6):
//   · the THIN framing bar: the tracked bar's three statements on one flowing line,
//     plus the plan switcher (picture chips, numbered) — replaces the tracked bar on
//     a multi-plan page only;
//   · the END-OF-PAGE block: "Tetszett? Nézze meg a másik kettőt is.", offering the
//     OTHER plans, above the legal footer (which stays the page's last word);
//   · the one-time NUDGE script (finite, per-session capped — §D).
//
// A single-plan page never reaches this module (§A.1, owner's ruling 2026-09-23:
// the single-plan page keeps today's bar).
//
// Lives in its own module, like prospectNotice.ts, so the guard can run the real
// functions on real templates without booting the server.

import { slugify } from "../domains.js";
import { T } from "../i18n/mail.js";
import { appendToBody, prependToBody, trackedBarParts } from "./prospectNotice.js";

/** What the page knows about one plan when it renders the switcher. */
export interface SwitcherPlan {
  /** 1-based display number = the /v/<n> path segment. */
  readonly n: number;
  /** Whether a cached hero shot exists — the chip's picture. Without it the chip
   *  shows its number on the neutral ground; an <img> request never renders one. */
  readonly hasThumb: boolean;
}

export interface SwitcherInput {
  readonly token: string;
  readonly leadName: string;
  readonly lang: string | undefined;
  readonly plans: readonly SwitcherPlan[];
  /** The plan on screen. */
  readonly current: number;
  /** The view this page load belongs to. The switch links carry it, so a switch
   *  continues the visit instead of opening a new one (data.ts continueView). */
  readonly viewId?: string | null;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * The address of plan n, WITH the readable slug the letter's link carries: the lead
 * who switches must keep seeing their own business name in the address bar — the
 * trust signal draft.ts puts there on purpose. Plan 1 is the letter's own address.
 */
export function planHref(leadName: string, token: string, n: number, viewId?: string | null): string {
  const slug = slugify(leadName).slice(0, 40).replace(/-+$/, "");
  const base = slug ? `/p/${slug}/${token}` : `/p/${token}`;
  const path = n === 1 ? base : `${base}/v/${n}`;
  return viewId ? `${path}?s=${encodeURIComponent(viewId)}` : path;
}

/** The chip picture — served from the cached hero shot, never rendered on request. */
export function planThumbUrl(token: string, n: number): string {
  return `/p/${token}/v/${n}/thumb.jpg`;
}

// ── STYLE ─────────────────────────────────────────────────────────────────────
// Skin-independent (§B, framing §7): the page is an ENGINE-rendered mock that never
// loads citui.css, so --citui-* would not resolve. The values are the framing bar's
// own neutrals + the confirm cyan (design-token-lint ALLOW list, same reason).
//
// Every rule is scoped under an ID and restates what a template's global CSS could
// inherit into it (a{text-transform}, details{margin}, letter-spacing on body…):
// the framing contract §8 — the template's CSS may not take the bar's place.
const CSS =
  `<style data-cit-plans-css>` +
  `#cit-plans,#cit-plans *,#cit-plans-end,#cit-plans-end *{box-sizing:border-box;letter-spacing:normal;` +
  `text-transform:none;text-shadow:none;float:none}` +
  `#cit-plans{position:static;display:block;margin:0;background:#101216;color:#8a8f98;` +
  `font:400 12.5px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:7px 14px;text-align:center}` +
  `#cit-plans .citp-row{display:flex;flex-direction:column;align-items:center;gap:6px}` +
  `#cit-plans .citp-txt{margin:0;color:#8a8f98}` +
  `#cit-plans strong{color:#fff;font-weight:600}` +
  // ⛔ the <details> sits in a <div>, never a <p>: the parser closes a <p> before it
  // and "Miért kaptam?" falls out of the line (§B.4, measured).
  `#cit-plans details{display:inline-block;vertical-align:baseline;margin:0;padding:0;border:0;background:none}` +
  `#cit-plans details[open]{display:block}` +
  `#cit-plans summary{display:inline;cursor:pointer;color:#8a8f98;text-decoration:underline;` +
  `white-space:nowrap;list-style:none;margin-left:4px;font:inherit}` +
  `#cit-plans summary::-webkit-details-marker{display:none}` +
  `#cit-plans summary::after{content:" \\25BE"}` +
  `#cit-plans details[open] summary::after{content:" \\25B4"}` +
  `#cit-plans .citp-why{display:block;max-width:78ch;margin:6px auto 2px;text-align:left;line-height:1.6}` +
  `#cit-plans .citp-why a{color:#8a8f98;text-decoration:underline}` +
  `#cit-plans nav{display:flex;align-items:center;gap:7px;white-space:nowrap;margin:0;padding:0;background:none}` +
  `#cit-plans .citp-lbl{color:#e8e9ec;white-space:normal;line-height:1.25}` +
  `#cit-plans .citp-lbl b{color:#fff;font-weight:700}` +
  `#cit-plans nav a{position:relative;display:block;width:60px;height:40px;border-radius:7px;overflow:hidden;` +
  `border:2px solid #2c323c;background:#1a1e25 center/cover no-repeat;text-decoration:none;padding:0;margin:0;` +
  `transition:transform .15s ease,border-color .15s ease}` +
  `#cit-plans nav a:hover{border-color:#8a8f98;transform:translateY(-1px)}` +
  `#cit-plans nav a span{position:absolute;left:3px;bottom:3px;min-width:17px;height:17px;padding:0 4px;` +
  `border-radius:5px;background:rgba(0,0,0,.78);color:#fff;font:700 11.5px/17px system-ui,sans-serif;text-align:center}` +
  `#cit-plans nav a[aria-current="page"]{border-color:#35c4e0;box-shadow:0 0 0 2px rgba(53,196,224,.35);cursor:default}` +
  `#cit-plans nav a[aria-current="page"] span{background:#35c4e0;color:#101216}` +
  // §D: the other plans lift and glow TWICE — finite by construction (iteration 2).
  `@keyframes citpNudge{0%,100%{transform:translateY(0);box-shadow:0 0 0 0 rgba(53,196,224,0)}` +
  `40%{transform:translateY(-2px) scale(1.14);box-shadow:0 0 0 5px rgba(53,196,224,.7),0 0 18px 4px rgba(53,196,224,.45)}}` +
  `#cit-plans nav.citp-nudge a:not([aria-current]){animation:citpNudge .9s ease 2}` +
  `#cit-plans nav.citp-nudge a:not([aria-current]):nth-of-type(3){animation-delay:.18s}` +
  `@media (prefers-reduced-motion:reduce){#cit-plans nav.citp-nudge a:not([aria-current]){animation:none;border-color:#35c4e0}}` +
  `@media (min-width:760px){` +
  `#cit-plans{padding:6px 20px;font-size:12px}` +
  `#cit-plans .citp-row{flex-direction:row;justify-content:center;align-items:center;gap:8px}` +
  `#cit-plans nav{flex:0 0 auto;gap:5px;padding-left:10px;border-left:1px solid #2c323c}` +
  `#cit-plans nav a{width:52px;height:32px}` +
  `#cit-plans .citp-lbl{max-width:7.6em;text-align:right;font-size:11.5px}}` +
  // §E — the end-of-page block
  `#cit-plans-end{position:static;display:block;margin:0;background:#101216;color:#e8e9ec;padding:34px 16px 30px;` +
  `text-align:center;font:400 14px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}` +
  `#cit-plans-end h2{margin:0 0 6px;padding:0;font:700 22px/1.25 system-ui,sans-serif;color:#fff;border:0;background:none}` +
  `#cit-plans-end h2 span{display:block;font-weight:500;color:#e8e9ec}` +
  `#cit-plans-end p{margin:0 auto 18px;max-width:34em;color:#8a8f98;font-size:13.5px;line-height:1.55}` +
  `#cit-plans-end .citp-cards{display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:900px;margin:0 auto}` +
  `#cit-plans-end .citp-cards.citp-one{grid-template-columns:minmax(0,440px);justify-content:center}` +
  `#cit-plans-end a{display:flex;flex-direction:column;text-decoration:none;color:#e8e9ec;border-radius:12px;` +
  `overflow:hidden;background:#1a1e25;border:1px solid #2c323c;transition:transform .15s ease,border-color .15s ease}` +
  `#cit-plans-end a:hover{transform:translateY(-2px);border-color:#35c4e0}` +
  `#cit-plans-end .citp-pv{display:block;aspect-ratio:4/3;background:#1a1e25 center top/cover no-repeat}` +
  `#cit-plans-end .citp-cap{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:10px 11px;` +
  `text-align:left;font:700 14px/1.2 system-ui,sans-serif;white-space:nowrap}` +
  `#cit-plans-end .citp-cta{display:inline-flex;align-items:center;gap:5px;color:#35c4e0;font-weight:600;font-size:13px}` +
  `#cit-plans-end .citp-cta svg{width:15px;height:15px}` +
  `@media (min-width:760px){` +
  `#cit-plans-end{padding:56px 40px 52px}` +
  `#cit-plans-end h2{font-size:30px}#cit-plans-end h2 span{display:inline}` +
  `#cit-plans-end p{font-size:15px;margin-bottom:26px}` +
  `#cit-plans-end .citp-cards{gap:22px}` +
  `#cit-plans-end .citp-pv{aspect-ratio:16/10}` +
  `#cit-plans-end .citp-cap{flex-direction:row;justify-content:space-between;align-items:center;padding:14px 16px;font-size:16px}` +
  `#cit-plans-end .citp-cta{font-size:14.5px}}` +
  `</style>`;

/** The arrow of "Megnézem →" — inline SVG, never an emoji (icon doctrine). */
const ARROW =
  `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ` +
  `stroke-linejoin="round" aria-hidden="true"><path d="M4 10h11M11 5.5l4.5 4.5L11 14.5"/></svg>`;

/** "Három tervet" / "Két tervet" — the count comes from the plans, never baked in (§C.7). */
function plansWord(lang: string | undefined, count: number): string {
  return count >= 3 ? T(lang, "Három tervet") : T(lang, "Két tervet");
}

/**
 * THE THIN FRAMING BAR with the plan switcher (§B, §C). Replaces the tracked bar on a
 * multi-plan page: same three statements, from the same constants (§B.5), on one line.
 */
export function injectPlanSwitcherBar(html: string, i: SwitcherInput): string {
  const parts = trackedBarParts(i.token);
  const chips = i.plans
    .map((p) => {
      const style = p.hasThumb ? ` style="background-image:url(${planThumbUrl(i.token, p.n)})"` : "";
      const cur = p.n === i.current ? ` aria-current="page"` : "";
      return (
        `<a href="${esc(planHref(i.leadName, i.token, p.n, i.viewId))}" aria-label="${esc(T(i.lang, "{n}. terv", { n: p.n }))}"` +
        `${cur}${style}><span>${p.n}</span></a>`
      );
    })
    .join("");
  const bar =
    CSS +
    `<div id="cit-plans" data-cit-framing="tracked" data-cit-plans="${i.plans.length}"><div class="citp-row">` +
    `<div class="citp-txt"><strong>${parts.headline}</strong> ${parts.made}` +
    `<details><summary>${esc(T(i.lang, "Miért kaptam?"))}</summary><span class="citp-why">${parts.why}</span></details></div>` +
    `<nav aria-label="${esc(T(i.lang, "Tervek"))}"><span class="citp-lbl">` +
    T(i.lang, "{plans} készítettünk:", { plans: `<b>${esc(plansWord(i.lang, i.plans.length))}</b>` }) +
    `</span>${chips}</nav></div></div>` +
    nudgeScript(i.token);
  return prependToBody(html, bar);
}

/** "Ez volt az 1. terv a háromból …" — the article follows the NUMERAL (az 1., a 2.),
 *  never the "a(z)" crutch (§E.17). Written as literals so the catalog sees them. */
function endSubline(lang: string | undefined, n: number, count: number): string {
  const az = n === 1 || n === 5;
  if (count >= 3) {
    return az
      ? T(lang, "Ez volt az {n}. terv a háromból — ugyanazokból a képekből és adatokból, más kinézettel.", { n })
      : T(lang, "Ez volt a {n}. terv a háromból — ugyanazokból a képekből és adatokból, más kinézettel.", { n });
  }
  return az
    ? T(lang, "Ez volt az {n}. terv a kettőből — ugyanazokból a képekből és adatokból, más kinézettel.", { n })
    : T(lang, "Ez volt a {n}. terv a kettőből — ugyanazokból a képekből és adatokból, más kinézettel.", { n });
}

/**
 * THE END-OF-PAGE BLOCK (§E): the OTHER plans, never the one on screen, appended at
 * the end of the page. ⚠️ Call it BEFORE injectTrackingNotice: both append, and the
 * legal footer must stay the page's last word (framing §6).
 */
export function injectPlanEndBlock(html: string, i: SwitcherInput): string {
  const others = i.plans.filter((p) => p.n !== i.current);
  if (!others.length) return html;
  const cards = others
    .map((p) => {
      const pv = p.hasThumb ? ` style="background-image:url(${planThumbUrl(i.token, p.n)})"` : "";
      return (
        `<a href="${esc(planHref(i.leadName, i.token, p.n, i.viewId))}" data-cit-plan-end="${p.n}">` +
        `<span class="citp-pv"${pv}></span>` +
        `<span class="citp-cap"><span>${esc(T(i.lang, "{n}. terv", { n: p.n }))}</span>` +
        `<span class="citp-cta">${esc(T(i.lang, "Megnézem"))} ${ARROW}</span></span></a>`
      );
    })
    .join("");
  const headline =
    others.length >= 2 ? T(i.lang, "Nézze meg a másik kettőt is.") : T(i.lang, "Nézze meg a másikat is.");
  const block =
    `<section id="cit-plans-end" aria-label="${esc(T(i.lang, "A többi terv"))}">` +
    `<h2>${esc(T(i.lang, "Tetszett?"))} <span>${esc(headline)}</span></h2>` +
    `<p>${esc(endSubline(i.lang, i.current, i.plans.length))}</p>` +
    `<div class="citp-cards${others.length === 1 ? " citp-one" : ""}">${cards}</div></section>`;
  return appendToBody(html, block);
}

/**
 * THE NUDGE (§D): the other chips lift and glow twice — at most NUDGE_MAX times per
 * visit, at two moments only: the first open of the visit, and a return to the top
 * after the lead had scrolled well down. A switch is a full reload, so "first open"
 * is remembered per session; a page reached by switching never nudges by itself.
 *
 * Storage may throw (private mode, blocked site data): then the referrer decides — a
 * visit that came from our own /p/ page is a switch, not a first open.
 */
function nudgeScript(token: string): string {
  const key = JSON.stringify(`citp-nudge:${token}`);
  return (
    `<script data-cit-plans-js>(function(){` +
    `var nav=document.querySelector("#cit-plans nav");if(!nav)return;` +
    `var MAX=3,KEY=${key},mem=0;` +
    `function get(){try{return Number(sessionStorage.getItem(KEY)||0)}catch(e){return mem}}` +
    `function put(v){mem=v;try{sessionStorage.setItem(KEY,String(v))}catch(e){}}` +
    `function nudge(){var c=get();if(c>=MAX)return;put(c+1);` +
    `nav.classList.remove("citp-nudge");void nav.offsetWidth;nav.classList.add("citp-nudge")}` +
    `var first;try{first=sessionStorage.getItem(KEY)===null}catch(e){` +
    `first=!/\\/p\\//.test(document.referrer)||document.referrer.indexOf(location.host)<0}` +
    `if(first)setTimeout(nudge,2500);` +
    `var down=false;window.addEventListener("scroll",function(){var y=window.scrollY||0;` +
    `if(y>Math.max(600,innerHeight))down=true;else if(down&&y<40){down=false;nudge()}},{passive:true});` +
    `})();</script>`
  );
}
