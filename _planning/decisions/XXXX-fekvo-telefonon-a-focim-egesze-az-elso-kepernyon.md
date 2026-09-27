## ADR-XXXX — Fekvő telefonon a főcím EGÉSZE az első képernyőn: magassághoz kötött főcím-méret a motorban, „②főcím-hajtás” őr

**Dátum:** 2026-09-27 · **Státusz:** elfogadva (tulajdonosi mandátum: „a nyitottakat még javítsd" — a saját
ergonómiai belátás szerint, utólagos ítélettel) · **Kiegészíti:** ADR-0239 ② (a főcím fekvőn nem ül rögzített
réteg alatt — ez a folytatása: nem elég, hogy nem takarja semmi, LÁTSZANIA is kell), ADR-0237 (telefonos fejléc),
ADR-0235 (guest-mobile-check) · **Kontraktus:** `assets/design-refs/engine/name-masthead/phone/README.md` 1–8.
pontja változatlanul KÖT (a masthead nem változott) · **Őr:** `scripts/guest-mobile-check.mts` ②főcím-hajtás
(ERGONÓMIA, öntesztben: `selftest-h1-under-fold`).

### Kiváltó (mérve 2026-09-27, 57 élő mock × 844×390)

Az ADR-0239 a főcímet a masthead ALÁ tette fekvőn, de a főcím mérete asztali maradt: a dark-luxury 59 px-es,
14ch-es főcíme 4 sorra tört, és a vége 37 px-szel a hajtás alatt volt. A teljes mérés szélesebb leletet adott,
mint a bejelentés: **19 sablonból 10-en** lógott a főcím a hajtás alá fekvőn (artdeco +175…260 px, brutalism
+127, dopamine +58…133, transit +60, fullbleed +29…57, watercolor +34, horizontal +9, dark-luxury +37), és
kettőn (cinematic, parallax) **6 px-re** ért véget a hajtás felett — „még éppen átment", vagyis a szándékolt
levegő nem volt ott. Az arch-frames és a wordmark-grow hero-neve (nem h1) a 460/420 px-es hero-minimum miatt
a 390 px-es képernyő legaljára esett, a lead-sor alá. Portré 390-en és asztalon a főcím rendben volt (a
korábbi körök tétele), tehát a hiba tisztán a tartásé: **a tartás nem szélesség**.

### Döntés

① **Fekvő telefonon a főcím mérete a képernyő MAGASSÁGÁHOZ kötött**, nem a szélességéhez:
`clamp(26–28px, 8–9vh, 36–40px)` (390 px-en 31–35 px), szükség szerint szélesebb mértékkel (`max-width` 22–26ch)
és a hero felső/alsó levegőjének mérséklésével. A blokk `@media (max-height:500px) and (min-width:<a sablon
telefon-töréspontja + 1>px)` — a `min-width` tartja távol a portré-szabályoktól, a `max-height` az asztaltól,
ezért **portré 390-en és asztalon pixelre azonos** a lap (mérve: 57 mock × 2 nézet, az origin/main motorjából
renderelt alapvonalhoz képest).

② **Ahol a másolat alul-horgonyzott egy OVERLAY masthead alatt** (fullbleed, horizontal, parallax), a fekvő
blokk a dark-luxury/cinematic mintáját követi: a masthead a FOLYAMBA lép, a hero oszlop-flexben a tartalmával nő
— egy rövidebb képernyőn az alul-horgonyzott másolat különben a masthead pirulája ALÁ csúszik (a parallaxon az
első fekvő kör pontosan ezt hozta: „FELSZERELT KONYHA A" a „FOGLALÁS" pirulán).

③ **Ahol a hero-név nem h1** (arch-frames, wordmark-grow — a jóváhagyott vázlat szerint a név a hero alján, a
h1 a következő szekció címe), a hero fekvőn a képernyőhöz igazodik (`100svh`, ill. `100svh − nav`), a másolat
feljebb ül, a név/lead-sor vh-hoz kötött. A card-sidebar mozaik-mastheadje (Airbnb-logika: fotók, aztán a név)
fekvőn a mozaikot mutatja, a név a ragadó fejlécben látszik — ez tervezett szerkezet, nem ennek az ADR-nek a
tárgya.

④ **Őr-szabály, ERGONÓMIA szinten:** az első látható h1, amely az első képernyőn KEZDŐDIK, de a hajtás alatt
VÉGZŐDIK → `②főcím-hajtás`. A teljesen a hajtás alatti h1 (más szerkezet) nem a szabály tárgya. Negatív kontroll
az öntesztben: az editorial egysoros neve 80vh-val lejjebb tolva és 120 px-re fújva → piros (45 px-es ráhagyással,
nem hajszálon). A szabály minden nézeten fut; 390-en a 57 mockon 0 leletet ad (az arch-frames szekció-címe
teljesen a hajtás alatt van, nem ez az osztály).

### Következmény

- 12 sablon kapott fekvő blokkot (dark-luxury, cinematic, tilted-gallery bővítve; artdeco, brutalism, dopamine,
  transit, watercolor, fullbleed, horizontal, parallax, arch-frames, wordmark-grow új). Fekvőn a főcím vége
  90–236 px-szel a hajtás felett (57 mockon 0 túllógás a h1-es sablonokon).
- A tilted-gallery tagline-ja fekvőn 5–7 px helyett kényelmes távolságra a rögzített sávtól (a 76 px-es név
  13vh-ra kötve).
- **Visszafordíthatóság:** 🔄 CSS-szintű, a 12 fekvő blokk törlésével a régi állapot visszaáll; adat nem változik.
  A mockok újrarenderelése a fő fából (`rerender-mock`) hozza a lapokra.
