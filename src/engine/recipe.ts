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

/** A room/unit type (real data; usually absent for a cold lead → sample-marked in the mock). */
export interface Room {
  readonly name: string;
  readonly capacity?: string;
  readonly note?: string;
  readonly photo?: Photo;
  /** Price line (e.g. "42 500 Ft / éj"). REAL data only — sample rooms never carry one
   *  (§B.17: a number is the most trust-sensitive fact; the price slot stays empty). */
  readonly price?: string;
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
  readonly reviews?: readonly Review[];
  readonly stats?: readonly Stat[];
  readonly faqs?: readonly Faq[];
  /** Structured facts for SEO/Schema.org (never rendered as visible text here; used by the
   *  JSON-LD + meta head). Optional: emitted only when real. */
  readonly geo?: { readonly lat: number; readonly lon: number };
  readonly rating?: { readonly value: number; readonly count?: number };
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
  readonly booking?: {
    readonly units: readonly {
      readonly id: string;
      readonly name: string;
      readonly capacity?: number;
    }[];
    readonly minNights: number;
    readonly maxNights: number;
    readonly horizonMonths: number;
    readonly leadTimeDays: number;
    /** What the owner promises about answering; shown under the form. */
    readonly responseNote?: string;
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
