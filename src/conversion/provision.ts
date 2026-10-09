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
import { RESERVED_SLUGS, slugify } from "../domains.js";
import { labelHeldByOther, releasePreviewLabelUnlessKept } from "../outreach/previewLabel.js";
import { defaultTimeZoneForCountry } from "../text/zoneTime.js";
import type { Recipe, SiteData } from "../engine/recipe.js";
import { renderSite } from "../engine/render.js";
import { renderableModules, unboughtPageAnchors } from "../modules.js";
import { dropNeverShown, photoUrlKey, readCachedScores } from "../generator/heroPick.js";
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
async function renderSnapshotHtml(
  artifact: {
    path: string | null;
    inputs: Record<string, unknown>;
  },
  /** Entitled module ids — the preview shows only what was bought (LV-1). */
  modules: readonly string[],
): Promise<{ html: string; source: "engine" | "copy" }> {
  const inputs = artifact.inputs ?? {};
  if (inputs.engine === "composition" && inputs.recipe && inputs.siteData) {
    const recipe = inputs.recipe as unknown as Recipe;
    const stored = inputs.siteData as unknown as SiteData;
    // A pillanatkép BEFAGYOTT fotó-listát hoz: egy régebbi generálás halmazát, amiben még
    // benne ülhet olyan kép, amit azóta (vagy akkor is, csak nem használtuk ki) `ad_banner`-nek
    // ítéltünk. Az élesítés az UTOLSÓ pont, ahol ez megfogható — innen már a vendég és a
    // Google olvassa. Cache-ből dolgozik, tehát ingyen és hálózat nélkül.
    const scores = await readCachedScores((stored.photos ?? []).map((p) => p.url));
    const shown = dropNeverShown(stored.photos ?? [], scores);
    for (const d of shown.dropped) {
      console.log(`  ⛔ élesítés: kihagyva a lapról [${d.verdict.subject}] ${d.photo.url} — ${d.verdict.reason}`);
    }
    // ⚠️ §A.2 LEFEDETTSÉG — itt a HALLGATÁS a veszélyes. Ez az út SZÁNDÉKOSAN cache-ből
    // dolgozik (élesítéskor nem indítunk fizetős hívást), a vízjel-ítélet viszont csak a
    // `v3-watermark` prompt-verzió óta létezik. Egy KORÁBBAN legyártott mock pillanatképénél
    // tehát nincs verdikt — és verdikt nélkül a kép bélyeg nélkül megy tovább, vagyis a §A.2
    // „feltétlen kizárás"-a ezeken a lapokon NEM tud érvényesülni.
    // A vevőt nem büntetjük érte (a mi lemaradásunk nem lelet a fotóról, és egy fizető ügyfél
    // élesítését egy hiányzó ítélet nem tagadhatja meg) — de KIMONDJUK, mert egy néma
    // lefedettségi lyuk pontosan úgy néz ki, mint a siker.
    const unjudged = shown.kept.filter((p) => !scores.has(photoUrlKey(p.url)));
    if (unjudged.length > 0) {
      console.warn(
        `  ⚠️ élesítés: ${unjudged.length}/${shown.kept.length} fotónak NINCS vision-ítélete ` +
          `(korábbi prompt-verzió) — a §A.2 vízjel-kizárás ezeken NEM futott le. ` +
          `Feloldás: npx tsx scripts/rescore-photo-verdicts.mts --go`,
      );
    }
    const siteData: SiteData = { ...stored, photos: shown.kept };
    // LIVE phase: sample-capable modules (rooms/reviews) with no real data are dropped —
    // marked sample content never reaches a live tenant page (§B.17).
    // LV-1: and nothing the buyer did not order — the same cut the tenant snapshot makes.
    const renders = new Set(renderableModules(modules));
    const hideAnchors = unboughtPageAnchors((id) => renders.has(id));
    const hideGallery = !renders.has("gallery");
    return {
      html: await injectRuntime(
        renderSite(recipe, siteData, { phase: "live", hideAnchors, hideGallery }),
        siteData.lang,
        "live",
      ),
      source: "engine",
    };
  }
  if (!artifact.path) throw new Error("legacy artifact has no rendered path to provision");
  const copied = await readFile(path.resolve(process.cwd(), artifact.path), "utf8");
  return { html: copied, source: "copy" };
}

/** Opaque, URL-safe token for the private preview link (prospect.token pattern). */
function makeToken(): string {
  return randomBytes(18).toString("base64url");
}


/** A platform subdomain label unique across sites (case-insensitive, 0017). A `preferred`
 *  label (the buyer's free choice, ADR-0032) is honored when it normalizes cleanly, is not
 *  reserved, and is still free — otherwise the lead's own preview label (ADR-0330: the
 *  address the outreach link already showed them), then the name-derived base.
 *  "Free" also means: not another lead's preview label (labelHeldByOther). */
async function uniqueSiteSlug(
  businessName: string,
  preferred: string | null | undefined,
  leadId: string,
  previewLabel: string | null,
): Promise<string> {
  for (const wish of [preferred, previewLabel]) {
    if (!wish) continue;
    const p = slugify(wish).slice(0, 40);
    if (p && p.length >= 3 && !RESERVED_SLUGS.has(p) && !(await labelHeldByOther(p, leadId))) return p;
  }
  const base = slugify(businessName).slice(0, 40) || "oldalam";
  for (let i = 0; i < 100; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    if (RESERVED_SLUGS.has(candidate)) continue;
    if (!(await labelHeldByOther(candidate, leadId))) return candidate;
  }
  return `${base}-${randomBytes(3).toString("hex")}`;
}

/**
 * The platform slug this lead's site has, or WOULD get from convertLead without a buyer
 * choice — the ONE rule the page's promised address reads (ADR-0343 ②: the trial entry's
 * `trial.sub`, and the configurator's default subdomain). Read-only.
 *
 * Measured 2026-10-09 (scripts/free-trial-check.mts ⑩): the /p page showed the raw
 * `lead.preview_label ?? slugify(name)`, while provisioning skips a label another site
 * already holds and clips to 40 — a label-less lead whose name slug was taken was promised
 * `<name>.citoviso.com` and given `<name>-2`. Same function now on both sides; the only
 * gap left is a race (another site taking the slug between page load and submit).
 */
export async function plannedSiteSlug(leadId: string): Promise<string | null> {
  const lead = await db.selectFrom("lead").select(["name", "preview_label"]).where("id", "=", leadId).executeTakeFirst();
  if (!lead) return null;
  // An existing site keeps its slug (convertLead never re-slugs a site row).
  const site = await db
    .selectFrom("site")
    .innerJoin("tenant", "tenant.id", "site.tenant_id")
    .select("site.slug")
    .where("tenant.lead_id", "=", leadId)
    .executeTakeFirst();
  if (site?.slug) return site.slug;
  return uniqueSiteSlug(lead.name, null, leadId, lead.preview_label);
}

/** Preliminary availability of a buyer-chosen subdomain label (ADR-0032). Normalizes the
 *  input, rejects too-short/reserved/taken labels. Preliminary: the DB check races with
 *  concurrent provisioning, so the final uniqueness is re-decided at provision time.
 *  ADR-0330: another lead's preview label is taken; the buyer's OWN one is free. */
export async function checkSubdomainAvailable(
  label: string,
  leadId: string | null = null,
): Promise<{ ok: boolean; normalized: string; reason?: string }> {
  const normalized = slugify(label).slice(0, 40);
  if (!normalized) return { ok: false, normalized: "", reason: "Adjon meg legalább egy betűt vagy számot." };
  if (normalized.length < 3) return { ok: false, normalized, reason: "Legalább 3 karakter kell." };
  if (RESERVED_SLUGS.has(normalized)) return { ok: false, normalized, reason: "Ez a név fenntartott." };
  if (await labelHeldByOther(normalized, leadId)) return { ok: false, normalized, reason: "Ez az aldomain már foglalt." };
  return { ok: true, normalized };
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
  // ADR-0032: the buyer's freely-chosen platform subdomain label; honored on FIRST provision
  // if clean+free (else name-derived). Only applies when the site row is first created.
  preferredSlug?: string | null,
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
    .select(["id", "name", "preview_label"])
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
    // ADR-0290: the accommodation starts in its country's zone (the scrape area's
    // country — the same source the market gate uses); the owner can change it.
    const origin = await db
      .selectFrom("lead")
      .innerJoin("scrape_run", "scrape_run.id", "lead.scrape_run_id")
      .innerJoin("scraper_definition", "scraper_definition.id", "scrape_run.scraper_definition_id")
      .select("scraper_definition.country")
      .where("lead.id", "=", leadId)
      .executeTakeFirst();
    tenant = await db
      .insertInto("tenant")
      .values({
        lead_id: leadId,
        display_name: lead.name,
        time_zone: defaultTimeZoneForCountry(origin?.country),
      })
      .returning("id")
      .executeTakeFirstOrThrow();
  }
  const tenantId = tenant.id;

  // 3. Render the private preview snapshot into the tenant's isolated namespace.
  //    ENGINE artifacts are re-rendered from persisted recipe+data (mock=live); legacy
  //    AI-HTML artifacts copy their snapshot.
  const wanted = [...new Set(modules.map((m) => m.trim()).filter(Boolean))];
  const { html: srcHtml, source: renderSource } = await renderSnapshotHtml(artifact, wanted);
  const relDir = path.join("sites", tenantId);
  const relPath = path.join(relDir, "index.html");
  await mkdir(path.resolve(process.cwd(), relDir), { recursive: true });
  await writeFile(
    path.resolve(process.cwd(), relPath),
    toPrivatePreview(srcHtml, tenantId),
    "utf8",
  );

  // 4. Entitlements + site + lifecycle — one transaction.
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
            slug: await uniqueSiteSlug(lead.name, preferredSlug, leadId, lead.preview_label),
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

  // ADR-0330 (owner, 2026-10-05): the preview subdomain the outreach link showed stays
  // only if it became this site's address; a buyer who chose another one releases it.
  const finalSlug = await db.selectFrom("site").select("slug").where("id", "=", site.id).executeTakeFirst();
  await releasePreviewLabelUnlessKept(leadId, finalSlug?.slug ?? null);

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
