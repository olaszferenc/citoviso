# 2026-09-08 — ADR-0111: piac-kapu (ország → jogi csomag), az ADR-0110 folytatásaként

## Kiváltó

Az ADR-0110 zárásakor nyitott pontként szerepelt, hogy a jogi lapok magyarul élnek. Tulaj:
*„országonkénti jogi csomag: nulladik pontban kurvára remélem, hogy ez is be van kötve a
nyelvi kérdésbe, ami akkor aktiválódik ha olyan lead kerül scrapelésre amely még nem
regisztrált országban van"*.

## A mérés fele igazolta

- ✅ **A hideg megkeresésnél VAN kapu** (ADR-0036 §C). Mérve, ugyanazzal a levéllel:
  `hu` → nincs ország-tiltás; `pl` és `de` → `C-ORSZÁG` tiltás; és a `sendBatch` FLAG-nél
  ténylegesen visszafordul (`outcome.kind = "flagged"`).
- ⛔ **De a kapu hardkódolt `lang !== "hu"` volt** — nem létezett hely, ahol egy piacot ki
  lehetne NYITNI. A doktrína „tulaj-jóváhagyást" mondott; a jóváhagyásnak nem volt helye a
  rendszerben.
- ⛔ **A konverziós út nem volt kapuzva** (nulla találat a konfigurátor/fizetés/élesítés
  úton). Aki nem megkeresésből, hanem a publikus honlapról rendel, akadály nélkül végigment.
- ⛔ **Az ADR-0110 ezt élesebbé tette:** mostantól minden élő oldal magyar jogszabályokra
  hivatkozó impresszumot és adatkezelési tájékoztatót publikál. Egy osztrák tenant tehát
  magabiztosan HAMIS jogi dokumentumot kapott volna — rosszabbat, mint a hiányzó.

## Döntés (ADR-0111)

① **A piac kulcsa az ORSZÁG, nem a nyelv** — a jogi csomag jogrendszerhez tartozik. AT és DE
nyelve közös, joga nem: nyelv szerint egy megnyitás kettőt nyitott volna ki.
② **`market` + `market_log` (0057)** — státusz + append-only napló (ki, mikor, mire
hivatkozva). A `HU` sor a migrációban `approved`.
③ **Három fail-closed kapu:** hideg megkeresés (a verdikt HIÁNYA is tiltás — hat hívóhely),
pay-link, és az élesítés a `status:"live"` kapcsoló ELŐTT, hangos megtagadással.
④ **A megújulás KIVÉTEL** — egy piac lezárása nem teheti fizetésképtelenné a meglévő ügyfelet
(a visszavonás a jövőre hat). Zárt piacon is átmegy a `renewal`.
⑤ **Zárt piacon is szabad:** lead-gyűjtés, mock, mintaoldal — nem ajánlat és nem publikál
jogi dokumentumot.
⑥ **Felület:** Beállítások → „Piacok — jogi csomag", a jóváhagyott opt-out minta szerint
(lecsukott `<details>`, kötelező indoklás szerver-oldalon is, látható napló). A lista azokat
az országokat mutatja, amelyekkel MÁR TALÁLKOZTUNK (scrape-terület vagy vevő).

## Mérés

`scripts/market-gate-check.mts` — 20 állítás, mindkét irányban, VALÓDI orderen:
- nyitott piac idegen nyelven ÁTMEGY (ez a lényegi különbség a régi szabályhoz képest),
- zárt piac TILT, verdikt nélkül fail-closed,
- indoklás nélkül nincs döntés ÉS nincs naplósor, kis/nagybetűs országkód ugyanaz a piac,
- zárt piac → nincs pay-link; megnyitás után van; visszazárás után újra nincs,
- zárt piac + MEGÚJULÁS → átmegy,
- az élesítési kapu SORRENDJE (a live-kapcsoló előtt) és hangos megtagadása.
Pre-commitba kötve. `kb/entries/console-markets` + kb-shot fixture (nyitott és zárt piac
egy képen). Landolva: `cf19e52`.

## Nyitott

- **A jogi csomag TARTALMA** országonként — ez a kapu csak a KÉRDÉST teszi fel a megfelelő
  pillanatban. A `src/legal.ts` ma egyetlen (magyar) csomagot ismer; a második piac
  megnyitása előtt a szövegeknek ország szerint kell szétválniuk.
- **Pénznem/árazás:** `hu` (HUF) és `global` (EUR) régió van, a `module_price` globális HUF.
- **Élesítés NINCS** (§0.3): a 0056 és 0057 migráció lokál + main.
