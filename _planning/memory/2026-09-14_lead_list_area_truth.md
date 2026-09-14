# 2026-09-14 — A TERÜLET oszlop igazat mond; a levágott vezérlő csak pixelen látszik

**Szál:** tulaj-bejelentés az Elek FK-003 (2026-09-13) leletei alapján. ADR: **ADR-0143**.
**Élesítés: NINCS.**

## Mit kért a tulaj

① a RÉGIÓ oszlop mondjon igazat vagy semmit (mérd meg, honnan jön az érték);
② nyers azonosító (`bs`, `_test`) ne kerüljön emberi oszlopba;
③ a MOCK-szűrő ikonja ne vágódjon el az alapértelmezett nézetben;
④ ŐR a renderelt táblázaton, negatívan is futtatva.
Plusz egy kisebb (Z1): a lap sorrendet állít, de dátum sehol.

## A mérés — és ami a kérésen TÚL jött ki belőle

- **Az érték forrása:** `scraper_definition.region` → a gyűjtő-definíció terület-azonosítója,
  kiírva a `region` sor `label`-jével. Nem geokódolás, nem per-lead besorolás.
- **A hazugság oka:** a `balaton-north` terület **címkéje** „Balaton északi part", a **doboza**
  viszont `[46.75, 17.25 – 46.95, 18.05]` (r = 30,45 km kör) — az egész tó + háttérvidék.
  595 leadből **529** viselte; köztük 47 Siófok, 71 Balatonlelle, 35 Zamárdi (déli part),
  9 Tapolca (nem parti).
- **⚠️ A címke KIMEGY a vevőnek is.** A `generate.ts → resolveRegion()` ezt a `label`-t adja a
  generátornak. Mérve: **68 mock_artifactból 63** `inputs.region` mezője a hamis címke,
  **40 bizonyíthatóan hamis** (déli parti / nem parti lead) — és köztük 2026-09-08/09-i darabok,
  tehát a **2026-08-23-i „javítás" utániak**. Az akkori szál ugyanezt a hibát megtalálta, de a
  TÜNETET javította (5 artifact szövege + copywriter prompt-szabály), és maga írta oda:
  „⚠️ NYITVA: determinisztikus kapu erre nincs". A forrás 3 hétig élt tovább.
  A lemezen lévő renderelt lapokon **ma nincs** benne a partoldal-állítás (0 találat) — a
  prompt-szabály tart, a kockázat latens, nem élő.
- **A vágás számokban:** a tábla legkisebb szélessége **1210 px** az **1186 px**-es
  `.tblwrap`-ban → 24 px a látható él mögé esett. Ok: `.con th { white-space: nowrap }`.
  A `?all=1` nézet 12 px, a „mind egy lapon" (593 sor) **83 px**.

## Amit csináltam

1. **Forrás-javítás** (`migrations/0067_region_label_truth.sql` + `regions.ts` seed):
   `balaton-north` címkéje **„Balaton"**. Próza-biztos (a generátor mondatot épít belőle), és
   igaz a dobozra. Csak a beégetett seed-értéket írja át (`WHERE label = '…'`), operátori
   átnevezést nem. A `scraper_definition.label` ikerpéldányát is.
2. **„Régió" → „Terület"**, a jelentése kimondja: ez a gyűjtő-doboz NEVE, nem a lead földrajza —
   és elküldi a földrajzi kérdést az Ország/Város oszlophoz.
3. **„nincs besorolás"** a besorolatlan területű sorokra; a belső azonosító az elemleírásban.
   A szűrőben EGY vödör (üres érték), nem kulcsonként egy. ⚠️ A vödör **rendezési kulcsa a
   kiírt mondat** — üres kulccsal a sorok a B-betűs nevek elé ugrottak, vagyis a képernyő
   önmagának mondott volna ellent (az őr fogta meg, nem én).
4. **„Felmérve" oszlop + kimondott alap-sorrend** (`effectiveLeadSort`): egy kifejezésből
   rendeződik a lista ÉS gyullad ki a fejléc-nyíl.
5. **Vágás-javítás szerkezetileg:** tördelhető fejléc + 12→8 px vízszintes margó + törhető
   NÉV oszlop. Mérve **0 px** túllógás mindhárom nézetben, 52 karakteres név-tokennel is.

## Amit a javítás közben MAGAM rontottam el (és a kép fogta meg)

- Az `overflow-wrap: anywhere`-t először HÁROM oszlopra tettem: a VÁROS így
  „Balatonföldvá / r"-ként tört — a javítás új olvashatósági hibát gyártott. Csak a NÉV-re való.
- `min-width` nélkül ugyanez 390 px-en ~30 px-re lapította a NÉV oszlopot
  („ELEK-TESZT Vend / éghá / z"). **A telefonos kép nélkül ezt nem láttam volna** — a desktop
  mérésem addig zöld volt.

## Az őr

`scripts/lead-filter-label-check.mts` — 139 állítás (volt ~110), két új réteggel:

- **nyers azonosító:** a fixture SAJÁT kulcsaival mér (nem szólistával), + darabszám-egyezés a
  „nincs besorolás" sorokra;
- **levágás ÖLTÖZTETETT lapon:** az eddigi állítások `setContent`-tel futottak, ahol **nincs
  stíluslap** — az egész hibaosztályra vakok voltak. Most valódi kiszolgáló + valódi `citui`
  stíluslapok + 1280 px, öt nézetben, + ÖNKONTROLL (mesterségesen széles oszlopra pirosnak kell
  lennie: 102 sértést talált).
- **Önteszt: 13 bukás**, a visszarontott `nowrap` pontosan azt mondja, amit Elek mért:
  «mock» fejléc-vezérlő levágva, az ALAPÉRTELMEZETT nézetben.
- A pre-commit trigger mostantól a **stíluslapra is** szól — a hibát egy CSS-sor okozta, nem TS.

## Kapuk

`tsc` ✔ · i18n-lint ✔ · katalógus ✔ · design-token-lint ✔ · kb-check --coverage ✔ (35/35) ·
internal-ref-check --fast ✔ · admin-list-labels-check ✔ · mock-state-label-check ✔ ·
lead-filter-label-check **139/139** + önteszt 13 piros ✔ · Elek **FK-003: 11 gépi zöld / 0 piros**
(volt 10/0 — a plusz zöld az új dátum-oszlop gépi állítása).

## Módosított / új fájlok

- `src/console/leadFilters.ts`, `src/console/data.ts`, `src/console/views.ts`
- `src/scraper/regions.ts`
- `public/assets/ui/citui-console.css`
- `migrations/0067_region_label_truth.sql` (ÚJ)
- `scripts/lead-filter-label-check.mts`, `scripts/mock-photo-gate-check.mts`
- `hooks/pre-commit` (stíluslap-trigger)
- `kb/entries/console-leads/entry.hu.md`
- `elek/scenarios/FK-003-operator-lead-list.md`
- `_planning/DECISIONS.md` (ADR-0143), `MEMORY.md`, ez a jegyzet

## Nyitott

1. **A 63 tárolt `mock_artifact.inputs.region`** még a hamis címkét őrzi — egy determinisztikus
   újrarenderelés visszahozná az állítást. Adat-művelet, külön döntés (mentés + visszaolvasás).
2. **Nincs determinisztikus kapu** arra, hogy egy terület NEVE igaz legyen a saját dobozára —
   a Területek felületén az operátor bármit beírhat.
3. A landolás a szál zárásakor **közös munkafán** történik (több session dolgozik a
   `~/wt/cit2167c7de`-ben) — a `land.sh` tiszta fát követel.

## UTÓSZÁL ugyanaznap (tulaj-utasításra): a tárolt pillanatkép is javítva

A nyitott ① pont lezárva. Az `inputs` nem archívum: a `rerender-mock.mts` ebből renderel újra,
a `brief.ts` pedig tény-kontextusként adja az AI-nak („Régió: …").

- **Újramértem az írás előtt** (a saját „63"-as számomat nem hittem el — [[feedback_my_own_summary_line_can_be_the_false_premise]]):
  63/68 artefaktum, mind `balaton-north`; **63× `$.region`** + **1× `recipe…copy.eyebrow`**.
- ⛔ **Egy vak „legyen egyenlő az élő címkével" szabály RONTOTT volna:** egy artefaktum
  `balaton-north` területről jött, mégis jogosan visel „Badacsony (Badacsonytomaj környéke)"
  címkét (a `resolveRegion()` a KOORDINÁTA alapján a szűkebb, bennfoglalt dobozt választja).
  A szabály ezért: **„ne idézzen VISSZAVONT nevet"**, a halmaz az élő címkék komplementeréből.
- ⛔ **Prózát nem írtam át.** Három Huszár Apartments (**Köveskál — nem parti**): a
  `siteData.intro`/`tagline` ragozva állítja a partoldalt. Csere = új hazugság
  („a Balaton partján" ugyanúgy hamis) → ÚJRAGENERÁLÁS kell, tulaj-döntésre vár.
- **Eredmény:** 63 frissítve; **független** mérőeszközzel 63 → 1; mentés `sha256 -c` RENDBEN.
- **Őr:** `artifact-label-quote-check.mts` — önálló bejáró (nem hívja a javítót), ragozott
  alakra is illeszt, az **elavult kivétel maga BUKÁS**, üres DB-n kimondja, hogy nem mért.
- ⛔ **Egy korábbi mérésem rossz okból volt jó:** azt írtam, „a renderelt lapokon 0 találat" —
  a path-feloldásom viszont **0 fájlt talált meg** (a mockok a fa GYÖKERÉBEN vannak, nem a
  `sites/` alatt). Újramérve: 66/68 fájl megvan, és tényleg 0-ban van benne az állítás.
  A helyes válasz rossz méréssel is kijöhet.

**Új fájlok:** `scripts/backfill-artifact-region.mts`, `scripts/artifact-label-quote-check.mts`.

### ⛔ A saját őröm csapdát épített — a tulaj szava buktatta le

Az `artifact-label-quote-check` első változatában a Köveskál-artefaktum **UUID-ja** állt
kivételként, plusz az az állítás, hogy *az elavult kivétel maga bukás* („a mentesség ne élje túl
az okát" — ez önmagában jó szabály). A tulaj közölte: ez dev-adat, a nap végi purge elviszi.
Vagyis a kapu a purge **másnapján mindenkinél pirosra váltott volna**, egy olyan ok miatt, ami
közben HELYESEN szűnt meg — én pedig egy efemer dev-azonosítót commitoltam volna őrbe.

Átírva: a szabály **szerkezeti** (ÖNÁLLÓAN álló címke-idézet = kapu; ragozott próza = nem kapu,
de minden futáson névvel kiírva), és ha nincs visszavont címke, a kapu **kimondja, hogy nem
mért**. A konkrét sor nyilvántartása az ADR-be és ide került, nem a kód belsejébe.

⚠️ **Ennek ára van, és kimondom:** a backfill után a rendes futás már nem nevezi meg a
Köveskál-sort (nincs visszavont címke, amihez mérje). Ha a visszavont terület-nevek TARTÓS
nyilvántartása kell, ahhoz külön rekord kellene (pl. `region_label_history`) — ma nem építettem meg.
