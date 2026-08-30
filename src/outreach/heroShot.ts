// Hero screenshot of a mock artifact for the outreach e-mail (the "see your
// site right in the mail" hook). Renders the FIRST screen of the generated
// mock HTML (not full page) via headless Chromium and caches the PNG per
// artifact. Best-effort: callers must treat a null result as "mail goes out
// without the image" — a screenshot failure must never block a §C-PASS send.
//
// The shot is embedded CID-inline (no remote fetch): it displays without a
// public host, and image-loading cannot double as open-tracking (§C hygiene —
// the guard explicitly credited the no-pixel property).

import { access, mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { T, prepareMailLang } from "../i18n/mail.js";
import { PORTAL_USER_AGENT } from "../scraper/sources/portals/politeness.js";

const SHOT_DIR = path.resolve(process.cwd(), "sites/_outreach-shots");

/** Rendered at desktop layout, downscaled to e-mail width (~608px wide file). */
const VIEWPORT = { width: 1216, height: 760 };
const SCALE = 0.5;

/** Portal hosts rate-limit bursts (lake-balaton.com answered 429 to the mock's
 * 12 parallel image loads) — one polite pause + retry usually clears it. */
const ATTEMPTS = 2;
const RETRY_PAUSE_MS = 6000;
/** Gap between two image DISPATCHES to the same host — the politeness layer's
 * "one request at a time per host" rule applied to the shot render, because the
 * browser's 12-image burst is exactly what earns the 429. */
const IMG_GAP_MS = 500;

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure the cached hero shot for an artifact exists; returns the PNG path or
 * null (missing/invalid mock file, browser failure). Cache key = artifact id +
 * mock file mtime, so a re-generated mock gets a fresh shot.
 */
export async function ensureHeroShot(artifactId: string): Promise<string | null> {
  try {
    const a = await db
      .selectFrom("mock_artifact")
      .select("path")
      .where("id", "=", artifactId)
      .executeTakeFirst();
    if (!a?.path) return null;
    const mockAbs = path.resolve(process.cwd(), a.path);
    if (!(await fileExists(mockAbs))) return null;

    const mtime = Math.floor((await stat(mockAbs)).mtimeMs / 1000);
    // ADR-0070: the baked-in ribbon speaks the MOCK's language (read from the
    // snapshot's <html lang>) — a Polish lead's e-mail image must not carry a
    // Hungarian banner. v3 cache-busts the Hungarian-only v2 shots.
    const mockHtml = await readFile(mockAbs, "utf8");
    const shotLang =
      /<html[^>]*\blang="([a-zA-Z-]{2,8})"/i.exec(mockHtml)?.[1]?.toLowerCase() ?? "hu";
    // Two steps on purpose: the i18n guards key on `T(<identifier>, "literal")`.
    const ribbonLang = await prepareMailLang(shotLang);
    const ribbon = T(ribbonLang, "ELŐZETES LÁTVÁNYTERV — CITOVISO");
    // v4 cache-busts v3: those shots were taken without verifying the first
    // screen's images, so a portal 429 could freeze an EMPTY hero into the cache.
    const dest = path.join(SHOT_DIR, `${artifactId}-${mtime}-v4.png`);
    if (await fileExists(dest)) return dest;

    await mkdir(SHOT_DIR, { recursive: true });
    const browser = await chromium.launch({ executablePath: config.chromiumPath });
    try {
      // A screenshot with a missing hero photo is worse than no screenshot: it
      // went out as an empty-looking MMS once (2026-08-30, portal answered 429
      // to the image burst). The shot is only valid — and only cached — when
      // every first-screen image PROVABLY loaded; otherwise retry, then null.
      for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        const page = await browser.newPage({
          viewport: VIEWPORT,
          deviceScaleFactor: SCALE,
          // Our honest, identifiable identity (politeness doctrine: never spoof
          // a browser). Also the practical fix: lake-balaton.com answers 429 to
          // the literal "HeadlessChrome" UA token, 200 to citoviso-bot.
          userAgent: PORTAL_USER_AGENT,
        });
        try {
          // Network log for CSS background images (their load state is not
          // readable from the DOM the way <img>.complete/naturalWidth is).
          const failedNet = new Set<string>();
          page.on("requestfailed", (r) => {
            if (r.resourceType() === "image") failedNet.add(r.url());
          });
          page.on("response", (r) => {
            if (!r.ok() && r.request().resourceType() === "image") failedNet.add(r.url());
          });
          // Serialise image requests per host with a small gap — no burst.
          const hostChain = new Map<string, Promise<void>>();
          await page.route("**/*", async (route) => {
            if (route.request().resourceType() !== "image") return route.continue();
            let host: string;
            try {
              host = new URL(route.request().url()).host;
            } catch {
              return route.continue();
            }
            const prev = hostChain.get(host) ?? Promise.resolve();
            hostChain.set(
              host,
              prev.then(() => new Promise<void>((r) => setTimeout(r, IMG_GAP_MS))),
            );
            await prev;
            await route.continue();
          });
          await page.goto(`file://${mockAbs}`, { waitUntil: "networkidle", timeout: 30000 });
          await page.waitForTimeout(800); // webfonts + hero image settle

          // Passed as a STRING on purpose: tsx/esbuild decorates inline
          // functions with a `__name` helper that does not exist in the page
          // context, so a function-valued evaluate throws ReferenceError.
          const view = (await page.evaluate(`(() => {
            const vh = ${VIEWPORT.height};
            const inView = (el) => {
              const r = el.getBoundingClientRect();
              return r.bottom > 0 && r.top < vh && r.width > 8 && r.height > 8;
            };
            const brokenImgs = [];
            for (const img of Array.from(document.images)) {
              const src = img.currentSrc || img.src;
              if (src && inView(img) && (!img.complete || img.naturalWidth === 0)) {
                brokenImgs.push(src);
              }
            }
            const bgUrls = [];
            for (const el of Array.from(document.querySelectorAll("*"))) {
              if (!inView(el)) continue;
              const m = /url\\(["']?([^"')]+)["']?\\)/.exec(getComputedStyle(el).backgroundImage);
              if (m && /^https?:/i.test(m[1])) bgUrls.push(m[1]);
            }
            return { brokenImgs, bgUrls };
          })()`)) as { brokenImgs: string[]; bgUrls: string[] };

          const broken = [
            ...view.brokenImgs,
            ...view.bgUrls.filter((u) => failedNet.has(u)),
          ];
          if (broken.length) {
            console.warn(
              `[heroShot] ${artifactId}: first-screen image failed to load` +
                ` (attempt ${attempt}/${ATTEMPTS}): ${broken.join(" · ").slice(0, 400)}`,
            );
            if (attempt < ATTEMPTS) {
              await new Promise((r) => setTimeout(r, RETRY_PAUSE_MS));
            }
            continue;
          }

          // §A: bake the plan-framing INTO the pixels — the mock's own demo-framing
          // footer is below the fold, and a forwarded/saved image must keep the
          // "preliminary plan" claim on its own (guard-agent hardening, 2026-08-01).
          await page.evaluate((ribbonText: string) => {
            const b = document.createElement("div");
            b.textContent = ribbonText;
            b.setAttribute(
              "style",
              "position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#0e2a47;" +
                "color:#fff;font:600 15px/1 Arial,sans-serif;letter-spacing:.12em;" +
                "text-align:center;padding:9px 0",
            );
            document.body.appendChild(b);
          }, ribbon);
          await page.screenshot({ path: dest, fullPage: false });
          return dest;
        } finally {
          await page.close().catch(() => {});
        }
      }
    } finally {
      await browser.close();
    }
    console.warn(`[heroShot] ${artifactId}: no valid hero shot after ${ATTEMPTS} attempts — returning null`);
    return null;
  } catch (e) {
    console.warn(`[heroShot] ${artifactId}: ${(e as Error).message}`);
    return null;
  }
}
