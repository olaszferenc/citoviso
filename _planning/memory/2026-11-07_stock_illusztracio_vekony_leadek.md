# 2026-11-07 — Stock-illusztráció a vékony leadek mockjában

SUB-session (koordinátor brief). Döntés: ADR-XXXX. Terv: `assets/design-refs/tenant-site/stock-fill/` (tulaj: „Mehet”).

## Elvégzett munka
- Könyvtár: `public/assets/stock/` — 79 Pexels-kép, 11 kategória (háló rusztikus/modern, fürdő, konyha, nappali, terasz, reggeli, 4 táj), 1600×1067, ~200 KB, vízjel a pixelekben; `manifest.json` (szerző, forrás, licenc, md5, dHash). Generálás: `scripts/stock-build.mts`.
- Motor: `src/engine/stock.ts`; `render.ts` withStockFill (mock); `templateKit.ts` galleryPhotos / withStockCards / galleryOrder; 21 sablon galéria-forrása; `wordmarkGrow.ts` betűs hero + kép nélküli „rólunk” + nincs üres galéria; `generateEngine.ts` stockSeed + nulla képnél wordmark-grow.
- Éles kapuk: `photoPolicy.ts`, `tenant/editor.ts`, `tenant/assetStore.ts` (StockAssetRefused), `server/public.ts` (feltöltő md5+dHash), `console/server.ts` (`/assets/stock/` kiszolgálás).
- Őr: `scripts/stock-fill-check.mts` (bekötve a pre-commitba).

## Tanulság
- A pexels.com és az unsplash.com a botot nem engedi (Cloudflare-captcha / 401); a images.pexels.com CDN kulcs nélkül ad képet, az azonosítókat webkeresés hozta.
- A terv-körben két hiba látszott, a végleges szabály ezért: stock csak `galleryPhotos()`-on át (a `photos`-ba soha), nulla képnél nincs üres keret.

## Nyitott
- Élesítés után: Vera charter/RUNBOOK „≥6 saját kép + hálókép” → „≥1 saját kép vagy betűs hero”; a `~/rc-briefs/ab-egylepes` gépi szűrő ugyanígy.
- Nem-magyar mock: a beégetett vízjel magyar szövegű.
