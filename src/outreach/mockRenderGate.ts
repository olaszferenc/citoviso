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
//   stock    — any stock illustration (public/assets/stock) on the page
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
import { config } from "../config.js";
import { db } from "../db/client.js";
import { isSamePicture, sizelessPhotoKey } from "../engine/samePicture.js";
import { dHashFromBuffer } from "../generator/photoHash.js";
import { readCachedScores, photoUrlKey } from "../generator/heroPick.js";
import { PORTAL_USER_AGENT } from "../scraper/sources/portals/politeness.js";
import { acquireRenderSlot } from "./heroShot.js";
import { bandScore, classifyPhotoBuffer, isHeroWorthy, isOffPagePhoto, isShowcase, photoKindAvailable } from "../media/photoKind.js";
import { createPhotoCache } from "./photoCache.js";

/** Bump when the rules change: every cached verdict of an older version is re-checked. */
export const RENDER_GATE_VERSION = 10;

const VIEWPORT = { width: 390, height: 844 };
/** The letter's picture (heroShot.ts VIEWPORT): its first screen is measured too. */
const DESKTOP_VIEWPORT = { width: 1216, height: 760 };
/** An image smaller than this on screen is an icon / logo / avatar, not a photo slot. */
const MIN_SLOT_PX = 80;
const IMG_GAP_MS = 400;

/** Vision subjects that never belong on a lodging page shown to its owner. */
const FORBIDDEN_SUBJECTS = new Set(["ad_banner", "sign_map", "people_doc", "toilet"]);

export type RenderFindingCode = "repeat" | "subject" | "stock" | "overflow" | "broken" | "render";

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
}

interface Slot {
  readonly u: string;
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
    slots.push({ u, y: Math.round(r.top + scrollY), x: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height), mod: modOf(el) });
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
  return { slots, broken, scrollWidth: document.documentElement.scrollWidth, innerWidth: iw, wideText, brokenWords };
})()`;

/**
 * Render one mock HTML file like a phone and judge it. Pure of the DB except for reading the
 * cached vision verdicts (no paid call). Throws only on a launch failure.
 */
export async function auditMockFile(mockAbs: string): Promise<Omit<RenderGateResult, "mtime" | "at" | "version">> {
  const photos = createPhotoCache();
  const bodies = new Map<string, Buffer>();
  const failedNet = new Set<string>();
  const release = await acquireRenderSlot();
  const browser = await chromium.launch({ executablePath: config.chromiumPath }).catch((e) => {
    release();
    throw e;
  });
  let measure: PageMeasure;
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
    const opening = (await page.evaluate(MEASURE_JS)) as PageMeasure;
    // Walk the page so lazy images load, then measure from the top.
    const height = (await page.evaluate("document.documentElement.scrollHeight")) as number;
    for (let y = 0; y < height; y += VIEWPORT.height / 2) {
      await page.evaluate(`window.scrollTo(0, ${y})`);
      await page.waitForTimeout(120);
    }
    await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => undefined);
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

  // repeat — group slots by picture (URL key, then dHash), ignore stacked layers of one place.
  const hashOf = new Map<string, string | undefined>();
  for (const s of slots) {
    if (hashOf.has(s.u)) continue;
    const b = bodies.get(s.u);
    hashOf.set(s.u, b ? await dHashFromBuffer(b).catch(() => undefined) : undefined);
  }
  const groups: Slot[][] = [];
  for (const s of slots) {
    const g = groups.find((gr) => gr.some((o) => photoUrlKey(o.u) === photoUrlKey(s.u) || isSamePicture(hashOf.get(o.u), hashOf.get(s.u))));
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
    if (heroUrl && heroBytes) {
      const hv = await classifyPhotoBuffer(heroBytes);
      if (hv && !isHeroWorthy(hv)) {
        findings.push({ code: "subject", detail: `a nyitókép nem való nyitóképnek (${hv.label}): ${fileOf(heroUrl)}` });
      }
    }
    // THE OPENING SEQUENCE, TOO (11-24, second round): wordmark-grow cycles photos 2–5 in its big
    // frame before the hero fades in, and gate-opening's leaves carry their own photo — a toilet or a
    // bathtub there opens the page just as a bathtub hero would (Pirkadat, Mia). Read from the page
    // itself (the intro's SHOTS list, the leaf <img>), judged with the same local classifier.
    const html = await readFile(mockAbs, "utf8").catch(() => "");
    const opening = new Set<string>();
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
    for (const m of html.matchAll(/class="t-conphoto"><img src="([^"]+)"/g)) opening.add(m[1]!.replace(/&amp;/g, "&"));
    const heroHash = heroBytes ? await dHashFromBuffer(heroBytes).catch(() => undefined) : undefined;
    for (const u of opening) {
      if (/\/assets\/stock\//.test(u)) continue;
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
      const v = await classifyPhotoBuffer(b);
      if (v && !isShowcase(v)) {
        findings.push({ code: "subject", detail: `a nyitásban / sávban / kapcsolat-képen nem odavaló kép (${v.label}): ${fileOf(u)}` });
      } else if (v && bands.has(u) && !bandScore(v)) {
        // A band is a screen of its own: a close-up, a dark shot or a thing instead of a place fails (11-25).
        findings.push({ code: "subject", detail: `a széles sávképen közelkép / sötét / nem a helyet mutató kép (${v.label}): ${fileOf(u)}` });
      }
    }
    for (const u of urls) {
      const b = bodies.get(u);
      if (!b || /\/assets\/stock\//.test(u)) continue;
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

  for (const u of urls.filter((x) => /\/assets\/stock\//.test(x))) {
    findings.push({ code: "stock", detail: `stock kép a lapon: ${fileOf(u)}` });
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
export function cachedRenderGate(inputs: unknown, mtime: number): RenderGateResult | null {
  const g = (inputs as { renderGate?: RenderGateResult } | null)?.renderGate;
  return g && g.version === RENDER_GATE_VERSION && g.mtime === mtime ? g : null;
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
  const cached = cachedRenderGate(a.inputs, mtime);
  if (cached) return cached;
  let result: RenderGateResult;
  try {
    const r = await auditMockFile(mockAbs);
    result = { version: RENDER_GATE_VERSION, mtime, at: now, ...r };
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
