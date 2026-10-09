# 2026-10-09 — Ingyenes próba C2c: admin próba-sáv (A) + próba-lábléc a többi platform-levélen

**Szál:** próba (koordinátor 31815b5a), SUB C2c (két session egymás után, ugyanaz a fa `~/wt/cit8427dc71`). ADR-0344 „C2c” pont 10–13.

## Elvégezve
- **Admin-sáv** (tulaj A-döntés): `trialAdminState` (`src/trial/admin.ts`), `trialStrip` + `trialLapsedBlock` (`src/server/adminViews.ts`),
  `.adm-trial*` (`public/assets/ui/citui-admin.css`), minden admin-fülön betöltve (`src/server/public.ts`). ≤3 nap warn, „Folytatom” → `/p/<t>/folytatas`,
  kupon-mondat csak élő kuponnal (`liveTrialCoupon`, kiemelve a `notices.ts`-ből).
- **Lelet:** lejárt próbánál az admin eddig SEMMIT nem mondott (nincs subscription sor → a freeze-blokk nem renderelt) → új szünetel-blokk.
- **Befagyasztva:** `assets/design-refs/console/proba-admin-sav/` (mock HTML + A/fizetve PNG-k + README, kötő horgonyok); contract-drift zöld.
- **KB:** `kb/entries/admin-overview/entry.hu.md` új szakasz (sáv + lejárt próba); a tudasbazis-or FLAG-jei (évszám, a Folytatom utáni oldal, látogató-link) javítva.
- **Lábléc:** `src/trial/footer.ts` `footerReasonForTenant()`; jelszó-visszaállítás + a tulaj foglalási levelei (3 `ownerLetter` + `notifyOwner`). Domain/számla/billing levél próbázónak nem megy.
- **Őr** `free-trial-expiry-check`: új ②c (valódi `adminDashboard` 13 fülön), ②b lábléc-láb bővítve; zöld, `--self-test` piros.

## Módosított fájlok
`src/trial/admin.ts` (új), `src/trial/footer.ts` (új), `src/trial/notices.ts`, `src/server/adminViews.ts`, `src/server/public.ts`,
`public/assets/ui/citui-admin.css`, `src/i18n/catalog.json`, `src/email/loginEmail.ts`, `src/tenant/credentials.ts`, `src/booking/requests.ts`,
`scripts/free-trial-expiry-check.mts`, `kb/entries/admin-overview/entry.hu.md`, `assets/design-refs/console/proba-admin-sav/*`, `_planning/decisions/0344-*.md`.

## Nyitott (koordinátor)
- A LEJÁRT (nem fizetett) próbázó is kapja-e a „próbálja ki” láblécet? Ma: csak az aktív.
- A mock „Modulok” kártyájának „csak a próbában volt” címkéi nincsenek bekötve.
- „Az ingyenes próba lejárt.” sáv-szöveg (trial_until után, a 07:00-s lejáratás előtt) — a mockban nem volt.
- Képek (követetlen): `~/wt/cit8427dc71/_report/proba-C2c/`.
