# 2026-10-26 — Wix-honlapok képei: srcset-vágás és CDN-szűrő

Koordinátor (citdcb3daea, a tulaj „SOS … automata kiküldés” rendelete alatt). Lokál javítás, élesen NINCS.

## Két ok, mindkettő Wix (élesről olvasva, csak olvasás)
1. **Halott „<host>/quality_auto/<fájl>” URL-ek** — `attachPhotoLinks.ts` (`largestFromSrcset`), `extract.ts` (`domImages`) és `mockPhotoHealth.ts` a srcset-et MINDEN vesszőnél vágta, a Wix kép-URL-ben is van vessző (`…/v1/fit/w_480,h_480,q_90,enc_avif,quality_auto/<fájl>`). Élesen 8 lead, 77 halott URL: Gyógynövények Völgye e618fecb (16), Fordan 3c5165c3 (15), Manduláskert e2bb6b95 (14), LUX 1a2d206e (12), Baladise 9b20dfb8 (8), Arborétum deb6b693 (8), Gabi 2cda10f7 (3), Vigánd 91a55e37 (1).
2. **Platán 92b32b6c: a source-pack 0 kép** — a 6 kép ép, de a `judgePhoto` cross-site szabálya a saját honlap `wixstatic.com` CDN-jét „idegen domainnek” vette. Élesen ez az EGYETLEN ilyen host: 10 lead, 211 kép (2cda10f7 3c5165c3 91a55e37 92b32b6c 9b20dfb8 b58fb524 deb6b693 e2bb6b95 e618fecb e7b21e8c).

## Javítás
- Új `src/scraper/srcset.ts`: `parseSrcset` a HTML-szabvány szerint (az URL nem-szóköz sorozat, vesszőt tartalmazhat), `largestFromSrcset`; mindhárom hívó ezt használja; a `domImages` a src-t nem vágja.
- `ownSiteImages`: a Wix-képet a média-azonosító (`/media/<id>`) szerint szűri egyre (a srcset legnagyobbja és a src bélyegképe egy kép).
- `judgePhoto`: `provenance === "website"` + `wixstatic.com` nem idegen (portál-adatlapon továbbra is az).
- Teszt: `scripts/photo-quality-check.mts` +6 eset (Platán, portál-ellenpróba, srcset ×2, ownSiteImages, domImages); a régi kódon 3 bukik.

## Deploy után
- A 8 halott-URL-es lead: a konzol link-behúzása ($0) ugyanarra a saját-honlap URL-re (a profil URL szerint felülíródik → a halott URL-ek eltűnnek).
- A 10 wixstatic-lead mockja: a fotókészlet a generáláskor rögzül (siteData.photos), a sima rerender NEM hozza be az új képeket → új generálás kell (a source-pack már helyes).
