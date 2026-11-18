// ORSZÁG-RÉTEG 3/7 (ADR-0458) — TEST FIXTURE for country legal packs. ⛔ NOT a translation:
// every text run of the Hungarian source becomes a marker (‹it›), tags and {{placeholders}}
// survive — so a test can open a market (the gate needs a COMPLETE pack) and assert that the
// page is "in the country's language" (no Hungarian source text left) without a model call.
// The fixture lives in a temp directory (CIT_LEGAL_PACK_DIR), never in src/i18n/babel/legal.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * The marker translation of one Hungarian unit: `‹lang›` + the text with every vowel broken
 * (the same trick as the UI-pack fixtures) — so no Hungarian word survives, while statute
 * references the real translation also keeps ("Grt. 6. §", "GDPR") and digits stay readable.
 * Tags, {{x}} and {X_Y} are kept verbatim.
 */
export function fixtureTranslation(lang: string, hu: string): string {
  const body = hu.replace(/(<[^>]*>|\{\{[a-zA-Z0-9_]+\}\}|\{[A-Z_]+\})|([^<{]+)/g, (_m, keep: string | undefined, text: string | undefined) =>
    keep ?? (text ?? "").replace(/[aáeéiíoóöőuúüűAÁEÉIÍOÓÖŐUÚÜŰ]/g, "·"),
  );
  return `‹${lang}› ${body}`;
}

let dir: string | null = null;

/**
 * Write COMPLETE fixture packs for `countries` (ISO-2 → pack language) and point the process
 * at them. Call after the scratch DB env is set (the source enumeration renders the pages).
 * Returns the directory; it is removed at exit. `omit` leaves a country's file out on purpose.
 */
export async function installLegalPackFixture(countries: Readonly<Record<string, string>>): Promise<string> {
  dir ??= mkdtempSync(join(tmpdir(), "cit-legal-pack-"));
  process.env.CIT_LEGAL_PACK_DIR = dir;
  const legal = await import("../../src/legal.ts");
  // A test country without a LEGAL_LOCAL entry (CZ, RO, XA…) is declared "defined, no local
  // items" for THIS process only — the real schema is the six first-round countries'.
  const undefinedHere = Object.keys(countries).filter((c) => !Object.prototype.hasOwnProperty.call(legal.LEGAL_LOCAL, c));
  if (undefinedHere.length) {
    const prev = (process.env.CIT_LEGAL_LOCAL_FIXTURE ?? "").split(",").filter(Boolean);
    process.env.CIT_LEGAL_LOCAL_FIXTURE = [...new Set([...prev, ...undefinedHere])].join(",");
  }
  const lp = await import("../../src/legalPack.ts");
  for (const [cc, lang] of Object.entries(countries)) {
    const sources = await lp.legalSources(cc);
    const entries = Object.fromEntries([...sources.keys()].map((hu) => [hu, fixtureTranslation(lang, hu)]));
    writeFileSync(join(dir, `${cc}.json`), JSON.stringify({ country: cc, lang, base: lp.LEGAL_PACK_BASE, entries }, null, 1));
  }
  lp.resetLegalPackCache();
  const d = dir;
  process.once("exit", () => rmSync(d, { recursive: true, force: true }));
  return dir;
}

/** Remove one country's fixture pack again (the "pack missing" direction of a test). */
export async function removeLegalPackFixture(cc: string): Promise<void> {
  if (!dir) return;
  rmSync(join(dir, `${cc}.json`), { force: true });
  (await import("../../src/legalPack.ts")).resetLegalPackCache();
}
