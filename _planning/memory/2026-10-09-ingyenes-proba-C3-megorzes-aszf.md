# 2026-10-09 — Ingyenes próba C3: 90 napos adatmegőrzés + törlés (száraz) + ÁSZF 1.4 (ADR-0345)

SUB (koordinátor `31815b5a`), két session ugyanabban a fában (`~/wt/cit3cce0441`, átadással).

## Kész, landolva (`451cdca9`)
- **Motor** `src/trial/retention.ts`: törlés napja = a próba utolsó Budapest-napja + 90 (= a kupon lejárata);
  `p7` figyelmeztetés −7, hétvége → VISSZA péntekre; késő levél a törlést tolja (`effectivePurgeDay`).
  `purgeExpiredTrials`: csak `lapsed` + nem konvertált, csak ELKÜLDÖTT `p7` után ≥7 nappal; 5 fizetett nyomnál
  MEGTAGAD (napi tick nem-nulla kód → OnFailure levél); `DELETE tenant` kaszkád + `sites/<id>`; `free_trial` → `purged`
  + `purge_report`; a lead `conversion` → `qualified` (koordinátor-döntés). A `free_trial` sor marad (jogalap az ADR-ben).
- **Migráció 0099**: `free_trial.tenant_id` FK → SET NULL; `purged` státusz, `purged_at`, `purge_report`; notice `p7`.
- **ÁSZF 1.4** (`src/legal.ts`), hatályos 2026-10-09.
- **Őr** `scripts/free-trial-retention-check.mts` (+ `--self-test`), pre-commit: retention/start, tickek, CLI, MINDEN migráció
  (katalógus-láb: a tenant-kaszkád fa ⊆ PURGE_TABLES ∪ blocker ∪ NOT NULL-lal blockerhez kötött).
- **Ütemezés szárazon**: napi `billing-cycle.ts` (`purgeExpiredTrials` dryRun), CLI `scripts/free-trial-purge.mts [--go]`.
- Javítva útközben: a `countRaw` a nem hivatkozott `$1`-et is átadta → „could not determine data type” (a lead-blocker
  az első esedékes jelöltnél elhasalt volna); a `p7` sor dátuma a futás `now`-ja (ettől számít a 7 nap).

## Ebben a commitban
- Óránkénti `scripts/offer-followup.mts`: `runPurgeWarnings(now, null, {dryRun:true})`.

## 3. session — a törlés-levél (tulaj-döntés: „A”) élesen a tickben
- `buildPurgeWarningEmail` (`src/email/trialEmail.ts`), `sendPurgeWarningEmail` / `purgeWarningDeps` (`src/trial/notices.ts`),
  `scripts/offer-followup.mts` a bekötött küldővel; a napi purge SZÁRAZ marad (nagy deploy + külön engedély).
- „megmarad” → „a próbaidő végétől számított 90 napig” (`trialEmail.ts` stay, `loginEmail.ts` próba-mondat) + KÖTŐ idézetek
  (`proba-levelek/README.md` 6–7.).
- Terv befagyva: `assets/design-refs/console/proba-torles-level/` (valódi építővel renderelt `level-*.html` + jóváhagyott PNG-k).
- Őr: `free-trial-retention-check` ②b (a bekötött levél: valós napok 7/9, törlés-nap, link, kupon / kupon nélkül, tick-bekötés).

## Nyitott
- A napi purge élesítése (`dryRun` le) — a nagy deployjal, külön tulaj-engedéllyel.
- A G SUB egyesített kuponja: a levél kupon-mondata `liveTrialCoupon`-ból olvas; ha a G más megnevezést ad, igazítani.

## 3. session — a lejárt-próba admin-blokk határideje (koordinátor-kérés, külön commit)
- `trialLapsedBlock` (`src/server/adminViews.ts`): a „Mi maradt meg” alatt a törlés NAPJA + „előtte levélben szólunk”
  (a 'p7' után: „erről levelet is küldtünk”); a „A szünet addig tart, amíg nem folytatja.” kivezetve (§B.17).
- `TrialAdminState.purgeIso` / `purgeWarned` (`src/trial/admin.ts`): `purgeDay`, kiment 'p7' után `effectivePurgeDay`.
- KÖTŐ idézetek: `assets/design-refs/console/proba-admin-sav/README.md` 7. pont; KB: `kb/entries/admin-overview`.
- Őr: `scripts/free-trial-expiry-check.mts` — a törlés napja mindkét ágon (tervezett + késve ment 'p7').

## Tanulság
- Követetlen `_report/` a fában → a land utó-feltétele „idegen fájl változott” + hamis „rebase-konfliktus”: land idejére
  a fán kívülre parkolni.
- A `gate-runner-check` J-lába (8 s csend-korlát) 22-es terhelésnél hamis pirosat ad; egyedül zöld.
