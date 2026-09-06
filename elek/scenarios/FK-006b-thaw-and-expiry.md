# FK-006b — Fizetés utáni azonnali visszakapcsolás + a lejárt foglalás-kérés nyoma

cél: A rendezett díj után a honlap AZONNAL visszakapcsol (vendégnek él, a fagyás-banner eltűnt, a periódus előre lépett), a 48 órán túl megválaszolatlan foglalás-kérés pedig lejárt állapotba került és a felületen jelölve van. (A fizetést és a lejáratást a fejlesztő-session időutazója hajtotta végre: thaw + bookingexpire.)
felület: tenant-admin
kontraktus: _planning/DECISIONS.md ADR-0080 (előfizetés-motor)

## A vendég oldala visszakapcsolás után

- [ ] A honlap újra él, a foglalás-szekcióval együtt
  user: anon
  út: /t/elek-teszt-vendeghaz/
  várd: látható "ELEK-TESZT Vendégház"
  várd: nem látható "átmenetileg nem elérhető"
  várd: darab "[data-cit-module='booking']" >= 1

## A tulaj-admin visszakapcsolás után

- [ ] A fagyás-banner eltűnt, az előfizetés rendben
  user: tenant-elek
  út: /admin?tab=modulok
  várd: nem látható "A honlap fel van függesztve."
  várd: nem látható "Rendezetlen díj."
  kézi: az előfizetés-kártya képről — a státusz-pötty nyugodt (nem piros/sárga), a következő fordulónap a kifizetett évre mutat

- [ ] A kifizetés számlája az Üzenetek közt van
  út: /admin?tab=uzenetek
  várd: látható "Számla OV-"

## A lejárt foglalás-kérés nyoma

- [ ] A Foglalások fülön a megválaszolatlan kérés lejártként áll
  út: /admin?tab=foglalasok
  várd: látható "Lejárt (48 óra)"
  kézi: a történet-sorban a lejárt kérésnél NEM lehet műveleti gomb (se visszaigazolás, se lemondás) — képről ítélendő
