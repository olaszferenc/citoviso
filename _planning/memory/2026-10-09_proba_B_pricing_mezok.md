# 2026-10-09 — Ingyenes próba SUB B: a /pricing „Ingyenes próba” szekciója

**Brief:** `~/rc-briefs/proba-B-pricing-mezok-20261009.md` (koordinátor: CIT fő session `f3e80964`).
**Döntés:** új nincs — az ADR-0342 megvalósítása, kiegészítés az ADR-0342 végén.

## Elvégezve
- `src/trial/config.ts`: `freeTrialFromForm()` (jelenlét-jelölő `trial_present`, kikapcsolva a tárolt számok
  maradnak, normalizálás mint az ADR-0285-ben), `runningFreeTrials()` (`status='active'`, `trial_until > now`).
- `src/console/views.ts`: `freeTrialSection()` + `FREE_TRIAL_SECTION_JS` a „Lead-ajánlatok” alatt; a mentés-gomb
  tiltása mostantól a két szekció közös dolga (`form.dataset.errEsc` / `errTrial`), különben az egyik
  szekció visszaengedné a másik hibáját.
- `src/console/server.ts`: GET átadja a configot + futó-számot; POST a próba-szekciót MINDEN írás előtt ellenőrzi.
- Őr: `scripts/free-trial-config-check.mts` + pre-commit bekötés (szabotázzsal igazolva: a jelenlét-vizsgálat
  kivétele pirosra viszi).
- KB: `kb/entries/console-pricing/entry.hu.md` új „Ingyenes próba — hossz és kupon” szakasz.
- Ellenőrzés: ui-shot mobil + desktop (megnézve), Playwright-kattintás (0 nap, 2,5, 95%, −1, 0% = nincs kupon,
  „20%” normalizálás, eszkalációs hiba + próba közös gomb, kikapcsolás) — JS-hiba 0.

## Megállapítások
- `startTrial` a kikapcsolt próbát már induláskor elutasítja (`disabled`) — nem kellett bekötni.
- A hossz claimkor `trial_until`-ba, a kupon induláskor `offer`-be rögzül → a futó próbák megtartják.
  Kivétel-él: crash utáni folytatásnál a kupon a folytatáskori %-ot kapja.

## Nyitott
- A mock-lap belépője (D SUB) még nincs; neki is a `getFreeTrialConfig().enabled`-et kell olvasnia.
- A KB-képernyőkép (`kb/entries/console-pricing/assets/hu/screen.png`) a régi lapot mutatja.
