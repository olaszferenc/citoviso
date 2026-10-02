## ADR-0299 — Szoba-törlés megerősítéssel, nyitott kérésnél tiltva; az IFA a foglalási kérésen befagyasztva (2026-10-02)

**Dátum:** 2026-10-02 · **Státusz:** elfogadva (tulaj a koordinátoron át, „egyetértek”; SUB M1, koordinátor: CIT
„élesi teszt” fő session; brief: `~/rc-briefs/javitas-elek-0930/m1-foglalas-admin.md`) · **Forrás:** Elek élesi
jelentése (2026-10-01) A-1, A-2, V-2, V-3, A-3, A-4, T-2 · **Terv (kontraktus):**
`assets/design-refs/tenant-admin/m1-elek-javitasok/` · **Kapcsolódó:** ADR-0232 (bármely egység törölhető),
ADR-0256 (a második szoba kérdése), ADR-0114 (az egész szállás egység).

**A lelet.**
- A szoba-törlés egy kattintásra törölt. A `site_unit` kaszkáddal vitte a naptár-napjait, árait, naptár-szinkronját
  és **minden** foglalási kérését: a függő kérés vendége soha nem kapott volna választ. Elek szkriptje élesen
  véletlenül törölt így egy egységet.
- A második szoba kérdése egy ismert szobát (`represents_whole=false`) is „az egész szállásként” ajánlott fel.
- A foglaló widget minden éjszakai árnál azt írta, hogy „a TELJES SZÁLLÁSRA” szól, szobánál is.
- Az IFA a panelen állt, a nyugtán és a vendég-levelekben nem.

**Döntés.**
1. **A törlés megerősítést kér** (a foglalás-visszaigazolás mintáján, kártyán belül, JS nélkül is), és számokkal
   mondja, mi vész el (`unitDeletionImpacts`). **Nyitott kérésnél (pending, offered) és el nem telt elfogadott
   foglalásnál a törlés tiltva** (a tulaj választása: „B”): a lap megállít és a Foglalásokra visz, a `deleteUnit`
   ugyanígy elutasít. Elvetve („A”): a kérés törlődik, a vendég elutasító levelet kap. Ez a szállásadó helyett
   döntene a vendégről.
2. A „mi a viszonyuk” kérdés csak az egész szállást jelölő egyetlen egységnél jelenik meg; az ismert szoba
   szoba marad (a szerver válasz nélkül nem ír át jelölést).
3. Az ár-alap mondata a foglalt egységet nevezi meg; „a TELJES SZÁLLÁSRA” csak az egész szállás egységnél.
4. **Az IFA a kérésen befagyasztva:** új oszlop `booking_request.quoted_tax_per_person_night` (integer, nullable;
   a nevet a tulaj hagyta jóvá; migráció `0084`). > 0 = összeg, 0 = a szállásadó kimondta, hogy nincs, NULL = nem
   adta meg / régebbi sor. A nyugta, a mobil 2. lépés, a „rögzítettük” és a visszaigazoló levél ugyanazt a három
   állapotot írja, mint a panel. NULL esetén a levél a modul aktuális beállításából dönt, és összeget csak megadott
   értékből ír (§B.17).
5. A Nyitvatartás modulnak nincs kitalált alapértéke (T-2, külön landolva `705053c8`-ban): az érintetlen modul nem
   állít tényt az élő oldalon.

**Visszafordíthatóság:** 🔄 olcsó. A megerősítés és a tiltás kódban él. Az oszlop additív; elhagyása csak azt
jelentené, hogy a levél az aktuális beállításból ír.

**Őrök:** `scripts/unit-delete-confirm-check.mts` (A-1 · A-2 · A-3 · A-4) · `scripts/booking-tax-receipt-check.mts`
(V-2 · V-3) · `scripts/module-config-check.mts` (T-2, differenciális: érintetlen modul = üresre mentett modul). Mind
a javítás előtt pirosan mérve: a régi kódon 27, illetve 14 bukás, a T-2-nél a `hours` szivárgása.
