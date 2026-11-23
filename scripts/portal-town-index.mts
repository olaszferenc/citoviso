// TOWN INDEX STEP — the portal listings of leads with no picture, from their country's town pages ($0).
// (HR dev-próba 2026-11-23; src/scraper/sources/portals/townIndex.ts says why and how.)
//
//   npx tsx scripts/portal-town-index.mts --run <scrape_run_id> [--dry-run] [--all]
//   npx tsx scripts/portal-town-index.mts <leadId> … [--dry-run]
//
// Takes the run's no_site / outdated leads that have FEWER than 5 own photos (the dispatch floor,
// autoDispatch.DISPATCH_MIN_OWN_PHOTOS) — --all takes every one — asks the town index for candidate
// listings, and hands them to attachPhotoLinks: the entity-match gate, the photo filters and the
// provenance stay the reader's. --dry-run only lists the candidates (reads the town pages, writes nothing).
// A lead whose country lexicon has no `portalTownIndexes` (HU) is skipped.
import { db } from "../src/db/client.js";
import { refreshCountries } from "../src/country.js";
import { attachPhotoLinks } from "../src/scraper/attachPhotoLinks.js";
import { townIndexCandidates } from "../src/scraper/sources/portals/townIndex.js";
import { DISPATCH_MIN_OWN_PHOTOS } from "../src/outreach/autoDispatch.js";

const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const all = args.includes("--all");
const runIdx = args.indexOf("--run");
const runId = runIdx >= 0 ? args[runIdx + 1] : undefined;
const ids = args.filter((a, i) => !a.startsWith("--") && (runIdx < 0 || i !== runIdx + 1));

await refreshCountries();
type Raw = { name?: string; lat?: number; lon?: number; city?: string; country?: string; material?: Record<string, unknown> };
let q = db.selectFrom("lead").select(["id", "name", "raw", "qualification"]);
if (runId) q = q.where("scrape_run_id", "=", runId).where("qualification", "in", ["no_site", "outdated"]);
else if (ids.length) q = q.where("id", "in", ids);
else {
  console.error("használat: --run <scrape_run_id> | <leadId> …"); // i18n-exempt: operátori CLI
  process.exit(2);
}
const rows = await q.execute();

const own = (m: Record<string, unknown> | undefined): number =>
  ["placesPhotos", "portalPhotos", "websiteImages"].reduce((s, k) => s + (typeof m?.[k] === "number" ? (m[k] as number) : 0), 0);

const tally = { leads: rows.length, skippedEnough: 0, noCandidate: 0, candidates: 0, attached: 0, photos: 0, rejected: 0 };
for (const r of rows) {
  const raw = (typeof r.raw === "string" ? JSON.parse(r.raw) : r.raw) as Raw;
  if (!all && own(raw.material) >= DISPATCH_MIN_OWN_PHOTOS) {
    tally.skippedEnough++;
    continue;
  }
  const cands = await townIndexCandidates({ name: r.name, lat: raw.lat, lon: raw.lon, city: raw.city, country: raw.country });
  if (!cands.length) {
    tally.noCandidate++;
    console.log(`·  ${r.id.slice(0, 8)} ${r.name} — nincs jelölt`);
    continue;
  }
  tally.candidates++;
  const list = cands.map((c) => `${c.name} (${c.km.toFixed(2)} km, ${c.shared.join("+")})`).join(" | ");
  if (dry) {
    console.log(`?  ${r.id.slice(0, 8)} ${r.name} → ${list}`);
    continue;
  }
  const res = await attachPhotoLinks(r.id, cands.map((c) => c.url).join("\n"));
  const got = res.after - res.before;
  if (got > 0) {
    tally.attached++;
    tally.photos += got;
  } else tally.rejected++;
  const why = res.links.map((l) => `${l.photos} fotó${l.skipped ? ` (${l.skipped})` : ""}`).join(" · ");
  console.log(`${got > 0 ? "✓" : "✗"}  ${r.id.slice(0, 8)} ${r.name} → ${list} → ${res.before}→${res.after} · ${why}`);
}
console.log(`TOWN_INDEX_JSON ${JSON.stringify(tally)}`);
await db.destroy();
