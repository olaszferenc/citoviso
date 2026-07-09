// PoC (ADR-0007): grounded AI-generated mocks on real leads. Each lead → real
// photos + real contact → Claude generates a unique, fact-bound HTML mock. The
// archetype used feeds an "avoid" set so later leads get different structures.
// Output: /tmp/citoviso-aimock/*.png

import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";
import { config } from "../src/config.js";
import { generateAiMock } from "../src/generator/aiMock.js";
import { resolvePhotos, streetViewUrl } from "../src/generator/images.js";
import { db } from "../src/db/client.js";
import { scoreMatch } from "../src/scraper/confidence.js";
import { placesLookup } from "../src/scraper/sources/googleMaps.js";
import type { QualifiedLead } from "../src/scraper/types.js";

const OUT = "/tmp/citoviso-aimock";
const WANT = 4;

function slug(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "mock";
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });

  const rows = await db
    .selectFrom("lead")
    .select(["id", "name", "raw"])
    .where("lat", "is not", null)
    .orderBy("qualification", "asc")
    .execute();

  const avoid: string[] = [];
  const built: { name: string; png: string }[] = [];
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
    if (photos.length < 3) continue;

    console.log(`\n▸ ${lead.name} (${photos.length} fotó) — grounded AI-generálás…`);
    const res = await generateAiMock({
      name: lead.name,
      region: "Badacsony",
      photos,
      contact: {
        phone: lead.phone,
        email: lead.email,
        address: lead.address,
        mapUrl: `https://www.google.com/maps/search/?api=1&query=${lead.lat},${lead.lon}`,
      },
      avoidArchetypes: [...avoid],
    });
    if (!res) {
      console.log("  (nincs eredmény — kulcs?)");
      continue;
    }
    avoid.push(res.archetype);
    console.log(
      `  archetípus=${res.archetype} · típus=${res.environment ?? "?"}-${res.tier ?? "?"} · stílus=${res.style ?? ""} · ${res.html.length} byte`,
    );

    const base = `${OUT}/${built.length + 1}-${slug(lead.name)}`;
    await writeFile(`${base}.html`, res.html, "utf8");
    // Fallback hero note if the model somehow used no image (safety only).
    if (!res.html.includes("http")) {
      console.log("  ⚠️ nincs kép-URL a kimenetben — ellenőrizd");
    }
    void streetViewUrl;
    built.push({ name: lead.name, png: `${base}.png` });
  }

  console.log(`\nScreenshotolás (${built.length})…`);
  const browser = await chromium.launch({ executablePath: config.chromiumPath });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  for (const b of built) {
    const html = `${b.png.replace(/\.png$/, ".html")}`;
    await page.goto(`file://${html}`, { waitUntil: "load", timeout: 40000 }).catch(() => {});
    await page.evaluate(
      `new Promise((r)=>{let y=0;const s=()=>{scrollBy(0,600);y+=600;if(y<document.body.scrollHeight)setTimeout(s,110);else{scrollTo(0,0);r();}};s();})`,
    );
    await page.waitForTimeout(2000);
    await page.screenshot({ path: b.png, fullPage: true });
    console.log(`  ✓ ${b.png}`);
  }
  await browser.close();
  await db.destroy();
  console.log(`\nKész: ${OUT} · archetípusok: ${avoid.join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
