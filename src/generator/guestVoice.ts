// GUEST VOICE SELECTION (ADR-0106 + owner decision 2026-10-05): which guest reviews the
// copywriter is given. ONE rule for the generation (generateEngine) and the console's
// source-pack view, so the view can never show a different set than the model received.
//
// ⛔ STAR FILTER (measured 2026-10-05, Mandula vendégház): all 5 stored Google reviews were
// ★1 ("Lehúzás, kosz, átverés") and went to the writer unfiltered — the only guest voice it
// had was an accusation. A writer asked to "speak the guest's language" from that either
// writes an enthusiastic lie or lifts a complaint as praise. Only reviews at ≥4★ go in.
//
// Unrated reviews (portal schema.org Review nodes without reviewRating) are KEPT: a portal
// publishes them on the listing itself, Google reviews always carry a rating, and dropping
// them would remove the only guest voice on most portal-only leads. They stay visible in the
// source-pack view, so the curator still sees what the writer saw.

export interface VoiceCandidate {
  readonly text: string;
  readonly rating?: number;
  readonly source: string;
}

export type VoiceDropReason = "stars" | "short" | "duplicate" | "overflow";

export interface VoiceSelection<T extends VoiceCandidate> {
  /** What the writer receives (≤ MAX_GUEST_VOICE, Google first). */
  readonly used: T[];
  /** What was left out, and why — for the source-pack view. */
  readonly dropped: { review: T; reason: VoiceDropReason }[];
}

export const MAX_GUEST_VOICE = 10;
/** The lowest star rating (on a 5-point scale) whose words may reach the writer. */
export const MIN_GUEST_STARS = 4;
const MIN_TEXT = 30;

/**
 * Does this rating pass the star floor? schema.org ratings are not always 5-point: a value
 * above 5 is read as a 10-point scale (portal "9.2"), and must reach the same share (≥8).
 * Unrated → passes (see the header).
 */
export function passesStarFloor(rating: number | undefined): boolean {
  if (rating === undefined || !Number.isFinite(rating)) return true;
  return rating > 5 ? rating >= MIN_GUEST_STARS * 2 : rating >= MIN_GUEST_STARS;
}

/** The guest-voice chain: star floor → length → duplicate → cap. Order-preserving. */
export function selectGuestVoice<T extends VoiceCandidate>(candidates: readonly T[]): VoiceSelection<T> {
  const used: T[] = [];
  const dropped: { review: T; reason: VoiceDropReason }[] = [];
  const seen = new Set<string>();
  for (const v of candidates) {
    if (!passesStarFloor(v.rating)) {
      dropped.push({ review: v, reason: "stars" });
      continue;
    }
    if (v.text.length < MIN_TEXT) {
      dropped.push({ review: v, reason: "short" });
      continue;
    }
    const key = v.text.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) {
      dropped.push({ review: v, reason: "duplicate" });
      continue;
    }
    seen.add(key);
    if (used.length >= MAX_GUEST_VOICE) {
      dropped.push({ review: v, reason: "overflow" });
      continue;
    }
    used.push(v);
  }
  return { used, dropped };
}
