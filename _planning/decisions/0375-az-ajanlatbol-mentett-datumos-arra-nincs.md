## ADR-0375 — Az ajánlatból mentett dátumos árra nincs lejárati levél; az Árazás lap ezt mondja ki, és a megmaradt emlékeztető-levél csak alapár nélkül állítja, hogy „a vendég nem lát árat”

**Dátum:** 2026-10-13 · **Státusz:** elfogadva (lokál; élesre a következő deployjal) ·
**Megerősíti:** ADR-0267 ③ (a „kért napokra” sor bélyeggel születik) · **Lezárja:** `_planning/DEPLOY-READY.md`
4b.1 és 4b.2 · **Őr:** `scripts/booking-maintenance-timetravel-check.mts` (4b.2-ágak, pozitív kontrollal)

### A mért tényállás

A tulaj 2026-09-30-án: „legyen lejárat előtti értesítő, mint ahogy ígérjük” — az Árazás lap korábban azt
írta a dátumos alapár alá: „Lejárat előtt e-mailben emlékeztetjük.” (2026-09-30-án kivettük, mert hamis volt.)

- Dátumos alapárat MA csak az árajánlat-út ír (`addDatedBasePrice(…, { remind: false })`, ADR-0267 „Csak a kért
  napokra”); az Árazás lapról nem lehet ilyet felvenni. Az ablak PONTOSAN a kért tartózkodás árazatlan éjszakái.
- Az ablak a tartózkodás utolsó éjszakájával ér véget → a lejárata után **egyetlen jövőbeli éjszaka sem marad
  ár nélkül** emiatt. A 14 napos „hamarosan lejár egy ár … utána a vendég nem lát árat” levél tehát hamis és
  tennivaló nélküli lenne.
- Mérve 2026-10-13: dátumos alapár élesen 0, dev DB-ben 0.

### Döntés (tulaj, 2026-10-13, a koordinátoron át: „IGEN”)

1. **Az ajánlatból mentett dátumos árra NEM megy lejárati levél** (ADR-0267 ③ marad). Az ígéretet nem a levél
   teljesíti, hanem az igaz mondat.
2. **Az Árazás lap** a dátumos sorok alatt: „A dátumos alapár az árajánlatból került ide: csak a kért éjszakákra
   szól, ahol nincs időszaki ár, és a tartózkodás után magától lekerül.” A súgó (`admin-modules-pricing`) új
   szakasza ugyanezt mondja, és összeköti a szezon-árak „lejárat előtti” levelével (szezon végi levél, `seasonNudge`).
3. **4b.2 — a megmaradt emlékeztető ág igaz mondata.** A `maintainDatedPrices` levele a bélyeg nélküli
   (ADR-0267 előtti) dátumos sorokra továbbra is elmegy; a mondata mostantól a szoba IDŐTLEN alapárától függ:
   van → „Utána … ismét az alapár érvényes: {base}/éj.”; nincs → „… a vendég nem lát árat, és árajánlatot kér.”
4. Ha egyszer a tulaj maga adhat meg lejárattal árat (pl. „március végéig”), annál az emlékeztető értelmes:
   bélyeg nélkül kell írni a sort, és a 3. pont szerinti levél megy — a kód erre kész.

### Őr

Az időutazó őr egy negyedik dátumos sort kapott alapár NÉLKÜLI szobán. Állítja: alapár mellett a levél nem
mondja, hogy „nem lát árat”, hanem az alapárat nevezi összeggel; alapár nélkül (pozitív kontroll) igen. A régi
kódon a két 4b.2-állítás bukik (mérve).

### Tanulság

Egy „legyen, ahogy ígérjük” kérésnél előbb azt kell megnézni, van-e az ígéretnek tárgya. Itt nem volt: a mondat
egy olyan lejáratra ígért figyelmeztetést, ami után semmi nem változik.
