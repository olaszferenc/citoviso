// gate-runner: land-blocking — kiküldési minőség (tulaj 2026-11-24: a három sablon renderelve, mielőtt bármi landol vagy élesre megy)
// THE THREE OUTREACH TEMPLATES, RENDERED AND JUDGED BEFORE ANY LAND OR DEPLOY (owner 2026-11-24).
//
// WHY: on 11-24 the photo fix was tested on 78 PARALLAX mocks only and went live while gate-opening
// and wordmark-grow still showed the hero again in their gallery. Nothing in land or deploy rendered
// a single mock, so a broken template could only be caught by the owner asking for a test letter.
// („Hogy mehetett ki élesre az, amelyik mindig tartalmazza a legalapvetőbb hibát?”)
//
// WHAT: 18 real mocks (6 per template: parallax · gate-opening · wordmark-grow, 5–24 own photos,
// contact details replaced) are rendered through the CURRENT engine and judged by the same rendered
// quality gate the send uses (src/outreach/mockRenderGate.ts auditMockFile). Any repeated picture,
// stock image, picture that is not the lodging, or text cut on a phone fails it.
// A photo the portal no longer serves ("broken") is the portal's change, not the code's — reported,
// not failed. Fixture: scripts/fixtures/mock-render/outreach-templates.json (refresh with a newer
// set when a template changes on purpose).
//
//   npx tsx scripts/mock-render-fixtures-check.mts

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderMockMeasured } from "../src/generator/mockLanguage.js";
import { curateMockPhotos } from "../src/generator/photoCurate.js";
import { gatePhotoOf } from "../src/engine/templates/gateOpening.js";
import { photoKindAvailable } from "../src/media/photoKind.js";
import { auditMockFile } from "../src/outreach/mockRenderGate.js";

interface Fixture {
  readonly id: string;
  readonly tpl: string;
  readonly name: string;
  readonly recipe: Recipe;
  readonly siteData: SiteData;
}

const fixtures = JSON.parse(
  await readFile(new URL("./fixtures/mock-render/outreach-templates.json", import.meta.url), "utf8"),
) as Fixture[];
const templates = new Set(fixtures.map((f) => f.tpl));
for (const t of ["parallax", "gate-opening", "wordmark-grow"]) {
  if (!templates.has(t)) {
    console.error(`⛔ mock-render-fixtures-check: a mintakészletből hiányzik a(z) ${t} sablon`);
    process.exit(1);
  }
}
if (!photoKindAvailable()) {
  console.error("⛔ mock-render-fixtures-check: a képfelismerő modell hiányzik (config.photoKindModelPath) — a kapu nem ítélhet nélküle");
  process.exit(1);
}

// MOCK_FIXTURES_KEEP=<dir> keeps the rendered pages there, for looking at them with one's own eyes.
const keep = process.env.MOCK_FIXTURES_KEEP;
const dir = keep ? path.resolve(keep) : await mkdtemp(path.join(os.tmpdir(), "cit-mock-fixtures-"));
if (keep) await mkdir(dir, { recursive: true });
let failed = 0;
try {
  for (const f of fixtures) {
    // The generator's own photo step (dedup · not-the-lodging off · best hero first) — the check
    // renders what a lead would get today, not the order stored when the fixture was taken.
    let siteData = f.siteData;
    let heroNote = "";
    if ((siteData.photos?.length ?? 0) > 0) {
      const c = await curateMockPhotos(siteData.photos as readonly { url: string }[]);
      siteData = { ...siteData, photos: c.photos as SiteData["photos"] };
      if (c.heroMoved) heroNote = "  (nyitókép cserélve)";
      if (f.tpl === "gate-opening") {
        // Recomputed like the generator does — never the stored one (it may be today's hero).
        const pick = gatePhotoOf(c.photos as never);
        const { gatePhoto: _stale, ...noGate } = siteData;
        siteData = (pick ? { ...noGate, gatePhoto: pick } : noGate) as SiteData;
      }
    }
    const { html } = await renderMockMeasured(f.recipe, siteData, { phase: "mock" });
    const file = path.join(dir, `${f.tpl}-${f.id}.html`);
    await writeFile(file, html);
    const r = await auditMockFile(file);
    const blocking = r.findings.filter((x) => x.code !== "broken");
    const broken = r.findings.length - blocking.length;
    if (blocking.length) failed++;
    console.log(`${blocking.length ? "✗" : "✓"}  ${f.tpl.padEnd(13)} ${f.name}${heroNote}${broken ? `  (${broken} portál-kép nem tölt be — nem kód-hiba)` : ""}`);
    for (const x of blocking) console.log(`      ${x.code}: ${x.detail}`);
  }
} finally {
  if (!keep) await rm(dir, { recursive: true, force: true });
}

if (failed) {
  console.error(`⛔ mock-render-fixtures-check: ${failed}/${fixtures.length} minta-mock elbukott a renderelt minőségkapun — ez a kód nem mehet ki`);
  process.exit(1);
}
console.log(`✅ mock-render-fixtures-check: mind a ${fixtures.length} minta-mock (3 sablon) tiszta — nincs ismétlődő, stock, nem szállás-kép, nincs levágott szöveg.`);
process.exit(0);
