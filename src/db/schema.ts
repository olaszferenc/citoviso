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
    | "disqualified"
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

// --- Pilot instrumentation (migration 0003) — the behavioral-data spine. ---

export interface ProspectTable {
  id: Generated<string>;
  lead_id: string;
  mock_artifact_id: string | null;
  /** Opaque token in the tracked outreach link (/p/<token>). */
  token: string;
  /** Segment hypothesis: nincs_honlap | 0_labnyom | van_labnyom | elavult. */
  segment: string | null;
  contact_email: string | null;
  status: Generated<
    | "created"
    | "sent"
    | "opened"
    | "engaged"
    | "order_intent"
    | "converted"
    | "lost"
  >;
  created_at: Generated<Timestamp>;
  /** When the outreach was actually sent (0009) — the H1 funnel base. */
  sent_at: Timestamp | null;
  /** GDPR/Grt. opt-out (0009): no further outreach AND no further tracking. */
  unsubscribed_at: Timestamp | null;
}

export interface MockViewTable {
  id: Generated<string>;
  prospect_id: string;
  started_at: Generated<Timestamp>;
  user_agent: string | null;
  referrer: string | null;
}

export interface MockEventTable {
  id: Generated<string>;
  mock_view_id: string;
  /** open | scroll | dwell | module_add | module_remove | order_intent_start | … */
  type: string;
  payload: JSONColumnType<Record<string, unknown>>;
  occurred_at: Generated<Timestamp>;
}

export interface OrderIntentTable {
  id: Generated<string>;
  prospect_id: string;
  price: number | null;
  /** Chosen billing cadence (0005). Annual prepay = 2 months free. */
  billing_period: Generated<"monthly" | "annual">;
  /** Chosen module ids. */
  modules: JSONColumnType<string[]>;
  status: Generated<"started" | "submitted" | "abandoned">;
  created_at: Generated<Timestamp>;
  submitted_at: Timestamp | null;
  /** Domain choice (0008, ADR-0020). Default = platform subdomain. */
  domain_type: Generated<"citoviso_sub" | "citoviso_registered" | "own">;
  /** Chosen host: full domain (custom/own) or the subdomain host. */
  domain_name: string | null;
  /** Commitment (months) implied by the domain choice; citoviso_registered ⇒ 24. */
  commitment_months: number | null;
  /** §A photo-rights self-declaration at order (0015): when + the exact wording accepted. */
  photo_rights_declared_at: Timestamp | null;
  photo_rights_text: string | null;
}

// --- Conversion (migration 0004) — the Mock→Site plane-switch spine (ADR-0014). ---

export interface TenantTable {
  id: Generated<string>;
  /** The lead this tenant converted from (one tenant per lead). */
  lead_id: string;
  display_name: string;
  status: Generated<"active" | "suspended" | "closed">;
  created_at: Generated<Timestamp>;
}

export interface ModuleEntitlementTable {
  id: Generated<string>;
  tenant_id: string;
  /** Module id from 05-MODULES.md (gallery|booking|enquiry|reviews|map|…). */
  module: string;
  active: Generated<boolean>;
  created_at: Generated<Timestamp>;
}

export interface SiteTable {
  id: Generated<string>;
  tenant_id: string;
  /** The approved mock this site was provisioned from (lineage). */
  source_artifact_id: string | null;
  /** Site state machine (ADR-0014): provisioned = private preview; live = public. */
  status: Generated<
    "draft" | "provisioned" | "live" | "suspended" | "deactivated"
  >;
  /** Server-side snapshot path (sites/<tenant_id>/index.html). */
  path: string | null;
  /** Opaque token for the private preview URL (/site/<preview_token>). */
  preview_token: string;
  provisioned_at: Generated<Timestamp>;
  /** Set when flipped to public 'live' (payment gate); null while private. */
  live_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  /** Tenant-owned content overrides (0011); NULL → use the artifact's siteData. */
  edited_site_data: NullableJson;
}

// --- Tenant auth (migration 0011, ADR-0023) — data-plane magic-link login. ---
export interface TenantUserTable {
  id: Generated<string>;
  tenant_id: string;
  /** Stable login identifier issued from the business name (0013). */
  username: string;
  /** Changeable communication email (0013, was `email`). */
  contact_email: string;
  role: Generated<string>;
  /** scrypt hash "salt:hex" of the issued password (0012). */
  password_hash: string | null;
  created_at: Generated<Timestamp>;
  last_login_at: Timestamp | null;
}

/** Control-plane (internal console) login — separate realm from tenant_user (ADR-0021). */
export interface OperatorUserTable {
  id: Generated<string>;
  username: string;
  display_name: string;
  /** Prepared for the deferred granular RBAC (superadmin now). */
  role: Generated<string>;
  /** scrypt hash "salt:hex". */
  password_hash: string;
  created_at: Generated<Timestamp>;
  last_login_at: Timestamp | null;
}

export interface LoginTokenTable {
  id: Generated<string>;
  tenant_user_id: string;
  token: string;
  expires_at: Timestamp;
  used_at: Timestamp | null;
  created_at: Generated<Timestamp>;
}

// --- Payment (migration 0006) — the pilot pay-link record (Slice 2). ---
export interface PaymentTable {
  id: Generated<string>;
  order_intent_id: string;
  amount: number;
  currency: Generated<string>;
  period: "monthly" | "annual";
  gateway: Generated<string>;
  /** Gateway payment reference (Barion PaymentId; mock: own ref). */
  gateway_ref: string | null;
  pay_url: string | null;
  status: Generated<"pending" | "paid" | "failed" | "cancelled">;
  created_at: Generated<Timestamp>;
  paid_at: Timestamp | null;
}

// --- Invoice (migration 0007) — the financial end of the loop (Slice 3). ---
export interface InvoiceTable {
  id: Generated<string>;
  payment_id: string;
  provider: string;
  invoice_number: string | null;
  /** Számlázz.hu áfakulcs; 'AAM' = alanyi adómentes (VAT-exempt). vat PER invoice. */
  vat_key: Generated<string>;
  vat_rate: Generated<number>;
  net: number;
  gross: number;
  currency: Generated<string>;
  status: Generated<"issued" | "failed">;
  error: string | null;
  issued_at: Generated<Timestamp>;
}

// --- Self-serve auto-mock intake (migration 0010, ADR-0022). ---
export interface MockRequestTable {
  id: Generated<string>;
  /** Opaque token for the emailed preview URL (/m/<token>). */
  token: string;
  business_name: string;
  town: string;
  business_type: string | null;
  /** Email or phone the mock is sent to. */
  contact: string;
  /** Optional Google Maps / own-site link for a precise resolve. */
  maps_link: string | null;
  /** Exact location the visitor picked on the map (primary resolve input). */
  lat: number | null;
  lon: number | null;
  status: Generated<
    "received" | "resolving" | "generating" | "sent" | "needs_review" | "failed"
  >;
  lead_id: string | null;
  artifact_id: string | null;
  /** A4 match confidence of the resolved place (drives gated-auto). */
  match_confidence: number | null;
  /** Guardian outcome flags / send record. */
  flags: JSONColumnType<string[]>;
  error: string | null;
  created_at: Generated<Timestamp>;
  processed_at: Timestamp | null;
  sent_at: Timestamp | null;
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
  prospect: ProspectTable;
  mock_view: MockViewTable;
  mock_event: MockEventTable;
  order_intent: OrderIntentTable;
  tenant: TenantTable;
  module_entitlement: ModuleEntitlementTable;
  site: SiteTable;
  payment: PaymentTable;
  invoice: InvoiceTable;
  mock_request: MockRequestTable;
  tenant_user: TenantUserTable;
  operator_user: OperatorUserTable;
  login_token: LoginTokenTable;
  schema_migrations: SchemaMigrationsTable;
}
