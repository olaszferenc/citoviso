# 2026-09-13 — A szálba csukás nem válasz; a szűrő tudja meg, MIRŐL szól

**Döntés:** ADR-0127. **Kontraktus:** `assets/design-refs/tenant-admin/uzenetek-tema-szuro/`.
Előzmény: ADR-0125 (FK-001 E1/Z1/Z2) kimondottan nyitva hagyott **E2** tétele.

## A nap lényege

**A feladat egy megoldást kért, és a mérés a megoldást cáfolta, nem a problémát.**
Az E2 bejelentés („114 olvasatlan, ismétlődő foglalás-sorok zaja") a foglalás-sorok
**szálba csukását** javasolta. Megmérve **35 → 34 sort** ad. Egyet.

- A 35 foglalás-üzenet **34 KÜLÖNBÖZŐ foglalási kéréshez** tartozik: 33 egytagú szál,
  1 kéttagú. Az ismétlődés nem a szálon *belül* van, hanem a szálak *között* — ugyanaz
  a tárgy **10 különböző `related_id`-n**, mert 10 Elek FK-007 kör küldte be újra
  ugyanazt a két vendéget. Összecsukni őket **valós, különálló foglalások elrejtése**
  lett volna.
- **Szerkezeti plafon:** egy foglalási kérés legfeljebb **2** üzenetet termel (érkezés +
  egy záró esemény). Elfogadásnál 1. A foglalás-szál sosem lehet 2-nél hosszabb.
- A teljes 50 sornyi összecsukás-nyereség a **dunningból** jön — pontosan abból, amire
  a tulaj az ADR-0125-ben a „jelölés a soron"-t választotta.
- **Park-zaj, két független bizonyítékkal:** ① 114-ből **112 üzenet 3 nap alatt**
  keletkezett ② **mind a 35 foglalás-üzenet ÁRVA** (join: 35 / 0 — a kör-újraindítás
  törli a `booking_request`-et, az üzenet-naplót nem).
- Az „elnyomja a fontosat" a kirenderelt lapon **nem mérhető**: a legfrissebb számla az
  **1. sor** mindkét méreten (mobil y=362px, asztali y=243px).

## Amit a mérés VALÓBAN talált

A szűrő-sáv csak **szállításról** (E-mail/SMS) és **olvasottságról** tudott — arról nem,
hogy az üzenet **miről szól**. Reális éles fiókban a postaláda ~61%-a foglalás-értesítő,
tehát „mutasd a számlázást" csak kereső-szóval ment. A tulaj mindkettőt kérte: az E2
lezárását ADR-ként **és** a téma-szűrőt.

## Szállítva

- `src/tenant/messageTopics.ts` — `kind → téma` regiszter, **TOTÁLIS a típus által**
  (`Record<MessageKind, MessageTopic>`: új kind téma nélkül fordítási hiba). Négy téma
  (tulaj-döntés): Foglalások · Számlázás · A honlapom · Fiók. A **felirat és a
  predikátum egy táblából** él.
- **Két soros sáv** (§2b „A" változat, 3 működő mockból): „Miről szól" (kizáró témák) +
  „Szűkítés" (csatorna/olvasottság **kapcsolók**, a témával **együtt** hatnak). Ez
  felülírja a mai egyparaméteres `f=`-et, amiben „olvasatlan számlázás" megfogalmazhatatlan
  volt; a régi `f=` **bemenetként tovább él**.
- **Egy predikátum** (`projectMessages`) adja a listát ÉS minden chip számát, egy
  dimenziót felülírva → a szám azt ígéri, amit a kattintás szállít.
- Találat-sor: `77 / 114 üzenet — téma: Számlázás`.

## Tanulságok

- ⛔⛔ **A saját tervem első vágása a bejelentett hibát ismételte meg:** a téma-sor
  mobilon vízszintesen görgethető volt, és a képen mérve a „Számlázás / A honlapom /
  Fiók" a keret alatt maradt. **Egy elrejtett szűrő ugyanaz a hibaosztály, mint a
  „nem találom, ami fontos".** A KÉP fogta meg, nem a kód-olvasás.
- ⭐ **Egy trivializálódott állítást kicseréltem, nem hagytam benne.** Írtam egy őr-sort
  arra, hogy a téma-szűrés nem billenti át a szál-jelölést — aztán rájöttem, hogy a szál
  kulcsa a `kind`-ból származik és a téma is annak függvénye, tehát **szerkezetileg
  lehetetlen** kettévágni egy szálat témával. Az állítás sosem tudott volna pirosra menni.
  Helyette az INVARIÁNST írtam ki állításként (minden szál egy témába esik), ami viszont
  pirosodik, ha egy jövőbeli szál-szabály kind-okon átívelne.
- ⚠️ **A saját viselkedés-ellenőrzőm elvárása volt hibás**, nem a mock: „Számlázás + SMS
  = 0 sort" vártam, holott a dunning SMS oda esik. Kézzel beírt szám az orákulumban
  pontosan úgy néz ki, mint egy termék-hiba → az elvárást a független referenciából
  SZÁMOLTATOM.
- ⛔ **A tudásbázis-őr KÉT körben talált valós hibát a saját súgó-szövegemben**, és
  mind a három első kifogása igaz volt — **mérve mindháromban a VISELKEDÉS volt helyes,
  a SZÖVEG hamis**: ① „Mind — minden üzenet" (valójában csak a témát engedi el, a
  szűkítők maradnak) ② „minden gombon ott a darabszám" (az E-mail/SMS chipen nincs)
  ③ az Olvasatlan chip metszet-száma vs. a menü-jelvény teljes száma vezetés nélkül.
  A második körben a javításom **túl szűkre** fogalmazott („csak a témán belül számol"),
  holott a csatornát és a keresőszót is beszámítja.
- ⚠️ **Az új darabszámok egy RÉGI rést tettek láthatóvá:** a súgó-kép fixture-jében
  nulla foglalás-üzenet volt, pedig az entry-nek egész szakasza szól a vendég-érdeklődésről
  („Foglalások 0"). Pótolva — és a minta OLVASOTT, hogy a nav-jelvény ne mozduljon, mert
  az 14 független súgó-képet írt volna át.
- ⚠️ Az `admin-bookings` súgó-kép a **dátumváltás** miatt sodródik (naptár-render),
  nem az én változásomtól — visszaállítva, hogy a commit szűk maradjon.

## Őr

`scripts/admin-list-labels-check.mts` ⑥ — a KIRENDERELT sávon és listán mér, a valódi
adat-úttal (`projectMessages`, DB nélkül, pre-commit-kész), **független referenciával**
(a `kind → téma` táblát az őr kézzel írja ki). Negatív önteszt: **11 sértés**, ebből 4 az
új szakaszé; a szerkezeti állításokhoz (görgetés, sor-feliratok) az önteszt a markupot
rontja el, és ezt ki is mondja: az a DETEKTORT bizonyítja, nem a termék-utat.

## Nyitva marad

- A **„Mind olvasott"** gomb a TELJES postaládát jelöli olvasottnak, szűrt lista mellett
  is. Nem regresszió (a szűrés eddig is létezett), és a súgó most kimondja — de a
  téma-szűrő ezt sokkal elérhetőbbé teszi. Ha zavaró: külön tulaj-döntés.
- A park 114 árva/ismétlődő üzenete **érintetlen** (a dev DB közös, más szálak mérhetnek
  rajta). A takarítás módja: a 35 olyan `tenant_message`, aminek a `related_id`-je nem
  létező `booking_request`-re mutat — mentés sha256-tal, egy tranzakció, dry-run alapból
  (`reset-elek-billing-clock.mts` mintája).
- Élesítés NINCS (§0.3).
