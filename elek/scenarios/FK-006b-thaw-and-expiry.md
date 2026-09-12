# FK-006b — Fizetés utáni azonnali visszakapcsolás + a lejárt foglalás-kérés nyoma

cél: A rendezett díj után a honlap AZONNAL visszakapcsol — és ezt a tulaj MEG IS TUDJA: a teendő-kártya helyén zöld megerősítés áll, és a felfüggesztés-szálat lezáró üzenet lesz a legfrissebb (eddig a „Honlapja felfüggesztve" maradt a feed tetején, percekkel azután, hogy a honlap visszajött). A 48 órán túl megválaszolatlan foglalás-kérésről a tulaj értesítést kap, és a sor nem állít döntést, amikor épp a döntés hiánya történt. (A fizetést és a lejáratást a fejlesztő-session időutazója hajtotta végre: thaw + bookingexpire.)
felület: tenant-admin
kontraktus: _planning/DECISIONS.md ADR-0080 (előfizetés-motor) · assets/design-refs/console/freeze-state/

## A vendég oldala visszakapcsolás után

- [ ] A honlap újra él, a foglalás-szekcióval együtt
  user: anon
  út: /t/elek-teszt-vendeghaz/
  várd: látható "ELEK-TESZT Vendégház"
  várd: nem látható "átmenetileg nem érhető el"
  várd: darab "[data-cit-module='booking']" >= 1

## A tulaj-admin visszakapcsolás után

- [ ] A visszakapcsolás LÁTHATÓ, nem csak a baj hiánya
  user: tenant-elek
  út: /admin?tab=modulok
  várd: látható "A honlapja újra elérhető"
  várd: nem látható "A honlapja jelenleg NEM elérhető"
  várd: nem látható "Rendezetlen díj."
  várd: látható "Aktív az oldalán"
  kézi: az előfizetés-kártya képről — a státusz-pötty nyugodt (nem piros/sárga), a következő fordulónap a kifizetett évre mutat

- [ ] Az Üzenetek fülön a VISSZATÉRÉS a legfrissebb, nem a felfüggesztés
  út: /admin?tab=uzenetek
  várd: látható "Honlapja újra elérhető"
  várd: látható "Számla OV-"
  kézi: a lista tetején a visszakapcsolás áll — a „Honlapja felfüggesztve" alatta, lezárt szálként

## A lejárt foglalás-kérés nyoma

- [ ] A Foglalások fülön a megválaszolatlan kérés lejártként áll, döntés nélkül
  út: /admin?tab=foglalasok
  várd: látható "Lejárt (48 óra)"
  várd: látható "Nem érkezett válasz"
  várd: darab ".bk-hist:has-text('lejárt:') :text('döntés:')" == 0
  kézi: a lejárt kérésnél NEM lehet műveleti gomb (se visszaigazolás, se lemondás) — képről ítélendő

- [ ] A lejáratról a tulaj értesítést kapott
  út: /admin?tab=uzenetek
  várd: látható "Lejárt egy foglalási kérés"
