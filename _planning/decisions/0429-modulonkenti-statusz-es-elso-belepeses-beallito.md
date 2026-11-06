## ADR-0429 — Modulonkénti státusz és első belépéses beállító varázsló, egy nyilvántartásból, land-kapuval

**Dátum:** 2026-11-06 · **Döntött:** tulaj (négy tervkör, a 4. körre „ok”) · **Terv:** `assets/design-refs/tenant-admin/modul-statusz/` (README = ami köt) · **Kapcsolódik:** ADR-0192, ADR-0074 §5, ADR-0257, ADR-0392, ADR-0393, ADR-0208, ADR-0380, ADR-0417, ADR-0045

**Kontextus.** A konverzió-elemzés (2026-11-05) szerint a beállítást nem bízhatjuk a vevőre: az egyetlen fizető (Duna Vibe House) a fizetés után egy napig semmit nem állított be, a két próbázó be sem lépett. Az admin ma nem mondja meg modulonként, mi hiányzik, és nem vezet végig rajta. A tulaj (11-06): a varázsló kezelje a függőségeket és a sorrendet (szobánkénti kiadásnál előbb a szoba, a létszám és a felszereltség a szobához tartozik, ehhez modul kell), mindenhol lehessen visszalépni, és az összes megvett modulon vigyen végig.

**Döntés.**
1. **Egy nyilvántartás** (`src/tenant/moduleSetup.ts`): témánként státusz-szabály (a meglévő predikátumokból, írás nélkül), beállítási út (beágyazott lépések a meglévő írás-függvényeken, vagy a meglévő lap visszatéréssel), súgó-link, `requires`-függőség és egységenkénti ismétlés. A varázsló, a modul-csempék, az Áttekintés sávja és az emlékeztető csak ezt olvassa.
2. **Első belépés = teljes képernyős varázsló** az összes megvett modul témáján, a függőségi gráf sorrendjében, élő vendég-előnézettel. **Utána = modul-csempék** a Modulok lapon, a lépések a modul lapjába ágyazva, sáv az Áttekintésen. A státusz mindig a valós adatból számol.
3. **Visszalépés mindenhol** (témán belül, témák között, a témasorból bármelyik kész téma újraszerkeszthető).
4. **Kiadási mód első kérdésként:** egészben / szobánként / egyben + bemutató szobák (whole_only). Szobánként a férőhely, az ár és a szoba saját felszereltsége egységenként ismétlődik; a státusz egységenként számol.
5. **Hiányzó modul → a meglévő kosár**, fizetés után ugyanott folytatja; vagy egészben marad. Helyben fizetés nincs.
6. **Státusz-állapotok:** Kész · Félkész · Hiányzik · Ön döntött így (pl. ár kérésre — nem hiány) · Nem kötelező (kihagyható, de felkínáljuk).
7. **Land-kapu `module-setup-registry-check`** (①–⑪, piros önteszttel): új modul csak bejegyzéssel, státusz-szabállyal, varázsló-úttal és súgóval landolhat; a függőség körmentes és egyezik az ADR-0192 katalógus-függésével.
8. **Emlékeztető:** az ADR-0417 belépés-emlékeztető és a belépés utáni heti levél megnevezi a hiányzó témákat, ugyanabból a nyilvántartásból.
9. **Folytatási állapot** szerver-oldalon: `site_setup_progress` tábla (oldalhoz kötve).
10. LLM-hívás nincs; minden felirat `T()`/`tr()`, Bábel fordít.

**Elvetve.** Ellenőrzőlista-kártya felugró ablakokkal (1. kör „A”); kézzel összerakott témalista (a 2. körben a tulaj dinamikusat kért); helyben fizetés a varázslóban (a kosár marad); a portálos ár/naptár előtöltés (a vevő portál-fiókjába nem lépünk be).

**Visszafordíthatóság.** 🔄 A varázsló és a csempék felületi réteg a meglévő írás-függvények fölött; a `site_setup_progress` tábla eldobható. A kapu kikapcsolása egy sor a pre-commitban.

**Következmény.** Minden új eladható modul a varázslóba kerül, különben a land megáll. A „Foglalás beállítása” oldal (ADR-0380) haladó nézetként marad.
