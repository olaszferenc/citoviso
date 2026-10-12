# 2026-10-12 — A hideg levél „-tól” ára dinamikus + a domain-javaslat mondatai (SUB, ADR-XXXX)

**Szál:** SUB az Elek-teszt koordinátor alatt (fa `~/wt/cit45f55789`). Élesre semmi.

## Elvégezve
- A levél „-tól” ára = a konfigurátor legolcsóbb kínált csomagja (`src/packageOffer.ts`, a konfigurátor is innen veszi a csomagokat); a döntés-segítő emlékeztető is. Érvényes csomag nélkül `NO_PACKAGE_PRICE` + §C FLAG.
- Mérve: régi levél 3 900 → 2 925 Ft, új 4 880 → 3 660 Ft (= az Alap kártya a mostani dev /pricing-on).
- Domain-lista: „Most nem találtunk javaslatot. Írjon be egy nevet a lenti mezőbe.” + „Más nevet is választhat: írja be a lenti mezőbe.” (a régi „a megrendeléskor” hamis ígéret volt; a mező mindkét méreten a lista alatt).
- `overridePricingStateInProcess` új mezői: `baseMonthly`, `modulePrices` (csak őröknek).
- Őr: `scripts/outreach-from-price-check.mts` (régi kódon 14 piros, újon 0).

## Fájlok
`src/packageOffer.ts` (új) · `src/outreach/draft.ts` · `src/outreach/escalationFollowup.ts` · `src/outreach/outreachCheck.ts` · `src/generator/configurator.ts` · `src/pricing.ts` · `assets/runtime/cit-configurator.js` · `src/i18n/catalog.json` · `scripts/outreach-from-price-check.mts` (új) · `hooks/pre-commit`

## Nyitva
- A nem magyar nyelvi csomagokban a két új mondat fordítása a következő fordítási körrel jön (a kulcs a magyar forrás).
