# 2026-10-07 — Fotó-behúzás megadott linkről, $0 (ADR-XXXX)

SUB a koordinátor (cita768df48-ed) briefjéből: `~/rc-briefs/foto-link-0dollar-20261007.md`.
Tulaj: „NEM FIZETEK. FEJLESSZÜNK” — Neo böngészőben megtalálja a portál-adatlapot / saját honlapot,
de nem tudta a képeket a leadhez kötni; a „Portál-fotók újragyűjtése” fizetős keresést indíthat.

## Mit csináltunk
- `POST /lead/:id/photo-links` (`links`, 1–10 URL): űrlap a Fotók fülön (flash + `#ls-photos`), JSON
  `Accept: application/json` esetén (gépi adagolás; 200 ok / 422 nincs fotó). Aktivitás: `photos.links`.
- `src/scraper/attachPhotoLinks.ts`: portál → `readPortalListing` (kapu változatlan; szallas.hu → booked.hu
  iker); saját honlap → `readOwnSitePhotos` (img/srcset-legnagyobb/a-href/háttérkép/og:image, +≤2 galéria-oldal,
  JS-oldalnál helyi Chromium-render; idegen domain eldobva a site-builder CDN-ek kivételével; azonosítás:
  tárolt `has_own` honlap-host / a szállás nevét viselő domain + a lead települése az oldalon / név+telefon; jog-őr FLAG után szigorítva, CDN-kivétel csak Wix/Squarespace).
- Új provenance `website` (`scraper/types.ts`, `engine/recipe.ts`, §A.3); a generátor a fotó saját
  provenance-ét viszi (eddig fix `portal`). A `rescrape-photos` NEM változott.
- KB: `kb/entries/console-lead/entry.hu.md` „Fotók behúzása linkről — díj nélkül”.

## Teszt (dev DB, Neo valós URL-jei, `fetch`-naplóval)
- Fehér Bárány Apartman: hovamenjek → 0 → 59 fotó; szallas.hu → booked.hu iker „főoldalra irányított”;
  szallashirdeto.hu/index.php → „nem igazolja a márkát ÉS a települést”. Fizetős host: 0.
- Erika villa (erikavillasiofok.hu): 0 → 35 valódi szobafotó. EMI Vendégház (emivendeghaz.hu): 0 → 40
  (1600 px eredetik, a thumbok helyett). aranyhaludvari.hu: HTTP 403 → érthető üzenet. Fizetős host: 0.
- ui-shot: a Fotók fülön a képek + az űrlap, mobil és asztali.

## Nyitott
- A HTTP-végpontot a worktree-ből nem lehetett meghajtani (port-hook) — a land után a :4600-on.
- Saját honlapról csak fotó jön (ár/szoba/leírás nem); kontakt-kitöltés a megadott adatlapból nincs.
- A Fotók fül bal sávjának címe „Portál-adatlap” — a honlap-képek is ott állnak (képenként „saját honlap”).
- Élesítés: migráció NINCS; kód-deploy kell (tulaj-engedély, a koordinátor kéri).
