# 2026-09-13 — Törött képes mock: a rendszer TUDTA, és mégis engedte kiküldeni (ADR-0134)

**Bejelentés:** tulaj, az Elek FK-003b L01 leletéből. „Törött képekkel is jóváhagyható és
kiküldhető egy mock — pedig a lap maga kiírja, hogy a leadnek is törötten menne ki."

## A mérés ELŐSZÖR (a kért javítás előtt)

**Miért nem érhető el a 4 kép?** `curl`-lel, a scraper saját bot-UA-jával ÉS böngésző-UA +
referer-rel is: mind a négy **404**, `text/html` hibalappal. Tehát **nem** hotlink-védelem,
**nem** lejárt aláírás, **nem** kvóta — a forrás letörölte.

**Meddig terjed?** Nem a teszt-park sajátja:
- `hovamenjek.hu` — a fájlokat ÁTNEVEZTÉK, ezért a TÁROLT URL rohad el.
  ⛔⛔ **AZ ELSŐ LELETEM HAMIS VOLT**, és ugyanazt a hibát követtem el, amit a ház már
  leírt: 8 URL-es mintából („8/8 404, öt leaden") arra következtettem, hogy **megszűnt
  a séma** — és ezt beleírtam az ADR-be, a commitba, és el is mondtam a tulajnak.
  A TELJES mérés (mind a **73** tárolt hovamenjek-URL) megcáfolta: **59 halott / 14 élő**,
  11 leadet érint, ebből 8-nál MIND — de a Villa Pátzay 9 URL-jéből csak 1 halott.
  A minta a leadek között CSOMÓSODOTT, nem szórt. **Az ADATLAPOK ÉLNEK** (mindhárom
  mintavett lead lapja 200), és friss begyűjtéssel a fotók visszajönnek.
- `i.szalas.hu` — a lead szálláshelyének (hotel 459385) mind az 5 képe 404, egy MÁSIK
  szállodáé (1429702) 200. Vagyis **per-szálláshely** eltűnés, nem host-szintű.
- 904 különböző fotó-URL-ből gazdagépenként mintát véve a többi rendben (booked.hu,
  lake-balaton.com, oastatic, bstatic, apartman.hu, muscache: 200).
- Ezen a leaden a 13 begyűjtött fotóból **11 halott**; a két élő `balaton.hu`
  **reklámbanner** (`AP_300_250`, `MIR_640_360`), amit az ADR-0116 eleve kizár →
  **ténylegesen nulla használható fotó**, nem „rossz sorrend".

⚠️ **Az ok múlandó, a kapu hiánya nem.** Ezt külön kimondtam a tulajnak.

## Amit a KÓDBAN találtam — a mérés megvolt, a következtetés hiányzott

- `src/outreach/heroShot.ts` **Playwrighttal megméri** a kiküldött levél nyitóképét: ha az
  első képernyő bármely képe törött, `null`-t ad. A `sendBatch` ezt „akkor kép nélkül megy a
  levél"-ként **elnyelte** — a link mögötti lap ettől függetlenül kiment, 10+ üres kép-hellyel.
- A konzol `photo-health` végpontjának MONDATA a **kiszállított lapról** állított valamit
  („a LEADNEK kiküldött lapon is törötten jelennek meg"), miközben az
  `inputs.siteData.photos` **bemeneti** listát mérte. A ház visszatérő hibamintája.
- A `curateArtifact` és a `POST /lead/:id/prospect` **semmilyen** kép-feltételt nem ismert.

## Szállítva

- **`src/outreach/mockPhotoHealth.ts`** — a mérce a **lemezen lévő, renderelt**
  `mock_artifact.path`. Kép-kivonat (`img[src|srcset]`, `source`, `background-image:url()`,
  `link[rel=preload][as=image]`, `og:image`/`twitter:image`), majd mérés a konzol kép-proxyja
  `fetchPhoto`-jával — **ugyanaz a lekérő és cache**, amit a kurátor csempéje mutat.
  Gazdagépenként sorosít + egy udvarias újrapróba a múlandó hibára (a 404-re nem): **a téves
  piros a fizetni akaró vevő megkeresését állítaná meg.**
- **`photoGateBlocks`** — EGY predikátum mind a négy kapun (jóváhagyás · követett link ·
  levél · SMS). Az `unknown` (nincs renderelt fájl) nem tudomásul vehető.
- **Megtagadás-képernyő** a kurátornak: melyik kép, miért (valódi státusz + gazdagép),
  hányszor szerepel a lapon, mi a következménye — és a két valódi kiút. A tudomásulvétel
  **NÉVSORRA** szól (`inputs.brokenPhotoAck`).
- **A képernyő a KATTINTÁS ELŐTT is kimondja** (a Jóváhagyás gomb mellett, ugyanabból a
  végpontból). Kényelem; a garancia a szerver-oldali kapu, ami JS nélkül is áll.

## Amit menet közben SAJÁT MAGAMON találtam

⛔ A megtagadás után a szerver a `#a-<artifactId>` horgonyra térített vissza — és a lead-lap
fül-szkriptjének `ALIAS` táblája **csak három nevet ismert**, így a `show()` hamisat adott és a
**fül nem váltott**: a megtagadás képernyője egy REJTETT fülön ült volna. A Playwright
`scrollIntoViewIfNeeded` időtúllépése buktatta le („element is not visible"), nem a kód
olvasása. A `fromHash` most a panelen belüli elemre is felold, és a **mért**
ragadós-sáv-magasság alá görget.

⛔ Egy magyarázó kommentben backtick-et használtam (`` `show` ``) egy **template literalon
belül** — az esbuild transform hasalt el rajta. A komment sem semleges egy JS-sztringben.

## Az őr — `scripts/mock-photo-gate-check.mts`

22 állítás, és **nem fixture-ön**:
1. a lapot a **TERMÉK** renderelője állítja elő (`src/generator/render.ts`),
2. a kép-listát **valódi Chromium** adja — az őr NEM az `extractImageRefs`-szel méri az
   `extractImageRefs`-et (lusta betöltés kikapcsolva + végiggörgetés, különben a galéria
   képei el sem indulnának),
3. a kaput **valódi HTTP-n, a valódi konzol-szerveren, valódi DB-soron** nyomjuk meg,
4. a 404-et **helyi kép-szerver** adja (determinisztikus, hálózat-független).

Méri a **negatív irányt is**: ép mock jóváhagyása akadálytalanul átmegy — egy
mindig-blokkoló kapu ugyanolyan hibás, mint egy mindig-átengedő.

A **küldés-út szerkezeti** mérést kap (a kapu meghívása + a hívás a tényleges küldés ELŐTT
van), mert a viselkedési próbához a teljes §C-lánc előfeltétel, és egy korábbi kapu elnyelné
a mérést → az őr a ROSSZ okból lenne zöld. **Ez a korlát ki van írva**, nem elhallgatva.

**Önteszt:** MEGGYÓGYÍTJA a renderelt lapot (a halott kép helyére élő kerül); az őrnek ettől
pirosra kell mennie — **11 bukás**. Zöld önteszt = az őr nem a valós kimenetből dolgozik.

**`--sweep`** a park TÉNYLEGES jóváhagyott artefaktumain: Dencs Apartmanház 6/0 ✅ ·
Rozé Fogadó 5/0 ✅ · **ELEK-TESZT Vendégház 4 kép / 4 törött ❌** (+1 kimaradt: nincs path).

## Párhuzamos-szál tanulság

A munkafában (`~/wt/cit2167c7de`) **két MÁSIK session** dolgozott egyszerre (§C
feladó-azonosítás + modul-árazás). A landolás ezért **friss worktree-ből** ment: a saját
hunkjaimat patch-be szűrtem (a `views.ts` négy idegen hunkját kiejtve), `origin/main`-re
alkalmaztam, és ott futtattam a kapukat. ⛔ `git stash` NEM volt (keverné a szálakat).

## Nyitott

- Az **ELEK-TESZT lead adata halott** (11/13 fotó 404): amíg nincs friss begyűjtés, a
  FK-003b köre a kapuba fut. Ez most már **helyes viselkedés**, de az FK-005a-nak
  előfeltétele egy jóváhagyott mock — a következő Elek-kör vagy friss adatot gyűjt, vagy a
  tudomásulvétel-ágon megy tovább.
- A `hovamenjek.hu` **séma-váltását** nem követtük le: 160 fotó-URL halott a DB-ben. Külön
  kérdés, hogy a scraper tud-e új URL-t találni ugyanazokhoz a szálláshelyekhez.

---

## UTÓSZÁL: „friss adatgyűjtés annak a leadnek" (tulaj-utasítás) — MÉRVE, ÉS NEM MŰKÖDIK

A tulaj a két kiút közül a **friss adatgyűjtést** választotta. Lefuttatva a termék saját
útján (`rescrapePhotos`): **`0/1 leadhez találtunk portál-adatlapot` · 0 új fotó.**

**Miért — a pontos ok (`enrichPortal --verbose`):**
```
– ELEK-TESZT Vendégház ✗ https://hovamenjek.hu/balatonboglar/erzsebet-vendeglo-fogado:
  gyenge entitás-egyezés (0.44: név-lefedettség 0.00, település egyezik,
  koordináta-távolság 65m (0.93), cím eltér) — eldobva
```
A lead **át van nevezve** a teszt-parkban („ELEK-TESZT Vendégház"), a valódi szállás
„Erzsébet Vendéglő". A név-lefedettség ezért **0.00** → 0.44 → az entitás-kapu eldobja.
⭐ **A termék HELYESEN viselkedik** (§B.17b / Piroska-eset: inkább NINCS fotó, mint téves
tulajdonítás) — a fixture a hibás, nem a kód.

**Ellenpróba a VALÓDI leaden** (`Erzsébet Vendéglő`, ugyanaz a szállás, eredeti névvel):
**`1/1` lead · 4 adatlap · 11 portál-fotó**, high sáv (balaton.hu 0.89, hovamenjek 0.74,
apartman.hu 1.00). Vagyis a begyűjtő lánc ép, és a hovamenjek-fotók **visszajönnek**.

**A saját javaslatomat is megmértem, MIELŐTT ajánlottam volna** — és megbukott:
`"Erzsébet Vendéglő (ELEK-TESZT)"` névvel az adatlapok már illeszkednek, de csak
**medium 0.59** → **0 fotó** (a medium sáv nem tulajdonít fotót, A4). Tehát a
„nevezzük át félig, hogy a jelölés megmaradjon" **nem megoldás**; csak a PONTOS valódi
név ad high sávot.

**Marad tulaj-döntésnek** (a teszt-park közös, több szál használja — 20 hivatkozás 9
Elek-forgatókönyvben és a charterben):
- (a) a teszt-lead a VALÓDI nevet kapja, a teszt-jelleget az `elek@citoviso.com` cím viszi
  (az `ElekRecipientGuard` amúgy is arra köt, nem a névre),
- (b) az FK-003b a valódi `Erzsébet Vendéglő` leadre mutat,
- (c) marad, és a kör a kép-kapuba fut — ami mostantól a HELYES viselkedés.
