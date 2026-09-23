## ADR-0208 — Ár nélkül nem foglalást ígérünk, hanem árajánlatot kérünk — és a szezon-szabály egy példányban (2026-09-22)

**Dátum:** 2026-09-22 · **Státusz:** elfogadva (megvalósítva, őrökkel) · **Kapcsolódó:**
ADR-0197 ① (itt mérték ki a részlegesen árazott szállást), ADR-0193 ① (az ár-jogosultsági
kapu; „a foglalás ELINDUL, csak SZÁM NÉLKÜL"), ADR-0193 ② (a kupon-szabály EGY példányban —
ennek a mintája), ADR-0199 ④ (az ár-lista EGY egységre érkezik), ADR-0044 §6 (a foglalás
KÉRÉS), ADR-0194 (a kifizetett-de-üres modul tulaj-oldali jelzése), §B.17 (jobb nincs szám,
mint rossz szám) · **Kontraktus:** `assets/design-refs/tenant-site/quote-request/`.

**Kiváltó.** Tulajdonosi utasítás az ADR-0197 ① javítására, majd a mérés közben tett
pontosítása: *„ha olyan dátumra kíván foglalni a látogató, ahol a tenant még nem kötött
megállapodást, akkor ne foglalás legyen írva, hanem árajánlatkérés."*

---

### ① A MÉRT TÉNYÁLLÁS — néma eltűnés, és a vendég mégis „foglal"

Valódi böngészőben, eldobható fixtúrán (2 egység, egyikre 28 000 Ft, másikra semmi), mindkét
méreten: ha a kiválasztott egységre — vagy a tartózkodás **bármelyik éjszakájára** — nem áll
össze ár, a `renderQuote` **némán kiürítette** az ár-dobozt (`if (!q) { el.innerHTML = ""; }`).
Asztalon **üres lyuk** maradt a dátum-sáv alatt, mobilon összecsukódott — a naptár, az űrlap és
a gomb viszont változatlanul működött. A vendég tehát dátumot választott, megadta a nevét, és
megnyomta a **„Foglalási kérés elküldése"** gombot úgy, hogy **soha nem látott árat**.

⭐ **Jó hír, amit szintén megmértünk, mert feltevés volt:** az előző egység összege **nem ragad
be** átváltáskor. Nem rossz szám megy ki, hanem **semmilyen** — a kár a néma hiány, nem a hamis
adat. Az ADR-0194 ezt hipotézisként hagyta nyitva („árat számolhat és fagyaszthat be"); a
végpont ága (`pricing: priceRows.length ? {…} : null`) cáfolja.

### ② A DÖNTÉS — a gomb, a magyarázat és az ígéret EGYÜTT vált

§2b kör: 3 működő változat (A: magyarázó doboz + átnevezett gomb · B: csak a gomb beszél ·
C: mint az A, plusz jelölés az egység-választóban), mindkét méret képével. **A tulaj a C-t
választotta.**

1. **A kiváltó a MEGLÉVŐ predikátum**, nem új heurisztika: a `quoteFor`/`quoteStayFrom` akkor
   ad `null`-t, ha a tartózkodás **egyetlen** éjszakájára sincs sor — a mód tehát
   **DÁTUM-szintű**, és egy részlegesen árazott időszakra is életbe lép.
2. **A doboz helyén magyarázat áll**, ami megmondja, miért nincs szám, és hogy az elküldés még
   nem kötelezettségvállalás.
3. **A gomb árajánlatot kér**, nem foglalást ígér.
4. ⛔ **A gomb alatti mondat is átíródik.** Ez nem részlet: ha a gomb árajánlatot mond, az
   alatta álló ígéret meg a foglalás véglegesedéséről és a helyszíni fizetésről beszél, a lap
   **két dolgot állít egy képernyőn**.
5. **A választó már a választáskor jelzi** („· egyedi ár"). ⛔ Ez **szerver-oldali**, mert a
   kliens nem tudná kiszámolni: az `/api/foglaltsag` **egyetlen** egységre válaszol (ADR-0199),
   tehát a választó felépítésekor a többiről semmit nem tudna. A szerver viszont render-időben
   kezében tartja a teljes `priceMap`-et — innen az új `unpriced` mező a booking-egységeken.
6. ⛔ **Az árazatlan egység NEM kerül ki a választóból.** A tenant kifizette az Online foglalás
   modult; egy meg nem adott ár nem veheti el a funkcióját (ADR-0193 ①). Az árajánlat-út
   megtartja a bejövő érdeklődést, és közben igazat mond.

⚠️ **Hatásterület, kimondva:** ahol **egyetlen** egységnek sincs ára, a foglaló felület
mostantól **végig** árajánlat-módban áll (dev park: 3 booking-os tenantból 2). Ez az ADR-0193
szellemével egyezik, de a gomb feliratát eddig nem érintette — ezért mondjuk ki külön.

### ③ A SZEZON-SZABÁLY EGY PÉLDÁNYBAN — az előfeltétel, amit előbb kellett megcsinálni

A „melyik ár-sor vonatkozik erre az éjszakára?" kérdés **két példányban** élt, és a kettőt
**semmi nem vetette össze**: `src/tenant/prices.ts` (ez a szám FAGY RÁ a kérésre és megy ki a
vendég levelében) és `assets/runtime/cit-runtime.js` (ezt OLVASSA a vendég beküldés előtt). A
hónap-nap feltevés (`slice(5,10)` és társai) **öt helyen** élt külön.

**Egy fájl:** `assets/runtime/cit-season.cjs` — a szerver `require`-olja, a generátor bájtra
ugyanezt inline-olja a lapba (a `cit-coupon.cjs` mintája). Miért nem elég a `cit-money.js`
paritás-mintája: egy eltérő **formázó** csúnya stringet ír, egy eltérő **ár-kiválasztó** mást
ígér, mint amit terhel.

⛔ **Ami szándékosan NEM lett egy példány:** a `booking-price-coherence-check` saját
`covers()`-e — *„an oracle that imports the code under test cannot disagree with it."*
Korábban tévesen azt jeleztem a tulajnak, hogy az is megszűnik.

⭐ **Ez az év-specifikus szezonár előfeltétele** (tulajdonosi döntés, 2026-09-22). Mérve: a
12 hónapos foglalási horizonton belül ma **ugyanaz a 96 000 Ft** fagy be 2027 júliusára, mint
2026-ra — az év sehol nem játszik szerepet. Amikor az év bekerül, **egy helyen** kerül be.

### ④ ⛔⛔ ÖT SAJÁT HIBA, ÉS EGYIKET SEM A GONDOLKODÁS FOGTA MEG

1. **A végponttól-végpontig mérésem HAMIS ZÖLDET adott.** Valódi DB + szerver + böngésző,
   mindkét méret, változatlan összegek — ebből „viselkedés-semleges refaktort" olvastam ki.
   Nem az volt: **három script nem a termék injektorán át** épít lapot, hanem kézzel fűzi
   össze a runtime-fájlokat, és az új fájl nélkül a `cit-runtime.js` egy **undefined
   `CitSeason`**-ön hal meg. A `booking-price-clarity-check` 7 állítása ment pirosra, és
   **egyik sem mondta, hogy a runtime szállt el** — csak hogy „a bontás nem látszik".
   ⭐ A mérésem azért volt vak, mert **csak azt az utat járta, amit én írtam.**
2. **KETTŐS KERET** — a `.cit-book__quote` konténer már visel 1,5 px-es akcent-keretet, és a
   dobozom egy másodikat tett bele. A **KÉP** mutatta meg; közben mind a 14 gépi állításom
   zölden állt.
3. **A `note` elem KÖZÖS** — a validációs hiba is oda íródik, és hiba nélkül az alap-mondat áll
   vissza. Az első változatom letörölte az élő hibaüzenetet, a hiba elmúltával pedig a
   **foglalási** ígéretet hozta vissza egy ár nélküli kérésre. Egy **idegen** őr
   (`shot-booking-form`) mérte ki.
4. **A ③-ra írt első ÁLLÍTÁSOM is hibás volt**: szintetikusan levettem a hiba-osztályt, de a
   visszaállítót sosem hívtam meg — a **saját mérésem** bukott, nem a kód.
5. **Egy hónapforduló-hiba egy idegen őrben** (`booking-screen-check`, 2026-09-08 óta lappang)
   blokkolta a landolást: a fixtúrája `ma+9`-re írt kézi blokkot, a naptárnak viszont nincs
   hónap-váltója. ⛔ És a **javításom szülte a következő hibát**: a blokkot a foglalt napok elé
   téve az első csíkos cella a kézi blokk lett, aminek nincs vendége — a sorrend számított.

### ⑤ AZ ŐRÖK

| Őr | Mit mér | Piros önteszt |
|---|---|---|
| `scripts/season-rule-check.mts` | bájt-azonosság · az inline SORRENDJE · szerver↔böngésző egyezés **mind a 372 naptári napon**, független referenciához mérve · a kézi lapépítők **párosítása** · nincs nyers hónap-nap vágás | a böngésző-oldal a wrap-öt nem ismerő történeti szabállyal → **17 eltérő nap** |
| `scripts/quote-request-check.mts` | 32 állítás eldobható fixtúrán, valódi DB + HTTP-szerver + böngésző, mindkét méreten | a **kirenderelt pillanatképben** cseréli vissza a néma kiürítést; ha a csere nem talál, **hangosan** bukik |

⭐ **Utó-feltételek, mert egy halott szabályt az összevont darabszám elfedne:** a szezon-őr
önteszte megköveteli, hogy **épp** a böngésző-paritás ág szólaljon meg, és hangosan kimondja,
mely ágakat nem ront vissza; a fixtúrája pedig külön állítással bizonyítja, hogy tartalmaz
**évhatáron átforduló** szezont — különben pont azt nem mérné, amiben a két példány eltérhet.

### ⑥ AMI NYITVA MARAD

1. **A tulaj értesítése**, amikor árajánlat-kérés érkezik árazatlan egységre — ez a szelet
   **tulaj-oldali fele**, még nincs meg. (Ez lépett az „élesítési teljesség-kapu" helyére:
   a bérlő **nem tud élesíteni**, az egyetlen élesítési pillanat a fizetés utáni automatikus
   `activate()`, és ott blokkolni a fizető vevőt tagadná meg.)
2. **A három állapot** (a „nincs ár" legyen kimondott döntés). ⚠️ Mérve: `setBasePrice()`
   `if (amount && amount > 0)` — a **0 nem tárolható**, tehát külön mező kell, nem egy 0.
3. **Új egység felvételekor** kérje az árat.
4. **Emlékeztető**, ha X napja hiányos az árazás.
5. **Év-specifikus szezonár + nudge** a szezon záró napja után — a ③ volt hozzá az alap.
6. **Az ADR-0197 ② javítása** (a polcról levett modul számlázása) — külön mandátum.
