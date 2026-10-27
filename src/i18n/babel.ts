/**
 * Bábel — the translating colleague's knowledge (ADR-0411, ADR-XXXX).
 *
 * WHY: until 2026-10-27 every translation was a blind API call — 40 Hungarian strings, a
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
 *
 * ⛔ NO TRANSLATION BY API CALL (owner, 2026-10-27, ADR-XXXX): translations are spent ONLY
 * from Bábel's subscription session, never from the API credit. The code has no model
 * transport for translation any more: it reads what Bábel committed (packs.ts / kbPacks.ts /
 * multilangGenerate.ts seeds) and leaves the rest to the Hungarian fallback until Bábel
 * fills it. Guard: scripts/no-api-translation-check.mts. This module only exposes the
 * knowledge Bábel's tools (scripts/babel-pack.mts) put next to every string.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

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

let glossaryCache: GlossaryTerm[] | null = null;
let contextCache: Record<string, string> | null = null;

export function glossaryTerms(): GlossaryTerm[] {
  return (glossaryCache ??= (
    JSON.parse(readFileSync(path.join(HERE, "babel", "glossary.json"), "utf8")) as { terms: GlossaryTerm[] }
  ).terms);
}

/** The glossary column for one language, as Bábel's work sheet shows it (babel-pack
 *  `glossary`). Terms without a form in `lang` say so — Bábel picks one and keeps it. */
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
