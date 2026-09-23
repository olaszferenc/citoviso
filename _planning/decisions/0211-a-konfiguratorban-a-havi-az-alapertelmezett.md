## ADR-0211 — A konfigurátorban a HAVI az alapértelmezett fizetési ütem; a „2 hó ingyen” forintban és mozogva hirdet

**Dátum:** 2026-09-23 · **Kiváltó:** tulajdonosi kérés a Villa Suzy Zamárdi konfigurátor-képernyőképén:
„itt legyen a havi fizetés az alapértelmezett… és a 2 hó ingyen legyen markánsabb hirdetés, akár animált is”.
Kontraktus: `assets/design-refs/console/period-badge` (a §2b kapun a **C** változat, 3-ból).

**① Alapértelmezés:** a `cit-configurator.js` `period` kezdőértéke `"monthly"` (volt: `"annual"`,
tulaj-rendelet 2026-08-23, ADR-0090 ②-ben megerősítve — ezt a két mondatot ez az ADR FELÜLÍRJA).
A belépő ár így a kisebb, havi szám; az éves ajánlat nem tűnik el, hanem a jelvény hirdeti.
A szerver nem feltételez ütemet (a rendelés `billing_period`-ot a kliens küldi), árazás (`pricing.ts`)
és az ADR-0088 ajánlat-kártya változatlan.

**② A jelvény a pénzt mondja:** `−{havi listaár × annualFreeMonths} · {n} hó ingyen` — a kiválasztott
szekciókból számolva, modul-kapcsoláskor frissül; a domain-díj nincs benne (az ingyen hónap a
szolgáltatásra szól, ADR-0109 ⑥). `annualFreeMonths = 0` → nincs jelvény (nullát nem hirdetünk).
Fénycsík + apró billenés; `prefers-reduced-motion` alatt minden áll.

**Őr:** a `configurator-price-check` a kiválasztott ütemet a DOM-ból olvassa (mindkét alapértelmezésen
helyes); kiegészítve azzal, hogy induláskor a Havi van kiválasztva, és a jelvény összege = havi
listaár × ingyen hónapok.
