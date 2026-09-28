# 2026-09-28 — RC-sessionök: SUB-sorszám (🟦1.2) és munka-jel (🟠/🟢)

Repón kívüli munka: a közös RC-gépezet (`~/bin`, CIT a forrás, `rc-watchdog-sync.sh --push --go` → CIT·MR·OF).
A doktrína a `~/.claude/CLAUDE.md` RC-STANDARD blokkjában él (forrás: `~/bin/rc-standard.md`).

## Elvégezve
- **Bejelentés: „a sorszámozás nem megy”.** Mérve: MŰKÖDÖTT — a 🟦1 a SZÁLAT azonosítja (melyik main koordinálja), és mind a
  négy SUB-ot ugyanaz a main (`ded06a5f`) indította (jelölőfájl + a main átiratában az `rc-new.sh` hívások). A tulaj a SUB-ok
  sorszámozását várta → új szabály.
- **SUB-sorszám a szálon belül:** `🟦1.1`, `🟦1.2` … indulási sorrendben (`~/.claude/rc-subnums.json`); a szál életében NEM
  használódik újra, átadásnál (`rc-handoff.sh`) az utód örökli, a szál végével felszabadul. `TAG_RE` és az `rc-new.sh`
  névtisztítója az `N.K` alakot is ismeri. Önteszt: `--selftest-threads` (13 szabály, köztük öröklés + nem-újrafelhasználás).
- **Munka-jel a cím legelején:** 🟠 dolgozik / 🟢 végzett (a tulaj lép). Forrás: a felhő `worker_status` mezője (`running`/`idle`)
  — a GET `/v1/code/sessions/<id>` válasza `response_shape`-be csomagolt. A 30 mp-es gyors körben sessionönként egy GET (a friss
  címet is olvassa → a tulaj közben adott nevét nem írja felül); olvasáskor a jel lekerül, `set_title` visszarakja. Mérve:
  12 GET = 2,7 mp fal / 0,09 mp CPU / 0 token körönként; váltás 33 mp alatt látszott. Önteszt: `--selftest-status` (+ negatív kontroll).
- **Sync-hiba javítva:** a `rc-watchdog-sync.sh --push --go` CIT-en NEM indította újra a watchdogot (csak MR/OF) → a forrásgép a
  régi kódot futtatta. Most CIT-en is selftest + restart (élesben igazolva).

## Módosított fájlok (repón kívül)
`~/bin/rc-watchdog.py` · `~/bin/rc-new.sh` · `~/bin/rc-standard.md` · `~/bin/rc-watchdog-sync.sh` · `~/.claude/CLAUDE.md` (3 gépen).
Mentés: `~/bin/_backup-subnum-20260928-195935/`, `~/bin/_backup-sync-*`.

## Nyitott
- Opcionális: a gyors kör csak a változott átiratú sessionöket kérdezze le (12 → 1–3 GET). A tulaj nem kérte.
