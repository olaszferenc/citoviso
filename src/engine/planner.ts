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
import { PRIMITIVES } from "./primitives.js";
import type { Recipe, RecipeSection, SectionKind, SiteData } from "./recipe.js";
import { SKINS } from "./skins.js";

const SKIN_IDS = Object.keys(SKINS);
const KINDS = Object.keys(PRIMITIVES) as SectionKind[];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    skin: {
      type: "string",
      enum: SKIN_IDS,
      description: "A hangulathoz illő skin id-je a felsoroltak közül.",
    },
    sections: {
      type: "array",
      description: "A szekciók a megjelenítés SORRENDJÉBEN, csak a felsorolt primitívekből.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { kind: { type: "string", enum: KINDS } },
        required: ["kind"],
      },
    },
  },
  required: ["skin", "sections"],
};

const SYSTEM = `Szálláshely-weboldal KOMPOZÍCIÓ-TERVEZŐ vagy. NEM írsz HTML-t és NEM írsz szöveget —
a megadott adatból és a rendelkezésre álló építőelemekből egy RECEPTET tervezel: mely szekciók,
milyen SORRENDBEN, és melyik SKIN illik a hangulathoz.

Építőelemek (primitívek):
- hero: nyitó fejléc névvel és alcímmel (mindig az első).
- features: bemutatkozó + a kiemelések rácsa (csak ha van kiemelés).
- gallery: fotórács (csak ha van fotó).
- enquiry: érdeklődés/kapcsolat CTA — GERINC, mindig legyen (általában utolsó).

Skinek (a hangulathoz válaszd):
- editorial-warm: meleg, világos, családias, természetközeli.
- immersive-dark: sötét, elegáns, prémium, dizájnos.

Csak a felsorolt primitíveket és skineket használd.`;

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
  if (data.photos.length) sections.push({ kind: "gallery" });
  sections.push({ kind: "enquiry" });
  return { skin: "editorial-warm", sections };
}

/**
 * Guarantee the invariants on ANY recipe (LLM or otherwise): valid kinds only,
 * data-gated modules dropped, deduped, hero first, enquiry spine last, valid skin.
 */
function enforce(recipe: Recipe, data: SiteData): Recipe {
  const valid = new Set<string>(KINDS);
  let kinds = recipe.sections.map((s) => s.kind).filter((k) => valid.has(k));

  // Data-gating (05-MODULES: [DATA] modules appear only with real data).
  if (!data.photos.length) kinds = kinds.filter((k) => k !== "gallery");
  if (!data.highlights.length) kinds = kinds.filter((k) => k !== "features");

  // Unique (keep first occurrence).
  kinds = kinds.filter((k, i) => kinds.indexOf(k) === i);

  // Hero always first.
  kinds = kinds.filter((k) => k !== "hero");
  kinds.unshift("hero");

  // Enquiry is the spine — always present, always last.
  kinds = kinds.filter((k) => k !== "enquiry");
  kinds.push("enquiry");

  const skin = SKINS[recipe.skin] ? recipe.skin : SKIN_IDS[0]!;
  return { skin, sections: kinds.map((k) => ({ kind: k as SectionKind })) };
}

export interface PlanResult {
  readonly recipe: Recipe;
  readonly source: "ai" | "fallback";
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
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
    });
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return { recipe: defaultRecipe(data), source: "fallback" };
    const raw = JSON.parse(block.text) as Recipe;
    return { recipe: enforce(raw, data), source: "ai" };
  } catch {
    return { recipe: defaultRecipe(data), source: "fallback" };
  }
}
