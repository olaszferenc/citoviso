/**
 * Kapu — a HALOTT fotó ki se kerüljön a generált lapra (ADR-0136).
 *
 * Kiváltó (mérve 2026-09-13): a tárolt portál-fotó-URL elrohad. A hovamenjek.hu átírta a
 * fájlneveit (73 tárolt URL-ből 59 halott, 11 leadet érint), a balaton.hu pedig a SAJÁT
 * lapján hivatkozik 404-es i.szalas.hu képekre. Az ELEK-TESZT lead 13 fotójából 11 halott
 * volt — és a NYITÓKÉP is közülük került ki: a leadnek kiküldött lapon törött-kép ikon, az
 * MMS-előnézet pedig egyáltalán nem állt elő (Elek FK-004 H1).
 *
 * Amit mér:
 *
 *  ① A SZABÁLY (`keepLivePhotos`, tiszta függvény): a VÉGLEGESEN halott fotó (404 /
 *    nem-kép) kiesik, és az ejtés MEGNEVEZI az okot.
 *  ② A TÉVES PIROS elleni fék: a MÚLANDÓ hiba (429, hálózat, upstream, tiltás) NEM ejt.
 *    Egy portál-döccenés miatt üres galériát adni egy élő szállásnak ugyanakkora kár
 *    fordítva — arra a kiküldés-kapu (ADR-0134) való, ami a KISZÁLLÍTOTT lapot méri.
 *  ③ Nincs mellékhatás: hiba nélkül minden fotó marad, és a SORREND sem változik (a
 *    nyitókép-sorrendet a heroPick dönti, nem ez a szűrő).
 *  ④ SZERKEZETI: a szűrő tényleg a fotó-halmaz eldőlésének EGYETLEN pontján fut
 *    (`resolveGatedPhotos`), és a FIZETŐS vision-pontozás ELŐTT — különben azért is
 *    fizetnénk, hogy nem létező képeket osztályozzunk. A forrás-sorrend itt TARTALMI
 *    kérdés, ezért méri az őr.
 *  ⑤ ÖNTESZT (piros iker): minden állítás mellé egy visszarontott bemenet, amit a
 *    detektornak el KELL utasítania — és a ④-hez a forrás visszarontott mása.
 *
 * Futtatás: npx tsx scripts/photo-liveness-check.mts
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { keepLivePhotos } from "../src/generator/photoLiveness.js";
import type { BrokenImage } from "../src/outreach/mockPhotoHealth.js";

let bad = 0;
const ok = (m: string): void => console.log(`  ✓ ${m}`);
const fail = (m: string): void => {
  bad++;
  console.log(`  ✗ ${m}`);
};
const check = (cond: boolean, m: string): void => (cond ? ok(m) : fail(m));

const DEAD = "https://hovamenjek.hu/upload/places/11235_x/main/balatonboglar-erzsebet-3.jpg";
const LIVE = "https://hovamenjek.hu/upload/places/11235_x/main/balatonboglar-3.jpg";
const FLAKY = "https://i.szalas.hu/hotels/459385/500x500/2853990.jpg";

const photos = [{ url: LIVE }, { url: DEAD }, { url: FLAKY }];
const broken = (url: string, failure: BrokenImage["failure"], reason: string): BrokenImage => ({
  url,
  reason,
  where: "img",
  refs: 1,
  ...(failure ? { failure } : {}),
});

console.log("Fotó-élőség kapu — a halott kép ki se kerüljön a lapra\n");

console.log("① a VÉGLEGESEN halott fotó kiesik, megnevezett okkal");
const r1 = keepLivePhotos(photos, [broken(DEAD, "notfound", "a forrás 404-et ad")]);
check(r1.kept.length === 2 && !r1.kept.some((p) => p.url === DEAD), "a 404-es fotó nincs a megtartottak közt");
check(r1.dropped.length === 1 && r1.dropped[0]!.photo.url === DEAD, "az ejtett pontosan a halott");
check(r1.dropped[0]!.reason.includes("404"), "az ejtés VISZI az okot (a napló megnevezi, mit dobtunk)");
check(
  keepLivePhotos(photos, [broken(DEAD, "nonimage", "nem kép")]).kept.length === 2,
  "a „nem kép” válasz is véglegesnek számít",
);

console.log("\n② a MÚLANDÓ hiba NEM ejt (a téves piros ugyanakkora kár, fordítva)");
for (const f of ["upstream", "network", "forbidden", "toolarge"] as const) {
  const r = keepLivePhotos(photos, [broken(FLAKY, f, `múlandó: ${f}`)]);
  check(r.kept.length === 3 && r.dropped.length === 0, `„${f}” miatt egy fotót sem dobunk`);
}
check(
  keepLivePhotos(photos, [broken(FLAKY, undefined, "ismeretlen ok")]).kept.length === 3,
  "hibakód nélküli bejegyzés sem ejt (nem tudjuk, hogy végleges-e)",
);

console.log("\n③ nincs mellékhatás: hiba nélkül minden marad, a sorrend változatlan");
const r3 = keepLivePhotos(photos, []);
check(r3.kept.length === 3 && r3.dropped.length === 0, "üres törött-listánál minden fotó marad");
check(
  r3.kept.map((p) => p.url).join("|") === photos.map((p) => p.url).join("|"),
  "a sorrend érintetlen (a nyitókép-sorrend a heroPick dolga, nem ezé)",
);
check(keepLivePhotos([], [broken(DEAD, "notfound", "x")]).kept.length === 0, "üres bemenet nem dob hibát");
check(
  keepLivePhotos(photos, [broken("https://masik.hu/nem-ebbol.jpg", "notfound", "x")]).kept.length === 3,
  "a halmazban NEM szereplő URL nem ejt semmit (nem URL-részletre illeszt)",
);

console.log("\n④ szerkezeti: a szűrő a HELYES ponton fut, a fizetős pontozás ELŐTT");
const SRC = path.resolve(import.meta.dirname, "..", "src", "generator", "generate.ts");
const src = readFileSync(SRC, "utf8");
/** A három horgony pozíciója a fotó-halmazt eldöntő függvényben. */
const posOf = (needle: string): number => src.indexOf(needle);
const callPos = posOf("dropDeadPhotos(");
const scorePos = posOf("scoreHeroCandidates(");
const gatePos = posOf("export async function resolveGatedPhotos");
const orderPos = posOf("orderPhotosForHero(");
check(callPos > 0, "a generálás hívja a `dropDeadPhotos`-t");
// ⛔ A hermetikus fixture-kapcsoló (`checkLiveness: false`) CSAK fixture-é. Ha termék-kód
// kapcsolná ki, az élőség-szabály némán megszűnne — pont az a hibaosztály, ami ellen szól.
// ⚠️ A KOMMENT NEM KÓD: az első változatom a saját magyarázó mondatomra illeszkedett, és
// a definíció fájlját jelentette sértőnek. A detektor előbb kikommentez, aztán mér.
const stripComments = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
const disablesLiveness = (code: string): boolean =>
  /checkLiveness\s*:\s*false/.test(stripComments(code));
{
  const srcDir = path.resolve(import.meta.dirname, "..", "src");
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".ts") && disablesLiveness(readFileSync(full, "utf8"))) {
        offenders.push(path.relative(srcDir, full));
      }
    }
  };
  walk(srcDir);
  check(
    offenders.length === 0,
    `termék-kód nem kapcsolhatja ki az élőség-szűrőt${offenders.length ? ` — sérti: ${offenders.join(" · ")}` : ""}`,
  );
  // Piros iker: VALÓDI kikapcsolást el kell kapnia, puszta EMLÍTÉST nem.
  check(
    disablesLiveness('const m = await resolveGatedPhotos(l, id, { checkLiveness: false });'),
    "a detektor elkapja a valódi kikapcsolást",
  );
  check(
    !disablesLiveness('// a `checkLiveness: false` csak fixture-nek való\nconst m = await f(l);'),
    "a puszta EMLÍTÉS (komment) nem sértés — a szabály kódra szól, nem prózára",
  );
}
check(callPos > gatePos, "a hívás a `resolveGatedPhotos`-on BELÜL van (a halmaz egyetlen döntési pontja)");
check(callPos < scorePos, "a szűrés a FIZETŐS vision-pontozás ELŐTT fut (nem fizetünk halott képért)");
check(callPos < orderPos, "a szűrés a nyitókép-sorrend ELŐTT fut (halott URL nem lehet hero)");

console.log("\n⑤ önteszt — a visszarontott változatokat el KELL utasítani");
// piros iker ①-hez: a szabály „mindent megtart” változata
const keepsEverything = <T extends { url: string }>(ps: readonly T[]): { kept: T[] } => ({ kept: [...ps] });
check(
  keepsEverything(photos).kept.some((p) => p.url === DEAD),
  "a „mindent megtart” változat ÁTENGEDNÉ a halottat (tehát ①. állítás valódi szűrést mér)",
);
// piros iker ②-höz: a „minden hiba ejt” változat
const dropsEverything = keepLivePhotos(photos, [
  broken(FLAKY, "notfound", "ha véglegesnek jelölnénk a múlandót"),
]);
check(
  dropsEverything.kept.length === 2,
  "ha a múlandót véglegesnek jelölnénk, ejtene — tehát ②. a HIBAKÓDON dől el, nem véletlenül zöld",
);
// piros iker ④-hez: a sorrend-állítás a visszarontott forráson bukjon
const swapped = src.slice(0, gatePos) + src.slice(gatePos).replace(
  /const live = await dropDeadPhotos\(photos\);[\s\S]*?photos = live\.kept;\n/,
  "",
);
check(
  swapped.indexOf("dropDeadPhotos(") < 0 || swapped.indexOf("dropDeadPhotos(") > swapped.indexOf("scoreHeroCandidates("),
  "a hívást kivéve a ④. állítás ELBUKNA (a szerkezeti mérés nem önigazoló)",
);

console.log(bad ? `\n⛔ ${bad} sértés` : "\n✅ fotó-élőség kapu: a halott kép nem juthat a lapra");
process.exit(bad ? 1 : 0);
