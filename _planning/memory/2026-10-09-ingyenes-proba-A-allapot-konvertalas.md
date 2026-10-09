# 2026-10-09 — Ingyenes próba SUB A: próba-állapot + kártya nélküli konvertálás (backend)

**Szál:** koordinátor `f3e80964`, brief `~/rc-briefs/proba-A-allapot-konvertalas-20261009.md`. Döntés: ADR-0342.

## Elvégezve
- `free_trial` tábla + `module_entitlement.trial_grant` (0097); a próbázónak nincs subscription sora → a billing-tick nem lát rá.
- `startTrial()` + `POST /p/<token>/trial` (név, e-mail, telefon, ÁSZF-pipa, fotó-jog pipa, viewId?) — idempotens, vásárolt lead elutasítva.
- Full modul (trial_grant), 1 kupon (scope=purchase), outreach-ajánlat lezárva, `trial_start` esemény.
- `getFreeTrialConfig()` (app_setting `free_trial`, 14/25).
- Fizetéskor: `ensureSubscriptionForOrder` → `free_trial.status=converted`; `syncEntitlementsToPaid` leveszi a trial-jelet a megvettekről.
- Őr: `scripts/free-trial-check.mts` (+ `--self-test` szabotázzsal), pre-commit bekötve.

## Módosított / új fájlok
migrations/0097_free_trial.sql · src/db/schema.ts · src/trial/config.ts · src/trial/start.ts · src/console/server.ts ·
src/tenant/editor.ts · src/tenant/paidEntitlements.ts · src/payment/subscription.ts · scripts/free-trial-check.mts ·
hooks/pre-commit · _planning/decisions/XXXX-…

## Nyitott (a C SUB-nak / tulajnak)
- Folytatás-fizetés: az `ownedSiteForLead` a próbázót „provisioned/live” tulajnak látja → a `/p/<token>` checkout ma ELUTASÍTANÁ. A C SUB folytatás-útja kell (és ott a tenant-kupon bekötése).
- Freeze: `isSubscriptionFrozen()` subscription-alapú; a lejárt próbára a C SUB-nak `trialForTenant()`-ből kell döntenie.
- A belépő-levél szövege fizetett vásárlásra íródott — próbára ellenőrizni (C/D).
- ÁSZF-pont a próbáról (1.3 → 1.4) — tulaj.
