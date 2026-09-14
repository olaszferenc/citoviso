# FK-006a — Dunning-létra: a FAGYASZTOTT állapot felülete

cél: A ki nem fizetett megújulás T+10 napján a rendszer a honlapot felfüggeszti. A vendég NEM névtelen zsákutcát kap, hanem emberi lapot: szállásnév, település és a szállásadó SAJÁT elérhetősége — de a lap NEM ígér visszatérést (sem időpontot, sem „átmenetileg", sem „dolgozunk rajta"), mert a fagyás a tulaj fizetésekor oldódik, és ha az nem érkezik meg, a 30. napon a honlap VÉGLEG lekerül. A tulaj-admin egyetlen teendő-kártyát mutat, amin a TARTOZÁS ÖSSZEGE a legnagyobb szám és közvetlenül alatta a rendezés gombja — és a lapon SEHOL nem szerepel ezzel ellentétes állítás. (Az állapotot a fejlesztő-session időutazója állította elő: scripts/elek-timetravel-fk006.mts, T−3→T+10, bukó token-terheléssel.)
felület: tenant-admin
kontraktus: _planning/DECISIONS.md ADR-0080 (előfizetés-motor) · ADR-0119 (fagyás-állapot) · ADR-0157 (a vendég-lap nem ígér visszatérést, és a vendég nyelvén szól) · assets/design-refs/console/freeze-state/ (jóváhagyott „A — Teendő-kártya" terv)

## A vendég oldala fagyasztás alatt

- [ ] A vendég emberi lapot kap: tudja, hol jár és hogyan éri el a szállásadót
  user: anon
  út: /t/elek-teszt-vendeghaz/
  várd: látható "jelenleg nem érhető el"
  várd: látható "ELEK-TESZT Vendégház"
  várd: látható "A szállás elérhetőségei"
  várd: látható "elek@citoviso.com"
  várd: darab "[data-cit-module='booking']" == 0
  várd: nem látható "Foglalási kérés"
  várd: nem látható "holnap"
  várd: nem látható "átmenetileg"
  tűrt-hiba: 503 /t/elek-teszt-vendeghaz/ — a felfüggesztett honlap SZÁNDÉKOSAN 503-at ad (ADR-0080): a keresőnek is azt kell mondania, hogy ez átmeneti állapot, nem „nincs ilyen oldal". ⚠️ Az „átmeneti" ITT gépi jelzés (Retry-After), a VENDÉGNEK szóló szövegben tilos.
  kézi: a lap SEHOL nem árulja el az okot (díj, tartozás, felfüggesztés) — az a szállásadót járatná le a vendége előtt
  kézi: a lap nem ígér visszatérést sem időben, sem szereplőben — ha a tulaj sosem fizet, minden állítása igaz marad
  megjegyzés: a „Dolgozunk rajta" tiltását NEM `várd:` sor őrzi — az a szöveg sehol nincs a termékben, tehát a `nem látható` vakon zöld lenne. A renderelt mérést a scripts/frozen-claim-check.mts végzi (13 állítás-osztály, szabályonkénti piros bizonyítékkal).

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
