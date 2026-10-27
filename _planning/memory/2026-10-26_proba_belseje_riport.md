# 2026-10-26 — A próba belseje mérve + Riport „Próba” fül (ADR-0407)

**Kérés (tulaj):** „Van arra kimutatás, hogy mennyien indították az ingyenes próbát? … hol bukik el vagy nem egy
rendelés, hányszor lépnek be a próba alatt … kvázi egy újabb réteget mérni.”

**Kiinduló állapot (mérve 10-26, éles DB olvasás):** 7 próba (5 active, 2 converted, teszt-szűrés nélkül), 9 prospect
nyitotta a próba-ablakot (21×). A próba belseje nem volt mérve (csak `last_login_at`, felülíródik).

**§2b:** 3 változat (A idővonal · B lépcső · C teendő) → tulaj: „A+B hibrid” → hibrid kör → „mehet”.
Terv befagyasztva: `assets/design-refs/console/proba-riport/` (README köt).

**Elkészült:**
- `migrations/0117_tenant_activity.sql` + `src/db/schema.ts` — napló minden tenantra.
- `src/analytics/tenantActivity.ts` (rögzítő, admin-kérés figyelő, mentés → fül), `src/analytics/orderFrom.ts`.
- `src/server/public.ts` — belépés (jelszó/link), admin-megnyitás + mentés figyelő, `POST /admin/activity`.
- `src/server/adminViews.ts` — „Oldal” / webcím link jelez (sendBeacon).
- `src/trial/admin.ts` (`?from=admin`), `src/email/trialEmail.ts` (`?from=level`).
- `src/console/server.ts` — `POST /p/:token/trial-event`, a /folytatas `trialTrack`-et kap; `GET /report/trial`.
- `assets/runtime/cit-configurator.js` + `src/generator/configurator.ts` — folytatás-beacon emberi jelre.
- `src/console/trialReport.ts` (adat + `foldTrialReport`), `src/console/trialReportViews.ts`, `src/console/reportViews.ts`
  (fül), `src/console/nav.ts` (menü), `public/assets/ui/citui-console.css`.
- `src/trial/retention.ts` — a napló a próba-törléssel megy.
- Súgó: `kb/entries/console-report-trial/` (+ a `console-report` cikk fülsora), `scripts/kb-shot.mts`, `scripts/kb-check.mts`.
- Őr: `scripts/trial-report-check.mts` (+ `hooks/pre-commit`).

**Döntések a megvalósításban:**
- A mérés kezdete = a 0117 migráció `applied_at`-je (nem az első sor) — különben a csendes napok hamis „nem mért”-et adnának.
- A mock-oldali bontás nem tesz azonosítót a böngészőbe (ADR-0108 + hozzájárulás): eszköz-típus + rendszer + böngésző.

**Élesítve:** 2026-10-27 09:29 (3473d7da, prod/20261027-0929; a futó Magellan-felderítés egy köre `--ignore-scrape`-pel megszakadt — Magellan 1–3 percenként indít, szünet nincs). Élesen a lap csak a 10-27 09:27 után induló próbák belsejét mutatja.
