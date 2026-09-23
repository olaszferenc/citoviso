## ADR-0125 — A lista SORA mondja meg, miről szól — és mi már nem igaz (2026-09-12)

**Kontextus.** Az Elek FK-001 újramérése három leletet adott a fizető ügyfél tenant-admin
felületén, és mindhárom ugyanannak a hibaosztálynak a példánya: **az adat megvolt, csak nem
jutott el a SORIG.**

- **E1** — A Dokumentumok listán 18 közel azonos számla-sor állt (1 149 525 Ft): szám, dátum,
  „Kifizetve · AAM”, összeg. **Egy szó sem arról, mi a bizonylat tárgya.** A dev-parkban
  megmérve a 18 sor valójában KÉT termék volt: **11 éves előfizetés (99 900 Ft) + 7 egyszeri
  többnyelvű generálási díj (14 900 Ft)**. Ugyanezt a leírást az ÜZENETEK fül megadta.
- **Z2** — Az üzenet-soron nem látszott a csatorna: e-mail és SMS ugyanazt a 19 px-es ikont
  viselte, és csak a SZŰRŐVEL derült ki — miközben a fül bevezetője „e-mailben és SMS-ben”-t
  ígér, és van E-mail/SMS szűrő.
- **Z1** — „Honlapja felfüggesztve — a rendezetlen 99 900 HUF díj miatt” állt egy sorral a
  „Honlapja újra elérhető” ALATT, miközben a fiók élő és minden számla kifizetve. Megmérve:
  **50 dunning-üzenet, 8 freeze→thaw körből** — a MENNYISÉG park-zaj, de **már EGY kör is négy
  túlhaladott értesítőt hagy**, ami ellentmond a fiók mai állapotának (§B.17).

**Döntés.**

1. **A SZÁMLA-TÉTEL LEVEZETETT, NEM FELIRAT.** Egy regiszter (`src/billing/invoiceItem.ts`)
   képezi le az `order_intent.kind` + `billing_period` párost tétel-névre — **ugyanaz a két
   oszlop, amiből az ÖSSZEG is származik**. Egy sor így szerkezetileg nem tud olyan terméket
   megnevezni, amit nem számláztunk (a `leadFilters.ts` mintája: a felirat abból jöjjön, amit
   a predikátum olvas).
2. **EGY IGAZSÁG, EGY FORRÁS.** Ugyanaz a regiszter adja a **számla-levél tárgyát** is. Eddig
   MINDEN számla tárgya „Citoviso előfizetés” volt — **a 14 900 Ft-os egyszeri díjé is**, ami
   nem előfizetés. Ugyanez a törzsben: az „Előfizetés: éves” sor helyén most „Tétel: …” áll,
   és egyszeri díjnál a levél „megrendelést” köszön, nem „előfizetést”.
3. **A TÉTEL A FŐCÍM** (tulajdonosi döntés, §2b kapu, „A” változat). Ez **felülírja** az
   ADR-0084 README „számlaszám · dátum…” sorrendjét: a szám és a dátum a halvány alsorba
   kerül. A bizonylat nélküli („Számlázás folyamatban”) sor főcíme marad az ÁLLAPOT — annak
   nincs száma, ott az a fontosabb állítás.
4. **A CSATORNA SZÖVEGGEL ÁLL A SORON** („E-mail” / „SMS”). Az ikon jelzés, nem felirat: a
   szűrő a lista tulajdonsága, a kérdés („melyiken jött?”) a SORÉ.
5. **TÚLHALADOTTSÁG = SZÁL-POZÍCIÓ, LEVEZETVE** (`src/tenant/messageThreads.ts`). Egy
   **állapot-szálon** belül csak a legfrissebb üzenet a hatályos szó; a régebbiek
   „Túlhaladott” jelölést kapnak, **és MEGNEVEZIK, mi írta felül** (cím + időpont). A szálfej
   „Ez a legfrissebb” jelölést kap — de csak ha van korábbi tagja.
   - A jelölés **semmit nem rejt el**: a sor nyitható, kereshető, tartalma változatlan. Ez
     állapot-állítás, nem cenzúra.
   - **Mi számít állapot-szálnak:** `dunning` (tenantonként egy — egy előfizetés, egyirányú
     létra), `multilang` (tenantonként egy), `booking` (`related_id`-nként).
   - ⛔ **Ami SZÁNDÉKOSAN kimarad:** `invoice`, `credentials`, `review`, `traffic` (mind
     önálló tény); a `domain` (a `provisionDomain` `related_id` nélkül naplóz, így két külön
     webcím egy szálba esne); a `booking` `related_id` nélküli érdeklődés-ága (két külön
     érdeklődés nem egymás verziója). **Nem mérhető ma → nem állítjuk.**
6. **A TÚLHALADOTTSÁG A TELJES POSTALÁDÁN DŐL EL**, a csatorna-/olvasatlan-/kereső-szűrés
   ELŐTT. Ezért költözött a szűrés az SQL-ből a `listTenantMessages()` JS-ágába. Szűrve egy
   régi SMS különben „legfrissebb”-nek látszana, mert az őt felülíró e-mail kiesett a
   szűrőn — **a szűrő termelné a hazugságot.**

**Miért nem fogta meg ezt semmi eddig.** Mindhárom lelet mellett **minden egység-teszt zöld
maradt volna**: a tétel-név létezett (az `order_intent`ben), a csatorna létezett (az
oszlopban), a túlhaladottság levezethető volt — csak egyikük sem jutott el a kirenderelt
sorig. **Ezért az őr (`scripts/admin-list-labels-check.mts`) a RENDERELT listát méri**, nem a
forrást; hermetikus fixture-rel (se DB, se szerver), pre-commitba kötve. Negatív kontroll:
a visszarontott nézeten **7 sértés**, köztük mind a három bejelentett. A ③ (csatorna)
öntesztje a FIX ELŐTTI markupot állítja vissza — enélkül az az állítás soha nem lenne piros,
tehát nem is lenne bizonyíték.

**Kapuk.** `admin-list-labels-check` (pre-commit, `adminViews`/`invoiceItem`/`messages`/
`messageThreads`/`documents` hatókörre) · `invoiceItem.ts` felvéve az `i18n-sources`
listájára ÉS a `kb-check` tenant-korpuszába (egy copy-hordozó fájl mindkettőn KÖTELEZŐ,
`feedback_guard_scope_is_the_doctrine`).

**Nyitva marad.** Az FK-001 **E2** (114 olvasatlan, ismétlődő foglalás-sorok zaja): a §2b kör
„B — szálba csukva” változata válaszolt volna rá, a tulaj az „A”-t választotta. Külön döntés.

**Kontraktus:** `assets/design-refs/tenant-admin/fk001-dokumentumok-uzenetek/`
(tulaj jóváhagyta 2026-09-12; kiegészíti, nem váltja fel az ADR-0084 tervét).

**Visszafordíthatóság:** 🔄 — felület- és levél-szintű, nulla migráció, nulla adat-mozdulat.
