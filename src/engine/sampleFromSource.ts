// The mock's SAMPLE blocks, read against the lead's own source (§B.17, ADR-XXXX).
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
  const units = [
    ...listed.map(fold),
    ...descriptions.flatMap((d) => fold(d).split(/[.!?;\n]+/)),
  ].filter((u) => NEGATION.test(u));
  return SAMPLE_AMENITY_TYPES.filter((t) => units.some((u) => t.re.test(u))).map((t) => t.key);
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
 * The services sample's items: the source's own offers first (strongest first,
 * refusals out), topped up with generic types the source does not
 * contradict — six at most, the block's approved size.
 */
export function sampleAmenityItems(
  sourced: readonly string[],
  generic: readonly { readonly key: string; readonly label: string }[],
  deny: readonly string[],
  max = 6,
): string[] {
  const items: string[] = [];
  const kinds = new Set<string>();
  // The source items arrive already one per facility kind (the generator's buckets are
  // finer than these six types — „Kerthelyiség” and „Erkély/terasz” are two facts); here
  // they only block the generic type they cover.
  for (const s of sourced) {
    if (items.length >= max) break;
    if (isNegatedItem(s) || items.includes(s)) continue;
    const kind = sampleTypeOf(s);
    if (kind) kinds.add(kind);
    items.push(s);
  }
  for (const g of generic) {
    if (items.length >= max) break;
    if (kinds.has(g.key) || deny.includes(g.key)) continue;
    kinds.add(g.key);
    items.push(g.label);
  }
  return items;
}
