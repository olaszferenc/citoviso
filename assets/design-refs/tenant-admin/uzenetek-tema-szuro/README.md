# Üzenetek fül — TÉMA-SZŰRŐ (jóváhagyott terv, 2026-09-13)

**Változat: „A — két sor: téma fölül, szűkítés alul".** Tulaj jóváhagyta 2026-09-13-án,
a §2b kapun (három működő mock, mindkét méret, végigkattintva).
Kép: `uz-a-mobil.png` (390px) · `uz-a-asztali.png` (1280px) · vázlat: `plan.html`.

Ez a fájl a MEGVALÓSÍTÁS KONTRAKTUSA: az alábbi pontok **kötnek** (elvárt viselkedés),
nem stílus-javaslatok. Kiegészíti az ADR-0084 és az ADR-0125 tervét, nem váltja fel.

---

## 0. Miért létezik — és mi NEM ez

Az FK-001 **E2** bejelentés („114 olvasatlan, ismétlődő foglalás-sorok zaja") a
**szálba csukást** javasolta. Mérve **nem működik**: a 35 foglalás-üzenet 34 KÜLÖNBÖZŐ
foglalási kéréshez tartozik (33 egytagú szál, 1 kéttagú), tehát az összecsukás
**35 → 34 sort** adna. Az ismétlődés nem a szálon *belül* van, hanem a szálak *között* —
10 Elek-kör küldte be újra ugyanazt a két vendéget. Részletes mérés: ADR-0127.

Amit viszont a mérés VALÓBAN talált: a szűrő-sáv csak **szállításról** (E-mail/SMS) és
**olvasottságról** tudott — arról nem, hogy az üzenet **miről szól**. Egy reális éles
fiókban a forgalom ~61%-a foglalás-értesítő, tehát „mutasd a számlázást" csak
kereső-szóval ment. Ez a terv EZT oldja meg.

⛔ **Az ADR-0125 „A — jelölés a soron" viselkedése VÁLTOZATLAN.** A `Túlhaladott` /
`Ez a legfrissebb` jelölés, a `Felülírta: „…" · időpont` sor és a szál-pozíció
levezetése érintetlen. Ez a terv szűrőt ad hozzá, nem jelölést vesz el.

---

## 1. Amit a terv KÖT

### ① A téma LEVEZETETT, nem felirat

A chip **feliratát** és a chip **predikátumát** ugyanaz a regiszter adja
(`src/tenant/messageTopics.ts`): egy `kind → téma` leképezés, amiből a szűrés ÉS a
darabszám ÉS a felirat származik. Egy chip így szerkezetileg nem tud olyan témát
megnevezni, amit nem olvas (`feedback_label_must_derive_from_predicate`, a
`leadFilters.ts` és az `invoiceItem.ts` mintája).

A leképezés **TELJES**: a séma mind a 10 `kind`-ja pontosan egy témába esik. Ezt a
típus kényszeríti (`Record<MessageKind, MessageTopic>`), nem a figyelem — új `kind`
felvétele fordítási hibát ad, amíg nincs témája.

| Téma | `kind`-ok |
|---|---|
| **Foglalások** | `booking` |
| **Számlázás** | `invoice`, `dunning` |
| **A honlapom** | `site_live`, `domain`, `multilang`, `review`, `traffic` |
| **Fiók** | `credentials`, `other` |

A négy téma tulajdonosi döntés (2026-09-13): a „Fiók" ritka, de MÁS kérdés
(belépés, hozzáférés), mint a honlap működése.

### ② KÉT SOR, két külön kérdés — és EGYÜTT hatnak

- **1. sor — „Miről szól":** `Mind` + a négy téma-chip. Egymást **kizárják**.
- **2. sor — „Szűkítés":** `E-mail`, `SMS`, `Olvasatlan`. **Kapcsolók**, nem kizáróak
  a témával: „Számlázás" + „Olvasatlan" egyszerre él.
- A két sor a keresőmező ALATT áll, a lista FÖLÖTT.
- A sor-feliratok (`MIRŐL SZÓL`, `SZŰKÍTÉS`) kötnek: a két sor két külön kérdés, és
  a felirat nélkül a felhasználó nem tudná, miért nem zárja ki egymást a nyolc chip.

⛔ **Ez felülírja a mai egyparaméteres `f=` szűrőt** (`mind|email|sms|olvasatlan`,
egymást kizárva). A régi `f=` érték **bemenetként tovább él** (`f=sms` → csatorna=SMS,
`f=olvasatlan` → olvasatlan kapcsoló be), hogy a meglévő linkek és a súgó-képek ne
törjenek — de a felület már a három új paramétert írja.

### ③ A SZÁMLÁLÓ AZT MONDJA, AMIT KAPNI FOG

Minden téma-chip darabszámot visel, és ez a szám az **éppen aktív többi szűrővel
együtt** számol (csatorna + olvasatlan + keresés). Ha az „Olvasatlan" be van kapcsolva,
a „Foglalások 3" azt jelenti, hogy 3 olvasatlan foglalás van — nem azt, hogy 11 foglalás.

**Ez kötő szabály:** a szám ugyanabból a predikátumból származik, ami a listát szűri,
egyetlen dimenziót felülírva. Két külön számláló-ág = két igazság egy képernyőn
(`feedback_one_rule_two_copies`). Ugyanez áll az „Olvasatlan" chip számára.

### ④ A TALÁLAT-SOR MEGNEVEZI A SZŰRÉST

A lista fölött: `x / N üzenet — téma: Számlázás · csatorna: SMS · csak olvasatlan · keresés: „…"`.
Csak az aktív dimenziók szerepelnek. Egy puszta szám nem mondja meg, mit szűrtünk ki
(§B.17); a `18 / 18 üzenet` szűrés nélkül is kiíródik, hogy legyen mihez viszonyítani.

### ⑤ A TÉMA-SZŰRÉS A POZICIONÁLÁS UTÁN FUT

Ugyanaz a szabály, mint az ADR-0125 ⑥-nál: a szál-pozíciót (`Túlhaladott` /
`Ez a legfrissebb`) a TELJES postaládán kell eldönteni, a szűrés ELŐTT. Témára szűrve
egy „Számlázás" üzenet különben legfrissebbnek látszana, mert az őt felülíró társa
kiesett — **a szűrő termelné a hazugságot.** A téma-szűrés tehát a
`listTenantMessages()` JS-ágába kerül, a `positionThreads()` UTÁN.

### ⑥ Mobil és asztali — KÉT külön elrendezés

- **Asztali (≥700px):** mindkét sor egyetlen sorba fér, a kereső teljes szélességben
  fölöttük. Lásd `uz-a-asztali.png`.
- **Mobil (390px):** mindkét sor **SORBA TÖR** — mind a négy téma és mindhárom
  szűkítő látszik. Lásd `uz-a-mobil.png`.

⛔ **Vízszintes görgetés TILOS a téma-soron.** Az első vázlatomban görgethető volt, és
a képen mérve a „Számlázás / A honlapom / Fiók" a keret alatt maradt. **Egy elrejtett
szűrő ugyanaz a hibaosztály, mint maga a bejelentés** („nem találom, ami fontos").

### ⑦ Üres állapot

Ha a szűrés nulla sort ad: `Nincs a szűrésnek megfelelő üzenet. / Próbáljon más szűrőt
vagy keresőszót.` (a mai szöveg, változatlanul). A szűrő-sáv ilyenkor is LÁTSZIK —
különben nincs mit visszakapcsolni.

### ⑧ A „MIND OLVASOTT" ANNYIRA HAT, AMENNYIT A LISTA MUTAT

Tulaj-döntés **2026-09-13**, a terv szállítása utáni körben (ADR-0127 ⑦). A gomb a
**szűrt** listára hat, nem a teljes postaládára — eddig többet tett, mint amit a
képernyő állított.

- A hatókör **ugyanaz a `projectMessages()`**, amiből a lista renderelődik. ⛔ A szűrő
  SQL-be írása a predikátum MÁSODIK PÉLDÁNYA lenne (az ékezet-hajtogató keresés a `C`
  collation alatt nem fejezhető ki SQL-ben, a téma pedig a regiszterből jön) — a hatókör
  ezért JS-ben dől el, az `UPDATE` id-lista alapján fut, `tenant_id`-vel a WHERE-ben.
- **A FELIRAT KIMONDJA A SZÁMOT ÉS A HATÓKÖRT:** szűrés nélkül `Mind olvasott (114)`,
  szűrve `A szűrt 77 olvasott`. A szám ugyanabból az `unreadCount`-ból jön, ami az
  „Olvasatlan" chipen áll. **Egy gomb, ami a helyes sorokat jelöli meg, de „Mind
  olvasott"-at ír, ugyanúgy hazudik.**
- A POST **viszi a szűrőt** (rejtett mezők), a válasz visszatér a szűrésbe — de az
  „Olvasatlan" kapcsolót NEM viszi vissza (épp most tüntettük el a tartalmát).
- Ha a hatókörben nincs olvasatlan, **a gomb eltűnik** (nem kínálunk üres műveletet).

⚠️ A `plan.html` ezt a gombot még a régi, „Mind olvasott" alakban mutatja — a vázlat a
téma-szűrőről szólt, a gomb-döntés utána született. A KÖTŐ leírás ez a szakasz.

### ⑨ i18n

Minden új felirat `T(lang, "…")`. A `messageTopics.ts` copy-hordozó fájl, ezért
KÖTELEZŐEN felkerül a `scripts/i18n-sources.mjs` listájára **ÉS** a `kb-check.mts`
tenant-korpuszába (`feedback_guard_scope_is_the_doctrine` — ez a hiba háromszor ütött be).

---

## 2. Amit a terv NEM köt

- A `plan.html` **minta-adata** egy reális éles fiók 5 hete (18 sor, 11 foglalás) —
  nem a park állapota, és nem kötelező adatmennyiség.
- A `plan.html` egyetlen SMS sora a csatorna-szűrő bemutatásához kellett; a dev-parkban
  ma nulla SMS van.
- A sor-felirat pontos tipográfiája (`MIRŐL SZÓL` verzál) stílus, nem kontraktus.
- A `plan.html` fejléce (magyarázó doboz, méret-váltó) a MOCK kerete, nem megy a termékbe.

---

## 3. Amit a terv-kör közben MÉRTEM

- ⚠️ **A saját tervem első vágása a bejelentett hibát ismételte meg** (görgethető
  téma-sor mobilon → három téma nem látszik). A KÉP fogta meg, nem a kód-olvasás —
  ezért kötelező a §2b 2. pontja.
- ⚠️ **A mock @media-t nem használhat**: a méret-váltó egy 390px-es keretet állít elő
  SZÉLES ablakban, és a `@media` az ablakhoz kötődik, tehát a keret csak keskenyedne,
  de nem rendezné át. A vázlat a valódi CSS `@media(min-width:…)` szabályait
  `@container`-re fordítja (`reference_mock_size_switch_starts_from_viewport`).
- ⚠️ **A viselkedés-ellenőrzőm saját várakozása volt hibás** egy ponton: „Számlázás +
  SMS = 0 sort" vártam, holott a dunning SMS oda esik (=1). A független referenciából
  SZÁMOLT elvárás javította ki — kézzel beírt szám az orákulumban pontosan úgy néz ki,
  mint egy termék-hiba (`booking-price-coherence-check` tanulsága).
