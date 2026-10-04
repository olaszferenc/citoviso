# 2026-10-04 — RC-sessionlista: a SUB-ok nem rendezhetők a koordinátoruk alá

Session: `citadb481c7`. Kód nem változott (csak olvasás a felhő-API-ból). Élesre: semmi.

## Kérés
Tulaj (képernyőkép a claude.ai sessionlistáról): „azt nem lehet megcsinálni hogy sorba legyen rendezve? hogy adott
koordinátor alatt a subjai?”

## Mérés (GET `https://api.anthropic.com/v1/code/sessions?limit=…`, 2026-09-29)
- A lista sorrendje = `last_event_at` csökkenő — a képernyőkép sorrendje pontosan ezzel egyezett. Minden esemény
  előreugratja a sessiont, ezért egy dolgozó 🟠 SUB folyton a koordinátora fölé kerül.
- A rekord mezői: `config, connection_status, created_at, environment_id, environment_kind, external_metadata, id,
  last_event_at, participants, relations, status, status_bucket, tags, title, unread, updated_at, user_message_count,
  worker_status` — pozíció / rendezési kulcs / rögzítés NINCS. A `PUT` a címet írja, a helyet nem.
- `relations` létezik, de 40/40 sessionnél `[]` — nem dokumentált, nem tudni, csoportosít-e a felület; NEM próbáltuk
  (a fiók közös a CIT·MR·OF gépeken).
- Álesemények sorrendbe küldése nem út: a következő valódi esemény szétszedi, és szemetet írna a sessionökbe.

## Javaslat (nyitott, a tulaj nem döntött)
A szál-jelet (🟦1 / 🟦1.3) a cím ELEJÉRE tenni (`🟠 🟦1.3 CIT ➕ 🔴 SUB …`), hogy a bal szélen a szín csoportosítson
bármilyen sorrendben. Ez az RC-standard kódját érinti → 2026-10-03 óta az Overseer repó `rc/` mappájában kell
szerkeszteni, landolni, és MR-ről `rc-watchdog-sync.sh --push --go` (NEM a CIT `~/bin`-jében).
