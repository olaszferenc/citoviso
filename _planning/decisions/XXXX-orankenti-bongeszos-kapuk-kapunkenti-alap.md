## ADR-XXXX — Óránkénti böngészős kapuk: kapunkénti alap, minden kapu ítéletet kap, legfeljebb 2 gépi hely

- **Dátum:** 2026-11-26
- **Státusz:** elfogadva (tulaj: „Mehet”, 2026-11-26)
- **Érinti:** `scripts/gate-hourly.sh`, `scripts/lib/gate-runner.mjs`, `scripts/gate-runner-check.mts` (M forgatókönyv); előzmény: ADR-0446 (a böngészős kapuk óránként futnak), ADR-0480 (commit/land gyorsítás)

### Mi volt a baj (mérve 2026-11-26)
- A gép 7,9/8 magon járt (load ~26, swap 10/10 G). Másodpercenkénti mintavétel (a gép CPU-idejének 93%-a azonosítva): a kapuk vitték a CPU 42%-át, ebből **az óránkénti böngészős futás egymaga a gép 34%-át**, a sessionök commit-kapui 8%-ot.
- Az óránkénti futás **2026-11-16 óta (b6df42be, 477 commit) egyszer sem volt zöld** (`gallery-reach-check` · `configurator-placement-check` · `lead-page-surface-check` felváltva). Pirosnál az alap nem mozdult, ezért **minden órában mind a 92 böngészős kaput újrafuttatta, 950–1220 mp-ig, 24/7**, 4 szálon, vagyis a 6 közös gépi helyből 4-en. A commitok gépi helyre várása ebben az ablakban p90 58% (máskor medián 3%).
- A futtató az első piros után új kaput nem indított, így az óránkénti futás a többi kapuról ítéletet sem adott.

### Döntés
1. **Minden kapu ítéletet kap óránként.** Óránkénti módban `CIT_GATE_RED_OUT=<dir>` mellett a futtató nem áll meg az első pirosnál. A piros kapuk feladat-fájljait átadja (`<dir>/*.argv|env|cwd|label…`), és `DONE` jelet ír (`<kapuk>\t<piros>`). Commitnál és landnál a kapcsoló hatástalan: ott marad a megállás az első pirosnál.
2. **Kapunkénti alap.** Ha minden kapu ítéletet kapott, az alap a fejre lép, a piros kapuk pedig a `~/.cache/citoviso-gate-hourly/red-jobs/`-ba kerülnek. A következő órában ① a pirosak futnak újra a friss `origin/main`-en (`red_base...fej` tartomány, ahol a `red_base` az, ahonnan pirosak), ② az új commitok kapui a szokásos módon. Az új piros halmaz ① ∪ ②. Zöld, ha mindkettő üres.
3. **Ha nincs kapunkénti ítélet, a régi szabály él.** Ha a hook a futtató előtt bukott, vagy a futtató maga összeomlott (nincs `DONE`), semmi nem mozdul, és a következő óra mindent újraellenőriz. A biztonság tehát nem lazul: piros kapu addig fut óránként, amíg zöld nem lesz, és a riasztás ugyanúgy kimegy, egyszer piros halmazonként.
4. **Legfeljebb 2 gépi hely.** Az óránkénti futás `CIT_GATE_JOBS=2` szálon fut (`CIT_GATE_HOURLY_JOBS` állítja), és a systemd-unit már eddig is `Nice=10`, `IOSchedulingClass=idle` mellett futott. A 6 közös hely közül legalább 4 a sessionök commitjaié marad.
5. Egy piros kapu, amelynek szkriptje már nincs a mainen, hangosan kikerül a halmazból: nem lehet újrafuttatni.

### Igazolás
- `gate-runner-check` M forgatókönyv: két piros és egy zöld böngészős kapu, 2 szál. Óránkénti átadó módban mind a három lefut, pontosan a két piros adódik át, a `DONE` értéke `3\t2`, az átadott könyvtár újrafuttatása csak a két pirosat futtatja, land-módban pedig a kapcsoló hatástalan. Két új visszarontás: „az átadó mód is megáll az első pirosnál” és „a pirosak nem adódnak át”. Mindkettőnek pirosat kell adnia.
- Valódi próba külön állapot-könyvtárral, riasztás nélkül (2026-11-26). A main régi futtatójával (nincs `DONE`) a tartalék-ág fut: az alap marad, 2 szálon 882 mp. Az új futtatóval (eldobható klón, `origin/main` = az új kód) a kapunkénti ág fut. Az első kör (27 commit, minden kapu ítéletet kap, előzmény nélkül) 2488 mp alatt lefutott: az alap továbblépett, 5 piros került a `red-jobs`-ba. A második kör (2 új commit) **200 mp**: ① csak az 5 piros futott újra (143 mp), ② csak a 2 commit kapui (55 mp). A régi óránkénti kör ezzel szemben ~1000 mp.
- Az első kör olyan pirosakat is talált, amelyeket a régi futás az első piros után el sem indított: `shot-user-agent-check`, `mock-booking-sample-check` (a szabotázs-önteszt „nem változtatott a lapon”), `booking-outcome-truth-check` (TimeoutError). Ezek a korábban ismert `gallery-reach-check` és `configurator-placement-check` mellé kerültek.

### Nem része
- A három piros kapu javítása: valódi hiba a mainen vagy elavult kapu, külön feladat.
- Az MR gép `rc-watchdog.py --loop` folyamata folyamatosan 0,5–0,8 magot visz (7 napos átlag 49,6%). Ez az Overseer repóban javítható, nem itt.
