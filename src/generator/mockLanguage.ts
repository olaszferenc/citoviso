// ORSZÁG-RÉTEG 3/6 (ADR-0457): THE MOCK'S LANGUAGE GATE — a non-Hungarian mock may be offered to its
// lead only when every visible text of it is in the country's language.
//
// Owner's rule (2026-11-17, through the coordinator): a non-Hungarian lead gets NOTHING in Hungarian,
// not one word. The generated copy is written in the target language by the writer; the page's
// FIXED strings (section titles, sample notes, the booking widget, the credit strip) come from
// Bábel's pack, and a missing one falls back to Hungarian at render time (packs.tSync). So the
// render MEASURES its own fallbacks — the ADR-0456 pattern of the cold letter (`untranslated`):
//   · server-side: every T() of renderSite() that fell back (collectFallbacks);
//   · client-side: every `tr("…")` literal of the runtime the pack lacks (runtimeUntranslated).
// The verdict rides on mock_artifact.inputs as `langVerdict` ("pass" | "flag") + `langReason` +
// `langUntranslated`, next to the other guard verdicts; the outreach send gate
// (mockVerdictGate.blockingVerdicts) holds a "flag" — and, unlike the other guards, it can NOT be
// acknowledged away: Hungarian on a foreign lead's page is never "send anyway".
// A Hungarian mock carries no such key (nothing to measure) — its inputs stay as they were.
//
// After Bábel delivers the language: `npx tsx scripts/rerender-mock.mts <artifactId>` re-renders
// and re-measures (the stored flag clears only with a render that no longer falls back).

import { sql } from "kysely";

import { db } from "../db/client.js";
import { renderSite } from "../engine/render.js";
import type { Recipe, RenderPhase, SiteData } from "../engine/recipe.js";
import { collectFallbacks } from "../i18n/packs.js";
import { injectRuntime, runtimeUntranslated } from "./runtime.js";

/** What the gate stores on mock_artifact.inputs for a non-Hungarian mock. */
export interface MockLanguageInputs {
  readonly langVerdict: "pass" | "flag";
  readonly langReason: string | null;
  readonly langUntranslated: readonly string[];
}

/** The verdict for a page in `lang` given the source strings that fell back to Hungarian.
 *  Hungarian (or no language) → null: nothing is stored. */
export function mockLanguageVerdict(lang: string | undefined, untranslated: Iterable<string>): MockLanguageInputs | null {
  if (!lang || lang === "hu") return null;
  const list = [...new Set(untranslated)];
  return {
    langVerdict: list.length ? "flag" : "pass",
    langReason: list.length
      ? `${list.length} felirat nincs ${lang} nyelven (Bábelre vár) — magyar szó nem mehet ki: ${list
          .slice(0, 3)
          .map((u) => `„${u.slice(0, 60)}”`)
          .join(" · ")}`
      : null,
    langUntranslated: list,
  };
}

/**
 * renderSite + injectRuntime, measured: the page and its language verdict (null on a Hungarian
 * page). `extra` = fallbacks the caller collected BEFORE the render (e.g. the stats label).
 */
export async function renderMockMeasured(
  recipe: Recipe,
  siteData: SiteData,
  opts: Parameters<typeof renderSite>[2] & { phase?: RenderPhase },
  extra: Iterable<string> = [],
): Promise<{ html: string; language: MockLanguageInputs | null }> {
  const lang = siteData.lang;
  const { value: base, fallbacks } = collectFallbacks(() => renderSite(recipe, siteData, opts));
  const html = await injectRuntime(base, lang, opts?.phase ?? "mock");
  const runtime = await runtimeUntranslated(lang, opts?.phase ?? "mock");
  return { html, language: mockLanguageVerdict(lang, [...extra, ...fallbacks, ...runtime]) };
}

/** Store a re-measured verdict on an existing artifact (targeted jsonb merge — other writers
 *  touch `inputs` too). A Hungarian page (null) writes nothing. */
export async function persistMockLanguage(artifactId: string, language: MockLanguageInputs | null): Promise<void> {
  if (!language) return;
  await db
    .updateTable("mock_artifact")
    .set({ inputs: sql`coalesce(inputs, '{}'::jsonb) || ${JSON.stringify(language)}::jsonb` as never })
    .where("id", "=", artifactId)
    .execute();
}
