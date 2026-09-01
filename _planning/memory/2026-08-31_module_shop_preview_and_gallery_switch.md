# 2026-08-31 — Tenant-admin „Modulok" fül: kirakat + fizetés előtti oldal-előnézet, és a galéria-kapcsoló megjavítása

**ADR:** ADR-0089 · **Landolva:** `5e31d9b` (fül + előnézet), `20f13f7` (galéria) · **Élesítve: NINCS** (külön engedély, §0.3)

## Kiváltó

A tulaj felvetése: a fül EGY listába gyúrta a megvásárolt és a meg nem vásárolt
modulokat, és egy kapcsoló + egy ár-chip nem mondja meg, MIT kapna.
„A cél az, hogy lássa, ha mégis meg akar venni valamit, az hogy fog kinézni."

## §2b kör

Négy eljárási rendet javasoltam (kártyán belüli kivágat / teljes oldalas árnyék-előnézet /
kétpaneles konfigurátor / szétvágás+kirakat), majd 3 működő mockot szállítottam mobil+asztali
képekkel. A tulaj az **A** változatot választotta, egy kiegészítéssel: **teljes képernyő +
Mobil/Asztali váltó** az előnézetben. Kontraktus: `assets/design-refs/console/modules-tab/`.

## Amit szállított

- **Két blokk:** „Az én moduljaim" (munka-felület) + „Bővítés — amit még hozzáadhat" (kirakat,
  a kártyán a szekció VALÓDI mini-renderjével).
- **Teljes oldalas előnézet** a kosár állapotával, kiemelt szakasszal, Mobil/Asztali váltóval
  (asztali nézetben valódi desktop elrendezés, telefonon arányosan kicsinyítve) és teljes
  képernyővel.
- **Egy render, sok bélyegkép:** minden kirakat-kártya UGYANAZT az all-in előnézetet tölti be
  (`?on=*`), és a HASH-en (`#only=<id>`) vág ki egy szekciót → a böngésző egyszer tölti le.
- ⛔ **Az előnézet semmit nem ír** (se entitlement, se snapshot, se DB-sor).
- Minden meg nem vásárolt szakasz **„MINTA — az Ön adataival töltjük fel"** címkét visel.

## Amit a MÉRÉS talált meg, nem a szemem

1. **A nem birtokolt modul előnézete a modul NÉLKÜL töltött be** — vagyis a „mutasd, hogy nézne
   ki" a mai oldalt mutatta. A fókuszált modult mindig hozzá kell adni az előnézett halmazhoz.
2. **Az egy-szekciós kivágat 0 magasságúra omlott:** a `.cit-pv-keep *{display:revert}` szabály
   a megtartott szekció SAJÁT grid/flex elrendezését is szétverte. Tanulság: a kivágás a
   TESTVÉREKET rejtse el, a megtartott részfához ne nyúljon.
3. **Az „üres sáv"-detektorom kétszer tévedett ellentétes irányba:** elemnév-lista alapon a
   `<div><h3>` blokkokat üresnek látta (túl szigorú), szöveg alapon a „No. 1 — Képes krónika"
   fejlécet tartalomnak (túl elnéző). A helyes kérdés SZŰK: a galéria SAJÁT szekciójában
   van-e bekezdés/lista/tábla/média — fejléc és díszítő szám nem számít.
4. **Halott menü-link:** a galéria-szakasz eltávolítása után a fejlécben ott maradt a „Képes
   krónika" ugrópont. A képen vettem észre, nem a kódból.

## A galéria-kapcsoló (ADR-0089 ⑦)

A „Képek a szállásról" kikapcsolása eddig CSAK a fotó-plafont oldotta fel → semmi nem változott
az oldalon. Ez ugyanaz az **ál-választás**, amit az ADR-0059 már kimondott. Három lehetséges
jelentést vittem a tulaj elé (szekció le / minden fotó le / legyen az alapdíj része); a döntés:
**a galéria-SZEKCIÓ megy le, a fejléc-kép marad.**

⛔ Kép nélküli oldal továbbra sem születhet: ahol a galéria maga a fejléc képanyaga
(kollázs-hero, kompozíciós út), ott a lap EGYETLEN fotóval renderelődik újra.
A vágás EGY ponton történik a renderelt kimeneten, nem 18 sablonban.

## Az őr

`scripts/module-preview-check.mts` (pre-commitbe kötve), minden állítás mellé RED-iker:
az előnézet nem ír (a detektort a `renderAndPersist`-re fogva bizonyítom, hogy tud pirosra
menni) · a nem birtokolt szakasz jelölt · a fókuszált modul benne van a halmazban · felület
nélküli modul nem ígér előnézetet · a minta-engedély szűk (élesre semmi nem szivárog) ·
**a galéria-kapcsoló mind a 16 sablonon látható változást hoz, kép marad, nincs üres sáv,
nincs halott link** — a strip kiütésével mind a 16-ra pirosra megy (futtatva).

## ⚠️ Nyitott / jelentendő

- **A KÖZÖS dev DB-ből eltűnt mind a 3 teszt-tenant** (`tenant`/`tenant_user`/`site`/
  `module_entitlement`/`prospect` = 0; a `sites/<id>/` mappák is). A 592 lead megvan.
  Az utoljára alkalmazott migráció a `0045_offer.sql` (ADR-0088), ami NINCS az `origin/main`-en
  — a `wt/cit3e28ae97` ág (párhuzamos session) sajátja; maga a migráció nem törlő. **Dev mentés
  nincs**; a `~/backups/citoviso/` az ÉLES dumpokat tartja (ADR-0086), azt dev-be visszatölteni
  nem szabad. Következmény: a `:4800/admin` teszt-felületre nincs mivel belépni, amíg nincs új
  teszt-tenant (lead → mock → konverzió). A kódot ez nem érinti: az őr DB nélkül, 16 sablonon fut.
- Élesítés: külön engedéllyel, `scripts/deploy-prod.sh <commit> --go` (migráció nincs ebben a körben).
