# 2026-09-11 — A lead-lista felirat-igazsága (Elek FK-003)

Commit: `dfcaa83`. Élesítés NINCS (§0.3).

## A kiváltó

Elek FK-003 hat leletet hozott az operátor napi munkaeszközéről. Egyik sem
„törött funkció" volt — mind a hat abból a családból való, hogy **a felület mást
állít magáról, mint ami történik**, és ezért egyetlen meglévő kapu sem látta.

## Amit MÉRTEM, mielőtt javítottam

| szám | mit számolt | hol volt |
|---|---|---|
| 267 | `qualification ∈ (no_site, outdated)` — diszkvalifikáltakkal, anyag-feltétel nélkül | irányítópult „kvalifikált" chip |
| 595 | minden felmért lead | CRM-kártya „Lead-sor" |
| 593 | nem diszkvalifikált | szűrő nélküli lista |
| 260 | alapszűrő (no_site/outdated + `material ≥ 1`) | `/leads` fejléc |
| 2 | diszkvalifikált | a másik nézet |

Mind az öt szám **helyes volt**, csak egyik sem mondta meg, mit számol.
A 260 sorból **100-nál** a FOTÓK oszlop 0 (az első tíz sorból négynél) — pontosan
ahogy a tulaj látta.

## A hat javítás

① **A szűrő-állapot némán elveszett.** A vissza-link nyers `/leads` volt → a szerver
újra beinjektálta az alapszűrőt. Most az explicit lekérdezés (az `?all=1` szándék is)
átutazik a nézetváltáson **mindkét irányba**; az INJEKTÁLT alapszűrő NEM utazik —
átvinni kézi szűrésnek látszana a túloldalon, ahol amúgy sem alkalmazzuk.
Valódi adaton mérve: `/leads` → Szűrők törlése → diszkvalifikáltak ▸ → ◂ aktív
leadek = `?all=1`, „nincs szűrő", 593 találat.

② **⭐ A NAP LÉNYEGE — a felirat nem a mért oszlopra vonatkozott.** Az `1+` jelvény az
ANYAG oszlopon ült, a felirat „min. 1 kép"-et mondott. **A szűrés HELYES** (ADR-0097
óta szándékosan a teljes összegyűjtött anyagot méri, mert 13 portál-fotós lead is
`photos=0`-t mutat); a MONDAT volt hamis.

A javítás ezért **nem szövegcsere** lett: minden oszlop és minden szűrő egyetlen
regiszterbe került (`src/console/leadFilters.ts`), ahol a **predikátum ÉS az
összefoglaló mondat ugyanabból a `cell()`-ből származik**. Egy szűrő szerkezetileg
nem tud olyan oszlopot megnevezni, amit nem olvas. A `listLeads`, a `leadsPage`
fejléce, a rendezés és az őr mind ebből dolgozik.

③ **A diszkvalifikált nézet „Leadek (2)" + „nincs szűrő" volt** — a CÍM mondja ki
mostantól: „Aktív leadek" / „Diszkvalifikált leadek".

④ **Az öt szám megnevezve.** A chip ugyanabból a `defaultLeadQuery()`-ből számol,
mint amit a rákattintva kapott lista mutat (267 → 260). A fejléc mind az ötöt
kiírja a predikátumával. A „Lead-sor 595" tooltipje kimondja, mit számol és mit nyit.

⑤ **Lapozó + jelmagyarázat.** ⚠️ A bejelentett „10 sor jelenik meg 260-ból" MÉRVE
**nem csonkolás volt**: mind a 260 sor kirendelődött, csak a képernyőre fért tíz —
a hiány a „hol tartok" jelzés volt. 50 sor/lap + „x–y / N sor megjelenítve" + lapozó
+ „Mind a N egy lapon" (onnan a „Lapozva" visz vissza). A néma jelölések (SV, MATCH,
szín-kód, „–", „✓ kiküldve", „?") nyitható jelmagyarázatot kaptak a táblázat **ALATT**
— nem tooltipben, mert azt telefonon senki nem éri el.

⑥ **A RÉGIÓ oszlop négy alakot mutatott** (`balaton-north`/`Balaton`/`bs`/`_test`).
Most a `region` tábla emberi címkéje látszik; amihez nincs terület-rekord, az `?`
jelölést kap — a nyers azonosító nem megy át helynévnek.

## Az őr

`scripts/lead-filter-label-check.mts` (pre-commit, DB-mentes fixture, ~4s):
a **szállított mondatot** olvassa ki a renderelt lapról, feloldja, melyik oszlopot
nevezi meg, és megméri **annak az oszlopnak MINDEN celláját**. Plusz: minden szűrő
vezérlője a saját oszlopa `<th>`-jában ül; a kiírt számok a kirajzolt sorokat írják
le; a nézetváltás hrefjei viszik az állapotot (mindkét irány + a default NEM szivárog).

**Piros kontroll (`--self-test`):** pontosan a ma javított hibát állítja elő — a mondat
FOTÓK-at mond, a predikátum az ANYAG-on marad —, és az őr **30 sértő cellával** elkapja.
A fixture **bizonyítja a saját útját**: ha nem termel 0-fotós sort, az őr hangosan megáll,
mert akkor nem mérne semmit.

## ⚠️ Hatókör-tanulság — KÉTSZER ütött ugyanabban a commitban

A `leadFilters.ts` egy **ÚJ, feliratot hordozó fájl**. Fel kellett venni:
- a `kb-check` operátor-korpuszába (`scripts/kb-check.mts`) — különben a kézikönyv
  olyan oszlopnevet idézhetne, amit a konzol már nem renderel;
- az `i18n-sources` listájára (`scripts/i18n-sources.mjs`) — enélkül a pszeudo-nyelv
  őr **25 burkolatlan feliratot** mutatott: minden oszlopnév magyarul ment volna ki
  egy idegen nyelvű operátornak, pedig mind `T()`-ben volt.

Ez a `feedback_guard_scope_is_the_doctrine` harmadik előfordulása.

## ⚠️ A tudásbázis-őr KÉTSZER fogott valós rést a saját szállításomban

1. kör: a jelmagyarázat 5 tételt adott, a KB 7-et ígért; a Kontakt/Mock jelentés csak
   `<th title>`-ben élt (telefonon elérhetetlen); a screenshot 3 soros fixture-ről
   készült, tehát sem a számsort, sem a lapozót nem bizonyította.
2. kör (a javításom UTÁN, a saját új szövegemre): a rendezés **nem működik** a
   Régió/Ország/Város oszlopon, amit a KB-m állított; a telefonos görgetés-listám
   kihagyta a levágott Kvalifikáció oszlopot; a „minden oszlop szerepel a
   jelmagyarázatban" ígéret mellett a Név/Ország/Város tooltipben maradt; és három
   néma jelölés (szín-kód, Anyag „–", szűrő-kereső) definiálatlan volt.

Mind javítva: a jelmagyarázat MINDEN oszlopot visz, a KB a valós rendezhetőséget írja,
a kb-shot 64 soros fixture-t használ + két új elem-kép (`pager.png`, `legend.png`).

## Mérések

- `lead-filter-label-check` 36/36 · önteszt piros (1 bukás, 30 sértő cella)
- Elek FK-003: **10 gépi zöld / 0 piros / 0 blokkolt**, 4 kézi lépés, 0 JS-hiba, 0 HTTP-hiba
- valódi böngésző-kör valódi adaton: szűrő-megőrzés, lapozás, „mind egy lapon" — 0 JS-hiba
- pre-commit teljes kapu-sor zöld; `kb-check --coverage` 🟢 35/35
- ui-shot 390px + desktop, Read-del megnézve, a tulajnak elküldve

## Nyitva

- A Régió/Ország/Város oszlop **nem rendezhető** (a regiszterrel egy sor volna hozzáadni,
  de nem kérte senki — a KB most őszintén kimondja).
- A MATCH oszlop továbbra sem szűrhető (a tulaj ⑤-ben szóvá tette; magyarázatot kapott,
  szűrőt nem — az külön döntés).
- A `legend.png` elem-kép magas és keskeny (15 tétel), telefonon olvasható, de nem szép.
