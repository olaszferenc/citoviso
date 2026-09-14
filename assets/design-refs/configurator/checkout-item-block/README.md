# A fizetőoldal TÉTEL-DOBOZA — jóváhagyott terv (2026-09-14, tulaj: „A — Ár-bontás + Havi/Éves”)

**Hatókör:** `assets/runtime/cit-configurator.js` · `assets/runtime/cit-configurator.css` · `src/generator/configurator.ts`

A `plan.html` a KONTRAKTUS (kattintható, önhordó; képek: `plan-mobile.png`, `plan-desktop.png`).
**Ez a terv KIEGÉSZÍTI a `../checkout-fullscreen/` kontraktust, nem írja felül** — annak mind a 13
kötő pontja érvényben marad. Horgony: **ADR-0080** (fordulónap) · **ADR-0088 ⑨** ·
**ADR-0098** (AAM) · **ADR-0144** (egy vásárlási úton egy fordulónap) · **03-INVARIANTS §B.17**.

---

## ⚠️ ELŐSZÖR: miért kellett ezt MÉGEGYSZER jóváhagyatni

⛔ **Ez a tétel-blokk MÁR JÓVÁ VOLT HAGYVA 2026-09-11-én, és sosem épült meg.**

A `../checkout-fullscreen/plan.html` **215–220. sora** pontosan ezt rajzolta:

```html
<div class="item">
  <h3>ELEK-TESZT Vendégház</h3>
  <p>Citoviso honlap — éves előfizetés (12 hónap, ebből 2 hónap ingyen).</p>
  <div class="line"><span>Éves listaár</span><span>99 900 Ft / év</span></div>
  <div class="line disc"><span>Egyszeri bevezető kedvezmény (−25%)</span><span>−24 975 Ft</span></div>
</div>
```

A szállított `cit-configurator.js`-ben ennek **nulla nyoma** volt. Mérve 2026-09-14-én, a valós
renderelt panelen (390 és 1280 px): a fizetés-lépés teljes szövegére `mentionsSiteName: false`,
`mentionsSectionCount: false` — a képernyőn egyedül „Fizetés / 2/2 lépés” állt.
⛔ **A manifest a szállás nevét ki sem adta a böngészőnek** (`leadName` a szerveren megvolt, de a
`window` felé küldött csomagban nem szerepelt), tehát a futtató kód akkor sem tudta volna kiírni,
ha akarta volna.

### Miért nem fogta a `contract-drift-check`

Az őr **KÖTŐ FELIRATOKAT** ellenőriz: azokat a sztringeket, amiket a README `**„…”**` alakban
jelöl meg, és megkeresi őket a `**Hatókör:**` fájljaiban. A tétel-blokknak **nem volt kötő
felirata** — a tartalma ADAT (a szállás neve), nem literál. Az őr tehát **nem tévedett: nem is
kérdezte.** Egy terv SZERKEZETI eleme kívül esett a kapu látóterén.

### Ezért ez a README SZERKEZETI HORGONYT is köt

A lenti **Kötő horgony** szakasz olyan azonosítókat (CSS-osztály / `data-*`) sorol fel, amiknek a
Hatókör fájljaiban LÉTEZNIÜK kell. A `contract-drift-check` ezt mostantól ugyanúgy méri, mint a
feliratokat — így egy jóváhagyott terv eleme nem tud még egyszer némán kimaradni a szállításból.
Ezen felül a `scripts/checkout-item-block-check.mts` a **renderelt panelen**, valódi adattal
méri, hogy a doboz tényleg megjelenik és tényleg a vevő tételét mondja.

---

## Amit KÖT — elvárt VISELKEDÉSEK, nem stílus-javaslatok

1. **A fizetőoldal MEGNEVEZI, mit vesz a vevő.** A számlázási lépés legelső blokkja a tétel-doboz,
   a görgethető zóna tetején. Kötő felirat: **„Amit megrendel”**.

2. **A doboz a SZÁLLÁS NEVÉT írja ki**, nem egy általános terméknevet. A név a szerverről, a
   manifesten át érkezik (`product.name`) — ugyanabból a `leadName`-ből, amiből az aldomain-javaslat
   is képződik, tehát nem lehet két különböző „ez a te szállásod” a folyamatban.
   ⛔ Ha a név üresen érkezne, a doboz **nem talál ki egyet**: a név sora elmarad, a tétel-sor és az
   árak maradnak (§B.17 — kevesebb, sosem hamis).

3. **A tétel megnevezi a TERMÉKET és a CIKLUST egy mondatban**, a választott ütem szerint:
   éves ütemben „…éves előfizetés (12 hónap, ebből N hónap ingyen)”, havi ütemben
   „…havi előfizetés (bármikor lemondható)”. Az `N` a `pricing.annualFreeMonths`-ból jön, nem
   beégetve.

4. **Ár-bontás: listaár és kedvezmény KÜLÖN soron.** A listaár sora megnevezi az ütemet
   (**„Éves listaár”** / **„Havi listaár”**), a kedvezmény sora negatív előjellel a levont
   összeget mutatja. ⛔ Egy soron egy mértékegység: a havi és az éves szám nem keveredhet.
   Kedvezmény nélkül a kedvezmény-sor **nincs ott** (nem „−0 Ft”).

5. **A Havi/Éves váltó OTT van, ahol a döntés születik** — a tétel-dobozban, a fizetőoldalon.
   Kötő feliratok: **„Havi”**, **„Éves”**.

6. **EGY ütem-állapot van, nem kettő.** A fizetőoldali váltó ugyanazt a `period` állapotot írja,
   amit a modul-választó lépés váltója, és **mindkét felület azonnal újrarajzolódik** belőle.
   ⛔ Két külön példány két igazságot mutatna egy képernyőn — ez a ház egyik mért, visszatérő
   hibaosztálya.

7. **Az ütem váltása MINDEN számot átír**, ami a képernyőn van: a nagy összeg, a „/ év”↔„/ hó”
   utótag, az áthúzott listaár, a tétel-doboz két sora, a fizetés-gomb felirata és a következő
   terhelés mondata. ⛔ Nem maradhat a képernyőn olyan szám, ami az előző ütemé.

8. **A doboz nem tesz ígéretet arra, amit nem tudunk.** Nem írja ki a leendő webcímet és nem
   állít élesítési határidőt: a fizetés pillanatában egyik sem biztos (§B.17).

## Kötő horgony (SZERKEZET — a `contract-drift-check` ezt is méri)

- `cit-cfg-item` — a tétel-doboz konténere
- `cit-cfg-item-name` — a szállás nevének eleme
- `cit-cfg-item-sub` — a termék + ciklus mondata
- `cit-cfg-item-list` — a listaár sora
- `cit-cfg-item-disc` — a kedvezmény sora
- `cit-cfg-period3` — a fizetőoldali Havi/Éves váltó

## Ellenőrzés

`scripts/checkout-item-block-check.mts` — a VALÓS renderelt panelen (`renderSite → injectRuntime →
injectConfigurator`), 390 px-en és asztalin, végigkattintva: a doboz ott van a fizetés-lépésen, a
szállás nevével; az ütem-váltó mindkét irányban átír minden számot; kedvezmény nélkül nincs
kedvezmény-sor; üres névnél nincs kitalált név. Piros önteszttel.

⚠️ **A mérő maga is mérendő** (a `../checkout-fullscreen/README.md` záró figyelmeztetése itt is
áll): a Playwright `check()`/`click()` auto-scrollja az `overflow:hidden` konténert is elgörgeti,
ezért a láthatóságot érintetlen görgetési állapotban kell mérni.
