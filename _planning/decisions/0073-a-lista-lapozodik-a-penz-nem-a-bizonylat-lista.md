## ADR-0073 — A lista lapozódik, a PÉNZ nem: a bizonylat-lista lapozása + a C terv és az ADR-0064 ütközésének feloldása

**Dátum:** 2026-08-26 · **Státusz:** elfogadva (tulajdonosi döntés) · **Kapcsolódó:**
ADR-0064 (konzol-UX-mérce, oszlop-szűrős kereső), ADR-0066 (terv-jóváhagyási kapu + az
„Utólagos lelet", ami ezt az ütközést felszínre hozta).

### Probléma

Két, egymásra épülő kérdés zárult le.

**① A jóváhagyott „C" terv három ponton ütközött az ADR-0064-gyel** (irány-ikon, szűrés
mechanikája, dátum-szűrő) — az ADR-0066 „Utólagos lelet" szakasza írta le, de nem döntötte el.

**② A lapozás bevezetése egy némán hibás pénzügyi számot termelt volna.** A bizonylat-lista
`LIMIT` nélkül futott. A kézenfekvő javítás — `LIMIT/OFFSET` a lekérdezésre — a KPI-sávot, a
korosítást, a végösszegeket és a fizetési szokást is az OLDALRA szűkítette volna, hiszen mind
ugyanabból a beolvasott sorhalmazból számolt. A címsor így „az 1. oldal egyenlegét" mutatta
volna „a cég kintlévősége" felirattal: a felület ép, a szám hibás, és semmi nem látszik rajta.

### Döntés

1. **A három ütközésben az ADR-0064 nyer** (korábbi tulajdonosi rendelet):
   - **Irány-ikon nincs.** A bizonylatnak típusa van, iránya nincs a felületen — a „vevői
     számla" / „szállítói számla" (= bevétel/költség) úgyis megmondja.
   - **Szerver-oldali GET-form szűrő**, nem kliens-oldali JS. A kliens-szűrő csak a betöltött
     sorokat szűrné, tehát lapozással együtt egyenesen hazudna. A JS csak progresszív
     ráépítés (gépelés utáni auto-submit).
   - **Dátum tól-ig mezőpár** (Kelte ÉS Fiz. határidő), nem szöveg-tartalmaz.
2. **Lapozás: 50 sor/oldal, klasszikus lapozó** (tartomány + oldalszámok + Előző/Következő),
   sima linkekből — a GET-form szűrőkkel együtt JS nélkül is működik.
3. **⛔ A lapozás CSAK a sorokat vágja.** A KPI-sáv, a korosítás, a végösszegek és a fizetési
   szokás KÜLÖN AGGREGÁLÓ lekérdezésből jönnek, a teljes szűrt halmazra. **EGY szűrő-definíció**
   táplálja mindhárom lekérdezést (sorok / aggregátum / szokás), így egy szűrő nem tud
   elcsúszni a sorok és az őket leíró pénz között. A vödrözés a guard-tesztelt
   `agingBucketFor` / `settleOffsetDays` tiszta függvényekben marad — az SQL nem másolja le.
4. **Aki a sorokból SZÁMOL, teljes listát kér** (`{ all: true }`), tételesen: mindkét
   CSV-export és a partner Áttekintés-fül (KPI-csík + havi diagram). A szűrő-formok nem
   visznek `page`-et → szűréskor vissza az 1. oldalra; a lapozó-linkek viszont viszik az
   aktív szűrőt. Rendezés tie-break az `id`-re, különben azonos kelte mellett egy sor két
   oldalon is megjelenhet, egy másik pedig sosem.

### Meta-tanulság — a kapu triviálisan zöld lehet

A lapozás-őr (`scripts/documents-paging-check.mts`) a kimutatást a naiv, mindent-beolvasó
újraszámolással veti össze. **A dev DB 14 bizonylatot tartalmaz = egy oldal, tehát a kapu
átment volna anélkül, hogy egyetlen oldalhatárt átlépett volna** — zöld pipa, nulla mérés.
Ezért az őr kis lapmérettel dolgozik, így valódi többoldalas tilinget mér (hézag- és
átfedésmentesség, utolsó oldal maradéka, KPI-azonosság az utolsó oldalon). Szabotázsra
(aggregátum az oldalra szűkítve) 64 hibával pirosra megy — mérve, nem feltételezve.
**Általánosan: ha az őr a fejlesztői adathalmazon nem lépi át azt a határt, amit véd, akkor
nem őr, hanem dísz** — a mérési feltételt (itt: lapméret) kell a kapuhoz igazítani.

### Visszafordíthatóság

🔄 A lapméret és a lapozó formája szabadon hangolható. ⛔ Ami NEM alkudható: a pénzt leíró
mutató sosem az oldalra vonatkozik.
