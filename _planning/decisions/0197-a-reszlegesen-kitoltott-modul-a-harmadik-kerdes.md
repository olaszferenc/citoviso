## ADR-0197 — A RÉSZLEGESEN kitöltött modul: a harmadik kérdés, amit egyik kapu sem tesz fel — és a polcról levett modul, amit tovább számlázunk (2026-09-22)

**Dátum:** 2026-09-22 · **Státusz:** elfogadva (FELDERÍTÉS; a javítás külön mandátumot kér) ·
**Kapcsolódó:** ADR-0192 ⑨ (innen indult a mandátum), ADR-0193 ① (az ár-jogosultsági kapu),
ADR-0194 (a kifizetett-de-üres modul teendő-sora — ez a szál ARRA épül), ADR-0059 („a
szekcióért fizettetni, amit a lap nem tud mutatni = semmiért fizettetés"), ADR-0196 (a
számlázási predikátum EGY példányra hozása), ADR-0072 (azt kapja, amiért fizetett).

**Kiváltó.** Tulajdonosi mandátum (`~/rc-briefs/bought-but-empty-brief.md`): *„megvette, de
üres"* — az ADR-0192 ⑨ nyitott kérdése, hogy a `pricing` jogosultság birtoklása nem garantál
árat.

---

### ⓪ ⛔⛔ A MANDÁTUM ÉRDEMI RÉSZÉT EGY PÁRHUZAMOS SZÁL ELVÉGEZTE, MIKÖZBEN MÉRTEM

A session indulásakor a `main` feje `ef5b081` volt. **21:22-kor** landolt a `4eed722` +
**ADR-0194**, ami a brief ① felderítését, ② döntését és ④ őrét is szállítja
(`scripts/paid-empty-check.mts`, öt modulra: `pricing` · `poi` · `amenities` · `rooms` ·
`hours`). Rebase után lefuttatva: **🟢 minden állítás áll.**

**A duplikátumot eldobtam** (`feedback_two_threads_did_the_same_work`), és a szál hatóköre a
tulajdonosi döntés nyomán arra szűkült, amit az ADR-0194 **kifejezetten nyitva hagyott**, és
amit senki nem mért meg. A „mindhárom felületen szóljon" tulajdonosi kérés utóbb **ELVETVE**
(2026-09-22, lásd ⑤.3): az Áttekintés teendő-sora elég, a Modulok fül sora és a modul
szerkesztője nem kap külön jelzést.

---

### ① ⛔⛔ A RÉSZLEGESEN ÁRAZOTT SZÁLLÁS — mindhárom meglévő kapu ZÖLDEN átengedi

Két kapunk van, és **két különböző kérdést** tesznek fel:

| Kapu | Amit kérdez | Amit NEM kérdez |
|---|---|---|
| ADR-0193 · `siteRendersModule()` | **be van-e kapcsolva** a `pricing` | van-e mögötte adat |
| ADR-0194 · `moduleContentFor().data` | van-e **bármi** tartalom a modulban | elég-e az a tartalom |

A harmadik kérdés — **„minden egységre van-e ár?"** — egyiké sem. Márpedig a
`getUnitPrices(unitId)` **egységenként** kérdez (`src/server/public.ts`, az
`/api/foglaltsag/:unitId` ág), tehát a válasz egységenként más lehet.

**Mérve, eldobható fixtúrán (valódi DB + valódi HTTP-szerver, az ADR-0193 őrének mintája
szerint; két egység, az egyik árazott, a másik nem, `booking`+`pricing`+`rooms` aktív):**

| Amit megkérdeztünk | A válasz |
|---|---|
| `/api/foglaltsag/<árazott>` | HTTP 200, **ÁRAT AD** |
| `/api/foglaltsag/<árazatlan>` | HTTP 200, **`pricing: null`** |
| ADR-0194 predikátuma (`data.pricing.units`) | **1** → „nem üres" → **a teendő-sor NEM szólal meg** |
| ADR-0193 kapuja (`siteRendersModule`) | **true** → átengedi mindkét egységet |
| az ÁRTÁBLÁZATBA kerülő egységek | `["Árazott apartman"]` |
| a vendégnek MEGMUTATOTT egységek | `["Árazott apartman", "Árazatlan faház"]` |

**A kár, emberi nyelven:** a vendég ugyanazon a naptáron az egyik fülön **28 000 Ft**-ot lát,
a szomszédoson **semmit** — és a szobalistában mindkét egység ott van. A tulajnak **egyetlen
képernyő sem szól**, mert mindkét őre zöld. ⭐ Ez nem az ADR-0194 hibája: az a „van-e
egyáltalán tartalom" kérdésre **helyesen** válaszol. A rés a két kérdés KÖZÖTT van.

⚠️ **A mai adaton ez az állapot nem áll fenn** (dev: az `eldorado` 4 egységéből 0 árazott, a
`nyugalom` 3-ból 3 — egyik sem vegyes), tehát **jövőbeli sodródás**, nem mai kár. De
előáll magától: elég egyetlen új egységet felvenni egy már árazott szálláson.

---

### ② ⛔ A POLCRÓL LEVETT MODULT TOVÁBB SZÁMLÁZZUK

`isBilledModule()` (`src/tenant/modules.ts`) négy feltételt néz: **aktív · nem gerinc · nem
kiváltott · nem lemondott** (+ nem egyszeri díjas). ⛔ **Sem a `retired`, sem a
`module_sales_disabled` nem szerepel benne.**

Mérve, **a termék saját függvényével** (nem replikával), a `nyugalom-demo` fiókon:

| Modul | Állapot | `isBilledModule()` | Ft/hó |
|---|---|---|---|
| `newsletter` | `retired: true`; a blokkja **bizonyítottan mindig `""`** (`src/engine/moduleSections.ts`, a törzse szándékosan törölve) | **true** | **490** |
| `email` | `moduleSales.ts` `DEFAULT_DISABLED = ["email"]` — nem eladható; nincs postafiók-kiépítés, nincs felülete | **true** | **390** |

Ez **pontosan** az az osztály, amit az ADR-0059 a kiváltott modulra már kimondott: *„a
szekcióért fizettetni, amit a lap nem tud mutatni = semmiért fizettetés."* A `supersededBy`
láb ott van a függvényben; a `retired` láb hiányzik mellőle.

⭐ **Az ADR-0196 jó hírt hozott hozzá:** a `renewableModuleIds()` azóta **ugyanerre az egy
predikátumra** delegál, tehát a megújítás is ezen dönt — **egyetlen záradék** javítaná mindkét
utat. Ha a két hely még külön élne, a javítás két példányban kellene.

⛔ **Tulajdonosi döntés (2026-09-22): a javítás NEM ezé a szálé** — pénzügyi viselkedés-változás
(ADR-0072 és a megújítási út érintett), külön mandátumot kap. Itt a lelet rögzül, hogy ne
kelljen újra megtalálni.

---

### ③ AZ ADR-0194 NYITOTT KÉRDÉSE — MEGMÉRVE, ÉS A FELTEVÉS NEM IGAZOLÓDIK

Az ADR-0194 így zárul: *„az ADR-0193 ár-jogosultsági kapuja a jogosultságot kérdezi. Egy
KIFIZETETT, de ÜRES `pricing` mellett tehát továbbra is **árat számolhat és fagyaszthat be** a
vendég levelébe… Ezt meg kell mérni és eldönteni — külön szálban."*

**Megmérve: nem hamis szám megy ki, hanem SEMMILYEN.** A végpont ága
`pricing: priceRows.length ? { … } : null` — **0 ársor mellett nincs mit számolni**, tehát
befagyasztani sincs mit. A feltevés a 0-soros esetre **nem áll**; a valódi rés a részleges eset
(①), ahol vannak sorok, csak nem mindenhez.

⭐ A kár ettől még valódi, csak MÁS: a naptár **teljes egészében kirenderelődik** — mérve a
renderelt lapon **942 px** (`roze-fogado`) és **1096 px** (`eldorado-kemping`): két hónap
naptár, szabad/foglalt jelmagyarázat, egységválasztó, vendégszám, név/e-mail/telefon és a
*„Foglalási kérés elküldése"* gomb — **egyetlen összeg nélkül**. A vendég kötelezettséget
vállal az ár ismerete nélkül. Ez az ADR-0193 ① által **tudatosan vállalt** viselkedés
(„a foglalás ELINDUL, csak SZÁM NÉLKÜL"), csak ott a lemondott `pricing` esetére mondtuk ki —
a kifizetett-de-üres eset ugyanoda fut ki, és ezt eddig nem írtuk le.

---

### ④ ⛔⛔ MÓDSZERTANI TANULSÁG: HÁROM MÉRÉSBŐL KETTŐ MEGGYŐZŐEN HAZUDOTT

Ezt azért rögzítjük, mert a számok másképp nem értelmezhetők, és a következő szál ugyanezekbe
a csapdákba lépne.

1. **`data-cit-module` horgonyok számolása a renderelt lapon → HAMIS POZITÍV.** Az ADR-0059
   a modul tartalmát a sablon **saját** szekciójába teszi, és csak a maradékot a horgonyzott
   blokkba (`sellingLeftover`, `src/engine/render.ts`). A `nyugalom-demo` három, kézzel beírt
   USP-tétele így „NINCS A LAPON"-t kapott — miközben ott van, `.t-amencard`-ban. **A horgony
   nem a tartalom.**
2. **`moduleContentFor()` olvasása → HAMIS NEGATÍV, kétszer.** A tartalom a **`.data`** kulcs
   alatt ül (a felső szintet olvastam → **mindent üresnek** mértem, a tudottan feltöltött
   fiókot is), és még helyesen olvasva is csak a tulaj módosításait látja — a **generált
   alapot** (`highlights`) nem, pedig az is a lapra megy.
3. **A helyes forrás az `assembleEffective()`**: `effective = base ∪ override ∪ modul-config`,
   és a `renderSite()` **pontosan ezt** kapja.

⭐ **Ami megfogta:** a mérésbe tett **POZITÍV KONTROLL** — egy tudottan feltöltött fiók, aminek
kitöltöttnek KELL mérődnie, különben a mérés hangosan bukik. Nélküle a „minden üres" eredményt
leletként adtam volna tovább.

⛔ És egy negyedik, a fixtúra-mérésben: a részleges-árazás ④ állítása először
`effectiveSiteForMultilang()`-ot kérdezett, ami egy **renderelt `path` nélküli** fixtúra-site-ra
`null`-t ad — így **üres tömböt hasonlított üres tömbhöz**, és kiírta, hogy *„minden egység
szerepel az ártáblázatban"*: **hamis zöld pontosan azon az állításon, amiért íródott.** Most a
renderelő saját bemenetét olvassa, és **megtagadja az ítéletet**, ha nincs mihez hasonlítani.

---

### ⑤ AMI NYITVA MARAD

1. **① javítása** — hol kérdezzük meg, hogy MINDEN egységre van-e ár, és mit mondjon a
   naptár/az ártáblázat a hiányzó egységnél. ⚠️ A vendég-lap megváltoztatása kinézeti döntés →
   **§2b tervkör**, nem mehet közvetlenül kódba.
2. **② javítása** — egy záradék az `isBilledModule()`-ban, külön mandátummal.
3. ~~**A „mindhárom felületen szóljon"**~~ → ⛔ **ELVETVE, tulajdonosi döntés 2026-09-22.**
   Az **Áttekintés teendő-sora elég**; a Modulok fül sora és a modul szerkesztője NEM kap
   külön jelzést. Indok: az Áttekintés az ELSŐ képernyő, a szerkesztőben pedig már ma is van
   üres-mező jelzés (`.mcfg-empty`) — a rés kicsi, az ára egy teljes §2b kör és **három
   példány ugyanabból a mondatból** (`feedback_one_rule_two_copies`).
   ⚠️ **A döntés-előzmény szándékosan marad itt áthúzva**, mert enélkül a következő szál
   ugyanezt fogja újraépíteni: az eredeti „mindhárom helyen" kérés úgy született, hogy a tulaj
   **még nem tudta**, hogy az ADR-0194 egy változata már landolt — és amint megtudta, előbb
   későbbre tette, majd elvetette. A §2b vázlat (3 működő változat, mért sor-magasságokkal:
   mobilon 127/169/188 px a mai 113-hoz képest) **eldobva**, kód nem született belőle.
   ⛔ **Saját hiba, amiért ez egyáltalán legyártódott:** egy kétértelmű „ok folytassuk"-ból
   **én választottam témát**, méghozzá azt, amit a tulaj az előző körben kifejezetten
   *későbbre* tett. Kétértelmű folytatás-kérésnél a hatókört vissza kell kérdezni, nem
   levezetni.
4. **A `rooms` „tartalom nélküli tartalom" esete** — mérve: az `aranykagylo-36` szobakártyája
   **26 látható karakter 388 px-en** (*„A szállás / A szállás egésze"*), az `agrosz` ugyanez
   247 px-en. Az ADR-0194 teendő-sora ezt **elkapja** (a `rooms` a listáján van), tehát
   javításra nem szorul — de a KÁR alakja itt más, mint a hiányzó szekcióé, és érdemes
   külön mérni, hogy a teendő-sor szövege erre az alakra is igaz-e.
