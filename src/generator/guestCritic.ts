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
  | "ures_kituntetes";

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
- tulzas_a_forrashoz — az állítás TÖBBET mond, mint a forrás: „elegendő parkoló” → „bőséges saját parkoló”; „csendes környék” → „a nyugodt Nádas közben” forrás nélküli jelzővel; TÁVOLSÁG felfújása („800 méterre” → „pár lépésre”, „karnyújtásnyira”) — a vendég lemérte a térképen. Vesd össze a FORRÁS idézettel betűre. BLOKKOLÓ, ha szolgáltatást vagy adottságot fúj fel; JAVÍTANDÓ, ha csak hangulati jelző.
- forrastalan_igeret — szolgáltatás (amit a ház AD: reggeli, kölcsönzés, transzfer, parkoló, program, grill-használat), amihez nincs forrás. ⚠️ Fizikai tárgyat, berendezést vagy adottságot (medence, napozóágy, kert, terasz, kilátás, szobabútor) SOHA NE kifogásolj forrás miatt — a fotókat te nem látod, azt a fotó-őr ellenőrzi. Szolgáltatásra viszont a fotó SOHA nem forrás. BLOKKOLÓ.
- nem_letezo_fogalom — olyan magyar kifejezés, ami nincs a köznyelvben, vagy mást jelent („főtt reggeli” = főtt étel, nem meleg reggeli). BLOKKOLÓ.
- tukorforditas — angol szerkezet magyar szavakkal („cooked breakfast” → „főtt reggeli”, „nincs a képben”). BLOKKOLÓ, ha félreérthető.
- megszolitas — a ház megszólítási szabályától eltérő alak. BLOKKOLÓ.
- ai_sablon — gépi szöveg jele: „X várja a vendégeket”, „ahol az idő megáll”, hármas felsorolás + helyhatározó („medence, reggeli és kerékpárok a tó körül” — a tó körül a medencére is vonatkozik), túlhajtott jelzőhalmozás („kék vizű medence”), magazin-póz. JAVÍTANDÓ; BLOKKOLÓ, ha a főcímben vagy az alcímben áll.
- al_idezet — idézőjelben álló mondat, amit senki nem mondott. BLOKKOLÓ.
- nyelvtan — rossz vonzat, értelmetlen szerkezet („biciklik a Balatonhoz”), egyeztetés. BLOKKOLÓ, ha a főcímben áll.
- ismetles — a főcím, az alcím és a kiemelések ugyanazt mondják. JAVÍTANDÓ.
- ures_kituntetes — üres vagy önjelölt dicséret („kiváló kávé”, „tökéletes választás”) forrás nélkül. JAVÍTANDÓ.

Szabályok:
- A „quote” a szövegből SZÓ SZERINT kimásolt részlet legyen (a gép visszakeresi).
- A „guestReaction” EGY mondat, a vendég fejében: mit gondol, amikor ezt olvassa.
- A „fix” KONKRÉT javaslat (új megfogalmazás, vagy „hagyd ki”), és CSAK a forrásban lévő tényre építhet.
- Ami jó, arról ne írj. Ha nincs kifogás, az üres lista a helyes válasz — ne gyárts kifogást.
- A szálláshely nevét, a települést és a Google-értékelést (ha a forrásban szerepel) ne kifogásold.`;

const OBJECTION_KINDS: readonly ObjectionKind[] = [
  "forrastalan_igeret", "tulzas_a_forrashoz", "velemeny_mint_szolgaltatas", "nem_letezo_fogalom",
  "tukorforditas", "megszolitas", "ai_sablon", "al_idezet", "nyelvtan", "ismetles", "ures_kituntetes",
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
        !SERVICE.test(o.quote)
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
  const lint = [...lintCopy(copy, register), ...lintOffers(copy, source)];
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
    .map((o) => ({ ...o, by: "ai" as const }));
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
6. A szerkezet marad: ugyanazok a mezők (a kulcsban "_" áll a pont helyett: hero_lead = hero.lead). A hero_lead MEGNEVEZ legalább egy konkrét dolgot, amit a vendég itt kap. Egy "_title" lehet kétsoros (\\n). Ami a jelenlegi szövegben nincs, azt a mezőt hagyd ki; ami kifogás nélküli, azt add vissza VÁLTOZATLANUL.
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
      best.verdict === "pass"
        ? `${rounds.length} kör, blokkoló kifogás nincs`
        : `${rounds.length} kör után is ${nBlocking} blokkoló kifogás → kurátor-sor: ` +
          best.objections
            .filter((o) => o.severity === "blokkolo")
            .map((o) => `„${o.quote}” (${o.kind})`)
            .join(" · "),
  };
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
