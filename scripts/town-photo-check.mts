// gate-runner: land-blocking — kiküldési minőség (tulaj 2026-11-25: kép nélküli / kevés képes lead településképe, ADR-0479)
//
// The town-photo rules of plan assets/design-refs/console/kepnelkuli-hero/, checked without network or model:
//   ① the verdict (Laza + round 2): a forbidden subject, an interior, a road, a sports ground, a close-up,
//      a dusk shot, a namesake 15+ km away and a town-like fallback picture never pass; a good view does;
//   ② sharing out: two leads of one town get different heroes and different picture sequences, the hero
//      never in its own lead's gallery;
//   ③ the send gate: a <5-photo mock passes only with the CURRENT pick AND the owner's switch
//      (app_setting town_photo_dispatch = 'on', default OFF); the ≥5 rule is untouched;
//   ④ the render gate tolerates a sample picture only marked, in a gallery / room slot (wiring).
// ③ runs its SQL inside a transaction that is rolled back (dev DB; nothing is written).
import { readFileSync } from "node:fs";
import { sql } from "kysely";
import { db } from "../src/db/client.js";
import { townVerdict, TOWN_PICK_THRESHOLD, TOWN_PICK_VERSION, type TownPick, type TownScores } from "../src/media/townPick.js";
import { shareTownSet, townKey, townName, type TownPhotoSetRow } from "../src/media/townPhotoSet.js";
import { DISPATCH_PHOTOS_OK_SQL, MOCK_TOWN_PICK_OK_SQL, TOWN_PHOTO_DISPATCH_KEY } from "../src/outreach/mockPhotoGate.js";

let failed = 0;
function check(label: string, ok: boolean): void {
  console.log(`${ok ? "✓" : "✗"}  ${label}`);
  if (!ok) failed++;
}
const src = (p: string): string => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// ── ① the verdict ──
const good: TownScores = {
  town: 0.7, land: 0.2, bad: 0.1, q: 0.8, top: "a scenic panorama of a town", topKind: "town", topBad: "a map", topBadP: 0.02, bucket: "square",
  x: { outdoor: 0.95, wide: 0.9, view: 0.9, day: 0.95, sport: 0.9, sky: 0.95 },
};
const S = (o: Partial<TownScores>, x: Record<string, number> = {}): TownScores => ({ ...good, ...o, x: { ...good.x, ...x } });
check("jó látkép → elfogadva", townVerdict(good, "town") === null);
check("mozdony (legerősebb címke tiltott) → ki", townVerdict(S({ top: "a train or locomotive", topKind: "bad" }), "town") !== null);
check("tiltott téma ≥0,25 → ki", townVerdict(S({ topBadP: 0.3, topBad: "a car, bus or tram" }), "town") !== null);
check("belső tér → ki", townVerdict(S({}, { sky: 0.2 }), "town") !== null);
check("autós út / vezeték → ki", townVerdict(S({}, { view: 0.1 }), "town") !== null);
check("sportpálya → ki", townVerdict(S({}, { sport: 0.3 }), "town") !== null);
check("homlokzat-részlet → ki", townVerdict(S({}, { wide: 0.3 }), "town") !== null);
check("alkonyi / sötét → ki", townVerdict(S({}, { day: 0.2 }), "town") !== null);
check("névrokon 20 km-re (Cheb ≠ Eger) → ki", townVerdict(good, "town", 20) !== null);
check("15 km-en belül → marad", townVerdict(good, "town", 9) === null);
check("tartalékban település-jellegű kép → ki", townVerdict(S({ town: 0.5, land: 0.4 }), "land") !== null);
check("tartalékban tájkép → elfogadva", townVerdict(S({ town: 0.1, land: 0.8, topKind: "land", top: "a forest landscape" }), "land") === null);
check("gyenge téma (<0,50) → ki", townVerdict(S({ town: 0.3, land: 0.1 }), "town") !== null);
check("gyenge minőség (<0,40) → ki", townVerdict(S({ q: 0.3 }), "town") !== null);

// ── ② sharing out ──
const P = (i: number): TownPick => ({
  url: `https://upload.wikimedia.org/x/${i}.jpg`, title: `${i}.jpg`, pageUrl: "https://commons.wikimedia.org/x", author: "A", license: "CC BY-SA 4.0",
  tier: "town", score: 1 - i / 100, bucket: "square", heroOk: i < 4,
});
const set: TownPhotoSetRow = {
  country: "HU", cityKey: "teszt", city: "Teszt", version: TOWN_PICK_VERSION, threshold: TOWN_PICK_THRESHOLD, tier: "town", style: "rural",
  heroes: [P(0), P(1), P(2), P(3)], gallery: [P(10), P(11), P(12), P(13), P(14)],
};
const a = shareTownSet(set, 0);
const b = shareTownSet(set, 1);
check("két lead ugyanott → más hero", a.hero?.url !== b.hero?.url);
check("két lead ugyanott → más képsor", JSON.stringify(a.gallery.map((g) => g.url)) !== JSON.stringify(b.gallery.map((g) => g.url)));
check("a hero sosem a saját galériájában", !a.gallery.some((g) => g.url === a.hero?.url) && !b.gallery.some((g) => g.url === b.hero?.url));
check("a galéria legfeljebb 6 kép", a.gallery.length <= 6);
check("a hero viseli a választás bélyegét", a.hero?.pick?.version === TOWN_PICK_VERSION && a.hero?.pick?.threshold === TOWN_PICK_THRESHOLD);
check("településnév utca/házszám nélkül", townName("Mátraderecske Arany János utca 66") === "Mátraderecske" && townKey("Baška Voda") === "baska voda");

// ── ③ the send gate ──
const mock = (sd: unknown) => JSON.stringify({ siteData: sd });
const stamp = { version: TOWN_PICK_VERSION, threshold: TOWN_PICK_THRESHOLD, tier: "town" };
const cur = mock({ photos: [], townPhoto: { url: "u", pick: stamp } });
const old = mock({ photos: [], townPhoto: { url: "u" } });
const few = mock({ photos: [{ url: "o1" }, { url: "o2" }], townGallery: [{ url: "g", pick: stamp }] });
const five = mock({ photos: [1, 2, 3, 4, 5].map((i) => ({ url: `o${i}` })) });
const ok = async (inputs: string, leadPhotos: number, on: boolean): Promise<boolean> =>
  db.transaction().execute(async (trx) => {
    await sql`delete from app_setting where key = ${TOWN_PHOTO_DISPATCH_KEY}`.execute(trx);
    if (on) await sql`insert into app_setting (key, value) values (${TOWN_PHOTO_DISPATCH_KEY}, 'on')`.execute(trx);
    const r = await sql<{ ok: boolean }>`
      select ${DISPATCH_PHOTOS_OK_SQL} as ok
        from (select jsonb_build_object('material', jsonb_build_object('placesPhotos', ${leadPhotos}::int)) as raw) l,
             (select ${inputs}::jsonb as inputs) a`.execute(trx);
    const v = Boolean(r.rows[0]?.ok);
    throw Object.assign(new Error("rollback"), { v });
  }).catch((e: { v?: boolean }) => Boolean(e.v));
check("KI kapcsolónál a <5 képes ág zárva (aktuális választással is)", !(await ok(cur, 0, false)));
check("BE kapcsolónál a kép nélküli mock aktuális választással mehet", await ok(cur, 0, true));
check("BE kapcsolónál a régi (bélyeg nélküli) településkép nem mehet", !(await ok(old, 0, true)));
check("BE kapcsolónál a kevés képes mock a helyi galéria bélyegével mehet", await ok(few, 2, true));
check("≥5 saját képes lead: a régi szabály (5 kép, nincs településkép) — kapcsolótól függetlenül", (await ok(five, 7, false)) && !(await ok(cur, 7, true)));
check("a kapcsoló kulcsa a kapu SQL-jében van", src("src/outreach/mockPhotoGate.ts").includes("TOWN_PHOTO_DISPATCH_KEY") && /town_photo_dispatch/.test(String(TOWN_PHOTO_DISPATCH_KEY)));
void MOCK_TOWN_PICK_OK_SQL;

// ── ④ the render gate wiring ──
const gate = src("src/outreach/mockRenderGate.ts");
check("render-kapu: minta csak galéria-/szobahelyen", /SAMPLE_MODULES = new Set\(\["gallery", "rooms"\]\)/.test(gate));
check("render-kapu: jelöletlen minta bukik", /jelöletlen mintakép/.test(gate) && /data-cit-sample/.test(gate));
check("render-kapu: minta a nyitóképen / nyitásban bukik", /mintakép a nyitóképen/.test(gate) && /mintakép a nyitásban/.test(gate));
check("render-kapu: a település-hero a választó szabályával újraítélve", /judgeTownPicture\(await townJudgeBytes\(heroUrl, heroBytes\), town.heroTier \?\? "town", true\)/.test(gate) && /\/330px-/.test(gate));
check("render: minden mintakép „MINTA” jelölést kap", /data-cit-sample="1"/.test(src("src/engine/render.ts")) && /T\(data, "MINTA"\)/.test(src("src/engine/render.ts")));
check("csak e-mailes leadért gyűjt", /townHasEmailLeadInNeed/.test(src("src/media/townPhotoSet.ts")) && /hasEmail/.test(src("src/generator/townHero.ts")));

await db.destroy();
if (failed) {
  console.error(`\n❌ town-photo-check: ${failed} ellenőrzés elbukott`);
  process.exit(1);
}
console.log("\n✅ town-photo-check: a településkép-szabály, a szétosztás, a kapcsolós küldési kapu és a minta-szabály rendben.");
