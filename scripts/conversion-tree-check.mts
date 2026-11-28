// Guard: the conversion tree's doc and its code module say the same thing (ADR-0510).
//
// The tree's words live in _planning/DOMAIN/07-CONVERSION-TREE.md (§B spine, §C causes and levers —
// the owner edits it with the coordinator) and the console reads them from ONE module,
// src/console/conversionTree.ts. Two copies drift silently: a lever added to the doc never reaches the
// Riport, a cause renamed in code no longer matches what the owner agreed to. This check parses the
// doc and compares, both directions:
//   ① §B: every state number 0–10 exists in both, and the doc's state name starts with the module's `doc`;
//   ② §C: per transition the same causes (kind igazolt/feltevés + the cause text the doc starts with),
//      in the same order, and per cause the same levers (verbatim, after „Kar:”, split on „;”);
//   ③ the transition's parenthesised label, when the doc has one, equals the module's `docLabel`;
//   ④ lever ids are unique (conversion_task.lever_id points at them).
//
// Run:        npx tsx scripts/conversion-tree-check.mts
// Self-test:  npx tsx scripts/conversion-tree-check.mts --self-test   (each drift class must go red)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { TREE_STATES, TREE_TRANSITIONS, type TreeState, type TreeTransition } from "../src/console/conversionTree.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DOC = "_planning/DOMAIN/07-CONVERSION-TREE.md";

interface DocCause { kind: "igazolt" | "felteves"; text: string; levers: string[] }
interface DocTransition { key: string; label: string | null; causes: DocCause[] }
interface ParsedDoc { states: Map<number, string>; transitions: Map<string, DocTransition> }

function section(md: string, letter: string): string {
  const start = md.search(new RegExp(`^## ${letter}\\. `, "m"));
  if (start < 0) return "";
  const rest = md.slice(start + 3);
  const end = rest.search(/^## /m);
  return end < 0 ? rest : rest.slice(0, end);
}

export function parseDoc(md: string): ParsedDoc {
  const states = new Map<number, string>();
  for (const line of section(md, "B").split("\n")) {
    const m = /^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|/.exec(line);
    if (m) states.set(Number(m[1]), m[2]!);
  }
  const transitions = new Map<string, DocTransition>();
  let cur: DocTransition | null = null;
  let buf = "";
  const flush = (): void => {
    if (!cur) return;
    const text = buf.replace(/\s+/g, " ").trim();
    // Split on every cause marker; the text before the first one is the heading tail.
    const parts = text.split(/Ok · (igazolt|feltevés) — /).slice(1);
    for (let i = 0; i + 1 < parts.length; i += 2) {
      const kind = parts[i] === "igazolt" ? "igazolt" : "felteves";
      let body = parts[i + 1]!.trim().replace(/^-\s*/, "").replace(/\s*-\s*$/, "");
      const k = body.indexOf("Kar:");
      const causeText = (k < 0 ? body : body.slice(0, k)).trim();
      const levers = k < 0
        ? []
        : body.slice(k + 4).split(";").map((s) => s.trim().replace(/\.$/, "").trim()).filter(Boolean);
      body = causeText;
      cur.causes.push({ kind, text: body, levers });
    }
    transitions.set(cur.key, cur);
  };
  for (const line of section(md, "C").split("\n")) {
    // "**6 → 7 (label) — a legnagyobb esés**" — a remark may follow the label inside the bold.
    const h = /^\*\*(\d+) → (\d+)(?: \(([^)]*)\))?[^*]*\*\*(.*)$/.exec(line);
    if (h) {
      flush();
      cur = { key: `${h[1]}-${h[2]}`, label: h[3] ?? null, causes: [] };
      buf = h[4] ?? "";
      continue;
    }
    if (cur) buf += "\n" + line.replace(/^- /, " - ");
  }
  flush();
  return { states, transitions };
}

/** The doc text starts with `prefix` and the prefix ends on a word boundary. */
function startsAt(text: string, prefix: string): boolean {
  if (!text.startsWith(prefix)) return false;
  const next = text.charAt(prefix.length);
  return next === "" || !/[\p{L}\p{N}]/u.test(next);
}

export function compare(doc: ParsedDoc, states: readonly TreeState[], transitions: readonly TreeTransition[]): string[] {
  const errs: string[] = [];
  // ① spine
  const modN = new Set(states.map((s) => s.n));
  for (const s of states) {
    const d = doc.states.get(s.n);
    if (d === undefined) errs.push(`§B: a ${s.n}. állapot a modulban van, a doksiban nincs`);
    else if (!startsAt(d, s.doc)) errs.push(`§B: a ${s.n}. állapot neve eltér — doksi: „${d}”, modul: „${s.doc}”`);
  }
  for (const n of doc.states.keys()) if (!modN.has(n)) errs.push(`§B: a ${n}. állapot a doksiban van, a modulban nincs`);
  // ②③ transitions
  const modKeys = new Set(transitions.map((t) => t.key));
  for (const k of doc.transitions.keys()) if (!modKeys.has(k)) errs.push(`§C: a ${k} átmenet a doksiban van, a modulban nincs`);
  for (const t of transitions) {
    const d = doc.transitions.get(t.key);
    if (!d) { errs.push(`§C: a ${t.key} átmenet a modulban van, a doksiban nincs`); continue; }
    if (d.label !== null && d.label !== t.docLabel) errs.push(`§C ${t.key}: a címke eltér — doksi: „${d.label}”, modul: „${t.docLabel ?? "—"}”`);
    if (d.label === null && t.docLabel !== null) errs.push(`§C ${t.key}: a modul címkét vár („${t.docLabel}”), a doksi fejlécében nincs`);
    if (d.causes.length !== t.causes.length) {
      errs.push(`§C ${t.key}: az okok száma eltér — doksi ${d.causes.length}, modul ${t.causes.length}`);
      continue;
    }
    t.causes.forEach((c, i) => {
      const dc = d.causes[i]!;
      if (dc.kind !== c.kind) errs.push(`§C ${t.key} „${c.title}”: a jelölés eltér — doksi ${dc.kind}, modul ${c.kind}`);
      if (!startsAt(dc.text, c.doc)) errs.push(`§C ${t.key}: az ok szövege eltér — doksi: „${dc.text}”, modul: „${c.doc}”`);
      const ml = c.levers.map((l) => l.doc);
      if (ml.length !== dc.levers.length || ml.some((x, j) => x !== dc.levers[j]))
        errs.push(`§C ${t.key} „${c.title}”: a karok eltérnek — doksi: [${dc.levers.join(" | ")}], modul: [${ml.join(" | ")}]`);
    });
  }
  // ④ lever ids
  const seen = new Set<string>();
  for (const t of transitions) for (const c of t.causes) for (const l of c.levers) {
    if (seen.has(l.id)) errs.push(`kar-azonosító kétszer: ${l.id}`);
    seen.add(l.id);
  }
  return errs;
}

function selfTest(md: string): void {
  const doc = parseDoc(md);
  const base = compare(doc, TREE_STATES, TREE_TRANSITIONS);
  if (base.length) throw new Error(`önteszt: a kiinduló állapot már piros:\n${base.join("\n")}`);
  const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
  const cases: { name: string; run: () => string[] }[] = [
    { name: "kar a doksiban, a modulban nincs", run: () => compare(parseDoc(md.replace("Kar: kiküldési óra.", "Kar: kiküldési óra; új kar.")), TREE_STATES, TREE_TRANSITIONS) },
    { name: "ok átírva a modulban", run: () => { const t = clone(TREE_TRANSITIONS) as TreeTransition[]; (t[1]!.causes[0] as { doc: string }).doc = "Halott postafiók"; return compare(doc, TREE_STATES, t); } },
    { name: "jelölés átírva a doksiban", run: () => compare(parseDoc(md.replace("Ok · igazolt — Rossz nyitókép", "Ok · feltevés — Rossz nyitókép")), TREE_STATES, TREE_TRANSITIONS) },
    { name: "ok törölve a doksiból", run: () => compare(parseDoc(md.replace(/- Ok · feltevés — Nem ismeri fel a saját szállását\.\n/, "")), TREE_STATES, TREE_TRANSITIONS) },
    { name: "állapot átnevezve", run: () => compare(parseDoc(md.replace("| 6 | Végignézte |", "| 6 | Átgörgette |")), TREE_STATES, TREE_TRANSITIONS) },
    { name: "kar-azonosító kétszer", run: () => { const t = clone(TREE_TRANSITIONS) as TreeTransition[]; (t[2]!.causes[0]!.levers[0] as { id: string }).id = "bounce"; return compare(doc, TREE_STATES, t); } },
  ];
  for (const c of cases) {
    const errs = c.run();
    if (!errs.length) throw new Error(`önteszt: „${c.name}” NEM ment pirosra`);
    console.log(`  ✓ piros, ahogy kell: ${c.name} → ${errs[0]}`);
  }
  console.log(`✅ conversion-tree-check önteszt: ${cases.length}/${cases.length} eltérés-osztály piros`);
}

const md = readFileSync(resolve(ROOT, DOC), "utf8");
if (process.argv.includes("--self-test")) {
  selfTest(md);
} else {
  const errs = compare(parseDoc(md), TREE_STATES, TREE_TRANSITIONS);
  if (errs.length) {
    console.error(`⛔ conversion-tree-check: a ${DOC} és a src/console/conversionTree.ts eltér (${errs.length}):`);
    for (const e of errs) console.error(`   · ${e}`);
    console.error(`   Javítás: a kettőt egyszerre írd át (a doksi a forrás, a modul a konzol szövege mellett a doksi szavait is hordozza).`);
    process.exit(1);
  }
  console.log(`✅ conversion-tree-check: a fa doksija és modulja egyezik (${TREE_STATES.length} állapot, ${TREE_TRANSITIONS.reduce((a, t) => a + t.causes.length, 0)} ok, ${TREE_TRANSITIONS.reduce((a, t) => a + t.causes.reduce((b, c) => b + c.levers.length, 0), 0)} kar)`);
}
