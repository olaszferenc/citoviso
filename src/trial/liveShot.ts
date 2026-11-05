// ADR-XXXX — the picture of the trialist's LIVE site for the day-5 MMS (approved plan
// assets/design-refs/console/proba-eszkalacio/ „5. nap: MMS”).
//
// The trialists first answered an MMS (the mock's hero image). This shot reuses that channel
// with what is now THEIRS: the first screen of the live site at phone size, with a band at the
// bottom — „EZ MÁR AZ ÖN HONLAPJA” + the web address. Not the mock ribbon („előzetes
// látványterv”): the site is live and theirs.
//
// Same rule as the mock hero shot (heroShot.ts): a first screen with a broken image is worse
// than no MMS, so the shot only counts when every in-view image provably loaded.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
import { config } from "../config.js";
import { T, prepareMailLang } from "../i18n/mail.js";
import { toMmsJpeg } from "../mms/sender.js";
import { PORTAL_USER_AGENT } from "../scraper/sources/portals/politeness.js";

const SHOT_DIR = path.resolve(process.cwd(), "sites/_trial-shots");
const VIEWPORT = { width: 390, height: 560 };
const ATTEMPTS = 2;

export interface LiveShotResult {
  /** MMS-ready JPEG (≤ 290 KB), or null with the reason. */
  readonly path: string | null;
  readonly error?: string;
  /** The page's first heading (for the helper letter's own-site sentence), when found. */
  readonly heading?: string | null;
}

/** The band's text: the ribbon line in the mail language + the bare host. */
export async function liveShotBand(siteUrl: string, lang: string): Promise<{ title: string; host: string }> {
  const l = await prepareMailLang(lang);
  return { title: T(l, "EZ MÁR AZ ÖN HONLAPJA"), host: new URL(siteUrl).host };
}

/** Render the live site's first screen at phone size with the band; one MMS-ready JPEG per trial. */
export async function renderLiveShot(trialId: string, siteUrl: string, lang: string): Promise<LiveShotResult> {
  const band = await liveShotBand(siteUrl, lang);
  await mkdir(SHOT_DIR, { recursive: true });
  const dest = path.join(SHOT_DIR, `${trialId}-mms.jpg`);
  let lastError = "ismeretlen hiba"; // i18n-exempt: operátori napló
  const browser = await chromium.launch({ executablePath: config.chromiumPath });
  try {
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 2, userAgent: PORTAL_USER_AGENT });
      try {
        const resp = await page.goto(siteUrl, { waitUntil: "networkidle", timeout: 30000 });
        if (!resp || !resp.ok()) {
          lastError = `az élő oldal nem 200 (${resp?.status() ?? "nincs válasz"})`; // i18n-exempt: operátori napló
          continue;
        }
        await page.waitForTimeout(800);
        // A STRING on purpose (tsx `__name` helper does not exist in the page — see heroShot.ts).
        const view = (await page.evaluate(`(() => {
          const vh = ${VIEWPORT.height};
          const inView = (el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < vh && r.width > 8 && r.height > 8; };
          const broken = [];
          for (const img of Array.from(document.images)) {
            const src = img.currentSrc || img.src;
            if (src && inView(img) && (!img.complete || img.naturalWidth === 0)) broken.push(src);
          }
          const h = document.querySelector("h1");
          const heading = h ? (h.textContent || "").replace(/\\s+/g, " ").trim() : "";
          return { broken, heading };
        })()`)) as { broken: string[]; heading: string };
        if (view.broken.length) {
          lastError = `nem töltődött be kép az első képernyőn: ${view.broken.join(" · ").slice(0, 300)}`; // i18n-exempt: operátori napló
          continue;
        }
        await page.evaluate(
          `((t, h) => {
            const b = document.createElement("div");
            b.setAttribute("style", "position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:#0a1f36;color:#fff;padding:12px 16px 13px;font:700 17px/1.25 Arial,sans-serif;letter-spacing:.02em");
            const s = document.createElement("div");
            s.textContent = h;
            s.setAttribute("style", "font:500 13px/1.3 Arial,sans-serif;color:#6fd8eb;margin-top:3px;letter-spacing:0");
            b.textContent = t;
            b.appendChild(s);
            document.body.appendChild(b);
          })(${JSON.stringify(band.title)}, ${JSON.stringify(band.host)})`,
        );
        const png = await page.screenshot({ fullPage: false });
        await writeFile(dest, await toMmsJpeg(png));
        const heading = view.heading && view.heading.length <= 120 ? view.heading : null;
        return { path: dest, heading };
      } catch (e) {
        lastError = (e as Error).message.slice(0, 300);
      } finally {
        await page.close().catch(() => {});
      }
    }
  } finally {
    await browser.close();
  }
  return { path: null, error: lastError };
}

/** Only the first heading of the live page (the helper letter's own-site sentence) — no browser. */
export async function liveHeading(siteUrl: string): Promise<string | null> {
  try {
    const r = await fetch(siteUrl, { headers: { "user-agent": PORTAL_USER_AGENT }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const html = await r.text();
    const m = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
    if (!m) return null;
    const text = m[1]!
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
    return text && text.length <= 120 ? text : null;
  } catch {
    return null;
  }
}
