// The curator's template pick, honoured EXACTLY or refused out loud.
//
// ⛔ MEASURED (Poe2, 2026-11-04: „Parallax + Fejezetes” → two Parallax / Parallax + Fullbleed on
// Martina 9f5723d0 and Balatinus 00ec9215): the console filtered the requested ids through
// isPickableTemplate and DEDUPED them without a word. A label sent for an id („Fejezetes”), a
// retired id or a repeated one simply vanished — the run went on with what was left (one
// mock), and /generate with nothing left fell to the default template (fullbleed). The
// curator then saw a pair it never asked for. Now every requested id must be a pickable
// template, each at most once, or the request is refused with the offending value named.
import { isPickableTemplate, OWNER_ALLOWED_TEMPLATES, TEMPLATES } from "../engine/templates.js";

/**
 * Templates the OWNER banned from new mocks — refused by id here and in the engine, whatever
 * the registry's `retired` flag says (ADR-0422, 2026-11-04: „soha többet nem lehet a
 * fejezetest mock típust használni”). The old mocks still render; no new one is ever made.
 */
export const OWNER_BANNED_TEMPLATES: ReadonlyMap<string, string> = new Map([
  ["horizontal", "a tulaj 2026-11-04-én végleg kivezette („soha többet nem lehet a fejezetest mock típust használni”)"],
]);

/** May a NEW mock be made with this template id? (registry pickable AND not owner-banned) */
export function isNewMockTemplate(id: string): boolean {
  return isPickableTemplate(id) && !OWNER_BANNED_TEMPLATES.has(id);
}

/**
 * The engine's template when a NON-console caller names none (public mock request, CLI). The
 * console has NO default (owner 2026-11-04: „random bazdmeg! amelyik jobb”): the curator picks
 * explicitly, or the request fails (requireExplicitPick). There is no second-plan default either.
 */
export const FIRST_TEMPLATE_DEFAULT = "parallax";

/** The owner's list, by its console names — every refusal names what IS allowed. */
export function allowedTemplateNames(): string {
  return [...OWNER_ALLOWED_TEMPLATES].map(templateShortName).join(", ");
}

export type TemplatePicks =
  | { readonly ok: true; readonly templates: readonly string[] }
  | { readonly ok: false; readonly message: string };

/** The console's short name of a template („Fejezetes”, „Parallax”). */
export function templateShortName(id: string): string {
  return (TEMPLATES[id]?.label.split(/[—:(]/)[0] ?? id).trim() || id;
}

/**
 * Validate the requested template ids. `max` = how many one run may hold (curated: 2).
 * Empty → ok with []: the caller decides whether that means "the default" (/generate) or
 * an error (/generate-curated). Never drops, never dedupes, never substitutes.
 */
export function resolveTemplatePicks(requested: readonly unknown[], max: number): TemplatePicks {
  const ids = requested.map((t) => String(t ?? "").trim()).filter((t) => t.length > 0);
  const banned = ids.filter((t) => OWNER_BANNED_TEMPLATES.has(t));
  if (banned.length) {
    return {
      ok: false,
      message: `${banned.map(templateShortName).join(", ")}: ${OWNER_BANNED_TEMPLATES.get(banned[0]!)}. Válasszon a megengedettek közül: ${allowedTemplateNames()}.`,
    };
  }
  const unknown = ids.filter((t) => !isPickableTemplate(t));
  if (unknown.length) {
    return {
      ok: false,
      message: `Nem választható sablon: ${unknown.map((t) => `„${TEMPLATES[t] ? templateShortName(t) : t}”`).join(", ")} — új mock csak ezekkel készülhet: ${allowedTemplateNames()}. A kért pár nem teljesíthető, nem generáltam.`,
    };
  }
  const repeated = ids.filter((t, i) => ids.indexOf(t) !== i);
  if (repeated.length) {
    return {
      ok: false,
      message: `Ugyanaz a sablon kétszer: ${[...new Set(repeated)].map(templateShortName).join(", ")} — két KÜLÖNBÖZŐ sablont válasszon.`,
    };
  }
  if (ids.length > max) return { ok: false, message: `Legfeljebb ${max} sablon választható (kért: ${ids.length}).` };
  return { ok: true, templates: ids };
}

/**
 * The engine's after-the-fact proof: the rendered recipe IS the requested template. The
 * template path needs photos; without them the engine composes a planner layout instead —
 * which must be a failure of THAT pick, not a mock wearing another design.
 */
export function assertTemplateHonoured(requested: string | undefined, rendered: string | undefined): void {
  // A banned template is never rendered for a NEW mock — not on request, not by any default.
  const banned = rendered && OWNER_BANNED_TEMPLATES.get(rendered);
  if (banned) throw new Error(`${templateShortName(rendered!)}: ${banned}. Nem mentettem mockot.`);
  // …nor any template outside the owner's list (a stale default, a CLI flag).
  if (rendered && !isPickableTemplate(rendered))
    throw new Error(`${templateShortName(rendered)}: új mockhoz nem választható (csak: ${allowedTemplateNames()}). Nem mentettem mockot.`);
  if (requested && rendered !== requested) {
    throw new Error(
      rendered
        ? `A kért sablon (${templateShortName(requested)}) nem teljesült, helyette ez készült volna: ${templateShortName(rendered)}. Nem mentettem mockot.`
        : `A kért sablon (${templateShortName(requested)}) nem teljesült: használható fotó nélkül a sablon nem renderelhető. Nem mentettem mockot.`,
    );
  }
}

/**
 * The console's rule: a mock is only made from an EXPLICIT pick of the owner's templates
 * (owner 2026-11-04: „random bazdmeg! amelyik jobb” — no fixed first or second plan). An empty
 * request is refused out loud, never filled with a default.
 */
export function requireExplicitPick(picks: TemplatePicks): TemplatePicks {
  if (picks.ok && picks.templates.length === 0) {
    return { ok: false, message: `Nincs kiválasztott sablon — válasszon kifejezetten: ${allowedTemplateNames()}. Alapértelmezett sablon nincs, nem generáltam.` };
  }
  return picks;
}
