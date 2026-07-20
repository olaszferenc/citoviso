// Shared module catalog (05-MODULES.md) — single source of truth for the module
// ids that appear in BOTH the operator convert form (console/views.ts) and the
// prospect-facing configurator (generator/configurator.ts). The ids MUST match
// the `module_entitlement.module` values written by convertLead (provision.ts):
// keep this list and the entitlement writes in lockstep.
//
// `label`       — operator-facing (internal jargon OK: "Érdeklődés-CTA (gerinc)").
// `publicLabel` — PROSPECT-facing, plain owner language. The target segment (an
//                 owner with no/poor website in 2026) does not know "modul/CTA/
//                 gerinc/upsell"; the configurator shows ONLY publicLabel.
// `group`       — prospect-facing grouping in the "customize" view.
// `domType`     — data-cit-module anchor that marks the module present in a mock.

export type ModuleGroup = "offer" | "reach" | "extra";

export interface ModuleDef {
  /** Catalog id — matches module_entitlement.module. */
  readonly id: string;
  /** Operator-facing label (internal). */
  readonly label: string;
  /** Prospect-facing plain label (owner language). */
  readonly publicLabel: string;
  /** Prospect-facing group. */
  readonly group: ModuleGroup;
  /** Backbone module — pre-checked / locked on. */
  readonly spine?: boolean;
  /** data-cit-module anchor value that marks this module present in a mock. */
  readonly domType?: string;
}

export const MODULE_CATALOG: readonly ModuleDef[] = [
  { id: "gallery", label: "Galéria (valós fotók)", publicLabel: "Képek a szállásról", group: "offer", domType: "gallery" },
  { id: "rooms", label: "Szobák / apartmanok", publicLabel: "Szobák, apartmanok", group: "offer" },
  { id: "amenities", label: "Felszereltség", publicLabel: "Amit kínál (felszereltség)", group: "offer" },
  { id: "pricing", label: "Árak / szezonok", publicLabel: "Árak, szezonok", group: "offer" },
  { id: "enquiry", label: "Érdeklődés-CTA (gerinc)", publicLabel: "Időpontkérés, kapcsolat", group: "reach", spine: true, domType: "booking" },
  { id: "location", label: "Térkép / megközelítés", publicLabel: "Térkép, megközelítés", group: "reach", domType: "map" },
  { id: "hours", label: "Nyitvatartás / be-kijelentkezés", publicLabel: "Nyitvatartás, érkezés", group: "reach" },
  { id: "usp", label: "„Miért mi” — előnyök", publicLabel: "Miért Önt válasszák", group: "offer" },
  { id: "reviews", label: "Vélemények (valós)", publicLabel: "Vendégek véleménye", group: "offer", domType: "reviews" },
  { id: "poi", label: "Környék / látnivalók", publicLabel: "Környék, látnivalók", group: "offer" },
  { id: "booking", label: "Foglalás (upsell)", publicLabel: "Online foglalás", group: "extra" },
  { id: "newsletter", label: "Hírlevél-CTA (upsell)", publicLabel: "Hírlevél feliratkozás", group: "extra" },
];

/** Prospect-facing group labels (plain). */
export const GROUP_LABELS: Record<ModuleGroup, string> = {
  offer: "Amit bemutat",
  reach: "Elérhetőség",
  extra: "Extrák",
};

export interface Preset {
  readonly id: string;
  /** Prospect-facing preset name. */
  readonly label: string;
  /** One-line plain note. */
  readonly note: string;
  /** Module ids this preset turns on. */
  readonly modules: string[];
}

// Preset-first choice model (2026-07-20): a non-tech owner picks ONE package in
// one click; the 12-toggle detail is hidden behind "Testre szabom". "Teljes" is
// the default (the ALL-IN anchor) — one click down to a leaner package.
const ESSENTIALS = ["gallery", "rooms", "amenities", "enquiry", "location", "usp", "reviews"];
const MINIMAL = ["gallery", "enquiry", "location"];

export const PRESETS: readonly Preset[] = [
  { id: "teljes", label: "Teljes", note: "Minden, amit kínálunk — ajánlott", modules: MODULE_CATALOG.map((m) => m.id) },
  { id: "ajanlott", label: "Ajánlott", note: "A lényeg, ami elad", modules: ESSENTIALS },
  { id: "alap", label: "Alap", note: "A minimum: képek, elérhetőség, térkép", modules: MINIMAL },
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
