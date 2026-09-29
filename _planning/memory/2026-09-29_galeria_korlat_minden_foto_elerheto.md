# Galéria-korlát: a tulaj minden fotója elérhető, a galéria a még nem látott képekkel indul (2026-09-29)

SUB-szál (koordinátor: `citded06a5f`) · brief: `~/rc-briefs/galeria-korlat-sablonok.md` · döntés: ADR-XXXX ·
kontraktus: `assets/design-refs/tenant-site/gallery-cap/` · őr: `scripts/gallery-reach-check.mts`.

## Mit okozott (valódi adat, élő render, 1280 + 390 px)

- Kemences Vendégház (ÉLŐBEN wordmark-grow, 12 fotó): 3 igazi képhely (+2 „Minta” szobakártya-kölcsön); a belső
  képek (#10–#12) egyik sablonon sem. Myrna Haus (6): organic/clay 4/6, a trió 5/6 (részben csak szobakártyán).
- A közös nagyító csak a galéria-slot `<img>`-ein lapoz → a hiányzó fotók ott sem voltak elérhetők.

## §2b terv-kör

4 sablon × 3 változat, a VALÓDI renderelt lapba illesztve (Kemences, 12 fotó), „Ma” füllel, méretváltóval.
Két kör javítás a tulaj/koordinátor jelzésére:
- **„Az asztalit nem rendereli megfelelően”** — telefonon az 1280-as iframe flex-elemként 390-re ZSUGORODOTT (a
  skála után 118 px), vagyis az „Asztali” fül a mobil elrendezést mutatta. Az első ellenőrzésem csak asztali
  böngészőben mérte a méretváltót. Javítás `flex:none`; a próba azóta telefonos kontextusban (isMobile) is fut.
- A galéria kezdőképe: a tulaj „a még nem látott képekkel” kérte → a generátor böngészőben mérte a „látott” halmazt.

Döntés: wordmark-grow A (kártyapakli), organic C (blob-sáv), claymorphism C (4 + helyben kinyíló); **arch-frames
nyitott**.

## Megvalósítás

- `templateKit.ts`: `galleryOrder(photos, elsewhere)` — a „látott” halmaz a többi szakasz markupjából (nem fix index;
  a trió „Minta” kivezetése a mérés közben változtatta meg, élőn a wordmark-grow most #3-mal indul, nem #6-tal);
  `galleryPager(d, n)` — `hidden`-nel születik, csak a runtime veszi le.
- A három sablon a galériát a többi szakasz UTÁN építi (`galleryOf(galleryOrder(…))`).
- Runtime: `mountGalleryStrip` / `mountGalleryDeck` / `mountGalleryExpand` a `mountGallery` végén; `[data-on]`
  kapcsolja a JS-es nézetet, így no-JS és runtime nélkül is minden fotó elérhető, halott vezérlő nélkül.
- i18n: „Összes fotó ({n})”, „Kevesebb fotó” (katalógus frissítve).

## Mérés közben talált saját hibák

- Az első őr-futás 4 bukása: a lapozót CSAK a runtime CSS rejtette → runtime nélküli renderen halott nyíl. Javítás:
  `hidden` attribútum; a no-JS próba azóta a valós esetet is méri (runtime-CSS + kikapcsolt JS) és a nyerset is.
- A pakli kilógó kártyái a 390-es telefonon **417 px-re szélesítették a layout viewportot** (`innerWidth`, nem
  `scrollWidth` a mérce). Javítás: szélesség-tartalék + `overflow-x:clip`; az őrbe került (390 + 360 px), negatív
  kontrollal (a visszarontás 417/387-et ad).
- A commit első próbáján a `guest-mobile-check` ⑧ bukott: a pakli forgatott kilógó kártyájának DOBOZA 397 px-ig ért
  390-en (a clip levágta, de a kártya kilógott a paklijából). Javítás: 72 px tartalék; a saját őröm azóta a dobozt
  is méri, negatív kontrollal. ⚠️ A háttér-commitot `| tail`-lel indítottam — az exit 0 a tail-é volt, a commit
  NEM jött létre; a `git log` árulta el.
- Az önteszt először ÖSSZEOMLOTT ítélet helyett (a tiltott „›” nyílra kattintott) — az őr most ítél.

## Módosított fájlok

`src/engine/templateKit.ts` · `src/engine/templates/{wordmarkGrow,organic,claymorphism}.ts` ·
`assets/runtime/cit-runtime.js` · `assets/runtime/cit-modules.css` · `src/i18n/catalog.json` ·
`scripts/gallery-reach-check.mts` (új) · `hooks/pre-commit` · `assets/design-refs/tenant-site/gallery-cap/` (új) ·
`_planning/decisions/XXXX-a-galeria-minden-fotot-elerhetove-teszi.md` (új)

## Nyitott

- **arch-frames** — a tulaj döntésére vár (ív-kolonnád / lapozható ív-sáv / „+9 fotó” ív); a mockok a szál fájában:
  `elek/runs/galeria-korlat/2-mockok/galeria-arch-frames.html`.
