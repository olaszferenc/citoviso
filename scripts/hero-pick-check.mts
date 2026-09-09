// ŐR: melyik fotó lett a nyitókép, és jobb-e, mint a régi méret-szerinti választás?
//
// Ezt a mérést az váltotta ki, hogy egy kiküldött mock hero-jában egy külső illemhely
// volt. A régi szabály (a legnagyobb kép nyer) minden meglévő kapun átengedte, mert egyik
// kapu sem NÉZI meg a képet (photoQuality.ts méretet és URL-alakot mér).
//
// Mit bizonyít a script:
//  ① VALÓDI leadeken fut, a DB portál-fotóival — nem fixture-ön (a fixture azt is
//    "igazolná", amit én írtam bele).
//  ② Kiírja a RÉGI és az ÚJ nyitóképet egymás mellé, hogy a különbség látható legyen.
//  ③ INVARIÁNS: nyitókép SOHA nem lehet olyan tárgyú kép, amit a doktrína kizár
//    (WC, fürdő, parkoló, tábla, dokumentum/portré) — ez a piros/zöld sor.
//  ④ ÖNTESZT: egy szándékosan rossz pontszám-halmazzal ellenőrzi, hogy a rendezés
//    tényleg a pontszámot olvassa. Enélkül a csupa-zöld semmit nem érne (egy elgépelt
//    kulcs miatt egyszer már 17 sablon mért ugyanazt, csupa zölddel).
//
// Futtatás: npx tsx scripts/hero-pick-check.mts [darabszám]

import { db } from "../src/db/client.js";
import {
  judgeHero,
  orderPhotosForHero,
  photoUrlKey,
  scoreHeroCandidates,
  type HeroScore,
} from "../src/generator/heroPick.js";
import { isUsablePropertyPhoto } from "../src/scraper/sources/portals/photoQuality.js";

const NEVER_HERO = new Set(["toilet", "bathroom", "parking", "sign_map", "people_doc"]);

interface Cand {
  url: string;
  longEdge?: number | undefined;
}

/** A lead portál-fotói ugyanazokkal a szűrőkkel, amiket a generate.ts alkalmaz. */
function candidatesOf(raw: unknown): Cand[] {
  const profiles = (raw as { portalProfiles?: unknown[] } | null)?.portalProfiles ?? [];
  const seen = new Set<string>();
  const out: Cand[] = [];
  for (const prof of profiles as { needsReview?: boolean; photos?: unknown[] }[]) {
    if (prof.needsReview) continue;
    // A TELJES fotó-objektumot adjuk át (méret, vouched, portalHost) — a szűrő ezekből
    // dolgozik. Csak az URL-t átadni annyi lenne, mint egy másik, engedékenyebb kaput
    // mérni, mint amit a generate.ts futtat: a mérés a saját útját bizonyítsa.
    for (const p of (prof.photos ?? []) as {
      url?: string;
      width?: number;
      height?: number;
      vouched?: boolean;
      portalHost?: string;
    }[]) {
      if (!p.url || seen.has(photoUrlKey(p.url))) continue;
      if (!isUsablePropertyPhoto({ ...p, url: p.url })) continue;
      seen.add(photoUrlKey(p.url));
      const longEdge = p.width && p.height ? Math.max(p.width, p.height) : undefined;
      out.push({ url: p.url, longEdge });
    }
  }
  return out;
}

/** A 2026-09-09 ELŐTTI szabály, hogy legyen mihez hasonlítani. */
function oldOrder(photos: Cand[]): Cand[] {
  return photos
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (b.p.longEdge ?? 0) - (a.p.longEdge ?? 0) || a.i - b.i)
    .map((x) => x.p);
}

function selfTest(): boolean {
  const photos: Cand[] = [
    { url: "https://example.test/a.jpg", longEdge: 1600 },
    { url: "https://example.test/b.jpg", longEdge: 900 },
  ];
  const scores = new Map<string, HeroScore>([
    [photoUrlKey(photos[0]!.url), { subject: "toilet", score: 5, reason: "külső illemhely" }],
    [photoUrlKey(photos[1]!.url), { subject: "exterior", score: 92, reason: "a ház kívülről" }],
  ]);
  // A NAGYOBB kép a rossz — ha a rendezés a méretet olvasná, az maradna elöl.
  const ordered = orderPhotosForHero(photos, scores);
  const movedBad = ordered[0]!.url === photos[1]!.url;
  // Verdikt nélkül a sorrend nem borulhat fel: a saját kimaradásunk nem lelet.
  const blind = orderPhotosForHero(photos, new Map());
  const stableWhenBlind = blind[0]!.url === photos[0]!.url;
  const blindVerdict = judgeHero(photos[0]!.url, new Map()).verdict === "error";
  console.log(
    `önteszt: rossz kép hátra=${movedBad ? "OK" : "BUKÓ"} · vak sorrend stabil=${
      stableWhenBlind ? "OK" : "BUKÓ"
    } · vak verdikt=error=${blindVerdict ? "OK" : "BUKÓ"}`,
  );
  return movedBad && stableWhenBlind && blindVerdict;
}

async function main(): Promise<void> {
  const limit = Number(process.argv[2] ?? 6);
  if (!selfTest()) {
    console.error("⛔ ÖNTESZT BUKOTT — a mérés innentől hazudna. Kilépés.");
    process.exit(1);
  }

  const leads = await db
    .selectFrom("lead")
    .select(["id", "name", "raw"])
    .where("raw", "?", "portalProfiles")
    .orderBy("name")
    .execute();

  let checked = 0;
  let changed = 0;
  const violations: string[] = [];
  for (const lead of leads) {
    const cands = candidatesOf(lead.raw);
    if (cands.length < 2) continue;
    if (checked >= limit) break;
    checked++;

    const scores = await scoreHeroCandidates(cands, lead.name);
    const before = oldOrder(cands)[0]!;
    const after = orderPhotosForHero(cands, scores)[0]!;
    const v = judgeHero(after.url, scores);
    const bs = scores.get(photoUrlKey(before.url));
    if (before.url !== after.url) changed++;

    console.log(`\n■ ${lead.name} (${cands.length} jelölt)`);
    console.log(`   RÉGI hero: ${bs ? `${bs.subject} ${bs.score}` : "nincs verdikt"} · ${before.url.slice(-58)}`);
    console.log(`   ÚJ   hero: ${v.subject ?? "?"} ${v.score ?? "?"} [${v.verdict}] · ${after.url.slice(-58)}`);
    console.log(`   indok: ${v.reason}`);
    const bad = [...scores.entries()].filter(([, s]) => NEVER_HERO.has(s.subject));
    if (bad.length) {
      console.log(`   kizárt tárgyú kép a készletben: ${bad.map(([, s]) => `${s.subject}(${s.score})`).join(", ")}`);
    }
    if (v.subject && NEVER_HERO.has(v.subject)) {
      violations.push(`${lead.name}: a hero tárgya ${v.subject}`);
    }
  }

  console.log(`\n──────── ${checked} lead · ${changed} esetben MÁS lett a nyitókép`);
  if (violations.length) {
    console.error(`⛔ INVARIÁNS SÉRÜLT:\n - ${violations.join("\n - ")}`);
    process.exit(1);
  }
  console.log("✅ egyetlen nyitókép sem kizárt tárgyú.");
  await db.destroy();
}

await main();
