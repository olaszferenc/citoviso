# 2026-11-13 — Hamis „regisztrátor-fiók hiányos” riasztás (Websupport HTTP 500)

**Brief:** `~/rc-briefs/domain-20261113-130456.md` (a tulaj képernyőképe: „ez mi? mi történt?”), munkafa `cit54b4bd82`.

## Mi történt
- Éles stall-watch 2026-11-13 12:00:46 UTC: egyetlen `GET /v1/user/3213041/domainProfile` → Websupport HTTP 500 „Unexpected error”.
- A `readiness()` minden olvasási hibát problémának vett → „a regisztrátor-fiókunk NEM tud domaint regisztrálni” levél + SMS, adminos teendővel.
- Utómérés (dev + éles): 200, profil #2851827, személyi igazolvány kitöltve, kredit 2020 Ft, ÁSZF rendben. Élesen 3 saját domain, mind `live`; senki nem akadt el.

## Javítás (tulaj „igen”)
- `src/domains/registrar/registrar.ts`: `RegistrarUnreachableError`, `RegistrarReadiness.unreachable?`.
- `src/domains/registrar/websupport.ts`: `#request` 5xx / hálózati hiba / 5xx nem-JSON → `RegistrarUnreachableError` (az üzenet szövege változatlan); `#readGet` a készenlét két GET-jét 2 s + 5 s várakozással újrapróbálja; `unreachable: true`, ha minden probléma ilyen.
- `src/console/stallWatch.ts`: új `registrar-down` fajta — a kiesés csak `REGISTRAR_DOWN_MINUTES` (45) folyamatos fennállás után riaszt, saját tárggyal („… nem válaszol”), naponta egyszer; a sorozat kezdete `house_alert_once` `registrar-down:streak`, jó vagy mért-hiányos válasz törli. A mért hiány (azonosító, kredit, ÁSZF) változatlanul azonnal riaszt.
- `scripts/stall-alert-check.mts` ②c' blokk.

## Ellenőrzés
- `tsc` zöld; `stall-alert-check`, `domain-registry-check`, `domain-provision-check`, `domain-autorenew-check`, `domain-renewal-check` zöld.
- Élő, csak olvasó készenlét a valódi fiókon: `ok: true`.

## Nyitott
- Élesítés a tulaj külön „mehet”-jére.
- A kredit (2020 Ft) még egy .hu vételt fed (1990 Ft) — feltöltés a tulajé.
