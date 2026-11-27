// ADR-0405 — the automatic outreach go list (outreach_dispatch) and its timer.
//
//   tsx scripts/outreach-dispatch.mts tick [--now=ISO] [--force]   # queued leads back-to-back up to the cap (the timer runs this; --now = one lead)
//   tsx scripts/outreach-dispatch.mts status                        # switch, cap, queue counts
//   tsx scripts/outreach-dispatch.mts add <leadId> <mockId> --by=<name>
//   tsx scripts/outreach-dispatch.mts import <file> --by=<name> [--dry-run]
//        file lines: lead_id|mock_id|Name   (the dispatcher's go-*.txt format)
//   tsx scripts/outreach-dispatch.mts requeue <leadId> --by=<name>
//   tsx scripts/outreach-dispatch.mts cancel <leadId> --by=<name> --reason="…"
//   tsx scripts/outreach-dispatch.mts on|off
//   tsx scripts/outreach-dispatch.mts cap <n> [--country=CZ]          # the country row's daily_quota (HU by default; 0155)
//   tsx scripts/outreach-dispatch.mts auto-approve dry|on|off          # 0155: the tick's automatic approval (autoApprove.ts)
//   tsx scripts/outreach-dispatch.mts ramp <startCap> [--growth=30] [--max=3000] [--start=YYYY-MM-DD]
//        the cold lane's ramp (coldRamp.ts): the day's total climbs from startCap by growth% per
//        working day up to max; each firing sends its even share; the brake judges yesterday
//   tsx scripts/outreach-dispatch.mts ramp release | ramp off        # lift the brake's hold / no ramp (static caps)
//   tsx scripts/outreach-dispatch.mts resend-spam --by=<name> [--dry-run] [--limit=n] [--since=ISO] [--until=ISO]
//        ADR-0459: the Gmail letters lost in the main domain's spam window go back on the list (requeueResend)
//   tsx scripts/outreach-dispatch.mts list [--status=held]
//   tsx scripts/outreach-dispatch.mts attach-second --sent [--dry-run]
//        owner 2026-10-26: the links the timer already SENT with one plan get the second
//        (Vera-PASSed) plan added, once, without any message to the lead
//
// `tick` sends nothing while the switch is off, outside weekday 9–16 Budapest, or over the
// daily cap. `--force` ignores ONLY the switch (a supervised first run).

import { readFile } from "node:fs/promises";
import { db } from "../src/db/client.js";
import { refreshStaleQueue, regateStaleQueue, replanUnfitQueue, syncNoEmailHolds } from "../src/generator/mockRefresh.js";
import {
  cancelDispatch,
  DISPATCH_HOME_COUNTRY,
  dispatchStatus,
  getAutoDispatchSettings,
  attachSecondPlan,
  enqueueDispatch,
  requeueDispatch,
  requeueResend,
  runDispatchTick,
  sentToday,
  setAutoDispatchSettings,
} from "../src/outreach/autoDispatch.js";
import { sql } from "kysely";
import { parseColdRamp, tickAllowance } from "../src/outreach/coldRamp.js";
import { budapestIsoDay } from "../src/text/budapestTime.js";

const args = process.argv.slice(2);
const cmd = args[0];
const pos = args.filter((a) => !a.startsWith("--")).slice(1);
function opt(name: string): string | undefined {
  const p = args.find((a) => a.startsWith(`--${name}=`));
  return p?.slice(name.length + 3);
}
const flag = (name: string) => args.includes(`--${name}`);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DRAIN_BUDGET_MS = 8 * 60_000;
/** The refresh step's share of a firing, and the unit's whole budget (TimeoutStartSec=600, with air). */
const REFRESH_BUDGET_MS = 75_000;
/** Re-judging the waiting plans (mockRefresh.regateStaleQueue): ~30 s a plan. At least this much a firing, and since
 *  2026-11-27 (HR approval chain: 4 105 of 4 137 waiting plans had no current verdict, ~5 judged a firing) whatever
 *  the unit has left, minus room for the one render still running when the budget ends. */
const REGATE_BUDGET_MS = 150_000;
const REGATE_TAIL_MS = 60_000;
const UNIT_BUDGET_MS = 9 * 60_000;

function needBy(): string {
  const by = opt("by")?.trim();
  if (!by) throw new Error("--by=<név> kötelező (ki tette a sorba)");
  return by;
}

async function main(): Promise<void> {
  switch (cmd) {
    case "tick": {
      const tickStarted = Date.now();
      try {
      const nowArg = opt("now");
      const now = nowArg ? new Date(nowArg) : new Date();
      if (Number.isNaN(now.getTime())) throw new Error("hibás --now");
      // Owner 2026-10-27: an approved lead goes out as soon as it is queued, not one per timer
      // tick — the modem queue paces the SMS/MMS half by itself. The tick drains back-to-back
      // until cap/empty/window/off, but stops within DRAIN_BUDGET_MS so the oneshot unit stays
      // under its TimeoutStartSec=600; the next timer firing carries on.
      // With a cold RAMP (coldRamp.ts, owner 2026-11-18) a firing sends only its even share of
      // the day's remainder, a few seconds apart — the volume spreads over the whole window.
      const started = Date.now();
      const settings = await getAutoDispatchSettings();
      const allowance = settings.ramp ? tickAllowance(now, settings.ramp, await sentToday()) : Number.POSITIVE_INFINITY;
      let done = 0;
      for (;;) {
        const at = nowArg ? now : new Date();
        if (done >= allowance) {
          console.log(`outreach-dispatch @ ${at.toISOString()}: {"kind":"paced","sent":${done},"allowance":${allowance}}`);
          return;
        }
        const r = await runDispatchTick(at, { force: flag("force") });
        console.log(`outreach-dispatch @ ${at.toISOString()}: ${JSON.stringify(r)}`);
        if (r.kind !== "done" || nowArg || Date.now() - started > DRAIN_BUDGET_MS) return;
        if (r.status === "sent") done++;
        if (settings.ramp) await new Promise((res) => setTimeout(res, 3000 + Math.floor(Math.random() * 6000)));
      }
      } finally {
        // THE PIPELINE REFRESHES ITS OWN MOCKS (owner 2026-11-25): a waiting mock below the current
        // generator's bar is re-rendered here, a batch per firing, inside the unit's 600 s — then the
        // quality colleague looks at it again. Sends nothing.
        // A plan that cannot carry the lead's photos goes back to the chain's main plan (HR approval chain 11-27) —
        // SQL only, before the refresh, so the refresh and the gate do not spend time on it.
        // ⑭ a lead without an e-mail address leaves the chain (and comes back once it has one) — SQL only, first
        if (!opt("now")) {
          const ne = await syncNoEmailHolds();
          if (ne.held || ne.released) console.log(`e-mail nélküli sorok: ${JSON.stringify(ne)}`);
        }
        if (!opt("now")) {
          const p = await replanUnfitQueue();
          if (p.replanned || p.setAside) console.log(`újratervezés: ${JSON.stringify(p)}`);
        }
        const budget = Math.min(REFRESH_BUDGET_MS, UNIT_BUDGET_MS - (Date.now() - tickStarted));
        if (!opt("now") && budget > 0) {
          const r = await refreshStaleQueue(budget);
          if (r.refreshed || r.failed) console.log(`mock-frissítés: ${JSON.stringify(r)}`);
        }
        // …and re-judges the waiting plans whose render-gate verdict is from an older rule version (11-26).
        const left = UNIT_BUDGET_MS - (Date.now() - tickStarted);
        const gateBudget = Math.min(left, Math.max(REGATE_BUDGET_MS, left - REGATE_TAIL_MS));
        if (!opt("now") && gateBudget > 0) {
          const g = await regateStaleQueue(gateBudget, Number.POSITIVE_INFINITY);
          if (g.judged || g.held || g.released) console.log(`kapu-újramérés: ${JSON.stringify(g)}`);
        }
      }
      return;
    }
    case "ramp": {
      // ramp <startCap> [--growth=30] [--max=3000] [--start=YYYY-MM-DD] | ramp off | ramp release
      const sub = pos[0];
      if (sub === "off") {
        console.log(JSON.stringify(await setAutoDispatchSettings({ ramp: null })));
        return;
      }
      if (sub === "release") {
        const cur = await getAutoDispatchSettings();
        if (!cur.ramp) throw new Error("nincs felfutás beállítva");
        console.log(JSON.stringify(await setAutoDispatchSettings({ ramp: { ...cur.ramp, holdCap: null } })));
        return;
      }
      const startCap = Number(sub);
      const growthPct = Number(opt("growth") ?? "30");
      const maxCap = Number(opt("max") ?? "3000");
      const startDay = opt("start") ?? budapestIsoDay(new Date());
      if (!Number.isInteger(startCap) || startCap < 1) throw new Error("ramp <induló napi darab ≥ 1> [--growth=%] [--max=n] [--start=YYYY-MM-DD] | off | release");
      const ramp = parseColdRamp({ startDay, startCap, growthPct, maxCap });
      if (!ramp) throw new Error("hibás felfutás: growth ≥ 0, max ≥ induló, start = ÉÉÉÉ-HH-NN");
      console.log(JSON.stringify(await setAutoDispatchSettings({ ramp })));
      return;
    }
    case "status": {
      console.log(JSON.stringify(await dispatchStatus(), null, 2));
      return;
    }
    case "add": {
      const [leadId, mockId] = pos;
      if (!leadId || !mockId || !UUID.test(leadId) || !UUID.test(mockId)) throw new Error("add <leadId> <mockId> (teljes UUID)");
      const r = await enqueueDispatch({ leadId, artifactId: mockId, by: needBy() });
      console.log(r.ok ? `OK sorba: ${leadId}` : `NEM: ${leadId} — ${r.reason}`);
      if (!r.ok) process.exitCode = 2;
      return;
    }
    case "import": {
      const file = pos[0];
      if (!file) throw new Error("import <fájl>");
      const by = needBy();
      const dry = flag("dry-run");
      let ok = 0;
      let refused = 0;
      for (const line of (await readFile(file, "utf8")).split("\n")) {
        const [leadId, mockId, name] = line.split("|").map((s) => s.trim());
        if (!leadId) continue;
        if (!UUID.test(leadId) || !mockId || !UUID.test(mockId)) {
          console.log(`SOR HIBÁS: ${line}`);
          refused++;
          continue;
        }
        if (dry) {
          console.log(`DRY ${leadId} ${mockId} ${name ?? ""}`);
          ok++;
          continue;
        }
        const r = await enqueueDispatch({ leadId, artifactId: mockId, by });
        console.log(r.ok ? `OK   ${name ?? leadId}` : `NEM  ${name ?? leadId} — ${r.reason}`);
        if (r.ok) ok++;
        else refused++;
      }
      console.log(`\nSorba: ${ok} · elutasítva: ${refused}${dry ? " (DRY-RUN — semmi nem változott)" : ""}`);
      return;
    }
    case "requeue": {
      const leadId = pos[0];
      if (!leadId || !UUID.test(leadId)) throw new Error("requeue <leadId>");
      console.log((await requeueDispatch(leadId, needBy())) ? "OK újra sorban" : "nincs tartott/visszavont sora");
      return;
    }
    case "resend-spam": {
      // ADR-0459 follow-up: the Gmail recipients whose letter fell into the main domain's spam window
      // (2026-11-16 11:05 → 11-18 12:30) go back on the go list for the cold lane. Only lost letters:
      // no human view, no reply, no unsubscribe, not a customer; requeueResend re-checks each one.
      const by = needBy();
      const dry = flag("dry-run");
      const limit = Number(opt("limit") ?? "1000");
      const since = opt("since") ?? "2026-11-16T11:05:00+01:00";
      const until = opt("until") ?? "2026-11-18T12:30:00+01:00";
      const rows = await db
        .selectFrom("prospect as p")
        .innerJoin("outreach_dispatch as d", "d.lead_id", "p.lead_id")
        .innerJoin("lead as l", "l.id", "p.lead_id")
        .select(["p.id as prospectId", "p.lead_id as leadId", "p.contact_email as email", "p.email_sent_at as sentAt", "l.name as name"])
        .where("d.status", "=", "sent")
        .where("p.email_sent_at", ">=", new Date(since))
        .where("p.email_sent_at", "<=", new Date(until))
        .where("p.archived_at", "is", null)
        .where(sql<boolean>`lower(split_part(p.contact_email, '@', 2)) in ('gmail.com', 'googlemail.com')`)
        .orderBy("p.email_sent_at")
        .limit(limit)
        .execute();
      let ok = 0;
      let refused = 0;
      for (const r of rows) {
        if (dry) {
          console.log(`DRY ${r.email} · ${r.name} · ${new Date(r.sentAt as Date).toISOString().slice(0, 16)}`);
          ok++;
          continue;
        }
        const res = await requeueResend(r.leadId, by, "Gmail-spam ablak 11-16 11:05 → 11-18 12:30, citoviso.com");
        if (res.ok) ok++;
        else refused++;
        console.log(res.ok ? `OK újra sorban: ${r.email} · ${r.name}` : `NEM: ${r.email} · ${r.name} — ${res.reason}`);
      }
      console.log(`${dry ? "DRY " : ""}összesen: ${ok} sorba, ${refused} elutasítva (${rows.length} jelölt)`);
      return;
    }
    case "cancel": {
      const leadId = pos[0];
      const reason = opt("reason")?.trim();
      if (!leadId || !UUID.test(leadId) || !reason) throw new Error('cancel <leadId> --by=<név> --reason="…"');
      console.log((await cancelDispatch(leadId, needBy(), reason)) ? "OK visszavonva" : "nincs várakozó/tartott sora");
      return;
    }
    case "auto-approve": {
      // 0155: the dispatch tick's automatic approval (autoApprove.ts). `dry` lists what it would approve now;
      // `on` / `off` flip outreach_auto.autoApprove. ⛔ `on` only after the Debian crontab's old auto-approve
      // line is commented out (the cutover step) — the two together approve twice.
      const sub = pos[0];
      if (sub === "on" || sub === "off") {
        console.log(JSON.stringify(await setAutoDispatchSettings({ autoApprove: sub === "on" })));
        return;
      }
      if (sub !== "dry") throw new Error("auto-approve dry|on|off");
      const { runAutoApprove } = await import("../src/outreach/autoApprove.js");
      const r = await runAutoApprove({ go: false });
      console.log(`pending=${r.pending} pick=${r.picks.length} ${JSON.stringify(r.by)} owner=${r.ownerLeft} dry`);
      for (const p of r.picks) console.log(`  ${p.item.leadId}  ${p.key}  ${p.item.country}  ${p.item.name}`);
      return;
    }
    case "on":
    case "off": {
      console.log(JSON.stringify(await setAutoDispatchSettings({ enabled: cmd === "on" })));
      return;
    }
    case "cap": {
      // „Országok / Árazás” 4. fázis (0155): the cap is the country row's daily_quota (the Kiküldés tab writes the same).
      const n = Number(pos[0]);
      if (!Number.isInteger(n) || n < 0) throw new Error("cap <egész szám ≥ 0> [--country=XX]");
      const cc = (opt("country")?.trim().toUpperCase() || DISPATCH_HOME_COUNTRY);
      if (!/^[A-Z]{2}$/.test(cc)) throw new Error("--country=<ISO-2>");
      const r = await db.updateTable("country").set({ daily_quota: n }).where("iso2", "=", cc).executeTakeFirst();
      if (!Number(r.numUpdatedRows)) throw new Error(`nincs ${cc} ország-sor`);
      console.log(`OK ${cc} napi keret = ${n}`);
      return;
    }
    case "list": {
      const status = opt("status");
      let q = db
        .selectFrom("outreach_dispatch as d")
        .innerJoin("lead as l", "l.id", "d.lead_id")
        .select(["d.lead_id", "d.status", "d.queued_by", "d.queued_at", "d.sent_at", "d.note", "l.name"])
        .orderBy("d.queued_at");
      if (status) q = q.where("d.status", "=", status as never);
      for (const r of await q.execute()) {
        console.log(`${r.status.padEnd(9)} ${r.lead_id} ${r.name} · ${r.queued_by}${r.note ? ` · ${r.note}` : ""}`);
      }
      return;
    }
    case "attach-second": {
      if (!flag("sent")) throw new Error("attach-second --sent [--dry-run]");
      const rows = await db
        .selectFrom("outreach_dispatch as d")
        .innerJoin("lead as l", "l.id", "d.lead_id")
        .select(["d.prospect_id", "l.name"])
        .where("d.status", "=", "sent")
        .where("d.prospect_id", "is not", null)
        .execute();
      let ok = 0;
      for (const r of rows) {
        if (flag("dry-run")) {
          console.log(`DRY ${r.name}`);
          continue;
        }
        const a = await attachSecondPlan(r.prospect_id!, { extendOffered: true });
        console.log(a.ok ? `OK   ${r.name}${a.attached ? "" : " (már volt)"}` : `NEM  ${r.name} — ${a.note}`);
        if (a.ok) ok++;
      }
      console.log(`\nmásodik terv: ${ok}/${rows.length}`);
      return;
    }
    default:
      throw new Error("parancs: tick | status | add | import | requeue | cancel | on | off | cap | ramp | list | attach-second");
  }
}

main()
  .catch((e) => {
    console.error((e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
