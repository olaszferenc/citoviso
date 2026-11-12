// ADR-XXXX — the BEHAVIOUR MESSAGE tick (citoviso-behavior-message.timer, every 10 minutes).
// Variant A (owner 2026-11-11): one automatic message per lead, 20 minutes after the lead's last
// activity once they came back / opened the prices / pressed the trial button; weekdays 8–20
// Budapest. The send path, the gates and the one-shot claim live in src/outreach/behaviorMessage.ts.
//
// ⛔ The console master switch (CRM → Viselkedés-üzenetek, app_setting 'behavior_message') is OFF by
// default: with it off the tick prints „ki” and sends nothing. Turning it on is the owner's step.
//
//   npx tsx scripts/behavior-message.mts                 one tick (what the timer runs)
//   npx tsx scripts/behavior-message.mts --dry           every due candidate through its gates,
//                                                        nothing claimed or sent (window ignored)
//   npx tsx scripts/behavior-message.mts --list          the candidates since the switch, with verdicts
//   … --now=2026-11-12T10:00:00+01:00                    judge at another instant

import { db } from "../src/db/client.js";
import {
  BEHAVIOR_EXCLUSION_LABEL,
  getBehaviorSettings,
  listBehaviorCandidates,
  runBehaviorMessages,
} from "../src/outreach/behaviorMessage.js";

const args = process.argv.slice(2);
const nowArg = args.find((a) => a.startsWith("--now="));
const now = nowArg ? new Date(nowArg.slice("--now=".length)) : new Date();
if (Number.isNaN(now.getTime())) {
  console.error("érvénytelen --now dátum");
  process.exit(1);
}

try {
  if (args.includes("--list")) {
    const s = await getBehaviorSettings();
    console.log(`főkapcsoló: ${s.enabled ? "BE" : "KI"} · kiváltó-határ: ${s.since?.toISOString() ?? "—"}`);
    for (const c of await listBehaviorCandidates({ now })) {
      const v = c.excluded ? BEHAVIOR_EXCLUSION_LABEL[c.excluded] : c.dueAt && +c.dueAt <= +now ? "ESEDÉKES" : "vár (20 perc csend)";
      console.log(`${c.leadName} · ${c.trigger ?? "—"} · ${c.channel ?? "—"} · ${v}`);
    }
  } else {
    const r = await runBehaviorMessages({ now, dryRun: args.includes("--dry") });
    console.log(`behavior-message @ ${now.toISOString()}:`, JSON.stringify(r));
  }
} catch (e) {
  // Non-zero exit → the unit's OnFailure= mails the house (ADR-0276).
  console.error("behavior-message HIBA:", e);
  process.exitCode = 1;
} finally {
  await db.destroy();
}
