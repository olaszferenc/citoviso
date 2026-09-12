# Fizetési lépés — jóváhagyott terv (2026-09-11, tulaj: „C — teljes felületű fizetés-lap”)

**Hatókör:** `assets/runtime/cit-configurator.js` · `assets/runtime/cit-configurator.css` · `src/console/views.ts`

A `plan.html` a KONTRAKTUS (kattintható, önhordó; képek: `plan-mobile.png`,
`plan-desktop.png`, `confirm-mobile.png`, `confirm-desktop.png`).
Horgony: **ADR-0080** (fordulónap, automatikus megújulás) · **ADR-0088 ⑨** (a
kártya-mandátum saját soron) · **ADR-0098** (AAM) · **03-INVARIANTS §B.17**.

## Miért készült — a mért hibák

Elek FK-005a köre a valós panelen mérve:
① a fejléc a SZÁMLÁZÁSI lépésen is azt írta, hogy **„Most nem fizet semmit”**,
miközben 120 px-rel lejjebb a „MOST FIZETENDŐ 74 925 Ft / év” állt, és a következő
gomb valódi terhelést indított. ② 390×844-en a `.cit-cfg-step3` görgőablaka
**276 px** volt 1 284 px tartalomhoz: a fizetés-gomb `y≈1766`-nál, mind a három
kötelező pipa a nézeten kívül, görgetés-jelzés nélkül — és **asztali 900 px-en is**
kívül (`y≈1424`). ③ az elállási nyilatkozat a panel alsó élénél mondat közepén
vágódott el. ④ a visszaigazolás hallgatott a tartós kötelezettségről. ⑤ ÁFA sehol.

## Amit KÖT — elvárt VISELKEDÉSEK, nem stílus-javaslatok

1. **A fizetés-lépés elhagyja a keskeny fiókot és teljes felületet kap.**
   A 440 px-es oldalpanel nem a fizetés konténere. Mobilon teljes képernyős lap,
   asztalin kéthasábos checkout. Az előnézet ilyenkor nem látszik — a vevő pénzt
   ad, az a képernyő dolga.

2. **A három kötelező hozzájárulás, a végösszeg és a fizetés-gomb EGY nézetben van
   — 390 px-en is, görgetés nélkül.** Mobilon a végösszeg felül ragad, a pipák és a
   gomb alul; közöttük görgethető az űrlap. Asztalin a jobb hasáb álló összegző
   kártya, benne az összeg, a pipák és a gomb. ⛔ A mérce **nem** az `isVisible()`:
   a kapu `elementFromPoint`-tal, ÉRINTETLEN görgetési állapotban mér
   (`scripts/checkout-viewport-check.mts`).

3. **Ha egy terület görgethető, azt a felület MEGMONDJA.** A jelzés MÉRT
   (`scrollHeight − clientHeight − scrollTop`), nem feltételezett, és eltűnik,
   amint a vevő az aljára ért.

4. **A fejléc SOHA nem mondhat ellent a gombnak.** A fizetés-lapon a strap kimondja,
   hogy a gomb valódi terhelést indít, és megnevezi az összeget. A
   **„Most nem fizet semmit”** mondat CSAK a böngésző (modul-választó) lépésen áll
   meg — ott igaz. Kötő felirat: **„valódi kártyaterhelést indít”**.

5. **A legnagyobb szám az, amit TÉNYLEG fizet.** A listaár csak áthúzva és kicsiben
   jelenik meg, és a gomb felirata is megnevezi az összeget, hogy a kettő ne
   tudjon némán szétcsúszni. Kötő felirat: **„Most fizetendő”**.
   ⚠️ A vázlaton az ajánlat-sor „Egyszeri bevezető kedvezmény” volt; a motorban ez
   az **ADR-0088 offer-ui kontraktus** szövege („Bemutatkozó ajánlat a levélből…”,
   „Egyszeri kedvezmény — utána …”), amit egy korábbi tulaj-jóváhagyás köt. Nem
   írtuk felül egy újabb vázlat kedvéért — a jelentés ugyanaz, és a kedvezmény
   egyszeriségét a fizetés-lapon a ⑦ szerinti mondat mondja ki, dátummal.

6. **ÁFA-utalás a fizetés-lapon ÉS a visszaigazoláson.** Ma AAM (ADR-0098), tehát
   a kötő mondat: **„az ár ÁFÁ-t nem tartalmaz”**. ⛔ Ha a cég kilép az AAM-ból, ez
   a mondat NEM maradhat — a számla `vatKey`-éből kell származnia, nem beégetve.

7. **A tartós kötelezettséget a fizetés ELŐTT is kimondjuk.** A végösszeg alatt ott
   áll a következő terhelés dátuma és összege, és hogy automatikus. Kötő felirat:
   **„A következő terhelés”**.

8. **Jogi szöveg soha nem vágódik el mondat közepén.** Minden hozzájárulás rövid
   sora ÖNMAGÁBAN egész mondat (ponttal végződik), a törvényi szöveg pedig
   **helyben** nyílik a **„Teljes szöveg”** kapcsolóval — nem külön lapon, nem
   levágva. A `45/2014. (II. 26.) Korm. rendelet` teljes szövege változatlan.

9. **A három hozzájárulás KÜLÖN sor marad, összevonni tilos** (ADR-0088 ⑨: a
   merchant-indított terhelés nem bújhat egy általános ÁSZF-pipa alá). A gomb
   addig tiltott, amíg mind nincs bejelölve, és a jegyzet MEGNEVEZI a hiányt
   (`0/3`); a tiltott gombra koppintva a hiányzó sorok pirosra váltanak. ⛔ Néma
   zsákutca nincs.

10. **Cég ágon két pipa van, nem három** — a cég nem fogyasztó, nincs elállási joga,
    amiről lemondhatna. Az adószám-mező megjelenik, a számláló `0/2`-re vált.

11. **A visszaigazolás kimondja a TARTÓS kötelezettséget** — „AZ ELŐFIZETÉSE” doboz,
    hat ténnyel (tulaj jóváhagyta mind a hatot): most fizetett · **következő terhelés
    dátuma ÉS összege** · **automatikus megújulás** · ÁFA-státusz · mikor jön a
    számla · **hol mondható le** (`Belépés → Modulok fül → „Előfizetés lemondása”`,
    a fordulónapon lép érvénybe). Kötő feliratok: **„Következő terhelés”**,
    **„Előfizetés lemondása”**.

12. **A belépés-útmutató TELJES URL, sosem csupasz `/login`.** Élesen a
    `config.publicSiteUrl` adja; ha az üres, a lap NEM írhat ki fél útvonalat —
    ilyenkor a szöveg az e-mailre mutat. (Mérve: a dev visszaigazoláson
    „Belépés: /login” állt, ami a vevőnek semmit nem mond.)

13. **Mindkét méret kötelező, és két KÜLÖN tervezői döntés.** `@container` query
    (NEM `@media`), a `plan.html` méret-váltója a VIEWPORTBÓL indul.

## Ellenőrzés

A tervet Playwrighttal végig kell kattintani, nem elég ránézni. Ebben a körben a
kép fogta meg azt, amit a DOM-mérés nem (a `.pay` osztály újrahasználása a fejléc
sorára kék flex-dobozzá törte a mondatot; a `[hidden]` adószám-mező látszott, mert
a `.f{display:flex}` veri a nulla specificitású UA-szabályt), a kattintás pedig
azt, amit a kép nem (a pipa-kapu és a számláló).

⚠️ **A mérő maga is mérendő.** A `check()`/`click()` Playwright-auto-scroll **az
`overflow:hidden` konténert is elgörgeti**, és ezzel a nézeten KÍVÜLI fizetés-gombot
behúzza a képbe — egy szándékosan elrontott vázlat emiatt 390 px-en zöldre mért.
Ezért a kapu (a) a görgetést nullázza a mérés előtt, (b) a pipákat `evaluate`-tel
állítja, nem `check()`-kel, és (c) piros önteszttel bizonyítja, hogy tud bukni.
