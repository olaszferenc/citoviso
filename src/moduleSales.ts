// Module sellability (owner decree 2026-09-06; frozen plan:
// assets/design-refs/console/pricing-sales/). A DISABLED module takes no NEW
// subscription anywhere a sale can start — prospect configurator, outreach-mock
// ALL-IN samples, lead conversion fallback, tenant-admin upsell — while EXISTING
// entitlements keep running untouched (the decree is about new sales, not about
// pulling a paid feature from under a paying tenant).
//
// Storage is ONE app_setting row (JSON array of module ids), not a column on
// module_price: a module with no saved price row must still be switchable, and
// a shared-DB migration is a known collision hazard between worktrees.

import { getSetting, setSetting } from "./console/appSettings.js";
import { MODULE_CATALOG } from "./modules.js";

const KEY = "module_sales_disabled";

/**
 * Seed until the operator first saves (owner, 2026-09-06): the custom-email
 * module launches NOT sellable — it goes on sale with its own marketing round.
 * Once the operator saves the page, the stored JSON governs (an explicit "[]"
 * — everything sellable — is a stored value, not a fallback to this seed).
 */
const DEFAULT_DISABLED: readonly string[] = ["email"];

/** Module ids currently NOT sellable. Unknown/spine ids are dropped defensively. */
export async function getDisabledModules(): Promise<Set<string>> {
  const raw = await getSetting(KEY);
  if (raw === null) return new Set(DEFAULT_DISABLED);
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set(DEFAULT_DISABLED);
    return new Set(
      parsed.filter(
        (id): id is string =>
          typeof id === "string" && MODULE_CATALOG.some((m) => m.id === id && !m.spine),
      ),
    );
  } catch {
    return new Set(DEFAULT_DISABLED);
  }
}

/** Persist the disabled set. The spine is never storable as disabled. */
export async function setDisabledModules(ids: readonly string[]): Promise<void> {
  const valid = [...new Set(ids)].filter((id) =>
    MODULE_CATALOG.some((m) => m.id === id && !m.spine),
  );
  // JSON.stringify([]) === "[]" is non-empty, so setSetting STORES it — an
  // all-sellable save must not fall back to the email-off seed.
  await setSetting(KEY, JSON.stringify(valid));
}

/**
 * Map disabled module ids to the mock-sample surface keys demoModuleSamples
 * uses (engine/render.ts): the ALL-IN mock must not show a sample of a module
 * we would refuse to sell (§I — no bait-and-switch, in either direction).
 * Modules with no sample surface (email, multilang, gallery…) map to nothing.
 */
export function sampleDenyKeys(disabled: ReadonlySet<string>): Set<string> {
  const keyByModule: Record<string, string> = {
    booking: "booking",
    rooms: "rooms",
    hours: "hours",
    pricing: "pricing",
    poi: "poi",
    amenities: "amenities",
    newsletter: "newsletter",
    reviews: "review-form",
    location: "map",
  };
  const deny = new Set<string>();
  for (const id of disabled) {
    const k = keyByModule[id];
    if (k) deny.add(k);
  }
  return deny;
}
