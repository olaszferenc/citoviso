// ONE-OFF BACKFILL: measure the portal photos already in the DB (2026-08-21).
//
// The ingest gate (portalListing.ts → keepUsablePhotos) measures every image it
// accepts, so anything scraped from now on carries real dimensions. Leads scraped
// BEFORE it existed do not: of the first 607 stored photos only 8 had a width, and
// the URL encodes one for just 213. Without dimensions the size rule cannot fire, and
// a 600×600 Booking thumbnail or a 108×19 rating graphic reaches the mock's hero.
//
// This measures the missing ones and writes width/height back into lead.raw. It does
// NOT delete anything: the rejected photos stay in the record (the same reason the
// contact ledger keeps its rejects — a filter you cannot audit is a filter you cannot
// trust). The judgement stays with judgePhoto, at read time.
//
// Idempotent: a photo that already has dimensions is skipped, so re-running is cheap.
//   npx tsx scripts/backfill-portal-photo-size.mts [--dry]

import { sql } from "kysely";
import { db, pool } from "../src/db/client.js";
import { judgePhoto, probeImageSize } from "../src/scraper/sources/portals/photoQuality.js";

const DRY = process.argv.includes("--dry");

interface StoredPhoto {
  url: string;
  width?: number;
  height?: number;
  [k: string]: unknown;
}
interface StoredProfile {
  photos?: StoredPhoto[];
  [k: string]: unknown;
}

const rows = await db
  .selectFrom("lead")
  .select(["id", "name", "raw"])
  .where(sql<boolean>`jsonb_array_length(coalesce(raw->'portalProfiles','[]'::jsonb)) > 0`)
  .execute();

console.log(`${rows.length} lead hordoz portál-adatlapot.${DRY ? " (SZÁRAZ FUTÁS)" : ""}\n`);

let measured = 0;
let already = 0;
let unmeasurable = 0;
let wouldDrop = 0;
let touchedLeads = 0;

for (const row of rows) {
  const raw = row.raw as unknown as { portalProfiles?: StoredProfile[] };
  const profiles = raw.portalProfiles ?? [];
  let changed = false;

  for (const profile of profiles) {
    for (const photo of profile.photos ?? []) {
      if (photo.width && photo.height) {
        already++;
        continue;
      }
      const size = await probeImageSize(photo.url);
      if (!size) {
        unmeasurable++;
        continue;
      }
      photo.width = size.width;
      photo.height = size.height;
      measured++;
      changed = true;
      if (!judgePhoto(photo).usable) wouldDrop++;
    }
  }

  if (changed) {
    touchedLeads++;
    if (!DRY) {
      await db
        .updateTable("lead")
        .set({ raw: JSON.stringify(raw) })
        .where("id", "=", row.id)
        .execute();
    }
    console.log(`  ✓ ${row.name}`);
  }
}

console.log(
  `\nMérve: ${measured} · már volt mérete: ${already} · mérhetetlen (megtartva): ${unmeasurable}`,
);
console.log(`A mérés után ${wouldDrop} kép esik ki a méret-szabályon (az adat megmarad).`);
console.log(DRY ? "SZÁRAZ FUTÁS — semmi nem íródott." : `${touchedLeads} lead frissítve.`);
await pool.end();
