## ADR-XXXX — A kapu fixture-szülője SAJÁT és önmagát törli: nincs kölcsönzött és nincs hátrahagyott scrape_run (2026-09-25)

- **Kiváltó (tulaj, 2026-09-25):** az ADR-0229 audit két leletét („5 kapu idegen `scrape_run` sorra
  akaszkodik”, „4 kapu 380+380 árva sort hagyott”) a tulaj a nyitott tételek közé sorolta: „ok deal
  ahogy javasoltad” — minden kapu saját, bélyegzett teszt-adatot gyártson és takarítson.

**Amit a mérés mutatott (2026-09-25):**
- A `lead.scrape_run_id` NOT NULL, ezért minden lead-et vető kapunak kell egy futás-sor. **Öt kapu
  kölcsönzött** (wallet · charge-retry · order-paylink · mock-photo-gate · outreach-link-live): „az
  első” / „a legújabb” `scrape_run`-t vette szülőnek. A `scrape_run → lead` (és tovább a `tenant`,
  `prospect`, `mock_artifact`) mind **ON DELETE CASCADE** — egy testvér-session kapuja, amelyé az a
  sor, mérés közben törli, és a kölcsönző teljes fixtúrája eltűnik alóla: piros, ami nem a termékről szól.
- **Hat kapu szemetelt** (nem négy): saját definíciót + futást hozott létre, és csak a lead-et törölte.
  A parkban **1 046 árva futás**: modpaychk 413 · mltierchk 228 · bookingscreen 204 · roomeditor 114 ·
  wholecheck 49 · mlresume 23. Pont ezek az árvák azok, amiket a kölcsönzők „elsőként” elkapnak — a két
  lelet egy mechanizmus két oldala.

**Döntés**

1. **A szülőt egy közös helper adja:** `scripts/lib/fixture-parent.mts` — `createFixtureParent(db, base)`
   bélyegzett címkével (`_<base>_<fa-kulcs>_<pid>`) hoz létre definíciót + futást, és **process-`exit`
   hookban, szinkron `psql`-lel törli** — a `process.exit(1)` és a kezeletlen kivétel után is (a
   scratch-db.mts mintája; mérve a ④ állításban). Mivel a lánc CASCADE, **egy sor törlése** viszi az
   egész fixtúrát. Mind a 11 kapu erre állt át; a mock-photo-gate „üres park → kihagy” ága megszűnt
   (mindig van szülője).
2. **Őr:** `scripts/fixture-parent-check.mts` (a hookban, a kapu-szkriptekre és a helperre szűkítve):
   ① `selectFrom("scrape_run")` egy-soros lánc `.where(` nélkül = kölcsönzés (tiltott, indokolt kivétel:
   a gate-lane-check önteszt-szövege); ② `insertInto` a két táblára ugyanarra a `deleteFrom` / a helper /
   scratch-DB nélkül = szemetelés; ③ a helpernek ≥ 11 alanya van; ④ viselkedés: gyerek-folyamat
   létrehoz és `exit(1)`-gyel kilép → a sor nincs; ⑤ park-cenzus: a halott pid-ű helper-címkéket söpri,
   és 1 óránál régebbi, lead nélküli futás nem maradhat (megnevezi a címkéket). Piros önteszt 9 esettel,
   köztük a ④ piros kontrollja (helper NÉLKÜL a sor megmarad, és ezt látni kell).
3. **Egyszeri söprés:** 1 040 árva futás + 1 033 definíció törölve (csak lead nélküli ÉS 1 óránál régebbi
   — élő testvér-futás alól nem húzott ki semmit).
4. ⛔ **Nem sáv-döntés.** A kölcsönzés megszűnése után az 5 kapu jelölhető lenne az író-sávba
   (ADR-0229), de a jelölés MÉRT versenyt kíván (10 futás, 0 bukás) — az külön kör.

**Következmény.** A „véletlenszerű piros land” egyik mért forrása (kölcsönzött sor eltűnése) és a park
szemétje (ami a kölcsönzők célpontja volt) egyszerre szűnik meg; a hibaosztály őrrel zárt, nem
emlékezettel. Ami marad: a `help-collapse-check` és a `consent-style-check` **mérési alanyt** kölcsönöz
(„az első élő tenant”), nem fixtúra-szülőt — ez más osztály, más megoldással (saját fixtúra-tenant), külön.
