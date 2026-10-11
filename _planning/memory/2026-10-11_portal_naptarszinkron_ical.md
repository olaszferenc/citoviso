# 2026-10-11 — Portál-naptárszinkron iCal-lal, első kör (ADR-0361)

## Elvégzett munka
- Kutatás (brief `~/rc-briefs/portal-api-kutatas-20261009-2013.md`): channel manager API-k (Channex $130/hó + $0,50/egység, Szállás.hu nem igazolt; Zodomus €29/hó-tól, Szállás.hu nincs; SiteMinder, SabeeApp, YieldPlanet) és portál-olvasó API-k (Booking Demand API a célunkra tilos; Tripadvisor Content API elavult). A Szállás.hu-nak nincs nyilvános API-ja, de van iCal-szinkronja.
- Tulaj-döntés: első kör = iCal naptár-szinkron (Booking.com, Szállás.hu, Airbnb), a foglalási modul része, nincs plusz díj; árszinkron/channel manager később, ha lesznek fizető tenantok.
- §2b terv „A + 1” jóváhagyva, befagyasztva: `assets/design-refs/console/portal-sync/`.
- Megvalósítva és landolva (origin/main `8f856dbd`):
  - tenant-admin: portálonként egy kártya („Hirdeti máshol is?”), lépésenkénti segítség, Összekötés / Másolás / Leválasztás, állapot-pirula, négy korlát;
  - rendelés-panel: „Benne: naptár-szinkron” sor a három portál-jelvénnyel;
  - mock foglalási widget (csak minta módban): „Naptára szinkronban:” sáv + két „a portálon foglalták” éjszaka;
  - KB `admin-modules-booking` új szakasz.

## Fájlok
`src/server/moduleConfigViews.ts`, `src/modules.ts`, `src/generator/configurator.ts`, `src/i18n/catalog.json`, `assets/runtime/cit-configurator.js`, `assets/runtime/cit-configurator.css`, `assets/runtime/cit-runtime.js`, `assets/runtime/cit-modules.css`, `kb/entries/admin-modules-booking/entry.hu.md`, `assets/design-refs/console/portal-sync/*`, `_planning/decisions/0361-portal-naptarszinkron-ical-lal-elso-kor-a.md`.

## Nyitott (tulaj döntése, nem blokkoló)
- Élesítés a következő deployjal, külön engedéllyel.
- Portál-LOGÓ a mockon csak írásos engedéllyel (Airbnb, Booking Holdings) — addig szöveges jelvény.
- Segédvideó forrása (tesztszállás a portálokon vagy az első tenant rögzített összekötése).
- Channel manager API (Zodomus/Channex) árszinkronhoz, ha lesznek fizető tenantok.
- A `feat/ical-sync` távoli ág törölhető.
