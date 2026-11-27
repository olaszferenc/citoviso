// RENDERED-MOCK QUALITY GATE — the last look at the page before a lead gets the link (2026-11-24).
//
// WHY THIS EXISTS (owner, 2026-11-24): the week before, catastrophic mocks went out to leads
// under his name — a lead with 60 own photos got three town-church pictures, and the 78 new
// generator mocks of 11-24 ALL failed a manual look: the same photo 3–5 times on one page,
// attraction pictures from the portal (church tower, castle, house-rules scan, floor plan)
// shown as the lodging's own, mobile pages scrolling sideways on one long uppercase word, and
// a stock bedroom in the gallery. Every existing gate passed them: they read the DB inputs,
// none of them looked at the page the lead actually opens.
//
// WHAT IT DOES: renders the mock exactly as a phone does (390 px, motion off so every section
// is in its final state), scrolls the whole page so lazy images load, and fails it on:
//   repeat   — the same picture (same URL or same dHash, photoHash.ts) in two visible places
//   subject  — not a picture of the lodging: the local classifier (media/photoKind.ts) sees a
//              document, plan, ad, toilet, map, logo — or a sight of the area off the hero; also
//              a cached paid vision verdict of ad / sign-map / document / toilet
//   stock    — a sample picture (public/assets/stock or the styled library, engine/stock.ts) anywhere
//              but a MARKED gallery / room-card slot: in the hero, the opening, a band, the contact
//              picture, or without its „MINTA” mark (ADR-0479, plan kepnelkuli-hero ⑩; until
//              2026-11-25 any sample picture failed the page)
//   overflow — the page is wider than the phone (horizontal scroll)
//   broken   — an image that does not load
//   render   — the page could not be rendered at all (no render = no send)
//
// ⚠️ NOT A RULE: hovamenjek file names. "<town>-N.jpg" next to "<town>-<lodging>N.jpg" looked like
// the portal's attraction photos, but measured on Babarózsa (Gyenesdiás, 11-24) every "gyenesdias-N"
// was the lodging's own bedroom or house — the portal names only the first upload. Attraction
// pictures sit in the lodging's own portal folder; only a vision verdict can tell them apart.
//
// ⛔ NOT ACKNOWLEDGEABLE. The 11-24 incident's root cause was a bot that acknowledged the
// photo gate on all 318 queued mocks. This gate has no ack: a failing mock is regenerated.
// The verdict is cached in `mock_artifact.inputs.renderGate` against the file's mtime, so a
// rerender or regeneration is re-checked automatically.

import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { sql } from "kysely";
import { chromium, type Browser, type BrowserContext } from "playwright-core";
import sharp from "sharp";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { countryConfigSync, countryOfLead } from "../country.js";
import { isSamePicture, sizelessPhotoKey } from "../engine/samePicture.js";
import { repeatsText } from "../text/textOverlap.js";
import { dHashFromBuffer } from "../generator/photoHash.js";
import { readCachedScores, photoUrlKey } from "../generator/heroPick.js";
import { PORTAL_USER_AGENT } from "../scraper/sources/portals/politeness.js";
import { acquireRenderSlot } from "./heroShot.js";
import { classifyPhotoBuffer, fitsBand, fitsContact, fitsHero, fitsOpening, isOffPagePhoto, isRoomHero, photoKindAvailable, photoOverlayLabels } from "../media/photoKind.js";
import { createPhotoCache } from "./photoCache.js";
import { stockUrl } from "../engine/stock.js";
import { judgeTownPicture } from "../media/townPick.js";
import { TEXT_MIN_CONTRAST } from "../engine/palette.js";
import { headingKey } from "../text/headingKey.js";

/** Bump when the rules change: every cached verdict of an older version is re-checked. */
// 17 (11-27, HR approval chain): a town picture is judged at the picker's width (media/townPick.townJudgeInput) —
// the same input for the same rule; the page's 1280 px file had failed pictures the picker had passed at 330 px.
// 18 (11-27, ADR-0503 „Feltöltés elhagyás helyett”): the dim phone first screen, a room hero with an outside alternative,
// the hero title on its picture, the empty map box, a band caption that is no sentence.
// 19 (11-27, ADR-0505 ㉒): a hero with painted labels („A2(2+2)”).
export const RENDER_GATE_VERSION = 19;
/**
 * The tallest ink-free vertical run a phone page may have (CSS px at 390). Above it a whole band rendered empty
 * (a background that never painted, a section whose content is missing — the §B no-JS empty-band case). The
 * templates' own rhythm stays under it (measured 11-26 on the 18 sample mocks: wordmark-grow's tallest run is
 * 286 px); a thin SECTION (two cards and padding) is not a band and is handled by the generator's own rules.
 */
export const PAGE_MAX_GAP_PX = 400;

/**
 * The opening screen's top part must carry a picture, not a near-blank band (coordinator 2026-11-25, Igal: an
 * almost white hero). Measured on 20 blind first screens: Igal 95 % of its pixels light (luma > 200), every page
 * with a picture ≤ 9 %. At or above this share the hero is blank.
 */
export const HERO_MAX_LIGHT_SHARE = 0.6;

/** The phone's first screen, photo band (ADR-0503 ⑫, measured 11-27 on 41 live pages + Castor): mean luma under this = dark… */
export const HERO_SCREEN_DARK = 55;
/** Reference only (not a rule): above this the screen is no longer dim. The 41-page measurement: Castor 46.8 fails; a dark but
 *  sharp forest (62.6), a dusk garden (67.1) and the fixture's shaded facade (59) pass. */
export const HERO_SCREEN_DIM = 70;


/** The hero title is large text: WCAG's 3:1 for large text, against the picture behind it (⑮). */
export const HERO_TITLE_MIN_CONTRAST = 3;

/**
 * The hero title's colour against the picture behind its letters: the clip's grey pixels that are NOT the text colour
 * (|Δluma| > 40) are the picture; their median is the ground. Grey luma → WCAG luminance (sRGB curve).
 */
export function heroTitleContrast(rgb: readonly [number, number, number], grey: Uint8Array | Buffer, text: string): { ratio: number; text: string } | null {
  const textLuma = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  const ground: number[] = [];
  for (const v of grey) if (Math.abs(v - textLuma) > 40) ground.push(v);
  if (ground.length < grey.length * 0.2) return null; // nearly all text-coloured: no measurable ground
  ground.sort((a, b) => a - b);
  const bg = ground[Math.floor(ground.length / 2)]!;
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const lt = lin(textLuma);
  const lb = lin(bg);
  const ratio = (Math.max(lt, lb) + 0.05) / (Math.min(lt, lb) + 0.05);
  return { ratio: Math.round(ratio * 100) / 100, text };
}

/** Mean luma and Laplacian variance of the band 25–70 % down a greyscale clip (w × h, 1 byte a pixel). */
export function heroScreenStats(g: Uint8Array | Buffer, w: number, h: number): { midMean: number; midLap: number } {
  const H = Math.floor(h);
  const y0 = Math.round(H * 0.25);
  const y1 = Math.round(H * 0.7);
  let n = 0;
  let sum = 0;
  let m = 0;
  let m2 = 0;
  for (let y = Math.max(1, y0); y < Math.min(H - 1, y1); y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      sum += g[i]!;
      const l = 4 * g[i]! - g[i - 1]! - g[i + 1]! - g[i - w]! - g[i + w]!;
      n++;
      m += l;
      m2 += l * l;
    }
  }
  return n ? { midMean: sum / n, midLap: m2 / n - (m / n) ** 2 } : { midMean: 255, midLap: 1e9 };
}

/** A town page (no / few own photos, plan kepnelkuli-hero) carries at least this many distinct pictures (coordinator 2026-11-25: „tele kell lennie képpel”). */
export const TOWN_PAGE_MIN_PICTURES = 12;

/** The only places a MARKED sample picture may stand (plan kepnelkuli-hero ⑩, ADR-0479). */
const SAMPLE_MODULES = new Set(["gallery", "rooms"]);

/** The mock's town pictures (siteData.townPhoto / townGallery) — judged by the town rule, not the lodging rule. */
export interface TownUrls {
  readonly hero?: string;
  /** The pick's tier of the hero (town / land / region): the gate re-judges it at that tier, as it was picked. */
  readonly heroTier?: "town" | "land" | "region";
  readonly gallery: readonly string[];
}

const VIEWPORT = { width: 390, height: 844 };
/** The letter's picture (heroShot.ts VIEWPORT): its first screen is measured too. */
const DESKTOP_VIEWPORT = { width: 1216, height: 760 };
/** An image smaller than this on screen is an icon / logo / avatar, not a photo slot. */
const MIN_SLOT_PX = 80;
const IMG_GAP_MS = 400;
/** Network quiet = no request in flight and none started or finished for this long (Playwright's networkidle uses 500 ms). */
const QUIET_MS = 500;

/** Vision subjects that never belong on a lodging page shown to its owner. */
const FORBIDDEN_SUBJECTS = new Set(["ad_banner", "sign_map", "people_doc", "toilet"]);

export type RenderFindingCode = "repeat" | "subject" | "stock" | "overflow" | "broken" | "render" | "thin" | "gap" | "contrast";

export interface RenderFinding {
  readonly code: RenderFindingCode;
  /** Hungarian, operator-facing: what is wrong and where. */
  readonly detail: string;
  /** The picture the finding is about (photo findings): the retry step (gateRetry.ts) leaves it out of the next allotment. */
  readonly url?: string;
}

export interface RenderGateResult {
  readonly version: number;
  readonly mtime: number;
  readonly at: string;
  readonly verdict: "pass" | "fail";
  readonly findings: readonly RenderFinding[];
  /** Visible photo slots measured (for the report). */
  readonly slots: number;
  /** 0155: the country rule the verdict was judged by (dispatch_stock_ok); absent = true (older verdicts). */
  readonly stockOk?: boolean;
}

interface Slot {
  readonly u: string;
  /** The <img> carries the „MINTA” mark (render.ts withSampleMarks). */
  readonly sample?: boolean;
  readonly y: number;
  readonly x: number;
  readonly w: number;
  readonly h: number;
  readonly mod: string;
}

interface PageMeasure {
  readonly slots: Slot[];
  readonly broken: string[];
  readonly scrollWidth: number;
  readonly innerWidth: number;
  readonly wideText: string[];
  readonly brokenWords: string[];
  /** Texts on a fixed / sticky bar or in a heading / button under 4.5:1 against their painted ground (ADR-0500 ⑦). */
  readonly lowContrast?: { text: string; ratio: number; where: string }[];
  /** The desktop first screen = the letter's picture (filled by auditMockFile, not by MEASURE_JS). */
  readonly desktopBrokenWords?: string[];
  /** The tallest ink-free vertical run (CSS px) and where it starts. */
  readonly maxGap?: number;
  readonly gapAt?: number;
  /** Visible headings / captions in page order. */
  readonly texts?: { text: string; mod: string; y: number; tag?: string }[];
  /** The page title (the lodging's and the town's name): proper names for the text-repeat rule. */
  readonly title?: string;
}

const fileOf = (u: string): string => decodeURIComponent(photoUrlKey(u).split("/").pop() ?? u);

/** Two slots drawn on top of each other (a backdrop and its photo) are one place, not a repeat. */
function overlaps(a: Slot, b: Slot): boolean {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return ix * iy > 0.5 * Math.min(a.w * a.h, b.w * b.h);
}

const MEASURE_JS = `(() => {
  const MIN = ${MIN_SLOT_PX};
  const shown = (el) => {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.05) return false;
    }
    return true;
  };
  const modOf = (el) => {
    const m = el.closest("[data-cit-module]");
    if (m) return m.getAttribute("data-cit-module") || m.tagName.toLowerCase();
    const s = el.closest("section[id],header[id],footer[id]");
    return s ? s.tagName.toLowerCase() + "#" + s.id : "page";
  };
  const slots = [];
  const broken = [];
  const push = (el, u) => {
    const r = el.getBoundingClientRect();
    if (r.width < MIN || r.height < MIN || !shown(el)) return;
    slots.push({ u, y: Math.round(r.top + scrollY), x: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height), mod: modOf(el), sample: el.tagName === "IMG" && el.hasAttribute("data-cit-sample") });
  };
  for (const img of Array.from(document.images)) {
    const u = img.currentSrc || img.src;
    if (!u || u.startsWith("data:")) continue;
    const r = img.getBoundingClientRect();
    // complete && no pixels = a failed load; a lazy image off-screen (a swipe strip's later cards)
    // is simply not loaded yet — not broken (wordmark-grow, 11-24: 20 false alarms).
    if (r.width >= MIN && r.height >= MIN && shown(img) && img.complete && img.naturalWidth === 0) broken.push(u);
    push(img, u);
  }
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    const bg = getComputedStyle(el).backgroundImage;
    if (!bg || bg === "none") continue;
    const re = /url\\(["']?([^"')]+)["']?\\)/g;
    let m;
    while ((m = re.exec(bg))) if (!m[1].startsWith("data:")) push(el, new URL(m[1], location.href).href);
  }
  // A long word wider than its own box (a hero headline's "KERÉKPÁRTÁROLÓVAL" on a phone) is cut by
  // the section edge even when the page itself does not scroll sideways — measure the text boxes.
  const iw = window.innerWidth;
  const wideText = [];
  for (const el of Array.from(document.querySelectorAll("h1,h2,h3,h4,p,li,a,span,blockquote,figcaption,button,label,dt,dd"))) {
    if (!shown(el) || !(el.textContent || "").trim()) continue;
    const cs = getComputedStyle(el);
    if (cs.overflowX !== "visible" || cs.whiteSpace === "nowrap" || cs.display === "inline") continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.bottom < 0) continue;
    // Past the SCREEN edge, not merely past its own box (a centred masthead name 6 px wider than
    // its box still sits inside the phone — Mecsekgyöngye, 11-24).
    if (r.left + Math.max(el.scrollWidth, r.width) > iw + 1) wideText.push((el.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 40));
    if (wideText.length >= 5) break;
  }
  // A word broken across two lines in a heading ("BALATONBOGLÁRO / N", 11-24): the word's own
  // range has boxes on more than one line. A hyphenation break is the same failure here (the
  // phone shows it as a cut word too).
  const brokenWords = [];
  for (const el of Array.from(document.querySelectorAll("h1,h2,h3,.t-quote"))) {
    if (!shown(el)) continue;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent || "";
      const re = /[^\\s]+/g;
      let m;
      while ((m = re.exec(text))) {
        if (m[0].length < 4) continue;
        const range = document.createRange();
        range.setStart(n, m.index);
        range.setEnd(n, m.index + m[0].length);
        const tops = new Set(Array.from(range.getClientRects()).filter((r) => r.width > 1).map((r) => Math.round(r.top)));
        if (tops.size > 1) brokenWords.push(m[0]);
      }
    }
    if (brokenWords.length >= 5) break;
  }
  // THE LARGEST HOLE: the biggest vertical run of the page with no ink at all (no text, no picture, no
  // background image) — an empty band or a near-empty section (owner 2026-11-26, §B 6c: no dead bands).
  const ink = [];
  for (const el of Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,a,span,img,svg,figure,button,td,th,dt,dd,blockquote,figcaption,label,input,select,textarea,em,strong,small,time"))) {
    if (!shown(el)) continue;
    if (el.tagName !== "IMG" && el.tagName !== "SVG" && !(el.textContent || "").trim() && !["INPUT","SELECT","TEXTAREA"].includes(el.tagName)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    ink.push({ top: r.top + scrollY, bottom: r.bottom + scrollY });
  }
  for (const sl of slots) ink.push({ top: sl.y, bottom: sl.y + sl.h });
  ink.sort((a, b) => a.top - b.top);
  let reach = 0;
  let maxGap = 0;
  let gapAt = 0;
  for (const k of ink) {
    if (k.top - reach > maxGap) { maxGap = Math.round(k.top - reach); gapAt = Math.round(reach); }
    if (k.bottom > reach) reach = k.bottom;
  }
  // Visible headings and captions, in page order — the text-repeat rule reads them (text/textOverlap.ts).
  const texts = [];
  for (const el of Array.from(document.querySelectorAll("h1,h2,h3,.t-quote,figcaption,blockquote"))) {
    if (!shown(el)) continue;
    // ⚠️ double backslash (11-27): a single one in this template literal reached the page as /s+/g and took every „s” out of the
    // measured headings („Mono zlón” for „Monoszlón”) — the text-repeat rule compared mangled strings.
    const t = (el.textContent || "").trim().replace(/\\s+/g, " ");
    if (t.length < 8) continue;
    const r = el.getBoundingClientRect();
    texts.push({ text: t.slice(0, 160), mod: modOf(el), y: Math.round(r.top + scrollY), tag: el.classList.contains("t-quote") ? "caption" : el.tagName.toLowerCase() });
    if (texts.length >= 40) break;
  }
  // CONTRAST (ADR-0500 ⑦): the text of every fixed / sticky bar on screen, and the h1 / h2 / buttons, against the
  // background actually painted behind it (the first ancestor with an opaque colour). A text over a picture (an
  // ancestor with a background image before any colour) is not measured: its legibility is the picture's.
  const lowContrast = [];
  {
    const rgb = (c) => {
      const m = /rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?/.exec(c || "");
      if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] == null ? 1 : Number(m[4])];
      // color-mix() resolves to „color(srgb r g b / a)” with 0..1 channels
      const k = /color\\(srgb\\s+([\\d.e-]+)\\s+([\\d.e-]+)\\s+([\\d.e-]+)(?:\\s*\\/\\s*([\\d.e-]+))?/.exec(c || "");
      return k ? [Number(k[1]) * 255, Number(k[2]) * 255, Number(k[3]) * 255, k[4] == null ? 1 : Number(k[4])] : null;
    };
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    // What is painted UNDER the text's centre, top to bottom (siblings and positioned layers too, not only the
    // ancestors): a picture (img / video / svg image / a background image) first → not measured; else the first
    // opaque colour is the ground.
    const groundOf = (el) => {
      const r = el.getBoundingClientRect();
      const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2));
      const y = Math.min(innerHeight - 1, Math.max(0, r.top + Math.min(r.height / 2, 20)));
      const stack = document.elementsFromPoint(x, y);
      const i = stack.indexOf(el);
      // the translucent layers above the ground, composited top-down (a 80 % charcoal header over a photo = charcoal)
      const layers = [];
      let cover = 0;
      const composite = (base) => { let c = base; for (let k = layers.length - 1; k >= 0; k--) { const L = layers[k]; c = [0, 1, 2].map((q) => L[q] * L[3] + c[q] * (1 - L[3])); } return c; };
      for (const e of i >= 0 ? stack.slice(i) : stack) {
        const cs = getComputedStyle(e);
        const pic = /^(IMG|VIDEO|PICTURE|CANVAS|IFRAME)$/.test(e.tagName) || e.tagName.toLowerCase() === "image" || (cs.backgroundImage && cs.backgroundImage !== "none" && !/^linear-gradient|^radial-gradient/.test(cs.backgroundImage))
          || ["::before", "::after"].some((pe) => { const ps = getComputedStyle(e, pe); return ps.content && ps.content !== "none" && ps.backgroundImage && /url\\(/.test(ps.backgroundImage); });
        if (pic) {
          // over a picture: measured only when the layers above it already hide it (≥ 75 %), as their colour
          if (cover < 0.75 || !layers.length) return null;
          const sum = layers.reduce((s, L) => s + L[3], 0);
          return [0, 1, 2].map((q) => layers.reduce((s, L) => s + L[q] * L[3], 0) / sum);
        }
        const c = rgb(cs.backgroundColor);
        if (!c || c[3] <= 0.02) continue;
        if (c[3] >= 0.98) return composite(c);
        layers.push(c);
        cover = 1 - (1 - cover) * (1 - c[3]);
      }
      return composite([255, 255, 255]);
    };
    const fixedBar = (el) => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === "fixed" || p === "sticky") return e; } return null; };
    const seen = new Set();
    for (const el of document.querySelectorAll("body *")) {
      if (lowContrast.length >= 5) break;
      if (!shown(el)) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
      if (!own) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.bottom <= 0 || r.top >= innerHeight) continue;
      const bar = fixedBar(el);
      const key = el.matches("h1,h2,.cit-btn,a.cit-btn,button") || el.closest("h1,h2,.cit-btn,button");
      if (!bar && !key) continue;
      const fg = rgb(getComputedStyle(el).color);
      const bgc = groundOf(el);
      if (!fg || !bgc) continue;
      // a semi-transparent text colour is painted over its ground
      const a = fg[3];
      const paint = [0, 1, 2].map((i) => fg[i] * a + bgc[i] * (1 - a));
      // an element (or ancestor) mid-fade is not measured: a bar sliding in / out runs a 0.3 s opacity transition, and
      // its half-way frame is no state of the page (measured 11-27: „Foglalás” 4.14:1 on a fading menu bar)
      let op = 1;
      for (let e = el; e && e.nodeType === 1; e = e.parentElement) op *= Number(getComputedStyle(e).opacity);
      if (op < 0.98) continue;
      const cr = ratio(paint, bgc);
      const text = el.textContent.trim().replace(/\\s+/g, " ").slice(0, 40);
      if (cr < ${TEXT_MIN_CONTRAST} && !seen.has(text)) { seen.add(text); lowContrast.push({ text, ratio: Math.round(cr * 100) / 100, where: bar ? "sáv" : el.tagName.toLowerCase() }); }
    }
  }
  return { slots, broken, scrollWidth: document.documentElement.scrollWidth, innerWidth: iw, wideText, brokenWords, maxGap, gapAt, texts, title: document.title || "", lowContrast };
})()`;

/**
 * The bytes a town picture was PICKED on (media/townPick.ts judges the 330 px Wikimedia thumbnail): the
 * gate re-judges the very same input, so a borderline score cannot flip between the pick and the page
 * (Garáb, 2026-11-25: „sports ground” on the 1920 px file, a village view on the 330 px one). Falls back
 * to the page's own bytes when the thumbnail cannot be fetched.
 */
async function townJudgeBytes(url: string, pageBytes: Buffer): Promise<Buffer> {
  const small = url.replace(/\/(?:960|1280|1920)px-/, "/330px-");
  if (small === url) return pageBytes;
  const r = await fetch(small, { headers: { "user-agent": PORTAL_USER_AGENT }, signal: AbortSignal.timeout(15000) }).catch(() => null);
  return r?.ok ? Buffer.from(await r.arrayBuffer()) : pageBytes;
}

/**
 * Render one mock HTML file like a phone and judge it. Pure of the DB except for reading the
 * cached vision verdicts (no paid call). Throws only on a launch failure.
 */
export async function auditMockFile(
  mockAbs: string,
  town: TownUrls = { gallery: [] },
  /** 0155: the lead's country row's dispatch_stock_ok — false = a marked sample in a gallery / room slot fails too. */
  opts: {
    readonly stockOk?: boolean;
    /** The lodging's and the town's names: never a repeat by themselves. */
    readonly proper?: readonly string[];
    /**
     * A browser shared by a pool of audits (regateStaleQueue, 11-27): the caller owns its launch, its close and the
     * concurrency (one context per audit, so cookies / routes never leak between two mocks). Absent = own browser
     * behind the process-wide render slot, as before.
     */
    readonly browser?: Browser;
  } = {},
): Promise<Omit<RenderGateResult, "mtime" | "at" | "version">> {
  const isTown = (u: string): boolean => (town.hero != null && sizelessPhotoKey(u) === sizelessPhotoKey(town.hero)) || town.gallery.some((g) => sizelessPhotoKey(g) === sizelessPhotoKey(u));
  const photos = createPhotoCache();
  const bodies = new Map<string, Buffer>();
  const failedNet = new Set<string>();
  const shared = opts.browser;
  const release = shared ? () => undefined : await acquireRenderSlot();
  const browser = shared ?? (await chromium.launch({ executablePath: config.chromiumPath }).catch((e) => {
    release();
    throw e;
  }));
  // On a shared browser every page gets its own context (the page options ARE the context's): two mocks share nothing.
  const contexts: BrowserContext[] = [];
  const newPage = async (o: Parameters<Browser["newPage"]>[0]) => {
    if (!shared) return browser.newPage(o);
    const c = await shared.newContext(o);
    contexts.push(c);
    return c.newPage();
  };
  let measure: PageMeasure;
  let opening: PageMeasure = { slots: [], broken: [], scrollWidth: 0, innerWidth: 0, wideText: [], brokenWords: [] };
  let heroLightShare = 0;
  let heroScreen: { midMean: number; midLap: number } | null = null;
  let heroTitle: { ratio: number; text: string } | null = null;
  let mapBlank = false;
  try {
    // The PAGE renders with the browser's own UA: Google Fonts answers a bot UA with another font
    // file, the headline then fits where a phone's Fraunces does not (measured 11-24, Crystal
    // Apartment: h1 420 px in a 334 px box on a phone, no overflow under the bot UA). The portal
    // images are fetched below with our honest bot UA (politeness doctrine, heroShot.ts).
    const page = await newPage({ viewport: VIEWPORT, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    // Final state of every section: no intro, no motion (same switches as the letter's hero shot).
    await page.addInitScript(
      "(function(){function set(){document.documentElement.setAttribute('data-cit-no-intro','');document.documentElement.setAttribute('data-cit-no-motion','');}if(document.documentElement){set();return;}new MutationObserver(function(_m,o){if(document.documentElement){set();o.disconnect();}}).observe(document,{childList:true});})();",
    );
    page.on("requestfailed", (r) => {
      if (r.resourceType() === "image") failedNet.add(r.url());
    });
    // OWN NETWORK-QUIET COUNTER (2026-11-25). Playwright's waitForLoadState("networkidle") after the
    // scroll walk NEVER resolved here (measured 2/2 mocks: the full 60 s timeout every time, no request
    // pending) — 60 s of idling per audited mock, 18 min per fixture gate, +60 s per lead in the send
    // gate. The condition the measurement needs is exactly this: every request the page started has
    // finished or failed, and nothing new started for QUIET_MS. Same 60 s upper bound as before.
    const inflight = new Set<object>();
    // Elapsed time on the MONOTONIC clock: a wall clock can be frozen or set (the send path runs under a
    // frozen Date in the test worlds, where this loop never ended — 2026-11-26), never an interval.
    let lastNet = performance.now();
    page.on("request", (r) => {
      inflight.add(r);
      lastNet = performance.now();
    });
    const settle = (r: object) => {
      inflight.delete(r);
      lastNet = performance.now();
    };
    page.on("requestfinished", settle);
    page.on("requestfailed", settle);
    const networkQuiet = async (timeoutMs: number): Promise<void> => {
      const end = performance.now() + timeoutMs;
      while (performance.now() < end) {
        if (inflight.size === 0 && performance.now() - lastNet >= QUIET_MS) return;
        await new Promise((r) => setTimeout(r, 100));
      }
    };
    const hostChain = new Map<string, Promise<void>>();
    // ⑯b SPEED (quantity, 11-27: the eager map frame added ~2.3 s a plan to every networkidle wait — 12.5 → 14.8 s measured):
    // the measuring browser never loads the third-party map; whether the box HAS a map is read from its frame below.
    await page.route(/^https:\/\/(?:maps\.google\.com|www\.google\.com\/maps)\//, (route) => route.abort());
    await page.route("**/*", async (route) => {
      if (route.request().resourceType() !== "image") return route.continue();
      const url = route.request().url();
      if (url.startsWith("file:///assets/")) {
        const pub = path.resolve(process.cwd(), "public") + path.sep;
        const abs = path.resolve(pub, decodeURIComponent(url.slice("file:///".length)));
        if (abs.startsWith(pub)) {
          try {
            const body = await readFile(abs);
            const ext = path.extname(abs).toLowerCase();
            const contentType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".svg" ? "image/svg+xml" : "image/jpeg";
            bodies.set(url, body);
            return route.fulfill({ status: 200, contentType, body });
          } catch {
            failedNet.add(url);
          }
        }
        return route.continue();
      }
      const cached = await photos.read(url);
      if (cached) {
        bodies.set(url, cached.body);
        return route.fulfill({ status: 200, contentType: cached.contentType, body: cached.body });
      }
      let host = "";
      try {
        host = new URL(url).host;
      } catch {
        return route.continue();
      }
      const prev = hostChain.get(host) ?? Promise.resolve();
      hostChain.set(host, prev.then(() => new Promise<void>((r) => setTimeout(r, IMG_GAP_MS))));
      await prev;
      try {
        const resp = await route.fetch({ headers: { ...route.request().headers(), "user-agent": PORTAL_USER_AGENT } });
        const body = await resp.body();
        const ct = resp.headers()["content-type"] ?? "";
        if (resp.status() === 200) {
          bodies.set(url, body);
          await photos.write(url, body, ct);
        } else failedNet.add(url);
        return route.fulfill({ response: resp, body });
      } catch {
        failedNet.add(url);
        return route.continue();
      }
    });
    await page.goto(`file://${mockAbs}`, { waitUntil: "networkidle", timeout: 60000 });
    // The first screen exactly as it opens (the hero's fitted headline can reflow after a scroll).
    await page.waitForTimeout(1200);
    opening = (await page.evaluate(MEASURE_JS)) as PageMeasure;
    // The hero's CONTENT, not only its presence: the top of the first screen, as pixels.
    const top = await page.screenshot({ clip: { x: 0, y: 0, width: VIEWPORT.width, height: Math.round(VIEWPORT.height * 0.6) } });
    const g = await sharp(top).greyscale().raw().toBuffer();
    let light = 0;
    for (let i = 0; i < g.length; i++) if (g[i]! > 200) light++;
    heroLightShare = g.length ? light / g.length : 0;
    heroScreen = heroScreenStats(g, VIEWPORT.width, g.length / VIEWPORT.width);
    // ⑮ THE HERO TITLE ON ITS PICTURE (Natura c717f8a7: dark serif name on a dark lawn): the first screen's h1, its colour
    // against the pixels actually behind it (the clip's pixels unlike the text colour = the picture under the letters).
    const t = (await page.evaluate(`(() => { const h = [...document.querySelectorAll("h1")].find((e) => { const r = e.getBoundingClientRect(); return r.width > 20 && r.height > 10 && r.top < innerHeight && r.bottom > 0 && getComputedStyle(e).visibility !== "hidden"; }); if (!h) return null; const r = h.getBoundingClientRect(); const c = getComputedStyle(h).color; return { x: Math.max(0, r.left), y: Math.max(0, r.top), w: Math.min(innerWidth - Math.max(0, r.left), r.width), h: Math.min(innerHeight - Math.max(0, r.top), r.height), c, text: (h.textContent || "").trim().slice(0, 40) }; })()`)) as { x: number; y: number; w: number; h: number; c: string; text: string } | null;
    if (t && t.w >= 20 && t.h >= 10) {
      const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(t.c);
      if (m) {
        const clip = await page.screenshot({ clip: { x: Math.floor(t.x), y: Math.floor(t.y), width: Math.max(1, Math.floor(t.w)), height: Math.max(1, Math.floor(t.h)) } });
        const px = await sharp(clip).greyscale().raw().toBuffer();
        heroTitle = heroTitleContrast([Number(m[1]), Number(m[2]), Number(m[3])], px, t.text);
      }
    }
    // Walk the page so lazy images load, then measure from the top.
    const height = (await page.evaluate("document.documentElement.scrollHeight")) as number;
    for (let y = 0; y < height; y += VIEWPORT.height / 2) {
      await page.evaluate(`window.scrollTo(0, ${y})`);
      await page.waitForTimeout(120);
    }
    await networkQuiet(60000);
    // THE BARS THAT APPEAR ONLY BELOW THE HERO (ADR-0500 ⑦): the phone's bottom booking bar turns on once the hero has
    // scrolled away (cit-mobbar--on), so at the top it is hidden and its text was never measured (Jaja, Hullám: the
    // faint bar passed). One look half-way down the page — its contrast findings join the rest.
    await page.evaluate(`window.scrollTo(0, ${Math.max(VIEWPORT.height * 1.5, Math.round(height * 0.5))})`);
    await page.waitForTimeout(700);
    const midway = (await page.evaluate(MEASURE_JS)) as PageMeasure;
    // ⑯ THE MAP BOX ACTUALLY SHOWS A MAP: after the walk (the frame had its chance to load) the box's pixels are measured
    // — a near-uniform box is the white pin card or a grey error page, not a map.
    // the map box carries its map frame (a real browser loads it — primitives.mapEmbed is eager); a box without one is empty
    if (await page.$(".cit-map-box")) mapBlank = !(await page.$(".cit-map-box iframe[src]"));
    await page.evaluate("window.scrollTo(0, 0)");
    await page.waitForTimeout(300);
    const walkedTop = (await page.evaluate(MEASURE_JS)) as PageMeasure;
    const walked: PageMeasure = { ...walkedTop, lowContrast: [...(walkedTop.lowContrast ?? []), ...(midway.lowContrast ?? [])] };
    measure = {
      ...walked,
      wideText: [...new Set([...opening.wideText, ...walked.wideText])].slice(0, 5),
      brokenWords: [...new Set([...opening.brokenWords, ...walked.brokenWords])].slice(0, 5),
      lowContrast: [...(opening.lowContrast ?? []), ...(walked.lowContrast ?? [])].filter((c, i, all) => all.findIndex((x) => x.text === c.text) === i).slice(0, 5),
    };
    // THE LETTER'S PICTURE is the desktop first screen (heroShot.ts: 1216×760, our bot UA, finished
    // hero). Measured only on the phone, „BALATONBOGLÁRO / N” went into Villa Aquamarine's letter
    // image (quality colleague, 2026-11-25). Same switches and UA as the shot; images are not needed
    // to measure a heading, so they are not fetched.
    const desk = await newPage({ viewport: DESKTOP_VIEWPORT, deviceScaleFactor: 1, userAgent: PORTAL_USER_AGENT });
    await desk.addInitScript(
      "(function(){function set(){document.documentElement.setAttribute('data-cit-no-intro','');document.documentElement.setAttribute('data-cit-no-motion','');}if(document.documentElement){set();return;}new MutationObserver(function(_m,o){if(document.documentElement){set();o.disconnect();}}).observe(document,{childList:true});})();",
    );
    await desk.route("**/*", (route) => (route.request().resourceType() === "image" || /^https:\/\/(?:maps\.google\.com|www\.google\.com\/maps)\//.test(route.request().url()) ? route.abort() : route.continue()));
    await desk.goto(`file://${mockAbs}`, { waitUntil: "networkidle", timeout: 60000 });
    await desk.waitForTimeout(1200);
    measure = { ...measure, desktopBrokenWords: ((await desk.evaluate(MEASURE_JS)) as PageMeasure).brokenWords.slice(0, 5) };
  } finally {
    if (shared) for (const c of contexts) await c.close().catch(() => undefined);
    else await browser.close().catch(() => undefined);
    release();
  }

  const findings: RenderFinding[] = [];
  const slots = measure.slots;
  // The same statement twice on the page (owner 2026-11-26, Monos): any two visible headings / captions that
  // repeat each other — proper names stripped, the hero subtitle ↔ intro pair excepted by the templates' design.
  {
    const lines = (measure.texts ?? []).sort((a, b) => a.y - b.y);
    const proper = [...(opts.proper ?? []), measure.title ?? ""].filter(Boolean);
    const seen: { text: string; mod: string }[] = [];
    let reported = 0;
    for (const l of lines) {
      // Cards of one list (room cards, POI cards) name siblings, not repeats.
      const dup = seen.find((k) => !(k.mod === l.mod && /^(?:rooms|poi|units)$/.test(l.mod)) && repeatsText(k.text, l.text, proper));
      if (dup && reported < 3) {
        findings.push({ code: "repeat", detail: `ismétlődő szöveg: „${dup.text.slice(0, 50)}” ↔ „${l.text.slice(0, 50)}” (${dup.mod}, ${l.mod})` });
        reported++;
      }
      seen.push({ text: l.text, mod: l.mod });
    }
  }
  // TWO SECTIONS, ONE HEADING (ADR-0500 ⑨, Anikó cc48fbb1: „Ami nálunk vár” twice): the sentence rule above lets a
  // short heading through; two visible <h2> with the same normalized text are a repeat, in any module.
  {
    const seenH2 = new Map<string, string>();
    // ADR-0503 ⑪: a band's caption is a sentence, never a section's title („GALERIJA”, „FOTÓK A HÁZRÓL” over a band)
    const h2keys = new Set((measure.texts ?? []).filter((l) => l.tag === "h2").map((l) => headingKey(l.text)));
    for (const c of (measure.texts ?? []).filter((l) => l.tag === "caption")) {
      const words = (c.text.match(/[\p{L}\p{N}]+/gu) ?? []).length;
      if (words < 4 || h2keys.has(headingKey(c.text))) {
        findings.push({ code: "repeat", detail: `a sáv felirata nem mondat, hanem cím: „${c.text.slice(0, 50)}”` });
        break;
      }
    }
    for (const l of measure.texts ?? []) {
      if (l.tag !== "h2") continue;
      const key = headingKey(l.text);
      if (!key) continue;
      const first = seenH2.get(key);
      if (first) {
        findings.push({ code: "repeat", detail: `két szakasz ugyanazzal a címmel: „${l.text.slice(0, 50)}” (${first}, ${l.mod})` });
        break;
      }
      seenH2.set(key, l.mod);
    }
  }
  if ((measure.maxGap ?? 0) > PAGE_MAX_GAP_PX) {
    findings.push({ code: "gap", detail: `üres sáv a lapon: ${measure.maxGap} px tartalom nélkül (${measure.gapAt} px-től; legfeljebb ${PAGE_MAX_GAP_PX})` });
  }
  // THE FIRST SCREEN AS THE PHONE SHOWS IT (ADR-0503 ⑫, Castor 6aa09dd6): the source photo measured fine (luma 107,
  // Laplace 2914) — the page cut a landscape into a portrait cover under a dark veil and it opened dim and soft. Measured
  // on the photo band of the rendered screen (25–70 % of the top clip: the title excluded): dark, or dark AND soft.
  // DARK only: the „dim and soft” branch (< 70 and Laplace < 400) failed the fixture's plain facade under the Kapunyitás's own
  // shade (Aranyforrás: 59 / 82, a fine hero) — a smooth wall is not a soft photo. The room close-up it also caught is the
  // room-hero rule's case (isRoomHero) since this round.
  const heroDim = heroScreen != null && heroScreen.midMean < HERO_SCREEN_DARK;
  if (mapBlank) findings.push({ code: "thin", detail: "a megközelítés-blokkban nem látszik térkép (üres doboz a tűvel)" });
  if (heroTitle && heroTitle.ratio < HERO_TITLE_MIN_CONTRAST) {
    findings.push({ code: "contrast", detail: `a nyitókép címe halvány a képen: „${heroTitle.text}” ${heroTitle.ratio}:1 (legalább ${HERO_TITLE_MIN_CONTRAST}:1)` });
  }
  if (heroLightShare >= HERO_MAX_LIGHT_SHARE) {
    findings.push({ code: "thin", detail: `a nyitóképernyő szinte üres (${Math.round(heroLightShare * 100)}% világos, kép nélkül)` });
  }

  // A TOWN PAGE, measured as a phone opens it (coordinator 2026-11-25): the first screen, unscrolled, shows a
  // real, loaded picture in the hero (a parallax layer that never paints = a grey band), and the page holds
  // at least TOWN_PAGE_MIN_PICTURES distinct pictures. A failing page is regenerated, never sent.
  if (town.hero || town.gallery.length) {
    const heroShown = opening.slots.some((sl) => sl.y < VIEWPORT.height && sl.h >= VIEWPORT.height * 0.3 && !opening.broken.includes(sl.u));
    if (!heroShown) findings.push({ code: "thin", detail: "mobilon az első képernyőn nincs betöltött nyitókép (szürke sáv)" });
    const distinct = new Set(slots.map((sl) => sizelessPhotoKey(sl.u))).size;
    if (distinct < TOWN_PAGE_MIN_PICTURES) findings.push({ code: "thin", detail: `kevés kép a lapon: ${distinct} (legalább ${TOWN_PAGE_MIN_PICTURES} kell)` });
  }

  // repeat — group slots by picture (URL key, then dHash), ignore stacked layers of one place.
  const hashOf = new Map<string, string | undefined>();
  for (const s of slots) {
    if (hashOf.has(s.u)) continue;
    const b = bodies.get(s.u);
    hashOf.set(s.u, b ? await dHashFromBuffer(b).catch(() => undefined) : undefined);
  }
  const groups: Slot[][] = [];
  for (const s of slots) {
    const g = groups.find((gr) =>
      gr.some((o) => photoUrlKey(o.u) === photoUrlKey(s.u) || sizelessPhotoKey(o.u) === sizelessPhotoKey(s.u) || isSamePicture(hashOf.get(o.u), hashOf.get(s.u))),
    );
    if (g) g.push(s);
    else groups.push([s]);
  }
  for (const g of groups) {
    const places: Slot[] = [];
    for (const s of g) if (!places.some((p) => overlaps(p, s))) places.push(s);
    if (places.length >= 2) {
      findings.push({
        code: "repeat",
        detail: `ugyanaz a kép ${places.length} helyen: ${fileOf(places[0]!.u)} (${places.map((p) => p.mod).join(", ")})`,
        url: places[0]!.u,
      });
    }
  }

  const urls = [...new Set(slots.map((s) => s.u))];

  const scores = await readCachedScores(urls.filter((u) => /^https?:/i.test(u)));
  for (const u of urls) {
    const v = scores.get(photoUrlKey(u));
    if (v && FORBIDDEN_SUBJECTS.has(v.subject)) {
      findings.push({ code: "subject", detail: `nem szállás-kép (${v.subject}): ${fileOf(u)} — ${v.reason.slice(0, 80)}`, url: u });
    }
  }

  // The local classifier (media/photoKind.ts): a document, plan, ad, toilet, map or logo anywhere,
  // a sight of the area anywhere but the hero. Without the model the page is unchecked → fail.
  if (!photoKindAvailable()) {
    findings.push({ code: "render", detail: "a képfelismerő modell hiányzik ezen a gépen — ellenőrizetlen lap nem mehet ki" });
  } else {
    const heroUrl = slots.find((s) => s.mod === "header#top" || s.y < 10)?.u;
    // THE HERO SHOWS THE LODGING AT ITS BEST (11-24: a bathroom mirror, a stove, a Booking award
    // banner opened 9 of 18 letters) — never a bathroom, toilet, kitchen or a non-lodging picture.
    const heroBytes = heroUrl ? bodies.get(heroUrl) : undefined;
    if (heroUrl && heroBytes && isTown(heroUrl)) {
      // The TOWN's picture opens the page (plan kepnelkuli-hero, ADR-0479): re-judged with the very rule
      // that picked it (media/townPick.ts) — a vehicle, an interior, a road, a dusk field never opens.
      const tv = await judgeTownPicture(await townJudgeBytes(heroUrl, heroBytes), town.heroTier ?? "town", true);
      if (!tv) findings.push({ code: "render", detail: "a településkép-szabály nem futtatható — ellenőrizetlen nyitókép nem mehet ki" });
      else if (!tv.ok) findings.push({ code: "subject", detail: `a település-nyitókép elbukik a szabályon (${tv.reason}): ${fileOf(heroUrl)}`, url: heroUrl });
    } else if (heroUrl && stockUrl(heroUrl)) {
      findings.push({ code: "stock", detail: `mintakép a nyitóképen: ${fileOf(heroUrl)}`, url: heroUrl });
    } else if (heroUrl && heroBytes) {
      const hv = await classifyPhotoBuffer(heroBytes);
      // The HARD no-gos only (kitchen, bathroom, non-lodging, person, vehicle, dark): which of the fit photos is the
      // wow is the quality colleague's pick (qa-review heroes, isHeroCandidate) — the gate must not overrule it
      // with the machine pick's score floor (11-26, BaBo: the chosen geranium terrace was blocked as „not a hero”).
      // 11-27: photoKind.fitsHero — the very predicate the generator's hero pick and the colleague's pin pass.
      const labels = fitsHero(hv) ? await photoOverlayLabels(heroUrl, heroBytes).catch(() => [] as string[]) : [];
      if (!fitsHero(hv)) {
        findings.push({ code: "subject", detail: `a nyitókép nem való nyitóképnek (${hv?.label ?? "nincs ítélet"}): ${fileOf(heroUrl)}`, url: heroUrl });
      } else if (labels.length) {
        // ㉒ painted labels on the hero („A2(2+2)”) — named, the retry puts the next candidate first
        findings.push({ code: "subject", detail: `feliratos nyitókép (${labels.slice(0, 3).join(" ")}): ${fileOf(heroUrl)}`, url: heroUrl });
      } else if (isRoomHero(hv)) {
        // ADR-0503 ⑫: a room opens the page while the page itself shows an outside / view picture the hero rule accepts
        // — named, so the retry puts that one first (photoKind.withBestHeroFirst makes the same choice at generation).
        const others = [...new Set(slots.map((sl) => sl.u))].filter((u) => u !== heroUrl && !isTown(u) && !stockUrl(u));
        for (const u of others.slice(0, 12)) {
          const b = bodies.get(u);
          const v = b ? await classifyPhotoBuffer(b).catch(() => null) : null;
          if (fitsHero(v) && !isRoomHero(v)) {
            findings.push({ code: "subject", detail: `beltéri kép a nyitóképen, pedig van kültéri / kilátásos (${fileOf(u)}): ${fileOf(heroUrl)}`, url: heroUrl });
            break;
          }
        }
      }
    }
    // the dim first screen names its picture: the retry puts the next candidate in its place (never leaves the hero empty)
    if (heroDim && heroUrl && heroScreen) {
      findings.push({ code: "subject", detail: `a nyitóképernyő telefonon sötét / fakó (luma ${Math.round(heroScreen.midMean)}, élesség ${Math.round(heroScreen.midLap)}): ${fileOf(heroUrl)}`, url: heroUrl });
    }
    // THE OPENING SEQUENCE, TOO (11-24, second round): wordmark-grow cycles photos 2–5 in its big
    // frame before the hero fades in, and gate-opening's leaves carry their own photo — a toilet or a
    // bathtub there opens the page just as a bathtub hero would (Pirkadat, Mia). Read from the page
    // itself (the intro's SHOTS list, the leaf <img>), judged with the same local classifier.
    const html = await readFile(mockAbs, "utf8").catch(() => "");
    // Each picture with the SLOT it fills (11-27): every slot is judged with its own photoKind predicate — the very
    // function the generator filled it with (photoCurate okOpening / okBand / okContact → templateKit.fitsSlot).
    const opening = new Set<string>();
    const contacts = new Set<string>();
    const shots = /var SHOTS=(\[[^\]]*\])/.exec(html)?.[1];
    if (shots) {
      try {
        for (const u of JSON.parse(shots.replace(/\\u003c/gi, "<")) as unknown[]) if (typeof u === "string") opening.add(u);
      } catch {
        findings.push({ code: "render", detail: "a nyitó-animáció képlistája nem olvasható — ellenőrizetlen nyitás nem mehet ki" });
      }
    }
    for (const m of html.matchAll(/class="ko-leaf [lr]"><img src="([^"]+)"/g)) opening.add(m[1]!.replace(/&amp;/g, "&"));
    // Parallax: the full-bleed bands and the contact picture are screens of their own (11-25: Linetta's
    // contact showed the bathroom with its toilet) — held to the opening's rule.
    const bands = new Set<string>();
    for (const m of html.matchAll(/class="t-par t-par--band"[^>]*background-image:url\('([^']+)'\)/g)) {
      opening.add(m[1]!.replace(/&amp;/g, "&"));
      bands.add(m[1]!.replace(/&amp;/g, "&"));
    }
    for (const m of html.matchAll(/class="t-conphoto"><img src="([^"]+)"/g)) {
      opening.add(m[1]!.replace(/&amp;/g, "&"));
      contacts.add(m[1]!.replace(/&amp;/g, "&"));
    }
    const heroHash = heroBytes ? await dHashFromBuffer(heroBytes).catch(() => undefined) : undefined;
    for (const u of opening) {
      if (stockUrl(u)) {
        findings.push({ code: "stock", detail: `mintakép a nyitásban / sávban / kapcsolat-képen: ${fileOf(u)}`, url: u });
        continue;
      }
      let b = bodies.get(u) ?? (await photos.read(u))?.body;
      if (!b && /^https?:/.test(u)) {
        const r = await fetch(u, { headers: { "user-agent": PORTAL_USER_AGENT } }).catch(() => null);
        if (r?.ok) b = Buffer.from(await r.arrayBuffer());
      }
      // The opening must never show the picture that stays (Vörösmarty tér, 11-24: the leaf was the
      // hero at another size — the gate opened onto itself). Layered over the hero, so the repeat
      // rule above does not see it.
      const sameAsHero =
        heroUrl != null &&
        (u === heroUrl ||
          sizelessPhotoKey(u) === sizelessPhotoKey(heroUrl) ||
          (b != null && isSamePicture(heroHash, await dHashFromBuffer(b).catch(() => undefined))));
      if (sameAsHero) {
        findings.push({ code: "repeat", detail: `a nyitó-animáció a nyitóképet mutatja (önmagára nyílik): ${fileOf(u)}`, url: u });
        continue;
      }
      if (!b) continue; // not served → the broken-image rule speaks for it
      if (isTown(u)) {
        // A town page's band shows the town's LOCAL picture (templateKit.allotPhotos): the town rule judges it.
        const tv = await judgeTownPicture(await townJudgeBytes(u, b));
        if (tv && !tv.ok) findings.push({ code: "subject", detail: `a sávban lévő helyi kép elbukik a településkép-szabályon (${tv.reason}): ${fileOf(u)}`, url: u });
        continue;
      }
      const v = await classifyPhotoBuffer(b);
      const label = v?.label ?? "nincs ítélet";
      if (!fitsOpening(v)) {
        findings.push({ code: "subject", detail: `a nyitásban / sávban / kapcsolat-képen nem odavaló kép (${label}): ${fileOf(u)}`, url: u });
      } else if (bands.has(u) && !fitsBand(v)) {
        // A band is a screen of its own: a close-up, a dark shot or a thing instead of a place fails (11-25).
        findings.push({ code: "subject", detail: `a széles sávképen közelkép / sötét / nem a helyet mutató kép (${label}): ${fileOf(u)}`, url: u });
      } else if (contacts.has(u) && !fitsContact(v)) {
        findings.push({ code: "subject", detail: `a kapcsolat-képen jármű / ember / állat (${label}): ${fileOf(u)}`, url: u });
      }
    }
    for (const u of urls) {
      const b = bodies.get(u);
      if (!b || stockUrl(u)) continue;
      if (isTown(u)) {
        // A local picture of the town (gallery) is a sight by design: the town rule judges it.
        if (u === heroUrl) continue;
        const tv = await judgeTownPicture(await townJudgeBytes(u, b));
        if (tv && !tv.ok) findings.push({ code: "subject", detail: `a helyi kép elbukik a településkép-szabályon (${tv.reason}): ${fileOf(u)}`, url: u });
        continue;
      }
      const v = await classifyPhotoBuffer(b);
      if (isOffPagePhoto(v, u === heroUrl)) {
        findings.push({
          code: "subject",
          detail: v!.why
            ? `${v!.why}: ${fileOf(u)}`
            : `nem szállás-kép (${v!.label}, ${Math.round(Math.max(v!.never, v!.sight) * 100)}%): ${fileOf(u)}`,
        });
      }
    }
  }

  // A sample picture only in a MARKED gallery / room-card slot (plan kepnelkuli-hero ⑩).
  const heroSlotUrl = slots.find((s) => s.mod === "header#top" || s.y < 10)?.u;
  for (const sl of slots.filter((x) => stockUrl(x.u))) {
    if (sl.u === heroSlotUrl) continue; // reported above
    if (!SAMPLE_MODULES.has(sl.mod)) findings.push({ code: "stock", detail: `mintakép nem galéria- / szobahelyen (${sl.mod}): ${fileOf(sl.u)}`, url: sl.u });
    else if (!sl.sample) findings.push({ code: "stock", detail: `jelöletlen mintakép („MINTA” nélkül): ${fileOf(sl.u)}`, url: sl.u });
    else if (opts.stockOk === false) findings.push({ code: "stock", detail: `mintakép az ország szabálya szerint nem mehet (galéria- / szobahely): ${fileOf(sl.u)}`, url: sl.u });
  }

  if (measure.scrollWidth > measure.innerWidth + 1) {
    findings.push({ code: "overflow", detail: `mobilon az oldal ${measure.scrollWidth - measure.innerWidth} px-szel szélesebb a képernyőnél` });
  }
  if (measure.lowContrast?.length) {
    findings.push({ code: "contrast", detail: `halvány szöveg (WCAG ${TEXT_MIN_CONTRAST}:1 alatt): ${measure.lowContrast.map((c) => `„${c.text}” ${c.ratio}:1 (${c.where})`).join(" · ")}` });
  }
  if (measure.brokenWords.length) {
    findings.push({ code: "overflow", detail: `mobilon két sorba tört szó a címben: ${measure.brokenWords.join(" · ")}` });
  }
  if (measure.desktopBrokenWords?.length) {
    findings.push({ code: "overflow", detail: `a levél képén (asztali nézet) két sorba tört szó a címben: ${measure.desktopBrokenWords.join(" · ")}` });
  }
  if (measure.wideText.length) {
    findings.push({ code: "overflow", detail: `mobilon kilógó, levágott szöveg: ${measure.wideText.join(" · ")}` });
  }

  const broken = [...new Set([...measure.broken, ...[...failedNet].filter((u) => urls.includes(u))])];
  for (const u of broken) findings.push({ code: "broken", detail: `nem töltődik be: ${fileOf(u)}`, url: u });

  return { verdict: findings.length ? "fail" : "pass", findings, slots: slots.length };
}

/** The cached verdict if it belongs to the current file and rule version. */
/**
 * A PASS STAYS A PASS (owner 2026-11-27 evening: „egész nap ezzel lett elbaszva érzékelhető eredmény nélkül … minket csak
 * egy dolog zavar, az a vevő”). Six rule bumps that day each threw every ready offer off the owner's page and re-rendered the
 * whole stock on a 2-core box. Since then a plan that PASSED the gate from this version on keeps its pass on the same file:
 * new rules judge new and failed plans, they do not take back a ready offer.
 */
export const MIN_ACCEPTED_PASS_VERSION = 15;

export function cachedRenderGate(inputs: unknown, mtime: number, stockOk = true): RenderGateResult | null {
  const g = (inputs as { renderGate?: RenderGateResult } | null)?.renderGate;
  // 0155: a verdict judged under another stock rule of the country is stale.
  if (!g || g.mtime !== mtime || (g.stockOk ?? true) !== stockOk) return null;
  if (g.version === RENDER_GATE_VERSION) return g;
  return g.verdict === "pass" && g.version >= MIN_ACCEPTED_PASS_VERSION ? g : null;
}

/** The lead's country row's dispatch_stock_ok for an artifact (default true — the old fixed rule). */
export async function stockOkFor(artifactId: string): Promise<boolean> {
  const a = await db.selectFrom("mock_artifact").select("lead_id").where("id", "=", artifactId).executeTakeFirst();
  if (!a?.lead_id) return true;
  return countryConfigSync(await countryOfLead(a.lead_id))?.dispatch.stockOk ?? true;
}

/**
 * The gate for one artifact: cached verdict for the current file, else render, judge and store.
 * A render failure is a FAIL ("render"), never a pass.
 */
export async function renderGateFor(artifactId: string, opts: { readonly browser?: Browser } = {}): Promise<RenderGateResult> {
  const a = await db.selectFrom("mock_artifact").select(["path", "inputs"]).where("id", "=", artifactId).executeTakeFirst();
  const now = new Date().toISOString();
  if (!a?.path) {
    return { version: RENDER_GATE_VERSION, mtime: 0, at: now, verdict: "fail", slots: 0, findings: [{ code: "render", detail: "a mockhoz nincs fájl" }] };
  }
  const mockAbs = path.resolve(process.cwd(), a.path);
  let mtime = 0;
  try {
    mtime = Math.floor((await stat(mockAbs)).mtimeMs / 1000);
  } catch {
    return { version: RENDER_GATE_VERSION, mtime: 0, at: now, verdict: "fail", slots: 0, findings: [{ code: "render", detail: "a mock fájlja hiányzik" }] };
  }
  const stockOk = await stockOkFor(artifactId);
  const cached = cachedRenderGate(a.inputs, mtime, stockOk);
  if (cached) return cached;
  let result: RenderGateResult;
  try {
    const sd = (a.inputs as { siteData?: { name?: string; city?: string; townPhoto?: { url?: string; pick?: { tier?: "town" | "land" | "region" } }; townGallery?: { url?: string }[] } } | null)?.siteData;
    const proper = [sd?.name ?? "", sd?.city ?? ""].filter(Boolean);
    const town: TownUrls = {
      ...(sd?.townPhoto?.url ? { hero: sd.townPhoto.url } : {}),
      ...(sd?.townPhoto?.pick?.tier ? { heroTier: sd.townPhoto.pick.tier } : {}),
      gallery: (sd?.townGallery ?? []).map((t) => t.url).filter((u): u is string => typeof u === "string"),
    };
    const r = await auditMockFile(mockAbs, town, { stockOk, proper, ...(opts.browser ? { browser: opts.browser } : {}) });
    result = { version: RENDER_GATE_VERSION, mtime, at: now, ...r, ...(stockOk ? {} : { stockOk }) };
  } catch (e) {
    // Not stored: a crashed browser is our gap, the next send attempt renders again.
    return {
      version: RENDER_GATE_VERSION,
      mtime,
      at: now,
      verdict: "fail",
      slots: 0,
      findings: [{ code: "render", detail: `a mock nem renderelhető: ${(e as Error).message.slice(0, 120)}` }],
    };
  }
  await db
    .updateTable("mock_artifact")
    .set({ inputs: sql`jsonb_set(coalesce(inputs, '{}'::jsonb), '{renderGate}', ${JSON.stringify(result)}::jsonb)` as never })
    .where("id", "=", artifactId)
    .execute();
  return result;
}

/** One-line Hungarian reason for the send log / dispatch note. */
export function renderGateReason(r: RenderGateResult): string {
  const head = r.findings.slice(0, 4).map((f) => f.detail).join(" · ");
  const more = r.findings.length > 4 ? ` (+${r.findings.length - 4})` : "";
  return `a renderelt mock elbukott a minőségkapun: ${head}${more} — újragenerálandó, így nem mehet ki`;
}
