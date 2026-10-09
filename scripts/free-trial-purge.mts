// ADR-XXXX — the 90-day retention purge of lapsed free trials, by hand (src/trial/retention.ts).
// DRY by default: lists what would be deleted, what waits (warning not sent / too recent) and
// what is REFUSED (a paid trace — a human decides). --go deletes; it still deletes nothing
// whose purge warning was not SENT at least 7 days earlier.
//
//   npx tsx scripts/free-trial-purge.mts [--go] [--trial <free_trial id>] [--now=2026-10-12T03:00:00+02:00]
import { db } from "../src/db/client.js";
import { purgeExpiredTrials } from "../src/trial/retention.js";

const go = process.argv.includes("--go");
const ti = process.argv.indexOf("--trial");
const trialId = ti >= 0 ? process.argv[ti + 1] : undefined;
if (ti >= 0 && !trialId) {
  console.error("--trial <id> hiányzik"); // i18n-exempt: operátori CLI
  process.exit(1);
}
const nowArg = process.argv.find((a) => a.startsWith("--now="));
const now = nowArg ? new Date(nowArg.slice("--now=".length)) : new Date();
if (Number.isNaN(now.getTime())) {
  console.error("érvénytelen --now"); // i18n-exempt: operátori CLI
  process.exit(1);
}

try {
  const r = await purgeExpiredTrials(now, { dryRun: !go, ...(trialId ? { onlyTrialIds: [trialId] } : {}) });
  console.log(`\n${go ? "ÉLES" : "SZÁRAZ"} · @ ${now.toISOString()} · törölve ${r.purged} · vár ${r.waiting} · megtagadva ${r.refused} · jelölt ${r.candidates.length}`); // i18n-exempt: operátori CLI
  for (const c of r.candidates) {
    console.log(`  ${c.trialId} · ${c.slug ?? "-"} · törlés napja ${c.purgeDay} · ${c.blockedBy ?? (go ? "törölve" : "törölhető")} · ${c.files} fájl`); // i18n-exempt: operátori CLI
  }
  if (!go && r.candidates.some((c) => c.blockedBy === null)) console.log("\n→ --go törli a „törölhető” sorokat."); // i18n-exempt: operátori CLI
  if (r.refused > 0) process.exitCode = 1;
} finally {
  await db.destroy();
}
