// "walk-through" art template (ADR-0304) — the owner-approved „Séta a kapun át” mock.
//
// Origin: the 2026-10-02 mock contest on a real lead (Három Huszár Apartments, Köveskál).
// The owner opened variant B and wrote: „annyira jó lett, hogy hozzuk létre a Citoviso-n
// generálható típusként”. Contract (what the design BINDS): assets/design-refs/tenant-site/
// walk-through/README.md — the approved file itself is plan.html next to it.
//
// The signature moves, taken over from the approved mock:
//   • a TEXT-FIRST hero — a giant grotesque name, a short intro, two pill buttons — beside
//     (desktop) or above (phone) a stepped three-photo collage;
//   • a numbers band under a heavy rule, the figures sliding up from under the line;
//   • THE WALK: a sticky, rounded photo panel whose pictures dissolve into each other as the
//     guest scrolls the steps beside it (phone: the photo fills the screen and the step cards
//     float over it), with a thin progress rail;
//   • rooms as ruled rows, a tall-cell gallery grid, the rating on a full-width accent band,
//     a dark closing band around the booking surface.
//
// What is NOT taken from the mock but from the system (the brief's rule): the booking form,
// the lightbox, the review/map/hours blocks are the SHARED modules (data-cit-module hooks,
// ADR-0047/0048) — the template gives them their PLACE and their DRESS. The mock's own form
// script was only the pattern of the behaviour.
//
// The walk is DATA-DRIVEN. The mock's six steps were hand-picked (gate → path → porch →
// courtyard → breakfast → garden). Here every step is a photo whose purchased vision
// verdict (`Photo.subject`, heroPick.ts) names what it shows, taken in the order a guest
// would meet it: outside → garden/yard → view → table → inside. One photo per subject, the
// best-ranked one (the photo list is already hero-score ordered). The step says only what
// the verdict established — the SUBJECT, as its heading. ⛔ No sentence under it: the first
// build paired a sourced highlight with the photo by topic word, and the factuality guard
// caught the pairing itself making the claim — „Reggeli a virágos kertben” beside an INDOOR
// dining room, „Klímás szobák kőkandallóval” beside a bedroom with no fireplace. A true
// sentence next to the wrong picture is a false statement about the picture (§B.17).
// The highlights stay in the list under the walk. Fewer than three steps → no walk at all:
// the section keeps its heading, intro and highlights, and nothing pretends to be a walk
// (no empty panel, no single-photo "story").

import { amenityIconSvg } from "../amenityIcon.js";
import { iconSvg, starIcon } from "../icons.js";
import { mo, motionCss, motionJs, storyCss, storyJs } from "../motion.js";
import { slotMarker } from "../moduleSections.js";
import { ratingScale } from "../rating.js";
import type { Photo, Recipe, RenderPhase, SiteData } from "../recipe.js";
import { renderSeoHead, seoTitle } from "../seo.js";
import { renderSkinFontLinks, renderSkinVars, SKINS } from "../skins.js";
import {
  accented,
  bookingSlot,
  copyHook,
  copyOf,
  ctaLabel,
  esc,
  firstSentence,
  galleryOrder,
  heroFit,
  HERO_FIT_CSS,
  heroPhoto,
  highlightHook,
  hookPick,
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

/** The brand mark: a drawn arch (the approved mock's gate). Inline SVG, never an emoji. */
const ARCH = `<svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 28V14a11 11 0 0 1 22 0v14"/><path d="M10 28V15a6 6 0 0 1 12 0v13"/><path d="M3 28h26"/></svg>`;
const ARROW = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
const EXT = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>`;
const CHEV = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;

/** Sized engine icon (the shared set's paths carry no size). */
function ico(name: string, size = 22): string {
  return iconSvg(name).replace("<svg ", `<svg width="${size}" height="${size}" `);
}

// ── the walk: subject order, labels and topic words ─────────────────────────────────────

/** The order a guest meets a place in. Subjects outside this list never become a step
 *  (bathroom, toilet, parking, detail, sign_map, people_doc, other): a walk does not
 *  stop at the toilet. */
const WALK_ORDER = ["exterior", "pool_garden", "view", "dining", "interior"] as const;
export type WalkSubject = (typeof WALK_ORDER)[number];

/** The step heading — names the photo's SUBJECT, which the vision verdict established.
 *  A literal per subject (the i18n extractor collects double-quoted T() literals). */
function walkLabel(d: SiteData, s: WalkSubject): string {
  switch (s) {
    case "exterior":
      return T(d, "A ház kívülről");
    case "pool_garden":
      return T(d, "Kert és udvar");
    case "view":
      return T(d, "A kilátás");
    case "dining":
      return T(d, "Asztalnál");
    case "interior":
      return T(d, "Odabent");
  }
}

export interface WalkStep {
  readonly subject: WalkSubject;
  readonly photo: Photo;
}

/**
 * The walk's steps (exported for tooling). `skip` = photos the page already shows above the
 * walk (the hero collage) — the walk never repeats them. Fewer than three steps → [] (no walk).
 */
export function walkSteps(photos: readonly Photo[], skip: ReadonlySet<string>): WalkStep[] {
  const first = new Map<WalkSubject, Photo>();
  for (const p of photos) {
    if (skip.has(p.url) || !p.subject) continue;
    const s = p.subject as WalkSubject;
    if ((WALK_ORDER as readonly string[]).includes(s) && !first.has(s)) first.set(s, p);
  }
  const subjects = WALK_ORDER.filter((s) => first.has(s));
  if (subjects.length < WALK_MIN_STEPS) return [];
  return subjects.map((s) => ({ subject: s, photo: first.get(s)! }));
}

/** The fewest steps that still make a walk (ADR-0304 ③: below this, no walk at all). */
export const WALK_MIN_STEPS = 3;

/** The hero collage — the photos the walk never repeats. ONE definition for the render
 *  and for the console's readiness read-out, so the two can never disagree. */
export function walkCollage(photos: readonly Photo[]): Photo[] {
  return photos.slice(0, 3);
}

/** A step heading in a given language — the console names the missing subjects with
 *  exactly the words the page would print. */
export function walkSubjectLabel(lang: string | undefined, s: WalkSubject): string {
  return walkLabel({ lang } as SiteData, s);
}

export const WALK_SUBJECTS: readonly WalkSubject[] = WALK_ORDER;

/**
 * Will this photo set walk? (K2 / S-1, Elek 2026-10-02.) The owner ruled that with too few
 * subjects the walk is simply left out — but the console said nothing, and the curator got
 * a plain one-column page named „Séta a kapun át”. `unknown` = no photo carries a vision
 * subject yet (the generation measures it), so nobody can tell in advance.
 */
export interface WalkReadiness {
  readonly state: "ok" | "short" | "unknown";
  /** Walk subjects that have a photo outside the collage, in walk order. */
  readonly have: readonly WalkSubject[];
  /** Walk subjects shown ONLY in the collage (the walk does not repeat them). */
  readonly collageOnly: readonly WalkSubject[];
  readonly steps: number;
  readonly need: number;
}
export function walkReadiness(photos: readonly Photo[]): WalkReadiness {
  const collage = walkCollage(photos);
  const steps = walkSteps(photos, new Set(collage.map((p) => p.url)));
  const subj = (ps: readonly Photo[]) =>
    new Set(ps.map((p) => p.subject).filter((x): x is string => Boolean(x)));
  const rest = subj(photos.slice(collage.length));
  const inCollage = subj(collage);
  const have = WALK_ORDER.filter((s) => rest.has(s));
  const collageOnly = WALK_ORDER.filter((s) => inCollage.has(s) && !rest.has(s));
  const state = steps.length ? "ok" : photos.some((p) => p.subject) ? "short" : "unknown";
  return { state, have, collageOnly, steps: steps.length, need: WALK_MIN_STEPS };
}

const WALK_CSS = `
/* shared module sections dressed to this template's rhythm (ADR-0057) */
:root{
  --cit-modsec-py:88px;
  --cit-modsec-maxw:1320px;
  --cit-modsec-px:clamp(16px,2.5vw,32px);
  --cit-modsec-divider:0;
  --cit-modsec-head-align:left;
  --cit-modsec-head-mb:28px;
  --cit-modsec-head-size:clamp(2rem,7vw,3.6rem);
  --cit-modsec-head-weight:700;
  --cit-modsec-card-radius:calc(var(--cit-radius) / 2.2);
  --cit-modsec-card-pad:18px;
  --cit-modsec-card-bg:var(--cit-surface);
  --cit-modsec-card-border:1px solid var(--cit-line);
  --wk-accent-text:color-mix(in srgb,var(--cit-accent) 80%,var(--cit-ink));
  --wk-r-sm:calc(var(--cit-radius) / 2.2);
  --wk-gutter:16px;
  --wk-head:60px;
  --wk-ease:cubic-bezier(.22,.8,.24,1)}
.cit-tpl-walk-through .cit-modsec h2{font-family:var(--cit-font-display);letter-spacing:-.025em;line-height:1.02}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;overflow-x:clip;scroll-behavior:smooth}
body{margin:0;background:var(--cit-bg);color:var(--cit-ink);font:400 1.0625rem/1.6 var(--cit-font-body);overflow-x:clip}
img{display:block;max-width:100%;height:auto}
a{color:var(--wk-accent-text);text-underline-offset:.2em}
/* the shared modules' button: the bare a{} colour above would paint its label in the accent
   ON the accent (measured: an invisible „Szabad időpontok megtekintése”) */
.cit-tpl-walk-through a.cit-btn,.cit-tpl-walk-through .cit-btn{color:var(--cit-on-accent);border-radius:999px;min-height:50px;
  display:inline-flex;align-items:center;justify-content:center;padding:12px 24px}
:focus-visible{outline:3px solid var(--cit-accent);outline-offset:3px;border-radius:4px}
h1,h2,h3{font-family:var(--cit-font-display);font-weight:700;line-height:1.02;margin:0;letter-spacing:-.025em;text-wrap:balance}
h2{font-size:clamp(2.2rem,9vw,4.4rem)}
h3{font-size:1.35rem;letter-spacing:-.01em;line-height:1.15}
p{margin:0 0 1em}
.wk-wrap{max-width:1320px;margin:0 auto;padding:0 var(--wk-gutter)}
.wk-sec{padding:72px 0}
.wk-kicker{font-size:1.0625rem;color:var(--cit-muted);margin-top:14px;max-width:34em}

.wk-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:50px;padding:12px 24px;
  border-radius:999px;font:600 1rem/1.2 var(--cit-font-body);text-decoration:none;border:2px solid transparent;cursor:pointer;
  transition:transform .25s var(--wk-ease),background-color .2s}
.wk-btn:active{transform:scale(.96)}
.wk-btn-acc{background:var(--cit-accent);color:var(--cit-on-accent)}
.wk-btn-acc:hover{background:color-mix(in srgb,var(--cit-accent) 85%,var(--cit-ink))}
.wk-btn-line{border-color:var(--cit-ink);color:var(--cit-ink);background:transparent}
.wk-btn-line:hover{background:var(--cit-ink);color:var(--cit-surface)}

/* ── header: sticky, brand + section links + the booking pill (desktop only) ── */
.wk-top{position:sticky;top:0;z-index:40;background:var(--cit-bg);border-bottom:1px solid var(--cit-line)}
.wk-top .wk-wrap{display:flex;align-items:center;gap:10px;min-height:var(--wk-head)}
.wk-brand{font:700 1.15rem/1.05 var(--cit-font-display);letter-spacing:-.02em;color:var(--cit-ink);text-decoration:none;
  margin-right:auto;display:flex;align-items:center;gap:10px;min-height:44px;min-width:0;padding-right:56px}
.wk-brand span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wk-brand svg{flex:none;color:var(--cit-accent)}
.wk-nav{display:none}
.wk-top .wk-btn{min-height:44px;padding:8px 18px;display:none}

/* ── hero: text first, stepped collage ── */
.wk-hero{padding:28px 0 56px}
.wk-hero-grid{display:grid;gap:28px}
.wk-hero h1{font-size:min(clamp(2.7rem,12.5vw,6.2rem),var(--cit-hero-cap,999px))}
.wk-where{display:inline-flex;align-items:center;gap:8px;font-weight:600;color:var(--wk-accent-text);margin:0 0 16px}
.wk-intro{font-size:1.125rem;color:var(--cit-muted);margin:18px 0 24px;max-width:30em}
.wk-cta{display:flex;flex-wrap:wrap;gap:10px}
.wk-collage{position:relative;display:grid;grid-template-columns:repeat(6,1fr);grid-template-rows:repeat(6,1fr);aspect-ratio:1/1;margin:0}
.wk-collage figure{margin:0;overflow:hidden;border-radius:var(--cit-radius);background:var(--cit-line)}
.wk-collage img{width:100%;height:100%;object-fit:cover}
.wk-collage .c1{grid-column:1/5;grid-row:1/5;z-index:1}
.wk-collage .c2{grid-column:4/7;grid-row:3/7;z-index:2;border:6px solid var(--cit-bg)}
.wk-collage .c3{grid-column:1/4;grid-row:5/7;z-index:3;border:6px solid var(--cit-bg);margin-top:-12%}
/* fewer photos: the collage closes ranks instead of leaving a hole */
.wk-collage.n1 .c1{grid-column:1/7;grid-row:1/7}
.wk-collage.n2 .c1{grid-column:1/6;grid-row:1/6}
.wk-collage.n2 .c2{grid-column:3/7;grid-row:3/7}
/* first screen: the slabs play on LOAD, never on scroll (the hero is always in view) */
.cit-motion .wk-collage figure{animation:wkSlab .9s var(--wk-ease) both}
.cit-motion .wk-collage .c2{animation-delay:.17s}
.cit-motion .wk-collage .c3{animation-delay:.33s}
@keyframes wkSlab{from{opacity:0;transform:translateY(28px) rotate(-1.5deg)}to{opacity:1;transform:none}}

/* ── numbers band ──
   ⛔ The approved mock's figures slid up only when the band scrolled into view, and on the
   owner's own screen the band sat at the bottom edge of the first screen: he saw the labels
   with NO numbers. The band is first-screen furniture, so the slide plays on LOAD. */
.wk-stats{padding:0 0 24px}
.wk-stats ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;border-top:2px solid var(--cit-ink)}
.wk-stats li{padding:16px 12px 18px 0;border-bottom:1px solid var(--cit-line)}
.wk-stats li:nth-child(odd){border-right:1px solid var(--cit-line)}
.wk-stats li:nth-child(even){padding-left:14px}
.wk-stats li:only-child{border-right:0}
.wk-num{display:block;overflow:hidden;padding-bottom:2px}
.wk-num b{display:inline-block;font:700 2.3rem/1 var(--cit-font-display);letter-spacing:-.03em;white-space:nowrap}
.wk-num small{font:600 1rem var(--cit-font-body);color:var(--cit-muted)}
.wk-stats li>span:last-child{display:block;color:var(--cit-muted);font-size:.9375rem;margin-top:6px;line-height:1.35}
.cit-motion .wk-num b{animation:wkNum .9s var(--wk-ease) .25s both}
.cit-motion .wk-stats li:nth-child(2) .wk-num b{animation-delay:.35s}
.cit-motion .wk-stats li:nth-child(3) .wk-num b{animation-delay:.45s}
.cit-motion .wk-stats li:nth-child(4) .wk-num b{animation-delay:.55s}
@keyframes wkNum{from{transform:translateY(105%)}to{transform:none}}

/* ── the walk — paired layout by default (no JS, reduced motion, tooling) ── */
.wk-walk-head{margin-bottom:28px}
.wk-steps{list-style:none;margin:0;padding:0;display:grid;gap:36px}
.wk-step figure{margin:0 0 14px;border-radius:var(--cit-radius);overflow:hidden;background:var(--cit-line);position:relative}
.wk-step figure img{width:100%;aspect-ratio:4/3;object-fit:cover}
.wk-step figcaption{position:absolute;left:12px;top:12px;font-size:.8125rem;font-weight:600;
  background:color-mix(in srgb,var(--cit-ink) 72%,transparent);color:var(--cit-surface);padding:4px 10px;border-radius:999px}
.wk-step h3{margin-bottom:6px}
.wk-step p{margin:0;color:var(--cit-muted)}
.wk-step .wk-txt{max-width:30em}
.wk-stage{display:none}
.wk-feat{margin-top:44px;display:grid;list-style:none;padding:0;border-top:2px solid var(--cit-ink)}
.wk-feat li{display:flex;gap:14px;align-items:center;padding:16px 0;border-bottom:1px solid var(--cit-line);font-weight:600}
.wk-feat svg{width:28px;height:28px;flex:none;color:var(--wk-accent-text)}

/* the walk — story mode (the story engine adds .cit-story: JS + motion allowed) */
.wk-walk-grid.cit-story{position:relative}
.cit-story .wk-stage{display:block;position:sticky;top:var(--wk-head);height:calc(100svh - var(--wk-head));overflow:hidden;
  margin:0 calc(var(--wk-gutter) * -1)}
.cit-story .wk-stage figure{position:absolute;inset:0;margin:0;border-radius:0;opacity:0;transform:scale(1.08);
  transition:opacity 1s var(--wk-ease),transform 1.6s var(--wk-ease)}
.cit-story .wk-stage figure.cit-on{opacity:1;transform:none}
.cit-story .wk-stage figure img{width:100%;height:100%;object-fit:cover;aspect-ratio:auto}
.cit-story .wk-stage figcaption{max-width:calc(100% - 64px)}
.wk-rail{position:absolute;right:14px;top:14px;bottom:14px;width:4px;border-radius:2px;
  background:color-mix(in srgb,var(--cit-surface) 40%,transparent);overflow:hidden;z-index:3}
.wk-rail i{position:absolute;inset:0;background:var(--cit-surface);transform-origin:top;transform:scaleY(0);transition:transform .8s var(--wk-ease)}
.cit-story .wk-steps{position:relative;z-index:2;margin-top:calc((100svh - var(--wk-head)) * -1);gap:0}
/* The card sits in the MIDDLE of its step, not at the bottom (the approved mock): the stage
   switches photos when a step crosses the screen's centre line, so a bottom-anchored card spent
   the upper half of its journey over the NEXT step's photo — „Kert és udvar” over a kitchen
   (measured at 390px). Centred, it rides over its own photo through the middle of the screen —
   and only the ACTIVE step's card is shown: a centred card still reached the screen's edge while
   the neighbouring step held the centre line, and stood over that step's photo in 8 of 126
   measured positions (Három Huszár). Desktop keeps the approved muted look: there the text sits
   BESIDE the panel, never on a photo. */
.cit-story .wk-step{min-height:calc(100svh - var(--wk-head));display:flex;align-items:center;padding:0}
.cit-story .wk-step .wk-txt{background:var(--cit-surface);border-radius:var(--cit-radius);padding:20px 20px 22px;box-shadow:var(--cit-shadow);
  transition:transform .6s var(--wk-ease),opacity .6s}
.cit-story .wk-step:not(.cit-on) .wk-txt{transform:scale(.97);opacity:0}
.cit-story .wk-step:not(.cit-on) h3{color:var(--cit-muted)}
.cit-story .wk-step > figure{display:none}

/* ── rooms: ruled rows ── */
.wk-rooms{background:var(--cit-surface)}
.wk-room-list{display:grid;margin-top:32px;border-top:2px solid var(--cit-ink)}
.wk-room{border-bottom:1px solid var(--cit-line)}
.wk-roomlink{display:grid;gap:14px;padding:24px 0 26px;color:inherit;text-decoration:none;cursor:pointer}
.wk-room .cit-rmbox{position:relative;display:block;border-radius:var(--wk-r-sm);overflow:hidden;aspect-ratio:4/3;background:var(--cit-line)}
.wk-room .cit-rmbox img{width:100%;height:100%;object-fit:cover;transition:transform .5s var(--wk-ease)}
.wk-roomlink:hover .cit-rmbox img{transform:scale(1.04)}
.wk-room h3{font-size:clamp(1.6rem,6vw,2.3rem)}
.wk-chips{display:flex;flex-wrap:wrap;gap:8px;list-style:none;margin:12px 0 0;padding:0}
.wk-chips li{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:6px 14px;border-radius:999px;background:var(--cit-bg);font-weight:500}
.wk-chips svg{color:var(--wk-accent-text)}
.wk-price{font:700 1.5rem/1.1 var(--cit-font-display);margin:0}
.wk-go{justify-self:start;pointer-events:none}
.wk-go svg{transition:transform .3s var(--wk-ease)}
.wk-roomlink:hover .wk-go svg{transform:translateX(4px)}

/* ── gallery: tall-cell grid, every photo in the slot (contract gallery-cap) ── */
.wk-gal{display:grid;grid-template-columns:1fr 1fr;grid-auto-flow:dense;gap:8px;margin:28px 0 0;padding:0;list-style:none}
.wk-gal figure{margin:0;height:100%;border-radius:var(--wk-r-sm);overflow:hidden;background:var(--cit-line)}
.wk-gal img{width:100%;height:100%;aspect-ratio:4/3;object-fit:cover;transition:transform .6s var(--wk-ease)}
.wk-gal .tall{grid-row:span 2}
.wk-gal .tall img{aspect-ratio:auto}
.wk-gal figure:hover img{transform:scale(1.04)}
.wk-gact{margin-top:24px}
.wk-gact .wk-btn[hidden]{display:none}

/* ── reviews on the accent band ── */
.wk-reviews{background:var(--cit-accent);color:var(--cit-on-accent)}
.wk-reviews h2{font-size:clamp(2rem,8vw,3.6rem)}
.wk-reviews .wk-kicker{color:var(--cit-on-accent);opacity:.92}
.wk-rv-grid{display:grid;margin-top:32px;border-top:2px solid var(--cit-on-accent)}
.wk-rv{display:grid;gap:8px;padding:22px 0;border-bottom:1px solid color-mix(in srgb,var(--cit-on-accent) 40%,transparent);color:var(--cit-on-accent);text-decoration:none}
.wk-rv:focus-visible{outline-color:var(--cit-on-accent)}
.wk-big{font:700 4.4rem/.9 var(--cit-font-display);letter-spacing:-.04em}
.wk-big small{font:600 1.1rem var(--cit-font-body);letter-spacing:0;opacity:.85}
.wk-stars{display:inline-flex;gap:3px;color:var(--cit-on-accent)}
.wk-stars svg{width:24px;height:24px}
.wk-lnk{display:inline-flex;align-items:center;gap:8px;font-weight:600;text-decoration:underline;text-underline-offset:.2em;min-height:44px}
.wk-quote{margin:0;padding:22px 0;border-bottom:1px solid color-mix(in srgb,var(--cit-on-accent) 40%,transparent)}
.wk-quote blockquote{margin:0;font:500 1.2rem/1.45 var(--cit-font-body)}
.wk-quote figcaption{margin-top:10px;font-weight:600;opacity:.9}

/* ── FAQ ── */
.wk-faq-list{margin-top:28px;border-top:2px solid var(--cit-ink)}
.wk-faq-list details{border-bottom:1px solid var(--cit-line)}
.wk-faq-list summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:60px;
  padding:12px 0;cursor:pointer;font:700 1.2rem/1.25 var(--cit-font-display);letter-spacing:-.01em}
.wk-faq-list summary::-webkit-details-marker{display:none}
.wk-faq-list summary svg{transition:transform .35s var(--wk-ease);flex:none}
.wk-faq-list details[open] summary svg{transform:rotate(180deg)}
.wk-faq-list details p{color:var(--cit-muted);margin:0 0 18px;max-width:40em}

/* ── the closing band: dark ground, the shared booking surface as a light card ── */
.wk-enq{background:var(--cit-ink);color:var(--cit-surface);padding:56px 0 8px}
.wk-enq h2{color:var(--cit-surface)}
.wk-enq .wk-kicker{color:color-mix(in srgb,var(--cit-surface) 82%,var(--cit-ink));margin:0}
.wk-enq .wk-kicker a{color:var(--cit-surface)}
.wk-enq .cit-enquiry{margin:22px 0 0}
/* the full booking section follows right below with its own „Foglalás” heading: the band's
   title + jump button would only repeat it (measured: „Foglalás / Foglalás”, the gate-opening
   rule). The band itself stays — it is #cit-enquiry, the anchor the booking buttons point at. */
.wk-enq:has(#cit-booking) .cit-enquiry-bar-inner{display:none}
.wk-enq .cit-enquiry-bar-inner{display:flex;flex-wrap:wrap;align-items:center;gap:12px 18px;margin:0}
.wk-enq .cit-enquiry-bar-title{margin:0;color:var(--cit-surface);font:700 1.5rem/1.1 var(--cit-font-display);letter-spacing:-.02em}
.wk-enq .cit-modsec{background:transparent;color:var(--cit-surface);--cit-modsec-py:40px}
.wk-enq .cit-modsec h2{color:var(--cit-surface)}
.wk-enq .cit-modsec [data-cit-module="booking"],
.wk-enq .cit-modsec form{background:var(--cit-surface);color:var(--cit-ink);border-radius:var(--cit-radius);padding:22px 18px}
.wk-enq .cit-modsec__note{color:color-mix(in srgb,var(--cit-surface) 82%,var(--cit-ink))}

/* ── footer ── */
.wk-foot{background:var(--cit-ink);color:var(--cit-surface);border-top:1px solid color-mix(in srgb,var(--cit-surface) 16%,transparent)}
.wk-foot a{color:var(--cit-surface)}
.wk-foot-grid{display:grid;gap:18px;padding-top:36px;padding-bottom:36px}
.wk-fname{font:700 1.6rem/1.1 var(--cit-font-display);letter-spacing:-.02em;margin:0 0 8px}
.wk-foot address{font-style:normal;color:color-mix(in srgb,var(--cit-surface) 82%,var(--cit-ink))}
.wk-ftel{display:inline-flex;gap:8px;align-items:center;min-height:44px;font-weight:600}
.wk-foot nav{display:flex;flex-wrap:wrap;gap:0 20px}
.wk-foot nav a{display:inline-flex;align-items:center;min-height:44px;min-width:44px}

/* ── phone booking bar (ADR-0253: the shared runtime shows it only half-way) ── */
.wk-fab{position:fixed;right:var(--wk-gutter);bottom:calc(14px + var(--citui-consent-h,0px) + env(safe-area-inset-bottom));z-index:35;
  display:flex;gap:8px;transition:transform .4s var(--wk-ease),opacity .4s}
.wk-fab .wk-btn{box-shadow:0 8px 24px -8px color-mix(in srgb,var(--cit-ink) 60%,transparent)}
.wk-fab .wk-btn-acc{border-color:var(--cit-surface)}
.wk-fab .wk-tel{width:50px;padding:0;background:var(--cit-surface);color:var(--cit-ink);border-color:var(--cit-ink)}

@media(min-width:720px){
  :root{--wk-gutter:32px}
  .wk-stats ul{grid-template-columns:repeat(4,1fr)}
  .wk-stats li,.wk-stats li:nth-child(even){padding:18px 18px 20px;border-right:1px solid var(--cit-line)}
  .wk-stats li:first-child{padding-left:0}
  .wk-stats li:last-child{border-right:0}
  .wk-gal{grid-template-columns:repeat(3,1fr)}
  .wk-rv-grid{grid-template-columns:1fr 1fr;gap:0 40px}
  .wk-roomlink{grid-template-columns:minmax(0,3fr) minmax(0,5fr);align-items:center;gap:28px}
}
@media(min-width:1000px){
  :root{--wk-head:72px}
  .wk-sec{padding:120px 0}
  .wk-enq{padding:120px 0 24px}
  .wk-nav{display:flex;gap:2px;margin-right:auto}
  .wk-nav a{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;border-radius:999px;color:var(--cit-ink);text-decoration:none;font-weight:500}
  .wk-nav a:hover{background:var(--cit-surface)}
  .wk-brand{margin-right:28px;padding-right:0}
  .wk-top .wk-btn{display:inline-flex}
  .wk-hero{padding:56px 0 80px}
  .wk-hero-grid{grid-template-columns:6fr 6fr;gap:64px;align-items:center}
  .wk-hero h1{font-size:min(clamp(4rem,6.4vw,6.6rem),var(--cit-hero-cap,999px))}
  .wk-num b{font-size:3.4rem}
  .wk-walk-head{display:grid;grid-template-columns:7fr 5fr;gap:64px;align-items:end;margin-bottom:56px}
  .wk-steps{grid-template-columns:1fr 1fr 1fr;gap:40px 28px}
  .wk-walk-grid.cit-story{display:grid;grid-template-columns:7fr 5fr;gap:64px}
  .cit-story .wk-stage{margin:0;border-radius:var(--cit-radius);top:calc(var(--wk-head) + 24px);height:calc(100vh - var(--wk-head) - 48px)}
  .cit-story .wk-steps{margin-top:0;display:block}
  .cit-story .wk-step{min-height:78vh;align-items:center;padding:0}
  .cit-story .wk-step:first-child{min-height:60vh;align-items:flex-start}
  .cit-story .wk-step .wk-txt{background:none;box-shadow:none;padding:0}
  .cit-story .wk-step h3{font-size:2.4rem;letter-spacing:-.025em;margin-bottom:12px}
  .cit-story .wk-step p{font-size:1.15rem}
  .cit-story .wk-step:not(.cit-on) .wk-txt{transform:translateY(12px);opacity:1}
  .wk-feat{grid-template-columns:repeat(4,1fr);gap:0 28px;margin-top:72px}
  .wk-rooms-top{display:grid;grid-template-columns:5fr 7fr;gap:64px;align-items:end}
  .wk-roomlink{grid-template-columns:minmax(0,3fr) minmax(0,5fr) minmax(0,3fr);padding:32px 0}
  .wk-go{justify-self:end}
  .wk-gal{grid-template-columns:repeat(4,1fr);gap:12px}
  .wk-rv-wrap{display:grid;grid-template-columns:5fr 7fr;gap:72px;align-items:start}
  .wk-rv-grid{margin-top:0}
  .wk-big{font-size:6rem}
  .wk-foot-grid{grid-template-columns:2fr 1fr 1fr;align-items:start}
  .wk-enq .cit-modsec [data-cit-module="booking"],.wk-enq .cit-modsec form{padding:40px}
}
/* landscape phone: the hero fits under the one-row header, the name is height-bound */
@media(max-height:500px) and (min-width:641px){
  .wk-hero h1{font-size:clamp(2.2rem,11vh,3.4rem)}
  .wk-hero-grid{grid-template-columns:6fr 5fr;align-items:center}
}
@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  .wk-collage figure,.wk-num b{animation:none!important}
}
`;

function renderWalk(recipe: Recipe, data: SiteData, phase: RenderPhase): string {
  const skin = SKINS[recipe.skin] ?? SKINS["gravel-grotesque"] ?? Object.values(SKINS)[0]!;
  const photos = data.photos;
  const hero = heroPhoto(data);
  const rooms = roomsFor(data, phase);
  const heroCopy = copyOf(recipe, "hero");
  const featCopy = copyOf(recipe, "features");
  const galCopy = copyOf(recipe, "gallery");
  const cta = ctaLabel(data, phase);
  const c = data.contact;
  const tel = c.phone ? `tel:${esc(c.phone.replace(/\s+/g, ""))}` : "";
  const place = data.place?.city ?? "";
  const where = heroCopy.eyebrow ?? place;
  const lede = firstSentence(data.intro, 220) || data.tagline;
  // The hero line: the copywriter's lead when there is one, else the intro's first sentence.
  const heroLine = heroCopy.lead ?? lede;
  // The walk's intro line must not repeat the hero line.
  const walkLede = heroCopy.lead ? lede : data.tagline !== heroLine ? data.tagline : "";

  // ── hero collage: up to three photos, photos[0] (the chosen cover) leads ──
  const collage = walkCollage(photos);
  const collageSet = new Set(collage.map((p) => p.url));

  // ── the walk ──
  const steps = walkSteps(photos, collageSet);
  const feat = data.highlights.slice(0, 8);

  // ── numbers band: the real rating first, then the real stats (deduplicated) ──
  const facts: { n: string; small?: string; l: string }[] = [];
  const rating = data.rating;
  const ratingStr = rating ? String(rating.value).replace(".", ",") : "";
  if (rating) {
    facts.push({
      n: ratingStr,
      small: `/${ratingScale(data)}`,
      l: rating.count ? T(data, "{n} vendégértékelés átlaga", { n: rating.count }) : T(data, "értékelés"),
    });
  }
  for (const s of data.stats ?? []) {
    if (facts.length >= 4) break;
    // the rating stat says what the rating cell already says
    if (rating && (s.icon === "star" || s.value === ratingStr)) continue;
    if (facts.some((f) => f.l.toLowerCase() === s.label.toLowerCase())) continue;
    facts.push({ n: s.value, l: s.label });
  }

  // ── header ──
  const links = [
    steps.length || feat.length || walkLede ? { href: "#wk-walk", label: T(data, "A ház") } : null,
    rooms ? { href: "#cit-rooms", label: roomsLabel(data) } : null,
    photos.length ? { href: "#wk-gallery", label: T(data, "Képek") } : null,
    rating || data.reviews?.length ? { href: "#wk-reviews", label: T(data, "Értékelések") } : null,
    data.faqs?.length ? { href: "#wk-faq", label: T(data, "Kérdések") } : null,
  ].filter((l): l is { href: string; label: string } => Boolean(l));
  const header = `<header class="wk-top">
    <div class="wk-wrap">
      <a class="wk-brand" href="#top">${ARCH}<span>${esc(data.name)}</span></a>
      <nav class="wk-nav" data-cit-navsrc aria-label="${esc(T(data, "Fő navigáció"))}">
        ${links.map((l) => `<a href="${l.href}">${l.label}</a>`).join("\n        ")}
      </nav>
      <a class="wk-btn wk-btn-acc" href="#cit-enquiry">${cta}</a>
    </div>
  </header>`;

  const collageHtml = collage.length
    ? `<div class="wk-collage n${collage.length}">${collage
        .map(
          (p, i) =>
            `<figure class="c${i + 1}"><img src="${esc(p.url)}" alt="${esc(p.alt || data.name)}"${
              i < 2 ? ` fetchpriority="high"` : ""
            }></figure>`,
        )
        .join("")}</div>`
    : `<div class="wk-collage n1"><figure class="c1">${photoFill(data.name)}</figure></div>`;

  const heroBlock = `<section class="wk-hero" id="top">
    <div class="wk-wrap wk-hero-grid">
      <div>
        ${where ? `<p class="wk-where"${hookPick(["hero.eyebrow", heroCopy.eyebrow])}>${ico("location", 20)}${esc(where)}</p>` : ""}
        <h1 ${heroFit(data.name)}>${esc(data.name)}</h1>
        ${heroLine ? `<p class="wk-intro"${hookPick(["hero.lead", heroCopy.lead], ["intro", firstSentence(data.intro, 220), { part: "first-sentence" }], ["tagline", data.tagline])}>${accented(heroLine, heroCopy.accent)}</p>` : ""}
        <div class="wk-cta">
          <a class="wk-btn wk-btn-acc" href="#cit-enquiry">${cta}${ARROW}</a>
          ${steps.length ? `<a class="wk-btn wk-btn-line" href="#wk-walk">${T(data, "Körbenézek")}</a>` : ""}
        </div>
      </div>
      ${collageHtml}
    </div>
  </section>`;

  const statsBlock = facts.length
    ? `<section class="wk-stats" aria-label="${esc(T(data, "Számokban"))}">
    <div class="wk-wrap"><ul>
      ${facts
        .map(
          (f) =>
            `<li><span class="wk-num"><b>${esc(f.n)}${f.small ? `<small>&nbsp;${esc(f.small)}</small>` : ""}</b></span><span>${esc(f.l)}</span></li>`,
        )
        .join("\n      ")}
    </ul></div>
  </section>`
    : "";

  // „Séta” only where there IS a walk — over a highlights list it would name a scene that is not there.
  const walkTitle = featCopy.title ?? (steps.length ? T(data, "Séta a házban") : T(data, "A ház"));
  const stepsHtml = steps.length
    ? `<div class="wk-walk-grid" data-cit-story>
        <div class="wk-stage" aria-hidden="true" data-cit-story-stage><span class="wk-rail"><i data-cit-story-rail></i></span></div>
        <ol class="wk-steps">
          ${steps
            .map((s) => {
              const label = walkLabel(data, s.subject);
              return `<li class="wk-step" data-cit-story-step>
            <figure><img src="${esc(s.photo.url)}" alt="${esc(s.photo.alt || label)}" loading="lazy"><figcaption>${label}</figcaption></figure>
            <div class="wk-txt"><h3>${label}</h3></div>
          </li>`;
            })
            .join("\n          ")}
        </ol>
      </div>`
    : "";
  const featHtml = feat.length
    ? `<ul class="wk-feat" aria-label="${esc(T(data, "Kiemelések"))}">${feat
        .map((h, i) => `<li${highlightHook(data, i)}>${amenityIconSvg(h, data.amenityIconMap)}${esc(h)}</li>`)
        .join("")}</ul>`
    : "";
  // ⛔ Nothing to say → no section (no heading over an empty band, §B no-empty-band).
  const walkBlock =
    stepsHtml || featHtml || walkLede
      ? `<section id="wk-walk" class="wk-sec wk-walk">
    <div class="wk-wrap">
      <div class="wk-walk-head">
        <h2${hookPick(["features.title", featCopy.title])} ${mo("up")}>${accented(walkTitle, featCopy.accent)}</h2>
        ${walkLede ? `<p class="wk-kicker"${heroCopy.lead ? hookPick(["intro", firstSentence(data.intro, 220), { part: "first-sentence" }], ["tagline", data.tagline]) : copyHook("tagline")}>${esc(walkLede)}</p>` : ""}
      </div>
      ${stepsHtml}
      ${featHtml}
    </div>
  </section>`
      : "";

  const roomsBlock = rooms
    ? `<section id="cit-rooms" class="wk-sec wk-rooms" data-cit-module="rooms">
    <div class="wk-wrap">
      <div class="wk-rooms-top">
        <h2 ${mo("up")}>${roomsHeading(data)}</h2>
        ${roomsLead(data) ? `<p class="wk-kicker">${roomsLead(data)}</p>` : ""}
      </div>
      <div class="wk-room-list">
        ${rooms
          .map(
            (r, i) => `<article class="wk-room">${roomShell(
              data,
              r,
              i,
              "wk-roomlink",
              `<span class="cit-rmbox">${
                r.photo ? `<img src="${esc(r.photo.url)}" alt="${esc(r.photo.alt || r.name)}" loading="lazy">` : photoFill(r.name)
              }${roomHint(data, r)}</span>
          <div><h3>${esc(r.name)}</h3>${
            r.capacity
              ? `<ul class="wk-chips"><li>${ico("bed", 20)}${esc(r.capacity)}</li></ul>`
              : ""
          }${r.price ? `<p class="wk-price" style="margin-top:14px">${esc(r.price)}</p>` : ""}</div>
          ${r.presentation ? "" : `<span class="wk-btn wk-btn-acc wk-go">${T(data, "Részletek")}${ARROW}</span>`}`,
            )}${roomDetails(data, r, i)}</article>`,
          )
          .join("\n        ")}
      </div>
    </div>
  </section>`
    : "";

  // Contract gallery-cap: EVERY photo in the slot (the shared lightbox pages through all);
  // eleven show — the approved mock's count — the rest open in place under „Összes fotó”.
  // Order: photos the page does not show elsewhere first (galleryOrder, built below).
  const SHOWN = 11;
  const galleryOf = (ordered: readonly Photo[]): string =>
    ordered.length
      ? `<section id="wk-gallery" class="wk-sec">
    <div class="wk-wrap">
      <h2${hookPick(["gallery.title", galCopy.title])} ${mo("up")}>${galCopy.title ? accented(galCopy.title, galCopy.accent) : T(data, "Képek")}</h2>
      <div class="wk-gal" id="wk-galgrid" data-cit-module="gallery" data-cit-gexpandable>
        ${ordered
          .map(
            (p, i) =>
              `<figure${i === 1 ? ` class="tall"` : ""}${i >= SHOWN ? " data-cit-gextra" : ""}><img src="${esc(p.url)}" alt="${esc(p.alt || data.name)}" loading="lazy"></figure>`,
          )
          .join("\n        ")}
      </div>
      ${
        ordered.length > SHOWN
          ? `<div class="wk-gact"><button type="button" class="wk-btn wk-btn-line" data-cit-gexpand="wk-galgrid" aria-controls="wk-galgrid" aria-expanded="false" data-more="${esc(T(data, "Összes fotó ({n})", { n: ordered.length }))}" data-less="${esc(T(data, "Kevesebb fotó"))}" hidden>${T(data, "Összes fotó ({n})", { n: ordered.length })}</button></div>`
          : ""
      }
    </div>
  </section>`
      : "";

  // Real guest quotes only — a sample review never reaches a page (§B.17).
  const quotes = (data.reviews ?? []).slice(0, 4);
  const stars = honestStarCount(data);
  const ratingCard = rating
    ? (() => {
        const inner = `<span class="wk-big">${esc(ratingStr)}<small>&nbsp;/&nbsp;${ratingScale(data)}</small></span>
          ${stars ? `<span class="wk-stars" aria-hidden="true">${starIcon().repeat(stars)}</span>` : ""}
          ${rating.count ? `<span>${T(data, "{n} vendégértékelés átlaga", { n: rating.count })}</span>` : ""}`;
        // The number is verifiable at its source when we have the source's own page
        // (ADR-0046: a Google reviews URL — the only rating URL stored today).
        return rating.url && !rating.scale
          ? `<a class="wk-rv" href="${esc(rating.url)}" target="_blank" rel="noopener nofollow">${inner}
          <span class="wk-lnk">${T(data, "Megnézem a Google-on")}${EXT}</span></a>`
          : `<div class="wk-rv">${inner}</div>`;
      })()
    : "";
  const reviewBlock =
    rating || quotes.length
      ? `<section id="wk-reviews" class="wk-sec wk-reviews"${quotes.length ? ` data-cit-module="reviews"` : ""}>
    <div class="wk-wrap wk-rv-wrap">
      <div>
        <h2>${T(data, "Vendégek értékelése")}</h2>
      </div>
      <div class="wk-rv-grid">
        ${ratingCard}
        ${quotes
          .map(
            (q) => `<figure class="wk-quote"><blockquote>${esc(q.quote)}</blockquote>${
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
    ? `<section id="wk-faq" class="wk-sec">
    <div class="wk-wrap">
      <h2 ${mo("up")}>${T(data, "Kérdések")}</h2>
      <div class="wk-faq-list">
        ${data.faqs
          .map((f) => `<details><summary>${esc(f.q)}${CHEV}</summary><p>${esc(f.a)}</p></details>`)
          .join("\n        ")}
      </div>
    </div>
  </section>`
    : "";

  // No heading of our own: the shared booking section below carries the „Foglalás” <h2> and
  // the band its own title — a third one read as a stutter (measured on the first render).
  const enqBlock = `<div class="wk-enq">
    <div class="wk-wrap">
      ${bookingSlot(data, phase)}
      ${
        c.phone
          ? `<p class="wk-kicker" style="margin-top:14px">${T(data, "Telefonon is kereshető:")} <a href="${tel}">${esc(c.phone)}</a></p>`
          : ""
      }
    </div>
    ${slotMarker("closing")}
  </div>`;

  const footer = `<footer class="wk-foot" id="cit-contact">
    <div class="wk-wrap wk-foot-grid">
      <div>
        <p class="wk-fname">${esc(data.name)}</p>
        ${c.address ? `<address>${esc(c.address)}</address>` : ""}
        ${c.phone ? `<a class="wk-ftel" href="${tel}">${ico("phone", 20)}${esc(c.phone)}</a>` : ""}
        ${c.email ? `<p><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>` : ""}
      </div>
      <nav aria-label="${esc(T(data, "Lábléc"))}">
        ${links.slice(0, 3).map((l) => `<a href="${l.href}">${l.label}</a>`).join("")}
        <a href="#cit-enquiry">${cta}</a>
      </nav>
      <nav aria-label="${esc(T(data, "Jogi információk"))}">
        <a href="/adatvedelem">${T(data, "Adatvédelmi tájékoztató")}</a>
        <a href="/impresszum">${T(data, "Impresszum")}</a>
      </nav>
    </div>
  </footer>`;

  const fab = `<div class="wk-fab" data-cit-mobbar>
    ${c.phone ? `<a class="wk-btn wk-tel" href="${tel}" aria-label="${esc(T(data, "Hívás: {phone}", { phone: c.phone }))}">${ico("phone", 20)}</a>` : ""}
    <a class="wk-btn wk-btn-acc" href="#cit-enquiry">${cta}</a>
  </div>`;

  // The gallery leads with the photos the page does not show elsewhere (contract gallery-cap).
  const gallery = galleryOf(galleryOrder(photos, [heroBlock, walkBlock, roomsBlock, footer].join("")));

  return `<!doctype html>
<html lang="${data.lang ?? "hu"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(seoTitle(data))}</title>
  ${renderSeoHead(data, phase)}
  ${renderSkinFontLinks(skin)}
  <style>
  ${renderSkinVars(skin, data.palette?.accent)}

${WALK_CSS}
${HERO_FIT_CSS}
${motionCss("calm")}
${steps.length ? storyCss() : ""}
  </style>
</head>
<body class="cit-tpl-walk-through">
  ${header}
  <main>
  ${heroBlock}
  ${statsBlock}
  ${walkBlock}
  ${roomsBlock}
  ${slotMarker("showcase")}
  ${gallery}
  ${reviewBlock}
  ${slotMarker("trust")}
  ${slotMarker("practical")}
  ${faqBlock}
  ${enqBlock}
  </main>
  ${footer}
  ${fab}
  <script>${motionJs()}${steps.length ? storyJs() : ""}</script>
</body>
</html>`;
}

export const WALK_THROUGH: ArtTemplate = {
  id: "walk-through",
  label: "Séta a kapun át — szöveg-elsős hős, ragadós séta-jelenet a fotókból (tulaj által választott mock)", // i18n-exempt: operator-facing (console template picker)
  skins: ["gravel-grotesque"],
  render: renderWalk,
};
