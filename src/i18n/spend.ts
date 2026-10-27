/**
 * Translation trigger label — a RETIRED remnant of the translation meter (migration 0092).
 *
 * Until 2026-10-27 every AI translation call landed as one `translation_spend` row here,
 * attributed to the entry point that asked for it (boot / deploy / cli / on-demand).
 *
 * ⛔ RETIRED (2026-10-27, ADR-XXXX): translation by API call is forbidden — translations come
 * only from Bábel's subscription session — so nothing records any more and the ledger writer
 * is gone; `translation_spend` stays as a historical table. Only `withTranslationTrigger`
 * still has a caller (the public server's boot block, where it is now a plain pass-through);
 * this file goes with the next change of src/server/public.ts (its booking-outcome-truth-check
 * gate was red on clean main on 2026-10-27, so that file was left untouched).
 */
export type TranslationTrigger = "boot" | "deploy" | "cli" | "on-demand";

/** Pass-through kept for the public server's boot block (see the header). */
export function withTranslationTrigger<T>(_t: TranslationTrigger, fn: () => Promise<T>): Promise<T> {
  return fn();
}
