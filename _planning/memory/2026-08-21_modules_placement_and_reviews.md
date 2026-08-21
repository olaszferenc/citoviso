# 2026-08-21 — Modulok: a vélemény, a HELY és az egy folyamat (ADR-0046/47/48/49)

## A szál íve

A `reviews` modul lezárásával indult, és a tulaj két beszúrása fordította meg kétszer is:
előbb a Brave-kérdés („miért nem emeljük át a Google-véleményeket?"), majd — egy élő
`/configure/` linket nézve — a valódi baj: **„egy csíkba, bal oldalt, van az összes modul"**.

## ① ADR-0046 — a vélemény a MIÉNK, a Google-ból csak a szám

Két szabály EGYÜTT zárja be a szöveg átemelését: tárolni tilos (a Places-feltételek egyetlen
korlátlan mezője a `place_id`, a mi oldalunk viszont statikus snapshot), futásidőben pedig a
review-szöveg ~$25/1000 (≈9 Ft/hívás) → a 690 Ft/hó-s modul ~77 oldalletöltés után veszteséges.
Bármelyik önmagában megkerülhető lenne; együtt nem.

A SZÁM más kategória: tény, nem szerzői mű, és a resolve **eddig is lekérte, majd eldobta**.
Két kapun megy ki, mindkettő zárva bukik: `match_confidence >= 0.7` (fals pozitívnál a SZOMSZÉD
csillagai mennének ki — ADR-0043) és 30 napos frissesség.

**Amit NEM ígérünk:** csillagos találati megjelenést. A moderált first-party vélemény sem ad
rich resultot (a review snippet szabály szerint a magát moderáló fél oldala nem jogosult).

## ② ADR-0047 — a modul MEGNEVEZETT helyre kerül

Három hiba egymáson, és **minden meglévő őr zöld volt mindhármon**:

1. a konfigurátor a `querySelector("footer")` elé injektált — de **12/16 sablon a vendégvélemény
   szerző-sorát is `<footer>`-rel jelöli** (`<blockquote><footer>— Péter</footer>`), tehát a teljes
   modul-kínálat egy idézet-kártyába került: **230–530px** egy 1400px-es képernyőn;
2. a minták csak a panel első megnyitásakor jelentek meg → a lead **0 modult** látott;
3. a `withModuleSections` mind a 10 blokkot egy tömbben az enquiry elé tette — az `editorial`-on
   az enquiry a KUPON a lap tetején, tehát tíz modul a galéria és a vélemények ELÉ ömlött,
   **élő tenant-oldalon is**.

Fix: négy megnevezett hely sablononként (`showcase` / `trust` / `practical` / `closing`). Négy és
nem tíz: tíz slot 160 döntés lenne 16 sablonon. A blokk-KÓD közös marad → nincs 100×N.

## ③ ADR-0048 — egy oldal, EGY folyamat + a kitalált vélemény kivezetve

Az ADR-0044 „ha van foglalás, nincs érdeklődés" döntése csak a SLOT-ra ment át: **26 beégetett
felirat 13 fájlban** maradt „Érdeklődés". Mérve: a foglalás bekapcsolása egyetlen feliratot sem
cserélt. A CTA-szó most adatból jön (`ctaLabel`).

`SAMPLE_REVIEWS` kivezetve: három kitalált idézet („Péter", „a Kovács család") **valós cég oldalán,
valós Google-átlaga alatt** — úgy olvasódott, mintha a 143-ból mutatnánk hármat. A „minta" jelölés
~1200 karakterrel lejjebb, képernyőn kívül volt.

## ④ ADR-0049 — kiadási időszak

A tulaj: „meg kell tudnia adni, hogy milyen időszakokban adja ki egyáltalán. Milyen minimum hány
napra?" A szezon már létezett (`unit_price`, MM-DD, egységenként) → **nem csináltunk második
listát**; a szezon-sor hordozza az árat, a minimumot és (a `seasonal_only` kapcsolón át) hogy
kiadható-e. Éjszakánként vizsgálunk, és a zárt nap a vendég naptárában is foglalt.

## A MÓDSZERTANI tanulságok (ezek túlélik a szálat)

1. **A jelenlét nem elrendezés.** Minden őr azt kérdezte, „ott van-e a tartalom?" — egyik sem azt,
   hogy „HOL, és milyen széles?". Amit a vevő lát, azt böngészőben kell MEGMÉRNI.
2. **A rontást is ellenőrizni kell.** Kétszer maradt zöld egy piros-teszt, mert a `perl`/`sed`
   mintám nem illeszkedett — nem volt rontás. Azóta `grep -c` igazolja a rontást, mielőtt
   a „nem lett piros" bármit jelentene.
3. **A mérés is elavulhat.** A slot-lefedettség először renderelt oldalon kereste a jelölőket, és
   pirosra váltott, amint egy slot mindig kapott tartalmat — a KÓD volt jó. Azóta forrásból olvas.
4. **Féloldalas fix + féloldalas őr = zöld hazugság.** A kitalált vélemény fixe először csak a 16
   sablonba került be; mind a 11 kompozíciós archetípus tovább fabrikált. A kapu MINDKÉT
   render-utat méri.

## Elvégzett munka

4 commit, felküldve (`0153a67`, `a611f5b`, `e21121f`, `c8cbd69`).
Migrációk: `0027_reviews.sql`, `0028_unit_season.sql`.
Új őrök: `review-flow-check` (24 ellenőrzés), `module-slot-check`, `configurator-placement-check`,
`shot-review-form` (390px). Bővítve: `module-render-check`, `module-config-check` (+9).

## Mellék-leletek (külön szeletek)

- **`POST /api/hirlevel` NEM LÉTEZIK** — a hírlevél-űrlap a semmibe küld. Ugyanaz a minta.
- Az `extract-i18n` sosem olvasta a `moduleSections.ts`-t, pedig az i18n-lint mindig megkövetelte
  ott a `T()`-t → minden modul-felirat (ADR-0044 óta) kiesett a katalógusból. Javítva, 312 → 346.
- A `kb-check --coverage` csak a MÁR KITETT horgonyokat kéri számon, tehát egy új admin-funkció
  súgó nélkül átcsúszik. Az én `reviews`-kezelőm és a szezon-kapcsolóm még horgony nélkül van (§J).

## Nyitott

1. **A `seasonal_only` kapcsoló a pricing képernyőn van** (tulaj jóváhagyta), de ha a tenant NEM
   vette meg a booking modult, a kapcsolónak nincs látható hatása → ál-választás kockázat.
   Vagy rejtsük booking nélkül, vagy adjunk neki booking-független jelentést (az ártáblán:
   „ebben az időszakban adjuk ki").
2. **KB-bejegyzés + súgó-horgony** a vélemény-kezelőhöz és a szezon-kapcsolóhoz (ADR-0045 §J).
3. **Éles deploy** — a prod a 0022-nél áll; a `0023`–`0028` migráció és a teljes modul-réteg
   hiányzik. Külön, scope-olt engedély kell.
4. `booking-maintenance` cron (nem sürgős, a portál-szinkron sötét).
