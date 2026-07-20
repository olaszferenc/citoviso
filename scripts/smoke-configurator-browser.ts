// Headless browser smoke for the configurator (preset-first ergonomic pass):
// pill after wow → open → preset cards (Teljes default = all-in) → pick Alap
// (trims to minimum) → customize discloses grouped toggles → trim/submit.
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

const r: Record<string, unknown> = {};
const samples = () => page.locator("#cit-cfg-samplezone .cit-cfg-sample").count();

// 1) pill hidden on first paint, shown on scroll
r.pillHiddenAtFirst = !(await page.locator(".cit-cfg-launch.cit-cfg-in").count());
await page.mouse.wheel(0, 900);
await page.locator(".cit-cfg-launch.cit-cfg-in").waitFor({ state: "visible", timeout: 5000 });

// 2) open → ALL-IN default: "Teljes" preset active, all samples revealed
await page.locator(".cit-cfg-launch").click();
r.presetCount = await page.locator(".cit-cfg-preset").count();
r.teljesActiveByDefault = await page.locator('.cit-cfg-preset[data-preset="teljes"].cit-cfg-preset--on').count();
r.samplesOnOpen = await samples();

// 3) plain language: no operator jargon leaks into the panel
const bodyText = await page.locator(".cit-cfg-body").innerText();
r.noJargon = !/modul|CTA|gerinc|upsell/i.test(bodyText);

// 3b) pricing: footer monthly Ft total, presets priced, annual toggle → /év
const sumText = () => page.locator(".cit-cfg-sum").innerText();
r.footerMonthly = /Ft/.test(await sumText()) && /\/\s*hó/.test(await sumText());
r.presetsPriced = await page.locator(".cit-cfg-preset__price").count();
await page.locator('.cit-cfg-per[data-period="annual"]').click();
r.annualShown = /\/\s*év/.test(await sumText());
await page.locator('.cit-cfg-per[data-period="monthly"]').click();

// 4) pick "Alap" → trims to minimum (grandis: gallery/enquiry/location present → 0 samples)
await page.locator('.cit-cfg-preset[data-preset="alap"]').click();
r.alapActive = await page.locator('.cit-cfg-preset[data-preset="alap"].cit-cfg-preset--on').count();
r.samplesAfterAlap = await samples();
r.summaryAfterAlap = await page.locator(".cit-cfg-sum").innerText();

// 5) back to "Teljes" → samples return
await page.locator('.cit-cfg-preset[data-preset="teljes"]').click();
r.samplesAfterTeljes = await samples();

// 6) "Testre szabom" discloses grouped detail toggles
r.detailHiddenBefore = await page.locator(".cit-cfg-detail[hidden]").count();
await page.locator(".cit-cfg-customize").click();
r.detailShownAfter = await page.locator(".cit-cfg-detail:not([hidden])").count();
r.groupsShown = await page.locator(".cit-cfg-detail .cit-cfg-group").count();

// 7) toggle a detail row (rooms sample) off → removed; marks custom
await page.locator('.cit-cfg-row[data-id="rooms"]').click();
r.roomsTrimmedOff = await page.locator('#cit-cfg-samplezone [data-cit-sample="rooms"]').count();
r.customAfterManual = !(await page.locator(".cit-cfg-preset--on").count());

// 8) present module hide (gallery)
const galleryRow = page.locator('.cit-cfg-row[data-id="gallery"]');
if ((await galleryRow.getAttribute("aria-pressed")) === "true") {
  const sec = page.locator('[data-cit-module="gallery"]').first();
  const before = await sec.evaluate((e) => getComputedStyle(e.closest("section") || e).display);
  await galleryRow.click();
  const after = await sec.evaluate((e) => getComputedStyle(e.closest("section") || e).display);
  r.galleryHideToggle = `${before} → ${after}`;
}

// 9) enquiry (spine) locked when present
const enq = page.locator('.cit-cfg-row[data-id="enquiry"]');
r.enquiryLocked = (await enq.getAttribute("class"))?.includes("cit-cfg-locked");

// 10) submit → thanks
await page.locator(".cit-cfg-submit").click();
await page.waitForTimeout(300);
r.thanks = (await page.locator(".cit-cfg-foot").innerText()).includes("Köszönjük");

r.pageErrors = errors;
console.log(JSON.stringify(r, null, 2));
await browser.close();
