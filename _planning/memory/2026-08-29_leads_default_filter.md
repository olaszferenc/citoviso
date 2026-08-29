# 2026-08-29 — Leadek-lista alapértelmezett szűrő + törlés-gomb

## Feladat (tulaj-rendelet)
A leadek-lista (`/leads`) alapból a **cselekvésre érdemes** leadeket mutassa: **nincs honlap
(`no_site`) VAGY elavult (`outdated`) honlap, ÉS min. 1 kép** — ne mind az 590-et. Kell **„Szűrők
törlése"** gomb is (ez már létezett, csak nem clear-elt igazán az alap mellett).

## Megoldás
- **Szerver (`server.ts` /leads):** ha NINCS explicit szűrő és nincs `?all=1` marker → injektálja az
  alap-szűrőt: `qualification=[no_site,outdated]`, `minPhotos=1`, `defaulted=true`. Rendezés (`sort`)
  NEM számít szűrőnek → megőrzi az alapot; bármely kézi szűrő átveszi; `?all=1` (a törlés-gomb) elejti.
- **Nézet (`views.ts` leadsPage):** az alap `q`-ba injektálva jelenik meg **aktív form-állapotként**
  (a KVALIFIKÁCIÓ oszlop „2", a FOTÓK „1+"), mert a lista EGY GET-formban él → a bejelölt szűrők a
  formmal utaznak, így más szűrő hozzáadásakor NEM vész el. Fejléc: „Alapértelmezett szűrő: nincs /
  elavult honlap, min. 1 kép". A törlés-gomb mostantól `?all=1`-re megy (különben újratöltené az alapot).
- **`LeadQuery.defaulted`** új mező a felirat vezérléséhez.

## Ellenőrzés
- tsc / i18n / design-token zöld. Mérve: 590 aktív → **161** az alap-szűrővel (102 no_site + 59
  outdated, mind ≥1 kép). ui-shot close-up + mobil átadva; a fejléc-felirat és a két oszlop-jelvény
  helyes. `?all=1` → mind az 590, „nincs szűrő".
- §2b: tulaj-vezérelt, specifikált felület-munka → `surface-gate exception` (naplózva) + ui-shot.

## Módosított
`src/console/server.ts`, `src/console/views.ts`, `src/console/data.ts` (LeadQuery.defaulted),
`src/i18n/catalog.json`.
