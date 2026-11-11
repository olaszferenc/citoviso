# 2026-11-09 — Kép nélküli lead: a település fotója a hősben, tiszta mintaképek (ADR-0436)

**Brief:** `~/rc-briefs/k-pek-n-lk-l-20261109-193407.md` · **Munkafa:** `citf538de1d` · **Tulaj-döntés:** „C” a terv-körből.

## Mi történt
- Terv-kör: két valós kép nélküli lead (Rozália Apartman, Balatonalmádi · Szabó Vendégház, Villány) a valódi motorból, a hősben a település Wikimedia-fotójával; jelölés A erős vízjel / B sarokcímke / C egy felirat. A tulaj: „C”.
- Megvalósítás: `src/generator/townPhoto.ts` (Wikipédia-vezérkép → Commons-keresés, szabad licenc, fekvő JPEG ≥1200 px, címer/térkép/kollázs/temető ki), `generateEngine.ts` (0 saját képnél kikeresi, `siteData.townPhoto`), `render.ts` (`withTownHero` + `withMockNotes`: minta-felirat a galéria alatt, forrás-sor a lap alján, csak mockon), `stock-build.mts` + `stock.ts` (tiszta könyvtár, a régi vízjeles md5/dHash a `retired` listán), Vera charter/runbook képszabálya.
- Őr: `scripts/stock-fill-check.mts` ⑨ ⑩.

## Módosított fájlok
`src/engine/recipe.ts` · `src/engine/render.ts` · `src/engine/stock.ts` · `src/generator/generateEngine.ts` · `src/generator/townPhoto.ts` (új) · `scripts/stock-build.mts` · `scripts/stock-fill-check.mts` · `public/assets/stock/**` (79 kép + manifest) · `vera/charter/CHARTER.md` · `vera/charter/RUNBOOK.md` · `assets/design-refs/tenant-site/varos-hero/` (új kontraktus) · `assets/design-refs/tenant-site/stock-fill/README.md` · `_planning/decisions/XXXX-kep-nelkuli-lead-telepulesfoto-hos-tiszta-mintakepek.md` · `MEMORY.md`

## Folytatás 11-10 – 11-11
- Élesítve: `541d3fbe`, majd `86d07665` (benne `b2bbf340`: névrokon-biztos keresés — cikk-koordináta ≤25 km, egyértelműsítő lap ki, Wikidata P18, Commons geosearch 4 km, szállás/szobor/belső kép ki). Bábel fordításai élesen.
- `scripts/town-photo-backfill.mts` (új): éles futás 2210/2298 kép nélküli mock kapott településfotót (546 település, 85 fotó nélkül, 0 hiba); a kiküldött linkekhez nem nyúlt (§I).
- A lánc a kép nélküli leadeket feldolgozza (08:52-es kör: 104 mock, mind településfotóval).
- Új lánc 11-10 13:20 – 11-11 08:30 0 mockkal állt (üres süti + futás előtti tried-lista); kézzel helyreállítva, a tartós javítást a Koordinátor megcsinálta (`80f7c551`; 09:55-ös kör 200/60/60, 0 átmeneti).

## Nyitott
- A 85 településfotó nélküli mock tipográfiai hőssel, a `nophoto` kapun tartva marad (ADR-0436 ⑧) — tudatos állapot, nem teendő.
