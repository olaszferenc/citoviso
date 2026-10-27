// babel-pack — Bábel's own workbench (ADR-0411, ADR-XXXX, babel/charter/RUNBOOK.md).
//
// ⛔ Translation is spent ONLY from Bábel's subscription session — never from the API credit
// (owner, 2026-10-27). He reads the ontology and the glossary once, and translates a WHOLE
// pack as one consistent piece of work. This tool is the hand-off between that session and
// the committed seeds the deploy applies (it never calls a model):
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
//               `i18n-pack-status --ensure` overlays it on the live pack. What the seed
//               leaves open stays Hungarian. No production DB write by hand.
//       --apply writes the DB the env points at (merge) — dev only, to see it on :4600.
//   audit <lang> [--limit 40]
//       glossary consistency of the CURRENT pack: strings whose Hungarian contains a
//       single-sense glossary term but whose translation does not contain the glossary form.
//       A list to review, not a verdict (inflection can hide a correct form).
//   glossary <lang>
//       the binding glossary column for <lang> — read it before translating.
//   kb-export <lang> [--all] [--out dir]
//       the help entries to translate (default: missing or stale for <lang>): one
//       <entry-id>.json per entry {id, source_hash, title, body, most?} into --out (default
//       stdout as one JSON array). Rules: the **„…”** labels stay Hungarian VERBATIM, image
//       paths unchanged, same number of "## " headings.
//   kb-import <lang> <file.json|dir> [--seed]
//       {id, source_hash, title, body} back (one file or a directory of them); the source
//       hash must match the CURRENT Hungarian entry and the structure must survive
//       (kbTranslationValid). --seed writes src/i18n/babel/kb/<lang>/<id>.json.
//   site-export <site-id> <lang> [--out file.json]
//       a paid multilingual site's copy (ADR-0063) that has no committed translation yet →
//       JSON [{hu}]. Reads the site from the DB the env points at — for a production site
//       run it ON the production box (read-only).
//   site-import <site-id> <lang> <file.json> [--seed]
//       {hu: translation} back; numbers must survive (§B.17 digit integrity); --seed writes
//       src/i18n/babel/sites/<site-id>/<lang>.json, which the paid generation reads.
//
//   npx tsx scripts/babel-pack.mts export sl --out ~/babel/munka/sl-hianyzo.json
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sql } from "kysely";

import { glossaryFor, glossaryTerms, surfaceOf } from "../src/i18n/babel.js";
import { kbCoverage, kbSeeds, kbSourceHash, kbTranslationValid, translatableKbEntries } from "../src/i18n/kbPacks.js";
import { DEFAULT_LANG } from "../src/i18n/lang.js";
import { babelSeed, loadCatalog, loadPack, placeholderProblem } from "../src/i18n/packs.js";
import { db } from "../src/db/client.js";
import { collectTranslatableStrings } from "../src/tenant/multilangCore.js";
import { babelSiteSeedPath } from "../src/tenant/multilangGenerate.js";
import { effectiveSiteForMultilang } from "../src/tenant/editor.js";

const [cmd, lang, ...rest] = process.argv.slice(2);
const flag = (name: string): boolean => rest.includes(name);
const opt = (name: string): string | undefined => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};

function usage(): never {
  console.error("használat: babel-pack.mts export|import|audit|glossary|kb-export|kb-import <lang> … | site-export|site-import <site-id> <lang> … (lásd a fejlécet)");
  process.exit(2);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const digits = (x: string): string => (x.match(/\d+/g) ?? []).join("|");

if (cmd === "site-export" || cmd === "site-import") {
  // `lang` holds the site id here; the language is the next argument.
  const siteId = lang;
  const siteLang = rest.find((a) => !a.startsWith("--"));
  if (!siteId || !siteLang || siteLang === DEFAULT_LANG) usage();
  const row = await db.selectFrom("site").select(["tenant_id"]).where("id", "=", siteId).executeTakeFirst();
  if (!row) {
    console.error(`nincs ilyen site: ${siteId}`);
    process.exit(2);
  }
  const site = await effectiveSiteForMultilang(row.tenant_id);
  if (!site) {
    console.error(`a site nem renderelhető (nincs recipe/siteData): ${siteId}`);
    process.exit(2);
  }
  const sources = collectTranslatableStrings(site.effective, site.units, site.site.recipe);
  const seedPath = babelSiteSeedPath(siteId, siteLang);
  let seed: Record<string, string> = {};
  try {
    seed = JSON.parse(readFileSync(seedPath, "utf8")) as Record<string, string>;
  } catch {
    seed = {};
  }
  if (cmd === "site-export") {
    const rows = sources.filter((hu) => flag("--all") || !seed[hu]).map((hu) => ({ hu, ...(seed[hu] ? { most: seed[hu] } : {}) }));
    const json = JSON.stringify(rows, null, 1) + "\n";
    const out = opt("--out");
    if (out) {
      writeFileSync(out, json, "utf8");
      console.log(`${rows.length} szöveg → ${out} (felület: honlap, a vendég olvassa; tényt, számot, nevet nem változtatsz)`);
    } else process.stdout.write(json);
  } else {
    const file = rest.filter((a) => !a.startsWith("--"))[1];
    if (!file) usage();
    const incoming = JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;
    const known = new Set(sources);
    const ok: Record<string, string> = {};
    let refused = 0;
    for (const [hu, tr] of Object.entries(incoming)) {
      const problem = !known.has(hu)
        ? "nincs a site szövegei között"
        : typeof tr !== "string" || !tr.trim()
          ? "üres fordítás"
          : digits(hu) !== digits(tr)
            ? "szám-eltérés (§B.17)"
            : null;
      if (problem) {
        refused++;
        console.error(`  ✗ "${hu.slice(0, 60)}" — ${problem}`);
        continue;
      }
      ok[hu] = tr;
    }
    const merged = { ...seed, ...ok };
    const left = sources.filter((hu) => !merged[hu]).length;
    console.log(`${siteId}/${siteLang}: ${Object.keys(ok).length} elfogadva, ${refused} elutasítva; utána hiányzik: ${left}/${sources.length}`);
    if (flag("--seed")) {
      mkdirSync(path.dirname(seedPath), { recursive: true });
      writeFileSync(seedPath, JSON.stringify(merged, null, 1) + "\n", "utf8");
      console.log(`✅ ${path.relative(ROOT, seedPath)} (commit + land → deploy; a fizetett generálás ezt olvassa).`);
    } else console.log("(száraz futás — a maghoz: --seed)");
    if (refused) process.exitCode = 1;
  }
  await db.destroy();
  process.exit();
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
} else if (cmd === "glossary") {
  process.stdout.write(glossaryFor(lang) + "\n");
} else if (cmd === "kb-export") {
  const seeds = kbSeeds(lang);
  const rows0 = await db.selectFrom("kb_translation").select(["entry_id", "source_hash", "title", "body_md"]).where("lang", "=", lang).execute();
  const have = new Map(rows0.map((r) => [r.entry_id, r]));
  const rows = translatableKbEntries()
    .filter((e) => {
      if (flag("--all")) return true;
      const h = kbSourceHash(e);
      return have.get(e.id)?.source_hash !== h && seeds[e.id]?.source_hash !== h;
    })
    .map((e) => {
      const cur = have.get(e.id);
      return { id: e.id, source_hash: kbSourceHash(e), title: e.title, body: e.body, ...(cur ? { most: { title: cur.title, body: cur.body_md } } : {}) };
    });
  const out = opt("--out");
  if (out) {
    mkdirSync(out, { recursive: true });
    for (const r of rows) writeFileSync(path.join(out, `${r.id}.json`), JSON.stringify(r, null, 1) + "\n", "utf8");
    console.log(`${rows.length} súgó-cikk → ${out}/ (a **„…”** feliratok magyarul, betűre maradnak)`);
  } else process.stdout.write(JSON.stringify(rows, null, 1) + "\n");
} else if (cmd === "kb-import") {
  const src = rest.find((a) => !a.startsWith("--"));
  if (!src) usage();
  const files = statSync(src).isDirectory()
    ? readdirSync(src).filter((f) => f.endsWith(".json")).map((f) => path.join(src, f))
    : [src];
  const entries = new Map(translatableKbEntries().map((e) => [e.id, e]));
  let accepted = 0;
  let refused = 0;
  for (const f of files) {
    const t = JSON.parse(readFileSync(f, "utf8")) as { id?: string; source_hash?: string; title?: string; body?: string };
    const entry = t.id ? entries.get(t.id) : undefined;
    const problem = !entry
      ? "ismeretlen (vagy nem tenant-) cikk"
      : t.source_hash !== kbSourceHash(entry)
        ? "elavult: a magyar forrás azóta változott — exportáld újra"
        : !t.title?.trim()
          ? "üres cím"
          : !t.body || !kbTranslationValid(entry.body, t.body)
            ? "integritás-sértés (felirat / kép-útvonal / alcím-szám)"
            : null;
    if (problem) {
      refused++;
      console.error(`  ✗ ${path.basename(f)} — ${problem}`);
      continue;
    }
    accepted++;
    if (flag("--seed")) {
      const dir = path.join(ROOT, "src/i18n/babel/kb", lang);
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        path.join(dir, `${t.id}.json`),
        JSON.stringify({ source_hash: t.source_hash, title: t.title!.trim(), body: t.body }, null, 1) + "\n",
        "utf8",
      );
    }
  }
  const cov = await kbCoverage(lang);
  console.log(`${lang}: ${accepted} cikk elfogadva, ${refused} elutasítva (a DB-ben most friss: ${cov.total - cov.missing}/${cov.total})`);
  console.log(flag("--seed") ? `✅ src/i18n/babel/kb/${lang}/ (commit + land → deploy)` : "(száraz futás — a maghoz: --seed)");
  if (refused) process.exitCode = 1;
} else usage();

await db.destroy();
