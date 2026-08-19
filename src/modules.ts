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
  /** Prospect-facing one-line description (owner language) — shown behind the
   *  info icon in the configurator. Plain benefit wording, no jargon, and NO
   *  fabricated facts (§B.17): describes what the module does, never lead data. */
  readonly publicDesc: string;
  /** Prospect-facing group. */
  readonly group: ModuleGroup;
  /** Backbone module — pre-checked / locked on. */
  readonly spine?: boolean;
  /** data-cit-module anchor value that marks this module present in a mock. */
  readonly domType?: string;
  /** DEFAULT monthly add-on price in HUF. 0 = in base. The LIVE price is
   *  operator-editable and comes from src/pricing.ts (DB); this is only the seed
   *  used until the owner saves on the /pricing admin page. */
  readonly priceMonthly: number;
}

// ⚠️ DEFAULT prices (HUF/month) — the SEED used until the owner sets real values
// on the console /pricing admin page (persisted in the DB; src/pricing.ts is the
// runtime source of truth). The spine (enquiry) is 0 = included in the base.
// Pricing model (tulaj): subscription = BASE + Σ(selected module priceMonthly);
// annual = 2 months free.
export const MODULE_CATALOG: readonly ModuleDef[] = [
  { id: "gallery", label: "Galéria (valós fotók)", publicLabel: "Képek a szállásról", publicDesc: "Nagy, minőségi fotógaléria a szállásról — élesítéskor az Ön saját képeivel töltjük fel.", group: "offer", domType: "gallery", priceMonthly: 490 },
  { id: "rooms", label: "Szobák / apartmanok", publicLabel: "Szobák, apartmanok", publicDesc: "A szobák, apartmanok külön kártyákon: fotó, férőhely, rövid leírás — a vendég pontosan látja, mit kap.", group: "offer", priceMonthly: 690 },
  { id: "amenities", label: "Felszereltség", publicLabel: "Amit kínál (felszereltség)", publicDesc: "Áttekinthető lista arról, amit a vendég Önnél kap: Wi‑Fi, parkolás, reggeli, klíma és a többi.", group: "offer", priceMonthly: 490 },
  { id: "pricing", label: "Árak / szezonok", publicLabel: "Árak, szezonok", publicDesc: "Árak és szezonok áttekinthető táblázatban — az árakat Ön adja meg, és bármikor módosíthatja.", group: "offer", priceMonthly: 490 },
  { id: "enquiry", label: "Érdeklődés-CTA (gerinc)", publicLabel: "Időpontkérés, kapcsolat", publicDesc: "Űrlap, amin a vendég közvetlenül Önnek ír: dátum, létszám, üzenet — közvetítői jutalék nélkül.", group: "reach", spine: true, domType: "booking", priceMonthly: 0 },
  { id: "location", label: "Térkép / megközelítés", publicLabel: "Térkép, megközelítés", publicDesc: "Interaktív térkép a pontos címével, hogy a vendég egyszerűen odataláljon.", group: "reach", domType: "map", priceMonthly: 490 },
  { id: "hours", label: "Nyitvatartás / be-kijelentkezés", publicLabel: "Nyitvatartás, érkezés", publicDesc: "Be- és kijelentkezési idők egy helyen — a vendég tudja, mikor érkezhet, kevesebb telefonos kérdés.", group: "reach", priceMonthly: 290 },
  { id: "usp", label: "„Miért mi” — előnyök", publicLabel: "Miért Önt válasszák", publicDesc: "A szállás valódi erősségei kiemelve — ami megkülönbözteti a környékbeli többi szállástól.", group: "offer", priceMonthly: 490 },
  { id: "reviews", label: "Vélemények (valós)", publicLabel: "Vendégek véleménye", publicDesc: "Valódi vendégértékelések az oldalon — a bizalom a legerősebb érv egy új vendégnek.", group: "offer", domType: "reviews", priceMonthly: 690 },
  { id: "poi", label: "Környék / látnivalók", publicLabel: "Környék, látnivalók", publicDesc: "Közeli látnivalók, strand, éttermek — ötleteket ad a vendégnek, miért épp ide jöjjön.", group: "offer", priceMonthly: 490 },
  { id: "booking", label: "Foglalás (upsell)", publicLabel: "Online foglalás", publicDesc: "Foglalási naptár közvetlenül az oldalán: a vendég Önnél foglal, közvetítői jutalék nélkül.", group: "extra", priceMonthly: 990 },
  { id: "newsletter", label: "Hírlevél-CTA (upsell)", publicLabel: "Hírlevél feliratkozás", publicDesc: "Feliratkozó-mező az oldalon — a visszatérő vendégeit később hírlevélben érheti el.", group: "extra", priceMonthly: 490 },
  // Custom e-mail address on the tenant's own/subdomain (e.g. info@<domain>). The mailbox
  // provisioning is a later slice (like the SMS transport); this is the sellable entitlement.
  { id: "email", label: "Egyedi e-mail cím (upsell)", publicLabel: "Saját e-mail cím (pl. info@…)", publicDesc: "Saját, a webcíméhez tartozó e-mail cím (pl. info@…) — professzionális megjelenés minden levélben.", group: "extra", priceMonthly: 390 },
];

/** DEFAULT base subscription price (HUF/month) — seed until the owner sets the
 *  real value on /pricing. The LIVE value lives in the DB (src/pricing.ts). */
export const DEFAULT_BASE_PRICE_MONTHLY = 3900;
/** DEFAULT annual prepay free months (2 → "2 hónap ingyen"): annual = 12 − free. */
export const DEFAULT_ANNUAL_FREE_MONTHS = 2;

// NB: the LIVE price math (computeMonthly/computeAnnual), the current base price
// and the PRICING_CONFIRMED gate now live in src/pricing.ts (DB-backed, editable).
// Import price values from there — modules.ts only owns the catalog STRUCTURE.

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
