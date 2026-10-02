# 2026-10-02 — Places-költség H rész: a napi Google-riport a VALÓS számlát mutatja (BigQuery billing export) (SUB)

Koordinátor: CIT „Places API 600 $” (`~/wt/citddb048b5`). Brief: `~/rc-briefs/places-h-riport-valos-szamla.md`. ADR-0301.

## Elkészült
- `src/ops/googleCostReport.ts` — `fetchBillingDay` (BigQuery jobs.query, egy olvasó SQL: frissesség LEFT JOIN a nap
  soraira, lapozás), állapotok `ok / late / missing / error / off`; `fmtCost` (HUF egész, más centtel, közös formázó);
  `buildReport(points, o, billing?, estimateMissing?)` — valós fő szám + becslés mellette, projektenkénti bontás, valós
  küszöb a saját pénznemben; `runDailyReport` mindkét forrást kéri, és csak akkor `[NINCS ADAT]`, ha egyik sincs.
- `src/config.ts` — `GOOGLE_BILLING_EXPORT_TABLE` (alap a mineralcrm exporttábla; üres = ki), `GOOGLE_BILLING_EXPORT_LOCATION`
  (EU), `GOOGLE_COST_DAILY_THRESHOLD_HUF` (7000), `GOOGLE_COST_DAILY_THRESHOLD_EUR` (18).
- `scripts/google-cost-report.mts` — bekötés; a naplósor a számla-állapotot is írja.
- `scripts/google-cost-report-check.mts` ⑪–⑰ — hermetikus őr, 7 mutációval piros.

## Mérés / nyitott
- 2026-10-02 ~08:00: a tábla még NEM létezett → élő `--print`: „Valós költség: NINCS MÉG — … még nem létezik …”, a becslés
  vezet. **A valós ág élesen még nem mért.** Ha a tábla megjelent: `npx tsx scripts/google-cost-report.mts --print`
  (a fő fából), és nézd meg a pénznemet (HUF? EUR? USD?) — ha nem HUF/EUR/USD, küszöb kell a configba.
- A „kész nap” feltétele: a tábla legutolsó `usage_end_time`-ja ≥ a nap vége. Ha a Google ennél később is pontosít, az
  a következő napok riportjában már nem látszik — a riport ezt kimondja.
