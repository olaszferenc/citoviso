## ADR-0228 — A kártyacsere Barion-úton igazolva: 10 Ft-os terhelés, azonnali visszatérítés, igaz mondattal

**Dátum:** 2026-09-24 · **Státusz:** elfogadva (tulaj: „Marad a mód, kisebb összeg”) · **Előzmény:**
ADR-0226 (Pénztárca) „Nyitott” — Barion-sandbox próba · **Kontraktus:**
`assets/design-refs/console/wallet/README.md` ⑤ · **Mérőeszköz:** `scripts/barion-sandbox-card-probe.mts`

### Kérdés (ADR-0226 Nyitott)
Egy `PaymentType: Reservation` + `InitiateRecurrence` + `RecurrenceType: MerchantInitiatedPayment`
indítású fizetés, amelyet `FinishReservation(0)`-val zárunk, Succeeded-be megy-e, és a tokenje
utána használható-e MIT-terhelésre?

### Mérés (Barion SANDBOX, a valódi termék-úton, 2026-09-24)
A fizetés a `createCardUpdateOrder` + `requestPayment` úton indult; a callback a fő fa konzoljára
(:4600) érkezett, és a `handleWebhook` pending-ága hívta a `FinishReservation(0)`-t. Két kör
(100 Ft és 10 Ft), teszt-kártya `4444 8888 8888 5559`:

| lépés | 100 Ft | 10 Ft |
|---|---|---|
| Start (Reservation + InitiateRecurrence + MIT) | Prepared | Prepared |
| fizetés → callback → `FinishReservation(0)` | Succeeded, Total 0 | Succeeded, Total 0 |
| tranzakciók | `CardPayment 100` + `RefundToBankCard 100` | `CardPayment 10` + `RefundToBankCard 10` |
| `FundingInformation.BankCard` | Visa, `5559`, 12/2030 | Visa, `5559`, 12/2030 |
| subscription: token + trace + maszk | eltárolva | eltárolva |
| `/pay/done` | 302 → `?tab=penztarca&card=ok` | 302 → `?tab=penztarca&card=ok` |
| **MIT Start a tokennel** | **Succeeded, RecurrenceResult: Successful** | **Succeeded, RecurrenceResult: Successful** |

**A lánc működik.** Mindkét MIT-callback rendben feldolgozva (a sor `paid`).

### Amit a mérés MEGCÁFOLT: a mondat
A Barion-doksi (Reservation payment, Wayback) és a sandbox egyezően: **bankkártyánál a
Reservation VALÓDI terhelés** (a pénz a kereskedő tárcájában áll zárolva), a
`FinishReservation(0)` pedig **VISSZATÉRÍTÉS a kártyára — „akár 30 nap”**, bankfüggően. A Barion
fizetőlapja ezért „Fizetek: <összeg>”-et ír (a doksi szerint a felület minden fizetés-típusnál
azonos). A csere-ablak eredeti mondata („zárolunk … pénzt nem vonunk le; a bankja a feloldást
néhány napon belül könyveli”) így **hamis** volt — kontraktus ⑤ szerint nem maradhat.

### Döntés
1. **A mód marad** (Reservation + `FinishReservation(0)`): számla nem készül, pénz nálunk nem marad.
2. **Az összeg 10 Ft** (`CARD_VERIFY_AMOUNT_HUF`, eddig 100) — a teljes lánc 10 Ft-tal is végigment.
3. **A mondat igaz:** „A megerősítéshez 10 Ft-ot terhelünk a kártyán, és azonnal vissza is utaljuk —
   a visszatérítés a bankjától függően néhány nap, legfeljebb 30 nap alatt jelenik meg.” A siker-sáv:
   „A megerősítő 10 Ft-ot azonnal visszautaltuk — a bankja néhány napon, legfeljebb 30 napon belül
   jóváírja.” A Barion-leírás és a mock fizetőlap: „azonnal visszautalva”. A súgó (`admin-wallet`)
   ugyanezt mondja, és megnevezi a Barion „Fizetek: 10 Ft” gombját. ⛔ „zárolunk” / „pénzt nem vonunk
   le” tilos — a `wallet-check` a régi ígéret HIÁNYÁT is méri.

### Elvetett
- **Immediate 10 Ft + jóváírás a következő díjból** — a token-lánc működik, a számla-/jóváírás-
  logika indokolatlan többletmunka.
- **100 Ft marad, csak új mondat** — a tulaj a kisebb összeget választotta.

### A sandbox NEM igazolja (élesítés előtt tudni kell)
- **3DS-kihívás:** a doksi szerint teszt-kártyánál 3DS nem fut; a `ChallengePreference:
  ChallengeRequired` viselkedését csak éles kártya mutatja meg.
- **Díj-fedezet:** Reservation-indításhoz a kereskedő Barion-tárcájának fedeznie kell a díjakat
  (a doksi szerint különben a Start elutasít) — éles egyenleg 0-nál a kártyacsere elhasal.
- **Lejárt/letiltott kártya a Finish pillanatában:** a visszatérítés elbukik, a pénz nálunk marad;
  a doksi szerint ilyenkor a kereskedő felel a visszautalásért.
- `finishReservation` a `Transactions[0]`-t zárja; a sandboxban a saját tranzakciónk volt az első
  (mögötte két díj-tranzakció, `POSTransactionId: null`). A sorrendre a doksi nem ad garanciát.
