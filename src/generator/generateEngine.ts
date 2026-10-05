// Engine-backed mock generation (ADR-0016). Unlike the AI-HTML path (generate.ts), this
// builds a STRUCTURED Recipe + SiteData and renders deterministically through the
// composition engine — then PERSISTS both into mock_artifact.inputs. That persisted pair
// is what lets convertLead later re-render the LIVE page identically (mock=live), instead
// of copying a monolithic HTML snapshot that drifts from the data.
//
// Additive & reversible: the AI-HTML path (generateMock) is untouched. This shares its
// trust-critical helpers (resolveRegion / resolveGatedPhotos — the A4 photo gate) so the
// confidence rule can never drift between the two paths.

import { currentAiUsage, formatUsage, usageForArtifact } from "../ai/usage.js";
import { withMockBudget } from "../ai/dailyCap.js";
import { writeFile } from "node:fs/promises";

import type { EditorialCopy } from "../engine/copywriter.js";
import { copyKeyApplies, currentCopy, type CopyKey } from "../engine/copyFields.js";
import { planRecipe, withArchetype } from "../engine/planner.js";
import type { Recipe, RecipeSection, Room, SiteData, Stat } from "../engine/recipe.js";
import { getDisabledModules, sampleDenyKeys } from "../moduleSales.js";
import { renderSite } from "../engine/render.js";
import { parseHex } from "../engine/palette.js";
import { leadToSiteData, toSitePhotos } from "../engine/siteData.js";
import { SKINS } from "../engine/skins.js";
import { pickTemplateSkin, TEMPLATES } from "../engine/templates.js";
import { T } from "../engine/templateKit.js";
import { db } from "../db/client.js";
import { config } from "../config.js";
import { guestReviewsFresh } from "../scraper/enrichGuestReviews.js";
import { fetchPlaceReviews } from "../scraper/sources/googleMaps.js";
import { loadRegions } from "../scraper/regions.js";
import type { GuestReview, PortalProfile } from "../scraper/types.js";
import { DEFAULT_LANG, langForCountry, langName } from "../i18n/lang.js";
import { ensureLanguagePack } from "../i18n/packs.js";
import { generateBriefAndCopy } from "./brief.js";
import { curatorManualOf, fixHomoglyphs, validateCuratorCopy, type CuratorCopy } from "./copyCurator.js";
import { applyGuestCritic, criticSourceOf, judgeGuestCopy } from "./guestCritic.js";
import { guestValueHighlights } from "./highlightValue.js";
import { checkDesign } from "./designCheck.js";
import { verifyFactuality, type FactCheckVerdict } from "./factCheck.js";
import { MIN_GUEST_STARS } from "./guestVoice.js";
import { collectWriterSources, quoteCorpusOf, type WriterSourceLead } from "./writerSources.js";
import { groupAmenities, subordinateToCriticInputs, verifyMarketRelevance, type MarketVerdict, type SalesSurface } from "./marketCheck.js";
import { getRegionContext, resolveGatedPhotos, resolveRegion, slugify } from "./generate.js";
import { streetViewUrl } from "./images.js";
import { fingerprintCandidates } from "./photoHash.js";
import { GATE_OPENING, GATE_SUBJECTS } from "../engine/templates/gateOpening.js";
import { reviewsUrlFor } from "../reviews/placeRating.js";
import {
  loadLead,
  mockArtifactPath,
  newArtifactId,
  recordMockArtifact,
  type LoadedLead,
} from "./persist.js";
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
export function portalRooms(
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
/**
 * A generálás VALÓS szakaszai, sorrendben (FK-003b L03).
 *
 * ⛔ Ez KULCS, nem felirat: a motor nem tudja, milyen nyelven néz a konzol, ezért az
 * AZONOSÍTÓ utazik, a szöveget a felület adja (§B.18).
 * ⚠️ A szakaszok hossza ERŐSEN egyenetlen — a `copy` (AI-hívás) a futásidő túlnyomó
 * része —, ezért a felület SOHA nem fordítja százalékra: egy arányos csík a hátralévő
 * időről hazudna. A szakasz NEVE igaz; a „hány százalék" nem lenne az.
 */
export const GEN_STAGES = ["load", "photos", "copy", "render"] as const;
export type GenStageKey = (typeof GEN_STAGES)[number];

export interface GenerateOpts {
  archetype?: string;
  skin?: string;
  template?: string;
  curatorPrompt?: string;
  /**
   * „Generálás kurátori szöveggel” (ADR-0326): the words come from the curator persona (Poe),
   * not from the copywriter call. No briefAndCopy, no market regeneration, no critic rewrite —
   * the three guards judge the shipped text once (D1 = A). Validated by copyCurator.ts.
   */
  curatorCopy?: CuratorCopy;
  /** A futó szakasz jelentése a hívónak — ebből tudja a konzol, hol tart a munka. */
  onStage?: (stage: GenStageKey) => void;
}

export async function generateEngineMock(
  loaded: LoadedLead,
  regionId?: string,
  opts: GenerateOpts = {},
): Promise<EngineGenerateResult> {
  const { result, usage } = await withMockBudget(() => generateEngineMockInner(loaded, regionId, opts));
  console.log(`  ${formatUsage(usage)}`); // i18n-exempt: operator log
  return result;
}

async function generateEngineMockInner(
  loaded: LoadedLead,
  regionId?: string,
  opts: GenerateOpts = {},
): Promise<EngineGenerateResult> {
  // Wall-clock of the machine part, persisted as inputs.genMs — the Poe pilot (D5) compares
  // the two generation modes in time as well as in tokens.
  const startedAt = Date.now();
  opts.onStage?.("load");
  const { id: leadId, lead } = loaded;
  // The region snapshot starts as the built-ins and only the scrape pages refreshed it, so the
  // SAME lead resolved differently before and after someone opened /scrape (measured
  // 2026-10-04: Kerekerdő → "Balaton-Kelet" one day, the fallback the next). Load it here.
  await loadRegions();
  const region = resolveRegion(regionId, lead.lat, lead.lon);
  const ctx = getRegionContext(region);

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
  opts.onStage?.("photos");
  const gated = await resolveGatedPhotos(lead, leadId, { places: "auto" });
  const { rating, userRatingCount, heroVerdict } = gated;
  // gate-opening picks ANOTHER outdoor photo for its leaves; a portal's republished copy of
  // the hero has another URL but is the same picture (owner, 2026-10-03). Fingerprint the
  // hero + the outdoor candidates — only for this template: nobody else reads the hash.
  const photos =
    opts.template === GATE_OPENING.id
      ? await fingerprintCandidates(gated.photos, GATE_SUBJECTS)
      : gated.photos;
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

  // GUEST VOICE (ADR-0106): the guests' own public words about THIS property —
  // the tone source that finally speaks the guest's language instead of the
  // photo's ("fehér csempés fürdőszoba"). Two channels, both attribution-gated:
  // portal reviews ride their profile's high-band entity match; Google reviews
  // ride the A4-gated place id, under the 30-day freshness rule (stale stored
  // content is re-fetched, and on a failed re-fetch DROPPED, never used stale —
  // the Places policy forbids long-term caching).
  const storedGoogle = lead as unknown as {
    guestReviews?: readonly GuestReview[];
    guestReviewsFetchedAt?: string;
  };
  let googleVoice: { text: string; rating?: number; source: string }[] = [];
  if (guestReviewsFresh(storedGoogle)) {
    googleVoice = (storedGoogle.guestReviews ?? []).map((r) => ({
      text: r.text,
      rating: r.rating,
      source: "google_places",
    }));
  } else if (placeIdOf(lead) && config.googleMapsApiKey) {
    try {
      const fresh = await fetchPlaceReviews(placeIdOf(lead)!, config.googleMapsApiKey);
      googleVoice = fresh.map((r) => ({ text: r.text, rating: r.rating, source: "google_places" }));
    } catch (err) {
      console.warn(`  [engine] vendég-vélemény lekérés kihagyva: ${(err as Error).message}`);
    }
  }
  // The writer's source pack — the ONE assembly the console's "Forrás-csomag" view also
  // shows (src/generator/writerSources.ts): listed amenities + prose facts (strongest
  // first), self-anchored prose with the owner intro first, the ≥4★ guest voice.
  const sources = collectWriterSources(
    lead as unknown as WriterSourceLead,
    googleVoice,
  );
  const { highProfiles, selfAnchored } = sources;
  const ownerIntro = sources.ownerIntro;
  const sourcedAmenities = [...sources.amenities];
  const sourcedDescriptions = [...sources.descriptions];
  const guestVoice = sources.voice.used;
  const lowStars = sources.voice.dropped.filter((d) => d.reason === "stars").length;
  if (lowStars)
    console.log(`  vendég-hang: ${lowStars} vélemény kiszűrve (≥${MIN_GUEST_STARS}★ szabály)`); // i18n-exempt: operator log
  if (guestVoice.length)
    console.log(
      `  vendég-hang: ${guestVoice.length} vélemény (${[...new Set(guestVoice.map((v) => v.source))].join(", ")})`, // i18n-exempt: operator log
    );

  // Brief + editorial copy in ONE vision call (measured 2026-08-29: the two separate calls
  // sent the SAME 4 photos twice, and vision input is ~99% of the mock's bill — merging
  // halves it with identical pixels, so the fact-recognition quality is untouched; see
  // brief.ts). No key / any failure → fact-safe fallback: region-only copy + generic
  // headings; the photos/name/contact still render. Never fails generation.
  const briefInput = {
    name: lead.name,
    // ⛔ An area with no `region` record has NO NAME, and `resolveRegion` would otherwise
    // hand the copywriter the scrape key as one (`bs`, `_test`). Omitted, not substituted:
    // `regionLines()` then TELLS the model there is no region and forbids inventing one
    // (owner's rule, 2026-09-14 — "hagyja el a régió-fordulatot").
    ...(region.known ? { region: region.label, regionContext: ctx.tagline } : {}),
    address: lead.address,
    town: lead.city ?? null,
    realStats: stats.map((s) => ({ value: s.value, label: s.label })),
    ...(sourcedAmenities.length || sourcedDescriptions.length || guestVoice.length
      ? {
          sourcedFacts: {
            ...(sourcedAmenities.length ? { amenities: sourcedAmenities } : {}),
            ...(sourcedDescriptions.length ? { descriptions: sourcedDescriptions } : {}),
            ...(guestVoice.length ? { guestVoice } : {}),
          },
        }
      : {}),
    imageUrls: groundImages,
    ...(opts.curatorPrompt ? { curatorGuidance: opts.curatorPrompt } : {}),
    ...(lang !== DEFAULT_LANG ? { languageName: langName(lang) } : {}),
  };
  opts.onStage?.("copy");
  // CURATOR MODE: the pack is checked against the SAME quote corpus the AI's selling points
  // are (the prose + the guest reviews, brief.ts) — a broken pack fails the generation loudly
  // instead of shipping half a text.
  const curatorCheck = opts.curatorCopy
    ? validateCuratorCopy(opts.curatorCopy, quoteCorpusOf(sources))
    : null;
  if (curatorCheck && !curatorCheck.ok) {
    const why = Object.entries(curatorCheck.errors).map(([k, m]) => `${k}: ${m}`).join(" · ");
    throw new Error(`a kurátori szöveg hibás — ${why}`); // i18n-exempt: operator-facing error (console/CLI)
  }
  const curated = curatorCheck?.ok ? curatorCheck.copy : null;
  if (curated) {
    console.log(`  kurátori szöveg (${curated.by}): ${Object.keys(curated.fields).length} mező · nincs író-hívás`); // i18n-exempt: operator log
    for (const w of curated.warnings) console.log(`  ⚠️ kurátori szöveg: ${w}`); // i18n-exempt: operator log
  }
  let { brief, editorial, sellingPoints } = curated
    ? { brief: curated.brief, editorial: curated.editorial, sellingPoints: curated.sellingPoints }
    : await generateBriefAndCopy(briefInput);
  // Open-vocabulary facts the model lifted out of the prose, each quote-verified
  // against the source (brief.ts). Merged BEFORE the market gate builds its source,
  // so a hook the fixed dictionary has no word for ("borkóstolás", "szarvasles")
  // still counts as a named fact instead of reading as invention.
  for (const sp of sellingPoints) {
    if (!sourcedAmenities.some((a) => a.toLowerCase() === sp.label.toLowerCase()))
      sourcedAmenities.push(sp.label);
  }
  if (sellingPoints.length)
    console.log(`  tény-kinyerés (idézet-verifikált): ${sellingPoints.map((s) => s.label).join(" · ")}`); // i18n-exempt: operator log

  // SOURCE ATTRIBUTION for the console's "Honnan tudjuk?" panel (ADR-0106 ⑥,
  // approved plan: assets/design-refs/console/source-panel/). Every fact label
  // gets its best-known origin; a quote is attributed by the SAME squeeze rule
  // that verified it (brief.ts validateSellingPoints), so the panel can never
  // show a quote against a source it was not machine-checked in.
  // Source values are SYMBOLIC KEYS (or a portal host) — the console translates
  // them at render time; a baked-in Hungarian label here would dodge §B.18.
  const corpusItems: { text: string; source: string }[] = [
    ...(ownerIntro && ownerIntro.length >= 40
      ? [{ text: ownerIntro.slice(0, 1500), source: "owner_intro" }]
      : []),
    ...[...highProfiles, ...selfAnchored]
      .filter((p) => p.description && p.description.trim().length >= 120)
      .map((p) => ({ text: p.description!.trim().slice(0, 1500), source: p.portalHost })),
    ...guestVoice.map((v) => ({ text: v.text, source: v.source })),
  ];
  const squeeze = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const sourceOfQuote = (quote: string): string | undefined =>
    corpusItems.find((c) => squeeze(c.text).includes(squeeze(quote)))?.source;
  const panelFacts = sourcedAmenities.map((label) => {
    const sp = sellingPoints.find((s) => s.label.toLowerCase() === label.toLowerCase());
    if (sp) {
      return { label, source: sourceOfQuote(sp.quote) ?? "unknown", quote: sp.quote };
    }
    const host = highProfiles.find((p) =>
      p.amenities.some((x) => x.toLowerCase() === label.toLowerCase()),
    )?.portalHost;
    return { label, source: host ?? "description" };
  });

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
    // Curator mode: no regeneration — the verdict goes to the curator, who rewrites (D1 = A).
    if (!curated && market.verdict === "flag" && market.critique) {
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

  // GUEST-CRITIC (ADR-0292): the last word on the wording, AFTER the market retry (which
  // regenerates from scratch and would otherwise bypass it). It reads the copy as a
  // demanding Hungarian guest would — calques, a review anecdote turned into a service,
  // a claim larger than its quote, tegezés on a magázó page — and has the writer fix
  // exactly that. Hungarian only: the critic's language knowledge is the point, and a
  // translated page gets no verdict rather than a meaningless one.
  let criticInputs: Record<string, unknown> = {};
  const criticSource = criticSourceOf({
    name: lead.name,
    town: lead.city ?? null,
    address: lead.address,
    rating: rating != null ? { value: rating, count: userRatingCount ?? null } : null,
    facts: panelFacts,
    descriptions: sourcedDescriptions,
    reviews: guestVoice.map((v) => v.text),
  });
  if (curated && brief && lang === DEFAULT_LANG) {
    // Curator mode: the critic GRADES, it does not rewrite (copyManual's judge-only twin) —
    // Poe answers for these words, and the market verdict above already describes them.
    criticInputs = await judgeGuestCopy(
      { tagline: brief.tagline, intro: brief.intro, highlights: brief.highlights, editorial },
      criticSource,
    );
    console.log(`  vendég-kritikus (csak ítél): ${String(criticInputs.guestCriticVerdict).toUpperCase()} · ${String(criticInputs.guestCriticReason)}`); // i18n-exempt: operator log
  } else if (brief && lang === DEFAULT_LANG) {
    const critic = await applyGuestCritic(
      { tagline: brief.tagline, intro: brief.intro, highlights: brief.highlights, editorial },
      criticSource,
    );
    brief = {
      ...brief,
      tagline: critic.copy.tagline,
      intro: critic.copy.intro,
      highlights: [...critic.copy.highlights],
    };
    editorial = critic.copy.editorial;
    criticInputs = critic.inputs;
    console.log(`  vendég-kritikus: ${String(critic.inputs.guestCriticVerdict).toUpperCase()} · ${critic.inputs.guestCriticReason}`); // i18n-exempt: operator log
    // The market verdict must describe the SHIPPED copy (OP-1, Elek 2026-10-02): judged
    // before the critic, the Muschel card cited „bérelhető bicikli” as the reason the copy
    // sells — a phrase the critic had already removed. No regeneration here: the critic's
    // copy is final, the verdict follows it (a flag goes to the curator like any other).
    if (market) {
      try {
        market = await verifyMarketRelevance({ sales: salesOf(), source: marketSource, photos: groundImages });
        console.log(`  marketing-őr a kiszállított szövegen: ${market.verdict.toUpperCase()} · ${market.reason}`); // i18n-exempt: operator log
      } catch (mErr) {
        // Never keep the stale verdict, and never drop it silently: unverifiable → error.
        market = { verdict: "error", layer: "judge", factsNamed: [], missed: [], reason: `a kiszállított szöveg nem ítélhető: ${(mErr as Error).message}` }; // i18n-exempt: operator-facing verdict reason (console)
      }
    }
  }
  // The critic wins a contradiction (ADR-0328): what it objected to, the market may not demand.
  if (market) market = subordinateToCriticInputs(market, criticInputs, marketSource);

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
  // Module-sales switch (owner decree 2026-09-06): a not-sellable module gets no
  // ALL-IN sample in the mock — we must not advertise what we would refuse to sell.
  opts.onStage?.("render");
  const sampleDeny = sampleDenyKeys(await getDisabledModules());
  const baseHtml = renderSite(finalRecipe, siteData, { sampleDeny });
  const html = await injectRuntime(baseHtml, lang);

  // EGY ARTEFAKTUM = EGY FÁJL (ADR-0140). Ez a komment eddig is ezt állította, de a
  // név csak a SABLON-változatokat választotta szét: ugyanannak a leadnek ugyanazzal a
  // sablonnal való újragenerálása felülírta az előző artefaktum fájlját. Az azonosítót
  // ezért a render ELŐTT kérjük el, és a sor is ezt kapja.
  const artifactIdPre = newArtifactId();
  const path = mockArtifactPath(lead.name, finalRecipe.template ?? "engine", artifactIdPre);
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
        // No `region` record → no region FACT. Omitted so the gate cannot licence a claim
        // built on a scrape key (see FactSource.region).
        ...(region.known ? { region: region.label } : {}),
        address: lead.address,
        phone: lead.phone,
        email: lead.email,
        // The templates' "10 fotó / Összes fotó (10)" counter is this number (factCheck.ts).
        photoCount: siteData.photos.length,
        ...(rating != null ? { rating: { value: rating, count: userRatingCount ?? null } } : {}),
        ...(units.rooms.length
          ? { rooms: units.rooms.map((r) => ({ name: r.name, capacity: r.capacity ?? null })) }
          : {}),
        // The SAME source set the writer worked from — the gate must not flag a fact
        // it was handed on purpose (measured: "Klíma", "Ingyenes wifi", "Parkolás" and
        // "Reggeli" were the most-flagged "unsourced" facts, and all four are amenities).
        ...(sourcedAmenities.length ? { amenities: sourcedAmenities } : {}),
        // Guest-review texts join the gate's source set (ADR-0106): a claim the
        // writer grounded on a review ("a vendégek dicsérik a csendet") must
        // not read as unsourced to the very gate that was handed the review.
        ...(sourcedDescriptions.length || guestVoice.length
          ? { descriptions: [...sourcedDescriptions, ...guestVoice.map((v) => v.text)] }
          : {}),
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
    id: artifactIdPre,
    leadId,
    path,
    inputs: {
      engine: "composition",
      template: finalRecipe.template ?? null,
      skin: finalRecipe.skin,
      archetype: finalRecipe.archetype,
      recipe: finalRecipe as unknown as Record<string, unknown>,
      siteData: siteData as unknown as Record<string, unknown>,
      // `inputs` is not an archive — `rerender-mock.mts` RE-RENDERS from it (ADR-0143 ①).
      // Persisting the key under the `region` NAME field would resurrect the scrape key on
      // the next re-render, which is the exact loop that ADR closed. `regionId` keeps the
      // machine-side identity either way.
      ...(region.known ? { region: region.label } : {}),
      regionId: region.id,
      photos: photos.length,
      recipeSource: source,
      designVerdict: design.verdict,
      // ⛔ The REASON must be stored, not just the verdict (measured 2026-09-16): the
      // outreach gate printed "FLAG (designVerdict)" and nothing else, so the curator
      // was told to fix something the system never recorded. The AI path (generate.ts)
      // already stored it; this path did not — one rule, two copies, one of them silent.
      designReason: design.reason ?? null,
      factVerdict: factCheck?.verdict ?? null,
      // Melyik kép lett a nyitókép, és MIÉRT (heroPick.ts). A konzol ítélet-pirulája
      // ezt olvassa: a kurátor a listán látja, ha a hero nem eladó kép — eddig csak a
      // megnyitott mockon derült ki, hogy egy budi néz vissza a lap tetejéről.
      heroVerdict: heroVerdict.verdict,
      heroReason: heroVerdict.reason,
      heroSubject: heroVerdict.subject,
      heroScore: heroVerdict.score,
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
      // Guest-critic verdict + what it still says about the shipped copy (ADR-0292).
      ...criticInputs,
      factUnsourced: factCheck ? factCheck.facts.filter((f) => !f.sourced).map((f) => f.fact) : [],
      factCandidates: factCheck?.candidates.length ?? 0,
      // Guest-voice audit trail (ADR-0106): what the writer was grounded on —
      // the console's source panel reads these to show "honnan tudjuk".
      guestReviewCount: guestVoice.length,
      guestReviewSources: [...new Set(guestVoice.map((v) => v.source))],
      // "Honnan tudjuk?" panel data (ADR-0106 ⑥, approved contract:
      // assets/design-refs/console/source-panel/README.md). Persisted so the
      // panel shows what THIS generation actually worked from, not the lead's
      // current state (the lead may be re-enriched after the mock is made).
      sourcePanel: {
        portals: [...highProfiles, ...selfAnchored].map((p) => ({
          host: p.portalHost,
          band: p.matchBand,
          amenities: p.amenities.length,
          photos: p.photos.length,
          descChars: p.description?.trim().length ?? 0,
        })),
        guestReviews: {
          count: guestVoice.length,
          sources: [...new Set(guestVoice.map((v) => v.source))],
        },
        ownerIntro: Boolean(ownerIntro && ownerIntro.length >= 40),
        photosByProvenance: photos.reduce<Record<string, number>>((acc, p) => {
          acc[p.provenance] = (acc[p.provenance] ?? 0) + 1;
          return acc;
        }, {}),
        facts: panelFacts,
      },
      aiUsage: usageForArtifact(currentAiUsage()),
      genMs: Date.now() - startedAt,
      // Curator mode provenance (§B.17): who wrote the words, field by field, in the hand
      // edit's shape — so a later recopy overlays Poe's text instead of replacing it.
      ...(curated
        ? {
            copyOrigin: "curator",
            copyManual: curatorManualOf(
              (Object.keys(curated.fields) as CopyKey[]).filter((k) => copyKeyApplies(finalRecipe, k)),
              (k) => currentCopy(finalRecipe, siteData, k),
              curated.by,
            ),
          }
        : {}),
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
  opts: { archetype?: string; skin?: string; template?: string; curatorPrompt?: string; curatorCopy?: CuratorCopy } = {},
): Promise<EngineGenerateResult> {
  const loaded = await loadLead(idOrName);
  return generateEngineMock(loaded, regionId, opts);
}
