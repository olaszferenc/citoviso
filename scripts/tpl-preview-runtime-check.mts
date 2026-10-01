#!/usr/bin/env npx tsx
/**
 * H-1 guard — the console's look preview (/lead/:id/tpl-preview) is the mock's twin:
 * the module sections it shows are STYLED, measured in a real browser on every template.
 *
 *   npx tsx scripts/tpl-preview-runtime-check.mts [--self-test]
 *
 * THE MEASURED DEFECT (Elek live test 2026-10-01, shots/grid-editorial-d.png): on every
 * look of the grid the "Megközelítés" block carried a ~300 px black map pin, while the
 * finished mock showed the same pin at 34×34 px. The route sent bare renderSite()
 * output; the pin's size lives only in the module runtime CSS that injectRuntime()
 * inlines into every real mock. The curator picks the look from exactly this picture.
 *
 * ⛔ Measured as a RENDERED BOX, not as "does the HTML contain <style data-cit-runtime>":
 * a string probe would stay green if the rule moved to another file or the selector
 * changed, while the pin grew again.
 *
 * --self-test: renders the bare renderSite() output (what the route used to send) and
 * requires the size assertion to go RED on every template.
 */
import { chromium } from "playwright-core";

import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderTemplatePreview } from "../src/console/tplPreview.js";

const SELF_TEST = process.argv.includes("--self-test");
/** The runtime rule says 34 px; anything above this is the unstyled pin. */
const MAX_PIN_PX = 48;

const LEAD: SiteData = {
  name: "Muschel Panzió",
  tagline: "Csend a domb alatt",
  intro: "Csendes utca végén álló panzió, saját udvarral és árnyas kerttel.",
  highlights: ["Saját parkoló", "Kutyabarát"],
  photos: [
    { url: "data:image/gif;base64,R0lGODlhAQABAAAAACw=", alt: "kert", provenance: "portal" },
    { url: "data:image/gif;base64,R0lGODlhAQABAAAAACw=", alt: "szoba", provenance: "portal" },
  ],
  contact: { phone: "+36 30 123 4567", address: "8360 Keszthely, Fő tér 1." },
  geo: { lat: 46.7655, lon: 17.2418 },
} as unknown as SiteData;
const BASE_RECIPE: Recipe = { template: "editorial", skin: "", archetype: "", sections: [] };

let failures = 0;
const check = (label: string, pass: boolean, detail = ""): void => {
  if (!pass) failures++;
  console.log(`  ${pass ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  // No network: the map iframe and web fonts are irrelevant to the pin's box.
  await page.route(/^https?:/, (r) => r.abort());
  const oversized: string[] = [];
  const noPin: string[] = [];
  for (const t of Object.keys(TEMPLATES)) {
    const html = SELF_TEST
      ? renderSite({ ...BASE_RECIPE, template: t, skin: TEMPLATES[t]!.skins[0] ?? "" }, LEAD, {
          phase: "mock",
        })
      : await renderTemplatePreview({ recipe: BASE_RECIPE, siteData: LEAD }, t, new Set());
    if (html === null) {
      noPin.push(`${t}(ismeretlen)`);
      continue;
    }
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    const box = await page.evaluate(() => {
      const svg = document.querySelector(".cit-map-pin svg");
      if (!svg) return null;
      const r = svg.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    if (!box) noPin.push(t);
    else if (box.w > MAX_PIN_PX || box.h > MAX_PIN_PX) oversized.push(`${t} ${box.w}×${box.h}`);
  }
  const n = Object.keys(TEMPLATES).length;
  console.log(`\nKinézet-előnézet, térkép-tű (${n} sablon, 1280 px):`);
  check("a térkép-blokk mindegyik előnézetben ott van (a mérés alanya létezik)", noPin.length === 0, noPin.join(", "));
  check(
    `⛔ a tű legfeljebb ${MAX_PIN_PX} px — a kész mock stílusával`,
    oversized.length === 0,
    `${oversized.length}/${n}: ${oversized.slice(0, 5).join(" · ")}`,
  );
} finally {
  await browser.close();
}

if (SELF_TEST) {
  const ok = failures === 1;
  console.log(
    ok
      ? `\n✅ ÖNTESZT: a runtime nélküli (régi) előnézeten a méret-állítás bukott — az őr lát\n`
      : `\n❌ ÖNTESZT: ${failures} bukás a várt 1 helyett — az őr NEM a hiányzó stílust méri\n`,
  );
  process.exit(ok ? 0 : 1);
}
console.log(failures ? `\n❌ ${failures} állítás bukott\n` : `\n✅ minden állítás teljesült\n`);
process.exit(failures ? 1 : 0);
