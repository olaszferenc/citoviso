# 2026-09-24 — Barion „Unsuccessful callback" levelek: a tesztkapu indított valódi sandbox-fizetést

**Szál:** a tulaj egy Barion Sandbox levelet mutatott („Unsuccessful callback in your shop!",
a szálban 39 levél). **Élesítés nem volt feladat.**

## Mérés (a diagnózis alapja)

- A levélben szereplő két fizetés (`34adafbb…`, `579c627d…`) a Barion `GetPaymentState` szerint
  **Expired**, 0 Ft; 2026-09-23 22:52/23:01 UTC-kor jött létre, 30 perc múlva lejárt.
- A callback-cím (`PUBLIC_BASE_URL` → tailscale funnel → a lokál konzol) ÉL, 0,3 mp-en belül
  válaszol — a hálózat nem volt hibás.
- A DB-ben **nincs `payment` sor** ezekhez → `applyWebhookResult` `ok:false` → **400** →
  a Barion CallbackFailed-nek könyveli és levelet ír.
- Forrás: `scripts/market-gate-check.mts` (pre-commit, a `src/payment/service.ts` /
  `src/console/server.ts` / `migrations/` módosításakor fut). A `.env`-ben
  `PAYMENT_GATEWAY=barion` → a nyitott piac és a megújítás ága **valódi Barion
  sandbox-fizetést** indított, a `finally` pedig törölte a sort. Commitonként ~2 levél.

## Javítás

1. `market-gate-check` → **mock átjáró kötelezően**, fail-closed: az első `requestPayment`
   előtt lemérjük, hogy `getGateway().name === "mock"`; ha nem, `throw` (a `finally` takarít).
   Negatív kontroll: `barion`-ra állítva megáll, fixture-maradék 0.
2. Köztes állapotú callback (Prepared/Started/InProgress/Waiting/Reserved/Authorized) → a
   `parseWebhook` `"pending"`-et ad, a `handleWebhook` **200**-at — de CSAK saját, ismert
   fizetésre. Ismeretlen fizetés, üres Status (Barion Errors), nem-JSON, ismeretlen
   státusz-érték → maradt **400** (a Barion újrapróbál és szól — ez a valódi riasztás).
3. Új őr: `scripts/barion-webhook-ack-check.mts` (stubolt fetch, hálózat nélkül; 16 állítás),
   bekötve a `hooks/pre-commit`-be (`src/payment/`, `src/console/server.ts` változásakor).
   Piros kontroll mindkét irányban: köztes → null visszarontva 6 bukás; ismeretlen-fizetés
   szűrő kivéve 1 bukás.

## Módosított fájlok

- `src/payment/gateway.ts`, `src/payment/barion.ts`, `src/payment/service.ts`
- `scripts/market-gate-check.mts`, `scripts/barion-webhook-ack-check.mts` (új)
- `hooks/pre-commit`

## Nyitott

- A többi, `requestPayment`-et hívó őr átnézve (`prospect-owned-check`: megtagadást vár, nem
  indít fizetést; `recurring-mandate-check`: szándékosan valódi Barion, kézi) — más nem indít
  némán valódi sandbox-fizetést. Ha mégis jönne új CallbackFailed levél: a `payment` táblában
  keresd a gateway_ref-et — hiányzó sor = tesztszivárgás vagy valódi baj.
