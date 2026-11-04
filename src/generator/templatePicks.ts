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
  if (requested && rendered !== requested) {
    throw new Error(
      rendered
        ? `A kért sablon (${templateShortName(requested)}) nem teljesült, helyette ez készült volna: ${templateShortName(rendered)}. Nem mentettem mockot.`
        : `A kért sablon (${templateShortName(requested)}) nem teljesült: használható fotó nélkül a sablon nem renderelhető. Nem mentettem mockot.`,
    );
  }
}
