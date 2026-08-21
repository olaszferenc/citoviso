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
import { planRecipe, withArchetype } from "../engine/planner.js";
import type { Recipe, RecipeSection, SiteData, Stat } from "../engine/recipe.js";
import { renderSite } from "../engine/render.js";
import { parseHex } from "../engine/palette.js";
import { leadToSiteData, toSitePhotos } from "../engine/siteData.js";
import { SKINS } from "../engine/skins.js";
import { pickTemplateSkin, TEMPLATES } from "../engine/templates.js";
import { T } from "../engine/templateKit.js";
import { db } from "../db/client.js";
import { DEFAULT_LANG, langForCountry, langName } from "../i18n/lang.js";
import { ensureLanguagePack } from "../i18n/packs.js";
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
  /** Recipe origin: art template (ADR-0027 default), AI planner, or deterministic fallback. */
  readonly recipeSource: "template" | "ai" | "fallback";
  readonly designVerdict: "pass" | "flag";
}

// Cyrillic → Latin homoglyph map. LLM output occasionally carries lookalike Cyrillic letters
// inside Hungarian words (e.g. "е" U+0435 in "teraszon") — invisible on screen but breaking
// search/matching (the fact guard caught one in production). Applied to all brief-derived text.
const HOMOGLYPHS: Readonly<Record<string, string>> = {
  а: "a", е: "e", о: "o", р: "p", с: "c", х: "x", у: "y", і: "i",
  А: "A", Е: "E", О: "O", Р: "P", С: "C", Х: "X", І: "I", В: "B", Н: "H", К: "K", М: "M", Т: "T",
};

function fixHomoglyphs(s: string): string {
  return s.replace(/[Ѐ-ӿіІ]/g, (ch) => HOMOGLYPHS[ch] ?? ch);
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
  // Copy-aware premium hero variants (all render copy.lead as the H1). An archetype-paired
  // pick from this set is respected; anything else upgrades to the editorial default.
  const PREMIUM_HEROES = new Set(["editorial", "centered", "collage", "masthead"]);
  // Reference-bar rooms treatments; an archetype-paired pick is respected, else showcase.
  const PREMIUM_ROOMS = new Set(["showcase", "boutique", "suites-scroll"]);
  const withCopy = (s: RecipeSection): RecipeSection => {
    switch (s.kind) {
      case "hero":
        return {
          kind: "hero",
          variant: hasPhotos ? (PREMIUM_HEROES.has(s.variant ?? "") ? s.variant : "editorial") : s.variant,
          copy: copy.hero,
        };
      case "rooms":
        return {
          ...s,
          variant: PREMIUM_ROOMS.has(s.variant ?? "") ? s.variant : "showcase",
          copy: copy.rooms,
        };
      case "features":
        return { ...s, copy: copy.features };
      case "gallery":
        return { ...s, copy: copy.gallery };
      case "reviews":
        return { ...s, copy: copy.reviews };
      case "faq":
        return { ...s, copy: copy.faq };
      case "location":
        return { ...s, copy: copy.location };
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
  opts: { archetype?: string; skin?: string; template?: string; curatorPrompt?: string } = {},
): Promise<EngineGenerateResult> {
  const { id: leadId, lead } = loaded;
  const region = resolveRegion(regionId, lead.lat, lead.lon);
  const ctx = getRegionContext(region.id, region.label);

  // ADR-0036: language derives from the region's country; a new language area auto-provisions
  // its UI-string pack here (one-time per language, deterministic afterwards). A failed/partial
  // pack logs loudly and rendering falls back to Hungarian strings for the missing keys.
  const regionRow = await db
    .selectFrom("region")
    .select("country")
    .where("id", "=", region.id)
    .executeTakeFirst()
    .catch(() => null);
  const lang = langForCountry(regionRow?.country);
  if (lang !== DEFAULT_LANG) await ensureLanguagePack(lang);
  const dLang = { lang }; // identifier form so the i18n extractor picks up T(dLang, "…") calls

  // Same trust-gated media as the AI path (A4): portal-listing images first, then the
  // confidence-gated Places set. Fall back to a Street View baseline for grounding the
  // copy when the lead has no photos at all.
  const { photos, rating, userRatingCount } = await resolveGatedPhotos(lead);
  const hero =
    photos[0]?.url ??
    (lead.lat != null && lead.lon != null ? streetViewUrl(lead.lat, lead.lon) : "");
  const groundImages = photos.length ? photos.map((p) => p.url) : hero ? [hero] : [];

  // Real Google rating as a fact-safe stat (rides the same A4 gate; never fabricated). No "★"
  // glyph — the design doctrine mandates SVG stars, not the character (designCheck emoji gate).
  const stats: Stat[] = rating
    ? [
        {
          value: `${rating}`.replace(".", ","),
          // Translated at generation (the pack is ensured above) and persisted — mock=live.
          label: T(dLang, "Google-értékelés · {n} vélemény", { n: userRatingCount ?? "?" }),
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
      ...(opts.curatorPrompt ? { curatorGuidance: opts.curatorPrompt } : {}),
      ...(lang !== DEFAULT_LANG ? { languageName: langName(lang) } : {}),
    });
  } catch (err) {
    console.warn(`  [engine] brief kihagyva → fact-safe fallback: ${(err as Error).message}`);
  }

  const siteData: SiteData = {
    ...(lang !== DEFAULT_LANG ? { lang } : {}),
    ...leadToSiteData(lead, {
      copy: brief
        ? {
            tagline: fixHomoglyphs(brief.tagline),
            intro: fixHomoglyphs(brief.intro),
            highlights: brief.highlights.map(fixHomoglyphs),
          }
        : null,
      // §A.3: each photo keeps the rights class it was COLLECTED under (portal vs places),
      // so the live photo policy decides on the truth rather than on a blanket stamp.
      photos: toSitePhotos(photos, lead.name),
      regionTagline: ctx.tagline,
    }),
    stats,
    // Structured facts for SEO/JSON-LD (§H) — real geo + rating only; never fabricated.
    ...(lead.lat != null && lead.lon != null ? { geo: { lat: lead.lat, lon: lead.lon } } : {}),
    ...(rating != null ? { rating: { value: rating, count: userRatingCount } } : {}),
    // §B.6: photo-derived per-property accent from the brief (validated HEX). Persisted so the
    // live re-render reproduces it (mock=live); harmonized into the skin's rails at render time.
    ...(brief && parseHex(brief.palette.accent) ? { palette: { accent: brief.palette.accent } } : {}),
  };

  // ADR-0027 template-first: with photos (the hero's fuel) the mock renders through the
  // COMPLETE reference-fidelity art template. The composition path remains for the no-photo
  // case and the explicit curator archetype-override. Skin: deterministic spread over the
  // template's curated list (name-hash) — kills the planner's warm-cream monoculture.
  const DEFAULT_TEMPLATE = "fullbleed";
  if (opts.template && !TEMPLATES[opts.template]) throw new Error(`unknown template: ${opts.template}`);
  const templateId = opts.template ?? DEFAULT_TEMPLATE;
  const useTemplate = !opts.archetype && photos.length > 0 && Boolean(TEMPLATES[templateId]);
  let recipe: Recipe;
  let source: "template" | "ai" | "fallback";
  if (useTemplate) {
    const tpl = TEMPLATES[templateId]!;
    if (opts.skin && !SKINS[opts.skin]) throw new Error(`unknown skin: ${opts.skin}`);
    recipe = {
      template: tpl.id,
      skin: opts.skin ?? pickTemplateSkin(tpl, leadId),
      archetype: "stacked", // unused on the template path; kept valid for back-compat readers
      sections: (["hero", "features", "gallery", "reviews", "location", "enquiry"] as const).map(
        (kind) => ({ kind }),
      ),
    };
    source = "template";
  } else {
    // The engine's composition step (planner); curator/demo override re-targets the plan
    // onto a named archetype and/or skin; the section selection stays the planner's.
    const { recipe: planned, source: plannedSource } = await planRecipe(siteData);
    source = plannedSource;
    recipe = opts.archetype ? withArchetype(planned, opts.archetype, siteData) : planned;
    if (opts.skin) {
      if (!SKINS[opts.skin]) throw new Error(`unknown skin: ${opts.skin}`);
      recipe = { ...recipe, skin: opts.skin };
    }
  }
  const editorial = await writeEditorialCopy(siteData, region.label, opts.curatorPrompt, lang !== DEFAULT_LANG ? langName(lang) : undefined);
  const finalRecipe = enrichRecipe(recipe, editorial, photos.length > 0, stats.length > 0);
  const baseHtml = renderSite(finalRecipe, siteData);
  const html = await injectRuntime(baseHtml, lang);

  // Template variants must not overwrite each other's files (one artifact = one file).
  const path = `mock-${slugify(lead.name)}-${finalRecipe.template ?? "engine"}.html`;
  await writeFile(path, html, "utf8");

  // Design-doctrine gate (deterministic): emoji-free, 11 --cit-* tokens, booking hook.
  const design = checkDesign(html);
  console.log(
    design.verdict === "pass"
      ? "  ✅ dizájn-doktrína: PASS" // i18n-exempt: operator log
      : `  ⛔ dizájn-doktrína: FLAG → kurátor-sor · ${design.reason}`,
  );

  // Persist the STRUCTURED recipe + data — the mock=live foundation. convertLead will
  // re-render the live page from exactly this (no HTML copy). inputs is jsonb (no migration).
  const artifactId = await recordMockArtifact({
    leadId,
    path,
    inputs: {
      engine: "composition",
      template: finalRecipe.template ?? null,
      skin: finalRecipe.skin,
      archetype: finalRecipe.archetype,
      recipe: finalRecipe as unknown as Record<string, unknown>,
      siteData: siteData as unknown as Record<string, unknown>,
      region: region.label,
      regionId: region.id,
      photos: photos.length,
      recipeSource: source,
      designVerdict: design.verdict,
      // Audit trail: the curator's free-text steering that shaped this generation (if any).
      ...(opts.curatorPrompt ? { curatorPrompt: opts.curatorPrompt } : {}),
    },
  });

  return {
    artifactId,
    path,
    leadName: lead.name,
    engine: "composition",
    skin: finalRecipe.skin,
    archetype: finalRecipe.template ? `template:${finalRecipe.template}` : finalRecipe.archetype,
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
  opts: { archetype?: string; skin?: string; template?: string; curatorPrompt?: string } = {},
): Promise<EngineGenerateResult> {
  const loaded = await loadLead(idOrName);
  return generateEngineMock(loaded, regionId, opts);
}
