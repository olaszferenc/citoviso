# Vitrino

Weboldal-motor: elavult vendéglátó/szállás honlapok (és Google Maps / foglaló-portál bejegyzések) adataiból és képeiből automatikusan modernizált, reszponzív, **foglalható** oldalakat generál.

## Miért
Kis szállások/éttermek tömegének nincs saját, mai honlapja — csak portál- és Maps-jelenlét. A booking-portálok 15–18% jutalékot visznek. A Vitrino célja: automatizált mockup-megkeresés → havidíjas, direkt-foglalós oldal, ami kiváltja a jutalékot.

## Architektúra (a „mag")
Egy közös template + **szállásonkénti adat-objektum** (`src/generate/types.ts`). Új szállás = új rekord, nem új kód.

```
ingest  (src/scrape)   Maps + portál → adat + kép-URL + egyedi jellemzők
analyze                képek → paletta + stílus-preset (vision)
generate (src/generate) template + adat + egyedi „mag"-szekció → oldal
outreach               mockup-link a tulajnak (GDPR/Grt.-tudatos)
convert                megrendelés → a tulaj saját képei + admin
```

## Stack
Node 20+ / TypeScript (strict, ESM) · Playwright (scraping + screenshot) · PostgreSQL (tervezett) · önkiszolgáló admin (tervezett).

## Fejlesztés
```bash
npm install
npm run typecheck
npm run dev
```

## Státusz
Scaffold. A működő prototípus (mockup-generátor) jelenleg: `/home/mineral/mockups/gen.py` — portolása a `src/generate/`-be következik.

## Szabályok
Lásd `CLAUDE.md` — deploy-doktrína (lokál-először, jóváhagyás-gated éles), kód-konvenciók, jogi őrszem (kép-provenance, GDPR).
