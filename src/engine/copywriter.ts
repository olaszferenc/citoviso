// Grounded EDITORIAL copywriter / art-director (ADR-0018 A' path). The engine's second AI
// step (after the composition planner): it writes BRAND VOICE — a poetic hero lead + per-
// section headings — that lift the render to the reference "wow" bar. It writes VOICE ONLY,
// never HTML and never a hard fact: the copy is grounded on the lead's real facts + photos,
// and the §B.17 contract forbids inventing any number/award/amenity. Keyless → returns {}
// (the primitives fall back to their generic headings; mock=live is preserved either way).

import { recordAiUsage } from "../ai/usage.js";
import type AnthropicSdk from "@anthropic-ai/sdk";

import { config } from "../config.js";
import { toImageBlocks } from "../generator/images.js";
import type { SectionCopy, SiteData } from "./recipe.js";

/** Per-section editorial copy the planner attaches to the recipe. All sections optional. */
export interface EditorialCopy {
  readonly hero?: SectionCopy;
  readonly features?: SectionCopy;
  readonly rooms?: SectionCopy;
  readonly gallery?: SectionCopy;
  readonly reviews?: SectionCopy;
  readonly faq?: SectionCopy;
  readonly location?: SectionCopy;
}

const SECTION_COPY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    eyebrow: { type: "string", description: "Rövid kicker a cím fölött (2–5 szó). Csak valós tényből." },
    title: { type: "string", description: "Márkahangú szekció-cím. \\n = sortörés. Sose tartalmazzon KITALÁLT számot." },
    accent: { type: "string", description: "A title EGY pontos részlánca, amit kiemelünk (dőlt akcent). Elhagyható." },
  },
} as const;

const HERO_COPY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    eyebrow: { type: "string", description: "Rövid kicker (hely/jelleg) — csak valós tényből (régió, cím). Ne találj ki számot." },
    lead: {
      type: "string",
      description:
        "A hero vezércíme: rövid mondat, ami MEGNEVEZ legalább egy konkrét dolgot, amit a vendég " +
        "itt KAP (az igazolt tényekből). NEM a szállás neve, NEM tiszta hangulat, és TILOS benne " +
        "építőanyag/szerkezet (fenyőgerendás, tetőtér, lambéria, beton…) — arra senki nem keres.",
    },
    accent: { type: "string", description: "A lead EGY pontos részlánca, amit kiemelünk (dőlt akcent)." },
  },
  required: ["lead"],
} as const;

/** Exported for the merged brief+copy call (brief.ts) — ONE photo send instead of two. */
export const COPY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    hero: HERO_COPY_SCHEMA,
    features: SECTION_COPY_SCHEMA,
    rooms: SECTION_COPY_SCHEMA,
    gallery: SECTION_COPY_SCHEMA,
    reviews: SECTION_COPY_SCHEMA,
    faq: SECTION_COPY_SCHEMA,
    // NB: no `location` key — the schema grammar caps optional params at 24 and the location
    // head's generic "Megközelítés és kapcsolat" is exactly right anyway. The EditorialCopy
    // field stays for future use (e.g. tenant-edited copy).
  },
  required: ["hero"],
};

/** Exported for the merged brief+copy call (brief.ts). */
export const EDITORIAL_SYSTEM = `Szálláshely-weboldal COPYWRITER és art-director vagy. A feladatod KIZÁRÓLAG a MÁRKAHANG:
a hero KÖLTŐI vezércíme + néhány szekció rövid, hangulatos címe. NEM írsz HTML-t, NEM írsz törzsszöveget.

SZIGORÚ SZABÁLYOK (kötelező):
1. TÉNYHŰSÉG (§B.17): SOHA ne találj ki számot, díjat, csillagot, díjazást, méretet vagy konkrét jellemzőt.
   Számot CSAK akkor írhatsz, ha a megadott tények között PONTOSAN szerepel. Ha nincs ilyen adat, ne írj számot.
2. ⛔⛔ A hero "lead" A LAP LEGOLVASOTTABB SORA — ITT DŐL EL, HOGY A VENDÉG TOVÁBBOLVAS-E.
   Ezért KÖTELEZŐEN meg kell neveznie legalább EGY KONKRÉT dolgot, amit a vendég itt KAP
   (medence, játszótér, kert, saját parkoló, panoráma, strand-közelség, grill, szauna,
   kisállat-barát, babafelszerelés…) — abból, amit a megadott IGAZOLT tények felsorolnak.
   A hangulat SZÍNEZHETI a mondatot, de NEM LÉPHET A TARTALOM HELYÉBE.
   ⛔ TILOS a tisztán hangulati főcím. Megtörtént kár, a tulaj szava szerint "orbitális
   perverz faszság": "Fenyőillatú csend a tető alatt", "Fából ácsolt csend, ahol az idő
   lassabban jár", "Faillatú csend a Balatonnál" — egy játszótérrel, kerttel, saját
   parkolóval és teljes babafelszereléssel hirdetett családi apartmanházra. Ezek semmit
   nem mondanak, és a "Faillatú" nem is magyar szó.
   ⛔ TILOS kitalált összetett szót gyártani ("faillatú", "fenyőillatú csend"). Csak
   természetes, élő magyar szavakat használj — amit egy ember ki is mondana.
   ⛔⛔ TILOS ÉPÍTŐANYAG vagy SZERKEZET a főcímben: fenyőgerendás, lambériás, fából
   ácsolt, tetőtér, nádfedeles, tégla, beton, faburkolat, cserép… A szálláskereső NEM
   erre keres. Tulajdonosi szó (2026-08-31), miután kiment a "Kert, grill és bérelhető
   kerékpárok a FENYŐGERENDÁS TETŐTÉR ALATT": "Miért nem írjuk bele, hogy XC30/37
   betonból, harminchatos betonszivattyúval pumpálva?" — a ház anyaga pontosan
   ennyire érdekli a vendéget. A hangulatot a FOTÓK viszik; a főcím a vendég-értéké.
   ⛔ PRÓBA, amin át kell mennie: ha a főcím rámásolható BÁRMELY MÁSIK szállásra
   ugyanabban a régióban, akkor rossz. Olyat írj, ami CSAK erre a helyre igaz.
   ⛔ RANGSOR a főcímen belül: a LEGERŐSEBB igazolt adottság vezet. Vízparti fekvés,
   saját strand, stég, medence, panoráma > kert, terasz > parkoló, wifi. (Megtörtént
   kár: közvetlen vízparti, saját strandos villára "tágas kert és saját parkoló" főcím
   ment ki — a vendég a VÍZPARTRA keresett volna rá, és mi a parkolót adtuk el neki.)
   JÓ: "Kert, grill és kerékpárok várnak" · "Medence és játszótér a kertben" ·
   "Saját parkoló, 5 percre a strandtól" · "Saját strand és stég a vízparton".
   ROSSZ: "Fenyőillatú csend" · "Ahol az idő lassabban jár" · "A pihenés szigete".
   NEM a szállás neve, és NEM közhely ("Üdvözöljük").
3. Az "accent" a cím/lead egy PONTOS részlánca (szó szerint benne van), amit dőlten kiemelünk.
4. Magyar nyelv, rövid, választékos, NEM giccses. Tilos az emoji.
5. A "title" lehet kétsoros: a törés helyére \\n kerüljön.
6. Csak azokra a szekciókra írj címet, amelyekhez tudsz valódi, illő hangot adni; a többit hagyd ki.
7. A "Régió/környezet" KERESÉSI TERÜLET címkéje, NEM a szállás elhelyezkedése — földrajzi
   pozíciót (pl. melyik parton fekszik) SOHA ne állíts belőle; a település nevét a Cím adja.`;

/** Describe the lead's REAL facts to the copywriter (never invent — the model may use only these). */
function describeFacts(data: SiteData, region: string): string {
  const lines = [
    `Szállás neve: ${data.name}`,
    region ? `Régió/környezet: ${region}` : "",
    data.contact.address ? `Cím: ${data.contact.address}` : "",
    data.tagline ? `Meglévő alcím: ${data.tagline}` : "",
    data.intro ? `Bemutatkozó: ${data.intro}` : "",
    data.highlights.length ? `Kiemelések: ${data.highlights.join(", ")}` : "Kiemelések: nincs megadva",
    data.stats && data.stats.length
      ? `Valós számok (CSAK ezeket használhatod számként): ${data.stats.map((s) => `${s.value} ${s.label}`).join(" · ")}`
      : "Valós számok: NINCS — ne írj számot egyetlen címbe sem.",
    `Fotók száma: ${data.photos.length}`,
  ];
  return lines.filter(Boolean).join("\n");
}

/**
 * Write grounded editorial copy for the site. AI proposes brand voice; the caller attaches it
 * to the recipe sections. Vision-grounded on up to 4 real photos for mood/palette. Keyless or
 * on any error → {} (primitives fall back to generic headings). Never throws to the caller.
 */
export async function writeEditorialCopy(
  data: SiteData,
  region: string,
  /** Free-text curator guidance (tone/emphasis). VOICE only — §B.17 still forbids any fact
   *  the sources don't carry, guidance included. */
  curatorGuidance?: string,
  /** ADR-0036: target language name (e.g. "lengyel (polski)"); absent → magyar. */
  languageName?: string,
): Promise<EditorialCopy> {
  if (!config.anthropicApiKey) return {};
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();
    const guidance =
      (curatorGuidance?.trim()
        ? `\n\nKURÁTOR-IRÁNYMUTATÁS (hangvétel/hangsúly — tényt EBBŐL SEM találhatsz ki): ${curatorGuidance.trim()}`
        : "") +
      (languageName
        ? `\n\nCÉL-NYELV (ADR-0036): minden címet/leadet ${languageName} nyelven írj. Minden más szabály változatlan.`
        : "");
    const content: AnthropicSdk.MessageParam["content"] = [
      { type: "text", text: describeFacts(data, region) + guidance },
    ];
    // Vision grounding: let the copywriter feel the real mood/palette (up to 4 photos).
    // Inlined by us — portal hosts block the API's own fetcher (see toImageBlocks).
    const blocks = await toImageBlocks(data.photos.slice(0, 4).map((p) => p.url));
    for (const block of blocks) content.push(block as AnthropicSdk.ContentBlockParam);
    const res = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 700,
      system: EDITORIAL_SYSTEM,
      messages: [{ role: "user", content }],
      output_config: { format: { type: "json_schema", schema: COPY_SCHEMA } },
    });
    recordAiUsage("writeEditorialCopy", "claude-opus-4-8", res.usage);
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return {};
    return JSON.parse(block.text) as EditorialCopy;
  } catch (err) {
    console.warn(`  [copywriter] kihagyva → generikus fejlécek: ${(err as Error).message}`);
    return {};
  }
}
