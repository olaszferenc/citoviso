## ADR-0170 — Az elrohadt fixture-t a KÉRDÉS megtartásával javítjuk, nem az elváráshoz igazítva (2026-09-15)

**Dátum:** 2026-09-15 · **Státusz:** ELFOGADVA · **Kapcsolódó:** ADR-0152 (árva őrök),
ADR-0168 (a bekötetlen őr maga is elromlik), ADR-0044 (modul-konfig), ADR-0062 (a foglalási
felület kettéosztása) · **Őr:** `scripts/module-config-check.mts` (most bekötve)

- **Kontextus:** az ADR-0152 leltárának utolsó adóssága. A `module-config-check` 2026-09-15-ig
  **árva** volt, és mert soha nem futott, a FIXTURE-je csendben elrohadt — a termék
  háromszor is TOVÁBBLÉPETT alatta, a teszt pedig a régi világot állította.
- **A három rothadás, mérve:**
  1. **UUID-összeomlás.** A fixture `source: "booking:xyz"`-t és `"ical:abc"`-t írt az
     `availability_day`-be, miközben a séma kimondja: `'manual' | 'booking:<request_id>' |
     'ical:<calendar_link_id>'`, és a `resolveDayDetails()` ki is olvassa az azonosítót,
     hogy megnevezze a vendéget/portált → `invalid input syntax for type uuid: "xyz"`, a
     futás HALÁLA a 282. sorban (a mögötte lévő ~40 állítás soha nem is futott le).
  2. **ADR-0062 óta a foglalási felület KÉT darab.** A `bookingSlot()` foglalással már nem a
     teljes űrlapot adja: a kézjegyes sávban csak egy keskeny csík áll
     (`variant="cta"` → `#cit-booking`), a TELJES widget a záró szekcióban él. A fixture a
     RÉGI felosztást állította (4 bukó állítás).
  3. **Telefon-kötelezettség** (tulajdonosi rendelet, 2026-08-23, `requests.ts` 327–332): a
     vendég-fixture a rendelet ELŐTTI alakban élt → további 4 állítás bukott.
  4. **Átfedés-kezelés.** A fixture `outcome === "conflict"`-ot várt; a termék azóta
     ERŐSEBB: az átfedő kérést már az első elfogadásának pillanatában automatikusan
     elutasítja (`decided_by: "auto"`), tehát a `conflict` ág ebben a folyamatban el sem
     érhető — az a védelem második rétege.
- **Döntés — az elrohadt fixture javításának SZABÁLYA:**
  1. **A KÉRDÉST kell megtartani, nem az elvárás szövegét.** Ahol a viselkedés ÁTKÖLTÖZÖTT,
     az állítás ODAKÖLTÖZIK, nem lazul fel. Konkrétan: „eljutnak-e az egységek és a
     szabályok a VENDÉG lapjára" és „marad-e JS nélküli út" mostantól a **kiszállított
     felületen** (`bookingSlot` + `moduleSections`) mérődik, nem a sáv felén. ⛔ Egy
     „igazítsuk az elváráshoz a kimenethez" típusú javítás itt NÉMÁN kivégezte volna ezt a
     lefedettséget — a zöld ára a vakság lett volna.
  2. **A megváltozott SZABÁLYT fel kell venni, nem megkerülni.** A telefon-kötelezettségnek
     eddig EGYETLEN tesztje sem volt (a pozitív eset önmagában nem védi: a szabály
     kivehető lenne a kódból, és minden állítás zöld maradna) → két NEGATÍV iker.
  3. **A válasz ALAKJA igazodhat, a szigor nem csökkenhet.** Az átfedés-állítás mostantól
     azt méri, hogy a kérés semmiképp nem lehet elfogadott, hogy a RENDSZER utasította el
     (`decided_by === "auto"`), és hogy az éjszaka az ELSŐ vendégé maradt — három állítás
     egy helyett.
  4. **A fixture VALÓDI entitásokra hivatkozzon.** A naptár-eset ma egy létező
     `calendar_link` és egy létező `booking_request` sorra mutat, tehát a mérés azt a
     lekérdezési utat járja be, amit az éles admin-naptár. (A `2099-09` hónapot a valódi
     `createBookingRequest()` helyesen elutasítja — ott szándékosan közvetlen sor, és ez a
     scriptben ki is van mondva; a kérés-validációt a saját szakasza méri valós dátumokkal.)
  5. **A javított őrnek BIZONYÍTANIA kell, hogy még tud pirosra menni.** Három visszarontás,
     mindegyik pontosan a szándékolt állítást buktatja: telefon-szabály kivéve → 2 piros ·
     a szabály-attribútumok kivéve a szekcióból → 1 piros · `decided_by: "auto"` →
     `"owner"` → 1 piros. Termék-kód minden próba után visszaállítva (mérve: üres diff).
- **Eredmény:** 82 állítás zöld, ~11 s, saját eldobható fixture a valós DB-n. **Takarít:**
  két egymás utáni futás után a park változatlan (a `calendar_link`/`booking_request` sorok
  a site-tal kaszkádolnak); az egyetlen `_mcfg_check` árva **2026-09-08-i**, nem ezekből.
  Bekötve diff-scope-olt triggerrel (a modul-konfig, a bérlői rétegek, a motor
  `templateKit`/`moduleSections`, a foglalás-kérés és a séma + az őr saját fájlja).
- ⭐ **Ezzel az ADR-0152 leltára KIÜRÜLT:** nem maradt „elrohadt" kivétel, a
  `guard-wiring-check` adósság-figyelmeztetése eltűnt.
- **Visszafordíthatóság:** 🔄 termék-kód NEM változott (mérve: `git diff -- src/ assets/
  public/ migrations/` üres). Csak a mérőeszköz és a hook triggere.
- **Státusz:** ELFOGADVA (2026-09-15). Élesítés NINCS (§0.3).
