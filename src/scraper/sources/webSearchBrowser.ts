// Keyless web search through a headless browser — the fallback when no Brave key is
// usable (ADR-0463). Both Brave keys hit HTTP 402 on 2026-11-21 and the owner's frame is
// "no money": no API credit, no subscription. So the search runs in Chromium against a
// public results page, the way a person would search.
//
// ENGINE CHOICE (measured 2026-11-22 from the dev box, headless Chromium):
//   - Startpage: works. Results are Google-sourced but served from Startpage's own IP,
//     so it does not burn the Google captcha budget other jobs on the same IP use.
//     First visit gets a proof-of-work page that solves itself in the browser.
//   - Yahoo: the 2nd automated query is redirected to a /_bv/ bot check — unusable.
//   - Bing (browser and plain HTTP): answers bots with unrelated results — poisoned.
//   - DuckDuckGo (html/lite/js): "anomaly" challenge from the first query.
//   - Brave HTML search: HTTP 429 / empty page.
// So Startpage is the only engine here. A block puts it on a cooldown (callers get an
// empty result, loudly logged), it is never retried in a tight loop.
//
// ONE browser per process, launched lazily, every query serialized with a minimum gap
// (callers run 3 workers; a burst would trip the engine's bot check), and closed after a
// short idle so a CLI run can exit and the console does not keep a Chromium resident.

import { config } from "../../config.js";
import type { WebResult } from "./webSearch.js";

const MIN_GAP_MS = 3_000;
const IDLE_CLOSE_MS = 30_000;
const BLOCK_COOLDOWN_MS = 15 * 60_000;
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/** Accept-Language per Brave-style search_lang (the country layer's value). */
function acceptLanguage(searchLang: string): string {
  const l = (searchLang || "hu").toLowerCase().slice(0, 2);
  return l === "en" ? "en;q=0.9" : `${l};q=0.9,en;q=0.5`;
}

/** Enabled unless WEB_SEARCH_BROWSER=off; needs a Chromium binary. */
export function browserSearchEnabled(): boolean {
  return config.webSearchBrowser !== "off" && config.chromiumPath !== "";
}

type Browser = import("playwright-core").Browser;
let browserP: Promise<Browser> | null = null;
let idleTimer: NodeJS.Timeout | null = null;
let blockedUntil = 0;
const warned = new Set<string>();
function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.error(message);
}

async function getBrowser(): Promise<Browser> {
  if (!browserP) {
    browserP = import("playwright-core").then(({ chromium }) =>
      chromium.launch({
        executablePath: config.chromiumPath,
        headless: true,
        args: ["--disable-blink-features=AutomationControlled"],
      }),
    );
    browserP.catch(() => {
      browserP = null;
    });
  }
  return browserP;
}

function scheduleIdleClose(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    const p = browserP;
    browserP = null;
    void p?.then((b) => b.close()).catch(() => {});
  }, IDLE_CLOSE_MS);
}

let chain: Promise<unknown> = Promise.resolve();
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task);
  chain = run.catch(() => {}).then(() => new Promise((r) => setTimeout(r, MIN_GAP_MS)));
  return run;
}

/** One Startpage query in a fresh context. Throws "blocked" on a bot check. */
async function startpage(query: string, num: number, searchLang: string): Promise<WebResult[]> {
  const browser = await getBrowser();
  const ctx = await browser.newContext({
    userAgent: UA,
    locale: searchLang === "en" ? "en-US" : `${searchLang}-${searchLang.toUpperCase()}`,
    extraHTTPHeaders: { "Accept-Language": acceptLanguage(searchLang) },
  });
  try {
    await ctx.addInitScript(() => Object.defineProperty(navigator, "webdriver", { get: () => undefined }));
    const page = await ctx.newPage();
    await page.route("**/*", (r) =>
      ["image", "font", "media"].includes(r.request().resourceType()) ? r.abort() : r.continue(),
    );
    await page.goto(`https://www.startpage.com/do/search?q=${encodeURIComponent(query)}`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    // The proof-of-work page navigates on by itself once solved.
    const ready = await page
      .waitForSelector(".w-gl .result, .no-results, [class*='no-results']", { timeout: 20_000 })
      .then(() => true)
      .catch(() => false);
    let rows: WebResult[] = [];
    for (let i = 0; i < 3; i++) {
      try {
        rows = await page.evaluate(() =>
          [...document.querySelectorAll(".w-gl .result")].map((r) => ({
            // the title link is sometimes a /clev tracking redirect: take the first real link
            link:
              [...r.querySelectorAll<HTMLAnchorElement>("a.wgl-display-url, a.wgl-site-title, a.result-title")]
                .map((a) => a.href)
                .find((h) => /^https?:/.test(h) && !/startpage\.com$/.test(new URL(h).hostname)) ?? "",
            title: (r.querySelector(".wgl-title") as HTMLElement | null)?.innerText ?? "",
            snippet: (r.querySelector("p.description") as HTMLElement | null)?.innerText ?? "",
          })),
        );
        break;
      } catch {
        await page.waitForTimeout(1_500); // context replaced mid-navigation
      }
    }
    rows = rows.filter((r) => r.link !== "").slice(0, num);
    if (rows.length > 0) return rows;
    const html = await page.content().catch(() => "");
    if (/captcha|blocked/i.test(page.url()) || /verify you are (a )?human|g-recaptcha|hcaptcha/i.test(html)) {
      throw new Error("blocked");
    }
    if (!ready) throw new Error("timeout");
    return []; // a genuine empty results page
  } finally {
    await ctx.close().catch(() => {});
  }
}

/**
 * Search the open web in the browser. Never throws: a failure is an empty result with
 * a logged reason (the same contract as the Brave path in webSearch.ts).
 */
export async function browserSearch(query: string, num: number, searchLang: string): Promise<WebResult[]> {
  if (!browserSearchEnabled()) return [];
  if (Date.now() < blockedUntil) return [];
  return serialized(async () => {
    try {
      return await startpage(query, num, searchLang);
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      if (msg === "blocked") {
        blockedUntil = Date.now() + BLOCK_COOLDOWN_MS;
        console.error(`⛔ BÖNGÉSZŐS KERESÉS: a Startpage bot-ellenőrzést kért → ${BLOCK_COOLDOWN_MS / 60_000} percig szünetel.`);
      } else {
        warnOnce(`browser-${msg.slice(0, 40)}`, `⚠️ BÖNGÉSZŐS KERESÉS HIBA: ${msg.slice(0, 200)}`);
      }
      return [];
    } finally {
      scheduleIdleClose();
    }
  });
}
