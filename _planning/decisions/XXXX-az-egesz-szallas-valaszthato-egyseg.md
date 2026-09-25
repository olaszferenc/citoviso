## ADR-XXXX — Az „egész szállás” VÁLASZTHATÓ egység: nem kötelező, törölhető, áttehető; saját árral (2026-09-25)

**Dátum:** 2026-09-25 · **Státusz:** elfogadva (megvalósítva, őrrel) · **Módosítja:** ADR-0114 ① és ⑦
(a kizárás-szabály ②–⑥ és ⑧ VÁLTOZATLAN), ADR-0074 F-terv „örökölt, szürke csempe” része ·
**Kapcsolódó:** ADR-0209 (két külön lista), ADR-0208/0222 (nincs ár → árajánlat) ·
**Jóváhagyott terv:** `assets/design-refs/tenant-admin/whole-property-choice/` („B”, a tulaj 2026-09-25).

### A mért tényállás (a tulaj bejelentése, 2026-09-25, a kódban végigkövetve)

Az ADR-0114 óta minden site-nak KÖTELEZŐEN volt egy „egész szállás” egysége (`is_whole_property`,
törölhetetlen), és az `ensureUnits()` **vissza is jelölte** az első egységet, ha egyik sem volt az.
A tulaj kétapartmanos esete: az alapértelmezett egységet átnevezi „Apartman 1”-re, felveszi az
„Apartman 2”-t — és az **Apartman 1 foglalása lezárja az Apartman 2-t** (és fordítva), mert a
rendszer az Apartman 1-et az egész háznak hiszi. A rácson „az egész ház” beleégve, a szoba nem
törölhető, a felszereltségnél a ház-szintű tételek szürkén, „AZ EGÉSZ SZÁLLÁSRA” címkével — a
tulaj szava: *„ezt át kell komolyan gondolni”*. Az ok nem használati hiba: a modell nem tudta
megkülönböztetni „az alapértelmezett egyetlen egység”-et „az egészet egyben is kiadom”-tól.

Előbb a PREMISSZÁT kérdeztük meg (ADR-0209 tanulsága), nem a magyarázatot terveztük: a tulaj
a „választható” modellt kérte, és a felszereltségnél a „kapcsolhatók legyenek a szobánál is”-t.

### Döntés

1. **Az egész szállás VÁLASZTÁS, nem kényszer.** `is_whole_property` marad az adat (site-onként
   legfeljebb egy — a 0059 részleges unique indexe él), de **senki nem jelöli vissza**: az
   `ensureUnits()` és a `peekUnits()` vissza-jelölő ága törölve. Üres jelölés = a szobák egymástól
   függetlenül telnek be (`blockingUnitIds` ezt eddig is így adta vissza).
2. **Egy egységnél a fogalom láthatatlan.** Nincs kártya, nincs „az egész ház” a rácson/felugrón/
   vendég-kártyán (`wholeProperty` a recipe-ben csak 2+ egységnél), nincs kérdés. Az egyetlen
   egység a régi alapértelmezéssel jelölve születik — de ez semmit nem jelent, amíg nincs második.
3. **A 2. egység pillanata dönt.** A felvevő űrlap (Szobák ÉS Foglalás képernyő) egy egységnél
   KÖTELEZŐ rádiót tesz fel: „Az egész szállást is kiadja egyben?” — *igen* → az eddigi egység az
   egész; *nem* → senki. Válasz nélkül (régi űrlap, 3.+ egység) a jelölés nem változik.
4. **Kártya a rács fölött (B):** „Az egész szállás egyben” — kapcsoló + „melyik egység” választó,
   `POST /admin/units/whole`. Kikapcsolva → nincs jelölt. Zéró JS-sel is működik (form + Mentés).
   A kártya kimondja a következményt („…minden más egység tele lesz… bármelyik szoba foglalása az
   egészet zárja”), nem csak a tényt.
5. **Bármely egység törölhető, az egész is** (ADR-0114 ⑦ hatályon kívül). Az utolsó nem
   (`deleteUnit`), elfogadott jövőbeli foglalással nem — ezek maradnak. A törlés arra a képernyőre
   tér vissza, ahol a gomb volt (`back`).
6. **A ház-szintű Felszereltség tételei a szobánál is KAPCSOLHATÓK** — a szürke, zárolt csempe
   megszűnik; a tétel „a ház egészénél is” jelölést visel (tájékoztatás, nem tiltás). A két lista
   továbbra is külön (ADR-0209), a renderelő nem veti össze őket.
7. **Az egész szállásnak SAJÁT ára van, sosem a szobák összege.** Egy származtatott ár olyan szám
   lenne, amit senki nem állított be (§B.17), és a valóságban az egész ház ára nem a részek összege.
   Ár nélkül az ADR-0222 útja (árajánlat). Az Árak lapon az egész alatt egy TULAJ-OLDALI tájékoztató
   sor áll („Tájékoztatásul: a szobák külön, együtt X Ft / éj. … Az egész szállás ára ettől
   független — azt Ön adja meg.”) — a vendég-lapon SOHA (őr méri).

### Őr

`scripts/whole-property-choice-check.mts` (pre-commit, `units.ts`/`unitScope.ts`/`editor.ts`/
`moduleConfigViews.ts`/`public.ts` változásakor): saját eldobható fixtúra, valódi HTTP; ①–⑦ a
fenti pontok a RENDERELT lapon + `blockingUnitIds`-on mérve, negatív kontrollal (idegen id nem
jelöl; `ensureUnits`/`peekUnits` nem talál ki egészet; a vendég-lapon nincs szumma).
`scripts/amenity-picker-check.mts` a 6. pontra átírva (kapcsolható + jelölt, zárolt csempe nincs).
Az ADR-0114 őre (`whole-property-check`) változatlanul méri a kizárást, ha VAN jelölt egység.

### Tanulság

A 2026-09-08-i rendelet („az egész szállás mint egység mindig van”) a dupla foglalás ellen
született, és arra jó is — de az „mindig van” a KIZÁRÁSRA vonatkozott, nem arra, hogy a tulaj
akarata ellenére legyen egy ilyen egység. A kettő szétválasztása (adat marad, kényszer megy) tartja
meg az ADR-0114 védelmét ott, ahol a tulaj tényleg egyben is kiad.
