import { chromium } from "playwright-core";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { config } from "../src/config.js";

const file = process.argv[2]!;
const browser = await chromium.launch({ executablePath: config.chromiumPath });
const page = await browser.newPage({ viewport: { width: 1180, height: 860 } });
await page.goto(pathToFileURL(path.resolve(file)).href);
await page.locator(".cit-cfg-launch").click();
// turn on a couple of upsell samples so the sell is visible
for (const id of ["reviews", "pricing"]) {
  const r = page.locator(`.cit-cfg-row[data-id="${id}"]`);
  if ((await r.count()) && (await r.getAttribute("aria-pressed")) === "false") await r.click();
}
await page.waitForTimeout(400);
await page.screenshot({ path: "shot-configurator-panel.png" });
// scroll to the sample zone and capture it
const zone = page.locator("#cit-cfg-samplezone");
await zone.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await page.screenshot({ path: "shot-configurator-samples.png" });
await browser.close();
console.log("wrote shot-configurator-panel.png + shot-configurator-samples.png");
