// Single source of truth for "which files are RENDERED SURFACES" — the set whose
// pixels / interaction a §2b plan-approval gate decides. Shared by the surface-plan
// gate (surface-plan-scan.mjs) and the ui-shot nudge so the list cannot DRIFT between
// them: feedback_guard_scope_is_the_doctrine — a doctrine's reach IS its guard's file
// list, so keep that list in ONE place. Scope = things whose LOOK/INTERACTION change,
// NOT the whole import closure (data/db modules render no pixels; they belong to the
// i18n scope, not this one).

export const SCOPE = [
  "src/console/views.ts",
  "src/console/partnerViews.ts",
  "src/server/adminViews.ts",
  "src/server/legalViews.ts",
  "src/server/moduleConfigViews.ts",
  "src/ui/icons.ts",
  "public/index.html",
];

// Whole trees whose files are surfaces: the design core / assets, and the engine
// (its rendered mock is what ui-shot captures in file mode).
export const SCOPE_PREFIX = ["public/assets/", "src/engine/"];

/** True if editing this path changes a rendered surface (design gate applies). */
export function isSurfaceFile(filePath) {
  const f = String(filePath ?? "");
  if (!f) return false;
  // Normalise an absolute worktree path down to a repo-relative src/… or public/… tail.
  const rel = f.replace(/^.*?\/(src|public)\//, "$1/");
  return SCOPE.some((s) => f.endsWith(s)) || SCOPE_PREFIX.some((p) => rel.startsWith(p));
}
