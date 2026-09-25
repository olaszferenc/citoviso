// FIXTURE-PARENT GUARD — egy kapu se kölcsönözzön és se hagyjon hátra scrape_run-t.
//
// MIT VÉD (mérve 2026-09-25, az ADR-0229 audit leletéből). A `lead.scrape_run_id` NOT NULL, ezért
// minden lead-et vető kapunak kell egy scrape_run. Két rossz szokás nőtt köré:
//   · KÖLCSÖNZÉS — öt kapu „az első scrape_run"-t vette szülőnek. Egy testvér-session kapuja
//     birtokolhatja azt a sort és törölheti mérés közben; a `scrape_run → lead` CASCADE, tehát a
//     kölcsönző lead-je, tenant-ja, rendelése eltűnik alóla → piros, ami nem a termékről szól.
//   · SZEMETELÉS — hat kapu saját definíciót+futást hozott létre, és csak a lead-et törölte:
//     1 046 árva futás a parkban (modpaychk 413 · mltierchk 228 · bookingscreen 204 · roomeditor 114
//     · wholecheck 49 · mlresume 23) — és pont az árvákat kapják el a kölcsönzők „elsőként".
//
// A SZABÁLY: a szülőt a `scripts/lib/fixture-parent.mts` adja (bélyegzett címke, exit-hook törlés,
// a lánc CASCADE). Amit ez az őr mér:
//   ① KÖLCSÖNZÉS: `selectFrom("scrape_run")` lánc, ami EGY sort vesz ki (`executeTakeFirst` /
//      `.limit(1)`) `.where(` nélkül — tiltott (kivétel indokkal).
//   ② SZEMETELÉS: aki `insertInto("scrape_run")`/`("scraper_definition")`-t ír, az ugyanazt a táblát
//      `deleteFrom`-mal takarítja is, VAGY a helper-t használja, VAGY scratch-DB-ben dolgozik (az egész
//      DB-t dobja). (Egy insert törlés nélkül = szemét, még ha a lead-et törli is.)
//   ③ ALANY: a helper-t legalább 11 kapu használja (különben a szabály üres zöld).
//   ④ VISELKEDÉS (DB): a helper exit-hookja `process.exit(1)` UTÁN is törli a szülőt — egy gyerek-
//      folyamat létrehozza és 1-gyel kilép; a sor nem maradhat.
//   ⑤ PARK-CENZUS (DB): halott pid-ű helper-címkék és a hat régi (javítás előtti) címke árváinak
//      söprése, majd: nincs 1 óránál régebbi, lead nélküli scrape_run ISMERETLEN címkével — az új
//      szemetelő kapu (ez a lelet 1 046-nál kezdődött).
//
//   npx tsx scripts/fixture-parent-check.mts [--self-test]
// Piros önteszt: ① és ② visszarontott fixtúra-szövegen, ④ egy helper NÉLKÜLI gyerekkel (a sor
// megmarad → az ellenőrzésnek látnia kell).

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SELF_TEST = process.argv.includes("--self-test");
let pass = 0;
const fails: string[] = [];
function check(ok: boolean, name: string, detail = ""): void {
  if (ok) pass++;
  else fails.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

/** Indokolt kivételek — a fájl létezik, és az indokolt minta tényleg benne van. */
const ALLOW: Record<string, { rule: "①" | "②"; reason: string; mustContain: string }> = {
  "scripts/gate-lane-check.mts": {
    rule: "①",
    reason: "az önteszt SZÖVEGES fixtúrája idézi a kölcsönző alakot (nem futtatja)",
    mustContain: "selectFrom szűrő nélkül (első sor)",
  },
};

/** A comment may narrate this bug; only code counts. */
function codeOf(src: string): string {
  return src
    .split("\n")
    .map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? "" : l))
    .join("\n");
}

/** Kysely chains starting at `selectFrom("scrape_run")` up to the terminal call. */
function scrapeRunSelectChains(code: string): string[] {
  const out: string[] = [];
  const re = /selectFrom\(\s*["']scrape_run["']\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    const rest = code.slice(m.index, m.index + 600);
    const end = rest.search(/execute(TakeFirst(OrThrow)?)?\(\)/);
    out.push(end >= 0 ? rest.slice(0, end + 24) : rest.slice(0, 200));
  }
  return out;
}

export function auditSource(rel: string, src: string): string[] {
  const code = codeOf(src);
  const bad: string[] = [];
  const allow = ALLOW[rel];
  for (const chain of scrapeRunSelectChains(code)) {
    const oneRow = /executeTakeFirst|\.limit\(\s*1\s*\)/.test(chain);
    const filtered = /\.where\(/.test(chain);
    if (oneRow && !filtered && !(allow && allow.rule === "①")) {
      bad.push(`① ${rel}: kölcsönzött scrape_run („az első sor", where nélkül) — használd a createFixtureParent()-et`);
    }
  }
  for (const t of ["scrape_run", "scraper_definition"] as const) {
    const inserts = (code.match(new RegExp(`insertInto\\(\\s*["']${t}["']\\s*\\)`, "g")) ?? []).length;
    if (!inserts) continue;
    const deletes = (code.match(new RegExp(`deleteFrom\\(\\s*["']${t}["']\\s*\\)`, "g")) ?? []).length;
    const helper = /createFixtureParent\(/.test(code);
    // A scratch-DB-s kapu (ADR-0223 ③) az EGÉSZ adatbázisát dobja el kilépéskor — ott nincs mit takarítani.
    const scratchDb = /scratchDbName\(|registerScratchDrop\(/.test(code);
    if (!deletes && !helper && !scratchDb && !(allow && allow.rule === "②")) {
      bad.push(`② ${rel}: insertInto("${t}") törlés nélkül — árva sort hagy a közös parkban; deleteFrom ugyanarra, vagy createFixtureParent()`);
    }
  }
  return bad;
}

function pgArgs(): string[] {
  const e = process.env;
  return ["-h", e.PGHOST || "/tmp", "-p", e.PGPORT || "5433", "-U", e.PGUSER || "postgres", "-d", e.PGDATABASE || "citoviso_dev"];
}
function sql(q: string): string {
  const r = spawnSync("psql", [...pgArgs(), "-v", "ON_ERROR_STOP=1", "-qAtc", q], { encoding: "utf8", timeout: 30_000 });
  if (r.status !== 0) throw new Error(`psql: ${r.stderr.trim()}`);
  return r.stdout.trim();
}
function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

// ── ①② forrás-szabályok minden kapun ─────────────────────────────────────────────────
const dir = path.join(ROOT, "scripts");
const gates = readdirSync(dir).filter((f) => /-check\.mts$/.test(f) && f !== "fixture-parent-check.mts");
const findings: string[] = [];
let helperUsers = 0;
for (const f of gates) {
  const src = readFileSync(path.join(dir, f), "utf8");
  if (/createFixtureParent\(/.test(codeOf(src))) helperUsers++;
  findings.push(...auditSource(`scripts/${f}`, src));
}
check(findings.length === 0, "①② egyetlen kapu sem kölcsönöz és nem hagy hátra scrape_run-t", findings.join(" · "));
check(helperUsers >= 11, "③ a fixture-parent helpert legalább 11 kapu használja (a szabálynak van alanya)", `talált: ${helperUsers}`);
for (const [rel, a] of Object.entries(ALLOW)) {
  let src = "";
  try {
    src = readFileSync(path.join(ROOT, rel), "utf8");
  } catch {
    src = "";
  }
  check(src.includes(a.mustContain), `a kivétel-lista élő: ${rel} létezik és tartalmazza az indokolt mintát (${a.rule})`, a.reason);
}

// ── ④ viselkedés: a helper exit-hookja process.exit(1) után is töröl ───────────────────
const HELPER = path.join(ROOT, "scripts/lib/fixture-parent.mts");
const DB_CLIENT = path.join(ROOT, "src/db/client.ts");
function childRun(body: string): { status: number | null; out: string } {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "cit-fixture-parent-"));
  const file = path.join(tmp, "child.mts");
  writeFileSync(file, body, "utf8");
  const r = spawnSync(path.join(ROOT, "node_modules/.bin/tsx"), [file], { encoding: "utf8", timeout: 120_000, cwd: ROOT });
  rmSync(tmp, { recursive: true, force: true });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}
const withHook = childRun(`
const { db } = await import(${JSON.stringify(DB_CLIENT)});
const { createFixtureParent } = await import(${JSON.stringify(HELPER)});
const p = await createFixtureParent(db, "fpcheck");
console.log("LABEL=" + p.label);
process.exit(1);
`);
const label = /LABEL=(\S+)/.exec(withHook.out)?.[1] ?? "";
const leftover = label ? Number(sql(`SELECT count(*) FROM scraper_definition WHERE label = '${label}'`)) : -1;
check(withHook.status === 1 && label !== "" && leftover === 0, "④ a helper exit-hookja process.exit(1) UTÁN is törli a szülőt", `rc=${withHook.status}, címke=${label || "-"}, maradt=${leftover}`);

// ── ⑤ park-cenzus: halott pid-ű helper-címkék söprése, aztán nincs régi árva ───────────
const staleLabels = sql(`SELECT label FROM scraper_definition WHERE label ~ '^_[a-z0-9]+_[a-z0-9]+_[0-9]+$'`)
  .split("\n")
  .filter(Boolean)
  .filter((l) => {
    const pid = Number(l.slice(l.lastIndexOf("_") + 1));
    return pid !== process.pid && !pidAlive(pid);
  });
if (staleLabels.length) {
  sql(`DELETE FROM scraper_definition WHERE label IN (${staleLabels.map((l) => `'${l}'`).join(",")})`);
  console.log(`  🧹 ${staleLabels.length} halott futás helper-szülője söpörve (${staleLabels.slice(0, 3).join(", ")}${staleLabels.length > 3 ? ", …" : ""})`);
}
// A hat javított kapu RÉGI, beégetett címkéi: a mainre landolt kód már nem gyártja őket, de egy
// még nem rebase-elt testvér-fa napokig igen (mérve a landolás napján: mltierchk ×2, modpaychk ×2,
// roomeditor ×2, mind 1 óránál régebbi). Ezek ismert örökség — söpörjük, nem bukunk rajtuk; az
// ISMERETLEN címkéjű árva viszont új szemetelő kapu, és az bukás.
const LEGACY_LABELS = ["modpaychk", "mltierchk", "bookingscreen", "roomeditor", "wholecheck", "mlresume"];
const legacySwept = Number(
  sql(
    `WITH d AS (DELETE FROM scrape_run r USING scraper_definition s WHERE s.id = r.scraper_definition_id AND s.label IN (${LEGACY_LABELS.map((l) => `'${l}'`).join(",")}) AND r.created_at < now() - interval '1 hour' AND NOT EXISTS (SELECT 1 FROM lead l WHERE l.scrape_run_id = r.id) RETURNING r.id) SELECT count(*) FROM d`,
  ),
);
if (legacySwept) {
  sql(`DELETE FROM scraper_definition s WHERE s.label IN (${LEGACY_LABELS.map((l) => `'${l}'`).join(",")}) AND NOT EXISTS (SELECT 1 FROM scrape_run r WHERE r.scraper_definition_id = s.id)`);
  console.log(`  🧹 ${legacySwept} örökölt árva futás söpörve (régi címkék, még nem rebase-elt testvér-fák)`);
}
const census = sql(
  `SELECT coalesce(string_agg(x.label || ' ×' || x.n, ', '), '') FROM (SELECT d.label, count(*) AS n FROM scrape_run r JOIN scraper_definition d ON d.id = r.scraper_definition_id WHERE r.created_at < now() - interval '1 hour' AND NOT EXISTS (SELECT 1 FROM lead l WHERE l.scrape_run_id = r.id) GROUP BY d.label ORDER BY n DESC LIMIT 8) x`,
);
check(census === "", "⑤ a parkban nincs 1 óránál régebbi, lead nélküli scrape_run (nincs szemetelő kapu)", census);

// ── piros önteszt ────────────────────────────────────────────────────────────────────
if (SELF_TEST) {
  console.log("\n── piros önteszt ──");
  const cases: [string, boolean][] = [
    ["① „első sor” where nélkül — lelet", auditSource("scripts/x-check.mts", 'const run = await db.selectFrom("scrape_run").select("id").executeTakeFirst();\n').length === 1],
    ["① limit(1) where nélkül — lelet", auditSource("scripts/x-check.mts", 'const run = await db\n  .selectFrom("scrape_run")\n  .select("id")\n  .orderBy("id")\n  .limit(1)\n  .executeTakeFirst();\n').length === 1],
    ["① (kontroll) where-rel, saját id-ra — nem lelet", auditSource("scripts/x-check.mts", 'const r = await db.selectFrom("scrape_run").select("status").where("id", "=", id).executeTakeFirstOrThrow();\n').length === 0],
    ["② insert törlés nélkül — lelet", auditSource("scripts/x-check.mts", 'const d = await db.insertInto("scraper_definition").values({}).returning("id").executeTakeFirstOrThrow();\nawait db.deleteFrom("lead").where("id", "=", leadId).execute();\n').length === 1],
    ["② (kontroll) insert + ugyanarra deleteFrom — nem lelet", auditSource("scripts/x-check.mts", 'await db.insertInto("scrape_run").values({}).execute();\nawait db.deleteFrom("scrape_run").where("id", "=", id).execute();\n').length === 0],
    ["② (kontroll) scratch-DB-s kapu (az egész DB-t dobja) — nem lelet", auditSource("scripts/x-check.mts", 'const SCRATCH = scratchDbName("citoviso_x");\nawait db.insertInto("scrape_run").values({}).execute();\n').length === 0],
    ["② (kontroll) a helper használata — nem lelet", auditSource("scripts/x-check.mts", 'const parent = await createFixtureParent(db as never, "x");\n').length === 0],
    ["①② (kontroll) a kommentben idézett alak nem számít", auditSource("scripts/x-check.mts", '// const run = await db.selectFrom("scrape_run").select("id").executeTakeFirst();\n').length === 0],
  ];
  // ④ piros kontroll: helper NÉLKÜL létrehozott szülő + exit(1) → a sor MEGMARAD, és ezt látnunk kell.
  const noHook = childRun(`
const { db } = await import(${JSON.stringify(DB_CLIENT)});
const label = "_fpred_" + process.pid;
const def = await db.insertInto("scraper_definition").values({ label, country: "HU", region: "_gate", industry: "accommodation", sources: JSON.stringify(["osm"]) }).returning("id").executeTakeFirstOrThrow();
await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).execute();
console.log("LABEL=" + label);
process.exit(1);
`);
  const redLabel = /LABEL=(\S+)/.exec(noHook.out)?.[1] ?? "";
  const redLeft = redLabel ? Number(sql(`SELECT count(*) FROM scraper_definition WHERE label = '${redLabel}'`)) : -1;
  if (redLabel) sql(`DELETE FROM scraper_definition WHERE label = '${redLabel}'`);
  cases.push(["④ (piros kontroll) helper nélküli szülő exit(1) után MEGMARAD — az ellenőrzés látja", redLeft === 1]);
  let selfFail = 0;
  for (const [name, ok] of cases) {
    if (!ok) selfFail++;
    console.log(`${ok ? "  ✓" : "  ✗"} ${name}`);
  }
  if (selfFail) {
    console.error(`\n⛔ ÖNELLENŐRZÉS BUKOTT: ${selfFail} eset — az őr nem méri, amit állít.`);
    process.exit(1);
  }
  console.log("\n✅ önellenőrzés: az őr PIROSRA megy a bejelentett alakokon, és zöld a kontrollokon.");
}

if (fails.length) {
  console.error(`\n⛔ fixture-parent-check: ${fails.length} bukás`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`✅ fixture-parent-check: ${pass} állítás zöld (${gates.length} kapu átnézve, ${helperUsers} használja a helpert)`);
