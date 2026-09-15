// ADR-0036 catalog extractor: collects every T(d, "…") / tr("…") source string from the
// template sources + client runtime JS into src/i18n/catalog.json. The catalog is the
// coverage contract the pack guard (ensureLanguagePack) checks translations against.
//   npx tsx scripts/extract-i18n.mts
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

// ⛔ ONE list, imported by BOTH guards (extractor + lint). It used to be two
// copies, and the drift between them silently dropped every module-section label
// (ADR-0044) from the catalog. ADR-0067 hit the same class of bug one level up:
// the whole MAIL chain was in neither list, so every customer letter shipped
// hardcoded Hungarian while both guards stayed green. A file added to the
// doctrine now joins both guards or neither.
import { I18N_SOURCES as SOURCES } from "./i18n-sources.mjs";

/**
 * ⛔⛔ THE EXTRACTOR AND THE LINT ASK TWO DIFFERENT QUESTIONS — and sharing ONE
 * list conflated them (ADR-0157 utókör, mérve 2026-09-14).
 *
 *   LINT      „does this file contain UNWRAPPED customer text?"  → curated list.
 *             Judgment call: `public.ts` also holds 46 literals of OUR OWN
 *             Hungarian marketing landing, whose translation is a separate,
 *             unmade decision. Widening the lint there would force that decision
 *             by accident (feedback_widening_a_shared_list_needs_per_consumer_decision).
 *   EXTRACTOR „is every WRAPPED string in the catalogue?"        → EVERYWHERE.
 *             Wrapping a string in `T()` IS the declaration that it is
 *             customer-facing and translatable. There is no such thing as a
 *             wrapped string that must stay out of the pack — so the harvest has
 *             no business having a file list at all.
 *
 * Measured before the change: 46 wrapped literals in 7 files never reached any
 * language pack, because their FILE was not on the shared list. A German tenant's
 * guest read them in Hungarian, with every gate green — among them the whole
 * suspended-site page, the booking-enquiry errors and a customer traffic email.
 * The catalogue's `--check` freshness gate now closes this class for good: a newly
 * wrapped string anywhere under src/ makes the committed catalogue stale, and the
 * commit stops.
 */
async function tsFilesUnder(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await tsFilesUnder(p)));
    else if (e.name.endsWith(".ts") || e.name.endsWith(".mts")) out.push(p);
  }
  return out;
}

async function main(): Promise<void> {
  // SOURCES still carries the non-src entries (client runtime JS); everything
  // under src/ is harvested wholesale, list or no list.
  const files = [
    ...SOURCES.map((f) => path.join(ROOT, f)).filter((f) => !f.startsWith(path.join(ROOT, "src") + path.sep)),
    ...(await tsFilesUnder(path.join(ROOT, "src"))),
  ];
  const found = new Set<string>();
  // T(x, "…") / T(x(), "…") in TS templates; tr("…") in client JS. Double-quoted
  // only (the contract).
  // ⚠️ The lang argument may be a CALL, not just an identifier: `T(consoleLang(),
  //    "A mentés nem sikerült:")` was invisible to BOTH guards — the lint reported
  //    it as an UNWRAPPED literal (it is wrapped) and the harvest skipped it. One
  //    occurrence today; the point is that the shape was unrepresentable.
  const RE =
    /\b(?:T\(\s*[a-zA-Z_$][\w$]*(?:\.[\w$]+)*(?:\([^()]*\))?\s*,|tr\()\s*"((?:[^"\\]|\\.)+)"/g;
  for (const file of files) {
    const src = await readFile(file, "utf8").catch(() => "");
    for (const m of src.matchAll(RE)) {
      found.add(JSON.parse(`"${m[1]}"`)); // unescape via JSON
    }
  }

  // DATA REGISTRIES (ADR-0067 ②). The module catalog and the module-config schema
  // hold customer-facing LABELS as plain data, and the views render them through
  // T(lang, m.label) — a dynamic argument the T()-scan above cannot see. So the
  // labels are HARVESTED here by field name instead. Discovered by the pseudo-locale
  // guard: a Polish tenant's module list read "Nyitvatartás, érkezés".
  // These files are NOT in the lint's list on purpose: their literals are DATA and
  // must stay literal — wrapping them would break the harvest.
  const DATA_FIELDS = /\b(?:label|publicLabel|publicDesc|help|note|placeholder|suffix):\s*"((?:[^"\\]|\\.)+)"/g;
  const DATA_FILES = [
    "src/modules.ts",
    "src/moduleConfig.ts",
    // Amenity catalogue (plan F): 70 item + 10 category labels, T(lang, a.label)
    // with a dynamic argument — same harvest-by-field-name as the module registry.
    "src/tenant/amenityCatalog.ts",
    // Súgó-kategóriák (2026-09-12): a csoport-feliratot a TENANT is olvassa a saját
    // admin Súgó fülén, a nézet pedig dinamikusan fordítja: T(lang, c.label). Betakarítás
    // nélkül egy lengyel tenant magyar csoportcímeket látna, minden kapu zölden.
    "src/kb/kbCategories.ts",
  ];
  for (const rel of DATA_FILES) {
    const src = await readFile(path.join(ROOT, rel), "utf8").catch(() => "");
    for (const m of src.matchAll(DATA_FIELDS)) found.add(JSON.parse(`"${m[1]}"`));
    // The plain string maps (e.g. GROUP_LABELS: offer: "Amit bemutat").
    for (const m of src.matchAll(/^\s*[a-z][\w]*:\s*"([^"\\]{3,})",\s*$/gm)) {
      found.add(JSON.parse(`"${m[1]}"`));
    }
  }
  const catalog = [...found].sort((a, b) => a.localeCompare(b, "hu"));
  const out = path.join(ROOT, "src/i18n/catalog.json");
  const next = JSON.stringify(catalog, null, 2) + "\n";
  // --check: verify the committed catalog matches the sources (pre-commit freshness gate) —
  // a stale catalog would let new strings ship untranslated (silent Hungarian on foreign pages).
  if (process.argv.includes("--check")) {
    const current = await readFile(out, "utf8").catch(() => "");
    if (current !== next) {
      console.error("⛔ i18n-katalógus ELAVULT — futtasd: npx tsx scripts/extract-i18n.mts, és addold a src/i18n/catalog.json-t.");
      process.exit(1);
    }
    console.log(`✅ i18n-katalógus friss (${catalog.length} string).`);
    return;
  }
  await writeFile(out, next, "utf8");
  console.log(`catalog: ${catalog.length} string → ${out}`);
}

await main();
