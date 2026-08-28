// GUARD — the mock template picker must be SELECTABLE (ADR-0027: the curator picks
// the art direction). A previous version put `event.preventDefault()` on the card
// thumbnail, so clicking the picture — 80% of the card — only opened the gallery and
// NEVER selected the layout: the picker looked fine and did nothing.
//
// This check measures what matters (behaviour, not markup): it drives a real browser,
// clicks a card's IMAGE, and asserts the checkbox actually became ticked and no lightbox
// opened; then clicks the zoom button and asserts the lightbox DOES open and the tick is
// unchanged. Multi-select (jóváhagyott terv): ticking a card must NOT untick the others,
// so several looks can be generated at once. Runs on desktop AND phone (mobile-first).
//
//   npx tsx scripts/template-picker-check.mts
//
// Self-test: `--self-test` re-runs the assertions against the OLD broken markup and
// requires them to FAIL — a guard that cannot go red is not a guard.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright-core";
import { config } from "../src/config.js";
import { leadPage } from "../src/console/views.js";
import type { LeadDetail } from "../src/console/data.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SELF_TEST = process.argv.includes("--self-test");

const FIXTURE: LeadDetail = {
  id: "00000000-0000-4000-8000-000000000000",
  name: "Teszt Vendégház",
  qualification: "no_site",
  lifecycle: "qualified",
  matchConfidence: 0.9,
  address: "Teszt utca 1., Köveskál",
  region: "balaton-felvidek",
  raw: {},
  provenance: [],
  artifacts: [],
};

const MIME: Record<string, string> = {
  ".css": "text/css",
  ".js": "text/javascript",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

/** Break the picker the way it was broken before the fix (thumbnail swallows the click). */
function breakMarkup(html: string): string {
  return html.replace(
    /<img src="\/assets\/ui\/tpl-([a-z0-9-]+)\.jpg"([^>]*)>/g,
    (_m, id: string, rest: string) =>
      `<img src="/assets/ui/tpl-${id}.jpg"${rest} onclick="event.preventDefault();citTplGallery('${id}')">`,
  );
}

function serve(html: string): Promise<{ url: string; close: () => void }> {
  const server = http.createServer((req, res) => {
    const url = (req.url ?? "/").split("?")[0] ?? "/";
    if (url === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(html);
    }
    const file = path.join(ROOT, "public", url.replace(/^\/+/, ""));
    if (file.startsWith(path.join(ROOT, "public")) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream" });
      return res.end(fs.readFileSync(file));
    }
    res.writeHead(404).end("nope");
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as { port: number }).port;
      resolve({ url: `http://127.0.0.1:${port}/`, close: () => server.close() });
    });
  });
}

const failures: string[] = [];
function check(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`${ok ? "  ok  " : "  FAIL"} ${label}`);
}

/** Is a specific template id ticked? (Multi-select: several may be on at once.) */
async function isChecked(page: Page, id: string): Promise<boolean> {
  return page.$eval(`.tpl-cards input[value="${id}"]`, (el) => (el as HTMLInputElement).checked);
}

/** How many templates are ticked right now (proves multi-select does NOT deselect others). */
async function checkedCount(page: Page): Promise<number> {
  return page.$$eval(".tpl-cards input[name=template]:checked", (els) => els.length);
}

async function lightboxOpen(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const lb = document.querySelector(".cit-lb");
    return !!lb && getComputedStyle(lb).display !== "none";
  });
}

async function run(page: Page, url: string, viewport: string): Promise<void> {
  // Short timeout + failures instead of throws: a broken picker must go RED with a
  // readable verdict, not hang the guard for a minute on an intercepted click.
  page.setDefaultTimeout(5000);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  // The picker lives on the "Mock és generálás" tab of the lead dossier. Reach it
  // the way an operator does — by clicking the tab — so this guard covers the tab
  // route too: a picker that works but cannot be REACHED is still a broken picker.
  const tab = await page.$('.con-ltab[data-tab="ls-mocks"]');
  if (tab) {
    await tab.click();
    check(
      `[${viewport}] a "Mock és generálás" fül megnyitja a választót`,
      await page.$eval(".tpl-cards", (el) => getComputedStyle(el).display !== "none" && el.getBoundingClientRect().height > 0),
    );
  }
  const ids = await page.$$eval(".tpl-cards input[name=template]", (els) =>
    els.map((e) => (e as HTMLInputElement).value),
  );
  if (ids.length < 2) throw new Error("a sablon-választóban kevesebb mint 2 kártya van");
  // Pick a card that is NOT the default, so "checked" cannot be a false positive.
  const target = ids[ids.length - 1] as string;
  const card = `.tpl-card:has(input[value="${target}"])`;

  // 1) Clicking the THUMBNAIL ticks the card — this is the whole point of the picker.
  await page.click(`${card} img`);
  check(`[${viewport}] kép-kattintás bejelöli a(z) "${target}" kinézetet`, await isChecked(page, target));
  check(`[${viewport}] kép-kattintás NEM nyit nagyítót`, !(await lightboxOpen(page)));
  check(`[${viewport}] a kiválasztott kártya kapja a jelölést`, await page.$eval(card, (el) => el.classList.contains("on")));
  check(
    `[${viewport}] az előnézeti kép a választásra vált`,
    await page.$eval("#tpl-prev-img", (el, t) => (el as HTMLImageElement).src.includes(`tpl-${t}-prev.jpg`), target),
  );
  // MULTI-SELECT (jóváhagyott terv): a célkártya bejelölése NEM veszi le az alapból jelölt
  // fullbleed-et — több típusra egyszerre generálunk. (Régi single-select: itt 1 lett volna.)
  check(`[${viewport}] multi-select: a target MELLETT az alap is jelölt marad (≥2)`, (await checkedCount(page)) >= 2);

  // 2) The zoom button — and only it — opens the gallery, without losing the choice.
  // (Dismiss anything step 1 may have opened, so this step tests the button, not the leftover.)
  await page.keyboard.press("Escape");
  await page.click(`${card} .tpl-card__zoom`);
  check(`[${viewport}] a nagyító-gomb megnyitja a galériát`, await lightboxOpen(page));
  check(`[${viewport}] a nagyítás nem törli a jelölést`, await isChecked(page, target));
  await page.keyboard.press("Escape");

  // 3) Tap target: the phone console needs a thumb-sized button (>= 30px).
  const box = await page.$eval(`${card} .tpl-card__zoom`, (el) => {
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height };
  });
  check(`[${viewport}] a nagyító-gomb tap-mérete >= 30px (${Math.round(box.w)}×${Math.round(box.h)})`, box.w >= 30 && box.h >= 30);
}

async function main(): Promise<void> {
  let html = leadPage(FIXTURE);
  if (SELF_TEST) html = breakMarkup(html);
  const { url, close } = await serve(html);
  const browser = await chromium.launch({ executablePath: config.chromiumPath });
  try {
    for (const vp of [
      { name: "desktop", width: 1280, height: 900 },
      { name: "mobil-390", width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      try {
        await run(page, url, vp.name);
      } catch (err) {
        // A thrown interaction (element unclickable, intercepted, missing) IS a failure.
        check(`[${vp.name}] a választó vezérelhető: ${(err as Error).message.split("\n")[0]}`, false);
      }
      await page.close();
    }
  } finally {
    await browser.close();
    close();
  }

  if (SELF_TEST) {
    if (failures.length === 0) {
      console.error("\n❌ ÖNTESZT: a szándékosan elrontott jelölőn is ZÖLD lett — az őr nem mér semmit.");
      process.exit(1);
    }
    console.log(`\n✅ ÖNTESZT: a törött jelölőn ${failures.length} ellenőrzés elbukott — az őr valóban pirosra tud menni.`);
    return;
  }
  if (failures.length) {
    console.error(`\n❌ Sablon-választó: ${failures.length} hiba.`);
    process.exit(1);
  }
  console.log("\n✅ Sablon-választó: a kártya választ, a nagyító nagyít (desktop + mobil).");
}

void main();
