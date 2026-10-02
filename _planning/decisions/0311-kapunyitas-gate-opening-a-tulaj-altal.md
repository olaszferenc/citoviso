## ADR-0311 — „Kapunyitás” (`gate-opening`): a tulaj által választott Kimi-mockból generálható sablon; a kapu a hős fotó maga, mert egy fotó sem nevezhető kapunak (2026-10-02)

**Státusz:** elfogadva (SUB; koordinátor: CIT fő session; brief `~/rc-briefs/kapunyitas-sablon.md`) · **Lokál, nem élesítve** (§0) ·
**Kontraktus:** `assets/design-refs/tenant-site/gate-opening/` (az elfogadott `plan.html` + README) ·
**Kapcsolódó:** ADR-0304 (walk-through, a precedens), ADR-0111 (új sablon felvételének mintája), ADR-0115 (mozgás-réteg),
ADR-0047/0048 (modul megnevezett helyen; egy folyamat), ADR-0253 (telefonos menü, sáv csak félúton), ADR-0292, §B.17.

### Kontextus
2026-10-02-án mock-verseny futott a Három Huszár Apartments (Köveskál) leaden, Claude és a Kimi között, 7 mockkal.
A Kimi B változatáról („Kapunyitás”, sötét, esti hangulat) a tulaj: „A Kimi B verziója eddig mindent visz.”, majd:
„Külön sessionbe generáljunk abból is egy sablont.” A mock kézzel készült: a kaput kézzel választották (egy terméskő
kapu fotója nyílik a házra), a számok, szobák, értékelések kézzel írva, saját űrlap-szkripttel.

### Döntés
1. **Új sablon `gate-opening`** (`src/engine/templates/gateOpening.ts`, a 21.) + **új skin `lantern-charcoal`** (a mock 11
   tokenje, Archivo + Inter). Regisztráció, előnézeti képek (`public/assets/ui/tpl-gate-opening{,-prev,-full}.jpg`),
   i18n-katalógus — az ADR-0111/0304 mintája szerint.
2. **A kapu a hős fotó maga, tompítva.** A brief szerint a kapunak a lead fotóiból kell jönnie („ha van kapu/bejárat/ajtó
   tárgyú fotó”). Mérve: a vision-taxonómiában ilyen tárgy NINCS (exterior · pool_garden · view · dining · interior ·
   bathroom · …), a Három Huszár 24 fotójának ítéletében sem szerepel kapu. Egy fotót tehát nem lehet kapunak mondani, és
   a lap nem sugallhatja, hogy a szálláson kapu van. Ezért a két kapuszárny a hős fotó két fele, sötétítve (csukott ajtó
   alkonyatkor), és ugyanarra a fotóra nyílik, kivilágítva — nem állít semmit, és nem jár külön letöltéssel.
   Dekoratív (`alt=""`, `aria-hidden`). A forrás egy függvényben él (`gateSource`, `GATE_MODE`), a váltás egy sor.
3. **A betöltési koreográfia az első festés előtt dől el:** egy `<head>`-beli szkript teszi fel a `ko-anim` osztályt
   (JS van, nincs csökkentett mozgás, nincs `data-cit-no-motion`). Csak ekkor jelenik meg a csukott kapu; különben nincs
   kapu, és minden látszik. Görgetésre a hős tartalma elhalványul (`animation-timeline: view()`, `@supports` mögött).
4. **A funkció a közös modulokból jön** (foglalás `bookingSlot` + `closing` slot, galéria-kontraktus, szoba-kártya réteg,
   négy slot, telefonos menü és sáv). A mock eltérései az ADR-0253 miatt: telefonon nincs foglalás-gomb a görgetett
   fejlécben (a mockban volt), és nincs ragadós ajánlatkérő bevezető a foglalási blokk mellett.
5. **A mock leletei javítva:** a számsávban egy mértékegység nem maradhat egyedül („éj”), és a „Ft-tól” sem törhet a
   kötőjelnél (mérve: „Ft- / tól / éj” 390 px-en) — a szám-rész és az egység-rész egy-egy nem törő egység. ⛔ A szöveg
   karakterei NEM cserélődnek (az első változat nem törő szóközt és kötőjelet írt be, és a room-details-check jogosan
   bukott: a kiírt ár-sor nem egyezett az adattal). Ha a teljes foglalási szekció a lapon van, a sáv saját „Foglalás”
   sora összecsuk (mérve: „Foglalás / Foglalás” egymás alatt); a `#cit-enquiry` horgony marad.
6. **A runtime MINTA-burkolója** a lusta fotónál betöltés előtt mér (magasság 0 → nem „tölti ki”): a Lidón a szoba-fotó
   150 px-en állt egy 268 px-es keretben. A sablon kerete a kép doboza (fix 4:3, nem az egész kártya), így ott a burkoló
   mindig megkapja a magasságot.

7. **Őr-leletek, javítva (2026-10-02):** dizájn-őr — asztalon a tükrözött szobasorban a kép a keskeny oszlopba került
   (357 px az 500 helyett) → a tükrözött sor 5/7, a kép a széles oldalon marad; egyetlen számcella a négyoszlopos sávban
   3/4-ben üres sávot hagyott → annyi oszlop, ahány szám. Tényhűség-őr — a „Google” forrás-címke a link HOSZTJÁN múlik,
   nem csak a skála hiányán. Érintési célok (márkajel, lábléc-linkek, telefon-linkek) ≥ 44 px. A hős alsó árnyéka a mockénál erősebb ott, ahol a név
   áll (a hero-contrast-check a legrosszabb, világos fotón 2,94:1-et mért a 3:1-es küszöb alatt; utána ~8:1).

### Mérve
Végiggörgetve 390 / 1440 px-en (JS-hiba 0, vízszintes túlcsordulás 0): Három Huszár (24 fotó, nincs értékelés → nincs
számsáv), Lidó Wellness és Bor Villa (12 fotó, értékelés + stat, hosszú név), Kemencés Vendégház (6 fotó), Nyugalom
Vendégház (3 fotó; mock és ÉLŐ — élesen szoba nélkül nincs szoba-szakasz), és egy gazdag teszt-eset valós fotókkal (szobák
árral, vélemények, GYIK, házirend).

### Nyitott (a koordinátornak átadva, döntési anyaggal)
- **A kapu forrása:** A = a hős fotó maga (ma) · B = a legjobb MÁSIK kültéri fotó (exterior/pool_garden/view) nyílik a
  hősre — közelebb a mockhoz, de egy plusz nagy kép az első képernyőn · C = új vision-tárgy (`entrance`) és újrapontozás
  (pénzbe kerül, minden sablont érint).
- **A hős fölötti nagybetűs felirat** (a mock-brief kerülendő-listáján): marad / normál írásmód.
- **A sablontól független leletek (őrök, 2026-10-02):** a Lidó Google-értékelése 0,605-ös párosításon is kint van (a
  `generate.ts` csak a low sávot dobja, §B.17 7. pont: 0,7); a Három Huszár címe/telefonja/e-mailje a dev-DB-ben teszt-adat;
  a tárolt copy-ban forrás nélküli „uszoda a helyszínen”, „medence” (Lidó) és „reggeli a kertben” (Huszár); a Google-jelvény
  (ADR-0046, `trust` slot) a sablon saját értékelés-szakasza alatt is kiírja ugyanazt a számot — minden sablonon így van;
  a `checkDemoFraming` a közös MINTA-modulok „éles oldal” szövegére FLAG-et ad.
- **Kiküldött mockon is fusson-e a kapu?** A 2026-09-14-i tulaj-döntés (prospectNotice `disableIntroAnimation`) a
  több másodperces, teljes képernyős nyitó-animációkat tiltja a kiküldött mockon; a kapu ~1,2 mp, a hősön belül, a tartalmat
  nem takarja ki — ezért ma nem kapcsol ki a `data-cit-no-intro`-ra.
