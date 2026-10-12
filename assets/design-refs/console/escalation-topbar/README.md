# Döntés-segítő ajánlat: felső sáv (kontraktus, ADR-XXXX)

Tulajdonosi jóváhagyás: 2026-10-12, „A — felső sáv” (a koordinátoron keresztül). A `plan.html` a
jóváhagyott, működő vázlat. Megnyitáskor az A változatot mutatja; a „MA” gombbal összevethető a
régi kártyával. A képek a döntéskori állapotot rögzítik. **Ez a terv KÖT: elvárt viselkedés, nem
stílus-javaslat.** Felülírja az `offer-ui/` README 4. pontjának elrendezését (középre emelt kártya
fátyollal, mobilon alsó kártya). Az ajánlat logikája (küszöb, %, lejárat, egy kedvezmény)
változatlan.

**Hatókör:** `assets/runtime/cit-configurator.js`

## Miért
Elek 10-11 mérése: a 3. visszatérésnél megjelenő −50%/72 órás kártya mobilon a képernyő alsó
~34%-át fedte, benne a rendelés-pirulákat és a hős-CTA-t. Látható bezáró gombja nem volt, csak a
halvány „Most még gondolkodom” link. A vázlat mérése: a régi kártya mobilon 32%, a sáv 7%.

## Amit a terv KÖT
1. **Egy sor a képernyő tetején**, mobilon és asztalon is; asztalon középre igazítva, legfeljebb
   920 px széles. **Fátyol nincs, egyik méreten sem**: a terv alatta görgethető és kattintható marad.
2. A sor tartalma: a százalék (−N%) · cím **„Szeretnénk segíteni a döntésben”** · „az első havi
   vagy éves díjból · a megújulás listaáron · még ÓÓ:PP:MM” · **„Megrendelem a kedvezménnyel”** · ×.
   Mobilon rövidül: a cím helyén **„az első díjból”**, alatta „még ÓÓ:PP:MM”, a gomb „Megrendelem”.
   A teljes magyarázat a rendelés-panel ár-kártyájában van, és ott marad.
3. **Nem takarhatja** az „Itt rendelheti meg” és a „14 nap ingyen” pirulát, sem a honlap saját
   alsó foglalás-sávját. A felső „Ez egy honlap-terv…” sávra rákerülhet (a tulaj elfogadta).
4. **Jól látható bezáró ×**: rajzolt kör, legalább 40 px koppintási felület. A × ugyanazt teszi,
   mint régen a „Most még gondolkodom”: csak a sávot rejti el, az ajánlat él, és a panel
   ár-kártyájában tovább látszik. Utána a meglévő egykoppintásos kérdés jön (változatlan).
5. A gomb a rendelés-panelt nyitja; a visszaszámláló élő. Lejáratkor a kedvezmény MINDENHOL
   egyszerre eltűnik (sáv + ár-kártya), mint eddig.
6. A megjelenés feltételei változatlanok: a próba-levélből jött, a próbázó saját pénztára és a
   leiratkozott látogató nem kapja meg.

## Megvalósítás
`assets/runtime/cit-configurator.{js,css}` (`mountEscalationCard`). Az osztálynevek
(`.cit-cfg-esccard`, `.cit-cfg-escgo`, `.cit-cfg-esclater`) maradtak, így a meglévő őrök tovább
fognak. Őr: `scripts/optout-offer-price-check.mts`: felső sáv, a képernyő legfeljebb 15%-a,
nincs fátyol, nem takarja a rendelés-pirulát, a × legalább 40 px.
