# Tenant-admin — Dokumentumok tétel-megnevezés + Üzenetek csatorna/túlhaladottság

**Státusz:** a tulaj jóváhagyta (2026-09-12) — **„A" változat** (jelölés a soron) +
a *tétel a főcímben* számla-sor-elrendezés · **Kapu:** CLAUDE.md §2b
<!-- ⚠️ A változat NEVÉT szándékosan NEM `**„…”**` alakban írjuk: a
     contract-drift-check azt KÖTŐ FELIRATNAK olvassa, és egy tervezői
     opció-nevet keresne a szállított HTML-ben. A kötő feliratok lentebb állnak. -->

**Kiváltó mérés:** Elek FK-001 (`elek/runs/FK-001-2026-09-12T10-27-19/LELETEK.md`) — E1, Z1, Z2.

**Ez a fájl KONTRAKTUS, nem stílus-javaslat.** A megvalósítást ehhez mérjük; a csendes
eltérés ugyanolyan súlyos, mint a kapu megkerülése.

- Terv (kattintható, működő): `plan.html`
- Képek: `{dok,uzenet,szal}-{mobile,desktop}.png`
- Ez a lap **kiegészíti**, nem váltja fel a `dokumentumok-uzenetek-a-README.md`-t
  (ADR-0084). Ami ott áll, az érvényben marad — kivéve az alább kimondott két pontot.

---

## 1. Amit a terv KÖT

### Dokumentumok → Számla-sor

- **A FŐCÍM a TÉTEL MEGNEVEZÉSE**, nem a számlaszám.
  ⛔ Ez felülírja az ADR-0084 README „Számla-sor: számlaszám · dátum…" sorrendjét —
  tulajdonosi döntés, 2026-09-12.
- Alatta halványan: **`<számlaszám> · <dátum>`** (és időszak, ha van és eltér).
- A tétel-megnevezés **LEVEZETETT**, sosem a sor mellé írt szöveg: a forrása az
  `order_intent.kind` + `billing_period` — ugyanaz a két oszlop, amiből az ÖSSZEG is
  származik (`src/billing/invoiceItem.ts`). Egy sor így szerkezetileg nem tud olyan
  terméket megnevezni, amit nem számláztunk.
- A **„Számlázás folyamatban"** (bizonylat nélküli) sor főcíme VÁLTOZATLAN marad —
  ott a tétel a halvány alsorba kerül. Ennek a sornak nincs száma, tehát az állapot
  a fontosabb állítás.
- **Ugyanaz a megnevezés megy ki a számla-levél TÁRGYÁBAN is.** Egy igazság, egy
  forrás: eddig minden számla tárgya „Citoviso előfizetés" volt — a 14 900 Ft-os
  egyszeri többnyelvű díjé is, ami nem előfizetés (§B.17).

### Üzenetek → csatorna-jelölés

- Minden soron **OLVASHATÓ CSATORNA-FELIRAT**: `E-mail` / `SMS`, a dátum alatt
  (mobilon külön sorban, asztalin a dátum mellett).
  ⛔ Az ikon önmagában NEM jelölés: boríték és beszéd-buborék 19 px-en, szöveg
  nélkül, nem válaszolja meg a „melyik csatornán jött?" kérdést — a szűrő nem
  helyettesíti a soron álló tényt.
- Az SMS-jelölés cián, az e-mailé semleges — a meglévő `adm-msg__ch--sms`
  ikon-háttérrel azonos logika.

### Üzenetek → túlhaladottság („A" változat)

- Egy **ÁLLAPOT-SZÁLON** belül csak a legfrissebb üzenet a hatályos szó.
- A **legfrissebb** sor: zöld **`Ez a legfrissebb`** címke + zöldes keret.
  Csak akkor, ha a szálnak VAN korábbi tagja (egyedi üzenet nem kap címkét).
- A **túlhaladott** sor: szaggatott keret, halvány + áthúzott cím, szürke
  **`Túlhaladott`** címke, ALATTA pedig **MEGNEVEZI a felülíróját**:
  `Felülírta: „<cím>" · <dátum időpont>`.
  ⛔ A sor **NEM tűnik el és nem lesz olvashatatlan** — a tulaj nyithatja, keresheti,
  a tartalma változatlan. A jelölés állapot-állítás, nem cenzúra.
- ⛔ A túlhaladottságot a **TELJES postaládán** kell számolni, a csatorna-/olvasatlan-/
  kereső-szűrés ELŐTT. Szűrt nézetben egy régi SMS különben „legfrissebb"-nek
  látszana, mert az őt felülíró e-mail kiesett a szűrőn — a szűrő termelné a hazugságot.
- **Mi számít állapot-szálnak** (`src/tenant/messageThreads.ts` regisztere):
  | kind | szál | miért |
  |---|---|---|
  | `dunning` | tenantonként EGY | a felszólítás-létra egyirányú, és egy tenanthoz egy előfizetés tartozik |
  | `multilang` | tenantonként EGY | egy fordítás-állapot van; az új „elavult" értesítő szó szerint felváltja az előzőt |
  | `booking` | `related_id`-nként | „Foglalási kérés" → „elfogadva" / „lemondva" / „lejárt" |
  | *minden más* | **NINCS** | számla, belépési adatok, vélemény, forgalom: mind önálló tény |
  ⛔ A `domain` SZÁNDÉKOSAN kimarad: a `provisionDomain` `related_id` nélkül naplóz,
  így két különböző webcím egy szálba esne, és egy élő domaint egy másik írna felül.
  Nem mérhető ma → nem állítjuk.
  ⛔ A `booking` `related_id` nélküli ága (érdeklődés) sem szálazódik: két külön
  érdeklődés nem egymás verziója.

---

## 2. Amit a terv NEM köt

- A tervben szereplő **két SMS-sor MINTA** — a dev-parkban ma nulla SMS van
  (mérve: 119 üzenet, mind `email`). A csatorna-jelölés megítéléséhez kellettek.
- Az ADR-0084 README egyéb pontjai (aldivatok, összegző, kereszt-találat, üres
  állapotok, „Mind olvasott") változatlanul érvényesek.
- A FK-001 **E2 lelete** (114 olvasatlan, ismétlődő foglalás-sorok zaja) EBBEN a
  körben NEM oldódik meg: a „B — szálba csukva" változat válaszolt volna rá, a
  tulaj az „A"-t választotta. Nyitott tétel marad.

---

## 3. Amit a terv-kör közben MÉRTEM (a megvalósításnak is szól)

- ⚠️ **CSS-specificitás-csapda, élőben elkapva:** a mock első desktop képén MINDKÉT
  számla-sor-elrendezés egyszerre renderelt, mert az `.adm-inv__t strong` (0,1,1)
  VERI a puszta `.inv-no{display:none}`-t (0,1,0). Ugyanaz a hibaosztály, amit a
  `citui-admin.css` `.adm-inv__t .adm-chip2` megjegyzése már egyszer rögzített.
  Az ÚJ szelektorok ezért viselik az `.adm-inv__t` őst.
- ⚠️ **A saját viselkedés-ellenőrzőm sem fogta meg elsőre**, mert csak azt mérte,
  hogy a MÁSIK elrendezés megjelenik. A mérce azóta: **pontosan EGY** főcím látszik.
- ⚠️ A méret-váltó a **viewportból indul**, különben a desktop kép is mobil
  elrendezést fotóz (`reference_mock_size_switch_starts_from_viewport`).
