// THE DEPTH-HERO RE-RENDER OF EVERY EXISTING MOCK (ADR-0476, owner 2026-11-24 after the live test:
// „mindenki kapja meg … ha jó a teszt, újra kell generálni az összes létezőt”).
//
// What it does, per mock of the three outreach templates (parallax · gate-opening · wordmark-grow):
//   ① the moving cover: the depth map of the hero is computed (or read from the cache) and
//      siteData.heroDepth set — withDepthArm, the same call the generator makes (config.depthHero)
//   ② the gate leaves (gate-opening only): the stored MACHINE pick is re-decided under the
//      ADR-0474 subject rule (gatePhotoOf). When the new rule finds no photo of another subject,
//      the stored leaves stay — a mock never loses its gate here
//   ③ the page is re-rendered from the persisted inputs through the CURRENT engine into the SAME
//      file (the generator fixes of ADR-0474 ride along: 3.5 s gate, big wordmark frame, pinned
//      parallax photos). Never the AI planner — the persisted inputs ARE the design (§I).
//
// 2026-11-24 PHOTO FIX ROUND (coordinator, owner „csináld meg”): the 11-24 run went with the code
// BEFORE the photo fixes and was stopped at 2 629. The stamp is now "2026-11-24-photofix", so
// every mock is redone once. On top of ①–③, a mock of the CURRENT generator (generated after the
// 2026-11-23 fix — the only ones the send gates let out) gets ④ the generation-time photo fix:
// republished copies dropped (photoHash.fingerprintAndDedupe) and pictures that are not the
// lodging dropped (media/photoKind.ts — local, no API); the result is persisted in siteData.photos.
// 2026-11-24 HERO FIX ROUND (stamp "2026-11-24-herofix"): ④ is now generator/photoCurate.ts, the
// generator's own step, which also moves the best hero first (never a bathroom, stove or banner).
// Older mocks are re-rendered only (their own photos are not in the inputs; they are regenerated).
//
// Safe to stop and re-run: a finished mock carries inputs.terhatasAt and is skipped. Every mock is
// backed up (its HTML gzipped + its inputs) BEFORE it is touched; --restore puts them all back.
//
//   npx tsx scripts/rerender-terhatas.mts                         # dry run: counts only
//   npx tsx scripts/rerender-terhatas.mts --go --backup <dir>     # do it (resumable)
//   npx tsx scripts/rerender-terhatas.mts --go --backup <dir> --limit 20
//   npx tsx scripts/rerender-terhatas.mts --restore <dir>
//
// Run from the tree whose cwd the servers use (the prod app dir on the VPS).

import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";

import { sql } from "kysely";

import { db } from "../src/db/client.js";
import type { Photo, Recipe, SiteData } from "../src/engine/recipe.js";
import { gatePhotoOf } from "../src/engine/templates/gateOpening.js";
import { DEPTH_TEMPLATES, withDepthArm } from "../src/generator/depthArm.js";
import { renderSite } from "../src/engine/render.js";
import { injectRuntime } from "../src/generator/runtime.js";
import { secureMockPhotos } from "../src/generator/photoTransport.js";
import { curateMockPhotos } from "../src/generator/photoCurate.js";
import { photoKindAvailable } from "../src/media/photoKind.js";
import { MOCK_HEROFIX_STAMP, MOCK_MIN_GENERATED_AT } from "../src/outreach/mockPhotoGate.js";

// 2026-11-25 (owner: „Nyitókép javítás nélkül nem mehet ki semmi”): the round with the LIVE hero fix +
// photo allow-list code; the send gates (MOCK_CURRENT_GENERATOR_SQL) ask for this stamp.
const STAMP = MOCK_HEROFIX_STAMP;
const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const GO = argv.includes("--go");
const RESTORE = flag("--restore");
const BACKUP = flag("--backup");
const LIMIT = Number(flag("--limit") ?? 0) || Infinity;

type BackupLine = { id: string; path: string; inputs: unknown };

if (RESTORE) {
  const lines = (await readFile(path.join(RESTORE, "state.jsonl"), "utf8")).split("\n").filter(Boolean);
  let n = 0;
  for (const line of lines) {
    const b = JSON.parse(line) as BackupLine;
    const gz = path.join(RESTORE, "html", `${b.id}.html.gz`);
    if (existsSync(gz)) await writeFile(b.path, gunzipSync(await readFile(gz)));
    await db.updateTable("mock_artifact").set({ inputs: JSON.stringify(b.inputs) } as never).where("id", "=", b.id).execute();
    n++;
  }
  console.log(`↩️  ${n} mock visszaállítva a mentésből (${RESTORE})`);
  await db.destroy();
  process.exit(0);
}
if (GO && !BACKUP) {
  console.error("A --go mellé kötelező a --backup <könyvtár> (minden mock mentése, mielőtt hozzányúlunk).");
  process.exit(1);
}

const templates = [...DEPTH_TEMPLATES];
const rows = await db
  .selectFrom("mock_artifact as m")
  .select([
    "m.id as id",
    "m.lead_id as lead_id",
    "m.path as path",
    "m.inputs as inputs",
    "m.generated_at as generated_at",
    (eb) =>
      eb
        .exists(eb.selectFrom("prospect as p").select("p.id").whereRef("p.mock_artifact_id", "=", "m.id"))
        .as("linked"),
  ])
  .where(sql<string>`m.inputs->'recipe'->>'template'`, "in", templates)
  // The mocks waiting to go out first (queued / held dispatch rows), then the already linked ones.
  .orderBy(
    (eb) => eb.exists(eb.selectFrom("outreach_dispatch as d").select("d.id").whereRef("d.artifact_id", "=", "m.id").where("d.status", "in", ["queued", "held"])),
    "desc",
  )
  .orderBy("linked", "desc")
  .orderBy("m.generated_at", "desc")
  .execute();

const todo = rows.filter((r) => (r.inputs as { terhatasAt?: string } | null)?.terhatasAt !== STAMP);
console.log(`Térhatás-újrarenderelés: ${rows.length} mock a három sablonból, ebből kész ${rows.length - todo.length}, hátra ${todo.length}.`);
if (!GO) {
  await db.destroy();
  process.exit(0);
}

if (!photoKindAvailable()) {
  console.error("A képfelismerő modell hiányzik (config.photoKindModelPath) — a fotó-javítás nem futhat nélküle.");
  process.exit(1);
}
await mkdir(path.join(BACKUP!, "html"), { recursive: true });
const tally = { done: 0, depth: 0, gateChanged: 0, missing: 0, failed: 0 } as Record<string, number>;
const arms = new Map<string, number>();
const t0 = Date.now();
for (const row of todo.slice(0, LIMIT === Infinity ? undefined : LIMIT)) {
  const inputs = (row.inputs ?? {}) as Record<string, unknown>;
  const recipe = inputs.recipe as Recipe | undefined;
  const stored = inputs.siteData as SiteData | undefined;
  if (!recipe || !stored || !row.path) continue;
  if (!existsSync(row.path)) {
    tally.missing++;
    continue;
  }
  try {
    // backup first — the HTML and the inputs exactly as they were
    // (only the FIRST time: a re-run after a crash between the file write and the DB update must
    // not overwrite the original with the half-done page)
    const gz = path.join(BACKUP!, "html", `${row.id}.html.gz`);
    if (!existsSync(gz)) {
      await writeFile(gz, gzipSync(await readFile(row.path)));
      await appendFile(path.join(BACKUP!, "state.jsonl"), JSON.stringify({ id: row.id, path: row.path, inputs } satisfies BackupLine) + "\n");
    }

    const { heroDepth: _old, ...base } = stored;
    let siteData = base as SiteData;
    // ④ the photo fix on a current-generator mock (see the header)
    if (new Date(String(row.generated_at)) >= new Date(MOCK_MIN_GENERATED_AT) && (siteData.photos?.length ?? 0) > 0) {
      const c = await curateMockPhotos(siteData.photos as readonly Photo[]);
      const kept = c.photos;
      tally.dupes = (tally.dupes ?? 0) + c.duplicates.length;
      tally.offPage = (tally.offPage ?? 0) + c.offPage.length;
      if (c.heroMoved) tally.heroMoved = (tally.heroMoved ?? 0) + 1;
      tally.photoFixed = (tally.photoFixed ?? 0) + 1;
      siteData = { ...siteData, photos: kept };
    }
    if (recipe.template === "gate-opening") {
      const photos = (siteData.photos ?? []) as readonly Photo[];
      // Always recomputed: the hero fix can make the old gate photo the new hero (Vörösmarty tér,
      // 11-24) — a stale gatePhoto would open the gate onto itself. No distinct photo → none.
      const pick = gatePhotoOf(photos);
      if (pick?.url !== siteData.gatePhoto?.url) {
        const { gatePhoto: _stale, ...noGate } = siteData;
        siteData = (pick ? { ...noGate, gatePhoto: pick } : noGate) as SiteData;
        tally.gateChanged++;
      }
    }
    const depth = await withDepthArm(siteData, { leadId: String(row.lead_id), artifactId: String(row.id), template: recipe.template });
    siteData = depth.siteData;
    const arm = depth.arm ?? "off";
    arms.set(arm, (arms.get(arm) ?? 0) + 1);
    if (depth.arm === "depth") tally.depth++;

    // (the live tree has no country layer yet — the same render call as its rerender-mock.mts)
    const html = await injectRuntime(renderSite(recipe, siteData, { phase: "mock" }), siteData.lang);
    const secured = await secureMockPhotos(html, String(row.id), (siteData.photos ?? []).map((p) => p.url), String(row.lead_id));
    await writeFile(row.path, secured.html, "utf8");
    await db
      .updateTable("mock_artifact")
      .set({ inputs: JSON.stringify({ ...inputs, siteData, heroDepthArm: depth.arm, terhatasAt: STAMP }) } as never)
      .where("id", "=", row.id)
      .execute();
    tally.done++;
  } catch (e) {
    tally.failed++;
    console.warn(`  ⚠️ ${row.id}: ${e instanceof Error ? e.message : String(e)}`);
  }
  if ((tally.done + tally.failed) % 50 === 0) {
    const min = ((Date.now() - t0) / 60000).toFixed(1);
    console.log(`  … ${tally.done} kész, ${tally.failed} hiba, ${min} perc`);
  }
}
console.log(
  `\n✅ ${tally.done} mock újrarenderelve (térhatással ${tally.depth}, új kapukép ${tally.gateChanged}); hiányzó fájl ${tally.missing}, hiba ${tally.failed}.`,
);
console.log(`   ágak: ${[...arms].map(([k, v]) => `${k} ${v}`).join(" · ")}`);
console.log(`   mentés: ${BACKUP} (visszaállítás: --restore ${BACKUP})`);
await db.destroy();
process.exit(tally.failed ? 1 : 0);
