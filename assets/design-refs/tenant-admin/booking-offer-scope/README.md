# Az árajánlat ára alapból csak arra a kérésre szól — JÓVÁHAGYOTT TERV

**Jóváhagyva:** 2026-09-29, a tulaj szavai: **„OK A)”** (változat), **„Kért Napok”** (az árlistába
mentett ár a kért napokra szól, nem mától), a mezőnévre **„igen”** (`booking_request.offer_saved_as`).
A §2b kör három változata (A: pipa · B: három gomb · C: később, a listából) a
`elek/runs/arajanlat-ar/` alatt maradt; ez a mappa az **A**-t köti. ·
**Kapcsolódó:** ADR-XXXX (ez a döntés), ADR-0215 ①.3 (amit felülír), ADR-0256 ① (a widget az első áras
egységen nyílik), ADR-0257 (csak egyben kiadó ház), `../booking-offer/` (a lánc többi része változatlan).

`plan.html` a megvalósítás **KONTRAKTUSA, nem stílus-javaslat**. A kész felületet ehhez mérjük (mobil 390 +
asztali). A „Próba: a ház” választó csak a mockban él.

## Miért létezik

Az ADR-0215 ①.3 óta az ajánlat ára **mindig** az árlistába került, dátum nélkül időtlen alapárként. Mérve
(egy-szállásos kör, Myrna Haus, 2026-09-28): egy 90 000 Ft/éj ajánlat alapár lett, a vendég-widget onnantól
az egész házon nyílt, és a ház árajánlatosból foglalhatóvá vált — ütközve az ADR-0257-tel („csak egyben adom
ki”: ár nélküli házra árajánlat-kérés). A tulaj: *„Ez a döntés amúgy nem hangzik túl életszerűnek.”*

## Amit a terv KÖT

1. **Alapból csak erre a kérésre.** Az ajánlat-lap ár-kártyáján egy alapból **üres** pipa:
   **„Mentsem az árlistába is?”** (alatta: „Alapból nem: az ár csak ennek a kérésnek szól.”). Üres pipánál az
   árlista **nem változik**: az ár a kérésre fagy (`quoted_total` / `quoted_lines`), a vendég-oldal, az Árak
   szakasz, a widget, a teendő-sor és a heti hiány-levél változatlan.
2. **A pipa két útja:** **„Csak a kért napokra”** és **„Alapárként”**. Bepipáláskor a „Csak a kért napokra”
   előválasztott. Pipa út nélkül (JS nélkül) a szerver **megtagadja** a küldést hibaüzenettel, és semmit nem
   ír — soha nem esik vissza egy írásra, amit a tulaj nem választott.
3. **„Csak a kért napokra”** = dátumos alapár **a tartózkodás árazatlan éjszakáira** (összefüggő szakaszonként
   egy ablak, sosem árazott éjszakán át), nem „mától”. Lejárat-emlékeztető **nem** jár rá (az ablak a
   tartózkodással ér véget); a lejárat utáni törlés és újrarenderelés marad.
4. **„Alapárként”** = időtlen alapár, mint eddig. A lap kimondja: **„foglalhatóvá válik”**, és ha ettől az
   egység lesz a widget alapértelmezett egysége (ADR-0256 ①: az első áras egység, és van több foglalható
   egység), azt is: „A foglalási doboz is ezzel nyílik.” Csak egyben kiadó háznál ez a mondat nem jelenik
   meg (egyetlen foglalható egység).
5. **A következmény-mondat élőben vált** a választással és a beírt árral, a VALÓDI szabályt mondja:
   - üres pipa: **„Csak erre a kérésre.”** + „Az árlistája nem változik: …”;
   - kért napok: „A kért napokra az árlistába kerül ({napok}).” + „…más napokra továbbra is árajánlatot kérnek.”;
   - alapár: „Alapárként az árlistába kerül — dátum nélkül, a következő módosításig.” + „… ettől
     foglalhatóvá válik …”, a saját árukon maradó szezonok nevével.
6. **Nem „szoba”, ha nem szoba.** A kérés adatainál **„Amit kér”** (nem „Szoba”); a mondatok az egységet
   „az egész szállás” / „ez a szoba” szerint nevezik (`represents_whole` vagy `is_whole_property`).
7. **A „Csak erre a kérésre” ár ugyanazzal a szabállyal számolódik**, mint a mentett: memóriában ugyanazok a
   sorok, amiket a „kért napok” írna (`offerOverlayRows`) — a két út összege sosem térhet el.
8. **A küldés után** a zöld doboz kimondja, hova került az ár („Az árlistája nem változott — …” / „A kért
   napokra (…) bekerült az árlistába: …” / „Alapárként bekerült az árlistába: …”).
9. **„Kiküldött ajánlatok”** — új szakasz a Foglalások fül alján, teljes szélességben: minden ajánlat, ami a
   rendszerből ment (`offered_at IS NOT NULL`), lezártak is. Oszlopok: **Vendég · Mit, mikorra · Ár ·
   Kiküldve · Mi lett vele · Árlista**. A válaszra várók felül. „Mi lett vele”: „Válaszra vár · lejár …”,
   „Elfogadta — foglalás”, „Elfogadta, később lemondva”, „Nem kérte”, „Közben elkelt”, „Lejárt — nem felelt”.
   „Árlista”: „Nem került be” / „A kért napokra bekerült” / „Alapárként bekerült”; a döntés előtti
   ajánlatnál „—” (nem tudjuk — nem találunk ki értéket). Szűrők: „Mind” · „Válaszra vár” · „Elfogadta” ·
   „Nem lett belőle” (JS nélkül minden sor látszik). Üres állapot: egy mondat, mi fog itt megjelenni.
10. **Két elrendezés:** asztalon táblázat, telefonon kártyák (`@container`, 700 px) — nem ugyanaz lekicsinyítve.
    Az „Ajánlatra vár” kártyák (a „A vendég elfogadta (telefonon / levélben)” gombbal) megmaradnak.

## Amit NEM köt

A színek és margók a `--citui-*` tokenekből jönnek. A mockban az ár/éj külön sora a listában elmaradt a
megvalósításban (a kérés befagyasztott összege és éjszakái látszanak; az éjszakánkénti ár a kérésen nem
tárolt külön mezőként).

## Őr

`scripts/booking-offer-check.mts` (S①–S⑥): alapból 0 árlista-sor, a két út pontosan azt írja, amit mond, a
bélyeges dátumos sorra nem megy emlékeztető (bélyeg nélkül igen — piros kontroll), a csak egyben kiadó ház az
ajánlat után is árazatlanként szerepel a widgetben, a lista minden kimenetet és mindhárom árlista-utat
kimond, mindkét méreten. Piros kontroll kézzel: a régi „mindig alapár” alapértelmezéssel **14 bukás**.
