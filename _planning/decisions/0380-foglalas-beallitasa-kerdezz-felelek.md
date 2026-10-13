## ADR-0380 — Foglalás beállítása: kérdezz-felelek ellenőrzőlista + Segítő (Haiku 5.5, 1. kör: csak magyaráz)

**Dátum:** 2026-10-13 · **Státusz:** elfogadva (tulaj a koordinátoron át: „MEHET A B”) · **Brief:**
`~/rc-briefs/foglalas-kerdezz-felelek-20261013.md` · **Kontraktus:**
`assets/design-refs/tenant-admin/foglalas-kerdezz-felelek/` · **Migráció:** `0109_tenant_ai_call.sql` ·
**Őr:** `scripts/booking-setup-check.mts` · **Súgó:** `kb/entries/admin-booking-setup` ·
**Kapcsolódó:** ADR-0044, 0049, 0085, 0114, 0193, 0208, 0222, 0256, 0257, 0299, 0045, 0224, 0365.

### Kiváltó és felmérés

A foglaláshoz három modul kell (Szobák · Árak/szezonok · Online foglalás), három képernyőn, ~30 mezővel,
12 fogalommal. A felmérés 13 néma blokkolót talált: például „csak az időszakokban adom ki” időszak
nélkül (minden éjszaka zárva, a tulaj nem tudja), időszak-minimum a leghosszabb foglalás fölött,
ár nélküli éjszakák (a kérés ajánlatkérés lesz), a férőhelyet senki nem szűri.

### Döntés

1. **Egy vezetett oldal** (`/admin/booking-setup`), a jóváhagyott „B” terv szerint: hat rész,
   állapot-címke, egyszerre egy nyitva, „Mentés, tovább”. Első beállításra és módosításra ugyanaz.
2. **Második bejárat, nem második tár.** Minden mentés a meglévő írás-függvényeken megy át
   (`units.ts`, `prices.ts`, `siteModuleConfig.ts`). A modul-konfigot ÖSSZEFÉSÜLVE írjuk (a tárolt sor
   mentéskor lecserélődik, ezért a részleges küldés a többi kulcsot törölte volna). A „kiadás módja”
   nincs külön eltárolva: az egységekből olvassuk (`deriveMode`), és az ADR-0256/0257 meglévő
   műveleteire képezzük le („rejt”, „egesz”, `whole_only`).
3. **A néma akadályok** szerver-oldalon, a vendég-út predikátumaiból számolódnak (`unitPriceStatus`,
   időszak-minimum, `seasonal_only`).
4. **A próba-foglalás a vendég-út szabálya.** A `createBookingRequest` szabály-, foglaltság- és
   ár-részét kiemeltük (`stayRuleErrors`, `stayIsTaken`, `stayQuote`): a foglalási űrlap és a próba
   ugyanazt a függvényt hívja. A férőhelyet a rendszer ma nem szűri; a próba ezt kimondja.
5. **A mai űrlap megmarad**: az oldal tetején a „Haladó beállítások” menü a régi képernyőkre visz, az
   Online foglalás képernyőn a régi szabály-űrlap egy összecsukott „Haladó beállítások” alatt van
   (`#halado` kinyitja). A naptár és a kérések maradnak felül, alattuk a vezetett oldal kártyája.
6. **Segítő, 1. kör.** Csak magyaráz és a kérdéshez visz. Nincs eszköze, és a végpontja nem hív
   író függvényt. A `go` mutató csak az oldal kérdés-azonosítója lehet (a válasz-sémában enum, utána
   újra ellenőrizve). A tulaj jelenlegi beállításait a szerver olvassa a DB-ből, a böngésző nem
   küldheti. A felhasználó szövege adat, nem utasítás. Témán kívül udvarias nem. Kimondja, ami ma
   nincs: előleg, lemondási feltétel, pótágy-díj, férőhely-szűrés. Az ellátást és a gyerekárat
   (ADR-0378, ugyanaznap landolt) nem tagadja: az Árak képernyő „Ellátás” részére mutat.
7. **Modell: Claude Haiku 5.5** (`claude-haiku-5-5`, effort `low`, strukturált JSON-kimenet).
   Ár a claude-api skill szerint (2026-10-13): $0.10 / $0.50 per MTok. Mérve 6 éles kérdésen:
   ~3 620 bemenő és ~140 kimenő token, **~$0.00043 / kérdés**, 1,7–2,9 mp. Ugyanez Sonnet 5.5-tel
   ~$0.013 lenne. A válaszminőség mind a hat próbán megfelelt: magyarázat, beírás megtagadása,
   témán kívüli kérdés, előleg, Booking-naptár → Haladó, prompt-injekció. Nagyobb modellre csak akkor
   váltunk, ha a minőség élesben kevésnek bizonyul.
8. **Költség-mérés (ADR-0085):** `recordAiUsage` és hívásonként egy `tenant_ai_call` sor (site, modell,
   token, USD). A kérdés szövegét nem tároljuk. Szállásonként napi 40 kérdés a korlát, a hívás ELŐTT
   ellenőrizve (legrosszabb esetben ~$0.02/nap/szállás). Havi költség:
   `SELECT sum(cost_usd) FROM tenant_ai_call WHERE created_at >= date_trunc('month', now())`.
9. **CSRF:** a JSON-végpontok csak `application/json` kérést fogadnak; kereszt-oldali űrlap ilyet nem
   tud küldeni, a fetch pedig CORS-preflightot kérne. Ezen felül a süti SameSite=Lax.

### Később (NEM most)

2. kör: a Segítő javaslat-kártyája („Alkalmaz”), utána az írás. Ehhez külön terv és döntés kell.

### Visszafordíthatóság

🔄 olcsó. Új oldal és új tábla. A régi képernyők változatlanul működnek; a booking-képernyőn csak a
szabály-űrlap került összecsukott blokkba.
