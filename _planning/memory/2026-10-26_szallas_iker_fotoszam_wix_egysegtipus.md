# 2026-10-26 — szallas.hu iker nélkül, fotószám-csökkenés, halott Wix-sorok, egységtípus

Koordinátor-tételek (Neo és a deploy utáni ellenőrzés), egy landban.

## 1. szallas.hu link → „a portál a főoldalára irányított át”
- Kakas-Dombi 2895a3ef: a link `szallas.hu/kokas-dombi-vendeghaz-nemeshetes`; a szallas.hu-t nem olvassuk
  (Cloudflare), a booked.hu-ikret (`<slug>.booked.hu`) igen, de ez a `www.booked.hu`-ra irányít.
- Mérés (élesen, 25 olyan szallas.hu-s lead, amelynek nincs booked-profilja): 25/25-nél nincs iker a slug alatt.
  Az aldomain nem mindig a slug (Beatrix Üdülőház → `bella-balatonbereny.booked.hu`); a booked.hu sitemapje
  csak ~1200 hotelt listáz, a Kokas-Dombi nincs benne → nyílt, megbízható keresési út nincs.
- Javítás: `attachPhotoLinks.twinSkipReason` — ikerolvasásnál a főoldal-átirányítás üzenete
  „nyílt booked.hu-ikre sincs … az adatlap ettől még élhet; a fotókat a saját honlapról vagy másik portálról”.
  `portalListing.ENGINE_HOME_REDIRECT` a közös konstans.

## 2. „a fotószám nem változott”, pedig csökkent
- Az újraolvasott adatlap lecseréli a tárolt profilt; a már halott/szűrt képek kiesnek → a szám csökkenhet.
- `attachPhotoLinks.photoCountMessage`: „a fotószám csökkent: X → Y (…lecserélte)”.

## 3. Halott `<host>/quality_auto/<fájl>.png` a srcset-javítás után
- A mostani kód egyiket sem gyártja (Baladise, Gyógynövények, Manduláskert, Fordan újraolvasva: 0 hibás).
- A maradék 13 URL a 10-08/10-21-es ALOLDAL-profilokon ül (`/galeria`, `/szobaink`, wixsite `/mysite/galeria`);
  a deploy utáni újrabehúzás a főoldalt olvasta → új profil, a régi sorok maradtak.
- Javítás olvasáskor: `srcset.isCutSrcsetUrl` (`/quality_auto/` `/v1/` nélkül) → `judgePhoto` eldobja (generátor),
  `distinctPortalPhotos` nem számolja (minden számláló). Újrabehúzás nem kell.

## 4. „Az egész szállás” a TARTVA-mockokon
- Ok 1 (üzemi): a felsorolt TARTVA-mockok nem kaptak `--resample`-t (lista: `~/rc-briefs/tartva-rerender-keres-20261026.txt`).
  A hotel/panzió/fogadó nevűek a mostani szabállyal „Szobák”-at kapnak, csak rerender kell.
- Ok 2 (szabályhiány, javítva): „3 apartmanban kínál” (Kalandor ad440016) és az „Apartmanház”/„Apartmanok” név
  (ALRO, Mediterran) nem számított több egységnek.
- Ok 3 (adathiány, nem javítható szabállyal): a saját honlapos leadek profiljában nincs leírás-szöveg
  (Mandala, Király, Andika, Picur-Ha …), a hovamenjek-leírás sokszor csak „Szállás <város>…”. Ilyenkor a
  tulaj alapértelmezése („az egész szállás a jó alapértelmezés”, 2026-09-08) marad.

## Deploy után
- `npx tsx scripts/rerender-mock.mts <id> --resample` a TARTVA-mockokra (egységtípus), a többi (1–3) render/olvasás-idejű.

## Fájlok
- `src/scraper/attachPhotoLinks.ts`, `src/scraper/sources/portalListing.ts`, `src/scraper/srcset.ts`,
  `src/scraper/portalPhotos.ts`, `src/scraper/sources/portals/photoQuality.ts`, `src/engine/sampleFromSource.ts`
- Tesztek: `scripts/photo-quality-check.mts`, `scripts/sample-from-source-check.mts`
