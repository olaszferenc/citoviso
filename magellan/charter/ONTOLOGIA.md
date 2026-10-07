# MAGELLAN — az ontológia kivonata (ezt olvasod, nem a teljes DOMAIN-t)

> ⚠️ TERVEZET (2026-10-07). Kivonat a `_planning/DOMAIN/03-INVARIANTS.md` és az ADR-ek azon
> pontjaiból, amelyek a munkádban döntenek. Ha eltér az eredetitől, az eredeti az irányadó — és szólsz.

## 1. Fogalmak
- **Hely (felderített)** — egy szállás a Térképen, amit a munkalapon rögzítettél. Még nem lead.
- **Lead** — feldolgozott hely, amelynek nincs saját honlapja vagy csak portálon van (`none` / `portal_only`).
  Saját honlapos hely nem lead (`has_own`) — de rögzíted, mert a lefedettséghez és a dedupe-hoz kell.
- **Ismert lead** — azonos normalizált név (kis-/nagybetű, ékezet, írásjel nélkül) ÉS ≤250 m (ADR-0296,
  `isSamePlayer`). Ismert helyet nem nyitsz ki és nem dolgozol fel újra.
- **Régió / csempe** — a gyűjtési terület és annak egy darabja. A régió NEM a hely települése (§F.17e).
- **Telített lista** — a Térkép-lista nem mutat meg mindent; csak a felosztás garantálja a lefedettséget.
- **Lefedettség** — a régióban korábban ismert leadek hány %-át láttad újra. Cél: ≥95%.

## 2. Saját honlap (§F.13–16, Neóval közös)
1. Bizonyítás kell, nem a hiány feltételezése.
2. Találat csak a hely SAJÁT TELEPÜLÉSÉVEL egyezve érvényes; csak névegyezés = ütközés, nem találat.
3. A név sorrendje a domainben felcserélődhet („Sissi Panzió” → `panziosissi.hu`).
4. Parkolt, eladó, „hamarosan” oldal nem saját honlap. Portál-bejegyzés (szallas.hu, booking,
   hovamenjek, zimmerinfo, facebook…) nem saját honlap.

## 3. Tényhűség és jog (§B.17, §A, §C)
- Csak azt írod fel, ami látszik. Becslés, kikövetkeztetés, „valószínűleg” nincs.
- A Google-ből **tényadatot** veszünk át (név, cím, telefon, honlap, koordináta, darabszámok) —
  fotót és vélemény-szöveget nem (jogalap nélkül nem lehet).
- Telefon: a felület normalizálja (+36…); ha „nem érvényes”-t mond, nem erőlteted.

## 4. Adagos mentés (ADR-0331)
Semmi ne vesszen el, ha a sessionöd elhal: a munkalap minden mezőt azonnal ment. Te sosem tartasz
„fejben” félkész munkát — amit láttál, azonnal beírod.

## 5. Mikor nyisd meg az eredetit
- Honlap-ítélet kétes: `grep -n "^1[3-6]\." _planning/DOMAIN/03-INVARIANTS.md` (§F).
- Ismert-e egy hely, vitás: ADR-0296 (`_planning/decisions/0296-*`).
