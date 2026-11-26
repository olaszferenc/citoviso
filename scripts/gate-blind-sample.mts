// VAK MÉRÉS — the render gate judged on a random, UNSEEN sample (doctrine §2c.3, owner 2026-11-25/26).
//
//   npx tsx scripts/gate-blind-sample.mts [--n 20] [--seed <text>] [--country HU,HR] [--since-days 30]
//
// Picks `n` waiting plans (main plan of a queued / chain-waiting dispatch row; current generator; photo gate ok)
// that NO colleague has reviewed and NO owner has approved, mixed across countries and across the ≥N-own-photo /
// town-photo branches, runs the machine render gate on each (the gate caches its verdict as it always does), and
// prints pass / fail with the finding codes — and the same for the lead's second plan. The sample is drawn with
// a seeded order so a re-run with the same seed measures the same mocks. A rule change is proven only when a
// FRESH seed on FRESH mocks improves the ratio; the mocks a person already looked at are excluded on purpose.
import { createHash } from "node:crypto";
import { sql } from "kysely";
import { db } from "../src/db/client.js";
import { DEPTH_TEMPLATES } from "../src/generator/depthArm.js";
import { CHAIN_WAIT_NOTES, QA_REVIEW_KEY } from "../src/outreach/mockQaReview.js";
import { DISPATCH_PHOTOS_OK_SQL, LEAD_MIN_OWN_PHOTOS_SQL, LEAD_OWN_PHOTOS_SQL, MOCK_CURRENT_GENERATOR_SQL } from "../src/outreach/mockPhotoGate.js";
import { renderGateFor, renderGateReason, type RenderGateResult } from "../src/outreach/mockRenderGate.js";
import { secondPlanOf } from "../src/outreach/secondPlan.js";

const argv = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const n = Math.max(1, Math.min(200, Number(opt("n") ?? 20) || 20));
const seed = opt("seed") ?? new Date().toISOString().slice(0, 10);
const countries = (opt("country") ?? "").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
const sinceDays = Math.max(1, Number(opt("since-days") ?? 30) || 30);

type Row = { artifactId: string; leadId: string; name: string; country: string | null; branch: "own" | "town" };

async function candidates(): Promise<Row[]> {
  const r = await sql<{ artifact_id: string; lead_id: string; name: string; country: string | null; own: boolean }>`
    select d.artifact_id, d.lead_id, l.name, d.country,
           (${LEAD_OWN_PHOTOS_SQL} >= ${LEAD_MIN_OWN_PHOTOS_SQL}) as own
      from outreach_dispatch d
      join mock_artifact a on a.id = d.artifact_id
      join lead l on l.id = d.lead_id
     where (d.status = 'queued' or (d.status = 'held' and d.note in (${sql.join(CHAIN_WAIT_NOTES)})))
       and a.status = 'approved'
       and a.inputs->'recipe'->>'template' in (${sql.join([...DEPTH_TEMPLATES])})
       and ${MOCK_CURRENT_GENERATOR_SQL}
       and ${DISPATCH_PHOTOS_OK_SQL}
       and a.inputs->${QA_REVIEW_KEY} is null
       and a.inputs->'ownerApproval' is null
       and a.generated_at >= now() - make_interval(days => ${sinceDays})`.execute(db);
  return r.rows
    .filter((x) => !countries.length || countries.includes((x.country ?? "").toUpperCase()))
    .map((x) => ({ artifactId: x.artifact_id, leadId: x.lead_id, name: x.name, country: x.country, branch: x.own ? "own" : "town" }));
}

/** Seeded shuffle: sort by sha1(seed + id) — the same seed draws the same sample from the same pool. */
function seededOrder(rows: Row[]): Row[] {
  const key = (id: string): string => createHash("sha1").update(`${seed}:${id}`).digest("hex");
  return [...rows].sort((a, b) => key(a.artifactId).localeCompare(key(b.artifactId)));
}

/** Mixed sample: alternate the branches and the countries as far as the pool allows. */
function mixed(rows: Row[], want: number): Row[] {
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const k = `${r.country ?? "??"}/${r.branch}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const out: Row[] = [];
  const keys = [...groups.keys()].sort();
  while (out.length < want && keys.some((k) => groups.get(k)!.length)) {
    for (const k of keys) {
      const next = groups.get(k)!.shift();
      if (next) out.push(next);
      if (out.length >= want) break;
    }
  }
  return out;
}

async function main(): Promise<void> {
  const pool = await candidates();
  const picked = mixed(seededOrder(pool), n);
  console.log(`vak minta · seed „${seed}” · ${picked.length} fő terv a ${pool.length} látatlan, aktuális, fotó-kapus jelöltből${countries.length ? ` · ország: ${countries.join(",")}` : ""}`);
  const codes = new Map<string, number>();
  const tally = { pass: 0, fail: 0, altPass: 0, altFail: 0, altMissing: 0, both: 0 };
  const byGroup = new Map<string, { pass: number; fail: number }>();
  const line = (label: string, g: RenderGateResult): void => {
    for (const f of g.findings) codes.set(f.code, (codes.get(f.code) ?? 0) + 1);
    console.log(`  ${g.verdict === "pass" ? "✓" : "✗"} ${label}${g.verdict === "fail" ? ` — ${renderGateReason(g)}` : ""}`);
  };
  for (const r of picked) {
    const g = await renderGateFor(r.artifactId);
    const k = `${r.country ?? "??"}/${r.branch}`;
    const bg = byGroup.get(k) ?? { pass: 0, fail: 0 };
    bg[g.verdict]++;
    byGroup.set(k, bg);
    tally[g.verdict]++;
    line(`${r.artifactId.slice(0, 8)} ${r.name} [${k}] 1. terv`, g);
    const alt = await secondPlanOf(r.leadId, r.artifactId);
    if (!alt?.current) {
      tally.altMissing++;
      console.log(`    · 2. terv: ${alt ? "még nem aktuális (frissítésre vár)" : "nincs"}`);
      continue;
    }
    const ga = await renderGateFor(alt.id);
    if (ga.verdict === "pass") tally.altPass++;
    else tally.altFail++;
    if (g.verdict === "pass" && ga.verdict === "pass") tally.both++;
    line(`${alt.id.slice(0, 8)} 2. terv`, ga);
  }
  const pct = (a: number, b: number): string => (b ? `${Math.round((100 * a) / b)} %` : "—");
  console.log(`\nFŐ TERV: jó ${tally.pass} · rossz ${tally.fail} (${pct(tally.pass, picked.length)} jó)`);
  console.log(`2. TERV: jó ${tally.altPass} · rossz ${tally.altFail} · nincs/nem aktuális ${tally.altMissing}`);
  console.log(`TELJES AJÁNLAT (mindkét terv jó): ${tally.both} (${pct(tally.both, picked.length)})`);
  if (codes.size) console.log(`Hibakódok: ${[...codes.entries()].sort((a, b) => b[1] - a[1]).map(([c, k]) => `${c} ${k}`).join(" · ")}`);
  for (const [k, g] of [...byGroup.entries()].sort()) console.log(`  ${k}: jó ${g.pass} · rossz ${g.fail}`);
}

try {
  await main();
} finally {
  await db.destroy();
}
