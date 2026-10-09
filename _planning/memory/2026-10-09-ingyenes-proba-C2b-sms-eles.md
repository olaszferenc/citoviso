# 2026-10-09 — Ingyenes próba C2b: a T−3/T−1 SMS élesítve (ékezet nélkül, linkkel)

**Szál:** próba (koordinátor 31815b5a), SUB C2b, fa `~/wt/cit8427dc71`. ADR-0344 „C2b” pont 7–9.

## Elvégezve
- `trialNoticeDeps` SMS-küldője él: `sendTrialNoticeSms` (`src/trial/notices.ts`), szöveg
  `buildTrialNoticeSmsText` (`src/email/trialEmail.ts`) — a mock szövege, T()-ből, utána GSM-7-re hajtva.
  T−3 = 176 kar./2 szelet, T−1 = 139 kar./1 szelet. Túl hosszú névnél: záró mondat ki, név „...”-tal rövidül, link soha.
- **Lelet:** a modem (`injectViaGammu`) MINDEN SMS-t `-unicode`-dal küldött → ékezet nélkül is 3 szelet lett volna.
  Új `src/sms/encoding.ts` (`isGsm7`, `smsEncoding`, `toGsm7`); tiszta GSM-7 szöveg most 7 biten megy.
- `src/text/day.ts`: `formatDayShortOn` („okt. 22-én”).
- Őr `scripts/free-trial-expiry-check.mts` ②b átírva (SMS él, GSM-7, ≤2 szelet, link, napló, modem-arg); zöld; `--self-test` piros (13).

## Módosított fájlok
`src/sms/encoding.ts` (új), `src/sms/sender.ts`, `src/trial/notices.ts`, `src/trial/expiry.ts`, `src/email/trialEmail.ts`,
`src/text/day.ts`, `src/replies/answerRules.ts` (komment), `src/i18n/catalog.json`, `scripts/i18n-scope.mts`,
`scripts/free-trial-expiry-check.mts`, `_planning/decisions/0344-*.md`.

## Nyitott (az utódnak — ugyanebben a fában)
- Admin próba-sáv (A változat) befagyasztása + bekötése + KB + ui-shot.
- Koordinátor 10-09: a próba alatti egyéb platform-levél (jelszó-visszaállítás, foglalási kérés a tulajnak) lábléce
  „próbálja ki” legyen, ha a fióknak aktív próbája van.
- A GSM-7 modem-váltás valódi telefonon még nincs lemérve (élő SMS-t nem küldtem).
