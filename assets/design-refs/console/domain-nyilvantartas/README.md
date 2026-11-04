# Domain-nyilvántartás (/domains) — JÓVÁHAGYOTT terv: A+B hibrid (2026-11-04)

**Döntés:** a tulaj 2026-11-03-án az A+B hibridet választotta: asztalon A (összesítő csempék + tábla
+ jobbról becsúszó oldalfiók), a sorban és a fiók tetején B 7 pontos életút-sávja, mobilon kártyák.
A „Figyelmet kér” szűrő marad, és a menüt nem rendezzük át. A hibrid mockot 2026-11-04-én hagyta jóvá,
a koordinátoron át.

- `JOVAHAGYOTT-H-hibrid.html`: a kattintható terv, méret-váltóval, éles (3) és szimulált (26) adattal.
- `kepek/H-*.png`: amit a tulaj látott, mobil és asztali változatban.
- `kepek/domains-*.png`: a megvalósítás ugyanezekről a helyzetekről (az őr fixture-adataival).

## Amit a terv KÖT (elvárt viselkedés, nem stílus-javaslat)

1. **Hely:** Pénzügy › Domainek, a Partnerek után (`src/console/nav.ts`). Egyetlen új sor, átrendezés nincs.
2. **Négy összesítő csempe:**
   - darabszám állapot és végződés szerint;
   - a 90 napon belül lejáró címek, a legközelebbivel kezdve, a megújítás beszerzési díjával;
   - átlagos átfutás lépésenként és megrendeléstől élesig;
   - havi beszerzési költség és külön domain-bevétel az elmúlt 6 hónapra.
   A saját cím (citoviso.hu …) kimarad a költségből és az átfutásból.
3. **Asztali nézet: tábla.** Oszlopai: Domain · Tenant/partner · Életút · Lejárat · Fedezet · Regisztrátor.
   - Az „Életút” cellában a 7 pontos sáv áll (.hu esetén a Nyilvántartó-megerősítéssel; más végződésnél 6 pont), alatta az állapot és az elakadás („Vár X óta · 24/72 órás riasztás”).
   - A Domain, a Tenant és a Lejárat szerint lehet rendezni.
   - Az alapsorrend: a figyelmet kérő sorok elöl, azon belül a legújabb.
4. **Mobil nézet (700 px alatti hasáb): kártyák a tábla helyett.** A kártyán név, állapot, tenant és partner, életút-sáv a címkékkel, elakadás, lejárat és fedezet. Oldalra görgetni nem kell.
5. **Oldalfiók:** sorra vagy kártyára kattintva nyílik, mobilon teljes szélességben.
   - Sorrend: a tetején az életút-sáv, alatta a név és az állapot, a riasztások, az idővonal, a „Lejárat és megújítás”, a „Kié, mi alapján”, és a Forgalom helyőrzője (SUB-D).
   - Bezárás: ESC, „Bezárás” gomb vagy a háttérre kattintás.
   - Az URL viszi a megnyitott sort (`?open=<beszerzés-id>`), és a mélylink szerver oldalon is nyitva tölt.
6. **Idővonal: csak mért idő (§B.17).** Ahol nincs tárolt időpont, „nincs adat” áll, és mellette, hogy miért nincs:
   - saját cím;
   - a TLS az élesedéssel együtt történik;
   - a sor régebbi, mint a mérés bevezetése.

   A tárolt mellékesemények időrendben kerülnek a lépések közé: a .hu megerősítő link érkezése (0122), a regisztrátor levele, a vevőnek küldött „tovább tart” levél.
7. **„Figyelmet kér” szűrő és piros bal szél** a következő sorokon:
   - bukott sor;
   - 24 vagy 72 órás elakadás;
   - a regisztrátor írt (folyamatban lévő sornál);
   - lejárat 60, 30 vagy 7 napon belül;
   - megújítási gond;
   - megszűnt előfizetés mellett még élő cím.

   A szabály az adatrétegé (`attentionOf`), a nézet nem számol mást.
8. **Fedezet** a számlázással azonos szabály szerint: „csomagban”, „havidíj”, „kivásárolta” vagy „saját cím”.
9. **Súgó:** a „?” gomb nyitja, ESC zárja. Leírja az életutat, a lejárat-jelzést és a fedezetet.

## Ahol a kód TUDATOSAN eltér a mocktól

- **Az idővonalon csak a DB-ben tárolt esemény jelenik meg.** A mock dunavibehouse.hu idővonalán a koordinátor kézi mérése állt: „Neo nem tudta”, tartalék SMS, „Elkészült” levél. Ezeket az adatbázis nem tárolja, ezért az élő lapon nem jelennek meg. Kitalált időt nem írunk.
- **A szűrés és a rendezés link.** Szerver oldalon fut, megosztható URL-lel, és JS nélkül is működik. A keresés élőben, a kliensen szűr.
- **Az oldalfiók és a súgó a `<body>`-ba költözik betöltéskor.** A `.con-main__in` méret-konténer, ezért egy `position:fixed` elem csak a tartalom-hasábhoz igazodna, nem az ablakhoz.
- **A mock „SZIMULÁLT” jele és a méret- és adatváltó sávja nem része a felületnek.**

## Őrök

- `scripts/domain-registry-check.mts`: az adatréteg (életút, figyelem-szabály, statisztika, megerősítési nyom).
- `scripts/domain-registry-ui-check.mts`: a lap viselkedése valódi böngészőben, 1280 és 390 px szélességen.
  - Tábla vagy kártyák a szélesség szerint; oldalra görgetés nincs.
  - Az oldalfiók nyitása, ESC, „Bezárás”, mélylink.
  - Az idővonal sorrendje és a „nincs adat”.
  - Szűrő-számok; keresés.
  - Súgó; JS-hiba 0.

  `DM_SHOTS=<mappa>` beállítással képeket is ment.
