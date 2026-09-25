# 2026-09-25 — Két kapu valódi levelet küldhetett volna a tulajdonosnak (mérve: 0 ment ki) — mock-átjáró + őr

**Kiváltó:** az író-audit szál (ADR-0229) leletét a tulaj a négy nyitott tétel közül elsőnek
kérte: „`EMAIL_PROVIDER=smtp` mellett a booking-offer / season-year-price söprése valódi levelet
küldhet dev-tenantnak — kód-olvasásból, mérés kell.”

## Mérés
- A két kapu a VALÓDI `maintainDatedPrices()`-t hívja (`src/tenant/priceExpiry.ts`), ami a 14 napon
  belül lejáró dátumos árról a `tenant_user.contact_email`-re küld emlékeztetőt, és `tenant_message`-be
  naplóz. Egyetlen fék: a foglalt teszt-domain (example.com …). A `CIT_SHOT=1` NEM fogja le a
  levelezést (csak az AI-feltöltést és a boot-írásokat). A hook nem ad `EMAIL_PROVIDER`-t.
- `.env`: `EMAIL_PROVIDER=smtp`, `SMTP_URL` él, `EMAIL_BCC` a tulaj címe.
- Park: 7 tenant-user e-mailes, **6 valódi** (5 gmail + 1 citoviso.com).
- **Napló: 0 „Hamarosan lejár egy ár” levél valaha** → a lyuk nyitva volt, kár nem történt.
- Ma veszélyeztetett sor (a söprés pontos predikátuma × valódi cím): 0.

## Javítás
- `booking-offer-check.mts`, `season-year-price-check.mts`: `process.env.EMAIL_PROVIDER = "mock"` a
  dinamikus import ELŐTT (a `CIT_SHOT` mintájára; a config betöltéskor olvassa az env-et).
  Pozitív bizonyíték: booking-offer 31 `[email:mock]` sor, season-year-price 2, SMTP 0, mindkettő zöld.
- `server-import-env-check.mts` ③ szabály: aki a `priceExpiry.js`-t importálja, mock-ot állít az import
  előtt (vagy a hook sora adja). Önteszt +4 piros +3 kontroll; élő negatív kontroll a valódi fájlon.
  A szabálynak alanya van (≥2 importáló), különben üres zöld lenne.

## A négy tétel sorsa (a tulaj sorrendje: 1 → 4 → 3 → 2)
- **1. levél-kockázat — ZÁRVA** (fent).
- **4. `citoviso-kb-freshness.service` failed — a szabály volt hibás, nem a képek.** `kb-shot` újragyártása
  után 28 tenant-kép bájtra, 5 konzol-kép pixelre azonos (a PNG bájtjai tértek el — kódoló-zaj, nem
  commitoltam). `kb-shot --check-committed`: 45/45 friss. A ② szabály commit-DÁTUMOT hasonlított, és
  az `assetTs`-t BÁRMELY közönség képeiből vette: a tenant-csoportot hamisan pirosra, az operátort
  hamisan zöldre tette, és egy azonos újragyártás sosem tudta volna kioltani. Javítva: a dátum csak
  gyanú, a verdiktet a tartalmi kapu (`--check-committed`, pixel) adja; fail-closed, ha nem fut le.
- **3. `room-editor-check` trigger-lyuk — TÖRÖLVE, bizonyítékkal.** A szoba-szerkesztő 120 `.rs-*`
  CSS-szabálya INLINE a `moduleConfigViews.ts`-ben él (a triggerben), az `adminViews.ts`-ben és a
  `citui-admin.css`-ben 0 ilyen szabály — a tegnapi állításom fájlnevekből következtetett, nem
  szelektorokból (feedback_my_own_summary_line_can_be_the_false_premise).
- **2. kölcsönző + szemetelő kapuk — ZÁRVA (ADR-0231).** Mérve: 1 046 árva `scrape_run` (6 szemetelő, nem 4),
  5 kölcsönző; a lánc CASCADE, tehát egy sor törlése viszi az egész fixtúrát. `scripts/lib/fixture-parent.mts`
  (bélyegzett szülő, exit-hook törlés `psql`-lel) mind a 11 kapuban; 11/11 zöld, 0 helper-maradvány.
  Őr: `fixture-parent-check.mts` (①–⑤, 9 esetes piros önteszt); egyszeri söprés 1 040 + 1 033 sor.
  ⚠️ A hook-ban rekedt NUL bájt a `module-purchase-state-check.mts`-ben: a sima `grep` binárisnak látja —
  `grep -a` kell; az őr `readFileSync`-kel olvas, azt nem zavarja.

## Nyitva
- A hibaosztály tágabb (bármely kapu, ami termék-kódon át levelez): egy termék-szintű fék
  (`CIT_SHOT=1` → csak-outbox küldő) zárná egyben, de az Elek-futások és a config-mérő kapuk
  miatt külön döntés — ide nem fért.

## Fájlok
- `scripts/booking-offer-check.mts`, `scripts/season-year-price-check.mts`
- `scripts/server-import-env-check.mts`
- `scripts/kb-freshness.mts` (② tartalmi verdikt)
- `scripts/lib/fixture-parent.mts`, `scripts/fixture-parent-check.mts`, `hooks/pre-commit`, 11 kapu-szkript
- `_planning/decisions/XXXX-a-kapu-fixture-szuloje-sajat-es-onmagat-torli.md`
