// Conversion — the Mock→Site plane-switch (ADR-0014). Turns an APPROVED mock
// (control plane, still a lead) into a PRIVATE `provisioned` preview in the data
// plane: an isolated per-tenant snapshot served at an unguessable token URL.
//
// This is provisioning, NOT élesítés: the public go-live (`live`) is the payment
// gate and stays a manual house step in the pilot (A2). The provisioned preview is
// still demo-phase (§A / ADR-0014) — it keeps the mock's demo-framing footer and is
// marked `noindex` so it never leaks into search while private.
//
// Idempotent: re-running for the same lead reuses its tenant/site and re-renders.

import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { db } from "../db/client.js";

export interface ConversionResult {
  readonly tenantId: string;
  readonly siteId: string;
  readonly previewToken: string;
  /** Server-side snapshot path, relative to the repo root. */
  readonly previewPath: string;
  /** Public route for the private preview. */
  readonly previewUrl: string;
  readonly modules: string[];
}

/** Opaque, URL-safe token for the private preview link (prospect.token pattern). */
function makeToken(): string {
  return randomBytes(18).toString("base64url");
}

/**
 * Prepare the approved mock HTML for a PRIVATE preview: inject a robots noindex
 * meta (so the private preview never gets indexed) and a provenance marker comment.
 * The demo-framing footer is intentionally KEPT — a provisioned preview is still
 * demo-phase, not the owner's public live site (§A, ADR-0014).
 */
function toPrivatePreview(html: string, tenantId: string): string {
  const marker = `<!-- CIT provisioned preview · tenant ${tenantId} · PRIVATE, not public -->\n`;
  const withMarker = html.startsWith("<!--") ? html : marker + html;
  if (/<meta\s+name=["']robots["']/i.test(withMarker)) return withMarker;
  const noindex = `<meta name="robots" content="noindex,nofollow">`;
  if (/<head[^>]*>/i.test(withMarker)) {
    return withMarker.replace(/<head[^>]*>/i, (m) => `${m}\n  ${noindex}`);
  }
  return `${noindex}\n${withMarker}`;
}

/**
 * Convert an approved mock into a provisioned private-preview Site.
 *
 * @param leadId      the lead being converted
 * @param artifactId  the APPROVED mock_artifact to provision from
 * @param modules     entitled module ids (05-MODULES catalog: gallery|booking|…)
 */
export async function convertLead(
  leadId: string,
  artifactId: string,
  modules: string[],
): Promise<ConversionResult> {
  // 1. Validate the artifact: it must exist, belong to the lead, and be approved.
  const artifact = await db
    .selectFrom("mock_artifact")
    .select(["id", "lead_id", "status", "path"])
    .where("id", "=", artifactId)
    .executeTakeFirst();
  if (!artifact) throw new Error(`mock_artifact ${artifactId} not found`);
  if (artifact.lead_id !== leadId) {
    throw new Error(`artifact ${artifactId} does not belong to lead ${leadId}`);
  }
  if (artifact.status !== "approved") {
    throw new Error(
      `artifact ${artifactId} must be 'approved' to convert (is '${artifact.status}')`,
    );
  }
  if (!artifact.path) {
    throw new Error(`artifact ${artifactId} has no rendered path to provision`);
  }

  const lead = await db
    .selectFrom("lead")
    .select(["id", "name"])
    .where("id", "=", leadId)
    .executeTakeFirst();
  if (!lead) throw new Error(`lead ${leadId} not found`);

  // 2. Tenant — idempotent on lead_id (one tenant per lead).
  let tenant = await db
    .selectFrom("tenant")
    .select(["id"])
    .where("lead_id", "=", leadId)
    .executeTakeFirst();
  if (!tenant) {
    tenant = await db
      .insertInto("tenant")
      .values({ lead_id: leadId, display_name: lead.name })
      .returning("id")
      .executeTakeFirstOrThrow();
  }
  const tenantId = tenant.id;

  // 3. Render the private preview snapshot into the tenant's isolated namespace.
  const srcHtml = await readFile(path.resolve(process.cwd(), artifact.path), "utf8");
  const relDir = path.join("sites", tenantId);
  const relPath = path.join(relDir, "index.html");
  await mkdir(path.resolve(process.cwd(), relDir), { recursive: true });
  await writeFile(
    path.resolve(process.cwd(), relPath),
    toPrivatePreview(srcHtml, tenantId),
    "utf8",
  );

  // 4. Entitlements + site + lifecycle — one transaction.
  const wanted = [...new Set(modules.map((m) => m.trim()).filter(Boolean))];
  const site = await db.transaction().execute(async (trx) => {
    for (const module of wanted) {
      await trx
        .insertInto("module_entitlement")
        .values({ tenant_id: tenantId, module, active: true })
        .onConflict((oc) =>
          oc.columns(["tenant_id", "module"]).doUpdateSet({ active: true }),
        )
        .execute();
    }

    // Site — idempotent on tenant_id; keep the existing preview_token on re-run.
    const existing = await trx
      .selectFrom("site")
      .select(["id", "preview_token"])
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    const row = existing
      ? await trx
          .updateTable("site")
          .set({
            source_artifact_id: artifactId,
            path: relPath,
            status: "provisioned",
          })
          .where("tenant_id", "=", tenantId)
          .returning(["id", "preview_token"])
          .executeTakeFirstOrThrow()
      : await trx
          .insertInto("site")
          .values({
            tenant_id: tenantId,
            source_artifact_id: artifactId,
            path: relPath,
            status: "provisioned",
            preview_token: makeToken(),
          })
          .returning(["id", "preview_token"])
          .executeTakeFirstOrThrow();

    // Advance lifecycle to 'conversion' — but never regress a lead that already
    // moved past it (subscription/activation/…/terminal).
    await trx
      .updateTable("lead")
      .set({ lifecycle_status: "conversion" })
      .where("id", "=", leadId)
      .where("lifecycle_status", "in", [
        "qualified",
        "mock_curation",
        "outreach",
        "conversion",
      ])
      .execute();

    return row;
  });

  return {
    tenantId,
    siteId: site.id,
    previewToken: site.preview_token,
    previewPath: relPath,
    previewUrl: `/site/${site.preview_token}`,
    modules: wanted,
  };
}
