## ADR-0509 — HR lead-képek: a Maps-kártya nyitóképe a leadre, a portál-galéria a linkjeiből, vízjeles host fotóra kizárva

- **Dátum:** 2026-11-27
- **Státusz:** elfogadva (koordinátor `cit9b4690e3`, brief `hr-lead-kepek-20261127`; a tulaj kérdése: „Nem zavar jobban, hogy miért nincsenek képek a leadekhez? Felderítettük már, hogy milyen portálok vannak?”)
- **Érinti:** `src/generator/placesCache.ts` (`via: "maps_card"`, `photoProvenance`), `src/generator/generate.ts` (`resolveGatedPhotos`), `scripts/maps-card-photos.mts` (új), `src/countryLexicon/hr.json` (`chainKontaktWatermarkedPhotoHostRegex`); lánc: `felderito/maps_crawl.mjs`, `felderito/elesit.py`, `felderito/kartya_potlas.py` (új), `kontakt/lib.mjs` (`listingPhotos`), `kontakt/kontakt.mjs`, `kontakt/foto_potlas.mjs` (új), `atallas-kepek.sh`

### Mérve (2026-11-27, élesen olvasva)
A 354 HR no_site/outdated e-mailes leadből egynek sincs Places-fotója, 113-nak van portál-fotója, 97-nek (27 %) van legalább 5 saját képe.

**Maps-kártya.** Bejelentkezés nélkül a Google korlátozott nézetet ad: a kártyán ez áll: „Imate ograničeni prikaz Google karata”. A galéria nem nyílik, a „Fotografije” sávban csak a Street View látszik. A kártyáról így csak a nyitókép olvasható. Egy makarskai próbabejárásban 12/12 kártyán volt nyitókép (5 a szállás saját fiókjáé, 7 vendégé). Extra navigáció nem kell; kártyánként ~7,9 mp a próbában, ~7,05 mp a HR-17 éles bejárásban (a szünetek dominálnak).

A nyitókép egy része booking-partner képe a Google proxyján (`/grass-proxy/`), Booking.com-vízjellel. A tulaj saját képét a kártya saját adata (`/maps/preview/place`) jelöli: ott „bizbuilder” áll a fotó mellett.

**Portálok.** Ezt a kontakt-lépés 2594 HR leadjének naplója mutatja. Magas egyezés: apartmanija.hr 329 (ebből 384 forrás képpel), bluepillow 179 (booking-átirányító, kép nélkül), smjestaj.com.hr 71. A többi portál egyenként ≤ 24.

**Miért nem jutott el a kép a leadhez:**
- A lánc generikus olvasója csak `<img>` címkéket nézett. Az apartmanija.hr a galériát linkekben tartja: a Zora 9802 adatlapon 1 `<img>` és 40 linkelt kép van, az Ivana 24610-en 0 és 39. A biztos adatlap így „kétes (<6 kép, vékony)” lett, és sosem élesedett.
- A smjestaj.com.hr minden képén vízjel van („www.UBYTOVANIvCHORVATSKU.cz”, mérve), mint a zimmerinfón.
- 3 photo-links hívás 11-13-án „a lead országa nincs az ország-rétegben” hibával bukott, és a lánc nem próbálta újra.

### Döntés
1. **A kártya nyitóképe a leadre kerül, $0.** A felderítő ugyanazon a lapon olvassa ki a képet, extra navigáció nélkül.
   - A tulaj saját képe `places`, a vendégé `guest` jogállást kap (§A.3; demóra mindkettő mehet).
   - A partner-képet (vízjeles) a felderítő ki sem írja.
   - A kép a lead tárolt Places-válaszába kerül (`lead_places_cache`, `via: "maps_card"`, magas sáv, mert a felderítő azt a helyet nyitotta meg).
   - A fizetett válasz érinthetetlen. A kurátor fizetős gombja a kártyaválasz helyére vehet újat.
   - A `material.placesPhotos` a tárolt képek száma lesz. Így a lánc fotószámlálója (ADR-0504) változik, és a következő terv újramér.
2. **Pótlás újrabejárás nélkül.**
   - Kártyakép: a lead saját kártyája egyszer nyílik meg a tárolt ftid-del (`https://www.google.com/maps?ftid=…`, mérve: ugyanazt a kártyát nyitja). Listázás nincs.
   - Portálkép: csak a régi kontakt-futás magas sávú adatlapját olvassuk újra, keresés nélkül. Ha ≥ 6 képe van, photo-links írás készül.
3. **A generikus portál-olvasó a galéria-linkeket is látja** (`<a href="….jpg">`, mint a repó `domImages`-e).
   - A „hasonló szállások” blokk utáni rész más házé. A lexikon `relatedBlockPatterns`-e vágja le, mint a repó `ownContentOnly`-ja.
4. **A vízjeles host fotóforrásként kiesik** (lexikon `chainKontaktWatermarkedPhotoHostRegex`): sem az adatlap, sem a kép hostja nem lehet az. Kontaktforrásnak továbbra is jó.

### Igazolás (2026-11-27, élesen csak olvasva)
**Vak kör: 40 friss HR lead,** amelyen a kontakt-lépés még nem futott. 20 település, 33 no_site és 7 outdated lead.
- **Kártyakép:** 29 lead kapott használható képet (15 a tulaj saját képe, 14 vendégé). 6 kép Booking-partneré volt, ezek vízjelesek és kizárva maradtak. 5 kártyán nem volt kép. Egy kártya bejárása 5,9 mp.
- **Portál:** 4 leadnek volt magas egyezésű hirdetése; 3 apartmanija-hirdetésen a lánc-olvasó 8 / 12 / 11 helyett 28 / 54 / 60 képet lát. A repó olvasója 28 / 54 / 60 használható képet enged át.
- **≥ 5 saját kép:** 3/40 előtte és utána is. A friss leadek 36/40-ének nincs portál-adatlapja, a kártyakép egymagában senkit nem visz 5 fölé.

**Célkör: 357 HR no_site/outdated e-mailes lead.** A pótlás csak a régi kontakt-futás adatlapját olvassa, a repó olvasójával mérve:
- 114 photo-links írás, ebből 57 leadre ≥ 5 használható kép kerül.
- **≥ 5 saját kép: 99 → 140 (27,7 % → 39,2 %).**
- A kártyakép egy további leadet emel át; a négy képes leadek közül 3-nál a kártyakép partneré.
- A teljes HR-állomány (2801 cél) pótlása szárazon: 316 photo-links írás, ebből 118 apartmanija.hr.
- **Vízjel:** a kiküldött vízjeles képek aránya a szabály szerint 0. A kártyák 15 %-a partnerkép, ezek kizárva; a smjestaj.com.hr hirdetések kontaktforrásként maradnak.

### Visszafordíthatóság
🔄
- A kártyaválasz egy `lead_places_cache` sor (`via = 'maps_card'`), a törlésével eltűnik. A fizetett válaszokhoz nem nyúl.
- A lánc-átállásnak saját `rollback`-je van (`atallas-kepek.sh`).

### Elvetett
- **Bejelentkezett böngésző a teljes galériához.** A lánc udvariassági szabálya: nincs belépés. A korlátozott nézet kifejezett határ.
- **A Google belső fotó-végpontjának közvetlen hívása.** A korlátozott nézet megkerülése lenne.
- **bluepillow (booking-átirányító) mint képforrás.** A booking.com gépi olvasást elutasít (`challenge_protected`), és egy átirányító nem nyitott ikerpéldány. Partner-megállapodás nélkül ez tulaj-döntés.
- **Dedikált apartmanija-adapter a repóban.** A repó generikus olvasója már a linkeket is olvassa (élesen 12 leaden 554 kép). A hiány a lánc saját számlálójában volt.
