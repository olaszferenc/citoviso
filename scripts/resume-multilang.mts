// ADR-0118 — figyelő-tick: a KIFIZETETT, elakadt nyelv-generálás magától induljon újra.
//
//   npx tsx scripts/resume-multilang.mts              # a timer ezt futtatja
//   npx tsx scripts/resume-multilang.mts --dry        # csak listáz, nem indít semmit
//   npx tsx scripts/resume-multilang.mts --force <id> # OPERÁTORI újraindítás
//
// Miért kell: a generálás a fizetési webhook után DETACHED fut (a gateway nem várhat
// 3 nyelv fordítására), ezért egy szerver-újraindítás elvágja, és a sor örökre
// 'generating'-en marad — a vevő kifizetett egy fordítást, ami soha nem készül el.
// Mérve a dev-parkon 2026-09-11: két ilyen sor, az egyik 12 órás.
//
// Miért veszélytelen gyakran futni: a birtokbavétel egy FELTÉTELES UPDATE (életjel +
// státusz a WHERE-ben), tehát két egyszerre futó tick közül pontosan az egyik viszi el
// a sort, és egy ÉLŐ (életjelet adó) futás mellé soha nem indul második.
//
// A `--force` az operátoré: NEM fogyaszt automata próbálkozást, és a sorozat-korlát
// után is elindul — ez az az út, amit a feladás-riasztás levele megnevez.

process.env.DATABASE_URL = "";

import { db } from "../src/db/client.js";
import { runMultilangGeneration } from "../src/tenant/multilangGenerate.js";
import {
  MAX_MULTILANG_ATTEMPTS,
  MULTILANG_STALL_MINUTES,
  claimGeneration,
  resumeStalledGenerations,
  stalledGenerations,
} from "../src/tenant/multilangResume.js";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const forceId = args.includes("--force") ? args[args.indexOf("--force") + 1] : null;

if (forceId) {
  // Az operátor tudja, mit csinál: az életjel-ablakot is átlépheti (a 0 perc azt
  // jelenti, „most azonnal"), és a sorozat-korlát sem állítja meg.
  const claimed = await claimGeneration(forceId, { staleMinutes: 0, consumeAttempt: false });
  if (!claimed) {
    console.error(
      `⛔ nem vehető birtokba: ${forceId} — vagy nincs ilyen sor, vagy már 'done', ` +
        `vagy épp ÉPPEN FUT (életjelet ad). Futó generálás mellé nem indítunk másodikat.`,
    );
    await db.destroy();
    process.exit(1);
  }
  console.log(`▸ operátori újraindítás: ${forceId}`);
  const r = await runMultilangGeneration(forceId);
  console.log(r.ok ? `✅ kész: ${(r.languages ?? []).join(", ")}` : `⛔ ismét elbukott: ${r.error}`);
  await db.destroy();
  process.exit(r.ok ? 0 : 1);
}

if (DRY) {
  const rows = await stalledGenerations();
  if (!rows.length) console.log("[multilang-resume] nincs elakadt generálás.");
  for (const r of rows) {
    console.log(
      `  · ${r.id}  ${r.tenantName}  ${r.languages.join(",")}  ${r.amount ?? "?"} Ft  ` +
        `${r.status}  ${r.attempts}/${MAX_MULTILANG_ATTEMPTS} próbálkozás  ` +
        `${r.idleMinutes} perce néma (küszöb: ${MULTILANG_STALL_MINUTES})`,
    );
  }
  await db.destroy();
  process.exit(0);
}

const res = await resumeStalledGenerations();
if (res.checked === 0) {
  console.log("[multilang-resume] nincs elakadt generálás.");
} else {
  console.log(
    `[multilang-resume] ${res.checked} elakadt · ${res.resumed} újraindítva · ` +
      `${res.finished} befejezve · ${res.gaveUp} feladva`,
  );
  for (const n of res.notes) console.log(`  ${n}`);
}
await db.destroy();
