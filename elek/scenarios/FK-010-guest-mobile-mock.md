# FK-010 — A honlap-terv a VENDÉG szemével, TELEFONON: ergonómia 390 px-en, stílusonként

cél: Elek egy telefonról szállást keres, és a generált honlap-tervet (a mock-fájlt) használja, ahogy egy vendég tenné: tájékozódik, szobát és árat néz, fotót lapoz, térképet keres, a naptárból dátumot választ, hibásan és jól is kitölti a foglalás-kérést, véleményt ír. Az ítélet az ERGONÓMIA 390 px-en: érintési célok, olvashatóság, görgetés, űrlapok, naptár, tapadó elemek, vízszintes túlfolyás. A forgatókönyv egy STÍLUSRA fut; a vezénylő (`elek/bin/run-guest-mobile.mts`) mind a 19 stílus × 2 lead lapján lefuttatja, ugyanezekkel a lépésekkel.
felület: fájl
nézet: telefon
kontraktus: assets/design-refs/tenant-site/booking-price-clarity/README.md · assets/design-refs/tenant-site/rooms-card/README.md · assets/design-refs/tenant-site/quote-request/README.md

## Előkészítés

- [ ] A honlap-terv telefonon megnyílik, az első képernyőn a szállás neve
  user: anon
  út: ${ELEK_MOCK_FILE}
  várd: látható "${ELEK_MOCK_NAME}"
  várd: darab "[data-cit-module='booking']" >= 1
  várd: darab "form.cit-book--request" >= 1

## ① Első képernyő és navigáció

- [ ] Az első képernyő: a szállás neve, egy fotó és egy „Foglalás” indító hüvelykujjal elérhetően, a fejléc nem eszi meg a képernyőt
  kézi: a 390 px-es képen (görgetés nélkül) látszik-e a szállás neve, egy fotó és egy foglalás-indító; az indító elég nagy-e ujjal (≥ 44 px), és a fejléc/menü nem foglalja-e el a képernyő negyedét; van-e menü (hamburger) vagy a linkek sorban törnek; a fekvő képen ugyanez

- [ ] A „Foglalás” indító a foglaló-szekcióra ugrik, és a naptár címe nem bújik a tapadó fejléc alá
  tedd: kattints "a[href='#cit-booking']"
  várd: látható "Válassza ki az érkezés és a távozás napját"
  kézi: az ugrás után a naptár feje (a „Válassza ki…” felirat és a hónap-léptető) a képernyőn van-e, vagy a tapadó fejléc alatt / a képernyő fölött

## ② Szobák, árak, férőhely

- [ ] A szoba-kártyák telefonon olvashatók: név, férőhely, ár egy-egy sorban, a „Részletek” és a „Foglalás” gomb ujjal eltalálható
  tedd: kattints ".cit-room__open[data-cit-room]"
  várd: darab ".cit-rd[data-open]" >= 1
  kézi: a felugró 390 px-en a képernyőre fér-e (nem lóg ki alul/oldalt), a tartalma görgethető-e, az X gomb és a „Foglalás” gomb látszik-e görgetés nélkül; a fekvő képen a felugró használható-e (látszik-e az X és a cím)

- [ ] A felugró az X-szel zárul, és a lap ott marad, ahol volt
  tedd: kattints ".cit-rd__x"
  várd: darab ".cit-rd[data-open]" == 0
  kézi: zárás után a szoba-kártyák látszanak-e (nem ugrott-e a lap tetejére / nem maradt-e a fátyol)

## ③ Galéria

- [ ] Egy fotó érintésre nagyítva nyílik, a kép a képernyőre fér, a lapozó és a bezárás ujjal elérhető
  tedd: kattints "[data-cit-module='gallery'] img"
  várd: darab ".cit-lb[data-open]" >= 1
  kézi: a nagyított kép nem lóg ki a képernyőről; az X és a nyilak láthatók, elég nagyok (≥ 44 px) és nem takarják a képet; a fekvő képen a kép és a gombok látszanak

- [ ] A következő fotóra lapozás működik (ha a galéria egynél több képet ad a nagyítónak), majd a nagyító zárul
  tedd?: kattints ".cit-lb__btn--next"
  tedd: kattints ".cit-lb__btn--close"
  várd: darab ".cit-lb[data-open]" == 0
  kézi: a galéria-rács maga (nagyítás nélkül) 390 px-en nem folyik-e túl vízszintesen, a képek nem vágódnak-e le értelmetlenül

## ④ Térkép, környék, programajánló

- [ ] A térkép és a környék-ajánló telefonon olvasható, a térkép-keret nem lóg ki
  várd: darab "[data-cit-module='map'], [data-cit-module='poi']" >= 1
  kézi: a térkép-keret 390 px-en a lap szélességében marad-e; a programajánló / környék sorai olvashatók-e (dátum, cím, távolság egy sorban, nem törik értelmetlenül); a címre / útvonalra vezető link ujjal eltalálható-e

## ⑤ Foglalás-widget: naptár, hibás bemenet, ár, küldés

- [ ] A naptár egy hónapot mutat, és a „következő hónap” gombbal lapoz
  tedd: kattints ".cit-book__calnav--next"
  várd: látható "${ELEK_NEXT_MONTH}"
  kézi: a hónap-léptető gombok ujjal eltalálhatók-e (≥ 44 px), a napok cellái elég nagyok-e, a jelmagyarázat (szabad / foglalt / minta) olvasható-e

- [ ] Két szabad nap érintése kitölti az érkezést és a távozást, és kiírja az éjszakák számát
  tedd: kattints "[data-day='${ELEK_DAY_A}']"
  tedd: kattints "[data-day='${ELEK_DAY_B}']"
  várd: látható "2 éjszaka"
  kézi: a választott tartomány a naptárban látszik-e (kiemelt napok), és a dátum-sáv (Érkezés → Távozás) a naptár ALATT egy képernyőn belül van-e; mit ír az ár-doboz (a mockon nincs ár: „egyedi árat ad”) — érthető-e egy vendégnek

- [ ] Fordított dátumra (távozás az érkezés előtt) a lap a MEZŐ MELLETT, egy képernyőn belül mondja meg a hibát
  tedd: írd "#cit-from" "${ELEK_DAY_B}"
  tedd: írd "#cit-to" "${ELEK_DAY_A}"
  várd: látható "A távozás legyen későbbi az érkezésnél."
  kézi: a hibaüzenet a dátum-sávhoz képest HOL van a 390 px-es képen — ugyanazon a képernyőn, vagy a mezők alatt a küldő gomb mellett, egy görgetésnyire; a küldő gomb tiltott állapota látszik-e

- [ ] Múltbeli érkezésre a lap a legkorábbi foglalható napot mondja
  tedd: írd "#cit-from" "${ELEK_PAST}"
  tedd: írd "#cit-to" "${ELEK_DAY_A}"
  várd: látható "A legkorábbi foglalható érkezés"
  kézi: az üzenet érthető-e, és a naptár a mai hónapra ugrott-e vissza

- [ ] Érvényes tartományra az ár-doboz és a küldő gomb egy görgetésen belül van, a gomb felirata azt mondja, ami történni fog
  tedd: írd "#cit-from" "${ELEK_DAY_A}"
  tedd: írd "#cit-to" "${ELEK_DAY_B}"
  várd: látható "2 éjszaka"
  kézi: telefonon az 1. lépés: az ár-doboz (vagy az „egyedi árat ad” mondat) ALATT egy „Tovább a kérés adataihoz (N éjszaka)” gomb áll-e, ujjal eltalálhatóan; hibás dátumnál a gomb tiltott-e és a felirata mondja-e, hogy javítani kell

- [ ] A „Tovább” gomb a kérés adataihoz visz: összegző sáv (időszak · éjszakák · ár), alatta a mezők és a küldő gomb egy képernyőn
  tedd: kattints ".cit-book__go"
  várd: látható "Módosítom a napokat"
  kézi: a 2. lépés összegzője ugyanazt mondja-e, amit a naptárban választott; a naptár eltűnt-e; a mezők és a küldő gomb egy görgetésnyire vannak-e; a „Módosítom a napokat” visszavisz-e a naptárhoz (a képen: a sáv szövege és a mezők)

- [ ] A minta-kérés elküldése után a nyugta a képernyőre görget, és kimondja, hogy ez csak próba volt
  tedd: írd "#cit-name" "Elek Vendég"
  tedd: írd "#cit-email" "elek@citoviso.com"
  tedd: írd "#cit-phone" "+36 30 000 0000"
  tedd: kattints ".cit-book__submit"
  várd: látható "Ez kipróbálás volt"
  kézi: a nyugta teteje a képernyőn van-e küldés után (nem maradt-e a vendég egy üres helyen); a nyugta szövege egyezik-e a gomb feliratával (foglalás vs. árajánlat); a mezők betűmérete telefonon olvasható-e (≥ 16 px, hogy iOS ne nagyítson rá)

## ⑥ Vélemény-űrlap telefonon

- [ ] A vélemény-űrlap mezői ujjal kitölthetők: szöveg, csillag-választó, jelölőnégyzet, küldő gomb
  tedd: írd ".cit-rev-f [name='name']" "Elek Vendég Egy"
  tedd: válaszd ".cit-rev-f [name='rating']" "5 — Kiváló"
  tedd: írd ".cit-rev-f [name='body']" "Csendes, tiszta, a házigazda nagyon segítőkész volt."
  tedd: írd ".cit-rev-f [name='email']" "elek@citoviso.com"
  tedd: kattints ".cit-rev-f [name='consent']"
  tedd: kattints "Vélemény elküldése"
  várd: látható "Ez kipróbálás volt"
  kézi: a mezők és a lenyíló elég magasak-e ujjal (≥ 44 px), a jelölőnégyzet szövege érinthető-e a négyzeten kívül is, a küldés utáni mondat ott jelent-e meg, ahol az űrlap volt

## ⑦ Lábléc, nyelv, jog

- [ ] A lábléc telefonon: elérhetőség, jogi linkek és a készítő-sor olvasható, a linkek ujjal eltalálhatók
  kézi: a lábléc oszlopai 390 px-en egymás alá kerülnek-e (nem szűkülnek olvashatatlanra), a telefonszám / e-mail link-e, a linkek egymástól elég távol vannak-e; van-e nyelvváltó, és ha igen, ujjal használható-e

## Összkép

- [ ] Ebben a stílusban a vendég telefonról végigmenne-e segítség nélkül: tájékozódás → szoba → ár → foglalás → visszaigazolás
  kézi: a futás összes 390 px-es és fekvő képe alapján: mi a stílus-SPECIFIKUS hiba (a burkolat: fejléc, hero, kártyák, galéria-rács, lábléc), és mi a KÖZÖS, widget-rétegű (naptár, dátum-sáv, hibaüzenet helye, felugró, nagyító, vélemény-űrlap) — a két réteget külön nevezd meg
