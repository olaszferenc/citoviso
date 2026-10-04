// GUEST-CRITIC gate (vendég-kritikus) — owner ruling 2026-10-01, plan stage (ADR-0292).
//
// WHY THIS EXISTS. Every existing copy gate asks a question a machine can answer from the
// source list: is the fact sourced (factCheck), does the copy NAME a sourced fact
// (marketCheck), is the demo framing present (provenance). None asks the question a GUEST
// asks the moment they read the page: "would a normal Hungarian host ever write this on
// their website?" Measured on the Muschel mock (Elek, 2026-10-01) — every claim below
// passed the source gates, because each WAS backed by a verbatim review quote:
//   "also borrowing us bicycles"         → "Bérelhető kerékpárok"  (a kindness became a service)
//   "Cooked breakfast with eggs"         → "Friss, főtt reggeli"   (a calque; no such concept)
//   "Sufficient parking spaces"          → "Bőséges saját parkoló" (inflated, and "saját" added)
// The gates checked that a quote existed, not that the page says NO MORE than the quote.
// That gap — the claim outgrowing its source, plus language no human writes — is what this
// module closes.
//
// TWO ROLES, ONE LOOP. The CRITIC reads the copy as a demanding Hungarian guest and an
// editor would, and returns an itemised objection list (never a rewrite). The WRITER then
// fixes exactly those objections from the same sources (text-only: no photos, so a round
// costs a fraction of the vision call). Bounded: at most MAX_ROUNDS rewrites; whatever is
// still blocking after that goes to the curator queue, not to a stranger's inbox.
//
// A deterministic twin (lintCopy) runs first and cannot be argued with: address register
// mix and the known calques / template openers are pattern-matched, so the LLM is not the
// only thing standing between a "főtt reggeli" and the lead.

import type AnthropicNS from "@anthropic-ai/sdk";
import { recordAiUsage } from "../ai/usage.js";
import { config } from "../config.js";
import type { EditorialCopy } from "../engine/copywriter.js";
import type { SectionCopy } from "../engine/recipe.js";
import { familiarForms } from "./addressRegister.js";
import { lintOpening, type OpeningKind } from "./lyricOpening.js";

const MODEL = "claude-opus-4-8";
/** Rewrite rounds after the first critique. Not a loop to convergence: if two targeted
 *  rewrites cannot clear a blocking objection, the problem is the sources, not the phrasing. */
export const MAX_ROUNDS = 2;

/** How the page addresses the guest. A house rule, not a per-mock taste call. */
export type Register = "magaz" | "tegez";

/** The generated, guest-facing copy — exactly the fields the writer produces. */
export interface CopySurface {
  readonly tagline: string;
  readonly intro: string;
  readonly highlights: readonly string[];
  readonly editorial: EditorialCopy;
}

/** One source-backed fact the writer was handed, tagged by where it came from. */
export interface CriticFact {
  readonly label: string;
  /** Verbatim source sentence, when the fact was lifted from prose or a review. */
  readonly quote?: string;
  /** "google_places" / a portal host = guest review; "owner_intro" / "description" /
   *  portal host with no quote = the property's OWN listing. */
  readonly source: string;
  readonly kind: "listing" | "review";
}

export interface CriticSource {
  readonly name: string;
  readonly town?: string | null;
  readonly address?: string | null;
  readonly rating?: { value: number; count: number | null } | null;
  readonly facts: readonly CriticFact[];
  /** The property's own listing prose (fact source only). */
  readonly descriptions?: readonly string[];
  /** Full guest review texts, so the critic can see what a quote was torn out of. */
  readonly reviews?: readonly string[];
}

export type ObjectionKind =
  | "forrastalan_igeret"
  | "tulzas_a_forrashoz"
  | "velemeny_mint_szolgaltatas"
  | "nem_letezo_fogalom"
  | "tukorforditas"
  | "megszolitas"
  | "ai_sablon"
  | "al_idezet"
  | "nyelvtan"
  | "ismetles"
  | "ures_kituntetes"
  | OpeningKind;

export interface Objection {
  readonly field: string;
  readonly quote: string;
  readonly kind: ObjectionKind;
  readonly severity: "blokkolo" | "javitando";
  /** One sentence, in the guest's voice: what goes through their head reading it. */
  readonly guestReaction: string;
  readonly fix: string;
  /** "lint" = deterministic twin, "ai" = critic model. */
  readonly by: "lint" | "ai";
}

export interface CriticRound {
  readonly copy: CopySurface;
  readonly objections: readonly Objection[];
  readonly verdict: "pass" | "flag";
  readonly summary: string;
}

export interface CriticLoopResult {
  readonly rounds: readonly CriticRound[];
  readonly final: CopySurface;
  readonly verdict: "pass" | "flag" | "error";
  readonly reason: string;
}

// ── deterministic twin ───────────────────────────────────────────────────────────────────

/** Flatten the copy into labelled lines — the exact text the critic and the lint judge. */
export function surfaceLines(c: CopySurface): { field: string; text: string }[] {
  const out: { field: string; text: string }[] = [];
  const sec = (key: string, s: SectionCopy | undefined) => {
    if (!s) return;
    if (s.eyebrow) out.push({ field: `${key}.eyebrow`, text: s.eyebrow });
    if (s.title) out.push({ field: `${key}.title`, text: s.title.replace(/\n/g, " ") });
  };
  const hero = c.editorial.hero as (SectionCopy & { lead?: string }) | undefined;
  if (hero?.eyebrow) out.push({ field: "hero.eyebrow", text: hero.eyebrow });
  if (hero?.lead) out.push({ field: "hero.lead", text: hero.lead });
  out.push({ field: "tagline", text: c.tagline });
  out.push({ field: "intro", text: c.intro });
  c.highlights.forEach((h, i) => out.push({ field: `highlights[${i}]`, text: h }));
  for (const k of ["features", "rooms", "gallery", "reviews", "faq"] as const) sec(k, c.editorial[k]);
  return out;
}

// The familiar register is detected by RULE (endings, pronouns, stems × suffixes) in
// addressRegister.ts — the closed word list that lived here let „kaphatsz”, „érezd”, „töltsd”,
// „pihenj”, „foglald”, „jársz”, „nálad” through (measured 2026-10-02, M4).
const MAGAZO =
  /(?<![\p{L}])(Ön|Önt|Önnek|Önök|Öné|kapja|érkezik|pihenhet|szeretne|talál|foglaljon|írjon|nézze|jöjjön|várjuk|válasszon|kérdezzen|élvezze|fedezze)(?![\p{L}])/gu;

/** Known calques and template openers, each measured on a shipped mock. */
const BANNED: readonly { re: RegExp; kind: ObjectionKind; fix: string }[] = [
  { re: /főtt reggeli/iu, kind: "nem_letezo_fogalom", fix: "„meleg reggeli” vagy „tojásétel a reggelinél” — ha a forrás ezt mondja" },
  // "X várja a vendégeket / a családokat / a megpihenőket" — the most typical generated
  // opener in the trade, in all its object variants (measured: Muschel, Mandula, Laguna).
  { re: /(?<![\p{L}])(várja|várják|fogadja) (a|az|kedves) [\p{L}-]*(ket|kat|öket|eket|it|eit|ait)(?![\p{L}])/iu, kind: "ai_sablon", fix: "állítsd, mi van ott, alanyként: „A kertben medence és árnyékos terasz van.”" },
  { re: /biciklik? a Balatonhoz|kerékpárok? a Balatonhoz/iu, kind: "nyelvtan", fix: "értelmes vonzat: „kerékpárral a Balaton körül”" },
];

/** The deterministic twin: register mix + known calques. Cheap, and not negotiable. */
export function lintCopy(c: CopySurface, register: Register): Objection[] {
  const out: Objection[] = [];
  for (const { field, text } of surfaceLines(c)) {
    const wrong =
      register === "magaz"
        ? familiarForms(text).map((h) => h.quote)
        : [...text.matchAll(MAGAZO)].map((m) => m[0]);
    for (const quote of wrong) {
      out.push({
        field,
        quote,
        kind: "megszolitas",
        severity: "blokkolo",
        guestReaction:
          register === "magaz"
            ? "Az oldal többi része magáz, itt hirtelen tegez — nem egy ember írta."
            : "Az oldal tegez, itt hirtelen magáz — nem egy ember írta.",
        fix: register === "magaz" ? "magázó alakra" : "tegező alakra",
        by: "lint",
      });
    }
    for (const b of BANNED) {
      const m = b.re.exec(text);
      if (m) out.push({ field, quote: m[0], kind: b.kind, severity: "blokkolo", guestReaction: "Ilyet magyar ember nem ír.", fix: b.fix, by: "lint" });
    }
    if (field === "hero.lead" && /^[„"'»].*[”"'«]$/u.test(text.trim()))
      out.push({ field, quote: text, kind: "al_idezet", severity: "blokkolo", guestReaction: "Idézőjelben áll, de senki nem mondta.", fix: "idézőjel nélkül, állításként", by: "lint" });
  }
  return out;
}

/**
 * Owner ruling B (2026-10-01): a guest review may ground a STANDING facility, never an
 * OFFER. "Bérelhető / ingyenes / foglalható …" is a commercial promise, so it needs the
 * property's OWN listing behind it. Measured: "borrowing us bicycles" → "Bérelhető
 * kerékpárok" (Muschel) and "(it was free of charge)" → "ingyenesen használható biliárd"
 * (Laguna) — the critic model graded the second one only "javítandó". This twin does not.
 */
const OFFER = /(?<![\p{L}])(bérelhető\p{L}*|bérelhet\p{L}*|kölcsönözhető\p{L}*|ingyen\p{L}*|díjmentes\p{L}*|foglalható\p{L}*|igényelhető\p{L}*)/giu;

export function lintOffers(c: CopySurface, source: CriticSource): Objection[] {
  const listing = [
    ...source.facts.filter((f) => f.kind === "listing").flatMap((f) => [f.label, f.quote ?? ""]),
    ...(source.descriptions ?? []),
  ]
    .join(" \n ")
    .toLowerCase();
  const out: Objection[] = [];
  for (const { field, text } of surfaceLines(c)) {
    for (const m of text.matchAll(OFFER)) {
      const stem = m[0].toLowerCase().slice(0, 5);
      if (listing.includes(stem)) continue;
      out.push({
        field,
        quote: m[0],
        kind: "velemeny_mint_szolgaltatas",
        severity: "blokkolo",
        guestReaction: "Ezt ajánlatként olvasom, és érkezéskor számon kérem — a szállás sehol nem hirdeti.",
        fix: "hagyd ki az ajánlatot; ha a vélemény állandó adottságot ír le, azt ajánlat-szó nélkül",
        by: "lint",
      });
    }
  }
  return out;
}

/**
 * ADDED DETAIL (Elek, live round 2, 2026-10-02 — SZ2-1). The Muschel mock shipped
 * „Grillezési lehetőség a FEDETT teraszon” and „reggeli a TERASZON”: the review said only
 * „cozy terrace where there are also barbecue facilities” and „breakfast”. The service was
 * true; the place / quality attached to it was invented — and the critic graded it
 * "javítandó", so it neither blocked nor got fixed. A guest holds the page to exactly that
 * detail on arrival. This twin is the rule: a SERVICE named together with a place or quality
 * detail needs ONE source sentence that says both; a non-photographable quality (heated,
 * private, guarded) needs a source at all. Bilingual stems: most guest reviews are English.
 */
const look = (src: string) => new RegExp(`(?<![\\p{L}])(?:${src})`, "iu");
const SERVICE_TERMS: readonly { name: string; food?: true; re: RegExp }[] = [
  { name: "grillezés", re: look("grill|barbecue|bbq|bogrács") },
  { name: "reggeli", food: true, re: look("reggeli|breakfast|frühstück") },
  { name: "vacsora", food: true, re: look("vacsor|félpanzió|dinner|half[- ]board|abendessen|halbpension") },
  { name: "kávé", food: true, re: look("kávé|coffee|kaffee") },
  { name: "parkoló", re: look("parkol|parking|parkplatz|beálló|garázs|garage") },
  { name: "kerékpár", re: look("kerékpár|bicikli|bicycl|bike|fahrrad") },
  { name: "wifi", re: look("wi-?fi|internet|wlan") },
];
/** `foodOnly`: a garden is photographable as a place, but WHERE a meal is served is not
 *  (measured: „Kontinentális reggeli a kertben”, Három Huszár, ADR-0304 ⑥). */
const DETAIL_TERMS: readonly { name: string; re: RegExp; foodOnly?: true; quality?: true }[] = [
  { name: "fedett", re: look("fedett|covered|roofed|überdacht") },
  { name: "terasz", re: look("terasz|terrace|terrass|patio") },
  { name: "kert", foodOnly: true, re: look("kert|garden|garten|udvar(?!ias)|yard") },
  { name: "kilátás", re: look("kilát|panorám|view|aussicht|blick") },
  { name: "saját", quality: true, re: look("saját|privát|private|own(?![\\p{L}])|eigen") },
  { name: "fűtött", quality: true, re: look("fűtött|fűthető|heated|beheizt") },
  { name: "őrzött", quality: true, re: look("őrzött|zárt|guarded|secured|gated|bewacht") },
  { name: "svédasztalos", re: look("svédasztal|buffet") },
];
const CLAUSE_SPLIT = /[,;.:!?()\n–—]|\s(?:és|valamint|illetve|vagy)\s/iu;

/** Every source sentence as one unit: a detail is backed only where the SAME sentence says it. */
function sourceUnits(source: CriticSource): string[] {
  const sentences = (t: string) => t.split(/(?<=[.!?])\s+|\n+/u).filter((x) => x.trim());
  return [
    // A review fact's LABEL is the machine's translation (it once read „bérelhető kerékpárok”),
    // so only the listing's own label counts as evidence; the quote always does.
    ...source.facts.map((f) => (f.kind === "listing" ? `${f.label} — ${f.quote ?? ""}` : (f.quote ?? ""))),
    ...(source.descriptions ?? []).flatMap(sentences),
    ...(source.reviews ?? []).flatMap(sentences),
  ].filter((u) => u.trim());
}

export function lintAddedDetail(c: CopySurface, source: CriticSource): Objection[] {
  const units = sourceUnits(source);
  const out: Objection[] = [];
  for (const { field, text } of surfaceLines(c)) {
    for (const clause of text.split(CLAUSE_SPLIT).map((x) => x.trim()).filter(Boolean)) {
      const services = SERVICE_TERMS.filter((s) => s.re.test(clause));
      for (const d of DETAIL_TERMS) {
        if (!d.re.test(clause)) continue;
        let unbacked: string | null = null;
        // „a saját tempójában” is not a claim: the quality rule needs a thing it qualifies.
        const qualifiesThing = services.length > 0 || PHYSICAL.test(clause);
        if (d.quality && qualifiesThing && !units.some((u) => d.re.test(u))) unbacked = d.name;
        for (const s of services) {
          if (unbacked) break;
          if (d.foodOnly && !s.food) continue;
          if (!units.some((u) => s.re.test(u) && d.re.test(u))) unbacked = `${s.name} + ${d.name}`;
        }
        if (!unbacked) continue;
        out.push({
          field,
          quote: clause,
          kind: "tulzas_a_forrashoz",
          severity: "blokkolo",
          guestReaction: `„${clause}” — ezt a részletet (${unbacked}) számon kérem érkezéskor, de a szállás sehol nem mondja.`,
          fix: `hagyd el a(z) „${d.name}” részletet; csak annyit állíts, amennyit EGY forrás-mondat együtt mond`,
          by: "lint",
        });
        break;
      }
    }
  }
  return out;
}

/**
 * ADDED OBJECT (Elek, live round 3, 2026-10-02 — SZ3-1). The Erika villa mock shipped „a házhoz
 * KERTI PIHENŐ és BÚTOROZOTT TERASZ tartozik” three times over (intro, highlight, heading). No
 * source says terrace or garden furniture; the photos show a tidy garden, a pergola and a balcony
 * with one plastic chair. lintAddedDetail did not fire — there was no SERVICE in the clause — and
 * the critic is told not to object to physical things, so the object itself went unchecked.
 * A structure a photo shows plainly (pool, garden, yard, balcony, view) stays the photo's call;
 * an outdoor AMENITY a guest plans to USE (terrace, garden furniture, a seating corner, grill,
 * hot tub, sauna, playground…) is exactly what they hold the page to, and needs a source unit
 * that names it. `outdoor`: furniture only counts as a claim next to an outdoor word („szépen
 * berendezett szobák” is a room, and the room is on the photo).
 */
const OUTDOOR = look("terasz|terrace|terrass|patio|kert|garden|garten|udvar(?!ias)|yard|erkély|balcon|balkon|outdoor|kültéri|szabadtéri");
export const OBJECT_TERMS: readonly { name: string; re: RegExp; outdoor?: true }[] = [
  // Not „tornác”: a porch is the building's architecture, on the facade photo (Artemisz, Bánó Porta).
  { name: "terasz", re: look("terasz|terrace|terrass|patio|veranda|kiülő") },
  { name: "kerti bútor", outdoor: true, re: look("bútor|furnitur|furnished|möbel|möbliert") },
  // Not a bare „pihenő”: „falusi pihenőt kínál”, „ideális pihenőhely” mean a holiday, not a thing.
  { name: "kerti pihenő", re: look("kerti pihenő|fedett pihenő|pihenősar|pihenőkert|ülősar|kiülő|sitting area|seating|lounge area|sitzecke|sitzbereich|lugas|gazebo|pavilon") },
  { name: "grill", re: look("grill|barbecue|bbq") },
  { name: "bogrács", re: look("bogrács|kemenc|tűzrakó|fire ?pit|feuerstelle|pizza ?oven") },
  { name: "jakuzzi", re: look("jakuzzi|jacuzzi|pezsgőfürdő|hot ?tub|whirlpool|dézsa") },
  { name: "szauna", re: look("szaun|sauna") },
  { name: "játszótér", re: look("játszótér|játszóház|playground|spielplatz|hinta|swing|schaukel|trambulin|trampolin|csúszd|slide") },
  { name: "függőágy", re: look("függőágy|hammock|hängematte") },
  { name: "stég", re: look("stég|jetty|pier|steg(?![\\p{L}])") },
];

export function lintAddedObject(c: CopySurface, source: CriticSource): Objection[] {
  const units = sourceUnits(source);
  // The property's own name is not a claim („A Kemencés Vendégház …” promises no oven).
  const name = source.name.replace(/^\[TESZT\]\s*/u, "").trim().toLowerCase();
  const out: Objection[] = [];
  for (const { field, text } of surfaceLines(c)) {
    for (const clause of text.split(CLAUSE_SPLIT).map((x) => x.trim()).filter(Boolean)) {
      const probe = name ? clause.toLowerCase().split(name).join(" ") : clause;
      for (const o of OBJECT_TERMS) {
        if (!o.re.test(probe)) continue;
        // Furniture needs its outdoor noun in the SAME clause: „tömör fa bútorokkal” is the room
        // even when the sentence goes on to a terrace (Rozé Fogadó).
        if (o.outdoor && !OUTDOOR.test(probe)) continue;
        if (units.some((u) => o.re.test(u) && (!o.outdoor || OUTDOOR.test(u)))) continue;
        out.push({
          field,
          quote: clause,
          kind: "tulzas_a_forrashoz",
          severity: "blokkolo",
          guestReaction: `„${clause}” — erre (${o.name}) készülök, és érkezéskor keresem, de a szállás sehol nem mondja, hogy van.`,
          fix: `hagyd ki a(z) „${o.name}” tárgyat; a fotón látott kert, pergola vagy erkély nem ${o.name}`,
          by: "lint",
        });
        break;
      }
    }
  }
  return out;
}

/**
 * PLACED CLAIM (2026-10-03 — the known limit ADR-0309 named). Two TRUE facts tied into one NEW
 * claim by a place adverbial. Három Huszár's listing says „A szállás kerttel reggelente
 * kontinentális reggelit szolgál fel”: the garden belongs to the house, the breakfast is served —
 * nowhere is breakfast served IN the garden. The copy said „Kontinentális reggeli a kertben”, and
 * lintAddedDetail let it through, because its evidence is co-occurrence: both words stand in the
 * one source sentence. Lidó's listing has „Uszoda” in a flat service list next to „Nightclub”,
 * „Vitorlázás” and „Hajózás” (things NEAR the house); the copy made it „Uszoda … a helyszínen”.
 *
 * The rule: when a clause PUTS a service, an outdoor object or a facility at a place (a
 * locative: „a kertben”, „kerti”, „a teraszon”, „az udvarban”, „a helyszínen”, „in the garden”,
 * „on site”), a source unit must name the thing AND the place in a form that can relate them. A
 * place word in an ATTRIBUTE form of the house — „kerttel” (with a garden), „kertes”, „kertre
 * néző”, „teraszos”, „with a garden” — relates nothing and does not count. The scope is the
 * clause up to punctuation, not up to „és”: „Medence, reggeli és kerékpárok a tó körül” puts
 * everything in the list at the place, and that is how a guest reads it (ADR-0292 ai_sablon).
 * A structure the photo shows (medence, kert, terasz itself) is not a thing here — where the
 * pool is stays the photo's call (ADR-0312).
 */
export const PLACES: readonly { name: string; at: RegExp; noun: RegExp; attr: RegExp }[] = [
  {
    name: "kert",
    at: look("kert(?:ben|jében|jeiben|ünkben|i)(?![\\p{L}])|in the garden|in the yard|im garten"),
    // „Kinti sütögetés”, „outdoor breakfast”: outdoors IS the garden's side of the house.
    noun: look("kert|garden|garten|yard|kint|szabad(?:ban|téri)|kültéri|outdoor|outside|draußen|im freien"),
    attr: /(?<![\p{L}])(?:kert(?:tel|es\p{L}*|re|ekre|jére)(?![\p{L}])|(?:with|and) (?:a |an |its |the )?(?:\p{L}+ )?(?:garden|yard)|garden[- ]view|view (?:of|over) the garden|mit (?:einem )?garten)/giu,
  },
  {
    name: "terasz",
    at: look("(?:napozó)?terasz(?:on|án|unkon|ain|okon)(?![\\p{L}])|on the (?:terrace|patio|deck)|auf der terrasse"),
    noun: look("(?:napozó)?terasz|terrace|patio|deck|terrasse"),
    attr: /(?<![\p{L}])(?:(?:napozó)?(?:terasszal|teraszos\p{L}*|teraszra)(?![\p{L}])|(?:with|and) (?:a |an |its |the )?(?:\p{L}+ )?(?:terrace|patio)|mit (?:einer )?terrasse)/giu,
  },
  {
    name: "udvar",
    at: look("udvar(?:on|ban|án|ában|unkban|i)(?![\\p{L}])|in the courtyard|im hof"),
    noun: look("udvar(?!ias)|courtyard|hof(?![\\p{L}])|kint|szabad(?:ban|téri)|kültéri|outdoor|outside"),
    attr: /(?<![\p{L}])(?:udvar(?:ral|os\p{L}*|ra)(?![\p{L}])|(?:with|and) (?:a |an |its |the )?(?:\p{L}+ )?courtyard)/giu,
  },
  {
    name: "erkély",
    at: look("erkély(?:en|ünkön|ein)(?![\\p{L}])|on the balcony|auf dem balkon"),
    noun: look("erkély|balcon|balkon"),
    attr: /(?<![\p{L}])(?:erkéllyel|erkélyes\p{L}*|(?:with|and) (?:a |an |its |the )?balcony)/giu,
  },
  {
    name: "helyszín",
    // „a villában / a házban”: measured 2026-10-03 — the rewrite turned „Uszoda a helyszínen” into
    // „Uszoda a villában”, and only the model caught it.
    at: look("helyszín(?:en|i)(?![\\p{L}])|on[- ]site|on the premises|vor ort|a szállás(?:on| területén)|a ház területén|(?:a |az )(?:vill|panzió|vendégház|apartmanház|ház)(?:ában|ban|ánkban|unkban)(?![\\p{L}])"),
    // „Saját / privát X” on the house's own listing places X at the house.
    noun: look("helyszín|on[- ]site|premises|vor ort|területén|saját|privát|private"),
    attr: /$^/gu,
  },
];
/**
 * What a placed claim is about: where a SERVICE happens (breakfast served in the garden, parking
 * in the yard, wifi in the room) and where a FACILITY is whose place no photo settles (a hot tub,
 * a sauna, an indoor pool, a spa). NOT the fixed outdoor structures — a terrace, a pavilion, a
 * playground, a jetty, an oven stand where they stand, the photo shows it; whether they exist at
 * all is lintAddedObject's question.
 */
const FACILITY_TERMS: readonly { name: string; re: RegExp }[] = [
  ...OBJECT_TERMS.filter((o) => o.name === "jakuzzi" || o.name === "szauna"),
  { name: "uszoda", re: look("uszod|swimming hall|indoor pool|hallenbad") },
  { name: "wellness", re: look("wellness|spa(?![\\p{L}])|fitness|edzőterem|gym(?![\\p{L}])") },
];
const PLACE_SPLIT = /[,;.:!?()\n–—]/u;
/** „kerti / udvari / helyszíni X” — an adjective binds the NEXT words, not the whole clause. */
const ADJECTIVAL = /(?:kerti|udvari|helyszíni)$/iu;
/** „a kertben KIALAKÍTOTT kemence”, „a kertben ÁLLÓ pavilon” — a participle binds its own noun. */
const PARTICIPLE = /^(?:\p{L}+(?:ott|ett|ött|tt|ó|ő)|található)$/u;

/** The words a place adverbial actually places: its noun phrase, or the clause around it. */
function placedScope(clause: string, at: RegExpExecArray): string {
  const after = clause.slice(at.index + at[0].length).trim().split(/\s+/u).filter(Boolean);
  if (ADJECTIVAL.test(at[0])) return after.slice(0, 2).join(" ");
  if (after[0] && PARTICIPLE.test(after[0])) return after.slice(1, 3).join(" ");
  return clause.slice(0, at.index) + " " + clause.slice(at.index + at[0].length);
}

export interface PlacedClaim {
  readonly clause: string;
  readonly thing: string;
  readonly place: string;
}

/**
 * The deterministic core, shared with the generator's fact gate (factCheck.ts) so the copy and
 * the rendered page are judged by the same rule. `units` are source sentences/labels; `name` the
 * property's own name (never a claim: „Lidó Wellness és Bor Villa” promises no spa).
 */
export function placedClaims(text: string, units: readonly string[], name: string): PlacedClaim[] {
  const own = name.replace(/^\[TESZT\]\s*/u, "").trim().toLowerCase();
  // A source unit with the house's attribute forms struck out: what is left can relate a place.
  const relating = units.map((u) => PLACES.reduce((acc, p) => acc.replace(p.attr, " "), u.toLowerCase()));
  const out: PlacedClaim[] = [];
  for (const raw of text.split(PLACE_SPLIT).map((x) => x.trim()).filter(Boolean)) {
    const clause = own ? raw.toLowerCase().split(own).join(" ") : raw.toLowerCase();
    for (const p of PLACES) {
      const hit = p.at.exec(clause);
      if (!hit) continue;
      // The place word itself is not the thing placed („a teraszon” is no terrace claim).
      const scope = placedScope(clause, hit);
      const things = [...SERVICE_TERMS, ...FACILITY_TERMS];
      const unbacked = things.find(
        (t) => t.re.test(scope) && !relating.some((u) => t.re.test(u) && p.noun.test(u)),
      );
      if (unbacked) {
        out.push({ clause: raw, thing: unbacked.name, place: p.name });
        break;
      }
    }
  }
  return out;
}

export function lintPlacedClaim(c: CopySurface, source: CriticSource): Objection[] {
  const units = sourceUnits(source);
  const out: Objection[] = [];
  for (const { field, text } of surfaceLines(c)) {
    for (const h of placedClaims(text, units, source.name)) {
      out.push({
        field,
        quote: h.clause,
        kind: "tulzas_a_forrashoz",
        severity: "blokkolo",
        guestReaction: `„${h.clause}” — a(z) ${h.thing} és a(z) ${h.place} külön-külön igaz lehet, de hogy a(z) ${h.thing} OTT van, azt a szállás sehol nem mondja; érkezéskor ott keresem.`,
        fix: `hagyd el a helyhatározót (${h.place}); a két tényt külön állítsd, vagy csak annyit, amennyit EGY forrás-mondat együtt, viszonyként mond`,
        by: "lint",
      });
    }
  }
  return out;
}

/**
 * The critic's own grading, made consistent with its rulebook. The prompt calls these kinds
 * BLOCKING without exception, yet the model graded „Grillezési lehetőség a fedett teraszon”
 * (forrastalan_igeret) "javítandó" and the loop shipped it with a PASS (SZ2-1). An overstatement
 * is blocking when it inflates a service or a place/quality detail — the prompt's own line.
 */
const ALWAYS_BLOCKING: ReadonlySet<ObjectionKind> = new Set([
  "forrastalan_igeret",
  "velemeny_mint_szolgaltatas",
  "nem_letezo_fogalom",
  "al_idezet",
  // ADR-0324: the opening rules. A descriptive or inventory opening is the owner's „9/10”
  // complaint itself; grading it "javítandó" would ship it with a PASS.
  "leiro_nyitas",
  "leltar_nyitas",
  "minta_masolas",
  "hangulat_forras_nelkul",
]);
// NOT "megszolitas": the register is the lint twin's call (addressRegister.ts) — measured
// 2026-10-02, the model graded the magázó „Amit itt kap” a register error; raising its own
// mistake to blocking would send a correct page to the curator queue.
export function normalizeSeverity(o: Objection): Objection {
  if (o.severity === "blokkolo") return o;
  const blocking =
    ALWAYS_BLOCKING.has(o.kind) ||
    (o.kind === "tulzas_a_forrashoz" &&
      (SERVICE_TERMS.some((s) => s.re.test(o.quote)) ||
        DETAIL_TERMS.some((d) => d.re.test(o.quote)) ||
        OBJECT_TERMS.some((t) => t.re.test(o.quote))));
  return blocking ? { ...o, severity: "blokkolo" } : o;
}

/**
 * The lyrical-opening rules (lyricOpening.ts, ADR-0324) as blocking objections. Evidence is
 * the same unit set the other source rules read: listing labels + quotes, the prose, reviews.
 */
export function lintOpeningCopy(c: CopySurface, source: CriticSource): Objection[] {
  const reviews = [
    ...(source.reviews ?? []),
    ...source.facts.filter((f) => f.kind === "review").map((f) => f.quote ?? ""),
  ].filter((t) => t.trim());
  return lintOpening(surfaceLines(c), {
    name: source.name,
    town: source.town ?? null,
    texts: sourceUnits(source),
    reviews,
  }).map((f) => ({ ...f, severity: "blokkolo" as const, by: "lint" as const }));
}

// ── the critic ───────────────────────────────────────────────────────────────────────────

function registerRule(r: Register): string {
  return r === "magaz"
    ? "Az oldal a vendéget MAGÁZZA (a fix sablon-sorok is: „Írja meg”, „Az Ön neve”). Minden tegező alak („kapsz”, „várjuk a leveled”) BLOKKOLÓ. A ház T/1-ben („mi”: „teszünk”, „rólunk”) beszélhet magáról — az NEM megszólítás-hiba."
    : "Az oldal a vendéget TEGEZI. Minden magázó alak BLOKKOLÓ. A ház T/1-ben („mi”) beszélhet magáról — az NEM megszólítás-hiba.";
}

const CRITIC_SYSTEM = `Két ember vagy egyszerre, és EGY szállás-honlap szövegét olvasod.
1. VENDÉG: Kovács Judit, 46 éves, évente 5–6 belföldi utat foglal, Szallas.hu-n és Google-on keres, sok szállásoldalt látott már. Pontosan tudja, mit ígér egy szöveg, és számon is kéri.
2. SZERKESZTŐ: igényes magyar szövegíró, aki minden mondatra megkérdezi: „kiírná-e EZT egy normális magyar szállásadó a saját honlapjára?”

A feladatod NEM az újraírás, hanem a TÉTELES KIFOGÁS-LISTA. Minden kifogás egy konkrét szövegrészre mutat.

Mit keresel (a „kind” értékei):
- velemeny_mint_szolgaltatas — egy vendég-vélemény EGYSZERI élményéből vagy szívességéből SZOLGÁLTATÁS-ÍGÉRET lett, vagy a véleményből „bérelhető / kölcsönözhető / foglalható / ingyenes” ajánlat. Példa: a vélemény szerint a házigazda „kölcsönadta a biciklijét” → az oldalon „bérelhető kerékpárok”. A vendég ezt számon kéri érkezéskor. BLOKKOLÓ.
  ⚖️ A HATÁR (a ház szabálya): ha a vélemény egy ÁLLANDÓ adottságot ír le („van reggeli”, „grillezési lehetőség a teraszon”, „elegendő parkolóhely”, „van klíma”), az a vélemény erejéig ÁLLÍTHATÓ — hűen fordítva, felfújás nélkül. Ezt NE kifogásold csak azért, mert véleményből jön. Csak a szívességet, az egyszeri élményt és a felfújást kifogásold.
- tulzas_a_forrashoz — az állítás TÖBBET mond, mint a forrás: „elegendő parkoló” → „bőséges saját parkoló”; HOZZÁTETT HELY- VAGY MINŐSÉG-RÉSZLET egy szolgáltatáshoz vagy adottsághoz, amit a forrás nem mond („barbecue facilities” → „grillezés a FEDETT teraszon”; „breakfast” → „reggeli a TERASZON / a kertben”; „kilátással”, „saját”, „fűtött”, „ingyenes” forrás nélkül) — ez MINDIG BLOKKOLÓ, mert a vendég épp ezt a részletet kéri számon; ÖSSZEVONÁS: két forrásolt tény egy új viszonnyá kötve — „A szállás KERTTEL reggelente kontinentális reggelit szolgál fel” → „Kontinentális reggeli A KERTBEN” (a kert a házé, a reggeli helye nincs kimondva; a két szó együttállása a forrás-mondatban NEM bizonyíték), „Uszoda” egy szolgáltatás-listán → „Uszoda A HELYSZÍNEN”, „Saját parkoló” → „Saját parkoló AZ UDVARBAN” — BLOKKOLÓ; „csendes környék” → „a nyugodt Nádas közben” forrás nélküli jelzővel; TÁVOLSÁG felfújása („800 méterre” → „pár lépésre”, „karnyújtásnyira”) — a vendég lemérte a térképen. Vesd össze a FORRÁS idézettel betűre. BLOKKOLÓ, ha szolgáltatást vagy adottságot fúj fel; JAVÍTANDÓ, ha csak hangulati jelző.
- forrastalan_igeret — szolgáltatás (amit a ház AD: reggeli, kölcsönzés, transzfer, parkoló, program, grill-használat), amihez nincs forrás. ⚠️ Fotón egyértelműen látható SZERKEZETET vagy adottságot (medence, napozóágy, kert, udvar, erkély, kilátás, szobabútor) SOHA NE kifogásolj forrás miatt — a fotókat te nem látod, azt a fotó-őr ellenőrzi. Szolgáltatásra viszont a fotó SOHA nem forrás. BLOKKOLÓ.
  ⛔ KIVÉTEL — HOZZÁTETT KÜLTÉRI OBJEKTUM: terasz, kerti bútor / „bútorozott”, kerti pihenő / pihenősarok, grill, bogrács, kemence, jakuzzi / dézsa, szauna, játszótér / hinta / trambulin, függőágy, stég. Ezt a vendég HASZNÁLNI akarja és számon kéri, a szövegíró pedig a fotóból könnyen kikövetkezteti (egy pergolából „bútorozott terasz”, egy erkélyen álló székből „kerti pihenő” lesz). Ha a FORRÁSOK egyike sem nevezi meg a tárgyat, az forrastalan_igeret, BLOKKOLÓ.
- nem_letezo_fogalom — olyan magyar kifejezés, ami nincs a köznyelvben, vagy mást jelent („főtt reggeli” = főtt étel, nem meleg reggeli). BLOKKOLÓ.
- tukorforditas — angol szerkezet magyar szavakkal („cooked breakfast” → „főtt reggeli”, „nincs a képben”). BLOKKOLÓ, ha félreérthető.
- megszolitas — a ház megszólítási szabályától eltérő alak. BLOKKOLÓ.
- ai_sablon — gépi szöveg jele: „X várja a vendégeket”, „ahol az idő megáll”, hármas felsorolás + helyhatározó („medence, reggeli és kerékpárok a tó körül” — a tó körül a medencére is vonatkozik), túlhajtott jelzőhalmozás („kék vizű medence”), magazin-póz. JAVÍTANDÓ; BLOKKOLÓ, ha a főcímben vagy az alcímben áll.
- al_idezet — idézőjelben álló mondat, amit senki nem mondott. BLOKKOLÓ.
- nyelvtan — rossz vonzat, értelmetlen szerkezet („biciklik a Balatonhoz”), egyeztetés. BLOKKOLÓ, ha a főcímben áll.
- ismetles — a főcím, az alcím és a kiemelések ugyanazt mondják. JAVÍTANDÓ.
- ures_kituntetes — üres vagy önjelölt dicséret („kiváló kávé”, „tökéletes választás”) forrás nélkül. JAVÍTANDÓ.
A NYITÓRÉSZ (hero.lead, tagline, intro) LÍRAI: a hely érzetét adja (táj, fekvés, évszak, kinek való), FORRÁSBÓL.
- leiro_nyitas — a nyitórész a ház KINÉZETÉT írja le: felület, anyag, szín, tető, homlokzat, bútor („sötétre pácolt faház”, „cseréptetős épület”, „kerti bútor található”). BLOKKOLÓ.
- leltar_nyitas — a nyitórész felszereltséget SOROL (a főcímben és az alcímben legfeljebb EGY adottság állhat, élménybe ágyazva). BLOKKOLÓ.
- minta_masolas — a főcím egy ismert minta-mondat keretét ismétli. BLOKKOLÓ.
- hangulat_forras_nelkul — hangulati vagy érzéki TÉNY (csend, nyugalom, madárszó, illat, ropogó tűz, csillagos ég, tájegység), amit sem a leírás, sem egy vélemény nem mond; vagy csend/nyugalom, miközben egy vélemény zajra panaszkodik; vagy EGYETLEN vendég egyszeri élményéből („elaludtam a tornácon”) általános állítás („a vendégek mesélik”) vagy főcím. BLOKKOLÓ.

Szabályok:
- A „quote” a szövegből SZÓ SZERINT kimásolt részlet legyen (a gép visszakeresi).
- A „guestReaction” EGY mondat, a vendég fejében: mit gondol, amikor ezt olvassa.
- A „fix” KONKRÉT javaslat (új megfogalmazás, vagy „hagyd ki”), és CSAK a forrásban lévő tényre építhet.
- Ami jó, arról ne írj. Ha nincs kifogás, az üres lista a helyes válasz — ne gyárts kifogást.
- A szálláshely nevét, a települést és a Google-értékelést (ha a forrásban szerepel) ne kifogásold.`;

const OBJECTION_KINDS: readonly ObjectionKind[] = [
  "forrastalan_igeret", "tulzas_a_forrashoz", "velemeny_mint_szolgaltatas", "nem_letezo_fogalom",
  "tukorforditas", "megszolitas", "ai_sablon", "al_idezet", "nyelvtan", "ismetles", "ures_kituntetes",
  "leiro_nyitas", "leltar_nyitas", "minta_masolas", "hangulat_forras_nelkul",
];

const CRITIC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    objections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          field: { type: "string", description: "A mező kulcsa, ahogy a szövegben áll (pl. hero.lead, highlights[2])." },
          quote: { type: "string" },
          kind: { type: "string", enum: OBJECTION_KINDS },
          severity: { type: "string", enum: ["blokkolo", "javitando"] },
          guestReaction: { type: "string" },
          fix: { type: "string" },
        },
        required: ["field", "quote", "kind", "severity", "guestReaction", "fix"],
      },
    },
    summary: { type: "string", description: "Egy mondat: összességében hogy hat a szöveg egy vendégre." },
  },
  required: ["objections", "summary"],
} as const;

function describeSource(s: CriticSource): string {
  const listing = s.facts.filter((f) => f.kind === "listing");
  const review = s.facts.filter((f) => f.kind === "review");
  return [
    `Szállás: ${s.name}`,
    s.town ? `Település: ${s.town}` : "",
    s.address ? `Cím: ${s.address}` : "",
    s.rating ? `Google-értékelés: ${s.rating.value} (${s.rating.count ?? "?"} vélemény)` : "Google-értékelés: nincs",
    `\nA SZÁLLÁS SAJÁT HIRDETÉSÉBŐL (szolgáltatásként állítható):`,
    listing.length ? listing.map((f) => `- ${f.label}${f.quote ? ` — „${f.quote}”` : ""}`).join("\n") : "- nincs",
    `\nVENDÉG-VÉLEMÉNYEKBŐL KINYERT ÁLLÍTÁSOK (a címke a gép fordítása — az IDÉZET az igazság):`,
    review.length ? review.map((f) => `- ${f.label} — „${f.quote ?? ""}”`).join("\n") : "- nincs",
    s.descriptions?.length ? `\nA SZÁLLÁS SAJÁT BEMUTATKOZÁSA:\n${s.descriptions.map((d) => `"""${d.slice(0, 1200)}"""`).join("\n")}` : "",
    s.reviews?.length ? `\nA VENDÉG-VÉLEMÉNYEK TELJES SZÖVEGE:\n${s.reviews.map((r) => `"""${r.slice(0, 800)}"""`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function describeCopy(c: CopySurface): string {
  return surfaceLines(c).map((l) => `${l.field}: ${l.text}`).join("\n");
}

async function client(): Promise<AnthropicNS> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  return new Anthropic();
}

// Physical, photo-checkable things. The critic sees no photos, and on 2026-10-01 it still
// objected "napozóágyakkal" as unsourced (Muschel, visible on the photo) — so an
// "unsourced / overstated" objection that names ONLY such things, with no service word,
// is dropped here. A prompt is statistical, this filter is not.
const PHYSICAL =
  /(medenc|napozó|kert|terasz|erkély|kilátás|panorám|udvar|játszótér|trambulin|csúszd|hinta|szauna|jacuzzi|pezsgőfürdő|dézsa|stég|homokozó|szob|fürdő|konyh|nappali)/iu;
const SERVICE =
  /(bérel|kölcsön|ingyen|foglal|reggeli|vacsor|ellát|transzfer|parkol|program|grillez|wifi|klím|takarít|kisállat|kutya|kerékpár|bicikli)/iu;

/** Drops the critic's source-objections against things only a photo can confirm. */
export function dropPhotoOnlyObjections(objections: readonly Objection[]): Objection[] {
  return objections.filter(
    (o) =>
      !(
        o.by === "ai" &&
        (o.kind === "forrastalan_igeret" || o.kind === "tulzas_a_forrashoz") &&
        PHYSICAL.test(o.quote) &&
        !SERVICE.test(o.quote) &&
        // An outdoor amenity a guest plans to use is source-bound (SZ3-1), even next to a garden.
        !OBJECT_TERMS.some((t) => t.re.test(o.quote))
      ),
  );
}

/**
 * Words the rewrite brought in that the previous version did not have (≥ 5 letters).
 * Measured 2026-10-01 (Mandula): "túralehetőséggel" became "túravezetéssel" — a guided-tour
 * SERVICE nobody offers — and the critic, reading the whole page, did not notice. Handing it
 * the exact new words turns "spot what changed" into "check these", which it does well.
 */
export function newWords(current: CopySurface, previous: CopySurface): string[] {
  const words = (c: CopySurface) =>
    surfaceLines(c)
      .map((l) => l.text)
      .join(" ")
      .toLowerCase()
      .match(/\p{L}{5,}/gu) ?? [];
  const before = new Set(words(previous));
  return [...new Set(words(current))].filter((w) => !before.has(w));
}

export async function critiqueCopy(
  copy: CopySurface,
  source: CriticSource,
  register: Register,
  /** The version before the last rewrite: anything the rewrite ADDED is judged hardest. */
  previous?: CopySurface,
): Promise<{ objections: Objection[]; summary: string }> {
  const lint = [
    ...lintCopy(copy, register),
    ...lintOffers(copy, source),
    ...lintAddedDetail(copy, source),
    ...lintAddedObject(copy, source),
    ...lintPlacedClaim(copy, source),
    ...lintOpeningCopy(copy, source),
  ];
  const c = await client();
  const res = await c.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: CRITIC_SYSTEM,
    messages: [
      {
        role: "user",
        content:
          `MEGSZÓLÍTÁS (a ház szabálya): ${registerRule(register)}\n\n` +
          `═══ FORRÁSOK ═══\n${describeSource(source)}\n\n` +
          (previous
            ? `═══ AZ ELŐZŐ VÁLTOZAT (az író ezt javította) ═══\n${describeCopy(previous)}\n\n` +
              `⛔ Az író most javított. Amit az ELŐZŐHÖZ képest ÚJ állításként vagy új viszonyként\n` +
              `hozott be (pl. „reggeli a kertben”), és a forrás nem mondja, az BLOKKOLÓ.\n` +
              `Az író által ÚJONNAN behozott szavak (gépi lista — MINDEGYIKET vesd össze a forrással;\n` +
              `ha egy új szó szolgáltatást, ajánlatot vagy tényt állít, ami a forrásban nincs, BLOKKOLÓ):\n` +
              `${newWords(copy, previous).join(", ") || "nincs"}\n\n`
            : "") +
          `═══ A BÍRÁLANDÓ SZÖVEG (mező: szöveg) ═══\n${describeCopy(copy)}`,
      },
    ],
    output_config: { format: { type: "json_schema", schema: CRITIC_SCHEMA } },
  });
  recordAiUsage("guestCritic", MODEL, res.usage);
  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("critic: empty response");
  const parsed = JSON.parse(block.text) as { objections: Omit<Objection, "by">[]; summary: string };
  // A quote the critic cannot point at in the copy is not evidence — drop it rather than
  // send the writer chasing a phrase that is not there.
  const hay = describeCopy(copy).toLowerCase();
  const ai = parsed.objections
    .filter((o) => hay.includes(o.quote.toLowerCase().replace(/\s+/g, " ").trim()))
    .map((o) => normalizeSeverity({ ...o, by: "ai" as const }));
  // The deterministic finding WINS a duplicate: the critic once graded the same quote
  // "javítandó" that the offer rule calls blocking, and keeping the critic's copy would
  // have let the softer grade through.
  const aiKept = ai.filter((a) => !lint.some((l) => a.quote.toLowerCase().includes(l.quote.toLowerCase())));
  return { objections: dropPhotoOnlyObjections([...lint, ...aiKept]), summary: parsed.summary };
}

// ── the writer (text-only rewrite) ───────────────────────────────────────────────────────

const REWRITE_SYSTEM = `Magyar szálláshely-honlapok szövegírója vagy. Egy meglévő szöveget JAVÍTASZ egy vendég-kritikus tételes kifogásai alapján.

Szabályok:
1. MINDEN kifogást orvosolj. Ha egy állításhoz nincs olyan forrás, ami pontosan azt mondja, HAGYD KI — kevesebb, de igaz.
2. ÚJ tényt nem hozhatsz be. Csak a FORRÁSOK-ban lévő tényekre építhetsz.
3. VENDÉG-VÉLEMÉNYBŐL JÖVŐ TÉNY: ha a vélemény ÁLLANDÓ adottságot ír le (van reggeli, grillezési lehetőség, elegendő parkolóhely, klíma), az állítható — de pontosan a vélemény erejéig: „sufficient” = elegendő, nem bőséges; „parking” ≠ saját parkoló. Egy vendég EGYSZERI élménye vagy a házigazda szívessége (pl. kölcsönadta a biciklijét) SOHA nem lesz szolgáltatás, és véleményből nem lesz „bérelhető / ingyenes / foglalható” ajánlat — ezeket hagyd ki.
4. Úgy írj, ahogy egy jó ízlésű magyar szállásadó írná a saját honlapjára: egyszerű, természetes mondatok, élő magyar szavak. Nincs „X várja a vendégeket”, nincs ál-idézet, nincs jelzőhalmozás, nincs tükörfordítás.
5. A megszólítás a ház szabálya szerinti, végig egységesen.
6. A szerkezet marad: ugyanazok a mezők (a kulcsban "_" áll a pont helyett: hero_lead = hero.lead). A nyitórész (hero_lead, tagline, intro) LÍRAI: a hely érzetét adja forrásból (táj, fekvés, évszak, kinek való); a főcímben és az alcímben legfeljebb EGY adottság, élménybe ágyazva; a ház kinézete (felület, anyag, szín, bútor) és a felszereltség-lista NEM a nyitórészbe való. Vékony forrásnál a település és a célközönség adja a képet — tájat ne találj ki. Egy "_title" lehet kétsoros (\\n). Ami a jelenlegi szövegben nincs, azt a mezőt hagyd ki; ami kifogás nélküli, azt add vissza VÁLTOZATLANUL.
7. Ami nem kapott kifogást, azt NE írd át.
8. Nincs emoji, nincs szám, ami a forrásban nincs.
9. Tényeket NE kapcsolj össze új viszonnyal: ne tegyél helyhatározót, időt vagy célt egy tény mellé, ha a forrás nem mondja (ROSSZ: „medence és reggeli a kertben” — a reggeli nem a kertben van). Fizikai adottságot (medence, napozóágy, kert, terasz, kilátás) csak akkor hagyj ki, ha a kifogás KIFEJEZETTEN arra szól.
10. Előbb a "plan" mezőben döntsd el a javításokat; a többi mezőbe már CSAK a végleges, kész mondat kerül — magyarázat, javítás, ismétlés nélkül.`;

const SECTION_KEYS = ["features", "rooms", "gallery", "reviews", "faq"] as const;

// FLAT on purpose, and `plan` FIRST. Two measured failures (2026-10-01, 4 of 4 leads):
// (1) with hero as a nested object the model never closed the hero.lead string — after
// `lead` the grammar admits only `}`, the model's natural next token (`",`) was refused,
// and it kept writing inside the string ("…Keszthelyen.korrigálom.ennyi.ennyi…") to
// max_tokens; (2) with no place to deliberate it revised its headline inside the value.
// Every field is now a top-level string followed by more keys, and the plan holds the thinking.
const REWRITE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    plan: {
      type: "array",
      items: { type: "string" },
      description: "Kifogásonként EGY rövid sor: mit hogyan javítasz. Ez nem kerül az oldalra — itt gondolkodj, a mezőkbe már csak a kész szöveg kerül.",
    },
    hero_eyebrow: { type: "string" },
    hero_lead: { type: "string" },
    tagline: { type: "string" },
    intro: { type: "string" },
    highlights: { type: "array", items: { type: "string" } },
    ...Object.fromEntries(
      SECTION_KEYS.flatMap((k) => [
        [`${k}_eyebrow`, { type: "string" }],
        [`${k}_title`, { type: "string" }],
      ]),
    ),
  },
  required: ["plan", "hero_lead", "tagline", "intro", "highlights"],
};

/**
 * The writer never returns an accent: as a free-text schema field it degenerated into a
 * runaway keyword list (measured 2026-10-01, ran to max_tokens). The original accent is
 * carried over when it is still a verbatim substring of the rewritten heading, else dropped.
 */
function carryAccent(next: SectionCopy & { lead?: string }, prev: SectionCopy | undefined): SectionCopy {
  const host = next.lead ?? next.title ?? "";
  return prev?.accent && host.includes(prev.accent) ? { ...next, accent: prev.accent } : next;
}

/** Drop empty strings so an omitted field stays omitted (the template's generic head). */
function defined<T extends Record<string, string | undefined>>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === "string" && v.trim())) as T;
}

export async function rewriteCopy(
  copy: CopySurface,
  objections: readonly Objection[],
  source: CriticSource,
  register: Register,
): Promise<CopySurface> {
  const c = await client();
  const hero = copy.editorial.hero as (SectionCopy & { lead?: string }) | undefined;
  const current: Record<string, unknown> = defined({ hero_eyebrow: hero?.eyebrow, hero_lead: hero?.lead });
  Object.assign(current, { tagline: copy.tagline, intro: copy.intro, highlights: copy.highlights });
  for (const k of SECTION_KEYS) {
    const sc = copy.editorial[k];
    if (sc) Object.assign(current, defined({ [`${k}_eyebrow`]: sc.eyebrow, [`${k}_title`]: sc.title }));
  }
  const res = await c.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: REWRITE_SYSTEM,
    messages: [
      {
        role: "user",
        content:
          `MEGSZÓLÍTÁS (a ház szabálya): ${registerRule(register)}\n\n` +
          `═══ FORRÁSOK ═══\n${describeSource(source)}\n\n` +
          `═══ A JELENLEGI SZÖVEG (JSON) ═══\n${JSON.stringify(current, null, 1)}\n\n` +
          `═══ A VENDÉG-KRITIKUS KIFOGÁSAI ═══\n` +
          objections
            .map((o, i) => `${i + 1}. [${o.severity}] ${o.field} — „${o.quote}” (${o.kind}): ${o.guestReaction} → ${o.fix}`)
            .join("\n"),
      },
    ],
    output_config: { format: { type: "json_schema", schema: REWRITE_SCHEMA } },
  });
  recordAiUsage("guestCriticRewrite", MODEL, res.usage);
  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("rewrite: empty response");
  if (res.stop_reason === "max_tokens") throw new Error(`rewrite: truncated (${block.text.replace(/\u200b+/g, "⟨ZWSP⟩").slice(0, 1500)})`);
  const p = JSON.parse(block.text) as Record<string, string | string[] | undefined>;
  const str = (k: string) => (typeof p[k] === "string" && (p[k] as string).trim() ? (p[k] as string) : undefined);
  // An omitted field means "unchanged" (rule 7), never "delete": measured 2026-10-01, the
  // Mandula gallery lost its heading because the writer simply did not repeat it.
  const editorial: Record<string, SectionCopy> = {
    hero: carryAccent(
      defined({ eyebrow: str("hero_eyebrow") ?? hero?.eyebrow, lead: str("hero_lead") ?? hero?.lead }),
      hero,
    ),
  };
  for (const k of SECTION_KEYS) {
    // A section the original had no copy for stays without copy (the template's generic head).
    const prev = copy.editorial[k];
    if (!prev) continue;
    editorial[k] = carryAccent(
      defined({ eyebrow: str(`${k}_eyebrow`) ?? prev.eyebrow, title: str(`${k}_title`) ?? prev.title }),
      prev,
    );
  }
  return {
    tagline: str("tagline") ?? copy.tagline,
    intro: str("intro") ?? copy.intro,
    highlights: Array.isArray(p.highlights) ? p.highlights : copy.highlights,
    editorial: editorial as EditorialCopy,
  };
}

// ── the loop ─────────────────────────────────────────────────────────────────────────────

export async function runGuestCritic(
  copy: CopySurface,
  source: CriticSource,
  register: Register,
): Promise<CriticLoopResult> {
  if (!config.anthropicApiKey) return { rounds: [], final: copy, verdict: "error", reason: "nincs AI-kulcs" };
  const rounds: CriticRound[] = [];
  let current = copy;
  let previous: CopySurface | undefined;
  try {
    for (let i = 0; i <= MAX_ROUNDS; i++) {
      const { objections, summary } = await critiqueCopy(current, source, register, previous);
      const blocking = objections.filter((o) => o.severity === "blokkolo");
      rounds.push({ copy: current, objections, verdict: blocking.length ? "flag" : "pass", summary });
      // Minor objections are worth a rewrite too while rounds remain (measured: "a főszereplő",
      // "Bőséges" survived because the loop stopped at the first clean pass).
      if (objections.length === 0 || i === MAX_ROUNDS) break;
      previous = current;
      current = await rewriteCopy(current, objections, source, register);
    }
  } catch (err) {
    if (!rounds.length) return { rounds, final: copy, verdict: "error", reason: (err as Error).message };
  }
  const best = bestRound(rounds);
  const nBlocking = best.objections.filter((o) => o.severity === "blokkolo").length;
  return {
    rounds,
    final: best.copy,
    verdict: best.verdict,
    reason:
      (best.verdict === "pass"
        ? `${rounds.length} kör, blokkoló kifogás nincs`
        : `${rounds.length} kör után is ${nBlocking} blokkoló kifogás → kurátor-sor: ` +
          best.objections
            .filter((o) => o.severity === "blokkolo")
            .map((o) => `„${o.quote}” (${o.kind})`)
            .join(" · ")) + minorTail(best),
  };
}

/**
 * The minor objections the SHIPPED version still carries, named in the verdict reason. The
 * Muschel card read „3 kör, blokkoló kifogás nincs” while two of them stood on the page
 * (SZ2-1): a remark nobody fixes and nobody sees has no effect at all.
 */
export function minorTail(r: CriticRound): string {
  const minor = r.objections.filter((o) => o.severity === "javitando");
  return minor.length
    ? ` · ${minor.length} javítandó maradt (nem blokkol, nézd át): ` +
        minor.map((o) => `„${o.quote}” (${o.kind})`).join(" · ")
    : "";
}

/**
 * The CRITIQUED version with the fewest blocking, then fewest total objections; a later
 * round wins a tie. A rewrite can make things worse (measured: "reggeli a kertben" was
 * born in round 3), and shipping the last round regardless would ship that regression.
 * Only critiqued versions are candidates, so the verdict always describes what ships.
 */
export function bestRound(rounds: readonly CriticRound[]): CriticRound {
  const score = (r: CriticRound) => [
    r.objections.filter((o) => o.severity === "blokkolo").length,
    r.objections.length,
  ];
  let best = rounds[0]!;
  for (const r of rounds.slice(1)) {
    const [b1, t1] = score(r);
    const [b0, t0] = score(best);
    if (b1! < b0! || (b1 === b0 && t1! <= t0!)) best = r;
  }
  return best;
}

// ── wiring (one helper for both generation paths: generateEngine + recopy) ────────────────

/** The house register for guest-facing copy (owner ruling 2026-10-01: MAGÁZÁS). */
export const HOUSE_REGISTER: Register = "magaz";

const squeeze = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Build the critic's source from what the writer was handed. A fact is a REVIEW fact when
 * its verifying quote sits inside a guest review — that is the line ruling B draws (a
 * review may ground a standing facility, never an offer), so it must come from the
 * evidence, not from the source label (a portal host can be either a listing or a review).
 */
export function criticSourceOf(args: {
  name: string;
  town?: string | null;
  address?: string | null;
  rating?: { value: number; count: number | null } | null;
  facts: readonly { label: string; source: string; quote?: string }[];
  descriptions: readonly string[];
  reviews: readonly string[];
}): CriticSource {
  const revHay = args.reviews.map(squeeze);
  return {
    name: args.name,
    town: args.town ?? null,
    address: args.address ?? null,
    rating: args.rating ?? null,
    facts: args.facts.map((f) => ({
      label: f.label,
      ...(f.quote ? { quote: f.quote } : {}),
      source: f.source,
      kind:
        f.source === "google_places" || (f.quote && revHay.some((r) => r.includes(squeeze(f.quote!))))
          ? ("review" as const)
          : ("listing" as const),
    })),
    descriptions: args.descriptions,
    reviews: args.reviews,
  };
}

/**
 * Run the loop on freshly generated copy and return the copy to ship plus the keys to
 * persist on `mock_artifact.inputs`. `guestCriticVerdict` is read by the outreach send gate
 * (mockVerdictGate) next to the other guard verdicts: "flag"/"error" blocks sending.
 */
export async function applyGuestCritic(
  copy: CopySurface,
  source: CriticSource,
): Promise<{ copy: CopySurface; inputs: Record<string, unknown> }> {
  const r = await runGuestCritic(copy, source, HOUSE_REGISTER);
  const best = r.rounds.find((x) => x.copy === r.final);
  return {
    copy: r.final,
    inputs: {
      guestCriticVerdict: r.verdict,
      guestCriticReason: r.reason,
      guestCriticRounds: r.rounds.length,
      // What the critic still said about the SHIPPED version — the curator's reading list.
      guestCriticObjections: (best?.objections ?? []).map((o) => ({
        field: o.field,
        quote: o.quote,
        kind: o.kind,
        severity: o.severity,
        guestReaction: o.guestReaction,
        by: o.by,
      })),
    },
  };
}

/**
 * JUDGE ONLY — the curator's hand-written copy (ADR-0323, D2). The critic reads it and
 * grades it exactly as it grades a generated round, but NEVER rewrites it: the curator
 * answers for those words, and a machine silently "fixing" them would put text on the page
 * that nobody wrote. Same persisted keys as applyGuestCritic, so the send gate reads it.
 */
export async function judgeGuestCopy(copy: CopySurface, source: CriticSource): Promise<Record<string, unknown>> {
  if (!config.anthropicApiKey) {
    return { guestCriticVerdict: "error", guestCriticReason: "nincs AI-kulcs", guestCriticRounds: 0, guestCriticObjections: [] };
  }
  try {
    const { objections, summary } = await critiqueCopy(copy, source, HOUSE_REGISTER);
    const round: CriticRound = {
      copy,
      objections,
      verdict: objections.some((o) => o.severity === "blokkolo") ? "flag" : "pass",
      summary,
    };
    const blocking = objections.filter((o) => o.severity === "blokkolo");
    return {
      guestCriticVerdict: round.verdict,
      guestCriticReason:
        (round.verdict === "pass"
          ? "kézi szöveg: blokkoló kifogás nincs"
          : `kézi szöveg: ${blocking.length} blokkoló kifogás → ` +
            blocking.map((o) => `„${o.quote}” (${o.kind})`).join(" · ")) + minorTail(round),
      guestCriticRounds: 1,
      guestCriticObjections: objections.map((o) => ({
        field: o.field,
        quote: o.quote,
        kind: o.kind,
        severity: o.severity,
        guestReaction: o.guestReaction,
        by: o.by,
      })),
    };
  } catch (err) {
    return {
      guestCriticVerdict: "error",
      guestCriticReason: `a kézi szöveg nem ítélhető: ${(err as Error).message}`, // i18n-exempt: operator-facing verdict reason (console)
      guestCriticRounds: 0,
      guestCriticObjections: [],
    };
  }
}
