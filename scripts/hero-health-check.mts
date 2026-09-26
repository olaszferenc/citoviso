// KÉPMINŐSÉG-ŐR — a nyitókép-választás a TELJES képet nézi, nem csak a tárgyát.
//
//   npx tsx scripts/hero-health-check.mts
//
// MÉRT HIBA (2026-09-26, Elek FK-009): a Laguna Panzió Places-fotója 92 pontot kapott a
// látástól, és 12 stílus nyitóképe lett, miközben az alsó 40 %-a posterizált sötétkék
// folt (az alsó fél pixeleinek 85 %-a fekete). A modell az eget ítélte, a talajt nem.
//
// Az őr SZINTETIKUS képeken méri a photoHealth.ts szabályát — a hálózattól és a Google
// fotó-URL-ek rothadásától függetlenül —, és azt, hogy a levonás a sorrendbe is átmegy:
//   ① egészséges kép: 0 levonás;
//   ② alsó fele fekete: levonás, az indoklásban a jel;
//   ③ felső fele fekete: ugyanaz (nem csak az „alsó fél” a szabály);
//   ④ egészében sötét, de nem lapos: a kisebb „alulexponált” levonás;
//   ⑤ orderPhotosForHero: két azonos látás-pontszámú képből a fél-fekete hátra kerül;
//   ⑥ NEGATÍV KONTROLL: az őr a saját szabályát pirosra tudja fordítani — a levonás
//      nélküli pontszámmal a fél-fekete kép maradna elöl (bizonyítja, hogy ⑤ nem véletlen).
//   ⑦ a fél-fekete kép pontszáma a HERO_MIN_SCORE alá esik egy 92-ről (kurátor-sorba megy).
import sharp from "sharp";
import { applyHealth, HEALTH_MARK, measurePhotoHealthFromBuffer } from "../src/generator/photoHealth.js";
import { HERO_MIN_SCORE, orderPhotosForHero, type HeroScore } from "../src/generator/heroPick.js";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

/** Egy W×H-s kép: felső fél `top` színnel, alsó fél `bottom` színnel, enyhe zajjal (nem lapos). */
async function twoBand(top: [number, number, number], bottom: [number, number, number], noise = 18): Promise<Buffer> {
  const W = 640;
  const H = 480;
  const raw = Buffer.alloc(W * H * 3);
  let seed = 7;
  const rnd = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed / 0x7fffffff - 0.5) * noise;
  };
  for (let y = 0; y < H; y++) {
    const c = y < H / 2 ? top : bottom;
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      raw[o] = Math.max(0, Math.min(255, c[0] + rnd()));
      raw[o + 1] = Math.max(0, Math.min(255, c[1] + rnd()));
      raw[o + 2] = Math.max(0, Math.min(255, c[2] + rnd()));
    }
  }
  return sharp(raw, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
}

console.log("KÉPMINŐSÉG-ŐR — a nyitókép a teljes képről szól");

const healthy = await measurePhotoHealthFromBuffer(await twoBand([140, 170, 210], [110, 130, 70]));
check("① egészséges kép: 0 levonás", healthy.penalty === 0 && healthy.reason === null, healthy);

const bottomBlack = await measurePhotoHealthFromBuffer(await twoBand([140, 170, 210], [12, 16, 30]));
check("② alsó fele fekete: levonás", bottomBlack.penalty >= 40, bottomBlack);
check("② …és az indoklásban a jel", !!bottomBlack.reason && bottomBlack.reason.includes(HEALTH_MARK), bottomBlack.reason);

const topBlack = await measurePhotoHealthFromBuffer(await twoBand([10, 12, 20], [150, 160, 120]));
check("③ felső fele fekete: ugyanaz a levonás", topBlack.penalty === bottomBlack.penalty, topBlack);

const dim = await measurePhotoHealthFromBuffer(await twoBand([55, 50, 60], [48, 45, 55], 30));
check("④ egészében sötét, de nem lapos: kisebb levonás", dim.penalty > 0 && dim.penalty < bottomBlack.penalty, dim);

// ⑤ a sorrend: két 92-es, az egyik fél-fekete
const photos = [
  { url: "https://x/black-bottom.jpg", longEdge: 1200 },
  { url: "https://x/healthy.jpg", longEdge: 1200 },
];
const withPenalty = new Map<string, HeroScore>([
  ["https://x/black-bottom.jpg", { subject: "exterior", score: applyHealth(92, bottomBlack), reason: `x · ${bottomBlack.reason}`, watermarked: false }],
  ["https://x/healthy.jpg", { subject: "exterior", score: applyHealth(92, healthy), reason: "y", watermarked: false }],
]);
const ordered = orderPhotosForHero(photos, withPenalty);
check("⑤ a fél-fekete kép hátra kerül, az egészséges lesz a hero", ordered[0]!.url === "https://x/healthy.jpg", ordered.map((p) => p.url));

// ⑥ negatív kontroll: levonás nélkül a fél-fekete maradna elöl (a portál-sorrend dönt)
const without = new Map<string, HeroScore>([
  ["https://x/black-bottom.jpg", { subject: "exterior", score: 92, reason: "x", watermarked: false }],
  ["https://x/healthy.jpg", { subject: "exterior", score: 92, reason: "y", watermarked: false }],
]);
check("⑥ NEGATÍV KONTROLL: levonás nélkül a fél-fekete kép maradna a hero", orderPhotosForHero(photos, without)[0]!.url === "https://x/black-bottom.jpg");

check(`⑦ a fél-fekete kép 92-ről a kurátor-küszöb (${HERO_MIN_SCORE}) alá esik`, applyHealth(92, bottomBlack) < HERO_MIN_SCORE, applyHealth(92, bottomBlack));

console.log(failures ? `\n✗ hero-health-check: ${failures} bukás` : "\n✓ hero-health-check: a nyitókép a teljes képről szól");
process.exit(failures ? 1 : 0);
