# A ház riasztást kap, ha időzítő, foglalási levél vagy fizetési webhook elhasal (2026-09-29)

SUB-szál (koordinátor: „Deploy-készenlét felderítés”, `cit92d2a67e`) · brief: `~/rc-briefs/dk-riasztas.md` ·
ADR-0276 („A ház riasztást kap, ha időzítő, levél vagy webhook elhasal”).

## Mérés (éles, csak olvasás)

- `/etc/systemd/system/citoviso-*`: 6 service (`User=citoviso`), `OnFailure=` sehol; a `citoviso` user
  NINCS a `systemd-journal` csoportban (a csoport létezik) → a sablon `SupplementaryGroups=systemd-journal`-lal olvas.
- `citoviso-public` / `citoviso-console` élesen van, a repóban NINCS → GATE 6 nem kezeli őket.

## Mit csináltam

- `src/console/houseAlert.ts` — `alertHouse` (alert_email, soha nem dob, a bukása csak napló) +
  `alertUnitFailure` / `alertBookingMailFailure` / `alertWebhookFailure`; tesztelhető függőségek (`setHouseAlertDeps`).
- `deploy/systemd/citoviso-alert@.service` + `scripts/unit-failure-alert.mts`; a 6 prod service-ben
  `OnFailure=citoviso-alert@%n.service`; `targets.json` → új `services` lista (a sablon `prod`).
- `scripts/systemd-units.mts` — időzítő nélküli service-ek nyilvántartása, `render-prod` ezeket is kiírja,
  OnFailure-szabályok + öntesztek; a CLI main-őr mögé került (importálható).
- `src/booking/requests.ts` — `mailSafe(label, requestId, send)`, 16 hívás a booking_request id-val.
- `src/payment/service.ts` — a `handleWebhook`/`applyWebhookResult` `ok:false` ágai `reason`-t adnak.
- `src/console/server.ts` — a webhook-route 400 és 500 ága riaszt (fizetés+státusz szerint óránként 1,
  globálisan óránként ≤ 10; az ok nem megy vissza a válaszban).
- `scripts/billing-cycle.ts` — elhasalt mellék-lépés után `exitCode = 1` (különben az OnFailure nem sül el).
- `scripts/house-alert-check.mts` + `hooks/pre-commit` bekötés; `scripts/i18n-scope.mts` indokolt kivétel.

## Igazolás

- `house-alert-check`: zöld; mutáció (a mailSafe + webhook bekötés kivéve) → 6 FAIL.
- `systemd-units check` zöld; `render-prod` 13 egységet ad (12 + a sablon); `systemd-analyze verify` rc=0.
- Felhasználói systemd-n (eldobható `cittest-*` egységek, utána törölve): bukó egység → a sablon
  `instance=cittest-fail.service`-szel fut; sikeres egység → nem fut.
- i18n-scope / i18n-lint / internal-ref-check / hu-machine-form-check / barion-webhook-ack-check /
  guard-wiring-check / gate-lane-check / gate-output-check zöld.

## Nyitott

- A public/console service-ek repóba vétele (és OnFailure) — külön döntés.
- A dev gépen a sablon nincs telepítve (a dev ágakon a foglalási-levél/webhook riasztás viszont él:
  deven `EMAIL_PROVIDER=smtp`, tehát egy szándékosan elhasaló levél-teszt valódi riasztó levelet küld).
