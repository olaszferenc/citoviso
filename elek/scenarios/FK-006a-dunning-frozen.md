# FK-006a — Dunning-létra: a FAGYASZTOTT állapot felülete

cél: A ki nem fizetett megújulás T+10 napján a rendszer a honlapot felfüggeszti — a vendég udvarias „átmenetileg nem elérhető" lapot lát, a tulaj-admin hangos fagyás-bannert fizetőgombbal, az Üzenetek fül pedig a teljes figyelmeztetés-sort mutatja. (Az állapotot a fejlesztő-session időutazója állította elő: scripts/elek-timetravel-fk006.mts, T−3→T+10, bukó token-terheléssel.)
felület: tenant-admin
kontraktus: _planning/DECISIONS.md ADR-0080 (előfizetés-motor)

## A vendég oldala fagyasztás alatt

- [ ] A vendég a felfüggesztett oldalon udvarias tájékoztatót kap, nem hibát
  user: anon
  út: /t/elek-teszt-vendeghaz/
  várd: látható "átmenetileg nem elérhető"
  várd: nem látható "Foglalás"

## A tulaj-admin fagyasztás alatt

- [ ] A Modulok fülön hangos fagyás-banner áll, fizető-gombbal
  user: tenant-elek
  út: /admin?tab=modulok
  várd: látható "A honlap fel van függesztve."
  várd: látható "Díj rendezése és visszakapcsolás"
  kézi: a banner hangsúlya képről ítélendő — első ránézésre látszania kell, hogy baj van, és hogy MI a kiút (a fizető-gomb)

- [ ] Az Üzenetek fülön a teljes figyelmeztetés-sor megvan
  út: /admin?tab=uzenetek
  várd: látható "Előfizetése hamarosan megújul"
  várd: látható "Esedékes a honlapdíj"
  várd: látható "Utolsó figyelmeztetés"
  várd: látható "Honlapja felfüggesztve"
