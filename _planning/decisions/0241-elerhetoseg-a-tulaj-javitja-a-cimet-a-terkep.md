## ADR-0241 — Elérhetőség: a tulaj javítja a címet, a térkép-tűt, a telefont és az e-mailt

**Dátum:** 2026-09-26 · **Státusz:** elfogadva (tulaj, B változat) · **Kontraktus:** `assets/design-refs/tenant-admin/elerhetoseg/`

### Kontextus
A honlap nyilvános elérhetőségeit (cím, telefon, e-mail, koordináta) eddig csak a begyűjtés adta:
a lead-rekord a generáláskor a `mock_artifact.inputs.siteData`-ba fagyott, és a tulaj semmit nem
tudott rajta javítani. Mérve a Camping Carinán: a cím „Ráckevei út 083/2 hrsz. 083/2” (a
helyrajzi szám kétszer), a telefon „06305161631” formázatlanul. A „Balatonmáriafürdő, Ráckevei út”
címkeresés kb. 5 km-re tette a tűt a tárolt ponttól, tehát a cím önmagában nem jelöl ki helyet.
A tulaj a Térkép modul képernyőjén kérte: „itt lehessen a szállás címét pontosítani … lehessen
térképen google maps-en leszúrni a szállás helyét”, és megkérdezte, hol szerkeszthetők az
elérhetőségek.

### Döntés
1. **Önálló „Elérhetőség” fül** az „Az oldalam” csoportban (a tulaj a B változatot választotta a
   „Szövegek lap alján” A-val szemben). Modultól független, mert a cím és a telefon a Térkép
   modul nélkül is a honlapon van (fejléc, kapcsolat rész, JSON-LD).
2. **A Térkép modul képernyője ugyanazt a hely-kártyát viseli**, ugyanazzal az adattal; egy mentés
   a helyet és a megközelítés-mezőket együtt menti (a hely előbb, render nélkül, aztán egy közös
   újrarenderelés).
3. **Tárolás:** a `site.edited_site_data` felülírásaiban, `contact` (egészben, mert a merge sekély)
   és `geo` kulccsal — ugyanaz a csatorna, mint a Szövegek-szerkesztésé. Új tábla/oszlop nincs.
4. **Szabály (`src/tenant/contact.ts`):** a telefon az SMS-küldő `normalizePhone()` szabályával
   (+ a „/” elhagyásával), „+36 30 123 4567” alakban tárolva (a `tel:` link a szóközöket elhagyja).
   Mindent vagy semmit: egy hibás mező a többit sem menti. Üres lat/lon pár (nincs térkép) = a
   tárolt tű marad; a 0,0 pont hiba.
5. **Böngésző-kulcs:** a tű a Maps JavaScript API + Geocoding-ot használja, ezért a kulcs a lapra
   kerül. Külön `GOOGLE_MAPS_BROWSER_KEY` kell, HTTP-referrer korlátozással; a szerver
   `GOOGLE_MAPS_API_KEY` sosem kerül böngészőbe (az őr méri). Kulcs nélkül a fül térkép nélkül
   működik, és ezt ki is mondja.

### Következmények
- Élesítés előtt a Google Cloud konzolban létre kell hozni a referrer-korlátozott böngésző-kulcsot
  (Maps JavaScript API + Geocoding API), és az éles `.env`-be `GOOGLE_MAPS_BROWSER_KEY`-ként
  felvenni. A dev `.env`-ben átmenetileg a szerver-kulcs értéke áll.
- A cím-javítás a jogi lapokra (impresszum, adatvédelem) is kimegy, mert a mentés újrarenderel.
- Őr: `scripts/contact-edit-check.mts` (pre-commit), súgó: `kb/entries/admin-contact`.
