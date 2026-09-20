// Screenshot of the buyer's LIVE site for the payment-confirmation page
// (approved contract: assets/design-refs/console/paydone-split/, point ④ ①).
//
// Why a second shot module next to outreach/heroShot.ts: that one photographs a
// MOCK ARTIFACT and bakes a "preliminary plan" ribbon into the pixels. This one
// photographs the SITE SNAPSHOT that is actually served to visitors, and must
// carry NO ribbon — a ribbon here would be a lie about a page that is live.
// The two shots therefore key differently (tenant vs artifact), cache
// differently, and invalidate on different events; sharing one function would
// couple the live-site path to the outreach path's framing rules.
//
// Best-effort by contract: the page NEVER waits for this. A missing shot falls
// back to the hero photo, and that to a brand gradient (contract ④ ②/③).

import { access, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
import { config } from "../config.js";
import { db } from "../db/client.js";

const SHOT_DIR = path.resolve(process.cwd(), "sites/_pay-shots");

/** Rendered at desktop layout; the card shows it ~600 CSS px wide, so half scale
 *  still lands above the display size (crisp on a phone's 2-3× screen). */
const VIEWPORT = { width: 1240, height: 820 };
const SCALE = 0.5;
/** One retry: an image host that rate-limited the burst usually answers the
 *  second try. Two is the ceiling — nobody is waiting for this. */
const ATTEMPTS = 2;
const RETRY_PAUSE_MS = 4000;

export type SiteShotFail =
  | { code: "no-site" }
  | { code: "no-snapshot"; detail: string }
  | { code: "broken-images"; detail: string }
  | { code: "error"; detail: string };

export interface SiteShotResult {
  readonly path: string | null;
  readonly fail?: SiteShotFail;
}

/** In-flight renders keyed by tenant: two page loads must not launch two
 *  Chromiums for the same shot, and the second would race on the same file. */
const inflight = new Map<string, Promise<SiteShotResult>>();

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/** The live snapshot that visitors are served, with its mtime — the cache key.
 *  An edit re-renders the snapshot, which changes the mtime, which retires the
 *  old shot: the confirmation can never show a stale picture of the site. */
async function snapshotOf(
  tenantId: string,
): Promise<{ abs: string; mtime: number } | { fail: SiteShotFail }> {
  const row = await db
    .selectFrom("site")
    .select(["path", "status"])
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  if (!row) return { fail: { code: "no-site" } };
  if (!row.path) return { fail: { code: "no-snapshot", detail: "site.path üres" } };
  const abs = path.resolve(process.cwd(), row.path);
  if (!(await fileExists(abs))) return { fail: { code: "no-snapshot", detail: row.path } };
  return { abs, mtime: Math.floor((await stat(abs)).mtimeMs / 1000) };
}

function destFor(tenantId: string, mtime: number): string {
  return path.join(SHOT_DIR, `${tenantId}-${mtime}-v1.png`);
}

/**
 * Cache probe — no browser, no network: one DB row and two stat() calls, cheap
 * enough to run while rendering the confirmation page.
 */
export async function siteShotPath(tenantId: string): Promise<string | null> {
  try {
    const snap = await snapshotOf(tenantId);
    if ("fail" in snap) return null;
    const dest = destFor(tenantId, snap.mtime);
    return (await fileExists(dest)) ? dest : null;
  } catch {
    return null;
  }
}

/** Fire the render in the background (idempotent). Callers never await it. */
export function startSiteShot(tenantId: string): void {
  void ensureSiteShot(tenantId).catch(() => {});
}

/** Ensure the cached shot exists; returns the PNG path or null WITH a reason. */
export async function ensureSiteShot(tenantId: string): Promise<SiteShotResult> {
  const running = inflight.get(tenantId);
  if (running) return running;
  const p = renderSiteShot(tenantId).finally(() => inflight.delete(tenantId));
  inflight.set(tenantId, p);
  return p;
}

async function renderSiteShot(tenantId: string): Promise<SiteShotResult> {
  try {
    const snap = await snapshotOf(tenantId);
    if ("fail" in snap) return { path: null, fail: snap.fail };
    const dest = destFor(tenantId, snap.mtime);
    if (await fileExists(dest)) return { path: dest };
    await mkdir(SHOT_DIR, { recursive: true });

    let lastBroken: string[] = [];
    const browser = await chromium.launch({ executablePath: config.chromiumPath });
    try {
      for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
        try {
          // ⛔ CSS BACKGROUNDS TOO. The first version only inspected <img> elements
          // and cheerfully cached a shot whose HERO WAS MISSING: most templates
          // paint the opening image as a `background-image`, whose load state is
          // NOT readable from the DOM the way img.complete is. Measured on the very
          // first real run (2026-09-20) — the page looked half-empty and the guard
          // said "ok". The network log is the only honest witness.
          const failedNet = new Set<string>();
          page.on("requestfailed", (r) => {
            if (r.resourceType() === "image") failedNet.add(r.url());
          });
          page.on("response", (r) => {
            if (!r.ok() && r.request().resourceType() === "image") failedNet.add(r.url());
          });
          await page.goto(`file://${snap.abs}`, { waitUntil: "networkidle", timeout: 30_000 });
          await page.waitForTimeout(800); // webfonts + hero image settle

          // ⛔ A confirmation that shows a HALF-LOADED site is worse than one that
          // shows the hero photo: the buyer just paid, and the first thing they
          // would see is their own page broken. Only a shot whose first-screen
          // images PROVABLY loaded may be cached (the lesson heroShot paid for in
          // 2026-08-30). Passed as a STRING: tsx decorates inline functions with a
          // `__name` helper that does not exist in the page context.
          const view = (await page.evaluate(`(() => {
            const vh = ${VIEWPORT.height};
            const inView = (el) => {
              const r = el.getBoundingClientRect();
              return r.bottom > 0 && r.top < vh && r.width > 8 && r.height > 8;
            };
            const brokenImgs = [];
            for (const img of Array.from(document.images)) {
              const src = img.currentSrc || img.src;
              if (src && inView(img) && (!img.complete || img.naturalWidth === 0)) brokenImgs.push(src);
            }
            const bgUrls = [];
            for (const el of Array.from(document.querySelectorAll("*"))) {
              if (!inView(el)) continue;
              const m = /url\\(["']?([^"')]+)["']?\\)/.exec(getComputedStyle(el).backgroundImage);
              if (m && /^https?:/i.test(m[1])) bgUrls.push(m[1]);
            }
            return { brokenImgs, bgUrls };
          })()`)) as { brokenImgs: string[]; bgUrls: string[] };
          const broken = [...view.brokenImgs, ...view.bgUrls.filter((u) => failedNet.has(u))];

          if (broken.length) {
            lastBroken = broken;
            console.warn(
              `[siteShot] ${tenantId}: az első képernyő képe nem töltött be ` +
                `(${attempt}/${ATTEMPTS}): ${broken.join(" · ").slice(0, 300)}`,
            );
            if (attempt < ATTEMPTS) await new Promise((r) => setTimeout(r, RETRY_PAUSE_MS));
            continue;
          }
          await page.screenshot({ path: dest, fullPage: false });
          return { path: dest };
        } finally {
          await page.close().catch(() => {});
        }
      }
    } finally {
      await browser.close();
    }
    console.warn(`[siteShot] ${tenantId}: nincs érvényes kép ${ATTEMPTS} kísérlet után`);
    return {
      path: null,
      fail: { code: "broken-images", detail: lastBroken.join(" · ").slice(0, 300) },
    };
  } catch (e) {
    console.warn(`[siteShot] ${tenantId}: ${(e as Error).message}`);
    return { path: null, fail: { code: "error", detail: (e as Error).message.slice(0, 200) } };
  }
}
