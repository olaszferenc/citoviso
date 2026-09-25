## ADR-0230 — Gép-szintű várakozósor a kapu-futtatónak: az egész gépen egyszerre legfeljebb N kapu fut, `flock`-slotokon, sessiontől függetlenül (2026-09-25)

- **Kiváltó (tulaj, 2026-09-25):** *„két párhuzamos lehetőség: várakozósor szervező + 14 író kapu
  auditja”* — ez az első (brief: `~/rc-briefs/gate-queue.md`). Az ADR-0227 óta a kapusor
  sessionönként 4 szálon fut; ~10 session osztozik a 8 magos dev gépen, és ugyanaz a commit 90 és
  270 s között bármennyi lehetett attól függően, ki commitol éppen mellette. A teljes átbocsátás
  nem nő attól, hogy 10×4 szál tapossa egymást — a szórás igen.

**A mérés (2026-09-25, ugyanaz a szintetikus diff, mint ADR-0227 — a 4 nagy felületi fájl egy
záró újsorral, `LAND_RANGE`-dzsel, gyorsítótár nélkül; a mért fa mellett 3 másik, ugyanezt
futtató fa adta a terhelést):** 
| futás (78 kapu, `booking-screen` kihagyva) | előtte (ADR-0229 előtti futtató) | utána (gépi slot, N=6) |
|---|---|---|
| egyedül, csendes gép | **274 s**, 301 s (zöld) | **281 s** (① 95 s · ② 186 s; slotra várt 1 s) — a másik, 344 s-os futás az előző kísérlet lecsengő terhelése alatt indult |
| a mért fa + 3 párhuzamos, ①-fázisú terhelő fa | 192 s **PIROS** (`help-collapse-check`: Playwright 30 s timeout — a taposás), 753 s zöld, 711 s zöld | 763 s zöld (① 279 · ② 481 s; a ② kapunként újra sorba állt — ezért lett a ② EGY tartott slot), majd 569 s **PIROS** a `room-editor-check` negatív kontrollján (220 ms-os átmenet közepén olvasott — a main azóta javította, cfc4e5db) |
| a mért fa + 3 terhelő fa, **idegen futtató nélkül** (0/45 minta), a VÉGSŐ futtató (író-sáv + slot) | — (nem mérhető: az idegen terhelés a mérés alatt végig futott) | **425 s zöld** (① 207 s; slotra várt 477 s a szálakon összesítve); a 7 terhelő futás mind zöld, 118–254 s |
| a terhelő fák (csak ① fázis) | 22 futás, **2 piros** (timeout · `programs-editor` fixture-ütközés két fa között: 28 program 14 helyett) | 15 futás, **0 piros** |

⚠️ A mérés zavart: a gépen a mérés 85–100%-ában IDEGEN (régi, slot nélküli futtatójú) CIT-sessionök
kapusora is futott (mintavételezve 10 s-onként), és az MR user kapusora sem vesz még részt — a
szemafor csak azokat fogja, akik már az új futtatót futtatják. Egy „utána” futás (after3) érvénytelen:
a saját takarításom (`rm -rf ~/.claude/cit-gate-slots`) futás közben vitte el a slot-könyvtárat a még
régi alapértékű másolat alól, és a futtató — helyesen, hangosan — slot nélkül folytatta.

**Döntés**

1. **A slot a GÉPÉ, nem a sessioné — és nem a useré.** Minden kapu — az ① párhuzamos olvasó
   és a ② soros író fázisban egyaránt — csak egy szabad gépi slotban indul: `flock` a
   **`/run/lock/claude-gate-slots/<n>`** fájlokon, `n < CIT_GATE_SLOT_COUNT` (alapból **6**; a
   sessionönkénti 4 szál marad, az csak a helyi felső korlát). Bármelyik futtató bármelyik
   slotot elveheti; ha mind foglalt, körben, kernel-ébresztéssel vár (`flock -w 1` — egész másodperc: a gép vesszős locale-ja a `0.25`-öt
   elutasítja, az őr fogta meg), nem pörög.
2. **A slot a FUTTATÓÉ, nem a kapué — így holtpont-mentes.** A futtató a `run()` ELŐTT kér
   slotot és a kapu kilépésekor engedi el — a ② soros fázis EGY slotot tart a teljes
   futására (egyszerre úgyis egy kaput futtat; kapunként újra sorba állva 12 várakozó szál
   mögé a 14 író 481 s-ig tartott a szóló ~170 s helyett — mérve); a kapu a `CIT_GATE_SLOT_HELD` környezetben tudja meg,
   hogy slot alatt fut, és egy belőle induló beágyazott futtató NEM kér újat. Az ütemező
   (`pump()`) szerkezete nem változott — az író-sáv (párhuzamos szál, „14 író kapu auditja”)
   erre rebase-el.
3. **Takarítás nincs, mert a kernel megoldja.** A slotot nem a futtató node-folyamata tartja,
   hanem egy `flock … -c 'echo 1; exec cat'` folyamat, amelynek stdin-je a futtató csövén lóg:
   ha a futtató meghal (kill -9, OOM), a cső zárul, a `cat` kilép, a `flock` kilép, a zár
   elenged. Nincs pid-fájl, nincs „árva slot” takarító. ⛔ A pid-fájlos megoldás ELVETVE: az
   árva pid-fájl pont a legrosszabbkor (OOM után) fogná meg mindenki kapusorát.
4. **Menekülőutak, hangosan.** `CIT_GATE_SLOTS=0`, hiányzó `flock` vagy nem írható
   slot-könyvtár → a futtató slot nélkül fut, és az első sorában kimondja. `CIT_GATE_JOBS=1`
   (a hook soros útja) érintetlen, slot nélkül is működik. `CIT_GATE_SLOTS=<könyvtár>` áthelyezi
   a sort — az őr fixture-je ezért SESSION-PRIVÁT könyvtárban zárol, sosem a valódi sorban.
5. **Kiírás.** A `kapu-futtató:` összegző sor megmondja, hány gépi slot volt és összesen hány
   másodpercet várt rájuk a futtató — a várakozás mérhető, nem sejtett.
6. **Őr — `gate-runner-check` F forgatókönyv** (a valódi futtatón, fixture-kapukkal): két
   futtató EGY közös sloton → a négy 1,2 s-os kapu között nulla átfedés ÉS mindkettő végigér
   (nincs holtpont); a futtató `kill -9`-e alatt a slot 2 s-en belül felszabadul; a slot alatt
   indított beágyazott futtató nem zárol; `CIT_GATE_SLOTS=0` mellett ugyanúgy kapuz. Piros
   önteszt két új visszarontással (slot-kérés ki · a holder `sleep`, ami túléli a futtatót) —
   11 visszarontás, mind pirosat ad.

**Eredmény:** **Az egyedüli futás ideje nem változott** (274/301 → 281 s). **A szórás csökkenése NEM
bizonyított** ebben a mérésben (az egyetlen tiszta, idegen terhelés nélküli slotos futás 425 s a zavart
711–763 s helyett — egy minta, nem bizonyíték): a terhelt futás ideje 711–763 s előtte és utána egyaránt (a szemafor
munkamegőrző — az átbocsátást átosztja, nem növeli), a zavaró idegen terhelés mellett kevés a zöld
minta. Amit a mérés MUTAT: slot alatt a taposásból fakadó timeout-bukás eltűnt (terhelő futások:
2/22 piros → 0/15; a mért fa ① fázisa mindkét slotos futásban zöld), és a futtató kimondja, mennyit
várt. A ② fázis kapunkénti újra-sorbaállása mérten éheztetett (481 s vs ~186 s), ezért a szigorú sáv
egy slotot tart végig. A holtpont-, kill -9- és beágyazott-futtató-viselkedést az őr méri. N=6 mellett
a loadavg ~22 maradt (egy „kapu” = szerver + Chromium, ~3–4 futó szál), tehát az N valódi értékét
akkor érdemes mérni (4 vs 6), amikor már minden session — és az MR — az új futtatót futtatja.

7. **A közös út a két user közös útja (szülő-session javaslata, mérve).** Ezen a gépen NEM csak a
   CIT fut: az MR (user `mineral`, saját watchdog, 23 élő session) ugyanezen a 8 magon landol a
   saját kapusorával. Egy `~/.claude` alatti alapérték user-szintű szemafor lett volna. Mért
   feltételek: mindkét watchdog-service `PrivateTmp=no`; a `/run/lock` közös 1777-es tmpfs; a
   `flock` csak-olvasásra nyitott fájlon is zárol (0444-en rc=0, foglaltan 250). A könyvtár
   1777 (sticky, mindkét user ír), a slot-fájlok 0644 (a másik user olvasásra nyitja és zárol).
   ⛔ A `/tmp` ELVETVE: a `systemd-tmpfiles` 10 nap után takarítja, és egy TARTOTT zárfájl
   kitörlése némán két „0-ás slotot” szülne (a régi holder a leválasztott inode-ot tartja).
   Az MR akkor vesz részt a sorban, ha átveszi a futtatót (külön MR-szál) — a közös út ennek
   az előfeltétele, a CIT_GATE_SLOTS override marad.

**Nyitva:** az N=6 induló érték; a tulaj gépén ~10 sessionnel élesben mérve dönthető
(`CIT_GATE_SLOT_COUNT`), a `kapu-futtató:` sor várakozás-száma adja az adatot. Az író-sáv
(párhuzamos szál) ugyanezt a slotot kéri majd — a ② fázis már ma is slot alatt fut.
