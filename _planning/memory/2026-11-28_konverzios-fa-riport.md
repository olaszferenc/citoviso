# 2026-11-28 — Konverziós mechanizmusfa a Riportban (ADR-0510 felülete, SUB `cit0fe2afff`)

Brief: `~/rc-briefs/konverzios-fa-riport-20261128.md` (koordinátor: `cit96bd8170`-utód). Terv: `assets/design-refs/console/konverzios-fa/` B · Folyam, animáció nélkül (tulaj „ok”, 11-28).

## Elvégezve
- **Adat** (`src/console/reportData.ts`, ugyanaz a fold): `treeVisitFacts` (6 félig görgetett, 7 ajánlat-esemény, látogatási napok), `treeCounts` („legalább idáig jutott” állapotok), `foldTree` (postafiók-szűrő `mb`, heti trend élőben, feladatok „után” száma csak mért kohorsz után: ≥7 napos küldések, ≥30 a szülő-állapotban). `getReportData(…, mailbox)`, `foldReport(…, tree)`; csak az első kör.
- **Fa-szerkezet** egy helyen: `src/console/conversionTree.ts` (állapotok, okok, karok stabil azonosítóval, a doksi szavaival); őr `scripts/conversion-tree-check.mts` (+ `--self-test`, 6 eltérés-osztály piros), pre-commitba kötve.
- **Aktív feladatok**: `migrations/0163_conversion_task.sql`, `scripts/conversion-task.mts add|close|list [--levers|--all]`; hiányzó tábla esetén a konzol kimondja (0163 nincs felvéve), nem hibaoldal.
- **Felület**: `src/console/conversionTreeViews.ts` (szerver-renderelt, linkek + kis inline JS az azonnali váltáshoz), CSS `citui-console.css` (`.kf-*`, `@container` 640/720), ikonok `src/ui/icons.ts`.
- **Működés-őr**: `scripts/conversion-tree-fold-check.mts` (szintetikus pilot az éles számsorra; vakfolt sosem nulla; „után”; üres állapot; nincs animáció), pre-commitba kötve.
- **Súgó**: `kb/entries/console-report-tree/` (kép a `kb-shot.mts`-ből).

## Mérve
- Éles fold, csak olvasás (`default_transaction_read_only=on`), e-mail, 11-09…28: **1797 → 328 → 224 → 32 → 1 → 0**; válasz 44, leiratkozás 22, visszatérő 40, levélnyitás 69/184. A brief 339/229-e bot-nyitásokkal számolt; a riport definíciója bot-mentes, és 3 lead 7-ben volt 6 nélkül.
- Playwright (fixture, 1280 + 390): 36/36 lépés zöld, JS-hiba 0. Valódi `/report` útvonal ui-shot: scratch DB-n (0163 + feladatok) és dev DB-n (tábla nélkül).

## Nyitott
- Migráció a dev DB-re a land UTÁN (`citoviso_kf_scratch` scratch DB törölhető).
- Az első feladatot a tulajjal választják ki (`conversion-task.mts add`).
- Élesítés a koordinátoré, a gépköltözés után.
