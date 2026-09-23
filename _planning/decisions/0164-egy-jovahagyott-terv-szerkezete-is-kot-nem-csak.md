## ADR-0164 — Egy jóváhagyott terv SZERKEZETE is köt, nem csak a szavai (2026-09-14)

**Dátum:** 2026-09-14 · **Státusz:** ELFOGADVA (tulajdonosi döntés: „A — Ár-bontás + Havi/Éves”)
**Kapcsolódó:** ADR-0065/0066/0076 (§2b terv-kapu), ADR-0080 (fordulónap), ADR-0088 ⑨,
ADR-0098 (AAM), ADR-0144 (egy vásárlási úton egy fordulónap), 03-INVARIANTS §B.17.

**Kiváltó (mérve, Elek FK-005a köre, 2026-09-14).** A fizetőoldal sehol nem mondta meg, MIT vesz a
vevő. A valós renderelt panelen, 390 és 1280 px-en: `mentionsSiteName: false`,
`mentionsSectionCount: false` — a képernyőn „Fizetés / 2/2 lépés” állt, alatta a számlázási űrlap.
A manifest **a szállás nevét ki sem adta a böngészőnek**, tehát a futtató kód akkor sem tudta volna
kiírni, ha akarta volna.

⛔ **A lelet valódi súlya nem ez volt, hanem hogy MÁR JÓVÁ VOLT HAGYVA.** A 2026-09-11-i
`checkout-fullscreen/plan.html` **215–220. sora** pontosan ezt a megnevezett tétel-blokkot rajzolta
(szállásnév · termék egy mondatban · listaár · kedvezmény-sor). **Sosem épült meg**, és három napig
semmi nem szólt.

**A gyökér-ok (mérve, nem tippelve).** A `contract-drift-check` azokat a sztringeket őrzi, amiket a
README `**„…”**` alakban jelöl, a `**Hatókör:**` fájljaiban keresve. A tétel-blokknak **nem volt
kötő felirata** — a tartalma ADAT (a lead neve), nem literál. **Az őr nem tévedett: nem is
kérdezte.** Egy jóváhagyott terv SZERKEZETI eleme kívül esett minden kapu látóterén.

**A döntés.**

① **A fizetés minden képernyője megnevezi, MIT vesz a vevő.** A számlázási lépés első blokkja a
tétel-doboz: „Amit megrendel” + szállásnév + termék és ciklus egy mondatban + listaár + (ha van)
kedvezmény-sor. A név a manifesten át jön (`product.name`), ugyanabból a `leadName`-ből, amiből az
aldomain-javaslat — egy vásárlási úton nem lehet két „ez a te szállásod”. ⛔ Üres névnél a lap
**nem talál ki egyet**: a név sora elmarad, az árak maradnak (§B.17).

② **A Havi/Éves váltó ott áll, ahol a döntés születik** — a fizetőoldalon is, nem csak a
modul-választón. ⛔ De **EGY állapotból**: a két váltó ugyanazt a `period` változót írja és ugyanazt
a kezelőt hívja, a kijelölés pedig ÉRTÉK szerint szinkronizálódik, nem identitás szerint. (Az
eredeti `x === b` csak a megnyomott gombot gyújtotta ki, tehát a másik váltó a RÉGI ütemet mutatta
volna — egy állapot, két ellentmondó kijelző.)

③ **Az ütem váltása egyetlen számot sem hagyhat az előző ütemből** a képernyőn: a nagy összeg, a
„/ év”↔„/ hó”, az áthúzott listaár, a tétel-doboz két sora, a gomb felirata és a következő terhelés
mondata mind egyetlen újraszámolásból frissül. Az őr ezt **halmazként** méri (minden látható
összeget összeszed váltás előtt és után), nem egyetlen kiszemelt számon.

④ ⭐ **A KONTRAKTUS SZERKEZETET IS KÖTHET, NEM CSAK FELIRATOT.** A README-k mostantól
`## Kötő horgony` szakaszban felsorolhatnak azonosítókat (CSS-osztály, `data-*` horog), amiknek a
Hatókör fájljaiban létezniük kell; a `contract-drift-check` ezt ugyanúgy méri, mint a feliratokat.
⛔ **A horgony-keresés KIHAGYJA a stíluslapokat:** egy CSS-szabály azt bizonyítja, hogy az osztály
meg van FORMÁZVA, nem azt, hogy bármi renderelí — és a megformázott, de ki nem tett osztály pont a
keresett elcsúszás. (Élesen mérve: a `cit-cfg-item-disc` törlése a futtatóból ZÖLDEN hagyta az
első változatomat, mert a sztring a CSS-ben is ott volt.)

**Őr:** `scripts/checkout-item-block-check.mts` — 51 állítás a VALÓS renderelt panelen (a vevő
útját végigjárva), 390 px-en és asztalin, plusz két külön fixtúra: ajánlat nélkül **nincs**
kedvezmény-sor (a „−0 Ft” sor törött összeadásnak olvasódik), név nélkül **nincs kitalált név**.
⭐ **HÁROM visszarontással** bizonyítja, hogy pirosra tud menni — a doboz hiánya (①), két igazság a
két váltón (⑥), és a doboz nem követi az ütemet (③④⑦). ⛔ Az első öntesztem csak a dobozt vette ki,
amitől a futás a többi szabályt át is ugrotta: **egy önteszt, ami az első szabály után megáll, a
többiről semmit nem mond** — pedig „pirosra ment”, tehát bizalmat gyártott volna.
⚠️ Menet közben a saját mérőeszközöm kétszer hazudott: a szám-felismerőm a „7 492 Ft”-ból 492-t
olvasott (valós ár-eltérést jelentett volna helyes kódon), a takarás-szondám pedig a görgőn KÍVÜLI,
tehát levágott elemet is „letakartnak” vette.

**Mellék-lelet, javítva.** A görgetés-jelzés eddig a görgő belsejében lebegett; a tétel-dobozzal
megnőtt tartalom mellett 390 px-en **pontosan a Havi/Éves váltóra** ült — arra a vezérlőre, amit ez
a döntés a döntés helyére tett. Most a görgő ALATT, saját sávban áll: az átfedés nem
„valószínűtlen”, hanem geometriailag lehetetlen.

**③b UTÓLAG BEHOZVA (2026-09-15, tulajdonosi utasítás).** A ③ hatálya alá tartoznak a
**modul-választó lépés csomag-kártyái** is: ugyanazon a képernyőn állnak, mint az ütem-váltó.
Mérve a szállított panelen: éves előválasztás mellett a kártyák „9 500 Ft/hó”-t írtak, miközben az
összegző két blokkal lejjebb „95 000 Ft / év”-et — **tízszeres eltérés egy pillantásnyira**, és a
vevő aznap 71 250 Ft-ot fizetett. ⛔ A kártya ára ráadásul **build-időben** dőlt el, tehát a
közvetlenül alatta álló váltó sosem mozdította. Javítva: `presetTotal()` a választott ütemben, az
`updateSummary()` egyetlen újraszámolásából; egy soron EGY egység. A legerősebb állítás az őrben:
**az aktív kártya száma AZONOS az összegző áthúzott listaárával** — ugyanaz a képernyő, ugyanaz az
alap, nem mondhatnak mást. (A régi hiba szó szerint visszarontva PIROS.) Az átjáró és a bukás-lap terve (A/B) a
tulajnál van, ebben a körben nem épült.

**Visszafordíthatóság:** 🔄 felület- és mérőeszköz-szintű, adatmigráció nincs.
**Élesítés:** NINCS (§0.3 — külön, kimondott engedély kell).
