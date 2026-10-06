# 2026-10-06 — MMS-pár egy egység: modem-sáv (ADR-0332)

**Brief:** `~/rc-briefs/mms-par-sorrend-20261006.md` (koordinátor: CIT ➕ megkeresés). Tulaj: „MMS utána sms és csak utána mehet tovább a következő leadre”.

## Mit csináltunk
- Új `src/sms/modemLane.ts`: közös zár (MMS- + SMS-relay), sáv-állapot (`outbox-sms/modem-lane.json`), gammu-ítélet a `outbox`/`sentitems` táblákból (concat-UDH részszám, errorbox, 8 perces törlés), `drainSmsLane`, `mysqlGammuStore` (mysql CLI, `MYSQL_PWD`).
- `src/mms/relayClient.ts`: tick = üres sáv → EGY MMS → ack → a kísérő SMS-ek kihúzása + igazolt kiküldése; nem üres sávon MMS nem indul.
- `scripts/sms-relay.mts`: gammu-DB beállítással a sávon fut, `sent` csak igazolt kiküldés után; nélküle régi út + figyelmeztetés.
- `src/sms/relayQueue.ts`: a `/api/sms-relay/*` logika a `public.ts`-ből ide; végleges bukásra EGY házi riasztás (éles rész → nagy deploy).
- `src/config.ts` `gammuDb`; dev `.env`: `GAMMU_DB_USER`/`GAMMU_DB_PASSWORD` (fő fa, symlink).
- Őr: `scripts/mms-relay-check.mts` ⑬–⑱; pre-commit trigger bővítve. `docs/mms-send.md` frissítve.

## Teszt
- Őr zöld; mutációs próba (sáv-kapu ki) → 4 eset bukik.
- Valódi gammu-DB-n olvasva: a mai 69/70/71 → errorbox-bukás, 72 → ok; a daemon leállítását (futó pace-küldés alatt) helyesen látta.
- Valódi küldés NEM volt.

## Nyitott
- Éles szerver-rész (SMS-bukás riasztás) a nagy deployjal.
- A pace.sh-t a land után nem kell használni; a timereket a koordinátor kapcsolja vissza.
