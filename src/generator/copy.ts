import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";

// AI copy generation — the differentiating "mag". Produces unique, on-brand
// Hungarian marketing copy grounded in the property name + region, WITHOUT
// fabricating unverifiable specifics (room counts, amenities, awards). This is
// the honesty line: atmospheric and regional, never invented facts.
// Model: claude-opus-4-8 (best quality; the model tier is a later cost lever —
// e.g. Haiku for high volume). Structured output keeps the fields clean.

export interface GeneratedCopy {
  tagline: string;
  intro: string;
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
      description: "2-3 mondatos magyar bemutatkozó bekezdés.",
    },
  },
  required: ["tagline", "intro"],
} as const;

const SYSTEM = `Magyar szálláshely-weboldalak szövegírója vagy. Írj meleg, konkrét, NEM generikus magyar marketingszöveget.
- Támaszkodj a szállás nevére és a régióra; idézd meg a hely hangulatát.
- SOHA ne találj ki konkrét tényeket (szobaszám, felszereltség, ár, díjak, vélemények), amiket nem adtak meg — maradj a hangulatnál és a régiónál.
- Nincs emoji. Nincs klisé és nincs "AI-szagú" panelszöveg. Természetes, hívogató hangvétel.`;

export async function generateCopy(input: {
  name: string;
  region: string;
  regionContext: string;
}): Promise<GeneratedCopy | null> {
  if (!config.anthropicApiKey) {
    console.warn("[copy] ANTHROPIC_API_KEY not set — using template copy.");
    return null;
  }
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
  const res = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content:
          `Szállás neve: ${input.name}\n` +
          `Régió: ${input.region}\n` +
          `Régió-kontextus: ${input.regionContext}\n\n` +
          `Írj egy hívogató hero-alcímet (tagline) és egy 2-3 mondatos bemutatkozó bekezdést (intro) ehhez a szálláshoz.`,
      },
    ],
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
