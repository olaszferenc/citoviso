# 2026-10-08 — Riport „Mock” fül: melyik mock mennyire vonzó (SUB)

**Kérés:** a koordinátor briefje (`~/rc-briefs/mock-tab-megvalositas-20261008.md`); a terv (B + C hibrid) a tulaj jóváhagyásával befagyasztva: `assets/design-refs/console/mock-tab/` (`f6e2f0a5`).

**Elvégezve (2 session-szakasz, ugyanabban a fában):**
- `GET /report/mock` (`src/console/server.ts`), nav 3. levél (`src/console/nav.ts`), közös fülsor Tölcsér · Viselkedés · Mock (`reportTabs()`), lap `reportMockPage()` (`src/console/reportViews.ts`)
- adat `src/console/reportData.ts`: `ProspectFacts` + `leadId`/`template`/`replied` (`loadReplied`), tiszta `foldMockReport`, `mockScore`, `wilson`, `mockVerdict`, `sortMockRows`, `mockRowMatches`; CSS `.rpm-*` a `public/assets/ui/citui-console.css` végén
- őr `scripts/report-mock-check.mts` (+ `--self-test`), bekötve a `hooks/pre-commit`-ba
- KB: `kb/entries/console-report/entry.hu.md` „Mock — melyik mock mennyire vonzó” + `assets/hu/mock.png` (kb-shot.mts kiegészítve)
- ui-shot 390 + 1280 megnézve; Playwright a fixture-lapon (kártya-szűrés, kereső, rendezés, „Több mutatása”, JS-hiba 0)

**Eltérések a tervtől:** az első fül „Tölcsér” maradt (a KB-idézők miatt); Mock-fül alapidőszak „Összes”; csatorna-felirat „E-mail + SMS/MMS” (a tény-réteg nem különíti el); a pont-jelvény színe inline `color-mix()` (a token-lint a `--p` változót tiltja).
**Megjegyzés:** ismeretlen `?tpl=` (pl. a dev DB-ben nem szereplő `gate-opening`) szándékosan „Minden sablon”-ra esik vissza.

**Nyitott:** élesítés a nagy deployjal; a dev DB-ben minden sablon 10 kiküldés alatt → az ítélet a „nem lehet összevetni” ágat mutatja, valódi összevetés több adat után.
