// Reply-conversation translation into the operator's console language (plan:
// assets/design-refs/console/orszag-szuro-forditas/, owner 2026-11-26 „2.B · 3 igen”).
//
// The CODE TRANSLATES NOTHING (ADR-0412): Bábel, the translator colleague, gets a ticket per
// conversation part that has no translation yet (scripts/replies-collect.mts writes it into
// ~/babel/beerkezo/), and lays the translation down on the console with the `babel` account
// (POST /replies/<id>/translate). This module only knows WHAT needs translating, stores what
// Bábel sends, and hands the dashboard the stored text — valid only while its source is
// unchanged (source_hash), so a rewritten Poe suggestion never shows a stale translation.

import { createHash } from "node:crypto";
import { sql } from "kysely";
import { db } from "../db/client.js";

/** The conversation parts the dashboard shows translated (README ⑧ + ⑪). */
export const TRANSLATION_PARTS = ["body", "ours", "outreach", "suggestion"] as const;
export type TranslationPart = (typeof TRANSLATION_PARTS)[number];

/** Bábel's console account — the only one that may lay a translation down (ADR-0412). */
export const BABEL_USERNAME = "babel";

/** Longest translation accepted (an incoming letter is capped at 8 KB on ingest; room for growth). */
const MAX_TEXT = 20_000;

/** The fingerprint a translation is bound to: sha256 of the trimmed source, 16 hex. */
export function sourceHash(text: string): string {
  return createHash("sha256").update(text.trim(), "utf8").digest("hex").slice(0, 16);
}

/** A stored translation as the dashboard reads it. */
export interface StoredTranslation {
  readonly text: string;
  readonly hash: string;
  readonly by: string;
}

/** reply id → part → target language → translation. */
export type TranslationIndex = ReadonlyMap<string, Readonly<Partial<Record<TranslationPart, Readonly<Record<string, StoredTranslation>>>>>>;

/** Every stored translation of the given replies, indexed for the dashboard. */
export async function loadTranslations(replyIds: readonly string[]): Promise<TranslationIndex> {
  const out = new Map<string, Partial<Record<TranslationPart, Record<string, StoredTranslation>>>>();
  if (!replyIds.length) return out;
  const rows = await db
    .selectFrom("outreach_reply_translation")
    .select(["reply_id", "part", "target_lang", "source_hash", "text", "translated_by"])
    .where("reply_id", "in", [...replyIds])
    .execute();
  for (const r of rows) {
    const byPart = out.get(r.reply_id) ?? {};
    const byLang = byPart[r.part] ?? {};
    byLang[r.target_lang] = { text: r.text, hash: r.source_hash, by: r.translated_by };
    byPart[r.part] = byLang;
    out.set(r.reply_id, byPart);
  }
  return out;
}

/**
 * The translation of `source` into `target` when one is stored FOR THIS SOURCE; null otherwise
 * (none yet, or the source changed since). Same language / unknown language → null (nothing to do).
 */
export function translationOf(
  stored: Readonly<Record<string, StoredTranslation>> | undefined,
  source: string | null | undefined,
  sourceLang: string | null,
  target: string,
): StoredTranslation | null {
  if (!source || !source.trim() || !sourceLang || sourceLang === target) return null;
  const t = stored?.[target];
  return t && t.hash === sourceHash(source) ? t : null;
}

/** Does this part need a translation for `target` at all? (a text, a known other language) */
export function needsTranslation(source: string | null | undefined, sourceLang: string | null, target: string): boolean {
  return Boolean(source && source.trim() && sourceLang && sourceLang !== target);
}

/** The console languages translations are made for: every operator's own setting. */
export async function translationTargets(): Promise<string[]> {
  const rows = await db.selectFrom("operator_user").select("lang").distinct().execute();
  return [...new Set(rows.map((r) => (r.lang || "hu").toLowerCase()))].sort();
}

/** One part Bábel still owes, with its source and the hash his translation must carry. */
export interface TranslationItem {
  readonly part: TranslationPart;
  readonly target: string;
  readonly hash: string;
  readonly text: string;
}

/** A conversation Bábel still owes translations for (the ticket's content). */
export interface ReplyNeedingTranslation {
  readonly id: string;
  readonly lead: string;
  readonly leadId: string;
  readonly channel: string;
  readonly lang: string;
  readonly receivedAt: string;
  readonly items: readonly TranslationItem[];
}

/**
 * The replies of the last 14 days whose conversation has a part in another language than an
 * operator's console language and no translation for its CURRENT text — Bábel's tickets.
 * A reply with an unknown language (lang NULL — the lead's country has no row) is skipped:
 * the source language is not known, Poe does not answer it either (ADR-0455).
 */
export async function repliesNeedingTranslation(limit = 20): Promise<ReplyNeedingTranslation[]> {
  const targets = await translationTargets();
  if (!targets.length) return [];
  const rows = await db
    .selectFrom("outreach_reply as r")
    .innerJoin("lead as l", "l.id", "r.lead_id")
    .select(["r.id", "l.name as lead", "r.lead_id", "r.channel", "r.lang", "r.received_at", "r.body", "r.ours_text", "r.suggestion_text", "r.prospect_id"])
    .where("r.lang", "is not", null)
    .where("r.received_at", ">", sql<Date>`now() - interval '14 days'`)
    .where(({ or, eb }) => or(targets.map((t) => eb("r.lang", "!=", t))))
    .orderBy("r.received_at")
    .limit(200)
    .execute();
  if (!rows.length) return [];
  // The messenger caption (Viber / WhatsApp outreach) — the newest sent one per prospect.
  const msgProspects = [...new Set(rows.filter((r) => r.channel === "viber" || r.channel === "whatsapp").map((r) => r.prospect_id).filter((x): x is string => !!x))];
  const captions = new Map<string, string>();
  if (msgProspects.length) {
    const out = await db
      .selectFrom("mms_outbox")
      .select(["prospect_id", "messenger_text"])
      .where("prospect_id", "in", msgProspects)
      .where("channel", "in", ["viber", "whatsapp"])
      .where("status", "=", "sent")
      .orderBy("sent_at", "desc")
      .execute();
    for (const o of out) if (o.prospect_id && o.messenger_text && !captions.has(o.prospect_id)) captions.set(o.prospect_id, o.messenger_text);
  }
  const stored = await loadTranslations(rows.map((r) => r.id));
  const res: ReplyNeedingTranslation[] = [];
  for (const r of rows) {
    const lang = r.lang!;
    const sources: Record<TranslationPart, string | null> = {
      body: r.body,
      ours: r.ours_text,
      outreach: r.prospect_id ? (captions.get(r.prospect_id) ?? null) : null,
      suggestion: r.suggestion_text,
    };
    const items: TranslationItem[] = [];
    for (const part of TRANSLATION_PARTS) {
      const src = sources[part];
      for (const target of targets) {
        if (!needsTranslation(src, lang, target)) continue;
        if (translationOf(stored.get(r.id)?.[part], src, lang, target)) continue;
        items.push({ part, target, hash: sourceHash(src!), text: src! });
      }
    }
    if (items.length)
      res.push({
        id: r.id,
        lead: r.lead,
        leadId: r.lead_id,
        channel: r.channel,
        lang,
        receivedAt: new Date(r.received_at as unknown as Date).toISOString(),
        items,
      });
    if (res.length >= limit) break;
  }
  return res;
}

/**
 * Store Bábel's translation (POST /replies/<id>/translate). Refuses (returns the reason, in
 * Hungarian — operator-facing toast) when the part / language is unknown, the text is empty
 * or too long, or the source changed since the ticket (hash mismatch: the fresh ticket follows).
 */
export async function saveTranslation(
  replyId: string,
  input: { part: string; lang: string; hash: string; text: string },
  by: string,
): Promise<string | null> {
  const part = TRANSLATION_PARTS.find((p) => p === input.part);
  if (!part) return "ismeretlen rész";
  const lang = input.lang.trim().toLowerCase();
  if (!/^[a-z]{2,3}$/.test(lang)) return "ismeretlen célnyelv";
  const text = input.text.trim();
  if (!text) return "üres fordítás";
  if (text.length > MAX_TEXT) return "túl hosszú fordítás";
  const r = await db
    .selectFrom("outreach_reply")
    .select(["id", "lang", "body", "ours_text", "suggestion_text", "prospect_id", "channel"])
    .where("id", "=", replyId)
    .executeTakeFirst();
  if (!r) return "nincs ilyen válasz";
  if (!r.lang || r.lang === lang) return "erre a nyelvre nem kell fordítás";
  let source: string | null = part === "body" ? r.body : part === "ours" ? r.ours_text : part === "suggestion" ? r.suggestion_text : null;
  if (part === "outreach" && r.prospect_id) {
    const o = await db
      .selectFrom("mms_outbox")
      .select("messenger_text")
      .where("prospect_id", "=", r.prospect_id)
      .where("channel", "in", ["viber", "whatsapp"])
      .where("status", "=", "sent")
      .orderBy("sent_at", "desc")
      .executeTakeFirst();
    source = o?.messenger_text ?? null;
  }
  if (!source || !source.trim()) return "ennek a résznek nincs szövege";
  if (sourceHash(source) !== input.hash.trim()) return "a forrás-szöveg közben megváltozott — az új jegy szerint fordíts";
  await db
    .insertInto("outreach_reply_translation")
    .values({ reply_id: replyId, part, target_lang: lang, source_hash: sourceHash(source), text, translated_by: by })
    .onConflict((oc) =>
      oc.columns(["reply_id", "part", "target_lang"]).doUpdateSet({ source_hash: sourceHash(source!), text, translated_by: by, created_at: sql`now()` }),
    )
    .execute();
  return null;
}
