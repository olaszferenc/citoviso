# Terjeszkedés: Bulgária és Horvátország — rendszer-szintű feltételek és roadmap

Készült: 2026-10-27, `cit0dd5ccc1`. Kód nem változott; ez felmérés és javaslat.

**A keret (tulaj, 2026-10-27):**
- Magellan mehet külföldre is, és ott folytatja a szállás-felderítést.
- **A cél a külföldi vásárlási hajlandóság mérése.**
- A jogi és számlázási rész egyelőre zöld: EV-ként mehet EU-s cégnek és magánszemélynek is. Ezzel most nem foglalkozunk.
- A kérdés kizárólag az, hogy **mi kell a Citoviso rendszerben** ahhoz, hogy egy horvát vagy bolgár szállás ugyanazon a láncon menjen végig, mint egy magyar, és a végén mérni lehessen, vesz-e.

**A lánc:** Magellan felderít → feldolgozás → lead → Neo/Vera/Poe → mock → kiküldés → lead-lap → rendelés/fizetés → mérés.

Jelölés: **K** = kicsi (egy-két nap), **Kö** = közepes (napok, több fájl), **N** = nagy (új integráció vagy átfogó átírás).

---

## 1. Röviden

- **A lánc eleje majdnem kész.**
  - A régiónak van `country` mezője.
  - A vendég-nyelvek között ott a `bg` és a `hr`.
  - A konzol fordított.
  - Nem magyar országnál a lead-lap már ma is az EUR-ás `global` árrégióból olvas.
- **A lánc közepe és vége magyarra van drótozva:**
  - Magellan kulcsszavai magyarok;
  - egy bolgár régió ma magyar mockot kapna;
  - a fizetési út HUF-ot ír;
  - a sablon-fontok nem cirillek;
  - a válaszokat Poe magyar normával kezeli;
  - SMS/MMS csak magyar számra megy.
- **Javaslat:** **Horvátország legyen az első mérés, Bulgária közvetlenül utána.** A horvát már szerepel az ország→nyelv térképben, latin betűs, és a piac nagyobb (kb. 125 ezer magánszállás-objektum, 2025-07), így ott jön előbb értékelhető minta. A bolgárhoz előbb cirill fontok kellenek (lásd 2.3). Magellan mindkét országban dolgozhat párhuzamosan, a kiküldés országonként indul, amikor az adott ország lánca zöld.
- **Időzítés:** a szállásadók tél végén és tavasszal készülnek a szezonra. Ha az első külföldi kiküldés **2027 január–februárban** kimegy, a tavaszi döntési időszakban mérünk. Magellan már novemberben elkezdheti gyűjteni a leadkészletet.

## 2. Ami a láncban országhoz kötött

### 2.1 Felderítés (Magellan) és feldolgozás

| # | Mi | Hol | Nehézség |
|---|---|---|---|
| 1 | A felderítés **hat kulcsszava fix magyar** („szállás, hotel, panzió, apartman, vendégház, kemping”). Külföldön ezekre a Maps rossz vagy hiányos listát ad. Országonként kell kulcsszó-készlet, pl. HR: *smještaj, apartmani, sobe, hotel, kuća za odmor, kamp*; BG: *хотел, къща за гости, стаи за гости, апартамент, къмпинг, вила*. A pontos listát a régi scrape-lefedettséggel egyenértékűen kell belőni. | `src/scout/rules.ts:15` (`SCOUT_KEYWORDS`), munkalap `src/scout/store.ts:283` | K |
| 2 | **A régió országa:** a konzolban rajzolt régió csendben `HU`-t kap, és a mock nyelve a régió országából jön. Régió-létrehozáskor országválasztó kell, csendes alapérték nélkül. | `src/console/data.ts:2496-2504`, `migrations/0018_region.sql:15`, `src/generator/generateEngine.ts:323` | K |
| 3 | **`BG` hiányzik az ország→nyelv térképből.** Ismeretlen országnál a nyelv csendben magyar. (`HR` megvan.) | `src/i18n/lang.ts:14-28`, `:97-99` | K |
| 4 | **Portál vagy saját honlap ítélet:** Magellan és Neo ONTOLOGIA-ja magyar portálokat ismer (szallas.hu, booking…). Kell a helyi portálok listája, hogy egy portál-bejegyzés ne számítson saját honlapnak. HR: apartmanija.hr / direct-croatia.com, adriagate, croatia-booking, privatni-smjestaj; BG: nochuvki.bg, pochivka.bg, bulgariatravel.org. Plusz a domain-heurisztika (`panziosissi.hu`) a helyi TLD-kkel. | `magellan/charter/ONTOLOGIA.md:19-20`, `src/scraper/genericWords.ts`, `src/scraper/qualify.ts:56` | K–Kö |
| 5 | **Dúsítás a feldolgozásban:** a portál-adapterek mind magyarok (zimmerinfo, szallas_hu, hovamenjek…). Külföldi leadnél csendben kimaradnak, ez nem hiba, csak kevesebb fotó. Ha kell helyi fotóforrás, országonként egy adapter. Az első méréshez nem kötelező. | `src/scraper/sources/portals/registry.ts` | Kö (opcionális) |
| 6 | **Brave és Places nyelv:** `search_lang=hu`, `languageCode:"hu"`/`regionCode:"HU"` fixen. Magellan útján a fizetős Places nem fut, a honlap-keresés viszont igen. | `src/scraper/sources/webSearch.ts:72-77`, `src/scraper/resolveOne.ts:104-105,227-228` | K |
| 7 | **Telefon:** a normalizálás csak magyar formátumot ismer. A `+385` és `+359` szám megmarad, de nem validálódik, és az ikerlead-összevonás telefon alapján erre épít. | `src/text/phone.ts:22-66` | Kö |
| 8 | **Magellan charter/RUNBOOK:** a kulcsszó-lista, a honlap-ellenőrző Google-keresés („`"<név>" <település>`”) és a portál-lista országonként. A Maps felülete maradhat magyar nyelvű. | `magellan/charter/RUNBOOK.md`, `CHARTER.md:27` | K |

### 2.2 Kollégák (Neo, Vera, Poe)

| # | Mi | Hol | Nehézság |
|---|---|---|---|
| 9 | **Neo és Poe nyelvi normája** „természetes magyar, magázás”. Kell a célnyelvi norma (HR: Vi, BG: Вие), és az, hogy horvát vagy bolgár leadnél a kurálás és a levélszöveg a lead nyelvén készüljön. | `neo/charter/RUNBOOK.md:79`, `poe/charter/RUNBOOK.md:68` | Kö |
| 10 | **Válaszok:** a válasz-figyelő a jegyet Poe-nak adja. Horvát vagy bolgár válasznál Poe a lead nyelvén javasoljon választ, **és mellé magyar fordítást** a tulajnak, aki a küldésről dönt. | `~/rc-briefs/watch/valasz-watch.py`, Poe RUNBOOK | Kö |
| 11 | **Kontakt:** SMS/MMS csak magyar mobilra mehet. A csak telefonos külföldi lead így elérhetetlen, a kollégák a kontaktgyűjtésnél **e-mailt** keressenek. A sorba tételnél a csak telefonos külföldi leadet ki kell szűrni. | `src/outreach/sendOutreachSms.ts:307-314` | K |

### 2.3 Mock

| # | Mi | Hol | Nehézság |
|---|---|---|---|
| 12 | **Cirill fontok (csak BG):** a sablon-fontok latin betűsek. Skinenként kell cirill lefedettségű font vagy fallback, ellenőrzés `ui-shot`-tal bolgár mintán. | `src/engine/skins.ts:503` | Kö |
| 13 | **A kritikusok magyar emberként ítélnek** („Ilyet magyar ember nem ír”, „balatoni panzió tulajdonosa”). Horvát és bolgár mocknál a célnyelv anyanyelvi olvasójaként kell ítélniük, különben a minőségkapu vak. | `src/generator/guestCritic.ts:173,550`, `src/outreach/letterCritic.ts:89-90`, `src/generator/marketCheck.ts:659`, `src/generator/copy.ts:27-32`, `aiMock.ts:48,74`, `heroPick.ts:281` | Kö |
| 14 | **Magyar ágazati elemek ne jelenjenek meg:** NTAK, IFA (gyerekmentesség), SZÉP-kártya, Balaton-logika csak HU-ban. | `src/engine/recipe.ts:492-499`, `src/engine/copywriter.ts:99-101`, `src/events/gates.ts:130-170`, `src/booking/requests.ts:111,126` | Kö |
| 15 | **A promptok magyarok**, a célnyelv egy hozzáfűzött sor. Működik, de a 13. pont kritikusa méri, hogy elég-e. Ha nem, a promptot kell célnyelvre szabni. | `src/generator/brief.ts:410`, `src/engine/copywriter.ts:158` | K, mérés után Kö |
| 16 | **Vendég-nyelvek a mockon:** HR-ben horvát elöl, mellette DE, EN, SL, PL, CZ, IT; BG-ben bolgár elöl, mellette RO, EN, DE, PL. A 29 nyelv megvan, csak az országonkénti alapkészlet kell. | `src/i18n/lang.ts:40-76` | K |

### 2.4 Kiküldés

| # | Mi | Hol | Nehézság |
|---|---|---|---|
| 17 | **A piac-kapu** HR és BG piacra zárva van, a kiküldés-kapu ezt nézi. Nyitása konzol-művelet (Beállítások → Piacok), tulaj-engedéllyel. | `src/markets.ts:38-47`, `src/outreach/outreachCheck.ts:589-613` | K |
| 18 | **A hideg levél** T()-vel fordított, és a mock nyelvét követi. Kész, csak a horvát és bolgár csomagot kell legenerálni és átnézni. | `src/outreach/draft.ts:774` | K |
| 19 | **A prospect-oldal kerete** (a mock alatti tájékoztató) fordítatlan magyar szöveg, magyar Grt.-hivatkozással. Horvát vagy bolgár vevő magyar szöveget látna. Fordítás kell, a tartalmat most nem írjuk át. | `src/console/prospectNotice.ts:42-60` | K |
| 20 | **Küldési ablak és sor:** az ablak fix `Europe/Budapest` (HR azonos zóna, BG +1 óra). A diszpécser napi 40-es sora nem ismer országot. A méréshez országonkénti kvóta kell (pl. napi X HR, Y BG), különben a magyar sor kiszorítja a külföldit. | `src/sms/sendWindow.ts:20-57`, diszpécser (ADR-0405) | K–Kö |

### 2.5 Lead-lap, rendelés, fizetés

| # | Mi | Hol | Nehézság |
|---|---|---|---|
| 21 | **EUR-ár a lead-lapon:** nem magyar országnál a régióválasztó a `global` (EUR) régiót adja. Az „Árak és rendelés / havi X-tól” pirula elvben már euróban mondja. A modulárak viszont egyetlen HUF-térképben vannak. Kell: HR és BG ár eldöntése (közös `global` vagy külön régió), modulár EUR-ban, és ellenőrzés egy horvát lead-lapon. | `src/pricing.ts:74,114,126-160,520-533`, `src/modules.ts:145,268` | Kö |
| 22 | **A fizetési út HUF-ot ír:** 6 helyen `currency:"HUF"`, `CARD_VERIFY_AMOUNT_HUF`, „Ft-os díjból”, a táblák alapértéke `'HUF'`. A Barion tud EUR-t, a locale fix `hu-HU`. **Ez a mérés kulcsa:** a vásárlási hajlandóság a fizetésnél dől el, és ma egy horvát vevőt forintos fizetésre vinnénk. | `src/payment/service.ts:62,216,230,896,908,1061,1073,1404`, `src/payment/barion.ts:133,196`, `migrations/0006:10`, `0007:15`, `0031` | Kö–N |
| 23 | **Számla EUR-ban, vevő nyelvén:** a Számlázz.hu tud EUR-t és angol/horvát nyelvű számlát. Nálunk a nyelv fix magyar, a tételszöveg magyar. A vevő országa alapból HU, és csak a 4 jegyű magyar irányítószámot fogadja el. | `src/invoicing/szamlazz.ts:152`, `src/payment/service.ts:1695-1699`, `src/billing/buyer.ts:163-180` | Kö |
| 24 | **Domain a csomagban:** csak `.hu` van a TLD-táblában. Egy csomag, ami „saját .hu domaint” ígér, horvát vevőnek értelmetlen. Döntés kell: külföldön domain nélküli alapcsomag (`<slug>.citoviso.com`), vagy `.com.hr` (Websupport 6 200 Ft/év) és `.eu`. A `.hr` (52 799 Ft/év) és a `.bg` (39 599 Ft/év) drága az árhoz képest. | `migrations/0105_package_module_domain_tld.sql:43-46`, `src/domains/registrar/websupport.ts` | K (domain nélkül) / Kö (új TLD) |
| 25 | **Tenant-admin a vevő nyelvén:** a saját felületek nyelvei a COUNTRY_LANG-ból jönnek. BG nélkül bolgár admin nincs (lásd 3. pont), HR-ben van. | `src/i18n/lang.ts:125-127` | K |

### 2.6 Mérés

| # | Mi | Hol | Nehézság |
|---|---|---|---|
| 26 | **Ország szerinti tölcsér:** felderített → lead → mock → kiküldve → megnyitás → mock-nézés → „Árak és rendelés” kattintás → rendelés → fizetés. Az ország-facet megvan (ADR-0038/0040), a lead országa csak a `raw` jsonb-ben. Egy riport-nézet kell ország-szűrővel, magyar összevetéssel. | `lead.raw.country`, konzol Riport | K–Kö |

## 3. Roadmap

Minden fázis végén van egy **kapu**. A fázisok egymásra épülnek, de Magellan az 1. fázis után végig gyűjthet, a többi addig készül.

### 0. fázis — Tulaj-döntések (most)

Lásd az 5. fejezetet: sorrend, mintaméret, ár, domain a csomagban, régiók.

### 1. fázis — Magellan külföldön (2026-11 első fele)

- **Tartalom:** 1, 2, 3, 4, 6, 8, 11. pont.
- **Javasolt induló régiók:**
  - **HR:** Isztria vagy Kvarner (Krk, Opatija), illetve Dalmácia egy része (Split-Dalmácia a legsűrűbb, 33 ezer objektum).
  - **BG:** Nesebar/Sunny Beach vagy Sozopol, plusz Bansko a téli kontrollnak.
- **Kapu:** országonként egy próbacsempe végigmegy (felderítés → zárás → feldolgozás). A leadek országa helyes, a portál-bejegyzés nem számít saját honlapnak, és a horvát és bolgár kulcsszavak lefedik a helyeket.
- Utána Magellan folyamatosan gyűjt.

### 2. fázis — Mock a vevő nyelvén (2026-11 → 12)

- **Tartalom:** 9, 12, 13, 14, 15, 16. pont. A cirillt (12) csak a BG-hez kell, ezért **a HR előbb kész**.
- **Kapu:** országonként 10 mock zöld a tényhűség-, a dizájn- és a célnyelvi kritikuson. A bolgár mockon nincs hibás vagy fallback-betű (`ui-shot` 390 px + asztali). Nincs rajta NTAK, IFA, SZÉP vagy Balaton.

### 3. fázis — Rendelés és fizetés EUR-ban (2026-12, a 2. fázissal párhuzamosan)

- **Tartalom:** 21, 22, 23, 24, 25. pont.
- **Kapu:** egy teszt-vevő végigmegy egy horvát lead-lapról EUR-ban: lead-lap ár → rendelés → Barion EUR → Számlázz.hu EUR-számla a vevő nyelvén → tenant-admin horvátul. Mindez lokálon, Elekkel, utána élesítés külön engedéllyel.

### 4. fázis — Kiküldés és válaszok (2027-01)

- **Tartalom:** 10, 17, 18, 19, 20. pont.
- **Kapu:** a horvát levél és a prospect-keret átnézve; a válasz-figyelő egy horvát próbaválaszra horvát javaslatot és magyar fordítást ad; a diszpécser országkvótával tölt.
- Utána **a HR piac-kapu nyílik** tulaj-engedéllyel, majd a BG, amikor a 2. fázis bolgár kapuja is zöld.

### 5. fázis — Mérés (2027-01 → 03)

- **Tartalom:** a 26. pont, plusz a mintavétel.
- Országonként előre rögzített mintaméret (pl. 300 kiküldött mock) és kiértékelési pont.
- Összevetés a magyar tölcsérrel ugyanazon lépésekben.
- **Döntés a végén:** melyik ország megy tovább, és ott mi kell még (helyi fotóforrás, domain, ár).

## 4. Ami már kész, nem kell hozzányúlni

- A régiónak van `country` mezője.
- Az OSM ország-paraméteres (`src/scraper/sources/osm.ts:58-66`), és van `COUNTRY_AREAS` (`src/scraper/run.ts:161`).
- 29 vendég-nyelv, köztük `bg` és `hr`. AI-fordított `language_pack` önpótló betöltéssel.
- A konzol és a tenant-admin fordított, az operátor nyelve fiókonként állítható.
- A hideg levél és a vevői levelek a vevő nyelvén mennek (ADR-0067/0070).
- A piac-kapu és annak konzol-panelja (ADR-0111).
- `Intl` pénzformázás EUR-ra (`src/text/money.ts:40`).
- VIES-ellenőrzés horvát és bolgár formátummal (`src/billing/taxId.ts:21-52`).
- A TLS és a DNS TLD-független.
- A `tenant.time_zone` oszlop létezik.
- Az SMS-kapu már ma sem küld külföldi számra, tehát nincs véletlen kiküldés.

## 5. Döntési pontok a tulajnak

1. **Sorrend.** Ma mindkét ország zárva. Javaslat: Magellan novembertől mindkét országban gyűjt, a mock és a kiküldés **Horvátországban indul előbb**, mert nincs cirill munka. Bulgária utána, amint a fontok készen vannak. **Igen / nem?**
2. **Ár.** Nem magyar leadnél a lead-lap ma a `global` EUR-árat mutatná. Mennyi legyen havonta HR-ben és BG-ben? Egy közös EUR-ár, vagy országonként külön? A magyar alapcsomag „havi 2 780 Ft-tól”, ez kb. 7 €.
3. **Domain a külföldi csomagban.** A `.hu` külföldön értelmetlen, a `.hr` és a `.bg` drága. Javaslat: az első mérésben **domain nélküli** alapcsomag (`<slug>.citoviso.com`), és a `.com.hr` (kb. 16 €/év) kiegészítőként. **Igen / nem?**
4. **Mintaméret.** Hány kiküldött mock után ítéljük meg a vásárlási hajlandóságot országonként? Javaslat: 300, a napi magyar sor mellett külön kvótával.
5. **Régiók.** HR: Kvarner/Isztria vagy Dalmácia? BG: tengerpart (Nesebar/Sozopol) + Bansko? Vagy más?

## 6. Források

- HR magánszállás-objektumok, 2025-07: https://www.croatiaweek.com/croatia-adds-over-1300-new-private-rentals-in-2025/
- HR vendégéjszakák nemzetiség szerint, 2025: https://total-croatia-news.com/news/croatian-tourism-2025-3/
- BG vendégstatisztika, 2024: https://tourism.government.bg/sites/tourism.government.bg/files/documents/2025-06/godishna_statistika_2024.pdf
- BG euró 2026-01-01-től: https://trade.ec.europa.eu/access-to-markets/en/news/bulgaria-adopts-euro-1-january-2026
- Websupport TLD-árak: https://www.websupport.hu/arlista
- HR versenytárs, Rentlio (15 €/egység/hó): https://rentl.io/en/pricing
- Kód-hivatkozások: a táblázatokban, a `cit0dd5ccc1` munkafa 2026-10-27-i állapota szerint.
