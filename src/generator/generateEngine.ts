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

import { planRecipe } from "../engine/planner.js";
import type { SiteData } from "../engine/recipe.js";
import { renderSite } from "../engine/render.js";
import { leadToSiteData } from "../engine/siteData.js";
import { generateBrief } from "./brief.js";
import { checkDesign } from "./designCheck.js";
import { getRegionContext, resolveGatedPhotos, resolveRegion, slugify } from "./generate.js";
import { streetViewUrl } from "./images.js";
import { recordMockArtifact, type LoadedLead } from "./persist.js";
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

/**
 * Generate a mock through the composition engine and record the mock_artifact, persisting
 * the recipe + SiteData for a later deterministic LIVE re-render (mock=live). Photo usage
 * is A4 confidence-gated (shared with generateMock); no photos → gallery is data-gated out.
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
  const { photos } = await resolveGatedPhotos(lead);
  const hero =
    photos[0] ?? (lead.lat != null && lead.lon != null ? streetViewUrl(lead.lat, lead.lon) : "");
  const groundImages = photos.length ? photos : hero ? [hero] : [];

  // Copy from the AI brief, grounded on the real photos (no key → fact-safe fallback in the
  // mapping). The engine never fabricates a hard fact: name/contact come off the lead.
  const brief = await generateBrief({
    name: lead.name,
    region: region.label,
    regionContext: ctx.tagline,
    imageUrls: groundImages,
  });

  const siteData: SiteData = leadToSiteData(lead, {
    copy: brief
      ? { tagline: brief.tagline, intro: brief.intro, highlights: brief.highlights }
      : null,
    photos: photos.map((url, i) => ({ url, alt: `${lead.name} — ${i + 1}. kép` })),
    regionTagline: ctx.tagline,
  });

  // The engine's ONE AI step (composition), then deterministic render + module hydration.
  const { recipe, source } = await planRecipe(siteData);
  const baseHtml = renderSite(recipe, siteData);
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
      skin: recipe.skin,
      archetype: recipe.archetype,
      recipe: recipe as unknown as Record<string, unknown>,
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
    skin: recipe.skin,
    archetype: recipe.archetype,
    sections: recipe.sections.map((s) => s.kind),
    photos: photos.length,
    recipeSource: source,
    designVerdict: design.verdict,
  };
}
