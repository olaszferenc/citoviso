# 2026-10-02 — K2: vendég-kritikus hozzátett részlet (SZ2-1), piac-indoklás a kiszállított szövegről (OP-1), Séta-némaság (S-1)

**Szál:** SUB a CIT „élesi teszt” koordinátor alatt (`~/wt/cit87d3f275`); brief `~/rc-briefs/javitas-elek-0930/k2-kritikus-seta-indoklas.md`.
Döntés: ADR-0309 (SZ2-1, OP-1) + ADR-XXXX (S-1, tulaj „A”).

## Lelet (élesen csak olvasva)
- Muschel editorial (0dbcdc91) és séta (333a78ad) mock: a kritikus „fedett” kifogása javítandó volt → PASS; mindkét kártyán
  „bérelhető bicikli/kerékpárok” piac-indoklás, a kiszállított szövegben már nincs.
- Melyik őr fut a kritikus előtt: csak a piac-őr (generateEngine + recopy). Tényhűség/dizájn a renderen → utána.

## Elvégezve
- `src/generator/guestCritic.ts`: `lintAddedDetail`, `normalizeSeverity`, `minorTail`, prompt-sor a hozzátett részletről.
- `src/generator/generateEngine.ts`, `src/generator/recopy.ts`: piac-őr újraítélés a kritikus után (hiba → `error`).
- `scripts/guest-critic-check.mts` ⑦–⑨.

## Mérés
6 mock (Muschel ×2 élesről, Artemisz, Bánó Porta, Három Huszár, Laguna devből), a kiment szövegből, régi vs. új kód.
Régi: Muschel séta „Fedett terasz grillezési lehetőséggel” PASS-szal kiment. Új: mind blokkoló az első körben, a végén egyik sincs.
Bizonyíték (gitignore-olt): `assets/design-refs/_drafts/k2-kritikus/elotte-utana.html` + `nyers/`.

## S-1 (2. kör, tulaj „A”, ADR-XXXX)
- Terv befagyasztva: `assets/design-refs/console/walk-readiness/` (plan.html A-ra szűkítve, README köt).
- Kód: `walkReadiness` / `walkCollage` / `walkSubjectLabel` (`src/engine/templates/walkThrough.ts`), `walkReadinessView`
  (`src/console/tplPreview.ts`), a lead-route átadja, négy nézet-helper + kliens-szkript (`src/console/views.ts`),
  CSS (`public/assets/ui/citui-console.css`), KB `kb/entries/console-lead/entry.hu.md`.
- Őr `scripts/walk-readiness-check.mts` (pre-commit), 8 mutáció piros. Valódi konzolon visszamérve (Carina / Nyugalom / Három Huszár).
- A sárga „elmaradt” kártya-sort devben valódi kártyán nem lehetett látni (nincs elmaradt Séta-mock a dev DB-ben) —
  a helper az őrben ellenőrzött, a zöld „3 lépés” változat a valódi kártyán.

## Nyitott
- Mondat-szintű együttállás határa („kerttel … reggelit szolgál fel”).
- Élesítés: a koordinátoré, a tulaj engedélyével.
