## ADR-0152 — Egy őr, amit semmi nem hív meg, nem őr: a bekötést kapu kényszeríti ki (2026-09-14)

**Dátum:** 2026-09-14 · **Státusz:** ELFOGADVA · **Kapcsolódó:** ADR-0147 ③ (az őr saját
fájlja triggerelje magát), ADR-0052 (`land.sh`), Elek FK-004b ② / FK-005a H-1 · **Őr:**
`scripts/guard-wiring-check.mts` (5 szabály, piros önteszt)

- **Kontextus:** a bejelentés KÉT árva őrről szólt (`renewal-date-coherence-check`,
  `room-card-overflow-check`): léteznek, zöldek, és a `hooks/pre-commit` nem hívja meg őket.
  Leltározva a **95 `scripts/*-check.mts`-ből 21 volt árva** — mind megnevezi a fejlécében azt
  az ÉLES hibát, amit lezár, és egyik sem futott soha commitnál vagy landolásnál. A forrásban
  **7 helyen** áll `Guard: scripts/…-check.mts` komment, ami egy soha le nem futó ellenőrzésre
  hivatkozik: a ház védettnek hitte magát ott, ahol nem volt az.
- **Miért nem vette észre egyetlen kapu sem:** mert **minden kapu a TERMÉKET méri, és egyik sem
  a KAPU-RENDSZERT**. A hiba osztálya nem „elfelejtettünk bekötni valamit", hanem hogy a
  bekötetlenség nem volt MÉRHETŐ állapot.
- **A mérés (mind a 21 őr lefuttatva, 2026-09-14):**
  · **10 zöld és önhordó** (offline fixture, eldobható DB vagy saját tmp-fa) → bekötve.
  · **7 park-függő** — a KÖZÖS teszt-parkra méri magát; ebből **4 MA IS PIROS** pusztán azért,
    mert az artefaktum/lead nincs meg ebben a fában (`hero-override-check` ENOENT a közös
    `sites/`-re, `pattern-badge-check` maga hagyja ki a mockokat, `copy-panel-check` és
    `hero-override-ui-check` lokátor-timeout). Kettő (`ad-banner-render-check`,
    `booking-price-coherence-check`) **zöld, de üres parkon szándékosan pirosra megy**
    (anti-vakuum, illetve „nincs vizsgálható oldal") — bekötve pont a purge után állítaná meg
    mindenki landolását, ahogy 2026-09-13-án már megtörtént.
  · **1 kézi** (`recurring-mandate-check`: valódi ismétlődő kártyaterhelés, 3DS-hez ember kell).
  · **1 telepítés-mérő** (`outreach-link-host-check`: a `PUBLIC_BASE_URL` a gép .env-jéből jön).
  · **2 ELROHADT** — lásd lent.
- **Döntés:**
  1. **Minden `scripts/*-check.mts` vagy be van kötve a `hooks/pre-commit`-be, vagy INDOKKAL és
     MÉRÉSSEL a `guard-wiring-check` EXCEPTIONS térképében ül.** Új őr írása = a bekötés
     kikényszerítve; nincs harmadik állapot.
  2. **A kivétel nem mentesítés, hanem KIMONDÁS.** Minden sor kötelezően hordoz `kind`-ot
     (kézi · telepítés · park · elrohadt), `measuredOn` dátumot és `measured` szöveget, ami
     megmondja, MIT adott a futás (rc, idő, a bukó állítás). „Lassú" nem lehet indok — arra a
     diff-scope-olt trigger a válasz.
  3. **Az ADR-0147 ③ szabálya MINDEN őrre áll, nem csak arra az egyre, ahol felismertük.**
     Mérve: az 50 diff-scope-olt blokkból **48 nem tartalmazta a saját fájlját** — vagyis a
     tegnapi tanulság pontosan egy helyen érvényesült. Mind a 48 javítva, és a szabályt
     innentől a ② kapu tartja.
  4. **A diff-scope-olt trigger a `changed_files`-t olvassa, sosem nyersen a
     `git diff --cached`-et.** A `land.sh` a kaput `LAND_RANGE`-dzsel, ÜRES indexszel futtatja:
     ott a nyers `--cached` mindig üres, tehát a trigger sosem tüzel és az őr **némán kimarad,
     pont a landolásnál**. Mérve **5 bekötött őr** élt így (`configurator-float-check`,
     `modsec-align-check`, `market-gate-check`, `tenant-legal-check`,
     `snapshot-propagation-check`) — mind az 5 külön lefuttatva ZÖLD, ezért az átkapcsolás nem
     visz be új pirosat.
  5. **A meta-őr MINDIG fut, diff-scope nélkül.** Szándékos: egy új árva úgy keletkezik, hogy
     valaki létrehoz egy `*-check.mts`-t és ezt a fájlt meg sem nyitja — vagyis pont akkor,
     amikor semmilyen hook-fájlra szűkített trigger nem tüzelne. Ára ~3 s, böngésző és DB nélkül.
- ⚠️ **KÉT ADÓSSÁG, amit a bekötetlenség FEDETT EL** (kimondva, nem elnyelve; a meta-őr minden
  futásban kiírja őket, hogy a „minden zöld" sor ne olvasódjon rendben lévő állapotnak):
  · `module-config-check` — **elrohadt fixture**: `source: "booking:xyz"`-t ír, a mai
    `getMonthAvailability` UUID-t olvas ki belőle → `invalid input syntax for type uuid`.
    Előtte 4 állítás is bukik a foglalás-slot MAI markupjára (`cit-enquiry`). Fixture-kérdés.
  · `lead-page-surface-check` — **VALÓDI TERMÉK-HIBA**: `aurora`/mobil a lebegő pirula
    (y=769, 195×83) a „Szabad időpontok megtekintése" CTA **23 %-át takarja** (rect 35,822
    320×80, vh=844); a 6 önteszt és a többi 60+ állítás zöld. **Ez pontosan az a hiba, amiért
    az őr készült (Elek FK-004b ②) — és mert soha nem volt bekötve, senki nem tudott róla.**
    Ez a legerősebb bizonyíték az ADR egészére: az árva őr nem elmaradt munka, hanem élő,
    kiszállított hiba, amiről van mérésünk és nincs tudomásunk.
- **Bizonyítás (a „bekerült a fájlba" nem bizonyíték):**
  · **A** — valódi `git commit` egy szándékosan bekötetlen őrrel a staged halmazban: **exit 1**,
    a HEAD nem mozdult, a meta-őr állította meg.
  · **B** — a `render.ts` kitöltője visszarontva a 2026-09-13-i alakra (abszolút panel a
    SZÜLŐBE): a trigger tüzel, az őr **9/114 mérésen bukik**, exit 1.
  · **C** — a `nextChargeDate` visszarontva „ma + 12 hónap"-ra: a trigger tüzel, az őr
    reprodukálja az eredeti leletet (**képernyő 2027-09-14 · `current_period_end` 2027-09-11**),
    exit 1 — miközben az „első vásárlás" ág zöld marad, tehát megkülönböztet, nem vakon tör.
  · A meta-őr **saját piros önteszttel**: mind a négy szabály sértését előállítja szintetikus
    hook-szövegen, plusz egy ÁLPOZITÍV-kontroll (tiszta alakra némának kell lennie).
- **Visszafordíthatóság:** 🔄 termék-kód NEM változott (mérve: `git diff -- src/ assets/ public/
  migrations/` üres). Csak a `hooks/pre-commit` triggerei és egy új őr-script.
- **Státusz:** ELFOGADVA (2026-09-14). Élesítés NINCS (§0.3) — a kapu-réteg nem éles komponens.
