# 2026-09-23 — A Felszereltség és a szobák felszereltsége KÉT KÜLÖN LISTA (ADR-0209)

**Mandátum:** `~/rc-briefs/amenities-hidden-by-rooms-brief.md` (a szoba-szerkesztő szál GÉPI
munkaátadása; ADR-0192 ⑧.4). Fa: `~/wt/felszkapu`. Élesítés nem volt feladat.

## Mit mértem
- ⑧.4 reprodukálva eldobható fixture-rel (közös DB, `finally` takarít), POZITÍV kontrollal:
  ha minden ház-szintű tétel a szobáknál is ott van, a `moduleContentFor().data.amenities` eltűnik;
  a Szobák lekapcsolása visszahozza.
- ⛔ **Új lelet:** a tulaj nem „nem tud róla”, hanem HAMISAT tud meg — az ADR-0194 sora
  („kifizette, de üres, ezért a vendég ma nem látja”) egy KITÖLTÖTT listára gyullad ki.
- Részleges átfedésnél a lista némán fogyatkozott.
- A katalógusból csak 26/70 tétel választható a szobánál is (`scope:"both"`); a szoba-szerkesztő
  a ház-szintű tételt „az egész szállásra” jelöléssel, nem kapcsolhatóan mutatja — a kiürülés
  csak a „előbb szoba, aztán ház” sorrendnél áll elő.
- A szoba felugrója CSAK a saját tételeit listázza (`templateKit.ts roomDetails`), a ház-szintűt nem örökli.

## Mi történt
1. §2b kör: három tájékoztató-változat (A: tény · B: tételes · C: + „Kiveszem a szobáknál”),
   mobil+asztali, a VALÓDI `moduleSettingsSection("amenities")` markuppal, szimulátorral,
   Playwrighttal végigkattintva. A C egy HAMIS mondatát („a szobán nem tűnnek el”) küldés előtt javítottam.
2. ⛔ A tulaj rákérdezett: *„nem két külön szálnak kéne lennie? … generáltunk hibát, úgyhogy nincs is”*.
   Igaza volt: a brief premisszáját („a kihúzás helyes, csak szólni kell”) átvettem ahelyett,
   hogy megkérdeztem volna, a szabály a tulaj modelljét követi-e. A változatok elvetve.
3. Tulajdonosi döntés („ok mehet”): **a szűrő kivéve** (`src/tenant/editor.ts`, rooms-ág vége).
4. Őr: `scripts/amenities-house-list-check.mts` (+ pre-commit), negatív kontroll + `--self-test`
   (a régi szűrőn pontosan 3 bukás). Szomszédos őrök zöldek (paid-empty, module-render,
   amenity-picker, module-config, module-slot).
5. Előtte–utána kép a vendég oldalán (editorial sablon): az „Amit kínálunk” szakasz a régi
   szabállyal hiányzik, az újjal ott van.

## Mérési csapdák (saját)
- `moduleContentFor()` burkolót ad (`{data,…}`) — az első probe a burkolón mért, és HAMIS ZÖLDET
  adott a „eltűnik” lépésre; a pozitív kontroll fogta meg (a paid-empty README is figyelmeztet rá).
- Screenshot: `clip` fullPage nélkül a viewportra metsz; `fullPage`+2× scale hosszú lapon némán
  csonkul; `locator.screenshot({clip})` figyelmen kívül hagyja a magasságot; `boundingBox()` görgetés
  után nézet-relatív → lap-koordinátát `getBoundingClientRect().top + scrollY`-ból.

## Módosított fájlok
- `src/tenant/editor.ts` · `scripts/amenities-house-list-check.mts` (új) · `hooks/pre-commit`
- `_planning/DECISIONS.md` (ADR-0209 + ADR-0059 döntés 2 pontosítás + ADR-0192 ⑧.4 / ADR-0196 ⑥ lezárás)

## Nyitva (nem ez a szál)
- ADR-0192 ⑧.3 (mock fizetőoldal „Ft/év” egyszeri díjra) · ⑧.5 (az előnézet ÍR).
- KB: a `admin-modules-amenities` szövege („egy tétel csak az egyik helyen választható”) a
  szerkesztőről továbbra is igaz — nem módosítottam.
