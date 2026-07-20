import { chromium } from "playwright-core";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { config } from "../src/config.js";

const file = process.argv[2]!;
const url = pathToFileURL(path.resolve(file)).href;
const browser = await chromium.launch({ executablePath: config.chromiumPath });

// desktop: pill over wow + preset panel
const page = await browser.newPage({ viewport: { width: 1180, height: 860 } });
await page.goto(url);
await page.mouse.wheel(0, 700);
await page.locator(".cit-cfg-launch.cit-cfg-in").waitFor({ state: "visible", timeout: 5000 });
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);
await page.screenshot({ path: "shot-cfg-pill.png" });
await page.locator(".cit-cfg-launch").click();
await page.waitForTimeout(400);
await page.screenshot({ path: "shot-cfg-presets.png" });
await page.locator(".cit-cfg-customize").click();
await page.waitForTimeout(300);
await page.screenshot({ path: "shot-cfg-customize.png" });
await page.close();

// mobile: bottom-sheet (page visible above)
const m = await browser.newPage({ viewport: { width: 390, height: 780 }, isMobile: true });
await m.goto(url);
await m.mouse.wheel(0, 500);
await m.locator(".cit-cfg-launch.cit-cfg-in").waitFor({ state: "visible", timeout: 5000 });
await m.locator(".cit-cfg-launch").click();
await m.waitForTimeout(400);
await m.screenshot({ path: "shot-cfg-mobile.png" });
await m.close();

await browser.close();
console.log("wrote shot-cfg-{pill,presets,customize,mobile}.png");
