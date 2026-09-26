// KÉPMINŐSÉG A TELJES KÉPEN — determinisztikus, AI nélkül (2026-09-26, Elek FK-009).
//
// MIÉRT: a Laguna Panzió Google Places-fotója 92 pontot kapott a látástól („karakterisztikus
// épület tiszta égbolttal”), és 12 stílus nyitóképe lett — miközben a kép ALSÓ 40 %-a egy
// posterizált sötétkék folt (mérve: az alsó félben a pixelek 85 %-a L<40, átlag-luma 23).
// A modell az eget nézte, a talajt nem; a pontszám a TÁRGYRÓL szólt, nem a KÉPRŐL. A
// nyitókép viszont a lap tetején, teljes szélességben áll: egy fél-fekete kép ott a wow
// ellentéte, bármi is van a felső felén.
//
// Ez a réteg NEM a tárgyat ítéli (az a látásé), hanem azt, amit egy pixel-statisztika
// biztosan tud: van-e a képnek nagy, sötét, lapos foltja; sötét-e az egész; ~és mekkora.
// A levonás a gyorsítótárazott verdiktbe kerül (heroPick.ts), így MINDEN olvasó — a
// generálás, az operátori újrarendezés, az élesítés, a tenant-szerkesztő — ugyanazt a
// már-levont pontszámot látja, és a sorrend nem billen vissza egy olyan úton, ami ezt a
// modult nem hívja.

import sharp from "sharp";

export interface PhotoHealth {
  /** Pontlevonás a nyitókép-alkalmasságból (0 = egészséges). */
  readonly penalty: number;
  /** Egy magyar félmondat, amit a verdikt indoklása mögé fűzünk — vagy null. */
  readonly reason: string | null;
  readonly longEdge: number;
  /** A sötét (L<40) pixelek aránya a felső / alsó félben, százalék. */
  readonly darkTopPct: number;
  readonly darkBottomPct: number;
  /** Átlagos világosság (0–255) a felső / alsó félben. */
  readonly meanTop: number;
  readonly meanBottom: number;
}

/** A gyorsítótárazott indoklásban ez a jel mutatja, hogy a levonás már megtörtént. */
export const HEALTH_MARK = "[képminőség]";

/** Egy fél akkor „kiesett”, ha a pixelek ennyi %-a sötét ÉS az átlaga is sötét. */
const BLACKOUT_DARK_PCT = 60;
const BLACKOUT_MEAN_L = 45;
const BLACKOUT_PENALTY = 45;
/** Az egész kép sötét (éjszakai, alulexponált) — nyitóképnek gyenge, de nem kizárt. */
const DIM_MEAN_L = 50;
const DIM_PENALTY = 15;

/** A mérés kicsinyített képen fut: a statisztikának 320 px is elég, a hálózatnak nem. */
const MEASURE_WIDTH = 320;
const DARK_L = 40;

/** Pixel-statisztika egy képfájlból. Dob, ha a fájl nem kép. */
export async function measurePhotoHealthFromBuffer(buf: Buffer): Promise<PhotoHealth> {
  const meta = await sharp(buf).metadata();
  const longEdge = Math.max(meta.width ?? 0, meta.height ?? 0);
  const { data, info } = await sharp(buf)
    .resize({ width: MEASURE_WIDTH, withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const half = Math.floor(info.height / 2);
  const stats = (y0: number, y1: number): { dark: number; mean: number } => {
    let dark = 0;
    let sum = 0;
    let n = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < info.width; x++) {
        const o = (y * info.width + x) * 3;
        const L = 0.299 * data[o]! + 0.587 * data[o + 1]! + 0.114 * data[o + 2]!;
        sum += L;
        n++;
        if (L < DARK_L) dark++;
      }
    }
    return n ? { dark: Math.round((100 * dark) / n), mean: Math.round(sum / n) } : { dark: 0, mean: 0 };
  };
  const top = stats(0, half);
  const bottom = stats(half, info.height);
  let penalty = 0;
  const reasons: string[] = [];
  const blackout = (s: { dark: number; mean: number }): boolean => s.dark >= BLACKOUT_DARK_PCT && s.mean < BLACKOUT_MEAN_L;
  if (blackout(bottom) || blackout(top)) {
    penalty += BLACKOUT_PENALTY;
    reasons.push(
      `a kép ${blackout(bottom) ? "alsó" : "felső"} fele sötét, lapos folt (${blackout(bottom) ? bottom.dark : top.dark} % fekete)`,
    );
  } else if ((top.mean + bottom.mean) / 2 < DIM_MEAN_L) {
    penalty += DIM_PENALTY;
    reasons.push("az egész kép sötét, alulexponált");
  }
  return {
    penalty,
    reason: reasons.length ? `${HEALTH_MARK} ${reasons.join("; ")}` : null,
    longEdge,
    darkTopPct: top.dark,
    darkBottomPct: bottom.dark,
    meanTop: top.mean,
    meanBottom: bottom.mean,
  };
}

/**
 * URL → egészség, vagy null, ha nem tölthető le / nem kép. A hiány NEM levonás: a saját
 * kimaradásunk (hálózat, 404) nem lelet a fotóról — ugyanaz az elv, mint a látásnál.
 */
export async function measurePhotoHealth(url: string): Promise<PhotoHealth | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "image/*,*/*;q=0.8",
      },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return null;
    return await measurePhotoHealthFromBuffer(buf);
  } catch {
    return null;
  }
}

/** A levonás alkalmazása egy pontszámra — egy helyen, hogy a friss és a tárolt verdikt egyformán számoljon. */
export function applyHealth(score: number, health: PhotoHealth | null): number {
  if (!health || !health.penalty) return score;
  return Math.max(0, score - health.penalty);
}
