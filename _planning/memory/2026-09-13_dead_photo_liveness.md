# 2026-09-13 — A halott fotó nem fotó (és a park fotói elrohadnak)

**ADR:** ADR-0136 · **Kiváltó:** tulajdonosi kérés („a lead mockjának nyitóképét is javítsd")
**Ág:** `wt/mms404` · **Előzmény:** ADR-0131 (MMS-előnézet), ADR-0134 (kiküldés-kapu)

## A premissza mérve IGAZ volt — és tágabb, mint a kérés

Az ELEK-TESZT lead 13 tárolt fotó-URL-jéből **11 halott** (404). A két élő: a balaton.hu két
**idegen reklámbannere** — amit a hero-doktrína amúgy is kizár. Tehát „válasszunk másik képet"
nem lett volna megoldás: nem volt miből.

**Nem a mi kérésünk hibája** (ezt külön megmértem, mert a saját kimaradásunkat leletként
jelenteni visszatérő hibaosztály): böngésző-UA-val és Refererrel is 404. A portál viszont ÉL, és
a kép **új néven** ott van (`…/main/balatonboglar-3.jpg` → 200, 21 kB) — a fájlneveket írták át.

**Rendszerszintű:** 40 leades véletlen minta → 27 mért nyitóképből **6 halott (22%)**. A
párhuzamos szál ugyanezt teljesebben mérte (73 hovamenjek-URL: 59 halott, 11 lead).

## Amit szállítottam

1. **A generálás kiszűri a véglegesen halott fotókat** — a fotó-halmaz eldőlésének EGYETLEN
   pontján, a FIZETŐS vision-pontozás ELŐTT (nem fizetünk nem létező kép osztályozásáért).
   ⚠️ Csak a VÉGLEGES hiba ejt: 429/hálózat miatt fotót dobni fordítva ugyanakkora kár.
2. **Park-frissítő út** (`seed-elek-lead.mts --refresh-photos`): a fixture-ön a friss begyűjtés
   NEM működik, mert a lead át van nevezve → az entitás-egyezés 0.44-en elbukik. **Ezt a kaput
   nem lazítottam** (pont az a dolga, hogy idegen adatlapot ne ragasszon a leadhez): a frissítés
   azon az úton megy, amin a fixture SZÜLETETT — a klón-forrás valódi leadjét olvassuk újra.
3. **Őr** (`photo-liveness-check`) + szerkezeti tiltás, hogy termék-kód ne kapcsolhassa ki.

## Amit menet közben tanultam

- ⛔ **A saját változtatásom eltört egy meglévő őrt, és az őr fejléce mondta ki, miért:** a
  `portal-photo-check` „offline és determinisztikus, mert minden commitnál fut" — a kitalált
  `cdn.booked.hu` URL-jei valóban 404-esek, tehát a szűrőm mindet eldobta (4 eset piros).
  A helyes válasz nem a szabály gyengítése volt, hanem **kimondott varrat a fixture-nek** +
  szerkezeti tiltás, hogy a varrat ne váljon csendes kiskapuvá.
- ⛔ **A komment nem kód:** a tiltás első változata a SAJÁT magyarázó mondatomra illeszkedett,
  és a definíció fájlját jelentette sértőnek. A detektor előbb kikommentez, aztán mér — és a
  piros ikre MINDKÉT irányba mér (valódi kikapcsolás = sértés, puszta említés = nem).
- A `git`-tel mérve: az ADR-szám **kétszer** ütközött ma land közben (0130, majd 0135) — a
  párhuzamos szálak percenként landolnak. A szám a land pillanatában érvényes, nem íráskor.

## Mérés a javítás után

| | előtte | utána |
|---|---|---|
| fixture fotó-URL | 13 (2 élő, mindkettő reklám) | **10 (10 élő)** |
| nyitókép | halott hovamenjek-URL | **„exterior (88) — az épület szép kültéri nézete este megvilágítva"** |
| kép-egészség (ADR-0134) | broken | **ok, 0 törött** |
| MMS-előnézet | 404 → törött-kép ikon | **READY, 42 kB JPEG a valódi nyitóképpel** |

Generálás költsége: **$0,1365** (4 AI-hívás).

## Nyitott

- A mintában mért ~22% halott nyitókép a TÖBBI leadre is áll — szélesebb körű friss begyűjtés
  hozza vissza (az adatlapok élnek). Ez a döntés nem takarítja ki a meglévő adatot, csak azt
  garantálja, hogy MOSTANTÓL halott kép nem kerül lapra.
- A dev §C-kapu (ADR-0130) a teszt-entitás miatt FLAG-el, ezért a piszkozat-lapon a mobil-páros
  gomb eleve nem jelenik meg — ez a párhuzamos szál vállalt következménye, nem ezé.

## Módosított fájlok

`src/generator/photoLiveness.ts` (új) · `src/generator/generate.ts` ·
`src/outreach/mockPhotoHealth.ts` · `scripts/photo-liveness-check.mts` (új) ·
`scripts/portal-photo-check.mts` · `scripts/seed-elek-lead.mts` · `hooks/pre-commit` ·
`_planning/DECISIONS.md`

---

## ⚠️ HELYESBÍTÉS (ugyanaznap este) — a sweep megcáfolta a saját premisszámat

A tulaj kérte a sweepet. Megcsináltam, és **három dolgot tanultam, mind a saját káromon**:

1. **A számaim egy PORTÁL-KIMARADÁST mértek.** Ugyanaz a mérőeszköz, ugyanazon a bájtra azonos
   URL-halmazon (három pillanatképből igazolva): ~21:05-kor **72 halott (8%)**, 21:45-kor
   **21 halott (2%)**; a hovamenjek-mintán 59/73 → **2/73**. A „a portál letörölte a fotóit"
   tehát részben téves volt: részleges kimaradása volt. ⛔ A saját/idegen KIMARADÁS nem lelet a
   rekordról — és pont ezt írtam le ténynek, kétszer is (az ADR-be is).
   Ami IGAZ marad: az ELEK-TESZT URL-jei tényleg véglegesen halottak (átnevezés — a régi név ma
   is 404, az új 200), és a szabály is áll.
2. **A javításom rontott, mert nem mértem előbb EGY leaden.** A `--fix` feltétel nélkül ráírta a
   friss olvasatot: 0 élő fotót nyert vissza SEHOL, viszont a Mákszem 45 élő fotóját 0-ra, a
   Lavia 45-jét 19-re vitte. A park a 18:15-ös mentésből állt vissza, **bájtra igazoltan**
   (10 lead; park-szinten 595-ből csak a 2 szándékos javítás tér el).
   → A `--fix` innentől: pillanatkép → írás → újramérés → **ha nem lett TÖBB élő fotó,
   VISSZAÁLLÍTÁS**. A javítás szerkezetileg nem tud rontani.
3. **Egy pillanatnyi 404 nem bizonyíték.** A generátor-szűrő **gazdagép-kimaradás féket** kapott:
   ha egy host képeinek többsége bukik egyszerre (≥3 mért képnél), arról a hostról egyet sem
   ejtünk — a kész lapról a kiküldés-kapu dönt, hangosan. Csendben elszegényíteni a statikus
   lapot rosszabb, mint hangosan megállni.

**Mérés a helyreállítás után:** park 919 URL · **21 halott (2%)** · 4 lead (Lavia 18 · Harmónia 1
· Mákszem 1 · Villa Pátzay 1). A mentés visszaállítása `~/backups/citoviso-dev/snapshots/
20260913-181501` — sha256 ellenőrizve, `pg_restore -t lead` egy eldobható DB-be, onnan
lead-enként raw-visszaírás.

---

## A `--discover` kör eredménye (tulaj-kérésre, 2026-09-13 23:50)

Célzott futás a 4 megmaradt leadre (`--only`), ELŐTTE önellenőrzött mentés
(`snapshots/20260913-234414`, sha256 OK).

| lead | előtte | a keresés után | mi történt |
|---|---|---|---|
| **Lavia panzió** | 45/63 él (18 halott) | **46/46 él** | JAVULT — a keresés 3 adatlapot hozott, a 18 halott URL kiesett |
| Harmónia üdülőház | 7/8 | 7/7 → **visszaállítva** | nem javult |
| Mákszem Nyaraló | 45/46 | **0** → **visszaállítva** | ⛔ a friss olvasat MIND a 45 élő fotót eldobta volna (idegen domain) |
| Villa Pátzay | 9/10 | 9/9 → **visszaállítva** | nem javult |

**A visszagörgetés ÉLESBEN bizonyított:** a Mákszem 45 élő fotója másodszor is elveszett volna
— a fék visszaállította. A park a 23:44-es mentéshez képest **egyetlen leadben tér el**
(Lavia), név szerint igazolva.

**Park-szintű zárómérés: 21 halott URL → 3** (Harmónia 1 · Mákszem 1 · Villa Pátzay 1). Ezek
valódi, egyenkénti rothadások: az adatlap már nem hivatkozik rájuk, a keresés sem hozta vissza.
A generátor-szűrő ejti őket (egyetlen halott egy hoston = a kimaradás-küszöb alatt), tehát
lapra nem kerülnek.
