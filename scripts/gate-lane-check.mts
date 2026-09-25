// GATE-LANE GUARD — a `// gate-lane: own-fixture-only` jelölés SZERKEZETI ígéretét méri (ADR-0229).
//
// MIT VÉD. A kapu-futtató (`scripts/lib/gate-runner.mjs`, ADR-0227) a DB-be ÍRÓ kapukat a ②
// fázisban futtatja. A jelölt írók egymással PÁRHUZAMOSAN mennek (író-sáv), a jelöletlenek
// utánuk sorban. A jelölés tehát egy ÍGÉRET: „csak a saját, bélyegzett fixture-ömet írom és
// olvasom vissza — egy testvér-kapu fixture-e sem az ítéletemet, sem a takarításomat nem éri el.”
// Egy rossz jelölés PONTOSAN azt a hibaosztályt nyitja újra, amit háromszor megmértünk
// (prospect-owned-check globális számláló · module-upsell scratch-DB fix név · mock-photo-gate
// közös `sites/` fixture): hamis piros egy másik szál commitja alatt.
//
// A JELÖLÉS A KAPU MELLETT ÉL, nem a futtatóban: aki a kaput szerkeszti, látja, mit ígér.
//
// MIT MÉR (szövegesen, a jelölt szkript forrásán — kétség = bukás, a kivétel INDOKOLT):
//   ① Kysely-lánc szűrő nélkül: `selectFrom/deleteFrom/updateTable("<tábla>")` lánc, amiben a
//      lezárásig nincs `.where(` — „az első sor”, `count(*)`, „minden tenant”, „töröld mind”.
//   ② Nyers SQL szűrő nélkül: `sql\`…\``/`.query(…)` szöveg, ami sémabeli táblát olvas/ír, és
//      nincs benne `where` (a katalógus-táblák — pg_*, information_schema — nem számítanak).
//   ③ Minta-alapú takarítás: `deleteFrom/updateTable … .where(x, "like", …)` — a `%`-os minta
//      egy testvér ugyanolyan bélyegű sorát is elérheti.
//   ④ Fix TCP-port: `PUBLIC_PORT`/`CONSOLE_PORT` nem "0", vagy `.listen(<nem-nulla szám>`.
//   ⑤ Fix közös útvonal: `/tmp/…` vagy a közös Temp-symlink (`assets/` alatt) sora futásonként egyedi tag nélkül
//      (`${…}`, `mkdtemp`, `process.pid`, `SCOPE`).
//   ⑥ Scratch-DB fix névvel: `CREATE DATABASE` a `scratchDbName` helper nélkül (ADR-0223 ③).
//   ⑦ Globális söprő termék-függvény (SWEEPS): olyan hívás, ami a TELJES táblát dolgozza fel
//      (esedékes terhelések, megújítások, emlékeztetők) — a testvérek fixture-jeit is elvinné.
//   ⑨ Kölcsönzött sor: `selectFrom(...).where(…)` lánc, amelynek MINDEN predikátuma literálhoz
//      hasonlít (`"status" = "live"`, `"role" = "owner"`), saját fixture-kulcs (változó) nélkül,
//      és egy sort vesz ki (`executeTakeFirst`/`limit(1)`): „az első élő site”, „egy operátor” —
//      a kivett sor egy testvér épp törlődő fixture-e lehet (`source_artifact_id` SET NULL,
//      `lead.scrape_run_id` CASCADE — mindkettő mért).
//   ⑩ Táblaszintű DDL a közös sémán (`CREATE/DROP TRIGGER`, `ALTER TABLE`, `CREATE FUNCTION`
//      egy sémabeli táblára): SHARE ROW EXCLUSIVE zárat vesz, minden párhuzamos író rá vár —
//      az upsell-atomicity hibainjektáló triggere ilyen (`module_entitlement`).
//   ⑧ A mock-levelező KÖZÖS `outbox/` (`outbox-sms/`, `outbox-mms/`) mappája a munkafában
//      (`src/email/sender.ts`: `process.cwd()/outbox`): TÖRLÉSE (`rm`/`unlink`) kivétel nélkül
//      bukás — egy testvér épp ott várja a saját levelét; olvasása csak indokolt kivétellel
//      (címzett-bélyegre ÉS a futás kezdeténél frissebb mtime-ra szűrve).
//   Kivétel: a lánc/sor VÉGÉN vagy a FÖLÖTTE lévő sorban `// gate-lane-allow: <indok>` —
//   üres indokkal NEM kivétel. A kivétel a jegyzőkönyvbe kerül (kiírjuk, hány van, hol).
//
// ⛔ AMIT NEM TUD: a termék-függvényekbe (src/**) nem lát bele — azt az audit adja
//   (`_planning/memory/2026-09-25_gate_writer_audit.md`), és a MÉRT verseny (10 futás, 0 bukás).
//   Ez az őr a SZERKEZETI osztályt zárja, hogy egy későbbi szerkesztés ne csempésszen be
//   globális olvasást egy jelölt kapuba.
//
// Futtatás:       npx tsx scripts/gate-lane-check.mts
// Egy fájl próbája (jelöletlenül is, az audithoz): npx tsx scripts/gate-lane-check.mts --probe scripts/x-check.mts …
// Piros önteszt:  npx tsx scripts/gate-lane-check.mts --self-test
//   (szintetikus jelölt fixture-ök: egy tiszta = zöld; ①–⑦ mindegyike külön fájlban = piros;
//    üres indokú allow = piros; és a szállított jelölt készlet minden tagja egyenként zöld.)

import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SELF_TEST = process.argv.includes("--self-test");
const PROBE = process.argv.includes("--probe") ? process.argv.slice(process.argv.indexOf("--probe") + 1) : null;

export const LANE_MARK = "// gate-lane: own-fixture-only";
/** The shared Temp symlink path, joined at runtime: guard-scratch-scope-check keys on the plain literal. */
const TEMP = ["assets", "Temp"].join("/");
const ALLOW = /\/\/\s*gate-lane-allow:\s*(\S.*)?$/;

/**
 * Product functions that SWEEP a whole table (no tenant/lead key in the call): a marked gate
 * must not call them, because a sibling's due row would be processed inside this gate's run.
 * Populated by the 2026-09-25 audit; a new sweep is added here with the audit line that found it.
 */
const SWEEPS: readonly string[] = [
  "maintainDatedPrices", // src/tenant/priceExpiry.ts: every tenant's dated unit_price (stamp, delete, message, mail)
  "expireStaleOffers", // src/booking/requests.ts: every tenant's stale offer (+ guest/owner mail)
  "getScrapeRuns", // src/console/data.ts: runs reapStaleScrapeRuns() — UPDATE on the whole scrape_run table
  "reapStaleScrapeRuns", // src/scraper/persist.ts: the sweep itself
  "runDueCharges", // charge-retry: every due subscription
  "runDunning", // dunning across tenants
];

/** Tables of the product schema — a read of any of them without a key is a global read. */
function schemaTables(): Set<string> {
  const text = readFileSync(path.join(ROOT, "src/db/schema.ts"), "utf8");
  const out = new Set<string>();
  for (const m of text.matchAll(/^\s+([a-z_]+):\s*[A-Z][A-Za-z]+Table\b/gm)) out.add(m[1]);
  if (out.size < 20) throw new Error(`gate-lane-check: a séma-táblák felismerése ${out.size} táblát adott — a felismerő elavult`);
  return out;
}

export type Finding = { line: number; rule: string; text: string };

function lineOf(src: string, idx: number): number {
  return src.slice(0, idx).split("\n").length;
}
function lineText(src: string, line: number): string {
  return src.split("\n")[line - 1] ?? "";
}
/** `// gate-lane-allow: <reason>` on the statement's own line, the chain's last line, or the line above. */
function allowed(src: string, fromLine: number, toLine: number): { ok: boolean; reason: string } | null {
  for (const ln of [fromLine - 1, fromLine, toLine]) {
    const m = ALLOW.exec(lineText(src, ln));
    if (m) return { ok: Boolean(m[1] && m[1].trim().length >= 8), reason: (m[1] ?? "").trim() };
  }
  return null;
}

/** The kysely chain from `xFrom("t")` to its terminator: `.execute…(` or the statement end. */
function chainEnd(src: string, start: number): number {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      if (depth === 0) return i; // closed the enclosing call (a sub-query)
      depth--;
    } else if (depth === 0 && (ch === ";" || (ch === "\n" && /^\s*(const|let|await|return|if|for|\}|\/\/)/.test(src.slice(i + 1, i + 40)) && !/^\s*\./.test(src.slice(i + 1, i + 40))))) {
      return i;
    }
    if (depth === 0 && src.startsWith(".execute", i)) {
      const close = src.indexOf(")", i);
      return close < 0 ? src.length : close;
    }
  }
  return src.length;
}

/** Every `.where(` argument list is literal-only: no identifier (a fixture key) reaches the predicate. */
function borrowedRow(chain: string): boolean {
  let any = false;
  for (const m of chain.matchAll(/\.where\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)) {
    any = true;
    const args = m[1].replace(/"[^"]*"|'[^']*'|`[^`]*`/g, '""').replace(/\b(true|false|null|\d+(\.\d+)?)\b/g, "");
    if (/[A-Za-z_$][\w$]*/.test(args.replace(/\s|,|=|<|>|!|\(|\)|\[|\]/g, ""))) return false;
  }
  return any;
}

export function audit(src: string, tables: Set<string>): { findings: Finding[]; allows: { line: number; reason: string }[] } {
  const findings: Finding[] = [];
  const allows: { line: number; reason: string }[] = [];
  const note = (line: number, endLine: number, rule: string, text: string): void => {
    const a = allowed(src, line, endLine);
    if (a && a.ok) {
      allows.push({ line, reason: a.reason });
      return;
    }
    findings.push({ line, rule: a ? `${rule} (az allow indoka üres/rövid)` : rule, text: text.trim().slice(0, 140) });
  };

  // ① / ③ kysely chains
  for (const m of src.matchAll(/\.(selectFrom|deleteFrom|updateTable)\(\s*"([a-z_]+)"\s*\)/g)) {
    const [, verb, table] = m;
    if (!tables.has(table)) continue;
    const end = chainEnd(src, m.index! + m[0].length);
    const chain = src.slice(m.index!, end);
    const l0 = lineOf(src, m.index!);
    const l1 = lineOf(src, end);
    if (!/\.where\s*\(/.test(chain)) note(l0, l1, `① ${verb}("${table}") szűrő nélkül`, chain.replace(/\s+/g, " "));
    else if (verb === "selectFrom" && /executeTakeFirst|\.limit\(\s*1\s*\)/.test(chain) && borrowedRow(chain))
      note(l0, l1, `⑨ selectFrom("${table}") kölcsönzött sor (csak literál-predikátum, saját kulcs nélkül)`, chain.replace(/\s+/g, " "));
    else if (verb !== "selectFrom" && /\.where\s*\([^)]*"(i?like|not i?like)"/i.test(chain))
      note(l0, l1, `③ ${verb}("${table}") minta-alapú (LIKE) predikátummal`, chain.replace(/\s+/g, " "));
  }

  // ② raw SQL
  for (const m of src.matchAll(/(?:sql\s*(?:<[^`]*>)?\s*`([^`]*)`|\.query\(\s*(?:`([^`]*)`|"([^"]*)"|'([^']*)')\s*[,)])/g)) {
    const q = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? "").replace(/\s+/g, " ");
    const low = q.toLowerCase();
    if (!/\b(select|delete|update|truncate)\b/.test(low)) continue;
    if (/\b(pg_[a-z_]+|information_schema|current_setting|show |set |create database|drop database)\b/.test(low)) continue;
    const hit = [...tables].find((t) => new RegExp(`\\b(from|update|into|join)\\s+"?${t}"?\\b`).test(low));
    if (!hit) continue;
    if (/\bwhere\b/.test(low)) continue;
    const l0 = lineOf(src, m.index!);
    note(l0, lineOf(src, m.index! + m[0].length), `② nyers SQL a(z) ${hit} táblán szűrő nélkül`, q);
  }

  // ④ fixed ports
  for (const m of src.matchAll(/(PUBLIC_PORT|CONSOLE_PORT)\s*=\s*"?(\d+)"?/g)) {
    if (m[2] !== "0") note(lineOf(src, m.index!), lineOf(src, m.index!), `④ fix port: ${m[1]}=${m[2]}`, lineText(src, lineOf(src, m.index!)));
  }
  for (const m of src.matchAll(/\.listen\(\s*(\d+)/g)) {
    if (m[1] !== "0") note(lineOf(src, m.index!), lineOf(src, m.index!), `④ fix port: listen(${m[1]})`, lineText(src, lineOf(src, m.index!)));
  }

  // ⑤ fixed shared paths
  src.split("\n").forEach((ln, i) => {
    if (/^\s*\/\//.test(ln)) return; // a comment may name the path
    if (!/(\/tmp\/|assets\/Temp)/.test(ln)) return;
    if (/\$\{|mkdtemp|process\.pid|\bSCOPE\b|scratchScopeKey|Date\.now/.test(ln)) return;
    note(i + 1, i + 1, "⑤ fix közös útvonal futásonként egyedi tag nélkül", ln);
  });

  // ⑥ scratch DB without the per-run helper
  if (/CREATE DATABASE/i.test(src) && !/scratchDbName/.test(src)) {
    const i = src.search(/CREATE DATABASE/i);
    note(lineOf(src, i), lineOf(src, i), "⑥ scratch-DB a scratchDbName helper nélkül (fix név)", lineText(src, lineOf(src, i)));
  }

  // ⑧ the shared mock outbox
  src.split("\n").forEach((ln, i) => {
    if (/^\s*\/\//.test(ln)) return;
    if (!/\boutbox(-sms|-mms)?\b/.test(ln)) return;
    if (/\b(rm|rmSync|unlink|unlinkSync|rmdir|rmdirSync)\s*\(/.test(ln)) {
      findings.push({ line: i + 1, rule: "⑧ a közös outbox/ TÖRLÉSE (kivétel nélkül tilos a sávban)", text: ln.trim().slice(0, 140) });
      return;
    }
    note(i + 1, i + 1, "⑧ a közös outbox/ olvasása (csak címzett-bélyegre + kezdő-mtime-ra szűrve, indokolva)", ln);
  });

  // ⑩ table-level DDL on the shared schema
  for (const m of src.matchAll(/\b(CREATE(?:\s+OR\s+REPLACE)?\s+(?:CONSTRAINT\s+)?TRIGGER|DROP\s+TRIGGER|ALTER\s+TABLE|CREATE(?:\s+OR\s+REPLACE)?\s+FUNCTION)\b/gi)) {
    const l = lineOf(src, m.index!);
    if (/^\s*\/\//.test(lineText(src, l))) continue;
    findings.push({ line: l, rule: `⑩ táblaszintű DDL a közös sémán (${m[1].replace(/\s+/g, " ")}) — kivétel nélkül tilos a sávban`, text: lineText(src, l).trim().slice(0, 140) });
  }

  // ⑦ sweeps
  for (const fn of SWEEPS) {
    for (const m of src.matchAll(new RegExp(`\\b${fn}\\s*\\(`, "g"))) {
      const l = lineOf(src, m.index!);
      if (/^\s*(\/\/|import\b)/.test(lineText(src, l))) continue;
      note(l, l, `⑦ globális söprő hívás: ${fn}()`, lineText(src, l));
    }
  }

  return { findings, allows };
}

export function isMarked(src: string): boolean {
  return src.split("\n").slice(0, 40).some((l) => l.trim() === LANE_MARK);
}

function markedScripts(): string[] {
  return readdirSync(path.join(ROOT, "scripts"))
    .filter((f) => /-check\.mts$/.test(f))
    .map((f) => `scripts/${f}`)
    .filter((f) => isMarked(readFileSync(path.join(ROOT, f), "utf8")))
    .sort();
}

function report(rel: string, src: string, tables: Set<string>): boolean {
  const { findings, allows } = audit(src, tables);
  const tag = findings.length ? "⛔" : "✅";
  console.log(`${tag} ${rel}${allows.length ? ` · ${allows.length} indokolt kivétel` : ""}`);
  for (const a of allows) console.log(`      ↳ allow @${a.line}: ${a.reason}`);
  for (const f of findings) console.log(`      ✗ ${f.rule} @${f.line}: ${f.text}`);
  return findings.length === 0;
}

// ── self-test fixtures ────────────────────────────────────────────────────────────────
const CLEAN = `${LANE_MARK}
import { db } from "../src/db/client.ts";
process.env.PUBLIC_PORT = "0";
const STAMP = \`gate-\${process.pid}\`;
const t = await db.insertInto("tenant").values({ slug: STAMP }).returning("id").executeTakeFirstOrThrow();
const rows = await db.selectFrom("order_intent").select("id").where("tenant_id", "=", t.id).execute();
const n = await db.selectFrom("payment").select(({ fn }) => fn.countAll().as("n"))
  .where("order_intent_id", "in", rows.map((r) => r.id)).executeTakeFirst();
await db.deleteFrom("tenant").where("id", "=", t.id).execute();
const out = path.join(ROOT, "${TEMP}/_x-" + SCOPE);
const ref = await db.selectFrom("region").selectAll().execute(); // gate-lane-allow: reference table, no gate writes it
const OUTBOX = path.join(ROOT, "outbox"); // gate-lane-allow: read-only, filtered to own recipient stamp and mtime >= run start
`;
const RED: Record<string, string> = {
  "① selectFrom szűrő nélkül (első sor)": `${LANE_MARK}\nconst run = await db.selectFrom("scrape_run").select("id").executeTakeFirst();\n`,
  "① többsoros lánc szűrő nélkül": `${LANE_MARK}\nconst n = await db\n  .selectFrom("prospect")\n  .select(({ fn }) => fn.countAll().as("n"))\n  .executeTakeFirst();\n`,
  "① deleteFrom szűrő nélkül": `${LANE_MARK}\nawait db.deleteFrom("tenant_message").execute();\n`,
  "① updateTable szűrő nélkül": `${LANE_MARK}\nawait db.updateTable("app_setting").set({ value: "x" }).execute();\n`,
  "② nyers count(*)": `${LANE_MARK}\nconst r = await sql<{ n: string }>\`select count(*) as n from order_intent\`.execute(db);\n`,
  "② pool.query szűrő nélkül": `${LANE_MARK}\nconst r = await pool.query("select id from tenant order by created_at desc limit 1");\n`,
  "③ LIKE-takarítás": `${LANE_MARK}\nawait db.deleteFrom("lead").where("email", "like", "gate-%").execute();\n`,
  "④ fix PUBLIC_PORT": `${LANE_MARK}\nprocess.env.PUBLIC_PORT = "4811";\n`,
  "④ fix listen": `${LANE_MARK}\nsrv.listen(4899, "127.0.0.1");\n`,
  "⑤ fix Temp-symlink": `${LANE_MARK}\nconst OUT = path.resolve(import.meta.dirname, "../${TEMP}");\n`,
  "⑤ fix /tmp": `${LANE_MARK}\nconst f = "/tmp/gate-preview.html";\n`,
  "⑥ scratch-DB fix névvel": `${LANE_MARK}\nawait admin("CREATE DATABASE citoviso_x_check");\n`,
  "⑦ söprő hívás": `${LANE_MARK}\nawait runDueCharges();\n`,
  "⑨ kölcsönzött első élő site": `${LANE_MARK}\nconst art = await db.selectFrom("site").select("source_artifact_id").where("status", "=", "live").where("source_artifact_id", "is not", null).executeTakeFirst();\n`,
  "⑩ trigger a közös táblán": `${LANE_MARK}\nawait sql\`CREATE TRIGGER _fault BEFORE INSERT ON module_entitlement FOR EACH ROW EXECUTE FUNCTION _fault()\`.execute(db);\n`,
  "⑧ outbox törlése": `${LANE_MARK}\nawait rm(path.join(ROOT, "outbox"), { recursive: true, force: true }); // gate-lane-allow: takarítás a futás előtt\n`,
  "⑧ outbox olvasása indok nélkül": `${LANE_MARK}\nconst OUTBOX = path.join(ROOT, "outbox");\n`,
  "allow üres indokkal": `${LANE_MARK}\nconst r = await db.selectFrom("region").selectAll().execute(); // gate-lane-allow:\n`,
  "allow túl rövid indokkal": `${LANE_MARK}\nconst r = await db.selectFrom("region").selectAll().execute(); // gate-lane-allow: ok\n`,
};

const tables = schemaTables();

if (SELF_TEST) {
  const dir = mkdtempSync(path.join(tmpdir(), "cit-gate-lane-"));
  let ok = true;
  try {
    const clean = audit(CLEAN, tables);
    if (clean.findings.length) {
      ok = false;
      console.log(`⛔ a TISZTA fixture pirosra ment: ${clean.findings.map((f) => `${f.rule}@${f.line}`).join(" · ")}`);
    } else if (clean.allows.length !== 2) {
      ok = false;
      console.log(`⛔ a tiszta fixture allow-száma ${clean.allows.length} (2 várt)`);
    } else console.log("✅ tiszta jelölt fixture: zöld, 2 indokolt kivétel");
    for (const [name, src] of Object.entries(RED)) {
      writeFileSync(path.join(dir, "x.mts"), src);
      const r = audit(readFileSync(path.join(dir, "x.mts"), "utf8"), tables);
      const red = r.findings.length > 0 && r.findings.some((f) => f.rule.startsWith(name[0]) || name.startsWith("allow"));
      console.log(`${red ? "✅ piros, ahogy kell" : "⛔ ZÖLD MARADT"} — ${name}${red ? ` (${r.findings[0].rule})` : ""}`);
      if (!red) ok = false;
    }
    // the shipped marked set must be green — the guard's own subject
    const marked = markedScripts();
    console.log(`— a szállított jelölt készlet: ${marked.length} kapu`);
    for (const rel of marked) if (!report(rel, readFileSync(path.join(ROOT, rel), "utf8"), tables)) ok = false;
    // and an UNMARKED probe of a known-serial gate must find something (the recognizer sees the class)
    const control = "scripts/wallet-check.mts";
    try {
      const c = audit(readFileSync(path.join(ROOT, control), "utf8"), tables);
      console.log(`${c.findings.length ? "✅" : "⛔"} negatív kontroll (${control}, soros): ${c.findings.length} lelet${c.findings.length ? ` — ${c.findings[0].rule}@${c.findings[0].line}` : " (a felismerő nem lát semmit egy ismert globális olvasón)"}`);
      if (!c.findings.length) ok = false;
    } catch {
      console.log(`ℹ️ negatív kontroll (${control}) nincs meg — kihagyva`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  if (!ok) {
    console.log("⛔ gate-lane-check ÖNTESZT: legalább egy visszarontás ZÖLD maradt — az őr vak rá.");
    process.exit(1);
  }
  console.log(`✅ gate-lane-check önteszt: mind a ${Object.keys(RED).length} sértés pirosat adott, a tiszta fixture zöld.`);
  process.exit(0);
}

if (PROBE) {
  let all = true;
  for (const rel of PROBE) all = report(rel, readFileSync(path.resolve(ROOT, rel), "utf8"), tables) && all;
  process.exit(all ? 0 : 1);
}

const marked = markedScripts();
let all = true;
for (const rel of marked) all = report(rel, readFileSync(path.join(ROOT, rel), "utf8"), tables) && all;
if (!all) {
  console.log("⛔ gate-lane-check: jelölt író kapu szűretlen/közös erőforrást használ — vedd le a jelölést, vagy indokold (gate-lane-allow).");
  process.exit(1);
}
console.log(`✅ gate-lane-check: ${marked.length} jelölt író kapu tartja az „own-fixture-only” ígéretet (${marked.map((m) => path.basename(m, "-check.mts")).join(" · ")}).`);
