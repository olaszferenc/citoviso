// Kysely table types — the compile-time mirror of migrations/*.sql.
// Source of truth is the SQL; keep this in sync when a migration changes shape.
// Scores/coords are `number` because their columns are DOUBLE PRECISION (not
// NUMERIC), so node-postgres returns them as JS numbers, not strings.

import type { ColumnType, Generated, JSONColumnType } from "kysely";

/** timestamptz — read as Date, written as Date or ISO string. */
type Timestamp = ColumnType<Date, Date | string, Date | string>;

/** Nullable jsonb — object|null on read, JSON string|null on write. */
type NullableJson = ColumnType<
  Record<string, unknown> | null,
  string | null,
  string | null
>;

export interface ScraperDefinitionTable {
  id: Generated<string>;
  label: string;
  country: string;
  region: string;
  city: string | null;
  industry: string;
  /** Enabled source ids, e.g. ["osm","google_places"]. */
  sources: JSONColumnType<string[]>;
  /** Max leads to keep per run; null = uncapped. */
  lead_cap: number | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface ScrapeRunTable {
  id: Generated<string>;
  scraper_definition_id: string;
  status: Generated<"pending" | "running" | "completed" | "failed">;
  started_at: Timestamp | null;
  finished_at: Timestamp | null;
  stats: JSONColumnType<Record<string, unknown>>;
  /** Estimated external API cost of the run (currency-agnostic). */
  cost_estimate: number | null;
  error: string | null;
  created_at: Generated<Timestamp>;
}

export interface LeadTable {
  id: Generated<string>;
  scrape_run_id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  address: string | null;
  category: string | null;
  /** Website qualification — the core lead filter. */
  qualification: "no_site" | "outdated" | "modern" | "unknown" | null;
  /**
   * Owner-confirmed lead lifecycle state (PROCESS.md canonical list). State 0
   * (scraping) is run-level; a lead starts at 'qualified' (state 1). Transitions
   * are a later, process-driven slice.
   */
  lifecycle_status: Generated<
    | "qualified"
    | "mock_curation"
    | "outreach"
    | "conversion"
    | "subscription"
    | "activation"
    | "modification"
    | "terminated"
  >;
  /** Composite lead priority/value 0..1 (computed later; null until scored). */
  weight: number | null;
  /** A4 lead-level entity-match confidence 0..1. */
  match_confidence: number | null;
  /** Full raw payload from the sources (audit + reprocessing). */
  raw: JSONColumnType<Record<string, unknown>>;
  created_at: Generated<Timestamp>;
}

export interface LeadProvenanceTable {
  id: Generated<string>;
  lead_id: string;
  /** Which item this provenance is for: photo|phone|website|review|name|… */
  field: string;
  value: string | null;
  /** Origin adapter: osm|google_places|web_search|… */
  source: string;
  /** { name, placeId, distanceMeters, nameSimilarity, … } */
  matched_entity: NullableJson;
  confidence: number | null;
  observed_at: Generated<Timestamp>;
}

export interface MockArtifactTable {
  id: Generated<string>;
  lead_id: string;
  /** File path or URL of the generated mock. */
  path: string | null;
  status: Generated<"generated" | "approved" | "rejected" | "sent">;
  /** Snapshot of the data that fed generation. */
  inputs: JSONColumnType<Record<string, unknown>>;
  generated_at: Generated<Timestamp>;
}

export interface CuratorDecisionTable {
  id: Generated<string>;
  mock_artifact_id: string;
  decision: "approve" | "reject";
  notes: string | null;
  /** Curator identity (free text for now; a real actor ref later). */
  decided_by: string | null;
  decided_at: Generated<Timestamp>;
}

export interface SchemaMigrationsTable {
  name: string;
  applied_at: Generated<Timestamp>;
}

/** The full database shape passed to Kysely<Database>. */
export interface Database {
  scraper_definition: ScraperDefinitionTable;
  scrape_run: ScrapeRunTable;
  lead: LeadTable;
  lead_provenance: LeadProvenanceTable;
  mock_artifact: MockArtifactTable;
  curator_decision: CuratorDecisionTable;
  schema_migrations: SchemaMigrationsTable;
}
