// Offline validation of the enrichPresence module against the existing lead file.
// Confirms the production step matches the tightened probe (geo-strict → 0 hits).
import { readFile } from "node:fs/promises";
import { enrichPresence } from "../../src/scraper/enrichPresence.js";
import { getRegion } from "../../src/scraper/regions.js";
import type { QualifiedLead } from "../../src/scraper/types.js";

const leads: QualifiedLead[] = JSON.parse(
  await readFile("./leads-badacsony.json", "utf8"),
);
const region = getRegion("badacsony");

const before = leads.filter(
  (l) => l.websiteStatus === "none" || l.websiteStatus === "portal_only",
);
console.log(`Cél ("nincs saját oldal"): ${before.length}`);

const out = await enrichPresence(leads, region);
const reclassified = out.filter((l, i) => l.websiteStatus !== leads[i].websiteStatus);

console.log(`Reklasszifikált (talált rejtett saját honlap): ${reclassified.length}`);
for (const l of reclassified) console.log(`  ✅ ${l.name} → ${l.website}`);
console.log(
  reclassified.length === 0
    ? "✔ Geo-strict: egyetlen hamis pozitív sem (megegyezik a tightened probe-bal)."
    : "⚠ Nézd át a fenti találatokat, tényleg az adott lead honlapja-e.",
);
