// AI "arculat-brief" (ADR-0005, layer 2). One vision call over the property's
// photos returns BOTH the copy AND a design brief: a palette sampled/harmonized
// from the images, a mood, and a suggested layout archetype. This is where AI
// makes the taste decision from the actual photos; the renderer (theme.ts) then
// applies it within safe rails. Falls back to null (→ seeded theme) without a key.

import { recordAiUsage } from "../ai/usage.js";
import type AnthropicNS from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { toImageBlocks } from "./images.js";
import type { ThemeBrief } from "./theme.js";
import { COPY_SCHEMA, EDITORIAL_SYSTEM, type EditorialCopy } from "../engine/copywriter.js";

export interface GeneratedBrief {
  tagline: string;
  intro: string;
  highlights: string[];
  palette: {
    accent: string;
    accentDark: string;
    bg: string;
    surface: string;
    ink: string;
    muted: string;
  };
  mood: string;
  archetype: "classic" | "split" | "gallery";
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    tagline: { type: "string", description: "Hívogató hero-alcím, egyetlen evokatív magyar mondat." },
    intro: {
      type: "string",
      description: "2-3 mondatos magyar bemutatkozó. Ha kaptál képeket, a rajtuk VALÓBAN LÁTHATÓ jellemzőket fűzd bele.",
    },
    highlights: {
      type: "array",
      items: { type: "string" },
      description: "3-4 rövid, a KÉPEKEN egyértelműen látható jellemző. Csak amit tényleg látsz.",
    },
    palette: {
      type: "object",
      additionalProperties: false,
      description: "A FOTÓK hangulatából levezetett, harmonikus paletta HEX-ben. Világos háttér, jól olvasható kontraszt.",
      properties: {
        accent: { type: "string", description: "Fő akcentszín (telített, a szállás karakteréből), pl. #7c2d3a" },
        accentDark: { type: "string", description: "Az akcent sötétebb árnyalata (hover), pl. #5e1f2a" },
        bg: { type: "string", description: "Világos oldal-háttér, pl. #faf6f0" },
        surface: { type: "string", description: "Kártya/felület szín, közel fehér, pl. #ffffff" },
        ink: { type: "string", description: "Sötét szövegszín, pl. #211d1a" },
        muted: { type: "string", description: "Halvány szövegszín, pl. #6b625b" },
      },
      required: ["accent", "accentDark", "bg", "surface", "ink", "muted"],
    },
    mood: { type: "string", description: "Egy szó a hangulatra: rusztikus | modern | elegáns | családias | tengerparti | borvidéki | természetközeli" },
    archetype: {
      type: "string",
      enum: ["classic", "split", "gallery"],
      description: "Melyik elrendezés illik: classic (nagy hero overlay), split (kép+szöveg kettéosztva), gallery (galéria-fókusz).",
    },
  },
  required: ["tagline", "intro", "highlights", "palette", "mood", "archetype"],
} as const;

const SYSTEM = `Magyar szálláshely-weboldal art-director + szövegíró vagy. A fotók alapján döntesz ARCULATOT és írsz szöveget.
- A palettát a KÉPEK valós színvilágából vezesd le (fa, kő, növény, ég, tó, textil) — harmonikus, világos, jól olvasható.
- Az archetípust a fotók karaktere döntse (sok jó tárgyfotó → gallery; egy erős hero-kép → classic; kiegyensúlyozott → split).
- A szöveg legyen meleg, konkrét, NEM generikus; csak a képeken EGYÉRTELMŰEN látható részletekre építs, ne találj ki tényt.
- ⛔⛔ HA KAPSZ "IGAZOLT SZOLGÁLTATÁSOK" LISTÁT, AZ A SZÖVEG ELSŐDLEGES FORRÁSA — nem a fotó.
  A fotóból a palettát, a hangulatot és az elrendezést vezeted le; azt viszont, hogy MIT KAP
  a vendég, a listából veszed. A "highlights" ilyenkor DÖNTŐEN a listából épüljön, abból is a
  legerősebb vendég-értékek (játszótér, saját parkoló, kert, medence, klíma, strand-közelség,
  kisállat-barát, reggeli, szauna, grill) — a bútorzat/dekor apróságai elé sorolva.
  (Megtörtént kár: egy játszótérrel, kerttel és saját parkolóval hirdetett CSALÁDI apartmanház
  mockjában az lett a fő kiemelés, hogy "olvasnivalóval teli könyvespolc a nappaliban", mert a
  szövegíró csak a fotókat látta. A vendég nem könyvespolcot keres.)
- ⛔ A "highlights" a VENDÉG SZÁMÁRA ÉRTÉKES dolgokat sorolja — amit használ, amiért választ,
  ami a döntésénél számít (medence, saját parkoló, kert/terasz, klíma, reggeli, étterem,
  strand-közelség, kisállat-barát, játszótér, panoráma, szauna, grill). NEM a kép LEÍRÁSA:
  a burkolat, a falszín, az ágynemű, a padló, a homlokzat, a dekoráció SENKIT nem érdekel.
  ROSSZ: "Bézs csempés fürdőszoba üvegkabinos zuhannyal" · "Világos szobák kék-zöld
  ágyneművel és laminált padlóval" · "Napsütötte sárga homlokzat" · "Cserepes növényekkel
  díszített bejárat".  JÓ: "Kültéri medence napozóterasszal" · "Saját parkoló az udvarban" ·
  "Légkondicionált szobák" · "Kutyabarát szállás" · "Kerti grillezés lehetősége".
  Ha egy képről nem olvasható ki vendég-érték, inkább HAGYD KI — kevesebb, de erős.
- A "Régió" mező KERESÉSI TERÜLET címkéje, NEM a szállás elhelyezkedése — földrajzi pozíciót
  (pl. melyik parton/oldalon fekszik) SOHA ne állíts belőle. (Megtörtént kár: a "Balaton
  északi part" sweep-címkéből "az északi parton" tagline lett egy DÉLI parti szállásról.)
- Nincs emoji, nincs klisé.`;

export async function generateBrief(input: {
  name: string;
  region: string;
  regionContext: string;
  imageUrls?: string[];
  /** Free-text curator guidance (tone/emphasis/audience). VOICE steering only — the §B.17
   *  fact contract still governs: guidance can never add a fact the sources don't carry. */
  curatorGuidance?: string;
  /** ADR-0036: target language name for the copy (e.g. "lengyel (polski)"); absent → magyar. */
  languageName?: string;
}): Promise<GeneratedBrief | null> {
  if (!config.anthropicApiKey) return null;
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();

  const images = (input.imageUrls ?? []).slice(0, 4);
  const content: AnthropicNS.ContentBlockParam[] = [];
  // Inlined by us — portal hosts block the API's own fetcher (see toImageBlocks).
  for (const block of await toImageBlocks(images)) {
    content.push(block as AnthropicNS.ContentBlockParam);
  }
  content.push({
    type: "text",
    text:
      `Szállás: ${input.name}\nRégió: ${input.region}\nKontextus: ${input.regionContext}\n\n` +
      (images.length
        ? "A képek erről a szállásról készültek. Belőlük vezesd le a palettát, a hangulatot és az illő elrendezést, és írd meg a szöveget a láthatókra építve."
        : "Nincs kép — a régióra jellemző, biztonságos palettát és szöveget adj.") +
      (input.curatorGuidance?.trim()
        ? `\n\nKURÁTOR-IRÁNYMUTATÁS (hangvétel/hangsúly — tényt EBBŐL SEM találhatsz ki): ${input.curatorGuidance.trim()}`
        : "") +
      (input.languageName
        ? `\n\nCÉL-NYELV (ADR-0036): a tagline/intro/highlights szövegét ${input.languageName} nyelven írd — a célközönség ezen a nyelven olvassa az oldalt. Minden más szabály változatlan.`
        : ""),
  });

  const res = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    system: SYSTEM,
    messages: [{ role: "user", content }],
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
  });
  recordAiUsage("generateBrief", "claude-opus-4-8", res.usage);
  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") return null;
  try {
    return JSON.parse(block.text) as GeneratedBrief;
  } catch {
    return null;
  }
}


// ── Merged brief + editorial (ONE vision call) ────────────────────────────────────────────
//
// MEASURED motivation (2026-08-29): the engine path used to send the SAME 4 photos twice —
// once for the brief, once for the editorial copy — and vision input is ~99% of the mock's
// bill. Downscaling was measured and rejected (it cost facts: "ventilátoros szobák" got
// invented at 1024px — see images.ts). Sending the identical pixels ONCE is the lever that
// costs nothing: the model sees exactly what it saw before, half as often. Both prompts are
// reused VERBATIM (concatenated) so neither voice drifts from its tuned original.

const MERGED_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    brief: SCHEMA,
    editorial: COPY_SCHEMA,
    sellingPoints: {
      type: "array",
      // NB: maxItems is NOT accepted by the structured-output schema validator
      // (measured 2026-09-06: 400 invalid_request_error) — the 12-item cap lives
      // in validateSellingPoints instead.
      description:
        "A bemutatkozó szöveg(ek)ben állított KONKRÉT vendég-döntési tények — CSAK ha kaptál bemutatkozó szöveget.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: {
            type: "string",
            description: "Rövid tény-címke a vendég nyelvén (2–4 szó, pl. \"borkóstolás helyi termelőknél\").",
          },
          quote: {
            type: "string",
            description:
              "SZÓ SZERINTI, változtatás nélküli idézet a megadott bemutatkozó szövegből, ami ezt a tényt állítja.",
          },
        },
        required: ["label", "quote"],
      },
    },
  },
  required: ["brief", "editorial"],
} as const;

const MERGED_SYSTEM =
  SYSTEM +
  `\n\n═══ MÁSODIK FELADAT — UGYANEBBEN A VÁLASZBAN ═══\n` +
  `A fenti arculat-brief MELLETT (a "brief" kulcsban) írd meg az oldal EDITORIAL márkahangját is\n` +
  `(az "editorial" kulcsban), UGYANAZOKRA a fotókra és tényekre alapozva. Az editorial feladatra\n` +
  `az alábbi szabályok érvényesek (a "KIZÁRÓLAG a márkahang" ott a kulcs tartalmára értendő):\n\n` +
  EDITORIAL_SYSTEM +
  `\n\n═══ A KÉT FELADAT EGY LAPON TALÁLKOZIK ═══\n` +
  `A "brief.tagline" és az "editorial.hero.lead" EGYÜTT jelenik meg a herón: a lead a H1,\n` +
  `a tagline közvetlenül alatta az alcím. ⛔ A tagline NEM ismételheti meg a lead által már\n` +
  `megnevezett szolgáltatásokat — ami a főcímben már ott van, arra az alcím sorát elkölteni\n` +
  `nulla új információ. Az alcím a MÁSODIK réteget viszi: MÁSIK igazolt adottság, a település-\n` +
  `kontextus, vagy hogy KINEK való a hely (család, baráti kör, elvonulás). (Mért kár,\n` +
  `2026-09-06: a "Medence, dézsafürdő és grillezős kert…" főcím alá "Medence, dézsafürdő és\n` +
  `csendes kert…" alcím ment — ugyanaz a sor kétszer.)\n` +
  `\n═══ HARMADIK FELADAT — TÉNY-KINYERÉS IDÉZETTEL ═══\n` +
  `Ha kaptál BEMUTATKOZÓ SZÖVEGET vagy VENDÉG-VÉLEMÉNYEKET, a "sellingPoints" kulcsban\n` +
  `sorold fel az ÖSSZES bennük állított konkrét, vendég-döntési tényt (szolgáltatás,\n` +
  `adottság, elhelyezkedés, élmény — pl. borkóstolás, szarvasles, kemencés sütés), rövid\n` +
  `címkével ÉS a forrás-szöveg SZÓ SZERINTI idézetével, ami a tényt állítja. ⛔ Az idézet\n` +
  `betűre pontos legyen — gépi ellenőrzés veti össze a forrással, és ami nem szó szerinti,\n` +
  `azt eldobjuk. Berendezés-leírás (ágy, kanapé, hűtő) NEM tény-kinyerési cél. Ha nincs\n` +
  `forrás-szöveg, a kulcsot hagyd üresen.`;

/**
 * Why the LAST brief call fell back to the fact-safe path (null = it did not).
 * Read by the callers that report to a human — see `explainAiFailure`.
 */
let lastBriefError: string | null = null;

/**
 * The last AI failure, in words an operator can ACT on. An API error string is
 * not an answer to "why did nothing happen?": the credit-balance case in
 * particular is a business problem (top up), not a retry-later hiccup.
 */
export function explainAiFailure(): string | null {
  if (!lastBriefError) return null;
  const raw = lastBriefError;
  if (/credit balance is too low/i.test(raw))
    return "az AI-szolgáltatás egyenlege elfogyott — a Claude-fiókban kell feltölteni (addig egyetlen szöveg- vagy mock-generálás sem tud lefutni)";
  if (/rate.?limit|429/i.test(raw)) return "az AI-szolgáltatás pillanatnyilag korlátoz (rate limit) — néhány perc múlva újra";
  if (/401|403|authentication|api.?key/i.test(raw)) return "az AI-kulcs érvénytelen vagy lejárt — a beállításokban kell frissíteni";
  if (/timeout|ETIMEDOUT|ECONNRESET|fetch failed|ENOTFOUND/i.test(raw)) return "az AI-szolgáltatás nem volt elérhető (hálózati hiba) — próbáld újra";
  return `az AI-hívás hibára futott: ${raw.slice(0, 160)}`;
}

/**
 * One call → the design brief AND the editorial copy, grounded on ONE photo send.
 * Keyless or on any error → { brief: null, editorial: {} }: the engine falls back to
 * region-only copy + generic headings, exactly as the two separate calls did. Never throws.
 */
export async function generateBriefAndCopy(input: {
  name: string;
  region: string;
  regionContext: string;
  address?: string | null;
  /** REAL numbers the editorial may use verbatim (e.g. the A4-gated Google rating). */
  realStats?: readonly { value: string; label: string }[];
  /**
   * What the property's OWN verified listing states it offers (high-band portal profiles).
   * These are the guest-decision facts — a playground, a private car park, a garden — and
   * without them the writer can only describe the furniture it sees in the photos.
   */
  sourcedFacts?: {
    readonly amenities?: readonly string[];
    /** The listing's own prose. FACT SOURCE ONLY — never to be reused as sentences. */
    readonly descriptions?: readonly string[];
    /**
     * GUEST VOICE (ADR-0106): public reviews of THIS property. The one source
     * that already speaks the guest's language — it steers the TONE (warm,
     * experience-led, never a technical inventory) and supplies facts a guest
     * actually cared about. Never copied verbatim into the copy.
     */
    readonly guestVoice?: readonly { text: string; rating?: number; source: string }[];
  };
  imageUrls?: string[];
  curatorGuidance?: string;
  languageName?: string;
}): Promise<{
  brief: GeneratedBrief | null;
  editorial: EditorialCopy;
  /**
   * Guest-decision facts the model lifted OUT of the listing prose, each backed by a
   * VERBATIM quote that we re-verified against the source text (§B.17: open vocabulary,
   * deterministic evidence). Only validated entries appear here — an unverifiable quote
   * is dropped, never trusted. Empty when no descriptions were provided.
   */
  sellingPoints: readonly { label: string; quote: string }[];
}> {
  if (!config.anthropicApiKey) return { brief: null, editorial: {}, sellingPoints: [] };
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();

    const images = (input.imageUrls ?? []).slice(0, 4);
    const content: AnthropicNS.ContentBlockParam[] = [];
    for (const block of await toImageBlocks(images)) {
      content.push(block as AnthropicNS.ContentBlockParam);
    }
    content.push({
      type: "text",
      text:
        `Szállás: ${input.name}\nRégió: ${input.region}\nKontextus: ${input.regionContext}\n` +
        (input.address ? `Cím: ${input.address}\n` : "") +
        (input.realStats?.length
          ? `Valós számok (CSAK ezeket használhatod számként): ${input.realStats.map((s) => `${s.value} ${s.label}`).join(" · ")}\n`
          : "Valós számok: NINCS — ne írj számot.\n") +
        (input.sourcedFacts?.amenities?.length
          ? `\nIGAZOLT SZOLGÁLTATÁSOK — a szállás SAJÁT, ellenőrzött hirdetéséből, EROSSÉG SZERINT\n` +
            `CSÖKKENŐ sorrendben (a lista ELEJE a legerősebb vendég-döntési tény). Ezek VALÓS,\n` +
            `forrásolt tények, és ezek mondják meg, MIÉRT választja a vendég ezt a helyet.\n` +
            `⛔ A hero főcím a lista ELEJÉRŐL nevezzen meg 1–3 tényt — a lista végéről főcímet\n` +
            `építeni (parkoló, wifi) a legerősebb adottság elhallgatása.\n` +
            `A "highlights" ELSŐSORBAN ezekből épüljön; a fotó a hangulaté és a palettáé.\n` +
            `⛔ RANGSOR: ha a tények közt VÍZPARTI FEKVÉS, saját strand, stég, medence vagy\n` +
            `panoráma szerepel, a tagline és az első kiemelés EZT vigye — a kert, a parkoló, a\n` +
            `terasz ezek MÖGÉ sorolódik. (Megtörtént kár: egy közvetlen vízparti, saját strandos,\n` +
            `stéges villát "tágas kert, teraszos étkező és saját parkoló" főcímmel adtunk el.)\n` +
            input.sourcedFacts.amenities.map((a) => `- ${a}`).join("\n") +
            `\n`
          : "") +
        (input.sourcedFacts?.descriptions?.length
          ? `\nA SZÁLLÁS SAJÁT BEMUTATKOZÁSA az ellenőrzött hirdetéséről. ⛔ Ez TÉNY-FORRÁS, NEM\n` +
            `átvehető szöveg: mondatot, fordulatot, félmondatot SOHA ne másolj belőle (idegen\n` +
            `szerzői mű), és ami benne SZÁM vagy dátum, azt se vedd át — elavulhatott. Amit\n` +
            `használhatsz: a hely valós karaktere és kínálata, a SAJÁT szavaiddal újraírva.\n` +
            input.sourcedFacts.descriptions.map((d) => `"""${d}"""`).join("\n") +
            `\n`
          : "") +
        (input.sourcedFacts?.guestVoice?.length
          ? `\nVENDÉG-VÉLEMÉNYEK — nyilvános értékelések ERRŐL a szállásról (ADR-0106). Ez a\n` +
            `vendégek SAJÁT hangja: azt mondja meg, MIT szerettek itt valójában, és ez a\n` +
            `leghitelesebb vendég-döntési érv. A szöveg HANGNEMÉT is ez vezesse: meleg,\n` +
            `élmény-fókuszú, ahogy egy elégedett vendég mesélne róla — NEM műszaki leltár.\n` +
            `⛔ Mondatot szó szerint NEM vehetsz át (más szerzői műve) és a véleményt nem\n` +
            `tulajdoníthatod a szállásnak — amit használhatsz: a VISSZATÉRŐ, pozitív elemek a\n` +
            `saját szavaiddal ("a vendégek visszatérően dicsérik a házigazda vendégszeretetét").\n` +
            `⛔ Negatívumot ne emelj be; tényt ebből is csak akkor állíts, ha a vélemény kimondja.\n` +
            input.sourcedFacts.guestVoice
              .map((v) => `- "${v.text}"${v.rating ? ` (${v.rating}/5, ${v.source})` : ` (${v.source})`}`)
              .join("\n") +
            `\n`
          : "") +
        `\n` +
        (images.length
          ? "A képek erről a szállásról készültek. Belőlük vezesd le a palettát, a hangulatot és az illő elrendezést, írd meg a szöveget a láthatókra építve — ÉS ugyanezekből az editorial márkahangot is."
          : "Nincs kép — a régióra jellemző, biztonságos palettát, szöveget és editorial hangot adj.") +
        (input.curatorGuidance?.trim()
          ? `\n\nKURÁTOR-IRÁNYMUTATÁS (hangvétel/hangsúly — tényt EBBŐL SEM találhatsz ki): ${input.curatorGuidance.trim()}`
          : "") +
        (input.languageName
          ? `\n\nCÉL-NYELV (ADR-0036): MINDEN szöveget (brief ÉS editorial) ${input.languageName} nyelven írj. Minden más szabály változatlan.`
          : ""),
    });

    const res = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2000,
      system: MERGED_SYSTEM,
      messages: [{ role: "user", content }],
      output_config: { format: { type: "json_schema", schema: MERGED_SCHEMA } },
    });
    recordAiUsage("briefAndCopy", "claude-opus-4-8", res.usage);
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return { brief: null, editorial: {}, sellingPoints: [] };
    const parsed = JSON.parse(block.text) as {
      brief: GeneratedBrief;
      editorial: EditorialCopy;
      sellingPoints?: { label?: string; quote?: string }[];
    };
    return {
      brief: parsed.brief ?? null,
      editorial: parsed.editorial ?? {},
      // Quote corpus = the prose AND the guest reviews (ADR-0106): a fact the
      // model lifted out of a review must be verifiable against that review.
      sellingPoints: validateSellingPoints(parsed.sellingPoints, [
        ...(input.sourcedFacts?.descriptions ?? []),
        ...(input.sourcedFacts?.guestVoice ?? []).map((v) => v.text),
      ]),
    };
  } catch (err) {
    // The REASON must survive (2026-09-07): the API answered "credit balance is
    // too low", the console said nothing, and the owner spent the afternoon
    // pressing a button that could not possibly work. A fact-safe fallback is
    // right; swallowing WHY it fell back is not.
    lastBriefError = (err as Error).message;
    console.warn(`  [briefAndCopy] kihagyva → fact-safe fallback: ${lastBriefError}`);
    return { brief: null, editorial: {}, sellingPoints: [] };
  }
}

/**
 * §B.17 evidence gate for the open-vocabulary extraction: a selling point survives ONLY
 * if its quote is found VERBATIM (after whitespace collapse, case kept loose) inside one
 * of the provided source descriptions. The model was told the quote must be exact; this
 * is the structural twin that makes the instruction enforceable — a paraphrased or
 * invented "quote" silently drops the fact rather than shipping it.
 */
function validateSellingPoints(
  points: readonly { label?: string; quote?: string }[] | undefined,
  descriptions: readonly string[] | undefined,
): { label: string; quote: string }[] {
  if (!points?.length || !descriptions?.length) return [];
  const squeeze = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const hay = squeeze(descriptions.join(" \n "));
  const out: { label: string; quote: string }[] = [];
  for (const p of points) {
    const label = p.label?.trim();
    const quote = p.quote?.trim();
    if (!label || !quote || label.length > 60 || quote.length < 8) continue;
    if (!hay.includes(squeeze(quote))) continue;
    if (out.some((o) => o.label.toLowerCase() === label.toLowerCase())) continue;
    out.push({ label, quote });
    if (out.length >= 12) break;
  }
  return out;
}

/** Map an AI brief to the theme steering input. */
export function briefToThemeBrief(b: GeneratedBrief): ThemeBrief {
  return {
    palette: {
      accent: b.palette.accent,
      accentDark: b.palette.accentDark,
      bg: b.palette.bg,
      surface: b.palette.surface,
      ink: b.palette.ink,
      muted: b.palette.muted,
    },
    archetype: b.archetype,
    mood: b.mood,
  };
}
