# 2026-08-23 — 📸 Fotó-rescrape gomb + vouched méret-padló + minőség-sorrend (ADR-0060)

## Kiváltó (tulaj)
„Ha egy leadet megtalálunk egy portálon, leszedjük a képeket róla? Hogy lehet újra scrapelni a
képeket? … a lead fotók alatt lehessen." Majd: „kell több kép", és „először a jobb minőségű
képeket kell felhasználni a honlaphoz."

## Elvégzett munka

### 1) Konzol-UI (lead-oldal)
- **„Portál-fotók újra-scrapelése" gomb a Fotók fülön** — `src/scraper/rescrapePhotos.ts` (új):
  egy leadre `enrichPortal` + `enrichMaterial`, merge/gap-fill (curator-edit túlél), életciklus-
  korlát NÉLKÜL (tulaj-döntés; a forrásadat frissítése nem írja át a kiküldött mock snapshotját).
  Route: `POST /lead/:id/rescrape-photos` (console/server.ts). A meglévő `reenrichOne` lánca
  SZÁNDÉKOSAN kihagyja az `enrichPortal`-t (lassú/drága) — ezért nem volt eddig fotó-frissítés.
- **„← Vissza a leadekhez"** link a dosszié fölött + **sticky fül-sáv** (a `top` a fő menü ÉLŐ
  magasságához igazul JS-méréssel — a tulaj telefonján a menü tördelve magasabb).

### 2) A Villa Rubin-diagnózis (miért 0 portál-fotó?)
A lead 3 listingje: szallas.hu (Cloudflare 403 — **szándékosan nem törjük**, jog-doktrína),
hovamenjek + apartman (high-band profil ✓, de a fotó-szűrés MINDENT dobott: „24× túl kicsi").
A nyílt portálok CSAK kis derivatívát szolgálnak (hovamenjek max 574px `main`, apartman 500px WP)
→ az ADR-0050 800px-padlója a lead TELJES VALÓS galériáját eldobta. A rescrape-üzenet elsőre
„nem találtunk portál-adatlapot"-ot hazudott → szétválasztva: „N adatlap, 0 használható fotó".

### 3) ADR-0060 — vouched padló + minőség-sorrend (3 iterációban)
- **v1 (fájlnév-match):** vouched = high-band ÉS a fájlnév hordozza a név-tokenjeit → 2 kép.
- **v2 (méret-upgrade):** `PortalAdapter.largestPhotoUrl` (hovamenjek galleryMiddle→main).
  ⛔ **Vak átírás 404-eket gyártott** (a numerikus fájloknak nincs `main` variánsa, és a
  mérhetetlen kép „megtart" ága átengedte a törött URL-t) → **probe-verify + fallback** kötelező.
- **v3 (tulaj-egyszerűsítés, VÉGSŐ):** „azt mentjük el, ami a MI szállásunkra vonatkozik — miért
  bonyolítod?" → **a vouch horgonya az OLDAL-szintű match**: a high-band adatlap galériája a
  szállásé, fájlnévtől függetlenül. A name-match apparátus TÖRÖLVE (kizárta a numerikus WP-fájlokat
  = az apartman.hu 5×500px valódi fotóját). A szemetet a meglévő generikus lánc szűri
  (ownContentOnly + URL-deny + caption + 400px vouched-padló).
- **Minőség-sorrend:** GatedPhoto.longEdge; portál = mért méret, Places = névleges 1200px;
  csökkenő rendezés (stabil, determinisztikus) → **a legélesebb kép a hero**. A Places mostantól
  a portál-készlet mérete mellett IS feloldódik (különben nincs nagy-felbontású hero-jelölt).

### Eredmény (Villa Rubin, élőben)
0 → **8 portál-fotó** (apartman 5×500 + hovamenjek 574/431/431) + 6 Places (1200px, elöl).
A mockba újrageneráláskor kerül be (snapshot-drift, [reference_snapshot_rerender_propagation]).

## Tanulságok
- ⭐ **A bizalom horgonya az oldal-szintű verifikált match, nem a fájlnév** — a v1 kettős övének
  ára valódi galériák elvesztése volt; a tulaj kapta el, hogy ez fölösleges bonyolítás.
- ⛔ **URL-átírás CSAK verifikálva** — a „mérhetetlen → megtart" irgalmi ág a vak átírással
  kombinálva törött URL-t tárol; a probe-verify + eredeti-fallback zárja.
- A booked.hu/white-label slug-tippek zsákutca (302/301 a generikus főoldalra — belső ID kell).
- A kapu-teszt kétirányú maradt (vouched MEGTART + nem-vouched ELDOB + deny-listás vouched ELDOB).

## Módosított fájlok
- ÚJ: `src/scraper/rescrapePhotos.ts`
- `src/console/server.ts` (2 route), `src/console/views.ts` (gomb, vissza-link, sticky JS),
  `public/assets/ui/citui-console.css` (con-back, sticky bár)
- `src/scraper/types.ts` (PortalPhoto.vouched), `src/scraper/sources/portals/photoQuality.ts`
  (RELAXED_MIN_LONG_EDGE=400, vouched floor), `src/scraper/sources/portalListing.ts`
  (high-band → vouched; verifikált méret-upgrade), `src/scraper/sources/portals/registry.ts`
  (largestPhotoUrl), `src/generator/generate.ts` (longEdge + best-first rendezés)
- `scripts/photo-quality-check.mts` (+8 → átdolgozva oldal-horgonyra + transzform-esetek)

## Állapot
Minden landolva (utolsó: `8387e88`), fő fa szinkron, :4600 friss. **Éles deploy: a tulaj
kimondta a session zárásakor** — a záró commit megy ki `deploy-prod.sh`-val.
