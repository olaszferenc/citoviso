## ADR-0343 — Próba-belépő a lead-lapon: pirula-pár, `trial_*` esemény-család, a belépő kapuja

**Dátum:** 2026-10-09 · **Státusz:** ELFOGADVA (a terv tulaj-jóváhagyott: „B a legjobb, ahol a két pirula
egyben van.”, 2026-10-09; a szerkezeti döntések a SUB D-é) · **Kapcsolódó:** ADR-0342 (kártya nélküli próba),
ADR-0242 (rendelés-pirula + kikerülés), ADR-0333 (Rendelés-panel mérése), ADR-0291 (a lap maga rögzíti a látogatást),
§B.17, §B.18. Kontraktus: `assets/design-refs/prospect-page/proba-gomb/README.md`.

**Döntések**
1. **Két rögzített elem, egy egység.** A „{n} nap ingyen” (`.cit-cfg-trialpill`) KÜLÖN `position: fixed` gomb a
   `.cit-cfg-launch` mellett — nem közös konténer. Indok: ~18 őr kattintja/méri a `.cit-cfg-launch`-ot, és a
   `configurator-float-check` azt állítja, hogy ő maga fixed; egy pozicionált burok ezt eltörte volna. A pár
   együtt mozog: a kikerülés (ADR-0242 ④) a két pirula UNIÓ-téglalapjával számol, közös alsó éllel; asztalon
   közép → jobb → bal, telefonon (teljes szélesség) csak felfelé lép. JS nélkül (az őr piros öntesztje kivágja a
   blokkot) CSS-ből is értelmes pár-elrendezés marad.
2. **A belépő kapuja a szerveren.** A manifest `trial` blokkja (`enabled`, `days`, `sub`, `url`, `privacyUrl`) CSAK a
   `/p/:token` úton, és csak ha `getFreeTrialConfig().enabled` ÉS a leadnek NINCS semmilyen `free_trial` sora
   (aktív, lejárt, átváltott vagy félbemaradt foglalás egyaránt kizár). Vásárolt lead ezt az ágat el sem éri.
   `trial` nélkül a lap a próba előtti.
3. **Saját esemény-család, nem `panel_open.via`.** `trial_open {via}`, `trial_invalid {fields}`, `trial_submit {via}`,
   `trial_send_failed {status, error}`, `trial_close {seconds}`. A siker rekordja KIZÁRÓLAG a szerver `trial_start`-ja
   (ADR-0342), a kliens nem ír sikert — különben kétszer számolna. Az űrlap aljáról nyitott rendelő-panel:
   `panel_open {via:"trial"}` új via-érték, a riportban saját chip („Próba-űrlapról”).
4. **Amit a vevő lát, azt rögzítjük.** Az ÁSZF-pipa szövege `CFG.billing.termsText` (= `TERMS_ACCEPTANCE_V1`, amit a
   `startTrial` tárol), a fotó-nyilatkozaté a `PHOTO_RIGHTS_DECLARATION_V1`. A telefon-normalizáló kliens-tükre a
   `PHONE_NORM_JS`-ből kerül a lapra, nem kézi másolat.
