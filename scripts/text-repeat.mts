// THE RENDER GATE'S REPETITION RULE for a writer's words, before a page is made (ADR-XXXX). The chain's writer
// (~/rc-briefs/uj-lanc/fo-terv/write.py) asks this after each answer and sends the pairs back for a rewrite — the very
// rule the gate fails a page on (src/text/textOverlap.ts repeatsText), so the writer never needs a copy of it.
//
//   echo '{"fields": {"hero.lead": "…", "intro": "…", …}, "proper": ["<lodging>", "<town>"]}' | npx tsx scripts/text-repeat.mts
//   → {"repeats": [{"a": "hero.lead", "b": "intro (1. mondat)", "textA": "…", "textB": "…"}]}   (exit 0 always; 2 = bad input)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { OWNER_ALLOWED_TEMPLATES } from "../src/engine/templates.js";
import { repeatsText } from "../src/text/textOverlap.js";

/** The template files of the allowed outreach templates (id → file name in src/engine/templates/). */
const TEMPLATE_FILE: Record<string, string> = { parallax: "parallax.ts", "gate-opening": "gateOpening.ts", "wordmark-grow": "wordmarkGrow.ts" };

/**
 * The fixed section headings the allowed templates print themselves (`<h2>${T(data, "…")}</h2>`), read from the
 * template sources — measured 11-27: a highlight „Vendég-értékelések a Google-ön” failed the gate against the
 * Kapunyitás heading „Vendégek értékelése”. Read, not listed: a new heading joins by itself.
 */
export function fixedHeadings(): string[] {
  const out = new Set<string>();
  for (const id of OWNER_ALLOWED_TEMPLATES) {
    const f = TEMPLATE_FILE[id];
    if (!f) continue;
    try {
      const src = readFileSync(fileURLToPath(new URL(`../src/engine/templates/${f}`, import.meta.url)), "utf8");
      for (const m of src.matchAll(/<h[1-3][^>]*>\$\{T\(data, "([^"]+)"\)\}/g)) out.add(m[1]!);
    } catch {
      /* a missing template file adds nothing */
    }
  }
  return [...out];
}

/** The visible lines of the main plan's words: every field, the intro and the tagline split into sentences. */
export function linesOf(fields: Record<string, unknown>): { key: string; text: string }[] {
  const out: { key: string; text: string }[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (k === "hero.accent") continue; // a part of hero.lead by definition
    if (typeof v === "string" && v.trim()) {
      const parts = k === "intro" || k === "tagline" ? v.split(/(?<=[.!?])\s+/).filter((s) => s.trim()) : [v];
      parts.forEach((s, i) => out.push({ key: parts.length > 1 ? `${k} (${i + 1}. mondat)` : k, text: s.trim() }));
    } else if (Array.isArray(v)) {
      v.forEach((s, i) => typeof s === "string" && s.trim() && out.push({ key: `${k}[${i + 1}]`, text: s.trim() }));
    }
  }
  return out;
}

export function repeatPairs(fields: Record<string, unknown>, proper: readonly string[]): { a: string; b: string; textA: string; textB: string }[] {
  const lines = linesOf(fields);
  const pairs: { a: string; b: string; textA: string; textB: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const a = lines[i]!;
      const b = lines[j]!;
      // sentences of one paragraph and items of one list are siblings, not a repeat across the page
      const ka = a.key.split(" (")[0]!.split("[")[0]!;
      const kb = b.key.split(" (")[0]!.split("[")[0]!;
      if (ka === kb) continue;
      // the hero subtitle ↔ intro pair is excepted by the templates' design (mockRenderGate, the same exception)
      if ((ka === "tagline" && kb === "intro") || (ka === "intro" && kb === "tagline")) continue;
      // the highlights are judged against the template's own headings only (below) — measured 11-27: Kamilla's words
      // passed the gate with a highlight repeating the tagline
      if (ka === "highlights" || kb === "highlights") continue;
      if (repeatsText(a.text, b.text, proper)) pairs.push({ a: a.key, b: b.key, textA: a.text, textB: b.text });
    }
  }
  // every line of the words against the template's fixed headings
  for (const l of lines) {
    for (const h of fixedHeadings()) {
      if (repeatsText(l.text, h, proper)) pairs.push({ a: l.key, b: "a sablon saját címe", textA: l.text, textB: h });
    }
  }
  return pairs;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop()!);
if (isMain) {
  let raw = "";
  for await (const c of process.stdin) raw += c;
  try {
    const j = JSON.parse(raw) as { fields?: Record<string, unknown>; proper?: string[] };
    process.stdout.write(`${JSON.stringify({ repeats: repeatPairs(j.fields ?? {}, j.proper ?? []) })}\n`);
  } catch (e) {
    process.stderr.write(`hibás bemenet: ${(e as Error).message}\n`); // i18n-exempt: operator log
    process.exit(2);
  }
}
