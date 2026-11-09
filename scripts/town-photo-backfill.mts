// Town-photo backfill for the mocks generated BEFORE ADR-0436 with no own photo (owner
// 2026-11-09: „Élesítés + kép nélküli mockok újragenerálása”).
//
// A no-photo mock made before ADR-0436 carries the typographic hero; the generator now resolves
// the town photo at generation time (SiteData.townPhoto), but a persisted mock never asks again.
// This resolves it per lead town (generator/townPhoto.ts — free Wikipedia/Commons API, no key,
// no AI call), persists it into mock_artifact.inputs.siteData, and re-renders the artifact from
// its persisted inputs through the current engine (the same path as rerender-mock.mts). The
// design and the copy stay untouched; only the hero gets the town picture + its credit line.
//
// Skipped: an artifact whose tracked link was ever SENT (§I — what we offered stays frozen), an
// artifact with own photos or an existing townPhoto, a template outside the three pickable ones,
// an artifact without recipe+siteData, and a town with no usable free photo (the typographic
// hero and the nophoto gate stay — ADR-0436 ⑧).
//
//   npx tsx scripts/town-photo-backfill.mts             # dry run: what it would do (asks Wikimedia)
//   npx tsx scripts/town-photo-backfill.mts --go        # persist + re-render
//   npx tsx scripts/town-photo-backfill.mts --go --limit 20
//
// Run from the tree whose cwd serves the mocks (prod: /opt/citoviso/app as citoviso).

import { writeFile } from "node:fs/promises";

import { sql } from "kysely";

import { db } from "../src/db/client.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { injectRuntime } from "../src/generator/runtime.js";
import { secureMockPhotos } from "../src/generator/photoTransport.js";
import { loadLead } from "../src/generator/persist.js";
import { resolveTownPhoto } from "../src/generator/townPhoto.js";

const GO = process.argv.includes("--go");
const limitIdx = process.argv.indexOf("--limit");
const LIMIT = limitIdx > 0 ? Number(process.argv[limitIdx + 1]) : Infinity;
/** A lead without a country of its own: the mock's language says which Wikipedia to ask. */
const LANG_COUNTRY: Record<string, string> = { hu: "HU", de: "AT", sk: "SK", hr: "HR", sl: "SI", pl: "PL", it: "IT", cs: "CZ", ro: "RO" };
const TEMPLATES = new Set(["wordmark-grow", "parallax", "gate-opening"]);
/** Politeness towards the Wikimedia API between two NEW town lookups. */
const LOOKUP_PAUSE_MS = 300;

const rows = await db
  .selectFrom("mock_artifact")
  .innerJoin("lead", "lead.id", "mock_artifact.lead_id")
  .select([
    "mock_artifact.id as id",
    "mock_artifact.lead_id as lead_id",
    "mock_artifact.path as path",
    "mock_artifact.inputs as inputs",
    "lead.name as name",
  ])
  .where(sql<boolean>`coalesce(jsonb_array_length(mock_artifact.inputs->'siteData'->'photos'), 0) = 0`)
  .where(sql<boolean>`mock_artifact.inputs->'siteData'->'townPhoto' is null`)
  .where(({ not, exists, selectFrom }) =>
    not(
      exists(
        selectFrom("prospect")
          .select("prospect.id")
          .whereRef("prospect.mock_artifact_id", "=", "mock_artifact.id")
          .where("prospect.sent_at", "is not", null),
      ),
    ),
  )
  .orderBy("mock_artifact.generated_at", "desc")
  .execute();

const seen = new Set<string>();
const stats = { candidates: rows.length, done: 0, noTown: 0, noCity: 0, template: 0, noInputs: 0, failed: 0 };
const noTownCities = new Map<string, number>();

for (const row of rows) {
  if (stats.done >= LIMIT) break;
  const inputs = (row.inputs ?? {}) as Record<string, unknown>;
  const recipe = inputs.recipe as Recipe | undefined;
  const siteData = inputs.siteData as SiteData | undefined;
  if (!recipe || !siteData) {
    stats.noInputs++;
    continue;
  }
  if (!TEMPLATES.has(String(recipe.template ?? ""))) {
    stats.template++;
    continue;
  }
  const { lead } = await loadLead(String(row.lead_id));
  const l = lead as { city?: string | null; country?: string | null };
  const city = (l.city ?? "").trim();
  if (!city) {
    stats.noCity++;
    continue;
  }
  const country = l.country ?? LANG_COUNTRY[String(siteData.lang ?? "hu")] ?? "HU";
  const key = `${country.toUpperCase()}|${city.toLowerCase()}`;
  const fresh = !seen.has(key);
  seen.add(key);
  const town = await resolveTownPhoto(city, country);
  if (fresh) await new Promise((r) => setTimeout(r, LOOKUP_PAUSE_MS));
  if (!town) {
    stats.noTown++;
    noTownCities.set(city, (noTownCities.get(city) ?? 0) + 1);
    continue;
  }
  if (!GO) {
    console.log(`  · ${row.name} (${city}) → ${town.url.slice(-60)}`);
    stats.done++;
    continue;
  }
  try {
    const next: SiteData = { ...siteData, townPhoto: town };
    const html = await injectRuntime(renderSite(recipe, next, { phase: "mock" }), next.lang);
    const secured = await secureMockPhotos(html, String(row.id), [town.url], String(row.lead_id));
    await writeFile(row.path, secured.html, "utf8");
    await db
      .updateTable("mock_artifact")
      .set({ inputs: { ...inputs, siteData: next } })
      .where("id", "=", row.id)
      .execute();
    console.log(`  ✓ ${row.name} (${city}) → ${row.path}`);
    stats.done++;
  } catch (e) {
    stats.failed++;
    console.warn(`  ✗ ${row.name} (${city}): ${e instanceof Error ? e.message : String(e)}`);
  }
}

const top = [...noTownCities.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
console.log(
  `\n${GO ? "✅ újrarenderelve" : "🔎 szárazfuttatás — újrarenderelné"}: ${stats.done} / ${stats.candidates} jelölt` +
    ` · nincs településfotó: ${stats.noTown} · nincs település: ${stats.noCity} · más sablon: ${stats.template}` +
    ` · nincs inputs: ${stats.noInputs} · hiba: ${stats.failed} · települések: ${seen.size}`,
);
if (top.length) console.log(`   fotó nélküli települések (top): ${top.map(([c, n]) => `${c}×${n}`).join(", ")}`);
process.exit(stats.failed ? 1 : 0);
