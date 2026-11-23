#!/usr/bin/env npx tsx
// gate-runner: shared-park — switches ONE wordmark-grow / parallax / gate-opening tenant on the shared park and restores it exactly
/**
 * TENANT MOVING COVER guard (ADR-XXXX; contract design-refs/tenant-admin/terhatas-kapcsolo).
 *
 *   npx tsx scripts/hero-motion-tenant-check.mts
 *
 * On a park tenant whose site renders through one of the three depth templates:
 *   ① default (no switch stored): the state follows the mock (§23) — a mock without depth → OFF,
 *      and the snapshot carries no depth attribute
 *   ② switch ON → saved as edited_site_data.heroMotion = "on"; the state is 'pending' or 'on'
 *   ③ within 60 s the map is ready (the background job + snapshot re-render): state 'on' with a
 *      same-origin texture (/uploads/… or /configure/…/photo/…) and a /configure/depth/… map, and
 *      the SNAPSHOT FILE carries exactly one data-cit-depth attribute + the runtime
 *   ④ switch OFF → state 'off', the snapshot has no depth attribute again
 *   ⑤ restore: edited_site_data and the snapshot are put back byte-for-byte
 * Skips (green, says why) when the park has no such tenant or the model is not installed.
 */
import { readFile, writeFile } from "node:fs/promises";

import { db } from "../src/db/client.js";
import { DEPTH_TEMPLATES } from "../src/generator/depthArm.js";
import { depthModelReady } from "../src/media/depthMap.js";
import { setTenantHeroMotion, tenantHeroMotionState } from "../src/tenant/editor.js";

let failed = 0;
const ok = (cond: boolean, msg: string): void => {
  console.log(`${cond ? "  ✅" : "  ⛔"} ${msg}`);
  if (!cond) failed++;
};
const done = async (code: number): Promise<never> => {
  await db.destroy();
  process.exit(code);
};

if (!(await depthModelReady())) {
  console.log("⏭️  hero-motion-tenant-check: a mélységmodell nincs telepítve (scripts/depth-model-fetch.mts) — kimarad");
  await done(0);
}

const sites = await db
  .selectFrom("site")
  .innerJoin("mock_artifact", "mock_artifact.id", "site.source_artifact_id")
  .select(["site.id as siteId", "site.tenant_id as tenantId", "site.path as path", "site.edited_site_data as edited", "mock_artifact.inputs as inputs"])
  .where("site.path", "is not", null)
  .execute();
const pick = sites.find((s) => {
  const i = s.inputs as { recipe?: { template?: string }; siteData?: { photos?: unknown[]; heroDepth?: unknown } };
  return DEPTH_TEMPLATES.has(i.recipe?.template ?? "") && (i.siteData?.photos?.length ?? 0) > 0 && !i.siteData?.heroDepth;
});
if (!pick || !pick.path) {
  console.log("⏭️  hero-motion-tenant-check: a parkon nincs térhatásra alkalmas tenant — kimarad");
  await done(0);
}
const site = pick!;
const snapPath = site.path!;
const snapBefore = await readFile(snapPath, "utf8");
const editedBefore = site.edited;
console.log(`hero-motion-tenant-check — tenant ${site.tenantId.slice(0, 8)}`);

const depthAttrs = (html: string): number => (html.match(/data-cit-depth="/g) ?? []).length;
try {
  const s0 = await tenantHeroMotionState(site.tenantId);
  const stored = (editedBefore as { heroMotion?: string } | null)?.heroMotion;
  if (!stored) ok(s0?.kind === "off" && !s0.wanted && depthAttrs(snapBefore) === 0, `① alapállapot a mock szerint: KI (${s0?.kind})`);
  else console.log(`  ⏭️  ① a tenantnál már van mentett kapcsoló (${stored}) — az alapállapot-próba kimarad`);

  const on = await setTenantHeroMotion(site.tenantId, true);
  const row = await db.selectFrom("site").select("edited_site_data").where("id", "=", site.siteId).executeTakeFirstOrThrow();
  ok(on.ok && (row.edited_site_data as { heroMotion?: string }).heroMotion === "on" && (on.state?.kind === "pending" || on.state?.kind === "on"), `② bekapcsolva, mentve (${on.state?.kind})`);

  let st = on.state;
  for (let i = 0; i < 40 && st?.kind === "pending"; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    st = await tenantHeroMotionState(site.tenantId);
  }
  // the snapshot re-render follows the job; give it a moment
  let snap = await readFile(snapPath, "utf8");
  for (let i = 0; i < 10 && depthAttrs(snap) === 0; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    snap = await readFile(snapPath, "utf8");
  }
  const prev = st && st.kind !== "unsupported" ? st.preview : null;
  ok(
    st?.kind === "on" &&
      Boolean(prev && /^\/(uploads|configure)\//.test(prev.img) && /^\/configure\/depth\/[0-9a-f]{24}\.png$/.test(prev.depth)),
    `③ elkészült: ${st?.kind}, textúra ${prev?.img ?? "—"}, mélységkép ${prev?.depth ?? "—"}`,
  );
  ok(depthAttrs(snap) === 1 && snap.includes("querySelector('[data-cit-depth]')"), `③ a kiszolgált lapon ott a térhatás (${depthAttrs(snap)} attribútum)`);

  const off = await setTenantHeroMotion(site.tenantId, false);
  const snapOff = await readFile(snapPath, "utf8");
  ok(off.state?.kind === "off" && depthAttrs(snapOff) === 0, `④ kikapcsolva: ${off.state?.kind}, a lapon nincs térhatás`);
} finally {
  await db.updateTable("site").set({ edited_site_data: editedBefore === null ? null : JSON.stringify(editedBefore) } as never).where("id", "=", site.siteId).execute();
  await writeFile(snapPath, snapBefore, "utf8");
  const back = await readFile(snapPath, "utf8");
  ok(back === snapBefore, "⑤ visszaállítva (edited_site_data + a lap bájtra)");
}

if (failed) {
  console.log(`\n⛔ hero-motion-tenant-check: ${failed} hiba`);
  await done(1);
}
console.log("\n✅ hero-motion-tenant-check: zöld");
await done(0);
