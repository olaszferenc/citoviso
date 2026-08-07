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

import { sql } from "kysely";

import { db } from "../db/client.js";
import { slugify } from "../domains.js";
import type { Recipe, SiteData } from "../engine/recipe.js";
import { renderSite } from "../engine/render.js";
import { injectRuntime } from "../generator/runtime.js";

export interface ConversionResult {
  readonly tenantId: string;
  readonly siteId: string;
  readonly previewToken: string;
  /** Server-side snapshot path, relative to the repo root. */
  readonly previewPath: string;
  /** Public route for the private preview. */
  readonly previewUrl: string;
  readonly modules: string[];
  /** How the live snapshot was produced: engine re-render (mock=live) or legacy HTML copy. */
  readonly renderSource: "engine" | "copy";
}

/**
 * Produce the live snapshot HTML for an artifact. ENGINE artifacts (ADR-0016) are
 * re-rendered from their persisted recipe + SiteData — so the live page is the SAME
 * deterministic output as the approved mock (mock=live), not a stale HTML copy. Legacy
 * AI-HTML artifacts fall back to copying their rendered snapshot (backward compatible).
 */
async function renderSnapshotHtml(artifact: {
  path: string | null;
  inputs: Record<string, unknown>;
}): Promise<{ html: string; source: "engine" | "copy" }> {
  const inputs = artifact.inputs ?? {};
  if (inputs.engine === "composition" && inputs.recipe && inputs.siteData) {
    const recipe = inputs.recipe as unknown as Recipe;
    const siteData = inputs.siteData as unknown as SiteData;
    // LIVE phase: sample-capable modules (rooms/reviews) with no real data are dropped —
    // marked sample content never reaches a live tenant page (§B.17).
    return { html: await injectRuntime(renderSite(recipe, siteData, { phase: "live" })), source: "engine" };
  }
  if (!artifact.path) throw new Error("legacy artifact has no rendered path to provision");
  const copied = await readFile(path.resolve(process.cwd(), artifact.path), "utf8");
  return { html: copied, source: "copy" };
}

/** Opaque, URL-safe token for the private preview link (prospect.token pattern). */
function makeToken(): string {
  return randomBytes(18).toString("base64url");
}

/** Reserved subdomain labels that must never become a tenant host (they are ours). */
const RESERVED_SLUGS = new Set([
  "www", "admin", "api", "app", "mail", "smtp", "imap", "console", "static",
  "assets", "cdn", "help", "support", "status", "blog", "shop", "test", "dev",
]);

/** A platform subdomain label unique across sites (case-insensitive, 0017). */
async function uniqueSiteSlug(businessName: string): Promise<string> {
  const base = slugify(businessName).slice(0, 40) || "oldalam";
  for (let i = 0; i < 100; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    if (RESERVED_SLUGS.has(candidate)) continue;
    const taken = await db
      .selectFrom("site")
      .select("id")
      .where(sql<boolean>`lower(slug) = ${candidate}`)
      .executeTakeFirst();
    if (!taken) return candidate;
  }
  return `${base}-${randomBytes(3).toString("hex")}`;
}

/**
 * Prepare the snapshot HTML for a PRIVATE preview: force a robots noindex meta
 * (so the private preview never gets indexed) and add a provenance marker comment.
 * A provisioned preview is still demo-phase (§A, ADR-0014): demo photos may stay,
 * guarded by the noindex + unguessable token. (Engine renders carry no demo-framing
 * footer — the legacy copied-mock path keeps the one baked into its HTML.)
 */
export function toPrivatePreview(html: string, tenantId: string): string {
  const marker = `<!-- CIT provisioned preview · tenant ${tenantId} · PRIVATE, not public -->\n`;
  const withMarker = html.startsWith("<!--") ? html : marker + html;
  const noindex = `<meta name="robots" content="noindex,nofollow">`;
  // An engine render at phase "live" already carries an INDEXING robots meta (seo.ts) —
  // it must be REPLACED, not kept: a private preview is never indexable (ADR-0014).
  if (/<meta\s+name=["']robots["'][^>]*>/i.test(withMarker)) {
    return withMarker.replace(/<meta\s+name=["']robots["'][^>]*>/i, noindex);
  }
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
    .select(["id", "lead_id", "status", "path", "inputs"])
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
  //    ENGINE artifacts are re-rendered from persisted recipe+data (mock=live); legacy
  //    AI-HTML artifacts copy their snapshot.
  const { html: srcHtml, source: renderSource } = await renderSnapshotHtml(artifact);
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
            // Public host identity (0017): assigned ONCE, then stable — it is a
            // public URL, so a later rename must not move the live site.
            slug: await uniqueSiteSlug(lead.name),
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
    renderSource,
  };
}
