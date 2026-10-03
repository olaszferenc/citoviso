## ADR-XXXX — A Google-értékelés a lapon EGYSZER áll a forrás-linkjével: a sablon saját linkes kártyája mellől a közös jelvény kimarad

- **Kiváltó (2026-10-02, a Kapunyitás-sablon mellék-lelete, ADR-0311):** „a Google-jelvény (ADR-0046, `trust` slot) a
  sablon saját értékelés-szakasza alatt is kiírja ugyanazt a számot — minden sablonon így van”. Brief:
  `~/rc-briefs/fix-google-jelveny-dupla.md` (koordinátor).
- **Mérés (böngészőben, 21 sablon × 390 px / 1366 px, a valós mock-adat alakjával — a dev-DB mind a 165 rating-es
  mockja: rating-stat + rating(url), first-party vélemény nélkül; + élő lap a `google-rating` modullal, ± vélemény):**
  - A „minden sablonon” állítás NEM igaz. A 19 régi sablonon a vélemény-részben a szám EGYSZER áll (a `reviews-pending`
    jelvénye, illetve a `google-rating` modulé); a többi előfordulás a hős-statisztika, a mobil CTA-sáv és néhány
    sablon saját fejléc-/oldalsáv-kiírása — ezt a párost („állítás fent + hitelesíthető jelvény a vélemény-részben”)
    az ADR-0057 ② már jóváhagyta.
  - A valódi dupla a **`walk-through` és a `gate-opening`** sablonon: a SAJÁT értékelés-kártya kiírja a számot a
    „Megnézem a Google-on” linkkel, és közvetlenül alatta a közös jelvény ugyanazt a számot ugyanazzal a linkkel —
    mockon (`reviews-pending`) és élő lapon (`google-rating` modul) is, mobilon és asztalon is.

**Döntés**

1. **Szabály: a Google vélemény-oldalára mutató link (= a hitelesíthető értékelés) a lapon PONTOSAN EGYSZER.** Ez az
   ADR-0057 ② („a jelvény kimarad, ha felette már mutat egy”) kiterjesztése a sablon SAJÁT kártyájára — eddig csak a
   modul–modul párra volt bekötve. Kinézeti döntést nem igényel: a megmaradó példány a sablon saját, natív stílusú
   kártyája (ADR-0057 ①), amely a linket is viszi.
2. **A mérés a sablon KIMENETÉN** történik (`render.ts`: a nyers sablon-HTML tartalmaz-e `href`-et a vélemény-oldalra),
   nem sablon-listán — a `roomsAlreadyShown` mintájára. A 22. sablon ugyanígy ítéltetik.
3. **Nulla is hiba:** a szám mellől a forrás nem tűnhet el (ADR-0046 ③, a Places-attribúció), ezért az őr a túljavítást
   (mindenhol kimaradó jelvény) is pirosra futtatja.

**Amit NEM dönt el (a koordinátorhoz jelezve):**
- a hős-statisztika / mobil CTA-sáv / sablon-fejléc ismétlései (brutalism: hős-címke + nagy szám ugyanabban a hősben;
  editorial: fejléc + oldalsáv; card-sidebar: felső sor + oldalsáv) — ezek sablon-tervezői döntések, nem a közös
  jelvény hibái;
- élő lapon a `google-rating` modul + first-party vélemények esetén a 16 régi sablon saját vélemény-fejléce LINK NÉLKÜL
  kiírja a számot, a modul-jelvény pedig linkkel — az melyik maradjon, kinézeti döntés (ma nincs ilyen élő tenant);
- a walk-through / gate-opening „Vendégek értékelése” kártya alatt megmaradó „Vendégek véleménye” cím (a helytöltő
  szekció) — két közeli cím, de nem két értékelés.

**Visszafordíthatóság:** 🔄 teljesen (egy feltétel a trust-slot két blokkjában), adat nem változik.

**Bizonyíték:** `scripts/rating-once-check.mts` (21 sablon × 3 alany: mock · élő+modul · élő+modul+vélemény) — a
javítás ELŐTTI kódon 6 piros (walk-through + gate-opening × 3 alany), utána zöld; `--self-test` a régi jelvényt
visszarakva mind a 6 esetet elkapja. Pre-commitba kötve.
