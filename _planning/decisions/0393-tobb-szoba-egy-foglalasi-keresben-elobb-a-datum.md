## ADR-0393 — Több szoba egy foglalási kérésben (előbb a dátum, aztán a szabad szobák); az egész ház nem külön, saját árú tétel

**Dátum:** 2026-10-16 · **Státusz:** elfogadva, megvalósítva (őrrel) · **Terv:** `assets/design-refs/tenant-site/multi-room/`
(„B”, a tulaj jóváhagyása 2026-10-16) · **Felülírja:** ADR-0392 ①–② és ④ (a ház a szobák mellett mindig foglalható, saját
árral; a ház ára a kártyán) · `tenant-site/booking-unit-default` ①–③ (a widget az első áras egységre nyit, a választó telefonon
az 1. lépésben) · **Változatlan:** ADR-0114 kizárás (`blockingUnitIds`), ADR-0257 „Csak egyben adom ki”, ADR-0389 férőhely-plafon,
ADR-0378 ellátás · **Őr:** `scripts/multi-room-request-check.mts`.

### Kiváltó (tulaj, 2026-10-16)

A portál-iCal vizsgálatából indult („a Bookingon és a Szállás.hu-n ugyanazt az iCal-t használjuk… ha a szobastruktúra
megegyezik?”), és kiderült: egy foglalási kérés EGY egységre szólt (`booking_request.unit_id`, a vendég-űrlapon egy
`<select>`). Aki két szobát akart, két kérést küldött, és a tulaj külön fogadta el őket. Az „egész ház” ezt foltozta: külön,
saját árú tétel a szobák mellett. A tulaj: „Minek az…? Ha ennek marketing- vagy árazási megfontolása van, szerintem
faszság.” — és: „ez így szerintem fos… Hülyeség.”

### Döntés

1. **Egy kérés több szobát hordozhat.** `booking_request.unit_ids uuid[]` (migráció 0111), a vendég sorrendjében; `[1] = unit_id`
   (a „fő” egység — régi olvasók, statisztika változatlan). Régi sorok: `ARRAY[unit_id]`; a trigger tölti, ha egy INSERT kihagyja.
2. **Vendég-oldal (terv „B”): előbb a dátum, aztán a szabad szobák.** A naptár csak azt az éjt zárja, amikor EGYIK szoba sem
   szabad. A dátum után a szobák listája: a szabad pipálható (az időszak árával), a foglalt szürke, kimondva („Erre az időszakra
   foglalt”). „Mind a N szabad szobát kérem” / mind szabad esetén „…(az egész ház)”. Az ár szobánként tételes, az összeg a szobák
   összege; a létszám-plafon a pipált szobák férőhelyének összege (ha egynek nincs, nincs plafon). Telefonon a lista az 1. lépésben,
   a dátumok és az ár között áll. A szoba-kártya „Foglalás” gombja a widgetben az adott szobát pipálja.
3. **Az egész ház nem külön ajánlat a szobák mellett.** Szobánként kiadó szálláson a ház egysége a vendégnek nem látszik és nem
   foglalható (`guestUnits` / `isBookableUnit`); aki az egészet akarja, minden szobát kipipál. „Csak egyben adom ki” változatlan:
   akkor csak a ház foglalható. A ház egysége az adatbázisban marad (az ADR-0114 kizárás horgonya; régi foglalásai tovább zárnak).
   A tulaj kártyáján a ház ára CSAK „Csak egyben” módban látszik.
4. **Szerver:** minden kapu minden szobára fut (tartozás, foglalhatóság, szezon-szabály, foglaltság); a ház és szoba nem keverhető
   egy kérésben. Ár = a szobák saját árainak összege, a sorok a szoba nevével. **Fejenkénti árazásnál több szoba → nincs fagyasztott
   ár, árajánlat** (a szobánkénti létszámot nem kérdezzük; §B.17). Ellátás csak akkor, ha minden pipált szoba kér ellátást; a
   szobánkénti felár a szobák számával szorzódik („…, N szobára”). Ismétlés-szűrő (K6): ugyanaz a szoba-HALMAZ, sorrendtől függetlenül.
5. **Visszaigazolás egyben:** egy tranzakció, minden szoba éjei vagy egyik sem; az ütköző függő kérések BÁRMELY érintett szobán
   automatikus elutasítást kapnak. **Lemondás:** minden szoba felszabadul.
6. **Több szobás árajánlat:** a tulaj egy éjszakai árat ad a szobákra EGYÜTT („Ár éjszakánként, a N szobára együtt”), csak erre a
   kérésre; árlistába nem kerül (a „Mentsem az árlistába is?” doboz nem jelenik meg, a szerver is „request”-re kényszerít).
7. **Tulaj felület és levelek:** a kártya jelvénye „Foglalási kérés · N szoba”, a szobák vesszővel; „Visszaigazolom (N szoba)”, és a
   megerősítés kimondja, hogy minden szoba lezár (a portálok felé is). A levelek a szobák nevét sorolják (`UNIT_NAMES`, egy SQL-kifejezés
   minden olvasónak).
8. **Portál-szinkron:** szobánként egy linkpár portálonként; a háznak nincs külön linkje (a szobák naptára viszi a foglaltságot).

### Következmények

- `booking-unit-default` őr kivezetve (a legördülő megszűnt); helyette `multi-room-request-check` (valódi DB, szerver, böngésző
  390+1280; `--selftest` a pillanatképben kikapcsolja a több szobás módot → piros).
- Nyitott: fejenkénti árazású szálláson a több szobás kérés árajánlat-kérés lesz — ha ilyen ügyfél jön, szobánkénti létszám kell.
- Nyitott: a régi (ADR-0392) ház-ár sorok az adatbázisban maradnak; „Csak egyben” módra váltva újra érvényesek.

### Kiegészítés 2026-10-17 — Elek 5 perszónás köre után (tulaj: „1: igen; 2: igen; 3: igen”)

- **Ár nélküli szoba a többi mellett** (felülírja a 6. pontot és a „minden szoba ellátást kap, vagy egyik sem” saját szabályomat):
  a vendég a többi szoba tételes árát és „Az ismert rész” összegét látja, az ár nélküli szoba „egyedi ár”; a kérés árajánlat-kérés.
  Az ajánlat-lapon az árazott szobák a saját listaárukon állnak (`multiOfferSplit`), a tulaj egy éjszakai árat ad csak az ár
  nélküliekre együtt. Fejenkénti / tartózkodásra szóló árlistánál nincs szétválasztás: egy ár az összes szobára (mint eddig).
- **Ellátás szobánként:** azokhoz a szobákhoz kérhető, amelyekhez a tulaj felajánlotta (`requestMealLines`); szobás felár ×
  ilyen szobák; fejenkénti felár a vendégszámra, de ha van ellátás nélküli szoba, legfeljebb az ellátásos szobák férőhelyére —
  a sor neve megnevezi a szobákat, mert a vendéget nem kérdezzük, ki hol alszik.
- **Ütközés a tulaj választóablakában:** közös éjszaka ÉS közös szoba kell hozzá (eddig a dátum elég volt — a felület olyan
  elutasítást ígért, amit a szerver nem tett meg). A több szobás automatikus elutasító levél nem „az időszak betelt”, hanem
  „a kért szobák egyike időközben foglalt lett”.
- Telefonos apróságok: a nyugta sorai törnek (nem lóg ki), fekvőben a szobalista teljes szélességű, a dátum után az oldal a
  szobákhoz visz, dátumváltáskor a lekerült pipát a lista kimondja, a létszám-plafon azonnal követi.
