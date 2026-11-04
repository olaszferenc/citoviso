# 2026-11-04 — Riport › Előfizetők fül (bevétel, előrejelzés, előfizetők)

**Szál:** SUB-B a Fizetés-szál koordinátorának (`cit7e001214`), brief `~/rc-briefs/fizetes-csomag/b-riport-elofizetok.md`.
**Tulaj kérése (11-03):** „semmi infó nincs a tenantokról, előfizetett tömeg / hó, évesek, cashflow prognózis stb.... semmi”.
**§2b:** A/B/C mock (éles + 26 szállásos szimulált adat, mobil/asztali) → tulaj 11-04: **A („Pénz felül”)**.
Befagyott terv: `assets/design-refs/console/elofizetok-riport/` (README köt).

## Elkészült
- `src/console/revenueReport.ts` — adat: betöltés (subscription, order_intent, payment, invoice, site domain-lejárat,
  domain_tld költség, free_trial) + tiszta `foldRevenueReport` / `buildForecast` / `buildMoves` / `churn3m` / `foldFacts`.
  A következő díj = a már elkészült megújítási rendelés ára, különben a billing darabjai (`renewableModuleIds` +
  `computeMonthly/Annual` + `domainFeeForRenewal`) — nincs második árképlet.
- `src/console/revenueReportViews.ts` — nézet (SVG oszlopok tokenekből, linkes szűrők, JS nélkül), mobilon kártyák.
- Route `GET /report/revenue` (`h`, `t`, `m`, `st`, `sort`), fül a „Pénzügy” helyőrző helyén, bal menü „Előfizetők”.
- CSS: `citui-console.css` `rv-` blokk. Súgó: `kb/entries/console-report-revenue/` (+ `kb-shot.mts` minta, `kb-check.mts` lista).

## Szabályok, amiket a lap követ
- Biztos = tárolt kártya, a terhelés napján érvényes (a lejárat hónapjának végéig), nem lemondott, nincs tartozás.
  Becsült = díjbekérő · lejáró kártya · nincs kártya-maszk (0076 előtti token) · tartozás. Múltbeli esedékesség nem
  előrejelzés, hanem kintlévőség. Befagyott nem terhel.
- Próbák NINCSENEK az előrejelzésben (konverzió nem mért) — felsorolva. Lemorzsolódás induló létszám nélkül „nincs adat”.
- Domain-kiadás: `site.domain_expires_at`-kor, ha `wantAutoRenew`, a `domain_tld.cost_net` (HUF) áron; saját domainjeink nem.
- Teszt = „[TESZT]” név vagy az Elek-park lead; alapból kizárva.

## Ellenőrzés
- 14 tiszta-függvény próba zöld (ad hoc), ui-shot 390/1280 a lokális DB-n (16 előfizetés minden állapotban), szűrő/rendezés.
- i18n-lint, design-token-lint, kb-check --coverage zöld; tsc tiszta.

## Nyitott
- Élesítés a koordinátoré/tulajé (migráció nincs, backfill nincs).
- A tenant-link a lead-lapra mutat; ha a SUB-C partner-adatlapja (`/partners/<id>`) kész, átköthető.
- 11-04: a GitHub elutasítja a CIT SSH-kulcsát → a land addig áll (lásd MEMORY „Tények”).
