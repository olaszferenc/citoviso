// PoC (ADR-0005): prove visual variety. Take real leads with photos, run each
// through the AI arculat-brief → seeded theme → parametric renderer, and
// screenshot them so they can be compared side by side. Output: /tmp/citoviso-poc/*.png

import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";
import { config } from "../src/config.js";
import { briefToThemeBrief, generateBrief } from "../src/generator/brief.js";
import { resolvePhotos, streetViewUrl } from "../src/generator/images.js";
import type { MockData, MockFeature } from "../src/generator/render.js";
import { renderVaried } from "../src/generator/renderVaried.js";
import { buildTheme } from "../src/generator/theme.js";
import { db } from "../src/db/client.js";
import { scoreMatch } from "../src/scraper/confidence.js";
import { placesLookup } from "../src/scraper/sources/googleMaps.js";
import type { QualifiedLead } from "../src/scraper/types.js";

const OUT = "/tmp/citoviso-poc";
const WANT = 4;

const REGION = {
  label: "Badacsony",
  tagline:
    "A Balaton partján, a Badacsonyi borvidék lábánál — panoráma, borpincék és nádfedeles nyugalom.",
  introBase:
    "a Badacsonyi borvidék szívében, néhány percre a Balaton partjától. Bortúrák, kilátás a tóra és csendes, otthonos pihenés várja a vendégeket.",
  features: [
    { icon: "wifi", label: "Ingyenes Wi-Fi" },
    { icon: "parking", label: "Parkolás a háznál" },
    { icon: "view", label: "Panoráma a Balatonra" },
    { icon: "coffee", label: "Reggeli / borkóstoló" },
    { icon: "location", label: "A borvidék szívében" },
    { icon: "key", label: "Önálló bejárat" },
  ] as MockFeature[],
};

function slug(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "mock";
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });

  // Candidate leads: prefer the target segment, must have coords.
  const rows = await db
    .selectFrom("lead")
    .select(["id", "name", "raw"])
    .where("lat", "is not", null)
    .where("qualification", "in", ["no_site", "outdated", "modern"])
    .orderBy("qualification", "asc")
    .execute();

  const built: { name: string; png: string }[] = [];
  // Region anti-collision: no two mocks share the same hero+gallery structure.
  const usedCombos = new Set<string>();
  for (const row of rows) {
    if (built.length >= WANT) break;
    const lead = row.raw as unknown as QualifiedLead;
    if (lead.lat == null || lead.lon == null) continue;

    const m = await placesLookup(lead.name, lead.lat, lead.lon, config.googleMapsApiKey);
    let photos: string[] = [];
    if (m) {
      const conf = scoreMatch({
        distanceMeters: m.distanceMeters,
        nameSimilarity: m.nameSimilarity,
        corroboratedByOsm: lead.sources.includes("osm"),
      });
      if (conf.band !== "low") photos = await resolvePhotos(m.photoRefs, 6);
    }
    if (photos.length < 3) continue; // need real material for a fair comparison

    console.log(`\n▸ ${lead.name} (${photos.length} fotó) — AI arculat-brief…`);
    const brief = await generateBrief({
      name: lead.name,
      region: REGION.label,
      regionContext: REGION.tagline,
      imageUrls: photos,
    });
    // AI drives palette + mood (context from photos); the SEED drives layout
    // (guaranteed variety); anti-collision keeps neighbours structurally distinct.
    const steer = brief
      ? { palette: briefToThemeBrief(brief).palette, mood: brief.mood }
      : undefined;
    let theme = buildTheme(row.id, steer);
    for (
      let salt = 1;
      salt <= 12 && usedCombos.has(`${theme.heroStyle}-${theme.galleryStyle}`);
      salt++
    ) {
      theme = buildTheme(`${row.id}#${salt}`, steer);
    }
    usedCombos.add(`${theme.heroStyle}-${theme.galleryStyle}`);
    console.log(
      `  téma: paletta=${theme.palette.name}${brief ? `→AI(${brief.mood})` : ""} · hero=${theme.heroStyle} · galéria=${theme.galleryStyle} · font=${theme.fonts.name}`,
    );

    const data: MockData = {
      name: lead.name,
      region: REGION.label,
      regionTagline: brief?.tagline ?? REGION.tagline,
      heroImage: photos[0] ?? streetViewUrl(lead.lat, lead.lon),
      photos,
      intro: brief?.intro ?? `A ${lead.name} ${REGION.introBase}`,
      features: REGION.features,
      phone: lead.phone,
      email: lead.email,
      address: lead.address,
      mapUrl: `https://www.google.com/maps/search/?api=1&query=${lead.lat},${lead.lon}`,
    };
    const html = renderVaried(data, theme);
    const base = `${OUT}/${built.length + 1}-${slug(lead.name)}`;
    await writeFile(`${base}.html`, html, "utf8");
    built.push({ name: lead.name, png: `${base}.png` });
  }

  // Screenshot each rendered mock (desktop).
  console.log(`\nScreenshotolás (${built.length} mock)…`);
  const browser = await chromium.launch({ executablePath: config.chromiumPath });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  for (const b of built) {
    const html = `${b.png.replace(/\.png$/, ".html")}`;
    await page.goto(`file://${html}`, { waitUntil: "load", timeout: 40000 }).catch(() => {});
    // Scroll through to trigger lazy-loaded gallery images, then settle.
    // Passed as a STRING so tsx/esbuild doesn't inject its __name helper (which
    // is undefined in the browser context).
    await page.evaluate(
      `new Promise((resolve)=>{let y=0;const step=()=>{window.scrollBy(0,600);y+=600;if(y<document.body.scrollHeight){setTimeout(step,120);}else{window.scrollTo(0,0);resolve();}};step();})`,
    );
    await page.waitForTimeout(2000);
    await page.screenshot({ path: b.png, fullPage: true });
    console.log(`  ✓ ${b.png}`);
  }
  await browser.close();
  await db.destroy();
  console.log(`\nKész. ${built.length} mock: ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
