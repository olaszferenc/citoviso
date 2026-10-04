# 2026-10-04 — Több e-mail-cím egy leadhez (Adatok fül, A változat) + a kurátor e-mailje a kurátoré

**Szál:** SUB (brief `~/rc-briefs/tobb-email-cim.md`), koordinátor: „mock-összehasonlító / Kapunyitás” session. Döntés: ADR-0321.
Tulaj-döntések (2026-10-04): „1. A · 2. Nem · 3. Igen · 4. Nem autofill ha van több email. · 5. ne legyen”.

## Elvégezve
- **Felmérés (14 fogyasztó).** A lead e-mailje a `lead.raw.email`, a gyűjtési napló a `raw.contacts[]`, a hideg levél
  címzettje külön mező (`prospect.contact_email`, kézzel írva).
  - Élesen 692/3013 leadnél van legalább két elfogadott jelölt.
  - 5 éles leadnél a `raw.email` törött sztring volt (OSM „a;b”, JS-szemét, szóköz).
- **§2b:** 2 változatos mock → a tulaj az A-t választotta. Befagyasztva: `assets/design-refs/console/lead-multi-email/` (README köt).
- **Adatmodell:**
  - `raw.email` = elsődleges (változatlan);
  - `raw.otherEmails` = a többi;
  - `raw.emailCuratedAt` = a kurátor megváltoztatta a listát.
  Séma-változás nincs. Közös segéd: `src/email/leadEmails.ts`.
- **Űrlap:**
  - soronként egy cím, „Megkeresés ide” rádió (az elsődleges az első sor), ×, „További e-mail”;
  - a beillesztett lista sorokra bomlik, ugyanaz a postafiók kihagyva;
  - a szerver címenként ellenőriz (mai WHATWG-szabály), mindent-vagy-semmit;
  - fejléc „+N”, Elérhetőségek „további”.
- **Az újragyűjtés nem írja felül a kurátor e-mailjét** (`src/scraper/curatorEmail.ts`). Bekötve ide: `reenrichOne`,
  `reenrich`, `places-medium-backfill`, `scrub-contacts`, `portal-backfill`.
- **OSM-bontás + dedupe:**
  - az OSM `email` tagje „;” mentén bomlik, a dedupe az elsődlegessel együtt viszi a listát;
  - a közös-kontakt kapu és a duplikátum-keresés minden címet néz;
  - összevonáskor a lista egy egység.
- **Migráció `0086_lead_email_list.sql`:** a többcímes `raw.email` sorok szétbontása, nyommal (`raw.emailSplitRepair`).
  Dev-en lefutott (4 sor), idempotens.
- **Őr:** `scripts/lead-contact-guard-check.mts` ④–⑥. A negatív kontroll 7 piros.
- **Súgó:** `kb/entries/console-lead/entry.hu.md` → „Több e-mail-cím”. A tudásbázis-őr FLAG-jét javítottam: a kiürítés-bélyeg,
  a „további” pontosítva, mobil +N.

## Ellenőrzés
- ui-shot 390/1280, Read-del megnézve.
- Valódi konzolon, saját fixture-leaden Playwright-végigkattintás: 24/24 (mindkét méret, DB-visszaolvasással).
- A mock végigkattintása két mock-hibát fogott (késői blur, Mentés alól lecsúszó gomb). Mindkettő javítva, az élesben is.

## Nyitott
- **Előtöltés (tulaj 4. pontja nem fedte le egyértelműen):** a „Követett link készítése” címzett-mezője ma sem töltődik
  elő. Kérdés: egycímes leadnél előtöltsön-e az elsődlegessel? Jelenleg NINCS előtöltés.
- **Élesen a 0086 a nagy deployjal fut le** (5 sor). Élesre semmi nem ment.

## Módosított fájlok
`src/email/leadEmails.ts` (új) · `src/scraper/curatorEmail.ts` (új) · `migrations/0086_lead_email_list.sql` (új) ·
`src/console/{data,server,views,leadContactRules,duplicates}.ts` · `src/outreach/sharedContactGate.ts` ·
`src/scraper/{types,dedupe,reenrich,reenrichOne}.ts` · `src/scraper/sources/osm.ts` · `public/assets/ui/citui-console.css` ·
`scripts/{lead-contact-guard-check,places-medium-backfill,portal-backfill,scrub-contacts}.mts` · `src/i18n/catalog.json` ·
`kb/entries/console-lead/entry.hu.md` · `assets/design-refs/console/lead-multi-email/*` · `_planning/decisions/XXXX-tobb-email-cim-egy-leadhez.md`
