/**
 * Bábel — the translating colleague's engine (ADR-XXXX).
 *
 * WHY: until 2026-10-27 every translation was a blind call — 40 Hungarian strings, a
 * one-paragraph system prompt, no idea where a string is shown or what the Citoviso words
 * mean. Measured on the packs: the guest-site menu item „Elérhetőség” (contact details)
 * shipped as English "Availability"; the same concept drifted across 110 independent
 * batches. Bábel translates WITH the knowledge a human translator would have:
 *  - the ONTOLOGY (`babel/ontology.md`): what Citoviso is, who reads which surface, the
 *    house words and the hard rules;
 *  - the GLOSSARY (`babel/glossary.json`): concept → the binding translation per language,
 *    with senses where one Hungarian word means two things on two surfaces;
 *  - the SURFACE of every string (`catalog-context.json`, written by extract-i18n): konzol /
 *    admin / honlap / level / megkereses / sms — audience and register.
 * Ontology + glossary + task rules form ONE system block marked for prompt caching, so the
 * ~100 batches of a pack pay for that context once, not 100 times.
 *
 * Bábel the PERSONA (babel/charter/) curates the ontology and the glossary and reviews the
 * packs; this module is the hand that applies them when a pack must be made unattended.
 * Every call goes through `babelCall`: budget check BEFORE (budget.ts), spend ledger AFTER.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { recordAiUsage, callCostUsd, type AnthropicUsageLike } from "../ai/usage.js";
import { config } from "../config.js";
import { assertTranslationBudget, chargeRun, type TranslationRun } from "./budget.js";
import { langName } from "./lang.js";
import { recordTranslationSpend } from "./spend.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const BABEL_MODEL = "claude-opus-4-8";

/** What Bábel is asked to translate — each task has its own output contract. */
export type BabelTask = "ui" | "kb" | "site";

interface GlossarySense {
  readonly ahol: string;
  readonly tr: Record<string, string>;
}
interface GlossaryTerm {
  readonly hu: string;
  readonly note?: string;
  readonly tr?: Record<string, string>;
  readonly senses?: readonly GlossarySense[];
}

let ontologyCache: string | null = null;
let glossaryCache: GlossaryTerm[] | null = null;
let contextCache: Record<string, string> | null = null;

function ontology(): string {
  return (ontologyCache ??= readFileSync(path.join(HERE, "babel", "ontology.md"), "utf8"));
}

export function glossaryTerms(): GlossaryTerm[] {
  return (glossaryCache ??= (
    JSON.parse(readFileSync(path.join(HERE, "babel", "glossary.json"), "utf8")) as { terms: GlossaryTerm[] }
  ).terms);
}

/** The glossary column for one language, as the prompt reads it. Terms without a form in
 *  `lang` are listed with their note only — Bábel then picks one and keeps it for the pack. */
export function glossaryFor(lang: string): string {
  const lines: string[] = [];
  for (const t of glossaryTerms()) {
    const note = t.note ? ` — ${t.note}` : "";
    if (t.senses?.length) {
      for (const s of t.senses) lines.push(`- „${t.hu}” [${s.ahol}] → ${s.tr[lang] ?? "(még nincs — válassz, és tartsd)"}`);
    } else {
      lines.push(`- „${t.hu}” → ${t.tr?.[lang] ?? "(még nincs — válassz, és tartsd)"}${note}`);
    }
  }
  return lines.join("\n");
}

/** The surface(s) a catalog string is shown on ("admin+honlap"); "egyeb" when unknown. */
export function surfaceOf(hu: string): string {
  if (!contextCache) {
    try {
      contextCache = JSON.parse(readFileSync(path.join(HERE, "catalog-context.json"), "utf8")) as Record<string, string>;
    } catch {
      console.error("[babel] HIÁNYZÓ catalog-context.json — futtasd: npx tsx scripts/extract-i18n.mts");
      contextCache = {};
    }
  }
  return contextCache[hu] || "egyeb";
}

const TASK_RULES: Record<BabelTask, string> = {
  ui:
    `## A mostani feladat: felület-feliratok (nyelvi csomag)\n` +
    `A bemenet egy JSON tömb: [{"i": <sorszám>, "hu": "<magyar forrás>", "felulet": "<felület>"}, …]. ` +
    `A kimenet EGYETLEN JSON objektum: {"<i>": "<fordítás>", …} — minden i-re pontosan egy fordítás, ` +
    `a magyar forrást NE ismételd vissza. A „felulet” mondja meg, ki olvassa és milyen hangon (lásd a táblát).`,
  kb:
    `## A mostani feladat: súgó-cikk (a szállásadó admin felületének súgója)\n` +
    `Olvasó: IT-kezdő szállásadó, udvarias (önöző/magázó) hangon. A markdown-szerkezet PONTOSAN marad ` +
    `(ugyanannyi "## " alcím, ugyanolyan lista és **félkövér**). A **„félkövér-idézőjeles”** szövegek a ` +
    `KÉPERNYŐN LÁTHATÓ gombfeliratok — ezek MAGYARUL maradnak, SZÓ SZERINT; a körülöttük lévő mondat a ` +
    `célnyelven magyarázza őket. Kép-sor (![alt](útvonal)): az útvonal változatlan, az alt fordítható. ` +
    `Kimenet: {"title": "<fordítás>", "body": "<fordítás>"}.`,
  site:
    `## A mostani feladat: egy szállás honlapjának vendég-oldali szövegei\n` +
    `Felület: honlap (a vendég olvassa). Átülteted, nem alkotsz: tényt, számot, árat, mértéket, dátumot, ` +
    `tulajdonnevet nem adhatsz hozzá, nem hagyhatsz el és nem változtathatsz meg. Hangnem: természetes, ` +
    `vendégcsalogató, de tartalmilag PONTOSAN a forrás. Kimenet: {"<magyar forrás>": "<fordítás>", …}.`,
};

/**
 * Bábel's system prompt for `lang` and `task`: persona + ontology + the glossary column +
 * the task contract, as ONE cache-marked block (identical across a pack's batches).
 */
export function babelSystem(lang: string, task: BabelTask): string {
  return (
    `Bábel vagy, a Citoviso fordító munkatársa. A Citoviso szövegeit magyarról ${langName(lang)} ` +
    `nyelvre fordítod — nem elszigetelt mondatokat, hanem a Citoviso világában értve őket: tudod, ` +
    `mi a szolgáltatás, ki olvassa a szöveget, melyik felületen, és a glosszárium a kötelező szóhasználat.\n\n` +
    ontology() +
    `\n\n## Glosszárium — kötelező formák (${lang})\n` +
    `Ha a forrás egy itt szereplő fogalmat tartalmaz, a fordítás ezt a formát használja (ragozva, a ` +
    `mondatba illesztve). Több jelentésnél a [felület] dönt.\n` +
    glossaryFor(lang) +
    `\n\n` +
    TASK_RULES[task]
  );
}

/** One raw model answer — the transport is swappable for the guard script (no API, no cost). */
export interface BabelAnswer {
  readonly text: string | null;
  readonly stopReason: string | null;
  readonly usage: AnthropicUsageLike | null;
}
export type BabelTransport = (req: {
  lang: string;
  step: string;
  system: string;
  user: string;
  maxTokens: number;
}) => Promise<BabelAnswer>;

const anthropicTransport: BabelTransport = async ({ step, system, user, maxTokens }) => {
  if (!config.anthropicApiKey) throw new Error("i18n: nincs ANTHROPIC_API_KEY a fordításhoz");
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const res = await client.messages.create({
    model: BABEL_MODEL,
    max_tokens: maxTokens,
    // One block, cache-marked: a pack's ~100 batches share it (Opus 4.8 cache read = 0.1× input).
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  });
  recordAiUsage(step, BABEL_MODEL, res.usage);
  const block = res.content.find((b) => b.type === "text");
  return {
    text: block && block.type === "text" ? block.text : null,
    stopReason: res.stop_reason ?? null,
    usage: res.usage,
  };
};

let transport: BabelTransport = anthropicTransport;

/** Test seam: replace the API with a scripted transport (null restores the real one). */
export function setBabelTransportForTest(t: BabelTransport | null): void {
  transport = t ?? anthropicTransport;
}

/**
 * The ONE way a translation reaches the model: budget check first (throws
 * TranslationBudgetError at the ceiling — nothing is sent), then the call (the transport
 * records the mock-run usage), then the translation_spend ledger + the run's running total.
 */
export async function babelCall(
  run: TranslationRun,
  step: string,
  system: string,
  user: string,
  maxTokens: number,
): Promise<BabelAnswer> {
  await assertTranslationBudget(run);
  const ans = await transport({ lang: run.lang, step, system, user, maxTokens });
  await recordTranslationSpend(step, run.lang, BABEL_MODEL, ans.usage);
  chargeRun(run, callCostUsd(BABEL_MODEL, ans.usage));
  return ans;
}
