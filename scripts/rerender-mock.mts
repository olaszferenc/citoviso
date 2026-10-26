// Deterministic mock re-render from persisted inputs (ADR-0016 mock=live foundation).
//
// A motor-side fix (template CSS, module weave, runtime) does NOT propagate to the
// already-generated mock files — they are static snapshots. This re-renders a lead's
// mock artifact(s) from mock_artifact.inputs (recipe + siteData), through the CURRENT
// engine, into the SAME file path the console serves. Never the AI planner again —
// that would be bait-and-switch (§I); the persisted inputs ARE the design.
//
//   npx tsx scripts/rerender-mock.mts "Villa Rubin"        # every artifact of the lead
//   npx tsx scripts/rerender-mock.mts <artifactId>         # one artifact
//   npx tsx scripts/rerender-mock.mts "Laguna" --rehero    # + re-pick the hero from the
//                                                          #   cached verdicts (with the
//                                                          #   full-image health penalty,
//                                                          #   photoHealth.ts), persist the
//                                                          #   new photo order, then render
//   npx tsx scripts/rerender-mock.mts <artifactId> --resample # + recompute the SAMPLE hints
//                                                          #   (services sample, room count,
//                                                          #   denied types) from the lead's
//                                                          #   source, persist them, render
//
// --resample (ADR-0404) exists because the sample hints are PERSISTED in siteData: a rule fix
// in the generator (Hargita „a közelben található étterem” → no „Étterem”; Hotel Garni's
// contradicted room count) does not reach a mock by a plain re-render. It recomputes only
// those four fields — no AI, no network: the same sampleHintsOf() the generator runs, over
// the listing + prose + the first generation's quote-verified facts. It never adds a claim the
// source does not make, so it also runs on a link already sent (§I: the offer was the design
// and the copy, both untouched; a false sample item is a correction, not a switch).
//
// --rehero is DEV-ONLY and refuses an artifact whose tracked link was ever SENT: §I
// freezes what we offered; a created-but-unsent link is not an offer. The operator's
// hero pin (lead_hero_override) wins over the machine order. No AI call — the cached
// vision verdicts plus a pixel statistic decide.
//
// Run from the tree whose cwd the console serves (the main tree for :4600).

import { writeFile } from "node:fs/promises";

import { db } from "../src/db/client.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { checkDesign } from "../src/generator/designCheck.js";
import { injectRuntime } from "../src/generator/runtime.js";
import { getHeroPin, rerenderArtifactWithHero } from "../src/generator/heroOverride.js";
import { secureMockPhotos } from "../src/generator/photoTransport.js";
import { sampleHintsOf } from "../src/generator/generateEngine.js";
import { loadLead } from "../src/generator/persist.js";
import { collectWriterSources, type WriterSourceLead } from "../src/generator/writerSources.js";
import { quotedFactsOf } from "../src/generator/copySources.js";
import { DEFAULT_LANG } from "../src/i18n/lang.js";

const REHERO = process.argv.includes("--rehero");
const RESAMPLE = process.argv.includes("--resample");
if (REHERO && RESAMPLE) {
  console.error("A --rehero és a --resample külön futtatandó (a --rehero a régi inputs-ból renderel).");
  process.exit(1);
}
const arg = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!arg) {
  console.error('Használat: npx tsx scripts/rerender-mock.mts "<lead név>" | <artifactId>');
  process.exit(1);
}

const isUuid = /^[0-9a-f-]{36}$/i.test(arg);
const rows = await db
  .selectFrom("mock_artifact")
  .innerJoin("lead", "lead.id", "mock_artifact.lead_id")
  .select(["mock_artifact.id as id", "mock_artifact.lead_id as lead_id", "mock_artifact.path as path", "mock_artifact.inputs as inputs", "lead.name as name"])
  .$if(isUuid, (q) => q.where("mock_artifact.id", "=", arg))
  .$if(!isUuid, (q) => q.where("lead.name", "ilike", `%${arg}%`))
  .orderBy("mock_artifact.generated_at", "desc")
  .execute();

if (!rows.length) {
  console.error(`Nincs mock_artifact erre: ${arg}`);
  process.exit(1);
}

let done = 0;
for (const row of rows) {
  const inputs = (row.inputs ?? {}) as Record<string, unknown>;
  const recipe = inputs.recipe as Recipe | undefined;
  let siteData = inputs.siteData as SiteData | undefined;
  if (!recipe || !siteData) {
    console.warn(`  – ${row.path}: nincs recipe+siteData az inputs-ban (régi artifact) — kihagyva`);
    continue;
  }
  if (RESAMPLE) {
    const { lead } = await loadLead(String(row.lead_id));
    const sources = collectWriterSources(lead as unknown as WriterSourceLead, []);
    const amenities = [...sources.amenities];
    for (const f of quotedFactsOf(inputs))
      if (!amenities.some((a) => a.toLowerCase() === f.label.toLowerCase())) amenities.push(f.label);
    const { hints } = sampleHintsOf(lead, siteData.lang || DEFAULT_LANG, {
      listedAmenities: sources.listedAmenities,
      amenities,
      descriptions: sources.descriptions,
      descriptionFacts: sources.descriptionFacts,
    });
    const { sampleRoomCount: _c, sampleRoomNames: _n, sampleAmenities: _a, sampleAmenityDeny: _d, sampleUnitKind: _k, ...rest } = siteData;
    const next: SiteData = { ...rest, ...hints };
    const show = (d: SiteData) =>
      `szolgáltatás=[${(d.sampleAmenities ?? []).join(", ")}] tiltott=[${(d.sampleAmenityDeny ?? []).join(", ")}] szobaszám=${d.sampleRoomCount ?? "—"} nevek=[${(d.sampleRoomNames ?? []).join(", ")}] egység=${d.sampleUnitKind ?? "—"}`;
    console.log(`  · ${row.name} (${String(row.id).slice(0, 8)}) minta-jelzések\n      előtte: ${show(siteData)}\n      utána:  ${show(next)}`);
    await db
      .updateTable("mock_artifact")
      .set({ inputs: { ...inputs, siteData: next } })
      .where("id", "=", row.id)
      .execute();
    siteData = next;
  }
  if (REHERO) {
    const sent = await db
      .selectFrom("prospect")
      .select("id")
      .where("mock_artifact_id", "=", row.id)
      .where("sent_at", "is not", null)
      .executeTakeFirst();
    if (sent) {
      console.warn(`  – ${row.path}: a követett linkje már KIMENT — a nyitóképét nem cseréljük alatta (§I); kihagyva`);
      continue;
    }
    const pin = await getHeroPin(row.lead_id);
    const before = (siteData.photos ?? [])[0]?.url ?? "";
    const r = await rerenderArtifactWithHero(row, pin?.url ?? null, "rerender-mock --rehero");
    if (!r.ok) {
      console.warn(`  – ${row.path}: ${r.message}`);
      continue;
    }
    const after = await db
      .selectFrom("mock_artifact")
      .select("inputs")
      .where("id", "=", row.id)
      .executeTakeFirstOrThrow();
    const nowHero = ((after.inputs as { siteData?: { photos?: { url: string }[] } }).siteData?.photos ?? [])[0]?.url ?? "";
    console.log(
      `  ✓ ${row.name} → ${row.path} (hero ${nowHero === before ? "változatlan" : "CSERÉLVE"}${pin ? ", operátori választás" : ""}: …${nowHero.slice(-24)})`,
    );
    done++;
    continue;
  }
  const html = await injectRuntime(renderSite(recipe, siteData, { phase: "mock" }), siteData.lang);
  // http-s fotó a https-es mockon nem jelenik meg (ADR-0341): https-emelés vagy saját proxy.
  const secured = await secureMockPhotos(html, String(row.id), (siteData.photos ?? []).map((p) => p.url), String(row.lead_id));
  await writeFile(row.path, secured.html, "utf8");
  const design = checkDesign(html);
  console.log(
    `  ✓ ${row.name} → ${row.path} (dizájn: ${design.verdict}${design.verdict === "pass" ? "" : ` — ${design.reason}`})`,
  );
  done++;
}
console.log(`\n✅ ${done}/${rows.length} mock újrarenderelve a persistált inputs-ból.`);
process.exit(0);
