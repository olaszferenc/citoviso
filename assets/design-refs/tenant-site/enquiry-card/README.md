# Kontraktus — „Foglalási igény" kártya: valódi beküldés (jóváhagyva 2026-09-08)

Tulaj-döntés: **„B" változat — a kapcsolat-blokk a dátumválasztás után nyílik.** A `plan.html`
a jóváhagyott, működő terv (méret-váltóval; az A változat elvetve).

Amit a terv KÖT (elvárt viselkedés, nem stílus-javaslat):

1. **A kártya kompakt indul** (érkezés + távozás + vendégek + gomb, mint ma). Az első érvényes
   dátumpár utáni kattintásra kinyílik a kapcsolat-blokk (név, e-mail, telefon) ezzel a
   magyarázattal: „Már csak az elérhetősége hiányzik, hogy a szállásadó válaszolni tudjon."
2. **Validáció** (kliens ÉS szerver): dátumok kötelezők, távozás > érkezés; név kötelező;
   e-mail VAGY telefon kötelező; e-mail formátum; telefon min. 8 számjegy. Hibák magyarul,
   a hibás mező jelölve.
3. **Beküldés = valódi szerver-út** (`POST /api/erdeklodes`): rögzítés (Üzenetek-naplósor)
   + e-mail a szállásadónak a vendég elérhetőségével. NEM mailto.
4. **Siker-állapot a kártyában**: „Köszönjük! Az érdeklődését elküldtük a szállásadónak." +
   összegzés (dátumok · vendégszám · név) + „a megadott elérhetőségén jelentkezik".
5. **Jogi mondat** (ADR-0110 mintája, mondat — nem pipa): „A megadott adatait a kérés
   megválaszolására használjuk." + Adatkezelési tájékoztató link.
6. JS nélkül a mailto-fallback marad.
