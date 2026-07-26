// A' ON A REAL LEAD (ADR-0018): run a REAL scraped lead through the enriched engine — the
// same trust-gated pipeline as generateEngineMock, PLUS the editorial layer (grounded
// copywriter → per-section brand voice + editorial hero + showcase rooms). This is the honest
// ceiling test on real data: real name/address, real A4-gated Google Places photos, real
// Google rating as a stat (never fabricated), AI voice; rooms/reviews stay §B.17 sample-marked
// when there is no real data. The live generateEngineMock path is untouched (this is a proof).
//   npx tsx scripts/engine-from-lead-plus.ts ["Sissi"]   (arg = lead id / name; default = newest)
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { config } from "../src/config.js";
import { writeEditorialCopy } from "../src/engine/copywriter.js";
import { planRecipe } from "../src/engine/planner.js";
import type { Recipe, RecipeSection, SiteData, Stat } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { leadToSiteData } from "../src/engine/siteData.js";
import { generateBrief } from "../src/generator/brief.js";
import {
  getRegionContext,
  resolveGatedPhotos,
  resolveRegion,
  slugify,
} from "../src/generator/generate.js";
import { streetViewUrl } from "../src/generator/images.js";
import { loadLead } from "../src/generator/persist.js";
import { injectRuntime } from "../src/generator/runtime.js";
import { db } from "../src/db/client.js";
import { placesLookup } from "../src/scraper/sources/googleMaps.js";
import { scoreMatch } from "../src/scraper/confidence.js";

/** Real Google rating as a fact-safe stat — ONLY when the match is not low-confidence (mirrors
 *  the A4 photo gate). Returns [] otherwise; the stats band renders only with real data. */
async function realStats(lead: {
  name: string;
  lat?: number | null;
  lon?: number | null;
  sources: string[];
}): Promise<Stat[]> {
  if (lead.lat == null || lead.lon == null || !config.googleMapsApiKey) return [];
  const m = await placesLookup(lead.name, lead.lat, lead.lon, config.googleMapsApiKey);
  if (!m) return [];
  const conf = scoreMatch({
    distanceMeters: m.distanceMeters,
    nameSimilarity: m.nameSimilarity,
    corroboratedByOsm: lead.sources.includes("osm"),
  });
  if (conf.band === "low" || !m.rating) return [];
  const stats: Stat[] = [{ value: `${m.rating}★`, label: `${m.userRatingCount ?? "?"} értékelés` }];
  return stats;
}

/** Attach editorial copy per section kind and prefer the editorial hero + showcase rooms. */
function enrichRecipe(recipe: Recipe, copy: Awaited<ReturnType<typeof writeEditorialCopy>>, hasPhotos: boolean): Recipe {
  const byKind = (s: RecipeSection): RecipeSection => {
    switch (s.kind) {
      case "hero":
        return { kind: "hero", variant: hasPhotos ? "editorial" : s.variant, copy: copy.hero };
      case "rooms":
        return { kind: "rooms", variant: "showcase", copy: copy.rooms };
      case "features":
        return { ...s, copy: copy.features };
      case "gallery":
        return { ...s, copy: copy.gallery };
      case "reviews":
        return { ...s, copy: copy.reviews };
      default:
        return s;
    }
  };
  return { ...recipe, sections: recipe.sections.map(byKind) };
}

async function main() {
  const arg = process.argv[2];
  const { id, lead } = await loadLead(arg);
  const region = resolveRegion(undefined, lead.lat, lead.lon);
  const ctx = getRegionContext(region.id, region.label);
  console.log(`\n  lead: ${lead.name}  (${id})`);
  console.log(`  kvalifikáció: ${lead.websiteStatus} · régió: ${region.label}`);

  // A4 confidence-gated real photos (shared trust rule); Street View fallback for grounding.
  const { photos, matchBand } = await resolveGatedPhotos(lead);
  const hero =
    photos[0] ?? (lead.lat != null && lead.lon != null ? streetViewUrl(lead.lat, lead.lon) : "");
  const groundImages = photos.length ? photos : hero ? [hero] : [];
  console.log(`  fotók: ${photos.length} [${matchBand ?? "nincs match"}]`);

  // AI brief for tagline/intro/highlights (grounded on the real photos; keyless → fact-safe).
  let brief: Awaited<ReturnType<typeof generateBrief>> = null;
  try {
    brief = await generateBrief({
      name: lead.name,
      region: region.label,
      regionContext: ctx.tagline,
      imageUrls: groundImages,
    });
  } catch (err) {
    console.warn(`  brief kihagyva → fact-safe fallback: ${(err as Error).message}`);
  }

  const stats = await realStats(lead);
  const siteData: SiteData = {
    ...leadToSiteData(lead, {
      copy: brief ? { tagline: brief.tagline, intro: brief.intro, highlights: brief.highlights } : null,
      photos: photos.map((url, i) => ({ url, alt: `${lead.name} — ${i + 1}. kép` })),
      regionTagline: ctx.tagline,
    }),
    stats,
  };
  console.log(
    `  SiteData: highlights=${siteData.highlights.length} · photos=${siteData.photos.length} · stats=${stats.length} (valós Google-rating)`,
  );

  // Editorial layer (the A' lift): grounded brand voice per section.
  const editorial = await writeEditorialCopy(siteData, region.label);
  console.log(
    `  copywriter: ${editorial.hero?.lead ? `hero="${editorial.hero.lead}"` : "generikus (nincs kulcs/hiba)"}`,
  );

  // Composition planner (skin/archetype), then attach the editorial copy + preferred variants.
  const { recipe, source } = await planRecipe(siteData);
  const enriched = enrichRecipe(recipe, editorial, photos.length > 0);
  console.log(
    `  recept [${source}]: skin=${enriched.skin} · arch=${enriched.archetype} · ${enriched.sections
      .map((s) => s.kind)
      .join(" → ")}`,
  );

  const html = await injectRuntime(renderSite(enriched, siteData));
  const outDir = path.resolve(process.cwd(), "sites/_engine-proof");
  await mkdir(outDir, { recursive: true });
  const file = `lead-${slugify(lead.name)}-plus.html`;
  await writeFile(path.join(outDir, file), html, "utf8");
  console.log(`  → ${file}\n  kimenet: ${outDir}\n`);

  await db.destroy();
}

main().catch(async (e) => {
  console.error(`❌ ${(e as Error).message}`);
  await db.destroy().catch(() => {});
  process.exit(1);
});
