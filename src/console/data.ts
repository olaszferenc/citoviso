// Operator console — data access. Thin query helpers over the shared Kysely
// instance; the console never opens its own pool. Small pilot volume, so
// "latest artifact/decision per lead" is stitched in JS rather than with
// window functions — clarity over cleverness.

import { randomBytes } from "node:crypto";

import { sql } from "kysely";

import { db } from "../db/client.js";
import { PHOTO_RIGHTS_DECLARATION_V1 } from "../legal.js";
import { circleToBbox } from "../scraper/regions.js";

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
  /** Real property photos available (Places) — the key mock-readiness signal. */
  readonly photos: number;
  /** Street View baseline shot available (fallback hero). */
  readonly streetView: boolean;
  /** Total gathered images (Places + site + Street View). */
  readonly material: number;
  /** Best reachable outreach channel: email | sms | voice | none. */
  readonly contact: string;
  readonly lifecycle: string;
  readonly latestArtifact: { id: string; status: string } | null;
}

export interface LeadDetail {
  readonly id: string;
  readonly name: string;
  readonly qualification: string | null;
  /** Lifecycle state (PROCESS.md); 'disqualified' = operator ruled it out. */
  readonly lifecycle: string;
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

/** Filter + sort options for the lead list (from the console query string). */
/** Column filters. The categorical ones are MULTI-select: an empty array means
 *  "no filter on this column", otherwise the row must match ANY listed value. */
export interface LeadQuery {
  sort?: string;
  dir?: "asc" | "desc";
  /** "1" → show the disqualified ones INSTEAD of the active list. */
  disqualified?: string;
  /** Free-text search on the lead name (autocomplete in the header). */
  name?: string;
  region?: string[];
  qualification?: string[];
  contact?: string[];
  mock?: string[];
  minPhotos?: number;
  minMaterial?: number;
}

function sortValue(r: LeadListRow, key: string): number | string {
  switch (key) {
    case "name":
      return r.name.toLowerCase();
    case "photos":
      return r.photos;
    case "material":
      return r.material;
    case "match":
      return r.matchConfidence ?? -1;
    case "qualification":
      return r.qualification ?? "";
    case "contact":
      return r.contact;
    case "mock":
      return r.latestArtifact?.status ?? "";
    default:
      return 0;
  }
}

/**
 * Leads with region, quality signals (photos/material/contact) and latest artifact
 * status. Filtered + sorted per the query (small volume → done in JS). Default
 * order = newest first.
 */
export async function listLeads(q: LeadQuery = {}): Promise<LeadListRow[]> {
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
      "lead.lifecycle_status as lifecycle",
      "scraper_definition.region as region",
      "lead.raw as raw",
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

  let rows: LeadListRow[] = leads.map((l) => {
    const raw = (l.raw ?? {}) as {
      material?: {
        placesPhotos?: number;
        totalImages?: number;
        streetView?: boolean;
      };
      contactChannel?: string;
      photoCount?: number;
    };
    const mat = raw.material ?? {};
    return {
      id: l.id,
      name: l.name,
      qualification: l.qualification,
      matchConfidence: l.matchConfidence,
      region: l.region,
      photos: mat.placesPhotos ?? raw.photoCount ?? 0,
      streetView: Boolean(mat.streetView),
      material: mat.totalImages ?? 0,
      contact: raw.contactChannel ?? "none",
      lifecycle: String(l.lifecycle),
      latestArtifact: latestByLead.get(l.id) ?? null,
    };
  });

  // Disqualified leads are hidden from the working list by default — they are
  // ruled out, not deleted, and stay reachable behind the filter.
  rows = q.disqualified === "1"
    ? rows.filter((r) => r.lifecycle === "disqualified")
    : rows.filter((r) => r.lifecycle !== "disqualified");

  // Column filters. A multi-select with nothing ticked filters nothing.
  const has = (v?: string[]) => Array.isArray(v) && v.length > 0;
  if (q.name) {
    const needle = q.name.trim().toLowerCase();
    if (needle) rows = rows.filter((r) => r.name.toLowerCase().includes(needle));
  }
  if (has(q.region)) rows = rows.filter((r) => q.region!.includes(r.region));
  if (has(q.qualification)) {
    rows = rows.filter((r) => q.qualification!.includes(r.qualification ?? "unknown"));
  }
  if (has(q.contact)) rows = rows.filter((r) => q.contact!.includes(r.contact));
  if (has(q.mock)) {
    rows = rows.filter((r) =>
      q.mock!.includes(r.latestArtifact ? r.latestArtifact.status : "none"),
    );
  }
  if (q.minPhotos) rows = rows.filter((r) => r.photos >= (q.minPhotos as number));
  if (q.minMaterial) rows = rows.filter((r) => r.material >= (q.minMaterial as number));

  // Sort (default keeps newest-first DB order).
  if (q.sort) {
    const d = q.dir === "asc" ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      const va = sortValue(a, q.sort as string);
      const vb = sortValue(b, q.sort as string);
      return va < vb ? -d : va > vb ? d : 0;
    });
  }

  return rows;
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
      "lead.lifecycle_status as lifecycle",
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
    lifecycle: String(lead.lifecycle),
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

/** Curator-editable lead contact/reachability fields (ADR-0029). The engine reads these off
 *  the lead's `raw` payload (loadLead → QualifiedLead), so correcting/adding them here flows
 *  straight into the next generation. Any field may be added (was missing) OR corrected. */
export interface LeadEdits {
  readonly name?: string;
  readonly phone?: string;
  readonly email?: string;
  readonly website?: string;
  readonly address?: string;
}

/**
 * Persist curator edits onto the lead (ADR-0029). Merges the provided fields into `raw`
 * (empty string = clear the field), keeps a one-time snapshot of the ORIGINAL scraped
 * contact under `raw.scrapedContact` for audit, and stamps `raw.curatorEditedAt`. The
 * lead's `address`/`name` columns are kept in sync so the list/detail header matches.
 * Non-destructive to the rest of the scrape payload. `now` is passed in (no Date in engine).
 */
export async function saveLeadEdits(id: string, edits: LeadEdits, now: Date): Promise<void> {
  const row = await db.selectFrom("lead").select(["raw", "name"]).where("id", "=", id).executeTakeFirst();
  if (!row) throw new Error(`no lead ${id}`);
  const raw = { ...((row.raw ?? {}) as Record<string, unknown>) };

  // One-time audit snapshot of what the scrape originally had (before any curator edit).
  if (raw.scrapedContact === undefined) {
    raw.scrapedContact = {
      name: row.name,
      phone: raw.phone ?? null,
      email: raw.email ?? null,
      website: raw.website ?? null,
      address: raw.address ?? null,
    };
  }

  // Apply each provided field: a non-empty value sets it, an empty string clears it, and an
  // omitted field is left untouched (partial edits are fine).
  const apply = (key: keyof LeadEdits) => {
    const v = edits[key];
    if (v === undefined) return;
    const t = v.trim();
    if (t) raw[key] = t;
    else delete raw[key];
  };
  (["phone", "email", "website", "address"] as const).forEach(apply);
  raw.curatorEditedAt = now.toISOString();

  const nameEdit = edits.name?.trim();
  await db
    .updateTable("lead")
    .set({
      raw: sql`${JSON.stringify(raw)}::jsonb`,
      ...(edits.address !== undefined ? { address: edits.address.trim() || null } : {}),
      ...(nameEdit ? { name: nameEdit } : {}),
    })
    .where("id", "=", id)
    .execute();
}

// --- Conversion (ADR-0014): the Mock→Site provisioning read side. ---

export interface ConversionView {
  readonly tenantId: string;
  /** Site state machine: provisioned (private) | live (public) | … */
  readonly siteStatus: string;
  readonly previewToken: string;
  /** Private preview route (/site/<token>). */
  readonly previewUrl: string;
  /** Read-only tenant self-service route (/admin/<token>). */
  readonly adminUrl: string;
  /** Which approved artifact this site was provisioned from. */
  readonly sourceArtifactId: string | null;
  readonly modules: string[];
}

/** Conversion state for a lead, or null if it has not been converted yet. */
export async function getConversion(leadId: string): Promise<ConversionView | null> {
  const tenant = await db
    .selectFrom("tenant")
    .select("id")
    .where("lead_id", "=", leadId)
    .executeTakeFirst();
  if (!tenant) return null;
  const site = await db
    .selectFrom("site")
    .select(["status", "preview_token", "source_artifact_id"])
    .where("tenant_id", "=", tenant.id)
    .executeTakeFirst();
  const mods = await db
    .selectFrom("module_entitlement")
    .select("module")
    .where("tenant_id", "=", tenant.id)
    .where("active", "=", true)
    .orderBy("module")
    .execute();
  const token = site?.preview_token ?? "";
  return {
    tenantId: tenant.id,
    siteStatus: site?.status ?? "draft",
    previewToken: token,
    previewUrl: token ? `/site/${token}` : "",
    adminUrl: token ? `/admin/${token}` : "",
    sourceArtifactId: site?.source_artifact_id ?? null,
    modules: mods.map((m) => m.module),
  };
}

export interface OrderIntentView {
  readonly id: string;
  readonly price: number | null;
  readonly billingPeriod: string;
  readonly modules: string[];
  readonly status: string;
  readonly submittedAt: string | null;
  readonly createdAt: string;
  /** Domain choice (0008, ADR-0020): citoviso_sub | citoviso_registered | own. */
  readonly domainType: string;
  readonly domainName: string | null;
  readonly commitmentMonths: number | null;
}

/**
 * Record a prospect's SUBMITTED order intent (pricing slice). Get-or-creates a
 * prospect for the lead+artifact (the tracked-outreach /p/<token> prospect flow
 * is a later slice), inserts the order_intent (price + billing_period + modules),
 * and advances the prospect status. Returns the lead for operator logging.
 */
export async function recordOrderIntent(input: {
  artifactId: string;
  modules: string[];
  billingPeriod: "monthly" | "annual";
  price: number | null;
  /** Domain choice (ADR-0020). */
  domainType: "citoviso_sub" | "citoviso_registered" | "own";
  domainName: string | null;
  commitmentMonths: number | null;
  /** §A photo-rights self-declaration accepted at submit (0015). */
  photoRightsDeclared?: boolean;
  /** Tracked-outreach flow (/p/<token>): bind the order to THIS prospect. */
  prospectToken?: string;
}): Promise<{ leadId: string; leadName: string; orderIntentId: string } | null> {
  const artifact = await db
    .selectFrom("mock_artifact")
    .innerJoin("lead", "lead.id", "mock_artifact.lead_id")
    .select(["lead.id as leadId", "lead.name as leadName"])
    .where("mock_artifact.id", "=", input.artifactId)
    .executeTakeFirst();
  if (!artifact) return null;

  let prospect = input.prospectToken
    ? await db
        .selectFrom("prospect")
        .select("id")
        .where("token", "=", input.prospectToken)
        .executeTakeFirst()
    : undefined;
  if (!prospect) {
    prospect = await db
      .selectFrom("prospect")
      .select("id")
      .where("lead_id", "=", artifact.leadId)
      .where("mock_artifact_id", "=", input.artifactId)
      .executeTakeFirst();
  }
  if (!prospect) {
    prospect = await db
      .insertInto("prospect")
      .values({
        lead_id: artifact.leadId,
        mock_artifact_id: input.artifactId,
        token: randomBytes(18).toString("base64url"),
        status: "order_intent",
      })
      .returning("id")
      .executeTakeFirstOrThrow();
  } else {
    await db
      .updateTable("prospect")
      .set({ status: "order_intent" })
      .where("id", "=", prospect.id)
      .execute();
  }

  const order = await db
    .insertInto("order_intent")
    .values({
      prospect_id: prospect.id,
      price: input.price,
      billing_period: input.billingPeriod,
      modules: JSON.stringify(input.modules),
      status: "submitted",
      submitted_at: new Date(),
      domain_type: input.domainType,
      domain_name: input.domainName,
      commitment_months: input.commitmentMonths,
      // §A: stamp the EXACT accepted wording, not a reference to it.
      ...(input.photoRightsDeclared
        ? { photo_rights_declared_at: new Date(), photo_rights_text: PHOTO_RIGHTS_DECLARATION_V1 }
        : {}),
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  // The order id goes back to the caller so the submit handler can issue the pay-link
  // in the SAME request — order→payment is automatic, not an operator action.
  return { leadId: artifact.leadId, leadName: artifact.leadName, orderIntentId: order.id };
}

/** All order intents for a lead (operator view), newest first. */
export async function getOrderIntents(leadId: string): Promise<OrderIntentView[]> {
  const rows = await db
    .selectFrom("order_intent")
    .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .select([
      "order_intent.id as id",
      "order_intent.price as price",
      "order_intent.billing_period as billingPeriod",
      "order_intent.modules as modules",
      "order_intent.status as status",
      "order_intent.submitted_at as submittedAt",
      "order_intent.created_at as createdAt",
      "order_intent.domain_type as domainType",
      "order_intent.domain_name as domainName",
      "order_intent.commitment_months as commitmentMonths",
    ])
    .where("prospect.lead_id", "=", leadId)
    .orderBy("order_intent.created_at", "desc")
    .execute();
  return rows.map((r) => ({
    id: r.id,
    price: r.price,
    billingPeriod: r.billingPeriod,
    modules: (r.modules as unknown as string[]) ?? [],
    status: r.status,
    submittedAt: r.submittedAt ? toIso(r.submittedAt) : null,
    createdAt: toIso(r.createdAt),
    domainType: r.domainType,
    domainName: r.domainName,
    commitmentMonths: r.commitmentMonths,
  }));
}

export interface PaymentView {
  readonly orderIntentId: string;
  readonly status: string;
  readonly amount: number;
  readonly period: string;
  readonly payUrl: string | null;
  readonly paidAt: string | null;
  readonly createdAt: string;
  /** Issued invoice number for this payment, if any (AAM auto-invoice). */
  readonly invoiceNumber: string | null;
}

/** Payments (+ issued invoice number) for a lead, newest first, via order_intent. */
export async function getPayments(leadId: string): Promise<PaymentView[]> {
  const rows = await db
    .selectFrom("payment")
    .innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
    .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .leftJoin("invoice", (join) =>
      join.onRef("invoice.payment_id", "=", "payment.id").on("invoice.status", "=", "issued"),
    )
    .select([
      "payment.order_intent_id as orderIntentId",
      "payment.status as status",
      "payment.amount as amount",
      "payment.period as period",
      "payment.pay_url as payUrl",
      "payment.paid_at as paidAt",
      "payment.created_at as createdAt",
      "invoice.invoice_number as invoiceNumber",
    ])
    .where("prospect.lead_id", "=", leadId)
    .orderBy("payment.created_at", "desc")
    .execute();
  return rows.map((r) => ({
    orderIntentId: r.orderIntentId,
    status: r.status,
    amount: r.amount,
    period: r.period,
    payUrl: r.payUrl,
    paidAt: r.paidAt ? toIso(r.paidAt) : null,
    createdAt: toIso(r.createdAt),
    invoiceNumber: r.invoiceNumber ?? null,
  }));
}

/** Serve-side lookup: a site's snapshot path + status by its opaque token. */
export async function getSiteByToken(
  token: string,
): Promise<{ path: string | null; status: string } | null> {
  const s = await db
    .selectFrom("site")
    .select(["path", "status"])
    .where("preview_token", "=", token)
    .executeTakeFirst();
  return s ?? null;
}

export interface TenantAdminView {
  readonly displayName: string;
  readonly siteStatus: string;
  readonly previewToken: string;
  readonly modules: string[];
}

/** Read-only tenant self-service view, keyed by the same opaque preview token. */
export async function getTenantAdminByToken(
  token: string,
): Promise<TenantAdminView | null> {
  const row = await db
    .selectFrom("site")
    .innerJoin("tenant", "tenant.id", "site.tenant_id")
    .select([
      "tenant.id as tid",
      "tenant.display_name as displayName",
      "site.status as status",
      "site.preview_token as token",
    ])
    .where("site.preview_token", "=", token)
    .executeTakeFirst();
  if (!row) return null;
  const mods = await db
    .selectFrom("module_entitlement")
    .select("module")
    .where("tenant_id", "=", row.tid)
    .where("active", "=", true)
    .orderBy("module")
    .execute();
  return {
    displayName: row.displayName,
    siteStatus: row.status,
    previewToken: row.token,
    modules: mods.map((m) => m.module),
  };
}

// --- Tracked outreach (PILOT.md §2.5 + §3) — the /p/<token> instrumented flow. ---

/** Segment hypothesis label (PILOT.md §2.2), auto-mapped from lead.qualification. */
export type ProspectSegment = "nincs_honlap" | "0_labnyom" | "van_labnyom" | "elavult";

export function segmentFromQualification(q: string | null): ProspectSegment {
  if (q === "no_site") return "nincs_honlap";
  if (q === "outdated") return "elavult";
  if (q === "modern") return "van_labnyom";
  return "0_labnyom"; // unknown footprint — operator refines on the form
}

export interface ProspectView {
  readonly id: string;
  readonly token: string;
  readonly segment: string | null;
  readonly contactEmail: string | null;
  readonly status: string;
  readonly sentAt: string | null;
  readonly unsubscribedAt: string | null;
  readonly createdAt: string;
  readonly artifactId: string | null;
  readonly views: number;
  readonly events: number;
}

/**
 * Get-or-create the tracked prospect for a lead+artifact (idempotent — one
 * tracked identity per lead+mock). Segment defaults from lead.qualification.
 */
export async function createProspect(input: {
  leadId: string;
  artifactId: string;
  segment?: string;
  contactEmail?: string;
}): Promise<ProspectView | null> {
  const lead = await db
    .selectFrom("lead")
    .select(["id", "qualification"])
    .where("id", "=", input.leadId)
    .executeTakeFirst();
  if (!lead) return null;

  const existing = await db
    .selectFrom("prospect")
    .select("id")
    .where("lead_id", "=", input.leadId)
    .where("mock_artifact_id", "=", input.artifactId)
    .executeTakeFirst();
  if (existing) {
    // Idempotent re-run: refresh the operator-editable fields only.
    await db
      .updateTable("prospect")
      .set({
        ...(input.segment ? { segment: input.segment } : {}),
        ...(input.contactEmail ? { contact_email: input.contactEmail } : {}),
      })
      .where("id", "=", existing.id)
      .execute();
  } else {
    await db
      .insertInto("prospect")
      .values({
        lead_id: input.leadId,
        mock_artifact_id: input.artifactId,
        token: randomBytes(18).toString("base64url"),
        segment: input.segment ?? segmentFromQualification(lead.qualification),
        contact_email: input.contactEmail ?? null,
      })
      .execute();
  }
  const list = await getProspects(input.leadId);
  return list.find((p) => p.artifactId === input.artifactId) ?? null;
}

/** All tracked prospects of a lead with view/event counts (operator panel). */
export async function getProspects(leadId: string): Promise<ProspectView[]> {
  const rows = await db
    .selectFrom("prospect")
    .select([
      "id",
      "token",
      "segment",
      "contact_email as contactEmail",
      "status",
      "sent_at as sentAt",
      "unsubscribed_at as unsubscribedAt",
      "created_at as createdAt",
      "mock_artifact_id as artifactId",
    ])
    .where("lead_id", "=", leadId)
    .orderBy("created_at", "desc")
    .execute();
  const out: ProspectView[] = [];
  for (const r of rows) {
    const views = await db
      .selectFrom("mock_view")
      .select(db.fn.countAll().as("n"))
      .where("prospect_id", "=", r.id)
      .executeTakeFirst();
    const events = await db
      .selectFrom("mock_event")
      .innerJoin("mock_view", "mock_view.id", "mock_event.mock_view_id")
      .select(db.fn.countAll().as("n"))
      .where("mock_view.prospect_id", "=", r.id)
      .executeTakeFirst();
    out.push({
      id: r.id,
      token: r.token,
      segment: r.segment,
      contactEmail: r.contactEmail,
      status: r.status,
      sentAt: r.sentAt ? toIso(r.sentAt) : null,
      unsubscribedAt: r.unsubscribedAt ? toIso(r.unsubscribedAt) : null,
      createdAt: toIso(r.createdAt),
      artifactId: r.artifactId,
      views: Number(views?.n ?? 0),
      events: Number(events?.n ?? 0),
    });
  }
  return out;
}

/** Operator marked the outreach as actually sent (H1 funnel base). */
export async function markProspectSent(prospectId: string): Promise<void> {
  await db
    .updateTable("prospect")
    .set({ status: "sent", sent_at: new Date() })
    .where("id", "=", prospectId)
    .where("status", "=", "created")
    .execute();
  // sent_at is stamped even on re-send of an already-advanced prospect? No —
  // only the created→sent edge counts; later statuses must not regress.
}

/** Set/replace the prospect's recipient e-mail (ADR-0031). Lets the operator add a contact to
 *  an existing tracked link so the pipeline send has a recipient — no need to recreate it. */
export async function setProspectContactEmail(prospectId: string, email: string): Promise<void> {
  await db
    .updateTable("prospect")
    .set({ contact_email: email.trim() || null })
    .where("id", "=", prospectId)
    .execute();
}

export interface ProspectPage {
  readonly id: string;
  readonly leadId: string;
  readonly leadName: string;
  readonly artifactId: string;
  readonly artifactPath: string;
  readonly unsubscribed: boolean;
}

/** Resolve a tracked link's token to the prospect + its approved mock artifact. */
export async function getProspectByToken(token: string): Promise<ProspectPage | null> {
  const r = await db
    .selectFrom("prospect")
    .innerJoin("lead", "lead.id", "prospect.lead_id")
    .innerJoin("mock_artifact", "mock_artifact.id", "prospect.mock_artifact_id")
    .select([
      "prospect.id as id",
      "prospect.unsubscribed_at as unsubscribedAt",
      "lead.id as leadId",
      "lead.name as leadName",
      "mock_artifact.id as artifactId",
      "mock_artifact.path as artifactPath",
    ])
    .where("prospect.token", "=", token)
    .executeTakeFirst();
  if (!r || !r.artifactPath) return null;
  return {
    id: r.id,
    leadId: r.leadId,
    leadName: r.leadName,
    artifactId: r.artifactId,
    artifactPath: r.artifactPath,
    unsubscribed: r.unsubscribedAt != null,
  };
}

/** One viewing session per page load (return visit = new view, PILOT.md §3). */
export async function recordView(
  prospectId: string,
  userAgent: string | null,
  referrer: string | null,
): Promise<string> {
  const view = await db
    .insertInto("mock_view")
    .values({ prospect_id: prospectId, user_agent: userAgent, referrer })
    .returning("id")
    .executeTakeFirstOrThrow();
  await db
    .insertInto("mock_event")
    .values({ mock_view_id: view.id, type: "open", payload: JSON.stringify({}) })
    .execute();
  // First open advances the funnel status (never regress a later status).
  await db
    .updateTable("prospect")
    .set({ status: "opened" })
    .where("id", "=", prospectId)
    .where("status", "in", ["created", "sent"])
    .execute();
  return view.id;
}

/** Engagement/configurator event within a view; advances opened→engaged. */
export async function recordEvent(
  prospectId: string,
  viewId: string,
  type: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  // The view must belong to the token's prospect — no cross-prospect writes.
  const view = await db
    .selectFrom("mock_view")
    .select("id")
    .where("id", "=", viewId)
    .where("prospect_id", "=", prospectId)
    .executeTakeFirst();
  if (!view) return false;
  await db
    .insertInto("mock_event")
    .values({ mock_view_id: viewId, type, payload: JSON.stringify(payload) })
    .execute();
  if (type === "module_add" || type === "module_remove" || type === "panel_open") {
    await db
      .updateTable("prospect")
      .set({ status: "engaged" })
      .where("id", "=", prospectId)
      .where("status", "in", ["created", "sent", "opened"])
      .execute();
  }
  return true;
}

/** GDPR/Grt. opt-out: no further outreach, no further tracking. Idempotent. */
export async function unsubscribeProspect(token: string): Promise<boolean> {
  const r = await db
    .updateTable("prospect")
    .set({ unsubscribed_at: new Date() })
    .where("token", "=", token)
    .where("unsubscribed_at", "is", null)
    .returning("id")
    .executeTakeFirst();
  return !!r;
}

// ── Scrape history + pilot funnel report (PILOT.md §7d ① — internal UI) ────────

export interface ScrapeRunView {
  readonly id: string;
  readonly regionLabel: string;
  readonly status: string;
  readonly startedAt: Date | null;
  readonly finishedAt: Date | null;
  readonly stats: Record<string, unknown>;
  readonly error: string | null;
}

/** Recent scrape runs with their definition labels (newest first). */
export async function getScrapeRuns(limit = 15): Promise<ScrapeRunView[]> {
  const rows = await db
    .selectFrom("scrape_run")
    .innerJoin("scraper_definition", "scraper_definition.id", "scrape_run.scraper_definition_id")
    .select([
      "scrape_run.id as id",
      "scraper_definition.label as regionLabel",
      "scrape_run.status as status",
      "scrape_run.started_at as startedAt",
      "scrape_run.finished_at as finishedAt",
      "scrape_run.stats as stats",
      "scrape_run.error as error",
    ])
    .orderBy("scrape_run.created_at", "desc")
    .limit(limit)
    .execute();
  return rows.map((r) => ({ ...r, stats: (r.stats ?? {}) as Record<string, unknown> }));
}

export interface FunnelCounts {
  readonly prospects: number;
  readonly sent: number;
  readonly opened: number;
  readonly returned: number;
  readonly moduleTouched: number;
  readonly orderIntent: number;
  readonly converted: number;
  readonly unsubscribed: number;
  /** H1 numerator: opened AND actually sent (dev-era prospects can open unsent). */
  readonly openedOfSent: number;
  /** H5 numerator: order-intent AND actually sent. */
  readonly orderIntentOfSent: number;
}

export interface SegmentFunnelRow extends FunnelCounts {
  readonly segment: string;
}

export interface FunnelReport {
  readonly total: FunnelCounts;
  readonly segments: SegmentFunnelRow[];
  readonly leadTotals: { readonly players: number; readonly leads: number; readonly mocks: number; readonly approved: number };
}

/** Ordinal prospect statuses — never regress (0009), so >= threshold counts work. */
const STATUS_ORDER = ["created", "sent", "opened", "engaged", "order_intent", "converted"];

function atLeast(status: string, threshold: string): boolean {
  return STATUS_ORDER.indexOf(status) >= STATUS_ORDER.indexOf(threshold);
}

/**
 * H1–H5 funnel report (PILOT.md §4). Counts are prospect-based:
 *  sent      = outreach actually sent (sent_at, the H1 base)
 *  opened    = at least one tracked pageload (H1 numerator)
 *  returned  = >1 tracked view (H2)
 *  moduleTouched = any module_add event (H3)
 *  orderIntent / converted = funnel tail (H4, H5)
 */
export async function getFunnelReport(): Promise<FunnelReport> {
  const prospects = await db
    .selectFrom("prospect")
    .leftJoin(
      db.selectFrom("mock_view").select(["prospect_id", db.fn.countAll().as("views")]).groupBy("prospect_id").as("v"),
      (join) => join.onRef("v.prospect_id", "=", "prospect.id"),
    )
    .leftJoin(
      db
        .selectFrom("mock_event")
        .innerJoin("mock_view", "mock_view.id", "mock_event.mock_view_id")
        .select(["mock_view.prospect_id as pid", db.fn.countAll().as("adds")])
        .where("mock_event.type", "=", "module_add")
        .groupBy("mock_view.prospect_id")
        .as("e"),
      (join) => join.onRef("e.pid", "=", "prospect.id"),
    )
    .select([
      "prospect.segment as segment",
      "prospect.status as status",
      "prospect.sent_at as sentAt",
      "prospect.unsubscribed_at as unsubscribedAt",
      "v.views as views",
      "e.adds as adds",
    ])
    .execute();

  const empty = (): FunnelCounts => ({
    prospects: 0,
    sent: 0,
    opened: 0,
    returned: 0,
    moduleTouched: 0,
    orderIntent: 0,
    converted: 0,
    unsubscribed: 0,
    openedOfSent: 0,
    orderIntentOfSent: 0,
  });
  const acc = (c: FunnelCounts, p: (typeof prospects)[number]): FunnelCounts => {
    const opened = Number(p.views ?? 0) > 0 || atLeast(p.status, "opened");
    const intent = atLeast(p.status, "order_intent");
    return {
      prospects: c.prospects + 1,
      sent: c.sent + (p.sentAt ? 1 : 0),
      opened: c.opened + (opened ? 1 : 0),
      returned: c.returned + (Number(p.views ?? 0) > 1 ? 1 : 0),
      moduleTouched: c.moduleTouched + (Number(p.adds ?? 0) > 0 ? 1 : 0),
      orderIntent: c.orderIntent + (intent ? 1 : 0),
      converted: c.converted + (atLeast(p.status, "converted") ? 1 : 0),
      unsubscribed: c.unsubscribed + (p.unsubscribedAt ? 1 : 0),
      openedOfSent: c.openedOfSent + (opened && p.sentAt ? 1 : 0),
      orderIntentOfSent: c.orderIntentOfSent + (intent && p.sentAt ? 1 : 0),
    };
  };

  let total = empty();
  const bySeg = new Map<string, FunnelCounts>();
  for (const p of prospects) {
    total = acc(total, p);
    const seg = p.segment ?? "ismeretlen";
    bySeg.set(seg, acc(bySeg.get(seg) ?? empty(), p));
  }

  const players = await db.selectFrom("lead").select(db.fn.countAll().as("n")).executeTakeFirst();
  const leads = await db
    .selectFrom("lead")
    .select(db.fn.countAll().as("n"))
    .where("qualification", "in", ["no_site", "outdated"])
    .executeTakeFirst();
  const mocks = await db.selectFrom("mock_artifact").select(db.fn.countAll().as("n")).executeTakeFirst();
  const approved = await db
    .selectFrom("mock_artifact")
    .select(db.fn.countAll().as("n"))
    .where("status", "=", "approved")
    .executeTakeFirst();

  return {
    total,
    segments: [...bySeg.entries()]
      .map(([segment, c]) => ({ segment, ...c }))
      .sort((a, b) => b.prospects - a.prospects),
    leadTotals: {
      players: Number(players?.n ?? 0),
      leads: Number(leads?.n ?? 0),
      mocks: Number(mocks?.n ?? 0),
      approved: Number(approved?.n ?? 0),
    },
  };
}

// ── Scrape areas (0018) + map view ──────────────────────────────────────────

export interface RegionRow {
  readonly id: string;
  readonly label: string;
  readonly south: number;
  readonly west: number;
  readonly north: number;
  readonly east: number;
  /** Circle model (0019): what the operator actually set. */
  readonly centerLat: number | null;
  readonly centerLon: number | null;
  readonly radiusKm: number | null;
  readonly active: boolean;
  /** How many leads have been scraped in runs of this region (coverage signal). */
  readonly leadCount: number;
}

/** All scrape areas (including inactive) with their lead counts, for the admin UI. */
export async function listRegions(): Promise<RegionRow[]> {
  const rows = await db
    .selectFrom("region")
    .select([
      "id", "label", "south", "west", "north", "east", "active",
      "center_lat as centerLat", "center_lon as centerLon", "radius_km as radiusKm",
    ])
    .orderBy("label")
    .execute();
  // Lead counts per region id: scrape_run rows carry the region through the
  // scraper_definition query (region id is the definition's region field).
  const counts = await db
    .selectFrom("lead")
    .innerJoin("scrape_run", "scrape_run.id", "lead.scrape_run_id")
    .innerJoin("scraper_definition", "scraper_definition.id", "scrape_run.scraper_definition_id")
    .select(["scraper_definition.region as region", sql<string>`count(*)`.as("n")])
    .groupBy("scraper_definition.region")
    .execute();
  const byRegion = new Map(counts.map((c) => [c.region, Number(c.n)]));
  return rows.map((r) => ({ ...r, leadCount: byRegion.get(r.id) ?? 0 }));
}

/**
 * Create or update a CIRCULAR scrape area (0019). The operator sets a center and a
 * radius; the enclosing bbox is derived here so the sources (which query rectangles)
 * need no change, and the scraper filters back to the circle.
 */
export async function saveRegion(input: {
  id: string;
  label: string;
  centerLat: number;
  centerLon: number;
  radiusKm: number;
  active: boolean;
}): Promise<void> {
  const now = new Date();
  const [south, west, north, east] = circleToBbox(
    input.centerLat,
    input.centerLon,
    input.radiusKm,
  );
  const values = {
    id: input.id,
    label: input.label,
    south, west, north, east,
    center_lat: input.centerLat,
    center_lon: input.centerLon,
    radius_km: input.radiusKm,
    active: input.active,
  };
  await db
    .insertInto("region")
    .values({ ...values, updated_at: now as unknown as never })
    .onConflict((oc) =>
      oc.column("id").doUpdateSet({
        ...values,
        updated_at: now as unknown as never,
      }),
    )
    .execute();
}

/** Retire an area: kept for history (runs reference it), hidden from the launcher. */
export async function deactivateRegion(id: string): Promise<void> {
  await db
    .updateTable("region")
    .set({ active: false, updated_at: new Date() as unknown as never })
    .where("id", "=", id)
    .execute();
}

export interface MapLead {
  readonly id: string;
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
  readonly qualification: string | null;
  readonly lifecycle: string;
  readonly address: string | null;
}

/** Geo-located leads for the map view (only rows that actually have coordinates). */
export async function listLeadsForMap(): Promise<MapLead[]> {
  const rows = await db
    .selectFrom("lead")
    .select(["id", "name", "lat", "lng", "qualification", "lifecycle_status as lifecycle", "address"])
    .where("lat", "is not", null)
    .where("lng", "is not", null)
    .execute();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    lat: Number(r.lat),
    lon: Number(r.lng),
    qualification: r.qualification,
    lifecycle: String(r.lifecycle),
    address: r.address,
  }));
}


/** Operator ruling: this player is NOT a target (wrong segment, closed, chain, bad data).
 *  Kept in the DB (never deleted) so the same lead is not re-worked after a re-scrape;
 *  the reason is recorded on the lead's raw payload for later segment analysis. */
export async function disqualifyLead(id: string, reason: string): Promise<void> {
  const row = await db
    .selectFrom("lead")
    .select("raw")
    .where("id", "=", id)
    .executeTakeFirst();
  if (!row) return;
  const raw = { ...(row.raw as Record<string, unknown>), disqualifiedReason: reason };
  await db
    .updateTable("lead")
    .set({ lifecycle_status: "disqualified", raw: JSON.stringify(raw) })
    .where("id", "=", id)
    .execute();
}

/** Undo a disqualification (back to the entry state). */
export async function requalifyLead(id: string): Promise<void> {
  const row = await db
    .selectFrom("lead")
    .select("raw")
    .where("id", "=", id)
    .executeTakeFirst();
  if (!row) return;
  const raw = { ...(row.raw as Record<string, unknown>) };
  delete raw.disqualifiedReason;
  await db
    .updateTable("lead")
    .set({ lifecycle_status: "qualified", raw: JSON.stringify(raw) })
    .where("id", "=", id)
    .where("lifecycle_status", "=", "disqualified")
    .execute();
}
