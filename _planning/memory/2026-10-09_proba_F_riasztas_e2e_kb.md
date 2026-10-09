# 2026-10-09 — Ingyenes próba, SUB F: élesi riasztások, e2e, „Próba” tölcsér-lépcső, KB

Koordinátor: `f0d3286a` (fa `~/wt/citf3e80964`). ADR: ADR-XXXX (próba üzemeltetése — riasztás, riport, e2e).
Előzmények: ADR-0342 · 0343 · 0344 · 0345.

## Elkészült
- Riasztások: `src/trial/watch.ts` (`runTrialWatch`, óránkénti tick az `offer-followup`-ban), `free_trial_alert` napló
  (`migrations/0100_free_trial_alert.sql`), őr `scripts/free-trial-watch-check.mts` (pre-commit). Öt állapot:
  lejárat-futás késik (26 h) · T−3/T−1/p7 `failed` vagy 1 h-ja `claimed` · 30 perce nem élő site ·
  folytatás 30 perce fizetve, de nincs számla/előfizetés/converted · 15 perce nincs belépő-levél.
- E2E: `scripts/free-trial-e2e.mts` — 53/53 PASS (kétszer). Fordulónap = a fizetés napja (a kód így számol).
- Lejárt próba: Modulok-kártya az Áttekintésen (`data-trial-modules`, a `proba-admin-sav` terv szerint);
  a Teendők-sorban a szünetel-szöveg a „Rendezze a díjat” helyett.
- `/report`: „Kipróbálja-e?” kártya (alapcél 5%), „Próba” + „Próba 14 n.” oszlop; riport-rács asztalon 4+3,
  a Visszatérés/Bontás panel teljes szélességű.
- Mérés (D-ből): a `trial.sub` nem egyezett a `convertLead` slugjával foglalt névnél (`…-a` ígérve, `…-a-2` kapva) →
  `plannedSiteSlug()` (`src/conversion/provision.ts`), `free-trial-check` ⑩.
- KB: új `console-free-trial`; bővítve `console-report`, `console-pricing`, `console-settings`, `admin-overview`.
- Egyetlen valódi SMS (tulaj-engedély): T−3 a teszt-mobilra, gammu ID 335, 174 karakter GSM-7, 2 szelet, mindkettő `SendingOK`.

## Nyitott
- Tulaj-döntés: lejárt próbánál az Állapot-widget „Felfüggesztve”-t ír, nem „szünetel”-t — átírjuk-e?
- A ③ (nem élő site) és ④ (fizetve, de nincs előfizetés) riasztásra nincs gépi pótló, kézi beavatkozás kell.
- `applyWebhookResult` nem kap órát → éjfél körüli fizetés fordulónapja e2e-ben nem tesztelhető.
- Az `admin-overview` KB-cikkhez nincs lejárt-próbás képernyőkép-fixture.
- A pre-commit `help-collapse-check` egyszer „element is not stable”-lel bukott a párhuzamos futásban, egyedül zöld (flake).
- Nem élesítve (nagy deploy).

## Fájlok
`src/trial/watch.ts` · `src/trial/admin.ts` · `src/console/reportData.ts` · `src/console/reportViews.ts` ·
`src/console/server.ts` · `src/console/views.ts` · `src/server/adminViews.ts` · `src/conversion/provision.ts` ·
`src/db/schema.ts` · `src/i18n/catalog.json` · `migrations/0100_free_trial_alert.sql` ·
`public/assets/ui/citui-admin.css` · `public/assets/ui/citui-console.css` · `scripts/free-trial-e2e.mts` ·
`scripts/free-trial-watch-check.mts` · `scripts/free-trial-check.mts` · `scripts/free-trial-expiry-check.mts` ·
`scripts/offer-followup.mts` · `scripts/report-mock-check.mts` · `scripts/i18n-scope.mts` · `scripts/kb-check.mts` ·
`scripts/kb-shot.mts` · `hooks/pre-commit` · `kb/entries/{console-free-trial,console-report,console-pricing,console-settings,admin-overview}/` ·
`assets/design-refs/console/{proba-admin-sav,riport}/README.md` · `_planning/decisions/XXXX-ingyenes-proba-uzemeltetes-riasztas-riport-e2e.md`
