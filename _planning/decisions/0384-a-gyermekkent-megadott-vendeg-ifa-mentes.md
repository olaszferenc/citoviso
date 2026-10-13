## ADR-0384 — A gyermekként megadott vendég IFA-mentes; próbázónak és ügyfélnek nincs hideg megkeresés

**Dátum:** 2026-10-13 · **Kontextus:** az Elek éles teszt (2026-10-13, három szerepben) leletei, `_planning/memory/2026-10-13_elek_eles_teszt_harom_szerep.md` — T-3 és O-1. **Kiterjeszti:** ADR-0378 (ellátás, gyerekár, gyerek-számláló), a V-3 IFA-sor (terv m1-elek-javitasok ④).

### Kiváltó
- **T-3:** a szelvény, a nyugta és a két vendég-levél az idegenforgalmi adót minden vendégre számolta: „400 Ft / fő / éj × 3 fő × 3 éj = 3 600 Ft”, pedig a 3 főből 1 gyermek volt. A Htv. 31. § a) szerint a 18. életévét be nem töltött magánszemély mentes: helyesen 2 400 Ft.
- **O-1:** a konzol a próbázó lead lapján „Kiküldve: még nem — ez a következő”-t, a piszkozat-lap „E-mail: most kiküldhető”-t mondott. A `src/outreach/` küldő-kapui a próbát és a bérlőt nem nézték, csak a próba-kampány.

### Döntés
1. **IFA-fizető fő = vendégek − a gyermekként megadott vendégek** (legalább 1). A gyerek-számláló az admin korhatára szerint („N éves korig”, legfeljebb 17) számol, tehát minden megadott gyermek 18 év alatti. Egy szabály, két példány: `taxPayers` a `src/tenant/meals.ts`-ben (szerver: levelek, próba-foglalás) és a `cit-runtime.js`-ben (szelvény, mobil sáv, nyugta).
2. **Egy mondat az IFA-sor alatt**, ami nem ígér többet, mint a szám: gyerek-számlálóval „…a gyermekként megadott vendégeket nem számoltuk bele, és a {N+1}–17 évesek után sem kell megfizetni.”; számláló nélkül „…a fenti összeg minden vendéggel számol.” A 12–17 évest a rendszer felnőttként számolja (nem kérdezzük) — ezért mondjuk ki, hogy rá sem jár.
3. **A gyerek-korhatár felirata mindenhol az admin szavával:** „(N éves korig)” — a szelvény „(N év alatt)” felirata ellentmondott az admin és az élő oldal szövegének (T-2).
4. **Hideg megkeresés tilos, ha a lead már ügyfél** (saját oldala van vagy fizetett — `ownedSiteForLead`) **vagy van próbája** (bármilyen állapotú `free_trial` sor). Szerver-oldalon, minden csatornán: `alreadyCustomerBlocks` (`src/outreach/customerGate.ts`) a `sendOutreachMail` és a `mobileOutreachGates` (SMS, MMS+SMS pár) elején. A lead-lap munkasávja ilyenkor a „Kiküldve” állomást „nem kell — már ügyfél”-nek írja, nem „ez a következő”-nek.

### Őr
- `scripts/meals-check.mts` ⑥ (szelvény, 390 px: korhatár-felirat, gyerekár a listában, IFA 2 fővel, a mondat), `scripts/booking-tax-receipt-check.mts` (mindkét vendég-levél: IFA a gyermek nélkül, mondat, „3 fő, ebből 1 gyermek”; tulaj-levél), `scripts/booking-setup-check.mts` (próba-foglalás ellátással, gyermek IFA nélkül).
- `scripts/outreach-customer-gate-check.mts` (új): próbával / bérlővel tilt az e-mail és a mobil út, a konzol nem állít „küldhető”-t, a munkasáv nem „ez a következő” — negatív kontrollal.

### Visszafordíthatóság
🔄 könnyű — számítás és kapu, séma nem változott. A már beérkezett kérések levelei a kérésen tárolt létszámból és gyerekszámból számolnak, így újraküldéskor is a helyes összeget írják. Élesre a következő deployjal; az élő tenant-oldalak a renderelt pillanatképből futnak, deploy után újra kell renderelni őket.
