## ADR-0143 — A TERÜLET a gyűjtés doboza, nem a lead földrajza; és a levágott vezérlő csak pixelen látszik (2026-09-14)

**Kiváltó.** Tulaj-bejelentés az Elek FK-003 (2026-09-13) leletei nyomán: a lead-lista RÉGIÓ
oszlopa valótlant állít, nyers azonosítókat kever emberi nevek közé, a MOCK-szűrő ikonja pedig
félbe van vágva az alapértelmezett nézetben.

**Mérés (nem becslés).**

- **Honnan jön az érték:** `scraper_definition.region` → a gyűjtő-definíció TERÜLET-azonosítója,
  megjelenítve a `region` tábla sorának `label`-jével. **Nem geokódolás, nem per-lead besorolás.**
- **Miért hazudott:** a `balaton-north` terület címkéje „Balaton északi part" volt, a doboza
  viszont `[46.75, 17.25 – 46.95, 18.05]` (kör: 46.85/17.65, r = 30,45 km) — az **egész tó** plusz
  a háttérvidék. 595 leadből **529** viselte ezt a címkét: köztük 47 siófoki, 71 balatonlellei,
  35 zamárdi (DÉLI part) és 9 tapolcai (nem parti). Az oszlop egyszerre volt hamis és
  információ nélküli (89% egyetlen érték).
- **A nyers azonosítók** (`bs`, `_test`, `Balaton`) olyan gyűjtő-definíciókból jöttek, amikhez
  nincs `region` rekord — a fallback a kulcsot írta ki helynév gyanánt.
- **A vágás pixelben:** a táblázat legkisebb szélessége **1210 px** volt az **1186 px**-es
  görgető-dobozban (`.tblwrap`), tehát 24 px a látható él mögé esett. Ok: `.con th {
  white-space: nowrap }` — a fejléc-felirat + rendező-nyíl + tölcsér + aktív-jelvény egy sorba
  kényszerítve. Az alapértelmezett nézet a legrosszabb, mert ott KÉT aktív szűrő-jelvény is a
  fejlécbe préselődik.
- **⚠️ A címke nem csak konzol-oszlop volt:** a `generate.ts → resolveRegion()` ugyanezt a
  `label`-t adja a generátornak régió-kontextusként. Mérve: **68 `mock_artifact`-ból 63** tárolt
  `inputs.region` mezője „Balaton északi part", **ebből 40 bizonyíthatóan hamis** (déli parti /
  nem parti település), és köztük 2026-09-08/09-i, tehát a 2026-08-23-i „javítás" UTÁNI darabok.
  A lemezen lévő RENDERELT lapokon ma nincs benne a partoldal-állítás (a copywriter prompt-szabály
  tartja) — de a 2026-08-23-i jegyzet maga írja: „NYITVA: determinisztikus kapu erre nincs".
  Az akkori javítás a TÜNETET kezelte (5 artifact szövege + prompt-szabály), a FORRÁS maradt.

**Döntés.**

1. **A hamis nevet a FORRÁSNÁL javítjuk, nem a felületen** (migráció `0067`, + a
   `regions.ts` seed): `balaton-north` címkéje **„Balaton"** — ez igaz a dobozra, és próza-biztos
   (a generátor ebből épít mondatot). A dobozt nem mozgatjuk: az a gyűjtés hatóköre, külön
   (operátori) döntés. A migráció CSAK a beégetett seed-értéket írja át (`WHERE label = '…'`),
   így egy operátor által adott saját nevet nem ír felül. Ugyanaz az állítás a
   `scraper_definition.label`-ben is ott ült — egy szabály két példányban két igazság.
2. **Az oszlop azt nevezi meg, amit mutat: „Terület"** (nem „Régió"). A jelentése kimondja, hogy
   ez a gyűjtési doboz NEVE, **nem a lead földrajzi besorolása**, és elküldi a földrajzi kérdést
   az Ország/Város oszlophoz — oda, ahol a válasz tényleg van. („Területek" amúgy is a konzol
   saját szava erre az entitásra.)
3. **Lookup-tévesztés ≠ a kulcs kiírása.** Ahol nincs terület-rekord, a cella az **ÁLLAPOTOT**
   mondja: „nincs besorolás"; a belső azonosító az elemleírásba kerül (diagnosztika, nem felirat
   — ADR-0126). A szűrőben ez EGY vödör (üres érték), nem kulcsonként egy: `bs` és `_test` nem két
   hely, hanem két besorolatlan gyűjtő-definíció. ⚠️ A vödör rendezési kulcsa a KIÍRT mondat, nem
   az üres érték — különben a képernyő önmagának mondana ellent (a „nincs besorolás" sorok a
   B-betűs nevek elé ugrottak volna).
4. **A sorrendnek legyen oszlopa: „Felmérve".** A lap eddig kiírta, hogy „legutóbb felmért elöl",
   miközben egyetlen oszlop sem hordozott dátumot, és mind a tíz rendező-nyíl semleges volt. Az
   alap-sorrend mostantól KIMONDOTT (`effectiveLeadSort`), ugyanabból az egy kifejezésből
   rendeződik a lista ÉS gyullad ki a fejléc — az állítás és az elrendezés nem tud elcsúszni.
5. **A vezérlő ne legyen levágva — szerkezetileg, ne a mai korpuszra.** A lead-tábla fejléce
   tördelhet, a vízszintes belső margó 12 → 8 px (88 px valódi hely), a szereplő-név oszlop pedig
   törhető (ez az egyetlen felülről nem korlátos szabad szöveg). Mérve: mindhárom nézet **0 px**
   túllógás, egy 52 karakteres szóköz nélküli névvel is. ⛔ A törhetőséget a VÁROS oszlopra
   NEM tettük rá: ott elsült (a „Balatonföldvár" egyetlen betűt csapott át), és a NÉV oszlop
   `min-width`-et is kapott, mert nélküle 390 px-en ~30 px-re lapult.

**Őr (`lead-filter-label-check`, pre-commit — a stíluslapra is kapuzva).** Két új réteg:

- **Nyers azonosító:** a Terület oszlop egyetlen cellája sem a fixture SAJÁT gyűjtési kulcsa, és
  minden besorolatlan sor pontosan a kimondott állapotot írja ki (darabszám-egyezés).
- **Levágás — ÖLTÖZTETETT lapon:** az eddigi állítások `setContent`-tel futottak, ahol
  **stíluslap sincs**; ez az egész hibaosztályra vak. Az új réteg valódi kiszolgálót, valódi
  `citui` stíluslapokat és 1280 px-es nézetablakot használ, és öt nézetben méri, hogy cella vagy
  vezérlő nem lóg-e a görgető-doboz látható éle mögé. Plusz egy ÖNKONTROLL: egy mesterségesen
  kiszélesített oszlopra a mérésnek pirosat KELL adnia.
- **Önteszt (negatív futás): 13 bukás** — és a visszarontott `nowrap` pontosan azt jelenti,
  amit Elek mért: «mock» fejléc-vezérlő levágva, az ALAPÉRTELMEZETT nézetben.

**Átvezetve:** KB (`console-leads`, oszlopok + jelölések + mobil-mérés), Elek FK-003 (a kézi
elvárás a TÉNYRE mér: nyers azonosító tilos, a terület nem mondhat ellent a Város cellának,
és a jobb szél vágásmentes), `mock-photo-gate-check` fixture.

**⚠️ NYITOTT (nem ebben a szálban):** ② a „terület neve legyen igaz a saját dobozára" szabályra
nincs determinisztikus kapu (a Területek felületén az operátor bármit beírhat).

**① UTÓSZÁL ugyanaznap (tulaj-utasításra, LEZÁRVA): a tárolt pillanatkép is javítva.**
A `mock_artifact.inputs` nem archívum — a `rerender-mock.mts` ebből renderel újra („the persisted
inputs ARE the design"), és a `brief.ts` a mezőt tény-kontextusként adja az AI-nak („Régió: …").
- **Újramérve az írás előtt** (a saját számomat nem hittem el): **63/68** artefaktum, mind a
  `balaton-north` területről; mezőnként **63× `$.region`** és **1× `recipe…copy.eyebrow`**.
- ⛔ **Egy vak „legyen egyenlő az élő címkével" szabály RONTOTT volna:** mérve egy artefaktum
  `balaton-north` területről jött, mégis jogosan visel „Badacsony (Badacsonytomaj környéke)"
  címkét — a `resolveRegion()` a lead KOORDINÁTÁI alapján a szűkebb, bennfoglalt dobozt
  választotta. Ezért a szabály nem „egyezzen az élővel", hanem **„ne idézzen VISSZAVONT nevet"**:
  a halmaz az élő `region.label`-ek komplementeréből SZÁRMAZIK, nem szó-feketelistából.
- ⛔ **Prózát nem írunk át.** Egy artefaktumon (Három Huszár Apartments, **Köveskál — nem parti**)
  a hamis állítás ragozva ül a `siteData.intro`/`tagline`-ban. Ott a csere ÚJ hazugságot szülne
  („a Balaton partján" ugyanúgy hamis), a helyes orvosság az ÚJRAGENERÁLÁS — ezért a sor NÉVVEL,
  kötelező indoklással áll az őr kivétel-listáján, nem némán átengedve.
- **Eszköz:** `scripts/backfill-artifact-region.mts` (száraz futás alapból · sha256-os mentés az
  írás ELŐTT · egy tranzakció · frissítés AZONOSÍTÓ szerint · visszaolvasás · a kihagyottakat
  kiírja). Eredmény: **63 frissítve**, független mérőeszközzel igazolva **63 → 1** (a maradék a
  kimondott kivétel), a mentés `sha256 -c` RENDBEN.
- **Őr:** `scripts/artifact-label-quote-check.mts` — önálló bejáróval (⛔ nem hívja a javító
  függvényét), ragozott alakra is illeszt. **Kapuz** az ÖNÁLLÓAN álló (mechanikusan javítható)
  címke-idézetre; a ragozott prózát **nem kapuzza, de minden futáson NÉVVEL kiírja**. Ha nincs
  visszavont címke, vagy üres az adatbázis, azt KIMONDJA („NEM MÉRT") — a „0 sértés" és a „nem
  volt mihez mérni" két különböző állítás. Önteszt: piros.
- ⛔ **Az őr ELSŐ változata csapdát épített, és a tulaj szava buktatta le.** Egy konkrét
  artefaktum UUID-ja állt benne kivételként, plusz az az állítás, hogy *az elavult kivétel maga
  bukás* („a mentesség ne élje túl az okát"). A tulaj jelezte: ez dev-adat, a nap végi purge
  elviszi — vagyis a kapu a purge MÁSNAPJÁN mindenkinél pirosra váltott volna, egy olyan ok
  miatt, ami közben HELYESEN szűnt meg. **Efemer dev-azonosító nem való commitolt kapuba**; a
  szabály ezért SZERKEZETI (önálló idézet vs. próza), a konkrét sor pedig ITT és a
  session-jegyzetben van nyilvántartva, nem a kód belsejében.

**Visszafordíthatóság:** 🔄 felirat-, adat- és stílus-szintű; a migráció visszaírható.

**③ UTÓSZÁL (2026-09-14) — A LEAD-LAP KIMARADT, VAGYIS AZ ADR EGY MÉG NYITOTT OSZTÁLYT NYILVÁNÍTOTT LEZÁRTNAK.**

Elek FK-003b L15. Ez a blokk fent a lead-LISTÁRÓL szól, és lezártnak mondta a hibaosztályt — a
lead-LAP viszont nem kapta meg a szabályt. **Nem „3 besorolatlan lead szivárgott": mind az
595 lead-lap a NYERS KULCSOT írta ki**, mert a `getLead()` a `region.label`-t soha nem is
kérdezte meg. Vagyis a ① utószál forrás-javítása (a hamis „Balaton északi part" → „Balaton")
**erre a felületre el sem jutott**: egy balatonlellei (DÉLI parti) lead a saját lapján
továbbra is `balaton-north`-ot viselt — pontosan az az állítás, amit ez az ADR visszavont.
A legmegtévesztőbb eset a `Balaton` kulcs volt: hibátlan helynévnek látszik, közben nincs
mögötte terület-rekord, és a lapon minden más mező „–".

- **A tanulság, ami túlmutat ezen a soron:** a „lezártnak nyilvánítom" akkor igaz, ha a szabály
  MINDEN fogyasztója megkapta. Egy szabály két implementációban két igazság két képernyőn — és
  az volt a helyzet, hogy „a lista helyes" MIKÖZBEN a lap hamis volt. A javítás ezért nem egy
  második `if`, hanem **egy forrás**: a lap a lista saját `columnLabel` / `columnMeaning` /
  `areaValueHtml` hármasán megy át (a harmadik ebben a szálban KIEMELVE egy helyre, mert eddig
  a lista cellájában és a lap sorában két példányban élt volna).
- **A fejléc-alcím is állított:** `[város, region].join(" · ")` = két felirat nélküli érték egy
  elválasztóval, ami földrajzi hierarchiának olvasódik („Balatonlelle · balaton-north"). Az
  alcím mostantól **MEGNEVEZI** a második értéket („Terület: Balaton"), a szót ugyanabból a
  `columnLabel`-ből véve, tehát a fejléc és a lista-oszlop nem nevezhető át egymástól külön.
  (Tulaj-döntés, 2026-09-14: a négy ELŐTTE-kép és a szöveg-diff megtekintése után a §2b
  „mintakövető hibajavítás" kivételt adta — a kapu-token az ő szavával naplózva.)
- **Ugyanez a kulcs UGYANEZEN a lapon, három sorral lejjebb:** az artefaktum-kártya meta-sora a
  nyers és az emberi felet EGYMÁS MELLÉ írta — mérve `… · region=Balaton · regionId=balaton-north · …`
  (3 artefaktumból 2). A nyers fél kikerült a látható sorból; a tárolt `inputs`-ban MARAD, mert
  a gép abból dolgozik (`persist.ts` ezzel oldja fel a területet, a `rerender-mock.mts` ebből
  renderel újra). Belső azonosító nem felirat (ADR-0126).
- **Őr:** `scripts/lead-page-area-label-check.mts` (pre-commit, `views|data|leadFilters` triggerre).
  DB nélkül rendereli a valódi `leadPage()`-t négy esetre (besorolt · „valódi helynévnek látszó"
  besorolatlan · fejlesztői kulcs · rövid kulcs) és igazi DOM-ban mér: **gépi horgonyon**
  (`data-fact="region"`, `data-cit-area`), nem a magyar feliratra illesztve. A tiltott kulcsok
  halmaza a FIXTURE saját azonosítóiból jön, **nem a vizsgált helper-től** — egy őr, ami a
  mért kódot kérdezi meg, a hibával egyetért. 35 zöld állítás. **Önteszt: 18 piros** — és a
  kapu a VALÓDI visszarontásra is megáll (kontrollált próba: a sort visszaírva `set -e` alatt
  rc=1, a blokk utáni sor nem futott le).
- ⛔ **Két saját hiba mérés közben:** ① a data.ts kommentjébe azt írtam, hogy „3 lead szivárog,
  592 a nevet mutatja" — a KÉP cáfolta, mind az 595 a kulcsot mutatta; helyesbítve. ② a szűrt
  meta-sor állítása VAKON zöld lett volna (egy semmit sem fogó szelektor is 0 sértést jelent),
  ezért az őr előbb bizonyítja, hogy a sort TÉNYLEG olvassa — a címke-fél jelenlétével.

**⚠️ FELSOROLVA, NEM JAVÍTVA (külön kör, ez a súlyosabb) — a nyers kulcs a VEVŐ lapjára is kijut.**
A `resolveRegion()` (`src/generator/generate.ts:136`) utolsó sora `label: REGIONS[id]?.label ?? id`,
azaz **ismeretlen terület-azonosítónál a KULCS lesz a megjelenítendő címke**. Közvetlen próbával
mérve: `bs` → `"bs"`, `_test` → `"_test"` (a `balaton-north` és a `badacsony` helyesen ad nevet).
⛔⛔ **HELYESBÍTÉS (2026-09-14, ugyanaznap, az ADR-0163 mérése közben) — EZ A BEKEZDÉS ROSSZ
ÚTVONALAT NEVEZETT MEG.** Eredetileg azt írtam ide, hogy a címke a `render.ts:81/154/161/170/211`
(+ `renderVaried.ts`) sorokon landol a vevő lapján. **Mérve: azokat a sorokat a `generateMock()`
használja, amit MA SENKI NEM HÍV** (a konzol a `generateEngineMock`-ot hívja; a
`generateMock`/`generateMockFor` hívási helye nulla, a `run.ts` is az engine-t indítja) — vagyis
a legacy AI-HTML út. A hibát a helyes irányba jelentettem, de a BIZONYÍTÉKOM egy halott ágra
mutatott; ugyanaz a hiba, amit ebben a szálban már egyszer elkövettem (a „3 szivárog / 592
rendben" állítás, amit a kép cáfolt). **Az ÉLŐ út más — és rosszabb:** a címke a
`generateEngine.ts`-ben a **copywriter promptjába** (`brief.ts`) megy a szállás régiójaként, ÉS a
**tény-kapu forrás-listájára** (`factCheck.ts` `FactSource`) igazolt igazságként, tehát a kapu
ÁLDÁSÁVAL kerülhetett volna „_test" a vendégnek szóló prózába. **Nem figyeltem meg kirenderelt
lapon** — a korpuszban nincs besorolatlan területű leadhez legyártott mock (az egyetlen ilyen
artefaktum `path`-ja NULL): a MECHANIZMUS igazolt, a megvalósult eset nem.
⚠️ A javítás **NEM** a „nincs besorolás" kiírása: „Otthonos pihenés, *nincs besorolás* szívében"
ugyanúgy hamis. **Tulajdonosi döntés (2026-09-14): elhagyja a régió-fordulatot → ADR-0163.**

**⚠️ FELSOROLVA, ZAJ:** `superseded_by:<uuid>` (`data.ts:568` → a kártya „Döntés:" sora) nyers
artefaktum-UUID-t tesz az operátor elé. Nem hamis, de semmi cselekvésre kész tartalma nincs
(„egy újabb mock váltotta le" + hivatkozás lenne az).

**NEM ÉRINTETT (mérve, hogy ki ne javítsam tévedésből):** az ÁRAZÁSI régió (`snap.region` = `"hu"`,
`views.ts:516` saját `regionLabel()`-je, `/pricing`) MÁS entitás. A `/scrape` lista a címkét
használja, a `/scrape/regions` pedig az azonosítót `<code>`-ban mutatja a név mellett — ott az
azonosító helyesen van belsőként jelölve. **Amit a mérés CÁFOLT:** az `inputs.region` NEM nyers
kulcs, hanem a címke („Balaton") — a kulcs egy MÁSODIK mezőben, a `regionId`-ban lapult.
