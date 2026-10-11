## ADR-0361 — Portál-naptárszinkron iCal-lal, első kör: a foglalási modul része, ár nélkül; channel manager API később

**Dátum:** 2026-10-11 · **Státusz:** elfogadva (tulaj-irány 2026-10-11: „első kör iCal… aztán majd ha jönnek a tenantek
és megrendelések akkor döntök a további fejlesztésről”); felület jóváhagyva 2026-10-11 („A + 1”, szöveges jelvény) ·
**Terv:** `assets/design-refs/console/portal-sync/` (README = ami köt) ·
**Felülírja:** ADR-0044 „Ami NEM scope” bekezdését a portál-NAPTÁR részére (a Booking.com-API-integráció továbbra sem scope) ·
**Ág:** `feat/ical-sync` — a mainre CSAK a 14 napos próba élesítése után, a tulaj külön szavára (ADR-0348 ne csússzon).

### Kiváltó (tulaj, 2026-10-11)

> „a mostani kiküldött leadjeink […] ha nincs honlapjuk akkor is valamelyik portálon szerepel. […] nem biztos, hogy látja,
> hogy mi is lenne az előnye, ha neki saját honlapja is lenne, hiszen duplán kéne adminisztrálnia és nem engedi el jogosan
> a portált, ahonnan a megrendelései jönnek… Így a kínálatunk nem túl vonzó, sőt, inkább nyűgös…”

A portál-jelenlét kimutatás (2026-10-09, 297 végigjárt lead): Szállás.hu 52,5% · Hovamenjek 35,4% · Turistautak 29,3% ·
Booking 24,6% · Facebook 23,9% · Apartman.hu 20,5%; 294/297 legalább egy portálon. (Alsó határ: Neo nem portált keresett.)

### Döntés

1. **Első kör = iCal, mindkét irány, egységenként.** A portál iCal-linkjét beolvassuk (a meglévő `src/booking/sync.ts`,
   éles óránkénti futás: `citoviso-booking-maintenance.timer`), a saját naptárunkat `/naptar/<token>.ics`-ként kiadjuk.
   Költség nekünk $0, új függőség nincs. Bekapcsolás = `PORTAL_SYNC_UI` + a jóváhagyott felület.
2. **Amit állítunk, és amit NEM (§B.17).** Az iCal CSAK a foglalt/szabad éjszakát viszi: árat, vendégadatot, hirdetés-
   tartalmat nem, és késéssel (a mi oldalunk óránként olvas; a portál a maga ütemében olvassa a mi linkünket).
   Ezért a felületen és a mockban: „a foglalási naptár egy helyen — ami ott foglalt, itt is lezár, és fordítva”.
   ⛔ Tilos: „nincs plusz admin”, „az árak is szinkronban”, „azonnal”. Csak az iCal-képességében IGAZOLT portál nevezhető
   meg (Booking.com, Airbnb, Szállás.hu; a többi a felderítés eredménye szerint, lent).
3. **A foglalási modul része, nem külön modul és nem felár.** A prospect a rendelés-panelen (az „Online foglalás” sorban)
   és a mock oldalán LÁTJA, hogy a portál-naptárszinkron benne van — a §2b mock dönti el, hol és hogyan.
4. **Channel manager API (ár + foglalás szinkron) — KÉSŐBB, a tulaj döntésére.** Kutatás (2026-10-09/11, források a
   session-jegyzetben):
   - A Szállás.hu-nak nincs nyilvános API-ja; CSAK channel manageren át köthető be. A hivatalos GYIK 21 tételes listáján
     (Adriagate … SabeeApp, SiteMinder, YieldPlanet) egyetlen fejlesztőknek szóló, nagykereskedelmi API sincs.
   - **Channex** (white-label REST): $130/hó platformdíj + $0,50/egység (VR) / $7/hotel; Booking + Airbnb igazolt,
     Szállás.hu-t a Channex listázza (`SZS`), a Szállás.hu listáján NINCS → igazolandó.
   - **Zodomus** (REST): €0,50/egység/csatorna/hó + €0,10/foglalás, minimum €29/hó; Booking (2019 óta), Expedia, Airbnb
     tanúsított; Szállás.hu NINCS.
   - Booking Demand API (affiliate) a mi célunkra NEM használható: a General Partner Terms 9.3 („solely … distribution of
     the Booking.com Platform”), 7.2.a.i és 7.2.a.iv ütközik a jutalék-kiváltó ajánlatunkkal.
   Kiváltó a továbblépéshez: fizető tenantok, akik árat is szinkronizálnának — addig nincs fejlesztés.
5. **Portál-felderítés (2026-10-11, webes forrás + oldalolvasás):**

   | portál | iCal ki/be | forrás |
   |---|---|---|
   | Booking.com | igen / igen — Extranet › Rates & Availability › Sync calendars; kétóránként importál („Import now”) | hivatalos (partner.booking.com súgó) |
   | Airbnb | igen / igen (az import URL-nek `.ics`-re kell végződnie — a miénk az) | hivatalos (airbnb.com/help/article/99) |
   | Szállás.hu | igen / igen — Admin › Árak és kapacitás › Naptár szinkron (iCal), szobatípusonként | harmadik fél (hivatalos súgó nincs) |
   | Hovamenjek, apartman.hu | saját iCal nem igazolt; a foglalási blokkjuk **Szállás.hu-widget** | oldalolvasás |
   | Turistautak | nincs naptár (POI-adatbázis, nem foglalóportál) | oldalolvasás |
   | kiadoapartman.hu | nem igazolt (login mögött) | — |

   Következmény: a három megnevezhető portál a Booking.com, a Szállás.hu és az Airbnb. ⚠️ **Booking-korlát:** a Booking
   iCal-szinkron csak akkor érhető el, ha ott egy szobatípus = egy egység, és nincs channel manager — a felület ezt
   kimondja. A hovamenjek/apartman.hu foglalhatósága a Szállás.hu-ról jön, tehát a Szállás.hu összekötése valószínűleg
   azt is fedi — ezt NEM állítjuk, amíg nincs igazolva.

### Következmények

- A tenant-admin „Hirdeti máshol is?” kártyája portálonként egy kártyára épült újra (a régi, sötét vázlat hibás
  `<option value=T(lang, "Szállás.hu")>` sora és a nem létező `/admin/segitseg/naptar` link ezzel kiesett).
- A rendelés-panel „Benne: naptár-szinkron” sora a modul-katalógus `publicIncl` mezőjéből jön (`src/modules.ts`), a
  mock minta-widgetje a sávot és a „a portálon foglalták” minta-napokat CSAK minta módban mutatja (élő oldalon soha).
- Portál-LOGÓ csak írásos engedéllyel (Airbnb védjegy-irányelv, Booking Holdings márka-irányelv); addig szöveges jelvény.
- KB: `kb/entries/admin-modules-booking` új szakasza („Ha a Booking.com-on, a Szállás.hu-n vagy az Airbnb-n is hirdet”).
- Azonos típusú, több egységes szállásnál az iCal egységenként köt — a felület egységenként kéri a linket.
