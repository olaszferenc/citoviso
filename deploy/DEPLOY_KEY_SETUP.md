# GitHub push beállítása (vitrino deploy key)

A dev-gép GitHub SSH-kulcsa egy **repo-scoped deploy key**, ami CSAK a `minereal`
repóhoz jó. A `vitrino` push-hoz külön deploy key kell (a MineREAL-mintát követve).

## Már elkészült a gépen
- Kulcs: `~/.ssh/id_ed25519_vitrino` (+ `.pub`)
- SSH host-alias: `github-vitrino` (`~/.ssh/config`) → a git ezen keresztül használja a kulcsot
- Git remote: `git@github-vitrino:olaszferenc/vitrino.git`

## Amit NEKED kell megtenni (egyszer)
1. Másold ki a publikus kulcsot:
   ```bash
   cat ~/.ssh/id_ed25519_vitrino.pub
   ```
2. GitHub → a **vitrino** repó → **Settings → Deploy keys → Add deploy key**
   - Title: `mineral-debian`
   - Key: a fenti sor
   - ✅ **Allow write access** (különben csak olvasható → push nem megy)
3. Ellenőrzés a gépen:
   ```bash
   ssh -T git@github-vitrino        # "Hi olaszferenc/vitrino!" a jó válasz
   git -C ~/vitrino push -u origin main
   ```

> Alternatíva: account-szintű SSH-kulcs vagy Personal Access Token — de a deploy key
> a legszűkebb jogú, és illik a meglévő mintához.
