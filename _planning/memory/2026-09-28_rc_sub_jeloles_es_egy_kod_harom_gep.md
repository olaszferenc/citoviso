# 2026-09-28 — RC-gépezet: 🔴 SUB-jelölés + egy kód három gépen (ADR-XXXX)

## Kérések
1. A másik session által indított session neve `CIT+ / MR+ / OF+`, utána piros nagybetűs SUB, utána a cím. Doktrína, megkerülhetetlenül.
2. Nézzük át a watchdogot OF-en és MR-en, és a munkamenetet szabályozó dokumentumokat: ami CIT-en fut, az legyen a standard. A tulaj a „közös, legjobb-összeg” változatot választotta.

## Elvégezve (mind a repón KÍVÜL, mindhárom gépen)
- **SUB:**
  - `rc-new.sh`: a név kötelezően `<KEY> ➕ 🔴 SUB <cím>`, jelölőfájllal.
  - `rc-handoff.sh`: a jelet az elődtől örökli.
  - A watchdog átnevezéskor megtartja a jelet.
  - Új hook: `block_direct_rc_launch.py`.
- **Közös watchdog:** az MR alapján, a CIT címadásával és az OF üres-slot takarításával. Gépenkénti config: `~/.config/rc-watchdog.json`. Új önteszt: `--selftest-config`.
  - A `rc-new.sh` és a `rc-resume.sh` is a configból olvas.
- **Új eszközök a CIT-en:**
  - `rc-watchdog-sync.sh`: `--check` (md5-tábla) és `--push --go` (mentés, másolás, önteszt, újraindítás).
  - `rc-standard.md` + `rc-standard-apply.py`: a doktrína-blokk forrása és alkalmazója.
- **Doktrína:**
  - Mindhárom globális `CLAUDE.md`-ben azonos `RC-STANDARD` blokk, gépenkénti eltérés-táblázattal.
  - Az elavult szabályokat kivettem: átnevezés DELETE + resume helyett PUT; a `mineral-debian` generic; „OF-en nincs címadó”.
  - Az OF megkapta a közös §1–6-ot és egy OF-kiegészítést (zárás = `rc-land.sh`).
- **Javítva:**
  - Az MR `--dry-run` token-kérést küldött.
  - Duplán definiált `set_title` / `delete_cloud`.
- **Ellenőrzés:**
  - Öntesztek (config, title, resume-guard) mindhárom gépen zöldek.
  - A szárazfuttatás a 3 halott slot kivezetésén kívül más műveletet nem javasolt.
  - Élesítés után mindhárom watchdog „all healthy”; `rc-watchdog-sync.sh --check` → nincs eltérés.

## Fájlok
- **Közös, mindhárom gépen:**
  - `~/bin/`: `rc-watchdog.py`, `rc-new.sh`, `rc-resume.sh`, `rc-handoff.sh`, `rc-tree.py`, `rc-standard-apply.py`
  - `~/.claude/hooks/`: a 3 session-hook
  - `~/.config/rc-watchdog.json`
  - `~/.claude/CLAUDE.md`
  - `~/.claude/settings.json` (hook bekötés)
- **Csak CIT:** `~/bin/rc-watchdog-sync.sh`, `~/bin/rc-standard.md`.
- **Mentések:** `~/bin/_backup-sub-20260928-0818/`, `~/bin/_backup-sync-*` (mindhárom gépen).

## Nyitott
- Az OF repó `CLAUDE.md` §3 „Commit + push” elavult (nincs remote), egy OF-sessionből kell javítani.
- Az MR cron `citoviso-creds-push` szünetel („PAUSED-for-design-login”); a CIT tokenje ma a watchdog saját továbbküldésével frissül. Döntés: visszakapcsoljuk-e?
