// ADR-0364 (B1, Elek 10-11) — WHAT the trial gives, in words, from ONE source.
//
// ADR-0360 ⑥ made the trial's contents a parameter (/pricing „A próbázó ezt kapja”), but
// three surfaces kept the old rule as fixed text: the trial form („14 napig minden funkció:
// foglalási naptár, …”), the login letter („minden modul be van kapcsolva”) and the admin
// Modulok tab. With the Ajánlott package configured the trialist was promised a booking
// calendar the trial never switched on (measured: 7 entitlements, the letter said „all”).
//
// ⛔ The promise is computed from the SAME list the grant is: trialModuleIds() for a trial
// about to start (startTrial grants exactly that), the tenant's trial_grant rows for a
// running one. A surface that writes its own list is how the two drifted.
//
// `everything` = the trial covers every module we sell (the pre-ADR-0360 rule, or a top
// package that holds them all) — only then may a surface keep the „minden funkció” wording.
// One-off modules (multilang: a generation, not a switch) are never listed: the trial does
// not generate a translation, so naming it would be the same overclaim.

import { db } from "../db/client.js";
import { MODULE_CATALOG, orderPresetId } from "../modules.js";
import { isTier, tierModules, type Tier } from "../packages.js";
import { currentPresets, getPackageAssignment, loadPricing } from "../pricing.js";
import { getFreeTrialConfig } from "./config.js";

/** Every module the trial grants (startTrial grants exactly this list). */
export function trialModuleIds(pkg?: Tier): string[] {
  // ADR-0360 ⑥: the configured package's contents (own + inherited, spine included);
  // without one, the pre-ADR rule — every non-retired catalog module (owner, 2026-10-09:
  // "FULL funkció", the translation module included).
  if (pkg) return tierModules(getPackageAssignment(), pkg);
  return MODULE_CATALOG.filter((m) => !m.retired).map((m) => m.id);
}

export interface TrialPackage {
  /** The tier whose contents the trial matches exactly; null = no tier matches. */
  readonly tier: Tier | null;
  /** That tier's label (untranslated — the renderer runs it through T()/tr()). */
  readonly label: string | null;
  /** The granted modules a person can see working, catalog order (one-off/retired left out). */
  readonly moduleIds: readonly string[];
  /** Every module we sell is in it — the only case the „minden funkció” wording is true. */
  readonly everything: boolean;
}

/** The modules a trial can promise by name: sold (not retired), switch-like (not one-off). */
function promisable(): readonly (typeof MODULE_CATALOG)[number][] {
  return MODULE_CATALOG.filter((m) => !m.retired && m.billing !== "once");
}

/** Pure: a granted module list → the words. `hint` = the configured tier, preferred on a tie. */
export function describeTrialModules(granted: readonly string[], hint?: Tier | null): TrialPackage {
  const have = new Set(granted);
  const shown = promisable().filter((m) => have.has(m.id));
  const everything = promisable().every((m) => have.has(m.id));
  const presets = currentPresets();
  const id = orderPresetId(
    granted.filter((g) => promisable().some((m) => m.id === g)),
    hint ?? null,
    presets.map((p) => ({ ...p, modules: p.modules.filter((g) => promisable().some((m) => m.id === g)) })),
  );
  const tier = isTier(id) ? id : null;
  return {
    tier,
    label: tier ? (presets.find((p) => p.id === tier)?.label ?? null) : null,
    moduleIds: shown.map((m) => m.id),
    everything,
  };
}

/** What a trial started NOW would get — the trial form and the login letter read this. */
export async function configuredTrialPackage(): Promise<TrialPackage> {
  await loadPricing();
  const pkg = (await getFreeTrialConfig()).package;
  return describeTrialModules(trialModuleIds(pkg), pkg ?? null);
}

/** What THIS tenant's trial got (its trial_grant rows) — the admin reads this. */
export async function tenantTrialPackage(tenantId: string): Promise<TrialPackage> {
  await loadPricing();
  const rows = await db
    .selectFrom("module_entitlement")
    .select("module")
    .where("tenant_id", "=", tenantId)
    .where("trial_grant", "=", true)
    .execute();
  return describeTrialModules(rows.map((r) => r.module), (await getFreeTrialConfig()).package ?? null);
}

/** Catalog lookup for a renderer: the tenant/lead-facing name of a module (untranslated). */
export function trialModuleLabel(id: string): string {
  return MODULE_CATALOG.find((m) => m.id === id)?.publicLabel ?? id;
}

/** The letter's view of a package: null = everything (the „minden modul” wording stays). */
export function trialPackageView(p: TrialPackage): { label: string | null; modules: string[] } | null {
  return p.everything ? null : { label: p.label, modules: p.moduleIds.map(trialModuleLabel) };
}
