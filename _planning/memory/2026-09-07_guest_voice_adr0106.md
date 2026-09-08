# 2026-09-07 — ADR-0106: vendég-hang korpusz + multi-portál cap fel + „Honnan tudjuk?" forrás-panel

## Kiindulás (tulaj-panasz)

A mock-szöveg műszaki-leíró és taszító („nyugodt kemping központi fürdőszobával, fehér
csempével"); az ownerIntro kézi FB-beillesztés ellentmond az ember-mentes jövőképnek; a
kurátor nem látja, mi honnan folyik be; több portálon megtalált szállásból csak keveset
olvasunk; a Google-vélemények szövegét nem hasznosítjuk.

## Diagnózis (mérve)

- A hangnem-prompt már jó (ADR-0097) — a plafon az ADAT.
- Google-véleményből CSAK szám jött; a régi elutasítás oka a NÉZETENKÉNTI díj volt, ami a
  generálás EGYSZERI hívására nem áll (5 vélemény ≈ 0,025 USD/lead).
- `enrichPortal` leadenként 2 profilnál megállt, pedig a jelölt-lista 6 hostos.
- Lead-mező- és fotó-provenance létezett, SZÖVEG-provenance nem.

## Elvégezve (mind landolt ebben a körben)

1. **ADR-0106** a `_planning/DECISIONS.md`-ben.
2. **① Vendég-hang**: `enrichGuestReviews` pass (Places Details `reviews`, A4-kapuzott
   place-id, 30 napos frissesség `guestReviewsFetchedAt`-tal — az üres válasz is friss
   válasz) + portál schema.org `review` node-ok (CSAK high-band, a fotókkal azonos kapu;
   `PortalReview` a profilon). Generátorban: `guestVoice` blokk a promptban (hangnem+tény,
   szó szerinti átvétel tilos, negatívum tilos), az idézet-verifikáció ÉS a tényhűség-őr
   korpusza kiterjesztve. Generálás-úton stale-nél inline refetch; bukásnál a stale Google-
   tartalom DROP (policy), sosem használjuk elavultan.
3. **② Cap fel**: `portalLookup` default 2→6 (= a host-dedupolt jelölt-lista szélessége);
   politeness változatlan.
4. **④ Forrás-panel** (§2b kapu VÉGIG: 2 mock → tulaj „legyen az A" → kontraktus
   `assets/design-refs/console/source-panel/` → surface-gate approve → kód):
   `inputs.sourcePanel` pillanatkép a generálásból (portálok, vélemény-számok, ownerIntro,
   kép-jogállások, `facts[{label,source,quote?}]` — az idézet-attribúció ugyanazzal a
   squeeze-szabállyal, amivel a verifikáció futott); konzolban `mockSourcePanel` a Mock-fülön
   (4 kártya + elem→chip→idézet lánc a marketing-őr `copyNames` egyeztetőjével + forrástalan-
   sáv + „csak a problémák" szűrő). Régi artifactnál a panel nem jelenik meg.
5. **KB**: `console-lead` entry új szekció + dedikált, scriptből lőtt `source-panel.png`
   (kb-shot: `#ls-mocks` horgony + elem-lövés, sticky-sávok rejtve). Tudásbázis-őr első körben
   FLAG (idézet-nélküli ág elhallgatva; régi-mock eset; kép-elavulás) → javítva → PASS.

## Mérések (Pitypang Vendégház, élő)

- 5 Google-vélemény befolyt; sellingPoints 9 tény, köztük vendég-hang eredetűek
  („borkóstoló présházban", „csillagos ég alatti dézsázás"); az intro már vendég-hanggal zár
  („A vendégek visszatérően dicsérik a házigazdák kedvességét…"). Mindhárom őr PASS.
- Panel-viselkedés Playwrighttal: idézet nyit/csuk, 3 guest-chip, szűrő, JS-hiba 0.
- Mock-viselkedés tanulság (megint): a width-transition MIATT a kattintás utáni azonnali
  mérés hamis ❌-et adott — animációnál `waitForTimeout` a mérés előtt.

## Tanulságok

- **A kb-shot minden képet újralő és zaj-diffet termel** (apró byte-eltérések az érintetlen
  entry-ken is) — csak az érintett entry képeit tartsd meg, a többit `git checkout`-old,
  különben a commit „mindent frissítettem"-nek hazudja magát.
- A no-quote forrás-doboz szövege forrás-függő legyen (leírás vs. szolgáltatás-lista) —
  §B.17 a saját felületünkre is áll.
- Places-díj érv mindig ÚTVONAL-függő: per-view és per-lead-egyszeri költség két külön világ.

## Nyitva

- Vendég-hang tömeges bemérése a teljes lead-parkon (60-as budget/futás) — hatás a
  marketing-őr PASS-arányra.
- Kimaradt-tények egykattintásos visszaadása a forrás-panel chipjeiről (ma a szöveg-panel
  chipjei tudják).
- ADR-0101 outreach-levél implementáció (előző szálról továbbra is nyitva).

---

# UTÓSZÁL (2026-09-07/08) — A NÉMA BUKÁSOK LÁNCA: a tulaj gombja „nem csinált semmit"

Tulaj-panasz: „hiába veszek bele nem szereplő témát és nyomom meg az újragenerálást,
lófasz nem történik". A kivizsgálás **négy egymásra rakódott néma hibát** talált — mindegyik
külön-külön elég volt ahhoz, hogy egy MŰKÖDŐ funkció töröttnek látsszon.

## ① Az in-memory őr némán eldobta a kérést (`a8a037f`)

Kizárásos bizonyítás: a böngésző KIKÜLDTE a POST-ot (Playwright), a `recopyArtifact()`
közvetlenül hívva 40s alatt lefutott (`ok:true`) — tehát a route nyelte el. Az artifact-id
beragadt a `recopying` Setbe, így minden későbbi kérés a „már fut" ágon tűnt el: nulla log,
nulla DB-írás, nulla képernyő-szó. **Set → Map(id→indítás) 5 perces TTL-lel**, és minden ág
mond valamit („új szöveg készül" / „már fut, várd meg").

## ② A háttérmunka nem látszott (`a8a037f`)

A panel a kattintás előtt és után PONTOSAN ugyanúgy nézett ki, miközben 40–60s AI-munka
futott. → a generálás mintája: állapot-pill + önfrissítés.

## ③ A háttérmunka HIBÁJA nem jutott el a képernyőre (`f0a9246`)

A tulaj három kérése elindult, és mindhárom ezen halt meg:
`"Your credit balance is too low to access the Anthropic API"`. A rendszer TUDTA, a napló
LEÍRTA, a képernyő HALLGATOTT — a fire-and-forget hívásnak nem volt hova visszaszólnia.
→ `lastBriefError` + `explainAiFailure()` (kredit / rate limit / kulcs / hálózat, cselekvésre
alkalmas mondattal) + az utolsó BEFEJEZETT futás eredménye 30 percig a panelen, a gomb fölött.
**A hiba-út VALÓDI hibán mérve** (az egyenleg tényleg üres volt) — ritka alkalom, ki kell
használni, amikor a hibaág élesben reprodukálható.

## ④ A SAJÁT REGRESSZIÓM: a chipek némán halottak lettek (`c1b735c`)

A ②-es javítás első változata a TELJES űrlapot cserélte az állapot-pillre, de a „nem említi"
chipeket a képernyőn hagyta. A chipek a `#cp-in` mezőbe írnak — ami már nem létezett —, ezért
a bekötő szkript kilépett (`if(!box||!chips.length) return`), és minden chip halott gombbá
vált. **Pontosan azt a tünetet termeltem újra, amit meg akartam szüntetni.**
→ az űrlap MARAD, csak a GOMB helyére kerül az állapot.

## ⑤ A „nem említi" lista duplikált ÉS hamisat állított (`d972e76`)

Mért premissza (8 legutóbbi mock): 4 érintett, **5 chip olyat kért, amit a copy már kimond**.
Plusz a Haus Elisabeth-nél 10 nyers tétel → 10 chip (Platán Strand háromszor, háziállat
kétszer, konyhahasználat kétszer). → 4 új csoport (Strand és vízpart · Konyhahasználat ·
Háziállat · Panoráma; a strand SZÁNDÉKOSAN nem a medence-bucketbe) + a „nem említi" ítélet
a copy-felülethez mérve, a marketing-őr saját `copyNames` egyeztetőjével.
⛔ **A szűrés a csoport TAGJAIN fut, nem a címkéjén** — építés közben mérve: a címke-alapú
szűrés kidobott egy valóban hiányzó „Szauná"-t, mert a bucket neve „Medence és wellness" és a
szöveg említette a medencét. Ha a címke már szerepel, a chip átnevezi magát a hiányzó tagra.

## ⑥ Infrastruktúra: a :4600 19 committal lemaradt (`f6b8ebe`)

A `citoviso-main-sync` 2026-09-06 02:00 óta MINDEN percben elbukott: a memória-desztilláló
egy TRACKED naplófájlt ír a fő fába, attól a fa „piszkos", és az őr (helyesen) megtagadja a
syncet. A napló átemelve+commitolva (nem eldobva — értéke van), a fa felzárkózott.
⚠️ **Szerkezetileg nyitva:** a cron 02:00-kor újra bepiszkítja. Döntés kell: a napló ne legyen
tracked, VAGY a desztilláló ne a fő fában fusson.

## ⛔ SAJÁT HIBA A JELENTÉSBEN — téves riasztás

A Haus Elisabeth mockjainak eltűnését „párhuzamos session törölte a közös dev DB-t"
diagnózissal jelentettem, és javaslatot tettem dev-mentésre. **A tulaj korrigált: PURGE volt**
— szándékos művelet. Tanulság: az adatvesztés-gyanú előtt meg kell KÉRDEZNI, történt-e
szándékos törlés; a „nincs mentés" narratíva illeszkedett egy korábbi valós esethez, és ettől
tűnt kézenfekvőnek. Illeszkedő minta ≠ bizonyíték.

## Mérve (végponttól végpontig, DB-szinten, a tulaj saját :4600-án)

gomb → visszajelzés ✅ · folyamat-állapot ✅ · 40–50s alatt DB-változás ✅ · a kurátor-utasítás
teljesült („Kültéri medence a kertben, **a Platán Strand sétatávolságra**"; másik körben a
kutyabarát alcímbe ÉS kiemelésbe) · chipek élnek futás közben ✅ · JS-hiba 0.

## Tanulság-sűrítmény

**A fire-and-forget háttérmunka HÁROM dolgot tartozik a felhasználónak: hogy elindult, hogy
fut, és hogy MIÉRT nem sikerült.** Bármelyik hiánya „a gomb nem működik"-ként érkezik vissza —
és a hiányzó harmadik (a hibaok) volt az, ami egy egész délutánt elvitt egy üres API-egyenleg
miatt.

## ⑦ ZÁRÓ JAVÍTÁS (2026-09-08) — a ⑥ szerkezeti oka is elhárítva

A tulaj: „csináld meg most". A premisszát mértem, nem a szó szerinti kérést: a main-sync
TELJES naplója **2981 megtagadás, ebből 2921 EGYETLEN fájl miatt** (`.distill-manifest`);
a maradék eseti emberi munka a fő fában (CLAUDE.md, néhány forrásfájl).

- **A napló GÉPI ÁLLAPOT, nem forrás** → `.gitignore` + `git rm --cached`. A desztilláló
  változatlanul működik, a fa nem lesz többé piszkos tőle.
  ⚠️ **Csapda, amire készülni kellett:** a `rm --cached` commit merge-ölésekor a fő fából a
  FÁJL IS törlődik. Előre mentettem (`~/.claude/distill-manifest.backup`), a land után
  ellenőriztem — tényleg törölte —, és visszaállítottam. Enélkül a desztilláló legközelebb
  mind a 207 bejegyzést újra feldolgozta volna (fölösleges AI-költség).
- **A NÉMASÁG megszüntetve** (`src/console/treeFreshness.ts`): a dashboard LEGELSŐ chipje
  kimondja, hány committal marad el a tesztfelület ÉS melyik fájl blokkolja. Minden más szám
  azon a lapon egy olyan rendszert ír le, amit az operátor talán nem is néz — ezért áll elöl.
- **Negatívan is mérve** (szintetikus lemaradt worktree-n, hogy a riasztás bizonyítottan
  tudjon tüzelni): lemaradt+piszkos → felkiabál és nevesíti a fájlt ✅ · naprakész → csendben ✅
  · nem létező fa → nem talál ki semmit ✅.
  ⛔ Építés közben elkapva: a helper `trim()`-je levágta a `git status` vezető szóközét, és a
  fájlnév „EMORY.md"-ként jött ki. **Nem létező fájlt nevező figyelmeztetés rosszabb, mint a
  hallgatás** → alak-alapú parsolás (`trimEnd()` + `/^..\s(.+)$/`).
- Igazolva: a sync azóta **exit 0**, a napló tiszta, a fő fa naprakész.

**A nap egyetlen mondata:** minden mai hiba ugyanaz volt — *egy rendszer TUDTA a választ, és
nem mondta meg senkinek*. A beragadt őr, a láthatatlan háttérmunka, az üres API-egyenleg, a
halott chipek, a hamis „nem említi" lista és a némán elavuló tesztfelület mind ezt az egy
mintát ismételték.
