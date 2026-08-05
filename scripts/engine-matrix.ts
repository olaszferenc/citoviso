// Art-direction CONTACT SHEET: one lead × every selectable archetype (ADR-0016 + the
// 2026-08-05 reference-port pass). The AI steps (brief + planner + copywriter) run ONCE per
// lead; every further art direction is a DETERMINISTIC re-render of that same persisted
// recipe + SiteData — which is exactly the mock=live mechanism, so the sheet also proves it:
// the copy, facts and photos are identical across the row, only the composition changes.
//
//   npx tsx scripts/engine-matrix.ts <lead> [<lead> …] [--out=sites/_engine-proof/matrix]
//
// Each <lead> is a lead id or name (same resolution as engine-generate.ts).

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { db } from "../src/db/client.js";
import { ARCHETYPES } from "../src/engine/archetypes.js";
import { withArchetype } from "../src/engine/planner.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { SKINS } from "../src/engine/skins.js";
import { generateEngineMock } from "../src/generator/generateEngine.js";
import { loadLead, type LoadedLead } from "../src/generator/persist.js";
import { injectRuntime } from "../src/generator/runtime.js";
import { slugify } from "../src/generator/generate.js";

/** The selectable ART DIRECTIONS, in registry order: not retired, and carrying a skin
 *  affinity — which is what distinguishes a full reference-ported composition from the
 *  neutral `stacked` fallback (that one is a technical safety net, not a design to judge). */
const ART_DIRECTIONS = Object.values(ARCHETYPES).filter((a) => !a.retired && a.skinAffinity?.length);

/** Keep the planner's skin when the art direction was designed for that tonality; otherwise
 *  fall back to the archetype's canonical pairing (a dark composition on a bright skin loses
 *  its character). Deterministic — no AI, no randomness. */
function skinFor(archetypeId: string, plannedSkin: string): string {
  const affinity = ARCHETYPES[archetypeId]?.skinAffinity;
  if (!affinity?.length) return plannedSkin;
  if (affinity.includes(plannedSkin)) return plannedSkin;
  return SKINS[affinity[0]!] ? affinity[0]! : plannedSkin;
}

/** Load the recipe + SiteData an engine run persisted into mock_artifact.inputs. */
async function loadInputs(artifactId: string): Promise<{ recipe: Recipe; siteData: SiteData }> {
  const art = await db
    .selectFrom("mock_artifact")
    .select(["inputs"])
    .where("id", "=", artifactId)
    .executeTakeFirstOrThrow();
  const inputs = art.inputs as Record<string, unknown>;
  const recipe = inputs.recipe as unknown as Recipe;
  const siteData = inputs.siteData as unknown as SiteData;
  if (!recipe || !siteData) throw new Error("a perzisztált inputs nem tartalmaz recipe+siteData-t");
  return { recipe, siteData };
}

async function sheetForLead(loaded: LoadedLead, outDir: string): Promise<string[]> {
  const { lead } = loaded;
  console.log(`\n  ── ${lead.name}`);

  // ONE AI pass: brief + planner + copywriter, persisted into the artifact.
  const res = await generateEngineMock(loaded);
  console.log(`     terv: skin=${res.skin} · archetípus=${res.archetype} [${res.recipeSource}] · fotók: ${res.photos}`);
  const { recipe, siteData } = await loadInputs(res.artifactId);

  const slug = slugify(lead.name);
  const written: string[] = [];
  for (const arch of ART_DIRECTIONS) {
    const retargeted = withArchetype(recipe, arch.id, siteData);
    const skin = skinFor(arch.id, recipe.skin);
    const html = await injectRuntime(renderSite({ ...retargeted, skin }, siteData));
    const file = path.join(outDir, `${slug}--${arch.id}.html`);
    await writeFile(file, html, "utf8");
    written.push(file);
    console.log(`     ${arch.id.padEnd(20)} skin=${skin.padEnd(20)} → ${path.basename(file)}`);
  }
  return written;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const outArg = (args.find((a) => a.startsWith("--out=")) ?? "").split("=")[1];
  const outDir = path.resolve(process.cwd(), outArg || "sites/_engine-proof/matrix");
  const leadArgs = args.filter((a) => !a.startsWith("--"));
  if (!leadArgs.length) throw new Error("adj meg legalább egy lead id-t vagy nevet");

  await mkdir(outDir, { recursive: true });
  const all: string[] = [];
  for (const ref of leadArgs) {
    all.push(...(await sheetForLead(await loadLead(ref), outDir)));
  }
  console.log(
    `\n  ${leadArgs.length} lead × ${ART_DIRECTIONS.length} art direction = ${all.length} oldal → ${outDir}\n` +
      `  (a szöveg/tény/fotó soronként AZONOS — csak a kompozíció változik: ez a mock=live bizonyítéka)\n`,
  );
}

main()
  .catch((e) => {
    console.error(`❌ ${(e as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
