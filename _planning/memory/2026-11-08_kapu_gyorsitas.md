# 2026-11-08 — Kapu-gyorsítás: böngészős kapuk a landen, súgókép-kapu csak változott bemenetre

**Session:** CIT `cit547b6566` (SUB, koordinátor: `cit5980e14c-92` „Telefon”) · **ADR:** ADR-XXXX

## Elvégezve
- `scripts/lib/gate-runner.mjs`: commit-módban (nincs `LAND_RANGE`) a böngészős kapuk a landre halasztva, hangosan listázva; `CIT_FULL_COMMIT=1` = teljes kör. A land változatlan.
- `scripts/gate-runner-check.mts`: K forgatókönyv (commit halaszt · land futtat · CIT_FULL_COMMIT futtat · commit-módú blokkban nincs böngészős kapu) + 2 visszarontás, mindkettő piros.
- `scripts/lib/kb-shot-pass.mts` (új) + `scripts/kb-shot.mts`: képenkénti bemenet-ujjlenyomat; `--check-committed` csak az eltérőt gyártja újra, `--full` mindet; minden felvétel azonos állapotból (egér, storage, sütik, cache ki) — mérve mind a 70 kép egyezik.
- `scripts/deploy-prod.sh`: `--full-kb-shots` (deploy és `--kb-shot-gate`), az összegző sor a darabszámmal.
- `hooks/pre-commit`: a kb-shot önteszt triggere a `kb-shot-pass.mts`-re is; doksi-blokk.

## Mérés
Kis commit 1:53 → 0:50 · deploy kép-kapu 2:00 → 1:22 hideg / 0:29 meleg (64/70 kép kimarad).

## Nyitott
- Felület-fájlos commit (views.ts) nyeresége nem mért (a §2b token nélkül megállítja a mérő commitot).
- `admin-modules-booking` súgóképén a `/assets/help/portal-naptar/*.webp` képek `file:///assets/...`-ként, vagyis TÖRÖTTEN töltődnek (a kb-shot nem írja át ezt a hivatkozás-alakot) — determinisztikus, de a kép valószínűleg hiányos. Külön vizsgálandó.
