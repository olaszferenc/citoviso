// GATE-SUBJECT GUARD — egy kapu nem mérhet a közös dev-DB „első során” (ADR-0252, ADR-0249 ⑥).
//
// MIT VÉD. A kapuk a KÖZÖS dev-DB-n futnak (`citoviso_dev`, minden szál ugyanazt látja). Ha egy kapu
// az alanyát „az első tenant_user / az első mock_artifact / a legújabb lead” módon veszi ki, akkor
// NEM a vizsgált változást méri, hanem a közös adat pillanatnyi sorrendjét. 2026-09-27-én három kapu
// volt piros a TISZTA origin/mainen is emiatt (photo-normalize-check: az első tenant egyegységes,
// a szoba-feltöltő csak 2+ egységnél létezik · console-contrast-check és outreach-link-live-check:
// az első artefaktum leadje). Ha a közös adat változik (új tenant, purge, egy testvér-szál
// tesztadata), a kapu véletlenszerűen billeg — vagy VAKON zöld, mert az alany épp nem viseli azt,
// amit mérni kellene.
//
// AZ ELV. Kapu alanyt csak így választhat:
//   (a) saját fixture-ből (maga szúrja be, bélyegzett kulccsal — ADR-0229 `own-fixture-only`), vagy
//   (b) a közös DB-ből KIMONDOTT predikátummal (`.where` / `.whereRef` / `.having`, pl. „több egységes
//       tenant”, „a claude-test operátor”) — és ha a predikátumnak nincs alanya, HANGOSAN bukik
//       (`executeTakeFirstOrThrow(() => new Error("ELŐFELTÉTEL: …"))`), sosem hagy ki csendben.
//   (c) a vak „első sor” — `selectFrom(t)` predikátum nélkül, egy sort véve (`executeTakeFirst*`,
//       `.limit(1)`, `.execute())[0]`), vagy nyers SQL `limit 1` `where` nélkül — HIBA.
//
// MIT MÉR (szövegesen, a kód-részen — kommentben és string-literálban álló minta NEM számít, így
// egy őr önteszt-fixture-je sem):
//   ① Kysely-lánc: `.selectFrom(…)` … egy sort vesz (`executeTakeFirst`/`executeTakeFirstOrThrow`/
//      `.limit(1)`/`.execute())[0]`), és a láncban nincs `.where(`/`.whereRef(`/`.having(`.
//      Egy `innerJoin` NEM predikátum (a „tenant, akinek van site-ja” is az első ilyen tenant).
//      Aggregátum (`count`/`max`/`min`/`sum`) nem alany-választás — azt ez az őr nem nézi.
//   ② Nyers SQL (`sql\`…\`` / `.query(…)`): `limit 1` `where` nélkül.
//   Kivétel: a lánc első sorában, a fölötte lévő sorban vagy a lánc utolsó sorában
//   `// gate-subject-allow: <indok>` — az indok legalább 12 karakter. A kivétel a jegyzőkönyvbe
//   kerül (fájl:sor + indok), és az a kivétel, ami SEMMILYEN leletet nem fed, maga is bukás
//   (elavult kivétel nem gyűlhet).
//
// ⛔ AMIT NEM TUD: a (b) „hangosan bukik” felét nem bizonyítja (egy `if (!x) process.exit(0)` néma
//   kihagyást statikusan nem különít el megbízhatóan) — ezt a leltár kézzel nézte
//   (`_planning/memory/2026-09-27_gate_subject_inventory.md`). A termék-függvényekbe (src/**) sem
//   lát bele. A globális számlálók (`count(*)` a közös táblán) külön hibaosztály (gate-lane ②).
//
// HATÓKÖR: minden `scripts/*-check.{mts,ts,mjs}`, a `scripts/lib/*` és MINDEN szkript, amit a
//   `hooks/pre-commit` vagy a `scripts/land.sh` név szerint futtat (bármilyen kiterjesztéssel —
//   egy `.mts|.mjs` szűrő két `.ts` kaput némán kihagyott egyszer). A beolvasott fájlok számát és a
//   horgon-futtatottak lefedettségét a kimenet kiírja (utó-feltétel: minden futtatott szkript benne van).
//
// Futtatás:       npx tsx scripts/gate-subject-check.mts
// Egy fájl próbája: npx tsx scripts/gate-subject-check.mts --probe <fájl> …
// Piros önteszt:  npx tsx scripts/gate-subject-check.mts --self-test

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SELF_TEST = process.argv.includes("--self-test");
const PROBE = process.argv.includes("--probe") ? process.argv.slice(process.argv.indexOf("--probe") + 1) : null;
const ALLOW = /^\/\/\s*gate-subject-allow:\s*(.*)$/; // the comment must START with the marker (a header may quote it)
const MIN_REASON = 12;

export type Finding = { line: number; rule: string; text: string };
export type Allow = { line: number; reason: string };

/**
 * A per-character mask: true where the character is CODE (not a comment, not the text of a
 * string or template literal). `${…}` inside a template is code again. Regex literals are not
 * tracked — a `/…"…/` would at worst hide a match on that line, never create one.
 */
export function codeMask(src: string): boolean[] {
  return lex(src).mask;
}

/** The mask plus the line comments (`// …`) that really are comments — not a `//` inside a string. */
function lex(src: string): { mask: boolean[]; lineComments: { line: number; text: string }[] } {
  const mask = new Array<boolean>(src.length).fill(true);
  const lineComments: { line: number; text: string }[] = [];
  // a stack of contexts: "code" (with its brace depth) or "tpl"
  const stack: { kind: "code" | "tpl"; depth: number }[] = [{ kind: "code", depth: 0 }];
  let i = 0;
  while (i < src.length) {
    const top = stack[stack.length - 1];
    const ch = src[i];
    if (top.kind === "tpl") {
      mask[i] = false;
      if (ch === "\\") {
        mask[i + 1] = false;
        i += 2;
        continue;
      }
      if (ch === "`") {
        stack.pop();
        i++;
        continue;
      }
      if (ch === "$" && src[i + 1] === "{") {
        mask[i + 1] = false;
        stack.push({ kind: "code", depth: 0 });
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    // code
    if (ch === "/" && src[i + 1] === "/") {
      const from = i;
      while (i < src.length && src[i] !== "\n") mask[i++] = false;
      lineComments.push({ line: lineOf(src, from), text: src.slice(from, i) });
      continue;
    }
    if (ch === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end < 0 ? src.length : end + 2;
      while (i < stop) mask[i++] = false;
      continue;
    }
    // A regex literal: a `/` where a value may start (not after an identifier, number, `)` or `]`).
    // Its body can hold a quote or a backtick — unlexed, `/`mock-\$\{…\}`/` swallowed the rest of
    // mock-photo-gate-check into a template and hid its blind operator lookup (measured).
    if (ch === "/" && src[i + 1] !== "/" && src[i + 1] !== "*") {
      const before = src.slice(Math.max(0, i - 12), i).replace(/\s+$/, "");
      const prev = before[before.length - 1] ?? "";
      if (!prev || /[(,=:[!&|?{};+\-*%<>~^]/.test(prev) || /\b(return|typeof|case|in|of)$/.test(before)) {
        let j = i + 1;
        let cls = false;
        while (j < src.length && src[j] !== "\n") {
          if (src[j] === "\\") j += 2;
          else if (src[j] === "[") (cls = true), j++;
          else if (src[j] === "]") (cls = false), j++;
          else if (src[j] === "/" && !cls) break;
          else j++;
        }
        if (src[j] === "/") {
          for (let k = i; k <= j; k++) mask[k] = false;
          i = j + 1;
          continue;
        }
      }
    }
    if (ch === '"' || ch === "'") {
      mask[i++] = true; // the quote itself stays code, so `selectFrom("t")` keeps its shape
      while (i < src.length && src[i] !== ch && src[i] !== "\n") {
        if (src[i] === "\\") mask[i++] = false;
        mask[i++] = false;
      }
      i++;
      continue;
    }
    if (ch === "`") {
      mask[i] = false;
      stack.push({ kind: "tpl", depth: 0 });
      i++;
      continue;
    }
    if (ch === "{") top.depth++;
    else if (ch === "}") {
      if (top.depth === 0 && stack.length > 1) {
        mask[i] = false;
        stack.pop();
        i++;
        continue;
      }
      top.depth--;
    }
    i++;
  }
  return { mask, lineComments };
}

function lineOf(src: string, idx: number): number {
  return src.slice(0, idx).split("\n").length;
}
function lineText(src: string, line: number): string {
  return src.split("\n")[line - 1] ?? "";
}

/** The kysely chain from `.selectFrom(` to its terminator: `.execute…(…)` (+ a trailing `)[0]`), or the statement end. */
function chainEnd(src: string, start: number): number {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      if (depth === 0) return i; // closed the enclosing call (a sub-query / an await group)
      depth--;
    } else if (depth === 0 && (ch === ";" || (ch === "\n" && /^\s*(const|let|await|return|if|for|\}|\/\/)/.test(src.slice(i + 1, i + 40)) && !/^\s*\./.test(src.slice(i + 1, i + 40))))) {
      return i;
    }
    if (depth === 0 && src.startsWith(".execute", i)) {
      // include the call's own argument list (e.g. executeTakeFirstOrThrow(() => new Error(…)))
      const open = src.indexOf("(", i);
      let d = 0;
      for (let j = open; j < src.length; j++) {
        if (src[j] === "(") d++;
        else if (src[j] === ")" && --d === 0) return j + 1;
      }
      return src.length;
    }
  }
  return src.length;
}

const ONE_ROW = /\.executeTakeFirst(OrThrow)?\s*\(|\.limit\(\s*1\s*\)/;
const PREDICATE = /\.(where|whereRef|having)\s*\(/;
const AGGREGATE = /\bfn\s*\.\s*(count|countAll|max|min|sum|avg)\b|\bfn\s*\(\s*["'](count|max|min|sum)|sql[^`]*`[^`]*\b(count|max|min|sum)\s*\(/i;

export function audit(src: string): { findings: Finding[]; allows: Allow[]; staleAllows: Allow[] } {
  const { mask, lineComments } = lex(src);
  const raw: { l0: number; l1: number; rule: string; text: string }[] = [];

  // ① kysely chains
  const takesOne = (chain: string, end: number): boolean =>
    ONE_ROW.test(chain) || (/\.execute\s*\(\s*\)$/.test(chain) && /^\s*\)\s*\[\s*0\s*\]|^\s*\.at\(\s*0\s*\)/.test(src.slice(end, end + 12)));
  /** Query builders kept in a variable without a predicate (`const q = db.selectFrom("t")…;`): a
   *  later `q.limit(1).executeTakeFirst()` is the same blind first row, one step removed. */
  const builders = new Map<string, { chain: string; table: string }>();
  for (const m of src.matchAll(/\.selectFrom\s*\(/g)) {
    if (!mask[m.index!]) continue;
    const end = chainEnd(src, m.index! + m[0].length - 1); // from the "(" so the table argument is inside the chain
    const chain = src.slice(m.index!, end);
    const table = /\.selectFrom\s*\(\s*"([^"]+)"/.exec(chain)?.[1] ?? "?";
    const bound = /\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\w+\s*)?$/.exec(src.slice(Math.max(0, m.index! - 80), m.index!).replace(/\s+$/, ""));
    if (bound && !/\.execute/.test(chain) && !PREDICATE.test(chain)) builders.set(bound[1], { chain, table });
    if (!takesOne(chain, end)) continue;
    if (PREDICATE.test(chain)) continue;
    if (AGGREGATE.test(chain)) continue;
    raw.push({ l0: lineOf(src, m.index!), l1: lineOf(src, end), rule: `① selectFrom("${table}") egy sort vesz predikátum nélkül (vak „első sor”)`, text: chain.replace(/\s+/g, " ") });
  }
  for (const [name, b] of builders) {
    for (const m of src.matchAll(new RegExp(`\\b${name.replace(/\$/g, "\\$")}\\s*\\.`, "g"))) {
      if (!mask[m.index!]) continue;
      const end = chainEnd(src, m.index! + m[0].length);
      const chain = src.slice(m.index!, end);
      if (!takesOne(chain, end) || PREDICATE.test(chain) || AGGREGATE.test(b.chain + chain)) continue;
      raw.push({ l0: lineOf(src, m.index!), l1: lineOf(src, end), rule: `① ${name} (selectFrom("${b.table}") változóban) egy sort vesz predikátum nélkül (vak „első sor”)`, text: chain.replace(/\s+/g, " ") });
    }
  }

  // ② raw SQL
  for (const m of src.matchAll(/(?:\bsql\s*(?:<[^`>]*>)?\s*`([^`]*)`|\.query\(\s*(?:`([^`]*)`|"([^"]*)"|'([^']*)'))/g)) {
    if (!mask[m.index!]) continue;
    const q = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? "").replace(/\s+/g, " ");
    const low = q.toLowerCase();
    if (!/\bselect\b/.test(low) || !/\blimit\s+1\b/.test(low)) continue;
    if (/\bwhere\b|\bhaving\b/.test(low)) continue;
    if (/\b(pg_[a-z_]+|information_schema)\b/.test(low)) continue;
    raw.push({ l0: lineOf(src, m.index!), l1: lineOf(src, m.index! + m[0].length), rule: "② nyers SQL `limit 1` `where` nélkül (vak „első sor”)", text: q });
  }

  // allow comments: every one must cover a finding, and carry a reason
  const allowLines = new Map<number, string>();
  for (const c of lineComments) {
    const a = ALLOW.exec(c.text);
    if (a) allowLines.set(c.line, (a[1] ?? "").trim());
  }
  const used = new Set<number>();
  const findings: Finding[] = [];
  const allows: Allow[] = [];
  for (const r of raw) {
    // the statement may start above the `.selectFrom` line (`const x = await db` ⏎ `.selectFrom(…)`)
    let head = r.l0;
    while (head > 1 && /(=|\bawait|\bdb|\(|\?\?)\s*$/.test(lineText(src, head - 1))) head--;
    const at = [head - 1, head, r.l0 - 1, r.l0, r.l1].find((l) => allowLines.has(l));
    if (at !== undefined) {
      used.add(at);
      const reason = allowLines.get(at)!;
      if (reason.length >= MIN_REASON) {
        allows.push({ line: r.l0, reason });
        continue;
      }
      findings.push({ line: r.l0, rule: `${r.rule} — az allow indoka üres/rövid (<${MIN_REASON} kar.)`, text: r.text.slice(0, 160) });
      continue;
    }
    findings.push({ line: r.l0, rule: r.rule, text: r.text.slice(0, 160) });
  }
  const staleAllows = [...allowLines].filter(([l]) => !used.has(l)).map(([line, reason]) => ({ line, reason }));
  for (const s of staleAllows) findings.push({ line: s.line, rule: "elavult gate-subject-allow (nem fed egyetlen leletet sem)", text: lineText(src, s.line).trim().slice(0, 160) });
  return { findings, allows, staleAllows };
}

/** Every script a hook runs by name, plus every *-check and scripts/lib file (any JS/TS extension). */
export function scope(root: string): { files: string[]; hooked: string[] } {
  const hooked = new Set<string>();
  for (const f of ["hooks/pre-commit", "scripts/land.sh"]) {
    const p = path.join(root, f);
    if (!existsSync(p)) continue;
    for (const m of readFileSync(p, "utf8").matchAll(/scripts\/[A-Za-z0-9_./-]+\.(?:mts|ts|mjs|js|cts|cjs)\b/g)) hooked.add(m[0]);
  }
  const files = new Set<string>();
  for (const f of readdirSync(path.join(root, "scripts"))) if (/-check\.(mts|ts|mjs|js)$/.test(f)) files.add(`scripts/${f}`);
  for (const f of readdirSync(path.join(root, "scripts/lib"))) if (/\.(mts|ts|mjs|js)$/.test(f)) files.add(`scripts/lib/${f}`);
  const hookedExisting = [...hooked].filter((f) => existsSync(path.join(root, f))).sort();
  for (const f of hookedExisting) files.add(f);
  return { files: [...files].sort(), hooked: hookedExisting };
}

function report(rel: string, src: string, quietGreen: boolean): { ok: boolean; allows: number } {
  const { findings, allows } = audit(src);
  if (findings.length || !quietGreen || allows.length) {
    console.log(`${findings.length ? "⛔" : "✅"} ${rel}${allows.length ? ` · ${allows.length} indokolt kivétel` : ""}`);
    for (const a of allows) console.log(`      ↳ allow @${a.line}: ${a.reason}`);
    for (const f of findings) console.log(`      ✗ ${f.rule} @${f.line}: ${f.text}`);
  }
  return { ok: findings.length === 0, allows: allows.length };
}

// ── self-test fixtures ────────────────────────────────────────────────────────────────
const CLEAN = `
const op = await db.selectFrom("operator_user").select("id").where("username", "=", GATE_OPERATOR)
  .executeTakeFirstOrThrow(() => new Error("ELŐFELTÉTEL: nincs claude-test operátor"));
const t = await db.insertInto("tenant").values({ slug: STAMP }).returning("id").executeTakeFirstOrThrow();
const mine = await db.selectFrom("site").select("id").where("tenant_id", "=", t.id).executeTakeFirst();
const multi = await db
  .selectFrom("tenant_user")
  .innerJoin("site_unit", "site_unit.site_id", "site.id")
  .select("tenant_user.id")
  .groupBy("tenant_user.id")
  .having((eb) => eb.fn.count("site_unit.id"), ">", 1)
  .limit(1)
  .executeTakeFirstOrThrow(() => new Error("ELŐFELTÉTEL: nincs több egységes tenant"));
const n = await db.selectFrom("payment").select(({ fn }) => fn.countAll().as("n")).executeTakeFirst();
const all = await db.selectFrom("region").selectAll().execute();
// a comment may say: db.selectFrom("lead").select("id").limit(1).executeTakeFirst()
const FIXTURE = \`const x = await db.selectFrom("lead").select("id").limit(1).executeTakeFirst();\`;
const r = await sql\`select id from lead where id = \${id} limit 1\`.execute(db);
const partner = await db.selectFrom("partner").select("id").limit(1).executeTakeFirst(); // gate-subject-allow: a partner-lista minden sora azonos szerkezetű, a kapu csak a markupot nézi
const half = total / 2; const ratio = a / b; const s = "x/y";
// gate-subject-allow: az id csak egy URL-be kerül, a sor tartalmát a mérés nem olvassa
const art = await db
  .selectFrom("mock_artifact")
  .select("id")
  .limit(1)
  .executeTakeFirst();
const q = db.selectFrom("site").select("id").where("status", "=", "live");
const live = await q.limit(1).executeTakeFirstOrThrow(() => new Error("ELŐFELTÉTEL: nincs élő site"));
`;
const RED: Record<string, string> = {
  "① egysoros limit(1)": `const u = await db.selectFrom("tenant_user").select("id").limit(1).executeTakeFirstOrThrow();\n`,
  "① többsoros orderBy+limit(1)": `const l = await db\n  .selectFrom("lead")\n  .select("id")\n  .orderBy("created_at", "desc")\n  .limit(1)\n  .executeTakeFirst();\n`,
  "① executeTakeFirst limit nélkül": `const p = await db.selectFrom("partner").select("id").executeTakeFirst();\n`,
  "① innerJoin mint „predikátum”": `const u = await db.selectFrom("tenant_user").innerJoin("site", "site.tenant_id", "tenant_user.tenant_id").select(["tenant_user.id as id"]).limit(1).executeTakeFirst();\n`,
  "① execute())[0]": `const a = (await db.selectFrom("mock_artifact").select("lead_id").execute())[0];\n`,
  "① ?? fallback az első sorra": `const op = (await db.selectFrom("operator_user").select("id").where("username", "=", "claude-test").executeTakeFirst()) ??\n  (await db.selectFrom("operator_user").select("id").limit(1).executeTakeFirst());\n`,
  "① sablon ${…} belsejében is kód": `const html = \`<a href="/lead/\${(await db.selectFrom("lead").select("id").limit(1).executeTakeFirstOrThrow()).id}">\`;\n`,
  "① regex-literál backtickkel előtte (lexer)": `const hand = /\`mock-\\$\\{[^\`]*\\}\\.html\`/.test(src);\nconst op = await db.selectFrom("operator_user").select("id").limit(1).executeTakeFirst();\n`,
  "① lekérdezés-változó, később limit(1)": `const q = db\n  .selectFrom("tenant_user")\n  .innerJoin("site", "site.tenant_id", "tenant_user.tenant_id")\n  .select(["tenant_user.id as id"]);\nconst tu = (await q.innerJoin("subscription", "subscription.tenant_id", "tenant_user.tenant_id").limit(1).executeTakeFirst()) ?? (await q.limit(1).executeTakeFirst());\n`,
  "② nyers SQL limit 1": `const r = await sql\`select id from tenant order by created_at desc limit 1\`.execute(db);\n`,
  "② pool.query limit 1": `const r = await pool.query("select id from lead limit 1");\n`,
  "allow üres indokkal": `const p = await db.selectFrom("partner").select("id").limit(1).executeTakeFirst(); // gate-subject-allow:\n`,
  "allow túl rövid indokkal": `// gate-subject-allow: mindegy\nconst p = await db.selectFrom("partner").select("id").limit(1).executeTakeFirst();\n`,
  "elavult allow (nem fed semmit)": `// gate-subject-allow: régen itt egy vak első sor volt, már nincs\nconst p = await db.selectFrom("partner").select("id").where("id", "=", pid).executeTakeFirst();\n`,
};

const MAIN = process.argv[1] !== undefined && path.resolve(process.argv[1]) === import.meta.filename;

if (MAIN && SELF_TEST) {
  let ok = true;
  const dir = mkdtempSync(path.join(tmpdir(), "cit-gate-subject-"));
  try {
    const clean = audit(CLEAN);
    if (clean.findings.length) {
      ok = false;
      console.log(`⛔ a TISZTA fixture pirosra ment: ${clean.findings.map((f) => `${f.rule}@${f.line}`).join(" · ")}`);
    } else if (clean.allows.length !== 2) {
      ok = false;
      console.log(`⛔ a tiszta fixture allow-száma ${clean.allows.length} (2 várt)`);
    } else console.log("✅ tiszta fixture: zöld (saját kulcs · kimondott predikátum + hangos bukás · having · aggregátum · komment · sablon-szöveg · osztásjel · predikátumos változó), 2 indokolt kivétel (egysoros + többsoros utasítás fölött)");

    for (const [name, src] of Object.entries(RED)) {
      const r = audit(src);
      const red = r.findings.length > 0;
      console.log(`${red ? "✅ piros, ahogy kell" : "⛔ ZÖLD MARADT"} — ${name}${red ? ` (${r.findings[0].rule})` : ""}`);
      if (!red) ok = false;
    }

    // Negative control, end to end: a deliberately blind fixture GATE on disk, through the CLI's
    // --probe path (the same report/exit code the pre-commit sees) — must exit 1.
    const blind = path.join(dir, "blind-subject-check.mts");
    writeFileSync(blind, `// a fixture gate that measures whatever row comes first\nconst { db } = await import("../src/db/client.js");\nconst lead = await db.selectFrom("lead").select("id").limit(1).executeTakeFirst();\nconsole.log(lead ? "PASS" : "SKIP");\n`);
    const cli = spawnSync(process.execPath, [...process.execArgv, import.meta.filename, "--probe", blind], { encoding: "utf8" });
    const cliRed = cli.status === 1 && /①/.test(cli.stdout);
    console.log(`${cliRed ? "✅" : "⛔"} negatív kontroll (vak limit(1)-es fixture-kapu a CLI-n át): exit ${cli.status}${cliRed ? "" : ` — ${cli.stdout.slice(-300)}${cli.stderr.slice(-300)}`}`);
    if (!cliRed) ok = false;

    // Negative control, historical: the photo-normalize-check BEFORE d3daca69 was the measured case.
    try {
      const before = execFileSync("git", ["-C", ROOT, "show", "d3daca69^:scripts/photo-normalize-check.mts"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      const h = audit(before);
      const hRed = h.findings.some((f) => f.rule.includes('"tenant_user"'));
      console.log(`${hRed ? "✅" : "⛔"} történeti kontroll (photo-normalize-check a d3daca69 javítás ELŐTT): ${hRed ? `piros — ${h.findings[0].rule}@${h.findings[0].line}` : "ZÖLD — a felismerő nem látja a mért esetet"}`);
      if (!hRed) ok = false;
      const after = audit(execFileSync("git", ["-C", ROOT, "show", "d3daca69:scripts/photo-normalize-check.mts"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
      console.log(`${after.findings.length ? "⛔" : "✅"} történeti kontroll (ugyanaz a javítás UTÁN, having-predikátum + hangos bukás): ${after.findings.length ? "piros" : "zöld"}`);
      if (after.findings.length) ok = false;
    } catch {
      // a shallow clone has no such commit — say so, never skip silently
      console.log("⚠️ történeti kontroll KIHAGYVA: a d3daca69 commit nem olvasható ebben a klónban (a szintetikus + CLI-kontroll lefutott)");
    }

    // Scope post-condition: every hooked script is scanned (a narrow extension filter once hid two gates).
    const { files, hooked } = scope(ROOT);
    const missing = hooked.filter((h) => !files.includes(h));
    console.log(`${missing.length ? "⛔" : "✅"} hatókör: ${files.length} fájl, ebből ${hooked.length} horog-futtatott — ${missing.length ? `KIMARADT: ${missing.join(", ")}` : "mind benne"}`);
    if (missing.length) ok = false;
    const tsHooked = hooked.filter((h) => h.endsWith(".ts"));
    if (!tsHooked.length) {
      ok = false;
      console.log("⛔ hatókör: egyetlen .ts horog-szkript sem került a körbe — a kiterjesztés-felismerő elavult (ma legalább kettő van)");
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  if (!ok) {
    console.log("⛔ gate-subject-check ÖNTESZT: legalább egy visszarontás ZÖLD maradt vagy a tiszta eset piros — az őr vak vagy túlérzékeny.");
    process.exit(1);
  }
  console.log(`✅ gate-subject-check önteszt: mind a ${Object.keys(RED).length} sértés + a CLI- és a történeti kontroll pirosat adott, a tiszta fixture zöld.`);
  process.exit(0);
}

if (MAIN && PROBE) {
  let all = true;
  for (const rel of PROBE) all = report(rel, readFileSync(path.resolve(ROOT, rel), "utf8"), false).ok && all;
  process.exit(all ? 0 : 1);
}

if (MAIN) {
const { files, hooked } = scope(ROOT);
let all = true;
let allowCount = 0;
let allowFiles = 0;
for (const rel of files) {
  const r = report(rel, readFileSync(path.join(ROOT, rel), "utf8"), true);
  all = r.ok && all;
  allowCount += r.allows;
  if (r.allows) allowFiles++;
}
if (!all) {
  console.log("⛔ gate-subject-check: kapu a közös dev-DB vak „első sorával” mér — válassz kimondott predikátummal (+ hangos ELŐFELTÉTEL-bukás), saját fixture-rel, vagy indokold: // gate-subject-allow: <indok>");
  process.exit(1);
}
console.log(`✅ gate-subject-check: ${files.length} fájl (${hooked.length} horog-futtatott) — nincs vak „első sor”; ${allowCount} indokolt kivétel ${allowFiles} fájlban.`);
}
