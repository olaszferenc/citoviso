// One-time geo backfill (ADR-0040): fill raw.country / raw.city on EXISTING leads.
// Same layered logic as the scrape-time enrichGeo: reverse-geocode from the lead's
// coordinates (Nominatim, 1 req/s), region country as the coordinate-less fallback.
// Non-destructive: only the two missing keys are added to the raw payload; every
// other field (and the lead row itself) is untouched. Idempotent — a filled lead
// is skipped, so the script can be re-run after an interruption.
//
// Usage: npx tsx scripts/backfill-geo.mts [--dry-run]

import { sql } from "kysely";
import { db, pool } from "../src/db/client.js";
import { reverseGeocode } from "../src/scraper/enrichGeo.js";

const DRY = process.argv.includes("--dry-run");
const THROTTLE_MS = 1100; // Nominatim policy: max 1 req/s
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const rows = await db
    .selectFrom("lead")
    .innerJoin("scrape_run", "scrape_run.id", "lead.scrape_run_id")
    .innerJoin(
      "scraper_definition",
      "scraper_definition.id",
      "scrape_run.scraper_definition_id",
    )
    .select([
      "lead.id as id",
      "lead.name as name",
      "lead.lat as lat",
      "lead.lng as lng",
      "lead.raw as raw",
      "scraper_definition.country as regionCountry",
    ])
    .execute();

  const targets = rows.filter((r) => {
    const raw = (r.raw ?? {}) as { country?: string; city?: string };
    return !raw.country || !raw.city;
  });
  console.log(
    `${rows.length} lead összesen · ${targets.length} hiányos (country/city) · ` +
      `~${Math.ceil((targets.length * THROTTLE_MS) / 60000)} perc${DRY ? " · DRY-RUN" : ""}`,
  );

  let filled = 0;
  let geocoded = 0;
  let fallback = 0;
  for (const [i, r] of targets.entries()) {
    const raw = { ...((r.raw ?? {}) as Record<string, unknown>) } as {
      country?: string;
      city?: string;
    } & Record<string, unknown>;

    let geo: { country?: string; city?: string } = {};
    if (r.lat != null && r.lng != null) {
      try {
        geo = await reverseGeocode(Number(r.lat), Number(r.lng));
        geocoded++;
      } catch {
        // network hiccup — region fallback still applies below
      }
      await sleep(THROTTLE_MS);
    }
    const country = raw.country ?? geo.country ?? r.regionCountry ?? undefined;
    const city = raw.city ?? geo.city;
    if (!raw.country && country && !geo.country) fallback++;
    if (country === raw.country && city === raw.city) continue; // nothing to add

    if (country) raw.country = country;
    if (city) raw.city = city;
    if (!DRY) {
      await db
        .updateTable("lead")
        .set({ raw: sql`${JSON.stringify(raw)}::jsonb` })
        .where("id", "=", r.id)
        .execute();
    }
    filled++;
    if ((i + 1) % 25 === 0 || i === targets.length - 1) {
      console.log(`  ${i + 1}/${targets.length} feldolgozva · ${filled} kitöltve`);
    }
  }
  console.log(
    `KÉSZ: ${filled} lead frissítve (${geocoded} geokódolt, ${fallback} régió-fallback)${DRY ? " — DRY-RUN, nem írt" : ""}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
