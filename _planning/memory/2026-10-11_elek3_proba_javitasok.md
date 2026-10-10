# 2026-10-11 — Elek 3. kör javításai: próba „C” + névváltás, élesítés előtt

**Szál:** SUB a próba-koordinátor alatt (brief `~/rc-briefs/proba-javitasok-elek3-20261010.md`), fa `~/wt/cit00751066`.
**Forrás:** Elek 3. köri jelentése (a koordinátor fájában, `_from-sub/6029504c/_elek/JELENTES.md`). Nem élesítve.

## Elvégezve
- **B1 (BLOKKOLÓ)** — a választott ingyenes aldomain elveszett: `server.ts` a `domain_name`-et csak saját domainnél rögzítette. Javítva; az aktiválás a választott címre nevez át, a régi alias + 301. Őr: `free-trial-e2e` (bekötve a pre-commitbe) a fizetés UTÁNI slugot, aliast és 301-et méri. A régi őr (proba-c ④) csak a POST-törzset nézte.
- **B2 (BLOKKOLÓ)** — a próba-levélből (`forras=proba`) jövő látogatás nem bocsát ki eszkalációt; a próba az űrlapon kiírt %-ot rögzíti (`offerPercent` → `pinTrialOffer`), kliens-szám nem áraz. ADR-XXXX ①. Őr: `free-trial-e2e` ⑩, `proba-c-checkout-check` ⑥.
- **K1** — a `trial_grant` modul nem számlázott tétel (`isBilledModule`); az üres-modul teendő továbbra is látja.
- **K2** — Pénztárca: `nextChargeTotal` (évesnél az éves összeg).
- **K3** — a T−3 és a T−1 mindig kimegy; ütközésnél a T−3 egy hétköznappal korábban. ADR-XXXX ②.
- **K4** — próba alatt a Modulok fülön nincs többnyelvű-vétel, a vásárlási út elutasítja.
- **A1, A2, A4–A9** — a sáv dátuma, a számla-levél kedvezmény-sora, a tiltott „Ezt választom”, a mobil összegző sáv (csukható bontás), a leiratkozás-mondat egyszer, automatikus belépés, egyszeri modul címkéje, az előnézeti host a KIKÜLDÖTT prospectet nyitja (a gyanú igaz volt). A3 marad (brief).
- Mellékesen: `free-trial-expiry-check` 00:00–01:00 között a tiszta mainen is piros volt (az „egy órája” tegnapra esett) → javítva.

## Elek-újrafuttatás
Saját scratch-DB-n (`citoviso_elekproba3_10110048`, a dev-DB klónja), a szkriptek a fa `_elek/bin`-jében (gitből kizárva). B1, B2, K1, K2, K3, K4 az Elek-úton igazolva; a képek: `_elek/shots/`.

## Nyitott
- A sikerlapon a felhasználónév a régi slug marad (`udulo-tabor`), a cím az új: a belépés így helyes, de tulaj-kérdés lehet, kell-e a felhasználónevet is átnevezni.
