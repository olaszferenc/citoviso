# Remote / watchdog beállítás a vitrinóhoz (2026-07-04)

## Elv
Claude Code NEM repónként települ — egy CLI, `cd` a repóba. **Egy közös `rc-watchdog` elég** (repo-agnosztikus), NEM kell külön példány. Külön remote session viszont érdemes (külön kontextus + memória, nem keveredik a MineREAL-lal).

## Amit beállítottunk (a MineREAL gépén, `~/bin/`)
- `rc-watchdog.py`: `PROJECTS` registry — `MR ➕ Új munkamenet`→`~/minereal`, `VIT ➕ Új munkamenet`→`~/vitrino`. Per-repo tagelt **üres idle-slot** → telefonról látszik, melyik repóé. Resume a helyes mappában éled (`RC_PROJ`/`RC_PROJDIR` env).
- `rc-resume.sh` / `rc-new.sh`: `RC_PROJ`/`RC_PROJDIR` env-override (default minereal, backward-kompatibilis). `rc-new.sh "Név" [projdir]`.
- Backup: `~/bin/*.bak_20260704_144430`. Teszt: py_compile + dry-run + live restart zöld.

## ⚠️ GOTCHA — folder-trust prompt
Új repó első `claude`-indításakor a „Is this a project you trust?" prompt VÁR → nem regisztrál felhő-sessiont, nem látszik a Recents-ben, és a watchdog folyamatosan új (beragadó) slotot indít.
- **Fix:** a mappát trusted-re tenni. Egyszeri Enter a prompton (`tmux send-keys -t rc-<8> Enter`) perzisztálja: `~/.claude.json` → `projects["/home/vitrino/vitrino"].hasTrustDialogAccepted=true`. Utána minden slot átugorja.
- Duplikátum beragadt slot: PID szerint ölni (⚠️ self-pkill csapda!) + state-ből törölni.
- Vitrino trust MÁR beállítva; 1 tiszta VIT slot fut (megjelenik a Recents-ben reload után).

## Git push — HÁTRA (user teendő)
A gép GitHub SSH-kulcsa repo-scoped deploy key CSAK a minereal-hoz. Vitrino deploy key generálva (`~/.ssh/id_ed25519_vitrino`, ssh host-alias `github-vitrino`, remote beállítva). Fel kell tenni a GitHubra (write) → első push. Lásd `deploy/DEPLOY_KEY_SETUP.md`.
