## ADR-0234 — Levélben csak tartós fizetési link megy (`/pay/go/<fizetés-id>`)

**Státusz:** ELFOGADVA (2026-09-26, a tulaj hibabejelentése alapján) — lokálban él, élesre nem ment ki.

**Kontextus.** A „Fizetési link a honlap-rendeléséhez” levél a nyers Barion Pay URL-t vitte. A
tulaj a levélből megnyitva „Lejárt fizetési tranzakció”-t kapott: egy Barion-fizetés a
PaymentWindow-ig él (alapból 30 perc, a kód nem állítja), a levél napokig. Ugyanez volt a
megújítási/felszólító levelekben (`billing.ts`) és a domain-lezárás levelében. Súlyosbította a
`requestPayment()` pending-újrahasznosítása: a lejáratról csak callback szól, ami a dev gépre nem
ér el, így minden újrakérés UGYANAZT a halott linket adta vissza.

**Döntés.** Vevőnek küldött levélbe (és SMS-be) fizetési link CSAK `payEntryUrl(paymentId)` →
`/pay/go/<fizetés-id>` alakban kerülhet. A kattintás pillanatában dönt (`src/payment/payEntry.ts`):
1. a rendelés MINDEN függő fizetését frissíti az átjárónál (ugyanaz az idempotens út, mint a `/pay/done`);
2. ha a rendelés már ki van fizetve → az eredmény-lap, soha nem második terhelés;
3. ha a kattintott fizetés még él → tovább rá;
4. ha halott → `requestPayment()` ugyanarra a rendelésre (minden kapuja újra fut) → tovább rá;
5. ha fizetés nem indítható → őszinte lap („nem indítottunk fizetést, nem terheltünk”) + operátor-riasztás.

Az azonosító a payment-sor véletlen UUID-ja — ugyanaz a képesség, ami a nyers átjáró-link is volt.
A felületen (fizetés-gomb, átirányítás) továbbra is a közvetlen átjáró-link megy, mert azt azonnal használják.

**Őr:** `scripts/pay-entry-check.mts` (mock átjáró, eldobható rendelés: élő / lejárt / újrakattintás /
kifizetett / ismeretlen + a négy levelező út huzalozása; önteszt pirosra megy).
