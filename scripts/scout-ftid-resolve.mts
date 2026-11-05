// scout-ftid-resolve — fill scout_place.ftid for the scouted places behind LIVE sites.
//
// WHY: a scouted rating's badge can link to Google's own REVIEWS page only through the
// place's feature id (placeIdFromFtid). Magellan's worksheet link usually carries just
// the name and the coordinates (2026-11-05: 19 257 of 19 322 rows had no ftid), and on
// a phone that link opened a bare map — the owner: "térképet nyit meg és nem a
// véleményeket" (Duna Vibe House).
//
// HOW: one Google Maps search per place (name + address + city) in headless Chromium —
// the same free page a person opens, no Places call. The final URL carries the
// `!1s0x…:0x…` feature id. It is accepted ONLY when the place card's title equals the
// scouted name (normalised) — a near miss would point the badge at a neighbour.
//
//   npx tsx scripts/scout-ftid-resolve.mts --dry            (live sites, only prints)
//   npx tsx scripts/scout-ftid-resolve.mts                  (live sites, writes ftid)
//   npx tsx scripts/scout-ftid-resolve.mts <slug> [--dry]   (one site)
//
// After writing: rerender the affected tenants so the static snapshot picks the link up.

import { chromium } from "playwright-core";

import { config } from "../src/config.js";
import { db } from "../src/db/client.js";
import { ftidFromMapsLink, placeIdFromFtid } from "../src/reviews/placeRating.js";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const slug = args.find((a) => !a.startsWith("--"));

const norm = (s: string): string =>
  s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

let q = db
  .selectFrom("site")
  .innerJoin("mock_artifact", "mock_artifact.id", "site.source_artifact_id")
  .innerJoin("scout_place", "scout_place.lead_id", "mock_artifact.lead_id")
  .select([
    "site.slug as slug",
    "scout_place.id as id",
    "scout_place.name as name",
    "scout_place.address as address",
    "scout_place.city as city",
    "scout_place.ftid as ftid",
    "scout_place.link as link",
  ])
  .where((eb) => eb.or([eb("scout_place.ftid", "is", null), eb("scout_place.ftid", "=", "")]));
q = slug ? q.where("site.slug", "=", slug) : q.where("site.status", "=", "live");
const rows = await q.execute();
console.log(`${rows.length} felderített hely ftid nélkül${slug ? ` (${slug})` : " (élő oldalak)"}`);

const browser = rows.length ? await chromium.launch({ executablePath: config.chromiumPath }) : null;
let ok = 0;
for (const r of rows) {
  // A link that already carries the id needs no browser.
  let ftid = ftidFromMapsLink(r.link);
  let title = r.name;
  if (!ftid) {
    const ctx = await browser!.newContext({ locale: "hu-HU" });
    // Pre-accepted consent: otherwise the EU consent wall is all the page shows.
    await ctx.addCookies([
      { name: "SOCS", value: "CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg", domain: ".google.com", path: "/" },
      { name: "CONSENT", value: "YES+cb", domain: ".google.com", path: "/" },
    ]);
    const page = await ctx.newPage();
    const query = [r.name, r.address, r.city].filter(Boolean).join(", ");
    try {
      await page.goto(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await page.waitForURL(/!1s0x[0-9a-f]+:0x[0-9a-f]+/i, { timeout: 15_000 }).catch(() => undefined);
      ftid = ftidFromMapsLink(decodeURIComponent(page.url()));
      title = (await page.locator("h1").first().textContent({ timeout: 5_000 }).catch(() => null)) ?? "";
    } finally {
      await ctx.close();
    }
  }
  const same = norm(title ?? "") === norm(r.name);
  if (!ftid || !same) {
    console.log(`  ✗ ${r.slug}: ${!ftid ? "nincs egyértelmű találat" : `más hely: „${title}” ≠ „${r.name}”`} — kihagyva`);
    continue;
  }
  console.log(`  ✓ ${r.slug}: ${ftid} → ${placeIdFromFtid(ftid)}${dry ? " (dry, nem írtam)" : ""}`);
  if (!dry) {
    await db.updateTable("scout_place").set({ ftid }).where("id", "=", r.id).execute();
  }
  ok++;
}
await browser?.close();
console.log(`${ok}/${rows.length} ${dry ? "feloldható" : "beírva"}`);
await db.destroy();
