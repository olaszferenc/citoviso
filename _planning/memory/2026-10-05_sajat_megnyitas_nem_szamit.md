# 2026-10-05 — A tulaj saját mock-megnyitása nem számít (`?sajat=1`)

**Kérés (brief `mocklink-megnyit-ssz-ml-l-20261005-133738.md`):** „Biztos, hogy jól működik a megnyitások
számlálója? … amit a Citoviso e-mail-címemre és SMS-ben megkaptam, azt én is megnyitottam, és nem mozdult.”
Majd: „Az a jó, ha a tulajnak küldött mock-megnyitások nem számlálódnak.” → „Elfogadom a javaslataidat.”

## Mérés (éles, nginx + DB, olvasás)
- A számláló működik, csak emberi jelet számol (ADR-0291). Élesen 1 `mock_view` volt: Napfény Villa 11:12:54
  Android, 8 mp-cel a Google Messages előnézete után → a tulaj SMS-másolata, a lead látogatásaként számolva.
- Yorki 11:34 Android, Oleander 11:10 Windows (a konzolból): betöltés, `/view` nélkül → nem számított.
- Az e-mail-másolat (Bcc) linkjére nem jött kattintás.

## Elvégezve
- `?sajat=1` jelölés (ADR-XXXX): a lap beacon nélkül szolgálódik ki; SMS-másolat, külön e-mail-másolat
  (List-Unsubscribe nélkül), konzol-link, Tevékenység „a látott oldal ▸”, levél-előnézet jelölt; a „link másolása” jelöletlen.
- Élesen (tulaj-engedéllyel): a Napfény 11:12-es látogatás törölve, prospect `opened` → `sent`;
  mentés `/opt/citoviso/backups/sajat-megnyitas-20261005-114606/`.
- Őrök: `mail-link-get-safe-check` ⑦, `pilot-copy-check` ④ (+ pre-commit trigger: email/sender, prospectPath). Súgó bővítve.

## Fájlok
- src/console/prospectPath.ts · src/console/server.ts · src/console/views.ts · src/outreach/pilotCopy.ts ·
  src/email/sender.ts · scripts/mail-link-get-safe-check.mts · scripts/pilot-copy-check.mts · hooks/pre-commit ·
  kb/entries/console-outreach-draft/entry.hu.md · _planning/decisions/XXXX-sajat-megnyitas-nem-meres.md

## Nyitott
- Élesítés a nagy deployjal (nem külön).
