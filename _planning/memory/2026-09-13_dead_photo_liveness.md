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
