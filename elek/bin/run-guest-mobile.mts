// FK-010 orchestrator — Elek as a GUEST on a PHONE, on EVERY generated style.
//
// One scenario, many pages: the widget is the same on all 19 templates, the wrapper
// around it is not — and that is exactly where it breaks. So the same FK-010 runs on
// each mock file of the given leads (default: every lead that has a mock for every
// template), each run in its own folder (ELEK_RUN_TAG), and a MATRIX.md sums them up:
// style × lead → pass/fail/manual/blocked + the run folder, failures named.
//
//   npx tsx elek/bin/run-guest-mobile.mts                       every complete lead
//   npx tsx elek/bin/run-guest-mobile.mts --lead=<uuid>[,…]     given leads
//   npx tsx elek/bin/run-guest-mobile.mts mock-a.html mock-b…    given files
//   flags: --style=<id>[,…]  restrict styles · --jobs=N  parallel runners (default 3)
//
// Charter: reads only (the mock files + the dev DB catalogue of them); no mock is
// generated here, nothing is sent anywhere — the mock's forms are demo (ADR-0061).
process.env.CIT_SHOT = "1";

import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const args = process.argv.slice(2);
const flag = (n: string): string => (args.find((a) => a.startsWith(`--${n}=`)) ?? "").split("=").slice(1).join("=");
const files = args.filter((a) => !a.startsWith("--"));
const leadFilter = flag("lead").split(",").filter(Boolean);
const styleFilter = flag("style").split(",").filter(Boolean);
const jobs = Math.max(1, Number(flag("jobs") || 3));

interface Target { lead: string; leadSlug: string; style: string; file: string }

async function catalogue(): Promise<Target[]> {
  if (files.length) {
    return files.map((f) => {
      const base = path.basename(f).replace(/\.html?$/i, "");
      const m = /^mock-(.+)-([a-z-]+)-[0-9a-f]{8}$/.exec(base);
      // The visible name lives on the booking slot (data-cit-name) — the file name is a slug.
      const name = /data-cit-name="([^"]+)"/.exec(readFileSync(path.resolve(f), "utf8"))?.[1]?.replace(/&amp;/g, "&");
      return { lead: name ?? m?.[1] ?? base, leadSlug: m?.[1] ?? base, style: m?.[2] ?? "?", file: path.resolve(f) };
    });
  }
  const { db } = await import("../../src/db/client.js");
  const { TEMPLATES } = await import("../../src/engine/templates.js");
  const styleCount = Object.keys(TEMPLATES).length;
  const rows = await db
    .selectFrom("mock_artifact")
    .innerJoin("lead", "lead.id", "mock_artifact.lead_id")
    .select(["lead.id as leadId", "lead.name as leadName", "mock_artifact.path as path", "mock_artifact.inputs as inputs"])
    .where("mock_artifact.path", "is not", null)
    .execute();
  const byLead = new Map<string, { name: string; items: Target[] }>();
  for (const r of rows) {
    const inputs = (r.inputs ?? {}) as { template?: string };
    const style = inputs.template ?? "";
    if (!style || !r.path) continue;
    const e = byLead.get(r.leadId) ?? { name: r.leadName, items: [] };
    e.items.push({ lead: r.leadName, leadSlug: r.leadName, style, file: path.resolve(ROOT, r.path) });
    byLead.set(r.leadId, e);
  }
  const out: Target[] = [];
  for (const [id, e] of byLead) {
    if (leadFilter.length ? !leadFilter.includes(id) : new Set(e.items.map((i) => i.style)).size < styleCount) continue;
    // one mock per style (the newest path wins if a style was generated twice)
    const seen = new Set<string>();
    for (const it of e.items.sort((a, b) => a.style.localeCompare(b.style))) {
      if (seen.has(it.style)) continue;
      seen.add(it.style);
      out.push(it);
    }
  }
  await db.destroy();
  return out;
}

// ── dates for the scenario (the mock's SAMPLE availability, ADR-0059 ④) ─────────────
// The demo calendar blocks today+6..8, +16..17, +26..27 for the first unit. The taps go
// to the NEXT month (the scenario pages there first); pick the first 2-night free window
// from its 5th day on. A wrong pick is not silent: the scenario asserts "2 éjszaka".
function iso(d: Date): string { return d.toISOString().slice(0, 10); }
function dayUTC(y: number, m: number, d: number): Date { return new Date(Date.UTC(y, m, d)); }
const now = new Date();
const today = dayUTC(now.getFullYear(), now.getMonth(), now.getDate());
const shift = (d: Date, n: number): Date => new Date(d.getTime() + n * 864e5);
const blocked = new Set<string>();
for (const [off, len] of [[6, 3], [16, 2], [26, 2]] as const) for (let i = 0; i < len; i++) blocked.add(iso(shift(today, off + i)));
const nextFirst = dayUTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1);
let dayA = shift(nextFirst, 4);
while (blocked.has(iso(dayA)) || blocked.has(iso(shift(dayA, 1))) || blocked.has(iso(shift(dayA, 2)))) dayA = shift(dayA, 1);
const dayB = shift(dayA, 2);
const nextMonthLabel = nextFirst.toLocaleDateString("hu", { year: "numeric", month: "long", timeZone: "UTC" });
const past = shift(today, -3);

interface Outcome extends Target { pass: number; fail: number; manual: number; blocked: number; dir: string; fails: string[]; note?: string }

function runOne(t: Target): Promise<Outcome> {
  const tag = `${t.leadSlug.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 14)}-${t.style}`;
  const env = {
    ...process.env,
    ELEK_RUN_TAG: tag,
    ELEK_MOCK_FILE: t.file,
    ELEK_MOCK_NAME: t.lead,
    ELEK_DAY_A: iso(dayA),
    ELEK_DAY_B: iso(dayB),
    ELEK_PAST: iso(past),
    ELEK_NEXT_MONTH: nextMonthLabel,
  };
  return new Promise((resolve) => {
    const child = spawn("npx", ["tsx", "elek/bin/runner.mts", "FK-010"], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    const timer = setTimeout(() => child.kill("SIGKILL"), 900_000);
    child.on("close", () => {
      clearTimeout(timer);
      const dir = /futás-mappa: (\S+)/.exec(out)?.[1] ?? "";
      const m = /lépések: \d+ · pass=(\d+) fail=(\d+) manual=(\d+) blocked=(\d+)/.exec(out);
      const o: Outcome = { ...t, pass: +(m?.[1] ?? 0), fail: +(m?.[2] ?? 0), manual: +(m?.[3] ?? 0), blocked: +(m?.[4] ?? 0), dir, fails: [] };
      if (!m) o.note = "a runner nem adott összesítést: " + out.trim().split("\n").slice(-3).join(" | ");
      if (dir) {
        try {
          const lines = readFileSync(path.join(ROOT, dir, "result.jsonl"), "utf8").trim().split("\n");
          for (const l of lines) {
            const r = JSON.parse(l) as { step: number; status: string; text: string; error?: string; checks: { expr: string; ok: boolean; detail?: string }[] };
            if (r.status === "fail") o.fails.push(`${r.step}. ${r.text.slice(0, 60)} — ${r.error ?? r.checks.filter((c) => !c.ok).map((c) => c.expr + (c.detail ? ` (${c.detail})` : "")).join("; ")}`);
          }
        } catch { /* no result file — the note above already says so */ }
      }
      const mark = o.fail > 0 || o.blocked > 0 ? "\x1b[31m✗\x1b[0m" : "\x1b[32m✓\x1b[0m";
      console.log(`  ${mark} ${t.lead} · ${t.style.padEnd(14)} pass=${o.pass} fail=${o.fail} manual=${o.manual} blocked=${o.blocked}  ${dir}`);
      for (const f of o.fails) console.log(`      ✗ ${f}`);
      resolve(o);
    });
  });
}

async function main(): Promise<void> {
  const targets = (await catalogue()).filter((t) => !styleFilter.length || styleFilter.includes(t.style));
  if (!targets.length) { console.error("nincs cél: nincs olyan lead, amelynek minden stílusra van mockja (vagy a szűrő üres)"); process.exit(1); }
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const MATRIX_DIR = path.join(ROOT, "elek", "runs", `FK-010-matrix-${ts}`);
  mkdirSync(MATRIX_DIR, { recursive: true });
  console.log(`FK-010 mátrix: ${targets.length} lap (${new Set(targets.map((t) => t.lead)).size} lead × ${new Set(targets.map((t) => t.style)).size} stílus), ${jobs} párhuzamos runner`);
  console.log(`  dátumok: érkezés ${iso(dayA)} → távozás ${iso(dayB)} · múlt ${iso(past)} · következő hónap „${nextMonthLabel}”`);
  const outcomes: Outcome[] = [];
  let i = 0;
  await Promise.all(Array.from({ length: jobs }, async () => {
    while (i < targets.length) { const t = targets[i++]!; outcomes.push(await runOne(t)); }
  }));
  outcomes.sort((a, b) => a.lead.localeCompare(b.lead) || a.style.localeCompare(b.style));
  const leads = [...new Set(outcomes.map((o) => o.lead))];
  const styles = [...new Set(outcomes.map((o) => o.style))].sort();
  const cell = (o?: Outcome): string => !o ? "—" : o.note ? "⚠️ nincs összesítés" : `${o.fail || o.blocked ? "✗" : "✓"} ${o.pass}/${o.fail}/${o.manual}/${o.blocked} [${path.basename(o.dir)}](../${path.basename(o.dir)}/)`;
  const md = [
    `# FK-010 mátrix — ${ts}`,
    "",
    `Cellák: pass/fail/manual/blocked · futás-mappa. Dátumok: ${iso(dayA)} → ${iso(dayB)}, múlt ${iso(past)}.`,
    "",
    `| stílus | ${leads.join(" | ")} |`,
    `|---|${leads.map(() => "---").join("|")}|`,
    ...styles.map((s) => `| ${s} | ${leads.map((l) => cell(outcomes.find((o) => o.lead === l && o.style === s))).join(" | ")} |`),
    "",
    "## Bukott lépések",
    "",
    ...outcomes.flatMap((o) => o.fails.map((f) => `- **${o.style} · ${o.lead}**: ${f}`)),
    ...outcomes.filter((o) => o.note).map((o) => `- ⚠️ **${o.style} · ${o.lead}**: ${o.note}`),
    "",
  ].join("\n");
  writeFileSync(path.join(MATRIX_DIR, "MATRIX.md"), md);
  writeFileSync(path.join(MATRIX_DIR, "outcomes.json"), JSON.stringify(outcomes, null, 1));
  const tot = outcomes.reduce((a, o) => ({ pass: a.pass + o.pass, fail: a.fail + o.fail, manual: a.manual + o.manual, blocked: a.blocked + o.blocked }), { pass: 0, fail: 0, manual: 0, blocked: 0 });
  console.log(`\nösszesen: pass=${tot.pass} fail=${tot.fail} manual=${tot.manual} blocked=${tot.blocked} · mátrix: ${path.relative(ROOT, MATRIX_DIR)}/MATRIX.md`);
  process.exit(tot.fail + tot.blocked > 0 ? 2 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
