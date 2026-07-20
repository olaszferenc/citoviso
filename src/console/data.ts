// Operator console — data access. Thin query helpers over the shared Kysely
// instance; the console never opens its own pool. Small pilot volume, so
// "latest artifact/decision per lead" is stitched in JS rather than with
// window functions — clarity over cleverness.

import { randomBytes } from "node:crypto";

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
  /** Real property photos available (Places) — the key mock-readiness signal. */
  readonly photos: number;
  /** Street View baseline shot available (fallback hero). */
  readonly streetView: boolean;
  /** Total gathered images (Places + site + Street View). */
  readonly material: number;
  /** Best reachable outreach channel: email | sms | voice | none. */
  readonly contact: string;
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

/** Filter + sort options for the lead list (from the console query string). */
export interface LeadQuery {
  sort?: string;
  dir?: "asc" | "desc";
  qualification?: string;
  contact?: string;
  mock?: string;
  minPhotos?: number;
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
      latestArtifact: latestByLead.get(l.id) ?? null,
    };
  });

  // Filters.
  if (q.qualification)
    rows = rows.filter((r) => r.qualification === q.qualification);
  if (q.contact) rows = rows.filter((r) => r.contact === q.contact);
  if (q.mock)
    rows = rows.filter((r) =>
      q.mock === "none"
        ? !r.latestArtifact
        : r.latestArtifact?.status === q.mock,
    );
  if (q.minPhotos)
    rows = rows.filter((r) => r.photos >= (q.minPhotos as number));

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
}): Promise<{ leadId: string; leadName: string } | null> {
  const artifact = await db
    .selectFrom("mock_artifact")
    .innerJoin("lead", "lead.id", "mock_artifact.lead_id")
    .select(["lead.id as leadId", "lead.name as leadName"])
    .where("mock_artifact.id", "=", input.artifactId)
    .executeTakeFirst();
  if (!artifact) return null;

  let prospect = await db
    .selectFrom("prospect")
    .select("id")
    .where("lead_id", "=", artifact.leadId)
    .where("mock_artifact_id", "=", input.artifactId)
    .executeTakeFirst();
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

  await db
    .insertInto("order_intent")
    .values({
      prospect_id: prospect.id,
      price: input.price,
      billing_period: input.billingPeriod,
      modules: JSON.stringify(input.modules),
      status: "submitted",
      submitted_at: new Date(),
    })
    .execute();

  return { leadId: artifact.leadId, leadName: artifact.leadName };
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
}

/** Payments for a lead (operator view), newest first, joined via order_intent. */
export async function getPayments(leadId: string): Promise<PaymentView[]> {
  const rows = await db
    .selectFrom("payment")
    .innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
    .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .select([
      "payment.order_intent_id as orderIntentId",
      "payment.status as status",
      "payment.amount as amount",
      "payment.period as period",
      "payment.pay_url as payUrl",
      "payment.paid_at as paidAt",
      "payment.created_at as createdAt",
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
