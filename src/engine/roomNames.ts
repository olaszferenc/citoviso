// Room names a portal publishes in ENGLISH on a Hungarian page (booked.hu, 2026-10-26: Lunczer
// d86a6f11 — „Private Bathroom Twin Room”, „Family Private Bathroom Room” on the cards and in
// the alts). booked.hu's own Hungarian names keep the trade words it uses itself („Superior
// kétszemélyes szoba”, „Queen szoba”) — those are left as they are. Deterministic, no AI:
// a known English type → its Hungarian name with the listing's own qualifiers; an English
// name with no known type → a neutral „Szoba” rather than a foreign label.

/** Already Hungarian (or mixed the way booked.hu writes it) — never touched. */
const HUNGARIAN = /szob|apartman|stúdió|studio apartman|lakosztály|ház|villa|nyaraló|padlás|bérlakás|hálószobás/i;
/** Looks like an English unit name. */
const ENGLISH = /\b(?:room|suite|apartment|studio|house|home|cottage|chalet|bungalow|dorm(?:itory)?)\b/i;

const BEDROOMS: Record<string, string> = { one: "Egy", "1": "Egy", two: "Két", "2": "Két", three: "Három", "3": "Három", four: "Négy", "4": "Négy" };

/** Unit type, most specific first. */
const TYPES: readonly (readonly [RegExp, string])[] = [
  [/\bsuite\b/i, "lakosztály"],
  [/\bstudio\b/i, "stúdió"],
  [/\bapartment\b/i, "apartman"],
  [/\bholiday\s+(?:house|home)\b/i, "nyaraló"],
  [/\b(?:house|home|cottage|chalet)\b/i, "ház"],
  [/\bbungalow\b/i, "bungaló"],
  [/\bdorm(?:itory)?\b/i, "hálóterem"],
  [/\btwin\b/i, "ikerszoba"],
  [/\bdouble\b/i, "kétszemélyes szoba"],
  [/\btriple\b/i, "háromszemélyes szoba"],
  [/\bquadruple\b/i, "négyszemélyes szoba"],
  [/\bsingle\b/i, "egyszemélyes szoba"],
  [/\bqueen\b/i, "Queen szoba"],
  [/\bking\b/i, "King szoba"],
  [/\bfamily\b/i, "családi szoba"],
  [/\broom\b/i, "szoba"],
];

/** Qualifiers carried over (the listing's own words, in Hungarian where Hungarian has one). */
const QUALITY = /\b(deluxe|superior|standard|economy|comfort|classic|basic|budget|premium|executive)\b/i;
const MODIFIERS: readonly (readonly [RegExp, string])[] = [
  [/\bprivate\s+bathroom\b/i, "saját fürdőszobás"],
  [/\bshared\s+bathroom\b/i, "közös fürdőszobás"],
  [/\bbalcony\b/i, "erkélyes"],
  [/\bterrace\b/i, "teraszos"],
];

/** The Hungarian name for an English unit name; anything else comes back unchanged. */
export function hungarianRoomName(name: string): string {
  const n = name.trim();
  if (!n || HUNGARIAN.test(n) || !ENGLISH.test(n)) return n;
  const type = TYPES.find(([re]) => re.test(n))?.[1] ?? "szoba";
  // „Family … Room” keeps „családi” even when the type word is the generic room.
  const family = /\bfamily\b/i.test(n) && type !== "családi szoba" ? "családi" : "";
  const bedrooms = /\b(one|two|three|four|[1-4])[-\s]bedroom\b/i.exec(n)?.[1]?.toLowerCase();
  const quality = QUALITY.exec(n)?.[1];
  const parts = [
    quality ? quality.charAt(0).toUpperCase() + quality.slice(1).toLowerCase() : "",
    family,
    ...MODIFIERS.filter(([re]) => re.test(n)).map(([, hu]) => hu),
    bedrooms ? `${BEDROOMS[bedrooms]!.toLowerCase()} hálószobás` : "",
    type,
  ].filter(Boolean);
  const out = parts.join(" ");
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/** booked.hu's bed line in English („2 Bunk beds”, „1 Single Bed or 1 Double Bed”, „King Size
 *  Beds”) → the Hungarian words booked.hu itself uses elsewhere; other text is left as is. */
const BEDS: readonly (readonly [RegExp, string])[] = [
  [/\bbunk\s+beds?\b/gi, "emeletes ágy"],
  [/\bsofa\s+beds?\b/gi, "kanapéágy"],
  [/\b(?:king|queen)\s+size\s+beds?\b/gi, "nagy franciaágy"],
  [/\bdouble\s+beds?\b/gi, "franciaágy"],
  [/\bsingle\s+beds?\b/gi, "egyszemélyes ágy"],
  [/\btwin\s+beds?\b/gi, "külön ágy"],
  [/\bbeds?\b/gi, "ágy"],
  [/\s+or\s+/gi, " vagy "],
  [/\s+and\s+/gi, " és "],
];
export function hungarianBedNote(note: string): string {
  if (!/\b(?:beds?|bunk)\b/i.test(note)) return note;
  return BEDS.reduce((s, [re, hu]) => s.replace(re, hu), note);
}
