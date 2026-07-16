// Shared module catalog (05-MODULES.md) — single source of truth for the module
// ids that appear in BOTH the operator convert form (console/views.ts) and the
// prospect-facing configurator (generator/configurator.ts). The ids MUST match
// the `module_entitlement.module` values written by convertLead (provision.ts):
// keep this list and the entitlement writes in lockstep.
//
// `domType` — when set, the module is considered PRESENT in a mock if the mock
// carries a `data-cit-module="<domType>"` slot (the hydrated runtime anchor,
// ADR-0011). Present modules toggle live (client-side show/hide); the rest are
// offered as clearly-marked SAMPLE state in the pre-payment preview (§B.17).

export interface ModuleDef {
  /** Catalog id — matches module_entitlement.module. */
  readonly id: string;
  /** Human label (Hungarian, pilot). */
  readonly label: string;
  /** Backbone module — pre-checked in the convert form. */
  readonly spine?: boolean;
  /** data-cit-module anchor value that marks this module present in a mock. */
  readonly domType?: string;
}

export const MODULE_CATALOG: readonly ModuleDef[] = [
  { id: "gallery", label: "Galéria (valós fotók)", domType: "gallery" },
  { id: "rooms", label: "Szobák / apartmanok" },
  { id: "amenities", label: "Felszereltség" },
  { id: "pricing", label: "Árak / szezonok" },
  { id: "enquiry", label: "Érdeklődés-CTA (gerinc)", spine: true, domType: "booking" },
  { id: "location", label: "Térkép / megközelítés", domType: "map" },
  { id: "booking", label: "Foglalás (upsell)" },
  { id: "hours", label: "Nyitvatartás / be-kijelentkezés" },
  { id: "usp", label: "„Miért mi” — előnyök" },
  { id: "reviews", label: "Vélemények (valós)", domType: "reviews" },
  { id: "poi", label: "Környék / látnivalók" },
  { id: "newsletter", label: "Hírlevél-CTA (upsell)" },
];

/**
 * Detect which catalog modules are present in a mock's HTML by scanning for the
 * hydrated-runtime anchors (`data-cit-module="<domType>"`). Deterministic, no
 * LLM. Modules the generator authored in-skin WITHOUT an anchor are not detected
 * here — that gap closes when the generator emits per-section anchors (next
 * slice). Until then, undetected modules are offered as SAMPLE state.
 */
export function detectPresentModules(html: string): string[] {
  const present: string[] = [];
  for (const def of MODULE_CATALOG) {
    if (!def.domType) continue;
    const re = new RegExp(`data-cit-module=["']${def.domType}["']`, "i");
    if (re.test(html)) present.push(def.id);
  }
  return present;
}
