// ADR-0045 ③ (§J.25): document-level knowledge-base translation on the ADR-0036 spine.
// The unit is a WHOLE markdown entry (title + body), not a UI string — language_pack
// stays what it is. source_hash pins the Hungarian source version a translation was
// made from; a mismatch marks it stale and the ensure layer regenerates it.
//
// Integrity mirrors the placeholder guard of packs.ts: the **„…”** labels (the admin
// screen shows these in Hungarian today, so the guide must quote them VERBATIM), the
// image paths and the heading skeleton must survive translation unchanged — a
// violating translation is dropped so the next ensure re-flags it.

import { recordAiUsage } from "../ai/usage.js";
import { createHash } from "node:crypto";

import { sql } from "kysely";

import { config } from "../config.js";
import { db } from "../db/client.js";
import { loadKbEntries, makeSnippet, type KbEntry } from "../kb/kb.js";
import { DEFAULT_LANG, langName } from "./lang.js";

/** Version fingerprint of the Hungarian source an entry translation derives from. */
export function kbSourceHash(entry: Pick<KbEntry, "title" | "body">): string {
  return createHash("sha256").update(`${entry.title}\n${entry.body}`).digest("hex");
}

/**
 * A forrásban SZEREPLŐ képernyő-feliratok (`**„Mentés”**`), szóköz-normalizálva.
 *
 * ⛔ MÉRT HIBA (2026-09-15): a normalizálás nélkül ez az ellenőrzés HELYES fordításokat
 * dobott el. A magyar forrás sortöréssel tördel, ezért egy felirat átér a sor végén:
 * `**„Lemondom a\n  foglalást”**`. A fordítás ugyanazt a feliratot EGY sorba írja —
 * a képernyőn látható szöveg betűre azonos —, a nyers sztring-összehasonlítás mégis
 * eltérést látott, és a teljes fordítás elveszett („integritás-sértés"). Mérve: a
 * `sk/admin-bookings` jelölt 25/25 feliratot, 1/1 képet és 7/7 alcímet hozott, és
 * KIZÁRÓLAG két sortörés miatt bukott meg.
 *
 * A felirat az, amit a tulaj a GOMBON olvas — abban soha nincs sortörés. A tördelés
 * tipográfia, nem tartalom: az ellenőrzés a feliratot mérje, ne a sortörést. A
 * szigorúság megmarad — egy lefordított vagy megváltoztatott felirat továbbra is bukik.
 */
const labelsOf = (md: string): string[] =>
  [...md.matchAll(/\*\*„([^”]+)”\*\*/g)]
    .map((m) => m[1]!.replace(/\s+/g, " ").trim())
    .sort();
const imagesOf = (md: string): string[] =>
  [...md.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1]!).sort();
const headingCount = (md: string): number =>
  md.split("\n").filter((l) => l.trimStart().startsWith("## ")).length;

/** Structural integrity of a candidate translation against its Hungarian source —
 *  a broken document is worse than a re-run (same doctrine as the {placeholder} guard). */
export function kbTranslationValid(sourceBody: string, candidateBody: string): boolean {
  return (
    candidateBody.trim().length > 0 &&
    JSON.stringify(labelsOf(sourceBody)) === JSON.stringify(labelsOf(candidateBody)) &&
    JSON.stringify(imagesOf(sourceBody)) === JSON.stringify(imagesOf(candidateBody)) &&
    headingCount(sourceBody) === headingCount(candidateBody)
  );
}

/**
 * A fordítandó cikkek legnagyobbikához MÉRT kimeneti korlát.
 *
 * ⛔ MÉRT HIBA (2026-09-15): 6000 volt, és a két legnagyobb fordítandó cikk pont fölé
 * nőtt — `admin-modules` (10 871 kar ≈ 5 930 kimenő token) és `admin-messages`
 * (10 302 ≈ 5 619), a JSON-escape ráadásával átlépve. A válasz `stop_reason:
 * "max_tokens"`-szel elvágódott, a JSON nem záródott be, és a hívó ezt
 * „integritás-sértés"-ként naplózta — vagyis más kérdésre válaszolt, mint ami történt,
 * így a valódi ok láthatatlan maradt. A `max_tokens` felső HATÁR, nem költség: a rövid
 * cikkek ugyanannyiba kerülnek. ⚠️ Új, hosszabb súgó-cikknél a
 * `kb-translation-integrity-check` ③ szakasza szól, mielőtt ez némán újra elvágna egyet.
 */
const MAX_TOKENS = 16_000;

/** AI-translate one entry. Returns null when the response is unusable — the caller
 *  counts it as missing and the next ensure retries; a `fail()` sor mindig MEGNEVEZI az
 *  okot (elvágás / JSON / hiányzó mező / integritás), mert egy közös `null` elrejtette. */
async function translateEntry(
  lang: string,
  entry: KbEntry,
): Promise<{ title: string; body: string } | null> {
  if (!config.anthropicApiKey) throw new Error("i18n: nincs ANTHROPIC_API_KEY a KB-fordításhoz");
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const res = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: MAX_TOKENS, // lásd a függvény fölötti mérést
    system:
      `Professzionális honosító vagy: a Citoviso szállásadói kezelőfelület SÚGÓ-cikkeit fordítod ` +
      `${langName(lang)} nyelvre, IT-kezdő szállásadóknak. Szabályok: (1) természetes, közérthető, ` +
      `udvarias (önöző) nyelv a szállás/vendéglátás regiszterében; (2) a markdown-szerkezet PONTOSAN ` +
      `marad — ugyanannyi "## " alcím, ugyanolyan lista- és **félkövér**-szerkezet; (3) a ` +
      `**„félkövér-idézőjeles”** szövegek a KÉPERNYŐN LÁTHATÓ gombfeliratok — ezek MAGYARUL maradnak, ` +
      `SZÓ SZERINT (a felület ma magyar feliratú), a körülöttük lévő mondat a célnyelven magyarázza ` +
      `őket; (4) kép-sor (![alt](útvonal)): az útvonal VÁLTOZATLAN, az alt-szöveg fordítható; ` +
      `(5) tulajdonneveket (Citoviso, Google, Booking.com) ne fordíts; (6) semmi magyarázat — CSAK ` +
      `a kért JSON.`,
    messages: [
      {
        role: "user",
        content:
          `Add vissza JSON objektumként: {"title": "<fordítás>", "body": "<fordítás>"} erre:\n` +
          JSON.stringify({ title: entry.title, body: entry.body }),
      },
    ],
  });
  recordAiUsage("translateKbEntry", "claude-opus-4-8", res.usage);
  // ⛔ A BUKÁS OKA NEVEZŐDJÖN MEG. Eddig minden út ugyanabba a `null`-ba futott, és a
  // hívó mindet „integritás-sértés"-nek naplózta — az elvágott választ is. Így a
  // valódi ok (túl kicsi korlát) hónapokig láthatatlan maradt, miközben minden
  // újrafuttatás ugyanoda futott.
  const fail = (reason: string): null => {
    console.error(`[i18n] KB-fordítás eldobva (${lang}/${entry.id}): ${reason}`);
    return null;
  };
  if (res.stop_reason === "max_tokens") {
    return fail(
      `a válasz ELVÁGÓDOTT a token-korlátnál (${res.usage.output_tokens} kimenő token) — ` +
        `a cikk hosszabb, mint amennyi belefér; emeld a max_tokens-t`,
    );
  }
  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") return fail("a válasz nem tartalmaz szöveget");
  const jsonText = block.text.slice(block.text.indexOf("{"), block.text.lastIndexOf("}") + 1);
  let parsed: { title?: unknown; body?: unknown };
  try {
    parsed = JSON.parse(jsonText) as { title?: unknown; body?: unknown };
  } catch (err) {
    return fail(`a válasz nem értelmezhető JSON (${(err as Error).message.slice(0, 80)})`);
  }
  if (typeof parsed.title !== "string" || typeof parsed.body !== "string")
    return fail("a JSON-ból hiányzik a title vagy a body");
  if (!parsed.title.trim()) return fail("üres cím");
  if (!kbTranslationValid(entry.body, parsed.body))
    return fail("integritás-sértés (felirat / kép-útvonal / alcím-szám eltérés)");
  return { title: parsed.title.trim(), body: parsed.body };
}

export interface KbPackStatus {
  readonly lang: string;
  readonly total: number;
  readonly missing: number;
  readonly ok: boolean;
}

/** ADR-0045/e: only tenant-facing entries translate. The operator console renders
 *  Hungarian today and tenants never reach the operator guides — translating them
 *  would be AI cost without a reader, and §J.25 wants the guide to quote what the
 *  screen actually shows. If the console ever gets language packs, widen here. */
const translatableKbEntries = (): KbEntry[] =>
  loadKbEntries().filter((e) => e.audience === "tenant");

/**
 * Ensure every KB entry has a FRESH translation for `lang` (§J.25): missing rows and
 * rows whose source_hash no longer matches the Hungarian source are (re)generated.
 * Called from ensureLanguagePack, so every existing trigger — scrape into a region,
 * mock generation, boot self-heal, CLI — covers the KB with no new call sites.
 */
export async function ensureKbTranslations(lang: string): Promise<KbPackStatus> {
  const entries = translatableKbEntries();
  if (lang === DEFAULT_LANG || !entries.length) {
    return { lang, total: entries.length, missing: 0, ok: true };
  }
  const rows = await db
    .selectFrom("kb_translation")
    .select(["entry_id", "source_hash"])
    .where("lang", "=", lang)
    .execute();
  const have = new Map(rows.map((r) => [r.entry_id, r.source_hash]));
  const stale = entries.filter((e) => have.get(e.id) !== kbSourceHash(e));
  let missing = 0;
  if (stale.length)
    console.log(`[i18n] KB-fordítás provisioning: ${lang} — ${stale.length} entry`);
  for (const entry of stale) {
    try {
      const tr = await translateEntry(lang, entry);
      if (!tr) {
        // Az OKOT a translateEntry naplózta, pontosan — itt csak a darabszám nő.
        missing++;
        continue;
      }
      await db
        .insertInto("kb_translation")
        .values({
          entry_id: entry.id,
          lang,
          source_hash: kbSourceHash(entry),
          title: tr.title,
          body_md: tr.body,
        })
        .onConflict((oc) =>
          oc.columns(["entry_id", "lang"]).doUpdateSet({
            source_hash: kbSourceHash(entry),
            title: tr.title,
            body_md: tr.body,
            updated_at: sql`now()`,
          }),
        )
        .execute();
    } catch (err) {
      missing++;
      console.error(`[i18n] KB-fordítás HIBA (${lang}/${entry.id}): ${(err as Error).message}`);
    }
  }
  return { lang, total: entries.length, missing, ok: missing === 0 };
}

/** Coverage WITHOUT generating (tracking view): fresh-translation count vs entries. */
export async function kbCoverage(lang: string): Promise<KbPackStatus> {
  const entries = translatableKbEntries();
  if (lang === DEFAULT_LANG) return { lang, total: entries.length, missing: 0, ok: true };
  const rows = await db
    .selectFrom("kb_translation")
    .select(["entry_id", "source_hash"])
    .where("lang", "=", lang)
    .execute();
  const have = new Map(rows.map((r) => [r.entry_id, r.source_hash]));
  const missing = entries.filter((e) => have.get(e.id) !== kbSourceHash(e)).length;
  return { lang, total: entries.length, missing, ok: missing === 0 };
}

/**
 * The entry list with the language overlay applied. A stale translation still serves
 * (a readable guide beats a Hungarian fallback for a Polish owner) — the ensure layer
 * refreshes it on the next trigger. Hungarian returns the source untouched.
 */
export async function localizedKbEntries(lang: string | undefined): Promise<KbEntry[]> {
  const entries = loadKbEntries();
  const l = lang || DEFAULT_LANG;
  if (l === DEFAULT_LANG) return entries;
  const rows = await db
    .selectFrom("kb_translation")
    .select(["entry_id", "title", "body_md"])
    .where("lang", "=", l)
    .execute();
  const byId = new Map(rows.map((r) => [r.entry_id, r]));
  return entries.map((e) => {
    const t = byId.get(e.id);
    return t
      ? { ...e, title: t.title, body: t.body_md, snippet: makeSnippet(t.body_md) }
      : e;
  });
}
