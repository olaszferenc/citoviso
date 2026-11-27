// MAPS STARS FOR THE LEADS SCOUTED WITHOUT THEM (owner 2026-11-27, ADR „Maps-csillag szám nélkül”): since 2026-11-09 the
// chain dropped a Maps card's stars when the card showed no review count (EU lodging cards) — the scout DID read the value
// („rat”: „4,6”) and kept it in its maps_details.jsonl. This lays those values back, $0, no new walk:
//   · scout_place.rating where the row has none (rating_count stays empty — there is none),
//   · lead.raw.mapsRating = { value, count: null, source: "magellan", url } where the lead came from that place
//     (raw.sourceRefs.magellan = its ftid) and carries no mapsRating yet.
// Input: a TSV „ftid<TAB>value” (the chain's felderito/csillag_potlas.py writes it from every maps_details.jsonl).
//
//   npx tsx scripts/maps-rating-backfill.mts <tsv>          → dry run: what it would write, by country
//   npx tsx scripts/maps-rating-backfill.mts <tsv> --go     → writes (both tables), reports the same counts
import { readFileSync } from "node:fs";
import { sql } from "kysely";
import { db } from "../src/db/client.js";
import { scoutReviewsUrl } from "../src/reviews/placeRating.js";

const [file, flag] = process.argv.slice(2);
if (!file) {
  console.error("usage: maps-rating-backfill.mts <tsv> [--go]");
  process.exit(2);
}
const go = flag === "--go";
const values = new Map<string, number>();
for (const line of readFileSync(file, "utf8").split("\n")) {
  const [ftid, v] = line.split("\t");
  const n = Number((v ?? "").replace(",", "."));
  if (ftid && /^0x[0-9a-f]+:0x[0-9a-f]+$/i.test(ftid.trim()) && n >= 1 && n <= 5) values.set(ftid.trim(), n);
}
const ftids = [...values.keys()];
console.log(`bemenet: ${ftids.length} hely értékkel`);
let places = 0;
let leads = 0;
const byCc = new Map<string, number>();
for (let i = 0; i < ftids.length; i += 500) {
  const chunk = ftids.slice(i, i + 500);
  const rows = await db
    .selectFrom("scout_place")
    .select(["id", "ftid", "link", "name", "address", "city", "rating"])
    .where("ftid", "in", chunk)
    .execute();
  for (const r of rows) {
    const value = values.get(r.ftid!)!;
    if (r.rating == null) {
      places++;
      if (go) await db.updateTable("scout_place").set({ rating: value, rating_count: null, updated_at: new Date() }).where("id", "=", r.id).where("rating", "is", null).execute();
    }
    const url = scoutReviewsUrl({ ftid: r.ftid, link: r.link, name: r.name, address: r.address, city: r.city });
    const mapsRating = { value, count: null, source: "magellan", ...(url ? { url } : {}) };
    const hit = await db
      .selectFrom("lead as l")
      .select(["l.id", sql<string>`upper(coalesce(nullif(l.raw->>'country',''), '?'))`.as("cc")])
      .where(sql<boolean>`l.raw->'sourceRefs'->>'magellan' = ${r.ftid}`)
      .where(sql<boolean>`l.raw->'mapsRating' is null`)
      .execute();
    for (const h of hit) {
      leads++;
      byCc.set(h.cc, (byCc.get(h.cc) ?? 0) + 1);
      if (go)
        await db
          .updateTable("lead")
          .set({ raw: sql`jsonb_set(raw, '{mapsRating}', ${JSON.stringify(mapsRating)}::jsonb)` as never })
          .where("id", "=", h.id)
          .where(sql<boolean>`raw->'mapsRating' is null`)
          .execute();
    }
  }
}
console.log(`${go ? "ÍRVA" : "SZÁRAZ"}: scout_place.rating ${places} · lead.mapsRating ${leads} (${[...byCc].map(([k, v]) => `${k} ${v}`).join(" · ") || "—"})`);
await db.destroy();
