## ADR-0052 — A párhuzamos szálak: félkész izoláció és őrizetlen landolás

- **Kiváltó (tulaj, 2026-08-22):** *„valami nincs jól beállítva, hogy állandó összeakadás van?"*,
  majd — a diagnózis után — *„Fegyelmet nem lehet doktrína szinten rögzíteni?"* és
  *„azt nem értem, hogy a MineREAL-ban miért nem találkoztam ilyen hibával."*

**Amit a mérés mutatott (2026-08-22):**
- **16 worktree él, és a GitHubon összesen 1 db `wt/*` ág volt fent.** A záró `push` a legtöbb
  sessionben SOHA nem történt meg: ~10 párhuzamos szálnál a `main` percenként mozog, tehát a sima
  `git push` **non-fast-forward** hibával elhasal. A session látja, a tulaj a „kész, felküldve"
  összefoglalót olvassa. Egy éles **DKIM-hibajavítás** így halott sessionben ült (megmentve: `9c121d2`).
- **A „tesztkörnyezet" egy VÉLETLEN worktree-ből futott** (`cit2167c7de`), nem a `main`-ből — ez a
  „productionben megvan, teszten nincs" élmény valódi oka.
- **Az izoláció félkész:** a worktree-pool (2026-08-20) a KÓDOT izolálta, de minden fa ugyanoda
  mutat: `sites/`, `node_modules`, `.env` symlink a fő fába, és **egyetlen közös Postgres**
  (`citoviso_dev`). Vagyis a kód izolált, az **adat és a kimenet nem**.

**Miért ez a legalattomosabb rész:** a DB **megőrzi a hatást, a kód nem**. Egy szál lefuttat egy
migrációt és adatot ír; a fája később eltűnik, **az adat marad**. A tesztkörnyezetben így úgy
*látszik*, hogy egy funkció működik, pedig a kódja sehol nincs — és fordítva. A `sites/`
megosztottsága nem önálló döntés volt, hanem a közös DB **következménye** (a DB cwd-relatív
útvonalakat tárol).

**Miért nem jelentkezett ez a tulaj MineREAL-workflow-jában** (amely egyébként a MÉRCE, lásd a
memóriát): ott **a tulaj a sorosító** — egy szál, egy feladat, és ő maga LÁTJA a `git push`
kimenetét. Itt tíz szál fut, és egy asszisztens **összefoglalót** ad a nyers hiba helyett. Ráadásul
a MineREAL-ban a dev DB már **dump-másolat**, tehát az izoláció ott megvan. Nem a munkamódszer
rossz: a párhuzamosság és a delegálás vitte át azokat a lépéseket, amiket eddig ember figyelt.

**Döntés**

1. **⛔ ELVETVE: dev DB szálanként.** Az ADR első változata ezt döntésként rögzítette — tévedés
   volt, és a tulaj kapta el (*„??? DEV DB SZÁLANKÉNT?"*). Két okból hibás:
   **(a) Nem volt mögötte bizonyíték.** A szálon HÁROM hibát mértünk (a záró push elmaradása; az
   éles fájl-kollázs; a tesztkörnyezet véletlen worktree-ből) — **egyik sem adatbázis-probléma**.
   A „DB-drift" ezzel szemben feltételezés maradt, egyetlen demonstrált eset nélkül, mégis
   döntésként került be. Ugyanaz a hiba, amit ugyanezen a napon a vízjel-detektornál még helyesen
   elkerültünk: nem építünk nem létező problémára.
   **(b) Aktív kárt okozna.** A lead-adat drága és KÖZÖS értékű; húsz szálra szétszedve minden szál
   elavult másolaton dolgozna, és a scrape eredménye nem hasznosulna a többi szálban.
   **Marad az egy közös `citoviso_dev`.** Ha egyszer valóban jelentkezik migráció-ütközés, ELŐBB
   dokumentálni kell egy konkrét esetet, és csak utána nyúlni a sémához.
   A `sites/` megosztottsága szintén marad (a közös DB cwd-relatív útvonalainak következménye).

2. **Landolási kapu — a fegyelem doktrína ÉS ellenőrzés.** A tulaj kérdésére a válasz igen, de a
   saját repó bizonyítja, hogyan: az i18n, a dizájn-token, a modul-konfig és a tudásbázis-doktrína
   **egyszer sem sérült** — mindegyik mögött pre-commit kapu áll. A „commit + push záráskor" és a
   „csak a módosított fájlok élesre" **mögött nem állt semmi**, és mindkettő elbukott.
   **A leírt szabály emlékeztető; a futó kapu tény.** Ezért a zárás kap egy `land` lépést
   (fetch → rebase → kapuk → push → **visszaellenőrzés**), amely HANGOSAN áll meg, ha nem ment át,
   és amíg a `git log origin/main..HEAD` nem üres, a session nem nevezhető lezártnak (CLAUDE.md §3).
3. **A fő fa integrációs pont, nem munkaterület.** `/home/citoviso/citoviso` csak `main`-t húz és a
   tesztkörnyezetet szolgálja; fejlesztés kizárólag worktree-ben. Ma ez a fa egyszerre volt
   munkahely és integráció — ezért ragadt félbehagyott merge-ben és tartott bent 4 commitot.
4. **A worktree-GC tartalom szerint ítéljen.** ⚠️ A commit-szám és a `git cherry` **HAZUDIK**: a
   rebase új SHA-t és új patch-id-t ad ugyanannak a tartalomnak. A 9 „beragadt" commitból tartalmi
   ellenőrzés után **1** maradt valódi. Számlálóra épülő GC előbb-utóbb valódi munkát töröl.

**Visszafordíthatóság:** 🔄 additív (egy script + a tesztkörnyezet átkötése); a séma és a DB érintetlen.

**Nyitott (implementáció):** a `land` script beillesztése a zárási rutinba, a tesztkörnyezet
átkötése a fő fára, és a worktree-GC tartalmi ellenőrzésre alapozása.
