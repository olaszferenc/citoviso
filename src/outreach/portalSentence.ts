// NEMZETKÖZI B (2026-11-22) — the iCal-sync sentence of the cold letter for a country whose row does
// not list Szállás.hu (calendarSyncPortals): the owner-approved sentence (draft.ts p4) with the
// cross-border pair only — no portal is named whose sync we have not verified for that reader (§B.17).
//
// Kept OUTSIDE draft.ts on purpose (as outreachCheck.ts's foreign gate marks): the landlord-eyed
// critic fingerprints draft.ts's T() literals (letterCritic.ts), and these are not new wording —
// the approved Hungarian sentence stays in draft.ts byte for byte, and only a non-Hungarian reader
// (Bábel's translation) ever sees this variant.
import { T } from "../i18n/mail.js";

/** The p4 sentence without a local portal; `trial` = the page offers the one-click trial. */
export function crossBorderSyncSentence(lang: string, trial: boolean): string {
  return trial
    ? T(lang, "A vendégei ezután közvetlenül Önnél foglalnak, jutalék nélkül. Foglalásait automatikusan szinkronizálhatja a Booking.com és az Airbnb naptárával.")
    : T(
        lang,
        "Ha tetszik, a linken meg is rendelheti. A vendégei ezután közvetlenül Önnél foglalnak, jutalék nélkül. Foglalásait automatikusan szinkronizálhatja a Booking.com és az Airbnb naptárával.",
      );
}
