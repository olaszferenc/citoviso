# 2026-09-28 — A telefonos kör képeinek ítélete (FK-012…016): modulonként, tulaj- és vendég-oldalon

Brief: `~/rc-briefs/kep-itelet-telefonos-kor.md`. Ítélet-kör, **kód nem változott**. A képeket friss
szemmel, lépésenként néztük meg (390 px elsődlegesen, fekvő és asztali ott, ahol a kérdés érinti).
A teljes-lapos kép a `position:fixed` réteget a lap aljára festi, ebből takarást nem ítéltünk.

## Mit ítéltünk meg — és három fenntartás

| Kör | Futás | Bérlő a képeken | RENDBEN | ZAVAROS | HIÁNYZIK |
|---|---|---|---|---|---|
| FK-012 modul-kosár | `citded06a5f/…/FK-012-NIGHT-2026-09-28T12-14-40-…` | **Kemencés Vendégház** | 8 | 5 | 0 |
| FK-013 adatfeltöltés | `citded06a5f/…/FK-013-NIGHT-2026-09-28T12-14-40-…` | **Kemencés Vendégház** | 10 | 7 | 3 |
| FK-014 vendég, foglalásig | `cit37b9296b/…/FK-014-NIGHT-2026-09-28T13-49-52-…` | Három Huszár Apartments | 9 | 9 | 2 |
| FK-015 tulaj dönt | `citded06a5f/…/FK-015-NIGHT-2026-09-28T13-57-33-…` | Három Huszár Apartments | 3 | 7 | 3 |
| FK-016 vendég utóélete | `citded06a5f/…/FK-016-NIGHT-2026-09-28T13-59-30-…` | Három Huszár Apartments | 0 | 2 | 3 |

1. **Nem egy bérlő végigvitt útja.** A legfrissebb FK-012/013 a Kemencés Vendégházon futott (részben
   már vásárolt tenant), az FK-014/015/016 a Három Huszáron. A „vett → feltöltött → a vendég ezt látta”
   lánc tehát a mai képeken két bérlőre szakad. A DB-ben a két bérlő egységei azonosak (A szállás egésze
   + Nádas apartman / Kisházi szoba / Kerti stúdió), de a vendég-oldali kép nem a feltöltés eredménye.
2. **Az FK-014 legfrissebb futása NEM a briefben megadott fában van.** A `citded06a5f` utolsó FK-014-e
   (09-27 23:58) a widget-javítás ELŐTTI. A javítás utáni futás a `cit37b9296b` fában él (09-28 13:49,
   19 kézi lépés) — azt ítéltük; a régiből csak az „azóta javítva” megállapítás jön.
3. **Több lépésnek nincs saját képe** (bájtra azonos a szomszédjával): FK-012 01=02, 10=11, 12=13;
   FK-015 05=06, 10=11, 12=13; FK-016 10=11; FK-014 19–21 mind a vélemény-hibalap. Ezeknél a kérdés
   egy része nem dönthető el — alább külön felsorolva.

## Modulonként — ez a tulaj kérdése

| Modul | A TULAJ fel tudta-e tölteni telefonon | A VENDÉG megtalálta / értette-e |
|---|---|---|
| gallery | **részben** — 12/24 kép bement; a +6 fotó, a nyitókép és a képaláírás nem mérve (runner-hiba → blocked) | **igen** — 7 fotó betölt; a nagyítót a kör nem nyitotta meg |
| rooms | **igen, hibával** — 3 szoba felvéve, de a leírás a rossz egységre („A szállás egésze”) ment; a kártyán nincs ár | **részben** — a kártyasor összetapad („Nádas apartman4 fő24 000 Ft / éj”), nincs fotó; a felugró üres |
| amenities | **nem mérve** — a Kemencésen nincs megvéve (FK-013 15. lépés: „Még nem vette meg”) | **részben** — 3 tétel, a fejlécben ígért kandalló és klíma nincs a listán |
| pricing | **részben** — alapárak igen, **szezon egy sem** (dátumválasztó elakad) | **részben** — a widget ára egyértelmű (2 × 24 000 = 48 000 Ft + IFA), ártábla nincs (ADR-0059, szándékos), „Alapár” magyarázat nélkül |
| usp | **igen** | **igen** |
| reviews | **igen** a beállítás; a jóváhagyó felület rendben (FK-015 10), de jóváhagyás nem történt | **részben** — Google 4,9 / 56 igaz; saját vélemény nincs kint, a beküldés hibalapja arculaton kívüli |
| poi | **nem** — „Most gyűjtjük…” alatt semmi nem szerkeszthető, saját program sem vehető fel | **nem** — a lapon nincs programajánló |
| location | **igen** | **részben** — térkép helyett tű + név, útvonal-link nélkül; a cím, útleírás, parkolás olvasható |
| hours | **igen** | **igen** — 14:00–20:00 / 10:00 egyértelmű |
| booking | **igen** — szabályok beállítva; a kérést visszaigazolta telefonon (nehézkesen) | **igen** — a foglalás végigmegy (FG-96A0CB, 48 000 Ft, tételes nyugta); a lemondást értette, de a „Mégsem” hibalapra visz |
| enquiry (árajánlat) | **nem mérve** — nem született árajánlat-kérés, így nem volt mit kezelni | **részben** — az ár nélküli időszakra vált; az ajánlat-elfogadás nem futott le |
| többnyelvű | **nem vettük meg** | — |

## ZAVAROS / HIÁNYZIK súly szerint (a kép nevével)

### Súlyos — egy IT-kezdő itt elakad, vagy a vendég rossz élményt kap
1. **A szezonok nem vehetők fel telefonon.** A szezon-lépések „Válassza ki a kezdő és a záró napot.”
   hibával buknak, a név és a 34 000 az „A szállás egésze” kártyájának ALAPÁR mezőjébe került (az a lap
   első kártyája). Hogy a naptár vagy a forgatókönyv bukik, a kép nem dönti el: nyitott naptárról nincs
   kép. — FK-013 `11-mobil.png`, 12–14. lépés.
2. **A programajánlóban a tulaj semmit nem tud tenni**, amíg a gyűjtés fut („egy órán belül”), saját
   programot sem vehet fel; a vendég-lapon nincs programajánló. — FK-013 `21/22/23-mobil.png` (azonosak), FK-014 `09-mobil.png`.
3. **A vendég „Mégsem — megtartom” gombja hibalapra visz** (ERR_CONNECTION_REFUSED). Lehet a dev-gép
   `publicSiteUrl`-je; a valódi tenant-hoston mérni kell. A „Vissza a szállás oldalára” ugyanide mutat. — FK-016 `03-mobil.png`, `09-mobil.png`.
   **⚠️ HELYESBÍTÉS (2026-09-28, a koordinátor jelzése alapján):** ez NEM a termék hibája volt, hanem a
   mérőeszközé — a testvér-szál kimérte és a runnert javította. A képen látott hibalap tehát nem vendég-oldali lelet.
4. **A szoba-felugró üres, és az ár nélküli „A szállás egésze”-re nyílik**: fekete fotódoboz, nincs ár,
   nincs férőhely, 390-en és fekvőben nincs foglalás-gomb. A kártyasoron is ár nélkül, foglalás-gombbal
   áll. ⚠️ Nem a javítás visszaesése: a DB-ben mindkét bérlőnél `represents_whole=t, is_whole_property=t`
   (a kör „egyben is kiadom”-ként hagyta), 0 ársorral — a lelet az, hogy **kiadó egész ár nélkül
   foglalhatónak látszik**. — FK-014 `04-mobil.png`, `05-mobil.png`.
5. **„A szállás egésze” mindenhol az első** a tulaj adminjában (szobák rácsa, felugró, Árak lap,
   naptár-fül): a tulaj első koppintása a nem-szobára megy, a leírás és az ár oda íródik. — FK-013 `09/10/11-mobil.png`.

### Közepes — érthető, de akadályoz vagy félrevezet
6. **Modul-árak félreérthetők**: a „~~690 Ft~~ +517 Ft/hó” havi díjnak olvasódik, pedig a kedvezmény
   egyszeri; a ki nem fizetett kosár már a „Jelenleg 5 370 Ft/hó”-ba számít, miközben ugyanott „Jelenlegi
   díj 4 880”; a nyugta „4 130 Ft/év”-et ír havi fióknál; a Többnyelvű lábán „~~11 175 Ft~~ 11 175 Ft”. — FK-012 `04`, `09`, `10-mobil.png`.
7. **Az Online foglalás szó nélkül tesz a kosárba két modult** (Szobák, Árak: 4 → 7 tétel, +1 180 Ft/hó). — FK-012 `09-mobil.png`.
8. **A Bővítés nehezen található**: a Modulok lap tetejétől ~2,5 képernyőnyire; a kezdőlapi „Modulok
   kezelése” a hajtás alatt, és nem vásárlásra utal; a „Kosárba teszem” 36 px (cél ≥ 44). — FK-012 `02`, `04-mobil.png`.
9. **Az új foglalási kérés nem jelenik meg a Teendők között**, a Foglalások ikonon nincs jelvény, a
   sornak nincs olvasatlan-pöttye a 11 számla/vélemény-sor között. — FK-015 `01`, `02-mobil.png`.
10. **A döntő gombok a hajtás alatt**, a gyors döntésnél nincs „Mégsem” (alatta rögtön „✕ Nem szabad”), a
    visszaigazoló űrlap ~160 px-es hasábba szorul. — FK-015 `03`, `04`, `05`, `07-mobil.png`.
11. **Nincs kattintható elérhetőség**: a lemondó lap „írjon a szállásadónak”-ot mond link nélkül; a tulaj
    kártyáján a vendég telefonszáma sima szöveg. — FK-016 `02`, `11-mobil.png`; FK-015 `05-mobil.png`.
12. **A szobalista összetapad** („Nádas apartman4 fő24 000 Ft / éj”) és fotó nélküli. — FK-014 `04-mobil.png`, FK-016 `08-mobil.png`.
13. **Térkép helyett tű**, útvonal-link nélkül; az adminban 390-en nincs Térkép/Műhold váltó, a súgó
    mégis „váltson Műhold nézetre”-t kér. — FK-014 `09-mobil.png`, FK-013 `18-mobil.png`.
14. **A vélemény-beküldés hibalapja** stílus nélküli és önellentmondó („Nem sikerült elküldeni” +
    „Már küldött véleményt. Köszönjük!”). Az ok tesztadat (ugyanaz az e-mail), a lap viszont vendég-szemmel rossz. — FK-014 `19-mobil.png`.
15. **Az első képernyő**: ~150 px kifakult fejléc-sáv, két szinte azonos elsődleges gomb („SZABAD
    IDŐPONTOT KÉREK” / „…MEGTEKINTÉSE”); fekvőben a gombok a hajtás alatt. — FK-014 `02-mobil.png`, `02-fekvo.png`.
16. **Az „Online foglalás” cím olvashatatlan** (sötét betű sötétkék alapon), a szoba-szerkesztő
    másodszor is megjelenik a foglalás modulban. — FK-013 `26-mobil.png`.
17. **A szobakártyán az adminban nincs ár**, a „Hiányos” címke nem mondja meg, mi hiányzik; a felugró
    mentése után nincs „Mentve”. — FK-013 `08`, `10-mobil.png`.

### Alacsony
18. A naptár nem a kért hónapban nyílik (szeptemberen marad) — FK-014 `15`, FK-015 `12`, FK-016 `08-mobil.png`.
19. A vendég-menüből hiányzik a „Szobák” és az „Árak” — FK-014 `03-mobil.png`.
20. „Alapár” magyarázat nélkül; „TELJES SZÁLLÁSRA” felirat egy apartmanra — FK-014 `07`, `15-mobil.png`.
21. Citoviso-reklám a vendég láblécében („Ezt az oldalt a Citoviso készítette…”) — FK-014 `20` (a korábbi teljes-lapos képek alja).
22. Kerekítés 517 vs 518 Ft; darabszám-ellentmondások („mind a 9” vs „10 modul él”); félig levágott
    „−25%” jelvény, máltai zászló fele; hónap-feliratok egymásba lógnak — FK-012 `04`, `12-mobil.png`, FK-013 `11-mobil.png`.

### Azóta javítva (a régi képeken még látszik, nem új lelet)
A 4. szoba eltűnése, a widget „A szállás egésze”-re nyitása és a csak-árajánlat út (a régi FK-014 17.
lépése FAIL volt, a mostani RENDBEN), a süti-sáv takarása, a 407 px-es összegző sáv (kosár van), a
hírlevél-modul kínálása — egyik sem jött elő a legfrissebb futásokban.

## Amire a kör NEM ad választ (a tulaj kérdésének hiányzó fele)

- **Szezonárak** — a feltöltés elakadt (1. lelet), tehát azt sem láttuk, a vendég mit kap szezonban.
- **Programajánló** — sem feltöltve, sem a vendég-lapon (2. lelet).
- **Árajánlat (enquiry) a tulaj oldalán** — nem született árajánlat-kérés, így az FK-015 6/9 és az
  FK-016 4–6 (ajánlat elfogadása) nem futott.
- **Vélemény-jóváhagyás hatása** — az FK-015 11. lépésében nincs koppintó sor, ezért az FK-016 7.
  lépése („a vélemény kint van”) bukott; felületi hibát ez nem bizonyít.
- **Felszereltség feltöltése** — a Kemencésen a modul nincs megvéve; az FK-012 kosarába az „Amit kínál” nem került.
- **Galéria második adagja + nyitókép** — runner-hiba után blocked.
- **Többnyelvű honlap** — nem vettük meg.
- **Kép nélkül maradt kérdések**: belépő-űrlap + billentyűzet, a telefonos menü és a nyitott kosár, a
  fizetés-megerősítő és a kártyaválasztó, a nyitott dátumválasztó, a galéria-nagyító, a jogi lapok tartalma.
- **Forgatókönyv-karbantartás** (nem felület-hiba): FK-013 3 (runner „Execution context was destroyed”),
  FK-013 6 (elavult elvárás: a „Még egy döntés hiányzik” nem kellett), FK-014 20–21 (nincs saját `út`).

## Meg tudta volna-e csinálni segítség nélkül, telefonon?

Egy IT-kezdő szállásadó telefonon **meg tudja venni a modulokat** (a kosár működik, de az árak
félreérthetők, és a foglalás szó nélkül tesz be két további tételt), és a **szobák, alapárak, USP,
nyitvatartás, cím és foglalási szabályok feltöltése is sikerül** — de a **szezonárakat és a
programajánlót nem tudná beállítani**, a szobáknál pedig az első helyen álló „A szállás egésze” rendszeresen
rossz helyre viszi a munkáját; a beérkező foglalást visszaigazolja, de keresgélnie kell, mert a kérés
nem kerül a Teendők közé és a gombok a hajtás alatt vannak. Egy vendég telefonon **meg tud foglalni**
(a dátumra azonnal kiírt ár, a kétlépéses widget és a tételes nyugta rendben van — ez a legnagyobb
változás a tegnapi képekhez képest), de előtte a szobákról keveset tud meg (összetapadó sor, üres
felugró, térkép és programajánló nélkül); a lemondáskor látott „Mégsem” → hibalap utólag a mérőeszköz
hibájának bizonyult (lásd a 3. lelet helyesbítését). Összességében:
a bevételi út eleje és vége segítség nélkül végigjárható, a „minden modul” ígérete nem — a pricing
(szezon), a poi és az enquiry tulaj-oldala ma nincs igazolva, és a két kör két különböző bérlőn futott.

---

# Melléklet — lépésenkénti ítéletek

## FK-012 — ítélet-kör (Elek modult vesz telefonon)

Futás: `elek/runs/FK-012-NIGHT-2026-09-28T12-14-40-2026-09-28T12-16-56/` (a citded06a5f fában, csak olvasva).
Alany a képeken: **Kemencés Vendégház** (nem Három Huszár — részben vásárolt alany, a forgatókönyv fejléce szerint helyes).
Megjegyzés: a futásban NINCS „Amit kínál (felszereltség) — a kosárba" lépés (a mai forgatókönyvben van) → ezért maradt az a Bővítésben.
Pár kép bájtra azonos: 01=02, 03=04 (asztali), 10=11, 12=13 — a 11. és 13. lépés tehát nem kapott saját állapot-képet.

| lépés | amit kérdez (röviden) | ítélet | indoklás | kép |
|---|---|---|---|---|
| 1 | belépés egy képernyőn? belépés után világos-e, hol van és mi a következő lépés | RENDBEN | Az „Áttekintés — Az oldala állapota egy képernyőn — ami teendő, az itt sorban áll" + „Teendők 1 nyitott: **Töltsön fel saját fotókat**" egyértelműen megmondja a következő lépést. ⚠ A kép nem mutatja: a belépő-űrlapot és a billentyűzetet (a kép már a belépés utáni állapot). | 01-mobil.png, 01-fekvo.png, 01.png |
| 2 | alsó sáv, „Menü" beszédes-e, van-e út a modulokhoz a kezdőlapon | ZAVAROS | Az alsó sáv: Áttekintés · Fotók · Foglalások · Üzenetek · Menü (hamburger + „Menü" felirat, érthető), és a kezdőlapon VAN út („Havi előfizetés … 3 modul aktív" kártya, „Modulok kezelése" gomb) — de az a 390×844-es képernyő hajtása ALATT ül (~y 1020), a felirat „kezelése", nem „bővítés/vásárlás", és a kártya szürke sávja felirat nélkül üres. | 02-mobil.png |
| 3 | menü átlátható, bezárul-e, „Még nem vette meg" látszik-e | RENDBEN | A Modulok lapra eljutott (fejléc „Kemencés Vendégh… › Modulok", a „Bővítés" ellenőrzés zöld), a menü nincs nyitva a képen. ⚠ A kép nem mutatja a telefonos fiók-menüt; asztalin az oldalsávban látszik a „Még nem vette meg · 8" csoport +-jelekkel. | 03-mobil.png, 09.png (asztali oldalsáv) |
| 4 | kártyán név, mit ad, HAVI ár; csoport-fejlécek; gomb ≥44 px; kiderül-e a havi ismétlődés | ZAVAROS | Név + egy mondat + ár minden kártyán ott van, a „Amit bemutat / Elérhetőség / Extrák" fejlécek megvannak; DE az ár „~~690 Ft~~ **+517 Ft/hó**" alakú, mintha a kedvezményes ár havonta ismétlődne — a nyugta szerint „A kedvezmény egyszeri", a következő számla a teljes árral megy; a „Kosárba teszem" gomb mérve **36 px** magas (<44); a Bővítés a lap tetejétől ~1800 px-re, két és fél képernyőnyi görgetés után kezdődik. | 04-mobil.png (y≈1790–2350) |
| 5 | Miért Önt válasszák → gomb elérhető, felirat vált, kosár-szám nő | RENDBEN | A kártya kék keretet kapott, a gomb „Kiveszem a kosárból" lett, megjelent a „① Kosár · most 367 Ft" gomb. | 05-mobil.png |
| 6 | Nyitvatartás, érkezés → ugyanez | RENDBEN | „Kiveszem a kosárból", a kosár „2 Kosár · most 585 Ft" (367+217,5). | 06-mobil.png |
| 7 | Vendégek véleménye → ugyanez | RENDBEN | „Kiveszem a kosárból", „3 Kosár · most 1 102 Ft". | 07-mobil.png |
| 8 | Heti programajánló → ugyanez | RENDBEN | „Kiveszem a kosárból", „4 Kosár · most 1 470 Ft". | 08-mobil.png |
| 9 | Online foglalás → ugyanez | ZAVAROS | A gomb váltott, de EGY kattintásra a kosár **4 → 7** tételre és 1 470 → **3 097 Ft**-ra ugrott: a „Szobák, apartmanok" és az „Árak, szezonok" kártya is „Kiveszem a kosárból"-ra váltott, és sem a foglalás-kártyán, sem a kosár sorain („+ bekapcsol · Szobák, apartmanok — fizetés most: 518 Ft") nem áll, hogy ezeket a foglalás miatt tettük be. ⚠ A kép nem mutatja, volt-e átmeneti értesítő (toast). | 09-mobil.png, 09.png (asztali kosár-panel) |
| 10 | kosár tételei, megerősítő (Fizetendő most + Következő számla), kártyaválasztó, nyugta | ZAVAROS | A nyugta megvan és jó szerkezetű: „**Kész.** Mostantól él: Szobák … Online foglalás." + „7 modul a fordulónapig 4 130 Ft · Üdvözlő kedvezmény (25%) −1 033 Ft · A kártyáját megterheltük 3 097 Ft"; DE az alatta álló mondat mértékegysége hibás: „a következő megújításkor **4 130 Ft/év** díjjal szerepelnek" — havi fiókról van szó (Jelenlegi díj 9 010 Ft/hó). ⚠ A kép nem mutatja a kinyitott kosarat, a megerősítő ablakot és a kártyaválasztót (csak a fizetés utáni állapot). | 10-mobil.png (y≈1230–1470) |
| 11 | kosár három száma megnevezve; csukott kosár mérete; Kiürítem vs Tovább | RENDBEN | Az asztali kosár-panel: „Fizetendő most: 3 097 Ft" · „Következő számla így: 9 010 Ft (+4 130 Ft a mostanihoz képest)" — mind a három szám megnevezve; „Kiürítem a kosarat" (körvonalas) és „Tovább a fizetéshez" (teli cián) nem téveszthető össze; a csukott kosár telefonon 44 px magas, ~210 px széles gomb (a képernyő ~5%-a, a régi 48% helyett). ⚠ A kép nem mutatja a TELEFONON kinyitott kosarat (a 11-es kép = a 10-es, fizetés utáni állapot). Apró: a kártyán „+517 Ft/hó", a kosár-sorban „518 Ft" (Árak: 367 vs 368). | 09.png (asztali), 09-mobil.png (csukott), 11-mobil.png |
| 12 | saját modulok listája olvasható, mindnél „Beállítás", Bővítés kiürült-e | RENDBEN | Mind a 10 modul sorban, mindegyiknél „Megnézem · Beállítás · Kikapcsolom"; az „Időpontkérés, kapcsolat" „nem számítjuk — Ezt most az „Online foglalás" váltja ki" magyarázattal (ott nincs Beállítás, ez indokolt); a Bővítésben csak az „Amit kínál (felszereltség) +490 Ft/hó" maradt — mert ezt a futás nem tette kosárba (nincs rá lépés). Apró ellentmondás: „Aktív az oldalán mind a 9 modul" vs. „10 modul él az oldalán, ebből 9 szerepel a számlán". | 12-mobil.png |
| 13 | összkép: megvenné-e egy IT-kezdő egyedül | ZAVAROS | Végigvihető (a nyugta igazolja: 7 modul, 3 097 Ft, egy terhelés), de három ponton megakadna: (a) a Bővítés 2,5 képernyővel lejjebb kezdődik, és a kezdőlapi út a hajtás alatt van; (b) a „+517 Ft/hó" havi árnak olvasódik, a valódi havi díj 690 Ft; (c) a foglalás két másik modult némán betett a kosárba. Tapadó sáv: a kosár-gomb BALRA áll (a kosár-terv szerint jobbra, hogy a bal oldali gombok szabadok legyenek) — takarást a teljes-lapos kép nem bizonyít (a kör középre görgetve kattintott). | 13-mobil.png, 04-mobil.png, 09-mobil.png, 10-mobil.png |

## Modul-szintű megfigyelések

- **Megvett (egy fizetéssel, 3 097 Ft):** Miért Önt válasszák (490 → első hó 367) · Nyitvatartás, érkezés (290 → 217) · Vendégek véleménye (690 → 517) · Heti programajánló (490 → 367) · Online foglalás (990 → 742) · + automatikusan Szobák, apartmanok (690 → 517/518) · Árak, szezonok (490 → 367/368). Új havi díj 4 880 → **9 010 Ft/hó** (egyértelműen kiírva a nyugta után az Előfizetés-kártyán és a tételes „A következő számla tételei" listán).
- **Már az övé volt:** Képek a szállásról (490), Térkép (490), Alapdíj 3 900 (honlap + időpontkérés → vásárlás után „+ kapcsolatfelvétel").
- **Kirakatban maradt:** Amit kínál (felszereltség) +490 Ft/hó — a futás nem kattintotta (nincs rá lépés a futásban).
- **Többnyelvű honlap** (egyszeri díj): a kupon alatt ~~14 900~~ 11 175 Ft; a modul-vásárlás ELHASZNÁLTA a −25% kupont („a következő vásárlásánál"), utána 14 900 Ft — a kupon-szöveg ezt előre megmondta, de a tulaj nem választhatott, melyikre menjen.
- Az ár egyértelműsége: a „/hó" + áthúzott ár a kártyán hamis képet ad a havi díjról; a nyugta és a „Következő számla így: 9 010 Ft" viszont pontos.
- Az „Időpontkérés, kapcsolat" kiváltása a foglalással világosan magyarázva (12-mobil).

## Leletek súly szerint

1. **(magas) A kártya-ár havi díjnak olvasódik, pedig csak az első hónap kedvezményes:** „~~690 Ft~~ +517 Ft/hó" — a nyugta: „A kedvezmény egyszeri"; a következő számla a teljes áron (04-mobil, 10-mobil).
2. **(magas) A nem kifizetett kosár a „Jelenleg" feliratú számokba számít:** kosárba tétel után az „Az én moduljaim" jelvénye „Jelenleg 5 370 Ft/hó", „Modulok együtt (3 db)", „Havi díja összesen 5 370 Ft" — miközben ugyanazon a képernyőn „Jelenlegi díj 4 880 Ft/hó", és „A következő számla tételei" lista csak 3 sort mutat (05-mobil … 09-mobil; 9 tételnél „Jelenleg 9 010" fizetés előtt).
3. **(közepes) A követelmény-lánc néma:** az Online foglalás egy kattintással a Szobákat és az Árakat is kosárba tette (4 → 7; a két rákötött modul +885 Ft most és +1 180 Ft/hó), magyarázat nélkül (09-mobil, 09 asztali kosár). A kép nem mutatja, volt-e toast.
4. **(közepes) Hibás mértékegység a nyugtán:** „a következő megújításkor 4 130 Ft/év díjjal" — havi fióknál Ft/hó (10-mobil).
5. **(közepes) A Többnyelvű honlap lábán az áthúzott ár = a valódi ár:** „~~11 175 Ft~~ 11 175 Ft / generálás · bemutatkozó kedvezmény −25%" (a kártyán helyesen ~~14 900~~) (03/05/09-mobil, 09 asztali, 09-fekvo).
6. **(közepes) Érintési cél:** a „Kosárba teszem" gomb 36 px magas (<44 px) (04-mobil, mérve).
7. **(közepes) Megtalálhatóság:** a Bővítés a Modulok lap tetejétől ~1 800 px-re (Előfizetés, éves ajánlat, kártyaterhelés, saját modulok után); a kezdőlapi „Modulok kezelése" a hajtás alatt (02-mobil, 04-mobil).
8. **(alacsony) Kerekítés-eltérés kártya és kosár között:** 517 vs 518 Ft, 367 vs 368 Ft (09 asztali).
9. **(alacsony) A kosár-gomb balra áll** (a jóváhagyott terv szerint jobbra, a bal oldali „Kosárba teszem" gombok fölé eshet) — takarás a képből nem ítélhető (05–09-mobil, 09-fekvo).
10. **(alacsony) Számláló-ellentmondások:** „3 modul aktív" (Áttekintés) vs „Aktív az oldalán mind a 2 modul"; utána „mind a 9 modul" vs „10 modul él az oldalán" (01-mobil, 03-mobil, 12-mobil).
11. **(alacsony) Furcsa sorrend:** a Többnyelvű honlap az „Előfizetés lemondása" doboz ALÁ került (03-mobil, 09 asztali).
12. **(alacsony, kozmetikai)** a „−25%" jelvény a kártya felső élén félig levágva; a máltai zászlónak csak a piros fele látszik; a kezdőlapi „Havi előfizetés" szürke sávja felirat nélkül üres.
13. **(képhiány, nem lelet)** A kör nem fényképezte: a belépő-űrlapot, a telefonos menüt, a telefonon kinyitott kosarat, a megerősítő ablakot és a kártyaválasztót — a 10/11 és a 12/13 kép bájtra azonos. A 10. és 11. lépés kérdéseinek fele ezért nem dönthető el.

Azóta javítva / nem új lelet: a 407 px-es összegző sáv helyett kis kosár-gomb (44 px) látszik; süti-sáv nem látszik az adminban; „szoba" felirat; hírlevél-modul nincs a kirakatban.

## FK-013 ítélet-kör — Elek feltölt mindent, telefonon

Futás: `FK-013-NIGHT-2026-09-28T12-14-40-2026-09-28T12-18-09` (citded06a5f). A tenant a képeken **„Kemencés Vendégház”** (`kemences-vendeghaz`), nem Három Huszár. Minden kép a mentés/lépés UTÁNI állapot, köztes állapotot (haladásjelző, nyitott naptár) egyik sem mutat.

## Nem-manual lépések

| # | státusz | mi történt (kép alapján) |
|---|---|---|
| 1 | pass | belépés rendben |
| 3 | fail | harness-hiba (`Execution context was destroyed` = a lap újratöltött). A feltöltés **bement**: „Mentve — az oldala frissült.”, „A saját fotói láthatók az oldalán. 12 / 24 kép a könyvtárban.” (03-mobil) |
| 4, 5 | blocked | a 3. „bukása” miatt nem futott: a +6 fotó, a nyitókép és a képaláírás NEM mért |
| 6 | fail | a „Még egy döntés hiányzik” nem jelent meg, mert NEM kellett: a Nádas apartman elsőre felvéve („Felvettük: Nádas apartman. Az alapára mentve…”, 06-mobil). Elavult forgatókönyv-elvárás, nem felület-hiba |
| 12 | fail | a Főszezon **nem** jött létre: „Válassza ki a kezdő és a záró napot.”; a dátummezők üresek („Kezdete”/„Vége”), a név és az ár az **„A szállás egésze”** kártyájába került, a 34000 az ALAPÁR mezőbe (12-mobil_0/1) |
| 13, 14 | blocked | Őszi szünet, Szilveszter (évfordulós) nem mért |
| 15 | fail | az `amenities` modul **nincs megvéve** (oldalsáv: „Még nem vette meg · 1 — Amit kínál (felszereltség)”; a Modulok lapon „Kosárba teszem”) → a lap a Modulok áttekintőre esett (15-mobil) — előfeltétel-hiba, nem regresszió |
| 24 | fail | „Mentve” nem jött: a programajánlóban nincs mit menteni (lásd 21–23) |

## Manual lépések

| lépés | kérdés röviden | ítélet | indoklás | kép |
|---|---|---|---|---|
| 2 | kiderül-e, hogy bemutató-képek; gombok; korlátok | RENDBEN | Sárga sáv: „Bemutató képek láthatók. Az élesítéshez a saját, jogtiszta fotói kellenek — az első feltöltés lecseréli a 6 bemutató képet.”; „Fotók választása” + „Fényképezés” teljes szélességű gombpár; „max. 6 MB képenként · max. 12 egyszerre · könyvtár: 0 / 24” olvasható (fekvőben is) | 02-mobil, 02-fekvo |
| 7 | „egész szállást is kiadja?” érthető-e, miért, kötelező-e | RENDBEN (a kérdés maga nem dönthető) | A kép a mentés utáni állapot, a felvevő-űrlap kérdése nem látszik; helyette az állandó „Az egész szállás egyben” kártya a MIÉRT-et jól mondja: „Ha lefoglalják, minden más szoba tele lesz arra az éjszakára — és bármelyik szoba foglalása az egészet zárja.” + „Kiadom egyben is” pipa. Hogy kötelező-e, a kép nem mutatja | 07-mobil |
| 8 | 3 egység kártya-rácsa; név+ár; „Koppintson rá” | ZAVAROS | Két hasáb, a név olvasható, de **ár egyik kártyán sincs** (csak „3 fő”), pedig fölötte „Az alapára mentve”; mind a 4 kártyán magyarázat nélküli „Hiányos” címke — hogy mi hiányzik, csak a felugróban derül ki | 08-mobil_1, 07.png |
| 9 | felugró majdnem teljes képernyő; 3 fül ujjal; Mentés lábazatban | ZAVAROS | A fülek (Alapok · Képek 0 · Felszereltség) megvannak, a lábazatban „Mentés” / „Szoba törlése”; de az első kártya **„A szállás egésze”** volt, nem a Nádas apartman — a tulaj első koppintása a nem kiadható egészre nyit. A cím 390-en „A szá…”-ra csonkul. A takarást/teljes képernyőt a teljes-lapos kép nem dönti el; asztalin a felugró balra kilóg (09_0), ez is lehet a fixed-réteg festési hamissága | 09-mobil_1/2, 09-fekvo_1, 09_0 |
| 10 | mentés után hol van; tudja-e, hogy kint van; mező mérete | ZAVAROS | A felugró nyitva maradt, a leírás bent van; saját „Mentve” jelzés a felugróban nincs — csak a figyelmeztetés változott („hiányzik: fotó és leírás vagy felszereltség” → „hiányzik: fotó”), a felső „Mentve — az oldala frissült.” pedig már a 09-es képen is ott volt. A leírás az „A szállás egésze” egységre ment. A szövegmező ~4 sor, elég | 10-mobil_1, 09-mobil_0 |
| 11 | 3 egység kártyája elkülönül; melyik ár kié; „Ez érvényes…” | ZAVAROS | A „Hol látják a vendégek az árait?” összegző jó („Nádas apartman 24 000 Ft / éj” stb.), a kártyák elkülönülnek; de az ELSŐ kártya az **„A szállás egésze”** (Alapár 0, két sárga figyelmeztetés, saját Időszaki árak űrlap), a Nádas apartman csak ~2200 px lejjebb kezdődik; a lap 5985 px. „Ez érvényes, amikor egyik időszak sem.” csonka mondat, de a „Nincs külön időszaki ár — mindig az alapár érvényes.” segít. Az évsávban a „Febr”/„Szept” egymásba lóg | 11-mobil_0/1/2 |
| 16 | soronként egy; max 6; mező 4 sorhoz; visszaolvasható | RENDBEN | „Soronként egy erősség, rövid mondatban. Legfeljebb hatot mutatunk.”; a 4 sor mentés után visszaolvasható, a mező elfér; „Mentve — az oldala frissült.” | 16-mobil, 16-fekvo |
| 17 | natív időválasztó; érték látszik; feliratok | RENDBEN | „Érkezni ettől lehet 14:00”, „Érkezni eddig lehet 20:00”, „Távozás eddig 10:00”, óra-ikonos idő-mezők; a natív választó megnyílását a kép nem mutatja. A megjegyzés-mező egysoros, a szöveg levágva („…hívjon r”) | 17-mobil |
| 18 | cím megtalálva; térkép + tű; húzható; tudja-e, hogy ez vezet | ZAVAROS | A pont megvan (46.88127, 17.60695), a tű látszik, a magyarázat jó („Ezt a pontot mutatja a térkép a vendégnek, és ide vezet az „Útvonal” gomb.”); de 390-en a térkép a lövéskor **üres szürke** (a csempék nem töltöttek be — lehet időzítés), és a **„Térkép / Műhold” váltó 390-en egyik képen sincs**, miközben a súgó „váltson Műhold nézetre”-t kér (asztalin és az Elérhetőség fülön ott van). Húzhatóság képről nem dönthető | 18-mobil_0, 19-mobil_0, 18.png |
| 19 | állapotsor „minden mentve”; 300 px térkép elég | RENDBEN | „Nincs mentetlen változás” + „A mentett helyen áll a tű” zöld pöttyel + felső „Mentve”; a térkép ~300 px, utcanévig olvasható | 19-mobil_0/1 |
| 20 | telefonformátum; visszajelzés | RENDBEN | „A honlapon így: +36 30 555 0100”, „Nincs mentetlen változás”, „Mentve — az oldala frissült.”; jó a „Mindkettő nyilvános” figyelmeztetés | 20-mobil |
| 21 | javaslatok vagy „Most gyűjtjük”; két fül; mikor lesz | HIÁNYZIK | Csak ennyi: „Most gyűjtjük a környéke programjait. Körülbelül egy órán belül itt lesznek — addig nincs miből választani…”. Az „mikor” őszinte, de **nincs fül (Javasolt / Az Ön oldalán) és nincs saját-program gomb** — a tulaj addig a SAJÁT programját sem veheti fel | 21-mobil, 21-fekvo |
| 22 | saját program űrlapja | HIÁNYZIK | A kép bájtra azonos a 21-essel: nincs „új program” gomb, nincs űrlap (az opcionális `tedd?` lépések némán kimaradtak) | 22-mobil |
| 23 | második program; „Mentés a honlapra” aktív | HIÁNYZIK | Ugyanaz a kép; se lista, se mentőgomb | 23-mobil |
| 25 | vendég írja; üres állapot; Google-kártya | RENDBEN | „Még nem érkezett vélemény. Az oldalán van egy űrlap, ahol a vendégek írhatnak…”, „A vélemény csak azután jelenik meg, hogy Ön jóváhagyta.”; Google: „A szövegeket a Google feltételei miatt nem másolhatjuk át.” Apróság: a pipák a leírás ALATT, külön sorban állnak | 25-mobil_0/1 |
| 26 | szabály-feliratok; IFA; visszajelzés | ZAVAROS | A feliratok jók („Legkorábbi érkezés mostantól … 0 = akár mai napra is foglalhatnak”, IFA: „A vendég a helyszínen fizeti…”), „Mentve” fent látszik; DE a fejléc sötétkék kártyáján a **„Online foglalás” cím sötét betűvel sötét alapon olvashatatlan** (a „990 Ft/hó” pirula is), és a modulban egy második szoba-szerkesztő („Mit ad ki? — MEGLÉVŐ SZOBÁI”, név/fő/Mentés/Törlés mind a 4 egységre) ismétli a Szobák modult | 26-mobil_0/1/2, 26-fekvo_0 |
| 27 | naptár 390-en; koppintás jelöl; mentés; érti-e | RENDBEN | 7 oszlop, vízszintes görgetés nélkül; „Mikor nem kiadó? — A szállás egésze”, „Koppintson azokra a napokra, amikor nem tud vendéget fogadni.”, jelmagyarázat, „Naptár mentése” a naptár alatt. Koppintás nem történt (a kép = 26), a jelölést nem dönti el. Itt is az „A szállás egésze” az alapfül | 27-mobil (=26-mobil_0) |
| 28 | figyelmeztetés; csomagok; nyelvválasztó; takarás; egyszeri | RENDBEN | „Fontos: a fordítás a most elmentett tartalomból készül…” (kicsi, narancs, de olvasható); Alap/Bővített/Teljes kártyák, 2 hasábos zászlós lista; „egyszeri díjért” + sáv: „Egyszeri díj 14 900 Ft / generálás”. A kártya a Modulok lap LEGALJÁN, a lemondás alatt van (~4300 px) — nehéz odatalálni. A takarást a teljes-lapos kép nem dönti el | 28-mobil_3/4 |
| 29 | kijelölt nyelvek; kapacitás-sor; ár a gombon; két gomb | RENDBEN | „német”, „angol” kijelölt (pipa + keret), „Még 1 nyelvet választhat UGYANEZÉRT az árért.”, „Fizetés és generálás (14 900 Ft)”; a képen csak egy fizető gomb látszik | 29-mobil_3/4 |
| 30 | összkép | ZAVAROS | Legnehezebb: **Árak/szezonok** (5985 px, az üres „A szállás egésze” kártya elöl, a dátumválasztó nem vitte be a napot) és a **programajánló** (nincs mit szerkeszteni). Visszajelzés elveszett: szoba-felugró (nincs saját „Mentve”). Asztal kellene: az Árak lapon. Magától ajánlott sorrend a képeken nincs (a Modulok lap alfabetikus-szerű lista, „Beállítás” gombokkal); telefonon a futás alapján ~30–45 perc lenne, ha minden működne | mind |

## Modulonként: fel tudta-e tölteni telefonon

| modul | eredmény | miért |
|---|---|---|
| gallery (Fotók) | részben | 12 kép bement (12/24), de a +6, a nyitókép és a képaláírás nem mért (4–5 blocked) |
| rooms | igen (hibával) | 3 egység felvéve; a leírás a rossz egységre („A szállás egésze”) ment, mert az az első kártya; a kártyákon nincs ár |
| amenities | nem | a modul nincs megvéve — előfeltétel-hiba (FK-012) |
| pricing | részben | az alapárak megvannak (24/16/19 ezer), **egyik szezon sem** jött létre: „Válassza ki a kezdő és a záró napot.” |
| usp | igen | 4 sor mentve, visszaolvasható |
| reviews | igen | értesítési cím mentve, a szabályok érthetők |
| poi | nem | a modul „Most gyűjtjük…” állapotban, saját program sem vehető fel |
| location | igen | cím, tű, megközelítés, parkolás mentve („Nincs mentetlen változás”) |
| hours | igen | 14:00 / 20:00 / 10:00 + megjegyzés |
| booking | igen | min 2 éj, IFA 600, értesítési cím, „Mi van benne az árban” mentve; naptár-kizárás nem próbált |
| enquiry | — | nincs róla lépés; a Modulok lap szerint „Időpontkérés, kapcsolat — nem számítjuk, ezt most az Online foglalás váltja ki” |

## Leletek súly szerint

1. **Szezonok nem vehetők fel (12, blokkolja 13–14).** A dátum nem kerül be („Válassza ki a kezdő és a záró napot.”). Két ok keveredik: (a) a lap ELSŐ kártyája az „A szállás egésze”, ezért a `.first()` szelektorok oda írtak — a 34000 az ALAPÁR mezőbe ment, nem a szezonárba; (b) a nyitott naptárról egyik kép sem készült, így hogy a `[data-d]` koppintás a felületen vagy a forgatókönyvben bukik, **képről nem dönthető**. Javaslat: a szezon-lépéseket a Nádas apartman kártyájára kell hatókörözni, és a naptárat nyitott állapotban is le kell fényképezni.
2. **Programajánló: a tulaj semmit nem tud tenni, amíg a gyűjtés fut (21–24).** Nincs fül, nincs saját program. Termék-kérdés: a saját program felvétele ne várjon a gyűjtésre; a forgatókönyv `tedd?` lépései némán kimaradtak.
3. **„A szállás egésze” mindenhol az első** (szobák rácsa, felugró, Árak kártyák, foglalási naptár-fül): a tulaj első koppintása/beírása a nem kiadott egészre megy (a leírás oda került, 10). Az Árak lap így 5985 px.
4. **Az „Online foglalás” cím olvashatatlan** a sötét fejléc-kártyán (sötét betű sötétkéken; a „990 Ft/hó” is) — mobilon és fekvőben is (26-mobil_0, 26-fekvo_0).
5. **Szobakártyán nincs ár, és a „Hiányos” címke nem mondja meg, mi hiányzik** (08) — a magyarázat csak a felugróban („hiányzik: fotó és leírás vagy felszereltség”).
6. **Szoba-felugró mentése után nincs saját visszajelzés** (10); csak a figyelmeztetés-szöveg változik.
7. **Térkép 390-en: nincs Térkép/Műhold váltó**, a súgó mégis „váltson Műhold nézetre”; az első képen a csempék üresek (18; lehet időzítés).
8. **Kettőzött szoba-szerkesztő** a foglalás modulban („Mit ad ki? — MEGLÉVŐ SZOBÁI”, név/fő/Mentés/Törlés) a Szobák modul mellett.
9. Apróságok: évsávban „Febr”/„Szept” egymásba lóg (11); „Mentve” pirula és „‹ Vissza a modulokhoz” egy sorba csúszik fekvőben/asztalin (16-fekvo); a nyitvatartás-megjegyzés egysoros, levágva (17); a többnyelvű kártya a Modulok lap legalján, a lemondás alatt (28).
10. Forgatókönyv-karbantartás (nem felület): a 3. lépés bukása harness-hiba (újratöltés), és elvitte a 4–5-öt; a 6. elvárása („Még egy döntés hiányzik”) elavult; a 15. előfeltétele (amenities megvéve) nem teljesült.

## FK-014 — ítélet-kör (vendég, telefon) — Három Huszár Apartments

Elsődleges futás: `/home/citoviso/wt/cit37b9296b/elek/runs/FK-014-NIGHT-2026-09-28T13-49-52-2026-09-28T13-49-54/`
(képek: `shots/NN-mobil.png` 390, `NN-fekvo.png` 844×390, `NN.png` 1280). Összevetés: a 2026-09-27T23-58 régi futás.
Megjegyzés: a teljes-lapos képeken a fix rétegeket (≡ gomb, alsó „4,9 ★ · FOGLALÁS” sáv) nem ítéltem takarásnak.
A 19–21. lépés képe mind a vélemény-hibalap (a 20–21. lépésnek nincs saját `út`-ja), ezért a láblécet a korábbi teljes-lapos képekről ítéltem.

| lépés | kérdés röviden | ítélet | indoklás | kép |
|---|---|---|---|---|
| 2 | első képernyő: hol, mit, egy fő gomb; főcím egésze (álló + fekvő) | ZAVAROS | 390-en a név, a „KÖVESKÁL · KÁLI-MEDENCE” sor, a fotó és a teljes főcím („…kerttel és játszótérrel”) kifér, de a képernyő felső ~150 px-e egy szinte láthatatlan, kifakult fejléc (halvány név + „FOGLALÁS”); asztalin ugyanez egy üres, 88 px-es bézs sáv. A „SZABAD IDŐPONTOT KÉREK” gomb a 844 px-es hajtás szélén ül (y≈800–847), alatta ott a „SZABAD IDŐPONTOK MEGTEKINTÉSE” is: két majdnem azonos szövegű elsődleges gomb. Fekvőben a főcím kifér, a CTA-k viszont a 390 px-es hajtás alá esnek, a képernyő tetején pedig három „Foglalás” áll (fejléc, hős-pirula, widget). | 02-mobil.png, 02-fekvo.png, 02.png |
| 3 | menü: van-e, érthető-e, takar-e | ZAVAROS | Menü van: telefonon a bal alsó ≡ gomb, asztalin sorban álló linkek. A tételek („Szolgáltatások, Galéria, Vélemények, Kapcsolat, Foglalás”) érthetőek, de a vendég két fő célja, a **Szobák** és az **Árak** nem szerepel köztük. A kinyitott menüről nem készült kép, így a takarás nem dönthető el. | 03-mobil.png, 03.png |
| 4 | szobakártyák: ár „-tól/éj”, férőhely, különbség, fotó, egymás alatt | ZAVAROS | Négy kártya áll egymás alatt, olvashatóan (a 4. egység visszajött, ez azóta javítva). A név, a férőhely és az ár viszont elválasztás nélkül egy sorba tapad („Nádas apartman4 fő24 000 Ft / éj”), nincs „-tól”, nincs kártyafotó, és semmi nem mondja meg, miben különbözik a három egység. Az első kártya, „A szállás egésze”, ár és férőhely nélkül áll ott, mégis van „Foglalás” gombja. | 04-mobil.png, 04-fekvo.png |
| 5 | részletek-felugró: kifér, X, foglalás-gomb, leírás, fekvő | HIÁNYZIK | A felugró „A szállás egésze” egységre nyílt. A fotó helyén fekete doboz áll (lapozó nyilakkal), a leírás két mondat, nincs ár, férőhely és felszereltség. 390-en az alja üres, a „FOGLALÁS” gomb nem látszik (asztalin megvan). Fekvőben a doboz 390 px magas, a × rácsúszik a „›” nyílra, és foglalás-gomb nincs. Telefonon a háttér nincs elsötétítve. | 05-mobil.png, 05-fekvo.png, 05.png |
| 6 | bezárás után a lap a helyén, nincs fátyol | RENDBEN | Zárás után felugró- és fátyolmaradvány nincs. A görgetési pozíciót a teljes-lapos kép nem mutatja, ez a képből nem dönthető el. | 06-mobil.png |
| 7 | ártábla időszakonként; szezonon kívül | ZAVAROS | Ártábla nincs (az ADR-0059 szerint csak alapár esetén szándékos). Az árat a vendég a kártyán látja („24 000 Ft / éj”), a widget pedig „Alapár: 2 éj × 24 000 Ft”-ot ír. Az „Alapár” szó eltérő időszaki árat sejtet, amit sehol nem magyaráz meg. Az „egyedi árat ad” ellentmondás nem jelenik meg. | 07-mobil.png, 15-mobil.png |
| 8 | galéria: betölt, nem végtelen, nagyítás ujjal | RENDBEN | A 7 fotó („KERT ÉS UDVAR – Zöld zugok…”) betölt, a mozaik 390-en kb. másfél képernyő. Nagyításra utaló jel nincs a képen, és a futás nem is nyitotta meg a nagyítót, így a nagyító ujjas használata a képből NEM dönthető el. | 08-mobil.png, 09.png |
| 9 | térkép, megközelítés/parkolás, programajánló | HIÁNYZIK | A „Megközelítés” alatt nincs térkép: egy fehér doboz áll benne tűvel és a „Három Huszár Apartments” felirattal, látható útvonal- vagy Google Maps-link nélkül. A cím („Köveskál, Fő utca 12.”), a leírás („A 71-es útról…”) és a parkolás („Ingyenes parkolás az udvarban, két autónak”) olvasható. Programajánló nincs (az FK-013-ban elakadt). | 09-mobil.png, 09.png |
| 10 | felszereltség-ikonok, lista, érkezés/távozás, koppintható telefon | ZAVAROS | Az idők egyértelműek: „14:00 – 20:00 ÉRKEZÉS”, „10:00 TÁVOZÁS EDDIG”, „Késői érkezés előre egyeztetve…”. Az „Amit kínálunk” lista viszont csak 3 tétel (grill, kerti bútor, terasz), kettőnek ugyanaz a levél-ikon, a fejlécben ígért „Kandalló, klíma” pedig nincs benne; wifi, konyha és ágyak sincs. A „+36 30 555 0100” serif szövegként jelenik meg, linkre utaló jel nélkül. | 10-mobil.png |
| 11 | vélemények igazat mondanak | RENDBEN | „4,9 · 56 Google-értékelés · Megnézem a Google-on”, kitalált csillagok nélkül. Véleményszöveg nincs, és a „Itt a vendégek véleményei jelennek meg” mondat nem mondja ki, hogy még nincs egy sem. Az űrlap 390-en egy oszlopban, feliratozva olvasható. | 11-mobil.png |
| 12 | dátum nélkül: útmutatás, két gomb különbsége | ZAVAROS | A widget útmutatása egyértelmű: „Melyiket foglalná? Nádas apartman · 4 fő” (ár nélküli egységre már nem nyit, ez azóta javítva), „VÁLASSZA KI AZ ÉRKEZÉS ÉS A TÁVOZÁS NAPJÁT”, halvány „Válassza ki a napokat a naptárban” gomb. A hősben viszont egymás alatt áll a „SZABAD IDŐPONTOT KÉREK” és a „SZABAD IDŐPONTOK MEGTEKINTÉSE”, amelyek szövegből nem választhatók szét. | 12-mobil.png, 02-mobil.png |
| 13 | fordított dátum üzenete | RENDBEN | A mezők alatt piros doboz: „A távozás legyen későbbi az érkezésnél.”, a gomb halvány „Javítsa a dátumot a folytatáshoz”. | 13-mobil.png |
| 14 | múltbeli dátum, tiltott gomb | RENDBEN | „A legkorábbi foglalható érkezés: 2026. 09. 28.”, a gomb halvány és „Javítsa a dátumot…” feliratú. Apró zavar: közben „2 éjszaka”-t is kiír. | 14-mobil.png |
| 15 | ár azonnal, összeg a gomb fölött, gombfelirat, fekvő | RENDBEN | Azonnal megjelenik: „AZ ÁR — 2026. 10. 24. → 2026. 10. 26. · Alapár: 2 éj × 24 000 Ft = 48 000 Ft · Összesen a szállásért 48 000 Ft” + IFA-doboz (2 400 Ft), fölötte a „Tovább a kérés adataihoz (2 éjszaka)” gomb (két sorba törik). Zavarok: a naptár szeptemberen marad, nem jelöli a beírt októberi napokat; „Az ár a TELJES SZÁLLÁSRA szól” egy apartmanra félrevezető; fekvőben az egységválasztó az ár ALATT áll, a beküldő gomb kb. 1300 px-rel lejjebb. | 15-mobil.png, 15-fekvo.png |
| 16 | 2. lépés: mezők, visszaút | RENDBEN | Összegző doboz („Nádas apartman · 2026. 10. 24. → 10. 26. · 2 éjszaka · 48 000 Ft”) „Módosítom a napokat” linkkel, alatta egy oszlopban, feliratozva a Vendégek ± / név / e-mail / telefon / üzenet mezők. A billentyűzet-takarás a képből nem dönthető el. | 16-mobil.png |
| 17 | nyugta: nem foglalás, határidő, hova, visszalépés | RENDBEN | Mind a négy megvan: „A foglalás még nem végleges — ez egy kérés”, „legkésőbb 48 órán belül”, „erre a címre küldjük: elek@citoviso.com”, „Meggondolta magát? … visszavonja a kérést”. A tételes blokkban szerepel a „Hivatkozás FG-96A0CB”, az „Összesen: 48 000 Ft” és a „Vissza a kezdőlapra”. Egy képernyőnyi. (A régi futásban ez a lépés FAIL volt, azóta javítva.) | 17-mobil.png |
| 18 | ár nélküli időszak → alapár vagy ajánlat | RENDBEN | 2027. 03. 05–07-re „Alapár: 2 éj × 24 000 Ft = 48 000 Ft”-ot számol, a naptár márciusra lapoz és kijelöli a napokat, vagyis egyértelmű, hogy alapár fut. Árajánlatra nem vált, de szezonok híján ez nem ellentmondás. Az ár-doboz és a gomb 390-en egy képernyőn van. | 18-mobil.png |
| 19 | vélemény beküldése (FAIL) | ZAVAROS | Stílus nélküli, rendszerbetűs hibalap: piros „Nem sikerült elküldeni”, alatta „• Már küldött véleményt. Köszönjük!”, egy „Vissza az oldalra” gombbal (a POST `/api/velemeny` 400-at adott). Az ok a korábbi futásból megmaradt, ugyanarról az e-mailről (elek@citoviso.com) küldött vélemény: tesztadat-állapot, nem kódhiba. Vendég-szemmel viszont a válasz ellentmondásos (hiba + köszönet), a honlap arculatán kívül esik, és nem mondja meg, mikor jelenik meg a korábbi vélemény. A régi futásban ugyanez a 400. | 19-mobil.png |
| 20 | lábléc: szállásadó neve, jogi lapok, tulaj-belépés, nyelv | ZAVAROS | A jogi sáv „Elek Éjszakai Tesztgazda · Adatkezelés · Impresszum” (a szállásadó, nem a Citoviso), a „Tulajdonosi belépés” apró és halvány, nem tolakodó, nyelvváltó nincs, semmi nem lóg ki. Közvetlenül fölötte viszont a vendégnek szóló reklám: „Ezt az oldalt a Citoviso készítette — modern honlap percek alatt.” A jogi lapokat a futás nem nyitotta meg (a 20-as kép még a vélemény-hibalap), ezért a lapok tartalma nem ítélhető. | 03-mobil.png (alja), 15-fekvo.png (alja), 20-mobil.png |
| 21 | összkép: foglalna-e egy kézzel | ZAVAROS | Igen, foglalna: a widget dátum → ár → adatok → tételes nyugta útja 390-en végigmegy. Elakadási pontok: ① 390, 4–5. lépés: a szobakártyákból és a (fotó és ár nélküli) felugróból nem derül ki, melyik egység mire jó, és a felugróból telefonon nincs foglalás-gomb; ② a hős két majdnem azonos gombja; ③ a foglaló widget a lap alján van (390-en y≈10 300 a 12 400-ból, kb. 12 képernyőnyi görgetés), bár a pirula- és fejléc-gombok elvihetnek oda. Legzavarosabb képernyő: a 05 szoba-felugró. Amit hiába keresne: térkép, szobafotók, felszereltség (wifi/konyha), vendégvélemény-szövegek. Fekvőben: a hős CTA-k a hajtás alatt, a felugrónál nincs foglalás-gomb és a × rácsúszik a nyílra, a widgetben az egységválasztó az ár alatt. | 02–18 képek |

## Modulonként: a vendég megtalálta/értette-e

| modul | ítélet | miért |
|---|---|---|
| gallery | igen | 7 valódi fotó, rendezett mozaik. A nagyító nem volt kipróbálva. |
| rooms | részben | Megvan a 4 egység, a férőhely és az ár, de összetapadt sorban, fotó és különbség nélkül. „A szállás egésze” ár nélkül, foglalás-gombbal áll ott; a felugró fekete fotóval, ár nélkül, telefonon foglalás-gomb nélkül nyílik. |
| amenities | részben | 3 tétel (grill, bútor, terasz), két azonos levél-ikonnal; a vendég alapkérdései (wifi, klíma, konyha, kandalló) hiányoznak, holott a fejléc ígéri őket. |
| pricing | részben | Az ár egyértelmű (kártya + widget, 24 000 / 16 000 / 19 000 Ft/éj). Ártábla nincs (doktrína szerint), az „Alapár” szó mögötti szezonalitás nincs megmagyarázva. |
| usp | igen | „Amiért érdemes betérni”: 4 kártya (nádfedeles ház, kert, nincs átmenő forgalom, „Balaton 12 km, a Kőtenger 5 km”), értelmes ikonokkal. (A „betérni” vendéglátós szóhasználat.) |
| reviews | részben | Google 4,9 / 56 + link megvan; saját véleményszöveg nincs. A beküldés tesztadat-ütközés miatt 400-at adott, egy arculaton kívüli, ellentmondásos hibalappal. |
| poi | nem | A lapon nincs programajánló (az FK-013-ban a mentés elakadt). |
| location | részben | Cím, útleírás és parkolás megvan; a térkép-doboz térkép helyett csak egy tű és a név, útvonal-link nélkül. |
| hours | igen | Érkezés 14:00–20:00, távozás 10:00-ig, késői érkezés egyeztetéssel. |
| booking | igen | Dátum → azonnali ár + IFA → adatok → tételes nyugta. Jól kezeli a fordított és a múltbeli dátumot. Apróságok: a naptár nem követi a beírt dátumot (10. hó), „TELJES SZÁLLÁSRA” egy apartmanra, fekvőben az egységválasztó az ár alatt. |
| enquiry | részben | A „SZABAD IDŐPONTOT KÉREK” gomb megvan (hős, Kapcsolat), de szövegből nem választható szét a „SZABAD IDŐPONTOK MEGTEKINTÉSE” gombtól; az árajánlat-ág ebben a futásban nem jelent meg. |

## Leletek súly szerint

1. **[magas] A szoba-felugró üres:** fekete fotódoboz, se ár, se férőhely, se felszereltség, 390-en és fekvőben foglalás-gomb nélkül (asztalin van). Ráadásul az ár nélküli „A szállás egésze” egységre nyílik (05-mobil/fekvo).
2. **[magas] „A szállás egésze” kártya a vendég előtt:** ár és férőhely nélkül, „Foglalás” gombbal (04-mobil). A régi futásban ugyanígy volt, vagyis a „vendég elől rejtve” javítás a kártyasoron NEM látszik.
3. **[közepes] A szobakártyák összetapadnak és fotó nélküliek:** „Nádas apartman4 fő24 000 Ft / éj”, nincs „-tól”, nincs különbség az egységek között (04, 390/fekvő/asztali).
4. **[közepes] Térkép helyett üres doboz** (tű + név), útvonal-link nélkül (09).
5. **[közepes] A vélemény-beküldés hibalapja** stílus nélküli, rendszerbetűs, és ellentmondásos („Nem sikerült elküldeni” + „Köszönjük!”). A 400-as ok itt tesztadat (ismételt e-mail), a vendég-válasz minősége viszont valódi lelet (19). Futtatási megjegyzés: a 20–21. lépés képe emiatt a hibalap.
6. **[közepes] Első képernyő:** ~150 px-es kifakult, szinte láthatatlan fejléc-sáv 390-en (asztalin üres 88 px-es sáv). Két majdnem azonos szövegű elsődleges gomb („SZABAD IDŐPONTOT KÉREK” / „SZABAD IDŐPONTOK MEGTEKINTÉSE”), fekvőben három „Foglalás” (02).
7. **[közepes] Felszereltség:** 3 tétel, ismétlődő levél-ikon, hiányzik a fejlécben ígért kandalló és klíma, valamint a wifi és a konyha (10).
8. **[alacsony] A menüből hiányzik a „Szobák” és az „Árak”** (03).
9. **[alacsony] Widget:** a naptár nem ugrik a beírt hónapra (15, szept. marad; a 18-ban igen); „Az ár a TELJES SZÁLLÁSRA szól” egy apartmanra; a gombfelirat két sorba törik; fekvőben az egységválasztó az ár alatt, a beküldés ~1300 px-rel lejjebb (15-fekvo).
10. **[alacsony] Citoviso-reklám a vendégnek** a láblécben („Ezt az oldalt a Citoviso készítette — modern honlap percek alatt.”).
11. **[alacsony] „Alapár” magyarázat nélkül** (ártábla nincs), a telefonszám nem látszik linknek (10), a véleményszakasz nem mondja ki, hogy még nincs saját vélemény.

**Azóta javítva (a régi futáshoz képest):** a 4. egység (Kerti stúdió) látszik; a widget a „Nádas apartman · 4 fő” egységre nyit, ár nélküli egységre nem; a 17. lépés (nyugta) átmegy, a régi futásban FAIL volt. Süti-sáv egyik képen sincs.
**Nem dönthető el képből:** a nyitott menü takarása, a galéria-nagyító ujjas használata, a görgetési pozíció zárás után, a billentyűzet-takarás, a jogi lapok tartalma.

## Ítélet-kör: FK-015 (tulaj, telefonon) · FK-016 (vendég utóélete)

Források:
- FK-015: `/home/citoviso/wt/citded06a5f/elek/runs/FK-015-NIGHT-2026-09-28T13-57-33-2026-09-28T13-57-39/`
- FK-016: `/home/citoviso/wt/citded06a5f/elek/runs/FK-016-NIGHT-2026-09-28T13-59-30-2026-09-28T13-59-33/`

A képeket a Read eszközzel néztem meg: 390 px-es sávokra vágva, a fekvő és az asztali képet ott, ahol a kérdés érintette. A position:fixed réteget (alsó sáv, süti-sáv) a teljes lapos kép a lap aljára festi, ezért ebből takarást nem ítéltem.

⚠️ Azonos képek (md5): az FK-015-ben a 05 és a 06, a 10 és a 11, valamint a 12 és a 13 bájtra azonos. A 06-os, a 11-es és a 13-as lépésben tehát nem történt új művelet. A 11-esnél ez azt jelenti, hogy a vélemény jóváhagyására senki nem koppintott, mert a forgatókönyvben nincs `tedd` sor. Az FK-016-ban a 10 és a 11 azonos.

## FK-015 — a tulaj telefonon

| lépés | kérdés röviden | ítélet | indoklás | kép |
|---|---|---|---|---|
| 1 | belépés 390-en; látszik-e az ÚJ kérés | ZAVAROS | A belépő képernyőről nincs kép, csak a belépés utáni Áttekintésről, így a mezők és a billentyűzet kérdését a kép nem dönti el. Az új kérés csak az Üzenetek kártya levágott sora („Foglalási kérés: Elek Vendég Éjszakai, 2026. 10. 24…”), ráadásul olvasatlan-pötty nélkül. A „Teendők · 2 nyitott” listában NINCS döntésre váró foglalás, és az alsó sáv „Foglalások” ikonján nincs jelvény, csak az Üzenetekén („11”). | 01-mobil.png |
| 2 | a listasor megmondja-e, miről és mikor szól | RENDBEN | A sor szerint „Foglalási kérés: Elek Vendég Éjszakai, 2026. 10. 24.–2026. 10. 26.”, időpont „2026. 09. 28. 15:52”, „Megnyitom ▾”, a szűrőben pedig „Foglalások 1”. Mellékesen: ez az egyetlen sor olvasatlan-pötty nélkül, a 11 számla- és véleménysor között elvész. | 02-mobil.png |
| 3 | „Foglalások megnyitása” ≥44 px, görgetés nélkül; pipa/kereszt érthető-e | ZAVAROS | A kinyílt levéltörzs olvasható, és minden benne van: „Ár összesen … 48 000 Ft”, „Kisállattal érkeznénk, lehetséges?”. A „Foglalások megnyitása” gomb azonban kb. y 865–901 px-en ül, vagyis a 844 px-es hajtás ALATT, és kb. 36 px magas. A gyors döntés ikonjai nem felirat nélküliek („✓ Elfogadom”, „✕ Nem szabad”), ez rendben van. | 03-mobil.png |
| 4 | a gyors döntés előbb rákérdez; van-e visszaút | ZAVAROS | Rákérdez: „Elfogadja a foglalást? A vendég azonnal visszaigazolást kap.”, alatta „Igen, elfogadom”. Külön „Mégsem” gomb viszont nincs, a doboz alatti következő koppintható elem a „✕ Nem szabad”, tehát az ellentétes döntés. A megerősítő (y ≈ 970–1075) a hajtás alatt van. | 04-mobil.png |
| 5 | KI/MIKOR/MENNYI/HÁNY FŐ/ÜZENET egy képernyőn; gombok | ZAVAROS | A kártyán minden adat megvan, és nem lóg ki: „2026. 10. 24. → 2026. 10. 26. · 2 éj · 2 fő · 48 000 Ft”, „+36 30 555 0101 · Nádas apartman”, „Van még idő — még 48 óra”, „Kisállattal érkeznénk…”. A kártya azonban csak kb. y 720-nál kezdődik (fölötte a naptár, három csempe és egy tájékoztató doboz áll), így a „Visszaigazolom / Elutasítom” gombpár (y ≈ 960) görgetés után érhető el. | 05-mobil.png |
| 6 | az árajánlat-kérés külön, felismerhető tétel | HIÁNYZIK | Árajánlat-kérés nincs: „Döntésre vár 1 kérés”, és a listában csak Elek foglalási kérése szerepel. Az Üzenetekben sincs ilyen levél („Foglalások 1”). A kép bájtra azonos az 5. lépésével. Valószínű ok: az FK-014 lánca (best-effort ⑦) nem adott be ilyen kérést. Hogy a felület hogyan mutatná, azt a kép nem dönti el. | 06-mobil.png (= 05) |
| 7 | a visszaigazolás megerősítőt nyit, a vendég nevével, képernyőre fér | ZAVAROS | Nyílik egy űrlap: „Üzenet a vendégnek a visszaigazoló levélbe (nem kötelező)”, jó következmény-mondattal („a napok foglalttá válnak …, a vendég e-mailt kap naptár-melléklettel … és a lemondó-linkkel”), alatta a „Megerősítem a visszaigazolást” gomb. Két gond van vele. 390-en az űrlap a gombsor BAL FELÉBE szorul (kb. 160 px széles hasáb, a gomb felirata két sorba törik), és a hajtás alatt van (y ≈ 1000–1290). A megerősítőben nincs benne a vendég neve, azt csak a fölötte álló kártya mutatja. | 07-mobil.png, 07-fekvo.png |
| 8 | a döntés után kimondja-e, kit igazolt vissza, és hogy ment levél | RENDBEN | A zöld sáv szövege: „Visszaigazolva: Elek Vendég Éjszakai (2026. 10. 24. — 2026. 10. 26.) — A vendég e-mailt kapott róla.” A csempék frissültek („Következő érkezés 2026. 10. 24.”, „1 foglalás”), a kártya átkerült a „Korábbi kérések” közé, a VENDÉG/ÖN üzenetpárral. Apróság: a fejléc „Naptár — 2026. szeptember · nincs foglalt nap” maradt, mert októberi foglalásról van szó. | 08-mobil.png |
| 9 | az ajánlat-kérésen van-e „ajánlat” művelet | HIÁNYZIK | A lapon nincs árajánlat-kérés, és nincs ajánlat-művelet sem: „Most nincs döntésre váró kérés ✔”. Közben az Áttekintés Teendői maguk írják, hogy „1 szobájának nincs ára — … és árajánlatot kér”. Láncrés (lásd a 6. lépést), a felület ajánlat-útját ez a futás nem mérte. | 09-mobil.png |
| 10 | a vélemény dönthető 390-en; tudja-e, hogy azonnal kint lesz | RENDBEN | Minden a hajtás fölött van: „Döntésre vár 1”, „Elek Vendég Éjszakai ★★★★★ 5/5”, a teljes szöveg („Csendes kert, nádfedeles ház…”), valamint a „Kiteszem” és a „Nem teszem ki” gomb. A „Kiteszem” szó hordozza a következményt. Kifejezett „azonnal megjelenik a honlapon, a Vélemények szekcióban” mondat nincs. A morzsamenü „H… › M… ›” formára csonkul. | 10-mobil.png |
| 11 | mi lett a vélemény státusza a koppintás után | HIÁNYZIK | A kép bájtra azonos a 10. lépésével, és továbbra is „Döntésre vár 1” áll rajta, vagyis a jóváhagyás NEM történt meg, mert a forgatókönyvben nincs koppintó sor. Ez forgatókönyv-rés, nem felületi lelet. Emiatt bukott az FK-016 7. lépése. | 11-mobil.png (= 10) |
| 12 | a foglalt napok a naptárban; nem csak szín; fekvő | ZAVAROS | A naptár „2026. szeptember · nincs foglalt nap” állapotban nyílik, és „A szállás egésze” van kiválasztva, így a 10. 24–26-i foglalás a képen NEM LÁTSZIK. Ehhez lapozni kellene a › gombbal, és kérdés, hogy „A szállás egésze” nézet mutatja-e a Nádas apartman foglalását. A jelmagyarázat színkülönbségre épül (a halvány „szabad” és a halvány zöld „vendég-foglalás” négyzet alig tér el). A nap-panelt a kép nem mutatja. Fekvő tartásban a cellák óriásiak, és a naptár egymaga kitölti a képernyőt, vagyis nem használhatóbb. | 12-mobil.png, 12-fekvo.png |
| 13 | összkép: le tudta volna vezényelni telefonon? | ZAVAROS | Visszaigazolni asztali gép nélkül is tudott. Közben viszont három műveleti pont a hajtás alatt ült (3., 5., 7. lépés), a visszaigazoló űrlap fél szélességbe szorult (7.), a gyors döntésnek nincs „Mégsem” gombja (4.), a döntésre váró kártyán a telefonszám sima szöveg, „Felhívom” nélkül, és az új kérés nem jelenik meg a Teendőkben (1.). Ajánlatot adni és véleményt kitenni ebben a futásban nem próbált. | 13-mobil.png (= 12) + a futás összes képe |

## FK-016 — a vendég utóélete

| lépés | kérdés röviden | ítélet | indoklás | kép |
|---|---|---|---|---|
| 1 | a szállás oldala él | — (pass) | Gépileg zöld: „Három Huszár Apartments” látható. | 01-mobil.png |
| 2 | lemondó megerősítő: melyik foglalás; gombok; elérhetőség | HIÁNYZIK | A foglalás egyértelmű („Elek Vendég Éjszakai · 2026. 10. 24. — 2026. 10. 26. · FG-96A0CB”). A két gomb nemcsak színben tér el: a piros, teli „Igen, lemondom a foglalást” mellett a körvonalas „Mégsem — megtartom” áll, és mindkettő a hajtás fölött van. A lap viszont azt írja: „Ha csak módosítani szeretne, inkább írjon a szállásadónak”, és ehhez NINCS kattintható telefonszám vagy e-mail cím, pedig ez a vendég egyetlen alternatívája. Apróság: a „Mégsem” felirata a gomb tetejére csúszott. | 02-mobil.png |
| 3 | a „Mégsem” megtart, és nem zsákutcába visz | HIÁNYZIK | A vendég a böngésző hibalapjára érkezik: „A webhely nem érhető el — A(z) 100.97.188.105 visszautasította a csatlakozást. ERR_CONNECTION_REFUSED”. A kód szerint (a citef341505 fában) a gomb a `siteUrlFor()` → `tenantSiteUrl(config.publicSiteUrl, …)` abszolút címre visz. Hogy ez csak a dev-gép publicSiteUrl-je miatt törik-e (host-kötött hiba), vagy élesben is, azt a kép nem dönti el. | 03-mobil.png, 03.png |
| 4 | ajánlat-lap: ki/mire/mennyiért/meddig | — (fail, nem futott) | `hiányzó env-helyettesítő: ${ELEK_NIGHT_OFFER_PATH}`. Nem született ajánlat, mert az FK-015 6. és 9. lépésében sem volt ajánlat-kérés. A képek csak a hiba előtti állapotot mutatják. | 04-mobil.png |
| 5 | az elfogadás után a vendég tudja, hogy végleges | — (blocked) | A 4. lépés miatt nem futott. | — |
| 6 | az elfogadott ajánlat linkje újranyitva | — (blocked) | A 4. lépés miatt nem futott. | — |
| 7 | a jóváhagyott vélemény kint van-e | — (fail) | A „Vendégek véleménye” szekcióban csak a Google-összesítő („4,9 · 56 Google-értékelés”) és az üres állapot szövege áll („Itt a vendégek véleményei jelennek meg … közzététel előtt a szállásadó hagyja jóvá”). Elek véleménye nincs ott, de ez várható: az FK-015 11. lépésében a jóváhagyás nem történt meg. Ez NEM igazolt felületi hiba. | 07-mobil.png |
| 8 | a widget jelzi-e a foglalt napokat (szöveggel is) | ZAVAROS | Szövegesen jelez: „Sajnos ezek a napok már foglaltak. Válasszon másik időpontot.”, a gomb „Javítsa a dátumot a folytatáshoz”, a jelmagyarázat „szabad / foglalt”, és a foglalt négyzet teli. A widget naptára viszont „2026. szeptember”-en marad, vagyis az ütköző októberi napok, és hogy mi szabad körülöttük, nem látszik. Konkrét alternatívát nem javasol. Mellékes lelet ugyanezen a képen, a „Szobák, apartmanok” listában: a név, a létszám és az ár elválasztó nélkül fut össze („Nádas apartman4 fő24 000 Ft / éj”, „Kisházi szoba2 fő16 000 Ft / éj”). | 08-mobil.png |
| 9 | lemondás után: tudja-e, mi jön; út vissza az élő oldalra | ZAVAROS | A szöveg hibátlan: „Foglalása lemondva — A 2026. 10. 24. — 2026. 10. 26. közötti foglalás lemondva, a napok felszabadultak. A szállásadó értesítést kapott, és Ön is kap egy megerősítő e-mailt. Hivatkozás: FG-96A0CB”. A „Vissza a szállás oldalára” gomb ugyanazt a siteUrl-t kapja, amelyre a 3. lépésben a „Mégsem” ERR_CONNECTION_REFUSED-ot adott. Ebben a futásban nem kattintották meg, így a kép nem dönti el, hogy él-e. A gomb felirata két sorba törik, és balra-fölfelé csúszik. | 09-mobil.png |
| 10 | a használt link újranyitva hangosan szól | — (pass) | „A link már nem él — Ezt a foglalást korábban már lemondták — nincs újabb teendő.” | 10-mobil.png |
| 11 | összkép: végig tudta-e, mi történik vele | HIÁNYZIK | Minden képernyő megmondja, hol tart a vendég (2., 9., 10.). Két dolog viszont hiányzik. (a) A módosítás: a lap csak annyit mond, hogy „inkább írjon a szállásadónak”, de sem a lemondó lapon, sem a lemondás után nincs rajta a szállásadó elérhetősége. (b) A visszaút: a „Mégsem” zsákutcába vitt (3.). Az ajánlat-út (4–6.) nem futott. | 11-mobil.png (= 10) + a futás összes képe |

## Modulonként

- **booking (foglalás):**
  - Tulaj: kezelni TUDTA. A kérés megvolt, és a visszaigazolás lement, egyértelmű visszajelzéssel („Visszaigazolva: … A vendég e-mailt kapott róla”). A telefonos út azonban nehézkes: a gombok a hajtás alatt vannak, az űrlap fél szélességű, a gyors döntésből nincs „Mégsem”, a telefonszám nem hívható, és a naptár nem a foglalás hónapjában nyílik.
  - Vendég: a lemondást ÉRTETTE, a szövegek pontosak, hivatkozással. A visszautak viszont nem működtek (a „Mégsem” ERR_CONNECTION_REFUSED-ra vitt), módosítási lehetőség vagy elérhetőség nincs. A widget szöveggel mondja ki, hogy foglalt, de nem mutatja az ütköző hónapot.
- **enquiry (árajánlat-kérés / ajánlat):** NEM MÉRT. Nem érkezett ajánlat-kérés (FK-015 6. és 9. lépés), így nem lett ajánlat, és az FK-016 4–6. lépése fail/blocked. Hogy a tulaj ujjal tud-e árat adni, és hogy a vendég érti-e az ajánlatot, erről ez a kör semmit nem mond.
- **reviews (vélemények):**
  - Tulaj: a döntési felület 390-en RENDBEN („Kiteszem / Nem teszem ki”, szöveg és csillagok a hajtás fölött). A jóváhagyás maga NEM történt meg, mert a forgatókönyvben nincs koppintás.
  - Vendég: a vélemény ezért nincs kint. Ez láncrés, nem bizonyított felületi hiba.

## Leletek súly szerint

1. **Súlyos, vendég:** az FK-016 3. lépésében a „Mégsem — megtartom” gomb a böngésző hibalapjára visz („A webhely nem érhető el … ERR_CONNECTION_REFUSED”, 03-mobil.png). A lemondástól visszalépő vendég zsákutcába jut. Ugyanez a siteUrl hajtja a lemondás utáni „Vissza a szállás oldalára” gombot is. Először azt kell eldönteni, hogy csak a dev-gép publicSiteUrl-je rossz-e, vagy élesben is ide vezet; ehhez a lap valódi hosztján kell megmérni.
2. **Súlyos, mérési lánc:** az ajánlat-út és a vélemény-kitétel egyik körben sem futott le. Nem jött árajánlat-kérés (FK-015 6./9. → FK-016 4–6. fail/blocked), az FK-015 11. lépésében pedig nincs koppintás (a 10-es és a 11-es kép azonos → FK-016 7. fail). A két modulról ezért nincs ítélet, és az FK-016 7. lépésének „fail”-je NEM felületi hiba.
3. **Közepes, vendég:** a lemondó lap „inkább írjon a szállásadónak” mondata mellett nincs kattintható telefon vagy e-mail (02-mobil.png). Ez a módosítás egyetlen útja, és nincs hozzá eszköz.
4. **Közepes, tulaj:** 390-en a visszaigazoló űrlap a gombsor bal felébe, egy kb. 160 px-es hasábba szorul, a hajtás alatt (07-mobil.png).
5. **Közepes, tulaj:** a döntésre váró kérés nem jelenik meg a Teendők között, és a „Foglalások” ikonon nincs jelvény. Az új kérés csak egy levágott üzenetsor, olvasatlan-pötty nélkül (01-mobil.png, 02-mobil.png).
6. **Közepes, tulaj:** a döntő gombok a hajtás alatt vannak. Ez érinti a „Foglalások megnyitása” gombot (kb. 36 px magas, 03), a gyors döntés megerősítőjét (04) és a „Visszaigazolom” gombpárt (05). A gyors döntésből nincs „Mégsem”, alatta rögtön a „Nem szabad” áll (04).
7. **Közepes, tulaj:** a naptár a foglalás hónapja helyett a „2026. szeptember · nincs foglalt nap” nézetben nyílik, „A szállás egésze” szűrővel. A foglalás a képen nem látszik, a jelmagyarázat két halvány színre épül (12-mobil.png).
8. **Kisebb, tulaj:** a döntésre váró kártyán a „+36 30 555 0101” sima szöveg. A kód szerint a „Felhívom” link csak lejárt vagy elutasított sornál jelenik meg (bookingViews.ts, `bk-reach`).
9. **Kisebb, vendég:** a publikus szobalistában a név, a létszám és az ár elválasztó nélkül fut össze („Nádas apartman4 fő24 000 Ft / éj”, 08-mobil.png).
10. **Kisebb, vendég:** a widget „Sajnos ezek a napok már foglaltak” üzenete mellett a naptár szeptemberen marad, és nem javasol szabad időpontot (08-mobil.png).
11. **Apró:** a gombfeliratok elcsúsznak („Mégsem — megtartom”, „Vissza a szállás oldalára”, 02/09/10-mobil.png). A vélemény-modul morzsamenüje „H… › M… ›” formára csonkul (10-mobil.png).

