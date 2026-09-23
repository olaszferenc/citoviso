## ADR-XXXX — Ár nélküli kérésre ÁRAJÁNLAT megy a rendszerből, és az ár dátummal az árlistába kerül (2026-09-23)

**Dátum:** 2026-09-23 · **Státusz:** elfogadva (megvalósítva, őrrel) · **Kapcsolódó:** ADR-0208 ⑥.1
(ez a tétel), ADR-0208 ⑥.5 (évhez kötött ár — az ALAPJA itt landolt), ADR-0193 ① (nem blokkolunk),
ADR-0192 ④.2 (a `booking` kemény függősége a `pricing`), ADR-0044 §6 (a foglalás KÉRÉS),
§B.17 · **Kontraktus:** `assets/design-refs/tenant-admin/booking-offer/` · **Migráció:** 0072.

**Kiváltó.** Az ADR-0208 a vendég-oldalt javította (ár nélkül árajánlatot kér, nem foglal), a
tulaj-oldalt nyitva hagyta. Mérve (2026-09-23): a tulaj levele az árat **némán kihagyta**,
„Új foglalási kérés"-nek hívta, és egy koppintásos **„Elfogadom"** gombot adott, ami a foglalást
**ár nélkül véglegesítette** — a vendég árajánlatot kért, és összeg nélküli visszaigazolást kapott.
A vendég „rögzítettük" levele is foglalási kérést mondott.

### ① A DÖNTÉS — a tulaj a RENDSZERBŐL áraz, a vendég a RENDSZERBEN fogad el

§2b kör, két kör mockkal, mindkét méreten. **A tulaj a „B" utat választotta** (ajánlat → a
vendég elfogadja), és a 2. körben három pontosítást adott:
1. *„Online foglalás esetén soha nem lehetséges"* a „nincs árlista" ág — mérve igaz: a `booking`
   kemény függősége a `pricing` (`src/modules.ts`), és a lemondását a módosítás elutasítja.
2. *„Az ő érdekében: a rendszerből árazzon, mert nem fogja tudni nyomon követni, kinek mi ment
   el"* — ezért nincs „válaszoljon levélben" út; az ajánlat a rendszerből megy, nyoma marad.
3. *„Nem kikényszerítő… kelljen dátumot is adni, meddig érvényes; figyelmeztetni, ha nem ír"* —
   ezért az ár **mindig** az árlistába kerül (nincs „csak erre a kérésre"), dátummal évhez
   kötötten, dátum nélkül időtlen alapárként, és az üres dátum következményét a lap kimondja.
4. + a tulaj elfogadta a javaslatot: **„A vendég elfogadta (telefonon / levélben)"** gomb.

### ② AZ ADATMODELL (a tulaj jóváhagyta a neveket)

- `booking_request`: új állapot **`offered`**, `offered_at`, **`offer_token`**. ⛔ A vendég kulcsa
  KÜLÖN kulcs: az `action_token` a tulajé, és az az ajánlat-lapot — tehát az árlista írását —
  nyitja. A lejárat NEM tárolt: `offered_at` + a modul `autoDeclineHours`-a.
- `unit_price`: `valid_from`/`valid_to` (évhez kötött ablak) + `expiry_notified_at`.
- A sor-választás EGY helyen bővült (`cit-season.cjs`): **évhez kötött szezon → szezon → dátumos
  alapár → alapár**. ⛔ A `rowFor` második argumentuma hónap-napról TELJES dátumra váltott; egy
  régi hívó minden dátumos sort némán kihagyna, ezért rövid argumentumra HANGOSAN dob.

### ③ A LÁNC

Tulaj-levél („Árajánlat-kérés", az árazatlan éjszakák megnevezve, „Ajánlatot küldök") →
ajánlat-lap (csak a hiányzó éjszakákra kér árat, élő összeg, érvényesség + figyelmeztetés) →
ár az árlistába + a lap újrarenderelése → vendég-levél (ár, a tulaj üzenete, lejárat, „addig más
is lefoglalhatja") → vendég-lap (GET csak mutat — a levelezők előtöltenek; POST dönt) → **a tulaj
mai elfogadásának MAGJA** (egy tranzakció: szabad-e, foglal) → visszaigazolás „Az ajánlott ár"-ral
+ tulaj-levél. Kimenetek: elfogadva · „Nem kérem" · közben elkelt · lejárt — mindegyiknél mindkét
fél tudja. A régi levelek koppintásos „Elfogadom"-ja ár nélküli kérésen **az ajánlat-lapra
irányít**, nem véglegesít.

A dátumos ár az időben: lejárat előtt **14 nappal** egy emlékeztető (a bélyeg miatt ablakonként
egy), lejáratkor a sor törlődik és a lap újrarenderelődik — a statikus ártábla nem mondhat
lejárt árat. A 14 nap indoka: a naptár 12 hónapra előre foglalható, tehát a rés a lejáratkor már
foglalható; egy hónappal előbbi levél a döntés napjára feledésbe megy.

### ④ ⛔ AMIT A SAJÁT MÉRÉSEM FOGOTT MEG (és ami nélküle kiment volna)

1. **A tulaj ajánlat-üzenete „Vendég" címkét kapott** a Foglalások előzményében: a szerzőt a
   `decided_by` adja, és azt a vendég írja, amikor elfogad. A gépi állítások zöldek voltak — a
   KÉP mutatta meg. Javítás: ajánlatnál az üzenet a tulajé (csak a rendszer írhatja felül);
   az őr a renderelt sort méri, **piros kontrollal igazolva** (visszarontva 4 bukás).
2. **Egy idegen őr (`money-format-check` ⑤)** fogta meg, hogy a tulaj-lap szkriptjébe saját
   ezres-csoportosítót írtam — a pénz-formázó egy példányban él. Javítás: a `cit-money.js` utazik
   a szkripttel.
3. **Az összeg a szám közepén tört** a vendég-lapon, 390 px-en („78 / 000 Ft") — csak a képen.
4. Kétszer a SAJÁT állításom volt hibás: a CSS nagybetűsít, az innerText „VENDÉG"-et ad.
5. **A commit-kapuk még hármat fogtak:** a `requestsCard` (modul-lap) HALOTT kód — a rá írt
   módosításom semmit nem csinált, visszavonva; az i18n-hatókörbe felvett ajánlat-lap magyar
   hónapneveket írt minden nyelven → a közös `formatDay`; és a kontraktus egy felirata
   kisbetűvel állt („ajánlat kiküldve"), a kódban nagybetűvel.

### ⑤ AZ ŐR

`scripts/booking-offer-check.mts` — 110 állítás, eldobható fixtúra, valódi DB + HTTP + böngésző,
mindkét méreten; a lánc a **kézbesített levelek linkjein** halad. ⭐ Pozitív kontroll: az árazott
kérés változatlanul a régi, koppintásos levelet kapja (különben a levél-olvasás vak). Piros
kontrollok kézzel lefuttatva: a koppintásos zár kivétele → a kérés ár nélkül „accepted", 5 nap
foglalt, és az őr pirosra megy; a szerző-javítás visszarontása → 4 bukás.
A `season-rule-check` két teljes naptári évet jár (730 nap) független referenciához, és
utó-feltétellel követeli, hogy minden réteg nyerjen valahol.

### ⑦ A SÚGÓ-FORDÍTÁS COMMIT-KAPUJA — ugyanarra jutottunk, párhuzamosan

A commitom a diff-szűkített súgó-fordítás kapun nem tudott átmenni: a `kb-translate` 6
nyelvből 6-ot frissített, 3 perccel később 2 maradt friss, a `kb_translation` sorokon két
forrás-lenyomat (`c573…` az enyém, `738e…` a main-é) váltakozott. **A mért mechanizmus:**
minden más fa MINDEN nem magyar lap-renderelésnél (`prepareMailLang` → `ensureLanguagePack`,
`src/i18n/mail.ts`) a SAJÁT, régi magyar forrásából újrafordítja az elavultnak látott cikket.
A tulaj: *„ez szerintem ugyanaz a fajta probléma, mint a nyelvi fordítással"* — és a döntést
közben egy párhuzamos szál meghozta és landolta (`d6d7c9c1`, ADR-0207 módosítás: a commit
nem kér fordítást, a deploy GATE 5 az éles DB-n). Az én kapu-változatomat eldobtam, az övé él.
⚠️ Nyitva: az `ensureLanguagePack` dev-ben is „javít" — a dev-DB fordításai zajosak maradnak.

### ⑥ AMI NYITVA MARAD

1. **ADR-0208 ⑥.2** (a „nincs ár" mint kimondott döntés), **⑥.3** (új egységnél kérje az árat),
   **⑥.4** (ismétlődő emlékeztető) — külön tételek. ⚠️ A ⑥.4 egy része itt megvalósult: a
   DÁTUMOS ár lejárat előtti emlékeztetője. Az „X napja hiányos" emlékeztető nem.
2. **ADR-0208 ⑥.5** — az évhez kötött SZEZON a szabályban és az adatban kész, a **felülete**
   (az Árazás lapon „Főszezon 2027") és a szezon záró napja utáni nudge nincs.
3. A vendég-lap „Vissza a szállás oldalára" gombjának szövege felül ül — a közös
   `guestPageShell` meglévő stílusa (a lemondó lapokon is), nem ez a munka hozta.
4. A tulaj-oldali tokenes lapokon (döntés, ajánlat) megjelenik a Barion süti-sáv — meglévő
   viselkedés (`GUEST_PAGE_ROUTES` csak a vendég-lapokat jelöli), külön kérdés.
5. ⛔ **A `configurator-placement-check` a `main`-en PIROS** (2026-09-23, ettől a munkától
   függetlenül: a tiszta `origin/main`-en is bukik — „a galéria látszik a nem-galériás
   csomagban”). A bisect egy csak-doksi commitra mutatott, tehát a bukás nem determinisztikus
   vagy környezetfüggő. A feature-commit a tulaj kimondott engedélyével `--no-verify`-jal ment
   be, miután minden más érintett őr kézzel lefutott és zöld volt. Külön szálnak.
