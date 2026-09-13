// Elek step verdict — the SILENT-FAILURE gate (ADR-0130).
//
// Until 2026-09-13 the runner recorded console errors and HTTP >= 400 responses
// per step and then ignored them when judging: FK-004's broken MMS preview
// (404 in two steps, a broken-image icon under a live "start real SIM send"
// button) was reported as `pass` twice. A measurement that records a failure and
// grades it green is worse than no measurement — it manufactures confidence.
//
// Rule: a step is only green if NOTHING failed on it. Legitimate errors exist
// (a frozen tenant site answers 503 BY DESIGN), so they are tolerated — but only
// as an EXPLICIT, reasoned scenario line (`tűrt-hiba: <minta> — <indok>`), never
// as a blanket default. Lives in src/ because elek/bin/*.mts is outside the
// tsconfig include: the verdict rule must be type-checked and unit-testable.

/** A scenario-declared exception: substring pattern + why it is lawful. */
export interface ToleratedError {
  readonly pattern: string;
  readonly reason: string;
}

export interface StepNoiseInput {
  readonly consoleErrors: readonly string[];
  readonly httpErrors: readonly string[];
  readonly tolerated: readonly ToleratedError[];
}

export interface StepNoise {
  /** Errors NOT covered by any exception — these turn the step red. */
  readonly offending: string[];
  /** Errors matched by an exception, with the reason that let them through. */
  readonly toleratedHits: { error: string; reason: string }[];
  /** Declared exceptions that matched nothing on this step. */
  readonly unusedPatterns: string[];
}

/**
 * ALL whitespace-separated tokens of the pattern must appear in the error string
 * (case-insensitive). Not one substring: the recorded error carries an ephemeral
 * host between the status and the path — `503 http://127.0.0.1:36783/t/elek-…` —
 * so the natural, readable declaration (`503 /t/elek-teszt-vendeghaz/`) could
 * never match as a single substring. Measured: the first version of this guard
 * failed exactly there, on the one real exception in the suite.
 */
function matches(error: string, pattern: string): boolean {
  const hay = error.toLowerCase();
  const tokens = pattern.toLowerCase().split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((t) => hay.includes(t));
}

/**
 * Split a step's recorded errors into "kills the step" and "explicitly allowed".
 * Case-insensitive substring matching: the recorded strings carry an ephemeral
 * port (`http://127.0.0.1:38581/...`), so an anchored/exact rule could never be
 * written by a scenario author.
 */
export function classifyStepNoise(input: StepNoiseInput): StepNoise {
  const all = [...input.consoleErrors, ...input.httpErrors];
  const offending: string[] = [];
  const toleratedHits: { error: string; reason: string }[] = [];
  const used = new Set<string>();
  for (const err of all) {
    const hit = input.tolerated.find((t) => matches(err, t.pattern));
    if (hit) {
      used.add(hit.pattern);
      toleratedHits.push({ error: err, reason: hit.reason });
    } else {
      offending.push(err);
    }
  }
  return {
    offending,
    toleratedHits,
    // A stale exception is a lie about the product ("this 503 is by design") that
    // nothing else would ever report. Surfaced, not silently carried.
    unusedPatterns: input.tolerated.filter((t) => !used.has(t.pattern)).map((t) => t.pattern),
  };
}

/** One sentence for the step's `error` field — names the class and the count. */
export function noiseErrorText(offending: readonly string[]): string {
  return (
    `néma hiba a lépésen (${offending.length} db konzol-/HTTP-hiba, a lépés ettől PIROS): ` +
    offending.join(" · ").slice(0, 600)
  );
}
