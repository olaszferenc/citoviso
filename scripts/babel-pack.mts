// babel-pack — Bábel's own workbench for a language pack (ADR-0411, babel/charter/RUNBOOK.md).
//
// Bábel the persona translates in his own session (subscription, not the API): he reads the
// ontology and the glossary once, and translates a WHOLE pack as one consistent piece of
// work. This tool is the hand-off between that session and the `language_pack` table:
//
//   export <lang> [--all] [--surface konzol] [--out file.json]
//       the strings to translate (default: the ones missing from the pack), each with its
//       surface and the current translation if any → JSON [{hu, felulet, most?}]
//   import <lang> <file.json> [--seed | --apply]
//       a {hu: translation} map back. Every entry passes the SAME placeholder contract as
//       the engine (placeholderProblem); unknown keys (not in the catalogue) are refused.
//       DRY RUN by default: prints what would change.
//       --seed  (THE NORMAL PATH) merges into src/i18n/babel/packs/<lang>.json — Bábel's
//               committed pack. It ships as a VERSION (land → deploy); the deploy's
//               `i18n-pack-status --ensure` overlays it on the live pack, and the API only
//               fills what it leaves open. No production DB write by hand.
//       --apply writes the DB the env points at (merge) — dev only, to see it on :4600.
//   audit <lang> [--limit 40]
//       glossary consistency of the CURRENT pack: strings whose Hungarian contains a
//       single-sense glossary term but whose translation does not contain the glossary form.
//       A list to review, not a verdict (inflection can hide a correct form).
//
//   npx tsx scripts/babel-pack.mts export sl --out ~/babel/munka/sl-hianyzo.json
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sql } from "kysely";

import { glossaryTerms, surfaceOf } from "../src/i18n/babel.js";
import { DEFAULT_LANG } from "../src/i18n/lang.js";
import { babelSeed, loadCatalog, loadPack, placeholderProblem } from "../src/i18n/packs.js";
import { db } from "../src/db/client.js";

const [cmd, lang, ...rest] = process.argv.slice(2);
const flag = (name: string): boolean => rest.includes(name);
const opt = (name: string): string | undefined => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};

function usage(): never {
  console.error("használat: babel-pack.mts export|import|audit <lang> … (lásd a fejlécet)");
  process.exit(2);
}

if (!cmd || !lang || lang === DEFAULT_LANG) usage();

const catalog = await loadCatalog();
const pack = (await loadPack(lang)) ?? {};

if (cmd === "export") {
  const surface = opt("--surface");
  const rows = catalog
    .filter((hu) => flag("--all") || !pack[hu])
    .filter((hu) => !surface || surfaceOf(hu).split("+").includes(surface))
    .map((hu) => ({ hu, felulet: surfaceOf(hu), ...(pack[hu] ? { most: pack[hu] } : {}) }))
    .sort((a, b) => a.felulet.localeCompare(b.felulet));
  const json = JSON.stringify(rows, null, 1) + "\n";
  const out = opt("--out");
  if (out) {
    writeFileSync(out, json, "utf8");
    console.log(`${rows.length} string → ${out}`);
  } else process.stdout.write(json);
} else if (cmd === "import") {
  const file = rest.find((a) => !a.startsWith("--"));
  if (!file) usage();
  const incoming = JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;
  const known = new Set(catalog);
  const ok: Record<string, string> = {};
  let refused = 0;
  let changed = 0;
  for (const [hu, tr] of Object.entries(incoming)) {
    if (!known.has(hu)) {
      refused++;
      console.error(`  ✗ nincs a katalógusban: "${hu}"`);
      continue;
    }
    const problem = typeof tr === "string" && tr.trim() ? placeholderProblem(hu, tr) : "üres fordítás";
    if (problem) {
      refused++;
      console.error(`  ✗ "${hu}" — ${problem}`);
      continue;
    }
    if (pack[hu] !== tr) changed++;
    ok[hu] = tr;
  }
  const merged = { ...pack, ...ok };
  const missingAfter = catalog.filter((s) => !merged[s]).length;
  console.log(
    `${lang}: ${Object.keys(ok).length} elfogadva (${changed} új/változott), ${refused} elutasítva; ` +
      `utána hiányzik: ${missingAfter}/${catalog.length}`,
  );
  if (flag("--seed")) {
    const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/i18n/babel/packs");
    mkdirSync(dir, { recursive: true });
    const seed = { ...babelSeed(lang), ...ok };
    const sorted = Object.fromEntries(Object.entries(seed).sort(([a], [b]) => a.localeCompare(b, "hu")));
    writeFileSync(path.join(dir, `${lang}.json`), JSON.stringify(sorted, null, 1) + "\n", "utf8");
    console.log(`✅ Bábel-mag: src/i18n/babel/packs/${lang}.json — ${Object.keys(sorted).length} string (commit + land → a deploy alkalmazza).`);
  } else if (flag("--apply")) {
    await db
      .insertInto("language_pack")
      .values({ lang, strings: JSON.stringify(merged) as never, status: "generated" })
      .onConflict((oc) => oc.column("lang").doUpdateSet({ strings: JSON.stringify(merged) as never, updated_at: sql`now()` }))
      .execute();
    console.log("✅ beírva a language_pack táblába (a futó szerverek a következő újraindításkor töltik be).");
  } else console.log("(száraz futás — a maghoz: --seed; dev DB-be: --apply)");
  if (refused) process.exitCode = 1;
} else if (cmd === "audit") {
  const limit = Number(opt("--limit") ?? 40);
  let hits = 0;
  for (const t of glossaryTerms()) {
    const form = t.tr?.[lang];
    if (!form || t.senses?.length) continue; // multi-sense terms need the surface — human review
    const huRe = new RegExp(`(^|[^\\p{L}])${t.hu.slice(0, Math.max(4, t.hu.length - 2))}`, "iu");
    const stem = form.toLowerCase().slice(0, Math.max(4, form.length - 2));
    const off = catalog.filter((hu) => pack[hu] && huRe.test(hu) && !pack[hu]!.toLowerCase().includes(stem));
    if (!off.length) continue;
    hits += off.length;
    console.log(`\n„${t.hu}” → ${form}: ${off.length} eltérő`);
    for (const hu of off.slice(0, limit)) console.log(`  [${surfaceOf(hu)}] ${hu}  →  ${pack[hu]}`);
  }
  console.log(`\n${lang}: ${hits} átnézendő sor (ragozás elrejthet helyes formát — ez lista, nem ítélet).`);
} else usage();

await db.destroy();
