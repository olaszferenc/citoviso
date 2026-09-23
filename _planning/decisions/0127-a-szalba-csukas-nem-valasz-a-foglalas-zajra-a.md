## ADR-0127 — A szálba csukás NEM válasz a foglalás-zajra; a szűrő tudja meg, MIRŐL szól (2026-09-13)

**Kontextus.** Az ADR-0125 kimondottan nyitva hagyta az Elek FK-001 **E2** leletét
(„114 olvasatlan, ismétlődő foglalás-sorok zaja"), azzal, hogy a §2b kör „B — szálba
csukva" változata válaszolt volna rá, de a tulaj az „A"-t választotta. A tétel most
újra elő lett véve, azzal a kikötéssel, hogy **először MÉRNI kell.**

**A mérés cáfolta a javasolt megoldást.** A közös dev-park ELEK-postaládáján, a
`positionThreads()` valódi szabályával számolva:

| kind | sor | szálak | összecsukva | nyereség |
|---|---|---|---|---|
| dunning | 50 | 1 | 1 | **−49** |
| **booking** | **35** | **34** | **34** | **−1** |
| invoice | 27 | – | 27 | 0 |
| multilang + credentials | 2 | – | 2 | 0 |

- **A foglalás-sorok szálba csukása 35 → 34 sort ad. Egyet.** A teljes 50 sornyi
  megtakarítás a **dunningból** jön — pontosan abból, amire a tulaj az ADR-0125-ben
  a „jelölés a soron" változatot választotta, és ami ezért érintetlen marad.
- **Miért nem működik:** az ismétlődés nem a szálon *belül* van, hanem a szálak
  *között*. A 35 üzenet **34 KÜLÖNBÖZŐ foglalási kéréshez** tartozik (33 egytagú szál,
  1 kéttagú); ugyanaz a tárgy (`Foglalási kérés: Elek Vendég Kettő, 09.22–24`)
  **10 különböző `related_id`-n** áll, mert 10 Elek FK-007 kör küldte be újra ugyanazt
  a két vendéget. Összecsukni őket nem zaj-szűrés lenne, hanem **valós, különálló
  foglalások elrejtése**.
- **Szerkezeti plafon:** az öt kibocsátót végigolvasva egy foglalási kérés
  **legfeljebb 2** üzenetet termel — érkezés (`requests.ts:665`) + egy záró esemény
  (vendég lemondta `:1171` / lejárt `:1342`). Elfogadásnál csak 1, mert azt a tulaj
  maga tette. **A foglalás-szál sosem lehet 2 tagnál hosszabb.**
- **A mennyiség park-zaj, két független bizonyítékkal:** ① a 114-ből **112 üzenet
  3 nap alatt** keletkezett (09-10 → 09-12) — élő fiók nem kap ennyit; ② **mind a 35
  foglalás-üzenet ÁRVA**: a `related_id`-je olyan `booking_request`-re mutat, ami már
  nem létezik (join: 35 / 0 találat). A kör-újraindítás törli a foglalásokat, az
  üzenet-naplót nem.
- **Az „elnyomja a fontos üzeneteket" a kirenderelt lapon nem mérhető:** a lista
  időrendi, és a legfrissebb számla az **1. sor** mindkét méreten (mobil y=362px,
  asztali y=243px).

**Döntés ①: az E2 mint termék-hiba LEZÁRVA.** A szálba csukás nem épül meg. Egy
javítás, ami 114-ből 1 sort nyer, miközben valós adatot rejtene el, nem javítás. Az
ADR-0125 ⑤ „jelölés a soron" viselkedése **változatlan**.

**Döntés ②: amit a mérés VALÓBAN talált — a szűrő nem tudta, MIRŐL szól az üzenet.**
A sáv csak **szállításról** (E-mail/SMS) és **olvasottságról** tudott. Egy reális éles
fiókban a postaláda ~61%-a foglalás-értesítő, tehát „mutasd a számlázást" csak
kereső-szóval ment. Ez a rés valós, és ez épül meg.

1. **A TÉMA LEVEZETETT, NEM FELIRAT.** Egy regiszter (`src/tenant/messageTopics.ts`)
   képezi le a `kind`-ot témára; a chip **feliratát ÉS a predikátumát** ugyanaz a tábla
   adja. A leképezés **TOTÁLIS a típus által** (`Record<MessageKind, MessageTopic>`):
   új `kind` téma nélkül fordítási hiba. Négy téma (tulaj-döntés):
   **Foglalások** (`booking`) · **Számlázás** (`invoice`, `dunning`) · **A honlapom**
   (`site_live`, `domain`, `multilang`, `review`, `traffic`) · **Fiók**
   (`credentials`, `other`). Ez a `leadFilters.ts` / `invoiceItem.ts` mintája.
2. **KÉT SOR, KÉT KÉRDÉS — ÉS EGYÜTT HATNAK** (§2b „A" változat, 3 működő mockból).
   „Miről szól": egymást kizáró téma-chipek. „Szűkítés": csatorna/olvasottság
   **kapcsolók**. ⛔ Ez **felülírja** a mai egyparaméteres `f=` szűrőt, amiben az
   „Olvasatlan" kizárta a többit — „olvasatlan számlázás" megfogalmazhatatlan volt.
   A régi `f=` **bemenetként tovább él** (súgó-képek, könyvjelzők nem törnek).
3. **A SZÁMLÁLÓ AZT MONDJA, AMIT KAPNI FOG.** Minden chip száma az **éppen aktív többi
   szűrővel együtt** számol, mert **egyetlen predikátumból** származik, egy dimenziót
   felülírva (`projectMessages()`). Külön számláló-ág = két igazság egy képernyőn
   (`feedback_one_rule_two_copies`), és egy szám, ami mást ígér, mint amit a kattintás
   szállít, pontosan az a hiba, amit ez a szűrő orvosolni hivatott.
4. **A TALÁLAT-SOR MEGNEVEZI A SZŰRÉST** (`77 / 114 üzenet — téma: Számlázás`). Egy
   puszta szám nem mondja meg, mi maradt ki (§B.17).
5. **A SZŰRÉS A POZICIONÁLÁS UTÁN FUT** — az ADR-0125 ⑥ kiterjesztve az új dimenzióra.
   ⭐ Mérve: a téma-szűrés **szerkezetileg** biztonságos a szálakra, mert a szál kulcsa
   a `kind`-ból származik és a téma is annak függvénye, tehát egy szál minden tagja
   azonos témájú. Ezt az őr **állításként** rögzíti, nem hallgatólagos feltevésként.
6. ⛔ **A TÉMA-SOR NEM GÖRGET VÍZSZINTESEN.** Az első vázlatomban görgethető volt, és
   390px-en mérve a „Számlázás / A honlapom / Fiók" a keret alatt maradt. **Egy
   elrejtett szűrő ugyanaz a hibaosztály, mint a bejelentés, ami létrehozta.**

7. **A „MIND OLVASOTT" ANNYIRA HAT, AMENNYIT A LISTA MUTAT** (tulaj-döntés, 2026-09-13,
   a ②-t szállító kör után). Eddig — és a szűrő bevezetésével egyre elérhetőbben —
   szűrt lista mellett is a TELJES postaládát jelölte olvasottnak: a gomb **többet tett,
   mint amit a képernyő állított** (`feedback_screen_must_not_shrink_or_decide`).
   - A hatókör **ugyanaz a `projectMessages()`**, amiből a lista renderelődik. ⛔ A szűrő
     SQL-be írása egy MÁSODIK PÉLDÁNYA lenne a predikátumnak (az ékezet-hajtogató keresés
     a `C` collation alatt nem fejezhető ki SQL-ben, a téma pedig a regiszterből jön), és
     a két példány elcsúszása pontosan ez a hiba lenne újra — ezért a hatókör JS-ben dől
     el, az `UPDATE` pedig id-lista alapján fut, `tenant_id`-vel a WHERE-ben.
   - **A FELIRAT KIMONDJA A SZÁMOT és a hatókört:** szűrés nélkül „Mind olvasott (114)",
     szűrve „A szűrt 77 olvasott". A szám ugyanabból az `unreadCount`-ból jön, ami az
     „Olvasatlan" chipen áll — a gomb szerkezetileg nem ígérhet mást, mint amit a szűrő ad.
     Egy gomb, ami a HELYES sorokat jelöli meg, de „Mind olvasott"-at ír, ugyanúgy hazudik.
   - A POST viszi a szűrőt (rejtett mezők), a válasz **visszatér a szűrésbe** — de az
     „Olvasatlan" kapcsolót NEM viszi vissza (épp most tüntettük el a tartalmát, üres
     listára érkezne, magyarázat nélkül). Ha a hatókörben nincs olvasatlan, a gomb eltűnik.
   - Mérve a valódi DB-úton, a közös parkon (és pontosan visszaállítva): 114 olvasatlanból
     a „Fiók" hatókörre 1 billent át, a többi 113 érintetlen.

**Miért nem fogta meg ezt semmi eddig.** A szűrő HELYESEN működött végig — csak nem
azt a kérdést tudta, amit a tulaj feltett. Ez nem hiba, hanem HIÁNY, és hiányt egyetlen
teszt sem jelez. Ezért mér az őr (`scripts/admin-list-labels-check.mts` ⑥) a
**KIRENDERELT** sávon és listán, a **valódi adat-úttal** (`projectMessages`, DB nélkül),
**független referenciával** (a `kind → téma` táblát az őr kézzel írja ki, nem a
`messageTopics.ts`-ből importálja — `feedback_guard_must_not_borrow_its_subject`).
Negatív kontroll: **11 sértés**, ebből 4 az új szakaszé.

**Kapuk.** `admin-list-labels-check` (pre-commit) · `messageTopics.ts` felvéve az
`i18n-sources` listájára **ÉS** a `kb-check` tenant-korpuszába (egy copy-hordozó fájl
mindkettőn KÖTELEZŐ — `feedback_guard_scope_is_the_doctrine`, ez a hiba háromszor ütött be).

**Kontraktus:** `assets/design-refs/tenant-admin/uzenetek-tema-szuro/`
(tulaj jóváhagyta 2026-09-13; kiegészíti az ADR-0084 és ADR-0125 tervét).

**Visszafordíthatóság:** 🔄 — felület- és lekérdezés-szintű, nulla migráció, nulla
adat-mozdulat. A régi `f=` paraméter bemenetként tovább él.
