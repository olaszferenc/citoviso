# 2026-10-09 — Ingyenes próba, SUB C2: a jóváhagyott levelek bekötése

Koordinátor: `31815b5a`. Döntés: ADR-0344 kiegészítés (C2 szakasz), új ADR-szám nélkül. Élesre semmi (nagy deploy).

## Elvégezve
- **Terv befagyasztva:** `assets/design-refs/console/proba-levelek/` — a jóváhagyott PNG-k (T−3, T−1, belépő; mobil +
  asztali), a VALÓDI építőkkel renderelt `level-*.html`, `proba-levelek.html` (levél- és méretváltó), README (kötő
  feliratok, Hatókör; contract-drift-check zöld).
- **T−3/T−1 e-mail ÉLES** (kódban): `src/email/trialEmail.ts` (`buildTrialNoticeEmail`), `src/trial/notices.ts`
  (`sendTrialNoticeEmail`, `trialNoticeDeps` — `sendSms: null`), `scripts/offer-followup.mts` a bekötött deps-szel.
  Tenant-postafiókba naplózva (`tenant_message` kind `other`, related `free_trial_t3|t1`).
- **SMS SZÁRAZ:** `runTrialNotices` null `sendSms`-re se nem küld, se nem foglal SMS-sort (a kimaradt lépcsőnek sem).
- **Próbás belépő-levél:** `buildCredentialsEmail({ trial })`, `issueAndSendTenantLogin(…, trial)`, `startTrial` adja.
- **Lábléc:** `platformMail({ footerReason: "trial" })` → „…a Citovisónál próbálja ki.” (`T()`, katalógus frissítve).
- **Dátum-segédek** (`src/text/day.ts`): `formatDayOn` („2026. október 22-én, csütörtökön”), `formatDayLongStem`,
  `formatDayShortWeekday`, `formatDayShortStem` — ISO napból, magyarul tiszta string-transzform.
- **Őr** `free-trial-expiry-check` ②b (14 új állítás); `--self-test` 8 pirossal.

## Mért tények / döntések menet közben
- A „Holnap lejár” hétvégi eltolásnál hazudna (hétfői lejárat T−1-e pénteken megy) → a cím a valós napszámot mondja
  („Még 3 nap…”). A lejárat napján menő pótlásra „Ma lejár…” — ez a forma nem szerepelt a mockban.
- Üres `PUBLIC_BASE_URL` / hiányzó prospect-token → a küldés `failed` (a lépcső elég); a gomb nélküli levelet nem küldjük.

## Nyitott (tulaj)
- SMS-forma (link/ékezet) és admin-sáv (A/B) — a tulajnál.
- „Ma lejár…” forma jóváhagyása.
- A próba alatti egyéb platform-levél (jelszó-visszaállítás) lábléce még „rendelte meg”.

## Fájlok
`src/email/trialEmail.ts` · `src/email/loginEmail.ts` · `src/email/platformLayout.ts` · `src/trial/notices.ts` ·
`src/trial/expiry.ts` · `src/trial/start.ts` · `src/tenant/credentials.ts` · `src/text/day.ts` ·
`scripts/offer-followup.mts` · `scripts/free-trial-expiry-check.mts` · `src/i18n/catalog.json` ·
`assets/design-refs/console/proba-levelek/*` · `_planning/decisions/0344-…` · `MEMORY.md`
