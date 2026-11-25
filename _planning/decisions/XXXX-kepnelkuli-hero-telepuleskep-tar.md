## ADR-XXXX — Kép nélküli és kevés képes lead: automata, országfüggetlen településkép-tár

Dátum: 2026-11-25 · Döntéshozó: tulaj (a terv jóváhagyása, kiegészítésekkel) · Terv: `assets/design-refs/console/kepnelkuli-hero/`

### Kontextus
A kép nélküli leadek mockja eddig egyetlen vak Wikipedia-képet kapott (ADR-0436), ami nem volt jellemző a helyre, és rossz is lehetett (Zalaegerszeg: mozdony). Emiatt a <5 saját képes leadek nem mehettek ki. A 2026-11-24-i tervkör 22 településen mérte le az automata választót: 18 település saját képet kapott, 3 tartalékot, 1 semmit. A költség $0 volt.

### Döntés
1. **Forrás:** Wikimedia Commons, csak szabad licenccel. A licencet, a szerzőt és a forrásoldalt tároljuk és kiírjuk; a kép hotlinkként jön. Fizetős forrás és API-kulcs nincs.
2. **Ítélet:** a helyi CLIP-modell (`media/townPick.ts`, v3) a „Laza” küszöbbel (T 0,50 · Q 0,40 · B 0,25) és igen/nem kérdésekkel dönt. Képenként EGY beágyazás kell.
   - Kizáró kérdések: kültér, tágas kép, látkép (nem út vagy vezeték), nem sportpálya, nappal.
   - v2: nem egyetlen, feliratos épület homlokzata.
   - v3: nem egyetlen ház, tető vagy szerkezet közelről.
   - A fájl GPS-e legfeljebb 15 km-re lehet a településtől.
   - Fájlnév-tiltások, köztük: községháza, polgármesteri, városháza, Rathaus, Gemeindeamt, zgrada općine, hivatal, town/city hall, Fortepan.
   - Térképszerű felülnézet nem lehet hero.
   - A borús és a főleg üres eget mutató kép hátrébb sorolódik.
   - Minden hibát általános szabály javít (§2c), kézi csere soha.
3. **Szintek:** település → környék tájképe (csak a lead saját országából, a kép koordinátájából eldöntve, Nominatim) → régió (országszint nélkül) → semmi.
4. **Tár:** `town_photo_set` (0153), egy sor településenként: 3–6 hero, 4–6 helyi galériakép és a stílus. A hero-t a település e-mailes leadjei között szétosztjuk (i mod n), a galériát leadenként elforgatjuk.
5. **⛔ Csak e-mailes leadért, just-in-time** (tulaj 2026-11-25): előre futtatott pótlás nincs, se top 500, se az összes település. A gyűjtés akkor fut, amikor a lánc egy konkrét e-mail-címes, kép nélküli vagy kevés képes leadhez ér, a mock előtt (`generator/townHero.ts`), és a településnek még nincs aktuális válogatása. Az eredmény a településre cache-elődik. Szabályváltozáskor a tárolt válogatásokat újraszűrjük, új keresés nélkül: `scripts/town-photo-sets.mts --rescreen` (és `--restyle`).
6. **1–4 saját kép:** a saját képek elöl. A saját első kép csak akkor marad hero, ha a lakhely külsejét vagy kilátását mutatja (outside ≥0,35) és legalább 1200 px.
7. **Mintaszobák stílus szerint:** mediterrán, alpesi, vidéki és városi (`src/engine/stockRooms.json`, Wikimedia Commons, CLIP-válogatás, `scripts/stock-rooms-build.mts`).
   - A stílust a hely adja: tengerpart, ha a Wikidata P206 tengert nevez (vagy ha az OSM-partvonal 5 km-en belül van); hegy, ha a magasság ≥600 m (Wikidata P2044, vagy az OpenTopoData SRTM); város, ha a lakosság ≥20 000; különben falu.
   - Minden mintakép „MINTA” jelölést kap, és szerepel a forráslistában.
   - **A stílusos tár mérve kicsi:** 5753 szabad jelöltből 38 kép ment át (mediterrán 8, alpesi 20, vidéki 4, városi 6), csak háló- és nappali szoba, illetve étkező.
   - A szemes átnézés emberekkel, rajzzal, WC-vel, folyosóval és stadionnal teli képeket talált. A fürdő, a konyha és a terasz ezért a kézzel átnézett helyi tárból jön (`public/assets/stock/`).
   - A stílusonkénti ~300 képes cél ingyenes, kulcs nélküli forrásból automatikusan nem volt elérhető.
8. **Kapuk** (a település-képeket a kapu ugyanazon a 330 px-es bélyegképen ítéli meg újra, amin a választó döntött; render-kapu v11 — település-oldalon mobilon betöltött hero görgetés nélkül, legalább 12 különböző kép; 3 MINTA-szobakártya és legfeljebb 12 képes galéria): a `DISPATCH_PHOTOS_OK_SQL` szerint ≥5 saját képnél a régi szabály él, kevesebbnél az aktuális választás bélyege kell, és az `app_setting town_photo_dispatch = 'on'` (alapból KI). A render-kapu (v10) a mintaképet csak jelölve, galéria- vagy szobahelyen tűri, a település-hero-t és a helyi képeket pedig a választó szabályával újraítéli.

### Mérés (dev DB, $0)
- 52 település (első kör): 49 saját kép, 3 környék, 0 semmi.
- Sebesség: korábban 65 s/település egy szálon, mindig geokereséssel. Most 32 s/település falióra-időben (3 párhuzamos, nice, terhelés <6, geokeresés csak kevés hero esetén).
- Vak mérés (§2c, 2×20 eddig nem látott település, beavatkozás nélkül):
  - v2: 7 jó · 10 gyenge · 3 rossz. Mindhárom rossz „egyetlen ház, tető vagy szerkezet közelről”, ebből lett a v3-szabály.
  - v3 (just-in-time út): 7 jó · 7 gyenge · 2 rossz átment (vasúti épület felirattal; egyetlen tető, határeset), és 4 lapot a render-kapu magától visszatartott (1 kép nélkül, 3 kevesebb mint 12 képpel).
  - Következő szabályok: az állomás és a felirat erősebb tiltása, szigorúbb „ház közelről” küszöb, új jelölt-forrás a gyenge (fakó, erdő, ég) esetekre.

### Eltérés
- Az ADR-0436 4. pontja megszűnik: a hero nem ismétlődik a galériában.
- A régi `generator/townPhoto.ts`-t a generátor már nem hívja.

### Nyitva
- A stílusos szobakép-tár bővítése: több forrás kell, vagy egy kolléga Chrome-ban gyűjt Pexels-azonosítókat (mint a `stock-build.mts`-nél).
- A `town_photo_dispatch` kapcsolót a tulaj kapcsolja be, miután látta a képtárat.
- Az élesítés csak a tulaj kérésére indul. Az éles DB-ben a település-képtár magától, just-in-time töltődik.
- A wordmark-grow sablon saját kép nélküli, település-hero-s leadnél megismétli a hero-t. A render-kapu elbuktatja; javítani a sablonban kell.
