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

### Módosítás (2026-09-23) — a kapcsoló és az „éj min.” CSAK foglalással él

- **Kiváltó (tulaj, 2026-09-23):** „ha nincs foglalási modul, akkor foglalási igény küldés van. Ekkor
  szépen nem aktív ez a lehetőség. […] Hát vegye meg hozzá a foglalást is, és akkor majd hat rá."
- **A lelet:** az Árak modul foglalás nélkül is megvehető (a függőség egyirányú: booking ──requires──▶
  pricing, ADR-0192), a szerkesztő viszont feltétel nélkül kínálta a kapcsolót és az időszakonkénti
  „éj min."-t — mindkettőt CSAK a foglalási naptár olvassa, az ártábla nem (`recipe.ts`: név, dátum,
  ár). Foglalás nélkül a tulaj átbillentette, és a lapján semmi nem változott: ál-választás.
- **Döntés ① (felület, jóváhagyott B terv — `assets/design-refs/_drafts/seasonal-toggle.html`):**
  foglalás nélkül a kapcsoló, az „éj min." mező, a meglévő „min. N éj" jelölés és az általános
  minimumra utaló mondat nem jelenik meg; helyette egy sor mondja meg, mit adna a foglalás, link a
  Modulok fülre. A kérdést az admin is az `isRenderedModule`-lal teszi fel (aktív ÉS nincs kiváltva).
- **Döntés ② (viselkedés — a rejtés MELLÉKTERMÉKE miatt):** a tudásbázis-őr kimérte, hogy a kimenő
  portál-feed (`/naptar/<token>.ics`) modul-kapu nélkül olvasta a `seasonal_only`-t. A rejtéssel egy
  foglalás-lemondás után bent maradt kapcsoló télen zárva tartotta volna a portált, és a tulaj már
  ki sem tudta volna kapcsolni. Ezért a szabály EGY helyen dől el: `seasonalOnlyInForce(unitId)` =
  a kapcsoló ÉS a foglalás a lapon; ezt kérdezi a naptár, a feed és a foglalási kérés is. A tárolt
  érték nem vész el — foglalás nélkül szünetel, visszakapcsolt foglalással újra él.
- **Nyitott, külön szelet:** a kimenő feed maga sincs foglalás-modulhoz kötve; lemondás után a kézi
  zárások és a korábbi foglalások tovább mennek a portálra, miközben a naptár-szerkesztő már nem
  érhető el. Ez nem e döntés tárgya.

**Visszafordíthatóság:** 🔄 séma-változás nincs; egy predikátum és egy feltételes render.

**Bizonyíték:** `scripts/pricing-booking-only-check.mts` (17 állítás, mindkét állapot; `--selftest` +
a forrás rontásával mindkét irányban piros: 5 ill. 6 bukás) · `scripts/module-config-check.mts` két új
állítása (foglalás nélkül sem a szabály, sem a feed nem zár; a `seasonalOnlyInForce` rontásával piros:
`closed:true`, 325 zárt nap) · a `PricingEditorData.bookingActive` KÖTELEZŐ mező (rontással: `tsc` bukik).
A fixture ELAVULT MÉRÉSE is itt derült ki: a szezon-állítások eddig foglalás modul NÉLKÜLI tenanton
futottak; most a valódi előfeltétellel (foglalás + árazás) mérnek.
- **Mellék-javítás ugyanazon a képernyőn (tulaj jóváhagyta):** az új-időszak űrlap 390px-en 143px-t
  lógott ki a kártyából (a második dátum-mező levágva), asztalon az „éj min." két sorra tört. Az
  őr ④ szakasza böngészőben méri mindkettőt (mindkét foglalás-állapotban), a régi CSS-sel piros.
