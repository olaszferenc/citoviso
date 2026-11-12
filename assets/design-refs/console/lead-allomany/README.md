# Irányítópult + Riport — „Lead-állomány” (a CRM-kártya helyett)

Tulajdonosi jóváhagyás: 2026-11-12 („terv ok. B változat”, a Messenger-út helyőrző doboza
nélkül). A vázlat `plan.html` (Irányítópult „B” + Riport fül egy fájlban, méret-váltóval), képek:
`shot-B-d.png`, `shot-B-m.png`, `shot-R-d.png`, `shot-R-m.png`. A számok a vázlatban az élesből
2026-11-12-én mért valós adatok. **Ez a terv KÖT** — elvárt viselkedés, nem stílus-javaslat.

**Hatókör:** `src/console/leadStock.ts` · `src/console/leadStockViews.ts` · `src/console/views.ts` · `src/console/reportViews.ts` · `src/console/server.ts` · `src/console/data.ts`

## Miért létezik

A tulaj kérése (2026-11-12, saját táblázattal): az Irányítópulton a CRM-kártya helyett a
kvalifikált leadek képtípus × állapot mátrixa, a kiküldhetők csatorna szerint, a generálásra
várók ok szerint; a Riportban ennek részletes változata; és az Irányítópulton időszak-gomb.

## Amit a terv KÖT

1. **Helye:** az Irányítópult widget-rácsában a CRM-kártya helyén, **teljes szélességű sor**
   („B”). Asztali gépen a három tábla egymás mellett, telefonon egymás alatt. Alatta a Pénzügy
   és a Megkeresések kártya. A Messenger-út blokk változatlan (nem kap időszakot).
2. **Időszak-gomb:** „Ma · 7 nap · 1 hónap · Összes” a rács fölött; alapérték „Összes”. A
   Lead-állomány és a Megkeresések kártyára hat. Az időszak KOHORSZ: az időszakban felmért leadek
   a mai állapotukban.
3. **Állapot-tábla:** sorok „saját kép” · „település / stock” · „semmilyen kép” · „Összes
   kvalifikált” · „Nem kvalifikált” · „Összes lead”; oszlopok „Darab” · „Ebből kiküldött” ·
   „Generálásra vár” · „Kiküldhető” (telefonon „Kiküldve” · „Vár”). Darab = kiküldött + vár + kiküldhető.
4. **Csatorna szerint** (a kiküldhetők): „E-mail” · „Messenger” · „MMS” · „Mind” (e-mail +
   messenger); egy lead több oszlopban is lehet.
5. **Generálásra vár** ok szerint: „Nincs mock generálás / ellenőrzés” · „Nincs kontakt-ellenőrzés”
   (egy lead egy oszlopban, a mock-ok áll előrébb). A Riportban négy oszlopra bontva: „Nincs mock” ·
   „Generált, átnézésre vár” · „Elutasítva / nem mehet ki” · „Nincs kontakt-ellenőrzés”.
6. **Minden szám kattintható:** a lead-listára visz (`/leads?stock=<képtípus>.<oszlop>&stockDays=`),
   pontosan azokra a leadekre, amiket a szám számolt (ugyanaz a besoroló). A lista tetején sáv mondja
   ki, melyik szám ez, „Szűrés törlése” és „vissza az Irányítópultra” linkkel.
7. **Riport „Lead-állomány” fül:** öt összesítő (összes lead · kvalifikált · kiküldött · kiküldhető
   most · generálásra vár), az állapot-tábla soronkénti százalékkal és színes sávval, a részletes
   „Generálásra vár”, a csatorna-tábla, és lent a „Mit jelentenek az oszlopok?” magyarázat.

## Fogalmak (a kód `leadStock.ts` fejléce ugyanezt mondja)

- **Kvalifikált:** nincs vagy elavult honlap, nem diszkvalifikált, nincs letiltva a megkeresésből
  (a CRM-lista alapszűrőjénél tágabb: ott ≥1 kép is kell).
- **saját kép:** ≥1 portál / Google / saját honlap fotó (Street View nem számít).
- **település / stock:** nincs saját fotó, és a mock településfotót kapott (ADR-0436) — vagy még nincs mock.
- **semmilyen kép:** nincs saját fotó, és a mock településfotót sem kapott.
- **Kiküldhető:** az átnéző MEHET-et adott (tárolt verdikt „pass”), a jóváhagyó lapon nem lett
  „Nem mehet ki”, és van ellenőrzött elérhetőség (e-mail, vagy lefutott Viber/WhatsApp-ellenőrzés
  a magyar mobilszámon), de még nem ment ki.

## Kötő horgony

- `lead-stock`
- `ls-period`
- `data-stock-filter`
- `/report/leads`

KÖTŐ feliratok: **„Lead-állomány”** · **„Ebből kiküldött”** · **„Generálásra vár”** · **„Kiküldhető”** ·
**„Nincs mock generálás / ellenőrzés”** · **„Nincs kontakt-ellenőrzés”** · **„Mind (e-mail + messenger)”** ·
**„Mit jelentenek az oszlopok?”** · **„Az időszak a Lead-állomány és a Megkeresések kártyára hat.”**
