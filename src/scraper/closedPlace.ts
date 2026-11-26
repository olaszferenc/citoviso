// A CLOSED PLACE is no lead (coordinator 2026-11-25, blind run: „Prém-malom vendégház Closed” got a mock).
// The sources print the closing in the NAME — OSM's „(closed)”, a Maps title „… Closed”, „Végleg bezárt”,
// „Trajno zatvoreno”, „Dauerhaft geschlossen”. Country-agnostic: one list of the forms, matched as words.
// Where it lives: the scrape chain drops such a lead (scraper/enrichChain.ts), the generator refuses its mock
// (generator/generateEngine.ts), the send path skips it (outreach/sendBatch.ts), and the town-photo gathering
// never counts it (media/townPhotoSet.ts). The marker never leaves a name on a page: the lead never reaches one.

const CLOSED_NAME =
  /(?:^|[\s(\[\-–—,.:;])(?:permanently\s+closed|temporarily\s+closed|closed|végleg\s+bezárt|bezárt|megszűnt|trajno\s+zatvoreno|zatvoreno|dauerhaft\s+geschlossen|geschlossen|chiuso|fermé|zamknięte|zavřeno|zatvorené|închis)(?=$|[\s)\]\-–—,.:;!])/i;

/** Does the place's own name say it is closed? */
export function isClosedPlaceName(name: string | null | undefined): boolean {
  return typeof name === "string" && CLOSED_NAME.test(name);
}

/** The same pattern for PostgreSQL's `~*` (its regex dialect reads `(?:…)`, `(?=…)` and `\\s` as JavaScript does). */
export const CLOSED_NAME_SQL_PATTERN = CLOSED_NAME.source;
