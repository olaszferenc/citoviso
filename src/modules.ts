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

/**
 * When a declared requirement APPLIES (ADR-0192 ⑤).
 *   "always"    — unconditionally.
 *   "multiUnit" — only when the accommodation has 2+ units. ⚠️ "unknown" is NOT
 *                 "no": see MultiUnitState.
 */
export type RequirementWhen = "always" | "multiUnit";

/**
 * A declared module dependency (ADR-0192). Product STRUCTURE, therefore code-side
 * and not a DB table: the module PRICE lives in the DB because the operator edits
 * it, but "which module needs which" is not a tunable value. A table would open a
 * second truth next to MODULE_CATALOG, while half the consumers (configurator
 * manifest, client JS, lints) read from code — and every product change would need
 * a migration. Precedent: `supersedes` is code-side too, the lint validates it and
 * the manifest already ships it to the client.
 *
 * NOT a bare `string[]`, because three consumers need more than an id:
 *   `when`     — the CONDITION (an id list cannot carry it),
 *   `why`      — the sentence said TO THE OWNER. It shows up on six screens, so it
 *                must come from ONE source (feedback_one_rule_two_copies). Owner
 *                language, no jargon, no fabricated facts (§B.17).
 *   `strength` — "hard" blocks (the cart auto-checks it, the cancel refuses),
 *                "advice" only explains.
 */
export interface ModuleRequirement {
  /** Catalog id of the REQUIRED module. */
  readonly id: string;
  /** Condition; absent = "always". */
  readonly when?: RequirementWhen;
  /** "hard" = enforced everywhere; "advice" = explained, never enforced. */
  readonly strength: "hard" | "advice";
  /** The sentence shown to the owner — not a machine code. */
  readonly why: string;
}

/**
 * Does this site have 2+ bookable units? ⛔ "unknown" is NOT "no" (owner ruling,
 * ADR-0192 ④.4): the mock itself SHOWS three room cards (sampleRooms()), so
 * treating an unmeasured site as single-unit would contradict the screen the owner
 * is looking at. Measured: 33 mock artifacts, 0 with a real room list — in the mock
 * phase the condition is ~97% unevaluable, so the fail-closed reading is the only
 * honest one: unknown → the requirement STANDS.
 */
export type MultiUnitState = "yes" | "no" | "unknown";

export interface DependencyContext {
  /** Absent = "unknown" → conditional requirements stand. */
  readonly multiUnit?: MultiUnitState;
}

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
  /**
   * Extra anchors that ALSO mean "this module's surface is on the page". A module
   * can have several page states: `reviews` renders as real quotes, as the honest
   * reviews-pending block, or as the collection form — all three ARE the reviews
   * module. Without this the toggle found nothing and did nothing, so the prospect
   * could switch a module off and see no change (owner report 2026-08-23, §I).
   */
  readonly domTypesAlso?: readonly string[];
  /**
   * Module ids this one REPLACES when active (tulaj, 2026-08-21). They share a slot,
   * so both may never render: "ha van foglalás, akkor nincs érdeklődés". The
   * superseded module is not billed and not offered while the replacement is on —
   * charging for a section the page cannot show would be selling nothing.
   */
  readonly supersedes?: readonly string[];
  /**
   * Modules this one NEEDS to make sense (ADR-0192). The chain today:
   *   booking ──requires──▶ pricing ──requires(multiUnit)──▶ rooms
   * The kind of damage is never an empty band (every block early-returns) but
   * CONTENT WITHOUT CONTEXT: a booking calendar that cannot name a price, a price
   * table that cannot say what it is the price OF.
   * ⛔ `amenities requires rooms` deliberately does NOT exist: amenities is
   * site-level data, renders fine without rooms, and the KB entry title says so
   * ("Felszereltség — mit kap a vendég az EGÉSZ szálláson"). The real coupling is
   * per-unit editing only, and that has been an OPERATION-level gate since
   * ADR-0074 §5.
   */
  readonly requires?: readonly ModuleRequirement[];
  /** DEFAULT monthly add-on price in HUF. 0 = in base. The LIVE price is
   *  operator-editable and comes from src/pricing.ts (DB); this is only the seed
   *  used until the owner saves on the /pricing admin page. */
  readonly priceMonthly: number;
  /**
   * Billing type (ADR-0063). Default (absent) = 'monthly': the price joins the
   * subscription sum. 'once' = a ONE-TIME fee per purchase event — it never joins
   * computeMonthly/computeAnnual, and each re-purchase (regeneration) costs the
   * same again. For 'once' modules `priceMonthly` is repurposed as the one-time
   * price seed (the pricing admin edits it the same way).
   */
  readonly billing?: "monthly" | "once";
  /**
   * Sold from the TENANT ADMIN only (ADR-0063): not offered in the prospect
   * configurator and never part of the ALL-IN conversion set — the purchase needs
   * a provisioned site with saved content (there is nothing to translate before).
   */
  readonly tenantOnly?: boolean;
  /**
   * ⛔ LEVÉVE A POLCRÓL — nem kínáljuk, amíg nincs mögötte működő út.
   *
   * A katalógus-sor MARAD (a meglévő jogosultság-sorok és számlák továbbra is fel
   * tudják oldani a nevét és az árát — egy törölt id „undefined" lenne a bérlő
   * számláján), de a modul nem kerül be a kínálatba, az ALL-IN halmazba és az
   * előfizetés-matekba. Ez a KÍNÁLAT levétele, nem a múlt átírása.
   */
  readonly retired?: boolean;
}

// ⚠️ DEFAULT prices (HUF/month) — the SEED used until the owner sets real values
// on the console /pricing admin page (persisted in the DB; src/pricing.ts is the
// runtime source of truth). The spine (enquiry) is 0 = included in the base.
// Pricing model (tulaj): subscription = BASE + Σ(selected module priceMonthly);
// annual = 2 months free.
export const MODULE_CATALOG: readonly ModuleDef[] = [
  { id: "gallery", label: "Galéria (valós fotók)", publicLabel: "Képek a szállásról", publicDesc: "Nagy, minőségi fotógaléria a szállásról — élesítéskor az Ön saját képeivel töltjük fel.", group: "offer", domType: "gallery", priceMonthly: 490 },
  { id: "rooms", label: "Szobák / apartmanok", publicLabel: "Szobák, apartmanok", publicDesc: "A szobák, apartmanok külön kártyákon: fotó, férőhely, rövid leírás — a vendég pontosan látja, mit kap.", group: "offer", domType: "rooms", priceMonthly: 690 },
  { id: "amenities", label: "Felszereltség", publicLabel: "Amit kínál (felszereltség)", publicDesc: "Áttekinthető lista arról, amit a vendég Önnél kap: Wi‑Fi, parkolás, reggeli, klíma és a többi.", group: "offer", domType: "amenities", priceMonthly: 490 },
  { id: "pricing", label: "Árak / szezonok", publicLabel: "Árak, szezonok", publicDesc: "Árak és szezonok áttekinthető táblázatban — az árakat Ön adja meg, és bármikor módosíthatja.", group: "offer", domType: "pricing", priceMonthly: 490, requires: [{ id: "rooms", when: "multiUnit", strength: "hard", why: "Több szoba vagy apartman esetén az ár mindig ahhoz tartozik, amit a vendég kivesz — a Szobák modul mondja meg, mire vonatkozik az összeg." }] },
  { id: "enquiry", label: "Érdeklődés-CTA (gerinc)", publicLabel: "Időpontkérés, kapcsolat", publicDesc: "Űrlap, amin a vendég közvetlenül Önnek ír: dátum, létszám, üzenet — közvetítői jutalék nélkül.", group: "reach", spine: true, domType: "booking", priceMonthly: 0 },
  { id: "location", label: "Térkép / megközelítés", publicLabel: "Térkép, megközelítés", publicDesc: "Interaktív térkép a pontos címével, hogy a vendég egyszerűen odataláljon.", group: "reach", domType: "map", priceMonthly: 490 },
  { id: "hours", label: "Nyitvatartás / be-kijelentkezés", publicLabel: "Nyitvatartás, érkezés", publicDesc: "Be- és kijelentkezési idők egy helyen — a vendég tudja, mikor érkezhet, kevesebb telefonos kérdés.", group: "reach", domType: "hours", priceMonthly: 290 },
  { id: "usp", label: "„Miért mi” — előnyök", publicLabel: "Miért Önt válasszák", publicDesc: "A szállás valódi erősségei kiemelve — ami megkülönbözteti a környékbeli többi szállástól.", group: "offer", domType: "usp", priceMonthly: 490 },
  { id: "reviews", label: "Vélemények (valós)", publicLabel: "Vendégek véleménye", publicDesc: "Valódi vendégértékelések az oldalon — a bizalom a legerősebb érv egy új vendégnek.", group: "offer", domType: "reviews", domTypesAlso: ["reviews-pending", "review-form"], priceMonthly: 690 },
  { id: "poi", label: "Környék / látnivalók", publicLabel: "Környék, látnivalók", publicDesc: "Közeli látnivalók, strand, éttermek — ötleteket ad a vendégnek, miért épp ide jöjjön.", group: "offer", domType: "poi", priceMonthly: 490 },
  // Shares the enquiry SLOT (data-cit-module="booking"): with this on, the visitor
  // gets a real calendar instead of a "write to us" form, so enquiry is replaced
  // rather than stacked. One slot, two states — never both.
  // No `domType` on purpose: the anchor is enquiry's, so detectPresentModules must
  // not report both as present from the same tag. Presence comes from entitlement.
  { id: "booking", label: "Foglalás (upsell)", publicLabel: "Online foglalás", publicDesc: "Foglalási naptár közvetlenül az oldalán: a vendég a szabad napokra foglal, közvetítői jutalék nélkül. Ez lép az időpontkérő űrlap helyére.", group: "extra", domType: "booking-section", supersedes: ["enquiry"], priceMonthly: 990, requires: [{ id: "pricing", strength: "hard", why: "Az online foglalás összeget mond a vendégnek a naptárban, és ugyanaz az összeg megy ki a visszaigazoló levélben is — az árakat az Árak modul adja." }] },
  // ⛔⛔ LEVÉVE A POLCRÓL (tulajdonosi döntés, 2026-09-14). Mérve: az űrlap a
  // `/api/hirlevel` címre POST-olt, ami a nyilvános kiszolgálón NEM LÉTEZIK, és
  // feliratkozó-tábla sincs — a vendég beírta a címét, megnyomta a gombot, és
  // elhagyta az oldalt, miközben a modul 490 Ft/hó volt. A sor azért marad benne,
  // hogy a MEGLÉVŐ jogosultság- és számla-sorok fel tudják oldani a nevét; a
  // `retired` kapcsoló veszi ki a kínálatból, az ALL-IN halmazból és a matekból.
  // Visszakapcsolás: végpont + tábla + megerősítő levél + leiratkozás után.
  { id: "newsletter", label: "Hírlevél-CTA (upsell)", publicLabel: "Hírlevél feliratkozás", publicDesc: "Feliratkozó-mező az oldalon — a visszatérő vendégeit később hírlevélben érheti el.", group: "extra", domType: "newsletter", priceMonthly: 490, retired: true },
  // Custom e-mail address on the tenant's own/subdomain (e.g. info@<domain>). The mailbox
  // provisioning is a later slice (like the SMS transport); this is the sellable entitlement.
  { id: "email", label: "Egyedi e-mail cím (upsell)", publicLabel: "Saját e-mail cím (pl. info@…)", publicDesc: "Saját, a webcíméhez tartozó e-mail cím (pl. info@…) — professzionális megjelenés minden levélben.", group: "extra", priceMonthly: 390 },
  // ADR-0063: the FIRST one-time-fee module. The tenant picks 3 languages in the
  // admin, pays once, and the whole site (their saved texts + the full surface) is
  // generated in all 3. Any later content change makes the translations stale —
  // regenerating (or swapping a language) is the SAME one-time fee again. Sold from
  // the tenant admin only: translation needs a provisioned site with saved content.
  { id: "multilang", label: "Többnyelvű honlap (egyszeri)", publicLabel: "Többnyelvű honlap", publicDesc: "A honlapja több választott nyelven is elérhető lesz — a beírt szövegei és a teljes felület lefordítva. Egyszeri díj; későbbi szövegmódosítás után az újrafordítás újra ennyibe kerül.", group: "extra", billing: "once", tenantOnly: true, priceMonthly: 14900 },
];

/**
 * ADR-0128 — the multilang package is SOLD IN THREE TIERS (owner ruling 2026-09-13),
 * replacing ADR-0063 §2's fixed 3 languages. Each tier is a one-time fee; the tier
 * decides how many of the 28 target languages the tenant may pick.
 *
 * `priceId` is the `module_price` row the operator edits. The Alap tier deliberately
 * keeps the plain `multilang` id, so the price already configured for the old fixed-3
 * package carries over untouched and no past order changes value.
 *
 * `cap: null` = the whole set (there is nothing to pick — the tenant gets every language).
 */
export interface MultilangTier {
  readonly id: "alap" | "bovitett" | "teljes";
  /** Tenant-facing tier name. */
  readonly name: string;
  /** Max target languages, or null for "all of them". */
  readonly cap: number | null;
  /** module_price row id (operator-editable). */
  readonly priceId: string;
  /** Code default in HUF, used until the operator saves a price. */
  readonly priceDefault: number;
}

export const MULTILANG_TIERS: readonly MultilangTier[] = [
  { id: "alap", name: "Alap", cap: 3, priceId: "multilang", priceDefault: 14900 },
  { id: "bovitett", name: "Bővített", cap: 6, priceId: "multilang6", priceDefault: 22900 },
  { id: "teljes", name: "Teljes", cap: null, priceId: "multilang28", priceDefault: 30000 },
];

export const DEFAULT_MULTILANG_TIER = MULTILANG_TIERS[0]!;

/** Tier by id; unknown/absent → the Alap tier (never a crash, never a free upgrade). */
export function multilangTier(id: string | null | undefined): MultilangTier {
  return MULTILANG_TIERS.find((t) => t.id === id) ?? DEFAULT_MULTILANG_TIER;
}

/** Is `id` a one-time-fee module (ADR-0063)? Absent billing = monthly. */
export function isOneTimeModule(id: string): boolean {
  return MODULE_CATALOG.find((m) => m.id === id)?.billing === "once";
}

/** Catalog ids that join the SUBSCRIPTION math and the prospect configurator. */
export function subscriptionModules(): readonly ModuleDef[] {
  return MODULE_CATALOG.filter((m) => m.billing !== "once" && !m.tenantOnly && !m.retired);
}

/**
 * Modules to provision when converting a lead → live site. The source of truth is
 * the OWNER's own choice in the prospect configurator (their latest order intent);
 * the operator does NOT re-pick modules. When the owner hasn't configured yet, we
 * provision ALL-IN (every catalog module) — the same "show everything" default the
 * configurator opens with. Structural input type to avoid a console-data dependency.
 */
export function modulesForConversion(
  orders: readonly { readonly status: string; readonly modules: string[] }[],
  /** Module-sales switch (owner decree 2026-09-06): ids not sellable right now.
   *  Only the ALL-IN fallback filters — an EXPLICIT submitted order keeps its
   *  modules, because that exact offer was already made to the buyer (§I). */
  disabled?: ReadonlySet<string>,
): string[] {
  const chosen = orders.find((o) => o.status === "submitted") ?? orders[0];
  // ALL-IN excludes tenant-only/one-time modules (ADR-0063): those are bought later
  // from the admin, never provisioned implicitly with a subscription.
  // The ALL-IN fallback drops the disabled modules AND everything that hard-requires
  // them (ADR-0192): offering `booking` while `pricing` is off the shelf would
  // provision a calendar that cannot name a price.
  return chosen && chosen.modules.length
    ? chosen.modules
    : sellableModuleIds(
        subscriptionModules().map((m) => m.id),
        disabled ?? new Set<string>(),
      );
}

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
// ⛔ OWNER RULE (2026-09-07): "ami az alacsonyabb csomagban benne van, az benne
// van a magasabb csomagban is." The tiers are therefore DERIVED from each other,
// not listed independently — a rule that only lives in a comment drifts the first
// time someone edits one array. `presetNestingViolations()` below still checks it,
// because the top tier is computed from the catalog and could diverge on its own.
const MINIMAL = ["gallery", "enquiry", "location"];
const ESSENTIALS = [...MINIMAL, "rooms", "amenities", "usp", "reviews"];

export const PRESETS: readonly Preset[] = [
  { id: "teljes", label: "Teljes", note: "Minden, amit kínálunk — ajánlott", modules: subscriptionModules().map((m) => m.id) },
  { id: "ajanlott", label: "Ajánlott", note: "A lényeg, ami elad", modules: ESSENTIALS },
  { id: "alap", label: "Alap", note: "A minimum: képek, elérhetőség, térkép", modules: MINIMAL },
];

/**
 * The tiers ordered SMALLEST → LARGEST. The console renders them this way (each
 * one "everything from the previous, plus…"), and the nesting guard walks them
 * in this order. One source, so the screen and the guard cannot disagree.
 */
export function presetsAscending(): readonly Preset[] {
  return [...PRESETS].sort((a, b) => a.modules.length - b.modules.length);
}

/**
 * Owner rule check: every tier must contain every module of every smaller tier.
 * Returns the violations (empty array = the rule holds), so a guard can report
 * WHICH module fell out of WHICH tier instead of a bare boolean.
 */
export function presetNestingViolations(): { tier: string; missing: string[]; from: string }[] {
  const asc = presetsAscending();
  const out: { tier: string; missing: string[]; from: string }[] = [];
  for (let i = 1; i < asc.length; i++) {
    const bigger = new Set(asc[i]!.modules);
    for (let j = 0; j < i; j++) {
      const missing = asc[j]!.modules.filter((id) => !bigger.has(id));
      if (missing.length) out.push({ tier: asc[i]!.id, missing, from: asc[j]!.id });
    }
  }
  return out;
}

/** Modules THIS tier adds on top of the next smaller one (for the console view). */
export function presetAddedModules(presetId: string): string[] {
  const asc = presetsAscending();
  const i = asc.findIndex((p) => p.id === presetId);
  if (i < 0) return [];
  if (i === 0) return [...asc[0]!.modules];
  const prev = new Set(asc[i - 1]!.modules);
  return asc[i]!.modules.filter((id) => !prev.has(id));
}

/**
 * Detect which catalog modules are present in a mock's HTML by scanning for the
 * hydrated-runtime anchors (`data-cit-module="<domType>"`). Deterministic, no
 * LLM. Modules the generator authored in-skin WITHOUT an anchor are not detected
 * here — that gap closes when the generator emits per-section anchors (next
 * slice). Until then, undetected modules are offered as SAMPLE state.
 */
/**
 * Which ACTIVE module replaces `moduleId`, if any (tulaj, 2026-08-21).
 * "Ha van foglalás, akkor nincs érdeklődés": they share one slot, so the page can
 * only ever show one of them.
 */
export function supersederOf(moduleId: string, activeIds: Iterable<string>): string | null {
  const active = new Set(activeIds);
  for (const m of MODULE_CATALOG) {
    if (!m.supersedes?.includes(moduleId)) continue;
    if (active.has(m.id)) return m.id;
  }
  return null;
}

/**
 * The set that actually RENDERS: the active modules minus everything a superseding
 * module has replaced. Use this for rendering and for pricing — billing a tenant
 * for a section the page cannot show would be charging for nothing.
 */
export function renderableModules(activeIds: Iterable<string>): string[] {
  const active = [...new Set(activeIds)];
  return active.filter((id) => supersederOf(id, active) === null);
}

// ──────────────────────────────────────────────────────────────────────────────
// Module dependencies (ADR-0192). ⭐ ONE rule, ONE source: the cart, the cancel
// gate, the renewal sweep, the lint and the behaviour guard all decide through
// the functions below. The `why` sentence appears on six screens — duplicating
// the predicate is how a screen and a charge come to disagree
// (feedback_one_rule_two_copies).
// ──────────────────────────────────────────────────────────────────────────────

/** Requirements of `moduleId` that APPLY in this context (unknown → they stand). */
export function applicableRequirements(
  moduleId: string,
  ctx: DependencyContext = {},
): readonly ModuleRequirement[] {
  const reqs = MODULE_CATALOG.find((m) => m.id === moduleId)?.requires ?? [];
  const multiUnit = ctx.multiUnit ?? "unknown";
  return reqs.filter((r) => (r.when ?? "always") !== "multiUnit" || multiUnit !== "no");
}

/** One unmet requirement: WHO needs WHAT, and the sentence to show the owner. */
export interface DependencyIssue {
  readonly moduleId: string;
  readonly requiredId: string;
  readonly strength: "hard" | "advice";
  readonly why: string;
}

/**
 * Unmet requirements of a module set.
 *
 * ⛔ The set is evaluated as a WHOLE, never an order row on its own: an upsell
 * order's `modules` jsonb is a DELTA, not a set (ADR-0192 ③ — a false positive
 * that was reported to the owner as fact before another branch refuted it).
 * Callers on the order path must pass SUBMITTED ∪ ALREADY-OWNED, otherwise every
 * upsell that does not re-buy its dependencies gets rejected.
 *
 * Only modules that actually RENDER impose their requirements (a superseded module
 * shows no section, so forcing its dependency would charge for nothing — same
 * reasoning as renderableModules). Satisfaction is checked against the full set.
 */
export function moduleDependencyIssues(
  ids: Iterable<string>,
  ctx: DependencyContext = {},
): DependencyIssue[] {
  const set = new Set(ids);
  const out: DependencyIssue[] = [];
  for (const id of renderableModules(set)) {
    for (const r of applicableRequirements(id, ctx)) {
      if (set.has(r.id)) continue;
      out.push({ moduleId: id, requiredId: r.id, strength: r.strength, why: r.why });
    }
  }
  return out;
}

/** The ENFORCED subset of the above: only "hard" requirements block anything. */
export function missingRequiredModules(
  ids: Iterable<string>,
  ctx: DependencyContext = {},
): DependencyIssue[] {
  return moduleDependencyIssues(ids, ctx).filter((i) => i.strength === "hard");
}

/**
 * The set PLUS every hard requirement it pulls in. This is what the CART ticks
 * (owner ruling, ADR-0192 ④.1): the dependency is checked and PRICED on screen,
 * so the confirming card — which iterates the ticked boxes — cannot show 990 Ft
 * and charge 2 170. A silent server-side add would have needed that fixed
 * separately.
 *
 * Fixed point rather than one pass: a newly added module can supersede an existing
 * one and change which modules impose requirements. Bounded by the catalog size —
 * the lint forbids cycles, but a runaway must never hang a page render.
 */
export function withRequiredModules(
  ids: Iterable<string>,
  ctx: DependencyContext = {},
): string[] {
  const out = [...new Set(ids)];
  for (let guard = 0; guard <= MODULE_CATALOG.length; guard++) {
    const missing = [...new Set(missingRequiredModules(out, ctx).map((i) => i.requiredId))].filter(
      (id) => !out.includes(id),
    );
    if (!missing.length) break;
    out.push(...missing);
  }
  return out;
}

/**
 * Which ACTIVE modules would BREAK if `id` were switched off — i.e. what blocks
 * the cancellation (ADR-0192 ④.2). Empty array = free to remove.
 *
 * ⛔ Blocking, never cascading: ADR-0155 ③ reads a missing field on the frozen
 * admin page as a cancellation, so an automatic REMOVING branch would reach into
 * exactly the data-loss trap the preserving fields were built to stop. The screen
 * offers a JOINT cancellation instead, and the owner decides.
 *
 * Derived from the same predicate as everything else — the deciding line runs the
 * operation's own rule, it does not re-state it (feedback_badge_answered_one_of_nine_gates).
 */
export function blockersOfRemoving(
  id: string,
  activeIds: Iterable<string>,
  ctx: DependencyContext = {},
): DependencyIssue[] {
  const rest = [...new Set(activeIds)].filter((x) => x !== id);
  return missingRequiredModules(rest, ctx).filter((i) => i.requiredId === id);
}

/** The blocking module IDS only — the `why` sentence comes from the issue above. */
export function modulesRequiring(
  id: string,
  activeIds: Iterable<string>,
  ctx: DependencyContext = {},
): string[] {
  return [...new Set(blockersOfRemoving(id, activeIds, ctx).map((i) => i.moduleId))];
}

/**
 * Everything that must go if `id` goes — the JOINT cancellation the screen OFFERS
 * (ADR-0192 ④.2). Transitive: dropping `rooms` breaks `pricing`, and dropping
 * `pricing` breaks `booking`, so the honest question is "cancel all three?".
 * ⛔ This computes the offer; it never performs it. The owner confirms.
 * Only breakage caused by THIS removal counts — a set that was already invalid for
 * another reason must not widen the offer.
 */
export function removalClosure(
  id: string,
  activeIds: Iterable<string>,
  ctx: DependencyContext = {},
): string[] {
  const active = [...new Set(activeIds)];
  const removed = new Set<string>([id]);
  for (let guard = 0; guard <= MODULE_CATALOG.length; guard++) {
    const rest = active.filter((x) => !removed.has(x));
    const broken = missingRequiredModules(rest, ctx).filter((i) => removed.has(i.requiredId));
    if (!broken.length) break;
    for (const b of broken) removed.add(b.moduleId);
  }
  return active.filter((x) => removed.has(x));
}

/**
 * Which of `ids` can still be SOLD while `disabled` modules are off the shelf: the
 * disabled ones drop, and so does everything that hard-requires them, transitively.
 *
 * Measured leak (ADR-0192 ②): with `rooms` taken off sale the `teljes` and
 * `ajanlott` presets still offered `pricing` and `booking`, and
 * presetNestingViolations() stayed green — it never sees the sales switch.
 * Offering a module whose dependency cannot be bought is selling a broken set.
 */
export function sellableModuleIds(
  ids: Iterable<string>,
  disabled: ReadonlySet<string>,
  ctx: DependencyContext = {},
): string[] {
  let out = [...new Set(ids)].filter((id) => !disabled.has(id));
  for (let guard = 0; guard <= MODULE_CATALOG.length; guard++) {
    const broken = new Set(missingRequiredModules(out, ctx).map((i) => i.moduleId));
    if (!broken.size) break;
    out = out.filter((id) => !broken.has(id));
  }
  return out;
}

export function detectPresentModules(html: string): string[] {
  const present: string[] = [];
  for (const def of MODULE_CATALOG) {
    const anchors = [def.domType, ...(def.domTypesAlso ?? [])].filter(Boolean) as string[];
    if (!anchors.length) continue;
    const re = new RegExp(`data-cit-module=["'](${anchors.join("|")})["']`, "i");
    if (re.test(html)) present.push(def.id);
  }
  return present;
}
