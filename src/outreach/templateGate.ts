// RETIRED-TEMPLATE GATE — a mock on a template outside the owner's list (ADR-0423) never goes
// out again and never becomes a site. ADR-0423 closed only the GENERATION door: the console
// picker, the generator and the engine refuse a retired template for a NEW mock. The send
// paths that re-use an OLD mock (non-opener follow-up, trial campaign, behaviour message, the
// shared SMS/MMS chain) and the trial start never asked which template the mock was built on.
// Measured on prod 2026-11-24: 39 follow-up letters (11-17…11-18) carried a horizontal /
// fullbleed / tilted-gallery mock, and the Freedom 50 trial (11-24) was built on horizontal.
// Owner, 2026-11-26: „1 ok javítsd”.
//
// Old mocks still RENDER on their old links (ADR-0423) — this gate only stops them from being
// pushed again or turned into a new site.

import { db } from "../db/client.js";
import { isPickableTemplate } from "../engine/templates.js";

/** The template a mock was rendered with; null = a legacy HTML-copy mock (no recipe). */
export function artifactTemplateOf(inputs: unknown): string | null {
  const i = (inputs ?? {}) as { recipe?: { template?: unknown }; siteData?: unknown };
  if (!i.recipe || !i.siteData) return null;
  return typeof i.recipe.template === "string" ? i.recipe.template : null;
}

/** Is this mock on one of the owner's templates (parallax · gate-opening · wordmark-grow)? */
export function isCurrentTemplateArtifact(inputs: unknown): boolean {
  const t = artifactTemplateOf(inputs);
  return t !== null && isPickableTemplate(t);
}

/** Operator-facing reason when the mock is on a retired template; null = it may go out. */
export function retiredTemplateReason(inputs: unknown): string | null {
  if (isCurrentTemplateArtifact(inputs)) return null;
  const t = artifactTemplateOf(inputs);
  return `a mock kivezetett sablonon készült (${t ?? "régi HTML-másolat"}) — csak a tulaj három sablonja mehet ki (ADR-0423); friss mock után mehet`; // i18n-exempt: operátori kimenet
}

/** The same check by artifact id (null id = nothing to judge, the caller's own gate answers). */
export async function retiredTemplateBlocks(artifactId: string | null): Promise<string | null> {
  if (!artifactId) return null;
  const art = await db.selectFrom("mock_artifact").select("inputs").where("id", "=", artifactId).executeTakeFirst();
  if (!art) return null;
  return retiredTemplateReason(art.inputs);
}
