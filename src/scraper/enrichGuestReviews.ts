// GUEST-VOICE PASS (ADR-0106) — fetch the Google Places review TEXTS for the
// leads we would contact.
//
// Why this pass exists: the mock's copy kept reading like a technical inventory
// ("fehér csempés fürdőszoba") because every text source we held described the
// PROPERTY, none described the EXPERIENCE. The guests' own public words are the
// one source that already speaks the guest's language — what people praise is
// what sells the place. Until now we stored only the rating and the count; the
// texts were rejected long ago over PER-VIEW display cost, an argument that does
// not apply to a ONE-OFF per-lead fetch (~$0.025 for the 5 most relevant).
//
// Policy: Google content must not be cached long-term, so every stored review
// carries fetchedAt and anything older than 30 days is re-fetched before use
// (the site_place_rating pattern). The texts are grounding INPUT for the
// copywriter and the fact gate — they are never copied verbatim onto a mock.

import { fetchPlaceReviews } from "./sources/googleMaps.js";
import type { GuestReview, QualifiedLead } from "./types.js";

const CONCURRENCY = 5;
/** Default per-run ceiling (cost budget — one Details call per lead). */
const DEFAULT_MAX_LEADS = 60;
/** Google-content freshness rule: a stored set older than this is stale. */
export const REVIEW_TTL_DAYS = 30;

export function guestReviewsFresh(
  lead: Pick<QualifiedLead, "guestReviews" | "guestReviewsFetchedAt">,
): boolean {
  const fetched = lead.guestReviewsFetchedAt ?? lead.guestReviews?.[0]?.fetchedAt;
  if (!fetched) return false;
  const age = Date.now() - Date.parse(fetched);
  return Number.isFinite(age) && age >= 0 && age < REVIEW_TTL_DAYS * 24 * 3600 * 1000;
}

export async function enrichGuestReviews(
  leads: QualifiedLead[],
  apiKey: string,
  opts: { maxLeads?: number } = {},
): Promise<QualifiedLead[]> {
  if (!apiKey) return leads;

  // Only leads whose Places match passed the A4 gate carry a place id
  // (enrichPlaces sets sourceRefs.google_places on non-low matches only), so
  // the id's presence IS the attribution gate: no id → no review fetch.
  const targets = leads
    .filter((l) => l.isLead && l.sourceRefs?.google_places)
    .filter((l) => !guestReviewsFresh(l))
    .slice(0, opts.maxLeads ?? DEFAULT_MAX_LEADS);
  if (!targets.length) return leads;

  const found = new Map<QualifiedLead, GuestReview[]>();
  let next = 0;
  async function worker(): Promise<void> {
    while (next < targets.length) {
      const lead = targets[next++]!;
      try {
        const reviews = await fetchPlaceReviews(lead.sourceRefs!.google_places!, apiKey);
        const fetchedAt = new Date().toISOString();
        found.set(
          lead,
          reviews.map((r) => ({ ...r, source: "google_places", fetchedAt })),
        );
      } catch {
        // network/timeout — skip this lead, keep the rest
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, targets.length) }, () => worker()),
  );

  const total = [...found.values()].reduce((s, r) => s + r.length, 0);
  console.log(
    `  → ${found.size}/${targets.length} leadhez jött vendég-vélemény (${total} szöveg, forrás: google_places)`,
  );

  return leads.map((l) => {
    const reviews = found.get(l);
    if (!reviews) return l;
    // A zero-text answer is still a FRESH answer ("no usable reviews") — the
    // separate timestamp records it, so the paid call is not re-triggered
    // every run just because the array is empty.
    return {
      ...l,
      guestReviews: reviews,
      guestReviewsFetchedAt: new Date().toISOString(),
    };
  });
}
