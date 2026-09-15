# 2026-09-15 — A szűkített Elek-futás a lánc közepén állt meg; most előre szól

**Szál:** A2 folytatás · **ADR:** 0177 · **Élesítés:** NINCS (mérőeszköz).
**Tulajdonosi rendelet:** „előbb a futót javítsd" — az FK-006 tényleges futtatása KÜLÖN döntés,
NEM indítottam el (a park 11 másik szál alá dolgozik, és valódi LLM-költsége van).

## A lelet

`run-all.mts FK-006a FK-006b` a lánc KÖZEPÉN állt meg: `⛔ nincs ELEK-TESZT tenant`.
Ugyanez futott ki aznap délelőtt az orchestrator-szálon is, `FK-001`-gyel. **Kétszer, egy nap.**

Az ok nem a termék, hanem a futó:

| hol | mi |
|---|---|
| `elek/bin/run-all.mts:41` | `wanted()` szűkített futásnál CSAK a felsorolt köröket engedi |
| `:140` | ezért az **FK-005a kimaradt** |
| `:148` | nyolc sorral lejjebb viszont **megköveteli annak termékét** → `exit 1` |
| fejléc | közben azt ígérte: „csak néhány kör (**a park előáll hozzá**)" — nem állt elő |

⚠️ Addigra a park-írások (lead-seed, követett link visszaállítása) **már megtörténtek**.

**A hibaosztály nem a hiányzó tenant — az a KÉSLELTETETT TÜNET.** A hiba az, hogy a futás
elindult és írt úgy, hogy az első sorban eldönthető volt, hogy nem érhet célba.

## Amit csináltam

- **`src/elek/preconditions.ts`** (új) — a lánc ADATKÉNT: kör → mit igényel; tény → ki állítja
  elő, mit ad. Tiszta `planRun()` függvény: kért körök + MÉRT park-tények → problémák.
- **`elek/bin/run-all.mts`** — előfeltétel-mérleg **minden park-írás előtt**: kért körök · a
  park tényei (megvan/nincs) · a KIHAGYOTT körök és amit előállítanának · hiány esetén
  megnevezett hiba + futtatható javító parancs + `exit 1`. A hazug fejléc-sor javítva.
- **`scripts/elek-precondition-check.mts`** (új őr, pre-commit, ~4 mp, DB nélkül).

## A két dolog, amit a megírás előtt MEGMÉRTEM

1. ⛔ **Az `${ELEK_*}`-levezetés NÉMÁN hiányos lett volna.** Kézenfekvő volt a forgatókönyvek
   env-behelyettesítéseit grepelni. Megmérve: az **FK-006a, FK-006b és FK-007 egyetlen
   `${ELEK_*}`-ot sem tartalmaz**, pedig mindhárom az ELEK-bérlőre mér. Vagyis a
   „szerkezetinek látszó" levezetés pont a bejelentett esetet nem fogta volna meg — és úgy
   nézne ki, mintha nem tudna elavulni. Ezért a lánc kimondva áll, és őr védi.
2. ⛔ **Nem futtatom le automatikusan a hiányzó köröket.** Csábító volt a szűkítést
   „kiegészíteni" — de az FK-004/FK-005a valódi kiküldést, vásárlást és LLM-generálást jelent.
   Egy mérőeszköz, ami egy szűk kérésre magától költséget kelt a közös parkban, rosszabb, mint
   ami megáll és megmondja a parancsot.

## Bizonyíték

- **A bejelentett parancs a javított futóval:** megnevezett hiba, a két blokkolt kör
  felsorolva, a javító parancs kiírva (`… FK-005a FK-006a FK-006b`), **valódi kilépési kód 1**.
- **Nulla park-írás — mérve, nem feltételezve:** a futás előtti/utáni park-ujjlenyomat azonos
  (prospect-állapotok, tenant). A közben +1 lead egy **másik szál** `Őr-fixture Vendégház`-a
  volt (08:14:03); az ELEK-lead `created_at`-je változatlanul 2026-09-04. Megnéztem, nem tippeltem.
- **Elgépelt kör:** `FK-006x` → `⛔ ISMERETLEN KÖR` + a lánc körei felsorolva, rc=1 (korábban
  némán nulla kört futtatott volna, és zölden zárt volna).
- **Önteszt 31 állítás**, köztük 7 negatív kontroll. **Piros ág:** a lánc-táblából egy sort
  kivéve 6 bukás — mindkét elavulás-réteg néven nevezi a kiesett kört; `set -e` alatt rc=1.

## Nyitott — a KÖVETKEZŐ körre

- ⏭️ **Az FK-006 tényleges futtatása.** A park jelenleg **nem tudja mérni**: nincs ELEK-TESZT
  tenant (purge maradványa). A futtatható parancs:
  `npx tsx elek/bin/run-all.mts FK-005a FK-006a FK-006b`
  ⚠️ Ez valódi vásárlás-kört + LLM-generálást jelent, és az FK-006 **időutazója évekre előre
  tolja a közös park előfizetés-óráját** → utána KÖTELEZŐ:
  `npx tsx scripts/reset-elek-billing-clock.mts --go`, és a zárásban kimondani, hogy megtörtént.
- A mai kísérletnél a visszaállító lefutott (`--go`): „nincs ELEK-TESZT tenant … nincs mit
  visszaállítani" — az időutazó egyetlen lépése sem indult el, az óra nem mozdult.
