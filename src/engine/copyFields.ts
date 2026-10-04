// THE MOCK'S EDITABLE COPY — one field model for the console form (A), the in-place
// preview editor (B), the save path and the templates' hooks (ADR-0323; approved plan:
// assets/design-refs/console/mock-copy-edit/).
//
// WHY ONE MODULE. The same field is written from two surfaces, judged by the same gates
// and rendered by 21 templates. Two copies of "which fields exist" or "how long may the
// tagline be" would be two truths on one screen (feedback_one_rule_two_copies) — so the
// keys, the limits and the overlay rule live HERE and every consumer imports them.
//
// WHERE THE WORDS LIVE (mock_artifact.inputs): the hero/section headings in
// `recipe.sections[kind].copy`, the body copy in `siteData` (tagline/intro/highlights).
// A curator's edit is stored ONCE in `inputs.copyManual` (value + the AI original + who/
// when) and OVERLAID on top of whatever the AI writes — so an AI rewrite of the same mock
// never overwrites a hand-written field (owner ruling D3, 2026-10-04).

import type { Recipe, SectionCopy, SiteData } from "./recipe.js";

/** Section kinds whose eyebrow/title the curator may rewrite (the AI writes exactly these). */
export const COPY_SECTION_KINDS = ["features", "rooms", "gallery", "reviews", "faq", "location"] as const;
export type CopySectionKind = (typeof COPY_SECTION_KINDS)[number];

export type CopyKey =
  | "hero.lead"
  | "hero.accent"
  | "hero.eyebrow"
  | "tagline"
  | "intro"
  | "highlights"
  | `${CopySectionKind}.eyebrow`
  | `${CopySectionKind}.title`;

/**
 * D5 (owner ruling 2026-10-04): ONE set of limits for the mock copy, the tighter values of
 * the approved plan. Measured against the layouts: a longer hero lead or tagline wraps
 * into a fourth line on a 390 px phone.
 */
export const COPY_LIMITS = {
  heroLead: 140,
  accent: 60,
  eyebrow: 60,
  tagline: 160,
  intro: 600,
  sectionTitle: 90,
  highlight: 80,
  highlightsMax: 6,
} as const;

export interface CopyFieldSpec {
  readonly key: CopyKey;
  readonly max: number;
  readonly required: boolean;
  /** Multi-line value ("\n" is a line break in section titles). */
  readonly multiline: boolean;
}

export function copyFieldSpec(key: CopyKey): CopyFieldSpec {
  switch (key) {
    case "hero.lead":
      return { key, max: COPY_LIMITS.heroLead, required: true, multiline: false };
    case "hero.accent":
      return { key, max: COPY_LIMITS.accent, required: false, multiline: false };
    case "hero.eyebrow":
      return { key, max: COPY_LIMITS.eyebrow, required: false, multiline: false };
    case "tagline":
      return { key, max: COPY_LIMITS.tagline, required: true, multiline: false };
    case "intro":
      return { key, max: COPY_LIMITS.intro, required: true, multiline: true };
    case "highlights":
      return { key, max: COPY_LIMITS.highlight, required: true, multiline: false };
    default:
      return key.endsWith(".title")
        ? { key, max: COPY_LIMITS.sectionTitle, required: false, multiline: true }
        : { key, max: COPY_LIMITS.eyebrow, required: false, multiline: false };
  }
}

export function isCopyKey(k: string): k is CopyKey {
  if (["hero.lead", "hero.accent", "hero.eyebrow", "tagline", "intro", "highlights"].includes(k)) return true;
  const [kind, field] = k.split(".");
  return (
    (COPY_SECTION_KINDS as readonly string[]).includes(kind ?? "") && (field === "eyebrow" || field === "title")
  );
}

export type CopyValue = string | readonly string[];

/** One hand-written field: the value, the AI original it replaced, and who wrote it. */
export interface ManualCopyEntry {
  readonly value: CopyValue;
  readonly orig: CopyValue;
  /** §B.17 provenance: the curator answers for this text, not the generator. */
  readonly source: "curator";
  readonly by: string;
  readonly at: string;
}
export type ManualCopy = Partial<Record<CopyKey, ManualCopyEntry>>;

/** Read `inputs.copyManual` defensively (older artifacts have none). */
export function manualCopyOf(inputs: unknown): ManualCopy {
  const raw = (inputs as { copyManual?: unknown } | null)?.copyManual;
  if (!raw || typeof raw !== "object") return {};
  const out: ManualCopy = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isCopyKey(k) || !v || typeof v !== "object") continue;
    const e = v as Partial<ManualCopyEntry>;
    if (typeof e.value !== "string" && !Array.isArray(e.value)) continue;
    out[k] = {
      value: e.value,
      orig: e.orig ?? "",
      source: "curator",
      by: typeof e.by === "string" ? e.by : "",
      at: typeof e.at === "string" ? e.at : "",
    };
  }
  return out;
}

/** Collapse runs of blanks; a section title keeps its "\n" line break, nothing else does. */
export function normalizeCopy(key: CopyKey, v: string): string {
  const spec = copyFieldSpec(key);
  const s = v.replace(/\r\n?/g, "\n");
  if (key.endsWith(".title")) {
    return s
      .split("\n")
      .map((l) => l.replace(/[ \t]+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 2)
      .join("\n");
  }
  if (spec.multiline) return s.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return s.replace(/\s+/g, " ").trim();
}

/** Same rule as guestValueHighlights: blank lines drop out; the count is capped. */
export function normalizeHighlights(list: readonly string[]): string[] {
  return list.map((h) => normalizeCopy("highlights", h)).filter(Boolean);
}

const sectionCopy = (recipe: Recipe, kind: string): SectionCopy | undefined =>
  recipe.sections.find((s) => s.kind === kind)?.copy ?? undefined;

/** The value a field has RIGHT NOW in the stored recipe/siteData ("" when absent). */
export function currentCopy(recipe: Recipe, data: SiteData, key: CopyKey): CopyValue {
  if (key === "tagline") return data.tagline ?? "";
  if (key === "intro") return data.intro ?? "";
  if (key === "highlights") return [...(data.highlights ?? [])];
  const [kind, field] = key.split(".") as [string, keyof SectionCopy];
  return sectionCopy(recipe, kind)?.[field] ?? "";
}

/** Does the recipe have a section this key writes into? (hero is always there.) */
export function copyKeyApplies(recipe: Recipe, key: CopyKey): boolean {
  if (key === "tagline" || key === "intro" || key === "highlights") return true;
  const kind = key.split(".")[0]!;
  return recipe.sections.some((s) => s.kind === kind);
}

/** Every editable key this recipe can carry, in the form's order. */
export function copyKeysFor(recipe: Recipe): CopyKey[] {
  const keys: CopyKey[] = ["hero.lead", "hero.accent", "tagline", "hero.eyebrow", "intro", "highlights"];
  for (const kind of COPY_SECTION_KINDS) {
    if (recipe.sections.some((s) => s.kind === kind)) keys.push(`${kind}.eyebrow`, `${kind}.title`);
  }
  return keys;
}

function setSectionField(copy: SectionCopy | null | undefined, field: keyof SectionCopy, value: string): SectionCopy {
  const next: Record<string, string | undefined> = { ...(copy ?? {}) };
  if (value) next[field] = value;
  else delete next[field];
  return next as SectionCopy;
}

/**
 * Write a set of field values into recipe + siteData — the ONE overlay rule. Only the
 * words change: variant, order, photos, palette stay exactly as they were.
 */
export function overlayCopy(
  recipe: Recipe,
  data: SiteData,
  values: Partial<Record<CopyKey, CopyValue>>,
): { recipe: Recipe; data: SiteData } {
  let nextData: SiteData = data;
  const byKind = new Map<string, Record<string, string>>();
  for (const [k, v] of Object.entries(values) as [CopyKey, CopyValue][]) {
    if (k === "tagline" || k === "intro") nextData = { ...nextData, [k]: String(v) };
    else if (k === "highlights") nextData = { ...nextData, highlights: [...(v as readonly string[])] };
    else {
      const [kind, field] = k.split(".") as [string, string];
      byKind.set(kind, { ...(byKind.get(kind) ?? {}), [field]: String(v) });
    }
  }
  const sections = recipe.sections.map((s) => {
    const f = byKind.get(s.kind);
    if (!f) return s;
    let copy: SectionCopy | null | undefined = s.copy;
    for (const [field, value] of Object.entries(f)) copy = setSectionField(copy, field as keyof SectionCopy, value);
    return { ...s, copy };
  });
  return { recipe: { ...recipe, sections }, data: nextData };
}

/** Apply the stored hand-written fields (inputs.copyManual) on top of recipe + siteData. */
export function applyManualCopy(recipe: Recipe, data: SiteData, manual: ManualCopy): { recipe: Recipe; data: SiteData } {
  const values: Partial<Record<CopyKey, CopyValue>> = {};
  for (const [k, e] of Object.entries(manual) as [CopyKey, ManualCopyEntry][]) values[k] = e.value;
  return overlayCopy(recipe, data, values);
}

/**
 * The same overlay on the generator's working copy (brief + editorial), so the guards an
 * AI rewrite runs judge the text that will actually SHIP — hand-written fields included.
 */
export function applyManualToSurface<
  T extends { tagline: string; intro: string; highlights: readonly string[]; editorial: Record<string, SectionCopy | undefined> },
>(surface: T, manual: ManualCopy): T {
  let out: T = surface;
  const editorial: Record<string, SectionCopy | undefined> = { ...surface.editorial };
  for (const [k, e] of Object.entries(manual) as [CopyKey, ManualCopyEntry][]) {
    if (k === "tagline" || k === "intro") out = { ...out, [k]: String(e.value) };
    else if (k === "highlights") out = { ...out, highlights: [...(e.value as readonly string[])] };
    else {
      const [kind, field] = k.split(".") as [string, keyof SectionCopy];
      editorial[kind] = setSectionField(editorial[kind], field, String(e.value));
    }
  }
  return { ...out, editorial };
}

// ── template hooks (variant B: the preview editor finds each field by these) ─────────────

/**
 * The attribute a template puts on the element that SHOWS a copy field. `part:"first-
 * sentence"` marks a DERIVED view (firstSentence(intro)): the editor then rewrites only
 * that sentence and keeps the rest of the paragraph. `i` = the highlight's index.
 * Guard: scripts/copy-hook-check.mts renders all 21 templates and fails when a field is
 * visible without its hook.
 */
export function copyHook(key: CopyKey, opts: { i?: number; part?: "first-sentence" } = {}): string {
  return (
    ` data-cit-copy="${key}"` +
    (opts.i !== undefined ? ` data-cit-copy-i="${opts.i}"` : "") +
    (opts.part ? ` data-cit-copy-part="${opts.part}"` : "")
  );
}

/** Which keys a rendered page shows (read from the hooks) — "látszik ezen a sablonon". */
export function visibleCopyKeys(html: string): Set<CopyKey> {
  const out = new Set<CopyKey>();
  for (const m of html.matchAll(/data-cit-copy="([a-z.]+)"/g)) if (isCopyKey(m[1]!)) out.add(m[1] as CopyKey);
  return out;
}

/**
 * The hook for a slot with FALLBACKS (`featCopy.title ?? data.tagline`, `lede = firstSentence
 * (intro) || tagline`): the first candidate with a non-empty value names the field the slot
 * really shows. No candidate → a generic label is shown, which is not a field → no hook.
 */
export function hookPick(
  ...cands: readonly (readonly [CopyKey, unknown, { i?: number; part?: "first-sentence" }?])[]
): string {
  for (const [key, value, opts] of cands) {
    if (typeof value === "string" ? value.trim() : value) return copyHook(key, opts ?? {});
  }
  return "";
}

// The render step weaves the owner's usp IN FRONT of the highlights (render.ts,
// weaveSellingPoints), so a template's list index is not the field's index. The weave
// records, per rendered item, which `siteData.highlights` entry it is (-1 = a usp item,
// which is module data, not mock copy → no hook). Keyed by the woven ARRAY, because the
// render path spreads `data` into new objects afterwards — the array reference survives.
const HIGHLIGHT_SOURCES = new WeakMap<readonly string[], readonly number[]>();

export function setHighlightSources(highlights: readonly string[], sources: readonly number[]): void {
  HIGHLIGHT_SOURCES.set(highlights, sources);
}

/** The hook for the template's i-th rendered highlight ("" for a woven-in usp item). */
export function highlightHook(data: { readonly highlights: readonly string[] }, i: number): string {
  const src = HIGHLIGHT_SOURCES.get(data.highlights);
  const idx = src ? src[i] : i;
  return idx === undefined || idx < 0 ? "" : copyHook("highlights", { i: idx });
}
