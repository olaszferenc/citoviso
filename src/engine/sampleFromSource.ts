// The mock's SAMPLE blocks, read against the lead's own source (§B.17, ADR-0338).
//
// A sample block is marked "Minta", but its ITEMS still read as statements about the
// house. Measured 2026-10-07 on the pilot dispatch (four leads held back):
//   · Partvilla — the services sample listed „Kisállat”; the verified listing says
//     „Háziállat nem engedélyezett”. A marked sample that contradicts the source is
//     still a false sentence about this property.
//   · Főnix — the rooms sample showed „1.–3. szoba”; the owner's own prose names two
//     apartments, „Family” and „Gold”. The count 3 came from nowhere.
// Pure, deterministic (mock=live safe): the generator computes the hints once, the
// renderer only reads them.

/** A generic service TYPE the services sample may show, with what names it in a source. */
export interface SampleAmenityType {
  readonly key: string;
  /** Hungarian source label (translated with T() at render time). */
  readonly hu: string;
  /** Matches the type in a deaccented, lowercased source text. */
  readonly re: RegExp;
}

// ⛔ The labels are the i18n catalogue keys of the services sample — the render side
// translates them through literal T() calls (moduleSections.ts), which the extractor reads.
export const SAMPLE_AMENITY_TYPES: readonly SampleAmenityType[] = [
  { key: "wifi", hu: "Ingyenes wifi", re: /wi-?fi|internet/ },
  { key: "parking", hu: "Parkolás", re: /parkol/ },
  { key: "breakfast", hu: "Reggeli", re: /reggeli|breakfast/ },
  { key: "ac", hu: "Klíma", re: /klima|legkondi|air.?condition/ },
  { key: "terrace", hu: "Terasz, kert", re: /terasz|(?<![a-z])kert(?!esz)|erkely|balcon|garden/ },
  { key: "pets", hu: "Kisállat", re: /allat|kutya|macska|(?<![a-z])pets?(?![a-z])|(?<![a-z])dogs?(?![a-z])/ },
];

/** A negation that turns a listing item or a prose sentence into a refusal. */
const NEGATION = /(?<![a-z])(?:nem|nincs|nincsen|nelkul|tilos|not|no)(?![a-z])/;

/**
 * Meals refused without the word „reggeli” (2026-10-21, live mocks): „Önellátó szálláshely”
 * (Dunapart Villa) and „Ellátást nem tudnak biztosítani a szállodában” (Hotel Garni). Both
 * deny the breakfast type; self-catering needs no negation word to say so.
 */
const SELF_CATERING = /onellat/;
const MEAL_SERVICE = /(?<![a-z])ellatas/;

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The generic sample types the SOURCE contradicts: a listing item or a prose sentence
 * that names the type AND negates it („Háziállat nem engedélyezett”, „kisállatot nem
 * fogadunk”). Conservative by design — a false hit only DROPS a sample item, which
 * is the safe direction; it never adds a claim.
 */
export function deniedSampleTypes(
  listed: readonly string[],
  descriptions: readonly string[],
): string[] {
  const all = [
    ...listed.map(fold),
    ...descriptions.flatMap((d) => fold(d).split(/[.!?;\n]+/)),
  ];
  const units = all.filter((u) => NEGATION.test(u));
  const deny = SAMPLE_AMENITY_TYPES.filter((t) => units.some((u) => t.re.test(u))).map((t) => t.key);
  const noMeals =
    all.some((u) => SELF_CATERING.test(u) && !/(?<![a-z])nem onellat/.test(u)) ||
    units.some((u) => MEAL_SERVICE.test(u));
  if (noMeals && !deny.includes("breakfast")) deny.push("breakfast");
  return deny;
}

/** Is this listing item a refusal rather than an offer („Háziállat nem engedélyezett”)? */
export function isNegatedItem(label: string): boolean {
  return NEGATION.test(fold(label));
}

/** Which generic sample type (if any) a label names — one item per kind on the block. */
export function sampleTypeOf(label: string): string | null {
  const f = fold(label);
  return SAMPLE_AMENITY_TYPES.find((t) => t.re.test(f))?.key ?? null;
}

/**
 * Unit NAMES the owner's own prose gives („Family nevű apartmanunk”, „A Gold
 * apartmanunk”). Only two shapes count, both of which can only be a name: the explicit
 * „X nevű …” and the possessive „X apartmanunk/szobánk/lakosztályunk” with a
 * capitalised X. A word of the property's own name is never a unit name („A Vitorlás
 * apartmanunk” is the house). Hungarian prose only — the type word is Hungarian.
 */
export function unitNamesFromProse(descriptions: readonly string[], leadName: string): string[] {
  const own = new Set(fold(leadName).split(/[^\p{L}\d]+/u).filter(Boolean));
  const NAME = "([A-ZÁÉÍÓÖŐÚÜŰ][\\p{L}\\d-]{1,24})";
  const shapes: readonly (readonly [RegExp, (m: RegExpMatchArray) => string])[] = [
    [new RegExp(`${NAME}\\s+nevű\\s+(apartman|szob|lakosztály|stúdió|faház)`, "gu"), (m) => m[2]!],
    [
      new RegExp(`(?<![\\p{L}])${NAME}\\s+(apartman|szob|lakosztály|stúdió|faház)(?:unk|ánk|ünk)(?![\\p{L}])`, "gu"),
      (m) => m[2]!,
    ],
  ];
  const out = new Map<string, string>();
  for (const text of descriptions) {
    for (const [re, typeOf] of shapes) {
      for (const m of text.matchAll(re)) {
        const name = m[1]!;
        const type = typeOf(m) === "szob" ? "szoba" : typeOf(m);
        const key = fold(name);
        // Sentence-initial articles and pronouns are capitalised too; they are not names.
        if (/^(a|az|egy|ez|ezen|minden|mindegyik|sajat|kedves|uj|felujitott)$/.test(key) || own.has(key)) continue;
        if (!out.has(key)) out.set(key, `${name} ${type}`);
      }
    }
  }
  return [...out.values()].slice(0, 8);
}

/**
 * The services sample's items: ONLY the source's own offers (strongest first), refusals
 * and denied types out, six at most — the block's approved size. No generic top-up
 * (2026-10-21, ADR-0404): „Reggeli” stood under „Amit kínálunk” on a self-catering villa
 * (Dunapart) and on a lead with no amenities at all (Hosszúhegyi), because the block was
 * padded with generic types the source never stated. The „Minta” pill does not unsay a
 * service the guest reads as this house's. Nothing sourced → no item (the block shows its
 * empty frame and says so).
 */
export function sampleAmenityItems(
  sourced: readonly string[],
  deny: readonly string[],
  max = 6,
): string[] {
  const items: string[] = [];
  // The source items arrive already one per facility kind (the generator's buckets are
  // finer than these six types — „Kerthelyiség” and „Erkély/terasz” are two facts).
  for (const s of sourced) {
    if (items.length >= max) break;
    if (isNegatedItem(s) || items.includes(s)) continue;
    const kind = sampleTypeOf(s);
    if (kind && deny.includes(kind)) continue;
    items.push(s);
  }
  return items;
}

/** The generic sample types the source AFFIRMS — read off its own offers on the mock. */
export function affirmedSampleTypes(sourced: readonly string[]): Set<string> {
  const kinds = new Set<string>();
  for (const s of sourced) {
    if (isNegatedItem(s)) continue;
    const kind = sampleTypeOf(s);
    if (kind) kinds.add(kind);
  }
  return kinds;
}

/**
 * Does the prose state a room number OTHER than `count`? Measured 2026-10-21, Hotel Garni:
 * the portal's room-count field caught „3 db szoba légkondicionált” (a subset), while the
 * same text says „9 szobában összesen 24 főt tudnak fogadni” — the mock showed „1.–3. szoba”.
 * Any differing number before a room word means the field is not THE count, so the caller
 * drops it (one „Az egész szállás” card) rather than picking a number. Conservative: a
 * false hit only removes a number, never adds one.
 */
export function roomCountContradicted(count: number, descriptions: readonly string[]): boolean {
  const ROOM_NUMBER =
    /(?<![\d.,])(\d{1,3})\s*(?:db\.?\s+|darab\s+)?(?:[a-z]+\s+){0,2}?(?:szoba|szobas|vendegszoba|apartman|lakosztaly)/g;
  for (const d of descriptions) {
    for (const m of fold(d).matchAll(ROOM_NUMBER)) {
      if (Number(m[1]) !== count) return true;
    }
  }
  return false;
}

/**
 * Is the property let ONLY as a whole? Measured 2026-10-21, Szömörce fe105370: „Csak egyben
 * adjuk ki, így a ház és a kert … csak a tiétek” — yet the mock showed four separately
 * bookable „1.–4. szoba” cards from the four bedrooms. A whole-only house has ONE bookable
 * unit, so the caller drops the numbered/named sample cards (one „Az egész szállás” card).
 * „Egyben is kiadó” (rooms AND whole) and „nem csak egyben” keep the rooms.
 */
export function wholeLetOnly(descriptions: readonly string[]): boolean {
  const WHOLE_ONLY =
    /(?<![a-z])(?:csak|kizarolag)\s+(?:egyben|egeszben)(?![a-z])|(?<![a-z])(?:egyben|egeszben)\s+(?:adjuk|adom|adjak|kiado|berelheto|foglalhato)(?![a-z])/;
  const NOT_ONLY = /(?<![a-z])nem\s+(?:csak|kizarolag)\s+(?:egyben|egeszben)(?![a-z])/g;
  return descriptions.some((d) => WHOLE_ONLY.test(fold(d).replace(NOT_ONLY, " ")));
}

/**
 * Does the source SAY the place can be let as a whole — only or also? The one sample card
 * may read „Az egész szállás” on this evidence alone (TARTVA ×30, 2026-10-26: it was the
 * default, and stood on panziók, hotels and apartment houses). „Csak egyben adjuk ki”,
 * „egyben is kiadó”, „a teljes ház kibérelhető”, „az egész nyaraló a vendégeké”,
 * „kizárólagos használat”. A house's description („a ház három hálószobás”) is no such
 * statement; „nem adjuk ki egyben” is the opposite.
 */
export function wholeLetStated(descriptions: readonly string[]): boolean {
  if (wholeLetOnly(descriptions)) return true;
  const WHOLE =
    /(?<![a-z])(?:egyben|egeszben)\s+is\s+(?:kiado|berelheto|kiberelheto|foglalhato|kiadjuk|kiadom)(?![a-z])|(?<![a-z])(?:a\s+)?(?:teljes|egesz)\s+(?:haz|hazat|villa|villat|nyaralo|nyaralot|ingatlan|ingatlant|vendeghaz|vendeghazat|szallas|szallast|lakas|lakast|epulet|epuletet)\s+(?:[a-z]+\s+){0,3}?(?:kiado|berelheto|kiberelheto|foglalhato|a\s+vendegeke|az\s+onoke|a\s+tietek|a\s+tied|csak\s+az\s+onoke|kizarolag)|(?<![a-z])kizarolagos\s+hasznal/;
  const NEGATED = /(?<![a-z])nem\s+(?:adjuk|adom|adjak|kiado|berelheto|foglalhato)\s+(?:ki\s+)?(?:egyben|egeszben)(?![a-z])/g;
  return descriptions.some((d) => WHOLE.test(fold(d).replace(NEGATED, " ")));
}

/**
 * Which kinds of units does the source say it lets, when it gives no count and no names?
 * Measured 2026-10-26, Barackvirág Panzió 00660191: „Apartmanok és kétágyas szobák
 * igényelhetők … klímás szobáihoz” — the mock's one sample card read „Az egész szállás”,
 * a claim that the place is let as a whole. Several units only on evidence that SAYS so:
 * a room-letting lodging type (panzió, hotel, szálloda, fogadó, motel) in the name or the
 * prose; rooms let BY TYPE or offered („kétágyas szobák”, „szobák igényelhetők / kiadók”);
 * plural apartments („apartmanok”, „apartmanjaink”, „3 apartmanban”, an „Apartmanház” /
 * „Apartmanok” name). „A szobák klimatizáltak” alone is the
 * description of one house's rooms and changes nothing. Null = no kind stated (the caller then
 * asks wholeLetStated before the card may say „Az egész szállás”).
 */
export function unitKindOf(
  descriptions: readonly string[],
  leadName: string,
): "rooms" | "apartments" | "both" | null {
  const hay = descriptions.map(fold).join(" ");
  const ROOM_TYPES = /(?<![a-z])(?:panzio|hotel|szalloda|fogado|motel)(?![a-z])/;
  const ROOMS_LET =
    /(?<![a-z])(?:egy|ket|harom|negy|tobb)agyas\s+(?:vendeg)?szob(?:ak|akat|akban)(?![a-z])|(?<![a-z])(?:vendeg)?szob(?:ak|akat)\s+(?:[a-z]+\s+)?(?:igenyelhet|kiado|foglalhat|berelhet)/;
  const APTS = /(?<![a-z])apartman(?:ok|okat|okban|okkal|okhoz|jaink|jainkat|jainkban)(?![a-z])/;
  // A number of apartments („3 apartmanban kínál 13 személynek” — Kalandor ad440016,
  // 2026-10-26). Only a neutral word may stand between: „2 hálószobás apartman”, „4 fős
  // apartman” describe ONE apartment.
  const APTS_COUNTED =
    /(?<![a-z\d.,])(?:[2-9]|[1-9]\d|ket|harom|negy|ot|hat|het|nyolc|kilenc|tiz)\s+(?:(?:db\.?|darab|kulon|kulonallo|onallo|kulonbejaratu|modern|felujitott|tagas|igenyes|kenyelmes|komfortos)\s+)?(?:studio)?apartman(?!os)[a-z]*/;
  // A name that is itself plural or a house OF apartments („EmZi Apartmanok”, „ALRO Stúdió
  // Apartmanház”, „Belvárosi Apartmanház”) — the owner's own word for several units.
  const APTS_NAME = /(?<![a-z])apartman(?:ok|haz)(?![a-z])/;
  const rooms = ROOM_TYPES.test(fold(leadName)) || ROOM_TYPES.test(hay) || ROOMS_LET.test(hay);
  const apts = APTS.test(hay) || APTS_COUNTED.test(hay) || APTS_NAME.test(fold(leadName));
  return rooms && apts ? "both" : rooms ? "rooms" : apts ? "apartments" : null;
}
