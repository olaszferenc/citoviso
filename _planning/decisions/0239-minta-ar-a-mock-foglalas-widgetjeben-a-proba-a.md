## ADR-0239 — Minta-ár a mock foglalás-widgetjében (a próba a FOGLALÁS-utat játssza), és a főcím fekvőn sem ül rögzített réteg alatt

**Dátum:** 2026-09-26 · **Státusz:** elfogadva (tulajdonosi mandátum: „Javítsd a fekvőket és legyen minta ár" — a
saját ergonómiai belátás szerint, utólagos ítélettel) · **Kiegészíti:** ADR-0061 ② (minta-adat jelölt, tény nem
fabrikált), ADR-0215 „C" (ár nélküli kérésre árajánlat-mód), ADR-0235/0237 (telefonos widget és motor-tételek) ·
**Kontraktus:** `assets/design-refs/tenant-site/booking-mobile-two-step/README.md` változatlanul KÖT ·
**Őrök:** `scripts/mock-booking-sample-check.mts` (új, pre-commit), `scripts/guest-mobile-check.mts` ②főcím-takarva /
②főcím-szorul (új szabály, öntesztben).

### Kiváltó (mérve a szülő sessionben, 2026-09-26)

A mock widgetje minta-FOGLALTSÁGOT adott (`demoBlocked`), de árlistát nem (`pricing = null`), ezért a runtime az
ADR-0215 árajánlat-módjába váltott: a gomb **„Árajánlatot kérek"**, a próba-nyugta viszont **„Így néz ki, amikor a
vendége foglal… Ön igazolja vissza"**. Egy folyamatban két folyamat — és a lead a próbánál nem azt látta, amit a
modul árul (a foglalást árral), hanem az ár-hiány kivételes ágát. A friss Alig-vár cinematic mockban a forrásban 2×
„Árajánlatot kérek", 1× „Foglalási kérés elküldése" állt.

Fekvő telefonon (844×390) két sablon a főcímet rögzített réteg alá/mellé tette: **dark-luxury** (a 640 px-es
hero-minimum + alulra igazított szöveg → a főcím első sora a masthead alatt, levegő nélkül; mérve −20 px), és
**tilted-gallery** (a 520 px-es hero közepére tett név alsó fele a rögzített Foglalás-sáv alatt).

### ① Döntés — minta-ÁR a mockon, félreérthetetlenül mintaként

1. Demo-módban a widget determinisztikus **minta-árlistát** kap (`demoPricing`, a `demoBlocked` mintájára:
   egységenként eltérő kerek összeg, HUF, éjszakánként a teljes egységre), így a próba a **foglalás-utat** játssza:
   ár-doboz bontással és összeggel → „Foglalási kérés elküldése" → foglalás-nyugta.
2. **§B.17 / ADR-0061 ②:** a minta-ár NEM állítás a szállásról. A jelölés ott áll, ahol a számot olvassák: az
   ár-doboz címe „Minta-ár", az összeg sora „Összesen a szállásért (minta-ár)" (ezt tükrözi a telefonos 2. lépés
   összegző sávja is), és egy mondat kimondja, hogy az éles oldalon a szállásadó SAJÁT árlistája áll itt. A helyszíni
   tétel (IFA) dobozában a mock nem állít adót a szállásról: azt mondja, mi jelenik meg ott élesben, és ki adja meg.
3. A próba-nyugta a foglalásról szól, és a minta tényeit is mutatja (időszak, éjszakák, létszám, egység, minta-összeg)
   — így a lead azt látja, amit a vendége látna.
4. **Az ADR-0061 ② „kitalált ár SOHA" tétele az ÁRTÁBLA-modulra változatlanul áll** (a mock ártáblája ma is
   „Ön írja be", szám nélkül). Ez itt a FOGLALÁS-WIDGETRE szűkített, a tulaj által elrendelt kivétel (ADR-0015:
   modult csak láthatóan adunk el — a foglalás-modul ára nélkül a próba nem a modult mutatja), amelyet a
   félreérthetetlen minta-jelölés tesz megengedhetővé; a sáv nem tágul: más modul nem kap kitalált számot.
5. **Az élő (tenant) út nem változik:** ott az ár a `/api/foglaltsag` válaszából jön, és a lap sehol nem mond mintát
   (az őr álpozitív kontrollja méri).

### ② Invariáns — a gomb és a nyugta EGY folyamatról beszél

A demo-nyugtát UGYANAZ az állapot (`askMode`) vezérli, mint a gombot: ha az árajánlat-mód bármely úton előáll a
mockon, a nyugta is árajánlatról szól („Így néz ki, amikor a vendége árajánlatot kér… Ön árajánlattal válaszol").
Nem két felirat egyeztetése, hanem egy állapot két vetülete. Az őr három szabotázzsal bizonyítja: a minta-árlista
kivétele a foglalás-út állításait buktatja (az invariáns szerkezeti, ÁLL); a nyugta-ág laposra írása az invariánst
buktatja; a minta-feliratok kivétele a minta-jelölést buktatja — mindegyiknél igazolva, hogy a csere megtörtént.

### ③ Fekvő tartás — a főcím nem rögzített réteg alatt

- **dark-luxury:** fekvő telefonon (`max-height:500px` és `min-width:701px`) a masthead a FOLYAMBA lép (oszlop-
  elrendezés), a hero a tartalmával nő — a szöveg csak a masthead alatt kezdődhet. Portré és asztal pixelre azonos.
- **tilted-gallery:** ugyanott a hero a rögzített sáv magasságát (70 px + süti-sáv) kitartja a lábánál, a 73 px-es
  tapadó nav alatt a képernyőre fér, a tartalmával nő; a hely-sor elmarad (a sáv kisbetűje már mondja), a
  görgetés-jel elmarad (a sáv mögé esne).
- **immersive-parallax archetípus:** a tapadó dokk (4 900 px) fekvőn a galériára ült (a kép nem volt érinthető) —
  fekvőn is statikus, ahogy portrén már volt.
- **Őr:** `guest-mobile-check` ②főcím-takarva (HIBA: az első látható főcím sor-közepeit ÉS a doboz első/utolsó 3
  px-ét rögzített/tapadó réteg vagy az overlay-masthead veszi el — festési sorrend, `elementFromPoint`, nem z-index-
  találgatás; az aurora rögzített díszháttere a szöveg ALATT van, nem számít) és ②főcím-szorul (ERGONÓMIA: a főcím
  12 px-nél közelebb indul a masthead aljához). Negatív kontroll az öntesztben (a főcím alsó felére ültetett rögzített
  sáv), és a valódi hibán: a régi Alig-vár dark-luxury és tilted-gallery mock fekvőn piros, a javított motorral zöld.
  ⛔ Az első, csak sor-közepet mintázó változat MINDKÉT valódi hibát tisztának mondta — a hiba a szélen ült.

### Kikényszerítés

`mock-booking-sample-check` (pre-commit, a runtime/moduleSections/generator-runtime változásán, `--selftest`-tel);
`guest-mobile-check` kapu-mód (390) és `--selftest`; a fekvő futás (`--vp=land`) a 30 sablonon/archetípuson 0 HIBA;
a 57 élő mock újrarenderelve a fő fából, fájl-módban 390/360/fekvő 0 HIBA.

### Visszafordíthatóság

🔄 A minta-árlista egyetlen függvény és egy sor a `loadAvailability` demo-ágában; a feliratok `demo`-feltételesek; a
fekvő szabályok egy-egy media-blokk a két sablonban és az archetípusban. Az élő út érintetlen.
