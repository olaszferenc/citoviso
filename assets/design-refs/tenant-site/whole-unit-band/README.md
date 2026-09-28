# KONTRAKTUS — az „egész szállás” a szobák alatt, saját sávban, kimondott egyedi árral

**Jóváhagyva:** 2026-09-28, tulajdonosi döntés (a koordinátor-sessionön át): „C”. Három változatot látott egy
lapon: **A** (árajánlat a kártyán: „Egyedi ár” + „Árajánlatot kérek” gomb, a kártya a helyén),
**B** („Foglalás” marad minden kártyán, az ár helyén „Egyedi ár — a szállásadó árajánlattal válaszol”),
**C** (az egész ház a rácsból KI, a szobák alá, saját sávba). A **C**-t hagyta jóvá.
Kapcsolódó: ADR-0256 (a nem kiadó egész rejtve, a widget az első ÁRAS egységre nyit), `quote-request/`
(árajánlat-mód, változatlan), `rooms-card/` (a kártya és a felugró, változatlan KÖT pontokkal).

- Terv: `plan.html` (önhordó, kattintható; „Mobil 390px / Asztali” és „A / B / C” váltó; kártya → felugró →
  a foglalás-doboz a HELYES egységen, árazott és ár nélküli módban)
- Képek: `shots/C-*.png` (a jóváhagyott), `shots/A-*.png`, `shots/B-*.png` (a nem választott), mobil ÉS asztali

**Hatókör:** `src/engine/moduleSections.ts` · `assets/runtime/cit-runtime.js` · `assets/runtime/cit-modules.css`

## A mért tényállás, ami kiváltotta (FK-014, 2026-09-28, `harom-huszar-apartments`, 390 px touch)

A „Szobák, apartmanok” rács ELSŐ kártyája „A szállás egésze” volt: ár és férőhely nélkül, mégis
„Foglalás” gombbal. A felugrója fekete fotódobozt mutatott (azóta javítva, `rooms-card`). DB: `represents_whole=t`,
`is_whole_property=t`, **0 ársor** — a tulaj egyben is kiadja, árat nem adott hozzá. A widget erre az
egységre árajánlat-módba vált (ez helyes), de a kártya ezt nem mondta meg, és a vendég első olvasata egy
üres kártya lett a szobák ára helyett.

## Mit KÖT ez a terv (elvárt viselkedés, nem stílus-javaslat)

1. **A rácsban csak a szobák állnak** — az a vendég-látható egység, amelyiknek `represents_whole` IGAZ,
   NEM kártya a rácsban. A predikátum ugyanaz, ami a láthatóságot dönti (`isGuestVisibleUnit` /
   `guestUnits`, ADR-0256): ami rejtett, az továbbra sem jelenik meg sehol.
2. **Az egész ház a rács ALATT, saját, teljes szélességű sávban** áll, és kimondja, mi ez: egy felső
   címke („Egyben is kiadó”), a neve (a tulaj adta név), és hogy mind a szobák egyben — a szám a
   vendég-látható szobák SZÁMA, nem kitalált adat.
3. **Ár nélkül „Egyedi ár”, alatta: „A szállásadó árajánlattal válaszol.”** Ha a tulaj ad neki árat,
   a sáv a szobákéval azonos ár-sort mutat (padló-árnál „-tól”), és a mondat eltűnik.
4. **A sáv gombja ár nélkül „Részletek és árajánlat”**, és a felugrót nyitja. A felugró fő gombja ár
   nélkül „Árajánlatot kérek” — ugyanaz a szó, amit a foglalás-doboz gombja mond ezen az egységen —,
   és a foglalás-dobozt EZEN az egységen hagyja (`#cit-unit`), az árajánlat-módban.
5. **A szobák kártyái nem változnak**: név, férőhely, ár külön sorban, „Foglalás” gomb, ami a saját
   egységét állítja a foglalás-dobozban.
6. **Telefonon a sáv egy oszlop** (címke → név → mondat → ár → gomb); **asztalon** a szöveg balra, a gomb
   jobbra, függőlegesen középen — a szobarács szélességében.
7. **Egyetlen egységnél** (csak az egész ház) a mai `cit-whole` panel marad — nincs mi alá sávot tenni.
8. A foglalás-doboz választójában az egész ház **megmarad** „egyedi ár” jelöléssel (`quote-request` ⑦),
   a widget nyitó egysége az első ÁRAS (ADR-0256 ①) — ez a terv egyiket sem változtatja.

## Feliratok, amiket a terv rögzít

- **„Egyben is kiadó”** — a sáv felső címkéje (és a felugró címkéje az egész háznál)
- **„Egyedi ár”** + **„A szállásadó árajánlattal válaszol.”** — ár nélkül, a sávon
- **„Részletek és árajánlat”** — a sáv gombja ár nélkül
- **„Árajánlatot kérek”** — a felugró fő gombja ár nélkül
- **„Egyedi ár — a szállásadó árajánlattal válaszol.”** — a felugró ár-sora ár nélkül

## Mérve a terven (Playwright, 390 touch + 1280)

- mindhárom változatban a felugró gombja után a foglalás-doboz választója az egész házon áll, a gomb
  „Árajánlatot kérek”; egy szoba „Foglalás”-a után a saját egységén, a gomb „Tovább a kérés adataihoz (2 éjszaka)”;
- 0 JS-hiba mindkét méreten.

## Mérve a megvalósításon (2026-09-28)

- A Három Huszár VALÓDI adatából renderelve (fullbleed, tartalék kártya), 390 / fekvő 844 / 1280: a rácsban csak
  a szobák, alattuk a sáv; a sáv gombja → felugró („Egyedi ár — …”, „Árajánlatot kérek”) → a foglalás választója
  „A szállás egésze · egyedi ár”; minden szobakártya „Foglalás”-a a SAJÁT egységét állítja; 0 JS-hiba.
- Mind a 19 sablonon (fixture, 390 + 1280): pontosan 1 sáv, az egész ház 0 kártyán a rácsban, a sáv a szobák UTÁN,
  nincs vízszintes túlfolyás, a sáv 16 px-es oldalmargóval (4 széltől-szélig sablonon a margó javítva).
- Őr: `scripts/room-details-check.mts` ③ (sáv-darab, rácsban-nincs, ár nélkül nem „Foglalás”, a felugró
  „Egyedi ár” + „Árajánlatot kérek”, a gomb után `#cit-unit` = az egész ház) + visszarontás.

## Ami NEM ennek a tervnek a tárgya

- Az egész ház árának bekérése az adminban („Kiadom egyben is”) — a tulaj még nem döntött róla.
- A sáv fotója: az egész háznak ma nincs saját fotója; ha lesz, a sáv kaphat képet — külön döntés.
