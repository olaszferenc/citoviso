# 2026-09-14 — B3: operátor lead-lista és lead-lap (Elek FK-003 + FK-003b, 23 lelet)

**Szál:** `wt/leadlistalap` · **Alap:** `origin/main` = `4535965`
**Állapot:** ✅ A LISTA JÓVÁHAGYVA ÉS MEGÉPÜLVE (ADR-0160). A lead-LAP (②) változat-döntése
külön jön — ahhoz nem nyúltam.

---

## Mit szállítottam

### ① Navigációs hibajavítás — a visszairányítás MEGNEVEZI a fület (`src/console/server.ts`)

A bejelentett lelet EGY példány volt: a „Mock generálása” gomb a „Mock és generálás” fülön
ül, a `POST /lead/:id/generate` viszont horgony NÉLKÜL irányított vissza (`/lead/:id`).
A fül-kapcsoló `fromHash()`-e üres hash-re hamisat ad → az ELSŐ fül marad nyitva, vagyis a
kurátort a SAJÁT gombnyomása dobta át az „Adatok” fülre.

**Az őr a bejelentésen FELÜL még HATOT talált** ugyanabból a hibaosztályból (összesen tehát
**7** visszairányítás javult). Mindegyiknél
KÜLÖN eldöntöttem, hol van a gomb (nem egységes szabályt húztam rá —
`feedback_widening_a_shared_list_needs_per_consumer_decision`):

| útvonal | a gomb helye | horgony |
|---|---|---|
| `/generate` | artefaktum/generálás panel | `#ls-mocks` |
| `/convert` | artefaktum-kártya | `#ls-mocks` |
| `/disqualify`, `/requalify` | `disqualifyPanel` → Audit fül | `#ls-admin` |
| `/request-payment` | rendelés-panel | `#ls-orders` |
| `/prospect/:id/sent` | megkeresés-panel | `#prospects` (alias) |
| `/data` | Adatok fül (= az ELSŐ fül) | `#ls-data` — ma is jó helyre ért, de VÉLETLENÜL |

⚠️ **Az őröm ELSŐ változata KÉT ÉP útvonalat jelentett hibásnak:** a `reenrich` és a
`rescrape-photos` a célt több sorra tördelve fűzi össze (`…?flash=…` + `&flashKind=…#ls-photos`),
és a sor-alapú mintám a fragmentet a második sorban nem látta. A javítás a TELJES hívást
olvassa (`redirect(res, …);`), nem egy sort.

**Őr:** `scripts/lead-tab-anchor-check.mts`, pre-commitba kötve
(`src/console/(views|server).ts` triggerrel). KÉT réteg, mert egyik sem elég:
① **viselkedés** — hermetikus render (se DB, se szerver) → ideiglenes fájl → böngésző:
MÉRI, hogy horgony nélkül tényleg az első fül nyílik, `#ls-mocks`-szal tényleg a mock-fül,
és hogy a kettő szét is válik. Ez a szabály MÉRT oka.
② **hívási hely** — a forrásban minden lead-visszairányítás visel fül-horgonyt, és a horgony
LÉTEZŐ fülre (vagy a fül-JS ismert aliasára) mutat.
**Piros önteszt lefuttatva:** a visszarontott forráson (fragment levéve) pirosra megy.

⚠️ **ÉS AZ ŐRÖM BEKÖTÉSE IS HIÁNYOS VOLT:** a landolási rebase alatt beérkezett a friss
`guard-wiring-check` (ADR-0152, meta-őr), és AZONNAL kimérte, hogy a triggerem
(`^src/console/(views|server)\.ts$`) **nem illeszkedik az őr SAJÁT fájljára** — vagyis az
őr átírása egyetlen kaput sem indított volna el. Egy őr, ami a saját gyengítését nem veszi
észre, félkarú. Javítva; a meta-őr utána zöld. Tanulság: egy másik szál frissen landolt
kapuja a rebase pillanatában kezd rám vonatkozni — a land nem formalitás, hanem mérés.

### ② §2b terv-kör — 4 kattintható változat, MEGÁLLVA

`assets/design-refs/_drafts/` (gitignore-olt): `lista-A/B.html`, `leadlap-A/B.html` +
8 PNG (mind a 4 változat MINDKÉT méreten). Részletes átadó: a munkafa gyökerében a
`TERV-KESZ.md`.

- Mindegyik önhordó, `--citui-*` tokenekből, **valós dev-DB adattal**, működő gombokkal,
  `@container`-alapú „Mobil 390px / Asztali” váltóval (telefonon mobil módban indul).
- **Lista A vs B:** marad-e a 11 oszlopos tábla (ragadó Név oszloppal telefonon), vagy
  döntés-első nézet legyen kevesebb oszloppal és telefonon KÁRTYÁKKAL.
- **Lead-lap A vs B:** a lap első kérdése a „mennyire megbízható az adat” (megszólaló
  fejléc-metrika), vagy a „hol tart ez a lead, mi a következő” (6 állomásos munkamenet-sáv).
- **Mérés:** asztalin 0 px túllógás, 0 levágott cella, **0 JS-hiba**; 25 kattintás-állítás zöld.
- ⛔ **Négy kép kezdetben HIÁNYZOTT:** a lead-lap két változatának LEGNAGYOBB különbsége
  (artefaktum-KÁRTYÁK vs. összehasonlító TÁBLA) a „Mock és generálás" fülön ül, a `ui-shot`
  viszont a lap ÉRKEZÉSI állapotát fényképezi (ott az „Adatok" van nyitva) — a tulaj olyan
  képen döntött volna, amiről a döntés fele hiányzik
  (`feedback_mock_omitted_the_broken_half` ismétlődése). Pótolva: `*-mockful-{desktop,mobile}.png`.

⛔ **A felület-fájlokban (`views.ts`, `citui-console.css`) EGY SORT SEM írtam.** A
`surface-plan-scan.mjs` kapu blokkolta az első próbálkozásomat, és **kivételt magamnak nem
adtam** (ADR-0068). Emiatt a „tizedesvessző”, a „nyers angol enum”, a „`.pill` nowrap” és a
„piros eladó-jelvény” is a terv-körbe került, pedig önmagában mindegyik apró — a helyes
sorrend így is a kapu.

---

## Mit MÉRTEM (a lelet premisszáit újra, nem hittem el)

- **FOTÓK = plafon:** 595 leadből **365-nek pontosan 10** a `placesPhotos`-a, **168-nak 0** →
  90 % a két szélsőértéken. A 10 a Google felső korlátja, nem darabszám.
- **MATCH-torlódás:** **54 lead** értéke pontosan `0.8500000000000001`, **109-é** NULL; a
  maradék 432 gyakorlatilag mind egyedi. (A brief 54/109-et mondott — stimmel.)
- **Három képszám egy leadről (ELEK-TESZT, mérve):** `raw.material` = `{totalImages: 12,
  placesPhotos: 0, portalPhotos: 11, streetView: true}` → az Adatok fül **12**-t ír, a bontás
  **0+11+0 = 11**-et ad (a Street View „igen”-ként szerepel, de számként beleszámít), az
  artefaktum `inputs.photos` pedig **10**. Három szám, három helyen.
- **A „18-ból” nevező nem csak a scrape-ből jön:** `generateEngine.ts:687`
  `marketAmenityTotal = groupAmenities(sourcedAmenities).length`, és a `sourcedAmenities` a
  `:400` környékén az **LLM által a prózából kinyert** tényekkel bővül → futásonként változhat.
- **A fül-számlálók:** 7 fülből 6 visel magyarázat nélküli számot, a „Fotók” egyet sem
  (`views.ts:3939` — nincs `count`), így a hiánya „üres”-nek olvasódik.

### ⚠️ BIZONYTALAN LELET → MÉRÉSI MŰTERMÉK (kimondva)

„19 üres sablon-kártya közül kell kinézetet választani” — **nem reprodukálható.** Mérve:
19 kártya, **19 névvel**, 19 bélyegkép a lemezen (57 fájl, mind > 40 kB), és a fülre kattintva
**19/19 betöltve** asztalin ÉS telefonon; az utolsó kártyára görgetve is 19/19. Egyszer, hideg
gyorsítótárral 390 px-en 13/19-et mértem 1,5 mp után, másodjára 19/19 → amit a mély,
teljes-lapos felvétel elkapott, az a `loading="lazy"` ÁTMENETI állapota. Javítás nem indokolt.

---

## Két csapda, amit a saját vázlataimon mértem ki

1. **A `[hidden]` semmit nem ér, ha a szabály `display`-t ad:** a `.pill{display:inline-block}`
   (0,1,0) üti a böngésző `[hidden]{display:none}`-ját → a „van jóváhagyott mock” jelölés a
   kezdőképernyőn is látszott. (Ugyanaz az osztály, mint a `reference_console_photo_proxy`
   `display:flex` csapdája.)
2. **Az animált keret közben mérve HAZUDIK:** a `transition: width .18s` miatt a méret-váltó
   után azonnal mérve a szélesség még animált, és a `@container` query sem lépett életbe — az
   első mérésem ezért mondta, hogy „nem vált mobilra” és „mobilon is tábla van”. A vázlat
   végig jó volt, a MÉRÉS volt korai.
3. **A teljes-lapos felvétel a `position:fixed` fiókot a meghosszabbított lap aljára festi**,
   ezért a `lista-B` telefonos képén NYITOTTNAK LÁTSZIK a magyarázat-fiók. Geometriával mérve
   indulásnál a képernyőn kívül van — a verdikt geometria, nem kép
   (`reference_fullpage_shot_hides_dead_sticky` ismétlődése).
4. ⛔⛔ **A SAJÁT MÉRŐSZALAGOM VAK VOLT A REJTETT FÜLRE.** A „levágott cella" ellenőrzés a
   lap ÉRKEZÉSI állapotán futott, ahol a „Mock és generálás" panel `display:none` — ott
   pedig MINDEN elem `scrollWidth`-e 0, tehát a mérés némán átengedte a mock-fülön ülő
   levágott sáv-feliratot („3 kimaradt" 390 px-en kilógott a színes szakaszból). A javítás:
   a mérés VÉGIGJÁRJA a füleket (7/7), és csak a ténylegesen látható (`offsetParent !== null`)
   elemeket ítéli. NEGATÍV KONTROLLAL igazolva: a visszarontott vázlaton 1 levágást talál,
   a javítotton 0-t. (`feedback_guard_scope_is_the_doctrine` ismétlődése.)
5. ⛔⛔ **ÉS UGYANEZ A MÉRÉS ZÖLDRE ÉRTÉKELTE A SAJÁT NAPLÓZOTT BUKÁSÁT:** kiírta, hogy
   „levágott: 3 kimaradt", és a záró sor mégis „✅ minden vázlat befér" volt — a `bad`
   számláló csak a túllógásra és a JS-hibára nőtt. Ami bukást naplóz és átengedi, az
   bizalmat gyárt (`feedback_recorded_failure_must_not_grade_green`). A levágás mostantól
   bukás; öntesztelve mindkét irányban.

---

## Módosított / létrehozott fájlok

- `src/console/server.ts` — 6 visszairányítás fül-horgonyt kapott (1770, 1794, 2389, 2395,
  2447, 2704, 2721)
- `scripts/lead-tab-anchor-check.mts` — ÚJ őr (viselkedés + hívási hely, piros önteszttel)
- `hooks/pre-commit` — az őr bekötve
- `TERV-KESZ.md` (munkafa gyökér, nem verziózott) — a terv-kör átadója
- `assets/design-refs/_drafts/` (gitignore-olt) — 4 HTML + 8 PNG + 3 eldobható mérőszkript

## Nyitott

- ⛔ **A tulaj döntése a 4 változatról** — addig a `views.ts` / `citui-console.css` nem mozdul.
- **ADR SZÁNDÉKOSAN NINCS MÉG:** a döntés nem született meg. A jóváhagyás után egy ADR viszi
  a teljes csomagot (állapot-szótár · szám-formátum · plafon- és alapérték-jelölés ·
  jelmagyarázat helye · a visszairányítás fül-horgonya). A sorszámot közvetlenül írás előtt,
  `git fetch` után kell foglalni (`feedback_adr_number_can_collide_at_land`).
- **Diszkvalifikált nézet:** nem mondja meg, miért/mikor/ki, és a LISTÁRÓL nincs
  visszaminősítés (a `requalify` útvonal létezik, de csak a lead-lap Audit fülén). Külön döntés.
- **A NÉV oszlop törhetősége** (`overflow-wrap: anywhere`) egy KORÁBBI, dokumentált javítás —
  a két vázlat két külön módon kerüli meg; ha a teljes név MINDIG kell, az harmadik út.
- **A „Régió” sor** (`views.ts` 3148/3019) az A3 szálnál — nem nyúltam hozzá.

---

## ⛔⛔ Menet közben talált ütközés: a `land.sh` törli azt, amire a terv-kapu vár

`scripts/land.sh:112-117` (ADR-0077) a sikeres landolás végén `rm -rf`-eli az
`assets/design-refs/_drafts/` mappát. Az ADR indoklása:

> „Veszélytelen: a vázlatok gitignore-oltak, EGY paranccsal determinisztikusan
> újragenerálhatók, a JÓVÁHAGYOTT terv pedig nem itt él…"

**Ez a premissza a kézzel írt §2b mockokra NEM áll.** A `lista-A/B.html` és a
`leadlap-A/B.html` nem generált kimenet — nincs az a parancs, ami újracsinálja. Vagyis ha egy
szál a terv-kapunál ÁLL (a tulaj döntésére vár), de közben landolja a nem-kinézeti részét, a
land **megsemmisíti azt, amiről a tulajnak döntenie kell** — és a `TERV-KESZ.md` útvonalai
halott hivatkozásokká válnak. Némán: a land zöld záró sora semmit nem mond róla.

Kezelve ebben a szálban: másolat a fán KÍVÜLRE (`~/terv-b3-backup/`) a land előtt,
visszaállítás utána, és a fájlok létezése ellenőrizve.

**Nyitott szabály-kérdés (nem az én döntésem):** a takarítás ne fusson, ha a szálon nyitott
terv-kapu áll — a jelzés kézenfekvő lenne (a fa gyökerében ott a `TERV-KESZ.md`, vagy a
felület-kapu tokenje nincs `approved` állapotban). Ez az ADR-0077 kiegészítése lenne.


---

## 2026-09-14, második felvonás — a döntés megszületett, a lista megépült (ADR-0160)

**Tulajdonosi döntés:** az **A** változat (tábla, ragadó NÉV oszloppal). Kontraktus
befagyasztva: `assets/design-refs/console/lead-list/` — `plan.html` + `README.md` (10 kötő
pont) + mindkét méret képe + az ELVETETT „B" is, hogy a döntés MIRE mondott nemet, az is
dokumentálva legyen.

**Mind a 10 pont megépült**, a felirat-változás fogyasztóival együtt (2 súgó-cikk, 2
Elek-forgatókönyv, 2 szomszéd őr, 1 glifa-kivétel, 1 kontraktus-őr).

### ⭐ Az őr, ahogy a tulaj kikötötte

`scripts/lead-list-plan-check.mts` a ragadást **VALÓDI GÖRGETÉSSEL** méri: elgörgeti a
konténert, és a NÉV cella KÉPERNYŐ-koordinátáját hasonlítja össze előtte/utána — **egy
NEM-ragadó oszlopon igazolva, hogy a görgetés tényleg megtörtént** (különben egy halott
görgető-doboz is „ragadásnak" látszana), és előfeltételként megkövetelve, hogy a táblázat
tényleg túllógjon. A `getComputedStyle` és a teljes-lapos screenshot mindkettő zöldet adna
egy sosem tapadó oszlopra is.

### ⛔⛔ A SAJÁT ŐRÖM KÉT ÁLLÍTÁSA NEM MÉRT SEMMIT

Csak a piros önteszt mutatta meg:
- a **`nowrap`-állítás** 1280 px-en tördelés-engedéllyel sem tört meg (a MOCK oszlop elég
  széles) — a geometria üres halmazon mért. Most a HATÁLYOS `white-space` értéket is kimondja.
- a **sormagasság-állítás** MINDEN sor azonosságát követelte, holott a két jelölést viselő
  sor (kiküldött megkeresés) legitimen magasabb. A mérce a NÉV okozta egyenetlenség.

**Egy zöld őr önmagában nem bizonyíték** — csak a piros önteszttel együtt az.

### ⛔⛔ Egy IDEGEN őr aktívan rombolt egy másik szálban

A `renewal-date-coherence-check` **FIX nevű** scratch-adatbázist és determinisztikus
fixture-tokent használt. Két párhuzamos szál így UGYANABBA az adatbázisba lép be, és a
`DROP DATABASE IF EXISTS` a MÁSIK, éppen FUTÓ szál adatbázisát dobja el — nem csak ütközés,
hanem aktív rombolás. Ez állította meg a commitomat (`23505 duplicate key`: előbb
`prospect_token`, majd `pg_database_datname`), pedig a diffem hozzá sem ért.
Futásonként egyedi névre véve; **két egyidejű futással bizonyítva**: előtte A rc=1 / B rc=0
két ütközés-hibával, utána A rc=0 / B rc=0, 0 ütközés, 0 árva adatbázis.

### Öt kapu fogott meg valódi rést — mind a commit ELŐTT

| kapu | lelet |
|---|---|
| `i18n-pseudo-check` | a `?` és a `⇄` glifa nem ment át a nyelvi csomagon → kivétel, NEGATÍV kontrollal („Mit jelent?" továbbra sem megy át) |
| `contract-drift-check` | a README-ben a `**„…"**` alak FELIRATOT jelöl — a változat NEVE nem az |
| saját önteszt | a fenti két üres állítás |
| `renewal-date-coherence-check` | a fenti scratch-DB rombolás |
| `kb-check` | a súgó olyan feliratot idézett, ami ÖSSZERAKOTT (`10+ plafon`, `mock: legenerálva`) — a súgó most a részeket idézi |

### Nyitott

- ⛔ **A lead-LAP (②) változat-döntése** — addig a `/lead/:id` ELRENDEZÉSE nem mozdul.
  (Az állapot-SZÓ tulajdonosi rábólintással már átment oda is, hogy két szomszédos képernyő
  ne mondjon mást ugyanarról.)
- A diszkvalifikált LISTA-nézet nem mondja meg, MIKOR és KI zárta ki a leadet, és a listáról
  nincs visszaminősítés.
- Az irányítópult „13/14 eladó" PIROS jelvénye — ugyanaz a hibaosztály, de másik felületen.
