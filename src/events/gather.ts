// The weekly program gathering chain (the `poi` module — "Automata heti programajánló").
//
// THE MEASURED CHAIN (2026-09-22, Balatonfüred 30 km, real API calls):
//   Brave (URL discovery, $5/1000, ADR-0026)
//     → fetchPortalPage()   robots.txt + per-host throttling
//       → jsonLdNodes()     Event nodes for free where a page carries them
//         → Haiku 4.5 in SMALL batches (5 pages/call) over the page TEXT, json_schema
//           → code-level gates (gates.ts): date window, date-in-text, source, place
//             → dedup (token-set, per settlement)
// Result: 2,55 Ft/program and 0 wrong dates, vs the Anthropic web_search tool's
// 5,65 Ft/program with 33% wrong dates.
//
// ⛔ Three measured traps, do not undo them:
//  1. BATCH SIZE is the bottleneck. 45 pages in one call → 3 programs (62k tokens in,
//     460 out = under-extraction). The same pages in batches of 5 → 24 programs.
//  2. The schema enforces that a date EXISTS, not that it is RIGHT. The gates are
//     load-bearing.
//  3. The JSON-LD path is marginal (1 usable Event on 40 pages — structured markup
//     correlates with ticket sales, local programs rarely carry it). Taken, not relied on.
//
// SETTLEMENT-KEYED (owner ruling, 2026-09-23): one run per settlement per week. The
// page and its extraction are cached for the whole weekly BATCH, so a regional portal
// that answers ten settlements' queries is fetched and read once.

import Anthropic from "@anthropic-ai/sdk";
import { sql } from "kysely";
import { db } from "../db/client.js";
import { callCostUsd, recordAiUsage } from "../ai/usage.js";
import { webSearch } from "../scraper/sources/webSearch.js";
import { fetchPortalPage } from "../scraper/sources/portals/politeness.js";
import { decodeEntities, jsonLdNodes, textOf } from "../scraper/sources/portals/extract.js";
import {
  MAX_PAGES_PER_HOST,
  MAX_SPAN_DAYS,
  WINDOW_DAYS,
  addDays,
  dateMentioned,
  dedupKey,
  fold,
  haversineKm,
  sameProgram,
  windowGate,
  type DropReason,
} from "./gates.js";
import type { Settlement } from "./settlements.js";

export const EXTRACT_MODEL = "claude-haiku-4-5";
/** ⛔ Measured bottleneck — see trap 1. Do not raise it to save calls. */
export const BATCH_PAGES = 5;
/** Page text handed to the model, as measured. The date-in-text gate reads the same slice. */
export const CHARS_PER_PAGE = 3000;
export const RESULTS_PER_QUERY = 10;
export const BRAVE_USD_PER_QUERY = 5 / 1000;

const MONTHS_HU = [
  "január", "február", "március", "április", "május", "június",
  "július", "augusztus", "szeptember", "október", "november", "december",
];

export interface GatheredEvent {
  readonly name: string;
  readonly start: string;
  readonly end: string | null;
  readonly place: string | null;
  readonly settlement: Settlement;
  readonly sourceUrl: string;
  readonly via: "jsonld" | "llm";
}

interface RawEvent {
  name: string;
  start: string;
  end: string | null;
  city: string;
  place: string | null;
  sourceUrl: string;
  via: "jsonld" | "llm";
  /** The page text the date must appear in (llm only; JSON-LD is structured). */
  text?: string;
}

interface Page {
  readonly url: string;
  readonly html: string;
}

/**
 * State shared by all settlement runs of ONE weekly batch: what was already fetched
 * and read, and how many pages each host has given us (the per-source quantity cap).
 */
export class GatherBatch {
  readonly seenUrls = new Set<string>();
  readonly hostPages = new Map<string, number>();
  constructor(
    readonly today: string,
    /** Every settlement an event may resolve to — the union of all tenant circles. */
    readonly known: readonly Settlement[],
    readonly opts: { dryRun?: boolean; log?: (s: string) => void } = {},
  ) {}
  log(s: string): void {
    (this.opts.log ?? console.log)(s);
  }
}

export interface RunSummary {
  settlement: string;
  queries: number;
  pages: number;
  inTokens: number;
  outTokens: number;
  costUsd: number;
  extracted: number;
  kept: GatheredEvent[];
  drops: Partial<Record<DropReason, number>>;
}

/* --------------------------------------------------------------- JSON-LD ----- */

function ldText(v: unknown): string | undefined {
  if (typeof v === "string") return decodeEntities(v).trim() || undefined;
  if (v && typeof v === "object" && typeof (v as Record<string, unknown>).name === "string") {
    return decodeEntities((v as Record<string, string>).name).trim() || undefined;
  }
  return undefined;
}

function ldCity(loc: unknown): { city: string; place: string | null } {
  const first = Array.isArray(loc) ? loc[0] : loc;
  if (first && typeof first === "object") {
    const r = first as Record<string, unknown>;
    const a = r.address;
    const place = typeof r.name === "string" ? decodeEntities(r.name).trim() : null;
    if (a && typeof a === "object" && typeof (a as Record<string, unknown>).addressLocality === "string") {
      return { city: String((a as Record<string, unknown>).addressLocality).trim(), place };
    }
    if (typeof a === "string") return { city: a.trim(), place };
    return { city: place ?? "", place };
  }
  return { city: ldText(first) ?? "", place: null };
}

export function eventsFromJsonLd(page: Page): RawEvent[] {
  const out: RawEvent[] = [];
  for (const n of jsonLdNodes(page.html)) {
    const t = n["@type"];
    const types = Array.isArray(t) ? t : [t];
    if (!types.some((x) => typeof x === "string" && /event|festival/i.test(x))) continue;
    const name = ldText(n.name);
    const start = typeof n.startDate === "string" ? n.startDate.slice(0, 10) : "";
    if (!name || !start) continue; // a type stub, not an event (trap 3)
    const end = typeof n.endDate === "string" ? n.endDate.slice(0, 10) : null;
    const { city, place } = ldCity(n.location);
    out.push({ name, start, end, city, place, sourceUrl: page.url, via: "jsonld" });
  }
  return out;
}

/* ------------------------------------------------------------------- LLM ----- */

const SCHEMA = {
  type: "object",
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          start_date: { type: "string" },
          end_date: { type: "string" },
          city: { type: "string" },
          place: { type: "string" },
          page: { type: "integer" },
        },
        required: ["name", "start_date", "end_date", "city", "place", "page"],
        additionalProperties: false,
      },
    },
  },
  required: ["events"],
  additionalProperties: false,
} as const;

function prompt(today: string, windowEnd: string, corpus: string): string {
  return `Ma ${today} van. Az alábbi letöltött weboldalak szövegéből gyűjtsd ki azokat a
nyilvános programokat (fesztivál, falunap, vásár, koncert, kiállítás, sportverseny,
túra, gasztro-esemény stb.), amelyeket ${today} és ${windowEnd} között tartanak.

Mezők:
- name: a program neve, ahogy a lapon áll (ne egészítsd ki, ne fordítsd le).
- start_date / end_date: ÉÉÉÉ-HH-NN. Egynapos programnál az end_date üres szöveg.
- city: a TELEPÜLÉS neve, ahol tartják (csak a településnév, pl. "Tihany").
- place: a helyszín neve, ha a lap megadja (pl. "Apátsági templom"), különben üres.
- page: annak a LAPNAK a sorszáma, amelyiken a program szerepel.

⛔ Nem program: iroda, üzlet, étterem vagy szállás önmagában, nyitvatartás, állandó
szolgáltatás, reklám. Csak konkrét napra szóló, látogatható eseményt vegyél fel.
⛔ Csak akkor vedd fel, ha a konkrét dátum a lap szövegében SZEREPEL. Ne találj ki
dátumot, ne következtess a hét napjából. Ha a település nem derül ki, hagyd ki a programot.

${corpus}`;
}

async function extractBatch(
  client: Anthropic,
  batch: readonly { url: string; text: string }[],
  today: string,
  windowEnd: string,
): Promise<{ events: RawEvent[]; inTok: number; outTok: number; costUsd: number }> {
  const corpus = batch.map((p, j) => `--- LAP ${j + 1} ---\nURL: ${p.url}\n${p.text}`).join("\n\n");
  const res = await client.messages.create({
    model: EXTRACT_MODEL,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt(today, windowEnd, corpus) }],
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
  });
  // The run's own spend goes onto event_gather_run below; this also feeds any
  // ambient usage collector (no-op outside one).
  recordAiUsage("extractLocalEvents", EXTRACT_MODEL, res.usage);
  const block = res.content.find((b) => b.type === "text");
  const events: RawEvent[] = [];
  if (block && block.type === "text") {
    let parsed: { events?: Array<Record<string, unknown>> } = {};
    try {
      parsed = JSON.parse(block.text);
    } catch {
      parsed = {};
    }
    for (const e of parsed.events ?? []) {
      // The source is the page NUMBER mapped back in code, so the model cannot
      // invent a URL: an out-of-range page means no source, and no source = no row.
      const page = batch[Number(e.page) - 1];
      events.push({
        name: String(e.name ?? "").trim(),
        start: String(e.start_date ?? ""),
        end: String(e.end_date ?? "") || null,
        city: String(e.city ?? "").trim(),
        place: String(e.place ?? "").trim() || null,
        sourceUrl: page?.url ?? "",
        via: "llm",
        text: page?.text,
      });
    }
  }
  return {
    events,
    inTok: res.usage.input_tokens,
    outTok: res.usage.output_tokens,
    costUsd: callCostUsd(EXTRACT_MODEL, res.usage) ?? 0,
  };
}

/* -------------------------------------------------------------- resolve ----- */

/** "Tihany, Apátsági templom" / "Balatonfüred-Arács" → the known settlement, nearest wins. */
export function resolveSettlement(
  city: string,
  known: readonly Settlement[],
  near: { lat: number; lon: number },
): Settlement | null {
  const want = fold(city.split(/[,(]/)[0] ?? "").trim();
  if (!want) return null;
  const hits = known.filter((s) => {
    const n = fold(s.name);
    return n === want || want.startsWith(`${n}-`) || want.startsWith(`${n} `);
  });
  if (!hits.length) return null;
  return hits.sort(
    (a, b) => haversineKm(near.lat, near.lon, a.lat, a.lon) - haversineKm(near.lat, near.lon, b.lat, b.lon),
  )[0]!;
}

/* ------------------------------------------------------------------ run ----- */

function queryFor(s: Settlement, today: string, windowEnd: string): string {
  const m1 = Number(today.slice(5, 7)) - 1;
  const m2 = Number(windowEnd.slice(5, 7)) - 1;
  const months = m1 === m2 ? MONTHS_HU[m1] : `${MONTHS_HU[m1]} ${MONTHS_HU[m2]}`;
  return `${s.name} programok rendezvények ${today.slice(0, 4)} ${months}`;
}

async function store(e: GatheredEvent): Promise<void> {
  const lo = addDays(e.start, -MAX_SPAN_DAYS);
  const hi = e.end ?? e.start;
  const near = await db
    .selectFrom("local_event")
    .select(["id", "name", "start_date", "end_date"])
    .where("settlement_osm_id", "=", e.settlement.osmId)
    .where("start_date", ">=", lo)
    .where("start_date", "<=", hi)
    .execute();
  const twin = near.find((r) =>
    sameProgram({ name: r.name, start: r.start_date, end: r.end_date }, e, e.settlement.name),
  );
  if (twin) {
    await db.updateTable("local_event").set({ last_seen_at: sql`now()` }).where("id", "=", twin.id).execute();
    return;
  }
  await db
    .insertInto("local_event")
    .values({
      settlement_osm_id: e.settlement.osmId,
      name: e.name,
      start_date: e.start,
      end_date: e.end,
      place_name: e.place,
      source_url: e.sourceUrl,
      via: e.via,
      dedup_key: dedupKey(e.name, e.settlement.name, e.start),
    })
    .onConflict((oc) => oc.columns(["settlement_osm_id", "dedup_key"]).doUpdateSet({ last_seen_at: sql`now()` }))
    .execute();
}

/**
 * One settlement's weekly run: query → fetch (batch-cached) → extract → gate →
 * dedup → store. Writes its own `event_gather_run` row (cost and yield, measured).
 */
export async function gatherSettlement(batch: GatherBatch, target: Settlement): Promise<RunSummary> {
  const today = batch.today;
  const windowEnd = addDays(today, WINDOW_DAYS);
  const sum: RunSummary = {
    settlement: target.name, queries: 0, pages: 0, inTokens: 0, outTokens: 0,
    costUsd: 0, extracted: 0, kept: [], drops: {},
  };
  const drop = (r: DropReason) => (sum.drops[r] = (sum.drops[r] ?? 0) + 1);

  const runId = batch.opts.dryRun
    ? null
    : (await db.insertInto("event_gather_run").values({ settlement_osm_id: target.osmId })
        .returning("id").executeTakeFirstOrThrow()).id;

  try {
    // 1. Brave — URL discovery only; WE decide what reaches the model.
    const results = await webSearch(queryFor(target, today, windowEnd), undefined, undefined, RESULTS_PER_QUERY);
    sum.queries = 1;
    sum.costUsd += BRAVE_USD_PER_QUERY;

    // 2. fetch — robots-checked, per-host capped, once per weekly batch.
    const pages: Page[] = [];
    for (const r of results) {
      if (batch.seenUrls.has(r.link)) continue;
      batch.seenUrls.add(r.link);
      let host = "";
      try {
        host = new URL(r.link).host.replace(/^www\./, "");
      } catch {
        continue;
      }
      if ((batch.hostPages.get(host) ?? 0) >= MAX_PAGES_PER_HOST) continue;
      const { page } = await fetchPortalPage(r.link);
      if (!page) continue;
      batch.hostPages.set(host, (batch.hostPages.get(host) ?? 0) + 1);
      batch.seenUrls.add(page.finalUrl);
      pages.push({ url: page.finalUrl, html: page.html });
    }
    sum.pages = pages.length;

    // 3. JSON-LD first (0 tokens), 4. the model only for the rest, in small batches.
    const raw: RawEvent[] = [];
    const rest: Array<{ url: string; text: string }> = [];
    for (const p of pages) {
      const ld = eventsFromJsonLd(p);
      if (ld.length) raw.push(...ld);
      else rest.push({ url: p.url, text: textOf(p.html).slice(0, CHARS_PER_PAGE) });
    }
    if (rest.length) {
      const client = new Anthropic();
      for (let i = 0; i < rest.length; i += BATCH_PAGES) {
        const r = await extractBatch(client, rest.slice(i, i + BATCH_PAGES), today, windowEnd);
        raw.push(...r.events);
        sum.inTokens += r.inTok;
        sum.outTokens += r.outTok;
        sum.costUsd += r.costUsd;
      }
    }
    sum.extracted = raw.length;

    // 5. gates, then dedup within this run.
    for (const e of raw) {
      if (!e.name) { drop("no_name"); continue; }
      if (!e.sourceUrl) { drop("no_source"); continue; }
      const w = windowGate(e.start, e.end, today);
      if (!w.ok) { drop(w.reason); continue; }
      if (e.via === "llm" && !dateMentioned(e.text ?? "", w.start)) { drop("date_not_in_text"); continue; }
      const at = resolveSettlement(e.city, batch.known, target);
      if (!at) { drop("unknown_place"); continue; }
      const ev: GatheredEvent = {
        name: e.name, start: w.start, end: w.end, place: e.place,
        settlement: at, sourceUrl: e.sourceUrl, via: e.via,
      };
      if (sum.kept.some((k) => k.settlement.osmId === at.osmId && sameProgram(k, ev, at.name))) {
        drop("duplicate");
        continue;
      }
      sum.kept.push(ev);
    }

    if (!batch.opts.dryRun) for (const e of sum.kept) await store(e);

    if (runId) {
      await db.updateTable("event_gather_run").set({
        finished_at: sql`now()`, status: "done", queries: sum.queries, pages: sum.pages,
        in_tokens: sum.inTokens, out_tokens: sum.outTokens, cost_usd: sum.costUsd.toFixed(4),
        extracted: sum.extracted, kept: sum.kept.length, drops: JSON.stringify(sum.drops) as never,
      }).where("id", "=", runId).execute();
    }
    return sum;
  } catch (err) {
    if (runId) {
      await db.updateTable("event_gather_run").set({
        finished_at: sql`now()`, status: "failed", error: (err as Error).message.slice(0, 500),
        cost_usd: sum.costUsd.toFixed(4), queries: sum.queries, pages: sum.pages,
        in_tokens: sum.inTokens, out_tokens: sum.outTokens,
      }).where("id", "=", runId).execute();
    }
    throw err;
  }
}
