# 2026-08-20 — Geo-horgony (ADR-0043) + lead-adatkártya újraépítés

## Kiváltó (tulaj)

> „Lefut scrape-kor a Brave keresés? Az hogy fordulhat elő, hogy beírom a két alap lead adatot
> a keresőbe — itt pl. Tekergő balatonberény — és azonnal találok honlapot, míg a leadnél
> faszság van. […] Forrásnak az OSM van feltüntetve? És a többi? […] miért nem lehet megnyitni
> a forrásokat? […] Lead részletnél nincs ország és város feltüntetve […] adatok mentése gomb
> alatt vicc ahogy kinéz.”

## A lelet — egy gyökér, két ellentétes tünet

A Brave **élesben futott** (`backend: brave`), nem az volt a baj. A sugaras régió sok települést
fog át, ezért a **régió-címke rossz geo-horgony** egy konkrét leadhez:

| tünet | eset | mi történt |
|---|---|---|
| fals NEGATÍV | Tekergő (Balatonberény) | a valódi honlap sosem írja le, hogy „Keszthely" → `verify()` ELDOBTA → „nincs honlapja" (§F hitelesség-bug) |
| fals POZITÍV | keszthelyi backfill | 6-ból 4 találat keszthelyi cég oldala volt révfülöpi / badacsonytomaji / balatonboglári leadeken → **visszavonva** |

A két hibát két külön session találta ugyanaznap, egymástól függetlenül.

**Mért bizonyíték a lekérdezés-alakra (Brave, élő):**

| lekérdezés | 1. találat |
|---|---|
| `Tekergő Balatonberény hivatalos oldal` | ✅ tekergobalaton.hu |
| `Tekergő Balatonberény szállás hivatalos oldal` | ❌ szallas.hu (3 portál előzi) |
| `Tekergő keszthely és környéke szállás hivatalos oldal` | ❌ csak portálok, a lead eltűnik |

**Harmadik lelet — a forrás rothad:** az OSM `website` tagje `…/Satorozas`-t tárolt (404), a gyökér
viszont 200-zal él. Ettől a lead `has_own` lett → a webes keresés RÁ SEM NÉZETT (csak
`none`/`portal_only` leadeket célzott) → a konzol döglött URL-t mutatott.

## Amit csináltunk (ADR-0043)

1. **Geo-horgony = a lead `city`-je, és HELYETTESÍTI a régió-tokeneket** (`enrichPresence.geoTerms`).
   Az unió mind a 4 fals pozitívot átengedte volna → külön assert tiltja. A cím szabad szövege
   szándékosan NEM horgony: a `hungary` token 40/56 leadnél szerepel — kikapcsolná az ellenőrzést.
2. **Lekérdezés:** `<név> <város> hivatalos oldal`, a kereső-mag `findOwnSite()`-ba emelve
   (felfedezés és javító-ág ugyanazt használja). Ugyanez a kontakt-keresésben.
3. **Törött-link javítás** (`enrichOutdated`): a döglött oldal nem ítélet, hanem kérdés —
   (a) domain-gyökér (ingyenes), (b) webes keresés; **mindkettő geo-igazolva** adopció előtt
   (lejárt+újraregisztrált domain különben pusztán azért lenne „a lead sajátja", mert válaszol).
4. **Őszinte, nyitható források:** a per-lead Places-lookup bejelöli magát (eddig „Források: osm"
   látszott, miközben minden fotó a Places-től jött), a `sourceId` túléli a dedupe-ot (`sourceRefs`)
   → egy kattintással megnyitható; régi leadnél a koordináta a tartalék.
5. **Per-lead újragyűjtés** (`POST /lead/:id/reenrich` + gomb): eddig a dúsítás CSAK scrape-kor futott,
   a CLI-backfill meg csak `no_site` leadre. Átvéve a **lifecycle-őr**: kiment megkeresés után néma
   újraminősítés tilos.
6. **Lead-kártya:** fejlécben ország/város + kattintható honlap; az űrlap 3-oszlopos ritmusban
   (név/telefon/e-mail, ország/város/cím), honlap teljes sorban megnyitó ikonnal; a mentés alatti
   `dl` helyett valódi több-oszlopos fact-grid (a régi 130px-es label-oszlop üresen hagyta a kártya
   jobb felét). Ország/város mostantól **szerkeszthető** — és mivel a város a verify horgonya, a
   kurátori javítás azonnal jobb újragyűjtést eredményez.

## Regressziós kapu — a lényegi tanulság

A hibát **egyik pipeline-őr sem kapta el**: a márka+régió `verify()`, a portál-katalógus, a
sekély-útvonal-szabály és a korroboráció **mind ZÖLD volt egy rossz eredményen**. Csak az utólagos
emberi mintavétel fogta meg. Ezért `scripts/geo-verify-check.mts`: a 4 visszavont fals pozitív +
a Tekergő fals negatív + egy helyes találat + a város nélküli fallback fixture-ként, plusz külön
assert az unió-visszaesésre. Offline, kulcs és hálózat nélkül fut. **7/7 PASS.**

## Élesben bizonyítva (lokális DB)

- **Tekergő:** `…/Satorozas` (404) → `https://tekergobalaton.hu/` — élő, mobilbarát, 8 kép → **nem lead**
- **Borbaratok Panzio:** `http://www.borbaratok.hu/` (elérhetetlen) → `https://borbaratok.hu/`,
  e-mail megtalálva, kép 11 → 43, minősítés `outdated` → `modern` (4,6 s)

## Módosított fájlok

`src/scraper/`: `enrichPresence.ts`, `enrichSiteSearch.ts`, `enrichOutdated.ts`, `enrichWebSearch.ts`,
`enrichPlaces.ts`, `dedupe.ts`, `types.ts`, `sources/googleMaps.ts`, `run.ts`, `reenrich.ts`,
**`reenrichOne.ts`** (új)
`src/console/`: `views.ts`, `server.ts`, `data.ts` · `public/assets/ui/citui-console.css`
**`scripts/geo-verify-check.mts`** (új) · `_planning/DECISIONS.md` (ADR-0043)

Kapuk: `tsc` ✅ · design-token-lint ✅ · i18n-lint ✅ · geo-regresszió 7/7 ✅ ·
vizuál 1440px + 390px ✅ · **éles DB-re semmi nem ment ki**

## ⚠️ Munkamód-lelet — párhuzamos sessionök egy fában

~11 RC-session futott EGYSZERRE ugyanebben a munkafában. Valós kár:
- két session egy percen belül írta az `enrichSiteSearch.ts`-t → félig-összeolvadt, nem forduló fájl;
- egy másik session **kevert commitot** csinált (`44a6d82`), amiből **kimaradt a reenrich route**,
  miközben az azt hívó GOMB bekerült → a `main` egy ideig 404-re futó gombot tartalmazott.

Szabály innentől: írás előtt `git status --short` + mtime; **soha `git add .`**; commit után
ellenőrizni, hogy hívó és hívott együtt ment-e be. Részletek: globális memória
`feedback_parallel_sessions_same_tree.md`.

## Nyitott / következő

- **Commitolandó maradék** (a `44a6d82` után): `_planning/DECISIONS.md` (ADR-0043),
  `src/console/server.ts` (a **reenrich route** — enélkül a gomb 404), `src/console/views.ts`
  (flash-banner), `public/assets/ui/citui-console.css`, `src/scraper/reenrichOne.ts` (cast-fix).
- **A másik session erre vár:** tiszta keszthelyi backfill dry-run a javított kóddal → kötelező
  város-ellenőrzés a találatokon → csak utána `--apply`.
- A lokális Borbaratok rekord megváltozott (valós javítás); eredeti mentve:
  `/tmp/lead-backup-8714c506-666d-4548-91c7-c1218378dd78.json`.
- A lokális konzol (:4600) újraindítva — 22 órája a régi kóddal futott.
