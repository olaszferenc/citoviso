// Gate: a BROKEN mobile pair really repairs itself (ADR-0112).
//
// The state under test is the one where a person is worst off: the MMS went out,
// the companion SMS did not, so they hold an advertising image with no link, no
// legal footer and no opt-out. The owner's ruling was "mindenképp az automatikus
// újra küldés kell" — and an automatic repair that quietly does nothing is worse
// than the red badge it replaced, because now nobody is watching either.
//
// Runs on the REAL database with a disposable fixture (the review-flow-check
// pattern), and drives the state machine through INJECTED effects: the give-up
// branch would otherwise text and mail the owner for real, and there is no modem
// in a pre-commit hook. Production always uses the real deps — the injection
// point exists only here, there is no test-mode flag in the call chain.
//
// What it pins:
//   ① a fresh broken pair is not touched before its backoff elapses
//   ② once due, the SMS half is actually attempted
//   ③ a TIMING answer (window closed, modem busy) burns NO attempt — otherwise
//      one night would eat the whole series and alert about an untried pair
//   ④ a real failure spends exactly one attempt and schedules the next
//   ⑤ success stamps sms_sent_at and the pair leaves the broken set
//   ⑥ the exhausted series alerts the operator ONCE, then stops trying
//   ⑦ an opt-out that arrives meanwhile CLOSES the pair without sending
//   ⑧ a WHOLE pair is never touched
//   ⑨ prevention: startPairSend refuses to claim a pair near the window's end
//
// Usage: npx tsx scripts/pair-repair-check.mts

import { db } from "../src/db/client.js";
import {
  MAX_PAIR_SMS_RETRIES,
  repairBrokenPairs,
  type PairRepairDeps,
} from "../src/outreach/pairRepair.js";
import { pairWindowBlocks } from "../src/outreach/sendOutreachSms.js";

let failed = 0;
const say = (ok: boolean, what: string, detail = ""): void => {
  if (ok) {
    console.log(`  ✓ ${what}`);
    return;
  }
  failed++;
  console.error(`  ❌ ${what}${detail ? `\n     ${detail}` : ""}`);
};

const MIN = 60_000;
const ids: { defId?: string; runId?: string; leadId?: string; brokenId?: string; wholeId?: string } = {};

/** Effects that never leave the process: records what the tick tried to do. */
function fakeDeps(smsAnswer: { ok: boolean; message: string }): PairRepairDeps & {
  calls: string[];
  alerts: string[];
} {
  const calls: string[] = [];
  const alerts: string[] = [];
  return {
    calls,
    alerts,
    sendSmsHalf: async (id) => {
      calls.push(id);
      return smsAnswer;
    },
    alert: async (p) => {
      alerts.push(p.id);
      return true;
    },
  };
}

async function state(id: string) {
  const r = await db
    .selectFrom("prospect")
    .select(["sms_retry_count as n", "sms_retry_last_at as last", "sms_retry_alert_at as alert", "sms_sent_at as sms"])
    .where("id", "=", id)
    .executeTakeFirstOrThrow();
  return {
    n: Number(r.n ?? 0),
    last: r.last as unknown as string | null,
    alert: r.alert as unknown as string | null,
    sms: r.sms as unknown as string | null,
  };
}

console.log("Törött mobil-pár automatikus helyreállítása (eldobható fixture, valódi DB):\n");

try {
  const def = await db
    .insertInto("scraper_definition")
    .values({
      label: "_pair_repair_check",
      country: "HU",
      region: "_test",
      industry: "accommodation",
      sources: JSON.stringify(["osm"]),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.defId = def.id;

  const run = await db
    .insertInto("scrape_run")
    .values({ scraper_definition_id: def.id, stats: JSON.stringify({}) })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.runId = run.id;

  const lead = await db
    .insertInto("lead")
    .values({ scrape_run_id: run.id, name: "_pair_repair_check lead", raw: JSON.stringify({}) })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.leadId = lead.id;

  const mmsAt = new Date("2026-09-08T10:00:00.000Z");

  // The broken one: MMS stamped, SMS missing.
  const broken = await db
    .insertInto("prospect")
    .values({
      lead_id: lead.id,
      token: `prc_${Date.now().toString(36)}`,
      sent_at: mmsAt,
      mms_sent_at: mmsAt,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.brokenId = broken.id;

  // The whole one: both halves out — must never be touched.
  const whole = await db
    .insertInto("prospect")
    .values({
      lead_id: lead.id,
      token: `prc_w_${Date.now().toString(36)}`,
      sent_at: mmsAt,
      mms_sent_at: mmsAt,
      sms_sent_at: mmsAt,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.wholeId = whole.id;

  // ── ① Not due yet (the first backoff step is 2 minutes). ─────────────────
  {
    const d = fakeDeps({ ok: true, message: "" });
    await repairBrokenPairs(new Date(mmsAt.getTime() + 1 * MIN), d);
    say(d.calls.length === 0, "① a friss törött párhoz még nem nyúl (backoff)", `hívások: ${d.calls.length}`);
  }

  // ── ② + ③ Due, but the answer is a TIMING one → attempt not spent. ───────
  {
    const d = fakeDeps({
      ok: false,
      message: "hideg mobil-megkeresés csak 8:00–20:00 között megy ki (most 21:00 van)",
    });
    const r = await repairBrokenPairs(new Date(mmsAt.getTime() + 3 * MIN), d);
    const s = await state(broken.id);
    say(d.calls.includes(broken.id), "② a backoff letelte után tényleg megpróbálja az SMS-felét");
    say(s.n === 0, "③ az ablakon kívüli válasz NEM használ el próbálkozást", `számláló: ${s.n}`);
    say(r.retrying === 0, "③ az időzítési válasz nem számít bukott próbálkozásnak");
  }

  // ── ④ A real failure spends exactly one attempt. ─────────────────────────
  {
    const d = fakeDeps({ ok: false, message: "a kísérő SMS elhasalt (modem/relay hiba)" });
    await repairBrokenPairs(new Date(mmsAt.getTime() + 4 * MIN), d);
    const s = await state(broken.id);
    say(s.n === 1, "④ valódi hiba PONTOSAN egy próbálkozást használ el", `számláló: ${s.n}`);
    say(s.last !== null, "④ a következő próbálkozás időzítése rögzül");
  }

  // ── ①b The next attempt waits for the SECOND backoff step (5 perc). ──────
  {
    const d = fakeDeps({ ok: false, message: "a kísérő SMS elhasalt (modem/relay hiba)" });
    await repairBrokenPairs(new Date(mmsAt.getTime() + 6 * MIN), d);
    say(d.calls.length === 0, "①b a második próbálkozás megvárja a hosszabb backoffot");
  }

  // ── ⑥ Exhausted series → alert ONCE, then stop trying. ───────────────────
  {
    await db
      .updateTable("prospect")
      .set({ sms_retry_count: MAX_PAIR_SMS_RETRIES, sms_retry_last_at: mmsAt })
      .where("id", "=", broken.id)
      .execute();
    const d = fakeDeps({ ok: false, message: "nem érdekes, ide nem jutunk el" });
    const r = await repairBrokenPairs(new Date(mmsAt.getTime() + 600 * MIN), d);
    const s = await state(broken.id);
    say(d.alerts.includes(broken.id), "⑥ az elfogyott sorozat RIASZT (SMS + e-mail az operátornak)");
    say(d.calls.length === 0, "⑥ a riasztás után nem próbálkozik tovább ugyanabban a tickben");
    say(s.alert !== null, "⑥ a riasztás ténye rögzül (egyszer riaszt, nem minden percben)");
    say(r.gaveUp === 1, "⑥ a tick jelenti a feladást");

    const d2 = fakeDeps({ ok: false, message: "x" });
    await repairBrokenPairs(new Date(mmsAt.getTime() + 900 * MIN), d2);
    say(
      d2.alerts.length === 0 && d2.calls.length === 0,
      "⑥ a következő tick már NEM riaszt újra és nem is próbálkozik",
    );
  }

  // ── ⑤ Success stamps sms_sent_at → the pair leaves the broken set. ───────
  {
    await db
      .updateTable("prospect")
      .set({ sms_retry_count: 0, sms_retry_last_at: null, sms_retry_alert_at: null })
      .where("id", "=", broken.id)
      .execute();
    // The real sendPairSmsHalf stamps sms_sent_at; the fake stands in for it.
    const d: PairRepairDeps & { calls: string[]; alerts: string[] } = {
      calls: [],
      alerts: [],
      sendSmsHalf: async (id) => {
        await db.updateTable("prospect").set({ sms_sent_at: new Date() }).where("id", "=", id).execute();
        return { ok: true, message: "kiment" };
      },
      alert: async () => true,
    };
    const r = await repairBrokenPairs(new Date(mmsAt.getTime() + 300 * MIN), d);
    const s = await state(broken.id);
    say(r.repaired === 1, "⑤ a sikeres újraküldés helyreállítottként jelenik meg");
    say(s.sms !== null, "⑤ a pár teljes lett (sms_sent_at kitöltve)");

    const after = await repairBrokenPairs(new Date(mmsAt.getTime() + 400 * MIN), fakeDeps({ ok: true, message: "" }));
    say(after.broken === 0, "⑤ a helyreállt pár kikerül a törött halmazból", `törött: ${after.broken}`);
  }

  // ── ⑦ Opt-out in the meantime CLOSES the pair without sending. ───────────
  {
    await db
      .updateTable("prospect")
      .set({ sms_sent_at: null, sms_retry_count: 0, sms_retry_last_at: null, sms_retry_alert_at: null })
      .where("id", "=", broken.id)
      .execute();
    const d = fakeDeps({ ok: false, message: "a címzett leiratkozott — küldés tilos" });
    const r = await repairBrokenPairs(new Date(mmsAt.getTime() + 500 * MIN), d);
    const s = await state(broken.id);
    say(r.closed === 1, "⑦ az időközbeni leiratkozás LEZÁRJA a párt (nincs mit helyreállítani)");
    say(s.alert !== null && r.gaveUp === 0, "⑦ leiratkozás miatt NEM riaszt (nem hiba, hanem megoldás)");
    say(s.n === 0, "⑦ a leiratkozás nem használ el próbálkozást");
  }

  // ── ⑧ A whole pair is never in the working set. ──────────────────────────
  {
    const d = fakeDeps({ ok: true, message: "" });
    await repairBrokenPairs(new Date(mmsAt.getTime() + 999 * MIN), d);
    say(!d.calls.includes(whole.id), "⑧ a TELJES párhoz soha nem nyúl");
  }

  // ── ⑨ Prevention: no new pair right before the window closes. ────────────
  {
    const at1930 = new Date("2026-09-08T19:30:00");
    const at1000 = new Date("2026-09-08T10:00:00");
    const real = "+36301234567"; // not on the allowlist → a real recipient
    say(
      pairWindowBlocks(real, at1930) !== null,
      "⑨ 19:30-kor NEM indítható új pár (különben éjszakára maradna kiút nélkül)",
    );
    say(pairWindowBlocks(real, at1000) === null, "⑨ 10:00-kor viszont indítható");
  }
} finally {
  // Fixture teardown — the dev DB is SHARED between worktrees (memory: it has no
  // backup), so this must run even when an assertion throws.
  if (ids.leadId) {
    await db.deleteFrom("prospect").where("lead_id", "=", ids.leadId).execute();
    await db.deleteFrom("lead").where("id", "=", ids.leadId).execute();
  }
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute();
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute();
}

if (failed) {
  console.error(`\n⛔ pair-repair-check: ${failed} ellenőrzés bukott.`);
  process.exit(1);
}
console.log("\n✅ pair-repair-check: a törött pár magától helyreáll, éjszaka nem küld, és ha feladja, szól.");
process.exit(0);
