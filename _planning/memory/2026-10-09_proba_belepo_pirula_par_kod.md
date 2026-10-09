# 2026-10-09 — Ingyenes próba, SUB D: a „{n} nap ingyen” pirula-pár + próba-űrlap (KÓD)

Koordinátor: `f3e80964` (Ingyenes próba). Terv: `assets/design-refs/prospect-page/proba-gomb/` (B, tulaj-jóváhagyás).
ADR: ADR-0343 (pirula-pár, `trial_*` események, a belépő kapuja).

## Elkészült
- Pirula-pár a `cit-configurator.js/.css`-ben (próba balra, navy + ajándék-ikon; rendelés jobbra, változatlan);
  a kikerülés a PÁR unió-téglalapjával; telefonon teljes szélesség (12 px szél), ≤380/≤340 px-en szűkül (320-on ikon nélkül).
- Próba-űrlap (telefonon alsó lap, asztalon ablak): tények, név/e-mail/telefon, ÁSZF + fotó-nyilatkozat pipa,
  blur→Küldés csendes (README 9), szerver-hibakódok saját mondattal, siker `loginSentTo` + `trialUntil`.
- Manifest `trial` blokk a `/p/:token`-on (bekapcsolva + nincs `free_trial` sor). Riport: `panel_open.via=trial` chip,
  `trial_*` eseménycímkék. Ikon `gift` az `src/ui/icons.ts`-ben. i18n katalógus +54.
- Őrök: `lead-page-surface-check` ② mindkét pirulát méri + „a pár egyben áll” + új piros önteszt ④e;
  `lead-mobile-check` R8 mindkét tagra + R9 (próba-pirula koppintható) + „trial-on-bar” önteszt.
- Ellenőrzés: Playwright végigkattintás a valódi `/p/mFvp…` lapon elfogott POST-tal (dev DB-be nem írt), JS-hiba 0;
  képek `assets/design-refs/_drafts/proba-kod/` (gitignore).

## Nyitott (a koordinátornak)
- A sikerképernyő kötött mondatai („3 és 1 nappal előtte e-mailben és SMS-ben szólunk”, „a {n}. nap után szünetel”)
  a lejárat-kezelő szálon múlnak — amíg az nem landol, ezek ígéretek (§B.17).
- Ha a belépés-levél nem ment ki (új próbánál `loginSentTo: null`), a lap „munkatársunk elküldi”-t mond; a szerver csak naplóz.
- A `sub` a `preview_label`-ből jön; nem mértük, hogy a `convertLead` ugyanazt a slugot adja-e.
- Nem élesítve (nagy deploy).

## Fájlok
assets/runtime/cit-configurator.js · assets/runtime/cit-configurator.css · src/generator/configurator.ts ·
src/console/server.ts · src/console/reportData.ts · src/console/reportViews.ts · src/console/views.ts · src/ui/icons.ts ·
src/i18n/catalog.json · scripts/lead-page-surface-check.mts · scripts/lead-mobile-check.mts ·
assets/design-refs/prospect-page/proba-gomb/README.md
