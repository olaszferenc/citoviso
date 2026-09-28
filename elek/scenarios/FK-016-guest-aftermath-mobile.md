# FK-016 — A foglalás UTÓÉLETE a vendég oldalán, TELEFONON: megjött a válasz, mit tehetek vele?

cél: A szállásadó (FK-015) döntött: a foglalást visszaigazolta, az árajánlat-kérésre árat adott, a véleményt átengedte. A vendég most a LEVELEIBEN kapott linkeket nyitja meg a telefonján — megnézi, mit igazoltak vissza, elfogadja az ajánlatot, lemond, és megnézi, kint van-e a véleménye. Az ítélet: minden képernyőn tudja-e, hol jár, mi történt, mi a következő lépése — és nincs-e zsákutca 390 px-en.
felület: publikus
nézet: telefon
kontraktus: assets/design-refs/console/booking-email/README.md

## Előkészítés

- [ ] A szállás oldala él (a vendég innen is visszatalál)
  user: anon
  út: /t/${ELEK_NIGHT_SLUG}/
  várd: látható "${ELEK_NIGHT_NAME}"
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ① A visszaigazolt foglalás lemondó-linkje

- [ ] A lemondó-link megerősítő képernyőt ad: kinek az oldalán vagyok, melyik foglalás, van-e visszaút
  út: ${ELEK_NIGHT_CANCEL_PATH}
  várd: látható "Biztosan lemondja a foglalását?"
  várd: látható "${ELEK_NIGHT_NAME}"
  várd: látható "Mégsem — megtartom"
  kézi: 390-en a piros lemondó gomb és a „Mégsem" összetéveszthetetlen-e (nem csak szín), és mindkettő a hajtás fölött van-e; a lap megmondja-e, MELYIK foglalásról van szó (dátum, hivatkozás); van-e a lapon kattintható elérhetőség (telefon/e-mail), ha a vendég inkább MÓDOSÍTANI akar — ma vendég-oldali módosítás nincs, ez a vendég egyetlen alternatívája
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] A „Mégsem" tényleg megtart, és nem zsákutcába visz
  tedd: kattints "Mégsem — megtartom"
  kézi: hova érkezett a vendég a képen: a szállás oldalára, üres lapra, vagy sehova
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ② Az ajánlat elfogadása telefonon

# ⚠️ Ez a szakasz CSAK akkor mér, ha a láncban született árajánlat (a vendég-kör ⑦-je
# best-effort módon kéri). Ha nincs, a runner a hiányzó `${ELEK_NIGHT_OFFER_PATH}`-on
# hangosan megáll, és EZ a szakasz marad blokkolt — a lemondás-mérés (①, ⑤) attól még fut.

- [ ] Az ajánlat-lap megmondja: ki, mire, mennyiért, meddig — és két világos válasz
  út: ${ELEK_NIGHT_OFFER_PATH}
  várd: látható "${ELEK_NIGHT_NAME}"
  várd: látható "Elfogadom az ajánlatot"
  kézi: 390-en az ár, az időszak és az érvényességi határidő látszik-e görgetés nélkül; az elfogadás következménye (végleges foglalás, helyszíni fizetés) a gomb ELŐTT kimondott-e; a két gomb súlya különbözik-e
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] Az elfogadás után a vendég tudja, hogy MOST lett végleges
  tedd: kattints "Elfogadom az ajánlatot"
  várd: látható "Foglalása végleges"
  adat: ELEK-NIGHT ajánlat elfogadva (Elek Vendég Ajánlat)
  kézi: a visszaigazoló képernyő megmondja-e, mi jön (e-mail, lemondó link, fizetés a helyszínen), és van-e út vissza a szállás oldalára; 390-en egy görgetéssel átlátható-e
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] Az elfogadott ajánlat linkje újra megnyitva nem kínál újabb döntést
  út: ${ELEK_NIGHT_OFFER_PATH}
  várd: nem látható "Elfogadom az ajánlatot"
  kézi: a lap kimondja-e, hogy ezt az ajánlatot már elfogadta (nem „lejárt", nem „nem él")
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ③ A vélemény kint van-e?

- [ ] A jóváhagyott vélemény megjelenik a honlapon, a vendég nevével
  út: /t/${ELEK_NIGHT_SLUG}/
  várd: látható "Elek Vendég Éjszakai"
  kézi: a vélemény a vélemény-szekcióban van-e, a csillag/értékelés vele együtt; 390-en olvasható-e; ha NEM jelent meg, az önálló lelet (a tulaj jóváhagyta)
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ④ A foglalt napok a vendég oldalán

- [ ] A visszaigazolt foglalás napjaira a widget azt mondja, hogy foglalt
  tedd: írd "#cit-from" "2026-10-24"
  tedd: írd "#cit-to" "2026-10-26"
  kézi: a képen: a widget jelzi-e, hogy ezek a napok már foglaltak (szöveggel is, nem csak színnel), és segít-e másik időpontot találni; a naptárban a foglalt nap megkülönböztethető-e a szabadtól 390-en
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ⑤ A lemondás végigvitele

- [ ] A vendég lemondja a foglalását, és tudja, mi jön
  út: ${ELEK_NIGHT_CANCEL_PATH}
  tedd: írd "textarea" "Közbejött egy családi esemény, elnézést."
  tedd: kattints "Igen, lemondom a foglalást"
  várd: látható "Foglalása lemondva"
  adat: ELEK-NIGHT vendég-lemondás (Elek Vendég Éjszakai)
  kézi: a lap kimondja-e, hogy a szállásadó értesült, és jön-e levél a vendégnek; van-e út vissza a szállás ÉLŐ oldalára (nem a platformra)
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] A használt link újranyitva hangosan mondja, hogy már nem él
  út: ${ELEK_NIGHT_CANCEL_PATH}
  várd: látható "korábban már lemondták"
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ⑥ Összkép

- [ ] A vendég végig tudta, mi történik vele?
  kézi: a futás minden képe alapján: melyik képernyőn nem volt világos a következő lépés, hol hiányzott a visszaút, és mit nem tud ma megtenni a vendég, amit elvárna (módosítás!) — ki van-e ez mondva bárhol
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája
