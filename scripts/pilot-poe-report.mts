// Poe pilot report (ADR-XXXX, D5) — the two generation modes side by side, from measured data.
//
//   ág „AI-szöveg”  : inputs.copyOrigin absent  (briefAndCopy writes, critic may rewrite)
//   ág „Poe-szöveg” : inputs.copyOrigin = "curator" (Poe writes, the guards judge once)
//
// Per branch: mock count, cost (USD, from inputs.aiUsage — recopy spend shown apart, it is not
// the generation's), tokens, calls, machine wall-clock (inputs.genMs, recorded since the pilot),
// and the four verdicts (fact / market / guest critic / design). Then a per-lead pairing, since
// the pilot generates the SAME leads on both branches.
//
// READ ONLY: every query runs inside a `SET TRANSACTION READ ONLY` transaction, so it is safe to
// run against production (owner rule: prod read = free, prod write = never without a ruling).
//
// Usage:
//   npx tsx scripts/pilot-poe-report.mts                      # last 7 days
//   npx tsx scripts/pilot-poe-report.mts --since 2026-10-05   # from a date
//   npx tsx scripts/pilot-poe-report.mts --leads <id>,<id>    # only the pilot leads
//   npx tsx scripts/pilot-poe-report.mts --json               # machine-readable
import { sql } from "kysely";
import { db } from "../src/db/client.js";

type Branch = "ai" | "poe";
const BRANCH_LABEL: Record<Branch, string> = { ai: "AI-szöveg (Neo)", poe: "Poe-szöveg" };
const VERDICTS = ["factVerdict", "marketVerdict", "guestCriticVerdict", "designVerdict"] as const;
const VERDICT_LABEL: Record<(typeof VERDICTS)[number], string> = {
  factVerdict: "tényhűség",
  marketVerdict: "piaci",
  guestCriticVerdict: "vendég-kritikus",
  designVerdict: "dizájn",
};

interface Row {
  id: string;
  leadId: string;
  leadName: string;
  generatedAt: Date;
  branch: Branch;
  template: string;
  metered: boolean;
  genUsd: number;
  recopyUsd: number;
  inputTokens: number;
  outputTokens: number;
  calls: number;
  genMs: number | null;
  verdicts: Record<(typeof VERDICTS)[number], string | null>;
  byStep: Record<string, { calls: number; costUsd: number }>;
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const usd = (n: number): string => `$${n.toFixed(4)}`;
const avg = (xs: readonly number[]): number => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

function toRow(r: { id: string; lead_id: string; name: string; generated_at: Date; inputs: unknown }): Row {
  const inputs = (r.inputs ?? {}) as Record<string, unknown>;
  const u = (typeof inputs.aiUsage === "object" && inputs.aiUsage !== null ? inputs.aiUsage : null) as Record<
    string,
    unknown
  > | null;
  const steps = (u && typeof u.byStep === "object" && u.byStep !== null ? u.byStep : {}) as Record<
    string,
    Record<string, unknown>
  >;
  const byStep: Row["byStep"] = {};
  let recopyUsd = 0;
  for (const [k, s] of Object.entries(steps)) {
    byStep[k] = { calls: num(s.calls), costUsd: num(s.costUsd) };
    if (k.startsWith("recopy:")) recopyUsd += num(s.costUsd);
  }
  const verdict = (k: string): string | null => (typeof inputs[k] === "string" ? (inputs[k] as string) : null);
  return {
    id: r.id,
    leadId: r.lead_id,
    leadName: r.name,
    generatedAt: r.generated_at,
    branch: inputs.copyOrigin === "curator" ? "poe" : "ai",
    template: typeof inputs.template === "string" ? inputs.template : "–",
    metered: u !== null && typeof u.costUsd === "number",
    genUsd: num(u?.costUsd) - recopyUsd,
    recopyUsd,
    inputTokens: num(u?.inputTokens) + num(u?.cacheReadTokens) + num(u?.cacheWriteTokens),
    outputTokens: num(u?.outputTokens),
    calls: num(u?.calls),
    genMs: typeof inputs.genMs === "number" ? inputs.genMs : null,
    verdicts: {
      factVerdict: verdict("factVerdict"),
      marketVerdict: verdict("marketVerdict"),
      guestCriticVerdict: verdict("guestCriticVerdict"),
      designVerdict: verdict("designVerdict"),
    },
    byStep,
  };
}

function parseArgs(argv: readonly string[]): { since: Date; leads: string[] | null; json: boolean } {
  const at = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const sinceArg = at("--since");
  const since = sinceArg ? new Date(sinceArg) : new Date(Date.now() - 7 * 86_400_000);
  if (Number.isNaN(since.getTime())) throw new Error(`Hibás --since dátum: ${sinceArg}`);
  const leadsArg = at("--leads");
  const leads = leadsArg ? leadsArg.split(",").map((s) => s.trim()).filter(Boolean) : null;
  return { since, leads, json: argv.includes("--json") };
}

async function load(since: Date, leads: string[] | null): Promise<Row[]> {
  return db.transaction().execute(async (trx) => {
    await sql`set transaction read only`.execute(trx);
    let q = trx
      .selectFrom("mock_artifact")
      .innerJoin("lead", "lead.id", "mock_artifact.lead_id")
      .select(["mock_artifact.id", "mock_artifact.lead_id", "lead.name", "mock_artifact.generated_at", "mock_artifact.inputs"])
      .where("mock_artifact.generated_at", ">=", since)
      .orderBy("mock_artifact.generated_at", "asc");
    if (leads) q = q.where("mock_artifact.lead_id", "in", leads);
    const rows = await q.execute();
    return rows.map((r) => toRow(r as unknown as Parameters<typeof toRow>[0]));
  });
}

interface BranchSummary {
  branch: Branch;
  mocks: number;
  metered: number;
  avgGenUsd: number;
  sumGenUsd: number;
  sumRecopyUsd: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  avgCalls: number;
  timed: number;
  avgGenSec: number | null;
  verdicts: Record<string, { pass: number; flag: number; other: number }>;
  steps: Record<string, { calls: number; costUsd: number }>;
}

function summarize(branch: Branch, rows: readonly Row[]): BranchSummary {
  const m = rows.filter((r) => r.metered);
  const t = rows.filter((r) => r.genMs !== null);
  const verdicts: BranchSummary["verdicts"] = {};
  for (const v of VERDICTS) {
    const e = { pass: 0, flag: 0, other: 0 };
    for (const r of rows) {
      const x = r.verdicts[v];
      if (x === "pass") e.pass += 1;
      else if (x === "flag") e.flag += 1;
      else e.other += 1;
    }
    verdicts[v] = e;
  }
  const steps: BranchSummary["steps"] = {};
  for (const r of m) {
    for (const [k, s] of Object.entries(r.byStep)) {
      const e = (steps[k] ??= { calls: 0, costUsd: 0 });
      e.calls += s.calls;
      e.costUsd += s.costUsd;
    }
  }
  return {
    branch,
    mocks: rows.length,
    metered: m.length,
    avgGenUsd: avg(m.map((r) => r.genUsd)),
    sumGenUsd: m.reduce((s, r) => s + r.genUsd, 0),
    sumRecopyUsd: m.reduce((s, r) => s + r.recopyUsd, 0),
    avgInputTokens: avg(m.map((r) => r.inputTokens)),
    avgOutputTokens: avg(m.map((r) => r.outputTokens)),
    avgCalls: avg(m.map((r) => r.calls)),
    timed: t.length,
    avgGenSec: t.length ? avg(t.map((r) => (r.genMs ?? 0) / 1000)) : null,
    verdicts,
    steps,
  };
}

function printReport(rows: readonly Row[], since: Date): void {
  const sums = (["ai", "poe"] as const).map((b) => summarize(b, rows.filter((r) => r.branch === b)));
  const hu = (n: number): string => Math.round(n).toLocaleString("hu-HU");

  console.log(`\nPOE-PILOT — ${rows.length} mock ${since.toISOString().slice(0, 10)} óta (csak olvasás)\n`);
  console.log(`ág                  mock  mért   átlag $/mock   be-tok/mock   ki-tok/mock  hívás  gép-idő`);
  console.log("─".repeat(92));
  for (const s of sums) {
    const time = s.avgGenSec === null ? "–" : `${s.avgGenSec.toFixed(0)} mp (${s.timed})`;
    console.log(
      `${BRANCH_LABEL[s.branch].padEnd(18)}${String(s.mocks).padStart(5)}${String(s.metered).padStart(6)}   ` +
        `${usd(s.avgGenUsd).padStart(12)}   ${hu(s.avgInputTokens).padStart(11)}   ${hu(s.avgOutputTokens).padStart(11)}` +
        `${s.avgCalls.toFixed(1).padStart(7)}  ${time}`,
    );
  }
  for (const s of sums) {
    if (s.sumRecopyUsd > 0) {
      console.log(`  ${BRANCH_LABEL[s.branch]}: utólagos szöveg-újraírás (recopy) külön: ${usd(s.sumRecopyUsd)} — a fenti átlagban NINCS benne`);
    }
  }

  console.log(`\nÍTÉLETEK (pass / flag / egyéb-hiányzó)\n`);
  console.log(`ág                 ${VERDICTS.map((v) => VERDICT_LABEL[v].padStart(17)).join("")}`);
  console.log("─".repeat(92));
  for (const s of sums) {
    const cells = VERDICTS.map((v) => {
      const e = s.verdicts[v]!;
      return `${e.pass}/${e.flag}/${e.other}`.padStart(17);
    });
    console.log(`${BRANCH_LABEL[s.branch].padEnd(19)}${cells.join("")}`);
  }

  for (const s of sums) {
    const entries = Object.entries(s.steps).sort((a, b) => b[1].costUsd - a[1].costUsd);
    if (!entries.length) continue;
    console.log(`\nLÉPÉSENKÉNT — ${BRANCH_LABEL[s.branch]} (összesen ${usd(s.sumGenUsd + s.sumRecopyUsd)})`);
    for (const [k, e] of entries) {
      console.log(`  ${k.padEnd(30)}${String(e.calls).padStart(5)} hívás   ${usd(e.costUsd).padStart(10)}`);
    }
  }

  // Pairing: the pilot runs the same lead on both branches — the honest comparison is per lead.
  const byLead = new Map<string, Row[]>();
  for (const r of rows) byLead.set(r.leadId, [...(byLead.get(r.leadId) ?? []), r]);
  const paired = [...byLead.values()].filter((rs) => rs.some((r) => r.branch === "ai") && rs.some((r) => r.branch === "poe"));
  console.log(`\nPÁROSÍTVA (mindkét ágon generált lead: ${paired.length})\n`);
  if (paired.length) {
    console.log(`lead                              AI $/mock   Poe $/mock   AI mp   Poe mp   AI ítélet   Poe ítélet`);
    console.log("─".repeat(100));
    const flags = (rs: readonly Row[]): string => {
      const f = rs.reduce((s, r) => s + VERDICTS.filter((v) => r.verdicts[v] === "flag").length, 0);
      return `${f} flag/${rs.length}`;
    };
    for (const rs of paired) {
      const a = rs.filter((r) => r.branch === "ai");
      const p = rs.filter((r) => r.branch === "poe");
      const secs = (xs: readonly Row[]): string => {
        const t = xs.filter((r) => r.genMs !== null);
        return t.length ? avg(t.map((r) => (r.genMs ?? 0) / 1000)).toFixed(0) : "–";
      };
      console.log(
        `${rs[0]!.leadName.slice(0, 32).padEnd(32)}${usd(avg(a.filter((r) => r.metered).map((r) => r.genUsd))).padStart(11)}` +
          `${usd(avg(p.filter((r) => r.metered).map((r) => r.genUsd))).padStart(13)}${secs(a).padStart(8)}${secs(p).padStart(9)}` +
          `${flags(a).padStart(12)}${flags(p).padStart(13)}`,
      );
    }
  }
  console.log(
    `\n⚠️  A gép-idő csak a generálás gépi része (inputs.genMs). Poe írási idejét ez NEM tartalmazza —` +
      `\n   azt a jegyek időbélyegéből (~/poe/beerkezo/ → ~/neo/beerkezo/) kell hozzáadni.\n`,
  );
}

async function main(): Promise<void> {
  const { since, leads, json } = parseArgs(process.argv.slice(2));
  const rows = await load(since, leads);
  if (json) {
    const sums = (["ai", "poe"] as const).map((b) => summarize(b, rows.filter((r) => r.branch === b)));
    console.log(JSON.stringify({ since: since.toISOString(), branches: sums, mocks: rows }, null, 2));
    return;
  }
  printReport(rows, since);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
