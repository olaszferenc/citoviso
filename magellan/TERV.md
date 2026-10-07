# MAGELLAN — terv (2026-10-07, JAVASLAT, a koordináló és a tulaj jóváhagyásáig nincs implementáció)

> Brief: `~/rc-briefs/magellan-digitalis-scraper-20261007.md`. Döntés-tervezet: `_planning/decisions/XXXX-magellan-digitalis-felderito.md`.
> Charter: `magellan/charter/` (CHARTER · RUNBOOK · ONTOLOGIA). Mockok: `assets/design-refs/_drafts/magellan/` (nem commitolt).

## 1. Mit vált ki — a kódból felmérve (nem a commit-üzenetekből)

| Lépés (`src/scraper/`) | Fizetős hívás | Mit ad a leadnek | Magellan-korszakban |
|---|---|---|---|
| `sources/googleMaps.ts` bejárás | Places Text Search (`places.id` mező; a költség-riport Enterprise-ként árazza) | place id-k | **Magellan a Térképen** (lista görgetése csempénként, 6 kulcsszó) |
| `sources/googleMaps.ts` Details | `GET places/{id}` ($20/1000) | név, koord., cím, település, telefon, honlap, fotó-darab | **Magellan a hely-paneljén** (ugyanezek a tények) |
| `enrichPlaces.ts` | Text Search Enterprise (név + ±0,005° doboz) | telefon/honlap pótlás, `photoCount`, `placesMatch`, `matchConfidence`, értékelés | **kiesik**: Magellan a helyen állva olvassa; az egyezés eleve biztos (a link a helyé) |
| `enrichGuestReviews.ts` | Details `reviews` | `guestReviews[]` | **elhagyjuk** (jogalap: a vélemény szövege nem tényadat) |
| `enrichMaterial.ts` → `streetview.ts` | Street View metadata ($0, de kulcsos hívás) | `material.streetView` | **elhagyjuk** (lásd §4) |
| `enrichSiteSearch.ts` | Brave / Google CSE | saját honlap keresése | **Magellan egy Google-kereséssel** (`"név" település`) |
| `enrichWebSearch.ts` | Brave / CSE (`név település kapcsolat`) | e-mail, telefon, listing-URL-ek | **kiesik a scrape-ből** — Neo végzi leadenként, amikor kiválasztja (charterje 3. pont) |
| `portalListing.ts` (enrichPortal keresés-ága) | Brave/CSE (`név település szállás`), 60/batch | portál-profil URL-ek | **Magellan ugyanabból az egy keresésből** rögzíti a portál-linkeket → a portál-olvasó `knownUrlsOnly` módban, ingyen |
| `enrichOutdated.ts` `repairBrokenSite` | web-keresés-tartalék | halott honlap javítása | keresés-ág **ki**; a domain-gyökér próba marad |
| Ingyenes, marad | — | `osm.ts`, `enrichPresence.ts` (domain-találgatás), `enrichPortal` olvasó, `enrichContact`, `enrichGeo` (Nominatim) | változatlan |

**Nem a scrape, NEM érinti ez a kör** (külön szál, külön döntés): `generator/generate.ts` `askPlaces` (+`lead_places_cache`, ADR-0293), `generateEngine.ts` vélemény-frissítés, `images.ts` Places-fotó és **Street View Static kép** a hős-tartalékban, `reviews/placeRating.ts` (tenant-csillag), `contactViews.ts` Maps JS (tenant-pin), `intake/mockRequest.ts`→`resolveOne.ts` (önkiszolgáló kérés). ⚠️ A „0 Ft” a scrape-re teljesül; a generálás `auto` Places-ága ettől még fizet — tulaj-kérdés (§7 Q6).

**Konzol-gombok, amik a fizetős láncot hívják:** `POST /lead/:id/reenrich` (teljes lánc), `/rescrape-photos` (Brave), `/places-photos` (Places) — a kapcsoló (§5) ezeket is fogja.

## 2. A munkamenet

1. **Régió → csempék.** A munkalap a régió dobozát rácsra bontja (alap: ~10×11 km, ≈ Térkép 13-as nagyítás; a víz-csempék eleve kihagyva). Csempénként mind a 6 `TEXT_QUERIES` kulcsszó (`szállás, hotel, panzió, apartman, vendégház, kemping`).
2. **Lista végig görgetve**, a találatszám rögzítve. **Telítettség** (a ① ≥95% elve, a `scrape-coverage-check` mintájára): ha egy kulcsszó listája >100 találat (a Térkép-lista ~120-nál elvágja; a pontos küszöböt az első munkanap méri, 2026-10-07-i próba: egy 14-es nézet „vendégház” = 78+ találat, 40 mp görgetés), a csempe **négyfelé bomlik**, és a negyedek kerülnek sorra — ugyanaz a mélységi felosztás, mint `googleMaps.ts`-ben.
3. **Felvétel linkkel.** A lista hely-linkjeit (`/maps/place/<név>/…!3d<lat>!4d<lon>…!1s0x…:0x…`) beilleszti; a szerver kiveszi a nevet, koordinátát, Térkép-azonosítót, és **azonnal** az `isSamePlayer` szabállyal (normalizált név + ≤250 m) dönt: ismert lead → nincs vele munka (ADR-0296).
4. **Új helynél** kinyitja a panelt: cím, település, telefon, honlap, fotó-darabszám, (értékelés · db — Q2). A felület normalizál (telefon: `normalizePhone`; honlap: `classifyWebsite`).
5. **Honlap nélküli (vagy portál-linkes) helynél egy Google-keresés**: `"név" település`; a találatok közül a saját honlap / portál-linkek rögzítése + ítélet (nincs · van · bizonytalan), Neo §F-szabályai szerint.
6. **Csempe lezárása** → a szerver az új helyekre lefuttatja az ingyenes láncot (presence, outdated keresés nélkül, portál-olvasás a rögzített URL-ekre, contact, geo) és `persistLeadBatch`-csel ment. Forrás-jel: `sources: ["magellan"]`, `sourceRefs.magellan = <ftid>`.

**Folyamatosság:** minden régió végeztével a következő; a lezárt régiók negyedévente újra (csak a lista-szint; ismert helyet nem nyit ki) — így az új szállások is bekerülnek.

## 3. ⛔ Hogyan kerül a lead a store-ba — változatok

| | **A — egyesével űrlap** | **B — régió-munkalap (JAVASOLT)** | C — fájl-forrás a scrape-nek |
|---|---|---|---|
| Mi | „Felderített hely rögzítése” űrlap, helyenként egy beküldés | Régió → csempe → kulcsszó állapot + hely-sorok, minden mező mentéskor menti magát | Magellan JSONL-t ír `~/magellan/`-ba, a `run.ts` egy `MagellanSource`-ként olvassa |
| Perszóna-elv | ✅ felületen dolgozik | ✅ felületen dolgozik | ❌ pipeline (memória: `feedback_digital_colleague_is_a_person_not_a_pipeline`) |
| Lefedettség (①) | ❌ csak Magellan jegyzetében — nem mérhető | ✅ csempe/kulcsszó állapot a DB-ben; „ismert leadek közül újra látott” % = élő lefedettség-mérő (Balaton-Kelet: 1560 korábbi hely a mérce) | ⚠️ fájlban |
| Elhaló session (ADR-0331) | ⚠️ az utolsó beküldésig rendben, de hol tartott a régióban, azt nem tudja a rendszer | ✅ mezőnként mentett; az új session a munkalapon látja, hol tart | ⚠️ a fájl a dev gépen él |
| Hol a store | éles konzol | éles konzol | ❌ a fájl a CIT dev gépen, a store az éles VPS — fájl-átvitel = élesi írás minden futásnál |
| Ismert hely kinyitása | ❌ csak beküldéskor derül ki | ✅ link-beillesztéskor, kinyitás ELŐTT | ⚠️ futáskor |
| Fejlesztési méret | kicsi | közepes (2 tábla + 1 lap + forrás-adapter) | kicsi |

**Javaslat: B.** Indok: egyedül B tartja egyszerre a perszóna-elvet, a ≥95%-os lefedettség mérhetőségét és az ADR-0331 „semmi nem vész el” elvét; a kontextus-plafon (200k) miatt Magellan sessionje rendszeresen tömörül/átad — a munkalap a „hol tartok” emlékezete, nem a session.

**Adatmodell (B):** `scout_tile` (régió, szülő, bbox, állapot, kulcsszavanként találatszám) · `scout_place` (csempe, név, lat/lon, ftid, link, mezők, keresési linkek + ítélet, állapot: known/new/processed, `lead_id`). A feldolgozás a meglévő `run.ts` láncon fut egy `MagellanSource`-szal (a `scout_place` lezárt sorai a `raw`), tehát a dedupe/batch/persist kód változatlan. Útvonal: `/scout` (konzol-menü: „Felderítés”). Fiók: `magellan` (élesi létrehozás = tulaj-engedély).

## 4. A dúsítás többi fizetős lépése — és mit veszít a mock

| Lépés | Döntés-javaslat | Veszteség | Kit érint |
|---|---|---|---|
| Vendég-vélemények (Places) | **elhagyjuk** | a Google-vélemény mint „vendéghang” kiesik; a portál-vélemények maradnak (`portalProfiles`) | Poe forrás-csomag, Vera tényhűség: kevesebb idézhető forrás, de nincs hamis |
| Értékelés + db | **rögzítjük számként** (Q2) | ha nem: a mock Google-csillag statja eltűnik | generator `attributedRating` |
| Street View metadata | **elhagyjuk** (kulcsos hívás; a Static kép a generátorban fizetős) | a `material` számlálóból 1 alapkép; hős-tartalék nincs → fotó nélküli leadnél Neo eddig is hagyta | Neo leadválasztás (fotó nélküli lead úgyis állt) |
| Fotó-mérés (`placesPhotos`) | **darabszám Magellantól**, fájlt nem veszünk át | a Places-fotó mint mock-kép csak a generátor `auto`/`curator` ágán jön (külön kérdés, Q6) | nyitókép-választás: a portál-fotók maradnak |
| Kontakt-keresés (web) | **Neo leadenként** (már ma is ezt teszi) | a scrape-kori e-mail-arány csökken (Balaton-Kelet: 966/1560 e-mail csatorna, ennek egy része webes keresésből) | a kiküldési sor e-mail-aránya — Neo pótolja a kiválasztottaknál |
| Honlap-keresés | **Magellan egy kereséssel** | — | — |

## 5. A régi API-út sorsa — kapcsoló + visszamérés

- **Ma nincs kapcsoló**; csak a kulcs üresen hagyása állítja le (`GOOGLE_MAPS_API_KEY`, `BRAVE_API_KEY`, `GOOGLE_CSE_ID`, config.ts) — de a kulcs a generátornak és a tenant-funkcióknak is kell.
- **Javaslat:** `SCRAPE_PAID_APIS=off` env (élesen alapértelmezés: off). Hatása: `GoogleMapsSource` kimarad, `enrichPlaces`/`enrichGuestReviews`/`streetview`/`enrichSiteSearch`/`enrichWebSearch`/`portalListing`-keresés/`repairBrokenSite`-keresés no-op, a `/reenrich` és `/rescrape-photos` gomb letiltva (felirattal), és a „Scrape indítása” csak OSM + Magellan forrással fut.
- **Őr:** `scripts/scrape-zero-paid-check.mts` — a teljes láncot mockolt `fetch`-csel futtatja off kapcsolóval, és bukik az első `googleapis.com` / `api.search.brave.com` hívásra (piros önteszttel: on állásban hívást KELL látnia).
- **Visszamérés:** a `google-cost-report` metódusonként számol; a scrape után a `SearchText` és `GetPlace` napi szám csak a generátor/önkiszolgáló hívásokból állhat. Javaslat: külön API-kulcs (credential) a generátornak, hogy a riport credential-bontása szétválassza — akkor a „scrape-kulcs” napi száma pontosan 0.

## 6. Tempó és régió-idő (becslés)

Mérés 2026-10-07 (egy próba, headless, bejelentkezés nélkül): egy kulcsszó-lista 78+ hellyel ≈ 40 mp görgetés; egy hely-panel ≈ 4 mp betöltés.

| Művelet | Emberi tempó | Megjegyzés |
|---|---|---|
| lista (csempe × kulcsszó) | ~45 mp | görgetés + link-beolvasás |
| új hely panel + rögzítés | ~15 mp | ismert hely: 0 (nem nyitja ki) |
| Google-keresés + ítélet | ~45 mp | csak honlap nélküli helynél (~35%); captcha → megáll |

- **Áteresztés:** új helyekre ≈ **150–200 hely/óra** keresés nélkül, **≈ 70–90 hely/óra** a keresésekkel együtt.
- **Balaton-Kelet** (64×46 km, ~1560 hely a 09-28-i futásban): ~250 lista (≈3 h) + 1560 panel (≈6,5 h) + ~550 keresés (≈7 h) ≈ **16–17 munkaóra ≈ 2 munkanap** (napi ~9 óra, óránként 10 perc szünet).
- **Székesfehérvár** (50 km sugár, ~7 850 km², a 10-05-i futásban 5 692 „nincs honlap” jelölt, becslés ~9 000 hely): ~1 200 lista (≈15 h) + 9 000 panel (≈38 h) + ~3 000 keresés (≈38 h) ≈ **90 munkaóra ≈ 10 munkanap**.
- **Újrajárás** (ismert helyek nélkül): Balaton-Kelet ≈ 3–4 óra.
- **Kontextus:** helyenként ~2–4k token (script-olvasás, nem képernyőkép) → ~40–50 hely/150k; Magellan tömörítési pontjai a csempe-lezárások.

## 7. Nyitott tulaj-döntések (ajánlással)

1. **Q1 — Melyik változat?** Ajánlás: **B** (régió-munkalap).
2. **Q2 — Értékelés (csillag + db) rögzítése?** Ajánlás: **igen**, számként (tényadat, a mock Google-csillag statja ezen áll).
3. **Q3 — Google-vélemények elhagyása?** Ajánlás: **igen**, a portál-vélemények maradnak.
4. **Q4 — Street View elhagyása?** Ajánlás: **igen**.
5. **Q5 — Kontakt-keresés: Neo leadenként, a scrape-ből kivéve?** Ajánlás: **igen**.
6. **Q6 — A generátor Places-ága (`auto`) is 0 Ft legyen?** Ajánlás: külön szál; addig `cached` politika a pilot-leadekre.
7. **Q7 — `SCRAPE_PAID_APIS=off` élesen alapból + külön generátor-kulcs?** Ajánlás: **igen**, a nagy deployjal.
8. **Q8 — Munkaidő:** ajánlás: hétköznap és hétvégén 8–20 között, óránként 10 perc szünet, captcha → aznapra leáll és jelent.
9. **Q9 — Régió-sorrend:** ajánlás: Székesfehérvár (a 10-05-i futás elbukott, 0 lead) → Balaton-Kelet újrajárás.
10. **Q10 — `magellan` éles konzol-fiók létrehozása** (élesi írás) — a megvalósítás végén, külön engedéllyel.

## 8. Ütemezés (jóváhagyás után)

1. Terv befagyasztása `assets/design-refs/console/scout-worksheet/` + README (kontraktus).
2. Migráció (`scout_tile`, `scout_place`) · `/scout` lap (dizájn-token; operátor-felület) · `MagellanSource` · `SCRAPE_PAID_APIS` kapcsoló · `scrape-zero-paid-check` őr · KB-szakasz (tudásbázis-őr).
3. Dev-próba egy kis régión (Badacsony) a dev konzolon, Magellan első munkanapja devben.
4. Nagy deploy (a tulaj külön engedélyével) → `magellan` fiók → élesen Székesfehérvár.
