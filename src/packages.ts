// Package composition (ADR-0360 ①②) — PURE logic, no DB. pricing.ts owns the loaded
// state and the persistence; this file answers "what does each tier contain?", "is this
// assignment valid?" and "does this module set carry the domain?" from an assignment map.
//
// The model: every module sits in AT MOST ONE tier — the LOWEST one that carries it — and
// the higher tiers inherit it. That makes the owner rule "ami az alacsonyabb csomagban
// benne van, az benne van a magasabb csomagban is" (2026-09-07) structural: there is no
// list to edit that could break it. The 'domain' pseudo-module may sit in a tier too; a
// module set that covers that tier's contents carries the domain as package content.

import { MODULE_CATALOG, PRESETS, applicableRequirements, subscriptionModules, type Preset } from "./modules.js";

export const TIERS = ["alap", "ajanlott", "teljes"] as const;
export type Tier = (typeof TIERS)[number];

/** The pseudo-module id that stands for "own domain through us" inside a package. */
export const DOMAIN_PSEUDO_MODULE = "domain";

/** module id → the lowest tier carrying it. */
export type PackageAssignment = ReadonlyMap<string, Tier>;

const TIER_META: Record<Tier, { label: string; note: string }> = Object.fromEntries(
  PRESETS.map((p) => [p.id, { label: p.label, note: p.note }]),
) as Record<Tier, { label: string; note: string }>;

export function isTier(v: unknown): v is Tier {
  return typeof v === "string" && (TIERS as readonly string[]).includes(v);
}

export function tierIndex(t: Tier): number {
  return TIERS.indexOf(t);
}

/** The code seed: each module's lowest tier in the built-in PRESETS (no domain). */
export function seedAssignment(): Map<string, Tier> {
  const out = new Map<string, Tier>();
  for (const t of TIERS) {
    const p = PRESETS.find((x) => x.id === t);
    for (const id of p?.modules ?? []) if (!out.has(id)) out.set(id, t);
  }
  return out;
}

/** Every module id a tier carries (own + inherited), catalog order, domain excluded. */
export function tierModules(a: PackageAssignment, tier: Tier): string[] {
  const ti = tierIndex(tier);
  return MODULE_CATALOG.filter((m) => {
    const t = a.get(m.id);
    return t !== undefined && tierIndex(t) <= ti;
  }).map((m) => m.id);
}

/** Does this tier (own + inherited) carry the domain pseudo-module? */
export function tierHasDomain(a: PackageAssignment, tier: Tier): boolean {
  const t = a.get(DOMAIN_PSEUDO_MODULE);
  return t !== undefined && tierIndex(t) <= tierIndex(tier);
}

/** The lowest tier that carries the domain, or null. */
export function domainTier(a: PackageAssignment): Tier | null {
  return a.get(DOMAIN_PSEUDO_MODULE) ?? null;
}

/** The three tiers as Preset objects (the shape the configurator / console read). */
export function presetsFrom(a: PackageAssignment): Preset[] {
  // Largest first, like the seed (the configurator lists "Teljes" as the default anchor).
  return [...TIERS].reverse().map((t) => ({
    id: t,
    label: TIER_META[t].label,
    note: TIER_META[t].note,
    modules: tierModules(a, t),
  }));
}

/**
 * Does `moduleIds` carry the domain as package content? True when it covers EVERY module
 * of the lowest domain-carrying tier — so a custom ("egyedi") set qualifies too, as long
 * as it buys at least that much. Modules that are off sale do not count against the set
 * (they cannot be bought), the spine is always implied.
 */
export function coversDomainTier(
  a: PackageAssignment,
  moduleIds: Iterable<string>,
  disabled: ReadonlySet<string> = new Set(),
): boolean {
  const t = domainTier(a);
  if (!t) return false;
  const have = new Set(moduleIds);
  return tierModules(a, t).every((id) => {
    const m = MODULE_CATALOG.find((x) => x.id === id);
    return m?.spine || disabled.has(id) || have.has(id);
  });
}

/** Ids a package may carry: the subscription modules (no one-off, tenant-only or retired
 *  module — the configurator does not sell those either) and the domain. */
export function packageableIds(): string[] {
  return [...subscriptionModules().map((m) => m.id), DOMAIN_PSEUDO_MODULE];
}

export type PackageError =
  | { kind: "unknown"; module: string }
  | { kind: "spine"; module: string }
  | { kind: "dependency"; module: string; requires: string; tier: Tier; requiredTier: Tier | null };

/**
 * Why an assignment cannot be saved (empty = valid):
 *  · an id a package cannot carry (see packageableIds);
 *  · the spine anywhere but the lowest tier (it is in every package by definition);
 *  · a HARD requirement (ADR-0192) sitting in a higher tier than its dependant, or in none —
 *    the dependant's tier would sell a broken set.
 */
export function packageAssignmentErrors(a: PackageAssignment): PackageError[] {
  const errs: PackageError[] = [];
  for (const [id, tier] of a) {
    if (id === DOMAIN_PSEUDO_MODULE) continue;
    const m = subscriptionModules().find((x) => x.id === id);
    if (!m) {
      errs.push({ kind: "unknown", module: id });
      continue;
    }
    for (const r of applicableRequirements(id)) {
      if (r.strength !== "hard") continue;
      const rt = a.get(r.id) ?? null;
      if (rt === null || tierIndex(rt) > tierIndex(tier))
        errs.push({ kind: "dependency", module: id, requires: r.id, tier, requiredTier: rt });
    }
  }
  for (const m of MODULE_CATALOG) if (m.spine && a.get(m.id) !== "alap") errs.push({ kind: "spine", module: m.id });
  return errs;
}

/** Parse the console's posted JSON ({moduleId: tier}) — null when it is not that shape. */
export function parsePackageAssignment(raw: string | null): Map<string, Tier> | null {
  if (raw === null) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const out = new Map<string, Tier>();
    for (const [k, t] of Object.entries(v as Record<string, unknown>)) {
      if (typeof k !== "string" || !k || k.length > 40) return null;
      if (!isTier(t)) return null;
      out.set(k, t);
    }
    return out;
  } catch {
    return null;
  }
}
