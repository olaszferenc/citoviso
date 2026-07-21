// Deterministic renderer: Recipe + SiteData → complete HTML page (ADR-0016). No AI,
// no randomness. The SAME (recipe) with demo vs. real data yields structurally
// identical HTML — the mock=live guarantee. The skin is named by the recipe.

import { PRIMITIVE_CSS, PRIMITIVES } from "./primitives.js";
import type { Recipe, SiteData } from "./recipe.js";
import { renderSkinVars, SKINS } from "./skins.js";

export function renderSite(recipe: Recipe, data: SiteData): string {
  const skin = SKINS[recipe.skin];
  if (!skin) throw new Error(`unknown skin: ${recipe.skin}`);

  const sections = recipe.sections
    .map((s) => {
      const fn = PRIMITIVES[s.kind];
      if (!fn) throw new Error(`unknown primitive: ${s.kind}`);
      return fn(data);
    })
    .join("\n    ");

  return `<!doctype html>
<html lang="hu">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escText(data.name)}</title>
  <style>
  ${renderSkinVars(skin)}
${PRIMITIVE_CSS}
  </style>
</head>
<body>
    ${sections}
</body>
</html>`;
}

function escText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
