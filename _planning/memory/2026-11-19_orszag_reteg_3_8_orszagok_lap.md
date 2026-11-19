# 2026-11-19 · Ország-réteg 3/8 — az „Országok” konzol-lap és a nyitás előtti teljesség

Brief: `~/rc-briefs/orszag-reteg-3h-orszagok-lap-20261118.md` · koordinátor `cit9b4690e3` · session `cita2cb36f4` · ADR-0460.

## Elvégezve
- TERV-KAPU: két mock (A lista+szerkesztő, B nyitás-mátrix) → a tulaj a **B**-t választotta (2026-11-19). Befagyasztva:
  `assets/design-refs/console/orszagok/` (plan.html + 5 kép + README).
- `src/countryReadiness.ts` — EGY teljesség-függvény; `src/markets.ts marketGate` ebből dönt (jóváhagyás ÉS teljes).
- `src/countryRules.ts` (szabályok, EU-kezdősor, euróövezet = EUR, ünnepnap-lefedés), `src/countryStore.ts` (mentés).
- Konzol: `src/console/countryViews.ts`, `countryData.ts`, útvonalak `GET /countries`, `POST /countries/check|save`,
  `POST /settings/markets` (teljesség-ellenőrzéssel); nav: Rendszer › Országok; /settings-en mutató.
- Vevő-oldali nyelvi mérés (`missingBuyerPackStrings`) — teljesség + öt megkeresés-küldő; felület-jelölés javítva
  (`prospectNotice`/`planSwitcher` → megkeresés, `mockPhotoHealth`/`countryRules`/`countryReadiness` → konzol,
  `views.ts` 7 vevő-felirat → honlap).
- `money-path-e2e` cs-CZ: két hiba volt — a teszt-lead `raw`-ja előre kódolt JSON-sztring (ország = a terület HU-ja),
  ÉS a teszt-mock `inputs`-ából hiányzott a `siteData.lang` (a `langForLead` előbb ezt nézi, hiányában hu). Mindkettő javítva.
- `market-gate-check`, `legal-pack-e2e`, `money-path-e2e`: a nem-HU piac a teljességhez fixtúrát kap
  (`scripts/lib/country-ready-fixture.mts` — jelölő-csomag, ünnepnap, ársor; scratch DB, soha fordítás).
- `country-layer-check` ⑫, `dialog-fires-check` az új lapon, `kb-check` + új KB `console-countries` (a `console-markets` beolvadt).
- Elfogadási teszt: `scripts/country-page-e2e.mts` (scratch DB, böngésző) — zöld.

## Mért tények
- Prod (2026-11-19, olvasás): csak HU sor és HU piac (approved) — a szigorúbb kapu élő piacot nem zár.
- Vevő-oldali katalógus: 4000 / 7218 felirat. A Bábel-maggal: it, hr 0 hiány; de/pl/sk 1; bg/fr/es/pt 22
  (a tervváltó 12 felirata + 10 „egyeb”); en 761 körül; cs nincs csomag.
- Tiszta mainen piros (nem e kör hibája): `country-outreach-e2e` 2/42 és `country-mock-e2e` 4/29 — mindkettő
  „bolgár csomag nincs” feltevésre épül, de Bábel bg csomagja 11-18 óta a mainen van.

## Nyitott
- `send_window_from/to` oszlop: a lap szerkeszti, a küldés nem olvassa (a hideg ablak közös: `MOCK_OUTREACH_WINDOW`).
- Bábel-teendő: `planSwitcher.ts` 12 vevő-oldali felirata bg/fr/es/pt; a 10 „egyeb” felirat.
