# 2026-11-09 — Brave tartalék-kulcs (BRAVE_API_KEY_2), élesen

**Session:** CIT `citcd10a1f0` · brief `~/rc-briefs/brave-api-20261108-230226.md` („brave key ha a másik kifogyna”)

## Mit találtam
- 2026-11-08 23:03: a `BRAVE_API_KEY` már HTTP 402-t adott (elfogyott a kerete) dev-en ÉS élesen (ugyanaz a kulcs) → az éles webes keresés (honlap-felderítés, kontakt, események) állt. Az új kulcs 200.

## Mit csináltam
- `src/config.ts`: `braveApiKeys` = `BRAVE_API_KEY`, `BRAVE_API_KEY_2` … `_9` (üres és ismétlődő kihagyva).
- `src/scraper/sources/webSearch.ts`: `braveWithFailover` — 402 → 60 perc, 401/403 → 6 óra, egy türelmes újrapróba után is 429 → 10 perc félretéve; ugyanaz a lekérdezés azonnal a következő kulccsal; a félretett kulcs a lejárat után újra próbálódik (a régi kulcs megújuló kerete magától visszajön); `noteDeadKey` csak ha egy kulcs sem maradt.
- Dev `.env` (`/home/citoviso/citoviso/.env`) és éles `.env` (`/opt/citoviso/app/.env`, mentés `/opt/citoviso/backups/brave-key2-20261108-222851/`): `BRAVE_API_KEY_2`.
- `~/rc-briefs/uj-lanc/honlapcheck/brave_check.py` (repón kívül): kulcsváltás ugyanígy (mentés `.bak-20261108`).
- Deploy: `9cbe2b44` (`prod/20261108-2330`), élő próba élesen: 402 → váltás → találat.

## Tanulság
- ⚠️ `sed -i` egy munkafa `.env` symlinkjén a symlinket SIMA FÁJLRA cseréli (a fő `.env` változatlan marad). Symlinkelt fájlt `--follow-symlinks`-szel vagy a célfájlon szerkessz.

## Nyitott
- Nincs.
