## ADR-0104 — Középre rendezett fejléc alatt a TARTALOM is középen (a modul-blokk igazodik a sablonhoz) (2026-09-07)

**Kontextus.** A tulaj a saját, ~1900px-es ablakában nézte végig a fullbleed mockot
(`/configure/ff227bb6…`), és így fogalmazott: *„ennél a típusnál nincs sok helyen középre
rendezve, kesze kusza a cucc"*. A mérés (16 sablon, `--cit-modsec-head-align` szerint bontva,
Playwrighttal, 1900/1280/390px) pontosan három sablonnál — **fullbleed, horizontal, artdeco** —
talált eltolódást, és mindháromnál UGYANAZT az öt hibát:

| blokk | mit mértünk 1900px-en |
|---|---|
| „A környéken" (poi) | 3 kártya 4 sávos rácsban → **284px fantom-oszlop** jobbra |
| „Szobák" (rooms) | ugyanaz, 284px |
| „Amit kínálunk" (amenities) | a 2 elemű utolsó sor → **568px** üres jobbra |
| „Árak" fül-sor | balra pakolva → **849px** üres |
| ár-táblázat | teljes szélesség középre rendezett cím alatt |

**Gyökér-ok.** Az ADR-0057 sablon-kontraktus `--cit-modsec-head-align:center` tokenje CSAK a
`h2`-t húzta középre; alatta a közös modul-blokk `repeat(auto-fill,minmax(220px,1fr))` rácsa
balról pakolt. A 13 balra zárt fejlécű sablonnál ez helyes — a hiba a fejléc és a tartalom
KÖZÖTTI ellentmondás, nem maga a balra pakolás. Ezt sem típus, sem meglévő őr nem láthatta:
**layout-tény, ami csak valódi böngészőben, valódi szélességen létezik.**

**Döntés (tulaj, §2b kapun át — három működő változat közül a „C"):**
1. **Tartalmi kártya (szobák, környék) KITÖLTI a sort** — fotót és szöveget hordoz, keskenyen
   éhesnek látszik.
2. **Kis ikonos csempe (felszereltség, USP) egyforma széles marad**, és a féloldalas utolsó sor
   **középre húz**. 620px alatt minden csempe teljes szélességű (fix szélesség telefonon
   mindkét oldalon halott margót hagyna — mérve).
3. Az ár-fülek, az ár-táblázat, a hírlevél-űrlap (`justify-content` is: telefonon a gomb a mező
   alá csúszik) és a vélemény-űrlap a középre rendezett ritmust követi.

**Megvalósítás.** `templateKit.centredModsecCss(tpl)` — EGY forrás, a három sablon hívja
(a korábban ott duplikált note/badge-szabályokat is ez váltja ki). A többi 13 sablon kimenete
**bájtazonos** maradt (mérve, 16/16 render diffelve).

**Őr.** `scripts/modsec-align-check.mts` (pre-commit, `src/engine/` változásra): minden középre
rendezett fejlécű sablonnál megméri, hogy a tartalom a tartalom-dobozban középen van-e — 3
szélességen, DB és hálózat nélkül. Az inline természetű blokkot (értékelés-jelvény) és a magát
elrendező táblázatot **elemként** méri, nem a gyerekein át (a `tbody` mérése értelmetlen számot
ad). RED-kontroll: `--red` kiveszi a vizsgált szabályokat, és elvárja a bukást (26 találat).

**Amit NEM változtattunk.** A telefonszám megjelenítése: a tulaj a saját számát látta a mockon,
és felmerült, hogy tiltsuk ki. A mérés kiderítette, hogy ez **teszt-adat** — a 2026-09-05-i
Elek-kör seed-semlegesítése írta a 8 teszt-lead `raw.phone/email` mezőjébe a tulaj elérhetőségét
(hogy teszt-küldés ne juthasson idegenhez), és az MMS/SMS öntesztek is ebből dolgoznak. Éles
körben a lead saját nyilvános száma, tenant-oldalon a tulaj által megadott szám jelenik meg.
**Tulaj-döntés: nem kell szabály, a megjelenítés helyes.** (Tanulság: mielőtt szabályt írunk a
kimenetre, nézzük meg, mit ETETTÜNK bele.)
