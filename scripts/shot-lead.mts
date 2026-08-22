// Screenshot the operator LEAD page from real database data, at desktop AND
// phone width. The console is password-gated, so a browser cannot simply visit
// it — this renders the same view function the server renders, serves it beside
// the real stylesheets, and shoots it. Same approach as scripts/kb-shot.mts.
//
//   npx tsx scripts/shot-lead.mts [leadId] [tab]
//
// Phone width is not optional: the operator works this page from a phone
// (mobile-first doctrine), so every layout change must be verified at 390px.

import { chromium } from "playwright-core";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "../src/config.js";
import {
  getConversion,
  getLead,
  getOrderIntents,
  getPayments,
  getProspects,
  listLeads,
} from "../src/console/data.js";
import { leadPage } from "../src/console/views.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "assets", "Temp");

const wanted = process.argv[2];
const tab = process.argv[3] ?? "";

/** Prefer a lead that actually exercises the page (mock + outreach + orders). */
async function pickLeadId(): Promise<string> {
  if (wanted) return wanted;
  const rows = await listLeads({});
  if (!rows.length) throw new Error("nincs lead az adatbázisban");
  const rich = rows.find((r) => (r as { artifacts?: number }).artifacts);
  return (rich ?? rows[0]!).id;
}

const id = await pickLeadId();
const d = await getLead(id);
if (!d) throw new Error(`nincs ilyen lead: ${id}`);

const html = leadPage(
  d,
  false,
  await getConversion(id),
  await getOrderIntents(id),
  await getPayments(id),
  await getProspects(id),
  null,
)
  // The page links stylesheets by absolute /assets path; point them at the repo.
  .replace(/href="\/assets\//g, `href="${pathToFileURL(path.join(ROOT, "public", "assets")).href}/`);

const tmp = await mkdtemp(path.join(tmpdir(), "leadshot-"));
const file = path.join(tmp, "lead.html");
await writeFile(file, html);

const browser = await chromium.launch({ executablePath: config.chromiumPath });
for (const [w, h, tag] of [
  [1280, 900, "desktop"],
  [390, 844, "mobile"],
] as const) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(pathToFileURL(file).href + (tab ? `#${tab}` : ""));
  await page.waitForTimeout(500);
  const out = path.join(OUT, `lead-${tag}${tab ? `-${tab}` : ""}.png`);
  await page.screenshot({ path: out });
  console.log(`✅ ${out}`);
  await page.close();
}
await browser.close();
console.log(`lead: ${d.name} (${id})`);
process.exit(0);
