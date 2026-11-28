// Konverziós fa — aktív feladatok (ADR-0510; table conversion_task, migration 0163).
// The coordinator writes, the console reads (Riport → Tölcsér → Konverziós mechanizmusfa → Feladatok);
// no deploy needed for a change. A task = someone works on ONE lever of ONE cause; its effect is read
// on the parent state's rate, before → after (the console shows „after” only once a cohort is measured).
//
//   npx tsx scripts/conversion-task.mts list [--all]
//   npx tsx scripts/conversion-task.mts add --node 6-7 --lever pricequestion --owner "Lánc-SUB" \
//        [--since 2026-11-29] [--before 7.0] [--note "…"]
//   npx tsx scripts/conversion-task.mts close <id | id-prefix>
//
// --node / --lever must exist in src/console/conversionTree.ts (`list --levers` prints them).
// Without --before the parent rate is computed from the report fold: e-mail sends 37…7 days before the
// start (old enough to have played out), the same rule the console uses for „after”.

import { sql } from "kysely";
import { db } from "../src/db/client.js";
import { APP_TZ, isoDayIn, midnightIn } from "../src/text/zoneTime.js";
import { allLevers, BLIND_TRANSITIONS, leverOf, TASK_AFTER_MIN_PARENT, TASK_AFTER_WAIT_DAYS } from "../src/console/conversionTree.js";
import { inTreeCohort, loadProspectFacts, treeCounts, treeTransitionCounts } from "../src/console/reportData.js";

const DAY = 86_400_000;
const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (name: string): string | null => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1]! : null;
};
const fail = (msg: string): never => {
  console.error(`⛔ ${msg}`);
  process.exit(1);
};

async function beforeRate(node: string, start: Date): Promise<{ rate: number | null; note: string }> {
  if (BLIND_TRANSITIONS.includes(node)) return { rate: null, note: "vakfolt átmenet — nincs arány" };
  const facts = await loadProspectFacts("first");
  const a = start.getTime() - (30 + TASK_AFTER_WAIT_DAYS) * DAY;
  const b = start.getTime() - TASK_AFTER_WAIT_DAYS * DAY;
  const cohort = facts.filter((p) => inTreeCohort(p) && p.sentAt.getTime() >= a && p.sentAt.getTime() < b);
  const tc = treeTransitionCounts(treeCounts(cohort), node);
  if (!tc || !tc.from) return { rate: null, note: "nincs mért kohorsz az indulás előtt" };
  const rate = Math.round((tc.to / tc.from) * 1000) / 10;
  const thin = tc.from < TASK_AFTER_MIN_PARENT ? ` — ⚠️ kevés: ${tc.from} < ${TASK_AFTER_MIN_PARENT}` : "";
  return { rate, note: `${tc.to} / ${tc.from} (${node}, küldés ${new Date(a).toISOString().slice(0, 10)}…${new Date(b).toISOString().slice(0, 10)})${thin}` };
}

async function main(): Promise<void> {
  if (cmd === "list") {
    if (argv.includes("--levers")) {
      for (const x of allLevers()) console.log(`${x.node.padEnd(5)} ${x.lever.id.padEnd(24)} ${x.lever.name}  ← ${x.cause.title}`);
      return;
    }
    let q = db.selectFrom("conversion_task").selectAll().orderBy("started_at", "asc");
    if (!argv.includes("--all")) q = q.where("status", "=", "open");
    const rows = await q.execute();
    if (!rows.length) console.log("(nincs feladat)");
    for (const r of rows) {
      const lv = leverOf(r.node, r.lever_id);
      console.log(
        `${r.id.slice(0, 8)}  ${r.status.padEnd(6)} ${r.node.padEnd(5)} ${(lv?.lever.name ?? `?${r.lever_id}`).padEnd(36)} ${r.owner.padEnd(16)} ` +
          `${isoDayIn(new Date(r.started_at), APP_TZ)}  előtte: ${r.before_rate === null ? (BLIND_TRANSITIONS.includes(r.node) ? "vakfolt" : "nincs mért szám") : `${r.before_rate}%`}${r.note ? `  · ${r.note}` : ""}`,
      );
    }
    return;
  }
  if (cmd === "add") {
    const node = opt("node") ?? fail("--node kell (pl. 6-7)");
    const lever = opt("lever") ?? fail("--lever kell (list --levers)");
    const owner = (opt("owner") ?? fail("--owner kell")).trim();
    const lv = leverOf(node, lever);
    if (!lv) fail(`ismeretlen kar: ${node} / ${lever} — a src/console/conversionTree.ts-ben nincs (list --levers)`);
    const sinceRaw = opt("since");
    const start = sinceRaw && /^\d{4}-\d{2}-\d{2}$/.test(sinceRaw) ? midnightIn(sinceRaw, APP_TZ) : sinceRaw ? new Date(NaN) : new Date();
    if (Number.isNaN(start.getTime())) fail(`rossz dátum: ${sinceRaw}`);
    const beforeRaw = opt("before");
    let before: number | null;
    let basis: string;
    if (beforeRaw !== null) {
      before = Number(beforeRaw.replace(",", "."));
      if (!Number.isFinite(before) || before < 0 || before > 100) fail(`--before 0–100 közti százalék: ${beforeRaw}`);
      basis = "kézzel megadva";
    } else {
      const b = await beforeRate(node, start);
      before = b.rate;
      basis = b.note;
    }
    const open = await db.selectFrom("conversion_task").select("id").where("status", "=", "open").where("node", "=", node).where("lever_id", "=", lever).executeTakeFirst();
    if (open) fail(`ezen a karon már fut feladat (${open.id.slice(0, 8)}) — előbb zárd le`);
    const row = await db
      .insertInto("conversion_task")
      .values({ node, lever_id: lever, owner, started_at: start, before_rate: before, note: opt("note"), created_by: process.env.USER ?? null })
      .returning("id")
      .executeTakeFirstOrThrow();
    console.log(`✅ felvéve ${row.id.slice(0, 8)}: ${node} · ${lv!.lever.name} · ${owner} · előtte: ${before === null ? "nincs szám" : `${before}%`} (${basis})`);
    return;
  }
  if (cmd === "close") {
    const ref = argv[1] ?? fail("close <id | id-prefix>");
    if (!/^[0-9a-f-]{4,36}$/i.test(ref)) fail(`rossz azonosító: ${ref}`);
    const rows = await db.selectFrom("conversion_task").select(["id", "node", "lever_id"]).where("status", "=", "open").where(sql<string>`id::text`, "like", `${ref.toLowerCase()}%`).execute();
    if (rows.length !== 1) fail(rows.length ? `több nyitott feladat illeszkedik (${rows.length}) — adj hosszabb előtagot` : `nincs nyitott feladat ezzel az előtaggal: ${ref}`);
    await db.updateTable("conversion_task").set({ status: "closed", closed_at: new Date() }).where("id", "=", rows[0]!.id).execute();
    console.log(`✅ lezárva ${rows[0]!.id.slice(0, 8)}: ${rows[0]!.node} · ${rows[0]!.lever_id}`);
    return;
  }
  fail("használat: list [--all|--levers] · add --node a-b --lever <id> --owner <név> [--since YYYY-MM-DD] [--before %] [--note …] · close <id>");
}

main()
  .then(() => db.destroy())
  .catch(async (e) => {
    console.error(e);
    await db.destroy();
    process.exit(1);
  });
