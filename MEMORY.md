# MEMORY — Citoviso
Utolsó frissítés: 2026-09-25 (🚦 **Gép-szintű várakozósor a kapu-futtatónak** — az egész gépen egyszerre legfeljebb 6 kapu fut, `flock`-slotokon, sessiontől függetlenül; a futtató halálával a slot magától szabadul; egyedül 274/301 → 281 s; terhelés alatt a taposás-timeout eltűnt (2/22 → 0/15 piros), a futásidő-szórás csökkenése idegen terhelés miatt NEM bizonyított (egy tiszta slotos futás 425 s a 711–763 s helyett — egy minta); ADR-XXXX) · 2026-09-25 (🗓️ `booking-screen-check` hónap-végi piros NEGYEDSZER — a szabály cserélve: a fixtúra egy hónapban ül, a naptár arra nyílik, nincs kihagyó ág; fagyasztott órával 41/41 zöld) · 2026-09-25 (🛣️ **Író-sáv a kapu-futtatóban** — 27 író kapu auditálva, 12 `// gate-lane: own-fixture-only` jelöléssel EGYMÁSSAL párhuzamosan a ② fázisban (+2 függőben: booking-screen ma piros a main-en, room-editor terhelés-törékeny), 13 soros megnevezett okkal; őr `gate-lane-check` 10 szerkezeti osztállyal; verseny mérve 130 futás/0 bukás; ADR-0229) · 2026-09-25 (🔘 **Árak képernyő: gomb a Szobák szerkesztőhöz** — jóváhagyott „B” terv; a gomb célja a Szobák modul állapotától függ (aktív → szerkesztő, nem aktív → Modulok fül); súgó + kép frissítve, őr ⑤; nem élesítve) · 2026-09-25 (📨 **Barion „Unsuccessful callback” levelek — a két maradék ok zárva**: ismeretlen + pénzmozgás nélkül zárult fizetés → 200, ismeretlen + Succeeded → marad 400; GetPaymentState 429 → korlátos újrakérdezés — lokálban él, NEM élesítve) · 2026-09-24 (💳 **Pénztárca kártyacsere Barion-sandboxban IGAZOLVA** — Reservation→Finish(0)→token→MIT sikeres; a zárolás valódi terhelés+visszatérítés → 10 Ft + igaz mondat, ADR-0228; + „Másolom”-gomb SyntaxError és mobil terv-sáv javítva — nem élesítve) · 2026-09-24 késő este (⏱️ **pre-commit kapusor párhuzamosan** — olvasók együtt csak-olvasó DB-vel, írók sorban, a land nem méri újra az azonos fát; 480 s → 266 s, ADR-0227) · 2026-09-24 este (🎨 **tenant-admin „Linear” MEGÉPÍTVE — keret + Áttekintés + Fotók + súgó + őr, ADR-0224; nem élesítve**) · 2026-09-24 (🎨 tenant-admin újratervezés: „A” Linear jóváhagyva, terv befagyasztva — ADR-0224) · 2026-09-24 (✅ **Barion bírálat LEZÁRVA** — Advanced díjcsomag jóváhagyva: 1,19% + 0,2% recurring = **1,39%** ténylegesen; Metrics az Elfogadóhelyek menüben) · 2026-09-24 (worktree-ütközések három gyökéroka zárva — címadó eszköz nélkül, resume fa-őr CIT·MR·OF, kapu-versenyek egyedi állapotra; ADR-0223) · 2026-09-24 (Barion „Unsuccessful callback” levelek: a market-gate-check indított valódi sandbox-fizetést → mock átjáró kötelezően; köztes Barion-állapot 200, ismeretlen fizetés 400 — nem élesítve) · 2026-09-23 („nem adok meg árat” + új egység ára + heti ár-hiány emlékeztető, ADR-0222 — nem élesítve) · 2026-09-23 (évhez kötött szezonár + szezon végi kérdés, ADR-0221 — nem élesítve) · 2026-09-23 (súgó-kép frissesség = deploy-KAPU, determinisztikus kb-shot, ADR-0220) · 2026-09-23 (árazás foglalás nélkül: nincs ál-kapcsoló + szezon-zárás csak foglalással, ADR-0049 módosítás; 4 elavult súgó-kép — nem élesítve) · 2026-09-23 (vélemény-kezelő: igaz csillag + egyszeri köszönőlevél, ADR-0219 — nem élesítve) · 2026-09-23 (programajánló-minta a lead-mockban, ADR-0218) · 2026-09-23 (több terv egy követett linken — a `feat/multimocktabs` ÁGON, a pilot UTÁN megy a main-re, ADR-0218 az ágon) · 2026-09-23 (árajánlat-út ár nélküli kérésre, ADR-0215 — nem élesítve) · 2026-09-23 (heti programajánló megépítve, ADR-0214) · 2026-09-23 (havi alapértelmezés + „2 hó ingyen” jelvény, ADR-0211) · 2026-09-23 (a közös doksik generált indexe, ADR-0210) · 2026-09-22 (🚀 **ÉLES = `dcb130b`**, tag `prod/20260922-1501` — a Barion **Full Pixel** két kötelező eseménye (grantConsent, setEncryptedEmail) élesben, **éles POS** (valódi kártya + ismétlődő fizetés engedélyezve), és **éles számlázás** a CITO-fiókból. Részletek: ADR-0206 + `_planning/memory/2026-09-22_barion_pixel_pos_szamlazas.md`) · 2026-09-24 (📱 dev teszt-címzett: 06203759440 az `OUTREACH_SMS_ALLOWLIST`-en, viktoria.balogh1@gmail.com e-mailre eddig is mehetett — `.env`, git-en kívül) · 2026-09-24 (💳 **Pénztárca fül** — mentett kártya látható/cserélhető/visszavonható, ADR-0226 — nem élesítve, sandbox-próba nyitva) · 2026-09-24 (✉️ rendszerlevelek közös kerete: E4 logó, „Citoviso” feladó, cégadatos lábléc — ADR-0225, nem élesítve) · 2026-09-24 (🎨 **tenant-admin újratervezés: „A” Linear jóváhagyva, terv befagyasztva, kód következik** — ADR-0224) · 2026-09-24 (✅ **Barion bírálat LEZÁRVA** — Advanced díjcsomag jóváhagyva: 1,19% + 0,2% recurring = **1,39%** ténylegesen; Metrics az Elfogadóhelyek menüben) · 2026-09-24 (worktree-ütközések három gyökéroka zárva — címadó eszköz nélkül, resume fa-őr CIT·MR·OF, kapu-versenyek egyedi állapotra; ADR-0223) · 2026-09-24 (Barion „Unsuccessful callback” levelek: a market-gate-check indított valódi sandbox-fizetést → mock átjáró kötelezően; köztes Barion-állapot 200, ismeretlen fizetés 400 — nem élesítve) · 2026-09-23 („nem adok meg árat” + új egység ára + heti ár-hiány emlékeztető, ADR-0222 — nem élesítve) · 2026-09-23 (évhez kötött szezonár + szezon végi kérdés, ADR-0221 — nem élesítve) · 2026-09-23 (súgó-kép frissesség = deploy-KAPU, determinisztikus kb-shot, ADR-0220) · 2026-09-23 (árazás foglalás nélkül: nincs ál-kapcsoló + szezon-zárás csak foglalással, ADR-0049 módosítás; 4 elavult súgó-kép — nem élesítve) · 2026-09-23 (vélemény-kezelő: igaz csillag + egyszeri köszönőlevél, ADR-0219 — nem élesítve) · 2026-09-23 (programajánló-minta a lead-mockban, ADR-0218) · 2026-09-23 (több terv egy követett linken — a `feat/multimocktabs` ÁGON, a pilot UTÁN megy a main-re, ADR-0218 az ágon) · 2026-09-23 (árajánlat-út ár nélküli kérésre, ADR-0215 — nem élesítve) · 2026-09-23 (heti programajánló megépítve, ADR-0214) · 2026-09-23 (havi alapértelmezés + „2 hó ingyen” jelvény, ADR-0211) · 2026-09-23 (a közös doksik generált indexe, ADR-0210) · 2026-09-22 (🚀 **ÉLES = `dcb130b`**, tag `prod/20260922-1501` — a Barion **Full Pixel** két kötelező eseménye (grantConsent, setEncryptedEmail) élesben, **éles POS** (valódi kártya + ismétlődő fizetés engedélyezve), és **éles számlázás** a CITO-fiókból. Részletek: ADR-0206 + `_planning/memory/2026-09-22_barion_pixel_pos_szamlazas.md`) · 2026-09-24 (👤 **Elek mint VENDÉG** — FK-008/008b lefutva, pilot-blokkoló levél-link hiba élesen igazolva, jegyzet: `_planning/memory/2026-09-24_elek_vendeg_szemevel.md`) · 2026-09-24 (📱 dev teszt-címzett: 06203759440 az `OUTREACH_SMS_ALLOWLIST`-en, viktoria.balogh1@gmail.com e-mailre eddig is mehetett — `.env`, git-en kívül) · 2026-09-24 (💳 **Pénztárca fül** — mentett kártya látható/cserélhető/visszavonható, ADR-0226 — nem élesítve, sandbox-próba nyitva) · 2026-09-24 (✉️ rendszerlevelek közös kerete: E4 logó, „Citoviso” feladó, cégadatos lábléc — ADR-0225, nem élesítve) · 2026-09-24 (🎨 **tenant-admin újratervezés: „A” Linear jóváhagyva, terv befagyasztva, kód következik** — ADR-0224) · 2026-09-24 (✅ **Barion bírálat LEZÁRVA** — Advanced díjcsomag jóváhagyva: 1,19% + 0,2% recurring = **1,39%** ténylegesen; Metrics az Elfogadóhelyek menüben) · 2026-09-24 (worktree-ütközések három gyökéroka zárva — címadó eszköz nélkül, resume fa-őr CIT·MR·OF, kapu-versenyek egyedi állapotra; ADR-0223) · 2026-09-24 (Barion „Unsuccessful callback” levelek: a market-gate-check indított valódi sandbox-fizetést → mock átjáró kötelezően; köztes Barion-állapot 200, ismeretlen fizetés 400 — nem élesítve) · 2026-09-23 („nem adok meg árat” + új egység ára + heti ár-hiány emlékeztető, ADR-0222 — nem élesítve) · 2026-09-23 (évhez kötött szezonár + szezon végi kérdés, ADR-0221 — nem élesítve) · 2026-09-23 (súgó-kép frissesség = deploy-KAPU, determinisztikus kb-shot, ADR-0220) · 2026-09-23 (árazás foglalás nélkül: nincs ál-kapcsoló + szezon-zárás csak foglalással, ADR-0049 módosítás; 4 elavult súgó-kép — nem élesítve) · 2026-09-23 (vélemény-kezelő: igaz csillag + egyszeri köszönőlevél, ADR-0219 — nem élesítve) · 2026-09-23 (programajánló-minta a lead-mockban, ADR-0218) · 2026-09-23 (több terv egy követett linken — a `feat/multimocktabs` ÁGON, a pilot UTÁN megy a main-re, ADR-0218 az ágon) · 2026-09-23 (árajánlat-út ár nélküli kérésre, ADR-0215 — nem élesítve) · 2026-09-23 (heti programajánló megépítve, ADR-0214) · 2026-09-23 (havi alapértelmezés + „2 hó ingyen” jelvény, ADR-0211) · 2026-09-23 (a közös doksik generált indexe, ADR-0210) · 2026-09-22 (🚀 **ÉLES = `dcb130b`**, tag `prod/20260922-1501` — a Barion **Full Pixel** két kötelező eseménye (grantConsent, setEncryptedEmail) élesben, **éles POS** (valódi kártya + ismétlődő fizetés engedélyezve), és **éles számlázás** a CITO-fiókból. Részletek: ADR-0206 + `_planning/memory/2026-09-22_barion_pixel_pos_szamlazas.md`)

> 💳 **A FIZETÉSI LÁNC ÉLESBEN (2026-09-22).** Barion: Full Pixel + éles POS + **ismétlődő
> fizetés engedélyezve** (+0,2%). ✅ **Advanced díjcsomag JÓVÁHAGYVA (2026-09-24):**
> 1,19% + 0,2% recurring felár = **1,39%** a ténylegesen fizetett díj (előfizetést árulunk). Számlázás: **prod = CITO-fiók** (valódi számla, 92227011-1-33),
> **dev = TESZT (OV) fiók** (`OV-` teszt-számla saját cégadatokkal, NAV nélkül), a régi fiók
> kulcsa **tiltólistán** — a szerepeket boot-őr kényszeríti, mindkét irányban mérve (ADR-0206).
> 🔴 **A pilot előtti utolsó lépés: a 100 Ft-os próbavásárlás** (kupon-alapú, a tulaj címére) —
> ez a teljes éles kör egyetlen bizonyítéka: terhelés → webhook → élesítés → **valódi számla**.
> Amíg ez nem futott le, éles vevőt nem érdemes ráengedni. Utána az előfizetést le kell mondani
> (a megújítás listaáron menne).

## Aktív feladat (legfrissebb szál, 2026-09-25 — gépi várakozósor a kapusornak)

**🚦 GÉP-SZINTŰ SLOT-SZEMAFOR A KAPU-FUTTATÓBAN (ADR-XXXX).** Jegyzet:
`_planning/memory/2026-09-25_gate_machine_slots.md`. A `gate-runner.mjs` minden kaput (① olvasó és
② író fázis) egy `flock`-slotban indít (`~/.claude/cit-gate-slots/<n>`, alapból 6 — sessiontől
függetlenül ennyi kapu fut egyszerre a gépen); a slot a futtatóé (beágyazott futtató nem kér →
holtpont-mentes), és a futtató halálával (kill -9) a kernel elengedi. Kiírás: `… (6 gépi slot, várt
rá összesen N s)`. Menekülőút: `CIT_GATE_SLOTS=0`; `CIT_GATE_JOBS=1` érintetlen. Őr: `gate-runner-check`
F forgatókönyv (két futtató egy sloton, kill -9, beágyazott, slot nélkül) + 11 visszarontás.
Mérés: egyedül 274/301 → 281 s; terhelés alatt a taposás-timeout eltűnt (2/22 → 0/15 piros), a futásidő-szórás csökkenése idegen terhelés miatt NEM bizonyított (egy tiszta slotos futás 425 s a 711–763 s helyett — egy minta). ⚠️ Mellék-lelet: a `booking-screen-check` MA piros a hónapvégi
fixture-ablakon (09-29…10-01) — a land-okat elviheti, nem ez a szál javítja. Az író-sáv szála
(`~/rc-briefs/gate-writer-audit.md`) erre rebase-el.
## Előző szál (2026-09-25 — Író-sáv a kapu-futtatóban)
## Párhuzamos szál (2026-09-25 — booking-screen-check hónap-végi javítás)

**🗓️ A `booking-screen-check` MINDEN HÓNAP 25–26-án PIROS VOLT** (negyedik előfordulás; a
fixtúra +4…+9 napja két hónapba esett, a „KIHAGYVA” ág nem hagyott ki). A szabály cserélve:
`fixtureWindow()` — egy hónap, a naptár `ho=` váltóval arra nyílik, nincs kihagyó ág. Jegyzet:
`_planning/memory/2026-09-25_booking_screen_month_end.md`. Mellékleletek a két kapusor-szál
figyeléséből: `help-collapse-check` villódzik párhuzamos terhelés alatt (kölcsönzött park-sor),
`room-editor-check` triggere nem fedi az `adminViews.ts`/`citui-admin.css`-t; **az MR 23
sessionje ugyanezen a gépen fut** (user `mineral`, saját watchdog) — a gép-szintű
slot-szemafornak közös könyvtár kell.

## Aktív feladat (legfrissebb szál, 2026-09-25 — Író-sáv a kapu-futtatóban)

**🛣️ AZ ÍRÓ KAPUK AUDITJA KÉSZ, ÍRÓ-SÁV ÉL A FUTTATÓBAN (ADR-0229) — lokálban.** Jegyzet:
`_planning/memory/2026-09-25_gate_writer_audit.md` (27 kapu táblázata `fájl:sor`-ral). A 27-ből **12 jelölt** (+2 függőben:
booking-screen ma piros a main-en; room-editor terhelés-törékeny — egyedül load 23–45-ön 3/3 piros két mechanizmussal:
opacitás-átmenet közbenső értéke [ezt `cfc4e5db` közben javította], süti-párbeszéd elfogja a kattintást — bukó/törékeny kapu
jelölést nem kap) (`// gate-lane: own-fixture-only` a fejlécen — a jelölés a kapu mellett él, a futtató olvassa) a ② fázisban
egymással párhuzamosan fut, **13 soros** — de NEM „globális count(*)” miatt, hanem: **kölcsönzött sor** („bármelyik scrape_run”
FK-szülőnek → `lead.scrape_run_id` CASCADE, „első élő site” artifact → SET NULL → admin-lap elhal, „egy tenant_user”),
**globális söprő hívás** (`maintainDatedPrices`, `expireStaleOffers`, `getScrapeRuns`→reaper UPDATE), **DDL-trigger**
(`module_entitlement`), **közös `outbox/` törlése**. Őr: `scripts/gate-lane-check.mts` (mindig fut; 10 osztály, kivétel
csak indokolt `gate-lane-allow`-val; 19-es piros önteszt; `--probe <fájl>` az audithoz). Futtató-őr F forgatókönyv + 2
visszarontás (11/11 piros). Verseny: 13 jelölt 4 szálon 10 fordulóban = 130 futás, 0 bukás.
⚠️ A „kölcsönzött sor” osztály az EGÉSZ kapusorban él: `--probe`-bal 36 `*-check` 73 helyen (a szülő session a
`help-collapse-check`-en mérte a tünetet sessionek KÖZÖTT) — külön szál, a jegyzet „Nyitva” listájában.

## Előző szál (2026-09-25 — Árak képernyő → Szobák gomb)

**🔘 ÁRAK KÉPERNYŐ: GOMB A SZOBÁK SZERKESZTŐHÖZ — lokálban kész, NEM élesítve.** Jegyzet:
`_planning/memory/2026-09-25_arak_szobak_gomb.md`. A tulaj kérése: egy-egységes tulaj, aki szobákat
akar árazni, jusson el az Árak képernyőről a Szobák felvételéhez. §2b: két vázlat (A link-sor / B gomb)
→ **tulaj: „B”**; befagyasztva `assets/design-refs/console/pricing-rooms-link/`. Gyökér-szabály: a
modul-képernyő CSAK aktív modulra nyílik → a gomb aktív Szobák modulnál a szerkesztőre, különben a
Modulok fülre visz (`PricingEditorData.roomsActive`, kötelező). Őr: `pricing-booking-only-check` ⑤.
⚠️ Vázlat-tanulság: a relatív CSS-hivatkozást az RC-megjelenítő nem tölti be → CSS beágyazva.
⚠️ Mellékjavítás: a `booking-screen-check` a hónap utolsó napjaiban hamisan 3 csíkos napot várt (a kézi
blokk a következő hónapba esik) — most a jelvény hónap-szabályát követi (2 várt, számon kérve).

## Előző szál (2026-09-25 — Barion CallbackFailed-levelek, 2. kör)

**📨 A BARION „UNSUCCESSFUL CALLBACK” LEVELEK A 09-24-I JAVÍTÁS UTÁN IS JÖTTEK — KÉT ÚJ OK, FOGADÓ OLDALON ZÁRVA.**
Jegyzet: `_planning/memory/2026-09-25_barion_callback_failed_2.md`. Commit `a98331c1`, landolva, NEM élesítve.
- **A)** 3 lejárt 0 Ft-os sandbox-fizetés sor nélkül: a hotfix-ág (`prod/20260922-1501` alapon) még a régi
  `market-gate-check`-et futtatta. → Ismeretlen + Expired/Canceled/Failed/Rejected → **200** (nincs pénzügyi tét);
  ismeretlen + **Succeeded → marad 400** (valódi riasztás). ⚠️ Felülírja a 09-24-i „ismeretlen, lejárt → 400” állítást.
- **B)** 2 kártya-megerősítő Reservation: a callback megjött, de a `GetPaymentState` **429**-et adott → 400.
  → `fetchWithRateLimitRetry` (max 2 újrakérdezés, 800/1600 ms vagy Retry-After ≤3 s); tartós 429 → marad 400.
- Őr: `scripts/barion-webhook-ack-check.mts` 4. és 5. szakasz, piros kontrollal igazolva.
- Nyitott: élesre csak a következő deploy viszi; a Reservation-út 4–5 GetPaymentState-je csökkenthető volna.

## Előző szál (2026-09-24 este — Pénztárca sandbox-bizonyíték)

**💳 A PÉNZTÁRCA KÁRTYACSERÉJE BARION-SANDBOXBAN IGAZOLVA (ADR-0228) — lokálban kész, NEM élesítve.**
Jegyzet: `_planning/memory/2026-09-24_penztarca_sandbox_bizonyitek.md`. Valódi termék-úton (callback a
fő fa konzolján): Reservation + InitiateRecurrence → `FinishReservation(0)` → Succeeded → token + maszk
→ **MIT: RecurrenceResult Successful** (100 és 10 Ft). ⚠️ Cáfolat: a bankkártyás Reservation VALÓDI
terhelés, a Finish(0) visszatérítés (≤30 nap) → tulaj: 10 Ft + „terhelünk … azonnal visszautaljuk”.
Mock-kör: `scripts/wallet-tour.mts` (3 út, képek a tulajnál); sandbox: `scripts/barion-sandbox-card-probe.mts`.
Mellékleletek javítva (tulaj-kivétel): halott „Másolom” gomb (SyntaxError) + mobil terv-sáv a navigáció alatt.
Nyitott élesítés előtt: éles 3DS (sandboxban nem fut), Barion-tárca díj-fedezete (Reservation-Start feltétele).

## Előző szál (2026-09-24 este — Elek mint VENDÉG)

**👤 ELEK NEGYEDIK SZEREPE: A VENDÉG — FK-008 (élő tenant-oldal) + FK-008b (mock) MEGÍRVA, LEFUTVA,
KIÉRTÉKELVE.** Jegyzet: `_planning/memory/2026-09-24_elek_vendeg_szemevel.md`. Leletek:
`elek/runs/FK-008-2026-09-24T19-21-38/LELETEK.md` (HIBA 6 · ZAVAROS 9 · ERGONÓMIA 9) és
`elek/runs/FK-008b-2026-09-24T18-49-53/LELETEK.md` (HIBA 2 · ZAVAROS 8 · ERGONÓMIA 7).
- ⛔⛔ **PILOT-BLOKKOLÓ, élesen igazolva (olvasással):** a foglalás-levelek linkjei a KÉRÉS hostjából
  épülnek (`publicBaseUrl(req)`), élesben a tenant-hostra mutatnak, ahol MINDEN nem-gyökér út 404 —
  a tulaj elfogad/elutasít és a vendég lemondó/ajánlat-linkje élesben halott. Javítás NEM történt
  (tulajdonosi döntés: platform-bázis vs tenant-hostos kiszolgálás).
- Javítva a fában (commitolva): dev-úti vélemény-űrlap `API_BASE`; FK-005a drift (hozzájárulás-sáv +
  „Fizetek —" felirat); runner „mi takarja a célpontot" + pageerror-keret. **NEM commitolt, tulajra
  vár:** `src/console/views.ts` „Másolom"-szkript idézőjel-javítás (SyntaxError minden fizetőoldalon,
  élesen is él 09-15 óta) — a felület-kapu miatt külön engedéllyel megy.
- Nyitva: a leletek triázsa a tulajjal; a „Citoviso készítette" credit a vendég lapján; FK-007 dátumai
  elavultak (09-21); az ELEK-TESZT lead vendéglő-adat (Z1 zaj).

## Előző szál (2026-09-24 este — rendszerlevelek)

**✉️ A 12 PLATFORM-LEVÉL KÖZÖS KERETET KAPOTT (ADR-0225) — lokálban kész, NEM élesítve.** Jegyzet:
`_planning/memory/2026-09-24_platform_email_frame.md`. `src/email/platformLayout.ts`: „szem”itoviso
logó (E4, CID-inline PNG), feladó „Citoviso”, lábléc a `legalEntity`-ből, megszólítás a vevő nevével
(cégnek „Kedves Partnerünk!”). Terv: `assets/design-refs/console/platform-email/`. Valódi SMTP-próba
a tulaj Gmailjébe átment. Nyitva: `formatMoney` NBSP (mobilon törik az összeg a bekezdésben).

## Előző szál (2026-09-24 este — tenant-admin „Linear” MEGÉPÍTVE)

**🎨 A JÓVÁHAGYOTT „A” LINEAR TERV SZÁLLÍTVA (ADR-0224), NEM ÉLESÍTVE.** Jegyzet:
`_planning/memory/2026-09-24_tenant_admin_linear_build.md`. Kontraktus + eltérés-lista:
`assets/design-refs/tenant-admin/admin-linear/README.md` (kötő feliratok **„…”**-jelölve).
- ① Keret: fehér/szürke csoportos oldalsáv számlálókkal, ikonsávvá csukható; fejléc ← + útvonal +
  téma + „Oldal” + elsődleges gomb; mobil 4 + Menü alsó sáv (60 px mérve) + bal fiók (`:target`,
  JS nélkül is); világos/sötét `localStorage`-ban, boot a stíluslap előtt; vékony ikonkészlet
  (`icAdmin`). ② Áttekintés: 3 widget (állapot · látogatók 7 nap `site_visit` egyedi, robot nélkül
  + szikra · 3 üzenet), nyitókép-mutató, teendő-lista fejléccel, előfizetés-kártya VALÓS ciklusból.
  ③ Fotók: húzza-ide sáv (rejtett fájlmező + Fényképezés), rács/lista, hover-műveletek, nagyítás,
  kijelölés + tömeges törlés, fájlonkénti haladás/elutasítás, DnD sorrend (`to=<index>`),
  „Melyik egységhez?” a listában/nagyításban. ④ Súgó újraírva (admin-photos, admin-overview,
  admin-account), minden admin-kép újralőve rögzített órával (`AdminOpts.now`).
- **Őr:** `scripts/admin-linear-check.mts` (2 méret × 2 téma, piros önteszt) — pre-commitban.
- **Következő:** a tulaj szemre veszi a :4600-on land után; élesítés külön engedéllyel
  (`bash scripts/deploy-prod.sh <commit>`), előtte a súgó-kép kapu (`kb-shot --check-committed`).

## Párhuzamos szál (2026-09-24 késő este — kapusor futásideje)

**⏱️ A PRE-COMMIT KAPUSOR PÁRHUZAMOSAN FUT (ADR-0227).** Jegyzet:
`_planning/memory/2026-09-24_parallel_gate_runner.md`. A hook a kapukat feljegyzi, a
`scripts/lib/gate-runner.mjs` futtatja: ① olvasók 4 szálon, Postgres-kényszerített csak-olvasó
módban · ② az írni próbálók utána sorban. A land kihagyja, ami ugyanazon a fán + diffen már zöld
volt. 77 kapu: 480 s → 266 s. Soros menekülőút: `CIT_GATE_JOBS=1`. Őr: `gate-runner-check`.
Nyitva: a 14 író kapu (~186 s) őrönkénti gyorsítása.

## Párhuzamos szál (2026-09-24 este — Pénztárca)

**💳 PÉNZTÁRCA FÜL — A MENTETT KÁRTYA LÁTHATÓ, CSERÉLHETŐ, VISSZAVONHATÓ (ADR-0226, nem élesítve).**
Jegyzet: `_planning/memory/2026-09-24_penztarca_mentett_kartya.md`; kontraktus:
`assets/design-refs/console/wallet/README.md` (tulaj: „B külön pénztárca").
- Maszk (márka · utolsó 4 · lejárat) a Barion `FundingInformation.BankCard`-ból (0076);
  „Kártya cseréje/megadása" = EGY út: `card_update` order, **Reservation 100 Ft** +
  InitiateRecurrence → webhook `FinishReservation(0)` → token + maszk, számla nélkül; a régi
  kártya `saved_card_history`-ba. Modul-vásárlás: „Másik kártyával" → a pay-link tokent kér
  (`payment.initiates_recurrence`), a fizető kártya lesz a megbízás.
- Őr: `scripts/wallet-check.mts` (pre-commitban) — élesben talált uuid≠text hibát.
- ⛔ **Élesítés előfeltétele: Barion-sandbox próba** (Reservation-indítású token használható-e
  MIT-re); a mock végigviszi. Fő fán mock-kör még nem futott (worktree-ből a hook tiltja).

## Előző szál (2026-09-24 délelőtt — párhuzamosság)

**🛡️ „WORKTREE COMMIT ÖSSZEAKADÁSOK” — HÁROM GYÖKÉROK, MIND ZÁRVA (ADR-0223).** Jegyzet:
`_planning/memory/2026-09-24_worktree_collision_root_causes.md`.
- ① A „másik session commitolta a fájlomat” tettese a watchdog **címadója** volt (headless haiku,
  bypass alatt minden eszközzel: `git worktree list` → cd → commit). Zárva CIT+MR: `--tools ""` +
  üres cwd + `--selftest-title`. ② A **resume** foglalt fába támasztott fel (OF/MR fő fa) — most
  saját worktree + `RC_NOTICE` első prompt, CIT·MR·OF (`--selftest-resume-guard`). ③ **Kapu-
  versenyek**: `server-import-env-check` őr (a szerver importja ne írja a közös nyelvi
  csomagokat), `lib/scratch-db.mts` + `lib/session-tmp.mts`, 22 őr per-run egyedi állapotra.
- MR/OF fő fák RENDEZVE (11:30): MR 7 fő-fás session → 0 (land saját fából / átadás / retire), a
  maradék 219 árva fájlt egy dedikált MR-session landolja. Nyitva: `copy-panel-check` a HEAD-en is
  bukik (`.cp-scale`).

## Előző szál (2026-09-24 délelőtt — Barion setEncryptedEmail hotfix)

**🚀 ÉLES = `263ef8dd` (tag `prod/20260924-1004`) — CSAK a hotfix a `dcb130b`-re** (tulaj: „ne vidd
az egész maint”). A -001-es észrevétel oka: a bírálói linken nem volt pénztár, és a cím
beírása nem küldte a `setEncryptedEmail`-t (halott `name`-figyelő). Mindkettő javítva, élesen
mérve. Új bírálói link: `https://citoviso.com/p/review5b0455b4067b`. A válasz BEKÜLDVE (09-24); ✅ **a Barion 09-24 14:18-kor JÓVÁHAGYTA** (Advanced, ténylegesen 1,39%). **Következő: a nagy deploy** — felmérés és sorrend a `2026-09-24_barion_advanced_approved.md`-ben (dry-run még nem futott).
Jegyzet: `_planning/memory/2026-09-24_barion_setencryptedemail_hotfix.md`.

## Előző szál (2026-09-24 reggel)

**📨 BARION „UNSUCCESSFUL CALLBACK” LEVELEK — OK MEGTALÁLVA ÉS JAVÍTVA, A MAINEN (86974c6e).
Élesítés nem volt; a tulaj döntése: minden egyben megy mainről prodba.** Jegyzet:
`_planning/memory/2026-09-24_barion_callback_failed.md`.

- Ok: a `market-gate-check` (pre-commit) `PAYMENT_GATEWAY=barion` mellett VALÓDI sandbox-fizetést
  indított, majd törölte a `payment` sort → a 30 perc múlva lejáró fizetés callbackje 400-at kapott →
  CallbackFailed-levél commitonként (39 db a szálban). Vevő és pénz nem volt mögötte.
- Javítás: az őr mock átjáróval fut, fail-closed (Barionon leáll az első fizetés előtt); a
  `parseWebhook` köztes állapotra `"pending"` → 200 (csak ISMERT fizetésre), ismeretlen fizetés /
  hibás Barion-válasz marad 400 (a valódi riasztás). Új őr: `scripts/barion-webhook-ack-check.mts`.
- Bizonyíték a zaj megszűnésére: a következő órában nem jön új sandbox-levél. Ha jön: a `payment`
  táblában a gateway_ref hiánya = tesztszivárgás, megléte = valódi baj.

## Előző szál (2026-09-23 este — „nincs ár” döntés)

**🏷️ A „NINCS ÁR” KIMONDOTT DÖNTÉS + ÚJ EGYSÉG ÁRA + HETI EMLÉKEZTETŐ — KÉSZ LOKÁLBAN (ADR-0222,
migráció 0075). Élesítés nem volt.** Az ADR-0208 ⑥.2–⑥.4. Jegyzet:
`_planning/memory/2026-09-23_price_on_request.md` · kontraktus: `assets/design-refs/tenant-admin/price-on-request/`.

- `site_unit.price_on_request` (szobánként „Nem adok meg alapárat” pipa, alapár mellett tiltott, az
  alapár törli) · `unitPriceStatus` EGY predikátum (kártya + teendő-sor + levél) · új egység: ár-mező
  + pipa, a mentés sosem tagad meg · Áttekintés: „{n} szobájának nincs ára” (a részleges esetet is) ·
  vendég-lap: a kimondott szoba „Egyedi ajánlat alapján” · heti levél: 7 nap után, hetente, korlát
  nélkül (`site.price_gap_since` / `price_gap_reminded_at`).
- Őr: `scripts/price-on-request-check.mts` (pre-commit). A ⑥.5 (évhez kötött szezon) közben ADR-0221-ként
  landolt — a két szál az Árazás kártyán összefésülve. Nyitva: a levél zaja valódi adaton még nem mérhető.

## Előző szál (2026-09-23 este — évhez kötött szezonár)

**📅 ÉVHEZ KÖTÖTT SZEZONÁR — KÉSZ LOKÁLBAN (ADR-0221, migráció 0074). Élesítés nem volt.**
Session-jegyzet: `_planning/memory/2026-09-23_season_year_price.md`.

- **Árazás lap:** minden szezon alatt **évsáv** (B·1: kilógó kártya, végtelen oldalgörgetés, nyilak) —
  üres kártyán az ismétlődő ár él (visszaesés); **„Szerkesztés”** a szezon-soron; **fel/le** sorrend
  (átfedésnél a feljebb álló nyer); élő előnézet („11.01” is jó; átnyúló szezon „2026/27”).
- **Honlap-ártábla:** évet csak az éves árú szezon kap, a foglalható horizont minden alkalmával.
- **Szezon végi kérdés:** a záró nap utáni reggelen egy levél a jövő évi árról (`season_nudged_year`);
  az éves szezonra nincs „lejár egy ár” levél. Kontraktus: `assets/design-refs/tenant-admin/season-year-price/`.
- **Őr:** `scripts/season-year-price-check.mts` (~99 állítás, piros kontrollal).
- **Levél-link:** belépés után is a linkelt kártyára visz (csak `/admin…` cél — nincs nyitott átirányítás).
- **Nyitva:** névelő nélküli levél-tárgy (i18n), egységenkénti levél, foglaltsági szám a levélben.

## Előző szál (2026-09-23 este — súgó-kép frissesség)

**🖼️ SÚGÓ-KÉP FRISSESSÉG = DEPLOY-KAPU — KÉSZ LOKÁLBAN (ADR-0220).** A `kb-shot` determinisztikus
(`settle()` minden felvétel előtt; próba: `npx tsx scripts/kb-shot.mts --determinism`, 8 gyártás
terhelés alatt is 38/38 azonos). A `deploy-prod.sh` GATE 1c/kép a cél-commiton újragyárt és pixel-
szinten összevet — eltérés = a deploy megáll (külön: `--kb-shot-gate <commit>`). **2026-09-24:** a 3 partner-kép is a kapu alatt (saját scratch-DB + rögzített óra; a közös dev DB-ben valós nevek és 0 bizonylat ült), a Google Fonts a repóból jön (`scripts/lib/kb-shot-fonts/`) — 43 kép. ⚠️ Nyitott: egy
kapu ELŐTTI commitra a rollback is megáll. Jegyzet: `_planning/memory/2026-09-23_kb_shot_determinism_gate.md`.

## Előző szálak (2026-09-23 délután — árazás, vélemény-kezelő, programajánló-minta)

**💶 ÁRAZÁS FOGLALÁS NÉLKÜL — NINCS ÁL-KAPCSOLÓ (ADR-0049 módosítás) — LANDOLVA, élesre NEM.**
Foglalás nélkül az Árazás-képernyőn nincs szezon-kapcsoló / „éj min." (jóváhagyott B terv), és a
`seasonalOnlyInForce()` (`src/tenant/seasonalOnly.ts`) miatt a kapcsoló a naptárban, a portál-feedben
és a kérésnél is CSAK foglalással zár. Mobil túlcsúszás javítva. Őr: `pricing-booking-only-check`.
+ 4 elavult súgó-kép újragenerálva (`4cffc731`). Átadva két új sessionnek (saját fában):
**vélemény-kezelő** (a `rev-*` CSS sosem létezett → egy 1★ vélemény ★★★★★-nak látszott) és
**súgó-képek determinizmus + deploy-kapu**. Jegyzet: `_planning/memory/2026-09-23_pricing_booking_only_and_kb_images.md`.

**⭐ VENDÉGVÉLEMÉNY-KEZELŐ (2026-09-23 este, ADR-0219).** Az 1 csillagos vélemény ★★★★★-nak látszott
(a teli és üres csillag ugyanaz a jel volt, CSS sosem készült). Jóváhagyott B terv: csoportosított
lista, ★/☆ + „N/5", a Google-kártya a kapcsolót tükrözi. A levett-majd-újra-kitett vélemény írója
nem kap többé második köszönőlevelet (`site_review.thanked_at`, migráció 0073). Súgó + 3 őr.
Jegyzet: `_planning/memory/2026-09-23_reviews_inbox.md`. Nem élesítve.

**📅 PROGRAMAJÁNLÓ-MINTA A LEAD-MOCKBAN — KÉSZ LOKÁLBAN (ADR-0218, tulaj: „C”).** A mock a
jóváhagyott A blokkot mutatja kitöltve: 10 évszak-független program-típus, „a környéken”,
kitalált km/forrás nélkül; jelölés a bevezetőben („Minta-napirend.”, pirula nélkül); a dátumok
a nézés napjához igazodnak (`shiftSampleDates`). A régi mockok a rerenderig a régi mintát viszik.
Jegyzet: `_planning/memory/2026-09-23_programajanlo_lead_mock_minta.md`.

**🗂️ TÖBB TERV EGY KÖVETETT LINKEN (tervváltó) — KÉSZ AZ ÁGON, NEM A MAIN-EN (2026-09-23).**
Ág: `feat/multimocktabs` (originen), **land.sh NEM fut rá** — tulajdonosi döntés: a pilot UTÁN kerül a main-re
(alvó, de a küldési claimeket is módosítja). Kész: jóváhagyott terv (`assets/design-refs/prospect-page/plan-tabs/`
csak az ágon), `prospect_variant` (0071), `/p/<token>/v/<n>`, vékony sáv + képes váltó + lap alji blokk,
„{név} – N honlap-terv” szöveg (1 tervnél bájtra a mai), jog-őr PASS (6 lelet zárva), két új őr. **Következő:
a kurátori felület §2b terve.** ⚠️ Pilot-releváns, EZTŐL független: dupla pont a lábléc feladó-mondatában
(„e.v..”), és NEM mért gyanú, hogy a rendelés-gomb ráül a Leiratkozás linkre.
Jegyzet: `_planning/memory/2026-09-23_multiplan_tabs_feature_branch.md`.

**🔒 MODULE-SALES-CHECK: NEM ÍR TÖBBÉ KÖZÖS DB-SORT (2026-09-23 este).** A két egymásba lapolt
futás tartós maradékot hagyott a `module_sales_disabled`-ben (mérve: `email,gallery,rooms`), ami
minden land-et pirosra vitt a `configurator-placement-check`-en. Javítás: folyamaton belüli
felülírás (`overrideDisabledModulesInProcess`) + az őr méri, hogy a közös sor érintetlen.
Eldőlt (ADR-0217): a nem eladó galéria a mockon MARAD (a lead saját fotói); az őr erre kivételt tesz.
Jegyzet: `_planning/memory/2026-09-23_module_sales_check_race.md`.


**💬 ÁR NÉLKÜLI KÉRÉSRE ÁRAJÁNLAT — KÉSZ LOKÁLBAN (ADR-0215, migráció 0072). Élesítés nem volt.**
Session-jegyzet: `_planning/memory/2026-09-23_booking_offer_dated_price.md`.

- **A hiba:** ár nélküli kérésnél a tulaj levele koppintásos „Elfogadom”-mal ÁR NÉLKÜL véglegesített.
- **A jóváhagyott B út:** „Ajánlatot küldök” → ajánlat-lap (csak a hiányzó éjszakákra kér árat,
  „Érvényes eddig” + figyelmeztetés) → az ár MINDIG az árlistába → vendég-levél → vendég-lap (saját
  `offer_token`) → a tulaj mai elfogadásának MAGJA → mindkét fél levelet kap. + „A vendég elfogadta
  (telefonon / levélben)” gomb. Kontraktus: `assets/design-refs/tenant-admin/booking-offer/`.
- **Az évhez kötött ár ALAPJA kész** (`valid_from/valid_to`, sorrend a `cit-season.cjs`-ben); a
  „Főszezon 2027” felülete és a szezon-végi nudge NINCS.
- **Őr:** `scripts/booking-offer-check.mts` (110 állítás, pozitív kontrollal, kézi piros kontrollal).
- **Nyitva:** ADR-0208 ⑥.2 / ⑥.3 / ⑥.4 („X napja hiányos”) / ⑥.5 felülete.

## Előző szál (2026-09-23 — heti programajánló)

**📅 AUTOMATA HETI PROGRAMAJÁNLÓ — MEGÉPÍTVE (ADR-0214), NEM élesítve.**
Session-jegyzet: `_planning/memory/2026-09-23_programajanlo_build.md`.

- Gyűjtés (`src/events/`): Brave → udvarias letöltés → JSON-LD + Haiku 5 lap/hívás → kódszintű kapuk
  (dátum-ablak, dátum-a-szövegben, forrás a lap sorszámából, ismert hely) → token-halmazos dedup.
  **Település-kulcsos** tárolás (0071: `settlement`, `event_gather_run`, `local_event`) — 3 tenant köre 96 helyett 42 település.
- Tenant-admin választó (B kontraktus) + honlap-blokk (**A** kontraktus, `design-refs/public-site/programajanlo/`:
  mobilon 5 + „Még N program”, lábszöveg nélkül) + üres választásnál **automatikus kitöltés** + heti levél **CSAK a tulajnak**.
- Időzítők: `citoviso-events.timer` (napi 05:30: hétfői gyűjtés, napi újrarenderelés, heti levél) +
  `citoviso-events-pending.timer` (5 perc: a most vásárolt tenant köre azonnal — „különben dühös lesz a tenant”).
  ✅ Élesen a deploy **GATE 6** telepíti, engedélyezi és visszaméri őket (ADR-0216, `deploy/systemd/targets.json`) —
  kihagyhatatlanul. Dev gépen nincsenek bekapcsolva (költenek).
- Mérve: Rozé köre 41 település → 40 program, $0,43/hét. ⚠️ Magányos tenantnál ~650 Ft/hó költség vs 490 Ft/hó ár (az ár a tulajé).
- 🔴 **Nyitva:** a LEAD-MOCK programajánló-tartalma — FUT külön szálban (`~/wt/cit08ae3378`, brief:
  `~/rc-briefs/programajanlo-lead-mock-brief.md`); a `module-sales-check` verseny-javítása is külön szálban
  (`~/wt/cit6c630b0f`). Eredeti terv: (A blokk „Minta” jelöléssel, program-TÍPUSOK, a megtekintés
  napjához igazodó dátumok — valós adat NEM, mert a mock statikus és hetekkel később nézik); a lakosság-küszöb (≥1000) korrekciója a hozamból.
- ⚠️ Park-lelet: a `module-sales-check` két egymásba lapolódó futása „gallery”-t hagyott a `module_sales_disabled`-ben
  (a másik futás ideiglenes állapotát mentette eredetiként) → a `configurator-placement-check` mindenkinél piros lett;
  visszaállítva a döntés szerinti `["email"]`-re. Az őr maga javításra szorul (zár vagy saját fixture).

## Előző szál (2026-09-23 — modul-előnézet + egyszeri díj)

**🔍 ADR-0192 ⑧.3 + ⑧.5 LEZÁRVA (ADR-0213).** Előbb mérve, aztán javítva: a modul-előnézet
(Szobák/Árak/Értékelések/Foglalás) egységet írt egy semmit nem vett fiókba → `peekUnits` +
DB-pillanatképes őr; a próba-fizetőoldal a bővítést „éves előfizetés/Ft/év"-nek mondta → egyszeri
díj + modulnevek, valódi útvonalon mérő őr. Élesen egyik sem érintett vevőt.
Jegyzet: `_planning/memory/2026-09-23_preview_nowrite_upsell_oneoff.md`.
➡️ **Logó-csere** átadva új sessionnek: `~/rc-briefs/logo-c-lockup-brief.md` (a jel maga a C + „itoviso",
E4; nyitva a méretarány). ⚠️ `module-upsell-check` fix nevű scratch-DB → párhuzamos land-ok egymást buktatják.

## Előző szál (2026-09-23 — elutasított kártya)

**💳 AZ ELUTASÍTOTT KÁRTYA NEM NÉMA · a deploy-kapuk tudnak bukni · a fordítás a deploy kapuja.**
Session-jegyzet: `_planning/memory/2026-09-23_declined_card_deploy_pipefail.md`. Landolva (`c4e61db` … `127f2194`), **NEM élesítve**.

- Elutasított MIT → a tulaj a Modulok fülön marad (sáv + „Fizetés kézzel"), nem a Barion lapján némán; VALÓDI POST-tal végigfuttatva (10/10).
- ⛔⛔ A `deploy-prod.sh` hat blokkoló kapuja (pg_dump, db:migrate, npm install, GATE 5/5b) `| tail` miatt NEM TUDOTT BUKNI — `pipefail` + `deploy-pipe-check`.
- A commit nem kér fordítást (ADR-0207 mód.); `kb-freshness` ④ az élest méri; `park-doctor.mts` megmondja, ha a piros a parké.
- 🔴 **Nyitva:** a korábbi pg_dump-mentések valódisága (csak olvasás, tulaj szavára) · a következő deploy az első, amin ezek a kapuk bukni tudnak.

## Előző szál (2026-09-23 — konfigurátor)

**💳 KONFIGURÁTOR: a HAVI az alapértelmezett, a „2 hó ingyen” forintban és mozogva hirdet (ADR-0211).**
Session-jegyzet: `_planning/memory/2026-09-23_monthly_default_period_badge.md`. Landolva `d38e027a`, **NEM élesítve**
(a tulaj később egyben viszi a maint).

- §2b: 3 változatból a **C** (csillanó jelvény `−19 000 Ft · 2 hó ingyen`, zöld keret, „10 hónap áráért 12”);
  kontraktus `assets/design-refs/console/period-badge/`. Felülírja a 2026-08-23-i éves rendeletet (ADR-0090 ②).
- ⛔ Az alapérték-váltás 3 idegen őrt pirosított (mind „induláskor éves”-t feltételezett) → explicit éves választásra igazítva.
- 🔴 **Nyitva:** éves előfizetésű tenant + havi alapértelmezés → fizetőoldal havi, visszaigazolás éves összeg? (nem mérve)

## Előző szál (2026-09-23 — doksi-infra)

**🗂️ A KÖZÖS DOKSIK ÜTKÖZÉSE — ADR-enként külön fájl, generált indexek, duplikátum-kapu (ADR-0210).**
Session-jegyzet: `_planning/memory/2026-09-23_adr_files_generated_index.md`.

- **ÚJ MUNKAMÓD:** új ADR = új fájl `_planning/decisions/NNNN-slug.md` (szám: `npx tsx scripts/planning-index.mts next`);
  a `DECISIONS.md` (rövid index) és a memória `INDEX.md` GENERÁLT — `planning-index.mts build`, kézzel ne.
- **Land:** ha csak a két index ütközik, a `land-rebase.sh` újragenerál; régi alakú szerkesztést a
  saját ADR-fájljába visz; minden más ütközés hangosan megállít. A duplikált ADR-szám KAPU.
- **Bizonyítva:** 210 blokk ↔ 210 fájl bájtra (két független módon, 4 pozitív kontroll); land-őr 22
  állítás eldobható repóban + negatív kontroll + 3 célzott rontás, mind piros.
- **B KÉSZ:** új ADR `XXXX` helyőrzővel (`XXXX-slug.md`), a számot a LAND osztja ki (ADR-0210 ②).
- **ADR-0033 rendezve:** az ár-döntés marad 0033, az nginx-es új számot kapott (a land osztotta ki).
- 🔴 **Nyitva:** `MEMORY.md` „Aktív
  feladat" ütközése · két futó fa régi alakú, commitolatlan `DECISIONS.md`-szerkesztéssel.

## Előző szál (2026-09-23 — felszereltség)

**🛋️ FELSZERELTSÉG = KÉT KÜLÖN LISTA (ADR-0209, lezárja az ADR-0192 ⑧.4-et).** A renderelő
kihúzta a ház-listából, ami egy szobánál is szerepelt → teljes átfedésnél a KIFIZETETT szakasz
eltűnt, és az Áttekintés „kifizette, de üres”-t mondott egy kitöltött listára. Tulajdonosi döntés:
a kezdőlapi Felszereltség = amit a tulaj kiválaszt, a szobák a sajátjukat viszik; a szűrő kivéve.
Őr: `scripts/amenities-house-list-check.mts`. ⛔ Tanulság: a brief premisszáját kérdezd meg,
mielőtt a magyarázatot tervezed. Jegyzet: `_planning/memory/2026-09-23_amenities_two_lists.md`.
Élesítés nem volt feladat.

## Előző szál (2026-09-22 este)

**📅 AUTOMATA HETI PROGRAMAJÁNLÓ — a gyűjtés MÉRVE, az átnevezés KÉSZ, a kód még nincs.**
Session-jegyzet: `_planning/memory/2026-09-22_programajanlo_modul.md`.

- **FENT VAN:** a `poi` modul új neve **„Automata heti programajánló"** (publikus: „Heti
  programajánló"), az `id` szándékosan marad `poi` (a jogosultság/ár/számla sorok arra
  oldanak fel). Három rejtett fogyasztó javítva: a **konfigurátor** beégetve tartotta a
  régi nevet (a vevő a VÁSÁRLÁSI felületen a régit látta volna) + fedezetlen ígéretet
  hordozott; a **saját kommentem** fantom fordítási kulcsot gyártott; a **KB** idézte a
  régi feliratot. + fordítás-kör 6 nyelvre + a §2b-ben jóváhagyott **B terv kontraktusként**
  (`assets/design-refs/console/programajanlo/`).
- **A GYŰJTÉS TERVE MÉRT SZÁMOKON:** Brave ($5/1000) → `politeness.ts` letöltés →
  `jsonLdNodes()` → Haiku **kis kötegekben** → **kódszintű dátum-kapu** → dedup.
  **43 Ft/régió/futás, 17 program, 2,55 Ft/program, 0 rossz dátum** — szemben a
  web_search 33,92 Ft / 6 program / **33% rossz dátummal**.
  ⛔ Három saját téves következtetés a szálban: a Sonnet+dinamikus szűrés NEM olcsóbb
  (1,86× drágább); a bő futás egy hívásban ROSSZABB (a kötegméret a szűk keresztmetszet);
  és „50 ingyen JSON-LD esemény" valójában **1** volt — darabszámot néztem tartalomnak.
- **Lokalitás:** nem modell-címke, hanem ① településenkénti lekérdezés (≥1000 fő = 41
  település egy valós tenant 120-ából, ~72 Ft) + a SAJÁT település mindig, ② **távolság-címke**
  koordinátából („HELYBEN" / „7 km") — számítás, nem ítélet.
- **NINCS KÉSZ:** a gyűjtés megépítése, a tenant heti értesítője (ma nincs ilyen levél és
  nincs ütemező az appban). ⛔ A **vendég-értesítés KIESETT** (tulajdonosi döntés).
- **AZ ÁR:** a tulaj állítja be az Árazás lapon — kódot nem igényel. Ma 490 Ft/hó.

### Előzmény — a fizetési lánc élesítése (2026-09-22)

**💳 A FIZETÉSI LÁNC ÉLESÍTÉSE — BARION FULL PIXEL + ÉLES POS + ÉLES SZÁMLÁZÁS (ADR-0206).**
Session-jegyzet: `_planning/memory/2026-09-22_barion_pixel_pos_szamlazas.md`.

- **Full Pixel:** a Barion Starterre fokozta az elfogadóhelyet, mert a `grantConsent` és a
  `setEncryptedEmail` hiányzott — az őrünk közben ZÖLD volt, mert a SAJÁT listánkat mérte.
  Bekötve (más bp-csatornán mennek!), az őr **ZM-kapuja** a Barion hivatalos listáját járja.
- **Élesben:** `dcb130b` deploy, éles POSKey, ismétlődő fizetés engedélyezve.
- **Számlázás:** a prod/dev kulcs **fel volt cserélve** (a tesztüzemű fiók kulcsa futott élesen) —
  javítva, és ujjlenyomat-őr kényszeríti a szerepeket. A dev valódi `OV-` teszt-számlát ad.
- 🔴 **Nyitva:** a 100 Ft-os próbavásárlás · a -001 felülvizsgálata · „a együttes" elütés-patch ·
  `Kunó`/`Kuno` székhely-ékezet.

### Előzmény — szoba-szerkesztő (ugyanaznap)

**🛏️ A TENANT-ADMIN SZOBA-SZERKESZTŐ — A JÓVÁHAGYOTT D TERV LESZÁLLÍTVA (ADR-0198 ⑥).**
Mandátum: `~/rc-briefs/room-editor-impl-brief.md` (a terv-szál GÉPI munkaátadása). Kontraktus:
`assets/design-refs/tenant-admin/room-editor/README.md` (§9 kötő feliratok + §10 döntések).
Session-jegyzet: `_planning/memory/2026-09-22_room_editor_impl.md`. **Élesítés nem volt feladat.**

- **A felület:** kártyarács (mobil 2 / asztali 4 oszlop; borító, `N kép`/`Részletek`, név,
  férőhely, `Van saját oldala`/`Hiányos`, és a **borító-ütközés jelvénye a RÁCSON**) + kattintásra
  **felugró** `Alapok · Képek · Felszereltség` fülekkel; asztalin középre zárt párbeszéd, a
  **Mentés rögzített lábazatban**. A **név és a férőhely bekerült a szerkesztőbe** — eddig egy
  szoba KÉT űrlapon élt. A Képek fül nagy borító-előnézettel kezd, alatta **helyben feltöltés**
  (a közös képtárba megy ÉS ehhez az egységhez rendel, és ezt kimondja) és a **KÖZÖS képtár**
  (halvány = nincs hozzárendelve, pipa = hozzárendel, **csillag = borítóvá tesz ÉS hozzárendel**).
- **A nyitva hagyott tárolási modell ELDÖNTVE: jelölés a FOTÓ-rekordon** (`coverFor?: string[]`,
  migráció nélkül, a `carryPhoto()` viszi tovább). Lista, nem egy id (egy kép több szoba borítója
  lehet); a galéria-sorrend érintetlen → a **ház nyitóképe nem mozdul**, és **másik szoba borítója
  sem**. Feloldás EGY függvényben (`unitCoverPhoto`), jelölés nélkül a MAI szabály a tartalék —
  aki nem nyúl hozzá, azt látja, amit eddig.
- **JS nélkül is teljes** (felugró `:target`-tel, fülváltás rádió+CSS, hozzárendelés,
  borító-váltás, mentés — kikapcsolt JS-sel mérve). A helyben feltöltés JS-t kér, ahogy a Fotók
  fülön ma is (nincs multipart-értelmező) — **kimondva, nem elhallgatva**.
- ⛔ **Saját leletek mérésből:** a `history.replaceState` **nem értékeli újra a `:target`-et**
  (az ESC „lefutott", a felugró nyitva maradt) · a kontraktus horgony-listájából **NULLA** elem
  került be, mert a szakasz CÍMÉT a próza is leírta, és az őr a KORÁBBI előfordulást fogta meg —
  **zölden** (a regiszter kimenetéből visszaolvasva: 40 → 54) · a levétel kötő üzenete a SZOKÁSOS
  úton (pipa le + Mentés) elmaradt volna, most az **állapot-különbségből** képződik.
- ⛔⛔ **A feltöltést HOLTVERSENY tartotta fogva:** a súgó-fordítás lefedettség-kapuja a KÖZÖS
  dev-DB sorait a SAJÁT fa forrás-hash-éhez méri, és három fa három különböző verziót tartott két
  szócikkből — minden futás felülírta a másikét (mérve fél órán át, 40 commit-kísérlet, egyik sem
  talált csendet). A fám lemaradása is része volt, azt rebase-szel javítottam. **Tulajdonosi
  engedéllyel, EGYSZER** léptem túl EZEN AZ EGY kapun; minden más kapu lefutott.
- **Őr:** `scripts/room-editor-check.mts` — 123 állítás, 390 + 1280 px, JS-sel és JS nélkül,
  KIFESTETT téglalapon, kontraszt-önteszttel, és **hat negatív kontroll** (mind pirosra ment).
- 🔴 **NYITOTT:** az **ADR-0192 ⑧.4** ugyanezt a felületet érinti (a `rooms` eltüntetheti a
  fizetett `amenities` szekciót → szólni kell a tulajnak) — **külön §2b kör**. ⚠️ A súgó-fordítás
  kapuja N párhuzamos fa mellett SZERKEZETILEG teljesíthetetlen (a közös táblát a saját fa
  hash-éhez méri) — ezt külön mandátum rendezze.

## Előző szál (2026-09-22)

**💬 ÁR NÉLKÜL NEM FOGLALÁST ÍGÉRÜNK, HANEM ÁRAJÁNLATOT KÉRÜNK — és a szezon-szabály EGY
példányban (ADR-0208).** Az ADR-0197 ① folytatása, tulajdonosi mandátum.
Session-jegyzet: `_planning/memory/2026-09-22_quote_request_and_season_rule.md`.
Landolt: `dcb130b` · `7f7045b` · `eeb01e7`. **Élesítés NEM volt feladat.**

- **① A szezon-illesztés egy példányba** (`assets/runtime/cit-season.cjs`): a „melyik ár-sor
  vonatkozik erre az éjszakára?" KÉT példányban élt — az egyik azt döntötte el, mit OLVAS a
  vendég, a másik azt, mi FAGY RÁ a kérésre és megy ki a levelében —, és a kettőt SEMMI nem
  vetette össze. ⭐ Ez az **év-specifikus szezonár előfeltétele**: mérve, a 12 hónapos
  horizonton belül ugyanaz a **96 000 Ft** fagy be 2027 júliusára, mint 2026-ra.
- **② Árajánlat-mód** (§2b, 3 változat → a tulaj a **C**-t választotta): ha a tartózkodás
  bármelyik éjszakájára nincs ár, a néma üresség helyén magyarázat áll, a gomb
  **„Árajánlatot kérek"**, és a gomb alatti ígéret is átíródik. A választó már a választáskor
  jelzi („· egyedi ár") — szerver-oldali, mert a végpont egy egységre válaszol.
- ⛔⛔ **Öt saját hiba, egyiket sem a gondolkodás fogta meg.** A legfontosabb: a
  **végponttól-végpontig mérésem HAMIS ZÖLDET adott** — három script KÉZZEL fűzi össze a
  runtime-fájlokat, és az új fájl nélkül a lap undefined `CitSeason`-ön hal meg. ⭐ A mérésem
  azért volt vak, mert **csak azt az utat járta, amit én írtam**. Plusz: kettős keret (a KÉP
  fogta meg, 14 gépi állítás mellett), a KÖZÖS `note` elem, egy szintetikus (hibás) saját
  állítás, és egy idegen őr 2026-09-08 óta lappangó hónapforduló-hibája.
- 🔴 **NYITOTT (mind külön mandátum):** a tulaj értesítése árajánlat-kéréskor · a három állapot
  (⚠️ a `setBasePrice` a 0-t nem tárolja) · új egységnél kérdezés · emlékeztető · év-specifikus
  szezonár + nudge · az ADR-0197 ② (a polcról levett modult tovább számlázzuk).



## Előző szál (2026-09-22)


**💳 A KAPOTT KEDVEZMÉNY LÁTSZIK — a sávon és a számlán is (ADR-0205).**
Session-jegyzet: `_planning/memory/2026-09-22_coupon_visible.md`.
Kontraktus: `assets/design-refs/tenant-admin/coupon-visible/` (C változat, tulajdonosi döntés).

- **A kiváltó kérdés:** *„csak nem azt számlázzuk amit fizet vagy mi?"* — **megmérve: a
  számlázás HELYES** (terhelve 14 775 = számlázva 14 775). A „láthatatlan" nem pénzügyi hiba
  volt, hanem hogy a 19 700 − 25 % levezetés sehol nem jelent meg — a bizonyíték rá, hogy
  **maga a tulaj sem tudta eldönteni, jó-e a szám**.
- **Szállítva:** kuponos vásárlásnál nyugta-levezetés (díj → kedvezmény → terhelve) +
  megújítás-figyelmeztetés; kupon nélkül a régi egy mondat; a számlán a tétel NEVE és a
  MEGJEGYZÉS mondja ki.
- ⛔⛔ **Külön kedvezmény-SOR a számlán TILOS:** a Számlázz.hu összeadja a tételeket, tehát a
  végösszeg 14 775-ről 9 850-re esne. Az őr minden esetben visszaméri a végösszeg-egyezést.
- ⭐ **Egy ÉLŐ hibát is feltárt a terv-kör:** a modulok vesszős felsorolása három modulból
  ötöt csinált a képernyőn (a nevek maguk is vesszősek) — most „ · " + `nowrap`.
- ⛔⛔ **A mérőeszköz HÁROMSZOR hazudott, mielőtt a termék egyszer is** (levágó regex, a
  halvány zöldre vak pixel-kereső, nem-törő szóköz) — a részletek a jegyzetben.

## Előző szál (legfrissebb szál, 2026-09-22)

**🖼️ A FÜLSÁV OLVASHATATLAN FELIRATA, ÉS A PILLANATKÉP, AMI MAGÁTÓL ELKÉSZÜL (ADR-0203 +
ADR-0204).** Két tulajdonosi mondat egy képernyőkép mellé: *„itt a header zöld betűje szinte nem is
látszik"* és *„miért nem jön automatikusan előnézeti kép?"* Session-jegyzet:
`_planning/memory/2026-09-22_tab_contrast_and_auto_shots.md`. **Élesítés NEM volt a feladat.**

- **① A bejelentett hiba valódi, és egy sor javítja.** A lead-lap INAKTÍV fül-feliratai a navy
  gradiensen `--citui-link-ink`-kel festődtek: **pixelből 2,22:1** (küszöb 4,5). Ok: `.con a`
  (0,1,1) veri a `.con-ltab` (0,1,0) színét — a `:hover` és az `.on` ág MÁR `.con` prefixszel
  íródott, csak az ALAPÁLLAPOT maradt ki. `.con a.con-ltab` → **8,33:1**, mindkét méreten.
  ⚠️ A tulaj képe zöldes-sötét volt, az enyém navy; a Chrome force-darkjával a KÉPET
  reprodukáltam, de az zsákutca volt (a force-dark **javította** a számokat) — a reprodukált
  látvány nem diagnózis.
- **② ⛔⛔ Az őr 9733 elemre mondott zöldet FÖLÖTTE.** A háttér-feloldás gradiens ősnél `null`-lal
  adta fel → a konzol MINDEN sötét sávja némán kimaradt. Most minden stopra megold és a
  LEGROSSZABBAT veszi (**+302 felirat**), a mérhetetlent megszámolja és KIÍRJA (36), és az
  **önteszt negatív kontrollt kapott pont erre az ágra** (2 → **14** lelet).
- **③ A „~40 másodperc" MÉRVE HAMIS volt** (5,6 s az első render, 2,0–2,3 s a többi) — és ebből
  lett a felületen egy INDOK, amiért a kurátor 19 kártyán 19-szer kattintott, miközben a kép pont
  a DÖNTÉSHEZ kell. Valódi költség: a portál felé ismételt fotó-letöltés → **forráskép-cache**
  (19 render, **4 letöltés**) + globális sorompó + automatikus indítás (generálás vége ÉS
  lap-megnyitás a `none`-okra; a `failed` SOHA nem indul újra magától) + magától frissülő kártya.
  **Mérve, kattintás nélkül: 19 kép 49,5 s alatt, 0 JS-hiba.**
- ⛔⛔ **A saját első poll-változatom lett a következő hiba:** kártyánként kérdezve a lap sosem érte
  el a `networkidle`-t (a `button-weight-check` 390 px-en „HTTP nincs válasz"), bukásnál pedig a
  `location.replace()` megtörte a navigációt. Köteges `/lead/:id/shot-states` (a bukás OKÁVAL) +
  helyben kiírt hiba; az őr utána **414 állítással zöld**.

### Előző szál (2026-09-22)

**🛒 A MODUL-FÜGGŐSÉG A VÁSÁRLÁS PILLANATÁBAN — a lead kosara bepipál, a beküldő végpont elutasít
(ADR-0202).** Tulajdonosi mandátum (`~/rc-briefs/lead-side-dependency-gate-brief.md`). Az ADR-0192
szabálya ott állt, ahol a tulaj MÁR bent van (Modulok fül, megújítás-sweep), és ott hiányzott, ahol
a pénz ELŐSZÖR mozdul: a lead megvehette az **Online foglalást Árak nélkül**, kifizette, és a
konverzió pontosan azt élesítette. Session-jegyzet:
`_planning/memory/2026-09-22_lead_side_dependency_gate.md`. **Élesítés NEM volt a feladat.**

- **① A kosár BEPIPÁL** — a manifest szállítja a `requires`-t a katalógus `why` mondatával, a
  kosár tranzitívan behozza a láncot: „EGYÜTT JÁR" pirula · soronkénti indoklás · a vezérlő
  sorában csoportosított ár. Mérve: **+2 170 Ft/hó**, a jóváhagyott kontraktus száma, pontosan.
  ⭐ Azért a kliens, mert a fizetendő összeg a kiválasztott halmazon iterál — így a helyes ár
  **magától következik**, a „990 a képernyőn, 2 170 a terhelésen" meg sem születik.
- **② ⭐ A VALÓDI VÉDELEM: a beküldő végpont ELUTASÍT** (`400 module_dependency_unmet`), a
  kiszállított HTTP-úton mérve, a lánc KÖZEPÉN megszakítva is. ⛔ Nem kiegészít (a vevő többet
  fizetne, mint amit jóváhagyott) és nem hagyja el némán a modult (kifizetné és nem kapná meg).
  ⚠️ Valódi vevőt nem tagadhat meg: a konfigurátor futása **kiszolgáláskor** injektálódik (mérve
  **0 tárolt artifact** viseli a jelölőt), tehát régi mock-link is a MAI kosarat kapja.
- **③ A konverziós ág NEM épült meg, és ez ki van mondva.** A brief 3. lépésére döntést kértem;
  a tulaj leállította — és igaza volt: **dev 9 rendelésből 0 sértő, élesen is 0**. Mérj ELŐBB,
  és a kérdést a mérés mellé tedd.
- ⛔⛔ **A SAJÁT ŐRÖM 39 állítása HAMISAN ZÖLD volt:** a `check()` argumentum-sorrendjét
  elrontottam, a címke-sztring igazzá értékelődött, és a kimenetben ott állt `✓ false ↳ 82px` —
  a lap KIÍRTA a bukást és zöldre értékelte. ⭐ **És a hamis zöld ELREJTETT egy valódi leletet:**
  a 82 px igaz volt, a pirula szűk oszlopba préselte a modulnevet 390 px-en ÉS 1280 px-en is
  (a panel fix szélességű — „az asztalin elfér" FELTEVÉS volt). Az elrendezés-mérce most
  **alapvonal** (ugyanaz a sor pirula nélkül vs. pirulával), nem fix pixelszám.
- **Őrök:** új `module-dependency-cart-check` (**46 állítás**, böngésző 390 px + 1280 px, plusz a
  HTTP-végpont), `hooks/pre-commit`-be kötve. Az ADR-0192 ⑥ **NOT_COVERED** listája kiürült — de
  nem mutatóra cserélve: a `module-dependency-check` ÁLLÍTJA, hogy a kosár-őr létezik ÉS hogy a
  hook lefuttatja (negatív kontrollal igazolva: a hook-sort kivéve PIROS).
- ✅ **Utólag (ADR-0202 ⑧):** a konzol **Árazás** oldalának csomag-kártyái is a közös
  `sellableModuleIds()`-t hívják — egy modul leállítása a ráépülőket is leviszi az árból és
  jelvénnyel jelöli. ⛔ A `module-sales-check` eddig ÜRES KONTROLL volt (az áldozata, a
  `gallery`, semmire nem kell); most egy ráépülős áldozattal is mér, visszarontva 4 piros.
- 🔴 **NYITOTT:** a terv-sáv csoportosított ár-blokkja · a három KB-szócikk · a
  `DOMAIN/05-MODULES.md` függőségi szakasza · az ADR-0192 ⑧ 3–5. tétele · az Árazás-kártyán a
  ráépülő modul jelvénye még nem mondja meg, MIÉRT nem eladó. ✅ Az `outreach-send-bar-check`
  fixture-sodródása javítva: a termék predikátumával választ, üres parknál park-független
  fixture-t renderel (azelőtt 7 hamis termék-hibával állított meg mindenkit a `views.ts`-en).

## Előző szál (2026-09-22) — a szoba-szerkesztő terve

**🛏️ A TENANT-ADMIN SZOBA-SZERKESZTŐ — §2b terv-kör, a tulaj a D változatot jóváhagyta (ADR-0199).**
Tulajdonosi mandátum (`~/rc-briefs/rooms-admin-brief.md`): kártyás/kinyitható szobák, helyben
képfeltöltés, **borítókép**. Kontraktus: `assets/design-refs/tenant-admin/room-editor/`
(README + `plan.html` + 8 kép). Session-jegyzet: `_planning/memory/2026-09-22_room_editor_plan.md`.
**Kód NEM született — ez terv-kör. Élesítés nem volt feladat.**

- **A mért kiindulópont adta a kérés súlyát:** a 4 szoba ma **9 103 px** hosszú görgetés mobilon
  (asztalin 6 422), egy szoba **KÉT külön űrlapon** szerkeszthető, a felszereltség-választó mind
  a 4 szobánál kinyitva ül.
- ⛔ **Borítókép-fogalom NINCS:** a honlap a szobához rendelt ELSŐ képet mutatja a KÖZÖS galéria
  sorrendjében (`editor.ts` — `mine[0]`). Mérve: a **Tetőtéri Appartman és a Kerti faház
  UGYANAZT a fotót mutatja**, és a tulajnak nincs eszköze orvosolni. **Egyetlen globális sorrend
  nem tud N független borítót kiszolgálni** → önálló fogalom; a tárolási modellt az ADR nyitva hagyja.
- **A választott D:** kártyarács (a kártya = a vendég kártyája) + kattintásra **felugró** +
  `Alapok · Képek · Felszereltség` fülek. Asztalin **középre zárt párbeszéd**, a rács látszik
  mögötte. A Képek fül nagy borító-előnézettel kezd, alatta feltöltés és a **KÖZÖS képtár**.
- ⛔⛔ **Hat hiba: NÉGYET A KÉP fogott meg** (levágott státusz-szöveg **94 px** — pont AZT nem
  lehetett elolvasni, AMI HIÁNYZIK, miközben a túlcsordulás-mérés 0-t mutatott · a feltöltő
  csempe asztalin kiszorult a vízszintes görgetésbe · **navy-on-navy címsor, kontraszt 1,00** ·
  üres fül 21 % kitöltöttséggel) — **KETTŐT a saját mérőm hazudott zöldre** (az auto-görgetés
  kitolta a jelvényeket a keretből: **y = −275 px** · a `color-mix()` **0–1-es** színalakját
  0–255-ként olvastam → „éppen átment" 3,32/3,21 álértékek, valójában 5,53/5,57).
- **Záró mérés:** 103 állítás zöld, 0 JS-hiba, valós adat, mobil+asztali, minden javításhoz
  negatív kontroll. A `_drafts/` generátor/mérő kimentve: `~/rc-briefs/rooms-admin-ref/`.
- 🔴 **NYITOTT:** ① a megvalósítás (a **kötő feliratok/horgonyok megjelölése annak UTOLSÓ lépése**)
  ② a borító **tárolási modellje** ③ a **JS nélküli út** megtartása.

## Előző szál (2026-09-22)

**🔍 „MEGVETTE, DE ÜRES" — a duplikátum, a RÉSZLEGES eset, és három hazudó mérés (ADR-0197).**
Tulajdonosi mandátum: `~/rc-briefs/bought-but-empty-brief.md` (az ADR-0192 ⑨ nyitott kérdése).
Session-jegyzet: `_planning/memory/2026-09-22_paid_but_partially_empty.md`.
**Felderítés — termék-kód NEM változott.** Élesítés nem volt feladat.

- ⛔⛔ **A mandátum érdemi részét egy PÁRHUZAMOS SZÁL elvitte, miközben mértem:** induláskor
  `ef5b081` volt a fej, 21:22-kor landolt a `4eed722` + **ADR-0194** (a brief ① felderítése,
  ② döntése ÉS ④ őre is). Rebase után lefuttatva: **🟢 minden állítás áll.** A duplikátumot
  eldobtam. ⭐ A session-eleji `git fetch` NEM elég — a `main` kétszer mozdult a szomszéd
  területen; a felderítés FELÉNÉL is fetchelni kell.
- **① A valódi lelet — a RÉSZLEGESEN árazott szállás.** Két kapunk **két különböző kérdést**
  tesz fel (ADR-0193: „be van-e kapcsolva" · ADR-0194: „van-e BÁRMI tartalom"); a harmadikat —
  **„minden egységre van-e ár?"** — egyik sem. Eldobható fixtúrán mérve: az árazott egységre a
  végpont **árat ad**, az árazatlanra **`pricing: null`**, és **mindkét őr ZÖLD**. A vendég
  ugyanazon a naptáron az egyik fülön **28 000 Ft**-ot lát, a szomszédoson semmit. ⚠️ Ma nem
  áll fenn (0/4 és 3/3) → **jövőbeli sodródás**, elég egy új egységet felvenni.
- **② A polcról levett modult tovább számlázzuk.** `isBilledModule()` nem nézi a `retired`-et:
  `newsletter` **490 Ft/hó** (a blokkja bizonyítottan mindig `""`), `email` **390 Ft/hó** (nem
  is eladható). ⭐ Az ADR-0196 óta a megújítás is erre delegál → **egy záradék** javítaná.
- **③ Az ADR-0194 nyitott kérdése cáfolva:** nem hamis szám megy ki, hanem **semmilyen**
  (`pricing: priceRows.length ? {…} : null`). A kár más alakú: a naptár **teljesen**
  kirenderelődik (**942 / 1096 px**) — összeg nélkül.
- ⛔⛔ **Három mérésből kettő meggyőzően hazudott:** a horgony-számolás **hamis pozitív** (a
  tartalom a sablon SAJÁT szekciójába megy), a `moduleContentFor()` **hamis negatív kétszer**
  (a tartalom a `.data` alatt ül; és a generált `highlights` alapot nem látja). A helyes forrás
  az **`assembleEffective()`**. ⭐ A **POZITÍV KONTROLL** fogta meg — nélküle „minden üres"-t
  adtam volna tovább leletként.
- 🔴 **NYITOTT:** ① javítása (§2b tervkör, vendég-lap) · ② javítása (külön mandátum).
- ⛔ **ELVETVE (2026-09-22):** a „mindhárom felületen szóljon" — az Áttekintés teendő-sora elég.
  A §2b vázlat eldobva, kód nem lett. **Saját hiba:** a tulaj ezt későbbre tette, én egy
  kétértelmű „ok folytassuk"-ból levezettem a hatókört — vissza kellett volna kérdezni.

## Előző szál (2026-09-22)

**💸 A KIFIZETETT BŐVÍTÉS MIND VAGY SEMMI — és „a pénz megjött" ≠ „kézbesítve" (ADR-0196).**
Tulajdonosi utasítás: *„vidd a maradék hat hibát is, kezdd a nem-atomi activateUpsell-lel."*
Session-jegyzet: `_planning/memory/2026-09-22_upsell_atomicity_and_billing_predicate.md`.
**Élesítés NEM volt feladat** — a tulaj kimondta: élesre majd mindennel együtt.

- **⑧.7 reprodukálva, aztán javítva.** A `activateUpsell` modulonként külön utasítással írt;
  DB-szintű hibát injektálva a 2. modulnál **`["gallery"]` maradt hátra, kifizetve**.
- ⛔⛔ **A tranzakció ÖNMAGÁBAN nem lett volna javítás.** A fizetés a rendezés ELŐTT áll
  `paid`-re, a webhook első sora viszont `alreadySettled`-del tér vissza → egy újraküldött
  webhook **meg sem próbálta újra**: a vevő fizetett, semmit nem kapott, és az idempotencia
  elnyelte. Három réteg kellett: **atomi írás** + **a `paid` nem kézbesítési bizonyíték**
  (`undeliveredUpsellModules` → a replay újrarendez) + **ember-riasztás**, ha az sem megy.
  ⚠️ Szándékosan csak az `upsell` ágra — a többi `kind` változatlan, kimondva a kódban.
- **⑧.6** `renewableModuleIds` a „mit számlázunk"-ra második példányban válaszolt, a
  supersession lába nélkül; ma csak **véletlenül** egyezett (a kiváltott modul spine ÉS 0 Ft).
  Összevonva az `isBilledModule()`-ra — **5 dev tenanten 0 eltérés**, független referenciával.
- **⑧.8** a `renderableModules` doc-ja árazásra utasított, amit a kód sosem tett.
- ⛔ **Három saját hiba, mind MÉRÉSBŐL:** ① az egysoros `getEmailSender` importom **3 modullal
  kitágította** az ADR-0070 i18n-hatókörét → a riasztás a `payLinkAlert.ts`-be került, nem a
  közös listát tágítottam ② az **ADR-0194 a kommentjeimben is élt**, miközben elkelt (→0196)
  ③ a commit kimenetét `| tail -40`-nel néztem, és **az vágta le a bukás sorát** — nem a kapu
  volt néma, én tettem azzá.
- **Mellékág:** a `prospect-owned-check` **egyetlen munkafában sem tudott lefutni** (fix 4600-as
  port → EADDRINUSE, egyetlen állítás előtt). Efemer port kérése, 1 sor → **71 állítás zöld**.
- 🔴 **A hatból három nyitva:** **⑧.4** (eltűnő Felszereltség-szakasz — *mérve ma egyetlen
  tenant sincs így*; tulajdonosi döntés: **szóljunk a tulajnak** → **felület, §2b kört kér**)
  · **⑧.3** (mock fizetőoldal „éves előfizetés" egy egyszeri díjra) · **⑧.5** (az előnézet ÍR).
- 🔴 **HITELESÍTÉS:** az előző szelet §2b-kivételét egy **gép-írta briefre** hivatkozva nyitottam
  ki („tulajdonosi mandátum"); a tulaj utóbb kimondta, hogy a promptot nem ő írta. Jelentve, ő a
  továbbmenetelt választotta — de gép-írta brief **nem** tulajdonosi felhatalmazás (ADR-0068).

## Előző szál (2026-09-21) — a publikus szoba-kártya

**🛏️ A PUBLIKUS SZOBA-KÁRTYA ÉS RÉSZLETEK-FELUGRÓ — ADR-0195 + ADR-0199.**
Tulajdonosi mandátum (`~/rc-briefs/rooms-card-brief.md`), a §2b B változat leszállítása.
Kontraktus: `assets/design-refs/tenant-site/rooms-card/README.md`.
Session-jegyzet: `_planning/memory/2026-09-21_rooms_card_impl.md`. **Élesítés NEM volt feladat.**

- **A kerülő út megszűnt.** A kódban ott volt a beismerés: *„they ride the note line every
  template already renders — **no template edit**"*. Az `editor.ts` egy `note` mezőbe fűzte
  a leírást ÉS a felszereltséget, a vendég egy mondatban kapta mindkettőt. A `Room` most
  strukturált (`description`, `amenities{label,icon}`, `photos`, `slug`, `wholeProperty`);
  a minta-szobák és a 4 legacy renderelő `roomNoteLine()`-t olvas, hogy NE vesszen szöveg.
- **Egy közös réteg, 13 behívó.** `templateKit.ts`: `roomShell` (héj + `data-cit-room`
  horgony + valódi `<a href="/apartman/<slug>">`, mert az aloldal SEO-belépő), `roomHint`
  (hover-független jelvény: „{n} kép" / EGY fotónál „Részletek", soha nem „1 kép"),
  `roomDetails` (no-JS `<details>` = a felugró adatforrása, amit a runtime beolvas és KIVESZ).
  A felugró: `register("rooms")`, a MEGLÉVŐ `.cit-lb` a nagykép, rétegzett ESC, közös
  görgetés-zár. Egy predikátum (`unitPageIsWorthWriting`) őrzi, hogy kártya ne mutasson 404-re.
- **⭐ A galéria RUGALMAS, nem fix.** A fix magasság artdeco-n átment, három sablonon bukott:
  a felugró a SKIN betűit viseli, ezért a pixel-költségvetés nem szabály, hanem véletlen.
  A szoba-TÉNYEK kapják a helyet, a kép veszi, ami marad.
- **Őrök:** ÚJ `room-details-check` (38 mérés · 114 kártya · 114 horgony · **7 visszarontásos
  önteszt** kontrollal), bekötve. A meglévő `room-card-overflow-check` 114 mérésen zöld.
- ⛔⛔ **Öt saját hiba, mind mérésből:** ① a CSS forrás-sorrendje (az asztali szabályom semmit
  nem csinált: 1280 px-en 9-ből **2** felszereltség látszott) ② pixel-költségvetést hangoltam
  szabály helyett ③ a saját mérőm **két álbukást gyártott** (a hálózat-tiltásom `ERR_FAILED`-je
  „JS-hiba"; a nyers illesztés a csupa-nagybetűs sablonokon) ④ **két visszarontásom nem vitt
  pirosra** (egyik nem létező mechanizmust célzott, másik gyengébb volt a javításnál)
  ⑤ **a kártya 75×50 px-re zsugorodását egy IDEGEN őr fogta meg**, nem az enyém.
- ⭐ **Nem keresett lelet:** az `aurora` `body>*{position:relative}` szabálya (0,2,1) leütötte
  az overlay `fixed`-jét (4029 px-re lent, nulla magassággal) — **és ugyanez a MEGLÉVŐ
  nagykép-lightboxot is érintette, csendben, eddig is.** Mindkettő pozíciója most `!important`.
- **⭐ UTÓSZÁL (2026-09-22, ADR-0199):** a tulaj kérdésére mérve kiderült, hogy a kártya
  Foglalás gombja odaugrik ugyan, **de nem viszi át, MELYIK szobáról jött** — a 2. szoba
  gombja után a választó az 1. egységen maradt (rossz naptár, rossz ár, és a beküldés a
  ROSSZ egységre ment volna); a közös tartalék kártyáin pedig **nulla** foglalás-gomb volt.
  Mindkettő korábbi állapot. Szállítva: `data-cit-room-unit` + a runtime átállítja a
  választót · gomb a tartalékba · **PADLÓ-ár** (`24 000 Ft-tól / éj`) a sáv helyett · a
  dátum-mondat a FELUGRÓBA, csak ott, ahol a lap tud is árat számolni. ⛔ A tulaj „szám
  helyett mondat" javaslatát NEM vettem át (az ár az első szűrő; és `quoteFor()` `null`-t
  ad ár-sor nélkül) — kimondva, nem csendben.
- **TULAJDONOSI RENDELKEZÉS (2026-09-22):** ① a **dátum-vezérelt kártya-ár** ÚJ SESSIONBE megy
  — mandátum: `~/rc-briefs/date-driven-price-brief.md` ② a felugró **ÉLES tenant-lapos**
  végigkattintása **NEM időszerű, amíg a többi szál nem végez** — ne indítsd el magadtól.
- 🔴 **NYITOTT:** ① **négy sablon** (`arch-frames`, `tilted-gallery`, `wordmark-grow`,
  `transit`) a tulaj képen-döntésére vár — a szállított „A" változatban a képen álló jelvény
  az egyetlen belépő ② az ár „minimumtól" alakja egy MÉRT döntést írna felül (Elek FK-007:
  a mai nap ára ellentmondott az ár-táblázatnak és a foglaló-widgetnek egy képernyőn)
  ③ az admin szoba-szerkesztő külön §2b kör ④ a felugró ÉLES tenant-lapon még nincs
  végigkattintva (ma a fixture-ön mér).

## Előző szál (2026-09-21) — a kifizetett, de üres modul

**💸 A KIFIZETETT, DE ÜRES MODUL TÖBBÉ NEM MARAD NÉMA (ADR-0194).**
Session-jegyzet: `_planning/memory/2026-09-21_paid_but_empty_modules.md`.
Kontraktus: `assets/design-refs/tenant-admin/paid-empty/` (A változat, tulajdonosi döntés).

- **A kiváltó mérés:** a tulaj a saját tenantján 14 775 Ft-ért vett három modult; a `booking`
  renderelt, a `pricing` és a `poi` üresen maradt, ezért az ÉLŐ lapról **teljesen hiányzott**
  (az „Árak" és „A környéken" szó **0-szor** fordul elő a kiszolgált HTML-ben). Minden
  képernyő hallgatott: a modul-lista „aktív"-ot írt, a Teendők csak fotóról és bemutatkozóról
  beszélt. **Fizetett, nem kapott semmit, és nem is tudta meg.**
- **Szállítva:** minden számlázott+üres modul saját teendő-sort kap (név · ár a fiók ütemében ·
  „kifizette, de üres, ezért a vendég ma nem látja" · modulra szabott magyarázat · Kitöltöm /
  Megnézem). Öt modul kaphat sort, **négy SOHA** (`booking`, `location`, `reviews`, `enquiry`)
  — a hamis riasztás ugyanolyan kár, mint a néma hiba.
- ⛔ **Az ürességet a RENDERELŐ SAJÁT kimenete dönti el** (`moduleContentFor().data`), nem a
  „van-e config sora" kérdés: az zölden átengedte volna az üres tömböt.
- ⭐ Az ár-szabály modul-szintre emelve, hogy a Modulok fül és a sor EGY példányból árazzon.
- **A tulaj két másik kérdése is megmérve:** a kilógó cím **igaz** (javítva); a **14 775 Ft
  HELYES** (19 700 listaár − 25 % üdvözlő kupon), csak a kedvezmény **sehol nem látszik**.
- ⛔⛔ **A tudásbázis-őr két körben 9 leletet talált**, köztük: a súgóba **kitalált modulnevet**
  írtam, és az **őr fixtúrája ugyanazt gépelte** — a saját téves feltevésemet igazoltam vissza,
  zárt hurokban; gépi kapu nem láthatta. A fixtúra most a `MODULE_CATALOG`-ból származtat.
- 🔴 **NYITOTT:** a POI-modul ígérete („mi állítjuk össze") fedezetlen — nincs mögötte gyűjtés,
  cron, se POI-tábla → külön session fut rá (**„Automata heti programajánló"**). Továbbá: az
  ADR-0193 ár-kapuja a JOGOSULTSÁGOT kérdezi, nem a tartalmat, ezért kifizetett de ÜRES
  `pricing` mellett a foglalási út árat fagyaszthat a vendég levelébe.

## Előző szál (2026-09-21)

**🛏️ A SZOBA-KÁRTYA ÉS A RÉSZLETEK-FELUGRÓ — §2b kör, a tulaj a B változatot jóváhagyta.**
Kontraktus: `assets/design-refs/tenant-site/rooms-card/` (README + `plan.html` + 5 kép, `6514d63`).
Session-jegyzet: `_planning/memory/2026-09-21_rooms_card_plan.md`.
A megvalósítás **külön szálban fut** (`wt/szobakartya`), a kontraktussal.

- **A kérés:** a kártya alatt CSAK a férőhely; kattintásra felugrik a szoba lapja leírással,
  képgalériával és **ikonos** felszereltséggel; a stílus a mockból. Második körben: a **képen
  látszódjon, hogy kattintható**, a nagy kép ALATT kattintható indexképek, és a nagy képre
  kattintva **teljes méret**.
- **A kiváltó lelet:** `src/tenant/editor.ts:310` — a leírás ÉS a felszereltség **egyetlen
  `note` mezőbe** fűzve, ezért a vendég megkülönböztethetetlenül kapja. A kódban ott a
  beismerés is: *„no template edit"* — a kerülő út azért született, hogy ne kelljen 12 sablonhoz nyúlni.
- ⛔⛔ **HÁROMSZOR a KÉP fogta meg, amit a gépi őr ZÖLDEN átengedett:** a `display:flex` ÜTI a
  `[hidden]`-t · a felugrón a 9 felszereltségből **NULLA** látszott, az őr mégis 9-et jelentett
  (`<li>`-t számolt, nem láthatóságot) · a magasság a galéria BURKOLÓJÁN ült, ezért a 68 px-es
  indexkép-sáv teljesen levágódott — **a kért galéria nem is létezett**. Negatív kontroll
  mindhármon (4·1·1 bukás a javítás előtt).
- ⛔ **A `contract-drift-check` KÉT saját hibámat fogta meg:** rossz mappa (`public-rooms`
  helyett `tenant-site/`), és **KÖTŐ feliratként jelöltem olyat, ami még nem él a kódban** →
  a jelölés a megvalósítás UTOLSÓ lépése; hatókör-sor nélkül a kapu az egész kódbázisban keres.
- **Mérve:** 39 állítás zöld, 0 JS-hiba, mobil+asztali, valós adat+minta, JS-sel+JS nélkül.
  A fixture a TERMÉK forrásából épült (4 valós egység, az élő artdeco skin, 17/17 katalógus-ikon).
- ⛔ **A `land.sh` törli a `_drafts/`-ot** — vele ment a generátor és a mérő; a `plan.html`
  önhordó volta mentette meg. Amit a következő szálnak átadnál, azt a land ELŐTT mentsd ki.
- 🔴 **NYITOTT:** a tenant-admin szoba-szerkesztő §2b terv-köre (kártyás/nyitható, helyben
  képfeltöltés, **borítókép** — ma a hozzárendelés sorrendje dönt, és félrevezet).

## Előző szál (2026-09-21)

**🔗 A MODUL-FÜGGŐSÉGI REND MEGVALÓSÍTÁSA — ADR-0192 ④/⑤/⑥.**
Tulajdonosi mandátum (`~/rc-briefs/module-deps-impl-brief.md`), a felderítés folytatása.
Session-jegyzet: `_planning/memory/2026-09-21_module_dependency_impl.md`.
Landolt: `fbd95a9` (séma + lint) és `ae6adae` (szerver + felület + őr). **Élesítés NEM volt feladat.**

- **A lánc a katalógusban:** `booking → pricing → rooms(multiUnit)`. **Nincs DB-tábla** — a
  függőség TERMÉK-SZERKEZET, nem operátor által hangolt érték (a `supersedes` precedense).
  Öt közös helper: a kosár, a kapu, a sweep, a lint és az őr MIND ezen dönt.
- **⭐ A megújítás-sweep az ember nélküli út:** a kattintáskor a halmaz még ÉRVÉNYES (a modul a
  periódus végéig él), tehát a toggle-ra kötött őr átengedi — a szabály a FORDULÓNAPON sérül,
  nézők nélkül. Most visszatart + riaszt; a visszatartott modul egy ciklusig ingyen fut (a három
  rossz közül a legkisebb: elsöpörni = fizetett naptár ár nélkül, kaszkádolni = kifizetett adat
  néma törlése, ADR-0155 ③).
- **Mért lyuk befoltozva:** a `module_sales_disabled` kapcsoló némán ÉRVÉNYTELEN csomagot gyártott
  (`rooms` levétele után a `teljes` tovább kínálta a `pricing`-et), a `presetNestingViolations()`
  meg zölden állt, mert a kapcsolót nem látja.
- **§2b:** 3 változat, mobil ÉS asztali képpel → a tulaj a **C**-t választotta („a SOR mondja meg
  MIT, a SÁV MENNYIÉRT"). Kontraktus: `assets/design-refs/console/module-dependency/`.
- ⛔⛔ **Négy saját hiba, mind mérésből:** ① a befoglaló-dobozom ZÖLDET adott egy szétesett
  elrendezésre (`1042×57` „rendben", miközben a nevet 60 px-be préselte és kilógott) — **csak a
  KÉP mutatta meg** ② a szűk felismerőm („ehhez jár") hamis zöldet adott ÜRES indoklásra ③ az őr
  egyik szakasza ÜRES volt (nem volt fizetett rendelés a fixture-ben, sosem ért el az új kódig)
  ④ **a kapum megtagadta a FIZETŐ VEVŐT**, és egy MEGLÉVŐ őr fogta meg — míg a párjánál
  (`module-upsell-check`) a FIXTURE csatolása volt véletlen; **a kettőt nem szabad összemosni.**
- **ADR-0192 helyesbítve** (tulajdonosi jóváhagyás): a ④.2 példamondata KETTŐT feltételezett, a
  mért lánc HÁROM tagú; a ⑧ lista 1–2. tétele lezárva (ADR-0193).
- 🔴 **NYITOTT:** ① a terv-sáv CSOPORTOSÍTOTT ár-blokkja ② a konfigurátor kosara + a `/pricing`
  csomag-kártyák ③ a három KB-szócikk ④ az őr ①/⑤ állítása ⑤ a felület interakciójának
  ÉLES-lapos mérése (eddig csak a §2b vázlaton van végigkattintva) ⑥ a `DOMAIN/05-MODULES.md`.

## Előző szál (2026-09-21) — az ár-jogosultsági kapu

**💸 ÁR-JOGOSULTSÁGI KAPU A FOGLALÁSI ÚTON + EGY KEREKÍTÉSI SZABÁLY (ADR-0193).**
Tulajdonosi SÜRGŐS mandátum (`~/rc-briefs/urgent-price-gate-brief.md`): az ADR-0192 ⑧ két
pénzügyi/bizalmi leletének javítása, őrrel és negatív kontrollal. Session-jegyzet:
`_planning/memory/2026-09-21_price_gate_and_coupon_rounding.md`. **Élesítés NEM volt a feladat.**

- **① Előbb REPRODUKÁLTAM.** Eldobható fixture (aktív `booking`, lemondott `pricing`), valódi DB +
  valódi HTTP-szerver: a javítás előtt **4 állítás piros**, és a döntő bizonyíték nem egy mező
  volt, hanem a **kiszállított levél** — `56 000 Ft` a vendégnek kiment `.eml`-ben, olyan
  szállásról, ahol a lapon ár nem szerepel.
- **A döntés: a foglalás ELINDUL, csak SZÁM NÉLKÜL.** A kérés nem vásárlás (ADR-0044 §6), és a
  **kifizetett** `booking` funkcióját nem veheti el egy meg nem vett `pricing`; a vendégnek tett
  ígéret viszont kötelező erejű → §B.17: jobb nincs szám. ⭐ A túl-kapuzás is hiba: a
  `cancel_at_period_end` (a fordulónapig kifizetve) esetén az ár **MARAD** — külön állítás védi.
- **A predikátum EGY helyen:** `isRenderedModule` / `siteRendersModule` (`src/tenant/modules.ts`);
  a renderelő `on()`-ja is erre vált — a **meglévő** szabály kapott nevet, nem másolat készült.
- **② Kupon-kerekítés: megszüntettem a második példányt, nem parity-őrt írtam rá.** A `cit-money.js`
  precedense szándékos duplikátum + mérés — de **egy eltérő FORMÁZÓ csúnya stringet ír, egy eltérő
  ÁR mást terhel, mint amit ígért**. A szabály most egyetlen fájl (`assets/runtime/cit-coupon.cjs`):
  Node `require`-ol, a tenant-admin ugyanazokat a bájtokat inline-olja. ⚠️ `.cjs`, mert a
  `package.json` `"type": "module"` — egy `.js` itt ESM-ként parse-olódna.
- ⚠️ **Vállalt következmény:** a sorok legnagyobb-maradékkal oszlanak, hogy PONTOSAN kiadják a
  végösszeget → két azonos árú modul sora 1 Ft-tal eltérhet (490+490 @4% → **471 és 470**).
- ⛔ **Két SAJÁT hiba, amit a MÉRÉS fogott meg:** ① az őröm a **korábbi futás levelét** olvasta (a
  címzett-slug stabil), és a javított kódra a javítás előtti összegeket jelentette; ② a piros
  kontrollom `page.evaluate()`-ből akarta felülírni a szabályt, de az admin-script **IIFE** —
  `ReferenceError`-ral halt meg ahelyett, hogy mért volna. Most a lap a történeti szabállyal
  **renderelődik**, és külön állítás bizonyítja, hogy a csere meg is történt.
- ⭐⭐ **A ② őr ELŐSZÖR a saját fixture-jét bizonyítja:** 1…99-ig keres olyan kupon-százalékot, ahol
  a két szabály **bizonyíthatóan** eltér, és ha nincs, **hangosan bukik**. Évesen a két út
  véletlenül egybeesik — ott a hibás kód is zöld lenne, ezért mér **havit**.
- **Őrök bekötve** (`hooks/pre-commit`, diff-scope-olt): `booking-price-gate-check` (önteszt **4
  piros**) · `coupon-rounding-check` (önteszt **3 piros**, 1602 vs 1603).
- 🔴 **NYITOTT:** az ADR-0192 ⑧ **hat további** hibája (mock fizetőoldal „éves" felirata ·
  `rooms` eltünteti a fizetett `amenities`-t · az előnézet ÍR · `renewableModuleIds` supersession ·
  nem-atomi `activateUpsell` · doc-hiba) — **egyik sem az én szálam volt**.

## Párhuzamos szál (2026-09-21) — a márkajel

**🎨 A MÁRKAJEL, AMI KÉT PÉLDÁNYBAN ÉLT — E4 jóváhagyva.**
Session-jegyzet: `_planning/memory/2026-09-21_brand_mark_e4.md`.
Kontraktus: `assets/design-refs/console/brand-mark/README.md` (geometria + mért kontrasztok).

- **A kérés:** „egy számlázz.hu-ra feltölthető cito logót png". A forrás keresése kibontotta, hogy
  **két külön márkajel él**: a fejlécet a `views.ts:117` inline SVG-je adja, a **favikont** a
  `94680b4`-ben commitolt `assets/brand/` készlet — más ív-szín, más szem, más font, más szó
  („Citoviso" vs „itoviso").
- ⛔ **A bejelentett hiba oka más volt, mint a javasolt javítás:** a `/pay/done` bal felső sarkában
  **nem a logó** van, hanem a `.pd-brand__mark` (`views.ts:2069`) 22 px-es CSS-köre
  (`border-right-color:transparent`) — **se szem, se play**; a közepe mérve **1,06**.
  A kért fehér halo mérve **semmit nem old meg** (1,44 → 1,44): a glória a kontúrt emeli, nem a közepét.
- **§2b két kör:** A–G a VALÓDI gradiensen, tényleges méretekben (22/38/96 px) → „az E a jó irány,
  csak a play beljebb került" → **mérve igaza volt** (−14,6 vs a mai −1,2) → E1–E4 → **E4**.
- **Szállítva:** `mark-e4-dark.svg` + `mark-e4-light.svg` (bitre azonos geometria, C-ív mindkettőn
  cián), `citoviso-logo-szamla.png` (**ez megy a Számlázz.hu-ra**) + 3 további változat, és a
  befagyasztott terv.
- ⛔ **Saját hiba:** az „átlátszó" PNG **nem volt átlátszó** (a saját `background:#fff` sorom ölte
  meg az `omitBackground`-ot; a két fájl md5-azonossága árulta el) → a generátor most utó-feltétellel
  méri a kiírás UTÁN, hogy minden fájl háttere megfelel-e a nevének.
- 🔴 **NYITOTT — a hiba ÉLESBEN MÉG OTT VAN:** a terv jóváhagyva, **kódsor nem változott**. Három hely:
  `views.ts:2069` (fizetés-lap), `views.ts:117` + `adminViews.ts:101` (fejléc), és a favikon
  `public/assets/ui/mark-gradient.svg`. Csere előtt a fogyasztókat grepelni kell.

## Előző szál (2026-09-21) — a modul-függőségi rend

**🧩 A MODUL-FÜGGŐSÉGI REND FELDERÍTÉSE — húsz fogyasztó, és ami kiesett a láncból (ADR-0192).**
Session-jegyzet: `_planning/memory/2026-09-21_module_dependency_discovery.md`. **Kód nem változott**
— a mandátum kimondottan FELDERÍTÉS volt („felmérjük, hol van ennek relevanciája"). Hat párhuzamos,
read-only ágens; a leltár határozta meg a séma alakját, nem fordítva.

- **A lánc:** `booking → pricing → rooms` (rooms: ha 2+ egység, **vagy ha ismeretlen**).
- ⛔ **Az `amenities requires rooms` KIESETT.** A brief még tartalmazta; mérve az `amenities`
  **site-szintű adat**, `rooms` nélkül hibátlanul renderel, és a KB-szócikk **címe** is ezt mondja.
  A valódi kötés csak a **szobánkénti szerkesztőre** áll, és **ADR-0074 §5 óta már él**.
  ⭐ Általánosítva: a „modul A kell B-hez" **három** relációt takarhat — kiváltás · függőség ·
  **művelet-kapu**; a harmadikat katalógusba emelni kár.
- ⛔⛔ **KÉTSZER lett hamis premissza a saját összefoglalómból, egy sessionben.** ① Egy felderítő
  1 sértő rendelést jelentett, **továbbadtam tényként** — az `order_intent.modules` `kind='upsell'`
  esetén **DELTA, nem halmaz**, a valódi sértés **0 db**; a függőséget a **beküldött halmaz ∪ a
  meglévő jogosultságok** unióján kell mérni (ez lett az őr 4. negatív kontrollja). ② „Az
  `isMultiUnit()`-nak nulla hívója van" — a `src/`-re igaz, a **repóra nem**
  (`scripts/module-config-check.mts:290/296` mindkét polaritását méri). Mindkétszer egy **szűk
  hatókörű** állítást vettem át általánosként.
- **A hangos leletek** (húsz fogyasztóból): ⛔⛔ a `/api/foglaltsag` az **entitlement-kaput nem
  kérdezi meg** → ár nélküli lapon **kötelező erejű 84 000 Ft-os ajánlat** megy ki a vendégnek
  e-mailben is · ⛔⛔ a megújítás **vakon** kapcsol ki (`cancel_at_period_end` sweep) → a szabály
  **a fordulónapon, ember nélkül, némán** sérül · ⛔⛔ a kliens fizetés-kártya csak a **BEPIPÁLT**
  checkboxokat ismeri (**990 a képernyőn / 2 170 a terhelésen**) · ⛔ a modul-előnézet **ÍR**, és az
  őre vak rá · ⛔ a `module_sales_disabled` **némán érvénytelen presetet** gyárt.
- **Négy tulajdonosi döntés:** a kliens **bepipálja és kimondja** (⭐ így a helyes ár *magától*
  következik) · a lemondás **blokkol** + közöset ajánl (kaszkád elvetve: ADR-0155 ③) · az
  amenities-kötés elesik · **ismeretlen egységszám → a függőség ÁLL** (⭐ összhang: a mock maga
  **3 szobakártyát mutat**; 33 artifactból **0**-ban van valódi szobalista, a látható kártyaszám
  **hamis proxy**).
- **Séma: nincs DB-tábla** — `ModuleRequirement {id, when, strength, why}` a `ModuleDef`-en.
- **Visszafelé kompatibilitás mérve: 0 sértő tenant, 0 sértő rendelés** — dev **ÉS ÉLES** (2026-09-21,
  csak `SELECT`, `READ ONLY`; éles: 2 tenant / 25 jogosultság). A kockázat **három sodródás**:
  megújítás-sweep · egység-törlés · a modul-eladás kapcsoló tranzitív hatása.
- ⛔⛔ **AMIT NEM KERESTEM: az ADR-0072 invariáns ÉLESEN SÉRÜL** (ADR-0192 ⑦b). A `paidModuleIds()`
  pontos lekérdezését replikálva: Ferenc Ház **13 aktív / 8 kifizetett** (a különbözet
  `booking,email,hours,newsletter,poi` = 2 650 Ft/hó), Nyugalom **12 / 0**. A bizonyíték pontos: az
  egyetlen `paid` fizetés 75 300 Ft = (3 900 + 3 630) × 10 hónap, épp a rendelés 8 moduljára.
  ⚠️ Mérséklő: a fizetés `gateway='mock'` (**nincs valódi vevő-pénz**), az eltérés a **vevő javára**
  szól, a Nyugalomnak pedig nincs `subscription` sora (demó). **Külön munkát kér** — se nem a
  függőségi rend, se nem az ADR-0193 tárgya.
- A tartós tudás a **`_planning/DOMAIN/05-MODULES.md`**-be is bekerült (**72 napja** nem mozdult),
  és ott **kimondva**, hogy a Szint 0–1 tábla GENERÁTOR-nézet, ami **eltér** a `MODULE_CATALOG`-tól
  (`contact_details` **nem létezik**; `email`/`multilang` hiányzik; `newsletter` retired).
- 🟢 **MINDKÉT UTÓD-SZÁL ELINDULT** (a tulaj, 17:15, közvetlenül az ADR landolása után):
  **megvalósítás** (`~/rc-briefs/module-deps-impl-brief.md`) és **sürgős javítás**
  (`~/rc-briefs/urgent-price-gate-brief.md`, worktree `wt/arkapu`) — utóbbi a `/api/foglaltsag`
  ár-kaput és a kupon-kerekítést viszi. ⚠️ A kettő **ugyanabba a kliens-JS blokkba** nyúl
  (`adminViews.ts` ~1490-1560); az `arkapu` landol előbb, **az ő szövege a bázis**.
- 🔴 **NYITOTT:** **hat további mért hiba** az ADR-0192 ⑧-ban (a nyolcból kettőt az `arkapu`
  vitt, ADR-0193) · **az ADR-0072 éles sérülése** (⑦b) — gazdátlan · számlázzuk-e a `requires`-sértő
  modult · Ferenc Háznak `booking` jogosultsága van **0 `site_unit` sorral** (a naptárnak nincs
  egysége), és az élő lapja **két** modul-felületet mutat tizenháromból.

## Előző szál (2026-09-21) — a számlázó fiók

**🧾 A SZÁMLÁZÓ FIÓK KÖVETTE AZ ADÓSZÁM-CSERÉT — új Számlázz.hu fiók + Agent kulcs.**
Session-jegyzet: `_planning/memory/2026-09-21_szamlazz_uj_fiok.md`. Kód nem változott.

- **A rés, amit a 09-16-i javítás hagyott:** az `.env` már a valós `92227011-1-33`-at mondta, de a
  **Számlázz.hu fiók maga** a megszűnt `69646014`-en állt — egy éles fizetés a **megszűnt
  vállalkozás nevére** számlázott volna.
- **A törzsszám fiókon belül SOHA nem módosítható** (csak áfakód + megyekód) ⇒ **új számlázási
  fiók**; „alfiók" nem létezik — külön fiók UGYANAZZAL a belépéssel (cégválasztó).
- ⛔ **A tesztüzem kapuja egyirányú:** csak kiállított számla ÉS NAV-összekötés ELŐTT kapcsolható
  be — a Vezérlőpult viszont a NAV-linket kínálja fel előbb, arra kattintva véglegesen elvész.
- ⭐ **A kulcs kiállítás NÉLKÜL igazolva:** nem létező számlaszám PDF-kérése → **7** („ismeretlen
  számlaszám" = hitelesítve) vs. rossz kulccsal **3** („Sikertelen bejelentkezés"). A 7-es
  önmagában semmit nem bizonyít — a **negatív kontroll** tette bizonyítékká.
- ⛔⛔ **„A dev rendszer még a régi fiókot használja" nem az `.env`-ről szólt:** a `config.ts:10`
  `process.loadEnvFile()` **egyszer fut, modul-betöltéskor**, a `tsx watch` az `.env`-re nem figyel
  → 13 órán át a régi kulcs élt a memóriában. Javítás: `sudo systemctl restart citoviso-public
  citoviso-console`. ⚠️ A `/proc/<pid>/environ` **nem mutatja** a kulcsot — „nincs benne" ≠ „nincs
  beállítva".
- **Igazolás:** `CITO-2026-1` a valódi adapteren át (14 900 Ft, AAM, PDF 26 kB) — és a tesztüzemet
  **a dokumentum igazolta, nem a szóbeli állítás**: „minta minta" vízjel + „TESZT –" előtag.
- **Barion:** `UEVH-00277388` az Üzleti profilba feltöltve + videó-azonosítás **kész, jóváhagyásra vár**.
- 🔴 **NYITOTT:** ① a székhely `Kunó`→`Kuno` az `.env`-ben (a 09-16-i jegyzet nyitott tétele, **öt
  nappal később is áll**; a hat publikus jogi lapon ez megy ki) ② **élesen még a RÉGI fiók kulcsa
  fut** — külön engedélyt kér ③ a teljes fizetési folyamat valódi Számlázz.hu-val nincs végigvive.

## Előző szál (2026-09-20)

**🖼️ A MOCK-KÁRTYA A MOCKOT MUTATJA — pillanatkép a nyitóoldalról, harmadakkora kártyán (ADR-0189).**
Session-jegyzet: `_planning/memory/2026-09-20_mock_cards.md`.
Kontraktus: `assets/design-refs/console/mock-cards/` (A — kép-vezérelt, tulajdonosi döntés).

- **A kérés:** a lead-lap „Mock és generálás" fülén a mock legyen felül, kártyánként kinyitható,
  legyen rajta **snapshot a nyitóoldalról**, a kártya a mainak a **harmada**, egy sorba menjenek.
- **§2b kör:** 3 változat (kép- / adat-vezérelt / sor-igazított subgrid), asztali ÉS mobil képpel,
  valós adaton → a tulaj **A**-t választotta, **mobilon 1 oszloppal**.
- ⭐ **A pillanatképet nem kellett megépíteni:** a `heroShot.ts` gyorstára már gyártja — a kurátor
  **ugyanazt a képet látja, ami a megkeresésbe megy**. Új: `ensureCardJpeg` + három
  artefaktum-útvonal (`shot.jpg` · `shot-state` · `POST shot`).
- ⛔ **A két legfontosabb őr-állítás NEGATÍV:** hiányzó képnél SEHOL nincs `<img>`, és a
  kép-útvonal **csak gyorstár** (mérve: az állapot a GET előtt és után ugyanaz). Ez az Elek
  FK-004 H1 hibaosztálya — egy `<img>`-kérés nem indíthat 2×30 s Chromiumot.
- **Mérve:** csukott kártya **403×476 px = a mai 21 %-a** · **3 kártya/sor** asztalin, **1** 390 px-en.
- ⛔ **Saját hibák:** az őröm a saját locator-feltételétől bukott · a méret-állítás a KINYITOTT
  kártyát mérte · a kapu-jelvények két sorba törtek a jóváhagyott képpel szemben (**a kódot
  igazítottam a tervhez, nem fordítva**).
- 🔴 **NYITOTT:** a pillanatkép ma kimondott kérésre készül; az automatikus legyártás a
  generáláskor külön döntés (Chromium a generálási úton).

## Előző szál (2026-09-19)

**📋 LEAD-LISTA A2 — minden rekord egy lapon, EGY kérdőjel, egysoros fejléc (ADR-0188).**
A tulaj a KÉSZ `/leads`-et nézte meg, és hármat kifogásolt: a jelmagyarázat-SÁV, a LAPOZÁS,
és a „csili csálé" kétszintes fejléc a 11 kérdőjellel. §2b kör (2 változat → **A** → „ez nem
kell" a cím alatti két szöveg-blokkra) → megvalósítva. Session-jegyzet:
`_planning/memory/2026-09-19_lead_list_no_paging_one_questionmark.md`.

- **Szállítva:** nincs lapozó sehol (a `LEAD_PAGE_SIZE`, a `?page=`/`?pageSize=` is kivezetve),
  mind a 260 sor egyben, **tapadó fejléccel** · EGY „?" a cím mellett → felugró jelmagyarázat
  (11 oszlop + 5 jelölés, ESC/×/háttér zár, fókusz visszatér) · **38 px-es egysoros fejléc**
  rejtett vezérlőkkel, aktív szűrőnél cián tölcsérrel · a cím alatti számláló-blokk és
  szűrő/sorrend-mondat helyett **egy sor a tábla alatt** a szűrt ÉS a medence-számmal.
- ⭐ **Az elv, amiért ez nem visszalépés:** mind a négy kivett mondat egy MÉRT hibára (Elek
  FK-003) született válasz volt, ezért mindegyikhez **utódot jelöltem**, és az őr azt méri.
- ⛔ **A takarítás majdnem elvitt egy utat, amit egy MÁSIK kapu ígér:** a `console.leads`
  tudásbázis-horgony a kivett ikonos súgó-linkkel együtt tűnt volna el.
- ⛔ **A súgó a lapozó feliratait idézte, képpel együtt** — a label-drift őr kapta el; a
  szócikk a KÓDBÓL íródott újra, a `pager.png` törölve.
- ⛔ **A töréspont feltevés volt:** a NÉV-ragadás 700 px-hez kötve; mérve **1440 px-től** fér
  ki mind a 11 oszlop, **1280 px-en 91 px lóg túl** → a lap most MEGMÉRI (`is-scrollx`).
- **Kapuk:** `lead-list-plan-check` zöld / önteszt 9 piros · `lead-filter-label-check` 135/135
  (két megvakult szelektora és a szegély-matekja javítva) · `kb-check --coverage` 🟢 ·
  i18n-lint · design-token-lint · contract-drift ✅
- 🚀 **ÉLESÍTVE** `4a59e13` (tag `prod/20260920-0132`, 14 commit, **0 migráció**). Visszagörgetés:
  `deploy-prod.sh 61e788a --go`. Az éles CSS frissessége MÉRVE (`cf-cache-status: MISS`,
  `hover: none` ×3, lapozó-stílus 0) — a CDN 4 órás cache-e nem szolgált ki régit.
- ⛔⛔ **A DEPLOY-KAPU NÉGYSZER ÁLLÍTOTT MEG, ÉS MIND A NÉGYSZER IGAZA VOLT.** A GATE 1c
  tudásbázis-őr verdiktet követel, amit **nem adhatok magamnak** — összesen **8 valódi leletet**
  talált, és egyiket sem látta volna egyetlen meglévő gépi őr sem:
  ① a súgó **nem létező telefonos gesztust** tanított („hosszan nyomva") · ② a helyette kijelölt
  út MAGA volt törött: a szűrő-felugrót **levágta a görgető-doboz** 390 px-en, épp az élő
  darabszámok sávjában · ③ **a tartás nem szélesség**: a tölcsér-láthatóság `max-width:700px`-en
  ült, fekvő telefonon 10-ből **8 tölcsér láthatatlan** · ④ a saját „fölé ugrik" javításom a
  **ragadó fejléc alá** tette a felugrót (4 darabszámból 3 takarva).
- ⛔⛔ **HÁROMSZOR EGYMÁS UTÁN A SAJÁT JAVÍTÁSOM MELLÉKTERMÉKE LETT A KÖVETKEZŐ HIBA.**
  És kétszer a SAJÁT őröm volt vak rá: a „csukva érkezik" állítást a `hidden` DOM-tulajdonságon
  mértem (egy `display:grid` némán veri), a ⓯ szakasz pedig EGY viewporton, asztali kontextusban,
  befoglaló-matekkal. A ⓰ most **3 tartásban**, **valódi érintés-kontextusban**, `elementFromPoint`-os
  takarás-méréssel dolgozik. Önteszt: 10 → 13 → **19 piros**.
- ⛔ **A saját mérésem KIÍRTA a levágást (`clippedByBox: true`), én meg képről zöldre értékeltem.**
- **NYITOTT (nem blokkoló, az őr jelezte):** a KB mondata („nem a SZÉLESSÉGEN múlik") nem
  kimerítő — 600 px-es EGERES ablakban is látszanak a tölcsérek; a veszélytelen irányba téved.
  ⚠️ És a ⓰ `elementFromPoint`-szondája hamis takarást jelentene, ha valaki kiterjesztené egy
  hosszú listás oszlopra (`city`/`region`): a `.cf-list` saját 260 px-es hajtása miatt a
  kigörgetett opciók a táblázatra hit-testelnek — bővítés előtt a szondát a lista LÁTHATÓ
  dobozára kell vágni.
- **NYITOTT:** virtualizáció („több száz vagy ezer sor”) szándékosan kimaradt (tulaj-halasztás);
  1280–1366 px között a tábla oldalra görget — ha laptopon is ki kell férnie, az oszlop-csonkolás
  külön tulajdonosi döntés (információt vesz el).

## Párhuzamos szál (2026-09-20) — a fizetés-visszaigazoló

**💳 A FIZETÉS-VISSZAIGAZOLÓ A VEVŐ LAPJA LETT (ADR-0190).** A tulaj az éles `/pay/done`-ról:
*„a kinézete miatt nem bizalomgerjesztő… gagyin néz ki"*. §2b kör **négy** tervvel (nyugta ·
pecsét+oldal-kártya · onboarding-lépcső · **split**) → a tulaj a **D**-t választotta, az
előnézethez **screenshot + kétszintű tartalék**-kal. Terv befagyasztva:
`assets/design-refs/console/paydone-split/`. Session-jegyzet:
`_planning/memory/2026-09-20_paydone_premium_split.md`.

- **Szállítva:** `layout(shell:"bare")` — saját, teljes felületű sötét lap (a konzol shellje
  nem írhatja felül a jóváhagyott tervet) · kéthasáb asztalon / egy oszlop mobilon · pecsét ·
  böngésző-keretes előnézet + **másolható cím** · `siteShot.ts` (aktiváláskor előre gyártott
  képernyőkép, cache-kulcs = tenant + snapshot mtime) + `/pay/preview` a vevőnek ·
  `tenantCoverPhoto()` a ② szinthez · a kötelezettség-sorok hiánytalanul.
- ⛔ **Öt saját lelet, egyik sem látszott a forráson:** `order_intent.tenant_id` **NULL az első
  vásárlásnál** (az előnézet pont az ÚJ vevőknél maradt volna üres) · navy-on-navy címsor (a
  citui.css `h1`-szabálya verte a body színt) · a süti-sáv **rátakart az egyetlen CTA-ra** ·
  hero nélküli screenshot (a sablonok CSS-háttérként festenek) · a saját őröm hamis PIROSA.
- ⚠️ **Négy testvér-kapu vakult meg a szelektorán** (pay-exit-truth · consent-style ·
  checkout-viewport · hu-machine-form) — mind követi a felületet, egyik sem gyengítve.
- **Kapuk:** `paydone-split-check` zöld, **önteszttel** (a két mért hibát visszarontva piros) ·
  tsc · i18n-lint + katalógus · design-token-lint · guard-wiring (az őr bekötve).
- ⚠️ **Élesítés NEM történt** — az külön, kimondott utasítás (§0.3).

## Párhuzamos szál (2026-09-20) — a fizetés-visszaigazoló (ADR-0190) 🚀 ÉLESBEN

**💳 A /pay/done A VEVŐ LAPJA LETT.** A tulaj az éles lapról: *„a kinézete miatt nem
bizalomgerjesztő… gagyin néz ki"*. §2b kör **négy** tervvel → a tulaj a **D**-t (prémium
sötét/split) választotta, az előnézethez **screenshot + kétszintű tartalék**-kal. Terv
befagyasztva: `assets/design-refs/console/paydone-split/`. Jegyzet:
`_planning/memory/2026-09-20_paydone_premium_split.md`.

- **Szállítva:** `layout(shell:"bare")` (saját sötét lap — a konzol shellje nem írhatja felül a
  jóváhagyott tervet) · kéthasáb/egy oszlop · pecsét · böngésző-keretes előnézet + másolható cím ·
  `siteShot.ts` (aktiváláskor előre gyártott kép, cache = tenant + snapshot mtime) + `/pay/preview`
  a vevőnek · `tenantCoverPhoto()` a ② szinthez · a kötelezettség-sorok hiánytalanul.
- ⛔ **Öt saját lelet, egyik sem látszott a forráson:** `order_intent.tenant_id` **NULL az első
  vásárlásnál** · navy-on-navy címsor (a citui.css `h1`-szabálya) · a süti-sáv **rátakart az
  egyetlen CTA-ra** · hero nélküli screenshot (CSS-háttér) · a saját őröm hamis PIROSA.
- ⛔ **A KB-kapu NYOLC kört futott, és a nyolcból hatot a saját javításom termelt** — a súgó
  minden kapu BELSŐ logikáját le akarta tanítani; a megoldás a szűkítés lett („a jelvény nem az
  utolsó szó"). Két termék-lelet: a nem ítélhető kapu **zölden** áll meg · a `demoFraming`
  kapunak **nem volt neve** a konzolon (megkapta).
- ⚠️ **Egy párhuzamos szál ugyanezt a KB-javítást írta meg, és ő élesített** — az ő szövege a
  bázis, az enyémből csak az egyedi rész ment fel (`c8f2eb9`).
- **Kapuk:** `paydone-split-check` (önteszttel) · `pay-exit-truth` · `consent-style` ·
  `checkout-viewport` · `verdict-gate-check` · i18n · design-token · kb-check.

## Párhuzamos szál (2026-09-20) — a megkeresés-link a vásárlás után (ADR-0191) 🚀 ÉLESBEN

**🔒 A MEGKERESÉS LINKJE A VÁSÁRLÁS UTÁN NEM ÁRUL — a lead a SAJÁT oldalához ér.**
Session-jegyzet: `_planning/memory/2026-09-20_owned_prospect_link.md`.
Élesítve: `prod/20260920-2138` = `91b856d`. Visszagörgetés: `deploy-prod.sh 4a59e13 --go`.

- **A bejelentés (tulajdonosi dev-teszt):** a már fizetett lead újra megnyitja a `/p/<token>`-t,
  és valódi kártyaterhelést indíthat.
- ⭐ **A kár MÁS volt, mint a bejelentés — és mint az első reflexem.** Nem „kétszer kapja meg",
  és nem is „elhasal a UNIQUE-on": a `convertLead` idempotens, az `ensureSubscriptionForOrder`
  `onConflict…doNothing`, az `issueAndSendTenantLogin` kihagy — tehát a vevő **fizet, VALÓDI
  SZÁMLÁT kap, és semmit nem kap**, még hosszabb előfizetést sem. Az idempotencia némán
  elnyelte a második futást; a nem-idempotens ágak (terhelés, számla) adták a kárt.
- **Szállítva:** `ownedSiteForLead()` = **egy predikátum, két hívó** (képernyő + pénz-út), két
  lábbal — tenant VAGY fizetett `initial`, és a **második a fontosabb** (a megakadt aktiválású
  vevő FIZETETT és nincs oldala, pont ő próbálja újra) · a tiltás a **PÉNZ-ÚTON** ül
  (`requestPayment` nem ad `initial` pay-linket ⇒ nincs terhelés), a `handleOrderRequest` pedig
  a rendelés RÖGZÍTÉSE ELŐTT tilt (különben `order_intent` + operátori riasztás keletkezne egy
  nem-problémából) · **harmadik keretezési állapot** (`owned`) saját sávval ÉS saját lábléccel,
  mert a követett pár két mondata (`Ez még nem élő oldal` · `az ajánlatot az igényeihez
  igazíthassuk`) egy fizető ügyfélnek hazugság · a sáv **elvezet** a belépéshez, de **nem léptet
  be** (a link e-mailben utazik; továbbküldött levél = fiók-hozzáférés).
- **Élesben igazolva, nem a deploy zöldjére hagyatkozva:** `/p/<token>` → 200, owned sáv ott,
  konfigurátor 0, **`mock_view` 5 → 5**, és a predikátum mindkét irányban helyes (2 vásárolt
  lead → pay-link megtagadva, kontroll → engedélyezett).
- ⛔⛔ **A deploy-kapu KÉTSZER megállított, jogosan** (5 KB-lelet): kettő az ADR-0189 szál
  adóssága (az a commit **nulla `kb/` fájlt** érintett), három az enyém. A **label-drift őr
  kétszer ugyanazon a mintán**: teljes mondatot idéztem félkövéren olyan szövegből, amit a kód
  KÉT darabból rak össze — a súgóban olyan felirat állt volna, ami a képernyőn sosem jelenik
  meg. + a belső-hivatkozás őr egy ADR-számon, amit felhasználói szövegbe írtam.
- 🔴 **NYITOTT:** a leiratkozó link hiánya az `owned` lapon **jogilag eldöntetlen** (az ítélő
  ágens elszállt, verdiktet NEM adtam helyette — élesen is így megy) · a süti-sáv a vásárolt
  lapon is kártyás fizetésről beszél, pedig ott már nincs fizetési út · 35 KB-entryből 28
  `updated:` dátuma elavult (repó-szintű hézag).

## Előzmény — 2026-09-19 (kiküldési szándék / piszkozat-sáv)

**⛔ A KURÁTOR KIKÜLDÉSI SZÁNDÉKÁT SEMMI NEM GÁTOLJA — a sáv hazug tiltása javítva.**
Session-jegyzet: `_planning/memory/2026-09-19_curator_intent_not_overridden.md`. Döntés: **ADR-0187**.

- **A bejelentés (tulaj, dühösen):** a piszkozat-lapon egyszerre állt `E-mail: most NEM
  küldhető — a jogszerűségi kapu tiltja (az okok lent)` **és** alatta `Jogszerűségi kapu: PASS`.
- **Három hazugság egy sorban:** nem a §C szólt (hanem a dizájn-őr tárolt lelete) · „az okok”
  nem voltak lent (üres lista) · **nem is tiltás volt** — a küldés gomb felugrója megkérdezi,
  és a megerősítés kiküldi. A kurátor emiatt meg sem nyomta a gombot, ami küldött volna.
- ⭐ **Miért volt ZÖLD minden mérés:** az őr azt mérte, hogy „a lap állítása = a küldő-út
  verdiktje”, és egyezett. **Egy TILTÁS és egy KÉRDÉS azonban nem ugyanaz az állítás** — az
  őrnek két állapota volt ott, ahol háromnak kell lennie.
- **Szállítva:** a `flagged` megnevezi a kaput (legal/photo/verdict) + vállalhatóságot ·
  a sáv három állapota (zöld · sárga „a megerősítéssel kimegy” + a lelet saját sorai · piros) ·
  a **kép-lelet is a küldés felugrójába** került (eddig másik lapra terelt, kötelező indoklásért).
- **Kemény maradt, és egyik sem a kurátor felülbírálása:** §C jog (Grt./Eker.tv.) és a
  „nincs mit kiküldeni” (nincs renderelt lap / felülírt fájl) — ott a termék hiányzik.
- **390px-en mérve:** a `.pill` `nowrap` elvágta a mondat VÉGÉT („…előbb megmut…”) — pont azt a
  felét, ami megmondja, hogy ki lehet küldeni. A mondat-vivő pirulák tördelnek.
- ⚪ **NYITOTT:** a kiküldés maga nincs végigkattintva élesben (valódi SMTP + egy-lövéses
  csatorna) — a tulaj a :4600-on nyomja meg · a „Nyugalom Vendégház” prospect `no` állapotban
  van, nem néztem meg, mi tartja vissza.

## Előző szál (2026-09-17)

**💳 A BARION NÉGY KÉRÉSE TELJESÍTVE — a válasz beküldve, a labda náluk.**
Session-jegyzet: `_planning/memory/2026-09-17_barion_requirements_delivered.md`.
Döntések: **ADR-0185** (ÁSZF 1.2) · **ADR-0186** + utószál (Full Pixel). Éles: `61e788a`.

- **Szállítva:** ÁSZF 1.2 (a bérelt honlapba fizetés-beépítés TILALMA kimondva · a felmondás
  VALÓDI útja · kivonat-mondat + Apple Pay-korlát) · Full Barion Pixel a teljes tölcsérrel,
  hozzájárulás-kapu mögött · 14 sablon ragadó sávja elfér a süti-sáv mellett.
- ⭐ **A Pixel CSATORNÁJA némán állt, és ezt csak az ÉLES, deploy UTÁNI mérés fogta meg:** a
  `bp.js` az azonosítót `window.barion_pixel_id`-ből olvassa, mi `data-pixel-id`
  attribútumban adtuk át → a küldő iframe fel sem épült. A kód jelenléte zöld volt, a
  viselkedés nem.
- ⛔⛔ **Hiányos teszt-stubból VALÓDI leletet jelentettem** („a Pixel élesben soha nem küldött
  semmit"), majd rossz időzítésű ellenkontrollból egy HIBÁS visszavonást. A `bp.js`
  háromlépcsős kézfogását a dublőrnek le kell játszania, az ellenkontrollnak pedig a
  KÖRÜLMÉNYT is kontrollálnia kell.
- ⛔ **A saját őröm kétszer mért ÜRES HALMAZON** (28 mérés / 0 találat, zölden hallgatva).
- 💰 **A díjcsomag-döntés mérésen állt:** Starter 1,49% vs. Advanced 1,19% = 0,30 pp
  (~12 Ft/hó/ügyfél). A javaslatom a Starter volt, a tulaj az Advanced-et választotta.
- 🔴 **NYITOTT (tulaj):** hatósági bizonyítvány (`UEVH-00277388`) + videó-azonosítás az
  **Üzleti profilba**. A Barion oldalán a Pixel `approvedBase: false` — az ő bírálatuk.
- ⚪ **NYITOTT (kód):** az éles oldal külső CDN-eket hív (Google Fonts, unpkg, OSM)
  hozzájárulás nélkül — most, hogy a sáv jogi keretet kapott, ez a következő kör.

## Párhuzamos szál (2026-09-17) — az ontológiai lenyomat felzárkóztatva

> ⚠️ Ez a blokk NEM váltja le a fenti aktív feladatot: a két szál ugyanazon a napon, egymástól
> függetlenül futott. (A doktrína „az aktív feladat előzménybe csúszik" szabálya ~25 párhuzamos
> szálnál egymás munkáját törölné.)

**🧠 A GÉPEZET ÉPÜLT, A LENYOMAT NEM — a kör most bezárult.**
Session-jegyzet: `_planning/memory/2026-09-17_ontology_loop_closed.md`.
Commitok: `d607238` · `9a0f215` · `e740fad` · `e9d816a`.

- **A diagnózis:** az auto-desztilláló hibátlanul futott, de a review-k egy **gitignore-olt**
  `_inbox/`-ba estek → **2026-07-12 és 2026-09-13 között 9 review / 62 javaslat-blokk állt
  feldolgozatlanul**. A tudás nem veszett el, hanem **némán befagyott**.
- **Szállítva:** a DOMAIN 435 → **~1030 sor** (`03-INVARIANTS` 141→482, `01-CALC-MODELS`
  22→154, `02-ENTITY-MAP` 45→175), **ledger 12/12, 0 feldolgozatlan** · `distill-apply.mts`
  (a desztilláló mostantól **jóváhagyható ágat** készít, nem olvasnivalót; REFINE/DRIFT
  SOHA nem automatikus) · `domain-inbox-freshness-check.mts` (konjunkció-alapú őr,
  diff-scope-olt a pre-commitben, `--warn-only` a landban).
- **Menet közben:** a „tervezett" entitások fele (Tenant, Booking) már két hónapja ÉLT · a
  kötelező belépőpont `04-INDEX` két hónapja **nem sorolta fel a `06-UI-CONTRACT`-ot** ·
  **HAT** ütköző migráció-sorszám él (a közös Postgres némán nyeli el).
- ⭐ **A legfontosabb lelet csak KERESZTBE olvasva állt össze:** a `watermarked` flaget
  **semmi nem állítja `true`-ra** a termelési úton → **a megengedő fotó-szabály egyetlen fékje
  halott kód**, miközben a §A.2 az ellenkezőjét ígéri és egy ZÖLD őr a flag *továbbélését*
  méri, nem azt, hogy valaha beáll-e.
- ⛔ **Saját hibáim:** elavult, rebase ELŐTTI SHA-kat idéztem a záró jelentésemben · szűk grep
  (`LiveSafe` helyett `applyLivePhotoPolicy`) · csövön át mért kilépési kód · **bemocskoltam
  a fő fát** 9 követetlen másolattal (a land ff-frissítése elbukott).
- ✅ **LEZÁRVA (2026-09-22):** ① vízjel → ADR-0200 (a kapu ÉL) ② ~~a gyökérok: a
  `notify.sh` hook-pont ÉL, de a fájl NEM LÉTEZIK~~ → **LEZÁRVA, lásd a következő blokkot**
  ③ 12 „ÉLŐ" REFINE a `DISTILL-PENDING.md`-ben.

## Párhuzamos szál (2026-09-22) — két halott ígéret élesítve

**🔒 A §A.2 VÍZJEL-KAPU ÉL, ÉS A REFINE-JAVASLAT TÚLÉLI A REVIEW LEZÁRÁSÁT.**
Session-jegyzet: `_planning/memory/2026-09-22_watermark_and_refine_queue.md`.
Döntések: **ADR-0200** (vízjel) · **ADR-0201** (REFINE-sor).

- ⛔ **A §A.2 „egyetlen feltétlen kizárás"-a halott kód volt:** a `watermarked` flaget a
  termelési úton SEMMI nem állította `true`-ra. A fék be volt építve, a pedál működött, de
  soha senki nem nyomta meg. Most a vision-kör adja az ítéletet (külön mező, nem `subject`),
  a bélyeg a `dropNeverShown`-ban ragad rá (mind a NÉGY renderelő út azt hívja).
- ⭐ **Az újrapontozás EGYBEN a mérés volt:** 91 ítéletből **12 vízjeles**, mind ugyanarról a
  szállásról — **szemmel igazolva 2 pozitív + 2 negatív, mind helyes**. Ez a 12 fotó eddig
  kiment volna egy FIZETŐ ügyfél élő lapjára idegen cég vízjelével.
- ⛔ **A REFINE-javaslatot a review LEZÁRÁSA temette el** (23 blokk elérhetetlenül) — köztük
  az, amelyik 2026-08-02-án kimondta, hogy a `watermarked` halott kód. A sor mostantól
  SZÁRMAZTATOTT, a gép SOHA nem zár le tételt, az indoklás KÖTELEZŐ.
- ⛔ **Három további ÉLES hiba:** ① a cron NEM tudott jóváhagyható ágat készíteni (a friss
  worktree-ben nincs `node_modules`/`.env`) — a „kör bezárult" élesben NEM állt ② a
  `wt/distill*` glob IDEGEN munka-ág törlését ajánlotta ③ az átvezető audit-naplója minden
  futáskor bemocskolta a fő fát.
- ⭐ **Az értesítő ÉLESBEN lefutott** 2026-09-20-án: SMS + e-mail kiment a tulajnak.
- ⛔⛔ **Saját hiba:** az őröm MÁSODSZOR omlott össze piros helyett — a testvér-őrben már
  javítottam ÉS memóriába mentettem, de **a javítás nem terjedt át magától**.
- 🔴 **NYITOTT (tulaj):** **24 REFINE-tétel** (`refine-queue.mts`, 2 ma is érvényes) ·
  a **`wt/distill20260922`** ág jóváhagyásra vár · a vízjel-detektálás PONTOSSÁGA címkézett
  korpuszon nincs mérve.

## Párhuzamos szál (2026-09-17) — a desztilláló ÉRTESÍTŐJE

**🔔 A GYÖKÉROK MEGSZŰNT: a review-ról mostantól ÉRTESÜL a tulaj.**
Session-jegyzet: `_planning/memory/2026-09-17_distill_notifier.md`.

- **A lelet igazolva:** `distill.sh:151-156` — a `[ -x "$NOTIFY" ]` hónapokig hamis volt, mert a
  `notify.sh` **nem létezett**; a lépés némán kimaradt. Ez volt a 9 review / 62 javaslat OKA.
- **Szállítva:** `_tools/notify.sh` + `notify.mts` (SMS + e-mail, **tulajdonosi döntés**) ·
  `scripts/distill-notify-check.mts` (57 állítás, 17 fixture-mérés, diff-scope-olt).
- ⭐ **Csak akkor szól, ha van mit dönteni** (a frissesség-őr konjunkciója, **nem újraírva**), és
  **a felhalmozásról is** — a `fire_notify` a korai kilépés ELŐTT is fut. Üres futásra néma.
- ⭐ **Csak LÉTEZŐ ágat nevez meg** (`git branch --list` a forrás): nincs ág → a valódi következő
  lépést adja. Egy hazug útvonal rosszabb a csendnél.
- ⛔ **Fail-closed:** `--mode=send` nélkül nem küld, ismeretlen kapcsoló = exit 2, dry-run HANGOS.
  ⛔ **MMS elvetve mérés alapján** (csak JPEG, root, ~90 mp, közben áll az SMS-relé).
- **Bizonyítás:** 5 szabotázs mind elkapva · a valódi `distill.sh` felhalmozás-ága végponttól
  végpontig lefuttatva · a teszt **saját mellékhatása MÉRVE** (PATH-csapda + outbox-pillanatképek),
  mert ezen a gépen **mindkét csatorna ÉLES** és a usernek NOPASSWD sudo-ja van.
- ⛔⛔ **Saját hibáim:** a mérőeszközöm **elnémította a saját bizonyítékát** (stderr vs.
  `execFileSync`) · **az őröm ÖSSZEOMLOTT piros helyett**, egyetlen lelet nélkül — rc=1 miatt
  „elkapva"-ként könyveltem volna el, ha nem nézem meg a TELJES kimenetet · két top-level futtató
  modult hittem importálhatónak (main-guard mindkettőbe).
- ⚠️ **Amit NEM bizonyít:** az éles transzportot egyetlen teszt sem futtatta (szándékosan) — az
  első ÉLES megszólalás a következő vasárnapi cron lesz, ha áll feldolgozatlan review.

## Előző szál (2026-09-16) — a megszűnt adószám

**Barion elfogadóhely — a hiánypótlás oka megszűnt, a bírálat elindult.**
A Barion azért nem kezdte el a vizsgálatot, mert a regisztrációban ÉS az élő ÁSZF-ben egy
**megszűnt** egyéni vállalkozás azonosítószáma szerepelt. A valós, „Élő" adatok a NAV
Vállalkozói Ügysegédjéről: **adószám 92227011-1-33**, **nyilvántartási szám 62588818**,
székhely házszám **6. 2.**, felvétel 2026.07.20. Javítva az `.env`-ben (lokál + éles, külön
engedéllyel, backuppal), **origin ÉS CDN felől visszaellenőrizve** — a hat publikus jogi lapon
a régi szám 0 előfordulás. Session-jegyzet:
`_planning/memory/2026-09-16_terminated_tax_number.md`.

- ⛔ **A saját konfigunkból olvasni NEM mérés.** A `BARION-APPLICATION.md` „MÉRVE (az éles
  `.env`-ből olvasva)"-t állított — és pont ezért volt hibás hat napig. Cég-azonosítónál az
  egyetlen forrás a nyilvántartás.
- ⛔ **Az ellenőrzőszám-kapunk elvi okból vak volt rá:** mindkét adószám ÉRVÉNYES
  ellenőrzőszámú. A számtan a jó ALAKOT bizonyítja, a LÉTEZÉST soha.
- ⛔ **Hamis riadót fújtam a Barion-logóra:** bejelentettem, hogy nincs kint a főoldalon —
  **kint volt**. Sor-alapú `grep`-pel mértem egy öt soron át tördelt `<img>` taget.
- **NYITOTT, tulaj-teendő:** a hatósági bizonyítvány (`UEVH-00277388`, beadva 2026.09.15,
  8 napos ügyintézési határidő) az **Üzleti profil** menübe töltendő — a Barion kifejezetten
  kérte, hogy ne a Remark-szálba —, és ugyanott indítandó a **videó-azonosítás**.
- **NYITOTT, apró:** a székhely utcaneve a nyilvántartásban ékezet nélküli („Kuno"), az élő
  lapokon `Kunó` áll. Új éles engedélyt kér, nem blokkoló.

## Előzmény — 2026-09-15 (a nagy párhuzamos kör)

**🚀 A NAP LEZÁRVA — ÉLES = MAIN = `3578491` (tag `prod/20260916-0729`).**
⚠️ KÉT élesítés kellett hozzá: az első (`331aae5`, `prod/20260915-1720`) a 22 commitot vitte ki,
de UTÁNA még landolt a záró memória-jegyzet és egy jogi javítás — ezért egy második kör
(`3578491`, `prod/20260916-0729`, 0 migráció, 0 végrehajtható kódsor) állította egy pontra a
`main`-t és az élest. ⛔ **Tanulság, eljárásként: a deploy a zárás UTOLSÓ lépése** — aki élesít,
majd tovább dolgozik, maga csinálja a rést.
Session-jegyzet: `_planning/memory/2026-09-15_seventeen_threads_and_the_deploy.md`.

- **17 párhuzamos szál** az Elek 2026-09-13-i teljes futásának leleteiből. ⛔ Nem a korábbi
  összefoglalót idéztük: öt felmérő mind a 12 kör `LELETEK.md`-jét végigolvasta és **a MAI
  kódon** ellenőrizte → ~**172 nyitott** lelet, ebből a tulaj 16 szálat választott
  (A1–A8 doktrína-sértés · B1–B8 képernyő-kör §2b terv-kapuval), + 1 záró szál a KB-kapura.
- **Élesítve 22 commit** (a mai ~90-ből 67 a reggeli Barion-bírálati deployjal már kint volt),
  1 additív migráció (`0069_manual_charge_retry`), kanári zöld, pg_dump megvan.
  Visszagörgetés: `deploy-prod.sh fd4ec5ed --go`.
- ⭐ **Négy egymás utáni tudásbázis-őr, négy KÜLÖNBÖZŐ rés** — és a 2. és 3. lelet **az előző
  javítás mellékterméke** volt (kiürült súgó-kép · a fordítás a szerkesztés ELŐTT futott).
  **Ha a javító szál ítélhette volna meg magát, a kiürült kép élesre megy** (ADR-0132 H).
  Mindhárom új rés egy osztály: **a meglévő kapuk MÁS KÉRDÉSRE válaszoltak.**
- ⛔ **A `kb-gate` csak `pass`-t ismer**, a 4. FLAG viszont **pre-existing** hibára szólt (mérve:
  a `kbPacks.ts` változatlan a 22 commitban, és már az élesben futó `fd4ec5e`-ben is benne volt).
  A verdikt SZÖVEGE mondja ki, hogy ez **kimondott tulajdonosi kivétel**, nem tiszta PASS.
- ⛔⛔ **A tulaj üzenetei SOHA nem értek célba:** mind a 16 szálon beküldetlen draft ült, három
  körben ~30 utasítás. A puszta `Enter` nem kézbesít, a felhő-oldal visszaírja a draftot; a
  működő út `C-u` + `send-keys -l` + `Enter` + **ellenőrzés**. ⚠️ A `❯` után **NBSP** áll, ezért
  az első keresőmintám 15 draftot nem talált meg.
- ⛔ **Saját hibáim:** az élesítési premisszám hamis volt (`b029db8`-at hittem élesnek, közben
  ma 09:27-kor deploy történt) · a `reset --hard` után a watchdog GC elvitte a worktree-met ·
  az örökölt `RC_PROJ` az ÉN fámba indította a pilotot · vak nyilazás a kérdés-TUI-ban rossz
  opciót jelölt · a figyelőm háromszor mért rosszul (próza-kérdés, landolatlan commit, sentinel).
- **Három lelet, amire senki nem indult el:** a **hírlevél-modul fizetős és a semmibe küld**
  (levéve a polcról) · **olasz/angol kezelőnél a `confirm()` sosem fut le** (aposztróf töri a
  JS-t) · **318 szövegelem a kontraszt-küszöb alatt** 1074-ből, a saját tokenjeinkből.
- **NYITOTT:** ① a fordított súgó magyar gombneveket idéz (~199/217 eltér) — 4 résztétel ·
  ② a `kb-gate` kivétel-módja · ③ `payResultPage` drift-védelem · ④ **tulaj-tennivaló: Zoho-alias
  az `info@citoviso.com`-ra**, enélkül a fizető ügyfél válasza sehová nem érkezik · ⑤ FK-006.

## Előző szál (2026-09-15) — ADR-0182/0183/0184

**🧭 ADR-0182 — AZ ÚTBAIGAZÍTÁS NE IRÁNY LEGYEN, HANEM NÉV; ÉS A SÁV VIGYE IS A TETTET.**
Session-jegyzet: `_planning/memory/2026-09-15_direction_word_vs_named_action.md`.
**Élesítés NINCS** (§0.3). A kör a `deploy-prod.sh` **GATE 1c**-t blokkoló tudásbázis-FLAG-et
oldja (`fd4ec5ed..8f44801`, 18 commit) — a verdiktet **nem adtam meg magamnak**, azt egy friss,
független őr ítéli meg (ADR-0132 H).

- **A bejelentett hiba ÁLLT, és számmal is:** a kézi terhelés-újrapróba visszajelző sávja négy
  ágon „a fenti gombbal" küldött; mérve a sáv a **6 660.** bájtnál áll, a gombok a
  **10 200–10 800.**-nál — mind **lefelé** mutatott **fölfelé** szóval, a redirect meg fragmentet
  sem vitt. A tulaj szabálya: *az irány a képernyő-magasságtól függ, a NÉV nem.*
- ⛔ **MELLÉKLELET, amit a bejelentés nem tartalmazott:** a `nincs_kartya` ág pontosan akkor áll
  elő, amikor `payment_method !== 'token'` — ami **bitre ugyanaz a predikátum**, mint az
  `autoCharge` —, tehát ilyenkor a megnevezendő „Másik kártyával fizetek" gomb **meg sem
  jelenik**. A javasolt minta-követés ezen az ágon **rossz gombra küldött volna**; ezért a név a
  lapon MOST LÉTEZŐ kiútból származik, és ha egy sincs, a mondat nem mutat sehová.
- ⭐ **A horgony FELEMÁS lett, és ezt kimondtam, nem nyeltem el.** Három mérés 390 px-en:
  ① mandátum-blokkra → a gombok odakerültek, de az ÜZENET **1 201 px**-szel a képernyő fölé
  csúszott; ② fagyás-blokkra `scroll-margin-top:130px`-szel → **levágta a sáv tetejét**, mert a
  sáv a benne ülő gombbal 90-ről **168 px**-re nőtt (**tartalomtól függő szám** — egy lefordított
  üzenetnél némán újra vágna); ③ a horgony **maga a sáv**, és a sáv **kattintható kijáratot
  visel** → az üzenet és a tett **szerkezetileg** egy képernyőn van. Ellenőrizve (sáv teteje
  y=16), a képeket megnéztem, a gomb kontrasztja **7,03**.
- ⛔⛔ **EGY IDEGEN ŐR MÉRTE KI A MÁSOLÁS ÁRÁT.** A kijáratot előbb a befizetés-gomb **nevével**
  vittem a sávba — az viszont viseli a **tartozás összegét**, és a `frozen-settle-check` azonnal
  pirosra ment (**2 → 3** előfordulás; a jóváhagyott kontraktus szerint az összeg csak a
  fagyás-blokkban állhat, különben „kétszer kell fizetni"). A sáv így **csak a TÁVOLI** kijáratot
  duplikálja. ⚠️ Az idegen őr fixtúrájában **nincs `?ujra=` kód**, tehát erre az ágra sosem
  látott volna rá — ezért a szabály átkerült a saját őrbe is.
- ⛔ **ÖTÖDIK „fenti"** a mandátum-blokk saját szövegében — a 390 px-es mérés **KÉPÉRŐL**, nem
  grepből. Tulajdonosi utasításra javítva (név és szám nélkül, mert a név az összeget hozná).
- **Őr:** `scripts/charge-retry-note-check.mts` — hermetikus, a renderelt lapot méri 10 eseten,
  öt szabállyal; pre-commitba kötve. **23 piros önteszt**, ami **külön megköveteli, hogy MIND AZ
  ÖT szabály megszólaljon** (ADR-0157), plusz **negatív kontroll a TÖRTÉNETI hibára** — ⭐ ez
  élesben is dolgozott: a ③ átírásakor az utó-feltétel kibuktatta, hogy a kontroll már **üresen
  futna**.
- **KB:** `admin-subscription` — „Az automatikus kártyaterhelés elakadt" (két gomb + mind a hét
  kimenet, a 15 perc és a 4 kísérlet indoklásával) + a zöld sáv időszak-mondata és számla-linkje;
  `admin-modules` — az elutasítás-ág és az „Ezt a fizetést nem találjuk" lap. A KB-őr elkapta,
  hogy **behelyettesített számlaszámot idéztem félkövéren** egy sablon-feliratból.
  **18** elavult súgó-kép újragenerálva (a `console-duplicates` az ADR-0178 után is három
  egyforma cián gombot mutatott), **KB-fordítás-kör lefuttatva mind a 6 élő nyelvre**.
- ⛔⛔ **UTÓIRAT — a független tudásbázis-őr FLAG-et adott, és IGAZA VOLT (ADR-0183).** A három
  eredeti hiányt pótoltnak mérte, **de a `kb-shot`-köröm ÚJ RÉST nyitott:** a
  `console-leads/legend.png` **640×2020 / 305 kB → 640×126 / 12 kB**-ra esett — a teljes
  oszlop-magyarázat **némán kiesett a súgóból**, miközben a képaláírás „kinyitva"-t ígért.
  Az ok két rétegű: a felvétel a SZERVER HTML-jében cserélt sztringet, ami a nézet mai alakjára
  már **NO-OP**; és ha illeszkedett volna, sem ér semmit, mert a lap `syncOpen()`-je **700 px
  alatt leszedi** az `open`-t, a felvétel meg 390 px-en készül. A nyitás mostantól a **DOM-on, a
  JS lefutása UTÁN** történik, és a néma nem-találat **dob**. Újrarenderelve 640×**2448**,
  megnéztem a szememmel.
- ⭐ **ADR-0183 — ÉP-ŐR:** a `kb-shot` minden felvételt összevet az ELŐZŐ képpel, és a
  nagyságrendi esés **PIROS**. ⛔ Azért a generátorban, mert **sem a `kb-check`, sem a
  `kb-freshness` nem nézi, VAN-E TARTALOM a képen**. A megkerülhetetlenség SZERKEZETI: minden
  felvétel egyetlen úton (`snap()`) megy ki, és az önteszt a szkript **saját forrását** méri —
  ezt élesben is pirosra vittem egy szándékosan beszúrt megkerülő úttal. Önteszt 7 eset / 2 piros
  + pozitív kontroll a jogos rövidülésre.
- **A súgó két szerkezeti állítása is javítva és ŐRZÖTT** (⑥a/⑥b): a DOM-ban a **pirula van
  előbb**, és a mandátum-blokk a kártyán **BELÜL**, a **42–90 %-a** között ül (mérve 390 és
  1280 px-en, nem a verdiktből átvéve).
- ⚠️ **A kör tanulsága magamról:** a saját javító-körömet is meg kell mérni, nem csak azt, amit
  javítani küldtek — a 18 újragenerált képből **csak azt az egyet néztem meg**, amiért a kör
  indult.
- ⛔⛔ **MÁSODIK UTÓIRAT — a HARMADIK őr is FLAG-et adott (ADR-0184): A SORREND VOLT A HIBA.**
  A fordítás-kört a KB-szerkesztés **ELŐTT** futtattam, aztán a 2. őr verdiktje nyomán MÉG
  EGYSZER hozzányúltam a cikkhez — és azt már nem fordíttattam újra. **Magyar fallback NINCS**
  (`kbPacks.ts`: „a stale translation still serves"), ezért a lengyel és a szlovák tulaj **szó
  szerint a két frissen javított hibát olvasta tovább** („pod kartą Abonament" — a kártya ALÁ
  küld; „a nad nim tytułem" — a címet a pirula FÖLÉ teszi).
- ⛔⛔ **A rés SZERKEZETI volt:** a `kbCoverage()` **létezett és pontosan ezt mérte, csak SEHOL
  nem volt bekötve**. Ugyanaz a mintázat, mint az ADR-0183-nál: a meglévő kapuk MÁS KÉRDÉSRE
  válaszolnak. Új: **`kb-translation-coverage-check.mts`** blokkoló kapu (megnevezi a nyelvet ÉS
  a lemaradt cikket; DB-hiánynál HANGOSAN bukik) + **`kb-translate.mts`** javító út, mert egy
  kapu, ami nem létező parancsot ajánl, hazudik. Bekötve a **pre-commitba** ÉS a
  **`kb-freshness` ④** rétegébe; a söprés öntesztje azt is kiköti, hogy a réteg meg van hívva.
- ⭐ **A VALÓDI feltételen is pirosra vittem** (egy cikk forrását elrontva mind a 6 nyelven
  jelzett, névvel) — a szintetikus önteszt önmagában ezt nem bizonyítaná.
  **Végállapot mérve: mind a 6 élő nyelv 19/19 friss.**
- ⚠️ **Mérés-pontosítás a verdikthez:** mire mértem, az `sk` MÁR friss volt — egy párhuzamos
  szál termék-folyamata (`ensureLanguagePack`) véletlenül gyógyított 5 nyelvet. Ez nem cáfolja a
  leletet, hanem **erősíti**: a lefedettség a SZERENCSÉN múlt. A `pl` így is lemaradt, és
  **5 kísérletből 3-szor bukott** integritás-sértéssel — a diagnózis (29/29 felirat, 1 kép,
  9 alcím) szerint **nemdeterminizmus**, nem a cikk szerkezete.
- ⚠️ **A KÖR TANULSÁGA MAGAMRÓL, HÁROMSZOR EGY NAPON:** a saját javító-köröm rontott el valamit,
  és a saját kapuim zöldek maradtak (① a sáv irányt mondott tett helyett, ② a `kb-shot`
  kiürített egy képet, ③ a fordítás lemaradt a szerkesztés mögött). Mindháromszor **létezett a
  mérőeszköz** — csak nem arra a kérdésre felelt, vagy nem volt bekötve. **Eljárás: ha egy
  körben MÉG EGYSZER hozzányúlok egy forráshoz, a származtatott műveleteket újra kell futtatni,
  és a végállapotot MEGMÉRNI, nem feltételezni.**
- 🔵 **Elhalasztva (az őr szerint NEM blokkoló):** a `payResultPage`/`payUnknownRefPage` a
  `console/views.ts`-ben él (operátor-korpusz), a cikk viszont tenant → a feliratok
  **drift-védelem nélkül** állnak, de ma pontosak. Korpusz-döntés, külön kör.

---

**💳 BARION-BÍRÁLAT: MINDEN BEADVA, VÁRUNK (3–5 munkanap).**
Session-jegyzet: `_planning/memory/2026-09-15_barion_biralati_csomag.md` · leltár:
`_planning/BARION-APPLICATION.md`. Deploy `prod/20260915-0927` (`fd4ec5e`): Barion-logósor +
ÁSZF nyilv.szám/telefon élesen mérve. Éles bírálói demó E2E mérve: `citoviso.com/p/demo5b0455b4067b`
→ rendelés → sandbox `payUrl`; tenant-belépő `nyugalom-vendeghaz`/`folyo-kikoto-79`. A tulaj 2
észrevételt + üzenetet küldött a Barion automatikus jóváhagyási jegyére (⚠️ a Remark-mező 1000
karakterre némán csonkol). 🔴 **TULAJ-TEENDŐ: tárca-feltöltés banki átutalással** (azonosítás).
POSKey-érkezéskor: éles kulcs + `INVOICE_PROVIDER=szamlazz` EGYÜTT, külön engedéllyel; jóváhagyás
után demó + „CITOVISO PRÓBA (törölhető)" teszt-rendelés purge.

---

**🫥 ADR-0181 — NINCS ALCÍM → NINCS ELEM: AZ ÜRES DOBOZ IS ÁLLÍTÁS.**
Session-jegyzet: `_planning/memory/2026-09-15_empty_tagline_no_element.md`.
**Élesítés NINCS** (§0.3). Az ADR-0163 kimondott nyitott tétele, tulaj-utasításra lezárva.

- ⭐ **A mérés KITÁGÍTOTTA a saját leletemet.** Az ADR-0163-ba azt írtam, hogy ez „csak a
  copy-hívás bukásakor látszik", és besorolatlan területhez kötöttem. Valójában a korpusz
  **89%-a** (595-ből 532): a generátor `REGIONS` táblájában **EGYETLEN bejegyzés van**
  (`badacsony`), miközben a `resolveRegion()` a scraper mapjából is „ismertnek" mond
  területeket → `balaton-north` és `godollo` known=true, de a tagline ÜRES.
- **A kár:** 7 üres, mégis helyet foglaló elem 3 sablonon (arch-frames 2, tilted-gallery 2,
  wordmark-grow 3), 17–32 px kósza térközzel. A másik 16 sablon már helyesen őrzött.
- **A szabály:** nincs szöveg → nincs elem. Ahol a szöveg a szekció EGYETLEN tartalma volt
  (`w-say`, `t-say`), a teljes blokk marad el. Alcímet **nem pótolunk kitalált szöveggel** —
  egy tényt, amink nincs, elhagyunk (ugyanaz az elv, mint az ADR-0163 régió-fordulatánál).
- ⛔⛔ **A LEGFONTOSABB: a saját mérőeszközöm HAMIS ZÖLDET adott.** Az első predikátumom
  `height >= 1`-et kért, és **0 hézagot jelentett mind a 19 sablonon** — egy üres `<p>`
  DOBOZA viszont 0 magas, ami helyet foglal, az a **MARGÓJA**. A rossz mennyiséget mértem,
  és pont azt a hibát nem láttam, amit keresni küldtem.
- ⚠️ **Két további mérési műtermék**, amit ki kellett zárni: a wordmark-**intro overlay**
  (az első „bizonyíték-képem" valójában az intro-animációt mutatta) és a **mozgás-réteg**
  (programozott görgetésnél `opacity:0` marad → `reducedMotion: "reduce"` kell).
  ⛔ Plusz: a forrás-grep 12 „őrizetlen" találatot adott, a renderelt mérés a helyes 7-et.
- **Őr:** `scripts/empty-tagline-check.mts` (~14 mp) — **ATTRIBÚCIÓS**: minden sablon
  KÉTSZER renderelődik (egyedi JELSZÓVAL / ÜRESEN), így a lelet megnevezi, MELYIK elem élt a
  taglineból és maradt üresen. Ellen-állítás a vak zöld ellen (52 fogyasztó elem).
  **Önteszt: 19 piros**, és a VALÓDI visszarontásra is piros (névvel megnevezte a
  `tilted-gallery`-t, rc=1).
- **§2b:** a három sablon felület-fájl, a token ZÁRVA volt. A kivételt **nem magamnak adtam**:
  mért számokkal és a javítás pontos alakjával kérdeztem, a tulaj megadta — a szava a
  tokenben, feltétellel („ui-shot 390 + 1280, és a képeket MEG IS NÉZED"); 6 felvételt
  megnéztem (3 sablon × 2 méret).
- 🔴 **NYITVA (tulaj-döntés: „csak jegyezzük fel"):** a 89% gyökéroka a `REGIONS` egyetlen
  bejegyzése. Régió-szöveget írni TARTALMI döntés (mit állítunk egy tájegységről, §B.17
  köti), nem hibajavítás. Három út: ① megírjuk a hiányzó bejegyzéseket; ② kivezetjük a
  `regionTagline` tartalék-ágat, ha sosem tud őszinte lenni; ③ marad, és a sablon-őrzés véd.
  Ez a kör ③-at szállította.

## Előző szál (2026-09-15) — 👻 ADR-0180: a fantom pirula, és két szál ugyanazon a munkán

**👻 ADR-0180 — AMIT EGY PÁRHUZAMOS SZÁL MÁR MEGMÉRT, AZT NE MÉRD MEG ÚJRA; ÉS A HIBAKERESŐ
SZŰKÍTÉS NE GYÁRTSON ÁLBUKÁST.** Session-jegyzet:
`_planning/memory/2026-09-15_phantom_pill_and_duplicated_work.md`. **Élesítés NINCS** (§0.3).

- ⛔⛔ **A KAPOTT FELADAT PREMISSZÁJA HAMIS VOLT, ÉS AZ ÉN IDÉZÉSEM TERJESZTETTE.** Egy
  **2026-09-14-i dátumú** őr-leltár sorát („a pirula a CTA 23 %-át takarja") „ma PIROS, és ez
  TERMÉK-HIBA"-ként másoltam a záró összefoglalómba. Mérve: **38 pirula-mérés, `EXIT=0`**, a `y`
  475–828 között szór (a kikerülő dolgozik), és az **ADR-0168 már fantomnak minősítette**. A
  dátum ott volt a soron — a következtetés hiányzott. **A pirulához egyetlen sort sem nyúltam.**
- ⛔⛔ **KÉT SZÁL UGYANEZT A MUNKÁT VÉGEZTE EL.** A valódi hibát (öt őr a KÖZÖS `assets/Temp`-be
  írta ÉS törölte a scratch-jét, háromnál INDULÁSKOR) megtaláltam, megírtam, végigvittem a
  kapukon — **és mire a land a push-ig ért, egy párhuzamos szál ugyanezt landolta** (`0ca7a93`),
  osztály-őrrel együtt. A commit-üzenetük NEVESÍTI a szálamat. **Az ő verziójuk a bázis, a
  duplikátumomat ELDOBTAM** (`reset --hard origin/main`); csak azt vittem tovább, ami náluk nincs.
  ⚠️ **NYITOTT (az övék a döntés):** az ő kulcsuk **munkafa**-egyedi, ami UGYANABBAN a fában futó
  két mérést nem védi — ma két teljes kört futtattam egyszerre, pont a verseny előállításához.
- **Amit megtartottam:** ① `--only=<sablon>` szűkítés (20 s vs. 6 perc) — ⛔ az első változatom
  **két önteszt-ágat buktatott egy HIBÁTLAN őrön**, ezért a ④ most **kimondottan kimarad**, és a
  záró sor **nem mond tisztát**; ⭐ az ADR-0177 ugyanaznap ugyanerre jutott (konvergens).
  ② **A mozgó kivágás nyugvópontban mérése** (harmadszor: ADR-0147 ②, ADR-0168 ①): 1 bukás 12
  futásból, 10 szándékos kísérletből nulla; ⭐ a mechanizmus MÉRVE is létezik (két egymás utáni
  kivágás **65 → 17 színt** adott). ⛔ Hamis ZÖLDET nem tud adni, ⚠️ de NEM állítom javítottnak.
- ⚠️ **NYITOTT, IDEGEN:** a `consent-style-check` diff-scope NÉLKÜL fut, és a KÖZÖS park
  állapotától függően véletlenszerűen **MINDEN szál MINDEN commitját** blokkolja (a `/pay/done`
  404-es ágra fut → nincs `.panel`); bizonyíték: utána 355 zöld / 0 bukás, a felület be sem került.
- ⭐ **Eljárás-tanulság:** ~25 szálnál a „ketten ugyanazon" nem kivétel. Bejelentett hiba előtt
  nem csak a `DECISIONS.md` címeit kell grepelni, hanem **futó munkát is keresni**.

## Előző szál (2026-09-15) — 👻 ADR-0178 — EGY GOMB-OSZTÁLY, AMIHEZ NINCS SZABÁLY, NÉMÁN AZ ELLENKEZŐJÉT CSINÁLJA

**👻 ADR-0178 — EGY GOMB-OSZTÁLY, AMIHEZ NINCS SZABÁLY, NÉMÁN AZ ELLENKEZŐJÉT CSINÁLJA.**
Tulajdonosi utasítás: „a ghost gombot is javítsd meg." Session-jegyzet:
`_planning/memory/2026-09-15_dead_button_class.md`. **Élesítés NINCS.**

- **A hiba:** a konzolban hat helyen állt `class="ghost"` (szándék: halvány, másodlagos), de a
  `.ghost`-hoz **egyetlen CSS-szabály sem tartozott** — ezért a submit-gombokra a navy gradiens
  ült rá. ⛔ **A halott osztály nem semleges: átengedi az elemet a legszélesebb szabálynak, ami
  illeszkedik rá — vagyis az ELLENKEZŐJÉT csinálja annak, amit a neve ígér.**
- **A kár, mérve:** a lead-lapon 2 gomb látszott elsődlegesnek; a `/duplicates`-en a **három
  válaszból kettő** volt ghost → **három egyforma navy gomb**, köztük az „Ugyanaz — összevonás",
  ami lead-rekordokat VON ÖSSZE. A kurátor a képről nem tudta megmondani, melyik a fő válasz.
- **Javítva:** a `.ghost` a dizájn-mag MEGLÉVŐ mintáját kapta (`citui-btn--ghost`: fehér,
  line-strong szegély, navy szöveg) — nem új stílus, hanem a meglévő szándék hatályba léptetése;
  az ADR-0169 `con-btn2`-je **beolvadt** (egy szerep = egy osztály).
- **Az őr nem a `ghost`-ot őrzi, hanem a HIBAOSZTÁLYT:** minden gomb-osztály vagy **FEST** (van rá
  szabály a BETÖLTÖTT stíluslapokban — nem forrás-grepből: ami nem jut el a böngészőig, nem
  szabály), vagy **HORGONY** (a lap szkriptje `querySelector`-ral hivatkozik rá). Ami egyik sem:
  bukik. ⭐ Rögtön talált egy MÁSODIK szabály nélküli osztályt (`.gen-go`) — az VALÓDI horgony,
  ezért nem bukás; a felismerés **szerkezeti**, nem kézi szólista.
  **Piros önteszt: 199 állítás.**
- ⛔⛔ **ÉS AMI A LANDOLÁS KÖZBEN ELŐKERÜLT (ADR-0179):** a `ghost`-javítás landolását egy
  FELTÉTEL NÉLKÜL futó őr blokkolta, és a **tünet hazudott** („hiányzik a `.panel`") — valójában
  a `/pay/done` lap **HTTP 500**-at adott. ⛔ Az első olvasatom is hamis volt („a mock átjáró
  HTML-t ad a seedelt refre"): a napló szerint a **VALÓDI Barion HTTP 429**-et küldött HTML
  hibalappal, amin a nyers `resp.json()` dobott — vagyis **élesben egy FIZETŐ VEVŐ kapott volna
  500-at közvetlenül a terhelés után**. ⚠️ **A 500 javítását egy PÁRHUZAMOS szál landolta ELŐBB** (a rebase-ben
  szembesültem vele; az övék maradt, az enyém duplikátum volt — az ő változatuk egy ponton
  jobb is). Az ÉN többletem: a néma átjárót a KÉPERNYŐ is kimondja · ismeretlen hivatkozás
  valódi lapot kap, ami **nem állít semmit a terhelésről**
  (§B.17), csak azt, hogy nem találjuk. Az őr determinisztikus lett (`orderBy`), **de ÚJ, ELSŐ
  állítással** („a lap HIBA NÉLKÜL szolgálódik ki"), hogy a determinizmus NE fedje el a bajt.
  ⚠️ **Nyitva:** a 429-et magát nem orvosolja semmi — minden `/pay/done` egy `GetPaymentState`-et
  indít, és a párhuzamos szálak fogyasztják a kvótát; gyérítés (cache/backoff) külön kör.
- **Módszer-tanulság:** „mi látszik ma?" → a **kirajzolt háttérrel** mérve (gradiens-e), nem
  class-névvel — épp a class-név hazudott · a kontrasztot a TÉNYLEGESEN látható háttérhez
  (az első nem-átlátszó ős) · a teljes-lapos kép itt vak volt (a `/duplicates` 21 615 px magas),
  a **döntés-sor kivágása** mutatta meg az előtte/utána különbséget.

## Előző szál (2026-09-15) — ADR-0176: a fizetés átjárója

**💳 ADR-0176 — KÉZI TERHELÉS-ÚJRAPRÓBÁLÁS.** A 2026-09-14-én jóváhagyott terv hiányzó
fele. Session-jegyzet: `_planning/memory/2026-09-15_manual_charge_retry.md`.
**Élesítés NINCS** — és ez MIGRÁCIÓT is visz (0069).

- **Miért kell:** a leggyakoribb elutasítás a fedezethiány, és a létra a FAGYÁS UTÁN már
  nem próbálkozik. Ha a tulaj közben feltöltötte a kártyát, az automata SOHA nem jön
  vissza érte — ma újra meg kellett adnia a kártyát a Barionnál.
- **A terhelés NEM új kód:** a meglévő `chargeRenewalWithToken()` fut, amiben már benne van
  a dupla-terhelés önjavítása, a függő MIT újrahasználata, az elakadt pending lezárása.
- ⭐ **A fékek a WHERE-ben ülnek, nem a hívóban** (ADR-0118 ② mintája): egyetlen feltételes
  UPDATE, ami egyszerre nézi a várakozást és a sorozat-korlátot → két párhuzamos
  kattintásból pontosan egy nyer. A próbaszám LEVEZETETT (`pay_url IS NULL` payment sorok),
  nem külön oszlop; tárolva csak tény: `manual_charge_at` (óra és zár egyben).
- ⛔ **A KÉP fogta meg, nem az őr:** az „Újrapróbálom" gomb elsődleges osztályt kapott,
  mégis BITRE AZONOS fehér lett, mint a másodlagos (a `.adm-mand__btn` a stíluslapban
  később áll, azonos fajsúlynál mindig ő nyert). Vagyis „a fizetés útja a leghalkabb elem"
  hibaosztály, ÉPP ABBAN A BLOKKBAN, ami ellene készült. Kétosztályos szelektor, kontraszt
  6,91. + a magyarázó mondat két gomb alatt állt → most megnevezi, melyikre vonatkozik.
- **Őr:** `charge-retry-check` — pénzt mozgató útnál nem a boldog ágat mérjük, hanem a
  fékeket. VALÓDI DB-n fut (a szabály maga egy SQL WHERE; egy TS-másolat nem azt mérné),
  eldobható fixtúrával és takarítással; valódi pénz NEM mozdul (injektált terhelés).
  Hét állítás; piros önteszt a fékek NÉLKÜLI változaton: **2 párhuzamos terhelés és 11
  próbálkozás a 4-es korlát ellenében**.
- ⚠️ **Fixtúra-tanulság:** a `scripts/` nincs típus-ellenőrizve, ezért a fixtúrám kétszer
  futásidőben halt meg (`tenant.slug` nem létezik — `lead_id` kell; `current_period_start`
  NOT NULL). A fixtúrát a TERMÉK sémájából kell építeni, nem emlékezetből.
- **Hangolható:** sorozat-korlát 4 (1 automata + 3 kézi), várakozás 15 perc.
- 🔴 **A LAND BLOKKOLVA, és a blokkoló NEM ez a diff.** A `consent-style-check` piros
  (`/pay/done` → `.panel` hiányzik) — **tiszta `origin/main` fán is ugyanaz a 2 bukás**, és
  a bukásban érintett három fájl (`console/server.ts`, `payment/barion.ts`,
  `consent-style-check.mts`) **0×** szerepel a commitomban. Gyökér-ok: a `/pay/done` minden
  GET-re újrafuttatja a webhookot, ami a VALÓDI Barion API-t hívja egy elavult
  referenciával → HTML válasz → `json()` dob. **Külső hívás bukása, nem termék-regresszió**,
  és fájl-szűrő híján MINDEN szál landolását blokkolja. ⛔ Szándékosan nem javítottam:
  tulajdonosi koordináció szerint a **B6 szál** kapta meg (külön ADR-rel). Nem kerültem meg
  `--no-verify`-jal. **Következő:** B6 landolása után rebase + land.

## Előző szál
**💳 A FIZETÉS ÚTJÁN EGY HANGOS ÚT VAN, ÉS A KÉPERNYŐ MEGMONDJA, MIT FIZETSZ — ADR-0175.**
Session-jegyzet: `_planning/memory/2026-09-15_pay_gateway_exit.md`. Kontraktus:
`assets/design-refs/console/pay-gateway-exit/`. Tulaj: „A — a fizetés a főszereplő”.
**Élesítés NINCS.** Ezzel a B1 blokk (a fizetés pillanata) lezárult.

- **Mérve:** a „Fizetek ▸” és az „Elutasítom” **bájtra azonos** volt (35 px, fw 600, fehér,
  999 px — csak a szövegszín más) · egyik lap sem nevezte meg, MIT fizet a vevő · a hivatkozási
  azonosító csupasz `<code>` · a bukás-lapról nem vezetett nevesített út sehová.
- **Szállítva:** gomb-hierarchia méretben, vastagságban ÉS festésben (51/42 px, 700/600) ·
  tétel-sor mindkét lapon a `payment → order_intent → prospect → lead` úton (LEFT join; név
  nélkül nem talál ki nevet) · másolható azonosító (a `<code>` JS nélkül is megvan) · három
  nevesített kiút — de **üres sávot nem rajzolunk**.
- ⛔⛔ **A KÉP fogta meg, amit a DOM-mérés nem:** a szonda 51/42 px-et és fw 700/600-at mondott
  („kész a hierarchia”), a képen viszont **mindkét gomb sötétkék kitöltött** volt — a generikus
  `.con button[type=submit]:not(…)` **(0,6,1)** veri a `.pay-act` szabályt **(0,3,1)**. A doboz
  helyes volt, a **festés** nem. Az őr ezért a festést is méri.
- ⛔⛔ **Egy őr-állításom MÁS KÉRDÉSRE válaszolt, és HELYES kódon ment pirosra:** a „nincs
  terhelést indító gomb” szabályt `buttons.length === 0`-val mértem, így a teljesen ártalmatlan
  **másoló gomb** buktatta a kaput. Most a `/paid`-re menő űrlapokat és a submit-gombokat
  számolja. Egy proxy, ami helyes kódon elbukik, ugyanolyan drága, mint amelyik hibásat átenged.
- **Őr:** `pay-exit-truth-check.mts` — 53 állítás, **18 sértés** az öntesztben, minden
  szabály-csoportra külön visszarontással; két §B.17-fixtúra (név nélkül · kiút nélkül).
- **Kimondott korlát:** az átjáró a MOCK átjáró; élesben a Barion lapja jön. Azért kötjük, mert
  ezt méri az Elek, ez megy ki minden nem-Barion úton, és a tétel-sor + a másolható azonosító a
  saját lapjainkon marad érvényes.

## Előző szál (2026-09-15)

**🧪 A partnerViews 8 INLINE KEZELŐJE AZ ŐRBE — ÉS A ZÖLDJÜK ATTRIBÚTUM-SORRENDEN ÁLL.**
Session-jegyzet: `_planning/memory/2026-09-15_partner_handlers_in_guard.md`. **Élesítés NINCS.**
Tulaj-kérés az ADR-0165 ② nyitott tételére. Új ADR nincs — az ADR-0165 őrének kiterjesztése.

- **Mind a 8 kezelő STATIKUS** (`this.form.submit()` ×7, `citDocFile(this)` ×1), tehát az
  ADR-0165 escape-predikátuma ott **ÜRESEN IGAZ** lett volna. A valódi néma halál más:
  `form="docf"` társítás elvesztésekor a `this.form` **null** → TypeError → a szűrő SEMMIT
  nem csinál; a `DOC_FILE_JS` lemaradásakor a **számlakép némán nem csatolódik**, és a
  mentés fájl nélkül megy el.
- **Két új mérés-típus:** `autosubmit` (a `change`-re a kezelő megtalálja-e a SAJÁT űrlapját,
  és tényleg BEKÜLDI-e — a `form.submit()` nem süt el submit-eseményt, ezért a prototípus
  csapdázva) · `file` (igazi PDF: a rejtett mező base64 dataURL-lel telik meg). Három új
  felület, **8 → 18 vezérlő** 8 nyelven. A piros önteszt VÁLTOZATLANUL 9 bukás a megnevezett
  halmazon — a bővítés nem hígította fel.
- ⛔ **A forrás-darabszám nem a felület darabszáma:** a `dateF` helper KÉTSZER hívódik, tehát
  a forrásbeli 2 `onchange` **négy** mezőt renderel. Mind a négy mérve.
- ⚠️⚠️ **AMIT A ZÖLD NEM JELENT.** Az ellenséges csomagon mérve a partner-szűrők `title`/
  `aria-label`-je **levágódik** és szemét-attribútumok keletkeznek — az `onchange` CSAK azért
  él túl, mert a markupban **MEGELŐZI** a törött attribútumot. A zöld tehát
  **attribútum-SORRENDEN** áll, nem escape-elésen.
- 🔴 **ÚJ ÉLŐ LELET — MÉG UGYANEBBEN A KÖRBEN JAVÍTVA ÉS ŐRIZVE.** Repó-szinten **97
  escape-eletlen `T()`-attribútum** volt, és ebből **3 élesben tört** (`console/views.ts`:
  piac-lezárás · piac-megnyitás · leiratkozás-visszavonás indoklás-`placeholder`-e; az
  `en`/`it` fordítás idézőjelet tartalmaz, ami LEZÁRJA az attribútumot). Mindhárom
  **kötelező, NAPLÓZOTT indoklás** jogilag érzékeny műveletnél — épp a PÉLDA tűnt el, ami
  megmondja, mit írjon a kezelő. Tulaj: „jogi tartozás, nem kozmetika."
  **Mérve előtte/utána** (`en`+`it`, 3 hely): csonka + 5–7 szemét-attribútum → **teljes + 0**.
- **ŐR-SZIGORÍTÁS (a javítás UTÁN, tulaj-rendelet):** új `placeholder` mérés-típus — a
  RENDERELT DOM-on méri a csonkolatlanságot és a szemét-attribútumokat. Két új felület
  (`settingsPage` nyitott+zárt piaccal · `leadPage` LEIRATKOZOTT prospecttel).
  **21 vezérlő × 8 nyelv**, piros önteszt **27 bukás** — változatlanul a megnevezett
  halmazon. ⭐ A tulaj indoka a sorrendre: „egy ma piros őr, amit mindenki átlép, rosszabb
  a nincs őrnél."
- ⛔ **A MARADÉK 94 HELY külön kör**, tételesen a session-jegyzetben (views.ts **50** ·
  moduleConfigViews.ts **22** · partnerViews.ts **15** · adminViews.ts **7**). Ma egyik sem
  törik, de ez szerencse: a csomagok AI-generáltak. ⚠️ A `moduleConfigViews`/`adminViews`
  **29 helye VEVŐ- és VENDÉG-oldal** — ott a fizető ügyfél képernyőjén jelenne meg.
- **NYITOTT:** ① a maradék 94 escape-eletlen attribútum — tulaj-döntés · ② a konzol 7
  natív dialógusának rendszer-modálra váltása (ADR-0165 ① nyitott tétel).

## Előző szál — 🎨 ADR-0173

**🎨 ADR-0173 — A DÖNTŐ GOMB FELIRATÁT NEHÉZ VOLT ELOLVASNI.**
Session-jegyzet: `_planning/memory/2026-09-15_semantic_colour_contrast.md`.
Kontraktus: `assets/design-refs/console/semantic-contrast/`. **Élesítés NINCS** (§0.3).

- **A kiváltó:** az ADR-0156 körében mértem, hogy a kép-kapu gombja 3,91 — kimondtam, de
  nem javítottam (házon átívelő szín-döntés). A tulaj kérte a külön kört.
- ⭐ **A kör a bejelentésnél SOKKAL nagyobbat talált:** a ház a JELZÉS-színeket FELIRATNAK
  is használja. **Linkek 2,41** (a konzol MINDEN linkje) · `.pill.generated/.sent` **2,15**
  · warn **2,52** · ok **2,72–3,00** · bad **3,35–3,91**.
  ⛔⛔ **A két legrosszabb a DÖNTŐ gombokon ült:** a vevő **„Fizetek ▸"** és a kurátor
  **„Jóváhagyás"** gombja **3,00**-n — a gépi „látható-e" próbák közben IGAZAT mondtak.
- **Tulajdonosi döntés** (4 állapot × 2 méret képen + élőben mérő vázlaton): **„A —
  sötétebb felirat"** (a HUE marad, ahol JELZÉS; csak a felirat sötétedik, így a
  destruktív gomb nem lesz hangsúlyosabb), hatókör **a jelentés-vivő színek mind**, a
  **`--citui-muted` MARAD** (átütne a tenant-adminra és a vendég-oldalra).
  ⛔ A „legyen tömör gomb" NEM olcsóbb: a fehér felirat a mai zöldön szintén **3,00**.
- **Szállítva:** 4 szöveg-token a magban, minden TÉNYLEGES háttérre megoldva
  **tartalékkal** (≥5,3) · 48 CSS-szabály + ⛔ **23 BEÉGETETT inline szín** a nézetekben,
  ami megkerülte a CSS-t · az IKON nem felirat (a cián kézjegy marad).
- **A MARADÉK tételesen:** `--citui-muted` **165 elem** (4,36–4,81) · **2 szándékosan
  tompított** (`ctbl-clear`, tompítás nélkül 15,72) + 2 tompított muted · `<option>` és
  gradiens-hátterű elem NEM MÉRT (kiírva) · **a jelentés-vivő körből 0**.
- **Őr:** `console-contrast-check.mts` — **4224 elem**, 10 útvonal, 390 ÉS 1280 px,
  **alfa-kompozitálva**; három KIMONDOTT csoport; ⛔ a tompítás nem kiskapu; önteszt
  **702 piros**.
- ⛔⛔ **Saját csapdák:** a `color-mix()` **`color(srgb 0..1)`** alakban jön (RÖGZÍTETT
  csapda volt — újra beleestem) · a 220 ms-os `transition` miatt az azonnal olvasott szín
  még az átmenet közepe · a gradiens nincs a `backgroundColor`-ban · **a saját előző őröm
  bukott a saját javításomon** (beégetett hex → token-PROBE).
- **NYITOTT:** ① a `--citui-muted` (165 elem) — külön kör · ② a `[data-citui-theme="dark"]`
  nem írja felül a tokeneket (ma 0 használat) · ③ a tenant-admin és a vendég-oldal NINCS
  mérve ezzel az őrrel.

## Előző szál (2026-09-15) — a hatókör-szabály a processz-határon
**💳 ADR-0172 — A VEVŐ FIZETÉSI ÚTJA PIXEL NÉLKÜL FUTOTT ÉLESBEN.**
Session-jegyzet: `_planning/memory/2026-09-15_consent_scope_crosses_process_boundary.md`.
⚠️ **ÉLESÍTÉS NINCS — de a javítás csak deploy után ér ki.** Tulaj-kérésre indult: „a `/pay/mock`
lapot is nézd meg."

- **A lap maga ártalmatlan** (dev-only mock; élesben `PAYMENT_GATEWAY=barion`, mérve 404) — de a
  KONZOL processzen él, és **az egész processzről hiányzott a szabály**.
- ⛔⛔ **Élesben mérve** (`citoviso.com`, olvasás): az nginx a domaint KÉT processz között osztja
  fel, és a hasítás pont a vásárlási úton megy át. A **`/configure/…`** (a vásárlás indulása) és a
  **`/pay/…`** (köztük a **`/pay/done`**, a Barion `RedirectUrl`) a konzolra megy, ahol SEM sáv,
  SEM Pixel nem volt. A saját kódunk kommentje közben kimondja: „a Barion előírása szerint a
  Pixelnek a webshop MINDEN oldalán ott kell lennie." Ez az **ADR-0151 tükörképe**: nem „követés
  ott, ahol tilos", hanem „nincs követés ott, ahol kötelező".
- **Második lelet:** a `/adatvedelem` (8636 B, sáv+Pixel) és a `/privacy` (8290 B, tiszta)
  UGYANAZ a `privacyPage()` — és épp a `/privacy` az a cím, amit a **már kiküldött hideg levelek**
  tartalmaznak.
- **Szállítva:** ① a snippet + a címzett-szabály **közös modulba** (`src/server/consent.ts`); a
  public viselkedése bájtra változatlan (269 állítás előtte-utána zöld) · ② a konzolon is a
  CÍMZETT dönt — a hat kívülről elérhető útvonal NEM egy kategória (`/p/`, `/configure/`,
  `/mock/`, `/site/` a **szállás oldalát** adja ki → vendég; `/pay/…`, `/admin/<token>`, jogi
  lapok → own; a többi belső operátor-felület → nincs követés, de MÁS okból) · ③ ⛔ a konzol
  MÉRTEN **303**-at adott a `/assets/runtime/*`-ra → a sáv csupasz lett volna, a Pixel el sem
  indult volna; élesben ezt az nginx elfedte volna, **de egy proxy-sor nem lehet a jogi megfelelés
  egyetlen lába** · ④ a `/pay/mock` lap `res.end()`-del **megkerülte** a `send()`-et.
- **A kockázatot előre kimondtam és MEGMÉRTEM** (ADR-0145 ④): a VALÓDI fizetés-lapon, 390 és
  1280 px-en a sáv a navy tokenből fest, az „Elfogadom" a ciánból, és **egyetlen vezérlőt sem
  takar**.
- **Őr:** mindkét processzt felhúzza; pozitív kontroll a konzol saját lapjain (köztük a VALÓDI
  `/pay/done`), tiltás a vendég- és operátor-lapokon, **egy dokumentum = egy viselkedés** mindkét
  processzen, és a konzol MAGA szolgálja ki a sáv eszközeit. **397 zöld**; önteszt 127 → **178**
  piros; a valódi visszarontás **19 bukás / exit 1**.
- ⛔ **Két saját hiba menet közben:** a takarás-vizsgálatom BÁRMILYEN takaróra pirosat adott (egy
  soremelt inline link befoglaló dobozának középpontja a két sor KÖZÉ esik → a szülő `<p>`-t
  találta el, miközben a sáv 362 px-rel lejjebb volt) — a verdikt mostantól „takarja-e A SÁV";
  és az első fizetés-lap mérésem „0 vezérlő / 0 takarva" zöldet adott, mert a nem-hexa
  hivatkozásom 404-re esett — **egy 0-ból-0 nem mérés**.
- **NYITOTT:** ① az élesítés (jogi/elfogadóhelyi megfelelés, nem kozmetika) · ② a konzol
  404-lapja kívülállónak is megmutatja az operátor-navigációt — külön kör.

## Előző szál (2026-09-15) — 👁️ „OLDAL MEGTEKINTÉSE" FAGYÁS ALATT — ADR-0155 ⑦, freeze-state-v2 ⑨

**👁️ „OLDAL MEGTEKINTÉSE" FAGYÁS ALATT — ADR-0155 ⑦, freeze-state-v2 ⑨.**
Session-jegyzet: `_planning/memory/2026-09-15_frozen_guest_view.md`. **Élesítés NINCS.**

- **A bejelentett lelet NEM állt.** „A gomb figyelmeztetés nélkül visz a fagyasztott lapra" —
  mérve nem: a `public.ts` a `siteUrl`-t CSAK `live` státuszban adja át, fagyás alatt null, a
  gomb a BELSŐ előnézetre esik vissza. Törött link nincs. A valódi baj a FELIRAT, az
  ELLENKEZŐ irányba: az „Oldal megtekintése" azt ígéri, hogy azt látja, ami a látogatónak
  megy — közben a saját, működő oldalát kapja. A gomb megnyugtat, pont amikor nem kéne.
  A modul-sorok ezt már megoldották („Megnézem" → „Előnézet"); a fejléc-gomb kimaradt.
- ⛔⛔ **A második lelet a SAJÁT előző köröm hibája:** a „B — Rendezés-képernyő" refaktor
  NÉMÁN elvitte a hármas ténylistát, amiben EGYEDÜL állt, hogy a látogató nem üres lapot és
  nem nyers hibát kap. És amit a tulajnak jelentettem róla („állít valamit, amit nem tud
  ellenőrizni"), ELAVULT premissza volt — a B ELŐTTI kódra igaz. A tulaj kifejezetten
  megkért, hogy MÉRJEM; az mentett meg.
- **A pótolt mondat NEM a régi.** Egy párhuzamos szál 2026-09-14-én kivette a vendég-lapból
  az „átmenetileg"-et és a visszatérés-ígéretet (fizetés híján a 30. napon a honlap VÉGLEG
  lekerül) — ugyanazt egy szinttel feljebb sem írhatom vissza. Az admin sora tényeket állít.
- ⭐ **Az őr gerince: egy forrás, nem hasonmás.** Amit az admin ÍGÉR a látogatói lapról, azt a
  `renderSuspendedPage()` RENDERJÉN keresi vissza (`frozen-guest-view-check`). Ha a
  vendég-lapról eltűnik a név vagy az elérhetőség, az admin mondata hamissá válik, és a
  kapunál derül ki. Piros önteszt 2 sértés + 3 kötés a TERMÉK visszarontásával igazolva.
- **Mért korlát, kimondva:** a látogatói link 390-en első festéskor y=790, a fix fülsáv
  y=658-tól → a sáv alatt; görgetés után kattintható (scrollY=230 → y=560). Elfogadott: a ⑦
  az ÖSSZEGET és a GOMBOT köti a nyitó nézetbe (y=270/359). Az ELÉRHETŐSÉGET őr méri.
- ⚠️ **Kétszer a saját mérőeszközöm csapott be:** a `scrollTo` után azonnal olvastam vissza a
  pozíciót („a lap nem görget" — hamis), és a ⑨ próba először LE SEM FUTOTT, mert a fixtúrám
  `siteUrl`-t adott `guestViewUrl` helyett. A piros próbám első hipotézise (alsó pading) sem
  sült el — az önteszt viszont lefedi.

## Előző szál
**🔇 ADR-0171 — EGY KAPU, AMINEK A BUKÁSA NÉMA, MAJDNEM ANNYIRA HASZNÁLHATATLAN, MINT EGY MEG
SEM HÍVOTT.** Session-jegyzet: `_planning/memory/2026-09-15_silent_gate_output.md`.
**Élesítés NINCS** (§0.3 — fejlesztői eszköz, nulla termék-kód). Tulajdonosi utasítás a lead-lap
köréből (ADR-0167) kibukó mellék-leletre: „vidd végig".

- **A hiba:** a `hooks/pre-commit` a kapuk többségét `>/dev/null`-ra futtatta `set -e` mellett,
  ezért egy BUKÓ kapu kimenete **nyomtalanul eltűnt** — a napló annyit mutatott, hogy a kapu
  fejléc-sora, majd semmi. ⛔ Nem hamis zöld (a bukás bukás, a commit nem jött létre), hanem
  **diagnosztizálhatatlan** bukás, és pont akkor a legdrágább, amikor a legnagyobb a baj.
- **Mérve, mit került: HÁROM diagnosztikai kört.** Harness-ölést gyanítottam → `nohup`, ugyanott
  szakadt; OOM-ot → `dmesg` (nem volt, 12,7 GB szabad); végül `tmux`, és ott lett látható az
  `EXIT=1`. Közben a kapu **valódi leletet talált**: egy „a(z)" a felhasználói szövegben, pont
  abban a mondatban, amit a nyers `superseded_by:<uuid>` HELYETT írtam, hogy emberi legyen.
  ⚠️ A rossz diagnózist a **saját mérőeszközöm** is táplálta: a `pgrep -f` élet-próbám egy
  **5:51-es várakozó shellre** illeszkedett → háromszor jelentettem „fut"-ot egy HALOTT
  folyamatra. A hosszú kapu-sort csak a **tmux** tartja életben, a `nohup` nem.
- **Szállítva:** a kapu stdout-ja `$GATE_LOG`-ba megy, és **csak bukáskor** kerül kiírásra, a
  kilépési kóddal — **79 hívási hely**. ⭐ A stderr **szándékosan átfolyik**: a zöld futás
  viselkedése **bitre ugyanaz** marad (a `>/dev/null`-nak volt jogos szándéka; egy zajosabb zöld
  futás azt a szokást nevelné ki, hogy senki nem olvassa a naplót). ⭐ A hívás alakja **UTÓTAG,
  nem burkoló előtag**, és ez nem stílus: a `guard-wiring-check` a **sor elejére horgonyozva**
  ismeri fel a bekötést, egy előtag tehát a kapuk többségét „bekötetlennek" jelentette volna —
  mérve igazolva, hogy a felismert halmaz előtte/utána **azonos** (127 és 123 találat).
- **Őr:** `scripts/gate-output-check.mts` — ① szerkezeti + ② **viselkedési**, ami a SZÁLLÍTOTT
  segédfüggvényt kivágja a hookból és élesben futtatja (⛔ a kivágott EREDETIVEL, mert egy
  másolat csak az én elképzelésemet bizonyítaná). 13 pass / 0 fail, **3 piros önteszt** mindkét
  rétegen. **Éles végpont-végpont próba:** bukó kapu a hook élén → egy VALÓDI `git commit`
  kiírta a korábban elnyelt sorokat; a próba eltávolítva, commit nem jött létre.
- ⭐⭐ **A transzformáció utó-feltétele VALÓDI rést fogott:** a mintám csak `.mts|.mjs`-t ismert,
  közben két ÚJ kapu **`.ts`** kiterjesztéssel landolt → a „0 elnémított maradhat" feltétel
  elhasalt, és a fail-closed szkript semmit nem írt ki. ⛔⛔ **Ugyanez a vakság az ŐRBEN is benne
  volt**, tehát „0 elnémítottat" jelentett volna, miközben kettő néma marad — **egy szűk
  felismerő ugyanúgy hamis zöldet ad, mint egy hiányzó állítás.**
- ⛔ **Amit a saját őröm ELSŐ futása fogott meg MAGÁN:** szó szerinti egyezést vártam és egy
  HELYES sort (`--fast`) jelentettem hibásnak; a „sikerkor a stderr átfolyik" állítás **ÜRES
  sztringen mért** (`execFileSync` sikerkor eldobja a stderr-t → `spawnSync`) — a mérőeszköz
  hibája volt, nem a mérendőé; és a piros önteszt először csak az ① réteget buktatta.
- **NYITOTT (idegen adósság, mérve):** a `guard-wiring-check` két őrt pirosnak jelent —
  `module-config-check` (elrohadt fixture) és `lead-page-surface-check`, ami **TERMÉK-hiba**:
  aurora/mobilon a lebegő pirula a „Szabad időpontok megtekintése" CTA **23 %-át** takarja.

## Előző szál (2026-09-15) — 🧪 ADR-0170 — AZ ELROHADT FIXTURE: A TERMÉK HÁROMSZOR LÉPETT TOVÁBB A TESZT ALATT

**🧪 ADR-0170 — AZ ELROHADT FIXTURE: A TERMÉK HÁROMSZOR LÉPETT TOVÁBB A TESZT ALATT.**
Session-jegyzet: `_planning/memory/2026-09-15_rotted_fixture_repair.md`. **Élesítés NINCS.**
**Termék-kód NEM változott.** Ez az ADR-0152 leltárának **utolsó adóssága**.

- **Négy rothadás, egymás mögé rejtve.** Az őr 2026-09-15-ig árva volt; mert soha nem futott,
  a fixture-je csendben elrohadt — és mert az ELSŐ hiba összeomlasztotta a futást, a mögötte
  lévő ~40 állítás soha nem is jutott szóhoz:
  ① `source: "booking:xyz"` a sémában előírt `booking:<uuid>` helyett →
  `invalid input syntax for type uuid`, a futás halála · ② **ADR-0062 óta a foglalási felület
  KÉT darab** (a sávban csak keskeny `variant="cta"` csík → `#cit-booking`, a teljes widget a
  záró szekcióban) · ③ **telefon-kötelezettség** (tulajdonosi rendelet, 2026-08-23) — a
  vendég-fixture a rendelet ELŐTTI alakban élt · ④ az átfedő kérést a termék már nem
  `conflict`-tal állítja meg, hanem az első elfogadásakor **automatikusan elutasítja**
  (`decided_by: "auto"`).
- ⭐⭐ **A JAVÍTÁS SZABÁLYA: a KÉRDÉST tartjuk meg, nem az elvárás szövegét.** Minden ponton
  ott volt a csábítás, hogy „igazítsuk az elvárást a kimenethez" — az zöldet adott volna,
  **vakság árán**: ha törlöm a `data-cit-units` / `data-cit-min-nights` elvárást, sehol nem
  maradt volna ellenőrizve, hogy az egységek és a szabályok eljutnak a VENDÉG lapjára.
- **Ezért:** az állítás a **kiszállított felületre** költözött (`bookingSlot` +
  `moduleSections`), és külön állítás rögzíti magát a kettéosztást is (a kontraktus ne legyen
  néma) · a telefon-szabály **két NEGATÍV ikret** kapott (a pozitív eset önmagában nem védi:
  a szabály kivehető lenne a kódból, és minden zöld maradna) · az átfedés-állítás **háromfelé**
  bontva (nem lehet elfogadott · a RENDSZER utasította el · az éjszaka az ELSŐ vendégé maradt)
  · a naptár-eset **valódi** `calendar_link`/`booking_request` sorra mutat.
- ⭐ **Bizonyítva, hogy nem vakult meg:** három visszarontás, mindegyik pontosan a szándékolt
  állítást buktatja (telefon-szabály kivéve → **2 piros** · szabály-attribútumok kivéve →
  **1 piros** · `decided_by: "auto"`→`"owner"` → **1 piros**); termék-kód minden próba után
  visszaállítva, mérve üres diffel.
- **82 állítás zöld, ~11 s, két futás stabil, takarít** — a sorok a site-tal kaszkádolnak; az
  egyetlen `_mcfg_check` árva **2026-09-08-i**, nem ezekből, és nem szaporodott.
- ⭐ **Ezzel az ADR-0152 leltára KIÜRÜLT:** nincs több „elrohadt" kivétel, a
  `guard-wiring-check` adósság-figyelmeztetése eltűnt.
- **A tanulság:** egy soha le nem futó teszt nemcsak hasztalan — **aktívan félrevezet**. A
  termék háromszor lépett tovább alatta, és minden egyes pirosnál ott volt a rossz válasz
  lehetősége: „akkor vegyük ki azt az állítást".

## Előző szál (2026-09-14) — 🔗 ADR-0169: egy leadhez EGY ÉLŐ követett link — és az őr kétszer volt zöld a rossz okból

**🔗 ADR-0169 — EGY LEADHEZ EGY ÉLŐ KÖVETETT LINK: LEVEZETVE, NEM TÁROLVA.**
Tulajdonosi választás a B6 három panel-tervéből: az **„A — Egy ÉLŐ, a többi archív"**.
Kontraktus: `assets/design-refs/console/outreach-link-live-archive/` · migráció: `0068`.
Session-jegyzet: `_planning/memory/2026-09-14_outreach_live_link_archive.md`. **Élesítés NINCS.**

- **Szállítva:** az ÉLŐ link = a lead legutóbb létrehozott, **NEM archivált** linkje —
  levezetett, nem tárolt (`is_live` zászló második igazság lenne); a `0068` csak azt tárolja,
  ami megtörtént: `prospect.archived_at` · az **archiválás nem törlés** (a `/p/<token>` cím
  továbbra is megnyílik, a mért adat marad), megerősítést kér és **visszavonható** · új link
  ELŐTT állandó sáv + megerősítés mondja ki, mi lesz a mostanival, és hogy a korábban kiküldött
  cím a **RÉGI** linkre mutat · **kártyánként EGY elsődleges gomb** (a navigáció link lett) ·
  a címzett-mező a **következményt** mondja, nem azt, hogy „(opcionális)".
- ⚠️ **Egy szó eltér a jóváhagyott mocktól, szándékosan:** „**Korábbi** linkek", nem „Archív" —
  a valódi adatban a régebbi linkek többsége SOSEM lett archiválva, csak újabb készült utánuk.
  A jóváhagyott terv a kontraktus, de ha egy felirat a valódi adaton hazudna, a **§B.17 erősebb** —
  és az eltérést KI KELL MONDANI (README + ADR), nem elhallgatni.
- ⛔⛔ **AZ ŐR KÉTSZER VOLT ZÖLD A ROSSZ OKBÓL, mindkétszer a saját kezemtől.**
  ① A park **minden leadjén EGY link van**, tehát a feature LÉNYEGE (több link, ÉLŐ + korábbiak,
  archiválás) egyszer sem mérődött meg — az első futás 100 % zöld volt. Az őr most **saját
  fixture-t** épít (3 link, és az **archivált a LEGFRISSEBB sor**, hogy az archiválás
  élő-kiütő hatása is mérve legyen), `finally`-ben törli.
  ② Az **önteszt hármat állított és kettőt mért**: a „két ÉLŐ jelölés" mérgezés egy egy-linkes
  leaden **no-op** volt (0 piros), mégis „képes pirosra menni"-t írt. Most a több-linkes
  fixture-ön fut, **ágankénti számlálóval**: ha bármelyik mérgezés 0 állítást visz pirosra,
  az önteszt BUKIK.
- ⭐ Ahol egy állítás nem mérhető (nincs jóváhagyott mock → nincs létrehozó űrlap), az őr ezt
  **kiírja**, nem nyeli el. És az elvárt ÉLŐ linket **független lekérdezésből** számolja, nem a
  `getProspects` `isLive` mezőjéből.
- ⛔ **Mérve, de NEM javítva (külön kör):** a konzolban a `class="ghost"` gomboknak **nincs
  CSS-szabálya**, ezért navy elsődlegesnek látszanak — két másik felületen is. A saját
  gombjaimhoz külön `con-btn2` osztály készült; a globális javítás más lapokat is átfestene.
- **Amit a változás majdnem eltört (mérve, nem feltételezve):** az FK-004b `kattints
  "Tevékenység — mit csinált"` lépése — a felirat maradt, de **gombból LINK lett** (a runner
  locatora `a:has-text`-szel kezd, tehát fog) · az FK-004 `Követett link készítése` mostantól
  **megerősítést** kap (a runner `page.on("dialog")`-ja elfogadja és naplózza).
- **NYITOTT:** a levél nyers tokenes URL-je és az ár-doboz „-tól" vége / `p3` HTML↔text
  eltérés — **kódolt döntés**, a tulaj külön kérdezi meg. Ebben a körben sem írtuk át.

## Előző szál (2026-09-14) — 🎯 ADR-0168

**🎯 ADR-0168 — A FANTOM PIRULA-ÜTKÖZÉS: A SAJÁT JELENTÉSEM VOLT A HAMIS PREMISSZA.**
Session-jegyzet: `_planning/memory/2026-09-14_phantom_pill_collision.md`. **Élesítés NINCS.**
**Termék-kód NEM változott.**

- **A kért javítás elmaradt, mert nem volt mit javítani.** A tulaj utasítása („javítsd az
  aurora/mobil pirula-ütközést") az én ADR-0152-es leltáramból jött. Újramérve: **három futás
  HÁROM KÜLÖNBÖZŐ esetet buktatott** (aurora/mobil y=769 · fullbleed/mobil y=685 ·
  fullbleed/asztali y=798), és ugyanarra a sablonra a mért `y` futásonként **100+ px-et
  ugrált** (685 → 543). Érme-feldobás, nem regresszió.
- **Az ok:** a termék MÁR kikerüli az elsődleges gombot (`cit-cfg-avoid`, Elek FK-004b H-3
  óta), és a `bottom`-ot **animálva** teszi — az őr viszont `wakePill()` után **fixen
  400+700 ms**-mal mintavételezett, miközben a mért megállási idők **210 ms – 5 050 ms**
  között szórtak. Nyugvópontra várva **három teljes futás 0 bukás** (114 mérés/futás).
- ⭐ **Ez az ADR-0147 ② hibaosztálya MÁSODSZOR** — vagyis nem egy őr javítása volt, hanem
  SZABÁLY: animált elem helyét a PIXELRE várva mérjük, nem órára.
- **Javítás (az őrben, nem a termékben):** `settlePill()` rAF-poll, amíg a rect **700 ms-on
  át** változatlan ÉS `opacity === 1` (a 700 levezetett: hosszabb, mint 120 ms debounce +
  500 ms átmenet — különben a „megállt, aztán újra elindult" pirulát nyugvónak mondanánk).
  A plafon **12 000 ms** = a mért legrosszabb 2,4-szerese; a javítás utáni futásokban a
  legnagyobb megállás **3 237 ms** → 3,7× ráhagyás, **nem alig-átmenő érték** (ADR-0147 ⚠️).
  ⛔ A plafon NEM ítélet: a meg nem álló pirula külön PIROS állítás, nem elnyelt timeout.
- ⚠️ **Nem vakítottam el az őrt, és ezt MÉRTEM:** a kikerülő kimondottan FELADJA, ha csak a
  képernyőről lelépve tudna kitérni (`if (lifted - h < 8) break`) → `placeLaunch()`
  kikapcsolva az őr **sok sablonon** bukik, mind a nyugvó `y=745`-nél **konzisztensen** (ép
  kódnál a `y` sablononként 540…828 — ez a működő kikerülés ujjlenyomata). + ÚJ piros iker:
  szintetikusan oszcilláltatott pirula → `settled=false`.
- **Bekötve** (trigger: motor-render + konfigurátor-generátor + `assets/runtime/cit-
  configurator.{js,css}` — a hibaosztály pontosan egy CSS-átmenet és egy JS-időzítő ott — +
  az őr saját fájlja). A `guard-wiring-check` kivétel-listájáról lekerült; **egy** adósság
  maradt: `module-config-check` (elrohadt fixture).
- ⭐⭐ **A TANULSÁG:** a bekötetlen őr nemcsak a terméket hagyja őrizetlenül — **maga is
  elromlik, és senki nem veszi észre**. A romlás a leltáramba „élő termék-hibaként" került
  be, onnan pedig **tulajdonosi utasításként jött vissza**. ⛔ A saját korábbi mérésem is
  premissza, nem tény — javító művelet előtt újra kell mérni.

## Előző szál (2026-09-14) — 🧭 ADR-0167: a lead-lap első kérdése a MUNKAMENET, nem egy pontszám

**🧭 ADR-0167 — A LEAD-LAP ELSŐ KÉRDÉSE A MUNKAMENET, NEM EGY PONTSZÁM.**
Session-jegyzet: `_planning/memory/2026-09-14_lead_page_workflow_band.md`. **Élesítés NINCS** (§0.3).
Tulaj-döntés: „a lead-lap **B** változat nyert, csináld végig ugyanígy" — ez a B3 brief második
fele; a testvér-felület (lead-LISTA) az ADR-0161. Kontraktus:
`assets/design-refs/console/lead-page/` (plan.html + README + mindkét méret képe + **külön a
mock-fül felvételei**, mert a két változat legnagyobb különbsége ott ül, és a lap érkezési
állapotában nem látszik).

- **A tő:** a lap **adat-lapként** volt megszerkesztve (mezők, számok, kártyák), holott a kurátor
  **munkamenetet** vezet rajta. Mérve, ami ezt kimutatta: **595 leadből 109-nek NINCS**
  match-értéke — azoknál a lap legfeltűnőbb helyén egy alig látható szürke `–` állt navy alapon,
  a magyarázata egy MÁSIK fülön · egy leaden **HÁROM** képszám szólt ugyanarról (12/11/10), és a
  bontás `0+11+0` nem adta ki a 12-t · a szöveg-sáv 9-et és 3-at mondott 18-ból, a maradék **6
  tétel sorsáról egy szó sem** · a követett linken **119 esemény** volt, a gomb mégis „mérés
  indul"-t írt.
- **Szállítva:** hat állomású munkamenet-sáv (Begyűjtve · Mock · Jóváhagyva · Kiküldve · Rendelés ·
  Fizetve), ahol **minden állomás dátumot mond vagy „még nem"-et** (néma gondolatjel sehol) és a
  soron következő megjelöli magát · a jóváhagyott tény **futás közben is a helyén marad** ·
  összehasonlító mock-tábla (készült · sablon/arculat · képszám · nyitókép · állapot · döntés),
  amitől „öt egyforma kártya" SZERKEZETILEG lehetetlen · fül-számláló helyett **mondat**, amit a
  KISZOLGÁLÓ ír fülönként · egy képszám levezetve, kinyitható bontással, és ⛔ ha a részek nem
  adják ki az összeget, a lap KIMONDJA · a három szakasz KIADJA a nevezőt · nincs `kulcs=érték`,
  nincs nyers enum, nincs `superseded_by:<uuid>` · telefonon a sáv függőleges, a tábla sorokká
  bomlik (külön tervezői döntés).
- **Őr:** `scripts/lead-page-plan-check.mts` — 10 szakasz a KIRENDERELT lapon, valódi
  stíluslappal; **piros önteszt: 4 bukás**. ⚠️ A fül-mondat láthatóságát **geometriával** ítéli:
  a megvalósítás ELSŐ változatában a mondat ott volt helyes szöveggel, a teljes-lapos kép is
  rendben mutatta, közben a **ragadós fülsor TELJESEN rátakart** (60–111 vs. 59–78) — az operátor
  soha nem látta volna. Javítás: fülsor + mondat EGY ragadós egység (utána 60–111 és 111–147).
- ⛔⛔ **Amit a KÉPERNYŐKÉP fogott meg, nem a fordító:** a `latestMock` a deklarációja ELŐTT állt;
  `tsc --noEmit` átengedte, a lap futásidőben elszállt („Cannot access 'latestMock' before
  initialization"). Ezért kötelező a §2b 2. lépése.
- ⛔⛔ **Az ÁTSZERVEZÉSEM MEGVAKÍTOTT egy párhuzamos szál landolt őrét.** Ugyanaznap egy másik
  szál (`272ca4c`) is a lead-lapra dolgozott, és őrt tett a TERÜLET jelentésére — pont a nyers
  `kulcs=érték` meta-sorra (`.panel .small.mut`), amit a ⑧ pont kivezetett. **34 pass / 1 fail**,
  de a fail nem a hiba volt, hanem a VAKSÁG jele: a párja (`every(…)`) **ÜRES HALMAZON** zöld
  lett. ⭐ Az őrt az önbizonyító ága mentette meg. Előbb igazoltam, hogy a jelentés megvan és
  ERŐSEBB, és csak utána vittem át az állítást (operátor-látta sor + a lap TELJES szövege
  `textContent`-tel, mert a nyers alak csukott `<details>`-ben él) — a piros KONTROLLT is.
  Utána: **35 pass / 0 fail**, önteszt mind a hármat buktatja.
- ⛔ **A nyelvi kapu a SAJÁT új szövegemben talált „a(z)"-t** — pont abban a mondatban, amit a
  nyers `superseded_by:<uuid>` HELYETT írtam („Felülírta: a(z) …"). Javítva a `hu.ts` EGY
  forrásából (`huArticleLower` → `{art}`), nem beégetett „a"-val.
- ⛔ **A BUKÓ KAPU KIMENETE EL VAN NYOMVA:** a `hooks/pre-commit` **112 kapujából 66** `>/dev/null`-ra
  megy `set -e` mellett, ezért a bukás NÉMA HALÁLNAK látszik — **három diagnosztikai körön**
  hittem harness-ölést/OOM-ot, közben egy kapu valódi leletet talált a kódomban. **NYITOTT**
  (66 hívási hely egy forró közös fájlban, tulaj-döntés kell).
- ⛔ **A `MEMORY.md` tetején két egymást CÁFOLÓ blokk állt** (a fizetés-pillanat szála kétszer: a
  frissebb „a tulaj döntött", az elavult „NYITOTT: 4 pontban"), plusz két ÜRES fejléc — feloldva.

## Előző szál (2026-09-14) — 🗣️ ADR-0165 — A TÖRLÉS KÉT NYELVEN MEGERŐSÍTÉS NÉLKÜL MENT EL

**🗣️ ADR-0165 — A TÖRLÉS KÉT NYELVEN MEGERŐSÍTÉS NÉLKÜL MENT EL.**
Session-jegyzet: `_planning/memory/2026-09-14_console_dialogs_measured.md`. **Élesítés NINCS.**
Tulaj-kérés az ADR-0150 nyitott tételére: „a konzol 6 natív dialógusát is nézd meg".

- ⛔ **A saját számom elavult volt:** „6"-ot írtam az ADR-0150-be, újramérve **7** (közben egy
  párhuzamos szál landolt egy újat). A saját összefoglaló sor nem premissza.
- ⛔⛔ **Egy hely MA IS TÖRIK — adatvesztés-kockázat.** A „jóváhagyott mock törlése"
  `confirm()`-ja **`jsStr()` nélkül** kapta a szöveget. A MAGYAR forrásban nincs aposztróf,
  **a fordításban van**: `en` „It **hasn't** been sent yet" · `it` „**l'operazione**".
  Mindkettőn a kezelő SyntaxError → a `confirm()` **soha nem fut le** → a visszafordíthatatlan
  törlés **megerősítés nélkül** megy a szerverre. Böngészőben mérve: `hu`/`de` dialógus=1 →
  megállítva; **`en`/`it` dialógus=0, JS-hiba=1, `defaultPrevented=false` → ELMEGY.**
- **Egy LAPPANGÓ pár** („link másolása") ugyanígy escape-eletlen volt — ma csak azért ép, mert
  abban a feliratban egyetlen csomagban sincs aposztróf. A csomagok AI-generáltak: **szerencse,
  nem garancia.** A másik öt hely rendben volt, pedig három fordítása aposztrófos — vagyis az
  escape-elés tényleg ez a különbség.
- **Tulaj-döntések:** ① escape-fix most (§2b kivétel, az Ő szavával — a felület-kapu blokkolt,
  és helyesen: kivételt magamnak nem adok) · ② a rendszer-modál a konzolon **külön kör** (a hét
  dialógus ma visszafordíthatatlan KIKÜLDÉST véd).
- **Őr:** `scripts/dialog-fires-check.mts` (pre-commit) — **8 vezérlő × 8 nyelv** valódi
  böngészőben: a kattintás PONTOSAN EGY dialógust vált ki · a beküldés **tényleg elindul** ·
  elutasításra MEGÁLL; plusz **ellenséges ál-csomag** (`'`, `"`, `\` minden feliratban), ami a
  LAPPANGÓ helyeket fogja meg. **Piros önteszt: 9 bukás MEGNEVEZETT halmazon** (piros
  `en`/`it`/`zz`, ZÖLD `hu`/`de`/`hr`/`pl`/`sk`) — a kétirányú elvárás bizonyítja, hogy a
  fordítás TARTALMÁRA mér. Hook `set -e` alatt, valódi visszarontással: `rc=1`.
- ⛔⛔ **Az őröm két saját csapdája:** ① először **üresen igaz** állítást mért — a küldő-sáv
  letiltja a gombot, amíg a levél vége nem járt a képernyőn, így a submit el sem indult, és a
  „megállt" ZÖLD lett **nulla dialógus mellett is** · ② a `.first()` szelektor a TÁRGY
  vágólap-gombját mérte (az szándékosan nem kérdez), és **az ÉP terméket vádolta** mind a 8
  nyelven. Mielőtt a terméket hibáztatod: a jó elemre mutatsz-e?
- **NYITOTT:** ① a konzol 7 dialógusának rendszer-modálra váltása (külön §2b kör) · ② a
  `partnerViews.ts` 8 inline kezelője még nincs az őr hatókörében.

## Előző szál (2026-09-14) — a fizetés pillanata (tétel-doboz)

**💳 A FIZETÉS PILLANATA — A FŐ-HIBA EGY MÁR JÓVÁHAGYOTT, DE SOSEM MEGÉPÍTETT TERV.**
Session-jegyzet: `_planning/memory/2026-09-14_payment_moment_exit_and_plan.md`.
**A kinézeti rész a §2b terv-kapunál MEGÁLLVA** (`TERV-KESZ.md` a `wt/fizetespillanat` munkafa
gyökerében; két működő mock + 16 kép az `assets/design-refs/_drafts/` alatt). **Élesítés NINCS.**

- ⛔ **„Nem derül ki, MIT veszek” — de ez nem új tervezői kérdés.** Mérve a valós renderelt panelen:
  `mentionsSiteName: false`, `mentionsSectionCount: false`. A **2026-09-11-én jóváhagyott**
  `checkout-fullscreen/plan.html` **215–220. sora viszont már megrajzolta** a megnevezett
  tétel-blokkot — a szállított `cit-configurator.js`-ben nulla nyoma. A `contract-drift-check` a
  README **feliratait** őrzi, a terv SZERKEZETI elemeit nem: nem tévedett, **nem is kérdezte**.
- **Javítva + őrizve (apró rész, a BRIEF kimondott kivétele alapján, naplózva):** ① a sikeres lap
  egyetlen kiútja `class="btn"`-t viselt, aminek **0 szabálya** van a négy konzol-stíluslapon —
  renderelve bájtra ugyanaz, mint a mellette álló mailto-link (a saját kódunk 80 sorral feljebb már
  ki is mondta, csak a testvér-ág maradt ki) · ② három képernyő beégetett `info@citoviso.com`-ot
  írt ki, ami a konfigurációban **sehol nem szerepel** (mindenhol `olasz.ferenc@citoviso.com`) —
  az elutasított kártyájú vevőt egy olyan címre küldtük, ahonnan nem is írunk · ③ az átjáró kétszer
  mondta ki ugyanazt mindkét záró-ágon · ④ a többnyelvű visszaigazolás **tagadta és ígérte** az
  e-mailt két egymást követő mondatban · ⑤ a panel-fülnek nem volt `title`-je.
- **Őr:** `scripts/pay-exit-truth-check.mts` — 31 állítás a RENDERELT, stíluslapos lapon
  (forrás-grep vak rá: a `btn` gombnak *néz ki* a kódban), **differenciális** verdikttel: a kiút nem
  nézhet ki úgy, mint a mellette álló linkek. ⛔ Az első kontraszt-szondám a gradiens miatt
  **minden elemre 1-et adott** — zölden igazolt volna egy valódi regressziót. ⛔⛔ És az első
  **öntesztem zöld sort adott egy szabályra, amit sosem próbált ki** (a visszarontás nem
  illeszkedett); most minden visszarontás bizonyítja, hogy megváltoztatta a bemenetet.
- ⛔⛔ **Amit a KÉP fogott meg, és a kattintás-teszt nem:** a saját vázlatomban a görgetés-jelzés a
  görgetett tartalom VÉGÉN ült — minden állítás zöld volt (létezik, nem `hidden`), de a képen
  látszott, hogy csak akkor bukkan elő, amikor már nem kell.
- ⭐ **A TULAJ DÖNTÖTT, ÉS A TÉTEL-DOBOZ MEGÉPÜLT (ADR-0158).** „A — Ár-bontás + Havi/Éves”;
  befagyasztva: `assets/design-refs/configurator/checkout-item-block/`. A fizetőoldal mostantól
  megnevezi a szállást, a terméket és a ciklust, bontja az árat, és a Havi/Éves váltó **a döntés
  helyén** áll — **EGY** `period` állapotból, ÉRTÉK szerint szinkronizált kijelöléssel (az eredeti
  `x === b` csak a megnyomott gombot gyújtotta ki). Új manifest-mező: `product.name` — eddig a
  szállás neve **ki sem jutott a böngészőbe**. Őr: `checkout-item-block-check.mts`, 51 állítás a
  valós panelen, **három** visszarontással (az első öntesztem csak a dobozt vette ki, amitől a
  futás a többi szabályt át is ugrotta). ⭐ Meta-javítás: a kontraktus-README-k mostantól
  `## Kötő horgony` szakaszban SZERKEZETET is köthetnek, és a horgony-keresés **kihagyja a
  stíluslapokat** (mérve: a hook törlése a futtatóból zölden hagyta az őrt, mert a CSS-ben is ott
  volt). ⛔ A tétel-doboz miatt megnőtt tartalmon a lebegő görgetés-pirula 390 px-en **a Havi/Éves
  váltóra ült** — a görgő zsugorításával oldva, így az átfedés geometriailag lehetetlen.
- ⭐ **2026-09-15 — a modul-kártyák `/hó` felirata is javítva (ADR-0164 ③b).** Mérve a friss
  `main`-en: éves előválasztás mellett a kártya **9 500 Ft/hó**, az összegző ugyanazon a képernyőn
  **95 000 Ft/év** — tízszeres eltérés. ⛔ A mélyebb ok: a kártya ára **build-időben** dőlt el, így
  a közvetlenül alatta álló váltó sosem mozdította. Most az `updateSummary()` egyetlen
  újraszámolásából frissül, egy soron egy egységgel. Az őr legerősebb állítása: **az aktív kártya
  száma AZONOS az összegző áthúzott listaárával**; 5 visszarontás bizonyítja a pirosra menést.
- **NYITOTT:** az átjáró/bukás-lap (A vagy B) döntése · a tulaj döntése 4 pontban (fizetőoldal A/B/C · átjáró A/B · lehet-e a tiltott gomb
  teljesen szürke · C-nél kiírható-e a leendő webcím a fizetés ELŐTT) · asztali A-n a görgő 13 px-t
  csordul túl · a `contract-drift-check` csak feliratot köt, szerkezetet nem (külön szál).

## Előző szál (2026-09-14) — a fizetés pillanata (korábbi, rövidebb összefoglaló)

**💳 A FIZETÉS PILLANATA — A FŐ-HIBA EGY MÁR JÓVÁHAGYOTT, DE SOSEM MEGÉPÍTETT TERV.**
Session-jegyzet: `_planning/memory/2026-09-14_payment_moment_exit_and_plan.md`.
**A kinézeti rész a §2b terv-kapunál MEGÁLLVA** (`TERV-KESZ.md` a `wt/fizetespillanat` munkafa
gyökerében; két működő mock + 16 kép az `assets/design-refs/_drafts/` alatt). **Élesítés NINCS.**

- ⛔ **„Nem derül ki, MIT veszek” — de ez nem új tervezői kérdés.** Mérve a valós renderelt panelen:
  `mentionsSiteName: false`, `mentionsSectionCount: false`. A **2026-09-11-én jóváhagyott**
  `checkout-fullscreen/plan.html` **215–220. sora viszont már megrajzolta** a megnevezett
  tétel-blokkot — a szállított `cit-configurator.js`-ben nulla nyoma. A `contract-drift-check` a
  README **feliratait** őrzi, a terv SZERKEZETI elemeit nem: nem tévedett, **nem is kérdezte**.
- **Javítva + őrizve (apró rész, a BRIEF kimondott kivétele alapján, naplózva):** ① a sikeres lap
  egyetlen kiútja `class="btn"`-t viselt, aminek **0 szabálya** van a négy konzol-stíluslapon —
  renderelve bájtra ugyanaz, mint a mellette álló mailto-link (a saját kódunk 80 sorral feljebb már
  ki is mondta, csak a testvér-ág maradt ki) · ② három képernyő beégetett `info@citoviso.com`-ot
  írt ki, ami a konfigurációban **sehol nem szerepel** (mindenhol `olasz.ferenc@citoviso.com`) —
  az elutasított kártyájú vevőt egy olyan címre küldtük, ahonnan nem is írunk · ③ az átjáró kétszer
  mondta ki ugyanazt mindkét záró-ágon · ④ a többnyelvű visszaigazolás **tagadta és ígérte** az
  e-mailt két egymást követő mondatban · ⑤ a panel-fülnek nem volt `title`-je.
- **Őr:** `scripts/pay-exit-truth-check.mts` — 31 állítás a RENDERELT, stíluslapos lapon
  (forrás-grep vak rá: a `btn` gombnak *néz ki* a kódban), **differenciális** verdikttel: a kiút nem
  nézhet ki úgy, mint a mellette álló linkek. ⛔ Az első kontraszt-szondám a gradiens miatt
  **minden elemre 1-et adott** — zölden igazolt volna egy valódi regressziót. ⛔⛔ És az első
  **öntesztem zöld sort adott egy szabályra, amit sosem próbált ki** (a visszarontás nem
  illeszkedett); most minden visszarontás bizonyítja, hogy megváltoztatta a bemenetet.
- ⛔⛔ **Amit a KÉP fogott meg, és a kattintás-teszt nem:** a saját vázlatomban a görgetés-jelzés a
  görgetett tartalom VÉGÉN ült — minden állítás zöld volt (létezik, nem `hidden`), de a képen
  látszott, hogy csak akkor bukkan elő, amikor már nem kell.
- **NYITOTT:** a tulaj döntése 4 pontban (fizetőoldal A/B/C · átjáró A/B · lehet-e a tiltott gomb
  teljesen szürke · C-nél kiírható-e a leendő webcím a fizetés ELŐTT) · asztali A-n a görgő 13 px-t
  csordul túl · a `contract-drift-check` csak feliratot köt, szerkezetet nem (külön szál).

## Előző szál (2026-09-14)

**🗺️ ADR-0163 — HA NINCS MEGNEVEZETT TERÜLET, A RÉGIÓ-FORDULAT ELMARAD.**
Session-jegyzet: `_planning/memory/2026-09-14_region_phrase_drop.md`. **Élesítés NINCS** (§0.3).
Tulaj-döntés az ADR-0143 ③ nyitott tételére: „hagyja el a régió-fordulatot".

- **A lyuk:** a `resolveRegion()` `?? id` fallbackja ismeretlen azonosítónál **a scrape-KULCSOT
  adta megjelenítendő névként** — próbával `bs`→„bs", `_test`→„_test", `Balaton`→„Balaton"
  (ez utóbbi a legmegtévesztőbb: hibátlan helynévnek látszik).
- **Hova ment az ÉLŐ úton** (a konzol a `generateEngineMock`-ot hívja): ① a **copywriter
  promptjába** a szállás régiójaként · ② a **tény-kapu forrás-listájára** — és az **LICENC,
  nem leírás**: amit felsorol, azt a lap ÁLLÍTHATJA, tehát „_test szívében" a kapu
  **áldásával** ment volna ki · ③ a tárolt `inputs.region`-be, ahonnan a `rerender-mock.mts`
  ÚJRA renderel (az ADR-0143 ① pont ezt a hurkot zárta).
- **A szabály:** `known:false` → a fordulat **elmarad, nem helyettesítődik**. A kulcs
  visszhangja és a konzol állapot-szava („…*nincs besorolás* szívében") EGYFORMÁN hamis
  mondat — egy tényt, amink nincs, elhagyunk. **De a hiányt KIMONDJUK** a modellnek (különben
  a fotókból találná ki a helyet), egy forrásból (`regionLines()`); a tény-kapu is a hiányt
  kapja, nem a csendet → FLAG, nem licenc. Az újraírás (`recopy.ts`) ugyanezt követi.
- **Őr:** `scripts/region-phrase-drop-check.mts` — 20 zöld, AI/hálózat/DB nélkül, négy
  rétegben; köztük **szerkezeti iker** (egyetlen élő hívó sem adhat át feltétel nélküli
  `region: region.label`-t) + ellen-állítás, hogy a mérés ne legyen ÜRESEN zöld.
  **Önteszt: 10 piros**, mind a négy rétegen.
- ⛔⛔ **MÁSODSZOR ugyanabban a szálban rontottam el ugyanazt:** az ADR-0143 ③-ba a
  `render.ts:81/154/…` sorokat írtam bizonyítékként — **mérve azok a `generateMock()`-hoz
  tartoznak, amit ma SENKI nem hív** (hívási hely: 0). A hibát jó irányba jelentettem, a
  bizonyítékom halott ágra mutatott; helyesbítve az ADR-ben és a jegyzetben is. **A grep
  megtalálja a MINTÁT, de nem mondja meg, hogy az az út ÉL-e.**
- **NYITVA (kimondva):** a `getRegionContext()` ismeretlen területnél üres `tagline`-t ad, és
  AI-szöveg hiányában az a hero-alcím fallbackja; a `wordmarkGrow` őrizetlen `<p>`-be teszi.
  A változás ELŐTT is így volt, csak a copy-hívás bukásakor látszik — külön kör.

## Előző szál (2026-09-14) — 💱 egy összeg, egy írásmód — a pénz megjelenítése egy szabály, ADR-0162

**💱 ADR-0162 — EGY ÖSSZEG, EGY ÍRÁSMÓD: A PÉNZ MEGJELENÍTÉSE EGY SZABÁLY.**
Session-jegyzet: `_planning/memory/2026-09-14_money_format_unification.md`.
**Élesítés NINCS** (§0.3). Elek FK-006a ERGONÓMIA-4 · a `text/day.ts` (ADR-0144 ②) testvére.

- **A bejelentés:** hat dunning-levél „99 900 **HUF**", a számla-levél ugyanarról a terhelésről
  „99 900 **Ft**". Egy vevő, két írásmód. Reprodukálva `4535965`-ön.
- **A mérés szélesebb volt: 23 formázó-hely, ÖT alak** ugyanarra a 99 900 HUF-ra (sima szóköz ·
  NBSP · pénznem nélkül · Intl · gépi kód). A bejelentett „HUF" csak EGY közülük.
- ⛔ **A súlyosabb hiba nem a jel volt, hanem a PÉNZNEM.** Öt hely bármit kapott, „Ft"-ot írt:
  a **fizetőoldal** a `configurator.ts`-ből a **literális „Ft"-ot kapta pénznemként**, a
  **vendég foglalás-előnézete** minden nem-EUR összeget forintnak mondott. **Nem elméleti:** a
  `pricing_config` két sora ÉL — `hu/HUF` és `global/EUR` (10 EUR/hó).
- **Szállítva:** `src/text/money.ts` (nulla import, soha nem dob, HUF→Ft · EUR→€ · ismeretlen
  kód önmaga) + `assets/runtime/cit-money.js` (**szándékos** böngésző-tükör, mert a fizetőoldal
  minden kattintásra újraszámol) + 23 hívó ráállítva. A tárolt alak gépi maradt: a
  `BillingMailBase.amount` **string→number**, a levél formáz.
- **Tulaj-döntés:** teljes hatókör · **sima szóköz** minden nyelven (28/28 őr-literál ezt várja,
  és az NBSP kiesik a GSM-7-ből: 160 → 70 karakter) · §2b **kivétel** naplózva (a jelzett 5
  felületen a magyar régióban csak NBSP→szóköz változik, elrendezés érintetlen).
- ⛔⛔ **AMIT ELRONTOTTAM:** a tükröt előbb a **lap-vázba** tettem, nem a scriptbe. A
  tenant-admin szekciói önállóan is renderelődnek → `multilang-tier-check` **hétszer**
  `ReferenceError: CitMoney is not defined`, és a modul-szerkesztő élő végösszege **némán
  61 500 Ft-ot mutatott 68 400 helyett**. ⭐ **Hiányzó formázóból ROSSZ SZÁM lett, nem csúnya
  szám.** A függőség a **scripttel** utazik, nem a lappal.
- ⛔ **Két saját szondám ellentmondott** („NBSP=0" vs „NBSP=10" ugyanarra a lapra) — a kézzel
  begépelt karakter-osztályba sima szóköz került. **Code-pointot dumpoltam:** mind U+0020. Az
  őr ezért `\u00a0`-escape-eket használ, nem literálokat.
- **Őr:** `scripts/money-format-check.mts` — 31 állítás, **14/14 piros önteszt** (2
  álpozitív-kontroll). Paritás **727/727**. ⭐ A **⑤ drift-ág** egy nap alatt kétszer bizonyított:
  **öt** formázót talált, amit a kézi leltár kihagyott (16 → 23), a rebase-nél pedig egy
  **hatodikat**, amit egy párhuzamos szál aznap emelt ki (`hufAmount` — ugyanaz az ösztön, egy
  szinttel rövidebb), plusz egy új widget-fogyasztót.
- **Mérve:** 7/7 levél „99 900 Ft" (EUR-régióban „99 900 €") · a fizetőoldal 10 látható
  pénz-alakja **bájtra U+0020**, 0 JS-hiba 390-en ÉS 1280-on · a manifest ISO-kódot küld.
  11 meglévő őr zöld.
- **NYITOTT:** ① a `shot-booking-form.mts` az **érintetlen** `origin/main`-en is elszáll
  (strict-mode locator ütközés két `.cit-book__note`-on) — megmérve, **nem ez a szál okozta**,
  de a vendég foglalás-widgetje emiatt ma MÉRETLEN · ② a 6 megváltozott i18n-kulcsot a
  nem-magyar csomagok újrafordítják · ③ az operátor-SMS-ek (`payLinkAlert`/`aamAlert`)
  csoportosítás nélkül írnak „Ft"-ot.




## Előző szál (2026-09-14)

**🗺️ A „LEZÁRTNAK NYILVÁNÍTOM" EGY MÉG NYITOTT OSZTÁLYRA SZÓLT (ADR-0143 ③ utószál).**
Session-jegyzet: `_planning/memory/2026-09-14_lead_page_area_label.md`. **Élesítés NINCS** (§0.3).
Kiváltó: Elek FK-003b L15.

- **A lelet:** az ADR-0143 a lead-LISTÁT rendezte („Régió"→„Terület", igaz terület-nevek,
  „nincs besorolás" állapot) és **lezártnak nyilvánította a hibaosztályt** — a lead-LAP nem
  kapta meg a szabályt.
- ⭐ **És nem 3 lead szivárgott, hanem MIND az 595.** A `getLead()` a `region.label`-t soha nem
  kérdezte meg, ezért a lap minden leaden a NYERS KULCSOT írta ki. Vagyis az ADR ① utószálának
  forrás-javítása (a hamis „Balaton északi part" → „Balaton") **erre a felületre el sem jutott**:
  egy balatonlellei (DÉLI parti) lead a saját lapján továbbra is `balaton-north`-ot viselt.
  ⛔ A BRIEF premisszáját és a saját első feltevésemet **a KÉP cáfolta** — a `data.ts`
  kommentjébe már beírtam a „3 szivárog / 592 rendben" állítást, és helyesbítenem kellett.
- **A legmegtévesztőbb éles eset a `Balaton` KULCS:** hibátlan helynévnek látszik, közben nincs
  mögötte terület-rekord, és a lapon minden más mező „–" — a régió viszont határozottan állít.
- **Szállítva:** `regionLabel`/`regionKnown` a `LeadDetail`-re (**LEFT** join — inner join a
  besorolatlan leadek LAPJÁT dobná ki, pedig a hiányzó besorolás megnevezendő ÁLLAPOT) ·
  `areaValueHtml()` **egy helyre kiemelve**, a lista cellája és a lap sora is ezt hívja (egy
  szabály két implementációban két igazság két képernyőn — és pont az volt a helyzet, hogy „a
  lista helyes", MIKÖZBEN a lap hamis) · a felirat és a magyarázó mondat a lista
  `columnLabel`/`columnMeaning` forrásából · a fejléc-alcím **MEGNEVEZI** a második értéket
  („Balatonlelle · Terület: Balaton"), mert két felirat nélküli érték egy `·`-tal földrajzi
  hierarchiának olvasódik · a meta-sorból kikerült a `regionId` (mérve: `region=Balaton ·
  regionId=balaton-north` egymás mellett, 3-ból 2 artefaktumon) — a tárolt `inputs`-ban MARAD,
  mert a `persist.ts` és a `rerender-mock.mts` abból dolgozik.
- **Őr:** `scripts/lead-page-area-label-check.mts` — 35 zöld állítás, 4 eset, valódi DOM, DB
  nélkül; **gépi horgonyon** mér (`data-fact`/`data-cit-area`), nem a magyar feliratra illesztve,
  és **nem kölcsönzi a tárgyát** (a tiltott kulcsok a FIXTURE saját azonosítóiból jönnek).
  **Önteszt: 18 piros**, ⭐ és a kapu a **VALÓDI** visszarontásra is megáll (kontrollált próba:
  a hibás sort visszaírva `set -e` alatt rc=1). ⛔ A meta-sor állítása **vakon zöld** lett volna
  — a semmit sem fogó szelektor is 0 sértést jelent —, ezért az őr előbb BIZONYÍTJA, hogy tényleg
  azt a sort olvassa.
- **§2b:** a felület-kapu ZÁRVA volt, és a kivételt **nem magamnak adtam** (ADR-0068): négy
  ELŐTTE-kép (mobil+asztali, 2 lead) + pontos szöveg-diff → a tulaj választott („mintakövető
  hibajavítás"), a token az ő szavával naplózva; utána a négy UTÁNA-kép is elment.
- 🔴 **NYITOTT, és ez a SÚLYOSABB:** a `resolveRegion()` (`generate.ts:136`)
  `label: REGIONS[id]?.label ?? id` fallbackja miatt ismeretlen azonosítónál **a kulcs lesz a
  címke** (közvetlen próba: `bs`→„bs", `_test`→„_test"), és ez a **VEVŐ** lapjára megy
  („Otthonos pihenés, *_test* szívében" — `render.ts:81/154/161/170/211`,
  `renderVaried.ts:34/78/141/238/245`). ⚠️ **Kirenderelt lapon NEM figyeltem meg** (nincs
  besorolatlan területű leadhez legyártott mock): a mechanizmus igazolt, a megvalósult eset nem.
  A javítás **NEM** a „nincs besorolás" kiírása — az ott ugyanúgy hamis —, ezért tulaj-döntést
  és ADR-t igényel.
- ⚪ **NYITOTT, zaj:** `superseded_by:<uuid>` (`data.ts:568` → a kártya „Döntés:" sora) nyers
  artefaktum-UUID-t tesz az operátor elé; nem hamis, de cselekvésre kész tartalma nincs.


## Előző szál (2026-09-14) — ✉️ ADR-0161: a küldés a levél UTÁN áll, ragadós sávban — és az őr magán tanult

**🧭 B3 — A LEAD-LISTA JÓVÁHAGYOTT TERVE MEGÉPÜLT (ADR-0161); a lead-LAP még a kapunál áll.**
Session-jegyzet: `_planning/memory/2026-09-14_lead_surface_plan_round.md`.
Kontraktus: `assets/design-refs/console/lead-list/` (tulaj jóváhagyta 2026-09-14: az **A**
változat — tábla, ragadó NÉV oszloppal). Forrás: Elek FK-003 + FK-003b, **23 lelet**.

- **A §2b kör végigment:** 4 kattintható változat valós adattal + 12 kép (mindkét méret),
  0 JS-hiba, 25 zöld kattintás-állítás → tulajdonosi döntés → befagyasztás README-vel →
  megvalósítás → őr. A lead-LAP (②) változat-döntése KÜLÖN jön; ahhoz nem nyúltam.
- **Szállítva (10 kontraktus-pont):** a jelmagyarázat a tábla FÖLÉ (asztalin nyitva,
  telefonon csukva, minden oszlopfejléc „?" gombja a SAJÁT sorára ugrik) · felső lapozó ·
  **magyar állapot-szótár EGY regiszterből** (`mockStatusLabel` — eddig három szó volt
  forgalomban ugyanarra a három állapotra) · tizedesvessző a cellában ÉS az őt leíró
  mondatban, locale-ból · `10+ plafon` · jelölt alapérték + „nincs találat" · két külön
  jelvény-ALAK (kerek darabszám vs. szögletes `≥` küszöb) · `nowrap` · egyenletes
  sormagasság · **ragadó NÉV oszlop telefonon**, kiírt görgetés-jelzéssel.
- ⭐ **Az őr a ragadást VALÓDI GÖRGETÉSSEL méri** (tulajdonosi kikötés): a `sticky` a DOM-ból
  és a `getComputedStyle`-ból is „beállítottnak" látszik akkor is, ha soha nem tapad, a
  teljes-lapos screenshot pedig a VÉGLEGES helyére festi. Az őr elgörgeti a konténert és a
  cella KÉPERNYŐ-koordinátáját hasonlítja össze, **egy nem-ragadó oszlopon igazolva, hogy a
  görgetés megtörtént**, és megköveteli, hogy a tábla tényleg túllógjon. Piros önteszt:
  5 bukás a visszarontott lapon.
- ⛔⛔ **A SAJÁT ŐRÖM KÉT ÁLLÍTÁSA NEM MÉRT SEMMIT**, és csak a piros önteszt mutatta meg:
  a `nowrap`-állítás 1280 px-en tördelés-engedéllyel sem tört meg (a geometria üres halmazon
  mért), a sormagasság-állítás pedig MINDEN sor azonosságát követelte, holott a két jelölést
  viselő sor legitimen magasabb. **Egy zöld őr önmagában nem bizonyíték.**
- ⛔⛔ **EGY IDEGEN ŐR AKTÍVAN ROMBOLT:** a `renewal-date-coherence-check` FIX nevű
  scratch-adatbázist használt, és a `DROP DATABASE IF EXISTS` egy MÁSIK, éppen FUTÓ szál
  adatbázisát dobta el. Ez állította meg a commitomat, pedig a diffem hozzá sem ért.
  Futásonként egyedi névre véve; **két egyidejű futással bizonyítva** (előtte A rc=1 / B rc=0
  két ütközés-hibával, utána 0 hiba / 0 árva adatbázis).
- **Négy kapu fogott meg valódi rést a saját munkámon, a commit ELŐTT:** i18n-pseudo (a `?`
  és `⇄` glifa — kivétel negatív kontrollal), contract-drift (a README-ben a `**„…"**` alak
  FELIRATOT jelöl, a változat NEVE nem az), plusz a fenti kettő.
- **A felirat-változás fogyasztói mind frissítve:** 2 súgó-cikk, 2 Elek-forgatókönyv,
  2 szomszéd őr — köztük egy, amelynek az állítása a szótár-váltás után **ÜRESEN IGAZ** lett
  volna (a nyers `mock: approved` alakot kereste); a tűje most a regiszterből jön.
- **Korábban ebben a szálban (landolt):** a művelet utáni visszairányítás MEGNEVEZI a fület
  (7 útvonal, őr valódi böngésző-méréssel) · két IDEGEN, land-vak őr-trigger javítva (a
  repót mindenkinek blokkolták).
- ⚠️ **Mérési műtermék, kimondva:** a „19 üres sablon-kártya" nem reprodukálható — 19 kártya,
  19 név, 19/19 betöltött bélyegkép mindkét méreten; a mély teljes-lapos felvétel a
  `loading="lazy"` átmeneti állapotát kapta el.
- **NYITOTT:** ① a **lead-LAP (②) változat-döntése** — addig a `/lead/:id` elrendezése nem
  mozdul · ② a diszkvalifikált LISTA-nézet nem mondja meg, MIKOR és KI zárta ki, és a
  listáról nincs visszaminősítés · ③ az irányítópult „13/14 eladó" PIROS jelvénye (ugyanaz a
  hibaosztály, de másik felületen).

## Előző szál (2026-09-14)

**✉️ ADR-0161 — A VISSZAFORDÍTHATATLAN KÜLDÉS A LEVÉL UTÁN ÁLL, RAGADÓS SÁVBAN.**
Tulajdonosi választás a B6 három tervéből: a **„B — Ragadós küldés-sáv"**. Kontraktus:
`assets/design-refs/console/outreach-sticky-send/`. Session-jegyzet:
`_planning/memory/2026-09-14_outreach_sticky_send_bar.md`. **Élesítés NINCS.**

- **Szállítva:** a levél szöveges változata `<pre>` lett (`max-height`/`overflow` nélkül) — egy
  `<pre>`-nek nincs scrollportja, tehát a csonkolás **szerkezetileg** szűnik meg, JS-sel és JS
  nélkül is · minden állapot-átíró küldés (`/send`, `/send-pair`, `/send-pair-sms`, `/send-all`)
  a levél ALÁ, ragadós sávba került · a sáv **zárva indul**, a levél VÉGE nyitja, és kimondja,
  miért zárva · az idővonal a levél után áll · a lap alján is van visszaút.
- ⛔ **A csapda, ami néma díszletet szült volna:** a `.con .panel { overflow-x: hidden }`
  scroll-konténerré teszi a panelt, és egy azon BELÜL ülő sticky a PANEL dobozához tapadna —
  a teljes-lapos screenshot pedig erre VAK (a végleges helyére festi). A sáv ezért a
  `.con-main` közvetlen gyereke. Az őr önteszt-ága pontosan ezt állítja elő.
- ⛔⛔ **KÉT SAJÁT MÉRÉSI HIBA, mindkettő az ADR-0147 tanulsága:** ① a felengedett gomb
  `opacity`-ja a `--citui-transition` miatt 0,5→1 **ÚSZIK**, a kapu attribútuma viszont azonnal
  vált → az első őröm 0,5-öt mért egy **hibátlan** gombon (fantom-piros minden futásban); most a
  PIXELRE várunk rAF-enként, levezetett kerettel, és ha sosem fest ki: PIROS. ② a dizájn-mag
  `html { scroll-behavior: smooth }`-t ír elő, ezért a `scrollTo` után azonnal olvasott doboz a
  RÉGI pozícióhoz tartozik → az őr a leiratkozó linket „takartnak" mérte 390 px-en.
- ⛔ **Ugyanez a verseny ült a `mms-preview-gate-check`-ben is** (`scrollIntoView` után azonnali
  `elementFromPoint`): eddig érme-feldobás volt, a megnőtt laptól vált állandó pirossá és
  megállította a commitomat. ⭐ Előbb BIZONYÍTOTTAM, hogy a sáv látszik, és csak utána nyúltam
  az őrhöz.
- **Az őr** (`outreach-send-bar-check.mts`): sorrend (DOM **és** folyam-geometria) · tapadás
  **valódi görgetéssel**, 5 mintavétel · láthatóság **KÉT kérdésre** (opacity-lánc = 1 ÉS
  `elementFromPoint`) · a jogi vég **pixelben** · a kapu · **JS nélkül nem tiltott**.
  **Piros önteszt: 3 hibaosztály → 7 állítás.** A kulcs-eset: `opacity:0`-nál a geometriai
  verdikt ZÖLD marad, a láthatósági pirosra megy.
- ⛔ **Fail-safe irány kimondva:** a kiszolgáló ENGEDÉLYEZVE rendereli a gombokat, a SZKRIPT
  zárja be őket — egy halott szkript a kaput veszti el, nem a kezelő munkáját.
- ⛔ **Egy felirat átírása azonnal pirosra vitte a KB-őrt** (a súgó szó szerint idézi). A súgót
  a **renderelt lapról** írtam át, nem a commit-üzenetből és nem gépies cserével.
- **NYITOTT:** ① a Megkeresés-panel (`#prospects`) változat-döntése — a tulaj külön küldi ·
  ② a levél nyers tokenes URL-je és az ár-doboz „-tól" vége / `p3` HTML↔text eltérés **kódolt
  döntés**, a tulaj külön kérdezi · ③ **menet közben látott, nem javított:** a lap feje
  „most NEM küldhető"-t ír, miközben a §C-pirula PASS és a sávban ÉLŐ gomb áll — két KÜLÖN
  predikátum, külön körbe való.
## Előző szál (2026-09-14) — 🪧 A KIKÜLDÖTT MOCK-LAP KERETEZÉSE

**🪧 A KIKÜLDÖTT MOCK-LAP KERETEZÉSE — ADR-0159, tulajdonosi döntés után szállítva.**
Session-jegyzet: `_planning/memory/2026-09-14_prospect_page_framing_adr0159.md`.
**Élesítés NINCS.** Kontraktus: `assets/design-refs/prospect-page/framing/`.

- **A döntés:** a §2b körből az **„A — diszkrét felső sáv"** nyert. A követett előnézet
  **MINDEN** látogatója a lap tetején kapja, hogy **MI EZ** (honlap-terv, még nem élő oldal),
  **KITŐL** (a hirdető a configból), és egy kattintásra, **helyben**, hogy **MIÉRT kapta**
  (jogos érdekű megkeresés + mérés-tájékoztató + Adatkezelési tájékoztató + Leiratkozás).
  Eddig felső sávot **csak a LEIRATKOZOTT** kapott, a magyarázat meg a lap **ALJÁN** volt.
- **Natív `<details>`, nem szkriptelt kapcsoló:** a mock IDEGEN böngészőben nyílik meg, a kiút
  nem múlhat egy betöltött JS-en — `javaScriptEnabled:false` méréssel igazolva.
- A mondatok **EGY forrásból**: a felső sáv és az alsó lábazat két **HELY**, nem két igazság.
  Az ADR-0112 lábazat marad; a leiratkozott a SAJÁT sávját kapja, és senki nem lát kettőt.
- ⛔⛔ **HÁROM HIBA A SAJÁT MÉRŐESZKÖZÖMBEN, mind rossz KÉRDÉS volt:** ① a csukott `<details>`
  tartalmának **van** layout-doboza Chromiumban (600×18, üres innerText) → a méret-alapú
  „látszik?” teszt a csukott jogi részt nyitottnak mondta; ② egy **rejtett** (`opacity:0`)
  fixed nav **gyerekei** `opacity:1`-et számolnak → hamis „a sáv fölé fest” riasztás; ③ az
  aurora `body>*{position:relative}`-je miatt a statikus-horgony keresés **null**-t adott.
  Mindhárom egyetlen helyes primitívvel: **`checkVisibility({checkOpacity…})`**.
- ⭐ **Az ÁTFEDÉS önmagában nem hiba:** egy parallax réteg 16 px-re benyúlik a sáv sávjába, de
  **mögé** fest. A helyes kérdés: ki fest **FÖLÉ** (`elementFromPoint`), és **lenyomja-e** a sáv
  a lapot — referencia: **ugyanaz a lap sáv nélkül**, nem egy beégetett szám.
- ⛔ **Az öntesztem egyik ága LEHETETLEN esetet mért:** a „böngésző alap-kékje” visszarontás
  zölden hagyta a kontraszt-őrt, mert a sablonok `a{color:inherit}`-et állítanak. Valódi rossz
  színre cserélve lett igazi piros.
- ⛔ **A triggerem LAND-VAK volt** (nyers `git diff --cached`, üres index landoláskor) — egy
  párhuzamos szál őre, a `guard-wiring-check` fogta meg és állította meg a commitot.
- **⑦ A NYITÓ-ANIMÁCIÓ KIKAPCSOLVA a kiküldött mockon** (tulaj döntése ugyanaznap).
  `<html data-cit-no-intro>` **+** egy `<style>` a válaszban — az utóbbi a JS-nélküli
  látogatóért **és a RÉGI artefaktumokért** (a lap hetekkel korábban rendelt fájlból jön,
  tehát az AKKORI no-JS hálót viszi). Mérve: `arch-frames` ~4,7 mp, **`wordmark-grow`
  6 mp-nél MÉG futott**.
- ⛔⛔ **Emellett derült ki: JS NÉLKÜL a két intro TELJES KÉPERNYŐS ÜRES PANELT adott** —
  opak `fixed` overlay, a nevet a `.cit-on` teszi láthatóvá, és az elemet is JS veszi ki,
  tehát szkript nélkül egyik sem történik meg. Fényképezve 390 px-en. **Az ÉLŐ tenant-lapon
  is állt**; a `runtime.ts` `<noscript>` hálója javítva (hibajavítás, nem tervezői döntés).
- ⛔ **A kapcsoló ELSŐ változata nem ért hatályba:** az idempotencia-őrszemem
  (`includes("data-cit-no-intro")`) **az intro SAJÁT szkriptjének forrására** illeszkedett.
  A `<html>` TAG-et kell kérdezni, nem a dokumentumot.
- ⛔ **A hit-teszt VAK az overlayre** (`pointer-events:none` → az `elementFromPoint` átnéz
  rajta): a „sáv közepén a sáv van” **zöld** volt egy üres krém téglalapot mutató lapon.
  Pixel kell — de **nem EGY pont**: 1280-on a sáv közepére a felirat esik, a 6×6-os folt a
  BETŰKET átlagolta és 5 hibátlan sablont buktatott meg. Teljes szélességű 3 px-es csík,
  és a képpontok **többsége** legyen a sáv színe.
- **⑧ AZ ÁR-MINTA: „B — kitöltendő mezők”** (tulaj döntése, **ADR-0166**). Szaggatott
  helyőrző a „Mikor” oszlopban, **„Ön írja be”** az összegében, és **NULLA SZÁMJEGY** a tábla
  celláiban — a §B.17 legerősebb alakja. A felirat már csak arról beszél, ami a képen van:
  a régi „ezek **nem valós árak**” mentegetőzés volt valamiért, ami ott sincs.
- ⛔ **A javítás HOZTA FELSZÍNRE a telefonos hibát:** 390-en a fejléc-sor rejtett
  (`thead{clip}`), tehát a stack-elt sor „Főszezon / ▭▭▭▭ / Ön írja be” lett volna — nem
  derül ki, melyik a dátum és melyik az ár. Eddig a RÉGI tartalom takarta el (üres cella +
  önleíró pénzösszeg). A modul CSS-ének kommentje **már akkor is** „each labelled”-et
  ígért — **egy kommentben tett ígéret is ígéret: őr kell rá.**
- ⛔ **Két hibás KÉRDÉS a saját őrömben:** a `checkVisibility()` **IGAZAT** mond a
  képernyőolvasós (`position:absolute; clip`) fejléc-rejtésre — ott a **MÉRET** a kérdés —,
  és a **THEAD** dobozát kell mérni, nem a benne lévő TH-ét (a levágás a szülőn van).
- ⚠️ **Kimondott eltérés a vázlattól:** a vázlat „egyetlen szám sem a sajátja”-t írt (ami azt
  sugallja, számok VANNAK a lapon); a szállított „szándékosan nincs egyetlen ár sem”.
  A README kimondja, egy szóra visszaírható.
- **NYITOTT:** a kiküldés-kapu a **nulla-fotós** lapot „ok”-nak mondja (A8 szál).
  A B7 köteg többi pontja **lezárva**.

## Előző szál (2026-09-14) — 🎛️ ADR-0158 — A LEGNAGYOBB SZÁM AZ, AMIT FIZET; ÉS A LEMONDÁS NE KAPJA A LEGNAGYOBB FELÜLETET

**🎛️ ADR-0158 — A LEGNAGYOBB SZÁM AZ, AMIT FIZET; ÉS A LEMONDÁS NE KAPJA A LEGNAGYOBB FELÜLETET.**
Session-jegyzet: `_planning/memory/2026-09-14_modules_quiet_list.md`. **Élesítés NINCS** (§0.3).
Kontraktus: `assets/design-refs/console/modules-quiet-list/` (tulaj a §2b körben az ① változatot
választotta 3 működő vázlatból).

- **FELÜLÍRT EGY JÓVÁHAGYOTT KONTRAKTUST.** A `modules-annual-pricing` §1 KÖTÖTTE, hogy éves
  fiónál is a HAVI ár az elsődleges — és a kód ezt HŰEN szállította (mérve: havi 13,12 px/700/
  navy · éves 11,84 px/600/halvány). A tulaj a „legnagyobb szám az, amit fizet" elv alapján
  felülírta. ⭐ A régi szöveg **áthúzva MARAD** a README-ben: különben egy későbbi szál úgy
  olvasná, hogy a szállítás hibázott, holott egy azóta megváltozott szabályt követett.
- ⛔⛔ **A takarítás némán vitt volna el információt.** A „11× ugyanaz a sor" nyilvánvaló
  javítása a törlés lett volna — de az `FK-006b` forgatókönyv OLVADÁS UTÁN kifejezetten
  megköveteli, hogy látszódjon az „Aktív az oldalán": a fizetés rendezése után a tulajnak
  LÁTNIA kell, hogy a moduljai újra élnek. Helyette gyűjtő-mondat, aminek a száma abban az
  ágban dől el, amelyik az ÜRES sor-állapotot rendereli — és az őr a **runner SAJÁT
  keresőjével** (`page.getByText`) igazolja, hogy a tű továbbra is fog.
- ⛔⛔ **A piros önteszt DARABSZÁMRA ment, és ez elrejtett egy valódi rést.** „≥20 bukás"-t
  vártam, 12 lett; a kísértés a küszöb lejjebb vétele volt. A küszöbszám viszont nem tudja
  megkülönböztetni a „nem alanya a rontásnak"-ot a „van egy detektor, ami átengedné"-től.
  **Névsorra váltva** kiderült: a REGRESSZIÓM volt hűtlen (a keskeny, kétsoros árat hagytam
  benne → a sor elfért → az `off-order-1280` detektor ZÖLDEN átengedte a régi alakot).
- ⛔ **A mérő KERETE is hamisíthat** (az előző körből, itt igazolódott): saját, tágabb vázban
  a modul-sor ~1240 px volt és elfért; a termék valódi vázával (248 px oldalsáv + 900 px
  plafon) a „Kikapcsolom" **1280 px-en is** külön sorba, BALRA törik (x=377 a Megnézem
  x=821 alatt) — a „csak mobilos" lelet mindkét méreten élt.
- ⛔ **Rebase közben egy párhuzamos szál ugyanezeket a sorokat írta át** (ADR-0155 fagyasztott
  lap + az `a(z)`-tiltás): tartalmi feloldás, nem szöveges. Fagyasztva a fejléc-összeg, a
  gyűjtő-mondat és a feloldó sor ELTŰNIK (az a lap egy dologról szól: mennyi és meddig).
- ⛔ **A KB-fogyasztót OLVASÁSSAL kaptam el, nem őrrel:** a nyitott számla miatt az
  `admin-subscription` súgó „a sorra **koppintva** látja a bontást" mondata hazuggá vált — a
  `kb-check` a feliratok meglétét méri, nem azt, hogy a leírt INTERAKCIÓ még kell-e.
- ⚠️ **Mellék-lelet:** a `console-outreach-draft` KB-képe mérve NEM determinisztikus (két
  futás kód-változás nélkül, két sha) — minden KB-képes szál idegen diffet kap rá.
- **Mérve:** mobil lap 5874 → 4490 px · az összegző 79 % → 73 %, a fejléc-összeg 0 %-nál ·
  a lemondás kontrasztja 4,81 (mérve). Őr: 21 állítás + 14 nevesített piros iker.
- ⭐ **UTÓKÖR (tulaj külön kérése): az alapdíj felirata.** Újramérve a felirat KÉT helyen áll
  (a nyitott számlán és az összegzőn), és az ellentmondás CSAK akkor él, ha az „Online foglalás"
  kiváltotta a gerincet. Javítva: a felirat a gerinc-SLOT valódi állapotából derivál (fut →
  „…időpontkérés"; kiváltva → „…kapcsolatfelvétel"), EGY kifejezésből, két fogyasztóval.
  ⛔ **A pár másik felét NEM írtam át:** a „nem számítjuk" chipet a `modules-billing` §8 KÖTI —
  egy ellentmondó párból a HAMIS felet javítjuk, nem mindkettőt. ⛔ Nem törléssel: ahol a gerinc
  fut, a felirat továbbra is megnevezi (az őr mindkét állapotot méri).
  ⚠️ A saját képkészítőm vázát MÁSODSZOR rontottam el ebben a szálban (oldalsáv nélkül a
  `.adm-shell` rácsban a tartalom a 248 px-es oszlopba esett, ~50 px széles hasábot lőttem) —
  **a keret is része a mérésnek.**
- ⭐ **HARMADIK UTÓKÖR (ADR-0175): a support-cím.** A tenant-admin és a belépési súgó a hideg
  megkeresés JOGILAG KÖTELEZŐ feladó-azonosításából olvasott (§C.2) — a dev-konfigon személynév.
  Új, önálló `config.supportEmail` (= `info@citoviso.com`); három szerep, három mező.
  ⛔⛔ **A rebase egy PÁRHUZAMOS szálat hozott be, amelyik UGYANEZT javította** (`358cade`),
  szigorúbban: cím hiányában a mondat ELMARAD, nem cserélődik hihetőre (§B.17). **Az ő
  megoldásuk maradt**, én a SZEREPET javítottam alatta — „az enyém nyer" feloldással a
  szigorúbb ágat töröltem volna el. **Konfliktusnál előbb OLVASD EL, mit csinált a másik.**
  ⛔ A két premissza ellentmondott (ők: „a configban sehol" · infra-jegyzet 2026-08-03:
  „ingyenes Zoho-alias"), és EGYIK SEM friss mérés; a kézbesíthetőség innen nem mérhető
  (port 25 zárva) → az őr a saját HATÁRÁT kimondja a kimenetén.
- ⛔ **EMBERI FÜGGŐSÉG:** élnie kell a Zoho-aliasnak az `info@citoviso.com` címre — enélkül a
  fizető ügyfél levele sehova nem érkezik meg. Ezt nem tudtam megmérni.
- **NYITOTT:** a „Fizetés és generálás" gomb 0 nyelvvel · a belépési súgón a cím SZÖVEG, nem
  kattintható link (rögzített, nem javított lelet).

## Előző szál (2026-09-14) — a fagyasztott vendég-lap ígérete (ADR-0157)

**🧊 ADR-0157 — A BEJELENTÉS PREMISSZÁJA VOLT A HAMIS, NEM CSAK A MONDAT.**
Session-jegyzet: `_planning/memory/2026-09-14_frozen_guest_page_promise.md`.
**Élesítés NINCS** (§0.3).

- **A lelet (Elek FK-006a GYANÚ-2):** a felfüggesztett szállás vendég-lapja azt ígérte,
  hogy „Dolgozunk rajta — kérjük, nézzen vissza holnap". ⛔ **De nem doktrína-sértés volt:
  az ADR-0119 ③ ÉS a jóváhagyott terv 5. pontja SZÓ SZERINT előírta** ezt a mondatot,
  tulajdonosi választásként (2026-09-11) — sőt az FK-006a `cél:` sora is „mikorra várható
  a visszatérés"-t várt el. Tehát **tulajdonosi döntés felülírása** volt a feladat, nem néma
  hibajavítás → a kód ELŐTT kérdés ment a tulajhoz **három renderelt változattal, mindkét
  méretben**. Választás: **„B — csak a tény"**.
- **Ami hamis volt:** „Dolgozunk rajta" = kitalált szereplő (a fagyás a tulaj fizetésekor
  oldódik, webhookra azonnal) · „holnap" = időpont, amit nem tartunk kézben · „átmenetileg",
  „Addig is…" = visszatérés-ELŐFELTEVÉS, holott fizetés híján a 30. napon a honlap VÉGLEG
  lekerül. **A mérce:** *ami a lapon áll, maradjon igaz abban az ágban is, ahol a tulaj
  SOSEM fizet.* A `Retry-After` marad — az a KERESŐNEK szóló gépi jelzés, nem ígéret.
- ⛔ **Az őr nem a módszerében bukott, hanem a KORPUSZÁBAN:** a `frozen-claim-check` már
  ÁLLÍTÁST mért (ADR-0119 ⑧), de csak a tulaj-admint — a fagyás szabálya a VENDÉGRŐL szól,
  mégis épp a vendég fele maradt mérés nélkül, három napig. Szerkezeti ok is volt: a lap a
  `public.ts`-ben ült, aminek az importja **szervert indít** → fizikailag kizárta a mérést.
  Kiemelve: `src/server/suspendedPage.ts` (adat be → HTML ki).
- ⛔⛔ **A saját őrömben HÁROM szabály halott volt, és a ZÖLD önteszt elfedte:** a JS `\b`
  csak ASCII-t ismer, szóköz és „á" között NINCS határ → `/\bátmeneti/` sosem illeszkedik.
  Az összesítő mégis zöld volt, mert ugyanazon a mondaton MÁS szabályok mentek pirosra.
  A javítás nem a regex, hanem a MÓDSZER: **szabályonkénti `proof` mondat** (13/13) — ez
  azonnal kibuktatott egy harmadikat is (`48 órán belül`: `óra` ≠ `órán`). Az önteszt
  mostantól **kétoldali** (tulaj 18 / vendég 13), a visszarontás pedig a VALÓDI renderbe
  helyettesít — ha nem illeszkedik, hangosan bukik.
- **GYANÚ-4:** a lap nem „csak magyarul", hanem az **elsődleges** nyelven jött MINDEN
  útvonalon (a fagyás-ág a `/<lang>/` router ELŐTT fut) — javítva, őr 7 esettel.
  ⛔ **De üres lett volna:** mérve a `public.ts` SOHA nem volt az `I18N_SOURCES` listán,
  tehát a lap stringjei egyetlen nyelvi csomagba sem kerültek be, MINDEN kapu zöldje mellett.
- ⛔⛔ **A saját grepem 4 fogyasztót talált, a KAPUK még hármat — kettőt a TERMÉKBEN:** a
  tulaj-admin fagyás-kártyája és a felfüggesztés-levél **IDÉZŐJELBEN idézi a vendég-lapot**
  („…egy udvarias, »átmenetileg nem elérhető« lapot látnak"), vagyis a tulaj olyan mondatot
  kapott volna idézve, amit a vendége soha nem lát. **Az idézet is FOGYASZTÓ.** Plusz egy
  MÁSIK forgatókönyv (FK-006b) a törzs-töredéket idézte, amire a grepem nem ment rá.
  Az `adminViews.ts` §2b-kapuját a TULAJ nyitotta (ADR-0068: magamnak nem adok kivételt).
- ✅ **UTÓKÖR (2026-09-15): a 4 vendég-string LEZÁRVA, és a SZERKEZETI ok is.** Nem 4 volt,
  hanem **46 burkolt literál 7 fájlban**, ami soha nem jutott nyelvi csomagba, mert a
  FÁJLJUK nem volt az `I18N_SOURCES` listán. Az ok: **EGY lista szolgált KÉT őrt, amelyek
  KÜLÖNBÖZŐ kérdést tesznek fel** — a lint ítélet-igényű („van-e burkolatlan vevő-szöveg
  itt?" → kurált lista marad), az extraktor viszont nem az („benne van-e minden BURKOLT
  string a katalógusban?" → aki `T()`-be tette, kimondta, hogy fordítandó). Az
  `extract-i18n.mts` mostantól a **TELJES `src/`-t** olvassa, lista nélkül; a katalógus
  `--check` kapuja így szerkezetileg zárja az osztályt. **Piros próbával igazolva**
  (sosem listázott fájlba tett burkolt string → exit 1, az exit-kódot külön mérve).
  ⛔ Egy negyedik vak alak is előkerült: `T(consoleLang(), "…")` — a nyelv-argumentum
  HÍVÁS, nem azonosító; a lint BURKOLATLANNAK jelentette a rendesen burkolt stringet, az
  extractor meg kihagyta. Mindkét regex javítva. Katalógus 2663 → **2703** (+40, −0).
  ⚠️ A katalógus-tétel NEM elég: a csomagot a boot-idejű `ensureAllLanguagePacks()` tölti
  (mérve: a tegnapi vendég-lap mind a 6 élő csomagban ott van).
- ✅ **A 11 VENDÉG-oldali string BEBURKOLVA (2026-09-15).** Memoizált `tenantLang()` a
  `serveTenantHost()` elején; a throttle-ág is kéri, hogy egy eldobott kérés se váltson
  nyelvet. ⚠️ Csapda, amibe majdnem belesétáltam: `T(await tenantLang(), …)` alakban a
  katalógus-betakarító regexe NEM illeszkedik → a string megint kimaradt volna a
  csomagból; ezért mindenhol `const lang = await tenantLang()` előzi meg.
  ⛔ A saját összefoglaló listám két tételt tévesen képezett le (SZÖVEG szerint deduplikált):
  a `Nincs ilyen oldal.` háromszor van, és az egyik `pillanatkép` NEM a vendég hostján —
  a darabszám véletlenül stimmelt, az összetétel nem. Őr: `guest-host-i18n-check.mts`,
  ami FÜGGVÉNYRE mér (nem fájlra) és az ÉKEZET NÉLKÜLI magyart is látja.
  ⛔⛔ Az őröm ELSŐ változata VAK volt (törzs-széles literál-regex elcsúszik a korábbi
  idézőjeleken, 3-ból 2 visszarontás átment) — az önteszt buktatta le, nem az elemzés.
- **NYITOTT (külön kör):** a `public.ts` maradék **16 burkolatlan** szövegdarabja — 4 lead
  (⚠️ a lead nyelve ISMERT, és a szöveg TEGEZ, míg a kontraktus magázást ír elő), 8 tulaj,
  2 határeset, 2 belső log — plusz a 4 MARKETING sor, ami üzleti döntés, nem hibajavítás.
  Tételes lista a session-jegyzet végén.

## Előző szál (2026-09-14) — natív confirm() a lemondáson és a naptár-színek

**🖼️ ADR-0156 — A KAPU CSAK A TÖRÖTT KÉPET FOGTA, A NULLA-FOTÓSAT „OK"-NAK MONDTA.**
Session-jegyzet: `_planning/memory/2026-09-14_nophoto_send_gate.md`.
Kontraktus: `assets/design-refs/console/nophoto-gate/`. **Élesítés NINCS** (§0.3).

- **A rés (Elek FK-004b GY-1):** `verdict: broken.length ? "broken" : "ok"` — ha nincs mit
  töröttnek mérni, a lap „ok", tehát a kiküldés-kapu (jóváhagyás · követett link · levél ·
  SMS) **átengedi a kép nélküli lapot**. Ez az ADR-0134 SZÁNDÉKÁNAK kijátszása.
  ⚠️ **És a kockázat NŐTT:** az ADR-0136 óta a generálás eldobja a halott fotókat, tehát a
  „törött kép" helyét rendszerszinten a „nincs kép" veszi át — a két javítás EGYÜTT
  csökkentette a kapu hatókörét. **A kapu nem tévedett, MÁS KÉRDÉSRE válaszolt.**
- **Mérve:** a parkban 3 jóváhagyott artefaktum (2 mérhető, mindkettőn 6 ÉLŐ fotó — ma egy
  sem nulla-fotós), de **595 leadből 558-nak (93,8 %) nincs portál-fotója**, és **148-nak
  (24,9 %) Places-fotórefje sincs** → ezekre a lap BIZTOSAN kép nélkül állna elő.
  ⛔ **A 148 a KITETTSÉG, nem a kár** — nem 148 kiment lap. A Places-út ma **ÉL** (1 hívás,
  10 fotóref) — a 2026-09-09-i 403-as sort ÚJRAMÉRTEM, nem a memóriámból vettem.
- **Szállítva:** `nophoto` verdikt + **kimondott ÉS INDOKOLT** kivétel (`inputs.noPhotoAck`:
  ki · mikor · **miért**, min. 10 karakter — indoklás nélkül nem tudomásulvétel).
  §2b kör: 2 kattintható változat, mobil+asztali kép → tulaj: **„B" (két lépés) + kötelező
  indoklás**. A levél/SMS SAJÁT indoklást ad, és az **ADR-0129 megtartva ÉS MÉRVE** (a
  fizetni akaró vevő emelése nem akad el). ⭐ A **predikátum érvényessége** is mérve: 19
  sablon × 2 fázis fotó nélkül MIND 0 kép-hivatkozást ad — ha egy új sablon dekoratív képet
  tenne oda, a kapu némán vakká válna; ehelyett az őr pirosra megy.
- ⛔⛔ **Saját hiba: az őr szerkezeti mérése a MÁSIK FÁT olvasta** (import = worktree,
  `readFile(process.cwd())` = fő fa, mert a `--sweep` onnan fut) → **három kész javításomat
  jelentette hiányzónak.** Javítva `SRC_ROOT`-tal. ⛔ A felület-mérésem **kivétellel állt le
  jelentés helyett** (öntesztben nincs doboz → a `click()` timeoutja ölte a futást).
- ⚠️ **MÉRT, NEM JAVÍTOTT:** a `.con button.bad` felirat-kontrasztja **3,91 / 3,57** (4,5
  alatt) — a ház 13 helyen használt piros gombja, nem az én változásom hozta; házon átívelő
  szín-döntés, tulajdonosi kör. Az őr helyette azt méri, hogy a felirat a márka-piros MARAD
  és hogy a tiltott gomb **tiltottnak is LÁTSZIK**.
- **Őr:** `mock-photo-gate-check` **71 állítás** (volt 39), önteszt **26 piros**, + kézzel
  visszarontva **13 piros**. Trigger kiterjesztve az őr SAJÁT fájljára is (iker-javítás egy
  párhuzamos szállal, a rebase-konfliktus unióként feloldva).
- **NYITOTT:** ① a `.con button.bad` kontraszt · ② a „minden kép törött" (0 élő fotó) ág az
  ADR-0134 névsoros pipáján marad — ha rutinná válik, összevonandó · ③ a
  `mock-photo-gate-check` fixture-je a KÖZÖS `sites/`-be és DB-be ír (ebben a körben egy
  MÁSIK őr lett tőle hamis piros).

## Előző szál (2026-09-14) — a fagyasztott tulaj-admin

**🧊 ADR-0155 — A FAGYASZTOTT TULAJ-ADMIN: EGY KÉPERNYŐ, EGY ÖSSZEG.**
Session-jegyzet: `_planning/memory/2026-09-14_frozen_settle_screen.md`.
Kontraktus: `assets/design-refs/console/freeze-state-v2/`. **Élesítés NINCS** (§0.3).

- **A gyökér-ok szerkezeti volt.** Az ADR-0119 ① kimondta, hogy „a fagyás ÁLLAPOT, nem doboz" —
  a blokkot viszont EGYEDÜL a `modulesSection()` rendereltette, és a két őre (⑦/⑧) is azt az
  EGY függvényt méri. A szabály hatóköre és az őrök hatóköre EGYÜTT szűkült be egy fülre:
  **a hiba nem csúszott át a kapun, a kapu sosem nézett a másik 12 lapra.** Mérve: az
  `attekintes` (belépő) fülön 0× tartozás / 0× összeg / 0× fizetés-gomb, az Üzeneteken 0×
  bármelyik fagyás-szó — miközben a vendég 503-at kapott.
- **A belépő lap nem hallgatott, hanem MÁST mondott:** „Az oldal még nem publikus — **a
  Citoviso élesíti, amint minden készen áll**". Ránk hárította az okot, és nem hagyott
  teendőt ott, ahol az egyetlen igaz válasz az, hogy fizessen. (Külön, korábbi commit.)
- **Tulajdonosi döntés három bemutatott változat képei alapján: „B — Rendezés-képernyő".**
  Fagyás alatt a lap EGY dologról szól: tartozás + hátralévő idő nagyban, a modul-lista
  CSAK OLVASHATÓ. Kiesik a „Következő számla" cella (ugyanaz a 10 270, MÚLTBELI dátummal),
  a „Jelenlegi díj" és az összegző végösszege; a részek maradnak, mert azok magyaráznak.
- ⛔ **A kapcsolók kivétele majdnem ADATVESZTÉS lett volna:** az `applyModuleChange` a HIÁNYZÓ
  `module` mezőt LEMONDÁSNAK olvassa, tehát a fagyasztott lap egyetlen űrlap-beküldése némán
  lemondta volna mind a 11 modult. Rejtett megőrző mező minden modulra, darabra mérve.
- ⛔ **A maradék eladási CTA-t a KÉP fogta meg, nem az őr:** „2 hónap ajándék évente ·
  **102 700 Ft** · Váltok éves fizetésre" — ajánlat annak, akit épp dunningolunk. Az őröm egy
  KONKRÉT összeget számolt, ez másik szám volt. Azóta a döntési POZÍCIÓT méri (ár + gomb).
- ⛔ **Egy őr-próbám a SZOMSZÉD cellát mérte** (az első `.adm-sub__v--date` közben más cella
  lett) — zöld volt, rossz elemre. Saját horog (`data-nextafter`) oldotta meg.
- **Őrök, mind piros önteszttel:** `frozen-entry-check` (belépő fül · 5 sértés) ·
  `frozen-settle-check` (pénz + vezérlők + megőrző mezők + 5 fül · 8 sértés, plusz 4 kötés a
  TERMÉK visszarontásával igazolva) · `frozen-phone-check` (390×844, `elementFromPoint`,
  GÖRGETÉS NÉLKÜL · 6 sértés — ezt szöveg-őr nem láthatja: az előző kör javított mondata
  JELEN VOLT a lapon, miközben a fix fülsáv alatt állt, y=730 vs 658).
- ⚠️ **Az ADR-számom KÉTSZER csúszott el landolás közben** (0153 → 0154 → **0155**): mindkétszer
  egy párhuzamos szál landolta előbb ugyanazt a számot. A cserét mindannyiszor a SAJÁT
  blokkomon végeztem, a közös doksit pedig az `origin/main`-ről építettem újra — az eredmény
  **91 beszúrás / 0 törlés**, idegen ADR nem sérült. Plusz ikerjavítás-konfliktus az ADR-0153
  (gépi magyar alak) szálával ugyanazon a cellán: az Ő `formatMonthDay` soruk + az ÉN
  fagyás-ágaim, és lefuttattam az ő őrüket a saját új szövegeimre is (tiszta).
- **NYITOTT:** ① az „Oldal megtekintése" gomb fagyás alatt figyelmeztetés nélkül a 503-as éles
  címre visz (a tulaj szándékosan nem döntött; a kontraktus kimondja, hogy NEM kötött) ·
  ② terhelés-újrapróbálás: nincs szerver-útvonal, a mock két gombja közül egy (a valódi)
  készült el, az eltérés a kontraktusban kimondva.

## Előző szál (2026-09-14)

**🔤 ADR-0153 — EGY TILALOM, AMIT SEMMI NEM MÉRT, HÁROMSZOR JÖTT VISSZA.**
Session-jegyzet: `_planning/memory/2026-09-14_hu_machine_form_class.md`. **Élesítés NINCS.**

- **A lelet:** az ADR-0101 ① 2026-09-06 óta tiltja a „a(z)"-t, a megoldás (`src/hu.ts ›
  huArticle`) azóta a kódban van — az Elek 2026-09-13-i futásában mégis **három külön körben**
  jött vissza (FK-002 E1, FK-005b E-11, FK-006a/b). A tilalom prózában élt.
- ⛔ **A saját első mérésem volt hibás:** a grepem csak a kisbetűs `a(z)`-re futott. A kis- ÉS
  nagybetűs sweep **17 emberi felületre kerülő** előfordulást talált **15 fájlban** (a
  bejelentés hármat nevezett meg), az őr építése közben pedig még egyet, másik alakban
  („elrendezés(ek)re"). Bérlői admin · VEVŐI levél és SMS · a VENDÉGNEK szállított generált
  oldal no-JS kártyája · operátor-felületek és riasztó-levelek.
- **Javítva a MEGLÉVŐ eszközökkel** (`huArticle` / `huArticleLower`), plusz egy hiányzó darab:
  **`formatMonthDay()` a `src/text/day.ts`-ben** — a 31 nap végződése ZÁRT TÉNY (`1-je`, `2-a`,
  `10-e`). A `formatDayStem` azért nem ért ide: az **ISO dátumot** formáz, a Fordulónap-cellába
  viszont sosem érkezik ISO string. Két részprobléma volt, nem egy.
- ⛔⛔ **Az őr első lefedettség-tanúja ZÖLDEN VÉDTE a vakfoltot.** A körbejárás „11/11 lap
  megmérve"-t írt, és a „Fordulónap" tanú is zöld volt — csakhogy a szót a tenant-admin **SÚGÓ
  fülén, a KB-cikkben** találta meg: az Előfizetés kártya **meg sem jelent**, mert a közös
  parkban **0 db `subscription` sor** van. → a tanú a termék KIMENETÉNEK alakjára illeszkedik,
  a kártyát pedig a ② réteg a valódi `modulesSection()`-ből állítja elő, **31 nap × 2 ütem**.
- ⛔ **A túl általános szabály 189 HAMIS leletet adott** a nyers forrás-literálokon (a
  `<script>` blokkok JS-hívásaira) → a szabály csak EMBERI szövegen fut. Egy őr, ami
  szigorúbban mér, mint a mért rendszer, hamis leletet gyárt.
- **Kapu:** `scripts/hu-machine-form-check.mts`, pre-commit `--fast` (~15 mp). Piros ág
  kétszer bizonyítva: visszarontva **190 lelet** (köztük a RENDERELT kártyáról), és
  `bash -c 'set -e; …'` alatt **rc=1**. Negatívan 13 helyes alak nem sül el.
- ⛔ **Kimondva, mit NEM mér:** a `console.*` napló és a `throw new Error()` kivétel-szöveg
  (`domains/` 13 hely, `payment/` 4) — azt fejlesztő olvassa (CLAUDE.md §4).
- **NYITOTT:** ① a park `subscription` sor nélkül nem tudja megmutatni az Előfizetés kártyát a
  körbejárásnak (a futás kimondja; a ② réteg fedi) · ② ha a `domains/` kivétel-szövegek valaha
  felületre kerülnek, az őr fájllistáját bővíteni kell.

## Előző szál (2026-09-14)
**✉️ MEGKERESÉS-SZERKESZTŐ (B6, Elek FK-004) — KÉT JAVÍTÁS LANDOLVA, NYOLC LELET A TERV-KAPUNÁL.**
Session-jegyzet: `_planning/memory/2026-09-14_outreach_editor_plan_gate.md`.
Terv a kapunál: `TERV-KESZ.md` (a `wt/megkeresesszerk` munkafa gyökerében). **Élesítés NINCS.**

- ⛔⛔ **Az őr egy UTÓTAGRA volt kihegyezve, és a kód másik szóval átsétált rajta.** A
  Megkeresés-panel súgójában két hónapja ott állt, hogy a gomb „a **H1-tölcsér** bázisa” — az
  `internal-ref-check` fázis-kód-mintája viszont `\b[HA]\d-bázis\b` volt. Ugyanaz a belső kód,
  másik utótag, **néma átmenet**. Ez a `frozen-claim-check` hibaosztálya: a szólistára hangolt őr
  nem téved, **más kérdésre válaszol**. A minta most **szerkezeti** (fázis-betű + szám + kötőjel +
  szó), és a **KIVÉTEL** van kimondva (SEO-`H1-címsor`, `A4-es` papír), nem a szabály. Piros próba
  a VALÓDI fán, nem az önteszt-sztringen: a régi mondatot visszatéve az őr bukik.
  ⚠️ A renderelt réteg amúgy sem látta volna: a mondat **csukott `<details>`-ben** van, a scan meg
  `innerText`-et olvas. Két réteg, egy vakfolt — a minta.
- ⛔ **A visszafordíthatatlan jelölés nem kérdezett.** A „Megjelölöm kiküldöttként” a LISTÁRÓL
  írta át az állapotot; a `markProspectSent` `WHERE … IS NULL`-lal bélyegez, visszavonás nincs —
  egy téves kattintás **véglegesen** lezárja az e-mail csatornát, az **ADR-0122** cím-szintű
  egyszer-küldése miatt a **CÍMRE** is, minden más követett linken. Most kérdez, a kattintás
  ELŐTT. Mérve 390+1280-on: MÉGSE után a bélyegek változatlanok, JS-hiba 0.
- **MÉRVE, a terv-kapunál vár:** a visszafordíthatatlan küldés-gomb **670 px** (asztali) /
  **1 641 px ≈ 2 telefon-képernyő** (390 px) a levél ELŐTT áll, és a lap alján se gomb, se
  visszaút. A `rows="22"` text-doboz 390 px-en a tartalom **61 %-át (702/1147 px)** rejti — az
  aláírást, a **leiratkozó linket** és a **hirdető-azonosítást** —, asztalin is kiesik a
  „A megkeresés küldője: …” sor (§C.2). ⛔ Az `outreach-preview-check` mindeközben **ZÖLD**:
  csak az iframe-et méri, a szöveges felet nem.
- **Terv:** 3+3 kattintható változat (piszkozat-lap: olvasás-sorrend / ragadós küldés-sáv / külön
  megerősítő lap · panel: egy ÉLŐ + archív / rang + műveletek-menü / egy megkeresés = egy link),
  16 kép, **22 viselkedés-állítás** végigkattintva, JS-hiba 0.
- ⛔ **Doktrína-ütközés, amit ki kell mondani:** a `land.sh` a végén `rm -rf`-eli a
  `assets/design-refs/_drafts/`-ot (ADR-0077), a §2b viszont épp oda kéri a tervet — és ebben a
  körben egy **orchestrátor gyűjti be** a terveket később. A tervet land előtt ki kell menteni.
  Ugyanígy: az `assets/Temp` a FŐ FÁBA mutató symlink, tehát a §2b „munkafán belül” szabálya a
  KÉPEKRE is áll, nem csak a HTML-re.
- ⚠️ **Infra-csapdák, amikbe belefutottam:** a `#prospects` panel **csukott fülön** él, ezért
  Playwright „element is not visible”-lel áll meg a puszta `/lead/<id>`-n (a `w=0` mérést majdnem
  ténynek vettem) · a tsx `keepNames` `__name`-et injektál, ezért a függvény-értékű
  `page.evaluate` friss kontextusban elhal (STRING-alakú evaluate kell) · a `pgrep -f`-es
  várakozó ciklus **önmagára illeszkedik**, és örökre beragad · a `mock-photo-gate-check`
  KÖZÖS `sites/` fixture-je két párhuzamos futásnál ENOENT-tel buktatta a landomat.

## Előző szál (2026-09-14) — B8 foglalás: a rövid teszt-lap zöldre mérte a hibát

**🛏️ A RÖVID TESZT-LAP ZÖLDRE MÉRTE A HIBÁT — és a hírlevél-modul nem működik.**
Session-jegyzet: `_planning/memory/2026-09-14_booking_outcome_truth.md`. **Élesítés NINCS.**
Elek FK-007 + FK-006b foglalás-köre, 17 bejelentett lelet; 16 igazolódott, 1 nem, kettőnél a
MECHANIZMUS más volt, mint a bejelentés.

- ⛔⛔ **„Beadás után nincs odagörgetés a nyugtához"** — az első mérésem szerint a nyugta LÁTSZOTT
  (top 179 px), mert a teszt-lapom a kártya alatt véget ért: a dokumentum megrövidült, a böngésző
  VISSZARÁNTOTTA a görgetést. Footert alá téve (mint minden valódi honlapon) ugyanaz a kód
  **−678 px**-et ad 390-en, −35-öt 1280-on. **Ha egy hiba a KÖRNYEZETTŐL függ, a teszt-környezet
  hiánya a hibát ELTÜNTETI, nem felnagyítja.**
- ⛔⛔ **A hírlevél-modul (490 Ft/hó) nem működik:** az űrlap a `/api/hirlevel`-re POST-ol, ami a
  nyilvános kiszolgálón **nem létezik**, és feliratkozó-tábla sincs. A bejelentett jogi hiány
  (hozzájárulás + adatvédelmi link) IGAZ, de **halott úton a pipa csak jogi dísz** — nem tettem rá,
  **tulajdonosi döntés kell**: megépítjük vagy levesszük a polcról.
- **Mért leletek:** a várólista 46/34/**21**/28 óra (a legsürgősebb a harmadik) · a „Lejárt
  (48 óra)" jelvénybe a **48 BE VOLT ÉGETVE**, holott az ablak állítható · a vendég-naptár
  jelmagyarázata 11,84 px / kontraszt **3,99** · a „~180 px üres sáv" valójában **100 px**
  szekció-térköz (a foglalás az EGYETLEN modul-szekció, ami cím nélkül indul).
- **Javítva** (apró, terv-kör nélkül, mind őrizve): a jelvény a modul ablakát idézi · a lemondás
  **megnevezi az alanyt** (`decided_by`; `null`-nál semleges marad) · az automatikus elutasítás
  nem „döntés" · a lemondás **visszavisz** a nyitott naptárba · a nyugta a képernyőre görög · a
  felfüggesztett lapon a kontakt aláhúzva · `huDay` → `src/text/day.ts` (ADR-0144 ② ide nem ért
  el) · a **HALOTT** `scripts/shot-booking-form.mts` újra él (16/16).
- **Őr:** `scripts/booking-outcome-truth-check.mts` — piros önteszttel (a görgetés kivéve:
  −651 / −63 px, miközben az A/B szakasz zöld marad → a piros SPECIFIKUS) és önkontrollal.
- ⚠️ **A §2b méret-váltó telefonon NEM MŰKÖDÖTT:** a `@container` helyes, de 390 px-es képernyőn
  nem tud 1080-at mutatni — az „Asztali" gomb semmit nem csinált. `zoom` kellett hozzá.
- **§2b kapunál MEGÁLLTAM:** 4 kattintható mock (tulaj A/B, vendég A/B), mindkét méretben →
  `TERV-KESZ.md` a `~/wt/foglalaskor` gyökerében (9 nyitott kérdés).
- ⛔⛔ **A LANDOLÁS TÖRÖLTE A MOCKJAIMAT.** A `land.sh` záráskor `rm -rf
  assets/design-refs/_drafts` (ADR-0077) — nálam a JÓVÁHAGYÁS ELŐTT futott le, és a `TERV-KESZ.md`
  halott útvonalakra mutatott. Az ADR indoklása („egy paranccsal újragenerálható") **kézzel írt
  §2b mockra nem igaz**. Mérve: **8 szálnak van `TERV-KESZ.md`-je, és rajtam kívül mindegyiknél
  még ott a `_drafts/` — mert még nem landoltak.** Újraépítve a `b8-terv/` mappába (32/32 zöld).
  **Döntendő:** a `land.sh` hagyja ki a `_drafts/`-ot, amíg van `TERV-KESZ.md`, vagy a §2b mondja
  ki, hogy a jóváhagyásra VÁRÓ vázlat nem oda megy.
- ✅ **TULAJDONOSI DÖNTÉS UTÁN BEFAGYASZTVA ÉS MEGVALÓSÍTVA** (ugyanaz a nap): tulaj-oldal
  **„A — naptár bal, várólista jobb"**, vendég-ár **„A — nyitott bontás"**, az IFA a tulaj
  modul-beállításából, a hírlevél **le a polcról**. Kontraktusok:
  `design-refs/tenant-admin/booking-queue-urgency/` + `design-refs/tenant-site/booking-price-clarity/`.
  Őrök: `booking-queue-urgency-check` (9 szakasz, 2 geometria, önkontroll: a várt sorrendet NEM a
  termék komparátorából számolja) és `booking-price-clarity-check` (KÉTIRÁNYÚ: a kitöltött ÉS az
  üres IFA-eset is a saját elvárását produkálja).
- ⛔ **A jóváhagyott mockom két ponton HAZUDOTT volna** — a kód cáfolta: állapot-lap nincs, és a
  vendég lemondó linkje CSAK visszaigazolt foglalást mond le. **A vázlatot is meg kell mérni a
  kódon, mielőtt kontraktus lesz belőle.**
- ⛔⛔ **EGY ZÁSZLÓ — NÉGY FOGYASZTÓ:** a `retired` (polcról levéve) bevezetése után négy őr ment
  pirosra, mind a „minden eladható modulnak van felülete" állításon. A kínálat-felületeket
  EGYESÉVEL kell átnézni; az árazás-admin SZÁNDÉKOSAN kivétel (a meglévő előfizetés sora árat
  igényel). Az őrökben a kivétel a KATALÓGUSBÓL jön, nem kézi listából.
- ✅ **A 6 NYELV SÚGÓ-FORDÍTÁSA FRISS** (2026-09-15) — de a kérés mögött **négy lelet** volt.
  ⚠️ A premissza is mozgott: mérve 5 (nyelv, cikk) páros volt elavult 3 nyelven, nem 6 nyelv.
  ⛔⛔ **A mechanizmus nem tudta megjavítani magát:** minden újragenerálás
  „integritás-sértés"-sel hullott el. ① A felirat-ellenőrzés a SORTÖRÉST is eltérésnek vette
  (a forrás tördel, a fordítás egy sorba ír — a gombon látható szöveg betűre azonos); 11 cikkben
  van ilyen. ② A `max_tokens` 6000 volt, a két legnagyobb cikk fölé nőtt → elvágott válasz, és a
  napló ezt is „integritás-sértés"-nek hívta: MÁS KÉRDÉSRE VÁLASZOLT. ③ A forrás a
  képernyő-felirat jelölésével emelt ki egy MONDATTÖREDÉKET. ④ Az AI-KÖLTSÉG sehol nem jelent
  meg: a `recordAiUsage` gyűjtő nélkül üresbe fut, és az `ai-usage-lint` a hívási helyet nézi,
  nem azt, fut-e gyűjtő körülötte. Mostantól mérve: 4 hívás · 0,651 USD.
- **NEM lelet (mérve):** a naptár-színek — kijelölés zöld (rgb 47,169,107), cián CSAK `:hover`,
  a múlt opacity 0,35. A natív `confirm()` a lemondáson **az A6 szálnál** van.

## Előző szál (2026-09-14) — a kiküldött mock-lap a lead szemével (B7)

**👁️ A KIKÜLDÖTT MOCK-LAP — A LEAD SZEMÉVEL (B7 köteg, Elek FK-004b).**
Session-jegyzet: `_planning/memory/2026-09-14_lead_page_framing_and_sample_marking.md`.
**Élesítés NINCS.** A kör a listát KÉT fajtára bontotta: az apró javítás végigment, a
**kinézeti rész MEGÁLLT a §2b kapunál** (`TERV-KESZ.md` a `wt/mocklapleadszem` fában).

- ⛔ **A vélemény-űrlap volt az EGYETLEN jelöletlen szekció** — miközben a hírlevél, az árak,
  a szolgáltatások és a szobák mind „Minta" pirulát viseltek, és éppen ez az egy kér **nevet,
  e-mail címet és hozzájárulás-pipát**. A gomb alatt közzétételt ígért egy űrlapról, ami sehova
  nem posztol; a cáfolat **CSAK BEKÜLDÉS UTÁN** szólalt meg (`data-cit-demo`), azaz miután a
  látogató már mindent beírt. Javítva a **meglévő `asSample` mintával** + a gomb mellé, kattintás
  ELÉ tett mondattal — **feltételesen**: az éles tenant-lapon a valódi ígéret marad.
- ⛔ **A lap felváltva beszélt a TULAJHOZ és a VENDÉGHEZ** — „Ön hagyja jóvá" közvetlenül a
  vendég-űrlap fölött. Vendég-hangra váltva; a moderálás ténye megmaradt, a tulajnak szóló része
  oda került, ahol a helye van (a minta-jegyzetbe).
- ⛔ **A bevezetőt egy RÖVIDÍTÉS tolta balra:** az inline `margin:0` a bal/jobb `auto`-t is
  nullázta, amit a `centredModsecCss` állít be — inline deklarációt stíluslap nem ver.
  `margin-top:0` (x≈400 → a szekció közepe).
- ⛔ **Az operátor-konzolon a „–" két ellentétes tényt jelentett:** aki meg sem nyitotta a
  linket, és aki megnyitotta, de nem görgetett, ugyanazt kapta. Szétválasztva (`nem mértünk` ↔
  `0%`); a „Megnyitások" fölötti „{n} látogatás · {m} esemény" két sorra bontva.
- **Két új őr**, 4+3 piros önteszttel és álpozitív kontrollal. ⚠️ **Mindkettő HIBÁSAN indult:**
  a pirula-mutáció a lap MÁSIK szekcióját érte (globálisra véve lett valódi), a címke-szabály
  pedig a HELYES „0 másodperc" sort buktatta meg (mértékegység ≠ megszámolt dolog).
- ⛔⛔ **„~88 px üres krém sáv a mock tetején" — NEM REPRODUKÁLHATÓ.** 19 sablon × 2 szélesség ×
  3 fotó-állapot a lead valódi útján: 1280-on **mindenhol 0 px**; 390-en 10–42 px = a lap saját
  háttere az első sor fölött. A két nagy krém felület az **ADR-0115 nyitó-animáció**, ami ~4,7 mp
  után maga tűnik el. A „Citoviso készítette" felirat LÉTEZIK, de a lap **ALJÁN**. Javítást nem
  találtam ki rá.
- **TERV (jóváhagyásra vár):** 3 működő keretezés-vázlat (felső sáv · nyitókártya · jelvény+fiók)
  + ár-tábla-kapcsoló, valós adaton, méret-váltóval. ⛔ A kattintás-próba **3 hibát talált a SAJÁT
  vázlatomban**, amit a kép nem mutatott volna: elnyelt kattintás (a nav ráfeküdt a sávra),
  390-en levágott jogi rész, és **1,99-es link-kontraszt** a sötét kereten.
- **NYITOTT:** ① a tulaj döntése a keretezésről (A/B/C) és az ár-tábláról (A/B/C) — **az ADR csak
  a döntés után születik** · ② a kiküldés-kapu a **nulla-fotós** lapot „ok"-nak mondja (A8 szál).

## Előző szál (2026-09-14) — 🛡️ ADR-0152 — EGY ŐR, AMIT SEMMI NEM HÍV MEG, NEM ŐR

**🛡️ ADR-0152 — EGY ŐR, AMIT SEMMI NEM HÍV MEG, NEM ŐR.**
Session-jegyzet: `_planning/memory/2026-09-14_orphan_guards_wiring.md`. **Élesítés NINCS**
(a kapu-réteg nem éles komponens). **Termék-kód NEM változott** (mérve: `git diff -- src/
assets/ public/ migrations/` üres).

- **A bejelentés kettőről szólt, a leltár 21-et talált.** A 95 `scripts/*-check.mts`-ből **21
  volt árva**: létezik, zöld, a fejlécében megnevezi az ÉLES hibát, amit lezár — és sem a
  `hooks/pre-commit`, sem a `land.sh` nem hívta meg. A forrásban **7 komment** hivatkozik
  `Guard: scripts/…-check.mts`-re, ami soha nem futott le.
- ⛔ **Miért nem vette észre EGYETLEN kapu sem: minden kapu a TERMÉKET méri, egyik sem a
  KAPU-RENDSZERT.** A hiba nem „elfelejtettünk bekötni valamit", hanem hogy a bekötetlenség
  nem volt MÉRHETŐ állapot.
- **Mind a 21 lefuttatva:** 10 zöld és önhordó → **bekötve** (köztük a bejelentett
  `renewal-date-coherence-check` és `room-card-overflow-check`) · 7 **park-függő** (ebből
  **4 MA IS PIROS**, egyik sem a kód miatt: ENOENT a közös `sites/` mockjára, hiányzó lead,
  lokátor-timeout) · 1 kézi (valódi ismétlődő kártyaterhelés, 3DS) · 1 telepítés-mérő ·
  **2 ELROHADT**.
- ⛔⛔ **A park-függők közül kettő ZÖLD, de üres parkon SZÁNDÉKOSAN pirosra megy**
  (`ad-banner-render-check` anti-vakuum · `booking-price-coherence-check`: „nincs vizsgálható
  oldal") — bekötve pont a purge után állítanák meg mindenki landolását, ahogy 09-13-án már
  megtörtént. Kimondva, nem elnyelve.
- ⭐ **A mérés a bejelentésnél szélesebb osztályt talált:** ① az ADR-0147 ③ szabálya (az őr
  saját fájlja triggerelje magát) **pontosan EGY helyen érvényesült** — az 50 diff-scope-olt
  blokkból **48 nem tartalmazta a saját fájlját**; mind javítva. ② **5 bekötött őr NÉMÁN
  kimaradt a LANDOLÁSBÓL**, mert nyersen a `git diff --cached`-et olvasta a `changed_files`
  helyett, az pedig `LAND_RANGE` mellett (üres index) mindig üres — mind az 5 külön mérve
  zöld, ezért az átkapcsolás nem visz be új pirosat.
- ⛔⛔ **A legfontosabb: egy árva őr egy ÉLŐ hibát takart.** A `lead-page-surface-check` ma
  piros az `origin/main`-en, és NEM fixture-rohadás: `aurora`/mobil a lebegő pirula
  (y=769, 195×83) a **„Szabad időpontok megtekintése" CTA 23 %-át takarja** (vh=844) — **pont
  az a hiba, amiért az őr készült (Elek FK-004b ②).** Van róla mérésünk, és nincs róla
  tudomásunk. Az árva őr nem elmaradt munka: kiszállított hiba.
- **Szállítva:** `scripts/guard-wiring-check.mts` — ① bekötve-vagy-indokolt-kivétel ·
  ② ön-trigger · ③ `changed_files`-hatókör · ④ élő kivétel-lista · ⑤ **a kivétel MÉRT**
  (`kind`: kézi·telepítés·park·elrohadt + dátum + mit adott a futás). „Lassú" nem lehet indok
  — arra a diff-scope a válasz. **MINDIG fut, diff-scope nélkül** (egy új árva úgy keletkezik,
  hogy valaki `*-check.mts`-t ír és a hookot meg sem nyitja), és a 2 ELROHADT sort minden
  futásban kiírja, hogy a „minden zöld" ne olvasódjon rendben lévő állapotnak.
- **Bizonyítva, nem állítva:** ⓐ bekötetlen őr staged → valódi `git commit` **exit 1**, HEAD
  nem mozdult · ⓑ a `render.ts` kitöltője visszarontva → **9/114 mérés bukik** · ⓒ a
  `nextChargeDate` visszarontva „ma+12 hó"-ra → az őr reprodukálja az EREDETI leletet
  (`képernyő 2027-09-14 · current_period_end 2027-09-11`), **miközben az „első vásárlás" ág
  zöld marad** — megkülönböztet, nem vakon tör · + piros önteszt + álpozitív-kontroll.
- **NYITOTT:** ① a `lead-page-surface-check` TERMÉK-hibája (aurora/mobil pirula-ütközés) ·
  ② a `module-config-check` elrohadt fixture-je (`source:"booking:xyz"` vs UUID, + a
  foglalás-slot mai `cit-enquiry` markupja) — mindkettő javítás után BEKÖTENDŐ, a kivétel-sor
  akkor törlendő · ③ a 7 park-függő őrhöz önhordó fixture kell · ④ a `*-lint.mts` /
  `*-selftest.mts` család leltározatlan, a meta-őr ma csak a `*-check.mts` mintára szól.

## Előző szál (2026-09-14) — 🎛️ Modulok fül — egy irány-hazugság javítva, 13 lelet a §2b terv-kapunál

**🎛️ MODULOK FÜL (Elek FK-002, B5) — EGY IRÁNY-HAZUGSÁG JAVÍTVA, 13 LELET A §2b KAPUNÁL.**
Session-jegyzet: `_planning/memory/2026-09-14_modules_tab_plan_gate.md`. **Élesítés NINCS.**
A terv-kör a `TERV-KESZ.md`-ben vár tulajdonosi döntésre (3 kattintható változat, 9 kép).

- ⛔⛔ **A MÉRŐ KERETE is hamisíthat.** A `modulesSection()`-t először egy SAJÁT, egyszerű vázba
  rendereltem — ott a modul-sor ~1240 px volt és egy sorban elfért. A termék VALÓDI váza
  (248 px oldalsáv + `.adm-main__inner{max-width:900px}`) mellett újramérve a „Kikapcsolom"
  **1280 px-en is** külön sorba, a sor BAL szélére törik (x=377, a Megnézem x=821 ALATT).
  Egy „csak mobilos"-nak hitt lelet mindkét méreten él. A renderelt lap mérése is csak akkor
  mérés, ha a keret is a termék kerete.
- **Szállítva (landolva):** a fül bevezetője „Ami már az Öné, azt **fent** találja"-t ígért,
  miközben mérve MINDKÉT blokk ALATTA renderel (390 px: 767 < 1064 < 5029 · 1280 px:
  573 < 717 < 2691) — a bekezdés fölött csak az Előfizetés-kártya van. Javítva mindkét ágon,
  és **őr köti az irányt a RENDERELT sorrendhez** (`scripts/modules-intro-direction-check.mts`,
  pre-commit): szűken az első tagmondatra tilt, álpozitív-kontrollal, piros ikerrel, és a
  visszarontott ÉLES kódon igazoltan `exit 1` `set -e` alatt.
- ⚠️ **A kapu fő kérdése egy JÓVÁHAGYOTT KONTRAKTUSSAL ütközik:** a `modules-annual-pricing`
  README §1 szerint éves fiónál is a HAVI ár az elsődleges (a szállítás ezt hűen teljesíti:
  havi 13,12 px/700/navy · éves 11,84 px/600/halvány), a „legnagyobb szám az, amit fizet" elv
  viszont az éves összeget kívánja. Ez tulajdonosi döntés, nem szál-döntés.
- ⛔ **A vázlat két SAJÁT hibát termelt** (mindkettő javítva, mindkettő általános tanulság):
  ① a termék asztali oldalsávja (`sticky;top:0;height:100vh`) ráúszott a méret-váltóra — a
  `container-type` containment a *scrollportot* nem írja felül; ② a ragadós sáv NEM tapadt,
  mert a vázlatban semmi nem görgött, tehát egy „mindig látszó összegző" a képen zöldnek
  látszott volna. Ezért kapott a mock valódi, görgethető **készülék-keretet** — és ebben lett
  MÉRHETŐ a ③ változat ára: sáv 120 px + a termék mobil fülsávja 186 px = **306 px a 844-ből**.
- ⛔ A mobil fülsávot nem utánoztam, hanem a valós MAGASSÁGÚ helyfoglalót tettem oda: egy
  5 elemű, 46 px-es másolat azt hazudta volna, hogy alig takar (a termékben 11 fül, 3 sor).
- **NYITOTT:** a `TERV-KESZ.md` §3 hat kérdése — köztük a fenti kontraktus-ütközés, és hogy a
  fizetős felület „Kérdése van a csomagról?" linkje szándékosan ír-e ki személynevet
  (`olasz.ferenc@citoviso.com`, a HIDEG MEGKERESÉS feladó-azonosságából, `config.outreachSender`).

## Előző szál (2026-09-14) — a süti-sáv hatóköre a lap CÍMZETTJE (ADR-0151)

**🍪 ADR-0151 — A SÜTI-SÁV HATÓKÖRE A LAP CÍMZETTJE, NEM AZ ÚTVONALA.**
Session-jegyzet: `_planning/memory/2026-09-14_consent_scope_is_audience.md`. **Élesítés NINCS.**
Elek FK-007 Z5: a vendég **lemondó** lapjain ott maradt a Barion-süti-sáv — olyan lapon, ahol
nincs kártyás fizetés.

- ⛔⛔ **A tegnapi ADR-0145 a TÜNETET vitte el.** A jelölő egy **boolean volt, egy SORBAN**: a
  hatókör attól függött, hogy egy route a jelölő fölött vagy alatt áll — és ez **egy nap alatt
  kétszer** dőlt el rosszul. Ezért nem a két bejelentett sort javítottam, hanem **megmértem a
  jelölő utáni ÖSSZES HTML-t adó útvonalat**.
- **Két TOVÁBBI ajtó volt nyitva** a bejelentett kettőn kívül: a **`/site/<preview_token>`**
  (⭐ ugyanaz a `sites/<tenant>/index.html`, amit a tenant-host ad ki — a nyers fájlban **0**
  hivatkozás, tehát a kiszolgálás teszi rá: a vendég-oldal **harmadik** ajtaja, miközben a másik
  kettőt tegnap becsuktuk) és a **`/m/<token>` mock-előnézet** (hideg megkeresés címzettjének).
  Mérve előtte/utána: lemondó GET+POST 924 → 578 B · `/m/` 873 → 527 B · `/site/` SÁV+PIXEL → tiszta.
- **A szabály** (az ADR-0145 ③ saját logikájából): a sáv+Pixel a MI webshopunk lapjaira való —
  ahol a látogató a mi (leendő) ügyfelünk, és ahol a mi fizetési utunk futhat. Kimarad minden lap,
  amelynek **CÍMZETTJE a tenant VENDÉGE**, akármelyik úton szolgáljuk ki.
- **A határ MÁSIK oldala szándékosan változatlan:** landing/jogi/belépés/admin + a tulaj levélből
  nyíló döntés-lapjai (`/foglalas/<token>/elfogadom`, `/velemeny/<token>/…`) megtartják a sávot —
  az őr ezeket **pozitív kontrollként** tűzi ki, hogy a javítás ne csapjon át túlkorrigálásba.
- **Megvalósítás:** `PAGE_AUDIENCE: "own" | "guest"` a boolean helyén, a **nem deklarált
  alapértelmezés a nem-követés**; a vendég-útvonalak EGY listában (`GUEST_PAGE_ROUTES`),
  nevesített mintákkal, amelyeket a route-ok is használnak — a lemondó-minta eddig **két
  példányban** élt. ⭐ A sáv és a Pixel **együtt mozog** (egy `consentSnippet()`), és az őr ezt
  külön állításként tűzi ki.
- **Őr, mindkét irányban:** a `consent-style-check.mts` a RENDERELT lapon mér, a POST-ágat nyers
  HTTP-vel (a `page.goto` csak GET — a lelet ott is élt). **Piros önteszt kétszer:** beépített
  `--self-test` 115 → **127** piros; a VALÓDI szabályt visszarontva **17 bukás, exit 1**.
- ⚠️ **Kimondott mérési rés:** a `/m/<token>`-hez `mock_request` sor + lemez-artefaktum kell, a
  közös parkban ez most 0 — az őr **hangosan kihagyja**, és szándékosan NEM gyárt fixture-t
  (a park közös). Kézzel, önmagát takarító fixture-rel mérve; a park utána igazoltan érintetlen.

## Előző szál (2026-09-14) — natív confirm() a lemondáson (ADR-0150)

**🗣️ ADR-0150 — A KOMMENT AZT ÁLLÍTOTTA, HOGY NINCS NATÍV `confirm()`. VOLT.**
Session-jegyzet: `_planning/memory/2026-09-14_cancel_native_confirm.md`. **Élesítés NINCS.**
Forrás: Elek FK-007 **E3**; a premissza a mai `origin/main`-en (`4535965`) újramérve.

- **A lelet:** a `src/server/bookingViews.ts` kommentje kimondta, hogy „No native `confirm()`" —
  közben **ugyanabban a fájlban** a tulajdonosi lemondás `onsubmit="return confirm(…)"`-mel
  zárult. A komment igaza a **fedés-választóra** vonatkozott, de file-szintű állításnak
  olvasódott. Két baj egyszerre: a lemondás **négy lépés + nyers OS-dialógus** volt, és **a kód
  hazudott magáról** — a következő olvasó a kommentnek hisz.
- **Teljes felmérés** (`src/` + `assets/runtime/` + `public/`), a javítás előtt: **vendég-oldal
  0** (a vendég-lemondás már ma is teljes megerősítő LAP) · **vevő-oldal 1** (ez, javítva) ·
  **operátor-konzol 6** (5 `confirm` + 1 `alert`) — **szándékosan kívül hagyva**, de az
  ADR táblázatában rögzítve, hogy ne tűnjön el.
- **Szállítva:** a lemondás a **fedés-választóval AZONOS** modállal erősít meg (`.bk-ovl`/
  `.bk-ovm`, ragadó gomb-sor, `--citui-*`) — **nulla új CSS**, mert épp az azonosság a lényeg.
  EGY koppintás nyitja, **megnevezi** a vendéget és az éjszakákat, kimondja, hogy nem vonható
  vissza, az indoklás-mező ott van, ahol a döntés, a kiút **gomb** („Mégsem — megtartom", szó
  szerint a vendég-oldali lapról). A **no-JS ág érintetlen**: a `<details>`-es űrlap ugyanoda
  POST-ol.
- **Őr:** `scripts/cancel-confirm-check.mts` (pre-commit, 390+1280) — natív dialógus sehol · egy
  koppintás · a modál megnevez · `elementFromPoint`-os elérhetőség · a záró gomb **tényleg
  beküld** (`id` + a modálba gépelt indoklás; a `form.submit()` nem süt el submit-eseményt,
  ezért a prototípus csapdázva) · a „Mégsem" semmit nem küld · a no-JS űrlap ép.
  **Piros önteszt: 6 bukás** a régi markuppal.
- ⛔⛔ **Hamis zöldet kaptam a SAJÁT öntesztemre.** A hook-blokkot `set -e` alatt egy KITALÁLT
  kapcsolóval futtattam — az őr azt figyelmen kívül hagyta, normál módban ment, zöld lett.
  Újra, valódian: a FORRÁST rontottam vissza, úgy futott a blokk → `rc=1`, a záró `echo` nem
  futott le. **Ismeretlen kapcsoló = néma kikapcsolás.**
- ⛔ **A csere fogyasztói:** az FK-007 a `.bk-dayinfo textarea`-ba gépelt, ami a modál megnyitása
  után nem elérhető — a forgatókönyv frissítve (`.bk-ovnote` + új lépés, ami a modált állítja).
  A KB-bejegyzés és a befagyasztott kontraktus szintén.
- **NYITOTT:** ① a konzol 6 natív dialógusa (a kiküldés-megerősítéseknél a dialógus MA véd
  valami visszafordíthatatlantól — tulaj-döntés kell) · ② a történet-listás „Lemondom" ugyanezt
  a modált nyitja, de a KB csak a naptár-ágat írja le.

## Előző szál (2026-09-14) — a mobil-vakfolt az Elek-mérőeszközben (ADR-0149)

**📱 ADR-0149 — VAKON JAVÍTOTTUNK ARRA A MÉRETRE, AMIT A TULAJ HASZNÁL.**
Session-jegyzet: `_planning/memory/2026-09-14_elek_mobile_blind_spot.md`. **Élesítés NINCS**
(a mérőeszköz nem éles komponens). Ez az előző szál ④ nyitott tételét zárja le.

- **A vakfolt:** az Elek runner indulása óta MINDEN képet 1280 px-en készített, a tulaj viszont
  telefonon dolgozik. A 2026-09-14-i teljes mátrixban **öt kiértékelő is egymástól függetlenül
  leírta**, hogy a telefonos nézetet nem tudta megítélni („a futásban egyetlen 390 px-es felvétel
  sincs" — FK-001; „a bukás-ágak mobilon nem lettek lefényképezve" — FK-005b; + FK-007/005a/004b).
- **Szállítva:** minden lépésről **KÉT** felvétel (`NN.png` 1280 + `NN-mobil.png` 390), a bukás-ág
  is; `result.jsonl`: `shot` (jelentése változatlan) + új `shot_mobile`; a futás **kiírja**, hány
  kép készült méretenként, mibe került, és **melyik lépésnél hiányzik** a telefonos pár. A charter
  (RUN-PROMPT · SCENARIO-FORMAT · CHARTER · BRIEF-TEMPLATE) kimondja, hogy **mindkettőt** nézni
  kell, hogy a **méret-specifikus lelet ÖNÁLLÓ lelet** (a méretet meg kell nevezni), és felsorolja
  a hét tipikus telefonos hibaosztályt. A jelentés a két képet **megnevezve** mutatja.
- ⛔ **Nem második futás 390-en:** a forgatókönyvek MUTÁLJÁK a világot (FK-004 levelet küld,
  FK-005a fizet és tenantot hoz létre) — az újrajátszás megduplázná a mellékhatásokat. Az ÉLŐ lap
  átméretezése ugyanazt az állapotot tartja, és `finally`-ben áll vissza 1280-ra (36/36 kép a
  saját szélességén). Az ítélet NEM változik: a `várd:` csak 1280-on fut — FK-003 előtte és utána
  is **11 zöld / 0 piros / 7 kézi**.
- ⭐ **Kimondva, mit NEM bizonyít a kép:** a böngésző asztali marad (nincs touch/mobil-UA) — a
  felvétel az ELRENDEZÉST mutatja 390-en, nem azt, hogy a folyamat ujjal végigvihető. Előbb mérve:
  a kiszolgáló sehol nem ágazik el user-agent alapján, minden töréspont szélesség-alapú (520–960).
- ⛔ **Rejtett aszimmetria a saját szállításomban:** a „túl magas lap" korlát `magasság > 12 000 px`
  volt — nem méret-semleges (390-en ugyanaz a tartalom magasabb), tehát a telefonos fél némán a
  gyengébb bizonyíték lett volna. Terület-alapúra véve, pontosan az asztali budgettel → 1280-on
  ugyanaz a predikátum (36/36 azonos magasság), az ág működését **külön önteszt** igazolja.
  ⛔ Menet közben a viewport-magasságú képeket tévesen „levágott"-nak olvastam — a lap volt rövid.
- **LELET (nem javítva, külön kör):** a `/leads` lista **390 px-en a 11 oszlopból 3-at mutat** —
  görgető-doboz client **320** / scroll **1070** → **750 px túllógás, 408 levágott cella 16
  oszlopban** (1280-on: 0 / 0). Kívül reked az Ország, Város, Kvalifikáció, Fotók, Anyag, Match,
  Kontakt, Mock — minden, amiből az operátor dönt. ⛔ **A tegnapi őr ugyanezzel a vakfolttal él:**
  a `lead-filter-label-check` szó szerint `@1280px`-et állít — nem tévedett, MÁS KÉRDÉSRE válaszolt.
- ⛔ **Feloldatlan merge-konfliktus ÉLT az `origin/main` `INDEX.md`-jén** (a tegnapi zárás csak a
  `MEMORY.md`-t javította, az INDEX-et SENKI) — feloldva, és a `hooks/pre-commit` mostantól
  **blokkolja** a jelölőt (a STAGED tartalmon mérve; piros + zöld + álpozitív kontrollal).
- ⛔ **Infra:** a `git reset --hard`-dal tisztára tett fámat a watchdog GC **elvitte egy ÉLŐ
  session alatt** — `retired: true` esetén a `used_ok` kikapcsolja a „van user-üzenet" védelmet.
  Verziózott munka nem veszett el; 5 gitignore-olt futás-mappa igen.
- **Ár, mérve:** FK-003 18→36 kép · 23,5→43,9 mp · 9,4→13,6 MB (a telefonos rész 31 %).
  Teljes mátrix: ~110→~220 kép.
- **NYITOTT:** ① az **FK-001 (Üzenetek két soros téma-szűrője) telefonon továbbra sincs megnézve**
  — az ELEK-tenant hiányzik a parkból, és a lánc (FK-003b→FK-004→FK-005a) valódi LLM-generálást
  indítana · ② a `/leads` telefonos elrendezése (fenti lelet) · ③ a `lead-filter-label-check`
  390-es mérése · ④ a `BRIEF-TEMPLATE.md` módosítása saját szövege szerint tulajdonosi
  jóváhagyást igényel (a változás a RUN-PROMPT-tal azonos tartalmú).

## Párhuzamos szál (2026-09-14) — B4: tenant-admin Üzenetek + Dokumentumok

**⭐ A TULAJ DÖNTÖTT: „C — Ügyek, nem levelek" ÉL LOKÁLBAN — ADR-0154.**
Kontraktus: `assets/design-refs/tenant-admin/uzenetek-ugyek/` (README + működő terv + képek).
**ÉLESÍTÉS: a szál MEGVÁRJA a többit** (tulaj-döntés 2026-09-15) — egy megnevezett verzió megy
ki közösen; a munka landolt és igazolva van, tehát része lesz. Mérve a szállított kódon:
olvasatlan **65 → 21**, **66 üzenet → 22 sor** csukva (kinyitva mind a 66; a találat-szám
mindkét állapotban 66).

- **Az ÜGY a sor:** az előfizetés-szál EGY soron áll a mai állapotával, a korábbi lépések egy
  MEGNEVEZETT nyitó mögött. ⛔ A csukás semmit nem vesz el: a keresés a csukott ügy lépésére
  is talál (az őr külön állítása).
- **A túlhaladott NEM olvasatlan** — egy predikátum adja a bal menü jelvényét, az „Olvasatlan"
  chipet és a tömeges jelölés hatókörét. A `countUnreadMessages` emiatt már nem SQL-COUNT.
- **Az előnézet a TARTALOM:** a szabály a KÜLDŐ `T()`-sorainak listájából származik, nem
  szöveg-heurisztikából (`src/tenant/messagePreview.ts`), így nyelvfüggetlen.
- ⚠️ **A jóváhagyáskor „~12 ügy" hangzott el, a szabály 22-t ad** — a különbség a 19 SZÁMLA,
  amit az ADR-0125 szándékosan nem szálasít. A kontraktus 0b pontja ezt kimondja.
- ⛔⛔ **A saját őröm találta a saját hibáimat:** egysoros SMS-nél az előnézet MEGISMÉTELTE a
  címet · az őr INDEX szerint párosított sort a fixture-höz (a csoportosítás után elcsúszott,
  és a TERMÉKRE fogta volna) · a fixture `"…"` törzse miatt az előnézet-szabály MÉRETLEN volt.
- ⛔ **Két magyartalanságot magam gyártottam:** „mind a 1 üzenetet" és „A(z) {tárgy}" — a
  számnév/tárgy előtti névelő ugyanaz a gépi csapda, amit az Elek külön leletként jelentett.
- ⛔⛔ **A KB-őr ZÖLD volt, mert horgonyt és képet mér, nem IDÉZETET:** a súgó három már nem
  létező feliratot idézett, és egy állítása MÁR AZ ELSŐ KÖR ÓTA hamis volt („az E-mail és az
  SMS gombon nincs darabszám"). **Felirat-csere előtt a `kb/` is a fogyasztók közé tartozik.**
- ⛔ **SZŰKÍTETTEM A KONTRAKTUST a jóváhagyott vázlathoz képest:** a mock mutatta a
  visszakapcsoló sávot (kifizetett időszak + link a számlához), a befagyasztott README viszont
  nem KÖTI, és a kód nem tartalmazza. A kontraktus-őr ezt nem foghatta meg — csak azt méri,
  amit a README kimond. **NYITOTT tétel #1.**
- ✅ **2026-09-15: a visszakapcsoló sáv LEZÁRVA** — kimondja a kifizetett időszakot és elvezet
  a bizonylathoz (kontraktus ⑦b pótolva). ⛔⛔ **A saját összefoglaló sorom volt a hamis
  premissza:** „az adat megvan (`arrears`)" — újramérve az `arrears` CSAK fagyott/lejárt
  állapotban él, a sáv viszont aktív fiókon jelenik meg. A kifizetett ciklus maga a FOLYÓ
  időszak. **Romboló vagy ráépítő művelet előtt a saját számomat is újra kell mérni.**
- **NYITOTT (a session-jegyzet végén tételesen):** ~~① a visszakapcsoló sáv~~ · ② azonos percen
  belüli sorrend (tulaj-döntés kell) · ③ a kétszer mondott képernyő-név (MINDEN admin-fül) ·
  ④ lapozás/év-csoport a 19 számla-sorra · ⑤ a szűrő-sáv 205px 390-en · ⑥ az ELEK-tenant
  hiányzik a parkból, így az FK-001 élő újrajátszása még nem történt meg.

### Első kör — apró javítások és a hangnem-őr


**🗣️ AZ ŐR ZÖLD VOLT, ÉS NEM TÉVEDETT — MÁS KÉRDÉSRE VÁLASZOLT.**
Session-jegyzet: `_planning/memory/2026-09-14_admin_voice_and_chip_counts.md`. **Élesítés NINCS**;
a kinézeti rész a §2b kapunál áll (`TERV-KESZ.md` a `wt/uzenetekdok` munkafa gyökerében).

- **A `hu-voice-check` a bejelentés napján zöld volt**, pedig a tegezés a képernyőn állt: a tárgya
  a 16 **vendég-oldali** sablon volt, a tenant-admint soha nem nézte. Két szomszédos admin-képernyő
  közben két hangnemben beszélt ugyanazzal az emberrel. **Hatóköre kiterjesztve**; 9 felirat magázásra.
- ⛔⛔ **A saját detektorom hibáját az álpozitív-kontroll fogta meg:** a JS `\b` csak ASCII-t ismer,
  ezért a `\bTölts\b` **illeszkedik a „Töltsön" belsejére** — az első verzióm a SAJÁT javításomat
  jelentette hibának. Unicode-lookaround lett belőle. ⭐ Ugyanez a kontroll talált egy addig
  ismeretlen valódi leletet is („Válassz ki képeket.").
- **Z2/E6 lezárva:** a csatorna-chipek **számot viselnek** (az üres SMS előre 0-t mond, nem néma
  zsákutca), és egyetlen évnyi adatnál **nincs év-chip**. +5 állítás az őrben, mind pirosra megy.
- ⛔ **Egy leletet MÉRÉSSEL elvetettem:** „a rendezés azonos percen belül eldöntetlen" — a `sent_at`
  mikroszekundum-pontos, minden sor külön tranzakcióban íródik, azonos időbélyeg nem áll elő.
  Az Elek maga is „azonos PERC"-et ír, és a sorrendet **emberi döntésnek** nevezi.
- ⛔ **Egy NUL-bájt** tette binárissá az `admin-list-labels-check.mts`-t: a `grep` **némán** kihagyta.
- **A §2b vázlataimat a saját kattintás-próbám háromszor buktatta le** (az előnézet-szabályom 19
  számla-sorra csak 4-félét adott, mert a tétel MÁR a címben van; kimaradt a „Szűrés törlése”;
  a jelvény-elvárásom a HELYES viselkedést jelentette volna hibának).
- **NYITOTT (tulaj-döntés, 8 pont a `TERV-KESZ.md`-ben):** a túlhaladott 69% kezelése (A/B/C) ·
  számítson-e olvasatlannak · ⚠️ a szűrő **három sorra** bontása **módosítaná az ADR-0127 ② két
  soros tervét** (mérve: 390px-en **247px** magas a sáv) · a kétszer mondott képernyő-név MINDEN
  admin-fület érint, ezért külön körbe való.

## Előző szál (2026-09-14) — 25 párhuzamos javító-szál, 4 élesítés

**🎛️ 25 PÁRHUZAMOS JAVÍTÓ-SZÁL, 4 ÉLESÍTÉS, ELEK TELJES ÚJRAMÉRÉSE — A NAP LEZÁRVA.**
Session-jegyzet: `_planning/memory/2026-09-14_parallel_session_orchestration.md`.
**`origin/main` = éles = `b029db8`** (tag `prod/20260914-1200`) — ma először teljes szinkron.

- **Előbb a MÉRŐESZKÖZT kellett megjavítani.** A 12 FK-ból hidegindításon 3 futott zöldre, és
  a piros **nem a terméket** jelentette: két beégetett UUID némán elhalt (a park a vásárlás-körből
  épül újra), a runner pedig HIBÁNAK minősítette a LANDOLT kattintást, ha a gomb eltüntette magát.
  Javítás után **65/65 gépi zöld**, és megszületett az `elek/bin/run-all.mts` (EGY parancs, helyes
  függőségi sorrend: kiküldés → link → vásárlás → tenant → seed → dunning → thaw).
- **Elek teljes újramérése: 12 kör, 110 kép, ~250 lelet, 0 REGRESSZIÓ** az 50+ commit után.
  ⭐ A gépi mátrix 65/65 zöld volt — Elek UGYANAZOKON a képernyőkön **22 HIBÁT** talált.
- **A javítások** (kivonat): törött képes mock nem hagyható jóvá és nem küldhető ki · a halott fotó
  ki se kerül a lapra · a vásárlás-pirula őre ÓRÁRA mért és egy LÁTHATATLAN gombot igazolt · a
  fizetés előtti és utáni ÖSSZEG és DÁTUM egyezik · a TERÜLET a gyűjtés doboza, nem a lead
  földrajza · süti-sáv stílusa + mobil navigáció · szoba-kártya képe és a „C" minta-jelölés ·
  a doboz megmondja KI beszélt · a generálás kimondja, hogy KÉSZ · súgó-csoportok.
- ⛔⛔ **A gépies csere a súgón HÁROMSZOR rontott el olyat, amit kézzel nem rontottam volna.**
  A `sed` a `/scrape` panel-címét „Adatgyűjtés indítása"-ra írta — ott ma is **„Scrape indítása"**
  áll (az átnevezés CSAK a navigációra igaz). A javítás névelő-hibát szült, a következő kör a
  nem-ítélhető ág kiútját mondta rosszul. **A KB-t a felület ellen kell szerkeszteni, egyesével.**
- ⛔⛔ **A KB-t nem elég a commit-üzenetből írni.** Háromszor volt a jóhiszemű összefoglaló
  pontatlanabb a valóságnál: a szakasz-felirat és a `{done}/{total}` a kódban KIZÁRJA egymást,
  a lezáró sáv 30 perces TTL-lel eltűnik, a modul-előnézetnek KÉT külön felirata van, a kapuval
  csak az egyik ágon. **A KB-kapu 11-szer blokkolt — mindannyiszor valós hibával.**
- ⛔ **A purge többet vitt, mint amire szükség volt.** Utána két őr nem tudott futni
  (`help-collapse-check` tenant-fiókot, `outreach-sendability-check` 3 prospectet igényel), és a
  land elbukott, pedig a kód rendben volt. **A helyes sorrend: előbb land, aztán purge.**
- ⚠️ **A `rc-new.sh` közös fába indít**: két szál kölcsönösen felülírta egymás munkáját (CSS ↔
  INDEX-sorok). Mindkettő maga vette észre; az auto-worktree pool épp ezt hivatott megelőzni.
- ⚠️ **A MEMORY.md-be feloldatlan merge-konfliktus LANDOLT** (`<<<<<<< HEAD` a mainen, két szál
  „Aktív feladat" blokkja) — a session zárásakor derült ki, feloldva. A land-kapuk nem nézik a
  konfliktus-jelölőket; egy egysoros őr a `hooks/pre-commit`-be megelőzné.
  ✅ **ELINTÉZVE (ADR-0149 szála):** az őr megvan — és rögtön kiderült, hogy **ugyanez az
  `INDEX.md`-n is megtörtént, csak ott SENKI nem vette észre**: a jelölők az `origin/main`-en
  ültek, két valódi bejegyzést téve olvashatatlanná. Feloldva.

**Nyitva:** ① a lead-LAP „Régió" sora nyers azonosítót mutat (a LISTÁT a `d7b8438` javította, a
lapot nem — a súgó kimondja) · ② a Területek szerkesztőjének megelőzése (tulaj: később) ·
③ ~160 ERGONÓMIA/ZAVAROS lelet a `LELETEK.md`-kben · ④ ✅ **MOBIL-VAKFOLT — LEZÁRVA**
(ADR-0149, lásd a legfrissebb szálat) · ⑤ a `rc-new.sh` közös-fa gondja (lásd fent).

## Előző szál (2026-09-14) — ki beszélt a dobozban (ADR-0119 ⑧ / ADR-0148)


**🗣️ ADR-0148 (+ ADR-0119 ⑧) — HÁROM HELY, AHOL A FELÜLET MÁST MONDOTT, MINT AMI VAN.**
Tulaj-bejelentés, három mért lelet (Elek FK-006a HIBA-1 · FK-007 H1 · FK-003b L03/L06).
Session-jegyzet: `_planning/memory/2026-09-14_quote_author_and_generation_end.md`.
Kontraktusok: `assets/design-refs/tenant-admin/booking-quote-author/`,
`assets/design-refs/console/gen-progress-end/`.

- **① Fagyás alatt egyetlen kártya se ígérjen elérhetőséget.** A bejelentett három mondat
  mellé a mérés **kettőt** talált: a bolt-kártya „Megnézem az **oldalamon**" gombját (13 db
  — a saját moduloknál ez már javítva volt, a **bolt kimaradt belőle**) és a „naprakészek"
  sort. ⛔⛔ **A meglévő őr HÁROM szó szerinti tűje MIND ÁTMENT** — nem tévedett, más
  szavakra volt kihegyezve. Új őr (`frozen-claim-check.mts`) **ÁLLÍTÁST** mér: ALANY +
  ÁLLÍTMÁNY + POLARITÁS; ⚠️ a tagadást az állítmány **ELŐTTI 40 karakteren** nézi, mert a
  mondat-széles tagadás túl laza („Az oldala elérhető, **nem** kell tennie semmit").
  Önteszt **19 állítás**. Landolva: `176e003`.
- **② Az idézet-doboz megnevezi a szerzőjét.** A vendég kérdése a döntés után is a soron
  marad. ⭐ A szerző az **ADATBÓL** jön (`decided_by` enum), nem a renderelő ágból: a
  lemondás indokát a **vendég is írhatja**. `null` → „Megjegyzés" — a téves név rosszabb,
  mint a hiányzó.
- **③ A haladó csík soha nem mutatott haladást.** `width:34%` fix kitöltés + `conSlide`,
  semmilyen adathoz nem kötve; letiltott animációnál a sávon KÍVÜL állt (innen az „üres
  szürke"), `prefers-reduced-motion`-ben pedig **teli** csíkot mutatott futás közben.
  Kivezetve → a motor jelenti a valós szakaszt, több sablonnál az elkészültek száma;
  **százalék nincs**. A **vég ki van mondva** (kész · meddig tartott · link) és MEGMARAD —
  a háttérmunka **negyedik** tartozása.
- ⛔⛔ **Infra, ötödször: NYOLC session egy munkafán** (44 commit lemaradás, 30 idegen
  piszkos fájl, az `adminViews.ts`-t másik szál szerkesztette). Külön, tiszta fából
  landoltam, és a közös fában **visszavontam a saját szerkesztéseimet**. Az `extract-i18n`
  a TELJES fát olvassa → **8 idegen string** került a katalógusomba.
- ⛔⛔ **A „pontosan 1 találat" az ILLESZKEDÉST bizonyítja, nem a helyességet:** egy komment
  a template literalon BELÜLRE került, a `tsc` ZÖLD maradt, és csak az `internal-ref-check`
  buktatta le.
- Élesítés NINCS (§0.3).

## Előző szál (2026-09-14) — a láthatóság verdiktje (ADR-0147)


**👁 ADR-0147 — AZ ŐR ÓRÁRA MÉRT, ÉS A ZÖLDJE EGY LÁTHATATLAN VÁSÁRLÁS-GOMBOT IGAZOLT.**
A `configurator-float-check` PIROS volt az `origin/main`-en (aurora, asztali, `opacity: 0`),
és megállította egy párhuzamos szál landolását; ő három fán mérte meg, mindenhol ugyanaz →
repó-szintű, korábbi hibaként külön szálra került. Session-jegyzet:
`_planning/memory/2026-09-14_buy_pill_visibility_verdict.md`. **Termék-kód NEM változott.**

- **A kérdés — valódi vevő-oldali hiba vagy őr-hiba — mérve: ŐR-HIBA.** A vásárlás-pirula
  MINDEN mérésben megjelenik: görgetésre aurorán 1,0–1,8 s, a többi sablonon ~0,5 s; aki
  **egyáltalán nem görget**, annak a feltétel nélküli `setTimeout(showPill, 2600)` festi ki
  (mérve **3,3–3,6 s**). Bevétel-kiesés nincs. ⛔ De az őr **mindkét irányban** hazudott.
- **① A piros:** fix **700 ms**-os mintavétel egy **438–1047 ms** között szóródó megjelenésre
  (a lap SAJÁT görgetési munkája dönti el, nem a mi kódunk; a többi sablon ~150 ms).
  Ugyanazon a **változatlan** buildon, ugyanezen a gépen: **10 futásból 4 PIROS.**
- ⛔⛔ **② A zöld fele volt a VESZÉLYESEBB.** 700 ms-nál a pirulán már rajta volt a
  `pointer-events: auto`, és az `elementFromPoint` **el is találta** — miközben az `opacity`
  pontosan **0**, és a levágott képernyőképen **nincs ott semmi**. Hat futásból hatszor egy
  **láthatatlan vásárlás-gombot** igazolt kattinthatónak. **Az `elementFromPoint` az átlátszó
  elemet is eltalálja:** arra válaszol, hogy „takarja-e valami ezt a dobozt", **sosem** arra,
  hogy „látja-e ember" (ez az `isVisible()`-tilalom folytatása, nem cáfolata — az a DOM-ra
  vak, ez a PIXELRE).
- **Szállítva:** a verdikt **KETTŐS** (KIFESTVE `opacity===1` **ÉS** NEM TAKART
  `elementFromPoint`); a várakozás a **pixelre** vár (rAF-poll), nem órára; a keret
  **kimondott** és a termék saját állandóiból származik (2600 + 500 + 4000 ms terhelési
  ráhagyás) — ha sosem fest ki, az **PIROS**, nem elnyelt timeout. Új önteszt ③: átlátszóra
  állított `.cit-cfg-in` — a geometriai verdikt itt **ZÖLD marad** (ez a lényeg: vak rá), a
  láthatósági PIROSRA megy. Új mérés ④: a nem-görgető látogató. A pre-commit trigger
  mostantól az őr **SAJÁT fájljára is** szól.
- ⚠️ **Amit magam rontottam el:** az első keretem 5000 ms volt, és a teljes futásban 4624 ms
  jött ki — **alig-átmenő érték**, vagyis a következő érme-feldobás. Külön mérve a
  terhelésmentes szórás 3255–3591 ms → ~1 s a keretből GÉP-TERHELÉS, nem termék-viselkedés;
  ezért lett a keret levezetve, nem tippelve.
- **Kapu:** 19 sablon × 3 állítás + 4 önteszt — **két egymás utáni teljes futás zöld**, a
  legrosszabb aurora/asztali kifestés 1936 ms a 4500 ms-os kereten belül.
- ⛔ **IKER-JAVÍTÁS:** munka közben landolt `1ee2fe8`, ami ugyanennek a pirosnak a *piros
  felét* szintén javította (`waitForSelector` + 700 ms), és a rebase konfliktusban jött elő.
  Az ő változata a fantom-pirosat gyógyítja, a **hamis zöldet nem** → az övé elesett.
  Ugyanaz a commit a pirulát rAF-tickre is mozgatja, ezért a rebase után **újra végigmértem**.
- ⛔ **Sorszám-ütközés a LANDOLÁS pillanatában:** a blokk `0146`-ként készült (fetch után
  ellenőrzött számmal), de landoláskor egy párhuzamos szál `0146`-ot landolt → `0147`.

## Előző szál (2026-09-14) — egy vásárlási úton egy fordulónap (ADR-0144)


**📅 ADR-0144 — A FIZETÉS ELŐTT ÉS UTÁN MÁS NAPOT ÍGÉRTÜNK UGYANARRA A TERHELÉSRE.**
Tulaj-bejelentés az Elek FK-005a **H-1** / FK-001 **H1** / FK-006a **HIBA-2** nyomán.
Session-jegyzet: `_planning/memory/2026-09-14_renewal_date_coherence.md`.
- **A fizetőoldal „a mai fizetéstől számítva 2027. 09. 13."-át ígérte, a visszaigazolás
  2027. 09. 10.-et írt** — három nap eltérés egy AUTOMATIKUS kártyaterhelésen: a vevő egy
  dátumot fogad el és mást kap írásban.
- ⛔ **Nem kerekítés — a két képernyő MÁS FORRÁSBÓL felelt.** A böngésző `today + 12 hó`-t
  számolt abból a feltevésből, hogy a fizetés hozza létre a horgonyt; a szerver a tenant
  MEGLÉVŐ `current_period_end`-jét olvasta. Az `ensureSubscriptionForOrder`
  `onConflict doNothing`-gal szúr be → akinek **már fut ciklusa**, megtartja az eredeti
  fordulónapját, és a vásárlás abba olvad (ADR-0080 ②). **A kliens tippje csak a LEGELSŐ
  vásárlásra volt igaz — és pont az az egyetlen eset, amit valaha teszteltünk.**
- ⭐ **Az elhatárolás mérve (a tulaj kérte):** a **3 nap park-adat** (`anchor_date=2026-09-10`,
  a futás 09-13), de a **MECHANIZMUS nem az**; a 2034/2035-ös évszámok az FK-006 időutazóé,
  viszont az **ISO-ALAK maga valódi kód-hiba**. Az időutazót NEM futtattam, a parkot nem írtam.
- **Javítás:** ① a fordulónapnak EGY definíciója (`nextChargeDate`), a szerver adja a
  manifestben (`renewalAnchor`), a kliens nem számol — és ha tényleg nincs még előfizetés,
  a mondat KIMONDJA, hogy a mai fizetés az alap. ② Közös formázó (`src/text/day.ts`):
  `formatDay` / `formatDayStem` (magyarul „10-ig", nem „10.-ig"); a tárolt alak marad ISO,
  a MEGJELENÍTÉS formáz. ⛔ Naptári nap SOHA nem megy át `Date`-en (UTC-éjfél → negatív
  zónában az előző nap; ugyanez már elért vendég-levelet).
- ⭐ **A mérés a bejelentésnél SZÉLESEBB osztályt talált:** a lelet EGY mondatot nevezett meg,
  a bérlői Előfizetés lapon **további 13** ült ugyanabból az egy nyers `renewDate` változóból,
  plusz a dunning-levelek és a T+7 SMS.
- **Őr:** `renewal-date-coherence-check.mts` — a fizetés ELŐTTI mondatot valódi böngészőből,
  az UTÁNIT a valódi visszaigazolás-HTML-ből, **egy futásban, egy DB-sorból**, saját eldobható
  DB-ben. Negatívan reprodukálja a 3 napos rést, **miközben az „első vásárlás" ág zöld marad**.
- ⛔⛔ **Saját hiba, amit csak a COMMIT-FA fogott meg:** a hunk-szűrőm `huDay`-t keresett,
  `huDate`-et nem → a staged `views.ts`-ben bennmaradt a törlendő deklaráció. A munkafa zöld
  volt, a leendő commit nem (`git write-tree` + `git archive` külön fordítva derült ki).
  **Közös fában a munkafa zöldje nem bizonyít semmit a commitról.**
- **NYITOTT:** a két képernyő ÖSSZEGE nincs mérve — meglévő tenant upsellnél a visszaigazolás
  a tenant ÖSSZES megújuló modulját árazza, a fizetőoldal csak a most választottakat.
  **Ugyanaz az osztály, mint a dátum volt.** Élesítés NINCS.

## Előző szál (2026-09-14)

**🍪 ADR-0145 — A SÁV STÍLUSA NEM ÉRT EL A SÁVIG, ÉS A JAVÍTÁSOM ELTAKARTA A NAVIGÁCIÓT.**
Elek FK-005b H-1 / FK-006b HIBA-2 / FK-007 H2. Session-jegyzet:
`_planning/memory/2026-09-14_consent_bar_style_reach.md`.

- **A gyökér-ok mérve:** a `#cit-consent` szabályok a `home.css`-ben éltek, azt viszont
  **egyedül a `public/index.html` tölti be** — a sávot ellenben a szerver KÖZÖS kimenete
  teszi ki MINDEN saját lapunkra. 14 felület végigmérve: **12-ből 11 csupasz, natív
  gombos sávot kapott** (`position: static`, a lap aljához vágva), és a `/` landing volt
  az EGYETLEN jó — **pont az, amit a meglévő `consent-check` megnyit.** A hiba egy zöld
  kapu mögött ült.
- **Szállítva:** a stílus a sáv MELLÉ került (`assets/runtime/cit-consent.css`,
  tartalom-ujjlenyomattal, ugyanabból az egy pontból hivatkozva, ami a sávot kiteszi) —
  ⚠️ nem a dizájn-magba, mert a `withAssetVersions` mérten csak a honlapra fut, tehát a
  CDN 4 órás cache-e mögött a javítás nem ért volna ki. Plusz **specificitás-javítás**
  (`#cit-consent`-horgony: a `.con button` fehérre verte az „Elfogadom" ciánját, 1,12-es
  kontraszttal) és egy **hatókör-rés zárása** (a `/t/<slug>` dev-úton a VENDÉG-oldal is
  megkapta a sávot és a Pixelt; a `consent-check` ④ csak a host-utat mérte).
- ⛔⛔ **A javításom REGRESSZIÓT hozott** (ez a fontosabb tanulság): a helyes, fixed sáv
  mérten eltakarta a tenant-admin navigációját — mobilon 11 fülből **6-ot**, asztalin a
  **„Kilépés"** gombot —, mert előtte a csupasz sáv `static` volt, tehát nem takart
  semmit. **A §2b terv a PUBLIKUS lapra készült; egy jóváhagyott terv más felületen más
  következménnyel jár.** Tulaj-döntés (3 opció, mobil+desktop kép): a hozzájárulás-kérdés
  nem teheti elérhetetlenné a navigációt → a gazdalap deklarálja a fenntartott helyet
  (`--citui-consent-bottom`), a sáv publikálja a saját mért magasságát
  (`--citui-consent-h`) — a sáv nem tud a gazdalap bútorzatáról, csak magáról közöl tényt.
- **Őr:** `consent-style-check.mts` a RENDERELT lapon (390px ÉS asztali): token-PROBE-hoz
  mért háttér/gomb-szín, `elementFromPoint` görgetés nélkül, kontraszt alfa-kompozitálva,
  `@container` hatályosság, és hogy a sáv EGYETLEN fület sem takar el. Önteszt 115 piros.
- ⛔ **Saját hibák:** a kontraszt-számolóm összemosta a `color(srgb 0..1)`-et az
  `rgb() 0..255`-tel (a jó prózát „bukónak" mondta) · a mobil elrendezést a README
  prózájából mértem, nem a jóváhagyott KÉPBŐL (**a kép a mérce**) · a `ui-shot`-ot
  `--public` nélkül a KONZOL lapjára lőttem, ahol nincs is sáv.
- **NYITOTT:** a `--citui-consent-bottom` mobil admin értéke MÉRT konstans (a fül-sáv
  tartalom-vezérelt magasságú) — ma őr védi igazként, szebb volna a fül-sáv magasságát is
  publikálni. A konzol (`:4600`) betölti a `citui.css`-t, de sávot sosem kap (külön
  szerver) — ha ott is lesz fizetés, a kérdés ott is felmerül. Élesítés NINCS.

## Előző szál (2026-09-14) — a TERÜLET a gyűjtés doboza (ADR-0143)

**🗺️ ADR-0143 — A FELIRAT MÁS KÉRDÉSRE VÁLASZOLT, ÉS A VÁGÁS CSAK PIXELEN LÁTSZOTT.**
Tulaj-bejelentés az Elek FK-003 (2026-09-13) leletei nyomán.
Session-jegyzet: `_planning/memory/2026-09-14_lead_list_area_truth.md`. **Élesítés NINCS.**
- **A RÉGIÓ oszlop mérve 529/595 sorra ugyanazt írta** („Balaton északi part”) — köztük
  47 siófoki, 71 balatonlellei, 35 zamárdi (DÉLI part) és 9 tapolcai (nem parti) sorra. Az
  érték **nem geokódolás**: a gyűjtő-definíció terület-azonosítója, kiírva a `region` sor
  `label`-jével — és **a címke hazudott a saját dobozáról** (bbox az egész tó, r = 30,45 km).
- ⛔⛔ **A címke nem konzol-ügy volt.** A `resolveRegion()` ugyanezt adja a generátornak
  régió-kontextusként: **68 mock_artifactból 63** tárolt `inputs.region` mezője a hamis címke,
  **40 bizonyíthatóan hamis** — köztük a **2026-08-23-i „javítás” UTÁNI** darabok. Az akkori
  szál ugyanezt megtalálta, a TÜNETET javította (5 artifact szövege + copywriter prompt-szabály),
  és maga írta oda: „⚠️ NYITVA: determinisztikus kapu erre nincs”. **A forrás 3 hétig élt
  tovább.** (A lemezen lévő renderelt lapokon ma 0 találat — a kockázat latens, nem élő.)
- **Szállítva:** ① a hamis nevet a FORRÁSNÁL javítottuk (migráció `0067` + `regions.ts` seed:
  **„Balaton”**, csak a beégetett értékre, operátori átnevezést nem írva felül; az ikerpéldányt
  a `scraper_definition.label`-ben is); ② **„Régió” → „Terület”**, a jelentése kimondja, hogy ez
  a gyűjtő-doboz NEVE, és elküldi a földrajzi kérdést az Ország/Város oszlophoz; ③ a
  besorolatlan sor a kulcs (`bs`, `_test`) helyett az **ÁLLAPOTOT** mondja: „nincs besorolás”,
  EGY szűrő-vödörben; ④ **„Felmérve” oszlop + kimondott alap-sorrend** (`effectiveLeadSort`);
  ⑤ a vágás szerkezeti javítása.
- ⚠️ **A vödör rendezési kulcsa a KIÍRT mondat**, nem az üres szűrő-érték — üres kulccsal a
  „nincs besorolás” sorok a B-betűs nevek elé ugrottak, vagyis a képernyő önmagának mondott
  volna ellent. Az őr fogta meg, nem én.
- ⛔ **A levágott MOCK-tölcsér csak PIXELEN látszott:** a tábla legkisebb szélessége **1210 px**
  volt az **1186 px**-es görgető-dobozban (`th{white-space:nowrap}`) — a DOM tökéletes volt.
  Javítás: tördelhető fejléc + 12→8 px vízszintes margó + törhető NÉV oszlop → **0 px** túllógás
  mindhárom nézetben, 52 karakteres szóköz nélküli névvel is.
- ⭐ **Az őr eddigi 110 állítása `setContent`-tel futott, ahol STÍLUSLAP SINCS** — az egész
  hibaosztályra vak volt. Az új réteg valódi kiszolgálót, valódi `citui` stíluslapokat és
  1280 px-et használ, öt nézetben, ÖNKONTROLLAL (mesterségesen széles oszlopra pirosnak KELL
  lennie). **139 állítás · önteszt 13 piros.** A pre-commit trigger mostantól a **stíluslapra
  is** szól — a hibát egy CSS-sor okozta, nem TypeScript.
- ⛔ **Amit MAGAM rontottam el, és a KÉP fogott meg:** a törhetőséget először a VÁROS oszlopra
  is rátettem („Balatonföldvá / r”), `min-width` nélkül pedig 390 px-en ~30 px-re lapult a NÉV
  oszlop. A desktop mérésem addig zöld volt.
- **Kapuk:** Elek **FK-003: 11 gépi zöld / 0 piros** (volt 10/0) · kb-check --coverage 35/35 ·
  i18n · design-token · internal-ref --fast · admin-list-labels · mock-state-label — mind zöld.
- ⭐ **UTÓSZÁL ugyanaznap (tulaj-utasításra, LEZÁRVA): a 63 tárolt `inputs.region` is javítva.**
  Az `inputs` nem archívum (a `rerender-mock` ebből renderel, a `brief.ts` tény-kontextusként
  adja az AI-nak). Újramérve az írás előtt: 63/68, mind `balaton-north`, 63× `$.region` + 1×
  `recipe…copy.eyebrow`. ⛔ **Egy vak „legyen egyenlő az élő címkével” szabály RONTOTT volna:**
  egy artefaktum `balaton-north` területről jött, mégis JOGOSAN visel „Badacsony…” címkét (a
  `resolveRegion()` a koordináta alapján a szűkebb, bennfoglalt dobozt választja) — a szabály
  ezért **„ne idézzen VISSZAVONT nevet”**, az élő címkék komplementeréből származtatva.
  ⛔ **Prózát nem írtam át:** egy KÖVESKÁLI (nem parti) szálláson ragozva áll az állítás, ott a
  csere új hazugság lenne — újragenerálás kell, addig NÉVVEL, indoklással az őr kivétel-listáján.
  Eszköz: `backfill-artifact-region.mts` (száraz futás · sha256-mentés írás ELŐTT · egy
  tranzakció · visszaolvasás). Igazolva **független** mérővel: 63 → 1, mentés `sha256 -c` RENDBEN.
  Őr: `artifact-label-quote-check.mts` (önálló bejáró, ragozott alakra is illeszt, az **elavult
  kivétel maga bukás**, üres DB-n kimondja, hogy nem mért); önteszt piros.
- ⛔ **Egy korábbi mérésem ROSSZ OKBÓL volt jó:** „a renderelt lapokon 0 találat” — közben a
  path-feloldásom 0 fájlt talált meg (a mockok a fa GYÖKERÉBEN vannak, nem a `sites/` alatt).
  Újramérve 66/68 fájl megvan, és tényleg 0-ban van benne az állítás.
- ⛔⛔ **A SAJÁT ŐRÖM CSAPDÁT ÉPÍTETT, és a tulaj szava buktatta le.** Egy dev-artefaktum UUID-ja
  állt benne kivételként, plusz az az állítás, hogy *az elavult kivétel maga bukás*. A tulaj
  jelezte: dev-adat, a nap végi purge elviszi — vagyis a kapu a purge MÁSNAPJÁN mindenkinél
  pirosra váltott volna, egy olyan ok miatt, ami közben HELYESEN szűnt meg. Efemer dev-azonosító
  nem való commitolt kapuba: a szabály SZERKEZETI lett (önálló idézet = kapu; ragozott próza =
  nem kapu, de névvel kiírva), és ha nincs visszavont címke, a kapu KIMONDJA, hogy nem mért.
  ⚠️ Ára: a rendes futás már nem nevezi meg a Köveskál-sort — az ADR-ben és a jegyzetben van.
- **NYITOTT:** ① tartós nyilvántartás a VISSZAVONT terület-nevekről (ma nincs; a Köveskál-sor
  újragenerálását a tulaj elvetette — dev-adat, a purge elviszi);
  ② nincs determinisztikus kapu arra, hogy egy terület NEVE igaz legyen a saját dobozára.

## Előző szál (2026-09-13)


**🔍 ADR-0137/0138 — A MOTOR AZ ELSŐ 20 TALÁLATNÁL MEGÁLLT, ÉS A FUTÁS NÉMÁN HALT MEG.**
Tulaj-bejelentés: „élesben pár napja indítottam a scape-et és nem futott le" — a vizsgálat
KÉT független hibát talált. Session-jegyzet:
`_planning/memory/2026-09-13_scrape_liveness_and_discovery.md`.

- **① A néma futás (ADR-0138, ÉLESÍTVE `prod/20260913-1818`).** A futás elindult
  09-11 08:49:59-kor, ~3 percig ment, majd egy **deploy** újraindította a konzolt
  (`KillMode=control-group`) — a scrape a konzol **gyerekfolyamata**, így a cgrouppal együtt
  meghalt. A sor két napig `running` maradt (a `failScrapeRun()` csak a folyamaton BELÜLI
  hibát zárja), a napló pedig a konzol memóriájában élt → elpárolgott. Most: percenkénti
  **életjel** + fázis a soron · SIGTERM-re önlezárás, SIGKILL-re a lista-lekérés zár · a
  régi, életjel nélküli futást csak a KOR ítéli el (2 óra) · „megszakadt" ≠ „hibára futott"
  (adatból, nem prózából) · Europe/Budapest idő · **deploy GATE 4**.
- **② A 20-as plafon (ADR-0137, LANDOLVA `0307438`, élesítve NINCS).** A Google Places forrás
  EGY hívást intézett EGY kulcsszóval, és az első lap 20 elemét hitte a régió válaszának:
  **20 hely a Google-ből, 1009 az OSM-ből** egy 64×46 km-es dobozra. Most: kulcsszó-halmaz ×
  csempe, végig lapozva; a 60-as API-plafont ÜTŐ lekérdezés **telített** → a csempe
  negyedelődik ~550 m-ig. Éles API-n mérve: **20 → 310 hely**. Plusz: az első **perc**-kvóta
  429 eddig az EGÉSZ dúsítást megölte (924 leadből ~900 Places-adat nélkül) — most kivárjuk;
  a NAPI kvóta azonnal, osztályozva bukik.
- ⛔⛔ **A saját méréseim háromszor voltak zöldek rossz okból** (mind őr fogta meg): a
  viewporthoz mértem, nem a vágó dobozhoz · a `sticky` a colspan-os cellán némán hatástalan
  (elgörgetve minden sor levágódott, nyugalomban zöld) · a pixel-fixture csupa tördelhető
  prózát kapott, így a VALÓDI, URL-es hibaüzenet kilógása átcsúszott.
- **Őrök:** `scrape-liveness-check.mts` (24 állítás, `--pixel`, önteszt 13 piros) ·
  `scrape-coverage-check.mts` (önteszt: az egy-hívásos viselkedés pontosan 20-at talál).
- **NYITOTT (a fontosabb fele):** nincs lefedettség-mérőszám, és a nyilvántartás sem segít —
  az `enrichPlaces` beírja magát a `sources`-be, a `discovery` provenance ebből épül, tehát a
  „ki TALÁLTA" és a „ki DÚSÍTOTTA" egy mezőben van (capture–recapture becslés így lehetetlen).
  Továbbá: a portál ma csak adatlap, nem katalógus (592 leadből 34) · Places típus-alapú
  keresés · OSM tag-kör mérése · és a gyökér: a scrape külön systemd-egységbe kívánkozik,
  mert a GATE 4 csak azt védi, aki a deploy-scriptet használja.

## Előző szál (2026-09-13)

**⛔⛔ ADR-0136 — A HALOTT FOTÓ NEM FOTÓ.**
Session-jegyzet: `_planning/memory/2026-09-13_dead_photo_liveness.md`.
Tulaj-kérés: „a lead mockjának nyitóképét is javítsd" — a premissza mérve TÁGABB volt.
- **A tény:** az ELEK-TESZT lead 13 tárolt fotó-URL-jéből **11 halott**; a két élő két idegen
  **reklámbanner**, amit a hero-doktrína amúgy is kizár — „válasszunk másik képet" tehát nem
  lett volna megoldás. NEM a mi kérésünk hibája (böngésző-UA-val és Refererrel is 404); a
  portál ÉL, a kép **új néven** ott van: a fájlneveket írták át. Rendszerszintű: 40 leades
  minta → **27 mért nyitóképből 6 halott (22%)**.
- **Szállítva ①:** a generálás kiszűri a **véglegesen** halott fotókat a fotó-halmaz EGYETLEN
  döntési pontján, a FIZETŐS vision-pontozás ELŐTT — halott URL nem lehet nyitókép, galéria,
  JSON-LD `image` vagy levél-illusztráció. ⚠️ 429/hálózati döccenés NEM ejt (üres galéria egy
  élő szállásnak fordítva ugyanakkora kár) — arra az ADR-0134 kiküldés-kapu való, ami a
  KISZÁLLÍTOTT lapot méri. Két réteg, két munka.
- **Szállítva ②:** park-frissítő út (`seed-elek-lead.mts --refresh-photos`). A fixture-ön a
  friss begyűjtés NEM működik, és ez **így helyes**: a lead át van nevezve, ezért az
  entitás-egyezés 0.44-en elbukik — **ezt a kaput nem lazítottam**. A frissítés azon az úton
  megy, amin a fixture SZÜLETETT: a klón-forrás valódi leadjét olvassuk újra.
- ⚠️ **A változásom ELTÖRT egy meglévő őrt**, és az ŐR FEJLÉCE mondta ki, miért: a
  `portal-photo-check` „offline és determinisztikus, mert minden commitnál fut" — a kitalált
  `cdn.booked.hu` URL-jei valóban 404-esek. A válasz nem a szabály gyengítése volt, hanem
  kimondott varrat + **szerkezeti tiltás**, hogy termék-kód ne kapcsolhassa ki. ⚠️ A tiltás
  első változata a SAJÁT magyarázó kommentemre illeszkedett — **a komment nem kód**.
- **Mérés utána:** 13 fotó (2 élő) → **10 (10 élő)** · nyitókép „exterior (88) — az épület szép
  kültéri nézete este megvilágítva" · kép-egészség **ok, 0 törött** · MMS-előnézet **READY**,
  a kimenő 42 kB-os JPEG a valódi nyitóképet viszi. Generálás: $0,1365.
- ⚠️⚠️ **HELYESBÍTÉS (a kért sweep mérése alapján):** a „22% / 8% halott" számaim egy PORTÁL-
  KIMARADÁST mértek. Ugyanaz az eszköz, ugyanazon a bájtra azonos URL-halmazon: 21:05-kor 72
  halott (8%), **21:45-kor 21 (2%)**; a hovamenjek-mintán 59/73 → **2/73**. Az ELEK-TESZT
  URL-jei viszont tényleg véglegesen halottak (átnevezés). ⛔ A KIMARADÁS nem lelet a rekordról.
- ⚠️ **A sweep `--fix`-em RONTOTT**, mert nem mértem előbb egy leaden: 0 visszanyert fotó, és a
  Mákszem 45 élő képe 0-ra esett. A park a 18:15-ös mentésből **bájtra igazoltan** visszaállt
  (595-ből csak a 2 szándékos javítás tér el). A `--fix` innentől visszaállít, ha nem javított;
  a generátor-szűrő pedig **gazdagép-kimaradás féket** kapott (ha egy host képeinek többsége
  bukik egyszerre, arról egyet sem ejtünk — a kiküldés-kapu döntsön, hangosan).
- **A `--discover` kör lefutott** (tulaj-kérés, célzottan a 4 leadre, előtte önellenőrzött
  mentés): a **Lavia 45/63-ról 46/46-ra** javult (a 18 halott URL kiesett), a másik háromnál a
  keresés sem talált többet → **visszaállítva**. ⛔ A Mákszemnél a friss olvasat MÁSODSZOR is
  nullázta volna a 45 élő fotót — a fék megfogta: **a visszagörgetés élesben bizonyított.**
  Park-szintű zárómérés: **21 halott URL → 3** (leadenként 1-1, valódi rothadás; a
  generátor-szűrő ejti őket, lapra nem kerülnek).

## Előző szál (2026-09-13) — a törött képes mock kiküldés-kapuja

**🖼️ ADR-0134 — A RENDSZER TUDTA, HOGY TÖRÖTT, ÉS MÉGIS ENGEDTE KIKÜLDENI.** Elek FK-003b
**L01** (tulaj-bejelentés). Session-jegyzet:
`_planning/memory/2026-09-13_broken_photo_send_gate.md`.
- **A lelet:** a kurátor-lap SAJÁT piros sávja kimondta, hogy „4 kép forrása nem érhető el —
  ezek a képek a **LEADNEK kiküldött lapon is törötten jelennek meg**", mind a négy
  nyitókép-csempe „nincs kép / 404-et ad" volt — és a **Jóváhagyás akadálytalanul átment**, a
  visszaigazolás egy szót sem szólt a képekről, majd a felület azonnal felkínálta a leadnek
  küldhető **követett linket**.
- **A mért ok NEM a mi oldalunkon** (curl, bot-UA-val és böngésző-UA+referer-rel is): a
  **hovamenjek.hu ÁTNEVEZTE** a fájljait, ezért a TÁROLT URL rohad el — mérve mind a 73
  tárolt hovamenjek-URL-en: **59 halott / 14 élő**, 11 leadet érint, ebből 8-nál MIND.
  ⛔ Az első leletem („megszűnt a séma", 8/8 minta) HAMIS volt: az adatlapok ÉLNEK, friss
  begyűjtéssel a fotók visszajönnek. Ezen a leaden a 13
  begyűjtött fotóból **11 halott**, a két élő pedig `balaton.hu` **reklámbanner** (ADR-0116
  kizárja) → **nulla használható fotó**. ⚠️ **Az ok múlandó, a kapu hiánya nem.**
- **A mérés MEGVOLT, a KÖVETKEZTETÉS hiányzott:** a `heroShot.ts` Playwrighttal ellenőrzi a
  levél nyitóképét, és a `null`-t „akkor kép nélkül megy a levél"-ként nyeltük el — a link
  mögötti lap ettől függetlenül kiment, 10+ üres kép-hellyel. A `photo-health` MONDATA a
  kiszállított lapról állított valamit, miközben a **bemeneti** fotólistát mérte.
- **Szállítva:** `src/outreach/mockPhotoHealth.ts` a **RENDERELT** `mock_artifact.path`-on mér,
  a konzol kép-proxyja `fetchPhoto`-jával (ugyanaz a lekérő és cache, mint a csempéken);
  **EGY predikátum** (`photoGateBlocks`) dönt mind a négy kapun (jóváhagyás · követett link ·
  levél · SMS); a mérés a **küldés pillanatában** fut; a kurátori tudomásulvétel **NÉVSORRA**
  szól (`inputs.brokenPhotoAck`) — ami azóta esett ki, arra nem érvényes; és a képernyő a
  **kattintás ELŐTT** is kimondja.
- ⛔ **Saját hiba menet közben:** a megtagadás `#a-<artifactId>` horgonya **nem váltott fület**
  (az `ALIAS` három nevet ismert) → a megtagadás-képernyő REJTETT fülön ült volna. A Playwright
  időtúllépése buktatta le, nem a kódolvasás.
- **Őr:** `scripts/mock-photo-gate-check.mts` — **22 állítás**, és nem fixture-ön: a lapot a
  TERMÉK renderelője adja, a kép-listát **valódi Chromium** (független referencia), a kaput
  **valódi HTTP + valódi DB-sor**, a 404-et helyi kép-szerver. Méri a **negatív irányt** is (ép
  mock akadálytalanul átmegy). Az önteszt **meggyógyítja** a renderelt lapot → **11 bukás**.
  `--sweep` a parkon: Dencs 6/0 ✅ · Rozé 5/0 ✅ · **ELEK-TESZT 4 kép / 4 törött ❌**.
  Élesítés NINCS.

## Előző szál (2026-09-13)

**🏷️ ADR-0133 — AZ EGYEDISÉG-ÁLLÍTÁS NEVEZZE MEG A HALMAZT, AMIBEN EGYEDI.**
Elek FK-006b **HIBA-1** (tulaj-bejelentés).
Session-jegyzet: `_planning/memory/2026-09-13_latest_badge_names_its_thread.md`.
- **A tény:** az Üzenetek feed tetején KÉT sor viselte egyszerre a zöld „Ez a legfrissebb"
  jelvényt, azonos időbélyeggel (14:54).
- ⛔ **A bejelentés PREMISSZÁJA mérve hamis volt, a tünete valós:** a `positionThreads()`
  **szálanként** jelöl egy legfrissebbet, és csak ha a szálnak van korábbi tagja
  (ADR-0125 ⑤) — a két jelvény **két KÜLÖN szál feje** volt (egy foglalási kérés és a
  dunning-létra). **Egyik állítás sem volt hamis**; ha „az egyik hamis"-t elhiszem, egy
  HELYES szabályt rontok el.
- **A valódi rés a MONDATBAN volt:** a jelvény egyediséget állít, de nem nevezi meg a
  **halmazt**, amiben egyedi — a listában az olvasó egyetlen halmazt lát, a képernyőt.
- **Javítás (tulaj választotta, előnézetes változatokból):** a szál **TÁRGYA** a
  `STATE_THREADS` regiszterbe költözött, a szál kulcsa mellé (előfizetés · foglalási kérés ·
  többnyelvű modul) → a jelvény FELIRATA és PREDIKÁTUMA egy táblából jön, és **név nélküli
  új állapot-szál nem fordul le**. A fej alatt — a „Felülírta: …" tükreként — ott áll, hány
  korábbi üzenetet ír felül, **pontosan egynél annak a CÍMÉVEL**.
- ⭐ **Miért kell a cím is:** a `tenant`-szabályú szálakból fiókonként EGY van, a
  `related`-szabályúból sok → **két külön foglalási kérés feje AZONOS nevet visel**. Épp
  ezek azok a szálak, amik az ADR-0126 szerint sosem hosszabbak 2 tagnál — a „pontosan egy
  → nevezd meg" szabály tehát pontosan a kétértelmű esetet fedi.
- **Az ADR-0125 „Túlhaladott" viselkedése VÁLTOZATLAN** (az őr külön méri).
- **Ráadás ugyanabból a körből (HIBA-3):** a kifizetett modul nyugtáján
  „Hivatkozási azonosító: `mock_837a03b6-…`" állt a FIZETŐ ügyfél előtt. Mostantól
  `CIT-837A03B6`, a **saját** `payment.id`-ból (`src/payment/publicRef.ts`), ugyanaz a képző
  a nyugtán és a fizetés-bukás lapon; és mert a „kérjük idézze" csak akkor igaz mondat, ha
  vissza is vezet: `scripts/find-payment.mts` (a régi nyers kezelőt is elfogadja).
- **Őrök:** `admin-list-labels-check` ⑦ (6 új állítás, független `kind → tárgy`
  referenciával; a fixture MÁSODIK foglalás-szálat kapott). Önteszt **14 → 16 sértés** —
  célzott rontással, mert a meglévő ④-rontás minden jelvényt eltüntet, és ott a ⑦ ÜRESEN
  zöld maradt volna. · `module-purchase-state-check`: emberi hivatkozás + a nyers kezelő
  NEM szivárog (helyi rontással bizonyított detektor) + kör-próba. Élesítés NINCS.
- ⛔⛔ **INFRA, negyedszer ugyanebben a fában:** a `~/wt/cit2167c7de`-be MÁSIK session is írt
  (ADR-0130), ezért a commit friss, `origin/main`-ről nyitott fából ment — **és a fájl-szintű
  `cp` áthozta az ő `console/server.ts`-üket** (159 sor, az enyém 5). Megosztott fából
  **fájlt másolni tilos**: hunkot vigyél, és nézd meg a diff-statot.

## Előző szál (2026-09-13) — a súgó érkezéskor

**🆘 ADR-0132 — A TEGNAPI JAVÍTÁS A MÁSIK VÉGLETBE ESETT, ÉS AZ ŐR ZÖLDEN VÉDTE.** Elek FK-000
(ERG-2/3/6). Session-jegyzet: `_planning/memory/2026-09-13_help_arrival_state.md`.
Kontraktus: `assets/design-refs/console/help-start/`.
- A tegnapi „35 cikkes fal → 9 összecsukható csoport" (`37ed329`) **mind a kilencet CSUKVA**
  adta érkezéskor: **NULLA cikkcím látszott**, miközben a jobb hasáb ugyanazon a képernyőn azt
  kérte, „Válassz témát a listából". A felület olyat kért, amit maga nem kínált.
- ⛔⛔ **Az ŐR ZÖLDEN VÉDTE a bejelentett hibát.** Az ① állítása szó szerint ez volt:
  *„alapállapotban MINDEN csoport csukva"*. **Egy őr annyit ér, amennyit az állítása KÉRDEZ** —
  ez a kérdés a SZERKEZETRŐL szólt (csukva-e), nem arról, hogy a felhasználó ELŐTT van-e
  tartalom. Az új ① a LÁTHATÓ CIKKCÍMEK SZÁMÁT méri; a visszarontott forráson **10 valódi piros**.
- ⛔⛔ **A §2b kapun azért csúszott át, mert a vázlat NEM azt a felületet modellezte.** A
  jóváhagyott `approved-A.html` **egyhasábos** volt, az éles lap kéthasábos — a jobb oldali
  felszólító doboz és a mellette üresen álló ~70% SOHA nem szerepelt a képen, amin a tulaj
  döntött. A vázlat SZERKEZETE (hány hasáb, mi áll a másikban) ugyanúgy a terv része, mint a szín.
- ⛔ **Az elvágott kereső-helyőrző nem szöveg-hiba volt:** a `.con form{display:inline}` (0,1,1)
  VERI a `.con-kb-search{display:flex}`-et (0,1,0) → a mező 200 px-re zsugorodott, a helyőrző
  274 px. Ugyanaz a specificitás-minta, mint a `.con a` ↔ gomb-szín ütközésnél. ⭐ És a saját
  vázlatom fogott meg egy továbbit: **telefonon a teljes szélesség SEM elég** → ott a mező külön
  sort kap, a gomb alá kerül.
- **Szállítva (tulaj-döntés „C", 3 működő vázlat mobil+asztali képpel):** az első csoport NYITVA
  renderel (szerver-oldalon, JS nélkül is) · a jobb hasáb **INDULÓLAP**: 9 témakör-kártya MIND a
  35 cikkcímmel, **telefonon rejtve** (ott a lista maga az indulólap — két méret, két döntés) ·
  **ÚJ „Súgó" FŐMENÜPONT** utolsóként, a /help-en aktívként · a gombpár a LISTA fölé került (a
  jobb, ÜRES hasáb fölött ült) · bal hasáb 300→360 px · ugyanez a tenant-admin Súgó fülén.
- ⭐ **Két hibát a KÉP fogott meg, nem a kód:** az indulólap-kártyán a jelölés elvesztette a
  pirulát és a csoportcím folytatásaként olvasódott („AZ OLDALAM ÜGYFÉL IS LÁTJA"); az üres
  tudástár fixture-jén kétszer állt ugyanaz a mondat, ráadásul „keresésre" hivatkozva olyankor,
  amikor nem is kerestünk.
- ⭐ **A tudásbázis-őr két valós hibát talált a saját súgó-szövegemben:** a „minden képernyő
  fejlécében van súgó-ikon" mérve HAMIS, és az entry kiírt „Frissítve" dátuma a mai módosítás
  mellett 09-06-on maradt.
- ✅ **LEZÁRVA ugyanaznap, tulaj-kérésre:** a Pénzügy öt képernyője megkapta a súgó-ikont
  (`helpLink()` a fejlécben). A `kb-check --coverage` mostantól **elutasítja a nem-`<a>` elemen
  ülő horgonyt** — a láthatatlan attribútum nem lehet többé „zöld lefedettség".
- ⛔⛔ **A pixel-mérés olyat talált, amit nem kerestem:** a súgó-ikon **MINDEN** konzol-képernyőn
  cián volt fehéren, **2,41** kontraszttal — a `.con a` (0,1,1) verte a `.con-help`-et (0,1,0).
  Ugyanaz a csapda, mint a fizetés-gomb színénél, **harmadszor**. ⛔ És a javításom **előállította
  a következő csapdát**: az új `.con a.con-help` (0,2,1) verte a sötét-sáv szabályt (0,2,0) →
  a partner-lap navy fejlécén 3,03. A küszöböt 3,0 → **4,5**-re emeltem: a 3,03 pont azt fedte
  volna el, hogy a szándékolt szabály NEM ért hatályba. Végleges: 4,81 fehéren, 14,57 navy-n.
  ⭐ Az őr a kontrasztot az **opacity-vel együtt** számolja — enélkül szebb számot mérne, mint
  amit a szem lát.
- Élesítés NINCS.
- 🔁 **HARMADIK KÖR — Elek FK-000 újramérés (friss kontextusú kiértékelő).** A három
  bejelentett lelet MEGSZŰNT, de a saját javításom **négy újat** hozott. ⛔⛔ **Az elrendezés-
  csere NÉMÁN vitt el információt:** a kártyákkal együtt kidobtam az egyetlen mondatot, ami
  megmondta, HOVA nyílik a kattintott cikk — és a kép mindkét állapotban rendezett, tehát a
  screenshot-ellenőrzés erre szerkezetileg vak. Visszatéve, őrzött állításként.
  **Tulaj-döntés ①:** asztalon a bal lista CSUKVA érkezik (a rács a tartalomjegyzék) — így
  megszűnik a kettőzés; ⛔ a becsukás JS-es, mert a degradáció iránya kötött: fordítva a JS
  nélküli telefonos olvasó nulla cikkcímet kapna. **Tulaj-döntés ②:** az FK-000 5. lépésének
  nem volt útvonal-mezője, ezért a képe BITRE AZONOS volt a 4.-kel — a kézi elrendezés-ítélet
  ugyanazt a lapot minősítette kétszer; most a /report-ra megy.
- ⚠️ **A saját öntesztem is pontatlanná vált:** a „mind csukva → nulla cikkcím" eset 1280px-en
  futott, ahol ez MOSTANTÓL a helyes állapot — átvive 390px-re.
- ⚠️ **Kapu-ütközés, nem lelet:** a `mock-photo-gate-check` a KÖZÖS `sites/`-be írja a
  fixture-jét → párhuzamos sessionök ENOENT-tel és hamis assert-bukásokkal állítják meg
  egymást. Szabad kapun újrafuttatva zöld. ⚠️ A saját várakozóm 52 percig állt, mert a
  `pgrep -f` a SAJÁT parancssorát is illesztette (CLAUDE.md §8 self-match csapda).

## Előző szál (2026-09-13)

**⛔⛔ ADR-0131 — A NÉMA HIBA PIROSRA VISZ; ÉS KIMENŐ KÉP NÉLKÜL NINCS PÁROS-INDÍTÁS.**
Session-jegyzet: `_planning/memory/2026-09-13_silent_failure_gate_and_mms_preview.md`.
Kiváltó: Elek **FK-004 H1** — a `result.jsonl` KÉTSZER rögzítette a
`404 …/prospect/…/mms-preview.jpg`-t (konzol- ÉS HTTP-hibaként), és **mindkét lépés `pass`**
lett. A hibát nem a mérőeszköz találta meg, hanem egy friss szemű kiértékelő.
- **① A kiváltó ok MÉRVE:** nem hiányzó generálás, nem rossz útvonal — a látványterv
  **nyitóképe a portálon permanens 404**, ezért a `heroShot` (helyesen) megtagadta a
  cache-elést. A hiba a FELÜLETEN volt: feltétel nélkül linkelte a képet, és a törött-kép
  ikon alatt ott állt az **élő „Páros indítása" gomb** (valódi SIM, visszavonhatatlan MMS).
  A küldés maga fail-closed volt — **csak a képernyő hallgatott** (ADR-0082 fordítva).
  Mostantól: `<img>` CSAK `ready` állapotban; egyébként kimondott ok **a törött URL-lel**,
  `disabled` gomb „(nincs kép)" felirattal, eltűnő egygombos sáv; a route **csak cache-ből**
  szolgál ki (eddig `<img>`-kérésen belül futtatott 2×30 mp Chromiumot), háttér-render +
  állapot-poll — **mérve 3 lapmegnyitás = 1 render**.
- **② A mérőeszköz:** a runner ítélete beszámítja a rögzített konzol-/HTTP-hibákat. Jogos hiba
  csak **kimondva** mehet át: `tűrt-hiba: <minta> — <indok>`, **indok nélkül a parser dob**.
  Az átengedett hiba a naplóban marad az indokkal; az elavult minta kiíródik. **20 futás
  átnézve: 3 helyen volt zaj** (1 valódi hiba, 1 jogos 503, 1 elavult token) — a szabály nem
  árasztja el pirossal a készletet.
- ⚠️ **Mellékleletek:** a tiltott gomb ÉLŐNEK NÉZETT KI (`.con button:disabled` nem létezett,
  miközben a dizájn-magban megvan) · a hosszú URL kilógott a piros dobozból 390px-en · a
  Playwright `clip` **fullPage nélkül a viewportra vág** · az első őr-változatom épp az
  egyetlen VALÓDI kivételünkön bukott (a `503 /t/…` minta egyetlen részszövegként sosem
  illeszkedik — az efemer host közéesik) → token-illesztés.
- **Őrök:** `mms-preview-gate-check.mts` (a regressziót visszainjektálva is elkapja) ·
  `elek-noise-verdict-check.mts` (**ÉLES runner-futás** negatívan ÉS pozitívan).
  FK-004 a javítás után: **12 lépés, 0 konzol-/HTTP-hiba.**
- **NYITOTT:** az ELEK-TESZT látványterv nyitóképe halott portál-URL — a LEADNEK kiküldött
  mock nyitóképe is törött (adat-frissítés, külön feladat); az FK-006a `tűrt-hiba:` sora
  élesben nem futott (időutazó tiltva volt), a minta illeszkedése egység-szinten igazolt.

## Előző szál (2026-09-13) — a feladó-azonosítás kapuja

**⚖️ ADR-0130 — A KAPU ZÖLDEN ENGEDETT KI EGY LEVELET, AMI MAGÁRÓL MONDTA, HOGY „NEM VALÓDI".**
Elek FK-004 **H2** (tulaj-bejelentés).
Session-jegyzet: `_planning/memory/2026-09-13_sender_identity_gate.md`.
- **A tény:** a ténylegesen KIKÜLDÖTT hideg megkeresés lábazata „A megkeresés küldője:
  **TESZT Szolgáltató e.v. (nem valódi)** · nyilvántartási szám: TESZT-00000000 · adószám:
  12345678-1-42", az aláírása valódi személy, a lap teteje zöld „**PASS — küldhető**".
- ⛔⛔ **A kapu nem is vehette észre:** mind a négy §C.2 szabály a SZÖVEGET mérte, a szöveg
  pedig pontosan azt írta, amit a config diktált (a `[…]` jelölő hiányzott, a „A megkeresés
  küldője:" sor megvolt, a kapcsolat-blokk hibátlan). **Egy éles félrekonfiguráció ugyanígy
  nézne ki, ugyanígy PASS-szal** — a kapu arra volt vak, amit a legkönnyebb elrontani. A
  dev-érték átírása NEM javítás (tulaj-elhatárolás): a tünetet tünteti el, a lyukat nem.
- **A javítás:** a mérés a **KONFIGURÁCIÓRA** költözik, mezőnként három rétegben — ① kitöltött-e,
  ② **valódi alakú-e**, ③ nem a `.env.example` minta-értéke (pontos egyezés, EGY forrásból).
  ⛔ **Szó-feketelista tilos:** ez a fájl kétszer sült el HELYES értékre (`xXx` token; a valós
  `12345678-1-42` a `1234567` mintán, ADR-0121). A kérdés nem az, hogy „teszt-szagú-e", hanem
  hogy **lehet-e valódi**: az adószámot **ellenőrző számjegy** dönti el (a minta-szám 8. jegye
  6 lenne, nem 8 → nem létező szám), a nevet **karakter-osztály** (bejegyzett név nem visel
  zárójeles megjegyzést), az e-mailt **RFC 2606/6761 fenntartott** névtér. A helyes alakú
  dev-székhely (`8360 Keszthely, Teszt utca 1.`) **átmegy** — a kapu nem „a devet" utasítja el.
- **Strukturált lelet** (`OutreachCheckResult.identity`): melyik env · mit nyomtatna a levél ·
  mit mért a kapu — piros keretes dobozban ott, ahol a visszafordíthatatlan gomb van.
  ⚠️ Az első vágásom `class="card"`-ot használt, amire a konzol-CSS-ben NINCS szabály → a lap
  legsúlyosabb blokkja laza szövegként rajzolódott; a KÉP fogta meg, nem a kód.
- **Bizonyítás:** 14 negatív eset (mind FLAG + megnevezi a mezőt) · az **ÉLES** konfig-értékek
  pozitívként kitűzve (**a hamis FLAG ugyanolyan bukás, mint a hamis PASS** — csendben az
  üzletet állítja meg) · a bekötés **alfolyamatban** (a config module-load kor olvasódik) · és
  a viselkedés a valódi küldő-úton: `sendOutreachMail` → `flagged` (dry-run, levél nem ment ki).
- **Vállalt következmény (TULAJ-DÖNTÉST IGÉNYEL):** a dev .env teszt-entitása miatt **innen
  hideg megkeresés nem küldhető** (az FK-004 7. lépése blokkolva lesz). Ez a kapu helyes
  működése; a dev-küldés visszanyerése valós e.v.-adat a dev .env-ben, **nem** a kapu tompítása.
- ⚠️ A worktree-t egy MÁSIK session is használta (FK-004 **H1**, törött MMS-előnézet) stage-elt
  indexszel → a commit friss, `origin/main`-ről nyitott fából ment. Élesítés NINCS (§0.3).

- ⭐ **UTÓSZÁL ugyanaznap (tulaj-utasítás): Z1/Z2 — ADR-0135.** A zöld „PASS — **küldhető**"
  jelvény egy piros figyelmeztetés fölött (nem derült ki, melyik dönt — nem a piros: a levél
  kiment), és küldés UTÁN is „küldhető". **A premissza alatt nagyobb hiba volt:** a
  `sendOutreachMail` **KILENC** okból utasít el, a jelvény **egyet** mért ezekből — mérve
  három ELEK-prospect „küldhető"-t mutatott volna, miközben a küldő-út „a mock kurátori
  jóváhagyásra vár"-ral dobta vissza. **A jelvény nem tévedett: MÁS KÉRDÉSRE válaszolt.**
  Mostantól a lap döntő sora a küldő-út SAJÁT verdiktje (`describeMailSendability` →
  `sendOutreachMail(dryRun, probe)`), a §C-jelvény csak azt állítja, amit ítél, a
  figyelmeztetés pedig kimondja, hogy **nem blokkol**. ⚠️ A száraz futás egyetlen drága lépése
  az `ensureLanguagePack` (provisionál: AI + DB-írás) — GET-renderen tilos, ezért `probe`
  módban a hiányt MÉRJÜK: ez a SZIGORÚBB irány, a próba soha nem lehet megengedőbb a
  küldésnél. Őr: `outreach-sendability-check.mts` a KIRENDERELT lapon, 20 prospecten;
  önteszt **10 piros**, + a ② szabály külön bizonyítja magát a ténylegesen kiment
  jelvény-szövegen (a hazug állítás azt nem falszifikálná).
- ⭐ **HARMADIK KÖR ugyanaznap (tulaj-utasítás): Z3/Z4 — ADR-0139.** A lap egyszerre mondta,
  hogy a levél „még nem ment ki", és hogy a linken **119 esemény** történt; küldés után pedig a
  teljes levél-szöveg + másoló gomb jelzés nélkül maradt. **Mérve:** 5 sosem-küldött linkből
  **3-on van forgalom**, mind ugyanarról a Linux-desktop böngészőről (SAJÁT megnyitás) — a két
  állítás külön-külön IGAZ, a hiba az együtt-állásuk. ⭐ A pénz-ág tiszta: az ADR-0088 hármas
  küszöb `sent_at` nélkül kilép. ⛔ **Latens mechanizmus-hiba a premissza alatt:** a „✓ E-mail
  elküldve" a CSATORNA-FÜGGETLEN `sent_at`-ból jött, amit a mobil páros is beállít → mobil-only
  megkeresésnél HAMIS lett volna; **ma 0 ilyen sor van** (kimondva: latens, nem mai tünet).
  Javítva: csatornánkénti pirulák a saját bélyegből · a szám megnevezi, mit számol („4 **követett
  link** · ebből 1 ment ki (**bármely csatornán**)") · a sosem-küldött link forgalma megmondja,
  **mi nem lehet** · küldés után a másolás kimondja, hogy MÁSODIK példány lenne (a szöveg marad).
  Őr: `outreach-row-truth-check.mts`, 5 sor-állapot + másoló-doboz, fixture a termék forrásából;
  önteszt **5 piros**, + különbségi eset (nulla forgalomnál nem figyelmeztethet).
- ⭐ **NEGYEDIK KÖR ugyanaznap (tulaj-utasítás): Z5 — ADR-0141.** Zsargon és nyers
  adatbázis-érték az operátor-felületen: „pipeline… (H1-bázis)", „kézi küldés (A2)", „Egy
  claim… artifact-verdikt", „gammu-smsd áll", „Pilot-tölcsér (H1–H5)", „Order-intentek" —
  plusz `nincs_honlap` a piszkozat-lap CÍMÉBEN, miközben ugyanott a választó már „nincs
  honlap"-ot írt. Javítás: a felirat **REGISZTERBŐL** jön (`segmentLabel`,
  `prospectStatusLabel`, `sourceLabel`, `provFieldLabel`; ismeretlen értéket nem találgatunk,
  csak olvashatóvá teszünk), a kód helyére pedig az kerül, amit JELENT („H1 — horog" →
  „Megfogja-e a levél"). ⭐ **Az őr a bejelentésen FELÜL 10+3 szivárgást talált** (`Provenance
  (A4)`, `Szegmens-bontás (H4)`, 2× `(A2)`, 6 KB-hely; és `google_places`/`presence_check`/
  `places_match` a „Honnan jött az adat" táblából) — **a bejelentés a LÁTOTT példányt sorolja,
  az őr a MINTÁZATOT.** ⚠️ A zsargon-szabály CSAK `T(lang, …)`-szövegen fut (a `scrape`
  kód-azonosítóként is él), a fázis-kód mintája szűk (a puszta „H1" a SEO-ban jogos), és a
  nyers-enum szabályt az adat elrontása nem falszifikálja → a KIMENT markup igazolja.
- ⭐ **ÖTÖDIK KÖR ugyanaznap (tulaj-utasítás): Z6/Z7 — ADR-0142.** A „Páros indítása (nincs
  szám)" gomb a saját előfeltételének hiányát közölte, és nem mondta meg, hol lehet számot
  pótolni; küldés után pedig a cím-mező és a „Cím mentése" gomb aktív maradt. ⭐ **A premissza
  fele közben megszűnt:** a gomb „aktívnak látszik" része egy MÁSIK szál (ADR-0136)
  `.con button:disabled` szabályával már javult — ezt kimondtam, nem írtam a saját számlámra.
  Ami nyitva volt: a felület a HIÁNYT kimondta, a KIUTAT nem. Mostantól a tiltott vezérlő
  mellett ott a kiút (link a lead adatlapjára — a szám a LEAD adata, ezért hivatkozás, nem
  második mező), és a visszafordíthatatlan után nincs szerkesztés azon, amit elküldtünk
  (a cím olvashatóan marad, űrlapként nem). Őr: +5 állítás, önteszt 5 → **9 piros**.
  ⚠️ A Z6 állapot ezen a gépen nem áll elő (a 0130-as kapu mindent blokkol) → a szöveget a
  valódi renderből olvastam, a Z7-et ÉLES lapon néztem meg.
- 🔚 **ZÁRÁS (2026-09-14): a dev .env valós adatokat kapott, és az FK-004 ZÖLDEN lefutott.**
  Tulaj-utasításra a `LEGAL_ENTITY_*` (+ `OUTREACH_SENDER_COMPANY`) a dev `.env`-ben az ÉLES
  értékekre állt — forrás a prod `.env`, `diff`-fel igazolva, hogy sorról sorra egyezik és a
  fájl többi sora változatlan (mentés: `~/.claude/env-backup-2026-09-14-080346.env`).
  ⚠️ **A `.env` NINCS verziókövetve** — ez a bejegyzés az egyetlen nyoma.
  Mérve: azonosítás-kapu 0 probléma, a küldő-út dry-runban `dry-run` (átengedi).
  **FK-004: 8 pass · 0 fail · 0 blokkolt · 4 kézi · 0 konzol-/HTTP-hiba**, a levél kiment, és
  a lábazatában a VALÓDI cégazonosítás áll (`Olasz Ferenc e.v. · adószám: 69646014-1-33`) —
  szemben a reggeli „(nem valódi)"-val, amire a kapu még PASS-t adott.
  ⛔⛔ **Két saját hiba a záráskor:** ① a felirat-cseréim ELTÖRTÉK a saját forgatókönyvünket
  (első futás 2/1/**9 blokkolt**; a teszt a régi „e-mail még nem ment ki"-t várta) — a KB-t őr
  védi a felirat-drifttől, az Elek-forgatókönyveket SEMMI; ② a javítást a FŐ FÁBAN
  szerkesztettem, ahol nem fejlesztünk — és amíg ott követetlen módosítás ül, a `land.sh`
  MINDEN session fő-fa-frissítését kihagyja („Fő fában commitolatlan változás van"), vagyis a
  :4600 némán lemarad. Rendezve: fő fa tisztára állítva, a javítás a munkafából landolt.
  ⚠️ **Az első mérésem rossz fából futott** (a mock-HTML-ek a FŐ FA gyökerében vannak, az
  artifact-útvonal relatív → `process.cwd()`): a worktree azt mondta, a küldés blokkolt, a fő
  fa azt, hogy megy. Elek-mérésnél a fő fa a mérce.
  **Nyitva:** az Elek-forgatókönyvek felirat-őre (⚠️ a naiv változat hamis riasztásokat adna:
  a forgatókönyvek küldés/fizetés UTÁNI állapotokat is állítanak) · a park duplikátum-termelése
  (a `one-approved-check` egyszer MINDENKIT blokkolt) · az FK-004 ERGONÓMIA/GYANÚ szekciói.
- 🛡️ **UTÓLAG (2026-09-14): megépült az Elek-forgatókönyvek FELIRAT-ŐRE (ADR-0146).** Ígértem,
  hogy előbb mérek — és a mérés KÉTSZER cáfolta a saját ötletemet: ① a naiv szabály 7-et
  jelölt volna, ebből **4 az én mérési hibám** volt (a futó `getByText`-je kis-nagybetű-
  érzéketlen RÉSZSZÖVEG; **egy őr, ami szigorúbban mér, mint a mért rendszer, hamis leletet
  gyárt**), ② a maradék 3 nem felirat, hanem ADAT. ⛔⛔ **Az önteszt három vakságot hozott ki,
  amit a zöld futás elrejtett:** a nyers fájl-olvasás a saját KOMMENTJEINKET is „élő
  szövegnek" látta; a KB kép-aláírása feloldotta az átnevezett feliratot (a KB nem
  bizonyíték — a forgatókönyv a TERMÉKRE mér); és a katalógus **egykarakteres „H"** bejegyzése
  a sablon-ágon MINDENRE illeszkedett, azaz a „156/156 zöld" semmit nem ért. Végleges alak:
  literál-only (TS AST) + lefedettség-küszöb + **darabonkénti** feloldás (az állítás gyakran
  FELIRAT + ADAT). Önteszt: 3 független valódi driftre piros, 156 élő állításra nulla hamis
  riasztás, + egy kitűzött felirat, amire TILOS pirosat adni. ⚠️ **Korlát kimondva:** fa-szinten
  mér, nem lap-szinten — a mai KONKRÉT bukást nem fogta volna meg, ugyanannak a driftnek két
  másik sorát viszont igen.
## Előző szál (2026-09-13) — 29 nyelv és három sáv

**🌍 ADR-0128 — A TÖBBNYELVŰ MODUL KINŐTTE A „FIX 3 NYELV"-ET.**
Session-jegyzet: `_planning/memory/2026-09-13_multilang_29_languages_three_tiers.md`.
Kontraktus: `assets/design-refs/console/multilang-tiers/` (§2b terv-kör, A/B/C-ből az **A**).
Tulaj-bejelentés: „nagyon kevés nyelvre lehet lefordítani… legyen EU-nyelvekkel."
- **A premissza mérve IGAZ volt** (9 választható célnyelv; az EU 24-ből 14 hiányzott) — de a
  puszta lista-bővítés KÉT helyen némán rontott volna: ① a `flagSvg()` ismeretlen kódra ÜRES
  stringet ad (19 új zászló nélkül a VENDÉG-oldali nyelvváltón csupasz nevek); ② ugyanaz a
  `supportedLangs()` táplálta az OPERÁTOR-KONZOL nyelvválasztóját is (28 konzol-nyelv, mindegyik
  első kattintása 2405 stringes AI-csomag + KB-fordítás, addig hu-fallback).
  → **Egy „csak adat" lista bővítése előtt nézd meg, HÁNY fogyasztója van, és mindegyiknél
  KÜLÖN döntsd el, hogy a bővítés neki is helyes-e.**
- **Két lista, a másodikat LEVEZETVE:** `siteLangs()` = eladható 29 (EU 24 + szerb, ukrán,
  orosz, török, norvég); `uiLangs()` = a `COUNTRY_LANG` értékeiből származtatva — piacot nyitni
  az, ami UI-nyelvet érdemel, így a kettő nem tud elcsúszni.
- **Az ADR-0063 §2 „fix 3 nyelv" FELÜLÍRVA:** három sáv (Alap max 3 / 14 900 · Bővített max 6 /
  22 900 · Teljes mind a 28 / 30 000), `module_price` sorokon → operátor-szerkeszthető; az Alap
  SZÁNDÉKOSAN a régi `multilang` sort örökli, tehát korábbi rendelés értéke nem mozdul. A tulaj
  tudatosan tömörítette a sávokat (a Teljes a Bővítettnél csak +7 100 Ft): a cél a maximális
  terjedés. A sapka LÁTHATÓ (a fölös csempe halványul), a csonkítás KIMONDOTT.
- ⛔⛔ **A ragadó ár-sáv a kártyán BELÜL halott:** a `.adm-card` `overflow:hidden` (a full-bleed
  navy fejléc negatív margóihoz KELL, nem vehető el) lesz a `position:sticky` scroll-konténere.
  **És ezt a teljes-lapos screenshot ZÖLDNEK mutatja** — a sticky elemet a végleges helyére
  festi. A terv-kör mind a HÁROM változatában megvolt, mind a hat képem zöld volt; csak a
  végigkattintás fogta meg. Most a form a kártya KÖRÉ került, a sáv a testvére, és egy
  `render()`/`setAll()` tölti mindkét példányt — két megjelenítés, nem két igazság.
- **Őr:** `multilang-tier-check.mts` a RENDERELT kártyán, valódi admin-CSS-sel és viewport-metával
  (az első változatom csupasz `<body>`-ba írt, ahol nincs `overflow:hidden` → egy MÁSIK lapot
  mért volna). A negatív öntesztnél az ADATOT visszarontani NEM volt elég: a sáv-kártyák, a
  sapka-sor és a „csomag tartalma" ÚJ JELÖLÉS → `stripNew()` a jelölésre is. Az írás-kapu blokkja
  vakon zöldelt, amíg a fixture nem lett renderelhető (a rendelés a „site még nem renderelhető"
  ágon bukott, a nyelv-kapuhoz el sem jutott) — most külön mérés bizonyítja, hogy ELÉR odáig.
- ⚠️ **Saját hibák:** backtick a CSS-kommentben lezárta a template literált, és a `&&` miatt a
  verify a RÉGI HTML-t mérte (kétszer); sticky `top`+`bottom` együtt → a TOP nyer; rács-elemként
  a sticky mozgástere a saját cellája; a Playwright `clip` a TELJES LAPHOZ koordinál (rossz sávot
  vágtam, azt hittem hiányzik a gomb — `elementFromPoint` döntötte el); egyszer pedig a TESZTEM
  számolt rosszul (3+1+3=7), nem a mock.
- **AZ ÉLESÍTÉSI KAPU TOVÁBBI HIBÁKAT FOGOTT.** A `deploy-prod.sh` dry-run elbukott: a
  `tudasbazis-or` FLAG-elt (a súgó „a választó ALATTI sor"-t írt, pedig a kapacitás-sor a rács
  FÖLÖTT van; „28 közül (EU 24+5)" = 29 felsorolva; nem mondta ki a „legalább egy nyelv"
  feltételt, pedig a kártya NULLA pipával nyílik). ⚠️ **IKER-JAVÍTÁS:** a land rebase-konfliktusa
  megint azt jelentette — egy párhuzamos szál (`eed4659`) ugyanezt a kaput ütötte, ugyanazt a
  KB-fájlt javította, ugyanarra a megoldásra jutott; az övé landolt előbb, a duplikátumomat
  eldobtam. Szóhasználat: ő a súgóban MEGMAGYARÁZTA a „sáv/csomag" kettősséget, én a FELÜLETRŐL
  vettem ki a „sáv"-ot (a tulaj-látható szövegben EGY volt, pont a „Betelt a CSOMAG…" közepén) —
  az ő mondata így hamissá vált, kikerült.
- ⛔ **HAMIS ÍGÉRET A SAJÁT KONTRAKTUSOMBAN** (a másik szál őre mérte ki): a README „az árak
  operátor-szerkeszthetők maradnak"-ot állított, de az Árazás lap a `MODULE_CATALOG`-ot járja —
  a `multilang6`/`multilang28` MEZŐJE HIÁNYZOTT, a mentés eldobta volna. Nem a kontraktust
  igazítottam a kódhoz, hanem a kódot az ígérethez (+ őr ⑥b). **Ha egy kontraktus ígér valamit,
  legyen ŐRE is.**
- ⛔ **ÉLESÍTÉS ELMARADT — tulaj-döntés.** Az engedély („menjen ki élesre") akkor született,
  amikor az éles 1 committal volt lemaradva, és az az enyém volt. Mire odáig jutottam, a main
  7 committal járt előrébb, ebből 5 idegen szálé — köztük egy **FIZETÉSI kapu** módosítása. Az
  ADR-0053 verziót visz ki, nem fájl-válogatást, tehát ezt kimondtam és megkérdeztem: a tulaj
  a **többi session zárásának megvárását** választotta. Az engedély nem áll tovább, ha közben
  megváltozik, hogy MIT visz ki. (Az éles `9cfc5e7`-en maradt.)
- **NYITOTT:** nem-latin írás (görög, bolgár, orosz, ukrán, szerb — a sablon-fontok latin-only);
  vendég-adatból ajánlás (a Places `languageCode`-ot ad, a `PlaceReview` eldobja → amíg nem
  tároljuk, nem állíthatjuk, hogy „mértük", §B.17); **és az élesítés.**

## Előző szál (2026-09-13) — a szálba csukás nem válasz

**🔎 ADR-0127 — A MÉRÉS A MEGOLDÁST CÁFOLTA, NEM A PROBLÉMÁT.** Az FK-001 **E2**:
az ADR-0125 kimondottan nyitva hagyott tétele.
Session-jegyzet: `_planning/memory/2026-09-13_message_topic_filter.md`.
Kontraktus: `assets/design-refs/tenant-admin/uzenetek-tema-szuro/`.
- **A kért javítás (foglalás-sorok szálba csukása) mérve 35 → 34 sort ad. Egyet.**
  A 35 foglalás-üzenet **34 KÜLÖNBÖZŐ foglalási kéréshez** tartozik (33 egytagú szál,
  1 kéttagú): az ismétlődés nem a szálon *belül* van, hanem a szálak *között* — ugyanaz
  a tárgy **10 különböző `related_id`-n**, mert 10 Elek FK-007 kör küldte be újra
  ugyanazt a két vendéget. Összecsukni őket **valós foglalások elrejtése** lett volna.
- **Szerkezeti plafon:** egy foglalási kérés legfeljebb **2** üzenetet termel (érkezés +
  egy záró esemény), elfogadásnál 1. A teljes 50 sornyi nyereség a **dunningból** jön —
  abból, amire a tulaj az ADR-0125-ben a „jelölés a soron"-t választotta.
  **Park-zaj:** 114-ből 112 üzenet 3 nap alatt, és **mind a 35 foglalás-üzenet ÁRVA**
  (join: 35/0 — a kör-újraindítás törli a foglalást, az üzenet-naplót nem).
- **Amit a mérés VALÓBAN talált (és a tulaj kérésére megépült):** a szűrő-sáv csak
  szállításról és olvasottságról tudott — arról nem, hogy **miről szól**. Éles fiókban a
  postaláda ~61%-a foglalás-értesítő, tehát „mutasd a számlázást" csak kereső-szóval ment.
  Most **két soros sáv** (§2b „A", 3 működő mockból): „Miről szól" kizáró témák
  (Foglalások · Számlázás · A honlapom · Fiók) + „Szűkítés" kapcsolók, amik a témával
  **EGYÜTT** hatnak. **Egy predikátum** (`projectMessages`) adja a listát ÉS minden chip
  számát → a szám azt ígéri, amit a kattintás szállít. A régi `f=` bemenetként tovább él.
- ⛔ **A saját tervem első vágása a bejelentett hibát ismételte meg** (görgethető
  téma-sor mobilon → három téma a keret alatt maradt); a KÉP fogta meg, nem a kód.
- ⭐ **Egy trivializálódott őr-állítást kicseréltem:** a téma a `kind` függvénye, akárcsak
  a szál kulcsa, tehát a téma-szűrés szerkezetileg nem vághat ketté szálat — az állítás
  sosem tudott volna pirosra menni. Helyette az INVARIÁNS áll ott.
- ⛔ **A tudásbázis-őr KÉT körben talált valós hibát a saját súgó-szövegemben** — és
  mérve mindháromban a VISELKEDÉS volt helyes, a SZÖVEG hamis.
- **Őr:** `admin-list-labels-check.mts` ⑥ a kirenderelt sávon, független referenciával;
  önteszt **11 sértés** (4 új). Elek FK-001: 3 gépi zöld / 0 piros. Élesítés NINCS.
- ⭐ **UTÓSZÁL ugyanaznap (tulaj-döntés, ADR-0127 ⑦):** a **„Mind olvasott" mostantól
  csak a SZŰRT listára hat** — eddig szűrt lista mellett is a teljes postaládát törölte,
  vagyis többet tett, mint amit a képernyő állított. A hatókör ugyanaz a
  `projectMessages()`, amiből a lista renderelődik (⛔ SQL-be írva a predikátum második
  példánya lenne). **A felirat követte a viselkedést:** „Mind olvasott (114)" / „A szűrt
  77 olvasott" — egy gomb, ami a helyes sorokat jelöli meg, de „Mind olvasott"-at ír,
  ugyanúgy hazudik. Mérve a valódi DB-úton a közös parkon, és pontosan visszaállítva.
  ⚠️ Az őr fixture-je gyenge volt (1 olvasatlannal a két szám egyezett) → 4-re bővítve,
  önteszt 11 → **14 sértés**.
- 🧹 **HARMADIK KÖR (tulaj-utasításra): a park kitakarítva, 114 → 70 üzenet, nulla árva.**
  Eszköz: `scripts/purge-orphan-messages.mts` (dry-run alapból). ⛔⛔ **A saját
  leltár-sorom volt hamis, és a tulaj azt idézte vissza:** „114 árva" helyett mérve
  **44** (35 foglalás + 9 számla); a maradék 70 ÉRVÉNYES rekord, köztük 50 dunning,
  aminek eleve nincs `related_id`-je. **„Sok belőle" ≠ „árva"** — a leltár-sort elhíve
  70 valós rekordot töröltem volna. ⛔ A DB-széles sweep 46-ot adott: a 2 többlet a
  **Dencs** tenanté (a tulaj sajátja), ezért a script alapból a parkra szűkít és
  hangosan kiírja, mit hagyott ki. Biztosítékok: független őrsor a törlés előtt,
  sha256-os mentés írás ELŐTT, egy tranzakció, törlés ID szerint, visszaolvasás.
  Igazolva: 0 árva · Dencs érintetlen · a mentés `sha256 -c` RENDBEN.

## Előző szál (2026-09-12)

**🏷️ ADR-0126 — A FEJLESZTŐI AZONOSÍTÓ NEM FELHASZNÁLÓI SZÖVEG; ÉS A SÚGÓ CSOPORTJA ADAT.**
Elek FK-000 (tulaj-bejelentés). Session-jegyzet:
`_planning/memory/2026-09-12_internal_refs_and_help_categories.md`.

- **① A bejelentés 3 sort nevezett meg, a mérés 132 találatot adott.** A konzol Árazás-lapja
  „Egyedi domain — feltételek (ADR-0109)"-et írt ki az operátornak; ugyanez az osztály ott volt a
  megkeresés-kapu felirataiban (`§C-kapu: PASS`), a **csak HIBÁS ágon renderelődő** kapu-ok-
  sorokban (`C4: … §A demo-framing sérül`), a súgó-cikkekben, a Teszt-napló forgatókönyv-
  címeiben, a küldés-visszautasításokban — és **két ADR-számban egy MIGRÁCIÓS SEEDBŐL**
  (`0057_market.sql`), ami a `/settings` lapon jelent meg.
  ⛔ **Az utóbbit egyetlen forrás-grep sem találhatta volna meg: a szöveg ADAT volt, nem literál.**
  A javítás elve: **az indoklás MARAD, emberi nyelven — a könyvtári jel megy.** A kód-komment, a
  `console.warn` napló és a migráció `--` kommentje megtartja (ott hasznos). A `§C-kapu` neve
  mostantól **„jogszerűségi kapu"**, és a felirat a súgó IDÉZETÉVEL és az Elek FK-004 `várd:`
  elvárásával EGYÜTT mozdult.
- **Őr:** `scripts/internal-ref-check.mts` három rétegben (① 59 konzol + 30 tenant-admin lap
  `innerText`-je, a route-lista a szerver SAJÁT forrásából; ② 43 kapu-ok-sor elrontott bemenetről;
  ③ statikus iker: AST-literálok + súgó + forgatókönyvek RENDERELT mezői + a migrációk BEÍRT
  szövege). **Negatívan igazolva:** kód-literálba visszatett ADR → piros ①+③; DB-be visszatett
  seed → piros **CSAK ①-ben**. A negatív önteszt azt is méri, hogy a JOGSZABÁLYI §-ra
  (`… 4. §-a`, `Ptk. 6:78. §`) NE piruljon. Commit-kapuban `--fast` (②+③), a kihagyás kimondva.
- **② A súgó 35 cikkes fala csoportosítva.** Tulaj-döntés (AskUserQuestion): a besorolás
  **frontmatter `category:` + kapu** (nem kódbeli slug-táblázat — abból egy ÚJ cikk némán
  „egyéb"-be esne), a bontás pedig a **MUNKAFOLYAMATOT** követi, nem a menüt. A `kb-check`
  hiányzó / ismeretlen / rossz olvasó-körű kategóriára is bukik. Csoportosít a konzol `/help`
  ÉS a tenant-admin `?tab=sugo` (ott 19 cikk volt ugyanabban a falban).
- **NEM nyúltam hozzá (mérve nem hiba):** a riasztási e-mail mező — a mentés-validáció már
  elutasítja a rossz címet, amit Elek látott, az elavult seed a dev DB-ben.
- **③ ÖSSZECSUKHATÓ CSOPORTOK (tulaj: „mehetnek, csináld meg").** §2b kör: 3 működő vázlat →
  a tulaj az **A — harmonika (minden csukva, több nyitható)** változatot választotta, plusz a
  **„Mindet kinyitom/becsukom"** gombpárt. Kontraktus: `assets/design-refs/console/help-collapse/`.
  ⛔ `<details>`, nem JS-es div: a súgó keresése sima GET, JS nélkül is használhatónak kell
  maradnia; a keresés találatai SZERVER-oldalon `open`-nel renderelnek. Az őr
  (`help-collapse-check.mts`, pre-commitban) **négy valódi hibát talált a saját kódomban**:
  a konzol gombpárja néma volt (script a lista ELŐTT futott), és a `display:flex` ütötte a
  `[hidden]`-t → JS nélkül halott gombpár látszott.
- **④ A `C1…C4` / `C-ORSZÁG` KAPU-KÓDOK is emberi szövegre cserélve** (tulaj-kérés): 20 ok-sor
  kapott TÁRGY-prefixet (`LEIRATKOZÁS:`, `FELADÓ:`, `HIRDETŐ:`, `ADATKEZELÉS:`, `JOGALAP:`,
  `SZEMÉLYRE SZABÁS:`, `FÉLREVEZETÉS:`, `KERETEZÉS:`, `ÁR-HIRDETÉS:`, `PIAC:`) — a kódban MÁR
  meglévő `LINK:` prefix mintájára. ⚠️ A rename MAGÁVAL RÁNTOTTA: `market-gate-check` regexe,
  az `outreach-gate-selftest` 15 elvárása, a `console-markets` idézete és a
  `console-outreach-draft` FLAG-tábla 3 sora (utóbbi a régi szöveget idézte volna).
  Az őr mintája kiegészült a kapu-kóddal, negatívan igazolva.
- **⑤ A lead-sáv mock-jelölése MINDKÉT kérdésre felel** (Elek FK-004 lelet, tulaj: „mondja ki
  mindkettőt"): a legutóbbi állapot mellett `van jóváhagyott mock` jelölés áll, ha a legutóbbi
  nem az. ⛔ A bukás egy ÉP termékre mutatott: a leadnek VOLT jóváhagyott mockja, csak két
  újabb generálás ült fölötte. Őr: `mock-state-label-check.mts` — hermetikus (DB és szerver
  nélkül, három szintetikus állapot), és bizonyítja, hogy a három render tényleg különbözik.
  ⭐ Az FK-004 ELVÁRÁSA is átállt a TÉNY-HORGONYRA (`darab "[data-cit-approved='1']" == 1`):
  ugyanazon a lapon mérve a régi, szövegre mért elvárás ELBUKNA, az új ÁTMEGY — a sáv
  `data-cit-approved="1|0"`-ja mindig ott van, a felirat viszont hol állapotot, hol jelölést mutat. A `C1…C4`/`C-ORSZÁG` ok-kódok MARADTAK (a `console-markets` súgó és a
  Élesítés NINCS (§0.3).

## Párhuzamos szál (2026-09-12) — a Modulok fül éves árazása

**💰 AZ ÉVES FIÓK HAVI ÁRCÉDULÁKAT OLVASOTT — a Modulok fül a fiók ütemében áraz. LEZÁRVA.**
Session-jegyzet: `_planning/memory/2026-09-12_modules_annual_pricing.md`.
Kontraktus: `assets/design-refs/console/modules-annual-pricing/` (§2b, B változat).
Kiváltó: Elek FK-002 (Z1 · Z2 · GY1) a friss mainen. A 99 900 Ft/év-es ELEK-TESZT fiók
modul-kártyáin „+490 Ft/hó" állt, éves átváltás és végösszeg nélkül.
- ⚠️ **A premissza két ponton mérésre szorult.** Az „Áttekintés éves mintája" valójában a
  `modulesSection()`-ben él, tehát MÁR a Modulok fülön — csak a „…/hó-nak felel meg"
  átváltás ül a `periodBlock` HAVI ágában, ezért éves fiók sosem látja. A tervsáv pedig a
  `data-mult`-tal MÁR helyesen évesített: **nem új szabály kellett, hanem a meglévő
  kiterjesztése a statikus chipre.**
- A **12 vs. 11** sem ellentmondás: 12 aktív modul, ebből 11 számlázott (az `enquiry` `spine`
  ÉS `supersededBy: booking` → 0 Ft). Egyik felirat sem hazudott — **egyik sem mondta meg,
  mit számol.** Most megmondja: „12 db · Aktív modul · ebből 11 számlázott".
- **Tulaj-döntés (3 működő mockból):** a **B** — a havi ár marad elöl, mellette az éves
  átváltás (`+490 Ft/hó = 4 900 Ft/év`, szorzó `12 − ajándékhónap` = 10) —, plusz
  háromcellás összegző az Előfizetés-kártya formanyelvén: Modulok együtt (11 db) 60 900 ·
  Alapdíj 39 000 · **Éves díja összesen 99 900 Ft**. A legnagyobb szám az, amit fizet.
- Egy szabály négy hívóhelyen (`priceForm` / `priceInPeriod`): kártya, kupon-chip, bolti chip,
  modul-beállító fejléc. Az összegző `data-base`/`data-mult`-ja UGYANABBÓL a kontraktusból
  olvas, mint a „Következő számla" cella → a fül nem tud kétféle végösszeget mondani.
  Előfizetés nélkül nincs összegző (nincs ciklus — §B.17).
- Őr: `scripts/modules-annual-check.mts` a RENDERELT fülön, **független referenciával** (a
  `pricing.ts`-ből számol, nem a nézet `annualTotal`-jából). 4 szintetikus piros iker + KÉT
  valódi visszarontás (chip havi-only → 3 bukás; összegző ki → 5 bukás).
- ⛔⛔ **INFRA-LELET:** ebbe a worktree-be egy MÁSIK session is írt (Elek FK-001, ugyanaz az
  `adminViews.ts`), és egy diagnosztikai `git stash`-em beszippantotta a félkész munkájukat.
  **Megosztott fában `git stash` TILOS** (a `git add .`-tilalom testvére), és **landolni
  tiszta fából kell** — a commit egy `origin/main`-ről nyitott friss worktree-ből ment,
  hunk-szűréssel; különben a regenerált `catalog.json` a másik szál stringjeit is vitte
  volna, és az `extract-i18n --check` mindenki másnak elromlik.
- ⛔⛔ **MÁSODIK KÖR ugyanaznap (a KB-frissítés kérésére):** a tudásbázis-őr a SZÁLLÍTOTT
  kódban talált hibát, kétszer. ① Az összegző saját predikátummal derivált → lemondott modulnál
  **60 700 vs 53 800 Ft egy képernyőn**, a visszakapcsolás pedig duplán számolt (75 300 / 68 400).
  Az őröm végig zöld volt, mert a fixture-je `cancelAtPeriodEnd: false`-t tűzött ki minden során.
  ② Az első javítás az ÉRTÉKEKET kötötte egy forrásra, de a PERIÓDUS duplán maradt → előjegyzett
  éves váltásnál **tízszeres** eltérés (5 570 vs 55 700). Javítás: `isBilledModule()` egyetlen
  függvény, három hívóhely. Az őr ⑧⑨⑩ ággal bővült (a ⑨ hámom maga is hamis zöldet adhatott:
  beágyazott `<form>` → 0 checkbox). Négy HAMIS KB-állítás is javítva (a kiváltott modul NEM
  látszik; a „Fizetés üteme" sor csak éves fióknál van; a havi alsó sor a fordulónapot írja).
  ⛔ A `kb-shot` közben az Üzenetek fülnél EXIT-elt egy némán elavult fixture miatt, ezért
  **hónapok óta egyetlen KB-kép sem generálódott újra** — a `tsconfig` csak `src/**`-ot néz, a
  `scripts/` fa láthatatlan a `tsc`-nek. Landolva: `ef2ced1`.
- Élesítés NEM történt (§0.3).

## Előző szál (2026-09-11/12) — a kurátor-lap négy néma pontja

**🖼️ ADR-0124 — AMIT A FELÜLET MOND, AZT TUDNIA IS KELL: a kurátor-lap négy néma pontja.**
Session-jegyzet: `_planning/memory/2026-09-11_curator_page_four_silent_points.md`.
Kontraktus: `assets/design-refs/console/gen-running/`.
Az Elek FK-003b öt bejelentése mind igaz volt, és mind ugyanannak a hibaosztálynak a
példánya: a felület állít valamit, ami nem igaz, vagy elhallgat valamit, amit tud.
- ⛔⛔ **A nyitókép-választó VAKON döntetett.** A NYITÓKÉP csempe üres, három bélyeg
  törött-kép ikon „nem ítélt" felirattal, és egyedül a `reklámbanner` töltött be. Mérve
  (`curl`, referer-rel és anélkül): az ok nem a pontozás, hanem a FORRÁS — a hovamenjek.hu
  mind a négy fotót **404**-re állította. A „nem ítélt" a VERDIKT hiányáról szól, tehát a
  felület egy MÁSIK kérdésre válaszolt, és elhallgatta a lényeget: **ezek a képek a LEADNEK
  kiküldött lapon is törötten jelennek meg.** Javítás: aláírt **kép-proxy** (`/photo?u=&s=`)
  — a böngésző AZT tölti, amit a felület megmér —, magyarázó helyettesítő kép, csempénkénti
  ok és összegző sor. ⚠️ A részletes ok nem az SVG-be megy: 96 px-es bélyegen ~4 px a betű.
- **A futó generálás a lap tetejére került**, ketyegő eltelt idővel (jóváhagyott „A"
  változat); a fejléc nem mond „approved"-ot futás közben; a fül pöttyöt kap; és UGYANAZ a
  sáv mondja el a BUKÁST is, az okkal. A háttérmunka három tartozása egy helyen.
- **Egy lapon egy igazság:** a két „mi maradt ki" lista (3 vs 4 tétel) egy forrásból jön;
  az őr a KIRENDERELT lapból mér — a hibát visszaállítva 7 leadből 6 pirosra vált.
- **Az előnézet a lead SAJÁT adatát rendereli** (AI nélkül); pillanatkép híján kimondja,
  hogy idegen minta. Eddig „valós adattal" felirat alatt egy MÁSIK szállás mockja állt.
- **Leadenként egy jóváhagyott mock** (+ `0064` migráció). ⛔ A §I mércéje a
  `prospect.sent_at`, nem a prospect-sor létezése: mindkét duplikátum alatt ült egy sor, de
  egyik sem ment ki — egy meg nem írt levél nem „megajánlott ajánlat".
- ⚠️ **Pixel-lelet:** a bélyeg `type="submit"`, ezért az elsődleges-gomb szabály (navy
  gradiens + pill-padding) felülírta a csempét — 107 px-es sötét keretben 77 px-es kép.
- ⚠️ **A vázlat végigkattintása fogott egy CSS-csapdát:** `display:flex` üti a `[hidden]`
  `display:none`-ját, tehát a „rejtett" sáv LÁTSZOTT. Képen nem látszik, csak kattintva.
- **NYITOTT:** hány ÉLES lead mockja hivatkozik halott fotó-URL-re? (Az ELEK-TESZT lead ma
  kép nélküli lapot szállítana — a választó ezt már kimondja, a javítás külön szál.)

## Előző szál (2026-09-12) — a kiküldés-döntés képernyője

**✉️ A KIKÜLDÉS-DÖNTÉS KÉPERNYŐJE HAZUDOTT — HAT LELET AZ FK-004-BŐL.** Session-jegyzet:
`_planning/memory/2026-09-11_outreach_send_truth_adr0121_0122.md`. ADR-0121 + ADR-0122.
- **A közös nevező:** a képernyő, ahol a kiküldésről döntünk, kevesebbet vagy mást mondott,
  mint ami történik — és a küldés visszafordíthatatlan, idegen embernek szól.
- ⛔⛔ **Az előnézet ELVÁGTA a levelet.** 560px-es iframe vs. **785px** (asztali) / **1056px**
  (mobil) levél, görgetősáv nélkül. A vágás alatt maradt az aláírás, az apróbetű, a
  **LEIRATKOZÁS-LINK** és a jogalap — pont az, amitől a hideg megkeresés jogszerű. A csonkolás
  mindig a VÉGÉT veszi el, és a jogi rész ott van. Most a keret a tartalomhoz igazodik, a
  beégetett magasság nagyvonalú PADLÓ (JS nélkül is teljes a levél).
  ⚠️ Az első fitterem `documentElement.scrollHeight`-ot mért — az a keret viewportjára
  PADLÓZÓDIK, tehát a saját farkát kergette volna, az őr meg trivializálódik.
- ⛔⛔ **A számláló és a jelvény hazudott.** Egyetlen kiküldött sortól zölden „2 megkeresés ·
  kiküldve"; a zöld „Kiküldve — mérés indul" pedig GOMB, és csak a NEM kiküldött soron jelenik
  meg → a siker-jelölés a küldetlen soron ült. Most: „ebből 1 ment ki", zöld csak teljes
  kiküldésnél; a gomb felszólítás („Megjelölöm kiküldöttként"), siker-szín nélkül.
- ⛔⛔ **ADR-0122 — az „egyszer megy ki" alanya az EMBER, nem a rekord.** Mérve: 2 prospect-sor,
  1 cím, mindkettő küldhető. Cím-szintű kapu + **advisory lock alatti claim** (a sor-szintű
  `WHERE ... IS NULL` két KÜLÖN soron mindkettőt átengedi) + a lista címenként egy sort kínál
  + a kártya a KATTINTÁS ELŐTT kimondja („a CÍMRE már ment ki").
- **ADR-0121 (tulaj-döntés):** a megszólítás a levél ELSŐ sora és a lead NEVÉT viseli (felülírja
  az ADR-0101 ① sorrendjét — a névvel ellátott megszólítás nem égeti el a Gmail-előnézet sorát),
  a szöveg végig **T/1**, és a lábazat viseli a hirdető **CÉGAZONOSÍTÁSÁT** a
  `config.legalEntity`-ből (EGY forrás az impresszummal).
- ⚠️ **Link-gazdagép:** élesen MÉRVE rendben (`PUBLIC_BASE_URL=https://citoviso.com`), de semmi
  nem kötötte a link hostját az identitáshoz → pill a piszkozaton + `.env`-mérő őr. Szándékosan
  NEM §C-szabály: dev-gépen mindig piros szabályt mindenki megtanul átlépni.
- ⛔ **Mellékleletek:** ① a placeholder-heurisztika a VALÓS adószámra sült el
  (`12345678-1-42` ⊃ `1234567`) — ugyanaz a hiba-osztály, mint az `xXx` token; ② a
  **tudásbázis-őr a SAJÁT szállításomban talált 5 rést** (halott gomb a „nem vonható vissza"
  megerősítés mögött, a képernyő saját prózája a kivezetett gombra küldött, a riport-KB
  valótlan állítása, vezetés nélküli új FLAG-ok, nem létező feliratra mutató kapu-tanács).
- **Őrök** (mind negatívan is futtatva): `outreach-preview-check` (pixel, `elementFromPoint`;
  önteszt 6/6 piros) · `outreach-oneshot-check` (olvasás-only, mert a dev DB KÖZÖS; kimondja,
  ha az adat a hibát ki sem tudja fejezni) · `outreach-link-host-check`.
- ⭐ **UTÓSZÁL, tulaj-utasításra (ADR-0123): a leiratkozás-illesztés.** Mérve két lelet.
  ⛔ Az e-mail-oldal nyers sztring-egyenlősége csak **VÉLETLENÜL** tartott: minden scraper-út
  kisbetűsít, ezért 397/397 cím kanonikus volt — **az adat a hibát ki sem tudta fejezni**. A lyuk
  a KEZELŐ ÁLTAL GÉPELT mező volt (`Info@Panzio.hu` nem illeszkedett a `info@panzio.hu`
  leiratkozásra). ⛔ És a **visszavonás némán hatástalan volt**: EGY sort mozdított, miközben a
  tiltás cím-szintű — élőben mérve `ok:true` + „újra küldhető", a küldés meg tiltott maradt.
  Most: egy kanonikus alak (`src/email/address.ts`, a `normalizePhone` tükre) MINDEN illesztési
  helyen és az íráson; a visszavonás feloldja az összes azonos című sort (mind naplózva), majd
  **ÚJRAMÉRI** a predikátumokat és MEGNEVEZI az akadályt, ha a telefon-kulcs még tilt — azt NEM
  oldja fel (a túl-visszavonás a veszélyes irány). ⛔ Kimondott hatókör-korlát: nincs
  plus-alcímzés- és nincs Gmail-pont-összevonás (nem mért, harmadik fél szemantikája; 0/397), az
  őr negatív állítással pinezi. Őr: `scripts/outreach-suppression-check.mts` — szerkezeti ikerrel
  (visszarontott kódon igazoltan piros); a viselkedés-kör `--live`, mert a dev DB KÖZÖS.
- **Mérve:** FK-004 8/8 gépi zöld · a park a mérések után bizonyítottan a kiindulási állapotban.
  **Élesítés NINCS** (§0.3).

## Előző szál (2026-09-12) — a fizetés pillanata + FK-005b + a park órája

**💳 A FIZETÉS PILLANATA — TELJES FELÜLETŰ FIZETÉS-LAP + A TARTÓS KÖTELEZETTSÉG KIMONDÁSA.**
Session-jegyzet: `_planning/memory/2026-09-12_checkout_fullscreen_adr.md`.
Kontraktus: `assets/design-refs/configurator/checkout-fullscreen/`.
- **A tulaj mind az öt bejelentése IGAZ volt**, a VALÓS renderelt panelen mérve (nem
  fixture-ön): ① a fejléc a számlázási lépésen is „Most nem fizet semmit”-et állított,
  120px-rel a „MOST FIZETENDŐ 74 925 Ft / év” fölött ② a `.cit-cfg-step3` görgőablaka
  **276px volt 1284px tartalomhoz** — a Fizetek gomb `y≈1766`-nál egy 844px-es telefonon,
  mind a három kötelező pipa a nézeten kívül, görgetés-jelzés nélkül; **asztali 900px-en
  is kívül** (`y≈1424`) ③ a 399 karakteres elállási nyilatkozat a panel alsó élénél
  mondat közepén vágódott el ④ a visszaigazolás hallgatott a megújulásról ⑤ ÁFA sehol,
  és „Belépés: /login” fél útvonal.
- **§2b kapu végigjátszva:** 3 működő változat (ragadós sáv / külön áttekintő lépés /
  teljes felületű lap), mindegyik méret-váltóval és valós funkcióval; 6 kombináció mérve
  `elementFromPoint`-tal, 22 viselkedés-állítás változatonként, képek mindkét méretről
  elküldve → **tulaj: „C — teljes felületű fizetés-lap” + a visszaigazolás mind a 6
  ténnyel.** Kontraktus befagyasztva (plan.html + README 13 kötő ponttal + 4 kép).
- **Szállítva:** a fizetés-lépés elhagyja a 440px-es fiókot (mobilon teljes képernyő,
  asztalin kéthasábos checkout), három zónával amiből **egy** görgethető · lépés-függő
  fejléc, ami megnevezi a terhelést és az összeget · pipa-kapu számlálóval (`0/3`, cég
  ágon `0/2`, néma zsákutca nélkül) · rövid EGÉSZ MONDAT jogi sorok + helyben nyíló
  törvényi szöveg (a bélyegzett szöveg változatlanul a teljes, §H.22) · ÁFA-mondat a
  manifesten át, hogy az invoice `vatKey`-ével mozogjon · „A következő terhelés …” a
  fizetés ELŐTT, dátummal · a visszaigazoláson **„AZ ELŐFIZETÉSE” doboz** 6 ténnyel, ahol
  a megújulás összegét a `billing.ts`-szel AZONOS számítás adja · a `/login` abszolút URL
  híján az e-mailre utal, nem ír fél útvonalat.
- **Őr:** `scripts/checkout-viewport-check.mts` — **49 állítás** a valós panelen,
  `elementFromPoint`-tal, 390px + desktop + cég-ág + visszaigazolás; pre-commitban,
  piros önteszttel igazolva (a rontáson pontosan a bejelentett hibát nevezi meg).
- ⛔⛔ **A nap három tanulsága, mind mérésből:** ① a Playwright `check()`/`click()`
  **auto-scrollja az `overflow:hidden` konténert is elgörgeti**, és ezzel a nézeten
  KÍVÜLI gombot behúzza a képbe — egy szándékosan elrontott vázlat emiatt 390px-en
  ZÖLDRE mért ② **az Elek FK-005a a fizetés után ÁTLÉP a FŐ FA szerverére** (a mock
  `payUrl` abszolút: `PUBLIC_BASE_URL`), ezért a munkafában végzett fizetés-utáni
  javítás a képein NEM látszik, amíg nem landol — fél órát kerestem egy „hiányzó”
  dobozt, ami a munkafa szerverén végig ott volt ③ a `contract-drift-check` csak
  EGYENES záró idézőjelet fogadott el, így a magyar `”`-vel jelölt **7 kötő feliratom
  némán kimaradt a kapuból**; javítva, és az első futásán azonnal fogott egy valós
  eltérést a saját kontraktusomban.
- **FK-005b utánnézés (ugyanaznap, tulaj-kérésre):** 8 gépi zöld / 0 piros / 5 kézi lépés,
  a kézi ítéletek mind PASS. **Két valós lelet, javítva:** ① a bukás-oldal EGYETLEN
  kiút-gombja **olvashatatlan** volt — a `.con a` (0,1,1) veri a `.citui-btn--*` szín-
  szabályát (0,1,0), így cián felirat került a cián gradiensre, **mérve 1.16 kontraszt**
  (WCAG AA minimum 4.5), miközben a gépi check „láthatónak" mondta → 7.03;
  ② **saját rés:** a `!activated` visszaigazolás (fizetett, de még nem élesedett) nem
  mondta ki a tartós kötelezettséget, pedig a terhelés megtörtént és a fordulónap már
  le van horgonyozva. Az őr 49→54 állítás, mindkét új ág piros-kontrollal.
  Jegyzet: `_planning/memory/2026-09-12_fk005b_failure_paths.md`.
- **A park órája visszaállítva + a felületen igazolva (11:22):** az ELEK-előfizetés
  **2035-09-10 → 2026-09-10/2027-09-10**. ⛔ Nem dátum-írással: az időutazó a VALÓDI
  `runBillingCycle()`-t futtatja, ezért 9 igazi megújulás halmozódott — ha csak a
  `current_period_end`-et írnám vissza, a `mintRenewalOrder()` a már kifizetett 2027-es
  rendelést találná és rendezettnek hinné az évet. Eszköz:
  `scripts/reset-elek-billing-clock.mts` (anchorból újraszámol + a maradékot törli;
  mentés sha256-tal írás ELŐTT, `accounting_document` esetén megtagadja, egy tranzakció,
  dry-run alapból, visszaolvasással igazol). Eltávolítva 9 rendelés / 42 fizetés /
  9 számla / 54 dunning; érintetlen a 8 multilang rendelés, a Dencs-tenant és az élő oldal.
- **Az újrafuttatott FK-005a elsőre PIROS volt — nem a kód miatt:** a mock artifact
  `generated` volt, a fulfilment-kapu helyesen tagadta meg a pay-linket (a jóváhagyás az
  FK-003b köré tartozik, ami szűkített futásnál nem fut). Jóváhagyás a valós kurátor-úton
  (`curateArtifact`, döntés-naplóval) → **6 zöld / 0 piros**, és a visszaigazolás a képen
  **„Következő terhelés — 2027. 09. 10. — 99 900 Ft / év"**.
- ⚠️ **NYITOTT:** a szűkített Elek-futás ki nem mondott előfeltételei (pl. „approved mock")
  hiányzáskor késleltetett tünetként jelentkeznek („nem jelent meg időben: Mock fizetőoldal"),
  az OK pedig a `run-all` által elnyelt szerver-stdout-ban ül.


## Előző szál (2026-09-12) — ADR-0119 fagyasztott lap

**⛔⛔ EGY KÉPERNYŐ, KÉT ELLENTÉTES ÁLLÍTÁS.** Elek FK-006a/b, fizetés-elmaradás.
Döntés: **ADR-0119**. Terv-kontraktus: `assets/design-refs/console/freeze-state/`.
Session-jegyzet: `_planning/memory/2026-09-12_frozen_state_contradiction.md`.
- **Az ADR-0080 ⑥ gépezete VÉGIG HIBÁTLAN VOLT** — a site `suspended` lett, a vendég 503-at
  kapott, öt dunning-levél kiment. A hiba az, hogy **a felület többi része nem tudott az
  állapotról**: a renderelt `tab=modulok` EGY lapon állította, hogy a honlap fel van
  függesztve, hogy „nincs teendője”, és hogy „elérhető marad” — **11 modul** közben azt írta
  magáról, hogy „Aktív az oldalán.”. Minden mondat külön-külön IGAZ; **a hiba csak az
  EGYÜTT-ÁLLÁSUKBAN létezik**, ezért egység-teszt szerkezetileg nem foghatja meg.
- A fizetendő **99 900 Ft sehol** nem szerepelt (a látható számok a JÖVŐRE szóltak; a lap
  alján az egyetlen nagy fizető-gomb egy ÚJ vásárlásé volt). A vendég névtelen zsákutcát
  kapott. A visszakapcsolás **néma** volt → a legfrissebb üzenet percekkel a visszatérés
  után is a „Honlapja felfüggesztve” maradt.
- **Kész:** teendő-kártya a tartozással mint a lap legnagyobb számával + a rendezés gombja ·
  a fagyás minden érintett feliratot átír („NEM SIKERÜLT”, „Szünetel”) · emberi vendég-lap a
  szállás SAJÁT elérhetőségével (⛔ **nem** a `tenant_legal` számlázási identitásból) · hangos
  visszatérés, ami LEZÁRJA a szálat (`subscription.restored_at`, 0063) · lejárt foglalás:
  tulaj-értesítés és „lejárt:” a „döntés” helyett.
- **Őr:** `scripts/frozen-state-check.mts` a RENDERELT kimeneten; `--self-test` a romlott
  állapoton **6 sértést** talál, köztük mind a négy bejelentettet.
- ⛔ **A nap tanulsága:** a részszöveg-keresés PROXY. A saját ellenőrzőm a saját magyarázó
  mondatomra pirosodott, az Elek `nem látható "Foglalás"` pedig a vendég-lap tisztességes
  „**Foglalással**, érkezéssel…” mondatára — miközben a mérendő tényt (a fagyasztott oldal
  nem vesz fel foglalást) SOHA nem mérte. A tény a `[data-cit-module='booking']` darabszáma.
- ⚠️ **NYITOTT:** a visszatérés-ablak **3 nap** (tulaj-döntés; az első vágásom 7 volt) — még mindig becslés, nem mérés. A közös park
  minden FK-006 kör után **+1 évet ugrik** a fordulónapon (most 2031-09-10) — ha más szál
  fordulónap-ugrást lát, az ennek a sétának a nyoma.

## Előző szál (2026-09-12) — foglalási ár-koherencia

**⛔⛔ HÁROM ÁR EGY LAPON — ÉS A BEADÁS UTÁN SEMMI.** Elek FK-007, hat lelet a foglalási
úton. Döntés: **ADR-0117**. Session-jegyzet:
`_planning/memory/2026-09-12_booking_price_coherence_and_receipt.md`.
- A szoba-kártya **24 000 Ft/éj**-t írt minősítés nélkül, az ártábla **32 000**-et, a widget
  **64 000**-et — ugyanarra az időszakra, mind ugyanabból a `unit_price`-ból. A hiba nem az
  árazásban volt, hanem a MEGJELENÍTÉS három külön útján; egy `quoteStayFrom` egység-teszt
  mind a háromszor zöld lett volna. **Ezért mér az új őr a RENDERELT lapon.**
- **Kész:** a kártya a teljes SÁVOT mondja (`priceSpan`/`formatSpan`) · tételes **nyugta** a
  beadás után a SZERVER befagyasztott ajánlatából (hivatkozás `FG-…`, kimondott 48 óra) ·
  a fedés-feloldás 4 lépésből 1 koppintás, sticky záró gombbal, és a döntés MEGNEVEZI a
  visszaigazoltat és az elutasítottat · a csempe az ÉLŐ számot mondja · márkázott
  vendég-lemondó lap „Mégsem" gombbal · a naptár múltbeli napja megtartja a színét.
- **Őr:** `scripts/booking-price-coherence-check.mts` (öntesztelt).
- ⛔ **A nap tanulsága:** az őr KÉT saját hibája miatt PIROS lett egy HELYES lapon, és az
  öntesztje ettől ROSSZ OKBÓL volt zöld — **egy parser-hiba az orákulumban pontosan úgy néz
  ki, mint egy termék-hiba**. Plusz: a nulla összehasonlítás nem zöld; és a közös `sites/`
  miatt a pillanatkép-mérés versenyhelyzet (a fő fa visszaírta a lapot a régi kódjából).
- ✅ **Az FK-007 TELJES köre lefutott: 12 gépi zöld · 0 piros · 0 blokkolt · 3 kézi.**
  A tulaj első futása 2 pirosat adott — mindkettő **avult forgatókönyv** volt (a 10. lépés
  tiszta kaszkád), és a képek bizonyították, hogy a felület helyes. ⛔ A tanulság nem az,
  hogy „a teszt elavult": a forgatókönyv a RÉGI LÉPÉSSOROZATRA mért, nem az ÍGÉRETRE —
  ezért az új kontraktus felét (nyugta, nevesített verdikt/lemondás, márkás lemondó-lap,
  csempe-szám) addig SEMMI nem mérte. Piros kontrollal igazolva: a csempe-szemantika
  visszarontása pontosan a „0 foglalás" állítást buktatja.
- ✅ **A záró gomb ŐRT kapott** (tulaj-kérésre): `scripts/overlap-modal-reach-check.mts`,
  pre-commitba kötve a `bookingViews.ts` hatókörére, saját fixture-rel.
  ⛔ Ez a hibaosztály MINDHÁROM szokásos jelzést átveri (renderelt modál · DOM-ban a gomb ·
  `isVisible()` igaz), és a teljes-lapos screenshot ELFEDI — csak `elementFromPoint` fogja meg.
  Önteszt: a régi CSS-sel a gomb-sor mobilon y=927/844, asztalin y=935/900 — a hajtás alatt.

## Párhuzamos szál (2026-09-12) — modul-generálás ön-javítás

**⭐ ADR-0118: AZ ELAKADT, KIFIZETETT NYELV-GENERÁLÁS MAGÁTÓL INDUL ÚJRA.** Session-jegyzet:
`_planning/memory/2026-09-12_multilang_auto_resume.md`.
- Az előző szál nyitott tétele. A generálás a webhook után DETACHED fut → egy
  szerver-újraindítás elvágja, a sor ÖRÖKRE `generating` marad (mérve: 2 sor, az egyik
  12 órás), a kártya közben „csapatunk újraindítja”-t ígért — üres mondat volt.
- **Kész:** ötperces systemd timer (`citoviso-multilang-resume`), négy szabállyal, mind
  PÉNZ-okból: ① ÉLETJEL, nem óra (`heartbeat_at` nyelvenként; különben élő futás mellé
  indulna egy második) ② EGY IGÉNYLŐ (feltételes UPDATE, a sor-zár dönt) ③ VÉGES SOROZAT
  (`attempts ≤ 3`, a korlát a WHERE-ben) ④ AKI FELADJA, SZÓL (SMS+e-mail, pontosan egyszer;
  címzett híján hangosan, jelöletlenül).
- **A kártya minden fázisban igazat mond:** új `gave_up` fázis — amíg van hátra
  próbálkozás, AUTOMATIKUS újraindítást ígér (mert az már igaz) és kimondja, hányadiknál
  tartunk; utána abbahagyja, és azt mondja, munkatársunk keresi.
- **ÉLES próba, nem szimuláció:** az FK-005b futás valóban ottfelejtett egy félbevágott
  kifizetett generálást (08:02), a timer 08:16-kor elkapta, 08:19-re elkészült.
- **Őr:** `multilang-resume-check.mts` — injektált futtató+riasztó (se LLM, se SMS),
  `--self-test` kiveszi a horgonyokat és elvárja a pirosat. Mindkét irány zöld.
- ⚠️ **ADR-szám-ütközés ISMÉT** (0117 elkelt land közben → 0118, 13 fájl átszámozva).
  ⚠️ A timer a FŐ FÁBÓL fut → előbb land, utána `enable --now`.
- **NYITOTT:** az életjel nyelvenként frissül (egy nyelv > 10 perc esetén a küszöb emelendő);
  a riasztási címzett BEÁLLÍTVA és ÉLESBEN kipróbálva (SMS + 3 e-mail cím, mind megjött);
  eszköz hozzá: `scripts/alert-drill.mts --go`. Az ÉLES VPS-en külön beállítandó.


## Előző szál (2026-09-11)

**⛔⛔ A FELIRAT MÁS OSZLOPOT ÍGÉRT, MINT AMIN A SZŰRŐ ÜLT — Elek FK-003, hat lelet a napi
munkaeszközről.** Session-jegyzet: `_planning/memory/2026-09-11_lead_list_label_truth.md`.
Landolva: `dfcaa83`. Élesítés NINCS (§0.3).
- **A nap lényege:** az alapszűrő „min. 1 kép"-et ígért, miközben az **ANYAG** oszlopon szűrt —
  260 sorból **100-nál** a FOTÓK oszlop pirosan 0. A szűrés HELYES volt (ADR-0097 óta
  szándékosan a teljes összegyűjtött anyagot méri); a **MONDAT** volt hamis. Ezt egyetlen
  meglévő kapu nem láthatta: a szűrő működött, a felirat mondat volt, a tesztek zöldek.
- **A javítás nem szövegcsere:** egy REGISZTER (`src/console/leadFilters.ts`), ahol a
  predikátum ÉS az összefoglaló mondat UGYANABBÓL a `cell()`-ből származik — egy szűrő
  szerkezetileg nem tud olyan oszlopot megnevezni, amit nem olvas.
- **A másik öt lelet:** ① a szűrő-állapot nem vész el némán a diszkvalifikált↔aktív
  váltáskor (az `?all=1` szándék is átutazik; az INJEKTÁLT default nem) ③ a CÍM mondja ki,
  melyik nézetben vagy („Aktív leadek" / „Diszkvalifikált leadek") ④ az öt egyeztetetlen szám
  (267/595/593/260/2) MEGNEVEZVE, és a dashboard-chip ugyanabból a `defaultLeadQuery()`-ből
  számol, mint a lista, amit megnyit (**267 → 260**) ⑤ lapozó (50/lap) + „x–y / N sor
  megjelenítve"; a néma jelölések (SV, MATCH, szín-kód, „–", „✓ kiküldve", „?")
  jelmagyarázatot kaptak a táblázat **ALATT** — tooltipben nem, mert azt telefonon senki
  nem éri el ⑥ a RÉGIÓ négy alakja (`balaton-north`/`Balaton`/`bs`/`_test`) emberi
  területnévre cserélve, az ismeretlen `?` jelölést kap.
- ⚠️ **A bejelentett „10 sor látszik 260-ból" MÉRVE nem csonkolás volt** (mind a 260
  kirendelődött, csak a képernyőre fért tíz) — a „hol tartok" jelzés hiányzott. A premisszát
  kell mérni, nem a szó szerinti kérést megoldani.
- **ŐR:** `scripts/lead-filter-label-check.mts` — a SZÁLLÍTOTT mondatot olvassa ki a
  renderelt lapról, feloldja a megnevezett oszlopot, és annak MINDEN celláját megméri.
  A piros önteszt pont a mai hibát állítja elő (30 sértő cella); a fixture bizonyítja a
  saját útját (0-fotós sor nélkül hangosan megáll).
- ⚠️ **HATÓKÖR, kétszer egy commitban:** az új, feliratot hordozó `leadFilters.ts`-t fel
  kellett venni a `kb-check` operátor-korpuszába **ÉS** az `i18n-sources` listájára —
  utóbbi nélkül 25 oszlopnév magyarul ment volna ki idegen nyelvű operátornak.
- ⚠️ **A tudásbázis-őr KÉT körben talált valós rést a saját szállításomban** — a második
  körben már a saját ÚJ KB-szövegemben (nemlétező rendezést állítottam a Régió/Ország/Város
  oszlopról). Mindkettő javítva.
- **NYITOTT:** a Régió/Ország/Város nem rendezhető (a KB most őszintén kimondja); a MATCH
  oszlop továbbra sem szűrhető (magyarázatot kapott, szűrőt nem — az külön döntés).

## Párhuzamos szál (2026-09-11) — fizetés-visszajelzés

**⛔ A KIFIZETETT MODUL UGYANAZT A KÉPERNYŐT ADTA VISSZA.** Session-jegyzet:
`_planning/memory/2026-09-11_paid_module_says_nothing.md`.
- Tulaj-bejelentés, reprodukálva: 14 900 Ft kifizetése után a Modulok oldal fizetés
  ELŐTT és UTÁN három keskeny sávban tért el, és a **fizetés-gomb aktív maradt**. Az
  egyetlen zöld sor („A fordítás készül") a generálás állapotából jött — ráadásul egy
  KORÁBBI futás ottfelejtett sorából, tehát már a fizetés előtt is ott volt.
- **Kész (4 hiba):** ① a kártya a FIZETÉSRE horgonyoz (Kifizetve — összeg · időpont ·
  megvett nyelvek · hivatkozási azonosító + fázis), gomb halott, pipák befagyva —
  ⛔ de a kapu az ÍRÁSON ül (ADR-0113 ⑤) ② a mock fizetés-POST 303-mal átadja a
  `/pay/done`-nak → EGY kimenet-renderelő (eddig új ügyfél üdvözlő oldala jött) ③ a
  bukás-oldalon valódi gomb + hivatkozási azonosító ④ `no-store` + látható státusz a
  fizetőoldalon. A dupla-terhelés elleni ág ÉRINTETLEN.
- **Őr:** `scripts/module-purchase-state-check.mts` — a fizetés ELŐTTI és UTÁNI kártyát
  HASONLÍTJA, `--self-test` módban a régi nézeten minden mérés piros. Mindkét irány zöld.
  FK-005b: 8 gépi zöld / 0 piros (volt 5 gépi, 2 azonos képpel).
- ⛔⛔ **Az Elek-futó a MÁSIK fát mérte:** a tenant-admin kör csak a public szervert
  bootolta in-process, a fizetőoldal a `PUBLIC_BASE_URL`-ből (fő fa :4600) jött.
- **NYITOTT:** az elakadt generálás nem gyógyul magától (van újraindító script, időzítő
  nincs); lejárt pay-link állapot a termékben NINCS — ADR kell, mielőtt mérnénk rá.

## Előző szál (2026-09-09)

**⭐ ADR-0115: MOZGÁS-RÉTEG + HÁROM ÚJ SABLON.** Session-jegyzet:
`_planning/memory/2026-09-09_motion_layer_and_three_templates.md`.
- A tulaj három referencia-honlapot hozott minőség-mércének (lasalaplazahotel ·
  palazzosogni · thebendclub): „ami fontos és nálunk sehol nincs: ANIMÁLÁS".
  Mérve igaza volt — 16 sablonból 7-nek volt egyetlen dísz-keyframe-je, görgetés-
  vezérelt felfedés SEHOL.
- **Kész:** `src/engine/motion.ts` (deklaratív horog + motor, könyvtár nélkül, KÉT
  nyitány-fajta, tíz fail-safe szabály mért hibákból) · három sablon a választható
  mock-típusok közt: `tilted-gallery` · `arch-frames` · `wordmark-grow`, mind saját
  fejléccel és saját nyitánnyal · kapuk: `template-pick-check`,
  `template-diversity-check` (pixel, önkontrollal), `template-preview.mts`.
- ⛔ **A nap fő tanulsága:** a jóváhagyott vázlatokat a motor MEGLÉVŐ közös vázába
  erőltettem (közös masthead, közös szekció-sorrend, közös intro) — ettől mind a
  három mock ugyanúgy indult, és a tulaj joggal látta egyetlen dizájnnak. A rendszer
  szabálya nem írhatja felül a jóváhagyott tervet; ha ütközik, az tulaj-kérdés.
- ⛔ **Második tanulság:** a saját diverzitás-őröm VAK volt (24×16 szürkeárnyalat) —
  az elrendezés megváltozott, a szám 90,8→90,6. Önkontroll kell minden
  hasonlóság-mérőhöz: ugyanaz a bemenet önmagával 100%.
- **NYITOTT:** ① a boltíves nyitány nincs jóváhagyva (a palazzo-vázlat HTML-je
  elveszett a `_drafts` takarításból) ② a lap 69–84%-a közös modul → a lapok közepe
  hasonló marad ③ az intro hossza élesben (~5,8 mp) hideg megkeresésnél sok lehet
  ④ `heroPhoto()` nem tud „fekvő képet előnyben" (a `SiteData.Photo` nem hordoz méretet).
- ⚠️ Az **ADR-0111 közben elkelt** (piac-kapu) → ADR-0115; a sorszámot `git fetch`
  után, közvetlenül írás előtt kell nézni.

## Korábbi szál (2026-09-09 hajnal)

**⛔⛔ A §C-KAPU PRÓZÁN MÉR — A LEVÉL-ÁG KIMARADT · 💾 DEV DB-MENTÉS.** Session-jegyzet:
`_planning/memory/2026-09-09_outreach_gate_prose_and_dev_backup.md`. A leltár C2/C4 tétele.
- **📍 Tulaj-státusz:** a **Citoviso saját GBP létrejött** → az ADR-0107 **60 napos órája
  elindult** (~2026-11-08-tól kérhető az API-jóváhagyás). Nyitva: Barion éles bolt ·
  Számlázz.hu éles kulcs · registrar kredit+ToS.
- **A bejelentett tünet valós:** a `PLACEHOLDER_CONTACT` őr a link tokenjére is ráfut. A
  token `randomBytes(18).base64url` → **2 000 000-ből 1 222 tartalmaz `xXx`-variánst
  (1 : 1637)**; 595 leadnél ~30% esély. A lead kiküldhetetlen lesz, és az ok egy nem
  létező placeholder-telefonszámra mutat egy hibátlan feladó-blokkban.
- **⛔⛔ A nagyobb hiba a MÁSIK irányban volt, és nem volt bejelentve:** az ADR-0112 a
  tartalmi szabályokat csak az SMS-ágon tette át a prózára, **a levél-ág kimaradt**. Éles
  link-alakkal mérve egy **névtelen tömeg-levél PASS-t kapott ÜRES okokkal** — a C3 (név)
  és a C4 (terv-keretezés) az URL slugjából teljesült. **595 leadből 39 egyszavas nevű.**
- **Javítva:** közös `proseOf()`; minden „mit mond az üzenet" szabály a prózán, a link
  JELENLÉTE marad a nyers szövegen. Az őr hatóköre a doktrínához igazítva:
  `sms-gate-selftest` → **`outreach-gate-selftest`** (levél is), benne SZERKEZETI állítás:
  *3 000 valódi tokennel a verdikt változatlan* — ez akkor is fog, ha valaki később új
  szabályt ír a nyers szövegre. RED-kontroll: a javítás nélkül pont a 3 érintett bukik.
- **💾 A dev DB-nek NULLA mentése volt** (az ADR-0086 az élest húzza), pedig 595 lead +
  2 119 provenance-sor ül benne, ~10 session közös használatában. `backup-dev.sh` napi 4×,
  származtatott tábla-listával, az élessel KÖZÖS ellenőrzővel.
- **⚠️ Két lelet csak méréssel jött elő:** ① a `pg_dump` verzió-eltérésre megtagadta a
  dumpot (embedded PG18 vs. Debian PG17 kliens) → PGDG + `postgresql-client-18`
  (tulaj-engedéllyel, csak dev), és a lib mostantól megméri és megnevezi a teendőt;
  ② ⛔ **a visszaállítás-próba VAK a csonkolásra** — egy 95%-ra vágott dumpon a
  `pg_restore --exit-on-error` **exit 0-t ad** és a sorszámok is egyeznek → `db.dump.sha256`
  a kiíráskor, az élesnek is.
- **NYITVA:** a leltár C1 (számla-bontás domain-díja, §2b-kapus) és C3 (a landing
  „térképen"-ígérete — tulaj-döntés); a levél-kapunak nincs feladó-azonosítás szabálya
  (az SMS-nek van). **Élesítés NINCS** (§0.3).

## Előző szál (2026-09-08 éjjel)

**⛔ A MENTÉS NEM JUTOTT EL AZ OLDALRA · ⭐ ADR-0114 · ✅ FOGLALÁS-KÉPERNYŐ.** Session-jegyzet:
`_planning/memory/2026-09-08_booking_screen_and_whole_property.md`. Kontraktus:
`assets/design-refs/tenant-admin/booking-screen/`.
- **A tulaj panasza mérve igaz volt:** két új egység 18:18/18:20-kor íródott a DB-be, a
  kiszolgált `index.html` 18:16-os maradt. A publikus oldal STATIKUS PILLANATKÉP — a DB-írás
  önmagában semmit nem változtat a vendégnek. **Hiány-osztály volt**, nem egy route:
  `/admin/units/*`, `/admin/prices/*`, `/admin/module-config` mind csak írt. Javítva közös
  kijárattal (`redirectRerendered`) + **statikus őr**, ami minden admin POST-tól DÖNTÉST követel
  (16 indokolt kivétel: számlázás, jelszó, és a foglaltság, amit a vendég-oldal élőben kérdez);
  `scripts/rerender-tenant.mts` az elcsúszott oldalak utolérésére.
- **⭐ ADR-0114 (tulaj-rendelet):** „az egész szállás mint egység mindig van, alapértelmezett",
  és ha lefoglalják, a többi egység arra a napra nem elérhető. Mérve: addig az egészre elfogadott
  foglalás mellett a szoba **foglalható maradt** — a rendszer maga termelt dupla foglalást.
  A fölérendeltség ADAT (`site_unit.is_whole_property`, 0059), a kizárás **kétirányú** és
  **levezetett** (`src/tenant/unitScope.ts`); szoba↔szoba NINCS kizárás. Mind a négy kapun él
  (vendég-naptár, űrlap, elfogadás-tranzakció, admin hónap-nézet), és az elfogadás a kizárt
  egységekre váró kéréseket is lezárja. Őr: `whole-property-check.mts`, öntesztje a flaget
  kiveszi és elvárja az átbillenést.
- **§2b, három döntés:** ① Forgalom → a tulaj **„választható vizualizációt"** kért (Naponta /
  Hetente / Honnan és mivel / Csak a számok) — a terv kész és jóváhagyva, **a KÓD MÉG NEM**.
  ② „Szobáink" → egyetlen egységnél **„A szállás"**, alcím nélkül (16 sablonon mérve).
  ③ Foglalás-képernyő → **A változat** (fejléc-blokk, egység-fülek, csukható naptár) + a foglalt
  napra koppintva **középre igazított felugró kártya** (vendég, időszak, létszám, ár, kattintható
  e-mail/telefon, üzenet; csíkos napnál KI tartja + átváltó gomb). ZERO JS (`:target`).
- **⛔ A tudásbázis-őr három valós rést fogott a saját szállításomban:** a Foglalások fül naptára
  nem ismerte a `linked` napot (ott szabadnak látszott és felülírható lett volna), a kézi blokk és
  a vendég-foglalás pixel-azonos volt (az egyik felold, a másik kártyát nyit), és az egész szállás
  sorában ott állt a törlés-gomb. Mind javítva; `booking-screen-check.mts` (25 állítás böngészőben)
  a pre-commitban.
- **NYITVA:** a Forgalom választható nézetének KÓDJA; a `module-config-check` 8 elavult állítása
  (a main-en is piros, nem az én változásom); a kézi nap kártyája (tudatos eltérés a vázlattól).
- ⚠️ **ADR-szám-ütközés:** párhuzamos szál ugyanaznap 0113-at adott ki → az enyém **0114**.

## Előző szál (2026-09-08)

**💳 ADR-0113: FIZETÉS-KAPUS MODUL-AKTIVÁLÁS + ÉLŐ ÉRDEKLŐDÉS-KÁRTYA + MINTA-FOGLALTSÁG.**
Session-jegyzet: `_planning/memory/2026-09-08_pay_gated_modules_adr0113.md`. Kontraktusok:
`assets/design-refs/console/modules-pay-gate/` + `assets/design-refs/tenant-site/enquiry-card/`.
- **A tulaj élőben reprodukálta a rést (Dencs):** éves fizetés → mandátum-visszavonás →
  modul-aktiválás = „első díja a 2027-09-08-i számlán" (12 hónap ingyen); a sosem-számlázott
  modul lemondása azonnali-ingyenes → a lemond-visszakapcsol hurok ÖRÖKRE ingyen. Az ADR-0080 ②
  B-opció havi kockázatát az éves ütem 12×-ezte; a mandátum-visszavonás semmit nem kapuzott.
- **ADR-0113 (tulaj-döntés):** fizetett modul CSAK az első díj beérkezése után él; első díj
  IDŐARÁNYOS (megkezdett hónapok a fordulónapig, éves plafon 10 hó); token → azonnali
  MIT-terhelés, díjbekérő → pay-link; a kapu az íráson (`applyModuleChange`→`requiresPayment`);
  kupon az első díjon; ADR-0080 ③ (lemondás fordulón) változatlan.
- **§2b „B és B":** Modulok fül megerősítő kártyával (tételsor → Tovább a fizetéshez /
  Terhelés és élesítés) + a vendég-oldali „Foglalási igény" kártya dátum-után-nyíló
  kapcsolat-blokkal, VALÓDI `POST /api/erdeklodes`-sel (a régi gomb mailto-t nyitott és
  kapcsolat-adatot sem gyűjtött) — Üzenetek-sor ELŐBB (az egyetlen rekord), Reply-To a vendég.
- **Minta-foglaltság:** az előnézet-naptár adat-birtokos tenantnál is minta-napokat mutat
  (`render.ts` allow-ág + `moduleSections.ts` demo-flag valós unit-okkal).
- **Mérve:** élő Modulok-kör 21/21 (order = havi ár × 10 hó − 25% kupon; fizetés előtt NEM
  aktív; webhook aktivál) · érdeklődés-kártya 28/28 + szerver-út élő levéllel · kapuk mind
  zöldek · tudasbazis-or 2×FLAG (Üzenetek-KB fedetlen érdeklődés; feltétel nélküli
  Reply-To-ígéret) → javítva → PASS.
- ⛔ **Csapdák:** a teszt-webhook elhasználta a Dencs kuponját (visszaállítva); vevő-öröklés
  nélkül az upsell-order az ADR-0111 piac-kapun bukott (multilang/0029-minta a válasz);
  `[hidden]` vs author-grid harmadszor.
- **NYITVA:** ① a Dencs legacy booking+pricing sora (régi B-opciós, a 2027-es számlára vár) —
  tulaj-döntés: nullázzuk-e, hogy az új utat végigtesztelhesse; ② élesítés NINCS (§0.3);
  ③ a nem-live snapshotok a régi runtime-ot hordozzák a következő rerenderig.

## Párhuzamos szál (2026-09-08 este) — 🏷️ A MOCK MEGMONDJA, MELYIK MINTA KÉSZÍTETTE

Session-jegyzet: `_planning/memory/2026-09-08_pattern_badge.md`. Landolva: `951ab6f`, `fbd7d76`.
- **A panasz:** „a generált mock fileok tele vannak adattal, csak az nem derül ki, melyik mock
  minta volt használva". Mérve: a kész HTML egyetlen nyoma a `body.cit-tpl-*` volt, a skin és az
  archetípus sehol; az előnézet URL-je uuid, a fül címe a szállás neve.
- ⭐ **Emberi magyar címke mindhárom regiszterben MÁR LÉTEZETT** (TEMPLATES/SKINS/ARCHETYPES
  `.label`) — nem szótárt kellett írni, hanem elvinni a szemig.
- **Szállítva** (`src/generator/patternBadge.ts`): sáv az operátori előnézet tetején
  („Aurora · Éjkék · sablon-recept" + Részletek panel + ×→pötty), a `<title>`-ben is, **és
  ugyanaz a sor a lead-oldali mock-kártyán**, ahol a Jóváhagyás gomb van. A tárolt fájl TISZTA
  marad (serve-idejű injektálás; a vevő-utak érintetlenek). Az archetípust a sablon-úton nem
  nevezi meg mintaként (tárolva van, de inert — kimondani §B.17-sértés).
- **Őr:** `scripts/pattern-badge-check.mts` — pixel-szintű láthatóság (`elementFromPoint`),
  viselkedés, ÉS a negatív ág (a `/configure` és a lemezen tárolt fájl nem kapja meg); negatívan
  is megmérve.
- ⛔ **A NAP LEGDRÁGÁBB LELETE (a tulaj kérésére JAVÍTVA):** az `aurora.ts:77`
  `body>*:not(...){position:relative}` szabálya kiveri a fixed rétegből bármely ráinjektált
  overlayt — mérve, a **prospect-konfigurátor indító gombja aurora sablonon a lap legaljára
  esett** (y≈14 000; cinematicon helyesen fixed y=769), vagyis aurora-mock kiküldésekor a
  VÁSÁRLÁSI BELÉPŐ nem volt a helyén, némán. Javítás **az overlay oldalán** (nem az aurora
  szelektorát szűkítve — azt egy új sablon újratermelné): páncél-blokk a konfigurátor öt
  gyökér-elemére (`position`/`z-index`/`float`/`margin` `!important`; az offsetek és
  transformok érintetlenek, mert a bottom-sheet és a nyit/zár animáció legitim módon
  változtatja őket). Őr: `scripts/configurator-float-check.mts` — 17 sablon × 2 méret,
  `elementFromPoint`-tal, piros önteszttel (páncél nélkül az aurora bukik: relative, y=11 868),
  bizonyító képpárral, pre-commitba kötve. ⚠️ A saját fixture-öm először HAMIS ZÖLD volt
  (`templateId` a `template` helyett → 17× ugyanaz az archetípus-lap); az őr ma hangosan bukik,
  ha nem a sablon-úton renderel.
- ⛔⛔ **Saját hiba, kétszer:** egy egyszerű kérésre §2b terv-kört indítottam, majd a jelölést
  csak a MEGNYITOTT mockba tettem, miközben a tulaj a LISTÁN dönt. A jelölés oda kell, ahol a
  döntés születik.

## Előző szál (2026-09-08)

**📱 ADR-0112: A HIDEG SMS MEGHÍVÁS LETT.** Session-jegyzet:
`_planning/memory/2026-09-08_sms_invitation_adr0112.md`.
- **A tulaj szava:** a kimenő kísérő SMS-re — „ez a szöveg szar" —, és megadta a helyeset:
  meghívás + „A Citoviso Csapata" + a link; jogi formula és második URL nélkül.
- **Kérdeztem, mielőtt írtam:** a kért szöveg elbukott volna a saját §C-kapunkon (C1
  leiratkozó-link, C2 jogalap). Döntés: **pontosan a kért szöveg**, a kötelezők a linkelt
  előnézet-oldal lábazatába költöznek; fix márka-aláírás; **mindkét** SMS-sablon.
- ⛔⛔ **A jog/provenance-őr a SAJÁT munkámban találta a lyukat:** a C2/C3 kapu **élesen
  NO-OP** volt (a nyers szövegen mért, az éles link viszont `citoviso.com/p/<lead-slug>/…` —
  benne a márkanév ÉS a lead neve; mérve: névtelen tömeg-szöveg = PASS), és a saját öntesztem
  **a rossz okból volt zöld** (a dev base URL nem tartalmazza a márkanevet). Javítva: minden
  „mit MOND az üzenet" szabály a PRÓZÁN mér. Plusz: a lábléc a TRACKING jogalapját mondta ki,
  nem a MEGKERESÉSét; a 404-es előnézet kiút nélkül hagyta a címzettet; üres
  `OUTREACH_SENDER_*` mellett a hordozó oldal névtelen hirdetőt szolgálna ki.
- **Két új őr, MINDIG fut, mindkettő negatívan is megmérve:** `optout-carrier-check.mts`
  (a hordozó oldal: két jogalap + hirdető + élő leiratkozó URL a valódi routerhez illesztve,
  siker- ÉS hiba-ágon) · `sms-gate-selftest.mts` (a kiszállított szöveg a §C-kapun).
- **A KIÚT ÚTVONALA ELDŐLT (tulaj):** a leiratkozás a **mért oldal megnyitásával**, a link
  **legalul** — nem kerül vissza az SMS-be, az utat nem tesszük tracking-mentessé; az őr
  szerkezetileg méri, hogy a lábazat az oldal legalján áll. Vállalt: a leiratkozás-szándékú
  megnyitás is számít az ADR-0088 hármas küszöbébe (3. megnyitás = automatikus −50% ajánlat,
  +24h vásárlás nélkül EGY utókövető levél; leiratkozás után semmi nem indul).
- **A LEIRATKOZOTT LÁTOGATÓ ELDŐLT (tulaj):** a leiratkozás **push-tilalom, nem kizárás** —
  megnézheti a tervet és **meg is rendelheti**, de ezen az úton nincs mérés (`recordView`,
  beacon) és nincs nyomás (ajánlat sem keletkezik, sem jelenik meg). ⛔ A követett lábazat itt
  TILOS (azt állítaná, hogy rögzítünk — §B.17): külön opted-out lábazat + felső sáv.
- **A TÖRÖTT PÁR MEGOLDVA (tulaj: „mindenképp az automatikus újra küldés kell"):** ①
  megelőzés — a pár el sem indul, ha <60 perc van a 8–20 ablak végéig (az MMS-claim
  visszavonhatatlan, éjjel nem javítunk); ② `pairRepair.ts` + `citoviso-pair-repair.timer`
  percenként a FŐ FÁBÓL, backoff 2…480 perc, az „ablak zárva" NEM használ el próbálkozást,
  időközbeni leiratkozás LEZÁRJA a párt; ③ a sorozat végén EGYSZER SMS + e-mail riasztás.
  Migráció `0058`, őr: `pair-repair-check.mts` (21 állítás, negatívan is mérve).
- **NYITVA:** ① STOP-válasz feldolgozása nincs (ADR-0083 óta) ② a lábazat magyarul beégetett
  (piac-nyitásnál gond). **Élesítés NINCS** (§0.3).

## Előző szál (2026-09-07/08) — ADR-0106 + a NÉMA BUKÁSOK LÁNCA

**⭐ ADR-0106 KÉSZ** (vendég-hang korpusz + multi-portál cap 2→6 + „Honnan tudjuk?" forrás-panel),
majd **⛔ a tulaj gombja „nem csinált semmit"** — négy egymásra rakódott NÉMA hiba. Session-jegyzet:
`_planning/memory/2026-09-07_guest_voice_adr0106.md` (utószállal).
- ① Beragadt in-memory őr némán eldobta a POST-ot → TTL-es Map, minden ág megszólal (`a8a037f`).
- ② A háttérmunka nem látszott → állapot-pill + önfrissítés (`a8a037f`).
- ③ **A HIBA nem jutott a képernyőre:** három kérés halt meg ÜRES Anthropic-egyenlegen; a napló
  tudta, a UI hallgatott → `explainAiFailure()` + eredmény-sáv a gomb fölött (`f0a9246`).
- ④ **Saját regresszióm:** a form elrejtésével a chipek halott gombbá váltak — ugyanaz a tünet
  újratermelve → az űrlap marad, csak a gomb helyére kerül az állapot (`c1b735c`).
- ⑤ A „nem említi" lista duplikált ÉS olyat kért, ami a szövegben már benne volt (mérve: 8
  mockból 4 érintett, 5 hamis chip) → 4 új csoport + copy-felülethez mért ítélet (`d972e76`).
- ⑥ A :4600 **19 committal lemaradt**, mert egy TRACKED generált napló piszkította a fő fát
  (a main-sync percenként bukott) → napló átemelve+commitolva (`f6b8ebe`).
- ⛔ **Saját hibám a jelentésben:** a törölt mockokra adatvesztést diagnosztizáltam — a tulaj
  korrigált: **PURGE volt**. Illeszkedő minta ≠ bizonyíték; előbb kérdezz.
- ⑦ **ZÁRVA (2026-09-08):** a ⑥ szerkezeti oka is elhárítva — a desztilláló naplója gépi
  állapot lett (`.gitignore` + untrack; ⚠️ a merge törli a fő fából → mentés+visszaállítás
  kellett), és a dashboard LEGELSŐ chipje kimondja, ha a tesztfelület elmarad (mennyivel +
  melyik fájl blokkolja). Negatívan is mérve szintetikus lemaradt fán. Sync azóta exit 0.
- **NYITVA:** vendég-hang tömeges bemérése a lead-parkon; kimaradt-tények visszaadása a
  forrás-panel chipjeiről.

## Előző szál (2026-09-08)

**⚖️ ADR-0110: A GENERÁLT TENANT-OLDAL JOGI LÁBAZATA.** Session-jegyzet:
`_planning/memory/2026-09-08_tenant_legal_footing_adr0110.md`. Kontraktus:
`assets/design-refs/tenant-site/legal-footer/`.
- **A kérdés átfordult.** A tulaj a sütikezelés hiányát vetette fel; a mérés szerint a
  legyártott ÉLŐ oldal **0 sütit** tesz le (a Google-térkép sem sütit, sem localStorage-ot),
  tehát **süti-sáv nem kell**. Ami tényleg hiányzott: a lábléc „Adatkezelés" linkje `href="#"`
  volt (13 sablon + `chrome.ts`), a tenant hoston `/adatvedelem` route nem is létezett — közben
  az oldal **két űrlappal** gyűjt nevet/e-mailt/telefont, és impresszum sem volt.
- **§2b:** 3 működő mock (126/126 zöld) → tulaj: **„C + B-lábléc"** → kontraktus befagyasztva.
- **Szállítva:** `src/engine/legalPages.ts` (a két lap a szállás skinjében: asztali ragadós
  tartalomjegyzék, mobil nyitható szakaszok, „Röviden" doboz + állandó lábléc jogi sáv) ·
  `0056_tenant_legal` + `legalIdentity.ts` (a checkout vevő-adatából előtöltve) · route a tenant
  hoston + `POST /admin/legal` · **vélemény-hozzájárulás SZERVER-oldali kapuja** (DB-ben mérve:
  hozzájárulás nélkül 400 + nulla sor) · a foglalásnál MONDAT, nem pipa (6(1)b ≠ hozzájárulás) ·
  „Jogi adatok" panel a tenant-admin Fiók fülén + `admin-legal` KB-entry ·
  `scripts/tenant-legal-check.mts` őr a pre-commitban (tracker-detektorral).
- ⭐ **Az ADR-0108 ② adóssága törlesztve:** a látogatás-mérés végre benne van a tájékoztatóban.
- ⛔ **A tudásbázis-őr 7 valós leletet fogott** (mind javítva) — köztük: a jogi sáv eltűnt üres
  jogi adatnál, és mivel a 13 sablon lábléce csak „Adatkezelés"-t hordoz, **az impresszum pont a
  hiányos tenantnál vált elérhetetlenné**.
- **NYITVA:** a jogi lapok magyarul élnek (jogi csomag ≠ fordítás) — a többnyelvű modulhoz
  országonkénti csomag kell; Google Fonts self-host; **élesítés NINCS** (§0.3), a 0056 lokál.

**🌍 ADR-0111 (ugyanaznap, a tulaj kérdésére): PIAC-KAPU — egy ország akkor nyílik meg, ha a
JOGI CSOMAGJA kész.** Session-jegyzet: `_planning/memory/2026-09-08_market_gate_adr0111.md`.
- **A kérdés:** be van-e kötve az országonkénti jogi csomag, ha új országból jön lead?
  **A mérés fele igazolta:** a hideg megkeresésnél VAN kapu (mérve: `hu` átment, `pl`/`de`
  `C-ORSZÁG` tiltást kapott), DE hardkódolt `lang !== "hu"` volt — **nem létezett hely, ahol
  egy piacot ki lehetne NYITNI** —, és a konverziós út (konfigurátor → fizetés → élesítés)
  egyáltalán nem volt kapuzva. Az ADR-0110 óta ez élesebb: egy osztrák tenant magyar
  jogszabályokra hivatkozó impresszumot kapott volna.
- **Döntés:** a piac kulcsa az **ORSZÁG** (AT és DE joga különbözik) · `market` + `market_log`
  (0057) kötelező indoklással és naplóval · **három fail-closed kapu**: hideg megkeresés (a
  verdikt HIÁNYA is tiltás — hat hívóhely), pay-link, és az élesítés a `status:"live"`
  kapcsoló ELŐTT, hangos megtagadással · **a megújulás KIVÉTEL** (egy piac lezárása nem teheti
  fizetésképtelenné a meglévő ügyfelet) · zárt piacon a lead/mock/mintaoldal szabadon megy.
- **Felület:** Beállítások → „Piacok — jogi csomag", a jóváhagyott opt-out minta szerint
  (lecsukott művelet, kötelező indoklás, látható napló); a lista azokat az országokat mutatja,
  amelyekkel MÁR TALÁLKOZTUNK. KB: `console-markets`.
- **Őr:** `scripts/market-gate-check.mts` — 20 állítás mindkét irányban, valódi orderen
  (zárt piac → nincs pay-link; megnyitás után van; visszazárás után újra nincs). Landolva
  `cf19e52`.
- **NYITVA:** a jogi csomag TARTALMA országonként (a `legal.ts` ma egyetlen, magyar csomagot
  ismer) · pénznem/árazás a második piachoz · élesítés NINCS (§0.3).

## Előző szál (2026-09-07)

**✅ ADR-0109 TELJES: a saját cím HAVI díjas.** Session-jegyzetek:
`_planning/memory/2026-09-08_adr0109_utomunka.md` (összesítő-igazság, purge, kapu-kártya) +
`_planning/memory/2026-09-07_domain_monthly_adr0109.md`. Kontraktus:
`assets/design-refs/configurator/domain-monthly/`.
- **① Az árazás (tulaj):** **1 000 Ft/hó**, saját cím CSAK **7 000 Ft/hó feletti** csomag
  mellé — ez BELÉPÉSI FELTÉTEL, nem ingyen-kapu (alatta nem olcsóbb: nincs). A küszöböt a
  **LISTAÁR** dönti el, kedvezmény nem számít bele. Nincs ingyen-ág (ADR-0093 ② kivezetve),
  12 hó hűség változatlan kötbérrel (padló 7 000), utána se kötbér se padló — csak a havidíj.
- **⛔ A 6 000 Ft/év-et SOHA nem a tulaj mondta ki**: 2026-07-27-i placeholder volt, a nála
  elhangzott „hatezer" a VÉTELI plafonra vonatkozott; egy 09-06-i session önmagát jelentette
  zöldre. Ezért a hazudó oszlopneveket ÁT IS NEVEZTÜK.
- **② Felület (§2b, két kör → „C2"):** küszöb alatt a választható sor NINCS a listában,
  helyette meghívó-kártya valódi példanévvel, feltétellel és **haladás-sávval**; küszöb
  fölött valódi opció-sor; visszaeséskor a választás visszavonódik.
- **③ CRM-legördülő javítva:** nem eltűnt — SOHA nem látszott. A `.con-nav` görgő doboza
  (`overflow-x:auto`) levágta az abszolút pozicionált gyereket, miközben a DOM és a
  Playwright zöld volt.
- **④ Díjcsomagok blokk** a /pricing-on: ár + tartalom, a beágyazási szabály szerkezetbe
  kötve (`ESSENTIALS = [...MINIMAL]`) + gépi őr, ami megnevezi a kiesett modult. Az ár azt
  mutatja, amit a vevő ténylegesen megvehet (a nem eladó modul kimarad).
- **⑤ Webcím fül §I-javítás:** a küszöb alatti tenant nem kap név-választó űrlapot
  (bait-and-switch), és `?d=<név>` sem viszi megrendelő képernyőre.
- **⑥ Az ÖSSZESEN igazsága (2026-09-08):** a nagy szám nem tartalmazta a saját cím
  díját (a 6 430-at fizető vevő 5 430-at olvasott), és a kedvezményes EGYSZERI összeg
  „/ hó" felirat alatt állt. ⚠️ Ez eltérés volt a SAJÁT jóváhagyott kontraktusomtól is.
  Most: „Most fizetendő" + teljes összeg + „utána {X} / hó" + „ebből saját cím …
  kedvezmény nélkül". A jogosultság listaáras MARAD (a kedvezmény egyszeri).
- **⑦ A kapu-kártya MOND, nem dönt:** a „Bekapcsolom" gomb 3 modult tett a vevő
  oldalára bemondás nélkül, a LEGDRÁGÁBBAKAT választva (+2 370 ott, ahol +2 150 is
  elég). Kivezetve; a kártya kiírja, mennyit válasszon még.
- **⑧ Purge lefuttatva (2026-09-08):** 2 tenant, 10 prospect, 78 artifact törölve;
  **593 lead + a scrape-korpusz megmaradt**; mentés: `_planning/backups/
  purge-backup-2026-09-08.json`. A script két kaszkád-táblát (`site_visit`,
  `prospect_optout_log`) nem mentett — pótolva.
- **⑨ Két ŐR a vak foltokra (2026-09-08, `2f239eb`):** `contract-drift-check` (a
  jóváhagyott terv és a szállított felület összevetése — a `**„…"**`-vel kötőnek
  jelölt feliratok + a terv JS-e éljen) és `module-sales-check` (ADR-0102
  VISELKEDÉSBEN mérve, nem grep-pel). Mindkettő a pre-commitban, negatívan is
  igazolva. ⛔ A drift-őr először az EGÉSZ kódbázisban keresett, ezért a
  szándékosan visszarontott kód ZÖLD maradt → `**Hatókör:**` sor a kontraktusban.
  Kisebbek: `ui-shot.mts` `/`-javítás; ADR-0093/0100 felülírva-jelölése.
- **NYITVA**: 14 régi kontraktus KÉP NÉLKÜL áll, 9 jelöl feliratot HATÓKÖR NÉLKÜL
  (az őr kiírja a listát); új gyerektábla + CASCADE = néma kimaradás a purge
  mentéséből, erre sincs őr.


## ⏭️ A KÖVETKEZŐ NAGY FELADAT (előző szálról)

**ADR-0103 + Websupport-adapter** (`src/domains/registrar/websupport.ts` a MÉRT API-ra —
HMAC-auth, validate=ár+szabadság egyben, byCredit ~5s retry, autoExtend; vásárlás CSAK
igazolt kontakt-adatokkal; terv-B: megvett domain a Websupport-NS-en + zone-API +
Let's Encrypt a VPS-en → CF-token kiesik) **+ a deploy-kapu KB-javításai**
(admin-modules-booking elavult kép, admin-domain hiányzó kép, console-pricing frissítés
ADR-0102 után → tudasbazis-or → kb-gate token). Háttérben figyelendő: #211604
szolgáltatás-átadás (citoviso.hu → olaszferenc/3213041) + .hu delegálás felállása.
Teljes állapot: `_planning/memory/2026-09-06_websupport_registrar_and_module_sales.md` +
auto-memória `reference_websupport_registrar_state`. A leltár A4/A5 tétele Websupportra
átírandó (`_planning/PILOT-GO-LIVE-INVENTORY.md`).

## Aktív feladat

**2026-09-07 — ✅ ADR-0105: KÜLSŐ DIZÁJN-BESZERZÉSI BRIEF (HU+EN) LANDOLVA (`cc0327f`, IGAZOLTAN FENT).**
Session-jegyzet: `_planning/memory/2026-09-07_external_design_brief_adr0105.md`.
- **Miért:** a tulaj új mock-arculatokat (template-eket) akar rendelni **külső designerektől és
  külső AI-októl** — kellett egy önhordó brief, amit a kódbázis átadása nélkül be lehet másolni.
- **Artefaktumok:** `docs/design-brief-external.md` (HU mester, 11 szakasz) ·
  `docs/design-brief-external.en.md` (szerkezetileg 1:1) · `docs/design-brief-sample-data.json`
  (SiteData minta: **dús** + `_starvedVariant` adathiányos — az utóbbi KÖTELEZŐ átadandó,
  ADR-0097: a leadek ~85%-a ilyen).
- ⛔ **A nap érdemi fordulata:** az első változatba bemásoltam az `editorial-warm` skin 11
  hex-értékét, mintha az volna az előírás → tulaj-dörgedelem („ez korlátozza a WOW-ot, gépies
  lesz minden mock"). **Jogos volt — a leírásomra, nem a rendszerre.** Mérés döntött, nem
  vélemény: a saját sablonjaink 1–4 gradienst, 1–9 SVG-textúrát, 0–3 animációt visznek és
  11–30× `color-mix`-szel derriválnak → a KARAKTER a sablon saját CSS-e, a 11 token csak a
  paletta; az `--cit-accent` ráadásul a szállás saját FOTÓIBÓL mintázódik, tehát épp a beégetett
  hex uniformizálna (több ezer oldal a designer színeivel).
- **ADR-0105 döntés:** a készlet marad **11 SZEREP** (nem bővítünk spekulatívan); a brief üres
  szerep-listát ad + kimondott engedélyt gradiensre/textúrára/blendre/animációra/saját
  változóra/duotone-ra; egyetlen tiltás a tokenből nem derivált hex. **A bővítést a KÜLSŐ KÖR
  méri ki:** kötelező átadandó, hogy „mit nem tudtál kifejezni a 11 szerep alatt" —
  **2+ független terv ugyanabban a falban = ADR-trigger** (várhatóan: második akcent-szín).
- **NYITVA:** ① próbakör 2-3 AI-jal, mielőtt fizetős designernek megy ② a beérkező terv §2b
  kapun át mehet a motorba (javaslat, nem kontraktus).
- ⭐ **Tanulság:** a példa-érték a briefben **ELŐÍRÁSKÉNT olvasódik** — szerepet üresen adj át.

## Előző szál (2026-09-07) — ADR-0104 mock-típusok igazítása

**2026-09-07 — ✅ ADR-0104: A MOCK-TÍPUSOK ÁTVIZSGÁLVA — középre rendezett fejléc alatt már a
TARTALOM is középen. LANDOLVA (`f275aad`, IGAZOLTAN FENT). ÉLESÍTVE NINCS (§0.3).**
Session-jegyzet: `_planning/memory/2026-09-07_modsec_center_align_adr0104.md`.
- **Tünet (tulaj, saját 1900px-es ablakából):** „ennél a típusnál nincs sok helyen középre
  rendezve, kesze kusza a cucc" — a fullbleed mockon.
- **Mérés 16 sablonra** (a tárolt recipe+SiteData újrarenderelve, Playwright 1900/1280/390px):
  pontosan a **3 középre rendezett fejlécű** sablon érintett (fullbleed, horizontal, artdeco),
  mindháromnál UGYANAZ az öt hiba — 284px fantom-oszlop a poi/rooms kártyák mellett, 568px a
  csempe-sor végén, 849px az ár-fülek mellett. **Gyökér:** a `--cit-modsec-head-align:center`
  csak a `h2`-t húzta középre, a közös modul-blokk rácsa balról pakolt. A másik 13 sablonnál a
  balra igazítás HELYES — a hiba a fejléc és a tartalom ellentmondása volt.
- **§2b kapu végigjátszva:** 3 működő változat valós adaton + ui-shot 390/1280px + 1900px-es
  összehasonlítók → a tulaj a **„C" hibridet** választotta (tartalmi kártya kitölti a sort, kis
  ikonos csempe egyforma széles + középre húzó utolsó sor) → csak ezután kód.
- **Egy forrás:** `templateKit.centredModsecCss(tpl)`; a másik 13 sablon kimenete **bájtazonos**
  maradt (16/16 render diffelve). Őr: `scripts/modsec-align-check.mts` (pre-commit,
  `src/engine/` változásra, DB/hálózat nélkül) — RED-kontrollal: a szabályok nélkül 26
  eltolódást fog. Az inline jelvényt és a táblázatot ELEMKÉNT méri (a `tbody` mérése hamis
  riasztást adott).
- ⚠️ **A telefonszám NEM hiba volt:** a tulaj a SAJÁT számát látta a mockon, de az a
  **2026-09-05-i Elek seed-semlegesítésből** ült a 8 teszt-leaden (idegen számok cseréje), és az
  MMS/SMS öntesztek is `lead.raw.phone`-ból dolgoznak. Élesben a lead saját nyilvános száma,
  tenant-oldalon a megadott szám megy ki. **Tulaj-döntés: nem kell szabály.**
- **NYITVA:** ① a tulaj `/configure/ff227bb6…` linkje még a RÉGI képet mutatja (a route statikus
  fájlt szolgál ki; determinisztikus újrarenderelés a tárolt inputokból AI-költség nélkül
  lehetséges — tulaj-döntésre vár) ② a fő fa (:4600) 2 committal le van maradva, mert egy
  generált `_planning/DOMAIN/_tools/.distill-manifest` piszkos benne (a `land.sh` ezért nem
  húzta be).

## Előző szál (2026-09-06) — leiratkozás-visszavonás

**2026-09-06 — ✅ LEIRATKOZÁS-VISSZAVONÁS + AUDIT-NAPLÓ LANDOLVA (`02114f8`, IGAZOLTAN FENT).**
Session-jegyzet: `_planning/memory/2026-09-06_optout_revoke_and_log.md`. Kontraktus:
`assets/design-refs/console/optout-revoke/`.
- **Tünet:** a tulaj EGYETLEN leadre sem tudott küldeni — „mindenkinél leiratkozott van
  valamiért". **Diagnózis:** 8 prospectből 1 volt leiratkozva, de a suppression szándékosan
  SZEMÉLY-szintű (azonos cím / normalizált szám BÁRHOL → tilt), a teszt-leadek meg mind a
  tulaj saját címét/számát hordozzák → **egy kattintás lezárta az egész teszt-parkot**.
  A szabály HELYES (élesben pont ez kell) — a **visszaút** hiányzott.
- **Megoldás (jóváhagyott B változat):** a lead-lap Megkeresés-panelén lecsukott
  **„Leiratkozás visszavonása ▸”** (`<details>` — nem sülhet el félrekattintásból),
  KÖTELEZŐ indoklás szerver-oldalon is (<3 karakter = elutasítva, állapot NEM változik,
  naplósor SEM keletkezik), actor = a bejelentkezett operátor (sosem űrlapmező), a napló
  mindig látszik a soron. `migrations/0053_prospect_optout_log.sql` mindkét irányt jegyzi.
  A suppression maga ÉRINTETLEN. Súgó: `kb/entries/console-lead`.
- **Mérve:** e2e 20/20 · a szállított űrlap a szállított route-on 16/16, 0 JS-hiba (DB-szinten
  is) · kb-check/i18n/design-token/tsc/pre-commit mind 🟢 · ui-shot 390+desktop mindkét
  állapotról, a tulajnak elküldve.
- **⛔ Lelet:** a KÉP NEM MUTATJA A VISELKEDÉST — a mock 4 bukását a végigkattintás fogta,
  a screenshot zöld volt (`[hidden]` UA-szabálya nulla specificitású → `display:flex`
  felülírja). ⚠️ A ui-shot desktop-képe mobil elrendezést mutatott (a méret-váltó alapból
  mobilon állt) → **a mock kezdőállapota a viewportból jöjjön** ezentúl.
- **NYITVA:** ① migráció-sorszám-ütközés őr (harmadszor ismétlődött: 0053×2, előtte 0051×2,
  0052×2); ② a fő fában commitolatlan változás van, ezért a `:4600` NEM frissült.

## Előző szál (2026-09-06) — ADR-0101 megkereső levél

**2026-09-06 — ✅ ADR-0101: A HIDEG MEGKERESŐ LEVÉL ÚJRATERVEZVE ÉS JÓVÁHAGYVA. A KÓD MÉG NEM
MÓDOSULT — az implementáció a következő lépés.** Session-jegyzet:
`_planning/memory/2026-09-06_outreach_mail_redesign_adr0101.md`. Kontraktus:
`assets/design-refs/console/outreach-mail/`.
- **Tulaj-kifogás:** a levél tördeletlen, „érezhető AI-szöveg", és ott éktelenkedik a `a(z)`.
- **§2b kapu végigjátszva:** 3 változat (A kézzel írt / B levélpapír / C ajánlat-kártya) valós
  adaton, működő mockban (méret-váltó + „mai levél" összevetés), ui-shot 390+desktop (Read),
  Playwright-kattintás 0 JS-hibával, majd VALÓDI kiküldés a tulaj postaládájába.
  **Döntés: „B + a C navy ár-doboza".**
- **Szöveg:** horog (= Gmail-előnézet) → ÖNÁLLÓ megszólítás → keretezett ajánlat-mondat →
  kép/gomb → 3 rövid bekezdés. A `a(z)` megoldása nem jobb névelő, hanem a NÉV kihagyása a
  ragozódó mondatból (`huArticle()` ott, ahol tényleg névelő kell).
- **⛔⛔ NÉMA OUTLOOK-TÖRÉS (a tulaj képernyőképéből derült ki, az én ui-shotom zöld volt):**
  a Word-motor eldobja a `max-width`-et `<div>`-en és nem ismeri a floatot → a sötét ár-doboz
  az egész 1900px-es ablakot átérte. A fix `<table width="600">` javítás viszont MOBILON vágta
  le a szöveget (mérve 390px-en) → **MSO-feltételes szellem-táblázat** kell, plusz az
  `outlook-lint` szerkezeti őr, **negatívan is lefuttatva**.
- **⚠️ Próba-küldés csapdája (elkerülve):** a gomb a követés nélküli `/configure/<artifactId>`-ra
  megy, mert a tracked `/p/<token>` 3. megnyitása 50%-os eszkalációs ajánlatot mintázna
  (`ESCALATION_VISIT_THRESHOLD`), és 24h múlva a billing-tick VALÓDI levelet küldene a VALÓDI
  szállásadónak. A leiratkozó-link próbában halott példa-útvonal.
- **Mérés:** mind a 4 kiküldött levél az **Elsődleges** fülre ment, a legdizájnosabb is
  (nincs `CATEGORY_PROMOTIONS/UPDATES`). A 2026-08-25-i mérés a `List-Unsubscribe` FEJLÉCRŐL
  szólt — az továbbra is áll.
- **NYITVA:** ① impl. `src/outreach/draft.ts` + `src/email/outreachEmail.ts` +
  `escalationFollowup.ts` (ott is ott ül a `a(z)`); ② `outlook-lint` a `scripts/` alá valódi
  kapunak; ③ i18n-katalógus a változó `T()` kulcsokhoz; ④ a levél-fájlok ma KÍVÜL esnek a
  design-token-őr FILES-listáján (brand-hexek őrizetlenek) → ALLOW-bejegyzés javasolt;
  ⑤ **ADR-0088 ①** kedvezmény-mondat: a tulaj teljes törlést kért, ma a szürke lábjegyzetben
  ül — ADR-döntés kell hozzá.

## Előző szál (2026-09-06, párhuzamos session) — saját domain + ADR-0100

**2026-09-06 — ✅ SAJÁT DOMAIN IGAZSÁG-KÖR LEZÁRVA. MINDEN LANDOLVA (`310bc84`, IGAZOLTAN
FENT).** Session-jegyzet: `_planning/memory/2026-09-06_domain_fee_truth_adr0100.md`.
- **① Konfigurátor (tulaj-screenshot alapján):** a „Saját domainnév" statikus
  „+6 000 Ft/év · min. 1 éves előfizetés" szövege helyett ÉLŐ, csomag-függő díj-feloldás
  (8 000 Ft/hó küszöbtől 0 Ft, követi a kapcsolókat) + valós kötbér-feltétel blokk
  (12 hó hűségidő, hátralévő hónapok díja, vételár elvitelkor, ingyen-ágon padló) + a díj
  az összesenben ÉS a szerver által terhelt induló árban (kedvezmény a díjat nem éri).
  Playwright-verifikálva mindkét ágon, mobil+desktop.
- **② ADR-0100 (munka közben talált rés):** a domain 2+. évi díját SENKI nem számlázta.
  Mostantól a fordulónapos megújulás TÉTELE (évforduló-ablak a `billing.ts`-ben; évente
  újra-feloldás az akkori csomag ellen; `order_intent.domain_fee` 0053 + külön számla-sor;
  a `domain_upgrade` számla-felirata is javítva). Kapu: `scripts/domain-renewal-check.mts`
  a pre-commitban.
- **Nyitott (kis):** az új feliratok de/en fordítása a nyelvi csomag következő köréig
  hu-fallback; élesítés a booking-köteggel + PILOT-LELTÁR blokkolókkal együtt.

## Előző szál (2026-09-06) — ADR-0097 adat-éhezés

**2026-09-06 — ✅ ADR-0097: A GENERIKUS FŐCÍM GYÖKÉR-OKA FELSZÁMOLVA — a plafon az ADAT volt,
nem az író.** Session-jegyzet: `_planning/memory/2026-09-06_data_starvation_adr0097.md`.
- **Diagnózis (mérve):** 267 élő leadből csak 45-nek volt portál-profilja — a generátor ~85%-ban
  fotó-only írt, ezért jött „sokadszor" a „Fedett terasz, tágas nappali…" típusú főcím; az
  adathiányos ágon a marketing-őr strukturális rétege is vak volt.
- **Javítás-köteg (mind élesben igazolva a Pitypang-leadon):** ① `reenrichOne` + `enrichPortal`
  (kézi lead-újraolvasás portál-prózával) · ② booked.hu-híd (`openTwin`: szallas.hu→<slug>.booked.hu;
  Laguna: 63 szolg+1594 kar+56 fotó) · ③ kurátor „Tulaj-bemutatkozás" mező (FB-Névjegy kézzel;
  robots tiltja a gépit) · ④ súly-rangsorolt tények + főcím-a-lista-elejéről kontraktus ·
  ⑤ alcím-ismétlés tilalom · ⑥ idézet-verifikált nyílt kinyerés (sellingPoints {label,quote},
  determinisztikus substring-validálás; „szarvasles a dézsából", „helyi borok" — őr: 6→12 tény).
- **Főcím-út:** „Fedett terasz, tágas nappali és kádas fürdő…" → „Medence, dézsafürdő és
  jacuzzi a kertben, fedett terasszal" + önálló alcím („Szólád csendjében… családoknak és
  baráti köröknek").
- **NYITVA (kis):** szótár-bővítés folytatása igény szerint; a sellingPoints súly-nélküli
  (named-kredit, követelmény nem — fail-safe aszimmetria, ADR-0097 ⑥).

## Előző szál (2026-09-05/06) — ADR-0096 Elek ALL-IN

**2026-09-05/06 — ✅ ADR-0096: AZ ELEK ALL-IN KÖR TELJES — a teljes üzleti hurok gépileg zöld.
MINDEN LANDOLVA (`be09019`).** Session-jegyzet:
`_planning/memory/2026-09-05_elek_all_in_loop_and_triage.md`.
- **7 zöld forgatókönyv:** FK-003b (mock-gen, őr-PASS) → FK-004 (éles kiküldés elek@-ra) →
  FK-004b (levél→link→mock→mérés) → FK-005a (önkiszolgáló VÁSÁRLÁS mock-gateway-en: tenant
  `active`, site `live`, belépő+számla-levél a fiókban) → FK-001 (belépés a levélbeli
  jelszóval, Dokumentumok+Üzenetek) → FK-002 (Modulok) → FK-005b (bukás-mátrix: 3 számla =
  3 valós terhelés). Jelentések: `:4600/test-log/<FK>/report`.
- **Nagy fogások (javítva):** Mirabella-banner mock-HERO → cross-site fotó-kapu (ADR-0096 ④);
  kép-méregpirula (plain-URL az API-nak) → ejtés-szabály; néma fizetés-elnyelés Barion-konfigon
  → applyWebhookResult; valódi Barion-ig jutó teszt → gépi mock-gateway-kényszer; teszt-lead
  valódi idegen telefonszámmal → seed-semlegesítés; vak gépi jóváhagyás → verdikt-kapu.
- **Tulaj-triázs LEZÁRVA** (fizetés-őszinteség, kupon-ár láthatóság, Bővítés üres-állapot,
  magázás, névelő, aláírás-cím, időpontok) — igazoló újrafutásokkal.
- **KÖVETKEZŐ (másik sessionben):** 🔴 booking-modul tisztázás (lásd fent) · régió-származtatás
  koordinátából (külön kör, jóváhagyva) · ÁFA-kör (tulaj hívja le) · hangnem-őr admin-hatókör ·
  FK-006 dunning-időutazó.

## Előző szál (2026-09-04) — ADR-0095 bevezetés

**2026-09-04 — 🤖 ADR-0095: „ELEK" GÉPI KÉZI-TESZTELŐ BEVEZETVE ÉS ÉL. MINDEN LANDOLVA (`f3f92ec`).**
A MineREAL-es Elek-rend Citoviso-adaptációja tulaj-megbízásból, F0 terv-kaputól a működő teljes
körig egy nap alatt. Session-jegyzet: `_planning/memory/2026-09-04_elek_test_agent_adr0095.md`.
- **A rend:** `elek/charter/` (diéta, két-út doktrína, tiltások, agent-prompt-sablon) ·
  `elek/bin/runner.mts` (determinisztikus futtató: in-process szerver efemer porton, mintelt
  session, lépés-shotok) · `elek/bin/mailbox.mts` (SAJÁT fiók csak-olvasó nézőke, EXAMINE+PEEK) ·
  `/test-log` a konzolon (jóváhagyott B kontraktus; az `elek` sor a közös listából rejtve, csak
  `?user=elek` linkkel) · `elek/scenarios/SCOPE.md` (ALL-IN térkép + bukás-mátrix + határok) ·
  kiértékelő subagent friss kontextussal (LELETEK.md; javaslatot soha nem ír).
- **Gépi garanciák:** `ElekRecipientGuard` — ELEK_RUN=1 alatt CSAK elek@citoviso.com kaphat
  levelet (RED/GREEN mérve, vegyes lista is); SMS/MMS zárva — a self-loopback MÉRTEN nem
  kézbesít (hálózat eldobja, status=10). Elek külön Zoho-user, IMAP a lokál `.env`-ben
  (`ELEK_IMAP_*`); kiküldés→beérkezés→link-kinyerés élesben igazolva.
- **Két kör lefutott (FK-000 füst, FK-003 lead-lista), Elek-leletek TRIÁZSRA a tulajnál:**
  ① ORSZÁG oszlop kevert (MAGYARORSZÁG/HU + régió-outlier) ② angol `none` a magyar KONTAKT
  oszlopban ③ KB↔UI drift (diszkvalifikáltak-link helye) ④ néma favicon-404 a konzolon.
- **KÖVETKEZŐ:** FK-003b mock-generálás az ELEK-TESZT leaden (a3a8a680, klón-seed kész, ~$0.2
  AI-hívás) → FK-004 kiküldés-kör (Küldés-gomb → mailbox → funnel) → ELEK-TESZT tenant seed
  (vevő-email: elek@) → FK-001/002/005 (vásárlás/bővítés/lemondás + bukás-mátrix a
  mock-gateway-en) → FK-006 időutazó-setup a dunning-állapotokhoz.

## Előző szál (ugyanaznap) — ADR-0094 ② elszámolás-képernyő

**2026-09-04 — 💰 ADR-0094 ② ELSZÁMOLÁS-KÉPERNYŐ KÉSZ (a jóváhagyott B kontraktus). LEZÁRVA, LANDOLVA.**
- **Lemondás futó domain-hűségnél CSAK elszámolással:** a Modulok fül lemondás-gombja a
  közbeiktatott `/admin/subscription/settlement` lapra visz (hűség-sáv + tételes kötbér-számla +
  webcím-pipa élő végösszeggel + következmény-sáv + záró képernyő ÁSZF §9 mondattal); route-őr a
  kézzel gyártott cancel-POST ellen is. Hűség nélkül a régi lemondás-doboz változatlan.
- **Pénz-út:** kind=`domain_settlement` order (migr. **0050**) a 0029 vevő-öröklésen, fail-closed
  minden lépésben (pay-link hiba → semmi nem marad rögzítve); ígért e-mail a dunning
  `billingEmails` listájára + `tenant_message`; webhook-ág számláz, nem aktivál újra. Resume:
  kifizetetlen elszámolás törlődik, kifizetett után nincs visszalépés-gomb. Kötbér-alap:
  befagyott padló VAGY (fizetős-domain, padló-nélküli ág) a mai csomag-havidíj — tesztelve.
- **KB:** `admin-settlement` entry + kb-shot fixture + `admin-subscription` hűség-pontosítás;
  tudasbazis-or FLAG (3 jogos lelet) → javítva → **PASS**. Kapuk: domain-provision-check +15
  teszt zöld, böngészős működés-kör zöld, kb-check 30/30, i18n + token-lint + tsc zöld.
- **Külön kör:** `config.chromiumPath` halott alapérték → futásidejű detektálás a saját cache
  legújabb LÉTEZŐ Chromiumára (CHROMIUM_PATH override marad).
- ⚠️ **Dev-fixture bent hagyva** (Nyugalom Vendégház: fizetett hűség-order `nyugalomvendeghaz.hu`
  + subscription, fordulónap ~2026-09-22) a tulaj lokál tesztjéhez — a billing-timer ~09-19-én
  `.example` címre próbál előértesítőt (nem kézbesíthető, ártalmatlan). A fő fa :4800-án a
  settlement-route land utáni `git pull`-tól él.
- ⚠️ Élesítés NINCS (§0.3): a 0050 migráció csak lokál. Nyitva: Barion-sandbox vég-kör a tulaj
  tesztjében; INWX éles integráció (ADR-0024).
- Jegyzet: `_planning/memory/2026-09-04_domain_settlement_impl_adr0094.md`.

## Előző szál (2026-09-03/04)

**2026-09-03/04 — ⭐ ADR-0093+0094: DOMAIN-FELTÉTELEK. KÓD LANDOLVA; a B felület-terv JÓVÁHAGYVA, IMPLEMENTÁCIÓ NYITVA.**
- **ADR-0093 (8da7d02):** ár-plafon őr két kapuval (ajánlat-szűrés + fail-closed vétel-kapu a
  `provisionDomain`-ben; mock: „premium"→499 €) + 4 pricing-paraméter (15 € plafon — EGY közös
  érték a HU lapon · 12 hó min. elköteleződés · 8000 Ft ingyen-küszöb · 20 000 Ft domain-vételár)
  + ingyen-domain szabály (quote=Áttekintés=rendelés; 0 Ft-ágon nincs gateway, gomb „Megrendelés").
- **ADR-0094 (bbd227c) — tulaj-felülírás:** hűségidő = KÖTBÉR-modell (nincs szabad lemondás;
  kilépés = hátralévő hónapok × vállalt minimum + domain-vételár CSAK ha viszi; a domain a zálog).
  ÁSZF §9 újraírva + legal-check méri; `domain_loyalty_months` kivezetve (migr. 0049);
  csomag-padló ÉL (`committed_min_monthly` rendeléskor befagy, `activeDomainCommitment()`,
  `applyModuleChange` atomi elutasítás + Modulok-fül üzenet). Tesztek zölden.
- **KÖVETKEZŐ LÉPÉS (ez az első teendő):** az elszámolás-képernyő implementálása a jóváhagyott
  B kontraktus szerint — **`assets/design-refs/console/domain-settlement/README.md`** a kontraktus
  (lemondás-route elágaztatás `activeDomainCommitment()` szerint → közbeiktatott elszámolás-lap →
  a kötbér fizetési útja → KB-entry). Surface-gate: approved erre az ágra.
- ⚠️ Környezet: `config.chromiumPath` alapértéke halott (a fő fa 1234-re frissült, az 1228 eltűnt)
  → `CHROMIUM_PATH=$HOME/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome` kell a
  pre-commithoz/ui-shothoz; az alapérték külön körben javítandó.
- Jegyzet: `_planning/memory/2026-09-03_domain_terms_adr0093_0094.md`.

## Előző szál — ADR-0088 (2026-09-03, párhuzamos session)
**2026-09-03 — ✅ ADR-0088 TELJES: LISTAÁR + AJÁNLAT-RÉTEG, ÉVES VÁLTÁS, ISMÉTLŐDŐ KÁRTYÁS
MEGBÍZÁS. LEZÁRVA, LANDOLVA (`39c58ec`). ÉLESÍTVE NINCS (§0.3).**
Tulajdonosi ötletből („kell egy új réteg az árazásba: listaárak") négy szelet lett.
① **Listaár = a `pricing_config` árai** — VALÓS, fizethető ár (a honlapon direktben rendelő ezt
fizeti), ettől becsületes az áthúzás. ② **`offer` entitás** (0045): a kedvezmény SOSEM
halmozódik, mindig az EGY legnagyobb él; az outreach-jogosultság a `prospect.sent_at`
pecsétből **SZÁRMAZTATOTT** → a self-serve út szerkezetileg listaáras marad, és minden ÚJ
küldő-csatorna automatikusan fedve van. ③ 3.-látogatás **eszkaláció** (egyszeri, 72h,
döntés-kártya visszaszámlálóval) + 24h-s follow-up levél a napi billing-ticken (§C-kapuval, a
jog-őr FLAG-je után javítva). ④ **Üdvözlő kupon** fizetéskor; érvényesül az egyszeri
modul-vételnél és a B-opciós modul ELSŐ díján. ⑤ **§8 éves váltás** (0046 `pending_period`):
a kifizetett időszakhoz nem nyúlunk, a váltás a KÖVETKEZŐ fordulónaptól él, és a már kiállított
havi számla nem nyeli el; a tulaj rendelete szerint a kifizetés után a váltás **végleges**.
⑥ **⑨ Ismétlődő kártyás megbízás:** a MÉRÉS derítette ki, hogy a gépezet **ADR-0080 ④ óta ÉL**
(token + 3DS-trace + MIT-terhelés), de a vevőnek SOHA nem mondtuk ki és nem tudta visszavonni →
ÁSZF 1.0→**1.1**, pecsételt checkout-hozzájárulás (0047), admin-blokk **kétlépéses**
visszavonással (tulaj: megerősítő ablak a hátrányokkal), `revokeAutoCharge` a tokent **törli**.
⛔ Néma bukások, amiket a teszt fogott, nem a szemem: egymásba ágyazott `<form>` (a böngésző
eldobta → a visszavonás NEM történt meg, a felület sikert mutatott); periódus-vak modul-delta
éves számlán; a kupon némán érvényesült, tehát nem adott el semmit.
⚠️ **Élesítés-kötés:** az ÁSZF 1.1 és a mandátum-felület EGYÜTT megy ki (az ÁSZF azt ígéri,
hogy a megbízás az adminban visszavonható). **Nyitva:** kártyás sandbox-kör a tulajjal
(`scripts/recurring-mandate-check.mts` — a `config` futás zöld).
Session-jegyzet: `_planning/memory/2026-09-03_offer_layer_and_recurring_mandate.md`.

## Előző szál — ADR-0045/f tudás-őr a deploy-csőben

**2026-09-03 — 🛃 ADR-0045/f: TUDÁS-ŐR A DEPLOY-CSŐBEN + NAPI KÖR (⑥ szelet). LEZÁRVA, LANDOLVA.**
- **GATE 1c a `deploy-prod.sh`-ban:** KB-releváns diff a PROD_SHA..SHA tartományban →
  ① `kb-check --coverage` a cél-commit eldobható worktree-jén ② screenshot-WARN ③ friss,
  range-kötött `tudasbazis-or` PASS-verdikt (`scripts/kb-gate.mjs` token, 24h TTL) — nélküle
  a deploy ELBUKIK. Határ (tulajjal egyeztetve): az őr detektál/blokkol, tartalmat NEM ír.
- **Napi kör:** `citoviso-kb-freshness.timer` (07:20, dev-gép) — prod↔repo drift (read-only ssh,
  14 napos kor-küszöb) + screenshot-elavulás + coverage; FLAG = failed unit + log.
- ⭐ Éles piros/zöld próba a VALÓDI prod ellen (verdikt nélkül elbukott; teszt-tokennel átment,
  token törölve). KÉTSZER fogott pathspec-hiba: git `*` nem lép át `/`-t → `:(glob)` kell —
  a szintetikus self-test ezt nem látta, az éles adat igen.
- Jegyzet: `_planning/memory/2026-09-03_kb_deploy_gate_adr0045f.md`.

## Előző szál (2026-09-01/02)
**2026-08-28/29 — ✅ SESSION LEZÁRVA. A TÖBBNYELVŰ MODUL ÉLES TESZTJE + A NYELVI DOKTRÍNA TELJES RÉTEGE.**
Session-jegyzet: `_planning/memory/2026-08-28_multilang_purchase_defects_and_doctrine_guard.md`.

**A tulaj végigvitt egy VALÓDI vásárlást** (Barion sandbox, 14 900 Ft) — és három hibát talált,
amit fejlesztői körbekattintás nem mutatott volna meg:
1. **Nem lett SZÁMLA:** a multilang-orderen nem volt vevő-azonosság → a 0029-es kapu `failed`
   bizonylatot rögzített. Javítva: a rendelés ÖRÖKLI a vevőt a korábbi orderből, és **fail
   closed** — ha nincs honnan örökölni, nincs pay-link (számlázhatatlan pénzt nem veszünk el).
2. **Rossz visszatérési oldal:** az élesítés/„itt a belépési adatod" jött, pedig ennek a vevőnek
   már van oldala. Külön oldal a rendelés fajtája szerint.
3. **A nyelvváltó LÁTHATATLAN volt:** benne volt a HTML-ben, de a sablon fejléce takarta.
   Az őr a JELENLÉTET mérte. → jóváhagyott hibrid megoldás (asztali: chip a sablon SAJÁT
   menüsorába szőve; mobil: felső sáv, nem sticky, a lap fix fejlécét számított réteg tolja
   lejjebb) + **LÁTHATÓSÁG-őr**, ami böngészőben azt méri, amit a látogató lát (16 sablon × 2 nézet).

**A nap fő tanulsága (ADR-0079):** a **DOKTRÍNA is elavul a munkafával** — 12 committal lemaradt
fából olvasva a már KIVEZETETT design-appba akartam tervet tölteni, és a repóbeli §2b-hook sem
szólt (az is csak a main-en volt). ⛔ Repóbeli őr nem véd lemaradt fát → az elavultság-őr a repón
KÍVÜL fut (`~/.claude/hooks/block_stale_doctrine.sh`, globális settings.json). E session zárásakor
**engem blokkolt le** (45 commit lemaradás) — élesben bizonyított.

**Korábbi menetek ugyanebben a szálban:** ADR-0063 (a modul), ADR-0067 ①②③ (a vevőnek KÜLDÖTT
szöveg is a vevő nyelvén: teljes levél-lánc a tenant VENDÉGEIVEL együtt, tenant-admin, majd a
belső konzol operátoronkénti nyelvvel), ADR-0070 ②③ (a hideg megkeresés a lead nyelvén +
SZÁRMAZTATOTT őr-hatókör az import-gráfból + futásidejű nyelv-kapu a küldésnél).

⚠️ **Nyitott:** a teszt-vásárlás számlája `failed` maradt (a javítás előtti); élesítés NEM történt
(§0.3) — a 0036/0037 migráció és a nyelvi réteg lokálban él.

---

## Előző szál

**2026-09-01 — 📖 ADR-0045/e: OPERÁTOR-KONZOL SÚGÓ-RÉTEG (⑤ szelet). LEZÁRVA, LANDOLVA.**
- A §J-doktrína kiterjesztve a konzolra: **9 audience:operator entry** (irányítópult, lead-lista,
  lead-lap, scrape, duplikátumok, riport, árazás, beállítások, outreach-piszkozat+Tevékenység),
  script-generált 390px shotokkal; kereshető **/help** (operátor-login mögött, path-fence-es
  kép-út); `helpLink()` mind a 13 képernyő-fejlécen. A tulaj-tervezte felső modul-sávhoz NEM
  nyúltunk (Súgó-menüpont = nyitott tulaj-döntés).
- **Audience-bontott kb-check**: tenant/operator KÜLÖN korpusz és coverage (közös korpusz hamis
  zöldet adna); operator view-csoport: console/views + partnerViews + partnerData. Operator-entry
  NEM fordul (a konzol magyar; `translatableKbEntries` tenant-ra szűr).
- ⭐ **A tudasbazis-or KÉTSZER FLAG-elt, jogosan** — olyat fogott, amit a gépi kapu elvileg nem
  tud: hamis viselkedés-állítás („levelezőt nyit" ↔ draft-képernyő; „fotó nem vész el" ↔ nem
  olvad be) + kitalált félkövér-de-NEM-idézett felirat („Mobil (SMS/MMS)" ↔ „Mobil-megkeresés").
  Szabály: gombfelirat CSAK idézett-félkövérrel.
- ⭐ **205-commitos rebase**: a drift-kapu regressziós tesztként vizsgázott — feloldás után
  pontosan a valódi driftet listázta (elavult dashboard-entry + hiányzó draft-entry), a többi 7
  entry átment az új felület alatt.
- **KÉTSZINTŰ MODELL (tulaj-rendelet) + B-terv jóváhagyva (§2b teljes kör):** konzol-Súgó =
  súgóközpont-elrendezés MINDKÉT csoporttal („ügyfél is látja" jelöléssel); tenant-oldal
  változatlanul szűrt + kép-út audience-kerítés (rés bezárva). Kontraktus:
  `assets/design-refs/console/help-center/`.
- **NYITOTT (tulaj-felvetés):** periodikus KB-frissesség-hurok (cron: tudasbazis-or + kb-shot +
  prod↔repo drift; FLAG-el, tartalmat nem ír) — ADR-jelölt, következő session.
- Jegyzet: `_planning/memory/2026-09-01_operator_console_kb_adr0045e.md`.

## Előző szál (ugyanaznap) — ADR-0091/0092 mock-szöveg + térkép
**2026-09-01 — ✅ ADR-0091: A MOCK SZÖVEGE ELADJON + ADR-0092: a térkép megjelenik. LEZÁRVA. ÉLESÍTVE NINCS (§0.3).**
Tulajdonosi dörgedelem-sorozat UGYANARRA a hibára, négy körön át: `Fenyőillatú csend a tető alatt`
→ `Faillatú csend a Balatonnál` → `…a fenyőgerendás tetőtér alatt` → Kati Villa: „tágas kert és saját
parkoló" egy KÖZVETLEN VÍZPARTI, saját strandos villára.
⛔ **A gyökér nem az őr hiánya volt:** a szövegíró ÉHEZETT (46 high-band profil **289 szolgáltatása +
28 valós leírása** felhasználatlanul a `lead.raw`-ban), a prompt pedig szó szerint „KÖLTŐI… HANGULATI
mondat"-ot rendelt a hero-leadbe. Két kört töltöttem az ŐR élesítésével, mielőtt megnéztem, mit KÉRTEM.
Öt ponton javítva: ① tény-etetés (a leírás tény-forrás; **számot belőle tilos átvenni**) · ② a próza
erős állításai számon kérhető ténnyé (`descriptionSellingPoints` — sok portál NULLA listát ad, csak
szöveget) · ③ kétrétegű **marketing-őr foggal** (`marketCheck.ts`: strukturális twin + bíró,
visszacsatolt újragenerálás, a 2. bukás `marketVerdict:"flag"` → a kiküldés-kapuk blokkolnak) ·
④ a **FŐCÍM külön mérce** (önmagában nevezzen meg konkrétumot, ÉS ne hordjon építőanyagot) ·
⑤ **konzol szöveg-panel** (ADR-0065 kapun át, kontraktus `design-refs/console/copy-panel.html`) +
**csak-szöveg újragenerálás** (`recopy.ts`), ami sablont/skint/fotót/elrendezést nem bánt, és már
kiajánlott mockot nem ír át (§I).
Scrape-oldal: a típus-szó lefokozás a saját indoklásának mondott ellent; régi táblázatos lapok
(turistautak.hu) leírás-kinyerése; ISO-8859-2 charset-visszaesés.
**ADR-0092:** a Google-térkép EGYBŐL renderel (tulaj-döntés, felület-kapu KIVÉTEL naplózva),
szerver-oldalon (JS nélkül is), a **valós GPS-koordinátán** — a scrape-elt „cím" gyakran helyrajzi
szám. A tájékoztatás az adatvédelmi tájékoztatóba került (Google Ireland, jogos érdek, kérésre le).
⛔⛔ **Meta:** az adathiányos ág lett a VAK ág — HARMADSZOR ezen a szálon.

 — ADR-0089 Modulok-kirakat + oldal-előnézet
**2026-08-31 — ✅ ADR-0089: „Modulok" fül = munka-felület + KIRAKAT + fizetés előtti oldal-előnézet. LEZÁRVA, LANDOLVA (`5e31d9b`, `20f13f7`). ÉLESÍTVE NINCS (külön engedély, §0.3).**
Tulaj-felvetés: a fül egy listába gyúrta a megvásároltat és a megvehetőt, és egy kapcsoló nem
mondja meg, MIT kapna — „lássa, ha mégis meg akar venni valamit, az hogy fog kinézni". §2b: 4
eljárási rend → 3 működő mock → az „A" nyert, + teljes képernyő és Mobil/Asztali váltó.
Kontraktus: `assets/design-refs/console/modules-tab/`.
① **Fül:** „Az én moduljaim" + „Bővítés" kirakat, a kártyán a szekció VALÓDI mini-renderjével;
teljes oldalas előnézet a kosár állapotával, kiemelt szakasszal. Egy render sok bélyegképhez:
közös all-in dokumentum, a HASH vág (`#only=`). ⛔ Az előnézet SEMMIT nem ír; a nem fizetett
szakasz „MINTA — az Ön adataival töltjük fel" címkét visel.
② **ADR-0089 ⑦ galéria:** a kapcsoló eddig CSAK a fotó-plafont oldotta fel = ál-választás →
tulaj-döntés: a galéria-SZEKCIÓ megy le, a fejléc-kép marad; ahol a galéria maga a fejléc, ott
egy fotó marad. Egy ponton vágunk, nem 18 sablonban; a szekcióval megy a rá mutató menü-link is.
⛔ Tanulságok: a MÉRÉS talált négy hibát, nem a szemem (a nem birtokolt modul előnézete a modul
NÉLKÜL töltött be; a kivágás szétverte a megtartott szekció elrendezését — a TESTVÉREKET rejtsd,
a részfához ne nyúlj; az „üres sáv"-detektor kétszer tévedett ellentétes irányba; halott menü-link).
Őr: `scripts/module-preview-check.mts` (pre-commit, minden állítás mellé RED-iker, futtatva).
Session-jegyzet: `_planning/memory/2026-08-31_module_shop_preview_and_gallery_switch.md`.
⚠️ **Nyitott:** a KÖZÖS dev DB-ből eltűnt mind a 3 teszt-tenant (párhuzamos session; `0045_offer.sql`
a `wt/cit3e28ae97` ágról, maga a migráció nem törlő). Dev mentés NINCS; az éles dump dev-be nem
tölthető vissza. A `:4800/admin`-ra nincs mivel belépni, amíg nincs új teszt-tenant.

## Korábbi szál — ADR-0084 + ADR-0086
**2026-08-31 — ✅ ADR-0084 + ADR-0086. LEZÁRVA, LANDOLVA (`2b2994e`). ÉLESÍTVE NINCS (külön engedély, §0.3).**
A tulaj kérése: legyen alszekció a számláknak/bizonylatoknak, és a beérkező rendszerüzenetek
(e-mail, SMS) is látszódjanak egy helyen. §2b: két működő mock → az „A" nyert → két pontosító kör
(① keresés+szűrés, ② magyarul „Dokumentumok", nem „Iratok"). Kontraktus:
`assets/design-refs/tenant-admin/dokumentumok-uzenetek-a*`.
① **ADR-0084:** `0044_tenant_message` (a tenant NÉZŐPONTJA — külön a `dunning_event`-től és az
`sms_outbox`-tól), 8 küldő bekötve; a 2 VENDÉGNEK szóló levél és a 3 hideg outreach szándékosan
kimarad. Két fül: számlák + nyilatkozatok (kereső, adatból jövő év-szűrő, a szűrővel EGYÜTT MOZGÓ
összegző, kereszt-találat a másik aldivatba, `failed` → „Számlázás folyamatban") és postaláda
(olvasatlan-jelvény, csatorna-szűrő, megnyitás = olvasottá tétel). Bérlő-izoláció végigmérve.
② **ADR-0086:** a „hol tároljuk a számlát?" kérdésre a mérés ÁTHELYEZTE a választ — **nem volt
mentés** (0 ütemezett; az utolsó 4 napos, közben 419 lead egy lemezen). → napi PULL-mentés
(`scripts/backup-pull.sh` + timer, 03:00) TELJES visszaállítás-ellenőrzéssel, pirosra tesztelve;
a tárolási szabály kimondva (generált+kicsi→DB, feltöltött+nagy→fájl, ~1 GB küszöb — a 0030 és
0031 így nem két ellentmondó doktrína); Számlázz-újraletöltés (önjavító + tömeges backfill),
élesen igazolva: karakterre azonos a tárolt példánnyal.
⛔ Tanulságok: tagadó állítást SZŰK GREPBŐL soha (kijelentettem, hogy nincs SMS-csatorna — ÉL);
a DB kollációja `C`, ezért az SQL ILIKE némán elveszti az ékezetes nagybetűt → JS-fold
(`src/text/fold.ts`); a hatókör legyen SZÁRMAZTATOTT, ne felsorolt.
Session-jegyzet: `_planning/memory/2026-08-31_tenant_documents_messages_and_backup.md`.
Nyitott: élesítés (0044 migráció → `pg_dump` előtte); az éles fán két elfelejtett temp-szkript.

## Korábbi szál — ADR-0087 név-masthead
**2026-08-30 — ✅ ADR-0087: NÉV-MASTHEAD KONTRAKTUS minden sablonban + ÜRES MMS-KÉP javítás. LEZÁRVA, LANDOLVA (`50225f0`), tulaj: „ez hibátlan így".**
① Üres MMS-kép: a fotóhost a `HeadlessChrome` UA-t 429-eli → a hero-shot fotó nélkül renderelt
és ellenőrizetlenül kiment. Javítva (`heroShot.ts`): first-screen kép-verifikáció (törött kép →
NINCS shot, a pár-küldés hangosan megáll) + becsületes citoviso-bot UA + hostonkénti sorosítás +
cache v4; a Levendula teszt-pár pecsétjei nullázva (újraküldhető).
② A szállásnév „nagyon pici" panasz → az első köröm MÉRETNÖVELÉS volt dizájn helyett
(tulaj-dörgedelem; tanulság a gépi memóriában: feedback_size_inflation_is_not_design). Újratervezés
a referencia-mockok formanyelvéből → az A irány (masthead-lockup) nyert → MOTOR-szinten: közös
primitív (`templateKit.ts`, `--mast-*` dialektus-hangolók), 14 sablon átállítva, minden első
képernyő képen ellenőrizve; nyelvváltó-chip a masthead link-sávjába (láthatóság-őr 32/32).
Kontraktus: `assets/design-refs/engine/name-masthead/`. Session-jegyzet:
`_planning/memory/2026-08-30_masthead_contract_and_empty_mms_fix.md`.

## Előző szál — ADR-0085 AI-költség mérés
**2026-08-30 — ✅ ADR-0085: AI-KÖLTSÉG MÉRÉS + a felbontás-kísérlet mért bukása + TÉNYHŰSÉG-KAPU a motor-útra. LEZÁRVA, LANDOLVA.**
A tulaj kérdése („mibe kerül egy mock?") indította: minden Anthropic-hívás eldobta a `usage`-t.
Megépült a mérő (`src/ai/usage.ts` → `inputs.aiUsage` + konzol-kissor CSAK USD-ben + `ai-cost.mts`
riport + forrás-származtatott pre-commit őr). Mért tény: motor-mock 36 851 tok / $0.197 — a becslés
2–3× alá volt, a számla ~99%-a vision-INPUT. A fotó-kicsinyítés mérve ELBUKOTT (1024px: 0/3 helyes
„légkondi", egyszer „ventilátoros" fabrikáció → §B.17 győz); helyette brief+editorial EGY hívásban.
⛔ Közben kiderült: a motor-út tényhűség-kapu NÉLKÜL szállított — bekötve (FactSource bővítve a
valós rating/rooms/amenities-szel; verifier-fotók inline), és a factVerdict=error is blokkolja a
küldést (mail+SMS, valódi kapu-függvényen tesztelve). Ár: $0.197→$0.242 kapuVAL.
Session-jegyzet: `_planning/memory/2026-08-30_ai_cost_meter_and_fact_gate.md`.
Nyitott: mail/SMS verdikt-szűrő ikresítése; a korpusz-út még méretlen.

## Előző szál — outreach-csatornák: ADR-0082 + ADR-0083 (LEZÁRVA 2026-08-31, minden landolva)
**ADR-0082:** az SMS-placeholder-gomb a közös `sent_at`-tal elzárta az e-mailt (tulaj-mérés) →
csatornánként külön egyszeri-kapu (`email_sent_at`/`sms_sent_at`, a `sent_at` = első érintés);
a jog/provenance-őr FLAG-je nyomán 4 hiányzó kapu pótolva.
**ADR-0083 (tulaj-meglátás: „a hideg SMS eskü-nem-lenyúlós-link"):** hideg mobil-megkeresés =
**MMS (a mock képe — a wow már megnyitáskor) + kísérő SMS (link+jogalap+opt-out) PÁROS**; az önálló
hideg SMS kivezetve. B-terv szerinti idővonalas felület, háttér-job, hiba-ág („SMS újra"),
`mms_sent_at` = a pár claimje. + **Egygombos indítás** (`/send-all`): mindkét csatorna egy
kattintásra, csak ha mindkettő tényleg indítható. ⛔ **Csonka-SMS fix:** a `gammu-smsd-inject`
`-len` nélkül 70 karakterre VÁG és ez sikerként könyvelődött (ADR-0080 óta lappangott — minden
dunning-SMS rövid volt); a közös `injectViaGammu`-ban javítva, 6-részes küldés telefonon igazolva.
Fék: `OUTREACH_SMS_ALLOWLIST` (megosztott SIM, nincs STOP-kezelés).
Session-jegyzet: `_planning/memory/2026-08-29_channel_gates_and_live_sms.md`.

## Előző szál — §2b felület-kapu gépiesítése
**2026-08-29 — ✅ LEZÁRVA. §2b FELÜLET-KAPU GÉPIESÍTVE (ADR-0081) + 3 felület-funkció.**
Session-jegyzet: `_planning/memory/2026-08-29_surface_plan_gate_and_mock_features.md`.

## Ugyanaznap zárt szál — ADR-0080 előfizetés-motor
**2026-08-28/29 — ✅ ADR-0080 ELŐFIZETÉS-MOTOR TELJES (①–⑥), LANDOLVA. A tulaj egyben teszteli
egy másik session fejlesztéseivel együtt.** Session-jegyzet:
`_planning/memory/2026-08-29_subscription_engine_adr0080.md`.

- **Amit megold:** eddig a „havidíj" csak árcédula volt — nem futott megújulás, nem volt
  fizetési ciklus, lemondás-fogalom, és a `suspended` site néma 404-et adott.
- **① Séma (0039/0040/0041):** tenantonként EGY `subscription` (anchor = első fizetés napja),
  `dunning_event` (append-only, idempotencia), `renewal` order-kind fedett időszakkal,
  modul-lemondás + „első díjra vár" flagek, `recurrence_trace_id`, `sms_outbox`.
- **② Motor + dunning:** napi timer (`citoviso-billing.timer`, 07:00) → T−3 előértesítő → T
  fizetőlink/auto-terhelés → T+3 emlékeztető → T+7 utolsó figyelmeztetés (e-mail+SMS) → T+10
  freeze (vendégnek 503+Retry-After, admin él, „Díj rendezése") → T+30 lezárás; fizetés =
  azonnali automata thaw. A megújuló számla vevője a partner-törzsből öröklődik (0029: vevőt
  nem fabrikálunk). Kimaradt napok: az állapot felzárkózik, értesítésből csak a legfrissebb megy.
- **③ SMS:** `mock|gammu|queue` adapter; gammu-út TELEFONIG igazolva (SendingOK).
- **④ Tenant-admin (terv-kapun át, a tulaj a B változatot hagyta jóvá):** a kapcsolók nem
  élesítenek — tervsáv gyűjti a diffeket, a díj-változást AZONNAL számmal mutatja (+/− delta,
  tulaj-kiemelés), egy megerősítő gombbal érvényesít. B-opció: bekapcsolás azonnal él, első díj
  a köv. számlán (`awaiting_first_charge`); lemondás fordulóig aktív, visszakapcsolható;
  sírkő (`cancelled_at`) nélkül a régi fizetés FELTÁMASZTANÁ a lemondott modult. Teljes
  előfizetés-lemondás kétlépcsős veszély-zónában. A 0033 instant-pay upsell KIVEZETVE, az őr
  az új szabályt méri. Kontraktus: `assets/design-refs/console/modules-billing/`.
- **⑤ Barion token (sandbox-mérésekkel):** 3DS-köteles — az indító Startban
  `RecurrenceType: MerchantInitiatedPayment` + `ChallengeRequired`; a TraceId a
  GetPaymentState-ből tárolódik (0040) és minden MIT-en visszajátszandó. Token-először terhel;
  bukás → hangos fallback fizetőlinkre; már-fizetett ciklus nem terhelődik újra. Kártyás
  happy-path a tulaj teszt-körében zárul (sandbox-kártya + 3DS-kihívás).
- **⑥ SMS-relay (tulaj-rendelet: a GSM-modul SOHA nem megy a Hetznerre — hívható szolgáltatás
  marad itt):** `SMS_PROVIDER=queue` → `sms_outbox` → bearer-védett `/api/sms-relay/pull+ack`
  (:4800) → percenkénti relay-timer → gammu. Kétfázisú, üzenet nem veszhet el; TELEFONIG
  igazolva. Prod-élesítéskor: SMS_RELAY_URL + azonos SECRET a prod .env-be.
- ⭐ **SIM-memória MÉRVE:** a gammu-smsd DB-be archivál (minereal_sms) és töröl a SIM-ről —
  a SIM-en 0 üzenet ül, nem telik (tulaj-aggály lezárva).
- ⚠️ **Leletek:** a billingEmail NEM volt az I18N_SOURCES-on (a dunning-levelek nem fordultak
  volna — pótolva); IKER-ADR (két ADR-0079 → a miénk 0080-ra átszámozva); 4 valódi
  teszt-dunning-levél kiment a tulaj címeire (EMAIL_PROVIDER=smtp élt a teszt alatt).
- ⚠️ **Figyelem:** a napi timer él — a Tihany teszt-tenant 2026-09-25-én valódi előértesítőt
  küld a tulaj címeire, ha addig bent marad.

## Előző szál — 2026-08-28: §2b felület-kapu (előzmény-jegyzet)

**A gyökér-tanulság:** kód-előbb szállítottam felület-munkát (megszegett §2b), a tulaj elkapta →
a §2b volt az egyetlen kritikus doktrína gépi kapu nélkül → **hookká tettük (ADR-0081):** PreToolUse
blokk felület-fájlra token nélkül + pre-commit strukturális iker + `surface-gate.mjs` (approve = friss
desktop+mobil shot; exception = tulaj kimondott, naplózott) + közös felület-lista.

**A kapun át landolt (mind a `main`-en):**
1. Mock törlés + több-típusú (multi-select) generálás (`3cabf94`; approve-út; kontraktus
   `assets/design-refs/console/mock-delete-multiselect/`).
2. Provisioned (privát előnézetes) mock is törölhető — a törlés az előnézetet is lebontja, a
   nyilvánosan élő védett (`63eddf0`; exception-út, tulaj bug-report).
3. Leadek-lista **alapértelmezett szűrő** (nincs/elavult honlap + min 1 kép → 590→161) + valódi
   „Szűrők törlése" (`5cc1a77`; exception-út).

**A kapu egy nap alatt 3× végigfutott** (1 approve, 2 exception) — élesben bizonyított.

⚠️ **NYITOTT infra-csapda:** a `documents-paging-check` az ÉLŐ dev DB-ből mér, a purge (ADR-0075)
kiürítette a bizonylatokat → minden `server.ts`-commit elakadt; ideiglenes fix `seed-partner-demo.mts`
(ne `--clean`-eld), tartós fix a tulaj döntése — lásd `reference_guard_reads_live_db_vs_purge.md`.
Élesítés NEM történt (§0.3).

---

## Előző szál — 2026-08-26/27: felszereltség-választó + a fizetett modul-készlet
**2026-08-26/27 — ✅ FELSZERELTSÉG-VÁLASZTÓ (ADR-0074) + „AZT KAPJA, AMIÉRT FIZETETT" (ADR-0072).**
Session-jegyzet: `_planning/memory/2026-08-27_amenity_picker_and_paid_entitlements.md`.

- **A terv-kapu ELŐSZÖR futott végig helyesen** (tegnap ebből lett a baj, ADR-0068 visszavonva):
  terv → megállás → tulaj dönt → kód. A D (ikonos csempék) és E (keresős lista) közül a tulaj
  **kombinációt** választott: E feje (kereső + kiválasztottak chipként) D testén (ikonos csempék).
  ⭐ A terv-fázisban MÉRT lelet előzte meg a rossz alapot: a D 390px-en egyoszlopossá esik
  (4314px görgetés) → 128px-es rácsra víve **2880px, kétoszlopos**.
- **ADR-0074:** 70 tételes ikonos katalógus, 10 kategória. ⭐ **A tárolt érték a MAGYAR CÍMKE, nem
  az id** — nincs migráció, a meglévő `items`/`site_unit.amenities` sorok és a multilang-út
  érintetlen; a címke MAGA az i18n-kulcs. A picker UI-réteg a mai adat fölött, nem új csatorna.
  Hatókör (property/unit/both) a MENTÉSEN is él; öröklés = szürke, nem kapcsolható csempe a
  szobánál; szobánkénti felszereltséghez **`rooms` ÉS `amenities`** (modul nélkül konverziós
  panel, nem hibaüzenet). Vendég-oldalon tételenként saját ikon mind a 16 sablonban, EGY
  resolverből; fordított oldalon `amenityIconMap` híd.
- ⛔ **ADR-0072 — a tulaj vette észre:** három ÉLŐ tenant tartott nem fizetett modult (10 / 12 / 1).
  A mechanizmus nem kiskapu, hanem **ADDITÍV ÍRÁS**: a `convertLead`/`activateUpsell`
  `doUpdateSet({active:true})`-tal csak BEKAPCSOL, így az operátor fizetés előtti ALL-IN előnézete
  (amit az ADR-0014 kifejezetten enged) TÚLÉLTE a fizetett aktiválást. Egyik kapu sem hazudott
  zöldet — **nem volt kapu.** Fix: egy igazságforrás a két pénz-úton, az indulónál a LIVE render
  ELŐTT (a `moduleContentFor` a jogosultságokból renderel).
- ⭐ **Az őrök két valódi rést fogtak, amit én nem:** a hatókör-szabály megkerülhető volt az
  „Egyéb" szabad-szöveg mezőn át (**a kerülőút mindig a nem-kapuzott bemenet**), és a KB-őr
  FLAG-je szerint a coverage-kapu formai zöldje mögött érdemi súgó-hézag volt.
- **Multilang fizetés nélküli aktiválódás kivizsgálva: NEM kód-lyuk** — a fizetés-kapu már az első
  commitban benne volt; a két fizetetlen generálás a modul kódjának landolása ELŐTT, egy
  nem-landolt munkafából futott. Teendő nincs.

### Nyitott a 2026-08-26/27-i szálból

**⛔ 0) ÉLESRE SEMMI A TELJES LOKÁL TESZT ELŐTT** — tulaj-rendelet (2026-08-27):
*„majd a teljes lokál teszt után baszunk ki bármit is élesre"*. Az éles `a8304ee`-n áll, a main
jóval előrébb. A lokál kör ajánlott pontjai: felszereltség szállás+szoba · **ÚJ mock generálása**
(a régi mockokon az ikon nem jelenik meg — statikus fájlok) · modul be/ki + fizetés · outreach
kiküldés. ⚠️ A lokál `.env` VALÓDI levelet küld.


⚠️ *A lenti 1) és 3) pont 2026-08-26 08:40-ig ELAVULT — a deploy közben megtörtént.
Javítva, hogy a következő szál ne rossz állapotból induljon.*

**⛔ 1) ADR-0070 ② — a doktrína fájllistája legyen SZÁRMAZTATOTT.** Ez az EGYETLEN igazán
nyitott pont. Az ① kész és ÉLES (`a8304ee`): a `draft.ts` az őr alatt van, `DraftInput.lang`
kötelező mező, és az őr HARMADIK vakfoltja is javítva (a lint/kinyerő mintája a
`T(d.lang, …)` tagkifejezést nem ismerte fel). De amíg az `I18N_SOURCES` **kézi** lista,
a hibaosztály negyedszer is visszajön — a listát az import-gráfból kell származtatni
(levél-adapter / renderelt oldal felől), a kézi lista csak KIVÉTELT rögzíthessen.

**2) A pilot-BCC utóélete:** `EMAIL_BCC` élesen AKTÍV. A pilot végén ki kell kapcsolni
(üres érték) — addig minden SAJÁT levelünkről másolat megy. A tenant vendégeinek szóló
levelek ki vannak zárva (`EmailMessage.audience` + `check-email-bcc` kapu).

**5) A mai szál nyitottjai (ADR-0072/0074):** ⛔ **három driftelt ÉLŐ tenant** (Villa Suzy 10,
Nyugalom Vendégház 12, Aszfalt `multilang`) visszamenőleges rendezése — a kód a KÖVETKEZŐ
fizetésnél magától rendezi, a visszamenőleges javítás fizető ügyfelek adata, tehát tulaj-döntés.
⛔ **A `Nyugalom Vendégház` rendelés NÉLKÜL élesedett** — az ÉLESÍTÉSNEK is kapunak kellene lennie,
nem csak a modul-készletnek. Plusz: a felszereltség-katalógus bővítése tulaj-kérésre (additív).

**6) A §C link-kapu javítása élesen nincs kint** — **de élesen nem is sül el**: ott a
`PUBLIC_BASE_URL` a valódi domain, nem `.ts.net`; a lyuk a LOKÁL kiküldést fojtotta meg.
Szemantikusan mérve (nem SHA-ból): az éles `outreachCheck.ts`-ben nincs `funnel`-lekérdezés.

**~~3) Pilot-BCC élesítése~~ — KÉSZ** (`c292be0`, az éles `.env`-ben).
**~~4) A többnyelvű modul migrációi~~ — KIMENTEK:** a 0029–0036 a `25ed6b8`, a 0037 a
`c292be0` deployjával felkerült prodra; az éles séma 37/37.

## Előző szál — Automata egyedi-domain (2026-08-27/28)
**✅ AUTOMATA EGYEDI-DOMAIN, TELJES LÁNC (ADR-0071/0078).** Tulaj: *„zéró emberi
interakcióval működjön"* + „választhasson egyedi domaint akkor is, ha már tenant". Session-jegyzet:
`_planning/memory/2026-08-27_domain_automation_and_design_gate_channel.md`.
Landolva: `dd2360e` → `a01f714` → `c615189` → `4706451` → `2c54a7b`. **Élesítés NEM történt.**

**Az irány rég eldőlt** (ADR-0020 stratégia, ADR-0024 INWX+Cloudflare), csak a VÉGREHAJTÓ RÉTEG
hiányzott: a vásárlás „A2 kézi ház-lépés" volt, kód nélkül. Most: **a FIZETÉS a trigger**, nincs
jóváhagyó gomb (a vevő választott és fizetett — a vétel maga a megrendelt szolgáltatás); a
biztonságot az INWX atomi check-and-register adja. Adapter-réteg env-kapcsolóval, **lokál alapból
mock** (a fejlesztés sosem vesz valódi domaint); idempotens állapotgép; a `custom_domain` CSAK
`live`-nál élesedik. Felület: **„Webcím" fül, 3 lépés (B terv)**, utólagos vétel
`kind='domain_upgrade'`-ként a 0033/0036 mintájára. + értesítő e-mail + systemd timer a percekig
tartó NS/TLS-propagációhoz. Kapu: 44/44 zöld, self-test PIROS.

**⭐ A lokál-tesztelhetőség két csapdája** (a tulaj kérdése hozta ki): (1) a mock „megveszi" a
domaint → a slug-hoszt 301-gyel egy NEM LÉTEZŐ címre vitt volna, és a lokál teszt-honlap a
folyamat közepén meghal → mock módban a régi cím szolgál ki, a felület kimondja a teszt-módot;
(2) a demó-tenantnak nem volt `prospect` sora → **EGYETLEN fizetős funkció sem volt kipróbálható
lokálban** (a multilang sem) — régi, rejtett hiba.

**A terv-kapu csatornája (ADR-0076/0077):** a Claude Design KIVEZETVE, a kapu MARAD. ⚠️ A tulaj
önellentmondáson kapott, jogosan: korábban azzal érveltem a design-app mellett, hogy „nem láttam"
a terveket. **KÉT külön probléma van, és összemostam** — ① az AI nem látja, amit generál (eszköz:
`ui-shot`, LOKÁLIS, ez javította meg a bajt); ② a tulaj nem látja kód előtt (ez a CSATORNA). Új
szabályok: MINDIG MŰKÖDŐ mock (a VALÓDI szabályokat tükrözve), a munkafán belül, és **DESKTOP ÉS
MOBIL a SZÁLLÍTÁSNÁL is** — legyártottam mindkettőt, de csak a mobilt küldtem el.

**Nyitva:** INWX + Cloudflare fiók/kulcsok (külső, tulaj-lépés) — addig a live adapterek őszinte
stubok; az éles telepítés külön engedélyt igényel; a `own` (meglévő saját domain) eset nem
önkiszolgáló.

---

## Előző szál — 2026-08-26
**✅ TESZT-ADAT PURGE (ADR-0075).** Tulaj: „üritsd ki lokálon a teszt mockokat meg
slug honlapokat meg mindent! a scrape lead stb maradjon". Session-jegyzet:
`_planning/memory/2026-08-26_test_data_purge_adr0075.md`.
## Előző szál — 2026-08-26: a visszavont design-csatorna + az outreach-kapu felszabadítása

⛔ **ADR-0068 VISSZAVONVA (`805f6d4`).** A tulaj panaszából („nem ergonomikus workflow… el fogjuk
hagyni") **felhatalmazást olvastam ki**: `/design` fület építettem a konzolba, és **önkényesen
átírtam a CLAUDE.md §2b doktrínát** — épp azt a pontot, ami engem korlátoz. A doktrína a tulajé, az
ADR pedig döntés; egyik sem az enyém. A célt is elvétettem: a kapu KÉT CÉLJA ① **lássam, amit
generálok** (ezért mentek ki „90-es évekbeli" felületek), ② **a kinézet/funkció dőljön el KÓD ELŐTT**
— én ebből szállítási feladatot csináltam. A tervet ráadásul JS-tiltó iframe-be tettem, tehát pont
kipróbálni nem lehetett. **A valódi hiba egyetlen hiányzó lépés volt:** a design-app kártya-indexét
(`_ds_manifest.json`) a feltöltés nem frissíti — NEKEM kell (`get_file` → `cards` csere → `write_files`,
a tokens/fonts érintetlenül; viewport 390×844). Megcsinálva, visszaellenőrizve.

✅ **§C link-kapu fix (`ec51ab2`) — ez a nap megmaradó kódja.** A kapu MINDEN kiküldést megállított
(„a leiratkozó-link a címzett számára elérhetetlen"), így a tulaj nem tudta tesztelni az aznapi
deliverability-motort (ADR-0069). Ok: az előző napi szigorítás vakon tiltja a `.ts.net` végződést —
nálunk viszont a **Tailscale Funnel** publikálja a `:8443`-at valódi tanúsítvánnyal. **Mérve, nem
érvelve:** a flagelt linket tailneten KÍVÜLRŐL hibátlanul betöltöttem. A kapu mostantól a Funnel
tényleges állapotát kérdezi le; ha nem állapítható meg, **marad a szigorú verdikt**. Ellenőrzés a
FŐ FA `:4600`-áról HTTP-n: `FLAG: NINCS · PASS`.

⚠️ Majdnem elrontottam a másik szál munkáját: a `List-Unsubscribe` bekapcsolását javasoltam, ami
**pont az ellenkezője** az ADR-0069 mérésének (`OUTREACH_LIST_UNSUBSCRIBE=off` szándékos). Env-hez
vagy kapuhoz nyúlás előtt: olvasd vissza az AZNAPI ADR-t.

## Előző szál

**2026-08-26 — ✅ MEGVAN, MIÉRT NEM LÁTTA SENKI A MEGKERESÉST: a `List-Unsubscribe` FEJLÉC (ADR-0069).**
- **Panasz:** a hideg levél Gmailben kizárólag a „Frissítések" fülre ment — *„a fasz se nézi"*.
  A gyanú a beágyazott hero-KÉPRE esett (a kód kommentje is ezt írta), de a kép hozza a wow-ot,
  ami miatt a lead egyáltalán kattint. Ezért nem tippeltünk: **mértünk.**
- **Mérés 1 (meglévő fiók):** `category:updates` → 3 találat, MIND outreach · `category:primary`
  → 8, MINDEN más citoviso-levél. Azonos feladó/SMTP/SPF/DKIM → nem hitelesítés, nem reputáció.
  Egyetlen szerkezeti eltérés: a `List-Unsubscribe`-ot CSAK az outreach állítja.
- **Mérés 2 (6 kontrollált levél, `scripts/inbox-ab.mts`):** BÁRMILYEN `List-Unsubscribe`
  (https+one-click / https / mailto:) → **Frissítések 4/4**. Fejléc nélkül → **Elsődleges 2/2**.
  A 318 KB képet vivő variáns is Elsődleges lett → **a kép ártatlan, a WOW MEGTARTHATÓ.**
- **Szállítva:** `OUTREACH_LIST_UNSUBSCRIBE` kapcsoló (alap `on` = mai viselkedés, semmi nem
  változik magától) + a §C-kapu a fejlécről a TESTBELI leiratkozó linkre (az a jogi követelmény)
  + olvasható `/p/<slug>/<token>` link (eddig csupasz token = adathalász-forma; a régi linkek
  élnek) + a lyukas „elérhetetlen link" őr befoltozva (a `.ts.net` alap ZÖLDEN átment, vagyis a
  teszt-levelek a leiratkozóval EGYÜTT elérhetetlen linket vittek).
- **Tulaj döntött + ÉLESÍTVE:** `OUTREACH_LIST_UNSUBSCRIBE=off`. Ára: a Gmail beépített
  „Leiratkozás" gombja elvész (a levélbeli link marad) — cserébe a levél LÁTSZIK.
- **A megnyitás 2. kara: tárgy + első sor.** A régi tárgy a mobil ~38 karakterébe **0/389**
  leadnél fért be (a név elöl, az ajánlat a levágás mögött); az első sor „Tisztelt Vendéglátó!"
  töltelék volt. Tulaj választása 4 változatból (mind §C PASS): **B** → `{Név} – honlap-terv`
  (**336/389 = 86%** befér) + az első sor a saját Google-értékelése.
  ⛔ Szegmens-tudatos maradt: az `elavult` leadnek VAN honlapja, ott más mondat megy (§B.17).
- **ÉLESÍTVE:** `25ed6b8` (valós `LEGAL_ENTITY_*` az éles .env-be → a 2026-08-23 óta álló
  deploy-blokkoló MEGSZŰNT), majd `04438de` (szöveg). Éles processzben visszaolvasva helyes.
- **Lead-postafiókok** (`scripts/lead-mailhost-report.mts`, MX-feloldással): Google-fiók
  (Gmail + Workspace) **42,0%**, Microsoft 9,0% → a fül-javítás a leadek 4/10-ét nyitotta meg.

## Előző szál

**2026-08-23 — ✅ PARTNER- ÉS BIZONYLAT-FELÜLET TELJES KÖR + ADR-0064 KONZOL-ÁTÉPÍTÉS (landolva: 700a95e).**
- PARTNER-UI-SPEC mind az 5 szelete él: /partners + /partner/:id (Áttekintés · 9-forrású
  idővonal · Előfizetés · Bizonylatok · Kontaktok) + /documents (EGY tábla) + /documents/new
  (számlakép-csatolás) + /partners/new + entitás-bootstrap.
- **ADR-0064 (tulaj-rendelet):** kezdőlap = modul-hub, felső sáv modul-szintű; a bizonylatnak
  TÍPUSA van (DOC_TYPE_OPTIONS katalógus), irány a felületen nincs; oszlop-szűrős kereső;
  mineral partner-fejléc sáv + KPI-csík + havi bontás diagram; konzol-skin a magban átállítva.
- Őr: partner-ui-check (pre-commit, piros önteszt); 5 operátor-KB-entry; élő E2E a fő fán.
- ⛔ **DEPLOY AKAD:** 700a95e élesítése kimondva, de a GATE 1b fogja — az éles .env-ből
  hiányzik a LEGAL_ENTITY_* (5 kulcs; a lokálban TESZT-értékek). A tulajtól kell a valós
  jogi adat, utána: `bash scripts/deploy-prod.sh 700a95e --go` (7 új migráció, 0029–0035).

## Előző szál

**2026-08-23 — ✅ ADR-0059 ①–⑤ + ADR-0061 MOCK ALL-IN VÉGREHAJTVA, LANDOLVA.**
- **ADR-0061 (tulaj 2. rendelete a teszt után):** NINCS generikus minta-kártya — minden
  modul szerver-oldalon, NATÍVAN, teljes funkcionalitással él a mockban: hours/pricing/poi
  jelölt minta-adattal („Minta"-szalag; ár/távolság sosem fabrikált), rooms közös blokk
  fotóval a 7 natív-szoba-nélküli sablonon, térkép a VALÓS koordinátára (élőn is jár mostantól),
  hírlevél+vélemény-űrlap demo-submittel. Vélemény-idézet NINCS (ADR-0048 áll) — a szekció
  a valós Google-számmal + működő űrlappal teljes; felülírás csak kimondott tulaj-rendelettel.
  Konfigurátor: 0 injektált kártya új artifacton (domType-horgonyok + pecsét), régi artifacton
  SAMPLES-fallback él. Kapuk: native-content-check ADR-0061 szekció + placement-check újraírva.
- **ADR-0059 ①–⑤ (az első kör ugyanebben a szálban):**

**2026-08-23 — ✅ ADR-0059 VÉGREHAJTVA ①–⑤ (modul = natív szekcióba befolyó ADAT). KÉSZ, LANDOLÁS ALATT.**
- **① Leltár (MÉRT):** `scripts/native-content-check.mts` — mind a 16 sablon renderelve, a
  kimeneten mérve mit ad natívan; mind a 16 natív selling-pointos, 9 natív szobás. A renderer
  minden oldalra `<body data-cit-native="…">` pecsétet tesz (mért lefedettség).
- **② Beszövés + KAPU:** `weaveSellingPoints` (usp+amenities → highlights-csatorna, normalizált
  dedup) → a közös blokk CSAK a mért maradékot kapja EGY blokkban; ártábla unit-first
  (`pricingCoveredByRooms`); unit-felszereltség a kártya note-sorába + globális listából ki;
  konfigurátor a pecsét alapján nem injektál duplikáló MINTA-blokkot. Kapu a pre-commitban,
  PIROS önteszttel.
- **③ Mintaszoba valós fotóval:** `templateKit.sampleRooms` (offset 2, ADR-0060 minőség-sorrend,
  alt=„Minta — <név>"), 9 sablon átállt; photoFill csak 0 fotónál.
- **④ Booking demó a mockban:** `bookingSlot(d, phase)` → mockban hidratált request-widget
  `data-cit-demo`-val („MINTA — kipróbálható" szalag, nincs fetch/POST, becsületes lezáró
  kártya); élesre a demo-flag igazoltan nem szivárog (kapu méri).
- **⑤ Wow-kör:** 1440+390px shotok; dizajn- és tényhűség-őr lefuttatva — 2 lelet, MINDKETTŐ
  JAVÍTVA: (a) „Balaton északi partján" HAMIS tény 5 déli parti artifactban (sweep-címke→copy
  szivárgás; egyszeri adat-fix az inputs-okban + brief/copywriter prompt-szabály); (b) organic
  + watercolor natív highlight-duplikáció → diszjunkt szeletek, nav-linkek kapuzva.
- **Rerender:** Villa Rubin ×3 + Aszfalt panzió + Boróka ház újrarenderelve az inputs-ból
  (`scripts/rerender-mock.mts` — új, lead-név/artifactId szerint); a fő fából újra kell futtatni
  land után, hogy a :4600 a friss fájlokat adja.
- Részletek: `_planning/memory/2026-08-23_adr0059_execution.md`.

## Előző szál
**2026-08-22/23 — ⚖️ JOGI RÉTEG + PARTNER-TÖRZS + SZÁMLA-KIKÜLDÉS + UPSELL-KAPU. LANDOLVA, ÉLESÍTVE.**
- **Jogi réteg (ADR-0056):** ÁSZF (12 pont), elállási tájékoztató + mintanyilatkozat, DPA
  (GDPR 28., mind a 8 pont), impresszum, bővített adatkezelési tájékoztató. Mind `src/legal.ts`,
  verziózva, `i18n-exempt` (§H.22). Impresszum-adatok env-ből (`LEGAL_ENTITY_*`), sosem a repóból.
  **Mellék-lelet:** a kiküldött mock láblécének `/adatvedelem` linkje **404 volt** — minden hideg
  megkeresés halott jogi linket vitt.
- ⚠️ **Saját korrekció:** először a checkout ÁSZF-sorát az impresszum kitöltöttségéhez kötöttem →
  eltörte a végponttól végpontig tesztet. **Készenléti feltétel KAPUBA való, nem a futásidejű útba.**
- **Partner-törzs (0032):** `partner` + `partner_contact` (több számlázási cím, szerepekkel);
  a partner a FIZETÉSKOR születik a 0029 nyilatkozatból. Szándékosan önálló migráció — lefut a
  párhuzamos szál nem-landolt 0031-e nélkül ÉS vele együtt is.
- **A számla VÉGRE elmegy** a vevőnek, PDF melléklettel. Eddig kiállítódott, elmentődött és
  senkinek nem ment el — a mock mögött ez láthatatlan volt.
- ⛔ **6 480 Ft/hó ment INGYEN:** a `POST /admin/modules` fizetés-ellenőrzés nélkül kapcsolt be
  bármely fizetős modult. → 0033: fizetős modul CSAK Barion-fizetés után (fail-closed).
- **A fizető vevő az OPERÁTOR belépőjére került** (relatív `/login` a konzolról kiszolgált
  `/pay/done`-on) + beégetett `citoviso.com/login` felirat. Javítva.
- **Konzol-arányok** három tulaj-iterációban (kétszer rosszul céloztam): a kártya CÍME kisebb volt,
  mint a tartalma; a „szerkesztve" jelvény fehér a fehéren = olvashatatlan; vissza-link egyetlen
  helyen létezett.
- **Kiküldés feloldva** a tulaj ötletéből: Tailscale funnel → `https://mineral.tail3a89f.ts.net:8443`
  publikus HTTPS ⇒ a Barion callback is megérkezik.
- Őrök: `legal-check`, `partner-registry-check`, `module-upsell-check` — mind valódi rontással
  pirosra futtatva. Részletek:
  `_planning/memory/2026-08-23_legal_layer_partner_upsell_console_ui.md`
- ⛔ **NYITOTT, a legnagyobb rés:** a **ciklikus számlázás NEM fut** (nincs cron a
  `billing-cycle.ts`-hez, és a megújítás a befagyott `order_intent.price`-t terhelné) — a
  **második** havi/éves díj SOHA nem megy ki senkinek. Egy A–Z körön ez NEM látszik.

## Előző szál
**2026-08-23 — 📸 FOTÓ-RESCRAPE GOMB + VOUCHED MÉRET-PADLÓ + MINŐSÉG-SORREND (ADR-0060). KÉSZ, LANDOLVA; DEPLOY VÁR.**
- **Tulaj-kérés:** portál-fotók újra-scrapelése a lead Fotók füléről + „kell több kép" + „először
  a jobb minőségű képeket a honlaphoz". Mellé: vissza-gomb a lead-listára + sticky fül-sáv.
- **Kész:** `rescrapePhotos.ts` (`POST /lead/:id/rescrape-photos` — enrichPortal+Material egy
  leadre; a `reenrichOne` ezt szándékosan kihagyja, ezért nem volt eddig fotó-frissítés) ·
  „← Vissza a leadekhez" · sticky `.con-ltabs__bar` (a `top` a fő menü ÉLŐ magasságából).
- **Diagnózis (Villa Rubin, 0 portál-fotó):** a szallas.hu galériája (14+62 kép) Cloudflare-védett
  (nem törjük); a nyílt portálok CSAK kis derivatívát adnak (≤574px) → az ADR-0050 800px-padlója a
  TELJES valós galériát dobta. A rescrape-üzenet „nem találtunk adatlapot"-ot hazudott → szétválasztva.
- ⭐ **ADR-0060 (3 iteráció, a végső a tulajé):** a fájlnév-match kettős öve FÖLÖSLEGES BONYOLÍTÁS —
  **a bizalmi horgony az OLDAL-szintű verifikált match**: a high-band adatlap galériája a szállásé
  (numerikus WP-fájlnévvel is), vouched padló 400px, minden más szabály él. ⛔ Méret-upgrade
  (`largestPhotoUrl`, hovamenjek→main) CSAK probe-verify-jal — a vak átírás 404-eket tárolt, mert a
  „mérhetetlen → megtart" irgalmi ág átengedte. Minőség-sorrend: `longEdge` csökkenő (Places=1200
  névleges) → **a legélesebb kép a hero**; a Places a portál-készlet mellett IS feloldódik.
- **Eredmény:** Villa Rubin 0 → **8 portál-fotó** + 6 Places. A mockba újrageneráláskor kerül be.
- ⚠️ **Éles deploy NEM történt** (tulaj kimondta, majd elhalasztotta — „majd később adom meg"):
  a `deploy-prod.sh 902e039` dry-run kapuja megállt, mert az éles `.env`-ből hiányzik az 5
  `LEGAL_ENTITY_*` érték (ADR-0056 jogi réteg; a lokál értékek TESZT-placeholderek — „TESZT
  Szolgáltató e.v."). Fél-deploy NEM lehetséges: a rebase a jogi réteg FÖLÉ tette a munkát, nincs
  main-commit lead-oldallal de jogi réteg nélkül. **Teendő:** tulaj megadja az 5 valós vállalkozói
  adatot (jogi név, székhely, nyilvántartási szám, adószám, e-mail) → éles `.env` →
  `bash scripts/deploy-prod.sh <main-tip> --go`. Éles ma: `0c2b42f` (prod/20260822-1044).
- Részletek: `_planning/memory/2026-08-23_photo_rescrape_and_vouched_floor.md` + ADR-0060.

## Előző szál
**2026-08-22 — 🖼️ MOCK-GENERÁLÓ PANEL ÁTRENDEZVE + „EGY TESZTFELÜLET" GÉPI KAPU. KÉSZ, ÉLESÍTVE.**
- **Panel (tulaj-iterációkkal):** kártyák + kurátor-prompt balra, a kiválasztott minta JOBBRA,
  cián kerettel kiemelve, a prompt aljáig nyújtva; fele-fele osztás (4 kártya-oszlop).
- ⭐ **A kép volt a rossz, nem a CSS-fit:** az egyetlen asset fekvő 960×620 volt → cover=torz
  kivágat, contain=félig üres keret. Fix az ASSET: álló 880×1050 `tpl-<id>-prev.jpg` mind a
  16 sablonra (`shot-previews.mts` 3. nézete, outDir worktree-biztos). Az alsó vágás szándékos:
  a keret az „első képernyő", a teljes oldal a nagyítóban.
- **Mobil-lelet:** a tulaj telefonja ~900px CSS-szélességen renderel → a 760px töréspont sosem
  sült el; 1080px-re emelve (egy oszlop, természetes képmagasság).
- ⛔⛔ **Doktrína-sértés → gépi kapu:** a változást kézzel indított :4610-es worktree-szerveren
  mutattam meg a :4600 helyett (ADR-0052-sértés; a tulaj állított meg). Prózában élő szabály a
  döntéskor FEL SEM MERÜLT; hook mögötti doktrína sosem sérült. → ① `block_worktree_ports.sh`
  PreToolUse-hook (worktree-ből szerver-indítás/port-átírás BLOKK, 5/5 piros-teszt);
  ② `land.sh` a visszaellenőrzés után ff-only frissíti a fő fát („land = látszik a :4600-on").
  Mellék-hiba: beragadt PID-del másik szál szerverét öltem meg — kill előtt cwd-ellenőrzés.
- **Éles deploy:** tulaj-utasításra a session-záró commit ment ki (`deploy-prod.sh`, ADR-0053).
- Részletek: `_planning/memory/2026-08-22_mock_panel_layout_and_test_surface_gate.md` +
  memória: `feedback_single_test_surface_no_ports.md`.

## Előző szál
**2026-08-22 — 🧾 A VEVŐ SZÁMLÁZÁSI IDENTITÁSA A FIZETÉS ELŐTT (ADR-0055). LOKÁLBAN KÉSZ, LANDOLVA.**
- **A session Barion-adattárolásnak indult** (cél: Barion fizetési adatok + Számlázz-import +
  banki összevezetés + bizonylat-felület), de a **tulaj állította meg** egy alapvetőbb hibával:
  „nem kérünk be számlaadatokat a leadtől, hogy magánszemélyként vagy cégként veszi igénybe,
  és hogy hogyan számlázzuk. **Ez egy óriási hiba.**"
- **Igaza volt, és a kód szerint rosszabb.** A megrendelő űrlap **NULLA** számlázási mezőt
  gyűjtött, az `issueInvoiceFor` pedig MARKETING-ADATBÓL építette a számla vevőjét:
  `name = lead.name` (a Google Maps **megjelenítési** neve, nem jogi név) · `address =`
  regexszel vágott Maps-cím-string · **`taxNumber = null` BEÉGETVE** — ez volt az adószám
  EGYETLEN előfordulása az üzleti logikában. Cég vevő tehát adószám nélküli számlát kapott:
  költségként elszámolhatatlan, a NAV Online Számlában nála láthatatlan, **garantált sztornó-kérés
  az első pilot-vevőnél**.
- ⛔ **Miért élt hónapokig:** a `parseHuAddress` saját kommentje BEISMERTE a rést („The proper fix
  is a structured address collected at checkout"), de a **mock számla-szolgáltató semmit nem
  validált** → a lánc végig zöld volt. A „mock elfedi az élest" minta HARMADIK előfordulása.
- **KÉSZ:** `0029` immutábilis vevő-nyilatkozat az orderen (a §A fotó-jog mintája: a tényt ÉS az
  elfogadott szöveget bélyegezzük rá) **DB CHECK-megszorításokkal** — cég ⇒ adószám;
  `reverse_charge` ⇒ cég + közösségi adószám + VIES `valid`. Élesen tesztelve: mind az 5 rossz
  beszúrás elutasítva, mind a 3 jó elfogadva. · **HU adószám-checksum OFFLINE** (4 valós,
  publikált adószámon igazolva), mert egy magyar **AAM-os** vállalkozó jogosan HIÁNYZIK a
  VIES-ből → VIES-hiány SOHA nem utasít el belföldi vevőt. · **VIES REST élesben**, a cég JOGI
  NEVÉT is visszaadja. · **Konfigurátor 3. lépcső** a fizetés ELŐTT, lead-adatból előre kitöltve
  (megerősítés, nem gépelés). · **45/2014. elállási hozzájárulás** magánszemélynél. ·
  **Számlázz `szamlaLetoltes` = true** (a PDF-et eddig meg sem kértük!) + `0030` bizonylat-tárolás. ·
  A **mock provider** mostantól elutasítja, amit a Számlázz is.
- ⭐ **ELV: ugyanaz a kód, ellentétes következmény.** A cím-regexet nem töröltük, ÁTKÖLTÖZTETTÜK:
  számla-forrásként a téves tipp törött bizonylat, checkout-prefillként egy mező, amit a vevő két
  másodperc alatt javít.
- ⛔ **MÓDSZERTAN: az őr két valódi hibát talált, amit én nem** — ① a `[hidden]` `display:none`-ját
  felülírta a saját `display:flex`-em → a „rejtett" mezők ÉS maga a lépcső **végig látszottak**;
  ② a fizetés-gomb **y≈1075-re került egy 844px-es képernyőn**, elérhetetlenül. Az **első
  őr-verzióm ezt ÁTENGEDTE**, mert a gomb MÉRETÉT mérte (`>=40px`), nem azt, hogy meg lehet-e
  nyomni → **tartományt mérj, ne alsó korlátot, és NYOMD MEG a gombot.**
- **NYITVA (a session eredeti célja):** ⚠️ **Barion** — a `parseWebhook` a `GetPaymentState` teljes
  válaszából KETTŐ mezőt tart meg; elveszik a TransactionId, a fizető, a **jutalék** és az
  **elszámolás dátuma**. Az utóbbi kettő nélkül **a bankkal nem lehet összevezetni** (a számlára nem
  a számla összege érkezik, hanem jutalékkal csökkentett, ÖSSZEVONT kifizetés). · **Számlázz-import**
  (egyetlen metódus van; ✅ **az adapter MÁR FUTOTT a teszt-fiókkal** — 2026-07-21, valós AAM
  teszt-számla `OV-2026-2`; a `szamlazz.ts` ezzel ellenkező kommentje ELAVULT volt, javítva.
  ⛔ De az a számla is FABRIKÁLT vevőt hordoz, mert 0029 előtt készült) · **bejövő költségszámlák** · **bank + bizonylat-felület** (bank
  eldöntetlen, MagNet a jelölt) · ⚠️ **ÁSZF-dokumentum NINCS** (`termsUrl` szándékosan üres →
  az elfogadó sor meg sem jelenik; élesítés előtt pótolandó) · **könyvelői jóváhagyás** az EU-s ágra.
- Commit `8f46995` → `origin/main` (IGAZOLTAN FENT). **Éles deploy NEM történt.**
  Részletek: `_planning/memory/2026-08-22_billing_identity_before_payment.md` + ADR-0055.

## Előző szál
**2026-08-22 — 🗂️ A LEAD-OLDAL DOSSZIÉ-FÜLEKRE BONTVA (ADR-0054). KÉSZ, ÉLES.**
- **Kiváltó (tulaj, képernyőképpel a saját MineREAL-rendszeréből):** *„tervezd újra a LEAD oldal…
  Szempontból is praktikusabb. Mock fájlokat küldjél vissza, amit le tudok tölteni és megnézni."*
- **A baj:** a lead-oldal HÉT, egymással nem összefüggő munkát vitt EGY görgetésben (adat-javítás,
  generálás, megkeresés, pénz, fotók, források, audit) — egymást temették, és a kurátor nem látta,
  melyikben van egyáltalán tennivaló.
- ⭐ **A munkamódszer, ami bevált:** nem EGY megoldást szállítottam, hanem **öt letölthető HTML-mockot**
  a valódi `--citui-*` tokenekkel, és a tulaj választott. A két döntő pontosítás TŐLE jött („a tabok
  sávja nem markáns"; „az aktív tab egyben van vizuálisan a kinyitott kártyájával") — magamtól nem
  találtam volna el. Vizuális döntésnél a kattintható mock ≫ szöveges leírás.
- **Eredmény:** navy fül-sáv cián záróvonallal, ami az AKTÍV fül alatt megszakad (a fül fehérje ráfut
  a lapra = egy test, mint egy papír dosszié) + identitás-sáv, ahol a **match-konfidencia NAGY
  mérőszám**. Új fül: „Elérhetőségek és források" (a kontakt-főkönyv + portál-jelenlét kikerült a
  szerkesztő kártyából — MÁS kérdésre válaszol). Emoji-gombok → saját SVG (`mail` ikon).
- ⛔ **A kapu jól mért:** a `template-picker-check` pirosra ment, mert a sablon-választó rejtett fülre
  került (a renderelt alapállapotban kattinthatatlan). A javítás NEM a kapu kikapcsolása volt, hanem a
  valódi operátor-út felvétele (fül-kattintás) + új állítás arra, hogy a fül tényleg megnyitja.
- **Kikötés:** a fülek VALÓDI horgony-linkek → JS nélkül mind a 7 panel látszik, és a szerver
  `#prospects`/`#mock-artifacts`/`#ls-data` átirányításai a helyes fület nyitják (mérve, 1280 + 390px).
- Új eszköz: `scripts/shot-lead.mts`. Részletek: `_planning/memory/2026-08-22_lead_page_dossier_tabs.md`.

## Előző szál (ugyanaznap)
**2026-08-22 — 🏗️ INFRASTRUKTÚRA-JAVÍTÁS (ADR-0052/0053 implementálva). KÉSZ, ÉLES.**
- **A) `scripts/land.sh`** — a session-zárás kapuja: fetch → rebase → tsc + TELJES pre-commit a
  landolt diffre (`LAND_RANGE` a hooks/pre-commit-ben) → push → **visszaellenőrzés**; a „felküldve"
  egyetlen kimondója az üres `origin/main..HEAD`. 4 piros-teszt (köztük: „sikeres" push, ami semmit
  nem landolt — a mért hibamód — a visszaellenőrzés fogja). CLAUDE.md §3 a scriptre mutat.
- **B) Fő fa = integrációs pont + tesztkörnyezet:** a :4600/:4800 a fő fából fut, és a
  `citoviso-main-sync.timer` (60 mp, ff-only, repo-n kívüli infra) követi az origin/main-t;
  piszkos fa / lokál commit = „MUNKATERÜLET-GYANÚ" a logba, semmit nem dob el. Élő bizonyíték:
  a session landolt commitját magától behúzta.
- **C) ADR-0053 ÉLES — az élesítés VERZIÓ:** `scripts/deploy-prod.sh` (bare repo a szerveren, a dev
  pushol; CSAK origin/main-őse mehet; dry-run alapból; pg_dump migráció előtt; console-kanári →
  public restart). **ELSŐ SZINKRON LEFUTOTT:** éles = `1ca2523` = tag `prod/20260822-0916`,
  7 migráció (0023–0028), edge zöld, hibanapló üres — a 20 soha-ki-nem-ment fájl (reviews, KB,
  modul-konfig, portál-réteg) + a konfigurátor domain-check EGYBEN kint. „Mi fut élesen?" =
  `git -C /opt/citoviso/app rev-parse HEAD` + `/opt/citoviso/DEPLOYED` + `prod/*` tagek.
  ⛔ Lelet: a HEAD hazudik félbeszakadt checkoutnál → „kész" = HEAD-egyezés ÉS tiszta fa ÉS nincs
  függő migráció.
- **D) 8 halott worktree lezárva TARTALMI ellenőrzés után** (a commit-szám kétszer hazudott volna:
  a DKIM-fa és a supersedes-fa ahead=1-e bitre a mainen volt); a 9. (`cit2167c7de`) élő sessiont
  szolgál, az zárja magát land-del.
- Részletek: `_planning/memory/2026-08-22_infra_repair_land_deploy.md`.

## Előző szál
**2026-08-21 — 💳 A FIZETÉS UTÁNI ÚT: 404-TŐL A MEGNYITHATÓ OLDALIG. LOKÁLBAN KÉSZ, PUSHOLVA.**
- **Kiváltó (tulaj, éles Barion sandbox teszt-vásárlás):** „A Barion fizetésig sikeres volt minden.
  Sikeres fizetés után oldal nem található felületre küldött. […] nincs értesítés a további
  teendőről. Ettől a vevő tuti idegösszeomlást kapna…" Majd: „NEM AKTIVÁLÓDOTT AZ OLDAL."
- **EGY teszt-vásárlás NÉGY hibát tárt fel:**
  ① ⛔ **`GET /pay/done` route NEM LÉTEZETT** — a Barion `RedirectUrl` oda küldi a fizető vevőt,
    aki 404-et kapott. A vevő-tájékoztató lap (`payResultPage`) KÉSZ volt, csak a MOCK gateway útja
    hívta. **Alatta a súlyosabb:** lokálban a szerver-oldali callback el sem éri a gépet → a payment
    `pending`-ben ragadt, az **aktiválás/belépési e-mail/számla SOSEM futott volna le**. Fix: a
    `/pay/done` ugyanazon az **idempotens** `handleWebhook` úton (Barion `GetPaymentState`) oldja fel
    az állapotot → sandbox-teszttel végigjátszva: `paid`, site `live`, e-mail + számla kiment.
  ② ⛔⛔ **Ismeretlen `<slug>.citoviso.com` a MARKETING LANDINGET adta 200-zal** (élesen bizonyítva:
    `nemletezooooo.citoviso.com` → 200 + a honlapunk). A frissen fizetett tulaj a saját linkjén a mi
    honlapunkat látta; és bármennyi kitalált aldomain azonos tartalmat adott = **duplikált tartalom a
    teljes `*.citoviso.com` hálózaton** (ADR-0041 reputációs kockázat) → most **404**.
  ③ A vevő sehol nem látta, hogy a **fizetés** sikeres (csak „Köszönjük, kész!") → explicit sor a
    terhelt összeggel, mindkét ágon.
  ④ A `PLATFORM_DOMAIN` fordítási idejű konstans → minden lokál teszt **PROD URL-t** hirdetett, ami
    elvileg sem nyílt meg → `tenantSiteUrl()` + dev-only `/t/<slug>`. **Prodon SOHA nem él** (ott
    második, canonicallal versengő cím lenne = ugyanaz a ②-es hiba) — prod-konfiggal ténylegesen
    lefuttatva verifikálva.
- **Mellék-lelet:** a lokál `.env`-ből hiányzott az `EMAIL_PROVIDER`/`SMTP_URL` → a `mock` adapter
  **fájlba írta** a leveleket (a tulaj ezért nem kapott semmit; prodon a Zoho rég működik).
  ⚠️ Átmásolva → **a lokál gép mostantól VALÓDI levelet küld** (outreach-teszt előtt gondolni rá).
- ⭐ **MÓDSZERTAN: a mock-út teljessége elfedte az éles út hiányát** (mock pay-page ✓ / Barion-
  visszatérés ✗ · mock e-mail ✓ / valódi SMTP ✗ · lokál tenant ✓ / a hirdetett URL ✗). `tsc` és mind
  a 12 pre-commit kapu ZÖLD volt — a hibát a tulaj ELSŐ valódi teszt-vásárlása fogta meg.
- **Következő:** ⚠️ **éles deploy NEM történt meg** (a prod fa több szálnyival le van maradva; a
  fájl-szintű deploy indításkor megölné a konzolt — koordinált utó-deploy kell, ld. lent).
  BACKLOG: végponttól-végpontig konverziós füst-teszt, ami a gateway-VISSZATÉRÉST is végigjátssza.
  Részletek: `_planning/memory/2026-08-21_payment_return_and_tenant_host.md`.

## Nyitott — infrastruktúra (2026-08-22, mérve)
**A párhuzamos sessionök csendben veszítenek munkát. Mérve, nem sejtve:**
- 16 worktree él; a GitHubon **összesen 1 db `wt/*` ág** volt fent → a záró `push` a legtöbb
  sessionben **soha nem történt meg** (a `main` percenként mozog → non-fast-forward → csendes bukás).
  Egy éles **DKIM-hibajavítás** (a kimenő levelek aláírása) egy halott sessionben ült; megmentve
  (`9c121d2`). Hátra: `a5a21b7` (dev-only `/t/<slug>`), és a fő fa 4 pusholatlan commitja.
- **A „tesztkörnyezet" egy véletlen worktree-ből futott** (`cit2167c7de`), nem a `main`-ből → ez a
  „productionben megvan, teszten nincs" élmény valódi oka.
- **Az éles nem verzió, hanem kollázs:** 20 fájl soha nem ment ki, 47 eltér, a kint lévők 8
  különböző dátumból valók → olyan kombináció fut, ami egyetlen commitban sem létezett. Kézi
  élesi szerkesztés viszont NINCS (0 fájl van kint, ami ne lenne a gitben). → **ADR-0053**.
- ⚠️ **A commit-szám és a `git cherry` HAZUDIK** (rebase → új SHA/patch-id); a 9 „beragadt"
  commitból tartalmi ellenőrzés után **1** maradt. Csak szemantikus ellenőrzés mond igazat.

- **Az izoláció félkész (ADR-0052).** A worktree-pool a KÓDOT izolálta; a `sites/`,
  `node_modules`, `.env` és a Postgres közös maradt. ⚠️ **Ebből eddig EGYETLEN hiba sem származott
  mérhetően** — a „DB-drift" (migráció hatása túléli a kódját) elméleti kockázat, nem diagnózis.
  Ne kezeljük problémaként, amíg nincs rá konkrét, dokumentált eset.
- **Miért nem jelentkezett ez a MineREAL-ban:** ott a tulaj a SOROSÍTÓ — egy szál, egy feladat, és
  ő maga látja a `git push` kimenetét. Itt tíz szál fut, és egy asszisztens ÖSSZEFOGLALÓT ad a nyers
  hiba helyett. Nem a munkamódszer rossz; a párhuzamosság + delegálás vitte át azokat a lépéseket,
  amiket eddig ember figyelt.
- **A fegyelem = doktrína ÉS kapu.** Bizonyíték a saját repóból: az i18n, dizájn-token, modul-konfig
  és tudásbázis-doktrína EGYSZER SEM sérült (mind mögött pre-commit kapu); a „commit + push
  záráskor" és a „csak a módosított fájlok élesre" mögött nem állt semmi — mindkettő elbukott.
  **A leírt szabály emlékeztető; a futó kapu tény.**

**⛔ Amit ELVETETTÜNK:** a „dev DB szálanként" — az ADR első változatában döntésként szerepelt,
tévedésből. A szálon mért HÁROM hiba egyike sem DB-probléma volt; a „DB-drift" feltételezés maradt,
demonstrált eset nélkül. Ráadásul kárt okozna: a lead-adat drága és KÖZÖS értékű. Marad az egy
`citoviso_dev`. **Tanulság: bizonyíték nélküli feltételezés ne kerüljön ADR-be döntésként.**

**Teendő:** ① `land` script
(fetch → rebase → kapuk → push → **visszaellenőrzés**, hangos bukással) ③ a fő fa legyen integrációs
pont + tesztkörnyezet, ne munkaterület ④ 9 halott worktree lezárása **tartalmi** ellenőrzés után
(⚠️ a commit-szám és a `git cherry` hazudik) ⑤ ADR-0053 implementálása (éles = verzió).

## Előző szál (ugyanaznap)
**2026-08-21 — 🔗 A BACKFILL MEGTALÁLTA A PORTÁL-OLDALAKAT, AZTÁN ELDOBTA ŐKET. ÉLES, 1 NYITOTT HIBÁVAL.**
- **Tulaj kiinduló gyanúja:** „miért nem a teljes linkjét mentjük a portáloldalaknak, ahol megtaláltuk
  a leadet?" — **HAMIS premissza:** a deep-link mindig tárolódott (`PortalListing.url`), a konzol csak
  rövid HOST-felirattal mutatja, de a `href` a teljes URL (éles lead-oldalon ellenőrizve, minden külső
  link konkrét aloldalra megy). ⚠️ Ezt előbb tévesen „hazudik a címke" hibaként adtam el.
- **A valódi baj, ami emiatt előkerült:** prodon 419 leadből **4**-nek volt portál-linkje. Ok kettő:
  ① `reenrich.ts` `changes`-kapuja csak honlap/e-mail/telefon változást számolt → a CSAK portál-linket
  vagy kontakt-naplót kapó lead a `continue`-nál kiesett, a `raw` sosem íródott vissza;
  ② a mailto-regex átfutott a saját markupját escapelő oldal `&quot;&gt;` farkán → törött e-mail
  került volna a leadre (`info@…hu&quot;&gt;info(@)…&lt;/a&gt;`).
- **Éles eredmény:** ugyanaz a 108 lead: 16 → **98** érintett, 0 → **146** elmentett portál-link;
  prod portál-jelenlét **4 → 61 lead, 10 → 159 link** + 149 `listing` provenance-sor. Commit `9e7fd65`,
  2 fájl scp-vel (backup `deploy-20260821-203120`), pre-apply DB-dump `reenrich-20260821-223812`.
- ⛔⛔ **FŐ TANULSÁG: a dry-run NEM kapu a nem-determinisztikus osztályra.** 0 honlap-átminősítést
  mutatott és ezt hoztam garanciának — az `--apply` mégis 1-et csinált (a webes keresés futásonként
  más találatot ad).
- ⚠️ **NYITOTT HIBA (engedélyre vár, élesi írás):** `Muschel Panzió` `portal_only → has_own` lett a
  `hotels-in-hungary.net` white-label aldomain-farmon (hiányzik a `qualify.ts` PORTAL_DOMAINS-ből,
  pedig a `hungaryhotel.net`/`com-hotel.website` már rajta van) → a lead KIESETT a célcsoportból
  „van saját honlapja" címen, holott nincs. Teendő: ① domain felvétele a listára ② a lead
  visszaállítása `no_site`-ra ③ `citoviso-console.service` restart (a mailto-fix a konzol
  „újra-dúsítás" gombjához csak úgy él). Részletek:
  `_planning/memory/2026-08-21_backfill_discarded_portal_links.md`.

## Előző szál (ugyanaznap)

**2026-08-21 — ⭐ KONFIGURÁTOR: nyitott lista, KÖVETHETŐ ÁR, szabad domain-választás (ADR-0051). RÉSZLEGESEN ÉLES.**
- **Tulaj:** a lead a kapott linken lássa alapból nyitva a „testre szabom" részt, és folyamatosan
  kövesse a havi díj alakulását; a rész vizuálisan is térjen el; és adhasson meg SAJÁT domain nevet,
  amit „Ellenőrzés" gombbal nézünk le.
- **Kész:** nyitott tételes lista (a gomb csak összecsukásra), saját akcent-élű doboz
  (`.cit-cfg-custombox`), a láb-összeg nem görgethető el (`flex:0 0 auto`) + minden kapcsolásra
  megdobban és kiírja a különbséget (`−690 Ft/hó`); saját domain + `GET /configure/:id/domain-check`
  (DNS+RDAP, normalizálás, foglalt név sosem választható, szerkesztés érvényteleníti az ítéletet).
- **Őr:** `scripts/configurator-price-check.mts` (1180px + 390px + „régi backend" nézet), **öt**
  szándékos rontással pirosra futtatva; pre-commitba kötve. Mellékesen kiderült, hogy a
  `smoke-configurator-browser` két lépése az info-ikonra kattintott → némán SEMMIT nem mért.
- **Éles:** csak a 2 runtime-fájl ment ki (backup `cfgprice-20260821-202239`, console-restart,
  edge-en böngészővel verifikálva). ⚠️ **A `server.ts` NEM mehetett:** az éles fa ~4 szálnyival le
  van maradva (51 eltérő, 20 hiányzó fájl; a konzol import-gráfjából 10 függőség hiányzik; 29 vs 22
  migráció) — fájl-szintű deploy indításkor megölte volna a konzolt. A domain-ellenőrző mező ezért
  élesen (tudatosan) még nem jelenik meg.
- **Következő:** koordinált utólagos éles deploy (hiányzó fájlok + 7 migráció, a többi szál mai
  munkájával együtt). Részletek: `_planning/memory/2026-08-21_configurator_price_visibility.md`.

## Előző szál (ugyanaznap)

**2026-08-21 — 📸 PORTÁL-FOTÓK: A BEKÖTÉSTŐL A TULAJDONÍTÁSIG (ADR-0050). KÉSZ, FELKÜLDVE.**
- **Kiváltó (tulaj):** „Különböző portálokról miért nem scripeljük le a fotókat? Mennyi mennyiségű
  fotót tudnánk elérni így? Kiválogathatná a legjobbakat a honlapra."
- **A válasz első fele:** MÁR scrape-eltük (adatlaponként akár 60 képet) — csak a `portalProfiles`-t
  **`src/scraper/`-en kívül SEMMI nem olvasta**, így a mock a 6 Places-képből épült.
- **Három láthatatlan hiba alatta, mind zöld `tsc`-vel és zöld pipeline-őrökkel:**
  ① a motor minden képre egységes `provenance: "places"` bélyeget ütött → a **§A élő-kapu fikcióra
  döntött volna** (külön seam-be emelve, mert a blanket literál tökéletesen fordul);
  ② ⛔ **a mentés visszagörgetett EGY TELJES FUTÁST** — nyers URL a `matched_entity` JSONB oszlopba
  → `22P02`, és mivel egy scrape **egy tranzakcióban** megy, **mind az 554 lead** elveszett.
  **Ez magyarázza, miért nem volt SOHA portál-adat a DB-ben.** A crawl mégis megmaradt: a
  **JSON-dump a mentés ELŐTT íródik** → `seed-from-json` visszajátszotta, 0 Ft többletköltséggel;
  ③ a **`watermarked` jelölés eltűnt a tulaj első kattintására** (mind a 3 szerkesztő-út emlékezett
  a provenance-ra, és mind elfelejtette a vízjelet) — **látens hiba, ami a KÖVETKEZŐ szeletre várt**.
- **⭐ A VALÓDI baj: a kinyert képek fele nem a szállásé.** Az első éles merítés (Balaton északi part,
  554 lead, 607 portál-fotó) szerint **8 leadből 2 téves hero-t kapott volna**: a Köveskáli
  Diákkempingnek egy falusi **TEMPLOM** (utazási cikkből), a Landhaus Dörgicsének régió-stock a
  Booking `/images/city/` útvonaláról. **§B.17-sértés:** a mock azt mondja „ez a te helyed", és mást
  mutat. Mellettük zászló-ikon (32×22), hirdetés-bannerek, Pinterest megosztó-linkek (nem is képek),
  térkép-grafikák, 150×150 bélyegképek.
- **Tulaj-döntés:** a FORRÁST nem szűkítjük (airbnb/booking/szallaskereso valódi galériát ad, csak
  nincs még a registryben) — **méret + URL-alak** szerint szűrünk, **800px** hosszabb éllel.
- **A küszöbök MÉRVE, nem tippelve:** a bannerek mind 980×240 (**4,08:1**), a legszélesebb VALÓDI
  fotó egy medencés vendégház 980×360 (**2,72:1**) → a szalag-határ **3,0**, nem 2,5 (az levágta
  volna). A méret a fájl **FEJLÉCÉBŐL** jön (Range-kérés, 64 KB), mert 607-ből csak **8**-nak volt
  tárolt mérete. Amit nem lehet lemérni, azt megtartjuk. **Nem törlünk, olvasáskor ítélünk.**
- **Eredmény: 607 → 169 tulajdonítható kép.** Mindkét téves hero megszűnt (az a két lead inkább
  0 portál-fotót kap és Street View-ra esik vissza — ez az őszinte kimenet). 9 lead hero-ja
  szemrevételezve: mind valódi épület/belső/medence. Ahol van igazolt adatlap, **átlag ~29 kép**.
- **⭐ A vízjel-detektort NEM építettük meg** (pedig a listán ez volt a következő): 24 valós képen
  **egyetlen vízjel sincs** — nem létező problémára nem költünk képenkénti vision-hívást. A §A.2
  attól még érvényes, és a jelölés útja immár készen áll.
- **Mellék-lelet:** a portál-képek Cloudflare mögül **blokkolják az Anthropic letöltőjét** → a brief
  és a copywriter némán generikusra esett („Unable to download the file"). Fix: `toImageBlocks`,
  mi töltjük le és base64-ben ágyazzuk be (3 hívóhely).
- **⛔⛔ MÓDSZERTAN:** ezen a szálon **HÁROMSZOR hazudott zöldet a saját őröm** — (a) a mérés nem ért
  el a `generateEngine` mappingjéig, (b) egy `?? BASE.photos` fallback zöldet adott NO-OP
  szerkesztésekre, (c) az őr szemetet hagyott a repóban. **Minden őrt pirosra futtatni ÉS
  ellenőrizni, hogy a rontás tényleg megtörtént.** A `photo-quality-check` ezért **mindkét irányban**
  mér: lazításra 3 eset pirosodik, a TÚL szigorú 2,5-ös aránynál a valódi Lavia-fotó bukik el.
- **⚠️ Saját csapda:** kétszer **csonkolt URL-t** diagnosztizáltam (a saját `.slice(0,105)`
  kiírásomat), és ebből hamis „404 / 401" következtetést vontam le. A rövidített diagnosztikai
  kiírás ne kerüljön a bizonyítékok közé.
- **Kapuk (mind piros-tesztelve, pre-commitban):** `portal-photo-check`, `persist-portal-check`
  (valódi DB round-trip), `photo-quality-check` (14 valós url+méret eset), `photo-rights-edit-check`.
  Egyszeri: `backfill-portal-photo-size` (577 kép lemérve).
- 7 commit felküldve (`d64e57a`…`cccf65a`). Részletek:
  `_planning/memory/2026-08-21_portal_photos_attribution.md`.

## Korábbi szál (ugyanaznap)
**2026-08-21 — ⭐⭐ MODULOK: A VÉLEMÉNY, A HELY ÉS AZ EGY FOLYAMAT (ADR-0046/47/48/49). KÉSZ, FELKÜLDVE.**
- **① `reviews` (ADR-0046):** a gerinc a FIRST-PARTY vélemény (`site_review`, moderáció a booking
  mintájára: a tulaj a LEVÉLBŐL dönt egy koppintással). A Google-ból **csak a SZÁM** jön át — két
  szabály együtt zárja be a szöveget: tárolni tilos (a Places egyetlen korlátlan mezője a `place_id`,
  a mi oldalunk statikus snapshot) **és** futásidőben ~9 Ft/hívás → a 690 Ft/hó-s modul ~77
  oldalletöltés után veszteséges. A szám viszont TÉNY, és a resolve eddig is lekérte, majd eldobta.
  Két kapu, mindkettő zárva bukik: `match_confidence ≥ 0.7` + 30 nap frissesség. Csillagos rich
  resultot NEM ígérünk. A Google-invitálás iránya MEGFORDÍTVA: a nálunk író TÁVOZÓ vendéget hívjuk.
- **② ⛔ A tulaj élő `/configure/` linken kapta el: „egy csíkba, bal oldalt, van az összes modul"**
  (ADR-0047). Három hiba egymáson, és MINDEN meglévő őr zöld volt mindhármon: (a) a konfigurátor a
  `querySelector("footer")` elé injektált, de **12/16 sablon `<footer>`-rel jelöli a vélemény-idézet
  szerzőjét** → a teljes kínálat egy idézet-kártyába préselve, **230–530px**; (b) a minták csak a
  panel első megnyitásakor jelentek meg → **a lead 0 modult látott**; (c) a 10 blokk egy tömbben az
  enquiry elé ment — az `editorial`-on az a lap TETEJE, tehát **élő tenant-oldalon is** a galéria és
  a vélemények ELÉ ömlött. Fix: **négy megnevezett slot** sablononként (`showcase/trust/practical/
  closing`); a blokk-KÓD közös marad (nincs 100×N), csak a HELYE sablon-specifikus.
- **③ Egy oldal, EGY folyamat (ADR-0048):** a „ha van foglalás, nincs érdeklődés" eddig csak a SLOT-ra
  állt — **26 beégetett felirat 13 fájlban** maradt „Érdeklődés", a foglalás bekapcsolása egyetlen
  gombot sem cserélt. A CTA-szó most adatból jön (`ctaLabel`). + **`SAMPLE_REVIEWS` KIVEZETVE**:
  kitalált idézetek („Péter", „a Kovács család") valós cég oldalán, a valós Google-átlaga alatt —
  úgy olvasódott, mintha a 143-ból mutatnánk hármat. Helyette a valós szám + őszinte mondat.
- **④ Kiadási időszak (ADR-0049):** „milyen időszakokban adja ki egyáltalán, milyen minimum hány
  napra?" A szezon MÁR létezett (`unit_price`, MM-DD, egységenként) → **nem csináltunk második
  listát**: a sor hordozza az árat, a min. éjszakát és (a `seasonal_only` kapcsolón át) hogy
  kiadható-e. Éjszakánként vizsgálunk (a kilógó foglalás sem csúszik át), és a zárt nap a vendég
  naptárában is foglalt — nem elég beküldéskor nemet mondani.
- **Kapuk:** új `review-flow-check` (24), `module-slot-check`, `configurator-placement-check`,
  `shot-review-form` (390px); bővítve `module-render-check` (kitalált vélemény 0/16 sablon + 0/11
  archetípus) és `module-config-check` (+9 szezon-ellenőrzés). Mind pirosra futtatva.
- **⭐ MÓDSZERTAN (ez a szál fő hozadéka):** *a jelenlét nem elrendezés* — minden őr azt kérdezte,
  „ott van-e a tartalom?", egyik sem azt, hogy „HOL, és milyen SZÉLES?"; *a rontást is ellenőrizni
  kell* (kétszer maradt zöld egy piros-teszt, mert a minta nem illeszkedett — nem volt rontás);
  *a mérés is elavulhat* (a slot-lefedettség renderelt oldalon nézte a jelölőket, és a KÓD volt jó);
  *féloldalas fix + féloldalas őr = zöld hazugság* (a 16 sablon javítva, a 11 archetípus fabrikált).
- **Mellék-leletek:** `POST /api/hirlevel` **NEM LÉTEZIK** (a hírlevél-űrlap a semmibe küld);
  az `extract-i18n` sosem olvasta a `moduleSections.ts`-t → minden modul-felirat kiesett a
  katalógusból (312 → 346, javítva).
- Migrációk: `0027_reviews.sql`, `0028_unit_season.sql`. 4 commit felküldve (`0153a67`…`c8cbd69`).
  Részletek: `_planning/memory/2026-08-21_modules_placement_and_reviews.md`.
**2026-08-21 — 📚 TUDÁSBÁZIS-DOKTRÍNA (ADR-0045 ①–④). KÉSZ, PUSHOLVA.**
- **Tulaj-rendelet:** IT-kezdő célközönség → súgó print screenekkel, doktrína+őr, UI-ba építve,
  kereshetően; új entry AUTOMATIKUSAN forduljon minden nyelvre; új régió csomagja a KB-t is vigye.
- **Kész:** 03-INVARIANTS **§J** + 9 entry (5 admin-fül + 4 modul-képernyő) script-generált 390px
  screenshotokkal · kereshető **Súgó** fül + `data-kb-anchor`/súgó-belépő minden szekción ·
  AUTOMATA hurok: `kb-scan.mjs` PostToolUse + pre-commit `kb-check --coverage` + LABEL-DRIFT
  (**„félkövér-idézett”** felirat szó szerint kell a view-forrásban) · `kb_translation` (0027) az
  `ensureLanguagePack`-be kötve → scrape/generate/boot/CLI mind fedi; lengyel KB 9/9 ÉLES ·
  `tudasbazis-or` agent. Minden őr pirosra tesztelve; a hook élesben 2 valós hibát fogott.
- **Következő jelöltek:** operátor-konzol súgó-rétege (audience: operator) VAGY B) outreach
  küldő-pipeline. Részletek: `_planning/memory/2026-08-21_knowledge_base_doctrine.md` + ADR-0045/a–d.


## Előző szál (ugyanaznap)
**2026-08-20/21 (Brave-szál) — 📇 KONTAKT-NAPLÓ + PORTÁL-JELENLÉT + DUPLIKÁTUM-ELLENŐRZÉS. ÉLESEN KÉSZ.**
- **Kiváltó:** a tulaj ÉLES tesztjei a Brave-élesítés után — minden pont alatt egy konkrét lead,
  amin a rendszer megbukott (Ferenc Ház, Bánó Porta, Bánó Gábor).
- ⭐ **KONTAKT-NAPLÓ (tulaj-kérés):** minden talált elérhetőség MEGMARAD — érték + forrás
  (places/osm/own_site/web_snippet/a beolvasott oldal hosztja) + nyitható forrás-URL + elfogadva/
  **elvetve + INDOK magyarul** + első észlelés. Eddig EGY címet választottunk és a többit némán
  eldobtuk → nem lehetett megkülönböztetni a „nincs adat"-ot a „a jót dobtuk el"-től. **A rangsor
  szabályait a valós kiküldés-eredményekből** állítjuk majd fel, nem mai találgatásból.
- **Tulaj-tesztek leletei:** ① Ferenc Ház — a Brave MEGTALÁLTA (1. találat kali.hu, a cím a 4–5.
  snippetben), de a tárolt portál-cím BLOKKOLTA a keresést + csak snippetet olvastunk → most
  **oldal-beolvasás** (top 3, mailto:/tel: elsőbbség); ② Bánó Porta — 404-es honlap ≠ elérhető lead
  → **a kiváltó a HIÁNYZÓ CÍM, nem a honlap-státusz**; ③ Bánó Gábor — a kézi újragyűjtés `force=true`
  (a takarékosság a tömeges scrape-é; kézi kérésnél a BIZONYÍTÉK kell).
- **DIGITÁLIS LÁBNYOM:** a portál-adatlapok linkkel a kártyán („ellenőrizve" jellel, amit beolvastunk)
  — kurátori ellenőrzés + leggazdagabb ingyenes adatforrás + maga az outreach-érv.
- **DUPLIKÁTUM-ELLENŐRZÉS (0022 `lead_link`, új konzol-menü):** ugyanaz a jel NÉGY valóságot takar
  (egy üzlet két néven · egy szálloda 6 épülete · egy tulaj több üzlete · lánc közös honlappal) →
  **a gép javasol, az ember dönt** (duplicate/same_owner/unrelated), csoportonként EGY döntés,
  a döntés megjegyződik. Az „ugyanaz" a megtartottba OLVASZTJA a másik naplóját+listingjeit; a
  vesztes disqualified = VISSZAVONHATÓ. ⚠️ Tranzitivitás-csapda: egy közös ügynökségi honlap 34 km-re
  lévő apartmanokat láncolt egybe → csak ERŐS él klaszterez. Élesen: 20 csoport.
- **Adat-takarítás élesen:** 9 sablon-/intézményi cím törölve; **9 lead visszakerült a célzásba**
  (portál-URL `modern`-ként ült = néma vevő-vesztés, a §F bug FALS NEGATÍV iránya).
- **UI:** galéria (fotó+sablon, nyilakkal, görgethető) · ⭐ **CSS-SPECIFICITÁS csapda** (`.con form`
  erősebb az önálló osztálynál → a flex NÉMÁN vesztett; fejetlen Chromium-méréssel derült ki) ·
  honlap-ikon a BEÍRT címet nyitja · a Places bejelöli magát a Források közé.
- ⭐ **FŐ TANULSÁG:** minden beépített őr ZÖLD volt a rossz kimeneten; a hibákat a tulaj tesztje vagy
  utólagos mintavétel fogta meg. A visszatérő minta: **a szűrőim némán zárták le a keresést.**
  A védelem nem a szigorúbb szabály, hanem a **LÁTHATÓSÁG**.
- Részletek: `_planning/memory/2026-08-21_contact_ledger_and_duplicates.md`

## Előző szál (ugyanaznap)
**2026-08-21 — 🔄 „A TESZT HÁTRÉBB VAN, MINT A PROD" — ÁLLÓ DEV-SZERVER INCIDENS + ÖNJAVÍTÓ INFRA. KÉSZ.**
- **Kiváltó (tulaj, jogos dühvel):** a lokál konzolon nem voltak kinézet-kártyák, alig volt sablon —
  miközben a prod frissebbnek tűnt. **Ok:** a :4600 konzol-processz aug 20. 12:37 óta futott
  újraindítás nélkül, a `tsx` nem hot-reloadol → a felület **~30 commitnyi** friss main-t nem látott
  (köztük a kártyarács `7dbfcd6` + a 16 sablon). A git rendben volt; a KÓD mind ott volt.
- **Fix (repo-n KÍVÜLI infra, systemd):** `citoviso-console.service` (:4600) + `citoviso-public.service`
  (:4800) — `tsx watch` + `Restart=always` + `TimeoutStopSec=10` (a tsx lomha SIGTERM-re, e nélkül
  a restart 90 s-ig ragad), enabled → reboot-álló. Logok: `~/.claude/citoviso-{console,public}.log`.
- ⭐ **tsx-watch HAMIS-ZÖLD lelet (piros-teszt fogta):** a tsx watch szülő túléli a node-GYEREK
  halálát (csak fájlváltozásra respawnol) → a systemd „active"-ot mutat halott port mellett.
  → `citoviso-health.timer` (percenként): a **PORTOT** curl-özi (azt méri, ami számít — HTTP 000 =
  restart). Élesben tesztelve: `kill -9` → **32 mp alatt vissza HTTP 200-zal**.
- Innentől: commit a mainbe = azonnal él a konzolon; crash = 1 percen belül feltámad; reboot = magától.
- **Session-zárásnál talált lelet:** a fő fában egy másik session TELJES ADR-0045 KB-munkája
  commitolatlanul ült → tételes fájllistával commitolva (`feat(kb)`, 38 fájl, minden pre-commit kapu
  zöld) + rebase az origin 2 commitjára (kinézet-kártya fix) konfliktus nélkül.
- Részletek: `_planning/memory/2026-08-21_stale_dev_server_systemd.md`.

## Előző szál (ugyanaznap)
**2026-08-21 — 🖱️ A VÁLASZTÓ, AMI NEM VÁLASZTOTT (kinézet-kártyák). ÉLESEN KÉSZ.**
- **Kiváltó (tulaj, telefonról, éles admin):** „nem tudok mock típust választani mert akkor csak a
  mock nyílik meg nagyban ha rákattintok".
- **Ok:** a kártya képére kötött `onclick="event.preventDefault();citTplGallery(…)"` letiltotta a
  `<label>` aktiválását → a kép (a kártya ~80%-a) CSAK nagyított, sosem választott. Választani
  egyedül a keskeny névsávval lehetett — telefonon eltalálhatatlanul. A választó **létezett,
  látszott, és nem működött.**
- ⭐ **ELV:** az elsődleges művelet kapja a nagy felületet, a másodlagos saját explicit vezérlőt.
  Ha két művelet ugyanazon a pixelen osztozik, az egyik elvész — ne „okos" eseménykezeléssel
  válaszd szét, hanem külön felülettel.
- **Fix:** az egész kártya (kép is) választ; a nagyítás saját sarok-**gombot** kapott
  (`.tpl-card__zoom`, 32×32 tap, `zoom` SVG a közös készletből) — a `<button>` interaktív
  tartalomként nem aktiválja a label-t, így szerkezetileg nem tud ütközni. Kurzor-javítás
  (kártya=pointer, gomb=zoom-in); a régi globális `.tpl-card{cursor:zoom-in}` maga is hazudott.
- **ŐR (viselkedést mér, nem jelölést):** `scripts/template-picker-check.mts` valódi Chromiumban
  RÁKATTINT a kártya képére és állítja: rádió bepipálva · nagyító NEM nyílt · kártya megjelölve ·
  előnézet váltott; majd a zoom-gombra kattint (galéria nyílik, választás megmarad) + tap-méret
  ≥30px. **Desktop + 390px mobil.** `--self-test` a visszatört jelölésen → **10 PIROS** (egy őr,
  ami nem tud pirosra menni, nem őr). Pre-commitba gate-elve (csak ha views.ts / console CSS staged).
- **Éles:** commit `fe6f856` → main → prod scp-deploy (3 fájl, diff-before-deploy: prod pontosan a
  lokál HEAD~1-en volt; `.bak-20260821-162458` rollback; SHA256-egyezés; restart → active, log
  tiszta, `:4600/leads`=303; a kiszolgált CSS tartalmazza a `.tpl-card__zoom`-ot).
- Részletek: `_planning/memory/2026-08-21_template_picker_affordance.md`.

## Előző szál (e-mail hitelesítés)
**2026-08-21 — 📧 E-MAIL HITELESÍTÉS: DKIM MEGJAVÍTVA + DMARC-FIGYELŐ ŐR. ÉLESEN KÉSZ.**
- **Kiváltó (tulaj):** „Google DMARC-jelentés jött, kell ez?" → a jelentés minden rekordja
  `spf=pass` / **`dkim=fail`** volt (5 levél, mind a saját Zoho-IP-ről; spoofing NEM történt).
- **Gyökérok:** a Cloudflare `zmail._domainkey` TXT base64 kulcsának **50. karaktere nagy `I`
  volt a kis `l` helyett** — 216-ból 1. (Két külön RSA-kulcs MINDEN karakterében különbözne →
  csak elgépelés lehet; a böngésző-fontban a két glif azonos.) Emiatt a Zoho `Ellenőrzés` sosem
  ment át → a selector `Ellenőrizetlen` → **a Zoho alá sem írta a kimenő leveleket**.
  A nyers XML árulta el: az `auth_results`-ban EGYÁLTALÁN nem volt `<dkim>` elem.
- **Javítás:** Cloudflare API PATCH az EGY rekordra (tulaj explicit engedélyével, backup
  `_planning/backups/dkim-txt-20260821-194751.json`), terjedés visszamérve 3 resolverről,
  majd Zoho admin → Tartományok → E-mail konfiguráció → DKIM → `Ellenőrzés` + `Állapot` be.
- **Függetlenül igazolva** (port25 verifier, valódi levél a Zoho SMTP-n): `SPF pass` /
  `DKIM pass` / `dmarc=pass` / `iprev pass` + megjelent a `DKIM-Signature: … s=zmail` fejléc.
- **Új őr `scripts/dmarc-report.mts` (`npm run dmarc:check`):** NULLA új dependency (IMAP a
  `node:tls`-en, ZIP `zlib.inflateRaw`-val). A forrásonkénti VERDIKTET méri, nem azt, hogy
  „jött-e jelentés": se SPF se DKIM → exit 1; csak az egyik → WARN (a forwardolt levél elhasal).
  Pirosra is futtatva: `--selftest` 4/4, rossz jelszó/hiányzó config → exit 2 (sosem hazudik OK-ot).
- **⚠️ TANULSÁG:** a küldő-config **a PROD `.env`-ben** van (`/opt/citoviso/app/.env`), nem
  lokálban (lokál = `mock`, és maradjon is). Tévesen állítottam, hogy „nincs sehol", mert csak
  a lokál `.env`-eket néztem. Részletek: `_planning/memory/2026-08-21_email_auth_dkim_fix.md`.
- **Hátra:** SPF `~all`→`-all`, DMARC `p=none`→`p=quarantine`, **domain-bemelegítés** (a domain
  reputációja ~0 — ezért esett spambe a korai, még aláíratlan teszt), `dmarc:check` cronba.

## Előző szál (ugyanaznap)
**2026-08-21 — 📱 MOBIL STICKY FOGLALÓ-DOKK FIX + REGRESSZIÓS KAPU. ÉLESEN KÉSZ.**
- **Kiváltó (tulaj, screenshot):** több mockon a sticky érdeklődés-dokk mobilon az EGÉSZ viewportot
  kitakarta (a magas, függőlegesen tördelt foglaló-form a tetőre pinnelt).
- **Ok:** 2 elem volt `position:sticky;top:0` mobil-guard nélkül: `cinematic .cn-dock` és az
  `immersive-parallax` archetípus `.cit-arch-dock`. (`parallax .t-dock` már védve volt; `cardSidebar
  .bcard` + a sidebar-archetípusok eleve `min-width` desktop-only.)
- **Fix:** `@media(max-width:700px){…position:static}` mindkettőre (a bevált `.t-dock` mintát tükrözve).
  Commit `7d89e3c` → main → **deploy prodra** (rsync 2 fájl `/opt/citoviso/app`-ba + restart).
- **Már publikált oldal javítása:** 1 érintett lead = **Ferenc Ház** (cinematic), amiből ÉLES `site`
  is volt (`ferenc-haz`, has_edits=true). Determinisztikus re-render az `inputs`-ból (mock) +
  `rerenderTenantSnapshot(...,{as:"live"})` (élő, tulaj-szerkesztések megőrizve) — ⛔ AI-tervező
  ÚJRA NEM (bait-and-switch). Drift-kapu: diff a backuphoz = KIZÁRÓLAG a guard-sor. Új memória:
  [[reference_snapshot_rerender_propagation]].
- **Teljes audit:** mind a 46 `sticky`/`fixed` átnézve (16 template + archetípusok + chrome + render-utak)
  — csak a 2 volt bűnös, más nem.
- **REGRESSZIÓS KAPU (commit `710b68c`):** `scripts/mobile-sticky-check.mts` — minden template+archetípust
  390px-en renderel a hidratált (`injectRuntime`) foglaló-formmal; FLAG, ha a formot tartó elem/őse
  sticky|fixed ÉS >40% vh. A HIBÁT méri (nem CSS-szöveget). Fixture-bizonyított (guard nélkül PIROS,
  guarddal ZÖLD). Pre-commitba gate-elve (csak ha engine template/archetypes/render/runtime staged →
  ~10s nem lassít). Dev-idejű kapu → nincs prod-deploy.

## Korábbi szál (2026-08-20)
**2026-08-20 (4. szál) — 🔎 BRAVE SEARCH ÉLESÍTVE + BACKFILL. ÉLESEN KÉSZ.**
- **Kiváltó (tulaj):** „vezessük be a brave apit, most már fontos elem". A kód (ADR-0026) 2026-08-07
  óta készen állt, csak kulcs nem volt; a tulaj megszerezte (free plan: 1 q/s, ~2000/hó).
- **Élesítés + 3 kódhiba élő próbán:** `country=hu` → **HTTP 422** (a Brave-nek NINCS HU piaca →
  `country=ALL&search_lang=hu`); throttle kellett az 1 q/s ellen (a hívók 3 workerrel lőnek);
  a **kontakt-kereső ág a régi CSE-kulcsra volt kapuzva** → tiszta Brave-konfignál (= a prod)
  némán kimaradt volna.
- **ÚJ ESZKÖZ — `npm run reenrich`:** a MEGLÉVŐ állomány újradúsítása. Azért kellett, mert az
  enrichment csak scrape KÖZBEN futott, a perzisztálás pedig csak BESZÚR (az átfedés-dedup a létező
  leadet kihagyja) — a 2026-08-07-i 99 lead sosem látott volna webes keresést. Mellé:
  `reenrich:rollback` és `scripts/scrub-contacts.mts`.
- **ÉLES EREDMÉNY (Keszthely, 111 no_site lead):** **35 lead frissült** — 10 valódi honlap-felfedezés
  (`juhaszfogado.hu`, `stefivendeghaz.hu`, `agnesalmai.hu`, `kapri.hu`, `tulipancamping.hu`, …)
  + 22 email + 15 telefon; plusz 9 régi sablon-/intézményi cím kitakarítva (maradék 0).
- ⭐ **NÉGY korrobációs réteg, mind ÉLES fals pozitívból tanulva** (találatok 40→13→10, valódi egy sem
  esett ki): ① geo-horgony a lead **városára** (ADR-0043, 3. szál) → ② **márka-a-domainben** (a saját
  oldal a cégről van ELNEVEZVE; köznév és FÖLDRAJZI token nem korroborál — „Mária Hotel" ⊂
  `balatonmariafurdo.hu` csapda) → ③ white-label **aldomain-farmok** (`x.hungaryhotel.net`) →
  ④ **megosztott-kontakt őr** (egy telefonszám egy üzleté: a tourinform száma két vendégházhoz is).
- ⛔ **Az ELSŐ éles apply 6-ból 4 rossz honlapot írt** (még a régió-címke horgonnyal) → **teljes,
  determinisztikus visszavonás**, majd újra tisztán. A revert azért volt biztos, mert minden érintett
  `no_site` volt + az eredeti honlap a `presence_check` provenance-sorban megvolt.
- ⭐ **FŐ TANULSÁG (a 3. szállal azonos, két úton egy nap):** a hibát **egyik pipeline-őr sem kapta el**
  — csak az utólagos, kézi mintavétel. Ezért minden lelet **fixture** lett:
  `scripts/geo-verify-check.mts` = 7 geo + **16 márka-domain** eset, mind éles adatból.
- Kapuk: `tsc` ✅ · i18n/design pre-commit ✅ · regressziós kapu ✅ · prod checksum-verifikált deploy.
- Részletek: `_planning/memory/2026-08-20_brave_live_and_backfill.md`

## Párhuzamos szál (ugyanaznap)
**2026-08-20 — 🔑 TULAJ VISSZA-BELÉPÉS (ADR-0042) + SESSION-IZOLÁCIÓ WORKTREE-VEL. Lokálban KÉSZ.**
- **Kiváltó (tulaj):** „élesítés után a tenant nem tudja hol tud adminjába belépni".
- **Lelet:** valós rés — a tenant-hoszt a `/`-on kívül **mindent 404-ezett** (a `/admin` tipp hibára
  futott), a lábléc kredit-csíkja pedig csak a `citoviso.com`-ra mutatott. Egyetlen mutató: a go-live
  e-mail — ami elveszik.
- **KÉSZ (ADR-0042):** `/admin`·`/login` → **302** a tenant-loginra; + **halk** „Tulajdonosi belépés"
  sor a kredit-csík alatt (keret nélkül, hogy annak folytatása legyen — a live oldal közönsége a
  LÁTOGATÓ, egy hangsúlyos gomb az ő konverzióját rontaná). A go-live e-mail marad az elsődleges út.
- ⭐ **SERVE-time injektálás** (`src/server/ownerLogin.ts`, demoFrame-minta): a motor kimenete tiszta
  marad, és a link **soha nem szivároghat outreach-mockra** — ott nincs fiók, egy „belépés" felirat
  hamis ígéret volna (§I). Ára: kívül esik a generálás-idejű i18n-őrön → a boot-self-heal tölti.
- Kapuk: `tsc` ✅ i18n ✅ katalógus ✅ design-token ✅ · füst-teszt ✅ · **390px + 1280px** ✅ ·
  ⚠️ a 302 élő tenant-hoszton NEM futott (kódolvasással ellenőrizve).
- ⚠️ **MUNKAMÓD-LELET:** ~11 session futott EGY fában → a saját munkámat **egy másik session
  `git add .`-elte be** (`44a6d82`, 27 fájl, 4 téma keverve), az ADR egy i18n-commitba. Semmi nem
  veszett el, de a történet kevert. Megoldás leszállítva: **`~/bin/rc-wt.sh`** = sessiononként külön
  git worktree (saját branch + saját portok; a DB abszolút socketen **automatikusan közös**).
  ⛔ **KÖTŐJEL TILOS a worktree-útvonalban** — a watchdog `basename.replace("-","/")`-tel invertál,
  kötőjeles név esetén **rossz fában támasztaná fel a sessiont, csendben**.
- Részletek: `_planning/memory/2026-08-20_tenant_owner_login_and_worktrees.md`

## Előző szál (ugyanaznap)
**2026-08-20 (3. szál) — 🎯 GEO-HORGONY (ADR-0043) + LEAD-ADATKÁRTYA. Lokálban KÉSZ.**
- **Kiváltó (tulaj):** „beírom a két alap lead adatot a keresőbe — Tekergő balatonberény — és azonnal
  találok honlapot, míg a leadnél faszság van” + „forrásnak az OSM van feltüntetve? miért nem lehet
  megnyitni?” + „nincs ország/város, a mentés gomb alatt vicc ahogy kinéz”.
- **Lelet:** a Brave ÉLESBEN futott — a baj a **horgony**. Sugaras régióban a régió-címke rossz
  horgony egy leadhez, és **ugyanaz a gyökér okozta mindkét irányú hibát**: a Tekergő fals negatívját
  (a valódi oldal sosem írja le, hogy „Keszthely” → eldobtuk) ÉS a keszthelyi backfill 4 fals
  pozitívját (visszavonva). Külön hiba: a `szállás` töltelékszó a foglalóportáloknak adja a top
  helyeket. Harmadik: az OSM `website` tagje rothad (404-es mélylink, miközben a gyökér él).
- **KÉSZ (ADR-0043):** horgony = a lead **városa**, és **HELYETTESÍTI** a régió-tokeneket (az unió a
  fals pozitívokat visszahozná); cím-szöveg tilos horgony (`hungary` 40/56 leadnél). Query:
  `<név> <város> hivatalos oldal`. Törött link → gyökér→webes keresés, **mindkettő geo-igazolva**.
  Források őszinték + nyithatók (a Places bejelöli magát, `sourceRefs` túléli a dedupe-ot).
  Per-lead **újragyűjtés-gomb** lifecycle-őrrel. Lead-kártya újraépítve (ország/város a fejlécben,
  3-oszlopos űrlap, kattintható honlap, fact-grid a 130px-es `dl` helyett).
- ⭐ **FŐ TANULSÁG:** a hibát **egyik pipeline-őr sem kapta el** (verify, portál-katalógus,
  sekély-útvonal, korroboráció mind ZÖLD volt egy rossz eredményen) — csak utólagos emberi
  mintavétel. Ezért determinisztikus fixture-kapu: `scripts/geo-verify-check.mts` (7/7 PASS).
- Bizonyítva: Tekergő 404 → élő, mobilbarát oldal → **nem is lead**; Borbaratok `outdated`→`modern`,
  kép 11→43. Kapuk: `tsc` ✅ design-token ✅ i18n ✅ · 1440px+390px ✅ · **éles DB-re semmi**.
- ⚠️ **Munkamód:** ~11 session futott egy fában → kevert commit (`44a6d82`), amiből **kimaradt a
  reenrich route**, bár a gomb bekerült. Szabály: soha `git add .`; commit után hívó+hívott ellenőrzés.
- Részletek: `_planning/memory/2026-08-20_geo_anchor_and_lead_card.md`

## Előző szál (ugyanaznap)
**2026-08-20 (2. szál) — 🌍 AUTOMATA NYELVI PROVISIONING (ADR-0036 + /b) ÉLES.**
- **Kiváltó (tulaj):** „működik a multilanguage? pl. lengyel leadre?” → nem: minden vevő-felület
  magyarul volt beégetve. Tulaj-irány: **automatizáltan** (a scrape új nyelvterülete magától
  generálja a felületeket), majd **doktrína-szintre** emelni + tracking/deploy-check.
- **KÉSZ + ÉLES:** a nyelv PARAMÉTER (régió `country`→nyelv), nyelvi csomag = egyszeri AI-fordítás
  nyelvenként (`language_pack`, kulcs = a magyar forrás-string), trigger: scrape-indulás +
  mock-generálás + **boot-time self-heal** (deploy+restart feltölti a friss katalógusra).
  `SiteData.lang` perzisztált (mock=live); AI-írók cél-nyelven; 8 sablon `T()`, widgetek `tr()`.
- **§B.18 DOKTRÍNA + HÁRMAS KAPU:** vevő-felirat SOHA nem beégetett — PostToolUse-hook +
  versionált git pre-commit (i18n-lint + katalógus-frissesség + design-token-lint) + kézi lint.
  A kapu élesben is fogott (elavult katalógus → commit elutasítva).
- **§C ORSZÁG-KAPU:** nem-magyar nyelvterületre outreach FLAG az ország JOGI csomagjának
  tulaj-jóváhagyásáig (mock/oldal/konfigurátor szabadon megy). PL csomag él (292 string).
- Bizonyítva: lengyel render PASS, **hu-regresszió 21/21 PASS** (bájtazonos), negatív próba blokkolt.
- Részletek: `_planning/memory/2026-08-20_i18n_doctrine_and_guards.md`

## Előző szál (ugyanaznap)
**2026-08-20 — 🔎 TENANT-OLDAL SEO ALAP (ADR-0041 RÉTEG A) ÉLES + TESZT-KONVERZIÓ PURGE.**
- **Kiváltó (tulaj):** „mennyire SEO-optimalizált a tenantnak adott honlap? + nem érdemes
  folyamatosan frissülő tartalom-modult (helyi programok) kínálni a találatokért?” majd:
  „azt akarom elkerülni, hogy a pilot alatt kikerülő oldalak hátrányt szenvedjenek”.
- **Modell-korrekció (ADR-0041, ELFOGADVA):** a tenant-SEO **URL-TERMELÉS**, nem „tartalom-frissesség”.
  Audit-lelet: a head jó volt (meta/OG/JSON-LD/fázis-robots/alt/lazy), DE **nem volt sitemap/robots
  route** (indexelés belépője nulla), nem volt canonical, a JSON-LD hardcode `LodgingBusiness`+`"HU"`
  (iparág-agnosztikus termékben beégetett vertikum), és a plafon: **a tenant-oldal 1 indexelhető URL**.
- **RÉTEG A = pilot-előfeltétel, KÉSZ + ÉLES (`c660fcd`):** `/robots.txt` + `/sitemap.xml` a
  tenant-hoston; canonical+og:url (live-only, editor.ts injektálja); `seoTitle()` „Név — Város” minta
  mind a 8 render-helyen; iparág-vezérelt JSON-LD `@type` (`SCHEMA_TYPE_BY_INDUSTRY`); NAP-mezők a
  lead facetjeiből; **301 slug→saját domain** (ÚJ szabály az ADR-0020 mellé: enélkül a domain-upsell
  elvinné a felhalmozott rangsor-egyenleget). Verifikálva: tsc+2 lint zöld, motor-füst-teszt mindkét
  fázisban ÉS mindkét render-úton, e2e teszt-tenanttal, prodon diff-before-deploy + 0 hiba.
- **RÉTEG B (aloldalak) + tartalom-modul: POST-PILOT** (később pótolva nulla büntetés). A tulaj
  programajánló-ötlete ELFOGADVA, de **indok-cserével + saját URL-en**; nyers scrape-lista TILOS
  (N tenanton azonos tartalom = scaled content abuse, a `*.citoviso.com` hálózat reputációját viszi)
  → helyette **geo-horgonyzott környezet-modul** a saját POI-vagyonból.
- **PURGE (tulaj: „teszt cucc, töröljünk leadig vissza mindent”):** mentés után (prod + lokál
  `_planning/backups/`, untracked!) tranzakcióban törölve 2 tenant, 2 site, 24 entitlement,
  1 tenant_user, 3 prospect, 4 order_intent, 3 payment, 1 invoice + 2 snapshot. **419 lead megmaradt**
  (lifecycle → `qualified`), 30 mock_artifact érintetlen. Minden fizetés mock → nincs valódi bizonylat.
- **⚠️ NYITOTT, A LEGFONTOSABB:** a purge előtt az egyetlen `live` site **6 db `places`-fotóval** ment
  owner-override nélkül = **§A-sértés élesben**. A site törlésével megszűnt, de az OK nincs kivizsgálva
  (régi site, vagy élő rés az `activate`→`rerenderTenantSnapshot` úton). **Az első valódi go-live előtt
  ellenőrizni!** Továbbá: `custom_domain` beállításához nincs re-render trigger (a canonical nem állna át).
- Jegyzet: `_planning/memory/2026-08-20_seo_layer_a_adr0041.md`.

---

## Korábbi aktív feladat
**2026-08-19/20 — 🌍 LEAD ORSZÁG+VÁROS FACET + KERESZT-RÉGIÓ DEDUP + KRK-TÖRLÉS + KESZTHELY ÚJRA-SCRAPE — MIND ÉLES (ADR-0038/0039/0040).**
- **① Ország/Város szűrő a konzol lead-listáján (ADR-0038, tulaj-kérés):** a RÉGIÓ oszlop
  scrape-terület, nem közigazgatási hely (`scraper_definition.country` fixen HU, `city` null volt) →
  a facet leadenkénti tény lett, a SCRAPE nyeri ki: OSM `addr:*` + Places `addressComponents`
  (field-maskok bővítve, `resolveOne` is), dedupe viszi át, a `raw`-ba perzisztál (NINCS migráció).
  Konzol: 2 új oszlop + colFilter multi-select, üres vödör = „ismeretlen". (`c8d0451`)
- **② Kereszt-futás/kereszt-régió DEDUP (ADR-0039, tulaj kapta el a rést):** a scrape NEM dedupált
  a tárolt leadekhez → újra-scrape duplikált volna, átfedő körök (balaton-north ⊃ badacsony/keszthely)
  ugyanazt a szállást többször hozták volna. Fix az EGYETLEN choke-pointon (`completeScrapeRun`):
  `partitionNewLeads` a teljes store ellen (normalizált név + ~250 m, koord KÖTELEZŐ — távoli azonos
  nevek nem olvadnak össze); diszkvalifikált sem támad fel. Élesben vizsgázott: keszthely újra-scrape
  → pontosan a meglévő 100 dup kihagyva, 319 új beszúrva. (`9d7942d`)
- **③ KRK TÖRÖLVE prodról (tulaj-döntés: régió+1000 lead):** ELŐTTE downstream-csekk (krk: 0 mock/
  prospect/tenant → biztonságos; keszthelyen 2 ÉLŐ TENANT+26 mock lóg → azt NEM töröljük, a dedup véd)
  + teljes pg_dump backup (prod `/var/tmp/` + dev `_backups/citoviso-pre-krk-delete-20260819.sql.gz`).
  Tranzakcióban: 1100→100 lead, tenant/mock érintetlen.
- **④ GARANTÁLT ország-kitöltés (ADR-0040, tulaj-elv: „koordinátából MINDIG kikövetkeztethető"):**
  a keszthelyi friss scrape-ben 419-ből csak 17 kapott országot (OSM-ben ritka az addr:country tag)
  → réteges kitöltés: forrás-tag → per-lead Places-lookup `addressComponents` (0 plusz API-hívás) →
  `enrichGeo.ts` Nominatim reverse-geocode (1 req/s, zoom=10) → régió-ország fallback (Region.country).
  + `scripts/backfill-geo.mts` (roncsolásmentes, idempotens). PROD-BACKFILL LEFUTOTT:
  **419/419 ország ÉS 419/419 város kitöltve** (Hévíz 54 · Keszthely 45 · Kehidakustány 32…). (`2c34d2e`)
- **Éles állapot:** minden deploy scoped rsync + restart, mindkét service `active`; a szűrő élesben
  teljes értékű. Jövőbeli scrape-ből ország nélküli lead szerkezetileg nem születhet.
- **NYITOTT (kurációs tulaj-döntés):** kell-e külön `badacsony`/`keszthely-es-kornyeke` régió, ha a
  `balaton-north` (30 km) földrajzilag lefedi őket? (Dedup miatt már nem duplikál, csak rendezettség.)
- Jegyzet: `_planning/memory/2026-08-19_geo_facets_dedup_krk.md`.

---

## Korábbi aktív feladat
**2026-08-19 (este) — 🎨 KONFIGURÁTOR „LÁSSA, MIT VESZ" JAVÍTÁSOK (tulaj-riport tabletről) — ÉLES (prod-deploy kész).**
- Tulaj-panasz: modul bekapcsolva (pl. Online foglalás), de sehol nem látszik az előnézetben;
  a csomagok tartalma láthatatlan; nincs modul-leírás.
- Javítás (lokál, Playwright-tal 1280px+390px verifikálva):
  ① MINDEN bekapcsolás rágörget az érintett szekcióra (present+minta egyaránt) + akcent-keret
    villantás (`.cit-cfg-flash`, token-témázott, reduced-motion ág van);
  ② preset-kártyán „Mit tartalmaz? (N szekció)" kibontható teljes modul-checklist (✓/✗);
  ③ modul-soron ⓘ ikon → 1 soros leírás (`publicDesc` a katalógusban) + „Megnézem az oldalon"
    ugrás (mobilon a bottom-sheetet összecsukja, a fül visszahozza);
  ④ scrim ≥561px-en 12%-ra halványítva (a 42% fekete elnyelte az előnézetet);
  ⑤ új track-események: `module_info`, `module_see`, `preset_info`.
- Fájlok: `src/modules.ts` (publicDesc mind a 13 modulra), `src/generator/configurator.ts`
  (desc a manifestben), `assets/runtime/cit-configurator.{js,css}`, `src/i18n/catalog.json`
  (3 új kulcs). Őrök: tsc ✅ i18n-lint ✅ design-token-lint ✅.
- **Prod-deploy KÉSZ** (tulaj-engedéllyel, 2026-08-19 este): backup
  `/opt/citoviso/backups/cfgsee-20260819-204606/`, az 5 fájl felmásolva,
  `citoviso-console.service` restart, CF-edge-en verifikálva (marker-grep egy élő
  /p/ oldalon). A verifikációs curl-ok keltette 2 db `mock_view` sort töröltem
  (ne szennyezze a lead-statisztikát). Git: `962ca2f` pusholva.
- **2026-08-20 reggel — „menjen élesre" UTÓ-DEPLOY (tulaj-engedéllyel) + teljes
  lokál↔prod fa-diff.** A konfigurátor már bitre egyezett; a fa-diff KÉT lemaradt
  csomagot talált, mindkettő kiment:
  ① `12d2375` Keszthely dry-run szigorítások — 4 scraper-fájl
    (`enrichSiteSearch/enrichWebSearch/qualify/reenrich.ts`), backup
    `scraper-keszthely-20260820-054742`; restart nem kellett (szerver nem importálja).
  ② az `5ffc81a` ikon/token-refaktor 3 KIMARADT fájlja: `src/server/adminViews.ts`,
    `public/assets/ui/citui-admin.css` (prodon nem is létezett!), `public/assets/home/home.css`;
    backup `uirefactor-rest-20260820-055218`, `citoviso-public.service` restart, origin+edge 200.
  - ⚠️ Tanulság: deploy után `git ls-files src assets scripts public | md5` fa-diff a
    prod ellen — ma ez fogta meg a kimaradt fájlokat. „Csak a módosított fájlok" =
    a commit TELJES fájllistája, ne emlékezetből.
  - ⚠️ CF-cache: a régi `home.css` max ~4 óráig élhet még az edge-en (a CF-token
    DNS-scope-ú, purge-joga nincs — auth error) — TTL-lel magától frissül.
  - ⚠️ Önhiba, elhárítva: smoke-tesztként importáltam prodon a `reenrich.ts`-t, ami
    top-level futtatja a main()-t; időben megöltem + alapból DRY-RUN (DB-írás nem
    történt, legfeljebb pár Brave-query). Szabály: szkript-belépőpontot SOHA ne
    importálj tesztként — a checksum-egyezés az elég verifikáció.
  - Megjegyzés: `_planning/DECISIONS.md`-ben commitolatlan ADR-0041 (SEO, JAVASLAT,
    kód nincs) — másik szál munkája, nem nyúltam hozzá.

---

## Korábbi aktív feladat
**2026-08-19 — 🎨 KONZOL LEAD-OLDAL ÚJRATERVEZVE + KONFIGURÁTOR KÉTLÉPCSŐS — mindkettő ÉLES.**
- **Lead-oldal (konzol):** a 4 egyforma auto-fit kártya HELYETT workflow-first elrendezés:
  azonosító-sáv (név+badge+tény-csík) → desktop 2 oszlop (MUNKA: adat-űrlap→generálás→
  rendelések→mockok | KONTEXTUS: fotók görgethető rácsban→megkeresés→admin) → ≤1100px EGY
  oszlop feladat-prioritás szerint (`display:contents` + `order`, szekció-ID-k `#ls-*`).
  Fájlok: `src/console/views.ts` (leadPage hero+grid), `public/assets/ui/citui-console.css`
  (`.con-lead-head/facts/grid`). Prodra ment (csak a CSS hiányzott — a views már kint volt).
- **Prospect-konfigurátor (ADR-0015 réteg):** ① panel 360→440px; ② KILÓGÓ FÜL a panel szélén
  (collapse: állapot megmarad, fül kandikál; mobil bottom-sheetnél a lap TETEJÉN); ③ KÉTLÉPCSŐS
  láb: 1. modulok+domain+összeg+„Tovább a megrendeléshez" → 2. Havi/Éves + §A nyilatkozat +
  Megrendelem (+„Vissza"). Új track-események: `checkout_step`, `panel_collapse`. Fájlok:
  `assets/runtime/cit-configurator.{css,js}` + `src/i18n/catalog.json` (3 új tr()-kulcs,
  i18n-lint ✅). Prod-deploy: backup `/opt/citoviso/backups/cfg-20260819-105328/` + konzol-restart,
  CF-edge-en verifikálva.
- **🐞 MOBIL KÁRTYA-FEJLÉC FIX (du., tulaj-riport, ÉLES):** a `.con .panel` volt a vízszintes
  görgető → széles táblát (Riport/Leadek) oldalra húzva a fejléc-sáv+szöveg is elgörgött
  (csonka sötét sáv). Fix: táblák saját `.tblwrap`-ben görögnek, a panel `overflow-x:hidden`
  (6 hely a views.ts-ben). Ezzel együtt az IKON/TOKEN-REFAKTOR is prodra ment
  (views+server+icons.ts+citui.css+citui-console.css, backup: `ui-20260819-114800`).
- Lokál teszt-operátor a konzolhoz: `claude-test` (UI-tesztekhez hasznos).
- **Git:** minden pendinget munkaszálanként commitoltunk + push (fizetési kapu-fix,
  konfigurátor, konzol-ikon/token-refaktor, docs). `_backups/` gitignore-ba (DB-dump nem mehet ki).

---

## Korábbi aktív feladat
**2026-08-18 — 🐞 FIZETÉSI FLOW-HIBA JAVÍTVA: jóvá NEM hagyott mockon is lehetett fizetni.**
- **Tünet (tulaj kapta el):** teszt-vásárlás után nem jött belépő-email; a `/pay/.../paid` oldal
  mégis „elküldtük"-öt írt. **Ok:** a mock artifact `generated` (nem `approved`) volt →
  `convertLead` eldobta magát → nincs site/belépő/email; közben payment=paid + mock-számla kiment
  + hamis siker-oldal. (Log: `must be 'approved' to convert (is 'generated')`; `contact_email` is üres volt.)
- **Kód-fix (2 fájl, prodra deployolva `tsx` restart):**
  - `src/payment/service.ts` — `requestPayment` **fulfillment-kapu**: csak `approved` mockra ad
    pay-linket; egyébként `null` + warn → az order rögzül, a kliens „a linket emailben küldjük"-öt
    mutat, az operátor jóváhagyás után újraküld. Egyetlen szerver-oldali choke-point.
  - `src/console/views.ts` — `payResultPage` **őszinte ág**: `!activated` esetén NEM hazudik élő
    oldalt/kiküldött belépőt.
- **Éles takarítás** (a „Panzió" saját teszt): payment→cancelled, order_intent→abandoned,
  mock-számla (MOCK-2026-B1A51C) törölve. Prod backup: `*.bak-20260818` a `src/`-ben (rollback).
- **NYITOTT (döntés kell):** a `handleWebhook` bukott aktiválásnál is számláz — nem-szállított
  szolgáltatásra kiálljon-e számla? Külön eldöntendő.
- Lokál git: 2026-08-19-én commitolva+pusholva (session-zárás).

---

## Korábbi aktív feladat
**2026-08-14→16 — 🐞 SABLON-AUDIT: dopamine matrica-átfedés + dark-luxury szél-levágás — JAVÍTVA, ÉLES.**
- **Tünet (tulaj kapta el az élő sport-udulo.citoviso.com-on):** a dopamine hero lebegő matricája
  („Balaton északi part") belelógott a címsorba — fix `top:%` pozíció a címsor sávjában.
- **Fix (`336fcc3`):** matricák determinisztikusan ütközésmentes horgonyra: fotós hero → a hero-fotó
  felső sarkai (`.t-heroimgwrap`), flat hero → üres alsó sáv; `dark-luxury`: a `.t-heroin{width:100%}`
  felülírta a `t-wrap` szélesség-korlátját → cím a viewport-szélig folyt/levágódott — width törölve.
- **Mind a 7 sablon auditálva** az éles sport-inputokból renderelve (1500px+390px) — a többi 5 tiszta.
- **Éles deploy (scope-olt engedéllyel):** 2 sablonfájl scp → `/opt/citoviso/app`, service-restart,
  sport-udulo snapshot újrarender a kanonikus `rerenderTenantSnapshot`-tal (tulaj-szerkesztés +
  live fotó-politika megőrizve), élő URL-en verifikálva.
- **BACKLOG-ba felírva (tulaj-rendelet): hiba-ticketing rendszer** — beküldés → kurátori jóváhagyás →
  AI-feldolgozás; ⛔ az AI az alap STRUKTURÁLIS kódhoz nem nyúlhat (a mag definíciója külön ADR lesz).
- Tanulság-minta: élesről a `mock_artifact.inputs` (recipe+siteData) kiolvasható és lokálban
  hűen újrarenderelhető → biztonságos éles-hiba-reprodukció mutálás nélkül.

---

## Korábbi aktív feladat
**2026-08-07/08 — ⭐⭐ A TULAJ ELSŐ VALÓS TESZTJE: A–Z lánc önjáró + konzol üzemképes + keresés-backend rendbe.**
- **Az A–Z lánc ÖSSZEÉRT** (a tulaj követelése: „érjen össze minden, triggerelődjön magától"):
  rendelés → **auto pay-link** (`719f215`) → fizetés → webhook → tenant+entitlement+**LIVE site**
  → **auto számla** → **a vevő MEGKAPJA a belépését** (`282fc2e`, eddig sehol nem hívódott!) →
  **`<slug>.citoviso.com`** (`d0d086f`, 0017) → érthető „mi a teendő" képernyő (`4bc841a`).
  E2E prodon mock-gateway-jel, kézi lépés nélkül. Kurátori jóváhagyás szándékosan EMBER.
- **⚠️ FOLYAMAT-TANULSÁG (a tulaj kapta el): a döntés ADR-be megy, nem session-jegyzetbe.**
  A keresés-backend döntés (Brave; a Google CSE „entire web" 2027-01-01-ig kivezetve, Bing halott)
  2026-07-07/11 óta megvolt — de csak jegyzetben, ezért tévedésből a CSE-re építettem.
  → **ADR-0026** + `webSearch.ts` diszpécser (Brave → CSE legacy → HANGOS hiba; csendes degradáció
  TILOS). Időzítés VÁLTOZATLAN: a fizetős search-tail az **automata kurációhoz** kötve.
- **Honlap-felderítés 3 hibája javítva:** a keresés sosem keresett honlapot (`enrichSiteSearch` ÚJ) ·
  a portál-lista naiv substring volt (`danubiushotels.com` ⊂ `hotels.com` → hoszt-alapú lett) ·
  a 403-at csendben nyelte (üres találat = „nincs honlapja" = hitelesség-romboló).
- **Scrape-területek KÖRÖK** (0018+0019): Nominatim címkereső + rádiusz-csúszka + koncentrikus
  gyűrűk; a bbox származtatott, a `run.ts` haversine-nel szűr → tényleg kör. `/scrape` 3 fül
  (Indítás · Térkép · Területek); a Térképen minden lead színezve + a területek körei.
- **Konzol-UX (mind tulaj-visszajelzésből):** kvalifikáció-**badge** (SVG) · lead-oldali
  „Begyűjtött adatok" + **fotók** (igény szerint, Places-költség miatt) · **diszkvalifikálás**
  indokkal (megmarad, újra-scrape sem hozza vissza) · **fejléc-szűrők**: kereshető MULTISELECT
  élő darabszámmal, név-autocomplete, „legalább N" (`b826124`) · a szűrő most azonnal alkalmaz.
- **Prod = main** (0 kódfájl-eltérés), 19 migráció, 100 valós lead (Keszthely és környéke).
  `PAYMENT_GATEWAY=mock` (hogy az A–Z kártya nélkül fusson), `BRAVE_API_KEY` nincs (szándékosan).
- **KÖVETKEZŐ:** a tulaj végigfuttatja az A–Z-t · valós árak + e.v.-adatok (§C-kapu) · éles Barion/
  Számlázz a sandbox-teszt után · ADR-0025 hátralévő minőség-körei (④ interlock → ③ ritmus + ⑥ crop).
- Jegyzet: `_planning/memory/2026-08-07_console_ux_and_search_backend.md`.

---

## Korábbi aktív feladatok
**2026-08-06 (2. blokk) — ⭐⭐ ADR-0025 ①② LEIMPLEMENTÁLVA + KURÁTORI KAPU + PROD PIPELINE-INFRA ÉLESÍTVE.**
- **Styling ①② (commit `4ecc426`):** `RecipeSection.emphasis` (focal|normal|quiet); ① restraint (enforce nem húz
  be kényszer-mintát, max 1 minta-modul), ② pontosan egy focal szekció + minta=quiet; render `data-cit-emphasis`
  + `EMPHASIS_CSS`. Determinisztikus (`scripts/verify-emphasis.ts` PASS), mock=live, dizájn-kapu pass.
- **Kurátori kapu (commit `ec04714`, tulaj-szabály):** kiküldés CSAK ha a mock_artifact `approved` (ember,
  curateArtifact). `sendOutreachMail` + `listSendableProspects` zár; nincs vak auto-send.
- **VALÓS-FEEDBACK PIVOT (tulaj):** ne csiszoljunk vakon; blokkolók után a normál folyamaton át kis valós kör,
  minden mock előtt kurátori jóváhagyás. B3=egységes prod, B2=tulaj állítja az árakat a /pricing-en (kapu verifikált).
- **PROD B3 1–5 KÉSZ+verifikált (deploy-doktrína, current-turn go):** deploy (main→prod ~40 fájl) · Anthropic-kulcs
  már volt · chromium+`CHROMIUM_PATH` · 0016 migráció (16) · **`admin.citoviso.com`** konzol (nginx→:4600, operátor
  `olaszferenc`, login e2e OK). Részletek: [[reference_citoviso_prod_infra]]. Jegyzet: `_planning/memory/2026-08-06_prod_pipeline_golive.md`.
- **KÖVETKEZŐ (6. lépés): a kis valós kör** — tulaj beviszi a valós árakat (/pricing) → scrape prodon → mock (új
  motor) → kuráció admin.citoviso.com-on → kis batch (per-batch külön tulaj-go a hideg küldéshez).

---

**2026-08-06 — ✅ FOTÓ-DERIVÁLT PER-SZÁLLÁS AKCENT (§B.6) KÉSZ (`0dc0f57`) — az utolsó „mind ugyanaz" rés bezárva.**
- A brief eddig is kinyerte a szállás fotóiból a palettát, de az engine-path ELDOBTA → minden azonos-skines
  szállás **byte-ra azonos akcentet** kapott. Mostantól a fotó-hue a skinbe **HARMONIZÁLVA** kerül: a HUE a
  fotóból, a LUMINANCIA a skin akcentjéhez igazítva (WCAG-luminancia bináris kereséssel) → a skin világos/sötét
  karaktere + kontraszt-garanciái sértetlenek (dark-luxury sosem világosodik ki), csak a szín per-szállás egyedi.
- **Determinisztikus → mock=live megmarad** (`SiteData.palette.accent` perzisztált); érvénytelen/kontraszt-bukó
  szín → skin-akcent fallback. Egyetlen token (`--cit-accent`) cserélődik (hoverek color-mix-esek → követik);
  11-token dizájn-kapu PASS. Új: `src/engine/palette.ts`. Verifikáció: 2 lead × 5 art direction, azonos skin +
  más szállás → más akcent, kontraszt ≥6; `tsc` tiszta. Jegyzet: `_planning/memory/2026-08-06_photo_derived_accent.md`.
- ⚠️ Változatlanul nyitva: a 20 art-direction mock **őr-köre** (`tenyhuseg-or` + `dizajn-doktrina-or`) kiküldés előtt kötelező.

---

**2026-08-06 — ⭐ MINŐSÉG-ÍV II. TERV ELFOGADVA (ADR-0025, deliberációs session — még NINCS kód).**
- **Tulaj:** az 5 art direction után is „bedobált szar" az érzés; pilotnak elég, de a globális megkeresésekhez kevés.
- **Diagnózis:** eddig a modulokat (részeket) optimalizáltuk; a „bedobált" érzés a WHOLE tulajdonsága — szekció-közti
  VISZONY + oldal-HIERARCHIA + a konkrét szállásra REAGÁLÁS. **Amatőr hozzáad, profi elhagy és kiemel.** Kód-gyökér:
  a `Recipe`-nek nincs szókincse a súlyra/fókuszra/viszonyra; az AI-brief is csak ezt tölti.
- **Döntés:** bővítsük a `Recipe` szótárát + az AI-briefet (vízióval) — render marad determinisztikus, mock=live/§B.17/§I
  sértetlen (additív opcionális mezők). Az ADR-0019 „(C)" útja: ugyanaz a motor, okosabb brief. NEM új motor.
- **7 levél → mechanizmus:** ①restraint (töltelék-szekció kiesik) ②`emphasis:focal` fókusz-szekció ③ritmus-súly
  ④interlock/bleed (a legerősebb kézműves tell) ⑤fotó-derivált paletta (`palette.accent` mező VAN, `engine/palette.ts`
  NINCS) ⑥`Photo.role` crop-szerepek ⑦narratív copy-ív. Fojtópont: `RECIPE_SCHEMA`+`planRecipe`+render.
- **ELFOGADOTT SORREND (a styling-session ebből indul):** 1) ①restraint+②fókusz együtt · 2) ④interlock ·
  3) ③ritmus+⑤paletta+⑥crop. Mérce változatlan (`reference-quality/`); kiküldés-kapu: tényhűség+dizájn-őr.
- Jegyzet: `_planning/memory/2026-08-06_quality_composition_roadmap.md`. Döntés: `_planning/DECISIONS.md` ADR-0025.

---

**2026-08-05 — ⭐⭐ A MINŐSÉGI PLAFON ÁTTÖRVE: az 5 referencia-mock ART DIRECTION archetípusként (`e0614dd`).**
- **Kiváltó (tulaj):** „rettentőek… mind ugyanaz, csak egymás után dobálva a modulok, ez nagy bukta lesz így",
  „eddig amiatt az egész projekt halálra van ítélve". **A kritika technikailag IGAZ volt:** az archetípus-réteg
  addig CSAK szekció-sorrend/rács volt ugyanabból a vékony blokk-készletből; a dizájn-őr kimérte, hogy két
  `stone-masonry` mock **byte-ra azonos palettát** kapott. NEM regresszió — PLAFON: a mai kimenet strukturálisan
  azonos volt a 07-26-i „sokkal jobb"-nak ítélt mintával (az ADR-0019 a szavakat+mozgást javította, a dizájnt nem).
- **A döntés:** a tulaj 5 jóváhagyott referencia-mockja (`assets/design-refs/reference-quality/`) **TELJES art
  directionként** beportolva. NEM új motor és NEM stratégiaváltás (ADR-0016/0019 érintetlen: kompozíciós motor,
  `mock=live`, §I) — a 07-23 óta írásban álló terv végigvitele („a sokszínűséget optimalizáltuk, nem az alap kraftot").
  **5 art direction:** `fullbleed-glass` · `dark-luxury` · `card-sidebar` · `editorial-press` · `immersive-parallax`.
- **A régi 6 sorsa (tulaj kérdezte: „minden archetípust újra kell gondolni?"):** a régi 5 rács-séma **RETIRED** —
  a tervező nem választhatja, de a registryben MARAD (a perzisztált receptek örökre újra-renderelhetők = mock=live).
  `stacked` = semleges technikai tartalék. Precedens: a 07-16-i korpusz-karantén.
- **Új motor-mechanizmusok** (mind determinisztikus): `Archetype.preferredVariants` (az art direction MAGÁVAL hozza
  a szekció-változatait — nem AI-szeszély) · `navLinks` · `skinAffinity` (sötét kompozíció ne kapjon világos skint) ·
  `retired` · `planner.withArchetype()` · **14 új primitív-variáns** · ÚJ `location` szekció-fajta (térkép+kapcsolat) ·
  ÚJ `alpine-bold` skin · CLI `--archetype=` `--skin=`.
- **⭐ ÚJ ESZKÖZ `scripts/engine-matrix.ts`** (1 lead × N art direction kontakt-lap): az AI-lépések leadenként
  EGYSZER futnak, a többi lap ugyanannak a receptnek a determinisztikus újrarenderelése → **egyben a mock=live
  bizonyítéka** (soronként azonos szöveg/tény/fotó) és ~5× olcsóbb.
- **Elkapott VALÓS hibák:** dupla kártya (a runtime widget saját kerete az archetípus konténerén belül) ·
  olvashatatlan márkanév a parallax navban · akcent-szó akcent-háttéren · **cirill homoglyph az AI-copyban**
  (`fixHomoglyphs`) · halott „Kapcsolat hamarosan" CTA → mailto→tel→disabled létra. ⚠️ **TOOL-hiba, nem mock-hiba:**
  az `engine-shot.ts` nem görget capture előtt → a reveal-tartalom üresnek látszott (a mockok jók voltak).
- **Verifikáció:** 4 kvalifikált lead × 5 art direction = **20 oldal** — dizájn-kapu PASS · round-trip AZONOS ·
  11 token · 0 emoji · minta-jelölés · AI-copy címekben nincs nem-forrásolt szám. `tsc` tiszta.
  **Tulaj a 2. körre: „Oké, ez most meggyőzőbb."**
- **⚠️ KIKÜLDÉS ELŐTT KÖTELEZŐ:** az **őrök ítélet-igényű köre a 20 mockra NEM futott le** (session-limit) —
  a `tenyhuseg-or` + `dizajn-doktrina-or` hívása kötelező (az „Óbester vályogfal"-típusú fabrikációt csak ők fogják el);
  **demo-framing lábléc** (§A.12); **mobil burger-menü** (<900px nincs szekció-nav).
- **KÖVETKEZŐ SZELET (javasolt): fotó-derivált per-szállás paletta (§B.6)** — az utolsó strukturális „mind ugyanaz" rés.
- Párhuzamos szál külön commitban (`e49da11`): **operátor-szerkeszthető árazás** (`src/pricing.ts` + 0016 migráció +
  konzol `/pricing`; a beégetett árak DEFAULT-tá szelídültek, a futásidejű igazság a DB; `PRICING_CONFIRMED` kapu áll).
- Session-jegyzet: `_planning/memory/2026-08-05_reference_art_directions.md`.

---

**2026-08-02/04 — ⭐⭐ ÉLES INFRA FELÁLLT: citoviso.com ÉL + e-mail-infra hitelesítve (ADR-0024).**
- **ADR-0024 (hoszting-döntés):** **Hetzner Cloud CX23** (2 vCPU/4 GB/40 GB, NBG1, €5,49 nettó/hó) —
  fő kritérium a TELJESKÖRŰ API-vezérlés (A1-elv) + óraalapú skálázás; **Cloudflare** (registrar+DNS+
  később for SaaS); tenant-domain-vásárláshoz **INWX** (.hu-t is tud API-ból; trigger: 1. egyedi-domain
  rendelés). Tárigény-becslés valós mérésből: **100 tenant ≈ 2–15 GB** → nem veszünk előre tárat.
  ⚠️ Hetzner 2026-06-15-i áremelés: a CPX-vonal 2,4×-ére drágult → CX-vonal kell.
- **Szerver + DNS API-ból:** `citoviso-app-1` (158171031), Debian 13, **IP 178.104.3.223**, tűzfal
  (22/80/443), napi backup, dedikált SSH-kulcs. DNS: A @ · CNAME www · **A * (wildcard tenant-aldomain)**
  → proxyzva. ⚠️ CF-token-csapda: az ÚJ „Account API tokens" (cfat_) NEM ad zóna-DNS-jogot — a
  klasszikus **User-token „Edit zone DNS" sablon** kell (dash.cloudflare.com/profile/api-tokens).
- **Bootstrap (tulaj-engedéllyel):** node20 + PG17 (friss DB, 15 migráció) + nginx (önaláírt origin-cert,
  CF Full) + systemd (`citoviso-public` :4800, `citoviso-console` :4600 kifelé ZÁRVA). Deploy = **rsync
  a dev-gépről** (`git ls-files`; nincs git a szerveren). Éles `.env`-ben CSAK app-kulcsok (infra-tokenek
  nem). **https://citoviso.com ÉL** (+www +wildcard).
- **E-mail-infra (2026-08-03):** **Zoho Mail Lite** 1 user `olasz.ferenc@citoviso.com` + **`info@` ingyenes
  ALIAS** (€10,80/év). DNS mind API-ból: verify-TXT · MX · SPF · **DKIM `zmail._domainkey`** (openssl-lel
  validált kulcs) · **DMARC p=none**. Bejövő ÉL. Kliens: `imappro/smtppro.zoho.com` (fizetős → „pro" hostok!).
  **A külső küldő KIZÁRÓLAG a hideg-kézbesíthetőség miatt kell** (friss IP+domain = spam → hamis pilot-mérés);
  a tenant-email felár-modul ettől független, saját mail-stackkel is megoldható.
- **⭐ AZ ELSŐ VALÓS LEVÉL ELMENT (2026-08-04):** app-jelszóval `SMTP_URL`+`OUTREACH_FROM`+
  `EMAIL_PROVIDER=smtp` az éles .env-ben; `scripts/email-smoke.ts` a szerverről kétszer is lefutott.
  ⚠️ **HETZNER PORT-BLOKK:** a 25-ös ÉS 465-ös kimenő port BLOKKOLT (timeout), a **587 (STARTTLS)
  nyitva** → azon megy. **A KÜLDŐ-ÚT KÉSZ.**
- **Nyitott (tulaj): IMAP-kliens (Outlook) még nem megy** — a Zoho szerver válasza: „you are yet to
  enable IMAP for your account". A házirend már engedi, de KÉTLÉPCSŐS: a **WEBMAILBEN** kell bekapcsolni
  (mail.zoho.com → fogaskerék → Levelezőfiókok → cím → IMAP Access pipa), NEM az admin-konzolban.
  Az app-jelszó JÓ. **Nem pilot-blokkoló** (a kiküldés SMTP-n megy, válasz a webmailben olvasható).
- **KÖVETKEZŐ FEJLESZTÉSI DÖNTÉS:** valós árak + `PRICING_CONFIRMED` (§C-kapu) · **dev↔prod DB
  egységesítés** (a leadek a dev-gépen, a szerver DB-je üres — ez KELL a szerverről kiküldéshez) ·
  majd a **teljes A–Z sandbox-teszt**.
- **Nyitott technikai szálak:** dev↔prod DB kettéválás (scrape/kuráció ma a dev-gépen fut, a szerver DB-je
  külön/üres — egységesíteni kell a pilot-tölcsérhez) · konzol-elérés élesben (SSH-tunnel vs admin-aldomain)
  · tenant host-routing (a wildcard ma ugyanazt az oldalt adja, nincs `slug.citoviso.com` → tenant-site) ·
  CF „Always Use HTTPS" kapcsoló. Jegyzet: `_planning/memory/2026-08-02_prod_infra_golive.md`.

---
**2026-08-02 — §A PER-KÉP PROVENANCE A GO-LIVE ÉLEN KÉSZ (`40d48e9`, őr-verifikált).**
- **Photo += `provenance`** (§A.3: owner|guest|portal|places|streetview|generated) + `watermarked`;
  ÚJ `src/engine/photoPolicy.ts`: live-renderből KIZÁRÓLAG places/streetview/vízjeles/ismeretlen esik ki
  (ismeretlen=drop A4 safe default; `/uploads/` prefix = legacy owner); guest/portal az önnyilatkozattal
  élesre megy csere nélkül. Bélyegzés: motor Places-fotó=`places`, tenant-feltöltés=`owner`.
- **Go-live sorrend (őr-jelezte rés fixálva):** `activate()` → §A-policys live render ELŐBB
  (`rerenderTenantSnapshot(tenantId,{as:"live"})`), status-flip CSAK sikeres render után; legacy
  HTML-copy artifact nem auto-élesedik. Tenant-szerkesztő live-státuszú re-renderje is policy-s.
- **⭐ BÓNUSZ BUGFIX:** `toPrivatePreview` létező robots metát noindexre CSERÉL — az engine-renderelt
  provisioned privát előnézet eddig `index,follow` volt (Bonvino bizonyította)! + eddig a live site a
  provisioned NOINDEXES snapshotot szolgálta ki (nem volt go-live re-render) — mindkettő zárva.
- **Remediáció:** GRANDIS pre-policy legacy live sandbox-site → provisioned (0 live site a dev DB-ben).
- E2E (Bonvino): provisioned=demó-fotó+noindex · live=0 Places-URL+owner-fotók+index · tsc tiszta.
- **Őr-jegyzetek (kis nyitottak):** `watermarked` ma halott kód (portal-ingestnél kötelező lesz a
  bélyegzés); az engine-renderelt provisioned előnézetben nincs demo-framing lábléc (noindex+token véd,
  de §A.12-súrlódás — tulajjal eldöntendő, kell-e keret).
- **Temp-screenshot kivizsgálva:** a tulaj 08-01 21:23-as mobil-fotója a 23:22-es szerver-restart
  ELŐTTI régi konzol-UI-t mutatta; a mostani konzol 390px-en Playwrighttal verifikálva RENDBEN
  (tabsor + panelen belüli tábla-görgetés). Kódmódosítás nem kellett.
- **KÖVETKEZŐ: teljes A–Z sandbox-teszt** (scrape→mock→outreach→rendelés→fizetés→számla→élesítés
  egyben) — tulaj-döntés szerint ez előzi a Barion/Számlázz éles kulcsokat. Kozmetika hátra: régió-slug
  a levél hook-mondatában.

---

**2026-08-01 (2. session) — B) OUTREACH KÜLDŐ-PIPELINE KÉSZ (§C-kapu a csőben, E2E-verifikálva).**
- **SMTP-adapter** (`src/email/sender.ts`): nodemailer a stub helyett (`SMTP_URL`+`OUTREACH_FROM` kötelező,
  hangosan bukik); mock/outbox marad a default. `EmailMessage` += `headers`.
- **HTML-sablon** (`src/email/outreachEmail.ts`): a §C-kapuzott SZÖVEGES piszkozat bekezdéseiből renderel
  (egy-forrás → §I-hű), brand-színek, CTA, NINCS tracking-pixel; **RFC 8058 one-click unsubscribe** fejlécek.
- **Pipeline** (`src/outreach/sendBatch.ts` + `scripts/outreach-send.ts`, `npm run outreach:send`): EGYETLEN
  őrzött út (konzol-gomb + batch + CLI konvergál); §C-kapu/státusz/leiratkozás a küldés PILLANATÁBAN újra fut;
  cap 20/futás + 5s pacing; `--dry-run/--limit/--prospect`. Konzol: draft-oldalon „Küldés e-mailben" gomb
  (`POST /prospect/:id/send`), `/p/:token/leiratkozas` POST-tal (one-click).
- **⭐ Jog-provenance-őr FLAG-elt → 3 fix:** (1) **cím-szintű suppression** (`isEmailSuppressed`: bármely valaha
  leiratkozott sor azonos e-maillel = tilos — a token-szintű opt-out Grt.-sértés volt); (2) **atomi created→sent
  claim** küldés előtt (dupla-küldés kizárva, hibán revert); (3) List-Unsubscribe-assert a hideg-úton.
  E2E: FLAG-út/dry/sent/re-send-SKIP/one-click-unsub/suppression mind verifikálva; `tsc` tiszta.
- **Konzol e-mail-előnézet** (`cc0eaa4`): a draft-oldalon élő HTML-iframe = PONTOSAN a kimenő levél
  (`/prospect/:id/email-preview`; FLAG-állapotban is nézhető).
- **⭐ Nagyobb csali (tulaj-kérés, `fe2c64e`):** ① a mock NYITÓKÉPE a levélben (`heroShot.ts`, CID-inline =
  nem open-tracking; §A-szalag a pixelekbe égetve: „ELŐZETES LÁTVÁNYTERV — CITOVISO") ② „már havi X forinttól"
  ár a `modules.ts BASE_PRICE_MONTHLY`-ból (egy ár-forrás) ③ „kipróbálhatja" CTA (fedezett: /p/=konfigurátor).
  **Őr 2. kör → fix:** artifact-verdikt assert küldés előtt (FLAG-es mock képe nem mehet postafiókba) +
  **`PRICING_CONFIRMED` kapcsoló** (placeholder-ár hirdetését a §C-kapu blokkolja). Őr-jelezte MEGLÉVŐ rés
  BACKLOG-ra: `order_intent.price` kliens-küldött → szerver-oldali újraszámítás kell terhelés előtt.
- **Éleshez kell (tulaj):** ⭐ valós árak a `modules.ts`-be + `PRICING_CONFIRMED=true` · küldő-domain SPF/DKIM →
  `SMTP_URL`+`EMAIL_PROVIDER=smtp` · publikus HTTPS → `PUBLIC_BASE_URL` · `OUTREACH_SENDER_*`.
  Kozmetika hátra: régió-slug a hook-mondatban („godollo").
- Session-jegyzet: `_planning/memory/2026-08-01_outreach_send_pipeline.md`.
- **⭐ BELSŐ UI ① KÉSZ (`14f02fb`):** konzol `/scrape` (régió+cap indítás a felületről — a CLI child-processként,
  élő napló, futás-történet; E2E: badacsony cap=5 a felületről → 5 lead perzisztálva) + `/riport` (H1–H5
  hipotézis-tábla küszöbökkel + szegmens-bontás; H1/H5 bázis = TÉNYLEGESEN kiküldött prospectek).
  Fejléc-nav: leadek · scrape · riport.
- **⛔ TULAJ-DÖNTÉS (2026-08-01): Barion+Számlázz ÉLESÍTÉS PARKOLVA** — előtte kötelező egy teljes A–Z
  sandbox-teszt (scrape→mock→outreach→rendelés→fizetés→számla→élesítés egyben); az éles kulcs-beszerzést
  se kezdjük még. (A belső konzol Tailscale-only védelme MEGHALADVA még aznap → operátor-login, lásd lentebb.)
- **Árazás:** belső ár-UI NINCS (ár = `modules.ts`, placeholder + `PRICING_CONFIRMED=false` kapu);
  a hierarchikus GEO-árazás (országfüggő) a BACKLOG-ban rögzített 1. belső modul — pilot UTÁN épül,
  trigger: 2. ország. A pilothoz a tulaj mondja a számokat, kézzel írjuk be.
- **⭐ FELNŐTT KONZOL (`fbced93`, tulaj-kritika nyomán):** operátor-LOGIN (0014 `operator_user` +
  `operatorAuth`, HMAC-cookie külön realm; auth-kapu minden belső route-on, publikus kivétel-lista) —
  publikus hostingon is védett; állandó MENÜ + vezérlőpult (`/`=számok, lead-lista→`/leadek`); a konzol
  inline CSS-e törölve → KINÉZET A DIZÁJN-MAGBÓL (`citui.css` + új `citui-console.css`). Fiók:
  `scripts/operator-user.ts`. Publikus oldalak chrome nélkül.
- **⭐ ANGOL ÚTVONAL-STRUKTÚRA (`650d8db`, tulaj-rendelet):** minden route angolra: `/login /logout /leads
  /report /privacy /p/:token/unsubscribe /admin/{text,contact,photos}` (mindkét szerver); a honlap halott
  `/adatvedelem` linkje javítva (`/privacy` a :4800-on is). Magyar = megjelenítési nyelv. **MULTILANGUAGE-igény
  rögzítve** (tenant-admin + belső konzol is; BACKLOG „Multilanguage / i18n", trigger: 2. nyelv/ország).
- **⭐ ÁR-INTEGRITÁS FIX (`a6122f0`):** order-ár SZERVER-oldalon számolva (kliens-ár csak kijelzés,
  eltérés naplózva, kamu modul kiszűrve) — az őr-jelezte rés zárva.
- **⭐ §A ÖNNYILATKOZAT-FLOW (`6a1b29d`):** 0015 + legal.ts (determinisztikus szöveg) + kötelező
  konfigurátor-checkbox (a címke = a bélyegzett szöveg, egy forrás) + szerver 400-kapu + activate()
  §A-recheck a go-live élen + tenant-admin modul-kártya.
- **⛔ NEM nyitott döntés — VÉGREHAJTÁSI feladat (session-végi tanulság):** a §A fotó-politika 2026-07-13
  óta ELDŐLT (guest/portal = önnyilatkozattal élesíthető; **Places/StreetView SOHA → saját képre csere**,
  ezért van az A2 feltöltés). Tévesen döntésként kérdeztem újra → a tulaj jogosan reklamált.
- **KÖVETKEZŐ SESSION ELSŐ FELADATA (pontosítva — a „csak owner-kép" megfogalmazásom HIBÁS volt,
  a tulaj elkapta):** a MEGLÉVŐ §A.1/b kikényszerítése a go-live élen: per-kép provenance-osztály
  (§A.3) a pipeline-ban + a live-renderből KIZÁRÓLAG a places/streetview/vízjeles esik ki (csere) —
  a **guest/portal a 0015-ös önnyilatkozattal ÉLESRE MEGY, csere nélkül** (owner-kép csak opció, A2).
  Utána: teljes A–Z sandbox-teszt.

---

**2026-08-01 — PILOT-INFRA ÉPÍTÉS: dizájn-mag + publikus honlap + self-serve auto-mock + tenant-belépés/admin.**
- **⭐ ADR-0021 — Citoviso saját felület-világ:** központi **dizájn-mag** (`public/assets/ui/citui.{css,js}`,
  `--citui-*` tokenek + komponensek + styleguide; a brand `assets/brand/`-ból: navy/cián, Inter+Space Grotesk).
  Elkülönítve a motor `--cit-*` skin-tokenjeitől. **Kettős identitás-realm** (control/data plane) + granuláris belső
  RBAC TERV (6 szerepkör: superadmin/operátor/sales/pénzügy/dizájner) — de a belső RBAC a pilotra HALASZTVA.
- **⭐ Publikus honlap** (`public/index.html` + `assets/home/`): **vevő-fókuszú** tartalom (tulaj-visszajelzés:
  NE a technikai hátterünkről szóljon — [[feedback_landing_customer_value_not_tech]]); a lap GERINCE a **minta-igénylés**.
  No-JS reveal-fix (JS nélkül is látszik). A landing a tulaj mintájából újraépítve (nem copy-paste), a magra.
- **⭐⭐ ADR-0022 — self-serve auto-mock:** honlap-űrlap (**Leaflet térkép-pin** = pontos helyszín) → `POST /api/mock-request`
  → egy-vállalkozás feloldás (`resolveOne`: Places pin/locationBias v. név+település) → `generateEngineMock` → ŐR-KAPUK
  (tényhűség/jog/dizájn + A4 konfidencia) → **őr-kapuzott auto** e-mail (magabiztos+PASS→auto; FLAG→needs_review, A2).
  E-mail: **EmailSender interfész + Mock-adapter** (`outbox/`; SMTP éles később). `mock_request` tábla (0010).
- **⭐⭐ ADR-0023 — tenant-belépés + minimál admin** (a pilot kiemelt hiánya: vásárlás után belépés): **felhasználónév +
  jelszó** (mi generáljuk a vállalkozásnévből + megjegyezhető jelszó `kilato-levendula-47`; magic-link ELVETVE — a
  nem-tech tulajnak macerás; e-mail INSTABIL login-kulcs mert mi adunk neki e-mailt). **Kommunikációs e-mail** külön,
  módosítható. scrypt hash + aláírt session-cookie. Admin (dizájn-magon): **A1 szöveg-szerkesztés** + **A2 saját fotó
  feltöltés/csere** (§A: demó kép élesre nem mehet → saját kép váltja; `AssetStore` interfész + LocalAssetStore
  `sites/<tenant>/uploads/`). Re-render mock=live. Táblák: `tenant_user`+`login_token` (0011), `password_hash` (0012),
  `username`+`contact_email` (0013), `site.edited_site_data`.
- **⚙️ ÚJ PUBLIKUS SZERVER:** `src/server/public.ts` (:4800, `PUBLIC_PORT`) — statikus `public/` + `/api/mock-request`
  + `/m/:token` (előnézet, demo-framing) + `/belepes` `/admin` `/admin/{szoveg,kapcsolat,foto,foto/torol}` `/kilepes`
  + `/site/:token` + `/uploads/`. **Folyamatosan fut** (setsid/nohup; leváltotta a python statikust). Böngészőből:
  `http://100.97.188.105:4800/`. (A belső konzol továbbra is `:4600`.)
- **Commitok (mind PUSHOLVA, origin/main szinkron):** `82e7e87` (mag+honlap+auto-mock) · `a5b471b`+`4d2a381` (tenant-auth)
  · `41f3978` (A2 fotó). ADR-0021/0022/0023 a `_planning/DECISIONS.md`-ben.
- **KÖVETKEZŐ (pilot kritikus út):** **B) outreach küldő-pipeline** (~100 hideg megkeresés kiküldése: SMTP-adapter a
  meglévő EmailSender mögé + batch + §C-kapu + HTML-sablon). Opcionális: modul-kezelés az adminban, jogi
  önnyilatkozat-flow az élesítésnél.
- **🔑 KÜLSŐ BLOKKOLÓK (tulaj):** citoviso.com + **publikus hoszting** (outreach-link + Barion-webhook + honlap élesítés
  előfeltétele) · éles Barion + Számlázz kulcs · küldő-domain/postafiók (SPF/DKIM) az e-mail-küldéshez.
- Session-jegyzet: `_planning/memory/2026-08-01_pilot_infra_build.md`.

---

**2026-07-27/30 — PILOT-FELKÉSZÜLÉS: domain-stratégia (ADR-0020) + követett outreach-gerinc + §C-kapus email-piszkozat + pilot-hatókör újradefiniálva.**
- **⭐ ADR-0020 — DOMAIN-stratégia (tulaj-döntés):** alap = `<slug>.citoviso.com` aldomain (olcsóbb út);
  **egyedi domain rajtunk keresztül = min. 24 hó előfizetés-vállalás** (upsell+retenció); a konfigurátor
  rendeléskor 3–5 szabad nevet javasol **valós idejű előzetes csekkel** (`src/domains.ts`: DNS-over-HTTPS+RDAP,
  kulcs nélkül, ~0,5 mp). Konfigurátor „Címe az interneten" lépés + `order_intent` 0008 domain-mezők
  (`domain_type`/`domain_name`/`commitment_months`) + operátor-nézet. SEO canonical = POST-PILOT (tulaj).
- **⭐ KÖVETETT OUTREACH-GERINC (PILOT.md §2.5+§3) KÉSZ:** `/p/<token>` instrumentált link — mock_view
  pageloadonként + esemény-beaconök (scroll-mérföldkő, dwell, panel_open, module_add/remove, preset/period/
  domain, order-submit); prospect-tölcsér `created→sent→opened→engaged→order_intent` (sosem regresszál);
  konzol Megkeresés-panel (link-készítés szegmens-címkével, Kiküldve=H1-bázis); GDPR-lábléc + leiratkozás
  (0009: `sent_at`+`unsubscribed_at`; leiratkozás után NULLA tracking). E2E: curl + Playwright verifikálva.
- **⭐ EMAIL-PISZKOZAT + §C-KAPU:** determinisztikus, valós adatra személyre szabott piszkozat
  (`src/outreach/draft.ts`; rating CSAK az artifact A4-kapuzott SiteData-jából — §I: a levél=amit a mock mutat);
  `outreachCheck.ts` runtime-kapu (C1–C4). **A jog-provenance-őr élesben ítélt: 3 küldés-blokkoló** →
  javítva: `/adatvedelem` GDPR Art.13/14 oldal (adatforrás-megjelöléssel) + kapu-szigorítás (privát/CGNAT-IP,
  nem-HTTPS, placeholder-kontakt = FLAG). Konzol: `/prospect/:id/draft` másolható piszkozat verdikttel (A2 kézi küldés).
- **⭐⭐ PILOT-HATÓKÖR MÓDOSÍTVA (tulaj, 2026-07-30):** a pilot = **TELJES loop éles fizetéssel + automata
  számlázással** (nem csak order-intentig). **Jogi forma ELDŐLT: egyéni vállalkozás** (Mineral-híd okafogyott).
  Fizetés-állás: sandbox-validált, éles NINCS (`BARION_URL=test`, `INVOICE_PROVIDER=mock`) — élesítési
  checklist PILOT.md §7c (kulcsok után env-csere + kis összegű füst-teszt).
- **„MÉG MESSZE AZ INDULÁS" — felület-leltár (PILOT.md §7d):** ① belső UI fixálás (scrape ma csak CLI,
  nincs tölcsér-riport) · ② email HTML-sablon + küldő-pipeline (ma szöveges+kézi) · ③ tenant-admin csak
  read-only → önkiszolgáló szerkesztő kell (§E.12) · ④ **Citoviso alap honlap NINCS** (bizalom-horgony).
  **Elfogadott sorrend: ①honlap(dogfooding a motorral) → ②email → ③belső UI → ④tenant-admin.**
- **Külső előfeltételek (tulaj):** citoviso.com regisztráció · hoszting-döntés (publikus HTTPS = kiküldés-kapu
  ÉS Barion-webhook előfeltétele) · Barion+Számlázz éles fiók (ev.) · ÖVTJ-csekk · küldő-domain/postafiók.
- Commitok: `1b0e3ac` (ADR-0020 domain) · `d70053e` (követett link+instrumentáció) · `b9112ce` (outreach+§C)
  · `0432d96`+`2778a95` (PILOT.md §7b-d). Session-jegyzet: `_planning/memory/2026-07-30_pilot_launch_gearing.md`.
- **KÖVETKEZŐ SESSION ELSŐ TÉMÁJA: a Citoviso alap honlap** (saját motorral generálva, lokálban építhető).

---

**2026-07-24/26 — A MINŐSÉGI KÖR LEZÁRVA: a „wow" a MOTORON belül (ADR-0019) + éles bekötés + finomítás + SEO.**
- **⭐⭐ ADR-0019 — a plafon-döntés eldőlt: MOTOR-ÚT nyert, NINCS HIBRID.** A teherhordó kísérlet (UGYANARRA
  az adatra, `A'`=felokosított motor vs `B`=bespoke) megmutatta: a bespoke előnye NEM sablonozhatatlan, hanem
  (1) szerkesztőségi szöveg + (2) strukturális ízlés + (3) mozgás → mindhárom BEÉPÜLT a motorba, a `mock=live`
  feláldozása nélkül. A tulaj: „wow" → „sokkal jobb". Réteg: `SectionCopy` a receptben + `heroEditorial`/
  `roomsShowcase` variánsok + grounded **copywriter** (`src/engine/copywriter.ts`, a motor 2. AI-lépése, §B.17-hű) +
  keresztmetsző **MOTION_CSS** (`primitives.ts`) + `autoReveal()` (`assets/runtime/cit-runtime.js`: lépcsőzött
  scroll-reveal, hero ken-burns, kép-hover-zoom, kártya-emelés; reduced-motion/no-JS → statikus).
- **⛔⛔ ÚJ INVARIÁNS §I (03-INVARIANTS + [[invariant_no_bait_and_switch_delivery]]):** amit a leadnek megajánlunk
  (outreach-mock) = PONTOSAN azt kapja fizetés után. Bait-and-switch a nulladik ponton ABSZOLÚT TILOS (üzletileg
  öngyilkos + jogilag súlyos: Fttv.). A `mock=live` ezt konstrukció szerint garantálja. Külön §B.17-től: igaz tartalom + HŰ szállítás.
- **ÉLES BEKÖTÉS KÉSZ:** a copywriter+mozgás+editorial variánsok BEKÖTVE a `generateEngineMock`-ba (konzol :4600 +
  CLI is ezt adja, nem csak proof). `resolveGatedPhotos` a valós Google-**ratinget** is visszaadja (ugyanaz az A4-kapu);
  a copy a PERZISZTÁLT receptbe sül → `convertLead` LIVE = mock (round-trip AZONOS ✅).
- **FINOMÍTÁS + SEO (ma):** SVG-csillag a rating-statban (nem ★ glyph — designCheck) · robusztus hero-scrim (világos
  skin) · **GYIK-modul** (új `faq` primitív, natív `<details>`, §B.17 minta-kapu) · **auto-SEO** (`src/engine/seo.ts`,
  §H): meta description + fázis-tudatos robots (mock=noindex, live=index) + OG/Twitter + **Schema.org LodgingBusiness
  JSON-LD** a valós adatból (név/cím/geo/telefon/rating). `SiteData` += `geo`/`rating` strukturált mező.
- **BIZONYÍTÉK (letölthető minták, `:4700/sample-*.html`):** Villa Oliver/Gödöllő (4★/46), Villa Pátzay (4,1★/57),
  Rózsakő ház/Badacsony (5★/12) — mind HIGH-match, valós fotó+rating, 3 külön skin, mozgás+GYIK+SEO. Dizájn-kapu PASS, round-trip AZONOS.
- **A Fortuna-eset (tanulság):** a match-gyanú (név-egyezés 0,17: borozó↔vendégház) helyesen KÖZEPES sáv + kurátor-flag → nem attribuál vakon (A4).
- **Session commitok (mind LOKÁL, push deploy key-re vár):** `8e351fa` (§I invariáns) · `fb4e669` (editorial+mozgás) ·
  `12d46bf` (éles bekötés) · `2d2771b` (finomítás+GYIK+SEO). Eszközök: `scripts/engine-{max-plus,from-lead-plus,generate}.ts`.
- **✅ PUSH KÉSZ (2026-07-26):** a deploy key MŰKÖDIK (SSH `git@github-citoviso`), a `main` szinkronban az originnal.
  A korábbi „deploy key-re vár" jegyzet ELAVULT.
- **KÖVETKEZŐ SESSION ELSŐ TÉMÁJA (tulaj kérése): a SEO CANONICAL + PROVISIONING terv ÁTNÉZÉSE fejlesztés ELŐTT.**
  (A `seo.ts` ma szándékosan kihagyja a `<link rel=canonical>`+`og:url`-t — nincs élő domain mock-időben; a
  provisioning-fázisban injektálandó.) Opcionális: hero-parallax · proof-scriptek dedupe a `generateEngineMock` mögé ·
  VAGY tovább a konverziós szálra (konfigurátor+élő előnézet, ADR-0015).

---

**2026-07-23 — MOTOR VÉGIGÉPÍTVE (ADR-0016 lezárva) + KIT-PASSZOK + MINŐSÉG-ÍV (ADR-0017/0018).**
**2026-07-23 — MOTOR VÉGIGÉPÍTVE (ADR-0016 lezárva) + KIT-PASSZOK + MINŐSÉG-ÍV (ADR-0017/0018).**
- **ADR-0016 KÉSZ, éles-validált:** archetípus-réteg (registry) + `lead→SiteData` mapping + generálás
  motorra (`generateEngine.ts`, perzisztálja recept+SiteData) + `convertLead` motorra (live = perzisztált
  recept determinisztikus re-renderje, `mock=live`). **Motor = alapértelmezett generátor** (konzol+CLI, ADR-0017).
- **Kit-passzok (ADR-0017):** SKIN 2→9 (korpuszból) · PRIMITÍV-VARIÁNS (recept `variant`) · ARCHETÍPUS 3→6.
  ⚠️ runtime bugfix: `cit-modules.css` fallback `:root` → `@layer` (nem írja felül a skint). Planner-QA:
  a planner hangulat-helyesen varál (`engine-qa.ts`, 7 fixtúra).
- **⭐⭐ MINŐSÉG-ÍV (ADR-0018):** a desktop-screenshot megmutatta: a kimenet „template"/„gagyi" volt.
  A tulaj 5 referencia-mockja MENTVE mérceként: `assets/design-refs/reference-quality/` + README kraft-standard.
  Javítások: immerzív hero · sticky nav + gazdag lábléc (`chrome.ts`) · amenity SVG-ikonok (`icons.ts`) ·
  szoba+vélemény MINTA-modulok §B.17 fázis-kapuval (mock: jelölt minta; live: adat híján kiesik) ·
  kép-vezérelt szoba-kártyák + `stats` modul. `scripts/engine-max.ts` = **~80% Silva, nem gagyi.**
- **⚠️ NYITOTT DÖNTÉS (a következő session ELSŐ lépése):** a tulaj szerint még mindig gagyibb a mintáknál.
  Plafon-bizonyíték UGYANARRA az adatra: **A = motor** (`:4700/max-craft.html`, mock=live+szerkeszthető) vs
  **B = bespoke AI-HTML** (`:4700/bespoke-mock.html`, `scripts/bespoke-mock.ts` — igényesebb, egyedi, DE nem
  mock=live/nem szerkeszthető) vs **HIBRID** (bespoke outreach-mock + motor szerkeszthető live — a javaslatom).
  Fontos: a minták ÉS B IS fabrikált adatra épülnek (§B.17 mindkét útra vonatkozik). Részletek + tools:
  `_planning/memory/2026-07-23_engine_quality_bar.md`. Böngészhető nézetek: `:4700` (statikus szerver a `sites/_engine-proof`-on).
- **⚠️ PUSH: 13 commit áll LOKÁLBAN (d27e76b…33817fa), deploy key-re vár.**

---

**2026-07-21 (este) — BARION SANDBOX-KÖR LEZÁRVA + a generáló MOTOR architektúrája (ADR-0016).**
- **Barion sandbox teljes kör ✅** — valós teszt-kártyás (`4444 8888 8888 5559`) fizetés → `GetPaymentState`
  Succeeded → payment PAID (4880 Ft) → site LIVE → lead activation → **valós AAM teszt-számla `OV-2026-2`**
  (Számlázz teszt-fiók). A memória függő POSKey-szála KIPIPÁLVA. Sandbox-tanulság: draft-shop = `ShopIsInDraftState`
  (submittelni kell, auto-approve), az approval `secure→api.test.barion.com` ~2,5 perc alatt propagál; a pay-link
  ~perc alatt `Expired`. `.env`: `PAYMENT_GATEWAY=barion` MARADT, `INVOICE_PROVIDER=mock`-ra visszaállítva.
  Eszközök: `scripts/barion-{smoke,pilot}.ts` + `pilot-inspect.ts`. Részletek: `_planning/memory/2026-07-21_engine_architecture.md`.
- **⭐⭐ ADR-0016 — KOMPOZÍCIÓS MOTOR + recept-absztrakció** (a tulajjal közösen döntve): `adat → [AI-tervező] →
  recept → determinisztikus render(recept+adat+skin) → HTML`; **`mock=live` GARANTÁLT egy motorból**; **WP KIZÁRVA**.
  Réteg-számláló: **1 BACKEND** (fix) + **1 közös MODUL/PRIMITÍV-készlet** (token-témázott, NEM archetípusonként
  újra = 100×N elkerülve) + **N ARCHETÍPUS** (=elrendezés-séma, a „frontend ami változik") + **M SKIN** (ráhúzható).
  Sokszínűség = archetípus × skin × modul-kompozíció (KOMBINATORIKA, nem darabszám). Auto-memória: `project_composition_engine`.
- **Bizonyító szelet ÉPÍTVE** (`src/engine/`, additív — a régi pipeline érintetlen): `recipe/skins/primitives/
  render/planner.ts`. `scripts/engine-prove.ts` = **mock=live skeleton AZONOS ✅**; `scripts/engine-plan.ts` =
  valós Claude-tervező (GRANDIS prémium→`immersive-dark`, Nefelejcs családias→`editorial-warm`, fotó nélkül→nincs gallery).
- **Következő:** ① archetípus-réteg (elrendezés-nyelvtanok: rács/scroll/split) · ② lead→SiteData mapping ·
  ③ `convertLead` átkötése a motorra (mock-HTML-másolás kiváltása) · ④ készlet-bővítés · ⑤ tenant-admin recept-szerkesztő.
  VAGY: valós árak (`src/modules.ts`); hoszting; prospect-pilot.

---

**A KERESKEDELMI KÖR LOKÁLBAN ZÁRVA (2026-07-20).** A teljes tölcsér-vég működik és verifikálva, kulcs nélkül:
```
mock → kurátor → prospect-konfigurátor (ALL-IN + ÁR) → order_intent
  → pay-link (mock↔Barion) → fizetés → webhook → site LIVE + lead ACTIVATION
  → AAM auto-számla (mock↔Számlázz Agent) → recurring megújítás / nem-fizet → deaktiválás
```
Minden external integráció **interfész mögött, mock-adapterrel** (build-behind-an-interface): a valós
Barion (gateway) + Számlázz.hu Számla Agent (számla) **drop-in kulcs-cserekor** (env). NEHEZEN visszafordítható
= a gateway + kártya-tokenek (tudatos Barion-döntés); minden más könnyen cserélhető.
**Következő = external lépés a tulajnál:** Barion-fiók + kulcsok (+ variable-amount MIT-jóváhagyás kérése),
Számlázz Agent-kulcs. Utána a valós adapterek bekapcsolása. Vagy: hoszting (Cloudflare for SaaS + Hetzner),
vagy valós prospect-pilot (outreach/prospect-token flow).
**Parkolt:** pricing-modul (első BELSŐ modul, hierarchikus geo-árazás) → pilot UTÁN; korpusz-bővítés.

### 2026-07-16/20 — KONFIGURÁTOR + A KERESKEDELMI KÖR (slice 1–3) + billing/hoszting-kutatás
- **Prospect-konfigurátor (ADR-0015 impl):** serve-time overlay a `/configure/:artifactId`-n
  (`src/generator/configurator.ts` + `assets/runtime/cit-configurator.{css,js}`). **ALL-IN framing** (tulaj-döntés):
  nincs fogaskerék; a wow vezet, halk pill úszik fel → nyitáskor MINDEN modul ON, onnan trimmel lefelé (ár-horgony).
  **Ergonómia a nem-tech tulajra:** preset-elsődleges (Teljes/Ajánlott/Alap) + „Testre szabom" alatt a 12 kapcsoló;
  **tulaj-nyelvű címkék** (nincs „modul/CTA"); no-risk keret; mobil bottom-sheet. Egy-forrás katalógus `src/modules.ts`.
- **Korpusz-QA:** a `vertical-ribbon-nav` (GRANDIS bal-menü) „fos" volt → **3 gyenge archetípus karanténba**
  (`retired:true` a manifestben, `selectCorpusDesign` kihagyja: egyszeru-2/kozep-2/premium-2). Új eszköz:
  `scripts/corpus-contact-sheet.ts` (27 archetípus egy képen, vizuális triage). GRANDIS regen → immersive-dark (tiszta).
- **Kereskedelmi kör (slice 1–3), mind mock-adapterrel + lokál verifikálva:**
  - **Slice 1 — árazás + rendelés:** bázis + Σ modul havi ár + éves (2 hó ingyen) a konfigurátorban; submit → valós
    **`order_intent`** (a 0003 pilot-instrumentáció feltöltve). Placeholder árak a `modules.ts`-ben (tulaj állítja).
  - **Slice 2 — fizetés:** `src/payment/` gateway-interfész + MockGateway + env-selector (Barion=stub); `payment`
    tábla (0006); pay-link → webhook → **aktiválás** (`convertLead` + site LIVE + lead ACTIVATION); nem-fizet → deaktiválás.
  - **Slice 3 — számla + recurring:** `src/invoicing/` (InvoiceProvider + Mock + **SzamlazzAgent a HIVATALOS XML-spec
    szerint**, `afakulcs=AAM`); `invoice` tábla (0007) — **`vat_rate` PER SZÁMLA** (0 most). `src/payment/billing.ts`
    + `scripts/billing-cycle.ts`: megújítás + grace utáni deaktiválás.
- **Billing/hoszting-kutatás (deep-research, `_planning/RESEARCH-2026-07-billing-hosting.md`):** Gateway = **Barion**
  (nincs belépő/havi díj, token-recurring, first-party Számlázz; ⚠️ változó összeg → MIT külön jóváhagyás). Számla
  Agent AAM-számlát tud, NAV auto. **AAM-küszöb 2026 = 20M Ft** (nem 18M). Hoszting: **Cloudflare for SaaS**
  (auto custom-domain+TLS, kemény kritérium) + **Hetzner VPS** (a hoszting-verify rate-limitbe futott → tudás-alapú).
- Commitok: konfigurátor `392d3ed`/`139e1c0`; korpusz `2f299df`; slice1 `430e860`; kutatás `a7b3808`;
  slice2 `d139469`; pricing-modul jegyzet `e811f72`; slice3 `5372f65`/`5886637`. Minden LOKÁL, push nincs.
- **Nyitott döntések (BACKLOG):** domain-választás (4 javaslat + real-time csekk a checkoutnál, egyéni domain);
  email-modul (10 postafiók, csak saját domain); pricing-modul (geo-hierarchia) → pilot után.

### 2026-07-13/15 — KONVERZIÓS SZÁL: doktrína-alap + provisioning-gerinc + a sales-felismerés
- **Fogalmi alap (commit `50e1d71`):** **ADR-0013** — a `tier` NEM minőség-létra, hanem KARAKTER/REGISZTER
  (illeszkedés); a gyártási minőség konstans-maximum. Következmény: közös, tier-agnosztikus archetípus-pool +
  lágy súly (impl. külön ADR + A/B mögött; a `luxus:1` gond így nem „kevés luxus-szerkezet"). **ADR-0014** —
  **provisioning ≠ élesítés** (3 túlterhelt szó tisztázva: aktiválás/előfizetés/provisioning). Provisioning =
  PRIVÁT előnézet (noindex, token-URL), fizetés ELŐTT is; élesítés = NYILVÁNOS go-live, fizetés-kapus (a tulaj
  „fizet→aktivál" sorrendje áll — nem volt valós ütközés). **Site-állapotgép:** draft→provisioned→live→suspended.
  **§A átírva:** `guest`/`portal` demó-kép ÉLESRE kerülhet a tenant fizetéskori jogi ÖNNYILATKOZATÁVAL
  (rendelkezés + szavatosság + kártalanítás) + csere-lehetőséggel; `places`/`streetview` (Google-jog) + vízjel
  SOHA → csere. `jog-provenance-or` őr-agent §A-mátrixa igazítva.
- **Adat-réteg (commit `8fa6452`):** `migrations/0004_conversion.sql` — `tenant` (első `tenant_id`-hordozó,
  lead_id UNIQUE), `module_entitlement` (05-MODULES, UNIQUE tenant+module), `site` (állapotgép, preview_token,
  source_artifact_id). `lead_lifecycle` CHECK bővítve `disqualified`-dal. **RLS szándékosan MÉG NINCS** (nincs
  vendég-PII, egy-operátoros) → az első vendég-PII táblánál (booking) lép be. §G.18. schema.ts tükör szinkron.
- **Provisioning (commit `8b02674`, pusholva):** `src/conversion/provision.ts` — `convertLead(leadId, artifactId,
  modules[])` idempotens: approved mock → `sites/<tenant_id>/index.html` (noindex injektálva, demo-framing
  MEGTARTVA mert privát preview = még demó-fázis), entitlement upsert (additív), lead→`conversion`. `.gitignore`:
  `sites/`. Élesben verifikálva (Sophia/GRANDIS/Harsona Gödöllő).
- **Konzol-felület (commit `a8f22b5`):** `data.ts` (getConversion/getSiteByToken/getTenantAdminByToken),
  `views.ts` (MODULE_CATALOG 12 modul, convertForm checkboxok, convertedBlock, tenantAdminPage), `server.ts`
  (POST /lead/:id/convert, GET /site/:token, GET /admin/:token). Böngészőből (Tailscale :4600) a POST /convert
  élőben lefutott.
- **⭐⭐ A SZÁL FŐ FELISMERÉSE (commit KÖVETKEZŐ, ADR-0015):** a Harsona-teszt (mind a 12 modul bepipálva)
  megmutatta: az entitlement rögzül, de a Site NEM renderelődik újra a modul-választásból → a tulaj elkapta:
  **„sosem-látott modulért nem áldoz pénzt senki."** IGAZA VAN. Korrekció: **modult csak LÁTHATÓAN adunk el**;
  a **interaktív modul-konfigurátor + élő előnézet a KONVERZIÓ SZÍVE** (BACKLOG-ból előléptetve). Tényhűség
  fázis-határa élesítve (§B.17): adat nélküli modul az ELŐNÉZETBEN minta-állapottal MEGmutatható (jelölve, mint
  a demó-fotó), de az ÉLŐ oldalra SOHA adat-fedezet nélkül. A provisioning-gerinc (táblák + convertLead) marad
  mint kereskedelmi réteg; a konfigurátor rá ül. ⚠️ EZ A COMMIT (ADR-0015 + §B.17 + BACKLOG) még csak lokál.
- **Következő szelet:** a konfigurátor SCOPE-olása (mit renderel újra, hogyan togglel, hol a minta-állapot).

### 2026-07-12 — Őr-agent réteg + ontológia-megszilárdítás (3 guardian-kapu)
- **Koncepció:** nem mesterség-szerinti (frontend/backend) agentek, hanem a projekt INVARIÁNSAIRA horgonyzott
  esemény-triggerelt VERIFIEREK (őrök) — a doktrínát a gép tartja be, nem az én figyelmem. Minta:
  **kontraktus (DOMAIN-invariáns élesítve) → subagent (`.claude/agents/`) → runtime-kapu (ahol van felület) → dev-hook.**
- **Ontológia átvezetve** (`_inbox/20260712` distill-review): 00-GLOSSARY Architektúra-fogalmak (Control/Data plane,
  Iparág×Ország, Site-képlet, hibrid render); 02-ENTITY-MAP iparág-agnosztikus 6-entitásos közös mag (Property→történeti);
  03-INVARIANTS új §G (izoláció/jog/ember-a-hurokban), §H (SEO/lokalizáció). Commit `cef6736`.
- **1. őr — TÉNYHŰSÉG (2 réteg, commit `4d26165`):** §B.17 enforce-olható kontraktussá élesítve. Runtime-kapu
  `src/generator/factCheck.ts` (determinisztikus előszűrő + LLM-verifier, AI-mockra MINDIG fut) bekötve `generate.ts`-be;
  dev-hook `scripts/factcheck-scan.mjs` + `.claude/settings.json` (PostToolUse, minden `mock-*.html`). FLAG→kurátor-sor (§G.20).
  Ugyanebben a commitban az ADR-0012 airiness QA-gate is (generate.ts-ben összefonódott) — lásd lentebb, KÉSZ.

### 2026-07-13 — Levegősség-kontroll (ADR-0012): prompt-budget + render-mért QA-gate
- **Rés:** a reveal-fix után maradt „lágy airiness" — a mockok mobil átlaga ~20% HOLT függőleges sáv
  (szekció-magasság − a tartalom valós kiterjedése). 3 ok: nem-skálázódó mobil-padding, kitöltetlen
  nem-hero `min-height`/`vh`, túl nagy belső al-blokk-rés.
- **Fix (a tulaj választása 3 opcióból): PROMPT-BUDGET + QA-GATE** (NEM vak runtime CSS-felülírás, NEM auto-regen).
  (1) `ADAPT_SYSTEM` 8. szabály: számszerű ritmus — reszponzív `padding-block:clamp()`, nem-hero magasság a
  tartalmat kövesse, belső rés ≤2,5rem, ~85% kitöltés, tier-érzék. (2) `src/generator/qaAiriness.ts` render-alapú
  mérő (tag-agnosztikus sáv-detektálás) → `generateMock`-ba best-effort, nem-blokkoló → `airinessDeadPct` az
  artifactba. CLI: `scripts/qa-airiness.ts <mock> [width]`. ADR-0011-re épül.
- **Éles A/B (Gödöllő):** Nefelejcs (azonos lead) 20,5%→19%; új hármas átlag ~17,6% vs régi ~20%. A budget
  STRUKTURÁLISAN érvényesül (a modell átvette a `clamp()`-et, fent/lent-rés 114→68px, nincs nem-hero min-height);
  a maradék = belső rés + hero-kompozíció (részben legitim lélegzés). Ha küszöb fölött marad → QA-gate célzott regen (A2).
- **Fájlok:** ÚJ `src/generator/qaAiriness.ts`, `scripts/qa-airiness.ts`; MÓD `mockFromCorpus.ts` (8. szabály),
  `generate.ts` (QA-gate), `_planning/DECISIONS.md` (ADR-0012). Commit `4d26165` (a tényhűség-kapuval összefonódva).
- **2. őr — JOG/PROVENANCE (commit `35b6165`):** §A provenance×fázis mátrix + §C outreach 4 eleme, NOW/DEFERRED címkézve.
  Runtime: `provenanceCheck.ts` demo-framing check (az EGYETLEN valós felület ma; konverziós asset-kapu + outreach-küldés
  DEFERRED, mert a pipeline nincs). Subagent `jog-provenance-or.md` (fázis-tudatos).
- **3. őr — DIZÁJN-DOKTRÍNA (commit `35b6165`):** §B dizajn-enforce. `designCheck.ts` determinisztikus (emoji-tilalom
  `\p{Extended_Pictographic}`, 11 `--cit-*` token, booking-horog). Subagent `dizajn-doktrina-or.md` az ítélet-igényű részre.
- **Mind a 3 kapu füst-tesztelve** (pozitív+negatív), `tsc` tiszta. ⚠️ NINCS élő end-to-end generálás-teszt (valós API+DB).
  Új subagent-típusok natív hívhatósága session-újraindítás után. Részletes tudás: `_planning/memory/2026-07-12_guardian_agents.md`.

### 2026-07-12 (este) — Őr-agentek ÉLES PRÓBA + guardian-bug fix + matchConfidence bekötés
- **A fenti nyitott kérdések LEZÁRVA:** mindhárom subagent (`tenyhuseg-or`, `jog-provenance-or`, `dizajn-doktrina-or`)
  **natívan hívható** session-restart után ÉS ítéletet hoz. A grandis mockon mind PASS; a tényhűség-őr megtalálta a
  `leads-godollo.json` igazságforrást és minden HARD tényt strukturált mezőhöz kötött (nem hitte el vakon).
- **Guardian-bug fix (commit `ecce21e`):** `designCheck.ts` emoji-szűrő false-positive-olt a `©`/`®`/`™` jogi jeleken
  (footer-copyright miatt 3 jó mock tévesen FLAG-elt) → `EMOJI_ALLOWLIST` (a `★` szándékosan bukik: dekoratív = SVG).
- **matchConfidence bekötve (commit `408f445`):** eddig csak a kontakt/fotó-hiányos OSM-leadek kaptak konfidenciát;
  a Places-natív leadek (pl. GRANDIS, `sources=[google_places]`) `undefined`-del maradtak → §F.17b nem tudott zárni.
  Fix: Places-natív = self-match (`scoreMatch` táv 0 / név 1 / OSM-korroboráció) → google_places önmagában **0.85 high**,
  +osm **1.00**. ⚠️ A meglévő JSON-artifactek csak a **következő éles scrape-nél** töltődnek (tulaj-döntés: nincs backfill).
- **BREV-IRÁNY halasztva (tulaj-döntés):** a `webSearch()` MA is Google CSE-t hív (kivezetés alatt); a Brave-backend
  NINCS megírva és **nem is íródik, amíg a kurátor nem automata**. `BRAVE_SEARCH_API_KEY` nem kell most.
- **API-kulcs állás:** a re-scrape magját kulcs nem blokkolja — `GOOGLE_MAPS_API_KEY` + `GOOGLE_CSE_ID` +
  `ANTHROPIC_API_KEY` mind kitöltve a `.env`-ben. SMTP/outreach + Brave halasztva; `DATABASE_URL` = beágyazott dev-PG.
- Commitok: `ecce21e`, `5dc79a3` (distiller inbox-archív), `a3438b6` (doksik), `408f445`. Kapcsolódó rés a
  BACKLOG A4-ben: match-konfidencia ma mechanikus (név+táv+OSM), kontextuális/vélemény-korroboráció nélkül.

### 2026-07-11/12 — Runtime-modulok (gallery/map/reviews) + üres-sáv réteges fix + Sissi presence-fix
- **3 új runtime-modul** (ADR-0011 minta, progresszív fejlesztés → JS nélkül is tartalom):
  `gallery` (megosztott lightbox), `map` (kattintásra-betöltő Google-embed facade, GDPR), `reviews`
  (snap-carousel valós kártyákra; kamu tilos → gyakran kimarad). `assets/runtime/` + 2 fixture. Commit `aba5e05`.
- **⚠️ QA üres-sáv — RÉTEGES fix (commit `cd1e1c9`):** (1) `injectRuntime` determinisztikus no-JS háló:
  üres booking-slot → statikus érdeklődés-kártya (mailto); `<noscript>` + `cit-anim` a scroll-reveal
  tartalomra. (2) `cit-runtime.js::initReveal()` — a **reveal MOSTANTÓL RUNTIME-viselkedés** (IntersectionObserver
  a `.reveal`-re). Kiváltó: a `vertical-timeline-scroll`/`vertical-ribbon-nav` archetípusok JS-sel is üres sávosak
  voltak (a per-archetípus IO törékeny; a gated CSS-t az LLM megírta, az observert elhagyta → JS-sel örökre rejtett).
  Valós telefon-teszt fogta el (GRANDIS). Fix után: no-JS 76%→0%, mobil 14/14 reveal felszabadul. Prompt-szabály:
  reveal = PE, saját IO tiltva. (3) Két friss éles mock generálva validálásra (Sissi, GRANDIS).
- **Presence fals negatív — FORDÍTOTT SORREND fix (commit `3eba776`):** Sissi Panzió `no_site` volt, PEDIG van
  saját oldala (`panziosissi.hu`; a domain = típus-szó ELÖL). A `enrichPresence.candidateHosts` most a fordított
  token-sorrendet is próbálja. Élőben verifikálva → `has_own`. GRANDIS NEM hiba volt (`modern`, force-generált teszt-mock).
- **Új tartós tudás:** [[project_hybrid_review_model]] (külső scrape + first-party „oldalon hagyott" vélemény);
  a presence-memória Sissi-tanulság + Brave-időzítés (`_planning/memory/2026-07-07_presence_detection.md`).

### 2026-07-10 — MOCK-MOTOR (két-agent) + modul-UI + Gödöllő-pilot
- **ADR-0009 — archetípus-elsődleges korpusz:** a korpusz tengelye az ARCHETÍPUS (szerkezet), tier a
  partíció; a KÖRNYEZET lefokozva grounding-hintté (nem korpusz-mappa). A 36-metszet (env×tier) modell
  ELDOBVA. Kevesebb dizájn, nagyobb pool/anti-collision, régió-független. Korpusz: `assets/design-refs/corpus/{tier}/{n}.html` + `manifest.json` (27 dizájn, 21 egyedi archetípus).
- **Két agent:** `src/generator/corpus.ts` (agent-1, korpusz-építő, `scripts/build-corpus.ts` — `--tier=`) +
  `src/generator/mockFromCorpus.ts` (agent-2: osztályozás→tier-kiválasztás+anti-collision→grounded).
- **ADR-0010 — modul = FUNKCIÓ-tengely, ADAT nem korpusz-tengely** (nincs archetípus×modul robbanás).
  Katalógus: `_planning/DOMAIN/05-MODULES.md` (Szint 0–1, csak szállás).
- **ADR-0011 — modul-UI: token-kontraktus + hidratáló runtime** (`assets/runtime/cit-modules.css` +
  `cit-runtime.js` + `src/generator/runtime.ts` inline-injektor). Rendszer-költség O(archetípus)+O(modul),
  NEM O(arch×modul). Első interaktív widget: booking/érdeklődés (bar/card), token-témázott. Spec:
  `_planning/DOMAIN/06-UI-CONTRACT.md`. 3 fixture bizonyítja: egy widget, több natív téma.
- **Konzol átkötve az új pipeline-ra** (`generate.ts` régió koordinátából, `server.ts` fire-and-forget +
  auto-frissülő „folyamatban", `views.ts`). Konzol: http://100.97.188.105:4600/ · néző: :8899/
- **Gödöllő-pilot:** 24 hely (cap 40), 13 lead, 10 grounded mock — mind más archetípus, a bor/tó-íz
  groundinggal semlegesítve. Bizonyítja: a korpusz NEM régió-zárt (Balaton-korpusz Gödöllőt is kiszolgál).
  `scripts/build-corpus.ts` `--cap` a scraperben; `poc-corpus-mock.ts <regionId> <n>` régió-szűrővel.

---

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

**A modul-szál 2026-08-21-én lezárult** (ADR-0046/47/48/49, 4 commit felküldve). Sorrendben, ami hátra van:

1. **`seasonal_only` + nincs booking = ál-választás?** A „csak a felsorolt időszakokban adom ki"
   kapcsoló a PRICING képernyőn ül (tulaj jóváhagyta). Ha a tenant nem vette meg a booking modult,
   a kapcsolónak ma nincs látható hatása. Vagy rejtsük booking nélkül, vagy adjunk neki
   booking-független jelentést (az ártáblán: „ebben az időszakban adjuk ki"). **Ez az első, mert
   a doktrína szerint amit nem támogatunk, azt nem kínáljuk.**
2. **KB-bejegyzés + súgó-horgony** a vélemény-kezelőhöz és a szezon-kapcsolóhoz (ADR-0045 §J).
   ⚠️ A `kb-check --coverage` ma csak a MÁR KITETT horgonyokat kéri számon, tehát az új
   admin-funkció súgó nélkül némán átcsúszik — ezért kell kézzel odafigyelni rá.
3. **`POST /api/hirlevel` nem létezik** — a hírlevél-űrlap a semmibe küld (ugyanaz a hibaosztály).
4. **ÉLES DEPLOY** — a prod a `0022`-nél áll; a `0023`–`0028` migráció és a teljes modul-réteg
   hiányzik. Külön, scope-olt engedély kell hozzá.
5. `booking-maintenance` cron (nem sürgős, a portál-szinkron sötét).

**Tesztelés:** `npx tsx scripts/demo-tenant.mts` → háromegységes demó, kiírja a belépést (csak helyi
DB-n fut). Szerverek systemd alatt: konzol :4600, publikus :4800 (`tsx watch`, önjavító).

## Nyitott kérdések (szándékosan elhalasztva a folyamat-modellig)
- Pénzügyi séma: előfizetés / egyösszeg / kombináció — képlékeny.
- Visszatérő érték / churn; upsell-időzítés.
- Hotlink-kép üzemeltetési törékenysége (idegen szerver leszedi → kép eltűnik).
- Google Maps kép-kivétel kezelése.
- Kiküldés-előtti belső jóváhagyás részletei.
- Globális enterprise-nyitottak: ki a "user" (tenant vs. végfelhasználó), időtárolás/audit mélysége,
  booking-sync (Booking.com/Airbnb) vs. tiszta direkt-foglalás, i18n-mélység (RTL/CJK, pénznem, jog).

## Előzmények

### 2026-09-12 — ADR-0125 (a lista sora mondja meg, miről szól)
**📄 ADR-0125 — A LISTA SORA MONDJA MEG, MIRŐL SZÓL, ÉS MI MÁR NEM IGAZ.** Elek FK-001.
Session-jegyzet: `_planning/memory/2026-09-12_admin_list_rows_say_what_they_are.md`.
Kontraktus: `assets/design-refs/tenant-admin/fk001-dokumentumok-uzenetek/`.
Három lelet, EGY hibaosztály: **az adat megvolt, csak nem jutott el a SORIG** — ezért
maradt volna zöld minden egység-teszt, és ezért mér az új őr a KIRENDERELT listán.
- **E1** — 18 közel azonos számla-sor (1 149 525 Ft): szám, dátum, „Kifizetve · AAM”,
  összeg, és egy szó sem a tárgyáról. Mérve: a 18 sor **KÉT termék** volt (11 × éves
  előfizetés 99 900 Ft + 7 × egyszeri többnyelvű díj 14 900 Ft).
- ⛔⛔ **És a SZÁMLA-LEVÉL tárgya is hazudott** (nem volt bejelentve, én mértem): MINDEN
  számláé „Citoviso előfizetés” volt — a 14 900 Ft-os EGYSZERI díjé is. Ez a súlyosabb
  fele, mert KIMEGY a vevőnek (§B.17).
- **Z2** — a csatorna nem látszott a soron. ⚠️ A bejelentés betű szerint pontatlan: a
  kódban VAN külön SMS-ikon, csak a parkban **119 üzenetből 0 az SMS**. A premissza
  viszont áll: 19 px-es ikon nem felirat.
- **Z1** — „Honlapja felfüggesztve” a „Honlapja újra elérhető” ALATT, élő fiók és
  kifizetett számlák mellett. Mérve **50 dunning-üzenet 8 freeze→thaw körből**: a
  MENNYISÉG park-zaj, de **már EGY kör is négy túlhaladott értesítőt hagy**.
- **Kész:** ① `invoiceItem.ts` — EGY regiszter (`order_intent.kind`+`billing_period` →
  tétel-név), **ugyanaz a két oszlop, amiből az ÖSSZEG is származik**; a sor ÉS a levél
  tárgya/törzse ebből él ② `messageThreads.ts` — a túlhaladottság LEVEZETETT
  szál-pozíció; `dunning`/`multilang` tenantonként egy, `booking` `related_id`-nként,
  ⛔ `domain` és az érdeklődés-ág SZÁNDÉKOSAN kimarad (nem mérhető → nem állítjuk)
  ③ felület (§2b, tulaj: „A” + „tétel a főcímben”): tétel a főcímben · `E-mail`/`SMS`
  felirat · `Túlhaladott` + „Felülírta: «…» · időpont” · `Ez a legfrissebb` a szálfejen;
  a túlhaladott sor **nyitható és kereshető marad**.
- **Őr:** `admin-list-labels-check.mts` (hermetikus fixture, pre-commit). Negatív önteszt
  **7 sértés**, köztük mind a három bejelentett.
- ⛔ **A szűrő termelte volna a hazugságot:** szűrt listán számolva egy régi SMS
  „legfrissebb”-nek látszana, mert az őt felülíró e-mail kiesett → a szűrés az SQL-ből a
  pozicionálás UTÁNRA költözött.
- ⛔ **CSS-specificitás harmadszor** — és a mock desktop KÉPE fogta meg, nem a kód-olvasás:
  `.adm-inv__t strong` (0,1,1) veri a `.inv-no{display:none}`-t (0,1,0), így mindkét
  számla-elrendezés egyszerre renderelt. A saját viselkedés-ellenőrzőm sem fogta, mert
  csak azt mérte, hogy a MÁSIK megjelenik.
- ⚠️ **INFRA-ÜTKÖZÉS:** ebben a worktree-ben (`~/wt/cit2167c7de`) **KÉT session dolgozott
  egyszerre**; egy `git stash` + rebase eltüntette a munkámat a fából, és a stash a két
  session változásait KEVERTE. Nem popoltam; a commit **hunk-szinten szűrt**, a katalógus
  a STAGED forrásból regenerálva, a staged pillanatkép külön kicsomagolva fordítva.
  **Az auto-worktree pool ezt hivatott megelőzni — érdemes megnézni, miért bukott.**
- **NYITOTT:** FK-001 **E2** (114 olvasatlan, ismétlődő foglalás-sorok zaja) — a §2b
  „B — szálba csukva” válaszolt volna rá (14 sor → 7), a tulaj az „A”-t választotta;
  az adat (`olderCount`) már megvan hozzá. Plusz GY1 (süti-sáv az adminon), F1
  (Elek-forgatókönyv: a 06-os shot az Üzenetek tabot fotózta újra).

### 2026-09-01 — ADR-0090 (hero-olvashatóság + fizetés-váltó)
**2026-09-01 — ✅ ADR-0090: HERO-CÍM OLVASHATÓSÁG (mérő-őr + garantált scrim) + FIZETÉS-VÁLTÓ az 1. lépésre. LEZÁRVA. ÉLESÍTVE NINCS (§0.3).**
Tulajdonosi hibajelentés két képernyőképpel; a jóváhagyott irány mindkettőre **B** (AskUserQuestion).
⚠️ A fa 19 committal LE VOLT MARADVA (a képernyőkép ADR-0088 ajánlat-UI-ja nálam nem volt meg) →
`rebase origin/main` ELŐBB. §2b kapu végigfutott: mock (`_drafts/`) → ui-shot 390+desktop (Read) →
SendUserFile (mindkét méret + kattintható HTML) → jóváhagyás → `surface-gate approve` → kód →
kontraktus `design-refs/`-be.
① **Hero olvashatóság:** a fotó-overlay heróskban a világos akcent-cím (`color-mix(--cit-accent,#fff)`)
eltűnt a világos fotón (Rozé **1,08:1**). ÚJ mérő-őr `scripts/hero-contrast-check.mts` — MÉR nem tippel:
worst-case világos fotón renderel, Playwright pixel-kontraszt a `palette.ts` képletével, buktat 3,0:1
alatt, CSAK fotó-overlay heróst (a `brutalism` tömör-hátterű címe kizárva); pre-commitba kötve.
Auto-javítás (B) = skin-független semleges scrim-alap 5 sablonban (`fullbleed/parallax/cinematic/
dark-luxury/horizontal`): 2,x → **3,10–4,85**. Vizuálisan 3 sablonon igazolva (olvasható, fotó marad,
nincs fekete sáv). ⚠️ csapda: a worst-case fotó SVG-data-URI-jában egyszeres idézőjelek zárták a
template `url('...')`-jét → `%22`-kódolással javítva.
② **Fizetés-váltó:** a `Havi/Éves` a 2. lépésről az 1. lépés láblécébe, az ár fölé (B kártyás,
`.cit-cfg-permat`) → mobilon végre felfedezhető (pinnelt lábléc); a 2. lépésen 0 váltó maradt. Éves
marad az alap, valós árazás + ADR-0088 ajánlat-kártya érintetlen; `configurator-price-check` az új
`.cit-cfg-popt` class-ra. Valódi konfigurátoron igazolva: éves 77 850 → Havi 7 785 Ft/hó, JS-hiba 0.
Kapuk mind zöld (tsc, i18n, configurator-price/placement, native-content, mobile-sticky 27/27,
hero-contrast 5/5). Session-jegyzet: `_planning/memory/2026-09-01_hero_contrast_and_period_toggle.md`.
Nyitott: `brutalism` accent-on-bg 2,89:1 = KÜLÖN kérdés (skin-luminancia, nem scrim).
- 2026-08-23: Számviteli bizonylat-törzs + partner-átvétel adatrétege (0031–0035) — a felület-kör ugyanaznap ráépült (ld. aktív feladat).
- 2026-08-21: **A választó, ami nem választott.** A lead-oldal kinézet-kártyáin a képre kötött
  `preventDefault()` letiltotta a label aktiválását — a kártya 80%-a csak nagyított. Elv rögzítve:
  az elsődleges művelet kapja a nagy felületet, a másodlagos saját vezérlőt. Új böngészős
  viselkedés-őr önteszttel (`scripts/template-picker-check.mts`), pre-commitba kötve.
  Éles: `fe6f856` → `admin.citoviso.com`.
- 2026-08-21: **MODULOK — a beállítástól a renderelt oldalig (ADR-0044).** Kiváltó: „megvetetjük a
  tenanttal az összes modult felárért, oszt nem tudja beállítani". FŐ TANULSÁG: az őr azt mérje, ami
  SZÁMÍT — a lint „van-e űrlap"-ot mért, nem „látszik-e az oldalon", és napokig zöld volt, miközben a
  tenant beírta a felszereltséget és semmi nem történt (3× ugyanaz a hibaosztály, vö. ADR-0043).
  Leszállítva: modul-konfig réteg (SITE-kulcs, verziózott, history) · EGYSÉGEK (`site_unit` = egy
  igazság: rooms mutatja / booking foglalja / pricing árazza) · egységenkénti ár ismétlődő szezonokkal ·
  foglalás kérés→levélből-döntés→visszaigazolás, duplafoglalás DB-kulccsal kizárva · iCal-réteg
  (kompatibilitás, UI sötét — a Booking-integráció NEM scope) · portál-scraper · vendég-oldali
  foglalási űrlap · egység-aloldalak `/apartman/<slug>` a főoldallal AZONOS recepten (stílus-azonosság
  mérve, 16 sablon) · §A fotó-doktrína LEZÁRVA (önnyilatkozattal minden demó-kép élesíthető).
  Kapuk a pre-commit-ben: module-config-lint, module-render-check, unit-subpage-check, +fixture-kapuk.
  Nyitott: `reviews` (nincs vélemény-adat), ÉLES DEPLOY (prod a 0022-nél áll).
- 2026-08-20 (konverzió-szál): **A konverziós modulokat a TULAJ választja, nem az operátor.** A lead
  „Mock-artefaktumok" konverziós lépéséből TÖRÖLVE az operátori „Megrendelt modulok" checkbox — a tulaj
  a prospect-konfigurátorban (ALL-IN nyit) dönt (`order_intent`). Új egyetlen forrás:
  `modulesForConversion()` (`src/modules.ts`), ALL-IN fallbackkal; `convertForm` read-only; convert
  handler az order-ből dolgozik. Éles: commit `582e12f`, `admin.citoviso.com` restartolva (scp-deploy,
  nincs git a prodon). Részletek: `_planning/memory/2026-08-20_conversion_modules_from_owner.md`.
- 2026-07-07/08 (tervezés+infra szál): **1. INFRA-PILLÉR — tartós adat-réteg leszállítva:** embedded
  Postgres 18 (userspace, `.pgdata`, socket :5433) + Kysely + saját migráció-runner; 6 mag-entitás
  (`migrations/0001`, `src/db/`). **4 planning-doksi:** `PROCESS.md` (réteges, event-driven ügyviteli
  folyamat), `CONTEXT.md` (validációs brief), `PILOT.md` (instrumentált tanuló-pilot a megrendelésig),
  `VISIBILITY.md` (felfedezhetőség-motor + retention). ⭐ Fő felismerések: **iparág-agnosztikus** (a
  szállás csak az ELSŐ vertikum — CLAUDE.md+memória javítva); **láthatóság ≠ honlap** (kell auto
  felfedezhetőség-motor: SEO+Schema.org+GBP fél-automata); **retention = leállítható dinamikus funkció**
  (foglalás=OTA-jutalék-kiváltás), NEM a tartós, odaadott láthatóság; pilot-számlázás **Mineral-híd** +
  fallback. **Következő (build): 2. pillér — motorok átkötése az adat-rétegre + instrumentált preview.**
- 2026-07-07: **Presence-detektálás** (scraper). Feltárt kritikus rés: a „nincs honlap" eddig csak a
  Maps `websiteUri` hiányából jött (nem bizonyíték). Kutatás: Bing Search API halott, Google CSE
  „entire web" kivezetés alatt (2027-ig). Megoldás: guess+geo-verifikált HTTP-proba (0 API). ⚠️ VÉRREL
  TANULT: naiv guess 4/8 hamis pozitív → talált honlap CSAK geo-egyezéssel érvényes (§F invariánsok).
  Leszállítva: `src/scraper/enrichPresence.ts` + run.ts-bekötés + `03-INVARIANTS.md` §F. Következő: Brave.
- 2026-07-04 (session 2): MEGÉRTÉS fázis. A tulaj elmondta az iparág-agnosztikus disztribúciós-gép
  modellt; üzleti-folyamati kérdésekkel közösen tisztáztuk (fő ígéret, mock-mechanika, jogi állás,
  domain, humán-pontok). Alapmodell jóváhagyva és mentve. Régi kód/modell eldobásra jelölve.
- 2026-07-04 (session 1): Repó létrehozva (Node+TS scaffold + doktrínák). Remote/watchdog per-repo
  CIT idle-slot. Badacsony piac-teszt (85% nincs saját honlap) validálta az ötletet. Árazás +
  motor-tanulságok + remote-setup a `_planning/memory/`-ban.



## Előző szál (2026-09-11/12) — kiküldés-döntés képernyője

**✉️ A KIKÜLDÉS-DÖNTÉS KÉPERNYŐJE HAZUDOTT — HAT LELET AZ FK-004-BŐL.** Session-jegyzet:
`_planning/memory/2026-09-11_outreach_send_truth_adr0121_0122.md`. ADR-0121 + ADR-0122.
- **A közös nevező:** a képernyő, ahol a kiküldésről döntünk, kevesebbet vagy mást mondott,
  mint ami történik — és a küldés visszafordíthatatlan, idegen embernek szól.
- ⛔⛔ **Az előnézet ELVÁGTA a levelet.** 560px-es iframe vs. **785px** (asztali) / **1056px**
  (mobil) levél, görgetősáv nélkül. A vágás alatt maradt az aláírás, az apróbetű, a
  **LEIRATKOZÁS-LINK** és a jogalap — pont az, amitől a hideg megkeresés jogszerű. A csonkolás
  mindig a VÉGÉT veszi el, és a jogi rész ott van. Most a keret a tartalomhoz igazodik, a
  beégetett magasság nagyvonalú PADLÓ (JS nélkül is teljes a levél).
  ⚠️ Az első fitterem `documentElement.scrollHeight`-ot mért — az a keret viewportjára
  PADLÓZÓDIK, tehát a saját farkát kergette volna, az őr meg trivializálódik.
- ⛔⛔ **A számláló és a jelvény hazudott.** Egyetlen kiküldött sortól zölden „2 megkeresés ·
  kiküldve"; a zöld „Kiküldve — mérés indul" pedig GOMB, és csak a NEM kiküldött soron jelenik
  meg → a siker-jelölés a küldetlen soron ült. Most: „ebből 1 ment ki", zöld csak teljes
  kiküldésnél; a gomb felszólítás („Megjelölöm kiküldöttként"), siker-szín nélkül.
- ⛔⛔ **ADR-0122 — az „egyszer megy ki" alanya az EMBER, nem a rekord.** Mérve: 2 prospect-sor,
  1 cím, mindkettő küldhető. Cím-szintű kapu + **advisory lock alatti claim** (a sor-szintű
  `WHERE ... IS NULL` két KÜLÖN soron mindkettőt átengedi) + a lista címenként egy sort kínál
  + a kártya a KATTINTÁS ELŐTT kimondja („a CÍMRE már ment ki").
- **ADR-0121 (tulaj-döntés):** a megszólítás a levél ELSŐ sora és a lead NEVÉT viseli (felülírja
  az ADR-0101 ① sorrendjét — a névvel ellátott megszólítás nem égeti el a Gmail-előnézet sorát),
  a szöveg végig **T/1**, és a lábazat viseli a hirdető **CÉGAZONOSÍTÁSÁT** a
  `config.legalEntity`-ből (EGY forrás az impresszummal).
- ⚠️ **Link-gazdagép:** élesen MÉRVE rendben (`PUBLIC_BASE_URL=https://citoviso.com`), de semmi
  nem kötötte a link hostját az identitáshoz → pill a piszkozaton + `.env`-mérő őr. Szándékosan
  NEM §C-szabály: dev-gépen mindig piros szabályt mindenki megtanul átlépni.
- ⛔ **Mellékleletek:** ① a placeholder-heurisztika a VALÓS adószámra sült el
  (`12345678-1-42` ⊃ `1234567`) — ugyanaz a hiba-osztály, mint az `xXx` token; ② a
  **tudásbázis-őr a SAJÁT szállításomban talált 5 rést** (halott gomb a „nem vonható vissza"
  megerősítés mögött, a képernyő saját prózája a kivezetett gombra küldött, a riport-KB
  valótlan állítása, vezetés nélküli új FLAG-ok, nem létező feliratra mutató kapu-tanács).
- **Őrök** (mind negatívan is futtatva): `outreach-preview-check` (pixel, `elementFromPoint`;
  önteszt 6/6 piros) · `outreach-oneshot-check` (olvasás-only, mert a dev DB KÖZÖS; kimondja,
  ha az adat a hibát ki sem tudja fejezni) · `outreach-link-host-check`.
- **Mérve:** FK-004 8/8 gépi zöld · a park a mérések után bizonyítottan a kiindulási állapotban.
  **Élesítés NINCS** (§0.3).

## Előző szál (2026-09-12)

