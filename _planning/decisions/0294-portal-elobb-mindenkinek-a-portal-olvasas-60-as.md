## ADR-0294 — Portál előbb, mindenkinek: a portál-olvasás 60-as plafonja ki, a fizetős felfedezés kereten belül (2026-10-01)

**Dátum:** 2026-10-01 · **Státusz:** elfogadva (SUB „B rész”, koordinátor: CIT „Places API 600 $” fő session; brief:
`~/rc-briefs/places-portal-mindenkinek.md`) · **Tulajdonosi döntés (2026-10-01):** „a scrape MINDEN kontaktálható
leadnél beolvassa az ismert portál-adatlapot (a 60-as plafon megy)” · **Kapcsolódó:** ADR-0106 ④ (teljes jelölt-lista
olvasása), ADR-0136 (`knownUrlsOnly` frissítés), a Places-költség brief A része (`lead_places_cache`).

**A lelet, mérve.** Élesen 1 417 kontaktálható leadből 977-nek VAN ismert portál-adatlapja (`raw.listings`), de csak
31–62-nek volt beolvasott portál-profilja: az `enrichPortal` futásonként 60 leadet olvasott (`DEFAULT_MAX_LEADS`). A
portál-fotó hiánya tolta a mockot a fizetős Places-fotóra. Egy második, eddig nem látott ok: a scrape a dúsítást a
store-dedup ELŐTT futtatja, tehát egy már tárolt lead egy új scrape-ben SOSEM kapott portál-olvasást (a futás végén
duplikátumként eldobódott, a beolvasott adattal együtt).

**Döntés.**
1. **Ismert adatlap = ingyenes = mindenkinek.** Az `enrichPortal` minden kontaktálható (isLead) lead MÁR ismert
   adatlapjait beolvassa (tárolt `listings` + a portal_only lead saját adatlap-URL-je), plafon nélkül. A `maxLeads`
   csak opcionális kézi korlát maradt.
2. **A felfedezés (webes keresés) fizetős → kereten belül marad:** futásonként legfeljebb 60 lead keres új adatlapot
   (`DEFAULT_MAX_SEARCH_LEADS`, legszegényebb anyag előre), és csak ott, ahol még van hely a 6 jelöltből.
   `maxSearchLeads: 0` = soha (a backfill így fut). Korábban a keresés minden olvasott leadnél lefutott.
3. **A scrape csak az ÚJ leadeket olvassa** (a store-dedup halmazával — `storedLeadIdentities()` — előre szűrve); a
   tárolt park a `scripts/portal-backfill.mts`-sel kapja meg ugyanezt (szárazfutás alapból, `--go` ír, kötegenként
   ment, `portalLookupAt` jelre folytat; Google-t és keresőt nem hív; `raw || patch` — kurátori mezőt nem ír felül).
4. **Párhuzamosság 2 → 4 host.** Az udvariasság változatlan: hostonként egy kérés, szünettel, robots.txt szerint
   (politeness.ts). Több lead = hosszabb futás, soha nem gyorsabb kalapálás.
5. **`portalLookupAt`** minden olvasott leaden (üres eredménnyel is) — az üres válasz is kész válasz.

**Futásidő, mérve (2026-10-01).** 40 véletlen éles lead valódi olvasása (97 adatlap): 158,7 s 2-es párhuzamossággal.
Ezt a teljes 1 057 jelöltes élesi parkra visszajátszva, hostonkénti sorosítással: **2 → ~100 perc, 4 → ~78 perc,
6+ → ~72–74 perc** — a padló egy host: a **hovamenjek.hu 189 adatlap × ~18 s** (a képeit egyenként, ugyanazon a
hoston méri). Egy tipikus új scrape (~650 új kontaktálható lead) ~45–50 perccel hosszabb. Háttér-sor ezért NEM kell
most: a scrape amúgy is percekig fut, a szívverés-időzítő (`BEAT_EVERY_MS`) a hosszú lépést nem nézi halálnak.
⚠️ Kockázat: a scrape a konzol gyerekfolyamata — egy konzol-újraindítás (deploy) közben megöli; ez eddig is így volt,
de az ablak hosszabb. Ha ez fáj: a scrape csak a leadeket menti, a portál-olvasást a backfill viszi (ugyanaz a szkript,
`portalLookupAt` nélküli leadekre) — ez a háttér-sor kész alapja.

**Mellékleletek (nem ebben a döntésben javítva).** (a) `www.booking.com`: 426 jelölt-URL, 6/6 mintán bot-oldal
(„nem igazolja a márkát ÉS a települést”) — haszontalan olvasás, ~10 perc/teljes kör; a registry `challenge_protected`
jelölése indokolt lehet. (b) a hovamenjek.hu képenkénti mérése adja a padlót; egy kép-méret-cache vagy a mérés
ritkítása a teljes futást ~40 percre vinné.

**Őr.** `scripts/portal-uncapped-check.mts` (pre-commit, hálózat nélkül, fetch-csonkkal): 150 kontaktálható leadből
150 adatlapja olvasódik; `maxSearchLeads: 0` → 0 keresés, `5` → pontosan 5; a nem-lead nem olvasódik; mindenki
`portalLookupAt`-et kap. A régi kóddal 4 állítása bukik.

**Visszafordíthatóság:** 🔄 olcsó (konstansok + egy szűrő). **Elvetett alternatíva:** a plafon egyszerű emelése
(pl. 500-ra) — a keresés is vele nőtt volna, futásonként ~1 400 fizetős Brave-hívással; és a tárolt park így sem kapott
volna olvasást.
