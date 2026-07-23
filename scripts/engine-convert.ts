// convertLead engine-flip proof (ADR-0016 #2 + ADR-0018 §B.17): generate an ENGINE mock for
// a real lead, approve + convert it, and prove: (1) the LIVE page is engine-rendered from the
// persisted recipe+data (not a stale copy); (2) the §B.17 phase gate works — the MOCK shows
// marked SAMPLE modules (rooms/reviews) but the LIVE page DROPS them (no sample content on a
// live page); (3) the REAL sections (hero + enquiry) reproduce identically.
//   npx tsx scripts/engine-convert.ts ["Sissi"]   (arg = lead id / name; default = newest)
import { readFile } from "node:fs/promises";
import path from "node:path";

import { convertLead } from "../src/conversion/provision.js";
import { db } from "../src/db/client.js";
import { generateEngineMock } from "../src/generator/generateEngine.js";
import { loadLead } from "../src/generator/persist.js";

async function main() {
  const { id: leadId, lead } = await loadLead(process.argv[2]);
  console.log(`\n  lead: ${lead.name}  (${leadId})`);

  // 1. Engine mock (persists recipe + SiteData into mock_artifact.inputs).
  const res = await generateEngineMock({ id: leadId, lead });
  console.log(`  motor-mock: ${res.skin} · ${res.archetype} · szekciók ${res.sections.join(" → ")}`);

  // 2. Approve it (curation gate) so it can convert.
  await db
    .updateTable("mock_artifact")
    .set({ status: "approved" })
    .where("id", "=", res.artifactId)
    .execute();

  // 3. Convert → provisioned private preview (rendered from persisted inputs, LIVE phase).
  const conv = await convertLead(leadId, res.artifactId, ["gallery", "booking"]);
  console.log(`  convert: renderSource=${conv.renderSource} · site=${conv.previewPath}`);

  const mockHtml = await readFile(path.resolve(process.cwd(), res.path), "utf8");
  const liveHtml = await readFile(path.resolve(process.cwd(), conv.previewPath), "utf8");

  // 4. §B.17 phase gate: sample content appears in the MOCK but NOT on the LIVE page.
  const mockHasSample = /cit-sample-note/.test(mockHtml);
  const liveHasSample = /cit-sample-note/.test(liveHtml);
  // 5. Real sections reproduce on live: the hero title + the enquiry spine are present.
  const liveHasHero = new RegExp(`cit-hero-title">${lead.name.slice(0, 6)}`).test(liveHtml);
  const liveHasEnquiry = /id="cit-enquiry"/.test(liveHtml);
  const liveNoindex = /<meta\s+name=["']robots["']\s+content=["']noindex/i.test(liveHtml);

  console.log(`\n  §B.17 fázis-kapu:`);
  console.log(`    minta a MOCK-ban:  ${mockHasSample ? "igen ✅" : "nincs ❌"}`);
  console.log(`    minta a LIVE-on:   ${liveHasSample ? "IGEN ❌ (SZIVÁRGÁS!)" : "nincs ✅ (gate OK)"}`);
  console.log(`    valós hero+érdeklődés a LIVE-on: ${liveHasHero && liveHasEnquiry ? "igen ✅" : "nincs ❌"}`);
  console.log(`    live noindex: ${liveNoindex ? "igen ✅" : "nincs ❌"}`);
  console.log(`    renderSource: ${conv.renderSource}\n`);

  const ok =
    mockHasSample && !liveHasSample && liveHasHero && liveHasEnquiry && conv.renderSource === "engine";
  await db.destroy();
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(`❌ ${(e as Error).message}`);
  process.exit(1);
});
