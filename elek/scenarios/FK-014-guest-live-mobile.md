# FK-014 — A VENDÉG a KÉSZ honlapon, TELEFONON: végignézek mindent, és csak akkor foglalok, ha értem

cél: Elek most nem a szállásadó, hanem egy vendég, aki egy keresőből ráakad a honlapra a telefonján, és NEM ismeri a rendszert. Végigmegy mindenen, amit a szállásadó (FK-011→FK-013) felvitt — a minden modullal felszerelt ÉLES tenant-honlapon, nem mockon —, és a kérdése egyetlen: érti-e, amit lát, és meg tud-e foglalni egy két éjszakás nyaralást segítség nélkül, egy kézzel, 390 px-en. Az ítélet EGYÜTT az egyértelműség és az ergonómia: hol akadna el, mit nem talál meg, mi kétértelmű.
felület: publikus
nézet: telefon
kontraktus: assets/design-refs/tenant-site/booking-price-clarity/README.md · assets/design-refs/tenant-site/rooms-card/README.md · assets/design-refs/tenant-site/quote-request/README.md

## Előkészítés

- [ ] A szállás oldala megnyílik a telefonon, és minden megvásárolt modul RAJTA van
  user: anon
  út: /t/${ELEK_NIGHT_SLUG}/
  várd: látható "${ELEK_NIGHT_NAME}"
  várd: darab "[data-cit-module='booking']" >= 1
  várd: darab "[data-cit-module='rooms']" >= 1
  várd: darab "[data-cit-module='gallery']" >= 1
  # ⚠️ NEM hiba, hanem doktrína (ADR-0059 §2): ha minden egységnek csak ALAPÁRA van és a
  # szobakártyák már mutatják, az ártábla nem jelenik meg (nem ismételjük ugyanazt). A
  # tulaj viszont fizetett az „Árak, szezonok" modulért — a kézi ítélet ezt nézi meg.
  várd: darab "[data-cit-module='amenities']" >= 1
  # A programajánló szekció csak akkor renderel, ha VAN program; az FK-013 ⑨-ben a
  # mentés elakadt, tehát itt most nincs.
  várd: darab "[data-cit-module='map']" >= 1
  várd: darab "[data-cit-module='hours']" >= 1
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ① Az első képernyő — öt másodperc egy telefonon

- [ ] Az első képernyőről kiderül, HOL vagyok, MIT kapok, és mi az egyetlen fontos gomb
  kézi: a 390-es ÉS a fekvő képen, GÖRGETÉS NÉLKÜL: (1) egyértelmű-e, hogy ez egy szálláshely honlapja, melyiké, és hol van; (2) látszik-e egy fotó a szállásról (nem törött kép, nem szürke doboz); (3) van-e EGY félreérthetetlen elsődleges gomb (foglalás/szabad időpont), és ujjal elérhető-e (≥ 44 px, a hüvelykujj zónájában); (4) a fejléc/menü nem eszi-e meg a képernyő negyedét; (5) NINCS-e semmi, ami a Citovisóra, mintára, tervre vagy vásárlásra utal — a vendég nem vevő
  kézi: a főcím EGÉSZE az első képernyőn van-e, és a fekvő tartásban is
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] A menüből a vendég eljut oda, ahova indulni akar
  kézi: a képen: van-e menü (hamburger vagy sorban törő linkek); a tételei érthetőek-e egy vendégnek (nem belső nevek); a menü megnyitva takar-e olyat, amire szükség van
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ② Szobák — melyik egység nekem való?

- [ ] A három egység kártyája telefonon olvasható: név, férőhely, ár
  várd: látható "Nádas apartman"
  várd: látható "Kisházi szoba"
  várd: látható "Kerti stúdió"
  várd: látható "Ft"
  kézi: a kártyán (390 ÉS fekvő) megvan-e: ár „-tól / éj" alakban, férőhely, és hogy MI a különbség a három egység között; a kártya-fotók megjelennek-e; a kártyák egymás alatt olvashatók-e, vagy vízszintesen elcsúsznak
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] A részletek megnyithatók, és többet mondanak, mint a kártya — és van út onnan a foglalásig
  tedd: kattints ".cit-room__open[data-cit-room]"
  várd: darab ".cit-rd[data-open]" >= 1
  kézi: a felugró 390-en a képernyőre fér-e (nem lóg ki alul/oldalt), a tartalma görgethető-e, az X és a foglalás-gomb látszik-e görgetés nélkül; a felszereltség és a leírás olvasható-e; fekvő tartásban használható-e
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] A felugró bezárul, és a lap ott marad, ahol a vendég volt
  tedd: kattints ".cit-rd__x"
  várd: darab ".cit-rd[data-open]" == 0
  kézi: zárás után a szoba-kártyák látszanak-e (nem ugrott a lap tetejére, nem maradt fátyol)
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ③ Árak — mikor mennyi, és mi van a szezonokon kívül?

- [ ] Az ártábla időszakonként mondja meg, mikor mennyi
  út: /t/${ELEK_NIGHT_SLUG}/
  # A szezonok felvétele az FK-013 ④-ben elakadt (a naptáros dátumválasztó), ezért a
  # vendég ma az ALAPÁRAKAT látja — a kör ezt méri, és a kézi ítélet kimondja, mit üzen
  # a lap arról az időszakról, amire nincs külön ár.
  várd: látható "24 000"
  kézi: az ártábla 390-en olvasható-e (nem kell nagyítani, nem lóg ki oldalt), egyértelmű-e az „éjszakánként", és a három egység × három szezon szerkezete követhető-e egy telefon-képernyőn; mit mond a szezonokon KÍVÜLI időszakról (ha hallgat róla, a vendég két helyen két igazságot lát, mert a widget „egyedi árat ad"-ot ír)
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ④ Fotók, hely, környék, felszereltség, vélemények

- [ ] A galéria fotói betöltenek, és a nagyítás telefonon használható
  kézi: a fotók megjelennek-e; a galéria 390-en nem nyúlik-e végtelen hosszúra; a nagyítás/lapozás felismerhető-e ÉS ujjal működik-e (a nagyító a képernyőre fér, a záró gomb elérhető)
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] Hol van a szállás, és mit lehet ott csinálni
  várd: látható "Köveskál"
  kézi: a térkép 390-en megjelenik-e és nem lóg-e ki; a megközelítés/parkolás szövege olvasható-e; a programajánló sorai (dátum, hely, forrás) a jövőben vannak-e, és a link kattintható méretű-e
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] Felszereltség és érkezési idő — a vendég két gyakori kérdése
  várd: látható "14:00"
  kézi: a felszereltség-lista ikonjai értelmesek-e (nem üres négyzet), a lista 390-en végigolvasható-e; az érkezés/távozás idő megtalálható-e; a telefonszám koppintható linknek látszik-e
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] A vélemény-szekció igazat mond
  kézi: ha nincs még valódi vélemény, kimondja-e (nem mutat kitalált csillagot); ha van Google-értékelés, a szám és a darabszám látszik-e; a vélemény-beküldő űrlap 390-en egy oszlopban olvasható-e
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ⑤ Foglalás — mit enged és mit tilt a widget?

- [ ] A beküldő gomb MEG SEM JELENIK, amíg nincs dátum
  # MÉRVE 2026-09-27: betöltéskor a név/e-mail/telefon mező és a „Foglalási kérés
  # elküldése" gomb 0×0 (rejtett); csak a két dátum-mező látszik. Tehát üres űrlapot
  # beküldeni nem is lehet — a kérdés az, hogy a vendég ÉRTI-E, mit kell tennie.
  várd: darab "#cit-from" >= 1
  kézi: 390-en a vendég látja-e, hogy a dátummal kell kezdenie (van-e felirat/útmutatás), vagy csak két üres mezőt lát; a „SZABAD IDŐPONTOK MEGTEKINTÉSE" és a „SZABAD IDŐPONTOT KÉREK" közti különbség érthető-e; a két gomb nem téveszti-e meg egymással
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája

- [ ] Fordított dátumokra érthető üzenet jön
  tedd: írd "#cit-from" "2026-10-26"
  tedd: írd "#cit-to" "2026-10-24"
  kézi: a képen: mond-e bármit a felület a fordított időszakról (390-en a mezők KÖZELÉBEN), vagy némán nem történik semmi
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája

- [ ] Múltbeli dátumra a beküldés előtt szól
  tedd: írd "#cit-from" "2026-01-10"
  tedd: írd "#cit-to" "2026-01-12"
  kézi: a képen: megjelenik-e a „legkorábbi foglalható érkezés" üzenet, és a továbblépő gomb tiltottnak NÉZ-e ki 390-en
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája

## ⑥ Foglalás — a jó út: dátum, ár, adatok, nyugta

- [ ] A dátumokra az ár AZONNAL kiírva, és a továbblépő gomb megnevezi az éjszakákat
  tedd: írd "#cit-from" "2026-10-24"
  tedd: írd "#cit-to" "2026-10-26"
  kézi: LÁTSZIK-E egyáltalán az ár a dátumok megadása után (a mérés szerint a widget első lépése csak a „Tovább…" gombot mutatja) — ha nem, a vendég a második lépésig nem tudja, mennyibe kerül; az ár-összegzés (2 éj × 24 000) a gomb FÖLÖTT, olvashatóan van-e 390-en; az összeg egy sorban marad-e; a „Tovább a kérés adataihoz (2 éjszaka)" felirat megmondja-e, mi jön; fekvő tartásban a gomb elérhető-e
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája

- [ ] A második lépésben jönnek a vendég adatai
  tedd: kattints "Tovább a kérés adataihoz"
  várd: darab "#cit-name" >= 1
  kézi: 390-en az adat-mezők egy oszlopban, feliratozva állnak-e; van-e visszaút az első lépésre (a dátum módosításához); a billentyűzet nem takarja-e a következő mezőt
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája

- [ ] A kérés elküldve: TÉTELES nyugta, és a vendég tudja, mi jön
  tedd: írd "#cit-name" "Elek Vendég Éjszakai"
  tedd: írd "#cit-email" "elek@citoviso.com"
  tedd: írd "#cit-phone" "+36 30 555 0101"
  tedd?: írd "#cit-msg" "Kisállattal érkeznénk, lehetséges?"
  tedd: kattints "Foglalási kérés elküldése"
  tedd: várj "Elküldtük a kérését" 40
  várd: látható "Elküldtük a kérését"
  várd: látható "Hivatkozás"
  várd: látható "48 000"
  adat: ELEK-NIGHT foglalási kérés (Elek Vendég Éjszakai, 2026-10-24 → 10-26)
  kézi: a nyugtából kiderül-e: (1) EZ MÉG NEM FOGLALÁS, (2) mennyi időn belül kap választ, (3) hova jön a válasz, (4) mit tehet, ha meggondolja magát; a nyugta 390-en egy görgetéssel átlátható-e
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája

## ⑦ Árajánlat — ár nélküli időszakra

- [ ] Ha az időszakra nincs ár, a felület árajánlat-kérésre vált
  út: /t/${ELEK_NIGHT_SLUG}/
  tedd?: írd "#cit-from" "2027-03-05"
  tedd?: írd "#cit-to" "2027-03-07"
  kézi: a képen: mit mond a widget olyan időszakra, amire nincs külön ár — alapárat számol, vagy árajánlatot kér; a vendég érti-e, melyik történik; 390-en a doboz és a gomb egy képernyőn van-e
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája

## ⑧ Vélemény — jártam ott, elmondom

- [ ] A vélemény beküldhető telefonon, és a válasz megmondja, mikor jelenik meg
  út: /t/${ELEK_NIGHT_SLUG}/
  tedd: írd ".cit-rev-f [name='name']" "Elek Vendég Éjszakai"
  tedd: írd ".cit-rev-f [name='body']" "Csendes kert, nádfedeles ház, a házigazda mindenben segített. Jövünk máskor is."
  tedd: írd ".cit-rev-f [name='email']" "elek@citoviso.com"
  tedd: kattints ".cit-rev-f [name='consent']"
  tedd: kattints "Vélemény elküldése"
  várd: látható "Köszönjük a véleményét"
  adat: ELEK-NIGHT vélemény (Elek Vendég Éjszakai, jóváhagyásra vár)
  kézi: az űrlap 390-en mezőnként olvasható-e, a csillag-választó ujjal használható-e; a köszönő-lapról van-e út vissza a szállás oldalára
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ⑨ Jog, nyelv, lábléc

- [ ] A lábléc a SZÁLLÁSADÓ nevére szól, és a jogi lapok elérhetők telefonon
  kézi: az Adatkezelési tájékoztató / Impresszum a szállásadó nevére szól-e (nem a Citovisóra); a „Tulajdonosi belépés" sáv nem tolakodó-e a vendégnek; a lábléc elemei 390-en nem lógnak-e ki; ha van nyelvváltó, a nyelvek saját nevükön szerepelnek-e
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ⑩ Összkép

- [ ] Meg tudtam volna foglalni segítség nélkül, egy kézzel?
  kézi: a futás MINDEN képe alapján: hol akadt volna el egy első látogató (lépés + méret megnevezve), melyik volt a legzavarosabb képernyő, és mit keresett volna hiába; külön: a fekvő tartás hol romlott el; és mennyi görgetés kellett a foglalásig
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája
