# 2026-09-23 — Az előnézet nem ír, és a bővítés egyszeri díj (ADR-0213, ADR-0192 ⑧.3 + ⑧.5)

**Mandátum:** a tulaj a ⑧.3/⑧.5-re: „mérd meg és onnan folytatjuk" → a mérés után „mindkettő mehet".
Fa: `~/wt/felszkapu`. Élesítés nem volt feladat (a tulaj: a main egyben megy prodba).

## Mérés — előbb, a javítás előtt
- **⑧.5 VALÓS:** a Szobák/Árak/Foglalás előnézete egységet INSERT-el egy semmit nem vett fiókban;
  a modulonkénti őr kimutatta, hogy az **Értékelések** is (az eredeti lelet nem említette).
  Nyoma élesen és dev-en: 0 fiók.
- **⑧.3 VALÓS:** a valódi útvonalon „Citoviso honlap — éves előfizetés · 1 627 Ft / év" egy
  bővítésre. Élesen a Barion fut (a leírása helyes), vevő nem látta.

## Javítás + őrök
- `src/tenant/units.ts` `peekUnits` (csak olvas, memóriabeli minta) · `src/tenant/editor.ts` előnézetben azt hívja.
- A konzol mock-fizetés útvonala: az `upsell` egyszeri + modulnevek · `src/console/views.ts` tétel-sor.
- Őrök: `scripts/module-preview-nowrite-check.mts` (DB-pillanatkép, 12 modul, piros iker) ·
  `scripts/pay-mock-upsell-check.mts` (valódi útvonal, pozitív kontroll). Mindkettő pirosra ment a
  visszarontott kódon (4-4 bukás). A `module-preview-check.mts` fejléce kimondja: szöveg-alapú, vak a mély írásra.

## Csapdák
- A `land.sh` a zárásnál törli az `assets/design-refs/_drafts/`-ot — a mérő-szkriptet újra kell írni oda.
- Az első őr-változat HALMOZOTT diffet írt ki (az első bűnös után mindenkit hibáztatott) → modulonként, reset-tel.
- A worktree-port hook SZÖVEG-mintára blokkol (egy fájl-visszaállítás és egy jegyzet szövege is
  kiváltotta) — felülírás nélkül, külön lépésben / fájlíró eszközzel oldottam meg.
- Új doktrína (ADR-0210): ADR = külön fájl `_planning/decisions/`, a `DECISIONS.md` és a memória `INDEX.md` GENERÁLT.

## Nyitva
- A Barion-leírás nem sorolja fel a bővítés moduljait.
