// Composition engine — the RECIPE and content DATA types (ADR-0016).
//
// A Recipe is the structured, editable composition plan: which primitives, in what
// order, with which skin. The DATA is separate content that fills the primitives'
// slots. render(recipe, data) is deterministic → the SAME recipe with demo data
// (mock) vs. real data (live) yields a structurally identical page. That is the
// mock=live guarantee. The recipe is also what the tenant admin edits later.

export type SectionKind =
  | "hero"
  | "stats"
  | "features"
  | "gallery"
  | "rooms"
  | "reviews"
  | "faq"
  | "location"
  | "enquiry";

/** Render phase (ADR-0015 / §B.17). MOCK = cold-outreach preview: sample-capable modules
 *  (rooms/reviews) may show clearly-marked SAMPLE content to demo the module + create the wow.
 *  LIVE = public tenant page: a sample-capable module with NO real data is DROPPED — sample
 *  content never reaches a live page. */
export type RenderPhase = "mock" | "live";

/** Per-section EDITORIAL copy — the art-director/copywriter output of the AI planner
 *  (ADR-0016 `[AI-tervező]`). It carries brand-voice text (section eyebrow + heading, the
 *  hero's poetic lead line) so the engine renders bespoke-quality wording instead of generic
 *  hardcoded labels. Optional everywhere: absent → the primitive falls back to its generic
 *  heading (mock=live preserved; a tenant with no editorial still renders). This is MARKETING
 *  VOICE, not a hard fact — §B.17 (no fabricated numbers/amenities) still governs data slots. */
export interface SectionCopy {
  /** Small kicker above the heading (e.g. "Szállás" / "A lombkorona fölött"). */
  readonly eyebrow?: string;
  /** Section heading. A "\n" renders as a line break (two-line editorial headings). */
  readonly title?: string;
  /** A substring of `title` (or hero `lead`) rendered in the italic accent tone. */
  readonly accent?: string;
  /** Hero only: the poetic editorial headline that LEADS the hero as the H1 (the brand name
   *  moves to the eyebrow / nav). This is the single biggest "voice" lever for the wow. */
  readonly lead?: string;
}

export interface RecipeSection {
  readonly kind: SectionKind;
  /** Primitive variant id (see primitives.ts). Omitted → the kind's default variant.
   *  This is the section-render axis: same kind, different internal layout (cards vs
   *  table, plain hero vs photo-overlay, grid vs masonry). New variants are registry
   *  entries — no core change (ADR-0017 primitív-variáns passz). */
  readonly variant?: string;
  /** Editorial copy for this section (brand voice). Absent → generic fallback. */
  readonly copy?: SectionCopy;
  /** ADR-0025 ② page-level emphasis (art-director hierarchy). Exactly one non-spine section per
   *  page is "focal" — the property's strongest asset, a hero-moment that breaks the uniform band
   *  cadence; sample-demo / minor sections are "quiet". Absent → "normal". The deterministic
   *  renderer honors it (vertical space + scale only → no layout breakout), so mock=live holds.
   *  Never applies to hero/enquiry (the spine). Chosen by the planner; guaranteed by enforce(). */
  readonly emphasis?: "focal" | "normal" | "quiet";
}

export interface Recipe {
  /** Art-template id (see templates.ts, ADR-0027). When present, renderSite() renders the
   *  page through the COMPLETE, reference-fidelity page template (template-first path) and
   *  the archetype/primitive composition is bypassed. Optional and additive: recipes without
   *  it render through the composition path unchanged (old artifacts stay valid). */
  readonly template?: string;
  /** Skin id (see skins.ts). Chosen by the AI planner; switchable by the tenant. */
  readonly skin: string;
  /** Archetype id (see archetypes.ts) — the LAYOUT grammar that arranges the sections.
   *  Chosen by the AI planner; switchable by the tenant. New archetypes are added to the
   *  registry with no core change, so this stays a plain string keyed into ARCHETYPES. */
  readonly archetype: string;
  /** Ordered primitive sections — the AI planner picks and orders these. */
  readonly sections: readonly RecipeSection[];
}

/** §A.3 photo provenance classes. Live policy (photoPolicy.ts): owner/guest/portal
 *  (with the order-level §A declaration) may go live; places/streetview NEVER —
 *  they are demo-only and get replaced by the owner's own photos (A2). */
export type PhotoProvenance =
  | "owner"
  | "guest"
  | "portal"
  | "places"
  | "streetview"
  | "generated";

export interface Photo {
  readonly url: string;
  readonly alt: string;
  /** §A.3 rights class. Absent (legacy artifacts) = unknown → NOT live-safe. */
  readonly provenance?: PhotoProvenance;
  /** Watermarked photos never go live regardless of provenance (§A.1/b). */
  readonly watermarked?: boolean;
}

/** One amenity ON a unit: the owner's stored label plus the catalogue's icon markup. */
export interface RoomAmenity {
  /** The stored Hungarian label — also the i18n source key (amenityCatalog.ts). */
  readonly label: string;
  /** Inline `<svg>` from the 70-item catalogue. Absent → the label stands alone. */
  readonly icon?: string;
}

/** A room/unit type (real data; usually absent for a cold lead → sample-marked in the mock). */
export interface Room {
  readonly name: string;
  readonly capacity?: string;
  /**
   * ⛔ A SINGLE concatenated line — the pre-contract shape, kept for SAMPLE rooms and
   * for the legacy archetype renderers that have no details popover. Real units no
   * longer set it: their description and amenities now arrive STRUCTURED (below),
   * because one line made the guest read "az hogy … · Ingyenes Wi‑Fi · Síkképernyős
   * TV" as a single indistinguishable sentence. Use roomNoteLine() to read it.
   * Contract: assets/design-refs/tenant-site/rooms-card/README.md §1.
   */
  readonly note?: string;
  readonly photo?: Photo;
  /** Price line (e.g. "42 500 Ft / éj"). REAL data only — sample rooms never carry one
   *  (§B.17: a number is the most trust-sensitive fact; the price slot stays empty). */
  readonly price?: string;

  // ── the details popover reads these; the CARD never renders them (contract §1) ──
  /** The unit's own description, on its own — never glued to the amenities. */
  readonly description?: string;
  /** The unit's own amenities with catalogue icons. */
  readonly amenities?: readonly RoomAmenity[];
  /**
   * EVERY photo assigned to this unit, cover first (`photo` is photos[0]). Drives the
   * popover gallery and the card badge's "N kép"; absent or 1-long → no gallery
   * controls at all (contract §2: a single photo is the BASE case, not the edge).
   */
  readonly photos?: readonly Photo[];
  /**
   * The unit's own subpage slug — set ONLY when `/apartman/<slug>.html` really exists
   * (thin-content gate, ADR-0044 §13). The card is a real <a> to it and the popover
   * must not cost us that: the subpage is the SEO entry point (ADR-0041).
   */
  readonly slug?: string;
  /** A SAMPLE unit of the mock (ADR-0061): the popover heads it MINTA and the details are
   *  illustrative placeholders, never a claim about the property (§B.17). */
  readonly sample?: boolean;
  /** ADR-0114 — this unit IS the whole place; the popover says so instead of "Apartman". */
  readonly wholeProperty?: boolean;
  /**
   * The `site_unit` id this card stands for — so the card's "Foglalás" can carry WHICH
   * room down to the booking widget. Measured 2026-09-22: it could not, and the guest
   * who clicked Foglalás on the second room landed on a form preset to the FIRST one —
   * wrong calendar, wrong quote, and `unit: currentUnit()` would submit the wrong unit.
   */
  readonly unitId?: string;
  /**
   * The price line is a FLOOR ("24 000 Ft-tól"), because this unit has several season
   * prices. The popover may then say the exact price depends on the dates — but only
   * where the page can actually quote one (§B.17: no promise the page cannot keep).
   */
  readonly priceFrom?: boolean;
}

/**
 * The one-line room note for renderers that have NO details popover (the legacy
 * archetype primitives). Real units carry `description` + `amenities` separately, so
 * without this helper those renderers would silently lose both — the exact
 * "one shared field widened, three of four consumers quietly worse" failure.
 */
export function roomNoteLine(r: Room): string {
  if (r.note) return r.note;
  return [r.description, (r.amenities ?? []).map((a) => a.label).join(" · ")]
    .filter(Boolean)
    .join(" · ");
}

/** A guest review (real data; usually absent for a cold lead → sample-marked in the mock). */
export interface Review {
  readonly quote: string;
  readonly author: string;
  readonly meta?: string;
}

/** A FAQ entry (real data; usually absent for a cold lead → sample-marked in the mock). Policy
 *  facts (check-in, pets, parking) are trust-sensitive → sample content is generic, never a
 *  fabricated claim about THIS property; the owner fills real answers before live. */
export interface Faq {
  readonly q: string;
  readonly a: string;
}

/** A headline stat (value + label). Data-only: renders only with REAL data — never fabricated,
 *  even as a marked sample (numbers are the most trust-sensitive fact). */
export interface Stat {
  readonly value: string;
  readonly label: string;
  /** Optional decorative SVG marker before the value: "star" (rating) or an amenity icon name.
   *  Decorative only — never a fabricated fact; the value/label carry the real data. */
  readonly icon?: string;
}

/** Content that fills the recipe's slots. Demo data → mock; real data → live. The optional
 *  rooms/reviews carry REAL data when we have it; absent → the module shows marked sample
 *  content in the MOCK, and is dropped on LIVE (see RenderPhase). */
/** One program of the weekly recommender, as the page shows it. */
export interface SiteProgram {
  readonly title: string;
  readonly start: string;
  readonly end: string | null;
  readonly settlement: string;
  /** null = "Helyben" (the tenant's own settlement). */
  readonly distanceKm: number | null;
  readonly sourceUrl: string;
  readonly sourceHost: string;
}

export interface SiteData {
  /** ADR-0036: target language (BCP-47 primary subtag, e.g. "pl"), derived from the lead's
   *  region country at generation time and persisted — the live re-render renders the same
   *  language (mock=live). Absent → Hungarian. */
  readonly lang?: string;
  readonly name: string;
  readonly tagline: string;
  readonly intro: string;
  readonly highlights: readonly string[];
  readonly photos: readonly Photo[];
  readonly contact: {
    readonly email?: string;
    readonly phone?: string;
    readonly address?: string;
  };
  readonly rooms?: readonly Room[];
  /**
   * How many rooms the property really has, when a verified listing states the COUNT
   * but not the names (measured 2026-08-24: 4 leads of 36). The mock then renders
   * that many numbered sample cards, so the shape of the property is true even
   * without names — the owner's point: a lead who has three rooms must not be shown
   * an invented "Apartman". Never rendered as a claim in text.
   */
  readonly sampleRoomCount?: number;
  readonly reviews?: readonly Review[];
  readonly stats?: readonly Stat[];
  readonly faqs?: readonly Faq[];
  /** Structured facts for SEO/Schema.org (never rendered as visible text here; used by the
   *  JSON-LD + meta head). Optional: emitted only when real. */
  readonly geo?: { readonly lat: number; readonly lon: number };
  readonly rating?: {
    readonly value: number;
    readonly count?: number;
    /** ADR-0046 — Google's own reviews page for THIS place (built from the place id).
     *  Makes the badge clickable so a visitor can verify the number at the source;
     *  it doubles as the attribution the Places policy requires. */
    readonly url?: string;
  };
  /** ADR-0046 — the Google rating as a VISIBLE badge linking to Google's own reviews.
   *  Distinct from `rating` above (which feeds JSON-LD + the hero stars): this is set
   *  only when the owner's `showGoogleRating` toggle is on AND the data layer cleared
   *  both gates (match confidence + freshness). Review TEXTS are never copied — Places
   *  content may not be stored, and per-view fetching costs more than the module sells for. */
  readonly googleRating?: {
    readonly value: number;
    readonly count: number;
    readonly url: string;
  };
  /** ADR-0046 — present when the owner collects guest reviews; renders the form. The
   *  units let a guest say which apartment they stayed in. */
  readonly reviewForm?: {
    readonly units?: readonly { readonly id: string; readonly name: string }[];
  };
  /** ADR-0041 locality facets off the lead (ADR-0038/0040): NAP fields for the JSON-LD
   *  PostalAddress + the localized <title> pattern. Only real values — never fabricated. */
  readonly place?: { readonly city?: string; readonly country?: string };
  /** ADR-0041 Schema.org business @type derived from the lead's INDUSTRY (the industry is a
   *  parameter, not baked-in code). Absent (legacy artifacts) → LodgingBusiness fallback. */
  readonly businessType?: string;
  /** ADR-0041 canonical public URL. Set ONLY by the LIVE re-render (tenant/editor.ts), where
   *  the slug/custom domain is known — a mock never asserts a URL. */
  readonly canonicalUrl?: string;
  /** Photo-derived accent (§B.6): a HEX color sampled from THIS property's photos by the AI
   *  brief. Harmonized into the skin's safe rails at render time (engine/palette.ts) — never
   *  overrides the skin's light/dark character, only the accent hue. Optional (needs a brief). */
  readonly palette?: { readonly accent: string };
  /**
   * ADR-0044: the PAID booking module is active, so the shared slot renders a real
   * booking form instead of the "write to us" CTA — "ha van foglalás, akkor nincs
   * érdeklődés". Set ONLY by the live/preview re-render, the only place entitlements
   * are known; a mock never asserts it.
   * Availability is deliberately NOT baked in: the snapshot is static, so a frozen
   * calendar would go stale and offer a night that is already gone. The page fetches
   * the free days at view time.
   */
  /**
   * ADR-0044 — TENANT-SET module content. Every one of these is typed by the owner
   * in the admin (MODULE_CONFIG_REGISTRY) and must REACH THE PAGE; the promise is
   * not "there is a settings form", it is "what you type shows up".
   * Enforced end-to-end by scripts/module-render-check.mts across all templates.
   * Absent → the module renders nothing (never a fabricated placeholder, §B.17).
   */
  readonly amenities?: readonly string[];
  /**
   * Translation bridge for amenity icons (2026-08-27): rendered-label → catalogue
   * item id. On a translated page the labels are foreign strings, so the exact
   * catalogue match in amenityIconSvg would miss; applyTranslationMap fills this
   * at the one point where source and translation are both in hand. Absent on
   * Hungarian pages — there the exact match resolves directly.
   */
  readonly amenityIconMap?: Readonly<Record<string, string>>;
  readonly usp?: readonly string[];
  /**
   * "Heti programajánló" (the `poi` module): the programs on the page, in the tenant's
   * order then auto-filled (approved contract: design-refs/public-site/programajanlo/).
   * Titles and settlement names are FACTS from the source and are not translated.
   */
  readonly poi?: readonly SiteProgram[];
  /** The tenant's own settlement — the "… 30 km-es körzetéből" line of the block. */
  readonly poiArea?: string;
  readonly hours?: {
    readonly checkInFrom?: string;
    readonly checkInTo?: string;
    readonly checkOutUntil?: string;
    readonly note?: string;
  };
  /**
   * Prices are per BOOKABLE UNIT, because that is what an owner actually prices —
   * "Kertre néző apartman, 28 000 Ft/éj főszezonban", not an abstract season. The
   * units here are the same site_unit rows the rooms and booking modules use, so the
   * three modules cannot disagree about what exists.
   */
  readonly pricing?: {
    readonly currency?: string;
    /** per_night | per_person_night | per_stay — how the amounts are meant. */
    readonly unit?: string;
    readonly note?: string;
    readonly units?: readonly {
      readonly name: string;
      /** Applies when no season matches; absent → only seasons are shown. */
      readonly base?: number;
      /** 0072: the base is a DATED one, in force until this day ('YYYY-MM-DD', inclusive). */
      readonly baseUntil?: string;
      /** ADR-0208 ⑥.2: the owner said "nem adok meg árat" — where no row prices a night
       *  the table reads "Egyedi ajánlat alapján" instead of dropping the unit. Only on
       *  a DECISION: a forgotten price stays off the table, because saying the owner
       *  quotes individually would then be untrue (§B.17). */
      readonly onRequest?: boolean;
      readonly seasons?: readonly {
        readonly label: string;
        /** Recurring 'MM-DD'. */
        readonly from: string;
        readonly to: string;
        readonly amount: number;
        /** 0074: ONE YEAR's occurrence ("2027", "2026/27" over the year end) with its
         *  full dates ('YYYY-MM-DD'). Present only when the season has a year price —
         *  then the table lists each year within the booking horizon, because a
         *  year-less row would promise this year's price for next year too. */
        readonly year?: string;
        readonly start?: string;
        readonly end?: string;
      }[];
    }[];
  };
  readonly location?: {
    readonly showMap?: boolean;
    readonly approachNote?: string;
    readonly parkingNote?: string;
  };
  readonly newsletter?: { readonly title?: string; readonly subtitle?: string };
  readonly booking?: {
    readonly units: readonly {
      readonly id: string;
      readonly name: string;
      readonly capacity?: number;
      /**
       * No price row on this unit — the widget marks it in the picker and the stay
       * resolves to an ARAJÁNLAT (quote request) instead of a priced booking
       * (kontraktus: design-refs/tenant-site/quote-request ⑤). Absent = priced.
       * The flag is server-side because the availability endpoint answers for ONE
       * unit at a time, so the browser could not know about the others.
       */
      readonly unpriced?: boolean;
    }[];
    readonly minNights: number;
    readonly maxNights: number;
    readonly horizonMonths: number;
    readonly leadTimeDays: number;
    /** What the owner promises about answering; shown under the form. */
    readonly responseNote?: string;
    /**
     * Tourist tax the guest pays ON SITE, Ft/person/night — the OWNER's number.
     *
     * ⛔ HÁROM ÁLLAPOT, és mind a három mást jelent (KB-őr FLAG, 2026-09-14):
     *   · a mező HIÁNYZIK  → nem tudjuk. A lap kimondja, hogy a helyszínen IFA
     *     fizetendő, de összeget NEM ír (§B.17: kitalált szám sehol).
     *   · `0`              → a tulaj KIMONDTA, hogy nincs idegenforgalmi adó. A lap
     *     ilyenkor nem is említi — különben az IFA-mentes szállásról állítanánk
     *     valótlant, kikapcsolhatatlanul.
     *   · `> 0`            → az összeg, tételesen kiszámolva.
     */
    readonly touristTaxPerPersonNight?: number;
    /** What the nightly price already covers ("takarítás, ágynemű") — owner's words. */
    readonly priceIncludes?: string;
  };
}

/** §B.17 sample-capable modules (rooms/reviews/faq) with NO real data → they may only show
 *  mock-only MARKED SAMPLE content and are dropped on the live render. Shared by the renderer
 *  (phase gate) and the planner (① restraint cap + ② emphasis guarantee) so the rule is one
 *  source of truth. */
export function isSampleOnly(kind: SectionKind, data: SiteData): boolean {
  if (kind === "rooms") return !(data.rooms && data.rooms.length);
  if (kind === "reviews") return !(data.reviews && data.reviews.length);
  if (kind === "faq") return !(data.faqs && data.faqs.length);
  return false;
}
