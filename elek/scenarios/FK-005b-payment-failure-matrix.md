# FK-005b — Fizetés bukás-mátrix a mock-gateway-en (elutasítás, vissza, újrapróba, dupla)

cél: A tenant-adminból indított egyszeri vásárlás (Többnyelvű honlap) fizetése minden bukás-ágon kiszámíthatóan viselkedik — az elutasítás nem terhel, a vissza-gomb és az ismételt fizetés nem duplikál, az állapot minden lépésben őszinte.
felület: tenant-admin
kontraktus: kb/entries/admin-multilang/entry.hu.md

## Előkészítés

- [ ] Belépés a kapott jelszóval
  user: anon
  út: /login
  tedd: írd "#username" "${ELEK_TENANT_USER}"
  tedd: írd "#password" "${ELEK_TENANT_PASSWORD}"
  tedd: kattints "Belépés"
  várd: látható "Áttekintés"

- [ ] A Többnyelvű honlap kártya fizetés-indítója él (pontosan 3 nyelv kiválasztva)
  út: /admin?tab=modulok
  tedd: kattints "[name='lang'][value='de']"
  tedd: kattints "[name='lang'][value='sk']"
  tedd: kattints "[name='lang'][value='hr']"
  várd: látható "Fizetés és generálás"

## Elutasított fizetés

- [ ] A fizetés elindul a mock-fizetőoldalra
  tedd: kattints "Fizetés és generálás"
  tedd: várj "Mock fizetőoldal" 30
  várd: látható "Elutasítom"
  adat: ELEK-TESZT egyszeri fizetés (Többnyelvű honlap, mock)

- [ ] Az elutasítás nem terhel, és ezt ki is mondja
  tedd: kattints "Elutasítom"
  várd: látható "A fizetés nem sikerült"
  várd: látható "Nem történt terhelés"

## Vissza-gomb és újrapróbálkozás

- [ ] A vevő visszalép a fizetőoldalra — az állapot őszinte
  tedd: vissza
  kézi: a fizetőoldal státusz-sora az elutasítás után képről ítélendő (failed státusz látszik-e)

- [ ] Az elutasított fizetés újrapróbálható, és most sikerül
  tedd: kattints "Fizetek ▸"
  tedd: várj "Sikeres fizetés" 60
  várd: látható "Sikeres fizetés"
  adat: ELEK-TESZT sikeres fizetés (újrapróba az elutasítás után)

## Dupla-fizetés elleni védelem

- [ ] A vevő visszalép és MÉG EGYSZER fizetne — nem történhet második terhelés
  tedd: vissza
  tedd: kattints "Fizetek ▸"
  kézi: a felület válasza képről ítélendő — dupla-terhelésre utaló jel NEM lehet (a fizetés már 'paid', az ismételt gomb nem aktiválhat újra)

## Az eredmény a tenant-adminban

- [ ] A kifizetett modul állapota a Modulok fülön átfordul
  út: /admin?tab=modulok
  kézi: a Többnyelvű honlap kártya fizetés utáni állapota (generálás folyamatban / kész) képről ítélendő

- [ ] A második számla megjelenik a Dokumentumok közt
  út: /admin?tab=dokumentumok
  várd: darab ".adm-inv" >= 2
  kézi: a két bizonylat-sor (éves csomag + egyszeri modul) képről ítélendő

## Összkép

- [ ] A bukás-ágak képernyői rendezettek
  kézi: elrendezés-ítélet a képekről
