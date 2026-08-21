// ADR-0047 gate: what the LEAD sees when the cold-outreach link opens.
//
// THE TWO FAILURES THIS CATCHES, both of which shipped to production:
//   1. `querySelector("footer")` returned a REVIEW's byline (12 of 16 templates mark
//      the quote author with <footer> inside <blockquote>), so the whole module offer
//      was injected inside a quote card — measured at 295–530px. The owner's words:
//      "egy csíkba, bal oldalt, van az összes modul".
//   2. Samples were only injected on the first panel OPEN, so the advertised
//      "we show everything up front" did not happen: the lead saw two modules of
//      twelve unless they started toggling.
//
// Both are invisible to any check that only asks "is the module in the manifest?".
// This drives the real configurator in a browser and measures placement and width.
//
//   npx tsx scripts/configurator-placement-check.mts

import { chromium } from "playwright-core";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "../src/config.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { injectConfigurator } from "../src/generator/configurator.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

// A cold lead: name, a photo, a phone number. No module data — exactly the case
// where the configurator has to show samples for almost everything.
const LEAD: SiteData = {
  name: "Bánó Gábor",
  tagline: "Köveskál",
  intro: "Teszt bevezető szöveg a leadről.",
  highlights: ["Kert", "Parkoló"],
  photos: [{ url: "https://placehold.co/1200x800", alt: "Kert", provenance: "places" }],
  contact: { email: "a@b.hu", phone: "+36301112233" },
  rating: { value: 4.9, count: 143 },
};

const browser = await chromium.launch({ executablePath: config.chromiumPath });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

const narrow: string[] = [];
const hidden: string[] = [];
const counts: string[] = [];

console.log(`Amit a lead lát a megkeresés linkjén (${Object.keys(TEMPLATES).length} sablon):\n`);

for (const t of Object.keys(TEMPLATES)) {
  const recipe: Recipe = { template: t, skin: "", archetype: "", sections: [] };
  const bare = renderSite(recipe, LEAD, { phase: "mock" });
  const html = await injectConfigurator(bare, "00000000-0000-0000-0000-000000000000", "Teszt Lead");

  const dir = await mkdtemp(path.join(tmpdir(), "cfg-"));
  const f = path.join(dir, "p.html");
  await writeFile(f, html, "utf8");
  await page.goto(pathToFileURL(f).href);
  // First paint only — deliberately NOT opening the panel or touching anything.
  await page.waitForTimeout(350);

  const res = await page.evaluate(() => {
    const s = Array.from(document.querySelectorAll("[data-cit-sample]"));
    const widths = s.map((n) => Math.round(n.getBoundingClientRect().width));
    const visible = s.filter((n) => (n as HTMLElement).offsetParent !== null).length;
    return { count: s.length, visible, min: widths.length ? Math.min(...widths) : 0 };
  });

  counts.push(`${t}:${res.count}`);
  // A cold lead has data for at most gallery/reviews, so the rest must be sampled.
  if (res.visible < 6) hidden.push(`${t}(${res.visible} látszik)`);
  if (res.count && res.min < 700) narrow.push(`${t}(${res.min}px)`);
}
await browser.close();

check(
  "⭐⭐ a modul-minták AZONNAL látszanak, panel-nyitás nélkül (ALL-IN)",
  hidden.length === 0,
  hidden.slice(0, 6),
);
check(
  "⭐⭐ egyetlen minta sem szorul be keskeny oszlopba (≥700px)",
  narrow.length === 0,
  narrow.slice(0, 6),
);
console.log(`\n  (minta-blokkok sablononként: ${counts.join(", ")})`);

if (failures) {
  console.error(`\n⛔ configurator-placement-check: ${failures} bukott ellenőrzés.`);
  process.exit(1);
}
console.log("\n✅ configurator-placement-check: a lead az első képernyőn a teljes csomagot látja, a helyén.");
