## ADR-0256 — A nem kiadó „egész szállás” a vendég elől rejtve (tartós jelölés), és a foglalási widget az első ÁRAS egységre nyit

**Dátum:** 2026-09-28 · **Státusz:** elfogadva (lokál, nem élesítve — a nagy deployjal megy) ·
**Kiegészíti:** ADR-0232 (az „egész szállás” választható egység), ADR-0235 / `booking-mobile-two-step` (két lépés telefonon) ·
**Kontraktusok:** `assets/design-refs/tenant-site/booking-unit-default/` (1 — javasolt) ·
`assets/design-refs/tenant-admin/whole-property-second-question/` („B”) · **Migráció:** `0078_unit_represents_whole.sql` ·
**Őrök:** `scripts/booking-unit-default-check.mts` (+ `--selftest`), `scripts/whole-property-choice-check.mts` ①b/⑧

### A mért tényállás (éjszakai kör FK-014, 2026-09-28; bérlő `harom-huszar-apartments`)

Elek megvette a honlapot és a modulokat, felvitt három szobát alapárral — a vendég mégsem tudott
foglalni: a „Tovább” után a „Foglalási kérés elküldése” 0×0 volt, helyette „Árajánlatot kérek” állt.
Végigkövetve: a widget a lista ELSŐ egységére nyitott, és az a rendszer által létrehozott „A szállás egésze”
volt — kiadó egyben (Elek „Igen”-t mondott), de ÁR NÉLKÜL. A `quoteFor` null → árajánlat-mód. Telefonon
az egység-választó az 1. lépésben **0×0** volt (a mezők oszlopa rejtett), tehát a vendég az egész szállás
naptárában választott napot, és csak a 2. lépésben derülhetett ki, hogy a szobákra VAN ár. Hiba sehol:
néma kerülőút. Elvetett első hipotézis: az ADR-0059 §2 és ADR-0193 ütközése — a mérés cáfolta (a modul
renderel, az ár kimegy; a hiba az ár nélküli egységnél van).

### Döntés

1. **A widget az első ÁRAS egységre nyit** (tulaj: „1 az irány”). A sorrend nem változik, az ár nélküli
   egység a választóban marad „egyedi ár” jelöléssel (a `quote-request` ⑦ érvényben). Mind ár nélküli → az első.
2. **Telefonon a „Melyiket foglalná?” az 1. lépésben, a naptár fölött** — ugyanaz az elem költözik
   (`matchMedia` a két-lépés töréspontján, 559 px), a 2. lépés összegzője megnevezi az egységet.
3. **A tulaj szabálya: „Tűnjön el ha nem kiadó az egész egyben.”** Ehhez név-független, tartós jelölés kell:
   `site_unit.represents_whole` = „ez az egység maga a hely, nem egy szoba”. Az `is_whole_property` jelentése
   szűkül: „egyben is kiadó”. **Vendég elől rejtve: `represents_whole AND NOT is_whole_property`** — EGY
   predikátum: `isGuestVisibleUnit()` / `guestUnits()` (`src/tenant/units.ts`). Minden vendég-oldali lista
   (szoba-kártya, ár-sor, foglalási és vélemény-választó, aloldal) az `editor.ts` egyetlen szűrőjén megy át;
   a `/api/foglalas` rejtett egységre 400-at ad. A tulaj „nincs ára” figyelmeztetése (admin-szál) ugyanezt hívja.
4. **A felismerés pillanata a 2. szoba felvétele** (tulaj: „B”): a „Nem” után második kérdés — „Ez az első
   szobám — nevet adok neki” (átnevezés + új slug, látható) vagy „Nincs ilyen szobám — rejtse el” (megmarad,
   rejtett, a kártyán visszakapcsolható). Hiányos válasznál a böngésző ÉS a szerver kimondja, mi hiányzik,
   és a szerver semmit nem ír.
5. **Futó foglalás mellett a rejtés ENGEDETT, és kimondjuk** (tulaj: „ok B”): az opció alatt a VALÓDI szám
   („Ennek az egységnek N jövőbeli foglalása van — azok érvényben maradnak, csak új foglalás nem érkezhet rá.”),
   0-nál nincs mondat. A foglalás egy vendéggel kötött megállapodás; egy admin-kapcsoló nem bontja fel.
6. **Visszatöltés:** `represents_whole` = a mai `is_whole_property`. Ami ma látszik, holnap is látszik.
7. **A lista sosem ürül ki:** ha csak a rejtett egység maradna, a `guestUnits` azt adja vissza (különben a
   widgetnek nem lenne egysége).

### Nem része (külön szálak)

- Az egész szállás árának bekérése az „Igen”-nél — admin-szál.
- Utólagos „ez mégis szoba” javítás a Szobák kártyán — ha kell, olcsón ráépíthető.
- Egy korábban megírt aloldal-fájl (`sites/<slug>/apartman/<slug>.html`) a rejtés után is kiszolgálható
  marad, ha valaha létezett (a sitemap már nem listázza). A (b) úton nem keletkezhet ilyen, mert egy
  egységnél aloldal nem készül; a kártyán később kikapcsolt egésznél igen — nyitott pont.

### Tanulság

A `represents_whole` és az `is_whole_property` két kérdésre válaszol („mi ez?” és „kiadom-e így?”). Amíg
egy mező hordta mindkettőt, a kikapcsolás a „mi ez?” választ is kitörölte, és a szabály csak a NÉVBŐL
maradt volna kitalálható — amit a tulaj bármikor átír.
