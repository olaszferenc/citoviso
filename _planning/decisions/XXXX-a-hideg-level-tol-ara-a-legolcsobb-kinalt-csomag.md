## ADR-XXXX — A hideg levél „-tól” ára a legolcsóbb KÍNÁLT csomag ára, a kiküldés pillanatában; a domain-javaslat nem ígér „megrendeléskor” névválasztást

**Dátum:** 2026-10-12 · **Kontextus:** Elek 10-11 (A3) + tulaj-döntés 2026-10-12 („legyen dinamikus”), SUB az Elek-teszt koordinátor alatt. **Visszaolvasva:** ADR-0360 ① (a csomagok összetétele adat), ADR-0366 ① (a kiírt = a terhelt, nincs csendes visszaesés), ADR-0192 (nem eladó modul a ráépülőt is viszi), ADR-0101 (ár-doboz + ár-mondat egy forrásból).

### Kiváltó (mérve)
- A levél „3 900 Ft/hó → 2 925 Ft/hó-tól −25%”-ot írt (a puszta alapdíj, `getBaseMonthly()`), a rendelő-panel legolcsóbb csomagja (Alap) 4 880 → 3 660 Ft volt. A lead a levél árát a csomagok között nem találta — egy hirdetett „-tól” árnak elérhetőnek kell lennie (Fttv.).
- A konfigurátor domain-listája „Most nem találtunk javaslatot — a megrendeléskor beállíthatja.” és „Más nevet is választhat a megrendeléskor.” mondatot írt, de a rendelés UTÁN nincs névválasztás: a név itt, a lenti saját-név mezőben dől el.

### Döntés
**① A „-tól” ár forrása a konfigurátor csomag-kártyája.** `src/packageOffer.ts` az EGY számítás: a jelenlegi csomagok (`currentPresets`), a leadnek kínált modulokkal (nem tenant-only, nem kivezetett, eladható — ADR-0192 lezárással), alapdíj + a modulok havi ára. A konfigurátor ebből adja a csomagokat, a levél (`buildDraftForProspect`) a legolcsóbbat, minden levélnél frissen (`loadPricing` + modul-eladhatóság). A döntés-segítő emlékeztető ugyanezt az árat viszi. Az SMS/MMS-szövegben ár nincs.
**② Érvényes csomag nélkül nincs szám.** Ha nincs pozitív árú csomag, a levél az `NO_PACKAGE_PRICE` jelölőt viszi, a §C-kapu `ÁR-HIRDETÉS: nincs érvényes kínált csomag` okkal FLAG-el — régi szám soha.
**③ Felirat (tulaj szövege):** „Most nem találtunk javaslatot. Írjon be egy nevet a lenti mezőbe.” és „…ellenőriztük, most. Más nevet is választhat: írja be a lenti mezőbe.” — a mező mobilon és asztalon is a mondat ALATT van (mérve).

### Őr
`scripts/outreach-from-price-check.mts` (bekötve): a levél listaára és „-tól” ára = a konfigurátor manifestjéből a kliens képletével számolt legolcsóbb kártya, a mostani és négy módosított /pricing-állapotban (alapdíj, modulár, összetétel, nem eladó modul), a szöveges levélben és a HTML ár-dobozban; érvényes csomag nélkül a §C-kapu megállít. A régi kódon 14 hibával PIROS, az újon 0.

### Visszafordíthatóság
🔄 könnyű — kód-szintű, adat nem változott; élesre a nagy deployjal.
