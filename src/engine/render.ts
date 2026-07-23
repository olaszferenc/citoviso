// Deterministic renderer: Recipe + SiteData → complete HTML page (ADR-0016). No AI,
// no randomness. The SAME (recipe) with demo vs. real data yields structurally
// identical HTML — the mock=live guarantee. The skin is named by the recipe.

import { ARCHETYPES, type RenderedSection } from "./archetypes.js";
import { PRIMITIVE_CSS, PRIMITIVES } from "./primitives.js";
import type { Recipe, SiteData } from "./recipe.js";
import { renderSkinFontLinks, renderSkinVars, SKINS } from "./skins.js";

export function renderSite(recipe: Recipe, data: SiteData): string {
  const skin = SKINS[recipe.skin];
  if (!skin) throw new Error(`unknown skin: ${recipe.skin}`);
  const archetype = ARCHETYPES[recipe.archetype];
  if (!archetype) throw new Error(`unknown archetype: ${recipe.archetype}`);

  // Each primitive renders a chosen VARIANT to a fixed HTML block; the archetype ARRANGES
  // the blocks (it never adds or drops one — that is enforce()'s job). This keeps mock=live:
  // same recipe (skin + archetype + sections/variants) + different data → identical structure.
  const variantCss = new Set<string>();
  const rendered: RenderedSection[] = recipe.sections.map((s) => {
    const prim = PRIMITIVES[s.kind];
    if (!prim) throw new Error(`unknown primitive: ${s.kind}`);
    const vid = s.variant && prim.variants[s.variant] ? s.variant : prim.default;
    const variant = prim.variants[vid]!;
    if (variant.css) variantCss.add(variant.css);
    return { kind: s.kind, html: variant.render(data) };
  });
  const body = archetype.arrange(rendered);
  const extraCss = [...variantCss].join("\n");

  return `<!doctype html>
<html lang="hu">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escText(data.name)}</title>
  ${renderSkinFontLinks(skin)}
  <style>
  ${renderSkinVars(skin)}
${PRIMITIVE_CSS}
${extraCss}
${archetype.css}
  </style>
</head>
<body class="cit-arch-${archetype.id}">
    ${body}
</body>
</html>`;
}

function escText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
