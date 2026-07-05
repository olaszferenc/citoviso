# MEMORY — Citoviso
Utolsó frissítés: 2026-07-04

## Aktív feladat
**Nulláról tervezés — FÁZIS 1 + 2 + 3 ✅ KÉSZ. Következő: FÁZIS 4 (Vertikális MVP).**
Jóváhagyott 6-fázisú roadmap: `_planning/ROADMAP.md`. Alapmodell:
`.../2026-07-04_business_model_understanding.md`. Kimenetek: `.../2026-07-04_phase1_system_anatomy.md`,
`.../2026-07-05_phase2_industry_validation.md`, `.../2026-07-05_phase3_architecture.md`. A régi teszt-kód/modell eldobva.

### ⭐ Kereszt-metsző alapelvek (minden fázisra — lásd ROADMAP tetején)
- **A1 — Automatizálás-elsőbbség:** minden folyamat besorolandó (Automatizált / Manuális→tenant / Manuális→ház);
  minden manuális pontnál kötelező kérdés: hogyan automatizálható később? Az automatizáció = fő értékajánlat.
- **A2 — Kivétel-alapú, önmagát visszavonó ember a hurokban** (kuráció, pénzügy, support).
- **A3 — Nyelv ≠ korlát; AI-vezérelt kontextus-lokalizáció** (nem hardcoded; Site/admin/outreach). Határ: jog+formátum+pénznem = determinisztikus, ország-szabály.

### Fázis 1–2 fő felismerések (röviden)
- ⭐⭐ **3 becsatlakozási pont: KÍNÁLAT · ELÉRHETŐSÉG · KONVERZIÓ** — egy Iparág-definíció = e 3 interfész implementálása; minden más közös (Fázis 2, két iparágon igazolva).
- ⭐ A motor **Iparág × Ország** kétdimenziós: `Site = Tenant + (Iparág-def × Ország-lokalizáció) + Vállalkozás-profil + Modulok`.
- ⭐ **Control plane (mi világunk) vs. Data plane (honlap világa, per-tenant izolált)** — entitlement-vezérelt provisioning (instant modul-aktiválás). Tiered izoláció (RLS+PII-titkosítás), hibrid adatmodell (fix mag+JSONB), hibrid render (statikus+dinamikus szigetek), réteges időtárolás.
- ⭐ **Két moduláris platform:** külső (tenant Site-modulok) + belső (operátor back-office: pénzügy/sales/CRM/bizonylat) — külön RBAC.
- ⭐ **Meta-domain jelenlét mindig megmarad** → aggregátor/portál vektor (saját booking-alternatíva; Fázis 6).
- Kötelező **tenant-izoláció**; a vendég nem üzleti aktorunk. Modul-taxonómia + minimum→szofisztikált à la carte lépcső.

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

## Parkolt ötletek
`_planning/BACKLOG.md` — pl. interaktív mock-konfigurátor + élő próbatér (fizetés előtt); adat-vezérelt lead-priorizálás.

## Következő lépés (folytatás innen)
1. **Fázis 2 — absztrakció próbája 1-2 iparággal:** szállás + vendéglátás végigmodellezése a Fázis 1
   kereten (Iparág-definíció 4 rétege: ügyfélút, ügyvitel, adat-séma, modulkészlet), majd a KÖZÖS mag kivonatolása.
2. Majd **Fázis 3** (architektúra: tenant-izoláció, i18n, temporal/audit, hosting, agent-orchestráció) →
   4 (MVP) → 5 (pilot) → 6 (skálázás + aggregátor-portál + pénzügyi konstrukció). Részletek: `_planning/ROADMAP.md`.

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
