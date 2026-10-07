## ADR-XXXX — A mock minta-blokkjai a forrásból (szolgáltatás, szobakártyák, cím)

**Dátum:** 2026-10-07 · **Döntött:** tulaj (a SUB-brief jóváhagyása, ~16:40), megvalósítás: CIT SUB a koordinátor briefjéből

**Kontextus.** A pilot-diszpécser négy leadet TARTVA-ba tett sablonhibák miatt. A „Minta” jelölésű
blokkok TÉTELEI a vendég szemében mégis a házról szóló állítások (§B.17):
- **Partvilla (25611f91):** a szolgáltatás-minta „Kisállat”-ot mutatott, a forrás: „Háziállat nem engedélyezett”.
- **Főnix (63bcac22):** „1.–3. szoba”, a tulaj saját szövege két apartmant nevez meg: „Family”, „Gold”. A 3 sehonnan nem jött.
- **Kisvasút (2f5bb7f5), Vitorlás (ea625e43), AQUA:** a cím magyar lapon „… 8646 Hungary”.
- **Kisvasút:** „Vendegház” ékezethiány.

**Döntés.**
1. **Szolgáltatás-minta a forrásból** (`src/engine/sampleFromSource.ts`, `marketCheck.sampleFacilityItems`):
   elöl a forrás saját tételei (bucketenként egy, magyar lapon), utána a nem tiltott generikus típusok,
   max 6. Ha a forrás egy típust TAGAD (listázott tétel vagy próza-mondat tagadószóval), az a típus
   kimarad — a szolgáltatás-sorból ÉS a minta-szobák felszereltségéből is, minden nyelven.
   A felismerés szándékosan óvatos: téves találat csak ELVESZ egy minta-tételt, sosem tesz hozzá.
2. **Szobakártyák a forrásból** (`templateKit.sampleRooms`): a tulaj prózájában megnevezett
   egységek („Family nevű apartmanunk”) → annyi kártya, azokkal a nevekkel (csak magyar lapon);
   kimondott darabszám → számozott kártyák (plafon 8); **SEMMI → 1 kártya „Az egész szállás”**
   (tulaj 2026-09-08: „az egész szállás a jó alapértelmezés”). Kitalált darabszám nincs.
   ⛔ **Valós nevű és „Az egész szállás” kártyán NINCS generikus minta-chip** (Klíma, Erkély,
   Reggeli kérhető …): „1. szoba” alatt illusztráció, de „Gold apartman: Erkély” már állítás a
   megnevezett egységről (§B.17 (5) — a tényhűség-őr 2026-10-07-i FLAG-je alapján). A számozott
   minta-kártyák chipjei maradnak.
3. **Cím országnév nélkül** (`src/engine/displayAddress.ts`): a ház SAJÁT országának neve
   (Intl.DisplayNames, angol és lapnyelvi alak) lekerül a megjelenített címről; idegen ország marad.
   A `renderSite` elején fut, így a régi, perzisztált siteData újrarenderelve is javul.
4. **„Vendegház”:** a FORRÁS-névből jön (Google Places `lead.name` / `raw.name`; a portálok helyesen
   „Vendégház”-at írnak). A sablon nem ront; önkényesen NEM javítjuk — kurátori döntés, a lead neve
   a konzolon átírható.

**Módosított döntés — ADR-0192 ④.4 indoka.** Az ADR-0192 a „2+ egység: ismeretlen → a `rooms`
függőség áll” szabályt azzal indokolta, hogy a mock **3 szobakártyát mutat**. Ez a tény megváltozott:
ismeretlen darabszámnál a mock mostantól **1 kártyát** („Az egész szállás”) mutat. **A függőségi
szabály VÁLTOZATLAN** (ismeretlen → `rooms` kötelező) — az indoka mostantól az óvatosság, nem a
képernyővel való összhang.

**Őr.** `scripts/sample-from-source-check.mts` (pre-commit, a `room-card-overflow-check` előtt):
tagadás → típus kiesik; prózai nevek → kártyanevek; számlálás nélkül → 1 „Az egész szállás”;
saját ország le a címről, idegen marad. A `room-card-overflow-check` szoba nélküli forgatókönyve
`sampleRoomCount: 3`-at kap, hogy továbbra is többkártyás rácsot mérjen.

**Tudatosan NEM ebben a körben (a tényhűség-őr 2026-10-07-i leletei, külön döntést igényelnek).**
- Az „Érkezés és távozás” minta-időpontjai (14:00–20:00 / 10:00, ADR-0061) a forrás valós
  checkIn/checkOut-ját nem olvassák (Partvilla: a forrás 15:00–19:00 / 08:00–10:00 → ellentmondás).
- A szolgáltatás-minta generikus típusai (wifi, parkolás, reggeli …) forrás NÉLKÜL is megjelennek
  („Minta” jelöléssel); ez a lezárt szabály csak a forrással ELLENTÉTES tételt veszi ki.
- A „Szobák” szekciófej egyetlen „Az egész szállás” kártya fölött (a `roomsLabel` nem minden sablonban él).

**Következmény.** A MÁR legenerált mockokban a régi tartalom (Hungary, Kisállat, 1.–3. szoba)
benne marad, amíg újra nem renderelik / generálják őket. Élesítés: a nagy deployjal.
