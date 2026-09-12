# FK-006a — Dunning-létra: a FAGYASZTOTT állapot felülete

cél: A ki nem fizetett megújulás T+10 napján a rendszer a honlapot felfüggeszti. A vendég NEM névtelen zsákutcát kap, hanem emberi lapot: szállásnév, elérhetőség, és hogy mikorra várható a visszatérés. A tulaj-admin egyetlen teendő-kártyát mutat, amin a TARTOZÁS ÖSSZEGE a legnagyobb szám és közvetlenül alatta a rendezés gombja — és a lapon SEHOL nem szerepel ezzel ellentétes állítás. (Az állapotot a fejlesztő-session időutazója állította elő: scripts/elek-timetravel-fk006.mts, T−3→T+10, bukó token-terheléssel.)
felület: tenant-admin
kontraktus: _planning/DECISIONS.md ADR-0080 (előfizetés-motor) · assets/design-refs/console/freeze-state/ (jóváhagyott „A — Teendő-kártya" terv)

## A vendég oldala fagyasztás alatt

- [ ] A vendég emberi lapot kap: tudja, hol jár és hogyan éri el a szállásadót
  user: anon
  út: /t/elek-teszt-vendeghaz/
  várd: látható "átmenetileg nem érhető el"
  várd: látható "ELEK-TESZT Vendégház"
  várd: látható "Addig is közvetlenül elérhető"
  várd: látható "elek@citoviso.com"
  várd: darab "[data-cit-module='booking']" == 0
  várd: nem látható "Foglalási kérés"
  kézi: a lap SEHOL nem árulja el az okot (díj, tartozás, felfüggesztés) — az a szállásadót járatná le a vendége előtt

## A tulaj-admin fagyasztás alatt

- [ ] A Modulok fülön teendő-kártya áll, a tartozás összegével és a rendezés gombjával
  user: tenant-elek
  út: /admin?tab=modulok
  várd: látható "A honlapja jelenleg NEM elérhető"
  várd: látható "Rendezendő tartozás"
  várd: látható "Befizetem"
  kézi: a képen a TARTOZÁS ÖSSZEGE a legnagyobb szám, és a fizető-gomb közvetlenül alatta van — nem a lap alján, és nem egy új vásárlás gombjával keverve

- [ ] Ugyanazon a lapon NINCS ellentétes állítás
  út: /admin?tab=modulok
  várd: nem látható "nincs teendője"
  várd: nem látható "elérhető marad"
  várd: nem látható "Aktív az oldalán"
  várd: látható "Szünetel"
  várd: látható "Az automatikus kártyaterhelés elakadt"

- [ ] Az Üzenetek fülön a teljes figyelmeztetés-sor megvan
  út: /admin?tab=uzenetek
  várd: látható "Előfizetése hamarosan megújul"
  várd: látható "Esedékes a honlapdíj"
  várd: látható "Utolsó figyelmeztetés"
  várd: látható "Honlapja felfüggesztve"
