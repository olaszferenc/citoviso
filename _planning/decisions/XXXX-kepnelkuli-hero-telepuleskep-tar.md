## ADR-XXXX — Kép nélküli és kevés képes lead: automata, országfüggetlen településkép-tár

Dátum: 2026-11-25 · Döntéshozó: tulaj (a terv jóváhagyása, kiegészítésekkel) · Terv: `assets/design-refs/console/kepnelkuli-hero/`

### Kontextus
A kép nélküli leadek mockja eddig egyetlen vak Wikipedia-képet kapott (ADR-0436), ami nem volt jellemző a helyre, és rossz is lehetett (Zalaegerszeg: mozdony). Emiatt a <5 saját képes leadek nem mehettek ki. A 2026-11-24-i tervkör 22 településen mérte le az automata választót: 18 település saját képet kapott, 3 tartalékot, 1 semmit. A költség $0 volt.

### Döntés
1. **Forrás:** Wikimedia Commons, csak szabad licenccel. A licencet, a szerzőt és a forrásoldalt tároljuk és kiírjuk; a kép hotlinkként jön. Fizetős forrás és API-kulcs nincs.
2. **Ítélet:** a helyi CLIP-modell (`media/townPick.ts`) a „Laza” küszöbbel (T 0,50 · Q 0,40 · B 0,25) és a 2. körrel dönt: kültér, tágas kép, látkép, nem sportpálya, nappal, a GPS legfeljebb 15 km-re. Képenként EGY beágyazás kell.
3. **Szintek:** település → környék tájképe (csak a lead saját országából, a kép koordinátájából eldöntve, Nominatim) → régió (országszint nélkül) → semmi.
4. **Tár:** `town_photo_set` (0153), egy sor településenként: 3–6 hero, 4–6 helyi galériakép és a stílus. A hero-t a település e-mailes leadjei között szétosztjuk (i mod n), a galériát leadenként elforgatjuk.
5. **⛔ Csak e-mailes leadért** gyűjtünk. Indul a scrape végén (a kontakt-lépés után, futásonként legfeljebb 20 település), és generáláskor helyben. Egyszeri pótlás: `scripts/town-photo-sets.mts`.
6. **1–4 saját kép:** a saját képek elöl. A saját első kép csak akkor marad hero, ha a lakhely külsejét vagy kilátását mutatja (outside ≥0,35) és legalább 1200 px.
7. **Mintaszobák stílus szerint:** mediterrán, alpesi, vidéki és városi (`src/engine/stockRooms.json`, Wikimedia Commons, CLIP-válogatás, `scripts/stock-rooms-build.mts`).
   - A stílust a hely adja: tengerpart, ha a Wikidata P206 tengert nevez (vagy ha az OSM-partvonal 5 km-en belül van); hegy, ha a magasság ≥600 m (Wikidata P2044, vagy az OpenTopoData SRTM); város, ha a lakosság ≥20 000; különben falu.
   - Minden mintakép „MINTA” jelölést kap, és szerepel a forráslistában.
   - **A stílusos tár mérve kicsi:** 5753 szabad jelöltből 38 kép ment át (mediterrán 8, alpesi 20, vidéki 4, városi 6), csak háló- és nappali szoba, illetve étkező.
   - A szemes átnézés emberekkel, rajzzal, WC-vel, folyosóval és stadionnal teli képeket talált. A fürdő, a konyha és a terasz ezért a kézzel átnézett helyi tárból jön (`public/assets/stock/`).
   - A stílusonkénti ~300 képes cél ingyenes, kulcs nélküli forrásból automatikusan nem volt elérhető.
8. **Kapuk** (a település-képeket a kapu ugyanazon a 330 px-es bélyegképen ítéli meg újra, amin a választó döntött): a `DISPATCH_PHOTOS_OK_SQL` szerint ≥5 saját képnél a régi szabály él, kevesebbnél az aktuális választás bélyege kell, és az `app_setting town_photo_dispatch = 'on'` (alapból KI). A render-kapu (v10) a mintaképet csak jelölve, galéria- vagy szobahelyen tűri, a település-hero-t és a helyi képeket pedig a választó szabályával újraítéli.

### Eltérés
- Az ADR-0436 4. pontja megszűnik: a hero nem ismétlődik a galériában.
- A régi `generator/townPhoto.ts`-t a generátor már nem hívja.

### Nyitva
- A stílusos szobakép-tár bővítése: több forrás kell, vagy egy kolléga Chrome-ban gyűjt Pexels-azonosítókat (mint a `stock-build.mts`-nél).
- A `town_photo_dispatch` kapcsolót a tulaj kapcsolja be, miután látta a képtárat.
- Az élesítés és az éles pótlás csak a tulaj kérésére indul.
- A kolléga-lánc kontaktkeresője (`~/rc-briefs/uj-lanc/kontakt/futtato.sh`) élesen fut. Bekötése a deploy után egy sor: `npx tsx scripts/town-photo-sets.mts --top 50`.
