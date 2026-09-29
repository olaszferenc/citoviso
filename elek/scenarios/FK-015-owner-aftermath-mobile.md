# FK-015 — A foglalás UTÓÉLETE a tulaj oldalán, TELEFONON: megkaptam a kérést, döntök, árat adok, véleményt engedek

cél: A vendég (FK-014) beadott egy foglalási kérést, egy árajánlat-kérést és egy véleményt. Elek most a szállásadó, aki ESTE, TELEFONON, az ágyban nézi meg, mi jött — és ott helyben dönt. Az ítélet: megtalálja-e a kérést, érti-e, mit kér a vendég, ujjal el tudja-e dönteni (elfogadás/elutasítás), tud-e árat adni az ajánlat-kérésre, és át tudja-e engedni a véleményt — MINDEZT 390 px-en, először látva a felületet. A tulaj-levelek szerkezetét és a döntés-linkeket a jóváhagyott tervek kötik (lásd a kontraktus-sort).
felület: tenant-admin
nézet: telefon
kontraktus: assets/design-refs/tenant-admin/foglalasok-README.md · assets/design-refs/console/mail-links/README.md · assets/design-refs/console/booking-email/README.md

## Előkészítés

- [ ] Elek bejelentkezve a saját adminjába, telefonon
  user: anon
  út: /login
  tedd: írd "input[name='username']" "${ELEK_NIGHT_USER}"
  tedd: írd "input[name='password']" "${ELEK_NIGHT_PASSWORD}"
  tedd: kattints "button[type='submit']"
  tedd: várj "${ELEK_NIGHT_NAME}" 20
  # A süti-sáv a bejelentkezett adminban IS kint van, és az ajánlat-lapon az ár-mezőt
  # takarta (mérve 2026-09-28, 390 px). A lelet marad (FK-012/013 ugyanezt jegyzi).
  tedd?: kattints ".cit-consent__yes"
  várd: darab "a[href*='tab=foglalasok'], a[href*='tab=uzenetek']" >= 1
  kézi: a belépés 390-en egy képernyőn elvégezhető-e (mezők + gomb), a billentyűzet nem takarja-e a gombot; a belépés utáni első képernyőn látszik-e, hogy ÚJ kérés érkezett (jelvény, számláló) — vagy Eleknek keresnie kell
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ① Az értesítő-levél az Üzenetek fülön (a tulaj innen indul)

- [ ] Az Üzenetek fülön ott a foglalási kérés, és a levél a lényeget mondja elöl
  út: /admin?tab=uzenetek
  várd: látható "Elek Vendég Éjszakai"
  kézi: a lista sora 390-en megmondja-e, MIRŐL szól (foglalási kérés, mely dátumokra) és MIKOR jött; a szál megnyitása egy koppintás-e; a levéltörzs olvasható-e nagyítás nélkül
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] A levélből EGY koppintással a Foglalások fülre lehet menni
  # ⛔ MÉRT (2026-09-28): a vendég-kör VÉLEMÉNYT is ír ugyanezzel a névvel, és annak a
  # levele frissebb — a puszta névre koppintás a vélemény-szálat nyitotta ki. A foglalás
  # tárgyára szűkítve.
  tedd: kattints "Foglalási kérés: Elek Vendég Éjszakai"
  várd: látható "Foglalások megnyitása"
  várd: látható "Gyors döntés innen is:"
  kézi: a „Foglalások megnyitása" gomb ujjal eltalálható-e (≥ 44 px) és a képernyőn van-e görgetés nélkül, amikor a szál kinyílik; a gyors döntés ikonjai (pipa/kereszt) érthetőek-e felirat nélkül egy kezdőnek
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] A gyors döntés ELŐBB rákérdez, nem dönt azonnal
  # ⛔ SAJÁT FORGATÓKÖNYV-HIBA, mérve 2026-09-28: a `.adm-msg__qa` az AJÁNLAT-link
  # (kind="ajanlat"), az elfogadás viszont egy `<details class="adm-msg__qd--ok">`, és a
  # megerősítő a SUMMARY megnyitására jelenik meg. A rossz szelektor „a felület nem kérdez
  # rá" leletnek látszott — pedig rákérdez.
  tedd: kattints ".adm-msg__qd--ok summary"
  várd: látható "Elfogadja a foglalást? A vendég azonnal visszaigazolást kap."
  várd: látható "Igen, elfogadom"
  kézi: a megerősítő 390-en a képernyőre fér-e, és van-e belőle visszaút (nem dönt véletlen koppintásra); a két gomb súlya különbözik-e
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ② A Foglalások fül telefonon — mi az, amit el kell dönteni?

- [ ] A fülön ott a kérés, minden adatával
  út: /admin?tab=foglalasok
  várd: látható "Elek Vendég Éjszakai"
  várd: látható "2026. 10. 24."
  # 2 éj × 28 000 — a tulaj FK-013-ban felvitt őszi szezonja (lásd FK-014 ⑥).
  várd: látható "56 000"
  kézi: 390-en egy képernyőn látszik-e: KI, MIKOR, MENNYIÉRT, HÁNY FŐ, és a vendég ÜZENETE („Kisállattal érkeznénk"); a kérés-kártya nem lóg-e ki oldalt; a döntés-gombok a kártyán vannak-e vagy görgetni kell hozzájuk
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] Az árajánlat-kérés MÁS tételként, felismerhetően szerepel
  # 2026-09-28 óta az FK-014 ⑦ VALÓDI árajánlat-kérést ad be (az egész házra, ár nélkül),
  # ezért a tétel gépileg is állítható — és a kép a tételre görget, nem a lap tetejét
  # ismétli (addig ez a lépés akció nélkül az előző képet kapta, bájtra azonosan).
  tedd: görgess-középre ".bk-req:has(strong:text-is('Elek Vendég Ajánlat'))"
  várd: látható "Elek Vendég Ajánlat"
  várd: darab ".bk-req:has(strong:text-is('Elek Vendég Ajánlat')) [data-bk-quote]" == 1
  kézi: a tulaj látja-e, hogy ez ÁRAT kér, nem visszaigazolást (a két tétel megkülönböztethető-e 390-en), és tudja-e, mit kell tennie vele
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ③ A döntés ujjal — visszaigazolás

- [ ] A visszaigazolás megerősítést kér, és megnevezi, kiről van szó
  # Két kérés van a fülön (foglalás + árajánlat): a döntés a FOGLALÁS kártyájára szűkítve.
  tedd: görgess-középre ".bk-req:has(strong:text-is('Elek Vendég Éjszakai')) summary.bk-btn--ok"
  tedd: kattints ".bk-req:has(strong:text-is('Elek Vendég Éjszakai')) summary.bk-btn--ok"
  kézi: mi történt a koppintásra (a képen): megerősítő nyílt-e, a vendég NEVE szerepel-e benne, és 390-en a képernyőre fér-e; ha a megerősítő a görgető-dobozban ül, levágja-e a lap alja
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] A visszaigazolás megtörténik, és a felület megnevezi a következményt
  # ⛔ SAJÁT FORGATÓKÖNYV-HIBA: a `.bk-ovnote` a FEDÉS-választó felugró jegyzet-mezője
  # (JS-ből születik, csak ütköző kérésnél). Egyetlen kérésnél a „Visszaigazolom" egy
  # `<details>`, ami egy sima űrlapot nyit: `textarea[name="uzenet"]` + „Megerősítem a
  # visszaigazolást". Mérve 2026-09-28: emiatt maradt a kérés függőben, és emiatt hagyta ki
  # magát az FK-016 (nem született lemondó-token).
  tedd: írd ".bk-req:has(strong:text-is('Elek Vendég Éjszakai')) details[open] textarea[name='uzenet']" "Kisállatot szívesen fogadunk, a kertben van kifutó."
  tedd: görgess-középre ".bk-req:has(strong:text-is('Elek Vendég Éjszakai')) details[open] button[type='submit']"
  tedd: kattints ".bk-req:has(strong:text-is('Elek Vendég Éjszakai')) details[open] button[type='submit']"
  tedd: várj "Visszaigazolva" 25
  kézi: a döntés után a képernyő kimondja-e, KIT igazolt vissza és hogy a vendég e-mailt kapott; a lista/naptár frissült-e; ha bármi elakadt, az itt látszik
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ④ Árajánlat adása telefonon (az ár nélküli egész házra)

# ⛔ MÉRT (2026-09-28): ez eddig egy `út:` + kézi ítélet volt — ajánlat sosem ment ki, ezért
# az FK-016 ② mindig blokkolt maradt. Most a tulaj a kártya „Ajánlatot küldök” gombjával
# az ajánlat-lapra megy, árat ír, és elküldi.
- [ ] Az árajánlat-kérés kártyájáról az ajánlat-lapra jut
  út: /admin?tab=foglalasok
  tedd: görgess-középre ".bk-req:has(strong:text-is('Elek Vendég Ajánlat')) a[href$='/ajanlat']"
  tedd: kattints ".bk-req:has(strong:text-is('Elek Vendég Ajánlat')) a[href$='/ajanlat']"
  # A küldés-gomb ár nélkül SZÁNDÉKOSAN tiltott (offerViews: a JS ár után oldja) — ez
  # helyes viselkedés, ezért itt csak a megjelenést mérjük.
  tedd: várj "Ajánlat küldése" 20
  várd: látható "Ajánlat küldése"
  kézi: az ajánlat-lap 390-en megmondja-e, KINEK és MELYIK időszakra ad árat, és hogy a vendég eddig nem látott összeget; az ár-mező numerikus billentyűzetet kér-e (inputmode), és a küldés-gomb nem esik-e a billentyűzet alá
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája

- [ ] Árat ír, és elküldi — a vendég levélben kapja
  tedd: írd "[data-amount]" "90 000"
  tedd: írd "#of-note" "Hat főre a teljes ház, az ágyneműt odakészítjük."
  # ADR-XXXX (2026-09-29): az ár ALAPBÓL csak erre a kérésre szól — a pipa üres, és a lap ki is
  # mondja. (Az ADR-0215 alatt ez a lépés a házat némán foglalhatóvá kapcsolta: 90 000 Ft alapár.)
  várd: látható "Mentsem az árlistába is?"
  várd: látható "Csak erre a kérésre."
  tedd: görgess-középre "[data-send]"
  tedd: kattints "[data-send]"
  tedd: várj "Ajánlat elküldve" 25
  várd: látható "Ajánlat elküldve"
  adat: ELEK-NIGHT árajánlat (Elek Vendég Ajánlat, 90 000 Ft/éj)
  kézi: a küldés előtt a lap kiírta-e az ÖSSZEGET (éjszakák × ár), és érthető-e 390-en, hogy az ár csak erre a kérésre szól, és mi történne a „Mentsem az árlistába is?” pipával; a küldés után kimondja-e, hogy a vendég levelet kapott, hogy az árlista nem változott, és mi a következő lépés; van-e út vissza a Foglalásokhoz
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ⑤ A vélemény jóváhagyása telefonon

- [ ] A beküldött vélemény a tulajnál dönthető
  út: /admin?tab=modulok&m=reviews
  várd: látható "Elek Vendég Éjszakai"
  kézi: 390-en látható-e a vélemény szövege és a csillag; a jóváhagyás/elutasítás ujjal elérhető-e; a tulaj tudja-e, hogy a jóváhagyás után AZONNAL kint lesz a honlapon
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] A jóváhagyás megtörténik
  # ⛔ MÉRT (2026-09-28): ez a lépés akció nélkül állt — a „Kiteszem” koppintás soha nem
  # történt meg, a vélemény függőben maradt, és az FK-016 ③ („kint van-e a véleménye”)
  # HAMISAN bukott. Most a tulaj megnyomja, és a gomb eltűnése a gépi bizonyíték.
  tedd: görgess-középre ".rv-row:has(strong:text-is('Elek Vendég Éjszakai')) button[value='published']"
  tedd: kattints ".rv-row:has(strong:text-is('Elek Vendég Éjszakai')) button[value='published']"
  várd: darab ".rv-row:has(strong:text-is('Elek Vendég Éjszakai')) button[value='published']" == 0
  várd: darab ".rv-row:has(strong:text-is('Elek Vendég Éjszakai')) button[value='rejected']" == 1
  kézi: a képen: mi lett a vélemény státusza a koppintás után, és a felület megmondja-e, hol jelenik meg
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ⑥ Naptár — mi foglalt most?

- [ ] A visszaigazolt foglalás napjai foglaltként jelennek meg
  út: /admin?tab=foglalasok&naptar=1
  kézi: 390-en a naptár átlátható-e (nem kell vízszintesen görgetni), a foglalt napok jelölése nem csak színnel különbözik-e, és a nap-panel koppintásra a helyes vendéget mutatja-e; a naptár fekvő tartásban használhatóbb-e
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ⑦ Összkép — este, ágyban, egy kézzel

- [ ] Egy IT-kezdő szállásadó le tudta volna ezt vezényelni telefonon?
  kézi: a futás MINDEN képe alapján: hol kellett volna asztali gépet elővennie, melyik döntés volt félreérthető, mi hiányzott a képernyőről (pl. a vendég telefonszáma hívható-e egy koppintással), és hol volt olyan gomb, amit ujjal nem lehet eltalálni
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája
