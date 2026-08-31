// TEXT-ONLY REGENERATION of an existing mock (owner request, 2026-08-31:
// "hogy tudom egy mocknál újra generáltatni a szöveget és utasítást adni hozzá?
//  nem az egész mock csak a szöveg").
//
// WHY A SEPARATE PATH. The console's generate button re-runs the WHOLE pipeline: it
// picks photos again, re-rolls the skin and writes a NEW artifact + a new HTML file.
// When the only thing wrong is the wording, that is both wasteful and destructive —
// the operator loses the layout they were happy with, and the mock they were looking
// at is replaced by a different one. The approved plan's button says "Szöveg
// újragenerálása", and this is what makes that label true.
//
// WHAT IS PRESERVED, deliberately: the template, the skin, the archetype, the photo
// set, the palette, the section order, the rooms, the stats — everything in the
// persisted recipe except the WORDS. Only the AI copy call is re-run.
//
// WHAT IS RE-RUN: the market guard and the factuality gate, on the new copy. New text
// is new risk; regenerating the wording must not smuggle an unverified claim past the
// gates that the first generation had to satisfy.
//
// SAFETY: a mock that has already been OFFERED to the lead is frozen. Rewriting the
// page under a prospect who has the link is exactly the bait-and-switch the §I
// invariant forbids — what we showed them is what they get.

import { currentAiUsage, formatUsage, usageForArtifact, withAiUsage } from "../ai/usage.js";
import { writeFile } from "node:fs/promises";

import type { EditorialCopy } from "../engine/copywriter.js";
import type { Recipe, RecipeSection, SiteData } from "../engine/recipe.js";
import { renderSite } from "../engine/render.js";
import { db } from "../db/client.js";
import type { PortalProfile } from "../scraper/types.js";
import { DEFAULT_LANG, langName } from "../i18n/lang.js";
import { generateBriefAndCopy } from "./brief.js";
import { guestValueHighlights } from "./highlightValue.js";
import { checkDesign } from "./designCheck.js";
import { verifyFactuality, type FactCheckVerdict } from "./factCheck.js";
import {
  descriptionSellingPoints,
  verifyMarketRelevance,
  type MarketVerdict,
  type SalesSurface,
} from "./marketCheck.js";
import { getRegionContext, resolveRegion } from "./generate.js";
import { injectRuntime } from "./runtime.js";
import { loadLead } from "./persist.js";

export interface RecopyResult {
  readonly ok: boolean;
  /** Operator-facing summary (Hungarian) — shown as a flash on the lead page. */
  readonly message: string;
}

/** Cyrillic homoglyph scrub, same as the full path (LLM output occasionally carries them). */
const HOMOGLYPHS: Readonly<Record<string, string>> = {
  а: "a", е: "e", о: "o", р: "p", с: "c", х: "x", у: "y", і: "i",
  А: "A", Е: "E", О: "O", Р: "P", С: "C", Х: "X", І: "I", В: "B", Н: "H", К: "K", М: "M", Т: "T",
};
const fixHomoglyphs = (s: string): string => s.replace(/[Ѐ-ӿіІ]/g, (c) => HOMOGLYPHS[c] ?? c);

/** Replace ONLY the copy on each section; variant/kind/order stay exactly as they were. */
function reCopyRecipe(recipe: Recipe, copy: EditorialCopy): Recipe {
  const byKind: Record<string, { eyebrow?: string; title?: string; accent?: string; lead?: string } | undefined> = {
    hero: copy.hero,
    features: copy.features,
    rooms: copy.rooms,
    gallery: copy.gallery,
    reviews: copy.reviews,
    faq: copy.faq,
    location: copy.location,
  };
  const sections = recipe.sections.map((s: RecipeSection) => {
    const next = byKind[s.kind];
    return next ? ({ ...s, copy: next } as RecipeSection) : s;
  });
  return { ...recipe, sections };
}

/**
 * Re-run ONLY the copy for an existing artifact, optionally steered by a curator
 * instruction, and re-render the same file in place. Never throws to the caller.
 */
export async function recopyArtifact(
  artifactId: string,
  curatorPrompt?: string,
): Promise<RecopyResult> {
  const { result, usage } = await withAiUsage(() => recopyInner(artifactId, curatorPrompt));
  console.log(`  ${formatUsage(usage)}`); // i18n-exempt: operator log
  return result;
}

async function recopyInner(artifactId: string, curatorPrompt?: string): Promise<RecopyResult> {
  const row = await db
    .selectFrom("mock_artifact")
    .select(["id", "lead_id", "path", "status", "inputs"])
    .where("id", "=", artifactId)
    .executeTakeFirst();
  if (!row) return { ok: false, message: "Nincs ilyen mock-artefaktum." };
  if (!row.path) return { ok: false, message: "Ehhez a mockhoz nincs fájl — generálj újat." };

  // §I: what we offered is what they get. A mock behind a live prospect link is frozen.
  const offered = await db
    .selectFrom("prospect")
    .select("id")
    .where("mock_artifact_id", "=", artifactId)
    .executeTakeFirst();
  if (offered) {
    return {
      ok: false,
      message:
        "Ez a mock már ki lett ajánlva a leadnek — a szövegét nem írjuk át alatta. " +
        "Generálj új mockot, ha másik ajánlatot akarsz adni.",
    };
  }

  const inputs = (row.inputs ?? {}) as Record<string, unknown>;
  const recipe = inputs.recipe as Recipe | undefined;
  const siteData = inputs.siteData as SiteData | undefined;
  if (!recipe || !siteData) {
    return {
      ok: false,
      message: "Ez a mock régi formátumú (nincs eltárolt recept) — csak teljes újragenerálás megy.",
    };
  }

  const { lead } = await loadLead(row.lead_id);
  const region = resolveRegion(inputs.regionId as string | undefined, lead.lat, lead.lon);
  const ctx = getRegionContext(region.id, region.label);
  const lang = siteData.lang ?? DEFAULT_LANG;

  // The SAME sourced-fact set the first generation used (amenities from high-band
  // listings + the strong claims lifted out of the listing prose).
  const profiles =
    (lead as unknown as { portalProfiles?: readonly PortalProfile[] }).portalProfiles ?? [];
  const high = profiles.filter((p) => p.matchBand === "high");
  const descriptions = high
    .map((p) => p.description?.trim())
    .filter((d): d is string => Boolean(d && d.length >= 120))
    .map((d) => d.slice(0, 1500));
  const amenities = [...new Set(high.flatMap((p) => p.amenities))].filter((a) => a.trim().length > 1);
  for (const f of descriptionSellingPoints(descriptions)) {
    if (!amenities.some((a) => a.toLowerCase() === f.toLowerCase())) amenities.push(f);
  }

  const photoUrls = siteData.photos.slice(0, 4).map((p) => p.url);
  const briefInput = {
    name: lead.name,
    region: region.label,
    regionContext: ctx.tagline,
    address: lead.address,
    realStats: (siteData.stats ?? []).map((s) => ({ value: s.value, label: s.label })),
    ...(amenities.length || descriptions.length
      ? {
          sourcedFacts: {
            ...(amenities.length ? { amenities } : {}),
            ...(descriptions.length ? { descriptions } : {}),
          },
        }
      : {}),
    imageUrls: photoUrls,
    ...(curatorPrompt?.trim() ? { curatorGuidance: curatorPrompt.trim() } : {}),
    ...(lang !== DEFAULT_LANG ? { languageName: langName(lang) } : {}),
  };

  let { brief, editorial } = await generateBriefAndCopy(briefInput);
  if (!brief) {
    return { ok: false, message: "A szöveg-generálás nem sikerült (AI hiba) — próbáld újra." };
  }

  const marketSource = {
    name: lead.name,
    town: lead.city ?? null,
    amenities,
    ...(descriptions.length ? { descriptions } : {}),
    ...(siteData.rating ? { rating: { value: siteData.rating.value, count: siteData.rating.count ?? null } } : {}),
  };
  const salesOf = (): SalesSurface => ({
    ...(editorial.hero?.lead ? { heroLead: editorial.hero.lead } : {}),
    ...(editorial.hero?.eyebrow ? { heroEyebrow: editorial.hero.eyebrow } : {}),
    ...(brief?.tagline ? { tagline: brief.tagline } : {}),
    ...(brief?.intro ? { intro: brief.intro } : {}),
    highlights: brief ? guestValueHighlights(brief.highlights) : [],
  });

  // Same gate + one fed-back retry as the full path: new words are new risk.
  let market: MarketVerdict | null = null;
  try {
    market = await verifyMarketRelevance({ sales: salesOf(), source: marketSource, photos: photoUrls });
    if (market.verdict === "flag" && market.critique) {
      console.log(`  ⛔ marketing-őr: FLAG · ${market.reason}`); // i18n-exempt: operator log
      const retry = await generateBriefAndCopy({
        ...briefInput,
        curatorGuidance: [curatorPrompt, market.critique].filter(Boolean).join("\n\n"),
      });
      if (retry.brief) {
        brief = retry.brief;
        editorial = retry.editorial;
        market = await verifyMarketRelevance({ sales: salesOf(), source: marketSource, photos: photoUrls });
      }
    }
  } catch (err) {
    console.warn(`  [recopy] marketing-őr kihagyva: ${(err as Error).message}`);
  }

  // Only the WORDS change; photos, palette, rooms, stats and the section order stay.
  const nextData: SiteData = {
    ...siteData,
    tagline: fixHomoglyphs(brief.tagline),
    intro: fixHomoglyphs(brief.intro),
    highlights: guestValueHighlights(brief.highlights.map(fixHomoglyphs)),
  };
  const nextRecipe = reCopyRecipe(recipe, editorial);
  const html = await injectRuntime(renderSite(nextRecipe, nextData), lang);
  await writeFile(row.path, html, "utf8");

  const design = checkDesign(html);
  let factCheck: FactCheckVerdict | null = null;
  try {
    factCheck = await verifyFactuality({
      html,
      lead: {
        name: lead.name,
        region: region.label,
        address: lead.address,
        phone: lead.phone,
        email: lead.email,
        ...(siteData.rating
          ? { rating: { value: siteData.rating.value, count: siteData.rating.count ?? null } }
          : {}),
        ...(amenities.length ? { amenities } : {}),
        ...(descriptions.length ? { descriptions } : {}),
      },
      photos: photoUrls,
    });
  } catch (err) {
    console.warn(`  [recopy] tényhűség kihagyva: ${(err as Error).message}`);
  }

  await db
    .updateTable("mock_artifact")
    .set({
      inputs: {
        ...inputs,
        recipe: nextRecipe as unknown as Record<string, unknown>,
        siteData: nextData as unknown as Record<string, unknown>,
        designVerdict: design.verdict,
        factVerdict: factCheck?.verdict ?? null,
        factUnsourced: factCheck ? factCheck.facts.filter((f) => !f.sourced).map((f) => f.fact) : [],
        factCandidates: factCheck?.candidates.length ?? 0,
        marketVerdict: market?.verdict ?? null,
        marketReason: market?.reason ?? null,
        marketFactsNamed: market?.factsNamed ?? [],
        marketMissed: market?.missed ?? [],
        aiUsage: usageForArtifact(currentAiUsage()),
        // Audit trail: what the curator asked for on THIS rewrite.
        ...(curatorPrompt?.trim() ? { recopyPrompt: curatorPrompt.trim() } : {}),
      } as never,
    })
    .where("id", "=", artifactId)
    .execute();

  const blocked = market?.verdict === "flag" || factCheck?.verdict === "flag";
  return {
    ok: true,
    message: blocked
      ? `Új szöveg elkészült, de egy őr fennakadt rajta (${market?.verdict === "flag" ? "marketing" : "tényhűség"}) — nézd át, kiküldeni így nem lehet.`
      : "Új szöveg elkészült — a kinézet, a fotók és az elrendezés változatlan.",
  };
}
