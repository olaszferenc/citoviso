// Deterministic renderer: Recipe + SiteData → complete HTML page (ADR-0016). No AI,
// no randomness. The SAME (recipe) with demo vs. real data yields structurally
// identical HTML — the mock=live guarantee. The skin is named by the recipe.

import { ARCHETYPES, type RenderedSection } from "./archetypes.js";
import { CHROME_CSS, renderFooter, renderNav } from "./chrome.js";
import { EMPHASIS_CSS, PRIMITIVE_CSS, PRIMITIVES } from "./primitives.js";
import { isSampleOnly, type Recipe, type RenderPhase, type SiteData } from "./recipe.js";
import { renderSeoHead, seoTitle } from "./seo.js";
import { renderSkinFontLinks, renderSkinVars, SKINS } from "./skins.js";
import { TEMPLATES } from "./templates.js";
import { moduleSections } from "./moduleSections.js";

/** Templates escape their text, so compare against the escaped form. */
function escapeForCompare(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Weave the tenant-set module sections into a rendered page.
 * Placement: immediately BEFORE the enquiry/booking slot when the template has one
 * (content first, call-to-action last — the CTA should close the page, not sit in
 * the middle of it), else before the footer, else before </body>. Returns the page
 * untouched when the owner has configured nothing.
 */
function withModuleSections(html: string, data: SiteData): string {
  // Only 9 of the 16 templates render a rooms section of their own. Rather than
  // editing the other 7 (and forgetting the 18th), the shared block fills the gap —
  // but only when the template did NOT already show them, so nothing prints twice.
  const firstRoom = data.rooms?.[0]?.name;
  const roomsAlreadyShown = firstRoom ? html.includes(escapeForCompare(firstRoom)) : true;
  const block = moduleSections(data, { roomsAlreadyShown });
  if (!block) return html;
  const anchors = [/<section id="cit-enquiry"/, /<footer/i, /<\/body>/i];
  for (const re of anchors) {
    const m = re.exec(html);
    if (m) return html.slice(0, m.index) + block + html.slice(m.index);
  }
  return html + block;
}

export function renderSite(
  recipe: Recipe,
  data: SiteData,
  opts: { phase?: RenderPhase } = {},
): string {
  const phase: RenderPhase = opts.phase ?? "mock";
  // ADR-0027 template-first: a recipe naming an art template renders through the COMPLETE
  // reference-fidelity page template — in BOTH phases (mock=live). Unknown id → composition.
  if (recipe.template && TEMPLATES[recipe.template]) {
    // ADR-0044: tenant-set module content (amenities/hours/pricing/POI/…) is woven
    // in HERE, once, for every template — writing it into all 16 would be the 100×N
    // trap the architecture forbids, and template no. 17 would silently ship without it.
    return withModuleSections(TEMPLATES[recipe.template]!.render(recipe, data, phase), data);
  }
  const skin = SKINS[recipe.skin];
  if (!skin) throw new Error(`unknown skin: ${recipe.skin}`);
  const archetype = ARCHETYPES[recipe.archetype];
  if (!archetype) throw new Error(`unknown archetype: ${recipe.archetype}`);

  const activeSections = recipe.sections.filter((s) => {
    // Data-only modules (stats): dropped without real data in BOTH phases (never fabricated).
    if (s.kind === "stats" && !(data.stats && data.stats.length)) return false;
    // §B.17 phase gate: on LIVE, drop sample-capable modules (rooms/reviews) that have no real
    // data — their marked sample content is mock-only. On MOCK, keep them (marked sample).
    if (phase === "live" && isSampleOnly(s.kind, data)) return false;
    return true;
  });

  // Each primitive renders a chosen VARIANT to a fixed HTML block; the archetype ARRANGES
  // the blocks (it never adds or drops one — that is enforce()'s job). This keeps mock=live:
  // same recipe (skin + archetype + sections/variants) + different data → identical structure.
  const variantCss = new Set<string>();
  const rendered: RenderedSection[] = activeSections.map((s) => {
    const prim = PRIMITIVES[s.kind];
    if (!prim) throw new Error(`unknown primitive: ${s.kind}`);
    const vid = s.variant && prim.variants[s.variant] ? s.variant : prim.default;
    const variant = prim.variants[vid]!;
    if (variant.css) variantCss.add(variant.css);
    let html = variant.render(data, s.copy);
    // ADR-0025 ② emphasis: stamp the section root so EMPHASIS_CSS can size it in the page
    // hierarchy. The spine (hero/enquiry) never carries emphasis. `.replace` hits the FIRST
    // `<section` = the primitive's root (each primitive renders exactly one).
    const emphasis = s.kind === "hero" || s.kind === "enquiry" ? undefined : s.emphasis;
    if (emphasis && emphasis !== "normal") {
      html = html.replace("<section", `<section data-cit-emphasis="${emphasis}"`);
    }
    return { kind: s.kind, html };
  });
  const body = archetype.arrange(rendered);
  const extraCss = [...variantCss].join("\n");

  // The composition path gets the same tenant-set sections as the template path —
  // a module must not depend on which rendering route the recipe happened to take.
  return withModuleSections(
    `<!doctype html>
<html lang="${data.lang ?? "hu"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escText(seoTitle(data))}</title>
  ${renderSeoHead(data, phase)}
  ${renderSkinFontLinks(skin)}
  <style>
  ${renderSkinVars(skin, data.palette?.accent)}
${PRIMITIVE_CSS}
${CHROME_CSS}
${extraCss}
${archetype.css}
${EMPHASIS_CSS}
  </style>
</head>
<body class="cit-arch-${archetype.id}">
    ${renderNav(data, archetype.navLinks ? activeSections.map((s) => s.kind) : undefined)}
    ${body}
    ${renderFooter(data)}
</body>
</html>`,
    data,
  );
}

function escText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
