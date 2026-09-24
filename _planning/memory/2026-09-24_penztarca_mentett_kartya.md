# 2026-09-24 — Pénztárca: a mentett kártya látható és cserélhető (ADR-XXXX)

**Tulaj kérése:** „ha a tenant vásárol bármit, az adminba tudjon változtatni a bankkártyán,
sőt kell egy pénztárca rész, ahol tud változtatni a mentett kártyán." Terv A/B → **B, külön fül**
(tulaj: „B külön pénztárca"). Kontraktus: `assets/design-refs/console/wallet/README.md`.

## Amit megmértem indulásnál
- A megbízás (recurrence_token) terhelt, de a tulaj nem látta, MELYIK kártya, és nem tudta
  cserélni; a kártyáról SEMMI kijelezhetőt nem tároltunk (se utolsó 4, se lejárat).
- Az upsell fizetés nem mentett kártyát (`wantsToken` csak initial/renewal) — a mock „másik
  kártya = az lesz a mentett" mondata ezért implementáció nélkül hazugság lett volna.
- Barion-doksi (Wayback + PHP SDK, a docs.barion.com Turnstile mögött): a maszk a
  `GetPaymentState → FundingInformation.BankCard.{MaskedPan (= utolsó 4), BankCardType,
  ValidThruYear, ValidThruMonth}`. Kártyacsere vásárlás nélkül: dokumentált út = valódi
  Immediate fizetés (min. 10 Ft); a Reservation + `FinishReservation(0)` dokumentáltan teljes
  visszatérítés + Succeeded, de a TOKEN-tárolást Reservation-indításnál a doksi nem mondja ki
  (nem is tiltja). **Ezt sandboxban igazolni kell élesítés előtt.**

## Amit építettem
- **0076 migráció:** `subscription.card_{brand,last4,exp_month,exp_year,saved_at}`,
  `saved_card_history` (replaced/revoked), `payment.initiates_recurrence` (backfill: régi
  initial/renewal pay-linkek), új order kind `card_update`.
- **Átjáró:** `WebhookResult.card` (CardInfo); Barion parseWebhook kivonja a maszkot (a kapott
  értéket is 4-re vágja); `PaymentRequest.verification` → `PaymentType: Reservation` (1 óra);
  `finishReservation(ref, 0)`; mock: két próbakártya (Visa 4242 / MC 8810), a mock fizetőlap
  választója token-kérő fizetésnél.
- **Szolgáltatás:** `requestPayment(order, {newCard})`; `wantsToken` = initial | renewal |
  card_update | upsell+newCard, a tény a payment soron; `handleWebhook` „pending" ágán a
  card_update zárolását feloldja, majd újraolvas; `storeRecurrenceTokenIfInitiated` a payment
  sorból dönt, maszkot ír, a régi kártyát előzménybe teszi, újrajátszásra idempotens;
  `backfillCardMaskIfMissing` a 0076 előtti tokenek maszkját a következő MIT-webhookból;
  `revokeAutoCharge` előzményt ír, maszkot nulláz. card_update: számla NEM készül.
- **Felület:** új `penztarca` fül (`walletSection`), kártya-kép, 4 állapot-pill, csere-ablak
  (ár kimondva), kétlépéses visszavonás, „Korábbi kártyák", terhelés-lista; a Modulok terv-sáv
  kártyaválasztója (⑧); az Előfizetés kártya megbízás-blokkja a Pénztárcára linkel (⑨).
  Route-ok: `POST /admin/wallet/change-card`, `auto-charge-off` `back=penztarca`,
  `POST /admin/modules` `card=new`; konzol `/pay/done` card_update → `penztarca&card=ok|fail`.
- **KB:** `admin-wallet` (kép kb-shot fixtúrából), `admin-subscription` visszakapcsolás-mondata
  frissítve; a nav változása miatt minden admin-kép újragenerálva (a console-* képek
  visszaállítva — azok eltérése nem ehhez a szálhoz tartozik).
- **Őr:** `scripts/wallet-check.mts` (render · terv-sáv Playwrighttal · Barion-maszk álcázott
  fetch-csel · DB-út eldobható fixtúrán; piros önteszt) + pre-commit bekötés.
  Az őr ÉLESBEN talált hibát: `payment.id = recurrence_token` uuid≠text összevetés → `::text`.

## Tanulság
- A JS-szelektor-sztring (`[data-wal-change]`) átmegy egy „nincs gomb" grep-en: a jelenlét-
  állítást a MARKUPRA (`data-wal-change>`, `<input type="radio" name="card"`) kell kötni, nem
  az attribútum nevére — háromszor buktam rajta az őrben, mielőtt a fixtúra elárulta.

## Nyitott / következő
1. **Barion-sandbox próba** (élesítés előfeltétele): Kártya cseréje → Reservation +
   InitiateRecurrence → `FinishReservation(0)` → MIT terhelés a tokennel (bukás jele:
   `OriginalPaymentWasntSuccessful`). Ha nem megy: Immediate 10 Ft + jóváírás a következő díjból
   — és a csere-ablak mondata ezzel együtt változik (kontraktus ⑤).
2. Fő fán (:4800) mock-kör: Pénztárca → Kártya cseréje → mock-lap „Megerősítem" MC ····8810 →
   vissza `card=ok`; Modulok → fizetős modul → „Másik kártyával" → mock-lap → Pénztárca mutatja.
3. Lejáró kártya e-mail (a lap jelzi, levél nincs).
