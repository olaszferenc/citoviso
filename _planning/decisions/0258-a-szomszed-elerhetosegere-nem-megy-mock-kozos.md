## ADR-0258 — A szomszéd elérhetőségére nem megy mock: közös elérhetőség = küldési kapu, közepes Places-egyezésből nincs elérhetőség

**Dátum:** 2026-09-28 · **Státusz:** elfogadva (lokál, nem élesítve — a nagy deployjal megy) · **Kiegészíti:** ADR-0039
(kereszt-futás dedup), a Duplikátumok lap (`src/console/duplicates.ts`, `lead_link`), §F.17b (A4 konfidencia) ·
**Őrök:** `scripts/shared-contact-gate-check.mts`, `scripts/places-match-check.mts`

### Kiváltó

A tulaj kérdése: „ha a scrape-ben van területi átfedés, kezeljük a duplikátumokat?” — majd: „mitől lesz biztos
duplikátum a duplikátum? Annál rosszabb szinte nincs is, mint hogy egy mockot a rossz elérhetőség miatt a szomszéd
konkurenciának küldjünk el.” — és a megvalósítást rám bízta („Rád bízom”).

### A mért állapot (dev DB, 599 lead)

- Az átfedés-dedup (ADR-0039) csak **eldob** (név + ≤250 m) — téves egyezésnél leadet veszítünk, levél nem megy rossz
  helyre. Ez a biztonságos irány, NEM itt volt a hiba.
- A kár a **Places-párosításban** született (`enrichPlaces` → `placesLookup`): a névszűrő bármely >3 betűs közös szót
  elfogadott („apartman”, „hotel”), a legközelebbi nyert, és a **közepes** sáv (0,45–0,7) telefonja + honlapja
  ellenőrzés nélkül a leadre került — holott a §F.17b szerint a közepes sáv felülvizsgálatot igényel.
  Mérve: 8 szomszéd-pár, ahol a közepes oldal a másik üzlet telefonját/e-mailjét viseli (Anchor Apartmanház ← BL
  YachtClub, Anita Apartman ← Judit Apartmanház 109 m, Naro Camping ← info@jogarhotel.hu, Park Hotel ← Hotel Sirály, …).
- Közvetítői címek elsődleges kontaktként: `support@booked.net` 3 leaden, egy iroda-gmail 10 leaden.
- 20 régi, pontos duplikátum-pár (2026-08-18, két badacsonyi futás 3 perc különbséggel — a store-dedup előtti nap).
- A Duplikátumok lap „független” ítélete a párt elnémította, a közös cím viszont mindkét leaden maradt.

### Döntés

1. **Küldési kapu (`src/outreach/sharedContactGate.ts`)**, a levél-út (`sendOutreachMail` — így a „Mehet ki most?” sor
   is) és a mobil-út (`mobileOutreachGates`) KÖZÖS függvénye: ha a küldési cím/szám egy MÁSIK élő lead elsődleges
   kontaktja, elfogadott naplósora vagy prospect-címe, a küldés megáll, és a sor megnevezi a másik szállást.
   - **Feloldás CSAK „azonos tulaj” ítélettel** (a „duplikátum” ítélet a vesztest kizárja, így az már nem számít).
   - **A „független” ítélet NEM old fel:** két különböző üzlet egy elérhetőségen = legalább az egyiken hibás; a kiút
     a lead elérhetőségének javítása.
   - ≥7 leaden ülő érték = közvetítő/iroda, ezt nevén nevezi (a Duplikátumok lap ezeket nem is párosítja).
   - Kivétel: Elek címe és az SMS-engedélylista teszt-száma (a tulaj teszt-identitásai szándékosan több leaden).
2. **Places-párosítás:** a névszűrő csak MÁRKA-szóra illeszt (a közös `GENERIC_NAME_WORD` lista, kiemelve
   `src/scraper/genericWords.ts`-be); csupa-szakszó név csak teljes egyezéssel párosít. **Elérhetőség (telefon,
   honlap) csak MAGAS sávból** kerül a leadre; közepesnél a telefon ELUTASÍTOTT naplósor (indokában a párosított hely
   neve és távolsága), a honlap a `placesMatch.heldWebsite`-ban vár. A fotó/értékelés útja változatlan.
   Minden párosítás bizonyítéka megmarad (`raw.placesMatch`: hely neve, távolság, név-hasonlóság, sáv) — eddig csak a
   pontszám, amiből utólag nem dönthető el, jó volt-e a párosítás.
3. **A 20 régi pár összevonva** a konzol saját `ruleOnPair` útján (vesztes kizárva, nem törölve — visszafordítható;
   a Villa Pátzay-nál a saját domaines e-mailt viselő, a Mandulánál a 3 mockot viselő fél maradt).

### Mitől „biztos” a duplikátum — a rögzített fokozatok

| fokozat | bizonyíték | mit szabad vele |
|---|---|---|
| 1. azonos forrás-rekord | azonos place_id / OSM-id, vagy azonos koordináta + telefon | összevonás, kontakt átvétele |
| 2. azonos név + ≤250 m | valószínű | átfedő scrape-nél az új eldobása (ADR-0039); kontakt NEM száll át |
| 3. csak közös elérhetőség | kétértelmű (lánc, egy tulaj több házzal) | operátor ítél; küldés addig áll |

### Nyitott

- A meglévő ~115 közepes sávú lead elérhetősége a régi szabállyal került rájuk. Ahol a szomszéd is a leadjeink közt
  van, a kapu megfogja; ahol NINCS, ott nem. Visszamenőleges rendezéshez újra kell kérdezni a Places-t (a hely neve
  nem volt eltárolva) — ~115 hívás, tulaj-döntés.
- Az ötödik→hatodik szakszó-lista helyett ma egy közös (`genericWords.ts`) + négy régi másolat él (`duplicates.ts`,
  `reenrich.ts`, `enrichWebSearch.ts`, `generateEngine.ts`) — összevonás külön feladat.

### Helyesbítés (2026-09-29) — a „közepes = semmi” túl szigorú volt; új pontozás, kalibrálva

A visszamenőleges rendezés száraz futása (118 közepes sávú lead, a Places újrakérdezve) cáfolta a fenti feltevést: a
közepes sáv **túlnyomórészt a HELYES helyet** találta meg, csak más névírással („Aranymandula Apartmanház” ↔
„Aranymandula Apartmanok”) — a Jaccard-hasonlóság a szakszót eltérésnek számolta. A „közepes = nincs elérhetőség”
szabály 70 valószínűleg jó telefont vett volna le. A fenti szomszéd-pár lista is túlzott: az Anita Apartman Google-
bejegyzése „Kovács Apartmanok – Anita Apartmanház” (a Judit Apartmanházzal azonos család).

**Az új szabály** (a közepes sáv változatlanul csak jelölt — a SÁVBA sorolás lett pontosabb):
- **Név:** a lead MÁRKA-szavainak hány százaléka van meg a hely nevében (szakszavak — magyar ÉS a Places-címek angol
  szavai, `PLACES_TRADE_WORD` — és a lead saját települése nem számít; írásváltozat: előtag / egy betű eltérés).
- **Típus:** ha a hely a Places szerint nem szállás (kávézó, bolt, borozó szobák nélkül) → legfeljebb közepes.
- **Távolság:** magas csak ≤100 m-en; kemping/gyerektábor (`large_site`) ≤250 m-en.
- Ugyanez a pontozás fut a mock-generálásban (`generate.ts`) — egy szabály, egy helyen.

**Kalibráció** 115 valódi, kézzel címkézett páron (`scripts/fixtures/places-match-labels.json`; a címke a session
ítélete, nem ellenőrzött igazság): jó → magas **72/85**; rossz → magas **0/8**; bizonytalan → magas 5/22 (Familia, Jani
Gyula, Panoráma Apartman, Pálkövei, Simply Szálló — mind szállás, ≤94 m, márka egyezik). Az őr
(`places-match-check` ⑨) mindkét irányt köti: rossz soha nem magas, ÉS legalább 70 jó magas (a túl szigorú szabály is
hiba). Negatív kontroll: a típus-/távolság-korlát kivétele → a Green Café és a Kővirág magasra ugrik, az őr piros.

**Visszamenőleges rendezés:** `scripts/places-medium-backfill.mts` (száraz alapból; `--apply --backup`; `--cache`).
A dev-állományon mérve: 78 megerősítve, 21 telefon és 20 honlap le (köztük mind a rossz pár), 10 érintetlen (a lead
elérhetősége nem attól a helytől van), 3-nak ma már nincs találata. A levett érték ELUTASÍTOTT naplósorként, indokkal
megmarad — átvehető. Futtatás a tulaj jóváhagyása után.
