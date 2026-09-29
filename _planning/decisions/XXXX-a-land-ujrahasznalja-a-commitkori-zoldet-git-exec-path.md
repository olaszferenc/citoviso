## ADR-XXXX — A land TÉNYLEG újrahasznosítja a commitkori zöldet: a git exec-path kimarad a kapu-aláírás PATH-jából (2026-09-29)

- **Kiváltó (tulaj, 2026-09-29):** *„hát ez extrém hosszan tart...”* — a galéria-szál (ADR-0259)
  második landja ~15 percig futtatta a teljes böngészős kapusort (brief: `~/rc-briefs/lassu-land-vizsgalat.md`).
  Kérdés: az ADR-0227 ④ („a land nem méri újra, amit a commit már megmért”) után MIÉRT futott le újra?

**A mérés**

1. **20 land/commit-futás összegző sora (2026-09-28 19:04 – 2026-09-29 10:12, a sessionök
   scratchpad-naplóiból): mind a 20-ban `0 már zöld volt ugyanezen a fán`.** A galéria land2-je
   (09:57) a TIPIKUS eset volt: egy commit, a rebase semmit nem hozott („is up to date”), nem
   volt kiosztandó ADR, a munkafa tiszta — mégis 84 kapu futott le 892 s alatt.
2. **Az ok:** a git MINDEN hook elé a saját exec-path-ját (`/usr/lib/git-core`) teszi a `PATH`
   elejére (mérve: egy üres repóban a hook `PATH`-ja `/usr/lib/git-core:…`, a hívó shellé nem).
   A `land.sh` a hookot sima `bash`-sel hívja, tehát ott ez a tag hiányzik. A futtató aláírása
   a TELJES környezetet hasheli (a `VOLATILE` kivételével), benne a `PATH`-t — így a commit-kori
   és a land-kori kulcs soha nem egyezhetett. A commit→commit újrapróba működött (a galéria
   commit3-ja 70 kaput újrahasznált), a commit→land soha.
3. **Miért nem fogta meg az őr:** a `gate-runner-check` E forgatókönyve a hookot MINDKÉT
   alkalommal maga futtatta (`bash hook`), git nélkül — a két környezet ezért azonos volt.
   A valóságot (git futtatja a hookot) sosem mérte.

**Döntés**

1. **A hash-elt `PATH`-ból kimarad a `git --exec-path` könyvtár — és CSAK az.** Abban a
   könyvtárban csak a git saját alparancsai vannak (`git-*`, `scalar`, `mergetools` — mérve),
   tehát nem változtathatja meg, melyik `node`/`tsx`/`npx` fut. Minden más `PATH`-elem és a
   sorrendjük továbbra is a kulcs része.
2. **Az őr a valódi utat méri:** az E forgatókönyv commitkori futását a GIT indítja (valódi
   `git commit`, a fixture-hook `core.hooksPath`-on át, a repón kívüli könyvtárból, hogy ne legyen
   követetlen fájl), és a land-futásnak ezt a zöldet kell újrahasznosítania. Új ág: más `PATH`
   mellett a kapu ÚJRAFUT. Két új visszarontás (az exec-path is a hashben · a teljes `PATH`
   kihagyva), mindkettő piros; az első pontosan a mért hibát adja (futás 4→5). 15 visszarontás, mind piros.
3. Semmi más nem változik: a kulcs továbbra is fa + teljes diff + argv + stdin + környezet; a
   diffet/módot olvasó kapu sosem marad ki; piros ítélet nem tárolódik; ha a rebase BÁRMIT hozott
   (vagy a land ADR-számot osztott ki), minden kapu fut (ADR-0227 ④ változatlan).

4. **Útközben mért, idegen piros — a `gate-lane-check --self-test` a tiszta mainen is piros volt.**
   A negatív kontrollja az ÉLŐ `scripts/wallet-check.mts` volt, amit a 0b3bfeae (2026-09-25)
   megjavított (már nem kölcsönzi az első `scrape_run`-t) → 0 lelet → önteszt-bukás. Négy napig
   senki nem látta, mert csak a futtató vagy az őr változásakor fut. A kontroll mostantól a
   javítás ELŐTTI, commithoz kötött valódi változat (`git show 0b3bfeae~1:scripts/wallet-check.mts`,
   1 lelet); ha nem olvasható, az PIROS (eddig a hiányzó kontroll némán „kihagyva” lett).
   A felismerő és a 19 szintetikus sértés változatlan.

**A lassúság másik, nagyobb oka — NEM ebben az ADR-ben döntve (javaslat a koordinátornak):**
a 2026-09-28 01:05 óta bekötött `mobile-chrome-check` (ADR-0253; 19 sablon × 2 lap × 2 nézet,
40 px-es görgetési lépésekkel) a kritikus út. Reprodukció (a galéria land2-jének kapusora,
`LAND_RANGE=9ad6652d...HEAD`, gyorsítótár nélkül, 11:02): 84 kapu, **960 s**; a kapuidők összege
2609 s (4 szálon ~650 s lenne), de a `mobile-chrome-check` **577 s** + a `--selftest`-je **164 s**
— ugyanaz a szkript önmagával nem fut együtt, tehát 741 s EGY láncban. A 20 mért teljes futásból a
13-ban, ahol ez a kapu lefutott, az ① fázis 530–922 s; a 7-ben, ahol nem, 53–438 s. Slotra várás ezekben 0–49 s (ADR-0230 nem ok).

**Eredmény:** egy commit landolása, ha a main közben nem mozdult és nem volt kiosztandó ADR, a
landnál újra csak a diffet/módot olvasó kapukat és a `tsc`-t futtatja; minden más eset változatlan.
Élő bizonyíték: ennek az ADR-nek a commitja után a land-hívás pontos mása (`LAND_RANGE=origin/main...HEAD
bash hooks/pre-commit`, a git-hookétól eltérő `PATH`-szal) a session-jegyzetben rögzítve. (Ennek a
commitnak a VALÓDI landja nem bizonyíték: a land ADR-számot oszt ki, az új fát ad, és — helyesen — mindent újrafuttat.)
