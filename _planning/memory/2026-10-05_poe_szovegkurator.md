# 2026-10-05 — Poe, a szövegkurátor: kód + konzol + charter + ADR (SUB-lánc, 10 session)

**Kérés (tulaj, a koordinátoron át):** „Nem is programozó kell, hanem szövegkurátori munkatárs” — a mock szövegét
egy perszóna (Poe) írja, az API-őrök egyszer, csak ítélnek. Terv: `szovegkurator/TERV.md` (koordinátor fája).

## Elvégezve (mind origin/main-en)
- `df1a788c` generátor: „generálás kurátori szöveggel” mód (`src/generator/copyCurator.ts`, `GenerateOpts.curatorCopy`),
  őr `scripts/copy-curator-check.mts` (pre-commit, mutációs próba).
- `0f3ad3a2` `scripts/pilot-poe-report.mts` — két ág (AI / Poe) költség/token/gépidő/ítélet, csak olvas.
- `effca0e6` · `bb1801a3` konzol: Forrás-csomag fül, kurátori űrlap a panelben ÉS `/lead/:id/curate?t=a,b`
  (egy komponens), „Poe írta” pirula; terv befagyasztva `assets/design-refs/console/poe-curator/`.
- `e1ba8187` vendég-hang ≥4★ szűrés + földrajzi „medence” ≠ Medence.
- `5873d4bf` KB-szakasz (`kb/entries/console-lead`), haladás-felirat „kurátori szöveg ellenőrzése — AI nem ír”.
- Ez a session: `poe/charter/CHARTER.md`, `RUNBOOK.md`, `ONTOLOGIA.md` (Neo mintájára); `neo/charter/RUNBOOK.md`
  §6 átadó-jegy Poénak; ADR „Szövegkurátor (Poe)” (`_planning/decisions/…-szovegkurator-poe.md`).

## Döntések (az ADR-ben)
D1 = A (kurátor-módban nincs AI-újragenerálás, egy javító kör a szöveg-szerkesztőben), D2 új mód, D3 külön perszóna
(férfi), D5 pilot élesen mindkét ágon; Lektor NINCS; konzol-út, nincs CLI. Jegy Neótól vagy a tulajtól (a tulajé
előbb); szűkös keretnél Neo elsőbbsége; egy Poe, 150k-nál „TÖMÖRÍTHETŐ”.

## Élesítéshez
Migráció NINCS, env NINCS. Élesen kell a `poe` operátor-fiók (+ `~/.config/citoviso/poe-prod-operator.txt`).
⚠️ `fetchPlaceReviews` 30 napnál régebbi véleménynél kapu nélkül hív Places Details-t — pilot-leadeknél előre nézni.

## Nyitott
- D4: előfizetéses keret mint termelési erőforrás — tulaj-döntés a pilot előtt.
- `~/poe/` memória-mappa és a Poe-session indítása (a koordinátoré).
- Javaslat (tudasbazis-or): kb-shot kép a KB-szakaszhoz seedelt fotós fixture-rel.
