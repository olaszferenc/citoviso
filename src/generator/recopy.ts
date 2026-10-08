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

import { addRunToArtifactUsage, currentAiUsage, formatUsage } from "../ai/usage.js";
import { AiDailyCapError, withMockBudget } from "../ai/dailyCap.js";
import { writeFile } from "node:fs/promises";

import type { EditorialCopy } from "../engine/copywriter.js";
import type { Recipe, RecipeSection, SiteData } from "../engine/recipe.js";
import { getDisabledModules, sampleDenyKeys } from "../moduleSales.js";
import { renderSite } from "../engine/render.js";
import { db } from "../db/client.js";
import { DEFAULT_LANG, langName } from "../i18n/lang.js";
import { applyManualCopy, applyManualToSurface, manualCopyOf } from "../engine/copyFields.js";
import { criticFactsOf, factLeadOf, loadCopySources, marketSourceOf } from "./copySources.js";
import { explainAiFailure, generateBriefAndCopy } from "./brief.js";
import { applyGuestCritic, criticSourceOf } from "./guestCritic.js";
import { guestValueHighlights } from "./highlightValue.js";
import { checkDesign } from "./designCheck.js";
import { verifyFactuality, type FactCheckVerdict } from "./factCheck.js";
import { subordinateToCriticInputs, verifyMarketRelevance, type MarketVerdict, type SalesSurface } from "./marketCheck.js";
import { injectRuntime } from "./runtime.js";
import { secureMockPhotos } from "./photoTransport.js";

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
  let run;
  try {
    run = await withMockBudget(() => recopyInner(artifactId, curatorPrompt));
  } catch (err) {
    // The daily AI ceiling is a refusal, not a crash — this function never throws.
    if (err instanceof AiDailyCapError) return { ok: false, message: err.message };
    throw err;
  }
  console.log(`  ${formatUsage(run.usage)}`); // i18n-exempt: operator log
  return run.result;
}

async function recopyInner(artifactId: string, curatorPrompt?: string): Promise<RecopyResult> {
  const row = await db
    .selectFrom("mock_artifact")
    .select(["id", "lead_id", "path", "status", "inputs", "generated_at"])
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

  // One source assembly for both post-generation paths (copySources.ts).
  const sources = await loadCopySources(row.lead_id, inputs, siteData);
  const { lead, region, ctx, lang, descriptions, amenities, photoUrls } = sources;
  // D3 (ADR-0323): the curator's hand-written fields are FIXED — the rewrite fills only the
  // rest, and every guard below judges the overlaid text, i.e. what will actually ship.
  const manual = manualCopyOf(inputs);
  const briefInput = {
    name: lead.name,
    // Same rule as the first generation (generateEngine): no `region` record → no area
    // NAME, so the phrase is dropped rather than filled with the scrape key. A rewrite
    // that re-introduced it would undo the fix on the very next "szöveg újraírása".
    ...(region.known ? { region: region.label, regionContext: ctx.tagline } : {}),
    address: lead.address,
    town: lead.city ?? null,
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

  let { brief, editorial, sellingPoints } = await generateBriefAndCopy(briefInput);
  const withManual = (): void => {
    if (!brief) return;
    const o = applyManualToSurface({ ...brief, editorial: { ...editorial } as Record<string, never> }, manual);
    brief = { ...brief, tagline: o.tagline, intro: o.intro, highlights: [...o.highlights] };
    editorial = o.editorial as EditorialCopy;
  };
  withManual();
  if (!brief) {
    // Say WHAT went wrong, not just THAT it did (2026-09-07): three of the owner's
    // requests died on an empty API credit balance while the screen stayed silent.
    const why = explainAiFailure();
    return {
      ok: false,
      message: why
        ? `A szöveg nem készült el: ${why}.`
        : "A szöveg-generálás nem sikerült (AI hiba) — próbáld újra.",
    };
  }
  // Quote-verified open-vocabulary facts join the guard's source (see generateEngine).
  for (const sp of sellingPoints) {
    if (!amenities.some((a) => a.toLowerCase() === sp.label.toLowerCase())) amenities.push(sp.label);
  }

  const marketSource = marketSourceOf(sources, siteData);
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
        withManual();
        market = await verifyMarketRelevance({ sales: salesOf(), source: marketSource, photos: photoUrls });
      }
    }
  } catch (err) {
    console.warn(`  [recopy] marketing-őr kihagyva: ${(err as Error).message}`);
  }

  // Guest-critic (ADR-0292) — same last word as the full path: new words are new risk.
  // Facts: the listing set used above, plus the first generation's review-backed facts
  // (sourcePanel) so a review quote is still recognised as a REVIEW (ruling B) here.
  let criticInputs: Record<string, unknown> = {};
  if (lang === DEFAULT_LANG) {
    const facts = criticFactsOf(sources, inputs, sellingPoints);
    const critic = await applyGuestCritic(
      { tagline: brief.tagline, intro: brief.intro, highlights: brief.highlights, editorial },
      criticSourceOf({
        name: lead.name,
        town: lead.city ?? null,
        address: lead.address,
        rating: siteData.rating ? { value: siteData.rating.value, count: siteData.rating.count ?? null } : null,
        facts,
        descriptions,
        reviews: [],
      }),
    );
    brief = { ...brief, tagline: critic.copy.tagline, intro: critic.copy.intro, highlights: [...critic.copy.highlights] };
    editorial = critic.copy.editorial;
    // The critic may have rewritten a hand-written field — the curator's words win (D2/D3).
    withManual();
    criticInputs = critic.inputs;
    // The market verdict follows the SHIPPED copy, not the pre-critic one (OP-1) — same
    // rule as generateEngine: re-judged, never regenerated; a failure is an error verdict.
    if (market) {
      try {
        market = await verifyMarketRelevance({ sales: salesOf(), source: marketSource, photos: photoUrls });
      } catch (err) {
        market = { verdict: "error", layer: "judge", factsNamed: [], missed: [], reason: `a kiszállított szöveg nem ítélhető: ${(err as Error).message}` }; // i18n-exempt: operator-facing verdict reason (console)
      }
    }
  }
  // The critic wins a contradiction (ADR-0328): what it objected to, the market may not demand.
  if (market) market = subordinateToCriticInputs(market, criticInputs, marketSource);

  // Only the WORDS change; photos, palette, rooms, stats and the section order stay.
  const nextData: SiteData = {
    ...siteData,
    tagline: fixHomoglyphs(brief.tagline),
    intro: fixHomoglyphs(brief.intro),
    highlights: guestValueHighlights(brief.highlights.map(fixHomoglyphs)),
  };
  const overlaid = applyManualCopy(reCopyRecipe(recipe, editorial), nextData, manual);
  const nextRecipe = overlaid.recipe;
  const nextSiteData = overlaid.data;
  // Module-sales switch: the re-copied mock obeys the same sample deny as generation.
  const html = await injectRuntime(
    renderSite(nextRecipe, nextSiteData, { sampleDeny: sampleDenyKeys(await getDisabledModules()) }),
    lang,
  );
  // http-s fotó a https-es mockon nem jelenik meg (ADR-XXXX): https-emelés vagy saját proxy.
  const secured = await secureMockPhotos(html, String(row.id), (nextSiteData.photos ?? []).map((p) => p.url));
  await writeFile(row.path, secured.html, "utf8");

  const design = checkDesign(html);
  let factCheck: FactCheckVerdict | null = null;
  try {
    factCheck = await verifyFactuality({
      html,
      lead: factLeadOf(sources, siteData, inputs),
      photos: photoUrls,
    });
  } catch (err) {
    console.warn(`  [recopy] tényhűség kihagyva: ${(err as Error).message}`);
  }

  await db
    .updateTable("mock_artifact")
    .set({
      inputs: {
        // ADR-0329: the AI rewrote the words and its guards judged them — a review Vera gave
        // on the previous text (or a "pending" one) no longer describes this page.
        ...Object.fromEntries(
          Object.entries(inputs).filter(([k]) => !["review", "reviewVerdict", "reviewReason"].includes(k)),
        ),
        recipe: nextRecipe as unknown as Record<string, unknown>,
        siteData: nextSiteData as unknown as Record<string, unknown>,
        designVerdict: design.verdict,
        designReason: design.reason ?? null,
        factVerdict: factCheck?.verdict ?? null,
        factUnsourced: factCheck ? factCheck.facts.filter((f) => !f.sourced).map((f) => f.fact) : [],
        factCandidates: factCheck?.candidates.length ?? 0,
        marketVerdict: market?.verdict ?? null,
        marketReason: market?.reason ?? null,
        marketFactsNamed: market?.factsNamed ?? [],
        marketMissed: market?.missed ?? [],
        ...criticInputs,
        // ADDED to the generation's spend, never overwriting it (dated per run for the daily cap).
        aiUsage: addRunToArtifactUsage(inputs.aiUsage, new Date(row.generated_at as unknown as string), currentAiUsage(), new Date()),
        // Audit trail: what the curator asked for on THIS rewrite.
        ...(curatorPrompt?.trim() ? { recopyPrompt: curatorPrompt.trim() } : {}),
      } as never,
    })
    .where("id", "=", artifactId)
    .execute();

  const criticBlocked = criticInputs.guestCriticVerdict === "flag" || criticInputs.guestCriticVerdict === "error";
  const blocked = market?.verdict === "flag" || factCheck?.verdict === "flag" || criticBlocked;
  return {
    ok: true,
    message: blocked
      ? `Új szöveg elkészült, de egy őr fennakadt rajta (${market?.verdict === "flag" ? "marketing" : factCheck?.verdict === "flag" ? "tényhűség" : "vendég-kritikus"}) — nézd át, kiküldeni így nem lehet.`
      : "Új szöveg elkészült — a kinézet, a fotók és az elrendezés változatlan.",
  };
}
