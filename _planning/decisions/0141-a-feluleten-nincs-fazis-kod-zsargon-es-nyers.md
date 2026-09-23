## ADR-0141 — A felületen nincs fázis-kód, zsargon és nyers adatbázis-érték; a felirat regiszterből jön (2026-09-13)

**Dátum:** 2026-09-13 · **Státusz:** elfogadva · **Kapcsolódó:** ADR-0126 (a fejlesztői
azonosító nem felhasználói szöveg — ez annak a KITERJESZTÉSE), 03-INVARIANTS §J.24 (a súgó a
tényleges felületet írja le), §B.17.

**Kiváltó (Elek FK-004 Z5, tulaj-bejelentés).** A friss szemű olvasó a képernyőkről sorolta:
„**pipeline**: jogszerűségi kapu újra + HTML-levél + „sent" státusz (**H1-bázis**)" · „VAGY
kézi küldés (**A2**)" · „Egy **claim**, egy kapu-sor (… **artifact-verdikt** …)" · „a
**gammu-smsd** áll" · „**Pilot-tölcsér (H1–H5)**" · „**Order-intentek**" · „**scrape**: áll".
Plusz nyers adatbázis-értékek: a piszkozat-lap címében `nincs_honlap` (alsó vonással),
miközben UGYANAZON a lapon a választó már „nincs honlap"-ot mutatott, és a lead-soron az
angol `sent`. **Egyik sincs feloldva sehol** — az „A2", a „H1-bázis" és az „artifact-verdikt"
jelentése a felületről nem deríthető ki.

**Döntés.**

1. **A felirat REGISZTERBŐL jön, nem a nyers mezőből.** `segmentLabel` (ugyanabból a
   `SEGMENTS` listából, amiből a legördülő épül), `prospectStatusLabel`, `sourceLabel`,
   `provFieldLabel`. ⛔ Ismeretlen értéket **nem találgatunk**: olvashatóvá tesszük (alsó
   vonás → szóköz), tehát egy ÚJ enum-érték csúnyán, de IGAZUL jelenik meg — nem tűnik el.
2. **A fázis-kód és a zsargon helyére az kerül, amit JELENT.** „Pilot-tölcsér (H1–H5)" →
   „Megkeresés-tölcsér — hol akadnak el"; „H1 — horog" → „Megfogja-e a levél"; „order-intent"
   → „rendelni kezdett"; „pipeline" → a mondat, ami leírja, mi történik a gomb megnyomásakor;
   „gammu-smsd áll" → „az SMS-küldés szünetel"; „Provenance (A4)" → „Honnan jött az adat".
3. **A súgó követi** (§J.24): a `console-report` és a `console-lead` cikk ugyanezt a nyelvet
   beszéli — különben a KB egy nem létező képernyőt tanítana.

**Az őr KÉT rétege, mert egyik sem elég (ADR-0126 mintája szerint).**

- **Heurisztikus (`internal-ref-check`) — új szabályok:** ① *fázis-kód* — ⚠️ a minta
  SZÁNDÉKOSAN szűk (tartomány `H1–H5`, zárójeles `(A2)`, `-bázis` utótag), mert a puszta „H1"
  **jogos** felirat a SEO-ban; negatív eset őrzi. ② *implementációs zsargon* — és ez a
  szabály csak a `T(lang, …)`-be írt szövegen fut. ⛔ **A szűkítés nem kivétel-lista, hanem a
  szöveg DEFINÍCIÓJA:** a `scrape` szó kód-azonosítóként is él (`ic("scrape")`, `href:
  "/scrape"`), és egy szólista azokra is elsülne — a `T()` argumentuma viszont szerkezetileg
  az, amit EMBER olvas.
- **Strukturális iker (`outreach-row-truth-check`) — nyers enum a KIRENDERELT lapon:** a
  látható szövegben alsó vonásos, csupa kisbetűs token gyakorlatilag csak leakadt
  adatbázis-érték lehet. (A NAGYBETŰS env-nevek — `LEGAL_ENTITY_*` — szándékosan ott vannak
  a feladó-azonosítás dobozában; a szabály nem bántja őket.)

**Amit az őr a bejelentésen FELÜL talált (ez a lényeg):** a fázis-kód-szabály **10 további**
szivárgást fogott (`Provenance (A4)`, `Szegmens-bontás (H4)`, kétszer `(A2)`, és 6 helyen a
KB-ben), a nyers-enum iker pedig **hármat**, amit a lelet nem is sorolt: `google_places`,
`presence_check`, `places_match` — a „Honnan jött az adat" tábla forrás- és mező-oszlopából.
Egy bejelentés a LÁTOTT példányt sorolja; az őr a mintázatot.

**Önteszt.** Az `internal-ref-check` a ténylegesen kiment három szövegre („Pilot-tölcsér
(H1–H5)", „kézi küldés (A2)", „(H1-bázis)") megy pirosra, és NEGATÍVAN is bizonyít: a
SEO-értelmű „H1 címsor" és a „8–20 óra" tartomány NEM fogható meg. A strukturális iker
detektorát a 2026-09-13-án KIMENT markup igazolja (`nincs_honlap`, `google_places`,
`places_match`) — mert azt a szabályt az adat elrontása nem falszifikálja: az a NÉZETRŐL szól.

**Visszafordíthatóság:** 🔄 kód- és szövegszintű.
