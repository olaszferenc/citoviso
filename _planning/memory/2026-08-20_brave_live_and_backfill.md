# 2026-08-20 — Brave Search ÉLESÍTÉS + a meglévő lead-állomány újradúsítása (backfill)

## Kiváltó
Tulaj: „vezessük be a brave apit, most már fontos elem". A kód (ADR-0026 diszpécser) 2026-08-07 óta
készen állt, csak kulcs nem volt hozzá. A tulaj megszerezte a free-plan kulcsot (1 query/s, ~2000/hó).

## Mi lett kész
1. **Brave élesítve lokálban ÉS prodon.** Két azonnali kódhiba derült ki élő próbán:
   - `country=hu` → **HTTP 422**: a Brave-nek NINCS HU piaca. Helyes: `country=ALL&search_lang=hu`.
   - a free plan 1 q/s-e ellen throttle kellett (a hívók 3 workerrel lőnek) → promise-lánc, 1,1 s köz.
   - guard-hiba: a kontakt-kereső ág még a régi CSE-kulcsra volt kapuzva → tiszta Brave-konfignál
     (= a prod) **némán kimaradt volna**.
2. **`npm run reenrich`** — backfill a MEGLÉVŐ állományra. Kellett, mert az enrichment csak
   scrape KÖZBEN futott, a perzisztálás pedig csak BESZÚR: az átfedés-dedup a létező leadet kihagyja,
   nem frissíti. A 2026-08-07-i 99 lead így sosem látott volna webes keresést.
   Dry-run alapból; `--apply` ír; provenance-nyom minden változásra; outreach utáni fázisú leadhez
   nem nyúl; márka nélküli nevű leadet (csupa köznév: „Ifjúsági szállás") kihagy.
3. **`npm run reenrich:rollback`** + **`scripts/scrub-contacts.mts`** — visszavonó és takarító eszköz.
4. **Éles eredmény (Keszthely és környéke, 111 no_site lead):** 35 lead frissült —
   **10 valódi honlap-felfedezés** + 22 email + 15 telefon. Plusz 9 régi sablon-/intézményi cím törölve.

## A LÉNYEG: négy korrobációs réteg, mind ÉLES fals pozitívból tanulva
A találatok **40 → 13 → 10**-re tisztultak, miközben egyetlen valódi sem esett ki:

| # | Réteg | Amit megfogott |
|---|---|---|
| 1 | geo-horgony a lead **VÁROSÁRA** (ADR-0043, 3. szál) | keszthelyi oldal ≠ révfülöpi lead |
| 2 | **márka-a-domainben** | háziorvosi ügyelet („Ajka Város üdülője"), templomrom („Sarvalyi vadászház"), kerékpáros oldal |
| 3 | white-label **aldomain-farmok** a portál-listán | `3-barat-apartman.hungaryhotel.net`, `hunguesthelios.com-hotel.website` |
| 4 | **megosztott-kontakt őr** | a badacsonytomaji tourinform telefonja KÉT vendégházhoz is eljutott |

**A 2. réteg a szerkezeti nyeremény:** a saját oldal a vállalkozásról van ELNEVEZVE
(`stefivendeghaz.hu`, `agnesalmai.hu`, `kapri.hu`), a róla szóló oldal másnak a domainjén él.
Fontos részlet: **köznév és FÖLDRAJZI token nem korroborál** — „Mária Hotel" ⊂ `balatonmariafurdo.hu`
(városi portál) csapda, ezért a geo-tokeneket ki kell venni a márka-tokenek közül.

## ⛔ Az éles hiba, amit el kellett takarítani
Az ELSŐ éles apply 14 leadet írt, amiből a honlap-találatok **6-ból 4 rosszak** voltak (a régió-címke
horgony miatt). **Teljes visszavonás** (nem szemezgetés): minden érintett `no_site` volt, az eredeti
honlap a `presence_check` provenance-sorban megvolt, a kontaktok csak üres mezőbe íródtak → a revert
determinisztikus. Utána a javított lánccal újra, tisztán.

## ⭐ FŐ TANULSÁG (ugyanaz, amit a 3. szál is kimondott — két úton, egy nap)
**Egyik pipeline-őr sem kapta el a hibát.** A márka+régió `verify()`, a portál-katalógus, a
sekély-útvonal-szabály és a kontakt-korroboráció **mind ZÖLD volt egy rossz eredményen**. Minden
egyes hibát az utólagos, kézi mintavétel fogott meg (megnéztem: a talált oldal említi-e a lead
városát / tényleg az ő üzletük-e). Ezért lett minden lelet **fixture**:
`scripts/geo-verify-check.mts` → 7 geo-eset + **16 márka-domain eset**, mind éles adatból.
Ha egy őr-réteg zöldet ad egy hibás kimenetre, a kódjavítás nem elég — fixture is kell.

## Módosított fájlok
- `src/scraper/sources/webSearch.ts` — country-fix, throttle
- `src/scraper/enrichSiteSearch.ts` — `domainCarriesBrand`, host-címke illesztés, portál-hostok
- `src/scraper/enrichWebSearch.ts` — email-korroboráció, sablon-szűrő, telefon-normalizálás, megosztott-kontakt őr
- `src/scraper/enrichContact.ts` — a honlapról szedett email is átmegy a minőség-kapun (eddig SZŰRETLEN volt)
- `src/scraper/qualify.ts` — ~25 új portál-host (ADR-0037 whack-a-mole, a registry a strukturális fix)
- `src/scraper/reenrich.ts`, `src/scraper/reenrichRollback.ts`, `scripts/scrub-contacts.mts` (újak)
- `scripts/geo-verify-check.mts` — +16 márka-domain fixture
- `.env` (lokál + prod: `BRAVE_API_KEY`), `.env.example`, `package.json`

## Nyitott / következő
- **ADR-0037 platform-registry** — a portál-lista DB-be, kurátori bővítéssel. Minden új régió új
  portálokat hoz (Keszthely egy csapásra ~15-öt); a kódba égetett lista nem skálázódik.
- A `badacsony`/`balaton-north` régió csak LOKÁLBAN létezik (próbafutások); prodon egyedül a
  `keszthely-es-kornyeke` van (417 lead) — ott a backfill kész.
- A `reenrich.ts` generikus-név őre a scrape-útra (`enrichSiteSearch`) is átvihető.
