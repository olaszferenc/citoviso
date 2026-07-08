// Dev helper: populate the DB from an existing leads-<region>.json (the scraper's
// replay artifact) via the normal persistence path — so the console has data to
// show without a live scrape. Usage: npm run db:seed -- [regionId]

import { readFile } from "node:fs/promises";
import { db } from "../src/db/client.js";
import {
  completeScrapeRun,
  ensureScraperDefinition,
  startScrapeRun,
} from "../src/scraper/persist.js";
import { getRegion } from "../src/scraper/regions.js";
import type { QualifiedLead } from "../src/scraper/types.js";

const regionId = process.argv[2] ?? "badacsony";
const region = getRegion(regionId);
const leads = JSON.parse(
  await readFile(`leads-${regionId}.json`, "utf8"),
) as QualifiedLead[];

const defId = await ensureScraperDefinition(region, "accommodation", [
  "osm",
  "google_places",
]);
const runId = await startScrapeRun(defId);
await completeScrapeRun(runId, leads, { players: leads.length, seed: true });

console.log(
  `Seeded ${leads.length} leads from leads-${regionId}.json (run ${runId}).`,
);
await db.destroy();
