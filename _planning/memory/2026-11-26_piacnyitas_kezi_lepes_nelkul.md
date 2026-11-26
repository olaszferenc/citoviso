# 2026-11-26 — Piacnyitás után nulla kézi lépés (felderítés magától)

Session `cit9d514f15` (SUB), koordinátor `cit9b4690e3`, brief `~/rc-briefs/piacnyitas-kezi-lepes-nelkul-20261126.md`.

## Mi kellett kézzel a HR élesítésnél → mi a kód-szabály most
1. Régió + csempe az új országra → `ensureDiscoveryArea()`: régió-sor az OSM ISO 3166-2 határ bboxából (Overpass, $0), `ensureTiles`; amikor a terület először kerül sorra.
2. Kettős régió-elnevezés → `discoveryRegionId()` az egyetlen forrás; a lánc a `plan` kimenetéből olvassa; a Python-iker (`orszag.region_id`) önteszttel ellenőrizve (`teruletek.py selftest`: 40 terület, 0 eltérés).
3. `COUNTRY` fájl + `START` env → a bejárt országok = nyitott piacok (`discoveryCountries`), kezdőpont = szótár `chainFelderitoStart`.
4. Elavult ország-cache → `orszag.py`/`orszag.mjs`: ismeretlen ország → egyszeri azonnali újraolvasás.
5. Őr (`orzo.sh`): nincs „minden megye kész” megállás, egy később nyitott piac magától sorra kerül.

## Vak próba (dev DB, HR — a dev-en eddig nem bejárt terület)
- HR piac megnyitva a dev-en (`approveMarket`; a dev konzol a hiányzó EUR-tárca-beállítás miatt elutasítaná, ezért `BARION_WALLET_CURRENCIES=HUF,EUR`).
- `osszes.sh` (CIT_DB=dev, COUNTRY=HR, TILE_LIMIT=3, DETAIL_LIMIT=10): `terulet-hr-17` régió + 340 csempe magától (ugyanannyi, mint a kézi éles), Makarska-csempékkel kezdve; 22 új lead (19 no_site, 3 outdated, 16 telefonnal); utána magától továbblépett: `terulet-hr-19` + 187 csempe (leállítva).
- Kontakt: `kontakt/futtato.sh` (CIT_DB=dev) a dev lead-fájlból felvette a 22 leadet.
- HU: a terület-lista az új úton bájtra azonos a régivel (19 terület); éles HU megyék mind ELESITVE, a 20 megye-sornak megvannak a csempéi → ensure no-op.

## Fájlok
Repó: `src/scout/discoveryAreas.ts`, `scripts/discovery-areas.mts`, `src/countryLexicon/hr.json`, `src/countryReadiness.ts`, `src/console/countryViews.ts`, `scripts/country-layer-check.mts`, `hooks/pre-commit`, `src/i18n/catalog*.json`.
Lánc (uj-lanc-hr git): `felderito/{teruletek.py,osszes.sh,orzo.sh,felderito.py,elesit.py}`, `orszag.py`, `orszag.mjs`, `kontakt/futtato.sh`, `atallas-felderites.sh`.

## Audit a/b/d (koordinátor kérésére, ugyanazon a napon)
- (a) Jelöltek csak NYITOTT piacról: `orszag.py open_markets()` (az app terve: kapu + szótár + keresőszó; 10 perces cache, hibánál a régi lista, lista nélkül semmi) → `OPENCC` a `hc-cand.sql`/`nj-cand.sql`-ben, a kontakt-backlogokban; a `lanc.sh` GATECC = nyitott ∩ sor < MAX_BACKLOG. Dev-mérés: HU+HR nyitva a `cand`/`hc-cand`/`nj-cand` kimenete bájtra a régi; csak HU nyitva pontosan a nem-HU esik ki.
- (b) `fo-cand.sql`: GATECC, a lead országa countryOf szerint (alias, scrape-terület), városkulcs = `townKey()` — `fo-terv/townkey_sql.py` generálja (Unicode-ból, ctype-független), `townkey-twin.sh` méri: prod 2439, dev 1322 város, 0 eltérés. Dev: +2 HU lead („MAGYARORSZÁG” alias), amit a régi kihagyott.
- (d) `kontakt/felre.mjs`: zárt/szótár nélküli ország leadje okkal `out/felre.tsv`-be kerül (egyszer), és a piac nyitásakor magától visszajön (dev: zárt HR → 22 félre, nyitás után 25/25 felvéve).
- (c) auto-approve.mts: nem nyúltam hozzá (a cita363cd23 F4 váltja ki).
- Dev-hiány (megoldás nélkül): `~/.config/citoviso/neo-dev-operator.txt` nincs, ezért a kontakt dev-írása (apply.mjs) nem fut.

## Nyitott (koordinátornak)
- Átállás: deploy (discovery-areas.mts élesen) + fő-fa ff után `bash ~/rc-briefs/uj-lanc-hr/atallas-felderites.sh check|go`.
- Az átállás-szkript (atallas-felderites.sh) most a felderítést ÉS az audit a/b/d-t együtt viszi.

## Részenkénti élesítés + településkép just-in-time (koordinátor 2026-11-26 14:00, élesen mérve 13:50)

**(1) Felderítés részenként** (lánc-másolat `~/rc-briefs/uj-lanc-hr/felderito/`):
- `maps_crawl.mjs` csempénként dolgozik: egy csempe listázása (minden szóval) → a már bejárt csempék helyeinek adatlapjai → következő csempe. Egy rész `--chunk` (10) új csempe vagy `--chunk-min` (45) perc után „rész” állapottal áll meg. Egy hely csak akkor nyílik meg, ha a saját csempéje már teljesen listázva van. A futó HR-17 fájljaival kompatibilis.
- Üres csempe: ha az első 2 szó nem ad helyet a csempén belül, a többi szót kihagyja. Szimulálva 21 bejárt területen: −5 % keresés, kb. 2000 csempéből 39 hely veszett volna el. Szót nem vettem ki: HR-17-ben minden szó 200–1000 helyet talál elsőként.
- `osszes.sh` minden rész után `elesit --go`. Ez idempotens: a lapon már szereplő hely kimarad, az új lead csak a most beszúrt sorokból számít.
- Dev vak próba (HR-19, 4 csempe, rész = 1 csempe / 6 perc): az első 11 lead 8 perc múlva megvolt. 8 rész alatt 175 lead, 244 sor, 0 ftid- és 0 lead-duplikátum.
- Mérés élesen: HR-17 első 29 csempéje 6035 helyet adott, tehát a lassúság az adatlap-fázis. Kb. 7 mp/adatlap mellett ez ~12 óra; részenként ebből folyamatos leadfolyam lesz.

**Repó:**
- `scripts/discovery-areas.mts`: a `process.exit` 64 KiB-nál elvágta a stdoutot (HR-17 340 csempéje: „column 65537”). Most a kiürülés után lép ki.

**(2) Településkép just-in-time, háttérben:**
- `telepkep/varo.py` = a `fo-cand.sql` megfordított településkép-feltétellel; futáskor származtatja. Dev-en: fo-cand 481 + várók 162 = feltétel nélkül 643, metszet 0, a sorrend a kulcs-holtversenyeken belül azonos.
- `town-photo-gather.mts --leads` a fő terv sorrendjében dolgozik, országonként felváltva, a lead országa countryOf szerint, `--budget-min` időkerettel.
- `telepkep.sh` a lanc.sh-ból háttérben indul (0,02 s), a lanc-zár nem öröklődik.
- Élesen olvasva: a fő terv körében csak 139 lead vár településképre (a backlog-szám 5048 volt). Ebből 67 e-mailes, 47 település; a próbalistán az első 12-ből 6 HR település.
- Dev: 6 település 17 perc alatt (12 perces keret), 5/6 jó, 14 maradt a következő körre.

**Hiányzó szabályok (nem építettem):**
- „Nincs jó hero”: éles napló szerint 35/80 (44 %), a <15 leades településeken 11/14. A fo-cand ilyenkor örökre vár.
- 70 csak-mobilos HU lead is vár: a fo-cand a településképre várakoztatja őket, de a gyűjtő az ADR-0479 szerint csak e-mailesért fut.
- Szemét városnév („277-es számú ajtó”).

**Mellékes:** a dev DB HU-sorának `send_window_to = 17` értéke HELYES (F4, ADR-0487, migráció 0155). A régi mainen ez buktatta a country-layer-check-et; a megoldás a rebase, nem a sor átírása. Rövid ideig 20-ra írtam, visszaállítva 17-re.

**Átállás:** `bash ~/rc-briefs/uj-lanc-hr/atallas-reszek.sh check | go --stop-walk | rollback <tgz>`
- Előfeltétel: a repó-commit landolva + fő-fa ff.
- A `--stop-walk` PID szerint leállítja az élő bejárást (folytatható), másol, öntesztel, majd az orzo.sh-val újraindítja.

## Nyelvi csomag nem zárja a piacot — „Bábelre vár” üzenet-szinten (ADR-XXXX, koordinátor 2026-11-26 16:00)

**Mérve élesen 15:50:** az éles terv nyitott piaca csak a HU volt. A HR egyetlen oka: „Nyelvi csomag (Bábel): hr: 4270 / 4293”. A lánc az audit (a) óta csak nyitott piacra dolgozik, így minden HR lead kiesett.

Ráadásul öt kiküldő út a TELJES csomag bármely hiányánál a nyelv minden levelét tartotta (`sendBatch`, `sendOutreachSms`, `nonOpenerFollowup`, `trialCampaign`, `behaviorMessage`).

**Javítás:**
- A `countryReadiness` babel tétele: `gating: !okLang`, hiánynál `warn`.
- A küldő utak az ÜZENET saját szövegét mérik: `draft.untranslated`, `letter.untranslated`, `sms.untranslated`, a levél-keret `collectFallbacks`-a (új: `sendBatch` frameFallbacks), és a §C.
- Őr: `country-layer-check` (egyik küldő út sem nézi a teljes csomagot, mind méri a sajátját; a babel tétel nem kapuzó).

**Vak mérés (dev, a valódi hr csomag és két valódi HR levél):**
- (i) Egy új, lefordítatlan vevő-oldali felirat landja után (ideiglenes katalógus-bejegyzés): hr hiány 1, a HR NYITVA, a babel tétel `warn`.
- (ii) Egy levél-mondat („Saját honlapot viszont nem találtunk.”) kivéve a dev DB csomagjából és a Bábel-seedből:
  - az a levél, amelyben szerepel (4d81365a): TARTVA „Bábelre vár … 1 szöveg”;
  - a másik levél (84e67d32), amelyben nincs: nyelvileg MEHET;
  - a HR nyitva marad.
- Minden visszaállítva: seed-fájl, DB-sor, a dev HR piac pending.

**Közben (3. pont):**
- (a) Dev: 3 lead okkal félretéve („nincs jó kép”: Tiszaörs, Pilismarót, Fedémes), a várólista 97 → 91.
- (b) `fo-cand` csak e-mailes leaddel. Élesen mérve: 70 → 35 lead, a 35 kieső mind e-mail nélküli.
- (c) Városnév-szabály, vak minta élesről, 90 település: 72 ismert, 18 rossz név (utcacím, ajtószám, NTAK, irányítószám a név elején), mind a valódi településére esik vissza, 0 téves.
