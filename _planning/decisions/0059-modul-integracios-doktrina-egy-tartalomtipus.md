## ADR-0059 — Modul-integrációs DOKTRÍNA: egy tartalomtípus EGYSZER, a template natív szekciójában; a mock minden modulja élmény, nem lista

**Dátum:** 2026-08-23 · **Státusz:** elfogadva (tulajdonosi rendelet) · **Felülírja/kiegészíti:**
ADR-0044 (közös modul-blokk) és ADR-0057 (stílus-kontraktus) — mindkettő RÉSZmegoldás volt.
**Kapcsolódó:** ADR-0016 (motor), ADR-0018 (wow-mérce), 03-INVARIANTS §B + §I.

### Probléma (tulaj, 2026-08-23, két mock-teszt egymás után)

Két javítási kör után is ugyanaz az alapélmény: a modulok „oda vannak baszva a végére" külön
blokkokként. A stílus-kontraktus (ADR-0057) a TIPOGRÁFIÁT igazította, de a SZERKEZETET nem —
a modul továbbra is függelék, nem az oldal része. Konkrét tünetek:

1. **Duplikáció tartalomtípus-szinten:** a template natívan renderel kiemeléseket („Amiért
   érdemes betérni"), majd a modul-réteg MELLÉ teszi az „Amit kínálunk" (amenities) és „Miért
   minket" (usp) blokkokat — ugyanaz a tartalomtípus 2-3×, más köntösben.
2. **A felszereltség rossz szinten él:** ha a szállásnak VANNAK unitjai, a felszereltség az
   EGYSÉGÉ (a szoba-kártyán/aloldalon a helye), nem globális lista a lap alján.
3. **A szoba-minta kártya üres/ikonos:** a szállásnak van 5-6 VALÓS fotója, mégsem visel képet
   a mintaszoba-kártya. A dekoratív ikon-panel (ADR-0058 photoFill) fallbacknek jó, ELSŐDLEGES
   megoldásnak nem — a wow képekből él.
4. **A booking a mockban nem élmény:** érdeklődés-sáv látszik ott, ahol az eladott modul egy
   kipróbálható foglalás-widget lenne. A lead nem tudja MEGFOGNI, amit venne (ADR-0015 sérül).

### Döntés (doktrína — 03-INVARIANTS §B-be is felveendő)

1. **EGY tartalomtípus EGYSZER jelenik meg az oldalon.** Ha a template natívan renderel egy
   tartalomtípust (szobák, felszereltség/kiemelés, vélemény, GYIK, galéria, kapcsolat), akkor a
   modul-adat ABBA a natív szekcióba folyik be (SiteData-n át), és a közös blokk NEM renderel
   mellé másodikat. Közös (de template-öltöztetett) blokk CSAK annak a tartalomnak jár, aminek
   az adott template-ben nincs natív helye. A `roomsAlreadyShown`-minta ÁLTALÁNOSÍTANDÓ minden
   tartalomtípusra — kapuval mérve, nem jóhiszeműen.
2. **Unit-elsődleges értelmezés:** ha vannak unitok, az unit-szintre értelmezhető adat
   (felszereltség, ár, kapacitás, fotó) az unit-kártyán/aloldalon jelenik meg; globális listába
   csak a ténylegesen ház-szintű tétel kerül.
   ⚠️ **PONTOSÍTVA — ADR-0209 (2026-09-23):** „ház-szintű” = amit a tulaj a Felszereltség
   lapon kiválaszt. A renderelő NEM szűri a ház-listát a szobák listáival szemben.
3. **A mintaszoba a szállás VALÓS fotóit viseli.** A lead fotókészletéből (Places/portál) a
   szoba-mintakártyák képet kapnak („Minta" jelöléssel — §B.17 tiszta: valós fotó + minta-címke).
   A photoFill ikon-panel csak akkor, ha EGYETLEN fotó sincs.
4. **A mockban minden megvett/ajánlott modul MŰKÖDŐ élmény:** a booking a hidratált, kattintható
   widgetet mutatja (mock-módban beküldés nélkül), nem statikus sávot. Ami nem kipróbálható, az
   nem meggyőző (ADR-0015: modult csak láthatóan adunk el).

### Kell-e motor-újraírás? NEM — egy réteg fordul át.

A render-mag (recept + adat → determinisztikus HTML, mock=live) marad. Ami átalakul: a
`moduleSections.ts` / `withModuleSections()` réteg „blokk-hozzáfűzés" elve → „adat-becsatornázás
a natív szekciókba + maradék-blokk". Fókuszált szelet, sorrendje:
① tartalomtípus-leltár: melyik template mit renderel natívan (gépi scan) →
② SiteData-becsatornázás + dedup-kapu (egy típus egyszer) →
③ mintaszoba-fotó a lead készletéből →
④ booking-widget a mockban élesítve →
⑤ wow-ellenőrzés az ADR-0018 referencia-mércével, screenshot-alapon.

### Visszafordíthatóság

🔄 Rétegen belüli átrendezés; a közös blokk-út fallbackként megmarad (template natív szekció
nélkül). 🚪 Egyirányú elem nincs.
