# 2026-11-26 — Miért nem jönnek a jóváhagyandók; a minőségi kolléga szabályfelfedező lesz

Session `cit96bd8170` (brief `~/rc-briefs/production-20261126-192546.md`, tulaj-kérdések a Telefon session archiválása után).

## Diagnózis (éles mérés 19:30)
- 2626 várakozó dispatch-sor → 93 aktuális generátorú → 84 fotó-kapus → kolléga: 13 pass / 43 fail / 9 elavult / 19 átnézetlen → 8 lead mindkét tervvel → **2 a /jovahagyas lapon**; 6 már jóváhagyva a holnapi ablakra; 5 kiment.
- Kolléga-kapacitás: 4 kolléga, 148 ítélet, 4,5–6,3 ítélet/aktív óra, csúcs 16–17/óra; pass 65 / 21 / 38 / 5 %. Pass-arány órára: 93 % (friss javítás utáni anyag), 12 % (két ismert generátor-hiba minden mockon), 100 % (19:10-es mérce) → a számot a generátor állapota mozgatta.
- A bukott mock sehol nem kuka: a sor tart, a következő generátor-javítás újrarendereli, újra sorra kerül (90 bukottból 8 már). Valódi „örök várás” csak a nyitókép nélküli leadnél van (7 tartott + településkép „nincs jó hero” 44 %).

## Döntés és kód (ADR-XXXX)
- A tulaj lapját és a kiküldőt a gépi render-kapu + a tulaj „Mehet”-je táplálja; a kolléga passza nem kapu, a fail-je tart.
- `qa-review.mts sample | note | findings`; `gate-blind-sample.mts` (vak mérés); `CHAIN_WAIT_NOTES` (új + régi várakozó-jegyzet).
- Új kolléga-brief: `~/rc-briefs/minosegi-kollega-mintavetel-20261126.md`.

## Nyitott
- Élesítés: az éles HEAD (`5ba2b582`) kézi hotfix-ág, a main ~15 másik tételt visz → a tulaj dönt, mi megy ki.
- A <5 saját képes (településképes) ág mockjait a frissítő nem rendereli újra (csak ≥5 saját képes) → külön kör.
