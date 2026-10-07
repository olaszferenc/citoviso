## ADR-0336 — Magellan: digitális felderítő munkatárs a Térképen; a scrape fizetős API nélkül, régió-munkalapon át kerül a store-ba

- **Tulaj-döntés (2026-10-07):** „A cél a nulla forint API-hívásköltség.” „Az, hogy tokent eszik
  előfizetés terhére, az nem érdekel.” „Ugyanott fusson, mint Neo, Vera meg Poe.” „Ugyanazokat
  lássa, nézze, mint most a jelenlegi területi scrape-program.” Név: **Magellan**, folyamatos felderítés.
  A ToS/letiltási kockázatot a koordináló elmondta; a tulaj ezzel a döntéssel válaszolt.
- **Státusz:** ✅ ELFOGADVA (2026-10-07, tulaj a koordinálón át: Q1–Q10 mind az ajánlás szerint).
  Terv: `magellan/TERV.md`; charter: `magellan/charter/`; befagyasztott felület-terv:
  `assets/design-refs/console/scout-worksheet/` (README = kontraktus).
- **Perszóna, nem pipeline (ADR-0325 mintája):** Magellan saját RC-session a CIT dev gépen, saját
  tartós Chrome-profil (`~/magellan/chrome-profile`, Google-bejelentkezés NÉLKÜL), saját konzol-fiók
  (`magellan`), a konzol felületén dolgozik. Emberi tempó; captchánál megáll.
- **Mit vált ki:** Places Text Search + Details (bejárás), `enrichPlaces`, `enrichGuestReviews`,
  Street View metadata, Brave/CSE web-keresés (`enrichSiteSearch`, `enrichWebSearch`, `portalListing`
  keresés-ága, `repairBrokenSite` tartaléka). Az ingyenes lépések (OSM, presence, portál-olvasó,
  contact, Nominatim) változatlanok.
- **Jog:** a Google-ből csak tényadat (név, cím, település, telefon, honlap, koordináta, fotó-darabszám;
  értékelés + db a Q2 szerint). Fotó és vélemény-szöveg NEM.
- **A store-ba jutás (javasolt: B — régió-munkalap, `/scout`):** csempe × kulcsszó állapot és
  hely-sorok mezőnként mentve (`scout_tile`, `scout_place`) — ADR-0331 „semmi nem vész el”;
  a link-beillesztéskor `isSamePlayer`-rel azonnali ismert-lead szűrés (ADR-0296); a csempe
  lezárása a meglévő `run.ts` láncot futtatja egy `MagellanSource`-szal → `persistLeadBatch`.
  Elvetett: A (egyesével űrlap — a lefedettség nem mérhető, a „hol tartok” elvész),
  C (fájl-forrás — pipeline, és a fájl a dev gépen, a store élesen).
- **Lefedettség (a `scrape-coverage-check` ① ≥95% elve):** telített lista → csempe négyfelé bontva;
  mérő: a régió korábban ismert leadjeinek újra-látott aránya.
- **Kapcsoló:** `SCRAPE_PAID_APIS=off` (élesen alapból) — a scrape és a `/reenrich`, `/rescrape-photos`
  gomb fizetős ágai no-op; őr: `scripts/scrape-zero-paid-check.mts` (piros önteszttel);
  visszamérés: `google-cost-report`, külön generátor-kulccsal a scrape-credential napi száma = 0.
- **Nem része:** a generátor Places-ága (`askPlaces`, ADR-0293), a vélemény-frissítés generáláskor,
  a Street View Static hős-tartalék, a tenant-csillag és -térkép, az önkiszolgáló kérés — külön döntés (Q6).
- **Tulaj-döntések (2026-10-07):** Q1 **B** régió-munkalap (`/scout`) · Q2 értékelés (csillag + db)
  számként rögzítve · Q3 Google-vélemények ki (portál-vélemények maradnak) · Q4 Street View ki ·
  Q5 kontakt-keresés Neónál leadenként, a scrape-ből ki · Q6 a generátor Places-ága 0 Ft-ra KÜLÖN
  szál, addig `cached` politika a pilot-leadekre · Q7 `SCRAPE_PAID_APIS=off` élesen alapból + külön
  generátor-kulcs, a nagy deployjal · Q8 munkaidő 8–20, óránként 10 perc szünet, captcha → aznapra
  leáll és jelent · Q9 Székesfehérvár → Balaton-Kelet újrajárás · Q10 `magellan` éles konzol-fiók
  a megvalósítás végén, külön engedéllyel.
- **Becslés:** új helyekre ~70–90 hely/óra kereséssel; Balaton-Kelet ≈ 2 munkanap, Székesfehérvár ≈ 10.
- **Visszafordíthatóság:** 🔄 könnyű — a kapcsoló visszaállítható `on`-ra, a régi út kódja megmarad.

### Kiegészítés 2026-10-07 — felfedezés + panel-alapadat; telítettség a csempén belülről

- **Tulaj-döntés (2026-10-07 21:20, Q5 megerősítve):** „Magellan fő feladata a felfedezés; ha talált
  valamit, a hozzá tartozó (panelen látható) alapadatot is lementi, de utána átadja Neónak, és Neo
  készíti el a teljes profilt (hol található meg a lead, rákeres, kontakt stb.).”
- **Hely „adatai rendben”** = név + koordináta (mindkettő a linkből). Cím, település, telefon, honlap,
  fotók, értékelés · db és az új **kategória** (`scout_place.category`, 0095, csak a munkalapon)
  opcionális; az érvénytelen telefon/honlap pirosan jelez, és nem kerül a leadre. A Google-keresés
  mező és az ítélet-rádió kikerült a kártyáról (az oszlopok üresen maradnak, a lánc olvassa, ha
  kitöltöttek). A honlap-minősítés a lezáráskor a meglévő lánc dolga (presence, 0 Ft).
- **Telítettség (mérés: `~/magellan/jelentesek/2026-10-07-meres.md`):** a Térkép a listát a csempén
  TÚL kitágítja (kemping: 120 minden csempén, a csempén belül 0–3), ezért a lista hossza magában
  nem mutatja, hogy a csempe helyei kiszorultak. Szabály: egy kulcsszó **telített**, ha a listája
  **> 100 ÉS a csempén belül rögzített helyek száma ≥ 100** (`SCOUT_SAT_THRESHOLD`, egy konstans).
  Indok: a nézeten belüli találatok állnak elöl, a tágítás a lista vége; kulcsszavanként a csempén
  belüli találat sosem több, mint a csempén rögzített helyek összesen (a munkalap a csempén kívüli
  pint elutasítja), tehát 100 alatt minden csempén belüli találat befér a ~120-as listába.
  Ismert rés: a ki nem rögzített nem-szállás találatok (múzeum, pince) is foglalnak helyet a
  listában — a 100 vs. ~120 különbség ezt fedi. A régi szabály szerint „telített” csempék
  állapotát a munkalap az első betöltéskor újraszámolja.
