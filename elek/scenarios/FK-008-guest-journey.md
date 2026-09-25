# FK-008 — A VENDÉG szemével: szállást keresek, foglalok, ajánlatot kapok, lemondok, véleményt írok

cél: Elek most nem a Citoviso embere, hanem egy szállást kereső vendég, aki a rendszert nem ismeri (charter: „Elek mint vendég"). Az ELEK-TESZT Vendégház élő oldalán végigmegy mindenen, amit egy vendég tehet — tájékozódás, szobák és árak, foglalási kérés hibás és jó bemenettel, árajánlat-kérés ár nélküli időszakra, egy kapott ajánlat elfogadása, egy visszaigazolt foglalás lemondása a levélbeli linkről, vélemény beküldése —, és az EGYÉRTELMŰSÉGET és az ERGONÓMIÁT ítéli: minden képernyőn tudja-e, hol jár, mi történt, mi a következő lépése, és mibe kerül ez neki. (A fagyasztott honlap vendég-lapját az FK-006a méri; a mock-lapot a vendég szemével az FK-008b.)
felület: publikus
kontraktus: assets/design-refs/tenant-admin/foglalasok-README.md · _planning/decisions/0150-vevo-es-vendeg-oldali-megerosites-a-rendszer.md · _planning/decisions/0215-*.md (árajánlat-út) · _planning/decisions/0157-a-fagyasztott-honlap-vendeg-lapja-nem-iger.md

## Előkészítés

- [ ] A szállás oldala megnyílik, a foglalás-szekció rajta van (a vendég egy keresőből/linkről érkezik ide)
  user: anon
  út: /t/elek-teszt-vendeghaz/
  várd: látható "ELEK-TESZT Vendégház"
  várd: darab "[data-cit-module='booking']" >= 1
  várd: darab "[data-cit-module='rooms']" >= 1

## Első benyomás — öt másodperc

- [ ] A lap tetejéről kiderül, HOL vagyok, MIT kapok és MI az elsődleges művelet
  kézi: MINDKÉT képen az első képernyőnyi tartalomból ítéld meg: (1) egyértelmű-e, hogy ez egy szálláshely honlapja és melyiké, hol van; (2) látszik-e, mit kínál (szoba/apartman/egész ház), (3) van-e egyetlen, félreérthetetlen elsődleges gomb (foglalás), és az a telefonos képen (390px) a hajtás fölött van-e; (4) NINCS-e semmi, ami a Citovisóra, „mintára", tervre vagy vásárlásra utal — a vendég nem vevő, ő a szállásadó vendége
  kézi: a fejléc-menü tételei: érti-e egy vendég, hova visznek, és a telefonos képen elérhető-e a menü (nem szorul ki, nem takar)

## Szobák és árak — mennyibe kerül?

- [ ] A szoba/apartman kártyáján a vendég az ÁRAT és a férőhelyet találja, nem csak egy fotót
  várd: látható "Ft"
  kézi: a kártyán (mindkét méret) ott van-e: ár „-tól / éj" alakban, férőhely, és hogy mi a különbség a több egység között — ha csak egy egység van, kimondja-e, hogy az EGÉSZ szállás az ajánlat; a képek nem törött ikonok

- [ ] A „Részletek" megnyitható, és többet mond, mint a kártya
  tedd: kattints "Részletek"
  kézi: a megnyíló részletek (felszereltség, leírás) a képen olvashatók-e, ÉS van-e onnan út a foglaláshoz — vagy zsákutca, ahonnan vissza kell görgetni

- [ ] Az ártábla időszakonként mondja meg, mikor mennyi — és amire nincs ár, azt is kimondja
  út: /t/elek-teszt-vendeghaz/
  várd: látható "Főszezon"
  várd: látható "Őszi szünet"
  kézi: az ártábla (mindkét méret) olvasható-e görgetés nélkül, egyértelmű-e az „éjszakánként" — és MIT mond a két szezonon KÍVÜLI időszakról: a widget ugyanerre „egyedi árat ad"-ot ír; ha a tábla erről hallgat (nincs sor, nincs „Egyedi ajánlat alapján"), a vendég két helyen két igazságot lát

## Amit még a vendég néz: fotók, hol van, mi van a környéken, vélemények

- [ ] A galéria fotói betöltenek, és a képek a szállásról szólnak
  várd: darab "[data-cit-module='gallery']" >= 1
  kézi: a fotók MEGJELENNEK-e (nem törött kép, nem szürke doboz), és telefonon (390px) a galéria nem nyúlik végtelen hosszúra; a nagyítás/lapozás felismerhető-e

- [ ] Hol van a szállás, hogyan jutok oda, mit lehet ott csinálni
  kézi: van-e térkép/megközelítés ([data-cit-module='map']) és környék/program ([data-cit-module='poi']) szekció — ha NINCS, az önálló lelet (a vendég egyik első kérdése: hol van, mit csináljak ott); ha van: a program-sorok dátuma a jövőben van-e, és a forrás-link látható-e

- [ ] Érkezés–távozás, felszereltség, elérhetőség
  kézi: nyitvatartás/érkezési idő ([data-cit-module='hours']), felszereltség ([data-cit-module='amenities']), telefon/e-mail — a vendég megtalálja-e, hogy MIKOR érkezhet és KIT hívhat; a telefonszám telefonon (390px) koppintható linknek látszik-e

- [ ] A vélemény-szekció igazat mond: valódi vélemény vagy őszinte üres állapot, nem hamis csillagok
  várd: látható "Vendégek véleménye"
  kézi: ha nincs még valódi vélemény, a szekció ezt kimondja-e (és nem mutat kitalált értékelést); ha van Google-értékelés ([data-cit-module='google-rating']), a szám és a darabszám látszik-e

# ⚠️ A vélemény ELŐBB megy, mint a foglalások: a publikus beküldések (foglalás,
# érdeklődés, vélemény) EGY közös, IP-nkénti számlálón ülnek, és a véleményé 3/10 perc —
# három foglalás-beadás után a vélemény 429-et kapott (mérve 2026-09-24). Ez önmagában
# lelet (egy vendég, aki foglalt, utána nem tud véleményt írni ugyanarról a gépről).
## Vélemény írása — jártam ott, elmondom

- [ ] A vélemény-űrlap megtalálható, és kimondja, mi történik a beküldött szöveggel
  út: /t/elek-teszt-vendeghaz/
  várd: látható "Járt már nálunk? Írja meg, milyen volt"
  várd: látható "Hozzájárulok, hogy a nevem és a véleményem megjelenjen a honlapon."
  kézi: a vendég tudja-e az űrlapból, hogy a véleménye NEM azonnal jelenik meg (moderáció), és hogy az e-mail címe nem lesz nyilvános; az űrlap 390px-en egy oszlopban, mezőnként olvasható-e

- [ ] A vélemény beküldhető, és a válasz megmondja, mikor és hol jelenik meg
  tedd: írd ".cit-rev-f [name='name']" "Elek Vendég Egy"
  tedd: válaszd ".cit-rev-f [name='rating']" "5 — Kiváló"
  tedd: írd ".cit-rev-f [name='body']" "Csendes, tiszta, a házigazda nagyon segítőkész volt. Jövünk máskor is."
  tedd: írd ".cit-rev-f [name='email']" "elek@citoviso.com"
  tedd: kattints ".cit-rev-f [name='consent']"
  tedd: kattints "Vélemény elküldése"
  várd: látható "Köszönjük a véleményét"
  várd: látható "Vissza az oldalra"
  adat: ELEK-TESZT vélemény (Elek Vendég Egy, jóváhagyásra vár)
  kézi: a köszönő-lap külön lap-e (elhagyta az oldalt) vagy helyben jelenik meg — ha külön lap: a „Vissza az oldalra" a szállás oldalára visz-e; a lap mondja-e, hogy a szállásadó dönt a megjelenésről

## Foglalás — hibás bemenetek (mit mond nekem a rendszer?)

- [ ] Üresen elküldve a rendszer megmondja, mi hiányzik — nem némán nem történik semmi
  út: /t/elek-teszt-vendeghaz/
  tedd: kattints "Foglalási kérés elküldése"
  várd: látható "Adja meg az érkezés és a távozás napját."
  kézi: a hibaüzenet a GOMB KÖZELÉBEN jelenik-e meg (a képen a gomb és az üzenet egy képernyőn van-e, 390px-en is), és a hibás mezőre mutat-e

- [ ] Fordított dátumokra (távozás az érkezés előtt) érthető üzenet jön
  tedd: írd "#cit-from" "2026-10-26"
  tedd: írd "#cit-to" "2026-10-24"
  tedd: kattints "Foglalási kérés elküldése"
  várd: látható "A távozás legyen későbbi az érkezésnél."

- [ ] Foglalt napokra a rendszer megmondja, hogy foglalt — és a naptárban is látszik, melyik
  tedd: írd "#cit-from" "2026-11-19"
  tedd: írd "#cit-to" "2026-11-21"
  tedd: kattints "Foglalási kérés elküldése"
  várd: látható "Sajnos ezek a napok már foglaltak. Válasszon másik időpontot."
  várd: nem látható "egyedi árat ad"
  kézi: a naptárban a 2026-11-20 foglalt napként JELÖLT-e, és a jelölés megkülönböztethető-e a szabad naptól (szín + nem csak szín); az üzenet segít-e másik időpontot találni, vagy csak elutasít

- [ ] Múltbeli dátumra a rendszer nem fogadja el a kérést — és megmondja, mikortól lehet
  tedd: írd "#cit-from" "2026-01-10"
  tedd: írd "#cit-to" "2026-01-12"
  tedd: írd "#cit-name" "Elek Vendég Egy"
  tedd: írd "#cit-email" "elek@citoviso.com"
  tedd: írd "#cit-phone" "+36 30 555 0001"
  # 2026-09-24 (Elek Z3): múltbeli dátumra a widget „egyedi árat ad"-ot írt és
  # árajánlat-gombra váltott; a „legkorábbi érkezés" csak a szerver 400-ából derült ki.
  # Azóta a widget a beküldés ELŐTT mondja ki, és a gomb tiltott — kattintás nincs.
  várd: látható "A legkorábbi foglalható érkezés"
  várd: nem látható "egyedi árat ad"
  kézi: az üzenet a dátum-mezők KÖZELÉBEN van-e (390px-en is), és a gomb tiltottnak NÉZ-e ki

- [ ] Név nélkül a rendszer a nevet kéri (jó dátumokkal)
  tedd: írd "#cit-from" "2026-10-24"
  tedd: írd "#cit-to" "2026-10-26"
  tedd: írd "#cit-name" ""
  tedd: kattints "Foglalási kérés elküldése"
  várd: látható "Kérjük, adja meg a nevét."

## Foglalás — a jó út: ár a dátumokra, létszám, nyugta

- [ ] A dátumok kiválasztása után az ÁR AZONNAL kiírva, a szezon megnevezve, és a létszám állítható
  várd: látható "Összesen a szállásért"
  várd: látható "56 000 Ft"
  várd: látható "Őszi szünet"
  tedd: kattints "[data-step='1']"
  várd: szövege "[data-guests]" = "3"
  kézi: az ár-összegzés (2 éj × 28 000) a képen a gomb FÖLÖTT, olvashatóan van-e; a létszám-léptető ujjal eltalálható méretű-e 390px-en; a „fizetés a helyszínen" mondat a vendégnek egyértelmű-e

- [ ] A kérés elküldése után a vendég TÉTELES nyugtát kap, és tudja, mi a következő lépés
  tedd: írd "#cit-name" "Elek Vendég Egy"
  tedd: írd "#cit-msg" "Kisállattal érkeznénk, lehetséges?"
  tedd: kattints "Foglalási kérés elküldése"
  tedd: várj "Elküldtük a kérését" 30
  várd: látható "Elküldtük a kérését"
  várd: látható "A foglalás még nem végleges"
  várd: látható "2026. 10. 24. — 2026. 10. 26."
  várd: látható "Éjszakák"
  várd: látható "Létszám"
  várd: látható "Hivatkozás"
  várd: látható "56 000 Ft"
  várd: látható "Mi a következő lépés?"
  várd: látható "elek@citoviso.com"
  adat: ELEK-TESZT foglalási kérés (Elek Vendég Egy, 2026-10-24 → 10-26)
  kézi: a nyugtából a vendég tudja-e: (1) EZ MÉG NEM FOGLALÁS, (2) MENNYI IDŐN BELÜL kap választ, (3) HOVA jön a válasz, (4) MIT tehet, ha meggondolja magát; a hivatkozási szám felismerhető-e; a nyugta 390px-en egy görgetéssel átlátható-e

## Árajánlat-kérés — ár nélküli időszak

- [ ] Olyan időszakra, amire nincs ár, a gomb és a szöveg ÁTVÁLT árajánlat-kérésre — nem üres ár, nem „0 Ft"
  út: /t/elek-teszt-vendeghaz/
  tedd: írd "#cit-from" "2026-11-05"
  tedd: írd "#cit-to" "2026-11-07"
  várd: látható "Erre az időszakra a szállásadó egyedi árat ad."
  várd: látható "Az elküldéssel még nem vállal fizetési kötelezettséget."
  várd: látható "Árajánlatot kérek"
  # ⛔ „nem látható "0 Ft"" NEM írható: a runner részszövegre mér, és az „56 000 Ft"-ban
  # is benne van — a nulla forintot a kézi ítélet fogja meg.
  kézi: a vendég érti-e, hogy MOST NEM FOGLAL, hanem árat kér — a doboz és a gomb együtt egy képernyőn van-e (390px), és a különbség a foglalástól kimondott-e

- [ ] Az árajánlat-kérés elküldhető, és a nyugta ezt a különbséget is kimondja
  tedd: írd "#cit-name" "Elek Vendég Kettő"
  tedd: írd "#cit-email" "elek@citoviso.com"
  tedd: írd "#cit-phone" "+36 30 555 0002"
  tedd: kattints "Árajánlatot kérek"
  tedd: várj "Elküldtük az árajánlat-kérését" 30
  várd: látható "Elküldtük az árajánlat-kérését"
  várd: látható "árajánlattal válaszol"
  várd: nem látható "lemondó linket"
  várd: látható "2026. 11. 05. — 2026. 11. 07."
  adat: ELEK-TESZT árajánlat-kérés (Elek Vendég Kettő, 2026-11-05 → 11-07)
  kézi: a nyugta megmondja-e, hogy ÁRAT fog kapni (nem visszaigazolást), és hogy mi történik azután — vagy ugyanaz a nyugta, mint egy áras foglalásnál, „Összesen" nélkül

## A kapott ajánlat — a levél linkjéről (a szállásadó már válaszolt)

- [ ] Az ajánlat-lap megmondja, KI, MIRE, MENNYIÉRT és MEDDIG ajánl — és két világos választ kínál
  út: /ajanlat/elekseed-offer-000000000001
  várd: látható "Az ajánlat"
  várd: látható "ELEK-TESZT Vendégház"
  várd: látható "50 000 Ft"
  várd: látható "Elfogadom az ajánlatot"
  várd: látható "Nem kérem"
  kézi: az ajánlat érvényességi határideje ki van-e írva, és az elfogadás következménye (végleges foglalás, fizetés a helyszínen) a gomb ELŐTT kimondott-e; a két gomb súlya különbözik-e (az elfogadás az elsődleges); 390px-en mindkét gomb a hajtás fölött van-e

- [ ] Az elfogadás után a vendég tudja, hogy MOST lett végleges a foglalása
  tedd: kattints "Elfogadom az ajánlatot"
  várd: látható "Foglalása végleges"
  adat: ELEK-TESZT ajánlat elfogadva (Elek Vendég Ajánlat, 2026-11-12 → 11-14)
  kézi: a visszaigazoló képernyő megmondja-e, mi jön (e-mail, lemondó link, helyszíni fizetés), és van-e út vissza a szállás oldalára

- [ ] Az elfogadott ajánlat linkje újra megnyitva nem kínál újabb döntést
  út: /ajanlat/elekseed-offer-000000000001
  várd: nem látható "Elfogadom az ajánlatot"
  kézi: a lap kimondja-e, hogy ez az ajánlat már el van fogadva (nem „lejárt", nem „nem él" — a vendég tegnap igent mondott rá)

## Lemondás — a visszaigazoló levél linkjéről

- [ ] A lemondó-link megerősítő képernyőt ad: KINEK az oldalán vagyok, MELYIK foglalás, és van visszaút
  út: /foglalas/elekseed-szabo-0000000001/lemondom
  várd: látható "Biztosan lemondja a foglalását?"
  várd: látható "ELEK-TESZT Vendégház"
  várd: látható "Szabó Péter"
  várd: látható "2026. 10. 09."
  várd: látható "Mégsem — megtartom"
  várd: látható "Igen, lemondom a foglalást"
  kézi: a „módosítani szeretne? írjon a szállásadónak" út a lapon KATTINTHATÓ elérhetőség-e (e-mail/telefon), vagy csak egy mondat — a vendég egyetlen alternatívája a lemondáson kívül; a piros gomb és a „Mégsem" vizuálisan összetéveszthetetlen-e 390px-en

- [ ] A „Mégsem" tényleg megtart: nem mond le, és a szállás oldalára visz vissza
  tedd: kattints "Mégsem — megtartom"
  kézi: hova érkezett a vendég (a képen): a szállás oldalára, egy üres lapra, vagy sehova — a „Mégsem" ne legyen zsákutca

- [ ] A megerősítés után a lemondás megtörténik, és a vendég tudja, mi szabadult fel és mi jön
  út: /foglalas/elekseed-szabo-0000000001/lemondom
  tedd: írd "textarea" "Közbejött egy családi esemény, elnézést."
  tedd: kattints "Igen, lemondom a foglalást"
  várd: látható "Foglalása lemondva"
  várd: látható "Vissza a szállás oldalára"
  adat: ELEK-TESZT vendég-lemondás (Szabó Péter, 2026-10-09 → 10-11)
  kézi: a lap kimondja-e, hogy a szállásadó értesült, és hogy jön-e e-mail a vendégnek; a „Vissza a szállás oldalára" a szállás ÉLŐ oldalára mutat-e (nem a platformra)

- [ ] A használt link újranyitva hangosan mondja, hogy már nem él — nem üres lap, nem 500
  út: /foglalas/elekseed-szabo-0000000001/lemondom
  várd: látható "korábban már lemondták"

- [ ] Egy még el nem döntött kérésre a vendégnek NINCS lemondó-linkje — ha mégis ide jut, a lap megmondja, mit tehet
  út: /foglalas/elekseed-kovacs-0000000001/lemondom
  várd: látható "A link már nem él"
  kézi: ZAVAROS-gyanú: a vendég egy még függő kérést nem tud innen visszavonni — a lap mondja-e, HOGYAN vonhatja vissza (válaszoljon a levélre / hívja a szállásadót), vagy csak annyit, hogy a link nem él

- [ ] Ismeretlen (elgépelt) linkre emberi üzenet jön, nem nyers hiba
  út: /foglalas/elekseed-nincs-ilyen-token1/lemondom
  várd: látható "A link már nem él"
  tűrt-hiba: 404 /foglalas/elekseed-nincs-ilyen-token1/lemondom — az ismeretlen token 404-e szándékos; a lelet az, hogy a lap emberi-e

## Nyelv, jog, lábléc — a vendég többi kérdése

- [ ] Nyelvváltó és jogi lapok — a vendég megtalálja őket, és nem a Citovisóéi
  út: /t/elek-teszt-vendeghaz/
  kézi: van-e nyelvváltó ([data-cit-module='multilang'] / .cit-lang-dd / .cit-lang-bar) — ha van: a nyelvek SAJÁT nevükön (Deutsch, English) szerepelnek-e, és 390px-en hol van (sáv a lap tetején?); ha nincs: a lap magyarul tényleg teljes-e (nincs félig fordított felirat). A lábléc jogi linkjei (Adatkezelési tájékoztató, Impresszum) a SZÁLLÁSADÓ nevére szólnak-e; a „Tulajdonosi belépés" sáv a vendégnek nem tolakodó-e
  # A nyelv-linkek a dev /t/<slug>/ úton nem kattinthatók (abszolút /de/ útra
  # mutatnak, ami a platform-hostra fut) — élesen a tenant-hoston jó az út. Ezért
  # itt csak kép-ítélet; a kattintás az élesítés utáni mérés tárgya.

## Összkép

- [ ] Az egész vendég-út egy mondatban: tudtam volna-e szállást foglalni segítség nélkül?
  kézi: a futás összes képe alapján: hol akadt volna el egy első látogató, mi volt a legzavaróbb képernyő (méret megnevezve), és mi hiányzott, amit egy vendég keresne (pl. módosítás — ma nincs vendég-oldali módosítás, csak lemondás: ez a vendég számára kimondott-e valahol?)
