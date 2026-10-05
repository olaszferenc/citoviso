# 2026-10-04 — Deploy-koordinátor: bc222e7f élesítve (prod/20261004-1728), OUTREACH_TEST_PHONES, Kerekerdő újragenerálva → 3 generátor-hiba SUB-ba

**Szál:** fő (koordináló) session, `wt/citafd12c3b`, brief `~/rc-briefs/deploy-koordinator-2026-10-04.md` (indította: „Éles Hibák Javítása”
koordinátor, tulaj: „minden élesbe menjen ki”).

## Élesítés
- Előtte élesen `33e1b3fc` (`prod/20261004-1516`); kivitt cél `bc222e7f` = akkori `origin/main` (6 commit: `e4242964` portál-kép
  host-független azonosság + lead-fejléc képszám, `afdaa1b4` foglalási blokk artdeco/walk-through, `bc222e7f` lírai nyitórész
  földrajz csak forrásból (ADR-0324 kieg.), + 3 docs). Migráció nincs, új config-kulcs nincs, időzítők egyeznek.
- Dry-run elsőre a GATE 1c-n bukott (a `src/console/views.ts` KB-figyelt): tudasbazis-or PASS → `kb-gate.mjs pass` → zöld.
- Tulaj „mehet” → main-mozgás visszamérve (0 új commit) → `deploy-prod.sh bc222e7f --go`: GATE 5 6 hiányzó EN string (0,01 USD),
  GATE 6b 7 időzítő fut, :4600 303 / :4800 200. **Éles = `bc222e7f`, tag `prod/20261004-1728`**, `DEPLOYED` 17:28:44.
  Visszagörgetés: `deploy-prod.sh 33e1b3fc --go`.
- Igazolás: HEAD, ledger, tag az originen, mindkét service active, 0 hibasor; címlap 200, egy mock (`/p/<token>`, GET — nem rögzít
  látogatást) 200; konzol `/login` 200. A konzol lead-lapját NEM nyitottam meg (belépés = éles session-írás).

## OUTREACH_TEST_PHONES (külön engedély)
- `.env` mentés: `/opt/citoviso/backups/env-20261004-153156/.env`; hozzáfűzve `OUTREACH_TEST_PHONES=06305161631` (69. sor).
- Restart console → public. A config élesen `outreachTestPhones = "06305161631"`-et olvas. ⚠️ A `.env`-et az app `loadEnvFile`-lal
  tölti → a `/proc/<pid>/environ`-ban NEM látszik; a config-olvasat a bizonyíték. ⚠️ `set -e` + `curl` a még nem figyelő portra
  (exit 7) megszakította a restart-szkriptem → a public restartját külön pótoltam.

## Kerekerdő újragenerálás (külön engedély)
- A `rerender-mock.mts` NEM elég (a mentett szöveget rendereli újra) → AI-generálás: elek-fiókkal a konzolon `POST /lead/<id>/generate`
  `template=horizontal` (curl — a tulaj elve szerint a jövőben ilyet böngészőben, kattintva). Új artifact `fce091bc` (16:04 UTC);
  a régi `572f7e82` megmaradt.
- tenyhuseg-or: **FLAG**. A vendég-kritikus is flag → kurátor-sor, kiküldés blokkolva. A `factVerdict` mégis „pass” volt.
  Három kódhiba (kettő kódban visszaellenőrizve):
  1. `resolveRegion` (`src/generator/generate.ts`): ismeretlen régiónál `regionId ?? "badacsony"` → `known=true`; az új artifact
     régiója „Badacsony” (a régié „Balaton-Kelet”) → a szövegíró és a tényhűség-kapu hamis tájkontextust kap.
  2. `DESCRIPTION_FACT_LABELS` (`src/generator/marketCheck.ts`): „parkol” → „Saját parkoló”, „panorama” → „Panoráma” kontextus nélkül
     (a forrásban: zárt parkoló; a Papod kilátó panorámája).
  3. a mock kiírja a kontakt-ellenőrzés által elutasított `raw.email`-t (nem ellenőrizve).
  A kerékpár-bérlés forrásolt (a szállás saját, igazolt hirdetése).
- ⛔ A tenyhuseg-or egy elírt távoli átirányítással `/tmp/ignore_never`-t írt az éles gépre → jelezve, tulaj-engedéllyel törölve.

## SUB
- `CIT ➕ 🔴 SUB Generátor-tényhűség 3 hiba` (`wt/cite4d4ef85`, brief `~/rc-briefs/generator-tenyhuseg-3hiba-2026-10-04.md`).

## Nyitott
- A SUB javításai → következő deploy → Kerekerdő újragenerálás (élesen, külön engedély). Nyitott kérdés: a régi `572f7e82` maradjon-e.
- Deploy utáni fejlesztési tételek változatlanul: lejárat előtti értesítő + élesi őrködés e-mail+SMS (DEPLOY-READY §4b).

## Kiegészítés 2026-10-05 (zárás)
- A SUB (`wt/cite4d4ef85`) landolta a három javítást: `ec96677c` régió-fallback known=false, `8203768a` elutasított kontakt nem
  kerül a vendég elé (+ ISP-postafiók nem „idegen domain” — a Kerekerdő `kuci01@axelero.hu` valódi), `b59f0dfa` „parkol” → „Parkoló”.
  Jegyzete: `_planning/memory/2026-10-04_generator_tenyhuseg_3hiba.md`.
- Mindhárom ÉLES: egy MÁSIK session deployolta, `30012966` = `prod/20261005-1126` (2026-10-05 11:26). ⚠️ A tulajnak először a tegnapi
  állapotot mondtam („nincs élesen”) újramérés nélkül — élesi állapotot MINDIG friss méréssel kell állítani.
- Régi mock levétele (tulaj: „Legyen csak az új”) NEM sikerült: „Mock törlése” csak jóváhagyott mocknál van; a régi `572f7e82`
  „Elutasítás” gombjára headless böngészőből kattintva nem jött navigáció, a státusz `generated` maradt (ok nem vizsgálva —
  valószínűleg a lap szkriptje fogja el a submitot). Élesen ma is: `572f7e82` (Balaton-Kelet) + `fce091bc` (Badacsony), mindkettő `generated`.

## Nyitott (2026-10-05)
- Kerekerdő újragenerálása a javított élesen (böngészőből, kattintva) + a két régi elutasítása — tulaj-engedéllyel, új sessionben.
- Az „Elutasítás” gomb headless kattintásra nem hatott — felület-hiba-e, vizsgálandó.
- A SUB nyitott tételei tulaj-döntésre: „Panoráma/kilátás” címke kontextus nélkül; mellékes szöveghibák (tűzrakó+ösvény, „Bakony
  határában”, „Erdei ösvények”); `brief.ts:97` „Saját parkoló” prompt-példa; a SUB saját §2b-kivétele (`siteData.ts`) utólagos jóváhagyásra.
