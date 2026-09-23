## ADR-0183 — Egy súgó-kép ne tudjon NÉMÁN kiürülni (2026-09-15)

**Dátum:** 2026-09-15 · **Státusz:** ELFOGADVA (független tudásbázis-őr FLAG-verdiktje az
ADR-0182 körére) · **Kapcsolódó:** ADR-0045/§J.26 (reprodukálható screenshot), ADR-0152
(a bekötést kapu kényszeríti) · **Őr:** `scripts/kb-shot.mts --self-test`.

**Probléma.** Az ADR-0182 körében lefuttatott `kb-shot` egy súgó-képet **kiürített**:
`kb/entries/console-leads/assets/hu/legend.png` **640×2020 / 305 kB → 640×126 / 12 kB**. A kép
ezután a **csukott** `details` fejléc-sávját mutatta („Mit jelentenek az oszlopok és a
jelölések?"), miközben a képaláírás azt írja, hogy „a jelmagyarázat **kinyitva**", a bekezdés
pedig azt ígéri, hogy számítógépen nyitva fogad. **A teljes oszlop-magyarázat kiesett a
súgóból**, és minden kapu zöld maradt.

**⛔ Az ok KÉT RÉTEGŰ volt, és külön-külön ártalmatlannak látszott.**
① A felvétel a SZERVER HTML-jében cserélt sztringet
(`<details class="con-legend">` → `… open`), a nézet viszont ma
`<details class="con-legend" id="leadLegend" open>`-t ad — a csere **NO-OP** lett, némán.
② És ha illeszkedett volna, akkor sem ér semmit: a lap `syncOpen()`-je **700 px alatt leszedi**
az `open`-t, a felvétel pedig **390 px**-en készül. Vagyis a szerver-oldali HTML-babrálás
elvileg sem tudta megoldani — a nyitást a **DOM-on, a lap-szkript lefutása UTÁN** kell
kikényszeríteni. Ez most így történik, és ha a szelektor nem talál, a szkript **hangosan dob**
(a néma kihagyás volt maga a hiba).

**A DÖNTÉS: a generátor mérje meg, amit előállított.** Minden felvétel után összevetjük a kép
magasságát az ELŐZŐ változatéval, és a **nagyságrendi esés PIROS** (küszöb: az új magasság a régi
harmada alatt, és a régi kép legalább 300 px — egy jogos rövidülés, amikor egy sor kikerül a
felületről, nem riaszt). ⛔ Azért a generátorban és nem a `kb-check`-ben: **sem a `kb-check`, sem
a `kb-freshness` nem nézi, VAN-E TARTALOM a képen** — az egyik a szerkezetet és a feliratokat
méri, a másik a dátumokat. A kép tartalmáról ma csak az tud nyilatkozni, aki elkészítette.

**A mérleg a futás VÉGÉN áll,** nem felvételenként: a `kb-shot` egyben mindent újragenerál, egy
közbeni `throw` a képek felét frissen, felét régiben hagyná. Amit kihagyunk (új kép, nincs
mihez mérni), azt **hangosan** mondjuk ki.

**A megkerülhetetlenség SZERKEZETI.** Minden felvétel EGYETLEN úton megy ki (`snap()`), és az
önteszt a szkript **saját forrását** méri: pontosan egy `screenshot({ path: … })` hívóhely
létezhet, és annak a `snap()`-en belül kell lennie. Enélkül egy új felvételi út némán
megkerülné az ép-őrt, és a záró „egyetlen kép sem omlott be" sor hazudna
(`feedback_narrow_recognizer_is_a_false_green`).

**Önteszt (`--self-test`, böngésző és fényképezés NÉLKÜL):** 7 eset, ebből **2 pirosra megy** —
köztük a VALÓDI hiba (2020 → 126). Pozitív kontroll is van: a jogos rövidülés (2020 → 1800), a
határeset (pont a harmada) és az eleve apró csík zsugorodása **átmegy**, különben egy mindig-igaz
predikátum is zöldnek látszana. A szerkezeti próbát élesben is pirosra vittem egy szándékosan
beszúrt megkerülő felvételi úttal. Bekötve a `hooks/pre-commit`-be.

**Visszafordíthatóság:** 🔄 egy generátor-szkript és egy küszöb-konstans; nulla séma, nulla adat.
**Élesítés:** NINCS (§0.3).
