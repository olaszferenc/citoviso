# FK-012 — Elek MEGVESZ MINDEN MODULT, TELEFONON: a kirakattól az élesítésig

cél: Elek most bérlő: belép a saját adminjába a telefonján, és megvesz mindent, amit a honlapja tudhat — képek, szobák, felszereltség, árak, térkép, nyitvatartás, USP, vélemények, programajánló, online foglalás. Az ítélet: MEGTALÁLJA-e a modulokat telefonon (az alsó sávban nincs „Modulok"), érti-e, mit vesz és mennyiért, átlátja-e a következmény-láncot (a foglalás árakat kíván), és végig tudja-e vinni a fizetést egy kézzel. A többnyelvű honlap SZÁNDÉKOSAN nem itt van: a fordítás a már elmentett tartalomból készül, ezért az az adatfeltöltés UTÁN következik (FK-013 ⑫).
felület: tenant-admin
nézet: telefon
kontraktus: assets/design-refs/tenant-admin/dokumentumok-uzenetek-a-README.md

## Előkészítés

- [ ] Elek belép a saját adminjába a telefonján
  user: anon
  út: /login
  tedd: írd "#username" "${ELEK_NIGHT_USER}"
  tedd: írd "#password" "${ELEK_NIGHT_PASSWORD}"
  tedd: kattints "button[type='submit']"
  tedd: várj "Áttekintés" 25
  # ⛔ MÉRT LELET (2026-09-27): a süti-sáv a BEJELENTKEZETT tenant-adminban is kint van
  # (gyökér div `position:fixed; z-index:2147483600`, belül `.cit-consent__*`), és 390
  # px-en TAKARJA a Modulok fül „Hozzáadom" gombjait (pricing, reviews, hours,
  # newsletter kártyáján mérve). A kör ezért lekezeli — de a lelet marad.
  tedd?: kattints ".cit-consent__yes"
  kézi: 390-en a belépés egy képernyőn elvégezhető-e (a billentyűzet nem takarja-e a gombot); a belépés utáni első képernyőn megmondja-e a felület, hol van a tulaj és mi a legfontosabb következő lépése
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ① Megtalálja-e a modulokat telefonon?

- [ ] Az alsó sávban NINCS „Modulok" — Eleknek a menüt kell megnyitnia
  kézi: a 390-es képen: mi van az alsó sávban (Áttekintés · Fotók · Foglalások · Üzenetek · Menü), és egy kezdő kitalálja-e, hogy a modulok a „Menü" alatt vannak; a „Menü" ikon/felirat elég beszédes-e; van-e BÁRMI a kezdő képernyőn, ami a modulok felé vezet
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] A menüből eljut a Modulok fülre
  tedd: kattints "[data-drawer-open]"
  tedd: kattints "Modulok"
  tedd: várj "Bővítés" 15
  várd: látható "Bővítés"
  kézi: a fiók-menü 390-en átlátható-e (nem kell-e sokat görgetni a Modulokhoz); a menü bezárul-e a választás után; a „Még nem vette meg" csoport látszik-e a menüben
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ② A kirakat — mit kap és mennyiért?

- [ ] A kirakat kártyái olvashatók, és az áruk kiderül
  kézi: 390-en: minden kártyán ott van-e a modul neve, mit ad, és a HAVI ÁRA; a csoport-fejlécek (Amit bemutat / Elérhetőség / Extrák) segítenek-e; a „Hozzáadom" gomb ujjal elérhető-e (≥ 44 px); kiderül-e, hogy az árak havonta ismétlődnek
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ③ Modulok EGYESÉVEL — mert telefonon ma csak így megy

# ⛔ MÉRT LELET (2026-09-27, `_probe-planbar`): amint a tulaj hozzáad EGY modult, az
# összegző sáv felúszik, és 390×844-en **407 px magas — a képernyő 48%-a** (367–774),
# alatta az alsó navigáció (785–844). Középre görgetve MINDEN további modul „Hozzáadom"
# gombja a sáv alá esik (mérve: usp · reviews · poi · hours · booking · newsletter — a
# gomb közepén a `div.adm-planbar` ül); felülre görgetve a felső fejléc takarja. A gomb
# csak a kettő közti ~310 px-es ablakban érhető el. Ezért a kör azt az utat járja, amit a
# felület MA enged: modul → fizetés → következő modul. Ez maga a lelet.

- [ ] Miért Önt válasszák
  tedd?: görgess-középre "#mod-usp .adm-shop__add"
  tedd?: kattints "#mod-usp .adm-shop__add"
  tedd?: kattints "#adm-plan-apply"
  tedd?: kattints "[data-fc-go]"
  tedd?: várj "Kész" 60
  kézi: 390-en: a kártya gombja elérhető volt-e görgetés után, vagy a 407 px-es összegző sáv alá esett; a megerősítő felugró a képernyőre fért-e; a nyugta megmondta-e, mennyit terheltünk és mi él mostantól
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája

- [ ] Nyitvatartás, érkezés
  tedd?: görgess-középre "#mod-hours .adm-shop__add"
  tedd?: kattints "#mod-hours .adm-shop__add"
  tedd?: kattints "#adm-plan-apply"
  tedd?: kattints "[data-fc-go]"
  tedd?: várj "Kész" 60
  kézi: 390-en: a kártya gombja elérhető volt-e görgetés után, vagy a 407 px-es összegző sáv alá esett; a megerősítő felugró a képernyőre fért-e; a nyugta megmondta-e, mennyit terheltünk és mi él mostantól
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája

- [ ] Vendégek véleménye
  tedd?: görgess-középre "#mod-reviews .adm-shop__add"
  tedd?: kattints "#mod-reviews .adm-shop__add"
  tedd?: kattints "#adm-plan-apply"
  tedd?: kattints "[data-fc-go]"
  tedd?: várj "Kész" 60
  kézi: 390-en: a kártya gombja elérhető volt-e görgetés után, vagy a 407 px-es összegző sáv alá esett; a megerősítő felugró a képernyőre fért-e; a nyugta megmondta-e, mennyit terheltünk és mi él mostantól
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája

- [ ] Heti programajánló
  tedd?: görgess-középre "#mod-poi .adm-shop__add"
  tedd?: kattints "#mod-poi .adm-shop__add"
  tedd?: kattints "#adm-plan-apply"
  tedd?: kattints "[data-fc-go]"
  tedd?: várj "Kész" 60
  kézi: 390-en: a kártya gombja elérhető volt-e görgetés után, vagy a 407 px-es összegző sáv alá esett; a megerősítő felugró a képernyőre fért-e; a nyugta megmondta-e, mennyit terheltünk és mi él mostantól
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája

- [ ] Online foglalás
  tedd?: görgess-középre "#mod-booking .adm-shop__add"
  tedd?: kattints "#mod-booking .adm-shop__add"
  tedd?: kattints "#adm-plan-apply"
  tedd?: kattints "[data-fc-go]"
  tedd?: várj "Kész" 60
  kézi: 390-en: a kártya gombja elérhető volt-e görgetés után, vagy a 407 px-es összegző sáv alá esett; a megerősítő felugró a képernyőre fért-e; a nyugta megmondta-e, mennyit terheltünk és mi él mostantól
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája

## ④ Az összegző sáv — mit fizetek most, és mit a következő számlán?

- [ ] A sáv megmondja a most fizetendőt és az új havi díjat
  kézi: 390-en a sáv HÁROM száma (most fizetendő · következő számla · változás) elkülöníthető-e, és mind a három megnevezett-e; MEKKORA a sáv a képernyőhöz képest (mérve 48%), és marad-e elég hely a kirakatnak; az „Elvetem" és az „Alkalmazom" gomb összetéveszthetetlen-e
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája

## ⑥ Ellenőrzés: tényleg minden az övé?

- [ ] Az „Az én moduljaim" alatt ott áll mind
  út: /admin?tab=modulok
  várd: látható "Az én moduljaim"
  várd: látható "Képek a szállásról"
  várd: látható "Szobák, apartmanok"
  várd: látható "Árak, szezonok"
  várd: látható "Online foglalás"
  várd: látható "Heti programajánló"
  kézi: 390-en végigolvasható-e a saját modulok listája; minden modulhoz van-e „Beállítás" gomb (ez lesz a következő kör útja); a Bővítés-lista kiürült-e (mi maradt benne és miért)
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ⑦ Összkép

- [ ] Meg tudta volna venni egy IT-kezdő, telefonon, segítség nélkül?
  kézi: a futás minden képe alapján: hol nem találta volna meg a modulokat, melyik ár volt félreérthető, mit nem értett volna a követelmény-láncból, és hol takart a tapadó sáv
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája
