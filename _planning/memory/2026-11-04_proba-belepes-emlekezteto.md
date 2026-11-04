# 2026-11-04 — Próbázó belépés-emlékeztető (induló SMS + 2./4./6./8. napi e-mail és SMS)

Döntés: ADR-0417 (`_planning/decisions/0417-probazo-belepes-emlekezteto-indulo-sms-2-4-6-8.md`) · ÉLESEN 2026-11-03 16:57 óta (prod 7c803b52, más session élesítette).

## Kiváltó ok
2026-11-03-án mérve: a két éles próbázó (Sáma 10-28, Marilyn 11-02) megkapta a belépő levelet, de egyikük sem kattintott a jelszó-linkre. Telefon-első leadek; a belépés csak e-mailben ment.

## Mi készült
- `src/trial/loginReminders.ts` — induló SMS (l0) a próba indulásakor; l2/l4/l6/l8 e-mail + SMS, amíg nincs jelszó/belépés; mindig friss, egyszer használható jelszó-link; csak hétköznap 9–16; csak a legmagasabb esedékes lépés megy, a régebbiek `skipped`; T−3 napjától nem megy.
- `src/email/loginEmail.ts` — `buildLoginReminderEmail`, `buildLoginStartSmsText`, `buildLoginReminderSmsText`.
- `src/trial/start.ts` (l0 indítás), `scripts/offer-followup.mts` (óránkénti futás), `migrations/0121_free_trial_login_reminder.sql`, `src/db/schema.ts`.
- Őr: `scripts/trial-login-reminder-check.mts` (+ `--self-test`), pre-commit bekötve; a próba-kapuk `SMS_PROVIDER=mock`-ot kapnak (a dev `.env` gammu = valódi SMS).
- Igazítva: `scripts/free-trial-e2e.mts`, `scripts/free-trial-expiry-check.mts` (az l0 SMS is `credentials` sor).

## Eredmény
11-04 09:00: Sáma l8, Marilyn l2 kiment (e-mail + SMS). 12:03-kor még egyikük sem lépett be.

## Megválaszolt kérdések (a MEMORY.md tényei közt)
- Eszkalációs ajánlat: ki kapja, mikor megy.
- Visszamenőleges megkeresés: egyszer ment (próba-kör), a második terv értesítés nélkül.
- A riport nem számolja a sikertelen MMS-t/SMS-t; az SMS kézbesítési jelentés hiányzik (javaslat, nem döntés).

## Nyitott
- Belépnek-e az emlékeztető után (Sáma próbája 11-11-ig).
- SMS kézbesítési jelentés bekapcsolása — tulaj-döntés.
