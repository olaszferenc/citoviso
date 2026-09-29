# A trió: élő lapon nincs „Minta” szobakép + a csillagsor látszik (2026-09-29)

SUB-szál (koordinátor: `citded06a5f`) · brief: `~/rc-briefs/trio-minta-szobakep-es-csillagsor.md` ·
a leletek forrása: `2026-09-28_vendeg_nyitokep_es_ertekeles_skala.md` („Leletek a hatókörön kívül”).
Tulaj (a koordinátoron át): „C, oszd ki” · „D, ok menjen”. Hibajavítás/mintakövetés → §2b-kivétel naplózva.

## C — §B.17: „Minta” szobakép élő lapon

**Mi volt:** a trió (arch-frames, wordmark-grow, tilted-gallery) fázistól függetlenül a
`roomsForMock()`-ot hívta → élő lapon a fotó nélküli szoba egy galéria-képet kapott
„Minta — <szoba>” alt-tal (Myrna Haus: mind a 3 szoba), szoba nélkül a `sampleRooms()`
minta-szobái kerültek volna élő lapra. A többi 16 sablon ugyanezt a
`data.rooms?.length ? data.rooms : phase === "mock" ? sampleRooms(data) : null` sorral, 9 példányban írta.

**Javítás — egy predikátum:** `roomsFor(d, phase)` (`src/engine/templateKit.ts`): mock → `roomsForMock(d)`
(jelölt kölcsönkép / számozott minta, változatlan); élő → a valós szobák, ahogy vannak, vagy `null`
(nincs szobák-szekció). Mind a 12 natív-szobás sablon ezt hívja (9 + a trió); a trió élőn szoba nélkül
a szekciót ÉS a nav „Szobák” linkjét is elhagyja. Élőn a fotó nélküli szoba a többi sablon mintáját
követi: `photoFill()` ikon-panel, „Részletek” jelvény nélkül (a `roomHint` csak fotós szobán jár;
a kártya kattintható marad). Mockon a korábbi viselkedés bájtra ugyanaz (az `render.ts` mock-ágán a
`data.rooms` már `roomsForMock`-olt, a `roomsForMock` idempotens).

## D — a trió csillagsora 0×0 px volt

A `starIcon()` csak `viewBox`-os SVG; egy `inline-flex` sorban méret nélkül 0×0 px. A többi sablon
(`.au-stars svg{width:17px…}` stb.) méretezi — a trió nem. Javítás: `.a-stars/.w-stars/.t-stars svg{20×20}`.
A darabszám a skála-javítás `honestStarCount`-ja (4,4 → 4).

## Mérés

| | előtte | utána |
|---|---|---|
| Myrna Haus (élő, arch-frames), „Minta” alt | 3 | 0 |
| csillag-SVG mérete, 1280 és 390 px | 4 × 0×0 | 4 × 20×20 |

Új őr: `scripts/live-sample-room-check.mts` (pre-commit-be kötve) — 19 sablon × {élő, mock} × {fotó
nélküli szobák, szoba nélkül}, mindkét irányban ítél (élőn 0 „Minta”/minta-szoba/halott `#cit-rooms`;
mockon a jelölt minta MARAD), + a trió csillaga böngészőben, 1280 és 390 px. 82 ítélet.
Negatív kontroll: a javítás ELŐTTI kódon pontosan a trió bukik (15 lelet: 9 „Minta”/minta-szoba +
6 láthatatlan csillagsor); `--self-test` 3 visszarontást fog meg. Mellette zöld: rating-scale,
cover-photo, rooms-all-shown, module-render, mock-booking-sample, design-token-lint, i18n-lint, tsc.

## Megfigyelés (a hatókörön kívül, a koordinátornak)

- **Myrna Haus élő lapja most 3 nagy, üres ikon-boltívet mutat** a szobáknál (a „Minta” kép helyett).
  Igaz, de soványan néz ki: a tulajnak szobaképet kellene feltöltenie — vagy kinézeti döntés (§2b),
  hogy a fotó nélküli kártya kisebb legyen. Nem nyúltam hozzá.
- **A csillagszám-szabály 10 másolatban él** (`const starCount = … Math.round(data.rating.value)` —
  aurora, artdeco, cinematic, claymorphism, fullbleed, horizontal, organic, scrapbook, transit, watercolor),
  nem a skála-tudatos `honestStarCount`-ból. Mérve (élő, 8,7 / 10 forrás): fullbleed, horizontal,
  cinematic, transit, artdeco, scrapbook, aurora **5 csillagot** rajzol (helyes: 4). Ma minden értékelés
  Google-ötös, tehát élő hatása most nincs; a rating-scale-check azért nem fogja, mert a 4,4 → 4 esetet
  csak a `honestStarCount`-on méri, a sablonok saját sorát nem. Nem javítottam (hatókörön kívül).
- A galéria-képszámhoz nem nyúltam (párhuzamos szál). A tilted-gallery hangulat-csoportjának kezdő-
  indexe élőn szoba nélkül `rooms.length + 2` helyett `0 + 2` (nincs szoba, amit kerülni kellene).

## Döntési anyag (gitignore-olt, a fában marad)

`elek/runs/trio-minta-csillag-2026-09-29/` — `elotte-{asztali,mobil}-{szobak,ertekeles}.png`,
`utana-{asztali,mobil}-{szobak,ertekeles}.png` (Myrna Haus, újrarenderelve),
`utana-{wordmark-grow,tilted-gallery}-{asztali,mobil}-{szobak,ertekeles}.png` (szintetikus élő alany).

## Módosított fájlok

`src/engine/templateKit.ts` · `src/engine/templates/{archFrames,wordmarkGrow,tiltedGallery,aurora,artdeco,cinematic,claymorphism,horizontal,organic,scrapbook,transit,watercolor}.ts` ·
`scripts/live-sample-room-check.mts` (új) · `hooks/pre-commit`
