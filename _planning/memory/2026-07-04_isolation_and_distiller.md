# Szigetelési döntés + ontológia-distiller (2026-07-04)

## Szigetelési döntés (staged)
- **Proto/dev fázis:** a vitrino a `mineral` user alatt marad a Debian dev-gépen, **külön repo/memória/DOMAIN/distiller** szeparációval (NEM külön Linux user — az eldobható köztes infra lenne).
- **Ha van váz + látszanak a méretek:** egyből **saját, dedikált VPS** (nem a MineREAL production VPS-ére, hogy ne keveredjen — külön business, külön infra: biztonság, backup, számlázás, eladhatóság). A külön-user köztes lépést átugorjuk.
- Minden hordozható (repo, memória, ontológia, distiller) → a migráció olcsó.
- VPS-recon (2026-07-04): a MineREAL VPS bőven bírna (6.8G RAM, 39G disk, load 0.00), de production → oda tenni újra keverés; Tailscale+chromium ott nincs. Elvetve proto-célra.

## Keveredés-veszély megszüntetve
- A MineREAL distiller korábban `find ~/.claude/projects -name MEMORY.md | head -1`-gyel keresett → a vitrino MEMORY.md megjelenésével **a vitrino memóriát kapta volna** vasárnap 03:00-kor.
- **Fix (mindkét distiller):** a memória-dir a repo-útból származtatva (`~/.claude/projects/<path-slash→dash>/memory`) → determinisztikus, repo-scoped. Igazolva: vitrino distiller 0 minereal-találat.

## Vitrino distiller + cron
- `_planning/DOMAIN/_tools/`: `distill.sh` (repo-scoped), `distill-prompt.md` (magyar), `.distill-manifest`, `_inbox/`.
- Olvassa a vitrino epizodikus memóriát (harness auto-mem + gitted `_planning/memory`), `claude -p` read-only review → `_inbox/`, ember vezeti át a DOMAIN-ba. Nincs ticketing (opcionális notify no-op).
- **Cron (mineral crontab):** `0 4 * * 0` (vasárnap 04:00, a minereal 03:00 UTÁN, hogy ne ütközzön). Log: `~/.claude/distill-vitrino.log`.
