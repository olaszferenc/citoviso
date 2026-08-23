// KB screenshot generator for the PARTNER console entries (ADR-0045 §J.26:
// reproducible captures — regenerate whenever the UI changes, never hand-made).
// Shoots at phone width (the operator's real device) from the REAL views over
// the dev DB's demo seed (scripts/seed-partner-demo.mts must have run).
//
//   npx tsx scripts/partner-kb-shot.mts

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

import { getPartnerDetail, listPartners } from "../src/console/partnerData.js";
import { partnerPage, partnersPage } from "../src/console/partnerViews.js";
import { pool } from "../src/db/client.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIME: Record<string, string> = { ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml" };

const all = await listPartners();
if (!all.length) {
  console.error("🔴 Nincs partner a dev DB-ben — előbb: npx tsx scripts/seed-partner-demo.mts");
  process.exit(1);
}
const cust = all.find((p) => p.isCustomer && !p.isSupplier) ?? all[0]!;
const detail = (await getPartnerDetail(cust.id))!;

const pages = new Map<string, string>([
  ["list", partnersPage(all, {})],
  ["page", partnerPage(detail, "overview")],
]);

const server = http.createServer((req, res) => {
  const u = (req.url ?? "/").split("?")[0] ?? "/";
  if (u.startsWith("/assets/")) {
    const f = path.join(ROOT, "public", u);
    if (fs.existsSync(f)) {
      res.writeHead(200, { "content-type": MIME[path.extname(f)] ?? "text/plain" });
      res.end(fs.readFileSync(f));
      return;
    }
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(pages.get(u.slice(1)) ?? pages.get("list")!);
});
await new Promise<void>((r) => server.listen(0, r));
const port = (server.address() as { port: number }).port;

const TARGETS: ReadonlyArray<[string, string]> = [
  ["list", "kb/entries/console-partners/assets/hu/screen.png"],
  ["page", "kb/entries/console-partner-page/assets/hu/screen.png"],
];
const browser = await chromium.launch();
for (const [key, out] of TARGETS) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`http://127.0.0.1:${port}/${key}`);
  await page.screenshot({ path: path.join(ROOT, out), fullPage: true });
  await page.close();
  console.log(`  📸 ${out}`);
}
await browser.close();
server.close();
await pool.end();
console.log("✅ partner-KB képernyőképek újragenerálva (390px, valós view + seed-adat)");
