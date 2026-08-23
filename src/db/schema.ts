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

  // ── Billing identity (0029) — WHO is buying, captured at order time and
  // immutable. Before this the invoice buyer was fabricated from lead.name +
  // a regex-split Maps address + a hardcoded NULL tax number.
  /** 'individual' = consumer (withdrawal right); 'business' = adószám required. */
  buyer_type: "individual" | "business" | null;
  /** LEGAL name (cégnév / teljes név) — never the marketing name. */
  buyer_name: string | null;
  /** HU adószám normalised as 8-1-2, e.g. '12345678-2-41'. */
  buyer_tax_number: string | null;
  /** EU VAT (közösségi adószám), e.g. 'PL1234567890'. */
  buyer_eu_vat_number: string | null;
  /** ISO 3166-1 alpha-2. */
  buyer_country: string | null;
  buyer_zip: string | null;
  buyer_city: string | null;
  buyer_address: string | null;
  buyer_email: string | null;
  /** 'reverse_charge' requires a business buyer + EU VAT + VIES 'valid' (DB-enforced). */
  vat_treatment: "aam" | "reverse_charge" | null;
  /** Evidence of the VIES check; 'not_checked' = HU domestic (checksum is authoritative). */
  buyer_vies_status: "valid" | "invalid" | "unavailable" | "not_checked" | null;
  buyer_vies_checked_at: Timestamp | null;
  /** Legal name as VIES returned it — a mismatch is an operator signal, not a reject. */
  buyer_vies_name: string | null;
  /** ÁSZF acceptance (both buyer types): when + the exact wording. */
  terms_accepted_at: Timestamp | null;
  terms_text: string | null;
  /** Consumer waiver of the 14-day withdrawal right (45/2014.); 'individual' only. */
  withdrawal_waiver_at: Timestamp | null;
  withdrawal_waiver_text: string | null;
  /**
   * 'initial' = the conversion checkout (no tenant yet — it is born from the
   * payment). 'upsell' = an existing tenant adding modules (0033); `modules`
   * then holds ONLY the newly added ones, because that is what is being paid for.
   */
  kind: Generated<"initial" | "upsell">;
  /** The tenant being extended; set for 'upsell' only (DB-enforced pairing). */
  tenant_id: string | null;
  /**
   * Billing e-mail recipients the buyer entered at checkout (0032) — a SNAPSHOT of
   * what they asked for at contract time. The live recipient list is
   * partner_contact(kind='billing'), created from this at payment.
   */
  billing_emails: string[] | null;
}

// --- Partner registry (migration 0032) — the accounting counterparty. ---

/**
 * One counterparty, customer and/or supplier. SHARED across the company group
 * (no legal_entity_id — one Hetzner, one tax number). Our own customer's partner
 * row is born AT PAYMENT from the 0029 billing declaration, which is the first
 * moment a legal name and tax number exist.
 */
export interface PartnerTable {
  id: Generated<string>;
  /** LEGAL name — never the lead's marketing name (see ADR-0055). */
  name: string;
  is_customer: Generated<boolean>;
  is_supplier: Generated<boolean>;
  tax_number: string | null;
  eu_vat_number: string | null;
  registration_no: string | null;
  country: Generated<string>;
  zip: string | null;
  city: string | null;
  address: string | null;
  /** Company-level contact. Invoice recipients live in partner_contact, not here. */
  email: string | null;
  phone: string | null;
  /** 0035: a szöveges mező eldobva — a bankszámlák a partner_bank_account táblában élnek
   * (egy partnernek több is lehet, pontosan egy alapértelmezettel). */
  note: string | null;
  /** Set for our own customers; null for suppliers (who are not tenants). */
  tenant_id: string | null;
  active: Generated<boolean>;
  created_at: Generated<Timestamp>;
  created_by: string | null;
  updated_at: Generated<Timestamp>;
  updated_by: string | null;
}

/**
 * A contact person/address at a partner. 'billing' rows are the recipients of
 * invoices, invoice notices and proforma requests — there may be SEVERAL
 * (accountant + owner + office), which is why this is a table and not a column.
 */
export interface PartnerContactTable {
  id: Generated<string>;
  partner_id: string;
  kind: Generated<"billing" | "general" | "technical" | "legal">;
  name: string | null;
  email: string | null;
  phone: string | null;
  /** The main recipient within its role; the rest are copied. One per role. */
  is_primary: Generated<boolean>;
  note: string | null;
  active: Generated<boolean>;
  created_at: Generated<Timestamp>;
  created_by: string | null;
  updated_at: Generated<Timestamp>;
  updated_by: string | null;
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
  /** Platform subdomain label — the live site is public on <slug>.citoviso.com (0017). */
  slug: string | null;
  /** The tenant's own domain once registered through us (ADR-0020); NULL until then. */
  custom_domain: string | null;
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
  status: Generated<"issued" | "failed" | "storno" | "cancelled">;
  error: string | null;
  issued_at: Generated<Timestamp>;
  // ── Document (0030): keep the bizonylat, not just its number. ──
  /** Issued PDF as base64; null when the provider returned none (e.g. mock). */
  pdf_base64: string | null;
  fulfillment_date: Timestamp | null;
  due_date: Timestamp | null;
  /** Tax treatment this document was issued under (mirrors order_intent). */
  vat_treatment: "aam" | "reverse_charge" | null;
  /** Storno/correction chain: the invoice this one cancels or amends. */
  cancels_invoice_id: string | null;
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

// --- Operator-editable pricing (migration 0016; region-keyed in 0020). ---
/**
 * One pricing row per market region (PK = region slug, e.g. 'hu', 'global').
 * 'global' is the fallback pricelist. `currency` is ISO 4217 ('HUF' | 'EUR');
 * amounts are integers in that currency's minor-free major unit (no fractional Ft/€).
 */
export interface PricingConfigTable {
  region: string;
  currency: string;
  base_monthly: number;
  annual_free_months: number;
  custom_domain_yearly: number;
  pricing_confirmed: Generated<boolean>;
  updated_at: Timestamp;
}

/** Per-module monthly add-on price (HUF). */
export interface ModulePriceTable {
  module_id: string;
  price_monthly: number;
  updated_at: Timestamp;
}

/** Operator-editable scrape area (0018): a WGS84 bbox the scraper queries. */
export interface RegionTable {
  /** URL-safe slug, stable (scrape_run rows reference it). */
  id: string;
  label: string;
  south: number;
  west: number;
  north: number;
  east: number;
  /** Circle model (0019): center + radius; the bbox above is derived from these. */
  center_lat: number | null;
  center_lon: number | null;
  radius_km: number | null;
  country: Generated<string>;
  /** Inactive = kept for history, not offered on the scrape launcher. */
  active: Generated<boolean>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface LanguagePackTable {
  /** BCP-47 primary subtag ("pl", "de"…) — one pack per language (ADR-0036). */
  lang: string;
  /** Map: Hungarian source string → translated string. */
  strings: JSONColumnType<Record<string, string>>;
  status: Generated<"generated" | "approved">;
  generated_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

/** ADR-0045 ③ (§J.25): document-level KB translation — one row per (entry, lang).
 *  source_hash pins the Hungarian source version; a mismatch means stale → the
 *  ensure layer regenerates. */
export interface KbTranslationTable {
  entry_id: string;
  lang: string;
  /** sha256 of the Hungarian source (title + body) this translation was made from. */
  source_hash: string;
  title: string;
  body_md: string;
  generated_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

/**
 * Curator verdicts on suspected duplicate lead pairs (0022). The pair key is
 * order-independent: callers must store the smaller uuid in lead_a.
 */
export interface LeadLinkTable {
  lead_a: string;
  lead_b: string;
  verdict: "duplicate" | "same_owner" | "unrelated";
  kept_id: string | null;
  signal: string | null;
  note: string | null;
  decided_at: Generated<Timestamp>;
}

/**
 * Per-module settings for a site (0023, ADR-0044). A PRICED module must be
 * configurable — the field schema, defaults and version migrations live in
 * MODULE_CONFIG_REGISTRY (src/moduleConfig.ts).
 * Keyed on SITE (a setting belongs to a rendered page), while module_entitlement
 * stays tenant-scoped (that one is billing).
 */
export interface SiteModuleConfigTable {
  site_id: string;
  module: string;
  /** Schema version this JSON conforms to; migrated forward on read. */
  version: number;
  config: JSONColumnType<Record<string, unknown>>;
  updated_at: Generated<Timestamp>;
  updated_by: string | null;
}

/** Append-only trail so an owner can ask for the previous settings back (0023). */
export interface SiteModuleConfigHistoryTable {
  id: Generated<number>;
  site_id: string;
  module: string;
  version: number;
  config: JSONColumnType<Record<string, unknown>>;
  replaced_at: Generated<Timestamp>;
  updated_by: string | null;
}

/**
 * A bookable UNIT of a site (0024): a room, an apartment, or the whole place.
 * Availability, portal calendars and booking requests all hang off a unit —
 * a four-apartment guesthouse is four units under one site and one subscription.
 * Every site gets a default unit so a single-unit owner never meets the concept.
 */
export interface SiteUnitTable {
  id: Generated<string>;
  site_id: string;
  name: string;
  /** Guests that fit; null = not stated (never guessed, §B.17). */
  capacity: number | null;
  description: string | null;
  /** Subpage address (0026). Stored, not derived: a URL that changed on rename
   *  would break every link and indexed result pointing at it. */
  slug: ColumnType<string | null, string | null | undefined, string | null>;
  /** This unit's own amenities, owner's words (0026). Site-wide ones stay on the
   *  amenities module. Has a DB default, so it may be omitted on insert. */
  amenities: ColumnType<string[], string | undefined, string>;
  /** "Csak a felsorolt időszakokban adom ki" (0028). false = open all year, seasons
   *  only refine price/minimum — the behaviour every existing unit already had. */
  seasonal_only: Generated<boolean>;
  sort_order: Generated<number>;
  created_at: Generated<Timestamp>;
}

/**
 * Prices per UNIT (0025). An owner prices a room/apartment, not an abstract season,
 * so this shares availability's key. Seasons are recurring 'MM-DD' ranges; a row with
 * both dates NULL is the unit's base price.
 */
export interface UnitPriceTable {
  id: Generated<string>;
  unit_id: string;
  label: string | null;
  date_from: string | null;
  date_to: string | null;
  /** Whole currency units; the currency is a per-site pricing-module setting. */
  amount: number;
  /** Minimum stay inside this season (0028). NULL → the module's site-wide minNights. */
  min_nights: number | null;
  sort_order: Generated<number>;
  created_at: Generated<Timestamp>;
}

/** Non-bookable days of a UNIT. Absent row = free (0024). */
export interface AvailabilityDayTable {
  unit_id: string;
  /** date — kept as an ISO 'YYYY-MM-DD' string, no timezone games. */
  day: string;
  state: "blocked" | "booked";
  /** 'manual' | 'booking:<request_id>' | 'ical:<calendar_link_id>'. */
  source: Generated<string>;
}

/** Guest booking requests awaiting the owner's one-tap verdict (0024). */
export interface BookingRequestTable {
  id: Generated<string>;
  site_id: string;
  unit_id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  date_from: string;
  date_to: string;
  guests: Generated<number>;
  message: string | null;
  status: Generated<"pending" | "accepted" | "declined" | "expired" | "cancelled">;
  /** Single-use token behind the ACCEPT/DECLINE links in the owner's e-mail. */
  action_token: string;
  decided_at: Timestamp | null;
  created_at: Generated<Timestamp>;
}

/** Portal calendar links per UNIT; both directions close the double-booking loop (0024). */
export interface CalendarLinkTable {
  id: Generated<string>;
  unit_id: string;
  direction: "import" | "export";
  provider: string;
  url: string | null;
  feed_token: string | null;
  last_sync_at: Timestamp | null;
  last_error: string | null;
  last_day_count: number | null;
  created_at: Generated<Timestamp>;
}

/**
 * The Google rating as a NUMBER (0027). The review texts are deliberately absent:
 * Places content may not be stored, and fetching it per page view costs more than
 * the module sells for. An average and a count are facts, and resolve already
 * fetches them once per lead — so the badge is free and the text stays at Google.
 */
export interface SitePlaceRatingTable {
  site_id: string;
  place_id: string;
  rating: number | null;
  user_rating_count: number | null;
  /** A4 confidence of the resolve. Below threshold the badge is withheld: a
   *  false-positive match would show the neighbour's stars here (ADR-0043). */
  match_confidence: number | null;
  fetched_at: Generated<Timestamp>;
}

/** First-party guest reviews — ours to store, moderate and display (0027). */
export interface SiteReviewTable {
  id: Generated<string>;
  site_id: string;
  /** Which unit; null = the place as a whole. */
  unit_id: string | null;
  author_name: string;
  /** Only to tell the guest it went live; never rendered. */
  author_email: string | null;
  rating: number;
  body: string;
  /** 'YYYY-MM' of the stay, guest-supplied; never invented (§B.17). */
  stay_month: string | null;
  status: Generated<"pending" | "published" | "rejected">;
  /** Single-use token behind the PUBLISH/REJECT links in the owner's e-mail. */
  action_token: string;
  /** Prepared for the "igazolt vendég" mark; nullable so the open form works. */
  booking_request_id: string | null;
  verified: Generated<boolean>;
  decided_at: Timestamp | null;
  created_at: Generated<Timestamp>;
}

/** The full database shape passed to Kysely<Database>. */

// --- SZÁMVITELI BIZONYLAT-TÖRZS (0031) — minden bizonylat, iránytól és országtól függetlenül.
// Közös audit-konvenció MINDEN itteni táblán: created_at/created_by/updated_at/updated_by.
// A *_by nullable (a rendszer által gyártott bizonylatnak nincs embere) és SET NULL — operátor
// törlése soha nem semmisíthet meg számviteli nyomvonalat.
// Pénz: `string`, mert a numeric-et a node-postgres stringként adja vissza (a float kerekítési
// hibát halmozna — könyvelésben elfogadhatatlan). Számolás előtt konvertálj tudatosan.

/** Közös audit-oszlopok — minden 0031-es tábla viseli. */
interface AuditColumns {
  created_at: Generated<Timestamp>;
  created_by: string | null;
  updated_at: Generated<Timestamp>;
  updated_by: string | null;
}

/** Jogi entitás = a könyvek gazdája (cégcsoport-tag). A bizonylat-sorszám ENTITÁSONKÉNT fut. */
export interface LegalEntityTable extends AuditColumns {
  id: Generated<string>;
  code: string;
  name: string;
  legal_form: string | null;
  tax_number: string | null;
  eu_vat_number: string | null;
  registration_no: string | null;
  country: Generated<string>;
  zip: string | null;
  city: string | null;
  address: string | null;
  /** Alapértelmezett áfakulcs a KIMENŐ bizonylatain ('AAM' ev-nél, '27' áfás kft-nél). */
  default_vat_key: string | null;
  /** Beszámoló-pénznem; devizás bizonylat MNB-árfolyamon számolható át (rátát NEM tárolunk). */
  accounting_currency: Generated<string>;
  active: Generated<boolean>;
}


export interface PartnerBankAccountTable extends AuditColumns {
  id: Generated<string>;
  partner_id: string;
  account_no: string;
  bank_name: string | null;
  currency: string | null;
  /** Partnerenként legfeljebb egy (részleges unique index). */
  is_default: Generated<boolean>;
  active: Generated<boolean>;
}


/** Ami entitásonként ELTÉR ugyanannál a partnernél (a közös törzs ára). */
export interface PartnerEntitySettingTable extends AuditColumns {
  id: Generated<string>;
  partner_id: string;
  legal_entity_id: string;
  /** Fizetési határidő NAPOKBAN — ebből számoljuk a bizonylat due_date-jét. */
  payment_terms_days: number | null;
  gl_account_id: string | null;
  cost_type_id: string | null;
  cost_center_id: string | null;
  note: string | null;
}

/** A könyvelési dimenziók azonos alakúak; mind nullable a bizonylaton. */
interface DimensionTable extends AuditColumns {
  id: Generated<string>;
  code: string;
  name: string;
  active: Generated<boolean>;
}
export interface GlAccountTable extends DimensionTable {}
export interface CostCenterTable extends DimensionTable {}
export interface ProfitCenterTable extends DimensionTable {}
export interface CostTypeTable extends DimensionTable {}
export interface DocumentCategoryTable extends DimensionTable {}

/** Bankszámla — az ENTITÁSÉ. A gateway-egyenleg (Barion) is ide tartozik egyeztetés szempontjából. */
export interface BankAccountTable extends AuditColumns {
  id: Generated<string>;
  legal_entity_id: string;
  label: string;
  account_no: string | null;
  bank_name: string | null;
  currency: Generated<string>;
  kind: Generated<"bank" | "gateway" | "cash">;
  active: Generated<boolean>;
}

/** A BIZONYLAT. Önálló számviteli entitás; a fizetés csak egy lehetséges kapcsolata. */
export interface AccountingDocumentTable extends AuditColumns {
  id: Generated<string>;
  legal_entity_id: string;
  /** Belső sorszám, entitásonként külön sorozat (nem globális). */
  internal_no: number;
  /** Csoporton belüli bizonylat — konszolidációnál kiszűrendő. */
  intra_group: Generated<boolean>;
  /** 'outgoing' = vevői/bevétel, 'incoming' = szállítói/költség. */
  direction: "outgoing" | "incoming";
  doc_type: Generated<"invoice" | "proforma" | "receipt" | "storno" | "correction" | "credit_note">;
  partner_id: string | null;
  /** A bizonylaton szereplő szám (a miénk kimenőnél, a partneré bejövőnél). */
  document_number: string | null;
  issue_date: Timestamp;
  fulfillment_date: Timestamp | null;
  due_date: Timestamp | null;
  period_start: Timestamp | null;
  period_end: Timestamp | null;
  net: Generated<string>;
  vat: Generated<string>;
  gross: Generated<string>;
  /** A bizonylat SAJÁT devizaneme (ISO 4217); árfolyamot nem tárolunk. */
  currency: Generated<string>;
  /** Nem országfüggő enum: 'AAM'/'TAM'/'27' és külföldi kulcsok egyaránt. */
  vat_treatment: string | null;
  approved: Generated<boolean>;
  approved_at: Timestamp | null;
  approved_by: string | null;
  paid: Generated<boolean>;
  paid_at: Timestamp | null;
  booked: Generated<boolean>;
  booked_at: Timestamp | null;
  booked_by: string | null;
  is_cash: Generated<boolean>;
  bank_account_id: string | null;
  bank_account_text: string | null;
  gl_account_id: string | null;
  cost_center_id: string | null;
  profit_center_id: string | null;
  cost_type_id: string | null;
  category_id: string | null;
  /** A bizonylat KÉPE: fájl-útvonal a bizonylat-tárban, nem blob. */
  document_file: string | null;
  document_mime: string | null;
  document_sha256: string | null;
  source: Generated<"system" | "imported" | "manual">;
  provider: string | null;
  provider_ref: string | null;
  /** Nullable + SET NULL: a bizonylat TÚLÉLI a fizetés törlését. */
  payment_id: string | null;
  /** Sztornó/helyesbítő lánc: melyik bizonylatot érvényteleníti vagy módosítja. */
  corrects_document_id: string | null;
  status: Generated<"draft" | "active" | "void">;
  note: string | null;
}

export interface AccountingDocumentLineTable extends AuditColumns {
  id: Generated<string>;
  document_id: string;
  line_no: number;
  description: string;
  quantity: Generated<string>;
  unit: Generated<string>;
  unit_net: Generated<string>;
  /** Az áfakulcs KÓDJA ahogy a bizonylaton áll; nem enum (országonként más a készlet). */
  vat_key: string | null;
  vat_rate: string | null;
  net: Generated<string>;
  vat: Generated<string>;
  gross: Generated<string>;
  gl_account_id: string | null;
  cost_type_id: string | null;
  cost_center_id: string | null;
  note: string | null;
}

export interface Database {
  region: RegionTable;
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
  partner: PartnerTable;
  partner_contact: PartnerContactTable;
  mock_request: MockRequestTable;
  tenant_user: TenantUserTable;
  operator_user: OperatorUserTable;
  login_token: LoginTokenTable;
  pricing_config: PricingConfigTable;
  module_price: ModulePriceTable;
  schema_migrations: SchemaMigrationsTable;
  language_pack: LanguagePackTable;
  kb_translation: KbTranslationTable;
  lead_link: LeadLinkTable;
  site_module_config: SiteModuleConfigTable;
  site_module_config_history: SiteModuleConfigHistoryTable;
  site_unit: SiteUnitTable;
  unit_price: UnitPriceTable;
  availability_day: AvailabilityDayTable;
  booking_request: BookingRequestTable;
  calendar_link: CalendarLinkTable;
  site_place_rating: SitePlaceRatingTable;
  site_review: SiteReviewTable;
  legal_entity: LegalEntityTable;
  partner_bank_account: PartnerBankAccountTable;
  partner_entity_setting: PartnerEntitySettingTable;
  gl_account: GlAccountTable;
  cost_center: CostCenterTable;
  profit_center: ProfitCenterTable;
  cost_type: CostTypeTable;
  document_category: DocumentCategoryTable;
  bank_account: BankAccountTable;
  accounting_document: AccountingDocumentTable;
  accounting_document_line: AccountingDocumentLineTable;
}
