// Corpus-builder batch runner (ADR-0008 pillér 1, restructured by ADR-0009).
// ARCHETYPE-primary, TIER-partitioned. Builds a growing library of wildly-diverse
// reference designs per tier, using structures/ as the few-shot quality bar.
// OFFLINE, DB-free, Places-free — pure Claude text generation.
// Output: assets/design-refs/corpus/{tier}/{n}.html + manifest.json (queryable index).
//
// Usage:
//   tsx scripts/build-corpus.ts --tier=kozep --count=10   # 10 distinct archetypes @ mid
//   tsx scripts/build-corpus.ts --tier=luxus --count=2    # smoke test
//   tsx scripts/build-corpus.ts --all --count=8           # all 4 tiers × 8
//   flags: --tier=<t>[,<t>] · --all · --count=N (default 8) · --force · --shots
//
// SAFETY: without --all/--tier it prints help and does NOTHING.

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { config } from "../src/config.js";
import {
  TIERS,
  generateCorpusDesign,
  type FewShot,
  type Tier,
} from "../src/generator/corpus.js";
import { injectRuntime } from "../src/generator/runtime.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REFS = path.resolve(HERE, "../assets/design-refs");
const STRUCT_DIR = path.join(REFS, "structures");
const CORPUS_DIR = path.join(REFS, "corpus");
const MANIFEST = path.join(CORPUS_DIR, "manifest.json");

interface ManifestEntry {
  id: string; // {tier}-{variant}
  tier: Tier;
  variant: number;
  archetype: string;
  style: string;
  title: string;
  file: string; // path relative to assets/design-refs
  bytes: number;
}

// ── args ──────────────────────────────────────────────────────────────────────
function parseArgs(argv: string[]): {
  tiers: Tier[];
  count: number;
  force: boolean;
  shots: boolean;
  help: boolean;
} {
  const get = (k: string): string | undefined => {
    const hit = argv.find((a) => a === `--${k}` || a.startsWith(`--${k}=`));
    if (!hit) return undefined;
    const eq = hit.indexOf("=");
    return eq >= 0 ? hit.slice(eq + 1) : "";
  };
  const has = (k: string): boolean => get(k) !== undefined;
  const isTier = (s: string): s is Tier => (TIERS as readonly string[]).includes(s);

  const count = Math.max(1, Number(get("count") ?? "8") || 8);
  const force = has("force");
  const shots = has("shots");

  let tiers: Tier[] = [];
  if (has("all")) {
    tiers = [...TIERS];
  } else {
    const raw = get("tier");
    if (raw) {
      for (const tok of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
        if (isTier(tok)) tiers.push(tok);
        else console.error(`⚠️ ismeretlen tier: "${tok}" (kihagyva)`);
      }
    }
  }
  return { tiers, count, force, shots, help: tiers.length === 0 };
}

// ── few-shot loading + rotation ────────────────────────────────────────────────
async function loadStructures(): Promise<FewShot[]> {
  const files = (await readdir(STRUCT_DIR)).filter((f) => f.endsWith(".html")).sort();
  const out: FewShot[] = [];
  for (const f of files) {
    out.push({ name: f.replace(/\.html$/, ""), html: await readFile(path.join(STRUCT_DIR, f), "utf8") });
  }
  return out;
}

/** Two rotating exemplars per call so across variants the model sees fresh bars. */
function pickFewShot(all: FewShot[], seed: number): FewShot[] {
  if (all.length <= 2) return all;
  const a = all[seed % all.length]!;
  const b = all[(seed + 3) % all.length]!;
  return b.name === a.name ? [a, all[(seed + 4) % all.length]!] : [a, b];
}

// ── manifest ───────────────────────────────────────────────────────────────────
async function loadManifest(): Promise<ManifestEntry[]> {
  if (!existsSync(MANIFEST)) return [];
  try {
    return JSON.parse(await readFile(MANIFEST, "utf8")) as ManifestEntry[];
  } catch {
    return [];
  }
}

async function saveManifest(entries: ManifestEntry[]): Promise<void> {
  entries.sort((x, y) => x.id.localeCompare(y.id));
  await writeFile(MANIFEST, JSON.stringify(entries, null, 2) + "\n", "utf8");
}

// ── main ────────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(
      [
        "Korpusz-építő (ADR-0009: archetípus-elsődleges, tier-particionált). Válassz célt — üresen NEM tüzel.",
        "  --tier=<tier>[,…]   pl. --tier=kozep  vagy  --tier=premium,luxus",
        "  --all               mind a 4 tier",
        "  --count=N (=8) --force --shots",
        `Tierek: ${TIERS.join(", ")}`,
      ].join("\n"),
    );
    return;
  }
  if (!config.anthropicApiKey) {
    console.error("❌ Nincs ANTHROPIC_API_KEY (.env).");
    process.exit(1);
  }

  await mkdir(CORPUS_DIR, { recursive: true });
  const structures = await loadStructures();
  console.log(`Few-shot minőségi léc: ${structures.length} structure betöltve.`);

  const manifest = await loadManifest();
  const byId = new Map(manifest.map((e) => [e.id, e]));

  let seed = manifest.length; // rotate few-shot across the whole growing corpus
  const wroteHtml: { html: string; png: string }[] = [];

  for (const tier of args.tiers) {
    const dir = path.join(CORPUS_DIR, tier);
    await mkdir(dir, { recursive: true });

    // Existing variants in this tier → next index + the full anti-collision pool.
    const existing = manifest.filter((e) => e.tier === tier);
    const avoidArchetypes = existing.map((e) => `${e.archetype} — ${e.style}`);
    const maxVariant = existing.reduce((m, e) => Math.max(m, e.variant), 0);

    console.log(`\n═══ tier: ${tier} ═══ (meglévő: ${existing.length}, cél: +${args.count})`);
    for (let i = 1; i <= args.count; i++) {
      const v = maxVariant + i;
      const id = `${tier}-${v}`;
      const rel = path.join("corpus", tier, `${v}.html`);
      const abs = path.join(dir, `${v}.html`);
      if (!args.force && byId.has(id) && existsSync(abs)) {
        console.log(`  [${v}] megvan (skip)`);
        continue;
      }

      const fewShot = pickFewShot(structures, seed++);
      process.stdout.write(`  [${v}] generálás (few-shot: ${fewShot.map((f) => f.name).join(", ")})… `);
      const res = await generateCorpusDesign({ tier, variant: v, avoidArchetypes, fewShot });
      if (!res) {
        console.log("nincs eredmény.");
        continue;
      }
      await writeFile(abs, await injectRuntime(res.html), "utf8");

      const entry: ManifestEntry = {
        id,
        tier,
        variant: v,
        archetype: res.archetype,
        style: res.style,
        title: res.title,
        file: rel,
        bytes: res.html.length,
      };
      const existingIdx = manifest.findIndex((e) => e.id === id);
      if (existingIdx >= 0) manifest[existingIdx] = entry;
      else manifest.push(entry);
      byId.set(id, entry);
      avoidArchetypes.push(`${res.archetype} — ${res.style}`);
      await saveManifest(manifest); // incremental — survive a crash mid-batch

      console.log(`✓ ${res.archetype} · "${res.title}" · ${res.html.length} byte`);
      wroteHtml.push({ html: abs, png: abs.replace(/\.html$/, ".png") });
    }
  }

  if (args.shots && wroteHtml.length) {
    console.log(`\nScreenshotolás (${wroteHtml.length})…`);
    const browser = await chromium.launch({ executablePath: config.chromiumPath });
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    for (const w of wroteHtml) {
      await page.goto(`file://${w.html}`, { waitUntil: "load", timeout: 40000 }).catch(() => {});
      await page.evaluate(
        `new Promise((r)=>{let y=0;const s=()=>{scrollBy(0,600);y+=600;if(y<document.body.scrollHeight)setTimeout(s,110);else{scrollTo(0,0);r();}};s();})`,
      );
      await page.waitForTimeout(1800);
      await page.screenshot({ path: w.png, fullPage: true });
      console.log(`  ✓ ${path.relative(REFS, w.png)}`);
    }
    await browser.close();
  }

  console.log(`\nKész. Korpusz: ${manifest.length} dizájn a manifestben (${MANIFEST}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
