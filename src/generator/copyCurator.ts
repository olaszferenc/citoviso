// THE CURATOR'S COPY PACK — "generálás kurátori szöveggel" (ADR-0326, Poe; plan:
// szovegkurator/TERV.md §6 items 1–4). A persona (Poe) writes the mock's words himself;
// the engine then skips the copywriter call, the market regeneration and the critic's
// rewrite loop, and the three guards judge the shipped text ONCE (owner ruling D1 = A).
//
// ⛔ ONE RULE, NOT TWO. The pack is validated by the SAME field model and limit check as
// the hand edit (copyFields + copyManual.copyValueError), its selling-point quotes by the
// SAME verbatim gate as the AI's (brief.validateSellingPoints), and its highlights by the
// SAME decor filter (guestValueHighlights, applied by the engine as for the AI's). A second
// copy of any of these would let Poe's text pass a rule the AI's text fails — or the reverse.
//
// ⛔ §B.17: Poe may not add a fact either. A selling point whose quote is not found verbatim
// in the lead's own descriptions/guest reviews drops out (and is reported), exactly like an
// AI-lifted one — so the "Honnan tudjuk?" panel only ever shows machine-checked quotes.

import type { EditorialCopy } from "../engine/copywriter.js";
import {
  COPY_SECTION_KINDS,
  isCopyKey,
  type CopyKey,
  type CopyValue,
  type ManualCopy,
} from "../engine/copyFields.js";
import { parseHex } from "../engine/palette.js";
import type { SectionCopy } from "../engine/recipe.js";
import { validateSellingPoints, type GeneratedBrief } from "./brief.js";
import { copyValueError, normalizeCopyValue } from "./copyManual.js";
import { guestValueHighlights } from "./highlightValue.js";

/** The account name the persona writes under (console operator `poe`). */
export const POE_BY = "Poe";

// Cyrillic → Latin homoglyph map. LLM output occasionally carries lookalike Cyrillic letters
// inside Hungarian words (e.g. "е" U+0435 in "teraszon") — invisible on screen but breaking
// search/matching (the fact guard caught one in production). Applied to all brief-derived
// text — and to the curator's, who writes with an LLM too.
const HOMOGLYPHS: Readonly<Record<string, string>> = {
  а: "a", е: "e", о: "o", р: "p", с: "c", х: "x", у: "y", і: "i",
  А: "A", Е: "E", О: "O", Р: "P", С: "C", Х: "X", І: "I", В: "B", Н: "H", К: "K", М: "M", Т: "T",
};

export function fixHomoglyphs(s: string): string {
  return s.replace(/[Ѐ-ӿіІ]/g, (ch) => HOMOGLYPHS[ch] ?? ch);
}

/** What the curator hands the engine (CLI / console form / Poe's own session). */
export interface CuratorCopy {
  /** The visible fields, keyed exactly like the hand edit (copyFields.CopyKey). */
  readonly fields: Readonly<Record<string, CopyValue>>;
  /** Guest-decision facts with a VERBATIM quote from the lead's own prose / guest reviews. */
  readonly sellingPoints?: readonly { label: string; quote: string }[];
  /** Optional per-property accent (#rrggbb); absent → the skin's own accent. */
  readonly accent?: string;
  /** Who answers for the words (provenance `by`); defaults to Poe. */
  readonly by?: string;
}

/** The fields every mock needs (copyFieldSpec.required) — the AI path always writes them. */
const REQUIRED_KEYS: readonly CopyKey[] = ["hero.lead", "tagline", "intro", "highlights"];

export interface ValidatedCuratorCopy {
  readonly fields: Partial<Record<CopyKey, CopyValue>>;
  readonly brief: GeneratedBrief;
  readonly editorial: EditorialCopy;
  readonly sellingPoints: readonly { label: string; quote: string }[];
  readonly accent: string | null;
  readonly by: string;
  /** Non-blocking notes for the curator: dropped quotes, highlights the decor filter removes. */
  readonly warnings: readonly string[];
}

export type CuratorCopyCheck =
  | { readonly ok: true; readonly copy: ValidatedCuratorCopy }
  | { readonly ok: false; readonly errors: Readonly<Record<string, string>> };

/**
 * Validate the pack against the field model and the lead's quote corpus (the SAME corpus
 * the AI's selling points are checked against: descriptions + guest-review texts).
 * Errors block the generation; warnings ride along to the operator log.
 */
export function validateCuratorCopy(pack: CuratorCopy, corpus: readonly string[]): CuratorCopyCheck {
  const errors: Record<string, string> = {};
  const warnings: string[] = [];
  const fields: Partial<Record<CopyKey, CopyValue>> = {};

  for (const [key, raw] of Object.entries(pack.fields ?? {})) {
    if (!isCopyKey(key)) {
      errors[key] = "Ismeretlen mező.";
      continue;
    }
    const cleaned: CopyValue = Array.isArray(raw) ? raw.map((x) => fixHomoglyphs(String(x))) : fixHomoglyphs(String(raw));
    const value = normalizeCopyValue(key, cleaned);
    const err = copyValueError(key, value);
    if (err) errors[key] = err;
    else if (value.length) fields[key] = value;
  }
  for (const key of REQUIRED_KEYS) if (!(key in fields) && !errors[key]) errors[key] = "Ez a mező nem lehet üres.";

  let accent: string | null = null;
  if (pack.accent?.trim()) {
    if (parseHex(pack.accent.trim())) accent = pack.accent.trim();
    else errors.accent = "Az akcentszín #rrggbb formájú HEX legyen.";
  }
  if (Object.keys(errors).length) return { ok: false, errors };

  const highlights = fields.highlights as readonly string[];
  const kept = guestValueHighlights(highlights);
  for (const h of highlights) {
    if (!kept.some((k) => h.includes(k) || k.includes(h)))
      warnings.push(`kiemelés kiesik (berendezés-leírás, nem vendég-érték): „${h}”`);
  }

  const offered = (pack.sellingPoints ?? []).map((p) => ({ label: fixHomoglyphs(p.label), quote: p.quote }));
  const sellingPoints = validateSellingPoints(offered, corpus);
  for (const p of offered) {
    if (!sellingPoints.some((s) => s.label.toLowerCase() === p.label.trim().toLowerCase()))
      warnings.push(`tény kiesik (az idézet nincs szó szerint a forrásban): „${p.label}”`);
  }

  const str = (k: CopyKey): string | undefined => (typeof fields[k] === "string" ? (fields[k] as string) : undefined);
  const editorial: Record<string, SectionCopy> = {
    hero: {
      lead: str("hero.lead")!,
      ...(str("hero.accent") ? { accent: str("hero.accent") } : {}),
      ...(str("hero.eyebrow") ? { eyebrow: str("hero.eyebrow") } : {}),
    },
  };
  for (const kind of COPY_SECTION_KINDS) {
    const eyebrow = str(`${kind}.eyebrow`);
    const title = str(`${kind}.title`);
    if (eyebrow || title) editorial[kind] = { ...(eyebrow ? { eyebrow } : {}), ...(title ? { title } : {}) };
  }

  // The engine reads tagline/intro/highlights/palette.accent off the brief and nothing else;
  // the remaining palette slots and the mood/archetype hints belong to the AI copywriter's
  // vision call, which this mode does not make. An empty accent fails parseHex → skin accent.
  const brief: GeneratedBrief = {
    tagline: str("tagline")!,
    intro: str("intro")!,
    highlights: [...highlights],
    palette: { accent: accent ?? "", accentDark: "", bg: "", surface: "", ink: "", muted: "" },
    mood: "",
    archetype: "classic",
  };

  return {
    ok: true,
    copy: {
      fields,
      brief,
      editorial: editorial as EditorialCopy,
      sellingPoints,
      accent,
      by: pack.by?.trim() || POE_BY,
      warnings,
    },
  };
}

/**
 * §B.17 provenance for every field the curator wrote, in the hand edit's shape
 * (`inputs.copyManual`): an AI rewrite of this mock (recopy) overlays them instead of
 * replacing them. `orig: ""` — there is no AI original under a curator's text.
 * `shown` is the value as RENDERED (after the engine's decor filter), so the overlay
 * reproduces exactly the page that was judged.
 */
export function curatorManualOf(
  keys: readonly CopyKey[],
  shown: (key: CopyKey) => CopyValue,
  by: string,
  now = new Date(),
): ManualCopy {
  const out: ManualCopy = {};
  for (const key of keys) out[key] = { value: shown(key), orig: "", source: "curator", by, at: now.toISOString() };
  return out;
}
