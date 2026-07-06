# MEMORY — Citoviso
Utolsó frissítés: 2026-07-04

## Aktív feladat
**Nulláról tervezés — FÁZIS 1–4 ✅ KÉSZ. Következő: FÁZIS 5 (éles pilot) VAGY a tényleges ÉPÍTÉS.**
Jóváhagyott 6-fázisú roadmap: `_planning/ROADMAP.md`. Alapmodell:
`.../2026-07-04_business_model_understanding.md`. Kimenetek: phase1/2/3/4 doksik. A régi teszt-kód/modell eldobva.
Stack (MVP): Node/TS, Postgres (RLS+JSONB), Playwright, Claude API; build-vs-buy; managed felhő.

### ⭐ Kereszt-metsző alapelvek (minden fázisra — lásd ROADMAP tetején)
- **A1 — Automatizálás-elsőbbség:** minden folyamat besorolandó (Automatizált / Manuális→tenant / Manuális→ház);
  minden manuális pontnál kötelező kérdés: hogyan automatizálható később? Az automatizáció = fő értékajánlat.
- **A2 — Kivétel-alapú, önmagát visszavonó ember a hurokban** (kuráció, pénzügy, support).
- **A3 — Nyelv ≠ korlát; AI-vezérelt kontextus-lokalizáció** (nem hardcoded; Site/admin/outreach). Határ: jog+formátum+pénznem = determinisztikus, ország-szabály.
- **⚠️ A4 — A mock ALAPJA = bizalmi alapkő; TÖBB-RÉTEGŰ ellenőrzés** (provenance + több-jeles párosítás + kereszt-forrás korroboráció + AI-ellenőr + konfidencia-fallback + kuráció + tulaj-megerősítés). „Bizonytalanság → kevesebb, sosem hamis." A provenance/verifikáció a scraper+generátor melletti 3. bizalom-kritikus komponens. Részletek: BACKLOG.

### Fázis 1–2 fő felismerések (röviden)
- ⭐⭐ **3 becsatlakozási pont: KÍNÁLAT · ELÉRHETŐSÉG · KONVERZIÓ** — egy Iparág-definíció = e 3 interfész implementálása; minden más közös (Fázis 2, két iparágon igazolva).
- ⭐ A motor **Iparág × Ország** kétdimenziós: `Site = Tenant + (Iparág-def × Ország-lokalizáció) + Vállalkozás-profil + Modulok`.
- ⭐ **Control plane (mi világunk) vs. Data plane (honlap világa, per-tenant izolált)** — entitlement-vezérelt provisioning (instant modul-aktiválás). Tiered izoláció (RLS+PII-titkosítás), hibrid adatmodell (fix mag+JSONB), hibrid render (statikus+dinamikus szigetek), réteges időtárolás.
- ⭐ **Két moduláris platform:** külső (tenant Site-modulok) + belső (operátor back-office: pénzügy/sales/CRM/bizonylat) — külön RBAC.
- ⭐ **Két kulcs-motor:** scraper/lead-discovery (volumen) + generátor (termék). A **scraper is Iparág × Ország** paraméterezett (platform-regiszter: globális/lokális-nagy/helyi-kicsi + digitális lábnyom-profil; kvalifikáció: nincs/elavult/modern honlap). MVP: szállás + Balaton (teszt).
- ⭐⭐ **A „nincs semmije" lead a LEGÉRTÉKESEBB szegmens** (max hozzáadott érték + konverzió + verseny-mentes). Technikailag legnehezebb (kevés anyag), üzletileg legjobb → a „minimál-adatból varázslatos mock" képesség a fő MOAT. Megoldás standardizáltan: régiós kontextus-scraper + stock/placeholder + AI (lásd BACKLOG).
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
A tervezés (Fázis 1–4) kész. Két irány közül választ a tulaj:
1. **Fázis 5 — éles pilot:** valós balatoni lead → megkeresés → fizetés → élő oldal; humán-pontok + konverziós arányok mérése.
2. **VAGY a tényleges ÉPÍTÉS megkezdése** a Fázis 4-terv alapján (a mag: scraper + generátor építhető).
Utána Fázis 6 (skálázás + aggregátor-portál + pénzügyi konstrukció + globális piacok/jogi keret). Részletek: `_planning/ROADMAP.md`.

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
