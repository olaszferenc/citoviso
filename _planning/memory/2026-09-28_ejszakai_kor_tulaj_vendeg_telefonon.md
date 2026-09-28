# 2026-09-28 — Éjszakai kör: Elek megveszi, feltölti és vendégként kipróbálja a honlapot TELEFONON

A tulaj kérése (2026-09-27 este): „Elek vegyen egy alap honlapot valamelyik bőséges leadből.
Majd az admin felületen vegyen meg minden modult és töltse fel minden információval… Mindezt
telefonon úgy, mint akinek alacsony a jártassága és az egész felületet most látja először.
Aztán Elek váltson szerepet egy vendégre, aki rátalál a honlapra… és akkor foglal, ha mindent
egyértelműnek lát. Aztán a foglalás utóéletét is végig kell követni." + „ha megakad valahol,
jegyezzük, nézzünk meg több variációt, de ne fagyjunk be azon a helyen".

## Miért ez hiányzott

A felderítés (3 szál) kimutatta: **igazi telefon-kontextusban (touch + isMobile, 390-en futó
ellenőrzésekkel) eddig EGYETLEN forgatókönyv futott, az FK-010 — és az is MOCK fájlon.** Az
éles `/t/<slug>/` mobil-mérések a `["booking","pricing","rooms","gallery"]` fixtúrára szűkültek
és tartalmi állítások voltak, nem ergonómiaiak; a tenant-admin telefonos mérései fixtúra-HTML-en
álltak, valódi mentés mobilon csak négy helyen volt (Árak/szezonok · Elérhetőség · Programajánló
· Súgó). Egyetlen kör sem vitt végig EGY bérlőt: vásárlás → modulok → adatfeltöltés → vendég-út.

## Mi készült

Hat új forgatókönyv, mind `nézet: telefon` (igazi touch-kontextus, 390×844 + fekvő 844×390):

| FK | Mit játszik le |
|---|---|
| FK-011 | A kiküldött terv-lapról megveszi az alap honlapot, a mock-kapun fizet, belép |
| FK-012 | Megveszi az összes modult a Modulok fülön |
| FK-013 | Feltölt mindent: 18 fotó, 3 egység, alapárak, 3 szezon, felszereltség, USP, nyitvatartás, cím+térkép, programok, foglalás-szabályok, nyelvek |
| FK-014 | A VENDÉG a kész honlapon: tájékozódás, szobák, árak, galéria, foglalás, árajánlat, vélemény |
| FK-015 | A tulaj telefonon dönt a kérésről (Üzenetek → Foglalások), árat ad, véleményt enged |
| FK-016 | A vendég az utóélet linkjein: lemondás, ajánlat elfogadása, foglalt napok |

Vezénylő: `elek/bin/run-night.mts` — sorban futtat, a következő kör bemenetét a DB-ből MÉRI
(bérlő, slug, belépés, lemondó-token, ajánlat-token), hiányzó bemenetnél KIMONDOTT kihagyás.
Alany: **Három Huszár Apartments** (bőséges hideg lead: jóváhagyott mock, 24 élő portál-fotó,
nem vásárolt). A fotók a lead portál-képei, letöltve (48 KB – 679 KB, valódi méretek).

## Ameddig eljutott

- **FK-011 — a vásárlás VÉGIGMENT telefonon.** Bérlő létrejött, a honlap `live`
  (`harom-huszar-apartments`), fizetés a mock-kapun át. 3 pass · 12 kézi · 0 blokkolt.
- **FK-012 — minden modul megvéve** (11 aktív: amenities, booking, gallery, hours, location,
  poi, pricing, reviews, rooms, usp + a gerinc enquiry), mind FIZETVE (`payment.paid`).
- **FK-013 — az adat nagy része bement**: 3 egység (Nádas apartman 4 fő / Kisházi szoba 2 fő /
  Kerti stúdió 3 fő), alapárak (24 000 / 16 000 / 19 000), felszereltség, USP, nyitvatartás,
  cím + megközelítés. NEM ment át: a szezonok (naptáras dátumválasztó), a programok mentése,
  a második fotó-adag.
- **FK-014 — a vendég-út a foglalásig eljutott**, de a beküldés nem (lásd ⑤ lelet).
- **FK-015 / FK-016 — nem futott**: foglalás nélkül nincs mit eldönteni és nincs lemondó-link.

## A LELETEK (mind mérve, nem képről ítélve)

### ① A vendég NEM TUD FOGLALNI — a második lépésben csak árajánlatot kérhet
Mérve (`_probe-widget`, 390×844 touch): a dátumok (2026-10-24 → 10-26) megadása után az első
lépés gombja **„Tovább a kérés adataihoz (2 éjszaka)"** — tehát a widget ismeri az időszakot.
A „Tovább" után viszont a **„Foglalási kérés elküldése" gomb 0×0 (REJTETT)**, és helyette az
**„Árajánlatot kérek" (296×52) látszik** — pedig mindhárom egységnek van alapára (`unit_price`,
24 000 / 16 000 / 19 000) és a `booking` modul aktív. A két lépés két különböző dolgot állít az
árról. Egyetlen HTTP- vagy konzol-hiba sem keletkezik: a vendég számára ez néma zsákutca.
**Ez a legsúlyosabb lelet: a bevételi út vége nem járható végig telefonon.**

### ② A modul-vásárlás összegző sávja a képernyő 48%-át elveszi
Mérve (`_probe-planbar`, 390×844): egy modul hozzáadása után az `#adm-planbar` **407 px magas
(a képernyő 48%-a), a 367–774 sávot foglalja**, alatta az alsó navigáció (785–844). Középre
görgetve MINDEN további modul „Hozzáadom" gombja a sáv alá esik (usp · reviews · poi · hours ·
booking · newsletter — a gomb közepén a `div.adm-planbar`); felülre görgetve a felső fejléc
takarja. A használható ablak ~310 px. Következmény: telefonon **gyakorlatilag csak egyesével**
lehet modult venni (a kör így vitte végig, öt külön fizetéssel).

### ③ A süti-sáv a BEJELENTKEZETT tenant-adminban is kint van
Mérve (`_probe-consent-admin`): a sáv gyökere osztály nélküli `div`, `position:fixed`,
`z-index:2147483600`, **390×125 px (a képernyő 15%-a), a 660–784 sávban** — pont a mentés-gombok
magasságában. Takarva mérve: a Modulok kirakat gombjai (pricing · reviews · hours · newsletter)
és több modul-szerkesztő „Beállítások mentése" gombja (Megközelítés · Vélemények · Foglalás).
Egyszeri „Elfogadom" után eltűnik és nem jön vissza — de a tulaj ELSŐ munkamenetében takar.

### ④ Néma elakadás a szoba-felvételnél
A tulaj kitölti a nevet, a férőhelyet, az árat, megnyomja a **„Hozzáadás"**-t — és nem történik
semmi. Ok: a szállásnak már van egy egysége („A szállás egésze"), ezért kötelező az **„Az egész
szállást is kiadja egyben?"** választás, ami a mezők FÖLÖTT, 390 px-en a képernyőn kívül van.
A kép (`FK-013 … /shots/06-mobil.png`) mutatja: a kitöltött űrlap alatt a „Hozzáadás", a döntés
kérdése pedig fölötte, külön képernyőn. Ráadásul a lapon **két hasonló űrlap** van egymás alatt
(a meglévő egységé és az újé) — az első kísérletben a mérés is a rosszba írt, mint egy kezdő tulaj.

### ⑤ A kivezetett hírlevél-modul eladásra kínálva
`newsletter` a katalógusban `retired: true`, a bérlői lista mégsem szűri: a kirakatban
„Hírlevél feliratkozás" néven, saját „Hozzáadom" gombbal, 490 Ft/hó áron áll.

### ⑥ A kedvezmény-kártya a rendelő pirulára ül telefonon
A terv-lapon az ADR-0088 kártya (`z=2147483300`) + fátyla mindhárom megnyitáskor a **rendelő
pirula (`z=2147483000`) fölé** került; mobilon a kártya alulra horgonyzott — oda, ahol a pirula
ül. Amikor a süti-sáv (`z=2147483600`) is kint van, az viszont a KÁRTYA gombjait takarja
(„Most még gondolkodom" a `.cit-consent__b`-re esett). Három réteg ugyanazon a 100 px-en.

### ⑦ Az „Árak, szezonok" modulért fizet, de nem látja a honlapján
Ha minden egységnek csak alapára van és a szobakártyák mutatják, az ártábla nem renderel
(ADR-0059 §2 — szándékos, hogy ne ismételjük ugyanazt). A tulaj viszont 490 Ft/hó-t fizet érte,
és a honlapján semmi nem jelzi, mit kapott. **Tulajdonosi döntést kér.**

### ⑧ A próba-fizetés lapon a „Fizetek" gomb rálóg a kártyaválasztóra (390 px)
Dev-eszköz (éles vevő a Barion lapját látja), de a mérést zavarja.

### Nyitva maradt (reggeli folytatás)
- a szezon-felvétel naptáras dátumválasztója telefonon nem ment végig a runner alatt;
- a programajánló mentése („Mentés a honlapra") nem adott visszajelzést;
- a második fotó-adag feltöltése instabil (az első 12 egyszer átment, másodszor nem).

## Eszköz-oldali javítások (a mérés maga is hazudott)

- **`isSelector` szűk felismerő, kétszer**: a `form[action$='/paid'] button` és a
  `form:has(…)` alak nem `#`/`.`/`[` kezdetű, ezért a runner LÁTHATÓ SZÖVEGKÉNT kereste — a
  próba-fizetés gombja sosem kapott kattintást, és a bukás egy lépéssel később, „nem jelent meg
  időben" alakban jelent meg. Most az elem-típussal kezdődő szelektorok (`form[…]`, `button.x`,
  `form:has(…)`) is felismertek.
- **A néma `tedd?:` bukás hangos lett**: a best-effort akciók hibája `skipped_optional`-ként a
  naplóba kerül. Enélkül a lenyelt „kártya-bezárás" a KÖVETKEZŐ lépésen jelent meg „takarva"
  alakban — három kör ment el rá.
- **Új igék**: `töltsd-fel "<szelektor>" "<fájlok>"` (fotó-feltöltés, a rejtett input-ra),
  `várj-kattinthatóra "<szelektor>" [mp]` (a `várj` a SZÖVEG megjelenésére vár, és egy
  `opacity:0; pointer-events:none` réteg szövege MÁR látható a Playwright szerint),
  `görgess-középre "<szelektor>"` (a `scrollIntoViewIfNeeded` nem mozdít egy tapadó sáv ALATT
  „látszó" gombon).
- Az `írd` érti a `\n` escape-et (többsoros mezők egy forgatókönyv-sorban).

## Helyesbítés a tulaj felé

Este azt javasoltam, hogy a modul-vásárlás **valódi Barion-sandbox** fizetéssel menjen, és a
tulaj ezt fogadta el. Utóbb kiderült: az Elek-charter **mechanikusan tiltja** a külső
fizetés-gateway-t a körben (`PAYMENT_GATEWAY=mock` kényszerítve, mérve 2026-09-05: a valódi
hosted page-re navigált), és a telefonos ítélet tárgya a MI felületünk, nem a bank oldala.
A kör ezért a lokál mock-kapun futott. A sandbox-fizetés amúgy is igazolt (2026-09-24/26).

## Fájlok

`elek/scenarios/FK-011…FK-016-*.md` · `elek/bin/run-night.mts` · `elek/bin/runner.mts`
(új igék, felismerő, hangos best-effort) · futások: `elek/runs/FK-01*-NIGHT-*/`
