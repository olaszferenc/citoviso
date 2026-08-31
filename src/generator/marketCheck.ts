// MARKETING-RELEVANCE gate (marketinges kontextus-őr) — owner ruling 2026-08-31.
//
// WHY THIS EXISTS. The mock is not a poem, it is a cold customer acquisition asset:
// the lead opens it once and decides in seconds whether we understood their property.
// A mock led with "Fenyőillatú csend a tető alatt" and offered, as its top highlight,
// "Olvasnivalóval teli könyvespolc a nappaliban" — for a property whose own listing
// advertises a playground, a garden, a private car park, a cot and a high chair. The
// owner's verdict: it would be funny if it were meant as a joke, and this is NOT a joke.
//
// The three existing gates could not catch it, because none of them measures this:
//   factCheck    — is every hard fact SOURCED?   (the bookshelf was real: it was in the photo)
//   designCheck  — emoji, tokens, module hooks?  (all fine)
//   provenance   — is the demo framing present?  (present)
// A mock can pass all three and still say nothing a guest could act on. That is the
// gap this module closes: not "is it true" and not "is it pretty", but
//   WOULD SOMEONE LOOKING FOR A PLACE TO STAY LEARN WHAT THEY WOULD GET HERE?
//
// TWO LAYERS, ON PURPOSE (the "heuristic guard needs a structural twin" doctrine).
// An LLM judging copy is a taste heuristic, and a heuristic that fails quietly is
// worse than no guard. So the cheap, deterministic question runs FIRST and cannot be
// talked out of its answer: of the guest-decision facts we HANDED the writer, how many
// did the sales surface actually use? Zero used, while a pool and a playground sat in
// the source list, is a structural failure — no API call, no opinion, no argument.
// The marketing judge then runs on what survives, to catch what token overlap cannot
// (a fact named but buried, a claim that misleads, a headline that says nothing).
//
// VERDICT ONLY — it judges, it does not rewrite. `critique` is written to be fed back
// into ONE regeneration; a second failure records "flag", and the outreach send gates
// (sendBatch / sendOutreachSms) already refuse a flagged artifact, so a bad mock stops
// at the curator instead of landing in a stranger's mailbox.

import { recordAiUsage } from "../ai/usage.js";
import type AnthropicNS from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { deaccent } from "../scraper/enrichPresence.js";
import { toImageBlocks } from "./images.js";

/** The copy that does the SELLING — the part a lead reads before deciding. */
export interface SalesSurface {
  /** Hero H1 (the editorial lead) — the single most-read line on the page. */
  readonly heroLead?: string;
  readonly heroEyebrow?: string;
  readonly tagline?: string;
  readonly intro?: string;
  readonly highlights: readonly string[];
}

/** The guest-decision truth we HELD about the property when the copy was written. */
export interface MarketSource {
  readonly name: string;
  /** The property's own town (never the region sweep label). */
  readonly town?: string | null;
  /** Verified amenities — the facts the copy was supposed to sell. */
  readonly amenities?: readonly string[];
  readonly roomCount?: number | null;
  readonly rating?: { value: number; count?: number | null } | null;
}

export interface MarketVerdict {
  /** pass = the copy sells something real; flag = it does not; error = unverifiable. */
  readonly verdict: "pass" | "flag" | "error";
  /** Sourced guest-decision facts the sales surface actually names. */
  readonly factsNamed: string[];
  /** Strong selling points we HELD and the copy ignored — ranked, best first. */
  readonly missed: string[];
  /** Which layer decided: the deterministic twin or the marketing judge. */
  readonly layer: "structural" | "judge";
  readonly reason?: string;
  /** Concrete steering for ONE regeneration attempt. Empty when the verdict passed. */
  readonly critique?: string;
}

/**
 * Selling points ranked by how much they move an accommodation decision. Used ONLY to
 * order the `missed` list, so the critique leads with the pool rather than the kettle —
 * it never decides pass/fail, so an unranked amenity is not thereby second-class.
 */
const DECISION_WEIGHT: readonly (readonly [string, number])[] = [
  ["medence", 100], ["uszoda", 100], ["wellness", 90], ["szauna", 85], ["jacuzzi", 85],
  ["strand", 80], ["vizpart", 80], ["topart", 80], ["molo", 60], ["horgasz", 60],
  ["jatszoter", 75], ["gyerekbarat", 70], ["kisagy", 55], ["etetoszek", 50],
  ["parkol", 70], ["garazs", 65], ["toltoallomas", 55], ["elektromos jarmu", 55],
  ["kutyabarat", 65], ["haziallat", 60],
  ["kert", 60], ["terasz", 55], ["erkely", 50], ["panorama", 70], ["kilatas", 65],
  ["klima", 60], ["legkondicion", 60], ["reggeli", 65], ["etterem", 60],
  ["grill", 50], ["bogracs", 50], ["kemence", 50], ["konyha", 45],
  ["kerekpar", 45], ["mosogep", 40], ["wifi", 35], ["internet", 30], ["futes", 25],
];

function norm(s: string): string {
  return deaccent(s.toLowerCase()).replace(/\s+/g, " ").trim();
}

function weightOf(amenity: string): number {
  const a = norm(amenity);
  let best = 0;
  for (const [needle, w] of DECISION_WEIGHT) if (a.includes(needle) && w > best) best = w;
  return best;
}

/**
 * Does the sales copy REFER to this amenity? Matched on the amenity's content words,
 * not the whole label: the listing says "Elektromos jármű töltőállomás" and good copy
 * writes "elektromos töltő" — the same fact in the writer's own words, which is exactly
 * what we asked for. Requiring the label verbatim would punish the copy for not
 * parroting a portal's phrasing.
 */
function copyNames(amenity: string, salesText: string): boolean {
  const words = norm(amenity)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 5);
  if (!words.length) return false;
  // Hungarian is agglutinative, so compare on a truncated stem ("medence" ↔ "medencével",
  // "jatszoter" ↔ "jatszoteres"). 5 chars is short enough to survive the suffix and long
  // enough that unrelated words do not collide.
  return words.some((w) => salesText.includes(w.slice(0, Math.min(w.length, 6))));
}

const JUDGE_SYSTEM = `Marketinges vagy, aki EGYETLEN kérdésre válaszol egy szálláshely-weboldal szövegéről:

  "Egy ember, aki MOST keres szállást erre a környékre, megtudja-e ebből a szövegből,
   hogy MIT KAPNA itt — és elég vonzó-e ahhoz, hogy tovább olvasson?"

A szemüveged a VENDÉGÉ, nem a költőé. Ez hideg ügyfélszerzés: a szálláshely tulajdonosa
fogja megnyitni, és 5 másodperc alatt eldönti, értjük-e, mije van. A giccs és az üres
hangulatozás itt nem semleges, hanem KÁR.

BUKTASD (verdict="flag"), ha bármelyik igaz:
1. A főcím és a kiemelések nem neveznek meg semmit, amit a vendég KAP vagy HASZNÁL.
   Tipikus bukó: "Fenyőillatú csend a tető alatt" — hangulat, de nulla információ.
2. A szöveg a BERENDEZÉST vagy a FELÜLETEKET árulja a szolgáltatás helyett
   (könyvespolc, csempe, ágynemű, padló, falszín). Ezt senki nem keres.
3. A legerősebb eladási pont (medence, játszótér, strand-közelség, saját parkoló,
   panoráma, kisállat-barát) megvan az adatok között, de a szövegből HIÁNYZIK
   vagy elsikkad valami jelentéktelen mögött.
4. A szöveg olyat ÁLLÍT a helyről, amit az adatok nem támasztanak alá, és ami a
   vendéget FÉLREVEZETI — kiemelten a földrajzi helyzet ("a tóparton", "a vízparton",
   "a strand mellett"), ha semmi nem igazolja. Ez foglalás után csalódás lesz.
5. Klisé, amit bármelyik szállásra rá lehetne írni ("Üdvözöljük", "otthon, távol
   az otthontól", "felejthetetlen élmény", "a pihenés szigete").

ENGEDD ÁT (verdict="pass"), ha a főcím és a kiemelések együtt megmutatják, mi ez a hely
és miért éri meg — akkor is, ha a hangvétel költői. A hangulat nem baj; a hangulat
INFORMÁCIÓ HELYETT baj.

A "critique" mezőbe konkrét, cselekvő utasítást írj a szövegírónak: MIT emeljen be és
MIT dobjon ki. Ne stílus-tanácsot adj, hanem nevezd meg a tényeket. Ez az utasítás
közvetlenül egy újragenerálásba megy.`;

const JUDGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    verdict: { type: "string", enum: ["pass", "flag"] },
    reason: { type: "string", description: "1-2 mondat: miért bukott, vagy miért jó" },
    missed: {
      type: "array",
      items: { type: "string" },
      description: "Az adatokban meglévő, de a szövegből hiányzó erős eladási pontok.",
    },
    critique: {
      type: "string",
      description:
        "Konkrét utasítás a szövegírónak egy újragenerálásra: mit emeljen be, mit dobjon ki. Üres, ha pass.",
    },
  },
  required: ["verdict", "reason", "missed", "critique"],
} as const;

/** Flatten the sales surface into one comparable blob (hero + tagline + intro + highlights). */
function salesBlob(s: SalesSurface): string {
  return norm(
    [s.heroLead, s.heroEyebrow, s.tagline, s.intro, ...s.highlights].filter(Boolean).join(" · "),
  );
}

/**
 * Judge whether the generated copy sells the property to someone looking for a place to
 * stay. Best-effort like the other gates: a judge failure returns "error" (→ curation),
 * never throws. The STRUCTURAL layer needs no API key and always runs.
 */
export async function verifyMarketRelevance(input: {
  sales: SalesSurface;
  source: MarketSource;
  photos?: readonly string[];
}): Promise<MarketVerdict> {
  const blob = salesBlob(input.sales);
  const amenities = (input.source.amenities ?? []).filter((a) => a.trim().length > 1);

  const named = amenities.filter((a) => copyNames(a, blob));
  const missedRanked = amenities
    .filter((a) => !copyNames(a, blob))
    .map((a) => ({ a, w: weightOf(a) }))
    .filter((x) => x.w > 0)
    .sort((x, y) => y.w - x.w)
    .map((x) => x.a);

  // ── Layer 1: the structural twin. No opinion, no API call. ──────────────────────
  // Only fires when we actually HELD guest-decision facts: with nothing to sell, an
  // atmospheric line is the honest best available, and flagging it would punish the
  // copy for a gap in the DATA. That case is a scraping problem, not a copy problem.
  const strongHeld = amenities.filter((a) => weightOf(a) >= 50);
  if (strongHeld.length && !named.length) {
    return {
      verdict: "flag",
      layer: "structural",
      factsNamed: [],
      missed: missedRanked,
      reason:
        `a szöveg EGYETLEN igazolt szolgáltatást sem nevez meg, pedig ${strongHeld.length} erős ` +
        `eladási pont állt rendelkezésre (${missedRanked.slice(0, 5).join(", ")}) — ` +
        `hangulat-szöveg konverziós ajánlat helyett`,
      critique:
        `A szöveg nem mond semmit, amit a vendég KAP. Írd újra úgy, hogy a hero-vezércím és a ` +
        `kiemelések a következő IGAZOLT szolgáltatásokra épüljenek, a legerősebbel kezdve: ` +
        `${missedRanked.slice(0, 6).join(", ")}. A berendezés és a felületek leírását hagyd el.`,
    };
  }

  // ── Layer 2: the marketing judge, on what the structural layer let through. ─────
  if (!config.anthropicApiKey) {
    return {
      verdict: named.length ? "pass" : "error",
      layer: "structural",
      factsNamed: named,
      missed: missedRanked,
      reason: named.length
        ? `nincs API key — csak a strukturális réteg futott (${named.length} igazolt tény megnevezve)`
        : "nincs API key és nincs megnevezett tény — nem ítélhető meg",
    };
  }

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();
    const content: AnthropicNS.ContentBlockParam[] = [];
    for (const block of await toImageBlocks((input.photos ?? []).slice(0, 3))) {
      content.push(block as AnthropicNS.ContentBlockParam);
    }
    content.push({
      type: "text",
      text:
        `SZÁLLÁS: ${input.source.name}\n` +
        `TELEPÜLÉS: ${input.source.town ?? "nincs megadva"}\n` +
        (input.source.roomCount ? `SZOBASZÁM: ${input.source.roomCount}\n` : "") +
        (input.source.rating
          ? `GOOGLE-ÉRTÉKELÉS: ${input.source.rating.value}` +
            (input.source.rating.count != null ? ` (${input.source.rating.count} vélemény)` : "") +
            "\n"
          : "") +
        `\nAMIT A SZÁLLÁSRÓL BIZONYÍTOTTAN TUDUNK (a saját, hitelesített hirdetéséről) —\n` +
        `ezt KELLETT VOLNA eladnia a szövegnek:\n` +
        (amenities.length ? amenities.map((a) => `- ${a}`).join("\n") : "- (nincs adat)") +
        `\n\n════ A GENERÁLT ELADÓ SZÖVEG ════\n` +
        `HERO FŐCÍM: ${input.sales.heroLead ?? "(nincs)"}\n` +
        `HERO KICKER: ${input.sales.heroEyebrow ?? "(nincs)"}\n` +
        `ALCÍM: ${input.sales.tagline ?? "(nincs)"}\n` +
        `BEMUTATKOZÓ: ${input.sales.intro ?? "(nincs)"}\n` +
        `KIEMELÉSEK:\n${input.sales.highlights.map((h) => `  - ${h}`).join("\n") || "  (nincs)"}\n\n` +
        `A determinisztikus előszűrő szerint a szöveg ezeket az igazolt szolgáltatásokat nevezi ` +
        `meg: ${named.length ? named.join(", ") : "EGYET SEM"}.\n` +
        (missedRanked.length
          ? `Ezeket az erős eladási pontokat viszont NEM említi: ${missedRanked.slice(0, 8).join(", ")}.\n`
          : "") +
        `\nÍtélj a fenti szabályok szerint. A képek a szállás valós fotói — a 4. szabálynál ` +
        `(félrevezető állítás) ezek is bizonyítékok.`,
    });

    const res = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 900,
      system: JUDGE_SYSTEM,
      messages: [{ role: "user", content }],
      output_config: { format: { type: "json_schema", schema: JUDGE_SCHEMA } },
    } as AnthropicNS.MessageCreateParamsNonStreaming);
    recordAiUsage("verifyMarketRelevance", "claude-opus-4-8", res.usage);

    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      return {
        verdict: "error",
        layer: "judge",
        factsNamed: named,
        missed: missedRanked,
        reason: "marketing-őr üres válasz",
      };
    }
    const parsed = JSON.parse(block.text) as {
      verdict: "pass" | "flag";
      reason: string;
      missed: string[];
      critique: string;
    };
    return {
      verdict: parsed.verdict,
      layer: "judge",
      factsNamed: named,
      // The judge may name a miss the ranking table has no word for; keep both views.
      missed: [...new Set([...(parsed.missed ?? []), ...missedRanked])],
      reason: parsed.reason,
      ...(parsed.verdict === "flag" && parsed.critique ? { critique: parsed.critique } : {}),
    };
  } catch (err) {
    return {
      verdict: "error",
      layer: "judge",
      factsNamed: named,
      missed: missedRanked,
      reason: `marketing-őr hiba: ${(err as Error).message}`,
    };
  }
}
