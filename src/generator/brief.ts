// AI "arculat-brief" (ADR-0005, layer 2). One vision call over the property's
// photos returns BOTH the copy AND a design brief: a palette sampled/harmonized
// from the images, a mood, and a suggested layout archetype. This is where AI
// makes the taste decision from the actual photos; the renderer (theme.ts) then
// applies it within safe rails. Falls back to null (→ seeded theme) without a key.

import type AnthropicNS from "@anthropic-ai/sdk";
import { config } from "../config.js";
import type { ThemeBrief } from "./theme.js";

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
- Nincs emoji, nincs klisé.`;

export async function generateBrief(input: {
  name: string;
  region: string;
  regionContext: string;
  imageUrls?: string[];
}): Promise<GeneratedBrief | null> {
  if (!config.anthropicApiKey) return null;
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();

  const images = (input.imageUrls ?? []).slice(0, 4);
  const content: AnthropicNS.ContentBlockParam[] = [];
  for (const url of images) content.push({ type: "image", source: { type: "url", url } });
  content.push({
    type: "text",
    text:
      `Szállás: ${input.name}\nRégió: ${input.region}\nKontextus: ${input.regionContext}\n\n` +
      (images.length
        ? "A képek erről a szállásról készültek. Belőlük vezesd le a palettát, a hangulatot és az illő elrendezést, és írd meg a szöveget a láthatókra építve."
        : "Nincs kép — a régióra jellemző, biztonságos palettát és szöveget adj."),
  });

  const res = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    system: SYSTEM,
    messages: [{ role: "user", content }],
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
  });
  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") return null;
  try {
    return JSON.parse(block.text) as GeneratedBrief;
  } catch {
    return null;
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
