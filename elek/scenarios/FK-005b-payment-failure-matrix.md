# FK-005b — Fizetés bukás-mátrix a mock-gateway-en (elutasítás, vissza, újratöltés, újrapróba, dupla)

cél: A tenant-adminból indított egyszeri vásárlás (Többnyelvű honlap) fizetése minden bukás-ágon kiszámíthatóan viselkedik — az elutasítás nem terhel, a vissza-gomb és az ismételt fizetés nem duplikál, az állapot minden lépésben őszinte, és a KIFIZETETT tétel a Modulok fülön ki is mondja magáról, hogy ki van fizetve.
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
  várd: nem látható "Kifizetve"
  várd: darab "#tobbnyelvu button[type=submit]:not([disabled])" >= 1

## Elutasított fizetés

- [ ] A fizetés elindul a mock-fizetőoldalra
  tedd: kattints "Fizetés és generálás"
  tedd: várj "Mock fizetőoldal" 30
  várd: látható "Elutasítom"
  várd: látható "Ez a fizetés még nem indult el"
  adat: ELEK-TESZT egyszeri fizetés (Többnyelvű honlap, mock)

- [ ] A fizetés közbeni oldal-újratöltés nem terhel és nem veszít el semmit
  tedd: újratöltés
  várd: látható "Mock fizetőoldal"
  várd: látható "Elutasítom"
  várd: látható "Ez a fizetés még nem indult el"

- [ ] Az elutasítás nem terhel, és ezt ki is mondja
  tedd: kattints "Elutasítom"
  várd: látható "A fizetés nem sikerült"
  várd: látható "Nem történt terhelés"

- [ ] A bukás-oldalon van mivel továbbmenni, és van mit idézni
  várd: látható "Újra próbálom a fizetést"
  várd: látható "Hivatkozási azonosító"

## Vissza-gomb és újrapróbálkozás

- [ ] A vevő visszalép a fizetőoldalra — az állapot őszinte
  tedd: vissza
  várd: látható "A fizetés elutasítva"
  várd: nem látható "Ez a fizetés még nem indult el"
  kézi: a fizetőoldal státusz-sora az elutasítás után képről is ítélendő

- [ ] Az elutasított fizetés újrapróbálható, és most sikerül
  tedd: kattints "Újra próbálom — Fizetek ▸"
  tedd: várj "Sikeres fizetés" 60
  várd: látható "Sikeres fizetés"
  adat: ELEK-TESZT sikeres fizetés (újrapróba az elutasítás után)

- [ ] A visszaigazolás a MEGVETT DOLOGRÓL szól, nem új ügyfelet üdvözöl
  várd: látható "A fordítás elindult"
  várd: látható "Vissza a kezelőfelületre"
  várd: nem látható "Belépek és szerkesztem"
  várd: nem látható "Belépési adatok"

## Dupla-fizetés elleni védelem

- [ ] A vevő visszalép és MÉG EGYSZER fizetne — nem történhet második terhelés
  tedd: vissza
  várd: látható "Ez a fizetés rendezve van"
  várd: nem látható "Elutasítom"
  kézi: a felület válasza képről ítélendő — dupla-terhelésre utaló jel NEM lehet

## Az eredmény a tenant-adminban

- [ ] A kifizetett modul állapota a Modulok fülön átfordul
  út: /admin?tab=modulok
  várd: látható "Kifizetve"
  várd: látható "Hivatkozási azonosító"
  várd: darab "#tobbnyelvu button[type=submit][disabled]" >= 1
  kézi: a Többnyelvű honlap kártya fizetés utáni állapota képről ítélendő — a nyugta (összeg, időpont, megvett nyelvek) olvasható-e

- [ ] A második számla megjelenik a Dokumentumok közt
  út: /admin?tab=dokumentumok
  várd: darab ".adm-inv" >= 2
  kézi: a két bizonylat-sor (éves csomag + egyszeri modul) képről ítélendő

## Összkép

- [ ] A bukás-ágak képernyői rendezettek
  kézi: elrendezés-ítélet a képekről

## Ami MÉG NINCS lefedve — és miért

- **Lejárt fizetési link:** a terméknek MA nincs ilyen állapota — a `payment` sorhoz nem
  tartozik lejárati idő, a mock pay-link időtlen (éles Barionnál a gateway oldalán jár le).
  Forgatókönyvet írni rá kitalált viselkedést mérne. Ha a lejárat megszületik (ADR kell
  hozzá: mennyi idő, mit lát a vevő, újragyártható-e a link), ide jön a köre.
