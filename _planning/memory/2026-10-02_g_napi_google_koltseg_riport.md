# 2026-10-02 — Places-költség G rész: napi Google API költség-riport e-mailben (SUB)

Koordinátor: CIT „Places API 600 $” (`~/wt/citddb048b5`). Brief: `~/rc-briefs/places-g-napi-koltseg-riport.md`. ADR-XXXX.

## Elkészült
- `src/ops/googleCostReport.ts` — Monitoring-lekérés (órás, lapozás), ártábla (`METHOD_PRICES`, az EGYETLEN példány),
  riport-szöveg, kiemelés, NINCS ADAT ág (`runDailyReport` sosem dob).
- `scripts/google-cost-report.mts` — CLI: `[--day YYYY-MM-DD] [--print]`; ismeretlen argumentum → exit 2 (a `--dry` nem
  csúszik át éles küldésbe). Címzett: `GOOGLE_COST_REPORT_TO`, különben a konzol riasztási listája.
- `src/config.ts` — `GOOGLE_COST_PROJECT` (mineralcrm), `GOOGLE_COST_REPORT_TO`, `GOOGLE_COST_DAILY_THRESHOLD_USD` (20),
  `GOOGLE_COST_ITEM_MIN_USD` (1), `GCLOUD_BIN`.
- `deploy/systemd/citoviso-google-cost-report.{service,timer}` (07:10, dev cél a `targets.json`-ban), telepítve a dev gépen.
- Őr: `scripts/google-cost-report-check.mts` + pre-commit.

## Mérések
- A napi (86400 s) Monitoring-igazítás az UTOLSÓ vödröt ~1,43×-osra torzítja (10-01 GetPhotoMedia 1 074 vs nyers 756) —
  az órás összeg a nyers percadattal egyezik. A brief-beli első szondázás számai ezért túlzóak voltak a 10-01-re.
- 10-01: ~11,68 $ (átlag 44,64 $/nap). 09-27: ~80,17 $ `[FIGYELEM]`, SearchText 1 801 (5,6×).
- Az első riport kiment 2026-10-02 06:17-kor (smtp, a 3 riasztási címre).

## Nyitott
- Ha maga a levél nem megy ki (SMTP-hiba), csak a naplóba ír (`~/.claude/citoviso-google-cost-report.log`) — SMS-tartalék nincs.
- A becslés SKU-feltételezés: a SearchText a felderítés ID-only (ingyenes) hívásait is 35 $-ral számolja → felső becslés.
  Pontos számhoz Billing export (BigQuery) kellene.
