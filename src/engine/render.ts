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
import { MODULE_SLOTS, moduleSectionGroups } from "./moduleSections.js";
import { sampleRooms } from "./templateKit.js";

/** Templates escape their text, so compare against the escaped form. */
function escapeForCompare(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * ADR-0059 §1 — weave the module DATA into the template's native channel before
 * rendering. usp + amenities are the same content type as the highlights every
 * template already renders natively ("selling points"); appending them as separate
 * blocks was the "ugyanaz a tartalomtípus 2-3×" the owner rejected twice. The
 * merged list keeps the owner's usp first (they curated it), then the lead's real
 * highlights, then the amenities; duplicates collapse on a normalized key.
 * Deterministic — mock=live holds.
 */
function weaveSellingPoints(data: SiteData): SiteData {
  const extra = [...(data.usp ?? []), ...(data.amenities ?? [])];
  if (!extra.length) return data;
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const seen = new Set<string>();
  const merged = [...(data.usp ?? []), ...data.highlights, ...(data.amenities ?? [])].filter(
    (s) => !seen.has(norm(s)) && Boolean(seen.add(norm(s))),
  );
  return { ...data, highlights: merged };
}

/**
 * The measured native-coverage stamp (ADR-0059 ①): which content types this page
 * demonstrates in the template's OWN sections. Read by the configurator so it never
 * appends a generic sample block next to a native section of the same type, and by
 * the inventory/dedup gate. Measured on the rendered page, never assumed — the
 * roomsAlreadyShown lesson generalized.
 */
function stampNativeCoverage(html: string, types: readonly string[]): string {
  if (!types.length) return html;
  return html.replace(/<body([^>]*)>/i, (m, attrs: string) =>
    attrs.includes("data-cit-native") ? m : `<body${attrs} data-cit-native="${types.join(" ")}">`,
  );
}

/**
 * A dead image URL must never surface as broken-icon-plus-alt-text (ADR-0058). Google Places
 * photo URLs expire, and a gallery photo's alt is "<name> — N. kép", so an expired image reads
 * on the page as a bare number (owner report 2026-08-23: "1,2,3,4 a galériánál — katasztrófa").
 * This framework-free runtime swaps any broken <img> for the SAME token-themed designed fill the
 * templates use for empty slots — never a false photo (§B.17). Injected once per rendered page.
 */
const IMG_FALLBACK_JS = `<script>(function(){
function f(img){if(img.getAttribute('data-cit-filled'))return;img.setAttribute('data-cit-filled','1');
var d=document.createElement('div');d.setAttribute('role','img');d.setAttribute('aria-label',img.alt||'');
d.style.cssText="position:absolute;inset:0;width:100%;height:100%;min-height:150px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:radial-gradient(135% 120% at 18% 0%, color-mix(in srgb, var(--cit-accent) 30%, var(--cit-surface)), transparent 60%),radial-gradient(120% 120% at 100% 100%, color-mix(in srgb, var(--cit-accent) 16%, var(--cit-surface)), transparent 55%),var(--cit-surface);color:color-mix(in srgb, var(--cit-accent) 55%, var(--cit-ink))";
d.innerHTML='<svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="opacity:.5"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 15l-5-5L5 20"/></svg>';
var p=img.parentElement;if(p){if(getComputedStyle(p).position==='static')p.style.position='relative';p.replaceChild(d,img);}}
window.addEventListener('error',function(e){var t=e.target;if(t&&t.tagName==='IMG')f(t);},true);
document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('img').forEach(function(i){if(i.complete&&i.naturalWidth===0)f(i);});});
})();</script>`;

function injectImgFallback(html: string): string {
  return html.includes("</body>")
    ? html.replace("</body>", `${IMG_FALLBACK_JS}</body>`)
    : html + IMG_FALLBACK_JS;
}

/**
 * Weave the tenant-set module sections into a rendered page (ADR-0047).
 *
 * PREFERRED PATH — the template names the places: it plants `data-cit-slot` markers
 * where each GROUP of modules belongs, and each group is rendered there. This is why
 * a paid module reads as part of the site instead of an appendix.
 *
 * FALLBACK — a template with no markers gets the old single lump before its enquiry
 * slot. That path is measured, not assumed: scripts/module-slot-check.mts fails if a
 * template ships without markers, so the fallback cannot quietly become the norm.
 *
 * WHY THE OLD BEHAVIOUR WAS WRONG: "before the enquiry slot" sounds like "at the
 * end", but a template is free to put its CTA anywhere. On `editorial` the enquiry
 * IS the coupon near the top, so all ten module blocks landed ahead of the gallery
 * and the reviews — on live tenant pages too, not just mocks.
 */
/**
 * ADR-0061 — which modules the MOCK shows as marked, native-styled samples: every
 * module the lead could buy, wherever real data is absent. Real data always wins;
 * the live phase gets an empty set, so nothing sample-like can reach a tenant page.
 * The map is listed only when we hold REAL location data to feed it.
 */
function demoModuleSamples(data: SiteData, phase: RenderPhase): Set<string> {
  const s = new Set<string>();
  if (phase !== "mock") return s;
  if (!data.rooms?.length) s.add("rooms");
  if (!data.hours) s.add("hours");
  if (!data.pricing) s.add("pricing");
  if (!data.poi?.length) s.add("poi");
  if (!data.newsletter) s.add("newsletter");
  if (!data.reviewForm) s.add("review-form");
  if (!data.location && (data.geo || data.contact.address)) s.add("map");
  return s;
}

/**
 * Page-level module coverage for the stamp (measured on the FINAL page): the
 * configurator must never inject a generic sample card for content the page
 * already carries as a real, native-styled section (ADR-0061).
 */
function measureModuleCoverage(html: string): string[] {
  const types: string[] = [];
  if (/data-cit-module="rooms"/.test(html)) types.push("rooms");
  if (/data-cit-module="hours"/.test(html)) types.push("hours");
  if (/data-cit-module="pricing"/.test(html)) types.push("pricing");
  if (/data-cit-module="poi"/.test(html)) types.push("poi");
  if (/data-cit-module="newsletter"/.test(html)) types.push("newsletter");
  if (/data-cit-module="map"/.test(html)) types.push("map");
  if (/data-cit-module="(reviews|reviews-pending|review-form)"/.test(html)) types.push("reviews");
  if (/data-cit-variant="request"/.test(html)) types.push("booking");
  return types;
}

function withModuleSections(html: string, data: SiteData, phase: RenderPhase): string {
  // Only some templates render a rooms section of their own. Rather than editing the
  // others (and forgetting the next one), the shared block fills the gap — but only
  // when the template did NOT already show them, so nothing prints twice. On the
  // mock the probe is the SAMPLE rooms' first name (ADR-0061): the 9 native-rooms
  // templates render them in-template, the other 7 get the shared sample block.
  const samples = demoModuleSamples(data, phase);
  const firstRoom =
    data.rooms?.[0]?.name ?? (samples.has("rooms") ? sampleRooms(data)[0]?.name : undefined);
  // The booking widget's data-cit-units attribute carries the SAME room names as
  // JSON — an attribute is not a rooms section, so it must not satisfy the probe.
  const probeHtml = html.replace(/ data-cit-units="[^"]*"/g, "");
  const roomsAlreadyShown = firstRoom ? probeHtml.includes(escapeForCompare(firstRoom)) : true;
  // ADR-0059 §1: the usp/amenities items were woven into `highlights` before render;
  // whatever the template's native section did not fit (its own slice caps) goes into
  // ONE shared leftover block. Measured on the output — the module promise ("what you
  // type shows up", ADR-0044) survives any template cap without a second section.
  const sellingLeftover = [...(data.usp ?? []), ...(data.amenities ?? [])].filter(
    (item) => !html.includes(escapeForCompare(item)),
  );
  const { css, groups } = moduleSectionGroups(data, {
    roomsAlreadyShown,
    sellingLeftover,
    // ADR-0061 mock all-in: absent module data renders as a MARKED native sample
    // section, and every mock form is try-able without submitting anywhere.
    samples,
    demo: phase === "mock",
  });
  if (!css) return html;

  // Slot path: replace each marker with its group (an unfilled marker disappears).
  if (/data-cit-slot="/.test(html)) {
    let out = html;
    let placed = "";
    for (const slot of MODULE_SLOTS) {
      const marker = new RegExp(`<div data-cit-slot="${slot}"\\s*></div>`);
      const block = groups[slot] ?? "";
      if (marker.test(out)) {
        out = out.replace(marker, block);
        placed += block;
      }
    }
    // Anything whose slot the template does not define still has to reach the page —
    // the tenant paid for it. It goes where the fallback would have put it.
    const orphans = MODULE_SLOTS.map((s) => groups[s] ?? "")
      .filter((b) => b && !placed.includes(b))
      .join("");
    out = out.replace(/<\/head>/i, `${css}</head>`);
    if (!orphans) return out;
    const m = /<section id="cit-enquiry"/.exec(out);
    return m ? out.slice(0, m.index) + orphans + out.slice(m.index) : out + orphans;
  }

  const block = css + MODULE_SLOTS.map((s) => groups[s] ?? "").join("");
  const anchors = [/<section id="cit-enquiry"/, /<footer/i, /<\/body>/i];
  for (const re of anchors) {
    const m = re.exec(html);
    if (m) return html.slice(0, m.index) + block + html.slice(m.index);
  }
  return html + block;
}

/**
 * Which content types the page's OWN sections demonstrate (measured on the raw
 * template/composition output, BEFORE the shared module blocks are woven in — a
 * shared block must not count as native coverage of itself).
 */
function measureNativeCoverage(html: string, data: SiteData): string[] {
  const types: string[] = [];
  if (/data-cit-module="rooms"/.test(html)) types.push("rooms");
  if (data.highlights.some((h) => html.includes(escapeForCompare(h)))) types.push("selling-points");
  if (/data-cit-module="gallery"/.test(html)) types.push("gallery");
  if (/data-cit-module="reviews"/.test(html)) types.push("reviews");
  return types;
}

export function renderSite(
  recipe: Recipe,
  data: SiteData,
  opts: { phase?: RenderPhase } = {},
): string {
  const phase: RenderPhase = opts.phase ?? "mock";
  // ADR-0059 §1: module data that has a native channel is woven into the data BEFORE
  // the template renders, so it lands inside the template's own sections.
  data = weaveSellingPoints(data);
  // ADR-0027 template-first: a recipe naming an art template renders through the COMPLETE
  // reference-fidelity page template — in BOTH phases (mock=live). Unknown id → composition.
  if (recipe.template && TEMPLATES[recipe.template]) {
    // ADR-0044: tenant-set module content (amenities/hours/pricing/POI/…) is woven
    // in HERE, once, for every template — writing it into all 16 would be the 100×N
    // trap the architecture forbids, and template no. 17 would silently ship without it.
    const raw = TEMPLATES[recipe.template]!.render(recipe, data, phase);
    const page = withModuleSections(raw, data, phase);
    return injectImgFallback(
      stampNativeCoverage(page, [
        ...new Set([...measureNativeCoverage(raw, data), ...measureModuleCoverage(page)]),
      ]),
    );
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
  const rawPage = `<!doctype html>
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
</html>`;
  const page = withModuleSections(rawPage, data, phase);
  return injectImgFallback(
    stampNativeCoverage(page, [
      ...new Set([...measureNativeCoverage(rawPage, data), ...measureModuleCoverage(page)]),
    ]),
  );
}

function escText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
