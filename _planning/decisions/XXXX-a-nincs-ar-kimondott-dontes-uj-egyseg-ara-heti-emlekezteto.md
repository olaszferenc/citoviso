## ADR-XXXX — A „nincs ár” kimondott döntés, az új egység ára, és heti emlékeztető a hiányos árazásról (2026-09-23)

**Dátum:** 2026-09-23 · **Státusz:** elfogadva (megvalósítva, őrrel) · **Kapcsolódó:** ADR-0208 ⑥.2
· ⑥.3 · ⑥.4 (ez a három tétel), ADR-0215 (az ár ideje; ennek a szálnak az előzménye), ADR-0197 ①
(a részlegesen árazott szállás, amiről eddig senki nem szólt), ADR-0194 (a kifizetett-de-üres
teendő-sor), ADR-0193 ① (nem blokkolunk) · **Kontraktus:** `assets/design-refs/tenant-admin/price-on-request/`
· **Migráció:** 0073.

**Kiváltó.** A tulaj mandátuma (`~/rc-briefs/arazas-nincs-ar-uj-egyseg-emlekezteto.md`): a
hiányzó ár és a „szándékosan nincs ár” megkülönböztethetetlen; új egységnél senki nem kér árat;
és a teendő-sor néma marad, ha a tulaj nem nyitja meg az admint.

### ① A DÖNTÉS

§2b kör, mindkét méreten, működő mockkal. **A tulaj az „A” változatot választotta** (pipa az
alapár alatt; a két-kártyás „B” választó elvetve).

1. **A „nincs ár” egy SZOBA kimondott döntése:** `site_unit.price_on_request` (a nevet a tulaj
   hagyta jóvá). Jelentése: *ahol erre a szobára nincs ár az árlistában, ott egyedi ajánlatot
   adok.* A szezonárak érintetlenek. ⛔ Nem egy 0 összegű sor: a `setBasePrice` a 0-t törlésnek
   veszi (így vesz le a tulaj egy árat).
   ⚠️ Az első kérdésem („szándékosan nincs ár”) a tulajnak érthetetlen volt — egy konkrét
   példával (Kati, „Nagy lakosztály”, mindig egyedi ajánlat) lett eldönthető.
2. **Hol ül a rétegzett ár-választásban** (`cit-season.cjs`: évhez kötött szezon → szezon →
   dátumos alapár → alapár → *nincs ár*): **a legalján, a „nincs ár” helyén** — nem új réteg,
   hanem a „nincs ár” két alakja (tudjuk / nem tudjuk). A vendég **mindkét esetben
   árajánlatot kér** (az ADR-0208 útja változatlan); a különbség: a kimondott szoba az „Árak”
   szakaszban „Egyedi ajánlat alapján” sorral szerepel, az elfelejtett árú kimarad (ott az
   „egyedi ajánlat” állítás hamis lenne, §B.17), és a kimondott szobáról nincs teendő-sor és
   nincs levél.
3. **Új egység** (Szobák és Foglalás lap): az árazás aktív → „Alapár” mező + „Nem adok meg
   árat” pipa. ⛔ **A mentés soha nem tagad meg** (ADR-0193 ①); a hiányos kimenet visszajelzése
   kimondja a következményt, és két kiutat ad. A rosszul beírt ár nem nyelődik el „nincs
   ár”-ként. Az ár-értelmezés az ajánlat-lapé (`parseOfferAmount`), nem második példány.
4. **Egy predikátum:** `unitPriceStatus` (`src/tenant/prices.ts`) — a következő 365 éjszaka
   a vendég-lap saját szabályával (`priceOn`): `complete` · `on_request` · `none` · `partial`.
   Ezt olvassa a kártya állapot-sora, az Áttekintés teendő-sora (`sitePriceGaps`) és a heti
   levél. A „csak a felsorolt időszakokban” szoba szezonon kívüli napja zárva van, nem
   árazatlan. Az időtlen alapár mentése **törli** a kimondott döntést (különben egy későbbi
   alapár-levétel egy aznap meg nem hozott döntést hozna vissza).
5. **A teendő-sor lefedi a részleges esetet** (ADR-0197 ①, amit egyik kapu sem látott), de
   ⛔ nem áll a „Töltse ki: Árak” sor mellé — az már azt mondja, hogy az egész üres.

### ② A HETI EMLÉKEZTETŐ

Ütem (tulajdonosi döntés): **az első levél 7 nap hiányos állapot után, utána hetente, korlát
nélkül.** Az én javaslatom 3 levéles korlát volt; a tulaj a korlát nélküli változatot
választotta. Szállásonként EGY levél, benne minden érintett szoba; a levél megmondja, hogyan
állítható le (a pipával). Mezők a `site`-on (a tulaj jóváhagyta): `price_gap_since` (az
epizód kezdete, a tick állítja és törli), `price_gap_reminded_at` (feltételes UPDATE-tel
foglalva). Csak `live` oldal kap levelet. Óránkénti tick: `scripts/booking-maintenance.mts`, a
dátumos-ár menet UTÁN (egy épp lejárt ablak nyithatja a rést).

**Miért 7 nap, és mért zaj:** élesen ma egyetlen árazott tenant van (`nyugalom-demo`, mindhárom
szobája árazott → 0 levél). A dev-parkban 9 egységből 6 árazatlan (eldorado 4, roze 1, agrosz
1), mind 2–3 napos → a 7 napos küszöb alatt még egy sem kapna levelet. Az első héten a tulaj
jellemzően az adminban állít be (ott a kártya és a teendő-sor már szól), és minden beérkező
árajánlat-kérés eleve levelet küld neki (ADR-0215).
⚠️ **Nyitott: a zajt valódi adaton nem lehetett megmérni** — nincs rá éles minta. Az első
valódi tenantoknál érdemes visszanézni, hány levél megy ki szállásonként.

### ③ AMIT A MÉRÉS FOGOTT MEG, NEM A GONDOLKODÁS

1. **A visszajelzés mobilon nem látszott**, miközben az `isVisible()` zöld volt: a lap közepén
   ült, a süti-sáv és a fix alsó menü alatt (mérve: 630 px, `elementFromPoint` →
   `cit-consent__no`). Javítás: az átirányítás `#nu-flash` horgonnyal megy. ⛔ Közben a saját
   mérésem is hazudott: a `citui.css` `scroll-behavior:smooth`-t állít, így a görgetés
   animált, és az azonnali mérés „takarja”-t mondott — erre egy felesleges görgető szkriptet
   írtam, amit a piros kontroll leleplezett (nélküle is zöld volt), és kivettem. Az őr most
   a görgetés megállására vár, és a termék VALÓDI átirányítását nyitja meg (nem beégetett
   horgonyt).
2. **A levél egy mondata hamis lett volna:** „Ezek a szobák már 7 napja ár nélkül állnak” — egy
   epizód közben felvett szobára nem igaz. A 7 nap a szállás epizódja: „A szállása árazása
   {days} napja hiányos.”
3. **Két összerakott feliratot idéztem szó szerint a súgóban** — a `kb-check` fogta meg.
4. **A `kb-shot` fixtúrája szállt volna el:** a `scripts/` nincs típus-ellenőrizve, és az új,
   kötelező `status` mező hiányzott belőle.

### ④ AZ ŐR

`scripts/price-on-request-check.mts` (bekötve a `hooks/pre-commit`-be) — a predikátum kézzel
felírt elvárásokon; eldobható fixtúra, valódi DB + HTTP + böngésző, mindkét méreten; az új
egység négy kimenete; negatív kontroll `pricing` nélkül; a heti levél a naptárat léptetve
(CSAK a saját fixtúra-site-on — `onlySiteId`, mert a dev-DB közös), a kézbesített levelekből.
Piros kontrollok kézzel: a vendég-lap `onRequest` ága nélkül 3 bukás · a `#nu-flash` nélkül a
mobil láthatóság bukik · a 7 napos várakozás nélkül 2 bukás · ha a kimondott szoba is „hiány”,
9 bukás.

### ⑤ AMI NYITVA MARAD

1. ADR-0208 ⑥.5 felülete (évhez kötött szezon, „Főszezon 2027”, szezon-végi nudge) — a
   párhuzamos szál viszi; ehhez nem nyúltam.
2. A szoba-kártya (Szobák modul) ár-sora a kimondott szobánál nem ír „egyedi ajánlat”-ot —
   a terv nem kérte; az „Árak” táblázat mondja ki.
3. A heti levél zaja valódi adaton (lásd ②).
