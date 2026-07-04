# Repó bootstrap (2026-07-04)

## Mi történt
Új repó `/home/vitrino/vitrino` (github.com/olaszferenc/vitrino), a MineREAL best-practice átemelve:
- `CLAUDE.md` — §0 deploy-doktrína (lokál-először, push csak módosított, éles csak scope-olt current-turn engedéllyel), session-start/-close, kód-konvenciók, jogi őrszem.
- `MEMORY.md` + `_planning/memory/` (fejlődő vállalati memória, gitelt).
- Node+TS scaffold: `package.json`, `tsconfig.json` (strict, ESM NodeNext), `src/{config,index}.ts`, `src/scrape/index.ts` (Source-kontraktus), `src/generate/{types,index}.ts` (a Property „mag" adat-objektum).
- `deploy/deploy.sh` — skeleton, refuse amíg nincs `DEPLOY_TARGET` (éles infra TBD).

## Öröklött infra (nem kellett építeni)
- Globális `block_live_deploy.sh` PreToolUse hook → az új repóra is véd.
- Harness auto-memória cwd-alapú → a vitrino saját auto-memóriát kap.

## ⚠️ Git push blokk
A gép GitHub SSH-kulcsa **repo-scoped deploy key CSAK a `minereal`-hoz** (`ssh -T git@github.com` → "Hi olaszferenc/minereal"). A vitrino-hoz külön deploy key kell (write), lásd `deploy/DEPLOY_KEY_SETUP.md`. Amíg nincs, lokál commit megy, push nem.

## Remote / watchdog
Egy közös `rc-watchdog` elég (repo-agnosztikus). Repo-tag konvenció + külön üres idle-slot a vitrinóhoz beállítva (`rc-new.sh` / `ensure_pool` kiegészítés). Részletek: MineREAL memória rc-watchdog bejegyzés.

## Következő
1. Vitrino deploy key GitHubra → első push.
2. `mockups/gen.py` → `src/generate` port (TS).
3. Első `Source` a `src/scrape`-be (zimmerinfo/hovamenjek ingest).
