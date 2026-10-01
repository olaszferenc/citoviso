// The console's "this look, with THIS lead's data" preview (GET /lead/:id/tpl-preview,
// FK-003b ④) — the existing snapshot (recipe + siteData) re-rendered on another template.
//
// ⛔ THE RUNTIME TRAVELS WITH IT (H-1, Elek live test 2026-10-01). The route used to send
// the bare renderSite() output. Part of the module sections' styling lives only in the
// module runtime (assets/runtime/cit-modules.css — e.g. `.cit-map-pin svg {34px}`), which
// injectRuntime() inlines into every real mock and live page. Without it the map pin's
// SVG had no size and filled its column: a ~300 px black pin on EVERY look of the grid —
// the very picture the curator chooses the look from, while the finished mock was fine.
// The preview must be the mock's twin, so it goes through the same injection.
import type { Recipe, SiteData } from "../engine/recipe.js";
import { renderSite } from "../engine/render.js";
import { TEMPLATES } from "../engine/templates.js";
import { injectRuntime } from "../generator/runtime.js";

/** null = unknown template id. */
export async function renderTemplatePreview(
  base: { readonly recipe: Recipe; readonly siteData: SiteData },
  tplId: string,
  sampleDeny: ReadonlySet<string>,
): Promise<string | null> {
  const tpl = TEMPLATES[tplId];
  if (!tpl) return null;
  // Judged in the template's OWN skin: a look is assessed in the skin it was designed
  // for (the same rule as scripts/template-preview.mts).
  const recipe: Recipe = {
    ...base.recipe,
    template: tplId,
    skin: tpl.skins[0] ?? base.recipe.skin,
  };
  const html = renderSite(recipe, base.siteData, { phase: "mock", sampleDeny });
  return injectRuntime(html, base.siteData.lang);
}
