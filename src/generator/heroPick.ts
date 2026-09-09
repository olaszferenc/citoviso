// MELYIK FOTÓ LEGYEN A NYITÓKÉP? (2026-09-09)
//
// A hero eddig a legnagyobb kép volt: a generate.ts a `longEdge` szerint rendezett, és
// minden sablon a `photos[0]`-t teszi a hero-ba. A pixelszám viszont a MÉRETRŐL szól, nem
// a TARTALOMRÓL — a tulaj egy olyan mockot kapott, aminek a nyitóképén egy külső illemhely
// van. Az a fotó minden meglévő kapun átment (photoQuality.ts: nem hirdetés-méret, nem
// térkép, nem idegen domain, elég nagy), mert egyikük sem NÉZI meg a képet.
//
// Miért nem elég a szöveges heurisztika: megmérve 842 portál-fotón a képaláírás 374 esetben
// hiányzik, a többi pedig "2. kép" vagy maga a szállásnév — vagyis a "fürdő"/"wc" szó
// keresése nulla találatot adna. A fájlnevek ugyanígy sorszámok. Marad a látás.
//
// Két réteg dolgozik együtt, mert külön egyik sem elég:
//  ① ALAP-SORREND (ingyenes, mindig fut) — a portál saját galéria-sorrendje. A hirdetés
//    ELSŐ képe a tulaj által választott borító; ez a legerősebb ingyenes jel, és eddig
//    eldobtuk: mérve 35 leadből 16-nál (46%) a méret-rendezés NEM az első képet emelte
//    hero-ba. A méret innentől alsó küszöb (egy 400 px-es kép elmosódott hero lenne) és
//    holtverseny-döntő, nem elsődleges rendező.
//  ② VISION-PONTSZÁM (fizetős, cache-elt) — a modell MINDEN jelöltet lát, és megmondja,
//    mit ábrázol + mennyire való nyitóképnek. Ez fogja meg azt, amit a sorrend nem: ha
//    maga a portál első képe a budi, akkor is hátra kerül.
//
// A pontszám fotó-URL-re cache-elődik (photo_hero_score, 0060): egy lead mockja sokszor
// újragenerálódik, a kép attól nem lesz más — a második kör ingyen van.

import { recordAiUsage } from "../ai/usage.js";
import type AnthropicNS from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { toImageBlock } from "./images.js";

/**
 * Olcsó, gyors modell: ez OSZTÁLYOZÁS ("mit ábrázol"), nem ténykinyerés — a mock szövegét
 * továbbra is az Opus írja a teljes felbontású képekből. A név a `PRICE_PER_MTOK` kulcsával
 * egyezik (ai/usage.ts), különben a költség-mérő "árazatlan hívás"-ként könyvelné el.
 */
const HERO_MODEL = "claude-haiku-4-5";

/** Ennyi jelöltet nézünk meg egy leadnél — a hero úgyis az élmezőnyből kerül ki. */
export const HERO_SCORE_CAP = 12;

/**
 * Nyitókép-alkalmassági küszöb. Ez alatt a mock kurátor-sorba megy: nem azt jelenti, hogy
 * a kép rossz, hanem hogy EMBER nézze meg, mielőtt kimegy. 55 = "vonzó belső tér" alsó
 * széle; a semleges részlet-fotók (40 körül) már megállítják a levelet.
 */
export const HERO_MIN_SCORE = 55;

/**
 * Élességi padló a HERO-hoz. A relaxált 400 px-es portál-derivált rendben van a galériában,
 * de teljes szélességű nyitóképként elmosódik — ezért pontlevonást kap, nem kizárást.
 */
const HERO_SHARP_LONG_EDGE = 800;
const SMALL_IMAGE_PENALTY = 15;

/**
 * Amit SOHA nem teszünk nyitóképnek, bármit is pontozott a modell. Strukturális háló a
 * heurisztika mellé: ha egy jövőbeli prompt-változat elkezdene 80-at adni egy fürdőszobára,
 * ez akkor is megfogja. (A kép a galériában marad — csak hátulra kerül.)
 */
const NEVER_HERO = new Set(["toilet", "bathroom", "parking", "sign_map", "people_doc"]);
const NEVER_HERO_SCORE = 5;

export interface HeroScore {
  /** Kategória a NEVER_HERO/audit számára — a promptban felsorolt értékek egyike. */
  readonly subject: string;
  /** 0–100: mennyire való nyitóképnek. */
  readonly score: number;
  /** Egy mondat magyarul: MIÉRT — ez megy az operátor-konzol ítélet-buborékjába. */
  readonly reason: string;
}

/** Amit a rendezéshez tudni kell egy fotóról (a GatedPhoto ennek a bővebb alakja). */
export interface OrderablePhoto {
  readonly url: string;
  readonly longEdge?: number | undefined;
}

/** URL query-string nélkül, kisbetűsen — ugyanaz a kulcs, amivel a generate.ts dedupel. */
export function photoUrlKey(url: string): string {
  const q = url.indexOf("?");
  return (q === -1 ? url : url.slice(0, q)).toLowerCase();
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    photos: {
      type: "array",
      description: "Minden kapott képre PONTOSAN egy elem, a kapott sorszámmal.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          index: { type: "integer", description: "A kép sorszáma, ahogy megkaptad (1-től)." },
          subject: {
            type: "string",
            enum: [
              "exterior",
              "view",
              "interior",
              "pool_garden",
              "dining",
              "bathroom",
              "toilet",
              "detail",
              "parking",
              "sign_map",
              "people_doc",
              "other",
            ],
            description: "Mit ábrázol a kép.",
          },
          score: {
            type: "integer",
            description: "0–100: mennyire való NYITÓKÉPNEK egy szálláshely honlapján.",
          },
          reason: {
            type: "string",
            description: "Egy rövid magyar mondat: mi látszik és miért kapta ezt a pontot.",
          },
        },
        required: ["index", "subject", "score", "reason"],
      },
    },
  },
  required: ["photos"],
} as const;

const SYSTEM = `Szálláshely-honlapok KÉPSZERKESZTŐJE vagy. A kapott fotókról eldöntöd, mit ábrázolnak, és melyik való NYITÓKÉPNEK (hero: a lap tetején, teljes szélességben, a szövegnek háttér).

- CSAK azt írd le, ami a képen LÁTHATÓ. Ne találj ki nevet, szolgáltatást, helyszínt.
- MINDEN kapott képre adj pontosan egy sort, a kapott sorszámmal.

Pontozás (a vendég szemével: melyik kép miatt kattint tovább):
- 85–100: a szállás épülete kívülről, panoráma/kilátás, medence, kert vagy terasz — a "wow" képek.
- 60–84: vonzó, világos belső tér (nappali, hálószoba, étkező, reggeliző).
- 30–59: semleges vagy szűk kép: közeli tárgy-részlet, konyhapult, folyosó, lépcsőház, sötét vagy homályos felvétel.
- 0–15: nyitóképnek ALKALMATLAN: WC/külső illemhely, fürdőszoba, parkoló, kuka, tábla/logó/térkép, dokumentum vagy képernyőkép, emberekről készült portré, felismerhetetlen kép.

A "subject" a fő tárgyat nevezze meg; ha a kép fele kert, fele épület, az erősebb élményt add meg.`;

/** Cache-ből olvasott + frissen pontozott verdiktek egy lead fotóira, URL-kulcs szerint. */
export type HeroScores = ReadonlyMap<string, HeroScore>;

async function readCache(keys: readonly string[]): Promise<Map<string, HeroScore>> {
  const out = new Map<string, HeroScore>();
  if (!keys.length) return out;
  const rows = await db
    .selectFrom("photo_hero_score")
    .select(["url_key", "subject", "score", "reason"])
    .where("url_key", "in", [...keys])
    .where("model", "=", HERO_MODEL)
    .execute();
  for (const r of rows) {
    out.set(r.url_key, { subject: r.subject, score: r.score, reason: r.reason ?? "" });
  }
  return out;
}

async function writeCache(key: string, v: HeroScore): Promise<void> {
  await db
    .insertInto("photo_hero_score")
    .values({ url_key: key, subject: v.subject, score: v.score, reason: v.reason, model: HERO_MODEL })
    .onConflict((oc) =>
      oc.column("url_key").doUpdateSet({
        subject: v.subject,
        score: v.score,
        reason: v.reason,
        model: HERO_MODEL,
      }),
    )
    .execute();
}

/**
 * Megnézi a fotókat, és megmondja, melyik való nyitóképnek.
 *
 * Sosem dob: kulcs nélkül, hálózati hibán vagy hiányzó válaszon üres/részleges térképet ad
 * vissza, és a hívó az alap-sorrendre esik vissza. A NEM-ÍTÉLT kép ettől nem lesz "rossz" —
 * a hívó a hiányzó verdiktet a saját kimaradásunkként kezeli, nem a fotó hibájaként.
 */
export async function scoreHeroCandidates(
  photos: readonly OrderablePhoto[],
  leadName: string,
): Promise<HeroScores> {
  const candidates = photos.slice(0, HERO_SCORE_CAP);
  const keys = [...new Set(candidates.map((p) => photoUrlKey(p.url)))];
  const scores = await readCache(keys).catch(() => new Map<string, HeroScore>());

  const missing = candidates.filter((p) => !scores.has(photoUrlKey(p.url)));
  if (!missing.length || !config.anthropicApiKey) return scores;

  // A blokkot fotónként készítjük, hogy a letöltésben elbukó képek NE csúsztassák el a
  // sorszámokat (toImageBlocks a hibásat némán kidobja) — különben a budi verdiktje a
  // szomszéd fotóra ragadna.
  const fetched = (
    await Promise.all(
      missing.map(async (p) => ({ photo: p, block: await toImageBlock(p.url) })),
    )
  ).filter((x): x is { photo: OrderablePhoto; block: NonNullable<typeof x.block> } => x.block !== null);
  if (!fetched.length) return scores;

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const content: AnthropicNS.ContentBlockParam[] = [];
  fetched.forEach((f, i) => {
    content.push({ type: "text", text: `[${i + 1}]` });
    content.push(f.block as AnthropicNS.ContentBlockParam);
  });
  content.push({
    type: "text",
    text:
      `A fenti ${fetched.length} kép ugyanarról a szállásról készült: ${leadName}.\n` +
      `Add meg mindegyikre a sorszámot, a tárgyat, a nyitókép-pontszámot és egy rövid indoklást.`,
  });

  const res = await client.messages.create({
    model: HERO_MODEL,
    max_tokens: 2048,
    system: SYSTEM,
    messages: [{ role: "user", content }],
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
  });
  recordAiUsage("scoreHeroCandidates", HERO_MODEL, res.usage);
  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") return scores;

  let parsed: { photos?: { index?: number; subject?: string; score?: number; reason?: string }[] };
  try {
    parsed = JSON.parse(block.text) as typeof parsed;
  } catch {
    return scores;
  }

  for (const row of parsed.photos ?? []) {
    const at = (row.index ?? 0) - 1;
    const target = fetched[at];
    if (!target || typeof row.score !== "number" || !row.subject) continue;
    const subject = row.subject;
    // Strukturális háló: a kizárt tárgyak pontszáma nem a modell jóindulatán múlik.
    const score = NEVER_HERO.has(subject)
      ? Math.min(NEVER_HERO_SCORE, Math.max(0, Math.round(row.score)))
      : Math.max(0, Math.min(100, Math.round(row.score)));
    const verdict: HeroScore = { subject, score, reason: (row.reason ?? "").trim() };
    const key = photoUrlKey(target.photo.url);
    scores.set(key, verdict);
    await writeCache(key, verdict).catch(() => {
      /* a cache elvesztése csak pénz, nem hiba — a verdikt már megvan */
    });
  }
  return scores;
}

/**
 * A végleges sorrend: az ELSŐ elem lesz a hero (minden sablon a photos[0]-t rendereli).
 *
 * Rendezés: effektív pontszám csökkenően, holtversenyben az EREDETI sorrend (a portál
 * galéria-sorrendje, majd a Places-képek) — az stabil és determinisztikus, tehát a
 * pillanatkép újrarenderelve ugyanazt adja. A verdikt nélküli kép a `fallbackScore`-t
 * kapja, vagyis pontosan a helyén marad: a saját kimaradásunk nem büntetheti a fotót.
 */
export function orderPhotosForHero<T extends OrderablePhoto>(
  photos: readonly T[],
  scores: HeroScores,
  fallbackScore = 50,
): T[] {
  return photos
    .map((p, i) => {
      const v = scores.get(photoUrlKey(p.url));
      const base = v ? v.score : fallbackScore;
      const blurry = (p.longEdge ?? 0) > 0 && (p.longEdge ?? 0) < HERO_SHARP_LONG_EDGE;
      return { p, i, eff: base - (blurry ? SMALL_IMAGE_PENALTY : 0) };
    })
    .sort((a, b) => b.eff - a.eff || a.i - b.i)
    .map((x) => x.p);
}

export type HeroVerdictKind = "pass" | "flag" | "error";

export interface HeroVerdict {
  readonly verdict: HeroVerdictKind;
  readonly reason: string;
  readonly subject: string | null;
  readonly score: number | null;
}

/**
 * A kiválasztott hero ítélete a mock-artifactnak és az operátor-konzolnak.
 *
 * ⛔ A "nem tudtuk megnézni" NEM lelet a képről (feedback: a saját kimaradásunkat egyszer
 * már a lead hibájaként írtuk ki). Verdikt nélkül `error` megy, nem `flag`.
 */
export function judgeHero(heroUrl: string | undefined, scores: HeroScores): HeroVerdict {
  if (!heroUrl) {
    return { verdict: "error", reason: "Ehhez a leadhez nincs fotónk.", subject: null, score: null };
  }
  const v = scores.get(photoUrlKey(heroUrl));
  if (!v) {
    return {
      verdict: "error",
      reason: "A nyitóképet nem tudtuk megnézetni (nincs kulcs vagy nem sikerült a hívás).",
      subject: null,
      score: null,
    };
  }
  return {
    verdict: v.score >= HERO_MIN_SCORE ? "pass" : "flag",
    reason: v.reason,
    subject: v.subject,
    score: v.score,
  };
}
