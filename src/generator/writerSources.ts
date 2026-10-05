// THE WRITER'S SOURCE PACK — what the copywriter (AI or the curator, Poe) is given about a
// lead: the verified amenities, the property's own prose, the guests' own words.
//
// ⛔ ONE ASSEMBLY, TWO READERS. The generation (generateEngine) builds its `briefInput` from
// this, and the console's "Forrás-csomag" view shows exactly this (approved plan:
// assets/design-refs/console/poe-curator/). A view that re-implemented the rules would drift,
// and the curator would write from a pack the generation never sees.
//
// Pure: no DB, no network. The Google reviews are an INPUT — the engine fetches fresh ones
// when the stored set is stale (Places policy), the view passes the stored set and says it
// is stale. Places is never called from here.

import type { PortalProfile } from "../scraper/types.js";
import { selectGuestVoice, type VoiceSelection } from "./guestVoice.js";
import { decisionWeightDesc, descriptionSellingPoints } from "./marketCheck.js";

/** Words that identify no property on their own — never a self-anchor for prose. */
const GENERIC_LEAD_WORD = new Set([
  "apartman", "apartmanhaz", "vendeghaz", "panzio", "hotel", "villa", "szallas",
  "szallashely", "udulo", "nyaralo", "kemping", "porta", "resort", "balaton",
]);

/** Minimum length of a portal description worth grounding (shorter = portal chrome). */
const MIN_PORTAL_DESCRIPTION = 120;
/** The curator saved the owner's intro deliberately — a lower floor than a portal blurb. */
const MIN_OWNER_INTRO = 40;
/** The model sees each description cut to this length, never the whole page. */
export const MAX_DESCRIPTION = 1500;

export interface VoiceInput {
  readonly text: string;
  readonly rating?: number;
  readonly source: string;
}

/** The lead fields the pack is built from (the rehydrated raw record carries them). */
export interface WriterSourceLead {
  readonly name: string;
  readonly portalProfiles?: readonly PortalProfile[];
  readonly ownerIntro?: string;
}

export interface WriterSources {
  /** High-band portal profiles (entity-matched): amenities, prose, reviews. */
  readonly highProfiles: readonly PortalProfile[];
  /** Medium-band profiles whose prose names this property itself (prose only). */
  readonly selfAnchored: readonly PortalProfile[];
  /** The owner's own intro, when saved (≥40 chars) — it leads `descriptions`. */
  readonly ownerIntro: string | null;
  /** The listing's amenities as published (before the prose facts were merged). */
  readonly listedAmenities: readonly string[];
  /** Strong claims lifted from the prose (descriptionSellingPoints), not already listed. */
  readonly descriptionFacts: readonly string[];
  /** listed + prose facts, strongest first (decisionWeightDesc) — the writer's order. */
  readonly amenities: readonly string[];
  /** What the writer reads as prose, each ≤ MAX_DESCRIPTION, owner intro first. */
  readonly descriptions: readonly string[];
  /** The guest-voice selection: `used` reaches the writer, `dropped` carries the reason. */
  readonly voice: VoiceSelection<VoiceInput>;
}

function brandOf(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 5 && !GENERIC_LEAD_WORD.has(w));
}

/** The portal reviews of the high-band listings (their entity match is their attribution). */
export function portalVoiceOf(profiles: readonly PortalProfile[]): VoiceInput[] {
  return profiles
    .filter((p) => p.matchBand === "high")
    .flatMap((p) => (p.reviews ?? []).map((r) => ({ text: r.text, rating: r.rating, source: p.portalHost })));
}

/**
 * Assemble the pack. `googleVoice` = the Google reviews the caller may use (the engine: fresh
 * or re-fetched; the view: the stored set). Google first, then the portals — the order the
 * guest-voice cap keeps.
 */
export function collectWriterSources(lead: WriterSourceLead, googleVoice: readonly VoiceInput[]): WriterSources {
  const profiles = lead.portalProfiles ?? [];
  // What the property's OWN verified listing says it offers. Until 2026-08-31 this was read
  // only by the fact gate, never by the WRITER — so the copywriter saw the name, the region
  // and four photos, and the prompt told it to build on what the photos show. It obeyed:
  // measured on Dencs Apartmanház, whose listing states a playground, a garden, a private
  // car park, a cot and a high chair, the mock led with "Fenyőillatú csend a tető alatt" and
  // offered a bookshelf as a highlight, because a sofa was all it was given. Across the DB
  // 46 high-band profiles carried 289 such facts and 28 real descriptions, all unused.
  const highProfiles = profiles.filter((p) => p.matchBand === "high");
  const listedAmenities = [...new Set(highProfiles.flatMap((p) => p.amenities))].filter(
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
  const leadBrand = brandOf(lead.name);
  const selfAnchored = profiles
    .filter((p) => p.matchBand !== "high" && p.matchConfidence >= 0.9)
    .filter((p) => {
      const d = p.description?.trim();
      if (!d || d.length < MIN_PORTAL_DESCRIPTION) return false;
      const hay = brandOf(d).join(" ");
      return leadBrand.length > 0 && leadBrand.some((b) => hay.includes(b));
    });
  const descriptions = [...highProfiles, ...selfAnchored]
    .map((p) => p.description?.trim())
    .filter((d): d is string => Boolean(d && d.length >= MIN_PORTAL_DESCRIPTION))
    .map((d) => d.slice(0, MAX_DESCRIPTION));
  // The curator-pasted owner self-introduction (console lead form) goes FIRST:
  // it is the owner's own published words — the strongest voice we can source,
  // and often the only place the property's signature hooks live (Facebook is
  // robots-closed to machines, so the curator's hand is the legitimate route).
  // Floor of 40 chars, not 120: the curator saved it deliberately, a portal's
  // boilerplate-length filter does not apply to a hand-picked text.
  const intro = lead.ownerIntro?.trim();
  const ownerIntro = intro && intro.length >= MIN_OWNER_INTRO ? intro.slice(0, MAX_DESCRIPTION) : null;
  if (ownerIntro) descriptions.unshift(ownerIntro);

  // GUEST VOICE (ADR-0106): star floor + length + duplicate + cap (guestVoice.ts).
  const voice = selectGuestVoice<VoiceInput>([...googleVoice, ...portalVoiceOf(profiles)]);

  // The prose's STRONG claims, lifted into countable facts (measured: Kati Villa's own
  // description opens with waterfront + private beach + pier, the listing publishes ZERO
  // amenities, and the mock sold the car park — because every consumer only ever counted
  // the amenity LIST). Merged before the writer, the guard and the fact gate, so "vízparti"
  // is a fact the headline can be REQUIRED to carry.
  const descriptionFacts = descriptionSellingPoints(descriptions).filter(
    (f) => !listedAmenities.some((a) => a.toLowerCase() === f.toLowerCase()),
  );
  const amenities = [...listedAmenities];
  for (const f of descriptionFacts) {
    if (!amenities.some((a) => a.toLowerCase() === f.toLowerCase())) amenities.push(f);
  }
  // Strongest first: the prompt states the list is ranked and the headline must draw
  // from its top, so the ORDER is part of the contract (Kati Villa lesson).
  amenities.sort(decisionWeightDesc);

  return { highProfiles, selfAnchored, ownerIntro, listedAmenities, descriptionFacts, amenities, descriptions, voice };
}

/** The quote corpus the curator's selling points are checked against (= the AI's). */
export function quoteCorpusOf(src: WriterSources): string[] {
  return [...src.descriptions, ...src.voice.used.map((v) => v.text)];
}
