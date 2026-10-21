# 2026-10-21 — Tenant-admin szakasz-hierarchia („E”) + portál-menüút a tenant nyelvén

## Elvégzett munka
- **Portál naptár-szinkron súgó** (tulaj kérdése: „biztos, hogy a bookingnál angolul kell ezt írni?”): a Booking/Airbnb menüút a tenant nyelvén, az angol zárójelben; az Airbnb magyar útja az airbnb.hu 99. cikkéből, a Booking fülnevei a magyar partner-súgóból, a Booking gombnevei igazolatlanul angolok maradtak. KB-bejegyzés követi. Felület-kapu: tulaj-kivétel. Commit `8ae22978`.
- **Szakasz-hierarchia, két §2b kör:** 4 szerkezet (A–D) → „B és D hibrid” → 3 hibrid (E–G) → tulaj: **E**. Terv befagyasztva: `assets/design-refs/tenant-admin/szakasz-hierarchia/` (README = kötés, plan.html, gen.mjs, képek). ADR-0397.
- **Megvalósítás:** `citui-admin.css` §12 (`.adm-mhead`, `.adm-mcfg`, `.adm-toc`, `.adm-zone*`, `.adm-card--sec`, `.adm-card__sum`, `.adm-blk`, `.adm-vh`); `moduleConfigViews.ts` (a modul-képernyő feje: h1 = a modul neve, kicker = „‹ Vissza a modulokhoz”, meta-sor díj + útmutató; `pricingEditor` zónák + szerver-oldali TOC + scroll-spy; szoba-kártya összegző sor + két tömb; `mealsCard` tömbök; a Szabályok űrlap `RULES_MARK`-kal a zónába); `adminViews.ts` (nyitott modulnál nincs „Modulok” h1).
- **Őrök a szerkezethez igazítva:** `price-where-check` (saját attribútumról vág), `price-on-request-check` (a következő `id="ar-"`-ig vág), `season-year-price-check` (az űrlap szélességéről olvassa a keskeny/széles elvárást — két oszlopban az űrlap 1280-on is keskeny). Zöld: price-where, price-on-request, season-year-price, admin-linear, booking-screen, whole-only, whole-property-choice, admin-unit-order, kb-check (+coverage), i18n-lint, design-token-lint, tsc.
- **Súgó-képek** újralőve (`kb-shot.mts`, két futás bájtra azonos): 18 kép (admin-modules-* + a kódból adódó többi).

## Módosított fájlok
`public/assets/ui/citui-admin.css` · `src/server/moduleConfigViews.ts` · `src/server/adminViews.ts` · `src/i18n/catalog.json` · `scripts/price-where-check.mts` · `scripts/price-on-request-check.mts` · `scripts/season-year-price-check.mts` · `kb/entries/*/assets/hu/*.png` · `assets/design-refs/tenant-admin/szakasz-hierarchia/*` · `_planning/decisions/XXXX-tenant-admin-szakasz-hierarchia-az-e-nyelv.md` · `MEMORY.md`

## Nyitott
- A „Folytatom” gomb a próba-sávon (tulaj: nem egyértelmű) — javaslat kiment, döntésre vár (a proba-admin-sav kontraktus 5. pontját és 4 KB-bejegyzést érint).
- A többi összetett modul-lap (Szobák, Online foglalás, Amit kínál) ugyanezt a réteget kapja a következő körben.
