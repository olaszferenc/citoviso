## ADR-0041 — A TENANT-oldal SEO-stratégiája: URL-termelés, nem „friss tartalom" (+ a tartalom-modul mint upsell)

- **Kiváltó (tulaj, 2026-08-19):** „Mennyire SEO-optimalizált a tenantnak adott honlap? Nem érdemes
  olyan modult kínálni, amitől nőhet a találat — pl. automatikusan frissülő tartalom: helyi programok
  scrape-elve, linkekkel?" A kérdés kifejezetten a TENANT oldalára vonatkozik (nem a citoviso.com-ra).
- **Audit-lelet (2026-08-19, `src/engine/seo.ts` + `render.ts` + `server/public.ts`):**
  - ✅ KÉSZ: `<title>`, `lang`, viewport, meta description, **fázis-tudatos robots** (mock=`noindex`,
    live=`index`), OG + Twitter card, Schema.org JSON-LD (name/image/address/geo/tel/email/
    aggregateRating), pontosan 1 db `<h1>` sablononként, `alt=` minden képen, `loading="lazy"`.
  - ❌ HIÁNYZIK: sitemap.xml + robots.txt (**egyetlen route sincs** → az indexelés belépője nulla);
    `canonical`/`og:url` (a kód „nincs még élő domain" indokkal hagyja ki — ez ELAVULT, az
    ADR-0024 óta van `<slug>.citoviso.com`); `hreflang` (ADR-0036 nyelvi provisioning mellé);
    `openingHours`/`priceRange`/`sameAs`; `addressLocality`+`postalCode` (**NAP-konzisztencia**).
  - ⚠️ ARCHITEKTÚRA-SÉRTÉS: a JSON-LD hardcode `"@type": "LodgingBusiness"` + `addressCountry: "HU"`
    — egy IPARÁG-AGNOSZTIKUS termékben beégetett vertikum (étterem→`Restaurant`, bolt→`Store`);
    az ADR-0038/0040 óta a lead HORDOZZA az országot, tehát a `"HU"` is kiváltható.
  - 🔒 **A PLAFON:** a tenant-oldal ma **pontosan 1 indexelhető URL** — `renderSite()` egyetlen HTML-t
    ad, a `serveTenantHost` a live snapshotot `/`-on szolgálja ki, **minden más útvonal 404**.
- **Döntés — a helyes mentális modell:** a tenant-oldal SEO-ja NEM a „tartalom-frissesség" tengelyen
  nyerhető meg (az részben mítosz — a `QDF` csak szűk lekérdezés-osztályra hat), hanem
  **indexelhető URL-ek számán és azok horgonyzottságán**. Egy URL ≈ egy kulcsszó-fürt. Ezért:
  1. **RÉTEG A — indexelhetőség (olcsó, motort nem érinti):** sitemap.xml + robots.txt route,
     canonical/og:url a live hoszthoz kötve, `<title>` minta **településsel**
     (`"<Név> — <típus>, <település>"` — a helyi keresés legerősebb helye ma kihasználatlan),
     NAP-mezők + iparág-helyes `@type` a lead facetjeiből (ADR-0038/0040 adja).
  2. **RÉTEG B — URL-termelés (motor-szintű):** `renderSite()` egy dokumentum helyett OLDAL-KÉSZLETET
     ad (pl. `/`, `/szobak`, `/kornyek`, `/arak`, `/kapcsolat`) + belső linkelés + a sitemap ebből
     generálódik. **Ez a tartalom-modul ELŐFELTÉTELE** — enélkül a modul csak szekció a főoldalon,
     SEO-hozadéka ≈ 0.
  3. **RÉTEG C — a tulaj hozzáférését igénylő rész** (GBP/Maps, Search Console-indexelés): változatlanul
     konverzió UTÁN, a láthatóság-motor korábbi rétegzése szerint.
- **A javasolt tartalom-modul — ELFOGADVA az indok CSERÉJÉVEL, korlátokkal:**
  - Az ötlet helyes, de az indoklása nem „friss tartalom → jobb rangsor", hanem **„új aloldal → új
    belépő a long-tail lekérdezésekre"**. Ez határozza meg a formát: **saját URL, nem főoldal-szekció.**
  - ⛔ **Nyers program-lista TILOS.** Ha N tenant oldalán ugyanaz a scrape-elt keszthelyi programlista
    jelenik meg, az tankönyvi **scaled content abuse / site reputation abuse** (Google spam-policy,
    2024. március), és nem tenant-szinten büntet, hanem a **`*.citoviso.com` hálózat egészének
    reputációját** viszi. Rendszerszintű kockázat → nem vállaljuk.
  - ✅ **A HELYES FORMA: geo-horgonyzott környezet-modul.** A saját POI-vagyonból (koordináta-kulcsú
    adat) a KONKRÉT szállás pontjához mért tartalom: távolság/séta-idő, közeli szolgáltatások.
    Mivel a koordináta tenantonként egyedi, a kimenet **definíció szerint nem duplicate** — miközben
    pont a keresett long-tail hasznot adja. Program-adat mehet MELLÉ, de mindig **rövid tény +
    link a forrásra**, sosem átvett leírás-szöveg (szerzői jog + §B.17 tényhűség: kitalált vagy
    lejárt program = invariáns-sértés a tenant élő oldalán).
- **Aldomain vs. saját domain — ÚJ SEO-érv az ADR-0020 mellé:** a `<slug>.citoviso.com` aldomain-készlet
  sok száz sablonos taggal kockázatos konstrukció (a Google az aldomaint gyakran a gyökér-domainnel
  együtt értékeli); a tenant **saját domainje ezt teljesen kikerüli**. Vagyis az egyedi domain nem csak
  presztízs-upsell, hanem **SEO-érv és hálózat-védelem** is — beépítendő az értékesítési érvelésbe.
- **Prioritás (tulaj-döntés 2026-08-20, felülírja a keretezést):** a tulaj kimondott célja, hogy a
  PILOT ALATT kikerülő oldalak (slug vagy saját domain) NE szenvedjenek tartós SEO-hátrányt. A hiányok
  két osztályba esnek: (a) ami a go-live-nál hiányozva TARTÓS veszteség (indexelési idő nem visszahozható;
  canonical nélkül megosztott jelek; domain-váltás 301 nélkül = nulláról indulás; hibás strukturált adat) —
  ez a RÉTEG A + a 301-szabály, ezért **RÉTEG A = PILOT-ELŐFELTÉTEL**; (b) ami később pótolva nulla
  büntetés (aloldalak, tartalom-modul, hreflang) — RÉTEG B + modul **post-pilot** marad, a
  „Láthatóság-mérés + havi riport" backlog-tétel mellé. Ez NEM mond ellent a 2026-07-27-i parkolásnak
  (az a mérés/riport-TERMÉKRŐL szólt, nem a kiadott oldal alap-egészségéről).
- **ÚJ SZABÁLY — domain-váltási 301 (az ADR-0020 upsell-útvonalának kiegészítése):** amikor egy live
  site slugról saját domainre vált (vagy saját domaint kap), a `<slug>.citoviso.com` host onnantól
  KÖTELEZŐEN permanens **301**-gyel irányít az új domain azonos útvonalára, és a canonical átáll.
  Enélkül a slugon felhalmozott rangsor-egyenleg elveszne — az upsell SEO-büntetéssé válna.
- **Visszafordíthatóság:** RÉTEG A 🔄 könnyű (additív head/route); RÉTEG B 🚪 nehezebb — a `renderSite()`
  szerződését és a snapshot-tárolást is érinti, ezért külön ADR-t kap, ha sorra kerül.
- **Státusz:** ELFOGADVA (tulaj, 2026-08-20) + RÉTEG A implementálás alatt lokálban. Kapcsolódó:
  ADR-0020 (domain-stratégia), ADR-0024 (éles infra), ADR-0036 (nyelvi provisioning → `hreflang`),
  03-INVARIANTS §H.21 (felfedezhetőség), §B.17 (tényhűség).
