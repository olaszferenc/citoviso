// Operator console — data access. Thin query helpers over the shared Kysely
// instance; the console never opens its own pool. Small pilot volume, so
// "latest artifact/decision per lead" is stitched in JS rather than with
// window functions — clarity over cleverness.

import { db } from "../db/client.js";

/** timestamptz comes back as a Date at runtime; normalize to ISO for the views. */
function toIso(v: unknown): string {
  return new Date(v as string | number | Date).toISOString();
}

export interface ArtifactView {
  readonly id: string;
  readonly status: string;
  readonly path: string | null;
  readonly inputs: Record<string, unknown>;
  readonly generatedAt: string;
  readonly decisions: {
    readonly decision: string;
    readonly notes: string | null;
    readonly decidedBy: string | null;
    readonly decidedAt: string;
  }[];
}

export interface LeadListRow {
  readonly id: string;
  readonly name: string;
  readonly qualification: string | null;
  readonly matchConfidence: number | null;
  readonly region: string;
  readonly latestArtifact: { id: string; status: string } | null;
}

export interface LeadDetail {
  readonly id: string;
  readonly name: string;
  readonly qualification: string | null;
  readonly matchConfidence: number | null;
  readonly address: string | null;
  readonly region: string;
  readonly raw: Record<string, unknown>;
  readonly provenance: {
    readonly field: string;
    readonly value: string | null;
    readonly source: string;
    readonly confidence: number | null;
  }[];
  readonly artifacts: ArtifactView[];
}

/** All leads with their region and latest artifact status, newest first. */
export async function listLeads(): Promise<LeadListRow[]> {
  const leads = await db
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
      "lead.qualification as qualification",
      "lead.match_confidence as matchConfidence",
      "scraper_definition.region as region",
      "lead.created_at as createdAt",
    ])
    .orderBy("lead.created_at", "desc")
    .execute();

  const artifacts = await db
    .selectFrom("mock_artifact")
    .select(["id", "lead_id", "status", "generated_at"])
    .orderBy("generated_at", "desc")
    .execute();
  const latestByLead = new Map<string, { id: string; status: string }>();
  for (const a of artifacts) {
    if (!latestByLead.has(a.lead_id)) {
      latestByLead.set(a.lead_id, { id: a.id, status: a.status });
    }
  }

  return leads.map((l) => ({
    id: l.id,
    name: l.name,
    qualification: l.qualification,
    matchConfidence: l.matchConfidence,
    region: l.region,
    latestArtifact: latestByLead.get(l.id) ?? null,
  }));
}

/** Full lead detail: fields, provenance and all artifacts with their decisions. */
export async function getLead(id: string): Promise<LeadDetail | null> {
  const lead = await db
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
      "lead.qualification as qualification",
      "lead.match_confidence as matchConfidence",
      "lead.address as address",
      "lead.raw as raw",
      "scraper_definition.region as region",
    ])
    .where("lead.id", "=", id)
    .executeTakeFirst();
  if (!lead) return null;

  const provenance = await db
    .selectFrom("lead_provenance")
    .select(["field", "value", "source", "confidence"])
    .where("lead_id", "=", id)
    .orderBy("observed_at", "asc")
    .execute();

  const artifactRows = await db
    .selectFrom("mock_artifact")
    .select(["id", "status", "path", "inputs", "generated_at"])
    .where("lead_id", "=", id)
    .orderBy("generated_at", "desc")
    .execute();

  // Only query decisions when there are artifacts — an empty IN () list would
  // pass '' to a uuid column and error (22P02).
  const decisionRows = artifactRows.length
    ? await db
        .selectFrom("curator_decision")
        .select([
          "mock_artifact_id",
          "decision",
          "notes",
          "decided_by",
          "decided_at",
        ])
        .where(
          "mock_artifact_id",
          "in",
          artifactRows.map((a) => a.id),
        )
        .orderBy("decided_at", "desc")
        .execute()
    : [];

  const artifacts: ArtifactView[] = artifactRows.map((a) => ({
    id: a.id,
    status: a.status,
    path: a.path,
    inputs: a.inputs,
    generatedAt: toIso(a.generated_at),
    decisions: decisionRows
      .filter((d) => d.mock_artifact_id === a.id)
      .map((d) => ({
        decision: d.decision,
        notes: d.notes,
        decidedBy: d.decided_by,
        decidedAt: toIso(d.decided_at),
      })),
  }));

  return {
    id: lead.id,
    name: lead.name,
    qualification: lead.qualification,
    matchConfidence: lead.matchConfidence,
    address: lead.address,
    region: lead.region,
    raw: lead.raw,
    provenance,
    artifacts,
  };
}

/**
 * Curation gate (A2): record the decision and reflect it on the artifact status.
 * approve → 'approved', reject → 'rejected'.
 */
export async function curateArtifact(
  artifactId: string,
  decision: "approve" | "reject",
  notes?: string,
): Promise<void> {
  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto("curator_decision")
      .values({
        mock_artifact_id: artifactId,
        decision,
        notes: notes ?? null,
        decided_by: "console",
      })
      .execute();
    await trx
      .updateTable("mock_artifact")
      .set({ status: decision === "approve" ? "approved" : "rejected" })
      .where("id", "=", artifactId)
      .execute();
  });
}
