# Elek éles teszt (10-13) leleteinek javítása — V-1, T-1…T-7, O-1, O-3

**Dátum:** 2026-10-13 · **Fa:** `~/wt/citde19aa35` (SUB, koordinátor: deploy fő session) · **Brief:** `~/rc-briefs/elek-eles-leletek-javitas-20261013.md`
**Forrás:** `_planning/memory/2026-10-13_elek_eles_teszt_harom_szerep.md`

## Elvégezve (landolva)
| # | Mi | Commit | Őr |
|---|---|---|---|
| V-1 | Mobil 2. lépés összesítője az ár-dobozt követi (az ellátás-választó nem szinkronizált), tételesen | cd136712 (main 4deceb0a) | meals-check ⑤ + önteszt |
| T-3 | Gyermekként megadott vendég IFA-mentes; egy mondat (a 13–17 évesekre is) — szelvény, sáv, nyugta, levelek, próba | b4d61026, ADR-0384 | meals-check ⑥, booking-tax-receipt-check, booking-setup-check |
| T-2 | Szelvény-felirat „(N éves korig)” | b4d61026 | meals-check ⑥ |
| T-6 | Gyerekár a szelvény ellátás-választója alatt (az oldal szavaival; a lezárt `<select>` levágta volna) | b4d61026 | meals-check ⑥ |
| T-7 | Levelek szöveges része: „N fő, ebből K gyermek” (`headcount`) | b4d61026 | booking-tax-receipt-check |
| T-4 | „Kipróbálás” = „Még nem próbálta ki” próba előtt; próba-foglalás Ellátás + Ebből gyermek | b4d61026 | booking-setup-check |
| T-1 | Segítő: mentett ellátás a tények közt (`helperMealsFact`); menüfeliratok a kódból | b4d61026 | booking-setup-check ⑥ |
| T-5 | Szoba-sor (egy szobánál a Szobák lapon) `back=rooms` | b4d61026 | booking-setup-check ⑤b |
| O-1 | `alreadyCustomerBlocks` az e-mail és a mobil úton; munkasáv „nem kell — már ügyfél” | b4d61026 | outreach-customer-gate-check (új) |
| O-3 | Pár-kártya mondata: hétköznap 9–16, kísérő SMS 8–20 (konstansokból) — a régi „8–20” csak a kísérő SMS-re volt igaz | b4d61026 | — (konstansból képzett szöveg) |

## Kihagyva
- **L-1** (asztalon a pirula-pár a foglalási kártya címén): nem csak a fény, maga a pár ül a card-sidebar kártya címén. A pár akadály-listája ma csak gombot, képváltó-jelzőt és a hős `h1`+bevezetőt ismer; az általános javítás (minden címsor akadály) minden sablonon görgetés közben mozgatná a párt. Javaslat: a nyugalmi helyzetben az első képernyőn látszó oldalsáv-kártya címét venni akadálynak (`heroTitleRects` bővítése) — mock-trial-overlay-check-kel mérve.

## Nyitott
- Élesre semmi nem ment. Deploy után a tenant-oldalakat újra kell renderelni (a runtime a pillanatképbe van ágyazva).
- A land egyszer a help-collapse-check terhelés alatti „element not stable” hibáján bukott (önállóan 3/3 zöld) — nem a diff okozta.
