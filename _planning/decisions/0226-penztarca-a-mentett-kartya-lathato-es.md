## ADR-0226 — Pénztárca: a mentett kártya látható és cserélhető (külön fül, 3DS-úton)

**Dátum:** 2026-09-24 · **Státusz:** elfogadva (tulaj: „B külön pénztárca") · **Kontraktus:**
`assets/design-refs/console/wallet/README.md` · **Előzmény:** ADR-0080 ④/⑤ (token-terhelés),
ADR-0088 ⑨ (a megbízás látható és visszavonható), ADR-0113 ① (upsell a tárolt kártyáról).

### Probléma
A megbízás (recurrence_token) 2026-09-22 óta élesben terhel, de a tulaj **nem látta, melyik
kártyáját** terheljük, és **nem tudta lecserélni**: csak visszavonni tudta, új kártyát pedig
kizárólag egy megújítási linken vagy elakadt terhelés után adhatott. A modul-vásárlás mindig a
tárolt kártyát terhelte; ha a vevő új kártyával fizetett volna, az **nem** lett volna a mentett
(`service.ts wantsToken` csak initial/renewal). A kártyáról semmit nem tároltunk, amit meg
lehetne mutatni.

### Döntés
1. **Külön „Pénztárca" fül** a tenant-adminban (Dokumentumok és Fiók között), `admin.wallet`
   súgó-horgonnyal. Mutatja a kártya **maszkját** (márka, utolsó 4, lejárat, mentés ideje), az
   állapot-pillt (bekapcsolva / lejár / nincs kártya / a terhelés nem sikerült), a következő
   terhelést (**az összeg a SubscriptionAdminData szabályából**, második számítás nincs), az
   ezen a kártyán történt terheléseket és a korábbi kártyákat.
2. **A maszk az átjáróból jön** — Barion `GetPaymentState` → `FundingInformation.BankCard`
   (`MaskedPan` = dokumentáltan az utolsó 4 számjegy, `BankCardType`, `ValidThruYear/Month`).
   Tárolás: `subscription.card_*` (0076). A teljes PAN soha nem jár nálunk; a kód a kapott
   értéket is az utolsó 4-re vágja. Egy 0076 előtti token maszk nélkül él: a lap kimondja, hogy a
   részletek a következő terheléskor jelennek meg (a MIT-terhelés webhookja visszatölti).
3. **Kártya cseréje/megadása = EGY út, a 3DS-en át.** Új order kind `card_update`: a pay-link
   `InitiateRecurrence`-szel és **`PaymentType: Reservation`**-nel indul, 100 Ft-ot zárol; a
   webhook a „Reserved" állapotnál `FinishReservation(0)`-t hív (dokumentált: teljes
   visszatérítés, a fizetés Succeeded), majd a Succeeded állapotból tárolja a tokent + maszkot.
   Számla nem készül (pénz nem mozdult). A régi kártya a `saved_card_history`-ba kerül
   (`replaced`), visszavonásnál (`revoked`). Az átjáró, amely nem tud zárolást feloldani
   (`finishReservation` hiányzik), **nem kap** kártyacsere-gombot, és a route is elutasít.
   ⚠️ **Sandbox-bizonyíték kell élesítés előtt:** a Barion-doksi nem mondja ki, hogy a
   Reservation-indítású token „successful state"-ben marad a 0-s zárás után (nem is tiltja).
   A mock-átjáró végigviszi; a Barion-sandbox próbája a következő lépés (§ Nyitott).
4. **Modul-vásárlás kártyaválasztó** a Modulok fül terv-sávjában (ha van megbízás és fizetendő):
   „A mentett kártyámmal — Visa ····4242" (MIT, mint eddig) vagy „Másik kártyával" → a pay-link
   tokent kér (`requestPayment(order, {newCard:true})`), és a fizető kártya lesz a megbízás.
   A TÉNY, hogy a fizetés tokent kért, a **payment soron** él (`initiates_recurrence`, 0076),
   a webhook innen olvassa — nem az order kind-ból.
5. **Egy szabály, egy hely (⑨):** az Előfizetés kártya megbízás-blokkja a Pénztárcára
   linkel; a „kikapcsolva" ág régi mondata („csak a következő fizetési linken") a valós utódra
   frissült („Kártya megadása" a Pénztárcában vagy a következő link). A visszavonó ablak 4.
   pontja ugyanígy.

### Elvetett
- **A változat** (blokk az Előfizetés kártyában) — a tulaj a külön fület választotta.
- **Kártyaszám-mező** — a kártyaséma a tárolt hitelesítőt vevő-indított, 3DS-kihívott
  művelethez köti; egy mező hazugság lenne.
- **Immediate 10–100 Ft-os valódi terhelés** a cseréhez — dokumentált, de valódi pénz + számla +
  visszatérítés-ügyintézés egy „ingyenes" műveletért.

### Őr
`scripts/wallet-check.mts` — render (állapotok, nincs 5+ jegyű szám a kártya-képen, gomb csak
képes átjárónál), terv-sáv választó, Barion-maszk-kivonás (MaskedPan → utolsó 4), DB-út
(token+maszk+előzmény csere és visszavonás, idempotens újrajátszás), mock zárolás-feloldás.

### Nyitott
- Barion-sandbox próba: Reservation + InitiateRecurrence → FinishReservation(0) → a token
  MIT-terhelésre használható-e (`OriginalPaymentWasntSuccessful` a bukás jele). Amíg ez nem
  fut le, élesre nem megy.
- Lejáró kártya e-mail (a lap jelzi; levél még nincs).
