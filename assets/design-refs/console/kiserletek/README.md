# Riport › Kísérletek — JÓVÁHAGYOTT TERV (2026-11-22)

Tulaj-döntés (2026-11-22, a koordinátoron át, `citb64f0ed0`): a **C** terv („összefoglaló”:
dimenziónként egy ítélet-sor, felül KPI-k, lenyitva a teljes tábla, a tetején a hétfői sor).
Az A (táblák) és a B (kártyák) változat csak a döntés anyaga volt, NEM köt.

Fájlok: `terv-C.html` (a döntéskor látott mock, MINTA-ADATTAL; mobil/asztali váltóval),
`terv-C-mobil.png`, `terv-C-asztali.png`. Háttér: ADR-0462 (kísérlet-motor), brief
`kiserlet-motor-20261121.md`.

## Mit KÖT a terv (elvárt viselkedés, nem stílus-javaslat)

Hely: a Megkeresés-riport saját füle, **„Kísérletek”** (`GET /report/experiments`), a fülsorban és
a bal menü Riport-csoportjában.

1. **Hétfői sor a panel tetején** („A héten”): az előző LEZÁRT budapesti hét (hétfő 0:00 → hétfő
   0:00) összegzése, ezért hétfő reggel vált. Tartalom: hány változat ment ki a héten, hány
   dimenzióban; a legjobb nem-kontroll változat a 72 órás link-nyitás szerint, a mai levél azonos
   értéke mellett, és annak esélye (P), hogy jobb a mai levélnél; a kikapcsolt változatok száma.
   Adat nélkül kimondja, hogy a héten nem futott kísérlet.
2. **Négy KPI** (mobilon 2×2): futó változat (bekapcsolt, minden dimenzió) · kísérleti levél
   összesen · levélnyitás 24 órán belül (minden címkézett levél, ≥24 órás) · mai keret (levél).
3. **Dimenziónként egy ítélet-sor** (összecsukva), sorrend: Tárgy · Első sor · Feladó · Törzs ·
   Kép · Ár-sor (a 2026-11-22-i új dimenzió, a terv után került be, ugyanígy jelenik meg).
   Ítélet:
   - legfeljebb egy futó változat → „Csak a mai levél fut — nincs mit összevetni.”;
   - egy nem-kontroll változat vezet (a futók közül a legmagasabb 72 órás link-nyitás, ≥30 érett
     levéllel) → „„X” vezet: a% vs. mai b%”, zöld bal szegéllyel;
   - különben → „A mai levél tartja magát (b%)”, navy szegéllyel.
   Jobb oldalon: „N fut”; az Első sor dimenziónál mellette: „csak a dobozos levélen”, az Ár-sornál:
   „az ár-mondat csak a személyes levélben” (koordinátor, 2026-11-22).
4. **Lenyitva a teljes tábla**: Változat (+ a szövege vagy leírása) · Állapot (kontroll · fut /
   fut / kikapcsolta az őr + ok / jóváhagyásra vár) · Ma (a mai osztás %) · Küldés · Levélnyitás
   24 ó · Link 24 ó · **Link 72 ó** (ezt követi a gép) · Válasz · Leiratkozás. Mobilon (≤760 px) a
   tábla soronként kártyává törik: fent a változat neve és szövege, alatta az állapot-pirula, majd
   a számok egymás alatt, a soruk nevével (koordinátor-javítás 2026-11-22: a görgetett táblában az
   állapot-oszlop levágódott).
5. **Lábjegyzet**: mi a levélnyitás (a kép letöltése, Gmail-proxy is; az Apple-előtöltés nem nyitás),
   mi a link-nyitás, mit követ a gép (72 órás link-nyitás, 10%-os padló), és az őr szabálya
   (≥100 levél, a kontroll + 0,5 pont fölötti leiratkozás vagy panasz → kikapcsol; a mai levelet
   nem kapcsolja ki).

Számok forrása: `loadVariantStats()` (`src/outreach/experiment.ts`) — ugyanaz, amiből a gép oszt,
így a panel és a gép nem mondhat mást. A százalékok nevezője az érett levél (24 / 72 órás).
