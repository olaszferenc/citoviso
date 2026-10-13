# 2026-10-13 — Ellátás és felárak (reggeli, félpanzió, gyerekár) · ADR-0378

**Szál:** SUB a „deploy” koordinátor alatt (fa `~/wt/cit27f0a821`). Brief: `~/rc-briefs/ellatas-felar-20261013.md`.
Tulaj-döntések (koordinátoron át): elrendezés **B** (táblázat + lenyíló), **gyerekár: igen**.

## Elvégzett munka
- §2b terv-kör: A/B mock + gyerekár-váltó → B jóváhagyva, befagyasztva: `assets/design-refs/tenant-admin/ellatas/`.
- `src/tenant/meals.ts` — az EGY szabály: beállítás olvasása, űrlap-validáció (hibakódok), kínált ellátások,
  ár-sorok (`mealLines`), a választott terv ellenőrzése. Böngésző-iker: `cit-runtime.js` `mealLinesFor`.
- Tárolás: Árak-modul config `meals`; `editorKeys` (moduleConfig) védi az általános mentéstől; a
  `priceIncludes` mező az Ellátás részbe költözött (tárolás marad a foglalás-modulban).
- `POST /admin/prices/meals` (hibánál `mf` visszhang, semmi nem mentődik); Árak lap „Ellátás” kártya.
- Honlap: „Ellátás” szekció (showcase slot, minden sablon), közös szobakártya-címkék, widget: lenyíló,
  „Ebből gyermek”, külön ár-sor, kimondott alap.
- Foglalás: 0110 (`meal_plan`, `children`), az ellátás-sorok `kind: "meal"` jellel a `quoted_lines`-ban;
  ajánlat viszi a befagyott sorokat; levelek „Ellátás” sor; Foglalások kártya: címke + „Az ár tételesen”.
- `parseOfferAmount` → `src/booking/amount.ts` (közös szabály, a requests.ts tovább exportálja).
- Őr: `scripts/meals-check.mts` (33 állítás, böngésző = szerver 4 esetben, piros önteszt) — pre-commit bekötve.
- Súgó: `admin-modules-pricing` új szakasz + kép (`kb-shot`), `admin-modules-booking` mutat az új helyre.

## Mért tények
- A kártyát 12 sablon maga rajzolja → a szobakártya-címke csak a közös kártyán; az „Ellátás” szekció minden sablonon.
- A modul általános mentése (`setSiteModuleConfig`) CSAK a posztolt mezőket tárolja — bespoke kulcsot
  (`meals`, `priceIncludes`) enélkül egy pénznem-mentés törölt volna.

## Módosított fájlok
`src/tenant/meals.ts` (új) · `src/booking/amount.ts` (új) · `migrations/0110_booking_meal_plan.sql` (új) ·
`scripts/meals-check.mts` (új) · `src/booking/requests.ts` · `src/db/schema.ts` · `src/engine/moduleSections.ts` ·
`src/engine/recipe.ts` · `src/tenant/editor.ts` · `src/moduleConfig.ts` · `src/server/moduleConfigViews.ts` ·
`src/server/public.ts` · `src/server/bookingViews.ts` · `assets/runtime/cit-runtime.js` · `assets/runtime/cit-modules.css` ·
`hooks/pre-commit` · `scripts/kb-shot.mts` · `src/i18n/catalog.json` · `kb/entries/admin-modules-pricing/*` ·
`kb/entries/admin-modules-booking/entry.hu.md` · `assets/design-refs/tenant-admin/ellatas/*` · ADR-0378.

## Nyitott
- Élesítés: külön tulaj-döntés (a nagy deploy szabálya). A 0110 migráció kell hozzá.
- A nem-magyar nyelvi csomagokba az új feliratok fordítása a szokásos úton megy.
