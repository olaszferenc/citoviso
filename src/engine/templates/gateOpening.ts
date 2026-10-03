// "gate-opening" art template (ADR-0311) — the owner-approved „Kapunyitás” mock.
//
// Origin: the 2026-10-02 mock contest on a real lead (Három Huszár Apartments, Köveskál),
// Claude against Kimi, seven mocks in all. Of Kimi's variant B the owner wrote: „A Kimi B
// verziója eddig mindent visz.”, then: „Külön sessionbe generáljunk abból is egy sablont.”
// Contract (what the design BINDS): assets/design-refs/tenant-site/gate-opening/README.md —
// the approved file itself is plan.html next to it. Precedent: walk-through (ADR-0304).
//
// The signature moves, taken over from the approved mock:
//   • a warm charcoal page lit by one honey „lantern” accent that is never text on the dark;
//   • a FULL-SCREEN hero: on load the two halves of a „gate” slide apart (translateX, an
//     accent light line in the seam), the photo behind settles, the name's lines rise from
//     a mask; on scroll the hero copy fades away (scroll-driven, behind @supports);
//   • a hairline numbers band, hairlines and rules instead of cards, edge-to-edge bands;
//   • desktop: a sticky intro beside the highlights, rooms as 55/45 rows that alternate
//     sides, a six-column mosaic gallery. Phone and desktop are SEPARATE layouts.
//
// THE GATE IS DATA-DRIVEN, AND HONEST. The mock's gate was hand-picked (a stone gate photo
// opening onto the house). No vision subject says „gate” or „entrance” (heroPick.ts knows
// exterior · pool_garden · view · dining · interior · …), so no photo can be TOLD to be a
// gate, and the page may not suggest the place has one. Owner's ruling (2026-10-03, „B”): the
// leaves are ANOTHER outdoor photo of the place (the best-ranked exterior / garden / view
// after the hero) opening onto the hero — the mock's "one picture of the place opens onto
// another". Without a second outdoor photo the hero itself is split and dimmed like a closed
// door at dusk ("A"). Either way the leaves are decorative and claim nothing (see gateSource).
// The gate also plays on the mock we SEND (owner, 2026-10-03): ~1,7 s inside the hero, it
// hides nothing — the 2026-09-14 ban on full-screen opening intros does not cover it, so it
// does not listen to data-cit-no-intro.
//
// What is NOT taken from the mock but from the system (the brief's rule): booking, the
// lightbox, the review/map/hours blocks are the SHARED modules (data-cit-module hooks,
// ADR-0047/0048) — the template gives them their PLACE and their DRESS. The phone header
// follows ADR-0253 (the shared menu button, no booking button in the scrolled header, the
// bottom bar only half-way), not the mock's always-visible header button. The mock's sticky
// enquiry intro is dropped for the same ADR: no sticky booking control beside the booking
// block. Text comes from SiteData and the copywriter layer; a missing fact drops its block.

import { amenityIconSvg } from "../amenityIcon.js";
import { iconSvg, starIcon } from "../icons.js";
import { mo, motionCss, motionJs } from "../motion.js";
import { slotMarker } from "../moduleSections.js";
import { ratingScale } from "../rating.js";
import type { Photo, Recipe, RenderPhase, SiteData } from "../recipe.js";
import { renderSeoHead, seoTitle } from "../seo.js";
import { renderSkinFontLinks, renderSkinVars, SKINS } from "../skins.js";
import {
  accented,
  bookingSlot,
  copyOf,
  ctaLabel,
  esc,
  firstSentence,
  galleryOrder,
  heroFit,
  HERO_FIT_CSS,
  heroPhoto,
  honestStarCount,
  photoFill,
  roomDetails,
  roomHint,
  roomsFor,
  roomsHeading,
  roomsLabel,
  roomsLead,
  roomShell,
  T,
  type ArtTemplate,
} from "../templateKit.js";

const ARROW = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>`;
const EXT = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.5 16.5l9-9"/><path d="M9 7.5h7.5V15"/></svg>`;
const PLUS = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`;
const DOWN = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 9.5l5.5 5.5 5.5-5.5"/></svg>`;

/** Sized engine icon (the shared set's paths carry no size). */
function ico(name: string, size = 22): string {
  return iconSvg(name).replace("<svg ", `<svg width="${size}" height="${size}" `);
}

// ── the gate ─────────────────────────────────────────────────────────────────────────────

/**
 * Where the gate's two leaves come from.
 *   "photo" — the best-ranked OTHER outdoor photo (vision subject exterior / pool_garden /
 *             view); falls back to "self" when there is none. Owner's pick („B”, 2026-10-03).
 *   "self"  — the hero photo itself, dimmed (claims nothing; the fallback, „A”).
 */
export type GateMode = "self" | "photo";
export const GATE_MODE: GateMode = "photo";

/** The eyebrow over the name: the approved mock's small caps. Owner's ruling (2026-10-03):
 *  it stays in capitals. */
export type EyebrowCase = "caps" | "normal";
export const EYEBROW_CASE: EyebrowCase = "caps";

const GATE_SUBJECTS: ReadonlySet<string> = new Set(["exterior", "pool_garden", "view"]);

/** The photo the gate's leaves show, and whether it is the hero itself. Exported for tooling. */
export function gateSource(
  photos: readonly Photo[],
  mode: GateMode = GATE_MODE,
): { photo: Photo; self: boolean } | null {
  const hero = photos[0];
  if (!hero) return null;
  if (mode === "photo") {
    const other = photos.slice(1).find((p) => p.url !== hero.url && p.subject && GATE_SUBJECTS.has(p.subject));
    if (other) return { photo: other, self: false };
  }
  return { photo: hero, self: true };
}

/**
 * The name split into the hero's masked lines — the most balanced split at word
 * boundaries (two lines; three for a long name). A one-word name is one line.
 */
export function nameLines(name: string): string[] {
  const w = name.trim().split(/\s+/).filter(Boolean);
  if (w.length < 2) return [name.trim()];
  const join = (a: number, b: number) => w.slice(a, b).join(" ");
  const want = name.length > 30 && w.length >= 3 ? 3 : 2;
  let best: string[] = [name.trim()];
  let score = Infinity;
  if (want === 2) {
    for (let i = 1; i < w.length; i++) {
      const ls = [join(0, i), join(i, w.length)];
      const s = Math.max(...ls.map((l) => l.length));
      if (s < score) [score, best] = [s, ls];
    }
  } else {
    for (let i = 1; i < w.length - 1; i++)
      for (let j = i + 1; j < w.length; j++) {
        const ls = [join(0, i), join(i, j), join(j, w.length)];
        const s = Math.max(...ls.map((l) => l.length));
        if (s < score) [score, best] = [s, ls];
      }
  }
  return best;
}

/** A figure as escaped HTML whose parts never break apart („… Ft-tól / éj” — the approved
 *  mock's phone band left „éj” alone, and „Ft-tól” broke at its hyphen: „Ft- / tól / éj” at
 *  390 px). The TEXT stays verbatim — the room-card guard compares the printed price with the
 *  data character for character — only the number part and the unit part are each kept on
 *  one line. */
function glued(s: string): string {
  const m = /^([\d\s.,]*\d)\s+(\S.*)$/.exec(s.trim());
  if (!m) return `<span class="ko-nw">${esc(s)}</span>`;
  return `<span class="ko-nw">${esc(m[1]!)}</span> <span class="ko-nw">${esc(m[2]!)}</span>`;
}

/** Six-column mosaic spans (desktop): rows of 3+3 · 4+2 · 2+2+2 · 2+4, repeating; the last
 *  row is closed by widening its last cell — never a hole at the end. */
export function mosaicSpans(n: number): number[] {
  const PATTERN = [3, 3, 4, 2, 2, 2, 2, 2, 4];
  const spans: number[] = [];
  let row = 0;
  for (let i = 0; i < n; i++) {
    let s = PATTERN[i % PATTERN.length]!;
    if (row + s > 6) s = 6 - row;
    spans.push(s);
    row = (row + s) % 6;
  }
  if (row && spans.length) spans[spans.length - 1] = spans[spans.length - 1]! + 6 - row;
  return spans;
}

const GATE_CSS = `
/* shared module sections dressed to this template's rhythm (ADR-0057) */
:root{
  --cit-modsec-py:clamp(64px,9vw,112px);
  --cit-modsec-maxw:1200px;
  --cit-modsec-px:clamp(16px,3.5vw,40px);
  --cit-modsec-divider:0;
  --cit-modsec-head-align:left;
  --cit-modsec-head-mb:clamp(28px,4vw,48px);
  --cit-modsec-head-size:clamp(1.9rem,4.2vw,2.7rem);
  --cit-modsec-head-weight:800;
  --cit-modsec-card-radius:var(--cit-radius);
  --cit-modsec-card-pad:20px;
  --cit-modsec-card-bg:var(--cit-surface);
  --cit-modsec-card-border:1px solid var(--cit-line);
  --ko-head:66px;
  --ko-ease:cubic-bezier(.2,.7,.2,1);
  color-scheme:dark}
.cit-tpl-gate-opening .cit-modsec h2{font-family:var(--cit-font-display);letter-spacing:-.01em;line-height:1.06}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;overflow-x:clip;scroll-behavior:smooth}
body{margin:0;background:var(--cit-bg);color:var(--cit-ink);font:400 1.0625rem/1.6 var(--cit-font-body);overflow-x:clip}
img{display:block;max-width:100%;height:auto}
a{color:var(--cit-ink);text-decoration-color:var(--cit-accent);text-underline-offset:.22em}
/* the shared modules' button: the bare a{} above would paint its label in ink */
.cit-tpl-gate-opening a.cit-btn,.cit-tpl-gate-opening .cit-btn{color:var(--cit-on-accent);border-radius:var(--cit-radius);min-height:48px;
  display:inline-flex;align-items:center;justify-content:center;padding:.68rem 1.35rem;font-weight:600}
:focus-visible{outline:3px solid color-mix(in srgb,var(--cit-accent) 85%,var(--cit-ink));outline-offset:2px;border-radius:2px}
::selection{background:color-mix(in srgb,var(--cit-accent) 60%,transparent);color:var(--cit-on-accent)}
[id]{scroll-margin-top:92px}
h1,h2,h3{margin:0}
.ko-nw{white-space:nowrap}
p{margin:0 0 1em}
/* the copywriter's accent words: the lantern underlines them — the accent is never text on the dark */
.cit-tpl-gate-opening em{font-style:normal;text-decoration:underline;text-decoration-color:var(--cit-accent);
  text-decoration-thickness:.09em;text-underline-offset:.16em;text-decoration-skip-ink:none}
.ko-wrap{width:min(1200px,calc(100% - clamp(32px,7vw,80px)));margin-inline:auto}
.ko-sec{padding-block:clamp(64px,9vw,112px)}
.ko-head{max-width:720px;margin-bottom:clamp(34px,5vw,56px)}
.ko-head h2,.ko-about-intro h2{font:800 clamp(1.9rem,4.2vw,2.7rem)/1.06 var(--cit-font-display);letter-spacing:-.01em;margin-bottom:.45em;text-wrap:balance}
.ko-lead{color:var(--cit-muted);font-size:1.05rem;max-width:62ch;margin:0}

.ko-btn{display:inline-flex;align-items:center;justify-content:center;gap:.55rem;min-height:48px;padding:.68rem 1.35rem;
  border-radius:var(--cit-radius);font:600 1rem/1.2 var(--cit-font-body);text-decoration:none;cursor:pointer;border:0;
  transition:transform .25s ease,background-color .25s ease,border-color .25s ease}
.ko-btn-acc{background:var(--cit-accent);color:var(--cit-on-accent);box-shadow:0 14px 30px -16px color-mix(in srgb,var(--cit-accent) 90%,transparent)}
.ko-btn-acc:hover{background:color-mix(in srgb,var(--cit-accent) 85%,var(--cit-ink));transform:translateY(-2px)}
.ko-btn-line{background:transparent;color:var(--cit-ink);border:1.5px solid color-mix(in srgb,var(--cit-ink) 42%,transparent)}
.ko-btn-line:hover{border-color:var(--cit-accent);transform:translateY(-2px)}
.ko-link{display:inline-flex;align-items:center;gap:9px;min-height:44px;font-weight:600;color:var(--cit-ink);text-decoration:none;
  border-bottom:2px solid var(--cit-accent);padding-bottom:3px}
.ko-link svg{transition:transform .3s ease}
.ko-link:hover svg{transform:translateX(4px)}

/* ── header: fixed over the hero, blurred charcoal ── */
.ko-top{position:fixed;inset:0 0 auto 0;z-index:70;min-height:var(--ko-head);
  background:color-mix(in srgb,var(--cit-bg) 80%,transparent);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
  border-bottom:1px solid color-mix(in srgb,var(--cit-line) 80%,transparent)}
.ko-top .ko-bar{display:flex;align-items:center;gap:clamp(12px,2.5vw,28px);min-height:var(--ko-head);padding:9px clamp(16px,4vw,44px)}
.ko-mark{display:flex;flex-direction:column;justify-content:center;min-height:44px;line-height:1.14;color:var(--cit-ink);text-decoration:none;min-width:0;margin-right:auto;padding-right:56px}
.ko-mark strong{font:800 1.14rem/1.14 var(--cit-font-display);letter-spacing:.005em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ko-mark span{font-size:.74rem;color:var(--cit-muted)}
.ko-nav{display:none}
.ko-tel{display:none}
.ko-top .ko-btn{display:none;padding:.55rem 1rem;font-size:.95rem}

/* ── hero: full screen, the gate opens on load ── */
.ko-hero{position:relative;isolation:isolate;display:flex;flex-direction:column;justify-content:flex-end;min-height:100svh;overflow:hidden}
.ko-hero-bg{position:absolute;inset:0;z-index:-2;background:var(--cit-surface)}
.ko-hero-bg img{width:100%;height:100%;object-fit:cover}
.ko-gate{display:none}
.ko-leaf{position:relative;width:50.15%;height:100%;overflow:hidden;background:var(--cit-bg)}
.ko-leaf img{position:absolute;top:0;width:200%;height:100%;max-width:none;object-fit:cover}
.ko-leaf.l img{left:0}
.ko-leaf.r img{right:0}
/* the hero photo as its own gate: dimmed like a closed door at dusk, so the opening reads */
.ko-gate.self .ko-leaf::before{content:"";position:absolute;inset:0;z-index:1;background:color-mix(in srgb,var(--cit-bg) 58%,transparent)}
.ko-leaf::after{content:"";position:absolute;top:0;bottom:0;z-index:2;width:3px;background:var(--cit-accent)}
.ko-leaf.l::after{right:0}
.ko-leaf.r::after{left:0}
/* the approved mock's scrim, its middle raised where the name sits: on a worst-case bright photo
   the name measured 2,94:1 (hero-contrast-check, 3:1 AA-large) with the mock's 45% → 12% stops */
.ko-shade{position:absolute;inset:0;z-index:1;background:linear-gradient(to top,
  color-mix(in srgb,var(--cit-bg) 90%,transparent) 0%,color-mix(in srgb,var(--cit-bg) 62%,transparent) 42%,
  color-mix(in srgb,var(--cit-bg) 26%,transparent) 68%,transparent 90%)}
.ko-hero-fade{position:relative;z-index:2}
.ko-hero-copy{padding-top:120px}
.ko-eyebrow{display:flex;align-items:center;gap:12px;margin:0 0 14px;font-weight:600;font-size:.9rem;color:var(--cit-ink)}
.ko-eyebrow::before{content:"";width:34px;height:2px;flex:none;background:var(--cit-accent)}
.ko-eyebrow.caps{font-size:.8rem;letter-spacing:.16em;text-transform:uppercase}
.ko-hero h1{font:900 min(clamp(2.5rem,10.5vw,7rem),calc((min(100vw,1200px) - 40px) / (var(--ko-lw,10) * .76)),var(--cit-hero-cap,999px))/.95 var(--cit-font-display);
  text-transform:uppercase;letter-spacing:-.015em;margin-bottom:20px}
.ko-line{display:block;overflow:hidden;padding-bottom:.09em;margin-bottom:-.09em}
.ko-line>span{display:block}
.ko-hero-lede{font-size:clamp(1.02rem,2.1vw,1.2rem);line-height:1.55;max-width:34em;margin:0;color:color-mix(in srgb,var(--cit-ink) 94%,transparent)}
.ko-hero-cta{display:flex;gap:12px;flex-wrap:wrap;margin-top:26px}
.ko-meta{display:flex;align-items:center;gap:14px 26px;flex-wrap:wrap;margin-top:36px;padding:15px 0 20px;font-size:.92rem;
  border-top:1px solid color-mix(in srgb,var(--cit-ink) 24%,transparent);color:color-mix(in srgb,var(--cit-ink) 90%,transparent)}
.ko-meta>span{display:inline-flex;align-items:center;gap:10px}
.ko-meta i{width:34px;height:34px;flex:none;display:grid;place-items:center;border-radius:var(--cit-radius);
  background:color-mix(in srgb,var(--cit-bg) 68%,transparent);color:var(--cit-accent)}
.ko-meta i svg{width:18px;height:18px}
.ko-more{margin-left:auto;display:inline-flex;align-items:center;gap:11px;min-height:44px;color:inherit;text-decoration:none;font-weight:500}
.ko-more b{width:38px;height:38px;display:grid;place-items:center;border-radius:50%;border:1.5px solid color-mix(in srgb,var(--cit-ink) 48%,transparent)}

/* load choreography — only under .ko-anim (set in <head>, before first paint: JS on,
   motion allowed, not tooling). Without it everything simply stands there. */
.ko-anim .ko-gate{position:absolute;inset:0;z-index:0;display:flex;overflow:hidden;pointer-events:none}
/* 1.5s = the first 1.05s slowed by 30% (owner, 2026-10-03: it opened too fast) */
.ko-anim .ko-leaf.l{animation:koGateL 1.5s .18s cubic-bezier(.76,0,.24,1) both}
.ko-anim .ko-leaf.r{animation:koGateR 1.5s .18s cubic-bezier(.76,0,.24,1) both}
@keyframes koGateL{to{transform:translateX(-103%)}}
@keyframes koGateR{to{transform:translateX(103%)}}
.ko-anim .ko-hero-bg img{animation:koSettle 2.2s .1s cubic-bezier(.2,.6,.2,1) both}
@keyframes koSettle{from{transform:scale(1.07)}to{transform:none}}
.ko-anim .ko-line>span{animation:koLine .85s cubic-bezier(.19,.7,.18,1) both;animation-delay:var(--d,0s)}
@keyframes koLine{from{transform:translateY(112%)}to{transform:none}}
.ko-anim .ko-eyebrow{animation:koUp .8s .3s ease both}
.ko-anim .ko-hero-lede{animation:koUp .8s .5s ease both}
.ko-anim .ko-hero-cta{animation:koUp .8s .62s ease both}
@keyframes koUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
.ko-anim .ko-more b{animation:koBob 2.2s ease-in-out infinite}
@keyframes koBob{50%{transform:translateY(5px)}}
@supports (animation-timeline: view()){
  .ko-anim .ko-hero-fade{animation:koFade linear both;animation-timeline:view();animation-range:exit 8% exit 92%}
}
@keyframes koFade{to{opacity:0;transform:translateY(-36px)}}

/* ── numbers band ── */
.ko-stats{border-block:1px solid var(--cit-line);background:color-mix(in srgb,var(--cit-surface) 55%,var(--cit-bg))}
.ko-stats ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr}
.ko-stats li{padding:22px 18px 22px 0;min-width:0}
.ko-stats li:nth-child(odd){border-right:1px solid var(--cit-line)}
.ko-stats li:nth-child(even){padding-left:18px}
.ko-stats li:nth-child(n+3){border-top:1px solid var(--cit-line)}
.ko-stats li:last-child:nth-child(odd){grid-column:1/-1;border-right:0}
.ko-num{display:block;font:800 clamp(1.5rem,4.6vw,2.3rem)/1.05 var(--cit-font-display);color:var(--cit-ink);overflow-wrap:anywhere}
.ko-num small{font-size:.55em;color:var(--cit-muted);font-weight:600}
.ko-stats li>span:last-child{display:block;color:var(--cit-muted);font-size:.88rem;margin-top:5px;line-height:1.35}

/* ── about: the place in words, the highlights as ruled items ── */
.ko-about{display:grid;gap:clamp(30px,4vw,48px)}
.ko-items{list-style:none;margin:0;padding:0;display:grid}
.ko-item{display:flex;gap:18px;align-items:center;padding:22px 0;border-top:1px solid var(--cit-line)}
.ko-item:last-child{border-bottom:1px solid var(--cit-line)}
.ko-item i{width:46px;height:46px;flex:none;display:grid;place-items:center;border:1px solid var(--cit-line);border-radius:var(--cit-radius);
  color:var(--cit-accent);transition:background-color .3s ease,color .3s ease,border-color .3s ease,transform .3s ease}
.ko-item i svg{width:22px;height:22px}
.ko-item:hover i{background:var(--cit-accent);color:var(--cit-on-accent);border-color:transparent;transform:translateY(-2px)}
.ko-item h3{font:800 1.14rem/1.3 var(--cit-font-display)}

/* ── rooms: ruled rows ── */
.ko-room{border-top:1px solid var(--cit-line)}
.ko-room:last-child{border-bottom:1px solid var(--cit-line)}
.ko-roomlink{display:grid;gap:24px;padding-block:clamp(28px,4vw,44px);color:inherit;text-decoration:none;cursor:pointer}
.ko-room .cit-rmbox{position:relative;display:block;overflow:hidden;aspect-ratio:4/3;border-radius:var(--cit-radius);border:1px solid var(--cit-line);background:var(--cit-surface)}
.ko-room .cit-rmbox img{width:100%;height:100%;object-fit:cover;transition:transform .6s ease}
/* the runtime's sample-photo wrapper measures "did the picture fill its frame" BEFORE a lazy
   photo has loaded (height 0 → no fill) — measured on Lidó: the photo stood 150 px tall in a
   268 px frame. Here the frame IS the picture's box (a fixed 4:3, never the whole card), so
   the wrapper may always take its height. */
.ko-room .cit-rmbox .cit-wmwrap{height:100%}
.ko-roomlink:hover .cit-rmbox img{transform:scale(1.045)}
.ko-rinfo{display:flex;flex-direction:column;gap:13px;align-items:flex-start}
.ko-rinfo h3{font:800 clamp(1.45rem,2.6vw,1.95rem)/1.12 var(--cit-font-display)}
.ko-rmeta{display:flex;flex-wrap:wrap;gap:8px 22px;color:var(--cit-muted);font-size:.95rem}
.ko-rmeta span{display:inline-flex;align-items:center;gap:8px}
.ko-rmeta svg{color:var(--cit-accent)}
.ko-price{font:900 clamp(1.6rem,3vw,2rem)/1.1 var(--cit-font-display);margin:0}
.ko-go{display:inline-flex;align-items:center;gap:9px;min-height:44px;font-weight:600;border-bottom:2px solid var(--cit-accent);padding-bottom:3px}
.ko-go svg{transition:transform .3s ease}
.ko-roomlink:hover .ko-go svg{transform:translateX(5px)}

/* ── gallery: mosaic, every photo in the slot (contract gallery-cap) ── */
.ko-gal{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.ko-gal figure{margin:0;overflow:hidden;border-radius:var(--cit-radius);border:1px solid var(--cit-line);background:var(--cit-surface)}
.ko-gal img{width:100%;height:100%;aspect-ratio:4/3;object-fit:cover;transition:transform .55s ease}
.ko-gal figure:hover img{transform:scale(1.05)}
.ko-gal figure.w{grid-column:1/-1}
.ko-gact{margin-top:24px}
.ko-gact .ko-btn[hidden]{display:none}

/* ── reviews: halves divided by hairlines ── */
.ko-rv{display:grid;border-block:1px solid var(--cit-line)}
.ko-rv>*{padding:clamp(26px,4vw,44px) 0;display:grid;gap:4px;justify-items:start;align-content:start;min-width:0}
.ko-rv>*+*{border-top:1px solid var(--cit-line)}
.ko-src{display:flex;align-items:center;gap:10px;margin:0 0 12px;font-weight:600;font-size:.92rem;color:var(--cit-muted)}
.ko-src::before{content:"";width:26px;height:2px;background:var(--cit-accent)}
.ko-big{font:900 clamp(3.2rem,8vw,5rem)/1 var(--cit-font-display)}
.ko-big small{font:600 1.15rem var(--cit-font-body);color:var(--cit-muted);margin-left:10px}
.ko-stars{display:inline-flex;gap:3px;margin:8px 0 10px;color:var(--cit-accent)}
.ko-stars svg{width:24px;height:24px}
.ko-count{color:var(--cit-muted);font-size:.95rem;margin:0 0 14px}
.ko-q blockquote{margin:0;font:500 1.15rem/1.5 var(--cit-font-body);color:var(--cit-ink)}
.ko-q figcaption{margin-top:12px;color:var(--cit-muted);font-weight:600;font-size:.95rem}
.ko-q{margin:0}

/* ── FAQ ── */
.ko-faq details{border-top:1px solid var(--cit-line)}
.ko-faq details:last-child{border-bottom:1px solid var(--cit-line)}
.ko-faq summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:18px;padding:20px 2px;
  min-height:52px;font-weight:600;font-size:1.04rem}
.ko-faq summary::-webkit-details-marker{display:none}
.ko-faq summary i{flex:none;width:40px;height:40px;display:grid;place-items:center;border:1.5px solid var(--cit-line);border-radius:var(--cit-radius);
  color:var(--cit-accent);transition:transform .35s ease,background-color .35s ease,color .35s ease,border-color .35s ease}
.ko-faq details[open] summary i{transform:rotate(45deg);background:var(--cit-accent);color:var(--cit-on-accent);border-color:transparent}
.ko-faq details p{padding:0 58px 20px 2px;margin:0;color:var(--cit-muted);max-width:64ch}

/* ── the closing band: the shared booking surface ── */
.ko-enq{border-top:1px solid var(--cit-line);padding-top:clamp(56px,8vw,96px)}
.ko-enq .cit-enquiry{margin:0}
/* the full booking section follows right below with its own „Foglalás” heading: the band's
   title + jump button would only repeat it (measured: „Foglalás / Foglalás”). The band itself
   stays — it is #cit-enquiry, the anchor every booking button on the page points at. */
.ko-enq:has(#cit-booking) .cit-enquiry-bar-inner{display:none}
.ko-enq .cit-enquiry-bar-inner{display:flex;flex-wrap:wrap;align-items:center;gap:14px 22px;margin:0}
.ko-enq .cit-enquiry-bar-title{margin:0;font:800 clamp(1.9rem,4.2vw,2.7rem)/1.06 var(--cit-font-display);letter-spacing:-.01em;color:var(--cit-ink)}
.ko-enq .ko-call{margin:14px 0 0;color:var(--cit-muted)}
.ko-enq .ko-call a{display:inline-flex;align-items:center;min-height:44px;font-weight:600;text-decoration:none;border-bottom:2px solid var(--cit-accent);white-space:nowrap}
.ko-enq .cit-modsec [data-cit-module="booking"],
.ko-enq .cit-modsec form{background:var(--cit-surface);border:1px solid var(--cit-line);border-radius:var(--cit-radius);padding:clamp(22px,3.4vw,38px)}

/* ── footer: charcoal warmed by the lantern ── */
.ko-foot{background:color-mix(in srgb,var(--cit-bg) 72%,var(--cit-accent));border-top:1px solid var(--cit-line);padding-top:clamp(48px,7vw,80px)}
.ko-foot-grid{display:grid;gap:36px;padding-bottom:clamp(36px,5vw,56px)}
.ko-foot .ko-fname{font:800 1.5rem/1.2 var(--cit-font-display);margin:0 0 8px}
.ko-foot address{font-style:normal;color:var(--cit-muted);margin-bottom:8px}
.ko-ftel{display:inline-flex;align-items:center;gap:10px;min-height:44px;font-weight:700;text-decoration:none}
.ko-ftel svg{color:var(--cit-accent)}
.ko-foot nav{display:grid;align-content:start}
.ko-foot nav a{display:inline-flex;align-items:center;min-height:44px;text-decoration:none;color:var(--cit-ink)}
.ko-foot nav a:hover{text-decoration:underline}
.ko-foot-h{font-weight:700;margin:0 0 8px}
.ko-foot p{color:var(--cit-muted);font-size:.97rem}
.ko-foot p a{display:inline-flex;align-items:center;min-height:44px}

/* ── phone booking bar (ADR-0253: the shared runtime shows it only half-way) ── */
.ko-fab{position:fixed;right:16px;bottom:calc(14px + var(--citui-consent-h,0px) + env(safe-area-inset-bottom));z-index:35;display:flex;gap:8px}
.ko-fab .ko-btn{box-shadow:var(--cit-shadow)}
.ko-fab .ko-ftel-b{width:48px;padding:0;background:var(--cit-surface);color:var(--cit-ink);border:1px solid var(--cit-line)}

@media(min-width:900px){
  .ko-tel{display:inline-flex;align-items:center;gap:9px;min-height:44px;font-weight:600;font-size:.95rem;color:var(--cit-ink);text-decoration:none}
  .ko-tel svg{color:var(--cit-accent)}
}
@media(min-width:1024px){
  .ko-mark{margin-right:0;padding-right:0}
  .ko-nav{display:flex;align-items:center;gap:clamp(18px,2.2vw,28px);margin-right:auto}
  .ko-nav a{position:relative;display:inline-flex;align-items:center;min-height:44px;color:var(--cit-ink);text-decoration:none;font-weight:500;font-size:.96rem}
  .ko-nav a::after{content:"";position:absolute;left:0;right:0;bottom:7px;height:2px;background:var(--cit-accent);transform:scaleX(0);transform-origin:left;transition:transform .3s ease}
  .ko-nav a:hover::after{transform:scaleX(1)}
  .ko-top .ko-btn{display:inline-flex}
  .ko-hero-copy{padding-top:150px}
  /* as many columns as there are figures — one rating alone must not leave 3/4 of the band empty */
  .ko-stats ul{grid-template-columns:repeat(var(--ko-n,4),minmax(0,1fr))}
  .ko-stats li,.ko-stats li:nth-child(even){padding:28px 28px 28px 0;border-right:0}
  .ko-stats li:nth-child(odd){border-right:0}
  .ko-stats li:nth-child(n+3){border-top:0}
  .ko-stats li:nth-child(n+2){border-left:1px solid var(--cit-line);padding-left:28px}
  .ko-stats li:last-child:nth-child(odd){grid-column:auto}
  .ko-about{grid-template-columns:5fr 7fr;gap:clamp(36px,6vw,84px)}
  .ko-about-intro{position:sticky;top:104px;align-self:start}
  .ko-items{grid-template-columns:1fr 1fr;gap:0 clamp(28px,4vw,52px)}
  .ko-item:nth-last-child(2):nth-child(odd){border-bottom:1px solid var(--cit-line)}
  .ko-roomlink{grid-template-columns:7fr 5fr;gap:clamp(28px,4vw,56px);align-items:center}
  /* the mirrored row keeps the picture on the WIDE side (the approved 55/45 rows, flipped) */
  .ko-room:nth-child(even) .ko-roomlink{grid-template-columns:5fr 7fr}
  .ko-room:nth-child(even) .cit-rmbox{order:2}
  .ko-gal{grid-template-columns:repeat(6,1fr);gap:14px}
  .ko-gal figure,.ko-gal figure.w{grid-column:span var(--s,2)}
  .ko-rv{grid-template-columns:1fr 1fr}
  .ko-rv>*{padding:clamp(30px,4vw,48px)}
  .ko-rv>*:nth-child(odd){padding-left:0}
  .ko-rv>*+*{border-top:0}
  .ko-rv>*:nth-child(even){border-left:1px solid var(--cit-line)}
  .ko-rv>*:nth-child(n+3){border-top:1px solid var(--cit-line)}
  .ko-rv>*:only-child{grid-column:1/-1}
  .ko-foot-grid{grid-template-columns:1.25fr 1fr 1fr;gap:clamp(30px,4vw,60px)}
}
@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  .ko-gate{display:none!important}
  .ko-anim .ko-leaf,.ko-anim .ko-hero-bg img,.ko-anim .ko-line>span,.ko-anim .ko-eyebrow,.ko-anim .ko-hero-lede,
  .ko-anim .ko-hero-cta,.ko-anim .ko-more b,.ko-anim .ko-hero-fade{animation:none!important}
}
`;

/** Set before first paint so the gate is closed when the page first shows. No class (JS off,
 *  reduced motion, tooling's data-cit-no-motion) → no gate, no choreography, all visible. */
const GATE_BOOT = `(function(){var r=document.documentElement;try{if(r.hasAttribute('data-cit-no-motion')||(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches))return;}catch(e){}r.classList.add('ko-anim');})();`;

function renderGate(recipe: Recipe, data: SiteData, phase: RenderPhase): string {
  const skin = SKINS[recipe.skin] ?? SKINS["lantern-charcoal"] ?? Object.values(SKINS)[0]!;
  const photos = data.photos;
  const hero = heroPhoto(data);
  const rooms = roomsFor(data, phase);
  const heroCopy = copyOf(recipe, "hero");
  const featCopy = copyOf(recipe, "features");
  const galCopy = copyOf(recipe, "gallery");
  const cta = ctaLabel(data, phase);
  const c = data.contact;
  const tel = c.phone ? `tel:${esc(c.phone.replace(/\s+/g, ""))}` : "";
  const city = data.place?.city ?? "";
  const eyebrow = heroCopy.eyebrow ?? city;
  const lede = heroCopy.lead ?? (firstSentence(data.intro, 200) || data.tagline);
  const feat = data.highlights.slice(0, 8);
  const rating = data.rating;
  const ratingStr = rating ? String(rating.value).replace(".", ",") : "";
  const scale = ratingScale(data);
  // The rating's source is named only where we KNOW it: a Google reviews URL (ADR-0046) —
  // read from the link's HOST, not from the absent scale (a future scale-less portal URL
  // would otherwise be labelled „Google”; tényhűség-őr, 2026-10-02).
  const isGoogle = Boolean(
    rating?.url &&
      !rating.scale &&
      (() => {
        try {
          return /(^|\.)google\.[a-z.]+$/i.test(new URL(rating.url).hostname);
        } catch {
          return false;
        }
      })(),
  );

  // ── numbers band: the real rating first, then the real stats (deduplicated) ──
  const facts: { n: string; small?: string; l: string }[] = [];
  if (rating) {
    facts.push({
      n: ratingStr,
      small: `/\u00a0${scale}`,
      l: rating.count ? T(data, "{n} vendégértékelés átlaga", { n: rating.count }) : T(data, "értékelés"),
    });
  }
  for (const s of data.stats ?? []) {
    if (facts.length >= 4) break;
    if (rating && (s.icon === "star" || s.value === ratingStr)) continue;
    if (facts.some((f) => f.l.toLowerCase() === s.label.toLowerCase())) continue;
    facts.push({ n: s.value, l: s.label });
  }

  // ── header ──
  const aboutText = data.intro || data.tagline;
  const links = [
    feat.length || aboutText ? { href: "#ko-about", label: T(data, "A ház") } : null,
    rooms ? { href: "#cit-rooms", label: roomsLabel(data) } : null,
    photos.length ? { href: "#ko-gallery", label: T(data, "Képek") } : null,
    rating || data.reviews?.length ? { href: "#ko-reviews", label: T(data, "Értékelések") } : null,
    data.faqs?.length ? { href: "#ko-faq", label: T(data, "Kérdések") } : null,
  ].filter((l): l is { href: string; label: string } => Boolean(l));
  const header = `<header class="ko-top">
    <div class="ko-bar">
      <a class="ko-mark" href="#top"><strong>${esc(data.name)}</strong>${city ? `<span>${esc(city)}</span>` : ""}</a>
      <nav class="ko-nav" data-cit-navsrc aria-label="${esc(T(data, "Fő navigáció"))}">
        ${links.map((l) => `<a href="${l.href}">${l.label}</a>`).join("\n        ")}
      </nav>
      ${c.phone ? `<a class="ko-tel" href="${tel}">${ico("phone", 19)}${esc(c.phone)}</a>` : ""}
      <a class="ko-btn ko-btn-acc" href="#cit-enquiry">${cta}</a>
    </div>
  </header>`;

  // ── hero: the photo, the gate over it, the copy at the bottom ──
  const gate = gateSource(photos);
  const lines = nameLines(data.name);
  const longest = Math.max(...data.name.split(/\s+/).map((w) => w.length), 1);
  const firstAfterHero = feat.length || aboutText ? "#ko-about" : rooms ? "#cit-rooms" : photos.length ? "#ko-gallery" : "#cit-enquiry";
  const gateHtml = gate
    ? `<div class="ko-gate${gate.self ? " self" : ""}" aria-hidden="true">
      <div class="ko-leaf l"><img src="${esc(gate.photo.url)}" alt="" loading="eager"></div>
      <div class="ko-leaf r"><img src="${esc(gate.photo.url)}" alt="" loading="eager"></div>
    </div>`
    : "";
  const heroBlock = `<section class="ko-hero" id="top">
    <div class="ko-hero-bg">${
      hero
        ? `<img src="${esc(hero.url)}" alt="${esc(hero.alt || data.name)}" fetchpriority="high" loading="eager">`
        : photoFill(data.name)
    }</div>
    ${gateHtml}
    <div class="ko-shade" aria-hidden="true"></div>
    <div class="ko-wrap ko-hero-fade">
      <div class="ko-hero-copy">
        ${eyebrow ? `<p class="ko-eyebrow${EYEBROW_CASE === "caps" ? " caps" : ""}">${esc(eyebrow)}</p>` : ""}
        <h1 ${heroFit(data.name)} style="--ko-lw:${longest}">${lines
          .map((l, i) => `<span class="ko-line"><span style="--d:${(0.12 + i * 0.14).toFixed(2)}s">${esc(l)}</span></span>`)
          .join("")}</h1>
        ${lede ? `<p class="ko-hero-lede">${accented(lede, heroCopy.accent)}</p>` : ""}
        <div class="ko-hero-cta">
          <a class="ko-btn ko-btn-acc" href="#cit-enquiry">${cta}</a>
          ${
            rooms
              ? `<a class="ko-btn ko-btn-line" href="#cit-rooms">${roomsLabel(data)}</a>`
              : photos.length > 1
                ? `<a class="ko-btn ko-btn-line" href="#ko-gallery">${T(data, "Képek")}</a>`
                : ""
          }
        </div>
      </div>
      <div class="ko-meta">
        ${c.address ? `<span><i>${ico("location", 18)}</i>${esc(c.address)}</span>` : ""}
        ${
          rating
            ? `<span><i>${starIcon()}</i>${esc(ratingStr)}&nbsp;/&nbsp;${scale}${isGoogle ? ` · ${T(data, "Google-értékelés")}` : ""}</span>`
            : ""
        }
        <a class="ko-more" href="${firstAfterHero}">${T(data, "Görgessen tovább")}<b>${DOWN}</b></a>
      </div>
    </div>
  </section>`;

  const statsBlock = facts.length
    ? `<section class="ko-stats" aria-label="${esc(T(data, "Számokban"))}">
    <div class="ko-wrap"><ul style="--ko-n:${facts.length}">
      ${facts
        .map(
          (f, i) =>
            `<li ${mo("up", i * 80)}><span class="ko-num">${glued(f.n)}${f.small ? `<small>&nbsp;${esc(f.small)}</small>` : ""}</span><span>${esc(f.l)}</span></li>`,
        )
        .join("\n      ")}
    </ul></div>
  </section>`
    : "";

  // ── about: the intro beside the highlights (no heading over nothing) ──
  const aboutTitle = featCopy.title ?? T(data, "A ház");
  const aboutBlock =
    feat.length || aboutText
      ? `<section id="ko-about" class="ko-sec">
    <div class="ko-wrap ko-about">
      <div class="ko-about-intro" ${mo("up")}>
        <h2>${accented(aboutTitle, featCopy.accent)}</h2>
        ${aboutText ? `<p class="ko-lead">${esc(aboutText)}</p>` : ""}
        ${photos.length > 1 ? `<a class="ko-link" href="#ko-gallery" style="margin-top:18px">${T(data, "Megnézem a képeket")}${ARROW}</a>` : ""}
      </div>
      ${
        feat.length
          ? `<ul class="ko-items" aria-label="${esc(T(data, "Kiemelések"))}">${feat
              .map((h, i) => `<li class="ko-item" ${mo("up", (i % 2) * 80)}><i>${amenityIconSvg(h, data.amenityIconMap)}</i><h3>${esc(h)}</h3></li>`)
              .join("")}</ul>`
          : ""
      }
    </div>
  </section>`
      : "";

  const roomsBlock = rooms
    ? `<section id="cit-rooms" class="ko-sec" data-cit-module="rooms">
    <div class="ko-wrap">
      <div class="ko-head" ${mo("up")}>
        <h2>${roomsHeading(data)}</h2>
        ${roomsLead(data) ? `<p class="ko-lead">${roomsLead(data)}</p>` : ""}
      </div>
      <div class="ko-rooms">
        ${rooms
          .map(
            (r, i) => `<article class="ko-room">${roomShell(
              data,
              r,
              i,
              "ko-roomlink",
              `<span class="cit-rmbox">${
                r.photo ? `<img src="${esc(r.photo.url)}" alt="${esc(r.photo.alt || r.name)}" loading="lazy">` : photoFill(r.name)
              }${roomHint(data, r)}</span>
          <div class="ko-rinfo"><h3>${esc(r.name)}</h3>${
            r.capacity ? `<div class="ko-rmeta"><span>${ico("bed", 19)}${esc(r.capacity)}</span></div>` : ""
          }${r.price ? `<p class="ko-price">${glued(r.price)}</p>` : ""}${
            r.presentation ? "" : `<span class="ko-go">${T(data, "Részletek")}${ARROW}</span>`
          }</div>`,
            )}${roomDetails(data, r, i)}</article>`,
          )
          .join("\n        ")}
      </div>
    </div>
  </section>`
    : "";

  // Contract gallery-cap: EVERY photo in the slot (the shared lightbox pages through all);
  // eleven show — the mosaic's full rows — the rest open in place under „Összes fotó”.
  const SHOWN = 11;
  const galleryOf = (ordered: readonly Photo[]): string => {
    if (!ordered.length) return "";
    const shown = Math.min(ordered.length, SHOWN);
    const spans = mosaicSpans(shown);
    // phone: two columns — an odd last visible photo takes the full row, never a hole
    const wide = shown % 2 ? shown - 1 : -1;
    return `<section id="ko-gallery" class="ko-sec">
    <div class="ko-wrap">
      <div class="ko-head" ${mo("up")}>
        <h2>${galCopy.title ? accented(galCopy.title, galCopy.accent) : T(data, "Képek")}</h2>
      </div>
      <div class="ko-gal" id="ko-galgrid" data-cit-module="gallery" data-cit-gexpandable>
        ${ordered
          .map(
            (p, i) =>
              `<figure style="--s:${spans[i] ?? 2}"${i === wide ? ` class="w"` : ""}${i >= SHOWN ? " data-cit-gextra" : ""}><img src="${esc(p.url)}" alt="${esc(p.alt || data.name)}" loading="lazy"></figure>`,
          )
          .join("\n        ")}
      </div>
      ${
        ordered.length > SHOWN
          ? `<div class="ko-gact"><button type="button" class="ko-btn ko-btn-line" data-cit-gexpand="ko-galgrid" aria-controls="ko-galgrid" aria-expanded="false" data-more="${esc(T(data, "Összes fotó ({n})", { n: ordered.length }))}" data-less="${esc(T(data, "Kevesebb fotó"))}" hidden>${T(data, "Összes fotó ({n})", { n: ordered.length })}</button></div>`
          : ""
      }
    </div>
  </section>`;
  };

  // Real guest quotes only — a sample review never reaches a page (§B.17).
  const quotes = (data.reviews ?? []).slice(0, 3);
  const stars = honestStarCount(data);
  const ratingCell = rating
    ? `<div>
          <p class="ko-src">${isGoogle ? "Google" : T(data, "Vendégértékelés")}</p>
          <span class="ko-big">${esc(ratingStr)}<small>/&nbsp;${scale}</small></span>
          ${stars ? `<span class="ko-stars" aria-hidden="true">${starIcon().repeat(stars)}</span>` : ""}
          ${rating.count ? `<p class="ko-count">${T(data, "{n} vendégértékelés átlaga", { n: rating.count })}</p>` : ""}
          ${
            isGoogle
              ? `<a class="ko-link" href="${esc(rating.url!)}" target="_blank" rel="noopener nofollow">${T(data, "Megnézem a Google-on")}${EXT}</a>`
              : ""
          }
        </div>`
    : "";
  const reviewBlock =
    rating || quotes.length
      ? `<section id="ko-reviews" class="ko-sec"${quotes.length ? ` data-cit-module="reviews"` : ""}>
    <div class="ko-wrap">
      <div class="ko-head" ${mo("up")}>
        <h2>${T(data, "Vendégek értékelése")}</h2>
      </div>
      <div class="ko-rv">
        ${ratingCell}
        ${quotes
          .map(
            (q) => `<figure class="ko-q"><p class="ko-src">${T(data, "Vendég")}</p><blockquote>${esc(q.quote)}</blockquote>${
              q.author ? `<figcaption>${esc(q.author)}</figcaption>` : ""
            }</figure>`,
          )
          .join("")}
      </div>
    </div>
  </section>`
      : "";

  // Real answers only: a FAQ answer is a policy fact about THIS place (§B.17).
  const faqBlock = data.faqs?.length
    ? `<section id="ko-faq" class="ko-sec">
    <div class="ko-wrap">
      <div class="ko-head" ${mo("up")}><h2>${T(data, "Gyakori kérdések")}</h2></div>
      <div class="ko-faq">
        ${data.faqs
          .map((f) => `<details><summary>${esc(f.q)}<i>${PLUS}</i></summary><p>${esc(f.a)}</p></details>`)
          .join("\n        ")}
      </div>
    </div>
  </section>`
    : "";

  // No heading of our own: the band's title and the shared booking section's <h2> already
  // name it — a third would stutter (the walk-through lesson).
  const enqBlock = `<div class="ko-enq">
    <div class="ko-wrap">
      ${bookingSlot(data, phase)}
      ${c.phone ? `<p class="ko-call">${T(data, "Telefonon is kereshető:")} <a href="${tel}">${esc(c.phone)}</a></p>` : ""}
    </div>
    ${slotMarker("closing")}
  </div>`;

  const footer = `<footer class="ko-foot" id="cit-contact">
    <div class="ko-wrap ko-foot-grid">
      <div>
        <p class="ko-fname">${esc(data.name)}</p>
        ${c.address ? `<address>${esc(c.address)}</address>` : ""}
        ${c.phone ? `<a class="ko-ftel" href="${tel}">${ico("phone", 20)}${esc(c.phone)}</a>` : ""}
        ${c.email ? `<p><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>` : ""}
      </div>
      <nav aria-label="${esc(T(data, "Lábléc"))}">
        ${links.map((l) => `<a href="${l.href}">${l.label}</a>`).join("")}
        <a href="#cit-enquiry">${cta}</a>
      </nav>
      <nav aria-label="${esc(T(data, "Jogi információk"))}">
        <a href="/adatvedelem">${T(data, "Adatvédelmi tájékoztató")}</a>
        <a href="/impresszum">${T(data, "Impresszum")}</a>
      </nav>
    </div>
  </footer>`;

  const fab = `<div class="ko-fab" data-cit-mobbar>
    ${c.phone ? `<a class="ko-btn ko-ftel-b" href="${tel}" aria-label="${esc(T(data, "Hívás: {phone}", { phone: c.phone }))}">${ico("phone", 20)}</a>` : ""}
    <a class="ko-btn ko-btn-acc" href="#cit-enquiry">${cta}</a>
  </div>`;

  // The gallery leads with the photos the page does not show elsewhere (contract gallery-cap).
  // The gate's photo is seen for ~1 s while it opens: it does not count as "already on the page"
  // (otherwise the B gate photo would be pushed to the back of the gallery).
  const gallery = galleryOf(
    galleryOrder(photos, [heroBlock.replace(gateHtml, ""), aboutBlock, roomsBlock, footer].join("")),
  );

  return `<!doctype html>
<html lang="${data.lang ?? "hu"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(seoTitle(data))}</title>
  <script>${GATE_BOOT}</script>
  ${renderSeoHead(data, phase)}
  ${renderSkinFontLinks(skin)}
  <style>
  ${renderSkinVars(skin, data.palette?.accent)}

${GATE_CSS}
${HERO_FIT_CSS}
${motionCss("calm")}
  </style>
</head>
<body class="cit-tpl-gate-opening">
  ${header}
  <main>
  ${heroBlock}
  ${statsBlock}
  ${aboutBlock}
  ${roomsBlock}
  ${slotMarker("showcase")}
  ${gallery}
  ${reviewBlock}
  ${slotMarker("trust")}
  ${faqBlock}
  ${slotMarker("practical")}
  ${enqBlock}
  </main>
  ${footer}
  ${fab}
  <script>${motionJs()}</script>
</body>
</html>`;
}

export const GATE_OPENING: ArtTemplate = {
  id: "gate-opening",
  label: "Kapunyitás — sötét, esti hangulat, betöltéskor kinyíló kapu a teljes képernyős hős fotón (tulaj által választott mock)", // i18n-exempt: operator-facing (console template picker)
  skins: ["lantern-charcoal"],
  render: renderGate,
};
