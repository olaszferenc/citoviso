// Factuality gate (tényhűség-kapu) — enforces DOMAIN 03-INVARIANTS §B.17.
// A generated mock must never state a HARD fact (price, m², capacity, rating,
// distance, award, year) that is not traceable to a structured lead field or a
// feature visibly present in the real photos. This module is the runtime gate:
//   1. deterministic pre-filter: extract HARD-fact candidates from the VISIBLE
//      text (cheap regex; CSS/hex/script excluded so palette codes never trip it).
//   2. LLM verifier (only when candidates exist): adjudicate each candidate
//      against the source fields + the photos → per-fact sourced/unsourced.
// No candidates → PASS without an API call. Any unsourced HARD fact → FLAG.
// Wired best-effort into generateMock; the verdict is recorded on the artifact and
// a FLAG routes the mock to the curation queue (never auto-outreach) — §G.20.

import { recordAiUsage } from "../ai/usage.js";
import type AnthropicNS from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { toImageBlocks } from "./images.js";

/**
 * The `region:` line of the source-fact block — exported so the rule is measurable without
 * an API call.
 *
 * ⛔ Say the ABSENCE out loud. A silently missing line reads to the verifier as "not
 * mentioned"; this reads as "may not be claimed". The difference decides whether a page
 * asserting a region on a lead we cannot place gets flagged or waved through.
 */
export function regionSourceLine(region?: string): string {
  return region
    ? `region: ${region}`
    : "region: NINCS ADAT — a szálláshoz nem tartozik megnevezett terület, ezért BÁRMILYEN " +
        "régióra/tájegységre/partoldalra utaló állítás MEGALAPOZATLAN";
}

/** The only source facts a HARD claim may be grounded on (besides visible photos). */
export interface FactSource {
  readonly name: string;
  /**
   * The area's NAME — omitted when no `region` record backs the scrape area.
   *
   * ⛔ THIS LIST IS A LICENCE, not a description: everything on it is something the page
   * MAY assert. Passing `resolveRegion()`'s `?? id` fallback therefore handed the gate a
   * scrape KEY (`bs`, `_test`) as a groundable truth about the property — a page claiming
   * it would have passed the fact gate. Absent = "we hold no region fact", so any regional
   * claim in the copy is ungrounded and gets flagged, which is the point.
   */
  readonly region?: string;
  readonly address?: string | null;
  readonly phone?: string | null;
  readonly email?: string | null;
  /**
   * REAL structured facts the engine path renders (A4-gated Google rating, high-band
   * portal rooms/amenities). Without these the verifier would flag the mock's own TRUE
   * numbers ("4,6", "88 vélemény", "4 fő") as fabricated — the gate must know what the
   * generator legitimately knew. Absent fields keep the strict corpus-path behavior.
   */
  readonly rating?: { value: number; count?: number | null } | null;
  readonly rooms?: readonly { name: string; capacity?: string | null }[];
  readonly amenities?: readonly string[];
  /**
   * The property's own prose on its verified listing — a source the copywriter now draws
   * facts from, so the gate must be able to trace them back. Without it the verifier
   * flags TRUE statements: it would see "kert" in the copy, find no `amenities` entry,
   * and call it fabricated even though the listing says so in plain words.
   */
  readonly descriptions?: readonly string[];
}

export interface HardFactVerdict {
  /** The claim as it appears in the generated copy. */
  readonly fact: string;
  /** Is it traceable to a source field or a visible photo feature? */
  readonly sourced: boolean;
  /** Provenance pointer: field name, "image#N", "soft", or "" if unsourced. */
  readonly source: string;
}

export interface FactCheckVerdict {
  /** pass = every HARD fact sourced; flag = ≥1 fabricated; error = could not verify. */
  readonly verdict: "pass" | "flag" | "error";
  /** Deterministic pre-filter hits (the HARD-fact-shaped tokens found). */
  readonly candidates: string[];
  /** Per-candidate adjudication (empty on trivial pass or error). */
  readonly facts: HardFactVerdict[];
  readonly reason?: string;
}

// Spelled-out Hungarian numbers (capacity fabrication vector: "tizenkét fő").
const NUM_WORD =
  "(?:egy|két|kettő|három|négy|öt|hat|hét|nyolc|kilenc|tíz|tizen(?:egy|két|kettő|három|négy|öt|hat|hét|nyolc|kilenc)|húsz|harminc|negyven|ötven|hatvan|hetven|nyolcvan|kilencven|száz)";

// Unicode-aware token boundaries (ASCII \b breaks on ő/²/€ etc.).
const B = "(?<![\\p{L}\\d])";
const E = "(?![\\p{L}\\d])";
const P = (src: string): RegExp => new RegExp(src, "giu");

// HARD-fact token patterns on VISIBLE text (numbers gain meaning only with a unit
// or a claim-keyword — so phone/address digits do not trip these). Keep in sync
// with scripts/factcheck-scan.mjs (the dev-time hook net).
const HARD_PATTERNS: readonly RegExp[] = [
  P(`${B}\\d[.,]\\d\\s*(?:★|csillag)`), // "4.8 csillag"
  /★/gu, // bare star glyph
  P(`${B}\\d{1,4}\\s*(?:értékelés|vélemény|review)`), // "27 értékelés"
  P(`${B}\\d[\\d\\s.]*\\s*(?:Ft|HUF|€|EUR|forint)${E}`), // prices
  P(`${B}(?:\\d{1,3}|${NUM_WORD})\\s*(?:fő|fős|személy|ágy|háló|szoba|szobás|apartman|apartmanos)${E}`), // capacity (digit or spelled)
  P(`${B}\\d{1,4}\\s*(?:m²|m2|négyzetméter|nm)${E}`), // area
  P(`${B}\\d{1,4}\\s*(?:méter|kilométer|km)\\p{L}*`), // distance ("200 méterre"); bare "m" excluded
  P(`${B}\\d{1,3}\\s*perc(?:re|nyire)?${E}`), // "5 percre"
  P(`(?:alapítva|óta|épült|nyílt)\\D{0,14}(?:1[89]\\d{2}|20\\d{2})`), // founding year
  P(`(?:1[89]\\d{2}|20\\d{2})\\D{0,6}(?:óta|-ban épült|-ben épült)`),
  P(`${B}(?:díjnyertes|díjazott|díjjal|kitüntet\\p{L}*|minősített|NTAK|Michelin)`), // awards/certs
  P(`${B}(?:wifi|wi-fi|medence|szauna|jacuzzi|jakuzzi|pezsgőfürdő|klíma|légkondi)${E}`), // concrete amenities
  P(`${B}leg\\p{L}{3,}`), // superlatives ("legnagyobb", "legjobb") — LLM adjudicates
];

/** Strip style/script/comments, drop tags, decode a few entities → visible text. */
export function htmlToVisibleText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&(?:quot|#34);/gi, '"')
    .replace(/&(?:lt);/gi, "<")
    .replace(/&(?:gt);/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The page's own SAMPLE markers (ADR-0061 / §B.17): the „Minta” pill on a native-styled demo
 * section, the shared sample note (`cit-sample-note`) and every template's own `<prefix>-sample`
 * note (`h-sample`, `cn-sample`, `t-sample` …).
 * Content under them is illustrative by the page's own words — not a claim.
 */
const SAMPLE_CLASS = String.raw`class="(?:[^"]*\s)?(?:cit-modsec__minta|cit-sample-note|[a-z]+-sample)(?:\s[^"]*)?"`;
// A sample room's photo flag counts; a REAL room wearing a borrowed gallery photo carries
// `data-cit-sample-photo="borrowed"` (render.ts stampSampleRoomPhotos), and its claims stay
// in front of the gate.
const SAMPLE_MARKER = new RegExp(`${SAMPLE_CLASS}|data-cit-sample-photo="sample"`);
/** The opening tag of an element to cut whole: a `data-cit-sample-block` container or a sample note. */
const SAMPLE_ELEMENT = new RegExp(String.raw`<([a-z][a-z0-9]*)\b[^>]*(?:\sdata-cit-sample-block(?=[\s=>])|\s${SAMPLE_CLASS})[^>]*>`, "i");

/**
 * Cut every SAMPLE-marked section out of the page before the gate reads it (Elek round 3,
 * OP3-1). The gate counted the sample room, facility and arrival blocks as unsourced facts —
 * 12 of 13 on the Erika walk mock („Ingyenes Wi-Fi (1. szoba)”, „Érkezés 14:00 – 20:00”) — and
 * the walk page was stuck at the send gate for content it labels as a sample itself. The cut is
 * the INNERMOST <section> holding a marker, so a real section around it survives; templates mark
 * samples through the shared helpers, so this is one rule for every template.
 */
export function stripSampleSections(html: string): string {
  const spans: { start: number; end: number; depth: number }[] = [];
  const stack: { start: number; depth: number }[] = [];
  for (const m of html.matchAll(/<section\b|<\/section\s*>/gi)) {
    if (m[0].startsWith("</")) {
      const open = stack.pop();
      if (open) spans.push({ start: open.start, end: m.index! + m[0].length, depth: open.depth });
    } else stack.push({ start: m.index!, depth: stack.length });
  }
  const marked = spans.filter((sp) => SAMPLE_MARKER.test(html.slice(sp.start, sp.end)));
  // Innermost only: a marked span with a marked span inside it keeps its own real content.
  const cut = marked.filter((sp) => !marked.some((o) => o !== sp && o.start > sp.start && o.end < sp.end));
  let out = html;
  for (const sp of cut.sort((a, b) => b.start - a.start)) out = out.slice(0, sp.start) + " " + out.slice(sp.end);
  return stripSampleElements(out);
}

/**
 * A sample block that is not inside its own <section> (the horizontal rooms rail, the transit
 * departure board) carries `data-cit-sample-block` on its container; the whole element goes, and so
 * does every sample note left standing outside a cut section.
 */
function stripSampleElements(html: string): string {
  let out = html;
  for (;;) {
    const open = SAMPLE_ELEMENT.exec(out);
    if (!open) return out;
    const tag = open[1]!.toLowerCase();
    const re = new RegExp(`<${tag}\\b[^>]*>|</${tag}\\s*>`, "gi");
    re.lastIndex = open.index + open[0].length;
    let depth = 1;
    let end = out.length;
    for (let m = re.exec(out); m; m = re.exec(out)) {
      depth += m[0].startsWith("</") ? -1 : 1;
      if (depth === 0) {
        end = m.index + m[0].length;
        break;
      }
    }
    out = out.slice(0, open.index) + " " + out.slice(end);
  }
}

/**
 * ONE rule for the verdict: flag when the verifier marked at least one fact unsourced, pass when
 * it named facts and all are sourced. The model's own `verdict` field disagreed with its list —
 * the Erika editorial mock carried 5 unsourced facts and still read „pass” — so the list decides.
 * A flag with no fact behind it is not a finding anyone can act on: it is "error" (unverifiable).
 */
export function verdictOfFacts(
  modelVerdict: "pass" | "flag",
  facts: readonly HardFactVerdict[],
): FactCheckVerdict["verdict"] {
  if (facts.some((f) => !f.sourced)) return "flag";
  return modelVerdict === "flag" ? "error" : "pass";
}

/** Deterministic pre-filter: unique HARD-fact-shaped tokens in the visible text. */
export function extractHardFactCandidates(visibleText: string): string[] {
  const hits = new Set<string>();
  for (const re of HARD_PATTERNS) {
    for (const m of visibleText.matchAll(re)) {
      const t = m[0].trim().replace(/\s+/g, " ");
      if (t) hits.add(t);
    }
  }
  return [...hits];
}

const VERIFY_SYSTEM = `Te a Citoviso TÉNYHŰSÉG-őre vagy: adverzariális verifier. A DOMAIN 03-INVARIANTS §B.17 szerint egy generált szállás-oldal EGYETLEN HARD tényt sem fabrikálhat. Az alapállásod a GYANÚ.
- HARD tény (verifikálandó): ár, m², szoba/kapacitás, ★/értékelés + értékelés-szám, évszám, NTAK/díj/minősítés, konkrét távolság ("200 m"), cím, telefon, e-mail, nyitvatartás.
- SOFT (szabad, sourced="soft"): hangulat, jelző, paletta, hívogató szöveg, a régió általános említése.
- Az EGYETLEN megengedett igazságforrás HARD tényhez: (a) egy megadott strukturált mező, VAGY (b) a képeken EGYÉRTELMŰEN LÁTHATÓ jellemző ("image#N"). A prózában "hihetően hangzik" NEM forrás.
- KIZÁRÓLAG a felsorolt forrás-mezők léteznek. Ami nincs köztük és a képeken sem látható, az forrás nélküli — ár/m² mező SOSEM létezik, ilyen szám mindig fabrikált.
- Minden jelölthöz döntsd el: sourced=true (add meg a source-ot: mező-név / "image#N" / "soft") vagy sourced=false (source="").
- verdict="flag", ha BÁRMELY HARD tény forrás nélküli; különben "pass". Bizonytalanság esetén flag (a kockázat aszimmetrikus).`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    verdict: { type: "string", enum: ["pass", "flag"] },
    facts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          fact: { type: "string" },
          sourced: { type: "boolean" },
          source: { type: "string", description: 'mező-név, "image#N", "soft", vagy "" ha forrástalan' },
        },
        required: ["fact", "sourced", "source"],
      },
    },
    reason: { type: "string", description: "1-2 mondat, csak a flag okai" },
  },
  required: ["verdict", "facts", "reason"],
} as const;

/**
 * Verify a generated mock against the factuality contract (§B.17). `html` is the
 * generated markup; `lead` the structured source fields; `photos` the real image
 * URLs the copy could ground on. Best-effort: on verifier failure returns
 * verdict "error" (→ hold for curation), never throws for an API hiccup.
 */
export async function verifyFactuality(input: {
  html: string;
  lead: FactSource;
  photos: string[];
}): Promise<FactCheckVerdict> {
  const visible = htmlToVisibleText(stripSampleSections(input.html));
  const candidates = extractHardFactCandidates(visible);
  // The deterministic pre-filter is a HINT list, not the gate: a fabrication may be
  // spelled-out/number-less and slip the regex. So the LLM verifier ALWAYS runs for
  // an AI mock (when a key exists), instructed to also catch unlisted HARD facts.
  if (!config.anthropicApiKey) {
    return candidates.length
      ? { verdict: "error", candidates, facts: [], reason: "nincs ANTHROPIC_API_KEY — a jelöltek nem verifikálhatók" }
      : { verdict: "pass", candidates, facts: [], reason: "nincs jelölt és nincs API key" };
  }

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();

    const content: AnthropicNS.ContentBlockParam[] = [];
    // Inlined by us, NOT plain URL blocks: portal hosts sit behind Cloudflare, which blocks
    // Anthropic's fetcher — a URL block then fails the WHOLE verify call, and the gate
    // degrades to "error" on exactly the portal-photo leads it matters most for.
    for (const block of await toImageBlocks(input.photos.slice(0, 5))) {
      content.push(block as AnthropicNS.ContentBlockParam);
    }

    const sourceLines = [
      `name: ${input.lead.name}`,
      regionSourceLine(input.lead.region),
      `address: ${input.lead.address ?? "nincs"}`,
      `phone: ${input.lead.phone ?? "nincs"}`,
      `email: ${input.lead.email ?? "nincs"}`,
      // Structured truth the engine path legitimately renders — only when provided.
      ...(input.lead.rating
        ? [
            `google_rating: ${input.lead.rating.value}` +
              (input.lead.rating.count != null ? ` (${input.lead.rating.count} vélemény)` : ""),
          ]
        : []),
      ...(input.lead.rooms?.length
        ? [
            `rooms (hitelesített adatlapról): ${input.lead.rooms
              .map((r) => r.name + (r.capacity ? ` — ${r.capacity}` : ""))
              .join("; ")}`,
          ]
        : []),
      ...(input.lead.amenities?.length
        ? [`amenities (hitelesített adatlapról): ${input.lead.amenities.join(", ")}`]
        : []),
      // A prose source is still a SOURCE: a fact stated here is traceable. But it is
      // the listing's own marketing text, so it grounds only what it plainly STATES —
      // not what the copy might infer from its tone.
      ...(input.lead.descriptions?.length
        ? [
            `leiras (a szállás SAJÁT bemutatkozása a hitelesített adatlapján — az itt KIMONDOTT ` +
              `tény forrásolt; amit csak sugall, az NEM):\n"""${input.lead.descriptions.join("\n---\n").slice(0, 2500)}"""`,
          ]
        : []),
    ].join("\n");

    content.push({
      type: "text",
      text:
        `A fenti ${Math.min(input.photos.length, 5)} kép a szállás VALÓS fotója (image#1..N).\n\n` +
        `VALÓS forrás-mezők (a strukturált igazságforrás):\n${sourceLines}\n\n` +
        `A generált oldal LÁTHATÓ szövege:\n"""\n${visible.slice(0, 6000)}\n"""\n\n` +
        (candidates.length
          ? `A determinisztikus előszűrő ezeket a HARD-tény-jelölteket találta — mindegyiket ítéld meg:\n${candidates.map((c) => `- ${c}`).join("\n")}\n\n`
          : "") +
        `EZEN FELÜL a fenti látható szövegben keresd meg az ÖSSZES további HARD tényt is (kiírt számok pl. „tizenkét fő"; szám nélküli konkrét állítások pl. felszereltség/díj), amit az előszűrő esetleg kihagyott, és azokat is ítéld meg. Minden nem-SOFT tényt sorolj a facts közé.`,
    });

    const res = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1500,
      system: VERIFY_SYSTEM,
      messages: [{ role: "user", content }],
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
    } as AnthropicNS.MessageCreateParamsNonStreaming);
    recordAiUsage("verifyFactuality", "claude-opus-4-8", res.usage);

    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      return { verdict: "error", candidates, facts: [], reason: "verifier üres válasz" };
    }
    const parsed = JSON.parse(block.text) as {
      verdict: "pass" | "flag";
      facts: HardFactVerdict[];
      reason: string;
    };
    const facts = parsed.facts ?? [];
    const verdict = verdictOfFacts(parsed.verdict, facts);
    return {
      verdict,
      candidates,
      facts,
      reason:
        verdict === "error"
          ? `a verifier megjelölte, de egyetlen forrástalan tényt sem nevezett meg: ${parsed.reason}`
          : parsed.reason,
    };
  } catch (err) {
    return { verdict: "error", candidates, facts: [], reason: `verifier hiba: ${(err as Error).message}` };
  }
}
