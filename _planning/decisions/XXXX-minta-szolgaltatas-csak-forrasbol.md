## ADR-XXXX — A minta-szolgáltatáslista csak a forrás saját kínálatából; közeli idegen és tagadott tétel ki

**Dátum:** 2026-10-21 · **Döntött:** koordinátor (cita291565c) briefje Vera J-leletei alapján; megvalósítás: CIT SUB

**Kontextus.** Éles mockokon a „Minta” jelölésű „Amit kínálunk” blokk forrásnak ellentmondó tételeket mutatott (§B.17):
- **Dunapart Villa (625416e9):** „Reggeli” — a forrás: „Önellátó szálláshely”. A recept `sampleAmenities`-ében nincs; a renderelő GENERIKUS feltöltése tette be.
- **Hosszúhegyi Vendégház (cfa02265):** „Reggeli” üres amenity-lista mellett — ugyanaz a feltöltés.
- **Hargita panzió (553e075a):** „Étterem” — a forrás: „A közelben található étterem …” (idegen vállalkozás). A `descriptionSellingPoints` a „közelben”-t nem nézte.
- **Hotel Garni (74e3f1e3):** „Étterem” (közelben), „Reggeli” (a forrás: „Ellátást nem tudnak biztosítani”), „1.–3. szoba” — a portál szobaszám-mezője a „3 db szoba légkondicionált” mondatot fogta meg, a szöveg „9 szobában összesen 24 főt” ír.

Az ADR-0338 a forrás nélküli generikus típusokat kifejezetten külön döntésre hagyta („Tudatosan NEM ebben a körben”). Ez az a döntés.

**Döntés.**
1. **A szolgáltatás-minta CSAK a forrás saját, igenlő tételeiből áll** (`sampleAmenityItems`), max 6; generikus feltöltés (wifi, parkolás, reggeli, klíma, terasz, kisállat) NINCS. Üres forrás → a blokk TÉTEL NÉLKÜL látszik (ADR-0061 all-in: a megvehető modul nem lehet néma), és kimondja: „ide kerülnek a szállás szolgáltatásai, Ön jelöli be őket; ezen az előnézeten szándékosan nincs kitalált szolgáltatás” — az árak-minta mintájára. A tiltott típus a forrás saját tételei közül is kiesik.
2. **Közeli = idegen** (`marketCheck.proseAffirms`): ha a tagmondat „a közelben / környéken / szomszéd / sétatávolság / N m-re / N perc sétára” jelzőt hordoz, a létesítmény-szó (étterem, medence, szauna, reggeli …) NEM a szállás szolgáltatása. Kivétel a hely-jellegű szavak (strand, vízpart, kilátás, panoráma, stég, móló): „közel a homokos strand” értékes, a távolságot ott továbbra is az 1 km-es küszöb dönti. Méret nem távolság („10 m-es medence” megmarad).
2a. **Idegen létesítmény mondata = nem a szállásé** (`marketCheck.proseAffirms`, Kavics 8302c1f0 / Belvárosi 1ec76cb0, Gyula): ha a MONDAT (nem csak a tagmondat — a felsorolást vessző tagolja) másik létesítményt nevez meg (Vár nagybetűvel, fürdő/várfürdő/gyógyfürdő — de nem fürdőszoba/-köpeny/-kád —, múzeum, torony, kastély, színház, templom), a létesítmény-szó (medence, szauna …) nem a szállásé. Hely-szavaknál (kilátás, strand) ez csak a mintán érvényes.
2b. **A minta „Amit kínálunk”: a leírásból kinyert tétel csak SAJÁT tulajdonítással** (`marketCheck.descriptionFactIsOwn`, Tomi Apartman d36898cc: „a város strandjain” → „Strand”): a mintán a hely-szavak is elveszítik a közelség-kivételt („közel a homokos strand” ≠ a ház strandja), és a település/város/helyi birtokában álló létesítmény sem a házé. Az író tény-listája (általános mód) a közeli strandot megtartja — az igaz és értékes, csak nem a ház kínálata.
3. **Ellátás tagadása = nincs reggeli** (`deniedSampleTypes`): „önellátó” (tagadás nélkül) vagy tagadott „ellátás” → `breakfast` tiltott.
4. **Számozott minta-szobakártyán** a szolgáltatás-típusú chip („Reggeli kérhető”, „Ingyenes Wi-Fi”, „Klíma”, „Erkély”) csak akkor marad, ha a forrás azt a típust kínálja; a típus nélküli illusztráció („Saját fürdőszoba”, „Családi elrendezés”) marad.
5. **Ellentmondott szobaszám kiesik** (`roomCountContradicted`): ha a próza a szoba-szó előtt más számot mond, a portál `roomCount`-ja nem A darabszám → nincs `sampleRoomCount` (egy „Az egész szállás” kártya) és a piaci kapu szobaszám-ténye sem él. Számot nem választunk helyette.
5a. **Csak egyben kiadott ház = egy foglalható egység** (`wholeLetOnly`, Szömörce fe105370: „Csak egyben adjuk ki”): nincs számozott/elnevezett minta-szoba, egy „Az egész szállás” kártya; a hálószoba-szám a szövegnek igaz tény marad. „Egyben is kiadó” és „nem csak egyben” nem ilyen. Ugyanitt: a „reggeli kávé / séta / napsütés” napszak, nem reggeli-szolgáltatás; a mintán a többes „a strandok” a településé.
6. **Egy függvény, két út:** `generateEngine.sampleHintsOf()` számolja a négy minta-jelzést; ugyanezt futtatja a `scripts/rerender-mock.mts <id> --resample` (AI és hálózat nélkül: lista + próza + az első generálás idézet-igazolt tényei), és a jelzéseket a `mock_artifact.inputs.siteData`-ba írja.

**Őr.** `scripts/sample-from-source-check.mts` ④b szakasz — a három lead valós forrásszövegével (Dunapart, Hargita, Garni) + üres forrás (Hosszúhegyi) + render-ellenőrzés minden sablonra („Reggeli” forrás nélkül nincs). Piros kontroll: a régi `marketCheck`/`templateKit`-tel 5 bukás.

**Következmény.**
- Dunapart és Hosszúhegyi „Reggeli”-je a renderelőből jött → a deploy után a sima `rerender-mock.mts <id>` javítja.
- Hargita és Garni „Étterem”-je és a Garni „3 szoba” a PERZISZTÁLT `siteData`-ban van → a deploy után `rerender-mock.mts <id> --resample` kell (AI nélkül); a teljes újragenerálás nem szükséges.
- A régi mockok szöveg-részébe (író-kimenet) került esetleges „étterem” említést ez nem érinti; az új generálásnál az író tény-listájából is kiesik a közeli étterem.

### Kiegészítés: a kapcsolat-kép (koordinátor, 2026-10-21 este)
7. **A „<név> környezete” kép kültéri kép, fürdő/WC soha** (`templateKit.contactPhotoOf`, Parallax · Fullbleed · Dopamine · Dark luxury): a fix hely (utolsó kép / photos[3]) helyett a vision-ítélet (`Photo.subject`) szerinti utolsó kültéri kép (exterior · view · pool_garden), lehetőleg nem a hős-kép; ha nincs ilyen, a régi hely marad, de fürdő/WC helyett az előző nem-fürdő kép, és az alt csak a név (nem állít környezetet). Ítélet nélküli kép = ismeretlen, sosem kültéri. Mérve élesen: a négy sablon 567 mockjából 276-on fürdő/WC volt „környezete” alttal; az új szabállyal 0.
