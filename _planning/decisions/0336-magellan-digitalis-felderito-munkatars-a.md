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
