# 2026-09-29 — DEPLOY-READY.md újraírva: menet, ellenőrzőlista, vészterv, füst-próba

SUB-szál (brief: `~/rc-briefs/dk-deploy-ready-doc.md`, koordinátor: „Deploy-készenlét felderítés”). Csak dokumentum.

## Mit változtattam
- `_planning/DEPLOY-READY.md` teljes újraírás: a régi rsync-es „Deploy menete” (ellentmondott ADR-0053-nak) és a
  kézi `kb-translate` sor (ellentmondott ADR-0207 GATE 5-nek) kiment; helyette a `deploy-prod.sh` valós 20 lépése
  (blokkol / figyelmeztet), ellenőrzőlista, vészterv, füst-próba, pilot utáni lista; a szálankénti tábla 2 sorra rövidült.

## Mérve (élesi OLVASÁS, 2026-09-29)
- Éles: `263ef8dd` (`prod/20260924-1004`, WAIVED hotfix), séma `0070`-ig; a main +329 commit, 1212 fájl, 10 migráció.
- Az éles `.env`-ből mind a 9 domain/térkép-kulcs hiányzik (`REGISTRAR_PROVIDER` … `GOOGLE_MAPS_BROWSER_KEY`).
- Élesen 4 időzítő engedélyezve; a `263ef8dd` `targets.json`-ja pontosan ezt a 4-et deklarálja.
- Legutóbbi éles pg_dump: 2026-09-22; a dev gépen `~/citoviso-prod-backups/` ugyanaddig.

## Új lelet a vészterv írása közben
- A visszagörgető `deploy-prod.sh <régi sha> --go` NEM készít pg_dump-ot: a GATE 3 csak függő migrációnál fut,
  a régi commitnak pedig nincs. A vészterv ezért kézi mentéssel indul.
- A pg_dump visszatöltését ezen a sémán senki nem próbálta ki — a dokumentum ezt kimondja.

## Nyitott
- A vészterv parancsai nem futottak (élesi írás). Egy `citoviso_rb` próba-betöltés a deploy előtt bizonyítaná a dump épségét.
