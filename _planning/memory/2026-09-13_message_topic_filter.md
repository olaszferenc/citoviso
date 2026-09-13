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

## Utószál ugyanaznap — a „Mind olvasott" (tulaj-döntés, ADR-0127 ⑦)

A zárásnál nyitottként jelzett tételre a tulaj azonnal döntött: **a gomb csak a szűrt
listát jelölje olvasottnak.**

- A hatókör **ugyanaz a `projectMessages()`**, amiből a lista renderelődik. ⛔ A szűrőt
  NEM írtam SQL-be: az a predikátum MÁSODIK PÉLDÁNYA lenne (az ékezet-hajtogató keresés
  a `C` collation alatt nem fejezhető ki SQL-ben, a téma a regiszterből jön), és a két
  példány elcsúszása pontosan ez a hiba lenne újra. JS-ben dől el a hatókör, `UPDATE`
  id-listával, `tenant_id`-vel a WHERE-ben.
- ⭐ **A viselkedés-változás magával hozta a FELIRATOT:** szűrés nélkül
  „Mind olvasott (114)", szűrve „A szűrt 77 olvasott". **Egy gomb, ami a HELYES sorokat
  jelöli meg, de „Mind olvasott"-at ír, ugyanúgy hazudik** — a szám ugyanabból az
  `unreadCount`-ból jön, ami az „Olvasatlan" chipen áll.
- A POST viszi a szűrőt, a válasz visszatér bele — de az „Olvasatlan" kapcsolót NEM
  (épp most tüntettük el a tartalmát, üres listára érkezne). Üres hatókörben a gomb eltűnik.
- ⚠️ **Az őr fixture-je gyenge volt:** egyetlen olvasatlan sorral a „Mind olvasott (1)" és
  „A szűrt 1 olvasott" UGYANAZT a számot adta, tehát a mérés nem tudta volna
  megkülönböztetni a hibás ágat. Négy olvasatlanra bővítve (teljes 4 vs. szűrt 3).
  Önteszt: 11 → **14 sértés**.
- ⚠️ **Az általam előző körben írt súgó-figyelmeztetés ezzel HAMISSÁ vált** („mindig a
  teljes postaládát jelöli olvasottnak") — átírva. A §J.24 label-drift őr közben
  blokkolt, mert a behelyettesített számot tartalmazó feliratot (`Mind olvasott (114)`)
  nem tudja igazolni a `{n}`-es forráson: a konkrét számos példa nem lehet **kötő** idézet.
- **Mérve a valódi DB-úton**, a közös parkon és **pontosan visszaállítva**: 114
  olvasatlanból a „Fiók" hatókörre 1 billent át, a többi 113 érintetlen; a visszaállítás
  után ugyanaz a 114 id.

## Harmadik kör — a park takarítása (tulaj-utasításra)

**Eszköz: `scripts/purge-orphan-messages.mts`** (dry-run alapból, `--go` írja).
Eredmény: az ELEK park **114 → 70** üzenet, nulla árva.

- ⛔⛔ **A SAJÁT LELTÁR-SOROM VOLT HAMIS, és a tulaj azt idézte vissza.** A
  `MEMORY.md`-be „a park **114 árva** üzenete" került, holott a session-jegyzetben
  helyesen 35 állt. Újramérve: **44 az árva** (35 foglalás + 9 számla), a maradék 70
  ÉRVÉNYES rekord — köztük 50 dunning, aminek eleve nincs `related_id`-je, tehát
  definíció szerint nem lehet árva. **„Sok belőle" ≠ „árva".** Ha a leltár-sort
  elhiszem, 70 valós rekordot töröltem volna. Ez a
  [[feedback_inventory_line_is_not_a_measurement]] a saját írásomra alkalmazva.
- ⛔ **A DB-széles sweep 46-ot talált, nem 44-et:** a 2 többlet a **Dencs Apartmanház**
  tenanté — a tulaj saját tenantja, nem park-törmelék (a `reset-elek-billing-clock.mts`
  külön biztosítékként sorolja fel, hogy érintetlen marad). A jóváhagyás a PARKRA szólt,
  ezért a script alapból az ELEK tenantra szűkít, és **hangosan kiírja**, mit hagyott ki
  (`--all-tenants` tágít). Néma korlát „mindent lefedtem"-nek olvasódik.
- **Az eszköz biztosítékai** (a `reset-elek-billing-clock.mts` mintája): csak NEM-NULL
  `related_id`, csak feloldható horgony-fajta (ismeretlen → kihagyva és jelentve),
  **független őrsor** a törlés előtt (a listát újra megvizsgálja; ha egyetlen nem-árva
  sor benne van, nem ír), JSON-mentés sha256-tal ÍRÁS ELŐTT, egy tranzakció, **törlés
  ID SZERINT** (a predikátum újrafuttatása a DELETE-ben olyat is elvihetne, ami a
  mentésben nincs), végül visszaolvasás.
- **Igazolva:** park 0 árva · Dencs érintetlen (5 sor) · a mentés `sha256 -c` RENDBEN,
  44 sor, mind teljes tartalommal → visszaállítható.
- ⚠️ A parkban most **0 foglalás-üzenet** van (mind árva volt) — a „Foglalások" chip
  0-t mutat, amíg a következő Elek FK-007 kör újakat nem termel. Ez helyes, nem hiba.

## Nyitva marad
- Élesítés NINCS (§0.3).
