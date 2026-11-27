## ADR-0499 — A várakozó sor a tulaj lapjára jut, vagy okkal félreáll: fotószám = a generátor képei, képtelen terv újratervezése, országonkénti render-kapu

- **Dátum:** 2026-11-27
- **Státusz:** elfogadva (koordinátor `cit9b4690e3` feladata: „Lánc-hiány a HR-en… kódszintű, általános javítás”; a végpróba-SUB `citd68cb3c0` mérése)
- **Módosítja:** ADR-0479 (településkép: a „saját fotó” számlálása), ADR-0495 ① (a gépi render-kapu a várakozó sorokon — ütemezés és a bukás kezelése)
- **Érinti:** `src/outreach/mockPhotoGate.ts`, `src/outreach/mockQaReview.ts`, `src/generator/mockRefresh.ts`, `scripts/outreach-dispatch.mts`, `src/console/leadStock.ts`, `scripts/town-photo-gather.mts`, `scripts/qa-review-check.mts`, `scripts/approval-chain-e2e.mts` (új), `hooks/pre-commit`; lánc: `~/rc-briefs/uj-lanc-hr` `fo-terv/fo-cand.sql`, `replan.py` (új), `lanc.sh`, `atallas-replan.sh`

### Mért helyzet (éles, csak olvasva, 2026-11-27 reggel)
- 74 várakozó horvát sor (JÓVÁHAGYÁSRA VÁR / gépi kapura vár), a jóváhagyó lap HR-re üres. A három gyanúból kettő igaz, és van egy negyedik ok is:
  1. **Render-kapu:** a 4 137 várakozó tervből 32-nek volt a jelenlegi fájlon érvényes ítélete (HR: 118-ból 10). A kiküldő ütem újramérése tüzelésenként ~5 tervet ítélt, a sor-kor szerint, így a 2 300 régebbi HU sor mögött a HR sorra nem került sor. A bukott terv a sorát változatlanul hagyta, ok nélkül, és örökre lemaradt a lapról.
  2. **Második terv / kép:** 39 HR sor (HU: 39 friss generátoros) fő terve nem viheti a lead képeit, így a render-kapu ítéletétől függetlenül sosem juthat a lapra:
     - (A) a lead ≥5 saját képet tart, a mock kevesebbet mutat (a saját honlap képei a terv UTÁN kerültek a leadre: 19:43 → 20:49): kép nélküli wordmark terv, második terv nélkül, vagy településképes terv;
     - (B) a lead „≥5 saját képét” csak a `material.websiteImages` adta. Ez a honlap-felmérés képszáma, a generátor ilyen képet sosem kap. A fő terv emiatt kihagyta a településképet, és a mock kép nélkül készült.
  3. **Kép-szabály:** a ma ítélt HR tervekből 2 bukott, a többi átment. Nem ez a fő ok.

### Döntés
1. **A „saját fotó” száma = amit a generátor a lapra tehet:** Places + a tárolt hirdetések (ide kerül a saját honlap beolvasott képsora is). A `websiteImages` nem számít. Egy helyen él (`LEAD_OWN_PHOTOS_SQL`), a konzol-készlet, a településkép-gyűjtő és a lánc `fo-cand.sql`-je ugyanezt az összeget használja.
2. **A fotószabály a KIKÜLDÖTT mockot nézi** (a Zsejka-szabály, 11-24):
   - amelyik mock ≥5 saját képet mutat településkép nélkül, az átmegy, bármit mond a lead tárolt száma;
   - <5 képes leadnél a mai településkép-választás kell;
   - ≥5 képes leadnél a kevesebbet mutató mock bukik.
   A szabály kétértékű (coalesce): a településkép nélküli mocknál NULL lett, és a `not (…)` semmit nem választott ki.
3. **Képtelen fő terv → újratervezés, egyszer** (`replanUnfitQueue`, a kiküldő ütem minden tüzelésén, csak SQL). Az (A) vagy (B) eset friss generátoros soránál:
   - a lead tervei visszakerülnek (`rejected`, visszaállítási adat a `lead.raw.replan`-ben);
   - a sor „új fő tervre vár” jegyzettel áll;
   - a lánc `replan.py`-ja egyszer leveszi a leadet a `fo-terv-tried` / `plan2-tried` listáról;
   - a fő terv újratervezi: a képeivel, vagy (B) a településkép-ágon (ha nincs jó kép sehol, a településkép-lépés okkal félreteszi);
   - a lánc kitöltő lépése az új tervre köti a sort.
   Ha az újratervezett lead új terve is bukik, a sor `TARTVA (képkapu): <ok>` jegyzettel félreáll, és többé nem tervezzük újra.
4. **A render-kapu a várakozó sorokon:**
   - Elavult minden ítélet, ami nem a JELENLEGI fájlé (szabályverzió, mtime és készlet-szabály egyezik: `cachedRenderGate`), nem csak a régebbi verzió.
   - Az országok felváltva kapnak sorra (`FAIR_ORDER`: országonként az n-edik sor az (n+1)-edik előtt).
   - Egy tüzelésen az egység teljes maradék ideje az újraméréshez megy, egy futó render helyét hagyva.
   - A bukott terv a sort `gépi kapu megfogta: <terv>: <ok>` jegyzettel félreteszi. Generátor-változásnál a frissítés újrarendereli, és a kapu újra ítél.
   - Ha mindkét terv átment egy félretett soron, a sor visszakerül a tulaj lapja felé.

### Miért
A tulaj lapjára csak a teljes láncot végigjárt sor kerül (11-25). Ehhez minden várakozó sornak vagy el kell jutnia oda, vagy látható okkal kell félreállnia. Eddig három szerkezeti hiba miatt örökre a „vár” állapotban maradt:
- hamis fotószám;
- befagyott, képtelen terv;
- sor-kor szerinti kapu, amely mögött az új piac éhezett.

A teszt-doktrína (§2c) szerint a hiba általános szabály, és ha a szabály bukik, a gép maga lép tovább: újratervez, tartalékot választ, vagy okkal félretesz. Kézi csere nincs.

### Sorrend (élesítés)
Előbb a lánc átállása (`atallas-replan.sh go`: a `fo-cand.sql` új fotószáma és a `replan.py`), utána az app deployja. Fordított sorrendben a (B) eset újratervezett leadjét a régi `fo-cand` megint településkép nélkül tervezné, és a második körben jogtalanul félreállna.

### Visszafordíthatóság
🔄
- Az újratervezés visszaállítási adata a `lead.raw.replan` (`rejectedMocks`, `note`).
- A szabályok egy-egy függvényben élnek.
- A lánc átállásának saját `rollback`-je van.

### Elvetett
- A frissítés (újrarenderelés) bővítése új képekkel: a mentett terv a dizájn (§I), a képhalmaz és a sablon együtt dől el a fő tervben.
- Külön systemd-egység a kapunak: új éles infrastruktúra lenne. A meglévő ütem maradék ideje elég (a timer kétpercenként tüzel, futó egység alatt nem indul újra).
- A régi generátoros (11-23 előtti) várakozó HU sorok újratervezése (283 sor): ezek a jelenlegi generátor sávja alatt vannak. Külön döntés (költség: egy fő terv leadenként).
