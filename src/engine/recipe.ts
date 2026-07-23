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
  | "enquiry";

/** Render phase (ADR-0015 / §B.17). MOCK = cold-outreach preview: sample-capable modules
 *  (rooms/reviews) may show clearly-marked SAMPLE content to demo the module + create the wow.
 *  LIVE = public tenant page: a sample-capable module with NO real data is DROPPED — sample
 *  content never reaches a live page. */
export type RenderPhase = "mock" | "live";

export interface RecipeSection {
  readonly kind: SectionKind;
  /** Primitive variant id (see primitives.ts). Omitted → the kind's default variant.
   *  This is the section-render axis: same kind, different internal layout (cards vs
   *  table, plain hero vs photo-overlay, grid vs masonry). New variants are registry
   *  entries — no core change (ADR-0017 primitív-variáns passz). */
  readonly variant?: string;
}

export interface Recipe {
  /** Skin id (see skins.ts). Chosen by the AI planner; switchable by the tenant. */
  readonly skin: string;
  /** Archetype id (see archetypes.ts) — the LAYOUT grammar that arranges the sections.
   *  Chosen by the AI planner; switchable by the tenant. New archetypes are added to the
   *  registry with no core change, so this stays a plain string keyed into ARCHETYPES. */
  readonly archetype: string;
  /** Ordered primitive sections — the AI planner picks and orders these. */
  readonly sections: readonly RecipeSection[];
}

export interface Photo {
  readonly url: string;
  readonly alt: string;
}

/** A room/unit type (real data; usually absent for a cold lead → sample-marked in the mock). */
export interface Room {
  readonly name: string;
  readonly capacity?: string;
  readonly note?: string;
  readonly photo?: Photo;
}

/** A guest review (real data; usually absent for a cold lead → sample-marked in the mock). */
export interface Review {
  readonly quote: string;
  readonly author: string;
  readonly meta?: string;
}

/** A headline stat (value + label). Data-only: renders only with REAL data — never fabricated,
 *  even as a marked sample (numbers are the most trust-sensitive fact). */
export interface Stat {
  readonly value: string;
  readonly label: string;
}

/** Content that fills the recipe's slots. Demo data → mock; real data → live. The optional
 *  rooms/reviews carry REAL data when we have it; absent → the module shows marked sample
 *  content in the MOCK, and is dropped on LIVE (see RenderPhase). */
export interface SiteData {
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
}
