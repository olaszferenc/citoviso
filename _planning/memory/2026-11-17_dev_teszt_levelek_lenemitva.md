# 2026-11-17 — Dev teszt-levelek lenémítva; élesben 8 előtt nincs küldés

**Brief:** `~/rc-briefs/teszt-20261117-070207.md` (tulaj: „A dev előfizetéses teszt emailek állítsd le… Miért mennek reggel 8 előtt élesben megkeresések?”, képernyőkép a 7:00-s Gmail-értesítésről).

## Elvégzett munka
- A 7:00-s „Előfizetése hamarosan megújul — Rozé Fogadó” levél forrása: a DEV gép `citoviso-billing.timer`-e (07:00), a teszt-tenantok a tulaj Gmail-aliasait viselik, a dev `.env` `EMAIL_PROVIDER=smtp`.
- Ugyanilyen automatikus teszt-levél: a dev `citoviso-booking-maintenance` (óránként, „Még N dolog hiányzik…”).
- Javítás (repón kívül): systemd drop-in mindkét unitra → `EMAIL_PROVIDER=mock`, `SMS_PROVIDER=mock`, `MMS_PROVIDER=mock`. A `process.loadEnvFile` a meglévő env-et nem írja felül, tehát a `.env` smtp-je nem győz; ellenőrizve (`config.emailProvider` = mock).
- Éles mérés: `outreach_dispatch` 11-07…11-17 között 0 sor 8:00 előtt / 17:00 után / hétvégén; napi első küldés ≥ 08:01. Az éles dispatch, a dev MMS-relay és az éles utókövetők ma 8 előtt nem küldtek.

## Módosított fájlok
- `/etc/systemd/system/citoviso-billing.service.d/dev-no-real-send.conf` (új)
- `/etc/systemd/system/citoviso-booking-maintenance.service.d/dev-no-real-send.conf` (új)
- `MEMORY.md` („Tények és döntések”)

## Nyitott
- Szándékosan érintetlen: dev konzol/public kézi teszt-küldései, Google-költségriport, gate-hourly riasztás (valódi SMTP). Ha ezeket is némítani kell → tulaj szól.
- 11-18 7:00: nem jöhet dev megújulási levél.
