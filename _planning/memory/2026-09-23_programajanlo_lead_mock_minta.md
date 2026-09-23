# 2026-09-23 — Programajánló minta a lead-mockban (C változat)

**Szál:** `wt/cit08ae3378`, brief: `~/rc-briefs/programajanlo-lead-mock-brief.md`. Döntés: ADR-XXXX.

## Elvégezve
- §2b: 3 vázlat (A pirula+mondat · B kitöltendő mezők · C pirula nélkül, jelölés a bevezetőben) a
  Villa Suzy Zamárdi valódi mock-arculatában; a tulaj a **C**-t választotta.
- `programsSampleBlock()` váltja a régi `poiSampleBlock()`-ot (`src/engine/moduleSections.ts`):
  10 évszak-független program-típus, „a környéken”, nincs km/Forrás; a bevezető a `place.city`-t viszi.
- Dátumtolás a nézés napjára: `shiftSampleDates()` az `assets/runtime/cit-runtime.js`-ben.
  Mérve Playwrighttal: 2027-02-10-i nézés → „11 febr. csütörtök”; JS nélkül a render-napi dátum; 0 JS-hiba.
- Őrök: `module-render-check` új állítás; `native-content-check` + `configurator-placement-check`
  a poi jelölését név szerint kérdezi (negatív kontroll piros).

## Fájlok
- `src/engine/moduleSections.ts`, `assets/runtime/cit-runtime.js`, `src/i18n/catalog.json`
- `scripts/module-render-check.mts`, `scripts/native-content-check.mts`, `scripts/configurator-placement-check.mts`
- `assets/design-refs/public-site/programajanlo/minta/` (README + html + 2 kép)

## Nyitott
- A már kiküldött/legenerált mockok statikusak: a régi mintát viszik, amíg nincs `rerender-mock`.
- A tenant-admin „Megnézem” előnézete is ezt a mintát mutatja (ugyanaz a renderer).
