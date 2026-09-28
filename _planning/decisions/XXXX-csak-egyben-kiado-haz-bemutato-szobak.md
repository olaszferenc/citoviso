## ADR-XXXX — „Csak egyben adom ki”: a ház az egyetlen foglalható egység, a szobák bemutatásra — árat sem kérünk tőlük

**Dátum:** 2026-09-28 · **Státusz:** elfogadva (lokál, nem élesítve — a nagy deployjal megy; a vendég-oldali rács a
`whole-unit-band` land után készül) · **Kiegészíti:** ADR-0232 (az egész szállás választható egység), ADR-0256 (a nem
kiadó egész rejtve; `isGuestVisibleUnit`) · **Kontraktus:** `assets/design-refs/tenant-site/whole-only/` (vendég-oldal A,
admin X) · **Migráció:** `0079_unit_whole_only.sql` · **Őr:** `scripts/whole-only-check.mts`

### A mért hiány (2026-09-28)

A tulaj: „Ha valaki megveszi a szobákat, nem biztos, hogy ki akarja adni; csak fel akarja tüntetni az egyes szobák
képeit, felszereltségét stb., de csak és kizárólag egyben akarja kiadni a házat.” — és pontosítva: „Nem arról van szó
hogy egyben is kiadom az kvázi megvan. Hanem: csak egyben adom ki!!! És akkor szobák nem kérnek árát…”

A 2. szoba felvételekor a kérdésnek (`wholeQuestion`) két válasza volt: „igen” (a szobák ÉS az egész is foglalható)
és „nem” (csak a szobák). A harmadik eset nem létezett, így egy csak-egyben kiadó tulaj az „igen”-t választotta —
és a vendég egy szobát KÜLÖN is lefoglalhatott. Rossz foglalás, nem kozmetika. A felmérés szerint a „rejtett” és
a „nem foglalható” ma ugyanaz a szabály (`guestUnits`), tehát egy második, szűkebb predikátum kell: LÁTSZIK, de
NEM foglalható.

### Döntés (a tulaj: „Elfogadom a javaslatokat”)

1. **Új érték, nem új jelentés:** `site_unit.whole_only` (boolean, DEFAULT false) az egész-szállás egységen — csak az
   `is_whole_property`-vel együtt lehet igaz (DB CHECK). Visszatöltés nincs: a mai „igen”/„nem” változatlan.
2. **EGY predikátum:** `isBookableUnit` / `bookableUnits` (`unitVisibility.ts`, a levél-útról is hívható, felirat
   nélküli modul). Csak-egyben módban a ház az egyetlen foglalható; különben = `isGuestVisibleUnit`. Ezt olvassa a
   foglalási választó és az ártábla (`editor.ts`), a `/api/foglalas` (bemutató szobára 400), az ár-hiány
   (`priceGapsOf` → teendő + heti levél), az Árak lap és a „Hol látják…” doboz (`priceSiteView`).
   A szoba-kártyák, az aloldalak és a vélemény-választó továbbra is a `guestUnits`-ot olvassák: a szobák LÁTSZANAK.
3. **A bemutató szobától SEHOL nem kérünk árat:** a felvevő űrlapon nincs ár-mező (a 2. szobánál a „csak” választására
   CSS `:has`-szal tűnik el), a felküldött ár nem tárolódik; az Árak lapon nincs kártyája (egy mondat mondja meg,
   miért); a régről maradt ára a vendég-lapon sem jelenik meg. Ár nélkül a szoba-kártyán NINCS szétosztott ár —
   olyan szám lenne, amit senki nem állított be (§B.17, ADR-0232 ⑦).
4. **Admin (X):** a kérdés harmadik válasza „Csak egyben adom ki — a szobák bemutatásra”; a Szobák kártyán a kapcsoló
   helyett három állás („Nem adom ki egyben” / „Egyben is kiadom” / „Csak egyben adom ki”) — itt állítható át
   később. Egy régi űrlap `on` mezője „Egyben is kiadom”-ot jelent.
5. **A kizárás változatlan** (`blockingUnitIds`, ADR-0114): egy még élő, korábbi szobafoglalás továbbra is zárja a
   házat — a vendéggel kötött megállapodást egy admin-kapcsoló nem bontja fel (ADR-0256 ⑤ mintájára).
6. **Vendég-oldal (A):** a ház a szobák szekciójának ELSŐ eleme, kiemelt sávban (`data-cit-whole-mode="main"` — a
   `whole-unit-band` C-terv sávjának másik állapota, EGY rendszer, a testvér-szállal egyeztetve); alatta „A ház
   szobái” ugyanazzal a szoba-kártyával (második kártya-markup nincs), ár és „Foglalás” nélkül, „Részletek” gombbal;
   a felugró a HÁZAT foglalja. A render-adat már most viszi: `Room.wholeOnly` (a ház), `Room.presentation` (a szoba).

### Tanulság

A „ki látja?” és a „ki foglalhatja?” két kérdés. Amíg egy predikátum válaszolt mindkettőre, egy bemutatásra szánt
szobát csak elrejteni lehetett (a tulaj nem ezt akarta) vagy foglalhatóvá tenni (rossz foglalás). A tulaj második
mondata („szobák nem kérnek árát”) nem stílus-kérés volt: a kódban öt helyen (űrlap, Árak kártya, „Hol látják”
doboz, teendő, heti levél) nyaggatta volna egy ilyen tulajt örökösen — a mockon a „Hol látják” doboz nem is
szerepelt, csak a kész felület képe mutatta meg.
