// The end of a scout tile's processing (run.ts --scout, ADR-0336): every `proc` row of the
// tile is matched to the lead the run saved for it (isSamePlayer: normalized name + ≤250 m),
// and learns its outcome — `lead` (no own site / outdated own site) or `nolead` — with the
// lead's id. A row the run did not save (nothing matched) goes back to `new` and the tile
// opens again: the operator sees it and closes once more, nothing is silently dropped.

import { db } from "../db/client.js";
import { isSamePlayer } from "../scraper/dedupe.js";
import { storedLeadIdentitiesWithId } from "../scraper/persist.js";

const PAD_DEG = 0.004;

export async function finishScoutTile(
  tileId: string,
  runId: string,
): Promise<{ lead: number; nolead: number; unmatched: number }> {
  const tile = await db
    .selectFrom("scout_tile")
    .select(["id", "south", "west", "north", "east"])
    .where("id", "=", tileId)
    .executeTakeFirstOrThrow();
  const rows = await db
    .selectFrom("scout_place")
    .select(["id", "name", "lat", "lon"])
    .where("tile_id", "=", tileId)
    .where("status", "=", "proc")
    .execute();
  // This run's own leads first (the fresh ones), then any stored lead nearby (a row the
  // store-dedup recognised as an existing lead points at THAT lead).
  const own = await db
    .selectFrom("lead")
    .select(["id", "name", "lat", "lng"])
    .where("scrape_run_id", "=", runId)
    .execute();
  const fresh = own.map((l) => ({ id: l.id, name: l.name, lat: l.lat, lon: l.lng }));
  const near = await storedLeadIdentitiesWithId({
    south: tile.south - PAD_DEG,
    north: tile.north + PAD_DEG,
    west: tile.west - PAD_DEG * 1.5,
    east: tile.east + PAD_DEG * 1.5,
  });
  const matched = new Map<string, string>();
  for (const r of rows) {
    const m = fresh.find((l) => isSamePlayer(l, r)) ?? near.find((l) => isSamePlayer(l, r));
    if (m) matched.set(r.id, m.id);
  }
  const quals = matched.size
    ? await db
        .selectFrom("lead")
        .select(["id", "qualification"])
        .where("id", "in", [...new Set(matched.values())])
        .execute()
    : [];
  const qualOf = new Map(quals.map((q) => [q.id, q.qualification]));
  let lead = 0;
  let nolead = 0;
  let unmatched = 0;
  const now = new Date();
  await db.transaction().execute(async (trx) => {
    for (const r of rows) {
      const leadId = matched.get(r.id);
      if (!leadId) {
        unmatched++;
        await trx.updateTable("scout_place").set({ status: "new", updated_at: now }).where("id", "=", r.id).execute();
        continue;
      }
      const q = qualOf.get(leadId);
      const isLead = q === "no_site" || q === "outdated";
      if (isLead) lead++;
      else nolead++;
      await trx
        .updateTable("scout_place")
        .set({ status: isLead ? "lead" : "nolead", lead_id: leadId, updated_at: now })
        .where("id", "=", r.id)
        .execute();
    }
    await trx
      .updateTable("scout_tile")
      .set(
        unmatched
          ? { scrape_run_id: runId, state: "work", closed_at: null, updated_at: now }
          : { scrape_run_id: runId, updated_at: now },
      )
      .where("id", "=", tileId)
      .execute();
  });
  return { lead, nolead, unmatched };
}
