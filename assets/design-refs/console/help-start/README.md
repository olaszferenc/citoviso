# Súgó — ÉRKEZÉSI ÁLLAPOT (JÓVÁHAGYOTT terv, 2026-09-13)

**Hatókör:** `src/console/views.ts` · `src/server/adminViews.ts` · `public/assets/ui/citui-console.css` ·
`public/assets/ui/citui-admin.css`

Változat: **C — Indulólap a jobb hasábban**. A tulaj három működő vázlatból választott (A / B / C,
mobil + asztali képpel). Kontraktus-fájl: `approved-C.html` (kattintható, valós adattal, méret-váltóval).

> ⚠️ **Ez a terv FELÜLÍRJA a `../help-collapse/README.md` 1. pontját** („alapállapotban minden csoport
> csukva"). Az a pont mérve NULLA látható cikkcímet adott érkezéskor, miközben a jobb hasáb
> „Válassz témát a listából"-t kért — a felület olyat kért, amit maga nem kínált. A `help-collapse`
> többi pontja (több csoport nyitható · darabszám a fejlécen · gombpár · keresés-láthatóság ·
> JS-nélküliség · a tenant-admin ugyanígy) VÁLTOZATLANUL ÉL.
>
> **Miért csúszott át:** a `help-collapse` jóváhagyott vázlata **egyhasábos** volt. Az éles lap
> kéthasábos — a vázlat soha nem mutatta meg a jobb oldali felszólító dobozt és a mellette üresen
> álló ~70%-ot. A vázlat nem azt a felületet modellezte, amit jóváhagytunk.

## Amit a terv KÖT (elvárt viselkedés, nem stílus-javaslat)

1. **ÉRKEZÉSKOR LÁTSZIK CIKKCÍM.** A lista **első csoportja NYITVA** renderel; a többi csukva.
   ⚠️ Ez SZERVER-oldalon dől el (`<details open>`), nem kliens-oldali kinyitogatással — különben
   JS nélkül pont a hiba maradna meg.
   ⭐ **ASZTALON viszont a bal lista CSUKVA érkezik** (tulaj-döntés, 2026-09-13, Elek FK-000):
   ha az indulólap-rács látszik, **ő** a tartalomjegyzék, és a nyitott bal csoport ugyanazt a 9
   csoportot és 35 cikket adná **másodszor egy képernyőn**. A csoportfejek ettől még LÁTSZANAK —
   a lista nem tűnik el, csak becsukódik. Kereséskor NEM zár be: ott a találat a fontosabb.
   ⛔ **A DEGRADÁCIÓ IRÁNYA KÖTÖTT.** A becsukást JS végzi, mert a szerver nem ismeri a képernyő
   szélességét. Fordítva (alapból csukva + JS nyitja telefonon) a JS nélküli telefonos olvasó
   NULLA cikkcímet kapna — pontosan a bejelentett hiba. Így JS nélkül **fölösleg** keletkezik,
   nem **hiány**. A feltétel a rács TÉNYLEGES láthatósága (`display`), nem egy ide másolt
   töréspont-szám: az egy szabály két példánya lenne.
2. **A JOBB HASÁB INDULÓLAP, nem felszólítás.** Amíg nincs megnyitott cikk, a konzolon a jobb
   hasábban **témakör-kártyák** állnak, bennük MINDEN cikkcím kattinthatóan (szerver-oldalon
   renderelve). ⛔ A „Válassz témát a listából" mondat önmagában, üres 500 px fölött, tilos.
3. **TELEFONON az indulólap NEM jelenik meg.** Ott a lista maga az indulólap; a kártya ugyanazoknak
   a címeknek a második példánya lenne egy képernyőn. A két méret két külön tervezői döntés.
4. **A KERESŐ a panel teljes szélességét elfoglalja, és a helyőrzője BEFÉR.**
   ⛔ Mechanizmus, amit nem szabad újratermelni: a `.con form { display: inline }` (0,1,1) **veri**
   a `.con-kb-search { display: flex }`-et (0,1,0) → a mező a tartalmára zsugorodik, és a 274 px-es
   helyőrző elvágódik („Mit keresel? (pl. mock,"). Telefonon a teljes szélesség SEM elég: ott a
   mező egész sort kap, a gomb alá kerül.
5. **A „Mindet kinyitom / becsukom" A LISTA FÖLÖTT áll**, mert arra hat — nem a cikk-hasáb fölé
   igazítva. Mellette a darabszám („35 útmutató, 9 csoportban"), ami JS nélkül is látszik
   (a gombpár maga JS-es ráadás, és JS nélkül meg sem jelenik).
6. **A SÚGÓ ELÉRHETŐ A FŐMENÜBŐL:** a konzol fejlécének **utolsó** menüpontja (tulaj-döntés),
   és a `/help` lapon AKTÍVKÉNT emelkedik ki. Eddig csak URL-ből vagy egy képernyő ⓘ-ikonjából
   nyílt, és a lap egyetlen menüpontot sem emelt ki.
7. **A bal hasáb 360 px** (300 helyett): négy csoportnév két sorba tört, miközben mellette a
   képernyő nagyobbik fele üresen állt.
8. **A TENANT-ADMIN Súgó fülén** (`?tab=sugo`) az 1. és a 4. pont ugyanúgy áll. Az indulólap ott
   NEM értelmezett (nincs második hasáb), és a Súgó ott már fül — a 2., 5., 6., 7. nem vonatkozik rá.

9. **A HORGONY KATTINTHATÓ ELEMEN ÜL** (tulaj-kérés, 2026-09-13, az eredeti NYITOTT tétel).
   A `data-kb-anchor` LÁTHATATLAN attribútum: a lefedettség-kapu zöld lehet úgy, hogy a
   képernyőn nincs súgó-ikon — így állt évekig a Pénzügy öt lapja (Partnerek · Partner-lap ·
   Új partner · Bizonylatok · Új bizonylat). Ezért: a horgonyt `helpLink()` (vagy kézzel írt
   `<a>`) viselje, konténer-div NEM elég. Ezt a `kb-check --coverage` **statikusan kikényszeríti**,
   a rendered-őr pedig megméri, hogy az ikon **kifestődik** és a **kontrasztja ≥ 4,5**.
   ⛔ A kontraszt nem formalitás: a `.con a` link-szabály (0,1,1) verte a `.con-help`-et (0,1,0),
   ezért a súgó-ikon MINDEN konzol-képernyőn cián volt fehéren, **2,41** kontraszttal. A javítás
   pedig előállította a következő csapdát (`.con a.con-help` (0,2,1) verte a sötét-sáv szabályt),
   amit a mérés fogott meg: a partner-lap navy sávján 3,03. Végleges: 4,81 fehéren, 14,57 navy-n.

## Amit a terv NEM köt

- A nyitott cikk csoportjának nyitva tartása (a tulaj ezt korábban sem kérte).
- Állapot megjegyzése lapváltás után (nincs sütizés/localStorage).
- A mobil fejléc-menü vízszintes görgetése: meglévő, szándékos viselkedés — a Súgó ugyanúgy
  elérhető rajta, mint a Riport vagy a Beállítások. Az őr azt méri, hogy tényleg KIFESTŐDIK.

## Őr

`scripts/help-collapse-check.mts` — a RENDERELT `/help` és `/admin?tab=sugo` lapot kattintja végig
(érkezési állapot, nyitás, több nyitva, keresés-láthatóság, no-JS ág, helyőrző-befér mérés,
főmenü-elérés `elementFromPoint`-tal, indulólap-teljesség, gombpár-igazítás), negatív önteszttel
(`--self-test`). A visszarontott forráson mérve **10 valódi pirosat** ad, köztük a bejelentett
tünetre („érkezéskor LEGALÁBB 3 cikkcím LÁTSZIK — 0").
