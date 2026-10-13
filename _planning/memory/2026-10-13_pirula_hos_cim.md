# 2026-10-13 — A pirula-pár nem ül a hős-címen (tulaj „A”, ADR-XXXX)

SUB a deploy-koordinátornak (`citfb4ed7ab`), brief: `~/rc-briefs/pirula-elhelyezes-20261013.md`.

## Mérés a mai main-en (465e5394) — ÁLLT
- 844×390 fekvő: a telefon-szabályok (≤560 px) nem élnek → asztali közép-hely és méret; a ~455 px-es próba+rendelés pár
  nyugalomban is a hős-szövegre ült (dark-luxury: a bevezető soron).
- 390×844 álló, süti-sáv kint: a sáv a saját magasságával emeli a párt → dark-luxury-n a bevezetőre, a 09-29-i Laguna arch-frames-en a címre.

## Megoldás
- `assets/runtime/cit-configurator.js`: `isLandscapePhone()`, `sideSlots()` fekvőn csak `"r"`; `pairLayout()` fekvőn egymás alatt
  (fent próba, azonos szélesség, 6 px rés); `heroTitleRects()` = `h1` + testvér-`p` szöveg-csomópontjainak sorai, sorköz nélkül,
  állón 6 / fekvőn 3 px réssel — fekvőn mindig, állón csak süti-sávval; `pillObstacles()` csak a `placeLaunch`-ban (a kérdés-sáv
  `placeFb`-je változatlan).
- `assets/runtime/cit-configurator.css`: fekvő-telefon media: telefonos pirula-méret, 44 px, alul 14 px.
- Kontraktus: `order-pill/README.md` 5–6. pont, `proba-gomb/README.md` 1. pont kivétele (fekvőn egymás alatt).

## Mérési tanulságok
- A `range.selectNodeContents(h1).getClientRects()` a blokk-gyerekek dobozát is visszaadja (gate-opening: 785 px széles a 288 px-es
  szóhoz) → csak szöveg-csomópontokat mérj.
- A sordoboz sorköze + AVOID_GAP 4 px-en múlva a menü-gombig emelte a párt (aurora, claymorphism) → a betűkhöz mérni.
- Bal oldalra váltva fekvőn az editorial menüsorára ült („A ház”) → fekvőn csak jobb oldal.

## Őrök (mind zöld)
`mock-trial-overlay-check` (277 ✓, új ⑪; `--self-test` a ⑪-et is pirosra viszi), `lead-mobile-check --gate`,
`configurator-float-check`, `lead-page-surface-check`, i18n-lint, design-token-lint.

## Nyitott
Álló telefonon sáv NÉLKÜL és asztalon néhány sablonon (fullbleed, dark-luxury, parallax, horizontal, card-sidebar; asztal: fullbleed,
horizontal, artdeco) a pár a hős-gombsor fölé lépve a bevezető sorra ül (ADR-0242 ④). Az „A” erre nem döntött — tulaj-kérdés, ha kell.

## Módosított fájlok
`assets/runtime/cit-configurator.js`, `assets/runtime/cit-configurator.css`, `scripts/mock-trial-overlay-check.mts`,
`assets/design-refs/prospect-page/order-pill/README.md`, `assets/design-refs/prospect-page/proba-gomb/README.md`,
`_planning/decisions/XXXX-pirula-par-fekvo-telefonon-sarokban-cimet-nem-takar.md`, `MEMORY.md`, ez a jegyzet.
