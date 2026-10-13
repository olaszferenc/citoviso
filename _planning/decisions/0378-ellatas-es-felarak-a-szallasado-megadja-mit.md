## ADR-0378 — Ellátás és felárak: a szállásadó megadja, mit tartalmaz az alapár és mi kérhető felárral (gyerekárral); a vendég a foglalásnál választ, a felár a kéréssel együtt fagy

**Dátum:** 2026-10-13 · **Státusz:** elfogadva (lokál; élesre a következő deployjal, külön tulaj-döntéssel) ·
**Terv:** `assets/design-refs/tenant-admin/ellatas/` (tulaj: „B” — táblázat + lenyíló; gyerekár: igen) ·
**Kapcsolódó:** ADR-0044 (config vs adat), ADR-0193 (ár csak élő Árak-modullal), ADR-0267 (az ajánlat ára),
ADR-0299 (az IFA a kérésre fagy), `tenant-site/booking-price-clarity` (nyitott ár-bontás), §B.17 ·
**Migráció:** 0110 · **Őr:** `scripts/meals-check.mts` (piros önteszttel)

### A mért tényállás (2026-10-13)

- Ellátást (reggeli, félpanzió, teljes panzió) sehol nem lehetett megadni, és az ár sem számolt vele. A
  tulaj 2026-09-25-én kérte, a pilot / nagy deploy utánra halasztva.
- A „Mi van benne az árban?” szöveg (`priceIncludes`) már létezett a foglalás-modul beállításai között.
- A vendégszám egyetlen szám (nincs felnőtt/gyerek bontás); a foglalás ára `booking_request.quoted_lines`-ban fagy.

### Döntés

1. **Hol:** az Árak lap új „Ellátás” része (egy űrlap, egy mentés: `POST /admin/prices/meals`). Tárolás: az
   Árak-modul configjában, `meals` kulccsal (kis, deklaratív beállítás — ADR-0044), nem új táblában. A modul
   általános űrlapja ezt a kulcsot nem posztolja, ezért a registry `editorKeys` listája védi: a pénznem
   mentése nem törli az ellátást (ugyanígy a `priceIncludes`-t a foglalás-modulban).
2. **Mit tartalmaz az alapár:** egy a négyből. Az alapárnál kevesebb nem kínálható (negatív felár nincs). A
   fölötte lévők pipával, felárral, „fő / éj” vagy „szoba / éj” alappal, leírással.
3. **Gyerekár (tulaj: igen):** ellátásonként egy gyerekár (0 = ingyenes, nem több a felnőttnél) és egy
   korhatár. Ahol üres, a gyermek felnőtt-árat fizet. Kódban egy kapcsoló (`MEAL_CHILD_PRICING`) veszi ki,
   az adat helye megmarad.
4. **Szobánként kivehető** — a vendég ott nem lát választást, csak azt, hogy nem kérhető; okot nem állítunk.
5. **A „Mi van még benne az árban?”** mező ide költözött; a tárolása marad (foglalás-modul `priceIncludes`),
   mert a widget, a levelek és a generátor ott olvassák.
6. **Az összeg szabálya** az ajánlat-oldalé (`parseOfferAmount`, most `src/booking/amount.ts`); hibánál semmi
   nem mentődik, az űrlap a beírt értékekkel tér vissza.
7. **Számítás egy helyen:** `src/tenant/meals.ts` (`mealLines`). Fejenként a felnőtt és a gyermek külön sor,
   szobánként egy sor, az alapár ellátása 0. A böngésző ikre (`cit-runtime.js` `mealLinesFor`) csak előnézet;
   a szerver a kéréskor újraszámol, a böngésző számát nem fogadja el.
8. **Fagyás:** `booking_request.meal_plan`, `children` (0110), az ellátás-sorok a `quoted_lines`-ba
   `kind: "meal"` jellel. A vendég levele, az ajánlat (a befagyott ellátás-sorok viszik tovább), a szállásadó
   levele („Ellátás” sor) és a Foglalások kártyája (címke + „Az ár tételesen”) ebből olvas. Az ajánlat
   éjszakánkénti ára csak a szállást nézi, az ellátás-sort nem.
9. **Honlap:** az „Ellátás” szekció minden sablonon (a showcase-slotban), a közös szobakártyán címkék, a
   foglalási widgetben lenyíló + „Ebből gyermek” léptető + külön ár-sor és kimondott alap.

### Visszafordíthatóság

🔄 Olcsó: a beállítás egy config-kulcs; törölve minden felület visszaáll a mostanira. A 0110 oszlopai nullázhatók.

### Elvetett alternatívák

- **A — kártyák** (a tulaj a B-t választotta: tömörebb).
- **Külön `site_meal_plan` tábla:** négy fix sor, lekérdezés nélkül — a config elég, és a meglévő
  history/visszaállítás is működik rá.
- **Ellátás-címke mind a 16 sablon saját szobakártyáján:** 12 sablon maga rajzolja a kártyát; ezt az
  „Ellátás” szekció pótolja minden sablonon.
