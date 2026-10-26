// ADR-XXXX — the automatic outreach go list (outreach_dispatch) and its timer.
//
//   tsx scripts/outreach-dispatch.mts tick [--now=ISO] [--force]   # one lead (the timer runs this)
//   tsx scripts/outreach-dispatch.mts status                        # switch, cap, queue counts
//   tsx scripts/outreach-dispatch.mts add <leadId> <mockId> --by=<name>
//   tsx scripts/outreach-dispatch.mts import <file> --by=<name> [--dry-run]
//        file lines: lead_id|mock_id|Name   (the dispatcher's go-*.txt format)
//   tsx scripts/outreach-dispatch.mts requeue <leadId> --by=<name>
//   tsx scripts/outreach-dispatch.mts cancel <leadId> --by=<name> --reason="…"
//   tsx scripts/outreach-dispatch.mts on|off
//   tsx scripts/outreach-dispatch.mts cap <n>
//   tsx scripts/outreach-dispatch.mts list [--status=held]
//
// `tick` sends nothing while the switch is off, outside weekday 9–16 Budapest, or over the
// daily cap. `--force` ignores ONLY the switch (a supervised first run).

import { readFile } from "node:fs/promises";
import { db } from "../src/db/client.js";
import {
  cancelDispatch,
  dispatchStatus,
  enqueueDispatch,
  requeueDispatch,
  runDispatchTick,
  setAutoDispatchSettings,
} from "../src/outreach/autoDispatch.js";

const args = process.argv.slice(2);
const cmd = args[0];
const pos = args.filter((a) => !a.startsWith("--")).slice(1);
function opt(name: string): string | undefined {
  const p = args.find((a) => a.startsWith(`--${name}=`));
  return p?.slice(name.length + 3);
}
const flag = (name: string) => args.includes(`--${name}`);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function needBy(): string {
  const by = opt("by")?.trim();
  if (!by) throw new Error("--by=<név> kötelező (ki tette a sorba)");
  return by;
}

async function main(): Promise<void> {
  switch (cmd) {
    case "tick": {
      const nowArg = opt("now");
      const now = nowArg ? new Date(nowArg) : new Date();
      if (Number.isNaN(now.getTime())) throw new Error("hibás --now");
      const r = await runDispatchTick(now, { force: flag("force") });
      console.log(`outreach-dispatch @ ${now.toISOString()}: ${JSON.stringify(r)}`);
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
    case "cancel": {
      const leadId = pos[0];
      const reason = opt("reason")?.trim();
      if (!leadId || !UUID.test(leadId) || !reason) throw new Error('cancel <leadId> --by=<név> --reason="…"');
      console.log((await cancelDispatch(leadId, needBy(), reason)) ? "OK visszavonva" : "nincs várakozó/tartott sora");
      return;
    }
    case "on":
    case "off": {
      console.log(JSON.stringify(await setAutoDispatchSettings({ enabled: cmd === "on" })));
      return;
    }
    case "cap": {
      const n = Number(pos[0]);
      if (!Number.isInteger(n) || n < 0) throw new Error("cap <egész szám ≥ 0>");
      console.log(JSON.stringify(await setAutoDispatchSettings({ dailyCap: n })));
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
    default:
      throw new Error("parancs: tick | status | add | import | requeue | cancel | on | off | cap | list");
  }
}

main()
  .catch((e) => {
    console.error((e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
