# 2026-10-13 — Riasztó SMS csendes óra (22–07) + reggeli összesítő; éjjeli SMS-források felmérése (ADR-0376)

SUB `cit6e0f9c28` a „deploy” FŐ session alatt; brief `~/rc-briefs/riaszto-sms-ejjel-20261013.md`.
Tulaj: „Igen erre a számra [+36 30 516 1631]. Éjjel nagyon jönnek az SMS-ek.”

## Elkészült
- `src/console/houseAlert.ts`: `SMS_QUIET_FROM_HOUR`=22 / `SMS_QUIET_TO_HOUR`=7, `smsQuietHours()` (budapesti óra);
  éjjel az SMS-döntés `night` sor, SMS nem megy (a „mail-down” sem); `flushNightSmsDigest(now)` + `nightDigestText()`.
- `scripts/offer-followup.mts`: az óránkénti tick saját try-ban küldi a reggeli összesítőt.
- `migrations/0109_house_alert_sms_night.sql`, `src/db/schema.ts`: `night` / `night_digested` státusz.
- `scripts/stall-alert-check.mts` ⑦ (+ a ①–⑥ rögzített déli órán fut); régi kódon 6 FAIL; `hooks/pre-commit` a 0109-re is.
- ADR, `_planning/DEPLOY-READY.md` 4b.3 + tábla, `MEMORY.md` Tények és döntések.

## Felmérés (10-06…10-13, csak olvasás)
| Forrás | Éjjel (22–07) | Nappal | Csendes óra ma |
|---|---|---|---|
| Kiküldés-másolat SMS (`OUTREACH_COPY_PHONE`, élesen törölve 10-08) | 0 | 116 | 9–16 ablak |
| Kiküldés-másolat MMS | 0 | 139 | 9–16 ablak |
| „desztillalo” heti jelentés (crontab `0 4 * * 0`, `notify.mts`) | **1 (2 részes), 10-11 04:05** | 0 | NINCS |
| Próba-értesítő (tulaj teszt-leadként) | 0 | 1 | 8–20, de élesen `MOBILE_SEND_WINDOW_OFF=1` |
| Operátor-riasztások (AAM, fizetési link, próba-őrszem, domain, ADR-0374) | 0 | 0 | NINCS (élesen nincs riasztási szám) |
| Lead-válasz, MineREAL relay, bejövő-továbbítás | 0 | 0 | — |
Forrás: gammu `minereal_sms.sentitems` (a modem minden kimenő SMS-e), éles `sms_outbox`/`mms_outbox`, mms-relay napló.
A „sok éjjeli SMS” ezekben nem látszik — lehet más szolgáltatás, szolgáltatói továbbítás vagy MR/OF; nem igazolt.
Az `/etc/gammu-smsdrc` és a teljes rendszernapló jogosultság miatt nem volt olvasható.

## Nyitott (tulaj dönt)
- a „desztillalo” jelentés vasárnap 04:05 helyett 07:00 után (vagy csak levél);
- az éles `MOBILE_SEND_WINDOW_OFF=1` kikapcsolása (ideiglenes teszt-kapcsoló 09-30 óta);
- a többi operátor-riasztás (AAM, próba-őrszem, domain-őr) ugyanígy csendes órába — élesítéskor, ha kap riasztási számot.

## 2. kör (tulaj-döntések, ADR-XXXX)
- Desztilláló: user-crontab `0 4 * * 0` → `0 8 * * 1` (igazolva `crontab -l`); a `_planning/DOMAIN/04-INDEX.md` („vasárnap 04:00”) és a `domain-inbox-freshness-check.mts` kommentje NEM frissült: mindkettő érintése a ma piros (23 napos inbox) freshness-kaput tüzeli — a következő DOMAIN-átvezetéskor javítandó.
- `MOBILE_SEND_WINDOW_OFF`: DEPLOY-READY §6 sor (élesen törlendő, a koordinátor viszi); `src/sms/sendWindow.ts` komment.
- Közös út: `src/console/smsQuietHours.ts` + `src/console/operatorSms.ts`; bekötve: aamAlert, payLinkAlert (×2),
  pairRepair, registryConfirmWatch, moduleRequirements, multilangResume, trial/watch. Őr ⑧ (régi kódon 9 FAIL).
