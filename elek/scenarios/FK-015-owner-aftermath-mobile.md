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
  tedd: kattints "Elek Vendég Éjszakai"
  várd: látható "Foglalások megnyitása"
  várd: látható "Gyors döntés innen is:"
  kézi: a „Foglalások megnyitása" gomb ujjal eltalálható-e (≥ 44 px) és a képernyőn van-e görgetés nélkül, amikor a szál kinyílik; a gyors döntés ikonjai (pipa/kereszt) érthetőek-e felirat nélkül egy kezdőnek
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] A gyors döntés ELŐBB rákérdez, nem dönt azonnal
  tedd: kattints ".adm-msg__qa"
  várd: látható "Elfogadja a foglalást? A vendég azonnal visszaigazolást kap."
  várd: látható "Igen, elfogadom"
  kézi: a megerősítő 390-en a képernyőre fér-e, és van-e belőle visszaút (nem dönt véletlen koppintásra); a két gomb súlya különbözik-e
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ② A Foglalások fül telefonon — mi az, amit el kell dönteni?

- [ ] A fülön ott a kérés, minden adatával
  út: /admin?tab=foglalasok
  várd: látható "Elek Vendég Éjszakai"
  várd: látható "2026. 10. 24."
  várd: látható "56 000 Ft"
  kézi: 390-en egy képernyőn látszik-e: KI, MIKOR, MENNYIÉRT, HÁNY FŐ, és a vendég ÜZENETE („Kisállattal érkeznénk"); a kérés-kártya nem lóg-e ki oldalt; a döntés-gombok a kártyán vannak-e vagy görgetni kell hozzájuk
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] Az árajánlat-kérés MÁS tételként, felismerhetően szerepel
  várd: látható "Elek Vendég Ajánlat"
  kézi: a tulaj látja-e, hogy ez ÁRAT kér, nem visszaigazolást (a két tétel megkülönböztethető-e 390-en), és tudja-e, mit kell tennie vele
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ③ A döntés ujjal — visszaigazolás

- [ ] A visszaigazolás megerősítést kér, és megnevezi, kiről van szó
  tedd: kattints "Visszaigazolom"
  kézi: mi történt a koppintásra (a képen): megerősítő nyílt-e, a vendég NEVE szerepel-e benne, és 390-en a képernyőre fér-e; ha a megerősítő a görgető-dobozban ül, levágja-e a lap alja
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] A visszaigazolás megtörténik, és a felület megnevezi a következményt
  tedd: írd ".bk-ovnote" "Kisállatot szívesen fogadunk, a kertben van kifutó."
  kézi: a döntés után a képernyő kimondja-e, KIT igazolt vissza és hogy a vendég e-mailt kapott; a lista/naptár frissült-e; ha bármi elakadt, az itt látszik
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ④ Árajánlat adása telefonon (az ár nélküli időszakra)

- [ ] Az árajánlat-kérésre a tulaj árat tud adni ujjal
  út: /admin?tab=foglalasok
  kézi: a képen: az árajánlat-kérés tételén van-e „ajánlat" művelet, és 390-en elérhető-e; ha van ár-mező, a numerikus billentyűzet nem takarja-e a küldés-gombot; a tulaj érti-e, hogy az ÁR a vendéghez megy levélben
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ⑤ A vélemény jóváhagyása telefonon

- [ ] A beküldött vélemény a tulajnál dönthető
  út: /admin?tab=modulok&m=reviews
  várd: látható "Elek Vendég Éjszakai"
  kézi: 390-en látható-e a vélemény szövege és a csillag; a jóváhagyás/elutasítás ujjal elérhető-e; a tulaj tudja-e, hogy a jóváhagyás után AZONNAL kint lesz a honlapon
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] A jóváhagyás megtörténik
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
