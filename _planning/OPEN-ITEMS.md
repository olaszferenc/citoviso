# NYITOTT TÉTELEK — teljes leltár

*Felmérve: 2026-09-09 · forrás: `PILOT-GO-LIVE-INVENTORY.md` + a `_planning/memory/` szeptemberi
session-jegyzeteinek „Nyitott" szakaszai + mérés a kódon/DB-n. Csak olvasás.*

> **Egy mondatban:** a gépi oldal lényegében kész és **59 committal / 7 migrációval előrébb jár,
> mint az éles** — a fizetős kör mégsem zárul, mert **3 külső fiók hiányzik**, és azok mind
> rád várnak. Minden más ez alatt sorakozik.

---

## ⛔ A) RÁD VÁR — e nélkül a fizetős kör NEM zárul

| # | Mi | Miért blokkol | Állapot |
|---|---|---|---|
| A1 | **Barion ÉLES bolt** | e nélkül nincs kártyás fizetés — a prod ma `PAYMENT_GATEWAY=mock` | ⛔ nyitva · **leghosszabb átfutás, ez a kritikus út** |
| A2 | **Számlázz.hu éles kulcs** | fizetés számla nélkül jogilag nem mehet; a prod ma a teszt-fiók kulcsát viszi | ⛔ nyitva |
| ~~A3~~ | ~~Registrar: kredit + ToS~~ | — | ✅ **KÉSZ** (mérve 2026-09-09: ToS megerősítve, **6 000 Ft kredit**). A vétel innentől **gépi oldalon** akad — lásd D0 |
| ~~A4~~ | ~~Citoviso saját GBP~~ | — | ✅ **KÉSZ (2026-09-09)** → az ADR-0107 **60 napos órája elindult**, az API-jóváhagyás ~2026-11-08-tól kérhető |

**Ha csak egyet csinálsz:** az **A1**. A registrar-tétel 2026-09-09-én lekerült a listádról.

### A4b — a registrar-fiók „időzített bombái" (ÚJRAMÉRVE 2026-09-09)

Négyből három MEGSZŰNT — a leltár korábbi sorai elavultak voltak:

- ✅ **A #211604 átadás LEFUTOTT:** a `citoviso.hu` a `olaszferenc/3213041` fiókon van
  (`service` id 16270859, `status: active`, 1 990 Ft/év, létrehozva 2026-09-06, lejár
  **2027-09-07**), és a DNS-zónája is ott ül → **a zone-API mostantól mérhető** (a korábbi
  „az átadásig nem mérhető" megállapítás elavult).
- ✅ **`autoExtend: TRUE`** — az „egy év múlva szó nélkül lejár" bomba hatástalanítva.
- ✅ **A fiók alapértelmezett profilja tiszta:** `Olasz Ferenc`, cégjegyzékszám és adószám
  NÉLKÜL (magánszemély) — a „kevert registrant-adat" a fiók oldalán nem látszik.
  *(A nyilvántartó saját rekordját innen nem tudom kiolvasni.)*
- ⛔ **MARAD, és tisztán rád vár:** a minerallog jelszó + API-kulcs cseréje/visszavonása.

---

## 🚀 B) A NAGY ÉLESÍTÉS — kész, de a te kimondott engedélyedre vár

**Mérve ma:** az éles `dbbd5a7`-et futtat, az `origin/main` **59 committal**, **7 migrációval**
és **9 ADR-rel** jár előrébb. Ebben van minden, amit szeptemberben építettünk:

- ADR-0109 saját cím havi díjas · ADR-0110 tenant jogi lábazat · ADR-0111 piac-kapu ·
  ADR-0112 SMS meghívás · ADR-0113 fizetés-kapus modul · ADR-0114 egész szállás kizárása
- Forgalom fül + havi forgalmi levél · a mentés-nem-publikál javítás · a mai §C-kapu javítás

**A menete (egy ülés, gép csinálja):** KB-javítások → `kb-shot` → tudásbázis-őr *(számolj 3–5
körrel, minden körben valódi hibát talál)* → `kb-gate` token *(24h-ig él!)* → `deploy-prod.sh
<sha> --go` → ⚠️ **a `citoviso-traffic-mail.timer` kitétele** a másik három mellé → élesi
verifikáció 390px-en is.

> A B-blokk **nem függ az A-tól** — a kód kimehet a fiókok nélkül is. De amíg az A nyitva,
> a kint lévő rendszer **nem tud pénzt beszedni**, tehát a teljes kör mérőpróbája nem igaz.

---

## 💰 C) KONVERZIÓT ÉRINT — nem blokkol, de pénzt visz

| # | Mi | Mért tény |
|---|---|---|
| C1 | **Az aurora sablon kiveri a helyéről a vásárlási belépőt** | mérve: a prospect-konfigurátor indító gombja aurora mockon a lap legaljára esik (y≈14 000, a cinematicon helyesen fixed y=769) — **aurora-mock kiküldésekor a vevő nem találja a belépőt** |
| C2 | **A Forgalom választható nézete nincs lekódolva** | a terv jóváhagyva (Naponta / Hetente / Honnan és mivel / Csak a számok), a kód nem készült el |
| C3 | **A „következő számla" bontásából hiányzik a domain éves díja** | a `billing.ts` ráteszi a fordulónapos számlára → az évfordulós hónapban **többet terhelünk, mint amit a vevő olvas**. Ma nem érhető el (nincs élő tenant saját domainnel), legkorábban 1 év múlva sülne el. §2b terv-kaput igényel |
| ~~C4~~ | ~~landing „megtalálnak a térképen"~~ | ✅ **MA JAVÍTVA** — a Maps/GBP-ígéret kikerült (6 helyen), a keresős állítás maradt, mert azt tényleg szállítjuk (sitemap, robots, JSON-LD, canonical, og:) |

---

## 🔧 D) GÉPI ADÓSSÁG — halmozódik, egyik sem sürgős külön-külön

### ⛔ D0 — A DOMAIN-VÉTEL: a kapu átkerült hozzám (mérve 2026-09-09)

A kredit és a ToS megvan, tehát a vétel innentől **négy gépi tételen áll, nem rajtad**:

1. ✅ **`WEBSUPPORT_EXPECTED_REGISTRANT` — MEGVAN** (2026-09-09, tulaj-döntés: `Olasz Ferenc`,
   magánszemély). Az ADR-0103 ⑤ őre eddig minden vételt elutasított („a domain tulajdonosa nem
   igazolható"): az API nem fogad rendelésenkénti kontaktot, csak a fiók alapértelmezett
   profilját használja, ezért ELŐRE ki kell mondani, kinek a nevére vehetünk. A fiók profilja
   `Olasz Ferenc` → az őr átengedi. *(A dev `.env`-ben beírva; a prod `.env`-be az élesítéskor.)*
2. ⛔ **`REGISTRAR_PROVIDER` alapértéke `mock`** (`src/config.ts:238`) — a valódi adapter
   **el sem indul**. ⚠️ A KÖZÖS dev `.env`-ben ez SZÁNDÉKOSAN marad `mock`: ~10 párhuzamos
   session osztozik rajta, és egy teszt-folyamat valódi domaint vásárolna a kreditből.
   A `websupport` érték a **prod** `.env`-be való, az élesítéskor.
3. ⛔ **`DOMAIN_TARGET_IP` és `DOMAIN_HUF_PER_EUR`** hiányzik (a prod .env-ből is).
4. ✅ **A rendelés-kérés alakja MÁR MÉRVE VAN** — a korábbi „soha nem lett megmérve" sor téves
   volt. A `websupport.ts` kommentje kimondja: ez az a folyamat, amely **ténylegesen
   regisztrálta a citoviso.hu-t 2026-09-06-án (rendelés 22266509)**, egy korábbi session
   átiratából szó szerint visszanyerve — nem dokumentációból tippelve. Dry-run mérés tehát
   NEM kell, és nem is futott.

**Kredit-fedezet:** 6 000 Ft ÷ 1 990 Ft/év ≈ **3 db `.hu` domain** (áfa nélküli listaáron).

### ⚠️ D0b — a `.hu` regisztráció NEM emberi kéz nélküli (mérve a saját vételünkön)

Ez eddig SEHOL nem szerepelt a leltárban, pedig a tulajdonosi mérőpróbát érinti
(*„egy vevő a konfigurátortól a saját domainig ÉLESBEN, emberi kéz nélkül ér célba"*).

A `websupport.ts` fejlécében rögzített, a saját vásárlásunkon mért tények:
- a fizetés másodpercek alatt megy, **de a nyilvántartó ezután e-mailes megerősítést kér
  a REGISTRANT-tól**, adat-ellenőrzést futtat, és **8 napos feltételes időszakot** alkalmaz;
- a domain **csak MÁSNAP** oldódott fel;
- a megerősítő űrlap gépi kitöltése **NÉMÁN elbukott** (nem jött sikeres képernyő, az egyszer
  használatos kód pedig elhasználódott).

Ezért a kódban a „registered" azt jelenti: **megvéve és kifizetve** — sosem azt, hogy „él".
**Következmény: a teljes kör `.hu` domainnel ma nem zárható emberi kattintás nélkül.** Vagy
elfogadjuk, hogy a megerősítő levélre valaki rákattint, vagy a `.hu`-ág külön kezelést kap.


- **Migráció-sorszám-ütközésre MÉG MINDIG nincs őr.** Ma mérve: **két `0059`** vár élesítésre
  (`tenant_message_traffic` + `unit_whole_property`). Ez a **negyedik** eset (0051×2, 0052×2,
  0053×2, 0059×2). Most **ártalmatlan** — a `schema_migrations` a teljes fájlnevet jegyzi, a
  kettő független táblát érint, a sorrend determinisztikus —, de eddig minden alkalommal
  szerencse döntött, nem szabály.
- **A `module-config-check` 8 állítása elavult** (a `main`-en is piros, nem egy szál hibája).
- **Az országonkénti jogi csomag TARTALMA** hiányzik: a `legal.ts` egyetlen, magyar csomagot
  ismer. A piac-kapu (ADR-0111) csak a KÉRDÉST teszi fel — a második piac megnyitása előtt a
  szövegeknek ország szerint kell szétválniuk. Ugyanez a pénznem/árazás (`module_price` globális HUF).
- **A levél-kapunak nincs feladó-azonosítás szabálya** (az SMS-nek van) — ma nem éles rés, de
  a szimmetria hiányzik.
- **14 régi terv-kontraktus áll kép nélkül**, 9 jelöl feliratot hatókör nélkül.
- **Új gyerektábla + CASCADE = néma kimaradás a purge mentéséből** — erre sincs őr (a 09-08-i
  purge két táblát így hagyott ki).
- **A `pl` nyelvi csomag KB-fordítása 18/19** (egy entrynél integritás-sértés).
- **A nem-live tenant-pillanatképek a régi runtime-ot hordozzák** a következő rerenderig.
- **`_engine-proof` 242 MB** ül a fő fa `sites/` fájában (a mentésből tudatosan kimarad, de
  magától nem takarodik).

---

## 📋 E) FIGYELENDŐ / A TE DÖNTÉSEDRE VÁR

- **ÁFA-kör** (AAM-értékhatár figyelés + árkommunikáció) — a tulaj hívja le.
- **Dencs legacy booking+pricing sorok** (régi B-opciós, a 2027-es számlára várnak):
  **nullázzuk?** Enélkül az új, fizetés-kapus utat nem tudod végigtesztelni ugyanazon a tenanton.
- **STOP-válasz feldolgozása** SMS-re nincs (ADR-0083 óta); a hordozó-lábazat magyarul beégetett.
- **ADR-0088 ① kedvezmény-mondat:** teljes törlést kértél, ma a szürke lábjegyzetben ül —
  ADR-döntés kell hozzá.
- **`OUTREACH_SENDER_PHONE` / `LEGAL_ENTITY_PHONE`:** kerüljön-e telefonszám a levelekbe és az
  impresszumba?
- **Régió-származtatás koordinátából** — jóváhagyott, még el nem indított külön kör
  (15 déli parti lead ma `balaton-north` alatt ül, és ez a generálásba is befolyik).
- **FK-006 dunning-időutazó** — az Elek ALL-IN térkép utolsó eleme.
- **Google Fonts self-host** — megszüntetné a font-célú IP-továbbítást.

---

## Amit MA lezártunk (hogy ne kerüljön vissza a listára)

- §C megkeresés-kapu: hamis FLAG (token `xXx`, 1:1637) **és** hamis PASS (névtelen tömeg-levél
  PASS-t kapott, mert a név és a keretezés az URL slugjából teljesült) — mindkettő javítva,
  az őr mindkét csatornát méri, RED-kontrollal.
- Dev DB mentése: nulláról napi 4×, önellenőrző, ellenőrzőösszeggel (kiderült: a
  visszaállítás-próba **vak volt a csonkolásra** — az éles mentés is megkapta a javítást).
- Landing: a Maps/GBP-túlígéret kivéve.
