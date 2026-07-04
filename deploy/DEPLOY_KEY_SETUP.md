# GitHub push beállítása (citoviso deploy key)

A dev-gép GitHub SSH-kulcsa egy **repo-scoped deploy key**, ami CSAK a `minereal`
repóhoz jó. A `citoviso` push-hoz külön deploy key kell (a MineREAL-mintát követve).

## Már elkészült a gépen
- Kulcs: `~/.ssh/id_ed25519_citoviso` (+ `.pub`)
- SSH host-alias: `github-citoviso` (`~/.ssh/config`) → a git ezen keresztül használja a kulcsot
- Git remote: `git@github-citoviso:olaszferenc/citoviso.git`

## Amit NEKED kell megtenni (egyszer)
1. Másold ki a publikus kulcsot:
   ```bash
   cat ~/.ssh/id_ed25519_citoviso.pub
   ```
2. GitHub → a **citoviso** repó → **Settings → Deploy keys → Add deploy key**
   - Title: `mineral-debian`
   - Key: a fenti sor
   - ✅ **Allow write access** (különben csak olvasható → push nem megy)
3. Ellenőrzés a gépen:
   ```bash
   ssh -T git@github-citoviso        # "Hi olaszferenc/citoviso!" a jó válasz
   git -C ~/citoviso push -u origin main
   ```

> Alternatíva: account-szintű SSH-kulcs vagy Personal Access Token — de a deploy key
> a legszűkebb jogú, és illik a meglévő mintához.
