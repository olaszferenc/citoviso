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
import { chromium } from "playwright-core";
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
import { classifyPhotoBuffer, fitsBand, fitsContact, fitsHero, fitsOpening, isOffPagePhoto, photoKindAvailable } from "../media/photoKind.js";
import { createPhotoCache } from "./photoCache.js";
import { stockUrl } from "../engine/stock.js";
import { judgeTownPicture } from "../media/townPick.js";

/** Bump when the rules change: every cached verdict of an older version is re-checked. */
export const RENDER_GATE_VERSION = 15;
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

export type RenderFindingCode = "repeat" | "subject" | "stock" | "overflow" | "broken" | "render" | "thin" | "gap";

export interface RenderFinding {
  readonly code: RenderFindingCode;
  /** Hungarian, operator-facing: what is wrong and where. */
  readonly detail: string;
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
  /** The desktop first screen = the letter's picture (filled by auditMockFile, not by MEASURE_JS). */
  readonly desktopBrokenWords?: string[];
  /** The tallest ink-free vertical run (CSS px) and where it starts. */
  readonly maxGap?: number;
  readonly gapAt?: number;
  /** Visible headings / captions in page order. */
  readonly texts?: { text: string; mod: string; y: number }[];
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
    const t = (el.textContent || "").trim().replace(/\s+/g, " ");
    if (t.length < 8) continue;
    const r = el.getBoundingClientRect();
    texts.push({ text: t.slice(0, 160), mod: modOf(el), y: Math.round(r.top + scrollY) });
    if (texts.length >= 40) break;
  }
  return { slots, broken, scrollWidth: document.documentElement.scrollWidth, innerWidth: iw, wideText, brokenWords, maxGap, gapAt, texts, title: document.title || "" };
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
  opts: { readonly stockOk?: boolean; /** The lodging's and the town's names: never a repeat by themselves. */ readonly proper?: readonly string[] } = {},
): Promise<Omit<RenderGateResult, "mtime" | "at" | "version">> {
  const isTown = (u: string): boolean => (town.hero != null && sizelessPhotoKey(u) === sizelessPhotoKey(town.hero)) || town.gallery.some((g) => sizelessPhotoKey(g) === sizelessPhotoKey(u));
  const photos = createPhotoCache();
  const bodies = new Map<string, Buffer>();
  const failedNet = new Set<string>();
  const release = await acquireRenderSlot();
  const browser = await chromium.launch({ executablePath: config.chromiumPath }).catch((e) => {
    release();
    throw e;
  });
  let measure: PageMeasure;
  let opening: PageMeasure = { slots: [], broken: [], scrollWidth: 0, innerWidth: 0, wideText: [], brokenWords: [] };
  let heroLightShare = 0;
  try {
    // The PAGE renders with the browser's own UA: Google Fonts answers a bot UA with another font
    // file, the headline then fits where a phone's Fraunces does not (measured 11-24, Crystal
    // Apartment: h1 420 px in a 334 px box on a phone, no overflow under the bot UA). The portal
    // images are fetched below with our honest bot UA (politeness doctrine, heroShot.ts).
    const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
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
    // Walk the page so lazy images load, then measure from the top.
    const height = (await page.evaluate("document.documentElement.scrollHeight")) as number;
    for (let y = 0; y < height; y += VIEWPORT.height / 2) {
      await page.evaluate(`window.scrollTo(0, ${y})`);
      await page.waitForTimeout(120);
    }
    await networkQuiet(60000);
    await page.evaluate("window.scrollTo(0, 0)");
    await page.waitForTimeout(300);
    const walked = (await page.evaluate(MEASURE_JS)) as PageMeasure;
    measure = {
      ...walked,
      wideText: [...new Set([...opening.wideText, ...walked.wideText])].slice(0, 5),
      brokenWords: [...new Set([...opening.brokenWords, ...walked.brokenWords])].slice(0, 5),
    };
    // THE LETTER'S PICTURE is the desktop first screen (heroShot.ts: 1216×760, our bot UA, finished
    // hero). Measured only on the phone, „BALATONBOGLÁRO / N” went into Villa Aquamarine's letter
    // image (quality colleague, 2026-11-25). Same switches and UA as the shot; images are not needed
    // to measure a heading, so they are not fetched.
    const desk = await browser.newPage({ viewport: DESKTOP_VIEWPORT, deviceScaleFactor: 1, userAgent: PORTAL_USER_AGENT });
    await desk.addInitScript(
      "(function(){function set(){document.documentElement.setAttribute('data-cit-no-intro','');document.documentElement.setAttribute('data-cit-no-motion','');}if(document.documentElement){set();return;}new MutationObserver(function(_m,o){if(document.documentElement){set();o.disconnect();}}).observe(document,{childList:true});})();",
    );
    await desk.route("**/*", (route) => (route.request().resourceType() === "image" ? route.abort() : route.continue()));
    await desk.goto(`file://${mockAbs}`, { waitUntil: "networkidle", timeout: 60000 });
    await desk.waitForTimeout(1200);
    measure = { ...measure, desktopBrokenWords: ((await desk.evaluate(MEASURE_JS)) as PageMeasure).brokenWords.slice(0, 5) };
  } finally {
    await browser.close().catch(() => undefined);
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
  if ((measure.maxGap ?? 0) > PAGE_MAX_GAP_PX) {
    findings.push({ code: "gap", detail: `üres sáv a lapon: ${measure.maxGap} px tartalom nélkül (${measure.gapAt} px-től; legfeljebb ${PAGE_MAX_GAP_PX})` });
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
      });
    }
  }

  const urls = [...new Set(slots.map((s) => s.u))];

  const scores = await readCachedScores(urls.filter((u) => /^https?:/i.test(u)));
  for (const u of urls) {
    const v = scores.get(photoUrlKey(u));
    if (v && FORBIDDEN_SUBJECTS.has(v.subject)) {
      findings.push({ code: "subject", detail: `nem szállás-kép (${v.subject}): ${fileOf(u)} — ${v.reason.slice(0, 80)}` });
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
      else if (!tv.ok) findings.push({ code: "subject", detail: `a település-nyitókép elbukik a szabályon (${tv.reason}): ${fileOf(heroUrl)}` });
    } else if (heroUrl && stockUrl(heroUrl)) {
      findings.push({ code: "stock", detail: `mintakép a nyitóképen: ${fileOf(heroUrl)}` });
    } else if (heroUrl && heroBytes) {
      const hv = await classifyPhotoBuffer(heroBytes);
      // The HARD no-gos only (kitchen, bathroom, non-lodging, person, vehicle, dark): which of the fit photos is the
      // wow is the quality colleague's pick (qa-review heroes, isHeroCandidate) — the gate must not overrule it
      // with the machine pick's score floor (11-26, BaBo: the chosen geranium terrace was blocked as „not a hero”).
      // 11-27: photoKind.fitsHero — the very predicate the generator's hero pick and the colleague's pin pass.
      if (!fitsHero(hv)) {
        findings.push({ code: "subject", detail: `a nyitókép nem való nyitóképnek (${hv?.label ?? "nincs ítélet"}): ${fileOf(heroUrl)}` });
      }
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
        findings.push({ code: "stock", detail: `mintakép a nyitásban / sávban / kapcsolat-képen: ${fileOf(u)}` });
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
        findings.push({ code: "repeat", detail: `a nyitó-animáció a nyitóképet mutatja (önmagára nyílik): ${fileOf(u)}` });
        continue;
      }
      if (!b) continue; // not served → the broken-image rule speaks for it
      if (isTown(u)) {
        // A town page's band shows the town's LOCAL picture (templateKit.allotPhotos): the town rule judges it.
        const tv = await judgeTownPicture(await townJudgeBytes(u, b));
        if (tv && !tv.ok) findings.push({ code: "subject", detail: `a sávban lévő helyi kép elbukik a településkép-szabályon (${tv.reason}): ${fileOf(u)}` });
        continue;
      }
      const v = await classifyPhotoBuffer(b);
      const label = v?.label ?? "nincs ítélet";
      if (!fitsOpening(v)) {
        findings.push({ code: "subject", detail: `a nyitásban / sávban / kapcsolat-képen nem odavaló kép (${label}): ${fileOf(u)}` });
      } else if (bands.has(u) && !fitsBand(v)) {
        // A band is a screen of its own: a close-up, a dark shot or a thing instead of a place fails (11-25).
        findings.push({ code: "subject", detail: `a széles sávképen közelkép / sötét / nem a helyet mutató kép (${label}): ${fileOf(u)}` });
      } else if (contacts.has(u) && !fitsContact(v)) {
        findings.push({ code: "subject", detail: `a kapcsolat-képen jármű / ember / állat (${label}): ${fileOf(u)}` });
      }
    }
    for (const u of urls) {
      const b = bodies.get(u);
      if (!b || stockUrl(u)) continue;
      if (isTown(u)) {
        // A local picture of the town (gallery) is a sight by design: the town rule judges it.
        if (u === heroUrl) continue;
        const tv = await judgeTownPicture(await townJudgeBytes(u, b));
        if (tv && !tv.ok) findings.push({ code: "subject", detail: `a helyi kép elbukik a településkép-szabályon (${tv.reason}): ${fileOf(u)}` });
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
    if (!SAMPLE_MODULES.has(sl.mod)) findings.push({ code: "stock", detail: `mintakép nem galéria- / szobahelyen (${sl.mod}): ${fileOf(sl.u)}` });
    else if (!sl.sample) findings.push({ code: "stock", detail: `jelöletlen mintakép („MINTA” nélkül): ${fileOf(sl.u)}` });
    else if (opts.stockOk === false) findings.push({ code: "stock", detail: `mintakép az ország szabálya szerint nem mehet (galéria- / szobahely): ${fileOf(sl.u)}` });
  }

  if (measure.scrollWidth > measure.innerWidth + 1) {
    findings.push({ code: "overflow", detail: `mobilon az oldal ${measure.scrollWidth - measure.innerWidth} px-szel szélesebb a képernyőnél` });
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
  for (const u of broken) findings.push({ code: "broken", detail: `nem töltődik be: ${fileOf(u)}` });

  return { verdict: findings.length ? "fail" : "pass", findings, slots: slots.length };
}

/** The cached verdict if it belongs to the current file and rule version. */
export function cachedRenderGate(inputs: unknown, mtime: number, stockOk = true): RenderGateResult | null {
  const g = (inputs as { renderGate?: RenderGateResult } | null)?.renderGate;
  // 0155: a verdict judged under another stock rule of the country is stale.
  return g && g.version === RENDER_GATE_VERSION && g.mtime === mtime && (g.stockOk ?? true) === stockOk ? g : null;
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
export async function renderGateFor(artifactId: string): Promise<RenderGateResult> {
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
    const r = await auditMockFile(mockAbs, town, { stockOk, proper });
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
