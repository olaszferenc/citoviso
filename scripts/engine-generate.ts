// Engine-generation proof (ADR-0016, item #1): generate a mock through the composition
// engine for a REAL lead, then prove the persisted recipe+SiteData LOSSLESSLY reconstruct
// the exact mock — i.e. convertLead could re-render the LIVE page from inputs alone, with
// no HTML copy. That byte-identical reconstruction IS the mock=live foundation.
//   npx tsx scripts/engine-generate.ts ["Sissi"] [--archetype=fullbleed-glass]
//   (arg = lead id / name; default = newest; --archetype = curator/demo override)
import { readFile } from "node:fs/promises";
import path from "node:path";

import { db } from "../src/db/client.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { generateEngineMock } from "../src/generator/generateEngine.js";
import { loadLead } from "../src/generator/persist.js";
import { injectRuntime } from "../src/generator/runtime.js";

async function main() {
  const args = process.argv.slice(2);
  const archetype = (args.find((a) => a.startsWith("--archetype=")) ?? "").split("=")[1];
  const skin = (args.find((a) => a.startsWith("--skin=")) ?? "").split("=")[1];
  const { id, lead } = await loadLead(args.find((a) => !a.startsWith("--")));
  console.log(`\n  lead: ${lead.name}  (${id})`);

  const res = await generateEngineMock({ id, lead }, undefined, {
    ...(archetype ? { archetype } : {}),
    ...(skin ? { skin } : {}),
  });
  console.log(`  motor-mock: skin=${res.skin} · archetípus=${res.archetype} [${res.recipeSource}]`);
  console.log(`  szekciók: ${res.sections.join(" → ")} · fotók: ${res.photos}`);
  console.log(`  artifact: ${res.artifactId} · fájl: ${res.path}`);

  // Reload ONLY the persisted inputs and rebuild the page from them.
  const art = await db
    .selectFrom("mock_artifact")
    .select(["inputs", "path"])
    .where("id", "=", res.artifactId)
    .executeTakeFirstOrThrow();
  const inputs = art.inputs as Record<string, unknown>;
  const recipe = inputs.recipe as unknown as Recipe;
  const siteData = inputs.siteData as unknown as SiteData;
  if (!recipe || !siteData) throw new Error("a perzisztált inputs nem tartalmaz recipe+siteData-t");

  const reproduced = await injectRuntime(renderSite(recipe, siteData));
  const onDisk = await readFile(path.resolve(process.cwd(), art.path!), "utf8");
  const identical = reproduced === onDisk;

  console.log(
    `\n  round-trip (perzisztált inputs → render): ${
      identical ? "AZONOS ✅ — a recept+adat bájtra reprodukálja a mockot" : "ELTÉR ❌"
    }`,
  );
  console.log(
    `  → convertLead a LIVE-ot ugyanígy renderelheti az inputs-ból (nincs HTML-másolás) = mock=live alap\n`,
  );

  await db.destroy();
  if (!identical) process.exit(1);
}

main().catch((e) => {
  console.error(`❌ ${(e as Error).message}`);
  process.exit(1);
});
