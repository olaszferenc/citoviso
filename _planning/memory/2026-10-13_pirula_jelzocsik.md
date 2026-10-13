# 2026-10-13 — A pirula-pár a hős-képváltó jelzőcsíkjaira sem ül (ADR-XXXX)

SUB a deploy-koordinátornak (`citfb4ed7ab`), brief: `~/rc-briefs/cinematic-jelzocsik-20261013.md`. Az ADR-0382 záró megfigyelése.

## Mérés a mai mainen (efa76d98)
- 21 sablon × 844×390 / 390×844 / 1280×800 × nyugalom / süti-sáv: a pár 3 állapotban ült a cinematic jelzőcsíkjain
  (fekvő nyugalom, álló nyugalom, asztali süti-sávval). Más sablon első képernyőjén nincs képváltó-jelző.
- Ok: a `blockingRects` a ≥ 100 × 32 px-es gombot látja; a cinematic jelzői szöveg nélküli 44 px-es koppintási felületek
  (rajzuk 4 px-es csík). A `PILL_PROBE` sem látta őket (< 60 px = nem vezérlő).

## Megoldás
- `assets/runtime/cit-configurator.js`: `indicatorRects()` (≥ 2 látható, szöveg/kép nélküli, ≤ 60 px-es testvér-vezérlő
  sorának doboza), `pillControls()` = gombok + jelzősorok, mindkét `findSpot`-menetben és a határra állás gomb-próbájában.
- `findSpot` ③: ha minden oldal foglalt, másik oldalon lép fel, ha oda a cím nem nyúlik be és kevesebb emelés kell.
  Mérési tanulság: a „mindig a legkisebb emelés” a fullbleed/horizontal/artdeco asztalin a cím/bevezető mellé szorította
  a párt (6 px-re a betűktől) → elvetve, csak cím-mentes oszlop.
- Eredmény: jelzőcsík 0 (126 állapot), cím/keretező sáv/hős-gomb 0; csak a cinematic 3 hibás állapota mozdult
  (fekvő 282 → 211, álló 782 → 411 = a cím fölé, asztali+sáv 659 → 621 jobbra a csíkok fölé), a többi 123 pixelre azonos.

## Őr
`mock-trial-overlay-check` ⑪: `DOTS_PROBE` (runtime-független) minden sablon × méret × állapot; „a mérő látja a cinematic
jelzőit” (vak-őr ellen). `--self-test` a `pilldots`/`pillsweep` blokkok kivágásával piros.

## Módosított fájlok
`assets/runtime/cit-configurator.js`, `scripts/mock-trial-overlay-check.mts`, `assets/design-refs/prospect-page/order-pill/README.md` (8.),
`_planning/decisions/XXXX-pirula-par-kepvalto-jelzoire-nem-ul.md`, `MEMORY.md`, ez a jegyzet.
