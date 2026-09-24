# 2026-09-24 — Dev: új teszt-címzett (e-mail + MMS) engedélyezve

## Elvégezve
- **MMS/SMS:** `OUTREACH_SMS_ALLOWLIST=06305161631,06203759440` a fő fa közös `.env`-jében
  (`/home/citoviso/citoviso/.env`, nincs gitben). Mérve: `smsAllowlistBlocks("+36203759440")` = null,
  listán kívüli szám továbbra is TILTVA. `citoviso-console` + `citoviso-public` újraindítva
  (a `tsx watch` a `.env`-et nem figyeli).
- **E-mail (viktoria.balogh1@gmail.com):** nem kellett módosítás — deven valódi Zoho SMTP megy,
  csak a foglalt domaineket blokkolja a `ReservedRecipientGuard`; gmail nem foglalt.
- A dev DB-ben sem a cím, sem a szám nem szerepel (leiratkozási napló sem) → nincs tiltás.

## ⚠️ Tudnivaló
- Az allowlistán lévő szám „a tulaj tesztszáma” (`isAllowlistedTestNumber`) → a 8–20 órás
  küldési ablak és a pár-fejtér rá NEM vonatkozik; este is kimehet MMS.

## Módosított fájlok
- `/home/citoviso/citoviso/.env` (git-en kívül; mentés: a session scratchpadjában)
- `_planning/memory/2026-09-24_dev_test_recipient_viktoria.md`, `MEMORY.md`

## Nyitott
- Élő próbaküldés erre a címre/számra a konzolból még nem futott.
