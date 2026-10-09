## ADR-XXXX — A próba ELŐTT árazott első rendelés a próba alatt nem fizethető; a próba a lead MINDEN tokenjének bevezető ajánlatát zárja

**Dátum:** 2026-10-10 · **Kontextus:** IT A-04 / B2-REGIPAY, A-05, A-02 — az ingyenes próba (ADR-0342 ⑥: a próbát a bevezető kedvezmény HELYETT választja, nem adódik össze) három résen át mégis halmozott.

**Döntés**
1. **Próba előtti rendelés (A-04 / B2):** az az `initial` rendelés, amely a lead próbájának `started_at`-je ELŐTT született, a bevezető / eszkalációs áron van árazva — a próba alatt (aktív vagy lejárt, folytatható próba) **nem fizethető**. A `/pay/go/<payment>` a `/p/<token>/folytatas` oldalra visz (ott a próba-kupon áraz), a `requestPayment` nem ad rá pay-linket. Pénzmozgást nem vonunk vissza és nem találunk ki: a függő fizetés nem törlődik, csak nem adjuk ki újra. Egy a próba indulásakor éppen a pénztárban lévő (≤ 30 perces) fizetés befuthat — ez kézi rendezés marad (a B1-PAR jelzés-útja), nem építünk rá külön logikát.
2. **Több token (A-05):** a próba indulása a lead ÖSSZES prospectjének nyitott `initial` ajánlatát (outreach + eszkaláció) lezárja, nem csak a próbát indító tokenét. Próbázó (bármely állapotú `free_trial` sorral bíró) leadnek döntés-segítő (eszkalációs) ajánlat ezután nem születik — a törlés után sem.
3. **Félbetört indítás (A-02):** a `tenant_id` beírása utáni bukás (élesítés, kupon, belépés) után a következő beküldés FOLYTATJA az indítást (a kész lépéseket kihagyja), és csak a ténylegesen befejezett próbára (élő site + kupon, ha a kupon-beállítás > 0 + belépés) válaszol „már fut”-tal.

**Őr:** `scripts/free-trial-check.mts` ⑪ ⑫ ⑬ (a régi kóddal mind a 8 új állítás piros).
