# KONTRAKTUS — „csak egyben adom ki”: a ház az egyetlen ajánlat, a szobák bemutatásra

**Jóváhagyva:** 2026-09-28, tulajdonosi döntés (a koordinátor-sessionön át, szó szerint): „Elfogadom a javaslatokat”
— vendég-oldal **A**, admin **X**, adatmező `site_unit.whole_only`. Előzmény, a tulaj szava: „Nem arról van szó
hogy egyben is kiadom az kvázi megvan. Hanem: csak egyben adom ki!!! És akkor szobák nem kérnek árát…”
Kapcsolódó: ADR-0232 (az egész szállás választható egység), ADR-0256 (a nem kiadó egész rejtve),
`whole-unit-band/` (az „egyben is kiadó” sáv, C — ennek a tervnek a TESTVÉR-állapota).

- Terv: `plan.html` (önhordó, kattintható; „Mobil 390px / Asztali”, „Vendég-oldal / Tulaj (admin)”, A/B/C, „van ára / nincs ára”, X/Y)
- Képek: `shots/A-*` (a jóváhagyott vendég-oldal), `shots/admin-X-*` (a jóváhagyott admin); `B-*`, `C-*`, `admin-Y-*` a nem választottak.
  Mind mobil ÉS asztali.

**Hatókör:** `migrations/0079_unit_whole_only.sql` · `src/tenant/units.ts` · `src/tenant/unitVisibility.ts` · `src/tenant/editor.ts` · `src/tenant/priceGap.ts` · `src/tenant/priceSiteView.ts` · `src/server/public.ts` · `src/server/moduleConfigViews.ts` · `src/engine/recipe.ts` · `src/engine/moduleSections.ts` · `src/engine/templateKit.ts` · `assets/runtime/cit-runtime.js`

A vendég-oldali rész (`moduleSections.ts`, `templateKit.ts`, `cit-runtime.js`) a `whole-unit-band` land UTÁN, annak a sávjára építve készül.

## Mit KÖT ez a terv (elvárt viselkedés, nem stílus-javaslat)

### Adat és szabály
1. **Harmadik állapot, új érték:** `site_unit.whole_only` (boolean, DEFAULT false) az egész-szállás egységen; CSAK az
   `is_whole_property`-vel együtt lehet igaz (DB CHECK). A mai „igen”/„nem” jelentése nem változik, mai bérlő változatlan.
2. **EGY predikátum:** `isBookableUnit` / `bookableUnits` (`unitVisibility.ts`). Csak-egyben módban a ház az EGYETLEN
   foglalható egység. A szobák LÁTSZANAK (szoba-kártya, aloldal, vélemény-választó: `guestUnits`), de a foglalási
   választóban, az ártáblában és a `/api/foglalas`-ban nincsenek (bemutató szobára 400).
3. **Árat SEHOL nem kérünk a bemutató szobától:** a felvevő űrlapon nincs ár-mező és nincs „nem adok meg árat”; a felküldött
   ár nem tárolódik; az Árak lapon nincs kártyája; a „Hol látják…” doboz nem sorolja „Ár nélkül”; nincs teendő és nincs heti
   emlékeztető levél (`priceGapsOf`). A szobán régről maradt ár sem jelenik meg a vendégnek.
4. **A kizárás változatlan** (`blockingUnitIds`, ADR-0114): egy régi, még élő szobafoglalás továbbra is zárja a házat.

### Admin (X)
5. A 2. szoba felvételekor a kérdés harmadik válasza: **„Csak egyben adom ki — a szobák bemutatásra”**. Választásakor az
   ár-mező eltűnik (CSS `:has`, JS nélkül is), és a helyén a mondat: **„Ennek a szobának nem kell ár”** — a vendég csak az egész házat foglalja, árat csak arra kérünk.
6. A Szobák lap „Az egész szállás egyben” kártyáján a kapcsoló helyett három állás: **„Nem adom ki egyben”** ·
   **„Egyben is kiadom”** · **„Csak egyben adom ki”** — itt állítható át később. Egy régi űrlap `on` mezője „Egyben is kiadom”.
7. A rácson a ház **„csak egyben kiadó”**, a szobák **„csak bemutatásra”** jelölést kapnak; az Árak lapon egy mondat mondja meg,
   miért nincs a szobáknak kártyája.

### Vendég-oldal (A) — a `whole-unit-band` sáv „main” állapota
8. A szobák szekciójának ELSŐ eleme a ház, kiemelt sávban (`data-cit-whole-mode="main"`): „Csak egyben kiadó” címke, a ház neve,
   „Az egész ház az Önöké: N szoba, legfeljebb M fő.”, az ár („-tól” padlóval) és „Foglalás”; ár nélkül „Egyedi ár” + „A szállásadó
   árajánlattal válaszol.” és „Árajánlatot kérek”. A szám a vendég-látható szobák SZÁMA, a fő a ház férőhelye — kitalált adat nincs.
9. Alatta „A ház szobái”: ugyanaz a szoba-kártya (`roomShell`/`roomsBlock`, második kártya-markup NINCS), fotó, férőhely,
   felszereltség, „A ház része — a házzal együtt foglalható.”, a gomb „Részletek” — **ár NINCS, „Foglalás” NINCS**
   (egy szétosztott ár olyan szám lenne, amit senki nem állított be — ADR-0232 ⑦, §B.17).
10. A felugróban „A ház része” felső címke, és: „Ez a szoba külön nem foglalható — a <ház> csak egyben kiadó, N szobával.”
    A fő gomb „Az egész ház foglalása” (ár nélkül „Árajánlat az egész házra”), és a foglalás-dobozt a HÁZON hagyja.
11. A foglalás-dobozban nincs szoba-választó: egyetlen egység, a ház (a `booking.units` csak a házat viszi).

⚠️ A vendég-oldali feliratok (8–10) kötő jelölése a megvalósítás UTOLSÓ lépése: amíg nincsenek a kódban, nem jelöljük kötőnek.

## Mérve a terven (Playwright, 390 touch + 1280)

- A/B/C: 3 szoba-csempe, egyikben sincs ár és „Foglalás”; egy „main” ház-blokk; a felugró gombja a házat foglalja; a doboz
  árazott módban „Tovább a kérés adataihoz (2 éjszaka)”, ár nélkül „Árajánlatot kérek”; nincs szoba-választó;
- X: válasz nélkül üzenet; „csak” → nincs ár-mező, a mondat látszik; mentés után az Árak csak a házat kéri; később „Egyben is” → minden foglalható;
- 0 JS-hiba mindkét méreten.

## Ami NEM ennek a tervnek a tárgya

- Az „egyben is kiadó” eset (az a `whole-unit-band` C-terve).
- Az Online foglalás képernyő egység-naptárai (a bemutató szobák naptára ott marad; foglalás nem érkezhet rá).
