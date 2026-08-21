// Guest-facing review form + Google badge on a 390px phone (ADR-0046).
//
// review-flow-check already proves the markup and the moderation gates. What a
// deterministic render cannot see is whether the thing FITS and is usable on the
// phone the owner and their guests actually hold: no sideways scroll, tap targets
// that a thumb can hit, and a badge that does not overflow its box.
//
// Measured, not eyeballed — "looks fine" has been wrong here before (the amenity
// cards overran fullbleed by 27px while looking perfectly reasonable).
//
//   npx tsx scripts/shot-review-form.mts

import { chromium } from "playwright-core";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "../src/config.js";
import { renderSite } from "../src/engine/render.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";

const data = {
  name: "Nyugalom Vendégház",
  tagline: "Csend a Zselic szélén",
  intro: "Négy apartman egy régi présház helyén, saját kerttel.",
  highlights: ["Kert", "Parkoló"],
  photos: [{ url: "https://placehold.co/1200x800", alt: "Kert", provenance: "owner" }],
  contact: { email: "info@example.com", phone: "+36 30 123 4567" },
  googleRating: {
    value: 4.7,
    count: 128,
    url: "https://search.google.com/local/reviews?placeid=TESZT",
  },
  reviewForm: {
    units: [
      { id: "11111111-1111-1111-1111-111111111111", name: "Kertre néző apartman" },
      { id: "22222222-2222-2222-2222-222222222222", name: "Padlásszoba" },
    ],
  },
  reviews: [
    {
      quote: "A tornácon reggeliztünk, és senki nem sürgetett. Pontosan ezért jöttünk.",
      author: "Kovács Anna",
      meta: "2026-07 · Kertre néző apartman",
    },
  ],
} as unknown as SiteData;

const recipe: Recipe = { template: "fullbleed", skin: "", archetype: "", sections: [] };
const html = renderSite(recipe, data, { phase: "live" });

const dir = await mkdtemp(path.join(tmpdir(), "revform-"));
const file = path.join(dir, "page.html");
await writeFile(file, html, "utf8");

const browser = await chromium.launch({ executablePath: config.chromiumPath });
let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

const page = await browser.newPage({ viewport: { width: 390, height: 900 }, isMobile: true });
await page.goto(pathToFileURL(file).href);
await page.waitForTimeout(300);

console.log("Vendég-oldali vélemény-felület (390px):");

check("a vélemény-űrlap kint van", await page.locator('form[action="/api/velemeny"]').isVisible());
check("a Google-jelvény kint van", await page.locator(".cit-grat").isVisible());
check("a jóváhagyott vélemény látszik", (await page.content()).includes("A tornácon reggeliztünk"));
check("több egységnél van egység-választó", await page.locator('select[name="unit"]').isVisible());

// No sideways scroll — the classic broken-on-a-phone symptom.
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
check("⭐ nincs vízszintes görgetés", overflow <= 0, `${overflow}px túllógás`);

// Every control must stay inside the viewport and be thumb-sized (Apple/Google both
// put the floor at 44px; below that a phone tap starts missing).
for (const sel of ['input[name="name"]', 'select[name="rating"]', 'textarea[name="body"]', '.cit-rev-f button']) {
  const box = await page.locator(sel).boundingBox();
  check(
    `${sel} beleér a képernyőbe és megfogható (≥44px)`,
    Boolean(box && box.x >= 0 && box.x + box.width <= 390.5 && box.height >= 44),
    box,
  );
}

const gratBox = await page.locator(".cit-grat").boundingBox();
check(
  "a Google-jelvény nem lóg ki",
  Boolean(gratBox && gratBox.x >= 0 && gratBox.x + gratBox.width <= 390.5),
  gratBox,
);

await page.screenshot({ path: "shot-review-form-mobile.png", fullPage: false });
await page.locator('form[action="/api/velemeny"]').scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
await page.screenshot({ path: "shot-review-form-mobile-form.png", fullPage: false });

await browser.close();

if (failures) {
  console.error(`\n⛔ shot-review-form: ${failures} bukott ellenőrzés.`);
  process.exit(1);
}
console.log("\n✅ shot-review-form: a vélemény-felület elfér és használható 390px-en.");
