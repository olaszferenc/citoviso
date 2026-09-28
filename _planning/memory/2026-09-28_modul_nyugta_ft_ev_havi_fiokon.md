# 2026-09-28 — Modul-nyugta: a megújítás-mondat a fiók ütemében, a következő számlából

**Brief:** `~/rc-briefs/modul-nyugta-ft-ev-havi-fiokon.md` (koordinátor: `citded06a5f`; tulaj: „Igen osszd ki.”)
**Lelet forrása:** `2026-09-28_egy_szallasos_telefonos_kor_myrna_haus.md`.

## A hiba
A kuponos vásárlás nyugtája (ADR-0205, `coupon-visible` C) alján: „A kedvezmény egyszeri — a következő
megújításkor **4 620 Ft/év** díjjal szerepelnek a számlán.” — egy HAVI fiókon. Két hiba egy mondatban:
(a) beégetett `/év`; (b) a `{sum}` a `chargedListPrice` volt, vagyis a nyugta „N modul a fordulónapig”
sorának IDŐARÁNYOS összege, nem a megújításkori díj. A hibás mondatot maga a kontraktus kötötte
(README kötő felirat), és az őr (`coupon-visible-check`) is ezt védte: „a megújítás-mondat tartalmazza a
19 700-at” — ami a listaár volt, nem a megújítás (feedback_guard_greenly_defended_the_bug).

## A javítás
- `NextInvoiceItem` kap `id`-t (`src/tenant/subscriptionAdmin.ts`).
- `renewalNote()` (`src/server/adminViews.ts`): az összeg = `sub.nextInvoiceItems` közül a most vett
  modulok sorai × `annualMultiplier(sub)` (ugyanaz a szorzó, mint a „Következő számla” cellájáé: éves fiók
  vagy élesített éves váltás → 12 − ajándék hónap), az egység a fiók üteme (`/év` vagy `/hó`).
  Ha a most vett modul nincs a következő számlán (pl. azonnal le is mondta), a mondat elmarad.
- Két kötő felirat a README-ben (`/év` és `/hó`), dátumozott helyesbítéssel; KB `admin-modules` mondata
  kiegészítve (a fiók ütemében, a „Következő számla” tételeinek összegével).
- Őr: `scripts/coupon-visible-check.mts` ②b — havi, éves és élesített-váltásos fiókon a RENDERELT
  „A következő számla tételei” sorokból méri vissza az összeget; önteszt a régi mondattal pirosra megy.
  ⚠️ Csapda: a fixtúra 19 700-as listaára épp a 3 modul éves díja (1 970 × 10) — a „nem a listaárat
  mondja” próba ezért csak ott fut, ahol a kettő különbözik.

## Ellenőrzés
ui-shot Myrna Haus valós (havi) adataival, 390 + 1280 px: „…4 120 Ft/hó díjjal…” (8 kiválasztott modul
havi sorainak összege). Képek: `assets/design-refs/tenant-admin/coupon-visible/shipped-monthly-{mobile,desktop}.png`.

## Módosított fájlok
`src/server/adminViews.ts` · `src/tenant/subscriptionAdmin.ts` · `src/i18n/catalog.json` ·
`scripts/coupon-visible-check.mts` · `assets/design-refs/tenant-admin/coupon-visible/README.md` (+2 kép) ·
`kb/entries/admin-modules/entry.hu.md`

## Nyitott
- Nincs. (Az új `/hó` kulcs a katalógusban; az i18n-lint zöld.)
