# Éves váltás kontraktus (ADR-0088 §8 — „B: megtakarítás-doboz")

Tulajdonosi jóváhagyás: 2026-09-01 („B"), a véglegesség-szöveg pontosításával (a tulaj
„WTF"-je nyomán: a visszavonhatóság határa legyen kimondva). **Ez a terv KÖT.**

## Amit a terv KÖT

1. **Megtakarítás-doboz** az előfizetés-kártyában (Modulok fül), CSAK havi ütemű, élesített
   váltás nélküli, nem lemondott előfizetésnél: „{n} hónap ajándék évente" cím, megtakarítás
   forintban a VALÓS modul-készletből, éves ár nagyban + havi megfelelője, CTA:
   „Váltok éves fizetésre a következő fordulónaptól".
2. **Élesített állapot**: zöld megerősítés — hatálynap (őszinte dátum: ha a következő számla
   már ki van állítva a régi áron, az AZUTÁNI forduló), éves összeg, „Most nem fizet semmit",
   ÉS a véglegesség-mondat: **„A fordulónapig meggondolhatja magát; az éves számla kifizetése
   után a váltás végleges, az éves díj a teljes évre szól."** + „Mégsem — maradok a havi
   fizetésnél" gomb. A „Következő számla" cella az éves összeget mutatja „éves" jelzéssel.
3. **Éves állapot** (fizetés után): csendes sor („Fizetés üteme: éves … következő megújulás:
   {date}"), NINCS visszaváltó — a kifizetett év végleges (tulaj-rendelet).
4. A váltás SOHA nem jár azonnali terheléssel és nem nyúl a kifizetett időszakhoz; a backend
   igazsága a `subscription.pending_period` (0046) + `setPendingBillingPeriod`.
5. Minden felirat T()-fordított; a KB „admin-subscription" bejegyzés a gomb-feliratokkal
   szó szerint egyezően vezeti végig a tulajt.
