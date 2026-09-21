// Tenant-facing module management (ADR-0034). The paying owner sees WHAT the subscription
// includes and can switch modules on/off themselves — instead of the pilot's "write us an
// e-mail" card. Entitlements are the billing truth (module_entitlement); the rendered page
// still comes from the site's recipe, so a newly enabled module shows up on the next
// re-render/publish — the UI says so honestly rather than implying instant layout change.

import { db } from "../db/client.js";
import { MODULE_CATALOG, supersederOf, type ModuleGroup } from "../modules.js";
import { getDisabledModules } from "../moduleSales.js";
import { getBaseMonthly, getModulePrice, loadPricing } from "../pricing.js";

export interface TenantModule {
  readonly id: string;
  readonly label: string;
  /** ADR-0089 shop card: what the module DOES, in the owner's words (catalog copy). */
  readonly publicDesc: string;
  readonly group: ModuleGroup;
  /** Included in the base price and not switchable (the enquiry spine). */
  readonly spine: boolean;
  readonly active: boolean;
  readonly priceMonthly: number;
  /**
   * Id of an active module that REPLACES this one, or null. They share a slot, so
   * the superseded one does not render and is not billed — see supersederOf().
   */
  readonly supersededBy: string | null;
  /** ADR-0080 ③: cancelled — active until the period end, then drops off. */
  readonly cancelAtPeriodEnd: boolean;
  /** ADR-0080 ② (B-opció): live now, first fee on the next renewal invoice. */
  readonly awaitingFirstCharge: boolean;
}

export interface TenantModuleView {
  readonly modules: TenantModule[];
  readonly baseMonthly: number;
  /** base + every active non-spine module. */
  readonly totalMonthly: number;
}

/**
 * Is this module a line on the NEXT invoice?
 *
 * ⛔ ONE definition, because three places used to answer it and two of them were
 * wrong. "Billed" is not "active": the spine rides in the base fee, a superseded
 * module renders nothing (charging for it would be charging for nothing), a module
 * cancelled for the period end is still live but will not be re-invoiced, and a
 * one-off product is not a recurring line at all.
 *
 * Measured 2026-09-12 with those copies out of sync: the Modulok summary said
 * 60 700 Ft while "Következő számla" said 53 800 Ft on the SAME screen, and the
 * Áttekintés tile counted 6 billed modules against the summary's 5. Anything that
 * needs this answer calls THIS function.
 */
export function isBilledModule(m: TenantModule): boolean {
  return (
    m.active &&
    !m.spine &&
    !m.supersededBy &&
    !m.cancelAtPeriodEnd &&
    MODULE_CATALOG.some((c) => c.id === m.id && c.billing !== "once")
  );
}

/**
 * Which `moduleContentFor()` fields actually got content.
 *
 * ⛔ A SET OF FIELD NAMES, not the ModuleContent object: importing the editor's type
 * here would be circular (the editor imports getTenantModules from this file), and
 * casting the interface to an index signature is the kind of `as unknown as` that
 * hides a real mismatch. Build it with filledContentFields() below.
 */
export type FilledContentFields = ReadonlySet<string>;

/**
 * The fields a `moduleContentFor()` result actually filled.
 *
 * A field is only ever set when the module produced something (`if (items.length)
 * out.poi = items`), so presence IS the renderer's own "will this show up" answer.
 * The undefined-filter is belt-and-braces for anyone who later writes a key
 * unconditionally — an explicitly-undefined key must not read as content.
 */
export function filledContentFields(content: object): FilledContentFields {
  return new Set(
    Object.entries(content)
      .filter(([, v]) => v !== undefined)
      .map(([k]) => k),
  );
}

/**
 * Modules with a REAL empty state, paired with the ModuleContent field that proves it.
 *
 * ⛔ THE PAIR IS EXPLICIT ON PURPOSE. Module id and content field happen to match for
 * all five today, but the mapping is NOT guaranteed: `usp` writes its items into the
 * template's highlights (weave), so an empty `usp` field does not mean the tenant sees
 * nothing — which is exactly why usp is NOT on this list. Deriving the field from the
 * id would have silently added it.
 *
 * ⛔ FOUR MODULES ARE DELIBERATELY ABSENT because they always render something, so
 * "empty" is not a state they can be in and a to-do row would be a false alarm:
 * `booking` (sample calendar fallback), `location` (renders from geo or the address),
 * `reviews` (pending block when there are no reviews yet), `enquiry` (spine).
 * `gallery` is absent too — its content is the photo list, which the Fotók to-do
 * already covers.
 */
const EMPTIABLE_MODULES: ReadonlyArray<readonly [moduleId: string, contentField: string]> = [
  ["pricing", "pricing"],
  ["poi", "poi"],
  ["hours", "hours"],
  ["amenities", "amenities"],
  ["rooms", "rooms"],
];

/**
 * Modules the tenant PAYS for that put nothing on the live page.
 *
 * The measured hole (2026-09-21, on the owner's own tenant): three modules were bought
 * for 14 775 Ft; `booking` had content and rendered, `pricing` and `poi` were empty and
 * therefore absent from the live HTML entirely — "Árak" and "A környéken" each appeared
 * 0 times on the published page. Nothing in the admin said so: the Teendők list only
 * ever spoke about photos, intro text and publication.
 *
 * ⛔ THE EMPTINESS TEST IS THE RENDERER'S OWN: we read the very `moduleContentFor()`
 * output the page is built from, not a second heuristic like "is there a
 * site_module_config row". A config row can exist with an empty items array, and the
 * renderer would still show nothing — a guard asking the other question would have
 * passed while the customer saw a blank.
 */
export function paidButEmptyModules(
  mv: TenantModuleView,
  filled: FilledContentFields,
): readonly TenantModule[] {
  return mv.modules.filter((m) => {
    const pair = EMPTIABLE_MODULES.find(([id]) => id === m.id);
    if (!pair) return false;
    // Billed, not merely active: a superseded or cancelled module is not something
    // the tenant is paying for right now, so it must not be dunned about.
    return isBilledModule(m) && !filled.has(pair[1]);
  });
}

/** The full catalog with this tenant's active flags + current prices. */
export async function getTenantModules(tenantId: string): Promise<TenantModuleView> {
  await loadPricing();
  const disabledSales = await getDisabledModules();
  const rows = await db
    .selectFrom("module_entitlement")
    .select(["module", "active", "cancel_at_period_end", "awaiting_first_charge"])
    .where("tenant_id", "=", tenantId)
    .execute();
  const activeIds = new Set(rows.filter((r) => r.active).map((r) => r.module));
  const cancelIds = new Set(
    rows.filter((r) => r.active && r.cancel_at_period_end).map((r) => r.module),
  );
  const awaitingIds = new Set(
    rows.filter((r) => r.active && r.awaiting_first_charge).map((r) => r.module),
  );

  // Everything currently switched on, spine included — the input for supersession.
  const effectiveIds = new Set<string>(activeIds);
  for (const m of MODULE_CATALOG) if (m.spine) effectiveIds.add(m.id);

  // One-time/tenant-only modules (ADR-0063: multilang) are NOT in this toggle
  // list: toggling here is free, but a 'once' module is activated by a PAID
  // generation on its own dedicated admin surface.
  // Module-sales switch (owner decree 2026-09-06): a disabled module is hidden
  // from the tenant UNLESS they already hold it (existing subscriptions keep
  // running and stay manageable — the decree blocks NEW sales only).
  const modules: TenantModule[] = MODULE_CATALOG.filter(
    (m) => m.billing !== "once" && (m.spine || activeIds.has(m.id) || !disabledSales.has(m.id)),
  ).map((m) => ({
    id: m.id,
    label: m.publicLabel,
    publicDesc: m.publicDesc,
    group: m.group,
    spine: Boolean(m.spine),
    // The spine (enquiry) is always on — it is the conversion backbone, in the base
    // price — UNLESS a bought module replaces it (booking takes over its slot).
    active: Boolean(m.spine) || activeIds.has(m.id),
    priceMonthly: getModulePrice(m.id),
    supersededBy: supersederOf(m.id, effectiveIds),
    cancelAtPeriodEnd: cancelIds.has(m.id),
    awaitingFirstCharge: awaitingIds.has(m.id),
  }));
  const baseMonthly = getBaseMonthly();
  // A replaced module is never billed: the page cannot show it, so charging for it
  // would be selling nothing.
  const totalMonthly = modules
    .filter((m) => m.active && !m.spine && !m.supersededBy)
    .reduce((sum, m) => sum + m.priceMonthly, baseMonthly);
  return { modules, baseMonthly, totalMonthly };
}

/**
 * Is this module LIVE on the guest's page — i.e. may its content leave the building?
 *
 * ⛔ ONE definition, for the same reason isBilledModule() above has one. "Rendered" is
 * not "active": a superseded module shares its slot with the module that replaced it,
 * so it shows nothing. A cancelled-for-the-period-end module IS still rendered — the
 * tenant paid for it until the renewal date, and gating it the moment they click
 * "lemondom" would take away what they already bought.
 *
 * Measured 2026-09-21 (ADR-0192 ②) with this question answered in ONE place only (the
 * renderer): `/api/foglaltsag` and createBookingRequest never asked it, so a tenant who
 * cancelled `pricing` had the price vanish from the PAGE while the booking widget kept
 * calculating and the request froze an 84 000 Ft quote into the guest's mail. Anything
 * that needs this answer calls THIS function.
 */
export function isRenderedModule(m: TenantModule): boolean {
  return m.active && !m.supersededBy;
}

/** isRenderedModule() asked by tenant + module id. */
export async function tenantRendersModule(tenantId: string, moduleId: string): Promise<boolean> {
  const mv = await getTenantModules(tenantId);
  const m = mv.modules.find((x) => x.id === moduleId);
  return Boolean(m && isRenderedModule(m));
}

/**
 * The same question asked from a SITE id — the public surfaces (availability endpoint,
 * booking request) only ever know which site they serve, and resolving the tenant at
 * each call site is exactly how the second, divergent copy gets written.
 */
export async function siteRendersModule(siteId: string, moduleId: string): Promise<boolean> {
  const row = await db
    .selectFrom("site")
    .select("tenant_id")
    .where("id", "=", siteId)
    .executeTakeFirst();
  return row ? tenantRendersModule(row.tenant_id, moduleId) : false;
}

/**
 * Apply the tenant's module selection. `wanted` = module ids the owner wants active; every
 * other catalog module is deactivated. The spine is never touched. Unknown ids are ignored
 * (the catalog is the single source of truth). Idempotent.
 */
export async function setTenantModules(tenantId: string, wanted: string[]): Promise<void> {
  const want = new Set(wanted.filter((id) => MODULE_CATALOG.some((m) => m.id === id)));
  for (const m of MODULE_CATALOG) {
    if (m.spine) continue; // always-on, never billed separately
    // ADR-0063: a 'once' module's entitlement is written by the PAID generation
    // flow only — this free toggle path must never grant or revoke it.
    if (m.billing === "once") continue;
    const active = want.has(m.id);
    await db
      .insertInto("module_entitlement")
      .values({ tenant_id: tenantId, module: m.id, active })
      .onConflict((oc) => oc.columns(["tenant_id", "module"]).doUpdateSet({ active }))
      .execute();
  }
}
