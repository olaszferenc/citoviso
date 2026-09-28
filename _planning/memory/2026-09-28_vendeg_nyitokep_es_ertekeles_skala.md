# Vendég-oldal: a tulaj Nyitóképe a hős, és az értékelés skálája a forrásé (2026-09-28 este)

SUB-szál (koordinátor: `citded06a5f`) · brief: `~/rc-briefs/vendeg-nyitokep-es-ertekeles-skala.md` ·
leletek forrása: `2026-09-28_egy_szallasos_telefonos_kor_myrna_haus.md` (Myrna Haus, `myrna-haus`).

## 1. Nyitókép — mi volt a baj

`heroPhoto(data, offset)` (templateKit, 2026-09-09, `ed5d12ca`): a nyitókép sablononként MÁS
indexű volt (arch-frames 1, wordmark-grow 2, tilted-gallery 0), mert akkor a fotólista a portál
nyers sorrendje volt. Azóta a sorrend SZERKESZTŐI döntés — vision-rangsor (`heroPick.ts`),
operátori jelölés (`heroOverride.ts`), élő lapon a tulaj „Nyitókép”-e —, és mind a hármat a
`photos[0]` hordozza. Az eltolás mindhármat felülírta: Myrna Haus (arch-frames) hőse a 2. feltöltés
volt, az 1. sehol nem látszott. Javítás: `heroPhoto(d)` = `photos[0]`, minden sablonon.

Mérés (új őr: `scripts/cover-photo-check.mts`, élő fázis, 6 fotó, asztali + 390 px, böngészőben):

| sablon | előtte hős | utána hős | látható fotó (6-ból) |
|---|---|---|---|
| 15 sablon | 0 | 0 | 6/6 |
| organic, claymorphism | 0 | 0 | 4/6 — a galéria `slice(0, 4)` (szándékos rács) |
| arch-frames | **1** | 0 | 3/6 → 4/6 — 4 képhely a sablonban (hős, történet, „A ház”, sáv) |
| wordmark-grow | **2** | 0 | 2/6 → 3/6 — 3 képhely (hős, történet, „Képek” = 1 kép) |

Átugrott fotó (egy k. hiányzik, miközben egy későbbi látszik) egyik sablonon sincs. A lead-fotók
és a tulaj-feltöltések UGYANAZON a `photos` listán mennek, tehát a hiba mindkettőt érintette.
Myrna Haus újrarenderelve: hős = `f135706e93662176` (Nyitókép), 0–3. a lapon, a 4. csak
szobakép-kölcsönként („Minta — Kerti stúdió”), az 5. (`0a1c3220025d283f`) sehol — sablon-korlát.

## 2. Skála — mi volt a baj

„4,4 / 10”: az arch-frames, wordmark-grow és tilted-gallery BEÉGETVE hordozta a „/ 10”-et
(a referencia-tervük tízes foglalóportálról jött), a brutalism és a kompozíciós vélemény-blokk
(`primitives.ts`) a „/ 5”-öt. A `SiteData.rating` ma MINDEN ágon Google-átlag (generateEngine a
Places-ből, `tenant/editor.ts` a `site_place_rating`-ből). Javítás a forrásnál: `rating.scale`
(opcionális; hiánya = Google, 5) + `src/engine/rating.ts` (`ratingScale`, `ratingOnFiveStars`);
az öt hely, a JSON-LD `bestRating` és a `honestStarCount` ebből olvas. A trió csillagsora is
`honestStarCount` lett (eddig mindig 5 csillag volt, a 4,4 mellett is — §B.17).
Őr: `scripts/rating-scale-check.mts` — Google-alany (4,4) és tízes forrás (8,7/10), 19 sablon,
két piros önteszt (a „/ 10” vissza · a „/ 5” tízes forráson).

## Leletek a hatókörön kívül (koordinátornak jelezve, nem javítva)

- **Élő lapon „Minta —” szobakép:** a trió (arch-frames, wordmark-grow, tilted-gallery) a
  `roomsForMock()`-ot fázistól függetlenül hívja → élő lapon a fotó nélküli szoba egy galéria-képet
  kap „Minta — <szoba>” alt-tal (Myrna: mind a 3 szoba), szoba nélkül pedig `sampleRooms()`
  minta-szobák kerülnének élő lapra. A többi 16 sablon `phase === "mock"`-hoz köti.
- **A trió csillagsora láthatatlan:** az `.a-stars` SVG-jének nincs mérete (0×0 px, mérve) — a
  csillag sosem látszott, a javított darabszám sem látszik.
- **Kinézeti kérdés:** arch-frames (4) és wordmark-grow (3) képhelye kevesebb, mint amennyit egy
  tulaj feltölt; organic/claymorphism 4-re vág. Galéria bővítése = §2b-kapu.
- **Feszültség:** az eltolás a tulaj 2026-09-09-es panaszára született („a Kati Villa három mockja
  ugyanúgy kezdődik”). A fejléc-különbség megmaradt; a képcsere most megszűnt — ha ugyanarra a
  leadre több sablon mockja készül egymás mellé, azonos nyitóképpel nyitnak.

## Döntési anyag (gitignore-olt, a fában marad)

`elek/runs/cover-scale-2026-09-28/` — `asztali-1-nyitokep.png`, `mobil-1-nyitokep.png`,
`asztali-2-ertekeles.png`, `mobil-2-ertekeles.png` (Myrna Haus, újrarenderelve).

## Módosított fájlok

`src/engine/templateKit.ts` · `src/engine/rating.ts` (új) · `src/engine/recipe.ts` · `src/engine/seo.ts` ·
`src/engine/primitives.ts` · `src/engine/templates/{archFrames,wordmarkGrow,tiltedGallery,brutalism}.ts` ·
`scripts/cover-photo-check.mts` (új) · `scripts/rating-scale-check.mts` (új) · `hooks/pre-commit`
