# 2026-09-24 — A pre-commit kapusor párhuzamos futtatása (ADR-0227)

**Kérés:** a tulaj kétszer szólt a kapusor futásidejéért („Jaaa már 98 kapu van????”); brief:
`~/rc-briefs/pre-commit-gate-speed.md`. Feltétel: kapu és állítás nem csökkenhet.

## Mérés
- Szintetikus diff a 4 nagy felületi fájlra (`git commit-tree` egy záró újsorral, HEAD-et nem
  mozdítva), `LAND_RANGE=HEAD..<X> bash -x hooks/pre-commit`, `PS4` időbélyeggel.
  ⚠️ A gép locale-ja miatt az `$EPOCHREALTIME` VESSZŐS tizedest ad — a feldolgozó cserélje.
- 77 kapu, 480 s sorosan. Medián 3,9 s; a `npx tsx` indulása ~1,8 s (ebből ~0,8 s npm).
- 14 író kapu (saját fixture-t szúr a közös DB-be), soros összegük ~186 s.

## Megoldás
- `hooks/pre-commit`: `npx`/`node` = feljegyző shell-függvény, a hook végén `gate_flush` →
  `scripts/lib/gate-runner.mjs`. ① párhuzamos (4 szál), `PGOPTIONS` csak-olvasó DB-vel;
  `scripts/lib/gate-ro-preload.mjs` jelzi a lenyelt írási kísérletet is → ② sorosan újrafut.
- Zöld-gyorsítótár: a land kihagyja, ami PONTOSAN ugyanazon a fán + diffen + argv/env/stdin
  mellett már zöld volt (2 h). Kulcs csak tiszta munkafán. Piros sosem tárolódik.
- Soros menekülőút: `CIT_GATE_JOBS=1`. Írók listája: `<git-common-dir>/cit-gate-writers`,
  zöld-gyorsítótár: `<git-common-dir>/cit-gate-pass/`.
- Őr: `scripts/gate-runner-check.mts` (A–E forgatókönyv, 9 visszarontásos piros önteszt).

## Eredmény
480 s → 266 s (4 szál), minden kapu zöld. A saját őröm két valódi hibát fogott a futtatóban:
a fixture-hibák mellett a `commonDir()` a FŐ FA könyvtár-`.git`-jén `null`-t adott (író- és
zöld-gyorsítótár nélkül maradt volna), és a meta-őr (`guard-wiring-check`) a párhuzamos úton
is olvashatóan jelezte a bekötetlen új őrt.
Az első land-kísérletet a SAJÁT őröm buktatta: land alatt a fixture örökölte a
`LAND_RANGE=origin/main...HEAD`-et — és ez egy valódi hibát is felszínre hozott: elhasaló
`git diff` mellett a kulcs az ÜRES diff hash-ét kapta volna (pipefail hiányzott). Javítva + őrizve.

## Fájlok
- `hooks/pre-commit` (feljegyző mechanika + `gate_flush` + a `gate-runner-check` bekötése)
- `scripts/lib/gate-runner.mjs` (új), `scripts/lib/gate-ro-preload.mjs` (új)
- `scripts/gate-runner-check.mts` (új)
- `_planning/decisions/XXXX-parhuzamos-kapu-futtatas-csak-olvaso-db-vel.md` (új)

## Nyitva
- Az írók (~70% a maradékból) gyorsítása őrönként: közös szerver/böngésző, vagy auditált
  „saját fixture, globális számlálás nélkül” jelölés után párhuzamos író-sáv.
- A land-gyorsítótár találati arányát élesben mérni (hány land talál: egy commit + álló main).
