// Grounded EDITORIAL copywriter / art-director (ADR-0018 A' path). The engine's second AI
// step (after the composition planner): it writes BRAND VOICE — a poetic hero lead + per-
// section headings — that lift the render to the reference "wow" bar. It writes VOICE ONLY,
// never HTML and never a hard fact: the copy is grounded on the lead's real facts + photos,
// and the §B.17 contract forbids inventing any number/award/amenity. Keyless → returns {}
// (the primitives fall back to their generic headings; mock=live is preserved either way).

import type AnthropicSdk from "@anthropic-ai/sdk";

import { config } from "../config.js";
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
    lead: { type: "string", description: "A hero KÖLTŐI vezércíme — rövid hangulati mondat, NEM a szállás neve. Ez a fő 'hang'." },
    accent: { type: "string", description: "A lead EGY pontos részlánca, amit kiemelünk (dőlt akcent)." },
  },
  required: ["lead"],
} as const;

const COPY_SCHEMA = {
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

const SYSTEM = `Szálláshely-weboldal COPYWRITER és art-director vagy. A feladatod KIZÁRÓLAG a MÁRKAHANG:
a hero KÖLTŐI vezércíme + néhány szekció rövid, hangulatos címe. NEM írsz HTML-t, NEM írsz törzsszöveget.

SZIGORÚ SZABÁLYOK (kötelező):
1. TÉNYHŰSÉG (§B.17): SOHA ne találj ki számot, díjat, csillagot, díjazást, méretet vagy konkrét jellemzőt.
   Számot CSAK akkor írhatsz, ha a megadott tények között PONTOSAN szerepel. Ha nincs ilyen adat, ne írj számot.
2. A hero "lead" egy rövid, hangulati mondat (max ~6 szó), NEM a szállás neve, NEM közhely ("Üdvözöljük").
   A hely valós karakteréből (régió, környezet, a fotók hangulata) merítsen.
3. Az "accent" a cím/lead egy PONTOS részlánca (szó szerint benne van), amit dőlten kiemelünk.
4. Magyar nyelv, rövid, választékos, NEM giccses. Tilos az emoji.
5. A "title" lehet kétsoros: a törés helyére \\n kerüljön.
6. Csak azokra a szekciókra írj címet, amelyekhez tudsz valódi, illő hangot adni; a többit hagyd ki.`;

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
): Promise<EditorialCopy> {
  if (!config.anthropicApiKey) return {};
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();
    const guidance = curatorGuidance?.trim()
      ? `\n\nKURÁTOR-IRÁNYMUTATÁS (hangvétel/hangsúly — tényt EBBŐL SEM találhatsz ki): ${curatorGuidance.trim()}`
      : "";
    const content: AnthropicSdk.MessageParam["content"] = [
      { type: "text", text: describeFacts(data, region) + guidance },
    ];
    // Vision grounding: let the copywriter feel the real mood/palette (up to 4 photos).
    for (const p of data.photos.slice(0, 4)) {
      content.push({ type: "image", source: { type: "url", url: p.url } });
    }
    const res = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 700,
      system: SYSTEM,
      messages: [{ role: "user", content }],
      output_config: { format: { type: "json_schema", schema: COPY_SCHEMA } },
    });
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return {};
    return JSON.parse(block.text) as EditorialCopy;
  } catch (err) {
    console.warn(`  [copywriter] kihagyva → generikus fejlécek: ${(err as Error).message}`);
    return {};
  }
}
