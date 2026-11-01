// Guard: no UPDATE may run with an EMPTY SET.
//
// Kysely compiles `.set({})` to `update "t" set where …` — a Postgres syntax error. Measured on
// prod 2026-10-26/27: every requeued phone-only dispatch (Panoráma Vendégház Sümeg 0ff9c3d7,
// attempts=2) held with „syntax error at or near "where"”, because createProspect refreshed the
// existing prospect with a patch built only of conditional spreads, and a lead with no e-mail
// and no segment left it empty (fixed in 8658ed58).
//
//   ① A `.set({ … })` literal whose EVERY entry is a conditional spread
//      (`...(cond ? { … } : {})`) can be empty → refused; build the patch first and guard it.
//   ② A `.set(<name>)` with a variable patch must be guarded by `Object.keys(<name>).length`
//      within the few lines before it.
//   ③ Fixtures: the scanner flags the 2026-10-26 shape and passes the guarded fix.
//
// Static, no DB, ~1 s.  Run:  npx tsx scripts/empty-set-check.mts

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const check = (ok: boolean, label: string, detail: readonly string[] = []): void => {
  console.log(`${ok ? "✓" : "✗"}  ${label}${detail.length ? `\n     ${detail.join("\n     ")}` : ""}`);
  if (!ok) failed++;
};

/** Top-level entries of an object-literal body (commas at depth 0), comments stripped. */
function entries(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const c of body) {
    if ("({[".includes(c)) depth++;
    if (")}]".includes(c)) depth--;
    if (c === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += c;
  }
  parts.push(cur);
  return parts.map((p) => p.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").trim()).filter(Boolean);
}

/** The findings in one source text: `line: reason`. */
export function emptySetRisks(src: string): string[] {
  const out: string[] = [];
  const lineOf = (i: number): number => src.slice(0, i).split("\n").length;
  // ① literal made only of conditional spreads
  for (const m of src.matchAll(/\.set\(\s*\{/g)) {
    let i = m.index! + m[0].length;
    let depth = 1;
    while (i < src.length && depth) {
      const c = src[i++];
      if (c === "{") depth++;
      else if (c === "}") depth--;
    }
    const ents = entries(src.slice(m.index! + m[0].length, i - 1));
    if (ents.length && ents.every((e) => /^\.\.\.\s*\(/.test(e) && /:\s*\{\s*\}\s*\)\s*$/.test(e)))
      out.push(`${lineOf(m.index!)}: a SET csak feltételes spreadekből áll — üres is lehet`);
  }
  // ② variable patch without an emptiness guard just before it
  for (const m of src.matchAll(/updateTable\([^)]*\)\s*\.set\(\s*([A-Za-z_$][\w$]*)\s*\)/g)) {
    const name = m[1]!;
    const before = src.slice(0, m.index!).split("\n").slice(-4).join("\n");
    if (!new RegExp(`Object\\.keys\\(\\s*${name}\\s*\\)\\.length`).test(before))
      out.push(`${lineOf(m.index!)}: .set(${name}) — nincs előtte Object.keys(${name}).length őr`);
  }
  return out;
}

// ③ fixtures
const BROKEN = `await db
  .updateTable("prospect")
  .set({
    ...(input.segment ? { segment: input.segment } : {}),
    ...(input.contactEmail ? { contact_email: input.contactEmail } : {}),
  })
  .where("id", "=", existing.id)
  .execute();`;
const FIXED = `const refresh = {
  ...(input.segment ? { segment: input.segment } : {}),
  ...(input.contactEmail ? { contact_email: input.contactEmail } : {}),
};
if (Object.keys(refresh).length) {
  await db.updateTable("prospect").set(refresh).where("id", "=", existing.id).execute();
}`;
const UNGUARDED = `const patch = pick(x);
await db.updateTable("lead").set(patch).where("id", "=", id).execute();`;
const MIXED = `await db.updateTable("outreach_dispatch").set({
  status: result.status,
  ...(result.prospectId ? { prospect_id: result.prospectId } : {}),
}).where("id", "=", id).execute();`;
check(emptySetRisks(BROKEN).length === 1, "fixture: a 2026-10-26-i createProspect-alak (csak feltételes spread) → elutasítva");
check(emptySetRisks(FIXED).length === 0, "fixture: az őrzött javítás (8658ed58) → átmegy");
check(emptySetRisks(UNGUARDED).length === 1, "fixture: őrizetlen változós .set(patch) → elutasítva");
check(emptySetRisks(MIXED).length === 0, "fixture: fix mező + feltételes spread → átmegy (sosem üres)");

// the tree
const files = execFileSync("git", ["ls-files", "src/*.ts", "src/**/*.ts", "scripts/*.mts"], { cwd: ROOT, encoding: "utf8" })
  .trim()
  .split("\n")
  .filter((f) => f && f !== "scripts/empty-set-check.mts");
// Reviewed exceptions: `file` + the `.set(<name>)` they cover, each with WHY it is never empty.
const ALLOW: readonly { file: string; set: string; why: string }[] = [
  {
    file: "src/tenant/units.ts",
    set: ".set(v)",
    why: "settleHouse belső set(id, v) segédje: mindkét hívó fix, 3 mezős literált ad át (2026-11-01 átnézve)",
  },
];
const hits: string[] = [];
for (const f of files)
  for (const h of emptySetRisks(readFileSync(path.join(ROOT, f), "utf8")))
    if (!ALLOW.some((a) => a.file === f && h.includes(a.set))) hits.push(`${f}:${h}`);
check(hits.length === 0, `a kódban nincs üres SET-et megengedő UPDATE (${files.length} fájl)`, hits);

if (failed) {
  console.log(`\n❌ empty-set-check: ${failed} hiba`);
  process.exit(1);
}
console.log("\n✅ empty-set-check: üres SET-es UPDATE nem futhat (Panoráma Sümeg 0ff9c3d7, 8658ed58)");
