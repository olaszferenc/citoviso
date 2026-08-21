// Regression guard for PERSISTING A LEAD THAT CARRIES PORTAL DATA (2026-08-21).
//
// WHY THIS EXISTS: the portal layer wrote the listing URL as a bare string into
// lead_provenance.matched_entity, which is a JSONB column. Postgres rejected it
// (22P02, 'Token "https" is invalid'), and because a run persists in ONE
// transaction, the failure rolled back an entire 554-lead scrape — hours of
// crawling and a paid Places pass, gone. Typecheck was green: the local row type
// declared the column `string | null`, so the compiler never saw the mismatch.
//
// A type cannot catch this class of bug; only a real round-trip against the real
// schema can. So this persists a lead WITH portal photos, reads it back, and
// asserts the data survived — then removes everything it created.
//
// Needs the local DB (npm run db:up). Run: npx tsx scripts/persist-portal-check.mts

import { sql } from "kysely";
import { db } from "../src/db/client.js";
import { completeScrapeRun, ensureScraperDefinition, startScrapeRun } from "../src/scraper/persist.js";
import type { QualifiedLead, Region } from "../src/scraper/types.js";

const REGION: Region = {
  id: "__portal_check__",
  label: "Persist-kapu teszt-régió",
  country: "HU",
  bbox: [0.001, 0.001, 0.002, 0.002], // open ocean — cannot collide with a real lead
};

/** Unique name so the cross-run store-dedup never swallows this fixture. */
const NAME = `__portal_persist_check__ ${process.pid}`;

const lead = {
  name: NAME,
  lat: 0.0015,
  lon: 0.0015,
  sources: ["osm"],
  industry: "accommodation",
  websiteStatus: "none",
  isLead: true,
  portalProfiles: [
    {
      portal: "booked_hu",
      portalHost: "booked.hu",
      url: "https://booked.hu/szallas/persist-kapu-teszt",
      rooms: [],
      amenities: [],
      prices: [],
      photos: [
        {
          url: "https://cdn.booked.hu/persist-kapu/1.jpg",
          provenance: "portal",
          sourceUrl: "https://booked.hu/szallas/persist-kapu-teszt",
          portalHost: "booked.hu",
          caption: "Kertre néző terasz",
        },
      ],
      matchConfidence: 0.9,
      matchBand: "high",
      matchReasons: [],
      needsReview: false,
      extractor: "json_ld",
      fetchedAt: "2026-08-21T10:00:00.000Z",
    },
  ],
} as unknown as QualifiedLead;

let failed = 0;
function check(label: string, ok: boolean, detail: string): void {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗ FAIL"}  ${label}\n     ${detail}\n`);
}

let runId: string | undefined;
try {
  const defId = await ensureScraperDefinition(REGION, "accommodation", ["osm"]);
  runId = await startScrapeRun(defId);

  // The write itself is the assertion: before the fix this threw 22P02 and rolled
  // back every lead in the run, not just this one.
  let threw: string | null = null;
  try {
    await completeScrapeRun(runId, [lead], {});
  } catch (err) {
    threw = (err as Error).message;
  }
  check(
    "portál-adatot hordozó lead MENTHETŐ",
    threw === null,
    threw ? `a tranzakció elszállt: ${threw}` : "a tranzakció lefutott — a futás nem görgül vissza",
  );

  const row = await db
    .selectFrom("lead")
    .select(["id", "raw"])
    .where("name", "=", NAME)
    .executeTakeFirst();
  check("a lead tényleg a DB-ben van", !!row, row ? `id ${row.id}` : "nincs sor — a mentés némán elveszett");

  const saved = (row?.raw ?? {}) as QualifiedLead;
  const photos = (saved.portalProfiles ?? []).flatMap((p) => p.photos);
  check(
    "a portál-fotó túléli az oda-vissza utat",
    photos.length === 1 && photos[0]?.url === "https://cdn.booked.hu/persist-kapu/1.jpg",
    `várt: 1 kép · kapott: ${photos.length} — enélkül a generátornak nincs miből dolgoznia`,
  );
  check(
    "a jogállás és a képaláírás is megmarad",
    photos[0]?.provenance === "portal" && photos[0]?.caption === "Kertre néző terasz",
    `kapott: ${photos[0]?.provenance} / ${JSON.stringify(photos[0]?.caption)}`,
  );

  const prov = row
    ? await db
        .selectFrom("lead_provenance")
        .select(["source", "matched_entity"])
        .where("lead_id", "=", row.id)
        .where("field", "=", "portal_profile")
        .executeTakeFirst()
    : undefined;
  const entity = (prov?.matched_entity ?? null) as { url?: string } | null;
  check(
    "a bizalmi-főkönyv sora megvan, nyitható forrás-URL-lel",
    entity?.url === "https://booked.hu/szallas/persist-kapu-teszt",
    `kapott: ${JSON.stringify(prov?.matched_entity)} — a matched_entity JSONB, sosem nyers string`,
  );
} finally {
  // Remove everything this fixture created — it must never pollute the lead pool.
  await sql`delete from lead_provenance where lead_id in (select id from lead where name = ${NAME})`.execute(db);
  await sql`delete from lead where name = ${NAME}`.execute(db);
  if (runId) await sql`delete from scrape_run where id = ${runId}`.execute(db);
  await sql`delete from scraper_definition where region = ${REGION.id}`.execute(db);
  await db.destroy();
}

if (failed) {
  console.error(`⛔ ${failed} eset megbukott — a portál-adat mentése visszaesett.`);
  process.exit(1);
}
console.log("✅ Portál-adat mentése rendben (tranzakció, raw round-trip, JSONB főkönyv).");
