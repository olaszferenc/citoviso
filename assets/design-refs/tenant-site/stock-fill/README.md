# KONTRAKTUS — stock-illusztráció a vékony leadek mockjában

> ⚠️ **2026-11-09, ADR-0436 (tulaj „C”):** a 4. pont (vízjel a pixelekben) FELÜLÍRVA — a könyvtár tiszta, a jelölés egy felirat a galéria alatt; nulla saját képnél a hős a település fotója, ha van (2. és 3. pont). Kontraktus: `assets/design-refs/tenant-site/varos-hero/README.md`.

**Jóváhagyta:** a tulaj, 2026-11-07, szó szerint: „Mehet” (§2b terv-jóváhagyási kapu; a koordináló
session hozta, a terv-mockok: a–d, valós dev-DB-s leadekből) · **Tulaj-döntés:** „ha már hero kép van,
stock fotókkal töltsük fel a hiányzókat” + kiegészítés (erős, beégetett vízjel · soha élesre · nulla
képnél betűs hero) ·
**Terv:** `plan.html` (kattintható: az 1 saját képes eset a valódi motorból) ·
**Képek (a megvalósított motorból renderelve, 390 px + asztali):** `a-mandula-vendeghaz-2kep-*` (2 saját
kép, parallax, rusztikus) · `b-strand-apartman-3kep-*` (3 saját kép, gate-opening, modern) ·
`c-aranykagylo-1kep-*` (1 saját kép, wordmark-grow) · `d-bano-porta-0kep-*` (0 saját kép, betűs hero) ·
**Könyvtár:** `public/assets/stock/` + `manifest.json`, generálja a `scripts/stock-build.mts`; őr: `scripts/stock-fill-check.mts`. A 21 sablon a galériát a `galleryPhotos()`-ból veszi.
**Hatókör:** `src/engine/stock.ts` · `src/engine/render.ts` · `src/engine/templateKit.ts` · `src/engine/templates/wordmarkGrow.ts` · `src/generator/generateEngine.ts` · `src/engine/photoPolicy.ts` · `src/tenant/editor.ts` · `src/tenant/assetStore.ts` · `src/server/public.ts` · `src/console/server.ts`

⚠️ **Ez a fájl a megvalósítás SZERZŐDÉSE, nem stílus-javaslat.** A kódot ehhez mérjük.

## Miért

Eddig kiestek a leadek, akiknek kevés (< 6) saját képük vagy nincs hálószoba-képük — pedig nekik kell
legjobban a honlap. Mostantól ők is mockot kapnak; a hiányzó képhelyeket vízjeles stock-illusztráció tölti.

## KÖT

1. **Stock CSAK a galériába és a szobakártyára.** Soha a heróba, a „rólunk”-, sáv- vagy kapcsolat-képbe
   (a terv-kör hibája volt: 1 saját képnél a „rólunk” kép stock lett). Megvalósítás: a stock NEM kerül a
   `photos`-ba; a `stock.gallery` mezőben utazik, és csak a `galleryPhotos()` olvassa (galéria + nagyító).
2. **A hero mindig a szállás saját `photos[0]`-ja.** Nulla saját képnél **betűs hero** (wordmark-grow): a
   név és a település nagy betűvel, a skin színeivel, mögötte halványított (opacity .32), vízjeles
   regionális táj — Balaton / hegyvidék / alföld a település szerint, különben általános vidék. Belső
   stock soha nem borító.
3. **Nulla saját képnél nincs üres keret:** a „rólunk” sor kép nélküli, egyhasábos (`w-row--solo`), és
   nincs galéria-szakasz (a terv-kör második hibája).
4. **Vízjel a pixelekben** (a könyvtár fájljai így készülnek): átlós, ismétlődő
   „MINTAKÉP · ILLUSZTRÁCIÓ” minta a teljes képen + középen nagy „MINTA” bélyegző. Letöltve sem tiszta.
5. **Galéria:** a saját képek után legfeljebb 6 képig; a még nem látott saját képek elöl, aztán a stock,
   végül a lapon már látott saját képek. Kategóriák: hálószoba (csak ha nincs saját hálókép) · fürdő ·
   terasz (rusztikus vagy forrás-jel) · konyha / nappali (modern vagy forrás-jel) · reggeli (CSAK
   forrás-jelre). Stílus: rusztikus (vendégház/tanya/porta/ház/panzió…) vagy modern (apartman/stúdió…).
6. **Szobakártya:** a hálókép nélküli kártya vízjeles hálószoba-illusztrációt kap, kártyánként mást; a
   galéria hálószoba-illusztrációja sosem egyezik egy kártyáéval.
7. **Szöveg nem állít semmit a stockról** (§B.17): alt „Illusztráció” / „Illusztráció — <egység>”,
   nincs subject, nincs hálójel. Provenance `generated` + `stock: true`.
8. **Determinisztikus** (seed = lead id, `stockSeed`), egy lapon egy kép egyszer.
9. **SOHA ÉLESRE:** a live render, a `isLiveSafePhoto` (nyilatkozattal sem), a tenant-előnézet, az
   `addTenantPhotos`, az `assetStore.save` és a feltöltő (md5 + dHash ≤ 6 bit, a vízjeles és a tiszta
   forráskép ellen) mind elutasítja. Nem számít saját képnek (nincs a tárolt fotólistában).
