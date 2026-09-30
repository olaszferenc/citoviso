# FK-011 — Elek MEGVESZI a honlapot, TELEFONON: a kiküldött tervtől a saját adminjáig

cél: Elek szállásadó, aki a telefonján megnyitja a neki küldött terv-lapot, és ott helyben megveszi az alap honlapot — végig egy kézzel, 390 px-en, először látva a felületet. Az ítélet: érti-e, mit vásárol, mennyibe kerül, mikor terhelnek, és a fizetés után BE TUD-E LÉPNI a saját adminjába. A körben a lokál MOCK fizetés-kapu fut (charter: külső gateway tilos) — a mérés tárgya a MI felületünk, nem a bank oldala.
felület: konzol
nézet: telefon
kontraktus: assets/design-refs/prospect-page/order-pill/README.md

## Előkészítés

- [ ] A kiküldött terv-lap megnyílik telefonon, és a rendelő gomb kint van
  user: anon
  út: ${ELEK_NIGHT_PROSPECT_PATH}
  várd: látható "${ELEK_NIGHT_NAME}"
  várd: látható "Itt rendelheti meg"
  # A süti-sáv z-indexe (2147483600) a panel és a pirula FÖLÖTT van: ha nem tűnik el,
  # minden alatta lévő koppintás a sávra megy. Best-effort, mert a második futásban
  # már nincs ott.
  tedd?: kattints ".cit-consent__yes"
  # A portál fotói a MOCK lapon a forrás-portálról jönnek; a portál 429-cel korlátoz,
  # ha rövid időn belül sokszor kérjük ugyanazt (mérve 2026-09-27: a fotó-letöltésem
  # után). Nem a mi hibánk és nem a mérés tárgya — de kimondva tűrjük, nem némán.
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja, nem a felület hibája
  
## ① A terv-lap a vevő szemével

- [ ] Az első képernyőn Elek látja a SAJÁT szállását, és hogy ez egy ajánlat neki
  kézi: a 390-es ÉS a fekvő képen: felismeri-e a saját szállását (név, fotó); kiderül-e, hogy ezt NEKI készítettük és MEGVÁSÁROLHATÓ; a rendelő pirula ujjal elérhető-e (≥ 44 px) és nem takarja-e a süti-sáv vagy a Foglalás-sáv; a lap NEM kelti-e azt a látszatot, hogy már él

## ② Rendelés, 1. lépés — a csomag

- [ ] A kedvezmény-kártya (ha feljön) nem zsákutca: el lehet halasztani
  # ADR-0088: a /pricing-on beállított N. megnyitáskor (ADR-0285, alapból a harmadiknál) a lap
  # egy döntés-segítő kártyát dob fel — ezért opcionális lépés, a küszöbtől függetlenül fut. MÉRVE
  # (2026-09-27, ez a futás): a kártya TAKARTA a rendelő pirulát 390 px-en — a kattintás
  # a kártya egyik span-jére esett (elementFromPoint), és a teljes vásárlási lánc megállt.
  # MÉRVE (2026-09-27, `_probe-pill`): a kártya (.cit-cfg-esccard, z=2147483300) és a
  # fátyla (.cit-cfg-escveil) MINDHÁROM megnyitáskor feljött, és a rendelő pirula
  # (z=2147483000) fölött ült — a lap fő művelete alatta volt. A kártya késve úszik be,
  # ezért előbb megvárjuk, és csak utána zárjuk.
  # ⛔ MÉRT LELET (2026-09-27): amikor a süti-sáv (z=2147483600) és a kedvezmény-kártya
  # egyszerre van kint 390 px-en, a SÁV TAKARJA a kártya gombjait — a „Most még
  # gondolkodom" kattintás a `.cit-consent__b`-re esett. A sáv késve is feljöhet, ezért
  # itt ÚJRA elfogadjuk, mielőtt a kártyához nyúlnánk.
  tedd?: kattints ".cit-consent__yes"
  tedd?: várj-kattinthatóra ".cit-cfg-esclater" 12
  tedd?: kattints ".cit-cfg-esclater"
  # A zárás 0,4 mp-es áttűnés (opacity+transform), és a kártya MOBILON alulra van
  # horgonyozva — pontosan oda, ahol a rendelő pirula ül. Egy ujj ezt nem érzi, a
  # runner viszont azonnal kattintana a még animáló rétegbe: megvárjuk a végét.
  tedd?: görgess ".cit-cfg-launch"
  # A lépés MONDJA KI, sikerült-e a zárás — enélkül a néma best-effort bukás a
  # KÖVETKEZŐ lépésen jelenne meg „takarva" alakban, és ott már nem derülne ki, hogy
  # a kártya maradt nyitva (mérve: háromszor futott így).
  várd: darab ".cit-cfg-esccard.cit-cfg-on" == 0
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja, nem a felület hibája
  kézi: a 390-es képen: a kedvezmény-kártya mekkora részét takarja a lapnak; van-e rajta
    egyértelmű bezárás; a „Most még gondolkodom" ujjal elérhető-e — és ha a tulaj mellé
    koppint, visszakerül-e a lapra, vagy a kártya marad

- [ ] A rendelő gomb megnyitja a panelt, és a panel a lényeget mondja elöl
  tedd: görgess ".cit-cfg-launch"
  tedd: kattints ".cit-cfg-launch"
  várd: látható "Ez az Ön leendő weboldala"
  várd: látható "Most nem fizet semmit"
  kézi: a panel 390-en mennyit takar a lapból, és görgethető-e; a csomag-kártyák olvashatók-e; egy kezdő érti-e, hogy MOST még nem fizet

- [ ] Az ALAP csomagot választja (a minimum: képek, elérhetőség, térkép)
  tedd: kattints "[data-preset='alap']"
  kézi: a választott csomag KIJELÖLTNEK látszik-e (nem csak a szegély színe), és kiderül-e, mi VAN benne és mi NINCS; a havi/éves váltó egy sorban elfér-e 390-en

- [ ] A „Tovább" a pénzügyi lépésre visz
  # ⛔ `kattints "Tovább"` KÉTÉRTELMŰ: a „Tovább a számlázási adatokhoz" is tartalmazza,
  # és mindkettő a DOM-ban van. A horog a szelektor.
  tedd: kattints ".cit-cfg-next"
  várd: látható "Fizetés módja"
  várd: látható "Milyen gyakran fizet?"

## ③ Rendelés, 2. lépés — mennyibe kerül és mikor

- [ ] A havi és az éves ár összevethető, és az éves kedvezmény kimondott
  kézi: a két kártya (Havi „rugalmas, bármikor" / Éves „a legjobb ár") 390-en egymás alatt olvasható-e; a „−N hó" jelvény érthető-e; a most fizetendő összeg és a következő terhelés dátuma szerepel-e; a vevő tudja-e, mit fizet MA és mit egy év múlva

- [ ] A havi fizetést választja
  tedd: kattints ".cit-cfg-permat .cit-cfg-popt[data-period='monthly']"
  kézi: a választás visszajelzése látszik-e, és az összeg átírta-e magát

- [ ] A fotó-jogról szóló nyilatkozat nélkül nem lehet továbbmenni — és ez látszik is
  kézi: a képen: a „Tovább a számlázási adatokhoz" gomb TILTOTTNAK néz-e ki, amíg a fotó-jogi sor nincs bejelölve (nem csak az attribútuma tiltott); a nyilatkozat szövege 390-en elolvasható-e, vagy egy sorba szorul

- [ ] A nyilatkozat bejelölve a gomb megnyílik, és a számlázási lépésre visz
  tedd: kattints ".cit-cfg-rights"
  tedd: kattints ".cit-cfg-submit"
  várd: látható "2/2 lépés"
  várd: látható "Kinek állítsuk ki a számlát?"

## ④ Számlázás és fizetés — egy kézzel, billentyűzettel

- [ ] Magánszemélyként számláz, és kitölti az adatait
  tedd: kattints "[data-btype='individual']"
  tedd: írd "[data-f='buyer_name']" "Elek Éjszakai Tesztgazda"
  tedd: írd "[data-f='buyer_zip']" "${ELEK_NIGHT_ZIP}"
  tedd: írd "[data-f='buyer_city']" "${ELEK_NIGHT_CITY}"
  tedd: írd "[data-f='buyer_address']" "Fő utca 12."
  tedd: írd "[data-f='buyer_email']" "elek@citoviso.com"
  kézi: 390-en a mezők egy oszlopban, feliratozva állnak-e; a numerikus mezőknél számbillentyűzet jön-e; a billentyűzet nem takarja-e a következő mezőt és a fizető gombot; a hibaüzenet a mező MELLETT jelenik-e meg

- [ ] A hozzájárulásokat bejelöli, és a gomb kimondja, mennyit terhelünk
  tedd: kattints ".cit-cfg-waiver"
  tedd?: kattints ".cit-cfg-terms"
  tedd?: kattints ".cit-cfg-recurring"
  várd: látható "Fizetek —"
  kézi: a képen: hány sort kell bejelölni, és a lap megmondja-e, mennyi van még hátra; a „Biztonságos fizetés a Barionnál." megjelenik-e, amikor mind bejelölve; a fizető gomb a hajtás fölött van-e 390-en ÉS fekvőben

- [ ] A fizetés indítása a próba-kapura visz
  tedd: kattints ".cit-cfg-pay"
  tedd: várj "Próba-fizetés — valódi pénz nem mozdul" 30
  várd: látható "Próba-fizetés — valódi pénz nem mozdul"
  kézi: a vevő tudja-e, hol jár (a kapu lapja megnevezi-e a terméket és az összeget); 390-en a fizető gomb elérhető-e

## ⑤ A fizetés megtörténik, és az oldal élesedik

- [ ] A sikeres fizetés után a lap kimondja, hogy az oldal ÉL, és megadja a belépést
  # A próba-kapu gombja 390 px-en RÁLÓG a kártyaválasztóra (mérve 2026-09-27, lásd a
  # 14. kép) — előbb a nézetbe hozzuk, és megvárjuk, hogy tényleg kattintható legyen.
  tedd: görgess "form[action$='/paid'] button"
  tedd: várj-kattinthatóra "form[action$='/paid'] button" 15
  tedd: kattints "form[action$='/paid'] button"
  tedd: várj "Sikeres fizetés" 40
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a háttérben még töltő mock-lap), nem a felület hibája
  várd: látható "Sikeres fizetés"
  várd: látható "Hivatkozási azonosító:"
  adat: ELEK-NIGHT tenant + site (a vásárlásból)
  kézi: a képernyő megmondja-e: (1) hogy az oldal MOSTANTÓL él és HOL, (2) mikor lesz a következő terhelés, (3) hogyan lép be — és hogy a JELSZÓ a levélben jön; 390-en mindez egy görgetéssel átlátható-e; a „Másolom" gomb működik-e ujjal

- [ ] A belépés-út a képernyőről is elindítható
  kézi: a képen: van-e „Belépek és szerkesztem" gomb, és a felhasználónév OLVASHATÓ-e róla; ha a gomb hiányzik (absolute loginUrl nélkül nem renderel), az önálló lelet: a friss vevő a képernyőről nem tud belépni

## ⑦ Összkép

- [ ] Egy IT-kezdő szállásadó végig tudta volna vinni a vásárlást a telefonján?
  kézi: a futás minden képe alapján: hol állt volna meg, melyik lépés volt a legnehezebb ujjal, hol nem derült ki, mennyit fizet, és mi hiányzott a fizetés utáni képernyőről
