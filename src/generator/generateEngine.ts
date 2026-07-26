// Engine-backed mock generation (ADR-0016). Unlike the AI-HTML path (generate.ts), this
// builds a STRUCTURED Recipe + SiteData and renders deterministically through the
// composition engine — then PERSISTS both into mock_artifact.inputs. That persisted pair
// is what lets convertLead later re-render the LIVE page identically (mock=live), instead
// of copying a monolithic HTML snapshot that drifts from the data.
//
// Additive & reversible: the AI-HTML path (generateMock) is untouched. This shares its
// trust-critical helpers (resolveRegion / resolveGatedPhotos — the A4 photo gate) so the
// confidence rule can never drift between the two paths.

import { writeFile } from "node:fs/promises";

import { writeEditorialCopy, type EditorialCopy } from "../engine/copywriter.js";
import { planRecipe } from "../engine/planner.js";
import type { Recipe, RecipeSection, SiteData, Stat } from "../engine/recipe.js";
import { renderSite } from "../engine/render.js";
import { leadToSiteData } from "../engine/siteData.js";
import { generateBrief } from "./brief.js";
import { checkDesign } from "./designCheck.js";
import { getRegionContext, resolveGatedPhotos, resolveRegion, slugify } from "./generate.js";
import { streetViewUrl } from "./images.js";
import { loadLead, recordMockArtifact, type LoadedLead } from "./persist.js";
import { injectRuntime } from "./runtime.js";

export interface EngineGenerateResult {
  readonly artifactId: string;
  readonly path: string;
  readonly leadName: string;
  readonly engine: "composition";
  readonly skin: string;
  readonly archetype: string;
  readonly sections: string[];
  readonly photos: number;
  /** Did the AI planner choose the recipe, or the deterministic fallback? */
  readonly recipeSource: "ai" | "fallback";
  readonly designVerdict: "pass" | "flag";
}

/** Attach the editorial copy to each section by kind, and prefer the editorial hero (with a
 *  photo) + the asymmetric showcase rooms — the ADR-0019 "wow" lift, baked into the recipe so
 *  the later LIVE re-render reproduces it identically (mock=live). Copy is generated ONCE here;
 *  convertLead re-renders from this persisted recipe (never re-runs the copywriter). */
function enrichRecipe(
  recipe: Recipe,
  copy: EditorialCopy,
  hasPhotos: boolean,
  hasStats: boolean,
): Recipe {
  const withCopy = (s: RecipeSection): RecipeSection => {
    switch (s.kind) {
      case "hero":
        return { kind: "hero", variant: hasPhotos ? "editorial" : s.variant, copy: copy.hero };
      case "rooms":
        return { kind: "rooms", variant: "showcase", copy: copy.rooms };
      case "features":
        return { ...s, copy: copy.features };
      case "gallery":
        return { ...s, copy: copy.gallery };
      case "reviews":
        return { ...s, copy: copy.reviews };
      case "faq":
        return { ...s, copy: copy.faq };
      default:
        return s;
    }
  };
  const sections = recipe.sections.map(withCopy);
  // Ensure a stats band renders the real Google rating (the planner may omit it). Insert right
  // after the hero. renderSite still drops it if the data is absent (data-only, never fabricated).
  if (hasStats && !sections.some((s) => s.kind === "stats")) {
    const heroAt = sections.findIndex((s) => s.kind === "hero");
    sections.splice(heroAt + 1, 0, { kind: "stats" });
  }
  return { ...recipe, sections };
}

/**
 * Generate a mock through the composition engine and record the mock_artifact, persisting
 * the recipe + SiteData for a later deterministic LIVE re-render (mock=live). Photo usage
 * is A4 confidence-gated (shared with generateMock); no photos → gallery is data-gated out.
 * The editorial copywriter + motion layer (ADR-0019) lift the output to the reference "wow"
 * bar; the copy is baked into the persisted recipe so live cannot diverge from the mock.
 */
export async function generateEngineMock(
  loaded: LoadedLead,
  regionId?: string,
): Promise<EngineGenerateResult> {
  const { id: leadId, lead } = loaded;
  const region = resolveRegion(regionId, lead.lat, lead.lon);
  const ctx = getRegionContext(region.id, region.label);

  // Same trust-gated media as the AI path (A4). Fall back to a Street View baseline for
  // grounding the copy when there are no Places photos.
  const { photos, rating, userRatingCount } = await resolveGatedPhotos(lead);
  const hero =
    photos[0] ?? (lead.lat != null && lead.lon != null ? streetViewUrl(lead.lat, lead.lon) : "");
  const groundImages = photos.length ? photos : hero ? [hero] : [];

  // Real Google rating as a fact-safe stat (rides the same A4 gate; never fabricated). No "★"
  // glyph — the design doctrine mandates SVG stars, not the character (designCheck emoji gate).
  const stats: Stat[] = rating
    ? [
        {
          value: `${rating}`.replace(".", ","),
          label: `Google-értékelés · ${userRatingCount ?? "?"} vélemény`,
          icon: "star",
        },
      ]
    : [];

  // Copy from the AI brief, grounded on the real photos (no key → fact-safe fallback in the
  // mapping). The engine never fabricates a hard fact: name/contact come off the lead. A
  // brief failure (e.g. an image URL disallowed by the vision API) must NOT fail generation
  // — fall back to region-only copy; the photos/name/contact still render.
  let brief: Awaited<ReturnType<typeof generateBrief>> = null;
  try {
    brief = await generateBrief({
      name: lead.name,
      region: region.label,
      regionContext: ctx.tagline,
      imageUrls: groundImages,
    });
  } catch (err) {
    console.warn(`  [engine] brief kihagyva → fact-safe fallback: ${(err as Error).message}`);
  }

  const siteData: SiteData = {
    ...leadToSiteData(lead, {
      copy: brief
        ? { tagline: brief.tagline, intro: brief.intro, highlights: brief.highlights }
        : null,
      photos: photos.map((url, i) => ({ url, alt: `${lead.name} — ${i + 1}. kép` })),
      regionTagline: ctx.tagline,
    }),
    stats,
    // Structured facts for SEO/JSON-LD (§H) — real geo + rating only; never fabricated.
    ...(lead.lat != null && lead.lon != null ? { geo: { lat: lead.lat, lon: lead.lon } } : {}),
    ...(rating != null ? { rating: { value: rating, count: userRatingCount } } : {}),
  };

  // The engine's composition step (planner) + editorial voice step (copywriter), then the
  // copy + preferred variants are baked into the recipe (ADR-0019). Deterministic render after.
  const { recipe, source } = await planRecipe(siteData);
  const editorial = await writeEditorialCopy(siteData, region.label);
  const finalRecipe = enrichRecipe(recipe, editorial, photos.length > 0, stats.length > 0);
  const baseHtml = renderSite(finalRecipe, siteData);
  const html = await injectRuntime(baseHtml);

  const path = `mock-${slugify(lead.name)}-engine.html`;
  await writeFile(path, html, "utf8");

  // Design-doctrine gate (deterministic): emoji-free, 11 --cit-* tokens, booking hook.
  const design = checkDesign(html);
  console.log(
    design.verdict === "pass"
      ? "  ✅ dizájn-doktrína: PASS"
      : `  ⛔ dizájn-doktrína: FLAG → kurátor-sor · ${design.reason}`,
  );

  // Persist the STRUCTURED recipe + data — the mock=live foundation. convertLead will
  // re-render the live page from exactly this (no HTML copy). inputs is jsonb (no migration).
  const artifactId = await recordMockArtifact({
    leadId,
    path,
    inputs: {
      engine: "composition",
      skin: finalRecipe.skin,
      archetype: finalRecipe.archetype,
      recipe: finalRecipe as unknown as Record<string, unknown>,
      siteData: siteData as unknown as Record<string, unknown>,
      region: region.label,
      regionId: region.id,
      photos: photos.length,
      recipeSource: source,
      designVerdict: design.verdict,
    },
  });

  return {
    artifactId,
    path,
    leadName: lead.name,
    engine: "composition",
    skin: finalRecipe.skin,
    archetype: finalRecipe.archetype,
    sections: finalRecipe.sections.map((s) => s.kind),
    photos: photos.length,
    recipeSource: source,
    designVerdict: design.verdict,
  };
}

/** Convenience for the CLI: resolve a lead by id/name/most-recent, then engine-generate. */
export async function generateEngineMockFor(
  idOrName?: string,
  regionId = "badacsony",
): Promise<EngineGenerateResult> {
  const loaded = await loadLead(idOrName);
  return generateEngineMock(loaded, regionId);
}
