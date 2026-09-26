# 2026-09-26 — Elérhetőség: cím, térkép-tű, telefon, e-mail (ADR-XXXX)

## Kérés
A tulaj a Térkép modul képernyőjén: „itt lehessen a szállás címét pontosítani ha kell! És az
elérhetőségeket hol lehet szerkeszteni? … lehessen térképen google maps-en leszúrni a szállás helyét”.

## Mérés (a kérés előtt)
- A cím/telefon/e-mail/koordináta CSAK a begyűjtésből jött (`mock_artifact.inputs.siteData`), tulaj-szerkesztés nem volt.
- Camping Carina: „Ráckevei út 083/2 hrsz. 083/2” (dupla hrsz.), „06305161631”; a „Balatonmáriafürdő, Ráckevei út”
  címkeresés ~5 km-re tette a tűt a tárolt ponttól → a cím nem elég, tű kell.
- A meglévő `GOOGLE_MAPS_API_KEY` referrer-korlátozás NÉLKÜLI (file:// és IP-ről is betölt) → a lapra nem tehető.
- Mellékes: a Camping Carina lokális snapshotjában nincs térkép-rész, pedig a modul aktív — NEM vizsgáltam.

## §2b
Két vázlat (A: Szövegek alján · B: saját menüpont), mobil + asztali, élő Google-térképpel. A beépített
fájlnézegető a Google-szkriptet nem tölti be — a tulaj ezért nem látta a térképet; egy ideiglenes
`python -m http.server 8871`-gyel adtam neki linket (⛔ ez ad-hoc szerver volt a worktree-ből, a hook
csak utólag, egy másik parancsnál szólt; leállítva). Döntés: **B**, „ok jó így”.

## Elkészült
- `src/tenant/contact.ts` szabály, `editor.ts` `getTenantContact`/`saveTenantContact` (`edited_site_data.contact`+`geo`)
- `src/server/contactViews.ts` (hely-kártya + Elérhetőség lap + kliens-szkript), `adminViews.ts` új fül,
  `moduleConfigViews.ts` Térkép-képernyő egy formmal, `public.ts` `POST /admin/elerhetoseg` + module-config location ág
- `config.googleMapsBrowserKey` (`GOOGLE_MAPS_BROWSER_KEY`); dev `.env`-be a szerver-kulcs értéke került (git-en kívül)
- ikonok `contact`, `pin`; súgó `kb/entries/admin-contact` (+ `kb-shot` elem-kép, `kb-check` korpusz)
- őr `scripts/contact-edit-check.mts` (62 állítás, negatív kontroll: a Térkép-mentés kikapcsolva → 4 piros), pre-commit
- kontraktus `assets/design-refs/tenant-admin/elerhetoseg/` (a kulcs kivéve a plan.html-ből)

## Lelet közben
A szerver `normalizePhone` a „/”-t nem ismerte, a kliens-ellenőrzés igen → „06 30/516-1631” a képernyőn jónak
látszott, a szerver elutasította. Javítva a `contact.ts`-ben (a „/” elhagyása a szabály előtt).

## Nyitott
- ÉLES előtt: referrer-korlátozott böngésző-kulcs (Maps JavaScript API + Geocoding) a Google Cloudban → éles `.env`.
- A Camping Carina snapshotjából hiányzó térkép-rész oka.
- Nem élesítve (a nagy deployjal megy).
