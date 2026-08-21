// A4 — match-confidence scoring. Turns the entity-match verification signals
// (distance, name similarity, cross-source corroboration) into a single 0..1
// score + a band. The band gates downstream use of the matched data:
//   high   → auto-pass (use photos/contact)
//   medium → usable but flag for the curator
//   low    → ⛔ drop (do NOT attribute) — better nothing than the wrong lead's data
// Reviews/rating are a further weighted signal, added later (not decisive alone).

export interface MatchSignals {
  /** Distance between the lead coords and the matched place (meters). */
  readonly distanceMeters: number;
  /** Name similarity between lead name and matched place name (0..1). */
  readonly nameSimilarity: number;
  /** Did an independent source (OSM) also place this lead here? */
  readonly corroboratedByOsm: boolean;
}

export type ConfidenceBand = "high" | "medium" | "low";

export interface MatchConfidence {
  readonly score: number;
  readonly band: ConfidenceBand;
  readonly reasons: string[];
}

const HIGH = 0.7;
const MEDIUM = 0.45;

export function scoreMatch(s: MatchSignals): MatchConfidence {
  // Distance: 0m → 1.0, 300m → 0.0 (linear).
  const distScore = Math.max(0, 1 - s.distanceMeters / 300);
  const nameScore = Math.max(0, Math.min(1, s.nameSimilarity));
  const corrob = s.corroboratedByOsm ? 1 : 0;

  // Name and distance are the primary signals; corroboration is a bonus.
  const score = Math.max(
    0,
    Math.min(1, 0.45 * nameScore + 0.4 * distScore + 0.15 * corrob),
  );
  const band: ConfidenceBand =
    score >= HIGH ? "high" : score >= MEDIUM ? "medium" : "low";

  return {
    score,
    band,
    reasons: [
      `távolság ${Math.round(s.distanceMeters)}m (${distScore.toFixed(2)})`,
      `név-egyezés ${nameScore.toFixed(2)}`,
      `korroboráció ${s.corroboratedByOsm ? "OSM+Places" : "1 forrás"}`,
    ],
  };
}

/**
 * Signals for matching a PORTAL LISTING to a lead. Same job as MatchSignals,
 * different evidence: a listing rarely publishes coordinates but always names a
 * town, and often republishes the business's phone number — which is the single
 * strongest tie, since a phone number identifies one business.
 *
 * A signal the listing does not carry is UNAVAILABLE, not zero: scoring an
 * absent field as 0 would punish a perfectly good listing for being terse, and
 * the low band DROPS data. Absent signals are therefore left out of the average.
 */
export interface PortalMatchSignals {
  /**
   * Share of the lead's DISTINCTIVE name tokens present in the listing title
   * (0..1). Coverage, not Jaccard: portals decorate titles with the town and
   * the type word ("Rózsakő Ház Villa - Badacsonytomaj"), which a symmetric
   * overlap metric punishes even though the brand matched perfectly.
   */
  readonly nameCoverage: number;
  /** Does the listing's locality match the lead's OWN town? (ADR-0043 anchor.) */
  readonly cityMatch?: boolean;
  /** Distance between lead coords and listing coords, when the listing has them. */
  readonly distanceMeters?: number;
  /** Do the lead's and the listing's phone numbers match (digits only)? */
  readonly phoneMatch?: boolean;
  /** Does the listing's street address match the lead's? */
  readonly streetMatch?: boolean;
}

/**
 * A4 confidence for a portal listing ↔ lead match. Weighted average over the
 * signals that are actually AVAILABLE, with the same band thresholds as
 * scoreMatch, so "low" means the same thing everywhere in the pipeline: drop.
 */
export function scorePortalMatch(s: PortalMatchSignals): MatchConfidence {
  const parts: { weight: number; value: number; reason: string }[] = [];
  const name = Math.max(0, Math.min(1, s.nameCoverage));
  parts.push({
    weight: 0.45,
    value: name,
    reason: `név-lefedettség ${name.toFixed(2)}`,
  });
  if (s.cityMatch !== undefined) {
    parts.push({
      weight: 0.3,
      value: s.cityMatch ? 1 : 0,
      reason: s.cityMatch ? "település egyezik" : "település NEM egyezik",
    });
  }
  if (s.distanceMeters !== undefined) {
    // Same linear decay as scoreMatch, but over 1 km: a portal's coordinates are
    // often a hand-dropped pin on the street, not the Places centroid.
    const d = Math.max(0, 1 - s.distanceMeters / 1000);
    parts.push({
      weight: 0.15,
      value: d,
      reason: `koordináta-távolság ${Math.round(s.distanceMeters)}m (${d.toFixed(2)})`,
    });
  }
  if (s.phoneMatch !== undefined) {
    parts.push({
      weight: 0.2,
      value: s.phoneMatch ? 1 : 0,
      reason: s.phoneMatch ? "telefonszám egyezik" : "telefonszám eltér",
    });
  }
  if (s.streetMatch !== undefined) {
    parts.push({
      weight: 0.1,
      value: s.streetMatch ? 1 : 0,
      reason: s.streetMatch ? "utca/házszám egyezik" : "cím eltér",
    });
  }

  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);
  const score = totalWeight
    ? Math.max(0, Math.min(1, parts.reduce((sum, p) => sum + p.weight * p.value, 0) / totalWeight))
    : 0;
  let band: ConfidenceBand =
    score >= HIGH ? "high" : score >= MEDIUM ? "medium" : "low";

  // §F.14 in scoring form: a NAME-ONLY agreement is a collision candidate, never
  // a certainty — the same cégnév runs a different business two towns over
  // (Rózsakő ház/Badacsony ↔ Rózsakő Étterem/Kisvárda). With a single available
  // signal the score is mathematically 1.00 while the evidence is one word, so
  // the high band is withheld and a human decides.
  const reasons = parts.map((p) => p.reason);
  if (parts.length < 2 && band === "high") {
    band = "medium";
    reasons.push("csak EGY jel állt rendelkezésre (névegyezés) — nem elég a magas sávhoz");
  }

  return { score, band, reasons };
}
