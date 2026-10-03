# Kontraktus: a modul-vásárlás számlája modulonként külön sorral (INV-1)

**Jóváhagyva:** tulaj, 2026-10-03, **B változat** („modulonként külön sor”), koordinátoron át.
**Hatókör:** `src/payment/service.ts`

A számla tételsora (`buildInvoiceItems`, `splitInvoiceAmount`) és a Számlázz.hu-kérés.
**Forrás:** Elek 3. kör, INV-1: a modul-vásárlás tétele „Citoviso előfizetés (havi, 3 modul)” volt — nem mondta, hogy
modul-bővítés, sem azt, melyik modulok.

## Amit a terv KÖT (elvárt viselkedés)

1. **Csak a modul-vásárlás (order `kind = 'upsell'`)** kap modulonkénti sort. Az induló előfizetés, a domain, az
   elszámolás és a többnyelvű tétel változatlan.
2. **Egy sor = egy megvett modul**, a rendelés `modules` sorrendjében, a modul vevő-oldali nevével:
   `Citoviso modul: <modul neve> (<havi|éves>)`, kupon esetén ` — <p>% kedvezménnyel` utótaggal (ADR-0205: a kedvezmény a
   NÉVBEN, külön kedvezmény-sor tilos).
3. **A sorok összege BETŰRE a terhelt összeg** (a Számlázz.hu összeadja a tételeket). Szétosztás (tulaj-döntés: „a maradék
   egy determinisztikus sorra kerüljön”): minden sor legalább 1 Ft; a többi a modulok havidíja arányában, lefelé kerekítve;
   a teljes kerekítési maradék a LEGNAGYOBB havidíjú modul sorára kerül (egyenlőségnél a sorrendben elsőre). Nincs 0 Ft-os sor.
4. **Szélső esetek:** 0 modul → egy sor, „Citoviso modul-bővítés (<havi|éves>)” a teljes összeggel; ha az összeg kisebb,
   mint a modulok száma (1 Ft/sor sem jutna) → egy összevont sor, ami minden modult megnevez.
5. A domain-díj, ha az orderen van, továbbra is külön sor.
6. **A Számlázz.hu-kérés pontosan ezeket a sorokat kapja** (ugyanaz a `buildInvoiceItems` kimenet).

## Ellenőrzés
`scripts/coupon-visible-check.mts` (számla-tételek) és `scripts/invoice-module-lines-check.mts`: 0, 1 és sok modul, 98%-os
és kupon nélküli eset; a sorok összege = a terhelt összeg; a Számlázz-XML ugyanezt a tételsort hordozza.
