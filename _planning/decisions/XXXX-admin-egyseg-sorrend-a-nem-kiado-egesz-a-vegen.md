## ADR-XXXX — A tulaj admin-listáiban a nem kiadó „egész szállás” a végére kerül, és naptár-fület csak foglalható egység kap

**Dátum:** 2026-09-29 · **Státusz:** elfogadva (lokál, nem élesítve — a nagy deployjal megy) ·
**Kiegészíti:** ADR-0256 (a nem kiadó egész a vendég elől rejtve; `isGuestVisibleUnit`), ADR-0257 (csak egyben
kiadó ház, bemutató szobák; `bookableUnits`) · **Őr:** `scripts/admin-unit-order-check.mts`

### A mért tényállás (Elek FK-013, 2026-09-28; Kemencés Vendégház, Myrna Haus)

A tulaj minden listája (Szobák rács, szoba-felugró, Árak kártyák, Online foglalás naptár-fül) a `sort_order`
szerint ment, és a rendszer által létrehozott „A szállás egésze” a 0. volt. Akkor is elöl állt, amikor a tulaj nem
adta ki egyben, és a vendég nem is látta. A tulaj első koppintása és első beírt ára erre az egységre ment: a leírás
oda került, a 34 000 Ft az egész ALAPÁR mezőjébe, és az Árak lap ettől 5985 px hosszú lett. Az ADR-0256 ① csak a
VENDÉG-widgetről mondta, hogy „a sorrend nem változik”, az admin-sorrendről egyik döntés sem szólt. Közben az Online
foglalás képernyőn a csak-egyben kiadó ház bemutató szobái is kaptak naptárat, pedig foglalás nem érkezhet rájuk
(ADR-0257 nyitott tétele).

### Döntés (a tulaj: „legyen A)”, 2026-09-29, a koordinátoron át)

1. **Egy szabály, egy függvény:** `adminUnitOrder()` (`src/tenant/unitVisibility.ts`). Stabil rendezés: ami a vendég
   elől rejtett (`!isGuestVisibleUnit`, azaz az egész, amelyet a tulaj nem ad ki egyben), a VÉGÉRE kerül. Minden más a
   tulaj sorrendjében marad: az egyben is kiadó egész, és csak-egyben módban a ház mindenképp elöl.
2. **A négy lista ugyanabból olvas:** a Szobák és az Árak képernyő adat-összerakása, valamint az Online foglalás
   (`public.ts`, admin-modul ág).
3. **Csak megjelenítés:** a `sort_order` nem íródik át, a vendég-oldal sorrendje (ADR-0256 ①, ADR-0257 ⑥) változatlan.
4. **Naptár-fül csak foglalható egységnek** (`bookableUnits`): a bemutató szobák és a rejtett egész nem kapnak fület.
   A kimaradtakat egy mondat megnevezi („{nevek}: a házzal együtt foglalható, ezért nincs külön naptára.” /
   „…: nem kiadó egyben, ezért nincs naptára.”). A képernyő az első foglalható egységen nyílik, és egy régi link egy
   nem foglalható egység naptárára is azt nyitja. A „Mit ad ki?” szoba-szerkesztő (név, férőhely, törlés) továbbra is
   minden egységet mutat.

### Tanulság

A „mi van elöl?” is döntés, nem mellékhatás. Amíg a sorrend a létrehozás sorrendjéből adódott, a rendszer által
elsőként létrehozott, gyakran nem is kiadott egység kapta a tulaj első koppintását. A szabály ugyanazt a predikátumot
olvassa, mint a vendég-oldal, így „amit a vendég nem lát, az a tulajnál is hátul van” nem válhat két igazsággá.
