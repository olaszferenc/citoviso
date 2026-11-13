# 2026-11-12 — „Kérdése van?” + egy kattintásos indítás: befagyasztás és megvalósítás (SUB cit8e71feb7)

**Döntés:** ADR-0440 (tulaj, a koordinátoron át, 2026-11-12: T2 + 8 pont). Terv: `assets/design-refs/prospect-page/kerdes-inditas/`.

## Mi készült
- **Lead-lap (`/p/<token>`, hideg lead):** a hős után `#ar` blokk — ár-kártya (EGY fő gomb „Indítsa el”, „Megrendelem
  most, próba nélkül”, „Csomagok és modulok”), `#kerdes` harmonika 8 kész válasszal (a lapon, az árlistából és a
  szolgáltató adataiból; nincs LLM/API), egy szabad kérdés mező; csomag-lap (T2); az indító lap a régi próba-űrlap
  helyén (előtöltött kapcsolat, „Módosítom”, egy mondatos click-wrap). A pirula-pár a kérdés-oldalon: „Indítsa el”
  (cián) + „Mennyibe kerül?” (az ár-kártyához görget). `#inditas` és `?k=<kategória>` mélylinkek.
- **Szerver:** `POST /p/<token>/ask` (`src/replies/pageQuestion.ts`, `prospect_question` 0134): 300 kar., 4 mp,
  100/lead/nap, 5 rögzítés/nap, 300/IP/óra, link/cím/szám kiszűrve; az illeszthetetlen kérdés `outreach_reply`
  `page:<id>` sorba megy (tulaj hagyja jóvá, gépi válasz nincs). `startTrial` `modules` (választott csomag) +
  `clickwrap` (`TRIAL_CLICKWRAP_V1`).
- **Telefonszám ki:** platform-levél lábléc, rendelési levél kapcsolat-sor, ADR-0417 emlékeztető-levél.
- **Őrök:** `page-question-check` (új, pre-commit-be kötve), `free-trial-check` ⑮, `trial-login-reminder-check`
  (nincs telefon), `mock-trial-overlay-check` (egy kattintásos lap). KB: `console-dashboard` (Kérdés a terv lapjáról).

## Mellékjavítás
A `mock-trial-overlay-check` ⑪ a main-en is piros volt (card-sidebar 1536×864, süti-sávval a pár a hős
cím-során ült): a `heroTitleRects` a cím alatti rövid, vezérlő nélküli szöveges testvért is akadálynak veszi.

## Eltérések a mocktól (jelentve)
Közvetlen rendelés = a meglévő rendelő-panel a választással; e-mail kötelező maradt; a hős-gomb helyett a
pirula-pár bal tagja; SMS-es érdeklődés-továbbítás nem épült (cit3ea34be2-vel egyeztetve).

## Nyitott
- Jogi oldalak (Impresszum, ÁSZF) telefonszáma MARADT — 45/2014. Korm. r. 11. § fogyasztónál kéri (tulaj-kérdés).
- Élesre semmi nem ment; a deploy külön döntés.

## Fájlok
`assets/runtime/cit-configurator.{js,css}` · `src/replies/pageQuestion.ts` · `src/trial/{start,package,loginReminders}.ts` ·
`src/legal.ts` · `src/generator/configurator.ts` · `src/console/server.ts` · `src/db/schema.ts` ·
`src/email/{platformLayout,orderEmail,loginEmail}.ts` · `migrations/0134_prospect_question.sql` ·
`scripts/{page-question-check,free-trial-check,mock-trial-overlay-check,trial-login-reminder-check,setup-wizard-check}.mts` ·
`hooks/pre-commit` · `kb/entries/console-dashboard/entry.hu.md` · `assets/design-refs/prospect-page/{kerdes-inditas/*,proba-gomb/README.md,arak-gomb/README.md}` ·
`src/i18n/catalog{,-context}.json` · `_planning/decisions/XXXX-kerdes-panel-es-egy-kattintasos-inditas-a-lead-lapon.md`
