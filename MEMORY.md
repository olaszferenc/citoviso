# MEMORY — Citoviso
Utolsó frissítés: 2026-07-04

## Aktív feladat
**Nulláról tervezés — FÁZIS 1 (rendszer-anatómia, iparág-független) folyamatban.**
Jóváhagyott 6-fázisú roadmap: `_planning/ROADMAP.md`. Az alapmodell jóváhagyva
(`.../2026-07-04_business_model_understanding.md`). Fázis 1 munkaállapot:
`.../2026-07-04_phase1_system_anatomy.md`. A régi teszt-kód/modell eldobva.

## Státusz
- **Alapmodell rögzítve (jóváhagyott):** iparág-AGNOSZTIKUS, AI-üzemeltetett, volumen-alapú
  disztribúciós gép. Elsődleges ígéret = LÁTHATÓSÁG. Horog = előre kész, személyre szabott mock.
  Tölcsér: lead-scrape → mock (előre kész) → multi-csatorna megkeresés → élesítés (= 1. fizetős kapu)
  → moduláris upsell → megszűnéskor inaktiválás.
- **⚠️ A régi `src/` (Property-központú szűk szállás-modell) + DOMAIN `02-ENTITY-MAP` ELDOBVA.**
  Csak teszt-visszaigazolás volt (badacsonyi validáció: 85% nincs saját honlap). Tényleges
  `git rm` az új struktúra scaffoldjakor.
- Git remote: github.com/olaszferenc/citoviso — push továbbra is deploy key-re vár.
- Éles hoszting/deploy: TBD.

## Következő lépés (folytatás innen)
1. **Fázis 1b nyitott kérdései:** (a) mock-kuráció minden mockra vagy mintavételes/kockázati?
   (b) pénzügyi kontroll minden tranzakcióra emberi vagy csak küszöb/anomália fölött?
2. Utána **Fázis 1c** (fő fogalmak iparág-agnosztikus definíciója) → **1d** (moduláris kompozíció elve).
3. Majd **Fázis 2** (absztrakció próbája 1-2 iparággal) → 3 (architektúra) → 4 (MVP) → 5 (pilot) → 6 (skálázás).
   Részletek: `_planning/ROADMAP.md`.

## Nyitott kérdések (szándékosan elhalasztva a folyamat-modellig)
- Pénzügyi séma: előfizetés / egyösszeg / kombináció — képlékeny.
- Visszatérő érték / churn; upsell-időzítés.
- Hotlink-kép üzemeltetési törékenysége (idegen szerver leszedi → kép eltűnik).
- Google Maps kép-kivétel kezelése.
- Kiküldés-előtti belső jóváhagyás részletei.
- Globális enterprise-nyitottak: ki a "user" (tenant vs. végfelhasználó), időtárolás/audit mélysége,
  booking-sync (Booking.com/Airbnb) vs. tiszta direkt-foglalás, i18n-mélység (RTL/CJK, pénznem, jog).

## Előzmények
- 2026-07-04 (session 2): MEGÉRTÉS fázis. A tulaj elmondta az iparág-agnosztikus disztribúciós-gép
  modellt; üzleti-folyamati kérdésekkel közösen tisztáztuk (fő ígéret, mock-mechanika, jogi állás,
  domain, humán-pontok). Alapmodell jóváhagyva és mentve. Régi kód/modell eldobásra jelölve.
- 2026-07-04 (session 1): Repó létrehozva (Node+TS scaffold + doktrínák). Remote/watchdog per-repo
  CIT idle-slot. Badacsony piac-teszt (85% nincs saját honlap) validálta az ötletet. Árazás +
  motor-tanulságok + remote-setup a `_planning/memory/`-ban.
