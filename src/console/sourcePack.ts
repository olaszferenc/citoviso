// THE "FORRÁS-CSOMAG" DATA — what the copywriter is given about a lead, as the console shows
// it to the curator (Poe) before he writes (approved plan: assets/design-refs/console/poe-curator/).
//
// ⛔ READ-ONLY, NEVER PAYS. Opening the view calls neither Places nor an AI model: the photos
// come from the stored answer (`places: "cached"`, the /photos panel's rule — ADR-0293), the
// Google reviews from the stored set. A stored set past the 30-day rule is NOT re-fetched here;
// the pack says it is stale ("a generálás frissíti"), because the generation is the one call
// allowed to refresh it.
//
// The pack itself is writerSources.ts — the SAME assembly the generation runs, so the view can
// never show another set than the writer received (except the stale Google reviews, flagged).

import { db } from "../db/client.js";
import { copyFieldSpec, copyKeysFor, visibleCopyKeys, type CopyKey } from "../engine/copyFields.js";
import type { Recipe, SiteData } from "../engine/recipe.js";
import { renderSite } from "../engine/render.js";
import { isPickableTemplate, TEMPLATES } from "../engine/templates.js";
import { DEFAULT_LANG } from "../i18n/lang.js";
import { guestReviewsFresh } from "../scraper/enrichGuestReviews.js";
import { loadRegions } from "../scraper/regions.js";
import type { GuestReview } from "../scraper/types.js";
import { getRegionContext, resolveGatedPhotos, resolveRegion } from "../generator/generate.js";
import { portalRooms } from "../generator/generateEngine.js";
import { MAX_GUEST_VOICE, MIN_GUEST_STARS } from "../generator/guestVoice.js";
import type { LoadedLead } from "../generator/persist.js";
import {
  collectWriterSources,
  MAX_DESCRIPTION,
  quoteCorpusOf,
  type VoiceInput,
  type WriterSourceLead,
  type WriterSources,
} from "../generator/writerSources.js";

export interface SourcePack {
  readonly leadId: string;
  readonly identity: {
    readonly name: string;
    readonly town: string | null;
    readonly address: string | null;
    /** null when the lead sits in no named region — the writer is then told there is none. */
    readonly region: { readonly label: string; readonly context: string } | null;
  };
  /** The real Google rating the writer may cite (only when attributable, §B.17). */
  readonly realStats: { readonly rating: number; readonly count: number | null } | null;
  readonly amenities: readonly { readonly label: string; readonly origin: "listing" | "description" }[];
  readonly descriptions: readonly { readonly text: string; readonly source: string }[];
  readonly voice: {
    readonly used: readonly VoiceInput[];
    readonly dropped: readonly { readonly review: VoiceInput; readonly reason: string }[];
    readonly minStars: number;
    readonly max: number;
    /** The stored Google set is older than the 30-day rule — the generation re-fetches it. */
    readonly googleStale: boolean;
    readonly googleFetchedAt: string | null;
  };
  /** The trust-gated photos on file (stored answer only), best first. */
  readonly photos: readonly string[];
  /** How many of `photos` the vision call sees (brief.ts sends the first 4). */
  readonly visionPhotos: number;
  /** Portal rooms: rendered straight onto the mock, NOT part of the writer's input. */
  readonly rooms: { readonly names: readonly string[]; readonly count: number | null };
  readonly limits: { readonly descriptionChars: number };
}

/** brief.ts hands the vision call the first four ground images. */
const VISION_PHOTOS = 4;

type StoredGoogle = { guestReviews?: readonly GuestReview[]; guestReviewsFetchedAt?: string };

/** The stored Google reviews as voice candidates — stale or not (the view flags staleness). */
function storedGoogleVoice(lead: StoredGoogle): VoiceInput[] {
  return (lead.guestReviews ?? []).map((r) => ({ text: r.text, rating: r.rating, source: "google_places" }));
}

/** The writer's sources from STORED data only — the curated-check corpus and the view. */
export function storedWriterSources(loaded: LoadedLead): WriterSources {
  const lead = loaded.lead as unknown as WriterSourceLead & StoredGoogle;
  return collectWriterSources(lead, storedGoogleVoice(lead));
}

/** The quote corpus the curator's pack is checked against, from stored data. */
export function storedQuoteCorpus(loaded: LoadedLead): string[] {
  return quoteCorpusOf(storedWriterSources(loaded));
}

export async function buildSourcePack(loaded: LoadedLead): Promise<SourcePack> {
  const { id, lead } = loaded;
  const stored = lead as unknown as StoredGoogle & { ownerIntro?: string };
  const src = storedWriterSources(loaded);

  await loadRegions();
  const region = resolveRegion(undefined, lead.lat, lead.lon);
  const ctx = getRegionContext(region);
  const media = await resolveGatedPhotos(lead, id, { places: "cached" });
  const rooms = portalRooms(lead, { lang: DEFAULT_LANG });

  const descriptionSource = new Map<string, string>();
  for (const p of [...src.highProfiles, ...src.selfAnchored]) {
    const d = p.description?.trim();
    if (d) descriptionSource.set(d.slice(0, MAX_DESCRIPTION), p.portalHost);
  }

  return {
    leadId: id,
    identity: {
      name: lead.name,
      town: lead.city ?? null,
      address: lead.address ?? null,
      region: region.known ? { label: region.label, context: ctx.tagline } : null,
    },
    realStats: media.rating ? { rating: media.rating, count: media.userRatingCount ?? null } : null,
    amenities: src.amenities.map((label) => ({
      label,
      origin: src.descriptionFacts.includes(label) ? "description" : "listing",
    })),
    descriptions: src.descriptions.map((text) => ({
      text,
      source: src.ownerIntro === text ? "owner_intro" : (descriptionSource.get(text) ?? "unknown"),
    })),
    voice: {
      used: src.voice.used,
      dropped: src.voice.dropped.map((d) => ({ review: d.review, reason: d.reason })),
      minStars: MIN_GUEST_STARS,
      max: MAX_GUEST_VOICE,
      googleStale: (stored.guestReviews?.length ?? 0) > 0 && !guestReviewsFresh(stored),
      googleFetchedAt: stored.guestReviewsFetchedAt ?? stored.guestReviews?.[0]?.fetchedAt ?? null,
    },
    photos: media.photos.map((p) => p.url),
    visionPhotos: Math.min(VISION_PHOTOS, media.photos.length),
    rooms: { names: rooms.rooms.map((r) => r.name), count: rooms.count },
    limits: { descriptionChars: MAX_DESCRIPTION },
  };
}

/**
 * "Kitöltendő mezők sablononként" — which copy field each pickable template DRAWS, measured
 * by a trial render (the hooks of visibleCopyKeys), never assumed. The template path's recipe
 * is fixed (hero, stats, features, gallery, reviews, location, enquiry), so rooms.* / faq.*
 * never apply there. The lead's latest mock data is used when there is one (its reviews and
 * photos decide what a template shows); otherwise a synthetic stand-in.
 */
export interface FieldVisibility {
  readonly sections: readonly string[];
  readonly fields: readonly { readonly key: CopyKey; readonly max: number; readonly required: boolean }[];
  readonly templates: readonly { readonly id: string; readonly label: string; readonly shows: readonly CopyKey[] }[];
}

const TEMPLATE_SECTIONS = ["hero", "stats", "features", "gallery", "reviews", "location", "enquiry"] as const;
const STAND_IN_PHOTO = { url: "data:image/gif;base64,R0lGODlhAQABAAAAACw=", alt: "", provenance: "portal" };

export async function fieldVisibility(leadId: string, name: string): Promise<FieldVisibility> {
  const latest = await db
    .selectFrom("mock_artifact")
    .select(["inputs"])
    .where("lead_id", "=", leadId)
    .orderBy("generated_at", "desc")
    .limit(1)
    .executeTakeFirst();
  const stored = (latest?.inputs as { siteData?: SiteData } | undefined)?.siteData;
  const data = (stored ?? {
    name,
    tagline: "-",
    intro: "-. -.",
    highlights: ["-", "-", "-"],
    photos: Array(6).fill(STAND_IN_PHOTO),
    rooms: [],
    contact: { email: "a@b.hu", phone: "+36 30 000 0000", address: "-" },
  }) as SiteData;
  const recipeOf = (template: string): Recipe =>
    ({
      template,
      skin: "",
      archetype: "",
      sections: TEMPLATE_SECTIONS.map((kind) =>
        kind === "hero"
          ? { kind, copy: { lead: "x y", accent: "y", eyebrow: "x" } }
          : kind === "stats" || kind === "enquiry"
            ? { kind }
            : { kind, copy: { eyebrow: "x", title: "x" } },
      ),
    }) as unknown as Recipe;
  const keys = copyKeysFor(recipeOf(""));
  const templates = Object.values(TEMPLATES)
    .filter((t) => isPickableTemplate(t.id))
    .map((t) => {
      let shows: CopyKey[] = [];
      try {
        const v = visibleCopyKeys(renderSite(recipeOf(t.id), data, { phase: "mock" }));
        if (v.has("hero.lead")) v.add("hero.accent");
        shows = keys.filter((k) => v.has(k));
      } catch {
        shows = [...keys]; // unmeasurable → make no "nem látszik" claim
      }
      return { id: t.id, label: (t.label.split(/[—:(]/)[0] ?? t.id).trim() || t.id, shows };
    });
  return {
    sections: TEMPLATE_SECTIONS,
    fields: keys.map((key) => {
      const spec = copyFieldSpec(key);
      return { key, max: spec.max, required: spec.required };
    }),
    templates,
  };
}
