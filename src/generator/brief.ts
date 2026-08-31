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
  },
  required: ["brief", "editorial"],
} as const;

const MERGED_SYSTEM =
  SYSTEM +
  `\n\n═══ MÁSODIK FELADAT — UGYANEBBEN A VÁLASZBAN ═══\n` +
  `A fenti arculat-brief MELLETT (a "brief" kulcsban) írd meg az oldal EDITORIAL márkahangját is\n` +
  `(az "editorial" kulcsban), UGYANAZOKRA a fotókra és tényekre alapozva. Az editorial feladatra\n` +
  `az alábbi szabályok érvényesek (a "KIZÁRÓLAG a márkahang" ott a kulcs tartalmára értendő):\n\n` +
  EDITORIAL_SYSTEM;

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
  };
  imageUrls?: string[];
  curatorGuidance?: string;
  languageName?: string;
}): Promise<{ brief: GeneratedBrief | null; editorial: EditorialCopy }> {
  if (!config.anthropicApiKey) return { brief: null, editorial: {} };
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
          ? `\nIGAZOLT SZOLGÁLTATÁSOK — a szállás SAJÁT, ellenőrzött hirdetéséből. Ezek VALÓS,\n` +
            `forrásolt tények, és ezek mondják meg, MIÉRT választja a vendég ezt a helyet.\n` +
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
    if (!block || block.type !== "text") return { brief: null, editorial: {} };
    const parsed = JSON.parse(block.text) as { brief: GeneratedBrief; editorial: EditorialCopy };
    return { brief: parsed.brief ?? null, editorial: parsed.editorial ?? {} };
  } catch (err) {
    console.warn(`  [briefAndCopy] kihagyva → fact-safe fallback: ${(err as Error).message}`);
    return { brief: null, editorial: {} };
  }
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
