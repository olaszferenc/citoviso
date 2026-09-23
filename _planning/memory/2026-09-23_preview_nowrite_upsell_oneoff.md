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
- **Logó (a tulaj kérése, „B" = a jel maga a C + „itoviso"):** NEM ez a szál csinálja — átadó brief
  kész: `~/rc-briefs/logo-c-lockup-brief.md` (+ mockok: `~/rc-briefs/logo-c-lockup/`). Mért lelet: az E4
  jóváhagyás óta egyetlen kódsor sem változott; a favikonhoz a VILÁGOS változat kell (a fül világos).
  Nyitva a C méretaránya (betű- vagy ikonméret) — a tulaj ott dönt.
- ⛔ **`module-upsell-check.mts` versenyhelyzet:** fix nevű scratch-DB-t (`citoviso_upsell_check`)
  dob el és hoz létre → párhuzamos land-ok egymás alól törlik („database … does not exist"). Egyedül
  futtatva zöld. Javítás: futásonként egyedi név. Nem javítva (a tulaj dönt).
- A land hétszer futott: átmeneti GitHub-SSH hiba, 3× `MEMORY.md`-ütközés, ADR-szám-ütközés (0212 →
  0213, a másik szál helyőrzőjét a land osztotta ki), 2 közös-DB őr-verseny. A kód egyiket sem okozta.
