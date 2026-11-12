# 2026-11-12 — „Fura üzenetek” az Irányítópulton: saját WhatsApp-képaláírás válaszként

Brief: `~/rc-briefs/uzenetej-20261112-113912.md` · munkafa `cit1a06e53a`.

## Mi volt
A „Válaszok a megkeresésekre” blokkban 11-12 10:14–10:39 között 7 WhatsApp-„válasz” állt
(Apponyi, Helka, Botaniq, Dávid, Gamauf, Vénusz I., Hosszúház) — mind a saját megkeresési
szövegünk. Ok: a telefon (`scripts/s10-a11y/s10_send.py` `status()`) a bal szélen (x1 < 160)
kezdődő buborékot vette bejövőnek; a WhatsApp kép+felirat buborékunk felirata x1=150-nél kezdődik.
Mellékhatás: a lead „válaszolt”-nak számított → nem kapott volna utókövetést
(`src/mms/messenger.ts` „not exists outreach_reply”), és a fék válasz-aránya is torzult.

## Mi történt
- Párhuzamosan egy másik session: telefon-oldali javítás `20b9bb81` (saját buborék = státusz-ikonos),
  9 téves válasz törölve mentéssel, WhatsApp-fiók korlátozás miatt relay+watcher leállítva.
- Ez a session: szerver-oldali második őr `isOwnMessengerText` + `decodeA11yText` (`5502330b`):
  a kimenő `messenger_text`-tel egyező / csonka „bejövő” szöveg kiesik; rövid szöveg csak pontos
  egyezésre. Teszt a `scripts/messenger-relay-check.mts` ⑥ pontjában.
- ÉLESÍTVE a tulaj engedélyével: `prod/20261112-1246` (éles = 5502330b, csak ez az egy commit ment ki).

## Fájlok
- `src/mms/messenger.ts`
- `scripts/messenger-relay-check.mts`
- `MEMORY.md`

## Nyitott
Nincs.
