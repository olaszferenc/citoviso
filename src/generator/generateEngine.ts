// Engine-backed mock generation (ADR-0016). Unlike the AI-HTML path (generate.ts), this
// builds a STRUCTURED Recipe + SiteData and renders deterministically through the
// composition engine — then PERSISTS both into mock_artifact.inputs. That persisted pair
// is what lets convertLead later re-render the LIVE page identically (mock=live), instead
// of copying a monolithic HTML snapshot that drifts from the data.
//
// Additive & reversible: the AI-HTML path (generateMock) is untouched. This shares its
// trust-critical helpers (resolveRegion / resolveGatedPhotos — the A4 photo gate) so the
// confidence rule can never drift between the two paths.

import { currentAiUsage, formatUsage, usageForArtifact, withAiUsage } from "../ai/usage.js";
import { writeFile } from "node:fs/promises";

import type { EditorialCopy } from "../engine/copywriter.js";
import { planRecipe, withArchetype } from "../engine/planner.js";
import type { Recipe, RecipeSection, Room, SiteData, Stat } from "../engine/recipe.js";
import { renderSite } from "../engine/render.js";
import { parseHex } from "../engine/palette.js";
import { leadToSiteData, toSitePhotos } from "../engine/siteData.js";
import { SKINS } from "../engine/skins.js";
import { pickTemplateSkin, TEMPLATES } from "../engine/templates.js";
import { T } from "../engine/templateKit.js";
import { db } from "../db/client.js";
import type { PortalProfile } from "../scraper/types.js";
import { DEFAULT_LANG, langForCountry, langName } from "../i18n/lang.js";
import { ensureLanguagePack } from "../i18n/packs.js";
import { generateBriefAndCopy } from "./brief.js";
import { guestValueHighlights } from "./highlightValue.js";
import { checkDesign } from "./designCheck.js";
import { verifyFactuality, type FactCheckVerdict } from "./factCheck.js";
import { descriptionSellingPoints, groupAmenities, verifyMarketRelevance, type MarketVerdict, type SalesSurface } from "./marketCheck.js";
import { getRegionContext, resolveGatedPhotos, resolveRegion, slugify } from "./generate.js";
import { streetViewUrl } from "./images.js";
import { reviewsUrlFor } from "../reviews/placeRating.js";
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

/** Words that identify no property on their own — never a self-anchor for prose. */
const GENERIC_LEAD_WORD = new Set([
  "apartman", "apartmanhaz", "vendeghaz", "panzio", "hotel", "villa", "szallas",
  "szallashely", "udulo", "nyaralo", "kemping", "porta", "resort", "balaton",
]);

/** The lead's Google place id, as the scraper stored it (sourceRefs.google_places). */
function placeIdOf(lead: LoadedLead["lead"]): string | null {
  // `lead` IS the rehydrated raw record (persist.loadLead), so the refs sit on it.
  const refs = (lead as unknown as { sourceRefs?: Record<string, string> }).sourceRefs;
  const id = refs?.google_places;
  return typeof id === "string" && id.trim() ? id : null;
}

/**
 * REAL rooms from the verified portal listing, when the listing publishes them.
 *
 * Measured before built (2026-08-24): of 36 leads with a portal profile exactly ONE
 * publishes a room list and four publish a room COUNT — so this is not worth a
 * portal-specific parser, but the data we already hold must not go unused. Where a
 * high-band listing names the rooms, the mock shows the REAL rooms instead of
 * numbered placeholders; where it only states how many there are, the placeholder
 * count follows it (owner: "szoba egy, ha van szoba kettő, ha van…"), so at least
 * the SHAPE of the property is true. Only `high` band feeds this: a medium match
 * may be another property (§F.17b), and a wrong room list is a §B.17 violation.
 */
function portalRooms(
  lead: LoadedLead["lead"],
  // ADR-0067: the capacity label lands on the GUEST's page ("4 fő"), so it is a
  // customer-facing string, not a data value — it must speak the page's language.
  dLang: { lang: string },
): { rooms: Room[]; count: number | null } {
  const profiles = (lead as unknown as { portalProfiles?: readonly PortalProfile[] }).portalProfiles ?? [];
  const high = profiles.filter((p) => p.matchBand === "high");
  for (const p of high) {
    if (!p.rooms?.length) continue;
    const rooms: Room[] = p.rooms
      .map((r) => ({
        name: (r.name ?? "").trim(),
        // The listing's own wording, never rephrased; capacity only when stated.
        ...(r.capacity ? { capacity: T(dLang, "{n} fő", { n: r.capacity }) } : {}),
        ...(r.description?.trim() ? { note: r.description.trim() } : {}),
      }))
      .filter((r) => r.name.length > 1);
    if (rooms.length) return { rooms: rooms.slice(0, 8), count: rooms.length };
  }
  const counted = high.find((p) => p.roomCount?.value && p.roomCount.value > 0);
  return { rooms: [], count: counted?.roomCount?.value ?? null };
}

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
  const { result, usage } = await withAiUsage(() => generateEngineMockInner(loaded, regionId, opts));
  console.log(`  ${formatUsage(usage)}`); // i18n-exempt: operator log
  return result;
}

async function generateEngineMockInner(
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

  // What the property's OWN verified listing says it offers. Until 2026-08-31 this was read
  // only by the fact gate, never by the WRITER — so the copywriter saw the name, the region
  // and four photos, and the prompt told it to build on what the photos show. It obeyed:
  // measured on Dencs Apartmanház, whose listing states a playground, a garden, a private
  // car park, a cot and a high chair, the mock led with "Fenyőillatú csend a tető alatt" and
  // offered a bookshelf as a highlight, because a sofa was all it was given. Across the DB
  // 46 high-band profiles carried 289 such facts and 28 real descriptions, all unused.
  const highProfiles = (
    (lead as unknown as { portalProfiles?: readonly PortalProfile[] }).portalProfiles ?? []
  ).filter((p) => p.matchBand === "high");
  const sourcedAmenities = [...new Set(highProfiles.flatMap((p) => p.amenities))].filter(
    (a) => a.trim().length > 1,
  );
  // Short blurbs are portal chrome, not a self-introduction ("Gyenesdiás" was one listing's
  // whole "description") — those carry no fact worth grounding and only add prompt noise.
  // SELF-ANCHORED PROSE from a medium-band listing is admissible too (owner request,
  // 2026-08-31: "scrapeljük a szöveget is információért"). The medium band exists because
  // a page-level match may be another property — but a paragraph that NAMES this property
  // in its own words carries its own proof: "A Dencs Család egy kétszintes apartmanházzal
  // rendelkezik … Gyenesdiáson" cannot be about someone else. That listing scored medium
  // only because name agreement was the single signal available, and its text was the
  // richest thing we held about the lead. Photos stay barred at medium (a picture makes no
  // claim about whose it is); prose that identifies itself does not need the page's vouch.
  const brandOf = (s: string): string[] =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 5 && !GENERIC_LEAD_WORD.has(w));
  const leadBrand = brandOf(lead.name);
  const selfAnchored = ((lead as unknown as { portalProfiles?: readonly PortalProfile[] })
    .portalProfiles ?? [])
    .filter((p) => p.matchBand !== "high" && p.matchConfidence >= 0.9)
    .filter((p) => {
      const d = p.description?.trim();
      if (!d || d.length < 120) return false;
      const hay = brandOf(d).join(" ");
      return leadBrand.length > 0 && leadBrand.some((b) => hay.includes(b));
    });
  const sourcedDescriptions = [...highProfiles, ...selfAnchored]
    .map((p) => p.description?.trim())
    .filter((d): d is string => Boolean(d && d.length >= 120))
    .map((d) => d.slice(0, 1500));
  // The prose's STRONG claims, lifted into countable facts (measured: Kati Villa's own
  // description opens with waterfront + private beach + pier, the listing publishes ZERO
  // amenities, and the mock sold the car park — because every consumer below only ever
  // counted the amenity LIST). Merged before the writer, the guard and the fact gate, so
  // "vízparti" is a fact the headline can be REQUIRED to carry.
  const descriptionFacts = descriptionSellingPoints(sourcedDescriptions);
  for (const f of descriptionFacts) {
    if (!sourcedAmenities.some((a) => a.toLowerCase() === f.toLowerCase())) sourcedAmenities.push(f);
  }

  // Brief + editorial copy in ONE vision call (measured 2026-08-29: the two separate calls
  // sent the SAME 4 photos twice, and vision input is ~99% of the mock's bill — merging
  // halves it with identical pixels, so the fact-recognition quality is untouched; see
  // brief.ts). No key / any failure → fact-safe fallback: region-only copy + generic
  // headings; the photos/name/contact still render. Never fails generation.
  const briefInput = {
    name: lead.name,
    region: region.label,
    regionContext: ctx.tagline,
    address: lead.address,
    realStats: stats.map((s) => ({ value: s.value, label: s.label })),
    ...(sourcedAmenities.length || sourcedDescriptions.length
      ? {
          sourcedFacts: {
            ...(sourcedAmenities.length ? { amenities: sourcedAmenities } : {}),
            ...(sourcedDescriptions.length ? { descriptions: sourcedDescriptions } : {}),
          },
        }
      : {}),
    imageUrls: groundImages,
    ...(opts.curatorPrompt ? { curatorGuidance: opts.curatorPrompt } : {}),
    ...(lang !== DEFAULT_LANG ? { languageName: langName(lang) } : {}),
  };
  let { brief, editorial } = await generateBriefAndCopy(briefInput);

  // What the verified listing knows about the property's rooms (measured, gated).
  const units = portalRooms(lead, dLang);

  // MARKETING-RELEVANCE gate with TEETH (owner ruling 2026-08-31). The other gates ask
  // "is it true / pretty / properly framed"; this one asks whether a person looking for a
  // place to stay would learn what they GET here. It runs on the COPY, before rendering,
  // so a failure can be answered the only way that helps: regenerate ONCE with the
  // critique fed back as curator guidance. A judge whose verdict changes nothing is just
  // a fourth green tick — and the mock that triggered this ruling passed all three.
  const marketSource = {
    name: lead.name,
    town: lead.city ?? null,
    amenities: sourcedAmenities,
    ...(units.count ? { roomCount: units.count } : {}),
    ...(rating != null ? { rating: { value: rating, count: userRatingCount ?? null } } : {}),
    ...(sourcedDescriptions.length ? { descriptions: sourcedDescriptions } : {}),
  };
  const salesOf = (): SalesSurface => ({
    ...(editorial.hero?.lead ? { heroLead: editorial.hero.lead } : {}),
    ...(editorial.hero?.eyebrow ? { heroEyebrow: editorial.hero.eyebrow } : {}),
    ...(brief?.tagline ? { tagline: brief.tagline } : {}),
    ...(brief?.intro ? { intro: brief.intro } : {}),
    highlights: brief ? guestValueHighlights(brief.highlights) : [],
  });
  let market: MarketVerdict | null = null;
  try {
    market = await verifyMarketRelevance({
      sales: salesOf(),
      source: marketSource,
      photos: groundImages,
    });
    if (market.verdict === "flag" && market.critique) {
      // ONE retry. Not a loop: if the writer cannot use a concrete, fact-naming critique
      // on the second attempt, the problem is not phrasing and a human should look.
      console.log(`  ⛔ marketing-őr: FLAG (${market.layer}) · ${market.reason}`); // i18n-exempt: operator log
      console.log("  ↻ újragenerálás a visszacsatolt kritikával…"); // i18n-exempt: operator log
      const retry = await generateBriefAndCopy({
        ...briefInput,
        curatorGuidance: [opts.curatorPrompt, market.critique].filter(Boolean).join("\n\n"),
      });
      if (retry.brief) {
        brief = retry.brief;
        editorial = retry.editorial;
        const second = await verifyMarketRelevance({
          sales: salesOf(),
          source: marketSource,
          photos: groundImages,
        });
        // Keep the SECOND verdict either way: it describes the copy we are shipping.
        market = second;
      }
    }
    console.log(
      market.verdict === "pass"
        ? `  ✅ marketing-őr: PASS (${market.factsNamed.length} igazolt tény megnevezve)` // i18n-exempt: operator log
        : market.verdict === "flag"
          ? `  ⛔ marketing-őr: FLAG → kurátor-sor · ${market.reason}` // i18n-exempt: operator log
          : `  ⚠️ marketing-őr: nem ítélhető (${market.reason}) → kurátor-sor`, // i18n-exempt: operator log
    );
  } catch (mErr) {
    console.warn(`  [engine] marketing-őr kihagyva: ${(mErr as Error).message}`);
  }

  const siteData: SiteData = {
    ...(lang !== DEFAULT_LANG ? { lang } : {}),
    ...leadToSiteData(lead, {
      copy: brief
        ? {
            tagline: fixHomoglyphs(brief.tagline),
            intro: fixHomoglyphs(brief.intro),
            // ⛔ A vision brief describes SURFACES unless stopped: the mock shipped
            // "Bézs csempés fürdőszoba", "kék-zöld ágynemű", "sárga homlokzat".
            // The prompt asks for guest VALUE; this filter enforces it (a prompt is
            // statistical, a filter is not). Conservative: only clear decor-filler
            // with no guest value in it is dropped — fewer, but each one sells.
            highlights: guestValueHighlights(brief.highlights.map(fixHomoglyphs)),
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
    // ADR-0046: the rating badge links to Google's OWN reviews page, built from the
    // place id we already store — the visitor can verify the number at the source
    // (and it is the attribution the Places policy asks for). No id → no link.
    ...(rating != null
      ? {
          rating: {
            value: rating,
            count: userRatingCount,
            ...(placeIdOf(lead) ? { url: reviewsUrlFor(placeIdOf(lead)!) } : {}),
          },
        }
      : {}),
    // §B.6: photo-derived per-property accent from the brief (validated HEX). Persisted so the
    // live re-render reproduces it (mock=live); harmonized into the skin's rails at render time.
    ...(brief && parseHex(brief.palette.accent) ? { palette: { accent: brief.palette.accent } } : {}),
    // REAL rooms when the listing publishes them — the mock then shows the property's
    // own units instead of numbered samples (§B.17: source = the scraper's structured
    // portal field, nothing inferred). Only the NAMES/capacities are real; the room
    // PHOTOS are still borrowed from the gallery, so they keep the sample watermark.
    ...(units.rooms.length ? { rooms: units.rooms } : {}),
    // No list, but a stated room count → the sample cards follow that number, so the
    // SHAPE of the property is true even where the names are not known.
    ...(!units.rooms.length && units.count ? { sampleRoomCount: units.count } : {}),
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
  // Editorial copy comes from the SAME call as the brief (one photo send) — see above.
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
      : `  ⛔ dizájn-doktrína: FLAG → kurátor-sor · ${design.reason}`, // i18n-exempt: operator log
  );

  // Factuality gate (§B.17) — until 2026-08-29 ONLY the corpus path ran it; the engine
  // path shipped unverified, and a measured run DID fabricate ("ventilátoros szobák",
  // nowhere in the data). Same gate as generateMock, extended with the structured truth
  // this path renders (A4-gated rating, high-band portal rooms/amenities) so the mock's
  // own TRUE numbers are not flagged. Verdict lands in inputs.factVerdict — the outreach
  // send gates (sendBatch/sendOutreachSms) already read that key, so a FLAG here blocks
  // auto-outreach with no further wiring (§G.20). Best-effort: a verifier hiccup records
  // "error" (→ curation), never fails generation.
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
        ...(rating != null ? { rating: { value: rating, count: userRatingCount ?? null } } : {}),
        ...(units.rooms.length
          ? { rooms: units.rooms.map((r) => ({ name: r.name, capacity: r.capacity ?? null })) }
          : {}),
        // The SAME source set the writer worked from — the gate must not flag a fact
        // it was handed on purpose (measured: "Klíma", "Ingyenes wifi", "Parkolás" and
        // "Reggeli" were the most-flagged "unsourced" facts, and all four are amenities).
        ...(sourcedAmenities.length ? { amenities: sourcedAmenities } : {}),
        ...(sourcedDescriptions.length ? { descriptions: sourcedDescriptions } : {}),
      },
      photos: photos.map((p) => p.url),
    });
    if (factCheck.verdict === "pass") {
      console.log(`  ✅ tényhűség: PASS (${factCheck.candidates.length} jelölt ellenőrizve)`); // i18n-exempt: operator log
    } else if (factCheck.verdict === "flag") {
      const bad = factCheck.facts.filter((f) => !f.sourced).map((f) => `"${f.fact}"`).join(", ");
      console.log(`  ⛔ tényhűség: FLAG → kurátor-sor · forrástalan: ${bad || factCheck.reason}`); // i18n-exempt: operator log
    } else {
      console.log(`  ⚠️ tényhűség: nem verifikálható (${factCheck.reason}) → kurátor-sor`); // i18n-exempt: operator log
    }
  } catch (fcErr) {
    console.warn(`  [engine] tényhűség-ellenőrzés kihagyva: ${(fcErr as Error).message}`);
  }

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
      factVerdict: factCheck?.verdict ?? null,
      // Read by the outreach send gates alongside the other verdicts (§G.20) — a mock
      // that sells nothing must not go out cold any more than an untrue one.
      marketVerdict: market?.verdict ?? null,
      marketReason: market?.reason ?? null,
      // The listing's amenity count IN THE SAME GROUPED UNITS the console shows, so
      // "6 of 12" compares like with like. Storing the RAW 27 was measured wrong on
      // 2026-08-31: the panel would have set 6 grouped chips against 27 raw items and
      // reported a gap that does not exist (§B.17 applies to our own surfaces too).
      marketAmenityTotal: groupAmenities(sourcedAmenities).length,
      marketFactsNamed: market?.factsNamed ?? [],
      marketMissed: market?.missed ?? [],
      factUnsourced: factCheck ? factCheck.facts.filter((f) => !f.sourced).map((f) => f.fact) : [],
      factCandidates: factCheck?.candidates.length ?? 0,
      aiUsage: usageForArtifact(currentAiUsage()),
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
