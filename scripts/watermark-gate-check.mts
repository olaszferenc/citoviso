// ⭐⭐ VÍZJEL-KAPU ŐR (§A.2) — az „egyetlen feltétlen kizárás" tényleg kizár-e.
//
// A MÉRT LELET (2026-09-19). A `03-INVARIANTS §A.2` kimondja, hogy élesítéskor a nem-owner
// fotónál **az EGYETLEN feltétlen kizáró ok a vízjeles fotó**, és a kapu évek óta ott áll
// (`photoPolicy.ts` → `if (p.watermarked) return false;`). Csakhogy a `watermarked` flaget a
// TERMELÉSI úton SEMMI nem állította `true`-ra — egyedül egy teszt-fixture. A fék be volt
// építve, a pedál működött, de soha senki nem nyomta meg: egy vízjeles portál-fotó
// akadálytalanul kiment volna egy FIZETŐ ügyfél élő oldalára. A §A.2 nem kapu volt, hanem
// típusdefiníció — és egy ZÖLD őr a flag TOVÁBBÉLÉSÉT mérte, nem azt, hogy valaha beáll-e.
//
// ⛔ EZ AZ ŐR PONTOSAN AZT A KÜLÖNBSÉGET MÉRI. Nem azt kérdezi, hogy „megmarad-e a flag, ha
// már megvan" (azt a `photo-rights-edit-check` méri), hanem hogy a LÁNC EGÉSZE beállítja-e:
// megvett vision-ítélet → `dropNeverShown` → `toSitePhotos` → `isLiveSafePhoto`.
//
// ── MIT MÉR ──────────────────────────────────────────────────────────────────────────────
//   ① A LÁNC: vízjeles verdikt → a kiszállított `Photo` viseli a bélyeget → az éles kapu KIZÁRJA.
//   ② FELTÉTLENSÉG: a kizárás a jogi önnyilatkozat ELLENÉRE is áll (§A.2 szava: „feltétlen").
//   ③ NEGATÍV KONTROLL: vízjel NÉLKÜL, nyilatkozattal a portál-fotó ÁTMEGY — a szűrés nem
//      vehet el valódi szállás-fotót (§A.2 + a `NEVER_SHOWN` doktrínája).
//   ④ A MI KIMARADÁSUNK NEM LELET: verdikt nélkül a kép marad, és NEM kapja meg a bélyeget.
//   ⑤ LEFEDETTSÉG: minden KISZÁLLÍTOTT fotó kap ítéletet (HERO_SCORE_CAP == PORTAL_PHOTO_CAP).
//      Ha a két szám elcsúszik, a plafon fölötti kép ítélet NÉLKÜL megy ki — „szűretlen, nem
//      semleges". Ez a ház saját, mért tanulsága az `ad_banner`-ről.
//   ⑥ A KÉRDÉS FEL VAN-E TÉVE: a vision-séma kötelezővé teszi a mezőt, és a prompt tanítja.
//
// ⛔ ÜRES HALMAZON MÉRNI HAMIS ZÖLD: a záró sor kiírja, hány valódi mérés futott; nulla = bukás.
// ⛔ Ez az őr NEM hív LLM-et és NEM ír DB-t: fixture-verdiktekkel méri a láncot.
//
//   npx tsx scripts/watermark-gate-check.mts

import { readFileSync } from "node:fs";
import path from "node:path";

import { dropNeverShown, HERO_SCORE_CAP, type HeroScore } from "../src/generator/heroPick.js";
import { toSitePhotos } from "../src/engine/siteData.js";
import { isLiveSafePhoto } from "../src/engine/photoPolicy.js";

const ROOT = path.resolve(import.meta.dirname, "..");

let pass = 0;
let measured = 0;
const fails: string[] = [];
function check(ok: boolean, name: string, detail = ""): void {
  if (ok) pass++;
  else fails.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const verdict = (over: Partial<HeroScore> = {}): HeroScore => ({
  subject: "exterior",
  score: 90,
  reason: "a szállás épülete kívülről",
  watermarked: false,
  ...over,
});

const MARKED = "https://portal.example/kep-vizjeles.jpg";
const CLEAN = "https://portal.example/kep-tiszta.jpg";
const UNJUDGED = "https://portal.example/kep-nem-nezett.jpg";

/** A TELJES lánc egy menetben: megvett ítélet → kiszállított Photo → éles kapu. */
function live(urls: string[], scores: Map<string, HeroScore>, rightsDeclared: boolean) {
  const collected = urls.map((url) => ({ url, provenance: "portal" as const }));
  const kept = dropNeverShown(collected, scores).kept;
  const photos = toSitePhotos(kept, "Teszt Vendégház");
  return {
    photos,
    liveSafe: photos.filter((p) => isLiveSafePhoto(p, rightsDeclared)),
  };
}

console.log("── ① + ② A LÁNC és a FELTÉTLENSÉG ──");
{
  const scores = new Map([
    [MARKED, verdict({ watermarked: true })],
    [CLEAN, verdict()],
  ]);
  // ⚠️ nyilatkozattal: §A.2 szerint ez MINDENT megenged, EGYETLEN kivétellel — a vízjel.
  const r = live([MARKED, CLEAN], scores, true);
  measured++;
  const marked = r.photos.find((p) => p.url === MARKED);
  check(marked?.watermarked === true, "a vízjeles verdikt ELJUT a kiszállított fotóig", String(marked?.watermarked));
  check(
    !r.liveSafe.some((p) => p.url === MARKED),
    "⛔ a vízjeles fotó NEM mehet élesre — a jogi nyilatkozat ELLENÉRE sem (feltétlen)",
  );
  check(
    r.liveSafe.some((p) => p.url === CLEAN),
    "(③ negatív kontroll) a vízjel NÉLKÜLI portál-fotó nyilatkozattal ÁTMEGY",
  );
  check(r.liveSafe.length === 1, "pontosan egy kép marad élesre", `${r.liveSafe.length}`);
}

{
  // ⛔ A LEGFONTOSABB NEGATÍV KONTROLL: ha a láncot bárhol elvágják, ez pirosra megy.
  // Nyilatkozat NÉLKÜL a portál-fotó amúgy is kiesik — ezért mérjük NYILATKOZATTAL,
  // különben az állítás akkor is zöld lenne, ha a vízjel-bélyeg sehová nem jut el.
  const scores = new Map([[MARKED, verdict({ watermarked: true, subject: "interior" })]]);
  const r = live([MARKED], scores, true);
  measured++;
  check(r.liveSafe.length === 0, "vízjeles + nyilatkozat → NULLA élesíthető kép", `${r.liveSafe.length}`);
}

console.log("── ④ A MI KIMARADÁSUNK NEM LELET A FOTÓRÓL ──");
{
  // Nincs verdikt (nincs kulcs, hálózati hiba, cache-en túli fotó) → a kép MARAD, és NEM
  // kap vízjel-bélyeget. A ház elve: a saját kimaradásunk nem állítás a rekordról.
  const r = live([UNJUDGED], new Map(), true);
  measured++;
  check(r.photos.length === 1, "verdikt nélkül a kép MARAD", `${r.photos.length}`);
  check(r.photos[0]?.watermarked === undefined, "…és NEM kap vízjel-bélyeget", String(r.photos[0]?.watermarked));
  check(r.liveSafe.length === 1, "…és nyilatkozattal élesíthető (nem büntetjük a vevőt a mi hibánkért)");
}

{
  // A bélyeg csak akkor kerül fel, ha a verdikt KIMONDTA. Egy `false` verdikt nem bélyegez.
  const r = live([CLEAN], new Map([[CLEAN, verdict({ watermarked: false })]]), true);
  measured++;
  check(r.photos[0]?.watermarked === undefined, "`watermarked: false` verdikt NEM tesz fel bélyeget");
}

console.log("── ⑤ LEFEDETTSÉG: minden KISZÁLLÍTOTT fotó kap-e ítéletet ──");
{
  // Két KÜLÖN konstans két fájlban. Ha a galéria-plafon fölé megy, a plafon fölötti kép
  // ítélet NÉLKÜL megy ki — és az nem „semleges", hanem SZŰRETLEN (a ház mért tanulsága).
  const gen = readFileSync(path.join(ROOT, "src/generator/generate.ts"), "utf8");
  const m = /const PORTAL_PHOTO_CAP = (\d+)/.exec(gen);
  measured++;
  check(m !== null, "a PORTAL_PHOTO_CAP felismerhető a generate.ts-ben");
  if (m) {
    const portalCap = Number(m[1]);
    check(
      HERO_SCORE_CAP >= portalCap,
      "⛔ minden KISZÁLLÍTOTT fotó kap ítéletet (HERO_SCORE_CAP >= PORTAL_PHOTO_CAP)",
      `vision-plafon ${HERO_SCORE_CAP} vs. galéria-plafon ${portalCap}`,
    );
  }
}

console.log("── ⑥ FEL VAN-E TÉVE A KÉRDÉS a látásnak ──");
{
  const src = readFileSync(path.join(ROOT, "src/generator/heroPick.ts"), "utf8");
  measured++;
  check(
    /required:\s*\[[^\]]*"watermarked"/.test(src),
    "a vision-séma KÖTELEZŐVÉ teszi a vízjel-mezőt (nem opcionális extra)",
  );
  check(/VÍZJEL/.test(src), "a prompt tanítja is, mit jelent a vízjel");
  check(
    /watermarked:\s*r\.watermarked/.test(src) && /watermarked:\s*v\.watermarked/.test(src),
    "a cache OLVAS és ÍR is vízjel-ítéletet (különben minden körben újra fizetnénk)",
  );
  // A prompt-verziónak lépnie KELLETT: a régi sorokban nincs vízjel-ítélet, és egy hiányos
  // ítélet egy jogi kapu alatt rosszabb, mint az újrapontozás ára.
  check(
    /PROMPT_VERSION = "v3-watermark"/.test(src),
    "a PROMPT_VERSION lépett — a hiányos ítéletű régi sorok nem töltődnek be",
  );
  // A vízjel NEM subject: különben egy vízjeles külső fotó elveszítené az `exterior`-t.
  check(
    !/enum:\s*\[[^\]]*"watermarked"/.test(src),
    "a vízjel NEM `subject` kategória (ortogonális a tartalomra)",
  );
}

console.log("── A KAPU SORRENDJE (a feltétlenség szerkezeti bizonyítéka) ──");
{
  const pol = readFileSync(path.join(ROOT, "src/engine/photoPolicy.ts"), "utf8");
  // ⚠️ AZ ELÁGAZÁSOKAT keressük, nem a puszta azonosítót: a `rightsDeclared` ELŐSZÖR a
  // függvény PARAMÉTERLISTÁJÁBAN fordul elő, tehát a nyers `indexOf` sorrendje hamis pirosat
  // ad egy hibátlan kapun. (Mérve: pontosan ez történt az őr első változatával.)
  const wm = pol.search(/if\s*\(\s*p\.watermarked\s*\)/);
  const rights = pol.search(/if\s*\(\s*rightsDeclared\s*\)/);
  measured++;
  check(wm !== -1 && rights !== -1, "a kapu mindkét ELÁGAZÁST tartalmazza", `wm=${wm} rights=${rights}`);
  check(
    wm !== -1 && rights !== -1 && wm < rights,
    "⛔ a vízjel-ellenőrzés a nyilatkozat ELŐTT fut — ettől FELTÉTLEN a kizárás",
    `watermarked@${wm} vs rightsDeclared@${rights}`,
  );
}

if (measured === 0) {
  fails.push("NULLA valódi mérés futott — üres halmazon mért zöld HAMIS ZÖLD, ezért ez bukás");
}
console.log(
  `\n${fails.length ? "❌" : "✅"} watermark-gate-check: ${pass} állítás zöld, ${fails.length} piros ` +
    `· ${measured} valódi mérés`,
);
for (const f of fails) console.error(`  ✗ ${f}`);
process.exit(fails.length ? 1 : 0);
