# 2026-09-25 — Két kapu valódi levelet küldhetett volna a tulajdonosnak (mérve: 0 ment ki) — mock-átjáró + őr

**Kiváltó:** az író-audit szál (ADR-0229) leletét a tulaj a négy nyitott tétel közül elsőnek
kérte: „`EMAIL_PROVIDER=smtp` mellett a booking-offer / season-year-price söprése valódi levelet
küldhet dev-tenantnak — kód-olvasásból, mérés kell.”

## Mérés
- A két kapu a VALÓDI `maintainDatedPrices()`-t hívja (`src/tenant/priceExpiry.ts`), ami a 14 napon
  belül lejáró dátumos árról a `tenant_user.contact_email`-re küld emlékeztetőt, és `tenant_message`-be
  naplóz. Egyetlen fék: a foglalt teszt-domain (example.com …). A `CIT_SHOT=1` NEM fogja le a
  levelezést (csak az AI-feltöltést és a boot-írásokat). A hook nem ad `EMAIL_PROVIDER`-t.
- `.env`: `EMAIL_PROVIDER=smtp`, `SMTP_URL` él, `EMAIL_BCC` a tulaj címe.
- Park: 7 tenant-user e-mailes, **6 valódi** (5 gmail + 1 citoviso.com).
- **Napló: 0 „Hamarosan lejár egy ár” levél valaha** → a lyuk nyitva volt, kár nem történt.
- Ma veszélyeztetett sor (a söprés pontos predikátuma × valódi cím): 0.

## Javítás
- `booking-offer-check.mts`, `season-year-price-check.mts`: `process.env.EMAIL_PROVIDER = "mock"` a
  dinamikus import ELŐTT (a `CIT_SHOT` mintájára; a config betöltéskor olvassa az env-et).
  Pozitív bizonyíték: booking-offer 31 `[email:mock]` sor, season-year-price 2, SMTP 0, mindkettő zöld.
- `server-import-env-check.mts` ③ szabály: aki a `priceExpiry.js`-t importálja, mock-ot állít az import
  előtt (vagy a hook sora adja). Önteszt +4 piros +3 kontroll; élő negatív kontroll a valódi fájlon.
  A szabálynak alanya van (≥2 importáló), különben üres zöld lenne.

## Nyitva
- A hibaosztály tágabb (bármely kapu, ami termék-kódon át levelez): egy termék-szintű fék
  (`CIT_SHOT=1` → csak-outbox küldő) zárná egyben, de az Elek-futások és a config-mérő kapuk
  miatt külön döntés — ide nem fért.

## Fájlok
- `scripts/booking-offer-check.mts`, `scripts/season-year-price-check.mts`
- `scripts/server-import-env-check.mts`
