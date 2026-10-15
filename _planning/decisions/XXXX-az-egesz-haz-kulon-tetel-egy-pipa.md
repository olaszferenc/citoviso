## ADR-XXXX — Az egész ház külön tétel, mindig foglalható a szobák mellett; egyetlen pipa: „Csak egyben adom ki” (2026-10-15)

**Dátum:** 2026-10-15 · **Státusz:** elfogadva, megvalósítva (őrrel) · **Felülírja:** ADR-0232 ③–⑤ (a kártya
kapcsolója, a „melyik egység” választó, „bármely egység törölhető, az egész is”), ADR-0256 (a „Nem” utáni második
kérdés és a rejtett egész), ADR-0257 ④ (háromállású kártya, harmadik válasz a 2. szobánál), ADR-0380 „csak
szobánként” módja · **Változatlan:** ADR-0114 kizárás (`blockingUnitIds`), ADR-0257 vendég-oldala és `isBookableUnit`,
ADR-0232 ⑦ (a ház saját ára, tulaj-oldali szumma) · **Kontraktus:** `assets/design-refs/tenant-admin/whole-house-simple/`
· **Őr:** `scripts/whole-property-choice-check.mts` (újraírva).

### A mért tényállás (a tulaj, 2026-10-15, képernyőkép a [TESZT] Matróz Üdülőházról, élesen)

A Szobák lap kártyája három állást kínált („Nem adom ki egyben” / „Egyben is kiadom” / „Csak egyben adom ki”) és egy
„— melyik szoba —” választót: a rendszer az egész házat az EGYIK SZOBÁRA jelölte (`is_whole_property` egy szobán). A tulaj:
„mi a fene ez a logika? … Olyan szinten túl van bonyolítva”, és pontosítva: a vendég VAGY egy szobát, VAGY az egész
házat foglalja — ez magától értetődő, nem beállítás. A „melyik szoba az egész ház” kérdés az adatmodell szivárgása volt
a felületre; egy szállásadónak értelmetlen.

### Döntés

1. **Az egész ház külön egység, sosem az egyik szoba** (`represents_whole` + `is_whole_property`). Két vagy több
   egységnél pontosan egy ilyen van; ha két szoba mellett nincs, a rendszer létrehozza („A szállás egésze”, ár nélkül →
   árajánlat, ADR-0222). Egy szoba mellé nem jön ház.
2. **A ház a szobák mellett mindig foglalható.** Nincs „nem adom ki egyben” állás; a kizárás az ADR-0114 szerint.
3. **Egyetlen tulaj-választás: „Csak egyben adom ki”** (`whole_only`, ADR-0257 jelentéssel), a ház kártyáján, pipaként.
4. **A ház alapára a kártyán** állítható (`setBasePrice`); időszakos árai az Árak lapon maradnak (link).
5. **A 2. egység felvételekor** csak az ÁTNEVEZETT egyetlen „egész hely” egységről kérdezünk (az egész ház / az első
   szobám); az alapnevű egység a ház. Válasz nélkül a szerver semmit nem ír.
6. **Több szobánál a ház nem törölhető** (`deleteUnit`); egy szobánál igen.
7. **Régi adat:** `settleHouse()` minden `ensureUnits`-nál, idempotensen: a régi választóval szobára tett jelölés házzá
   válik (ha nincs más ház), a második „egész hely” szoba lesz, a rejtett ház újra foglalható, a ház nélküli két szoba
   mellé ház jön. A `peekUnits` (előnézet) nem ír. Élesen 2026-10-15-én egyetlen többegységes site volt (a teszt-szállás).
8. **A foglalás-beállító varázsló** két választ ad: „Egyben, egy egységként” / „Szobánként” (= szobák + a ház); a régi
   kliens „rooms” értéke „both”-ként mentődik.

### Tanulság

Háromszor tettünk új választást a felületre (ADR-0232, 0256, 0257), mindig egy újabb esetre, és egyszer sem kérdeztük
meg, kell-e a tulajnak egyáltalán dönteni. A helyes kérdés az volt: mit foglalhat a vendég? A válasz (egy szobát vagy
az egészet) nem beállítás, hanem a modell alapja; beállítani csak a kivételt kell (csak egyben).
