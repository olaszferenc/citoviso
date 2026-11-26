## ADR-0495 — A minőségi kolléga szabályfelfedező, nem darabonkénti kapu: a tulaj lapját a gépi render-kapu táplálja

- **Dátum:** 2026-11-26 (este)
- **Státusz:** elfogadva (tulaj: „Ok” a javaslatra; a koordináló session `cit96bd8170`)
- **Felülírja részben:** a 2026-11-25-i döntést (minőségi kolléga passza minden levél előtt — `mockQaReview.ts` fejléce); ADR-0492 ③ „Mock: hány ment át a minőségi kollégán” → a gépi kapun átment
- **Érinti:** `src/outreach/mockQaReview.ts`, `src/console/approvalQueue.ts`, `src/outreach/autoDispatch.ts`, `src/outreach/secondPlan.ts`, `src/outreach/sendBatch.ts`, `src/generator/mockRefresh.ts`, `src/mms/messenger.ts`, `src/console/leadStock.ts`, `src/countryLaunchStages.ts`, `scripts/qa-review.mts`, `scripts/gate-blind-sample.mts` (új), `scripts/qa-review-check.mts`

### Mi
1. **A jóváhagyó lap (`/jovahagyas`) és a kiküldő a GÉPI render-kapu (v13, nem nyugtázható, szabályváltásnál magától újraítél) passzát és a tulaj „Mehet”-jét kéri mindkét tervre.** A minőségi kolléga `pass`-a sehol nem feltétel.
2. **A kolléga `fail`-je az adott mock-fájlra továbbra is tart** (látott hiba nem megy ki); újrarender után a fájl-időbélyeg szerint elavul, és a gépi kapu ítél újra.
3. **A kolléga mintát néz, nem sort** (`qa-review.mts sample`), és hiba-FAJTÁT rögzít (`note`, nem blokkol; `findings` összesít). Ugyanaz a fajta két mockon = megáll, és a koordinátornak szabály-jelöltet ad, nem buktat 80-at egyenként.
4. **Hibából szabály, egy körben, vakon mérve:** a szabály a render-kapuba vagy a generátorba megy, csomagban; igazolás `scripts/gate-blind-sample.mts` (látatlan, kevert minta, seed-del ismételhető, jó/rossz arány hibakóddal).
5. A kapura váró sor jegyzete új szöveget kap (`QA_WAIT_NOTE`: „gépi kapura vár…”); a régi 1 800+ éles sor jegyzetét (`QA_WAIT_NOTE_LEGACY`) minden illesztés ismeri (`CHAIN_WAIT_NOTES`).

### Miért
Mérve 2026-11-26 (éles): 4 kolléga, 148 ítélet, ~85 % bukás; a bukások zöme két-három azonos generátor-hiba volt, egyenként elbuktatva; minden generátor-javítás (5 élesítés) elavulttá tette az összes várakozó mockot ÉS az összes passzt (fájlhoz kötött), így a kollégák ugyanazt nézték újra; a tulaj lapjára 2 lead jutott. Ugyanaz a brief friss javítás utáni anyagon 93 %, két ismert generátor-hibás anyagon 12 % passzt adott — a számot a generátor állapota mozgatta, nem a kolléga mércéje. A kolléga értéke a gépi kapu által nem látott hibák FELFEDEZÉSE volt (portál-reklámkép a levélképen, toldalékos szótörés, portál-matrica, konyha a szobakártyán, címsor-ismétlés), ami egy-egy mock megnézéséből kiderül.

### Visszafordíthatóság
🔄 — egy kapcsolás: a `planChainPassed` és a lap szűrője visszakapja a `qa.state === "pass"` feltételt, a kiküldő claimje a `MOCK_QA_PASSED_SQL`-t.

### Elvetett
- Kolléga-passz megtartása laza mércével (19:10-es „csak a törött bukik”): a kapacitás (óránként ~12 lead négy kollégával, két tervvel) és a futószalag-hatás marad; a mérce brief-szöveg, nem mérhető.
- Kolléga teljes kivezetése: a szabályfelfedező érték elveszne.
