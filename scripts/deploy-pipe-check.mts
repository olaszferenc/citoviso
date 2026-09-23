// DEPLOY-PIPE guard — a blokkoló deploy-kapu tudjon is bukni.
//
//   npx tsx scripts/deploy-pipe-check.mts [--self-test]
//
// ⛔ MÉRVE 2026-09-23, az ÉLES gépen: `ssh … "sh -c 'exit 1' 2>&1 | tail -12"` → rc 0;
// ugyanez `set -o pipefail;`-lel → rc 1. Egy csővezeték kilépési kódja az UTOLSÓ tagé,
// tehát a `$SSH "… | tail" || fail` alakú kapu SOHA nem bukik. A `deploy-prod.sh`-ban így
// volt néma a pg_dump (üres mentés a migráció előtt), a db:migrate (restart egy bukott
// migráció után), az npm install és a fordítás-kapu (GATE 5/5b) — utóbbit ráadásul aznap
// reggel tettük a súgó-fordítás EGYETLEN kényszerévé (ADR-0207 módosítás).
//
// A szabály: minden BLOKKOLÓ utasítás (`|| fail`) csővezetéke hordozza a pipefailt —
//   · TÁVOLI (`$SSH "… | …"`): a távoli parancs `set -o pipefail;`-lel indul;
//   · HELYI  (`$SSH "…" | sort …`): egy `( set -o pipefail … ) || fail` alhéjban fut.
// A tájékoztató sorok (`|| true`, `$(…)`-ba fogott kimenet) szándékosan kimaradnak: ott
// a maszkolás nem hamis zöld, hanem vállalt „nem fatális".
//
// HERMETIKUS: csak a szkript szövegét olvassa. --self-test: szintetikus sorokon bizonyítja,
// hogy a felismerő pirosra tud menni és a helyes alakot átengedi.

import { readFileSync } from "node:fs";

const PIPE = /(^|[^|])\|([^|]|$)/; // a single `|`, not `||`

/** The first double-quoted argument after `$SSH`, honoring `\"` escapes. */
function remoteCmd(stmt: string): { body: string; after: string } | null {
  const i = stmt.indexOf('$SSH "');
  if (i < 0) return null;
  let j = i + 6;
  let body = "";
  while (j < stmt.length) {
    const c = stmt[j]!;
    if (c === "\\" && j + 1 < stmt.length) {
      body += c + stmt[j + 1];
      j += 2;
      continue;
    }
    if (c === '"') break;
    body += c;
    j++;
  }
  return { body, after: stmt.slice(j + 1) };
}

export function violations(script: string): string[] {
  // Join backslash-continuations into logical statements, keeping the first line number.
  const raw = script.split("\n");
  const stmts: { line: number; text: string; inBlock: boolean; blockBlocking: boolean }[] = [];
  let buf = "";
  let start = 0;
  let inBlock = false;
  let blockStmts: typeof stmts = [];
  for (let n = 0; n < raw.length; n++) {
    const l = raw[n]!;
    if (!buf) start = n + 1;
    if (/^\s*#/.test(l) && !buf) continue;
    if (/^\s*\(\s*set -o pipefail\s*$/.test(l)) {
      inBlock = true;
      blockStmts = [];
      continue;
    }
    if (inBlock && /^\s*\)/.test(l)) {
      const blocking = /\|\|\s*fail\b/.test(l);
      for (const s of blockStmts) s.blockBlocking = blocking;
      inBlock = false;
      continue;
    }
    if (/\\\s*$/.test(l)) {
      buf += l.replace(/\\\s*$/, " ");
      continue;
    }
    const text = buf + l;
    buf = "";
    const s = { line: start, text, inBlock, blockBlocking: false };
    stmts.push(s);
    if (inBlock) blockStmts.push(s);
  }

  const bad: string[] = [];
  for (const s of stmts) {
    const blocking = /\|\|\s*fail\b/.test(s.text) || s.blockBlocking;
    if (!blocking) continue;
    const r = remoteCmd(s.text);
    if (!r) continue;
    if (PIPE.test(r.body) && !/^\s*set -o pipefail;/.test(r.body)) {
      bad.push(
        `${s.line}. sor: TÁVOLI csővezeték pipefail nélkül — a kapu a TAIL kilépési kódját látja, ` +
          `sosem bukik. Javítás: $SSH "set -o pipefail; …"`,
      );
    }
    const local = r.after.split(/\|\|/)[0] ?? "";
    if (PIPE.test(local) && !s.inBlock) {
      bad.push(
        `${s.line}. sor: HELYI csővezeték a $SSH után pipefail nélkül — ha az ssh bukik, a ` +
          `következő tag (pl. sort) 0-val zár. Javítás: ( set -o pipefail … ) || fail`,
      );
    }
  }
  return bad;
}

if (process.argv.includes("--self-test")) {
  const cases: ReadonlyArray<{ why: string; src: string; want: number }> = [
    { why: "TÖRTÉNETI hiba: távoli | tail + || fail", src: `$SSH "cd x && npm run db:migrate 2>&1 | tail -8" </dev/null || fail "m"`, want: 1 },
    { why: "helyes: távoli pipefail-lel", src: `$SSH "set -o pipefail; cd x && npm run db:migrate 2>&1 | tail -8" </dev/null || fail "m"`, want: 0 },
    { why: "folytatott sor is blokkoló", src: `$SSH "npx tsx a.mts 2>&1 | tail -12" </dev/null \\\n    || fail "x"`, want: 1 },
    { why: "tájékoztató (|| true) kimarad", src: `X="$($SSH "git status | head -5" </dev/null || true)"`, want: 0 },
    { why: "|| a távoli parancsban nem cső", src: `$SSH "test -d b || (git init -q b)" </dev/null || fail "b"`, want: 0 },
    { why: "TÖRTÉNETI hiba: helyi | sort + || fail", src: `$SSH "psql -c 'q'" </dev/null | sort > f \\\n  || fail "s"`, want: 1 },
    { why: "helyes: helyi pipefail-alhéjban", src: `( set -o pipefail\n  $SSH "psql -c 'q'" </dev/null | sort > f\n) || fail "s"`, want: 0 },
    { why: "escape-elt idézőjel a távoli parancsban", src: `$SSH "psql -c \\"select 1\\" | tail -1" </dev/null || fail "p"`, want: 1 },
  ];
  let bad = 0;
  for (const c of cases) {
    const got = violations(c.src).length;
    const ok = got === c.want;
    if (!ok) bad++;
    console.log(`  ${ok ? "✅" : "⛔"} ${c.why} → ${got} sértés (várt: ${c.want})`);
  }
  if (bad) {
    console.error(`\n❌ deploy-pipe-check önteszt: ${bad} eset nem a várt eredményt adta.`);
    process.exit(1);
  }
  console.log(`\n✅ deploy-pipe-check önteszt: ${cases.length} eset — a felismerő pirosra megy, a helyes alakot átengedi.`);
  process.exit(0);
}

const src = readFileSync(new URL("./deploy-prod.sh", import.meta.url), "utf8");
const found = violations(src);
// Recognizer sanity: the script DOES contain blocking remote pipelines — if we see none,
// the parser broke, and "0 violations" would be a false green.
const measured = src.split("\n").filter((l) => /set -o pipefail;/.test(l) && /\$SSH "/.test(l)).length;
if (measured === 0) {
  console.error("⛔ deploy-pipe-check: egyetlen pipefail-es távoli kaput sem találtam — a felismerő romlott el, a 0 sértés nem hihető.");
  process.exit(1);
}
if (found.length) {
  for (const f of found) console.error(`  ⛔ ${f}`);
  console.error(`\n❌ deploy-pipe-check: ${found.length} blokkoló kapu nem tud bukni.`);
  process.exit(1);
}
console.log(`✅ deploy-pipe-check: minden blokkoló deploy-csővezeték pipefail-lel fut (${measured} távoli kapu mérve).`);
