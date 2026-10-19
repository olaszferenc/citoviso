# Kontraktus: a „Tovább a számlázási adatokhoz” alatti mondat (L-6)

> ⚠️ **Részben felülírva: ADR-0395** (2026-10-19, `console/rendeles-egyszerusitett`): a rendelés három lépés (csomag → cím → fizetés), a Havi/Éves váltó csak a fizetés-lapon van, a §A nyilatkozat a fizetés-lap első jóváhagyása, telefonon a fizetés-lap mindig egy oszlop, és nyitott panel mellett nincs felső ajánlat-sáv. Ami itt ennek ellentmond, az már nem érvényes.


**Jóváhagyva:** tulaj, 2026-10-03, **A változat**, koordinátoron át.
**Hatókör:** `assets/runtime/cit-configurator.js`

A 2. lépés `cit-cfg-note` sora.
**Forrás:** Elek 3. kör, L-6: a gomb alatt „Nem kötelező.” állt, a kötelező képjogi pipa mellett — úgy olvasható, mintha a pipa
volna nem kötelező.

## Amit a terv KÖT (elvárt viselkedés)

1. A mondat első szava-mondata „Ez még nem fizetés.” — utána változatlanul: „A következő lépésben megadja a számlázási
   adatokat, majd a biztonságos fizetéshez visszük; a fizetés után az oldalt automatikusan élesítjük, és e-mailben elküldjük a belépőt.”
2. A kötelező pipa és a gomb viselkedése változatlan (pipa nélkül a gomb tiltott).
