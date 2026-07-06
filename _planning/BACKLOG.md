# Citoviso — BACKLOG / parkolt ötletek

> Később kidolgozandó ötletek, amelyek nem az aktuális fázis tárgyai, de nem szabad elveszniük.
> Ha egy ötlet aktuálissá válik, told a megfelelő ROADMAP-fázisba.

## Termék / UX

### Interaktív mock-konfigurátor + élő próbatér (fizetés ELŐTT)
Dátum: 2026-07-05 · Forrás: tulaj (ötlet)
- A **mock megnyitása interaktív önkiszolgáló folyamatot indít**, nem statikus előnézet: a leendő vevő
  **összeállítja magának a csomagot** (modulok), **cserél képet, hangol kinézetet**, és **élőben teszteli**
  az általa összerakott honlapot — mindezt **élesítés/fizetés ELŐTT**, és **bármikor visszatérhet** hozzá.
- **UX-ív (fontos):** (1) *puff-varázslat* = a kész, lenyűgöző mock, nulla erőfeszítés (a horog) →
  (2) *elmélyülés* = a motivált lead testre szab + élőben tesztel (elköteleződés) → (3) fizetés → élesítés.
  Feloldja a látszólagos feszültséget a „nulla vacakolás" elvvel: előbb a csoda fog meg, utána szöszöl vele.
- Kapcsolódik: élesítés = 1. fizetős kapu (alapmodell); minimum→szofisztikált modul-lépcső (1d);
  a 3 becsatlakozási pont fokozatos bekapcsolása (Fázis 2). Kidolgozás: várhatóan Fázis 4 (MVP).

## ⚠️ Kritikus elvek / minőség

### ⭐ Entitás-párosítás & provenance = bizalom-kritikus (2026-07-06 lelet)
- **Lelet:** a per-lead Places-lookup soft `locationBias`-szal egy AZONOS NEVŰ helyet párosított máshonnan
  (badacsonytomaji „Piroska Ház" → mindszentkállai „Piroska´s houses", ~15 km). A vízió-copy egy IDEGEN házat írt le
  (kitalált wellness). Tömeg-léptéken a névazonosság gyakori → félrevezető, jogilag veszélyes.
- **Fix (kész, `dae1762`):** kemény `locationRestriction` + távolság-ellenőrzés (≤250 m) + név-egyezés; bizonytalanság → NULL.
- ⭐ **INVARIÁNS:** SOHA ne tulajdoníts fotót/jellemzőt egy szállásnak ellenőrzött párosítás nélkül. **Jobb NINCS fotó
  (Street View / nincs galéria + őszinte régió-copy), mint a ROSSZ ház fotója.** A vízió-copy felnagyítja az adathibát → a
  párosítás/provenance rock-solid kell legyen, minden enrichment-forrásnál (fotó, kontakt, website).
- **Biztonsági háló:** ez pontosan a Fázis 1b **mock-kuráció (A2)** nulladik-pont-gate indoka — a kiküldés előtti (kezdetben
  emberi) ellenőrzés fogja el a maradék mismatch-et. A vízió-mismatch a „nulladik ponton bukás" iskolapéldája.

## Stratégia / termék-vektorok

### ⭐ A scraper mint ÖNÁLLÓ termék (iparág-független lead-intelligence)
Dátum: 2026-07-06 · Forrás: tulaj (stratégiai meglátás)
- A lead-discovery motor iparág-agnosztikus → **bármely iparág piaci szereplőit** fel tudja térképezni egy régióban.
  Ez **önmagában eladható termék** (piaci-felderítés / lead-intelligence / B2B partnerkeresés), a Citoviso-tól függetlenül.
- **Use-case (valós):** a tulaj logisztikai cége — adott régióban potenciális partnerek (betongyárak, előregyártók,
  térkőgyárak, aszfaltkeverő üzemek stb.) automatikus felderítése.
- **Következmény a fejlesztésre:** a scrapert eleve **újrahasználható, önálló komponensként** építsük (nem a
  Citoviso-generátorba drótozva) — tiszta be/kimenet, iparág/régió/forrás paraméterezve. ⭐ Az építést ezzel kezdjük.
- Kapcsolódik: a scraper is Iparág × Ország paraméterezett (Fázis 4c-i); két kulcs-motor.

### ⭐⭐ Enrichment / mock-minőség hiányos lead-adatnál — A LEGÉRTÉKESEBB SZEGMENS
Dátum: 2026-07-06 · Forrás: tulaj + AI-meglátás

**⭐ Stratégiai keretezés (miért ez a legfontosabb szegmens):** a „nincs semmije" lead technikailag a
legnehezebb (kevés anyag), de ÜZLETILEG a legértékesebb:
- a hozzáadott érték a kiinduló állapottal fordított → semmiből foglalható oldal = MAX delta (a láthatóság-ígéret itt szól legerősebben);
- a konverziós hajlandóság a fájdalommal korrelál → teljes láthatatlanság = max motiváció; nincs mihez ragaszkodnia (nincs régi oldal);
- verseny-mentes: a klasszikus webstúdiók nem célozzák (nincs is honlapjuk) — mi scraperrel pont őket találjuk meg;
- ⭐ MOAT: aki minimális adatból varázslatos, egyedi mockot tud csinálni, az nyeri ezt a szegmenst → a fő IP-nk.
→ Ezért ezt a lead-típust és a „megoldási képletét" ÁTFOGÓAN, STANDARDIZÁLTAN kell kezelni (nem ad-hoc). Két hiány-pótló mechanizmus:
- **(1) Stock fotó + placeholder + testreszabási javaslat.** Ha nincs elég saját kép/anyag, a generátor
  **stock fotót** tesz a helyére **placeholderként**, és az egyedi vásárlási folyamatban **javasolja a tulajnak**,
  milyen képet töltsön fel az adott helyre (amit a generátor automatikusan a helyén kezel). Kapcsolódik:
  interaktív mock-konfigurátor, élesítés = kép-csere.
- **(2) ⭐ Régiós kontextus-scraper (külön komponens).** Egy scraper, ami adott **település/régió nevezetességeit,
  programjait** gyűjti (Badacsony: Balaton-közelség, borrégió, borpincék, Balaton-körüli bicikliút…) → **közös
  régió-enrichment réteg**, ami minden lead mockjába **program-/élményajánlatként** kerül. Ez az **Iparág × Régió
  tengely turisztikai dimenziója**; a szállás „egyedi magja" részben a régiós beágyazottság. Mivel a régióról MINDIG
  van gazdag anyag, ez pótolja a lead-szintű hiányt.
- **Sorrend:** előbb a lead-szintű enrichment MÉRI, mennyi anyag jön össze; a mérés dönti el, milyen sürgős a
  régiós réteg (adat-vezérelten — A1/A2). Kidolgozás: Fázis 4/5 enrichment-szeletek.

### Contact/enrichment forrás-lánc a „nincs oldal" szegmenshez
Dátum: 2026-07-06 · Forrás: tulaj
- A no-site lead a legértékesebb, de a legszegényebb kontaktban/anyagban (mérve: email 1/8). Forrás-lánc,
  célzottól az általánosig — mindegyik adapter, a mag változatlan:
  1. **Beazonosított portál (célzott):** a lábnyom-profil tudja, hol van (szállás.hu/booking/airbnb) → onnan
     email/kép/leírás. ⚠️ anti-scraping + ToS + jogi őrszem (portál-fotó CSAK demóra).
  2. **Internetes keresés (catch-all) — PARKOLVA (2026-07-06 lelet):** ⚠️ a Google „entire web" Custom Search
     KIVEZETVE (új CSE-nél tiltva 2026-03 óta, teljes EOL 2027-01); az egész piac fizetőssé vált (Brave: nincs
     ingyenes tier 2026-02 óta, ~$5/1000; Bing kivezetve). → NINCS ingyenes web-search API. Valódi per-query költség
     → csak szelektíven, magas-értékű leadekre (lead-priorizálás). Az adapter KÉSZ (`webSearch.ts` + `enrichWebSearch.ts`);
     csak a kliens cserélődik egy fizetős szolgáltatóra (Brave/Tavily/SerpAPI), a logika marad. Iparág-független.
  3. **Cégnyilvántartás (hivatalos):** email/cím.
- Kontakt-csatorna prioritás: email > sms(mobil) > voice > none (automatizált kattintható-link outreach).
  No-site reálisan SMS-first, ahol nincs email.

## Működés / skálázás

### Belső moduláris back-office (operátor-platform)
Dátum: 2026-07-05 · Forrás: tulaj (megjegyzés)
- A control plane maga is egy termék: **belső, operátor-facing moduláris platform** — pénzügy, sales, **CRM**,
  **bizonylat-management**, egyéb belső modulok. Ugyanaz a „modulárisan bővül, nincs egyedi fejlesztés" filozófia,
  mint a tenant-oldalon → **két moduláris platform** (külső Site-modulok + belső back-office).
- **Belső RBAC:** szerepkör-szintű jogosultság (kurátor / pénzügy / sales / support / admin külön). Ez akkor válik
  élessé, amikor ezeket a belső modulokat fejlesztjük (későbbi fázis; a Fázis 3/3d lefektette az alapot).

### Adat-vezérelt lead-priorizálás (az all-in indulás UTÁN)
Dátum: 2026-07-05 · Döntés: indulásnál ALL IN (minden leadnek mock), közben kategória/konverziós adatot gyűjtünk.
- Később: **lead-scoring** a begyűjtött adatból (mely kategóriák/jelek konvertálnak) → a drága mock-gyártást
  a legígéretesebb leadekre fókuszáljuk (költség-optimalizálás). A1/A2-konzisztens: előbb tanulunk, majd automatizált szűrés.
