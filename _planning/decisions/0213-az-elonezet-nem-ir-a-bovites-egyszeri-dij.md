## ADR-0213 — Az előnézet nem ír adatot, és a próba-fizetőoldal a modul-bővítést egyszeri díjnak mondja (2026-09-23)

**Dátum:** 2026-09-23 · **Státusz:** elfogadva (megvalósítva, őrrel) · **Kapcsolódó:**
ADR-0192 ⑧.3 és ⑧.5 (lezárja), ADR-0089 ④ (az előnézet nem ír), ADR-0196 ⑥,
kontraktus: `assets/design-refs/console/pay-gateway-exit/` ② (a lap megnevezi, mit fizet a vevő).

### ⑧.5 — A „Megnézem" előnézet adatot írt

**Mérve** (eldobható fiók, egység nélkül, semmi megvéve): a Galéria-előnézet semmit nem írt
(kontroll), de a **Szobák, Árak, Értékelések és Foglalás** előnézete egy „A szállás egésze"
egységet hozott létre, aloldal-címmel. Az Értékeléseket az eredeti lelet nem említette — csak
a modulonkénti mérés mutatta ki. Az ok: `moduleContentFor` előnézet-módban is az
`ensureUnits`-t hívta (két helyen), ami beszúr és slugot tölt. A meglévő őr
(`module-preview-check` ①) a függvény SZÖVEGÉT nézte, a két hívással mélyebb írást nem látta.

**Nyoma ma:** élesen (csak olvasással) és a dev adatbázisban is 0 fiók, amelyben egység van,
de sem Szobák, sem Árak, sem Foglalás modul. A kár tehát látens volt.

**Döntés:** előnézetben (`overrideActive`) a csak olvasó `peekUnits` fut (`src/tenant/units.ts`):
ha nincs egység, a MEMÓRIÁBAN mutat egy „A szállás egésze" mintát slug nélkül (az előnézet ne
hirdessen nem létező aloldalt); ha nincs egész-szállás jelölés, a memóriában jelöli.

**Őr:** `scripts/module-preview-nowrite-check.mts` — mind a 12 előnézhető modulra (egyenként és
együtt) a fiók összes sorát lefényképezi előtte/utána, bájtra azonosat követel. Piros iker: a
mentő útvonal ugyanitt ír, azt látnia kell. Javítás nélkül futtatva: 4 modul bukik.

### ⑧.3 — A próba-fizetőoldal éves előfizetést írt a modul-bővítésre

**Mérve a VALÓDI útvonalon** (`GET /pay/mock/<ref>`): egy éves fiók modul-bővítésére a lap
„Citoviso honlap — éves előfizetés · 1 627 Ft / év"-et írt, modulnév nélkül. Az ok: az útvonal
egyszeri-vásárlás listájából hiányzott az `upsell`. A Barion felé menő leírás helyes volt
(„Citoviso modul-bővítés — időarányos első díj"); élesen a Barion fut, ott egyetlen mock-fizetés
van (2026-08-20, induló). **Vevő nem látta** — csak a teszteken és bemutatókon félrevezetett.

**Döntés:** az `upsell` egyszeri; a tétel-sor: „Modul-bővítés: {modulok} — egyszeri díj".
A tulaj kérésére ugyanitt: az alsó fejlesztői jegyzet („Ez a MOCK fizetőoldal a valós Barion
pay-link helyén…") TÖRÖLVE, a cím „Mock fizetőoldal" helyett **„Próba-fizetés — valódi pénz nem
mozdul"** (a lap fül-címe „Próba-fizetés"). Az idézők átírva: Elek FK-005a (1) és FK-005b (2) sor.

**Őr:** `scripts/pay-mock-upsell-check.mts` — a folyamaton belüli konzolszerver valódi útvonalán
mér; pozitív kontroll: az induló éves előfizetés továbbra is „éves előfizetés … / év".
Javítás nélkül 4 állítás bukik.

### Nyitva
- A Barion-leírás nem sorolja fel a modulokat (a bővítés típusa helyes). Külön kérdés.
