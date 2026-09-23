## ADR-0192 — A modul-függőségi rend: deklarált `requires` a katalógusban, és a húsz fogyasztó, aki ma vakon engedi át (2026-09-21)

**Dátum:** 2026-09-21 · **Státusz:** elfogadva (FELDERÍTÉS lezárva; a megvalósítás külön szálban
indul) · **Kapcsolódó:** ADR-0044/c §10 (a szereposztás: a `rooms` MEGMUTATJA, a `booking`
FOGLALHATÓVÁ teszi, a `pricing` ÁRAT tesz rá), ADR-0059 (egy tartalomtípus egyszer), ADR-0061
(ALL-IN mock), ADR-0072 (az élő készlet = amit kifizetett), ADR-0074 §5 (a `rooms`+`amenities`
MŰVELET-szintű kapu — ez marad), ADR-0089 (Modulok fül + előnézet), ADR-0113 (fizetés után
élesedik), ADR-0114 (az „egész szállás" egység), ADR-0155 (fagyasztott admin), ADR-0175 (minden
képernyő megmondja, mit fizet a vevő), ADR-0180 (amit már megmértek, ne mérd újra).

**Kiváltó.** Tulajdonosi utasítás: *„indíts egy külön sessiont a függőségi kérdésben, ahol
felmérjük hol van ennek relevanciája… Az új sessionnek ez a felderítés az elsődleges feladata."*
A mandátum kimondottan **felderítés, nem kód** — mert a függőségi adat KÖZÖS lista sok
fogyasztóval, és a megfizetett tanulságunk szerint (`feedback_widening_a_shared_list_needs_per_consumer_decision`)
a fogyasztók utólagos megnézése **4-ből 3-nál némán ront**. A leltár határozza meg a séma alakját,
nem fordítva.

### ① A lánc — és ami KIESETT belőle

```
booking  ──requires──▶  pricing  ──requires──▶  rooms     (rooms: ha 2+ egység, VAGY ha ismeretlen)
```

⛔ **Az `amenities requires rooms` KIESETT** (tulajdonosi döntés, 2026-09-21, mérés alapján). A
brief még tartalmazta; a felderítés **cáfolta**: az `amenities` **site-szintű adat**
(`site_module_config('amenities').config.items`), `rooms` nélkül hibátlanul renderel
(`src/engine/moduleSections.ts:876-879`), és a KB-szócikk **címe** ma ezt mondja ki:
*„Felszereltség — mit kap a vendég az egész szálláson"*. A valódi kötés csak a **szobánkénti
szerkesztőre** áll, és az **ADR-0074 §5 óta már él, művelet-szinten** — nincs mit bevezetni.
Katalógus-szintű kötésként a szócikket hazuggá tettük volna, **és a label-drift őr ezt nem fogta
volna meg** (a cím nincs félkövér idézetben).

⚠️ Külön, ellenkező előjelű hiba maradt nyitva: ma a `rooms` **bekapcsolása** képes eltüntetni a
fizetett `amenities` szekciót (`src/tenant/editor.ts:318-330` — az egység-szintű címkék kivonása
után üresre fogyó lista `delete`-elődik). Ez nem ennek az ADR-nek a tárgya, de lásd ⑥.

### ② A leltár — húsz fogyasztó, tíz közülük felderítve

A tulaj kettőt nevesített, tizet a felderítés talált. Négy kérdésre kellett külön-külön válasz:
érinti-e · mi a HELYES · mi van MA (mérve) · hazudik-e a képernyő.

**A hangos leletek, amiket senki nem keresett:**

- ⛔⛔ **`/api/foglaltsag` az entitlement-kaput nem kérdezi meg** (`src/server/public.ts:670-708`).
  A `pricing` lemondása után az ár eltűnik a LAPRÓL, de nem a foglalási folyamatból: a widget
  kalkulál, a `createBookingRequest` pedig **befagyasztja** (`src/booking/requests.ts:391-439`),
  és a `quoted_total` kimegy a vendég levelébe. Ár nélküli lap + **kötelező erejű 84 000 Ft-os
  ajánlat**. Ez nem „hiányzó ár", hanem ELLENTMONDÁS.
- ⛔⛔ **A megújítás vakon kapcsol ki** (`src/payment/subscription.ts:226-236`:
  `where cancel_at_period_end = true`). A lemondás pillanatában a halmaz még ÉRVÉNYES (a modul él
  a periódus végéig), tehát egy toggle-ra kötött őr átengedi — és a szabály **a fordulónapon,
  ember nélkül, némán sérül**. A függőség-kapunak ITT is állnia kell, nem csak a kattintáson.
- ⛔⛔ **A kliens megerősítő kártya csak a BEPIPÁLT checkboxokat ismeri**
  (`src/server/adminViews.ts:1496,1516`). Szerver-oldali hozzávétel esetén a vevő **990 Ft-ot
  látna és 2 170-et fizetne**. Ez a lelet döntötte el a ③-at.
- ⛔ **`syncEntitlementsToPaid` visszaszivárogtat** (`src/tenant/paidEntitlements.ts:107-123`): a
  HISTORIKUS fizetett unióból granteli vissza a máshol kiszűrt modult.
- ⛔ **A modul-előnézet ÍR** (`renderTenantModulePreview` → `ensureUnits` → `INSERT/UPDATE
  site_unit`, `src/tenant/units.ts:105-120`) — ADR-0089 ④ sérül, és `scripts/module-preview-check.mts:50-70`
  **vak rá**, mert csak a függvény saját törzsének SZÖVEGÉBEN keres író-hívásokat.
- ⛔ **A `module_sales_disabled` kapcsoló némán érvénytelen presetet gyárt** (szimulálva: `rooms`
  letiltása → `teljes` és `ajanlott` is sérül), és `presetNestingViolations()` (`src/modules.ts:246-257`)
  **zölden áll**, mert a `disabledSales`-t nem látja.
- ⚠️ **Az entitlement nem elég feltétel:** az `eldorado-kemping` fiókban `booking` ÉS `pricing` is
  aktív, de **0 db `unit_price` sor** → a foglalás ma sem mond árat. 4 tenant fizet `pricing`-et,
  **3-nak nulla ár-sora van**.

**Ami rendben van, és ezt IGAZOLTUK, nem feltételeztük:** mindhárom preset, az ALL-IN fallback
(`src/modules.ts:171-186`) és három valódi, lemezen lévő mock-artifact **érvényes** a lánc szerint.
Üres sáv egyetlen kombinációban sem keletkezik (minden blokk korai return-nel véd) — **a kár nem
üres sáv, hanem kontextus nélküli tartalom**. Az operátor **nem** állít össze halmazt (a konverziós
űrlap read-only pill-lista, `src/console/views.ts:1616-1638`), és egy upsell-tett **egy** rendelést
hoz létre N modullal (`src/tenant/moduleUpsell.ts:74-79`), tehát a zárvány nem hasad három
terhelésre.

### ③ ⛔⛔ A HAMIS POZITÍV, AMI A LEGTÖBBET TANÍTOTTA: az upsell-rendelés DELTA, nem halmaz

Egy felderítő a beküldött rendeléseken **1 sértést** jelentett (`["pricing","poi","booking"]` —
`rooms` nélkül), és én ezt **továbbadtam a tulajnak tényként**. Egy másik ág cáfolta: az
`order_intent.modules` `kind='upsell'` esetén **delta**, és az érintett tenant már birtokolja a
`rooms`-ot. **Valódi rendelés-szintű sértés: 0 db.**

**A szabály ebből:** a függőséget a **BEKÜLDÖTT HALMAZ ∪ A MEGLÉVŐ JOGOSULTSÁGOK** unióján kell
kiértékelni, soha nem a rendelés-soron önmagában. Aki a `modules` jsonb-t önmagában nézi,
**minden upsell-rendelést elutasít**, ami nem véletlenül vesz meg egy már birtokolt modult. Ez a
felismerés lett az őr 4. negatív kontrollja (lásd ⑤).

### ④ A NÉGY TULAJDONOSI DÖNTÉS (2026-09-21)

1. **A kosár: a kliens BEPIPÁLJA a függőséget, és KIMONDJA.** Nem néma hozzávétel és nem is puszta
   figyelmeztetés: a checkbox automatikusan bepipálódik, mellette a `why` mondat („A Foglaláshoz
   jár: Árak +490, Szobák +690 — együtt 2 170 Ft/hó").
   ⭐ **Miért épp a kliens, és miért nem a szerver:** mérve, a terv-sáv és a fizetés-megerősítő
   kártya egyaránt a bepipált checkboxokon iterál (`adminViews.ts:1512-1516`, `1554-1560`), tehát
   a **helyes ár magától következik** — a „990 a képernyőn, 2 170 a terhelésen" hazugság meg sem
   születik. Szerver-oldali csendes hozzávétellel azt KÜLÖN kellett volna megjavítani.
   A szerver-oldali kapu ettől még kell (kézzel gyártott POST), csak nem ő az elsődleges út.
2. **A lemondás: BLOKKOL, és közös lemondást ajánl.**
   > ⛔ **HELYESBÍTVE 2026-09-21-én, a megvalósítás mérése alapján** (tulajdonosi jóváhagyással).
   > Az eredeti példamondat ~~„A Szobák nem kapcsolható ki, amíg az Online foglalás él. Lemondja
   > mindkettőt?"~~ **KETTŐT** feltételezett, mert a `Szobák`↔`Foglalás` közvetlen kötést vette
   > alapul. A lánc viszont ① szerint **három tagú**: a `booking` a `pricing`-et követeli meg, a
   > `pricing` pedig a `rooms`-ot — a közbülső tag kimaradt a példából. A `rooms` lemondása tehát
   > **hármat** visz, és a felugró hármat is nevez meg.
   > ⚠️ Az eredeti mondat szándékosan marad itt áthúzva: a döntés-előzmény nem törlendő, különben
   > nem derül ki, hogy a megvalósítás nem hibázott, hanem egy azóta helyesbített feltevést követett.
   >
   > **Ami MOST köt:** „A Szobák, apartmanok nem kapcsolható ki, amíg az Árak, szezonok és az
   > Online foglalás él." + a **teljes eltávolítási zárvány** tételesen, modulonkénti árral, és a
   > gomb a zárványból számolja a darabszámot („Mind a hármat lemondom"). A névelőt `huArticle`
   > dönti el (ADR-0101), és a mondat a katalógus `why`-jával folytatódik — nem a felületen
   > fogalmazva. Kontraktus: `assets/design-refs/console/module-dependency/`.

   Precedens: az ár-padló már ma elutasít EGÉSZ változtatásokat
   (`src/tenant/moduleChange.ts:123-138`) — a minta kész, csak forintban mér, nem szerkezetileg.
   ⛔ A kaszkádot **elvetettük**: ADR-0155 ③ szerint a fagyasztott lap hiányzó mezője lemondásnak
   olvasódik, ezért egy automatikus ELTÁVOLÍTÓ ág pont a megőrző mezőkkel védett adatvesztés-csapdába
   nyúlna.
3. **Az `amenities requires rooms` elesik** (lásd ①).
4. **A „2+ egység": ismeretlen → a függőség ÁLL.** Ismert 1 egység → a `rooms` nem kötelező;
   ismeretlen VAGY 2+ → kötelező.
   ⭐ **Az indok nem óvatosság, hanem összhang:** a mock maga **3 szobakártyát MUTAT**
   (`sampleRooms()` → `SAMPLE_ROOMS.length`, `src/engine/primitives.ts:525-529`), tehát az
   „ismeretlen = egy egység" feltevés a KÉPERNYŐNEK mondana ellent.
   ⛔ Mérve: **33 mock-artifactból 0-ban** van valódi szobalista, 1-ben `sampleRoomCount`; a
   prospectnek **szerkezetileg nincs** `site_unit` sora (az `ensureUnits` a konverzió UTÁN fut
   lustán). A feltétel tehát mock fázisban ~97%-ban kiértékelhetetlen — de az adat **olcsón
   beszerelhető**: mindkét útvonal már betölti a `mock_artifact.inputs`-ot (`src/console/server.ts:690`,
   `src/console/data.ts:1524`), csak a `buildManifest` nem kapja meg.
   ⭐ A kiértékelő az **élesztett `isMultiUnit()`** (`src/tenant/units.ts:137-139`) — egy szabály két
   példányban két igazság.
   ⛔ **HELYESBÍTÉS (ugyanaznap, a bevitel előtti ellenőrzésen):** a felderítő „nulla hívója van"-t
   jelentett, én ezt átvettem — **a `src/`-re igaz, az egész repóra NEM**. A `scripts/module-config-check.mts:21`
   importálja, és a `:290`/`:296` **mindkét polaritását méri** („az alapértelmezett egység nem kér
   döntést" / „több egységnél megjelenik a választó"). Ez jó hír: a predikátum **már ma őrzött**, tehát
   nem kell újat írni alá — de a `grep` hatókörét ki kell mondani, mert a szűk felismerő ugyanúgy hamis
   képet ad, mint a hiányzó mérés (`feedback_narrow_recognizer_is_a_false_green`).

### ⑤ A SÉMA — nincs DB-tábla, és nem is sztring-lista

```ts
type RequirementWhen = "always" | "multiUnit";
interface ModuleRequirement {
  readonly id: string;                 // katalógus-id
  readonly when?: RequirementWhen;     // hiányzik = "always"
  readonly strength: "hard" | "advice";
  readonly why: string;                // a TULAJNAK mondott mondat, nem gépi kód
}
readonly requires?: readonly ModuleRequirement[];   // a ModuleDef-en
```

**Miért nem DB-tábla.** A modul-ÁR azért él DB-ben, mert az **operátor szerkeszti**; a függőség
**termék-szerkezet**, nem hangolható érték. Egy tábla második igazságot nyitna a `MODULE_CATALOG`
mellé, miközben a fogyasztók fele (konfigurátor-manifest, kliens-JS, lintek) **kódból** olvas —
és minden termék-változás migrációt kérne. Precedens: a `supersedes` is kód-oldali, a lint
validálja (`scripts/module-config-lint.mts:83-107`), és a manifest **már ma szállítja a
kliensnek** (`src/generator/configurator.ts:409-411`) — a `requires` ugyanezen az úton megy.

**Miért nem elég `readonly string[]`.** A leltár három olyat követel, amit egy id-lista nem
hordoz: a **feltételt** (`when`), az **indoklást** (`why` — hat képernyőn kell megjelennie,
ezért EGY forrásból, `feedback_one_rule_two_copies`), és az **erősséget** (`strength`).

### ⑥ AZ ŐR — hármas kapu, négy negatív kontrollal

| Réteg | Mit mér | Hol |
|---|---|---|
| ① katalógus-lint | létező id · nincs önhivatkozás · **nincs kör** · `retired`/`tenantOnly` nem lehet függőség · minden preset ÉS az ALL-IN érvényes — **a `module_sales_disabled` szimulálásával is** | `scripts/module-config-lint.mts` (a `supersedes`-blokk kész mintája) |
| ② viselkedés-check | nyolc fogyasztó végponttól végpontig, valós dev-fixture-ön | új `scripts/module-dependency-check.mts` |
| ③ bekötés | `hooks/pre-commit` + `scripts/land.sh`, diff-scope a `guard-wiring-check.mts` szerint | — |

**A ② nyolc állítása — mindegyik egy MÉRT mai leletre felel:** kliens-halmaz · `applyModuleChange`
elutasítás · **a megújítás-sweep** · **a sync visszaszivárgás** · *a kliens „Fizetendő most" ==
a szerver `order.price`* · render · **`/api/foglaltsag` ár-kapu** · számlázás.

**Negatív kontrollok** (a minta: `scripts/guard-wiring-check.mts:261-323` — fixture, `want`-tábla,
önálló exit):

1. **Érvényes halmaz → NÉMA.** Nincs álpozitív.
2. Mind a négy sértés-osztály **külön-külön** pirosra megy.
3. ⭐ **`cancel_at_period_end=true` a `pricing`-en, `booking` aktív → PIROS.** Ezt az utat ma
   **egyetlen őr sem nézi** — és épp ez az, ami ember nélkül sérül.
4. ⭐⭐ **Upsell-rendelés `modules=["booking"]`, a tenant már birtokolja a `pricing`+`rooms`-ot →
   ZÖLD.** Ez a kontroll közvetlenül abból a hamis pozitívból született, amit ③-ban helyesbítettem
   — nélküle az őr minden upsellt megfogna.

**Tudásbázis (ADR-0045 §J).** Három szócikk KÖTELEZŐEN frissül, mert ma **feltétel nélkülinek**
írják a gombokat: `kb/entries/admin-modules/entry.hu.md:51-68` és `:186-195`,
`kb/entries/admin-subscription/entry.hu.md:213-226`, `kb/entries/admin-modules-booking/`.
⚠️ A felirat-változás **ugyanabban a commitban** kéri a forrásfájlt, a félkövér idézetet és a
`kb-shot` újrafelvételt — különben a PostToolUse hook exit 2-vel megáll.

### ⑦ VISSZAFELÉ KOMPATIBILITÁS — mérve, nem becsülve

`citoviso_dev`, 5 élő tenant / 48 jogosultság-sor / 9 beküldött rendelés:
**0 sértő tenant, 0 valódi sértő rendelés.** Mind az 5 tenant birtokolja a `rooms`-ot, mind a 3
booking-os a `pricing`-et is. A bevezetés **egyetlen meglévő sort sem érintene** — ADR-0072 („nem
írhatja felül a már kifizetettet") nem kerül veszélybe.
⭐ A „2+ egység" verdikt **robusztus a definícióra**: mindkét olvasat (összes egység ≥2 / az
„egész szállás" nélkül ≥2) **ugyanazt a két site-ot** jelöli többegységesnek.
**⭐ AZ ÉLES DB IS MEGMÉRVE** (2026-09-21, tulajdonosi kérésre, kizárólag `SELECT` +
`SET TRANSACTION READ ONLY`; semmi írás — §0.4). Éles = `91b856d`.

| Mérés | Éles (`citoviso`) | Dev |
|---|---|---|
| aktív tenant / aktív jogosultság-sor | **2 / 25** | 5 / 48 |
| `booking` aktív `pricing` nélkül | **0** | 0 |
| `pricing` aktív `rooms` nélkül, 2+ egységnél | **0** | 0 |
| függő lemondás (`cancel_at_period_end`) | **0** | 0 |
| sértő beküldött rendelés | **0** (mind a 3 `initial`) | 0 |

**A lánc élesen is visszafelé kompatibilis: 0 érintett sor.**

### ⑦b ⛔⛔ AMIT NEM KERESTEM: AZ ADR-0072 INVARIÁNS ÉLESEN SÉRÜL

Ugyanaz a mérés kidobott egy **másik** leletet. A `paidModuleIds()` **pontos** lekérdezését
replikáltam — mindkét lábbal (tenanthez kötött rendelés **és** a `prospect → lead` láb,
`src/tenant/paidEntitlements.ts:40-72`):

| Tenant | aktív modul | **kifizetett** | aktív, de NEM fizetett |
|---|---|---|---|
| Ferenc Ház | 13 | **8** | `booking, email, hours, newsletter, poi` (2 650 Ft/hó) |
| Nyugalom Vendégház | 12 | **0** | mind a 12 |

**A bizonyíték hajszálpontosan kijön:** az egyetlen `paid` fizetés **75 300 Ft**, éves — és a hozzá
tartozó rendelés 8 modulja (`gallery, rooms, amenities, pricing, enquiry, location, usp, reviews`)
= 3 630 Ft/hó + 3 900 alapdíj = 7 530 × 10 hónap = **75 300**. A másik öt modul soha nem lett
kifizetve. Az ADR-0072 szövege (`:3196`) — *„az aktív modul-entitlement = a kifizetett rendelések
uniója, amint a site élesedik vagy már élő"* — élesen **nem áll**; a `syncEntitlementsToPaid`
láthatóan nem fut az élő úton.

⚠️ **Három dolog, ami mérsékli, és amit ki kell mondani, hogy a lelet ne legyen nagyobb a
valóságánál:** a fizetés `gateway='mock'` → **nincs valódi vevő-pénz a rendszerben** · az eltérés
**a vevő javára** szól (többet birtokol, mint amiért fizetett — senkit nem terhelünk túl) · a
Nyugalom Vendégháznak **nincs `subscription` sora**, tehát demó, és rá az invariáns feltétele
(„amint élesedik") vitatható.

**Két járulékos éles tény:** Ferenc Háznak `booking` jogosultsága van **NULLA `site_unit` sorral**
(az `ensureUnits` nála sosem futott; az élő lapján nincs `data-cit-units`, vagyis a naptárnak nincs
egysége) · az élő lapja **két** modul-felületet mutat (`booking`, `gallery`) — és nem csak a
horgonyokat mértem, a tartalmat is: *Szobák* 0, *Árak* 0, *Felszereltség* 0, *Nyitvatartás* 0,
*Környék* 0 találat, összesen 2 db `<h2>`. ⛔ A mechanizmus (nincs mentett tartalom, és 0 egység
mellett a `rooms`/`pricing` meg sem születik) **nem bizonyított** — csak a leletet állítom.

⛔ **Ez NEM a függőségi rend tárgya**, és nem is az ADR-0193-é: külön munkát kér, mert egy
KIMONDOTT invariánst cáfol élesben.

A kockázat tehát nem a múltban van, hanem **három jövőbeli sodródásban**: a megújítás vak
kikapcsolása (`src/payment/subscription.ts:226-236`), az egység-törlés (`src/tenant/units.ts:227-233`
— 1 egységig enged, így egy ma jogos halmaz holnap érvénytelen lesz), és a `module_sales_disabled`
tranzitív hatása.

### ⑧ AMI KÍVÜL ESIK EZEN AZ ADR-EN (külön szálat kér)

A felderítés hat, a függőségtől **független** hibát mért ki. Egyiket sem javítottam — de
leírva maradnak, hogy ne kelljen újra megtalálni:

> ✅ **AZÓTA LEZÁRVA (2026-09-21):** az **1.** és a **2.** tételt a `wt/arkapu` szál landolta
> (**ADR-0193**) — az `/api/foglaltsag` már az entitlement-kaput kérdezi (`siteRendersModule`),
> a kerekítés pedig egy közös szabályra (`cit-coupon.cjs` · `splitFirstCharge`) került. A
> 3–8. tétel **továbbra is nyitott.**

1. ~~`/api/foglaltsag` ár-kapu hiánya (`src/server/public.ts:670-708`).~~ → **ADR-0193**
2. ~~**Kupon-kerekítés két példányban**~~ → **ADR-0193**. Eredeti lelet: kliens modulonként (`src/server/adminViews.ts:1499`),
   szerver a végösszegen (`src/tenant/moduleUpsell.ts:130`). Élő adaton: **1 626 Ft a képernyőn,
   1 627 a terhelésen**. Azért nem derült ki eddig, mert a park egyetlen upsellje éves (ott
   véletlenül egybeesik).
3. ✅ **→ ADR-0213 (2026-09-23).** A mock fizetőoldal upsellnél **„éves előfizetés / Ft/év"**-et ír egy időarányos EGYSZERI díjra,
   és **nulla** modulnevet (`src/console/server.ts:3319`, `src/console/views.ts:1832`) — ADR-0175
   ütközés.
4. ~~A `rooms` bekapcsolása eltünteti a fizetett `amenities` szekciót.~~ → **ADR-0209**
5. ✅ **→ ADR-0213 (2026-09-23).** Az előnézet ÍR (ADR-0089 ④), és az őre vak rá (`scripts/module-preview-check.mts:50-70`).
6. `renewableModuleIds` nem ismeri a supersessiont (`src/payment/billing.ts:126-139`) — ma
   véletlenül egyezik, mert az egyetlen kiváltott modul spine ÉS 0 Ft.
7. `activateUpsell` **nem atomi** (`src/tenant/moduleUpsell.ts:188-203`): félbemaradó ciklus után
   `booking` bent, `pricing` kint — kifizetett függőség-sértés, ami csak a következő fizetési
   eseménynél gyógyul.
8. Doc-hiba: `src/modules.ts:290-294` azt írja, a `renderableModules`-t kell árazáshoz használni;
   a kód nem teszi (csak `src/tenant/editor.ts`).

### ⑨ NYITOTT KÉRDÉSEK

- **Számlázzuk-e a `requires`-sértő modult?** Az analógia a supersessionre áll („a szekcióért
  fizettetni, amit a lap nem tud mutatni = semmiért fizettetés", `src/modules.ts:43-46`), de
  MA egyik réteg sem ismer ilyen kaput (`isBilledModule`, `computeMonthly`, `renewableModuleIds`).
  A ④.2 döntés (blokkoló lemondás) után ez az állapot **nem állhat elő szabályos úton** — de a
  ⑧.7 nem-atomi aktiválás még előállíthatja.
- **Az `unit_price` sorok hiánya** (4-ből 3 `pricing`-es tenantnál nulla): a jogosultság birtoklása
  nem garantál árat. Külön, ADAT-szintű figyelmeztetés kérdése, nem modul-függőségé.
