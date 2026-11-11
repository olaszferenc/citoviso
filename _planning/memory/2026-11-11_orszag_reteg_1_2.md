# 2026-11-11 — Ország-réteg ⑤1–2 + felderítés-csoport (ADR-0437)

Session: `cit1b0b1b7c` (SUB, koordinátor `cit9b4690e3`), brief `~/rc-briefs/orszag-reteg-1-2-20261111.md`.

## Elvégezve
- `country` entitás: `migrations/0133_country.sql` (HU-sor a 2026-11-11-i beégetett értékekből, a HU-portálok mérési jegyzeteivel), `src/db/schema.ts` CountryTable.
- Olvasó: `src/country.ts` — `countryConfig`/`countryConfigSync`, `countryOf`, `countryOfLead`, `resolveCountryCode` (alias), `pricingRegionForCountry`, `leadCountryConfig`, `countryPortalDomains`, `refreshCountries`.
- Átkötés: `persist.ts` (nincs beégetett HU), `console/data.ts saveRegion` (ország a középpontból), `i18n/lang.ts` (`langForCountry` → sor, ismeretlenre null), `i18n/mail.ts`, `outreach/draft.ts`, `trial/start.ts` (lead országa + a sor léte a kapuban), `generator/generateEngine.ts` (ismeretlen országra nincs mock), `pricing.ts`, `console/partnerData.ts`, `text/zoneTime.ts`, `scraper/run.ts --country`.
- Felderítés: `googleMaps.ts` kulcsszavak, `resolveOne.ts` Places nyelv/régió, `webSearch.ts` search_lang (+ hívók), `enrichPresence.ts` TLD + locale, `portals/politeness.ts` Accept-Language + locale (+ hívók), `qualify.ts` portál-lista, `text/phoneCountry.ts` (új) + `enrichPortal.ts`, `magellan.ts` (nincs `?? "HU"`, telefon a terület tervében), `scout/rules.ts phoneE164(raw, cfg?)`.
- Őr: `scripts/country-layer-check.mts` + `hooks/pre-commit`. Elfogadás: `foreign-market-e2e-ingest.mts --synthetic` 37 PASS / 0 FAIL.
- Mellék: `scripts/free-trial-e2e.mts`, `scripts/free-trial-retention-check.mts` — a mainen piros volt (ablak-időpontok beégetve).

## Mérések
- `classifyWebsite` régi vs. új: 5052 tárolt URL, 0 eltérés.
- Dev DB lead-országok: HU 7370, „MAGYARORSZÁG” 14, null 9 → a `countryOf` mindre HU-t ad (alias, ill. terület).

## Nyitott / következő
- ⑤3 megkeresés-csoport (sendWindow, autoDispatch, +36-szűrők); Magellan munkalap kulcsszó-oszlopai; webes kontakt-kinyerő HU-szám-mintája; tartalom/kereskedelem/jog csoport; konzol „Országok” lap (terv-kapu).
- A 0133 a dev DB-n kézzel kapott egy `area_bbox` oszlopot (a fájl már tartalmazza) — friss DB-n a fájl elég.
