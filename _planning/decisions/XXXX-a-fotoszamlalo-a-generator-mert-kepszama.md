## ADR-XXXX — A fotószámláló a generátor mért képszáma; a kevés használható képes lead elsőre a településképes útra megy

- **Dátum:** 2026-11-27
- **Státusz:** elfogadva (koordinátor `cit9b4690e3`: „mehet a képszám-szabály… az a lead, amelyiknek nincs ≥5 használható képe, menjen településképes útra, vagy előre álljon félre okkal, ne a második újratervezés után”)
- **Módosítja:** ADR-0499 ① (a „saját fotó” száma) és ③ (újratervezés: egyszer → útvonalanként egyszer)
- **Érinti:** `src/outreach/mockPhotoGate.ts` (`LEAD_STORED_PHOTOS_SQL`, `LEAD_OWN_PHOTOS_SQL`, `recordUsablePhotos`), `src/generator/generateEngine.ts`, `src/generator/mockRefresh.ts` (`replanUnfitQueue`), `scripts/outreach-dispatch.mts`, `scripts/approval-chain-e2e.mts`; lánc: `fo-terv/fo-cand.sql`, `telepkep/varo.py`, `atallas-kepszam.sh`

### Mérve (2026-11-27, élesen olvasva, a generátor szűrői helyben lefuttatva)
A 25 „TARTVA (képkapu)” leadből 22 hirdetés-képes, 3 csak Places-számos (tárolt Places-válasz nélkül a generátor nem kap képet, ADR-0413).
A 22 hirdetés-képes lead képeinek útja:
- **100 tárolt kép.** Gyakran kevesebb, mint a `material.portalPhotos`: 9 számolt / 5 tárolt, 6–7 / 0.
- **96 élő.**
- **57 maradt a generátor kurálása után** (`curateMockPhotos`: lapon kívüli téma, személy- vagy WC-részlet, majdnem-ismétlés).

A méret-, szomszédmappa- és duplikátum-szűrő 0 képet ejtett. A helyi futás a mockok képszámát ±1-gyel visszaadta.

A „használható saját kép” tehát CLIP-pel és hálózattal mérhető, SQL-ből nem. A lánc eddig a tárolt számmal (≥5) a saját utat választotta, ezért a település képtára sosem gyűlt össze, és a lead két terv után állt félre.

### Döntés
1. **A generátor felírja, amit a lapra tett:** a kurálás után a lead `material.usablePhotos = {n, stored, at}`, ahol a `stored` az a tárolt szám (Places + hirdetések), amelyen mért.
2. **A fotószámláló a mért szám, amíg a tárolt halmaz ugyanaz** (`LEAD_OWN_PHOTOS_SQL`; a lánc `fo-cand.sql`-je ugyanezt az összeget használja, a `varo.py` ebből származtat). Ha a halmaz változik (új hirdetés, újraolvasás), újra a tárolt szám számít a következő tervig.
3. **Az újratervezés útvonalanként egyszer fut** (`own` / `town`, a `lead.raw.replan.routes`-ban).
   - A friss tervből visszamérve: ha egy ≥5 tárolt képes lead terve kevesebbet mutat, és a képei nem a terv után jöttek, a mért szám kerül a leadre.
   - Ha a mért szám <5, a lead elsőre a településképes útra megy. A fő terv csak a település képtárával tervezi; ha nincs jó kép sehol, a településkép-lépés okkal félreteszi.
   - Ha a terv már településképes, nincs újratervezés, a sor a fotószabály településkép-ágán megy tovább.
4. **Félretétel okkal** csak akkor, ha az adott út már ki lett próbálva, és az utána készült terv is bukik.
5. **A már félretett sorok is kapnak egy esélyt:** az eddig „TARTVA (képkapu)” sorok (élesen 26) a településképes úton újraindulnak (9), vagy településképes tervvel a gépi kapuhoz kerülnek vissza (17).

### Sorrend (élesítés)
Előbb a lánc (`atallas-kepszam.sh go`), utána a deploy. A deploy előtt mért szám még nincs, így az új `fo-cand` ugyanazt választja ki (élesen mérve: 72 = 72).

### Visszafordíthatóság
🔄
- A mért szám egy JSON-mező; törlésével a tárolt szám számít.
- Az újratervezés visszaállítási adata a `lead.raw.replan` (`previous`, `rejectedMocks`).
- A lánc-átállásnak saját `rollback`-je van.

### Elvetett
- **A használható szám előzetes mérése a fő terv előtt** (külön lépés CLIP-pel és hálózattal minden jelöltre): az első terv maga a mérés (a fő terv előfizetéses író-hívás, API-költség nélkül), külön lépés kétszer futtatná ugyanazt a csővezetéket.
- **A tárolt szám javítása a gyűjtőben:** a kurálás a döntő szűrő, nem a tárolás.
