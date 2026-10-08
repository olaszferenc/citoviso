// THE CURATOR'S HAND EDIT of a mock's copy (owner request 2026-10-04: „a mockoknál lehessen
// manuálisan újraírni a szöveget”; ADR-0323, approved plan: assets/design-refs/console/
// mock-copy-edit/). One save path for both surfaces — the field form on the mock card (A)
// and the in-place preview editor (B).
//
// WHAT IT DOES: writes the changed fields into recipe/siteData, records each one in
// `inputs.copyManual` (value + the AI original + who/when, source "curator") and re-renders
// the SAME file in place. No AI call — neither for the words nor for judging them.
//
// ⛔ WHY NO GUARD RUNS ANY MORE (ADR-0329, amending ADR-0323 D2). The send gate
// (mockVerdictGate) reads STORED verdicts, so the old "pass" may never stay under new words —
// that half of D2 stands. What changed is who judges: Vera (the digital colleague) reviews
// every hand-written mock anyway, so the save CLEARS every AI verdict, the previous review
// and the acknowledgement, and sets `reviewVerdict: "pending"` — the mock cannot be sent
// until Vera records her verdict on the console card. Only the deterministic design check
// re-runs (free, and it judges the markup, not the words).

import { writeFile } from "node:fs/promises";
import { sql } from "kysely";

import { db } from "../db/client.js";
import {
  copyFieldSpec,
  copyKeyApplies,
  COPY_LIMITS,
  currentCopy,
  manualCopyOf,
  normalizeCopy,
  normalizeHighlights,
  overlayCopy,
  type CopyKey,
  type CopyValue,
  type ManualCopy,
} from "../engine/copyFields.js";
import type { Recipe, SiteData } from "../engine/recipe.js";
import { renderSite } from "../engine/render.js";
import { DEFAULT_LANG } from "../i18n/lang.js";
import { getDisabledModules, sampleDenyKeys } from "../moduleSales.js";
import { checkDesign } from "./designCheck.js";
import { injectRuntime } from "./runtime.js";
import { secureMockPhotos } from "./photoTransport.js";

export interface ManualCopyResult {
  readonly ok: boolean;
  /** Operator-facing summary (Hungarian). */
  readonly message: string;
  /** Per-field validation errors (nothing was saved when present). */
  readonly errors?: Partial<Record<CopyKey, string>>;
  readonly manualCount?: number;
  /** After a save: "pending" — Vera's review is needed before sending (ADR-0329). */
  readonly verdicts?: { review: "pending"; design: string };
}

/** Is this mock behind a prospect link? Then its words are frozen (§I) — same rule as recopy. */
export async function isCopyFrozen(artifactId: string): Promise<boolean> {
  const offered = await db
    .selectFrom("prospect")
    .select("id")
    .where("mock_artifact_id", "=", artifactId)
    .executeTakeFirst();
  return Boolean(offered);
}

/** Verdicts about the words that a hand edit makes stale (ADR-0329) — dropped on save. */
export const STALE_VERDICT_KEYS = [
  "factVerdict", "factUnsourced", "factCandidates",
  "marketVerdict", "marketReason", "marketFactsNamed", "marketMissed",
  "guestCriticVerdict", "guestCriticReason", "guestCriticRounds", "guestCriticObjections",
  "review", "reviewReason", "verdictAck",
] as const;

type Edits = Partial<Record<CopyKey, CopyValue>>;

/** A submitted value in its stored shape: highlights become a normalized list, the rest a string. */
export function normalizeCopyValue(key: CopyKey, raw: CopyValue): CopyValue {
  if (key === "highlights") return normalizeHighlights(Array.isArray(raw) ? raw : String(raw).split("\n"));
  return normalizeCopy(key, Array.isArray(raw) ? raw.join(" ") : String(raw));
}

/**
 * The ONE limit check for a normalized value — the hand edit (here) and the curator's copy
 * pack (copyCurator.ts) both call it, so "how long may the tagline be" has one answer
 * (feedback_one_rule_two_copies). Operator-facing Hungarian message, or null when it fits.
 */
export function copyValueError(key: CopyKey, value: CopyValue): string | null {
  const spec = copyFieldSpec(key);
  if (key === "highlights") {
    const list = value as readonly string[];
    if (!list.length) return "Legalább egy kiemelés kell.";
    if (list.length > COPY_LIMITS.highlightsMax) return `Legfeljebb ${COPY_LIMITS.highlightsMax} kiemelés fér el.`;
    if (list.some((h) => h.length > spec.max)) return `Egy kiemelés legfeljebb ${spec.max} karakter.`;
    return null;
  }
  const v = String(value);
  if (spec.required && !v) return "Ez a mező nem lehet üres.";
  if (v.length > spec.max) return `Túl hosszú: legfeljebb ${spec.max} karakter fér el ezen a helyen.`;
  return null;
}

/**
 * Validate + diff the submitted fields against the stored copy. Only a CHANGED field is
 * measured against the limits: a longer AI original must not block saving another field.
 */
export function planManualEdit(
  recipe: Recipe,
  data: SiteData,
  manual: ManualCopy,
  edits: Edits,
  actor: string,
  now = new Date(),
): { errors: Partial<Record<CopyKey, string>>; values: Edits; manual: ManualCopy; changed: CopyKey[] } {
  const errors: Partial<Record<CopyKey, string>> = {};
  const values: Edits = {};
  const next: Record<string, ManualCopy[CopyKey]> = { ...manual };
  const changed: CopyKey[] = [];
  const same = (a: CopyValue, b: CopyValue) => JSON.stringify(a) === JSON.stringify(b);

  for (const [key, raw] of Object.entries(edits) as [CopyKey, CopyValue][]) {
    if (!copyKeyApplies(recipe, key)) continue;
    const cur = currentCopy(recipe, data, key);
    const value = normalizeCopyValue(key, raw);
    if (same(value, cur)) continue;
    const err = copyValueError(key, value);
    if (err) {
      errors[key] = err;
      continue;
    }
    const orig = manual[key]?.orig ?? cur;
    changed.push(key);
    values[key] = value;
    if (same(value, orig)) delete next[key];
    else next[key] = { value, orig, source: "curator", by: actor, at: now.toISOString() };
  }
  return { errors, values, manual: next as ManualCopy, changed };
}

export async function saveManualCopy(artifactId: string, edits: Edits, actor: string): Promise<ManualCopyResult> {
  const row = await db
    .selectFrom("mock_artifact")
    .select(["id", "lead_id", "path", "inputs"])
    .where("id", "=", artifactId)
    .executeTakeFirst();
  if (!row) return { ok: false, message: "Nincs ilyen mock-artefaktum." };
  if (!row.path) return { ok: false, message: "Ehhez a mockhoz nincs fájl — generálj újat." };
  if (await isCopyFrozen(artifactId)) {
    return {
      ok: false,
      message:
        "Ez a mock már ki lett ajánlva a leadnek — a szövegét nem írjuk át alatta. " +
        "Generálj új mockot, ha más szöveggel ajánlanád.",
    };
  }
  const inputs = (row.inputs ?? {}) as Record<string, unknown>;
  const recipe = inputs.recipe as Recipe | undefined;
  const siteData = inputs.siteData as SiteData | undefined;
  if (!recipe || !siteData) {
    return { ok: false, message: "Ez a mock régi formátumú (nincs eltárolt recept) — a szövege nem írható át." };
  }

  const plan = planManualEdit(recipe, siteData, manualCopyOf(inputs), edits, actor);
  if (Object.keys(plan.errors).length) {
    return { ok: false, message: "Hibás mező — nem mentettem semmit.", errors: plan.errors };
  }
  if (!plan.changed.length) {
    return { ok: true, message: "Nincs változás — a szöveg ugyanaz, mint a mentett.", manualCount: Object.keys(plan.manual).length };
  }

  const { recipe: nextRecipe, data: nextData } = overlayCopy(recipe, siteData, plan.values);
  const lang = siteData.lang ?? DEFAULT_LANG;
  const html = await injectRuntime(
    renderSite(nextRecipe, nextData, { sampleDeny: sampleDenyKeys(await getDisabledModules()) }),
    lang,
  );
  const design = checkDesign(html);

  // http-s fotó a https-es mockon nem jelenik meg (ADR-XXXX): https-emelés vagy saját proxy.
  const secured = await secureMockPhotos(html, String(row.id), (nextData.photos ?? []).map((p) => p.url));
  await writeFile(row.path, secured.html, "utf8");
  const patch = {
    recipe: nextRecipe,
    siteData: nextData,
    copyManual: plan.manual,
    designVerdict: design.verdict,
    designReason: design.reason ?? null,
    reviewVerdict: "pending",
  };
  // MERGE, never replace the whole blob: the hero pin, the recopy and the verdict ack
  // write the same `inputs` (mockVerdictGate.ts). New words, new finding: every stored
  // verdict about the OLD words goes, with the review and the ack (ADR-0329).
  await db
    .updateTable("mock_artifact")
    .set({
      inputs: sql`(coalesce(inputs, '{}'::jsonb) - ${sql.raw(
        STALE_VERDICT_KEYS.map((k) => `'${k}'`).join(" - "),
      )}) || ${JSON.stringify(patch)}::jsonb` as never,
    })
    .where("id", "=", artifactId)
    .execute();

  const n = Object.keys(plan.manual).length;
  return {
    ok: true,
    message: `Mentve (${plan.changed.length} mező) — Vera ítélete kell a küldéshez. A kinézet, a fotók és az elrendezés változatlan.`,
    manualCount: n,
    verdicts: { review: "pending", design: design.verdict },
  };
}
