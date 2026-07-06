import type AnthropicNS from "@anthropic-ai/sdk";
import { config } from "../config.js";

// AI copy generation — the differentiating "mag". Produces unique, on-brand
// Hungarian marketing copy grounded in the property name + region AND (when
// available) the actual photos: the model looks at the images and weaves the
// genuinely visible features (terrace, wellness, wine cellar, view…) into the
// copy. This makes the copy both more unique and MORE honest — it describes what
// is really there, instead of inventing specifics. Vision can misread, so the
// prompt requires conservatism (only clearly visible features).
// Model: claude-opus-4-8 (best quality; the tier is a later cost lever).

export interface GeneratedCopy {
  tagline: string;
  intro: string;
  highlights: string[];
}

const COPY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    tagline: {
      type: "string",
      description: "Hívogató hero-alcím, egyetlen evokatív magyar mondat.",
    },
    intro: {
      type: "string",
      description:
        "2-3 mondatos magyar bemutatkozó bekezdés. Ha kaptál képeket, a rajtuk VALÓBAN LÁTHATÓ jellemzőket fűzd bele természetesen.",
    },
    highlights: {
      type: "array",
      items: { type: "string" },
      description:
        "3-4 rövid, a KÉPEKEN egyértelműen látható jellemző (pl. terasz, wellness, medence, borospince, panoráma, kert). Csak amit tényleg látsz; kép nélkül a régióra jellemző, biztos elemek.",
    },
  },
  required: ["tagline", "intro", "highlights"],
} as const;

const SYSTEM = `Magyar szálláshely-weboldalak szövegírója vagy. Írj meleg, konkrét, NEM generikus magyar marketingszöveget.
- Támaszkodj a szállás nevére, a régióra, és — ha kapsz képeket — a fotókon LÁTHATÓ valós részletekre.
- A képeket ÓVATOSAN értelmezd: csak azt írd le, amit EGYÉRTELMŰEN látsz (ha bizonytalan vagy egy részletben, hagyd ki). Ne keverd össze a dolgokat (pl. tó ≠ medence).
- SOHA ne találj ki konkrét tényt (szobaszám, ár, díj, vélemény, vagy a képen nem látható felszereltség).
- Nincs emoji. Nincs klisé és nincs "AI-szagú" panelszöveg. Természetes, hívogató hangvétel.`;

export async function generateCopy(input: {
  name: string;
  region: string;
  regionContext: string;
  imageUrls?: string[];
}): Promise<GeneratedCopy | null> {
  if (!config.anthropicApiKey) {
    console.warn("[copy] ANTHROPIC_API_KEY not set — using template copy.");
    return null;
  }
  // Dynamic import: lazy-load the SDK only when a key is present.
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

  const images = (input.imageUrls ?? []).slice(0, 4);
  const content: AnthropicNS.ContentBlockParam[] = [];
  for (const url of images) {
    content.push({ type: "image", source: { type: "url", url } });
  }
  content.push({
    type: "text",
    text:
      `Szállás neve: ${input.name}\n` +
      `Régió: ${input.region}\n` +
      `Régió-kontextus: ${input.regionContext}\n\n` +
      (images.length
        ? "A fenti képek erről a szállásról készültek. Nézd meg őket, és a VALÓBAN LÁTHATÓ jellemzőket (pl. terasz, wellness, medence, borospince, kilátás, kert, belső stílus) fűzd bele természetesen a szövegbe.\n\n"
        : "") +
      "Írj: (1) egy hívogató hero-alcímet (tagline), (2) egy 2-3 mondatos bemutatkozó bekezdést (intro), (3) 3-4 rövid highlightot.",
  });

  const res = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    system: SYSTEM,
    messages: [{ role: "user", content }],
    output_config: { format: { type: "json_schema", schema: COPY_SCHEMA } },
  });
  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") return null;
  try {
    return JSON.parse(block.text) as GeneratedCopy;
  } catch {
    return null;
  }
}
