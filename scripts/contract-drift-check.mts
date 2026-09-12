// Contract-drift guard: does the SHIPPED surface still match the FROZEN plan?
//
// Why it exists (2026-09-08): the approved configurator contract said the summary
//included the domain fee, and the shipped code left it OUT — the buyer paying
// 6 430 Ft read 5 430 Ft in the largest type on the screen. Nobody compared the
// contract with the code, because comparing them was nobody's job. The §2b gate
// ends at "approved"; nothing watched what happened afterwards.
//
// What it checks:
//   ① STRUCTURE — a contract folder must actually hold a plan (HTML), a README and
//      at least one image, and the plan's inline JS must PARSE. A frozen plan that
//      no longer runs is not a contract, it is a screenshot with extra steps
//      (measured: a rewrite script silently broke plan.html this very session).
//   ② BINDING LITERALS — strings the README marks as **„…"** must exist in the
//      shipped surface. Opt-in on purpose: a README also quotes example data and
//      file names, and a guard that flags those would be noise, and noise gets
//      ignored (the same convention the KB checker already uses for labels).
//
// Usage: npx tsx scripts/contract-drift-check.mts [--self-test]

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const REFS = join(ROOT, "assets", "design-refs");
const SELF_TEST = process.argv.includes("--self-test");

let failed = 0;
const ok = (cond: boolean, label: string, detail = ""): void => {
  console.log(`${cond ? "✓ " : "✗ FAIL"}  ${label}${detail ? `\n     ↳ ${detail}` : ""}`);
  if (!cond) failed++;
};

/**
 * The files a contract binds — declared BY the contract in a `**Hatókör:**` line.
 *
 * ⛔ The first version searched the WHOLE codebase for the binding literal, and a
 * deliberately reverted configurator still passed: „Most fizetendő" also exists on
 * the tenant-admin domain screen, so the string was found somewhere and the guard
 * called it green. A guard's reach IS its file list — searching everywhere is the
 * same as searching nothing (feedback_guard_scope_is_the_doctrine).
 */
function scopeOf(readme: string, rel: string): string[] | null {
  const m = /\*\*Hatókör:\*\*\s*([^\n]+)/.exec(readme);
  if (!m) return null;
  return m[1]!
    .split(/[·,]/)
    .map((x) => x.replace(/[`\s]/g, ""))
    .filter(Boolean)
    .map((x) => join(ROOT, x));
}

/** Whitespace-normalised content of the scoped files (a README wraps lines, code does not). */
function readScope(files: string[]): { text: string; missing: string[] } {
  const missing: string[] = [];
  const parts: string[] = [];
  for (const f of files) {
    if (!existsSync(f)) { missing.push(relative(ROOT, f)); continue; }
    parts.push(readFileSync(f, "utf8"));
  }
  return { text: parts.join("\n").replace(/\s+/g, " "), missing };
}

/** Contract folders = any design-refs subfolder that carries a README.md. */
function contractDirs(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const p = join(dir, e.name);
      if (existsSync(join(p, "README.md"))) out.push(p);
      walk(p);
    }
  };
  walk(REFS);
  return out.sort();
}

/** Whole-surface fallback for contracts that have not declared a scope yet. */
function wholeSurface(): string {
  const parts: string[] = [];
  const walk = (dir: string, exts: string[]): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name.startsWith(".")) continue;
        walk(p, exts);
      } else if (exts.some((x) => e.name.endsWith(x))) parts.push(readFileSync(p, "utf8"));
    }
  };
  walk(join(ROOT, "src"), [".ts"]);
  walk(join(ROOT, "assets", "runtime"), [".js"]);
  return parts.join("\n").replace(/\s+/g, " ");
}

const WHOLE = wholeSurface();
const weakScope: string[] = [];
const dirs = contractDirs();
console.log(`=== contract-drift-check · ${dirs.length} kontraktus ===\n`);

let bindingTotal = 0;
const missingShots: string[] = [];
for (const dir of dirs) {
  const rel = relative(ROOT, dir);
  const files = readdirSync(dir);
  const html = files.filter((f) => f.endsWith(".html"));
  const imgs = files.filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
  const readme = readFileSync(join(dir, "README.md"), "utf8");

  // ── ① structure ────────────────────────────────────────────────────────────
  ok(html.length > 0, `${rel}: van kattintható terv (HTML)`, html.join(", ") || "nincs .html");
  // A kép hiánya RÉGI adósság (a §2b csak később tette kötelezővé): jelezzük, de nem
  // buktatjuk — egy örökké piros őrt kikapcsolnak, és akkor a valódi drift se derül ki.
  if (imgs.length === 0) missingShots.push(rel);

  for (const h of html) {
    const src = readFileSync(join(dir, h), "utf8");
    // ⛔ Only REAL JavaScript blocks: a `type` that is not JS (application/ld+json,
    // text/plain template holders) is DATA, and parsing it as code is a false
    // alarm — the first run flagged 5 of them and none was broken.
    const scripts = [...src.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter((m) => {
      const type = /type\s*=\s*"([^"]*)"/.exec(m[1]!)?.[1]?.toLowerCase();
      return !type || type === "text/javascript" || type === "module";
    });
    for (const [i, m] of scripts.entries()) {
      let parses = true;
      let err = "";
      try {
        new Function(m[2]!);
      } catch (e) {
        parses = false;
        err = (e as Error).message;
      }
      ok(parses, `${rel}/${h}: a ${i + 1}. script SZINTAKTIKAILAG él`, err);
    }
  }

  // ── ② binding literals: **„…"**, searched ONLY in the declared scope ───────
  // ⛔ The closing quote may be the straight " OR the Hungarian ” — both are what
  // an author actually types. The straight-only pattern made a whole contract's
  // binding labels vanish from this gate SILENTLY (checkout-fullscreen, 2026-09-12:
  // 7 marked labels, 0 checked). A marking convention that is easy to miss by one
  // character has to be forgiving on the reading side, not strict.
  const binding = [...readme.matchAll(/\*\*„([^„”"]{3,80})["”]\*\*/g)].map((m) => m[1]!.trim());
  bindingTotal += binding.length;
  const scope = scopeOf(readme, rel);
  // ⚠️ Scope-less contracts fall back to the whole codebase. That check is WEAK —
  // a label living on some other screen makes it pass (measured: a deliberately
  // reverted configurator stayed green because „Most fizetendő" also exists on
  // the tenant-admin domain screen). We keep it, but we say out loud that it is
  // weak, instead of letting it look like coverage.
  if (binding.length && !scope) weakScope.push(rel);
  const { text: scoped, missing: gone } = scope ? readScope(scope) : { text: "", missing: [] };
  const surface = scope ? scoped : WHOLE;
  if (gone.length) ok(false, `${rel}: a Hatókör hiányzó fájlra mutat`, gone.join(", "));
  for (const lit of binding) {
    // A binding literal may carry {placeholders} — match the fixed parts only,
    // otherwise every parameterised label would read as drift.
    const needle = lit
      .replace(/\s+/g, " ")
      .split(/\{[^}]*\}/)
      .map((x) => x.trim())
      .filter((x) => x.length >= 4);
    const missing = needle.filter((n) => !surface.includes(n));
    const broken = SELF_TEST ? needle.length > 0 : missing.length > 0;
    ok(
      !broken,
      `${rel}: KÖTŐ felirat él a kódban${scope ? "" : " (⚠️ hatókör nélkül, gyenge)"} — „${lit}"`,
      broken ? `nem található a szállított felületen: ${(SELF_TEST ? needle : missing).join(" · ")}` : "",
    );
  }
}

if (weakScope.length) {
  console.log(
    `\n⚠️ ${weakScope.length} kontraktus KÖTŐ feliratot jelöl, de nincs **Hatókör:** sora —\n` +
      `   ezeknél a keresés az EGÉSZ kódbázisra megy, tehát egy máshol élő felirat is zöldre hozza:\n   ` +
      weakScope.join("\n   "),
  );
}
if (missingShots.length) {
  console.log(
    `\n⚠️ ${missingShots.length} kontraktus terve KÉP NÉLKÜL áll (régi adósság, nem bukás):\n   ` +
      missingShots.join("\n   "),
  );
}
console.log(
  `\n${bindingTotal} kötő felirat ellenőrizve. ` +
    (bindingTotal === 0
      ? "⚠️ EGY kontraktus sem jelöl kötő feliratot — a **„…\"** jelölés nélkül ez a kapu csak a szerkezetet nézi."
      : ""),
);

if (failed) {
  console.error(`\n⛔ contract-drift-check: ${failed} bukás`);
  process.exit(1);
}
console.log("✅ contract-drift-check: a befagyasztott tervek és a szállított felület nem csúsztak szét.");
