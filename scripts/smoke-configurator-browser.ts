// Headless browser smoke for the configurator runtime: load a .configure.html,
// open the panel, toggle a sample + a present module, assert DOM effects.
import { chromium } from "playwright-core";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { config } from "../src/config.js";

const file = process.argv[2];
if (!file) {
  console.error("usage: tsx scripts/smoke-configurator-browser.ts <mock.configure.html>");
  process.exit(1);
}

const browser = await chromium.launch({ executablePath: config.chromiumPath });
const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(pathToFileURL(path.resolve(file)).href);

const results: Record<string, unknown> = {};

// 1) launcher exists
results.launcher = await page.locator(".cit-cfg-launch").count();

// 2) open panel
await page.locator(".cit-cfg-launch").click();
results.panelOpen = await page.locator(".cit-cfg-panel.cit-cfg-open").count();

// 3) toggle a SAMPLE module (rooms — never present) → sample block appears
const roomsRow = page.locator('.cit-cfg-row[data-id="rooms"]');
results.roomsRow = await roomsRow.count();
await roomsRow.click();
results.sampleInjected = await page.locator('#cit-cfg-samplezone [data-cit-sample="rooms"]').count();
await roomsRow.click();
results.sampleRemoved = await page.locator('#cit-cfg-samplezone [data-cit-sample="rooms"]').count();

// 4) toggle a PRESENT module if any (gallery) → its section hides
const galleryRow = page.locator('.cit-cfg-row[data-id="gallery"]');
if ((await galleryRow.count()) && (await galleryRow.getAttribute("aria-pressed")) === "true") {
  const sec = page.locator('[data-cit-module="gallery"]').first();
  const before = await sec.evaluate((e) => getComputedStyle(e.closest("section") || e).display);
  await galleryRow.click();
  const after = await sec.evaluate((e) => getComputedStyle(e.closest("section") || e).display);
  results.galleryHideToggle = `${before} → ${after}`;
} else {
  results.galleryHideToggle = "n/a (not present)";
}

// 5) spine (enquiry) locked when present
const enquiryRow = page.locator('.cit-cfg-row[data-id="enquiry"]');
results.enquiryLocked =
  (await enquiryRow.count()) && (await enquiryRow.getAttribute("class"))?.includes("cit-cfg-locked");

// 6) submit (no server → fetch fails, still shows thanks)
await page.locator(".cit-cfg-submit").click();
await page.waitForTimeout(300);
results.thanks = (await page.locator(".cit-cfg-foot").innerText()).includes("Köszönjük");

results.pageErrors = errors;
console.log(JSON.stringify(results, null, 2));
await browser.close();
