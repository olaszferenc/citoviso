# Portál-feltöltés a tenant helyett — felmérés (2026-11-13)

**Kiváltó (tulaj, brief `port-l-felt-lt-s-20261113-090252.md`):** több kérdés-visszajelzés jött, hogy fel tudjuk-e tenni a
szállást a portálokra, hogy a tenantnek ne kelljen regisztrálnia. Feladat: a magyar TOP 5 portál + Booking + Airbnb, és
hogyan lehetne oda feltölteni (API hiányában valószínűleg digitális kolléga).
**Státusz:** felmérés, döntés még nincs (ADR nem született). Kapcsolódik: ADR-0361 (portál-iCal), ADR-0416 (jutalék-kiváltás).

## 1. Melyik az 5 hazai portál — a SAJÁT leadjeink alapján

Két mérés, mindkettő alsó becslés:
- ADR-0361 (2026-10-09, 297 végigjárt lead): Szállás.hu 52,5% · Hovamenjek 35,4% · Turistautak 29,3% · Booking 24,6% ·
  Facebook 23,9% · Apartman.hu 20,5%.
- dev-DB `lead.raw` URL-jei (2026-11-13, 7393 lead, csak ahol a nyersadatban link van): turistautak.hu 642 · szallas.hu 185 ·
  booking.com 123 · facebook 115 · hovamenjek.hu 56 · zimmerinfo.hu 53 · apartman.hu 44 · szallaskeres.hu 21 ·
  kiadoapartman.hu 15 · szallashirdeto.hu 15 · airbnb 10.
- Piaci súly (külső forrás): a belföldi online szállásközvetítésben a Szállás.hu ~45% (GKI, privatbankar.hu); a csoporthoz
  tartozik a Travelminit és a Szallasguru is (2022 óta a Wirtualna Polska tulajdona).

A Turistautak NEM foglalóportál (túra-POI adatbázis, ADR-0361), ezért kimarad. **A javasolt TOP 5:**

| # | portál | modell (mérve 2026-11-13) | regisztráció | API |
|---|---|---|---|---|
| 1 | **Szállás.hu** (+ Travelminit, Szallasguru — egy csoport) | jutalék a megvalósult foglalás után, belépési díj nincs; a jutalék mértéke a partnerfelületen | önkiszolgáló partner-regisztráció + ÁSZF-elfogadás | nyilvános nincs; channel manageren át (SabeeApp, YieldPlanet…), a Guesty közvetlen integrációt is hirdet |
| 2 | **Hovamenjek.hu** | a foglalási blokkja Szállás.hu-widget (ADR-0361) → a foglalhatóság valószínűleg a Szállás.hu-fiókból jön | **nem igazolt** (az oldalon nincs szállásadói menü, csak „Kapcsolat”) | nincs |
| 3 | **Zimmerinfo.hu** (Balaton) | közvetlen kapcsolat, közvetítési díj nélkül, „folyamatos hirdetésfelvétel” → előfizetés | e-mailes felvétel (`balatoniszallas@zimmerinfo.hu`) | nincs |
| 4 | **Apartman.hu** | A) 5 950 Ft + áfa/hó, min. 12 hónap, közvetlen elérhetőséggel; B) díjtalan, foglalásonként jutalék „az apartman.hu, illetve együttműködő partnerünk” felé | `/szallasadoknak` | nincs |
| 5 | **KiadóApartman.hu** | önkiszolgáló admin (`adm.kiadoapartman.hu`), árazás login mögött | önkiszolgáló | nincs |

Tartalék a #5 helyére: szallaskeres.hu (közvetlen kapcsolat, „nincs közvetítői díj”).

## 2. Booking.com és Airbnb

| | Booking.com | Airbnb |
|---|---|---|
| API | Connectivity API: **új szolgáltatót most nem vesz fel** (connect.booking.com: szüneteltetve, új időpont nincs); a Demand API affiliate, a mi célunkra tiltott (ADR-0361 4.) | **nem fogad új API-kérelmet**, a partnerprogram meghívásos |
| meghatalmazott hozzáférés | Extranet › „Create and manage users”: a fiók gazdája felhasználót vehet fel jogosultságokkal, **de csak aktivált szálláshelyen** | **Társházigazda (co-host)**, „Full access”: hirdetés, naptár, ár, üzenet, kifizetések megtekintése; a gazda felel érte |
| automatizálás az ÁSZF-ben | automatizált eszköz / robot / AI-asszisztens tilos előzetes írásos engedély nélkül (fogyasztói ÁSZF; az Extranetre vonatkozó külön szöveget nem találtunk) | „bots, crawlers, scrapers or other automated means … or otherwise interact” tilos (ÁSZF, Platform Rules — harmadik féltől idézve) |
| kötelező a gazdától | szerződő fél, bankszámla/kifizetés, személyazonosság | NTAK-szám a hirdetésben kötelező; személyazonosság-ellenőrzés |

## 3. A közös korlátok — miért nem lehet „a tenant helyett regisztrálni” teljesen

1. **A szerződő fél a szállásadó.** Minden portál a szálláshely üzemeltetőjével köt szerződést (Szállás.hu ÁSZF: a Partner
   regisztrál és elfogadja az ÁSZF-et), neki számláz jutalékot, neki fizet ki. A fiók tehát az ő nevére szól; mi csak az ő
   meghatalmazásával tölthetjük ki.
2. **Személyes adatok, amiket csak ő adhat:** NTAK-regisztrációs szám, adószám/adóazonosító, bankszámla, személyazonosság-
   ellenőrzés (Airbnb, Booking), és az ellenőrző kódok (SMS/e-mail).
3. **Bot-védelem.** 2026-11-13-án mérve: a Szállás.hu ÁSZF-oldala a fejetlen Chrome-unknak (és a curl-nek) Cloudflare-
   „biztonsági ellenőrzés”-t ad (403), nem a tartalmat. A Booking ÁSZF-oldala is bot-ellenőrzés mögött van (harmadik fél,
   2026-04). A digitális kolléga tehát valódi, fiókonként külön Chrome-profilban, emberi tempóban tud dolgozni, nem
   fejetlenül.
4. **ÁSZF-kockázat a SZÁLLÁSADÓ fiókján.** A Booking és az Airbnb tiltja az automatizált használatot. Ha a portál bot-
   használatot észlel, a szállásadó fiókját függesztheti fel (az a bevételi forrása) — ez jogi/kockázati döntés.

## 4. Ami ebből megvalósítható (javaslat, nem döntés)

**„Portál-feltöltés” szolgáltatás, digitális kollégával, a szállásadó egyszeri meghatalmazásával:**

- A tenant-adminban EGY űrlap: „Melyik portálon jelenjünk meg?” + az ott kötelező adatok egyszer (NTAK-szám, számlázási adat,
  bankszámla) + meghatalmazás-pipa (a nevében regisztrálhatunk és az ÁSZF-et elfogadhatjuk). Minden más adat (leírás,
  fotók, felszereltség, ár, szobák) már nálunk van.
- A kolléga a szállásadó nevére regisztrál, feltölti a hirdetést, és **azonnal beköti a mi iCal-unkat** (ADR-0361:
  Booking, Airbnb, Szállás.hu igazoltan tud iCal-t) → a naptár egy helyen marad.
- Ahol van meghatalmazott hozzáférés (Booking-felhasználó, Airbnb-társházigazda), ott a kolléga a SAJÁT felhasználónkkal
  lép be, nem a szállásadó jelszavával.
- A szállásadónak ami marad: a személyazonosság-ellenőrzés (szelfi/igazolvány), ha a portál kéri. Ezt API-val sem
  lehetne kiváltani.

**Sorrend-javaslat:** ① Szállás.hu (a legnagyobb hazai elérés; a Hovamenjek és talán az Apartman.hu jutalékos blokkja is
innen jön — igazolandó) · ② Airbnb (díjtalan, egyszerű, társházigazda) · ③ Booking (a legtöbb ellenőrzés) ·
④ Zimmerinfo / Apartman.hu / KiadóApartman csak akkor, ha a szállásadó a havidíjat vállalja.

**API-út később:** ha lesz elég fizető tenant, egy channel manager (Channex: Booking + Airbnb igazolt, Szállás.hu a
listáján) ár- és foglalás-szinkront ad — de a portál-fiókot ott is a szállásadónak kell megnyitnia, a hirdetés-létrehozást
a CM nem váltja ki.

⚠️ **Feszültség az ADR-0416-tal:** ott a portál-jutalék kiváltása a cél, itt a portálra terelés. Nem ellentmondás (a
vendég a portálon talál rá, a saját oldalon foglal közvetlenül), de a mock/értékesítési szöveg ne ígérje mindkettőt egy mondatban.

## 5. A tulaj döntései (nyitott)

1. **Vállaljuk-e az ÁSZF-kockázatot?** A Booking és az Airbnb tiltja az automatizált használatot; a kolléga böngészős munkája
   ennek a szürke zónája, a kockázat a szállásadó fiókja. Javaslat: igen, de csak a regisztrációra és a hirdetés
   feltöltésére (egyszeri, emberi tempó), a napi szinkront iCal végzi, nem a kolléga.
2. **Elfogadható-e, hogy a szállásadó egyszer megadja az NTAK-számot, a bankszámlát és a meghatalmazást, és a portál
   személyazonosság-ellenőrzését ő végzi?** Ennél kevesebb nem lehetséges.
3. **Ár:** külön modul vagy csomag-tartalom, portálonként vagy egyben.
4. **Első kör:** csak a Szállás.hu (pilot egy önként jelentkező tenanttal), vagy rögtön mindhárom (Szállás.hu + Airbnb + Booking)?

## Források

- GKI / Szállás.hu 45%: https://privatbankar.hu/cikkek/vallalat/bevasaroltak-megvette-versenytarsait-a-szallaskozvetito-oldal-311653.html
- OGY Infojegyzet 2024/1: https://parlament.hu/documents/d/guest/infojegyzet_2024_1_online_szallaskozvetites
- Szállás.hu ÁSZF (2026-10-01): https://szallas.hu/aszf20261001 · regisztráció: https://szallas.hu/regisztracio · médiaajánlat: https://szallas.hu/mediaajanlat
- Szállás Group / Travelminit: https://trademagazin.hu/en/roman-szallaskozvetitot-vasarolt-a-szallas-group
- Szállás.hu channel manager bekötés: https://www.sabeeapp.com/knowledge-base/how-to-connect-to-szallas.hu · https://help.guesty.com/hc/en-gb/articles/19756583307293
- Apartman.hu díjak: https://www.apartman.hu/szallasadoknak · https://www.apartman.hu/hirdetesi-megoldasok
- KiadóApartman admin: https://adm.kiadoapartman.hu/ui/hello/ · Zimmerinfo: https://www.zimmerinfo.hu/
- Booking Connectivity szünet: https://connect.booking.com · https://supergood.ai/api-report-card/booking-com
- Booking Extranet-felhasználók: https://partnerhelp.booking.com/hc/en-gb/articles/213301525
- Booking automatizálás-tilalom (harmadik fél): https://conductatlas.com/platform/bookingcom/bookingcom-terms-and-conditions/provision/CA-P-076605/automated-access-to-platform-prohibited-without-written-permission/
- Airbnb API zárva: https://hospitable.com/airbnb-partnerships · https://www.bnbcalc.com/help/articles/does-airbnb-have-an-api
- Airbnb társházigazda: https://www.airbnb.com/help/article/1534
- Airbnb bot-tilalom (harmadik fél): https://conductatlas.com/platform/airbnb/airbnb-terms-of-service/provision/CA-P-021897/prohibition-on-bots-and-automated-platform-access/
- Airbnb NTAK-szám kötelező: https://bg.airbnb.com/help/article/2447?locale=hu
