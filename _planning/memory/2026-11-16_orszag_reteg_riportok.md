# 2026-11-16 — Ország-réteg 3/3: riportok (ADR-0454)

Session `citd77d463e`, koordinátor `cit9b4690e3`, brief `~/rc-briefs/orszag-reteg-3c-riportok-20261116.md` (tulaj „igen mehet”).

## Elvégezve
- Bevételi riport pénznemenként: `src/console/revenueReport.ts` (`currency` paraméter, `buildCurrencyLines`, `homeCurrency`, `foldFacts`/`buildForecast` pénznem-szűrő, domain-költség `costCurrency`), `revenueReportViews.ts` (`formatMinor`, chip-sor, „Pénznemenként” panel), `?c=` paraméter a konzolon.
- Partner havi diagram pénznemenként: `src/console/partnerViews.ts` (`monthlyChartOf`).
- Tölcsér: `src/console/reportData.ts` (ország + zóna a tényeken, `ctry` szűrő, `country` bontás, hőtérkép helyi időben, `heatBest`), `reportViews.ts` (ország-legördülő, felirat, országonkénti javaslat).
- Portál/levelező: `src/analytics/referrerGroup.ts`, `src/scraper/qualify.ts` (`isPortalReferrerHost`).
- Szállás-zóna: `src/analytics/trafficReport.ts`, `trafficMail.ts`, `src/console/trialReport*.ts`, `tenantActivity*.ts`.
- OSS: `src/console/partnerData.ts` (`getFinanceCounts().oss`), `src/console/views.ts` (figyelmeztetés-sor + csempe-sor).
- Őr: `scripts/country-layer-check.mts` ⑦; e2e `scripts/country-reports-e2e.mts`; KB: `kb/entries/console-report{,-revenue}/entry.hu.md`; `scripts/kb-shot.mts` (minta pénznemmel).

## Nyitott
- Új konzol-feliratok Bábelre várnak (magyar fallback).
- Provisioning: a tenant zónája a terület országából, nem a lead koordinátájából (a 3/2-ből is nyitott).
