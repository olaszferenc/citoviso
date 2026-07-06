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
