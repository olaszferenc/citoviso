// Generator ↔ DB boundary (Pillar 2, slice 2). The generator reads a lead from
// the DB (the scraper is the writer) and records every rendered mock as a
// mock_artifact row — the seed of the curation gate (curator_decision).
// Kept as plain service functions so a future web layer / job runner can call
// them directly; the CLI (run.ts) is just a thin wrapper.

import { db } from "../db/client.js";
import type { QualifiedLead } from "../scraper/types.js";

export interface LoadedLead {
  /** DB primary key — needed to link the mock_artifact. */
  readonly id: string;
  /** The full qualified lead, rehydrated from lead.raw. */
  readonly lead: QualifiedLead;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Load a lead to generate for. No arg → the most recently scraped lead; a UUID
 * → by id; anything else → newest lead whose name contains the string.
 */
export async function loadLead(idOrName?: string): Promise<LoadedLead> {
  let query = db.selectFrom("lead").select(["id", "raw"]);
  if (idOrName && UUID_RE.test(idOrName)) {
    query = query.where("id", "=", idOrName);
  } else if (idOrName) {
    query = query.where("name", "ilike", `%${idOrName}%`);
  }
  const row = await query
    .orderBy("created_at", "desc")
    .limit(1)
    .executeTakeFirst();
  if (!row) {
    throw new Error(
      idOrName
        ? `No lead in the DB matching "${idOrName}". Run the scraper first.`
        : "No leads in the DB. Run the scraper first.",
    );
  }
  return { id: row.id, lead: row.raw as unknown as QualifiedLead };
}

/**
 * Record a rendered mock as a mock_artifact (status defaults to 'generated').
 * `inputs` is a snapshot of what fed generation, for audit + reproducibility.
 */
export async function recordMockArtifact(input: {
  leadId: string;
  path: string;
  inputs: Record<string, unknown>;
}): Promise<string> {
  const row = await db
    .insertInto("mock_artifact")
    .values({
      lead_id: input.leadId,
      path: input.path,
      inputs: JSON.stringify(input.inputs),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
}
