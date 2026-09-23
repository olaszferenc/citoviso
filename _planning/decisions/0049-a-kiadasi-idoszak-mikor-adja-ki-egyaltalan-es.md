## ADR-0049 — A KIADÁSI IDŐSZAK: mikor adja ki egyáltalán, és abban minimum hány éjszakára

- **Kiváltó (tulaj, 2026-08-21):** „Az érdeklődés kérése az úgy jó volt… De foglalásnál ez más. Ki
  kell választania a szabad dátumot. […] A tulajdonosnak meg kell tudnia adni, hogy milyen
  időszakokban adja ki egyáltalán. Milyen minimum hány napra?"

**Amit a leltár mutatott:** a foglalási folyamat maga rendben volt (dátumválasztó, foglalt napok
elutasítása, tulaj-döntés a levélből ÉS az adminból, a Booking.com-bekötéstől függetlenül), és a
site-szintű `minNights` is létezett. Ami hiányzott: **mikor ad ki egyáltalán**. A tulaj csak a
naptárban tudott napokat egyesével kizárni — egy fél évet kikattintgatni képtelenség.

**Döntés**

1. **A kiadási időszak ugyanaz a lista, mint az árazás szezonjai.** A `unit_price` már ismétlődő
   `MM-DD` tartományokat tárol egységenként, saját címkével („Főszezon"). Egy MÁSODIK
   időszak-lista („mikor vagyok nyitva") két nyilvántartás lenne ugyanarról a tényről — pontosan
   az a csapda, amit a `site_unit` vs. rooms-lista esetében már egyszer kifogtunk. Ezért a
   szezon-sor hordozza mind a hármat: **ár + minimum éjszaka + (a kapcsolón át) kiadható-e**.

2. **Kapcsoló, nem hallgatólagos szabály.** `site_unit.seasonal_only` (alapértelmezés: **false**).
   Kikapcsolva minden marad a mai módon: egész évben kiadó, a szezonok csak az árat/minimumot
   finomítják. Bekapcsolva a fel nem sorolt napok nem eladók. Az „ami nincs felsorolva, az zárva"
   alapértelmezés minden meglévő tenantot egy éjszaka alatt „sehol nem szabad" állapotba tolt volna.

3. **Egységenként**, mint a naptár és az ár (`site_unit` kulcs) — egy négyapartmanos vendégház
   télre bezárhat egyetlen apartmant is.

4. **Éjszakánként vizsgálunk, nem az érkezés napján.** Egy foglalás beleérhet a szezonba és ki is
   lóghat belőle; „az első éjszaka jó volt" nem indok a többire. A minimum a **legszigorúbb** a
   érintett éjszakák közül: a főszezonba belógó foglalásnak a főszezont kell teljesítenie.

5. **A vendég nem is tudja KIVÁLASZTANI a zárt napot.** A zárt napok a foglaltsági végponton
   keresztül a naptárba kerülnek — nem tárolva, hanem számolva, így egy szezon átírása azonnal
   hat (különben egy évnyi napsort kellene újraírni, és az első meggondolás után elavulna). Ha
   csak beküldéskor utasítanánk el, az a régi csapda lenne: a naptár kínál egy éjszakát, aztán az
   űrlap nemet mond.

**Visszafordíthatóság:** 🔄 két additív oszlop (`unit_price.min_nights`, `site_unit.seasonal_only`),
mindkettő alapértelmezésben a mai viselkedést adja.

**Bizonyíték:** `module-config-check` +9 ellenőrzés valódi DB-n (szezon-minimum érvényesül;
kapcsoló nélkül télen is kiadó; bekapcsolva zárva; a kilógó foglalás is zárva; a zárt nap a vendég
naptárában is foglalt; a beküldés is elutasul). Pirosra futtatva: „csak az első éjszakát nézi" →
a kilógó foglalás átcsúszott; a szezonális minimum kihagyása → a 2 éjszaka átment. **Mindkét
rontásnál ellenőriztem, hogy a rontás tényleg megtörtént** (`grep -c` a rontott sorra) — a
korábbi kudarc után, ahol egy nem illeszkedő minta miatt maradt zöld a teszt.
