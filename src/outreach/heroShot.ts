// Hero screenshot of a mock artifact for the outreach e-mail (the "see your
// site right in the mail" hook). Renders the FIRST screen of the generated
// mock HTML (not full page) via headless Chromium and caches the PNG per
// artifact. Best-effort: callers must treat a null result as "mail goes out
// without the image" — a screenshot failure must never block a §C-PASS send.
//
// The shot is embedded CID-inline (no remote fetch): it displays without a
// public host, and image-loading cannot double as open-tracking (§C hygiene —
// the guard explicitly credited the no-pixel property).

import { access, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
import { config } from "../config.js";
import { db } from "../db/client.js";

const SHOT_DIR = path.resolve(process.cwd(), "sites/_outreach-shots");

/** Rendered at desktop layout, downscaled to e-mail width (~608px wide file). */
const VIEWPORT = { width: 1216, height: 760 };
const SCALE = 0.5;

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
    // v2: framing ribbon baked into the shot (cache-busts the ribbonless v1).
    const dest = path.join(SHOT_DIR, `${artifactId}-${mtime}-v2.png`);
    if (await fileExists(dest)) return dest;

    await mkdir(SHOT_DIR, { recursive: true });
    const browser = await chromium.launch({ executablePath: config.chromiumPath });
    try {
      const page = await browser.newPage({
        viewport: VIEWPORT,
        deviceScaleFactor: SCALE,
      });
      await page.goto(`file://${mockAbs}`, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(800); // webfonts + hero image settle
      // §A: bake the plan-framing INTO the pixels — the mock's own demo-framing
      // footer is below the fold, and a forwarded/saved image must keep the
      // "preliminary plan" claim on its own (guard-agent hardening, 2026-08-01).
      await page.evaluate(() => {
        const b = document.createElement("div");
        b.textContent = "ELŐZETES LÁTVÁNYTERV — CITOVISO";
        b.setAttribute(
          "style",
          "position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#0e2a47;" +
            "color:#fff;font:600 15px/1 Arial,sans-serif;letter-spacing:.12em;" +
            "text-align:center;padding:9px 0",
        );
        document.body.appendChild(b);
      });
      await page.screenshot({ path: dest, fullPage: false });
    } finally {
      await browser.close();
    }
    return dest;
  } catch (e) {
    console.warn(`[heroShot] ${artifactId}: ${(e as Error).message}`);
    return null;
  }
}
