# 2026-11-09 — Kép nélküli lead: a település fotója a hősben, tiszta mintaképek (ADR-0436)

**Brief:** `~/rc-briefs/k-pek-n-lk-l-20261109-193407.md` · **Munkafa:** `citf538de1d` · **Tulaj-döntés:** „C” a terv-körből.

## Mi történt
- Terv-kör: két valós kép nélküli lead (Rozália Apartman, Balatonalmádi · Szabó Vendégház, Villány) a valódi motorból, a hősben a település Wikimedia-fotójával; jelölés A erős vízjel / B sarokcímke / C egy felirat. A tulaj: „C”.
- Megvalósítás: `src/generator/townPhoto.ts` (Wikipédia-vezérkép → Commons-keresés, szabad licenc, fekvő JPEG ≥1200 px, címer/térkép/kollázs/temető ki), `generateEngine.ts` (0 saját képnél kikeresi, `siteData.townPhoto`), `render.ts` (`withTownHero` + `withMockNotes`: minta-felirat a galéria alatt, forrás-sor a lap alján, csak mockon), `stock-build.mts` + `stock.ts` (tiszta könyvtár, a régi vízjeles md5/dHash a `retired` listán), Vera charter/runbook képszabálya.
- Őr: `scripts/stock-fill-check.mts` ⑨ ⑩.

## Módosított fájlok
`src/engine/recipe.ts` · `src/engine/render.ts` · `src/engine/stock.ts` · `src/generator/generateEngine.ts` · `src/generator/townPhoto.ts` (új) · `scripts/stock-build.mts` · `scripts/stock-fill-check.mts` · `public/assets/stock/**` (79 kép + manifest) · `vera/charter/CHARTER.md` · `vera/charter/RUNBOOK.md` · `assets/design-refs/tenant-site/varos-hero/` (új kontraktus) · `assets/design-refs/tenant-site/stock-fill/README.md` · `_planning/decisions/XXXX-kep-nelkuli-lead-telepulesfoto-hos-tiszta-mintakepek.md` · `MEMORY.md`

## Nyitott
- Élesítés (külön engedély). Bábel: a két új felirat („Néhány kép minta…”, „Borítókép”, „Fotó”) fordítása — addig magyar.
- A meglévő kép nélküli mockok csak újrageneráláskor kapnak településfotót.
- A lánc eddig kihagyhatta a kép nélküli leadeket a generálásból (material.hasAnyImage) — érdemes ellenőrizni, hogy most sorra kerülnek-e.
