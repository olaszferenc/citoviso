# 2026-09-14 — Egy vásárlási úton egy fordulónap, és a vevő dátuma magyarul

**Kiváltó:** tulaj-bejelentés az Elek 2026-09-13-i futásaiból (FK-005a H-1, FK-001 H1,
FK-006a HIBA-2). **Döntés:** ADR-0144. **Kapu:** `scripts/renewal-date-coherence-check.mts`.

## Az elhatárolás, amit kértek — mérve

| Lelet | Verdikt | Bizonyíték |
|---|---|---|
| ① 3 nap eltérés (09-13 vs 09-10) | **VALÓDI kód-hiba** | a két képernyő MÁS forrásból felel; a 3 nap maga park-adat |
| ② `2035-09-10` ISO-alak | **VALÓDI** (az ALAK), a 2035 park-műtermék | a formázás hiánya kódhiba, az évszám az időutazóé |
| ③ `2034-09-10` a kiment levélben | **park-műtermék** (évszám), az ALAK ugyanaz a ① hiba | a park órája FK-006-tal évekre tolva |

⛔ **Az időutazót NEM futtattam** — nem volt rá szükség, és minden kör +1 évet tolna a közös
előfizetésen. A parkot nem is írtam: az őr **saját eldobható DB-t** hoz létre és ejt.

## A gyökér-ok (a lényeg)

Nem kerekítés — a fizetés előtti és utáni képernyő **más forrásból** felelt:

- **kliens:** `today + 12 hó`, abból a feltevésből, hogy a fizetés hozza létre a horgonyt;
- **szerver:** a tenant **meglévő** `current_period_end`-je.

Az `ensureSubscriptionForOrder` `onConflict doNothing`-gal szúr be → akinek **már fut ciklusa**,
megtartja az eredeti fordulónapját, és a vásárlás abba olvad (ADR-0080 ②). A kliens tippje
**csak a legelső vásárlásra** volt igaz — és pont az az egyetlen eset, amit valaha teszteltünk.
Mérve a parkban: `anchor_date=2026-09-10`, a futás 09-13 → innen a 3 nap.

## Amit a mérés a bejelentésen TÚL talált

A lelet EGY mondatot nevezett meg. A bérlői Előfizetés lapon **további 13 mondat** ült
ugyanabból az egy nyers `renewDate` változóból (számla-dátum, lemondás, hátralék, fagyasztás,
tervsáv), plusz a dunning-levelek és a T+7 SMS. **Az osztály szélesebb volt, mint a lelet.**

## Módosított / létrehozott fájlok

- `src/text/day.ts` — **ÚJ.** `formatDay` / `formatDayStem`. A negyedik `huDate`-másolatot váltja ki.
- `src/payment/subscription.ts` — `nextChargeDate()` + `nextChargeDateForLead()` (EGY definíció).
- `src/payment/service.ts` — a `renewalPreview` ebből olvas (nem saját `toISOString`).
- `src/generator/configurator.ts` — `renewalAnchor` a manifestben.
- `src/console/server.ts` — a `/p/:token` route feloldja a lead → tenant fordulónapot.
- `assets/runtime/cit-configurator.js` — a kliens nem számol dátumot, ha a szerver adja.
- `src/console/views.ts` · `src/server/adminViews.ts` · `src/email/billingEmail.ts` ·
  `src/booking/enquiry.ts` — magyar alak mindenhol.
- `scripts/renewal-date-coherence-check.mts` — **ÚJ** kapu, 33 állítás.
- `_planning/DECISIONS.md` — ADR-0144.

## Amit a saját munkámról meg kell jegyezni

- ⛔ **A hunk-szűrő regexem `huDay`-t keresett, `huDate`-et nem** → a staged `views.ts`-ben
  BENNMARADT a törlendő deklaráció. Nem a fordító fogta meg (a munkafa jó volt), hanem az,
  hogy a **leendő commit fáját** külön kicsomagoltam (`git write-tree` + `git archive`) és
  ott fordítottam. **Közös fában a munkafa zöldje nem bizonyít semmit a commitról.**
- ⛔ **Nem stasheltem** (`reference_shared_worktree_collision`): a fában 30 fájlnyi idegen
  munka volt, és a szál futás közben tovább nőtt (5 → 30 fájl, +3 idegen commit a saját ágon).
- A közös doksikat (katalógus, DECISIONS.md) **HEAD-ből újraépítve + a saját blokkommal**
  stage-eltem, a munkafa idegen tartalmát érintetlenül hagyva.

## Nyitott

- **A két képernyő ÖSSZEGE nincs mérve.** A kapu fixture-je nem ír entitlementet, ezért ott az
  összegek szerkezetileg térnek el — egyezést állítani hamis piros lenne. Külön kör tárgya:
  meglévő tenant upsell-vásárlásánál a visszaigazolás a tenant ÖSSZES megújuló modulját árazza,
  a fizetőoldal viszont csak a most választottakat. Ez ugyanaz az osztály, mint a dátum volt.
- Az ADR-száma (0144) a landolás pillanatában ütközhet — a fában már ült egy nem-commitolt
  idegen ADR-0143.
