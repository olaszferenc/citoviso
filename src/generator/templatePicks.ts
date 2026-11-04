// The curator's template pick, honoured EXACTLY or refused out loud.
//
// ⛔ MEASURED (Poe2, 2026-11-04: „Parallax + Fejezetes” → two Parallax / Parallax + Fullbleed on
// Martina 9f5723d0 and Balatinus 00ec9215): the console filtered the requested ids through
// isPickableTemplate and DEDUPED them without a word. A label sent for an id („Fejezetes”), a
// retired id or a repeated one simply vanished — the run went on with what was left (one
// mock), and /generate with nothing left fell to the default template (fullbleed). The
// curator then saw a pair it never asked for. Now every requested id must be a pickable
// template, each at most once, or the request is refused with the offending value named.
import { isPickableTemplate, TEMPLATES } from "../engine/templates.js";

/**
 * Templates the OWNER banned from new mocks — refused by id here and in the engine, whatever
 * the registry's `retired` flag says (ADR-XXXX, 2026-11-04: „soha többet nem lehet a
 * fejezetest mock típust használni”). The old mocks still render; no new one is ever made.
 */
export const OWNER_BANNED_TEMPLATES: ReadonlyMap<string, string> = new Map([
  ["horizontal", "a tulaj 2026-11-04-én végleg kivezette („soha többet nem lehet a fejezetest mock típust használni”)"],
]);

/** May a NEW mock be made with this template id? (registry pickable AND not owner-banned) */
export function isNewMockTemplate(id: string): boolean {
  return isPickableTemplate(id) && !OWNER_BANNED_TEMPLATES.has(id);
}

/** The second design's default when a pair is wanted and the curator named one (ADR-XXXX). */
export const SECOND_TEMPLATE_DEFAULT = "fullbleed";

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
      message: `${banned.map(templateShortName).join(", ")}: ${OWNER_BANNED_TEMPLATES.get(banned[0]!)}. Válasszon másik sablont (második tervnek: ${templateShortName(SECOND_TEMPLATE_DEFAULT)}).`,
    };
  }
  const unknown = ids.filter((t) => !isPickableTemplate(t));
  if (unknown.length) {
    return {
      ok: false,
      message: `Ismeretlen vagy kivezetett sablon: ${unknown.map((t) => `„${t}”`).join(", ")} — a kért pár nem teljesíthető, nem generáltam.`,
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
  if (requested && rendered !== requested) {
    throw new Error(
      rendered
        ? `A kért sablon (${templateShortName(requested)}) nem teljesült, helyette ez készült volna: ${templateShortName(rendered)}. Nem mentettem mockot.`
        : `A kért sablon (${templateShortName(requested)}) nem teljesült: használható fotó nélkül a sablon nem renderelhető. Nem mentettem mockot.`,
    );
  }
}
