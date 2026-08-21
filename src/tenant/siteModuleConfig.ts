// Read/write access to a site's per-module configuration (ADR-0044, migration 0023).
//
// Read path  : stored row → forward-migrate to the current schema version → merge over
//              catalog + industry defaults. A module with no row still returns a fully
//              usable config, so an untouched module behaves correctly.
// Write path : validate → archive the previous row → upsert. The archive is what lets
//              an owner say "put it back the way it was" and actually get it back.
//
// Config lives on the SITE (a setting belongs to a rendered page); module_entitlement
// stays tenant-scoped because that one is billing.

import { db } from "../db/client.js";
import {
  MODULE_CONFIG_REGISTRY,
  effectiveModuleConfig,
  migrateModuleConfig,
  validateModuleConfig,
  type ModuleConfigValues,
} from "../moduleConfig.js";

export interface ModuleConfigResult {
  readonly moduleId: string;
  readonly config: ModuleConfigValues;
  /** False until the owner has saved this module at least once. */
  readonly customized: boolean;
}

/**
 * The site's industry, used for the middle default layer. It is recorded on the
 * scrape definition the lead came from: site → tenant → lead → scrape_run →
 * scraper_definition. Null for a site with no such lineage (e.g. a self-serve
 * mock request), which simply means "catalog defaults only".
 */
export async function getSiteIndustry(siteId: string): Promise<string | null> {
  const row = await db
    .selectFrom("site")
    .innerJoin("tenant", "tenant.id", "site.tenant_id")
    .innerJoin("lead", "lead.id", "tenant.lead_id")
    .innerJoin("scrape_run", "scrape_run.id", "lead.scrape_run_id")
    .innerJoin("scraper_definition", "scraper_definition.id", "scrape_run.scraper_definition_id")
    .select("scraper_definition.industry as industry")
    .where("site.id", "=", siteId)
    .executeTakeFirst();
  return row?.industry ?? null;
}

/** The effective config for one module on a site (defaults + industry + stored). */
export async function getSiteModuleConfig(
  siteId: string,
  moduleId: string,
  industry?: string | null,
): Promise<ModuleConfigResult> {
  const row = await db
    .selectFrom("site_module_config")
    .select(["version", "config"])
    .where("site_id", "=", siteId)
    .where("module", "=", moduleId)
    .executeTakeFirst();

  const ind = industry === undefined ? await getSiteIndustry(siteId) : industry;
  if (!row) {
    return { moduleId, config: effectiveModuleConfig(moduleId, null, ind), customized: false };
  }
  const stored = (row.config ?? {}) as ModuleConfigValues;
  const { config } = migrateModuleConfig(moduleId, row.version, stored);
  return { moduleId, config: effectiveModuleConfig(moduleId, config, ind), customized: true };
}

/** Effective configs for every registered module on a site, in one round trip. */
export async function getAllSiteModuleConfigs(
  siteId: string,
): Promise<Record<string, ModuleConfigResult>> {
  const rows = await db
    .selectFrom("site_module_config")
    .select(["module", "version", "config"])
    .where("site_id", "=", siteId)
    .execute();
  const stored = new Map(rows.map((r) => [r.module, r]));
  const industry = await getSiteIndustry(siteId);

  const out: Record<string, ModuleConfigResult> = {};
  for (const moduleId of Object.keys(MODULE_CONFIG_REGISTRY)) {
    const row = stored.get(moduleId);
    if (!row) {
      out[moduleId] = { moduleId, config: effectiveModuleConfig(moduleId, null, industry), customized: false };
      continue;
    }
    const { config } = migrateModuleConfig(moduleId, row.version, (row.config ?? {}) as ModuleConfigValues);
    out[moduleId] = {
      moduleId,
      config: effectiveModuleConfig(moduleId, config, industry),
      customized: true,
    };
  }
  return out;
}

export interface SaveConfigResult {
  readonly ok: boolean;
  /** Owner-facing messages when ok === false. */
  readonly errors: string[];
}

/**
 * Persist a module's config. Validates first (owner-facing messages, nothing is
 * written on failure), archives the previous row, then upserts at the registry's
 * current version. Only keys the registry knows are stored — an unexpected field
 * from a stale form never lands in the row.
 */
export async function setSiteModuleConfig(
  siteId: string,
  moduleId: string,
  values: ModuleConfigValues,
  updatedBy: string,
): Promise<SaveConfigResult> {
  const def = MODULE_CONFIG_REGISTRY[moduleId];
  if (!def) return { ok: false, errors: [`Ismeretlen modul: ${moduleId}`] };

  // Keep only known keys: declared fields plus whatever the bespoke editor owns
  // (its keys are the ones already present in the module's defaults).
  const allowed = new Set([...def.fields.map((f) => f.key), ...Object.keys(def.defaults)]);
  const clean: ModuleConfigValues = {};
  for (const [k, v] of Object.entries(values)) if (allowed.has(k)) clean[k] = v;

  const merged = { ...def.defaults, ...clean };
  const errors = validateModuleConfig(moduleId, merged);
  if (errors.length) return { ok: false, errors };

  const previous = await db
    .selectFrom("site_module_config")
    .select(["version", "config", "updated_by"])
    .where("site_id", "=", siteId)
    .where("module", "=", moduleId)
    .executeTakeFirst();

  if (previous) {
    await db
      .insertInto("site_module_config_history")
      .values({
        site_id: siteId,
        module: moduleId,
        version: previous.version,
        config: JSON.stringify(previous.config ?? {}),
        updated_by: previous.updated_by,
      })
      .execute();
  }

  await db
    .insertInto("site_module_config")
    .values({
      site_id: siteId,
      module: moduleId,
      version: def.version,
      config: JSON.stringify(clean),
      updated_by: updatedBy,
    })
    .onConflict((oc) =>
      oc.columns(["site_id", "module"]).doUpdateSet({
        version: def.version,
        config: JSON.stringify(clean),
        updated_by: updatedBy,
        updated_at: new Date(),
      }),
    )
    .execute();

  return { ok: true, errors: [] };
}

/** Is there an earlier saved version to roll back to? (Drives the UI affordance.) */
export async function hasPreviousModuleConfig(siteId: string, moduleId: string): Promise<boolean> {
  const row = await db
    .selectFrom("site_module_config_history")
    .select("id")
    .where("site_id", "=", siteId)
    .where("module", "=", moduleId)
    .executeTakeFirst();
  return Boolean(row);
}

/**
 * Roll a module back to its previously saved settings ("tegyék vissza, ahogy volt").
 * Returns false when there is nothing to roll back to.
 */
export async function restorePreviousModuleConfig(
  siteId: string,
  moduleId: string,
  updatedBy: string,
): Promise<boolean> {
  const prev = await db
    .selectFrom("site_module_config_history")
    .select(["id", "version", "config"])
    .where("site_id", "=", siteId)
    .where("module", "=", moduleId)
    .orderBy("replaced_at", "desc")
    .executeTakeFirst();
  if (!prev) return false;

  const { config } = migrateModuleConfig(moduleId, prev.version, (prev.config ?? {}) as ModuleConfigValues);
  const res = await setSiteModuleConfig(siteId, moduleId, config, updatedBy);
  return res.ok;
}
