## ADR-0033 — A publikus honlap ára a valós árazásból renderel (régió-tudatos, §C-kapuzott)

- **Kiváltó (tulaj, 2026-08-09):** a citoviso.com árazása beégetve („100 € / évtől") élt a
  `public/index.html`-ben, a `/` útvonal nyers statikus fájlként küldte — semmi köze a valós
  ár-igazságforráshoz (`src/pricing.ts`). Kérés: kösse be a valós adathoz; a pénznem/ár legyen
  RÉGIÓ-érzékeny (adott régióra ha van ár → az, különben globális árlista).
- **Régió-modell:** a `pricing_config` singletonból RÉGIÓ-kulcsúvá vált (migráció 0020): egy sor
  piaconként, explicit `currency` mezővel. `hu` = HUF (3900 Ft/hó → 39 000 Ft/év), `global` = EUR
  fallback (~100 €/év). A meglévő HUF singleton a `hu` sorrá migrál; a `global` EUR sor seed-elt
  (nincs kód-EUR-default). Ismeretlen/hiányzó régió → `global`. NB: a `scraper` RegionTable
  (földrajzi bbox/kör scrape-területek) EZTŐL FÜGGETLEN — az ár-régió külön dimenzió.
- **Bekötés:** `pricing.ts` régió-tudatos snapshot-mappá bővült; MINDEN getter opcionális `regionId`-t
  kap, ami `hu`-ra default-ol → a HUF call-site-ok (konfigurátor, outreach, §C-kapu, manifest)
  VÁLTOZATLANOK. `resolvePricingRegion()` = `?region=` override → Cloudflare `CF-IPCountry` (`HU`→hu,
  egyéb→global) → `Accept-Language`. A `/` útvonal render-eli az `index.html`-t (nem nyers statikus):
  a `CIT_PRICE_BLOCK` markerek közé a snapshotból számolt árat teszi.
- **§C-kapu (Fttv.):** tiszteletben — ha a feloldott régió `pricing_confirmed=false`, a honlap
  „Egyedi ajánlat — kérd az ingyenes mintát" szöveget mutat, NEM konkrét árat. Következmény: amíg a
  tulaj nem véglegesíti régiónként, a szám nem jelenik meg (fail-safe, invariáns-hű).
- **Admin:** a konzol `/pricing` régió-választót kapott (HU/Globális, currency-tudatos mezők);
  `savePricing()` régió-paraméteres. A modul-felárak EGYELŐRE globális HUF-ok (csak a HU oldalon
  szerkeszthetők) — régió-scope-juk külön szelet.
- **Hatókörön kívül (flag):** modul-árak régió-scope; valódi HUF↔EUR árfolyam (a `global` EUR fix,
  nem konvertált); SEO/hreflang.
- **Nyitott:** a Cloudflare narancs-felhő ténylegesen továbbítja-e a `CF-IPCountry`-t az originig —
  élesítés előtt ellenőrizni; addig az `Accept-Language` + `?region=` fallback véd.
- **Visszafordíthatóság:** 🔄 könnyű — additív (új migráció + opcionális getter-param + render-út a
  `/`-on); a HUF call-site-ok érintetlenek.
- **Státusz:** ELFOGADVA / implementálva lokálban (2026-08-09); élesítés külön, scope-olt engedéllyel.
