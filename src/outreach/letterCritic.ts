// LANDLORD-EYED CRITIC for the cold letter + SMS (owner's ruling 2026-10-02, ADR-0306).
//
// The guest critic (src/generator/guestCritic.ts) reads a mock page as a GUEST would. The
// cold letter has a different reader: a Hungarian landlord who never asked to hear from us.
// The owner's yardstick: „hol írnám ki ilyet? nincs normális ember, aki ilyet kiír.”
//
// WHY NOT PER SEND. The letter is a fixed template — per lead only the name, the rating and
// the segment branch change; there is no AI-written sentence in it. So the critic judges
// every BRANCH once, whenever the template's wording changes, and the verdict is recorded
// against the template's fingerprint (letterCritic.verdict.json). The deterministic gate
// (scripts/outreach-letter-truth-check.mts) is red until the current fingerprint has a PASS.
// The day a per-lead AI sentence enters the letter, this must move to send time.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type AnthropicNS from "@anthropic-ai/sdk";
import { recordAiUsage } from "../ai/usage.js";

const MODEL = "claude-opus-4-8";

/** The source files whose customer strings make up the letter family. */
const TEMPLATE_FILES = ["draft.ts", "escalationFollowup.ts"] as const;

/** Every T(lang, "…") literal of the letter family, in source order. */
export function letterTemplateStrings(): string[] {
  const out: string[] = [];
  for (const f of TEMPLATE_FILES) {
    const src = readFileSync(new URL(`./${f}`, import.meta.url), "utf8");
    for (const m of src.matchAll(/\bT\(\s*(?:d\.lang|lang)\s*,\s*"((?:[^"\\]|\\.)*)"/g)) out.push(m[1]!);
  }
  return out;
}

/**
 * Fingerprint of the letter's WORDING — environment-free on purpose: pricing and sender
 * identity come from the DB / .env, and a price change must not demand a new critic run.
 */
export function letterTemplateFingerprint(): string {
  return createHash("sha256").update(letterTemplateStrings().join("\n")).digest("hex").slice(0, 16);
}

export interface LetterBranch {
  /** Human label: which lead situation produces this text. */
  readonly label: string;
  readonly text: string;
}

export interface LetterObjection {
  readonly branch: string;
  readonly quote: string;
  readonly kind: string;
  readonly fix: string;
  readonly severity: "blokkolo" | "javitando";
}

const KINDS = [
  "tukorforditas", "csonka_mondat", "gepies", "szakzsargon", "reklamfordulat",
  "ellentmondas", "tulzas", "nyelvtan", "megszolitas", "tolakodo",
] as const;

const SYSTEM = `Igényes magyar szállásadó vagy (egy balatoni panzió tulajdonosa, 58 éves), és a postafiókodban egy KÉRETLEN megkereső levelet, illetve SMS-t olvasol egy honlap-készítő cégtől. Melletted ül egy igényes magyar szövegszerkesztő.
Mindketten minden mondatra ezt kérdezitek: „kiírná-e EZT egy normális magyar vállalkozó egy másik vállalkozónak?”

Ugyanannak a sablonnak TÖBB ÁGÁT kapod: mindegyik ág fölött áll, milyen helyzetű szállásadó kapja. Az ág-címke a VALÓSÁG (amit a cég mért); a levél nem állíthat annál többet.

A feladatod a TÉTELES KIFOGÁS-LISTA (nem újraírás). Fajták („kind”):
- tukorforditas — idegen szerkezet magyar szavakkal („nincs a képben”). BLOKKOLÓ.
- csonka_mondat — alany vagy állítmány nélküli töredék, ami gépinek hat. BLOKKOLÓ.
- gepies — sablonszagú, körlevél-ízű fordulat. JAVÍTANDÓ; BLOKKOLÓ, ha a levél első két bekezdésében áll.
- szakzsargon — informatikus/marketinges szó, amit egy szállásadó nem használ („élesít”, „konverzió”). BLOKKOLÓ.
- reklamfordulat — reklámszöveg-póz („forinttól az Öné”, „ne maradjon le”). JAVÍTANDÓ.
- ellentmondas — a mondat ütközik az ág-címkében leírt valósággal (pl. „nincs honlapja”, miközben van). BLOKKOLÓ.
- tulzas — többet állít, mint amit a cég mérhetett. BLOKKOLÓ.
- nyelvtan — rossz vonzat, egyeztetés, központozás, rossz kis/nagybetű („A Citoviso Csapata”). BLOKKOLÓ.
- megszolitas — a levél magáz; tegező alak vagy személy-váltás. BLOKKOLÓ.
- tolakodo — kioktató, nyomulós vagy sértő hang (pl. egy gyenge értékelés felhánytorgatása). BLOKKOLÓ.

Szabályok:
- A „quote” SZÓ SZERINT a szövegből (a gép visszakeresi). A „branch” az ág-címke, ahogy kaptad.
- A „fix” konkrét új megfogalmazás vagy „hagyd ki”.
- A kötelező jogi lábléc (leiratkozás, jogalap, cégazonosítás, adatkezelési link), a linkek, az árak SZÁMAI és a megszólítás formája („Tisztelt <név>!” — tulaj-döntés) NEM kifogásolható.
- Ami jó, arról ne írj. Ha nincs kifogás, az üres lista a helyes válasz — ne gyárts kifogást.
- Előbb a „plan” mezőbe írd le röviden (3–6 mondat), mit néztél meg; utána a lista.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    plan: { type: "string" },
    objections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          branch: { type: "string" },
          quote: { type: "string" },
          kind: { type: "string", enum: KINDS },
          fix: { type: "string" },
          severity: { type: "string", enum: ["blokkolo", "javitando"] },
        },
        required: ["branch", "quote", "kind", "fix", "severity"],
      },
    },
  },
  required: ["plan", "objections"],
} as const;

/** One critic pass over all branches. A quote not found in its branch is dropped (not evidence). */
export async function critiqueLetter(branches: readonly LetterBranch[]): Promise<{ plan: string; objections: LetterObjection[] }> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const c: AnthropicNS = new Anthropic();
  const res = await c.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: branches.map((b) => `═══ ÁG: ${b.label} ═══\n${b.text}`).join("\n\n"),
      },
    ],
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
  });
  recordAiUsage("letterCritic", MODEL, res.usage);
  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("letterCritic: empty response");
  const parsed = JSON.parse(block.text) as { plan: string; objections: LetterObjection[] };
  const squeeze = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const objections = parsed.objections.filter((o) => {
    const b = branches.find((x) => x.label === o.branch);
    const hay = squeeze(b ? b.text : branches.map((x) => x.text).join("\n"));
    return hay.includes(squeeze(o.quote));
  });
  return { plan: parsed.plan, objections };
}
