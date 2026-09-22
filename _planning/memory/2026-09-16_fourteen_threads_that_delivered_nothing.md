# 2026-09-16 — Tizennégy szál, ami NULLÁT szállított — és a mérés, ami megmaradt

**Státusz:** LEZÁRVA, termék-változás NÉLKÜL. Ez a jegyzet két dolgot tart meg: ① a kör
**egyetlen valódi termékét**, az öt felmérő mérését (hogy a következő kör ne nulláról induljon,
és ne az én összefoglaló soromat idézze ténynek), és ② egy **operatív tanulságot**, ami drágább
volt, mint bármelyik lelet.

## ⛔⛔ A TANULSÁG: az orchestrátor JELENLÉTE az erőforrás, nem a szálak SZÁMA

Elindítottam **14 párhuzamos sessiont** — mind a saját worktree-jében, mind ellenőrzött
`pane_current_path`-tal, mind megkapta a fájlban átadott `BRIEF.md`-t, mind elindult
(`draft ÜRES`, aktivitás mérve). Utána beállítottam egy **20 perces** figyelőt, és a session
**hat napra elhallgatott**.

**Mérve hat nappal később:** mind a 14 tmux-session **halott** (a watchdog retire-olta),
mind a 14 fában **0 nem-landolt commit és 0 módosított fájl**, és a közben landolt **20
memória-jegyzet közül EGY SEM** az övék (a témák teljesen mások: Barion, ontológia,
modul-függőségek, szoba-kártya, árazás — azok más körök termékei).

**Elveszett munka: nincs.** Szállított munka: **nulla**.

- Az előző kör tanulsága az volt, hogy **a tulaj üzenetei nem érnek célba** (16 szálon
  beküldetlen draft) — lásd `2026-09-15_seventeen_threads_and_the_deploy.md`. Erre felkészültem:
  a kézbesítés `C-u` + `send-keys -l` + `Enter` + **ellenőrzés** volt, és működött.
- **De a következő rést nem láttam:** a szálak elindulnak, aztán **vezető nélkül elfogynak**.
  A 14 szál nem „beállítás és kész" — minden szál kérdez, kapunál megáll, konfliktusba fut, és
  ha nincs, aki válaszol, a watchdog eltemeti.
- ⭐ **Eljárásként:** a szálak száma ne legyen nagyobb, mint amennyit az orchestrátor **ugyanabban
  az ülésben** végig tud vinni. Ha a kör nem fejezhető be egy ülésben, a szálakat **ütemezni**
  kell (egyszerre 3-4), nem egyszerre kilőni.
- ⚠️ A `BRIEF.md` mint megbízás-átadás **jól működött** (14/14 megkapta, 14/14 a helyes fában) —
  a mechanika nem hibás, a **felügyelet** hiányzott.

## A MÉRÉS — öt felmérő, a MAI kódon (2026-09-16, HEAD=`5aa0d28`)

⛔ Nem a jegyzeteket idéztük: a bejelentett tételek **felét a mérés átfogalmazta vagy megdöntötte.**
⚠️ **2026-09-22-én újramérve a négy kulcs-tétel MIND NYITOTT** (`origin/main` = `4384166`):
`leadFilters.ts:74`-en nincs `sortBy` · `kbPacks.ts:55` bájtegyezés + `:93` „MAGYARUL maradnak" ·
`kb-gate.mjs`-ben 0 `waiver` · `.adm-btn-bad` nyers tokenen.

### A) A mérőeszköz (Elek-futó) vaksága

| # | Lelet | Mérve |
|---|---|---|
| A1 | **Bizonyíték-vakság** — a bejelentés 7 lépésről szólt, a valóság **41 navigálatlan lépés 115-ből**, ebből **23 kézi nulla saját bizonyítékkal** (a képe az előzőé). A futó `út:` nélkül nem navigál (`runner.mts:511`), a képet mégis elkészíti (`:528`, `:529`), és a `capture()` visszaállít (`:343`, `:371`) → **bájtazonos**. A legrosszabb: **FK-002 2–7. lépése ugyanaz a lap.** | RÉSZBEN igaz, **alulmért** |
| A2 | **Hamis zöld verbek, 5 mechanizmus:** ① `nem látható` **üres/fehér lapon is zöld** (`runner.mts:254-262`, count=0 → ok — 6 állítás: `FK-005b:23,55,67,68,75`) ② a kattintás-hiba **elnyelődik**, ha a lokátor eltűnt (`:189-193`) ③ `darab ".adm-inv" >= 2` (`FK-005b:89`) **SOHA nem tud pirosra menni**: a park számlái szándékosan halmozódnak (`run-all.mts:238-239`, mérve **18 sor**), és a `.adm-inv` osztályt a **bukott** sor is viseli (`adminViews.ts:3153`) ④ FK-002 „**minden** modul" **egy** találattal zöld (`:23-27`) ⑤ `FK-001:32` a chip-sor feliratát látja, nem a tartalmat (`adminViews.ts:3322-3328`) | IGAZ |
| A3 | **Postafiók:** az egész készletben **1** postafiók-sor van, az is kézi (`FK-004:68-69`); **FK-005a-ban NULLA** (csak `adat:` a `:53`-on, ami nem állítás — `fkParse.ts:29-30`). A lánc **kerüli** a postafiókot: a linket a DB-ből veszi (`run-all.mts:195-207`). `EMAIL_PROVIDER=smtp` → valódi Zoho, `outbox/` **0 fájl** | RÉSZBEN — **rosszabb** |
| A4 | ⚠️ **TERMÉKHIBA a mérés-vakság alatt:** a `Kvalifikáció` (`leadFilters.ts:74`) és `Mock` (`:79`) oszlopnak **nincs `sortBy`-ja** → a **nyers kódra** rendez, miközben magyar feliratot mutat (`views.ts:1334`, `:1347`). Éles korpusz: modern 325 / no_site 192 / **outdated 78** / NULL 3 → „modern, nincs honlap, **elavult**" = **törött ábécé**; mock: approved 4 / generated 2 / **rejected 1**. ⛔ **A 139/139 zöld őr fixtúrájából épp ez a két érték-alak hiányzik** (`lead-filter-label-check.mts:86-91`, `:77` minden sor `latestArtifact: null`). Plusz: a **HTTP query-parse** (`server.ts:1335-1356`) alatt **egyetlen kapu sincs**; a popover-interakciót (`citCf`) semmi nem futtatja. ⭐ A `Terület` oszlop már megkapta a `sortBy`-t (`:63-71`) — a minta megvan | IGAZ + új |
| A5 | `FK-005b:17-24` „**pontosan 3 nyelv**" — **semmi nem számolja meg**. A jelölők előre `checked` lehetnek (`adminViews.ts:1995-1996`, `:1980`) → **a kattintás KIkapcsol**; a szűkített futás nem takarítja a `site_multilang`-ot (`run-all.mts:248`) → némán 0 nyelvvel mérhet | IGAZ |
| A6 | **FK-006:** az ELEK-tenant **0 db** (`tenant` = 1 sor, „Nyugalom Vendégház"). Az előfeltétel-hiba **javítva** (ADR-0177). ⛔ **A költség-félelem CÁFOLT: ~$0** — a `run-all.mts FK-005a FK-006a FK-006b` lánc **nem generál mockot** (a mock-generálás az egyetlen fizetős: ELEK $0,13475/3 hívás). **Időutazás IGEN**, és az órát **senki nem állítja vissza automatikusan** → `reset-elek-billing-clock.mts --go` KÖTELEZŐ. A `FACTS` ma **2 tényt ismer a 3-ból** (a jóváhagyott mock kimondatlan) | RÉSZBEN, a költség CÁFOLT |

### B) A felirat-kérdés — a kör legnagyobb tétele, mind a 4 résztétel ÁLL

- **A szabály nem bug, hanem kimondott szabály HAMIS PREMISSZÁN:** `kbPacks.ts:41-59`
  `labelsOf()` + `kbTranslationValid()` **bájtegyezést** követel a `**„…”**` feliratokra, a hívó
  pedig **az EGÉSZ fordítást eldobja** (`:134-135`). A prompt is ezt kényszeríti (`:93-94`).
- **A premissza valótlan, két rétegen:** a fejléc-komment (`:6-9`) azt állítja, „az admin
  képernyője ma magyar" — miközben `T(lang,…)` literál **815 distinct** (`adminViews.ts` 618),
  és a tenant-admin az **ADR-0067** szerint a tulaj nyelvén fut. A `language_pack` mind a 6 élő
  nyelven **generated**, **3029–3194 kulcs/nyelv** → **adat nem hiányzik.**
- **A kár, két bázison** (mindkettőt írd le, ne válassz vakon): tenant-entryken **171–172
  distinct a 188-ból**, **230–233 előfordulás a 252-ből** nyelvenként; teljes korpuszon
  **1518 hamis idézet a 1704-ből**, 6 nyelven. ⚠️ A naiv `grep -o` **242**-t ad a 252 helyett,
  mert **10 felirat sortöréssel tördelt** — `matchAll(/\*\*„([^”]+)”\*\*/g)` kell.
- ⛔⛔ **Egy meglévő őr KITŰZVE, ZÖLDEN VÉDI a hibát:**
  `kb-translation-integrity-check.mts:66-78` („⭐ lefordított felirat bukik"). A többi kapu **más
  kérdésre válaszol**: `kb-translation-coverage-check` a `source_hash`-t, `kb-check:117-120` a
  **magyart a magyar ellen**, `kb-freshness` a dátumot. **Őr a nem-magyar kimenetre: 0.**
- **Nyelvi kép: 0 db a fán** — 39 képhivatkozás, **100 % `assets/hu`**. A `kb-shot` nyelv-paraméteres
  (`:62`), de **5 helyen beégetett `"hu"`** (`:1293`, `:1321`, `:1330` körül) → a §J.26 papíron él,
  **0× futott** nem-magyarra.
- ⛔ **Kötött sorrend, mérve:** szabály → őr → képek. Az `imagesOf()` **azonosságot követel**,
  ezért a képek a szabály ELŐTT **minden fordítást integritás-sértésre buktatnak**; az őr a
  szabály előtt a **hibás viselkedést tűzné ki**. ⚠️ Minden szerkesztés után **kötelező** a
  `kb-translation-coverage-check` (ADR-0184): a `source_hash` azonnal elavul, és **magyar
  fallback NINCS**.
- **Melléklelet:** **14 idézett felirat egyáltalán nincs a `language_pack`-ben** (`Bővítés`,
  `Modulok együtt`, `Fizetés és generálás`, `Jelenleg`, `Következő számla`…) — vagy elavult
  idézet, vagy **beégetett magyar a tulaj-felületen** (i18n-rés).
- **`kb-gate` kivétel-mód: NINCS** — `kb-gate.mjs:129-132` csak `pass` | `check` | `--self-test`,
  a `pass` egyetlen kapuja egy ≥20 karakteres **szabad szöveg** (`:57-63`); `deploy-prod.sh:206-207`
  (GATE 1c) ezen áll. Ezért kellett 09-15-én a tulajdonosi kivételt a **PASS indoklásába**
  fogalmazni. Irány: `verdict: "pass" | "waiver"`, a waiver **kötelező lejárattal és nevesített
  nyitott tétellel**, és a kivétel ténye jelenjen meg a deploy-kimenetben és a `DEPLOYED` sorban.

### C) Felület, jog, őr-hatókör

- **9 natív dialógus** (nem 7): 8 × `confirm()` + 1 × `alert()`, `prompt()` = 0 —
  `views.ts:2466, 2581, 2603, 3772, 5408, 5516, 5618, 5794` + `testLogViews.ts:249`.
  **5 visszafordíthatatlan, ebből 3 KIKÜLDÉS** (2581 csatorna-zárás · 3772 jóváhagyott mock
  törlése · 5408/5516/5618 küldés). A terv **2 fajtát** mutasson (megerősítés + tájékoztató).
  ⭐ **Nem zöldmezős:** `.adm-mdl`/`.adm-mdlveil` (`citui-admin.css:846-854`) és a no-JS
  `.adm-confirm` (`:647-651`) már él a tenant-adminban; a **konzol CSS-éből hiányzik**.
- **`kb-check` KORPUSZ-CSAPDA:** `VIEW_GROUPS` (`kb-check.mts:25-77`) `tenant`(7) / `operator`(7,
  benne `views.ts` a `:50`-en). A `kb/entries/admin-modules/entry.hu.md` — **`audience: tenant`** —
  **5 `payResultPage`-feliratot idéz** (`:158,159,161,165,169`), **sima idézetként**, a `:120`
  viszont csak a félkövér alakot köti → **0 védelem**. ⛔ **És ha a szerző HELYESEN, félkövérre
  tenné, a tenant-korpusz PIROSRA MENNE** — a szabály **a védelem nélküli idézés felé
  kényszerít**. A `payUnknownRefPage` (`views.ts:1768-1792`): **0 őr** `scripts/`+`tests/`+`hooks/`.
- **JOGI — külső eredetek** (ÚJ, a listán nem volt): **Google Fonts 7 forráshelyen**
  (`render.ts:82-84`, `renderVaried.ts:142-143`, `skins.ts:455-457`, `theme.ts:109/113/117/121/125`
  = **mind az 5 preset**, `adminViews.ts:91-92`, `public/index.html:14-16`,
  `citui-styleguide.html:8-10`); **unpkg** a `public/index.html:18,484`-en — ⛔ **a
  VENDÉG-főlapon** — és `views.ts:6399-6400`; OSM-csempe csak a konzolon (`:6451`, `:6566`).
  **Generált kimenet: 85 lap, ebből 37 hív `fonts.googleapis`-t.** ⛔ **Őr: 0** — a
  `cookie-audit.mts:97-107` csak **8 nevesített trackert** ítél, a Fonts nincs köztük, ezért a lap
  **„tisztának" mérődik**, és a szkript **pre-commitba sincs kötve**.
- **Őr-hatókör:** `.adm-btn-bad` (`citui-admin.css`) = **3,91** (fehér a nyers `--citui-bad`-on),
  **2 hely**, mind tenant-admin (`adminViews.ts:1698`, `:1842`) → `--citui-bad-ink` = **6,50**
  (⛔ a `--citui-bad` **tokenhez** ne nyúlj, 40+ fogyasztó). **Miért maradt megméretlen:** a
  `console-contrast-check.mts:165-176` `ROUTES`-a **10 konzol-útvonal**, a **tenant-admin nincs
  hatókörben**. Mellék: `.con .cf-btn i.cf-count` = **2,41** (`citui-console.css:990`), az őr
  `textContent.length > 1` szűrője (`:113`) átengedi; a `citui.css:50` doksi-sora **elavult**.
- ⛔ **PREMISSZA-JAVÍTÁS: a „94 tételes lista" NEM LÉTEZIK.** A
  `2026-09-15_partner_handlers_in_guard.md:54` csak **aggregátumot** közöl (**97** escape-eletlen
  `T()`-attribútum) és csak a 3 törő tételt nevezi meg. **Forrás-szintű escape-őr nincs**
  (`ls scripts/ | grep -iE "escape|attr"` → 0), tehát új escape-hiba nem mért felületen némán átmegy.

## ⛔ Amit a mérés MEGDÖNTÖTT — ezekre ne induljon szál

| Bejelentés | Valóság ma |
|---|---|
| „Az olasz/angol `confirm()` sosem fut le (aposztróf)" | **Javítva** (`jsStr`, `04e8224`); `dialog-fires-check.mts` **zöld**, 21 vezérlő × 8 nyelv |
| „1 gomb 4,5 alatt, **13 helyen**, házon átívelő" | A `.con button.bad` **2026-09-15-én javítva** (`6f90b44`, legrosszabb 5,57); `console-contrast-check` 4896 elemen zöld |
| „`payResultPage` feliratainak nincs védelme" | **Túl erős:** i18n **hiánytalan** (`i18n-sources.mjs:140`, 8/8 a katalógusban), felirat-drift 0 |
| „FK-006 valódi LLM-költséggel jár" | **~$0** a szűkített láncon |
| „A hírlevél-modul a semmibe küld" | `modules.ts:104` `retired: true` |
| „318 elem a kontraszt-küszöb alatt" | Az őr él, `hooks/pre-commit`-be kötve |
| „29 nyelv AI-csomaggal" | `siteLangs()`/`uiLangs()` szétválasztva (ADR-0128) |

## Környezeti leletek (megtéve)

- ⛔ **24 NAPOS szerver ősi kódon: leállítva.** PID `1687977`, `tsx watch src/console/server.ts`,
  indult **2026-08-22 17:19**, cwd egy **TÖRÖLT inode** (`~/wt/cit2167c7de (deleted)`) — a fát
  alatta törölték és újra létrehozták —, és közben a **KÖZÖS dev DB-re** írt. Egy előző szál
  jelentése szerint **kétszer piszkította vissza a lokál parkot**. Porton nem figyelt.
- **Két beküldetlen draft, mindkettő MÁS kezelést kívánt** (ez a döntés része, nem mechanika):
  ① `rc-47a3cf02` „hagyd lokálban, majd landolod" — **TÚLHALADOTT**, a szál már landolt
  (`cdfdb43`) → nem kézbesítettem; ② `rc-98ddcdbb` „futtasd le a 100 leades összemérést" —
  **BLOKKOLT**, az Apify és az Anymail kulcs a `.env`-ben **0 sor** → úgy kézbesítettem, hogy a
  kulcs-hiányt is megmondtam, nehogy számot találjon ki.
  ⭐ **A beküldetlen draft nem mindig kézbesítendő** — előbb meg kell mérni, igaz-e még.
- **Négy port-ütközés** a hash-elt worktree-portokban (4662, 4622, 4660, 4632 mind **duplán**) —
  a `rc-wt-prepare.sh` nem ellenőrzi az ütközést, a szálaknak kézzel kell.

## Nyitva maradt (mind a 14, változatlanul)

A1 bizonyíték-vakság · A2 hamis zöld verbek · A3 postafiók · **A4 a rendezés termékhibája** ·
A5 FK-005b nyelv-számolás · A6 FK-006 futtatás · **B1 a felirat-szabály** · B2 az őr ·
B3 nyelvi képek · B4 a `kb-gate` kivétel-módja · C1 a 9 dialógus (§2b) · C2 a korpusz-csapda ·
**C3 a külső eredetek (JOGI)** · C4 az őr-hatókör.

**Tulaj-teendő, változatlanul:** a **Zoho-alias** az `info@citoviso.com`-ra (a cím **kódban él és
élesen fut** — `config.ts:209` —, tehát ma a fizető ügyfél válaszát nyeli el) · a Barion
hatósági bizonyítvány + videó-azonosítás · az Apify/Anymail kulcsok.
