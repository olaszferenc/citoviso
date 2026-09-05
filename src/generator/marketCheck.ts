// MARKETING-RELEVANCE gate (marketinges kontextus-őr) — owner ruling 2026-08-31.
//
// WHY THIS EXISTS. The mock is not a poem, it is a cold customer acquisition asset:
// the lead opens it once and decides in seconds whether we understood their property.
// A mock led with "Fenyőillatú csend a tető alatt" and offered, as its top highlight,
// "Olvasnivalóval teli könyvespolc a nappaliban" — for a property whose own listing
// advertises a playground, a garden, a private car park, a cot and a high chair. The
// owner's verdict: it would be funny if it were meant as a joke, and this is NOT a joke.
//
// The three existing gates could not catch it, because none of them measures this:
//   factCheck    — is every hard fact SOURCED?   (the bookshelf was real: it was in the photo)
//   designCheck  — emoji, tokens, module hooks?  (all fine)
//   provenance   — is the demo framing present?  (present)
// A mock can pass all three and still say nothing a guest could act on. That is the
// gap this module closes: not "is it true" and not "is it pretty", but
//   WOULD SOMEONE LOOKING FOR A PLACE TO STAY LEARN WHAT THEY WOULD GET HERE?
//
// TWO LAYERS, ON PURPOSE (the "heuristic guard needs a structural twin" doctrine).
// An LLM judging copy is a taste heuristic, and a heuristic that fails quietly is
// worse than no guard. So the cheap, deterministic question runs FIRST and cannot be
// talked out of its answer: of the guest-decision facts we HANDED the writer, how many
// did the sales surface actually use? Zero used, while a pool and a playground sat in
// the source list, is a structural failure — no API call, no opinion, no argument.
// The marketing judge then runs on what survives, to catch what token overlap cannot
// (a fact named but buried, a claim that misleads, a headline that says nothing).
//
// VERDICT ONLY — it judges, it does not rewrite. `critique` is written to be fed back
// into ONE regeneration; a second failure records "flag", and the outreach send gates
// (sendBatch / sendOutreachSms) already refuse a flagged artifact, so a bad mock stops
// at the curator instead of landing in a stranger's mailbox.

import { recordAiUsage } from "../ai/usage.js";
import type AnthropicNS from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { deaccent } from "../scraper/enrichPresence.js";
import { MATERIAL_WORDS } from "./highlightValue.js";
import { toImageBlocks } from "./images.js";

/** The copy that does the SELLING — the part a lead reads before deciding. */
export interface SalesSurface {
  /** Hero H1 (the editorial lead) — the single most-read line on the page. */
  readonly heroLead?: string;
  readonly heroEyebrow?: string;
  readonly tagline?: string;
  readonly intro?: string;
  readonly highlights: readonly string[];
}

/** The guest-decision truth we HELD about the property when the copy was written. */
export interface MarketSource {
  readonly name: string;
  /** The property's own town (never the region sweep label). */
  readonly town?: string | null;
  /** Verified amenities — the facts the copy was supposed to sell. */
  readonly amenities?: readonly string[];
  readonly roomCount?: number | null;
  readonly rating?: { value: number; count?: number | null } | null;
  /** The listing's own prose — the judge reads the property's MAIN claim from here. */
  readonly descriptions?: readonly string[];
}

export interface MarketVerdict {
  /** pass = the copy sells something real; flag = it does not; error = unverifiable. */
  readonly verdict: "pass" | "flag" | "error";
  /** Sourced guest-decision facts the sales surface actually names. */
  readonly factsNamed: string[];
  /** Strong selling points we HELD and the copy ignored — ranked, best first. */
  readonly missed: string[];
  /** Which layer decided: the deterministic twin or the marketing judge. */
  readonly layer: "structural" | "judge";
  readonly reason?: string;
  /** Concrete steering for ONE regeneration attempt. Empty when the verdict passed. */
  readonly critique?: string;
}

/**
 * Selling points ranked by how much they move an accommodation decision. Used ONLY to
 * order the `missed` list, so the critique leads with the pool rather than the kettle —
 * it never decides pass/fail, so an unranked amenity is not thereby second-class.
 */
const DECISION_WEIGHT: readonly (readonly [string, number])[] = [
  ["medence", 100], ["uszoda", 100], ["wellness", 90], ["szauna", 85], ["jacuzzi", 85],
  ["strand", 80], ["vizpart", 80], ["topart", 80], ["steg", 78], ["molo", 60], ["horgasz", 60],
  ["jatszoter", 75], ["gyerekbarat", 70], ["kisagy", 55], ["etetoszek", 50],
  ["parkol", 70], ["garazs", 65], ["toltoallomas", 55], ["elektromos jarmu", 55],
  ["kutyabarat", 65], ["haziallat", 60],
  ["kert", 60], ["terasz", 55], ["erkely", 50], ["panorama", 70], ["kilatas", 65],
  ["klima", 60], ["legkondicion", 60], ["reggeli", 65], ["etterem", 60],
  ["grill", 50], ["bogracs", 50], ["kemence", 50], ["konyha", 45],
  ["kerekpar", 45], ["mosogep", 40], ["wifi", 35], ["internet", 30], ["futes", 25],
];

/**
 * Guest-value words, deaccented. Used ONLY for the no-sourced-facts fallback above:
 * with no amenity list to compare against, this is the last question we can still ask —
 * does the copy name anything at all that a guest would use?
 */
const VALUE_VOCAB: readonly string[] = DECISION_WEIGHT.map(([w]) => w).concat([
  "strandkozel", "belepo", "kulcsatvetel", "csendes utca", "kozpont",
]);

function norm(s: string): string {
  return deaccent(s.toLowerCase()).replace(/\s+/g, " ").trim();
}

/**
 * Portal amenity lists are REDUNDANT: one property's listing carries "WIFI",
 * "Wifi a közösségi terekben", "Vezetékes internet a közösségi terekben" and
 * "Internetkapcsolat" as four separate items for one fact. Counting those as four
 * makes any "N things the copy leaves out" number a lie, so the console groups them
 * before it shows or counts anything (design contract: assets/design-refs/console/README.md).
 *
 * Deliberately NOT a general synonym engine: only the buckets that measurably collide
 * in our own data are merged, and anything unrecognised stays as its own group under its
 * own label — an unknown amenity must never be silently folded into a wrong bucket.
 */
const AMENITY_BUCKET: readonly (readonly [string, readonly string[]])[] = [
  ["Wifi / internet", ["wifi", "wi-fi", "internet"]],
  ["Babafelszerelés", ["kisagy", "etetoszek", "furdetokad", "baba", "pelenkazo", "gyerekagy"]],
  ["Klíma / fűtés", ["klima", "legkondicion", "futes"]],
  ["Parkolás", ["parkol", "garazs", "tolto"]],
  ["Kerékpár", ["kerekpar", "bicikli"]],
  ["Kert és grill", ["kert", "grill", "bogracs", "szalonnasut", "kemence", "tuzrako", "udvar"]],
  ["Konyhagépek", ["hutoszekreny", "mikrohullamu", "kavefozo", "teafozo", "mosogatogep", "fozolap"]],
  ["Mosás", ["mosogep", "szaritogep", "mosoda", "vasalo"]],
  ["TV és szórakozás", ["tv", "televizio", "dvd", "filmek", "jatekkonzol"]],
  ["Erkély / terasz", ["erkely", "terasz"]],
  ["Medence és wellness", ["medence", "uszoda", "szauna", "jacuzzi", "wellness", "pezsgofurdo"]],
  ["Játszótér", ["jatszoter", "jatszo"]],
  // Without these two buckets the amenity item ("Saját étterem") and the
  // description-derived fact ("Étterem") sat side by side as separate chips —
  // the same fact counted twice on the curator panel (Elek GY5, 2026-09-05).
  ["Étterem", ["etterem"]],
  ["Reggeli", ["reggeli"]],
];

export interface AmenityGroup {
  /** What the operator reads on the chip. */
  readonly label: string;
  /** The raw listing items behind it — shown on hover/title, never invented. */
  readonly items: string[];
}

/**
 * STRONG selling points stated in the listing's own PROSE, extracted deterministically.
 *
 * WHY (measured 2026-08-31, Kati Villa / Balatonlelle): the property's own description
 * opens with "közvetlen vízparti … saját stranddal, stéggel a vízben" — and the generated
 * mock sold "tágas kert, teraszos étkező és saját parkoló". The description DID reach the
 * writer (the electric gate in the copy is from it), but the writer cherry-picked the
 * mundane facts and dropped the one thing the place is actually about. The guard could
 * not object: these portals publish NO amenity list, so the structural layer had nothing
 * to compare against and the judge was told "(nincs adat)".
 *
 * So the strongest claims are lifted OUT of the prose into countable facts — only words
 * from the decision-weight vocabulary at weight ≥60 (waterfront, private beach, pier,
 * panorama, pool, sauna…), i.e. things a guest actively searches for. §B.17 holds: each
 * emitted label is backed by the description's own text, nothing is inferred.
 */
const DESCRIPTION_FACT_LABELS: readonly (readonly [string, string])[] = [
  ["vizpart", "Vízparti fekvés"], ["topart", "Vízparti fekvés"],
  ["strand", "Strand"], ["steg", "Stég"], ["molo", "Móló"],
  ["panorama", "Panoráma"], ["kilatas", "Panoráma"],
  ["medence", "Medence"], ["uszoda", "Medence"], ["wellness", "Wellness"],
  ["szauna", "Szauna"], ["jacuzzi", "Jacuzzi"],
  ["jatszoter", "Játszótér"], ["kutyabarat", "Kisállat-barát"], ["haziallat", "Kisállat-barát"],
  ["reggeli", "Reggeli"], ["etterem", "Étterem"],
  ["klima", "Klíma"], ["legkondicion", "Klíma"],
  ["parkol", "Saját parkoló"], ["garazs", "Garázs"],
  ["kert", "Kert"], ["terasz", "Terasz"], ["erkely", "Erkély"],
  ["grill", "Grill"], ["bogracs", "Bográcsozás"],
];

export function descriptionSellingPoints(descriptions: readonly string[]): string[] {
  const hay = norm(descriptions.join(" "));
  if (!hay) return [];
  const out: string[] = [];
  for (const [needle, label] of DESCRIPTION_FACT_LABELS) {
    if (hay.includes(needle) && !out.includes(label)) out.push(label);
  }
  return out;
}

/** Collapse a raw amenity list into countable, human-readable groups. */
export function groupAmenities(raw: readonly string[]): AmenityGroup[] {
  const out = new Map<string, string[]>();
  for (const item of raw) {
    const t = item.trim();
    if (!t) continue;
    const n = norm(t);
    const hit = AMENITY_BUCKET.find(([, keys]) => keys.some((k) => n.includes(k)));
    // Unrecognised → its own group under its own name (never folded into a wrong bucket).
    const label = hit ? hit[0] : t;
    const list = out.get(label) ?? [];
    if (!list.some((x) => norm(x) === n)) list.push(t);
    out.set(label, list);
  }
  return [...out].map(([label, items]) => ({ label, items }));
}

function weightOf(amenity: string): number {
  const a = norm(amenity);
  let best = 0;
  for (const [needle, w] of DECISION_WEIGHT) if (a.includes(needle) && w > best) best = w;
  return best;
}

/**
 * Does the sales copy REFER to this amenity? Matched on the amenity's content words,
 * not the whole label: the listing says "Elektromos jármű töltőállomás" and good copy
 * writes "elektromos töltő" — the same fact in the writer's own words, which is exactly
 * what we asked for. Requiring the label verbatim would punish the copy for not
 * parroting a portal's phrasing.
 */
function copyNames(amenity: string, salesText: string): boolean {
  const words = norm(amenity)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4); // 4, not 5: "stég" and "kert" are real selling points
  if (!words.length) return false;
  // Hungarian is agglutinative, so compare on a truncated stem ("medence" ↔ "medencével",
  // "jatszoter" ↔ "jatszoteres"). 5 chars is short enough to survive the suffix and long
  // enough that unrelated words do not collide.
  return words.some((w) => salesText.includes(w.slice(0, Math.min(w.length, 6))));
}

const JUDGE_SYSTEM = `Marketinges vagy, aki EGYETLEN kérdésre válaszol egy szálláshely-weboldal szövegéről:

  "Egy ember, aki MOST keres szállást erre a környékre, megtudja-e ebből a szövegből,
   hogy MIT KAPNA itt — és elég vonzó-e ahhoz, hogy tovább olvasson?"

A szemüveged a VENDÉGÉ, nem a költőé. Ez hideg ügyfélszerzés: a szálláshely tulajdonosa
fogja megnyitni, és 5 másodperc alatt eldönti, értjük-e, mije van. A giccs és az üres
hangulatozás itt nem semleges, hanem KÁR.

BUKTASD (verdict="flag"), ha bármelyik igaz:
1. ⛔⛔ A HERO FŐCÍM ÖNMAGÁBAN nem nevez meg semmit, amit a vendég KAP vagy HASZNÁL.
   A főcímet KÜLÖN ítéld meg — a jó kiemelések NEM mentik meg: a lead a főcím után dönti
   el, hogy továbbolvas-e. Ha a főcím rámásolható BÁRMELY MÁSIK szállásra ugyanabban a
   régióban, akkor bukott.
   Megtörtént bukók: "Fenyőillatú csend a tető alatt" · "Fából ácsolt csend, ahol az idő
   lassabban jár" · "Faillatú csend a Balatonnál" — mindhárom ugyanarra a családi
   apartmanházra, aminek játszótere, kertje, saját parkolója és teljes babafelszerelése van.
1b. A főcím KITALÁLT összetett szót használ, vagy nem élő magyar ("faillatú", "fenyőillatú
   csend"). Amit egy ember nem mondana ki, azt ne is írjuk le.
2. A szöveg a BERENDEZÉST vagy a FELÜLETEKET árulja a szolgáltatás helyett
   (könyvespolc, csempe, ágynemű, padló, falszín). Ezt senki nem keres.
3. A legerősebb eladási pont (medence, játszótér, strand-közelség, saját parkoló,
   panoráma, kisállat-barát) megvan az adatok között, de a szövegből HIÁNYZIK
   vagy elsikkad valami jelentéktelen mögött.
4. A szöveg olyat ÁLLÍT a helyről, amit az adatok nem támasztanak alá, és ami a
   vendéget FÉLREVEZETI — kiemelten a földrajzi helyzet ("a tóparton", "a vízparton",
   "a strand mellett"), ha semmi nem igazolja. Ez foglalás után csalódás lesz.
5. Klisé, amit bármelyik szállásra rá lehetne írni ("Üdvözöljük", "otthon, távol
   az otthontól", "felejthetetlen élmény", "a pihenés szigete").

ENGEDD ÁT (verdict="pass"), ha a főcím és a kiemelések együtt megmutatják, mi ez a hely
és miért éri meg — akkor is, ha a hangvétel költői. A hangulat nem baj; a hangulat
INFORMÁCIÓ HELYETT baj.

A "critique" mezőbe konkrét, cselekvő utasítást írj a szövegírónak: MIT emeljen be és
MIT dobjon ki. Ne stílus-tanácsot adj, hanem nevezd meg a tényeket. Ez az utasítás
közvetlenül egy újragenerálásba megy.`;

const JUDGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    verdict: { type: "string", enum: ["pass", "flag"] },
    reason: { type: "string", description: "1-2 mondat: miért bukott, vagy miért jó" },
    missed: {
      type: "array",
      items: { type: "string" },
      description: "Az adatokban meglévő, de a szövegből hiányzó erős eladási pontok.",
    },
    critique: {
      type: "string",
      description:
        "Konkrét utasítás a szövegírónak egy újragenerálásra: mit emeljen be, mit dobjon ki. Üres, ha pass.",
    },
  },
  required: ["verdict", "reason", "missed", "critique"],
} as const;

/** Flatten the sales surface into one comparable blob (hero + tagline + intro + highlights). */
function salesBlob(s: SalesSurface): string {
  return norm(
    [s.heroLead, s.heroEyebrow, s.tagline, s.intro, ...s.highlights].filter(Boolean).join(" · "),
  );
}

/**
 * Judge whether the generated copy sells the property to someone looking for a place to
 * stay. Best-effort like the other gates: a judge failure returns "error" (→ curation),
 * never throws. The STRUCTURAL layer needs no API key and always runs.
 */
export async function verifyMarketRelevance(input: {
  sales: SalesSurface;
  source: MarketSource;
  photos?: readonly string[];
}): Promise<MarketVerdict> {
  const blob = salesBlob(input.sales);
  const amenities = (input.source.amenities ?? []).filter((a) => a.trim().length > 1);

  const named = amenities.filter((a) => copyNames(a, blob));
  const missedRanked = amenities
    .filter((a) => !copyNames(a, blob))
    .map((a) => ({ a, w: weightOf(a) }))
    .filter((x) => x.w > 0)
    .sort((x, y) => y.w - x.w)
    .map((x) => x.a);

  // ── Layer 1: the structural twin. No opinion, no API call. ──────────────────────
  // Only fires when we actually HELD guest-decision facts: with nothing to sell, an
  // atmospheric line is the honest best available, and flagging it would punish the
  // copy for a gap in the DATA. That case is a scraping problem, not a copy problem.
  const strongHeld = amenities.filter((a) => weightOf(a) >= 50);
  if (strongHeld.length && !named.length) {
    return {
      verdict: "flag",
      layer: "structural",
      factsNamed: [],
      missed: missedRanked,
      reason:
        `a szöveg EGYETLEN igazolt szolgáltatást sem nevez meg, pedig ${strongHeld.length} erős ` +
        `eladási pont állt rendelkezésre (${missedRanked.slice(0, 5).join(", ")}) — ` +
        `hangulat-szöveg konverziós ajánlat helyett`,
      critique:
        `A szöveg nem mond semmit, amit a vendég KAP. Írd újra úgy, hogy a hero-vezércím és a ` +
        `kiemelések a következő IGAZOLT szolgáltatásokra épüljenek, a legerősebbel kezdve: ` +
        `${missedRanked.slice(0, 6).join(", ")}. A berendezés és a felületek leírását hagyd el.`,
    };
  }

  // ⛔ AND THE CASE WITH NO SOURCED FACTS AT ALL — the one that shipped anyway.
  // The first version of this gate deliberately let it pass, reasoning that an atmospheric
  // line is the honest best available when we hold nothing, and that punishing the copy for
  // a DATA gap would be unfair. That reasoning was wrong in the only way that matters: the
  // mock still goes to a stranger as our first impression. Measured 2026-08-31 — "Fenyőillatú
  // délutánok a tetőtérben / Fából ácsolt csend, ahol az idő lassabban jár", top highlight
  // "Külön hálószoba és tágas nappali kényelmes fekhellyel". The gate passed it because it
  // held no amenities to compare against, i.e. it was blindest exactly where the copy was
  // worst. Whose fault the gap is does not change whether this may be sent.
  // So: copy that names NOTHING a guest gets is flagged either way. Only the reason differs —
  // here it points at the missing data, because that is what a human has to fix.
  if (!amenities.length) {
    const namesAnyValue = VALUE_VOCAB.some((v) => blob.includes(v));
    if (!namesAnyValue) {
      return {
        verdict: "flag",
        layer: "structural",
        factsNamed: [],
        missed: [],
        reason:
          "a szöveg semmi vendég-értéket nem nevez meg, ÉS nincs egyetlen igazolt szolgáltatás " +
          "sem a leadhez — a mock hangulat-szöveg valós ajánlat nélkül. Ez ADAT-hiány: a " +
          "szállás hirdetése nincs bekötve (nincs high-band portál-profil), ezért a szövegírónak " +
          "nem volt mit eladnia. Kurátori teendő: a lead újra-dúsítása, nem a szöveg csiszolása.",
        critique:
          "Nincs igazolt szolgáltatás-adat, ezért a szöveg nem javítható újragenerálással — " +
          "a leadhez portál-adat kell.",
      };
    }
  }

  // ── Layer 1b: THE HEADLINE ON ITS OWN. ─────────────────────────────────────────
  // The first version of this gate measured the sales surface AS A WHOLE, so rich
  // highlights could carry a hollow H1 through. Measured 2026-08-31 — it passed
  // "Faillatú csend a Balatonnál" on a property advertising a playground, a garden, a
  // private car park and full baby equipment, because the highlights below it named
  // nine real facts. The owner's verdict on the result was unprintable, and correct:
  // the hero lead is the ONE line the lead reads before deciding whether to keep
  // reading. A headline that could be pasted onto any other property in the region is
  // not a headline, it is filler — so it is judged separately and strictly.
  const heroRaw = (input.sales.heroLead ?? "").toLowerCase();
  const heroText = norm(input.sales.heroLead ?? "");

  // NO BUILDING MATERIALS IN THE HEADLINE — even next to real selling points.
  // Measured 2026-08-31: "Kert, grill és bérelhető kerékpárok a FENYŐGERENDÁS TETŐTÉR
  // ALATT" satisfied the rule below (it names three verified amenities) and still spent
  // half of the most-read line on what the building is made of. Owner's ruling: that is
  // as useful to a guest as the concrete grade. The headline has ONE line; a construction
  // detail spends it on nothing.
  const material = MATERIAL_WORDS.find((w) => heroRaw.includes(w));
  if (material) {
    return {
      verdict: "flag",
      layer: "structural",
      factsNamed: named,
      missed: missedRanked,
      reason:
        `a HERO FŐCÍM ("${input.sales.heroLead}") ÉPÍTŐANYAGOT/szerkezetet említ ("${material}…") — ` +
        `a szálláskereső nem erre keres, és a lap legolvasottabb sorában ez elvesztegetett hely`,
      critique:
        `A HERO FŐCÍMBŐL töröld az építőanyagra/szerkezetre utaló részt ("${material}…"): ` +
        `a vendéget nem érdekli, miből épült a ház, csak az, hogy MIT KAP. ` +
        `Helyette a vendég-értéket vidd bele${missedRanked.length ? `, pl. ${missedRanked.slice(0, 3).join(", ")}` : ""}. ` +
        `A hely hangulatát a fotók viszik — a főcímet ne rájuk pazarold.`,
    };
  }

  if (strongHeld.length && heroText) {
    const heroNames = amenities.filter((a) => copyNames(a, heroText));
    if (!heroNames.length) {
      const best = missedRanked.length ? missedRanked : amenities;
      return {
        verdict: "flag",
        layer: "structural",
        factsNamed: named,
        missed: missedRanked,
        reason:
          `a HERO FŐCÍM ("${input.sales.heroLead}") egyetlen konkrét szolgáltatást sem nevez meg — ` +
          `tiszta hangulat a lap legolvasottabb sorában, pedig ${strongHeld.length} igazolt ` +
          `eladási pont áll rendelkezésre. A kiemelések jósága ezt NEM pótolja: a vendég a ` +
          `főcím után dönti el, hogy továbbolvas-e`,
        critique:
          `A HERO FŐCÍMET írd újra. Jelenleg tiszta hangulat ("${input.sales.heroLead}"), ` +
          `ami bármelyik másik szállásra ráillene. Nevezzen meg KONKRÉTAN legalább egy dolgot, ` +
          `amit a vendég itt kap — a legerősebbekkel kezdve: ${best.slice(0, 4).join(", ")}. ` +
          `Természetes magyar szavakkal; kitalált összetett szót ("faillatú") ne gyárts. ` +
          `A többi szöveg maradhat, ha jó.`,
      };
    }
  }

  // ── Layer 2: the marketing judge, on what the structural layer let through. ─────
  if (!config.anthropicApiKey) {
    return {
      verdict: named.length ? "pass" : "error",
      layer: "structural",
      factsNamed: named,
      missed: missedRanked,
      reason: named.length
        ? `nincs API key — csak a strukturális réteg futott (${named.length} igazolt tény megnevezve)`
        : "nincs API key és nincs megnevezett tény — nem ítélhető meg",
    };
  }

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();
    const content: AnthropicNS.ContentBlockParam[] = [];
    for (const block of await toImageBlocks((input.photos ?? []).slice(0, 3))) {
      content.push(block as AnthropicNS.ContentBlockParam);
    }
    content.push({
      type: "text",
      text:
        `SZÁLLÁS: ${input.source.name}\n` +
        `TELEPÜLÉS: ${input.source.town ?? "nincs megadva"}\n` +
        (input.source.roomCount ? `SZOBASZÁM: ${input.source.roomCount}\n` : "") +
        (input.source.rating
          ? `GOOGLE-ÉRTÉKELÉS: ${input.source.rating.value}` +
            (input.source.rating.count != null ? ` (${input.source.rating.count} vélemény)` : "") +
            "\n"
          : "") +
        (input.source.descriptions?.length
          ? `\nA SZÁLLÁS SAJÁT BEMUTATKOZÁSA (a hitelesített hirdetéséről) — a hely FŐ adottságát\n` +
            `EBBŐL ítéld meg; ha a szöveg a fő adottság helyett mellékes dolgot árul, az a 3. szabály:\n` +
            input.source.descriptions.map((d) => `"""${d.slice(0, 800)}"""`).join("\n") + `\n`
          : "") +
        `\nAMIT A SZÁLLÁSRÓL BIZONYÍTOTTAN TUDUNK (a saját, hitelesített hirdetéséről) —\n` +
        `ezt KELLETT VOLNA eladnia a szövegnek:\n` +
        (amenities.length ? amenities.map((a) => `- ${a}`).join("\n") : "- (nincs adat)") +
        `\n\n════ A GENERÁLT ELADÓ SZÖVEG ════\n` +
        `HERO FŐCÍM: ${input.sales.heroLead ?? "(nincs)"}\n` +
        `HERO KICKER: ${input.sales.heroEyebrow ?? "(nincs)"}\n` +
        `ALCÍM: ${input.sales.tagline ?? "(nincs)"}\n` +
        `BEMUTATKOZÓ: ${input.sales.intro ?? "(nincs)"}\n` +
        `KIEMELÉSEK:\n${input.sales.highlights.map((h) => `  - ${h}`).join("\n") || "  (nincs)"}\n\n` +
        `A determinisztikus előszűrő szerint a szöveg ezeket az igazolt szolgáltatásokat nevezi ` +
        `meg: ${named.length ? named.join(", ") : "EGYET SEM"}.\n` +
        (missedRanked.length
          ? `Ezeket az erős eladási pontokat viszont NEM említi: ${missedRanked.slice(0, 8).join(", ")}.\n`
          : "") +
        `\nÍtélj a fenti szabályok szerint. A képek a szállás valós fotói — a 4. szabálynál ` +
        `(félrevezető állítás) ezek is bizonyítékok.`,
    });

    const res = await client.messages.create({
      model: "claude-opus-4-8",
      // 900 was too small and the judge's JSON came back TRUNCATED ("Unterminated string at
      // position 1498") — so the gate returned "error" and the very mock that prompted this
      // whole guard reached the owner's screen. `reason` + `missed[]` + a concrete `critique`
      // is simply more than 900 tokens of Hungarian.
      max_tokens: 2500,
      system: JUDGE_SYSTEM,
      messages: [{ role: "user", content }],
      output_config: { format: { type: "json_schema", schema: JUDGE_SCHEMA } },
    } as AnthropicNS.MessageCreateParamsNonStreaming);
    recordAiUsage("verifyMarketRelevance", "claude-opus-4-8", res.usage);

    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      return {
        verdict: "error",
        layer: "judge",
        factsNamed: named,
        missed: missedRanked,
        reason: "marketing-őr üres válasz",
      };
    }
    let parsed: { verdict: "pass" | "flag"; reason: string; missed: string[]; critique: string };
    try {
      parsed = JSON.parse(block.text);
    } catch (parseErr) {
      // A judge that cannot be read must not become a silent pass. Fall back to the one
      // question the structural layer can still answer on its own: did the copy name any
      // sourced fact at all? Nothing named → flag. This is the belt to the max_tokens brace.
      return {
        verdict: named.length ? "error" : "flag",
        layer: "structural",
        factsNamed: named,
        missed: missedRanked,
        reason:
          `a marketing-bíró válasza olvashatatlan (${(parseErr as Error).message}); ` +
          (named.length
            ? `a strukturális réteg ${named.length} megnevezett tényt lát — kurátor döntsön`
            : "a szöveg egyetlen igazolt tényt sem nevez meg, ezért BUKÁS"),
        ...(named.length
          ? {}
          : {
              critique:
                `Írd újra a szöveget úgy, hogy a hero-vezércím és a kiemelések ezekre az ` +
                `IGAZOLT szolgáltatásokra épüljenek: ${missedRanked.slice(0, 6).join(", ")}.`,
            }),
      };
    }
    return {
      verdict: parsed.verdict,
      layer: "judge",
      factsNamed: named,
      // The judge may name a miss the ranking table has no word for; keep both views.
      missed: [...new Set([...(parsed.missed ?? []), ...missedRanked])],
      reason: parsed.reason,
      ...(parsed.verdict === "flag" && parsed.critique ? { critique: parsed.critique } : {}),
    };
  } catch (err) {
    return {
      verdict: "error",
      layer: "judge",
      factsNamed: named,
      missed: missedRanked,
      reason: `marketing-őr hiba: ${(err as Error).message}`,
    };
  }
}
