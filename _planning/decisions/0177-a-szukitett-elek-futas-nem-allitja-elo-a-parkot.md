## ADR-0177 — A szűkített Elek-futás NEM állítja elő a parkot, és ezt előre kimondja (2026-09-15)

**Dátum:** 2026-09-15 · **Státusz:** ELFOGADVA (tulajdonosi rendelet: „előbb a futót javítsd") ·
**Kapcsolódó:** ADR-0095 (Elek-rend), ADR-0147 ③ (őr-bekötés), ADR-0131 ② (a mérőeszköz ne
értékeljen zöldre hibás lépést).

**Kiváltó (mérve, EGY napon KÉTSZER).** `run-all.mts FK-006a FK-006b` és — az orchestrator-
szálon — `run-all.mts FK-001` is a lánc KÖZEPÉN állt meg: `⛔ nincs ELEK-TESZT tenant`. Az ok
nem a termék: a `wanted()` szűrő (`:41`) a fel nem sorolt köröket kihagyja, így az FK-005a
(`:140`) sem futott — a következő sorok viszont MEGKÖVETELIK annak termékét (`:148`). Addigra a
park-írások (lead-seed, követett link visszaállítása) MÁR MEGTÖRTÉNTEK, a közös parkon pedig
~11 másik szál mér. A futó saját fejléce közben azt ígérte: „csak néhány kör (**a park előáll
hozzá**)". Nem állt elő — a fejléc hazudott.

**A hibaosztály nem a hiányzó tenant: az a KÉSLELTETETT TÜNET.** A hiba az, hogy a futás
elindult (és írt) úgy, hogy már az első sorban eldönthető volt: nem érhet célba.

### Döntés

**① Az előfeltételek ADATOK** (`src/elek/preconditions.ts`): a lánc körei + amit
megkövetelnek + ki állítja elő + mit ad a láncnak. A `run-all.mts` ebből számol.

**② A mérleg MINDEN park-írás ELŐTT fut.** A futás kiírja a kért köröket, a park mért
tényeit (megvan / nincs), a KIHAGYOTT köröket és azt, hogy melyik mit állítana elő. Hiány
esetén megnevezett előfeltétel-hiba + a futtatható javító parancs, `exit 1` — nulla írással.
Az „egyetlen park-írás sem történt" állítás **mérve** áll: a futtatás előtt/után vett
park-ujjlenyomat azonos (a közben megjelent új lead egy MÁSIK szál őr-fixture-je volt —
a feltételezés helyett megnéztem, kinek a neve és mikor).

**③ ⛔ A hiányzó köröket SZÁNDÉKOSAN NEM futtatjuk le automatikusan.** Kézenfekvő lett volna
a szűkítést „kiegészíteni" a termelő körökkel — de azok VALÓDI munkát végeznek (kiküldés,
vásárlás, LLM-generálás). Egy mérőeszköz, ami egy szűk kérésre magától költséget kelt a közös
parkban, rosszabb, mint ami megáll és megmondja a parancsot. A hibaüzenet ezt ki is mondja.

**④ Az elgépelt kör-név is hiba.** `FK-006x` korábban NULLA kört futtatott volna, és a futás
zölden zárt volna — ez nem üres eredmény, hanem mérés nélküli állapot.

**⛔ A levezetés, ami NÉMÁN hiányos lett volna (megmérve, mielőtt megírtam).** Kézenfekvő volt
a forgatókönyvek `${ELEK_*}` behelyettesítéseiből származtatni a táblát. Megmérve: az
**FK-006a, az FK-006b és az FK-007 EGYETLEN `${ELEK_*}`-ot sem tartalmaz**, pedig mindhárom az
ELEK-bérlőre mér (az időutazó azt lépteti, a foglalás-seed annak site-jaira ír). Vagyis a
„szerkezeti" levezetés pont a BEJELENTETT esetet nem fogta volna meg — és úgy nézne ki, mintha
nem tudna elavulni. Ezért a lánc kimondva áll, és őr védi az elavulástól.

**Kapu:** `scripts/elek-precondition-check.mts` (pre-commit, ~4 mp, DB nélkül — tiszta
függvényt mér). Három réteg: ① viselkedés (a két mért eset PIROS + hét negatív kontroll:
park már tudja · a termelő is kérve · teljes mátrix · függetlenség nélküli kör), ② elavulás (a
tábla pontosan a futó által INDÍTOTT és a forgatókönyv-fájlokkal LÉTEZŐ köröket fedi — új kör
kötelezően belép), ③ üzenet (megnevezi a tényt, a termelőt és a futtatható parancsot).
Az elvárások KÉZZEL írottak: egy őr, ami a vizsgált függvénnyel számolja ki a helyes választ,
a hibát is helyesnek mondaná.

**Piros ág bizonyítva:** a lánc-táblából egyetlen sort kivéve 6 bukás, köztük mindkét
elavulás-réteg néven nevezi a kiesett kört; `bash -c 'set -e; …'` alatt rc=1, zöld ágon rc=0.

**Visszafordíthatóság:** 🔄 a mérleg egy blokk a futó elején; a lánc-tábla adat.
