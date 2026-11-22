## ADR-XXXX — Ország-réteg 3/10: horvát javítókör — a pénz egy forrásból, ország-függő tartalom, OIB, nyelvi maradványok és a többes szám

**Státusz:** ELFOGADVA (tulaj „ok mehet” 2026-11-21 a koordinátoron át, brief
`orszag-reteg-3j-horvat-javitokor-20261121.md`, koordinátor `cit9b4690e3`) ·
**Épít:** ADR-0437, ADR-0443, ADR-0456, ADR-0458, ADR-0460, ADR-0461.

### Kiváltó

Elek 3/9-es horvát köre (béna user · IT · vásárló + admin) a nyitás-kész HR soron pénz-, tartalmi és
nyelvi hibákat talált: a levélben ígért −25 % a rendelésnél nem látszott; a domain díja eltűnt a következő
terhelésből (26,94 € → 24,38 €); a varázsló 85,50 €-t „86 €”-nak írt; egy másodpercen belül két
ellentmondó domain-levél jött („folyamatban, nincs teendő” + „elkelt”); Szállás.hu a horvát levélben és
a mock naptár-sávján; OIB-ellenőrzés nem volt, a horvát cég ÁFA-szám nélkül nem rendelhetett; „AAM” és
Europe/Budapest a horvát vevőnél; magyar maradványok (csomagnevek, országlista, VIES-hiba, szobakártya,
admin-naptár, lemondó oldal, /login?l=hr); „1 noći”, „2 osoba”.

### Döntés

① **A pénz egy forrásból.**
  a) A −25 % forrása a küldéskor rögzített ajánlat-sor (ADR-0286) — a kód ezt már így tette; Elek
     világában a levél csak renderelődött, el nem küldődött, ezért nem volt ajánlat. Az új tesztvilág
     (`scripts/lib/hr-world.mts`) a levelet a VALÓDI küldési úton küldi (mock levél), így a levél, a lap
     konfigurátora és a rendelés ugyanazt a sort olvassa (e2e ①a).
  b) A következő terhelés ELŐREJELZÉSE (`/pay/done`, aktiváló levél, admin Moduli) a folyamatban lévő
     domain-beszerzés díjával számol (`domainFeeForRenewal(…, { forecast: true })`); a megújítási TERHELÉS
     változatlanul csak a ténylegesen birtokolt névért terhel (§B.17).
  c) A varázsló előnézete a pénznem tizedes-szabályával formáz (`formatMinor`), az ár-mező példája nem
     forint-nagyságrend nem-forint pénznemnél.
  d) Egy esemény, egy igazság: az aktiváló levél legfeljebb 8 mp-et vár a domain-beszerzés azonnali
     kimenetére, és annak állapotát írja (elbukott → nem ígér domaint; a hiba-levél az egyetlen igazság
     róla). A hiba-levél csak `DomainTakenError`-nál mondja, hogy „elkelt”; más ok (ár-plafon, pénznem,
     regisztrátor-hiba) „nem tudtuk megvásárolni”. A horvát teszt-ársor domain-plafonja a regisztrátor
     pénznemében (HUF) áll — az EUR-plafon miatt bukott el Elek .hr vásárlása.
  e) A ház fizetés-riasztása a fizetés összegét minor unitból formázza (16,49 € volt „1 649 €”).
  f) A hideg levél és a nem-nyitó utánkövető ár-doboza nem-forint összegnél nem ír „Ft”-t (Elek ismétlés:
     „12,52 € Ft/mj.”) — az összeg a saját jelét viszi (`outreachEmail.ts perMonth/perMonthFrom`).
  g) A horvát közösségi adószám = „HR” + OIB: offline ellenőrzőszám és egyezés a megadott OIB-vel, mielőtt
     VIES-hez menne vagy fordított adózásra váltana.

② **Ország-függő tartalom.**
  a) A naptár-szinkron portáljai az ország-sorból: `calendarSyncPortals(country)` = Booking.com + Airbnb
     + az ország `portal_domains`-ában szereplő, IGAZOLT iCal-ú helyi portál (ma: szallas.hu → HU). A mock
     foglalási mintája (`data-cit-portals`, csak nem-magyar lapon) és a konfigurátor „Online foglalás”
     modulja ebből dolgozik; a magyar lap bájtra a régi.
  b) OIB (ISO 7064 MOD 11,10, offline): a tenant-admin Jogi adatainál (`LEGAL_LOCAL.HR.taxIdCheck`) a hibás
     OIB nem mentődik, a többi adat igen, a mező a beírt jegyekkel és az okkal jelenik meg; a rendelés
     céges ágán HR-ben OIB-mező (kötelező), a közösségi adószám ott opcionális (nélküle nincs VIES, nincs
     fordított adózás). Az OIB új oszlopba kerül (`0148`, `order_intent.buyer_national_tax_id`) — NEM a
     számla magyar `adoszam` mezőjébe — és az impresszumot tölti elő.
  c) A tenant időzónája THE lead országából (ADR-0437 ②), nem a scrape-terület országából; „AAM” a
     Dokumentiben csak magyarul, más nyelven „alanyi adómentes” (T()).

③ **Magyar maradványok:** csomagnevek, a csomagok tartalomlistája, a modul-sorok és csoportcímek `tr()`;
   a fizetés-lépés dátumai a lap nyelvén; a vásárlás utáni „ez már az Öné” sáv és lábléc a lead nyelvén;
   a katalógus-felszereltség a vendégoldalon a lap nyelvén; a mock foglalási mintája a szállás zónájában
   számolja a „ma”-t (`data-cit-tz`); a fizetési lap a süti-sáv FÖLÖTT ér véget (mobilon a sáv takarta a
   „Fizetek” gombot); országlista a lap nyelvén (`Intl.DisplayNames`, saját ország
   elöl); a vevő-ellenőrző minden üzenete a vevő nyelvén (`validateBuyer(…, { lang })`, HU bájtra
   azonos); szobakártya „{n} fő”, „{p} / éj”, „{p}-tól” T()-vel; admin-naptár: alapértelmezett egység neve
   és hónapnév a nyelv szerint; vendég lemondó oldal `lang` + dátum a nyelv szerint; `/login` a `?l=`-t is
   olvassa, „mutat/elrejt” és a példa T()-vel.

④ **Többes szám:** a katalógus-kulcs egy magyar forrás marad; a fordítás ÉRTÉKE lehet
   `plural:one=…;few=…;other=…` (az adott nyelv `Intl.PluralRules` kategóriái, `other` kötelező). Minden
   T() a numerikus `{n}`-nel választ (`packs.ts selectPlural`, `templateKit.T`), a kliens `trn()`-nel; a
   placeholder-szerződés alakonként él. Kulcs nem keletkezik, a teljesség-számláló nem mozdul. Az
   alakokat Bábel adja.

⑤ **Teszt:** `scripts/country-hr-fix-e2e.mts` (scratch DB, a valódi küldési és fizetési úttal) — minden
   pénz-tétel HU-ikerrel.

### Következmény

- A HR piac nyitásához Bábel-kör kell az új feliratokra és a plurál-alakokra (jegy: `~/rc-briefs/`).
- A naptár-mondat a régi hideg LEVÉLBEN (két portálos változat) kimaradt: a levél-kritikus újraítélése a
  tulaj-jóváhagyott szöveget kifogásolta, közben az új személyes levél (ADR-0462) váltotta, abban nincs portál-felsorolás.

### Nyitott

- A citoviso.com főoldal honosítása (`?l=hr`): a lap a magyar piac marketing-oldala (Ft-os jutalék-
  kalkulátor, .hu domain, Szállás.hu) — tartalmi döntés, nem fordítás.
- A Jogi adatok „a rendelés adataiból előre kitöltve” ígérete: a kezdő rendelés során nincs tenant_id, így
  az előtöltés üres — a javítás minden meglévő tenant impresszumán megjelenítené a vevő számlázási címét
  (jogi/adatvédelmi döntés).
