// Archetype-axis proof (ADR-0016): renders ONE data set through EVERY archetype in the
// registry, proving the pipeline is registry-DRIVEN — adding an archetype = a new layout
// with no core change. Also ASSERTS the extensibility contract: the planner's selectable
// archetype set is EXACTLY the registry keys (no hardcoded schema drift). Writes arch-*.html.
//   npx tsx scripts/engine-archetypes.ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { ARCHETYPES } from "../src/engine/archetypes.js";
import { RECIPE_SCHEMA } from "../src/engine/planner.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";

const data: SiteData = {
  name: "GRANDIS Premium Apartments",
  tagline: "Prémium apartmanok Gödöllő szívében",
  intro: "Igényesen berendezett apartmanok a belvárosban, modern felszereltséggel.",
  highlights: ["Belvárosi elhelyezkedés", "Prémium berendezés", "Saját konyha", "Klimatizált"],
  photos: [
    { url: "https://placehold.co/600x450?text=A", alt: "Apartman" },
    { url: "https://placehold.co/600x450?text=B", alt: "Konyha" },
    { url: "https://placehold.co/600x450?text=C", alt: "Fürdő" },
  ],
  contact: { email: "olaszferenc@gmail.com" },
};

const baseSections: Recipe["sections"] = [
  { kind: "hero" },
  { kind: "features" },
  { kind: "gallery" },
  { kind: "enquiry" },
];

/** Extensibility contract: the schema's archetype enum MUST equal the NON-RETIRED registry
 *  keys (retired ones stay renderable for persisted recipes, but are not selectable). */
function assertContract(): void {
  const selectable = Object.values(ARCHETYPES)
    .filter((a) => !a.retired)
    .map((a) => a.id)
    .sort();
  const schemaEnum = [...(RECIPE_SCHEMA.properties.archetype.enum as string[])].sort();
  const equal =
    selectable.length === schemaEnum.length && selectable.every((k, i) => k === schemaEnum[i]);
  if (!equal) {
    throw new Error(
      `SZERZŐDÉS-SÉRTÉS: a planner archetípus-enum ELTÉR a registry választható részétől.\n` +
        `  választható: ${selectable.join(", ")}\n  séma:        ${schemaEnum.join(", ")}`,
    );
  }
  const retired = Object.values(ARCHETYPES).filter((a) => a.retired).length;
  console.log(
    `\n  bővíthetőségi szerződés: OK ✅ — a planner enum a nem-retired registry (${selectable.length} választható, ${retired} nyugdíjazott de renderelhető)`,
  );
  console.log(`  új archetípus = 1 registry-bejegyzés → a planner + render automatikusan látja\n`);
}

async function main() {
  assertContract();

  const outDir = path.resolve(process.cwd(), "sites/_engine-proof");
  await mkdir(outDir, { recursive: true });

  for (const arch of Object.values(ARCHETYPES)) {
    const recipe: Recipe = { skin: "editorial-warm", archetype: arch.id, sections: baseSections };
    const html = renderSite(recipe, data);
    const file = `arch-${arch.id}.html`;
    await writeFile(path.join(outDir, file), html, "utf8");
    console.log(`  ${arch.id.padEnd(18)} ${arch.label}  → ${file}`);
  }
  console.log(`\n  ugyanaz az adat, ${Object.keys(ARCHETYPES).length} elrendezés. kimenet: ${outDir}\n`);
}

main().catch((e) => {
  console.error(`❌ ${(e as Error).message}`);
  process.exit(1);
});
