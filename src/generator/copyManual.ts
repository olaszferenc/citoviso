// THE CURATOR'S HAND EDIT of a mock's copy (owner request 2026-10-04: „a mockoknál lehessen
// manuálisan újraírni a szöveget”; ADR-0323, approved plan: assets/design-refs/console/
// mock-copy-edit/). One save path for both surfaces — the field form on the mock card (A)
// and the in-place preview editor (B).
//
// WHAT IT DOES: writes the changed fields into recipe/siteData, records each one in
// `inputs.copyManual` (value + the AI original + who/when, source "curator"), re-renders
// the SAME file in place (no AI call for the words), and re-runs the guards on the result.
//
// ⛔ WHY THE GUARDS RE-RUN (D2). The send gate (mockVerdictGate) reads the STORED verdicts
// and never checks that they belong to the current text. Keeping the old "pass" under
// hand-written words would be a false green — the exact class the gate exists to stop.
// So the fact gate and the market guard judge the new page, and the guest critic grades
// it WITHOUT rewriting it (judgeGuestCopy): the curator answers for these words. A flag
// blocks sending like any other; the existing acknowledgement is the way past it — and a
// previous acknowledgement is DROPPED, because new words are a new finding.
//
// ⛔ The order is gates → file → DB, so a mock is never on disk with new words while its
// stored verdicts still describe the old ones for longer than one write.

import { writeFile } from "node:fs/promises";
import { sql } from "kysely";

import { db } from "../db/client.js";
import type { EditorialCopy } from "../engine/copywriter.js";
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
import { criticFactsOf, factLeadOf, loadCopySources, marketSourceOf } from "./copySources.js";
import { checkDesign } from "./designCheck.js";
import { verifyFactuality, type FactCheckVerdict } from "./factCheck.js";
import { criticSourceOf, judgeGuestCopy } from "./guestCritic.js";
import { subordinateToCriticInputs, verifyMarketRelevance, type MarketVerdict } from "./marketCheck.js";
import { injectRuntime } from "./runtime.js";

export interface ManualCopyResult {
  readonly ok: boolean;
  /** Operator-facing summary (Hungarian). */
  readonly message: string;
  /** Per-field validation errors (nothing was saved when present). */
  readonly errors?: Partial<Record<CopyKey, string>>;
  readonly manualCount?: number;
  readonly verdicts?: { fact: string | null; market: string | null; critic: string | null; design: string };
  readonly factUnsourced?: string[];
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

/** The editorial copy (per section kind) as the critic/market guard read it. */
function editorialOf(recipe: Recipe): EditorialCopy {
  const out: Record<string, unknown> = {};
  for (const s of recipe.sections) if (s.copy) out[s.kind] = s.copy;
  return out as EditorialCopy;
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

  // The guards judge the page that will be written — never the old one.
  const sources = await loadCopySources(row.lead_id, inputs, siteData);
  const editorial = editorialOf(nextRecipe);
  const hero = editorial.hero ?? {};
  const factP: Promise<FactCheckVerdict> = verifyFactuality({
    html,
    lead: factLeadOf(sources, siteData, inputs),
    photos: sources.photoUrls,
  }).catch((err: Error) => ({ verdict: "error" as const, candidates: [], facts: [], reason: err.message }));
  const marketP: Promise<MarketVerdict> = verifyMarketRelevance({
    sales: {
      ...(hero.lead ? { heroLead: hero.lead } : {}),
      ...(hero.eyebrow ? { heroEyebrow: hero.eyebrow } : {}),
      ...(nextData.tagline ? { tagline: nextData.tagline } : {}),
      ...(nextData.intro ? { intro: nextData.intro } : {}),
      highlights: [...nextData.highlights],
    },
    source: marketSourceOf(sources, siteData),
    photos: sources.photoUrls,
  }).catch((err: Error) => ({
    verdict: "error" as const,
    layer: "judge" as const,
    factsNamed: [],
    missed: [],
    reason: `a kézi szöveg nem ítélhető: ${err.message}`, // i18n-exempt: operator-facing verdict reason (console)
  }));
  const criticP: Promise<Record<string, unknown>> =
    lang === DEFAULT_LANG
      ? judgeGuestCopy(
          { tagline: nextData.tagline, intro: nextData.intro, highlights: nextData.highlights, editorial },
          criticSourceOf({
            name: sources.lead.name,
            town: sources.lead.city ?? null,
            address: sources.lead.address,
            rating: siteData.rating ? { value: siteData.rating.value, count: siteData.rating.count ?? null } : null,
            facts: criticFactsOf(sources, inputs),
            descriptions: sources.descriptions,
            reviews: [],
          }),
        )
      : Promise.resolve({});
  const [fact, marketRaw, critic] = await Promise.all([factP, marketP, criticP]);
  // The critic wins a contradiction (ADR-XXXX): what it objected to, the market may not demand.
  const market = subordinateToCriticInputs(marketRaw, critic, marketSourceOf(sources, siteData));

  await writeFile(row.path, html, "utf8");
  const patch = {
    recipe: nextRecipe,
    siteData: nextData,
    copyManual: plan.manual,
    designVerdict: design.verdict,
    designReason: design.reason ?? null,
    factVerdict: fact.verdict,
    factUnsourced: fact.facts.filter((f) => !f.sourced).map((f) => f.fact),
    factCandidates: fact.candidates.length,
    marketVerdict: market.verdict,
    marketReason: market.reason ?? null,
    marketFactsNamed: market.factsNamed ?? [],
    marketMissed: market.missed ?? [],
    ...critic,
  };
  // MERGE, never replace the whole blob: the hero pin, the recopy and the verdict ack
  // write the same `inputs` (mockVerdictGate.ts). The old ack goes: new words, new finding.
  await db
    .updateTable("mock_artifact")
    .set({
      inputs: sql`(coalesce(inputs, '{}'::jsonb) - 'verdictAck') || ${JSON.stringify(patch)}::jsonb` as never,
    })
    .where("id", "=", artifactId)
    .execute();

  const criticVerdict = typeof critic.guestCriticVerdict === "string" ? critic.guestCriticVerdict : null;
  const blocked = fact.verdict !== "pass" || market.verdict === "flag" || market.verdict === "error" ||
    criticVerdict === "flag" || criticVerdict === "error";
  const n = Object.keys(plan.manual).length;
  return {
    ok: true,
    message: blocked
      ? `Mentve (${plan.changed.length} mező) — de egy őr fennakadt rajta, így kiküldeni csak nyugtázással lehet.`
      : `Mentve (${plan.changed.length} mező) — az őrök átengedték. A kinézet, a fotók és az elrendezés változatlan.`,
    manualCount: n,
    verdicts: { fact: fact.verdict, market: market.verdict, critic: criticVerdict, design: design.verdict },
    factUnsourced: patch.factUnsourced,
  };
}
