# 2026-11-08 — Token-fogyás: az új lánc mennyisége vitte a B-keretet, várósor-fék

**Session:** `citb349cddb` (brief `~/rc-briefs/token-optimaliz-l-s-20261108-133503.md`).

## Mérés (11-06 10:00 → 11-08 13:40, B-fiók 1% → 90%)
- Összesen $1226 API-egyenérték: új lánc headless `claude -p` $937 (átnéző $764 / 2740 lead, fő terv $171), koordinátor $130, fejlesztő sessionök $159.
- **Egy lead ára: $0,39** (átnéző 0,28 + fő terv 0,06 + koordinátor 0,05) ≈ a heti keret 0,028%, ≈ 1,3 cent (ha a B is €200/hó — nem ellenőrzött). Régi lánc: $5,5 → −93%.
- Ok: mennyiség. A lánc 40 percenként 120 leadet nézett át, fék csak a heti 90% volt; ~50 küldés/nap mehet ki → 1929 lead vár jóváhagyásra.
- Mérő-vakfolt: a `pipemeter.py` csak átiratot olvasott (a `claude -p` nem ír átiratot), és $2275-os A-keretből számolt. B-fiók heti kerete ≈ $1380 (kalibrálva).

## Változás (repón kívül, `~/rc-briefs`)
- `uj-lanc/lanc.sh`: várósor-fék — ha a jóváhagyásra váró + sorban álló ≥ `MAX_BACKLOG` (200), a kör kimarad (napló: „várósor N ≥ 200 → kihagyva”). Mentés: `lanc.sh.bak-1108`.
- `watch/pipemeter.py`: `HEADLESS` források (`egylepes-elo/cases`, `uj-lanc`), `WEEK_BUDGET_USD = 1380`. Mentés: `pipemeter.py.bak-1108`.

## Tulaj-döntés
- A 200-as plafon marad; a 1929 várakozót nem hagyja jóvá tömegesen.

## Módosított fájlok (repó)
- `MEMORY.md`, `_planning/memory/2026-11-08_token_fogyas_varosor_fek.md`
