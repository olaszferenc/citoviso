// Elakadt, KIFIZETETT többnyelvű generálások újraindítása (ADR-0063).
//
// MIÉRT KELL: a generálás a webhook után DETACHED fut (3 nyelv fordítása perceket
// vesz igénybe), ezért egy szerver-újraindítás vagy összeomlás közben elvágja —
// a sor örökre 'generating'-en marad, a vevő pedig kifizetett egy fordítást, ami
// soha nem készül el. Mérve a dev-parkon 2026-09-11: KÉT ilyen sor, az egyik 12
// órás. A Modulok-kártya ezt azóta kimondja („a generálás a vártnál tovább tart —
// csapatunk utánanéz és befejezi"), és ez a script az, AMIVEL utánanézünk: az
// ígéret nélküle üres mondat lenne (§B.17 ránk is áll).
//
//   npx tsx scripts/multilang-resume-stalled.mts            # lista, nem ír semmit
//   npx tsx scripts/multilang-resume-stalled.mts --go       # újraindítja őket
//   npx tsx scripts/multilang-resume-stalled.mts --go --site <uuid>
//
// ⚠️ A generálás VALÓS LLM-munka (fizetős). Ezért alapból CSAK listáz, és a --go
// is egyesével, sorban dolgozik — nincs tömeges újraindítás.

process.env.DATABASE_URL = "";

import { db } from "../src/db/client.js";
import { MULTILANG_STALL_MINUTES } from "../src/tenant/multilangCard.js";
import { runMultilangGeneration } from "../src/tenant/multilangGenerate.js";

const GO = process.argv.includes("--go");
const siteArg = process.argv[process.argv.indexOf("--site") + 1];
const onlySite = process.argv.includes("--site") ? siteArg : null;

// Csak az számít elakadtnak, amit KI IS FIZETTEK: fizetetlen sorra nem dolgozunk.
let q = db
  .selectFrom("multilang_generation as g")
  .innerJoin("payment as p", "p.order_intent_id", "g.order_intent_id")
  .innerJoin("tenant as t", "t.id", "g.tenant_id")
  .select([
    "g.id as id",
    "g.site_id as siteId",
    "g.status as status",
    "g.languages as languages",
    "g.created_at as createdAt",
    "p.amount as amount",
    "p.gateway_ref as ref",
    "t.display_name as tenant",
  ])
  .where("p.status", "=", "paid")
  .where("g.status", "in", ["paid", "generating"])
  .orderBy("g.created_at", "asc");
if (onlySite) q = q.where("g.site_id", "=", onlySite);

const rows = await q.execute();
const now = Date.now();
const stalled = rows.filter(
  (r) => (now - (r.createdAt as unknown as Date).getTime()) / 60_000 > MULTILANG_STALL_MINUTES,
);

if (!stalled.length) {
  console.log(
    rows.length
      ? `Nincs elakadt generálás (${rows.length} fut, mind ${MULTILANG_STALL_MINUTES} percen belüli).`
      : "Nincs kifizetett, befejezetlen generálás.",
  );
  await db.destroy();
  process.exit(0);
}

console.log(`Elakadt, KIFIZETETT generálás: ${stalled.length} db\n`);
for (const r of stalled) {
  const mins = Math.round((now - (r.createdAt as unknown as Date).getTime()) / 60_000);
  console.log(
    `  · ${r.id}  ${r.tenant}  ${(r.languages as string[]).join(",")}  ` +
      `${r.amount} Ft  ref=${r.ref ?? "–"}  ${mins} perce ${r.status}`,
  );
}

if (!GO) {
  console.log("\n(szárazon futott — az újraindításhoz: --go)");
  await db.destroy();
  process.exit(0);
}

let ok = 0;
for (const r of stalled) {
  console.log(`\n▸ újraindítás: ${r.id} (${r.tenant})`);
  const res = await runMultilangGeneration(r.id);
  if (res.ok) {
    ok += 1;
    console.log(`  ✅ kész: ${(res.languages ?? []).join(", ")}`);
  } else {
    console.error(`  ⛔ ismét elbukott: ${res.error}`);
  }
}
console.log(`\n${ok}/${stalled.length} generálás fejeződött be.`);
await db.destroy();
process.exit(ok === stalled.length ? 0 : 1);
