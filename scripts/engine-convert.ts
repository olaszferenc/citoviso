// convertLead engine-flip proof (ADR-0016, item #2): generate an ENGINE mock for a real
// lead, approve it, convert it, and prove the provisioned LIVE page is byte-identical (in
// its <body>) to the approved mock — because both come from renderSite(recipe, siteData).
// That is mock=live for real: the live page is a deterministic re-render of the persisted
// recipe+data, not a copy of a stale snapshot.
//   npx tsx scripts/engine-convert.ts ["Sissi"]   (arg = lead id / name; default = newest)
import { readFile } from "node:fs/promises";
import path from "node:path";

import { convertLead } from "../src/conversion/provision.js";
import { db } from "../src/db/client.js";
import { generateEngineMock } from "../src/generator/generateEngine.js";
import { loadLead } from "../src/generator/persist.js";

/** Extract the <body>…</body> slice (the head differs: live gets a noindex meta). */
function bodyOf(html: string): string {
  const start = html.indexOf("<body");
  const end = html.indexOf("</body>");
  return start >= 0 && end >= 0 ? html.slice(start, end + 7) : html;
}

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

  // 3. Convert → provisioned private preview (rendered from persisted inputs).
  const conv = await convertLead(leadId, res.artifactId, ["gallery", "booking"]);
  console.log(`  convert: renderSource=${conv.renderSource} · site=${conv.previewPath}`);

  // 4. mock=live: the provisioned live <body> must equal the mock <body>.
  const mockHtml = await readFile(path.resolve(process.cwd(), res.path), "utf8");
  const liveHtml = await readFile(path.resolve(process.cwd(), conv.previewPath), "utf8");
  const same = bodyOf(mockHtml) === bodyOf(liveHtml);
  const liveNoindex = /<meta\s+name=["']robots["']\s+content=["']noindex/i.test(liveHtml);

  console.log(
    `\n  mock=live (<body> azonos): ${same ? "AZONOS ✅" : "ELTÉR ❌"} · live noindex: ${
      liveNoindex ? "igen ✅" : "nincs ❌"
    }`,
  );
  console.log(`  → a live a perzisztált recept+adatból renderelt, nem HTML-másolat\n`);

  await db.destroy();
  if (!same || conv.renderSource !== "engine") process.exit(1);
}

main().catch((e) => {
  console.error(`❌ ${(e as Error).message}`);
  process.exit(1);
});
