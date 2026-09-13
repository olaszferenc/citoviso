# 2026-09-13 — A §C-kapu a feladó-azonosítást a KONFIGURÁCIÓN méri (ADR-0130)

**Kiváltó:** Elek FK-004 H2 (tulaj-bejelentés). A ténylegesen kiküldött hideg megkeresés
lábazata: „A megkeresés küldője: **TESZT Szolgáltató e.v. (nem valódi)** · 8360 Keszthely,
Teszt utca 1. · nyilvántartási szám: TESZT-00000000 · adószám: 12345678-1-42" — miközben az
aláírás valódi személyt nevezett meg, és a lap teteje zöld **„Jogszerűségi kapu: PASS —
küldhető"** jelvényt adott rá.

## Amit a mérés mutatott

- **A kapu nem lehetett volna képes észrevenni.** Mind a négy §C.2 szabály a SZÖVEGET mérte
  (kitöltetlen `[…]` jelölő · a „A megkeresés küldője:" sor megléte · placeholder-gyanús
  elérhetőség a kapcsolat-blokkban), a szöveg pedig pontosan azt írta, amit a config
  diktált: a jelölő hiányzott, a sor megvolt, a kapcsolat-blokk hibátlan volt.
- **Egy éles félrekonfiguráció ugyanígy nézne ki, ugyanígy PASS-szal.** A dev-érték átírása
  ezért nem javítás — a tünetet tünteti el, a lyukat nem (tulajdonosi elhatárolás).

## A javítás (ADR-0130)

A mérés a **konfigurációra** költözött, mezőnként három rétegben: ① kitöltött-e; ② **valódi
alakú-e**; ③ nem a `.env.example` dokumentált minta-értéke (pontos egyezés, EGY forrásból).

⛔ **Nem szó-feketelista.** Ez a fájl kétszer égett meg fuzzy szöveg-heurisztikán, amely
HELYES értékre sült el (`xXx` token 2026-09-09; a valós `12345678-1-42` a `1234567` mintán
2026-09-11, ADR-0121). Egyik új szabály sem azt kérdezi, hogy egy érték „teszt-szagú-e",
hanem hogy **lehet-e valódi**:

| mező | a mérés | a dev-érték sorsa |
|---|---|---|
| `LEGAL_ENTITY_TAX_NUMBER` | magyar adószám **ellenőrző számjegye** (súlyok 9,7,3,1,9,7,3) + áfa-kód + területi kód | `12345678-1-42` → a 8. jegy 6 lenne, nem 8 → **nem létező adószám** |
| `LEGAL_ENTITY_REG_NUMBER` | 8 jegyű e.v.-szám VAGY `##-##-######` cégjegyzékszám; csupa ismételt jegy tilos | `TESZT-00000000` → egyik alak sem |
| `LEGAL_ENTITY_NAME` / `OUTREACH_SENDER_*` név | a bejegyzett név nem visel zárójeles/szögletes **megjegyzést** (karakter-osztály szabály, nem szólista) | `TESZT Szolgáltató e.v. **(nem valódi)**` → megjegyzést visel |
| `OUTREACH_SENDER_EMAIL` | szabvány szerint **FENNTARTOTT** domain (RFC 2606/6761: `.invalid`, `.test`, `example.com`…) | a dev érték valós → átmegy |
| `OUTREACH_SENDER_PHONE` | mező-szintű minta-szám (5+ azonos jegy, növekvő sorozat) — **ITT** a helye, nem a prózán | nincs beállítva → kimarad |
| `LEGAL_ENTITY_ADDRESS` | irányítószám + legalább 4 elem, megjegyzés nélkül | `8360 Keszthely, Teszt utca 1.` → **átmegy** (helyes alak) |

⭐ **A táblázat utolsó sora a lényeg:** a kapu nem „a dev-konfigot" utasítja el, hanem azt,
ami nem lehet valódi. Egy helyes alakú teszt-cím átmegy.

**Strukturált lelet** (`OutreachCheckResult.identity`): melyik env · milyen néven nyomtatja a
levél · mi az érték · mit mért a kapu. A piszkozat-lapon saját, piros keretes doboz sorolja
fel — ott, ahol a visszafordíthatatlan gomb van. ⚠️ A doboz a lap SAJÁT box-mintáját kapta
(inline border), mert a konzol-CSS-ben **nincs `.card` szabály** — az első vágásom emiatt a
lap legsúlyosabb blokkját laza szövegként rajzolta ki; a KÉP fogta meg, nem a kód.

**Egy predikátum:** a doboz és az ok-lista ugyanabból a listából származik
(`identityReason`), nem egy második regex a mondatokon.

## Mivel bizonyítva

- **Negatív önteszt:** 14 rontott konfiguráció mindegyike FLAG + megnevezi a mezőt.
- **Hamis FLAG elleni pozitív kitűzés:** az **ÉLES** konfig-értékek (prod `.env`-ből olvasva)
  mindkét felületen tisztán átmennek + három **valós** adószám (69646014-1-33 · 10773381-2-44
  · 10537914-4-44) elfogadva. A hamis FLAG ugyanolyan bukás, mint a hamis PASS: az üzletet
  állítja meg, csendben, azon a gépen, ahol senki nem futtat tesztet.
- **A bekötés alfolyamatban:** a config a modul betöltésekor olvasódik, ezért `process.env`
  írása a script tetején KÉSŐ (ESM). Külön process, saját env-vel → placeholder env: a
  VALÓDI `checkOutreachDraft` FLAG 3 mezővel; éles-alakú env: nincs azonosítás-FLAG.
- **Viselkedés a valódi küldő-úton:** `sendOutreachMail(<FK-004 prospect>, {dryRun:true})` →
  `flagged` (a dry-run a §C-kapu UTÁN tér vissza, tehát a kapu tényleg blokkol, és közben
  levél nem mehet ki).
- **Kép:** `assets/Temp/ui-identity-gate-{mobile,desktop}.png` (390px + desktop).

## Vállalt következmény (tulaj-döntést igényel)

A dev `.env` szándékosan önleleplező teszt-entitást tart → **ezen a gépen a hideg megkeresés
mostantól nem küldhető** (az Elek FK-004 7. lépése blokkolva lesz). Ez a kapu helyes
működése, nem mellékhatás. A dev-küldés visszanyerése tulaj-döntés: valós e.v.-adatok a dev
`.env`-be (a gép amúgy is csak `elek@citoviso.com`-ra küld) — **nem** a kapu tompítása.

## Párhuzamos szál — worktree-ütközés

A munka a `~/wt/cit2167c7de` fában indult, ahol **egy másik session is dolgozott** (FK-004
**H1**, a törött MMS-előnézet: `mockPhotoHealth.ts`, `photoGate` a `leadPage`-ben) — stage-elt
fájlokkal az indexben. A commit ezért **friss, üres worktree-ből** (`~/wt/citsenderid`,
origin/main-ről) készült: a két saját fájl patch-csel, a `views.ts` hunkjai kézzel újra. Így
a katalógus-regenerálás is TISZTA maradt (pontosan 5 új string, idegen nélkül).

## Módosított fájlok

- `src/outreach/outreachCheck.ts` — a §C.2 azonosítás-mérés (~300 sor) + a kapu bekötése
- `src/console/views.ts` — strukturált, mezőnkénti doboz a piszkozat-lapon
- `scripts/outreach-gate-selftest.mts` — 14 negatív + éles-pozitív + alfolyamatos bekötés-próba
- `src/i18n/catalog.json` — 5 új konzol-string
- `_planning/DECISIONS.md` — ADR-0130
- `_planning/DOMAIN/03-INVARIANTS.md` — §C.2 kiegészítés

## Nyitott

- Tulaj-döntés: menjenek-e valós e.v.-adatok a dev `.env`-be (különben dev-ből nincs hideg
  levél).
- Az FK-004 további leletei (H1 törött MMS-kép, Z1–Z4) **másik szálban** futnak.

---

# UTÓSZÁL ugyanaznap — Z1/Z2: a jelvény más kérdésre válaszolt (ADR-0135)

Tulaj-utasítás: „a Z1/Z2-t is javítsd."

- **Z1:** zöld „PASS — küldhető" közvetlenül egy piros figyelmeztetés fölött, és semmi nem
  mondta meg, melyik dönt (nem a piros: a levél kiment).
- **Z2:** a küldés UTÁN is „küldhető" állt a képernyőn.

**A premissza alatt nagyobb hiba volt.** A `sendOutreachMail` **kilenc** okból utasít el, a
jelvény pedig **egyet** mért ezekből (a §C-kaput). Mérve: három ELEK-prospect „küldhető"-t
mutatott volna, miközben a küldő-út „a mock kurátori jóváhagyásra vár"-ral dobta vissza.
**A jelvény nem tévedett — MÁS KÉRDÉSRE válaszolt**, mint amit az operátor feltesz.

**A javítás:** a lap döntő sora a küldő-út saját verdiktje
(`describeMailSendability` → `sendOutreachMail(dryRun, probe)`), a §C-jelvény csak azt
állítja, amit ítél, a nem-blokkoló figyelmeztetés pedig kimondja, hogy nem blokkol.

⚠️ **Egy lépés drága volt, és ez a tanulság:** a száraz futás `ensureLanguagePack`-je
**provisionál** (AI-hívás + DB-írás) — egy GET-render nem teheti meg. Ezért `probe` módban a
hiányt MÉRJÜK (`missingPackStrings`), ami a SZIGORÚBB irány: a próba soha nem lehet
megengedőbb, mint a valódi küldés. Ha fordítva döntök, a képernyő „mehet"-et mondana ott,
ahol a gomb elutasít — vagyis pont a javított hibát építem újra, csak az ellenkező irányba.

**Őr:** `scripts/outreach-sendability-check.mts` (pre-commit), 20 valós prospecten, a
KIRENDERELT lapon. Negatív önteszt: hazug „mehet" állítással **10 mérés pirosra megy**.
⚠️ A ② szabályt (a jelvény ne ígérjen küldhetőséget) ez a hazugság **nem** falszifikálja,
ezért külön bizonyítja magát a **ténylegesen kiment** jelvény-szövegen — különben zöld sor
lenne, ami sosem mérhetett semmit ([[feedback_fixture_must_prove_its_own_path]]).

**Amit nem tudtam élőben megnézni:** a ZÖLD („most kiküldhető") ág ezen a gépen nem érhető el,
mert az ADR-0130 azonosítás-kapu minden levelet blokkol itt. Ezért szintetikus rendereléssel
néztem meg a szövegét (a `pill approved` osztály ugyanaz, mint a korábbi zöld jelvényé).

**Módosított fájlok (utószál):** `src/outreach/sendBatch.ts` · `src/i18n/packs.ts` ·
`src/console/server.ts` · `src/console/views.ts` · `scripts/outreach-sendability-check.mts` ·
`hooks/pre-commit` · `src/i18n/catalog.json` · `_planning/DECISIONS.md` (ADR-0135)

---

# HARMADIK KÖR ugyanaznap — Z3/Z4: a sor rossz oszlopból beszélt (ADR-0139)

Tulaj-utasítás: „a Z3/Z4-et is javítsd."

- **Z3:** a lap egyszerre mondta, hogy a levél „még nem ment ki", és hogy a linken 13
  megnyitás / 119 esemény történt; a fejléc „4 megkeresés · ebből 1 ment ki".
- **Z4:** küldés után a teljes levél-szöveg és a másoló gomb változatlanul kínálva maradt.

## Amit a mérés hozzátett a bejelentéshez

- **A forgalom valódi, csak nem a leadé:** 5 sosem-küldött linkből **3-on** volt forgalom,
  minden nézet ugyanarról a Linux-desktop böngészőről (saját megnyitás). Mindkét állítás
  IGAZ volt — a hiba az EGYÜTT-ÁLLÁSUK.
- ⭐ **Megnéztem, hogy pénzt nem mozdít-e:** az ADR-0088 §4 hármas küszöb (−50% ajánlat) nem
  érintett, mert az `ensureEscalationOffer` `sent_at` nélkül kilép. A pénz-ág helyes volt.
- ⛔ **A premissza alatt latens mechanizmus-hiba:** a „✓ E-mail elküldve" a
  **csatorna-független** `sent_at`-ból jött, amit a `sendOutreachPair` is beállít → egy
  mobil-only megkeresés olyan levelet állított volna, ami soha nem ment ki. **Mérve: ma 0
  ilyen sor van a parkban.** Kimondtam, hogy ez LATENS, nem mai tünet — a javítás értéke nem
  attól függ, hány sor piros most.

## A javítás

Csatornánkénti pirulák a SAJÁT bélyegből (e-mail · mobil páros · félbemaradt pár · semmi) ·
a szám megnevezi, mit számol („4 **követett link** · ebből 1 ment ki (**bármely csatornán**)") ·
a sosem-küldött link forgalma megmondja, **mi nem lehet** · küldés után a másolható szöveg
kimondja, hogy az a MÁSODIK példány lenne (a szöveg marad — olvasni joga van az operátornak).

**Őr:** `outreach-row-truth-check.mts` (pre-commit), a KIRENDERELT lapon, 5 sor-állapotra +
a másoló-dobozra; a fixture a termék `getProspects()` sorából épül. Önteszt: **5 piros**.
⚠️ A „forgalom-figyelmeztetés" szabályt a hazug bélyeg nem falszifikálja → **különbségi**
eset bizonyítja (nulla forgalomnál NEM figyelmeztethet).

**Módosított fájlok (harmadik kör):** `src/console/data.ts` · `src/console/views.ts` ·
`scripts/outreach-row-truth-check.mts` · `hooks/pre-commit` · `kb/entries/console-lead/entry.hu.md` ·
`kb/entries/console-outreach-draft/entry.hu.md` · `src/i18n/catalog.json` ·
`_planning/DECISIONS.md` (ADR-0139)

---

# NEGYEDIK KÖR ugyanaznap — Z5: zsargon és nyers adat a felületen (ADR-0141)

Tulaj-utasítás: „a Z5-öt is javítsd."

**A bejelentés:** „pipeline… (H1-bázis)", „kézi küldés (A2)", „Egy claim… artifact-verdikt",
„a gammu-smsd áll", „Pilot-tölcsér (H1–H5)", „Order-intentek", „scrape: áll" — plusz nyers
adatbázis-értékek: `nincs_honlap` a piszkozat-lap címében (miközben ugyanott a választó már
„nincs honlap"-ot írt) és az angol `sent` a lead-soron.

**A javítás két elve:**
1. **A felirat REGISZTERBŐL jön** (`segmentLabel`, `prospectStatusLabel`, `sourceLabel`,
   `provFieldLabel`) — a szegmens-név ugyanabból a listából, amiből a legördülő épül.
   ⛔ Ismeretlen értéket nem találgatunk: alsó vonás → szóköz, tehát egy ÚJ enum csúnyán, de
   IGAZUL jelenik meg.
2. **A kód helyére az kerül, amit JELENT** („H1 — horog" → „Megfogja-e a levél").

⭐ **Amit az őr a bejelentésen FELÜL talált — ez a kör tanulsága:**
- fázis-kód: **10 további** szivárgás (`Provenance (A4)`, `Szegmens-bontás (H4)`, 2× `(A2)`,
  6 hely a KB-ben),
- nyers enum: **3**, amit a lelet nem is sorolt (`google_places`, `presence_check`,
  `places_match`) — a „Honnan jött az adat" tábla forrás- és mező-oszlopából.

**Egy bejelentés a LÁTOTT példányt sorolja; az őr a MINTÁZATOT.** Ha csak a leletet javítom
ki, a felület fele ugyanúgy zsargon marad.

⚠️ **Az őr hatóköre szerkezeti, nem kivétel-lista:** a zsargon-szabály CSAK a `T(lang, …)`-be
írt szövegen fut, mert a `scrape` szó kód-azonosítóként is él (`ic("scrape")`, `href:
"/scrape"`) — egy szólista azokra is elsülne. A fázis-kód mintája szűk (tartomány, zárójeles
kód, `-bázis` utótag), mert a puszta „H1" a SEO-ban **jogos** felirat; negatív eset őrzi.

⚠️ **A nyers-enum szabályt az adat elrontása NEM falszifikálja** (az a NÉZETRŐL szól), ezért a
detektort a ténylegesen kiment markup igazolja.

**Módosított fájlok (negyedik kör):** `src/console/views.ts` ·
`scripts/internal-ref-check.mts` · `scripts/outreach-row-truth-check.mts` ·
`kb/entries/console-report/entry.hu.md` · `kb/entries/console-lead/entry.hu.md` ·
`kb/entries/console-outreach-draft/entry.hu.md` · `src/i18n/catalog.json` ·
`_planning/DECISIONS.md` (ADR-0141)

---

# ÖTÖDIK KÖR ugyanaznap — Z6/Z7: a tiltott gomb és a kiment cím (ADR-0142)

**Z6:** „Páros indítása (nincs szám)" — a gomb a saját előfeltételének hiányát közölte, és nem
derült ki, hogyan lehet számot pótolni. **Z7:** küldés után a cím-mező és a „Cím mentése" gomb
aktív maradt a „kiküldve" jelvény alatt.

⭐ **A premissza fele közben megszűnt, és ezt kimondtam:** a Z6 „aktívnak látszik" része egy
párhuzamos szál (ADR-0136) munkája nyomán már javított volt — a `.con button:disabled` szabály
bekerült, a gomb pedig addig is `disabled` volt. **Nem az én érdemem**, és nem is állítom
annak. Ami valóban nyitva volt: a felület kimondta a HIÁNYT, de nem mondta meg a KIUTAT.

**A javítás két elve:**
1. **A tiltott vezérlő mellé odakerül a kiút** — ott, ahol a hiány látszik (link a lead
   adatlapjára). ⚠️ A szám a LEAD adata, nem a követett linké → nem második beviteli mező,
   hanem hivatkozás.
2. **Visszafordíthatatlan után nincs szerkesztés azon, amit elküldtünk** — a cím olvashatóan
   megmarad, űrlapként nem.

**Őr:** +5 állítás a kirenderelt lapon; az önteszt 5 → **9 piros**.

⚠️ **Amit nem tudtam élőben megnézni:** a Z6 állapot (kapu ÁTENGED + nincs szám) ezen a gépen
nem áll elő (az ADR-0130 kapu mindent blokkol) — a szöveget a valódi renderből olvastam ki, a
gomb tiltottságát az őr méri. A Z7-et ÉLES lapon néztem meg.

**Módosított fájlok (ötödik kör):** `src/console/views.ts` ·
`scripts/outreach-row-truth-check.mts` · `kb/entries/console-outreach-draft/entry.hu.md` ·
`src/i18n/catalog.json` · `_planning/DECISIONS.md` (ADR-0142)
