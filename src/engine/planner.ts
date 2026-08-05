// AI planner (ADR-0016): SiteData → Recipe. This is the engine's ONE AI step — the
// LLM makes the COMPOSITION decision (which primitives, in what order, which skin),
// NOT the HTML. The renderer is deterministic, so the same recipe reproduces the same
// structure (mock=live).
//
// Trust split: the LLM PROPOSES; a deterministic `enforce()` GUARANTEES the invariants
// (enquiry spine always present; gallery only with photos; features only with
// highlights; hero first). Fact-fidelity/spine rules are never left to the model.
// Falls back to a deterministic recipe without an API key (mirrors brief.ts).

import { config } from "../config.js";
import { ARCHETYPES } from "./archetypes.js";
import { PRIMITIVES } from "./primitives.js";
import type { Recipe, RecipeSection, SectionKind, SiteData } from "./recipe.js";
import { SKINS } from "./skins.js";

const SKIN_IDS = Object.keys(SKINS);
const KINDS = Object.keys(PRIMITIVES) as SectionKind[];
// Derived from the registry — a new archetype auto-widens the planner's choices, no edit.
// Retired archetypes (below the reference bar) are NOT selectable, but stay renderable:
// persisted recipes re-render through ARCHETYPES directly (mock=live).
const ARCH_IDS = Object.keys(ARCHETYPES).filter((id) => !ARCHETYPES[id]!.retired);
// Union of all primitive-variant ids (enforce() validates each against its own kind).
const VARIANT_IDS = [
  ...new Set(Object.values(PRIMITIVES).flatMap((p) => Object.keys(p.variants))),
];

/** Exported so the extensibility contract is testable: the selectable archetype set MUST
 *  equal the registry keys (no hardcoded drift). See scripts/engine-archetypes.ts. */
export const RECIPE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    skin: {
      type: "string",
      enum: SKIN_IDS,
      description: "A hangulathoz illő skin id-je a felsoroltak közül.",
    },
    archetype: {
      type: "string",
      enum: ARCH_IDS,
      description: "Az elrendezés-séma (archetípus) id-je a felsoroltak közül.",
    },
    sections: {
      type: "array",
      description: "A szekciók a megjelenítés SORRENDJÉBEN, csak a felsorolt primitívekből.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          kind: { type: "string", enum: KINDS },
          variant: {
            type: "string",
            enum: VARIANT_IDS,
            description: "A szekció-render variánsa (a kind-hoz illő). Elhagyva = alap variáns.",
          },
        },
        required: ["kind"],
      },
    },
  },
  required: ["skin", "archetype", "sections"],
};

// Archetype + skin menus built from the registries (single source → the prompt never drifts;
// adding a skin/archetype auto-widens the planner's choices with no edit here).
const ARCH_MENU = Object.values(ARCHETYPES)
  .filter((a) => !a.retired)
  .map((a) => `- ${a.id}: ${a.hint}`)
  .join("\n");
const SKIN_MENU = Object.values(SKINS)
  .map((s) => `- ${s.id}: ${s.hint}`)
  .join("\n");
// Per-kind variant menu from the primitive registry (so the model pairs variant↔kind).
const VARIANT_MENU = Object.values(PRIMITIVES)
  .map((p) => {
    const vs = Object.values(p.variants)
      .map((v) => `${v.id} (${v.hint})`)
      .join(", ");
    return `- ${p.kind}: ${vs}`;
  })
  .join("\n");

const SYSTEM = `Szálláshely-weboldal KOMPOZÍCIÓ-TERVEZŐ vagy. NEM írsz HTML-t és NEM írsz szöveget —
a megadott adatból és a rendelkezésre álló építőelemekből egy RECEPTET tervezel: mely szekciók,
milyen SORRENDBEN, melyik ARCHETÍPUS (elrendezés) és melyik SKIN illik a hangulathoz.

Építőelemek (primitívek):
- hero: nyitó fejléc névvel és alcímmel (mindig az első).
- features: bemutatkozó + a felszereltség (csak ha van kiemelés).
- gallery: fotórács (csak ha van fotó).
- rooms: szoba/egység-kártyák (a mockban modul-bemutató; valós adat híján jelölt minta).
- reviews: vendégértékelések (a mockban modul-bemutató; valós adat híján jelölt minta).
- faq: gyakori kérdések (a mockban modul-bemutató; valós adat híján jelölt minta).
- location: térkép + kapcsolat-kártya a valós elérhetőségekkel (záró bizalom-blokk; csak ha van elérhetőség).
- enquiry: érdeklődés/kapcsolat CTA — GERINC, mindig legyen (általában utolsó).

Archetípusok (az elrendezés-séma — a hangulathoz/adathoz válaszd):
${ARCH_MENU}

Szekció-variánsok (a szekció belső elrendezése — a hangulathoz/adathoz válaszd; elhagyva = alap):
${VARIANT_MENU}

Skinek (a hangulathoz válaszd):
${SKIN_MENU}

Csak a felsorolt primitíveket, variánsokat, archetípusokat és skineket használd.`;

/** Describe the property to the planner (structured facts, no invented content). */
function describe(data: SiteData): string {
  return [
    `Szállás neve: ${data.name}`,
    `Alcím: ${data.tagline}`,
    `Bemutatkozó: ${data.intro}`,
    `Kiemelések (${data.highlights.length} db): ${data.highlights.join(", ") || "nincs"}`,
    `Fotók száma: ${data.photos.length}`,
    `Van email: ${data.contact.email ? "igen" : "nem"}`,
  ].join("\n");
}

/** Deterministic fallback recipe — respects the same invariants as enforce(). */
function defaultRecipe(data: SiteData): Recipe {
  const sections: RecipeSection[] = [{ kind: "hero" }];
  if (data.highlights.length) sections.push({ kind: "features" });
  sections.push({ kind: "rooms" });
  if (data.photos.length) sections.push({ kind: "gallery" });
  sections.push({ kind: "reviews" });
  sections.push({ kind: "faq" });
  const c = data.contact;
  if (c.address || c.phone || c.email) sections.push({ kind: "location" });
  sections.push({ kind: "enquiry" });
  // "stacked" = the neutral baseline archetype (ARCH_IDS[0]).
  return { skin: "editorial-warm", archetype: ARCH_IDS[0]!, sections };
}

/** Normalize a section's variant against its kind: unknown → default; hero `overlay`
 *  needs a photo (data-gating) → default without one. A default variant is omitted so
 *  recipes stay minimal (and mock=live stable). */
function normalizeVariant(kind: SectionKind, variant: string | undefined): RecipeSection {
  const prim = PRIMITIVES[kind];
  const v = variant && prim.variants[variant] ? variant : prim.default;
  return v === prim.default ? { kind } : { kind, variant: v };
}

/**
 * Guarantee the invariants on ANY recipe (LLM or otherwise): valid kinds only, data-gated
 * modules dropped, deduped, hero first, enquiry spine last, valid skin/archetype, and each
 * section's variant normalized to its kind. The LLM's variant CHOICE is preserved when valid.
 */
function enforce(recipe: Recipe, data: SiteData): Recipe {
  const valid = new Set<string>(KINDS);
  let secs = recipe.sections.filter((s) => valid.has(s.kind));

  // Data-gating (05-MODULES: [DATA] modules appear only with real data).
  if (!data.photos.length) secs = secs.filter((s) => s.kind !== "gallery");
  if (!data.highlights.length) secs = secs.filter((s) => s.kind !== "features");
  const c = data.contact;
  if (!c.address && !c.phone && !c.email) secs = secs.filter((s) => s.kind !== "location");

  // Unique by kind (keep first occurrence → keeps its proposed variant).
  const seen = new Set<string>();
  secs = secs.filter((s) => (seen.has(s.kind) ? false : (seen.add(s.kind), true)));

  // Sample-capable module-demo sections are always in the recipe (the MOCK shows marked
  // sample content; the LIVE render drops them without real data — renderSite / §B.17).
  for (const k of ["rooms", "reviews", "faq"] as const) {
    if (!secs.some((s) => s.kind === k)) secs.push({ kind: k });
  }
  // Closing trust anchor: with any real contact fact the location block is always present
  // (map facade + contact card — the reference bar's "térkép + kapcsolat" completeness item).
  if ((c.address || c.phone || c.email) && !secs.some((s) => s.kind === "location")) {
    secs.push({ kind: "location" });
  }

  // Hero always first (preserve its proposed variant); enquiry spine always last.
  const heroVariant = recipe.sections.find((s) => s.kind === "hero")?.variant;
  const enquiryVariant = recipe.sections.find((s) => s.kind === "enquiry")?.variant;
  secs = secs.filter((s) => s.kind !== "hero" && s.kind !== "enquiry");
  secs.unshift({ kind: "hero", variant: heroVariant });
  secs.push({ kind: "enquiry", variant: enquiryVariant });

  const skin = SKINS[recipe.skin] ? recipe.skin : SKIN_IDS[0]!;
  const archetype = ARCHETYPES[recipe.archetype] ? recipe.archetype : ARCH_IDS[0]!;

  // The archetype's variant pairings complete its art direction (deterministic): they fill
  // sections the model left on the default variant; an explicit valid choice always wins.
  const preferred = ARCHETYPES[archetype]!.preferredVariants ?? {};
  const sections = secs
    .map((s) => normalizeVariant(s.kind, s.variant))
    .map((s) => {
      const pv = preferred[s.kind];
      return !s.variant && pv && PRIMITIVES[s.kind].variants[pv] ? { ...s, variant: pv } : s;
    });

  return { skin, archetype, sections };
}

export interface PlanResult {
  readonly recipe: Recipe;
  readonly source: "ai" | "fallback";
}

/** Re-target a planned recipe onto a specific archetype (curator/demo override): swaps the
 *  archetype and re-runs enforce(), so the archetype's preferred variant pairings apply. */
export function withArchetype(recipe: Recipe, archetype: string, data: SiteData): Recipe {
  if (!ARCHETYPES[archetype]) throw new Error(`unknown archetype: ${archetype}`);
  // Strip variants the AI picked for the OLD archetype's mood so the new archetype's
  // pairings can take effect; explicit copy stays attached by kind.
  const sections = recipe.sections.map(({ kind, copy }) => ({ kind, copy }));
  return enforce({ ...recipe, archetype, sections }, data);
}

/** Plan a recipe for the given site data. AI proposes; enforce() guarantees. */
export async function planRecipe(data: SiteData): Promise<PlanResult> {
  if (!config.anthropicApiKey) return { recipe: defaultRecipe(data), source: "fallback" };
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();
    const res = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 512,
      system: SYSTEM,
      messages: [{ role: "user", content: describe(data) }],
      output_config: { format: { type: "json_schema", schema: RECIPE_SCHEMA } },
    });
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return { recipe: defaultRecipe(data), source: "fallback" };
    const raw = JSON.parse(block.text) as Recipe;
    return { recipe: enforce(raw, data), source: "ai" };
  } catch {
    return { recipe: defaultRecipe(data), source: "fallback" };
  }
}
