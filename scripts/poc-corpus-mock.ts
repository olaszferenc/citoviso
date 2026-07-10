// PoC (ADR-0008 pillér 2): prove the corpus DIVERSIFIES real leads. For each
// lead: classify (env×tier) → select a corpus design (rotation + region
// anti-collision) → grounded adaptation on the REAL photos/facts. Neighbours in
// the same region get DIFFERENT archetypes → visible diversity.
// Output: /tmp/citoviso-corpus-mock/*.png
// Usage: tsx scripts/poc-corpus-mock.ts [regionId=badacsony] [count=4]

import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";
import { config } from "../src/config.js";
import {
  classifyLead,
  generateFromCorpus,
  loadCorpus,
  selectCorpusDesign,
} from "../src/generator/mockFromCorpus.js";
import { resolvePhotos } from "../src/generator/images.js";
import { injectRuntime } from "../src/generator/runtime.js";
import { getRegion } from "../src/scraper/regions.js";
import { db } from "../src/db/client.js";
import { scoreMatch } from "../src/scraper/confidence.js";
import { placesLookup } from "../src/scraper/sources/googleMaps.js";
import type { QualifiedLead } from "../src/scraper/types.js";

const OUT = "/tmp/citoviso-corpus-mock";

function slug(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "mock";
}

async function main(): Promise<void> {
  const regionId = process.argv[2] && !/^\d+$/.test(process.argv[2]) ? process.argv[2] : "badacsony";
  const countArg = /^\d+$/.test(process.argv[2] ?? "") ? process.argv[2] : process.argv[3];
  const WANT = Math.max(1, Number(countArg ?? "4") || 4);
  const region = getRegion(regionId);
  const REGION = region.label;
  const [south, west, north, east] = region.bbox;
  console.log(`Régió: ${REGION} · bbox=${region.bbox.join(",")} · cél: ${WANT} mock`);
  await mkdir(OUT, { recursive: true });

  const corpus = await loadCorpus();
  if (!corpus.length) {
    console.error("❌ Üres korpusz (assets/design-refs/corpus/manifest.json). Előbb: npm run corpus:build");
    process.exit(1);
  }
  console.log(`Korpusz: ${corpus.length} dizájn. Tierek:`,
    [...new Set(corpus.map((e) => e.tier))].join(", "),
    "·", new Set(corpus.map((e) => e.archetype)).size, "egyedi archetípus");

  const rows = await db
    .selectFrom("lead")
    .select(["id", "name", "raw"])
    .where("lat", "is not", null)
    .orderBy("qualification", "asc")
    .execute();

  // Region anti-collision + rotation ledgers (in-memory for the PoC).
  const avoidArchetypes: string[] = [];
  const usage = new Map<string, number>();
  const built: { name: string; png: string; archetype: string; type: string; corpusId: string }[] = [];

  for (const row of rows) {
    if (built.length >= WANT) break;
    const lead = row.raw as unknown as QualifiedLead;
    if (lead.lat == null || lead.lon == null) continue;
    // Region filter: only leads inside this region's bbox (the DB holds all regions).
    if (lead.lat < south || lead.lat > north || lead.lon < west || lead.lon > east) continue;

    let photos: string[] = [];
    try {
      const m = await placesLookup(lead.name, lead.lat, lead.lon, config.googleMapsApiKey);
      if (m) {
        const conf = scoreMatch({
          distanceMeters: m.distanceMeters,
          nameSimilarity: m.nameSimilarity,
          corroboratedByOsm: lead.sources.includes("osm"),
        });
        if (conf.band !== "low") photos = await resolvePhotos(m.photoRefs, 6);
      }
    } catch (err) {
      console.log(`  ⚠️ Places/fotó hiba (${(err as Error).message?.slice(0, 60)}) — skip`);
      continue;
    }
    if (photos.length < 3) continue;

    const contact = {
      phone: lead.phone,
      email: lead.email,
      address: lead.address,
      mapUrl: `https://www.google.com/maps/search/?api=1&query=${lead.lat},${lead.lon}`,
    };
    const forMock = { name: lead.name, region: REGION, photos, contact };

    console.log(`\n▸ ${lead.name} (${photos.length} fotó)`);
    let cls, sel, res;
    try {
      cls = await classifyLead(forMock);
      if (!cls) { console.log("  osztályozás sikertelen — skip"); continue; }
      console.log(`  osztály: tier=${cls.tier} · env-hint=${cls.environment}`);

      sel = await selectCorpusDesign(corpus, cls, { avoidArchetypes, usage });
      if (!sel) { console.log(`  nincs korpusz-dizájn a(z) ${cls.tier} tierhez — skip`); continue; }
      console.log(`  kiválasztott blueprint: ${sel.entry.id} · ${sel.entry.archetype} · "${sel.entry.style}"`);

      res = await generateFromCorpus(forMock, cls, sel);
      if (!res) { console.log("  generálás sikertelen — skip"); continue; }
    } catch (err) {
      console.log(`  ⚠️ AI hiba (${(err as Error).message?.slice(0, 60)}) — skip`);
      continue;
    }

    avoidArchetypes.push(sel.entry.archetype);
    usage.set(sel.entry.id, (usage.get(sel.entry.id) ?? 0) + 1);

    const base = `${OUT}/${built.length + 1}-${slug(lead.name)}`;
    await writeFile(`${base}.html`, await injectRuntime(res.html), "utf8");
    console.log(`  ✓ grounded (${res.archetype}, corpus=${res.corpusId}) · ${res.html.length} byte`);
    built.push({
      name: lead.name,
      png: `${base}.png`,
      archetype: res.archetype,
      type: `${cls.environment}-${cls.tier}`,
      corpusId: res.corpusId,
    });
  }

  console.log(`\nScreenshotolás (${built.length})…`);
  const browser = await chromium.launch({ executablePath: config.chromiumPath });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  for (const b of built) {
    const html = b.png.replace(/\.png$/, ".html");
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

  console.log(`\nKész: ${OUT}`);
  console.log("Diverzitás-összegzés (szomszédok különböző archetípust kaptak):");
  for (const b of built) console.log(`  • ${b.name} → ${b.type} · ${b.archetype} (corpus=${b.corpusId})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
