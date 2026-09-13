// A HALOTT KÉP NEM KÉP — a generálás fotó-élőség szűrője.
//
// ⛔ MÉRT HIBA (2026-09-13): a tárolt portál-fotó-URL elrohad. A hovamenjek.hu átírta a
// fájlneveit (73 tárolt URL-ből 59 halott, 11 leadet érint), a balaton.hu pedig a SAJÁT
// lapján hivatkozik 404-es i.szalas.hu képekre. Ezek végigmentek a láncon: az ELEK-TESZT
// lead 13 fotójából 11 halott volt, és a NYITÓKÉP is közülük került ki — a leadnek
// kiküldött lapon törött-kép ikon, az MMS-előnézet pedig egyáltalán nem állt elő
// (Elek FK-004 H1).
//
// KÉT RÉTEG, KÉT MUNKA (nem ugyanaz):
//  · ADR-0134 kiküldés-kapu: a KISZÁLLÍTOTT artefaktumot méri, és megtagadja a jóváhagyást
//    /kiküldést, ha törött. Az AJTÓBAN fog.
//  · ez a modul: ilyen lap ELŐ SE ÁLLJON. A halott fotó ki sem kerül a halmazba, tehát nem
//    lehet belőle nyitókép, galéria-csempe, JSON-LD `image`, se levél-illusztráció.
//
// ⚠️ CSAK a VÉGLEGES hiba ejt. Egy 429/hálózati döccenés miatt fotót dobni fordítva
// ugyanakkora kár (üres galéria egy élő szállásnak), és a portál épp a mi kérés-sorozatunkra
// ad 429-et. A múlandót meghagyjuk — arra ott a kiküldés-kapu, ami a kiszállított lapot méri.

import { probeImageRefs, isPermanentFailure, type BrokenImage } from "../outreach/mockPhotoHealth.js";

/** Amit a szűrő lát a fotóból — a hívó bármilyen gazdagabb alakot adhat. */
export interface LivenessCandidate {
  readonly url: string;
}

export interface LivenessOutcome<T extends LivenessCandidate> {
  readonly kept: T[];
  /** Amit VÉGLEGESEN halottként ejtettünk — a napló megnevezi, mit és miért. */
  readonly dropped: { photo: T; reason: string }[];
}

/**
 * A DÖNTÉS, mérés nélkül: mit ejtünk a mért törött-listából. Tiszta függvény, hogy
 * őrizhető legyen — a hálózat a `dropDeadPhotos`-ban van, a SZABÁLY itt.
 */
export function keepLivePhotos<T extends LivenessCandidate>(
  photos: readonly T[],
  broken: readonly BrokenImage[],
): LivenessOutcome<T> {
  const gone = new Map<string, string>();
  for (const b of broken) {
    // Múlandó hiba (429, hálózat, upstream) NEM ejt — csak ami bizonyítottan nincs meg.
    if (isPermanentFailure(b.failure)) gone.set(b.url, b.reason);
  }
  const kept: T[] = [];
  const dropped: { photo: T; reason: string }[] = [];
  for (const p of photos) {
    const reason = gone.get(p.url);
    if (reason === undefined) kept.push(p);
    else dropped.push({ photo: p, reason });
  }
  return { kept, dropped };
}

/**
 * Megméri és kiszűri a véglegesen halott fotókat. A mérés UGYANAZZAL a `fetchPhoto`-val
 * (és cache-sel) megy, amit a kiküldés-kapu és a kurátor csempéje használ — egy képernyőn
 * egy igazság. Hívási hely: a fotó-halmaz eldőlésének EGYETLEN pontja
 * (`resolveGatedPhotos`), a FIZETŐS vision-pontozás ELŐTT — nem fizetünk azért, hogy egy
 * nem létező képet osztályozzunk.
 */
export async function dropDeadPhotos<T extends LivenessCandidate>(
  photos: readonly T[],
  lang = "hu",
): Promise<LivenessOutcome<T>> {
  if (!photos.length) return { kept: [], dropped: [] };
  const broken = await probeImageRefs(
    photos.map((p) => ({ url: p.url, where: "img" as const, refs: 1 })),
    lang,
  ).catch((e) => {
    // A mérés bukása nem ölhet meg egy generálást — a meglévő halmaz így is válasz.
    console.warn(`  ⚠️ fotó-élőség ellenőrzés kihagyva: ${(e as Error).message}`);
    return [] as BrokenImage[];
  });
  return keepLivePhotos(photos, broken);
}
