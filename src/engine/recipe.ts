// Composition engine — the RECIPE and content DATA types (ADR-0016).
//
// A Recipe is the structured, editable composition plan: which primitives, in what
// order, with which skin. The DATA is separate content that fills the primitives'
// slots. render(recipe, data) is deterministic → the SAME recipe with demo data
// (mock) vs. real data (live) yields a structurally identical page. That is the
// mock=live guarantee. The recipe is also what the tenant admin edits later.

export type SectionKind = "hero" | "features" | "gallery" | "enquiry";

export interface RecipeSection {
  readonly kind: SectionKind;
}

export interface Recipe {
  /** Skin id (see skins.ts). Chosen by the AI planner; switchable by the tenant. */
  readonly skin: string;
  /** Ordered primitive sections — the AI planner picks and orders these. */
  readonly sections: readonly RecipeSection[];
}

export interface Photo {
  readonly url: string;
  readonly alt: string;
}

/** Content that fills the recipe's slots. Demo data → mock; real data → live. */
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
}
