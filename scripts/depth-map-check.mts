#!/usr/bin/env npx tsx
// gate-runner: self-overlap-safe — own url keys (depth-map-check:…), deleted at the end; own PNG names
/**
 * DEPTH MAP guard (ADR-XXXX depth hero) — the maps behind the moving cover, and the experiment
 * arm that decides who gets one.
 *
 *   npx tsx scripts/depth-map-check.mts [--self-test]
 *
 *   ① the coin: ~half of 2 000 lead ids land in the depth arm (45–55 %), and the same id always
 *      lands in the same arm (a re-generation never flips a mock between arms)
 *   ② the size rule: 772×1080 (Szamos-Lak, approved) passes; 511×1080 (Vénusz, too soft) and
 *      1600×690 fail
 *   ③ switch OFF (config.depthHeroExperiment) → arm null and the SAME siteData object back:
 *      production stays byte-identical until someone turns the experiment on
 *   ④ switch ON: a control-coin lead → 'control', untouched; a depth-coin lead on a non-outreach
 *      template → 'skip:template'; a Places cover → 'skip:paid' WITHOUT any fetch (§ cost)
 *   ⑤ the worker (only when the model file is installed — scripts/depth-model-fetch.mts): a real
 *      map comes out of a real photo-like image, a PNG at most 768 px wide; the row is cached, and
 *      the second ensureDepthMap for the same photo does NOT ask for the bytes again; a 600×900
 *      photo is recorded 'small' without running the worker
 *   ⑥ the route pattern serves only `/configure/depth/<24 hex>.png` (no path tricks)
 *
 * --self-test: the coin is replaced by "always depth" — ① must go red.
 */
import { readFile, rm } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { config } from "../src/config.js";
import { db } from "../src/db/client.js";
import type { SiteData } from "../src/engine/recipe.js";
import { depthCoin, withDepthArm } from "../src/generator/depthArm.js";
import { bigEnough, DEPTH_DIR, DEPTH_ROUTE, depthFileOf, depthModelReady, ensureDepthMap } from "../src/media/depthMap.js";

const SELF_TEST = process.argv.includes("--self-test");
let failed = 0;
const ok = (cond: boolean, msg: string): void => {
  console.log(`${cond ? "  ✅" : "  ⛔"} ${msg}`);
  if (!cond) failed++;
};
const mutable = config as { depthHeroExperiment: boolean };
const coin = SELF_TEST ? (): boolean => true : depthCoin;

// ① coin
console.log("depth-map-check — kísérleti ág");
const ids = Array.from({ length: 2000 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
const share = ids.filter((id) => coin(id)).length / ids.length;
ok(share >= 0.45 && share <= 0.55, `① a leadek ~fele kerül a térhatás-ágba (${(share * 100).toFixed(1)} %)`);
ok(ids.every((id) => coin(id) === coin(id)), "① ugyanaz a lead mindig ugyanabba az ágba kerül");
if (SELF_TEST) {
  console.log(failed ? "\n✅ ÖNTESZT: az ① pirosra ment, ahogy kell" : "\n⛔ ÖNTESZT: az ① nem ment pirosra");
  process.exit(failed ? 0 : 1);
}

// ② size rule
ok(bigEnough(772, 1080) && !bigEnough(511, 1080) && !bigEnough(1600, 690), "② méret-szabály: 772×1080 mehet, 511×1080 és 1600×690 nem");

// ③ / ④ arms
const depthId = ids.find((id) => depthCoin(id))!;
const controlId = ids.find((id) => !depthCoin(id))!;
const SD = { name: "Teszt", photos: [{ url: "https://example.invalid/depth-map-check/hero.jpg", alt: "" }] } as unknown as SiteData;
const prev = mutable.depthHeroExperiment;
mutable.depthHeroExperiment = false;
const off = await withDepthArm(SD, { leadId: depthId, artifactId: ids[0]!, template: "parallax" });
ok(off.arm === null && off.siteData === SD, "③ kikapcsolt kísérlet → nincs ág, a siteData érintetlen");
mutable.depthHeroExperiment = true;
const ctl = await withDepthArm(SD, { leadId: controlId, artifactId: ids[0]!, template: "parallax" });
ok(ctl.arm === "control" && ctl.siteData === SD, "④ kontroll-ágú lead → 'control', érintetlen");
const tpl = await withDepthArm(SD, { leadId: depthId, artifactId: ids[0]!, template: "fullbleed" });
ok(tpl.arm === "skip:template" && !tpl.siteData.heroDepth, "④ nem kiküldhető sablon → 'skip:template'");
let fetched = false;
const paid = await ensureDepthMap("https://places.googleapis.com/v1/x/media?key=1", async () => {
  fetched = true;
  return null;
});
ok(paid?.ok === false && !paid.ok && paid.skip === "paid" && !fetched, "④ Places-fotó → 'paid', letöltés nélkül");
mutable.depthHeroExperiment = prev;

// ⑤ worker + cache
const KEY_BIG = "https://example.invalid/depth-map-check/big.jpg";
const KEY_SMALL = "https://example.invalid/depth-map-check/small.jpg";
const cleanup = async (): Promise<void> => {
  await db.deleteFrom("photo_depth_map").where("url_key", "in", [KEY_BIG, KEY_SMALL]).execute();
  await rm(path.join(DEPTH_DIR, depthFileOf(KEY_BIG)), { force: true });
};
await cleanup();
if (!(await depthModelReady())) {
  console.log("  ⏭️  ⑤ a mélységmodell nincs telepítve ezen a gépen (scripts/depth-model-fetch.mts) — a számolás-próba kimarad");
} else {
  console.log("depth-map-check — számolás");
  const photo = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1000"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fbfe8"/><stop offset=".55" stop-color="#cfe3f2"/><stop offset=".56" stop-color="#5b7a3a"/><stop offset="1" stop-color="#2f4a1c"/></linearGradient></defs><rect width="1400" height="1000" fill="url(#s)"/><rect x="420" y="380" width="560" height="360" fill="#a85f3c"/><polygon points="380,390 700,200 1020,390" fill="#5a2f22"/><rect x="640" y="560" width="120" height="180" fill="#3a2418"/><rect x="0" y="820" width="1400" height="180" fill="#6b5a44"/></svg>`,
    ),
  )
    .jpeg()
    .toBuffer();
  let asked = 0;
  const first = await ensureDepthMap(KEY_BIG, async () => {
    asked++;
    return photo;
  });
  const png = first?.ok ? await readFile(path.join(DEPTH_DIR, first.map.file)).catch(() => null) : null;
  const meta = png ? await sharp(png).metadata() : null;
  ok(Boolean(first?.ok && png && meta?.format === "png" && (meta.width ?? 0) <= 768), `⑤ valódi mélységkép készült (${meta ? `${meta.width}×${meta.height} PNG` : "nincs"})`);
  const second = await ensureDepthMap(KEY_BIG, async () => {
    asked++;
    return photo;
  });
  ok(Boolean(second?.ok) && asked === 1, `⑤ a második kérés a cache-ből jön, bájtot nem kér (${asked}×)`);
  const small = await sharp({ create: { width: 600, height: 900, channels: 3, background: { r: 90, g: 90, b: 90 } } }).jpeg().toBuffer();
  const s = await ensureDepthMap(KEY_SMALL, async () => small);
  ok(s?.ok === false && !s.ok && s.skip === "small", "⑤ 600×900-as kép → 'small', a számoló nem fut");
}
await cleanup();

// ⑥ route
ok(
  DEPTH_ROUTE.test("/configure/depth/0123456789abcdef01234567.png") &&
    !DEPTH_ROUTE.test("/configure/depth/../x.png") &&
    !DEPTH_ROUTE.test("/configure/depth/0123456789abcdef01234567.png/x") &&
    !DEPTH_ROUTE.test("/configure/depth/0123456789abcdef0123456.png"),
  "⑥ az útvonal csak /configure/depth/<24 hex>.png-t fogad",
);

await db.destroy();
if (failed) {
  console.log(`\n⛔ depth-map-check: ${failed} hiba`);
  process.exit(1);
}
console.log("\n✅ depth-map-check: zöld");
