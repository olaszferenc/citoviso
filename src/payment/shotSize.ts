// A site screenshot's shape — ONE source for the two places that must agree:
// the renderer (payment/siteShot.ts, which takes the picture) and the
// confirmation page (console/views.ts, which gives it a box to sit in).
//
// ⛔ Why it lives in its own file: the page must know the ASPECT RATIO without
// importing the shot engine (playwright-core + db). And it must not GUESS it —
// a hardcoded box height cropped the preview mid-sentence (owner report,
// 2026-09-20: "nagyon le van vágva"). A box built from these numbers cannot
// disagree with the picture, and changing the viewport moves both.
export const SITE_SHOT_VIEWPORT = { width: 1240, height: 820 } as const;

/** `width / height` — the value a CSS `aspect-ratio` needs. */
export const SITE_SHOT_ASPECT = SITE_SHOT_VIEWPORT.width / SITE_SHOT_VIEWPORT.height;
