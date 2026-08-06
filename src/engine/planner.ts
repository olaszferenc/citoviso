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
import { isSampleOnly, type Recipe, type RecipeSection, type SectionKind, type SiteData } from "./recipe.js";
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
          emphasis: {
            type: "string",
            enum: ["focal", "normal", "quiet"],
            description:
              "A szekció súlya az oldal-hierarchiában. PONTOSAN EGY szekció legyen 'focal' (a szállás legerősebb aduja, hero utáni pillanat) — a hero és enquiry SOHA. A minta-bemutató modul 'quiet'. Elhagyva = 'normal'.",
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

HIERARCHIA (ez adja a „megtervezett", nem „egymásra dobált" hatást — FONTOS):
- Ne legyen minden szekció egyforma súlyú. Jelölj ki PONTOSAN EGY szekciót \`focal\`-ként: a szállás
  legerősebb, megkülönböztető aduját (általában a galéria, ha sok/erős a fotó; egyébként a features).
  Ez lesz a hero utáni „pillanat", amit a renderer megnagyobbít. A hero és az enquiry SOHA nem focal.
- A minta-bemutató modulok (rooms/reviews/faq, ha nincs valós adat) legyenek \`quiet\`.

VISSZAFOGOTTSÁG (kevesebb, de valódi — ez is a minőség-érzet része):
- Ne halmozz üres minta-modult. Legfeljebb EGYETLEN minta-modult vegyél be bemutatónak; a valós
  adattal bíró szekciókra koncentrálj. Egy rövid, sűrű, őszinte oldal jobb, mint sok töltelék-sáv.

Csak a felsorolt primitíveket, variánsokat, archetípusokat és skineket használd.`;

/** Describe the property to the planner (structured facts, no invented content). */
function describe(data: SiteData): string {
  // Real-data availability is spelled out so the planner can pick the focal asset honestly and
  // mark the data-less sample modules `quiet` (ADR-0025 ①②) — no invented content.
  return [
    `Szállás neve: ${data.name}`,
    `Alcím: ${data.tagline}`,
    `Bemutatkozó: ${data.intro}`,
    `Kiemelések (${data.highlights.length} db): ${data.highlights.join(", ") || "nincs"}`,
    `Fotók száma: ${data.photos.length}`,
    `Valós szobák: ${data.rooms?.length ?? 0}`,
    `Valós vendégértékelések: ${data.reviews?.length ?? 0}`,
    `Valós GYIK: ${data.faqs?.length ?? 0}`,
    `Értékelés: ${data.rating ? `${data.rating.value}★ (${data.rating.count ?? "?"} db)` : "nincs"}`,
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

/** ADR-0025 ① restraint: the cold MOCK must not pad with sample filler. Keep at most ONE
 *  sample-only module (rooms > reviews > faq preference) as a single clearly-marked demo;
 *  real-data modules are never capped. Fewer, denser, honest sections read as designed, not
 *  dumped — and it tightens mock=live (the live render drops sample-only anyway). */
const SAMPLE_PREF: Readonly<Record<string, number>> = { rooms: 0, reviews: 1, faq: 2 };
function applyRestraint(sections: readonly RecipeSection[], data: SiteData): RecipeSection[] {
  const keep = sections
    .filter((s) => isSampleOnly(s.kind, data))
    .map((s) => s.kind)
    .sort((a, b) => (SAMPLE_PREF[a] ?? 9) - (SAMPLE_PREF[b] ?? 9))[0];
  return sections.filter((s) => !isSampleOnly(s.kind, data) || s.kind === keep);
}

/** Deterministic default focal when the plan named none: the property's strongest PRESENT,
 *  real-data asset. Preference: gallery > features > real rooms/reviews/faq > location > stats. */
const FOCAL_PREF: readonly SectionKind[] = [
  "gallery", "features", "rooms", "reviews", "faq", "location", "stats",
];
function pickDefaultFocal(
  sections: readonly RecipeSection[],
  data: SiteData,
): RecipeSection | undefined {
  for (const k of FOCAL_PREF) {
    const s = sections.find(
      (x) => x.kind === k && x.kind !== "hero" && x.kind !== "enquiry" && !isSampleOnly(x.kind, data),
    );
    if (s) return s;
  }
  return undefined;
}

/** ADR-0025 ② guarantee page hierarchy on ANY recipe: hero/enquiry never focal; sample-only
 *  modules are forced `quiet` (a fabricated-sample section must never be the page's star); and
 *  EXACTLY ONE eligible section is focal (the plan's pick, else a deterministic default). */
function guaranteeEmphasis(sections: readonly RecipeSection[], data: SiteData): RecipeSection[] {
  const strip = (s: RecipeSection): RecipeSection => ({
    kind: s.kind,
    ...(s.variant ? { variant: s.variant } : {}),
    ...(s.copy ? { copy: s.copy } : {}),
  });
  let out: RecipeSection[] = sections.map((s) => {
    if (s.kind === "hero" || s.kind === "enquiry") return strip(s);
    if (isSampleOnly(s.kind, data)) return { ...strip(s), emphasis: "quiet" };
    return s;
  });
  const eligible = out.filter(
    (s) => s.emphasis === "focal" && s.kind !== "hero" && s.kind !== "enquiry" && !isSampleOnly(s.kind, data),
  );
  const chosen = eligible[0] ?? pickDefaultFocal(out, data);
  out = out.map((s) => {
    if (s === chosen) return { ...strip(s), emphasis: "focal" };
    if (s.emphasis === "focal") return strip(s); // demote stray/duplicate focals to normal
    return s;
  });
  return out;
}

/**
 * Guarantee the invariants on ANY recipe (LLM or otherwise): valid kinds only, data-gated
 * modules dropped, deduped, restrained (① one sample demo max), hero first, enquiry spine last,
 * valid skin/archetype, each section's variant normalized to its kind, and exactly one focal
 * (② page hierarchy). The LLM's variant/emphasis CHOICE is preserved when valid.
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

  // ① Restraint (ADR-0025): NO forced sample padding. The planner decides which module demos to
  // show; here we cap sample-only modules to ONE (the single best demo) so the mock is dense and
  // honest, not a wall of "minta" bands. Real-data rooms/reviews/faq are unaffected.
  secs = applyRestraint(secs, data);
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
  const sections = secs.map((s) => {
    const nv = normalizeVariant(s.kind, s.variant);
    // Carry the plan's editorial copy + emphasis through variant-normalization (both are additive
    // meta the normalizer would otherwise drop).
    const meta: RecipeSection = {
      kind: nv.kind,
      ...(nv.variant ? { variant: nv.variant } : {}),
      ...(s.copy ? { copy: s.copy } : {}),
      ...(s.emphasis ? { emphasis: s.emphasis } : {}),
    };
    const pv = preferred[meta.kind];
    return !meta.variant && pv && PRIMITIVES[meta.kind].variants[pv]
      ? { ...meta, variant: pv }
      : meta;
  });

  // ② Page hierarchy: guarantee exactly one focal + sample-only forced quiet (ADR-0025).
  return { skin, archetype, sections: guaranteeEmphasis(sections, data) };
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
  // pairings can take effect; explicit copy + emphasis (the focal intent) stay attached by kind.
  const sections = recipe.sections.map(({ kind, copy, emphasis }) => ({ kind, copy, emphasis }));
  return enforce({ ...recipe, archetype, sections }, data);
}

/** Deterministic fallback result: the default recipe run through enforce() so ① restraint and
 *  ② the focal guarantee apply even without an API key (mirrors the AI path's guarantees). */
function fallback(data: SiteData): PlanResult {
  return { recipe: enforce(defaultRecipe(data), data), source: "fallback" };
}

/** Plan a recipe for the given site data. AI proposes; enforce() guarantees. */
export async function planRecipe(data: SiteData): Promise<PlanResult> {
  if (!config.anthropicApiKey) return fallback(data);
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
    if (!block || block.type !== "text") return fallback(data);
    const raw = JSON.parse(block.text) as Recipe;
    return { recipe: enforce(raw, data), source: "ai" };
  } catch {
    return fallback(data);
  }
}
