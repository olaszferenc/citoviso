# 2026-09-26 — A logó mindenhol: a jel maga a C („B”), egy forrásból (ADR-0236)

**Brief:** `~/rc-briefs/logo-c-lockup-brief.md` (a `wt/felszkapu` szál írta; a koordináló session frissítette).
**Tulaj-döntés (§2b kör):** *„B, admin ikon marad, szállás-honlapoknál maradjon így”*.

## Elvégezve
- **Leltár a friss main-en (56d0cffe):** 10 helyszín, ebből 2 már kész volt (levelek ADR-0225, `/pay/*`). Új, a briefben
  nem szereplő helyek: citoviso.com fejléc + lábléc (egy harmadik régi rajz), a konzol és az ügyfél belépő lapjai,
  a konzol telefonos menüje, a dizájn-mag stílus-útmutatója, a citoviso.com hiányzó favikonja.
- **§2b terv:** egy HTML A/B + Mobil/Asztali váltóval, 8 helyszín, a tulajnak elküldve → **B**. Befagyasztva:
  `assets/design-refs/console/brand-mark/lockup-b-*` + README-kiegészítés.
- **Egy forrás:** `src/ui/brand.ts` (a két E4 asset-fájlt olvassa; `lockup`, `markThemed`, `markSvg`, `faviconSvg`,
  `markDataUri`) + `citui.css` `.citui-lockup`. Cserélve: konzol `BRAND` + keret (oldalsáv, menü), tulaj-admin `LOGO`
  (belépő) + `LOGO_MARK` (ikon, témás), `/pay/*` (`PAY_MARK_SRC`), citoviso.com (`<!--CIT_BRAND-->`, a szerver tölti),
  három `/favicon.ico` kezelő + minden `<link rel="icon">` → `/favicon.ico` (világos E4). A régi
  `public/assets/ui/{mark,lockup}-{gradient,mono}.svg` törölve.
- **Számla-PNG** újragenerálva „B”-ben → **a tulajnak kell feltöltenie a Számlázz.hu-ba** (külső művelet).
- **Őr:** `scripts/brand-mark-check.mts` (pre-commit), 4 negatív kontrollal.
- `tudasbazis-or`: PASS (a súgó-képek telefonos szélességűek, logó egyiken sincs; kb-check zöld).

## Saját hibák, amiket a mérés fogott
1. „CC”: a méretező `svg{display:block}` legyőzte a rejtő szabályt → mindkét jel látszott a világos adminban.
2. A konzol `.con a` link-szabálya cián-ra festette a szót a belépőn és a sima lapokon.
3. A C-ív középpontja x≈55,94, nem 60 → a mockban is használt 12-es kivágás levágta a C bal szélét; csak az
   1806 px-es számla-renderen látszott. Kivágás: `7.5 12 95 96` + analitikus őr-próba (②b).

## Módosított fájlok
`src/ui/brand.ts` (új) · `src/console/views.ts` · `src/console/server.ts` · `src/server/adminViews.ts` ·
`src/server/public.ts` · `public/index.html` · `public/assets/ui/citui.css` · `public/assets/ui/citui-console.css` ·
`public/assets/ui/citui-styleguide.html` · 4 törölt svg · `assets/brand/citoviso-logo-szamla.png` ·
`scripts/brand-mark-check.mts` (új) · `scripts/design-token-lint.mts` (okafogyott ALLOW) ·
`scripts/pay-exit-truth-check.mts` (a márka-link kivétele az új osztályra is) · `hooks/pre-commit` ·
`assets/design-refs/console/brand-mark/*` · `_planning/decisions/XXXX-…`.

## Nyitott
- **Számla-logó feltöltése** a Számlázz.hu-ba (tulaj).
- **A citoviso.com hero-illusztrációja** (`.visual-core`, nagy fehér C, beljebb álló play) — nem volt a tervkörben;
  az őr névvel engedi. E4-re igazítása tulajdonosi kérdés.
- Élesítés: NINCS (a nagy deployjal megy).
