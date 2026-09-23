# „Nem adok meg árat” · új egység ára · heti emlékeztető — JÓVÁHAGYOTT TERV

**Jóváhagyva:** 2026-09-23, tulajdonosi választás: **„A” — pipa az alapár alatt**
(a „B” két-kártyás választó elvetve). A mezőnevet (`site_unit.price_on_request`) a tulaj
jóváhagyta; az emlékeztető ütemét is (7 nap, utána hetente, korlát nélkül). ·
**Kapcsolódó:** ADR-0208 ⑥.2 · ⑥.3 · ⑥.4, ADR-0215 (az ár ideje, rétegzett sor-választás),
ADR-0197 ① (a részlegesen árazott szállás), ADR-0194 (a kifizetett-de-üres teendő-sor),
ADR-0193 ① (nem blokkolunk).
**Hatókör:** `src/server/moduleConfigViews.ts` · `src/server/adminViews.ts` · `src/engine/moduleSections.ts`

`plan.html` a megvalósítás **KONTRAKTUSA, nem stílus-javaslat.** A kész felületet ehhez
mérjük (mobil 390 + asztali). A terv 1. része a „B” változatot is mutatja — az NEM része
a kontraktusnak.

## Miért létezik

A hiányzó ár és a „szándékosan nincs ár” megkülönböztethetetlen volt. Egy tudatosan ár
nélküli szobáról a teendő-sor és az emlékeztető örökké szólt volna (zaj), a vendég-lap pedig
egy elfelejtett árat is „egyedi ár”-nak mondott. A részlegesen árazott szállásról (ADR-0197 ①)
eddig egyetlen képernyő sem szólt.

## Amit a terv KÖT

1. **Egy predikátum** (`unitPriceStatus`, `src/tenant/prices.ts`): egy szoba a következő 365
   éjszakára `complete` · `on_request` · `none` · `partial`. Ugyanezt olvassa a kártya
   állapot-sora, az Áttekintés teendő-sora és a heti levél. Az éjszakánkénti döntés a
   vendég-lapéval azonos szabály (`priceOn` → `cit-season.cjs`). A „csak a felsorolt
   időszakokban” szoba szezonon kívüli napjai zárva vannak, nem árazatlanok.
2. **A pipa** a szoba ár-kártyáján, az alapár alatt:
   **„Nem adok meg alapárat — ahol nincs ár, egyedi ajánlatot küldök”**. Kattintásra ment.
   Időtlen alapár mellett **tiltott** (minden éjszakának van ára), és az alapár mentése
   **törli** a döntést.
3. **Az állapot-sor** a pipa alatt: sárga, ha hiányos (**„Nincs ára.”** /
   **„Az év egy részére nincs ára.”**, és kimondja, hogy hetente emlékeztetünk); kék, ha
   kimondott (**„Kimondva: nem ad meg alapárat.”**, és hogy emlékeztetőt nem küldünk); teljes
   árazásnál nincs sor.
4. **Új egység felvétele** (Szobák és Foglalás lap): az árazás aktív → **„Alapár”** mező +
   **„Nem adok meg árat — egyedi ajánlatot küldök”** pipa. ⛔ A mentés **soha nem tagad
   meg**: ár és pipa nélkül is felveszi a szobát. A mentés után a visszajelzés ugyanarra a
   lapra jön, ahol a sor volt, és a hiányos kimenetnél kiutat ad: **„Árat adok meg”** (az
   Árazás lap kártyájára) és **„Nem adok meg árat”** (helyben kimondja). A rosszul beírt ár
   nem nyelődik el némán: a visszajelzés megmondja, hogy nem tudtuk értelmezni. Az ár
   értelmezése az ajánlat-lapé (`parseOfferAmount`: „26 000”, „26.000”, „26000 Ft”).
5. **Áttekintés teendő-sor**: az ár-hiányos, ki nem mondott szobák felsorolva, a
   **„Megadom az árakat”** gombbal. ⛔ Nem jelenik meg a „Töltse ki: Árak” sor mellett (az
   már azt mondja, hogy az egész üres — két sor egy hiányról két problémának olvasódna).
6. **Vendég-lap „Árak”**: a kimondott szoba **„Egyedi ajánlat alapján”** sorral szerepel
   („Egyéb időszakban”, ha van időszaki ára, különben „Egész évben”). ⛔ Pipa nélkül az
   elfelejtett árú szoba **kimarad**, mint eddig — ott az „egyedi ajánlat” állítás hamis
   lenne (§B.17). A foglaló doboz mindkét esetben árajánlatot kér (változatlan, ADR-0208).
7. **Heti emlékeztető**: az első levél 7 nap hiányos állapot után, utána hetente, korlát
   nélkül, amíg minden szobának ára van, vagy a hiányzókra ki nem mondta a „nem adok meg
   árat”-ot. Szállásonként egy levél, benne minden érintett szoba; a levél megmondja, hogyan
   állítható le (a pipával).

## Őr

`scripts/price-on-request-check.mts` — eldobható fixtúra, valódi DB + HTTP + böngésző,
mindkét méreten. Piros kontrollok kézzel lefuttatva: a vendég-lap `onRequest` ágának
kivétele → 3 bukás; a visszajelzés `#nu-flash` horgonyának kivétele → a mobil
„semmi nem takarja” állítás bukik (a süti-sáv takarja, 630 px-en).
