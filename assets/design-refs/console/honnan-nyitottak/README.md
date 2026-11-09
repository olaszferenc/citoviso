# Riport — „Honnan nyitották” panel (ADR-0435 — „B”)

Tulajdonosi jóváhagyás: 2026-11-09 („B”). A vázlat `honnan-nyitottak-mock.html` (A és B
változat + a link csatorna-jele egy fájlban; a **B köt**, az A elvetve), képek:
`mock-desktop.png`, `mock-mobile.png`. A számok a vázlatban az élesből 2026-11-09-én mért
valós adatok („Mind” időszak). **Ez a terv KÖT** — elvárt viselkedés, nem stílus-javaslat.

**Hatókör:** `src/console/reportViews.ts` · `src/console/reportData.ts` · `src/outreach/openVia.ts` · `assets/runtime/cit-configurator.js` · `migrations/0132_mock_view_open_via.sql`

(A panel: `openSourcePanel`; az adat: `attributeOpen`, `touchesOf`, `foldOpenSources`; a lap: `OPEN_VIA`.)

## Miért létezik

A tulaj kérése (2026-11-09): „a Tölcsér szekcióban azt is szeretném látni, hogy ha tudjuk
mérni, honnan nyitotta meg a lead a linket — ha több is volt kiküldve (Viber, WhatsApp, SMS,
e-mail)”. Addig a link minden csatornán UGYANAZ volt (a lead aldomainje), így ez nem volt mérhető.

## Amit a terv KÖT

1. **Helye:** a Tölcsér lapon a „Visszatérés” + „Bontás” sor ALATT, a „Kohorsz” FÖLÖTT, teljes
   szélességben. Cím: „Honnan nyitották — a N megnyitó lead csatorna szerint”.
2. **Megoszlás-sáv:** a megnyitó leadek csatornánként (E-mail · SMS · Viber · WhatsApp · Nem
   eldönthető), a szám a sávban, ha elfér; alatta jelmagyarázat számokkal (üres csatorna halványan).
3. **Táblázat:** Csatorna · Kapta · Megnyitotta innen · Arány · Megnyitás · Alap. Az Arány =
   megnyitotta innen / kapta; a „Nem eldönthető” sorban a megnyitók arányában, csillaggal. Telefonon
   a Megnyitás és az Alap oszlop elmarad, a fejléc tördelhet — oldalra húzás nélkül fér ki.
4. **Sorra kattintva** lenyílik a leadek névsora (a legutóbbi elöl): név → a lead riportja
   (`/prospect/<id>/activity`), megnyitások száma, utolsó idő, „lead-lap” link, „biztos” jel.
   Egy lead több sorban is szerepelhet.
5. **Alap:** „biztos N” = a link csatorna-jeles volt; „következtetett N” = régi küldés. A lap
   alatti mondat kimondja a három fogalmat és a csillagot.
6. **A link csatorna-jele** (a kiküldött szöveg utolsó lépésében, a vázlatot nem érinti):
   `/?e` e-mail · `/?s` SMS · `/?m` Viber/WhatsApp (a telefon a küldéskor választ — a küldés
   naplója, `mms_outbox.channel` mondja meg, melyik) · `/?w` a WhatsApp-utánküldés. A lap
   kiolvassa, a látogatással elküldi, és leveszi a címsorból (továbbküldött link ≠ az eredeti
   csatorna). A leiratkozó link sosem kap jelet.
7. **Hozzárendelés sorrendje:** ① a jel (biztos) → ② levelezőprogram referrer (Gmail-app stb.) →
   ③ a megnyitás előtt csak egy csatorna vitte ki a linket → ④ „Nem eldönthető”. Soha nem találgat.
   ⛔ A `prospect.sms_sent_at` a Viber-küldésnél is beáll (ADR-0430: „a lead megkapta a linket”) —
   SMS-érintésnek csak messenger-küldés nélkül, vagy a tulaj MMS+SMS tartalékánál számít.

## Őr

`scripts/open-via-check.mts` (pre-commit, `--self-test`-tel).
