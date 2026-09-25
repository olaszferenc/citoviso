# 2026-09-25 — Barion „Unsuccessful callback" levelek a javítás UTÁN is: két új ok, fogadó oldali javítás

**Szál:** a tulaj jelezte, hogy a 2026-09-24-i javítás (86974c6e) után is jönnek a Barion Sandbox
„Unsuccessful callback in your shop!" levelek. **Élesítés nem volt feladat.**

## Mérés

A javítás (2026-09-24 06:14 UTC) UTÁNI 5 levél payment-ID-je, `GetPaymentState` + DB + konzol-napló:

| Barion PaymentId | Létrehozva (UTC) | Tétel | Barion-állapot | `payment` sor |
|---|---|---|---|---|
| `25258b13…` | 09-24 08:01 | Citoviso előfizetés (havi), 9 900 Ft | Expired, 0 Ft | nincs |
| `c4675525…` | 09-24 08:01 | ugyanaz | Expired, 0 Ft | nincs |
| `a97c0a68…` | 09-24 08:10 | ugyanaz | Expired, 0 Ft | nincs |
| `12980e6d…` | 09-24 19:16 | kártya-megerősítés (Reservation), 100 Ft | Succeeded | a próba `reap`-je után nincs |
| `d8c6022f…` | 09-24 19:43 | kártya-megerősítés (Reservation), 10 Ft | Succeeded | a próba `reap`-je után nincs |

**A) csoport — régi kódból szivárgó tesztfizetés.** A 10:01–10:10 (helyi idő) közötti hotfix-munka
(`1bb3e4fc`, `263ef8dd`, `e1071ebb`) a `prod/20260922-1501`-re épült ágon futott, amelyben
**még a javítás előtti `market-gate-check` volt** (`git merge-base --is-ancestor 86974c6e 1bb3e4fc` → nem ős).
A pre-commit ott a régi szkriptet futtatta a közös `.env` (`PAYMENT_GATEWAY=barion`) mellett → valódi
sandbox-fizetés → sor törölve → 30 perc múlva lejárt callback → 400 → levél.
⚠️ Az időbeli egyezés erős, de a pontos hívót nem naplózta semmi — ez valószínűsítés, nem bizonyíték.
A tanulság ettől független: **amíg a javítás a KÜLDŐ szkriptben él, a szkript minden régi példánya újra szivárogtat.**

**B) csoport — 429 a Barionon.** A kártya-megerősítő próba (`scripts/barion-sandbox-card-probe.mts`,
Pénztárca-szál) callbackjei MEGÉRKEZTEK, de a konzol-naplóban
(`~/.claude/citoviso-console.log`) mindkettőnél két
`GetPaymentState … HTTP 429 Too Many Requests` áll → `parseWebhook` null → 400. A harmadik kísérlet
már sikerült („terhelési token eltárolva"), a levél az elbukott kísérletekről szólt.
Egy Reservation másodpercen belül 4–5 GetPaymentState-et kelt ugyanarra a fizetésre
(callback, `finishReservation` saját olvasása, újraolvasás, a Barion Succeeded-callbackje, `/pay/done`).

## Javítás (a fogadó oldalon — bármely küldő verziótól függetlenül)

1. `src/payment/service.ts` `handleWebhook`: **ismeretlen fizetés + pénzmozgás nélkül zárult állapot**
   (Expired / Canceled / Failed / Rejected) → 200 + napló-sor, nincs teendő. **Ismeretlen + Succeeded**
   (pénz jött, sor nincs) → marad 400 — ez a valódi riasztás.
   ⚠️ Ez FELÜLÍRJA a 09-24-i őr „ismeretlen, lejárt → 400" állítását: annak nincs pénzügyi tétje, és épp ez a zaj.
2. `src/payment/barion.ts` `fetchWithRateLimitRetry`: a GetPaymentState 429-re legfeljebb 2× újrakérdez
   (800/1600 ms, vagy `Retry-After`, max. 3 s); tartós 429 után a 429 megy tovább → 400 (hangos marad).
   A `parseWebhook` és a `finishReservation` is ezt használja.
3. Őr: `scripts/barion-webhook-ack-check.mts` — új 4. (ismeretlen: a pénz dönt) és 5. (429) szakasz.
   Piros kontroll: a retry kivéve 3 bukás, az orphan-ág kivéve 4 bukás.

## Módosított fájlok

- `src/payment/barion.ts`, `src/payment/service.ts`
- `scripts/barion-webhook-ack-check.mts`
- `_planning/memory/2026-09-25_barion_callback_failed_2.md` (ez)

## Nyitott

- A javítás a lokál konzolon (:4600, a fő fa) akkor él, amikor a land után a fő fa frissül és a
  `citoviso-console` újraindul. Élesen (VPS) csak a következő deploy-jal.
- A mostani 5 levél már lezárt eset, nem jön újra; a 09-24-i reggeli szálban lévők szintén régiek.
- A Reservation-út hívás-sorozata (4–5 GetPaymentState/fizetés) csökkenthető volna (pl. a
  `finishReservation` a már beolvasott állapotot kapja) — most nem nyúltam hozzá, a retry elég.
